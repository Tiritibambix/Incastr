import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicVideos, thumbnailUrl } from '../api/videos'
import { useAuthStore } from '../store/auth'
import type { Tag, VideoPublic } from '../types'
import TagBadge from '../components/TagBadge'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function PublicVideoCard({ video }: { video: VideoPublic }) {
  return (
    <Link
      to={`/watch/${video.id}`}
      className="group block bg-white rounded-xl overflow-hidden shadow hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-video bg-gray-900">
        {video.thumbnail_path ? (
          <img
            src={thumbnailUrl(video.user_id, video.id)}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
        )}
        {video.duration_seconds && (
          <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
            {formatDuration(video.duration_seconds)}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600">{video.title}</p>
        {video.category && <p className="text-xs text-gray-500 mt-1 truncate">{video.category}</p>}
        {(video.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(video.tags ?? []).slice(0, 3).map(t => <TagBadge key={t.id} name={t.name} />)}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function Landing() {
  const { user } = useAuthStore()
  const [videos, setVideos] = useState<VideoPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  useEffect(() => {
    listPublicVideos()
      .then(({ data }) => setVideos(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    videos.forEach(v => { if (v.category) cats.add(v.category) })
    return Array.from(cats).sort()
  }, [videos])

  const videosInCategory = useMemo(() => {
    let result = selectedCategory ? videos.filter(v => v.category === selectedCategory) : videos
    if (q.trim()) result = result.filter(v => v.title.toLowerCase().includes(q.toLowerCase()))
    return result
  }, [videos, selectedCategory, q])

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    videosInCategory.forEach(v => (v.tags ?? []).forEach(t => tagMap.set(t.id, t)))
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [videosInCategory])

  const filtered = useMemo(() => {
    if (selectedTags.length === 0) return videosInCategory
    return videosInCategory.filter(v =>
      selectedTags.every(id => (v.tags ?? []).some(t => t.id === id))
    )
  }, [videosInCategory, selectedTags])

  const toggleTag = (id: string) =>
    setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleCategory = (cat: string) => {
    setSelectedCategory(prev => prev === cat ? null : cat)
    setSelectedTags([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xl font-bold text-indigo-600">Incastr</span>
        {user ? (
          <Link
            to="/library"
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            My Library
          </Link>
        ) : (
          <Link
            to="/login"
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Login
          </Link>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        ) : videos.length === 0 ? (
          <p className="text-center text-gray-500 py-20">No public videos yet.</p>
        ) : (
          <>
            <div className="mb-5 space-y-3">
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {categories.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedCategory(null); setSelectedTags([]) }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
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
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${selectedTags.includes(tag.id) ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-20">No videos match the current filters.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(v => <PublicVideoCard key={v.id} video={v} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
