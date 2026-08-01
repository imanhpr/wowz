<template>
  <span
    class="relative flex size-2"
    aria-hidden="true"
    data-testid="live-pulse-indicator"
  >
    <span class="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-70 motion-safe:animate-ping" />
    <span class="relative inline-flex size-2 rounded-full bg-emerald-400" />
  </span>
</template>
