import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPublicNote } from '../api/note'

function PublicNote() {
  const { session_id } = useParams()
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!session_id) {
      setStatus('유효한 세션 ID가 없습니다.')
      return
    }

    fetchPublicNote(session_id)
      .then((response) => setNote(response.public_note))
      .catch((err) => setStatus(err instanceof Error ? err.message : '공개 노트를 불러오지 못했습니다.'))
  }, [session_id])

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">결석생 공개 노트</h1>
        <p className="mt-2 text-slate-600">공유받은 세션 링크로 접속한 결석생은 이 페이지에서 요약 노트를 확인할 수 있습니다.</p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        {status && <p className="text-slate-600">{status}</p>}
        {!status && note && <pre className="whitespace-pre-wrap text-slate-800">{note}</pre>}
      </div>
    </main>
  )
}

export default PublicNote
