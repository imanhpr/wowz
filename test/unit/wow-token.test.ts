import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWowTokenDatabase } from '../../server/database/client'
import { WowTokenRepository, type TokenHistoryStore } from '../../server/database/wow-token-repository'
import {
  BattleNetClient,
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
    saveQuotes: vi.fn(),
    getHistory: vi.fn((region: WowRegion) => [quotes[region]]),
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

    await expect(service.collect()).resolves.toEqual(quotes)
    expect(client.fetchQuote).toHaveBeenCalledTimes(2)
    expect(store.saveQuotes).toHaveBeenCalledOnce()
    expect(store.saveQuotes).toHaveBeenCalledWith(quotes)
  })

  it('persists nothing and sanitizes details when either regional request fails', async () => {
    const client = createClientMock({ us: new Error('secret upstream response') })
    const store = createStoreMock()
    const service = new WowTokenService(credentials, client, store)
    const request = service.collect()

    await expect(request).rejects.toBeInstanceOf(TokenUpstreamError)
    await expect(request).rejects.not.toThrow('secret upstream response')
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
    vi.mocked(store.saveQuotes).mockImplementation(() => {
      throw new Error('private sqlite details')
    })
    const service = new WowTokenService(credentials, createClientMock(), store)
    const request = service.collect()

    await expect(request).rejects.toBeInstanceOf(TokenStorageError)
    await expect(request).rejects.not.toThrow('private sqlite details')
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

describe('SQLite history repository', () => {
  const temporaryDirectories: string[] = []
  const closeDatabases: Array<() => void> = []

  afterEach(() => {
    closeDatabases.splice(0).forEach(close => close())
    temporaryDirectories.splice(0).forEach(directory => rmSync(directory, { recursive: true }))
  })

  it('applies migrations, deduplicates observations, and returns ordered history after the cutoff', () => {
    const directory = mkdtempSync(join(tmpdir(), 'wow-token-test-'))
    temporaryDirectories.push(directory)
    const database = createWowTokenDatabase(join(directory, 'history.sqlite'))
    closeDatabases.push(database.close)
    migrate(database.db, { migrationsFolder: resolve('drizzle') })
    const logger = { info: vi.fn() }
    const repository = new WowTokenRepository(database.db, logger)

    repository.saveQuotes(quotes)
    repository.saveQuotes(quotes)
    repository.saveQuotes({
      eu: { priceGold: 270_000, timestamp: '2026-07-20T12:00:00.000Z' },
      us: { priceGold: 320_000, timestamp: '2026-07-31T12:00:00.000Z' },
    })

    expect(repository.getHistory('eu', new Date('2026-07-26T00:00:00.000Z'))).toEqual([
      quotes.eu,
    ])
    expect(repository.getHistory('us', new Date('2026-07-26T00:00:00.000Z'))).toEqual([
      { priceGold: 320_000, timestamp: '2026-07-31T12:00:00.000Z' },
      quotes.us,
    ])
    expect(logger.info).toHaveBeenCalledTimes(4)
    expect(logger.info).toHaveBeenCalledWith(
      '[wow-token] Inserted EU price into database: priceGold=286250, timestamp=2026-08-01T12:00:00.000Z',
    )
    expect(logger.info).toHaveBeenCalledWith(
      '[wow-token] Inserted US price into database: priceGold=331400, timestamp=2026-08-01T12:05:00.000Z',
    )
  })
})

describe('hourly collector', () => {
  it('runs immediately, repeats hourly, and stops cleanly', async () => {
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
    expect(logger.info).toHaveBeenCalledWith('[wow-token] Scheduled collection started')

    intervalCallback()
    await Promise.resolve()
    expect(collect).toHaveBeenCalledTimes(3)
    expect(logger.info).toHaveBeenCalledWith('[wow-token] Scheduled collection completed successfully')
    stop()
  })
})
