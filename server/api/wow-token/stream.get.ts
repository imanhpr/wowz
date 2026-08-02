import { createEventStream, defineEventHandler } from 'h3'
import type { HttpClient } from '../../utils/battlenet'
import { createWowTokenHttpError } from '../../utils/wow-token-http-error'
import { getWowTokenRuntime } from '../../utils/wow-token-runtime'
import { attachWowTokenEventStream } from '../../utils/wow-token-sse'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const runtime = await getWowTokenRuntime({
    battlenetClientId: config.battlenetClientId,
    battlenetClientSecret: config.battlenetClientSecret,
  }, $fetch as unknown as HttpClient)

  if (!runtime.stream.hasSnapshot) {
    try {
      await runtime.refresh()
    }
    catch (error) {
      throw createWowTokenHttpError(error)
    }
  }

  const eventStream = createEventStream(event)
  attachWowTokenEventStream(eventStream, runtime.stream)

  return eventStream.send()
})
