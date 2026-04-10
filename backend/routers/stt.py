from fastapi import APIRouter

from models.session_models import SttSaveRequest, SttSaveResponse
from services.stt_service import save_stt_text

router = APIRouter(prefix="/api/stt", tags=["stt"])

@router.post("/save", response_model=SttSaveResponse)
def save_stt(request: SttSaveRequest):
    result = save_stt_text(request)
    return SttSaveResponse(saved_text=result)
