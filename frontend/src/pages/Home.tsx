import { useCallback, useEffect, useMemo, useState } from 'react'
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
import SortSelect from '../components/SortSelect'
import Pagination from '../components/Pagination'
import { copyToClipboard } from '../utils/clipboard'
import { shareStatus } from '../utils/shareStatus'

const PAGE_SIZE = 16

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchField, setSearchField] = useState('')
  const [sort, setSort] = useState('date_desc')
  const [shares, setShares] = useState<Map<string, CategoryShare>>(new Map())
  // Share modal
  const [shareModalCat, setShareModalCat] = useState<string | null>(null)
  const [justCopied, setJustCopied] = useState(false)
  const [savingShare, setSavingShare] = useState(false)

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

  const loadVideos = useCallback(async (q = '', field = '', cat: string | null = null, pageNum = 1, sortValue = 'date_desc') => {
    setLoading(true)
    setError('')
    setSelectedTags([])
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        skip: (pageNum - 1) * PAGE_SIZE,
        sort: sortValue,
      }
      if (q) { params.q = q; if (field) params.field = field }
      if (cat) params.category = cat
      const { data } = await listVideos(params)
      setVideos(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadVideos('', '', null, 1, 'date_desc') }, [loadVideos])

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
    setPage(1)
    loadVideos(searchQuery, searchField, cat, 1, sort)
  }

  const goToPage = (p: number) => {
    setPage(p)
    loadVideos(searchQuery, searchField, selectedCategory, p, sort)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSortChange = (value: string) => {
    setSort(value)
    setPage(1)
    loadVideos(searchQuery, searchField, selectedCategory, 1, value)
  }

  const toggleTag = (tagId: string) =>
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId])

  // ── Share management ──────────────────────────────────────────────

  const openShareModal = async (cat: string) => {
    if (!shares.has(cat)) {
      setSavingShare(true)
      try {
        const { data } = await createCategoryShare(cat)
        setShares(prev => new Map(prev).set(cat, data))
      } finally {
        setSavingShare(false) }
    }
    setJustCopied(false)
    setShareModalCat(cat)
  }

  const activeShare = shareModalCat ? shares.get(shareModalCat) : undefined
  const activeStatus = activeShare ? shareStatus(activeShare) : null

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
    setShareModalCat(null)
  }

  const expiryInputValue = (share: CategoryShare) =>
    share.expires_at ? new Date(share.expires_at).toISOString().slice(0, 16) : ''

  // ── Render ────────────────────────────────────────────────────────

  const hasSidebar = categories.length > 0

  return (
    <>
      {/* Fixed sidebar */}
      {hasSidebar && (
        <aside className="fixed top-12 left-0 bottom-0 w-44 bg-surface-raised border-r border-border z-10 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">Library</p>
            <ul className="space-y-0.5 mb-4">
              <li>
                <button
                  onClick={() => selectCategory(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    !selectedCategory ? 'bg-accent-soft text-accent font-medium' : 'text-text-muted hover:bg-surface'
                  }`}
                >
                  All videos
                </button>
              </li>
            </ul>

            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">Categories</p>
            <ul className="space-y-0.5 mb-4">
              {categories.map(cat => {
                const share = shares.get(cat)
                const status = share ? shareStatus(share) : null
                return (
                  <li key={cat}>
                    <div className={`flex items-center rounded-lg group ${selectedCategory === cat ? 'bg-accent-soft' : 'hover:bg-surface'}`}>
                      <button
                        onClick={() => selectCategory(cat)}
                        className={`flex-1 text-left px-2 py-1.5 text-sm truncate transition-colors ${
                          selectedCategory === cat ? 'text-accent font-medium' : 'text-text-muted'
                        }`}
                        title={cat}
                      >
                        {cat}
                      </button>
                      <button
                        onClick={() => openShareModal(cat)}
                        disabled={savingShare && !share}
                        title={share ? 'Manage share' : 'Share category'}
                        className={`flex-shrink-0 mr-1 p-1 rounded transition-colors opacity-0 group-hover:opacity-100 ${
                          status === 'active' ? 'text-accent opacity-100'
                          : status === 'disabled' ? 'text-text-muted opacity-100'
                          : status === 'expired' ? 'text-warning opacity-100'
                          : 'text-text-muted hover:text-accent'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            {availableTags.length > 0 && (
              <>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">Tags</p>
                <div className="flex flex-wrap gap-1 px-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                        selectedTags.includes(tag.id)
                          ? 'bg-accent-soft text-accent border-accent/30'
                          : 'bg-surface-raised text-text-muted border-border hover:bg-surface'
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

      {/* Main content */}
      <div className={hasSidebar ? 'pl-44' : ''}>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-start">
            <div className="flex-1">
              <SearchBar onSearch={(q, field) => {
                setSearchQuery(q)
                setSearchField(field)
                setPage(1)
                loadVideos(q, field, selectedCategory, 1, sort)
              }} />
            </div>
            <SortSelect value={sort} onChange={handleSortChange} />
          </div>

          {loading && (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
            </div>
          )}
          {error && <p className="text-danger text-center py-10">{error}</p>}
          {!loading && !error && filteredVideos.length === 0 && (
            <p className="text-text-muted text-center py-20">
              {videos.length === 0
                ? selectedCategory
                  ? `No videos in "${selectedCategory}".`
                  : 'No videos found. Configure a folder in Settings and run a scan.'
                : 'No videos match the current filters.'}
            </p>
          )}
          {!loading && filteredVideos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredVideos.map(v => <VideoCard key={v.id} video={v} to={`/videos/${v.id}`} variant="owner" />)}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && (total > 0 || page > 1) && (
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              onPageChange={goToPage}
            />
          )}
        </div>
      </div>

      {/* Share management modal — rendered at root level, never clipped */}
      {shareModalCat && activeShare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShareModalCat(null)}
        >
          <div
            className="bg-surface-raised rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-text">{activeShare?.name || shareModalCat}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                activeStatus === 'active' ? 'bg-success-soft text-success'
                : activeStatus === 'disabled' ? 'bg-surface text-text-muted'
                : 'bg-warning-soft text-warning'
              }`}>
                {activeStatus === 'active' ? 'Active' : activeStatus === 'disabled' ? 'Disabled' : 'Expired'}
              </span>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => handleCopyLink(activeShare)}
                disabled={activeStatus !== 'active'}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  justCopied ? 'bg-success-soft text-success border-success/30'
                  : activeStatus === 'active' ? 'bg-accent-soft text-accent border-accent/30 hover:bg-accent-soft/70'
                  : 'bg-surface text-text-muted border-border cursor-not-allowed'
                }`}
              >
                {justCopied
                  ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Copied!</>
                  : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Copy link</>
                }
              </button>
              <button
                onClick={() => handleToggleEnabled(activeShare)}
                disabled={savingShare}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                  activeShare.enabled ? 'border-border text-text-muted hover:bg-surface' : 'border-accent/30 text-accent bg-accent-soft hover:bg-accent-soft/70'
                }`}
              >
                {activeShare.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-sm text-text-muted mb-1.5">Expiry date (optional)</label>
              <input
                type="datetime-local"
                value={expiryInputValue(activeShare)}
                onChange={e => handleSetExpiry(activeShare, e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {activeShare.expires_at && (
                <button
                  onClick={() => handleSetExpiry(activeShare, '')}
                  className="mt-1.5 text-xs text-text-muted hover:text-danger"
                >
                  Clear expiry
                </button>
              )}
            </div>

            <div className="flex gap-2 justify-between items-center">
              <button
                onClick={() => handleRevokeShare(activeShare)}
                className="text-sm text-danger hover:opacity-80 transition-colors"
              >
                Delete share link
              </button>
              <button
                onClick={() => setShareModalCat(null)}
                className="px-4 py-2 text-sm border border-border text-text rounded-lg hover:bg-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
