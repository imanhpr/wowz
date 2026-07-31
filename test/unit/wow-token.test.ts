import { describe, expect, it, vi } from 'vitest'
import {
  battleNetEndpoints,
  fetchBattleNetQuote,
  type HttpClient,
} from '../../server/utils/battlenet'
import {
  createMockTokenResponse,
  getWowTokenData,
  TokenConfigurationError,
  TokenUpstreamError,
} from '../../server/utils/wow-token-service'

const credentials = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
}

describe('WoW Token service', () => {
  it('returns seven deterministic demo points when credentials are absent', async () => {
    const httpClient = vi.fn() as unknown as HttpClient
    const now = new Date('2026-08-01T20:00:00.000Z')

    const response = await getWowTokenData(
      { clientId: '', clientSecret: '' },
      httpClient,
      now,
    )

    expect(response).toEqual(createMockTokenResponse(now))
    expect(response.quote.source).toBe('mock')
    expect(response.trend.points).toHaveLength(7)
    expect(response.trend.points[0]?.timestamp).toBe('2026-07-26T12:00:00.000Z')
    expect(httpClient).not.toHaveBeenCalled()
  })

  it('rejects a partially configured credential pair', async () => {
    const httpClient = vi.fn() as unknown as HttpClient

    await expect(getWowTokenData(
      { clientId: 'configured', clientSecret: '' },
      httpClient,
    )).rejects.toBeInstanceOf(TokenConfigurationError)

    expect(httpClient).not.toHaveBeenCalled()
  })

  it('uses client credentials, the EU namespace, and converts the raw price to gold', async () => {
    const httpMock = vi.fn()
      .mockResolvedValueOnce({ access_token: 'access-token' })
      .mockResolvedValueOnce({
        price: 2_862_500_000,
        last_updated_timestamp: 1_775_251_200_000,
      })
    const httpClient = httpMock as unknown as HttpClient

    const quote = await fetchBattleNetQuote(credentials, httpClient)

    expect(quote).toEqual({
      priceGold: 286_250,
      timestamp: '2026-04-03T21:20:00.000Z',
    })
    expect(httpMock).toHaveBeenNthCalledWith(1, battleNetEndpoints.oauth, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    expect(httpMock).toHaveBeenNthCalledWith(2, battleNetEndpoints.token, {
      method: 'GET',
      headers: {
        authorization: 'Bearer access-token',
      },
      query: {
        namespace: 'dynamic-eu',
        locale: 'en_GB',
      },
    })
  })

  it('keeps the trend marked as demo when the headline quote is live', async () => {
    const httpClient = vi.fn()
      .mockResolvedValueOnce({ access_token: 'access-token' })
      .mockResolvedValueOnce({
        price: 2_900_000_000,
        last_updated_timestamp: Date.parse('2026-08-01T12:00:00.000Z'),
      }) as unknown as HttpClient

    const response = await getWowTokenData(credentials, httpClient)

    expect(response.quote).toMatchObject({
      priceGold: 290_000,
      source: 'battle-net',
    })
    expect(response.trend.source).toBe('mock')
    expect(response.trend.points).toHaveLength(7)
  })

  it('replaces upstream details with a sanitized service error', async () => {
    const httpClient = vi.fn()
      .mockRejectedValue(new Error('secret upstream response body')) as unknown as HttpClient

    const request = getWowTokenData(credentials, httpClient)

    await expect(request).rejects.toBeInstanceOf(TokenUpstreamError)
    await expect(request).rejects.not.toThrow('secret upstream response body')
  })
})
