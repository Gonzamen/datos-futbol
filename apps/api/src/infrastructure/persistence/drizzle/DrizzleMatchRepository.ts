import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { Match, MatchEvent, Player, StatId, Team } from '@datos-futbol/domain'
import type { MatchMeta, MatchRepository } from '../../../domain/ports/MatchRepository.js'
import type { Database } from './client.js'
import { events, matches, players, teams } from './schema.js'

/**
 * Reads assemble the full aggregate from four tables: the domain package's
 * report builders need the whole event log to compute anything, so there is
 * no partial-load path. Writes stay granular — see the port's doc comment.
 */
export class DrizzleMatchRepository implements MatchRepository {
  constructor(private readonly db: Database) {}

  async findById(matchId: string): Promise<Match | null> {
    const [matchRow] = await this.db.select().from(matches).where(eq(matches.id, matchId)).limit(1)

    if (!matchRow) {
      return null
    }

    const [teamRows, playerRows, eventRows] = await Promise.all([
      this.db.select().from(teams).where(eq(teams.matchId, matchId)).orderBy(asc(teams.position)),
      this.db
        .select({ player: players })
        .from(players)
        .innerJoin(teams, eq(players.teamId, teams.id))
        .where(eq(teams.matchId, matchId))
        .orderBy(asc(players.position)),
      this.db
        .select()
        .from(events)
        .where(eq(events.matchId, matchId))
        .orderBy(asc(events.createdAt)),
    ])

    const playersByTeam = new Map<string, Player[]>()
    for (const { player } of playerRows) {
      const list = playersByTeam.get(player.teamId) ?? []
      list.push({ id: player.id, personId: player.personId, name: player.name })
      playersByTeam.set(player.teamId, list)
    }

    const team: Team[] = teamRows.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      players: playersByTeam.get(row.id) ?? [],
    }))

    return {
      id: matchRow.id,
      name: matchRow.name,
      date: matchRow.date,
      video:
        matchRow.videoProvider && matchRow.videoId
          ? { provider: 'youtube', videoId: matchRow.videoId }
          : null,
      teams: team,
      events: eventRows.map(toEvent),
    }
  }

  async findByInviteCode(inviteCode: string): Promise<Match | null> {
    const [row] = await this.db
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.inviteCode, inviteCode))
      .limit(1)

    return row ? this.findById(row.id) : null
  }

  async listMeta(matchIds: string[]): Promise<MatchMeta[]> {
    if (!matchIds.length) {
      return []
    }

    const [matchRows, counts] = await Promise.all([
      this.db.select().from(matches).where(inArray(matches.id, matchIds)),
      this.db
        .select({ matchId: events.matchId, count: sql<number>`count(*)::int` })
        .from(events)
        .where(inArray(events.matchId, matchIds))
        .groupBy(events.matchId),
    ])

    const eventCountByMatch = new Map(counts.map((row) => [row.matchId, row.count]))

    return matchRows.map((row) => ({
      matchId: row.id,
      name: row.name,
      date: row.date,
      hasVideo: Boolean(row.videoProvider && row.videoId),
      eventCount: eventCountByMatch.get(row.id) ?? 0,
      inviteCode: row.inviteCode,
    }))
  }

  async create(match: Match, inviteCode: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(matches).values({
        id: match.id,
        name: match.name,
        date: match.date,
        videoProvider: match.video?.provider ?? null,
        videoId: match.video?.videoId ?? null,
        inviteCode,
        createdAt: new Date(),
      })

      for (const [teamIndex, team] of match.teams.entries()) {
        await tx.insert(teams).values({
          id: team.id,
          matchId: match.id,
          name: team.name,
          color: team.color,
          position: teamIndex,
        })

        for (const [playerIndex, player] of team.players.entries()) {
          await tx.insert(players).values({
            id: player.id,
            teamId: team.id,
            personId: player.personId,
            name: player.name,
            position: playerIndex,
          })
        }
      }
    })
  }

  async updateInfo(
    matchId: string,
    changes: { name?: string; date?: string; video?: Match['video'] },
  ): Promise<void> {
    const patch: Partial<typeof matches.$inferInsert> = {}

    if (changes.name !== undefined) patch.name = changes.name
    if (changes.date !== undefined) patch.date = changes.date
    if (changes.video !== undefined) {
      patch.videoProvider = changes.video?.provider ?? null
      patch.videoId = changes.video?.videoId ?? null
    }

    if (Object.keys(patch).length === 0) {
      return
    }

    await this.db.update(matches).set(patch).where(eq(matches.id, matchId))
  }

  async addPlayer(_matchId: string, teamId: string, player: Player): Promise<void> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.teamId, teamId))

    await this.db.insert(players).values({
      id: player.id,
      teamId,
      personId: player.personId,
      name: player.name,
      position: row?.count ?? 0,
    })
  }

  async renamePlayer(_matchId: string, playerId: string, name: string): Promise<void> {
    await this.db.update(players).set({ name }).where(eq(players.id, playerId))
  }

  async removePlayer(_matchId: string, playerId: string): Promise<void> {
    await this.db.delete(players).where(eq(players.id, playerId))
  }

  async updateTeam(
    _matchId: string,
    teamId: string,
    changes: { name?: string; color?: string },
  ): Promise<void> {
    if (Object.keys(changes).length === 0) {
      return
    }
    await this.db.update(teams).set(changes).where(eq(teams.id, teamId))
  }

  async appendEvent(
    matchId: string,
    event: MatchEvent,
    possibleDuplicateOf: string | null,
  ): Promise<void> {
    await this.db
      .insert(events)
      .values({
        id: event.id,
        matchId,
        playerId: event.playerId,
        teamId: event.teamId,
        statId: event.statId,
        delta: event.delta,
        videoMs: event.videoMs,
        createdBy: event.createdBy,
        createdAt: new Date(event.createdAt),
        deletedAt: event.deletedAt ? new Date(event.deletedAt) : null,
        deletedBy: event.deletedBy,
        possibleDuplicateOf,
      })
      .onConflictDoNothing()
  }

  async listDuplicateFlags(matchId: string): Promise<Record<string, string>> {
    const rows = await this.db
      .select({ id: events.id, possibleDuplicateOf: events.possibleDuplicateOf })
      .from(events)
      .where(
        sql`${events.matchId} = ${matchId} and ${events.deletedAt} is null and ${events.possibleDuplicateOf} is not null`,
      )

    const flags: Record<string, string> = {}
    for (const row of rows) {
      if (row.possibleDuplicateOf) {
        flags[row.id] = row.possibleDuplicateOf
      }
    }
    return flags
  }

  async markEventDeleted(
    _matchId: string,
    eventId: string,
    deletedBy: string | null,
    deletedAt: number,
  ): Promise<void> {
    await this.db
      .update(events)
      .set({ deletedAt: new Date(deletedAt), deletedBy })
      .where(sql`${events.id} = ${eventId} and ${events.deletedAt} is null`)
  }
}

function toEvent(row: typeof events.$inferSelect): MatchEvent {
  return {
    id: row.id,
    playerId: row.playerId,
    teamId: row.teamId,
    statId: row.statId as StatId,
    delta: row.delta,
    videoMs: row.videoMs,
    createdBy: row.createdBy,
    createdAt: row.createdAt.getTime(),
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : null,
    deletedBy: row.deletedBy,
  }
}
