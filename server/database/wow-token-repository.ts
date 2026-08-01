import { and, asc, eq, gte } from 'drizzle-orm'
import type {
  RegionalTokenQuotes,
  TokenPricePoint,
  WowRegion,
} from '../../shared/types/wow-token'
import type { WowTokenDatabase } from './client'
import { wowTokenPrices } from './schema'

export interface TokenHistoryStore {
  saveQuotes(quotes: RegionalTokenQuotes): void
  getHistory(region: WowRegion, since: Date): TokenPricePoint[]
}

export class WowTokenRepository implements TokenHistoryStore {
  constructor(private readonly db: WowTokenDatabase) {}

  saveQuotes(quotes: RegionalTokenQuotes): void {
    this.db.transaction((transaction) => {
      for (const region of ['eu', 'us'] as const) {
        const quote = quotes[region]

        transaction
          .insert(wowTokenPrices)
          .values({
            region,
            priceGold: quote.priceGold,
            timestamp: new Date(quote.timestamp),
          })
          .onConflictDoNothing({
            target: [wowTokenPrices.region, wowTokenPrices.timestamp],
          })
          .run()
      }
    })
  }

  getHistory(region: WowRegion, since: Date): TokenPricePoint[] {
    return this.db
      .select({
        priceGold: wowTokenPrices.priceGold,
        timestamp: wowTokenPrices.timestamp,
      })
      .from(wowTokenPrices)
      .where(and(
        eq(wowTokenPrices.region, region),
        gte(wowTokenPrices.timestamp, since),
      ))
      .orderBy(asc(wowTokenPrices.timestamp))
      .all()
      .map(row => ({
        priceGold: row.priceGold,
        timestamp: row.timestamp.toISOString(),
      }))
  }
}
