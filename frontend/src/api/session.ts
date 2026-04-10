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
  is_class_active?: boolean
  class_started_at?: string | null
  is_board_shared?: boolean
  board_data_url?: string | null
  board_updated_at?: string | null
  latest_ocr_text?: string | null
  ocr_history: string[]
  stt_history: string[]
  generated_note?: string
  approved_note?: string
  public_note?: string
}

export interface BoardStateResponse {
  board_data_url?: string | null
  board_updated_at?: string | null
  latest_ocr_text?: string | null
}

export interface ClassStateResponse {
  is_class_active: boolean
  class_started_at?: string | null
}

export interface ShareStateResponse {
  is_board_shared: boolean
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

export async function getBoardState(session_id: string): Promise<BoardStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/board`)
  if (!response.ok) {
    throw new Error('전자칠판 상태를 불러올 수 없습니다.')
  }
  return response.json()
}

export async function saveBoardState(session_id: string, board_data_url: string): Promise<BoardStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/board`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id, board_data_url }),
  })

  if (!response.ok) {
    throw new Error('전자칠판 저장에 실패했습니다.')
  }

  return response.json()
}

export async function clearBoardState(session_id: string): Promise<BoardStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/board`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('전자칠판 초기화에 실패했습니다.')
  }

  return response.json()
}

export async function startClass(session_id: string): Promise<ClassStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/start`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('수업 시작에 실패했습니다.')
  }

  return response.json()
}

export async function stopClass(session_id: string): Promise<ClassStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/stop`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('수업 종료에 실패했습니다.')
  }

  return response.json()
}

export async function startShare(session_id: string): Promise<ShareStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/share/start`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('공유 시작에 실패했습니다.')
  }

  return response.json()
}

export async function stopShare(session_id: string): Promise<ShareStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/share/stop`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('공유 종료에 실패했습니다.')
  }

  return response.json()
}
