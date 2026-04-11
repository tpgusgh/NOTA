import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteSession, getSessionInfo } from '../api/session'
import {
  clearSession,
  getJoinedSessions,
  getStoredSessionId,
  getStoredUserRole,
  logout,
  removeJoinedSession,
  setCurrentSession,
  UserRole,
} from '../utils/session'
import type { SessionInfoResponse } from '../api/session'

interface ConfirmModal {
  title: string
  message: string
  confirmLabel: string
  confirmClass: string
  onConfirm: () => void
}

function Dashboard() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)
  const [joinedSessions, setJoinedSessions] = useState(getJoinedSessions())
  const [status, setStatus] = useState('')
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null)

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

  const doLeaveSession = (targetSessionId: string) => {
    removeJoinedSession(targetSessionId)
    if (targetSessionId === sessionId) {
      clearSession()
      setSessionId(null)
      setUserRole(null)
      setSessionInfo(null)
    }
    setJoinedSessions(getJoinedSessions())
  }

  const handleLeaveSession = (targetSessionId: string, title: string) => {
    setConfirmModal({
      title: '수업 나가기',
      message: `"${title}" 수업에서 나가시겠습니까?\n목록에서 제거되지만 다시 코드로 참여할 수 있습니다.`,
      confirmLabel: '나가기',
      confirmClass: 'rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-600',
      onConfirm: () => { doLeaveSession(targetSessionId); setConfirmModal(null) },
    })
  }

  const handleDeleteSession = (targetSessionId: string, title: string) => {
    setConfirmModal({
      title: '수업 삭제',
      message: `"${title}" 수업을 완전히 삭제하시겠습니까?\n삭제하면 모든 수업 데이터가 사라지며 복구할 수 없습니다.`,
      confirmLabel: '삭제하기',
      confirmClass: 'rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await deleteSession(targetSessionId)
          removeJoinedSession(targetSessionId)
          if (targetSessionId === sessionId) {
            clearSession()
            setSessionId(null)
            setUserRole(null)
            setSessionInfo(null)
          }
          setJoinedSessions(getJoinedSessions())
        } catch {
          setStatus('수업 삭제에 실패했습니다.')
        }
      },
    })
  }

  return (
    <>
    <main className="page-shell space-y-6">
      {/* 히어로 헤더 */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-8 shadow-sm ring-1 ring-indigo-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white text-lg font-bold shadow-sm">
                C
              </div>
              <h1 className="text-3xl font-bold text-slate-900">NOTA</h1>
            </div>
            <p className="mt-3 max-w-2xl leading-8 text-slate-500">
              수업을 만들고 참여하는 AI 교육 플랫폼입니다. 수업을 생성하거나 코드로 참여하고, 아래에서 내가 들어간 수업을 확인하세요.
            </p>
          </div>
          {userRole && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 sm:w-auto"
            >
              로그아웃
            </button>
          )}
        </div>
      </div>

      {/* 주요 액션 카드 */}
      <div className="grid gap-5 md:grid-cols-2">
        <Link
          to="/setup"
          className="group rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-white shadow-md transition hover:shadow-lg hover:brightness-105"
        >
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
            ✏️
          </div>
          <h2 className="text-2xl font-bold">수업 만들기</h2>
          <p className="mt-2 text-indigo-100">교사는 새로운 수업 목적을 설정하고 수업을 시작합니다.</p>
        </Link>
        <Link
          to="/login"
          className="group rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-500 p-8 text-white shadow-md transition hover:shadow-lg hover:brightness-105"
        >
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl">
            🎓
          </div>
          <h2 className="text-2xl font-bold">수업 참여</h2>
          <p className="mt-2 text-sky-100">학생이나 교사가 기존 수업 코드로 접속합니다.</p>
        </Link>
      </div>

      {/* 현재 접속된 세션 카드 — sessionId가 있을 때만 표시 */}
      {sessionId && (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">현재 수업</h2>
              <p className="mt-1 text-sm text-slate-500">현재 접속 중인 수업입니다.</p>
            </div>
            {userRole && (
              <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                userRole === 'teacher'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-sky-100 text-sky-700'
              }`}>
                {userRole === 'teacher' ? '교사' : '학생'}
              </span>
            )}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">세션 코드: <span className="font-mono font-semibold text-slate-800">{sessionId}</span></p>
            {sessionInfo && (
              <>
                <p className="mt-2 font-semibold text-slate-900">{sessionInfo.title}</p>
                <p className="mt-1 text-sm text-slate-500">{sessionInfo.goals}</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/classroom')}
                className="rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                수업 계속하기
              </button>
              <button
                type="button"
                onClick={() => navigate('/feedback')}
                className="rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400"
              >
                필기 비교하기
              </button>
            </div>
          </div>
          {status && <p className="mt-4 text-sm text-rose-600">{status}</p>}
        </div>
      )}

      {/* 들어간 수업 목록 — sessionId와 무관하게 항상 표시 */}
      {joinedSessions.length > 0 && (
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <h2 className="text-xl font-bold text-slate-900">들어간 수업 목록</h2>
          <p className="mt-1 text-sm text-slate-500">참여했던 수업 목록입니다.</p>
          <div className="mt-5 space-y-3">
            {joinedSessions.map((item) => (
              <div
                key={item.session_id}
                className={`rounded-2xl border p-5 transition ${
                  item.session_id === sessionId
                    ? 'border-indigo-200 bg-indigo-50/60'
                    : 'border-slate-100 bg-slate-50/60 hover:border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.session_id === sessionId && (
                        <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">현재</span>
                      )}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        item.role === 'teacher'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {item.role === 'teacher' ? '교사' : '학생'}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-400">{item.session_id}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleEnterJoinedSession(item.session_id, item.title, item.role)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    들어가기
                  </button>
                  {item.role === 'teacher' ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteSession(item.session_id, item.title)}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      수업 지우기
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLeaveSession(item.session_id, item.title)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      수업 나가기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!sessionId && status && <p className="mt-4 text-sm text-rose-600">{status}</p>}
        </div>
      )}
    </main>

    {/* 확인 모달 */}
    {confirmModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
          <h3 className="text-lg font-bold text-slate-900">{confirmModal.title}</h3>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{confirmModal.message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmModal(null)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void confirmModal.onConfirm()}
              className={confirmModal.confirmClass}
            >
              {confirmModal.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default Dashboard
