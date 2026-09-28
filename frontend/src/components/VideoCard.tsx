import { Link } from 'react-router-dom'
import { useRef, useState } from 'react'
import type { Video, VideoPublic } from '../types'
import { scrubFrameUrl, thumbnailUrl } from '../api/videos'
import type { ThumbnailAccess } from '../api/videos'
import { useAuthStore } from '../store/auth'
import { formatDuration } from '../utils/format'
import TagBadge from './TagBadge'

const SCRUB_FRAME_COUNT = 10

type CardVideo = Video | VideoPublic

function isOwnerVideo(video: CardVideo): video is Video {
  return 'is_missing' in video
}

interface Props {
  video: CardVideo
  to: string
  variant: 'owner' | 'public'
  access?: ThumbnailAccess
}

export default function VideoCard({ video, to, variant, access }: Props) {
  const { token } = useAuthStore()
  const [scrubFrame, setScrubFrame] = useState<number | null>(null)
  const scrubUnavailableRef = useRef(false)

  const resolvedAccess = variant === 'owner' ? { token: token ?? undefined } : access

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scrubUnavailableRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 0.999)
    const frame = Math.floor(fraction * SCRUB_FRAME_COUNT)
    setScrubFrame((prev) => (prev === frame ? prev : frame))
  }

  const handleMouseLeave = () => setScrubFrame(null)

  const isMissing = variant === 'owner' && isOwnerVideo(video) && video.is_missing

  return (
    <Link
      to={to}
      className="group block bg-surface-raised rounded-xl overflow-hidden border border-border hover:border-accent/50 shadow-sm hover:shadow-lg transition-all"
    >
      <div
        className="relative aspect-video bg-black"
        onMouseMove={video.thumbnail_path ? handleMouseMove : undefined}
        onMouseLeave={video.thumbnail_path ? handleMouseLeave : undefined}
      >
        {video.thumbnail_path ? (
          <>
            <img
              src={thumbnailUrl(video.user_id, video.id, resolvedAccess)}
              alt={video.title}
              className="w-full h-full object-cover"
            />
            {scrubFrame !== null && !scrubUnavailableRef.current && (
              <img
                src={scrubFrameUrl(video.user_id, video.id, scrubFrame, resolvedAccess)}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => {
                  scrubUnavailableRef.current = true
                  setScrubFrame(null)
                }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
        {video.duration_seconds != null && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
        {variant === 'owner' && video.visibility !== 'private' && (
          <span className="absolute top-1.5 left-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded-full capitalize">
            {video.visibility}
          </span>
        )}
        {isMissing && (
          <span className="absolute top-1.5 right-1.5 bg-red-600/90 text-white text-xs px-1.5 py-0.5 rounded-full">
            File missing
          </span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="font-semibold text-sm text-text line-clamp-2 group-hover:text-accent transition-colors">
          {video.title}
        </p>
        {video.category && (
          <span className="inline-block max-w-full truncate px-2 py-0.5 rounded-full bg-surface text-text-muted text-xs">
            {video.category}
          </span>
        )}
        {(video.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {(video.tags ?? []).slice(0, 3).map((t) => (
              <TagBadge key={t.id} name={t.name} />
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
