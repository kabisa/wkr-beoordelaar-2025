import { WKRAnalysisResponse, ValidationResult } from '../../types/wkr-analysis'

export class ResponseValidator {
  validateWKRResponse(response: WKRAnalysisResponse): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    this.validateSummary(response.summary, errors, warnings)
    this.validateFindings(response.findings, errors, warnings)
    this.validateCalculations(response.calculations, errors, warnings)
    this.validateExemptions(response.exemptions, warnings)
    this.validateRecommendations(response.recommendations, warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateQualityScore(response, errors, warnings)
    }
  }

  private validateSummary(summary: string, errors: string[], warnings: string[]): void {
    if (!summary || summary.trim().length === 0) {
      errors.push('Samenvatting ontbreekt')
      return
    }

    if (summary.length < 50) {
      warnings.push('Samenvatting is zeer kort (< 50 karakters)')
    }

    if (summary.length > 2000) {
      warnings.push('Samenvatting is zeer lang (> 2000 karakters)')
    }

    if (!this.containsDutchContent(summary)) {
      warnings.push('Samenvatting bevat mogelijk geen Nederlandse terminologie')
    }
  }

  private validateFindings(findings: any[], errors: string[], warnings: string[]): void {
    if (!findings || findings.length === 0) {
      errors.push('Geen bevindingen gevonden in response')
      return
    }

    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i]

      if (!finding.transactionId) {
        errors.push(`Bevinding ${i + 1}: TransactionId ontbreekt`)
      }

      if (!finding.accountId) {
        errors.push(`Bevinding ${i + 1}: AccountId ontbreekt`)
      }

      if (typeof finding.amount !== 'number' || finding.amount < 0) {
        warnings.push(`Bevinding ${i + 1}: Ongeldig bedrag (${finding.amount})`)
      }

      if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 100) {
        warnings.push(`Bevinding ${i + 1}: Onrealistische confidence (${finding.confidence}%)`)
      }

      if (finding.confidence < 30) {
        warnings.push(`Bevinding ${i + 1}: Zeer lage confidence (${finding.confidence}%)`)
      }

      if (!finding.reasoning || finding.reasoning.length < 10) {
        warnings.push(`Bevinding ${i + 1}: Onvoldoende redenering`)
      }

      if (typeof finding.isWKRRelevant !== 'boolean') {
        errors.push(`Bevinding ${i + 1}: WKR relevantie moet ja/nee zijn`)
      }
    }
  }

  private validateCalculations(calculations: any, errors: string[], warnings: string[]): void {
    if (!calculations) {
      errors.push('Berekeningen ontbreken')
      return
    }

    if (typeof calculations.totalWageSum !== 'number' || calculations.totalWageSum < 0) {
      warnings.push(`Ongeldig loonsom bedrag: ${calculations.totalWageSum}`)
    }

    if (typeof calculations.freeSpace !== 'number' || calculations.freeSpace <= 0) {
      errors.push('Vrije ruimte berekening lijkt incorrect')
    }

    if (typeof calculations.usedSpace !== 'number' || calculations.usedSpace < 0) {
      warnings.push(`Ongeldig gebruikt bedrag: ${calculations.usedSpace}`)
    }

    if (typeof calculations.usagePercentage !== 'number' || calculations.usagePercentage < 0) {
      warnings.push(`Ongeldig gebruikspercentage: ${calculations.usagePercentage}%`)
    }

    if (calculations.usagePercentage > 120) {
      warnings.push('Zeer hoog verbruik van vrije ruimte gedetecteerd (>120%)')
    }

    if (calculations.usagePercentage > 100) {
      warnings.push('Overschrijding van vrije ruimte gedetecteerd')
    }

    // Check logical consistency
    if (calculations.freeSpace > 0 && calculations.usedSpace > 0) {
      const expectedPercentage = (calculations.usedSpace / calculations.freeSpace) * 100
      const actualPercentage = calculations.usagePercentage

      if (Math.abs(expectedPercentage - actualPercentage) > 5) {
        warnings.push('Inconsistentie in percentage berekening gedetecteerd')
      }
    }

    if (calculations.remainingSpace !== calculations.freeSpace - calculations.usedSpace) {
      warnings.push('Inconsistentie in resterende ruimte berekening')
    }
  }

  private validateExemptions(exemptions: any[], warnings: string[]): void {
    if (!exemptions || exemptions.length === 0) {
      warnings.push('Geen vrijstellingen geanalyseerd')
      return
    }

    for (let i = 0; i < exemptions.length; i++) {
      const exemption = exemptions[i]

      if (!exemption.type || exemption.type.length < 5) {
        warnings.push(`Vrijstelling ${i + 1}: Onduidelijk type`)
      }

      if (!exemption.description || exemption.description.length < 10) {
        warnings.push(`Vrijstelling ${i + 1}: Onvoldoende beschrijving`)
      }

      if (typeof exemption.totalAmount !== 'number' || exemption.totalAmount < 0) {
        warnings.push(`Vrijstelling ${i + 1}: Ongeldig bedrag`)
      }
    }
  }

  private validateRecommendations(recommendations: string[], warnings: string[]): void {
    if (!recommendations || recommendations.length === 0) {
      warnings.push('Geen aanbevelingen gegeven')
      return
    }

    for (let i = 0; i < recommendations.length; i++) {
      const recommendation = recommendations[i]

      if (!recommendation || recommendation.length < 10) {
        warnings.push(`Aanbeveling ${i + 1}: Te kort of leeg`)
      }
    }
  }

  private calculateQualityScore(
    response: WKRAnalysisResponse,
    errors: string[],
    warnings: string[]
  ): number {
    let score = 100

    // Deduct points for errors and warnings
    score -= errors.length * 20
    score -= warnings.length * 5

    // Bonus for completeness
    if (response.summary && response.summary.length >= 50) score += 5
    if (response.findings && response.findings.length > 0) score += 10
    if (response.exemptions && response.exemptions.length > 0) score += 5
    if (response.recommendations && response.recommendations.length > 0) score += 5
    if (response.calculations && response.calculations.freeSpace > 0) score += 5

    // Bonus for high confidence findings
    if (response.findings && response.findings.length > 0) {
      const avgConfidence = response.findings.reduce((sum, f) => sum + (f.confidence || 0), 0) / response.findings.length
      if (avgConfidence > 80) score += 10
      if (avgConfidence > 90) score += 5
    }

    // Bonus for detailed reasoning
    if (response.findings && response.findings.length > 0) {
      const avgReasoningLength = response.findings.reduce((sum, f) => sum + (f.reasoning?.length || 0), 0) / response.findings.length
      if (avgReasoningLength > 50) score += 5
    }

    // Bonus for Dutch terminology
    if (this.containsDutchContent(response.summary)) score += 5

    // Bonus for realistic calculations
    if (response.calculations && response.calculations.usagePercentage >= 0 && response.calculations.usagePercentage <= 100) {
      score += 5
    }

    return Math.max(0, score)
  }

  private containsDutchContent(text: string): boolean {
    const dutchTerms = [
      'werkkostenregeling', 'wkr', 'vrijstelling', 'loonsom', 'belastbaar',
      'vrije ruimte', 'werkgever', 'werknemer', 'belastingdienst',
      'reiskosten', 'representatie', 'geschenken', 'opleidingskosten'
    ]

    const lowerText = text.toLowerCase()
    return dutchTerms.some(term => lowerText.includes(term))
  }

  getValidationSummary(result: ValidationResult): string {
    let summary = `Validatie Score: ${result.score}/100`

    if (result.isValid) {
      summary += ` ✅ (Geldig)`
    } else {
      summary += ` ❌ (Ongeldig)`
    }

    if (result.errors.length > 0) {
      summary += `\n\nFouten (${result.errors.length}):`
      result.errors.forEach((error, i) => {
        summary += `\n${i + 1}. ${error}`
      })
    }

    if (result.warnings.length > 0) {
      summary += `\n\nWaarschuwingen (${result.warnings.length}):`
      result.warnings.forEach((warning, i) => {
        summary += `\n${i + 1}. ${warning}`
      })
    }

    return summary
  }
}