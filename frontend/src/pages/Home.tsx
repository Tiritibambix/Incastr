import { useEffect, useState } from 'react'
import { listVideos } from '../api/videos'
import type { Video } from '../types'
import VideoCard from '../components/VideoCard'
import SearchBar from '../components/SearchBar'

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <SearchBar onSearch={load} />
      </div>
      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      )}
      {error && <p className="text-red-600 text-center py-10">{error}</p>}
      {!loading && !error && videos.length === 0 && (
        <p className="text-gray-500 text-center py-20">
          No videos found. Configure a folder in Settings and run a scan.
        </p>
      )}
      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  )
}
