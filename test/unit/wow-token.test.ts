import { describe, expect, it, vi } from 'vitest'
import type { WowTokenDatabase } from '../../server/database/client'
import { readDatabaseConfig } from '../../server/database/config'
import { WowTokenRepository, type TokenHistoryStore } from '../../server/database/wow-token-repository'
import {
  BattleNetClient,
  BattleNetRequestError,
  battleNetEndpoints,
  type BattleNetQuoteClient,
  type HttpClient,
} from '../../server/utils/battlenet'
import {
  TokenConfigurationError,
  TokenStorageError,
  TokenUpstreamError,
  WowTokenService,
} from '../../server/utils/wow-token-service'
import { createWowTokenHttpError } from '../../server/utils/wow-token-http-error'
import {
  COLLECTION_INTERVAL_MS,
  startWowTokenScheduler,
} from '../../server/utils/wow-token-scheduler'
import {
  createWowTokenSnapshotId,
  WowTokenStreamHub,
} from '../../server/utils/wow-token-stream-hub'
import {
  attachWowTokenEventStream,
  WOW_TOKEN_HEARTBEAT_INTERVAL_MS,
  WOW_TOKEN_RETRY_MS,
} from '../../server/utils/wow-token-sse'
import type { RegionalTokenQuotes, WowRegion } from '../../shared/types/wow-token'

const credentials = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
}

const quotes: RegionalTokenQuotes = {
  eu: {
    priceGold: 286_250,
    timestamp: '2026-08-01T12:00:00.000Z',
  },
  us: {
    priceGold: 331_400,
    timestamp: '2026-08-01T12:05:00.000Z',
  },
}

function createClientMock(overrides: Partial<Record<WowRegion, Error>> = {}) {
  return {
    fetchQuote: vi.fn(async (region: WowRegion) => {
      const error = overrides[region]
      if (error) {
        throw error
      }
      return quotes[region]
    }),
  } satisfies BattleNetQuoteClient
}

function createStoreMock(): TokenHistoryStore {
  return {
    saveQuotes: vi.fn(async () => ['eu', 'us']),
    getHistory: vi.fn(async (region: WowRegion) => [quotes[region]]),
  }
}

describe('Battle.net client', () => {
  it('selects the regional endpoints, namespaces, locales, and converts both prices', async () => {
    const httpMock = vi.fn()
      .mockResolvedValueOnce({ access_token: 'eu-access', expires_in: 3_600 })
      .mockResolvedValueOnce({
        price: 2_862_500_000,
        last_updated_timestamp: Date.parse(quotes.eu.timestamp),
      })
      .mockResolvedValueOnce({ access_token: 'us-access', expires_in: 3_600 })
      .mockResolvedValueOnce({
        price: 3_314_000_000,
        last_updated_timestamp: Date.parse(quotes.us.timestamp),
      })
    const client = new BattleNetClient(credentials, httpMock as unknown as HttpClient)

    await expect(client.fetchQuote('eu')).resolves.toEqual(quotes.eu)
    await expect(client.fetchQuote('us')).resolves.toEqual(quotes.us)

    expect(httpMock).toHaveBeenNthCalledWith(1, battleNetEndpoints.eu.oauth, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      }),
    }))
    expect(httpMock).toHaveBeenNthCalledWith(2, battleNetEndpoints.eu.token, expect.objectContaining({
      query: { namespace: 'dynamic-eu', locale: 'en_GB' },
    }))
    expect(httpMock).toHaveBeenNthCalledWith(3, battleNetEndpoints.us.oauth, expect.any(Object))
    expect(httpMock).toHaveBeenNthCalledWith(4, battleNetEndpoints.us.token, expect.objectContaining({
      query: { namespace: 'dynamic-us', locale: 'en_US' },
    }))
  })

  it('reuses a regional OAuth token until shortly before expiry', async () => {
    let now = 1_000
    const httpMock = vi.fn()
      .mockResolvedValueOnce({ access_token: 'first-token', expires_in: 120 })
      .mockResolvedValueOnce({
        price: 2_862_500_000,
        last_updated_timestamp: Date.parse(quotes.eu.timestamp),
      })
      .mockResolvedValueOnce({
        price: 2_900_000_000,
        last_updated_timestamp: Date.parse('2026-08-01T13:00:00.000Z'),
      })
      .mockResolvedValueOnce({ access_token: 'second-token', expires_in: 120 })
      .mockResolvedValueOnce({
        price: 2_910_000_000,
        last_updated_timestamp: Date.parse('2026-08-01T14:00:00.000Z'),
      })
    const client = new BattleNetClient(
      credentials,
      httpMock as unknown as HttpClient,
      () => now,
    )

    await client.fetchQuote('eu')
    now += 30_000
    await client.fetchQuote('eu')
    now += 31_000
    await client.fetchQuote('eu')

    expect(httpMock).toHaveBeenCalledTimes(5)
    expect(httpMock.mock.calls.filter(([url]) => url === battleNetEndpoints.eu.oauth)).toHaveLength(2)
  })

  it('rejects malformed token responses', async () => {
    const httpClient = vi.fn()
      .mockResolvedValueOnce({ access_token: 'access-token' })
      .mockResolvedValueOnce({ price: 'not-a-number' }) as unknown as HttpClient
    const client = new BattleNetClient(credentials, httpClient)

    await expect(client.fetchQuote('eu')).rejects.toThrow('malformed')
  })

  it('reports the status and response body when OAuth fails', async () => {
    const responseBody = { error: 'invalid_client', error_description: 'Bad credentials' }
    const httpError = Object.assign(new Error('401 Unauthorized'), {
      data: responseBody,
      response: { status: 401, _data: responseBody },
    })
    const httpClient = vi.fn().mockRejectedValue(httpError) as unknown as HttpClient
    const client = new BattleNetClient(credentials, httpClient)
    const request = client.fetchQuote('eu')

    await expect(request).rejects.toBeInstanceOf(BattleNetRequestError)
    await expect(request).rejects.toMatchObject({
      statusCode: 401,
      responseBody,
    })
    await expect(request).rejects.toThrow(
      'status=401; response={"error":"invalid_client","error_description":"Bad credentials"}',
    )
  })

  it('reports the status and response body when a quote request fails', async () => {
    const httpError = Object.assign(new Error('503 Service Unavailable'), {
      data: 'maintenance',
      response: { status: 503, _data: 'maintenance' },
    })
    const httpClient = vi.fn()
      .mockResolvedValueOnce({ access_token: 'access-token' })
      .mockRejectedValueOnce(httpError) as unknown as HttpClient
    const client = new BattleNetClient(credentials, httpClient)
    const request = client.fetchQuote('us')

    await expect(request).rejects.toMatchObject({
      statusCode: 503,
      responseBody: 'maintenance',
    })
    await expect(request).rejects.toThrow('status=503; response=maintenance')
  })
})

describe('WoW Token service', () => {
  it('requires both credentials and never calls Battle.net when configuration is missing', async () => {
    const client = createClientMock()
    const service = new WowTokenService(
      { clientId: 'configured', clientSecret: '' },
      client,
      createStoreMock(),
    )

    await expect(service.collect()).rejects.toBeInstanceOf(TokenConfigurationError)
    expect(client.fetchQuote).not.toHaveBeenCalled()
  })

  it('collects both regions and persists them in one store call', async () => {
    const client = createClientMock()
    const store = createStoreMock()
    const service = new WowTokenService(credentials, client, store)

    await expect(service.collect()).resolves.toMatchObject({
      quotes,
      changedRegions: ['eu', 'us'],
      dashboard: {
        regions: {
          eu: { quote: quotes.eu },
          us: { quote: quotes.us },
        },
      },
    })
    expect(client.fetchQuote).toHaveBeenCalledTimes(2)
    expect(store.saveQuotes).toHaveBeenCalledOnce()
    expect(store.saveQuotes).toHaveBeenCalledWith(quotes)
  })

  it('coalesces overlapping dashboard collections', async () => {
    const client = createClientMock()
    const service = new WowTokenService(credentials, client, createStoreMock())

    const firstCollection = service.collect()
    const secondCollection = service.collect()

    expect(secondCollection).toBe(firstCollection)
    await Promise.all([firstCollection, secondCollection])
    expect(client.fetchQuote).toHaveBeenCalledTimes(2)
  })

  it('persists nothing and sanitizes details when either regional request fails', async () => {
    const upstreamError = new Error('secret upstream response')
    const client = createClientMock({ us: upstreamError })
    const store = createStoreMock()
    const service = new WowTokenService(credentials, client, store)
    const request = service.collect()

    await expect(request).rejects.toBeInstanceOf(TokenUpstreamError)
    await expect(request).rejects.not.toThrow('secret upstream response')
    await expect(request).rejects.toMatchObject({
      cause: {
        message: 'Battle.net US quote request failed',
        cause: upstreamError,
      },
    })
    expect(store.saveQuotes).not.toHaveBeenCalled()
  })

  it('returns both quotes and seven-day histories', async () => {
    const store = createStoreMock()
    const service = new WowTokenService(credentials, createClientMock(), store)
    const now = new Date('2026-08-02T12:00:00.000Z')

    const response = await service.getDashboardData(now)

    expect(response.regions.eu.quote).toEqual(quotes.eu)
    expect(response.regions.us.quote).toEqual(quotes.us)
    expect(response.regions.eu.trend).toEqual({ period: '7d', points: [quotes.eu] })
    expect(store.getHistory).toHaveBeenCalledWith('eu', new Date('2026-07-26T12:00:00.000Z'))
    expect(store.getHistory).toHaveBeenCalledWith('us', new Date('2026-07-26T12:00:00.000Z'))
  })

  it('sanitizes database failures', async () => {
    const store = createStoreMock()
    vi.mocked(store.saveQuotes).mockRejectedValue(new Error('private postgres details'))
    const service = new WowTokenService(credentials, createClientMock(), store)
    const request = service.collect()

    await expect(request).rejects.toBeInstanceOf(TokenStorageError)
    await expect(request).rejects.not.toThrow('private postgres details')
  })
})

describe('WoW Token API errors', () => {
  it('maps configuration, storage, and upstream failures to sanitized HTTP errors', () => {
    const configuration = createWowTokenHttpError(new TokenConfigurationError())
    const storage = createWowTokenHttpError(new TokenStorageError())
    const upstream = createWowTokenHttpError(new Error('private upstream body'))

    expect(configuration).toMatchObject({
      statusCode: 500,
      statusMessage: 'Battle.net credentials are not configured',
    })
    expect(storage).toMatchObject({
      statusCode: 500,
      statusMessage: 'Unable to access the WoW Token price history',
    })
    expect(upstream).toMatchObject({
      statusCode: 502,
      statusMessage: 'Unable to retrieve the WoW Token prices',
    })
    expect(upstream.statusMessage).not.toContain('private upstream body')
  })
})

describe('PostgreSQL history repository', () => {
  it('returns inserted regions and maps timestamp values to API strings', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ region: 'eu' }])
      .mockResolvedValueOnce([{ region: 'us' }])
    const orderBy = vi.fn()
      .mockResolvedValueOnce([{
        priceGold: quotes.eu.priceGold,
        timestamp: new Date(quotes.eu.timestamp),
      }])
      .mockResolvedValueOnce([{
        priceGold: quotes.us.priceGold,
        timestamp: new Date(quotes.us.timestamp),
      }])
    const where = vi.fn(() => ({ orderBy }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const transaction = vi.fn(async (
      callback: (value: { execute: typeof execute }) => Promise<void>,
    ) => callback({ execute }))
    const database = { select, transaction } as unknown as WowTokenDatabase
    const logger = { info: vi.fn() }
    const repository = new WowTokenRepository(database, logger)

    await expect(repository.saveQuotes(quotes)).resolves.toEqual(['eu', 'us'])
    await expect(repository.getHistory(
      'eu',
      new Date('2026-07-26T00:00:00.000Z'),
    )).resolves.toEqual([quotes.eu])
    await expect(repository.getHistory(
      'us',
      new Date('2026-07-26T00:00:00.000Z'),
    )).resolves.toEqual([quotes.us])
    expect(transaction).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledTimes(2)
    expect(logger.info).toHaveBeenCalledTimes(2)
    expect(logger.info).toHaveBeenCalledWith(
      '[wow-token] Inserted EU price into database: priceGold=286250, timestamp=2026-08-01T12:00:00.000Z',
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[wow-token] Inserted US price into database: priceGold=331400, timestamp=2026-08-01T12:05:00.000Z',
    )
  })
})

describe('PostgreSQL environment configuration', () => {
  it('prefers DATABASE_URL over individual connection values', () => {
    expect(readDatabaseConfig({
      DATABASE_URL: 'postgresql://user:password@database.example/wowz',
      DATABASE_HOST: 'ignored',
    })).toEqual({
      url: 'postgresql://user:password@database.example/wowz',
    })
  })

  it('reads individual connection values when DATABASE_URL is empty', () => {
    expect(readDatabaseConfig({
      DATABASE_HOST: 'database.example',
      DATABASE_NAME: 'wowz',
      DATABASE_PASSWORD: 'secret',
      DATABASE_PORT: '5433',
      DATABASE_URL: '',
      DATABASE_USER: 'wowz-app',
    })).toEqual({
      host: 'database.example',
      database: 'wowz',
      password: 'secret',
      port: 5433,
      user: 'wowz-app',
    })
  })

  it('rejects an invalid DATABASE_PORT', () => {
    expect(() => readDatabaseConfig({
      DATABASE_HOST: 'database.example',
      DATABASE_NAME: 'wowz',
      DATABASE_PASSWORD: 'secret',
      DATABASE_PORT: 'invalid',
      DATABASE_USER: 'wowz-app',
    })).toThrow('DATABASE_PORT')
  })
})

describe('minute collector', () => {
  it('runs immediately, repeats every minute, and stops cleanly', async () => {
    let intervalCallback!: () => void
    const timer = { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>
    const clock = {
      setInterval: vi.fn((callback: () => void) => {
        intervalCallback = callback
        return timer
      }),
      clearInterval: vi.fn(),
    }
    const collect = vi.fn().mockResolvedValue(undefined)
    const stop = startWowTokenScheduler(collect, console, clock)

    await Promise.resolve()
    expect(clock.setInterval).toHaveBeenCalledWith(expect.any(Function), COLLECTION_INTERVAL_MS)
    expect(collect).toHaveBeenCalledTimes(1)

    intervalCallback()
    await Promise.resolve()
    expect(collect).toHaveBeenCalledTimes(2)

    stop()
    expect(clock.clearInterval).toHaveBeenCalledWith(timer)
  })

  it('does not overlap slow collections and recovers after a failure', async () => {
    let intervalCallback!: () => void
    const clock = {
      setInterval: vi.fn((callback: () => void) => {
        intervalCallback = callback
        return { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>
      }),
      clearInterval: vi.fn(),
    }
    let resolveFirst!: () => void
    const first = new Promise<void>((resolvePromise) => {
      resolveFirst = resolvePromise
    })
    const collect = vi.fn()
      .mockReturnValueOnce(first)
      .mockRejectedValueOnce(new Error('upstream'))
      .mockResolvedValue(undefined)
    const logger = { info: vi.fn(), error: vi.fn() }
    const stop = startWowTokenScheduler(collect, logger, clock)

    intervalCallback()
    expect(collect).toHaveBeenCalledTimes(1)

    resolveFirst()
    await first
    await Promise.resolve()

    intervalCallback()
    await Promise.resolve()
    await Promise.resolve()
    expect(logger.error).toHaveBeenCalledOnce()
    expect(logger.error).toHaveBeenCalledWith(
      '[wow-token] Scheduled collection failed',
      expect.objectContaining({ message: 'upstream' }),
    )
    expect(logger.info).toHaveBeenCalledWith('[wow-token] Scheduled collection started')

    intervalCallback()
    await Promise.resolve()
    expect(collect).toHaveBeenCalledTimes(3)
    expect(logger.info).toHaveBeenCalledWith('[wow-token] Scheduled collection completed successfully')
    stop()
  })
})

describe('WoW Token stream hub', () => {
  const dashboard = {
    regions: {
      eu: {
        quote: quotes.eu,
        trend: { period: '7d' as const, points: [quotes.eu] },
      },
      us: {
        quote: quotes.us,
        trend: { period: '7d' as const, points: [quotes.us] },
      },
    },
  }

  it('replays the latest full snapshot and removes disconnected subscribers', () => {
    const hub = new WowTokenStreamHub()
    const subscriber = vi.fn()
    hub.update(dashboard, false)

    const unsubscribe = hub.subscribe(subscriber)

    expect(subscriber).toHaveBeenCalledOnce()
    expect(subscriber).toHaveBeenCalledWith({
      id: createWowTokenSnapshotId(dashboard),
      data: dashboard,
    })

    unsubscribe()
    hub.update(structuredClone(dashboard), true)
    expect(subscriber).toHaveBeenCalledOnce()
  })

  it('seeds on unchanged collections and deduplicates concurrent broadcasts', () => {
    const hub = new WowTokenStreamHub()
    const subscriber = vi.fn()
    hub.subscribe(subscriber)

    hub.update(dashboard, false)
    expect(subscriber).not.toHaveBeenCalled()

    hub.update(dashboard, true)
    hub.update(structuredClone(dashboard), true)
    expect(subscriber).toHaveBeenCalledOnce()

    const changedDashboard = structuredClone(dashboard)
    changedDashboard.regions.eu.quote = {
      priceGold: 290_000,
      timestamp: '2026-08-01T13:00:00.000Z',
    }
    hub.update(changedDashboard, true)
    expect(subscriber).toHaveBeenCalledTimes(2)

    hub.clear()
    expect(hub.hasSnapshot).toBe(false)
  })

  it('formats price and heartbeat events and cleans up a closed connection', () => {
    let heartbeat!: () => void
    let onClosed!: () => void
    const timer = { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>
    const clock = {
      setInterval: vi.fn((callback: () => void) => {
        heartbeat = callback
        return timer
      }),
      clearInterval: vi.fn(),
    }
    const eventStream = {
      push: vi.fn().mockResolvedValue(undefined),
      onClosed: vi.fn((callback: () => void) => {
        onClosed = callback
      }),
    }
    const hub = new WowTokenStreamHub()
    hub.update(dashboard, false)

    attachWowTokenEventStream(eventStream, hub, clock)

    expect(clock.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      WOW_TOKEN_HEARTBEAT_INTERVAL_MS,
    )
    expect(timer.unref).toHaveBeenCalledOnce()
    expect(eventStream.push).toHaveBeenCalledWith({
      id: createWowTokenSnapshotId(dashboard),
      event: 'price',
      retry: WOW_TOKEN_RETRY_MS,
      data: JSON.stringify(dashboard),
    })

    heartbeat()
    expect(eventStream.push).toHaveBeenLastCalledWith({
      event: 'heartbeat',
      data: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    })

    onClosed()
    onClosed()
    expect(clock.clearInterval).toHaveBeenCalledOnce()
    expect(clock.clearInterval).toHaveBeenCalledWith(timer)

    const callsAfterClose = eventStream.push.mock.calls.length
    hub.update({
      ...dashboard,
      regions: {
        ...dashboard.regions,
        eu: {
          ...dashboard.regions.eu,
          quote: { priceGold: 300_000, timestamp: '2026-08-01T14:00:00.000Z' },
        },
      },
    }, true)
    heartbeat()
    expect(eventStream.push).toHaveBeenCalledTimes(callsAfterClose)
  })
})
