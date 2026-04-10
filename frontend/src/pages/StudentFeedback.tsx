import { useState } from 'react'
import { analyzeFeedback } from '../api/feedback'

function StudentFeedback() {
  const [studentNote, setStudentNote] = useState('')
  const [feedback, setFeedback] = useState({ missing: '', suggestions: '', positives: '' })
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('sessionId') : null

  const handleSubmit = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다. 세션을 먼저 설정해주세요.')
      return
    }
    if (!studentNote.trim()) {
      setStatus('학생 필기를 입력해주세요.')
      return
    }

    try {
      setStatus('')
      setIsLoading(true)
      const result = await analyzeFeedback({ session_id: sessionId, student_note: studentNote })
      setFeedback({ missing: result.missing, suggestions: result.suggestions, positives: result.positives })
      setStatus('피드백이 생성되었습니다.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '피드백 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">학생 화면</h1>
        <p className="mt-2 text-slate-600">학생은 여기에 자신의 필기를 입력하고, 교사 기준 노트와 비교된 피드백을 받을 수 있습니다.</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <textarea
          className="h-72 w-full rounded-3xl border border-slate-200 p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          placeholder="학생 필기를 입력하세요"
          value={studentNote}
          onChange={(event) => setStudentNote(event.target.value)}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className="mt-4 rounded-3xl bg-slate-800 px-6 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? '분석 중...' : '피드백 받기'}
        </button>

        {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
      </div>

      {(feedback.missing || feedback.suggestions || feedback.positives) && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">피드백 결과</h2>

          <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">누락 항목</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{feedback.missing}</p>
          </section>

          <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">보완 제안</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{feedback.suggestions}</p>
          </section>

          <section className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-800">잘한 점</h3>
            <p className="text-slate-700 whitespace-pre-wrap">{feedback.positives}</p>
          </section>
        </div>
      )}
    </main>
  )
}

export default StudentFeedback
