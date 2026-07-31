import type { Match, MatchEvent, Player } from '@datos-futbol/domain'

/**
 * Deliberately granular rather than "load the aggregate, mutate it, save the
 * whole thing back": a match can carry a thousand events, and rewriting all of
 * them for one new goal would be wasteful and would race badly once several
 * people are tagging at once (phase 3). Reads still return the full aggregate
 * — {@link @datos-futbol/domain}'s report builders need the whole event log —
 * but writes touch only the row that changed.
 *
 * Membership (who can see a match, and their role) is a different concern with
 * its own repository; this one only knows about the match itself, which is why
 * `listMeta` takes the ids to summarise rather than a user id.
 */
export interface MatchMeta {
  matchId: string
  name: string
  date: string
  hasVideo: boolean
  eventCount: number
  inviteCode: string
}

export interface MatchRepository {
  findById(matchId: string): Promise<Match | null>
  findByInviteCode(inviteCode: string): Promise<Match | null>
  listMeta(matchIds: string[]): Promise<MatchMeta[]>

  create(match: Match, inviteCode: string): Promise<void>
  updateInfo(
    matchId: string,
    changes: { name?: string; date?: string; video?: Match['video'] },
  ): Promise<void>

  addPlayer(matchId: string, teamId: string, player: Player): Promise<void>
  renamePlayer(matchId: string, playerId: string, name: string): Promise<void>
  removePlayer(matchId: string, playerId: string): Promise<void>
  updateTeam(
    matchId: string,
    teamId: string,
    changes: { name?: string; color?: string },
  ): Promise<void>

  appendEvent(matchId: string, event: MatchEvent, possibleDuplicateOf: string | null): Promise<void>
  markEventDeleted(
    matchId: string,
    eventId: string,
    deletedBy: string | null,
    deletedAt: number,
  ): Promise<void>

  /** Ids of active events flagged as a possible repeat, mapped to what they might repeat. */
  listDuplicateFlags(matchId: string): Promise<Record<string, string>>
}
