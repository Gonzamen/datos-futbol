import { roster } from './match.js'
import { emptyTotals, totalsByPlayer } from './projections.js'
import { actionCount, scoreOf, shots } from './scoring.js'
import { STAT_DEFINITIONS } from './stats.js'
import type { Match, Totals } from './types.js'

/**
 * Accumulated stats for one person across every match they played, keyed by
 * `personId` rather than any single match's `player.id` — the same person gets
 * a fresh player id every match (see `Player` in types.ts), so `personId` is
 * the only identity that survives across the season.
 */
export interface SeasonPlayerStats {
  personId: string
  name: string
  matchesPlayed: number
  totals: Totals
  score: number
  averageScore: number
}

export interface RankedSeasonPlayer extends SeasonPlayerStats {
  position: number
}

export interface SeasonRecordEntry {
  personId: string
  name: string
  value: number
  matchId: string
  matchName: string
  matchDate: string
}

export interface SeasonRecord {
  label: string
  entry: SeasonRecordEntry | null
}

export interface SeasonReport {
  matchesPlayed: number
  ranking: RankedSeasonPlayer[]
  records: SeasonRecord[]
}

/**
 * One player's totals in one match, flattened out of the match's roster and
 * report. Both the season ranking and the single-match records are derived
 * from the same list, built in a single pass over `matches`, so a season with
 * a lot of history is not walked twice.
 */
interface Appearance {
  personId: string
  name: string
  matchId: string
  matchName: string
  matchDate: string
  totals: Totals
  score: number
}

export function buildSeasonReport(matches: Match[]): SeasonReport {
  const appearances = collectAppearances(matches)

  return {
    matchesPlayed: matches.length,
    ranking: buildRanking(appearances),
    records: buildRecords(appearances),
  }
}

/**
 * Ordered oldest to newest so that folding appearances in array order and
 * always keeping the latest one is enough to pick each person's current name
 * — no separate timestamp is needed beyond `Match.date`.
 */
function collectAppearances(matches: Match[]): Appearance[] {
  const ordered = [...matches].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )

  return ordered.flatMap((match) => {
    const totals = totalsByPlayer(match)

    return roster(match).map(({ player }): Appearance => ({
      personId: player.personId,
      name: player.name,
      matchId: match.id,
      matchName: match.name,
      matchDate: match.date,
      totals: totals[player.id] ?? emptyTotals(),
      score: scoreOf(totals[player.id] ?? emptyTotals()),
    }))
  })
}

function buildRanking(appearances: Appearance[]): RankedSeasonPlayer[] {
  const byPerson = new Map<string, SeasonPlayerStats>()

  for (const appearance of appearances) {
    const existing = byPerson.get(appearance.personId)
    const totals = existing ? sumTotals(existing.totals, appearance.totals) : appearance.totals

    byPerson.set(appearance.personId, {
      personId: appearance.personId,
      name: appearance.name,
      matchesPlayed: (existing?.matchesPlayed ?? 0) + 1,
      totals,
      score: 0,
      averageScore: 0,
    })
  }

  return Array.from(byPerson.values())
    .map((player) => {
      const score = scoreOf(player.totals)
      return { ...player, score, averageScore: score / player.matchesPlayed }
    })
    .filter((player) => actionCount(player.totals) > 0)
    .sort(compareSeasonPlayers)
    .map((player, index) => ({ position: index + 1, ...player }))
}

/**
 * Same tiebreak order as `comparePlayers` in scoring.ts (score, then goals,
 * then assists, then name), duplicated rather than reused because
 * `comparePlayers` is typed against `PlayerReport`, which carries per-match
 * fields (`teamId`, `color`) a season total does not have.
 */
function compareSeasonPlayers(first: SeasonPlayerStats, second: SeasonPlayerStats): number {
  return (
    second.score - first.score ||
    second.totals.goles - first.totals.goles ||
    second.totals.asistencias - first.totals.asistencias ||
    first.name.localeCompare(second.name)
  )
}

interface RecordDefinition {
  label: string
  read: (totals: Totals) => number
}

const RECORD_DEFINITIONS: RecordDefinition[] = [
  { label: 'Mejor Puntaje en un Partido', read: (totals) => scoreOf(totals) },
  { label: 'Más Goles en un Partido', read: (totals) => totals.goles },
  { label: 'Más Asistencias en un Partido', read: (totals) => totals.asistencias },
  { label: 'Más Atajadas en un Partido', read: (totals) => totals.atajadas },
  {
    label: 'Más Acciones Defensivas en un Partido',
    read: (totals) => totals.intercepciones + totals.robosDePelota + totals.golesEvitados + totals.atajadas,
  },
]

/**
 * Ties keep the earliest match, not an arbitrary one — a deliberate,
 * deterministic choice (`>` rather than `>=`) so the same input always
 * produces the same record holder.
 */
function buildRecords(appearances: Appearance[]): SeasonRecord[] {
  return RECORD_DEFINITIONS.map((definition) => {
    let best: SeasonRecordEntry | null = null
    let bestValue = 0

    for (const appearance of appearances) {
      const value = definition.read(appearance.totals)

      if (value > bestValue) {
        bestValue = value
        best = {
          personId: appearance.personId,
          name: appearance.name,
          value,
          matchId: appearance.matchId,
          matchName: appearance.matchName,
          matchDate: appearance.matchDate,
        }
      }
    }

    return { label: definition.label, entry: best }
  })
}

function sumTotals(a: Totals, b: Totals): Totals {
  const totals = { disparos: 0 } as Totals

  for (const stat of STAT_DEFINITIONS) {
    totals[stat.id] = a[stat.id] + b[stat.id]
  }

  totals.disparos = shots(totals)

  return totals
}
