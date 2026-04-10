import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinSession } from '../api/session'
import { setCurrentSession } from '../utils/session'

function Login() {
  const navigate = useNavigate()
  const [sessionCode, setSessionCode] = useState('')
  const [role, setRole] = useState<'teacher' | 'student'>('student')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await joinSession({ session_id: sessionCode })
      setCurrentSession(result.session_id, result.title, role)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell max-w-3xl">
      <div className="rounded-3xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-10 shadow-sm ring-1 ring-sky-100">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white text-xl shadow-sm">
          🎓
        </div>
        <h1 className="text-2xl font-bold text-slate-900">수업 코드로 접속</h1>
        <p className="mt-2 text-sm text-slate-500">
          수업 코드를 입력하면 기존 세션에 접속할 수 있습니다.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold text-slate-700">수업 코드</label>
            <input
              type="text"
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              placeholder="예: 8a2f..."
              required
            />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700">역할 선택</p>
            <div className="mt-2 flex gap-3">
              <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                role === 'teacher'
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  checked={role === 'teacher'}
                  onChange={() => setRole('teacher')}
                  className="accent-violet-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">교사</p>
                  <p className="text-xs text-slate-400">수업을 이어서 진행합니다.</p>
                </div>
              </label>
              <label className={`flex flex-1 cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition ${
                role === 'student'
                  ? 'border-sky-400 bg-sky-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="student"
                  checked={role === 'student'}
                  onChange={() => setRole('student')}
                  className="accent-sky-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800">학생</p>
                  <p className="text-xs text-slate-400">수업에 참여합니다.</p>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-sky-500 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? '입장 중...' : '수업 코드로 접속'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login
