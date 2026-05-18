import { Link } from 'react-router-dom'
import type { Video } from '../types'
import { thumbnailUrl } from '../api/videos'
import TagBadge from './TagBadge'

interface Props {
  video: Video
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoCard({ video }: Props) {
  return (
    <Link to={`/videos/${video.id}`} className="group block bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition-shadow">
      <div className="relative aspect-video bg-gray-900">
        {video.thumbnail_path ? (
          <img
            src={thumbnailUrl(video.user_id, video.id)}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
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
        {video.visibility !== 'private' && (
          <span className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded capitalize">
            {video.visibility}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600">{video.title}</p>
        {video.category && (
          <p className="text-xs text-gray-500 mt-1 truncate">{video.category}</p>
        )}
        {(video.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(video.tags ?? []).slice(0, 3).map((t) => (
              <TagBadge key={t.id} name={t.name} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
