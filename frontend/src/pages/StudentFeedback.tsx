import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { analyzeFeedbackWithImage, askFollowup } from '../api/feedback'
import { generateSectionSummary, getSessionInfo } from '../api/session'
import { getStoredFeedbackResult, getStoredSessionId, type StoredFeedbackResult } from '../utils/session'
import type { FeedbackAnalyzeResponse } from '../api/feedback'
import type { SectionListItem, SessionInfoResponse } from '../api/session'

type FeedbackLocationState = {
  feedbackResult?: StoredFeedbackResult
}

type SectionResult = {
  missing: string
  suggestions: string
  positives: string
  studentNote: string
}

function StudentFeedback() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessionId = getStoredSessionId()
  const locationState = location.state as FeedbackLocationState | null

  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null)

  // 수업 종료 직후 넘어온 피드백 결과 (기존)
  const [autoFeedbackResult] = useState<StoredFeedbackResult | null>(
    locationState?.feedbackResult ?? getStoredFeedbackResult(),
  )

  // 섹션 선택 & 비교 폼
  const [selectedSection, setSelectedSection] = useState<SectionListItem | null>(null)
  const [studentNote, setStudentNote] = useState('')
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [photoFileName, setPhotoFileName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 섹션별 결과 캐시
  const [sectionResults, setSectionResults] = useState<Record<number, SectionResult>>({})

  // 섹션 AI 요약 캐시
  const [sectionSummaries, setSectionSummaries] = useState<Record<number, string>>({})
  const [loadingSummaryIndex, setLoadingSummaryIndex] = useState<number | null>(null)

  // 후속 질문 (선택된 섹션 기준)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false)

  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    getSessionInfo(sessionId)
      .then((info) => setSessionInfo(info))
      .catch(() => setStatus('세션 정보를 불러오지 못했습니다.'))
  }, [navigate, sessionId])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (typeof result === 'string') {
        setPhotoBase64(result.split(',')[1] ?? result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitComparison = async () => {
    if (!sessionId) return
    setIsSubmitting(true)
    setStatus('')
    try {
      const result: FeedbackAnalyzeResponse = await analyzeFeedbackWithImage({
        session_id: sessionId,
        student_note: studentNote,
        image_base64: photoBase64 ?? undefined,
        section_index: selectedSection?.index,
      })
      if (selectedSection !== null) {
        setSectionResults((prev) => ({
          ...prev,
          [selectedSection.index]: {
            missing: result.missing,
            suggestions: result.suggestions,
            positives: result.positives,
            studentNote,
          },
        }))
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '피드백 분석에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGenerateSummary = async (section: SectionListItem) => {
    if (!sessionId) return
    if (sectionSummaries[section.index] !== undefined) return
    setLoadingSummaryIndex(section.index)
    try {
      const result = await generateSectionSummary(sessionId, section.index)
      setSectionSummaries((prev) => ({ ...prev, [section.index]: result.note }))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '요약 생성에 실패했습니다.')
    } finally {
      setLoadingSummaryIndex(null)
    }
  }

  const handleSelectSection = (section: SectionListItem) => {
    setSelectedSection(section)
    setStudentNote('')
    setPhotoBase64(null)
    setPhotoFileName('')
    setQuestion('')
    setAnswer('')
    setStatus('')
    // 섹션에 저장된 요약이 있으면 미리 불러오기
    if (section.has_summary && sectionSummaries[section.index] === undefined) {
      void handleGenerateSummary(section)
    }
  }

  const handleAskQuestion = async () => {
    if (!sessionId || !question.trim()) {
      setStatus('질문을 입력해주세요.')
      return
    }
    try {
      setStatus('')
      setIsLoadingAnswer(true)
      const currentNote = selectedSection !== null
        ? sectionResults[selectedSection.index]?.studentNote
        : autoFeedbackResult?.studentNote
      const result = await askFollowup({
        session_id: sessionId,
        question,
        student_note: currentNote,
      })
      setAnswer(result.answer)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '질문에 답변할 수 없습니다.')
    } finally {
      setIsLoadingAnswer(false)
    }
  }

  const sections = sessionInfo?.sections ?? []
  const currentResult = selectedSection !== null ? sectionResults[selectedSection.index] : null

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <main className="page-shell space-y-6">
      {/* 헤더 */}
      <div className="rounded-3xl bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 shadow-sm ring-1 ring-sky-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">필기 비교 & 피드백</h1>
            <p className="mt-1 text-sm text-slate-500">
              {sessionInfo?.title || '수업'} · 섹션을 선택하고 내 필기와 비교해보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            ← 대시보드
          </button>
        </div>
      </div>

      {/* 섹션 목록 */}
      {sections.length > 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <h2 className="font-bold text-slate-900">수업 섹션 선택</h2>
          <p className="mt-1 text-sm text-slate-400">비교할 수업 섹션을 선택하세요.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...sections].reverse().map((section) => {
              const isSelected = selectedSection?.index === section.index
              const hasResult = sectionResults[section.index] !== undefined
              const summary = sectionSummaries[section.index]
              const isLoadingSummary = loadingSummaryIndex === section.index

              return (
                <div
                  key={section.index}
                  className={`rounded-2xl border-2 p-4 transition ${
                    isSelected
                      ? 'border-indigo-400 bg-indigo-50/60 shadow-sm'
                      : 'border-slate-100 bg-slate-50/60 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">
                        섹션 {section.index + 1}
                        {hasResult && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            완료
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{formatDate(section.started_at)}</p>
                      <p className="text-xs text-slate-400">
                        {formatTime(section.started_at)} ~ {formatTime(section.ended_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        칠판 {section.ocr_count}건 · 음성 {section.stt_count}건
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectSection(section)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {isSelected ? '✓ 선택됨' : '비교하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleGenerateSummary(section)}
                      disabled={isLoadingSummary || summary !== undefined}
                      className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                    >
                      {isLoadingSummary ? 'AI 요약 중...' : summary ? 'AI 요약 완료' : 'AI 요약'}
                    </button>
                  </div>

                  {summary && (
                    <div className="mt-3 rounded-xl bg-violet-50/70 p-3 text-xs text-slate-600 line-clamp-4">
                      {summary}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          {/* 선택된 섹션이 있으면 비교 폼 표시 */}
          {selectedSection !== null ? (
            <>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h2 className="font-bold text-slate-900">
                  섹션 {selectedSection.index + 1} 필기 비교
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatDate(selectedSection.started_at)}&nbsp;
                  {formatTime(selectedSection.started_at)} ~ {formatTime(selectedSection.ended_at)}
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">내 필기 텍스트</label>
                    <textarea
                      className="mt-2 h-44 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                      placeholder="이 수업 시간에 적었던 필기를 입력하세요."
                      value={studentNote}
                      onChange={(e) => setStudentNote(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">필기 사진 (선택)</label>
                    <p className="mt-1 text-xs text-slate-400">
                      노트 사진을 업로드하면 AI가 내용을 인식해 함께 분석합니다.
                    </p>
                    <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/30">
                      <span className="rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                        사진 선택
                      </span>
                      <span className="text-sm text-slate-400">
                        {photoFileName || '파일을 선택하세요 (jpg, png 등)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSubmitComparison()}
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-60"
                  >
                    {isSubmitting ? 'AI 분석 중...' : '필기 비교 시작'}
                  </button>
                </div>
              </div>

              {/* 비교 결과 */}
              {currentResult && (
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h2 className="font-bold text-slate-900">비교 피드백</h2>
                  <div className="mt-4 space-y-3">
                    <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                      <h3 className="font-semibold text-rose-700">누락 항목</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{currentResult.missing}</p>
                    </section>
                    <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <h3 className="font-semibold text-amber-700">보완 제안</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{currentResult.suggestions}</p>
                    </section>
                    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <h3 className="font-semibold text-emerald-700">잘한 점</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{currentResult.positives}</p>
                    </section>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 섹션 미선택 → 수업 종료 시 자동 피드백 결과 표시 */
            <>
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h2 className="font-bold text-slate-900">학생 필기</h2>
                <p className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-slate-600">
                  {autoFeedbackResult?.studentNote || sections.length > 0
                    ? autoFeedbackResult?.studentNote || '위에서 섹션을 선택해 비교를 시작하세요.'
                    : '저장된 학생 필기가 없습니다.'}
                </p>
              </div>

              {autoFeedbackResult && (
                <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h2 className="font-bold text-slate-900">비교 피드백</h2>
                  <div className="mt-4 space-y-3">
                    <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                      <h3 className="font-semibold text-rose-700">누락 항목</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{autoFeedbackResult.missing}</p>
                    </section>
                    <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                      <h3 className="font-semibold text-amber-700">보완 제안</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{autoFeedbackResult.suggestions}</p>
                    </section>
                    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <h3 className="font-semibold text-emerald-700">잘한 점</h3>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{autoFeedbackResult.positives}</p>
                    </section>
                  </div>
                </div>
              )}

              {!autoFeedbackResult && sections.length === 0 && (
                <div className="rounded-3xl bg-slate-50 p-8 text-center text-slate-400 ring-1 ring-slate-100">
                  아직 수업 섹션이 없습니다. 수업이 진행된 후 섹션이 생성됩니다.
                </div>
              )}
            </>
          )}
        </section>

        {/* 사이드바 */}
        <aside className="space-y-6">
          {/* 선택 섹션의 AI 요약 or 교사 음성 */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="font-bold text-slate-900">
              {selectedSection !== null ? `섹션 ${selectedSection.index + 1} AI 요약` : '교사 말 텍스트'}
            </h2>
            <p className="mt-3 min-h-[180px] whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              {selectedSection !== null
                ? sectionSummaries[selectedSection.index] || '섹션 카드에서 "AI 요약" 버튼을 눌러 요약을 생성하세요.'
                : sessionInfo?.stt_history.join('\n\n') || '저장된 교사 음성 텍스트가 없습니다.'}
            </p>
          </div>

          {/* 후속 질문 */}
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <h2 className="font-bold text-slate-900">후속 질문</h2>
            <textarea
              className="mt-4 h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-100"
              placeholder="비교 결과나 수업 내용을 바탕으로 궁금한 점을 질문하세요."
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void handleAskQuestion()}
              disabled={isLoadingAnswer}
              className="mt-4 w-full rounded-2xl bg-sky-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingAnswer ? '답변 생성 중...' : '질문하기'}
            </button>

            {answer && (
              <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
                <h3 className="font-semibold text-sky-800">답변</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{answer}</p>
              </div>
            )}

            {status && <p className="mt-4 text-sm text-rose-600">{status}</p>}
          </div>
        </aside>
      </div>
    </main>
  )
}

export default StudentFeedback
