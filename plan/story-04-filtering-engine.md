# Story 4: Filtering Engine

**Sprint:** 2
**Estimate:** 1 dag
**Priority:** High

## User Story
Als systeem wil ik alleen relevante transacties filteren voor WKR analyse zodat de AI zich kan focussen op de juiste boekhoudkundige data.

## Acceptatiecriteria
- [x] Filter accounts beginnend met "4" (omzet rekeningen)
- [x] Exclude accounts beginnend met "49"
- [x] Exclude specifieke accounts (430000, 403130)
- [x] Data transformatie naar tabel format voor AI
- [x] Configureerbare filtering regels
- [x] Performance optimalisatie voor grote datasets

## Filtering Requirements (uit PRD)

### Include/Exclude Logic
```typescript
// src/lib/filters/wkr-filter.ts
export interface FilterRules {
  includePatterns: string[]    // ["4*"]
  excludePatterns: string[]    // ["49*"]
  excludeSpecific: string[]    // ["430000", "403130"]
  customRules?: FilterRule[]
}

export interface FilterRule {
  name: string
  condition: (transaction: XAFTransactionLine) => boolean
  reason: string
}

export const DEFAULT_WKR_FILTER_RULES: FilterRules = {
  includePatterns: ["4*"],           // Omzet rekeningen
  excludePatterns: ["49*"],          // Exclude 49xxx accounts
  excludeSpecific: ["430000", "403130"], // Specific exclusions
  customRules: []
}
```

### Core Filtering Engine
```typescript
// src/lib/filters/transaction-filter.ts
export class TransactionFilter {
  private rules: FilterRules

  constructor(rules: FilterRules = DEFAULT_WKR_FILTER_RULES) {
    this.rules = rules
  }

  filterTransactions(transactions: XAFTransaction[]): FilteredTransaction[] {
    const filtered: FilteredTransaction[] = []

    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        if (this.shouldIncludeLine(line)) {
          filtered.push({
            ...this.transformToWKRFormat(transaction, line),
            filterReason: this.getInclusionReason(line)
          })
        }
      }
    }

    return filtered
  }

  private shouldIncludeLine(line: XAFTransactionLine): boolean {
    const accountId = line.accountId

    // First check include patterns
    const includeMatch = this.rules.includePatterns.some(pattern =>
      this.matchesPattern(accountId, pattern)
    )

    if (!includeMatch) {
      return false
    }

    // Check exclude patterns
    const excludePatternMatch = this.rules.excludePatterns.some(pattern =>
      this.matchesPattern(accountId, pattern)
    )

    if (excludePatternMatch) {
      return false
    }

    // Check specific exclusions
    if (this.rules.excludeSpecific.includes(accountId)) {
      return false
    }

    // Check custom rules
    if (this.rules.customRules) {
      const customExclusion = this.rules.customRules.some(rule =>
        !rule.condition(line)
      )

      if (customExclusion) {
        return false
      }
    }

    return true
  }

  private matchesPattern(accountId: string, pattern: string): boolean {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return accountId.startsWith(prefix)
    }

    return accountId === pattern
  }

  private getInclusionReason(line: XAFTransactionLine): string {
    const accountId = line.accountId

    if (accountId.startsWith('40')) return 'Omzet - Producten/Diensten'
    if (accountId.startsWith('41')) return 'Omzet - Overig'
    if (accountId.startsWith('42')) return 'Kostprijs verkopen'
    if (accountId.startsWith('43')) return 'Algemene kosten'
    if (accountId.startsWith('44')) return 'Personeelskosten'
    if (accountId.startsWith('45')) return 'Afschrijvingen'
    if (accountId.startsWith('46')) return 'Overige bedrijfskosten'
    if (accountId.startsWith('47')) return 'Financiële baten/lasten'
    if (accountId.startsWith('48')) return 'Buitengewone baten/lasten'

    return 'Overige relevante rekening'
  }
}
```

## Data Transformation

### Output Format (per PRD specificatie)
```typescript
// src/lib/transformers/wkr-transformer.ts
export interface FilteredTransaction {
  grootboek: string        // "440000 Huur"
  boeking: string         // "108308 Spitters Vastgoed BV_Kazernelaan - 2023-01-01"
  bedrag: number          // 9834.5
  datum: string           // "2023-01-01"
  filterReason?: string   // Why this transaction was included
  accountId: string       // For reference
  transactionId: string   // For reference
}

export class WKRTransformer {
  transformToWKRFormat(
    transaction: XAFTransaction,
    line: XAFTransactionLine,
    accounts: XAFAccount[]
  ): FilteredTransaction {
    // Find account name
    const account = accounts.find(acc => acc.id === line.accountId)
    const accountName = account?.name || 'Onbekende rekening'

    // Format grootboek
    const grootboek = `${line.accountId} ${accountName}`

    // Format boeking (transaction number + description + date)
    const boeking = `${transaction.transactionNumber} ${transaction.description} - ${transaction.date}`

    return {
      grootboek,
      boeking,
      bedrag: line.amount,
      datum: line.effectiveDate || transaction.date,
      accountId: line.accountId,
      transactionId: transaction.transactionNumber
    }
  }

  transformToTableFormat(transactions: FilteredTransaction[]): string {
    const headers = "| Grootboek | Boeking | Bedrag | Datum |"
    const separator = "|---|---|---|---|"

    const rows = transactions.map(tx =>
      `| ${tx.grootboek} | ${tx.boeking} | ${tx.bedrag} | ${tx.datum} |`
    )

    return [headers, separator, ...rows].join('\n')
  }

  transformToCSV(transactions: FilteredTransaction[]): string {
    const headers = "Grootboek,Boeking,Bedrag,Datum"
    const rows = transactions.map(tx =>
      `"${tx.grootboek}","${tx.boeking}",${tx.bedrag},"${tx.datum}"`
    )

    return [headers, ...rows].join('\n')
  }
}
```

## Performance Optimizations

### Efficient Filtering for Large Datasets
```typescript
// src/lib/filters/optimized-filter.ts
export class OptimizedTransactionFilter extends TransactionFilter {
  // Pre-compile regex patterns for faster matching
  private compiledPatterns: {
    include: RegExp[]
    exclude: RegExp[]
  }

  constructor(rules: FilterRules) {
    super(rules)
    this.compiledPatterns = this.compilePatterns(rules)
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
  filterTransactionsBatch(
    transactions: XAFTransaction[],
    batchSize: number = 1000
  ): FilteredTransaction[] {
    const results: FilteredTransaction[] = []

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize)
      const filtered = this.filterTransactions(batch)
      results.push(...filtered)

      // Allow event loop to process other tasks
      if (i % (batchSize * 10) === 0) {
        // Yield control periodically for large datasets
        setTimeout(() => {}, 0)
      }
    }

    return results
  }

  // Memory-efficient streaming filter
  async *filterTransactionsStream(
    transactions: XAFTransaction[]
  ): AsyncGenerator<FilteredTransaction, void, unknown> {
    for (const transaction of transactions) {
      for (const line of transaction.lines) {
        if (this.shouldIncludeLine(line)) {
          yield this.transformToWKRFormat(transaction, line)
        }
      }
    }
  }
}
```

## Configuration & Customization

### Configurable Filter Rules
```typescript
// src/lib/config/filter-config.ts
export interface FilterConfiguration {
  name: string
  description: string
  rules: FilterRules
  version: string
  author?: string
  lastModified: Date
}

export const WKR_2025_CONFIG: FilterConfiguration = {
  name: "WKR 2025 Standaard",
  description: "Standaard filterregels voor WKR analyse 2025",
  version: "1.0.0",
  rules: {
    includePatterns: ["4*"],
    excludePatterns: ["49*"],
    excludeSpecific: ["430000", "403130"],
    customRules: [
      {
        name: "Exclude zero amounts",
        condition: (line) => line.amount !== 0,
        reason: "Nul-bedrag transacties zijn niet relevant voor WKR"
      },
      {
        name: "Include only current year",
        condition: (line) => {
          const year = new Date(line.effectiveDate).getFullYear()
          return year === new Date().getFullYear()
        },
        reason: "Alleen huidige jaar relevant voor analyse"
      }
    ]
  },
  lastModified: new Date()
}

export class FilterConfigManager {
  saveConfiguration(config: FilterConfiguration): void {
    // Save to localStorage or server
    localStorage.setItem(`filter-config-${config.name}`, JSON.stringify(config))
  }

  loadConfiguration(name: string): FilterConfiguration | null {
    const saved = localStorage.getItem(`filter-config-${name}`)
    return saved ? JSON.parse(saved) : null
  }

  getDefaultConfiguration(): FilterConfiguration {
    return WKR_2025_CONFIG
  }
}
```

## API Integration

### Filter API Endpoint
```typescript
// src/app/api/filter/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { TransactionFilter } from '@/lib/filters/transaction-filter'
import { WKRTransformer } from '@/lib/transformers/wkr-transformer'

export async function POST(request: NextRequest) {
  try {
    const { transactions, accounts, filterConfig } = await request.json()

    // Validate input
    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid transactions data' },
        { status: 400 }
      )
    }

    // Apply filtering
    const filter = new TransactionFilter(filterConfig?.rules)
    const transformer = new WKRTransformer()

    const filtered = filter.filterTransactions(transactions)
    const tableFormat = transformer.transformToTableFormat(filtered)

    // Calculate statistics
    const stats = {
      totalInput: transactions.length,
      totalFiltered: filtered.length,
      filterRatio: (filtered.length / transactions.length * 100).toFixed(1),
      totalAmount: filtered.reduce((sum, tx) => sum + tx.bedrag, 0),
      dateRange: {
        earliest: Math.min(...filtered.map(tx => new Date(tx.datum).getTime())),
        latest: Math.max(...filtered.map(tx => new Date(tx.datum).getTime()))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        filtered,
        tableFormat,
        stats
      }
    })

  } catch (error) {
    console.error('Filtering error:', error)
    return NextResponse.json(
      { error: 'Fout bij filteren van transacties' },
      { status: 500 }
    )
  }
}
```

## Testing

### Unit Tests
```typescript
// src/lib/filters/__tests__/transaction-filter.test.ts
import { TransactionFilter, DEFAULT_WKR_FILTER_RULES } from '../transaction-filter'

describe('TransactionFilter', () => {
  let filter: TransactionFilter

  beforeEach(() => {
    filter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
  })

  test('should include accounts starting with 4', () => {
    const mockTransaction = createMockTransaction('400000', 'Omzet')
    const result = filter.filterTransactions([mockTransaction])

    expect(result).toHaveLength(1)
    expect(result[0].accountId).toBe('400000')
  })

  test('should exclude accounts starting with 49', () => {
    const mockTransaction = createMockTransaction('490000', 'Exclude me')
    const result = filter.filterTransactions([mockTransaction])

    expect(result).toHaveLength(0)
  })

  test('should exclude specific accounts', () => {
    const transactions = [
      createMockTransaction('430000', 'Should be excluded'),
      createMockTransaction('403130', 'Should be excluded'),
      createMockTransaction('430001', 'Should be included')
    ]

    const result = filter.filterTransactions(transactions)

    expect(result).toHaveLength(1)
    expect(result[0].accountId).toBe('430001')
  })

  test('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) =>
      createMockTransaction(`40${i.toString().padStart(4, '0')}`, `Account ${i}`)
    )

    const start = performance.now()
    const result = filter.filterTransactions(largeDataset)
    const end = performance.now()

    expect(result).toHaveLength(10000)
    expect(end - start).toBeLessThan(1000) // Should complete within 1 second
  })
})

function createMockTransaction(accountId: string, description: string): XAFTransaction {
  return {
    transactionNumber: '123',
    description,
    date: '2023-01-01',
    journal: 'VK',
    period: 1,
    lines: [{
      lineNumber: 1,
      accountId,
      description,
      amount: 100,
      amountType: 'D',
      effectiveDate: '2023-01-01'
    }]
  }
}
```

### Performance Tests
```typescript
// src/lib/filters/__tests__/filter-performance.test.ts
describe('Filter Performance', () => {
  test('should filter 100k transactions in under 5 seconds', async () => {
    const largeDataset = generateLargeTransactionSet(100000)
    const filter = new OptimizedTransactionFilter(DEFAULT_WKR_FILTER_RULES)

    const start = performance.now()
    const result = filter.filterTransactionsBatch(largeDataset, 1000)
    const end = performance.now()

    expect(end - start).toBeLessThan(5000)
    expect(result.length).toBeGreaterThan(0)
  })
})
```

## Error Handling

### Robust Error Management
```typescript
// src/lib/filters/filter-errors.ts
export class FilterError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message)
    this.name = 'FilterError'
  }
}

export function handleFilterError(error: unknown, context?: any): FilterError {
  if (error instanceof FilterError) {
    return error
  }

  if (error instanceof Error) {
    return new FilterError(
      `Filter fout: ${error.message}`,
      'FILTER_ERROR',
      context
    )
  }

  return new FilterError(
    'Onbekende fout bij filteren',
    'UNKNOWN_FILTER_ERROR',
    context
  )
}
```

## Definition of Done
- [ ] Filtering logic werkt volgens PRD specificaties
- [ ] Performance test: 10k transacties in <1 seconde
- [ ] Configureerbare filterregels
- [ ] Correcte data transformatie naar tabel format
- [ ] Unit tests coverage >95%
- [ ] Error handling voor edge cases
- [ ] Memory efficient voor grote datasets
- [ ] API endpoint functioneel

## Performance Targets
- Filter 1k transacties: <100ms
- Filter 10k transacties: <1 seconde
- Filter 100k transacties: <5 seconden
- Memory usage: O(n) linear scaling
- Support voor real-time filtering updates