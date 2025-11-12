'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Survey } from '@/lib/db'

const ADMIN_ID = 'guamct'
const ADMIN_PW = 'Hosp7533!!'
const DEFAULT_BACKGROUND = '#f0f9ff'

export default function Home() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPw, setAdminPw] = useState('')

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/surveys')
      if (!res.ok) throw new Error('Failed to load surveys')
      const data = await res.json()
      const validSurveys = Array.isArray(data)
        ? data.filter(
            (survey: Survey) =>
              survey && Array.isArray(survey.questionGroups) && survey.questionGroups.length > 0
          )
        : []
      setSurveys(validSurveys)
    } catch (error) {
      console.error('Failed to fetch surveys:', error)
      alert('설문 목록을 불러오지 못했습니다.')
    }
  }

  const pageBackground = useMemo(() => surveys[0]?.backgroundColor || DEFAULT_BACKGROUND, [surveys])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminId === ADMIN_ID && adminPw === ADMIN_PW) {
      sessionStorage.setItem('adminAuthenticated', 'true')
      window.location.href = '/admin'
    } else {
      alert('ID 또는 비밀번호가 올바르지 않습니다.')
      setAdminPw('')
    }
  }

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6" style={{ backgroundColor: pageBackground }}>
      <div className="mx-auto w-full max-w-4xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">퇴원환자 친절도 설문</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                환자 만족도 조사를 위한 설문 시스템입니다. 참여를 통해 더 나은 서비스를 만들어주세요.
              </p>
              {surveys.length > 0 && (
                <div className="mt-4">
                  <Link
                    href={`/survey/${surveys[0].id}`}
                    className="inline-flex items-center justify-center px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm sm:text-base font-semibold transition-colors shadow-sm"
                  >
                    설문 시작하기
                  </Link>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowAdminLogin((prev) => !prev)}
                className="px-3 py-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                관리자
              </button>
              {showAdminLogin && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-5 z-20">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">관리자 ID</label>
                      <input
                        value={adminId}
                        onChange={(e) => setAdminId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="ID"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">비밀번호</label>
                      <input
                        type="password"
                        value={adminPw}
                        onChange={(e) => setAdminPw(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="비밀번호"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold"
                    >
                      로그인
                    </button>
                  </form>
                </div>
              )}
            </div>
          </header>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">참여 가능한 설문</h2>
            {surveys.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                현재 참여 가능한 설문이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {surveys.map((survey) => (
                  <Link
                    key={survey.id}
                    href={`/survey/${survey.id}`}
                    className="block border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-xl font-semibold text-gray-800">{survey.title}</h3>
                    {survey.description && (
                      <p className="text-sm text-gray-600 mt-2">{survey.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <div className="text-sm text-gray-500">
            설문 참여 중 문제가 발생하면 관리자에게 문의해주세요.
          </div>
        </div>
      </div>
    </main>
  )
}

