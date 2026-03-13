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
  const [step, setStep] = useState<'intro' | 'survey' | 'complete'>('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
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

  type FlatQuestion = {
    question: Question
    subQuestionId?: string
    subQuestionText?: string
  }

  const flatQuestions = useMemo<FlatQuestion[]>(() => {
    if (!survey) return []
    const list: FlatQuestion[] = []

    survey.questionGroups.forEach((group) => {
      group.questions.forEach((q) => {
        if (q.type === 'scale' && q.subQuestions.length > 0) {
          q.subQuestions.forEach((sub) => {
            list.push({
              question: q,
              subQuestionId: sub.id,
              subQuestionText: sub.text,
            })
          })
        } else {
          list.push({ question: q })
        }
      })
    })

    return list
  }, [survey])

  const totalQuestions = flatQuestions.length

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
      setStep('intro')
      setCurrentIndex(0)
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

  const startSurvey = () => {
    if (!survey || totalQuestions === 0) return
    setStep('survey')
    setCurrentIndex(0)
  }

  const goNext = () => {
    if (!survey || totalQuestions === 0) return
    if (currentIndex >= totalQuestions - 1) {
      const form = document.getElementById('survey-form') as HTMLFormElement | null
      if (form) {
        form.requestSubmit()
      }
      return
    }
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1))
  }

  const goPrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
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
        setStep('complete')
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
    <main className="min-h-screen bg-[#0B6B5E] text-slate-900" style={{ backgroundColor: bgColor }}>
      <div className="mx-auto w-full max-w-md min-h-screen flex flex-col">
        {step === 'intro' && (
          <section className="flex-1 flex flex-col items-center justify-center px-7 py-10 text-center bg-gradient-to-br from-[#0B6B5E] via-[#10957F] to-[#15BFA5]">
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/20 bg-white/15 text-xs font-medium text-white/90">
              🏥 {survey.title || '내원환자 만족도 조사'}
            </div>
            <div className="w-20 h-20 mb-7 rounded-3xl border border-white/20 bg-white/15 flex items-center justify-center text-4xl text-white">
              📋
            </div>
            <h1 className="text-2xl font-extrabold text-white leading-snug mb-3">
              소중한 내원에
              <br />
              감사드립니다
            </h1>
            <p className="text-sm text-white/80 leading-relaxed mb-8">
              더 나은 진료를 위해
              <br />
              간단한 만족도 조사에 참여해 주세요
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-10 text-xs text-white/90">
              <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">
                ⚡ {totalQuestions || 1}문항
              </span>
              <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">⏱ 1분 이내</span>
              <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">🔒 익명 보장</span>
            </div>
            <button
              type="button"
              onClick={startSurvey}
              className="w-full max-w-xs py-4 rounded-2xl bg-white text-[#0F7B6C] font-bold text-base shadow-lg active:scale-95 transition-transform"
            >
              설문 시작하기
            </button>
            <p className="mt-4 text-[13px] text-white/70">탭 한 번으로 간편하게 응답할 수 있어요</p>
          </section>
        )}
 
        {step === 'survey' && flatQuestions.length > 0 && (
          <section className="flex-1 flex flex-col bg-[#F5F7F6]">
            <header className="sticky top-0 z-10 bg-white border-b border-[#E2EBE9] px-5 py-4">
              <div className="flex items-center justify-between mb-2 text-[13px] font-semibold text-[#4A6360]">
                <span>진행률</span>
                <span>
                  <span className="text-[#0F7B6C]">{currentIndex + 1}</span> / {totalQuestions}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#E2EBE9] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0F7B6C] to-[#12A692] transition-all"
                  style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </header>
 
            <form
              id="survey-form"
              onSubmit={handleSubmit}
              className="flex-1 flex flex-col px-5 pb-6 pt-7 space-y-6"
            >
              <section
                ref={patientInfoSectionRef}
                className="mb-5 p-4 rounded-2xl bg-white shadow-sm border border-[#E2EBE9]"
              >
                <h2 className="text-base font-semibold text-gray-800 mb-4">환자 정보</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {patientInfoConfig.patientTypeLabel}
                        {patientInfoConfig.patientTypeRequired && <span className="text-red-500"> *</span>}
                      </label>
                      <select
                        ref={patientTypeSelectRef}
                        value={patientType}
                        onChange={(e) => setPatientType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0F7B6C] focus:border-transparent bg-white text-gray-900 text-sm"
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
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        {patientInfoConfig.patientNameLabel}
                        {patientInfoConfig.patientNameRequired && <span className="text-red-500"> *</span>}
                      </label>
                      <input
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0F7B6C] focus:border-transparent text-gray-900 text-sm"
                        placeholder={patientInfoConfig.patientNamePlaceholder}
                      />
                    </div>
                  </div>
 
                  {patientInfoConfig.additionalQuestions &&
                    patientInfoConfig.additionalQuestions.length > 0 && (
                      <div className="mt-4 space-y-3 border-t border-gray-200 pt-3">
                        <h3 className="text-xs font-semibold text-gray-800">추가 질문</h3>
                        {patientInfoConfig.additionalQuestions.map((question: PatientInfoQuestion) => {
                          const selectedOptions = patientInfoAnswers[question.id] || []
                          return (
                            <div key={question.id} className="space-y-1.5">
                              <label className="block text-[13px] font-medium text-gray-700">
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
                                      className={`px-3 py-1.5 border rounded-lg text-[13px] font-medium transition-colors ${
                                        isSelected
                                          ? 'bg-[#0F7B6C] border-[#0F7B6C] text-white'
                                          : 'bg-white border-gray-300 text-gray-700 hover:bg-[#E6F5F2]'
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
                </div>
              </section>
 
              {(() => {
                const item = flatQuestions[currentIndex]
                const q = item.question
                const key = makeKey(q.id, item.subQuestionId)
                const value = answers[key]
 
                const isScale = q.type === 'scale'
                const isText = q.type === 'text'
 
                return (
                  <div className="flex-1 flex flex-col" data-question-id={q.id}>
                    <span className="inline-flex px-3 py-1 mb-4 text-[13px] font-bold text-[#0F7B6C] bg-[#E6F5F2] rounded-full">
                      Q{currentIndex + 1}
                    </span>
                    <h2
                      className="text-[20px] font-bold text-[#1A2B2A] leading-snug mb-2"
                      dangerouslySetInnerHTML={{ __html: q.text }}
                    />
                    {item.subQuestionText && (
                      <p className="text-sm text-[#4A6360] mb-1">{item.subQuestionText}</p>
                    )}
                    {q.required && (
                      <p className="text-[13px] text-[#8FA3A0] mb-4">* 필수 항목입니다</p>
                    )}
 
                    {isScale && (
                      <div className="mt-auto flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => {
                          const selected = value === score
                          const label =
                            score === 5
                              ? '매우 만족'
                              : score === 4
                              ? '만족'
                              : score === 3
                              ? '보통'
                              : score === 2
                              ? '아쉬움'
                              : '매우 아쉬움'
                          const icon =
                            score === 5
                              ? '😍'
                              : score === 4
                              ? '😊'
                              : score === 3
                              ? '😐'
                              : score === 2
                              ? '😕'
                              : '😣'
 
                          return (
                            <button
                              key={score}
                              type="button"
                              onClick={() =>
                                handleScaleAnswer(q.id, score, item.subQuestionId, q.includeNoneOption)
                              }
                              className={`flex-1 flex flex-col items-center justify-center gap-2 px-2 py-4 rounded-2xl border text-xs font-semibold shadow-sm transition-all ${
                                selected
                                  ? 'border-[#0F7B6C] bg-[#E6F5F2] shadow-md scale-[1.04]'
                                  : 'border-[#E2EBE9] bg-white'
                              }`}
                            >
                              <span className="text-2xl">{icon}</span>
                              <span className={selected ? 'text-[#0F7B6C]' : 'text-[#8FA3A0]'}>
                                {label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
 
                    {isText && (
                      <div className="mt-auto">
                        <textarea
                          value={typeof value === 'string' ? value : ''}
                          onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                          className="w-full min-h-[140px] px-4 py-4 rounded-2xl border-2 border-[#E2EBE9] bg-white text-[15px] text-[#1A2B2A] shadow-sm outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#0F7B6C]/20 resize-none"
                          placeholder="예: 원장님이 정말 친절하게 설명해 주셔서 좋았어요!"
                        />
                        {!q.required && (
                          <p className="mt-2 text-[13px] text-[#8FA3A0] text-center">
                            건너뛰셔도 괜찮아요
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
 
              <div className="mt-6 flex gap-3">
                {currentIndex > 0 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="px-5 py-3 rounded-xl border border-[#E2EBE9] bg-[#F5F7F6] text-sm font-semibold text-[#4A6360]"
                  >
                    이전
                  </button>
                )}
                <button
                  type={currentIndex === totalQuestions - 1 ? 'submit' : 'button'}
                  onClick={currentIndex === totalQuestions - 1 ? undefined : goNext}
                  disabled={
                    submitting ||
                    (flatQuestions[currentIndex].question.type === 'scale' &&
                      answers[
                        makeKey(
                          flatQuestions[currentIndex].question.id,
                          flatQuestions[currentIndex].subQuestionId
                        )
                      ] == null)
                  }
                  className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0F7B6C] to-[#12A692] text-white font-bold text-sm shadow-md disabled:bg-[#E2EBE9] disabled:text-[#8FA3A0] disabled:shadow-none"
                >
                  {submitting
                    ? '제출 중...'
                    : currentIndex === totalQuestions - 1
                    ? '제출하기'
                    : '다음'}
                </button>
              </div>
            </form>
          </section>
        )}
 
        {step === 'complete' && (
          <section className="flex-1 flex flex-col items-center justify-center px-7 py-10 bg-[#F5F7F6] text-center">
            <div className="w-24 h-24 mb-7 rounded-full bg-[#E6F5F2] flex items-center justify-center text-4xl">
              🎉
            </div>
            <h2 className="text-2xl font-extrabold text-[#1A2B2A] mb-3">감사합니다!</h2>
            <p className="text-sm text-[#4A6360] leading-relaxed mb-8">
              소중한 의견을 반영하여
              <br />
              <span className="font-bold text-[#0F7B6C]">더 나은 1:1 맞춤 진료</span>로
              <br />
              보답하겠습니다
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-10 py-3 rounded-xl bg-[#0F7B6C] text-white font-semibold shadow-md active:scale-95 transition-transform"
            >
              닫기
            </button>
          </section>
        )}
      </div>
    </main>
  )
}


