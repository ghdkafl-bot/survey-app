'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Survey,
  Answer,
  ClosingMessage,
  Question,
  PatientInfoConfig,
  PatientInfoQuestion,
  DEFAULT_PATIENT_INFO_CONFIG,
} from '@/lib/db'

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
  const [answers, setAnswers] = useState<Record<string, number | string | null | undefined>>({})
  const [patientName, setPatientName] = useState('')
  const [patientType, setPatientType] = useState('')
  const [patientInfoAnswers, setPatientInfoAnswers] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const patientInfoSectionRef = useRef<HTMLDivElement | null>(null)
  const patientTypeSelectRef = useRef<HTMLSelectElement | null>(null)

  const patientInfoConfig: PatientInfoConfig = useMemo(() => {
    const base: PatientInfoConfig = {
      ...DEFAULT_PATIENT_INFO_CONFIG,
      patientTypeOptions: [...DEFAULT_PATIENT_INFO_CONFIG.patientTypeOptions],
    }

    if (!survey) {
      return base
    }

    const source = survey.patientInfoConfig

    return {
      ...base,
      ...source,
      patientTypeOptions:
        source?.patientTypeOptions?.length
          ? [...source.patientTypeOptions]
          : [...DEFAULT_PATIENT_INFO_CONFIG.patientTypeOptions],
      patientTypeTextColor:
        source?.patientTypeTextColor?.trim().length
          ? source.patientTypeTextColor
          : base.patientTypeTextColor,
    }
  }, [survey])

  useEffect(() => {
    if (params.id) {
      fetchSurvey(params.id as string)
    }
  }, [params.id])

  const fetchSurvey = async (id: string) => {
    try {
      const res = await fetch(`/api/surveys/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch survey')
      const data: Survey = await res.json()
      const initialAnswers: Record<string, number | string | null | undefined> = {}
      data.questionGroups.forEach((group) => {
        group.questions.forEach((question) => {
          if (question.type === 'text') {
            initialAnswers[makeKey(question.id)] = ''
          } else {
            if (question.subQuestions.length > 0) {
              question.subQuestions.forEach((sub) => {
                initialAnswers[makeKey(question.id, sub.id)] = undefined
              })
            } else {
              initialAnswers[makeKey(question.id)] = undefined
            }
          }
        })
      })
      setSurvey(data)
      setAnswers(initialAnswers)
      setPatientType('')
      setPatientName('')
      setPatientInfoAnswers({})
    } catch (error) {
      console.error('Failed to fetch survey:', error)
      window.alert('설문을 불러오지 못했습니다.')
    }
  }

  const handleScaleAnswer = (
    questionId: string,
    value: number | null,
    subQuestionId?: string,
    allowNone?: boolean
  ) => {
     const key = makeKey(questionId, subQuestionId)
     setAnswers((prev) => {
      const currentValue = prev[key]
      return {
        ...prev,
        [key]: currentValue === value ? undefined : value,
      }
    })
  }

  const handleTextAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [makeKey(questionId)]: value,
    }))
  }

  const handlePatientInfoAnswer = (questionId: string, option: string) => {
    setPatientInfoAnswers((prev) => {
      const currentAnswers = prev[questionId] || []
      const isSelected = currentAnswers.includes(option)
      const newAnswers = isSelected
        ? currentAnswers.filter((ans) => ans !== option)
        : [...currentAnswers, option]
      return {
        ...prev,
        [questionId]: newAnswers,
      }
    })
  }

  const validateAnswers = (questions: Question[]): { valid: boolean; missingQuestion?: Question } => {
    for (const question of questions) {
      if (question.required) {
        // 주 질문에 답변이 있는지 확인
        const mainKey = makeKey(question.id)
        const mainAnswer = answers[mainKey]
        
        if (question.type === 'scale') {
          // 서브 질문이 있는 경우, 각 서브 질문에 답변이 있는지 확인
          if (question.subQuestions.length > 0) {
            // 모든 서브 질문에 답변이 있어야 함
            for (const sub of question.subQuestions) {
              const subKey = makeKey(question.id, sub.id)
              const subAnswer = answers[subKey]
              if (subAnswer === undefined || subAnswer === null) {
                return { valid: false, missingQuestion: question }
              }
            }
          } else {
            // 서브 질문이 없는 경우, 주 질문에 답변이 있어야 함
            if (mainAnswer === undefined || mainAnswer === null) {
              return { valid: false, missingQuestion: question }
            }
          }
        } else if (question.type === 'text') {
          // 텍스트 질문: 값이 문자열이고 비어있지 않아야 함
          if (typeof mainAnswer !== 'string' || mainAnswer.trim().length === 0) {
            return { valid: false, missingQuestion: question }
          }
        }
      }
    }
    return { valid: true }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!survey) return

    if (patientInfoConfig.patientTypeRequired && !patientType.trim()) {
      window.alert(`${patientInfoConfig.patientTypeLabel}을(를) 선택해주세요.`)
      patientInfoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => patientTypeSelectRef.current?.focus({ preventScroll: true }), 100)
      return
    }

    const trimmedPatientName = patientName.trim()
    if (patientInfoConfig.patientNameRequired && !trimmedPatientName) {
      window.alert(`${patientInfoConfig.patientNameLabel}을(를) 입력해주세요.`)
      patientInfoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (patientInfoConfig.additionalQuestions && patientInfoConfig.additionalQuestions.length > 0) {
      for (const question of patientInfoConfig.additionalQuestions) {
        if (question.required && (!patientInfoAnswers[question.id] || patientInfoAnswers[question.id].length === 0)) {
          window.alert(`${question.text}에 답변해주세요.`)
          patientInfoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
      }
    }

    const patientTypeValue = patientType || undefined

    // 필수 질문 검증
    for (const group of survey.questionGroups) {
      const validation = validateAnswers(group.questions)
      if (!validation.valid && validation.missingQuestion) {
        const questionText = validation.missingQuestion.text
        window.alert(`${questionText}에 답변해주세요.`)
        // 해당 질문으로 스크롤 (간단한 구현)
        const questionElement = document.querySelector(`[data-question-id="${validation.missingQuestion.id}"]`)
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
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
          patientName: trimmedPatientName || undefined,
          patientType: patientTypeValue,
          patientInfoAnswers: Object.keys(patientInfoAnswers).length > 0 ? patientInfoAnswers : undefined,
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
            <section
              ref={patientInfoSectionRef}
              className="p-5 sm:p-6 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-gray-200"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-4">환자 정보</h2>
              <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {patientInfoConfig.patientTypeLabel}
                    {patientInfoConfig.patientTypeRequired && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    ref={patientTypeSelectRef}
                    value={patientType}
                    onChange={(e) => setPatientType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                    style={{
                      color: patientType ? '#111827' : '#9ca3af',
                    }}
                  >
                    <option value="">{patientInfoConfig.patientTypePlaceholder}</option>
                    {patientInfoConfig.patientTypeOptions.map((option) => (
                      <option key={option} value={option} className="text-gray-900">
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {patientInfoConfig.patientNameLabel}
                    {patientInfoConfig.patientNameRequired && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder={patientInfoConfig.patientNamePlaceholder}
                  />
                </div>
              </div>

              {patientInfoConfig.additionalQuestions && patientInfoConfig.additionalQuestions.length > 0 && (
                <div className="mt-6 space-y-4 border-t border-gray-200 pt-4">
                  <h3 className="text-md font-semibold text-gray-800">추가 질문</h3>
                  {patientInfoConfig.additionalQuestions.map((question: PatientInfoQuestion) => {
                    const selectedOptions = patientInfoAnswers[question.id] || []
                    return (
                      <div key={question.id} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {question.text}
                          {question.required && <span className="text-red-500"> *</span>}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {question.options.map((option) => {
                            const isSelected = selectedOptions.includes(option)
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handlePatientInfoAnswer(question.id, option)}
                                className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-blue-50'
                                }`}
                              >
                                {option}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
                            <>
                              {question.required && (
                                <p className="text-sm text-gray-500 mb-2">* 필수 항목입니다</p>
                              )}
                              {question.subQuestions.map((sub, subIndex) => {
                                const key = makeKey(question.id, sub.id)
                                const selectedValue = answers[key]
                                return (
                                  <div key={sub.id} className="space-y-2">
                                    <p className="font-medium text-gray-700">
                                      {questionIndex + 1}-{subIndex + 1}. {sub.text}
                                    </p>
                                  <div className="flex flex-wrap sm:grid sm:grid-cols-6 gap-2">
                                    {[1, 2, 3, 4, 5].map((value) => (
                                      <label
                                        key={value}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          handleScaleAnswer(question.id, value, sub.id, question.includeNoneOption)
                                        }}
                                        className={`flex-1 basis-[30%] sm:basis-auto min-w-[70px] flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === value ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                      >
                                        <input
                                          type="radio"
                                          name={key}
                                          value={value}
                                          checked={selectedValue === value}
                                          onChange={() => {}}
                                          onClick={(e) => e.preventDefault()}
                                          className="sr-only"
                                        />
                                        <span className="text-sm font-medium">{value}점</span>
                                      </label>
                                    ))}
                                    {question.includeNoneOption && (
                                      <label
                                        onClick={(e) => {
                                          e.preventDefault()
                                          handleScaleAnswer(question.id, null, sub.id, true)
                                        }}
                                        className={`flex-1 basis-[30%] sm:basis-auto min-w-[70px] flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === null ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                      >
                                        <input
                                          type="radio"
                                          name={key}
                                          value=""
                                          checked={selectedValue === null}
                                          onChange={() => {}}
                                          onClick={(e) => e.preventDefault()}
                                          className="sr-only"
                                        />
                                        <span className="text-sm font-medium whitespace-nowrap">해당없음</span>
                                      </label>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                            </>
                          ) : (
                            <div className="space-y-2">
                              {question.required && (
                                <p className="text-sm text-gray-500">* 필수 항목입니다</p>
                              )}
                              <div className="flex flex-wrap sm:grid sm:grid-cols-6 gap-2">
                                {[1, 2, 3, 4, 5].map((value) => {
                                  const key = makeKey(question.id)
                                  const selectedValue = answers[key]
                                  return (
                                    <label
                                      key={value}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        handleScaleAnswer(question.id, value, undefined, question.includeNoneOption)
                                      }}
                                      className={`flex-1 basis-[30%] sm:basis-auto min-w-[70px] flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${selectedValue === value ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                    >
                                      <input
                                        type="radio"
                                        name={key}
                                        value={value}
                                        checked={selectedValue === value}
                                        onChange={() => {}}
                                        onClick={(e) => e.preventDefault()}
                                        className="sr-only"
                                      />
                                      <span className="text-sm font-medium">{value}점</span>
                                    </label>
                                  )
                                })}
                                {question.includeNoneOption && (
                                  <label
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleScaleAnswer(question.id, null, undefined, true)
                                    }}
                                    className={`flex-1 basis-[30%] sm:basis-auto min-w-[70px] flex items-center justify-center px-3 py-2 border rounded-lg cursor-pointer transition-colors ${answers[makeKey(question.id)] === null ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-blue-50'}`}
                                  >
                                    <input
                                      type="radio"
                                      name={makeKey(question.id)}
                                      value=""
                                      checked={answers[makeKey(question.id)] === null}
                                      onChange={() => {}}
                                      onClick={(e) => e.preventDefault()}
                                      className="sr-only"
                                    />
                                    <span className="text-sm font-medium whitespace-nowrap">해당없음</span>
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
                            className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            rows={4}
                            placeholder="자유롭게 의견을 작성해주세요."
                          />
                        )
                      }

                      return (
                        <article key={question.id} data-question-id={question.id} className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                            {questionIndex + 1}. {question.text}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
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


