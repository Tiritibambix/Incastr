import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthStatus, getMe, login, register } from '../api/auth'
import { useAuthStore } from '../store/auth'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isFirstRun, setIsFirstRun] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const { setToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    getAuthStatus()
      .then(({ data }) => {
        setRegistrationOpen(data.registration_open)
        if (!data.has_users) {
          setIsFirstRun(true)
          setMode('register')
        } else if (!data.registration_open) {
          setMode('login')
        }
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await register(username, email, password)
      }
      const { data } = await login(username, password)
      setToken(data.access_token)
      const { data: user } = await getMe()
      setUser(user)
      navigate('/library')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt">
      <div className="bg-surface-raised rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-accent mb-6">Incastr</h1>

        {isFirstRun && (
          <div className="mb-4 px-3 py-2 bg-accent-soft border border-accent/30 rounded-lg text-sm text-accent">
            First run — create your admin account below.
          </div>
        )}

        {(isFirstRun || registrationOpen) && (
          <div className="flex mb-6 border-b border-border">
            <button
              className={`flex-1 pb-2 text-sm font-medium ${mode === 'login' ? 'border-b-2 border-accent text-accent' : 'text-text-muted'}`}
              onClick={() => setMode('login')}
            >
              Login
            </button>
            <button
              className={`flex-1 pb-2 text-sm font-medium ${mode === 'register' ? 'border-b-2 border-accent text-accent' : 'text-text-muted'}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-text">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-surface border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
