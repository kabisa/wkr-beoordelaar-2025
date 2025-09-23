import {
  FilterRules,
  FilteredTransaction,
  FilterError,
  DEFAULT_WKR_FILTER_RULES
} from '@/types/filter'
import { XAFTransaction, XAFTransactionLine, XAFAccount } from '@/types/xaf'

export class TransactionFilter {
  protected rules: FilterRules

  constructor(rules: FilterRules = DEFAULT_WKR_FILTER_RULES) {
    this.rules = rules
  }

  filterTransactions(
    transactions: XAFTransaction[],
    accounts: XAFAccount[] = []
  ): FilteredTransaction[] {
    const filtered: FilteredTransaction[] = []

    try {
      for (const transaction of transactions) {
        for (const line of transaction.lines) {
          if (this.shouldIncludeLine(line)) {
            filtered.push({
              ...this.transformToWKRFormat(transaction, line, accounts),
              filterReason: this.getInclusionReason(line)
            })
          }
        }
      }

      return filtered
    } catch (error) {
      throw new FilterError(
        `Fout bij filteren van transacties: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        'FILTER_PROCESSING_ERROR',
        { transactionCount: transactions.length }
      )
    }
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

  protected getInclusionReason(line: XAFTransactionLine): string {
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

  protected transformToWKRFormat(
    transaction: XAFTransaction,
    line: XAFTransactionLine,
    accounts: XAFAccount[]
  ): Omit<FilteredTransaction, 'filterReason'> {
    // Find account name
    const account = accounts.find(acc => acc.id === line.accountId)
    const accountName = account?.name || line.accountName || 'Onbekende rekening'

    // Format grootboek
    const grootboek = `${line.accountId} ${accountName}`

    // Format boeking (transaction number + description + date)
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

  // Get filtering statistics
  getFilterStats(
    originalTransactions: XAFTransaction[],
    filteredTransactions: FilteredTransaction[]
  ): {
    totalInput: number
    totalFiltered: number
    filterRatio: string
    totalAmount: number
    accountBreakdown: Record<string, number>
  } {
    const totalInput = originalTransactions.reduce((sum, tx) => sum + tx.lines.length, 0)
    const totalFiltered = filteredTransactions.length
    const filterRatio = totalInput > 0 ? ((totalFiltered / totalInput) * 100).toFixed(1) : '0'
    const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.bedrag, 0)

    // Account breakdown
    const accountBreakdown: Record<string, number> = {}
    filteredTransactions.forEach(tx => {
      const accountPrefix = tx.accountId.substring(0, 2)
      accountBreakdown[accountPrefix] = (accountBreakdown[accountPrefix] || 0) + 1
    })

    return {
      totalInput,
      totalFiltered,
      filterRatio,
      totalAmount,
      accountBreakdown
    }
  }

  // Validate filter rules
  validateRules(rules: FilterRules): void {
    if (!rules.includePatterns || rules.includePatterns.length === 0) {
      throw new FilterError(
        'Filter regels moeten minimaal één include pattern bevatten',
        'INVALID_FILTER_RULES'
      )
    }

    // Validate patterns
    const allPatterns = [...rules.includePatterns, ...rules.excludePatterns]
    for (const pattern of allPatterns) {
      if (typeof pattern !== 'string' || pattern.length === 0) {
        throw new FilterError(
          `Ongeldig filter pattern: ${pattern}`,
          'INVALID_PATTERN'
        )
      }
    }

    // Validate custom rules
    if (rules.customRules) {
      for (const rule of rules.customRules) {
        if (!rule.name || !rule.condition || typeof rule.condition !== 'function') {
          throw new FilterError(
            `Ongeldige custom rule: ${rule.name}`,
            'INVALID_CUSTOM_RULE'
          )
        }
      }
    }
  }
}