# 프로젝트 개요
수업 중 전자칠판 화면 공유와 교사 음성을 AI로 분석하여 구조화된 필기 노트를 생성하고,
학생 필기 피드백 및 결석생 노트 공유까지 지원하는 교육용 웹 서비스입니다.
앱 이름: **NOTA**

# 기술 스택
- Frontend: React + Vite (TypeScript) / TailwindCSS / React Router / react-markdown
- Backend: Python FastAPI / Uvicorn
- AI: Google Gemini API (Vision, Text)
- 음성 인식: Web Speech API (브라우저 내장)
- 패키지 관리: npm (frontend) / pip (backend)

# 폴더 구조
/frontend
  /src
    /pages       # 각 화면 페이지
    /components  # 공통 컴포넌트
    /api         # API 호출 함수 모음
    /utils       # 세션 유틸 (session.ts)
  App.tsx
  .env           # VITE_API_BASE_URL (선택 — 비우면 현재 호스트:3000 자동 설정)

/backend
  main.py
  /routers       # 엔드포인트 라우터 (session.py, ocr.py, stt.py, note.py, feedback.py)
  /services      # 비즈니스 로직 (Gemini 호출 등)
  /models        # 요청/응답 Pydantic 모델
  .env           # GEMINI_API_KEY

# 주요 규칙
- API 호출 함수는 반드시 /frontend/src/api/ 안에 작성
- Gemini 호출 로직은 반드시 /backend/services/ 안에 작성
- 라우터는 기능 단위로 파일 분리 (ocr.py, stt.py, note.py, feedback.py)
- 환경변수는 절대 하드코딩 금지, 반드시 .env에서 불러올 것
- 세션 데이터는 메모리 딕셔너리로 관리 (DB 미사용)
- AI 응답은 반드시 마크다운 형식으로 출력, 프론트에서 react-markdown으로 렌더링

# 섹션(Section) 구조
- 수업은 시작(start)/종료(stop) 단위로 섹션이 생성됨
- 각 섹션에 저장되는 데이터:
  - name: 교사가 수업 종료 시 입력하는 섹션 이름
  - lesson_plan: 교사가 수업 시작 시 입력하는 오늘의 수업 계획
  - ocr_history: OCR 텍스트 기록
  - stt_history: STT 음성 텍스트 기록
  - board_snapshot: 칠판 스냅샷 (base64)
- 수업 종료 시 마지막 OCR 실행 후 칠판 초기화

# 엔드포인트 목록

## 세션
POST   /api/session/create              # 세션 생성
POST   /api/session/join                # 세션 참여
GET    /api/session/{id}                # 세션 정보 조회
DELETE /api/session/{id}                # 세션 삭제
POST   /api/session/{id}/start          # 수업 시작 (body: { lesson_plan })
POST   /api/session/{id}/stop           # 수업 종료 (body: { section_name })
GET    /api/session/{id}/board          # 칠판 상태 조회
PUT    /api/session/{id}/board          # 칠판 저장
DELETE /api/session/{id}/board          # 칠판 초기화
POST   /api/session/{id}/share/start    # 칠판 공유 시작
POST   /api/session/{id}/share/stop     # 칠판 공유 종료

## OCR / STT / 노트
POST /api/ocr/analyze              # 칠판 이미지 OCR
POST /api/stt/save                 # 음성 텍스트 저장
POST /api/note/generate            # AI 노트 생성
POST /api/note/approve             # 노트 승인
POST /api/note/share               # 결석생 공유 노트 생성
GET  /api/note/public/{id}         # 공개 노트 조회
POST /api/note/section-summary     # 섹션 단위 AI 요약 생성

## 피드백
POST /api/feedback/analyze         # 학생 텍스트 필기 피드백
POST /api/feedback/analyze-image   # 이미지 포함 필기 피드백
POST /api/feedback/followup        # 피드백 후속 질문

# 페이지 구조
/                  # 홈 — 수업 만들기 / 참여
/setup             # 수업 목적·키워드·강조점 설정 (교사)
/classroom         # 수업 진행 (교사: 화면 공유·OCR·STT / 학생: 칠판 보기·개인 필기)
/note-review       # 노트 검토·승인 (교사)
/feedback          # 학생 필기 피드백 (학생)
/note/:session_id  # 결석생 공개 노트

# Gemini 프롬프트 원칙
- 항상 한국어로 응답하도록 명시
- 응답은 반드시 마크다운 형식 (## 헤더, **강조** 등) 사용
- OCR: 칠판 텍스트·수식·도표 추출에 집중
- 노트 생성: lesson_plan 참고, 교육 목적 기반 구조화 (목표/핵심개념/세부내용/정리)
- 피드백: ## 누락 항목 / ## 보완 제안 / ## 잘한 점 세 섹션으로 구분
- 후속 질문: section의 lesson_plan과 OCR/STT 데이터를 컨텍스트로 활용

# 캡처 방식
- 웹캠이 아닌 화면 공유 방식 사용 (getDisplayMedia API)
- 교사가 전자칠판 프로그램 화면을 브라우저에서 직접 공유
- 10초마다 canvas로 프레임 캡처 → base64 변환 → Gemini Vision 전송
- 수업 종료 시 마지막으로 한 번 더 OCR 실행 후 칠판 초기화

# STT 구현 주의사항
- Web Speech API onresult 콜백은 클로저 문제로 stale state를 읽음
- sessionId, sttHistory 등 콜백 내부에서 읽는 값은 반드시 useRef로 관리
- ensureClassActive() 같은 isClassActive 상태 확인 로직은 콜백 내 사용 금지

# 자주 쓰는 명령어
- 백엔드 실행: cd backend && uvicorn main:app --reload
- 프론트 실행: cd frontend && npm run dev
- 패키지 설치: pip install -r requirements.txt
