import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict
from models.session_models import SessionCreateRequest, SessionData, SectionData

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'
DATA_FILE = DATA_DIR / 'sessions.json'

_sessions: Dict[str, SessionData] = {}


def _load_sessions() -> None:
    if not DATA_FILE.exists():
        return
    try:
        raw = DATA_FILE.read_text(encoding='utf-8')
        data = json.loads(raw)
        for session_id, session_data in data.items():
            _sessions[session_id] = SessionData(**session_data)
    except Exception:
        _sessions.clear()


def _save_sessions() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    serialized = {session_id: session.dict() for session_id, session in _sessions.items()}
    DATA_FILE.write_text(json.dumps(serialized, ensure_ascii=False, indent=2), encoding='utf-8')


_load_sessions()


def create_session(request: SessionCreateRequest) -> str:
    session_id = str(uuid.uuid4())
    _sessions[session_id] = SessionData(
        session_id=session_id,
        title=request.title,
        goals=request.goals,
        keywords=request.keywords,
        emphasis=request.emphasis,
    )
    _save_sessions()
    return session_id


def get_session(session_id: str) -> SessionData | None:
    return _sessions.get(session_id)


def update_board(session_id: str, board_data_url: str) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    session.board_data_url = board_data_url
    session.board_updated_at = datetime.now(timezone.utc).isoformat()
    _save_sessions()
    return session


def start_class(session_id: str, lesson_plan: str | None = None) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    session.is_class_active = True
    session.class_started_at = datetime.now(timezone.utc).isoformat()
    session.is_board_shared = True
    session.current_section_ocr_start = len(session.ocr_history)
    session.current_section_stt_start = len(session.stt_history)
    session.current_lesson_plan = lesson_plan
    _save_sessions()
    return session


def stop_class(session_id: str, section_name: str | None = None) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    if session.is_class_active and session.class_started_at:
        section = SectionData(
            index=len(session.sections),
            started_at=session.class_started_at,
            ended_at=datetime.now(timezone.utc).isoformat(),
            name=section_name,
            lesson_plan=getattr(session, 'current_lesson_plan', None),
            ocr_history=session.ocr_history[session.current_section_ocr_start:],
            stt_history=session.stt_history[session.current_section_stt_start:],
            board_snapshot=session.board_data_url,
        )
        session.sections.append(section)

    session.is_class_active = False
    session.is_board_shared = False
    session.current_lesson_plan = None
    _save_sessions()
    return session


def start_board_share(session_id: str) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    session.is_board_shared = True
    _save_sessions()
    return session


def stop_board_share(session_id: str) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    session.is_board_shared = False
    _save_sessions()
    return session


def clear_board(session_id: str) -> SessionData | None:
    session = get_session(session_id)
    if session is None:
        return None

    session.board_data_url = None
    session.board_updated_at = datetime.now(timezone.utc).isoformat()
    session.latest_ocr_text = None
    session.last_ocr_image_hash = None
    _save_sessions()
    return session


def delete_session(session_id: str) -> bool:
    if session_id not in _sessions:
        return False
    del _sessions[session_id]
    _save_sessions()
    return True


def save_sessions() -> None:
    _save_sessions()
