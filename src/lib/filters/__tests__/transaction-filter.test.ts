import { TransactionFilter } from '../transaction-filter'
import { OptimizedTransactionFilter } from '../optimized-filter'
import { WKRTransformer } from '../../transformers/wkr-transformer'
import { FilterConfigManager } from '../../config/filter-config'

// Mock localStorage and window for Node.js environment
const storage: Record<string, string> = {}
const localStorageMock = {
  getItem: jest.fn((key: string) => storage[key] || null),
  setItem: jest.fn((key: string, value: string) => { storage[key] = value }),
  removeItem: jest.fn((key: string) => { delete storage[key] }),
  clear: jest.fn(() => { Object.keys(storage).forEach(key => delete storage[key]) }),
}
global.localStorage = localStorageMock as any
global.window = { localStorage: localStorageMock } as any
import {
  FilterRules,
  FilteredTransaction,
  DEFAULT_WKR_FILTER_RULES,
  FilterError
} from '@/types/filter'
import { XAFTransaction, XAFAccount } from '@/types/xaf'

// Mock data helpers
function createMockTransaction(
  accountId: string,
  description: string,
  amount: number = 100,
  date: string = '2023-01-01'
): XAFTransaction {
  return {
    transactionNumber: `TX${Math.random().toString(36).substr(2, 9)}`,
    description,
    date,
    journal: 'VK',
    period: 1,
    transactionType: 'S',
    systemEntryDate: date,
    systemEntryTime: '10:00:00',
    glPostingDate: date,
    sourceDocumentID: 'DOC001',
    lines: [{
      lineNumber: 1,
      accountId,
      accountName: description,
      description,
      amount,
      amountType: amount >= 0 ? 'D' : 'C',
      effectiveDate: date,
      documentReference: 'REF001',
      customerID: '',
      supplierID: '',
      systemEntryDate: date,
      systemEntryTime: '10:00:00',
      glPostingDate: date,
      recordID: 'REC001'
    }]
  }
}

function createMockAccount(id: string, name: string, type: 'P' | 'B' = 'P'): XAFAccount {
  return {
    id,
    name,
    type,
    standardAccountID: id,
    groupingCategory: type === 'P' ? 'Profit & Loss' : 'Balance Sheet',
    accountCreationDate: '2023-01-01',
    openingDebitBalance: 0,
    openingCreditBalance: 0,
    closingDebitBalance: 0,
    closingCreditBalance: 0
  }
}

describe('TransactionFilter', () => {
  let filter: TransactionFilter
  let mockAccounts: XAFAccount[]

  beforeEach(() => {
    filter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
    mockAccounts = [
      createMockAccount('400000', 'Omzet Nederland'),
      createMockAccount('410000', 'Overige omzet'),
      createMockAccount('430000', 'Algemene kosten'), // Should be excluded
      createMockAccount('430001', 'Kantoorkosten'),
      createMockAccount('490000', 'Resultaat boekjaar'), // Should be excluded
      createMockAccount('403130', 'Specifieke uitsluiting') // Should be excluded
    ]
  })

  describe('Basic Filtering', () => {
    test('should include accounts starting with 4', () => {
      const transactions = [
        createMockTransaction('400000', 'Omzet Nederland', 1000),
        createMockTransaction('410000', 'Overige omzet', 500),
        createMockTransaction('500000', 'Personeelskosten', 200) // Should be excluded
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(2)
      expect(result[0].accountId).toBe('400000')
      expect(result[1].accountId).toBe('410000')
    })

    test('should exclude accounts starting with 49', () => {
      const transactions = [
        createMockTransaction('400000', 'Omzet Nederland', 1000),
        createMockTransaction('490000', 'Resultaat boekjaar', 500) // Should be excluded
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(1)
      expect(result[0].accountId).toBe('400000')
    })

    test('should exclude specific accounts', () => {
      const transactions = [
        createMockTransaction('430000', 'Algemene kosten', 100), // Should be excluded
        createMockTransaction('403130', 'Specifieke uitsluiting', 200), // Should be excluded
        createMockTransaction('430001', 'Kantoorkosten', 300) // Should be included
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(1)
      expect(result[0].accountId).toBe('430001')
    })

    test('should exclude zero amounts with default rules', () => {
      const transactions = [
        createMockTransaction('400000', 'Omzet Nederland', 1000),
        createMockTransaction('410000', 'Zero amount', 0) // Should be excluded by custom rule
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(1)
      expect(result[0].accountId).toBe('400000')
    })
  })

  describe('Data Transformation', () => {
    test('should transform to correct WKR format', () => {
      const transaction = createMockTransaction('400000', 'Omzet Nederland', 1500.50, '2023-03-15')
      const result = filter.filterTransactions([transaction], mockAccounts)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        grootboek: '400000 Omzet Nederland',
        boeking: expect.stringContaining('Omzet Nederland - 2023-03-15'),
        bedrag: 1500.50,
        datum: '2023-03-15',
        accountId: '400000',
        filterReason: 'Omzet - Producten/Diensten'
      })
    })

    test('should handle missing account names gracefully', () => {
      const transaction = createMockTransaction('401000', 'Unknown account', 100)
      const result = filter.filterTransactions([transaction], []) // No accounts provided

      expect(result).toHaveLength(1)
      expect(result[0].grootboek).toBe('401000 Unknown account')
    })
  })

  describe('Filter Reason Classification', () => {
    test('should classify account types correctly', () => {
      const transactions = [
        createMockTransaction('400000', 'Omzet producten', 100),
        createMockTransaction('410000', 'Overige omzet', 100),
        createMockTransaction('420000', 'Kostprijs', 100),
        createMockTransaction('430001', 'Algemene kosten', 100),
        createMockTransaction('440000', 'Personeelskosten', 100),
        createMockTransaction('450000', 'Afschrijvingen', 100),
        createMockTransaction('460000', 'Overige kosten', 100),
        createMockTransaction('470000', 'Financiële kosten', 100),
        createMockTransaction('480000', 'Buitengewone kosten', 100)
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(9)
      expect(result[0].filterReason).toBe('Omzet - Producten/Diensten')
      expect(result[1].filterReason).toBe('Omzet - Overig')
      expect(result[2].filterReason).toBe('Kostprijs verkopen')
      expect(result[3].filterReason).toBe('Algemene kosten')
      expect(result[4].filterReason).toBe('Personeelskosten')
      expect(result[5].filterReason).toBe('Afschrijvingen')
      expect(result[6].filterReason).toBe('Overige bedrijfskosten')
      expect(result[7].filterReason).toBe('Financiële baten/lasten')
      expect(result[8].filterReason).toBe('Buitengewone baten/lasten')
    })
  })

  describe('Custom Filter Rules', () => {
    test('should apply custom rules correctly', () => {
      const customRules: FilterRules = {
        includePatterns: ['4*'],
        excludePatterns: ['49*'],
        excludeSpecific: [],
        customRules: [
          {
            name: 'Minimum amount',
            condition: (line) => Math.abs(line.amount) >= 500,
            reason: 'Amount too small'
          }
        ]
      }

      const customFilter = new TransactionFilter(customRules)
      const transactions = [
        createMockTransaction('400000', 'Large amount', 1000),
        createMockTransaction('410000', 'Small amount', 100) // Should be excluded
      ]

      const result = customFilter.filterTransactions(transactions, mockAccounts)

      expect(result).toHaveLength(1)
      expect(result[0].accountId).toBe('400000')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid transaction data gracefully', () => {
      const invalidTransactions = [
        {
          ...createMockTransaction('400000', 'Valid transaction'),
          lines: [] // Empty lines should not cause crash
        }
      ]

      const result = filter.filterTransactions(invalidTransactions as XAFTransaction[], mockAccounts)
      expect(result).toHaveLength(0)
    })

    test('should validate filter rules', () => {
      expect(() => {
        filter.validateRules({
          includePatterns: [], // Empty should throw error
          excludePatterns: [],
          excludeSpecific: []
        })
      }).toThrow(FilterError)
    })

    test('should validate invalid patterns', () => {
      expect(() => {
        filter.validateRules({
          includePatterns: [''], // Empty string should throw error
          excludePatterns: [],
          excludeSpecific: []
        })
      }).toThrow(FilterError)
    })
  })

  describe('Performance', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) =>
        createMockTransaction(`40${i.toString().padStart(4, '0')}`, `Account ${i}`)
      )

      const start = performance.now()
      const result = filter.filterTransactions(largeDataset, mockAccounts)
      const end = performance.now()

      expect(result).toHaveLength(1000)
      expect(end - start).toBeLessThan(1000) // Should complete within 1 second
    })

    test('should calculate statistics correctly', () => {
      const transactions = [
        createMockTransaction('400000', 'Transaction 1', 100),
        createMockTransaction('410000', 'Transaction 2', 200),
        createMockTransaction('500000', 'Excluded', 300) // Will be excluded
      ]

      const result = filter.filterTransactions(transactions, mockAccounts)
      const stats = filter.getFilterStats(transactions, result)

      expect(stats.totalInput).toBe(3) // 3 transaction lines total
      expect(stats.totalFiltered).toBe(2) // 2 lines passed filter
      expect(stats.filterRatio).toBe('66.7') // 2/3 * 100
      expect(stats.totalAmount).toBe(300) // 100 + 200
    })
  })
})

describe('OptimizedTransactionFilter', () => {
  let optimizedFilter: OptimizedTransactionFilter
  let mockAccounts: XAFAccount[]

  beforeEach(() => {
    optimizedFilter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)
    mockAccounts = [
      createMockAccount('400000', 'Omzet Nederland'),
      createMockAccount('410000', 'Overige omzet')
    ]
  })

  describe('Batch Processing', () => {
    test('should process batches correctly', async () => {
      const transactions = Array.from({ length: 100 }, (_, i) =>
        createMockTransaction('400000', `Transaction ${i}`, 100 + i)
      )

      const result = await optimizedFilter.filterTransactionsBatch(
        transactions,
        mockAccounts,
        10 // Small batch size for testing
      )

      expect(result).toHaveLength(100)
      expect(result[0].accountId).toBe('400000')
    })

    test('should report progress during batch processing', async () => {
      const transactions = Array.from({ length: 50 }, (_, i) =>
        createMockTransaction('400000', `Transaction ${i}`)
      )

      const progressReports: number[] = []
      await optimizedFilter.filterTransactionsBatch(
        transactions,
        mockAccounts,
        10,
        (progress) => progressReports.push(progress)
      )

      expect(progressReports.length).toBeGreaterThan(0)
      expect(progressReports[progressReports.length - 1]).toBe(100)
    })
  })

  describe('Streaming Processing', () => {
    test('should stream results correctly', async () => {
      const transactions = Array.from({ length: 10 }, (_, i) =>
        createMockTransaction('400000', `Transaction ${i}`)
      )

      const results: FilteredTransaction[] = []
      for await (const result of optimizedFilter.filterTransactionsStream(transactions, mockAccounts)) {
        results.push(result)
      }

      expect(results).toHaveLength(10)
      expect(results[0].accountId).toBe('400000')
    })
  })

  describe('Performance Metrics', () => {
    test('should provide performance metrics', async () => {
      const transactions = Array.from({ length: 100 }, (_, i) =>
        createMockTransaction('400000', `Transaction ${i}`)
      )

      const result = await optimizedFilter.filterWithPerformanceMetrics(transactions, mockAccounts)

      expect(result.filtered).toHaveLength(100)
      expect(result.metrics).toMatchObject({
        processingTime: expect.any(Number),
        transactionsPerSecond: expect.any(Number),
        linesProcessed: 100,
        memoryUsed: expect.any(Number),
        peakMemory: expect.any(Number)
      })
    })
  })
})

describe('WKRTransformer', () => {
  let transformer: WKRTransformer
  let mockTransactions: FilteredTransaction[]

  beforeEach(() => {
    transformer = new WKRTransformer()
    mockTransactions = [
      {
        grootboek: '400000 Omzet Nederland',
        boeking: 'TX001 Verkoop - 2023-01-01',
        bedrag: 1000,
        datum: '2023-01-01',
        accountId: '400000',
        transactionId: 'TX001',
        filterReason: 'Omzet - Producten/Diensten'
      },
      {
        grootboek: '410000 Overige omzet',
        boeking: 'TX002 Service - 2023-01-02',
        bedrag: 500,
        datum: '2023-01-02',
        accountId: '410000',
        transactionId: 'TX002',
        filterReason: 'Omzet - Overig'
      }
    ]
  })

  describe('Output Formatting', () => {
    test('should transform to table format correctly', () => {
      const tableFormat = transformer.transformToTableFormat(mockTransactions)

      expect(tableFormat).toContain('| Grootboek | Boeking | Bedrag | Datum |')
      expect(tableFormat).toContain('|---|---|---|---|')
      expect(tableFormat).toContain('400000 Omzet Nederland')
      expect(tableFormat).toMatch(/€\s*1\.000,00/)
    })

    test('should transform to CSV format correctly', () => {
      const csvFormat = transformer.transformToCSV(mockTransactions)

      expect(csvFormat).toContain('Grootboek,Boeking,Bedrag,Datum,Reden')
      expect(csvFormat).toContain('400000 Omzet Nederland')
      expect(csvFormat).toContain('1000')
    })

    test('should handle empty data gracefully', () => {
      const tableFormat = transformer.transformToTableFormat([])
      const csvFormat = transformer.transformToCSV([])

      expect(tableFormat).toContain('Geen gegevens')
      expect(csvFormat).toContain('Grootboek,Boeking,Bedrag,Datum,Reden')
    })
  })

  describe('Statistics Calculation', () => {
    test('should calculate statistics correctly', () => {
      const stats = transformer.calculateStats(mockTransactions, 5)

      expect(stats).toMatchObject({
        totalInput: 5,
        totalFiltered: 2,
        filterRatio: '40.0',
        totalAmount: 1500,
        dateRange: {
          earliest: '2023-01-01',
          latest: '2023-01-02'
        },
        accountBreakdown: {
          '40xxxx': 1,
          '41xxxx': 1
        }
      })
    })

    test('should handle empty statistics', () => {
      const stats = transformer.calculateStats([], 0)

      expect(stats).toMatchObject({
        totalInput: 0,
        totalFiltered: 0,
        filterRatio: '0.0',
        totalAmount: 0,
        dateRange: {
          earliest: '',
          latest: ''
        },
        accountBreakdown: {}
      })
    })
  })

  describe('Summary Generation', () => {
    test('should generate summary text', () => {
      const stats = transformer.calculateStats(mockTransactions, 5)
      const summary = transformer.generateSummaryText(stats)

      expect(summary).toContain('WKR Filter Resultaten')
      expect(summary).toContain('Totaal transactieregels: 5')
      expect(summary).toContain('Gefilterde regels: 2 (40.0%)')
      expect(summary).toMatch(/€\s*1\.500,00/)
    })
  })
})

describe('FilterConfigManager', () => {
  let configManager: FilterConfigManager

  beforeEach(() => {
    configManager = new FilterConfigManager()
    // Clear localStorage
    localStorage.clear()
  })

  describe('Configuration Management', () => {
    test('should save and load configurations', () => {
      const config = configManager.createConfiguration(
        'Test Config',
        'Test description',
        DEFAULT_WKR_FILTER_RULES
      )

      configManager.saveConfiguration(config)
      const loaded = configManager.loadConfiguration('Test Config')

      expect(loaded).not.toBeNull()
      expect(loaded?.name).toBe('Test Config')
      expect(loaded?.description).toBe('Test description')
    })

    test('should list saved configurations', () => {
      const config1 = configManager.createConfiguration('Config 1', 'Description 1', DEFAULT_WKR_FILTER_RULES)
      const config2 = configManager.createConfiguration('Config 2', 'Description 2', DEFAULT_WKR_FILTER_RULES)

      configManager.saveConfiguration(config1)
      configManager.saveConfiguration(config2)

      const list = configManager.listConfigurations()
      expect(list).toContain('Config 1')
      expect(list).toContain('Config 2')
    })

    test('should delete configurations', () => {
      const config = configManager.createConfiguration('Delete Me', 'To be deleted', DEFAULT_WKR_FILTER_RULES)
      configManager.saveConfiguration(config)

      expect(configManager.loadConfiguration('Delete Me')).not.toBeNull()

      const deleted = configManager.deleteConfiguration('Delete Me')
      expect(deleted).toBe(true)
      expect(configManager.loadConfiguration('Delete Me')).toBeNull()
    })
  })

  describe('Configuration Validation', () => {
    test('should reject invalid configurations', () => {
      expect(() => {
        configManager.saveConfiguration({
          name: '', // Empty name
          description: 'Test',
          rules: DEFAULT_WKR_FILTER_RULES,
          version: '1.0.0',
          lastModified: new Date()
        })
      }).toThrow(FilterError)
    })
  })

  describe('Import/Export', () => {
    test('should export configuration as JSON', () => {
      const config = configManager.getDefaultConfiguration()
      const exported = configManager.exportConfiguration(config)

      expect(() => JSON.parse(exported)).not.toThrow()
      const parsed = JSON.parse(exported)
      expect(parsed.name).toBe(config.name)
    })

    test('should import configuration from JSON', () => {
      const config = configManager.getDefaultConfiguration()
      const exported = configManager.exportConfiguration(config)

      const imported = configManager.importConfiguration(exported)
      expect(imported.name).toBe(config.name)
      expect(imported.rules.includePatterns).toEqual(config.rules.includePatterns)
      expect(imported.rules.excludePatterns).toEqual(config.rules.excludePatterns)
      expect(imported.rules.excludeSpecific).toEqual(config.rules.excludeSpecific)

      // Custom rules lose their condition functions during JSON serialization
      if (imported.rules.customRules && config.rules.customRules) {
        expect(imported.rules.customRules.length).toBe(config.rules.customRules.length)
        expect(imported.rules.customRules[0].name).toBe(config.rules.customRules[0].name)
        expect(imported.rules.customRules[0].reason).toBe(config.rules.customRules[0].reason)
        // condition function is expected to be undefined after JSON import
      }
    })
  })
})