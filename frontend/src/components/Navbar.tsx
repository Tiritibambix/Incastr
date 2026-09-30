import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useThemeStore } from '../store/theme'

function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useThemeStore()
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-surface transition-colors ${className}`}
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
  )
}

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
    navigate('/login')
  }

  const links = [
    { to: '/library', label: 'Library' },
    { to: '/history', label: 'History' },
    { to: '/shares', label: 'Shares' },
    { to: '/settings', label: 'Settings' },
    ...(user?.is_admin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bg-surface-raised border-b border-border text-text px-4 py-3">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tight text-accent">Incastr</Link>

        <div className="hidden md:flex items-center gap-4">
          {links.map(link => (
            <Link key={link.to} to={link.to} className="text-sm text-text-muted hover:text-accent transition-colors">
              {link.label}
            </Link>
          ))}
          <span className="text-sm text-text-muted">{user?.username}</span>
          <button onClick={handleLogout} className="text-sm text-text-muted hover:text-danger transition-colors">Logout</button>
          <ThemeToggle />
        </div>

        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="md:hidden p-2 -mr-2 rounded-lg text-text-muted hover:text-accent hover:bg-surface transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-border flex flex-col gap-1">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className="px-2 py-2 rounded-lg text-sm text-text-muted hover:text-accent hover:bg-surface transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center justify-between px-2 pt-2 mt-1 border-t border-border">
            <span className="text-sm text-text-muted">{user?.username}</span>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button onClick={handleLogout} className="text-sm text-text-muted hover:text-danger transition-colors">Logout</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
