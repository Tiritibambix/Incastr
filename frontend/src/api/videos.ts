import client from './client'
import type { Video, VideoPublic, Visibility } from '../types'

export const listVideos = (params?: { q?: string; field?: string; visibility?: string }) =>
  client.get<Video[]>('/videos', { params })

export const getVideo = (id: string) => client.get<Video>(`/videos/${id}`)

export const getSharedVideo = (token: string) =>
  client.get<VideoPublic>(`/videos/share/${token}`)

export const updateVideo = (id: string, data: { title?: string; description?: string; visibility?: Visibility }) =>
  client.patch<Video>(`/videos/${id}`, data)

export const deleteVideo = (id: string) => client.delete(`/videos/${id}`)

export const addTag = (videoId: string, tagId: string) =>
  client.post<Video>(`/videos/${videoId}/tags/${tagId}`)

export const removeTag = (videoId: string, tagId: string) =>
  client.delete<Video>(`/videos/${videoId}/tags/${tagId}`)

export const streamUrl = (id: string) => `/api/videos/${id}/stream`

export const thumbnailUrl = (userId: string, videoId: string) =>
  `/api/thumbnails/${userId}/${videoId}.jpg`
