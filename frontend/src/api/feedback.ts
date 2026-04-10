const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export interface FeedbackAnalyzeRequest {
  session_id: string
  student_note: string
}

export interface FeedbackAnalyzeResponse {
  missing: string
  suggestions: string
  positives: string
  raw_feedback: string
}

export interface FeedbackFollowupRequest {
  session_id: string
  question: string
  student_note?: string
}

export interface FeedbackFollowupResponse {
  answer: string
}

export async function analyzeFeedback(request: FeedbackAnalyzeRequest): Promise<FeedbackAnalyzeResponse> {
  const response = await fetch(`${baseUrl}/api/feedback/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('피드백 분석에 실패했습니다.')
  }

  return response.json()
}

export async function askFollowup(request: FeedbackFollowupRequest): Promise<FeedbackFollowupResponse> {
  const response = await fetch(`${baseUrl}/api/feedback/followup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('추가 질문에 답변할 수 없습니다.')
  }

  return response.json()
}
