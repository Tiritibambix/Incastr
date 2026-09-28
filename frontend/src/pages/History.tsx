import { useCallback, useEffect, useState } from 'react'
import { clearWatchHistory, deleteWatchHistoryEntry, listWatchHistory } from '../api/videos'
import type { WatchHistoryEntry } from '../types'
import VideoCard from '../components/VideoCard'

const PAGE_SIZE = 16

export default function History() {
  const [entries, setEntries] = useState<WatchHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [clearing, setClearing] = useState(false)

  const loadHistory = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await listWatchHistory({ skip: (pageNum - 1) * PAGE_SIZE, limit: PAGE_SIZE })
      setEntries(Array.isArray(data) ? data : [])
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
    try {
      await deleteWatchHistoryEntry(videoId)
    } catch {
      setEntries(previous)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Clear your entire watch history?')) return
    setClearing(true)
    try {
      await clearWatchHistory()
      setEntries([])
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
        <h1 className="text-lg font-bold text-gray-900">Watch history</h1>
        {entries.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}
      {error && <p className="text-red-600 text-center py-10">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-gray-500 text-center py-20">No watch history yet.</p>
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

      {!loading && !error && (entries.length > 0 || page > 1) && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          <span className="text-sm text-gray-500 min-w-[5rem] text-center">
            Page {page}
          </span>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={entries.length < PAGE_SIZE}
            className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
