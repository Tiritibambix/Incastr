import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getPublicVideo, streamUrl, thumbnailUrl } from '../api/videos'
import { getCategoryShareVideo } from '../api/categoryShares'
import { useAuthStore } from '../store/auth'
import type { VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'
import VideoPlayer from '../components/VideoPlayer'
import Description from '../components/Description'

export default function PublicVideoDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const catToken = searchParams.get('cat_token')
  const { token } = useAuthStore()
  const [video, setVideo] = useState<VideoPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const fetch = catToken
      ? getCategoryShareVideo(catToken, id)
      : getPublicVideo(id)
    fetch
      .then(({ data }) => { setVideo(data); setLoading(false) })
      .catch(() => { setError('Video not found'); setLoading(false) })
  }, [id, catToken])

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
        <VideoPlayer
          src={streamUrl(id ?? '')}
          mimeType={video.mime_type}
          poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id, { token: token ?? undefined, catToken: catToken ?? undefined }) : undefined}
          token={token}
          catToken={catToken}
        />
        <div className="mt-4">
          <h1 className="text-xl font-bold text-white">{video.title}</h1>
          {video.description && <Description text={video.description} className="mt-2 text-gray-400 text-sm" />}
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
