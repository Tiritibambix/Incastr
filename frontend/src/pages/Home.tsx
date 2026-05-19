import { useEffect, useMemo, useState } from 'react'
import { createCategoryShare } from '../api/categoryShares'
import { listVideos } from '../api/videos'
import type { Tag, Video } from '../types'
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

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sharingCat, setSharingCat] = useState<string | null>(null)
  const [catTokens, setCatTokens] = useState<Map<string, string>>(new Map())
  const [lastCopied, setLastCopied] = useState<string | null>(null)

  const load = async (q = '', field = '') => {
    setLoading(true)
    setError('')
    try {
      const { data } = await listVideos(q ? { q, field: field || undefined } : undefined)
      setVideos(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    videos.forEach(v => { if (v.category) cats.add(v.category) })
    return Array.from(cats).sort()
  }, [videos])

  const videosInCategory = useMemo(() => {
    if (!selectedCategory) return videos
    return videos.filter(v => v.category === selectedCategory)
  }, [videos, selectedCategory])

  const availableTags = useMemo(() => {
    const tagMap = new Map<string, Tag>()
    videosInCategory.forEach(v => {
      ;(v.tags ?? []).forEach(t => tagMap.set(t.id, t))
    })
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [videosInCategory])

  const filteredVideos = useMemo(() => {
    if (selectedTags.length === 0) return videosInCategory
    return videosInCategory.filter(v =>
      selectedTags.every(tagId => (v.tags ?? []).some(t => t.id === tagId))
    )
  }, [videosInCategory, selectedTags])

  const toggleCategory = (cat: string) => {
    setSelectedCategory(prev => (prev === cat ? null : cat))
    setSelectedTags([])
  }

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    )
  }

  const handleShareCategory = async (cat: string) => {
    if (sharingCat === cat) return
    setSharingCat(cat)
    try {
      let tok = catTokens.get(cat)
      if (!tok) {
        const { data } = await createCategoryShare(cat)
        tok = data.token
        setCatTokens(prev => new Map(prev).set(cat, tok!))
      }
      await copyToClipboard(`${window.location.origin}/c/${tok}`)
      setLastCopied(cat)
      setTimeout(() => setLastCopied(null), 2500)
    } finally {
      setSharingCat(null)
    }
  }

  const hasFilters = categories.length > 0 && !loading && !error

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-4">
        <SearchBar onSearch={load} />
      </div>

      {hasFilters && (
        <div className="mb-6 space-y-2">
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => { setSelectedCategory(null); setSelectedTags([]) }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <div key={cat} className="flex items-center gap-1">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
                <button
                  onClick={() => handleShareCategory(cat)}
                  disabled={sharingCat === cat}
                  title={`Share "${cat}" as unlisted link`}
                  className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 disabled:opacity-50 ${
                    lastCopied === cat
                      ? 'bg-green-100 text-green-600'
                      : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50'
                  }`}
                >
                  {lastCopied === cat ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : sharingCat === cat ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>

          {availableTags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                    selectedTags.includes(tag.id)
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  #{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}
      {error && <p className="text-red-600 text-center py-10">{error}</p>}
      {!loading && !error && filteredVideos.length === 0 && (
        <p className="text-gray-500 text-center py-20">
          {videos.length === 0
            ? 'No videos found. Configure a folder in Settings and run a scan.'
            : 'No videos match the current filters.'}
        </p>
      )}
      {!loading && filteredVideos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVideos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  )
}
