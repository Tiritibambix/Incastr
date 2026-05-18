import { useEffect, useState } from 'react'
import { listFolders, createFolder, deleteFolder } from '../api/folders'
import { scanAll, scanFolder } from '../api/scan'
import type { Folder } from '../types'

export default function Settings() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [scanStatus, setScanStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listFolders().then(({ data }) => setFolders(Array.isArray(data) ? data : []))
  }, [])

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPath.trim() || !newLabel.trim()) return
    try {
      const { data } = await createFolder(newPath.trim(), newLabel.trim())
      setFolders((prev) => [...prev, data])
      setNewPath('')
      setNewLabel('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Failed to add folder')
    }
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Remove this folder? Videos indexed from it will remain in the library.')) return
    await deleteFolder(id)
    setFolders((prev) => prev.filter((f) => f.id !== id))
  }

  const handleScanAll = async () => {
    setLoading(true)
    setScanStatus('')
    try {
      const { data } = await scanAll()
      setScanStatus(`Scan complete: ${data.added} added, ${data.updated} updated (${data.scanned} files scanned)`)
    } catch {
      setScanStatus('Scan failed')
    } finally {
      setLoading(false)
    }
  }

  const handleScanOne = async (folderId: string) => {
    setLoading(true)
    setScanStatus('')
    try {
      const { data } = await scanFolder(folderId)
      setScanStatus(`Scan complete: ${data.added} added, ${data.updated} updated (${data.scanned} files scanned)`)
    } catch {
      setScanStatus('Scan failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Video Folders</h2>
          <button
            onClick={handleScanAll}
            disabled={loading}
            className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Scanning...' : 'Scan all'}
          </button>
        </div>

        {scanStatus && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
            {scanStatus}
          </p>
        )}

        <ul className="divide-y border rounded-lg overflow-hidden mb-4">
          {folders.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No folders configured</li>
          )}
          {folders.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3 bg-white">
              <div>
                <p className="font-medium text-sm text-gray-900">{f.label}</p>
                <p className="text-xs text-gray-500 font-mono">{f.path}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleScanOne(f.id)}
                  disabled={loading}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Scan
                </button>
                <button
                  onClick={() => handleDeleteFolder(f.id)}
                  className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={handleAddFolder} className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="/media/videos"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  )
}
