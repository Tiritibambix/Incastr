export interface User {
  id: string
  username: string
  email: string
  is_admin: boolean
  created_at: string
}

export interface Folder {
  id: string
  user_id: string
  path: string
  label: string
  created_at: string
}

export interface Tag {
  id: string
  name: string
  user_id: string
}

export type Visibility = 'private' | 'public' | 'unlisted'

export interface Video {
  id: string
  user_id: string
  folder_id: string
  filepath: string
  filename: string
  title: string
  description: string | null
  category: string | null
  visibility: Visibility
  share_token: string
  thumbnail_path: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  mime_type: string | null
  is_missing: boolean
  created_at: string
  updated_at: string
  last_scanned_at: string | null
  tags: Tag[]
}

export interface CategoryShare {
  token: string
  category: string
  enabled: boolean
  expires_at: string | null
  created_at: string
}

export interface VideoPublic {
  id: string
  user_id: string
  title: string
  description: string | null
  category: string | null
  visibility: Visibility
  thumbnail_path: string | null
  duration_seconds: number | null
  mime_type: string | null
  tags: Tag[]
}
