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
    <main className="page-shell">
      <h1>수업 목적 설정</h1>
      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          수업 제목
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="수업 제목을 입력하세요"
            required
          />
        </label>

        <label>
          학습 목표
          <textarea
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
            placeholder="학습 목표를 자세히 입력하세요"
            rows={4}
            required
          />
        </label>

        <label>
          핵심 키워드
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
            placeholder="키워드를 입력하고 Enter 또는 쉼표로 추가"
          />
        </label>

        {keywords.length > 0 && (
          <div className="tag-list">
            {keywords.map((keyword) => (
              <button type="button" key={keyword} className="tag-item" onClick={() => handleRemoveKeyword(keyword)}>
                {keyword} ×
              </button>
            ))}
          </div>
        )}

        <label>
          학습 내용
          <textarea
            value={emphasis}
            onChange={(event) => setEmphasis(event.target.value)}
            placeholder="이번 수업에서 다룰 학습 내용을 입력하세요"
            rows={4}
            required
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button className="button primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '수업 시작하기'}
        </button>
      </form>
    </main>
  )
}

export default TeacherSetup
