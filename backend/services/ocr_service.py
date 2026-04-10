from fastapi import HTTPException

from models.session_models import OcrAnalyzeRequest
from services.gemini_service import analyze_image
from services.session_service import get_session, save_sessions


def analyze_board_image(request: OcrAnalyzeRequest) -> str:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    prompt = (
        '이 이미지는 수업 중 칠판 사진입니다. 칠판에 적힌 텍스트, 수식, 도표를 모두 추출하고 구조화해서 반환해주세요.'
    )
    result = analyze_image(request.image_base64, prompt)
    session.ocr_history.append(result)
    save_sessions()
    return result
