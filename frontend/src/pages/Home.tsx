import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCategoryShare,
  listCategoryShares,
  revokeCategoryShare,
  updateCategoryShare,
} from '../api/categoryShares'
import { listCategories, listVideos } from '../api/videos'
import type { CategoryShare, Tag, Video } from '../types'
import VideoCard from '../components/VideoCard'
import SearchBar from '../components/SearchBar'

async function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
  } else {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

function shareStatus(share: CategoryShare): 'active' | 'disabled' | 'expired' {
  if (!share.enabled) return 'disabled'
  if (share.expires_at && new Date(share.expires_at) < new Date()) return 'expired'
  return 'active'
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [shares, setShares] = useState<Map<string, CategoryShare>>(new Map())
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [justCopied, setJustCopied] = useState(false)
  const [savingShare, setSavingShare] = useState(false)
  const popoverRef = useRef<HTMLLIElement>(null)

  // Load categories (complete list, server-side)
  useEffect(() => {
    listCategories()
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
    listCategoryShares()
      .then(({ data }) => {
        const m = new Map<string, CategoryShare>()
        ;(Array.isArray(data) ? data : []).forEach(s => m.set(s.category, s))
        setShares(m)
      })
      .catch(() => {})
  }, [])

  // Load videos whenever category changes (server-side filter)
  const loadVideos = useCallback(async (q = '', field = '', cat: string | null = null) => {
    setLoading(true)
    setError('')
    setSelectedTags([])
    try {
      const params: Record<string, string> = {}
      if (q) { params.q = q; if (field) params.field = field }
      if (cat) params.category = cat
      const { data } = await listVideos(Object.keys(params).length ? params : undefined)
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadVideos() }, [loadVideos])

  // Close popover on outside click
  useEffect(() => {
    if (!openPopover) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPopover])

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    videos.forEach(v => (v.tags ?? []).forEach(t => tagMap.set(t.id, t)))
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [videos])

  const filteredVideos = useMemo(() => {
    if (selectedTags.length === 0) return videos
    return videos.filter(v =>
      selectedTags.every(tagId => (v.tags ?? []).some(t => t.id === tagId))
    )
  }, [videos, selectedTags])

  const selectCategory = (cat: string | null) => {
    setSelectedCategory(cat)
    loadVideos('', '', cat)
  }

  const toggleTag = (tagId: string) =>
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])

  // Share management
  const handleShareIconClick = async (cat: string) => {
    if (openPopover === cat) { setOpenPopover(null); return }
    if (!shares.has(cat)) {
      setSavingShare(true)
      try {
        const { data } = await createCategoryShare(cat)
        setShares(prev => new Map(prev).set(cat, data))
        await copyToClipboard(`${window.location.origin}/c/${data.token}`)
        setJustCopied(true)
        setTimeout(() => setJustCopied(false), 2500)
      } finally { setSavingShare(false) }
    }
    setOpenPopover(cat)
  }

  const handleCopyLink = async (share: CategoryShare) => {
    await copyToClipboard(`${window.location.origin}/c/${share.token}`)
    setJustCopied(true)
    setTimeout(() => setJustCopied(false), 2500)
  }

  const handleToggleEnabled = async (share: CategoryShare) => {
    setSavingShare(true)
    try {
      const { data } = await updateCategoryShare(share.token, { enabled: !share.enabled })
      setShares(prev => new Map(prev).set(share.category, data))
    } finally { setSavingShare(false) }
  }

  const handleSetExpiry = async (share: CategoryShare, value: string) => {
    setSavingShare(true)
    try {
      const { data } = await updateCategoryShare(share.token, {
        expires_at: value ? new Date(value).toISOString() : null,
      })
      setShares(prev => new Map(prev).set(share.category, data))
    } finally { setSavingShare(false) }
  }

  const handleRevokeShare = async (share: CategoryShare) => {
    if (!confirm('Remove this share link permanently?')) return
    await revokeCategoryShare(share.token)
    setShares(prev => { const m = new Map(prev); m.delete(share.category); return m })
    setOpenPopover(null)
  }

  const expiryInputValue = (share: CategoryShare) =>
    share.expires_at ? new Date(share.expires_at).toISOString().slice(0, 16) : ''

  return (
    <div className="flex h-full">

      {/* ── Sidebar ── */}
      {categories.length > 0 && (
        <aside className="w-44 flex-shrink-0 bg-white border-r overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Library</p>
            <ul className="space-y-0.5 mb-4">
              <li>
                <button
                  onClick={() => selectCategory(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    !selectedCategory ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All videos
                </button>
              </li>
            </ul>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Categories</p>
            <ul className="space-y-0.5 mb-4">
              {categories.map(cat => {
                const share = shares.get(cat)
                const status = share ? shareStatus(share) : null
                const isOpen = openPopover === cat
                return (
                  <li key={cat} className="relative" ref={isOpen ? popoverRef : undefined}>
                    <div className={`flex items-center rounded-lg group ${selectedCategory === cat ? 'bg-indigo-50' : 'hover:bg-gray-100'}`}>
                      <button
                        onClick={() => selectCategory(cat)}
                        className={`flex-1 text-left px-2 py-1.5 text-sm truncate transition-colors ${
                          selectedCategory === cat ? 'text-indigo-700 font-medium' : 'text-gray-600'
                        }`}
                        title={cat}
                      >
                        {cat}
                      </button>
                      <button
                        onClick={() => handleShareIconClick(cat)}
                        title={share ? 'Manage share' : 'Share category'}
                        className={`flex-shrink-0 mr-1 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                          status === 'active' ? 'text-indigo-400 opacity-100'
                          : status === 'disabled' ? 'text-gray-300 opacity-100'
                          : status === 'expired' ? 'text-amber-400 opacity-100'
                          : 'text-gray-300 hover:text-indigo-400'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    </div>

                    {isOpen && share && (
                      <div className="absolute left-full top-0 ml-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-64">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-gray-700 truncate">{cat}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                            status === 'active' ? 'bg-green-100 text-green-700'
                            : status === 'disabled' ? 'bg-gray-100 text-gray-500'
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {status === 'active' ? 'Active' : status === 'disabled' ? 'Disabled' : 'Expired'}
                          </span>
                        </div>

                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => handleCopyLink(share)}
                            disabled={status !== 'active'}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                              justCopied ? 'bg-green-100 text-green-700 border-green-300'
                              : status === 'active' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                            }`}
                          >
                            {justCopied
                              ? <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Copied!</>
                              : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy link</>
                            }
                          </button>
                          <button
                            onClick={() => handleToggleEnabled(share)}
                            disabled={savingShare}
                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                              share.enabled ? 'border-gray-300 text-gray-600 hover:bg-gray-50' : 'border-indigo-300 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                            }`}
                          >
                            {share.enabled ? 'Disable' : 'Enable'}
                          </button>
                        </div>

                        <div className="mb-3">
                          <label className="block text-xs text-gray-500 mb-1">Expiry (optional)</label>
                          <input
                            type="datetime-local"
                            value={expiryInputValue(share)}
                            onChange={e => handleSetExpiry(share, e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          {share.expires_at && (
                            <button onClick={() => handleSetExpiry(share, '')} className="mt-1 text-xs text-gray-400 hover:text-red-500">
                              Clear expiry
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleRevokeShare(share)}
                          className="w-full text-xs text-red-500 hover:text-red-700 hover:bg-red-50 py-1.5 rounded-lg transition-colors"
                        >
                          Delete share link
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {availableTags.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1 px-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                        selectedTags.includes(tag.id)
                          ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 px-4 py-6 overflow-y-auto">
        <div className="mb-4">
          <SearchBar onSearch={(q, field) => loadVideos(q, field, selectedCategory)} />
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}
        {error && <p className="text-red-600 text-center py-10">{error}</p>}
        {!loading && !error && filteredVideos.length === 0 && (
          <p className="text-gray-500 text-center py-20">
            {videos.length === 0
              ? selectedCategory
                ? `No videos in "${selectedCategory}".`
                : 'No videos found. Configure a folder in Settings and run a scan.'
              : 'No videos match the current filters.'}
          </p>
        )}
        {!loading && filteredVideos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        )}
      </div>
    </div>
  )
}
