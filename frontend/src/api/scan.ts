import client from './client'

export interface ScanFolderIssue {
  folder_id: string
  label: string
  error?: string
  warning?: string
}

export interface ScanResult {
  scanned: number
  added: number
  updated: number
  error?: string
  warning?: string
  errors?: ScanFolderIssue[]
  warnings?: ScanFolderIssue[]
}

export const scanAll = () => client.post<ScanResult>('/scan')

export const scanFolder = (folderId: string) =>
  client.post<ScanResult>(`/scan/${folderId}`)

export const regenerateThumbnails = () =>
  client.post<{ queued: number }>('/scan/thumbnails/regenerate')
