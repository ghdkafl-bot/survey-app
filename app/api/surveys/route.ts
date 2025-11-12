import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSupabaseServiceClient } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('surveys')
      .select(`
        id,
        title,
        description,
        background_color,
        closing_message,
        patient_info_config,
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

    if (error || !data) {
      console.error('Failed to fetch surveys:', error)
      return NextResponse.json([], { status: 200 })
    }

    const normalized = data
      .map((record: any) => {
        try {
          return db.getSurvey(record.id)
        } catch (err) {
          console.error('Normalization error:', err)
          return undefined
        }
      })

    const resolved = await Promise.all(normalized)
    const filtered = resolved.filter(
      (survey): survey is NonNullable<typeof survey> =>
        Boolean(survey && survey.questionGroups && survey.questionGroups.length > 0)
    )

    return NextResponse.json(filtered)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch surveys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, backgroundColor, questionGroups, closingMessage, patientInfoConfig } = body

    if (!title || !questionGroups || questionGroups.length === 0) {
      return NextResponse.json(
        { error: 'Title and question groups are required' },
        { status: 400 }
      )
    }

    const survey = await db.createSurvey({
      title,
      description,
      backgroundColor,
      questionGroups: questionGroups.map((group: { id?: string; title: string; order?: number; questions: any[] }, groupIdx: number) => ({
        id: group.id,
        surveyId: '',
        title: group.title,
        order: group.order ?? groupIdx,
        questions: (group.questions || []).map((q: any, qIdx: number) => ({
          id: q.id,
          groupId: '',
          text: q.text,
          order: q.order ?? qIdx,
          type: q.type === 'text' ? 'text' : 'scale',
          includeNoneOption: q.type === 'scale' ? Boolean(q.includeNoneOption) : undefined,
          subQuestions: Array.isArray(q.subQuestions)
            ? q.subQuestions.slice(0, 5).map((sub: any, subIdx: number) => ({
                id: sub.id,
                questionId: '',
                text: sub.text,
                order: sub.order ?? subIdx,
              }))
            : [],
        })),
      })),
      closingMessage,
      patientInfoConfig,
    })

    return NextResponse.json(survey, { status: 201 })
  } catch (error) {
    console.error('Create survey error:', error)
    return NextResponse.json(
      { error: 'Failed to create survey' },
      { status: 500 }
    )
  }
}

