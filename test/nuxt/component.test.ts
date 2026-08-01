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
  it('shows both regional quotes and one shared chart without region tabs', async () => {
    const wrapper = await mountSuspended(TokenDashboard, {
      props: {
        data: response,
        status: 'success',
      },
      global: {
        stubs: {
          TokenTrendChart: {
            props: ['euPoints', 'usPoints', 'euLabel', 'usLabel'],
            template: `
              <div
                data-testid="token-chart-stub"
                :data-eu-count="euPoints.length"
                :data-us-count="usPoints.length"
                :data-eu-label="euLabel"
                :data-us-label="usLabel"
              />
            `,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('قیمت توکن World Of Warcraft')
    expect(wrapper.text()).toContain('۲۸۶٬۲۵۰')
    expect(wrapper.text()).toContain('۳۳۱٬۴۰۰')
    expect(wrapper.text()).toContain('منطقه اروپا')
    expect(wrapper.text()).toContain('منطقه آمریکا')
    expect(wrapper.text()).toContain('جریان قیمت زنده')
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
    expect(wrapper.find('[role="tabpanel"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="quote-grid"]').classes()).toEqual(expect.arrayContaining([
      'grid',
      'md:grid-cols-2',
    ]))
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('۲۸۶٬۲۵۰')
    expect(wrapper.get('[data-testid="quote-card-us"]').text()).toContain('۳۳۱٬۴۰۰')
    expect(wrapper.get('[data-testid="quote-card-eu"]').text()).toContain('آخرین به‌روزرسانی')
    expect(wrapper.get('[data-testid="quote-card-us"]').text()).toContain('آخرین به‌روزرسانی')
    expect(wrapper.get('[data-testid="trend-card"]').attributes('data-testid')).toBe('trend-card')
    expect(wrapper.get('.sr-only').text()).toContain('در منطقه اروپا، کمترین قیمت ۲۷۴٬۳۰۰ طلا و بیشترین قیمت ۲۸۶٬۲۵۰ طلا است.')
    expect(wrapper.get('.sr-only').text()).toContain('در منطقه آمریکا، کمترین قیمت ۳۲۶٬۰۰۰ طلا و بیشترین قیمت ۳۳۱٬۴۰۰ طلا است.')
    expect(wrapper.get('[data-testid="token-chart-stub"]').attributes()).toMatchObject({
      'data-eu-count': '2',
      'data-us-count': '2',
      'data-eu-label': 'اروپا',
      'data-us-label': 'آمریکا',
    })
    expect(wrapper.findAll('[data-testid="gold-coin-icon"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="gold-coin-icon"]').every(icon => icon.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.findAll('[data-testid="live-pulse-indicator"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="live-pulse-indicator"]').every(indicator => indicator.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.findAll('.motion-safe\\:animate-ping')).toHaveLength(3)
  })

  it.each([
    ['connecting', 'در حال اتصال به جریان زنده', 'neutral'],
    ['reconnecting', 'در حال اتصال دوباره', 'warning'],
    ['error', 'جریان قیمت قطع است', 'error'],
  ] as const)('renders the %s stream state without a live pulse', async (streamStatus, label, color) => {
    const wrapper = await mountSuspended(TokenDashboard, {
      props: {
        data: response,
        status: 'success',
        streamStatus,
      },
      global: {
        stubs: {
          TokenTrendChart: true,
        },
      },
    })

    expect(wrapper.text()).toContain(label)
    expect(wrapper.findAll('[data-testid="live-pulse-indicator"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="live-pulse-indicator"]')
      .every(indicator => indicator.attributes('data-status') === streamStatus)).toBe(true)
    expect(wrapper.findAll('.motion-safe\\:animate-ping')).toHaveLength(0)
    expect(wrapper.findAll(`[data-stream-color="${color}"]`)).toHaveLength(3)
  })

  it('shows a collecting state until both regions have two historical observations', async () => {
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
