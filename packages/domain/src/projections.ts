import { activeEvents, roster } from './match.js'
import {
  actionCount,
  comparePlayers,
  defensiveActions,
  dribbles,
  ratio,
  scoreOf,
  shots,
} from './scoring.js'
import { STAT_DEFINITIONS, findStat } from './stats.js'
import type {
  Highlight,
  Leader,
  Match,
  MatchReport,
  Player,
  PlayerReport,
  RankedPlayer,
  Team,
  TeamReport,
  Totals,
} from './types.js'

/**
 * Builds every number shown in the app from the match event log. Recomputing
 * the whole report on each change is cheap at this scale and removes any chance
 * of the displayed totals drifting from the log they came from.
 */
export function buildReport(match: Match): MatchReport {
  const playerTotals = totalsByPlayer(match)
  const teams = match.teams.map((team) => buildTeamReport(team, playerTotals))

  return {
    playerTotals,
    teams,
    ranking: buildRanking(match, playerTotals),
    highlights: buildHighlights(teams),
    leaders: buildLeaders(match, playerTotals),
  }
}

export function totalsByPlayer(match: Match): Record<string, Totals> {
  const totals: Record<string, Totals> = {}

  for (const { player } of roster(match)) {
    totals[player.id] = emptyTotals()
  }

  for (const event of activeEvents(match)) {
    const playerTotals = totals[event.playerId]
    if (playerTotals && findStat(event.statId)) {
      playerTotals[event.statId] += event.delta
    }
  }

  for (const playerTotals of Object.values(totals)) {
    playerTotals.disparos = shots(playerTotals)
  }

  return totals
}

/**
 * Orders every player that touched the ball by individual score. Players with
 * no recorded action are left out: they did not play badly, there is simply
 * nothing to rank them on.
 */
export function buildRanking(match: Match, playerTotals: Record<string, Totals>): RankedPlayer[] {
  return roster(match)
    .map(({ player, team }) => buildPlayerReport(player, team, playerTotals[player.id]))
    .filter((player) => player.metrics.accionesTotales > 0)
    .sort(comparePlayers)
    .map((player, index) => ({ position: index + 1, ...player }))
}

function buildPlayerReport(
  player: Player,
  team: Team,
  totals: Totals = emptyTotals(),
): PlayerReport {
  const passes = totals.pasesCompletados + totals.pasesErrados

  return {
    id: player.id,
    name: player.name,
    teamId: team.id,
    teamName: team.name,
    color: team.color,
    score: scoreOf(totals),
    totals,
    metrics: {
      participacionesEnGol: totals.goles + totals.asistencias,
      pasesTotales: passes,
      regatesTotales: dribbles(totals),
      accionesTotales: actionCount(totals),
      efectividadPases: ratio(totals.pasesCompletados, passes),
      precisionDisparos: ratio(totals.disparosAlArco, totals.disparos),
      conversionGoles: ratio(totals.goles, totals.disparos),
      efectividadRegate: ratio(totals.regatesExitosos, dribbles(totals)),
      accionesDefensivas: defensiveActions(totals),
    },
  }
}

function buildTeamReport(team: Team, playerTotals: Record<string, Totals>): TeamReport {
  const totals = team.players.reduce<Totals>((accumulated, player) => {
    const stats = playerTotals[player.id] ?? emptyTotals()
    for (const stat of STAT_DEFINITIONS) {
      accumulated[stat.id] += stats[stat.id]
    }
    return accumulated
  }, emptyTotals())

  totals.disparos = shots(totals)

  return {
    id: team.id,
    name: team.name,
    color: team.color,
    playerCount: team.players.length,
    totals,
    metrics: {
      efectividadPases: ratio(
        totals.pasesCompletados,
        totals.pasesCompletados + totals.pasesErrados,
      ),
      precisionDisparos: ratio(totals.disparosAlArco, totals.disparos),
      conversionGoles: ratio(totals.goles, totals.disparos),
      efectividadRegate: ratio(totals.regatesExitosos, dribbles(totals)),
      accionesDefensivas: defensiveActions(totals),
    },
  }
}

interface HighlightDefinition {
  label: string
  format: Highlight['format']
  read: (team: TeamReport) => number
}

const HIGHLIGHT_DEFINITIONS: HighlightDefinition[] = [
  { label: 'Más Goles', format: 'number', read: (team) => team.totals.goles },
  { label: 'Más Disparos', format: 'number', read: (team) => team.totals.disparos },
  { label: 'Mejor % Pases', format: 'percent', read: (team) => team.metrics.efectividadPases },
  { label: 'Mejor % Regates', format: 'percent', read: (team) => team.metrics.efectividadRegate },
  {
    label: 'Más Acciones Defensivas',
    format: 'number',
    read: (team) => team.metrics.accionesDefensivas,
  },
]

function buildHighlights(teams: TeamReport[]): Highlight[] {
  const [home, away] = teams

  if (teams.length !== 2 || !home || !away) {
    return []
  }

  return HIGHLIGHT_DEFINITIONS.map((definition) => {
    const first = definition.read(home)
    const second = definition.read(away)
    const winner = first === second ? null : first > second ? home : away

    return {
      label: definition.label,
      format: definition.format,
      winnerName: winner ? winner.name : 'Empate',
      winnerColor: winner ? winner.color : null,
      value: Math.max(first, second),
      difference: Math.abs(first - second),
    }
  })
}

interface LeaderDefinition {
  label: string
  statId: keyof Totals
}

const LEADER_DEFINITIONS: LeaderDefinition[] = [
  { label: 'Goleador', statId: 'goles' },
  { label: 'Máximo Asistidor', statId: 'asistencias' },
  { label: 'Más Disparos', statId: 'disparos' },
  { label: 'Mejor Pasador', statId: 'pasesCompletados' },
  { label: 'Más Pases Clave', statId: 'pasesClave' },
  { label: 'Más Intercepciones', statId: 'intercepciones' },
  { label: 'Más Robos', statId: 'robosDePelota' },
  { label: 'Más Despejes', statId: 'despejes' },
  { label: 'Más Regates Exitosos', statId: 'regatesExitosos' },
  { label: 'Más Goles Evitados', statId: 'golesEvitados' },
  { label: 'Más Atajadas', statId: 'atajadas' },
  { label: 'Más Burradas', statId: 'burradas' },
  { label: 'Más Faltas', statId: 'faltas' },
]

interface LeaderCandidate {
  name: string
  color: string
  totals: Totals
}

function buildLeaders(match: Match, playerTotals: Record<string, Totals>): Leader[] {
  const candidates: LeaderCandidate[] = roster(match).map(({ player, team }) => ({
    name: player.name,
    color: team.color,
    totals: playerTotals[player.id] ?? emptyTotals(),
  }))

  return LEADER_DEFINITIONS.map((definition) => ({
    label: definition.label,
    ...topPlayers(candidates, definition.statId),
  }))
}

function topPlayers(candidates: LeaderCandidate[], statId: keyof Totals): Omit<Leader, 'label'> {
  const best = candidates.reduce((maximum, player) => Math.max(maximum, player.totals[statId]), 0)

  if (best === 0) {
    return { names: '—', color: null, value: 0 }
  }

  const winners = candidates.filter((player) => player.totals[statId] === best)
  const [only] = winners

  return {
    names: winners.map((player) => player.name).join(', '),
    color: winners.length === 1 && only ? only.color : null,
    value: best,
  }
}

export function emptyTotals(): Totals {
  const totals = { disparos: 0 } as Totals

  for (const stat of STAT_DEFINITIONS) {
    totals[stat.id] = 0
  }

  return totals
}
