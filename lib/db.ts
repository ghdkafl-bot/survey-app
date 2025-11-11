// 로컬 데이터베이스 (나중에 Supabase로 교체 가능)
// 메모리 기반 저장소로 구현

import { promises as fs } from 'fs'
import path from 'path'

export type QuestionType = 'scale' | 'text'

export interface SubQuestion {
  id: string
  questionId: string
  text: string
  order: number
}

export interface ClosingMessage {
  text: string
  color?: string
  fontSize?: number
  fontWeight?: string
  fontStyle?: 'normal' | 'italic'
  textAlign?: 'left' | 'center' | 'right'
  fontFamily?: string
}

export interface QuestionGroup {
  id: string
  surveyId: string
  title: string // 섹션 제목
  order: number
  questions: Question[] // 1~5개
}

export interface Question {
  id: string
  groupId: string
  text: string
  order: number
  type: QuestionType
  subQuestions: SubQuestion[]
  includeNoneOption?: boolean
}

export interface Survey {
  id: string
  title: string
  description?: string
  createdAt: string
  backgroundColor?: string
  questionGroups: QuestionGroup[]
  closingMessage: ClosingMessage
}

export interface Response {
  id: string
  surveyId: string
  answers: Answer[]
  submittedAt: string
  patientName?: string
  patientType?: string
}

export interface Answer {
  questionId: string
  subQuestionId?: string
  value?: number | null
  textValue?: string | null
}

const DATA_DIR = path.join(process.cwd(), 'data')
const SURVEYS_FILE = path.join(DATA_DIR, 'surveys.json')
const RESPONSES_FILE = path.join(DATA_DIR, 'responses.json')

const DEFAULT_CLOSING_MESSAGE: ClosingMessage = {
  text: '설문에 응해주셔서 감사합니다. 귀하의 의견으로 더욱 발전하는 "의료법인 구암의료재단 포항시티병원"이 되겠습니다.',
  color: '#1f2937',
  fontSize: 18,
  fontWeight: '600',
  fontStyle: 'normal',
  textAlign: 'center',
  fontFamily: 'inherit',
}

const DEPRECATED_GROUP_IDS = ['__free_opinion_group']
const DEPRECATED_QUESTION_IDS = ['__free_opinion_praise', '__free_opinion_improve']

async function ensureDataFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
      await fs.access(SURVEYS_FILE)
    } catch {
      await fs.writeFile(SURVEYS_FILE, JSON.stringify([], null, 2), 'utf-8')
    }
    try {
      await fs.access(RESPONSES_FILE)
    } catch {
      await fs.writeFile(RESPONSES_FILE, JSON.stringify([], null, 2), 'utf-8')
    }
  } catch (error) {
    console.error('Failed to initialize data files:', error)
  }
}

const normalizeQuestion = (question: any, groupId: string, fallbackIdPrefix: string, index: number): Question => {
  const questionId = question?.id || `${fallbackIdPrefix}-q-${index}`
  const type: QuestionType = question?.type === 'text' ? 'text' : 'scale'
  const rawSubQuestions = Array.isArray(question?.subQuestions) ? question.subQuestions : []
  const subQuestions: SubQuestion[] = rawSubQuestions
    .slice(0, 5)
    .map((sub: any, subIdx: number) => ({
      id: sub?.id || `${questionId}-sub-${subIdx}`,
      questionId,
      text: typeof sub?.text === 'string' ? sub.text : '',
      order: typeof sub?.order === 'number' ? sub.order : subIdx,
    }))
  return {
    id: questionId,
    groupId,
    text: typeof question?.text === 'string' ? question.text : '',
    order: typeof question?.order === 'number' ? question.order : index,
    type,
    subQuestions,
    includeNoneOption: type === 'scale' ? Boolean(question?.includeNoneOption) : undefined,
  }
}

const normalizeClosingMessage = (closingMessage: any): ClosingMessage => ({
  ...DEFAULT_CLOSING_MESSAGE,
  ...(typeof closingMessage === 'object' && closingMessage
    ? {
        text: typeof closingMessage.text === 'string' && closingMessage.text.trim().length > 0
          ? closingMessage.text
          : DEFAULT_CLOSING_MESSAGE.text,
        color: typeof closingMessage.color === 'string' ? closingMessage.color : DEFAULT_CLOSING_MESSAGE.color,
        fontSize: typeof closingMessage.fontSize === 'number' ? closingMessage.fontSize : DEFAULT_CLOSING_MESSAGE.fontSize,
        fontWeight: typeof closingMessage.fontWeight === 'string' ? closingMessage.fontWeight : DEFAULT_CLOSING_MESSAGE.fontWeight,
        fontStyle: closingMessage.fontStyle === 'italic' ? 'italic' : DEFAULT_CLOSING_MESSAGE.fontStyle,
        textAlign: ['left', 'center', 'right'].includes(closingMessage.textAlign)
          ? closingMessage.textAlign
          : DEFAULT_CLOSING_MESSAGE.textAlign,
        fontFamily: typeof closingMessage.fontFamily === 'string' ? closingMessage.fontFamily : DEFAULT_CLOSING_MESSAGE.fontFamily,
      }
    : {}),
})

const normalizeSurvey = (survey: any): Survey => {
  const surveyId = survey?.id || Date.now().toString()
  const rawGroups = Array.isArray(survey?.questionGroups) ? survey.questionGroups : []
  const questionGroups: QuestionGroup[] = rawGroups
    .filter((group: any) => !DEPRECATED_GROUP_IDS.includes(group?.id))
    .map((group: any, groupIdx: number) => {
      const groupId = group?.id || `${surveyId}-group-${groupIdx}`
      const rawQuestions = Array.isArray(group?.questions) ? group.questions : []
      return {
        id: groupId,
        surveyId,
        title: typeof group?.title === 'string' ? group.title : '',
        order: typeof group?.order === 'number' ? group.order : groupIdx,
        questions: rawQuestions
          .filter((q: any) => !DEPRECATED_QUESTION_IDS.includes(q?.id))
          .map((q: any, qIdx: number) => normalizeQuestion(q, groupId, surveyId, qIdx)),
      }
    })
  return {
    id: surveyId,
    title: typeof survey?.title === 'string' ? survey.title : '',
    description: typeof survey?.description === 'string' ? survey.description : undefined,
    createdAt: typeof survey?.createdAt === 'string' ? survey.createdAt : new Date().toISOString(),
    backgroundColor: typeof survey?.backgroundColor === 'string' ? survey.backgroundColor : undefined,
    questionGroups,
    closingMessage: normalizeClosingMessage(survey?.closingMessage),
  }
}

const normalizeAnswer = (answer: any): Answer => ({
  questionId: answer?.questionId,
  subQuestionId: answer?.subQuestionId,
  value: typeof answer?.value === 'number' ? answer.value : null,
  textValue: typeof answer?.textValue === 'string' ? answer.textValue : undefined,
})

async function loadSurveys(): Promise<Survey[]> {
  try {
    await ensureDataFiles()
    const data = await fs.readFile(SURVEYS_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed.map(normalizeSurvey) : []
  } catch (error) {
    console.error('Failed to load surveys:', error)
    return []
  }
}

async function loadResponses(): Promise<Response[]> {
  try {
    await ensureDataFiles()
    const data = await fs.readFile(RESPONSES_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    if (!Array.isArray(parsed)) return []
    return parsed.map((response: any) => ({
      id: response?.id || Date.now().toString(),
      surveyId: response?.surveyId,
      submittedAt: response?.submittedAt || new Date().toISOString(),
      patientName: response?.patientName,
      patientType: response?.patientType,
      answers: Array.isArray(response?.answers)
        ? response.answers.map(normalizeAnswer)
        : [],
    }))
  } catch (error) {
    console.error('Failed to load responses:', error)
    return []
  }
}

async function saveSurveys(surveys: Survey[]) {
  try {
    await ensureDataFiles()
    await fs.writeFile(SURVEYS_FILE, JSON.stringify(surveys, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save surveys:', error)
    throw error
  }
}

async function saveResponses(responses: Response[]) {
  try {
    await ensureDataFiles()
    await fs.writeFile(RESPONSES_FILE, JSON.stringify(responses, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to save responses:', error)
    throw error
  }
}

const isWithinRange = (dateString: string, from?: string, to?: string) => {
  const date = new Date(dateString).getTime()
  if (Number.isNaN(date)) return false
  if (from) {
    const fromTime = new Date(from).getTime()
    if (!Number.isNaN(fromTime) && date < fromTime) return false
  }
  if (to) {
    const toTime = new Date(to).getTime()
    if (!Number.isNaN(toTime) && date > toTime) return false
  }
  return true
}

export const db = {
  createSurvey: async (survey: Omit<Survey, 'id' | 'createdAt'>): Promise<Survey> => {
    const surveys = await loadSurveys()
    const surveyId = Date.now().toString()
    const questionGroups = survey.questionGroups.map((group, groupIdx) => {
      const groupId = group.id || `${surveyId}-group-${groupIdx}`
      return {
        id: groupId,
        surveyId,
        title: group.title,
        order: group.order ?? groupIdx,
        questions: group.questions.map((question, qIdx) => {
          const questionId = question.id || `${surveyId}-q-${groupIdx}-${qIdx}`
          return {
            id: questionId,
            groupId,
            text: question.text,
            order: question.order ?? qIdx,
            type: question.type,
            subQuestions: question.subQuestions.slice(0, 5).map((sub, subIdx) => ({
              id: sub.id || `${questionId}-sub-${subIdx}`,
              questionId,
              text: sub.text,
              order: sub.order ?? subIdx,
            })),
            includeNoneOption: question.type === 'scale' ? Boolean(question.includeNoneOption) : undefined,
          }
        }),
      }
    })
    const newSurvey: Survey = {
      ...survey,
      id: surveyId,
      createdAt: new Date().toISOString(),
      questionGroups,
      closingMessage: normalizeClosingMessage(survey.closingMessage),
    }
    surveys.push(newSurvey)
    await saveSurveys(surveys)
    return newSurvey
  },

  getSurvey: async (id: string): Promise<Survey | undefined> => {
    const surveys = await loadSurveys()
    return surveys.find((s) => s.id === id)
  },

  getAllSurveys: async (): Promise<Survey[]> => {
    return await loadSurveys()
  },

  updateSurvey: async (id: string, survey: Partial<Omit<Survey, 'id' | 'createdAt'>>): Promise<Survey | undefined> => {
    const surveys = await loadSurveys()
    const index = surveys.findIndex((s) => s.id === id)
    if (index === -1) return undefined

    const existingSurvey = surveys[index]
    const questionGroups = survey.questionGroups
      ? survey.questionGroups.map((group, groupIdx) => {
          const groupId = group.id || `${id}-group-${groupIdx}`
          return {
            id: groupId,
            surveyId: id,
            title: group.title,
            order: group.order ?? groupIdx,
            questions: group.questions.map((question, qIdx) => {
              const questionId = question.id || `${id}-q-${groupIdx}-${qIdx}`
              return {
                id: questionId,
                groupId,
                text: question.text,
                order: question.order ?? qIdx,
                type: question.type,
                subQuestions: question.subQuestions.slice(0, 5).map((sub, subIdx) => ({
                  id: sub.id || `${questionId}-sub-${subIdx}`,
                  questionId,
                  text: sub.text,
                  order: sub.order ?? subIdx,
                })),
                includeNoneOption: question.type === 'scale' ? Boolean(question.includeNoneOption) : undefined,
              }
            }),
          }
        })
      : existingSurvey.questionGroups

    const updatedSurvey: Survey = {
      ...existingSurvey,
      ...survey,
      id: existingSurvey.id,
      createdAt: existingSurvey.createdAt,
      questionGroups,
      closingMessage: survey.closingMessage
        ? normalizeClosingMessage(survey.closingMessage)
        : existingSurvey.closingMessage,
    }

    surveys[index] = updatedSurvey
    await saveSurveys(surveys)
    return updatedSurvey
  },

  createResponse: async (response: Omit<Response, 'id' | 'submittedAt'>): Promise<Response> => {
    const responses = await loadResponses()
    const newResponse: Response = {
      ...response,
      id: Date.now().toString(),
      submittedAt: new Date().toISOString(),
      answers: response.answers.map(normalizeAnswer),
    }
    responses.push(newResponse)
    await saveResponses(responses)
    return newResponse
  },

  getResponsesBySurvey: async (surveyId: string): Promise<Response[]> => {
    const responses = await loadResponses()
    return responses.filter((r) => r.surveyId === surveyId)
  },

  getAllResponses: async (): Promise<Response[]> => {
    return await loadResponses()
  },

  deleteResponsesBySurveyAndDateRange: async (
    surveyId: string,
    from?: string,
    to?: string
  ): Promise<number> => {
    const responses = await loadResponses()
    const remaining: Response[] = []
    let deletedCount = 0
    responses.forEach((response) => {
      if (
        response.surveyId === surveyId &&
        (!from && !to ? true : isWithinRange(response.submittedAt, from, to))
      ) {
        deletedCount += 1
      } else {
        remaining.push(response)
      }
    })
    if (deletedCount > 0) {
      await saveResponses(remaining)
    }
    return deletedCount
  },
}

