import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
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

export function createWowTokenDatabase(
  sqlitePath: string,
  migrationsFolder = resolveMigrationsFolder(),
) {
  const resolvedPath = resolve(sqlitePath)
  mkdirSync(dirname(resolvedPath), { recursive: true })

  const sqlite = new Database(resolvedPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })

  try {
    migrate(db, { migrationsFolder })
  }
  catch (error) {
    sqlite.close()
    throw error
  }

  return {
    db,
    close: () => sqlite.close(),
  }
}

export type WowTokenDatabase = ReturnType<typeof createWowTokenDatabase>['db']
