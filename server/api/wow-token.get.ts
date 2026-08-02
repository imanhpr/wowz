import { defineEventHandler } from 'h3'
import type { HttpClient } from '../utils/battlenet'
import { createWowTokenHttpError } from '../utils/wow-token-http-error'
import { getWowTokenRuntime } from '../utils/wow-token-runtime'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const runtime = await getWowTokenRuntime({
    battlenetClientId: config.battlenetClientId,
    battlenetClientSecret: config.battlenetClientSecret,
  }, $fetch as unknown as HttpClient)

  try {
    return await runtime.refresh()
  }
  catch (error) {
    throw createWowTokenHttpError(error)
  }
})
