import client from './client'
import type { DuplicateGroup, Video, VideoPublic, Visibility, WatchHistoryEntry } from '../types'

export const listVideos = (params?: { q?: string; field?: string; visibility?: string; category?: string; sort?: string; skip?: number; limit?: number }) =>
  client.get<Video[]>('/videos', { params })

export const listDuplicateVideos = () =>
  client.get<DuplicateGroup[]>('/videos/duplicates')

export const updateWatchProgress = (id: string, positionSeconds: number) =>
  client.put(`/videos/${id}/progress`, { position_seconds: positionSeconds })

export const listWatchHistory = (params?: { skip?: number; limit?: number }) =>
  client.get<WatchHistoryEntry[]>('/videos/history', { params })

export const deleteWatchHistoryEntry = (videoId: string) =>
  client.delete(`/videos/history/${videoId}`)

export const clearWatchHistory = () =>
  client.delete('/videos/history')

export const listCategories = () =>
  client.get<string[]>('/videos/categories')

export const getVideo = (id: string) => client.get<Video>(`/videos/${id}`)

export const getSharedVideo = (token: string) =>
  client.get<VideoPublic>(`/videos/share/${token}`)

export const listPublicVideos = (params?: { q?: string; category?: string; sort?: string; skip?: number; limit?: number }) =>
  client.get<VideoPublic[]>('/videos/public', { params })

export const listPublicCategories = () =>
  client.get<string[]>('/videos/public/categories')

export const getPublicVideo = (id: string) =>
  client.get<VideoPublic>(`/videos/public/${id}`)

export const updateVideo = (id: string, data: { title?: string; description?: string; visibility?: Visibility }) =>
  client.patch<Video>(`/videos/${id}`, data)

export const deleteVideo = (id: string, deleteFile = false) =>
  client.delete(`/videos/${id}`, { params: deleteFile ? { delete_file: true } : undefined })

export const moveVideoCategory = (id: string, category: string | null) =>
  client.patch<Video>(`/videos/${id}/category`, { category })

export const renameVideoFile = (id: string, filename: string) =>
  client.patch<Video>(`/videos/${id}/rename`, { filename })

export const addTag = (videoId: string, tagId: string) =>
  client.post<Video>(`/videos/${videoId}/tags/${tagId}`)

export const removeTag = (videoId: string, tagId: string) =>
  client.delete<Video>(`/videos/${videoId}/tags/${tagId}`)

export const streamUrl = (id: string) => `/api/videos/${id}/stream`

export interface ThumbnailAccess {
  token?: string
  catToken?: string
  shareToken?: string
}

export const thumbnailUrl = (userId: string, videoId: string, access?: ThumbnailAccess) => {
  const base = `/api/thumbnails/${userId}/${videoId}.jpg`
  if (!access) return base
  const params = new URLSearchParams()
  if (access.token) params.set('token', access.token)
  if (access.catToken) params.set('cat_token', access.catToken)
  if (access.shareToken) params.set('share_token', access.shareToken)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export const scrubFrameUrl = (userId: string, videoId: string, frame: number, access?: ThumbnailAccess) => {
  const base = `/api/thumbnails/${userId}/${videoId}/scrub/${frame}.jpg`
  if (!access) return base
  const params = new URLSearchParams()
  if (access.token) params.set('token', access.token)
  if (access.catToken) params.set('cat_token', access.catToken)
  if (access.shareToken) params.set('share_token', access.shareToken)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
