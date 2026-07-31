export type TokenDataSource = 'mock' | 'battle-net'

export interface TokenPricePoint {
  timestamp: string
  priceGold: number
}

export interface WowTokenResponse {
  region: 'eu'
  quote: TokenPricePoint & {
    source: TokenDataSource
  }
  trend: {
    period: '7d'
    source: 'mock'
    points: TokenPricePoint[]
  }
}
