import { closeWowTokenRuntime, getWowTokenRuntime } from '../utils/wow-token-runtime'
import { startWowTokenScheduler } from '../utils/wow-token-scheduler'
import type { HttpClient } from '../utils/battlenet'

export default defineNitroPlugin(async (nitroApp) => {
  const config = useRuntimeConfig()
  const runtime = await getWowTokenRuntime({
    battlenetClientId: config.battlenetClientId,
    battlenetClientSecret: config.battlenetClientSecret,
  }, $fetch as unknown as HttpClient)
  const stopScheduler = startWowTokenScheduler(() => runtime.refresh())

  nitroApp.hooks.hook('close', async () => {
    stopScheduler()
    await closeWowTokenRuntime()
  })
})
