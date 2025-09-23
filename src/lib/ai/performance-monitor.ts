interface PerformanceMetrics {
  requestId: string
  analysisType: string
  startTime: number
  endTime?: number
  duration?: number
  tokensUsed?: number
  transactionCount: number
  success: boolean
  error?: string
  memoryUsage?: NodeJS.MemoryUsage
}

interface AggregatedStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageDuration: number
  averageTokensUsed: number
  totalTokensUsed: number
  successRate: number
  popularAnalysisTypes: { [key: string]: number }
  errorTypes: { [key: string]: number }
  averageTransactionCount: number
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxStoredMetrics = 1000 // Keep last 1000 requests

  startRequest(analysisType: string, transactionCount: number): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const metric: PerformanceMetrics = {
      requestId,
      analysisType,
      startTime: performance.now(),
      transactionCount,
      success: false,
      memoryUsage: process.memoryUsage()
    }

    this.metrics.push(metric)
    this.cleanup()

    return requestId
  }

  endRequest(requestId: string, success: boolean, tokensUsed?: number, error?: string): void {
    const metric = this.metrics.find(m => m.requestId === requestId)

    if (!metric) {
      console.warn(`Performance metric not found for request: ${requestId}`)
      return
    }

    metric.endTime = performance.now()
    metric.duration = metric.endTime - metric.startTime
    metric.success = success
    metric.tokensUsed = tokensUsed
    metric.error = error
  }

  getStats(): AggregatedStats {
    const completedMetrics = this.metrics.filter(m => m.endTime !== undefined)

    if (completedMetrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageDuration: 0,
        averageTokensUsed: 0,
        totalTokensUsed: 0,
        successRate: 0,
        popularAnalysisTypes: {},
        errorTypes: {},
        averageTransactionCount: 0
      }
    }

    const successfulMetrics = completedMetrics.filter(m => m.success)
    const failedMetrics = completedMetrics.filter(m => !m.success)

    const totalDuration = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
    const totalTokens = completedMetrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0)
    const tokensUsedMetrics = completedMetrics.filter(m => m.tokensUsed !== undefined)
    const totalTransactionCount = completedMetrics.reduce((sum, m) => sum + m.transactionCount, 0)

    // Analysis type popularity
    const analysisTypes: { [key: string]: number } = {}
    completedMetrics.forEach(m => {
      analysisTypes[m.analysisType] = (analysisTypes[m.analysisType] || 0) + 1
    })

    // Error types
    const errorTypes: { [key: string]: number } = {}
    failedMetrics.forEach(m => {
      if (m.error) {
        errorTypes[m.error] = (errorTypes[m.error] || 0) + 1
      }
    })

    return {
      totalRequests: completedMetrics.length,
      successfulRequests: successfulMetrics.length,
      failedRequests: failedMetrics.length,
      averageDuration: totalDuration / completedMetrics.length,
      averageTokensUsed: tokensUsedMetrics.length > 0 ? totalTokens / tokensUsedMetrics.length : 0,
      totalTokensUsed: totalTokens,
      successRate: (successfulMetrics.length / completedMetrics.length) * 100,
      popularAnalysisTypes: analysisTypes,
      errorTypes,
      averageTransactionCount: totalTransactionCount / completedMetrics.length
    }
  }

  getRecentMetrics(limit: number = 10): PerformanceMetrics[] {
    return this.metrics
      .filter(m => m.endTime !== undefined)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      .slice(0, limit)
  }

  getMetricsByAnalysisType(analysisType: string): PerformanceMetrics[] {
    return this.metrics.filter(m => m.analysisType === analysisType && m.endTime !== undefined)
  }

  getSlowRequests(thresholdMs: number = 5000): PerformanceMetrics[] {
    return this.metrics.filter(m =>
      m.endTime !== undefined &&
      (m.duration || 0) > thresholdMs
    ).sort((a, b) => (b.duration || 0) - (a.duration || 0))
  }

  getTokenUsageByDay(): { [date: string]: number } {
    const usage: { [date: string]: number } = {}

    this.metrics
      .filter(m => m.tokensUsed !== undefined)
      .forEach(m => {
        const date = new Date(m.startTime).toISOString().split('T')[0]
        usage[date] = (usage[date] || 0) + (m.tokensUsed || 0)
      })

    return usage
  }

  private cleanup(): void {
    if (this.metrics.length > this.maxStoredMetrics) {
      // Remove oldest metrics, keep most recent
      this.metrics = this.metrics
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, this.maxStoredMetrics)
    }
  }

  reset(): void {
    this.metrics = []
  }

  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics]
  }
}

export class GlobalPerformanceMonitor {
  private static instance: PerformanceMonitor

  static getInstance(): PerformanceMonitor {
    if (!GlobalPerformanceMonitor.instance) {
      GlobalPerformanceMonitor.instance = new PerformanceMonitor()
    }

    return GlobalPerformanceMonitor.instance
  }

  static reset(): void {
    GlobalPerformanceMonitor.instance = new PerformanceMonitor()
  }
}

export const createPerformanceMiddleware = () => {
  return {
    beforeRequest: (analysisType: string, transactionCount: number) => {
      const monitor = GlobalPerformanceMonitor.getInstance()
      return monitor.startRequest(analysisType, transactionCount)
    },

    afterRequest: (requestId: string, success: boolean, tokensUsed?: number, error?: string) => {
      const monitor = GlobalPerformanceMonitor.getInstance()
      monitor.endRequest(requestId, success, tokensUsed, error)
    },

    getStats: () => {
      const monitor = GlobalPerformanceMonitor.getInstance()
      return monitor.getStats()
    }
  }
}