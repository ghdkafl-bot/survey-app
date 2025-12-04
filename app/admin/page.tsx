'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Survey,
  QuestionType,
  ClosingMessage,
  PatientInfoConfig,
  PatientInfoQuestion,
  HomepageConfig,
  DEFAULT_PATIENT_INFO_CONFIG,
  DEFAULT_HOMEPAGE_CONFIG,
} from '@/lib/db'

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

const createDefaultPatientInfoConfig = (): PatientInfoConfig => ({
  ...DEFAULT_PATIENT_INFO_CONFIG,
  patientTypeOptions: [...DEFAULT_PATIENT_INFO_CONFIG.patientTypeOptions],
})

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
  required?: boolean
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
  required: false,
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
  const [patientInfoConfig, setPatientInfoConfig] = useState<PatientInfoConfig>(createDefaultPatientInfoConfig())
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(DEFAULT_HOMEPAGE_CONFIG)
  const [loading, setLoading] = useState(false)
  const [exportRanges, setExportRanges] = useState<Record<string, { from: string; to: string }>>({})
  const [purgeRanges, setPurgeRanges] = useState<Record<string, { from: string; to: string }>>({})
  const [latestResponseInfo, setLatestResponseInfo] = useState<Record<string, { latestDate: string; totalCount: number } | null>>({})

  useEffect(() => {
    const authenticated = sessionStorage.getItem('adminAuthenticated')
    if (authenticated === 'true') {
      setIsAuthenticated(true)
      fetchSurveys()
      fetchHomepageConfig()
    }
  }, [])
  
  // 페이지 포커스 시 홈페이지 설정 다시 불러오기 (저장 중이 아닐 때만)
  const [isSaving, setIsSaving] = useState(false)
  
  useEffect(() => {
    if (!isAuthenticated || isSaving) return
    
    const handleFocus = () => {
      console.log('[Admin] Window focused, refreshing homepage config')
      fetchHomepageConfig()
    }
    
    const handleVisibilityChange = () => {
      if (!document.hidden && !isSaving) {
        console.log('[Admin] Page visible, refreshing homepage config')
        fetchHomepageConfig()
      }
    }
    
    // 로컬 스토리지 변경 감지 (다른 탭에서 설정이 업데이트된 경우)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'homepageConfigUpdated' && !isSaving) {
        console.log('[Admin] Detected config update in another tab, refreshing...')
        fetchHomepageConfig()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, isSaving])

  const fetchHomepageConfig = async () => {
    try {
      const timestamp = new Date().getTime()
      const res = await fetch(`/api/homepage-config?t=${timestamp}`, { 
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
      if (!res.ok) throw new Error('Failed to load homepage config')
      const data = await res.json()
      console.log('[Admin] Fetched homepage config:', data)
      
      if (data && data.title && data.description) {
        setHomepageConfig({
          title: data.title.trim(),
          description: data.description.trim(),
        })
        console.log('[Admin] Homepage config state updated')
      } else {
        console.warn('[Admin] Invalid homepage config data:', data)
        setHomepageConfig(DEFAULT_HOMEPAGE_CONFIG)
      }
    } catch (error) {
      console.error('[Admin] Failed to fetch homepage config:', error)
      setHomepageConfig(DEFAULT_HOMEPAGE_CONFIG)
    }
  }

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
    setClosingMessage({ ...DEFAULT_CLOSING_MESSAGE })
    setPatientInfoConfig(createDefaultPatientInfoConfig())
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

    const typeLabel = patientInfoConfig.patientTypeLabel?.trim()
    if (!typeLabel) {
      alert('환자 유형 라벨을 입력해주세요.')
      return
    }

    const typePlaceholder = patientInfoConfig.patientTypePlaceholder?.trim()
    if (!typePlaceholder) {
      alert('환자 유형 선택 안내 문구를 입력해주세요.')
      return
    }

    const nameLabel = patientInfoConfig.patientNameLabel?.trim()
    if (!nameLabel) {
      alert('환자 성함 라벨을 입력해주세요.')
      return
    }

    const namePlaceholder = patientInfoConfig.patientNamePlaceholder?.trim()
    if (!namePlaceholder) {
      alert('환자 성함 입력 안내 문구를 입력해주세요.')
      return
    }

    const sanitizedTypeOptions = patientInfoConfig.patientTypeOptions
      .map((option) => option.trim())
      .filter((option) => option.length > 0)

    if (sanitizedTypeOptions.length === 0) {
      alert('환자 유형 선택지를 하나 이상 입력해주세요.')
      return
    }

    const sanitizedAdditionalQuestions: PatientInfoQuestion[] = (
      patientInfoConfig.additionalQuestions || []
    )
      .map((q) => {
        const sanitizedOptions = q.options
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 0)
        if (!q.text.trim() || sanitizedOptions.length === 0) {
          return null
        }
        return {
          id: q.id || `patient-info-q-${Date.now()}-${Math.random()}`,
          text: q.text.trim(),
          options: sanitizedOptions,
          required: q.required !== undefined ? Boolean(q.required) : false,
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        required: q.required,
      }))

    const sanitizedPatientInfoConfig: PatientInfoConfig = {
      ...patientInfoConfig,
      patientTypeLabel: typeLabel,
      patientTypePlaceholder: typePlaceholder,
      patientTypeOptions: sanitizedTypeOptions,
      patientTypeTextColor: (patientInfoConfig.patientTypeTextColor?.trim() || DEFAULT_PATIENT_INFO_CONFIG.patientTypeTextColor) ?? '#111827',
      patientNameLabel: nameLabel,
      patientNamePlaceholder: namePlaceholder,
      additionalQuestions: sanitizedAdditionalQuestions,
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
            required: typeof question.required === 'boolean' ? question.required : false,
          })),
        })),
        closingMessage,
        patientInfoConfig: sanitizedPatientInfoConfig,
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
      // 엑셀 다운로드 전에 최신 응답 정보 확인
      console.log('[Admin] 🔍 Checking latest responses before export...')
      let latestResponseId = ''
      let expectedTotalCount = 0
      try {
        const responsesRes = await fetch(`/api/responses?surveyId=${surveyId}`, { cache: 'no-store' })
        if (responsesRes.ok) {
          const responses = await responsesRes.json()
          if (responses && responses.length > 0) {
            const latestResponse = responses[0]
            const allDates = responses.map((r: any) => r.submittedAt).sort()
            const latestDate = allDates[allDates.length - 1]
            const oldestDate = allDates[0]
            
            latestResponseId = latestResponse.id
            expectedTotalCount = responses.length
            
            console.log('[Admin] 📊 Latest response info from Supabase:')
            console.log('[Admin]   - Total responses:', responses.length)
            console.log('[Admin]   - Latest response date:', latestDate)
            console.log('[Admin]   - Latest response ID:', latestResponseId)
            console.log('[Admin]   - Oldest response date:', oldestDate)
            console.log('[Admin]   - Latest response details:', {
              id: latestResponse.id,
              submittedAt: latestResponse.submittedAt,
              patientName: latestResponse.patientName,
              patientType: latestResponse.patientType,
              answersCount: latestResponse.answers?.length || 0,
            })
          } else {
            console.warn('[Admin] ⚠️ No responses found in Supabase')
          }
        }
      } catch (err) {
        console.error('[Admin] Failed to fetch latest responses:', err)
      }
      
      // 최신 응답이 있으면 조금 더 기다림 (데이터베이스 커밋 완료 대기)
      if (latestResponseId) {
        console.log('[Admin] ⏳ Waiting 10 seconds for database commit...')
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
      
      const range = exportRanges[surveyId] || { from: '', to: '' }
      const params = new URLSearchParams({ surveyId })
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
      if (latestResponseId) {
        params.set('latestResponseId', latestResponseId)
        params.set('expectedCount', expectedTotalCount.toString())
      }
      
      // 캐시 무효화를 위해 타임스탬프 추가
      params.append('_t', Date.now().toString())
      
      console.log('[Admin] Exporting Excel:', `/api/export?${params.toString()}`)
      
      const res = await fetch(`/api/export?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
      
      console.log('[Admin] Export response status:', res.status, res.statusText)
      console.log('[Admin] Export response headers:', Object.fromEntries(res.headers.entries()))
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('[Admin] Export failed:', errorText)
        throw new Error(`Export failed: ${res.status} ${res.statusText}`)
      }
      
      const blob = await res.blob()
      console.log('[Admin] Export blob size:', blob.size, 'bytes')
      console.log('[Admin] Export blob type:', blob.type)
      
      // 응답 헤더에서 최신 응답 정보 확인 (있다면)
      const latestDateHeader = res.headers.get('X-Latest-Response-Date')
      const totalResponsesHeader = res.headers.get('X-Total-Responses')
      if (latestDateHeader) {
        console.log('[Admin] 📊 Excel file info from server:')
        console.log('[Admin]   - Latest response date in Excel:', latestDateHeader)
        console.log('[Admin]   - Total responses in Excel:', totalResponsesHeader || 'N/A')
      }
      
      if (blob.size === 0) {
        alert('다운로드된 Excel 파일이 비어있습니다. 서버 로그를 확인해주세요.')
        return
      }
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `survey-${surveyId}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('[Admin] ✅ Excel download completed')
      
      // 다운로드 후 다시 한번 최신 응답 확인
      console.log('[Admin] 🔍 Verifying latest responses after export...')
      try {
        const verifyRes = await fetch(`/api/responses?surveyId=${surveyId}`, { cache: 'no-store' })
        if (verifyRes.ok) {
          const verifyResponses = await verifyRes.json()
          if (verifyResponses && verifyResponses.length > 0) {
            const verifyDates = verifyResponses.map((r: any) => r.submittedAt).sort()
            const verifyLatestDate = verifyDates[verifyDates.length - 1]
            console.log('[Admin] 📊 Current latest response date in Supabase:', verifyLatestDate)
            if (latestDateHeader && verifyLatestDate !== latestDateHeader) {
              console.warn('[Admin] ⚠️ Latest date mismatch!')
              console.warn('[Admin]   - In Excel:', latestDateHeader)
              console.warn('[Admin]   - In Supabase:', verifyLatestDate)
            } else {
              console.log('[Admin] ✅ Latest dates match!')
            }
          }
        }
      } catch (err) {
        console.error('[Admin] Failed to verify responses:', err)
      }
    } catch (error) {
      console.error('[Admin] Export error:', error)
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      alert(`엑셀 다운로드에 실패했습니다: ${errorMsg}\n\n브라우저 콘솔을 확인해주세요.`)
    }
  }

  const handleCheckLatestResponse = async (surveyId: string) => {
    try {
      console.log('[Admin] 🔍 Checking latest responses for survey:', surveyId)
      const res = await fetch(`/api/responses?surveyId=${surveyId}`, { cache: 'no-store' })
      
      if (!res.ok) {
        throw new Error(`Failed to fetch responses: ${res.status}`)
      }
      
      const responses = await res.json()
      
      if (responses && responses.length > 0) {
        const allDates = responses.map((r: any) => r.submittedAt).sort()
        const latestDate = allDates[allDates.length - 1]
        const latestResponse = responses.find((r: any) => r.submittedAt === latestDate) || responses[0]
        
        const info = {
          latestDate: latestDate,
          totalCount: responses.length,
        }
        
        setLatestResponseInfo(prev => ({ ...prev, [surveyId]: info }))
        
        // 브라우저 콘솔에도 로그 출력
        console.log('[Admin] 📊 Latest response info:', {
          latestDate,
          totalCount: responses.length,
          latestResponse: {
            id: latestResponse.id,
            submittedAt: latestResponse.submittedAt,
            patientName: latestResponse.patientName,
            patientType: latestResponse.patientType,
          },
        })
        
        // 알림 표시
        const dateStr = new Date(latestDate).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        alert(`최신 응답 정보:\n\n` +
              `총 응답 수: ${responses.length}개\n` +
              `최신 응답 일시: ${dateStr}\n` +
              `최신 응답 환자: ${latestResponse.patientName || 'N/A'}\n` +
              `최신 응답 유형: ${latestResponse.patientType || 'N/A'}`)
      } else {
        setLatestResponseInfo(prev => ({ ...prev, [surveyId]: null }))
        alert('아직 등록된 응답이 없습니다.')
      }
    } catch (error) {
      console.error('[Admin] Failed to check latest response:', error)
      alert('최신 응답 확인에 실패했습니다. 브라우저 콘솔을 확인해주세요.')
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

  const handleCheckData = async () => {
    try {
      const res = await fetch('/api/admin/check-data')
      if (!res.ok) {
        throw new Error('Failed to check data')
      }
      const data = await res.json()
      
      if (data.success) {
        const stats = data.data
        const message = [
          `📊 데이터베이스 상태`,
          '',
          `총 설문 수: ${stats.totalSurveys}개`,
          `총 응답 수: ${stats.totalResponses}개`,
          `총 답변 수: ${stats.totalAnswers}개`,
          `추정 저장 공간: ${stats.estimatedSizeMB} MB`,
          '',
          ...stats.surveys.map((s: any) => 
            `• ${s.surveyTitle}: ${s.responseCount}개 응답`
          ),
          '',
          stats.summary.warning || '✅ 저장 공간 사용량이 정상입니다.',
        ].join('\n')
        
        alert(message)
      } else {
        alert(`데이터 확인 실패: ${data.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('Check data error:', error)
      alert('데이터 확인에 실패했습니다.')
    }
  }

  const updatePatientTypeOption = (index: number, value: string) => {
    setPatientInfoConfig((prev) => {
      const nextOptions = [...prev.patientTypeOptions]
      nextOptions[index] = value
      return {
        ...prev,
        patientTypeOptions: nextOptions,
      }
    })
  }

  const addPatientTypeOption = () => {
    setPatientInfoConfig((prev) => ({
      ...prev,
      patientTypeOptions: [...prev.patientTypeOptions, ''],
    }))
  }

  const removePatientTypeOption = (index: number) => {
    setPatientInfoConfig((prev) => ({
      ...prev,
      patientTypeOptions: prev.patientTypeOptions.filter((_, i) => i !== index),
    }))
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
    setPatientInfoConfig({
      ...DEFAULT_PATIENT_INFO_CONFIG,
      ...survey.patientInfoConfig,
      patientTypeOptions:
        survey.patientInfoConfig?.patientTypeOptions?.length
          ? [...survey.patientInfoConfig.patientTypeOptions]
          : [...DEFAULT_PATIENT_INFO_CONFIG.patientTypeOptions],
      additionalQuestions:
        survey.patientInfoConfig?.additionalQuestions?.length
          ? survey.patientInfoConfig.additionalQuestions.map((q) => ({
              id: q.id,
              text: q.text,
              options: [...q.options],
              required: q.required || false,
            }))
          : [],
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
          required: question.required || false,
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
              <button
                onClick={handleCheckData}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                type="button"
              >
                데이터 상태 확인
              </button>
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

              <section className="space-y-5 border border-emerald-200 rounded-xl bg-white p-5">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800">환자 정보 설정</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 유형 라벨 *</label>
                    <input
                      value={patientInfoConfig.patientTypeLabel}
                      onChange={(e) =>
                        setPatientInfoConfig((prev) => ({ ...prev, patientTypeLabel: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: 환자 유형"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 유형 안내 문구 *</label>
                    <input
                      value={patientInfoConfig.patientTypePlaceholder}
                      onChange={(e) =>
                        setPatientInfoConfig((prev) => ({ ...prev, patientTypePlaceholder: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: 환자 유형을 선택하세요"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 유형 텍스트 색상</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={patientInfoConfig.patientTypeTextColor || '#111827'}
                        onChange={(e) =>
                          setPatientInfoConfig((prev) => ({ ...prev, patientTypeTextColor: e.target.value }))
                        }
                        className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        value={patientInfoConfig.patientTypeTextColor || '#111827'}
                        onChange={(e) =>
                          setPatientInfoConfig((prev) => ({ ...prev, patientTypeTextColor: e.target.value }))
                        }
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="#111827"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 유형 필수 여부</label>
                    <button
                      type="button"
                      onClick={() =>
                        setPatientInfoConfig((prev) => ({
                          ...prev,
                          patientTypeRequired: !prev.patientTypeRequired,
                        }))
                      }
                      className={`w-full px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        patientInfoConfig.patientTypeRequired
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {patientInfoConfig.patientTypeRequired ? '필수로 설정됨' : '선택 사항'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">환자 유형 선택지 *</label>
                  <div className="space-y-2">
                    {patientInfoConfig.patientTypeOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={option}
                          onChange={(e) => updatePatientTypeOption(index, e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`선택지 ${index + 1}`}
                        />
                        {patientInfoConfig.patientTypeOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePatientTypeOption(index)}
                            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addPatientTypeOption}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm"
                    >
                      + 선택지 추가
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 성함 라벨 *</label>
                    <input
                      value={patientInfoConfig.patientNameLabel}
                      onChange={(e) =>
                        setPatientInfoConfig((prev) => ({ ...prev, patientNameLabel: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: 환자 성함"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 성함 안내 문구 *</label>
                    <input
                      value={patientInfoConfig.patientNamePlaceholder}
                      onChange={(e) =>
                        setPatientInfoConfig((prev) => ({ ...prev, patientNamePlaceholder: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="예: 환자성함을 입력하세요 (선택사항)"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">환자 성함 필수 여부</label>
                    <button
                      type="button"
                      onClick={() =>
                        setPatientInfoConfig((prev) => ({
                          ...prev,
                          patientNameRequired: !prev.patientNameRequired,
                        }))
                      }
                      className={`w-full px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                        patientInfoConfig.patientNameRequired
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {patientInfoConfig.patientNameRequired ? '필수로 설정됨' : '선택 사항'}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-semibold text-gray-800">추가 질문 (토글 형식)</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setPatientInfoConfig((prev) => ({
                          ...prev,
                          additionalQuestions: [
                            ...(prev.additionalQuestions || []),
                            {
                              id: `patient-info-q-${Date.now()}`,
                              text: '',
                              options: [''],
                              required: false,
                            },
                          ],
                        }))
                      }}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                    >
                      + 질문 추가
                    </button>
                  </div>
                  <div className="space-y-4">
                    {patientInfoConfig.additionalQuestions?.map((question, qIdx) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 space-y-2">
                            <input
                              value={question.text}
                              onChange={(e) => {
                                setPatientInfoConfig((prev) => {
                                  const next = { ...prev }
                                  const questions = [...(next.additionalQuestions || [])]
                                  questions[qIdx] = { ...questions[qIdx], text: e.target.value }
                                  next.additionalQuestions = questions
                                  return next
                                })
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="질문 내용을 입력하세요"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPatientInfoConfig((prev) => {
                                    const next = { ...prev }
                                    const questions = [...(next.additionalQuestions || [])]
                                    questions[qIdx] = {
                                      ...questions[qIdx],
                                      required: !questions[qIdx].required,
                                    }
                                    next.additionalQuestions = questions
                                    return next
                                  })
                                }}
                                className={`px-3 py-1 rounded text-xs font-medium ${
                                  question.required
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {question.required ? '필수' : '선택'}
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPatientInfoConfig((prev) => {
                                const next = { ...prev }
                                next.additionalQuestions = (next.additionalQuestions || []).filter(
                                  (_, idx) => idx !== qIdx
                                )
                                return next
                              })
                            }}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
                          >
                            삭제
                          </button>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-600">답변 옵션</label>
                          {question.options.map((option, optIdx) => (
                            <div key={optIdx} className="flex gap-2">
                              <input
                                value={option}
                                onChange={(e) => {
                                  setPatientInfoConfig((prev) => {
                                    const next = { ...prev }
                                    const questions = [...(next.additionalQuestions || [])]
                                    const options = [...questions[qIdx].options]
                                    options[optIdx] = e.target.value
                                    questions[qIdx] = { ...questions[qIdx], options }
                                    next.additionalQuestions = questions
                                    return next
                                  })
                                }}
                                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                                placeholder={`옵션 ${optIdx + 1}`}
                              />
                              {question.options.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPatientInfoConfig((prev) => {
                                      const next = { ...prev }
                                      const questions = [...(next.additionalQuestions || [])]
                                      const options = questions[qIdx].options.filter((_, idx) => idx !== optIdx)
                                      questions[qIdx] = { ...questions[qIdx], options }
                                      next.additionalQuestions = questions
                                      return next
                                    })
                                  }}
                                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setPatientInfoConfig((prev) => {
                                const next = { ...prev }
                                const questions = [...(next.additionalQuestions || [])]
                                const options = [...questions[qIdx].options, '']
                                questions[qIdx] = { ...questions[qIdx], options }
                                next.additionalQuestions = questions
                                return next
                              })
                            }}
                            className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs"
                          >
                            + 옵션 추가
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!patientInfoConfig.additionalQuestions || patientInfoConfig.additionalQuestions.length === 0) && (
                      <p className="text-sm text-gray-500 text-center py-4">추가 질문이 없습니다. 위의 "+ 질문 추가" 버튼을 클릭하여 추가하세요.</p>
                    )}
                  </div>
                </div>
              </section>

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
                              <button
                                type="button"
                                onClick={() =>
                                  setQuestionGroups((prev) => {
                                    const next = [...prev]
                                    const group = next[groupIndex]
                                    const questions = [...group.questions]
                                    questions[questionIndex] = {
                                      ...questions[questionIndex],
                                      required: !questions[questionIndex].required,
                                    }
                                    group.questions = questions
                                    return next
                                  })
                                }
                                className={`px-4 py-2 rounded-lg text-sm font-medium border ${question.required ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                              >
                                {question.required ? '필수' : '선택'}
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

          <section className="mb-10 space-y-4 border border-gray-200 rounded-xl bg-white p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">홈페이지 설정</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">홈페이지 제목 *</label>
                <input
                  value={homepageConfig.title}
                  onChange={(e) => setHomepageConfig((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 퇴원환자 친절도 설문"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">홈페이지 설명 *</label>
                <textarea
                  value={homepageConfig.description}
                  onChange={(e) => setHomepageConfig((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="예: 환자 만족도 조사를 위한 설문 시스템입니다. 참여를 통해 더 나은 서비스를 만들어주세요."
                  required
                />
              </div>
              <button
                onClick={async () => {
                  if (!homepageConfig.title.trim() || !homepageConfig.description.trim()) {
                    alert('제목과 설명을 모두 입력해주세요.')
                    return
                  }
                  
                  if (isSaving) {
                    console.log('[Admin] Already saving, ignoring duplicate request')
                    return
                  }
                  
                  const titleToSave = homepageConfig.title.trim()
                  const descriptionToSave = homepageConfig.description.trim()
                  
                  console.log('[Admin] Saving homepage config:', { title: titleToSave, description: descriptionToSave })
                  
                  setIsSaving(true)
                  
                  try {
                    // 캐시 무효화를 위해 timestamp 추가
                    const timestamp = new Date().getTime()
                    const res = await fetch(`/api/homepage-config?t=${timestamp}`, {
                      method: 'PUT',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                      },
                      cache: 'no-store',
                      body: JSON.stringify({
                        title: titleToSave,
                        description: descriptionToSave,
                      }),
                    })
                    
                    const responseData = await res.json()
                    console.log('[Admin] API response:', { status: res.status, ok: res.ok, data: responseData })
                    
                    if (!res.ok) {
                      const errorMsg = responseData.details || responseData.error || '알 수 없는 오류'
                      console.error('[Admin] API error:', errorMsg)
                      alert(`홈페이지 설정 저장에 실패했습니다: ${errorMsg}\n\n브라우저 콘솔을 확인해주세요.`)
                      return
                    }
                    
                    console.log('[Admin] Config saved successfully:', responseData)
                    
                    // 저장된 데이터로 상태 즉시 업데이트 (입력한 값 우선 사용)
                    // API 응답이 올바르지 않을 수 있으므로 입력한 값을 직접 사용
                    const updatedConfig = {
                      title: titleToSave,
                      description: descriptionToSave,
                    }
                    setHomepageConfig(updatedConfig)
                    console.log('[Admin] State updated immediately with input values:', updatedConfig)
                    
                    // API 응답도 확인하여 로그만 남김 (상태는 덮어쓰지 않음)
                    if (responseData && responseData.title && responseData.description) {
                      const apiConfig = {
                        title: responseData.title.trim(),
                        description: responseData.description.trim(),
                      }
                      console.log('[Admin] API response config:', apiConfig)
                      
                      // API 응답과 입력값이 다르면 경고
                      if (apiConfig.title !== titleToSave || apiConfig.description !== descriptionToSave) {
                        console.warn('[Admin] ⚠️ API response differs from input values!', {
                          input: { title: titleToSave, description: descriptionToSave },
                          api: apiConfig,
                        })
                        // API 응답이 다르면 API 응답으로 업데이트 (서버에 저장된 값이 정확할 수 있음)
                        setHomepageConfig(apiConfig)
                        console.log('[Admin] State updated with API response (different from input)')
                      }
                    }
                    
                    alert('홈페이지 설정이 저장되었습니다.')
                    
                    // 홈페이지가 열려있다면 강제로 새로고침하도록 메시지 전송
                    if (window.opener) {
                      window.opener.postMessage({ type: 'HOMEPAGE_CONFIG_UPDATED' }, '*')
                    }
                    
                    // 로컬 스토리지에 저장 시간 기록 (다른 탭에서 감지 가능)
                    localStorage.setItem('homepageConfigUpdated', new Date().getTime().toString())
                  } catch (error) {
                    console.error('[Admin] Failed to update homepage config:', error)
                    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
                    alert(`홈페이지 설정 저장에 실패했습니다: ${errorMsg}\n\n브라우저 콘솔을 확인해주세요.`)
                  } finally {
                    // 저장 완료 후 잠시 대기 후 isSaving 해제 (다른 이벤트가 상태를 덮어쓰지 않도록)
                    setTimeout(() => {
                      setIsSaving(false)
                      console.log('[Admin] Saving flag cleared')
                    }, 2000) // 2초 후 해제
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                홈페이지 설정 저장
              </button>
            </div>
          </section>

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
                        <button
                          onClick={() => handleCheckLatestResponse(survey.id)}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm w-full sm:w-auto"
                        >
                          최신 응답 확인
                        </button>
                      </div>
                      {latestResponseInfo[survey.id] && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <p className="font-semibold text-blue-800">📊 최신 응답 정보</p>
                          <p className="text-blue-700 mt-1">
                            총 응답 수: <strong>{latestResponseInfo[survey.id]?.totalCount}</strong>개
                          </p>
                          <p className="text-blue-700">
                            최신 응답 일시: <strong>
                              {latestResponseInfo[survey.id]?.latestDate 
                                ? new Date(latestResponseInfo[survey.id]!.latestDate).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                                : 'N/A'}
                            </strong>
                          </p>
                        </div>
                      )}
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

