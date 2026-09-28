import { useEffect, useState } from 'react'
import { listFolders, createFolder, deleteFolder } from '../api/folders'
import { regenerateThumbnails, scanAll, scanFolder, type ScanResult } from '../api/scan'
import { deleteVideo, listDuplicateVideos } from '../api/videos'
import { formatFileSize } from '../utils/format'
import type { DuplicateGroup, Folder } from '../types'

type StatusLevel = 'success' | 'warning' | 'error'
interface ScanStatus {
  level: StatusLevel
  message: string
}

function describeScanResult(data: ScanResult): ScanStatus {
  if (data.error === 'folder_unreachable') {
    return { level: 'error', message: 'Folder is not accessible — check that the path exists and is readable.' }
  }
  if (data.errors?.length) {
    const labels = data.errors.map((e) => e.label).join(', ')
    return { level: 'error', message: `Some folders could not be scanned: ${labels}.` }
  }
  const base = `Scan complete: ${data.added} added, ${data.updated} updated (${data.scanned} files scanned)`
  if (data.warning) {
    return { level: 'warning', message: `${base}. ${data.warning}` }
  }
  if (data.warnings?.length) {
    const labels = data.warnings.map((w) => w.label).join(', ')
    return { level: 'warning', message: `${base}. Some subfolders could not be fully read: ${labels}.` }
  }
  return { level: 'success', message: base }
}

const STATUS_STYLES: Record<StatusLevel, string> = {
  success: 'text-success bg-success-soft border-success/30',
  warning: 'text-warning bg-warning-soft border-warning/30',
  error: 'text-danger bg-danger-soft border-danger/30',
}

export default function Settings() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [newPath, setNewPath] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [folderError, setFolderError] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [duplicatesLoading, setDuplicatesLoading] = useState(true)
  const [duplicatesError, setDuplicatesError] = useState('')

  useEffect(() => {
    listFolders()
      .then(({ data }) => setFolders(Array.isArray(data) ? data : []))
      .catch(() => setLoadError('Failed to load folders'))
      .finally(() => setInitialLoading(false))
    listDuplicateVideos()
      .then(({ data }) => setDuplicates(Array.isArray(data) ? data : []))
      .catch(() => setDuplicatesError('Failed to load duplicates'))
      .finally(() => setDuplicatesLoading(false))
  }, [])

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPath.trim() || !newLabel.trim()) return
    setFolderError('')
    try {
      const { data } = await createFolder(newPath.trim(), newLabel.trim())
      setFolders((prev) => [...prev, data])
      setNewPath('')
      setNewLabel('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFolderError(msg ?? 'Failed to add folder')
    }
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Remove this folder? Videos indexed from it will remain in the library.')) return
    setFolderError('')
    try {
      await deleteFolder(id)
      setFolders((prev) => prev.filter((f) => f.id !== id))
    } catch {
      setFolderError('Failed to remove folder')
    }
  }

  const handleScanAll = async () => {
    setLoading(true)
    setScanStatus(null)
    try {
      const { data } = await scanAll()
      setScanStatus(describeScanResult(data))
    } catch {
      setScanStatus({ level: 'error', message: 'Scan failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleScanOne = async (folderId: string) => {
    setLoading(true)
    setScanStatus(null)
    try {
      const { data } = await scanFolder(folderId)
      setScanStatus(describeScanResult(data))
    } catch {
      setScanStatus({ level: 'error', message: 'Scan failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDuplicate = async (videoId: string, deleteFile: boolean) => {
    if (!confirm(deleteFile ? 'Delete this file from disk permanently?' : 'Remove this video from the library? The file stays on disk.')) return
    try {
      await deleteVideo(videoId, deleteFile)
      setDuplicates((prev) =>
        prev
          .map((g) => ({ ...g, videos: g.videos.filter((v) => v.id !== videoId) }))
          .filter((g) => g.videos.length > 1)
      )
    } catch {
      setDuplicatesError('Failed to delete video')
    }
  }

  const handleRegenerateThumbnails = async () => {
    setLoading(true)
    setScanStatus(null)
    try {
      const { data } = await regenerateThumbnails()
      setScanStatus({
        level: 'success',
        message:
          data.queued === 0
            ? 'All thumbnails are already generated.'
            : `Thumbnail generation queued for ${data.queued} video${data.queued !== 1 ? 's' : ''}.`,
      })
    } catch {
      setScanStatus({ level: 'error', message: 'Failed to queue thumbnail generation' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text mb-6">Settings</h1>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Video Folders</h2>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerateThumbnails}
              disabled={loading}
              className="px-4 py-1.5 border border-border text-text text-sm rounded-lg hover:bg-surface disabled:opacity-50"
              title="Generate missing thumbnails for all indexed videos"
            >
              {loading ? '…' : 'Regenerate thumbnails'}
            </button>
            <button
              onClick={handleScanAll}
              disabled={loading}
              className="px-4 py-1.5 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? 'Scanning...' : 'Scan all'}
            </button>
          </div>
        </div>

        {scanStatus && (
          <p className={`text-sm border rounded-lg px-3 py-2 mb-4 ${STATUS_STYLES[scanStatus.level]}`}>
            {scanStatus.message}
          </p>
        )}
        {folderError && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 mb-4">
            {folderError}
          </p>
        )}

        {initialLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : loadError ? (
          <p className="text-sm text-danger text-center py-6">{loadError}</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden mb-4">
            {folders.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">No folders configured</li>
            )}
            {folders.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3 bg-surface-raised">
                <div>
                  <p className="font-medium text-sm text-text">{f.label}</p>
                  <p className="text-xs text-text-muted font-mono">{f.path}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleScanOne(f.id)}
                    disabled={loading}
                    className="px-2 py-1 text-xs border border-border text-text rounded hover:bg-surface disabled:opacity-50"
                  >
                    Scan
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(f.id)}
                    className="px-2 py-1 text-xs border border-danger/30 text-danger rounded hover:bg-danger-soft"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddFolder} className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label"
            className="w-32 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="/media/videos"
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text font-mono focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover"
          >
            Add
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text mb-4">Possible Duplicates</h2>

        {duplicatesError && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 mb-4">
            {duplicatesError}
          </p>
        )}

        {duplicatesLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : duplicates.length === 0 ? (
          <p className="text-sm text-text-muted">No duplicate videos found.</p>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group) => (
              <div key={`${group.filename}-${group.file_size_bytes}`} className="border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-surface border-b border-border">
                  <p className="font-medium text-sm text-text font-mono truncate">{group.filename}</p>
                  <p className="text-xs text-text-muted">{formatFileSize(group.file_size_bytes)} &middot; {group.videos.length} copies</p>
                </div>
                <ul className="divide-y divide-border">
                  {group.videos.map((v) => (
                    <li key={v.id} className="flex items-center justify-between px-4 py-2.5 bg-surface-raised">
                      <div className="min-w-0">
                        <p className="text-sm text-text truncate">{v.category || 'Uncategorized'}</p>
                        <p className="text-xs text-text-muted font-mono truncate">{v.filepath}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDeleteDuplicate(v.id, false)}
                          className="px-2 py-1 text-xs border border-border text-text rounded hover:bg-surface"
                          title="Remove from library, keep the file on disk"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => handleDeleteDuplicate(v.id, true)}
                          className="px-2 py-1 text-xs border border-danger/30 text-danger rounded hover:bg-danger-soft"
                          title="Delete the file from disk"
                        >
                          Delete file
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
