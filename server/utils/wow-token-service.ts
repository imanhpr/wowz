import type { WowTokenResponse } from '../../shared/types/wow-token'
import {
  fetchBattleNetQuote,
  type BattleNetCredentials,
  type HttpClient,
} from './battlenet'

const DEMO_PRICES = [274_300, 276_850, 275_100, 279_650, 281_200, 284_900, 286_250]

export class TokenConfigurationError extends Error {
  constructor() {
    super('Both Battle.net credentials must be configured together')
    this.name = 'TokenConfigurationError'
  }
}

export class TokenUpstreamError extends Error {
  constructor() {
    super('Unable to retrieve the WoW Token price')
    this.name = 'TokenUpstreamError'
  }
}

export function createMockTokenResponse(now = new Date()): WowTokenResponse {
  const endDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
  ))

  const points = DEMO_PRICES.map((priceGold, index) => {
    const timestamp = new Date(endDate)
    timestamp.setUTCDate(endDate.getUTCDate() - (DEMO_PRICES.length - index - 1))

    return {
      timestamp: timestamp.toISOString(),
      priceGold,
    }
  })

  return {
    region: 'eu',
    quote: {
      ...points.at(-1)!,
      source: 'mock',
    },
    trend: {
      period: '7d',
      source: 'mock',
      points,
    },
  }
}

export async function getWowTokenData(
  credentials: BattleNetCredentials,
  httpClient: HttpClient,
  now = new Date(),
): Promise<WowTokenResponse> {
  const hasClientId = credentials.clientId.trim().length > 0
  const hasClientSecret = credentials.clientSecret.trim().length > 0

  if (!hasClientId && !hasClientSecret) {
    return createMockTokenResponse(now)
  }

  if (hasClientId !== hasClientSecret) {
    throw new TokenConfigurationError()
  }

  try {
    const quote = await fetchBattleNetQuote(credentials, httpClient)
    const mock = createMockTokenResponse(new Date(quote.timestamp))

    return {
      ...mock,
      quote: {
        ...quote,
        source: 'battle-net',
      },
    }
  }
  catch {
    throw new TokenUpstreamError()
  }
}
