<script setup lang="ts">
import { CurveType, LineChart } from 'vue-chrts'
import type { TokenPricePoint } from '../../shared/types/wow-token'
import { formatChartDate, formatGold } from '../utils/formatters'

const props = defineProps<{
  points: TokenPricePoint[]
  seriesLabel: string
}>()

const chartData = computed(() => props.points.map(point => ({
  timestamp: point.timestamp,
  price: point.priceGold,
})))

const categories = computed(() => ({
  price: {
    name: props.seriesLabel,
    color: '#f8b700',
  },
}))

function formatXAxis(tick: number): string {
  const point = chartData.value[tick]
  return point ? formatChartDate(point.timestamp) : ''
}
</script>

<template>
  <div
    class="token-chart w-full overflow-visible tabular-nums"
    data-testid="token-chart"
    style="--vis-font-family: 'Vazirmatn Variable', ui-sans-serif, system-ui, sans-serif; --vis-axis-font-family: 'Vazirmatn Variable', ui-sans-serif, system-ui, sans-serif;"
  >
    <LineChart
      :data="chartData"
      :categories="categories"
      :height="270"
      :curve-type="CurveType.MonotoneX"
      :line-width="3"
      :x-formatter="formatXAxis"
      :y-formatter="formatGold"
      :x-num-ticks="4"
      :y-num-ticks="4"
      :y-grid-line="true"
      :hide-legend="true"
      :padding="{ top: 12, right: 16, bottom: 8, left: 8 }"
      :x-axis-config="{ tickTextColor: '#94a3b8', tickTextFontSize: '12px' }"
      :y-axis-config="{ tickTextColor: '#94a3b8', tickTextFontSize: '12px' }"
    />
  </div>
</template>

<style scoped>
/* Keep Persian digits LTR so SVG's end anchor places labels left of the y-axis. */
.token-chart :deep(g[axis-type="y"] text) {
  direction: ltr;
  font-variant-numeric: tabular-nums;
  unicode-bidi: isolate;
}
</style>
