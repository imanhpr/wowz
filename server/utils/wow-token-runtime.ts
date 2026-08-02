import { createWowTokenDatabase } from '../database/client'
import { WowTokenRepository } from '../database/wow-token-repository'
import { BattleNetClient, type HttpClient } from './battlenet'
import { WowTokenService } from './wow-token-service'
import { WowTokenStreamHub } from './wow-token-stream-hub'
import type { WowTokenResponse } from '../../shared/types/wow-token'

interface WowTokenRuntimeConfig {
  battlenetClientId: string
  battlenetClientSecret: string
}

interface WowTokenRuntime {
  key: string
  service: WowTokenService
  stream: WowTokenStreamHub
  refresh: () => Promise<WowTokenResponse>
  close: () => Promise<void>
}

let runtime: WowTokenRuntime | null = null
let runtimePromise: Promise<WowTokenRuntime> | null = null

export async function getWowTokenRuntime(
  config: WowTokenRuntimeConfig,
  httpClient: HttpClient,
): Promise<WowTokenRuntime> {
  const key = JSON.stringify([
    config.battlenetClientId,
    config.battlenetClientSecret,
  ])

  if (runtime?.key === key) {
    return runtime
  }

  if (runtimePromise) {
    return runtimePromise
  }

  runtimePromise = (async () => {
    await runtime?.close()

    const database = await createWowTokenDatabase()
    const credentials = {
      clientId: config.battlenetClientId.trim(),
      clientSecret: config.battlenetClientSecret.trim(),
    }
    const repository = new WowTokenRepository(database.db)
    const battleNetClient = new BattleNetClient(credentials, httpClient)
    const service = new WowTokenService(credentials, battleNetClient, repository)
    const stream = new WowTokenStreamHub()

    const refresh = async () => {
      const result = await service.collect()
      stream.update(result.dashboard, result.changedRegions.length > 0)
      return result.dashboard
    }

    runtime = {
      key,
      service,
      stream,
      refresh,
      close: async () => {
        stream.clear()
        await database.close()
      },
    }

    return runtime
  })()

  try {
    return await runtimePromise
  }
  finally {
    runtimePromise = null
  }
}

export async function closeWowTokenRuntime(): Promise<void> {
  await runtimePromise
  await runtime?.close()
  runtime = null
}
