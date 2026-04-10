from fastapi import APIRouter, HTTPException
from models.session_models import (
    SessionCreateRequest,
    SessionCreateResponse,
    SessionJoinRequest,
    SessionJoinResponse,
    SessionInfoResponse,
)
from services.session_service import create_session, get_session

router = APIRouter(prefix="/api/session", tags=["session"])

@router.post("/create", response_model=SessionCreateResponse)
def create_session_endpoint(request: SessionCreateRequest):
    session_id = create_session(request)
    return SessionCreateResponse(session_id=session_id)


@router.post("/join", response_model=SessionJoinResponse)
def join_session_endpoint(request: SessionJoinRequest):
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="존재하지 않는 수업 코드입니다.")
    return SessionJoinResponse(session_id=session.session_id, title=session.title, goals=session.goals)


@router.get("/{session_id}", response_model=SessionInfoResponse)
def get_session_endpoint(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    return SessionInfoResponse(**session.dict())
