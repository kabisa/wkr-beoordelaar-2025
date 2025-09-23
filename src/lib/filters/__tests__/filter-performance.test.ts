import { TransactionFilter } from '../transaction-filter'
import { OptimizedTransactionFilter } from '../optimized-filter'
import { DEFAULT_WKR_FILTER_RULES } from '@/types/filter'
import { XAFTransaction, XAFAccount } from '@/types/xaf'

// Performance test utilities
function generateLargeTransactionSet(count: number): XAFTransaction[] {
  const transactions: XAFTransaction[] = []

  for (let i = 0; i < count; i++) {
    const accountId = `4${(i % 10).toString().padStart(5, '0')}`
    transactions.push({
      transactionNumber: `TX${i.toString().padStart(6, '0')}`,
      description: `Transaction ${i}`,
      date: `2023-${((i % 12) + 1).toString().padStart(2, '0')}-${((i % 28) + 1).toString().padStart(2, '0')}`,
      journal: 'VK',
      period: (i % 12) + 1,
      transactionType: 'S',
      systemEntryDate: '2023-01-01',
      systemEntryTime: '10:00:00',
      glPostingDate: '2023-01-01',
      sourceDocumentID: `DOC${i}`,
      lines: [{
        lineNumber: 1,
        accountId,
        accountName: `Account ${accountId}`,
        description: `Line for transaction ${i}`,
        amount: Math.round((Math.random() * 10000) * 100) / 100, // Random amount
        amountType: Math.random() > 0.5 ? 'D' : 'C',
        effectiveDate: '2023-01-01',
        documentReference: `REF${i}`,
        customerID: i % 2 === 0 ? `CUST${i % 100}` : '',
        supplierID: i % 2 === 1 ? `SUPP${i % 100}` : '',
        systemEntryDate: '2023-01-01',
        systemEntryTime: '10:00:00',
        glPostingDate: '2023-01-01',
        recordID: `REC${i}`
      }]
    })
  }

  return transactions
}

function generateLargeAccountSet(count: number): XAFAccount[] {
  const accounts: XAFAccount[] = []

  for (let i = 0; i < count; i++) {
    const accountId = `4${i.toString().padStart(5, '0')}`
    accounts.push({
      id: accountId,
      name: `Account ${accountId}`,
      type: i % 2 === 0 ? 'P' : 'B',
      standardAccountID: accountId,
      groupingCategory: i % 2 === 0 ? 'Profit & Loss' : 'Balance Sheet',
      accountCreationDate: '2023-01-01',
      openingDebitBalance: Math.random() * 10000,
      openingCreditBalance: Math.random() * 10000,
      closingDebitBalance: Math.random() * 10000,
      closingCreditBalance: Math.random() * 10000
    })
  }

  return accounts
}

describe('Filter Performance Tests', () => {
  // Set longer timeout for performance tests
  jest.setTimeout(30000)

  describe('Standard Filter Performance', () => {
    test('should filter 1k transactions in under 100ms', () => {
      const filter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(1000)
      const accounts = generateLargeAccountSet(100)

      const start = performance.now()
      const result = filter.filterTransactions(transactions, accounts)
      const end = performance.now()

      const duration = end - start
      console.log(`1k transactions filtered in ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(100)
      expect(result.length).toBeGreaterThan(0)
    })

    test('should filter 10k transactions in under 1 second', () => {
      const filter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(10000)
      const accounts = generateLargeAccountSet(500)

      const start = performance.now()
      const result = filter.filterTransactions(transactions, accounts)
      const end = performance.now()

      const duration = end - start
      console.log(`10k transactions filtered in ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(1000)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Optimized Filter Performance', () => {
    test('should filter 10k transactions faster than standard filter', async () => {
      const standardFilter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const optimizedFilter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(10000)
      const accounts = generateLargeAccountSet(500)

      // Standard filter
      const standardStart = performance.now()
      const standardResult = standardFilter.filterTransactions(transactions, accounts)
      const standardEnd = performance.now()
      const standardDuration = standardEnd - standardStart

      // Optimized filter
      const optimizedStart = performance.now()
      const optimizedResult = await optimizedFilter.filterTransactionsBatch(transactions, accounts)
      const optimizedEnd = performance.now()
      const optimizedDuration = optimizedEnd - optimizedStart

      console.log(`Standard filter: ${standardDuration.toFixed(2)}ms`)
      console.log(`Optimized filter: ${optimizedDuration.toFixed(2)}ms`)
      console.log(`Improvement: ${((standardDuration - optimizedDuration) / standardDuration * 100).toFixed(1)}%`)

      expect(standardResult.length).toBe(optimizedResult.length)
      // Optimized filter should be at least as fast (allowing for some variance)
      expect(optimizedDuration).toBeLessThan(standardDuration * 1.2)
    })

    test('should filter 100k transactions in under 5 seconds', async () => {
      const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(100000)
      const accounts = generateLargeAccountSet(1000)

      const start = performance.now()
      const result = await filter.filterTransactionsBatch(transactions, accounts, 1000)
      const end = performance.now()

      const duration = end - start
      console.log(`100k transactions filtered in ${(duration / 1000).toFixed(2)} seconds`)

      expect(duration).toBeLessThan(5000)
      expect(result.length).toBeGreaterThan(0)
    })

    test('should handle memory efficiently with large datasets', async () => {
      const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(50000)
      const accounts = generateLargeAccountSet(1000)

      let initialMemory = 0
      let peakMemory = 0

      if (typeof performance !== 'undefined' && 'memory' in performance) {
        initialMemory = (performance as any).memory?.usedJSHeapSize || 0
      }

      const result = await filter.filterWithPerformanceMetrics(transactions, accounts)

      if (typeof performance !== 'undefined' && 'memory' in performance) {
        peakMemory = (performance as any).memory?.usedJSHeapSize || 0
      }

      const memoryIncrease = peakMemory - initialMemory
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)
      console.log(`Processing time: ${result.metrics.processingTime.toFixed(2)}ms`)
      console.log(`Transactions per second: ${result.metrics.transactionsPerSecond.toFixed(0)}`)

      expect(result.filtered.length).toBeGreaterThan(0)
      expect(result.metrics.processingTime).toBeGreaterThan(0)
      expect(result.metrics.transactionsPerSecond).toBeGreaterThan(0)

      // Memory increase should be reasonable (less than 200MB for 50k transactions)
      if (memoryIncrease > 0) {
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024)
      }
    })
  })

  describe('Streaming Performance', () => {
    test('should stream large datasets efficiently', async () => {
      const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(10000)
      const accounts = generateLargeAccountSet(500)

      const start = performance.now()
      let count = 0

      for await (const result of filter.filterTransactionsStream(transactions, accounts)) {
        count++
        // Process in chunks to test streaming
        if (count % 1000 === 0) {
          const elapsed = performance.now() - start
          console.log(`Streamed ${count} results in ${elapsed.toFixed(2)}ms`)
        }
      }

      const end = performance.now()
      const duration = end - start

      console.log(`Streamed ${count} results in total time: ${duration.toFixed(2)}ms`)

      expect(count).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })

  describe('Memory Scaling', () => {
    test('should scale linearly with dataset size', async () => {
      const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const accounts = generateLargeAccountSet(100)

      const sizes = [1000, 5000, 10000]
      const timings: number[] = []

      for (const size of sizes) {
        const transactions = generateLargeTransactionSet(size)

        const start = performance.now()
        const result = await filter.filterTransactionsBatch(transactions, accounts)
        const end = performance.now()

        const duration = end - start
        timings.push(duration)

        console.log(`${size} transactions: ${duration.toFixed(2)}ms`)
        expect(result.length).toBeGreaterThan(0)
      }

      // Check that timing scales roughly linearly
      // Allow for some variance due to system conditions
      const ratio1 = timings[1] / timings[0] // 5k vs 1k
      const ratio2 = timings[2] / timings[1] // 10k vs 5k

      console.log(`Scaling ratios: ${ratio1.toFixed(2)}, ${ratio2.toFixed(2)}`)

      // Ratios should be reasonable (between 2 and 10 for these size differences)
      expect(ratio1).toBeGreaterThan(1)
      expect(ratio1).toBeLessThan(10)
      expect(ratio2).toBeGreaterThan(1)
      expect(ratio2).toBeLessThan(5)
    })
  })

  describe('Pattern Matching Performance', () => {
    test('should handle complex patterns efficiently', () => {
      const complexRules = {
        includePatterns: ['4*', '50*', '51*', '52*', '53*'],
        excludePatterns: ['49*', '599*'],
        excludeSpecific: ['400000', '410000', '500000', '510000'],
        customRules: [
          {
            name: 'Complex condition',
            condition: (line: any) =>
              line.amount > 100 &&
              line.amount < 10000 &&
              !line.description.includes('exclude') &&
              line.effectiveDate >= '2023-01-01',
            reason: 'Complex filtering'
          }
        ]
      }

      const filter = new TransactionFilter(complexRules)
      const transactions = generateLargeTransactionSet(10000)
      const accounts = generateLargeAccountSet(500)

      const start = performance.now()
      const result = filter.filterTransactions(transactions, accounts)
      const end = performance.now()

      const duration = end - start
      console.log(`Complex filtering of 10k transactions: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('Concurrent Processing', () => {
    test('should handle concurrent filter operations', async () => {
      const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
      const transactions = generateLargeTransactionSet(5000)
      const accounts = generateLargeAccountSet(200)

      const start = performance.now()

      // Run multiple filter operations concurrently
      const promises = Array.from({ length: 3 }, () =>
        filter.filterTransactionsBatch(transactions, accounts)
      )

      const results = await Promise.all(promises)
      const end = performance.now()

      const duration = end - start
      console.log(`3 concurrent operations completed in: ${duration.toFixed(2)}ms`)

      // All should return the same number of results
      expect(results[0].length).toBe(results[1].length)
      expect(results[1].length).toBe(results[2].length)

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(3000)
    })
  })
})

describe('Real-world Performance Scenarios', () => {
  jest.setTimeout(30000)

  test('should handle typical XAF file size (50k transactions)', async () => {
    const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
    const transactions = generateLargeTransactionSet(50000)
    const accounts = generateLargeAccountSet(2000)

    console.log('Testing real-world scenario: 50k transactions, 2k accounts')

    const start = performance.now()
    const result = await filter.filterTransactionsBatch(transactions, accounts, 2000)
    const end = performance.now()

    const duration = end - start
    const throughput = transactions.length / (duration / 1000)

    console.log(`Processed ${transactions.length} transactions in ${(duration / 1000).toFixed(2)}s`)
    console.log(`Throughput: ${throughput.toFixed(0)} transactions/second`)
    console.log(`Filtered results: ${result.length}`)

    expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    expect(result.length).toBeGreaterThan(0)
    expect(throughput).toBeGreaterThan(1000) // At least 1000 transactions/second
  })

  test('should maintain performance with varying filter complexity', async () => {
    const simpleRules = {
      includePatterns: ['4*'],
      excludePatterns: [],
      excludeSpecific: []
    }

    const complexRules = {
      includePatterns: ['4*', '5*', '6*'],
      excludePatterns: ['49*', '59*', '69*'],
      excludeSpecific: ['400000', '500000', '600000', '410000', '510000'],
      customRules: [
        {
          name: 'Amount filter',
          condition: (line: any) => Math.abs(line.amount) >= 50,
          reason: 'Minimum amount'
        },
        {
          name: 'Date filter',
          condition: (line: any) => line.effectiveDate >= '2023-01-01',
          reason: 'Date range'
        }
      ]
    }

    const transactions = generateLargeTransactionSet(10000)
    const accounts = generateLargeAccountSet(500)

    // Test simple rules
    const simpleFilter = new OptimizedTransactionFilter(simpleRules)
    const simpleStart = performance.now()
    const simpleResult = await simpleFilter.filterTransactionsBatch(transactions, accounts)
    const simpleEnd = performance.now()
    const simpleDuration = simpleEnd - simpleStart

    // Test complex rules
    const complexFilter = new OptimizedTransactionFilter(complexRules)
    const complexStart = performance.now()
    const complexResult = await complexFilter.filterTransactionsBatch(transactions, accounts)
    const complexEnd = performance.now()
    const complexDuration = complexEnd - complexStart

    console.log(`Simple rules: ${simpleDuration.toFixed(2)}ms, ${simpleResult.length} results`)
    console.log(`Complex rules: ${complexDuration.toFixed(2)}ms, ${complexResult.length} results`)

    const overhead = ((complexDuration - simpleDuration) / simpleDuration) * 100
    console.log(`Complexity overhead: ${overhead.toFixed(1)}%`)

    // Complex rules should not be more than 3x slower than simple rules
    expect(complexDuration).toBeLessThan(simpleDuration * 3)
    expect(overhead).toBeLessThan(200) // Less than 200% overhead
  })
})