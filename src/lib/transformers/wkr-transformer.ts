import { FilteredTransaction, FilterResult, FilterStats } from '@/types/filter'

export class WKRTransformer {
  transformToTableFormat(transactions: FilteredTransaction[]): string {
    if (transactions.length === 0) {
      return "| Grootboek | Boeking | Bedrag | Datum |\n|---|---|---|---|\n| Geen gegevens | - | - | - |"
    }

    const headers = "| Grootboek | Boeking | Bedrag | Datum |"
    const separator = "|---|---|---|---|"

    const rows = transactions.map(tx => {
      const grootboek = this.escapeTableCell(tx.grootboek)
      const boeking = this.escapeTableCell(tx.boeking)
      const bedrag = this.formatCurrency(tx.bedrag)
      const datum = this.formatDate(tx.datum)

      return `| ${grootboek} | ${boeking} | ${bedrag} | ${datum} |`
    })

    return [headers, separator, ...rows].join('\n')
  }

  transformToCSV(transactions: FilteredTransaction[]): string {
    const headers = "Grootboek,Boeking,Bedrag,Datum,Reden"

    if (transactions.length === 0) {
      return headers + "\n"
    }

    const rows = transactions.map(tx => {
      const grootboek = this.escapeCSVCell(tx.grootboek)
      const boeking = this.escapeCSVCell(tx.boeking)
      const bedrag = tx.bedrag.toString()
      const datum = tx.datum
      const reden = this.escapeCSVCell(tx.filterReason || '')

      return `${grootboek},${boeking},${bedrag},${datum},${reden}`
    })

    return [headers, ...rows].join('\n')
  }

  transformToExcelFormat(transactions: FilteredTransaction[]): any[] {
    const headers = [
      'Grootboek',
      'Boeking',
      'Bedrag',
      'Datum',
      'Account ID',
      'Transaction ID',
      'Filter Reden'
    ]

    const rows = transactions.map(tx => [
      tx.grootboek,
      tx.boeking,
      tx.bedrag,
      tx.datum,
      tx.accountId,
      tx.transactionId,
      tx.filterReason || ''
    ])

    return [headers, ...rows]
  }

  calculateStats(
    transactions: FilteredTransaction[],
    totalInputLines: number
  ): FilterStats {
    if (transactions.length === 0) {
      return {
        totalInput: totalInputLines,
        totalFiltered: 0,
        filterRatio: '0.0',
        totalAmount: 0,
        dateRange: {
          earliest: '',
          latest: ''
        },
        accountBreakdown: {}
      }
    }

    const totalFiltered = transactions.length
    const filterRatio = totalInputLines > 0 ?
      ((totalFiltered / totalInputLines) * 100).toFixed(1) : '0.0'

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.bedrag, 0)

    // Calculate date range
    const dates = transactions
      .map(tx => tx.datum)
      .filter(date => date && date.length >= 10)
      .sort()

    const dateRange = {
      earliest: dates[0] || '',
      latest: dates[dates.length - 1] || ''
    }

    // Account breakdown by prefix
    const accountBreakdown: Record<string, number> = {}
    transactions.forEach(tx => {
      const accountPrefix = tx.accountId.substring(0, 2) + 'xxxx'
      accountBreakdown[accountPrefix] = (accountBreakdown[accountPrefix] || 0) + 1
    })

    return {
      totalInput: totalInputLines,
      totalFiltered,
      filterRatio,
      totalAmount,
      dateRange,
      accountBreakdown
    }
  }

  createFilterResult(
    transactions: FilteredTransaction[],
    totalInputLines: number
  ): FilterResult {
    const stats = this.calculateStats(transactions, totalInputLines)
    const tableFormat = this.transformToTableFormat(transactions)
    const csvFormat = this.transformToCSV(transactions)

    return {
      filtered: transactions,
      tableFormat,
      csvFormat,
      stats
    }
  }

  // Helper methods for formatting
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  private formatDate(dateString: string): string {
    try {
      if (!dateString) return '-'

      // Handle various date formats
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return dateString // Return original if can't parse
      }

      return date.toLocaleDateString('nl-NL')
    } catch {
      return dateString
    }
  }

  private escapeTableCell(text: string): string {
    if (!text) return '-'

    // Escape pipe characters and limit length for readability
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .substring(0, 50) + (text.length > 50 ? '...' : '')
  }

  private escapeCSVCell(text: string): string {
    if (!text) return ''

    // Escape quotes and wrap in quotes if contains comma, quote or newline
    const needsQuotes = /[",\n\r]/.test(text)
    const escaped = text.replace(/"/g, '""')

    return needsQuotes ? `"${escaped}"` : escaped
  }

  // Generate summary statistics text
  generateSummaryText(stats: FilterStats): string {
    const lines = [
      `**WKR Filter Resultaten**`,
      ``,
      `📊 **Statistieken:**`,
      `• Totaal transactieregels: ${stats.totalInput.toLocaleString('nl-NL')}`,
      `• Gefilterde regels: ${stats.totalFiltered.toLocaleString('nl-NL')} (${stats.filterRatio}%)`,
      `• Totaalbedrag: ${this.formatCurrency(stats.totalAmount)}`,
      ``
    ]

    if (stats.dateRange.earliest && stats.dateRange.latest) {
      lines.push(`📅 **Periode:** ${this.formatDate(stats.dateRange.earliest)} tot ${this.formatDate(stats.dateRange.latest)}`)
      lines.push('')
    }

    if (Object.keys(stats.accountBreakdown).length > 0) {
      lines.push(`🏷️ **Verdeling per rekeninggroep:**`)
      Object.entries(stats.accountBreakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([prefix, count]) => {
          const percentage = ((count / stats.totalFiltered) * 100).toFixed(1)
          lines.push(`• ${prefix}: ${count} regels (${percentage}%)`)
        })
    }

    return lines.join('\n')
  }

  // Create downloadable content
  createDownloadContent(result: FilterResult, format: 'csv' | 'json' | 'excel'): {
    content: string | object
    filename: string
    mimeType: string
  } {
    const timestamp = new Date().toISOString().split('T')[0]

    switch (format) {
      case 'csv':
        return {
          content: result.csvFormat,
          filename: `wkr-filtering-${timestamp}.csv`,
          mimeType: 'text/csv'
        }

      case 'json':
        return {
          content: {
            metadata: {
              generatedAt: new Date().toISOString(),
              stats: result.stats
            },
            transactions: result.filtered
          },
          filename: `wkr-filtering-${timestamp}.json`,
          mimeType: 'application/json'
        }

      case 'excel':
        return {
          content: this.transformToExcelFormat(result.filtered),
          filename: `wkr-filtering-${timestamp}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }

      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  }
}