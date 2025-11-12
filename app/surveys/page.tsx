'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Survey } from '@/lib/db'

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/surveys', { cache: 'no-store' })
      const data = await res.json()
      setSurveys(data)
    } catch (error) {
      console.error('Failed to fetch surveys:', error)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">설문 목록</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              홈으로
            </Link>
          </div>

          {surveys.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              아직 생성된 설문이 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              {surveys.map((survey) => {
                const groupCount = survey.questionGroups?.length || 0
                const questionCount = survey.questionGroups?.reduce(
                  (sum, group) => sum + (group.questions?.length || 0),
                  0
                ) || 0
                return (
                  <Link
                    key={survey.id}
                    href={`/survey/${survey.id}`}
                    className="block p-6 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {survey.title}
                    </h3>
                    {survey.description && (
                      <p className="text-gray-600 mb-2">{survey.description}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      그룹 수: {groupCount}개 · 총 문항 수: {questionCount}개
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

