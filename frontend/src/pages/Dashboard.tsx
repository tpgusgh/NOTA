import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSessionInfo } from '../api/session'
import {
  getJoinedSessions,
  getStoredSessionId,
  getStoredUserRole,
  logout,
  setCurrentSession,
  UserRole,
} from '../utils/session'
import type { SessionInfoResponse } from '../api/session'

function Dashboard() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)
  const [joinedSessions, setJoinedSessions] = useState(getJoinedSessions())
  const [status, setStatus] = useState('')

  useEffect(() => {
    const storedSessionId = getStoredSessionId()
    const storedRole = getStoredUserRole()
    setSessionId(storedSessionId)
    setUserRole(storedRole)
    setJoinedSessions(getJoinedSessions())

    if (storedSessionId) {
      getSessionInfo(storedSessionId)
        .then((info) => setSessionInfo(info))
        .catch(() => setStatus('현재 세션 정보를 불러올 수 없습니다.'))
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
    window.location.reload()
  }

  const handleEnterJoinedSession = (targetSessionId: string, title: string, role: UserRole) => {
    setCurrentSession(targetSessionId, title, role)
    setSessionId(targetSessionId)
    setUserRole(role)
    setStatus('')
    navigate('/classroom')
  }

  return (
    <main className="page-shell space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">CLAUDE Edu</h1>
            <p className="mt-3 max-w-2xl leading-8 text-slate-600">
              수업을 만들고 참여하는 로그인 기반 대시보드입니다. 수업을 생성하거나 코드로 참여하고, 아래에서 내가 들어간 수업을 확인하세요.
            </p>
          </div>
          {userRole && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-3xl bg-slate-900 px-6 py-4 text-white transition hover:bg-slate-700 sm:w-auto"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          to="/setup"
          className="rounded-3xl bg-slate-800 p-8 text-white shadow-sm hover:bg-slate-700"
        >
          <h2 className="text-2xl font-semibold">수업 만들기</h2>
          <p className="mt-3 text-slate-200">교사는 새로운 수업 목적을 설정하고 수업을 시작합니다.</p>
        </Link>
        <Link
          to="/login"
          className="rounded-3xl bg-sky-600 p-8 text-white shadow-sm hover:bg-sky-500"
        >
          <h2 className="text-2xl font-semibold">수업 참여</h2>
          <p className="mt-3 text-slate-200">학생이나 교사가 기존 수업 코드로 접속합니다.</p>
        </Link>
      </div>

      {sessionId && (
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">내 수업</h2>
              <p className="mt-2 text-slate-600">현재 로그인된 수업과 역할을 확인하세요.</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-4 py-3 text-slate-700">
              {userRole ? `현재 역할: ${userRole === 'teacher' ? '교사' : '학생'}` : '로그인 필요'}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">현재 접속된 세션</h3>
              <p className="mt-3 text-slate-700">세션 코드: {sessionId}</p>
              {sessionInfo && (
                <>
                  <p className="mt-2 text-slate-700">수업 제목: {sessionInfo.title}</p>
                  <p className="mt-2 text-slate-700">학습 목표: {sessionInfo.goals}</p>
                </>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/classroom')}
                  className="rounded-3xl bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700"
                >
                  수업 계속하기
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/feedback')}
                  className="rounded-3xl bg-sky-600 px-5 py-3 text-white transition hover:bg-sky-500"
                >
                  필기 비교하기
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-900">들어간 수업 목록</h3>
              <div className="mt-4 space-y-3">
                {joinedSessions.length === 0 ? (
                  <p className="text-slate-700">아직 참여한 수업이 없습니다.</p>
                ) : (
                  joinedSessions.map((item) => (
                    <button
                      key={item.session_id}
                      type="button"
                      onClick={() => handleEnterJoinedSession(item.session_id, item.title, item.role)}
                      className={`w-full rounded-3xl border p-4 text-left transition ${
                        item.session_id === sessionId
                          ? 'border-sky-300 bg-sky-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-slate-600">코드: {item.session_id}</p>
                          <p className="mt-1 text-slate-600">역할: {item.role === 'teacher' ? '교사' : '학생'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-sm text-white">
                          {item.session_id === sessionId ? '현재 수업' : '들어가기'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {status && <p className="mt-4 text-sm text-slate-600">{status}</p>}
        </div>
      )}
    </main>
  )
}

export default Dashboard
