import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { nextTick, ref } from 'vue'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import IndexPage from '../../app/pages/index.vue'
import type { WowTokenResponse } from '../../shared/types/wow-token'

const response: WowTokenResponse = {
  regions: {
    eu: {
      quote: { priceGold: 286_250, timestamp: '2026-08-01T12:00:00.000Z' },
      trend: {
        period: '7d',
        points: [
          { timestamp: '2026-07-26T12:00:00.000Z', priceGold: 274_300 },
          { timestamp: '2026-08-01T12:00:00.000Z', priceGold: 286_250 },
        ],
      },
    },
    us: {
      quote: { priceGold: 331_400, timestamp: '2026-08-01T12:05:00.000Z' },
      trend: {
        period: '7d',
        points: [
          { timestamp: '2026-07-26T12:00:00.000Z', priceGold: 326_000 },
          { timestamp: '2026-08-01T12:05:00.000Z', priceGold: 331_400 },
        ],
      },
    },
  },
}

mockNuxtImport('useFetch', () => () => ({
  data: ref(structuredClone(response)),
  status: ref<'success'>('success'),
  error: ref(null),
  refresh: vi.fn(),
}))

class MockEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
  static readonly instances: MockEventSource[] = []

  readonly url: string
  readyState = MockEventSource.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>()

  constructor(url: string | URL) {
    this.url = String(url)
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  emit(type: string, data: string): void {
    const event = new MessageEvent(type, { data })
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }
}

vi.stubGlobal('EventSource', MockEventSource)

beforeEach(() => {
  MockEventSource.instances.splice(0)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('index page', () => {
  it('renders the centered Persian dashboard at the only page route', async () => {
    const wrapper = await mountSuspended(IndexPage, {
      global: {
        stubs: {
          TokenTrendChart: true,
        },
      },
    })

    expect(wrapper.get('[data-testid="page-container"]').classes()).toContain('max-w-5xl')
    expect(wrapper.text()).toContain('بازار اروپا و آمریکا')
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('۲۸۶٬۲۵۰')
    expect(wrapper.get('[data-testid="quote-card-us"]').text()).toContain('۳۳۱٬۴۰۰')
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="quote-card-"]')).toHaveLength(2)
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0]?.url).toBe('/api/wow-token/stream')
    expect(document.documentElement.lang).toBe('fa-IR')
    expect(document.documentElement.dir).toBe('rtl')

    const routes = useRouter().getRoutes().filter(route => route.path !== '/__nuxt_error')
    expect(routes.map(route => route.path)).toEqual(['/'])

    wrapper.unmount()
    expect(MockEventSource.instances[0]?.readyState).toBe(MockEventSource.CLOSED)
  })

  it('applies valid price events and reflects reconnect and malformed-event states', async () => {
    const wrapper = await mountSuspended(IndexPage, {
      global: {
        stubs: {
          TokenTrendChart: true,
        },
      },
    })
    const source = MockEventSource.instances[0]!

    expect(wrapper.text()).toContain('در حال اتصال به جریان زنده')
    source.readyState = MockEventSource.OPEN
    source.onopen?.(new Event('open'))
    await nextTick()
    expect(wrapper.text()).toContain('جریان قیمت زنده')

    const updatedResponse = structuredClone(response)
    updatedResponse.regions.eu.quote.priceGold = 299_000
    source.emit('price', JSON.stringify(updatedResponse))
    await nextTick()
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('۲۹۹٬۰۰۰')

    source.readyState = MockEventSource.CONNECTING
    source.onerror?.(new Event('error'))
    await nextTick()
    expect(wrapper.text()).toContain('در حال اتصال دوباره')
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('۲۹۹٬۰۰۰')

    source.emit('price', '{not-json')
    await nextTick()
    expect(wrapper.text()).toContain('جریان قیمت قطع است')
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('۲۹۹٬۰۰۰')
  })
})
