import { db, Answer, Response } from '@/lib/db'
import { getSupabaseServiceClient } from '@/lib/supabaseClient'

export const STATIC_SURVEY_ID = '0d8da8f8-8abb-4c63-8647-919154faf7ea'

const STATIC_Q_IDS = new Set(['q1', 'q2', 'q3', 'q4', 'q5'])
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getEffectiveAnswers(res: Response): Answer[] {
  if (res.answers.length > 0) return res.answers

  const backupRaw = (res.patientInfoAnswers as Record<string, unknown> | undefined)
    ?.__answers_backup
  if (!Array.isArray(backupRaw)) return []

  return backupRaw
    .map((a: unknown) => {
      if (!a || typeof a !== 'object') return null
      const row = a as Record<string, unknown>
      const questionId = row.questionId ?? row.question_id
      if (typeof questionId !== 'string' || questionId.length === 0) return null
      const rawValue = row.value
      const value =
        typeof rawValue === 'number'
          ? rawValue
          : rawValue === null
            ? null
            : typeof rawValue === 'string' &&
                rawValue.trim() !== '' &&
                !Number.isNaN(Number(rawValue))
              ? Number(rawValue)
              : undefined
      const textValue =
        typeof (row.textValue ?? row.text_value) === 'string'
          ? (row.textValue ?? row.text_value)
          : undefined
      return {
        questionId,
        subQuestionId:
          (row.subQuestionId ?? row.sub_question_id) as string | undefined,
        value,
        textValue: textValue as string | undefined,
      } as Answer
    })
    .filter((a): a is Answer => a !== null)
}

function countSnapshotQuestions(snapshot: unknown): number {
  if (!Array.isArray(snapshot)) return 0
  return snapshot.reduce((sum, group) => {
    if (!group || typeof group !== 'object') return sum
    const questions = (group as { questions?: unknown }).questions
    return sum + (Array.isArray(questions) ? questions.length : 0)
  }, 0)
}

export function isLegacyFormatResponse(res: Response): boolean {
  if (res.surveyId !== STATIC_SURVEY_ID) return true

  if (countSnapshotQuestions(res.questionSnapshot) > 5) return true

  const answers = getEffectiveAnswers(res)
  return answers.some(
    (a) =>
      UUID_RE.test(a.questionId) ||
      (a.questionId.length > 0 && !STATIC_Q_IDS.has(a.questionId)),
  )
}

async function fetchDistinctNonStaticSurveyIds(): Promise<string[]> {
  const supabase = getSupabaseServiceClient()
  const ids = new Set<string>()
  let from = 0
  const pageSize = 1000

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('responses')
      .select('survey_id')
      .neq('survey_id', STATIC_SURVEY_ID)
      .range(from, to)

    if (error) {
      console.error('[LegacyExport] Failed to list survey IDs:', error)
      break
    }
    if (!data || data.length === 0) break

    data.forEach((row: { survey_id?: string | null }) => {
      if (row.survey_id) ids.add(row.survey_id)
    })

    if (data.length < pageSize) break
    from += pageSize
  }

  return [...ids]
}

export async function collectLegacyResponses(): Promise<Response[]> {
  const byId = new Map<string, Response>()

  const addAll = (list: Response[]) => {
    list.forEach((res) => {
      if (!byId.has(res.id)) byId.set(res.id, res)
    })
  }

  const surveys = await db.getAllSurveys()
  for (const survey of surveys) {
    if (survey.id === STATIC_SURVEY_ID) continue
    addAll(await db.getResponsesBySurvey(survey.id))
  }

  const orphanSurveyIds = await fetchDistinctNonStaticSurveyIds()
  for (const surveyId of orphanSurveyIds) {
    if (surveys.some((s) => s.id === surveyId)) continue
    addAll(await db.getResponsesBySurvey(surveyId))
  }

  const staticResponses = await db.getResponsesBySurvey(STATIC_SURVEY_ID)
  addAll(staticResponses.filter(isLegacyFormatResponse))

  return [...byId.values()].sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  )
}

export type LegacyExportRow = {
  제출일시: string
  설문ID: string
  환자_성함: string
  환자_유형: string
  추가정보_JSON: string
  응답_JSON: string
}

export function responsesToLegacyRows(responses: Response[]): LegacyExportRow[] {
  return responses.map((res) => {
    const answers = getEffectiveAnswers(res)
    const patientInfo = res.patientInfoAnswers
      ? { ...res.patientInfoAnswers }
      : undefined
    if (patientInfo && '__answers_backup' in patientInfo) {
      delete (patientInfo as Record<string, unknown>).__answers_backup
    }

    return {
      제출일시: res.submittedAt,
      설문ID: res.surveyId,
      환자_성함: res.patientName ?? '',
      환자_유형: res.patientType ?? '',
      추가정보_JSON: patientInfo ? JSON.stringify(patientInfo) : '',
      응답_JSON: JSON.stringify(
        answers.map((a) => ({
          questionId: a.questionId,
          subQuestionId: a.subQuestionId,
          value: a.value,
          textValue: a.textValue,
        })),
      ),
    }
  })
}
