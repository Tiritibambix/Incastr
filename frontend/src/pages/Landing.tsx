import { useCallback, useEffect, useMemo, useState } from 'react'
import { listPublicVideos, listPublicCategories } from '../api/videos'
import type { Tag, VideoPublic } from '../types'
import PublicHeader from '../components/PublicHeader'
import VideoCard from '../components/VideoCard'
import SortSelect from '../components/SortSelect'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 16

export default function Landing() {
  const [videos, setVideos] = useState<VideoPublic[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('date_desc')

  useEffect(() => {
    listPublicCategories()
      .then(({ data }) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const loadVideos = useCallback(async (query: string, cat: string | null, pageNum: number, sortValue: string) => {
    setLoading(true)
    setError('')
    setSelectedTags([])
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        skip: (pageNum - 1) * PAGE_SIZE,
        sort: sortValue,
      }
      if (query) params.q = query
      if (cat) params.category = cat
      const { data } = await listPublicVideos(params)
      setVideos(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1)
      loadVideos(q, selectedCategory, 1, sort)
    }, 300)
    return () => clearTimeout(handle)
  }, [q, selectedCategory, sort, loadVideos])

  const goToPage = (p: number) => {
    setPage(p)
    loadVideos(q, selectedCategory, p, sort)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSortChange = (value: string) => {
    setSort(value)
    setPage(1)
  }

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    videos.forEach(v => (v.tags ?? []).forEach(t => tagMap.set(t.id, t)))
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [videos])

  const filtered = useMemo(() => {
    if (selectedTags.length === 0) return videos
    return videos.filter(v => selectedTags.every(id => (v.tags ?? []).some(t => t.id === id)))
  }, [videos, selectedTags])

  const toggleTag = (id: string) =>
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleCategory = (cat: string) => {
    setSelectedCategory(prev => prev === cat ? null : cat)
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search…"
              className="h-[42px] min-h-[42px] flex-1 px-3 py-2 bg-surface-raised border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <SortSelect value={sort} onChange={handleSortChange} />
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-accent text-white' : 'bg-surface-raised text-text-muted hover:bg-surface'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-accent text-white' : 'bg-surface-raised text-text-muted hover:bg-surface'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
          {availableTags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${selectedTags.includes(tag.id) ? 'bg-accent-soft text-accent border-accent/40' : 'bg-surface-raised text-text-muted border-border hover:bg-surface'}`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
          </div>
        )}
        {error && <p className="text-danger text-center py-10">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-center text-text-muted py-20">
            {videos.length === 0
              ? selectedCategory
                ? `No public videos in "${selectedCategory}".`
                : 'No public videos yet.'
              : 'No videos match the current filters.'}
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(v => <VideoCard key={v.id} video={v} to={`/watch/${v.id}`} variant="public" />)}
          </div>
        )}

        {!loading && !error && (total > 0 || page > 1) && (
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            onPageChange={goToPage}
          />
        )}
      </main>
    </div>
  )
}
