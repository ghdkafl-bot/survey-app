import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * 데이터베이스 상태 확인 API
 * - 총 응답 수
 * - 총 설문 수
 * - 각 설문별 응답 수
 * - 데이터베이스 저장 공간 사용량 (추정)
 */
export async function GET(request: NextRequest) {
  try {
    // 모든 설문 가져오기
    const surveys = await db.getAllSurveys()
    
    // 각 설문별 응답 수 확인
    const surveyStats = await Promise.all(
      surveys.map(async (survey) => {
        const responses = await db.getResponsesBySurvey(survey.id)
        return {
          surveyId: survey.id,
          surveyTitle: survey.title,
          responseCount: responses.length,
          answersCount: responses.reduce((sum, r) => sum + (r.answers?.length || 0), 0),
          latestResponse: responses.length > 0 
            ? responses[responses.length - 1].submittedAt 
            : null,
          oldestResponse: responses.length > 0 
            ? responses[0].submittedAt 
            : null,
        }
      })
    )
    
    // 전체 응답 수
    const allResponses = await db.getAllResponses()
    const totalResponses = allResponses.length
    const totalAnswers = allResponses.reduce((sum, r) => sum + (r.answers?.length || 0), 0)
    
    // 데이터베이스 사용량 추정 (대략적인 계산)
    // 각 응답: 약 200 bytes, 각 답변: 약 100 bytes
    const estimatedSize = (totalResponses * 200) + (totalAnswers * 100)
    const estimatedSizeMB = (estimatedSize / 1024 / 1024).toFixed(2)
    
    return NextResponse.json({
      success: true,
      data: {
        totalSurveys: surveys.length,
        totalResponses,
        totalAnswers,
        estimatedSizeMB: parseFloat(estimatedSizeMB),
        surveys: surveyStats,
        summary: {
          message: `총 ${surveys.length}개의 설문, ${totalResponses}개의 응답이 있습니다.`,
          estimatedUsage: `추정 저장 공간: ${estimatedSizeMB} MB`,
          warning: estimatedSize > 400 * 1024 * 1024 // 400MB 이상이면 경고
            ? '⚠️ 저장 공간이 400MB를 초과했습니다. 백업을 권장합니다.'
            : null,
        },
      },
    })
  } catch (error) {
    console.error('Check data error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
