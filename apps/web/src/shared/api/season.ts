import type { SeasonReport } from '@datos-futbol/domain'
import { api } from './client.js'

export const seasonApi = {
  get: () => api.get<{ season: SeasonReport }>('/season').then((r) => r.season),
}
