import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSharedVideo, thumbnailUrl } from '../api/videos'
import type { VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'

export default function ShareView() {
  const { token } = useParams<{ token: string }>()
  const [video, setVideo] = useState<VideoPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    getSharedVideo(token)
      .then(({ data }) => { setVideo(data); setLoading(false) })
      .catch(() => { setError('Video not found or link expired'); setLoading(false) })
  }, [token])

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
    <div className="flex flex-col md:flex-row h-screen bg-gray-950">

      {/* Video area */}
      <div className="flex-1 min-w-0 min-h-0 bg-black overflow-hidden flex items-center justify-center">
        <video
          controls
          className="w-full h-full object-contain"
          poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id) : undefined}
          preload="metadata"
        >
          <source src={`/api/videos/share/${token}/stream`} type={video.mime_type ?? 'video/mp4'} />
        </video>
      </div>

      {/* Info panel */}
      <aside className="md:w-80 lg:w-96 flex-shrink-0 bg-gray-900 border-t border-gray-800 md:border-t-0 md:border-l md:border-gray-800 overflow-y-auto">
        <div className="p-5 space-y-4">
          <Link to="/" className="text-indigo-400 font-bold text-lg block hover:text-indigo-300">
            Incastr
          </Link>

          <div>
            <h1 className="font-bold text-white text-base leading-snug">{video.title}</h1>
            {video.category && (
              <p className="text-xs text-gray-500 mt-1">{video.category}</p>
            )}
          </div>

          {video.description && (
            <p className="text-gray-400 text-sm">{video.description}</p>
          )}

          {(video.tags ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {(video.tags ?? []).map(t => <TagBadge key={t.id} name={t.name} />)}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-gray-800">
            <Link
              to="/login"
              className="block text-center w-full px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Login to access your library
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
