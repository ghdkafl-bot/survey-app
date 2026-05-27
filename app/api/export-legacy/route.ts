import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import {
  collectLegacyResponses,
  responsesToLegacyRows,
} from '@/lib/legacyExport'

export const dynamic = 'force-dynamic'

const EMPTY_HEADERS = [
  '제출일시',
  '설문ID',
  '환자_성함',
  '환자_유형',
  '추가정보_JSON',
  '응답_JSON',
]

export async function GET(_request: NextRequest) {
  try {
    const legacyResponses = await collectLegacyResponses()
    const rows = responsesToLegacyRows(legacyResponses)

    console.log(
      `[Export-legacy] Exported ${rows.length} legacy response(s)`,
    )

    const worksheet =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([
            EMPTY_HEADERS,
            [
              '',
              '',
              '',
              '',
              '',
              '백업할 예전 응답이 없습니다. (다른 설문 ID 또는 구형 질문 구조 응답만 포함됩니다)',
            ],
          ])

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
        'X-Legacy-Count': String(rows.length),
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
