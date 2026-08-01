import type {
  RegionalTokenQuotes,
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
  constructor() {
    super('Unable to retrieve the WoW Token prices')
    this.name = 'TokenUpstreamError'
  }
}

export class TokenStorageError extends Error {
  constructor() {
    super('Unable to store or read WoW Token prices')
    this.name = 'TokenStorageError'
  }
}

export class WowTokenService {
  private activeCollection: Promise<RegionalTokenQuotes> | null = null

  constructor(
    private readonly credentials: BattleNetCredentials,
    private readonly battleNetClient: BattleNetQuoteClient,
    private readonly historyStore: TokenHistoryStore,
  ) {}

  collect(): Promise<RegionalTokenQuotes> {
    if (this.activeCollection) {
      return this.activeCollection
    }

    this.activeCollection = this.collectAllRegions()
      .finally(() => {
        this.activeCollection = null
      })

    return this.activeCollection
  }

  async getDashboardData(now = new Date()): Promise<WowTokenResponse> {
    const quotes = await this.collect()
    const since = new Date(now.getTime() - HISTORY_WINDOW_MS)

    try {
      return {
        regions: {
          eu: {
            quote: quotes.eu,
            trend: {
              period: '7d',
              points: this.historyStore.getHistory('eu', since),
            },
          },
          us: {
            quote: quotes.us,
            trend: {
              period: '7d',
              points: this.historyStore.getHistory('us', since),
            },
          },
        },
      }
    }
    catch {
      throw new TokenStorageError()
    }
  }

  private async collectAllRegions(): Promise<RegionalTokenQuotes> {
    this.validateCredentials()

    let quotes: RegionalTokenQuotes

    try {
      const [eu, us] = await Promise.all([
        this.battleNetClient.fetchQuote('eu'),
        this.battleNetClient.fetchQuote('us'),
      ])
      quotes = { eu, us }
    }
    catch {
      throw new TokenUpstreamError()
    }

    try {
      this.historyStore.saveQuotes(quotes)
    }
    catch {
      throw new TokenStorageError()
    }

    return quotes
  }

  private validateCredentials(): void {
    if (
      this.credentials.clientId.trim().length === 0
      || this.credentials.clientSecret.trim().length === 0
    ) {
      throw new TokenConfigurationError()
    }
  }
}
