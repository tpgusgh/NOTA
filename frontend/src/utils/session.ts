export type UserRole = 'teacher' | 'student'

export interface JoinedSession {
  session_id: string
  title: string
  role: UserRole
  goals?: string
}

export interface StoredFeedbackResult {
  studentNote: string
  missing: string
  suggestions: string
  positives: string
}

const SESSION_ID_KEY = 'sessionId'
const USER_ROLE_KEY = 'userRole'
const JOINED_SESSIONS_KEY = 'joinedSessions'
const FEEDBACK_RESULT_KEY = 'latestFeedbackResult'

export function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(SESSION_ID_KEY)
}

export function getStoredUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null
  const role = localStorage.getItem(USER_ROLE_KEY)
  return role === 'teacher' || role === 'student' ? role : null
}

export function getJoinedSessions(): JoinedSession[] {
  if (typeof window === 'undefined') return []
  try {
    const value = localStorage.getItem(JOINED_SESSIONS_KEY)
    if (!value) return []
    return JSON.parse(value) as JoinedSession[]
  } catch {
    return []
  }
}

export function addJoinedSession(session: JoinedSession) {
  if (typeof window === 'undefined') return
  const sessions = getJoinedSessions()
  const existing = sessions.find((item) => item.session_id === session.session_id)
  const nextSessions = existing ? sessions.map((item) => (item.session_id === session.session_id ? session : item)) : [...sessions, session]
  localStorage.setItem(JOINED_SESSIONS_KEY, JSON.stringify(nextSessions))
}

export function setCurrentSession(sessionId: string, title: string, role: UserRole) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_ID_KEY, sessionId)
  localStorage.setItem(USER_ROLE_KEY, role)
  addJoinedSession({ session_id: sessionId, title, role })
}

export function removeJoinedSession(sessionId: string) {
  if (typeof window === 'undefined') return
  const sessions = getJoinedSessions().filter((item) => item.session_id !== sessionId)
  localStorage.setItem(JOINED_SESSIONS_KEY, JSON.stringify(sessions))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_ID_KEY)
  localStorage.removeItem(USER_ROLE_KEY)
}

export function logout() {
  if (typeof window === 'undefined') return
  clearSession()
}

export function setStoredFeedbackResult(result: StoredFeedbackResult) {
  if (typeof window === 'undefined') return
  localStorage.setItem(FEEDBACK_RESULT_KEY, JSON.stringify(result))
}

export function getStoredFeedbackResult(): StoredFeedbackResult | null {
  if (typeof window === 'undefined') return null
  try {
    const value = localStorage.getItem(FEEDBACK_RESULT_KEY)
    if (!value) return null
    return JSON.parse(value) as StoredFeedbackResult
  } catch {
    return null
  }
}
