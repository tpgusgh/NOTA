import { PointerEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeFeedback, analyzeFeedbackWithImage, askFollowup } from '../api/feedback'
import { generateNote } from '../api/note'
import { analyzeOcr, extractOcrText } from '../api/ocr'
import { getSessionInfo, saveBoardState, clearBoardState, startClass, stopClass, startShare, stopShare, generateSectionSummary, deleteSession } from '../api/session'
import { saveStt } from '../api/stt'
import { getStoredSessionId, getStoredUserRole, setStoredFeedbackResult, clearSession, removeJoinedSession, UserRole } from '../utils/session'
import type { SessionInfoResponse, SectionListItem } from '../api/session'

const BOARD_WIDTH = 960
const BOARD_HEIGHT = 560
const BOARD_SAVE_DELAY_MS = 500
const OCR_IDLE_DELAY_MS = 60000
const OCR_COOLDOWN_MS = 60000
const SESSION_POLL_MS = 3000

type BoardPoint = {
  x: number
  y: number
}

function Classroom() {
  const navigate = useNavigate()
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const studentDrawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPointRef = useRef<BoardPoint | null>(null)
  const studentLastPointRef = useRef<BoardPoint | null>(null)
  const isDrawingRef = useRef(false)
  const isStudentDrawingRef = useRef(false)
  const boardSaveTimerRef = useRef<number | null>(null)
  const boardOcrTimerRef = useRef<number | null>(null)
  const sessionPollTimerRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const shouldKeepRecognizingRef = useRef(false)
  const appliedBoardVersionRef = useRef<string | null>(null)
  const hasLocalBoardChangesRef = useRef(false)
  const nextOcrAllowedAtRef = useRef(0)
  const previousClassActiveRef = useRef(false)
  const hasStudentBoardInkRef = useRef(false)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)
  const [status, setStatus] = useState('')
  const [speechActive, setSpeechActive] = useState(false)
  const [speechText, setSpeechText] = useState('')
  const [manualSpeechText, setManualSpeechText] = useState('')
  const [isSavingBoard, setIsSavingBoard] = useState(false)
  const [isRunningOcr, setIsRunningOcr] = useState(false)
  const [studentNote, setStudentNote] = useState('')
  const [feedback, setFeedback] = useState({ missing: '', suggestions: '', positives: '' })
  const [followupQuestion, setFollowupQuestion] = useState('')
  const [followupAnswer, setFollowupAnswer] = useState('')
  const [penColor, setPenColor] = useState('#0f172a')
  const [isEraser, setIsEraser] = useState(false)
  const [penSize, setPenSize] = useState(4)
  const [studentPenColor, setStudentPenColor] = useState('#0f172a')
  const [studentIsEraser, setStudentIsEraser] = useState(false)
  const [studentPenSize, setStudentPenSize] = useState(4)
  // 수업 종료 / 피드백 모달
  const [showEndModal, setShowEndModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackModalSectionIndex, setFeedbackModalSectionIndex] = useState<number | null>(null)
  const [feedbackModalNote, setFeedbackModalNote] = useState('')
  const [feedbackModalPhoto, setFeedbackModalPhoto] = useState<string | null>(null)
  const [feedbackModalPhotoName, setFeedbackModalPhotoName] = useState('')
  const [feedbackModalResult, setFeedbackModalResult] = useState<{ missing: string; suggestions: string; positives: string } | null>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  // 섹션 요약
  const [sectionSummaries, setSectionSummaries] = useState<Record<number, string>>({})
  const [loadingSummaryIndex, setLoadingSummaryIndex] = useState<number | null>(null)
  const [expandedSectionIndex, setExpandedSectionIndex] = useState<number | null>(null)
  const isTeacher = userRole === 'teacher'
  const isClassActive = sessionInfo?.is_class_active ?? false
  const isBoardShared = sessionInfo?.is_board_shared ?? false
  const canDrawSharedBoard = isTeacher && isClassActive
  const canViewSharedBoard = isTeacher || (isClassActive && isBoardShared)
  const canUseStudentBoard = !isTeacher && isClassActive

  useEffect(() => {
    const storedSessionId = getStoredSessionId()
    const storedRole = getStoredUserRole()
    setSessionId(storedSessionId)
    setUserRole(storedRole)

    if (!storedSessionId || !storedRole) {
      navigate('/')
      return
    }

    initializeBoard()
    initializeStudentBoard()
    void refreshSessionData(storedSessionId, true)
    sessionPollTimerRef.current = window.setInterval(() => {
      void refreshSessionData(storedSessionId, true)
    }, SESSION_POLL_MS)

    return () => {
      stopBoardTimers()
      stopSessionPolling()
      stopSpeechRecognition()
    }
  }, [navigate])

  useEffect(() => {
    const wasClassActive = previousClassActiveRef.current
    if (!isTeacher && wasClassActive && !isClassActive) {
      void handleRunEndOfClassComparison()
    }
    previousClassActiveRef.current = isClassActive
  }, [isClassActive, isTeacher])

  const appendLog = (message: string) => {
    setStatus(`${new Date().toLocaleTimeString()} - ${message}`)
  }

  const ensureClassActive = () => {
    if (!isClassActive) {
      appendLog('수업 시작 버튼을 눌러야 기능이 동작합니다.')
      return false
    }
    return true
  }

  const ensureBoardAvailable = () => {
    if (!ensureClassActive()) {
      return false
    }
    if (!canViewSharedBoard) {
      appendLog('교사가 공유를 시작해야 학생 화면에서 전자칠판을 사용할 수 있습니다.')
      return false
    }
    return true
  }

  const stopBoardTimers = () => {
    if (boardSaveTimerRef.current !== null) {
      window.clearTimeout(boardSaveTimerRef.current)
      boardSaveTimerRef.current = null
    }
    if (boardOcrTimerRef.current !== null) {
      window.clearTimeout(boardOcrTimerRef.current)
      boardOcrTimerRef.current = null
    }
  }

  const stopSessionPolling = () => {
    if (sessionPollTimerRef.current !== null) {
      window.clearInterval(sessionPollTimerRef.current)
      sessionPollTimerRef.current = null
    }
  }

  const getBoardContext = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  const paintBoardBackground = () => {
    const ctx = getBoardContext()
    const canvas = drawCanvasRef.current
    if (!ctx || !canvas) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const initializeBoard = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return

    canvas.width = BOARD_WIDTH
    canvas.height = BOARD_HEIGHT

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    paintBoardBackground()
  }

  const clearBoardCanvas = () => {
    const ctx = getBoardContext()
    const canvas = drawCanvasRef.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    paintBoardBackground()
  }

  const initializeStudentBoard = () => {
    const canvas = studentDrawCanvasRef.current
    if (!canvas) return

    canvas.width = BOARD_WIDTH
    canvas.height = BOARD_HEIGHT

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = penColor
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const clearStudentBoardCanvas = () => {
    const canvas = studentDrawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasStudentBoardInkRef.current = false
  }

  const applyBoardImage = (boardDataUrl: string | null | undefined, boardVersion?: string | null) => {
    const canvas = drawCanvasRef.current
    const ctx = getBoardContext()
    if (!canvas || !ctx) return

    if (!boardDataUrl) {
      clearBoardCanvas()
      appliedBoardVersionRef.current = boardVersion ?? null
      return
    }

    const image = new Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      paintBoardBackground()
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      appliedBoardVersionRef.current = boardVersion ?? boardDataUrl
    }
    image.src = boardDataUrl
  }

  const refreshSessionData = async (targetSessionId: string, silent = false) => {
    try {
      const info = await getSessionInfo(targetSessionId)
      setSessionInfo(info)
      setSpeechText(info.stt_history.join('\n'))

      if (!isTeacher && !info.is_board_shared) {
        clearBoardCanvas()
        appliedBoardVersionRef.current = info.board_updated_at ?? null
        return
      }

      if (!isDrawingRef.current && !hasLocalBoardChangesRef.current) {
        const remoteBoardVersion = info.board_updated_at ?? info.board_data_url ?? null
        if (remoteBoardVersion !== appliedBoardVersionRef.current) {
          applyBoardImage(info.board_data_url, remoteBoardVersion)
        }
      }
    } catch {
      if (!silent) {
        appendLog('세션 정보를 불러오는 중 오류가 발생했습니다.')
      }
    }
  }

  const getBoardDataUrl = () => {
    const canvas = drawCanvasRef.current
    return canvas ? canvas.toDataURL('image/png') : null
  }

  const persistBoardSnapshot = async (triggerOcr = false) => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!ensureBoardAvailable()) {
      return
    }

    const boardDataUrl = getBoardDataUrl()
    if (!boardDataUrl) {
      appendLog('전자칠판 이미지를 읽을 수 없습니다.')
      return
    }

    try {
      setIsSavingBoard(true)
      const result = await saveBoardState(sessionId, boardDataUrl)
      hasLocalBoardChangesRef.current = false
      appliedBoardVersionRef.current = result.board_updated_at ?? boardDataUrl
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              board_data_url: boardDataUrl,
              board_updated_at: result.board_updated_at ?? current.board_updated_at,
            }
          : current,
      )

      if (triggerOcr) {
        await runBoardOcr(boardDataUrl)
      }
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '전자칠판 저장에 실패했습니다.')
    } finally {
      setIsSavingBoard(false)
    }
  }

  const scheduleBoardPersistence = () => {
    hasLocalBoardChangesRef.current = true

    if (boardSaveTimerRef.current !== null) {
      window.clearTimeout(boardSaveTimerRef.current)
    }
    boardSaveTimerRef.current = window.setTimeout(() => {
      void persistBoardSnapshot(false)
    }, BOARD_SAVE_DELAY_MS)

    if (boardOcrTimerRef.current !== null) {
      window.clearTimeout(boardOcrTimerRef.current)
    }
    boardOcrTimerRef.current = window.setTimeout(() => {
      void persistBoardSnapshot(true)
    }, OCR_IDLE_DELAY_MS)
  }

  const runBoardOcr = async (boardDataUrl?: string | null) => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!ensureBoardAvailable()) {
      return
    }

    const now = Date.now()
    if (now < nextOcrAllowedAtRef.current) {
      const remainingSeconds = Math.max(1, Math.ceil((nextOcrAllowedAtRef.current - now) / 1000))
      appendLog(`OCR 요청이 많습니다. ${remainingSeconds}초 후 다시 시도해주세요.`)
      return
    }

    const imageBase64 = (boardDataUrl ?? getBoardDataUrl())?.split(',')[1]
    if (!imageBase64) {
      appendLog('OCR 분석용 전자칠판 이미지가 없습니다.')
      return
    }

    try {
      setIsRunningOcr(true)
      const result = await analyzeOcr({ image_base64: imageBase64, session_id: sessionId })
      nextOcrAllowedAtRef.current = Date.now() + OCR_COOLDOWN_MS
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              latest_ocr_text: result.text,
              ocr_history:
                current.ocr_history[current.ocr_history.length - 1] === result.text
                  ? current.ocr_history
                  : [...current.ocr_history, result.text],
            }
          : current,
      )
      appendLog('전자칠판 OCR이 저장되었습니다.')
    } catch (error) {
      const message = error instanceof Error ? error.message : '전자칠판 OCR 분석에 실패했습니다.'
      const retryMatch = message.match(/([0-9]+)초 후 다시 시도/)
      if (retryMatch) {
        nextOcrAllowedAtRef.current = Date.now() + Number(retryMatch[1]) * 1000
      }
      appendLog(message)
    } finally {
      setIsRunningOcr(false)
    }
  }

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const drawDot = (point: BoardPoint) => {
    const ctx = getBoardContext()
    if (!ctx) return
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : penColor
    ctx.beginPath()
    ctx.arc(point.x, point.y, (isEraser ? penSize * 3 : penSize) / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canDrawSharedBoard) {
      return
    }
    if (!ensureBoardAvailable()) {
      return
    }
    const point = getCanvasPoint(event)
    if (!point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    isDrawingRef.current = true
    lastPointRef.current = point
    drawDot(point)
    scheduleBoardPersistence()
  }

  const drawMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current) return

    const point = getCanvasPoint(event)
    const ctx = getBoardContext()
    if (!point || !ctx) return

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : penColor
    ctx.lineWidth = isEraser ? penSize * 3 : penSize
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()

    lastPointRef.current = point
    scheduleBoardPersistence()
  }

  const endDrawing = (event?: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return
    }
    if (event) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors when the pointer is already detached.
      }
    }
    isDrawingRef.current = false
    lastPointRef.current = null
    scheduleBoardPersistence()
  }

  const handleClearBoard = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!ensureBoardAvailable()) {
      return
    }

    stopBoardTimers()
    clearBoardCanvas()
    hasLocalBoardChangesRef.current = false

    try {
      const result = await clearBoardState(sessionId)
      appliedBoardVersionRef.current = result.board_updated_at ?? null
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              board_data_url: null,
              board_updated_at: result.board_updated_at ?? current.board_updated_at,
              latest_ocr_text: null,
            }
          : current,
      )
      appendLog('전자칠판을 초기화했습니다.')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '전자칠판 초기화에 실패했습니다.')
    }
  }

  const getStudentCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = studentDrawCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const getStudentBoardDataUrl = () => {
    const canvas = studentDrawCanvasRef.current
    return canvas ? canvas.toDataURL('image/png') : null
  }

  const drawStudentDot = (point: BoardPoint) => {
    const canvas = studentDrawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.globalCompositeOperation = studentIsEraser ? 'destination-out' : 'source-over'
    ctx.fillStyle = studentIsEraser ? 'rgba(0,0,0,1)' : studentPenColor
    ctx.beginPath()
    ctx.arc(point.x, point.y, (studentIsEraser ? studentPenSize * 3 : studentPenSize) / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const startStudentDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canUseStudentBoard) {
      return
    }
    const point = getStudentCanvasPoint(event)
    if (!point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    isStudentDrawingRef.current = true
    studentLastPointRef.current = point
    hasStudentBoardInkRef.current = true
    drawStudentDot(point)
  }

  const moveStudentDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isStudentDrawingRef.current || !studentLastPointRef.current) return
    const point = getStudentCanvasPoint(event)
    const canvas = studentDrawCanvasRef.current
    if (!point || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = studentIsEraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = studentIsEraser ? 'rgba(0,0,0,1)' : studentPenColor
    ctx.lineWidth = studentIsEraser ? studentPenSize * 3 : studentPenSize
    ctx.beginPath()
    ctx.moveTo(studentLastPointRef.current.x, studentLastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    studentLastPointRef.current = point
  }

  const endStudentDrawing = (event?: PointerEvent<HTMLCanvasElement>) => {
    if (!isStudentDrawingRef.current) return
    if (event) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore release errors when the pointer is already detached.
      }
    }
    isStudentDrawingRef.current = false
    studentLastPointRef.current = null
  }

  const persistSpeechSegment = async (text: string) => {
    if (!sessionId || !text.trim()) return
    if (!ensureClassActive()) return

    try {
      await saveStt({ text: text.trim(), session_id: sessionId })
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              stt_history: [...current.stt_history, text.trim()],
            }
          : current,
      )
      setSpeechText((current) => [current, text.trim()].filter(Boolean).join('\n'))
      appendLog('음성 텍스트가 저장되었습니다.')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '음성 텍스트 저장에 실패했습니다.')
    }
  }

  const stopSpeechRecognition = () => {
    shouldKeepRecognizingRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setSpeechActive(false)
  }

  const startSpeechRecognition = (skipActiveCheck = false) => {
    if (!skipActiveCheck && !ensureClassActive()) {
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      appendLog('이 브라우저는 음성 인식을 지원하지 않습니다. 아래 수동 입력을 사용하세요.')
      return
    }

    shouldKeepRecognizingRef.current = true
    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript.trim()) {
        void persistSpeechSegment(finalTranscript)
      } else if (interimTranscript.trim()) {
        setSpeechText((sessionInfo?.stt_history.join('\n') ? `${sessionInfo.stt_history.join('\n')}\n` : '') + interimTranscript.trim())
      }
    }

    recognition.onerror = (event: any) => {
      const code = event?.error
      const message =
        code === 'not-allowed'
          ? '마이크 권한이 차단되었습니다.'
          : code === 'no-speech'
            ? '음성이 감지되지 않았습니다.'
            : code === 'audio-capture'
              ? '마이크를 사용할 수 없습니다.'
              : '음성 인식 중 오류가 발생했습니다.'
      appendLog(message)
    }

    recognition.onend = () => {
      if (shouldKeepRecognizingRef.current) {
        recognition.start()
        return
      }
      recognitionRef.current = null
      setSpeechActive(false)
      setSpeechText((current) => current.trim())
    }

    recognition.start()
    recognitionRef.current = recognition
    setSpeechActive(true)
    appendLog('음성 인식을 시작했습니다.')
  }

  const toggleSpeechRecognition = () => {
    if (speechActive) {
      stopSpeechRecognition()
      appendLog('음성 인식을 중지했습니다.')
      return
    }

    startSpeechRecognition()
  }

  const handleSaveManualSpeech = async () => {
    if (!manualSpeechText.trim()) {
      appendLog('저장할 음성 텍스트를 입력해주세요.')
      return
    }

    await persistSpeechSegment(manualSpeechText)
    setManualSpeechText('')
  }

  const generateSummary = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!ensureClassActive()) {
      return
    }

    setStatus('요약을 생성하는 중입니다...')
    try {
      const result = await generateNote({ session_id: sessionId })
      setSessionInfo((current) => (current ? { ...current, generated_note: result.note } : current))
      appendLog('수업 요약이 생성되었습니다.')
    } catch {
      appendLog('수업 요약 생성에 실패했습니다.')
    }
  }

  const handleAnalyzeFeedback = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!studentNote.trim()) {
      appendLog('학생 필기를 입력해주세요.')
      return
    }

    setStatus('학생 필기와 교사 필기를 비교하는 중입니다...')
    try {
      const result = await analyzeFeedback({ session_id: sessionId, student_note: studentNote })
      setFeedback({ missing: result.missing, suggestions: result.suggestions, positives: result.positives })
      appendLog('피드백이 생성되었습니다.')
    } catch {
      appendLog('피드백 생성에 실패했습니다.')
    }
  }

  const buildStudentComparisonNote = async () => {
    const noteParts: string[] = []

    if (studentNote.trim()) {
      noteParts.push(`학생 메모 텍스트:\n${studentNote.trim()}`)
    }

    if (hasStudentBoardInkRef.current) {
      const boardBase64 = getStudentBoardDataUrl()?.split(',')[1]
      if (boardBase64) {
        const boardText = await extractOcrText(boardBase64)
        if (boardText.text.trim()) {
          noteParts.push(`학생 개인 전자칠판 필기:\n${boardText.text.trim()}`)
        }
      }
    }

    return noteParts.join('\n\n').trim()
  }

  const handleRunEndOfClassComparison = () => {
    // 학생 필기 메모 사전 채워두기
    setFeedbackModalNote(studentNote)
    setFeedbackModalSectionIndex(null)
    setFeedbackModalResult(null)
    setFeedbackModalPhoto(null)
    setFeedbackModalPhotoName('')
    setShowEndModal(true)
  }

  const handleOpenSectionFeedback = (sectionIndex: number) => {
    setFeedbackModalNote(studentNote)
    setFeedbackModalSectionIndex(sectionIndex)
    setFeedbackModalResult(null)
    setFeedbackModalPhoto(null)
    setFeedbackModalPhotoName('')
    setShowFeedbackModal(true)
  }

  const handleFeedbackPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFeedbackModalPhotoName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        // strip data URL prefix, keep raw base64
        const base64 = result.split(',')[1] ?? result
        setFeedbackModalPhoto(base64)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitModalFeedback = async () => {
    if (!sessionId) return
    setIsSubmittingFeedback(true)
    try {
      const result = await analyzeFeedbackWithImage({
        session_id: sessionId,
        student_note: feedbackModalNote,
        image_base64: feedbackModalPhoto ?? undefined,
        section_index: feedbackModalSectionIndex ?? undefined,
      })
      setFeedbackModalResult({ missing: result.missing, suggestions: result.suggestions, positives: result.positives })
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '피드백 분석에 실패했습니다.')
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  const handleGenerateSectionSummary = async (section: SectionListItem) => {
    if (!sessionId) return
    if (sectionSummaries[section.index] !== undefined) {
      setExpandedSectionIndex(section.index)
      return
    }
    setLoadingSummaryIndex(section.index)
    try {
      const result = await generateSectionSummary(sessionId, section.index)
      setSectionSummaries((prev) => ({ ...prev, [section.index]: result.note }))
      setExpandedSectionIndex(section.index)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '수업 요약 생성에 실패했습니다.')
    } finally {
      setLoadingSummaryIndex(null)
    }
  }

  const handleAskFollowup = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!followupQuestion.trim()) {
      appendLog('질문을 입력해주세요.')
      return
    }

    setStatus('후속 질문 답변을 생성하는 중입니다...')
    try {
      const result = await askFollowup({ session_id: sessionId, question: followupQuestion, student_note: studentNote })
      setFollowupAnswer(result.answer)
      appendLog('후속 질문 답변이 생성되었습니다.')
    } catch {
      appendLog('후속 질문 답변 생성에 실패했습니다.')
    }
  }

  const playTeacherVoice = () => {
    const text = sessionInfo?.stt_history.join(' ') || sessionInfo?.generated_note || ''
    if (!text) {
      appendLog('재생할 음성 텍스트가 없습니다.')
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    window.speechSynthesis.speak(utterance)
  }

  const handleStartClass = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }

    try {
      const result = await startClass(sessionId)
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              is_class_active: result.is_class_active,
              class_started_at: result.class_started_at ?? current.class_started_at,
              is_board_shared: true,
            }
          : current,
      )
      appendLog('수업이 시작되었습니다.')
      if (isTeacher && !speechActive) {
        startSpeechRecognition(true)
      }
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '수업 시작에 실패했습니다.')
    }
  }

  const handleStopClass = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }

    stopBoardTimers()
    stopSpeechRecognition()

    try {
      const result = await stopClass(sessionId)
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              is_class_active: result.is_class_active,
              class_started_at: result.class_started_at ?? current.class_started_at,
              is_board_shared: false,
            }
          : current,
      )
      appendLog('수업이 종료되었습니다.')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '수업 종료에 실패했습니다.')
    }
  }

  const handleLeaveSession = () => {
    if (!sessionId) return
    removeJoinedSession(sessionId)
    clearSession()
    navigate('/')
  }

  const handleDeleteSession = async () => {
    if (!sessionId) return
    const title = sessionInfo?.title ?? '이 수업'
    if (!window.confirm(`"${title}"을(를) 완전히 삭제하시겠습니까?\n모든 수업 데이터가 사라지며 복구할 수 없습니다.`)) return
    try {
      stopBoardTimers()
      stopSessionPolling()
      stopSpeechRecognition()
      await deleteSession(sessionId)
      removeJoinedSession(sessionId)
      clearSession()
      navigate('/')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '수업 삭제에 실패했습니다.')
    }
  }

  const latestBoardText = sessionInfo?.latest_ocr_text || '전자칠판 OCR 결과가 아직 없습니다.'
  const savedSpeechText = sessionInfo?.stt_history.join('\n\n') || '저장된 음성 기록이 아직 없습니다.'

  const handleStartShare = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    if (!ensureClassActive()) {
      return
    }

    try {
      const result = await startShare(sessionId)
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              is_board_shared: result.is_board_shared,
            }
          : current,
      )
      appendLog('전자칠판 공유를 시작했습니다.')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '공유 시작에 실패했습니다.')
    }
  }

  const handleStopShare = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }

    try {
      const result = await stopShare(sessionId)
      setSessionInfo((current) =>
        current
          ? {
              ...current,
              is_board_shared: result.is_board_shared,
            }
          : current,
      )
      appendLog('전자칠판 공유를 중지했습니다.')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '공유 종료에 실패했습니다.')
    }
  }

  return (
    <main className="page-shell space-y-6">
      <div className={`rounded-3xl p-6 shadow-sm ring-1 ${isTeacher ? 'bg-gradient-to-br from-violet-50 via-white to-indigo-50 ring-violet-100' : 'bg-gradient-to-br from-sky-50 via-white to-cyan-50 ring-sky-100'}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isTeacher ? '수업 진행' : '수업 참여 중'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {sessionInfo?.title || '수업 제목 없음'} {sessionInfo?.goals ? `· ${sessionInfo.goals}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              ← 대시보드
            </button>
            {!isTeacher && (
              <button
                type="button"
                onClick={handleLeaveSession}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-slate-50"
              >
                수업 나가기
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${isTeacher ? '' : 'xl:grid-cols-[1.5fr_0.9fr]'}`}>
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          {/* 상태 배지 행 */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isClassActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {isClassActive ? '● 수업 진행 중' : '○ 수업 대기 중'}
            </span>
            {isBoardShared && (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                ↗ 공유 중
              </span>
            )}
            {(isSavingBoard || isRunningOcr) && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {isSavingBoard ? '저장 중...' : 'OCR 분석 중...'}
              </span>
            )}
            <span className="ml-auto font-mono text-xs text-slate-400">{sessionId}</span>
          </div>

          {isTeacher ? (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleStartClass()}
                disabled={isClassActive}
                className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                수업 시작
              </button>
              <button
                type="button"
                onClick={() => void handleStopClass()}
                disabled={!isClassActive}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                수업 종료
              </button>
              <button
                type="button"
                onClick={() => void handleStartShare()}
                disabled={!isClassActive || isBoardShared}
                className="rounded-2xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                공유 시작
              </button>
              <button
                type="button"
                onClick={() => void handleStopShare()}
                disabled={!isBoardShared}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                공유 중지
              </button>
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                disabled={!isClassActive}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  speechActive
                    ? 'bg-rose-500 hover:bg-rose-400'
                    : 'bg-violet-600 hover:bg-violet-500'
                }`}
              >
                {speechActive ? '🎤 끄기' : '🎤 켜기'}
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSession()}
                disabled={isClassActive}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="수업이 진행 중일 때는 삭제할 수 없습니다."
              >
                수업 삭제
              </button>
            </div>
          ) : (
            <div className={`mb-5 rounded-2xl border p-4 text-sm ${
              isClassActive
                ? 'border-sky-100 bg-sky-50 text-sky-800'
                : 'border-slate-100 bg-slate-50 text-slate-500'
            }`}>
              {!isClassActive
                ? '교사가 수업 시작을 누를 때까지 대기 중입니다.'
                : isBoardShared
                  ? '교사가 공유 중인 전자칠판을 보고 필기와 피드백 기능을 사용할 수 있습니다.'
                  : '교사가 공유를 시작하면 전자칠판이 여기에 표시됩니다.'}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">공용 전자칠판</h2>
                <p className="mt-1 text-xs text-slate-400">
                  {isTeacher
                    ? '수업 시작 후 공유를 켜면 학생 화면에도 이 전자칠판이 그대로 보입니다.'
                    : '교사가 공유 중인 전자칠판이 여기 표시됩니다.'}
                </p>
              </div>
            </div>

            <canvas
              ref={drawCanvasRef}
              onPointerDown={startDrawing}
              onPointerMove={drawMove}
              onPointerUp={endDrawing}
              onPointerLeave={endDrawing}
              className={`mt-4 h-auto w-full touch-none rounded-[24px] border border-slate-300 bg-white shadow-inner ${
                canDrawSharedBoard ? 'cursor-crosshair' : 'cursor-not-allowed opacity-70'
              }`}
            />

            {isTeacher && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[
                    { color: '#0f172a', ring: 'ring-slate-900' },
                    { color: '#dc2626', ring: 'ring-red-600' },
                    { color: '#2563eb', ring: 'ring-blue-600' },
                    { color: '#16a34a', ring: 'ring-green-600' },
                    { color: '#7c3aed', ring: 'ring-violet-700' },
                    { color: '#ea580c', ring: 'ring-orange-600' },
                    { color: '#ca8a04', ring: 'ring-yellow-600' },
                  ].map(({ color, ring }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => { setPenColor(color); setIsEraser(false) }}
                      style={{ backgroundColor: color }}
                      className={`h-7 w-7 rounded-full border-2 transition ${
                        !isEraser && penColor === color
                          ? `border-transparent ring-2 ring-offset-1 ${ring}`
                          : 'border-white shadow-sm'
                      }`}
                    />
                  ))}
                </div>
                <div className="h-5 w-px bg-slate-200" />
                <div className="flex items-center gap-1">
                  {([2, 4, 8] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPenSize(size)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        penSize === size
                          ? 'bg-slate-800 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {size === 2 ? 'S' : size === 4 ? 'M' : 'L'}
                    </button>
                  ))}
                </div>
                <div className="h-5 w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => setIsEraser(!isEraser)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    isEraser ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  지우개
                </button>
                <button
                  type="button"
                  onClick={() => void handleClearBoard()}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  전체 지우기
                </button>
              </div>
            )}
          </div>

          {!isTeacher && (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">교사 말 텍스트</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      교사가 마이크로 말한 내용이 텍스트로 누적됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={playTeacherVoice}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                  >
                    음성 듣기
                  </button>
                </div>

                <p className="mt-3 min-h-[100px] whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                  {speechText || '저장된 교사 음성 텍스트가 아직 없습니다.'}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900">내 필기용 전자칠판</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      공유 칠판과 별개로 자유롭게 필기할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearStudentBoardCanvas}
                    disabled={!canUseStudentBoard}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    칠판 지우기
                  </button>
                </div>

                <canvas
                  ref={studentDrawCanvasRef}
                  onPointerDown={startStudentDrawing}
                  onPointerMove={moveStudentDrawing}
                  onPointerUp={endStudentDrawing}
                  onPointerLeave={endStudentDrawing}
                  className={`mt-3 h-auto w-full touch-none rounded-xl border border-slate-200 bg-white shadow-inner ${
                    canUseStudentBoard ? 'cursor-crosshair' : 'cursor-not-allowed opacity-70'
                  }`}
                />

                {canUseStudentBoard && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {[
                        { color: '#0f172a', ring: 'ring-slate-900' },
                        { color: '#dc2626', ring: 'ring-red-600' },
                        { color: '#2563eb', ring: 'ring-blue-600' },
                        { color: '#16a34a', ring: 'ring-green-600' },
                        { color: '#7c3aed', ring: 'ring-violet-700' },
                        { color: '#ea580c', ring: 'ring-orange-600' },
                        { color: '#ca8a04', ring: 'ring-yellow-600' },
                      ].map(({ color, ring }) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => { setStudentPenColor(color); setStudentIsEraser(false) }}
                          style={{ backgroundColor: color }}
                          className={`h-7 w-7 rounded-full border-2 transition ${
                            !studentIsEraser && studentPenColor === color
                              ? `border-transparent ring-2 ring-offset-1 ${ring}`
                              : 'border-white shadow-sm'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="h-5 w-px bg-slate-200" />
                    <div className="flex items-center gap-1">
                      {([2, 4, 8] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setStudentPenSize(size)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                            studentPenSize === size
                              ? 'bg-slate-800 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {size === 2 ? 'S' : size === 4 ? 'M' : 'L'}
                        </button>
                      ))}
                    </div>
                    <div className="h-5 w-px bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => setStudentIsEraser(!studentIsEraser)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        studentIsEraser ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      지우개
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h2 className="font-bold text-slate-900">내 필기 정리</h2>
                <textarea
                  className="mt-3 h-44 w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                  placeholder="학생 필기를 자유롭게 입력하세요"
                  value={studentNote}
                  onChange={(event) => setStudentNote(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void handleAnalyzeFeedback()}
                  disabled={!isBoardShared}
                  className="mt-3 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  교사 필기와 비교하기
                </button>
              </div>

              {(feedback.missing || feedback.suggestions || feedback.positives) && (
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h2 className="font-bold text-slate-900">피드백 결과</h2>
                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                      <h3 className="text-sm font-semibold text-rose-700">누락 항목</h3>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700">{feedback.missing}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                      <h3 className="text-sm font-semibold text-amber-700">보완 제안</h3>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700">{feedback.suggestions}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <h3 className="text-sm font-semibold text-emerald-700">잘한 점</h3>
                      <p className="mt-1.5 text-sm whitespace-pre-wrap text-slate-700">{feedback.positives}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <textarea
                      className="h-28 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:border-sky-400 focus:outline-none"
                      placeholder="이 내용을 바탕으로 추가로 궁금한 점을 물어보세요."
                      value={followupQuestion}
                      onChange={(event) => setFollowupQuestion(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskFollowup()}
                      className="mt-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400"
                    >
                      후속 질문
                    </button>
                    {followupAnswer && (
                      <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                        <h3 className="text-sm font-semibold text-sky-800">답변</h3>
                        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{followupAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {!isTeacher && (
          <aside className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h2 className="text-sm font-bold text-slate-900">최신 OCR 텍스트</h2>
                <p className="mt-2 min-h-[120px] whitespace-pre-wrap text-sm text-slate-600">{latestBoardText}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h2 className="text-sm font-bold text-slate-900">저장된 음성 기록</h2>
                <p className="mt-2 min-h-[120px] whitespace-pre-wrap text-sm text-slate-600">{savedSpeechText}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <h2 className="text-sm font-bold text-slate-900">요약 노트</h2>
                <p className="mt-2 min-h-[120px] whitespace-pre-wrap text-sm text-slate-600">
                  {sessionInfo?.generated_note || '수업 요약이 아직 생성되지 않았습니다.'}
                </p>
              </div>

              {status && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3 text-sm text-amber-800">
                  {status}
                </div>
              )}

              {/* 지난 수업 섹션 히스토리 */}
              {(sessionInfo?.sections?.length ?? 0) > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                  <h2 className="text-sm font-bold text-slate-900">지난 수업 기록</h2>
                  <p className="mt-0.5 text-xs text-slate-400">수업이 종료될 때마다 섹션이 생성됩니다.</p>
                  <div className="mt-3 space-y-2">
                    {[...(sessionInfo?.sections ?? [])].reverse().map((section) => {
                      const start = new Date(section.started_at)
                      const end = new Date(section.ended_at)
                      const dateStr = start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
                      const timeStr = `${start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~ ${end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                      const isExpanded = expandedSectionIndex === section.index
                      const summary = sectionSummaries[section.index]
                      const isLoadingSummary = loadingSummaryIndex === section.index

                      return (
                        <div key={section.index} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{dateStr}</p>
                              <p className="text-xs text-slate-400">{timeStr}</p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                칠판 {section.ocr_count}건 · 음성 {section.stt_count}건
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleGenerateSectionSummary(section)}
                                disabled={isLoadingSummary}
                                className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-200 disabled:opacity-60"
                              >
                                {isLoadingSummary ? '요약 중...' : section.has_summary || summary ? 'AI 요약' : 'AI 요약'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenSectionFeedback(section.index)}
                                className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-200"
                              >
                                필기 비교
                              </button>
                            </div>
                          </div>
                          {isExpanded && summary && (
                            <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                              <p className="whitespace-pre-wrap text-xs text-slate-600">{summary}</p>
                              <button
                                type="button"
                                onClick={() => setExpandedSectionIndex(null)}
                                className="mt-1.5 text-xs text-slate-400 hover:text-slate-600"
                              >
                                접기
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 수업 종료 알림 모달 */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-slate-100">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-2xl">
              🎓
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">수업이 종료되었습니다</h2>
            <p className="mt-2 text-sm text-slate-500">
              오늘 수업에 대한 AI 피드백을 받으시겠습니까?<br />
              필기 사진을 추가로 업로드하면 더 정확한 분석이 가능합니다.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowEndModal(false); navigate('/') }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                나가기
              </button>
              <button
                type="button"
                onClick={() => { setShowEndModal(false); setShowFeedbackModal(true) }}
                className="flex-1 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                AI 피드백 받기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 피드백 제출 모달 */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                AI 피드백 받기
                {feedbackModalSectionIndex !== null && (
                  <span className="ml-2 text-sm font-normal text-slate-400">
                    섹션 {feedbackModalSectionIndex + 1}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => { setShowFeedbackModal(false); setFeedbackModalResult(null) }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {!feedbackModalResult ? (
              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-semibold text-slate-700">내 필기 텍스트</label>
                  <textarea
                    className="mt-2 h-40 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                    placeholder="수업 중 적었던 필기 내용을 입력하거나 수정하세요."
                    value={feedbackModalNote}
                    onChange={(e) => setFeedbackModalNote(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">필기 사진 (선택)</label>
                  <p className="mt-1 text-xs text-slate-400">노트, 교재 메모 등 사진을 업로드하면 AI가 내용을 인식해 분석합니다.</p>
                  <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-4 transition hover:border-indigo-400 hover:bg-indigo-50/60">
                    <span className="rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                      사진 선택
                    </span>
                    <span className="text-sm text-slate-400">
                      {feedbackModalPhotoName || '파일을 선택하세요 (jpg, png 등)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFeedbackPhotoChange}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSubmitModalFeedback()}
                  disabled={isSubmittingFeedback}
                  className="w-full rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  {isSubmittingFeedback ? 'AI 분석 중...' : '피드백 받기'}
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                  <h3 className="font-semibold text-rose-700">누락 항목</h3>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedbackModalResult.missing}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                  <h3 className="font-semibold text-amber-700">보완 제안</h3>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedbackModalResult.suggestions}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <h3 className="font-semibold text-emerald-700">잘한 점</h3>
                  <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedbackModalResult.positives}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFeedbackModalResult(null)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    다시 제출
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowFeedbackModal(false); setFeedbackModalResult(null) }}
                    className="flex-1 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default Classroom
