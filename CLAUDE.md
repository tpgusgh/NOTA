# 프로젝트 개요
수업 중 전자칠판 판서와 교강사 음성을 AI로 분석하여 구조화된 필기 노트를 생성하고,
학생 필기 피드백 및 결석생 노트 공유까지 지원하는 교육용 웹 서비스입니다.

# 기술 스택
- Frontend: React + Vite (TypeScript) / TailwindCSS / React Router
- Backend: Python FastAPI / Uvicorn
- AI: Google Gemini API (Vision, Text, Audio)
- 패키지 관리: npm (frontend) / pip (backend)

# 폴더 구조
/frontend
  /src
    /pages       # 각 화면 페이지
    /components  # 공통 컴포넌트
    /api         # API 호출 함수 모음
  App.tsx
  .env           # VITE_API_BASE_URL

/backend
  main.py
  /routers       # 엔드포인트 라우터
  /services      # 비즈니스 로직 (Gemini 호출 등)
  /models        # 요청/응답 Pydantic 모델
  .env           # GEMINI_API_KEY

# 주요 규칙
- API 호출 함수는 반드시 /frontend/src/api/ 안에 작성
- Gemini 호출 로직은 반드시 /backend/services/ 안에 작성
- 라우터는 기능 단위로 파일 분리 (ocr.py, stt.py, note.py, feedback.py)
- 환경변수는 절대 하드코딩 금지, 반드시 .env에서 불러올 것
- 세션 데이터는 현재 메모리 딕셔너리로 관리 (DB 미사용)

# 엔드포인트 목록
POST /api/session/create       # 세션 생성
POST /api/ocr/analyze          # 칠판 이미지 OCR
POST /api/stt/save             # 음성 텍스트 저장
POST /api/note/generate        # AI 노트 생성
POST /api/note/approve         # 노트 승인
POST /api/note/share           # 결석생 공유 노트 생성
GET  /api/note/public/{id}     # 공개 노트 조회
POST /api/feedback/analyze     # 학생 필기 피드백

# 페이지 구조
/                  # 홈 (교강사/학생 선택)
/setup             # 교육 목적 설정
/classroom         # 수업 진행 (웹캠 + 녹화)
/note-review       # 노트 검토·승인
/feedback          # 학생 필기 피드백
/note/:session_id  # 결석생 공개 노트

# Gemini 프롬프트 원칙
- 항상 한국어로 응답하도록 프롬프트에 명시
- OCR: 칠판 텍스트·수식·도표 추출에 집중
- 노트 생성: 교육 목적 기반 구조화 (목표/핵심개념/세부내용/정리)
- 피드백: 누락 항목·보완 제안·잘한 점 세 가지로 구분

# 자주 쓰는 명령어
- 백엔드 실행: cd backend && uvicorn main:app --reload
- 프론트 실행: cd frontend && npm run dev
- 패키지 설치: pip install -r requirements.txt


# 캡처 방식
- 웹캠이 아닌 화면 공유 방식 사용 (getDisplayMedia API)
- 교강사가 전자 칠판 프로그램 화면을 브라우저에서 직접 공유
- 10초마다 canvas로 프레임 캡처 → base64 변환 → Gemini Vision 전송
- 화면 공유 종료 시 녹화 자동 중단 처리 필요