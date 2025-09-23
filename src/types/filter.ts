import { XAFTransaction, XAFTransactionLine, XAFAccount } from './xaf'

export interface FilterRule {
  name: string
  condition: (transaction: XAFTransactionLine) => boolean
  reason: string
}

export interface FilterRules {
  includePatterns: string[]    // ["4*"]
  excludePatterns: string[]    // ["49*"]
  excludeSpecific: string[]    // ["430000", "403130"]
  customRules?: FilterRule[]
}

export interface FilteredTransaction {
  grootboek: string        // "440000 Huur"
  boeking: string         // "108308 Spitters Vastgoed BV_Kazernelaan - 2023-01-01"
  bedrag: number          // 9834.5
  datum: string           // "2023-01-01"
  filterReason?: string   // Why this transaction was included
  accountId: string       // For reference
  transactionId: string   // For reference
}

export interface FilterConfiguration {
  name: string
  description: string
  rules: FilterRules
  version: string
  author?: string
  lastModified: Date
}

export interface FilterStats {
  totalInput: number
  totalFiltered: number
  filterRatio: string
  totalAmount: number
  dateRange: {
    earliest: string
    latest: string
  }
  accountBreakdown: Record<string, number>
}

export interface FilterResult {
  filtered: FilteredTransaction[]
  tableFormat: string
  csvFormat: string
  stats: FilterStats
}

export const DEFAULT_WKR_FILTER_RULES: FilterRules = {
  includePatterns: ["4*"],           // Omzet rekeningen
  excludePatterns: ["49*"],          // Exclude 49xxx accounts
  excludeSpecific: ["430000", "403130"], // Specific exclusions
  customRules: [
    {
      name: "Exclude zero amounts",
      condition: (line) => line.amount !== 0,
      reason: "Nul-bedrag transacties zijn niet relevant voor WKR"
    }
  ]
}

export const WKR_2025_CONFIG: FilterConfiguration = {
  name: "WKR 2025 Standaard",
  description: "Standaard filterregels voor WKR analyse 2025",
  version: "1.0.0",
  rules: DEFAULT_WKR_FILTER_RULES,
  lastModified: new Date()
}

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