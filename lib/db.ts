import { getSupabaseServiceClient } from './supabaseClient'

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

export interface PatientInfoQuestion {
  id: string
  text: string
  options: string[]
  required?: boolean
}

export interface HomepageConfig {
  title: string
  description: string
}

export interface PatientInfoConfig {
  patientTypeLabel: string
  patientTypePlaceholder: string
  patientTypeOptions: string[]
  patientTypeRequired: boolean
  patientTypeTextColor?: string
  patientNameLabel: string
  patientNamePlaceholder: string
  patientNameRequired: boolean
  additionalQuestions?: PatientInfoQuestion[]
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
  patientInfoConfig: PatientInfoConfig
}

export interface Response {
  id: string
  surveyId: string
  answers: Answer[]
  submittedAt: string
  patientName?: string
  patientType?: string
  patientInfoAnswers?: Record<string, string[]>
}

export interface Answer {
  questionId: string
  subQuestionId?: string
  value?: number | null
  textValue?: string | null
}

export const DEFAULT_PATIENT_INFO_CONFIG: PatientInfoConfig = {
  patientTypeLabel: '환자 유형',
  patientTypePlaceholder: '환자 유형을 선택하세요',
  patientTypeOptions: ['외래', '3병동', '6병동', '종합검진'],
  patientTypeRequired: true,
  patientTypeTextColor: '#111827',
  patientNameLabel: '환자 성함',
  patientNamePlaceholder: '환자성함을 입력하세요 (선택사항)',
  patientNameRequired: false,
  additionalQuestions: [],
}

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  title: '퇴원환자 친절도 설문',
  description: '환자 만족도 조사를 위한 설문 시스템입니다. 참여를 통해 더 나은 서비스를 만들어주세요.',
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

const normalizePatientInfoConfig = (config: any): PatientInfoConfig => {
  const options = Array.isArray(config?.patientTypeOptions)
    ? config.patientTypeOptions
        .map((value: unknown) => (typeof value === 'string' ? value : '')?.trim())
        .filter((value: string) => value.length > 0)
    : []

  const additionalQuestions: PatientInfoQuestion[] = Array.isArray(config?.additionalQuestions)
    ? config.additionalQuestions
        .map((q: any, idx: number) => {
          if (!q || typeof q.text !== 'string' || !q.text.trim()) return null
          const questionOptions = Array.isArray(q.options)
            ? q.options
                .map((opt: unknown) => (typeof opt === 'string' ? opt : '')?.trim())
                .filter((opt: string) => opt.length > 0)
            : []
          if (questionOptions.length === 0) return null
          return {
            id: typeof q.id === 'string' && q.id.trim() ? q.id : `patient-info-q-${idx}-${Date.now()}`,
            text: q.text.trim(),
            options: questionOptions,
            required: typeof q.required === 'boolean' ? q.required : false,
          }
        })
        .filter((q: PatientInfoQuestion | null): q is PatientInfoQuestion => q !== null)
    : []

  return {
    patientTypeLabel:
      typeof config?.patientTypeLabel === 'string' && config.patientTypeLabel.trim().length > 0
        ? config.patientTypeLabel
        : DEFAULT_PATIENT_INFO_CONFIG.patientTypeLabel,
    patientTypePlaceholder:
      typeof config?.patientTypePlaceholder === 'string' && config.patientTypePlaceholder.trim().length > 0
        ? config.patientTypePlaceholder
        : DEFAULT_PATIENT_INFO_CONFIG.patientTypePlaceholder,
    patientTypeOptions: options.length > 0 ? options : [...DEFAULT_PATIENT_INFO_CONFIG.patientTypeOptions],
    patientTypeRequired:
      typeof config?.patientTypeRequired === 'boolean'
        ? config.patientTypeRequired
        : DEFAULT_PATIENT_INFO_CONFIG.patientTypeRequired,
    patientTypeTextColor:
      typeof config?.patientTypeTextColor === 'string' && config.patientTypeTextColor.trim().length > 0
        ? config.patientTypeTextColor
        : DEFAULT_PATIENT_INFO_CONFIG.patientTypeTextColor,
    patientNameLabel:
      typeof config?.patientNameLabel === 'string' && config.patientNameLabel.trim().length > 0
        ? config.patientNameLabel
        : DEFAULT_PATIENT_INFO_CONFIG.patientNameLabel,
    patientNamePlaceholder:
      typeof config?.patientNamePlaceholder === 'string' && config.patientNamePlaceholder.trim().length > 0
        ? config.patientNamePlaceholder
        : DEFAULT_PATIENT_INFO_CONFIG.patientNamePlaceholder,
    patientNameRequired:
      typeof config?.patientNameRequired === 'boolean'
        ? config.patientNameRequired
        : DEFAULT_PATIENT_INFO_CONFIG.patientNameRequired,
    additionalQuestions: additionalQuestions.length > 0 ? additionalQuestions : [],
  }
}

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
    patientInfoConfig: normalizePatientInfoConfig(survey?.patientInfoConfig),
  }
}

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
    patientInfoConfig: normalizePatientInfoConfig(record.patient_info_config),
  }
}

const mapResponseRecord = (record: any): Response => ({
  id: record.id,
  surveyId: record.survey_id,
  patientName: record.patient_name ?? undefined,
  patientType: record.patient_type ?? undefined,
  submittedAt: record.submitted_at ?? new Date().toISOString(),
  patientInfoAnswers:
    typeof record.patient_info_answers === 'object' && record.patient_info_answers !== null
      ? record.patient_info_answers
      : undefined,
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
  const supabase = getSupabaseServiceClient()
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
    const supabase = getSupabaseServiceClient()
    const questionGroups = survey.questionGroups ?? []
    const closingMessage = normalizeClosingMessage(survey.closingMessage)
    const patientInfoConfig = normalizePatientInfoConfig(survey.patientInfoConfig)

    const { data: insertedSurvey, error } = await supabase
      .from('surveys')
      .insert({
        title: survey.title,
        description: survey.description ?? null,
        background_color: survey.backgroundColor ?? null,
        closing_message: closingMessage,
        patient_info_config: patientInfoConfig,
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
    const supabase = getSupabaseServiceClient()
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
    return mapSurveyRecord({ ...data, patient_info: data.patient_info ?? null })
  },

  getAllSurveys: async (): Promise<Survey[]> => {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id,
        title,
        description,
        background_color,
        closing_message,
        patient_info,
        created_at,
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
      .order('created_at', { ascending: false })

    if (error || !data) return []
    return data.map(mapSurveyRecord)
  },

  updateSurvey: async (
    id: string,
    survey: Partial<Omit<Survey, 'id' | 'createdAt'>>
  ): Promise<Survey | undefined> => {
    const supabase = getSupabaseServiceClient()
    const payload: Record<string, any> = {}

    if (survey.title !== undefined) payload.title = survey.title
    if (survey.description !== undefined) payload.description = survey.description ?? null
    if (survey.backgroundColor !== undefined) payload.background_color = survey.backgroundColor ?? null

    if (survey.closingMessage !== undefined) {
      payload.closing_message = normalizeClosingMessage(survey.closingMessage)
    }

    if (survey.patientInfoConfig !== undefined) {
      payload.patient_info_config = normalizePatientInfoConfig(survey.patientInfoConfig)
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
    const supabase = getSupabaseServiceClient()
    const { data: insertedResponse, error } = await supabase
      .from('responses')
      .insert({
        survey_id: response.surveyId,
        patient_name: response.patientName ?? null,
        patient_type: response.patientType ?? null,
        patient_info_answers: response.patientInfoAnswers
          ? JSON.stringify(response.patientInfoAnswers)
          : null,
      })
      .select('id, survey_id, patient_name, patient_type, patient_info_answers, submitted_at')
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
      patient_info_answers:
        typeof insertedResponse.patient_info_answers === 'string'
          ? JSON.parse(insertedResponse.patient_info_answers)
          : insertedResponse.patient_info_answers,
      answers: (response.answers ?? []).map((answer) => ({
        question_id: answer.questionId,
        sub_question_id: answer.subQuestionId ?? null,
        value: typeof answer.value === 'number' ? answer.value : null,
        text_value: typeof answer.textValue === 'string' ? answer.textValue : null,
      })),
    })
  },

  getResponsesBySurvey: async (surveyId: string): Promise<Response[]> => {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('responses')
      .select(
        'id, survey_id, patient_name, patient_type, patient_info_answers, submitted_at, answers (id, question_id, sub_question_id, value, text_value)'
      )
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: true })

    if (error || !data) return []
    return data.map((record: any) =>
      mapResponseRecord({
        ...record,
        patient_info_answers:
          typeof record.patient_info_answers === 'string'
            ? JSON.parse(record.patient_info_answers)
            : record.patient_info_answers,
      })
    )
  },

  getAllResponses: async (): Promise<Response[]> => {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('responses')
      .select(
        'id, survey_id, patient_name, patient_type, patient_info_answers, submitted_at, answers (id, question_id, sub_question_id, value, text_value)'
      )
      .order('submitted_at', { ascending: true })

    if (error || !data) return []
    return data.map((record: any) =>
      mapResponseRecord({
        ...record,
        patient_info_answers:
          typeof record.patient_info_answers === 'string'
            ? JSON.parse(record.patient_info_answers)
            : record.patient_info_answers,
      })
    )
  },

  deleteResponsesBySurveyAndDateRange: async (
    surveyId: string,
    from?: string,
    to?: string
  ): Promise<number> => {
    const supabase = getSupabaseServiceClient()
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

  deleteSurvey: async (id: string): Promise<boolean> => {
    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  },

  getHomepageConfig: async (): Promise<HomepageConfig> => {
    const supabase = getSupabaseServiceClient()
    
    try {
      console.log('[DB] getHomepageConfig - Querying database for id="default"')
      
      const { data, error } = await supabase
        .from('homepage_config')
        .select('id, title, description, updated_at')
        .eq('id', 'default')
        .maybeSingle()

      console.log('[DB] getHomepageConfig - Query result:', { data, error })

      if (error) {
        console.error('[DB] ❌ getHomepageConfig - Error:', error)
        console.error('[DB] Error code:', error.code)
        console.error('[DB] Error message:', error.message)
        console.error('[DB] Error details:', error.details)
        console.error('[DB] Error hint:', error.hint)
        
        // 테이블이 없을 수 있으므로 기본값 반환
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[DB] ⚠️ homepage_config table does not exist, using default config')
          return { ...DEFAULT_HOMEPAGE_CONFIG }
        }
        // 다른 에러도 기본값 반환 (에러를 throw하지 않음)
        console.warn('[DB] ⚠️ Error occurred, returning default config')
        return { ...DEFAULT_HOMEPAGE_CONFIG }
      }

      if (!data) {
        console.log('[DB] ⚠️ No homepage config found in database (data is null), using default')
        return { ...DEFAULT_HOMEPAGE_CONFIG }
      }

      console.log('[DB] ✅ Raw data from DB:', JSON.stringify(data, null, 2))
      console.log('[DB] Data type:', typeof data)
      console.log('[DB] Data keys:', Object.keys(data))
      console.log('[DB] Title from DB:', data.title, '(type:', typeof data.title, ')')
      console.log('[DB] Description from DB:', data.description, '(type:', typeof data.description, ')')

      const result: HomepageConfig = {
        title:
          typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title.trim()
            : DEFAULT_HOMEPAGE_CONFIG.title,
        description:
          typeof data.description === 'string' && data.description.trim().length > 0
            ? data.description.trim()
            : DEFAULT_HOMEPAGE_CONFIG.description,
      }
      
      console.log('[DB] ✅ Normalized result:', JSON.stringify(result, null, 2))
      console.log('[DB] Final title:', result.title)
      console.log('[DB] Final description:', result.description)
      return result
    } catch (error) {
      console.error('[DB] Exception in getHomepageConfig:', error)
      if (error instanceof Error) {
        console.error('[DB] Exception message:', error.message)
        console.error('[DB] Exception stack:', error.stack)
      }
      // 에러가 발생하면 기본값 반환
      return { ...DEFAULT_HOMEPAGE_CONFIG }
    }
  },

  updateHomepageConfig: async (config: HomepageConfig): Promise<HomepageConfig> => {
    const supabase = getSupabaseServiceClient()
    const title = typeof config.title === 'string' && config.title.trim().length > 0
      ? config.title.trim()
      : DEFAULT_HOMEPAGE_CONFIG.title
    const description = typeof config.description === 'string' && config.description.trim().length > 0
      ? config.description.trim()
      : DEFAULT_HOMEPAGE_CONFIG.description

    console.log('db.updateHomepageConfig - Attempting to upsert:', { id: 'default', title, description })

    try {
      const { data, error: upsertError } = await supabase
        .from('homepage_config')
        .upsert(
          {
            id: 'default',
            title,
            description,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        )
        .select('title, description')
        .single()

      if (upsertError) {
        console.error('Supabase upsert error:', upsertError)
        throw new Error(`Database error: ${upsertError.message} (code: ${upsertError.code})`)
      }

      if (!data) {
        console.error('No data returned from upsert')
        throw new Error('No data returned from database')
      }

      console.log('db.updateHomepageConfig - Success:', data)
      return {
        title: data.title,
        description: data.description,
      }
    } catch (error) {
      console.error('db.updateHomepageConfig - Exception:', error)
      throw error
    }
  },
}

