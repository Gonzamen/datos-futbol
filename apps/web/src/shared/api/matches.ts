import type { Match, Person, StatId, VideoReference } from '@datos-futbol/domain'
import { api } from './client.js'

export type MembershipRole = 'owner' | 'tagger' | 'viewer'

export interface MatchSummary {
  matchId: string
  name: string
  date: string
  hasVideo: boolean
  role: MembershipRole
  memberCount: number
  eventCount: number
  inviteCode: string
}

export const matchesApi = {
  list: () => api.get<{ matches: MatchSummary[] }>('/matches').then((r) => r.matches),

  create: (input: { name?: string; date: string }) =>
    api.post<{ match: Match }>('/matches', input).then((r) => r.match),

  join: (inviteCode: string) =>
    api.post<{ match: Match }>('/matches/join', { inviteCode }).then((r) => r.match),

  get: (matchId: string) =>
    api.get<{ match: Match; duplicateFlags: Record<string, string> }>(`/matches/${matchId}`),

  updateInfo: (
    matchId: string,
    changes: { name?: string; date?: string; video?: VideoReference | null },
  ) => api.patch<{ match: Match }>(`/matches/${matchId}`, changes).then((r) => r.match),

  updateTeam: (matchId: string, teamId: string, changes: { name?: string; color?: string }) =>
    api.patch(`/matches/${matchId}/teams/${teamId}`, changes),

  addPlayer: (matchId: string, teamId: string, name: string) =>
    api
      .post<{ player: { id: string; personId: string; name: string } }>(
        `/matches/${matchId}/teams/${teamId}/players`,
        { name },
      )
      .then((r) => r.player),

  renamePlayer: (matchId: string, playerId: string, name: string) =>
    api.patch(`/matches/${matchId}/players/${playerId}`, { name }),

  removePlayer: (matchId: string, playerId: string) =>
    api.delete(`/matches/${matchId}/players/${playerId}`),

  addEvent: (
    matchId: string,
    input: {
      eventId: string
      playerId: string
      statId: StatId
      delta: number
      videoMs: number | null
    },
  ) =>
    api.post<{ event: Match['events'][number]; possibleDuplicateOf: string | null }>(
      `/matches/${matchId}/events`,
      input,
    ),

  removeEvent: (matchId: string, eventId: string) =>
    api.delete(`/matches/${matchId}/events/${eventId}`),
}

export const peopleApi = {
  search: (query = '', limit = 200) =>
    api
      .get<{ people: Person[] }>(`/people?query=${encodeURIComponent(query)}&limit=${limit}`)
      .then((r) => r.people),

  create: (name: string) => api.post<{ person: Person }>('/people', { name }).then((r) => r.person),

  rename: (personId: string, name: string) =>
    api.patch<{ ok: boolean }>(`/people/${personId}`, { name }),
}
