import { and, asc, eq, gte, sql } from 'drizzle-orm'
import type {
  RegionalTokenQuotes,
  TokenPricePoint,
  WowRegion,
} from '../../shared/types/wow-token'
import type { WowTokenDatabase } from './client'
import { wowTokenPrices } from './schema'

export interface TokenHistoryStore {
  saveQuotes(quotes: RegionalTokenQuotes): Promise<WowRegion[]>
  getHistory(region: WowRegion, since: Date): Promise<TokenPricePoint[]>
}

interface RepositoryLogger {
  info(message: string): void
}

export class WowTokenRepository implements TokenHistoryStore {
  constructor(
    private readonly db: WowTokenDatabase,
    private readonly logger: RepositoryLogger = console,
  ) {}

  async saveQuotes(quotes: RegionalTokenQuotes): Promise<WowRegion[]> {
    const insertedQuotes: Array<{
      region: WowRegion
      quote: TokenPricePoint
    }> = []

    await this.db.transaction(async (transaction) => {
      for (const region of ['eu', 'us'] as const) {
        const quote = quotes[region]
        const result = await transaction.execute<{ region: WowRegion }>(sql`
          insert into ${wowTokenPrices} (
            ${wowTokenPrices.region},
            ${wowTokenPrices.priceGold},
            ${wowTokenPrices.timestamp}
          )
          select ${region}, ${quote.priceGold}, ${new Date(quote.timestamp)}
          where (
            select ${wowTokenPrices.priceGold}
            from ${wowTokenPrices}
            where ${wowTokenPrices.region} = ${region}
            order by ${wowTokenPrices.timestamp} desc
            limit 1
          ) is distinct from ${quote.priceGold}
          on conflict (
            ${wowTokenPrices.region},
            ${wowTokenPrices.timestamp}
          ) do nothing
          returning ${wowTokenPrices.region}
        `)

        if (result.length > 0) {
          insertedQuotes.push({ region, quote })
        }
      }
    })

    for (const { region, quote } of insertedQuotes) {
      this.logger.info(
        `[wow-token] Inserted ${region.toUpperCase()} price into database: priceGold=${quote.priceGold}, timestamp=${quote.timestamp}`,
      )
    }

    return insertedQuotes.map(({ region }) => region)
  }

  async getHistory(region: WowRegion, since: Date): Promise<TokenPricePoint[]> {
    const rows = await this.db
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

    return rows.map(row => ({
      priceGold: row.priceGold,
      timestamp: row.timestamp.toISOString(),
    }))
  }
}
