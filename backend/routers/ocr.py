from fastapi import APIRouter

from models.session_models import OcrAnalyzeRequest, OcrAnalyzeResponse, OcrExtractRequest
from services.ocr_service import analyze_board_image, extract_image_text

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

@router.post("/analyze", response_model=OcrAnalyzeResponse)
def analyze_ocr(request: OcrAnalyzeRequest):
    result = analyze_board_image(request)
    return OcrAnalyzeResponse(text=result)


@router.post("/extract", response_model=OcrAnalyzeResponse)
def extract_ocr(request: OcrExtractRequest):
    result = extract_image_text(request)
    return OcrAnalyzeResponse(text=result)
