import { supabase } from './supabaseClient'

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
  title: string
  order: number
  questions: Question[]
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

const mapSurveyRecord = (record: any): Survey => {
  if (!record) throw new Error('Invalid survey record')

  const questionGroups: QuestionGroup[] = (record.question_groups ?? [])
    .filter((group: any) => !DEPRECATED_GROUP_IDS.includes(group?.id))
    .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((group: any) => {
      const questions: Question[] = (group.questions ?? [])
        .filter((question: any) => !DEPRECATED_QUESTION_IDS.includes(question?.id))
        .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
        .map((question: any) => ({
          id: question.id,
          groupId: group.id,
          text: question.text,
          order: question.order ?? 0,
          type: question.type === 'text' ? 'text' : 'scale',
          includeNoneOption: question.type === 'scale' ? Boolean(question.include_none_option) : undefined,
          subQuestions: (question.sub_questions ?? [])
            .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))
            .map((sub: any) => ({
              id: sub.id,
              questionId: question.id,
              text: sub.text,
              order: sub.order ?? 0,
            })),
        }))

      return {
        id: group.id,
        surveyId: record.id,
        title: group.title,
        order: group.order ?? 0,
        questions,
      }
    })

  return {
    id: record.id,
    title: record.title,
    description: record.description ?? undefined,
    createdAt: record.created_at ?? new Date().toISOString(),
    backgroundColor: record.background_color ?? undefined,
    questionGroups,
    closingMessage: normalizeClosingMessage(record.closing_message),
  }
}

const mapResponseRecord = (record: any): Response => ({
  id: record.id,
  surveyId: record.survey_id,
  patientName: record.patient_name ?? undefined,
  patientType: record.patient_type ?? undefined,
  submittedAt: record.submitted_at ?? new Date().toISOString(),
  answers: (record.answers ?? []).map((answer: any) => ({
    questionId: answer.question_id,
    subQuestionId: answer.sub_question_id ?? undefined,
    value: typeof answer.value === 'number' ? answer.value : answer.value === null ? null : undefined,
    textValue: typeof answer.text_value === 'string' ? answer.text_value : undefined,
  })),
})

async function insertQuestionStructure(
  surveyId: string,
  questionGroups: QuestionGroup[]
) {
  for (const [groupIdx, group] of questionGroups.entries()) {
    const { data: insertedGroup, error: groupError } = await supabase
      .from('question_groups')
      .insert({
        survey_id: surveyId,
        title: group.title,
        order: group.order ?? groupIdx,
      })
      .select()
      .single()

    if (groupError) throw groupError

    const questions = group.questions ?? []

    for (const [questionIdx, question] of questions.entries()) {
      const { data: insertedQuestion, error: questionError } = await supabase
        .from('questions')
        .insert({
          group_id: insertedGroup.id,
          text: question.text,
          order: question.order ?? questionIdx,
          type: question.type,
          include_none_option: question.type === 'scale' ? Boolean(question.includeNoneOption) : null,
        })
        .select()
        .single()

      if (questionError) throw questionError

      const subQuestions = question.subQuestions ?? []

      if (subQuestions.length > 0) {
        const { error: subError } = await supabase
          .from('sub_questions')
          .insert(
            subQuestions.slice(0, 5).map((sub, subIdx) => ({
              question_id: insertedQuestion.id,
              text: sub.text,
              order: sub.order ?? subIdx,
            }))
          )

        if (subError) throw subError
      }
    }
  }
}

export const db = {
  createSurvey: async (survey: Omit<Survey, 'id' | 'createdAt'>): Promise<Survey> => {
    const questionGroups = survey.questionGroups ?? []
    const closingMessage = normalizeClosingMessage(survey.closingMessage)

    const { data: insertedSurvey, error } = await supabase
      .from('surveys')
      .insert({
        title: survey.title,
        description: survey.description ?? null,
        background_color: survey.backgroundColor ?? null,
        closing_message: closingMessage,
      })
      .select()
      .single()

    if (error) throw error

    await insertQuestionStructure(insertedSurvey.id, questionGroups)

    const created = await db.getSurvey(insertedSurvey.id)
    if (!created) throw new Error('생성된 설문을 불러오지 못했습니다.')
    return created
  },

  getSurvey: async (id: string): Promise<Survey | undefined> => {
    const { data, error } = await supabase
      .from('surveys')
      .select(`
        *,
        question_groups (
          id,
          title,
          order,
          questions (
            id,
            text,
            order,
            type,
            include_none_option,
            sub_questions ( id, text, order )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) return undefined
    return mapSurveyRecord(data)
  },

  getAllSurveys: async (): Promise<Survey[]> => {
    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id,
        title,
        description,
        background_color,
        closing_message,
        created_at,
        question_groups (
          id,
          title,
          order,
          questions (
            id,
            order
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data.map(mapSurveyRecord)
  },

  updateSurvey: async (
    id: string,
    survey: Partial<Omit<Survey, 'id' | 'createdAt'>>
  ): Promise<Survey | undefined> => {
    const payload: Record<string, any> = {}

    if (survey.title !== undefined) payload.title = survey.title
    if (survey.description !== undefined) payload.description = survey.description ?? null
    if (survey.backgroundColor !== undefined) payload.background_color = survey.backgroundColor ?? null

    if (survey.closingMessage !== undefined) {
      payload.closing_message = normalizeClosingMessage(survey.closingMessage)
    }

    if (Object.keys(payload).length > 0) {
      const { error: updateError } = await supabase
        .from('surveys')
        .update(payload)
        .eq('id', id)

      if (updateError) throw updateError
    }

    if (survey.questionGroups) {
      const { error: deleteGroupsError } = await supabase
        .from('question_groups')
        .delete()
        .eq('survey_id', id)

      if (deleteGroupsError) throw deleteGroupsError

      await insertQuestionStructure(id, survey.questionGroups)
    }

    return await db.getSurvey(id)
  },

  createResponse: async (response: Omit<Response, 'id' | 'submittedAt'>): Promise<Response> => {
    const { data: insertedResponse, error } = await supabase
      .from('responses')
      .insert({
        survey_id: response.surveyId,
        patient_name: response.patientName ?? null,
        patient_type: response.patientType ?? null,
      })
      .select('id, survey_id, patient_name, patient_type, submitted_at')
      .single()

    if (error) throw error

    if (response.answers.length > 0) {
      const answerPayload = response.answers.map((answer) => ({
        response_id: insertedResponse.id,
        question_id: answer.questionId,
        sub_question_id: answer.subQuestionId ?? null,
        value: typeof answer.value === 'number' ? answer.value : null,
        text_value: typeof answer.textValue === 'string' ? answer.textValue : null,
      }))

      const { error: answerError } = await supabase
        .from('answers')
        .insert(answerPayload)

      if (answerError) throw answerError
    }

    return mapResponseRecord({
      ...insertedResponse,
      answers: (response.answers ?? []).map((answer) => ({
        question_id: answer.questionId,
        sub_question_id: answer.subQuestionId ?? null,
        value: typeof answer.value === 'number' ? answer.value : null,
        text_value: typeof answer.textValue === 'string' ? answer.textValue : null,
      })),
    })
  },

  getResponsesBySurvey: async (surveyId: string): Promise<Response[]> => {
    const { data, error } = await supabase
      .from('responses')
      .select('id, survey_id, patient_name, patient_type, submitted_at, answers (id, question_id, sub_question_id, value, text_value)')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })

    if (error || !data) return []
    return data.map(mapResponseRecord)
  },

  getAllResponses: async (): Promise<Response[]> => {
    const { data, error } = await supabase
      .from('responses')
      .select('id, survey_id, patient_name, patient_type, submitted_at, answers (id, question_id, sub_question_id, value, text_value)')
      .order('submitted_at', { ascending: true })

    if (error || !data) return []
    return data.map(mapResponseRecord)
  },

  deleteResponsesBySurveyAndDateRange: async (
    surveyId: string,
    from?: string,
    to?: string
  ): Promise<number> => {
    let query = supabase
      .from('responses')
      .select('id')
      .eq('survey_id', surveyId)

    if (from) {
      query = query.gte('submitted_at', from)
    }

    if (to) {
      query = query.lte('submitted_at', to)
    }

    const { data: targets, error } = await query

    if (error || !targets || targets.length === 0) {
      return 0
    }

    const targetIds = targets.map((row: any) => row.id)

    const { error: deleteError } = await supabase
      .from('responses')
      .delete()
      .in('id', targetIds)

    if (deleteError) throw deleteError

    return targetIds.length
  },
}

