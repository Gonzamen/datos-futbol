import { beforeEach, describe, expect, it } from 'vitest'
import {
  activeEvents,
  addPlayer,
  applyEvent,
  countStat,
  createEvent,
  findPlayer,
  lastEventBy,
  matchTitle,
  removeEvent,
  removePlayer,
} from '../src/match.js'
import type { EventFactory, StatChange } from '../src/match.js'
import type { StatId } from '../src/stats.js'
import type { Match, MatchEvent } from '../src/types.js'
import { emptyMatch } from './fixtures/matches.js'

function sequentialFactory(): EventFactory {
  let sequence = 0
  return {
    nextId: () => `event-${(sequence += 1)}`,
    now: () => 1_700_000_000_000 + sequence,
  }
}

function change(overrides: Partial<StatChange> = {}): StatChange {
  return {
    playerId: 'a1',
    statId: 'goles',
    delta: 1,
    videoMs: 743_000,
    createdBy: 'user-gonza',
    ...overrides,
  }
}

describe('createEvent', () => {
  let match: Match
  let factory: EventFactory

  beforeEach(() => {
    match = emptyMatch()
    factory = sequentialFactory()
  })

  it('registra el equipo del jugador sin que se lo pasen', () => {
    const event = createEvent(match, change({ playerId: 'b3' }), factory)

    expect(event?.teamId).toBe('team-b')
  })

  it('conserva el momento del video en el que ocurrió la acción', () => {
    const event = createEvent(match, change({ videoMs: 1_234_000 }), factory)

    expect(event?.videoMs).toBe(1_234_000)
  })

  it('rechaza un jugador que no está en el partido', () => {
    expect(createEvent(match, change({ playerId: 'fantasma' }), factory)).toBeNull()
  })

  it('rechaza una estadística inexistente', () => {
    expect(createEvent(match, change({ statId: 'corners' as StatId }), factory)).toBeNull()
  })

  it('rechaza un cambio que no suma ni resta nada', () => {
    expect(createEvent(match, change({ delta: 0 }), factory)).toBeNull()
  })

  it('rechaza una corrección que dejaría el total en negativo', () => {
    expect(createEvent(match, change({ delta: -1 }), factory)).toBeNull()
  })

  it('acepta una corrección mientras el total no baje de cero', () => {
    const counted = createEvent(match, change(), factory)
    const withGoal = applyEvent(match, counted as MatchEvent)

    expect(createEvent(withGoal, change({ delta: -1 }), factory)).not.toBeNull()
  })

  it('ignora los eventos ya borrados al validar una corrección', () => {
    const counted = createEvent(match, change(), factory) as MatchEvent
    const withGoal = applyEvent(match, counted)
    const undone = removeEvent(withGoal, counted.id, 'user-gonza', 1_700_000_100_000)

    expect(createEvent(undone, change({ delta: -1 }), factory)).toBeNull()
  })
})

describe('applyEvent', () => {
  it('es idempotente: reaplicar el mismo evento no lo duplica', () => {
    const match = emptyMatch()
    const factory = sequentialFactory()
    const event = createEvent(match, change(), factory) as MatchEvent

    const once = applyEvent(match, event)
    const twice = applyEvent(once, event)

    expect(twice.events).toHaveLength(1)
    expect(twice).toBe(once)
  })

  it('no muta el partido original', () => {
    const match = emptyMatch()
    const factory = sequentialFactory()
    const event = createEvent(match, change(), factory) as MatchEvent

    applyEvent(match, event)

    expect(match.events).toHaveLength(0)
  })
})

describe('removeEvent', () => {
  let match: Match
  let event: MatchEvent

  beforeEach(() => {
    const empty = emptyMatch()
    const factory = sequentialFactory()
    event = createEvent(empty, change(), factory) as MatchEvent
    match = applyEvent(empty, event)
  })

  it('marca el evento como borrado sin sacarlo del log', () => {
    const updated = removeEvent(match, event.id, 'user-profe', 1_700_000_100_000)

    expect(updated.events).toHaveLength(1)
    expect(updated.events[0]?.deletedAt).toBe(1_700_000_100_000)
    expect(updated.events[0]?.deletedBy).toBe('user-profe')
  })

  it('deja de contar el evento borrado', () => {
    const updated = removeEvent(match, event.id, 'user-profe', 1_700_000_100_000)

    expect(countStat(match, 'a1', 'goles')).toBe(1)
    expect(countStat(updated, 'a1', 'goles')).toBe(0)
    expect(activeEvents(updated)).toHaveLength(0)
  })

  it('borrar dos veces no cambia quién lo borró primero', () => {
    const once = removeEvent(match, event.id, 'user-profe', 1_700_000_100_000)
    const twice = removeEvent(once, event.id, 'user-gonza', 1_700_000_200_000)

    expect(twice).toBe(once)
  })

  it('ignora un id que no existe', () => {
    expect(removeEvent(match, 'no-existe', 'user-gonza', 1)).toBe(match)
  })
})

describe('lastEventBy', () => {
  it('devuelve el último evento propio, no el del otro que carga', () => {
    let match = emptyMatch()
    const factory = sequentialFactory()

    const mine = createEvent(match, change({ createdBy: 'user-gonza' }), factory) as MatchEvent
    match = applyEvent(match, mine)

    const theirs = createEvent(
      match,
      change({ playerId: 'b1', createdBy: 'user-profe' }),
      factory,
    ) as MatchEvent
    match = applyEvent(match, theirs)

    expect(lastEventBy(match, 'user-gonza')?.id).toBe(mine.id)
    expect(lastEventBy(match, 'user-profe')?.id).toBe(theirs.id)
  })

  it('saltea los eventos que ya deshice', () => {
    let match = emptyMatch()
    const factory = sequentialFactory()

    const first = createEvent(match, change(), factory) as MatchEvent
    match = applyEvent(match, first)
    const second = createEvent(match, change(), factory) as MatchEvent
    match = applyEvent(match, second)
    match = removeEvent(match, second.id, 'user-gonza', 1_700_000_100_000)

    expect(lastEventBy(match, 'user-gonza')?.id).toBe(first.id)
  })

  it('devuelve null cuando esa persona no cargó nada', () => {
    expect(lastEventBy(emptyMatch(), 'user-nuevo')).toBeNull()
  })
})

describe('plantel', () => {
  it('agrega un jugador al equipo indicado', () => {
    const updated = addPlayer(emptyMatch(), 'team-b', {
      id: 'b8',
      personId: 'person-tincho',
      name: 'Tincho',
    })

    expect(findPlayer(updated, 'b8')?.team.id).toBe('team-b')
  })

  it('borrar un jugador se lleva sus eventos', () => {
    const empty = emptyMatch()
    const factory = sequentialFactory()
    const event = createEvent(empty, change(), factory) as MatchEvent
    const match = applyEvent(empty, event)

    const updated = removePlayer(match, 'a1')

    expect(findPlayer(updated, 'a1')).toBeNull()
    expect(updated.events).toHaveLength(0)
  })

  it('no toca los eventos de los demás', () => {
    const empty = emptyMatch()
    const factory = sequentialFactory()
    const event = createEvent(empty, change({ playerId: 'b1' }), factory) as MatchEvent
    const match = applyEvent(empty, event)

    expect(removePlayer(match, 'a1').events).toHaveLength(1)
  })
})

describe('matchTitle', () => {
  it('usa el nombre cargado', () => {
    expect(matchTitle({ ...emptyMatch(), name: 'Final del torneo' })).toBe('Final del torneo')
  })

  it('cae en la fecha cuando el nombre está vacío o en blanco', () => {
    expect(matchTitle({ ...emptyMatch(), name: '   ' })).toBe('Partido del 2026-07-23')
  })
})
