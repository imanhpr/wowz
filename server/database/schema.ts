import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const wowTokenPrices = sqliteTable('wow_token_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  region: text('region', { enum: ['eu', 'us'] }).notNull(),
  priceGold: integer('price_gold').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
}, table => [
  uniqueIndex('wow_token_prices_region_timestamp_unique')
    .on(table.region, table.timestamp),
  index('wow_token_prices_region_timestamp_idx')
    .on(table.region, table.timestamp),
])
