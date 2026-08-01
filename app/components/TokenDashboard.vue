<script setup lang="ts">
import type {
  WowTokenResponse,
  WowTokenStreamStatus,
} from '../../shared/types/wow-token'
import { formatGold, formatRelativeTime, formatTokenDate } from '../utils/formatters'

const props = withDefaults(defineProps<{
  data?: WowTokenResponse | null
  status?: 'idle' | 'pending' | 'success' | 'error'
  error?: boolean
  streamStatus?: WowTokenStreamStatus
}>(), {
  data: null,
  status: 'idle',
  error: false,
  streamStatus: 'live',
})

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const currentTime = useState('token-dashboard-current-time', () => Date.now())
const regions = ['eu', 'us'] as const
let relativeTimeTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  currentTime.value = Date.now()
  relativeTimeTimer = setInterval(() => {
    currentTime.value = Date.now()
  }, 60_000)
})

onUnmounted(() => {
  if (relativeTimeTimer) {
    clearInterval(relativeTimeTimer)
  }
})

const isLoading = computed(() => props.status === 'idle' || props.status === 'pending')
const hasError = computed(() => props.status === 'error' || props.error)
const streamBadgeColor = computed(() => ({
  connecting: 'neutral',
  live: 'success',
  reconnecting: 'warning',
  error: 'error',
} as const)[props.streamStatus])
const isChartReady = computed(() => regions.every(
  region => (props.data?.regions[region].trend.points.length ?? 0) >= 2,
))

const chartSummaries = computed(() => regions.flatMap((region) => {
  const prices = props.data?.regions[region].trend.points.map(point => point.priceGold) ?? []

  if (!prices.length) {
    return []
  }

  return [t('chart.summary', {
    region: t(`regions.${region}`),
    min: formatGold(Math.min(...prices)),
    max: formatGold(Math.max(...prices)),
  })]
}))
</script>

<template>
  <main class="warcraft-page flex min-h-screen items-center py-8 sm:py-12 lg:py-16">
    <UContainer class="w-full max-w-5xl" data-testid="page-container">
      <header class="mx-auto mb-7 max-w-3xl text-center sm:mb-10">
        <UBadge
          color="primary"
          variant="subtle"
          size="lg"
          class="mb-4 rounded-full px-4"
        >
          {{ t('app.eyebrow') }}
        </UBadge>

        <h1 class="gold-text text-3xl font-black tracking-tight sm:text-5xl">
          {{ t('app.title') }}
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
          {{ t('app.description') }}
        </p>
      </header>

      <section
        v-if="isLoading"
        class="space-y-5"
        :aria-label="t('states.loading')"
        aria-busy="true"
      >
        <div class="grid gap-5 md:grid-cols-2">
          <UCard
            v-for="region in regions"
            :key="region"
            class="warcraft-card"
          >
            <div class="space-y-5">
              <USkeleton class="h-5 w-32" />
              <USkeleton class="h-14 w-52" />
              <USkeleton class="h-4 w-44" />
            </div>
          </UCard>
        </div>
        <UCard class="warcraft-card">
          <div class="space-y-5">
            <USkeleton class="h-5 w-44" />
            <USkeleton class="h-64 w-full" />
          </div>
        </UCard>
      </section>

      <UAlert
        v-else-if="hasError"
        color="error"
        variant="subtle"
        :title="t('states.errorTitle')"
        :description="t('states.errorDescription')"
        class="warcraft-card mx-auto max-w-2xl"
      >
        <template #actions>
          <UButton
            color="error"
            variant="soft"
            :label="t('states.retry')"
            @click="emit('retry')"
          />
        </template>
      </UAlert>

      <template v-else-if="data">
        <section
          class="space-y-5"
        >
          <div
            class="grid gap-5 md:grid-cols-2"
            data-testid="quote-grid"
          >
            <UCard
              v-for="region in regions"
              :key="region"
              class="warcraft-card h-full"
              :data-testid="`quote-card-${region}`"
            >
              <template #header>
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <h2 class="text-lg font-bold text-highlighted">
                    {{ t('quote.title', { region: t(`regions.${region}`) }) }}
                  </h2>
                  <UBadge
                    :color="streamBadgeColor"
                    variant="subtle"
                    class="gap-2"
                    :data-stream-status="streamStatus"
                    :data-stream-color="streamBadgeColor"
                  >
                    <LivePulseIndicator :status="streamStatus" />
                    {{ t(`stream.${streamStatus}`) }}
                  </UBadge>
                </div>
              </template>

              <div class="flex min-h-56 flex-col justify-center" aria-live="polite">
                <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="gold-text text-5xl font-black tabular-nums sm:text-6xl">
                    {{ formatGold(data.regions[region].quote.priceGold) }}
                  </span>
                  <span class="inline-flex items-center gap-1.5 text-xl font-bold text-muted">
                    <GoldCoinIcon class="size-5" />
                    {{ t('quote.gold') }}
                  </span>
                </p>

                <div class="mt-7 space-y-2 text-sm text-muted">
                  <p>{{ t('quote.region', { region: t(`regions.${region}`) }) }}</p>
                  <p>
                    {{ t('quote.updatedAt', {
                      date: formatTokenDate(data.regions[region].quote.timestamp),
                      relative: formatRelativeTime(data.regions[region].quote.timestamp, currentTime),
                    }) }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>

          <UCard class="warcraft-card" data-testid="trend-card">
            <template #header>
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="text-lg font-bold text-highlighted">
                    {{ t('chart.title') }}
                  </h2>
                  <p class="mt-1 flex items-center gap-2 text-sm leading-6 text-muted">
                    <GoldCoinIcon class="size-4" />
                    {{ t('chart.description') }}
                  </p>
                </div>
                <UBadge
                  :color="streamBadgeColor"
                  variant="subtle"
                  class="gap-2"
                  :data-stream-status="streamStatus"
                  :data-stream-color="streamBadgeColor"
                >
                  <LivePulseIndicator :status="streamStatus" />
                  {{ t(`stream.${streamStatus}`) }}
                </UBadge>
              </div>
            </template>

            <div v-if="isChartReady" class="sr-only">
              <p v-for="summary in chartSummaries" :key="summary">
                {{ summary }}
              </p>
            </div>

            <div
              v-if="!isChartReady"
              class="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-default bg-elevated/40 px-6 text-center text-sm leading-7 text-muted"
              data-testid="history-collecting"
            >
              {{ t('chart.collecting') }}
            </div>

            <ClientOnly v-else>
              <TokenTrendChart
                :eu-points="data.regions.eu.trend.points"
                :us-points="data.regions.us.trend.points"
                :eu-label="t('regions.eu')"
                :us-label="t('regions.us')"
              />
              <template #fallback>
                <USkeleton class="h-64 w-full" />
              </template>
            </ClientOnly>
          </UCard>
        </section>
      </template>

      <footer class="mt-7 text-center text-xs leading-6 text-dimmed sm:mt-9 sm:text-sm">
        {{ t('footer') }}
      </footer>
    </UContainer>
  </main>
</template>
