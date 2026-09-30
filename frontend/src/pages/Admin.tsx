import { useEffect, useState } from 'react'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import { useAuthStore } from '../store/auth'
import type { User } from '../types'

export default function Admin() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const { user: me } = useAuthStore()

  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    listUsers()
      .then(({ data }) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setLoadError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggleAdmin = async (user: User) => {
    setActionError('')
    try {
      const { data } = await updateUser(user.id, { is_admin: !user.is_admin })
      setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
    } catch {
      setActionError('Failed to update user role')
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"? All their videos and data will be removed.`)) return
    setActionError('')
    try {
      await deleteUser(user.id)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch {
      setActionError('Failed to delete user')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const { data } = await createUser(newUsername.trim(), newEmail.trim(), newPassword)
      setUsers((prev) => [...prev, data])
      setNewUsername('')
      setNewEmail('')
      setNewPassword('')
      setShowForm(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCreateError(msg ?? 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-center py-20 text-danger">{loadError}</p>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">User Management</h1>
        <button
          onClick={() => { setShowForm(v => !v); setCreateError('') }}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          {showForm ? 'Cancel' : '+ New user'}
        </button>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2">
          {actionError}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 border border-border rounded-lg p-4 bg-surface space-y-3">
          <h2 className="text-sm font-semibold text-text">Create new user</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="px-3 py-2 bg-surface-raised border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          {createError && <p className="text-sm text-danger">{createError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Username</th>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Email</th>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Role</th>
              <th className="text-left px-4 py-3 font-medium text-text-muted">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === me?.id
              return (
                <tr key={user.id} className="bg-surface-raised">
                  <td className="px-4 py-3 font-medium text-text">
                    {user.username}
                    {isSelf && <span className="ml-1 text-xs text-text-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${user.is_admin ? 'bg-accent-soft text-accent' : 'bg-surface text-text-muted'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot change your own role' : undefined}
                        className="px-2 py-1 text-xs border border-border text-text rounded hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {user.is_admin ? 'Revoke admin' : 'Make admin'}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot delete your own account' : undefined}
                        className="px-2 py-1 text-xs border border-danger/30 text-danger rounded hover:bg-danger-soft disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
