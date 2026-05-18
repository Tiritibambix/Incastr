import client from './client'
import type { Folder } from '../types'

export const listFolders = () => client.get<Folder[]>('/folders')

export const createFolder = (path: string, label: string) =>
  client.post<Folder>('/folders', { path, label })

export const updateFolder = (id: string, data: { path?: string; label?: string }) =>
  client.patch<Folder>(`/folders/${id}`, data)

export const deleteFolder = (id: string) => client.delete(`/folders/${id}`)
