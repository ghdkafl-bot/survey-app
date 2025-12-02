'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { Survey, HomepageConfig, DEFAULT_HOMEPAGE_CONFIG } from '@/lib/db'

const ADMIN_ID = 'guamct'
const ADMIN_PW = 'Hosp7533!!'
const DEFAULT_BACKGROUND = '#f0f9ff'

export default function Home() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPw, setAdminPw] = useState('')

  const fetchHomepageConfig = useCallback(async (force = false) => {
    try {
      // 캐시 무효화를 위해 timestamp 쿼리 파라미터 추가
      const timestamp = new Date().getTime()
      const url = `/api/homepage-config?t=${timestamp}${force ? '&_force=' + Math.random() : ''}`
      
      console.log('[Homepage] Fetching config from:', url)
      
      const res = await fetch(url, { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
      })
      
      console.log('[Homepage] Response status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Homepage] Response error:', errorText)
        throw new Error(`Failed to load homepage config: ${res.status} ${res.statusText}`)
      }
      
      const data = await res.json()
      console.log('[Homepage] ✅ Config data received from API:', JSON.stringify(data, null, 2))
      
      // 데이터 검증 및 상태 업데이트
      if (data && typeof data === 'object' && 'title' in data && 'description' in data) {
        const newConfig: HomepageConfig = {
          title: typeof data.title === 'string' && data.title.trim().length > 0
            ? data.title.trim()
            : DEFAULT_HOMEPAGE_CONFIG.title,
          description: typeof data.description === 'string' && data.description.trim().length > 0
            ? data.description.trim()
            : DEFAULT_HOMEPAGE_CONFIG.description,
        }
        
        console.log('[Homepage] ✅ Normalized config:', JSON.stringify(newConfig, null, 2))
        
        // 직접 상태 업데이트 (함수형 업데이트 대신)
        // 이렇게 하면 항상 최신 값으로 업데이트됨
        setHomepageConfig(newConfig)
        console.log('[Homepage] ✅ State updated directly with new config')
        
        // 상태 업데이트 후 확인
        setTimeout(() => {
          console.log('[Homepage] ⏰ After state update - Config should be:', JSON.stringify(newConfig, null, 2))
        }, 50)
      } else {
        console.warn('[Homepage] ❌ Invalid data format:', data)
        console.warn('[Homepage] Data type:', typeof data)
        if (data && typeof data === 'object') {
          console.warn('[Homepage] Data keys:', Object.keys(data))
          console.warn('[Homepage] Has title?', 'title' in data)
          console.warn('[Homepage] Has description?', 'description' in data)
        }
      }
    } catch (error) {
      console.error('[Homepage] ❌ Failed to fetch homepage config:', error)
      if (error instanceof Error) {
        console.error('[Homepage] Error message:', error.message)
        console.error('[Homepage] Error stack:', error.stack)
      }
      // 에러가 발생해도 기본값으로 설정하지 않음 (이전 값 유지)
    }
  }, [])

  useEffect(() => {
    fetchSurveys()
    fetchHomepageConfig(true) // 강제로 최신 데이터 가져오기

    // 주기적으로 설정 다시 불러오기 (10초마다 - 더 자주 체크)
    const interval = setInterval(() => {
      console.log('[Homepage] Periodic refresh of config')
      fetchHomepageConfig(true)
    }, 10000)

    // 페이지 포커스 시 설정 다시 불러오기
    const handleFocus = () => {
      console.log('[Homepage] Window focused, refreshing config')
      fetchHomepageConfig(true)
    }

    // 페이지 가시성 변경 시 설정 다시 불러오기
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[Homepage] Page visible, refreshing config')
        fetchHomepageConfig(true)
      }
    }

    // 관리자 페이지에서 설정이 업데이트되었을 때 메시지 수신
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'HOMEPAGE_CONFIG_UPDATED') {
        console.log('[Homepage] Received config update message, refreshing...')
        fetchHomepageConfig(true)
      }
    }

    // 로컬 스토리지 변경 감지 (다른 탭에서 설정이 업데이트된 경우)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'homepageConfigUpdated') {
        console.log('[Homepage] Detected config update in another tab, refreshing...')
        fetchHomepageConfig(true)
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('message', handleMessage)
    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchHomepageConfig])

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
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
                {homepageConfig?.title || DEFAULT_HOMEPAGE_CONFIG.title}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">
                {homepageConfig?.description || DEFAULT_HOMEPAGE_CONFIG.description}
              </p>
            </div>
          </header>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-gray-800">참여 가능한 설문</h2>
              {surveys.length > 0 && (
                <Link
                  href={`/survey/${surveys[0].id}`}
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  설문 시작하기
                </Link>
              )}
            </div>
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

          <div className="flex justify-end">
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
          </div>
        </div>
      </div>
    </main>
  )
}

