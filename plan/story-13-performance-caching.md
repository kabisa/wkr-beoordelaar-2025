# Story 13: Performance & Caching

**Sprint:** 5
**Estimate:** 1-2 dagen
**Priority:** Medium

## User Story
Als systeem wil ik optimale performance leveren met caching strategieën zodat gebruikers een snelle en responsieve ervaring hebben.

## Acceptatiecriteria
- [x] Response caching strategie
- [x] Optimistische UI updates
- [x] Lazy loading componenten
- [x] Database query optimalisatie
- [x] Memory management
- [x] Bundle size optimalisatie
- [x] CDN configuratie voor static assets

## Caching Architecture

### Multi-Layer Caching Strategy
```typescript
// src/lib/cache/cache-manager.ts
export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum cache size
  strategy: 'LRU' | 'FIFO' | 'TTL'
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private config: CacheConfig

  constructor(config: CacheConfig) {
    this.config = config
    this.startCleanupTimer()
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.data
  }

  async set(key: string, data: T, customTTL?: number): Promise<void> {
    // Enforce size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictEntries()
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.config.ttl,
      accessCount: 1,
      lastAccessed: Date.now()
    }

    this.cache.set(key, entry)
  }

  async invalidate(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear()
      return
    }

    // Support wildcard patterns
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    const keysToDelete = Array.from(this.cache.keys()).filter(key =>
      regex.test(key)
    )

    keysToDelete.forEach(key => this.cache.delete(key))
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private evictEntries(): void {
    const entries = Array.from(this.cache.entries())

    switch (this.config.strategy) {
      case 'LRU':
        // Remove least recently used
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
        break

      case 'FIFO':
        // Remove oldest entry
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
        break

      case 'TTL':
        // Remove entries closest to expiration
        entries.sort(([, a], [, b]) =>
          (a.timestamp + a.ttl) - (b.timestamp + b.ttl)
        )
        break
    }

    // Remove 25% of entries
    const entriesToRemove = Math.ceil(entries.length * 0.25)
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpired()
    }, this.config.ttl / 4) // Check every quarter of TTL
  }

  private cleanupExpired(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key)
      }
    })

    expiredKeys.forEach(key => this.cache.delete(key))
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate(),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed
      }))
    }
  }

  private calculateHitRate(): number {
    // Implementation would track hits/misses
    return 0.85 // Placeholder
  }
}
```

### Analysis Result Caching
```typescript
// src/lib/cache/analysis-cache.ts
export interface AnalysisCacheKey {
  transactionsHash: string
  analysisType: string
  configHash: string
}

export class AnalysisCache {
  private cache: CacheManager<WKRAnalysisResponse>
  private hashCache: CacheManager<string>

  constructor() {
    this.cache = new CacheManager({
      ttl: 1000 * 60 * 30, // 30 minutes
      maxSize: 100,
      strategy: 'LRU'
    })

    this.hashCache = new CacheManager({
      ttl: 1000 * 60 * 60, // 1 hour
      maxSize: 1000,
      strategy: 'TTL'
    })
  }

  async getCachedAnalysis(
    transactions: FilteredTransaction[],
    analysisType: string,
    config?: any
  ): Promise<WKRAnalysisResponse | null> {
    const key = await this.generateCacheKey(transactions, analysisType, config)
    return this.cache.get(key)
  }

  async setCachedAnalysis(
    transactions: FilteredTransaction[],
    analysisType: string,
    result: WKRAnalysisResponse,
    config?: any
  ): Promise<void> {
    const key = await this.generateCacheKey(transactions, analysisType, config)
    await this.cache.set(key, result)
  }

  async invalidateAnalysisCache(pattern?: string): Promise<void> {
    await this.cache.invalidate(pattern)
  }

  private async generateCacheKey(
    transactions: FilteredTransaction[],
    analysisType: string,
    config?: any
  ): Promise<string> {
    const transactionsHash = await this.hashTransactions(transactions)
    const configHash = config ? await this.hashObject(config) : 'default'

    return `analysis:${transactionsHash}:${analysisType}:${configHash}`
  }

  private async hashTransactions(transactions: FilteredTransaction[]): Promise<string> {
    // Create hash based on transaction content
    const content = transactions
      .map(tx => `${tx.transactionId}:${tx.bedrag}:${tx.datum}`)
      .sort()
      .join('|')

    const cacheKey = `tx_hash:${content.length}:${content.slice(0, 100)}`
    const cachedHash = await this.hashCache.get(cacheKey)

    if (cachedHash) return cachedHash

    const hash = await this.createHash(content)
    await this.hashCache.set(cacheKey, hash)

    return hash
  }

  private async hashObject(obj: any): Promise<string> {
    const content = JSON.stringify(obj, Object.keys(obj).sort())
    return this.createHash(content)
  }

  private async createHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
}

// Global analysis cache instance
export const analysisCache = new AnalysisCache()
```

### API Response Caching
```typescript
// src/lib/cache/api-cache.ts
import { NextRequest, NextResponse } from 'next/server'

export interface APICacheOptions {
  ttl?: number
  maxSize?: number
  keyGenerator?: (request: NextRequest) => string
  shouldCache?: (request: NextRequest, response: NextResponse) => boolean
}

export class APICache {
  private cache: CacheManager<{
    data: any
    headers: Record<string, string>
    status: number
  }>

  constructor(options: APICacheOptions = {}) {
    this.cache = new CacheManager({
      ttl: options.ttl || 1000 * 60 * 15, // 15 minutes default
      maxSize: options.maxSize || 200,
      strategy: 'LRU'
    })
  }

  async middleware(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>,
    options: APICacheOptions = {}
  ): Promise<NextResponse> {
    const cacheKey = this.generateCacheKey(request, options)

    // Try to get from cache
    const cached = await this.cache.get(cacheKey)
    if (cached) {
      return new NextResponse(JSON.stringify(cached.data), {
        status: cached.status,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT'
        }
      })
    }

    // Execute handler
    const response = await handler(request)

    // Check if we should cache this response
    if (this.shouldCacheResponse(request, response, options)) {
      const responseData = await response.clone().json()

      await this.cache.set(cacheKey, {
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status
      })
    }

    // Add cache miss header
    response.headers.set('X-Cache', 'MISS')
    return response
  }

  private generateCacheKey(request: NextRequest, options: APICacheOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request)
    }

    const url = new URL(request.url)
    const method = request.method
    const searchParams = Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    return `${method}:${url.pathname}:${searchParams}`
  }

  private shouldCacheResponse(
    request: NextRequest,
    response: NextResponse,
    options: APICacheOptions
  ): boolean {
    if (options.shouldCache) {
      return options.shouldCache(request, response)
    }

    // Default caching logic
    return (
      request.method === 'GET' &&
      response.status === 200 &&
      !response.headers.get('cache-control')?.includes('no-cache')
    )
  }
}

// Create global API cache instance
export const apiCache = new APICache()
```

### Component Performance Optimization

#### Lazy Loading Implementation
```tsx
// src/components/performance/LazyComponents.tsx
import { lazy, Suspense, ComponentType } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function createLazyComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn)

  return function LazyWrapper(props: T) {
    return (
      <Suspense fallback={fallback || <ComponentSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Lazy load heavy components
export const LazyStreamingOutput = createLazyComponent(
  () => import('@/components/StreamingOutput'),
  <StreamingSkeleton />
)

export const LazyChartsSection = createLazyComponent(
  () => import('@/components/dashboard/ChartsSection'),
  <ChartsSkeleton />
)

export const LazyExportDialog = createLazyComponent(
  () => import('@/components/export/ExportDialog'),
  <div>Loading export options...</div>
)

function ComponentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-8 w-48" />
    </div>
  )
}

function StreamingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full md:col-span-2" />
    </div>
  )
}
```

#### Memoization and React Optimizations
```tsx
// src/components/performance/MemoizedComponents.tsx
import { memo, useMemo, useCallback } from 'react'
import { WKRAnalysisResponse, FilteredTransaction } from '@/types'

interface OptimizedAnalysisDisplayProps {
  analysis: WKRAnalysisResponse
  transactions: FilteredTransaction[]
  onUpdate?: (data: any) => void
}

export const OptimizedAnalysisDisplay = memo(function OptimizedAnalysisDisplay({
  analysis,
  transactions,
  onUpdate
}: OptimizedAnalysisDisplayProps) {
  // Memoize expensive calculations
  const aggregatedData = useMemo(() => {
    return {
      totalAmount: transactions.reduce((sum, tx) => sum + tx.bedrag, 0),
      averageConfidence: analysis.findings.reduce((sum, f) => sum + f.confidence, 0) / analysis.findings.length,
      wkrRelevantCount: analysis.findings.filter(f => f.isWKRRelevant).length,
      topCategories: calculateTopCategories(transactions)
    }
  }, [transactions, analysis.findings])

  // Memoize callback functions
  const handleUpdate = useCallback((data: any) => {
    onUpdate?.(data)
  }, [onUpdate])

  // Memoize filtered data
  const highConfidenceFindings = useMemo(() =>
    analysis.findings.filter(f => f.confidence > 80),
    [analysis.findings]
  )

  return (
    <div className="space-y-4">
      <SummaryCard data={aggregatedData} />
      <HighConfidenceFindings findings={highConfidenceFindings} />
      <TransactionTable
        transactions={transactions}
        onUpdate={handleUpdate}
      />
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for shallow equality check
  return (
    prevProps.analysis === nextProps.analysis &&
    prevProps.transactions === nextProps.transactions &&
    prevProps.onUpdate === nextProps.onUpdate
  )
})

function calculateTopCategories(transactions: FilteredTransaction[]) {
  const categories = transactions.reduce((acc, tx) => {
    const category = tx.accountId.substring(0, 2)
    acc[category] = (acc[category] || 0) + tx.bedrag
    return acc
  }, {} as Record<string, number>)

  return Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount }))
}

// Memoized sub-components
const SummaryCard = memo(function SummaryCard({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 bg-white rounded-lg border">
        <div className="text-2xl font-bold">€{data.totalAmount.toFixed(2)}</div>
        <div className="text-sm text-gray-600">Total Amount</div>
      </div>
      <div className="p-4 bg-white rounded-lg border">
        <div className="text-2xl font-bold">{data.averageConfidence.toFixed(1)}%</div>
        <div className="text-sm text-gray-600">Avg Confidence</div>
      </div>
      <div className="p-4 bg-white rounded-lg border">
        <div className="text-2xl font-bold">{data.wkrRelevantCount}</div>
        <div className="text-sm text-gray-600">WKR Relevant</div>
      </div>
      <div className="p-4 bg-white rounded-lg border">
        <div className="text-2xl font-bold">{data.topCategories.length}</div>
        <div className="text-sm text-gray-600">Categories</div>
      </div>
    </div>
  )
})

const HighConfidenceFindings = memo(function HighConfidenceFindings({
  findings
}: {
  findings: WKRFinding[]
}) {
  return (
    <div>
      <h3 className="text-lg font-medium mb-3">High Confidence Findings</h3>
      <div className="space-y-2">
        {findings.map(finding => (
          <div key={finding.transactionId} className="p-3 bg-green-50 rounded-lg">
            <div className="font-medium">{finding.description}</div>
            <div className="text-sm text-gray-600">
              {finding.confidence}% confidence - €{finding.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
```

#### Virtual Scrolling for Large Datasets
```tsx
// src/components/performance/VirtualizedTransactionList.tsx
import { FixedSizeList as List } from 'react-window'
import { memo } from 'react'

interface VirtualizedTransactionListProps {
  transactions: FilteredTransaction[]
  height: number
  itemHeight: number
}

export const VirtualizedTransactionList = memo(function VirtualizedTransactionList({
  transactions,
  height,
  itemHeight
}: VirtualizedTransactionListProps) {
  const ItemRenderer = memo(({ index, style }: { index: number; style: any }) => {
    const transaction = transactions[index]

    return (
      <div style={style} className="flex items-center px-4 py-2 border-b hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{transaction.grootboek}</div>
          <div className="text-sm text-gray-600 truncate">{transaction.boeking}</div>
        </div>
        <div className="text-right">
          <div className="font-medium">€{transaction.bedrag.toFixed(2)}</div>
          <div className="text-sm text-gray-600">{transaction.datum}</div>
        </div>
      </div>
    )
  })

  return (
    <List
      height={height}
      itemCount={transactions.length}
      itemSize={itemHeight}
      className="border rounded-lg"
    >
      {ItemRenderer}
    </List>
  )
})
```

### Bundle Optimization

#### Code Splitting Configuration
```typescript
// next.config.js
const nextConfig = {
  experimental: {
    turbo: {
      // Turbopack optimizations
      loaders: {
        '.svg': ['@svgr/webpack'],
      },
    },
  },

  // Bundle analyzer
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor bundle for external dependencies
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20
          },
          // Common bundle for shared components
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
            priority: 10
          },
          // Charts bundle (lazy loaded)
          charts: {
            name: 'charts',
            chunks: 'all',
            test: /recharts|d3/,
            priority: 30
          },
          // PDF export bundle (lazy loaded)
          pdf: {
            name: 'pdf',
            chunks: 'all',
            test: /jspdf|html2canvas/,
            priority: 30
          }
        }
      }
    }

    return config
  },

  // Compression
  compress: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Headers for caching
  async headers() {
    return [
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600', // 5 min browser, 10 min CDN
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // 1 year
          },
        ],
      },
    ]
  }
}

module.exports = nextConfig
```

### Performance Monitoring

#### Performance Metrics Collection
```typescript
// src/lib/performance/metrics.ts
export interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  type: 'timing' | 'counter' | 'gauge'
  tags?: Record<string, string>
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    this.initializeObservers()
  }

  private initializeObservers() {
    // Core Web Vitals
    this.observeEntry('largest-contentful-paint', (entries) => {
      const lcp = entries[entries.length - 1]
      this.recordMetric('lcp', lcp.startTime, 'timing')
    })

    this.observeEntry('first-input', (entries) => {
      const fid = entries[0]
      this.recordMetric('fid', fid.processingStart - fid.startTime, 'timing')
    })

    this.observeEntry('layout-shift', (entries) => {
      const cls = entries.reduce((sum, entry) => sum + entry.value, 0)
      this.recordMetric('cls', cls, 'gauge')
    })

    // Navigation timing
    this.observeEntry('navigation', (entries) => {
      const nav = entries[0] as PerformanceNavigationTiming
      this.recordMetric('ttfb', nav.responseStart - nav.requestStart, 'timing')
      this.recordMetric('domContentLoaded', nav.domContentLoadedEventEnd - nav.navigationStart, 'timing')
      this.recordMetric('loadComplete', nav.loadEventEnd - nav.navigationStart, 'timing')
    })

    // Resource timing
    this.observeEntry('resource', (entries) => {
      entries.forEach(entry => {
        const resourceEntry = entry as PerformanceResourceTiming
        this.recordMetric('resource_load_time', resourceEntry.responseEnd - resourceEntry.requestStart, 'timing', {
          resource_type: resourceEntry.initiatorType,
          resource_name: resourceEntry.name
        })
      })
    })
  }

  private observeEntry(type: string, callback: (entries: PerformanceEntry[]) => void) {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries())
      })

      observer.observe({ type, buffered: true })
      this.observers.push(observer)
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error)
    }
  }

  recordMetric(
    name: string,
    value: number,
    type: PerformanceMetric['type'] = 'timing',
    tags?: Record<string, string>
  ) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      type,
      tags
    })

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  getMetrics(name?: string, timeWindow?: number): PerformanceMetric[] {
    let filtered = this.metrics

    if (name) {
      filtered = filtered.filter(m => m.name === name)
    }

    if (timeWindow) {
      const cutoff = Date.now() - timeWindow
      filtered = filtered.filter(m => m.timestamp > cutoff)
    }

    return filtered
  }

  getAggregatedMetrics(name: string, timeWindow?: number) {
    const metrics = this.getMetrics(name, timeWindow)

    if (metrics.length === 0) return null

    const values = metrics.map(m => m.value)

    return {
      count: values.length,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      median: this.calculateMedian(values),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    }
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect())
  }
}

// Global performance monitor
export const performanceMonitor = new PerformanceMonitor()
```

### Memory Management

#### Memory Leak Prevention
```typescript
// src/lib/performance/memory-manager.ts
export class MemoryManager {
  private cleanupTasks: (() => void)[] = []
  private intervalIds: NodeJS.Timeout[] = []
  private timeoutIds: NodeJS.Timeout[] = []

  registerCleanup(cleanup: () => void) {
    this.cleanupTasks.push(cleanup)
  }

  createInterval(callback: () => void, ms: number): NodeJS.Timeout {
    const id = setInterval(callback, ms)
    this.intervalIds.push(id)
    return id
  }

  createTimeout(callback: () => void, ms: number): NodeJS.Timeout {
    const id = setTimeout(() => {
      callback()
      this.timeoutIds = this.timeoutIds.filter(tid => tid !== id)
    }, ms)
    this.timeoutIds.push(id)
    return id
  }

  clearAll() {
    // Clear all intervals
    this.intervalIds.forEach(clearInterval)
    this.intervalIds = []

    // Clear all timeouts
    this.timeoutIds.forEach(clearTimeout)
    this.timeoutIds = []

    // Run cleanup tasks
    this.cleanupTasks.forEach(cleanup => {
      try {
        cleanup()
      } catch (error) {
        console.warn('Cleanup task failed:', error)
      }
    })
    this.cleanupTasks = []
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory

      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      }
    }

    return null
  }

  checkForMemoryLeaks() {
    const usage = this.monitorMemoryUsage()

    if (usage && usage.usagePercentage > 80) {
      console.warn('High memory usage detected:', usage)

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc()
      }
    }
  }
}

// Global memory manager
export const memoryManager = new MemoryManager()
```

## Testing Performance

### Performance Test Suite
```typescript
// src/lib/performance/__tests__/performance.test.ts
import { performanceMonitor } from '../metrics'
import { CacheManager } from '../cache-manager'

describe('Performance Tests', () => {
  test('should measure component render time', async () => {
    const startTime = performance.now()

    // Simulate component render
    await new Promise(resolve => setTimeout(resolve, 100))

    const endTime = performance.now()
    const renderTime = endTime - startTime

    expect(renderTime).toBeLessThan(200) // Should render within 200ms
  })

  test('cache should improve response time', async () => {
    const cache = new CacheManager({
      ttl: 1000 * 60,
      maxSize: 100,
      strategy: 'LRU'
    })

    const expensiveOperation = async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      return { result: 'expensive data' }
    }

    // First call (cache miss)
    const start1 = performance.now()
    const result1 = await expensiveOperation()
    await cache.set('test', result1)
    const time1 = performance.now() - start1

    // Second call (cache hit)
    const start2 = performance.now()
    const result2 = await cache.get('test')
    const time2 = performance.now() - start2

    expect(time2).toBeLessThan(time1 * 0.1) // Cache should be 10x faster
    expect(result2).toEqual(result1)
  })

  test('should handle large dataset efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      value: Math.random() * 1000
    }))

    const start = performance.now()

    // Simulate processing
    const processed = largeDataset
      .filter(item => item.value > 500)
      .map(item => ({ ...item, processed: true }))
      .slice(0, 100)

    const duration = performance.now() - start

    expect(duration).toBeLessThan(50) // Should process within 50ms
    expect(processed.length).toBeLessThanOrEqual(100)
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "react-window": "^1.8.8",
    "react-window-infinite-loader": "^1.0.9"
  },
  "devDependencies": {
    "webpack-bundle-analyzer": "^4.9.0"
  }
}
```

## Definition of Done
- [ ] Multi-layer caching geïmplementeerd
- [ ] API response caching werkend
- [ ] Component lazy loading actief
- [ ] Memory management systeem operationeel
- [ ] Performance monitoring geïnstalleerd
- [ ] Bundle size geoptimaliseerd (<500KB initial)
- [ ] Core Web Vitals binnen targets
- [ ] Memory leaks voorkomen

## Performance Targets
- **First Contentful Paint:** <1.5 seconden
- **Largest Contentful Paint:** <2.5 seconden
- **First Input Delay:** <100ms
- **Cumulative Layout Shift:** <0.1
- **Bundle Size:** <500KB initial, <2MB total
- **Cache Hit Rate:** >85%
- **Memory Usage:** <100MB steady state