import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getCategoryShareVideos } from '../api/categoryShares'
import type { VideoPublic } from '../types'
import PublicHeader from '../components/PublicHeader'
import VideoCard from '../components/VideoCard'

const PAGE_SIZE = 16

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
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">{error}</p>
        <Link to="/" className="text-accent hover:underline text-sm">← Back to Incastr</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <PublicHeader breadcrumb={category || undefined} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
          </div>
        ) : videos.length === 0 && page === 1 ? (
          <p className="text-center text-text-muted py-20">No videos in this category.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  to={`/watch/${video.id}?cat_token=${encodeURIComponent(token!)}`}
                  variant="public"
                  access={{ catToken: token }}
                />
              ))}
            </div>

            {(videos.length === PAGE_SIZE || page > 1) && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border text-text rounded-lg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <span className="text-sm text-text-muted min-w-[5rem] text-center">Page {page}</span>
                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={videos.length < PAGE_SIZE}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border text-text rounded-lg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
