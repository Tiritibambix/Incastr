import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'

interface Props {
  breadcrumb?: string
}

export default function PublicHeader({ breadcrumb }: Props) {
  const { user } = useAuthStore()

  return (
    <header className="bg-surface-raised border-b border-border px-6 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <Link to="/" className="text-xl font-bold text-accent flex-shrink-0">
          Incastr
        </Link>
        {breadcrumb && (
          <>
            <span className="text-text-muted flex-shrink-0">/</span>
            <span className="text-text font-medium truncate">{breadcrumb}</span>
          </>
        )}
      </div>
      <Link
        to={user ? '/library' : '/login'}
        className="flex-shrink-0 px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
      >
        {user ? 'My Library' : 'Login'}
      </Link>
    </header>
  )
}
