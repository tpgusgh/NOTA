from fastapi import HTTPException

from models.session_models import (
    FeedbackAnalyzeRequest,
    FeedbackAnalyzeResponse,
    FeedbackFollowupRequest,
    FeedbackFollowupResponse,
)
from services.feedback_utils import parse_feedback_sections
from services.gemini_service import generate_text
from services.session_service import get_session


def analyze_feedback(request: FeedbackAnalyzeRequest) -> FeedbackAnalyzeResponse:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    reference_note = session.approved_note or session.generated_note
    if not reference_note:
        raise HTTPException(status_code=400, detail='기준 노트가 아직 생성되지 않았습니다.')

    prompt = (
        '아래는 교사의 기준 필기 노트와 학생이 작성한 필기입니다. '
        '학생 필기에서 누락된 핵심 개념, 잘못 이해한 내용, 교육 목적에서 벗어난 부분을 분석하고 '
        '구체적인 보완 방법과 함께 친절하게 피드백해주세요.\n\n'
        '교사 기준 노트:\n'
        f'{reference_note}\n\n'
        '학생 필기:\n'
        f'{request.student_note}\n\n'
        '결과를 다음 세 부분으로 구분해서 작성해주세요: 누락 항목 / 보완 제안 / 잘한 점.'
    )

    feedback_text = generate_text(prompt)
    missing, suggestions, positives = parse_feedback_sections(feedback_text)
    return FeedbackAnalyzeResponse(
        missing=missing,
        suggestions=suggestions,
        positives=positives,
        raw_feedback=feedback_text,
    )


def analyze_followup(request: FeedbackFollowupRequest) -> FeedbackFollowupResponse:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    reference_note = session.approved_note or session.generated_note
    if not reference_note:
        raise HTTPException(status_code=400, detail='기준 노트가 아직 생성되지 않았습니다.')

    prompt = (
        '아래는 교사의 기준 필기 노트입니다. 학생이 작성한 필기가 있다면 함께 참고하여, '
        '학생이 추가로 묻는 질문에 답변하고 도움이 되는 학습 포인트를 제공합니다.\n\n'
        '교사 기준 노트:\n'
        f'{reference_note}\n\n'
        + (f'학생 필기:\n{request.student_note}\n\n' if request.student_note else '')
        + '질문:\n'
        f'{request.question}\n\n'
        + '이 질문에 대해 친절하고 구체적으로 답변해주세요.'
    )

    answer_text = generate_text(prompt)
    return FeedbackFollowupResponse(answer=answer_text)
