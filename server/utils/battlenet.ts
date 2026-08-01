import type { TokenPricePoint, WowRegion } from '../../shared/types/wow-token'

export interface BattleNetCredentials {
  clientId: string
  clientSecret: string
}

export interface HttpClient {
  <T>(request: string, options?: Record<string, unknown>): Promise<T>
}

export interface BattleNetQuoteClient {
  fetchQuote(region: WowRegion): Promise<TokenPricePoint>
}

interface OAuthResponse {
  access_token?: string
  expires_in?: number
}

interface BattleNetTokenResponse {
  price?: number
  last_updated_timestamp?: number
}

interface CachedAccessToken {
  value: string
  expiresAt: number
}

const REGION_CONFIG = {
  eu: {
    oauth: 'https://eu.battle.net/oauth/token',
    token: 'https://eu.api.blizzard.com/data/wow/token/index',
    namespace: 'dynamic-eu',
    locale: 'en_GB',
  },
  us: {
    oauth: 'https://us.battle.net/oauth/token',
    token: 'https://us.api.blizzard.com/data/wow/token/index',
    namespace: 'dynamic-us',
    locale: 'en_US',
  },
} as const satisfies Record<WowRegion, {
  oauth: string
  token: string
  namespace: string
  locale: string
}>

const DEFAULT_TOKEN_LIFETIME_SECONDS = 86_400
const TOKEN_EXPIRY_MARGIN_MS = 60_000

export class BattleNetClient implements BattleNetQuoteClient {
  private readonly tokenCache = new Map<WowRegion, CachedAccessToken>()

  constructor(
    private readonly credentials: BattleNetCredentials,
    private readonly httpClient: HttpClient,
    private readonly now: () => number = Date.now,
  ) {}

  async fetchQuote(region: WowRegion): Promise<TokenPricePoint> {
    const config = REGION_CONFIG[region]
    const accessToken = await this.getAccessToken(region)
    const token = await this.httpClient<BattleNetTokenResponse>(config.token, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      query: {
        namespace: config.namespace,
        locale: config.locale,
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

  private async getAccessToken(region: WowRegion): Promise<string> {
    const cached = this.tokenCache.get(region)

    if (cached && cached.expiresAt > this.now()) {
      return cached.value
    }

    const config = REGION_CONFIG[region]
    const authorization = Buffer
      .from(`${this.credentials.clientId}:${this.credentials.clientSecret}`)
      .toString('base64')

    const oauth = await this.httpClient<OAuthResponse>(config.oauth, {
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

    const lifetimeSeconds = typeof oauth.expires_in === 'number'
      && Number.isFinite(oauth.expires_in)
      && oauth.expires_in > 0
      ? oauth.expires_in
      : DEFAULT_TOKEN_LIFETIME_SECONDS

    this.tokenCache.set(region, {
      value: oauth.access_token,
      expiresAt: this.now() + Math.max(0, lifetimeSeconds * 1_000 - TOKEN_EXPIRY_MARGIN_MS),
    })

    return oauth.access_token
  }
}

export const battleNetEndpoints = REGION_CONFIG
