import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function Header() {
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    setSessionId(localStorage.getItem('sessionId'))
  }, [])

  return (
    <header className="bg-slate-800 text-slate-100 shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/" className="text-xl font-semibold text-white">
            CLAUDE Edu
          </Link>
          <p className="mt-1 text-sm text-slate-300">
            현재 세션: {sessionId ?? '설정된 세션이 없습니다.'}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link to="/" className="rounded-lg bg-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-600">
            홈
          </Link>
          <Link to="/setup" className="rounded-lg bg-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-600">
            수업 만들기
          </Link>
          <Link to="/login" className="rounded-lg bg-slate-700 px-4 py-2 text-slate-100 hover:bg-slate-600">
            수업 참여
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header
