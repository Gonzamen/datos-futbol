import { describe, expect, it } from 'vitest'
import { findPossibleDuplicate } from '../src/dedupe.js'
import type { MatchEvent } from '../src/types.js'

function event(overrides: Partial<MatchEvent> = {}): MatchEvent {
  return {
    id: 'e1',
    playerId: 'a1',
    teamId: 'team-a',
    statId: 'goles',
    delta: 1,
    videoMs: 100_000,
    createdBy: 'user-1',
    createdAt: 1,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  }
}

describe('findPossibleDuplicate', () => {
  it('marca un gol cargado a los pocos segundos del mismo jugador', () => {
    const existing = [event({ id: 'e1', videoMs: 100_000 })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: 105_000,
    })

    expect(match?.id).toBe('e1')
  })

  it('no marca si el gol está fuera de la ventana', () => {
    const existing = [event({ id: 'e1', videoMs: 100_000 })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: 120_000,
    })

    expect(match).toBeNull()
  })

  it('no marca goles de otro jugador', () => {
    const existing = [event({ id: 'e1', playerId: 'a2', videoMs: 100_000 })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: 101_000,
    })

    expect(match).toBeNull()
  })

  it('usa una ventana más chica para los disparos', () => {
    const existing = [event({ id: 'e1', statId: 'disparosAlArco', videoMs: 100_000 })]

    expect(
      findPossibleDuplicate(existing, {
        playerId: 'a1',
        statId: 'disparosAlArco',
        videoMs: 104_000,
      })?.id,
    ).toBe('e1')

    expect(
      findPossibleDuplicate(existing, {
        playerId: 'a1',
        statId: 'disparosAlArco',
        videoMs: 106_000,
      }),
    ).toBeNull()
  })

  it('no chequea estadísticas frecuentes como los pases', () => {
    const existing = [event({ id: 'e1', statId: 'pasesCompletados', videoMs: 100_000 })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'pasesCompletados',
      videoMs: 100_100,
    })

    expect(match).toBeNull()
  })

  it('no marca nada sin posición de video', () => {
    const existing = [event({ id: 'e1', videoMs: 100_000 })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: null,
    })

    expect(match).toBeNull()
  })

  it('ignora eventos sin timecode al buscar coincidencias', () => {
    const existing = [event({ id: 'e1', videoMs: null })]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: 100_000,
    })

    expect(match).toBeNull()
  })

  it('devuelve el más cercano cuando hay más de uno en la ventana', () => {
    const existing = [
      event({ id: 'lejano', videoMs: 90_000 }),
      event({ id: 'cercano', videoMs: 99_000 }),
    ]

    const match = findPossibleDuplicate(existing, {
      playerId: 'a1',
      statId: 'goles',
      videoMs: 100_000,
    })

    expect(match?.id).toBe('cercano')
  })
})
