const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export interface SttSaveRequest {
  text: string
  session_id: string
}

export interface SttSaveResponse {
  saved_text: string
}

export async function saveStt(request: SttSaveRequest): Promise<SttSaveResponse> {
  const response = await fetch(`${baseUrl}/api/stt/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('STT 저장에 실패했습니다.')
  }

  return response.json()
}
