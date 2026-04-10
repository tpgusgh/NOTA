import { useEffect, useState } from 'react'
import { approveNote, generateNote, shareNote } from '../api/note'

function NoteReview() {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sessionId')
    setSessionId(stored)
    if (stored) {
      setIsLoading(true)
      generateNote({ session_id: stored })
        .then((response) => setNote(response.note))
        .catch((err) => setStatus(err instanceof Error ? err.message : '노트 생성에 실패했습니다.'))
        .finally(() => setIsLoading(false))
    } else {
      setStatus('세션 ID가 없습니다. 먼저 수업 설정을 완료해주세요.')
    }
  }, [])

  const handleApprove = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }

    try {
      setIsLoading(true)
      await approveNote({ session_id: sessionId, note })
      setStatus('노트가 승인되었습니다.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '노트 승인에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = async () => {
    if (!sessionId) {
      setStatus('세션 ID가 없습니다.')
      return
    }

    try {
      setIsLoading(true)
      await shareNote({ session_id: sessionId })
      const url = `${window.location.origin}/note/${sessionId}`
      await navigator.clipboard.writeText(url)
      setCopyMessage('공개 링크가 복사되었습니다.')
      setStatus('결석생 공유 노트 링크가 생성되었습니다.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '공유 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">노트 검토 · 승인</h1>
        <p className="mt-2 text-slate-600">생성된 필기 노트를 확인하고 수정 후 승인하세요.</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">생성된 노트</label>
        <textarea
          className="mt-3 h-96 w-full rounded-3xl border border-slate-200 p-4 text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
        {copyMessage && <p className="mt-1 text-sm text-sky-600">{copyMessage}</p>}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isLoading}
            className="rounded-3xl bg-slate-800 px-6 py-3 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? '처리 중...' : '승인하기'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={isLoading}
            className="rounded-3xl bg-sky-600 px-6 py-3 text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? '처리 중...' : '결석생 공유'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default NoteReview
