import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSharedVideo, thumbnailUrl } from '../api/videos'
import type { VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'
import VideoPlayer from '../components/VideoPlayer'
import Description from '../components/Description'

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
      <div className="min-h-screen bg-surface-alt flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    )
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-surface-alt flex flex-col items-center justify-center gap-4">
        <p className="text-text-muted">{error || 'Video not found'}</p>
        <Link to="/" className="text-accent hover:underline text-sm">← Back</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-surface-alt">

      {/* Video area */}
      <div className="flex-1 min-w-0 min-h-0 bg-black overflow-hidden flex items-center justify-center">
        <VideoPlayer
          fill
          src={`/api/videos/share/${token}/stream`}
          mimeType={video.mime_type}
          poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id, { shareToken: token }) : undefined}
          token={null}
        />
      </div>

      {/* Info panel */}
      <aside className="md:w-80 lg:w-96 flex-shrink-0 bg-surface-raised border-t border-border md:border-t-0 md:border-l overflow-y-auto">
        <div className="p-5 space-y-4">
          <Link to="/" className="text-accent font-bold text-lg block hover:text-accent-hover">
            Incastr
          </Link>

          <div>
            <h1 className="font-bold text-text text-base leading-snug">{video.title}</h1>
            {video.category && (
              <p className="text-xs text-text-muted mt-1">{video.category}</p>
            )}
          </div>

          {video.description && (
            <Description text={video.description} className="text-text-muted text-sm" />
          )}

          {(video.tags ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {(video.tags ?? []).map(t => <TagBadge key={t.id} name={t.name} />)}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Link
              to="/login"
              className="block text-center w-full px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
            >
              Login to access your library
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}
