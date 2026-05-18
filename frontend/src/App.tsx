import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { getMe } from './api/auth'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Home from './pages/Home'
import VideoDetail from './pages/VideoDetail'
import PublicVideoDetail from './pages/PublicVideoDetail'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import ShareView from './pages/ShareView'

function ProtectedLayout() {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Outlet />
    </div>
  )
}

function AdminRoute() {
  const { user } = useAuthStore()
  if (!user?.is_admin) return <Navigate to="/library" replace />
  return <Outlet />
}

export default function App() {
  const { token, setUser } = useAuthStore()

  useEffect(() => {
    if (token) {
      getMe().then(({ data }) => setUser(data)).catch(() => {})
    }
  }, [token, setUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/watch/:id" element={<PublicVideoDetail />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/library" element={<Home />} />
          <Route path="/videos/:id" element={<VideoDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
