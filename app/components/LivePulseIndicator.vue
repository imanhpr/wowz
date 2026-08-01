<script setup lang="ts">
import type { WowTokenStreamStatus } from '../../shared/types/wow-token'

const props = withDefaults(defineProps<{
  status?: WowTokenStreamStatus
}>(), {
  status: 'live',
})

const dotClass = computed(() => ({
  connecting: 'bg-slate-400',
  live: 'bg-emerald-400',
  reconnecting: 'bg-amber-400',
  error: 'bg-red-400',
} as const)[props.status])
</script>

<template>
  <span
    class="relative flex size-2"
    aria-hidden="true"
    data-testid="live-pulse-indicator"
    :data-status="status"
  >
    <span
      v-if="status === 'live'"
      class="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping"
    />
    <span class="relative inline-flex size-2 rounded-full" :class="dotClass" />
  </span>
</template>
