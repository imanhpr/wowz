<script setup lang="ts">
import type {
  TokenPricePoint,
  WowTokenResponse,
  WowTokenStreamStatus,
} from '../../shared/types/wow-token'

const { data, status, error, refresh } = await useFetch<WowTokenResponse>('/api/wow-token')
const streamStatus = ref<WowTokenStreamStatus>('connecting')
let eventSource: EventSource | undefined

function isTokenPricePoint(value: unknown): value is TokenPricePoint {
  if (!value || typeof value !== 'object') {
    return false
  }

  const point = value as Partial<TokenPricePoint>
  return typeof point.priceGold === 'number'
    && Number.isFinite(point.priceGold)
    && typeof point.timestamp === 'string'
    && Number.isFinite(Date.parse(point.timestamp))
}

function isWowTokenResponse(value: unknown): value is WowTokenResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const regions = (value as Partial<WowTokenResponse>).regions
  if (!regions || typeof regions !== 'object') {
    return false
  }

  return (['eu', 'us'] as const).every((region) => {
    const regionalData = regions[region]
    return regionalData?.trend.period === '7d'
      && isTokenPricePoint(regionalData.quote)
      && Array.isArray(regionalData.trend.points)
      && regionalData.trend.points.every(isTokenPricePoint)
  })
}

function openPriceStream(): void {
  eventSource?.close()
  streamStatus.value = 'connecting'

  const source = new EventSource('/api/wow-token/stream')
  eventSource = source

  source.onopen = () => {
    if (eventSource === source) {
      streamStatus.value = 'live'
    }
  }

  source.addEventListener('price', (event) => {
    try {
      const payload: unknown = JSON.parse(event.data)
      if (!isWowTokenResponse(payload)) {
        throw new Error('Malformed WoW Token SSE payload')
      }

      data.value = payload
      streamStatus.value = 'live'
    }
    catch {
      streamStatus.value = 'error'
    }
  })

  source.onerror = () => {
    if (eventSource !== source) {
      return
    }

    streamStatus.value = source.readyState === EventSource.CLOSED
      ? 'error'
      : 'reconnecting'
  }
}

async function retry(): Promise<void> {
  await refresh()

  if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
    openPriceStream()
  }
}

onMounted(openPriceStream)

onUnmounted(() => {
  eventSource?.close()
  eventSource = undefined
})
</script>

<template>
  <TokenDashboard
    :data="data"
    :status="status"
    :error="Boolean(error)"
    :stream-status="streamStatus"
    @retry="retry"
  />
</template>
