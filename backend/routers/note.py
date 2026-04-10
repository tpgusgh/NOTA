from fastapi import APIRouter, HTTPException

from models.session_models import (
    NoteGenerateRequest,
    NoteGenerateResponse,
    NoteApproveRequest,
    NoteApproveResponse,
    NoteShareRequest,
    NoteShareResponse,
    PublicNoteResponse,
    SectionSummaryRequest,
)
from services.note_service import generate_note_for_session, approve_note_for_session, share_note_for_session, generate_section_summary
from services.session_service import get_session

router = APIRouter(prefix="/api/note", tags=["note"])

@router.post("/generate", response_model=NoteGenerateResponse)
def generate_note(request: NoteGenerateRequest):
    return generate_note_for_session(request)

@router.post("/approve", response_model=NoteApproveResponse)
def approve_note(request: NoteApproveRequest):
    return approve_note_for_session(request)

@router.post("/share", response_model=NoteShareResponse)
def share_note(request: NoteShareRequest):
    return share_note_for_session(request)

@router.post("/section-summary", response_model=NoteGenerateResponse)
def generate_section_summary_endpoint(request: SectionSummaryRequest):
    return generate_section_summary(request)


@router.get("/public/{session_id}", response_model=PublicNoteResponse)
def get_public_note(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')
    if not session.public_note:
        raise HTTPException(status_code=404, detail='공개 노트가 없습니다. 먼저 공유를 생성하세요.')
    return PublicNoteResponse(public_note=session.public_note)
