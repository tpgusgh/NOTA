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
      <div className="rounded-3xl bg-white p-10 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">수업 코드로 로그인</h1>
        <p className="mt-3 text-slate-600">
          수업 코드를 입력하면 기존 세션에 접속할 수 있습니다. 교사는 수업을 이어서 진행하고 학생은 피드백 화면으로 이동합니다.
        </p>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            수업 코드
            <input
              type="text"
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value)}
              className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400"
              placeholder="예: 8a2f..."
              required
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={role === 'teacher'}
                onChange={() => setRole('teacher')}
              />
              교사로 로그인
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === 'student'}
                onChange={() => setRole('student')}
              />
              학생으로 로그인
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-3xl bg-slate-900 px-6 py-4 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? '입장 중...' : '수업 코드로 접속'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default Login
