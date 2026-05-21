import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategoryShareVideos } from '../api/categoryShares'
import { thumbnailUrl } from '../api/videos'
import type { VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'

const PAGE_SIZE = 16

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CategoryShareView() {
  const { token } = useParams<{ token: string }>()
  const [videos, setVideos] = useState<VideoPublic[]>([])
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (pageNum: number) => {
    if (!token) return
    setLoading(true)
    try {
      const { data } = await getCategoryShareVideos(token, (pageNum - 1) * PAGE_SIZE, PAGE_SIZE)
      const list = Array.isArray(data) ? data : []
      setVideos(list)
      if (list[0]?.category) setCategory(list[0].category)
    } catch {
      setError('Link not found or expired')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load(1) }, [load])

  const goToPage = (p: number) => {
    setPage(p)
    load(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading && page === 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{error}</p>
        <Link to="/" className="text-indigo-600 hover:underline text-sm">← Back to Incastr</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xl font-bold text-indigo-600">Incastr</Link>
          {category && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-gray-700 font-medium">{category}</span>
            </>
          )}
        </div>
        <Link
          to="/login"
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Login
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : videos.length === 0 && page === 1 ? (
          <p className="text-center text-gray-500 py-20">No videos in this category.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map(video => (
                <Link
                  key={video.id}
                  to={`/watch/${video.id}?cat_token=${encodeURIComponent(token!)}`}
                  className="group block bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-video bg-gray-900">
                    {video.thumbnail_path ? (
                      <img
                        src={thumbnailUrl(video.user_id, video.id)}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                      </div>
                    )}
                    {video.duration_seconds && (
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600">{video.title}</p>
                    {video.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{video.description}</p>
                    )}
                    {(video.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(video.tags ?? []).slice(0, 3).map(t => <TagBadge key={t.id} name={t.name} />)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {(videos.length === PAGE_SIZE || page > 1) && (
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
                <span className="text-sm text-gray-500 min-w-[5rem] text-center">Page {page}</span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={videos.length < PAGE_SIZE}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
