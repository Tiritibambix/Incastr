import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/auth'
import { updateWatchProgress } from '../api/videos'
import { formatDuration } from '../utils/format'

interface Props {
  src: string
  mimeType?: string | null
  poster?: string | null
  /** Fill the parent container (used in side-by-side layouts) */
  fill?: boolean
  /** Owner JWT appended as ?token=. Defaults to the logged-in user's token; pass null to suppress. */
  token?: string | null
  /** Category-share token appended as ?cat_token=. */
  catToken?: string | null
  /** Enables throttled progress-save + resume prompt. Owner playback context only (VideoDetail) — omit elsewhere. */
  videoId?: string
  /** Last saved playback position for this video, from VideoOut.resume_position_seconds. */
  resumePositionSeconds?: number | null
}

const SPEED_STEPS = [0.5, 1, 1.25, 1.5, 2] as const

const VOLUME_KEY = 'incastr_volume'
const MUTED_KEY = 'incastr_muted'
const SEEK_SECONDS = 5
const VOLUME_STEP = 0.05
const PROGRESS_SAVE_INTERVAL_MS = 10000
const RESUME_MIN_SECONDS = 5

export default function VideoPlayer({ src, mimeType, poster, fill = false, token, catToken, videoId, resumePositionSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { token: ownJwt } = useAuthStore()
  const [speed, setSpeed] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [resumePromptOpen, setResumePromptOpen] = useState(false)
  const lastSavedAtRef = useRef(0)

  const effectiveToken = token !== undefined ? token : ownJwt
  const params = new URLSearchParams()
  if (effectiveToken) params.set('token', effectiveToken)
  if (catToken) params.set('cat_token', catToken)
  const qs = params.toString()
  const srcWithAccess = qs ? `${src}?${qs}` : src

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    try {
      const savedVolume = localStorage.getItem(VOLUME_KEY)
      const savedMuted = localStorage.getItem(MUTED_KEY)
      if (savedVolume !== null) video.volume = Number(savedVolume)
      if (savedMuted !== null) video.muted = savedMuted === 'true'
    } catch {
      // localStorage unavailable — fall back to browser defaults
    }

    const handleVolumeChange = () => {
      try {
        localStorage.setItem(VOLUME_KEY, String(video.volume))
        localStorage.setItem(MUTED_KEY, String(video.muted))
      } catch {
        // ignore storage errors (private browsing, quota, etc.)
      }
    }
    video.addEventListener('volumechange', handleVolumeChange)
    return () => video.removeEventListener('volumechange', handleVolumeChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.playbackRate = speed
  }, [speed])

  useEffect(() => {
    lastSavedAtRef.current = 0
    setResumePromptOpen(!!videoId && !!resumePositionSeconds && resumePositionSeconds > RESUME_MIN_SECONDS)
  }, [videoId, resumePositionSeconds])

  const saveProgress = () => {
    const video = videoRef.current
    if (!videoId || !video) return
    lastSavedAtRef.current = Date.now()
    updateWatchProgress(videoId, Math.floor(video.currentTime)).catch(() => {
      // best-effort — a missed save just delays resume accuracy
    })
  }

  const handleTimeUpdate = () => {
    if (!videoId) return
    if (Date.now() - lastSavedAtRef.current >= PROGRESS_SAVE_INTERVAL_MS) saveProgress()
  }

  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video || !resumePromptOpen || resumePositionSeconds == null) return
    if (video.duration && resumePositionSeconds >= video.duration - 3) setResumePromptOpen(false)
  }

  const handleResume = () => {
    const video = videoRef.current
    if (video && resumePositionSeconds != null) {
      video.currentTime = resumePositionSeconds
      video.play()
    }
    setResumePromptOpen(false)
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      container.requestFullscreen()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        if (video.paused) video.play(); else video.pause()
        break
      case 'ArrowLeft':
        e.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - SEEK_SECONDS)
        break
      case 'ArrowRight':
        e.preventDefault()
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + SEEK_SECONDS)
        break
      case 'ArrowUp':
        e.preventDefault()
        video.volume = Math.min(1, video.volume + VOLUME_STEP)
        break
      case 'ArrowDown':
        e.preventDefault()
        video.volume = Math.max(0, video.volume - VOLUME_STEP)
        break
      case 'f':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        video.muted = !video.muted
        break
    }
  }

  return (
    <div
      ref={containerRef}
      className={fill ? 'relative w-full h-full' : 'relative inline-block w-full'}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
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
        onTimeUpdate={handleTimeUpdate}
        onPause={saveProgress}
        onLoadedMetadata={handleLoadedMetadata}
      >
        <source src={srcWithAccess} type={mimeType ?? 'video/mp4'} />
        Your browser does not support HTML5 video.
      </video>

      {resumePromptOpen && resumePositionSeconds != null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 rounded-lg shadow-xl px-5 py-4 text-center">
            <p className="text-white text-sm mb-3">Resume from {formatDuration(resumePositionSeconds)}?</p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleResume}
                className="px-4 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent-hover transition-colors"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => setResumePromptOpen(false)}
                className="px-4 py-1.5 text-xs font-medium bg-white/10 text-white rounded hover:bg-white/20 transition-colors"
              >
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSpeedMenu((v) => !v)}
            className="px-2 py-1 text-xs font-medium bg-black/60 text-white rounded hover:bg-black/80 transition-colors"
            title="Playback speed"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute right-0 mt-1 bg-black/90 rounded-lg overflow-hidden shadow-lg">
              {SPEED_STEPS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSpeed(s); setShowSpeedMenu(false) }}
                  className={`block w-full px-3 py-1.5 text-xs text-left whitespace-nowrap transition-colors ${
                    s === speed ? 'text-accent font-semibold' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 bg-black/60 text-white rounded hover:bg-black/80 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V5m0 4H5m4 0L4 4m11 5V5m0 4h4m-4 0l5-5M9 15v4m0-4H5m4 0l-5 5m11-5v4m0-4h4m-4 0l5 5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
