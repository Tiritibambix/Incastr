import client from './client'
import type { Tag } from '../types'

export const listTags = () => client.get<Tag[]>('/tags')

export const createTag = (name: string) => client.post<Tag>('/tags', { name })

export const deleteTag = (id: string) => client.delete(`/tags/${id}`)
