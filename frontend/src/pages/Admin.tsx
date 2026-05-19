import { useEffect, useState } from 'react'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import { useAuthStore } from '../store/auth'
import type { User } from '../types'

export default function Admin() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { user: me } = useAuthStore()

  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    listUsers().then(({ data }) => {
      setUsers(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }, [])

  const handleToggleAdmin = async (user: User) => {
    const { data } = await updateUser(user.id, { is_admin: !user.is_admin })
    setUsers((prev) => prev.map((u) => (u.id === data.id ? data : u)))
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"? All their videos and data will be removed.`)) return
    await deleteUser(user.id)
    setUsers((prev) => prev.filter((u) => u.id !== user.id))
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <button
          onClick={() => { setShowForm(v => !v); setCreateError('') }}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New user'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 border rounded-lg p-4 bg-gray-50 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Create new user</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              placeholder="Username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="password"
              required
              placeholder="Password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create user'}
            </button>
          </div>
        </form>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => {
              const isSelf = user.id === me?.id
              return (
                <tr key={user.id} className="bg-white">
                  <td className="px-4 py-3 font-medium">
                    {user.username}
                    {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${user.is_admin ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleToggleAdmin(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot change your own role' : undefined}
                        className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {user.is_admin ? 'Revoke admin' : 'Make admin'}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={isSelf}
                        title={isSelf ? 'Cannot delete your own account' : undefined}
                        className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
