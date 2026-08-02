import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const wowTokenPrices = pgTable('wow_token_prices', {
  id: serial('id').primaryKey(),
  region: text('region', { enum: ['eu', 'us'] }).notNull(),
  priceGold: integer('price_gold').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date', withTimezone: true }).notNull(),
}, table => [
  uniqueIndex('wow_token_prices_region_timestamp_unique')
    .on(table.region, table.timestamp),
  index('wow_token_prices_region_timestamp_idx')
    .on(table.region, table.timestamp),
])
