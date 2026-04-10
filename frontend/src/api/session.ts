export interface CreateSessionRequest {
  title: string
  goals: string
  keywords: string[]
  emphasis: string
}

export interface CreateSessionResponse {
  session_id: string
}

export interface JoinSessionRequest {
  session_id: string
}

export interface JoinSessionResponse {
  session_id: string
  title: string
  goals: string
}

export interface SessionInfoResponse {
  session_id: string
  title: string
  goals: string
  keywords: string[]
  emphasis: string
  ocr_history: string[]
  stt_history: string[]
  generated_note?: string
  approved_note?: string
  public_note?: string
}

const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export async function createSession(data: CreateSessionRequest): Promise<CreateSessionResponse> {
  const response = await fetch(`${baseUrl}/api/session/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('세션 생성에 실패했습니다.')
  }

  return response.json()
}

export async function joinSession(data: JoinSessionRequest): Promise<JoinSessionResponse> {
  const response = await fetch(`${baseUrl}/api/session/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || '수업 코드로 입장할 수 없습니다.')
  }

  return response.json()
}

export async function getSessionInfo(session_id: string): Promise<SessionInfoResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}`)
  if (!response.ok) {
    throw new Error('세션 정보를 불러올 수 없습니다.')
  }
  return response.json()
}
