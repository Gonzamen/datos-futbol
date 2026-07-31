import type { IdFactory } from '@datos-futbol/domain'
import type { Dependencies } from '../src/application/dependencies.js'
import { InMemoryMatchRepository } from '../src/infrastructure/persistence/memory/InMemoryMatchRepository.js'
import { InMemoryMembershipRepository } from '../src/infrastructure/persistence/memory/InMemoryMembershipRepository.js'
import { InMemoryPersonRepository } from '../src/infrastructure/persistence/memory/InMemoryPersonRepository.js'
import { InMemorySegmentRepository } from '../src/infrastructure/persistence/memory/InMemorySegmentRepository.js'
import { InMemoryUserRepository } from '../src/infrastructure/persistence/memory/InMemoryUserRepository.js'

export function sequentialIdFactory(startAt = 1_700_000_000_000): IdFactory {
  let sequence = 0
  return {
    nextId: () => `id-${(sequence += 1)}`,
    now: () => startAt + sequence,
  }
}

export function testDeps(ids: IdFactory = sequentialIdFactory()): Dependencies {
  return {
    users: new InMemoryUserRepository(),
    memberships: new InMemoryMembershipRepository(),
    people: new InMemoryPersonRepository(),
    matches: new InMemoryMatchRepository(),
    segments: new InMemorySegmentRepository(),
    ids,
  }
}
