from fastapi import APIRouter

from models.session_models import OcrAnalyzeRequest, OcrAnalyzeResponse
from services.ocr_service import analyze_board_image

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

@router.post("/analyze", response_model=OcrAnalyzeResponse)
def analyze_ocr(request: OcrAnalyzeRequest):
    result = analyze_board_image(request)
    return OcrAnalyzeResponse(text=result)
