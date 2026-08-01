<script setup lang="ts">
import { CurveType, LineChart } from 'vue-chrts'
import type { TokenPricePoint } from '../../shared/types/wow-token'
import { formatChartDate, formatGold, formatTokenDate } from '../utils/formatters'

interface ChartDatum {
  timestamp: string
  euPrice: number
  usPrice: number
}

const props = defineProps<{
  euPoints: TokenPricePoint[]
  usPoints: TokenPricePoint[]
  euLabel: string
  usLabel: string
}>()

function mergeRegionalPoints(
  euPoints: TokenPricePoint[],
  usPoints: TokenPricePoint[],
): ChartDatum[] {
  const sortedEuPoints = [...euPoints].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
  const sortedUsPoints = [...usPoints].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  )
  const timestamps = [...new Set([
    ...sortedEuPoints.map(point => Date.parse(point.timestamp)),
    ...sortedUsPoints.map(point => Date.parse(point.timestamp)),
  ])].sort((left, right) => left - right)

  let euIndex = 0
  let usIndex = 0
  let euPrice: number | undefined
  let usPrice: number | undefined
  const mergedPoints: ChartDatum[] = []

  for (const timestamp of timestamps) {
    while (
      euIndex < sortedEuPoints.length
      && Date.parse(sortedEuPoints[euIndex]!.timestamp) <= timestamp
    ) {
      euPrice = sortedEuPoints[euIndex]!.priceGold
      euIndex += 1
    }

    while (
      usIndex < sortedUsPoints.length
      && Date.parse(sortedUsPoints[usIndex]!.timestamp) <= timestamp
    ) {
      usPrice = sortedUsPoints[usIndex]!.priceGold
      usIndex += 1
    }

    if (euPrice !== undefined && usPrice !== undefined) {
      mergedPoints.push({
        timestamp: new Date(timestamp).toISOString(),
        euPrice,
        usPrice,
      })
    }
  }

  return mergedPoints
}

const chartData = computed(() => mergeRegionalPoints(props.euPoints, props.usPoints))

const categories = computed(() => ({
  euPrice: {
    name: props.euLabel,
    color: '#f8b700',
  },
  usPrice: {
    name: props.usLabel,
    color: '#3b82f6',
  },
}))

function formatXAxis(tick: number): string {
  const point = chartData.value[tick]
  return point ? formatChartDate(point.timestamp) : ''
}

function formatTooltipTitle(point: ChartDatum): string {
  return formatTokenDate(point.timestamp)
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
      :tooltip-title-formatter="formatTooltipTitle"
      :x-num-ticks="4"
      :y-num-ticks="4"
      :y-grid-line="true"
      :hide-legend="false"
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
