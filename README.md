# CLAUDE Edu

전자 칠판 판서와 교사 음성을 AI로 분석하여 구조화된 필기 노트를 생성하고,
학생 필기 피드백 및 결석생용 공유 노트까지 지원하는 교육용 웹 서비스입니다.

## 프로젝트 구조

- `backend/` - FastAPI 서버
- `frontend/` - React + Vite 클라이언트

## 설치 및 실행

### 백엔드

1. 백엔드 디렉터리로 이동합니다.
   ```bash
   cd backend
   ```
2. 필요한 패키지를 설치합니다.
   ```bash
   pip install -r requirements.txt
   ```
3. 환경 변수를 설정합니다.
   - `backend/.env` 파일에 `GEMINI_API_KEY`를 추가하세요.
4. 서버를 실행합니다.
   ```bash
   uvicorn main:app --reload --host 0.0.0.0
   ```

### 프론트엔드

1. 프론트엔드 디렉터리로 이동합니다.
   ```bash
   cd frontend
   ```
2. 패키지를 설치합니다.
   ```bash
   npm install
   ```
3. 개발 서버를 실행합니다.
   ```bash
   npm run dev
   ```

## 환경 변수

- `backend/.env`
  - `GEMINI_API_KEY` - Gemini API 키
- `frontend/.env`
  - `VITE_API_BASE_URL` - 백엔드 API 기본 URL. 외부 접속 시 `http://<백엔드_IP>:8000`로 설정하거나 비워두면 현재 접속 중인 프론트엔드 호스트를 기준으로 자동 계산합니다.

## 주요 페이지

- `/` - 홈 화면 (교사/학생 선택)
- `/setup` - 교육 목적 설정 (교사)
- `/classroom` - 화면 공유 및 OCR/STT 캡처 (교사)
- `/note-review` - 생성된 노트 검토 및 승인 (교사)
- `/feedback` - 학생 필기 피드백 입력 (학생)
- `/note/:session_id` - 결석생 공개 요약 노트 조회

## 백엔드 API

- `POST /api/session/create` - 세션 생성
- `POST /api/ocr/analyze` - 캡처 이미지 OCR 분석
- `POST /api/stt/save` - STT 텍스트 저장
- `POST /api/note/generate` - 구조화된 필기 노트 생성
- `POST /api/note/approve` - 노트 승인 저장
- `POST /api/note/share` - 결석생용 공개 요약 노트 생성
- `GET /api/note/public/{session_id}` - 공개 노트 조회
- `POST /api/feedback/analyze` - 학생 필기 피드백 생성

## 추가 정보

- 백엔드는 `google-generativeai` SDK와 `Pillow`를 사용하여 Gemini Vision 및 텍스트 생성을 호출합니다.
- 프론트엔드는 TailwindCSS 기반 UI와 Web Speech API를 사용하여 화면 공유와 실시간 음성 인식을 제공합니다.
