import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export function createWowTokenDatabase(sqlitePath: string) {
  const resolvedPath = resolve(sqlitePath)
  mkdirSync(dirname(resolvedPath), { recursive: true })

  const sqlite = new Database(resolvedPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  return {
    db: drizzle(sqlite, { schema }),
    close: () => sqlite.close(),
  }
}

export type WowTokenDatabase = ReturnType<typeof createWowTokenDatabase>['db']
