import hashlib
import re

from fastapi import HTTPException

from models.session_models import OcrAnalyzeRequest, OcrExtractRequest
from services.gemini_service import analyze_image
from services.session_service import get_session, save_sessions


def _run_ocr(image_base64: str) -> str:
    prompt = (
        '이 이미지는 수업 중 칠판 사진입니다. 칠판에 적힌 텍스트, 수식, 도표를 모두 추출하고 구조화해서 반환해주세요.'
    )
    return analyze_image(image_base64, prompt)


def analyze_board_image(request: OcrAnalyzeRequest) -> str:
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')

    image_hash = hashlib.sha256(request.image_base64.encode('utf-8')).hexdigest()
    if session.last_ocr_image_hash == image_hash and session.latest_ocr_text:
        return session.latest_ocr_text

    try:
        result = _run_ocr(request.image_base64)
    except Exception as exc:
        message = str(exc)
        if '429' in message or 'quota' in message.lower():
            retry_match = re.search(r'Please retry in ([0-9.]+)s', message)
            retry_text = ''
            if retry_match:
                retry_seconds = max(1, round(float(retry_match.group(1))))
                retry_text = f' 약 {retry_seconds}초 후 다시 시도해주세요.'
            raise HTTPException(
                status_code=429,
                detail=f'OCR 요청 한도를 초과했습니다.{retry_text} 무료 티어에서는 분당 요청 수가 제한됩니다.',
            ) from exc
        raise HTTPException(status_code=500, detail=f'OCR 분석에 실패했습니다: {exc}') from exc

    session.latest_ocr_text = result
    session.last_ocr_image_hash = image_hash
    if not session.ocr_history or session.ocr_history[-1] != result:
        session.ocr_history.append(result)
    save_sessions()
    return result


def extract_image_text(request: OcrExtractRequest) -> str:
    try:
        return _run_ocr(request.image_base64)
    except Exception as exc:
        message = str(exc)
        if '429' in message or 'quota' in message.lower():
            retry_match = re.search(r'Please retry in ([0-9.]+)s', message)
            retry_text = ''
            if retry_match:
                retry_seconds = max(1, round(float(retry_match.group(1))))
                retry_text = f' 약 {retry_seconds}초 후 다시 시도해주세요.'
            raise HTTPException(
                status_code=429,
                detail=f'OCR 요청 한도를 초과했습니다.{retry_text} 무료 티어에서는 분당 요청 수가 제한됩니다.',
            ) from exc
        raise HTTPException(status_code=500, detail=f'OCR 분석에 실패했습니다: {exc}') from exc
