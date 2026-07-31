import type { Match } from '@datos-futbol/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client.js'

const { matchesApi, peopleApi, segmentsApi, fakeSocket } = vi.hoisted(() => ({
  matchesApi: {
    get: vi.fn(),
    create: vi.fn(),
    join: vi.fn(),
    list: vi.fn(),
    updateInfo: vi.fn(),
    updateTeam: vi.fn(),
    addPlayer: vi.fn(),
    renamePlayer: vi.fn(),
    removePlayer: vi.fn(),
    addEvent: vi.fn(),
    removeEvent: vi.fn(),
  },
  peopleApi: {
    search: vi.fn(),
  },
  segmentsApi: {
    list: vi.fn(),
    generate: vi.fn(),
    claim: vi.fn(),
    complete: vi.fn(),
    release: vi.fn(),
  },
  fakeSocket: { on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() },
}))

vi.mock('../api/matches.js', () => ({ matchesApi, peopleApi }))
vi.mock('../api/segments.js', () => ({ segmentsApi }))
vi.mock('../realtime/socket.js', () => ({ connectMatchSocket: () => fakeSocket }))

const { useMatchStore } = await import('./matchStore.js')

function baseMatch(): Match {
  return {
    id: 'match-1',
    name: 'Fecha del jueves',
    date: '2026-07-30',
    video: null,
    teams: [
      {
        id: 'team-a',
        name: 'Equipo 1',
        color: '#f0a52a',
        players: [{ id: 'p1', personId: 'person-1', name: 'Pollo' }],
      },
      { id: 'team-b', name: 'Equipo 2', color: '#5cb85c', players: [] },
    ],
    events: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  segmentsApi.list.mockResolvedValue([])
  useMatchStore.setState({
    match: null,
    people: [],
    segments: [],
    presence: {},
    duplicateFlags: {},
    selectedPlayerId: null,
    currentUserId: null,
    loading: false,
    loadError: null,
    toast: null,
  })
})

describe('openMatch', () => {
  it('carga el partido y selecciona al primer jugador', async () => {
    matchesApi.get.mockResolvedValue({ match: baseMatch(), duplicateFlags: {} })
    peopleApi.search.mockResolvedValue([])

    await useMatchStore.getState().openMatch('match-1', 'user-1')

    expect(useMatchStore.getState().match?.id).toBe('match-1')
    expect(useMatchStore.getState().selectedPlayerId).toBe('p1')
    expect(useMatchStore.getState().currentUserId).toBe('user-1')
    expect(fakeSocket.emit).toHaveBeenCalledWith('join', { matchId: 'match-1' })
  })

  it('guarda las marcas de posible duplicado que trae el partido', async () => {
    matchesApi.get.mockResolvedValue({ match: baseMatch(), duplicateFlags: { e2: 'e1' } })
    peopleApi.search.mockResolvedValue([])

    await useMatchStore.getState().openMatch('match-1', 'user-1')

    expect(useMatchStore.getState().duplicateFlags).toEqual({ e2: 'e1' })
  })

  it('guarda el error si falla la carga', async () => {
    matchesApi.get.mockRejectedValue(new ApiError(403, 'No sos parte de este partido.'))
    peopleApi.search.mockResolvedValue([])

    await useMatchStore.getState().openMatch('match-1', 'user-1')

    expect(useMatchStore.getState().match).toBeNull()
    expect(useMatchStore.getState().loadError).toBe('No sos parte de este partido.')
  })
})

describe('count', () => {
  beforeEach(() => {
    useMatchStore.setState({ match: baseMatch(), currentUserId: 'user-1' })
  })

  it('aplica el evento al toque, antes de que responda el servidor', () => {
    matchesApi.addEvent.mockReturnValue(new Promise(() => {}))

    useMatchStore.getState().count('p1', 'goles', 1, 743_000)

    expect(useMatchStore.getState().match?.events).toHaveLength(1)
    expect(useMatchStore.getState().match?.events[0]?.videoMs).toBe(743_000)
  })

  it('revierte si el servidor rechaza el evento', async () => {
    matchesApi.addEvent.mockRejectedValue(new ApiError(500, 'boom'))

    useMatchStore.getState().count('p1', 'goles', 1, 0)
    await flush()

    expect(useMatchStore.getState().match?.events).toHaveLength(0)
    expect(useMatchStore.getState().toast).toContain('No se pudo guardar')
  })

  it('no permite que un total quede en negativo', () => {
    useMatchStore.getState().count('p1', 'goles', -1, 0)

    expect(useMatchStore.getState().match?.events).toHaveLength(0)
    expect(matchesApi.addEvent).not.toHaveBeenCalled()
  })

  it('marca el evento como posible duplicado si el servidor lo avisa', async () => {
    matchesApi.addEvent.mockResolvedValue({
      event: { id: 'whatever' },
      possibleDuplicateOf: 'e-anterior',
    })

    useMatchStore.getState().count('p1', 'goles', 1, 743_000)
    await flush()

    const [eventId] = Object.keys(useMatchStore.getState().duplicateFlags)
    expect(useMatchStore.getState().duplicateFlags[eventId!]).toBe('e-anterior')
  })

  it('avisa si cargás fuera de tu tramo asignado', () => {
    matchesApi.addEvent.mockReturnValue(new Promise(() => {}))
    useMatchStore.setState({
      segments: [
        {
          id: 'seg-1',
          matchId: 'match-1',
          label: 'Tramo 1',
          startMs: 0,
          endMs: 500_000,
          assigneeUserId: 'user-1',
          status: 'in_progress',
          position: 0,
        },
      ],
    })

    useMatchStore.getState().count('p1', 'goles', 1, 743_000)

    expect(useMatchStore.getState().toast).toBe('Estás cargando fuera de tu tramo asignado')
  })

  it('no avisa si el timecode cae dentro del tramo asignado', () => {
    matchesApi.addEvent.mockReturnValue(new Promise(() => {}))
    useMatchStore.setState({
      segments: [
        {
          id: 'seg-1',
          matchId: 'match-1',
          label: 'Tramo 1',
          startMs: 0,
          endMs: 500_000,
          assigneeUserId: 'user-1',
          status: 'in_progress',
          position: 0,
        },
      ],
    })

    useMatchStore.getState().count('p1', 'goles', 1, 100_000)

    expect(useMatchStore.getState().toast).toBeNull()
  })

  it('no avisa si no tenés ningún tramo asignado', () => {
    matchesApi.addEvent.mockReturnValue(new Promise(() => {}))
    useMatchStore.setState({
      segments: [
        {
          id: 'seg-1',
          matchId: 'match-1',
          label: 'Tramo 1',
          startMs: 0,
          endMs: 500_000,
          assigneeUserId: 'other-user',
          status: 'in_progress',
          position: 0,
        },
      ],
    })

    useMatchStore.getState().count('p1', 'goles', 1, 743_000)

    expect(useMatchStore.getState().toast).toBeNull()
  })
})

describe('undo', () => {
  it('deshace solo la última acción del usuario actual', () => {
    matchesApi.removeEvent.mockReturnValue(new Promise(() => {}))
    const match = baseMatch()
    match.events = [
      {
        id: 'e1',
        playerId: 'p1',
        teamId: 'team-a',
        statId: 'goles',
        delta: 1,
        videoMs: 0,
        createdBy: 'user-2',
        createdAt: 1,
        deletedAt: null,
        deletedBy: null,
      },
      {
        id: 'e2',
        playerId: 'p1',
        teamId: 'team-a',
        statId: 'asistencias',
        delta: 1,
        videoMs: 0,
        createdBy: 'user-1',
        createdAt: 2,
        deletedAt: null,
        deletedBy: null,
      },
    ]
    useMatchStore.setState({ match, currentUserId: 'user-1' })

    useMatchStore.getState().undo()

    const events = useMatchStore.getState().match?.events ?? []
    expect(events.find((e) => e.id === 'e2')?.deletedAt).not.toBeNull()
    expect(events.find((e) => e.id === 'e1')?.deletedAt).toBeNull()
  })
})

describe('addPlayerToTeam', () => {
  it('agrega al jugador devuelto por el servidor y refresca el registro', async () => {
    useMatchStore.setState({ match: baseMatch(), currentUserId: 'user-1' })
    matchesApi.addPlayer.mockResolvedValue({ id: 'p2', personId: 'person-2', name: 'Profe' })
    peopleApi.search.mockResolvedValue([{ id: 'person-2', name: 'Profe', createdAt: 1 }])

    const ok = await useMatchStore.getState().addPlayerToTeam('team-b', 'Profe')

    expect(ok).toBe(true)
    expect(useMatchStore.getState().match?.teams[1]?.players).toHaveLength(1)
    expect(useMatchStore.getState().people).toHaveLength(1)
  })
})

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
