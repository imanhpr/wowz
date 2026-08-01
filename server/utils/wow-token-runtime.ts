import { createWowTokenDatabase } from '../database/client'
import { WowTokenRepository } from '../database/wow-token-repository'
import { BattleNetClient, type HttpClient } from './battlenet'
import { WowTokenService } from './wow-token-service'

interface WowTokenRuntimeConfig {
  battlenetClientId: string
  battlenetClientSecret: string
  sqlitePath: string
}

interface WowTokenRuntime {
  key: string
  service: WowTokenService
  close: () => void
}

let runtime: WowTokenRuntime | null = null

export function getWowTokenRuntime(
  config: WowTokenRuntimeConfig,
  httpClient: HttpClient,
): WowTokenRuntime {
  const key = JSON.stringify([
    config.battlenetClientId,
    config.battlenetClientSecret,
    config.sqlitePath,
  ])

  if (runtime?.key === key) {
    return runtime
  }

  runtime?.close()

  const database = createWowTokenDatabase(config.sqlitePath)
  const credentials = {
    clientId: config.battlenetClientId.trim(),
    clientSecret: config.battlenetClientSecret.trim(),
  }
  const repository = new WowTokenRepository(database.db)
  const battleNetClient = new BattleNetClient(credentials, httpClient)

  runtime = {
    key,
    service: new WowTokenService(credentials, battleNetClient, repository),
    close: database.close,
  }

  return runtime
}

export function closeWowTokenRuntime(): void {
  runtime?.close()
  runtime = null
}
