import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { loadEnv } from '../../../config/env.js'
import { createDatabase } from './client.js'

/**
 * The .sql files are not compiled, so they are always read from `src/`.
 * Resolving them against this module instead of the working directory keeps
 * the script runnable from anywhere, and from `dist/` in production — both
 * layouts sit four levels below the package root.
 */
const migrationsFolder = fileURLToPath(
  new URL('../../../../src/infrastructure/persistence/drizzle/migrations', import.meta.url),
)

const env = loadEnv()
const db = createDatabase(env.databaseUrl)

await migrate(db, { migrationsFolder })

console.log('Migraciones aplicadas.')
process.exit(0)
