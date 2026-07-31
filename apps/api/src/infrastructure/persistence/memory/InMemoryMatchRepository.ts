import type { Match, MatchEvent, Player } from '@datos-futbol/domain'
import type { MatchMeta, MatchRepository } from '../../../domain/ports/MatchRepository.js'

export class InMemoryMatchRepository implements MatchRepository {
  private readonly matches = new Map<string, Match>()
  private readonly inviteCodes = new Map<string, string>()
  private readonly duplicateFlags = new Map<string, string>()

  async findById(matchId: string): Promise<Match | null> {
    return this.matches.get(matchId) ?? null
  }

  async findByInviteCode(inviteCode: string): Promise<Match | null> {
    for (const [matchId, code] of this.inviteCodes) {
      if (code === inviteCode) {
        return this.matches.get(matchId) ?? null
      }
    }
    return null
  }

  async listMeta(matchIds: string[]): Promise<MatchMeta[]> {
    return matchIds.flatMap((matchId) => {
      const match = this.matches.get(matchId)
      const inviteCode = this.inviteCodes.get(matchId)

      if (!match || !inviteCode) {
        return []
      }

      return [
        {
          matchId,
          name: match.name,
          date: match.date,
          hasVideo: match.video !== null,
          eventCount: match.events.filter((event) => event.deletedAt === null).length,
          inviteCode,
        },
      ]
    })
  }

  async create(match: Match, inviteCode: string): Promise<void> {
    this.matches.set(match.id, match)
    this.inviteCodes.set(match.id, inviteCode)
  }

  async updateInfo(
    matchId: string,
    changes: { name?: string; date?: string; video?: Match['video'] },
  ): Promise<void> {
    this.mutate(matchId, (match) => ({ ...match, ...changes }))
  }

  async addPlayer(matchId: string, teamId: string, player: Player): Promise<void> {
    this.mutate(matchId, (match) => ({
      ...match,
      teams: match.teams.map((team) =>
        team.id === teamId ? { ...team, players: [...team.players, player] } : team,
      ),
    }))
  }

  async renamePlayer(matchId: string, playerId: string, name: string): Promise<void> {
    this.mutate(matchId, (match) => ({
      ...match,
      teams: match.teams.map((team) => ({
        ...team,
        players: team.players.map((player) =>
          player.id === playerId ? { ...player, name } : player,
        ),
      })),
    }))
  }

  async removePlayer(matchId: string, playerId: string): Promise<void> {
    this.mutate(matchId, (match) => ({
      ...match,
      teams: match.teams.map((team) => ({
        ...team,
        players: team.players.filter((player) => player.id !== playerId),
      })),
      events: match.events.filter((event) => event.playerId !== playerId),
    }))
  }

  async updateTeam(
    matchId: string,
    teamId: string,
    changes: { name?: string; color?: string },
  ): Promise<void> {
    this.mutate(matchId, (match) => ({
      ...match,
      teams: match.teams.map((team) => (team.id === teamId ? { ...team, ...changes } : team)),
    }))
  }

  async appendEvent(
    matchId: string,
    event: MatchEvent,
    possibleDuplicateOf: string | null,
  ): Promise<void> {
    this.mutate(matchId, (match) =>
      match.events.some((stored) => stored.id === event.id)
        ? match
        : { ...match, events: [...match.events, event] },
    )

    if (possibleDuplicateOf) {
      this.duplicateFlags.set(event.id, possibleDuplicateOf)
    }
  }

  async listDuplicateFlags(matchId: string): Promise<Record<string, string>> {
    const match = this.matches.get(matchId)
    if (!match) {
      return {}
    }

    const activeIds = new Set(
      match.events.filter((event) => event.deletedAt === null).map((event) => event.id),
    )
    const flags: Record<string, string> = {}

    for (const [eventId, duplicateOf] of this.duplicateFlags) {
      if (activeIds.has(eventId) && activeIds.has(duplicateOf)) {
        flags[eventId] = duplicateOf
      }
    }

    return flags
  }

  async markEventDeleted(
    matchId: string,
    eventId: string,
    deletedBy: string | null,
    deletedAt: number,
  ): Promise<void> {
    this.mutate(matchId, (match) => ({
      ...match,
      events: match.events.map((event) =>
        event.id === eventId && event.deletedAt === null
          ? { ...event, deletedAt, deletedBy }
          : event,
      ),
    }))
  }

  private mutate(matchId: string, update: (match: Match) => Match): void {
    const match = this.matches.get(matchId)
    if (match) {
      this.matches.set(matchId, update(match))
    }
  }
}
