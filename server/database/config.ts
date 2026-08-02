export type DatabaseConfig = {
  url: string
  host?: never
  database?: never
  password?: never
  port?: never
  user?: never
} | {
  url?: undefined
  host: string
  database: string
  password: string
  port: number
  user: string
}

function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: keyof NodeJS.ProcessEnv,
  trim = true,
): string {
  const rawValue = environment[name]
  const value = trim ? rawValue?.trim() : rawValue

  if (!value) {
    throw new Error(`${name} is required when DATABASE_URL is not set`)
  }

  return value
}

export function readDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const url = environment.DATABASE_URL?.trim()

  if (url) {
    return { url }
  }

  const rawPort = requiredEnvironmentValue(environment, 'DATABASE_PORT')
  const port = Number(rawPort)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DATABASE_PORT must be an integer between 1 and 65535')
  }

  return {
    host: requiredEnvironmentValue(environment, 'DATABASE_HOST'),
    database: requiredEnvironmentValue(environment, 'DATABASE_NAME'),
    password: requiredEnvironmentValue(environment, 'DATABASE_PASSWORD', false),
    port,
    user: requiredEnvironmentValue(environment, 'DATABASE_USER'),
  }
}
