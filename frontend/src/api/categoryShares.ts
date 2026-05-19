import client from './client'
import type { VideoPublic } from '../types'

export const createCategoryShare = (category: string) =>
  client.post<{ token: string; category: string }>('/category-shares', { category })

export const revokeCategoryShare = (token: string) =>
  client.delete(`/category-shares/${token}`)

export const getCategoryShareVideo = (token: string, videoId: string) =>
  client.get<VideoPublic>(`/category-shares/${token}/video/${videoId}`)

export const getCategoryShareVideos = (token: string) =>
  client.get<VideoPublic[]>(`/category-shares/${token}/videos`)
