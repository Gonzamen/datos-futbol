import type { MatchReport, RankedPlayer, Reading, TeamReport, Totals } from './types.js'

/**
 * Percentage readings need a minimum number of attempts before they mean
 * anything: without them a single completed pass would crown the most accurate
 * passer of the match.
 */
const MIN_PASSES_FOR_ACCURACY = 8
const MIN_SHOTS_FOR_ACCURACY = 3
const MIN_DRIBBLES_FOR_ACCURACY = 3

/**
 * Turns the numeric report into the short readings shown under "Análisis del
 * partido". Every reading is skipped when there is not enough data to support
 * it, so the list never states conclusions the match does not back up.
 */
export function buildAnalysis(report: MatchReport): Reading[] {
  if (!report.ranking.length) {
    return [
      {
        label: 'Sin datos',
        text: 'Cargá algunas estadísticas y acá vas a ver el análisis del partido.',
      },
    ]
  }

  return [
    resultReading(report.teams),
    figureReading(report.ranking),
    goalParticipationReading(report),
    passingTeamReading(report.teams),
    shootingTeamReading(report.teams),
    defensiveTeamReading(report.teams),
    safestPlayerReading(report.ranking),
    sharpestShooterReading(report.ranking),
    bestDribblerReading(report.ranking),
    ballWinnerReading(report.ranking),
    goalSaverReading(report.ranking),
    keeperReading(report.ranking),
    worstDribblerReading(report.ranking),
    blunderReading(report.ranking),
  ].filter((entry): entry is Reading => entry !== null)
}

function resultReading(teams: TeamReport[]): Reading | null {
  const [home, away] = teams

  if (teams.length !== 2 || !home || !away) {
    return null
  }

  const score = `${home.totals.goles} a ${away.totals.goles}`

  if (home.totals.goles === away.totals.goles) {
    return reading('Resultado', `Empataron ${score}.`)
  }

  const winner = home.totals.goles > away.totals.goles ? home : away
  const difference = Math.abs(home.totals.goles - away.totals.goles)

  return reading(
    'Resultado',
    `${winner.name} ganó ${score}, por ${difference}${difference === 1 ? ' gol.' : ' goles.'}`,
  )
}

function figureReading(ranking: RankedPlayer[]): Reading | null {
  const best = ranking[0]

  if (!best) {
    return null
  }

  return reading(
    'Figura del partido',
    `${best.name} (${best.teamName}) con ${formatScore(best.score)} puntos: ${describeContribution(best)}.`,
  )
}

function describeContribution(player: RankedPlayer): string {
  const parts = [
    countPart(player.totals.goles, 'gol', 'goles'),
    countPart(player.totals.asistencias, 'asistencia', 'asistencias'),
    countPart(player.totals.golesEvitados, 'gol evitado', 'goles evitados'),
    countPart(player.totals.robosDePelota, 'robo', 'robos'),
    countPart(player.totals.pasesCompletados, 'pase completado', 'pases completados'),
  ].filter(isPresent)

  return parts.length ? joinWithAnd(parts) : `${player.metrics.accionesTotales} acciones`
}

function goalParticipationReading(report: MatchReport): Reading | null {
  const best = maxBy(report.ranking, (player) => player.metrics.participacionesEnGol)

  if (!best || best.metrics.participacionesEnGol === 0) {
    return null
  }

  const team = report.teams.find((candidate) => candidate.id === best.teamId)

  if (!team || team.totals.goles === 0) {
    return null
  }

  if (team.totals.goles === 1) {
    return reading('Peso en los goles', `${best.name} participó en el único gol de ${team.name}.`)
  }

  const share = formatPercent(best.metrics.participacionesEnGol / team.totals.goles)

  return reading(
    'Peso en los goles',
    `${best.name} participó en ${best.metrics.participacionesEnGol} de los ${team.totals.goles} goles de ${team.name} (${share}).`,
  )
}

function passingTeamReading(teams: TeamReport[]): Reading | null {
  const best = maxBy(teams, (team) => team.metrics.efectividadPases)

  if (!best || passesOf(best) === 0) {
    return null
  }

  return reading(
    'Circulación',
    `${best.name} fue el equipo que mejor movió la pelota: ${formatPercent(best.metrics.efectividadPases)} de pases buenos (${best.totals.pasesCompletados} de ${passesOf(best)}).`,
  )
}

function shootingTeamReading(teams: TeamReport[]): Reading | null {
  const best = maxBy(teams, (team) => team.totals.disparos)

  if (!best || best.totals.disparos === 0) {
    return null
  }

  return reading(
    'Puntería',
    `${best.name} remató ${best.totals.disparos} veces, ${formatPercent(best.metrics.precisionDisparos)} al arco, y convirtió ${best.totals.goles} (${formatPercent(best.metrics.conversionGoles)} de conversión).`,
  )
}

function defensiveTeamReading(teams: TeamReport[]): Reading | null {
  const [home, away] = teams

  if (teams.length !== 2 || !home || !away) {
    return null
  }

  const first = home.metrics.accionesDefensivas
  const second = away.metrics.accionesDefensivas

  if (first === 0 && second === 0) {
    return null
  }

  if (first === second) {
    return reading(
      'Trabajo defensivo',
      `Parejo: los dos equipos cortaron ${first} jugadas cada uno.`,
    )
  }

  const best = first > second ? home : away

  return reading(
    'Trabajo defensivo',
    `${best.name} cortó más juego con ${best.metrics.accionesDefensivas} acciones defensivas: ${describeDefense(best.totals)}.`,
  )
}

function describeDefense(totals: Totals): string {
  return joinWithAnd(
    [
      countPart(totals.intercepciones, 'intercepción', 'intercepciones'),
      countPart(totals.robosDePelota, 'robo', 'robos'),
      countPart(totals.golesEvitados, 'gol evitado', 'goles evitados'),
      countPart(totals.atajadas, 'atajada', 'atajadas'),
    ].filter(isPresent),
  )
}

function safestPlayerReading(ranking: RankedPlayer[]): Reading | null {
  const best = bestRatioBy(ranking, 'pasesTotales', MIN_PASSES_FOR_ACCURACY, 'efectividadPases')

  if (!best) {
    return null
  }

  return reading(
    'Más seguro con la pelota',
    `${best.name} completó ${formatPercent(best.metrics.efectividadPases)} de sus ${best.metrics.pasesTotales} pases.`,
  )
}

function sharpestShooterReading(ranking: RankedPlayer[]): Reading | null {
  const candidates = ranking.filter((player) => player.totals.disparos >= MIN_SHOTS_FOR_ACCURACY)
  const best = maxBy(candidates, (player) => player.metrics.precisionDisparos)

  if (!best) {
    return null
  }

  return reading(
    'Mejor definidor',
    `${best.name} mandó al arco ${formatPercent(best.metrics.precisionDisparos)} de sus ${best.totals.disparos} remates.`,
  )
}

function bestDribblerReading(ranking: RankedPlayer[]): Reading | null {
  const best = bestRatioBy(
    ranking,
    'regatesTotales',
    MIN_DRIBBLES_FOR_ACCURACY,
    'efectividadRegate',
  )

  if (!best) {
    return null
  }

  return reading(
    'Mejor gambeta',
    `${best.name} ganó ${best.totals.regatesExitosos} de sus ${best.metrics.regatesTotales} regates (${formatPercent(best.metrics.efectividadRegate)}).`,
  )
}

function ballWinnerReading(ranking: RankedPlayer[]): Reading | null {
  const best = maxBy(
    ranking,
    (player) => player.totals.intercepciones + player.totals.robosDePelota,
  )

  if (!best || best.totals.intercepciones + best.totals.robosDePelota === 0) {
    return null
  }

  const stolen = countPart(
    best.totals.intercepciones + best.totals.robosDePelota,
    'jugada',
    'jugadas',
  )

  const breakdown = joinWithAnd(
    [
      countPart(best.totals.intercepciones, 'intercepción', 'intercepciones'),
      countPart(best.totals.robosDePelota, 'robo', 'robos'),
    ].filter(isPresent),
  )

  return reading('Motor en la marca', `${best.name} cortó ${stolen}: ${breakdown}.`)
}

function goalSaverReading(ranking: RankedPlayer[]): Reading | null {
  const best = maxBy(ranking, (player) => player.totals.golesEvitados)

  if (!best || best.totals.golesEvitados === 0) {
    return null
  }

  return reading(
    'Salvador',
    `${best.name} evitó ${best.totals.golesEvitados}${best.totals.golesEvitados === 1 ? ' gol.' : ' goles.'}`,
  )
}

function keeperReading(ranking: RankedPlayer[]): Reading | null {
  const best = maxBy(ranking, (player) => player.totals.atajadas)

  if (!best || best.totals.atajadas === 0) {
    return null
  }

  return reading(
    'Bajo los tres palos',
    `${best.name} se quedó con ${countPart(best.totals.atajadas, 'atajada', 'atajadas')}.`,
  )
}

function worstDribblerReading(ranking: RankedPlayer[]): Reading | null {
  const worst = maxBy(ranking, (player) => player.totals.regatesFallidos)

  if (!worst || worst.totals.regatesFallidos === 0) {
    return null
  }

  return reading(
    'Para mejorar',
    `${worst.name} perdió ${worst.totals.regatesFallidos}${worst.totals.regatesFallidos === 1 ? ' regate.' : ' regates.'}`,
  )
}

function blunderReading(ranking: RankedPlayer[]): Reading | null {
  const worst = maxBy(ranking, (player) => player.totals.burradas)

  if (!worst || worst.totals.burradas === 0) {
    return null
  }

  return reading(
    'Burrada del partido',
    worst.totals.burradas === 1
      ? `La burrada del partido fue de ${worst.name}.`
      : `${worst.name} se mandó ${worst.totals.burradas} burradas.`,
  )
}

function bestRatioBy(
  ranking: RankedPlayer[],
  volumeMetric: 'pasesTotales' | 'regatesTotales',
  minimum: number,
  ratioMetric: 'efectividadPases' | 'efectividadRegate',
): RankedPlayer | null {
  const candidates = ranking.filter((player) => player.metrics[volumeMetric] >= minimum)
  return maxBy(candidates, (player) => player.metrics[ratioMetric])
}

function passesOf(team: TeamReport): number {
  return team.totals.pasesCompletados + team.totals.pasesErrados
}

/** Returns the first maximum, so ties fall back to the order of the list. */
function maxBy<T>(list: T[], read: (item: T) => number): T | null {
  return list.reduce<T | null>((best, candidate) => {
    return !best || read(candidate) > read(best) ? candidate : best
  }, null)
}

function countPart(value: number, singular: string, plural: string): string | null {
  return value > 0 ? `${value} ${value === 1 ? singular : plural}` : null
}

function joinWithAnd(parts: string[]): string {
  if (parts.length === 1) {
    return parts[0] ?? ''
  }
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

function reading(label: string, text: string): Reading {
  return { label, text }
}

function isPresent(value: string | null): value is string {
  return value !== null
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatScore(value: number): string {
  return value.toFixed(1).replace('.', ',')
}
