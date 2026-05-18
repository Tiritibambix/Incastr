import client from './client'
import type { User } from '../types'

export const login = (username: string, password: string) =>
  client.post<{ access_token: string }>('/auth/login', { username, password })

export const register = (username: string, email: string, password: string) =>
  client.post('/auth/register', { username, email, password })

export const getMe = () => client.get<User>('/users/me')

export const getAuthStatus = () =>
  client.get<{ has_users: boolean; registration_open: boolean }>('/auth/status')
