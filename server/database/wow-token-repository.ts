import { and, asc, eq, gte, sql } from 'drizzle-orm'
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

interface RepositoryLogger {
  info(message: string): void
}

export class WowTokenRepository implements TokenHistoryStore {
  constructor(
    private readonly db: WowTokenDatabase,
    private readonly logger: RepositoryLogger = console,
  ) {}

  saveQuotes(quotes: RegionalTokenQuotes): void {
    const insertedQuotes: Array<{
      region: WowRegion
      quote: TokenPricePoint
    }> = []

    this.db.transaction((transaction) => {
      for (const region of ['eu', 'us'] as const) {
        const quote = quotes[region]
        const regionValue = sql.param(region, wowTokenPrices.region)
        const priceValue = sql.param(quote.priceGold, wowTokenPrices.priceGold)
        const timestampValue = sql.param(new Date(quote.timestamp), wowTokenPrices.timestamp)

        const result = transaction
          .insert(wowTokenPrices)
          .select(sql`
            select null, ${regionValue}, ${priceValue}, ${timestampValue}
            where (
              select ${wowTokenPrices.priceGold}
              from ${wowTokenPrices}
              where ${wowTokenPrices.region} = ${regionValue}
              order by ${wowTokenPrices.timestamp} desc
              limit 1
            ) is not ${priceValue}
          `)
          .onConflictDoNothing({
            target: [wowTokenPrices.region, wowTokenPrices.timestamp],
          })
          .run()

        if (result.changes > 0) {
          insertedQuotes.push({ region, quote })
        }
      }
    })

    for (const { region, quote } of insertedQuotes) {
      this.logger.info(
        `[wow-token] Inserted ${region.toUpperCase()} price into database: priceGold=${quote.priceGold}, timestamp=${quote.timestamp}`,
      )
    }
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
