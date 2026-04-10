import { FormEvent, KeyboardEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession } from '../api/session'
import { setCurrentSession } from '../utils/session'

function TeacherSetup() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [goals, setGoals] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [emphasis, setEmphasis] = useState('')
  const [error, setError] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const normalizeKeyword = (value: string) => value.replace(/,$/, '').trim()

  const addKeyword = (value: string) => {
    const next = normalizeKeyword(value)
    if (!next) return
    if (keywords.includes(next)) return
    setKeywords((current) => [...current, next])
  }

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addKeyword(keywordInput)
      setKeywordInput('')
    }
  }

  const handleCompositionStart = () => setIsComposing(true)
  const handleCompositionEnd = () => setIsComposing(false)

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords((current) => current.filter((item) => item !== keyword))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await createSession({
        title,
        goals,
        keywords,
        emphasis,
      })

      setCurrentSession(result.session_id, title, 'teacher')
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-shell max-w-3xl">
      <div className="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-10 shadow-sm ring-1 ring-violet-100">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white text-xl shadow-sm">
          ✏️
        </div>
        <h1 className="text-2xl font-bold text-slate-900">새 수업 만들기</h1>
        <p className="mt-2 text-sm text-slate-500">수업 정보를 입력하고 AI가 최적화된 학습 환경을 준비합니다.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-semibold text-slate-700">수업 제목</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
              placeholder="수업 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">학습 목표</label>
            <textarea
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
              placeholder="학습 목표를 자세히 입력하세요"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">핵심 키워드</label>
            <input
              type="text"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onBlur={() => {
                addKeyword(keywordInput)
                setKeywordInput('')
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
              placeholder="키워드를 입력하고 Enter 또는 쉼표로 추가"
            />
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <button
                  type="button"
                  key={keyword}
                  onClick={() => handleRemoveKeyword(keyword)}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                >
                  {keyword} ×
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-700">학습 내용</label>
            <textarea
              value={emphasis}
              onChange={(event) => setEmphasis(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
              placeholder="이번 수업에서 다룰 학습 내용을 입력하세요"
              rows={4}
              required
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-violet-600 px-6 py-3.5 font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? '수업 생성 중...' : '수업 시작하기'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default TeacherSetup
