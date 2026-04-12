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
  const [showGuide, setShowGuide] = useState(false)

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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100 sm:w-auto"
            >
              사용 가이드
            </button>
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

    {/* 사용 가이드 모달 */}
    {showGuide && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-6">
            <h2 className="text-xl font-bold text-white">NOTA 사용 가이드</h2>
            <p className="mt-1 text-sm text-indigo-100">AI 기반 수업 필기 플랫폼</p>
          </div>

          <div className="overflow-y-auto max-h-[70vh] px-7 py-6 space-y-6">
            {/* 교사 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">교사</span>
                <span className="text-sm font-semibold text-slate-700">수업 진행 흐름</span>
              </div>
              <ol className="space-y-2.5">
                {[
                  ['수업 만들기', '수업 제목·목표·키워드를 입력해 세션을 생성합니다. 학생에게 세션 코드를 공유하세요.'],
                  ['수업 시작', '수업실에서 "수업 시작" 버튼을 누르고 오늘의 수업 계획을 입력합니다.'],
                  ['화면 공유 & OCR', '전자칠판 화면을 공유하면 10초마다 자동으로 판서 내용이 기록됩니다.'],
                  ['음성 인식(STT)', '마이크 버튼을 켜면 교사 음성이 실시간으로 텍스트로 저장됩니다.'],
                  ['수업 종료', '"수업 종료" 버튼을 누르면 마지막 OCR 후 섹션 이름을 입력해 저장합니다.'],
                  ['노트 생성·승인', '노트 검토 화면에서 AI가 생성한 구조화 노트를 확인하고 승인합니다.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-slate-100" />

            {/* 학생 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">학생</span>
                <span className="text-sm font-semibold text-slate-700">수업 참여 흐름</span>
              </div>
              <ol className="space-y-2.5">
                {[
                  ['수업 참여', '교사에게 받은 세션 코드를 입력해 수업에 참여합니다.'],
                  ['칠판 보기', '교사가 공유한 칠판 화면을 실시간으로 확인할 수 있습니다.'],
                  ['개인 필기', '화면 오른쪽 캔버스에 직접 필기하거나 텍스트로 메모합니다.'],
                  ['필기 피드백', '수업 후 텍스트 필기를 입력하거나 사진을 찍어 올리면 AI가 누락 항목·보완 제안·잘한 점을 분석해줍니다.'],
                  ['후속 질문', '피드백 결과에서 이해가 안 되는 부분을 AI에게 추가 질문할 수 있습니다.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-slate-100" />

            {/* 팁 */}
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">TIP</p>
              <ul className="space-y-1 text-xs text-amber-800 leading-relaxed list-disc pl-4">
                <li>수업 중에는 필기 피드백 기능이 비활성화됩니다.</li>
                <li>세션 코드는 수업 화면 상단에서 확인할 수 있습니다.</li>
                <li>결석한 경우 공개 노트 링크로 수업 내용을 확인하세요.</li>
              </ul>
            </div>
          </div>

          <div className="px-7 py-5 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    )}

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
