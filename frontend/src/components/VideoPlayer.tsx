import { useRef } from 'react'
import { useAuthStore } from '../store/auth'

interface Props {
  src: string
  mimeType?: string | null
  poster?: string | null
}

export default function VideoPlayer({ src, mimeType, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { token } = useAuthStore()
  const srcWithToken = token ? `${src}?token=${encodeURIComponent(token)}` : src

  return (
    <video
      ref={videoRef}
      controls
      className="w-full rounded-lg bg-black"
      poster={poster ?? undefined}
      preload="metadata"
    >
      <source src={srcWithToken} type={mimeType ?? 'video/mp4'} />
      Your browser does not support HTML5 video.
    </video>
  )
}
