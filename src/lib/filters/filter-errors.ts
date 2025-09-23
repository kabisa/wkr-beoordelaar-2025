import { FilterError } from '@/types/filter'

export function handleFilterError(error: unknown, context?: any): FilterError {
  if (error instanceof FilterError) {
    return error
  }

  if (error instanceof Error) {
    // Handle specific error patterns
    if (error.message.includes('memory') || error.message.includes('heap')) {
      return new FilterError(
        'Onvoldoende geheugen beschikbaar voor filteren. Probeer een kleiner bestand of gebruik batch processing.',
        'MEMORY_ERROR',
        { ...context, originalError: error.message }
      )
    }

    if (error.message.includes('timeout')) {
      return new FilterError(
        'Filteren duurt te lang. Probeer een kleiner bestand of gebruik geoptimaliseerde filtering.',
        'TIMEOUT_ERROR',
        { ...context, originalError: error.message }
      )
    }

    if (error.message.includes('Invalid') || error.message.includes('invalid')) {
      return new FilterError(
        `Ongeldige data: ${error.message}`,
        'INVALID_DATA_ERROR',
        { ...context, originalError: error.message }
      )
    }

    if (error.message.includes('pattern') || error.message.includes('regex')) {
      return new FilterError(
        'Ongeldig filter pattern. Controleer de syntax van uw filter regels.',
        'INVALID_PATTERN_ERROR',
        { ...context, originalError: error.message }
      )
    }

    // Generic error
    return new FilterError(
      `Filter fout: ${error.message}`,
      'FILTER_ERROR',
      { ...context, originalError: error.message }
    )
  }

  return new FilterError(
    'Onbekende fout bij filteren van transacties',
    'UNKNOWN_FILTER_ERROR',
    { ...context, error: String(error) }
  )
}

export function createUserFriendlyFilterError(error: FilterError): string {
  const errorMessages: Record<string, string> = {
    'MEMORY_ERROR': 'Het bestand is te groot om in één keer te filteren. Probeer de geoptimaliseerde filtering of upload een kleiner bestand.',
    'TIMEOUT_ERROR': 'Het filteren duurt te lang. Probeer de snelle filtering optie of upload een kleiner bestand.',
    'INVALID_DATA_ERROR': 'De transactie data bevat ongeldige gegevens. Controleer of het een geldig XAF bestand is.',
    'INVALID_PATTERN_ERROR': 'De filter regels bevatten ongeldige patronen. Controleer de syntax van uw include/exclude patronen.',
    'FILTER_PROCESSING_ERROR': 'Er is een fout opgetreden tijdens het filteren. Probeer het opnieuw met andere filter instellingen.',
    'CONFIG_SAVE_ERROR': 'De filter configuratie kon niet worden opgeslagen. Controleer de browser opslag instellingen.',
    'CONFIG_LOAD_ERROR': 'De filter configuratie kon niet worden geladen. Het bestand is mogelijk beschadigd.',
    'CONFIG_IMPORT_ERROR': 'Het importeren van de configuratie is mislukt. Controleer of het een geldig configuratie bestand is.',
    'CONFIG_EXPORT_ERROR': 'Het exporteren van de configuratie is mislukt. Probeer het opnieuw.',
    'INVALID_CONFIG_NAME': 'De configuratie naam is ongeldig. Gebruik alleen letters, cijfers en spaties.',
    'MISSING_FILTER_RULES': 'De configuratie bevat geen filter regels. Voeg minimaal één include pattern toe.',
    'MISSING_INCLUDE_PATTERNS': 'Er moet minimaal één include pattern worden opgegeven.',
    'INVALID_PATTERN': 'Een van de filter patronen is ongeldig. Gebruik alleen letters, cijfers en * voor wildcards.',
    'INVALID_CUSTOM_RULE': 'Een van de aangepaste regels is ongeldig. Controleer de regel definitie.',
    'FILTER_ERROR': 'Er is een algemene fout opgetreden bij het filteren.',
    'UNKNOWN_FILTER_ERROR': 'Er is een onbekende fout opgetreden. Probeer het opnieuw of neem contact op met support.'
  }

  return errorMessages[error.code] || error.message || 'Er is een onbekende fout opgetreden.'
}

export function logFilterError(error: FilterError, context?: any): void {
  const logData = {
    timestamp: new Date().toISOString(),
    errorCode: error.code,
    errorMessage: error.message,
    context: error.context || context,
    stack: error.stack
  }

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Filter Error:', logData)
  }

  // In production, you might want to send to a logging service
  // Example: sendToLoggingService(logData)
}

export class FilterValidationError extends FilterError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', { field, value })
    this.name = 'FilterValidationError'
  }
}

export class FilterPerformanceError extends FilterError {
  constructor(message: string, metrics?: any) {
    super(message, 'PERFORMANCE_ERROR', { metrics })
    this.name = 'FilterPerformanceError'
  }
}

export class FilterConfigurationError extends FilterError {
  constructor(message: string, configName?: string) {
    super(message, 'CONFIGURATION_ERROR', { configName })
    this.name = 'FilterConfigurationError'
  }
}

// Error recovery utilities
export class FilterErrorRecovery {
  static async retryWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Filter operation failed (attempt ${i + 1}/${maxRetries}):`, error)

        // Wait before retry (exponential backoff)
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
        }
      }
    }

    // If all retries failed, try fallback
    try {
      console.log('Attempting fallback operation...')
      return await fallbackOperation()
    } catch (fallbackError) {
      // If fallback also fails, throw the original error
      throw handleFilterError(lastError, {
        fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
        retriesAttempted: maxRetries
      })
    }
  }

  static createSafeFilter<T, R>(
    filterFunction: (data: T) => R,
    fallbackValue: R
  ): (data: T) => R {
    return (data: T) => {
      try {
        return filterFunction(data)
      } catch (error) {
        console.warn('Filter function failed, returning fallback:', error)
        logFilterError(handleFilterError(error, { data }))
        return fallbackValue
      }
    }
  }

  static validateFilterInput(
    transactions: any[],
    accounts?: any[]
  ): void {
    if (!Array.isArray(transactions)) {
      throw new FilterValidationError(
        'Transacties moet een array zijn',
        'transactions',
        typeof transactions
      )
    }

    if (transactions.length === 0) {
      throw new FilterValidationError(
        'Geen transacties om te filteren',
        'transactions',
        transactions.length
      )
    }

    if (accounts && !Array.isArray(accounts)) {
      throw new FilterValidationError(
        'Accounts moet een array zijn',
        'accounts',
        typeof accounts
      )
    }

    // Validate transaction structure
    const firstTransaction = transactions[0]
    if (!firstTransaction || typeof firstTransaction !== 'object') {
      throw new FilterValidationError(
        'Ongeldige transactie structuur',
        'transaction[0]',
        firstTransaction
      )
    }

    if (!Array.isArray(firstTransaction.lines)) {
      throw new FilterValidationError(
        'Transactie moet een lines array hebben',
        'transaction.lines',
        firstTransaction.lines
      )
    }
  }

  static createPerformanceMonitor(operationName: string) {
    const startTime = performance.now()
    let startMemory: number | undefined

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      startMemory = (performance as any).memory?.usedJSHeapSize
    }

    return {
      end: () => {
        const endTime = performance.now()
        const duration = endTime - startTime

        let memoryDelta: number | undefined
        if (startMemory && typeof performance !== 'undefined' && 'memory' in performance) {
          const endMemory = (performance as any).memory?.usedJSHeapSize
          memoryDelta = endMemory - startMemory
        }

        const metrics = {
          operation: operationName,
          duration,
          memoryDelta,
          timestamp: new Date().toISOString()
        }

        // Log performance warnings
        if (duration > 10000) { // > 10 seconds
          console.warn('Slow filter operation detected:', metrics)
        }

        if (memoryDelta && memoryDelta > 50 * 1024 * 1024) { // > 50MB
          console.warn('High memory usage detected:', metrics)
        }

        return metrics
      }
    }
  }
}

// Utility for creating safe async operations
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorContext?: any
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const filterError = handleFilterError(error, {
        ...errorContext,
        functionName: fn.name,
        arguments: args
      })

      logFilterError(filterError)
      throw filterError
    }
  }
}

// Utility for creating safe sync operations
export function withSyncErrorHandling<T extends any[], R>(
  fn: (...args: T) => R,
  errorContext?: any
) {
  return (...args: T): R => {
    try {
      return fn(...args)
    } catch (error) {
      const filterError = handleFilterError(error, {
        ...errorContext,
        functionName: fn.name,
        arguments: args
      })

      logFilterError(filterError)
      throw filterError
    }
  }
}