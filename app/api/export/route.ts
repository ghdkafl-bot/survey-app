import { NextRequest, NextResponse } from 'next/server'
import { db, Answer } from '@/lib/db'
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
    const timestamp = request.nextUrl.searchParams.get('_t') || Date.now().toString()

    console.log(`[Export] 🔄 Fetching responses for survey ${surveyId}, from: ${from}, to: ${to}`)
    console.log(`[Export] Request timestamp: ${timestamp}`)
    console.log(`[Export] Request URL: ${request.url}`)
    console.log(`[Export] Current server time: ${new Date().toISOString()}`)
    
    // 실시간 데이터를 보장하기 위해 최신 데이터 조회
    // 약간의 지연을 추가하여 최신 데이터가 완전히 저장되도록 보장
    const fetchStartTime = Date.now()
    console.log(`[Export] Starting data fetch at ${new Date(fetchStartTime).toISOString()}`)
    
    // 최신 데이터가 완전히 저장되도록 약간의 지연 추가 (1초로 증가)
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 최신 데이터를 확실히 가져오기 위해 여러 번 조회하고 최대값 사용
    let allResponses: any[] = []
    let maxCount = 0
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Export] 🔄 Attempt ${attempt}: Calling getResponsesBySurvey at ${new Date().toISOString()}`)
      const responses = await db.getResponsesBySurvey(surveyId)
      console.log(`[Export] 🔍 Attempt ${attempt} returned ${responses.length} responses`)
      
      if (responses.length > maxCount) {
        maxCount = responses.length
        allResponses = responses
        console.log(`[Export] ✅ Updated to ${maxCount} responses (attempt ${attempt})`)
      }
      
      // 마지막 시도가 아니면 잠시 대기
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`[Export] ✅ Final: Using ${allResponses.length} responses (after ${3} attempts)`)
    
    console.log(`[Export] 🔍 Verification: Fetched ${allResponses.length} responses`)
    if (allResponses.length > 0) {
      const latestResponse = allResponses[0]
      const allDates = allResponses.map(r => r.submittedAt).sort()
      const latestDate = allDates[allDates.length - 1]
      console.log(`[Export] 🔍 Latest response in fetched data:`, {
        id: latestResponse.id,
        submittedAt: latestResponse.submittedAt,
        patientName: latestResponse.patientName,
        patientType: latestResponse.patientType,
      })
      console.log(`[Export] 🔍 All response dates:`, {
        total: allDates.length,
        latest: latestDate,
        oldest: allDates[0],
        recent5: allDates.slice(-5),
      })
    } else {
      console.warn(`[Export] ⚠️ No responses fetched from getResponsesBySurvey!`)
    }
    
    const fetchEndTime = Date.now()
    console.log(`[Export] ✅ Data fetch completed in ${fetchEndTime - fetchStartTime}ms`)
    console.log(`[Export] Total responses fetched: ${allResponses.length}`)
    
    if (allResponses.length === 0) {
      console.warn(`[Export] ⚠️ No responses found for survey ${surveyId}`)
    }
    
    // 최신 응답 확인
    if (allResponses.length > 0) {
      const latestResponse = allResponses[0]
      const oldestResponse = allResponses[allResponses.length - 1]
      console.log(`[Export] Latest response in fetched data:`, {
        id: latestResponse.id,
        submittedAt: latestResponse.submittedAt,
        patientName: latestResponse.patientName,
        patientType: latestResponse.patientType,
        answersCount: latestResponse.answers?.length || 0,
      })
      console.log(`[Export] Oldest response in fetched data:`, {
        id: oldestResponse.id,
        submittedAt: oldestResponse.submittedAt,
        patientName: oldestResponse.patientName,
        patientType: oldestResponse.patientType,
        answersCount: oldestResponse.answers?.length || 0,
      })
      
      // 모든 응답의 날짜 목록
      const allDates = allResponses.map(r => r.submittedAt).sort()
      console.log(`[Export] All response dates (${allDates.length} total):`, {
        first: allDates[0],
        last: allDates[allDates.length - 1],
        uniqueCount: new Set(allDates).size,
        recent5: allDates.slice(-5), // 최근 5개
      })
    }
    
    // responses 테이블에서 question_snapshot도 함께 조회
    const supabase = getSupabaseServiceClient()
    const { data: responsesWithSnapshot, error: snapshotError } = await supabase
      .from('responses')
      .select('id, question_snapshot')
      .eq('survey_id', surveyId)
    
    const questionSnapshotMap = new Map<string, any>()
    if (!snapshotError && responsesWithSnapshot) {
      responsesWithSnapshot.forEach((r: any) => {
        if (r.question_snapshot) {
          questionSnapshotMap.set(r.id, r.question_snapshot)
        }
      })
      console.log(`[Export] Loaded question snapshots for ${questionSnapshotMap.size} responses`)
    }
    
    if (allResponses.length > 0) {
      console.log(`[Export] Sample response:`, {
        id: allResponses[0].id,
        submittedAt: allResponses[0].submittedAt,
        answersCount: allResponses[0].answers?.length || 0,
        patientName: allResponses[0].patientName,
        patientType: allResponses[0].patientType,
        hasSnapshot: questionSnapshotMap.has(allResponses[0].id),
      })
    }
    
    // 날짜 필터링 적용
    const responses = allResponses.filter((response) =>
      !from && !to ? true : isWithinRange(response.submittedAt, from, to)
    )
    
    console.log(`[Export] Filtered responses: ${responses.length} out of ${allResponses.length}`)
    
    // 필터링 후 최신 응답 확인
    if (responses.length > 0) {
      const filteredDates = responses.map(r => r.submittedAt).sort()
      const filteredLatestDate = filteredDates[filteredDates.length - 1]
      const filteredOldestDate = filteredDates[0]
      console.log(`[Export] ⚠️ FILTERED - Latest response date: ${filteredLatestDate}`)
      console.log(`[Export] ⚠️ FILTERED - Oldest response date: ${filteredOldestDate}`)
      console.log(`[Export] ⚠️ FILTERED - Date range: ${filteredOldestDate} ~ ${filteredLatestDate}`)
      
      // 필터링 전과 비교
      if (allResponses.length > 0) {
        const allDates = allResponses.map(r => r.submittedAt).sort()
        const allLatestDate = allDates[allDates.length - 1]
        console.log(`[Export] ⚠️ BEFORE FILTER - Latest response date: ${allLatestDate}`)
        
        if (filteredLatestDate !== allLatestDate) {
          console.warn(`[Export] ⚠️⚠️⚠️ WARNING: Latest response was filtered out!`)
          console.warn(`[Export]   - Before filter: ${allLatestDate}`)
          console.warn(`[Export]   - After filter: ${filteredLatestDate}`)
          console.warn(`[Export]   - Filter criteria: from=${from || 'none'}, to=${to || 'none'}`)
        }
      }
    } else if (allResponses.length > 0) {
      console.error(`[Export] ❌ ERROR: All responses were filtered out!`)
      console.error(`[Export]   - Total responses before filter: ${allResponses.length}`)
      console.error(`[Export]   - Filter criteria: from=${from || 'none'}, to=${to || 'none'}`)
      const allDates = allResponses.map(r => r.submittedAt).sort()
      console.error(`[Export]   - Date range in DB: ${allDates[0]} ~ ${allDates[allDates.length - 1]}`)
    }
    
    // 필터링 후 최신 응답 확인
    if (responses.length > 0) {
      const filteredLatest = responses[0] // 최신 응답
      const filteredOldest = responses[responses.length - 1] // 가장 오래된 응답
      console.log(`[Export] Filtered - Latest response:`, {
        id: filteredLatest.id,
        submittedAt: filteredLatest.submittedAt,
        patientName: filteredLatest.patientName,
        patientType: filteredLatest.patientType,
      })
      console.log(`[Export] Filtered - Oldest response:`, {
        id: filteredOldest.id,
        submittedAt: filteredOldest.submittedAt,
        patientName: filteredOldest.patientName,
        patientType: filteredOldest.patientType,
      })
      
      // 필터링된 응답의 날짜 목록
      const filteredDates = responses.map(r => r.submittedAt).sort()
      console.log(`[Export] Filtered response dates:`, {
        first: filteredDates[0],
        last: filteredDates[filteredDates.length - 1],
        uniqueCount: new Set(filteredDates).size,
        recent5: filteredDates.slice(-5), // 최근 5개
      })
    } else {
      console.warn(`[Export] ⚠️ No responses after filtering!`)
      console.warn(`[Export] Filter criteria: from=${from}, to=${to}`)
      console.warn(`[Export] All responses count: ${allResponses.length}`)
      if (allResponses.length > 0) {
        console.warn(`[Export] All responses date range:`, {
          latest: allResponses[0].submittedAt,
          oldest: allResponses[allResponses.length - 1].submittedAt,
        })
      }
    }
    
    // 필터링된 응답의 환자 유형 분포 확인
    const filteredPatientTypes = new Map<string, number>()
    responses.forEach((response) => {
      const type = response.patientType || 'null'
      filteredPatientTypes.set(type, (filteredPatientTypes.get(type) || 0) + 1)
    })
    console.log(`[Export] Filtered responses by patient type:`, Array.from(filteredPatientTypes.entries()))
    
    // "종합검진" 환자 유형이 있는지 확인
    const 종합검진Responses = responses.filter(r => {
      const type = r.patientType || ''
      return type === '종합검진' || type.trim() === '종합검진'
    })
    console.log(`[Export] 종합검진 responses count: ${종합검진Responses.length}`)
    if (종합검진Responses.length > 0) {
      console.log(`[Export] First 종합검진 response:`, {
        id: 종합검진Responses[0].id,
        patientType: 종합검진Responses[0].patientType,
        submittedAt: 종합검진Responses[0].submittedAt,
        answersCount: 종합검진Responses[0].answers?.length || 0,
        answers: 종합검진Responses[0].answers?.slice(0, 3),
      })
    }

    // 답변 데이터에서 실제 질문 ID를 수집
    const allAnswerQuestionIds = new Set<string>()
    const allAnswerSubQuestionIds = new Set<string>()
    responses.forEach((response) => {
      response.answers?.forEach((answer: Answer) => {
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
    // survey_id 필터를 제거하여 설문이 수정되어도 기존 질문 정보를 찾을 수 있도록 함
    const questionIdToQuestionMap = new Map<string, {
      text: string;
      type: string;
      groupTitle: string;
      order: number;
      subQuestions: Map<string, { text: string; order: number }>;
    }>()
    
    if (allAnswerQuestionIds.size > 0) {
      try {
        // 먼저 현재 설문의 질문 정보를 조회 (현재 설문 구조)
        const { data: currentQuestionsData, error: currentQuestionsError } = await supabase
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
        
        if (!currentQuestionsError && currentQuestionsData) {
          currentQuestionsData.forEach((q: any) => {
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
          
          console.log(`[Export] Loaded ${questionIdToQuestionMap.size} questions from current survey`)
        }
        
        // 현재 설문에서 찾지 못한 질문 ID들
        const missingQuestionIds = Array.from(allAnswerQuestionIds).filter(
          (id) => !questionIdToQuestionMap.has(id)
        )
        
        if (missingQuestionIds.length > 0) {
          console.log(`[Export] Trying to find ${missingQuestionIds.length} missing questions from question snapshots`)
          
          // 응답의 question_snapshot에서 질문 정보 찾기
          responses.forEach((response) => {
            const snapshot = questionSnapshotMap.get(response.id)
            if (snapshot && Array.isArray(snapshot)) {
              snapshot.forEach((group: any) => {
                if (Array.isArray(group.questions)) {
                  group.questions.forEach((q: any) => {
                    if (missingQuestionIds.includes(q.id) && !questionIdToQuestionMap.has(q.id)) {
                      const subQuestionsMap = new Map<string, { text: string; order: number }>()
                      if (Array.isArray(q.subQuestions)) {
                        q.subQuestions.forEach((sub: any) => {
                          subQuestionsMap.set(sub.id, { text: sub.text, order: sub.order || 0 })
                        })
                      }
                      
                      questionIdToQuestionMap.set(q.id, {
                        text: q.text,
                        type: q.type,
                        groupTitle: group.title || '',
                        order: (group.order || 0) * 1000 + (q.order || 0),
                        subQuestions: subQuestionsMap,
                      })
                    }
                  })
                }
              })
            }
          })
          
          // 여전히 찾지 못한 질문 ID들
          const stillMissingQuestionIds = Array.from(allAnswerQuestionIds).filter(
            (id) => !questionIdToQuestionMap.has(id)
          )
          
          if (stillMissingQuestionIds.length > 0) {
            console.log(`[Export] Trying to find ${stillMissingQuestionIds.length} missing questions from all surveys`)
            
            // survey_id 필터 없이 질문 정보 조회 (설문이 수정되어 삭제된 질문도 찾기)
            const { data: allQuestionsData, error: allQuestionsError } = await supabase
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
              .in('id', stillMissingQuestionIds)
          
            if (!allQuestionsError && allQuestionsData) {
              allQuestionsData.forEach((q: any) => {
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
              
              console.log(`[Export] Loaded ${allQuestionsData.length} additional questions from all surveys`)
            } else {
              console.warn(`[Export] Failed to load questions from all surveys:`, allQuestionsError)
            }
          }
        }
        
        console.log(`[Export] Total loaded questions: ${questionIdToQuestionMap.size} out of ${allAnswerQuestionIds.size}`)
      } catch (error) {
        console.error(`[Export] Error loading questions:`, error)
      }
    }
    
    // 현재 설문 구조를 기준으로 Excel 헤더 생성
    // 설문 구조와 답변 데이터를 모두 고려하여 descriptor 생성
    const answerKeyToDescriptor = new Map<string, { 
      questionId: string; 
      subQuestionId?: string; 
      questionText: string;
      subQuestionText?: string;
      groupTitle: string;
      isText: boolean;
      order: number;
    }>()
    
    // 1단계: 현재 설문 구조를 기준으로 descriptor 생성 (설문이 수정되지 않은 경우)
    // 모든 질문을 Excel에 포함 (답변이 없어도 질문은 표시)
    console.log(`[Export] Creating descriptors from survey structure: ${survey.questionGroups.length} groups`)
    survey.questionGroups.forEach((group, groupIdx) => {
      console.log(`[Export] Processing group ${groupIdx}: ${group.title}, ${group.questions.length} questions`)
      group.questions.forEach((question, questionIdx) => {
        if (question.type === 'text') {
          const key = `${question.id}`
          answerKeyToDescriptor.set(key, {
            questionId: question.id,
            questionText: question.text,
            groupTitle: group.title,
            isText: true,
            order: groupIdx * 1000 + questionIdx * 10,
          })
          console.log(`[Export] Added text question descriptor: ${group.title} - ${question.text}`)
        } else {
          if (question.subQuestions.length > 0) {
            question.subQuestions.forEach((sub, subIdx) => {
              const key = `${question.id}:${sub.id}`
              answerKeyToDescriptor.set(key, {
                questionId: question.id,
                subQuestionId: sub.id,
                questionText: question.text,
                subQuestionText: sub.text,
                groupTitle: group.title,
                isText: false,
                order: groupIdx * 1000 + questionIdx * 10 + subIdx,
              })
              console.log(`[Export] Added scale question descriptor: ${group.title} - ${question.text} (${sub.text})`)
            })
          } else {
            const key = `${question.id}`
            answerKeyToDescriptor.set(key, {
              questionId: question.id,
              questionText: question.text,
              groupTitle: group.title,
              isText: false,
              order: groupIdx * 1000 + questionIdx * 10,
            })
            console.log(`[Export] Added scale question descriptor (no sub-questions): ${group.title} - ${question.text}`)
          }
        }
      })
    })
    console.log(`[Export] Created ${answerKeyToDescriptor.size} descriptors from survey structure`)
    
    // 2단계: 답변 데이터에 있는 질문 중 설문 구조에 없는 질문 추가
    // question_snapshot 또는 데이터베이스에서 질문 정보 조회
    responses.forEach((response) => {
      response.answers?.forEach((answer) => {
        const key = answer.subQuestionId 
          ? `${answer.questionId}:${answer.subQuestionId}`
          : `${answer.questionId}`
        
        if (!answerKeyToDescriptor.has(key)) {
          // 먼저 question_snapshot에서 찾기
          const snapshot = questionSnapshotMap.get(response.id)
          let foundInSnapshot = false
          
          if (snapshot && Array.isArray(snapshot)) {
            snapshot.forEach((group: any) => {
              if (Array.isArray(group.questions)) {
                group.questions.forEach((q: any) => {
                  if (q.id === answer.questionId) {
                    if (answer.subQuestionId) {
                      // 하위 질문 찾기
                      if (Array.isArray(q.subQuestions)) {
                        const sub = q.subQuestions.find((s: any) => s.id === answer.subQuestionId)
                        if (sub) {
                          answerKeyToDescriptor.set(key, {
                            questionId: answer.questionId,
                            subQuestionId: answer.subQuestionId,
                            questionText: q.text,
                            subQuestionText: sub.text,
                            groupTitle: group.title || '',
                            isText: q.type === 'text',
                            order: 999900 + (group.order || 0) * 1000 + (q.order || 0) * 10,
                          })
                          foundInSnapshot = true
                        }
                      }
                    } else {
                      // 메인 질문
                      answerKeyToDescriptor.set(key, {
                        questionId: answer.questionId,
                        questionText: q.text,
                        groupTitle: group.title || '',
                        isText: q.type === 'text',
                        order: 999900 + (group.order || 0) * 1000 + (q.order || 0) * 10,
                      })
                      foundInSnapshot = true
                    }
                  }
                })
              }
            })
          }
          
          // question_snapshot에서 찾지 못한 경우 데이터베이스에서 찾기
          if (!foundInSnapshot) {
            const questionInfo = questionIdToQuestionMap.get(answer.questionId)
            
            if (questionInfo) {
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
              // 질문 정보를 찾지 못한 경우 (설문이 수정되어 삭제된 질문)
              answerKeyToDescriptor.set(key, {
                questionId: answer.questionId,
                subQuestionId: answer.subQuestionId,
                questionText: `[삭제된 질문]`,
                subQuestionText: answer.subQuestionId ? `[삭제된 하위질문]` : undefined,
                groupTitle: '삭제된 질문',
                isText: answer.textValue !== undefined,
                order: 999999,
              })
            }
          }
        }
      })
    })
    
    // order 기준으로 정렬
    const sortedDescriptors = Array.from(answerKeyToDescriptor.values())
      .sort((a, b) => a.order - b.order)
    
    console.log(`[Export] Total descriptors: ${sortedDescriptors.length}`)
    if (sortedDescriptors.length === 0) {
      console.error(`[Export] ⚠️ WARNING: No descriptors found! This means no questions will be exported.`)
      console.error(`[Export] Survey has ${survey.questionGroups.length} question groups`)
      survey.questionGroups.forEach((group, gIdx) => {
        console.error(`[Export] Group ${gIdx}: ${group.title}, ${group.questions.length} questions`)
        group.questions.forEach((q, qIdx) => {
          console.error(`[Export]   Question ${qIdx}: ${q.text} (${q.type}), ${q.subQuestions.length} sub-questions`)
        })
      })
    }
    console.log(`[Export] Descriptors (first 10):`, sortedDescriptors.slice(0, 10).map(d => ({
      questionId: d.questionId,
      subQuestionId: d.subQuestionId,
      questionText: d.questionText,
      groupTitle: d.groupTitle,
      isText: d.isText,
    })))
    
    // 응답 데이터 확인
    console.log(`[Export] Total responses to process: ${responses.length}`)
    const totalAnswersCount = responses.reduce((sum, r) => sum + (r.answers?.length || 0), 0)
    console.log(`[Export] Total answers across all responses: ${totalAnswersCount}`)
    
    if (responses.length > 0) {
      const firstResponse = responses[0]
      console.log(`[Export] First response details:`, {
        id: firstResponse.id,
        answersCount: firstResponse.answers?.length || 0,
        answers: firstResponse.answers?.map(a => ({
          questionId: a.questionId,
          subQuestionId: a.subQuestionId,
          value: a.value,
          textValue: a.textValue,
        })),
      })
    }

    // 환자 정보 추가 질문 헤더 생성
    const patientInfoHeaders: string[] = []
    if (survey.patientInfoConfig?.additionalQuestions && survey.patientInfoConfig.additionalQuestions.length > 0) {
      survey.patientInfoConfig.additionalQuestions.forEach((q) => {
        patientInfoHeaders.push(`환자정보 - ${q.text}`)
      })
      console.log(`[Export] Added ${patientInfoHeaders.length} patient info question headers:`, patientInfoHeaders)
    } else {
      console.log(`[Export] No additional patient info questions found`)
    }
    
    // Excel 헤더 생성
    const headers: string[] = ['제출일시', '환자 성함', '환자 유형', ...patientInfoHeaders]
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


    // 환자 유형별로 그룹화
    const grouped = new Map<string, typeof responses>()
    const patientTypeCounts = new Map<string, number>()
    
    responses.forEach((response) => {
      // 환자 유형 정규화 (공백 제거)
      const typeKey = (response.patientType || '미입력').trim()
      if (!grouped.has(typeKey)) {
        grouped.set(typeKey, [])
        patientTypeCounts.set(typeKey, 0)
      }
      grouped.get(typeKey)!.push(response)
      patientTypeCounts.set(typeKey, (patientTypeCounts.get(typeKey) || 0) + 1)
    })
    
    console.log(`[Export] Grouped by patient type:`, Array.from(patientTypeCounts.entries()).map(([type, count]) => `${type}: ${count}`))
    console.log(`[Export] All patient types in responses:`, Array.from(new Set(responses.map(r => (r.patientType || 'null').trim()))))
    
    // "종합검진" 그룹이 있는지 확인
    if (grouped.has('종합검진')) {
      const 종합검진Group = grouped.get('종합검진')!
      console.log(`[Export] 종합검진 group has ${종합검진Group.length} responses`)
      if (종합검진Group.length > 0) {
        console.log(`[Export] First 종합검진 response in group:`, {
          id: 종합검진Group[0].id,
          patientType: 종합검진Group[0].patientType,
          submittedAt: 종합검진Group[0].submittedAt,
          answersCount: 종합검진Group[0].answers?.length || 0,
          answers: 종합검진Group[0].answers?.slice(0, 3),
        })
      }
    } else {
      console.warn(`[Export] 종합검진 group not found! Available groups:`, Array.from(grouped.keys()))
      // 환자 유형에 공백이 있을 수 있으므로 확인
      const 종합검진WithSpace = responses.filter(r => {
        const type = (r.patientType || '').trim()
        return type === '종합검진' || type.includes('종합검진')
      })
      if (종합검진WithSpace.length > 0) {
        console.warn(`[Export] Found ${종합검진WithSpace.length} responses with "종합검진" in patient type (with spaces):`, 
          종합검진WithSpace.map(r => ({ id: r.id, patientType: `"${r.patientType}"` })))
      }
    }

    const wb = XLSX.utils.book_new()

    if (grouped.size === 0) {
      const ws = XLSX.utils.aoa_to_sheet([headers])
      ws['!cols'] = headers.map(() => ({ wch: 30 }))
      XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName('응답없음'))
    } else {
      grouped.forEach((groupResponses, typeKey) => {
        console.log(`[Export] Processing sheet "${typeKey}" with ${groupResponses.length} responses`)
        const excelData: any[] = [headers]

        // 응답을 제출일시 기준으로 정렬 (최신순)
        const sortedGroupResponses = [...groupResponses].sort((a, b) => {
          const dateA = new Date(a.submittedAt).getTime()
          const dateB = new Date(b.submittedAt).getTime()
          return dateB - dateA // 최신순 (내림차순)
        })
        
        console.log(`[Export] Sheet "${typeKey}": Processing ${sortedGroupResponses.length} responses (sorted by date, newest first)`)
        if (sortedGroupResponses.length > 0) {
          console.log(`[Export] Sheet "${typeKey}": Latest response date: ${sortedGroupResponses[0].submittedAt}`)
          console.log(`[Export] Sheet "${typeKey}": Oldest response date: ${sortedGroupResponses[sortedGroupResponses.length - 1].submittedAt}`)
        }
        
        sortedGroupResponses.forEach((response, responseIndex) => {
          // 제출일시를 한국 시간(KST, UTC+9)으로 변환하여 읽기 쉬운 형식으로 표시 (YYYY-MM-DD HH:mm:ss)
          let formattedDate = response.submittedAt
          try {
            const date = new Date(response.submittedAt)
            if (!isNaN(date.getTime())) {
              // 한국 시간대(Asia/Seoul)로 변환
              // Intl.DateTimeFormat을 사용하여 정확한 시간대 변환
              const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              })
              
              const parts = formatter.formatToParts(date)
              const year = parts.find(p => p.type === 'year')?.value || ''
              const month = parts.find(p => p.type === 'month')?.value.padStart(2, '0') || ''
              const day = parts.find(p => p.type === 'day')?.value.padStart(2, '0') || ''
              const hours = parts.find(p => p.type === 'hour')?.value.padStart(2, '0') || ''
              const minutes = parts.find(p => p.type === 'minute')?.value.padStart(2, '0') || ''
              const seconds = parts.find(p => p.type === 'second')?.value.padStart(2, '0') || ''
              
              formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
            }
          } catch (e) {
            console.warn(`[Export] Failed to format date: ${response.submittedAt}`, e)
          }
          
          // 환자 정보 추가 질문 답변 추가
          const patientInfoAnswers: string[] = []
          if (survey.patientInfoConfig?.additionalQuestions && survey.patientInfoConfig.additionalQuestions.length > 0) {
            survey.patientInfoConfig.additionalQuestions.forEach((q) => {
              const answer = response.patientInfoAnswers?.[q.id]
              if (answer && Array.isArray(answer) && answer.length > 0) {
                patientInfoAnswers.push(answer.join(', '))
              } else {
                patientInfoAnswers.push('')
              }
            })
            
            if (responseIndex === 0) {
              console.log(`[Export] First response patient info answers:`, {
                patientInfoAnswers: response.patientInfoAnswers,
                formattedAnswers: patientInfoAnswers,
              })
            }
          }
          
          const row: any[] = [
            formattedDate,
            response.patientName || '',
            response.patientType || '',
            ...patientInfoAnswers,
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
              descriptorsCount: sortedDescriptors.length,
              descriptorKeys: sortedDescriptors.slice(0, 5).map(d => 
                d.subQuestionId ? `${d.questionId}:${d.subQuestionId}` : d.questionId
              ),
              answerKeys: response.answers?.map(a => 
                a.subQuestionId ? `${a.questionId}:${a.subQuestionId}` : a.questionId
              ) || [],
            })
          }
          
          // 답변이 없는 경우 로그 (경고가 아닌 정보로)
          if (!response.answers || response.answers.length === 0) {
            console.log(`[Export] Response ${response.id} has no answers - will show empty cells for all questions`)
          }

          let matchedAnswers = 0
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

            if (responseIndex === 0 && descIndex < 5) {
              console.log(`[Export] Descriptor ${descIndex} (${desc.groupTitle} - ${desc.questionText}):`, {
                questionId: desc.questionId,
                subQuestionId: desc.subQuestionId,
                isText: desc.isText,
                foundAnswer: answer ? {
                  questionId: answer.questionId,
                  subQuestionId: answer.subQuestionId,
                  value: answer.value,
                  textValue: answer.textValue,
                } : null,
                answerKey: desc.subQuestionId ? `${desc.questionId}:${desc.subQuestionId}` : desc.questionId,
              })
            }

            if (answer) {
              matchedAnswers++
            }

            // 답변이 없어도 빈 셀로 표시 (질문은 항상 Excel에 포함)
            if (!answer) {
              row.push('') // 답변 없음 - 빈 셀로 표시
            } else if (desc.isText) {
              // 주관식 답변
              row.push(answer.textValue || '')
            } else {
              // 객관식 답변
              if (answer.value === null) {
          row.push('해당없음')
              } else if (typeof answer.value === 'number') {
                row.push(answer.value)
              } else {
                row.push('') // 값이 없으면 빈 셀
              }
            }
          })

          if (responseIndex === 0) {
            console.log(`[Export] First response matched ${matchedAnswers} answers out of ${sortedDescriptors.length} descriptors`)
            console.log(`[Export] Row data (first 15 columns):`, row.slice(0, 15))
            console.log(`[Export] Row length: ${row.length}, Headers length: ${headers.length}`)
            console.log(`[Export] Row breakdown:`, {
              date: row[0],
              patientName: row[1],
              patientType: row[2],
              patientInfoAnswersCount: patientInfoAnswers.length,
              questionAnswersCount: row.length - 3 - patientInfoAnswers.length,
              totalCells: row.length,
            })
            
            // 매칭되지 않은 답변 확인
            const unmatchedAnswers = response.answers?.filter(a => {
              const key = a.subQuestionId ? `${a.questionId}:${a.subQuestionId}` : a.questionId
              return !sortedDescriptors.some(d => {
                const descKey = d.subQuestionId ? `${d.questionId}:${d.subQuestionId}` : d.questionId
                return descKey === key
              })
            })
            if (unmatchedAnswers && unmatchedAnswers.length > 0) {
              console.warn(`[Export] Unmatched answers in first response:`, unmatchedAnswers)
            }
            
            // 매칭된 답변 상세 확인
            if (matchedAnswers > 0) {
              console.log(`[Export] Matched answers details:`, 
                sortedDescriptors.slice(0, 10).map((desc, idx) => {
                  const answer = response.answers?.find((a) => {
                    const questionMatch = a.questionId === desc.questionId
                    if (desc.subQuestionId) {
                      return questionMatch && a.subQuestionId === desc.subQuestionId
        } else {
                      return questionMatch && !a.subQuestionId
                    }
                  })
                  return {
                    index: idx,
                    descriptor: `${desc.groupTitle} - ${desc.questionText}`,
                    hasAnswer: !!answer,
                    answerValue: answer?.value,
                    answerText: answer?.textValue,
                  }
                })
              )
            }
          }

      excelData.push(row)
    })

        console.log(`[Export] Sheet "${typeKey}": ${excelData.length - 1} rows (${excelData.length - 1} responses + 1 header)`)
        
        // 엑셀 시트에 포함된 응답 날짜 범위 확인
        if (sortedGroupResponses.length > 0) {
          const sheetLatestDate = sortedGroupResponses[0].submittedAt
          const sheetOldestDate = sortedGroupResponses[sortedGroupResponses.length - 1].submittedAt
          console.log(`[Export] Sheet "${typeKey}" date range:`, {
            latest: sheetLatestDate,
            oldest: sheetOldestDate,
            totalResponses: sortedGroupResponses.length,
          })
        }

    const ws = XLSX.utils.aoa_to_sheet(excelData)
        const colWidths = headers.map(() => ({ wch: 30 }))
        colWidths[0] = { wch: 20 } // 제출일시 컬럼 너비 (YYYY-MM-DD HH:mm:ss 형식)
        colWidths[1] = { wch: 15 } // 환자 성함
        colWidths[2] = { wch: 15 } // 환자 유형
    ws['!cols'] = colWidths
        XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(typeKey))
      })
    }

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // 최종 엑셀 파일 생성 완료 로그
    console.log(`[Export] ✅ Excel file generated successfully`)
    console.log(`[Export] Excel file size: ${excelBuffer.length} bytes`)
    console.log(`[Export] Total sheets: ${wb.SheetNames.length}`)
    console.log(`[Export] Sheet names: ${wb.SheetNames.join(', ')}`)
    
    // 전체 응답 날짜 범위 요약
    let latestDate = ''
    let oldestDate = ''
    if (responses.length > 0) {
      const allResponseDates = responses.map(r => r.submittedAt).sort()
      latestDate = allResponseDates[allResponseDates.length - 1]
      oldestDate = allResponseDates[0]
      console.log(`[Export] 📊 Excel Summary:`, {
        totalResponses: responses.length,
        latestDate: latestDate,
        oldestDate: oldestDate,
        dateRange: `${oldestDate} ~ ${latestDate}`,
        uniqueDates: new Set(allResponseDates).size,
      })
      console.log(`[Export] ⏰ Latest response date in Excel: ${latestDate}`)
      console.log(`[Export] ⏰ Oldest response date in Excel: ${oldestDate}`)
    } else {
      console.warn(`[Export] ⚠️ No responses included in Excel file!`)
    }

    // 응답 헤더에 최신 응답 정보 추가 (브라우저에서 확인 가능하도록)
    const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="survey-${surveyId}-${Date.now()}.xlsx"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'Last-Modified': new Date().toUTCString(),
    }
    
    if (latestDate) {
      responseHeaders['X-Latest-Response-Date'] = latestDate
      responseHeaders['X-Oldest-Response-Date'] = oldestDate
      responseHeaders['X-Total-Responses'] = responses.length.toString()
    }

    return new NextResponse(excelBuffer, {
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

