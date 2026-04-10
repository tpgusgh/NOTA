import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { askFollowup } from '../api/feedback'
import { getSessionInfo } from '../api/session'
import { getStoredFeedbackResult, getStoredSessionId, type StoredFeedbackResult } from '../utils/session'
import type { SessionInfoResponse } from '../api/session'

type FeedbackLocationState = {
  feedbackResult?: StoredFeedbackResult
}

function StudentFeedback() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = getStoredSessionId()
  const locationState = location.state as FeedbackLocationState | null

  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)
  const [feedbackResult, setFeedbackResult] = useState<StoredFeedbackResult | null>(
    locationState?.feedbackResult ?? getStoredFeedbackResult(),
  )
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState('')
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }

    getSessionInfo(sessionId)
      .then((info) => setSessionInfo(info))
      .catch(() => setStatus('세션 정보를 불러오지 못했습니다.'))
  }, [navigate, sessionId])

  useEffect(() => {
    if (locationState?.feedbackResult) {
      setFeedbackResult(locationState.feedbackResult)
    }
  }, [locationState])

  const handleAskQuestion = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }
    if (!question.trim()) {
      setStatus('질문을 입력해주세요.')
      return
    }

    try {
      setStatus('')
      setIsLoadingAnswer(true)
      const result = await askFollowup({
        session_id: sessionId,
        question,
        student_note: feedbackResult?.studentNote,
      })
      setAnswer(result.answer)
      setStatus('답변이 생성되었습니다. 추가 질문도 계속할 수 있습니다.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '질문에 답변할 수 없습니다.')
    } finally {
      setIsLoadingAnswer(false)
    }
  }

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">수업 결과 화면</h1>
            <p className="mt-2 text-slate-600">
              수업이 종료되었습니다. 교사 필기와 음성 기록을 기준으로 학생 필기를 비교한 결과입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-3xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700"
          >
            대시보드로 이동
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">학생 필기</h2>
            <p className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-3xl bg-slate-50 p-4 text-slate-700">
              {feedbackResult?.studentNote || '저장된 학생 필기가 없습니다.'}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">비교 피드백</h2>

            <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800">누락 항목</h3>
              <p className="whitespace-pre-wrap text-slate-700">{feedbackResult?.missing || '없음'}</p>
            </section>

            <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800">보완 제안</h3>
              <p className="whitespace-pre-wrap text-slate-700">{feedbackResult?.suggestions || '없음'}</p>
            </section>

            <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800">잘한 점</h3>
              <p className="whitespace-pre-wrap text-slate-700">{feedbackResult?.positives || '없음'}</p>
            </section>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">교사 말 텍스트</h2>
            <p className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-3xl bg-slate-50 p-4 text-slate-700">
              {sessionInfo?.stt_history.join('\n\n') || '저장된 교사 음성 텍스트가 없습니다.'}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">질문과 후속질문</h2>
            <textarea
              className="mt-4 h-36 w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
              placeholder="비교 결과를 보고 궁금한 점을 질문하세요."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              type="button"
              onClick={handleAskQuestion}
              disabled={isLoadingAnswer}
              className="mt-4 rounded-3xl bg-sky-600 px-6 py-3 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingAnswer ? '답변 생성 중...' : '질문하기'}
            </button>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800">답변</h3>
              <p className="mt-3 min-h-[140px] whitespace-pre-wrap text-slate-700">
                {answer || '질문을 입력하면 답변이 여기에 표시됩니다. 이어서 후속질문도 계속할 수 있습니다.'}
              </p>
            </div>

            {status && <p className="mt-4 text-sm text-slate-600">{status}</p>}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default StudentFeedback
