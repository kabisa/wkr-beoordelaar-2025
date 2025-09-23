export class GeminiError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

export class RetryableGeminiError extends GeminiError {
  constructor(message: string, code: string, originalError?: any, public retryAfter?: number) {
    super(message, code, originalError)
    this.name = 'RetryableGeminiError'
  }
}

export const GEMINI_ERROR_CODES = {
  INVALID_API_KEY: 'INVALID_API_KEY',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  GENERATION_ERROR: 'GENERATION_ERROR',
  STREAMING_ERROR: 'STREAMING_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const

export type GeminiErrorCode = typeof GEMINI_ERROR_CODES[keyof typeof GEMINI_ERROR_CODES]

export function createGeminiError(error: any): GeminiError {
  const message = error?.message || 'Unknown error occurred'

  // Check for specific Google AI errors
  if (message.includes('API key')) {
    return new GeminiError('Invalid API key', GEMINI_ERROR_CODES.INVALID_API_KEY, error)
  }

  if (message.includes('quota') || message.includes('limit')) {
    return new RetryableGeminiError(
      'Rate limit or quota exceeded',
      GEMINI_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      error,
      60000 // Retry after 1 minute
    )
  }

  if (message.includes('model')) {
    return new GeminiError('Model not found or not available', GEMINI_ERROR_CODES.MODEL_NOT_FOUND, error)
  }

  if (message.includes('network') || message.includes('connection')) {
    return new RetryableGeminiError(
      'Network connection error',
      GEMINI_ERROR_CODES.CONNECTION_ERROR,
      error,
      5000 // Retry after 5 seconds
    )
  }

  if (message.includes('timeout')) {
    return new RetryableGeminiError(
      'Request timeout',
      GEMINI_ERROR_CODES.TIMEOUT_ERROR,
      error,
      10000 // Retry after 10 seconds
    )
  }

  // Default to unknown error
  return new GeminiError(message, GEMINI_ERROR_CODES.UNKNOWN_ERROR, error)
}