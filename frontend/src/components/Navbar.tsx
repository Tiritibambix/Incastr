import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold tracking-tight text-indigo-400">Incastr</Link>
      <div className="flex items-center gap-4">
        <Link to="/library" className="text-sm hover:text-indigo-300">Library</Link>
        <Link to="/settings" className="text-sm hover:text-indigo-300">Settings</Link>
        {user?.is_admin && (
          <Link to="/admin" className="text-sm hover:text-indigo-300">Admin</Link>
        )}
        <span className="text-sm text-gray-400">{user?.username}</span>
        <button onClick={handleLogout} className="text-sm hover:text-red-400">Logout</button>
      </div>
    </nav>
  )
}
