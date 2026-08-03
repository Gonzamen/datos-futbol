import { STAT_DEFINITIONS } from './stats.js'
import type { StatId } from './stats.js'
import type { PlayerReport, Totals } from './types.js'

/**
 * Points each action adds to the individual score. Positive actions build the
 * ranking, mistakes discount it, so a busy but sloppy player does not climb.
 */
export const SCORE_WEIGHTS: Record<StatId, number> = {
  goles: 6,
  golesEvitados: 5,
  asistencias: 4,
  atajadas: 2,
  disparosAlArco: 1.5,
  robosDePelota: 1,
  regatesExitosos: 1,
  intercepciones: 0.75,
  pasesCompletados: 0.5,
  disparosErrados: -0.75,
  pasesErrados: -0.75,
  regatesFallidos: -0.75,
  faltas: -0.75,
  burradas: -5,
  despejes: 0.75,
  controlesFallidos: -0.75,
  pasesClave: 1.5,
}

const WEIGHTED_STAT_IDS = Object.keys(SCORE_WEIGHTS) as StatId[]

export function scoreOf(totals: Totals): number {
  return WEIGHTED_STAT_IDS.reduce((points, statId) => {
    return points + totals[statId] * SCORE_WEIGHTS[statId]
  }, 0)
}

/**
 * Ranking order: score first, then goals, then assists, then name. The
 * tiebreakers keep the table stable when two players finish level.
 */
export function comparePlayers(first: PlayerReport, second: PlayerReport): number {
  return (
    second.score - first.score ||
    second.totals.goles - first.totals.goles ||
    second.totals.asistencias - first.totals.asistencias ||
    first.name.localeCompare(second.name)
  )
}

export function actionCount(totals: Totals): number {
  return STAT_DEFINITIONS.reduce((count, stat) => count + totals[stat.id], 0)
}

export function shots(totals: Totals): number {
  return totals.disparosAlArco + totals.disparosErrados
}

export function dribbles(totals: Totals): number {
  return totals.regatesExitosos + totals.regatesFallidos
}

export function defensiveActions(totals: Totals): number {
  return (
    totals.intercepciones +
    totals.robosDePelota +
    totals.despejes +
    totals.golesEvitados +
    totals.atajadas
  )
}

export function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}
