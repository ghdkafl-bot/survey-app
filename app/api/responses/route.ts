import { NextRequest, NextResponse } from 'next/server'
import { db, Answer } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const surveyId = request.nextUrl.searchParams.get('surveyId')
    
    if (surveyId) {
      const responses = await db.getResponsesBySurvey(surveyId)
      return NextResponse.json(responses)
    }
    
    const allResponses = await db.getAllResponses()
    return NextResponse.json(allResponses)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch responses' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { surveyId, from, to } = body || {}

    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }

    const deletedCount = await db.deleteResponsesBySurveyAndDateRange(surveyId, from, to)

    return NextResponse.json({ deletedCount }, { status: 200 })
  } catch (error) {
    console.error('Failed to delete responses:', error)
    return NextResponse.json(
      { error: 'Failed to delete responses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surveyId, answers, patientName, patientType, patientInfoAnswers } = body

    if (!surveyId || !answers) {
      return NextResponse.json(
        { error: 'Survey ID and answers are required' },
        { status: 400 }
      )
    }

    const normalizedAnswers: Answer[] = Array.isArray(answers)
      ? answers.map((ans: any) => ({
          questionId: ans?.questionId,
          subQuestionId: ans?.subQuestionId,
          value: typeof ans?.value === 'number' ? ans.value : ans?.value === null ? null : undefined,
          textValue: typeof ans?.textValue === 'string' ? ans.textValue : undefined,
        }))
      : []

    const response = await db.createResponse({
      surveyId,
      answers: normalizedAnswers,
      patientName,
      patientType,
      patientInfoAnswers:
        typeof patientInfoAnswers === 'object' && patientInfoAnswers !== null
          ? patientInfoAnswers
          : undefined,
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create response' },
      { status: 500 }
    )
  }
}

