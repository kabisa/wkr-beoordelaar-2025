import { XAFParseError, XAFValidationError } from '@/types/xaf'

export function handleParsingError(error: unknown, context?: any): XAFParseError {
  if (error instanceof XAFParseError) {
    return error
  }

  if (error instanceof XAFValidationError) {
    return new XAFParseError(
      `Validatiefout: ${error.message}`,
      'VALIDATION_ERROR',
      error,
      context
    )
  }

  if (error instanceof Error) {
    // Handle specific error patterns
    if (error.message.includes('XML')) {
      return new XAFParseError(
        'Ongeldig XML bestand. Controleer of het bestand niet beschadigd is.',
        'INVALID_XML',
        error,
        context
      )
    }

    if (error.message.includes('namespace')) {
      return new XAFParseError(
        'Ongeldig XAF bestand. Controleer of het een geldig XAF formaat heeft.',
        'INVALID_NAMESPACE',
        error,
        context
      )
    }

    if (error.message.includes('memory') || error.message.includes('size')) {
      return new XAFParseError(
        'Bestand is te groot om te verwerken. Probeer een kleiner bestand.',
        'FILE_TOO_LARGE',
        error,
        context
      )
    }

    if (error.message.includes('timeout')) {
      return new XAFParseError(
        'Verwerking duurt te lang. Probeer een kleiner bestand.',
        'PROCESSING_TIMEOUT',
        error,
        context
      )
    }

    // Generic error
    return new XAFParseError(
      `Parsing fout: ${error.message}`,
      'PARSE_ERROR',
      error,
      context
    )
  }

  return new XAFParseError(
    'Onbekende fout bij het verwerken van het XAF bestand.',
    'UNKNOWN_ERROR',
    error instanceof Error ? error : new Error(String(error)),
    context
  )
}

export function createUserFriendlyError(error: XAFParseError): string {
  const errorMessages: Record<string, string> = {
    'FILE_TOO_LARGE': 'Het bestand is te groot. Upload een bestand kleiner dan 100MB.',
    'INVALID_XML': 'Het bestand is geen geldig XML bestand. Controleer of het bestand niet beschadigd is.',
    'INVALID_NAMESPACE': 'Dit is geen geldig XAF bestand. Controleer of u het juiste bestandsformaat heeft geüpload.',
    'VALIDATION_ERROR': 'Het XAF bestand bevat ongeldige gegevens. Controleer de inhoud van het bestand.',
    'PROCESSING_TIMEOUT': 'Het verwerken van het bestand duurt te lang. Probeer een kleiner bestand.',
    'PARSE_ERROR': 'Er is een fout opgetreden bij het lezen van het bestand. Controleer of het bestand geldig is.',
    'UNKNOWN_ERROR': 'Er is een onbekende fout opgetreden. Probeer het opnieuw of neem contact op met support.'
  }

  return errorMessages[error.code] || error.message || 'Er is een onbekende fout opgetreden.'
}

export function logParsingError(error: XAFParseError, fileName?: string): void {
  const logData = {
    timestamp: new Date().toISOString(),
    fileName,
    errorCode: error.code,
    errorMessage: error.message,
    originalError: error.originalError?.message,
    context: error.context
  }

  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('XAF Parsing Error:', logData)
    if (error.originalError) {
      console.error('Original Error Stack:', error.originalError.stack)
    }
  }

  // In production, you might want to send to a logging service
  // Example: sendToLoggingService(logData)
}

export class XAFProcessingStats {
  private static instance: XAFProcessingStats
  private stats: {
    totalFiles: number
    successfulParsing: number
    failedParsing: number
    errorCounts: Record<string, number>
    averageParseTime: number
    averageFileSize: number
  } = {
    totalFiles: 0,
    successfulParsing: 0,
    failedParsing: 0,
    errorCounts: {},
    averageParseTime: 0,
    averageFileSize: 0
  }

  static getInstance(): XAFProcessingStats {
    if (!XAFProcessingStats.instance) {
      XAFProcessingStats.instance = new XAFProcessingStats()
    }
    return XAFProcessingStats.instance
  }

  recordSuccess(parseTime: number, fileSize: number): void {
    this.stats.totalFiles++
    this.stats.successfulParsing++

    // Update averages
    this.stats.averageParseTime =
      (this.stats.averageParseTime * (this.stats.successfulParsing - 1) + parseTime) / this.stats.successfulParsing

    this.stats.averageFileSize =
      (this.stats.averageFileSize * (this.stats.successfulParsing - 1) + fileSize) / this.stats.successfulParsing
  }

  recordError(error: XAFParseError): void {
    this.stats.totalFiles++
    this.stats.failedParsing++

    if (!this.stats.errorCounts[error.code]) {
      this.stats.errorCounts[error.code] = 0
    }
    this.stats.errorCounts[error.code]++
  }

  getStats() {
    return { ...this.stats }
  }

  getSuccessRate(): number {
    if (this.stats.totalFiles === 0) return 100
    return (this.stats.successfulParsing / this.stats.totalFiles) * 100
  }

  getMostCommonErrors(): Array<{ code: string; count: number; percentage: number }> {
    const total = this.stats.failedParsing
    if (total === 0) return []

    return Object.entries(this.stats.errorCounts)
      .map(([code, count]) => ({
        code,
        count,
        percentage: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count)
  }
}