import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVideo, updateVideo, deleteVideo, addTag, removeTag, streamUrl, thumbnailUrl } from '../api/videos'
import { listTags, createTag } from '../api/tags'
import type { Video, Tag, Visibility } from '../types'
import VideoPlayer from '../components/VideoPlayer'
import TagBadge from '../components/TagBadge'

const VISIBILITY_OPTIONS: Visibility[] = ['private', 'public', 'unlisted']

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [video, setVideo] = useState<Video | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [newTagName, setNewTagName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteFromDisk, setDeleteFromDisk] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([getVideo(id), listTags()]).then(([{ data: v }, { data: tags }]) => {
      setVideo(v)
      setTitle(v.title)
      setDescription(v.description ?? '')
      setVisibility(v.visibility)
      setAllTags(Array.isArray(tags) ? tags : [])
      setLoading(false)
    })
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

  const handleCopyShare = async () => {
    if (!video) return
    const url = `${window.location.origin}/share/${video.share_token}`
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
      } else {
        const el = document.createElement('textarea')
        el.value = url
        el.setAttribute('readonly', '')
        el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    )
  }
  if (!video) return <p className="text-center py-20 text-gray-500">Video not found</p>

  const unattachedTags = allTags.filter((t) => !(video.tags ?? []).find((vt) => vt.id === t.id))

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
            poster={video.thumbnail_path ? thumbnailUrl(video.user_id, video.id) : undefined}
          />
        </div>

        {/* Info panel — fixed width, scrolls independently */}
        <aside className="md:w-80 lg:w-96 flex-shrink-0 bg-white border-t md:border-t-0 md:border-l overflow-y-auto">
          <div className="p-4 space-y-5">

            {editing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full font-bold px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {VISIBILITY_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <h1 className="font-bold text-gray-900 text-base leading-snug">{video.title}</h1>
                {video.description && (
                  <p className="text-gray-600 text-sm">{video.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="capitalize">{video.visibility}</span>
                  {video.category && <><span>·</span><span>{video.category}</span></>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">
                    Edit
                  </button>
                  {video.visibility === 'unlisted' && (
                    <button
                      onClick={handleCopyShare}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-300 ${
                        copied
                          ? 'bg-green-100 text-green-700 border-green-300 scale-105'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {copied ? '✓ Copied!' : 'Share link'}
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteFromDisk(false); setDeleteError(''); setShowDeleteModal(true) }}
                    className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {(video.tags ?? []).map((t) => (
                  <TagBadge key={t.id} name={t.name} onRemove={() => handleRemoveTag(t.id)} />
                ))}
              </div>
              <div className="space-y-2">
                <select
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
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
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAndAddTag() }}
                  />
                  <button onClick={handleCreateAndAddTag} className="px-3 py-1.5 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">
                    Add
                  </button>
                </div>
              </div>
            </div>

          </div>
        </aside>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Delete video</h2>
            <p className="text-sm text-gray-500 mb-4">
              Remove <span className="font-medium text-gray-700">{video.title}</span> from your library?
            </p>
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteFromDisk}
                onChange={(e) => setDeleteFromDisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                Also delete from hard drive.{' '}
                <span className="text-red-600 font-medium">This can't be undone.</span>
              </span>
            </label>
            {deleteError && <p className="text-sm text-red-600 mb-3">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} disabled={deleting} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
