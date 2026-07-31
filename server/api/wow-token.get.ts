import { createError, defineEventHandler } from 'h3'
import {
  getWowTokenData,
  TokenConfigurationError,
} from '../utils/wow-token-service'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  try {
    return await getWowTokenData(
      {
        clientId: config.battlenetClientId,
        clientSecret: config.battlenetClientSecret,
      },
      $fetch,
    )
  }
  catch (error) {
    if (error instanceof TokenConfigurationError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Battle.net credentials are incomplete',
      })
    }

    throw createError({
      statusCode: 502,
      statusMessage: 'Unable to retrieve the WoW Token price',
    })
  }
})
