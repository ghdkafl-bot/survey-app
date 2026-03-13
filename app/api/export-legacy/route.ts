import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const STATIC_SURVEY_ID = 'static-hospital-5q'

export async function GET(_request: NextRequest) {
  try {
    const allResponses = await db.getAllResponses()
    // 고정 설문(static-hospital-5q)을 제외한 예전 응답만 백업
    const legacyResponses = allResponses.filter(
      (res) => res.surveyId && res.surveyId !== STATIC_SURVEY_ID,
    )

    const rows = legacyResponses.map((res) => ({
      제출일시: res.submittedAt,
      설문ID: res.surveyId,
      환자_성함: res.patientName ?? '',
      환자_유형: res.patientType ?? '',
      추가정보_JSON: res.patientInfoAnswers ? JSON.stringify(res.patientInfoAnswers) : '',
      응답_JSON: JSON.stringify(
        res.answers.map((a) => ({
          questionId: a.questionId,
          subQuestionId: a.subQuestionId,
          value: a.value,
          textValue: a.textValue,
        })),
      ),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '응답백업')

    const excelBuffer = XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx',
    }) as ArrayBuffer

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="legacy-responses-backup.xlsx"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[Export-legacy] Failed to export legacy responses:', error)
    return NextResponse.json(
      { error: 'Failed to export legacy responses' },
      { status: 500 },
    )
  }
}

