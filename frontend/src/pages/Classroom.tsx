import { PointerEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeOcr } from '../api/ocr'
import { saveStt } from '../api/stt'
import { generateNote } from '../api/note'
import { analyzeFeedback, askFollowup } from '../api/feedback'
import { getSessionInfo } from '../api/session'
import { getStoredSessionId, getStoredUserRole, UserRole } from '../utils/session'
import type { SessionInfoResponse } from '../api/session'

function Classroom() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureIntervalRef = useRef<number | null>(null)
  const speechIntervalRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [speechActive, setSpeechActive] = useState(false)
  const [speechText, setSpeechText] = useState('')
  const [queuedSpeech, setQueuedSpeech] = useState('')
  const [status, setStatus] = useState('')
  const [studentNote, setStudentNote] = useState('')
  const [feedback, setFeedback] = useState({ missing: '', suggestions: '', positives: '' })
  const [followupQuestion, setFollowupQuestion] = useState('')
  const [followupAnswer, setFollowupAnswer] = useState('')

  useEffect(() => {
    const storedSessionId = getStoredSessionId()
    const storedRole = getStoredUserRole()
    setSessionId(storedSessionId)
    setUserRole(storedRole)

    if (!storedSessionId || !storedRole) {
      navigate('/')
      return
    }

    getSessionInfo(storedSessionId)
      .then((info) => setSessionInfo(info))
      .catch(() => setStatus('세션 정보를 불러오는 중 오류가 발생했습니다.'))

    initializeDrawingBoard()
    return () => {
      stopCaptureLoop()
      stopSpeechRecognition()
    }
  }, [navigate])

  const stopCaptureLoop = () => {
    if (captureIntervalRef.current !== null) {
      window.clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
  }

  const stopSpeechInterval = () => {
    if (speechIntervalRef.current !== null) {
      window.clearInterval(speechIntervalRef.current)
      speechIntervalRef.current = null
    }
  }

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    stopSpeechInterval()
    setSpeechActive(false)
  }

  const appendLog = (message: string) => {
    setStatus(`${new Date().toLocaleTimeString()} - ${message}`)
  }

  const sendOcrSnapshot = async (imageBase64: string) => {
    if (!sessionId) {
      appendLog('세션 ID가 없습니다.')
      return
    }
    try {
      await analyzeOcr({ image_base64: imageBase64, session_id: sessionId })
      appendLog('OCR 이미지가 전송되었습니다.')
    } catch {
      appendLog('OCR 전송에 실패했습니다.')
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      appendLog('캡처할 화면이 없습니다.')
      return
    }

    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      appendLog('캡처 컨텍스트를 가져올 수 없습니다.')
      return
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    const base64Image = dataUrl.split(',')[1]
    sendOcrSnapshot(base64Image)
  }

  const initializeDrawingBoard = () => {
    const drawCanvas = drawCanvasRef.current
    if (!drawCanvas) return
    drawCanvas.width = 800
    drawCanvas.height = 480
    const ctx = drawCanvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1d4ed8'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height)
  }

  const getCanvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event)
    if (!point) return
    lastPointRef.current = point
  }

  const drawMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event)
    if (!point || !lastPointRef.current) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point
  }

  const endDrawing = () => {
    lastPointRef.current = null
  }

  const clearBoard = () => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const startCaptureLoop = () => {
    stopCaptureLoop()
    captureIntervalRef.current = window.setInterval(() => {
      captureFrame()
    }, 10000)
    appendLog('10초마다 화면을 캡처합니다.')
  }

  const handleStopSharing = () => {
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsSharing(false)
    stopCaptureLoop()
    appendLog('화면 공유가 종료되었습니다.')
  }

  const handleStartSharing = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => videoRef.current?.play()
      }
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          handleStopSharing()
        }
      })
      setIsSharing(true)
      startCaptureLoop()
      appendLog('화면 공유가 시작되었습니다.')
    } catch {
      setStatus('화면 공유를 시작할 수 없습니다.')
    }
  }

  const sendSpeechText = async () => {
    if (!sessionId || !queuedSpeech.trim()) {
      return
    }
    try {
      await saveStt({ text: queuedSpeech, session_id: sessionId })
      appendLog('음성 텍스트가 서버로 전송되었습니다.')
      setQueuedSpeech('')
    } catch {
      appendLog('음성 텍스트 전송 중 오류가 발생했습니다.')
    }
  }

  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatus('Web Speech API를 지원하지 않습니다.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'ko-KR'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      if (finalTranscript) {
        setQueuedSpeech((previous) => `${previous} ${finalTranscript}`.trim())
        setSpeechText((previous) => `${previous} ${finalTranscript}`.trim())
      } else {
        setSpeechText(interimTranscript)
      }
    }

    recognition.onerror = () => {
      appendLog('음성 인식 중 오류가 발생했습니다.')
    }

    recognition.onend = () => {
      setSpeechActive(false)
      appendLog('음성 인식이 중단되었습니다.')
    }

    recognition.start()
    recognitionRef.current = recognition
    setSpeechActive(true)
    appendLog('음성 인식이 시작되었습니다.')

    stopSpeechInterval()
    speechIntervalRef.current = window.setInterval(sendSpeechText, 30000)
  }

  const toggleSpeechRecognition = () => {
    if (speechActive) {
      stopSpeechRecognition()
      appendLog('음성 인식을 중지합니다.')
    } else {
      startSpeechRecognition()
    }
  }

  const generateSummary = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }
    setStatus('요약을 생성하는 중입니다...')
    try {
      const result = await generateNote({ session_id: sessionId })
      setSessionInfo((current) => (current ? { ...current, generated_note: result.note } : current))
      setStatus('수업 요약이 생성되었습니다.')
    } catch {
      setStatus('수업 요약 생성에 실패했습니다.')
    }
  }

  const handleAnalyzeFeedback = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }
    if (!studentNote.trim()) {
      setStatus('학생 필기를 입력해주세요.')
      return
    }
    setStatus('학생 필기와 교사 필기를 비교하는 중입니다...')
    try {
      const result = await analyzeFeedback({ session_id: sessionId, student_note: studentNote })
      setFeedback({ missing: result.missing, suggestions: result.suggestions, positives: result.positives })
      setStatus('피드백이 생성되었습니다.')
    } catch {
      setStatus('피드백 생성에 실패했습니다.')
    }
  }

  const handleAskFollowup = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }
    if (!followupQuestion.trim()) {
      setStatus('질문을 입력해주세요.')
      return
    }
    setStatus('후속 질문을 생성하는 중입니다...')
    try {
      const result = await askFollowup({ session_id: sessionId, question: followupQuestion, student_note: studentNote })
      setFollowupAnswer(result.answer)
      setStatus('후속 질문 답변이 생성되었습니다.')
    } catch {
      setStatus('후속 질문 답변 생성에 실패했습니다.')
    }
  }

  const playTeacherVoice = () => {
    const text = sessionInfo?.stt_history.join(' ') || sessionInfo?.generated_note || ''
    if (!text) {
      setStatus('재생할 교사 음성이 없습니다.')
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ko-KR'
    window.speechSynthesis.speak(utterance)
  }

  const teacherBoardText = sessionInfo?.ocr_history.join('\n\n') || '교사 판서 내용이 아직 없습니다.'
  const teacherSpeechText = sessionInfo?.stt_history.join('\n\n') || '교사 음성 기록이 아직 없습니다.'

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">수업 공간</h1>
            <p className="mt-2 text-slate-600">
              {userRole === 'teacher'
                ? '교사 화면에서 전자칠판을 공유하고 수업 요약을 생성하세요.'
                : '학생 화면에서 교사 요약을 보고 자신의 필기를 입력하여 비교할 수 있습니다.'}
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

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
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
              <p className="mt-3 text-sm">역할: {userRole === 'teacher' ? '교사' : '학생'}</p>
            </div>
          </div>

          {userRole === 'teacher' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleStartSharing}
                  className="rounded-3xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700"
                >
                  화면 공유 시작
                </button>
                <button
                  type="button"
                  onClick={handleStopSharing}
                  disabled={!isSharing}
                  className="rounded-3xl bg-slate-200 px-5 py-3 text-slate-900 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  공유 종료
                </button>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className="rounded-3xl bg-sky-600 px-5 py-3 text-white transition hover:bg-sky-500"
                >
                  {speechActive ? '음성 인식 중지' : '음성 인식 시작'}
                </button>
              </div>

              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-slate-100">
                <video ref={videoRef} autoPlay playsInline muted className="h-[280px] w-full bg-black object-contain" />
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">실시간 음성 텍스트</h2>
                <p className="mt-3 whitespace-pre-wrap text-slate-700 min-h-[100px]">{speechText || '음성 인식 결과가 여기에 표시됩니다.'}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generateSummary}
                  className="rounded-3xl bg-emerald-600 px-6 py-3 text-white transition hover:bg-emerald-500"
                >
                  수업 요약 생성
                </button>
                <button
                  type="button"
                  onClick={playTeacherVoice}
                  className="rounded-3xl bg-slate-800 px-6 py-3 text-white transition hover:bg-slate-700"
                >
                  음성 텍스트 듣기
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold text-slate-900">교사 전자칠판</h2>
                  <p className="mt-3 whitespace-pre-wrap text-slate-700 min-h-[120px]">{teacherBoardText}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-lg font-semibold text-slate-900">교사 음성 기록</h2>
                  <p className="mt-3 whitespace-pre-wrap text-slate-700 min-h-[120px]">{teacherSpeechText}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-900">내 필기</h2>
                <textarea
                  className="mt-3 h-52 w-full rounded-3xl border border-slate-200 p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="학생 필기를 자유롭게 입력하세요"
                  value={studentNote}
                  onChange={(event) => setStudentNote(event.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAnalyzeFeedback}
                  className="mt-4 rounded-3xl bg-slate-900 px-6 py-3 text-white transition hover:bg-slate-700"
                >
                  교사 필기와 비교하기
                </button>
              </div>

              {(feedback.missing || feedback.suggestions || feedback.positives) && (
                <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
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
                  <div className="mt-4">
                    <label className="text-sm font-medium text-slate-700">추가 질문</label>
                    <textarea
                      className="mt-3 h-32 w-full rounded-3xl border border-slate-200 p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      placeholder="이 내용을 바탕으로 추가로 궁금한 점을 물어보세요."
                      value={followupQuestion}
                      onChange={(event) => setFollowupQuestion(event.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAskFollowup}
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
            </>
          )}
        </section>

        <aside className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">요약 노트</h2>
              <p className="mt-3 whitespace-pre-wrap text-slate-700 min-h-[140px]">
                {sessionInfo?.generated_note || '수업 요약이 아직 생성되지 않았습니다. 교사가 수업 요약을 생성하면 이곳에 보입니다.'}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-lg font-semibold text-slate-900">수업 상태</h2>
              <p className="mt-3 text-slate-700">
                {status || '교사 화면이 공유되면 필기 내용과 음성 텍스트가 자동으로 기록됩니다.'}
              </p>
            </div>
          </div>
        </aside>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={drawCanvasRef} className="hidden" />
    </main>
  )
}

export default Classroom
