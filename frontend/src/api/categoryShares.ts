import client from './client'
import type { CategoryShare, Page, VideoPublic } from '../types'

export const listCategoryShares = () =>
  client.get<CategoryShare[]>('/category-shares')

export const createCategoryShare = (category: string, name?: string | null, expires_at?: string | null) =>
  client.post<CategoryShare>('/category-shares', { category, name: name ?? null, expires_at: expires_at ?? null })

export const updateCategoryShare = (token: string, data: { name?: string | null; enabled?: boolean; expires_at?: string | null }) =>
  client.patch<CategoryShare>(`/category-shares/${token}`, data)

export const revokeCategoryShare = (token: string) =>
  client.delete(`/category-shares/${token}`)

export const getCategoryShareVideo = (token: string, videoId: string) =>
  client.get<VideoPublic>(`/category-shares/${token}/video/${videoId}`)

export const getCategoryShareVideos = (token: string, skip = 0, limit = 16) =>
  client.get<Page<VideoPublic>>(`/category-shares/${token}/videos`, { params: { skip, limit } })
