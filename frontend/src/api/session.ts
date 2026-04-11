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

export interface SectionListItem {
  index: number
  started_at: string
  ended_at: string
  name?: string
  lesson_plan?: string
  has_summary: boolean
  ocr_count: number
  stt_count: number
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
  sections: SectionListItem[]
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

const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:3000`

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

export async function startClass(session_id: string, lesson_plan?: string): Promise<ClassStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson_plan: lesson_plan ?? null }),
  })

  if (!response.ok) {
    throw new Error('수업 시작에 실패했습니다.')
  }

  return response.json()
}

export async function stopClass(session_id: string, section_name?: string): Promise<ClassStateResponse> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section_name: section_name ?? null }),
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

export async function deleteSession(session_id: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/session/${session_id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '수업 삭제에 실패했습니다.')
  }
}

export async function generateSectionSummary(session_id: string, section_index: number): Promise<{ note: string }> {
  const response = await fetch(`${baseUrl}/api/note/section-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, section_index }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || '섹션 요약 생성에 실패했습니다.')
  }

  return response.json()
}
