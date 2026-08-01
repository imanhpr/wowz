import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
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
  data: ref(response),
  status: ref<'success'>('success'),
  error: ref(null),
  refresh: vi.fn(),
}))

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
    expect(document.documentElement.lang).toBe('fa-IR')
    expect(document.documentElement.dir).toBe('rtl')

    const routes = useRouter().getRoutes().filter(route => route.path !== '/__nuxt_error')
    expect(routes.map(route => route.path)).toEqual(['/'])
  })
})
