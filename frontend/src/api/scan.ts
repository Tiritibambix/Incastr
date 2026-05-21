import client from './client'

export const scanAll = () => client.post<{ scanned: number; added: number; updated: number }>('/scan')

export const scanFolder = (folderId: string) =>
  client.post<{ scanned: number; added: number; updated: number }>(`/scan/${folderId}`)

export const regenerateThumbnails = () =>
  client.post<{ queued: number }>('/scan/thumbnails/regenerate')
