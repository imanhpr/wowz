import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenTrendChart from '../../app/components/TokenTrendChart.client.vue'
import { formatTokenDate } from '../../app/utils/formatters'

describe('TokenTrendChart', () => {
  it('uses Vazirmatn and keeps the plot next to complete Persian y-axis labels', async () => {
    const wrapper = await mountSuspended(TokenTrendChart, {
      props: {
        points: [
          { timestamp: '2026-07-31T12:00:00.000Z', priceGold: 284_900 },
          { timestamp: '2026-08-01T12:00:00.000Z', priceGold: 286_250 },
        ],
        seriesLabel: 'قیمت توکن',
      },
      global: {
        stubs: {
          LineChart: {
            props: ['padding', 'yFormatter', 'tooltipTitleFormatter'],
            template: `
              <div
                data-testid="line-chart-stub"
                :data-left-padding="padding.left"
                :data-right-padding="padding.right"
              >
                <span data-testid="formatted-price">{{ yFormatter(286250) }}</span>
                <span data-testid="tooltip-title">{{ tooltipTitleFormatter({ timestamp: '2026-07-28T12:00:00.000Z', price: 279650 }) }}</span>
              </div>
            `,
          },
        },
      },
    })

    const chart = wrapper.get('[data-testid="token-chart"]')
    const lineChart = wrapper.get('[data-testid="line-chart-stub"]')

    expect(chart.classes()).toContain('tabular-nums')
    expect(chart.classes()).toContain('overflow-visible')
    expect(chart.classes()).not.toContain('overflow-hidden')
    expect(chart.attributes('style')).toContain("--vis-font-family: 'Vazirmatn Variable'")
    expect(chart.attributes('style')).toContain("--vis-axis-font-family: 'Vazirmatn Variable'")
    expect(lineChart.attributes('data-left-padding')).toBe('8')
    expect(lineChart.attributes('data-right-padding')).toBe('16')
    expect(wrapper.get('[data-testid="formatted-price"]').text()).toBe('۲۸۶٬۲۵۰')
    expect(wrapper.get('[data-testid="tooltip-title"]').text()).toBe(formatTokenDate('2026-07-28T12:00:00.000Z'))
    expect(wrapper.get('[data-testid="tooltip-title"]').text()).not.toContain('2026-07-28')
  })
})
