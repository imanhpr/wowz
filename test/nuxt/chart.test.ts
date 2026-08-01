import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import TokenTrendChart from '../../app/components/TokenTrendChart.client.vue'
import { formatTokenDate } from '../../app/utils/formatters'

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
              'tooltipTitleFormatter',
            ],
            template: `
              <div
                data-testid="line-chart-stub"
                :data-chart-data="JSON.stringify(data)"
                :data-eu-label="categories.euPrice.name"
                :data-us-label="categories.usPrice.name"
                :data-eu-color="categories.euPrice.color"
                :data-us-color="categories.usPrice.color"
                :data-hide-legend="String(hideLegend)"
                :data-left-padding="padding.left"
                :data-right-padding="padding.right"
              >
                <span data-testid="formatted-price">{{ yFormatter(286250) }}</span>
                <span data-testid="tooltip-title">{{ tooltipTitleFormatter({ timestamp: '2026-07-28T12:00:00.000Z', euPrice: 279650, usPrice: 330000 }) }}</span>
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
    expect(JSON.parse(lineChart.attributes('data-chart-data')!)).toEqual([
      {
        timestamp: '2026-07-31T11:00:00.000Z',
        euPrice: 284_900,
        usPrice: 330_000,
      },
      {
        timestamp: '2026-07-31T12:00:00.000Z',
        euPrice: 286_250,
        usPrice: 330_000,
      },
      {
        timestamp: '2026-07-31T13:00:00.000Z',
        euPrice: 286_250,
        usPrice: 331_400,
      },
    ])
    expect(lineChart.attributes()).toMatchObject({
      'data-eu-label': 'اروپا',
      'data-us-label': 'آمریکا',
      'data-eu-color': '#f8b700',
      'data-us-color': '#3b82f6',
      'data-hide-legend': 'false',
    })
    expect(lineChart.attributes('data-left-padding')).toBe('8')
    expect(lineChart.attributes('data-right-padding')).toBe('16')
    expect(wrapper.get('[data-testid="formatted-price"]').text()).toBe('۲۸۶٬۲۵۰')
    expect(wrapper.get('[data-testid="tooltip-title"]').text()).toBe(formatTokenDate('2026-07-28T12:00:00.000Z'))
    expect(wrapper.get('[data-testid="tooltip-title"]').text()).not.toContain('2026-07-28')
  })
})
