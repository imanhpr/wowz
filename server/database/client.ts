import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { readDatabaseConfig, type DatabaseConfig } from './config'
import * as schema from './schema'

function resolveMigrationsFolder(): string {
  const projectMigrationsFolder = resolve('drizzle')
  const candidates = [projectMigrationsFolder]
  const entrypoint = process.argv[1]

  if (entrypoint) {
    candidates.push(resolve(dirname(entrypoint), 'drizzle'))
  }

  return candidates.find(candidate =>
    existsSync(resolve(candidate, 'meta/_journal.json')),
  ) ?? projectMigrationsFolder
}

export async function createWowTokenDatabase(
  config: DatabaseConfig = readDatabaseConfig(),
  migrationsFolder = resolveMigrationsFolder(),
) {
  const client = config.url
    ? postgres(config.url)
    : postgres({
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port,
        user: config.user,
      })
  const db = drizzle(client, { schema })

  try {
    await migrate(db, { migrationsFolder })
    console.info('[database] Connected to PostgreSQL successfully')
  }
  catch (error) {
    await client.end()
    throw error
  }

  return {
    db,
    close: () => client.end(),
  }
}

export type WowTokenDatabase = Awaited<ReturnType<typeof createWowTokenDatabase>>['db']
