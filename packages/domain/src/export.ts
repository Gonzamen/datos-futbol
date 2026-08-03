import { buildAnalysis, formatPercent, formatScore } from './analysis.js'
import { matchTitle } from './match.js'
import { buildReport } from './projections.js'
import { STAT_DEFINITIONS } from './stats.js'
import type { Match, MatchReport, Totals } from './types.js'

/**
 * Builds the spreadsheet the group already knows how to read: same sections and
 * same column order as the original Excel, so exporting stays a drop-in
 * replacement rather than a new format to learn.
 *
 * Semicolon separated because that is what Excel expects in a Spanish locale;
 * the caller is responsible for prefixing the BOM when writing the file.
 */

const SEPARATOR = ';'

export const CSV_BOM = '﻿'

export function buildCsv(match: Match): string {
  const report = buildReport(match)
  const statLabels = STAT_DEFINITIONS.map((stat) => stat.label)

  const rows: CsvCell[][] = [
    [matchTitle(match)],
    ['Fecha', match.date],
    [],
    ['Equipo', 'Jugador', ...statLabels, 'Disparos'],
  ]

  for (const team of match.teams) {
    for (const player of team.players) {
      const totals = report.playerTotals[player.id]
      if (totals) {
        rows.push([team.name, player.name, ...statValues(totals), totals.disparos])
      }
    }
  }

  rows.push([], ['TOTALES POR EQUIPO'], ['Equipo', 'Jugadores', ...statLabels, 'Disparos'])
  for (const team of report.teams) {
    rows.push([team.name, team.playerCount, ...statValues(team.totals), team.totals.disparos])
  }

  rows.push(
    [],
    ['EFECTIVIDAD POR EQUIPO'],
    [
      'Equipo',
      '% Efectividad Pases',
      '% Disparos al Arco',
      '% Conversión Goles',
      '% Regates',
      'Acciones Defensivas',
    ],
  )
  for (const team of report.teams) {
    rows.push([
      team.name,
      formatPercent(team.metrics.efectividadPases),
      formatPercent(team.metrics.precisionDisparos),
      formatPercent(team.metrics.conversionGoles),
      formatPercent(team.metrics.efectividadRegate),
      team.metrics.accionesDefensivas,
    ])
  }

  rows.push([], ['RANKING DE JUGADORES'], RANKING_HEADERS)
  for (const player of report.ranking) {
    rows.push([
      player.position,
      player.name,
      player.teamName,
      formatScore(player.score),
      player.totals.goles,
      player.totals.asistencias,
      player.metrics.participacionesEnGol,
      player.totals.pasesCompletados,
      player.totals.pasesErrados,
      formatPercent(player.metrics.efectividadPases),
      player.totals.pasesClave,
      player.totals.disparos,
      player.totals.disparosAlArco,
      formatPercent(player.metrics.precisionDisparos),
      player.totals.regatesExitosos,
      player.totals.regatesFallidos,
      formatPercent(player.metrics.efectividadRegate),
      player.totals.intercepciones,
      player.totals.robosDePelota,
      player.totals.despejes,
      player.totals.golesEvitados,
      player.totals.atajadas,
      player.metrics.accionesDefensivas,
      player.totals.controlesFallidos,
      player.totals.burradas,
      player.totals.faltas,
    ])
  }

  rows.push([], ['ANÁLISIS DEL PARTIDO'])
  for (const reading of buildAnalysis(report)) {
    rows.push([reading.label, reading.text])
  }

  rows.push([], ['LÍDERES INDIVIDUALES'], ['Categoría', 'Jugador', 'Cantidad'])
  for (const leader of report.leaders) {
    rows.push([leader.label, leader.names, leader.value])
  }

  return rows.map(toCsvRow).join('\r\n')
}

export function buildJson(match: Match): string {
  return JSON.stringify(match, null, 2)
}

/**
 * A file name that survives Windows, macOS and Linux: no separators, no
 * reserved punctuation, and short enough not to be truncated by the browser.
 */
export function exportFileName(match: Match, extension: string): string {
  const name = matchTitle(match)
    .replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, '')
    .trim()

  return `${`${match.date} - ${name}`.slice(0, 80)}.${extension}`
}

const RANKING_HEADERS = [
  '#',
  'Jugador',
  'Equipo',
  'Puntaje',
  'Goles',
  'Asistencias',
  'G+A',
  'Pases Completados',
  'Pases Errados',
  '% Pases',
  'Pases Clave',
  'Disparos',
  'Al Arco',
  '% Al Arco',
  'Regates Exitosos',
  'Regates Fallidos',
  '% Regate',
  'Intercepciones',
  'Robos',
  'Despejes',
  'Goles Evitados',
  'Atajadas',
  'Acciones Defensivas',
  'Controles Fallidos',
  'Burradas',
  'Faltas',
]

type CsvCell = string | number

function statValues(totals: Totals): number[] {
  return STAT_DEFINITIONS.map((stat) => totals[stat.id])
}

function toCsvRow(cells: CsvCell[]): string {
  return cells.map(escapeCell).join(SEPARATOR)
}

function escapeCell(value: CsvCell): string {
  const text = String(value)
  return /["\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export type { MatchReport }
