import base64
import io
import os

import google.generativeai as genai
from PIL import Image


def _configure_gemini() -> None:
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.')

    genai.configure(api_key=api_key)


def _get_model(model_name: str = 'models/gemini-1.5-flash'):
    _configure_gemini()
    return genai.GenerativeModel(model_name=model_name)


def generate_text(prompt: str, model_name: str = 'models/gemini-1.5-flash') -> str:
    model = _get_model(model_name)
    response = model.generate_content(prompt)
    return getattr(response, 'text', '').strip()


def analyze_image(image_base64: str, prompt: str, model_name: str = 'models/gemini-1.5-flash') -> str:
    if image_base64.startswith('data:'):
        image_base64 = image_base64.split(',', 1)[1]

    image_bytes = base64.b64decode(image_base64)
    with Image.open(io.BytesIO(image_bytes)) as image:
        model = _get_model(model_name)
        response = model.generate_content([prompt, image])
        return getattr(response, 'text', '').strip()
