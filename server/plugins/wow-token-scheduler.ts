import { closeWowTokenRuntime, getWowTokenRuntime } from '../utils/wow-token-runtime'
import { startWowTokenScheduler } from '../utils/wow-token-scheduler'
import type { HttpClient } from '../utils/battlenet'

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()
  const runtime = getWowTokenRuntime({
    battlenetClientId: config.battlenetClientId,
    battlenetClientSecret: config.battlenetClientSecret,
    sqlitePath: config.sqlitePath,
  }, $fetch as unknown as HttpClient)
  const stopScheduler = startWowTokenScheduler(() => runtime.service.collect())

  nitroApp.hooks.hook('close', () => {
    stopScheduler()
    closeWowTokenRuntime()
  })
})
