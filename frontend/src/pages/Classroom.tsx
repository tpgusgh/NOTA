import { PointerEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeFeedback, askFollowup } from '../api/feedback'
import { generateNote } from '../api/note'
import { analyzeOcr, extractOcrText } from '../api/ocr'
import { getSessionInfo, saveBoardState, clearBoardState, startClass, stopClass, startShare, stopShare } from '../api/session'
import { saveStt } from '../api/stt'
import { getStoredSessionId, getStoredUserRole, setStoredFeedbackResult, UserRole } from '../utils/session'
import type { SessionInfoResponse } from '../api/session'

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
    ctx.strokeStyle = '#0f172a'
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
    ctx.strokeStyle = '#0f172a'
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
    ctx.beginPath()
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
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
    ctx.beginPath()
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
    ctx.fillStyle = '#0f172a'
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

  const handleRunEndOfClassComparison = async () => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }

    try {
      setStatus('수업 종료 후 학생 필기를 비교하는 중입니다...')
      const combinedStudentNote = await buildStudentComparisonNote()
      if (!combinedStudentNote) {
        appendLog('비교할 학생 필기가 없습니다. 개인 전자칠판이나 메모를 먼저 남겨주세요.')
        return
      }

      const result = await analyzeFeedback({ session_id: sessionId, student_note: combinedStudentNote })
      setStoredFeedbackResult({
        studentNote: combinedStudentNote,
        missing: result.missing,
        suggestions: result.suggestions,
        positives: result.positives,
      })
      setFeedback({ missing: result.missing, suggestions: result.suggestions, positives: result.positives })
      window.alert('수업이 종료되었습니다. 결과 화면으로 이동합니다.')
      navigate('/feedback', {
        state: {
          feedbackResult: {
            studentNote: combinedStudentNote,
            missing: result.missing,
            suggestions: result.suggestions,
            positives: result.positives,
          },
        },
      })
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '수업 종료 후 필기 비교에 실패했습니다.')
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
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">공용 전자칠판 수업 공간</h1>
            <p className="mt-2 text-slate-600">
              교사와 학생이 같은 전자칠판에 직접 쓰고, 그 보드를 이미지로 저장한 뒤 OCR로 텍스트를 추출합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-3xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>

      <div className={`grid gap-6 ${isTeacher ? '' : 'xl:grid-cols-[1.5fr_0.9fr]'}`}>
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">수업 제목</p>
              <p className="text-lg font-semibold text-slate-900">{sessionInfo?.title || '알 수 없는 수업'}</p>
              <p className="mt-2 text-sm text-slate-600">{sessionInfo?.goals || '학습 목표가 없습니다.'}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4 text-slate-700">
              <p className="text-sm">세션 코드</p>
              <p className="mt-2 font-semibold">{sessionId}</p>
              <p className="mt-3 text-sm">역할: {isTeacher ? '교사' : '학생'}</p>
              <p className="mt-2 text-sm">수업 상태: {isClassActive ? '진행 중' : '시작 전'}</p>
              <p className="mt-2 text-sm">공유 상태: {isBoardShared ? '공유 중' : '공유 전'}</p>
              <p className="mt-2 text-sm">
                보드 저장 상태: {isSavingBoard ? '저장 중' : '대기 중'}
                {isRunningOcr ? ' / OCR 분석 중' : ''}
              </p>
            </div>
          </div>

          {isTeacher ? (
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleStartClass()}
                disabled={isClassActive}
                className="rounded-3xl bg-emerald-600 px-5 py-3 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                수업 시작
              </button>
              <button
                type="button"
                onClick={() => void handleStopClass()}
                disabled={!isClassActive}
                className="rounded-3xl bg-slate-200 px-5 py-3 text-slate-900 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                수업 종료
              </button>
              <button
                type="button"
                onClick={() => void handleStartShare()}
                disabled={!isClassActive || isBoardShared}
                className="rounded-3xl bg-sky-600 px-5 py-3 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                공유 시작
              </button>
              <button
                type="button"
                onClick={() => void handleStopShare()}
                disabled={!isBoardShared}
                className="rounded-3xl bg-slate-200 px-5 py-3 text-slate-900 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                공유 중지
              </button>
            </div>
          ) : (
            <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              {!isClassActive
                ? '교사가 수업 시작을 누를 때까지 대기 중입니다.'
                : isBoardShared
                  ? '교사가 공유 중인 전자칠판을 보고 필기와 피드백 기능을 사용할 수 있습니다.'
                  : '교사가 공유를 시작하면 전자칠판이 여기에 표시됩니다.'}
            </div>
          )}

          <div className="rounded-[28px] border border-slate-200 bg-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">공용 전자칠판</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {isTeacher
                    ? '수업 시작 후 공유를 켜면 학생 화면에도 이 전자칠판이 그대로 보입니다.'
                    : '교사가 공유 중인 전자칠판이 여기 표시됩니다. 학생은 아래 개인 필기용 전자칠판에 따로 메모할 수 있습니다.'}
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
          </div>

          {!isTeacher && (
            <div className="mt-6 space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">교사 말 텍스트</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      교사가 마이크로 말한 내용이 텍스트로 누적됩니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={playTeacherVoice}
                    className="rounded-3xl bg-slate-200 px-5 py-3 text-slate-900 transition hover:bg-slate-300"
                  >
                    저장된 음성 듣기
                  </button>
                </div>

                <p className="mt-4 min-h-[120px] whitespace-pre-wrap rounded-3xl bg-white p-4 text-slate-700 shadow-sm">
                  {speechText || '저장된 교사 음성 텍스트가 아직 없습니다.'}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">내 필기용 전자칠판</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      이 칠판은 학생 개인 메모용입니다. 공유 칠판과 별개로 자유롭게 필기할 수 있습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearStudentBoardCanvas}
                    disabled={!canUseStudentBoard}
                    className="rounded-3xl bg-slate-200 px-5 py-3 text-slate-900 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    내 칠판 지우기
                  </button>
                </div>

                <canvas
                  ref={studentDrawCanvasRef}
                  onPointerDown={startStudentDrawing}
                  onPointerMove={moveStudentDrawing}
                  onPointerUp={endStudentDrawing}
                  onPointerLeave={endStudentDrawing}
                  className={`mt-4 h-auto w-full touch-none rounded-[24px] border border-slate-300 bg-white shadow-inner ${
                    canUseStudentBoard ? 'cursor-crosshair' : 'cursor-not-allowed opacity-70'
                  }`}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">내 필기 정리</h2>
                <textarea
                  className="mt-3 h-52 w-full rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="학생 필기를 자유롭게 입력하세요"
                  value={studentNote}
                  onChange={(event) => setStudentNote(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => void handleAnalyzeFeedback()}
                  disabled={!isBoardShared}
                  className="mt-4 rounded-3xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  교사 필기와 비교하기
                </button>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">교사 음성 기록 보조 입력</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      교사 설명을 추가로 텍스트로 남기거나 요약을 만들 때 사용합니다.
                    </p>
                  </div>
                </div>

                <textarea
                  className="mt-4 h-32 w-full rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="교사 설명을 직접 기록해둘 수도 있습니다."
                  value={manualSpeechText}
                  onChange={(event) => setManualSpeechText(event.target.value)}
                  disabled={!isClassActive}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSaveManualSpeech()}
                    disabled={!isClassActive}
                    className="rounded-3xl bg-emerald-600 px-6 py-3 text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    음성 텍스트 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateSummary()}
                    disabled={!isClassActive}
                    className="rounded-3xl bg-sky-600 px-6 py-3 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    수업 요약 생성
                  </button>
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    disabled={!isClassActive}
                    className="rounded-3xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {speechActive ? '음성 인식 중지' : '음성 인식 시작'}
                  </button>
                </div>
              </div>

              {(feedback.missing || feedback.suggestions || feedback.positives) && (
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold text-slate-900">피드백 결과</h2>
                  <div>
                    <h3 className="font-semibold text-slate-800">누락 항목</h3>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedback.missing}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">보완 제안</h3>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedback.suggestions}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">잘한 점</h3>
                    <p className="mt-2 whitespace-pre-wrap text-slate-700">{feedback.positives}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">추가 질문</label>
                    <textarea
                      className="mt-3 h-32 w-full rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      placeholder="이 내용을 바탕으로 추가로 궁금한 점을 물어보세요."
                      value={followupQuestion}
                      onChange={(event) => setFollowupQuestion(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAskFollowup()}
                      className="mt-4 rounded-3xl bg-sky-600 px-6 py-3 text-white transition hover:bg-sky-500"
                    >
                      후속 질문
                    </button>
                    {followupAnswer && (
                      <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
                        <h3 className="font-semibold text-slate-800">답변</h3>
                        <p className="mt-3 whitespace-pre-wrap text-slate-700">{followupAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {!isTeacher && (
          <aside className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">최신 OCR 텍스트</h2>
                <p className="mt-3 min-h-[160px] whitespace-pre-wrap text-slate-700">{latestBoardText}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">저장된 음성 기록</h2>
                <p className="mt-3 min-h-[160px] whitespace-pre-wrap text-slate-700">{savedSpeechText}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">요약 노트</h2>
                <p className="mt-3 min-h-[160px] whitespace-pre-wrap text-slate-700">
                  {sessionInfo?.generated_note || '수업 요약이 아직 생성되지 않았습니다.'}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">수업 상태</h2>
                <p className="mt-3 whitespace-pre-wrap text-slate-700">
                  {status || '공유 중인 전자칠판과 교사 기록이 이 화면에 누적됩니다.'}
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}

export default Classroom
