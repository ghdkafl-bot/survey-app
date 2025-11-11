'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Survey, Answer, ClosingMessage, Question } from '@/lib/db'

const ANSWER_KEY_SEPARATOR = '__'

const makeKey = (questionId: string, subQuestionId?: string) =>
  subQuestionId ? `${questionId}${ANSWER_KEY_SEPARATOR}${subQuestionId}` : questionId

const parseKey = (key: string) => {
  const [questionId, subQuestionId] = key.split(ANSWER_KEY_SEPARATOR)
  return { questionId, subQuestionId }
}

export default function SurveyPage() {
  const params = useParams()
  const router = useRouter()

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({})
  const [patientName, setPatientName] = useState('')
  const [patientType, setPatientType] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchSurvey(params.id as string)
    }
  }, [params.id])

  const fetchSurvey = async (id: string) => {
    try {
      const res = await fetch(`/api/surveys/${id}`)
      if (!res.ok) throw new Error('Failed to fetch survey')
      const data: Survey = await res.json()
      const initialAnswers: Record<string, number | string | null> = {}
      data.questionGroups.forEach((group) => {
        group.questions.forEach((question) => {
          if (question.type === 'text') {
            initialAnswers[makeKey(question.id)] = ''
          } else {
            if (question.subQuestions.length > 0) {
              question.subQuestions.forEach((sub) => {
                initialAnswers[makeKey(question.id, sub.id)] = null
              })
            } else {
              initialAnswers[makeKey(question.id)] = null
            }
          }
        })
      })
      setSurvey(data)
      setAnswers(initialAnswers)
    } catch (error) {
      console.error('Failed to fetch survey:', error)
      alert('설문을 불러오지 못했습니다.')
    }
  }

  const handleScaleAnswer = (questionId: string, value: number | null, subQuestionId?: string) => {
    setAnswers((prev) => ({
      ...prev,
      [makeKey(questionId, subQuestionId)]: value,
    }))
  }

  const handleTextAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [makeKey(questionId)]: value,
    }))
  }

  const validateAnswers = (questions: Question[]): boolean => {
    for (const question of questions) {
      if (question.type === 'text') {
        const key = makeKey(question.id)
        const value = answers[key]
        if (typeof value !== 'string' || !value.trim()) {
          return false
        }
      } else {
        const allowNone = question.includeNoneOption
        if (question.subQuestions.length > 0) {
          for (const sub of question.subQuestions) {
            const key = makeKey(question.id, sub.id)
            const value = answers[key]
            if (allowNone) {
              if (!(typeof value === 'number' || value === null)) {
                return false
              }
            } else {
              if (typeof value !== 'number') {
                return false
              }
            }
          }
        } else {
          const key = makeKey(question.id)
          const value = answers[key]
          if (allowNone) {
            if (!(typeof value === 'number' || value === null)) {
              return false
            }
          } else {
            if (typeof value !== 'number') {
              return false
            }
          }
        }
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!survey) return

    if (!patientType) {
      alert('환자 유형을 선택해주세요.')
      return
    }

    const allQuestionsValid = survey.questionGroups.every((group) => validateAnswers(group.questions))
    if (!allQuestionsValid) {
      alert('모든 문항에 답변해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const responseAnswers: Answer[] = Object.entries(answers).map(([key, value]) => {
        const { questionId, subQuestionId } = parseKey(key)
        if (typeof value === 'string') {
          return {
            questionId,
            subQuestionId,
            textValue: value,
          }
        }
        return {
          questionId,
          subQuestionId,
          value,
        }
      })

      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey.id,
          answers: responseAnswers,
          patientName: patientName.trim() || undefined,
          patientType,
        }),
      })

      if (res.ok) {
        alert('설문이 제출되었습니다. 감사합니다!')
        router.push('/')
      } else {
        alert('설문 제출에 실패했습니다.')
      }
    } catch (error) {
      console.error('Failed to submit response:', error)
      alert('설문 제출에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!survey) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-500">설문을 불러오는 중...</p>
        </div>
      </main>
    )
  }

  const bgColor = survey.backgroundColor || '#f0f9ff'
  const closingMessage: ClosingMessage | undefined = survey.closingMessage

  return (
    <main className="min-h-screen py-6 px-4 sm:px-6" style={{ backgroundColor: bgColor }}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-md p-6 sm:p-8 space-y-6">
          <div>
            <Link href="/" className="text-sm text-blue-500 hover:text-blue-600">
              ← 설문 목록으로
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-gray-800">{survey.title}</h1>
            {survey.description && (
              <p className="mt-2 text-sm sm:text-base text-gray-600">{survey.description}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">환자 정보</h2>
              <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    환자 유형 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={patientType}
                    onChange={(e) => setPatientType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">선택하세요</option>
                    <option value="외래">외래</option>
                    <option value="3병동">3병동</option>
                    <option value="6병동">6병동</option>
                    <option value="종합검진">종합검진</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">환자 성함</label>
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="환자성함을 입력하세요 (선택사항)"
                  />
                </div>
              </div>
            </section>

            <div className="space-y-6">
              {survey.questionGroups.map((group, groupIndex) => (
                <section key={group.id} className="space-y-4">
                  <h2 className="text-xl font-bold text-gray-800 pb-2 border-b-2 border-blue-500">
                    {groupIndex + 1}. {group.title}
                  </h2>
                  <div className="space-y-4">
                    {group.questions.map((question, questionIndex) => {
                      const renderScale = () => (
                        <div className="space-y-3">
                          {question.subQuestions.length > 0 ? (
                            question.subQuestions.map((sub, subIndex) => {
                              const key = makeKey(question.id, sub.id)
                              const selectedValue = answers[key]
                              return (
                                <div key={sub.id} className="space-y-2">
                                  <p className="font-medium text-gray-700">
                                    {questionIndex + 1}-{subIndex + 1}. {sub.text}
                                  </p>
                                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <label
                                        key={value}
                                        className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === value ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                      >
                                        <input
                                          type="radio"
                                          name={key}
                                          value={value}
                                          checked={selectedValue === value}
                                          onChange={() => handleScaleAnswer(question.id, value, sub.id)}
                                          className="sr-only"
                                        />
                                        <span className="text-sm font-medium">{value}점</span>
                                      </label>
                                    ))}
                                    {question.includeNoneOption && (
                                      <label
                                        className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === null ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                      >
                                        <input
                                          type="radio"
                                          name={key}
                                          value=""
                                          checked={selectedValue === null}
                                          onChange={() => handleScaleAnswer(question.id, null, sub.id)}
                                          className="sr-only"
                                        />
                                        <span className="text-sm font-medium">해당없음</span>
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {[1, 2, 3, 4, 5].map((value) => {
                                  const key = makeKey(question.id)
                                  const selectedValue = answers[key]
                                  return (
                                    <label
                                      key={value}
                                      className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === value ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                    >
                                      <input
                                        type="radio"
                                        name={key}
                                        value={value}
                                        checked={selectedValue === value}
                                        onChange={() => handleScaleAnswer(question.id, value)}
                                        className="sr-only"
                                      />
                                      <span className="text-sm font-medium">{value}점</span>
                                    </label>
                                  )
                                })}
                                {question.includeNoneOption && (
                                  <label
                                    className={`flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${answers[makeKey(question.id)] === null ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                  >
                                    <input
                                      type="radio"
                                      name={makeKey(question.id)}
                                      value=""
                                      checked={answers[makeKey(question.id)] === null}
                                      onChange={() => handleScaleAnswer(question.id, null)}
                                      className="sr-only"
                                    />
                                    <span className="text-sm font-medium">해당없음</span>
                                  </label>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )

                      const renderText = () => {
                        const key = makeKey(question.id)
                        const value = answers[key]
                        return (
                          <textarea
                            value={typeof value === 'string' ? value : ''}
                            onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                            className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={4}
                            placeholder="자유롭게 의견을 작성해주세요."
                            required
                          />
                        )
                      }

                      return (
                        <article key={question.id} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                            {questionIndex + 1}. {question.text}
                          </h3>
                          {question.type === 'text' ? renderText() : renderScale()}
                        </article>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            {closingMessage?.text && (
              <section className="rounded-xl border border-gray-200 bg-slate-50 p-5">
                <p
                  style={{
                    color: closingMessage.color || '#1f2937',
                    fontSize: `${closingMessage.fontSize || 18}px`,
                    fontWeight: closingMessage.fontWeight || '600',
                    fontStyle: closingMessage.fontStyle || 'normal',
                    textAlign: closingMessage.textAlign || 'center',
                    fontFamily: closingMessage.fontFamily || 'inherit',
                    lineHeight: 1.6,
                  }}
                >
                  {closingMessage.text}
                </p>
              </section>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="sm:flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                {submitting ? '제출 중...' : '설문 제출'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}

