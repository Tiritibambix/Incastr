import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useThemeStore } from '../store/theme'

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-surface-raised border-b border-border text-text px-4 py-3 flex items-center justify-between">
      <Link to="/" className="text-xl font-bold tracking-tight text-accent">Incastr</Link>
      <div className="flex items-center gap-4">
        <Link to="/library" className="text-sm text-text-muted hover:text-accent transition-colors">Library</Link>
        <Link to="/history" className="text-sm text-text-muted hover:text-accent transition-colors">History</Link>
        <Link to="/settings" className="text-sm text-text-muted hover:text-accent transition-colors">Settings</Link>
        {user?.is_admin && (
          <Link to="/admin" className="text-sm text-text-muted hover:text-accent transition-colors">Admin</Link>
        )}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-surface transition-colors"
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <span className="text-sm text-text-muted">{user?.username}</span>
        <button onClick={handleLogout} className="text-sm text-text-muted hover:text-red-400 transition-colors">Logout</button>
      </div>
    </nav>
  )
}
