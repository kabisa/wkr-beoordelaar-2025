export interface FallbackOptions {
  maxRetries?: number
  retryDelay?: number
  retryMultiplier?: number
  timeoutMs?: number
}

export class StreamFallbackHandler {
  private maxRetries: number
  private retryDelay: number
  private retryMultiplier: number
  private timeoutMs: number

  constructor(options: FallbackOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3
    this.retryDelay = options.retryDelay ?? 1000
    this.retryMultiplier = options.retryMultiplier ?? 2
    this.timeoutMs = options.timeoutMs ?? 30000
  }

  async handleStreamWithFallback<T>(
    streamFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T> {
    let lastError: Error

    // Try streaming with retries
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(streamFn(), this.timeoutMs)
        return result
      } catch (error) {
        lastError = error as Error

        if (onRetry) {
          onRetry(attempt + 1, lastError)
        }

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          console.warn('Non-retryable streaming error, falling back:', lastError.message)
          break
        }

        // Don't wait after the last attempt
        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(this.retryMultiplier, attempt)
          console.warn(`Streaming attempt ${attempt + 1} failed, retrying in ${delay}ms:`, lastError.message)
          await this.delay(delay)
        }
      }
    }

    console.warn('All streaming attempts failed, falling back to non-streaming:', lastError!.message)

    // Fallback to non-streaming approach
    try {
      return await this.withTimeout(fallbackFn(), this.timeoutMs * 2) // Give fallback more time
    } catch (fallbackError) {
      throw new Error(
        `Both streaming and fallback failed. ` +
        `Streaming: ${lastError!.message}. ` +
        `Fallback: ${(fallbackError as Error).message}`
      )
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableIndicators = [
      // Network-related errors
      'network',
      'connection',
      'timeout',
      'fetch',
      'aborted',

      // Streaming-specific errors
      'stream',
      'reader',
      'decode',

      // Server errors that might be temporary
      'internal server error',
      'bad gateway',
      'service unavailable',
      'gateway timeout',

      // Rate limiting (might resolve after delay)
      'rate limit',
      'too many requests'
    ]

    const errorMessage = error?.message?.toLowerCase() || ''
    const errorName = error?.name?.toLowerCase() || ''
    const errorCode = error?.code?.toString() || ''

    // Check if error message contains retryable indicators
    const isRetryableMessage = retryableIndicators.some(indicator =>
      errorMessage.includes(indicator)
    )

    // Check specific error types
    const isRetryableType = [
      'networkerror',
      'typeerror', // Often network-related in fetch
      'aborterror' // Only retry if not user-initiated
    ].includes(errorName)

    // Check HTTP status codes
    const isRetryableStatus = [
      '408', // Request Timeout
      '429', // Too Many Requests
      '500', // Internal Server Error
      '502', // Bad Gateway
      '503', // Service Unavailable
      '504', // Gateway Timeout
      '520', // Unknown Error (Cloudflare)
      '521', // Web Server Is Down (Cloudflare)
      '522', // Connection Timed Out (Cloudflare)
      '523', // Origin Is Unreachable (Cloudflare)
      '524'  // A Timeout Occurred (Cloudflare)
    ].includes(errorCode)

    return isRetryableMessage || isRetryableType || isRetryableStatus
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Helper method for creating a fallback-enabled stream handler
  createStreamWithFallback<T>(
    streamFactory: () => Promise<T>,
    fallbackFactory: () => Promise<T>,
    options?: FallbackOptions
  ) {
    const handler = new StreamFallbackHandler(options)

    return {
      execute: (onRetry?: (attempt: number, error: Error) => void) =>
        handler.handleStreamWithFallback(streamFactory, fallbackFactory, onRetry),

      executeWithCallback: (
        onProgress?: (type: 'streaming' | 'fallback', attempt?: number) => void,
        onRetry?: (attempt: number, error: Error) => void
      ) => {
        onProgress?.('streaming')

        return handler.handleStreamWithFallback(
          streamFactory,
          () => {
            onProgress?.('fallback')
            return fallbackFactory()
          },
          onRetry
        )
      }
    }
  }
}

// Utility function for simple fallback scenarios
export async function withStreamFallback<T>(
  streamFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  options?: FallbackOptions
): Promise<T> {
  const handler = new StreamFallbackHandler(options)
  return handler.handleStreamWithFallback(streamFn, fallbackFn)
}

// Enhanced error classification
export class StreamErrorClassifier {
  static classify(error: any): 'retryable' | 'non-retryable' | 'fatal' {
    if (!error) return 'fatal'

    const message = error.message?.toLowerCase() || ''
    const name = error.name?.toLowerCase() || ''
    const status = error.status || error.code

    // Fatal errors - don't retry or fallback
    if (
      message.includes('invalid api key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('quota exceeded') ||
      status === 401 ||
      status === 403
    ) {
      return 'fatal'
    }

    // Non-retryable but fallback possible
    if (
      message.includes('invalid input') ||
      message.includes('bad request') ||
      message.includes('malformed') ||
      status === 400 ||
      status === 422
    ) {
      return 'non-retryable'
    }

    // Default to retryable for network/server issues
    return 'retryable'
  }

  static shouldRetry(error: any): boolean {
    return this.classify(error) === 'retryable'
  }

  static shouldFallback(error: any): boolean {
    const classification = this.classify(error)
    return classification === 'retryable' || classification === 'non-retryable'
  }
}