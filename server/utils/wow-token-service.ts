import type {
  RegionalTokenQuotes,
  WowRegion,
  WowTokenResponse,
} from '../../shared/types/wow-token'
import type { TokenHistoryStore } from '../database/wow-token-repository'
import type { BattleNetCredentials, BattleNetQuoteClient } from './battlenet'

const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000

export class TokenConfigurationError extends Error {
  constructor() {
    super('Battle.net credentials are not fully configured')
    this.name = 'TokenConfigurationError'
  }
}

export class TokenUpstreamError extends Error {
  constructor(cause?: unknown) {
    super('Unable to retrieve the WoW Token prices', { cause })
    this.name = 'TokenUpstreamError'
  }
}

export class TokenStorageError extends Error {
  constructor() {
    super('Unable to store or read WoW Token prices')
    this.name = 'TokenStorageError'
  }
}

export interface WowTokenCollectionResult {
  quotes: RegionalTokenQuotes
  changedRegions: WowRegion[]
  dashboard: WowTokenResponse
}

export class WowTokenService {
  private activeCollection: Promise<WowTokenCollectionResult> | null = null

  constructor(
    private readonly credentials: BattleNetCredentials,
    private readonly battleNetClient: BattleNetQuoteClient,
    private readonly historyStore: TokenHistoryStore,
  ) {}

  collect(now = new Date()): Promise<WowTokenCollectionResult> {
    if (this.activeCollection) {
      return this.activeCollection
    }

    this.activeCollection = this.collectAllRegions(now)
      .finally(() => {
        this.activeCollection = null
      })

    return this.activeCollection
  }

  async getDashboardData(now = new Date()): Promise<WowTokenResponse> {
    return (await this.collect(now)).dashboard
  }

  private async buildDashboardData(
    quotes: RegionalTokenQuotes,
    now: Date,
  ): Promise<WowTokenResponse> {
    const since = new Date(now.getTime() - HISTORY_WINDOW_MS)

    try {
      const [euHistory, usHistory] = await Promise.all([
        this.historyStore.getHistory('eu', since),
        this.historyStore.getHistory('us', since),
      ])

      return {
        regions: {
          eu: {
            quote: quotes.eu,
            trend: {
              period: '7d',
              points: euHistory,
            },
          },
          us: {
            quote: quotes.us,
            trend: {
              period: '7d',
              points: usHistory,
            },
          },
        },
      }
    }
    catch {
      throw new TokenStorageError()
    }
  }

  private async collectAllRegions(now: Date): Promise<WowTokenCollectionResult> {
    this.validateCredentials()

    let quotes: RegionalTokenQuotes

    try {
      const [eu, us] = await Promise.all([
        this.fetchRegionalQuote('eu'),
        this.fetchRegionalQuote('us'),
      ])
      quotes = { eu, us }
    }
    catch (error) {
      throw new TokenUpstreamError(error)
    }

    let changedRegions: WowRegion[]

    try {
      changedRegions = await this.historyStore.saveQuotes(quotes)
    }
    catch {
      throw new TokenStorageError()
    }

    return {
      quotes,
      changedRegions,
      dashboard: await this.buildDashboardData(quotes, now),
    }
  }

  private validateCredentials(): void {
    if (
      this.credentials.clientId.trim().length === 0
      || this.credentials.clientSecret.trim().length === 0
    ) {
      throw new TokenConfigurationError()
    }
  }

  private async fetchRegionalQuote(region: WowRegion) {
    try {
      return await this.battleNetClient.fetchQuote(region)
    }
    catch (error) {
      throw new Error(
        `Battle.net ${region.toUpperCase()} quote request failed`,
        { cause: error },
      )
    }
  }
}
