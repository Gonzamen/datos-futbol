import { create } from 'zustand'
import { api, ApiError } from '../api/client.js'

export interface SessionUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export interface SessionState {
  status: 'loading' | 'authenticated' | 'anonymous'
  user: SessionUser | null
  checkSession(): Promise<void>
  logout(): Promise<void>
}

/**
 * Checked once on load. There is no local "remember me" flag to consult first
 * — the httpOnly cookie is the only signal, so the only way to know is to ask
 * the API and see whether it recognises the cookie it was sent.
 */
export const useSessionStore = create<SessionState>((set) => ({
  status: 'loading',
  user: null,

  async checkSession() {
    try {
      const { user } = await api.get<{ user: SessionUser }>('/auth/me')
      set({ status: 'authenticated', user })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        set({ status: 'anonymous', user: null })
        return
      }
      set({ status: 'anonymous', user: null })
    }
  },

  async logout() {
    await api.post('/auth/logout').catch(() => undefined)
    set({ status: 'anonymous', user: null })
  },
}))

export function loginWithGoogle(): void {
  window.location.href = api.authorizeUrl()
}
