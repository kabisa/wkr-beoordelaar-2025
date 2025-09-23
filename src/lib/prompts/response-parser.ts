import {
  WKRAnalysisResponse,
  WKRFinding,
  WKRExemption,
  WKRCalculations,
  ResponseParsingError
} from '../../types/wkr-analysis'

export class WKRResponseParser {
  parseAnalysisResponse(rawResponse: string): WKRAnalysisResponse {
    try {
      const sections = this.extractSections(rawResponse)

      return {
        summary: this.extractSummary(sections.summary),
        findings: this.extractFindings(sections.findings),
        exemptions: this.extractExemptions(sections.exemptions),
        calculations: this.extractCalculations(sections.calculations),
        recommendations: this.extractRecommendations(sections.recommendations),
        confidence: this.extractOverallConfidence(rawResponse)
      }
    } catch (error) {
      throw new ResponseParsingError(
        'Failed to parse WKR analysis response',
        rawResponse,
        error as Error
      )
    }
  }

  private extractSections(response: string): Record<string, string> {
    const sections: Record<string, string> = {}

    const sectionPattern = /#{1,3}\s*([^#\n]+)\n([\s\S]*?)(?=#{1,3}\s|$)/g
    let match

    while ((match = sectionPattern.exec(response)) !== null) {
      const title = match[1].trim().toLowerCase()
      const content = match[2].trim()

      if (title.includes('samenvatting')) sections.summary = content
      if (title.includes('bevindingen')) sections.findings = content
      if (title.includes('vrijstellingen')) sections.exemptions = content
      if (title.includes('berekeningen')) sections.calculations = content
      if (title.includes('aanbevelingen')) sections.recommendations = content
    }

    return sections
  }

  private extractSummary(summaryText: string): string {
    return summaryText || 'Geen samenvatting beschikbaar'
  }

  private extractFindings(findingsText: string): WKRFinding[] {
    const findings: WKRFinding[] = []

    if (!findingsText) return findings

    const lines = findingsText.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.includes('|') && !line.includes('---') &&
          !line.toLowerCase().includes('grootboek') &&
          !line.toLowerCase().includes('account')) {
        const finding = this.parseTableRow(line)
        if (finding) findings.push(finding)
      } else if (line.match(/^\d+\./)) {
        const finding = this.parseListItem(line, findingsText)
        if (finding) findings.push(finding)
      }
    }

    return findings
  }

  private parseTableRow(row: string): WKRFinding | null {
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell)

    if (cells.length < 3) return null

    // Handle different table formats
    let accountId = this.extractAccountId(cells[0])
    let description = cells[1]
    let amount = 0
    let isWKRRelevant = false
    let confidence = 50
    let reasoning = 'Geen specifieke redenering gegeven'

    if (cells.length === 3) {
      // 3 columns: Account | Description | Relevant
      isWKRRelevant = this.parseWKRRelevant(cells[2])
    } else if (cells.length === 4) {
      // 4 columns: Account | Description | Amount | Relevant
      amount = this.parseAmount(cells[2])
      isWKRRelevant = this.parseWKRRelevant(cells[3])
    } else if (cells.length >= 5) {
      // 5+ columns: Account | Description | Amount | Relevant | Confidence | Reasoning
      amount = this.parseAmount(cells[2])
      isWKRRelevant = this.parseWKRRelevant(cells[3])
      confidence = this.parseConfidence(cells[4] || '50%')
      if (cells.length >= 6) {
        reasoning = cells[5] || 'Geen specifieke redenering gegeven'
      }
    }

    return {
      transactionId: this.extractTransactionId(cells[0]),
      accountId,
      description,
      amount,
      isWKRRelevant,
      confidence,
      reasoning
    }
  }

  private parseListItem(line: string, context: string): WKRFinding | null {
    const match = line.match(/^\d+\.\s*(.+)/)
    if (!match) return null

    const content = match[1]
    const accountMatch = content.match(/(\d{6})/);
    const amountMatch = content.match(/€([0-9,.]+)/);
    const confidenceMatch = content.match(/(\d+)%/);

    return {
      transactionId: this.generateTransactionId(),
      accountId: accountMatch?.[1] || 'unknown',
      description: content,
      amount: amountMatch ? this.parseAmount(amountMatch[1]) : 0,
      isWKRRelevant: this.parseWKRRelevant(content),
      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
      reasoning: content
    }
  }

  private extractExemptions(exemptionsText: string): WKRExemption[] {
    const exemptions: WKRExemption[] = []

    if (!exemptionsText) return exemptions

    const exemptionPattern = /(\d+\.\s*[^\n]+(?:\n\s*-[^\n]+)*)/g
    const matches = exemptionsText.match(exemptionPattern)

    if (matches) {
      for (const match of matches) {
        const exemption = this.parseExemption(match.trim())
        if (exemption) exemptions.push(exemption)
      }
    }

    return exemptions
  }

  private parseExemption(exemptionText: string): WKRExemption | null {
    const lines = exemptionText.split('\n').filter(line => line.trim())
    if (lines.length === 0) return null

    const titleLine = lines[0]
    const titleMatch = titleLine.match(/\d+\.\s*(.+)/)
    const title = titleMatch?.[1] || titleLine

    const amountMatch = exemptionText.match(/€([0-9,.]+)/)
    const amount = amountMatch ? this.parseAmount(amountMatch[1]) : 0

    return {
      type: title,
      description: exemptionText,
      applicableTransactions: [],
      totalAmount: amount,
      legalReference: 'WKR 2025'
    }
  }

  private extractCalculations(calculationsText: string): WKRCalculations {
    const defaultCalc: WKRCalculations = {
      totalWageSum: 0,
      freeSpace: 0,
      usedSpace: 0,
      usagePercentage: 0,
      remainingSpace: 0
    }

    if (!calculationsText) return defaultCalc

    const wageSum = this.extractAmount(calculationsText, /loonsom.*?€?([0-9,.]+)/i)
    const freeSpace = this.extractAmount(calculationsText, /vrije ruimte.*?€?([0-9,.]+)/i)
    const usedSpace = this.extractAmount(calculationsText, /gebruikt.*?€?([0-9,.]+)/i)
    const percentage = this.extractPercentage(calculationsText, /percentage.*?([0-9,.]+)%/i)

    const calculatedFreeSpace = freeSpace || (wageSum * 0.017)
    const calculatedUsedSpace = usedSpace || 0
    const calculatedPercentage = percentage || (calculatedFreeSpace > 0 ? (calculatedUsedSpace / calculatedFreeSpace) * 100 : 0)

    return {
      totalWageSum: wageSum || 0,
      freeSpace: calculatedFreeSpace,
      usedSpace: calculatedUsedSpace,
      usagePercentage: calculatedPercentage,
      remainingSpace: Math.max(0, calculatedFreeSpace - calculatedUsedSpace)
    }
  }

  private extractRecommendations(recommendationsText: string): string[] {
    if (!recommendationsText) return []

    const lines = recommendationsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    const recommendations: string[] = []

    for (const line of lines) {
      if (line.match(/^[-*]\s+/) || line.match(/^\d+\.\s+/)) {
        recommendations.push(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
      } else if (line.length > 10 && !line.includes('#')) {
        recommendations.push(line)
      }
    }

    return recommendations
  }

  private extractOverallConfidence(response: string): number {
    // Look for confidence values specifically in findings tables
    const findingsSection = this.extractSections(response).findings || ''
    const confidenceMatches = findingsSection.match(/(\d+)%/g)

    if (!confidenceMatches || confidenceMatches.length === 0) {
      // Fallback to any confidence values in the whole response
      const allMatches = response.match(/(\d+)%/g)
      if (!allMatches) return 50

      const confidences = allMatches.map(match =>
        parseInt(match.replace('%', ''))
      ).filter(num => num >= 30 && num <= 100) // Filter out unrealistic values

      if (confidences.length === 0) return 50
      return Math.round(confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length)
    }

    const confidences = confidenceMatches.map(match =>
      parseInt(match.replace('%', ''))
    ).filter(num => num >= 0 && num <= 100)

    if (confidences.length === 0) return 50

    return Math.round(confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length)
  }

  private extractAmount(text: string, pattern: RegExp): number {
    const match = text.match(pattern)
    if (!match) return 0

    // Handle both European (1.234,56) and US (1,234.56) number formats
    let cleanedAmount = match[1].replace(/[€\s]/g, '')

    // If there's a comma followed by exactly 2 digits at the end, treat as decimal separator
    if (/,\d{2}$/.test(cleanedAmount)) {
      cleanedAmount = cleanedAmount.replace(/\./g, '').replace(',', '.')
    } else {
      // Otherwise, remove commas (thousands separators)
      cleanedAmount = cleanedAmount.replace(/,/g, '')
    }

    return parseFloat(cleanedAmount) || 0
  }

  private extractPercentage(text: string, pattern: RegExp): number {
    const match = text.match(pattern)
    if (!match) return 0

    return parseFloat(match[1].replace(',', '.')) || 0
  }

  private parseAmount(amountStr: string): number {
    // Remove currency symbols and whitespace
    let cleaned = amountStr.replace(/[€\s]/g, '')

    // Handle different number formats
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Determine format by position of comma vs dot
      const lastComma = cleaned.lastIndexOf(',')
      const lastDot = cleaned.lastIndexOf('.')

      if (lastComma > lastDot) {
        // European format: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
      } else {
        // US format: 1,234.56
        cleaned = cleaned.replace(/,/g, '')
      }
    } else if (cleaned.includes(',')) {
      // Only comma - could be thousands separator or decimal
      const commaCount = (cleaned.match(/,/g) || []).length
      if (commaCount === 1 && cleaned.indexOf(',') === cleaned.length - 3) {
        // Likely decimal comma: 1234,56
        cleaned = cleaned.replace(',', '.')
      } else {
        // Thousands separator: 1,234
        cleaned = cleaned.replace(/,/g, '')
      }
    }

    return parseFloat(cleaned) || 0
  }

  private parseWKRRelevant(relevantStr: string): boolean {
    const lower = relevantStr.toLowerCase()

    // Check for negative indicators first
    if (lower.includes('nee') || lower.includes('no') || lower.includes('niet')) {
      return false
    }

    // Then check for positive indicators
    return lower.includes('ja') || lower.includes('yes') || lower.includes('wel') || lower.includes('relevant')
  }

  private parseConfidence(confidenceStr: string): number {
    const match = confidenceStr.match(/(\d+)%?/)
    return match ? parseInt(match[1]) : 50
  }

  private extractTransactionId(cellContent: string): string {
    const match = cellContent.match(/(\d+)/)
    return match?.[1] || this.generateTransactionId()
  }

  private extractAccountId(cellContent: string): string {
    const match = cellContent.match(/(\d{6})/)
    return match?.[1] || 'unknown'
  }

  private generateTransactionId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}