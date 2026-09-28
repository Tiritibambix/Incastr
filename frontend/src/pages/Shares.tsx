import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listCategoryShares,
  revokeCategoryShare,
  updateCategoryShare,
} from '../api/categoryShares'
import { listUnlistedVideos, thumbnailUrl, updateVideo } from '../api/videos'
import type { CategoryShare, Video } from '../types'
import { shareStatus } from '../utils/shareStatus'
import { copyToClipboard } from '../utils/clipboard'
import { useAuthStore } from '../store/auth'

type ShareStatus = ReturnType<typeof shareStatus>

const STATUS_LABEL: Record<ShareStatus, string> = {
  active: 'Active',
  disabled: 'Disabled',
  expired: 'Expired',
}

const STATUS_STYLES: Record<ShareStatus, string> = {
  active: 'text-success bg-success-soft',
  disabled: 'text-text-muted bg-surface',
  expired: 'text-warning bg-warning-soft',
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function Shares() {
  const { token } = useAuthStore()

  const [shares, setShares] = useState<CategoryShare[]>([])
  const [sharesLoading, setSharesLoading] = useState(true)
  const [sharesError, setSharesError] = useState('')
  const [savingToken, setSavingToken] = useState<string | null>(null)
  const [copiedShareToken, setCopiedShareToken] = useState<string | null>(null)

  const [unlisted, setUnlisted] = useState<Video[]>([])
  const [unlistedLoading, setUnlistedLoading] = useState(true)
  const [unlistedError, setUnlistedError] = useState('')
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null)

  useEffect(() => {
    listCategoryShares()
      .then(({ data }) => setShares(Array.isArray(data) ? data : []))
      .catch(() => setSharesError('Failed to load share links'))
      .finally(() => setSharesLoading(false))
    listUnlistedVideos()
      .then(({ data }) => setUnlisted(Array.isArray(data) ? data : []))
      .catch(() => setUnlistedError('Failed to load unlisted videos'))
      .finally(() => setUnlistedLoading(false))
  }, [])

  const handleNameBlur = async (share: CategoryShare, value: string) => {
    const newName = value.trim() || null
    if (newName === share.name) return
    setSavingToken(share.token)
    try {
      const { data } = await updateCategoryShare(share.token, { name: newName })
      setShares((prev) => prev.map((s) => (s.token === share.token ? data : s)))
    } catch {
      setSharesError('Failed to update name')
    } finally {
      setSavingToken(null)
    }
  }

  const handleToggleEnabled = async (share: CategoryShare) => {
    setSavingToken(share.token)
    try {
      const { data } = await updateCategoryShare(share.token, { enabled: !share.enabled })
      setShares((prev) => prev.map((s) => (s.token === share.token ? data : s)))
    } catch {
      setSharesError('Failed to update share')
    } finally {
      setSavingToken(null)
    }
  }

  const handleSetExpiry = async (share: CategoryShare, value: string) => {
    setSavingToken(share.token)
    try {
      const { data } = await updateCategoryShare(share.token, {
        expires_at: value ? new Date(value).toISOString() : null,
      })
      setShares((prev) => prev.map((s) => (s.token === share.token ? data : s)))
    } catch {
      setSharesError('Failed to update expiry')
    } finally {
      setSavingToken(null)
    }
  }

  const handleRevoke = async (share: CategoryShare) => {
    if (!confirm('Remove this share link permanently?')) return
    try {
      await revokeCategoryShare(share.token)
      setShares((prev) => prev.filter((s) => s.token !== share.token))
    } catch {
      setSharesError('Failed to delete share link')
    }
  }

  const handleCopyShareLink = async (share: CategoryShare) => {
    await copyToClipboard(`${window.location.origin}/c/${share.token}`)
    setCopiedShareToken(share.token)
    setTimeout(() => setCopiedShareToken(null), 2000)
  }

  const expiryInputValue = (share: CategoryShare) =>
    share.expires_at ? new Date(share.expires_at).toISOString().slice(0, 16) : ''

  const handleCopyVideoLink = async (video: Video) => {
    await copyToClipboard(`${window.location.origin}/share/${video.share_token}`)
    setCopiedVideoId(video.id)
    setTimeout(() => setCopiedVideoId(null), 2000)
  }

  const handleDeleteShare = async (video: Video) => {
    if (!confirm('Delete this share link? The video will become private and the link will stop working.')) return
    try {
      await updateVideo(video.id, { visibility: 'private' })
      setUnlisted((prev) => prev.filter((v) => v.id !== video.id))
    } catch {
      setUnlistedError('Failed to update video')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-text mb-6">Shares</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-text mb-4">Category share links</h2>

        {sharesError && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 mb-4">
            {sharesError}
          </p>
        )}

        {sharesLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden mb-4">
            {shares.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">No share links yet</li>
            )}
            {shares.map((share) => {
              const status = shareStatus(share)
              return (
                <li key={share.token} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-surface-raised">
                  <div className="min-w-0 flex-1">
                    <input
                      key={share.token}
                      defaultValue={share.name ?? ''}
                      placeholder={share.category}
                      onBlur={(e) => handleNameBlur(share, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      className="w-full bg-transparent font-medium text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent rounded px-1 -mx-1"
                    />
                    <p className="text-xs text-text-muted font-mono truncate px-1">{share.category}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status]}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleCopyShareLink(share)}
                      title="Copy link"
                      className="p-1.5 rounded hover:bg-surface text-text-muted hover:text-accent transition-colors"
                    >
                      {copiedShareToken === share.token ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    <input
                      type="datetime-local"
                      value={expiryInputValue(share)}
                      onChange={(e) => handleSetExpiry(share, e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      title="Expiry date"
                      className="px-2 py-1 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <button
                      onClick={() => handleToggleEnabled(share)}
                      disabled={savingToken === share.token}
                      className="px-2 py-1 text-xs border border-border text-text rounded hover:bg-surface disabled:opacity-50 transition-colors"
                    >
                      {share.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleRevoke(share)}
                      title="Delete share link"
                      className="p-1.5 rounded hover:bg-danger-soft text-text-muted hover:text-danger transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-text mb-4">Video share links</h2>

        {unlistedError && (
          <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-lg px-3 py-2 mb-4">
            {unlistedError}
          </p>
        )}

        {unlistedLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {unlisted.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">No unlisted videos</li>
            )}
            {unlisted.map((video) => (
              <li key={video.id} className="flex items-center gap-3 px-4 py-3 bg-surface-raised">
                <Link
                  to={`/videos/${video.id}`}
                  className="w-20 aspect-video bg-black rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                  {video.thumbnail_path && (
                    <img
                      src={thumbnailUrl(video.user_id, video.id, { token: token ?? undefined })}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text truncate">{video.title}</p>
                  {video.category && <p className="text-xs text-text-muted truncate">{video.category}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopyVideoLink(video)}
                    title="Copy link"
                    className="p-1.5 rounded hover:bg-surface text-text-muted hover:text-accent transition-colors"
                  >
                    {copiedVideoId === video.id ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <button
                    onClick={() => handleDeleteShare(video)}
                    className="px-2 py-1 text-xs border border-danger/30 text-danger rounded hover:bg-danger-soft transition-colors"
                  >
                    Delete share
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
