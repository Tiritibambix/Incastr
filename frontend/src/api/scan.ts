import client from './client'

export const scanAll = () => client.post<{ scanned: number; added: number; updated: number }>('/scan/')

export const scanFolder = (folderId: string) =>
  client.post<{ scanned: number; added: number; updated: number }>(`/scan/${folderId}`)
