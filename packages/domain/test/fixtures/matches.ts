import type { Match, MatchEvent, Team } from '../../src/types.js'
import type { StatId } from '../../src/stats.js'

/**
 * Deterministic matches shared by the characterization harness and the unit
 * tests. Nothing here may depend on Date.now, Math.random or the locale clock:
 * the legacy implementation and the TypeScript one have to be fed byte for byte
 * the same input for their outputs to be comparable.
 */

const TEAM_A: Team = {
  id: 'team-a',
  name: 'Caramelo de Polla',
  color: '#f0a52a',
  players: [
    { id: 'a1', personId: 'person-pollo', name: 'Pollo' },
    { id: 'a2', personId: 'person-brn', name: 'Brn' },
    { id: 'a3', personId: 'person-manu', name: 'Manu' },
    { id: 'a4', personId: 'person-lanza', name: 'Lanza' },
    { id: 'a5', personId: 'person-joaco', name: 'Joaco' },
    { id: 'a6', personId: 'person-axel', name: 'Axel' },
    { id: 'a7', personId: 'person-gonchi', name: 'Gonchi' },
  ],
}

const TEAM_B: Team = {
  id: 'team-b',
  name: 'Caramelo de Embutido',
  color: '#5cb85c',
  players: [
    { id: 'b1', personId: 'person-profe', name: 'Profe' },
    { id: 'b2', personId: 'person-verde', name: 'Verde' },
    { id: 'b3', personId: 'person-kuki', name: 'Kuki' },
    { id: 'b4', personId: 'person-lea', name: 'Lea' },
    { id: 'b5', personId: 'person-facu', name: 'Facu' },
    { id: 'b6', personId: 'person-puya', name: 'Puya' },
    { id: 'b7', personId: 'person-ale', name: 'Ale' },
  ],
}

const TEAM_OF: Record<string, string> = Object.fromEntries([
  ...TEAM_A.players.map((player) => [player.id, TEAM_A.id]),
  ...TEAM_B.players.map((player) => [player.id, TEAM_B.id]),
])

function baseMatch(id: string, name: string, events: MatchEvent[]): Match {
  return {
    id,
    name,
    date: '2026-07-23',
    video: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' },
    teams: [structuredClone(TEAM_A), structuredClone(TEAM_B)],
    events,
  }
}

class EventLog {
  private readonly events: MatchEvent[] = []

  add(playerId: string, statId: StatId, count = 1, delta = 1): this {
    for (let index = 0; index < count; index += 1) {
      const sequence = this.events.length
      this.events.push({
        id: `event-${String(sequence).padStart(4, '0')}`,
        playerId,
        teamId: TEAM_OF[playerId] ?? 'team-a',
        statId,
        delta,
        videoMs: sequence * 4000,
        createdBy: sequence % 3 === 0 ? 'user-gonza' : 'user-profe',
        createdAt: 1_700_000_000_000 + sequence * 4000,
        deletedAt: null,
        deletedBy: null,
      })
    }
    return this
  }

  correct(playerId: string, statId: StatId): this {
    return this.add(playerId, statId, 1, -1)
  }

  build(): MatchEvent[] {
    return this.events
  }
}

/** A match with rosters but nothing counted yet. */
export function emptyMatch(): Match {
  return baseMatch('match-empty', 'Fecha sin cargar', [])
}

/**
 * A full match generated from a fixed seed. Exercises every statistic, both
 * teams, corrections with a negative delta, and enough volume for the
 * percentage readings to clear their minimums.
 */
export function typicalMatch(): Match {
  const random = mulberry32(20260723)
  const log = new EventLog()
  const playerIds = [...TEAM_A.players, ...TEAM_B.players].map((player) => player.id)

  const weights: Array<[StatId, number]> = [
    ['pasesCompletados', 34],
    ['pasesErrados', 12],
    ['disparosAlArco', 7],
    ['disparosErrados', 8],
    ['goles', 3],
    ['asistencias', 3],
    ['intercepciones', 8],
    ['robosDePelota', 8],
    ['regatesExitosos', 7],
    ['regatesFallidos', 5],
    ['golesEvitados', 2],
    ['atajadas', 2],
    ['burradas', 1],
  ]

  const table = weights.flatMap(([statId, weight]) => Array<StatId>(weight).fill(statId))

  for (let index = 0; index < 320; index += 1) {
    const playerId = playerIds[Math.floor(random() * playerIds.length)] ?? 'a1'
    const statId = table[Math.floor(random() * table.length)] ?? 'pasesCompletados'
    log.add(playerId, statId)
  }

  log.correct('a1', 'pasesCompletados')
  log.correct('b3', 'disparosErrados')
  log.correct('a4', 'regatesFallidos')

  return baseMatch('match-typical', 'Fecha del jueves', log.build())
}

/**
 * Hand-built boundaries. Each block targets a rule that a random match would
 * only hit by luck: the minimum-attempts thresholds, the ranking tiebreakers,
 * a drawn result, equal defensive work, shared leaderboards, readings that must
 * be skipped for lack of data, and a player with nothing recorded.
 */
export function edgeCaseMatch(): Match {
  const log = new EventLog()

  log.add('a1', 'goles', 2)
  log.add('b1', 'goles', 2)

  log.add('a2', 'pasesCompletados', 7).add('a2', 'pasesErrados', 1)
  log.add('a3', 'pasesCompletados', 7)

  log.add('a4', 'disparosAlArco', 2).add('a4', 'disparosErrados', 1)
  log.add('a5', 'disparosAlArco', 2)

  log.add('a6', 'regatesExitosos', 2).add('a6', 'regatesFallidos', 1)
  log.add('b2', 'regatesExitosos', 2)

  log.add('a7', 'intercepciones', 2).add('a7', 'robosDePelota', 1)
  log.add('b3', 'intercepciones', 1).add('b3', 'robosDePelota', 2)

  log.add('b4', 'goles', 1)
  log.add('b5', 'asistencias', 1).add('b5', 'pasesCompletados', 4)

  log.add('b6', 'disparosAlArco', 2)

  log.add('a3', 'burradas', 1)

  return baseMatch('match-edge', 'Partido de bordes', log.build())
}

/**
 * A drawn match with both teams level on every comparable figure, which is the
 * only way to reach the "Empataron" result and the "Empate" highlights.
 */
export function drawnMatch(): Match {
  const log = new EventLog()

  log.add('a1', 'goles', 2)
  log.add('b1', 'goles', 2)

  log.add('a2', 'pasesCompletados', 6).add('a2', 'pasesErrados', 2)
  log.add('b2', 'pasesCompletados', 6).add('b2', 'pasesErrados', 2)

  log.add('a3', 'disparosAlArco', 3).add('a3', 'disparosErrados', 2)
  log.add('b3', 'disparosAlArco', 3).add('b3', 'disparosErrados', 2)

  log.add('a4', 'regatesExitosos', 2).add('a4', 'regatesFallidos', 2)
  log.add('b4', 'regatesExitosos', 2).add('b4', 'regatesFallidos', 2)

  log.add('a5', 'intercepciones', 2).add('a5', 'atajadas', 1)
  log.add('b5', 'intercepciones', 2).add('b5', 'atajadas', 1)

  return baseMatch('match-drawn', 'Partido empatado', log.build())
}

export const FIXTURES = {
  empty: emptyMatch,
  typical: typicalMatch,
  edge: edgeCaseMatch,
  drawn: drawnMatch,
} as const

export type FixtureName = keyof typeof FIXTURES

function mulberry32(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state)
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296
  }
}
