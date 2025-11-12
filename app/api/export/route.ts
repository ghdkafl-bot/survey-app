import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

const sanitizeSheetName = (name: string) => {
  const cleaned = name.replace(/[\/:*?\[\]]/g, '_')
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned || 'Sheet'
}

const isWithinRange = (dateString: string, from?: string | null, to?: string | null) => {
  if (!from && !to) return true
  
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    console.warn(`Invalid date string: ${dateString}`)
    return false
  }
  
  // 날짜만 비교 (시간 무시)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (from) {
    const fromDate = new Date(from)
    if (!Number.isNaN(fromDate.getTime())) {
      const fromOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate())
      if (dateOnly < fromOnly) return false
    }
  }
  
  if (to) {
    const toDate = new Date(to)
    if (!Number.isNaN(toDate.getTime())) {
      // 'to' 날짜의 끝 시간까지 포함 (23:59:59.999)
      const toOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
      if (date > toOnly) return false
    }
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

    console.log(`[Export] Fetching responses for survey ${surveyId}, from: ${from}, to: ${to}`)
    
    const allResponses = await db.getResponsesBySurvey(surveyId)
    console.log(`[Export] Total responses fetched: ${allResponses.length}`)
    
    if (allResponses.length > 0) {
      console.log(`[Export] Sample response:`, {
        id: allResponses[0].id,
        submittedAt: allResponses[0].submittedAt,
        answersCount: allResponses[0].answers?.length || 0,
        patientName: allResponses[0].patientName,
        patientType: allResponses[0].patientType,
      })
    }
    
    const responses = allResponses.filter((response) =>
      !from && !to ? true : isWithinRange(response.submittedAt, from, to)
    )
    
    console.log(`[Export] Filtered responses: ${responses.length}`)

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
            const answer = response.answers?.find((a) =>
              a.questionId === questionId && (subQuestionId ? a.subQuestionId === subQuestionId : !a.subQuestionId)
            )
            if (!answer) {
              row.push('')
            } else if (isText) {
              row.push(answer.textValue || '')
            } else {
              // null 값도 처리 (해당없음 옵션)
              if (answer.value === null) {
                row.push('해당없음')
              } else {
                row.push(typeof answer.value === 'number' ? answer.value : '')
              }
            }
          })

          excelData.push(row)
        })
        
        console.log(`[Export] Sheet "${typeKey}": ${excelData.length - 1} rows (${excelData.length - 1} responses + 1 header)`)

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

