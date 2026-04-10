import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import TeacherSetup from './pages/TeacherSetup'
import Classroom from './pages/Classroom'
import Login from './pages/Login'
import NoteReview from './pages/NoteReview'
import StudentFeedback from './pages/StudentFeedback'
import PublicNote from './pages/PublicNote'

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<TeacherSetup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/classroom" element={<Classroom />} />
        <Route path="/note-review" element={<NoteReview />} />
        <Route path="/feedback" element={<StudentFeedback />} />
        <Route path="/note/:session_id" element={<PublicNote />} />
      </Routes>
    </div>
  )
}

export default App
