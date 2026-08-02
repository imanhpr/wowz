import { defineConfig } from 'drizzle-kit'
import { readDatabaseConfig } from './server/database/config'

const database = readDatabaseConfig()

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './drizzle',
  dbCredentials: database.url
    ? { url: database.url }
    : {
        host: database.host,
        database: database.database,
        password: database.password,
        port: database.port,
        user: database.user,
      },
})
