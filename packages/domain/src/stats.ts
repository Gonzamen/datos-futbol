/**
 * Statistics tracked per player. Order defines the on-screen layout, and each
 * entry carries the keyboard shortcut that counts it.
 */
export const STAT_DEFINITIONS = [
  {
    id: 'pasesCompletados',
    label: 'Pases Completados',
    short: 'Pase OK',
    tone: 'positive',
    key: '1',
  },
  {
    id: 'pasesErrados',
    label: 'Pases Errados',
    short: 'Pase errado',
    tone: 'negative',
    key: '2',
  },
  {
    id: 'disparosAlArco',
    label: 'Disparos al Arco',
    short: 'Al arco',
    tone: 'positive',
    key: '3',
  },
  {
    id: 'disparosErrados',
    label: 'Disparos Errados',
    short: 'Disparo afuera',
    tone: 'negative',
    key: '4',
  },
  { id: 'goles', label: 'Goles', short: 'Gol', tone: 'highlight', key: '5' },
  {
    id: 'asistencias',
    label: 'Asistencias',
    short: 'Asistencia',
    tone: 'highlight',
    key: '6',
  },
  {
    id: 'intercepciones',
    label: 'Intercepción de Pase',
    short: 'Intercepción',
    tone: 'positive',
    key: '7',
  },
  {
    id: 'robosDePelota',
    label: 'Robo de Pelota',
    short: 'Robo',
    tone: 'positive',
    key: '8',
  },
  {
    id: 'regatesExitosos',
    label: 'Regate Exitoso',
    short: 'Regate OK',
    tone: 'positive',
    key: '9',
  },
  {
    id: 'regatesFallidos',
    label: 'Regate Fallido',
    short: 'Regate errado',
    tone: 'negative',
    key: '0',
  },
  {
    id: 'golesEvitados',
    label: 'Goles Evitados',
    short: 'Gol evitado',
    tone: 'highlight',
    key: 'E',
  },
  { id: 'atajadas', label: 'Atajadas', short: 'Atajada', tone: 'positive', key: 'A' },
  { id: 'burradas', label: 'Burradas', short: 'Burrada', tone: 'negative', key: 'B' },
  { id: 'faltas', label: 'Faltas', short: 'Falta', tone: 'negative', key: 'F' },
] as const

export type StatDefinition = (typeof STAT_DEFINITIONS)[number]

export type StatId = StatDefinition['id']

export type StatTone = StatDefinition['tone']

/**
 * Shots are never counted by hand: they are the sum of shots on target and
 * missed shots. Metrics that need the total refer to it by this key.
 */
export const DERIVED_SHOTS = 'disparos'

const STATS_BY_ID = new Map<string, StatDefinition>(STAT_DEFINITIONS.map((stat) => [stat.id, stat]))

const STATS_BY_KEY = new Map<string, StatDefinition>(
  STAT_DEFINITIONS.map((stat) => [stat.key.toLowerCase(), stat]),
)

export function findStat(statId: string): StatDefinition | undefined {
  return STATS_BY_ID.get(statId)
}

export function isStatId(statId: string): statId is StatId {
  return STATS_BY_ID.has(statId)
}

/**
 * Names a statistic for display. Matches counted before a statistic was
 * retired keep their events, so the fallback has to stay readable.
 */
export function statLabel(statId: string): string {
  return findStat(statId)?.label ?? 'Estadística eliminada'
}

export function findStatByKey(key: string): StatDefinition | undefined {
  return STATS_BY_KEY.get(key.toLowerCase())
}
