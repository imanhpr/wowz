import { createError } from 'h3'
import {
  TokenConfigurationError,
  TokenStorageError,
} from './wow-token-service'

export function createWowTokenHttpError(error: unknown) {
  if (error instanceof TokenConfigurationError) {
    return createError({
      statusCode: 500,
      statusMessage: 'Battle.net credentials are not configured',
    })
  }

  if (error instanceof TokenStorageError) {
    return createError({
      statusCode: 500,
      statusMessage: 'Unable to access the WoW Token price history',
    })
  }

  return createError({
    statusCode: 502,
    statusMessage: 'Unable to retrieve the WoW Token prices',
  })
}
