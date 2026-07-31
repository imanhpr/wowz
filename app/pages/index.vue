<script setup lang="ts">
import type { WowTokenResponse } from '../../shared/types/wow-token'

const { data, status, error, refresh } = await useFetch<WowTokenResponse>('/api/wow-token')
</script>

<template>
  <TokenDashboard
    :data="data"
    :status="status"
    :error="Boolean(error)"
    @retry="refresh"
  />
</template>
