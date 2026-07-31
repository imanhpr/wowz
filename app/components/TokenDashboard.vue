<script setup lang="ts">
import type { WowTokenResponse } from '../../shared/types/wow-token'
import { formatGold, formatTokenDate } from '../utils/formatters'

const props = withDefaults(defineProps<{
  data?: WowTokenResponse | null
  status?: 'idle' | 'pending' | 'success' | 'error'
  error?: boolean
}>(), {
  data: null,
  status: 'idle',
  error: false,
})

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const isLoading = computed(() => props.status === 'idle' || props.status === 'pending')
const hasError = computed(() => props.status === 'error' || props.error)

const quoteSourceLabel = computed(() => (
  props.data?.quote.source === 'battle-net'
    ? t('quote.live')
    : t('quote.mock')
))

const chartSummary = computed(() => {
  const prices = props.data?.trend.points.map(point => point.priceGold) ?? []

  if (!prices.length) {
    return ''
  }

  return t('chart.summary', {
    min: formatGold(Math.min(...prices)),
    max: formatGold(Math.max(...prices)),
  })
})
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
        class="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]"
        :aria-label="t('states.loading')"
        aria-busy="true"
      >
        <UCard class="warcraft-card">
          <div class="space-y-5">
            <USkeleton class="h-5 w-32" />
            <USkeleton class="h-14 w-52" />
            <USkeleton class="h-4 w-44" />
          </div>
        </UCard>
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

      <section
        v-else-if="data"
        class="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)]"
      >
        <UCard class="warcraft-card h-full" data-testid="quote-card">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-bold text-highlighted">
                {{ t('quote.title') }}
              </h2>
              <UBadge
                :color="data.quote.source === 'battle-net' ? 'success' : 'warning'"
                variant="subtle"
              >
                {{ quoteSourceLabel }}
              </UBadge>
            </div>
          </template>

          <div class="flex min-h-56 flex-col justify-center" aria-live="polite">
            <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="gold-text text-5xl font-black tabular-nums sm:text-6xl">
                {{ formatGold(data.quote.priceGold) }}
              </span>
              <span class="text-xl font-bold text-muted">
                {{ t('quote.gold') }}
              </span>
            </p>

            <div class="mt-7 space-y-2 text-sm text-muted">
              <p>{{ t('quote.region') }}</p>
              <p>{{ t('quote.updatedAt', { date: formatTokenDate(data.quote.timestamp) }) }}</p>
            </div>
          </div>
        </UCard>

        <UCard class="warcraft-card" data-testid="trend-card">
          <template #header>
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold text-highlighted">
                  {{ t('chart.title') }}
                </h2>
                <p class="mt-1 text-sm leading-6 text-muted">
                  {{ t('chart.description') }}
                </p>
              </div>
              <UBadge color="warning" variant="subtle">
                {{ t('chart.demo') }}
              </UBadge>
            </div>
          </template>

          <p class="sr-only">
            {{ chartSummary }}
          </p>

          <ClientOnly>
            <TokenTrendChart
              :points="data.trend.points"
              :series-label="t('chart.series')"
            />
            <template #fallback>
              <USkeleton class="h-64 w-full" />
            </template>
          </ClientOnly>
        </UCard>
      </section>

      <footer class="mt-7 text-center text-xs leading-6 text-dimmed sm:mt-9 sm:text-sm">
        {{ t('footer') }}
      </footer>
    </UContainer>
  </main>
</template>
