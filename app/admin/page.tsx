'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Survey, QuestionType, ClosingMessage } from '@/lib/db'

const ADMIN_ID = 'guamct'
const ADMIN_PW = 'Hosp7533!!'
const DEFAULT_BACKGROUND = '#f0f9ff'

const DEFAULT_CLOSING_MESSAGE: ClosingMessage = {
  text: '설문에 응해주셔서 감사합니다. 귀하의 의견으로 더욱 발전하는 "의료법인 구암의료재단 포항시티병원"이 되겠습니다.',
  color: '#1f2937',
  fontSize: 18,
  fontWeight: '600',
  fontStyle: 'normal',
  textAlign: 'center',
  fontFamily: 'inherit',
}

interface SubQuestionInput {
  id?: string
  text: string
}

interface QuestionInput {
  id?: string
  text: string
  type: QuestionType
  subQuestions: SubQuestionInput[]
  includeNoneOption?: boolean
}

interface QuestionGroupInput {
  id?: string
  title: string
  questions: QuestionInput[]
}

const defaultQuestion = (): QuestionInput => ({
  text: '',
  type: 'scale',
  subQuestions: [],
  includeNoneOption: false,
})

const defaultGroup = (): QuestionGroupInput => ({
  title: '',
  questions: [defaultQuestion()],
})

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPw, setAdminPw] = useState('')

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)
  const [questionGroups, setQuestionGroups] = useState<QuestionGroupInput[]>([defaultGroup()])
  const [closingMessage, setClosingMessage] = useState<ClosingMessage>(DEFAULT_CLOSING_MESSAGE)
  const [loading, setLoading] = useState(false)
  const [exportRanges, setExportRanges] = useState<Record<string, { from: string; to: string }>>({})
  const [purgeRanges, setPurgeRanges] = useState<Record<string, { from: string; to: string }>>({})

  useEffect(() => {
    const authenticated = sessionStorage.getItem('adminAuthenticated')
    if (authenticated === 'true') {
      setIsAuthenticated(true)
      fetchSurveys()
    }
  }, [])

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/surveys', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load surveys')
      const data = await res.json()
      setSurveys(data)
    } catch (error) {
      console.error('Failed to fetch surveys:', error)
      alert('설문 목록을 불러오지 못했습니다.')
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminId === ADMIN_ID && adminPw === ADMIN_PW) {
      sessionStorage.setItem('adminAuthenticated', 'true')
      setIsAuthenticated(true)
      setAdminId('')
      setAdminPw('')
      fetchSurveys()
    } else {
      alert('ID 또는 비밀번호가 올바르지 않습니다.')
      setAdminPw('')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuthenticated')
    setIsAuthenticated(false)
    setEditingSurveyId(null)
    resetForm()
    router.push('/')
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setBackgroundColor(DEFAULT_BACKGROUND)
    setClosingMessage(DEFAULT_CLOSING_MESSAGE)
    setQuestionGroups([defaultGroup()])
    setShowCreateForm(false)
    setEditingSurveyId(null)
  }

  const addGroup = () => {
    setQuestionGroups((prev) => [...prev, defaultGroup()])
  }

  const removeGroup = (index: number) => {
    setQuestionGroups((prev) => prev.filter((_, i) => i !== index))
  }

  const updateGroupTitle = (index: number, title: string) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], title }
      return next
    })
  }

  const addQuestionToGroup = (groupIndex: number) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      group.questions = [...group.questions, defaultQuestion()]
      return next
    })
  }

  const removeQuestionFromGroup = (groupIndex: number, questionIndex: number) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      group.questions = group.questions.filter((_, idx) => idx !== questionIndex)
      if (group.questions.length === 0) {
        group.questions = [defaultQuestion()]
      }
      return next
    })
  }

  const updateQuestionText = (groupIndex: number, questionIndex: number, text: string) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      const questions = [...group.questions]
      questions[questionIndex] = { ...questions[questionIndex], text }
      group.questions = questions
      return next
    })
  }

  const updateQuestionType = (groupIndex: number, questionIndex: number, type: QuestionType) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      const questions = [...group.questions]
      const target = questions[questionIndex]
      questions[questionIndex] = {
        ...target,
        type,
        subQuestions: type === 'scale' ? target.subQuestions : [],
      }
      group.questions = questions
      return next
    })
  }

  const addSubQuestion = (groupIndex: number, questionIndex: number) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      const questions = [...group.questions]
      const target = questions[questionIndex]
      if (target.subQuestions.length >= 5) return prev
      questions[questionIndex] = {
        ...target,
        subQuestions: [...target.subQuestions, { text: '' }],
      }
      group.questions = questions
      return next
    })
  }

  const removeSubQuestion = (groupIndex: number, questionIndex: number, subIndex: number) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      const questions = [...group.questions]
      const target = questions[questionIndex]
      questions[questionIndex] = {
        ...target,
        subQuestions: target.subQuestions.filter((_, idx) => idx !== subIndex),
      }
      group.questions = questions
      return next
    })
  }

  const updateSubQuestionText = (groupIndex: number, questionIndex: number, subIndex: number, text: string) => {
    setQuestionGroups((prev) => {
      const next = [...prev]
      const group = next[groupIndex]
      const questions = [...group.questions]
      const target = questions[questionIndex]
      const subQuestions = [...target.subQuestions]
      subQuestions[subIndex] = { ...subQuestions[subIndex], text }
      questions[questionIndex] = {
        ...target,
        subQuestions,
      }
      group.questions = questions
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!title.trim()) {
      alert('설문 제목을 입력해주세요.')
      return
    }

    if (questionGroups.some((group) => !group.title.trim())) {
      alert('모든 그룹에 제목을 입력해주세요.')
      return
    }

    for (const group of questionGroups) {
      for (const question of group.questions) {
        if (!question.text.trim()) {
          alert('모든 문항에 내용을 입력해주세요.')
          return
        }
        if (question.type === 'scale') {
          if (question.subQuestions.length > 5) {
            alert('추가 문항은 최대 5개까지 가능합니다.')
            return
          }
          if (question.subQuestions.some((sub) => !sub.text.trim())) {
            alert('추가 문항의 내용을 입력해주세요.')
            return
          }
        }
      }
    }

    const messageText = closingMessage.text?.trim()
    if (!messageText) {
      alert('마무리 문구를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        title,
        description,
        backgroundColor,
        questionGroups: questionGroups.map((group, groupIdx) => ({
          id: group.id,
          title: group.title,
          order: groupIdx,
          questions: group.questions.map((question, qIdx) => ({
            id: question.id,
            text: question.text,
            order: qIdx,
            type: question.type,
            subQuestions: question.subQuestions.map((sub, subIdx) => ({
              id: sub.id,
              text: sub.text,
              order: subIdx,
            })),
            includeNoneOption: question.type === 'scale' ? Boolean(question.includeNoneOption) : undefined,
          })),
        })),
        closingMessage,
      }

      const url = editingSurveyId ? `/api/surveys/${editingSurveyId}` : '/api/surveys'
      const method = editingSurveyId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        alert(editingSurveyId ? '설문이 수정되었습니다!' : '설문이 생성되었습니다!')
        await fetchSurveys()
        resetForm()
      } else {
        const errorData = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
        alert(`설문 저장에 실패했습니다: ${errorData.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Failed to save survey:', error)
      alert('설문 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (surveyId: string) => {
    try {
      const range = exportRanges[surveyId] || { from: '', to: '' }
      const params = new URLSearchParams({ surveyId })
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      const res = await fetch(`/api/export?${params.toString()}`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `survey-${surveyId}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
      alert('엑셀 다운로드에 실패했습니다.')
    }
  }

  const handleExportRangeChange = (surveyId: string, field: 'from' | 'to', value: string) => {
    setExportRanges((prev) => {
      const current = prev[surveyId] || { from: '', to: '' }
      return {
        ...prev,
        [surveyId]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  const handlePurgeRangeChange = (surveyId: string, field: 'from' | 'to', value: string) => {
    setPurgeRanges((prev) => {
      const current = prev[surveyId] || { from: '', to: '' }
      return {
        ...prev,
        [surveyId]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  const handlePurgeResponses = async (surveyId: string) => {
    const range = purgeRanges[surveyId] || { from: '', to: '' }
    const messageParts = [
      '현재까지 저장된 응답을 삭제합니다.',
      range.from ? `시작일: ${range.from}` : '',
      range.to ? `종료일: ${range.to}` : '',
      '계속하시겠습니까?',
    ].filter(Boolean)

    if (!window.confirm(messageParts.join('\n'))) {
      return
    }

    try {
      const res = await fetch('/api/responses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId,
          from: range.from || undefined,
          to: range.to || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to delete responses')
      }

      const data = await res.json()
      alert(`총 ${data.deletedCount || 0}개의 응답이 삭제되었습니다.`)
    } catch (error) {
      console.error('Delete responses error:', error)
      alert('응답 삭제에 실패했습니다.')
    }
  }

  const handleDeleteSurvey = async (surveyId: string, surveyTitle: string) => {
    const confirmed = window.confirm(
      [`설문 "${surveyTitle}"을 삭제하시겠습니까?`, '모든 응답도 함께 삭제됩니다.', '계속 진행하려면 확인을 눌러주세요.'].join('\n')
    )
    if (!confirmed) {
      return
    }

    try {
      const res = await fetch(`/api/surveys/${surveyId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete survey')
      }

      if (editingSurveyId === surveyId) {
        resetForm()
      }

      alert('설문이 삭제되었습니다.')
      await fetchSurveys()
    } catch (error) {
      console.error('Delete survey error:', error)
      alert('설문 삭제에 실패했습니다.')
    }
  }

  const startEdit = (survey: Survey) => {
    setEditingSurveyId(survey.id)
    setTitle(survey.title)
    setDescription(survey.description || '')
    setBackgroundColor(survey.backgroundColor || DEFAULT_BACKGROUND)
    setClosingMessage({
      ...DEFAULT_CLOSING_MESSAGE,
      ...survey.closingMessage,
      text: survey.closingMessage?.text || DEFAULT_CLOSING_MESSAGE.text,
    })
    setQuestionGroups(
      survey.questionGroups.map((group) => ({
        id: group.id,
        title: group.title,
        questions: group.questions.map((question) => ({
          id: question.id,
          text: question.text,
          type: question.type,
          subQuestions: question.subQuestions?.map((sub) => ({ id: sub.id, text: sub.text })) || [],
          includeNoneOption: question.includeNoneOption,
        })),
      }))
    )
    setShowCreateForm(true)
  }

  const surveysSummary = useMemo(() => {
    return surveys.map((survey) => {
      const groupCount = survey.questionGroups.length
      const questionCount = survey.questionGroups.reduce((sum, group) => sum + group.questions.length, 0)
      return { id: survey.id, groupCount, questionCount }
    })
  }, [surveys])

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">관리자 로그인</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ID</label>
                <input
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="관리자 ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
                <input
                  type="password"
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="비밀번호"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                로그인
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
                ← 홈으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold text-gray-800">관리자 페이지</h1>
            <div className="flex gap-2">
              <Link
                href="/"
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                홈으로
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              if (showCreateForm) {
                resetForm()
              } else {
                setShowCreateForm(true)
              }
            }}
            className="mb-6 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
          >
            {showCreateForm ? '폼 닫기' : '+ 새 설문 만들기'}
          </button>

          {showCreateForm && (
            <form onSubmit={handleSubmit} className="mb-10 space-y-6 bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">설문 제목 *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="예: 2024년 1월 퇴원환자 설문"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">설문 설명</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="설문에 대한 설명을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">배경 색상</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#f0f9ff"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
              </div>

              <section className="space-y-4 border border-blue-200 rounded-xl bg-white p-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800">문항 그룹 *</h2>
                  <button
                    type="button"
                    onClick={addGroup}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors"
                  >
                    + 그룹 추가
                  </button>
                </div>

                {questionGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-4 rounded-xl border border-blue-100 bg-white p-5">
                    <div className="flex gap-3">
                      <input
                        value={group.title}
                        onChange={(e) => updateGroupTitle(groupIndex, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                        placeholder={`그룹 ${groupIndex + 1} 제목 (예: 진료 서비스)`}
                        required
                      />
                      {questionGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeGroup(groupIndex)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          그룹 삭제
                        </button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {group.questions.map((question, questionIndex) => (
                        <div key={questionIndex} className="border border-gray-200 rounded-lg p-4 space-y-4">
                          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <input
                              value={question.text}
                              onChange={(e) => updateQuestionText(groupIndex, questionIndex, e.target.value)}
                              className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={`문항 ${questionIndex + 1}을 입력하세요`}
                              required
                            />
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => updateQuestionType(groupIndex, questionIndex, 'scale')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border ${question.type === 'scale' ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                              >
                                1~5점
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuestionType(groupIndex, questionIndex, 'text')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border ${question.type === 'text' ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                              >
                                주관식
                              </button>
                              {question.type === 'scale' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuestionGroups((prev) => {
                                      const next = [...prev]
                                      const group = next[groupIndex]
                                      const questions = [...group.questions]
                                      questions[questionIndex] = {
                                        ...questions[questionIndex],
                                        includeNoneOption: !questions[questionIndex].includeNoneOption,
                                      }
                                      group.questions = questions
                                      return next
                                    })
                                  }
                                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${question.includeNoneOption ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                                >
                                  {question.includeNoneOption ? '해당없음 포함' : '해당없음 미포함'}
                                </button>
                              )}
                              {group.questions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeQuestionFromGroup(groupIndex, questionIndex)}
                                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </div>

                          {question.type === 'scale' && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">추가 문항 (최대 5개)</span>
                                <button
                                  type="button"
                                  onClick={() => addSubQuestion(groupIndex, questionIndex)}
                                  disabled={question.subQuestions.length >= 5}
                                  className={`px-3 py-1 rounded text-xs font-medium ${question.subQuestions.length >= 5 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                                >
                                  + 추가 문항
                                </button>
                              </div>
                              {question.subQuestions.map((subQuestion, subIndex) => (
                                <div key={subIndex} className="flex gap-2">
                                  <input
                                    value={subQuestion.text}
                                    onChange={(e) => updateSubQuestionText(groupIndex, questionIndex, subIndex, e.target.value)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={`추가 문항 ${subIndex + 1}`}
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSubQuestion(groupIndex, questionIndex, subIndex)}
                                    className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                                  >
                                    삭제
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addQuestionToGroup(groupIndex)}
                      className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition-colors"
                    >
                      + 문항 추가
                    </button>
                  </div>
                ))}
              </section>

              <section className="space-y-4 border border-purple-200 rounded-xl bg-white p-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800">마무리 문구</h2>
                </div>
                <textarea
                  value={closingMessage.text}
                  onChange={(e) => setClosingMessage((prev) => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="설문을 마무리하는 문구를 입력하세요"
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">글자 색상</label>
                    <input
                      type="color"
                      value={closingMessage.color || DEFAULT_CLOSING_MESSAGE.color || '#1f2937'}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, color: e.target.value }))}
                      className="h-10 w-full border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">글자 크기 (px)</label>
                    <input
                      type="number"
                      min={12}
                      max={48}
                      value={closingMessage.fontSize || DEFAULT_CLOSING_MESSAGE.fontSize || 18}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, fontSize: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">글자 두께</label>
                    <select
                      value={closingMessage.fontWeight || DEFAULT_CLOSING_MESSAGE.fontWeight || '600'}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, fontWeight: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="400">보통</option>
                      <option value="500">중간</option>
                      <option value="600">굵게</option>
                      <option value="700">더 굵게</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">글씨 스타일</label>
                    <select
                      value={closingMessage.fontStyle || DEFAULT_CLOSING_MESSAGE.fontStyle || 'normal'}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, fontStyle: e.target.value as ClosingMessage['fontStyle'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="normal">기본</option>
                      <option value="italic">기울임</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">정렬</label>
                    <select
                      value={closingMessage.textAlign || DEFAULT_CLOSING_MESSAGE.textAlign || 'center'}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, textAlign: e.target.value as ClosingMessage['textAlign'] }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="left">왼쪽</option>
                      <option value="center">가운데</option>
                      <option value="right">오른쪽</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">글꼴</label>
                    <input
                      value={closingMessage.fontFamily || ''}
                      onChange={(e) => setClosingMessage((prev) => ({ ...prev, fontFamily: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: 'Noto Sans KR', sans-serif"
                    />
                  </div>
                </div>
                <div className="mt-4 p-4 border border-dashed border-purple-300 rounded-lg bg-purple-50">
                  <p
                    style={{
                      color: closingMessage.color || DEFAULT_CLOSING_MESSAGE.color,
                      fontSize: `${closingMessage.fontSize || DEFAULT_CLOSING_MESSAGE.fontSize || 18}px`,
                      fontWeight: closingMessage.fontWeight || DEFAULT_CLOSING_MESSAGE.fontWeight,
                      fontStyle: closingMessage.fontStyle || DEFAULT_CLOSING_MESSAGE.fontStyle,
                      textAlign: closingMessage.textAlign || DEFAULT_CLOSING_MESSAGE.textAlign,
                      fontFamily: closingMessage.fontFamily || DEFAULT_CLOSING_MESSAGE.fontFamily,
                    }}
                  >
                    {closingMessage.text || DEFAULT_CLOSING_MESSAGE.text}
                  </p>
                </div>
              </section>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                {loading ? '저장 중...' : editingSurveyId ? '설문 수정' : '설문 생성'}
              </button>
            </form>
          )}

          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">생성된 설문 목록</h2>
            {surveys.length === 0 ? (
              <p className="text-gray-500">아직 생성된 설문이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {surveys.map((survey, idx) => (
                  <div
                    key={survey.id}
                    className="flex flex-col gap-4 p-5 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">{survey.title}</h3>
                      {survey.description && (
                        <p className="text-gray-600 mt-1">{survey.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        그룹 수: {surveysSummary[idx].groupCount}개 · 총 문항 수: {surveysSummary[idx].questionCount}개 · 생성일: {new Date(survey.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={() => startEdit(survey)}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors w-full sm:w-auto"
                      >
                        수정
                      </button>
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <div className="flex gap-2 w-full sm:w-auto">
                          <input
                            type="date"
                            value={exportRanges[survey.id]?.from || ''}
                            onChange={(e) => handleExportRangeChange(survey.id, 'from', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="date"
                            value={exportRanges[survey.id]?.to || ''}
                            onChange={(e) => handleExportRangeChange(survey.id, 'to', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handleExport(survey.id)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm w-full sm:w-auto"
                        >
                          Excel 다운로드
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <div className="flex gap-2 w-full sm:w-auto">
                          <input
                            type="date"
                            value={purgeRanges[survey.id]?.from || ''}
                            onChange={(e) => handlePurgeRangeChange(survey.id, 'from', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <input
                            type="date"
                            value={purgeRanges[survey.id]?.to || ''}
                            onChange={(e) => handlePurgeRangeChange(survey.id, 'to', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={() => handlePurgeResponses(survey.id)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm w-full sm:w-auto"
                          type="button"
                        >
                          응답 삭제
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSurvey(survey.id, survey.title)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm w-full sm:w-auto"
                      >
                        설문 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

