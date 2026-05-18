import { useRef } from 'react'

interface Props {
  src: string
  mimeType?: string | null
  poster?: string | null
}

export default function VideoPlayer({ src, mimeType, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  return (
    <video
      ref={videoRef}
      controls
      className="w-full rounded-lg bg-black"
      poster={poster ?? undefined}
      preload="metadata"
    >
      <source src={src} type={mimeType ?? 'video/mp4'} />
      Your browser does not support HTML5 video.
    </video>
  )
}
