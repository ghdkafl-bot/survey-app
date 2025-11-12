import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const surveyId = resolvedParams.id
    const survey = await db.getSurvey(surveyId)
    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(survey)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch survey' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const surveyId = resolvedParams.id
    
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }
    
    const body = await request.json()
    const { title, description, backgroundColor, questionGroups, closingMessage } = body

    if (!title || !questionGroups || questionGroups.length === 0) {
      return NextResponse.json(
        { error: 'Title and question groups are required' },
        { status: 400 }
      )
    }

    const updatedSurvey = await db.updateSurvey(surveyId, {
      title,
      description,
      backgroundColor,
      questionGroups: questionGroups.map((group: { id?: string; title: string; order?: number; questions: any[] }, groupIdx: number) => ({
        id: group.id,
        surveyId,
        title: group.title,
        order: group.order ?? groupIdx,
        questions: (group.questions || []).map((q: any, qIdx: number) => ({
          id: q.id,
          groupId: group.id,
          text: q.text,
          order: q.order ?? qIdx,
          type: q.type === 'text' ? 'text' : 'scale',
          includeNoneOption: q.type === 'scale' ? Boolean(q.includeNoneOption) : undefined,
          subQuestions: Array.isArray(q.subQuestions)
            ? q.subQuestions.slice(0, 5).map((sub: any, subIdx: number) => ({
                id: sub.id,
                questionId: q.id,
                text: sub.text,
                order: sub.order ?? subIdx,
              }))
            : [],
        })),
      })),
      closingMessage,
    })

    if (!updatedSurvey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(updatedSurvey)
  } catch (error) {
    console.error('Update survey error:', error)
    return NextResponse.json(
      { error: 'Failed to update survey', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const surveyId = resolvedParams.id

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }

    await db.deleteSurvey(surveyId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete survey error:', error)
    return NextResponse.json(
      { error: 'Failed to delete survey', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

