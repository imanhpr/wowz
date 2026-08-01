<script setup lang="ts">
import { CurveType, LineChart } from 'vue-chrts'
import type { TokenPricePoint } from '../../shared/types/wow-token'
import {
  formatChartDate,
  formatChartDateTime,
  formatGold,
  formatPercentChange,
  formatTokenDate,
} from '../utils/formatters'

interface MergedPriceDatum {
  timestamp: string
  euPrice: number
  usPrice: number
}

interface ChartDatum extends MergedPriceDatum {
  euChange: number
  usChange: number
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
): MergedPriceDatum[] {
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
  const mergedPoints: MergedPriceDatum[] = []

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

const chartData = computed<ChartDatum[]>(() => {
  const mergedPoints = mergeRegionalPoints(props.euPoints, props.usPoints)
  const baseline = mergedPoints[0]

  if (!baseline) {
    return []
  }

  return mergedPoints.map(point => ({
    ...point,
    euChange: point.euPrice / baseline.euPrice - 1,
    usChange: point.usPrice / baseline.usPrice - 1,
  }))
})

const yDomain = computed<[number, number]>(() => {
  const values = chartData.value.flatMap(point => [point.euChange, point.usChange])

  if (!values.length) {
    return [-0.005, 0.005]
  }

  const minimum = Math.min(...values)
  const maximum = Math.max(...values)

  if (minimum === maximum) {
    return [minimum - 0.005, maximum + 0.005]
  }

  const padding = Math.max((maximum - minimum) * 0.15, 0.0005)
  return [minimum - padding, maximum + padding]
})

const usesTimeLabels = computed(() => {
  const first = chartData.value[0]
  const last = chartData.value.at(-1)

  return Boolean(
    first
    && last
    && Date.parse(last.timestamp) - Date.parse(first.timestamp) < 48 * 60 * 60 * 1_000,
  )
})

const categories = computed(() => ({
  euChange: {
    name: props.euLabel,
    color: '#f8b700',
  },
  usChange: {
    name: props.usLabel,
    color: '#3b82f6',
  },
}))

function formatXAxis(tick: number): string {
  const point = chartData.value[tick]
  if (!point) {
    return ''
  }

  return usesTimeLabels.value
    ? formatChartDateTime(point.timestamp)
    : formatChartDate(point.timestamp)
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
      :y-formatter="formatPercentChange"
      :tooltip-title-formatter="formatTooltipTitle"
      :x-num-ticks="4"
      :y-num-ticks="4"
      :y-domain="yDomain"
      :y-grid-line="true"
      :hide-legend="false"
      :padding="{ top: 12, right: 16, bottom: 8, left: 8 }"
      :x-axis-config="{ tickTextColor: '#94a3b8', tickTextFontSize: '12px' }"
      :y-axis-config="{ tickTextColor: '#94a3b8', tickTextFontSize: '12px' }"
    >
      <template #tooltip="{ values }">
        <div v-if="values" dir="rtl" class="min-w-44 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-right text-xs shadow-xl">
          <p class="mb-2 text-slate-400">
            {{ formatTooltipTitle(values) }}
          </p>
          <p class="flex items-center justify-between gap-5 text-slate-100">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-[#f8b700]" />
              {{ euLabel }}
            </span>
            <span>{{ formatGold(values.euPrice) }}</span>
          </p>
          <p class="mt-1.5 flex items-center justify-between gap-5 text-slate-100">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-[#3b82f6]" />
              {{ usLabel }}
            </span>
            <span>{{ formatGold(values.usPrice) }}</span>
          </p>
        </div>
      </template>
    </LineChart>
  </div>
</template>

<style scoped>
/* Keep Persian digits LTR so SVG's end anchor places labels left of the y-axis. */
.token-chart :deep(g[axis-type="y"] text) {
  direction: ltr;
  font-variant-numeric: tabular-nums;
  unicode-bidi: isolate;
}

.token-chart {
  --vis-axis-grid-color: #29415f;
  --vis-axis-grid-opacity: 0.55;
  --vis-tooltip-background-color: transparent;
  --vis-tooltip-border-color: transparent;
  --vis-tooltip-border-radius: 0;
  --vis-tooltip-box-shadow: none;
  --vis-tooltip-padding: 0;
}
</style>
