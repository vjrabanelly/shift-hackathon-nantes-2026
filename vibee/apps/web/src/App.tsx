import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminCreateView } from './views/AdminCreateView'
import { AdminView } from './views/AdminView'
import { JoinView } from './views/JoinView'
import { GuestView } from './views/GuestView'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/create" replace />} />
        <Route path="/admin/create" element={<AdminCreateView />} />
        <Route path="/admin/:eventId" element={<AdminView />} />
        <Route path="/join/:id" element={<JoinView />} />
        <Route path="/join/:id/play" element={<GuestView />} />
      </Routes>
    </BrowserRouter>
  )
}
