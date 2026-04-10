const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`

export interface OcrAnalyzeRequest {
  image_base64: string
  session_id: string
}

export interface OcrAnalyzeResponse {
  text: string
}

export async function analyzeOcr(request: OcrAnalyzeRequest): Promise<OcrAnalyzeResponse> {
  const response = await fetch(`${baseUrl}/api/ocr/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('OCR 분석에 실패했습니다.')
  }

  return response.json()
}
