import type { TokenPricePoint } from '../../shared/types/wow-token'

export interface BattleNetCredentials {
  clientId: string
  clientSecret: string
}

export interface HttpClient {
  <T>(request: string, options?: Record<string, unknown>): Promise<T>
}

interface OAuthResponse {
  access_token?: string
}

interface BattleNetTokenResponse {
  price?: number
  last_updated_timestamp?: number
}

const OAUTH_URL = 'https://eu.battle.net/oauth/token'
const TOKEN_URL = 'https://eu.api.blizzard.com/data/wow/token/index'

export async function fetchBattleNetQuote(
  credentials: BattleNetCredentials,
  httpClient: HttpClient,
): Promise<TokenPricePoint> {
  const authorization = Buffer
    .from(`${credentials.clientId}:${credentials.clientSecret}`)
    .toString('base64')

  const oauth = await httpClient<OAuthResponse>(OAUTH_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${authorization}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!oauth.access_token) {
    throw new Error('Battle.net OAuth response did not contain an access token')
  }

  const token = await httpClient<BattleNetTokenResponse>(TOKEN_URL, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${oauth.access_token}`,
    },
    query: {
      namespace: 'dynamic-eu',
      locale: 'en_GB',
    },
  })

  if (
    typeof token.price !== 'number'
    || !Number.isFinite(token.price)
    || typeof token.last_updated_timestamp !== 'number'
    || !Number.isFinite(token.last_updated_timestamp)
  ) {
    throw new Error('Battle.net token response was malformed')
  }

  const updatedAt = new Date(token.last_updated_timestamp)

  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error('Battle.net token timestamp was invalid')
  }

  return {
    priceGold: token.price / 10_000,
    timestamp: updatedAt.toISOString(),
  }
}

export const battleNetEndpoints = {
  oauth: OAUTH_URL,
  token: TOKEN_URL,
} as const
