import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSupabaseServiceClient } from '@/lib/supabaseClient'
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

    // 답변 데이터에서 실제 질문 ID를 수집
    const allAnswerQuestionIds = new Set<string>()
    const allAnswerSubQuestionIds = new Set<string>()
    responses.forEach((response) => {
      response.answers?.forEach((answer) => {
        if (answer.questionId) {
          allAnswerQuestionIds.add(answer.questionId)
        }
        if (answer.subQuestionId) {
          allAnswerSubQuestionIds.add(answer.subQuestionId)
        }
      })
    })
    
    console.log(`[Export] Unique question IDs in answers:`, Array.from(allAnswerQuestionIds))
    console.log(`[Export] Unique sub-question IDs in answers:`, Array.from(allAnswerSubQuestionIds))

    // 설문의 질문 ID 목록 로깅
    const surveyQuestionIds: string[] = []
    survey.questionGroups.forEach((group) => {
      group.questions.forEach((question) => {
        surveyQuestionIds.push(question.id)
        if (question.subQuestions.length > 0) {
          question.subQuestions.forEach((sub) => {
            surveyQuestionIds.push(`${question.id}-${sub.id}`)
          })
        }
      })
    })
    console.log(`[Export] Survey question IDs:`, surveyQuestionIds)

    // 응답의 답변 ID 목록 로깅
    if (responses.length > 0) {
      const responseAnswerIds: string[] = []
      responses[0].answers?.forEach((answer) => {
        const key = answer.subQuestionId 
          ? `${answer.questionId}-${answer.subQuestionId}` 
          : answer.questionId
        responseAnswerIds.push(key)
      })
      console.log(`[Export] First response answer IDs:`, responseAnswerIds)
      console.log(`[Export] First response answers detail:`, JSON.stringify(responses[0].answers, null, 2))
    }

    // 데이터베이스에서 답변의 질문 ID로 직접 질문 정보 조회
    const questionIdToQuestionMap = new Map<string, {
      text: string;
      type: string;
      groupTitle: string;
      order: number;
      subQuestions: Map<string, { text: string; order: number }>;
    }>()
    
    if (allAnswerQuestionIds.size > 0) {
      try {
        const supabase = getSupabaseServiceClient()
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select(`
            id,
            text,
            type,
            "order",
            question_groups!inner (
              title,
              "order",
              survey_id
            ),
            sub_questions (
              id,
              text,
              "order"
            )
          `)
          .in('id', Array.from(allAnswerQuestionIds))
          .eq('question_groups.survey_id', surveyId)
        
        if (!questionsError && questionsData) {
          questionsData.forEach((q: any) => {
            const group = Array.isArray(q.question_groups) ? q.question_groups[0] : q.question_groups
            const subQuestionsMap = new Map<string, { text: string; order: number }>()
            
            if (Array.isArray(q.sub_questions)) {
              q.sub_questions.forEach((sub: any) => {
                subQuestionsMap.set(sub.id, { text: sub.text, order: sub.order || 0 })
              })
            }
            
            questionIdToQuestionMap.set(q.id, {
              text: q.text,
              type: q.type,
              groupTitle: group?.title || '',
              order: (group?.order || 0) * 1000 + (q.order || 0),
              subQuestions: subQuestionsMap,
            })
          })
          
          console.log(`[Export] Loaded ${questionIdToQuestionMap.size} questions from database`)
        } else {
          console.warn(`[Export] Failed to load questions from database:`, questionsError)
        }
      } catch (error) {
        console.error(`[Export] Error loading questions:`, error)
      }
    }
    
    // 답변 데이터에서 실제로 사용된 모든 질문/하위질문 조합 수집
    const answerKeyToDescriptor = new Map<string, { 
      questionId: string; 
      subQuestionId?: string; 
      questionText: string;
      subQuestionText?: string;
      groupTitle: string;
      isText: boolean;
      order: number;
    }>()
    
    // 실제 답변 데이터를 기준으로 descriptor 생성
    responses.forEach((response) => {
      response.answers?.forEach((answer) => {
        const key = answer.subQuestionId 
          ? `${answer.questionId}:${answer.subQuestionId}`
          : `${answer.questionId}`
        
        if (!answerKeyToDescriptor.has(key)) {
          const questionInfo = questionIdToQuestionMap.get(answer.questionId)
          
          if (questionInfo) {
            // 데이터베이스에서 질문 정보를 찾은 경우
            const subQuestionInfo = answer.subQuestionId 
              ? questionInfo.subQuestions.get(answer.subQuestionId)
              : null
              
            answerKeyToDescriptor.set(key, {
              questionId: answer.questionId,
              subQuestionId: answer.subQuestionId,
              questionText: questionInfo.text,
              subQuestionText: subQuestionInfo?.text,
              groupTitle: questionInfo.groupTitle,
              isText: questionInfo.type === 'text',
              order: questionInfo.order + (subQuestionInfo?.order || 0),
            })
          } else {
            // 데이터베이스에서 질문 정보를 찾지 못한 경우 (설문이 수정되어 삭제된 질문)
            answerKeyToDescriptor.set(key, {
              questionId: answer.questionId,
              subQuestionId: answer.subQuestionId,
              questionText: `[삭제된 질문] ID: ${answer.questionId}`,
              subQuestionText: answer.subQuestionId ? `[삭제된 하위질문] ID: ${answer.subQuestionId}` : undefined,
              groupTitle: '삭제된 질문',
              isText: answer.textValue !== undefined,
              order: 999999,
            })
          }
        }
      })
    })
    
    // order 기준으로 정렬
    const sortedDescriptors = Array.from(answerKeyToDescriptor.values())
      .sort((a, b) => a.order - b.order)
    
    console.log(`[Export] Total descriptors: ${sortedDescriptors.length}`)
    console.log(`[Export] Descriptors:`, sortedDescriptors.map(d => ({
      questionId: d.questionId,
      subQuestionId: d.subQuestionId,
      questionText: d.questionText,
      groupTitle: d.groupTitle,
    })))

    // Excel 헤더 생성
    const headers: string[] = ['제출일시', '환자 성함', '환자 유형']
    sortedDescriptors.forEach((desc) => {
      if (desc.isText) {
        headers.push(`${desc.groupTitle} - ${desc.questionText} (주관식)`)
      } else {
        if (desc.subQuestionText) {
          headers.push(`${desc.groupTitle} - ${desc.questionText} (${desc.subQuestionText})`)
        } else {
          headers.push(`${desc.groupTitle} - ${desc.questionText}`)
        }
      }
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

        groupResponses.forEach((response, responseIndex) => {
          const row: any[] = [
            response.submittedAt,
            response.patientName || '',
            response.patientType || '',
          ]

          if (responseIndex === 0) {
            console.log(`[Export] Processing first response in sheet "${typeKey}":`, {
              responseId: response.id,
              answersCount: response.answers?.length || 0,
              answers: response.answers?.map(a => ({
                questionId: a.questionId,
                subQuestionId: a.subQuestionId,
                value: a.value,
                textValue: a.textValue,
              })),
            })
          }

          sortedDescriptors.forEach((desc, descIndex) => {
            // 답변 찾기: questionId와 subQuestionId로 정확히 매칭
            const answer = response.answers?.find((a) => {
              const questionMatch = a.questionId === desc.questionId
              if (desc.subQuestionId) {
                return questionMatch && a.subQuestionId === desc.subQuestionId
              } else {
                return questionMatch && !a.subQuestionId
              }
            })

            if (responseIndex === 0 && descIndex < 3) {
              console.log(`[Export] Descriptor ${descIndex}:`, {
                questionId: desc.questionId,
                subQuestionId: desc.subQuestionId,
                isText: desc.isText,
                foundAnswer: answer ? {
                  questionId: answer.questionId,
                  subQuestionId: answer.subQuestionId,
                  value: answer.value,
                  textValue: answer.textValue,
                } : null,
                allAnswers: response.answers?.map(a => ({
                  questionId: a.questionId,
                  subQuestionId: a.subQuestionId,
                })),
              })
            }

            if (!answer) {
              row.push('')
            } else if (desc.isText) {
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

