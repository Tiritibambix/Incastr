import { useCallback, useEffect, useState } from 'react'
import { clearWatchHistory, deleteWatchHistoryEntry, listWatchHistory } from '../api/videos'
import type { WatchHistoryEntry } from '../types'
import VideoCard from '../components/VideoCard'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 16

export default function History() {
  const [entries, setEntries] = useState<WatchHistoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)

  const loadHistory = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await listWatchHistory({ skip: (pageNum - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      setEntries(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load watch history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadHistory(1) }, [loadHistory])

  const goToPage = (p: number) => {
    setPage(p)
    loadHistory(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRemove = async (videoId: string) => {
    const previous = entries
    setEntries((prev) => prev.filter((e) => e.video.id !== videoId))
    setTotal((prev) => Math.max(0, prev - 1))
    try {
      await deleteWatchHistoryEntry(videoId)
    } catch {
      setEntries(previous)
      setTotal((prev) => prev + 1)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Clear your entire watch history?')) return
    setClearing(true)
    try {
      await clearWatchHistory()
      setEntries([])
      setTotal(0)
      setPage(1)
    } catch {
      setError('Failed to clear watch history')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-text">Watch history</h1>
        {entries.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-sm text-danger hover:opacity-80 disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
        </div>
      )}
      {error && <p className="text-danger text-center py-10">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-text-muted text-center py-20">No watch history yet.</p>
      )}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {entries.map((entry) => (
            <div key={entry.video.id} className="relative group">
              <VideoCard video={entry.video} to={`/videos/${entry.video.id}`} variant="owner" />
              <button
                onClick={() => handleRemove(entry.video.id)}
                title="Remove from history"
                className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (total > 0 || page > 1) && (
        <Pagination
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={goToPage}
        />
      )}
    </div>
  )
}
