import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenTrendChart from '../../app/components/TokenTrendChart.client.vue'

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
            props: ['padding', 'yFormatter'],
            template: `
              <div
                data-testid="line-chart-stub"
                :data-left-padding="padding.left"
                :data-right-padding="padding.right"
              >
                {{ yFormatter(286250) }}
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
    expect(lineChart.text()).toBe('۲۸۶٬۲۵۰')
  })
})
