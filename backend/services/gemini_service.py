import base64
import io
import os
import re
from pathlib import Path

import google.generativeai as genai
from PIL import Image

DEFAULT_TEXT_MODEL = 'gemini-2.5-flash'
DEFAULT_VISION_MODEL = 'gemini-2.5-flash'


def _load_local_env() -> None:
    env_candidates = [
        Path(__file__).resolve().parent.parent / '.env',
        Path(__file__).resolve().parent.parent.parent / '.env',
    ]

    for env_path in env_candidates:
        if not env_path.exists():
            continue

        for raw_line in env_path.read_text(encoding='utf-8').splitlines():
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip().removeprefix('export ').strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


def _configure_gemini() -> None:
    _load_local_env()
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.')

    genai.configure(api_key=api_key)


def _resolve_model_name(model_name: str | None, env_key: str, default_model: str) -> str:
    _load_local_env()
    return model_name or os.getenv(env_key) or default_model


def _get_model(model_name: str | None = None, env_key: str = 'GEMINI_MODEL', default_model: str = DEFAULT_TEXT_MODEL):
    _configure_gemini()
    resolved_model = _resolve_model_name(model_name, env_key, default_model)
    return genai.GenerativeModel(model_name=resolved_model)


def translate_gemini_error(error: Exception) -> tuple[int, str]:
    message = str(error)
    if '429' in message or 'quota' in message.lower() or 'resource_exhausted' in message.lower():
        retry_match = re.search(r'Please retry in ([0-9.]+)s', message)
        retry_text = ''
        if retry_match:
            retry_seconds = max(1, round(float(retry_match.group(1))))
            retry_text = f' 약 {retry_seconds}초 후 다시 시도해주세요.'
        return 429, f'Gemini 요청 한도를 초과했습니다.{retry_text} 무료 티어에서는 분당 요청 수가 제한됩니다.'

    return 500, f'Gemini 요청 처리 중 오류가 발생했습니다: {error}'


def generate_text(prompt: str, model_name: str | None = None) -> str:
    model = _get_model(model_name, 'GEMINI_MODEL', DEFAULT_TEXT_MODEL)
    response = model.generate_content(prompt)
    return getattr(response, 'text', '').strip()


def analyze_image(image_base64: str, prompt: str, model_name: str | None = None) -> str:
    if image_base64.startswith('data:'):
        image_base64 = image_base64.split(',', 1)[1]

    image_bytes = base64.b64decode(image_base64)
    with Image.open(io.BytesIO(image_bytes)) as image:
        model = _get_model(model_name, 'GEMINI_VISION_MODEL', DEFAULT_VISION_MODEL)
        response = model.generate_content([prompt, image])
        return getattr(response, 'text', '').strip()
