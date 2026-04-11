# NOTA

전자칠판 화면 공유와 교사 음성을 AI로 분석하여 구조화된 필기 노트를 생성하고,
학생 필기 피드백 및 결석생용 공유 노트까지 지원하는 교육용 웹 서비스입니다.

## 프로젝트 구조

```
/backend
  main.py
  /routers        - 엔드포인트 라우터 (session, ocr, stt, note, feedback)
  /services       - Gemini 호출 등 비즈니스 로직
  /models         - Pydantic 요청/응답 모델
  .env            - GEMINI_API_KEY

/frontend
  /src
    /pages        - 각 화면 페이지
    /components   - 공통 컴포넌트
    /api          - API 호출 함수
    /utils        - 세션 유틸
  .env            - VITE_API_BASE_URL (선택)
```

## 설치 및 실행

### 백엔드

```bash
cd backend
pip install -r requirements.txt
# backend/.env 에 GEMINI_API_KEY 설정
uvicorn main:app --reload --host 0.0.0.0
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

## 환경 변수

| 파일 | 키 | 설명 |
|------|----|------|
| `backend/.env` | `GEMINI_API_KEY` | Google Gemini API 키 |
| `frontend/.env` | `VITE_API_BASE_URL` | 백엔드 URL (비우면 현재 호스트 기준 `:3000` 자동 설정) |

## 주요 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 화면 — 수업 만들기 / 참여 |
| `/setup` | 수업 목적·키워드 설정 (교사) |
| `/classroom` | 수업 진행 화면 (교사: 화면 공유·OCR·STT / 학생: 칠판 보기·필기) |
| `/note-review` | 생성된 노트 검토·승인 (교사) |
| `/feedback` | 학생 필기 피드백 (학생) |
| `/note/:session_id` | 결석생 공개 요약 노트 |

## 주요 기능

### 교사
- **수업 시작**: 오늘 수업 계획(lesson plan) 입력 → AI가 이를 참고해 피드백·요약 생성
- **화면 공유**: getDisplayMedia API로 전자칠판 화면 공유, 10초마다 자동 OCR
- **음성 인식**: Web Speech API로 실시간 STT 기록
- **칠판 공유**: 학생에게 현재 칠판 화면 실시간 공개
- **수업 종료**: 마지막 OCR 후 섹션 이름 입력 → 섹션으로 저장
- **노트 생성·승인**: 섹션별 AI 요약 노트 생성 및 승인

### 학생
- **칠판 보기**: 교사가 공유한 칠판 실시간 조회
- **개인 필기**: 개인 캔버스에 직접 필기
- **피드백**: 텍스트 필기·사진 업로드 후 AI 피드백 (누락/보완/잘한 점)
- **후속 질문**: 피드백 결과 기반 AI에게 추가 질문 가능
- **공개 노트**: 결석 시 공개 요약 노트 조회

## 섹션(Section) 구조

수업은 시작/종료 단위로 **섹션**이 생성됩니다.
각 섹션에는 수업 계획, OCR 기록, STT 기록, 칠판 스냅샷, 섹션 이름이 저장됩니다.

## 백엔드 API

### 세션

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/session/create` | 세션 생성 |
| POST | `/api/session/join` | 세션 참여 |
| GET | `/api/session/{id}` | 세션 정보 조회 |
| DELETE | `/api/session/{id}` | 세션 삭제 |
| POST | `/api/session/{id}/start` | 수업 시작 (lesson_plan 포함) |
| POST | `/api/session/{id}/stop` | 수업 종료 (section_name 포함) |
| GET | `/api/session/{id}/board` | 칠판 상태 조회 |
| PUT | `/api/session/{id}/board` | 칠판 저장 |
| DELETE | `/api/session/{id}/board` | 칠판 초기화 |
| POST | `/api/session/{id}/share/start` | 칠판 공유 시작 |
| POST | `/api/session/{id}/share/stop` | 칠판 공유 종료 |

### OCR / STT / 노트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/ocr/analyze` | 캡처 이미지 OCR 분석 |
| POST | `/api/stt/save` | STT 텍스트 저장 |
| POST | `/api/note/generate` | 구조화된 노트 생성 |
| POST | `/api/note/approve` | 노트 승인 저장 |
| POST | `/api/note/share` | 결석생용 공개 노트 생성 |
| GET | `/api/note/public/{id}` | 공개 노트 조회 |
| POST | `/api/note/section-summary` | 섹션 단위 AI 요약 생성 |

### 피드백

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/feedback/analyze` | 텍스트 필기 피드백 |
| POST | `/api/feedback/analyze-image` | 이미지 포함 필기 피드백 |
| POST | `/api/feedback/followup` | 피드백 후속 질문 |

## 기술 스택

- **Frontend**: React + Vite (TypeScript), TailwindCSS, React Router, react-markdown
- **Backend**: Python FastAPI, Uvicorn
- **AI**: Google Gemini API (Vision, Text)
- **음성 인식**: Web Speech API (브라우저 내장)
- **화면 캡처**: getDisplayMedia API → Canvas → base64
