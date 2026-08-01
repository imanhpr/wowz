import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenDashboard from '../../app/components/TokenDashboard.vue'
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

describe('TokenDashboard', () => {
  it('defaults to EU and switches the live quote and history to US', async () => {
    const wrapper = await mountSuspended(TokenDashboard, {
      props: {
        data: response,
        status: 'success',
      },
      global: {
        stubs: {
          TokenTrendChart: {
            template: '<div data-testid="token-chart-stub" />',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('قیمت توکن World Of Warcraft')
    expect(wrapper.text()).toContain('۲۸۶٬۲۵۰')
    expect(wrapper.text()).toContain('داده زنده بتل‌نت')
    expect(wrapper.text()).toContain('روند واقعی')
    expect(wrapper.get('[data-testid="region-tab-eu"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="region-tab-us"]').attributes('aria-selected')).toBe('false')

    await wrapper.get('[data-testid="region-tab-us"]').trigger('click')
    expect(wrapper.text()).toContain('۳۳۱٬۴۰۰')
    expect(wrapper.text()).toContain('منطقه آمریکا')
    expect(wrapper.get('[data-testid="region-tab-us"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="quote-card"]').attributes('data-testid')).toBe('quote-card')
    expect(wrapper.get('[data-testid="trend-card"]').attributes('data-testid')).toBe('trend-card')
    expect(wrapper.findAll('[data-testid="gold-coin-icon"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="gold-coin-icon"]').every(icon => icon.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('shows a collecting state until a region has two historical observations', async () => {
    const sparseResponse: WowTokenResponse = structuredClone(response)
    sparseResponse.regions.eu.trend.points = [sparseResponse.regions.eu.quote]

    const wrapper = await mountSuspended(TokenDashboard, {
      props: {
        data: sparseResponse,
        status: 'success',
      },
      global: {
        stubs: {
          TokenTrendChart: true,
        },
      },
    })

    expect(wrapper.get('[data-testid="history-collecting"]').text())
      .toContain('تاریخچه قیمت در حال جمع‌آوری است')
    expect(wrapper.find('[data-testid="token-chart"]').exists()).toBe(false)
  })

  it('renders an accessible loading state', async () => {
    const wrapper = await mountSuspended(TokenDashboard, {
      props: { status: 'pending' },
    })

    expect(wrapper.get('[aria-busy="true"]').attributes('aria-label'))
      .toBe('در حال دریافت قیمت توکن…')
  })

  it('shows a Persian error and emits retry', async () => {
    const wrapper = await mountSuspended(TokenDashboard, {
      props: {
        status: 'error',
        error: true,
      },
    })

    expect(wrapper.text()).toContain('دریافت قیمت ممکن نشد')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
