import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const surveys = await db.getAllSurveys()
    return NextResponse.json(surveys)
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
    const { title, description, backgroundColor, questionGroups, closingMessage } = body

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
      questionGroups: questionGroups.map((group: { title: string; order?: number; questions: any[] }, groupIdx: number) => ({
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

