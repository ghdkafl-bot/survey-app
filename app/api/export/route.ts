import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

const sanitizeSheetName = (name: string) => {
  const cleaned = name.replace(/[\/:*?\[\]]/g, '_')
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'Sheet'
}

const isWithinRange = (dateString: string, from?: string | null, to?: string | null) => {
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

export async function GET(request: NextRequest) {
  try {
    const surveyId = request.nextUrl.searchParams.get('surveyId')
    
    if (!surveyId) {
      return NextResponse.json(
        { error: 'Survey ID is required' },
        { status: 400 }
      )
    }

    const survey = await db.getSurvey(surveyId)
    if (!survey) {
      return NextResponse.json(
        { error: 'Survey not found' },
        { status: 404 }
      )
    }

    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    const allResponses = await db.getResponsesBySurvey(surveyId)
    const responses = allResponses.filter((response) =>
      !from && !to ? true : isWithinRange(response.submittedAt, from, to)
    )

    const headers: string[] = ['제출일시', '환자 성함', '환자 유형']
    const questionDescriptors: { questionId: string; subQuestionId?: string; isText: boolean }[] = []

    survey.questionGroups.forEach((group) => {
      group.questions.forEach((question) => {
        if (question.type === 'text') {
          headers.push(`${group.title} - ${question.text} (주관식)`)
          questionDescriptors.push({ questionId: question.id, isText: true })
        } else {
          if (question.subQuestions.length > 0) {
            question.subQuestions.forEach((sub) => {
              headers.push(`${group.title} - ${question.text} (${sub.text})`)
              questionDescriptors.push({ questionId: question.id, subQuestionId: sub.id, isText: false })
            })
          } else {
            headers.push(`${group.title} - ${question.text}`)
            questionDescriptors.push({ questionId: question.id, isText: false })
          }
        }
      })
    })

    const grouped = new Map<string, typeof responses>()
    responses.forEach((response) => {
      const typeKey = response.patientType || '미입력'
      if (!grouped.has(typeKey)) {
        grouped.set(typeKey, [])
      }
      grouped.get(typeKey)!.push(response)
    })

    const wb = XLSX.utils.book_new()

    if (grouped.size === 0) {
      const ws = XLSX.utils.aoa_to_sheet([headers])
      ws['!cols'] = headers.map(() => ({ wch: 30 }))
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName('응답없음'))
    } else {
      grouped.forEach((groupResponses, typeKey) => {
        const excelData: any[] = [headers]

        groupResponses.forEach((response) => {
          const row: any[] = [
            response.submittedAt,
            response.patientName || '',
            response.patientType || '',
          ]

          questionDescriptors.forEach(({ questionId, subQuestionId, isText }) => {
            const answer = response.answers.find((a) =>
              a.questionId === questionId && (subQuestionId ? a.subQuestionId === subQuestionId : !a.subQuestionId)
            )
            if (!answer) {
              row.push('')
            } else if (isText) {
              row.push(answer.textValue || '')
            } else {
              row.push(typeof answer.value === 'number' ? answer.value : '')
            }
          })

          excelData.push(row)
        })

        const ws = XLSX.utils.aoa_to_sheet(excelData)
        const colWidths = headers.map(() => ({ wch: 30 }))
        colWidths[0] = { wch: 20 }
        colWidths[1] = { wch: 15 }
        colWidths[2] = { wch: 15 }
        ws['!cols'] = colWidths
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(typeKey))
      })
    }

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="survey-${surveyId}-${Date.now()}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

