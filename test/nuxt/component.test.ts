import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenDashboard from '../../app/components/TokenDashboard.vue'
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

describe('TokenDashboard', () => {
  it('renders Persian quote content and clearly labels demo data', async () => {
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

    expect(wrapper.text()).toContain('قیمت توکن ورد آو وارکرفت')
    expect(wrapper.text()).toContain('۲۸۶٬۲۵۰')
    expect(wrapper.text()).toContain('داده آزمایشی')
    expect(wrapper.text()).toContain('روند آزمایشی')
    expect(wrapper.get('[data-testid="quote-card"]').attributes('data-testid')).toBe('quote-card')
    expect(wrapper.get('[data-testid="trend-card"]').attributes('data-testid')).toBe('trend-card')
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
