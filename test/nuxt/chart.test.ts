import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenTrendChart from '../../app/components/TokenTrendChart.client.vue'
import { formatChartDateTime, formatTokenDate } from '../../app/utils/formatters'

describe('TokenTrendChart', () => {
  it('merges regional histories and renders two labelled, differently colored series', async () => {
    const wrapper = await mountSuspended(TokenTrendChart, {
      props: {
        euPoints: [
          { timestamp: '2026-07-31T10:00:00.000Z', priceGold: 284_900 },
          { timestamp: '2026-07-31T12:00:00.000Z', priceGold: 286_250 },
        ],
        usPoints: [
          { timestamp: '2026-07-31T11:00:00.000Z', priceGold: 330_000 },
          { timestamp: '2026-07-31T13:00:00.000Z', priceGold: 331_400 },
        ],
        euLabel: 'اروپا',
        usLabel: 'آمریکا',
      },
      global: {
        stubs: {
          LineChart: {
            props: [
              'data',
              'categories',
              'hideLegend',
              'padding',
              'yFormatter',
              'xFormatter',
              'yDomain',
              'tooltipTitleFormatter',
            ],
            template: `
              <div
                data-testid="line-chart-stub"
                :data-chart-data="JSON.stringify(data)"
                :data-eu-label="categories.euChange.name"
                :data-us-label="categories.usChange.name"
                :data-eu-color="categories.euChange.color"
                :data-us-color="categories.usChange.color"
                :data-hide-legend="String(hideLegend)"
                :data-left-padding="padding.left"
                :data-right-padding="padding.right"
                :data-y-domain="JSON.stringify(yDomain)"
              >
                <span data-testid="formatted-change">{{ yFormatter(0.0125) }}</span>
                <span data-testid="x-axis-label">{{ xFormatter(0) }}</span>
                <slot name="tooltip" :values="{ timestamp: '2026-07-28T12:00:00.000Z', euPrice: 279650, usPrice: 330000, euChange: -0.02, usChange: 0.01 }" />
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
    const chartData = JSON.parse(lineChart.attributes('data-chart-data')!)
    expect(chartData).toHaveLength(3)
    expect(chartData[0]).toEqual({
      timestamp: '2026-07-31T11:00:00.000Z',
      euPrice: 284_900,
      usPrice: 330_000,
      euChange: 0,
      usChange: 0,
    })
    expect(chartData[1]).toMatchObject({
      timestamp: '2026-07-31T12:00:00.000Z',
      euPrice: 286_250,
      usPrice: 330_000,
      usChange: 0,
    })
    expect(chartData[1].euChange).toBeCloseTo(286_250 / 284_900 - 1)
    expect(chartData[2].usChange).toBeCloseTo(331_400 / 330_000 - 1)
    expect(lineChart.attributes()).toMatchObject({
      'data-eu-label': 'اروپا',
      'data-us-label': 'آمریکا',
      'data-eu-color': '#f8b700',
      'data-us-color': '#3b82f6',
      'data-hide-legend': 'false',
    })
    expect(lineChart.attributes('data-left-padding')).toBe('8')
    expect(lineChart.attributes('data-right-padding')).toBe('16')
    expect(JSON.parse(lineChart.attributes('data-y-domain')!)).toEqual(expect.arrayContaining([
      expect.any(Number),
      expect.any(Number),
    ]))
    expect(wrapper.get('[data-testid="formatted-change"]').text()).toBe('‎+۱٫۲۵٪')
    expect(wrapper.get('[data-testid="x-axis-label"]').text()).toBe(formatChartDateTime('2026-07-31T11:00:00.000Z'))
    expect(wrapper.text()).toContain(formatTokenDate('2026-07-28T12:00:00.000Z'))
    expect(wrapper.text()).toContain('۲۷۹٬۶۵۰')
    expect(wrapper.text()).toContain('۳۳۰٬۰۰۰')
  })
})
