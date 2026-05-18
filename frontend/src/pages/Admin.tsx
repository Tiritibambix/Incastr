import { useEffect, useState } from 'react'
import { listUsers, updateUser, deleteUser } from '../api/users'
import { useAuthStore } from '../store/auth'
import type { User } from '../types'

export default function Admin() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const { user: me } = useAuthStore()

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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>
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
