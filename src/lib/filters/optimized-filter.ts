import { TransactionFilter } from './transaction-filter'
import {
  FilterRules,
  FilteredTransaction,
  FilterError
} from '@/types/filter'
import { XAFTransaction, XAFTransactionLine, XAFAccount } from '@/types/xaf'
import { MemoryManager } from '@/lib/utils/memory-manager'

export class OptimizedTransactionFilter extends TransactionFilter {
  private compiledPatterns: {
    include: RegExp[]
    exclude: RegExp[]
  }
  private memoryManager: MemoryManager

  constructor(rules: FilterRules) {
    super(rules)
    this.compiledPatterns = this.compilePatterns(rules)
    this.memoryManager = MemoryManager.getInstance()
  }

  private compilePatterns(rules: FilterRules) {
    return {
      include: rules.includePatterns.map(pattern =>
        new RegExp(`^${pattern.replace('*', '.*')}$`)
      ),
      exclude: rules.excludePatterns.map(pattern =>
        new RegExp(`^${pattern.replace('*', '.*')}$`)
      )
    }
  }

  // Batch processing for large datasets
  async filterTransactionsBatch(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = [],
    batchSize: number = 1000,
    onProgress?: (progress: number) => void
  ): Promise<FilteredTransaction[]> {
    return this.memoryManager.processWithMemoryCheck(async () => {
      const results: FilteredTransaction[] = []
      const totalBatches = Math.ceil(transactions.length / batchSize)

      for (let i = 0; i < transactions.length; i += batchSize) {
        // Check memory pressure before processing each batch
        if (this.memoryManager.isMemoryPressure()) {
          console.warn('Memory pressure detected during batch filtering, running cleanup...')
          await this.memoryManager.forceGarbageCollection()
        }

        const batch = transactions.slice(i, i + batchSize)
        const filtered = this.filterTransactionsBatchSync(batch, accounts)
        results.push(...filtered)

        // Report progress
        const currentBatch = Math.floor(i / batchSize) + 1
        const progress = (currentBatch / totalBatches) * 100
        onProgress?.(progress)

        // Yield control periodically for large datasets
        if (i % (batchSize * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      return results
    })
  }

  private filterTransactionsBatchSync(
    transactions: XAFTransaction[],
    accounts: XAFAccount[]
  ): FilteredTransaction[] {
    const filtered: FilteredTransaction[] = []

    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        if (this.shouldIncludeLineOptimized(line)) {
          filtered.push({
            ...this.transformToWKRFormat(transaction, line, accounts),
            filterReason: this.getInclusionReason(line)
          })
        }
      }
    }

    return filtered
  }

  // Optimized version using pre-compiled regex patterns
  private shouldIncludeLineOptimized(line: XAFTransactionLine): boolean {
    const accountId = line.accountId

    // Check include patterns using compiled regex
    const includeMatch = this.compiledPatterns.include.some(regex =>
      regex.test(accountId)
    )

    if (!includeMatch) {
      return false
    }

    // Check exclude patterns using compiled regex
    const excludePatternMatch = this.compiledPatterns.exclude.some(regex =>
      regex.test(accountId)
    )

    if (excludePatternMatch) {
      return false
    }

    // Check specific exclusions (direct lookup is faster than regex for exact matches)
    if (this.rules.excludeSpecific.includes(accountId)) {
      return false
    }

    // Check custom rules
    if (this.rules.customRules) {
      for (const rule of this.rules.customRules) {
        if (!rule.condition(line)) {
          return false
        }
      }
    }

    return true
  }

  // Memory-efficient streaming filter
  async *filterTransactionsStream(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = []
  ): AsyncGenerator<FilteredTransaction, void, unknown> {
    let processedCount = 0

    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        if (this.shouldIncludeLineOptimized(line)) {
          yield {
            ...this.transformToWKRFormat(transaction, line, accounts),
            filterReason: this.getInclusionReason(line)
          }
        }

        processedCount++

        // Periodically check memory and yield control
        if (processedCount % 1000 === 0) {
          if (this.memoryManager.isMemoryPressure()) {
            await this.memoryManager.forceGarbageCollection()
          }
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
    }
  }

  // Parallel processing for very large datasets (experimental)
  async filterTransactionsParallel(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = [],
    chunkSize: number = 10000
  ): Promise<FilteredTransaction[]> {
    if (typeof Worker === 'undefined') {
      // Fallback to batch processing if Web Workers not available
      return this.filterTransactionsBatch(transactions, accounts)
    }

    return this.memoryManager.processWithMemoryCheck(async () => {
      const chunks = []
      for (let i = 0; i < transactions.length; i += chunkSize) {
        chunks.push(transactions.slice(i, i + chunkSize))
      }

      // Process chunks in parallel (limited concurrency to prevent memory issues)
      const maxConcurrency = Math.min(4, chunks.length)
      const results: FilteredTransaction[] = []

      for (let i = 0; i < chunks.length; i += maxConcurrency) {
        const currentChunks = chunks.slice(i, i + maxConcurrency)
        const promises = currentChunks.map(chunk =>
          this.filterTransactionsBatch(chunk, accounts, 1000)
        )

        const chunkResults = await Promise.all(promises)
        results.push(...chunkResults.flat())

        // Cleanup between parallel batches
        if (this.memoryManager.isMemoryPressure()) {
          await this.memoryManager.forceGarbageCollection()
        }
      }

      return results
    })
  }

  // Performance monitoring
  async filterWithPerformanceMetrics(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = []
  ): Promise<{
    filtered: FilteredTransaction[]
    metrics: {
      processingTime: number
      transactionsPerSecond: number
      linesProcessed: number
      memoryUsed: number
      peakMemory: number
    }
  }> {
    const startTime = performance.now()
    const initialMemory = this.memoryManager.getMemoryInfo()
    let peakMemory = initialMemory.used

    const filtered = await this.filterTransactionsBatch(transactions, accounts, 1000, () => {
      const currentMemory = this.memoryManager.getMemoryInfo()
      peakMemory = Math.max(peakMemory, currentMemory.used)
    })

    const endTime = performance.now()
    const finalMemory = this.memoryManager.getMemoryInfo()

    const processingTime = endTime - startTime
    const linesProcessed = transactions.reduce((sum, tx) => sum + tx.lines.length, 0)
    const transactionsPerSecond = (linesProcessed / processingTime) * 1000

    return {
      filtered,
      metrics: {
        processingTime,
        transactionsPerSecond,
        linesProcessed,
        memoryUsed: finalMemory.used - initialMemory.used,
        peakMemory: peakMemory - initialMemory.used
      }
    }
  }

  // Cache-friendly account lookup
  private createAccountLookup(accounts: XAFAccount[]): Map<string, XAFAccount> {
    return new Map(accounts.map(account => [account.id, account]))
  }

  // Optimized transform with cached account lookup
  private transformToWKRFormatOptimized(
    transaction: XAFTransaction,
    line: XAFTransactionLine,
    accountLookup: Map<string, XAFAccount>
  ): Omit<FilteredTransaction, 'filterReason'> {
    const account = accountLookup.get(line.accountId)
    const accountName = account?.name || line.accountName || 'Onbekende rekening'

    // Pre-format common parts to avoid repeated string operations
    const grootboek = `${line.accountId} ${accountName}`
    const boeking = `${transaction.transactionNumber} ${transaction.description || 'Geen beschrijving'} - ${transaction.date}`

    return {
      grootboek,
      boeking,
      bedrag: line.amount,
      datum: line.effectiveDate || transaction.date,
      accountId: line.accountId,
      transactionId: transaction.transactionNumber
    }
  }

  // Enhanced batch processing with account lookup optimization
  async filterTransactionsBatchOptimized(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = [],
    batchSize: number = 1000,
    onProgress?: (progress: number) => void
  ): Promise<FilteredTransaction[]> {
    const accountLookup = this.createAccountLookup(accounts)

    return this.memoryManager.processWithMemoryCheck(async () => {
      const results: FilteredTransaction[] = []
      const totalBatches = Math.ceil(transactions.length / batchSize)

      for (let i = 0; i < transactions.length; i += batchSize) {
        if (this.memoryManager.isMemoryPressure()) {
          await this.memoryManager.forceGarbageCollection()
        }

        const batch = transactions.slice(i, i + batchSize)
        const filtered = this.filterBatchWithLookup(batch, accountLookup)
        results.push(...filtered)

        const currentBatch = Math.floor(i / batchSize) + 1
        const progress = (currentBatch / totalBatches) * 100
        onProgress?.(progress)

        if (i % (batchSize * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      return results
    })
  }

  private filterBatchWithLookup(
    transactions: XAFTransaction[],
    accountLookup: Map<string, XAFAccount>
  ): FilteredTransaction[] {
    const filtered: FilteredTransaction[] = []

    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        if (this.shouldIncludeLineOptimized(line)) {
          filtered.push({
            ...this.transformToWKRFormatOptimized(transaction, line, accountLookup),
            filterReason: this.getInclusionReason(line)
          })
        }
      }
    }

    return filtered
  }
}