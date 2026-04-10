from fastapi import APIRouter, HTTPException
from models.session_models import (
    BoardStateResponse,
    BoardUpdateRequest,
    BoardUpdateResponse,
    ClassStateResponse,
    ShareStateResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionJoinRequest,
    SessionJoinResponse,
    SessionInfoResponse,
)
from services.session_service import (
    clear_board,
    create_session,
    get_session,
    start_board_share,
    start_class,
    stop_board_share,
    stop_class,
    update_board,
)

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


@router.get("/{session_id}/board", response_model=BoardStateResponse)
def get_board_endpoint(session_id: str):
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    return BoardStateResponse(
        board_data_url=session.board_data_url,
        board_updated_at=session.board_updated_at,
        latest_ocr_text=session.latest_ocr_text,
    )


@router.put("/{session_id}/board", response_model=BoardUpdateResponse)
def update_board_endpoint(session_id: str, request: BoardUpdateRequest):
    if request.session_id != session_id:
        raise HTTPException(status_code=400, detail="세션 ID가 일치하지 않습니다.")

    session = update_board(session_id, request.board_data_url)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return BoardUpdateResponse(
        board_data_url=session.board_data_url,
        board_updated_at=session.board_updated_at,
    )


@router.delete("/{session_id}/board", response_model=BoardUpdateResponse)
def clear_board_endpoint(session_id: str):
    session = clear_board(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return BoardUpdateResponse(
        board_data_url=session.board_data_url,
        board_updated_at=session.board_updated_at,
    )


@router.post("/{session_id}/start", response_model=ClassStateResponse)
def start_class_endpoint(session_id: str):
    session = start_class(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return ClassStateResponse(
        is_class_active=session.is_class_active,
        class_started_at=session.class_started_at,
    )


@router.post("/{session_id}/share/start", response_model=ShareStateResponse)
def start_share_endpoint(session_id: str):
    session = start_board_share(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return ShareStateResponse(is_board_shared=session.is_board_shared)


@router.post("/{session_id}/share/stop", response_model=ShareStateResponse)
def stop_share_endpoint(session_id: str):
    session = stop_board_share(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return ShareStateResponse(is_board_shared=session.is_board_shared)


@router.post("/{session_id}/stop", response_model=ClassStateResponse)
def stop_class_endpoint(session_id: str):
    session = stop_class(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    return ClassStateResponse(
        is_class_active=session.is_class_active,
        class_started_at=session.class_started_at,
    )
