import type { SeasonReport } from '@datos-futbol/domain'
import { create } from 'zustand'
import { ApiError } from '../api/client.js'
import { seasonApi } from '../api/season.js'

/**
 * Season stats, independent of any open match — reachable from the top bar
 * like the group roster, since it aggregates across every match the user
 * belongs to rather than showing one match's numbers.
 */
export interface SeasonState {
  season: SeasonReport | null
  loading: boolean
  error: string | null

  load(): Promise<void>
}

export const useSeasonStore = create<SeasonState>((set) => ({
  season: null,
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null })

    try {
      const season = await seasonApi.get()
      set({ season, loading: false })
    } catch (error) {
      set({ loading: false, error: describeError(error) })
    }
  },
}))

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}
