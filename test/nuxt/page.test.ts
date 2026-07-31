import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import IndexPage from '../../app/pages/index.vue'
import type { WowTokenResponse } from '../../shared/types/wow-token'

const response: WowTokenResponse = {
  region: 'eu',
  quote: {
    priceGold: 286_250,
    timestamp: '2026-08-01T12:00:00.000Z',
    source: 'mock',
  },
  trend: {
    period: '7d',
    source: 'mock',
    points: [
      { timestamp: '2026-07-26T12:00:00.000Z', priceGold: 274_300 },
      { timestamp: '2026-08-01T12:00:00.000Z', priceGold: 286_250 },
    ],
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
    expect(wrapper.text()).toContain('بازار اروپا')
    expect(document.documentElement.lang).toBe('fa-IR')
    expect(document.documentElement.dir).toBe('rtl')

    const routes = useRouter().getRoutes().filter(route => route.path !== '/__nuxt_error')
    expect(routes.map(route => route.path)).toEqual(['/'])
  })
})
