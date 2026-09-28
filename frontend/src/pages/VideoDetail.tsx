import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVideo, updateVideo, deleteVideo, addTag, removeTag, moveVideoCategory, renameVideoFile, streamUrl, thumbnailUrl } from '../api/videos'
import { listCategories } from '../api/videos'
import { listTags, createTag } from '../api/tags'
import { useAuthStore } from '../store/auth'
import { copyToClipboard } from '../utils/clipboard'
import { shareStatus } from '../utils/shareStatus'
import type { Video, Tag, Visibility } from '../types'
import VideoPlayer from '../components/VideoPlayer'
import TagBadge from '../components/TagBadge'
import Description from '../components/Description'

const VISIBILITY_OPTIONS: Visibility[] = ['private', 'public', 'unlisted']

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [video, setVideo] = useState<Video | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [newTagName, setNewTagName] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [justCopied, setJustCopied] = useState(false)
  const [savingShare, setSavingShare] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteFromDisk, setDeleteFromDisk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  // File operations
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [movingCategory, setMovingCategory] = useState('')
  const [moveError, setMoveError] = useState('')
  const [moving, setMoving] = useState(false)
  const [newFilename, setNewFilename] = useState('')
  const [renameError, setRenameError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError('')
    Promise.all([getVideo(id), listTags(), listCategories()])
      .then(([{ data: v }, { data: tags }, { data: cats }]) => {
        setVideo(v)
        setTitle(v.title)
        setDescription(v.description ?? '')
        setVisibility(v.visibility)
        setMovingCategory(v.category ?? '')
        setNewFilename(v.filename)
        setAllTags(Array.isArray(tags) ? tags : [])
        setAvailableCategories(Array.isArray(cats) ? cats : [])
      })
      .catch(() => setLoadError('Failed to load video'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!video) return
    setSaving(true)
    const { data } = await updateVideo(video.id, { title, description, visibility })
    setVideo(data)
    setEditing(false)
    setSaving(false)
  }

  const handleAddTag = async (tag: Tag) => {
    if (!video) return
    const { data } = await addTag(video.id, tag.id)
    setVideo(data)
  }

  const handleRemoveTag = async (tagId: string) => {
    if (!video) return
    const { data } = await removeTag(video.id, tagId)
    setVideo(data)
  }

  const handleCreateAndAddTag = async () => {
    if (!video || !newTagName.trim()) return
    const { data: tag } = await createTag(newTagName.trim())
    setAllTags((prev) => [...prev, tag])
    const { data } = await addTag(video.id, tag.id)
    setVideo(data)
    setNewTagName('')
  }

  const handleMoveCategory = async () => {
    if (!video) return
    setMoving(true)
    setMoveError('')
    try {
      const cat = movingCategory.trim() || null
      const { data } = await moveVideoCategory(video.id, cat)
      setVideo(data)
      setMovingCategory(data.category ?? '')
      // Refresh category list in case a new folder was created
      const { data: cats } = await listCategories()
      setAvailableCategories(Array.isArray(cats) ? cats : [])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMoveError(msg ?? 'Move failed')
    } finally {
      setMoving(false)
    }
  }

  const handleRenameFile = async () => {
    if (!video || !newFilename.trim()) return
    setRenameError('')
    try {
      const { data } = await renameVideoFile(video.id, newFilename.trim())
      setVideo(data)
      setTitle(data.title)
      setNewFilename(data.filename)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setRenameError(msg ?? 'Rename failed')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!video) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteVideo(video.id, deleteFromDisk)
      navigate('/library')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setDeleteError(msg ?? 'Delete failed')
      setDeleting(false)
    }
  }

  const openShareModal = async () => {
    if (!video) return
    if (video.visibility !== 'unlisted') {
      setSavingShare(true)
      try {
        const { data } = await updateVideo(video.id, { visibility: 'unlisted' })
        setVideo(data)
        setVisibility(data.visibility)
      } finally {
        setSavingShare(false)
      }
    }
    setJustCopied(false)
    setShareModalOpen(true)
  }

  const handleCopyShareLink = async () => {
    if (!video) return
    await copyToClipboard(`${window.location.origin}/share/${video.share_token}`)
    setJustCopied(true)
    setTimeout(() => setJustCopied(false), 2500)
  }

  const handleSetShareName = async (value: string) => {
    if (!video) return
    const trimmed = value.trim()
    if (trimmed === (video.share_name ?? '')) return
    setSavingShare(true)
    try {
      const { data } = await updateVideo(video.id, { share_name: trimmed || null })
      setVideo(data)
    } finally {
      setSavingShare(false)
    }
  }

  const handleToggleShareEnabled = async () => {
    if (!video) return
    setSavingShare(true)
    try {
      const { data } = await updateVideo(video.id, { share_enabled: !video.share_enabled })
      setVideo(data)
    } finally {
      setSavingShare(false)
    }
  }

  const handleSetShareExpiry = async (value: string) => {
    if (!video) return
    setSavingShare(true)
    try {
      const { data } = await updateVideo(video.id, {
        share_expires_at: value ? new Date(value).toISOString() : null,
      })
      setVideo(data)
    } finally {
      setSavingShare(false)
    }
  }

  const handleRevokeShare = async () => {
    if (!video) return
    if (!confirm('Remove this share link permanently?')) return
    const { data } = await updateVideo(video.id, { visibility: 'private' })
    setVideo(data)
    setVisibility(data.visibility)
    setShareModalOpen(false)
  }

  const shareExpiryInputValue = () =>
    video?.share_expires_at ? new Date(video.share_expires_at).toISOString().slice(0, 16) : ''

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    )
  }
  if (loadError) return <p className="text-center py-20 text-danger">{loadError}</p>
  if (!video) return <p className="text-center py-20 text-text-muted">Video not found</p>

  const unattachedTags = allTags.filter((t) => !(video.tags ?? []).find((vt) => vt.id === t.id))
  const videoShareStatus = shareStatus(video.share_enabled, video.share_expires_at)

  return (
    <>
      {/* Full-viewport layout: video left, info panel right */}
      <div className="flex flex-col md:flex-row h-[calc(100vh-3rem)]">

        {/* Video area — fills remaining space */}
        <div className="flex-1 min-w-0 min-h-0 bg-black overflow-hidden">
          <VideoPlayer
            fill
            src={streamUrl(video.id)}
            mimeType={video.mime_type}
            poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id, { token: token ?? undefined }) : undefined}
            videoId={video.id}
            resumePositionSeconds={video.resume_position_seconds}
          />
        </div>

        {/* Info panel — fixed width, scrolls independently */}
        <aside className="md:w-80 lg:w-96 flex-shrink-0 bg-surface-raised border-t border-border md:border-t-0 md:border-l overflow-y-auto">
          <div className="p-4 space-y-5">

            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full font-bold px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Description"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text resize-none"
                />
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text"
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-hover disabled:opacity-50">
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-border text-text text-sm rounded-lg hover:bg-surface">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h1 className="font-bold text-text text-base leading-snug">{video.title}</h1>
                {video.description && (
                  <Description text={video.description} className="text-text-muted text-sm" />
                )}
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="capitalize">{video.visibility}</span>
                  {video.category && <><span>·</span><span>{video.category}</span></>}
                  {video.is_missing && (
                    <>
                      <span>·</span>
                      <span className="text-danger font-medium">File missing</span>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs border border-border text-text rounded-lg hover:bg-surface">
                    Edit
                  </button>
                  <button
                    onClick={openShareModal}
                    disabled={savingShare}
                    title={video.visibility === 'unlisted' ? 'Manage share' : 'Share video'}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 ${
                      video.visibility === 'unlisted'
                        ? videoShareStatus === 'active' ? 'border-accent/30 text-accent bg-accent-soft'
                          : videoShareStatus === 'disabled' ? 'border-border text-text-muted'
                          : 'border-warning/30 text-warning bg-warning-soft'
                        : 'border-border text-text hover:bg-surface'
                    }`}
                  >
                    {video.visibility === 'unlisted' ? 'Share link' : 'Share'}
                  </button>
                  <button
                    onClick={() => { setDeleteFromDisk(false); setDeleteError(''); setShowDeleteModal(true) }}
                    className="px-3 py-1.5 text-xs border border-danger/30 text-danger rounded-lg hover:bg-danger-soft"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {(video.tags ?? []).map((t) => (
                  <TagBadge key={t.id} name={t.name} onRemove={() => handleRemoveTag(t.id)} />
                ))}
              </div>
              <div className="space-y-2">
                <select
                  className="w-full px-2 py-1.5 bg-surface border border-border rounded-lg text-sm text-text"
                  value=""
                  onChange={(e) => {
                    const tag = allTags.find((t) => t.id === e.target.value)
                    if (tag) handleAddTag(tag)
                  }}
                >
                  <option value="">Add existing tag…</option>
                  {unattachedTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="New tag"
                    className="flex-1 px-2 py-1.5 bg-surface border border-border rounded-lg text-sm text-text"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndAddTag() }}
                  />
                  <button onClick={handleCreateAndAddTag} className="px-3 py-1.5 bg-surface text-text text-sm rounded-lg hover:bg-surface-alt">
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* ── File management ── */}
            <div className="border-t border-border pt-4 space-y-4">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">File</p>

              {/* Move to category */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Category</label>
                <div className="flex gap-2">
                  <input
                    list="category-list"
                    value={movingCategory}
                    onChange={e => setMovingCategory(e.target.value)}
                    placeholder="No category"
                    className="flex-1 px-2 py-1.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <datalist id="category-list">
                    {availableCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <button
                    onClick={handleMoveCategory}
                    disabled={moving || movingCategory === (video.category ?? '')}
                    className="px-3 py-1.5 bg-surface text-text text-sm rounded-lg hover:bg-surface-alt disabled:opacity-40"
                  >
                    {moving ? '…' : 'Move'}
                  </button>
                </div>
                {moveError && <p className="mt-1 text-xs text-danger">{moveError}</p>}
              </div>

              {/* Rename file */}
              <div>
                <label className="block text-xs text-text-muted mb-1">Filename</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFilename}
                    onChange={e => setNewFilename(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameFile() }}
                    className="flex-1 px-2 py-1.5 bg-surface border border-border rounded-lg text-sm text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={handleRenameFile}
                    disabled={!newFilename.trim() || newFilename === video.filename}
                    className="px-3 py-1.5 bg-surface text-text text-sm rounded-lg hover:bg-surface-alt disabled:opacity-40"
                  >
                    Rename
                  </button>
                </div>
                {renameError && <p className="mt-1 text-xs text-danger">{renameError}</p>}
              </div>
            </div>

          </div>
        </aside>
      </div>

      {shareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="bg-surface-raised rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <input
                key={video.id}
                type="text"
                defaultValue={video.share_name ?? ''}
                placeholder={video.title}
                onBlur={e => handleSetShareName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="flex-1 min-w-0 font-semibold text-text bg-transparent rounded px-1 -mx-1 focus:outline-none focus:ring-2 focus:ring-accent placeholder:font-normal placeholder:text-text-muted"
              />
              <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                videoShareStatus === 'active' ? 'bg-success-soft text-success'
                : videoShareStatus === 'disabled' ? 'bg-surface text-text-muted'
                : 'bg-warning-soft text-warning'
              }`}>
                {videoShareStatus === 'active' ? 'Active' : videoShareStatus === 'disabled' ? 'Disabled' : 'Expired'}
              </span>
            </div>
            <p className="text-xs text-text-muted -mt-3 mb-4">
              Private label, visible only to you. The public page shows &quot;{video.title}&quot;.
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={handleCopyShareLink}
                disabled={videoShareStatus !== 'active'}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  justCopied ? 'bg-success-soft text-success border-success/30'
                  : videoShareStatus === 'active' ? 'bg-accent-soft text-accent border-accent/30 hover:bg-accent-soft/70'
                  : 'bg-surface text-text-muted border-border cursor-not-allowed'
                }`}
              >
                {justCopied
                  ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Copied!</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy link</>
                }
              </button>
              <button
                onClick={handleToggleShareEnabled}
                disabled={savingShare}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                  video.share_enabled ? 'border-border text-text-muted hover:bg-surface' : 'border-accent/30 text-accent bg-accent-soft hover:bg-accent-soft/70'
                }`}
              >
                {video.share_enabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-text-muted mb-1.5">Expiry date (optional)</label>
              <input
                type="datetime-local"
                value={shareExpiryInputValue()}
                onChange={e => handleSetShareExpiry(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {video.share_expires_at && (
                <button
                  onClick={() => handleSetShareExpiry('')}
                  className="mt-1.5 text-xs text-text-muted hover:text-danger"
                >
                  Clear expiry
                </button>
              )}
            </div>

            <div className="flex gap-2 justify-between items-center">
              <button
                onClick={handleRevokeShare}
                className="text-sm text-danger hover:opacity-80 transition-colors"
              >
                Delete share link
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-2 text-sm border border-border text-text rounded-lg hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-raised rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-text mb-1">Delete video</h2>
            <p className="text-sm text-text-muted mb-4">
              Remove <span className="font-medium text-text">{video.title}</span> from your library?
            </p>
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteFromDisk}
                onChange={(e) => setDeleteFromDisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-danger focus:ring-danger"
              />
              <span className="text-sm text-text">
                Also delete from hard drive.{' '}
                <span className="text-danger font-medium">This can't be undone.</span>
              </span>
            </label>
            {deleteError && <p className="text-sm text-danger mb-3">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-sm border border-border text-text rounded-lg hover:bg-surface disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="px-4 py-2 text-sm bg-danger text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
