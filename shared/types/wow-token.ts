export type WowRegion = 'eu' | 'us'

export interface TokenPricePoint {
  timestamp: string
  priceGold: number
}

export interface WowTokenResponse {
  regions: Record<WowRegion, {
    quote: TokenPricePoint
    trend: {
      period: '7d'
      points: TokenPricePoint[]
    }
  }>
}

export type RegionalTokenQuotes = Record<WowRegion, TokenPricePoint>
