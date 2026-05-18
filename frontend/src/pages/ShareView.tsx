import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedVideo } from '../api/videos'
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
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }
  if (error || !video) {
    return <p className="text-center py-20 text-gray-500">{error || 'Video not found'}</p>
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-indigo-400 font-bold text-lg mb-4">Incastr</p>
        <video
          controls
          className="w-full rounded-lg bg-black"
          preload="metadata"
        >
          <source src={`/api/videos/share/${token}/stream`} type="video/mp4" />
        </video>
        <div className="mt-4">
          <h1 className="text-xl font-bold text-white">{video.title}</h1>
          {video.description && <p className="mt-2 text-gray-400 text-sm">{video.description}</p>}
          {video.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {video.tags.map((t) => <TagBadge key={t.id} name={t.name} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
