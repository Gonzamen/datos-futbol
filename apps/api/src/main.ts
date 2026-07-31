import { defaultIdFactory } from '@datos-futbol/domain'
import { loadEnv } from './config/env.js'
import type { Dependencies } from './application/dependencies.js'
import { createDatabase } from './infrastructure/persistence/drizzle/client.js'
import { DrizzleMatchRepository } from './infrastructure/persistence/drizzle/DrizzleMatchRepository.js'
import { DrizzleMembershipRepository } from './infrastructure/persistence/drizzle/DrizzleMembershipRepository.js'
import { DrizzlePersonRepository } from './infrastructure/persistence/drizzle/DrizzlePersonRepository.js'
import { DrizzleSegmentRepository } from './infrastructure/persistence/drizzle/DrizzleSegmentRepository.js'
import { DrizzleUserRepository } from './infrastructure/persistence/drizzle/DrizzleUserRepository.js'
import { buildApp } from './infrastructure/http/app.js'

const env = loadEnv()
const db = createDatabase(env.databaseUrl)

const deps: Dependencies = {
  users: new DrizzleUserRepository(db),
  memberships: new DrizzleMembershipRepository(db),
  people: new DrizzlePersonRepository(db),
  matches: new DrizzleMatchRepository(db),
  segments: new DrizzleSegmentRepository(db),
  ids: defaultIdFactory,
}

const app = await buildApp({ env, deps })

try {
  await app.listen({ port: env.port, host: '0.0.0.0' })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
