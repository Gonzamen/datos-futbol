import { describe, expect, it } from 'vitest'
import { buildSeasonReport } from '../src/season.js'
import type { Match, MatchEvent, Team } from '../src/types.js'

function team(id: string, players: Team['players']): Team {
  return { id, name: id, color: '#000000', players }
}

function event(overrides: Partial<MatchEvent> & Pick<MatchEvent, 'playerId' | 'statId'>): MatchEvent {
  return {
    id: `${overrides.playerId}-${overrides.statId}-${Math.random()}`,
    teamId: 'team-a',
    delta: 1,
    videoMs: null,
    createdBy: null,
    createdAt: 0,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }
}

function match(overrides: Partial<Match> & Pick<Match, 'id' | 'date'>): Match {
  return {
    name: overrides.id,
    video: null,
    teams: [],
    events: [],
    ...overrides,
  }
}

describe('buildSeasonReport', () => {
  it('acumula partidos y totales por personId aunque el player.id cambie cada partido', () => {
    const matchOne = match({
      id: 'match-1',
      date: '2026-07-01',
      teams: [team('team-a', [{ id: 'p1-m1', personId: 'person-pollo', name: 'Pollo' }])],
      events: [event({ playerId: 'p1-m1', statId: 'goles', teamId: 'team-a' })],
    })
    const matchTwo = match({
      id: 'match-2',
      date: '2026-07-08',
      teams: [team('team-a', [{ id: 'p1-m2', personId: 'person-pollo', name: 'Pollo' }])],
      events: [event({ playerId: 'p1-m2', statId: 'goles', teamId: 'team-a' })],
    })

    const report = buildSeasonReport([matchOne, matchTwo])

    expect(report.matchesPlayed).toBe(2)
    expect(report.ranking).toHaveLength(1)
    expect(report.ranking[0]).toMatchObject({
      personId: 'person-pollo',
      matchesPlayed: 2,
      position: 1,
    })
    expect(report.ranking[0]?.totals.goles).toBe(2)
  })

  it('deja afuera del ranking a quien nunca cargó una acción', () => {
    const withoutActions = match({
      id: 'match-1',
      date: '2026-07-01',
      teams: [team('team-a', [{ id: 'p1', personId: 'person-lanza', name: 'Lanza' }])],
      events: [],
    })

    const report = buildSeasonReport([withoutActions])

    expect(report.ranking).toEqual([])
  })

  it('usa el nombre del partido más reciente, sin importar el orden del array de entrada', () => {
    const older = match({
      id: 'match-old',
      date: '2026-07-01',
      teams: [team('team-a', [{ id: 'p-old', personId: 'person-gonchi', name: 'Gonchí' }])],
      events: [event({ playerId: 'p-old', statId: 'goles', teamId: 'team-a' })],
    })
    const newer = match({
      id: 'match-new',
      date: '2026-07-15',
      teams: [team('team-a', [{ id: 'p-new', personId: 'person-gonchi', name: 'Gonchi' }])],
      events: [event({ playerId: 'p-new', statId: 'goles', teamId: 'team-a' })],
    })

    const report = buildSeasonReport([newer, older])

    expect(report.ranking[0]?.name).toBe('Gonchi')
  })

  it('no cuenta un evento borrado', () => {
    const withDeleted = match({
      id: 'match-1',
      date: '2026-07-01',
      teams: [team('team-a', [{ id: 'p1', personId: 'person-brn', name: 'Brn' }])],
      events: [
        event({
          playerId: 'p1',
          statId: 'goles',
          teamId: 'team-a',
          deletedAt: 1_700_000_000_000,
          deletedBy: 'user-gonza',
        }),
      ],
    })

    const report = buildSeasonReport([withDeleted])

    expect(report.ranking).toEqual([])
  })

  it('los récords apuntan al partido correcto y, en caso de empate, al más temprano', () => {
    const first = match({
      id: 'match-1',
      date: '2026-07-01',
      name: 'Primer partido',
      teams: [team('team-a', [{ id: 'p1', personId: 'person-facu', name: 'Facu' }])],
      events: [event({ playerId: 'p1', statId: 'goles', teamId: 'team-a', delta: 2 })],
    })
    const second = match({
      id: 'match-2',
      date: '2026-07-08',
      name: 'Segundo partido',
      teams: [team('team-a', [{ id: 'p2', personId: 'person-kuki', name: 'Kuki' }])],
      events: [event({ playerId: 'p2', statId: 'goles', teamId: 'team-a', delta: 2 })],
    })

    const report = buildSeasonReport([first, second])
    const mostGoals = report.records.find((record) => record.label === 'Más Goles en un Partido')

    expect(mostGoals?.entry).toMatchObject({
      personId: 'person-facu',
      value: 2,
      matchId: 'match-1',
      matchName: 'Primer partido',
    })
  })

  it('sin partidos, el reporte queda vacío y todos los récords en null', () => {
    const report = buildSeasonReport([])

    expect(report.matchesPlayed).toBe(0)
    expect(report.ranking).toEqual([])
    expect(report.records.every((record) => record.entry === null)).toBe(true)
  })
})
