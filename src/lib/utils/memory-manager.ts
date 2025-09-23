// Memory management utilities for large file processing

export interface MemoryInfo {
  used: number
  total: number
  percentage: number
  available: number
}

export class MemoryManager {
  private static instance: MemoryManager
  private cleanupTasks: Array<() => void> = []
  private memoryThreshold = 0.8 // 80% memory usage threshold

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  getMemoryInfo(): MemoryInfo {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // Server-side memory info
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: (usage.heapUsed / usage.heapTotal) * 100,
        available: usage.heapTotal - usage.heapUsed
      }
    }

    // Client-side estimation (limited info available)
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize || 0,
        total: memory.totalJSHeapSize || 0,
        percentage: memory.usedJSHeapSize ? (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100 : 0,
        available: (memory.totalJSHeapSize || 0) - (memory.usedJSHeapSize || 0)
      }
    }

    return { used: 0, total: 0, percentage: 0, available: 0 }
  }

  isMemoryPressure(): boolean {
    const info = this.getMemoryInfo()
    return info.percentage > this.memoryThreshold * 100
  }

  registerCleanupTask(task: () => void): void {
    this.cleanupTasks.push(task)
  }

  async forceGarbageCollection(): Promise<void> {
    // Run cleanup tasks
    this.cleanupTasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.warn('Cleanup task failed:', error)
      }
    })

    // Clear cleanup tasks array
    this.cleanupTasks = []

    // Trigger garbage collection if available (Node.js with --expose-gc flag)
    if (typeof global !== 'undefined' && global.gc) {
      global.gc()
    }

    // For browsers, try to suggest garbage collection
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      return new Promise(resolve => {
        window.requestIdleCallback(() => {
          // Create and destroy some objects to hint at GC
          const temp = new Array(1000).fill(null)
          temp.length = 0
          resolve()
        })
      })
    }
  }

  async processWithMemoryCheck<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let retries = 0

    while (retries < maxRetries) {
      try {
        // Check memory before operation
        if (this.isMemoryPressure()) {
          console.warn('Memory pressure detected, running cleanup...')
          await this.forceGarbageCollection()

          // Wait a bit for GC to complete
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        const result = await operation()
        return result

      } catch (error) {
        retries++

        if (retries >= maxRetries) {
          throw error
        }

        // If error might be memory-related, clean up and retry
        if (error instanceof Error && (
          error.message.includes('memory') ||
          error.message.includes('heap') ||
          error.message.includes('allocation')
        )) {
          console.warn(`Memory-related error on attempt ${retries}, cleaning up...`)
          await this.forceGarbageCollection()
          await new Promise(resolve => setTimeout(resolve, 200 * retries))
        } else {
          throw error
        }
      }
    }

    throw new Error('Max retries exceeded')
  }

  createLargeDataCleaner<T>(data: T[]): () => void {
    return () => {
      if (Array.isArray(data)) {
        data.length = 0
      }
    }
  }

  wrapWithMemoryMonitoring<T extends (...args: any[]) => any>(
    fn: T,
    name: string
  ): T {
    return ((...args: any[]) => {
      const beforeMemory = this.getMemoryInfo()

      const result = fn(...args)

      // For async functions
      if (result instanceof Promise) {
        return result.then(value => {
          const afterMemory = this.getMemoryInfo()
          const memoryDiff = afterMemory.used - beforeMemory.used

          if (memoryDiff > 10 * 1024 * 1024) { // 10MB increase
            console.warn(`Function ${name} increased memory by ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`)
          }

          return value
        })
      }

      // For sync functions
      const afterMemory = this.getMemoryInfo()
      const memoryDiff = afterMemory.used - beforeMemory.used

      if (memoryDiff > 10 * 1024 * 1024) { // 10MB increase
        console.warn(`Function ${name} increased memory by ${(memoryDiff / 1024 / 1024).toFixed(2)}MB`)
      }

      return result
    }) as T
  }
}

// Utility function for cleanup
export function createDataCleanup<T>(data: T): () => void {
  const manager = MemoryManager.getInstance()

  if (Array.isArray(data)) {
    return manager.createLargeDataCleaner(data)
  }

  if (typeof data === 'object' && data !== null) {
    return () => {
      // Clear object properties
      Object.keys(data).forEach(key => {
        delete (data as any)[key]
      })
    }
  }

  return () => {} // No-op for primitive types
}

// Hook for React components
export function useMemoryManager() {
  const manager = MemoryManager.getInstance()

  return {
    memoryInfo: manager.getMemoryInfo(),
    isMemoryPressure: manager.isMemoryPressure(),
    forceCleanup: () => manager.forceGarbageCollection(),
    createCleanup: createDataCleanup
  }
}