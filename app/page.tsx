'use client'

import { useEffect, useState } from 'react'

type QuestionType = 'emoji' | 'text'

type Question = {
  id: string
  number: string
  text: string
  sub: string
  type: QuestionType
  options?: { icon: string; label: string; value: number }[]
}

const STATIC_SURVEY_ID = 'static-hospital-5q'

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    number: 'Q1',
    text: '담당 의료진의 <span class="q-highlight">친절한 설명</span>에 만족하셨나요?',
    sub: '진료 시 충분한 설명을 받으셨는지 알려주세요',
    type: 'emoji',
    options: [
      { icon: '😍', label: '매우 만족', value: 5 },
      { icon: '😊', label: '만족', value: 4 },
      { icon: '😐', label: '보통', value: 3 },
      { icon: '😕', label: '아쉬움', value: 2 },
    ],
  },
  {
    id: 'q2',
    number: 'Q2',
    text: '<span class="q-highlight">대기 없이 빠른 진료</span>를 받으셨나요?',
    sub: '접수부터 진료까지의 대기 시간은 어떠셨나요',
    type: 'emoji',
    options: [
      { icon: '⚡', label: '매우 빠름', value: 5 },
      { icon: '😊', label: '적절해요', value: 4 },
      { icon: '😐', label: '보통', value: 3 },
      { icon: '🐢', label: '좀 길었어요', value: 2 },
    ],
  },
  {
    id: 'q3',
    number: 'Q3',
    text: '<span class="q-highlight">최신 장비와 깨끗한 시설</span>에 만족하셨나요?',
    sub: '치료 장비 및 원내 환경에 대해 알려주세요',
    type: 'emoji',
    options: [
      { icon: '🌟', label: '매우 만족', value: 5 },
      { icon: '😊', label: '만족', value: 4 },
      { icon: '😐', label: '보통', value: 3 },
      { icon: '😕', label: '아쉬움', value: 2 },
    ],
  },
  {
    id: 'q4',
    number: 'Q4',
    text: '<span class="q-highlight">1:1 맞춤 상담</span>이 도움이 되셨나요?',
    sub: '개인 증상에 맞는 치료 계획 안내가 충분했는지 알려주세요',
    type: 'emoji',
    options: [
      { icon: '💯', label: '큰 도움', value: 5 },
      { icon: '😊', label: '도움 됨', value: 4 },
      { icon: '😐', label: '보통', value: 3 },
      { icon: '😕', label: '아쉬움', value: 2 },
    ],
  },
  {
    id: 'q5',
    number: 'Q5',
    text: '소중한 한마디를 남겨주세요',
    sub: '칭찬, 건의, 개선 사항 무엇이든 좋아요 (선택)',
    type: 'text',
  },
]

const PATIENT_TYPES = ['외래', '종합검진', '3병동', '6병동'] as const

const HOW_KNOWN_OPTIONS = [
  '평소 알고 있었다',
  '지인추천',
  '웹검색(네이버/카카오/구글)',
  'ai검색(chatGPT/제미나이)',
  '현수막/아파트광고',
  '홈페이지/블로그/인스타그램',
  '명함/광고지/팜플렛',
  '출장건강검진',
] as const

export default function Home() {
  const [step, setStep] = useState<'intro' | 'survey' | 'complete'>('intro')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | string | undefined>>({})
  const [patientName, setPatientName] = useState('')
  const [patientTypes, setPatientTypes] = useState<string[]>([])
  const [howKnown, setHowKnown] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [confettiPieces, setConfettiPieces] = useState<
    { id: number; left: string; duration: string; delay: string; size: string; color: string; borderRadius: string }[]
  >([])
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminId, setAdminId] = useState('')
  const [adminPw, setAdminPw] = useState('')

  const questionSteps = QUESTIONS.length
  const totalSteps = questionSteps + 1 // 마지막 1단계는 이름/유형/경로
  const isInfoStep = step === 'survey' && current === questionSteps
  const currentQuestion = !isInfoStep ? QUESTIONS[current] : null

  const handleStart = () => setStep('survey')

  const handleSelectEmoji = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    if (current < questionSteps - 1) {
      setTimeout(() => setCurrent((c) => Math.min(c + 1, questionSteps - 1)), 350)
    }
  }

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (adminId === 'guamct' && adminPw === 'hosp7533') {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('adminAuthenticated', 'true')
        window.location.href = '/admin'
      }
    } else {
      alert('ID 또는 비밀번호가 올바르지 않습니다.')
      setAdminPw('')
    }
  }

  const handleCloseWindow = () => {
    if (typeof window === 'undefined') return
    window.close()
    // 브라우저 정책으로 close가 안 되는 경우, 대체 행동
    setTimeout(() => {
      if (window.closed) return
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.href = 'about:blank'
      }
    }, 100)
  }

  const handleNext = async () => {
    if (!isInfoStep && currentQuestion?.type === 'text') {
      // textarea onChange에서 값 업데이트됨
    }
    if (current < totalSteps - 1) {
      setCurrent((c) => Math.min(c + 1, totalSteps - 1))
      return
    }
    await handleSubmit()
  }

  const handlePrev = () => {
    if (current > 0) setCurrent((c) => Math.max(c - 1, 0))
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const payload = {
        surveyId: STATIC_SURVEY_ID,
        answers: [
          { questionId: 'q1', value: typeof answers.q1 === 'number' ? answers.q1 : undefined },
          { questionId: 'q2', value: typeof answers.q2 === 'number' ? answers.q2 : undefined },
          { questionId: 'q3', value: typeof answers.q3 === 'number' ? answers.q3 : undefined },
          { questionId: 'q4', value: typeof answers.q4 === 'number' ? answers.q4 : undefined },
          {
            questionId: 'q5',
            textValue:
              typeof answers.q5 === 'string' && answers.q5.trim() ? answers.q5.trim() : undefined,
          },
        ],
        patientName: patientName.trim() || undefined,
        patientType: patientTypes.length > 0 ? patientTypes.join(', ') : undefined,
        patientInfoAnswers: howKnown.length > 0 ? { howKnown } : undefined,
      }

      // DB 저장은 시도하지만, 실패해도 사용자 흐름은 막지 않음
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        console.error('Failed to save survey response', await res.text())
      }
    } catch (e) {
      console.error('Error while saving survey response', e)
    } finally {
      setSubmitting(false)
      setStep('complete')
    }
  }

  useEffect(() => {
    if (step !== 'complete') return

    const colors = ['#0F7B6C', '#12A692', '#F5A623', '#FF6B6B', '#48DBFB', '#FFD700']
    const pieces = Array.from({ length: 60 }).map((_, idx) => ({
      id: idx,
      left: `${Math.random() * 100}%`,
      duration: `${1.5 + Math.random() * 2}s`,
      delay: `${Math.random() * 0.8}s`,
      size: `${6 + Math.random() * 8}px`,
      color: colors[Math.floor(Math.random() * colors.length)],
      borderRadius: Math.random() > 0.5 ? '9999px' : '2px',
    }))
    setConfettiPieces(pieces)
    const timer = setTimeout(() => setConfettiPieces([]), 4000)
    return () => clearTimeout(timer)
  }, [step])

  const progressPercent =
    step === 'survey' ? ((current + 1) / totalSteps) * 100 : 0

  const emojiDisabled =
    step === 'survey' &&
    !isInfoStep &&
    currentQuestion?.type === 'emoji' &&
    typeof answers[currentQuestion.id] !== 'number'

  if (step === 'intro') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0B6B5E] via-[#10957F] to-[#15BFA5] px-4">
        <div className="relative text-center text-white w-full max-w-md">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-white/20 bg-white/15 text-xs font-medium text-white/90">
            구암의료재단 포항시티병원
          </div>
          <div className="w-20 h-20 mb-7 mx-auto rounded-3xl border border-white/20 bg-white/15 flex items-center justify-center text-4xl">
            📋
          </div>
          <h1 className="text-2xl font-extrabold leading-snug mb-3">
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
            <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">⚡ 5문항</span>
            <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">⏱ 1분 이내</span>
            <span className="px-3 py-1 rounded-full border border-white/25 bg-white/10">🔒 익명 보장</span>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="w-full max-w-xs py-4 rounded-2xl bg-white text-[#0F7B6C] font-bold text-base shadow-lg active:scale-95 transition-transform"
          >
            설문 시작하기
          </button>
          <p className="mt-4 text-[13px] text-white/70">탭 한 번으로 간편하게 응답할 수 있어요</p>
          <button
            type="button"
            onClick={() => setShowAdminLogin(true)}
            className="mt-4 text-[13px] text-white/65 underline-offset-2 hover:underline"
          >
            관리자
          </button>

          {showAdminLogin && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <div className="w-full max-w-xs rounded-2xl bg-white p-5 space-y-4 text-left">
                <h2 className="text-base font-semibold text-gray-800 mb-1">관리자 로그인</h2>
                <form onSubmit={handleAdminLogin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
                    <input
                      value={adminId}
                      onChange={(e) => setAdminId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F7B6C]"
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
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F7B6C]"
                      placeholder="비밀번호"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdminLogin(false)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-3 py-2 rounded-lg bg-[#0F7B6C] text-white text-sm font-semibold"
                    >
                      로그인
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    )
  }

  if (step === 'complete') {
    return (
      <main className="relative min-h-screen flex items-center justify-center bg-[#F5F7F6] px-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: p.left,
                bottom: '-10px',
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.borderRadius,
                animation: `confetti-fall ${p.duration} linear ${p.delay} forwards`,
              }}
            />
          ))}
        </div>
        <div className="relative text-center w-full max-w-md">
          <div className="w-24 h-24 mb-7 mx-auto rounded-full bg-[#E6F5F2] flex items-center justify-center text-4xl">
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
            onClick={handleCloseWindow}
            className="px-10 py-3 rounded-xl bg-[#0F7B6C] text-white font-semibold shadow-md active:scale-95 transition-transform"
          >
            닫기
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#F5F7F6]">
      <header className="sticky top-0 z-10 bg-white border-b border-[#E2EBE9] px-5 py-4">
        <div className="flex items-center justify-between mb-2 text-[13px] font-semibold text-[#4A6360]">
          <span>진행률</span>
          <span>
            <span className="text-[#0F7B6C]">{current + 1}</span> / {totalSteps}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#E2EBE9] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#0F7B6C] to-[#12A692] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <section className="flex-1 flex flex-col px-4 pb-6 pt-7">
        <div className="flex-1 flex flex-col w-full max-w-md mx-auto space-y-6">
          {!isInfoStep && currentQuestion && (
            <>
              <span className="inline-flex px-3 py-1 mb-4 text-[13px] font-bold text-[#0F7B6C] bg-[#E6F5F2] rounded-full">
                {currentQuestion.number}
              </span>
              <h2
                className="text-[20px] font-bold text-[#1A2B2A] leading-snug mb-2"
                dangerouslySetInnerHTML={{ __html: currentQuestion.text }}
              />
              <p className="text-sm text-[#4A6360] mb-4">{currentQuestion.sub}</p>

              {currentQuestion.type === 'emoji' && currentQuestion.options && (
                <div className="mt-auto flex gap-2">
                  {currentQuestion.options.map((opt) => {
                    const selected = answers[currentQuestion.id] === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectEmoji(currentQuestion.id, opt.value)}
                        className={`flex-1 flex flex-col items-center justify-center gap-2 px-2 py-4 rounded-2xl border text-xs font-semibold shadow-sm transition-all ${
                          selected
                            ? 'border-[#0F7B6C] bg-[#E6F5F2] shadow-md scale-[1.04]'
                            : 'border-[#E2EBE9] bg-white'
                        }`}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className={selected ? 'text-[#0F7B6C]' : 'text-[#8FA3A0]'}>
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {currentQuestion.type === 'text' && (
                <div className="mt-auto">
                  <textarea
                    value={
                      typeof answers[currentQuestion.id] === 'string'
                        ? (answers[currentQuestion.id] as string)
                        : ''
                    }
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: e.target.value,
                      }))
                    }
                    className="w-full min-h-[140px] px-4 py-4 rounded-2xl border-2 border-[#E2EBE9] bg-white text-[15px] text-[#1A2B2A] shadow-sm outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#0F7B6C]/20 resize-none"
                    placeholder="예: 원장님이 정말 친절하게 설명해 주셔서 좋았어요!"
                  />
                  <p className="mt-2 text-[13px] text-[#8FA3A0] text-center">건너뛰셔도 괜찮아요</p>
                </div>
              )}
            </>
          )}

          {isInfoStep && (
            <div className="space-y-6">
              <span className="inline-flex px-3 py-1 text-[13px] font-bold text-[#0F7B6C] bg-[#E6F5F2] rounded-full">
                추가 정보
              </span>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[#1A2B2A] text-left">
                  성함 (선택)
                </label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[#E2EBE9] bg-white text-[15px] text-[#1A2B2A] shadow-sm outline-none focus:border-[#0F7B6C] focus:ring-2 focus:ring-[#0F7B6C]/20"
                  placeholder="이름을 입력해주세요"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[#1A2B2A] text-left">이용 구분</p>
                <div className="flex flex-wrap gap-2">
                  {PATIENT_TYPES.map((type) => {
                    const selected = patientTypes.includes(type)
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setPatientTypes((prev) =>
                            prev.includes(type)
                              ? prev.filter((t) => t !== type)
                              : [...prev, type],
                          )
                        }
                        className={`px-4 py-2 rounded-2xl text-xs font-semibold border transition-colors ${
                          selected
                            ? 'border-[#0F7B6C] bg-[#E6F5F2] text-[#0F7B6C]'
                            : 'border-[#E2EBE9] bg-white text-[#4A6360]'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-[#1A2B2A] text-left">
                  우리 병원을 어떻게 알고 이용하게 되었나요?
                </p>
                <div className="flex flex-wrap gap-2">
                  {HOW_KNOWN_OPTIONS.map((option) => {
                    const selected = howKnown.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setHowKnown((prev) =>
                            prev.includes(option)
                              ? prev.filter((o) => o !== option)
                              : [...prev, option],
                          )
                        }
                        className={`px-3 py-2 rounded-2xl text-[11px] font-semibold border transition-colors text-left ${
                          selected
                            ? 'border-[#0F7B6C] bg-[#E6F5F2] text-[#0F7B6C]'
                            : 'border-[#E2EBE9] bg-white text-[#4A6360]'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3 w-full max-w-md mx-auto">
          {current > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="px-5 py-3 rounded-xl border border-[#E2EBE9] bg-[#F5F7F6] text-sm font-semibold text-[#4A6360]"
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={submitting || Boolean(emojiDisabled)}
            className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-[#0F7B6C] to-[#12A692] text-white font-bold text-sm shadow-md disabled:bg-[#E2EBE9] disabled:text-[#8FA3A0] disabled:shadow-none"
          >
            {submitting ? '제출 중...' : current === totalSteps - 1 ? '제출하기' : '다음'}
          </button>
        </div>
      </section>
    </main>
  )
}

