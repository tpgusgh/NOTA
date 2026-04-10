from fastapi import HTTPException

from models.session_models import (
    NoteGenerateRequest,
    NoteGenerateResponse,
    NoteApproveRequest,
    NoteApproveResponse,
    NoteShareRequest,
    NoteShareResponse,
)
from services.gemini_service import generate_text, translate_gemini_error
from services.session_service import get_session, save_sessions


def _build_note_prompt(session) -> str:
    ocr_text = '\n'.join(session.ocr_history) if session.ocr_history else '칠판 판서 정보가 없습니다.'
    stt_text = '\n'.join(session.stt_history) if session.stt_history else '교사 음성이 아직 없습니다.'
    keywords = ', '.join(session.keywords) if session.keywords else '없음'

    return (
        f'당신은 교육 전문가입니다. 아래는 수업의 교육 목적, 칠판 판서 내용, 교사 음성 내용입니다.\n'
        f'교육 목적:\n'
        f'수업 제목: {session.title}\n'
        f'학습 목표: {session.goals}\n'
        f'핵심 키워드: {keywords}\n'
        f'강조 개념: {session.emphasis}\n\n'
        f'칠판 판서 내용:\n{ocr_text}\n\n'
        f'교사 음성 내용:\n{stt_text}\n\n'
        f'교육 목적에 맞게 핵심 개념 중심으로 구조화된 필기 노트를 생성해주세요.\n'
        f'형식: 제목 / 학습 목표 / 핵심 개념 / 세부 내용 / 정리'
    )


def generate_note_for_session(request: NoteGenerateRequest) -> NoteGenerateResponse:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    prompt = _build_note_prompt(session)
    try:
        note_text = generate_text(prompt)
    except Exception as exc:
        status_code, message = translate_gemini_error(exc)
        raise HTTPException(status_code=status_code, detail=message) from exc
    session.generated_note = note_text
    save_sessions()
    return NoteGenerateResponse(note=note_text)


def approve_note_for_session(request: NoteApproveRequest) -> NoteApproveResponse:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')
    session.approved_note = request.note
    save_sessions()
    return NoteApproveResponse(approved=True)


def share_note_for_session(request: NoteShareRequest) -> NoteShareResponse:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')
    if not session.approved_note:
        raise HTTPException(status_code=400, detail='승인된 노트가 없습니다.')

    prompt = (
        '결석생이 이해하기 쉬운 요약 노트를 만들어주세요. 아래는 교사의 승인된 기준 필기 노트입니다.\n'
        f'{session.approved_note}\n\n'
        '결석생용으로 제목, 개요, 핵심 개념, 학습 포인트를 포함한 요약 노트를 생성해주세요.'
    )
    try:
        public_note = generate_text(prompt)
    except Exception as exc:
        status_code, message = translate_gemini_error(exc)
        raise HTTPException(status_code=status_code, detail=message) from exc
    session.public_note = public_note
    save_sessions()
    return NoteShareResponse(public_note=public_note)
