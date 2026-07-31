import { isStatId } from './stats.js'
import type { StatId } from './stats.js'
import type { Match, MatchEvent, Player, Team, VideoReference } from './types.js'

/**
 * A statistic the user just counted, before it becomes a stored event.
 */
export interface StatChange {
  playerId: string
  statId: StatId
  delta: number
  videoMs: number | null
  createdBy: string | null
}

/**
 * Supplies identities and timestamps for anything the app creates. Injected so
 * tests stay deterministic, and so ids can keep being generated on the client:
 * the server deduplicates by id, which makes a resend harmless.
 */
export interface IdFactory {
  nextId(): string
  now(): number
}

export type EventFactory = IdFactory

export const defaultIdFactory: IdFactory = {
  nextId: () => crypto.randomUUID(),
  now: () => Date.now(),
}

export const defaultEventFactory = defaultIdFactory

export function createPlayer(personId: string, name: string, factory: IdFactory): Player {
  return { id: factory.nextId(), personId, name: name.trim() }
}

export function createTeam(
  name: string,
  color: string,
  players: Player[],
  factory: IdFactory,
): Team {
  return { id: factory.nextId(), name, color, players }
}

export interface MatchDraft {
  name?: string
  date: string
  video?: VideoReference | null
  teams: Team[]
}

export function createMatch(draft: MatchDraft, factory: IdFactory): Match {
  return {
    id: factory.nextId(),
    name: draft.name ?? '',
    date: draft.date,
    video: draft.video ?? null,
    teams: draft.teams,
    events: [],
  }
}

/**
 * Carries the rosters into a new match with fresh identities, which is what
 * "same teams, stats back to zero" means. Player ids have to be new so the two
 * matches never share an event by accident, but `personId` is kept: it is the
 * same people playing.
 */
export function cloneTeamsForNewMatch(teams: Team[], factory: IdFactory): Team[] {
  return teams.map((team) =>
    createTeam(
      team.name,
      team.color,
      team.players.map((player) => createPlayer(player.personId, player.name, factory)),
      factory,
    ),
  )
}

export interface PlayerLocation {
  player: Player
  team: Team
}

/**
 * Turns a counted statistic into a storable event.
 *
 * @returns The event, or null when the change is not valid for this match:
 *   unknown player, unknown statistic, or a correction that would push the
 *   player's total below zero.
 */
export function createEvent(
  match: Match,
  change: StatChange,
  factory: EventFactory = defaultEventFactory,
): MatchEvent | null {
  const location = findPlayer(match, change.playerId)

  if (!location || !isStatId(change.statId) || change.delta === 0) {
    return null
  }

  if (countStat(match, change.playerId, change.statId) + change.delta < 0) {
    return null
  }

  return {
    id: factory.nextId(),
    playerId: change.playerId,
    teamId: location.team.id,
    statId: change.statId,
    delta: change.delta,
    videoMs: change.videoMs,
    createdBy: change.createdBy,
    createdAt: factory.now(),
    deletedAt: null,
    deletedBy: null,
  }
}

/**
 * Appends an event to the log.
 *
 * Idempotent by event id: applying the same event twice leaves the match
 * unchanged. This is what lets the realtime layer rebroadcast freely and lets a
 * client replay its pending queue after a reconnection without duplicating
 * anything.
 */
export function applyEvent(match: Match, event: MatchEvent): Match {
  if (match.events.some((stored) => stored.id === event.id)) {
    return match
  }

  return { ...match, events: [...match.events, event] }
}

/**
 * Marks an event as deleted without dropping it from the log, so it stays
 * auditable: who counted it and who took it back.
 */
export function removeEvent(
  match: Match,
  eventId: string,
  removedBy: string | null,
  removedAt: number,
): Match {
  let changed = false

  const events = match.events.map((event) => {
    if (event.id !== eventId || event.deletedAt !== null) {
      return event
    }
    changed = true
    return { ...event, deletedAt: removedAt, deletedBy: removedBy }
  })

  return changed ? { ...match, events } : match
}

/**
 * The most recent event still standing for a given author, which is what
 * "undo" acts on. Scoped by author because several people count the same match
 * at once and nobody should be able to undo somebody else's work by accident.
 */
export function lastEventBy(match: Match, authorId: string | null): MatchEvent | null {
  for (let index = match.events.length - 1; index >= 0; index -= 1) {
    const event = match.events[index]
    if (event && event.deletedAt === null && event.createdBy === authorId) {
      return event
    }
  }
  return null
}

export function activeEvents(match: Match): MatchEvent[] {
  return match.events.filter((event) => event.deletedAt === null)
}

export function countStat(match: Match, playerId: string, statId: StatId): number {
  return activeEvents(match).reduce((total, event) => {
    return event.playerId === playerId && event.statId === statId ? total + event.delta : total
  }, 0)
}

export function findPlayer(match: Match, playerId: string): PlayerLocation | null {
  for (const team of match.teams) {
    const player = team.players.find((candidate) => candidate.id === playerId)
    if (player) {
      return { player, team }
    }
  }
  return null
}

export function roster(match: Match): PlayerLocation[] {
  return match.teams.flatMap((team) => team.players.map((player) => ({ player, team })))
}

export function addPlayer(match: Match, teamId: string, player: Player): Match {
  const teams = match.teams.map((team) => {
    return team.id === teamId ? { ...team, players: [...team.players, player] } : team
  })

  return { ...match, teams }
}

/**
 * Removes a player and every event attached to them. Unlike counting mistakes,
 * this is a roster correction: the player was never in the match, so their
 * events are dropped outright rather than kept as deleted history.
 */
export function removePlayer(match: Match, playerId: string): Match {
  return {
    ...match,
    teams: match.teams.map((team) => ({
      ...team,
      players: team.players.filter((player) => player.id !== playerId),
    })),
    events: match.events.filter((event) => event.playerId !== playerId),
  }
}

export function matchTitle(match: Match): string {
  return match.name.trim() || `Partido del ${match.date}`
}
