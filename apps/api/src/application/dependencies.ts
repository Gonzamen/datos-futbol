import type { IdFactory } from '@datos-futbol/domain'
import type { MatchRepository } from '../domain/ports/MatchRepository.js'
import type { MembershipRepository } from '../domain/ports/MembershipRepository.js'
import type { PersonRepository } from '../domain/ports/PersonRepository.js'
import type { SegmentRepository } from '../domain/ports/SegmentRepository.js'
import type { UserRepository } from '../domain/ports/UserRepository.js'

/**
 * Everything a use case needs, bundled once. Passed as the first argument to
 * every use case function so tests can swap in in-memory repositories without
 * touching the use case itself — see test/application/*.test.ts.
 */
export interface Dependencies {
  users: UserRepository
  memberships: MembershipRepository
  people: PersonRepository
  matches: MatchRepository
  segments: SegmentRepository
  ids: IdFactory
}
