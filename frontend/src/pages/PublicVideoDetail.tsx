import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getPublicVideo, streamUrl, thumbnailUrl } from '../api/videos'
import { useAuthStore } from '../store/auth'
import type { VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'

export default function PublicVideoDetail() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuthStore()
  const [video, setVideo] = useState<VideoPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getPublicVideo(id)
      .then(({ data }) => { setVideo(data); setLoading(false) })
      .catch(() => { setError('Video not found'); setLoading(false) })
  }, [id])

  const src = id
    ? token
      ? `${streamUrl(id)}?token=${encodeURIComponent(token)}`
      : `/api/videos/${id}/stream`
    : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-400" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">{error || 'Video not found'}</p>
        <Link to="/" className="text-indigo-400 hover:underline text-sm">← Back</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-indigo-400 font-bold text-lg">Incastr</Link>
        <Link
          to="/login"
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Login
        </Link>
      </header>
      <div className="max-w-4xl mx-auto px-4 pb-8">
        <video
          controls
          className="block mx-auto w-auto max-w-full max-h-[calc(100vh-8rem)] rounded-lg bg-black"
          poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id) : undefined}
          preload="metadata"
          autoPlay={false}
        >
          <source src={src} type={video.mime_type ?? 'video/mp4'} />
        </video>
        <div className="mt-4">
          <h1 className="text-xl font-bold text-white">{video.title}</h1>
          {video.description && <p className="mt-2 text-gray-400 text-sm">{video.description}</p>}
          {video.category && <p className="mt-1 text-xs text-gray-500">{video.category}</p>}
          {(video.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {(video.tags ?? []).map(t => <TagBadge key={t.id} name={t.name} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
