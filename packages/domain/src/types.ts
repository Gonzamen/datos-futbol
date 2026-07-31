import type { StatId } from './stats.js'

/**
 * Somebody who plays with the group. Lives outside any single match: the same
 * person shows up across many matches, which is what makes season totals
 * possible even though the fourteen who play change every weekend.
 */
export interface Person {
  id: string
  name: string
  createdAt: number
}

/**
 * A person's participation in one match, inside one team.
 *
 * `name` is denormalized on purpose. A match is the record of what happened
 * that day and has to read and export on its own, without depending on the
 * current state of the registry: renaming somebody in March must not rewrite
 * February. Season totals aggregate by `personId`, so they stay correct anyway.
 */
export interface Player {
  id: string
  personId: string
  name: string
}

export interface Team {
  id: string
  name: string
  color: string
  players: Player[]
}

/**
 * A single statistic recorded against a player. Corrections are events with a
 * negative delta, so totals are always the sum of the log and never drift.
 *
 * `videoMs` is the position in the match video where the action happens. It is
 * null for matches imported from the original live-counter version, which had
 * no video to anchor to.
 */
export interface MatchEvent {
  id: string
  playerId: string
  teamId: string
  statId: StatId
  delta: number
  videoMs: number | null
  createdBy: string | null
  createdAt: number
  deletedAt: number | null
  deletedBy: string | null
}

export type VideoProvider = 'youtube'

export interface VideoReference {
  provider: VideoProvider
  videoId: string
}

export interface Match {
  id: string
  name: string
  date: string
  video: VideoReference | null
  teams: Team[]
  events: MatchEvent[]
}

export type StatTotals = Record<StatId, number>

/** Per-player and per-team totals, including the derived shot count. */
export interface Totals extends StatTotals {
  disparos: number
}

export interface PlayerMetrics {
  participacionesEnGol: number
  pasesTotales: number
  regatesTotales: number
  accionesTotales: number
  efectividadPases: number
  precisionDisparos: number
  conversionGoles: number
  efectividadRegate: number
  accionesDefensivas: number
}

export interface TeamMetrics {
  efectividadPases: number
  precisionDisparos: number
  conversionGoles: number
  efectividadRegate: number
  accionesDefensivas: number
}

export interface PlayerReport {
  id: string
  name: string
  teamId: string
  teamName: string
  color: string
  score: number
  totals: Totals
  metrics: PlayerMetrics
}

export interface RankedPlayer extends PlayerReport {
  position: number
}

export interface TeamReport {
  id: string
  name: string
  color: string
  playerCount: number
  totals: Totals
  metrics: TeamMetrics
}

export interface Highlight {
  label: string
  format: 'number' | 'percent'
  winnerName: string
  winnerColor: string | null
  value: number
  difference: number
}

export interface Leader {
  label: string
  names: string
  color: string | null
  value: number
}

export interface MatchReport {
  playerTotals: Record<string, Totals>
  teams: TeamReport[]
  ranking: RankedPlayer[]
  highlights: Highlight[]
  leaders: Leader[]
}

export interface Reading {
  label: string
  text: string
}
