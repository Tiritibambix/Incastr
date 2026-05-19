import client from './client'
import type { User } from '../types'

export const listUsers = () => client.get<User[]>('/users')

export const createUser = (username: string, email: string, password: string) =>
  client.post<User>('/users', { username, email, password })

export const updateUser = (id: string, data: { email?: string; password?: string; is_admin?: boolean }) =>
  client.patch<User>(`/users/${id}`, data)

export const deleteUser = (id: string) => client.delete(`/users/${id}`)
