'use client'

import { useEffect, useState } from 'react'

const ADMIN_ID = 'guamct'
const ADMIN_PW = 'hosp7533'

// 프론트 설문과 동일한 고정 설문 ID
const STATIC_SURVEY_ID = '0d8da8f8-8abb-4c63-8647-919154faf7ea'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPw, setAdminPw] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [legacyDownloading, setLegacyDownloading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem('adminAuthenticated')
    if (stored === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminId === ADMIN_ID && adminPw === ADMIN_PW) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('adminAuthenticated', 'true')
      }
      setIsAuthenticated(true)
      setAdminPw('')
    } else {
      alert('ID 또는 비밀번호가 올바르지 않습니다.')
      setAdminPw('')
    }
  }

  const handleDownloadExcel = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const params = new URLSearchParams({
        surveyId: STATIC_SURVEY_ID,
        _t: Date.now().toString(),
      })

      const res = await fetch(`/api/export?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('Export failed:', res.status, res.statusText, text)
        alert('엑셀 다운로드에 실패했습니다.')
        return
      }

      const blob = await res.blob()
      if (!blob.size) {
        alert('다운로드된 파일이 비어 있습니다.')
        return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `survey-${STATIC_SURVEY_ID}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('엑셀 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadLegacyExcel = async () => {
    if (legacyDownloading) return
    setLegacyDownloading(true)
    try {
      const res = await fetch('/api/export-legacy', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('Legacy export failed:', res.status, res.statusText, text)
        alert('예전 응답 엑셀 다운로드에 실패했습니다.')
        return
      }

      const blob = await res.blob()
      if (!blob.size) {
        alert('다운로드된 파일이 비어 있습니다.')
        return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'legacy-responses-backup.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Legacy export error:', error)
      alert('예전 응답 엑셀 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLegacyDownloading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">관리자 로그인</h1>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
              <input
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="관리자 ID"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={adminPw}
                onChange={(e) => setAdminPw(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="비밀번호"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="w-full mt-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              로그인
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-800">관리자 페이지</h1>
          <p className="text-sm text-gray-500">
            내원환자 만족도 설문 응답을 엑셀 파일로 내려받을 수 있습니다.
          </p>
        </header>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">신규 설문 (고정 5문항)</p>
            <p className="text-xs text-gray-500 break-all">설문 ID: {STATIC_SURVEY_ID}</p>
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="w-full px-4 py-3 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 disabled:bg-gray-400 transition-colors"
            >
              {downloading ? '다운로드 중...' : '신규 설문 엑셀 다운로드'}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200 space-y-2">
            <p className="text-sm font-medium text-gray-800">예전 응답 백업</p>
            <p className="text-xs text-gray-500">
              예전 설문들(`{STATIC_SURVEY_ID}` 이전 설문)의 모든 응답을 한 번에 백업합니다.
            </p>
            <button
              type="button"
              onClick={handleDownloadLegacyExcel}
              disabled={legacyDownloading}
              className="w-full px-4 py-3 rounded-lg bg-slate-600 text-white font-semibold text-sm hover:bg-slate-700 disabled:bg-gray-400 transition-colors"
            >
              {legacyDownloading ? '백업 생성 중...' : '예전 응답 백업 엑셀 다운로드'}
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('adminAuthenticated')
            }
            setIsAuthenticated(false)
            setAdminId('')
            setAdminPw('')
          }}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
        >
          로그아웃
        </button>
      </div>
    </main>
  )
}

