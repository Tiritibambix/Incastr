import { useRef } from 'react'
import { useAuthStore } from '../store/auth'

interface Props {
  src: string
  mimeType?: string | null
  poster?: string | null
  /** Fill the parent container (used in side-by-side layouts) */
  fill?: boolean
}

export default function VideoPlayer({ src, mimeType, poster, fill = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { token } = useAuthStore()
  const srcWithToken = token ? `${src}?token=${encodeURIComponent(token)}` : src

  return (
    <video
      ref={videoRef}
      controls
      className={
        fill
          ? 'w-full h-full object-contain bg-black'
          : 'block mx-auto w-auto max-w-full max-h-[calc(100vh-5rem)] rounded-lg bg-black'
      }
      poster={poster ?? undefined}
      preload="metadata"
    >
      <source src={srcWithToken} type={mimeType ?? 'video/mp4'} />
      Your browser does not support HTML5 video.
    </video>
  )
}
