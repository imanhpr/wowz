import { defineEventHandler } from 'h3'
import type { HttpClient } from '../utils/battlenet'
import { createWowTokenHttpError } from '../utils/wow-token-http-error'
import { getWowTokenRuntime } from '../utils/wow-token-runtime'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const runtime = getWowTokenRuntime({
    battlenetClientId: config.battlenetClientId,
    battlenetClientSecret: config.battlenetClientSecret,
    sqlitePath: config.sqlitePath,
  }, $fetch as unknown as HttpClient)

  try {
    return await runtime.service.getDashboardData()
  }
  catch (error) {
    throw createWowTokenHttpError(error)
  }
})
