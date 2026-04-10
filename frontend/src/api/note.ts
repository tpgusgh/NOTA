const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export interface NoteGenerateRequest {
  session_id: string
}

export interface NoteGenerateResponse {
  note: string
}

export interface NoteApproveRequest {
  session_id: string
  note: string
}

export interface NoteApproveResponse {
  approved: boolean
}

export interface NoteShareRequest {
  session_id: string
}

export interface NoteShareResponse {
  public_note: string
}

export interface PublicNoteResponse {
  public_note: string
}

export async function generateNote(request: NoteGenerateRequest): Promise<NoteGenerateResponse> {
  const response = await fetch(`${baseUrl}/api/note/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('노트 생성에 실패했습니다.')
  }

  return response.json()
}

export async function approveNote(request: NoteApproveRequest): Promise<NoteApproveResponse> {
  const response = await fetch(`${baseUrl}/api/note/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('노트 승인에 실패했습니다.')
  }

  return response.json()
}

export async function shareNote(request: NoteShareRequest): Promise<NoteShareResponse> {
  const response = await fetch(`${baseUrl}/api/note/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('공유 노트 생성에 실패했습니다.')
  }

  return response.json()
}

export async function fetchPublicNote(session_id: string): Promise<PublicNoteResponse> {
  const response = await fetch(`${baseUrl}/api/note/public/${session_id}`)
  if (!response.ok) {
    throw new Error('공개 노트를 불러오지 못했습니다.')
  }

  return response.json()
}
