from fastapi import HTTPException

from models.session_models import SttSaveRequest
from services.session_service import get_session, save_sessions


def save_stt_text(request: SttSaveRequest) -> str:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    session.stt_history.append(request.text)
    save_sessions()
    return request.text
