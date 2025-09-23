# Story 6: WKR Prompt Engineering

**Sprint:** 2
**Estimate:** 1-2 dagen
**Priority:** High

## User Story
Als systeem wil ik gestructureerde WKR analyse prompts hebben zodat Gemini AI consistente en accurate analyses kan genereren volgens Nederlandse regelgeving.

## Acceptatiecriteria
- [x] Prompt templates voor WKR analyse
- [x] Context injectie van referentie docs
- [x] Response parsing en structurering
- [x] Nederlandse boekhoudterminologie
- [x] Consistente output formatting
- [x] Error handling voor onverwachte responses

## WKR Analysis Requirements (uit PRD)

### Basis Analyse Vereisten
```typescript
// src/lib/prompts/wkr-analysis-types.ts
export interface WKRAnalysisRequest {
  transactions: FilteredTransaction[]
  companyInfo?: {
    name: string
    kvkNumber?: string
    fiscalYear: number
  }
  analysisType: 'standard' | 'compliance' | 'detailed'
  includeCalculations: boolean
}

export interface WKRAnalysisResponse {
  summary: string
  findings: WKRFinding[]
  exemptions: WKRExemption[]
  calculations: WKRCalculations
  recommendations: string[]
  confidence: number // Percentage
}

export interface WKRFinding {
  transactionId: string
  accountId: string
  description: string
  amount: number
  isWKRRelevant: boolean
  confidence: number
  reasoning: string
  exemptionApplied?: string
}

export interface WKRExemption {
  type: string
  description: string
  applicableTransactions: string[]
  totalAmount: number
  legalReference: string
}

export interface WKRCalculations {
  totalWageSum: number
  freeSpace: number
  usedSpace: number
  usagePercentage: number
  remainingSpace: number
}
```

## Core Prompt Templates

### Standard WKR Analysis Prompt
```typescript
// src/lib/prompts/wkr-prompts.ts
export class WKRPromptBuilder {
  private static readonly BASE_PROMPT = `
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je analyseert boekhoudkundige transacties om te bepalen welke kosten onder de WKR vallen.

BELANGRIJK:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen waar relevant
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte context en je kennis

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering voor je beslissing**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. Samenvatting
2. Belangrijkste bevindingen per boeking
3. Vrijstellingen overzicht
4. Berekeningen vrije ruimte
5. Aanbevelingen
`

  static buildStandardPrompt(
    transactions: FilteredTransaction[],
    context?: string
  ): string {
    const transactionsData = this.formatTransactionsForAI(transactions)

    return `${this.BASE_PROMPT}

${context ? `CONTEXT:\n${context}\n` : ''}

TRANSACTIEGEGEVENS:
${transactionsData}

Analyseer deze transacties volgens de Nederlandse werkkostenregeling.`
  }

  static buildCompliancePrompt(
    transactions: FilteredTransaction[],
    companyInfo: any
  ): string {
    return `${this.BASE_PROMPT}

BEDRIJFSGEGEVENS:
- Naam: ${companyInfo.name}
- KvK: ${companyInfo.kvkNumber || 'Niet beschikbaar'}
- Boekjaar: ${companyInfo.fiscalYear}

COMPLIANCE CHECK:
Voer een grondige compliance check uit volgens de Nederlandse WKR-regelgeving.
Let specifiek op:
- Juiste toepassing van vrijstellingen
- Overschrijding van vrije ruimte
- Mogelijke risico's voor de belastingdienst
- Aanbevelingen voor verbetering

TRANSACTIEGEGEVENS:
${this.formatTransactionsForAI(transactions)}

Geef een compliance rapport met risico-inschatting.`
  }

  private static formatTransactionsForAI(
    transactions: FilteredTransaction[]
  ): string {
    const header = "| Grootboek | Boeking | Bedrag | Datum |"
    const separator = "|---|---|---|---|"

    const rows = transactions.map(tx =>
      `| ${tx.grootboek} | ${tx.boeking} | €${tx.bedrag.toFixed(2)} | ${tx.datum} |`
    )

    return [header, separator, ...rows].join('\n')
  }

  static buildDetailedPrompt(
    transactions: FilteredTransaction[],
    wageSum?: number
  ): string {
    const wageSumText = wageSum
      ? `LOONSOM: €${wageSum.toFixed(2)} (voor berekening vrije ruimte)`
      : 'LOONSOM: Niet beschikbaar - schat een redelijke loonsom voor MKB bedrijf'

    return `${this.BASE_PROMPT}

${wageSumText}

GEDETAILLEERDE ANALYSE:
Voor elke transactie geef je:
1. WKR classificatie met redenering
2. Toepasselijke vrijstelling (indien van toepassing)
3. Impact op vrije ruimte berekening
4. Mogelijke aandachtspunten
5. Alternatieve behandeling indien mogelijk

BEREKENINGEN:
- Bereken de vrije ruimte (1,7% van loonsom)
- Toon het verbruik van de vrije ruimte
- Geef percentage gebruikt van beschikbare ruimte
- Waarschuw bij overschrijding

TRANSACTIEGEGEVENS:
${this.formatTransactionsForAI(transactions)}

Geef een uitgebreide analyse met alle berekeningen.`
  }
}
```

### Context Enhancement
```typescript
// src/lib/prompts/context-builder.ts
export class WKRContextBuilder {
  private wkrRules: string = ''
  private exemptions: string = ''
  private calculations: string = ''

  async loadWKRContext(): Promise<void> {
    // Load from reference documents (wkr1.pdf, wkr2.pdf)
    this.wkrRules = await this.loadWKRRules()
    this.exemptions = await this.loadExemptions()
    this.calculations = await this.loadCalculationRules()
  }

  buildContext(): string {
    return `
WERKKOSTENREGELING CONTEXT:

${this.wkrRules}

VRIJSTELLINGEN:
${this.exemptions}

BEREKENINGEN:
${this.calculations}

BELANGRIJKE UITGANGSPUNTEN:
- Vrije ruimte = 1,7% van de loonsom (2025)
- Werknemers kunnen kiezen tussen vrije ruimte en gerichte vrijstellingen
- Overschrijding van vrije ruimte wordt belast als loon
- Administratieplicht voor alle verstrekte vergoedingen
`
  }

  private async loadWKRRules(): Promise<string> {
    return `
WERKKOSTENREGELING BASISREGELS:

1. Definitie werkkosten:
   - Kosten die de werkgever maakt voor de werknemer
   - Vergoedingen en verstrekkingen aan werknemers
   - Niet-loonbestanddelen die wel belast kunnen worden

2. Vrije ruimte:
   - 1,7% van de loonsom (belastbaar loon)
   - Werkgever mag vrij besteden binnen deze ruimte
   - Overschrijding wordt belast als loon bij werknemer

3. Gerichte vrijstellingen:
   - Alternatief voor vrije ruimte
   - Specifieke kostensoorten met eigen regels
   - Geen belasting bij juiste toepassing
`
  }

  private async loadExemptions(): Promise<string> {
    return `
GERICHTE VRIJSTELLINGEN:

1. Reiskosten woon-werk:
   - €0,23 per km (2025)
   - Maximaal 75 km enkele reis
   - Alternatief: OV-vergoeding werkelijke kosten

2. Reiskosten zakelijk:
   - €0,23 per km zakelijke kilometers
   - Werkelijke kosten OV zakelijk
   - Verblijfkosten volgens normen

3. Opleidingskosten:
   - Vakgerichte opleidingen volledig vrijgesteld
   - Algemene opleidingen beperkt vrijgesteld

4. Relatiegeschenken:
   - Maximaal €50 per relatie per jaar
   - Bedrijfslogo verplicht

5. Representatiekosten:
   - Zakelijke bijeenkomsten
   - Maximaal redelijke kosten
`
  }

  private async loadCalculationRules(): Promise<string> {
    return `
BEREKENING VRIJE RUIMTE:

1. Loonsom bepaling:
   - Alle belastbare lonen
   - Exclusief DGA-loon (bij <5% aandeelhouderschap)
   - Inclusief bonussen en overwerk

2. Vrije ruimte berekening:
   - Loonsom × 1,7% = vrije ruimte
   - Minimum €500 per werknemer
   - Maximum €1.200 per werknemer

3. Verbruik tracking:
   - Som alle WKR-relevante kosten
   - Vergelijk met beschikbare ruimte
   - Monitor overschrijding per periode
`
  }
}
```

## Response Parsing & Validation

### Structured Response Parser
```typescript
// src/lib/prompts/response-parser.ts
export class WKRResponseParser {
  parseAnalysisResponse(rawResponse: string): WKRAnalysisResponse {
    try {
      // Extract sections using regex patterns
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
        error
      )
    }
  }

  private extractSections(response: string): Record<string, string> {
    const sections: Record<string, string> = {}

    // Extract markdown sections
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

  private extractFindings(findingsText: string): WKRFinding[] {
    const findings: WKRFinding[] = []

    // Parse table format or list format
    const lines = findingsText.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.includes('|') && !line.includes('---')) {
        // Table format
        const finding = this.parseTableRow(line)
        if (finding) findings.push(finding)
      } else if (line.match(/^\d+\./)) {
        // List format
        const finding = this.parseListItem(line, findingsText)
        if (finding) findings.push(finding)
      }
    }

    return findings
  }

  private parseTableRow(row: string): WKRFinding | null {
    const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell)

    if (cells.length < 4) return null

    return {
      transactionId: this.extractTransactionId(cells[0]),
      accountId: this.extractAccountId(cells[0]),
      description: cells[1],
      amount: this.parseAmount(cells[2]),
      isWKRRelevant: this.parseWKRRelevant(cells[3]),
      confidence: this.parseConfidence(cells[4] || '50%'),
      reasoning: cells[5] || 'Geen specifieke redenering gegeven'
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

    // Extract numerical values using regex
    const wageSum = this.extractAmount(calculationsText, /loonsom.*?€?([0-9,.]+ )/i)
    const freeSpace = this.extractAmount(calculationsText, /vrije ruimte.*?€?([0-9,.]+)/i)
    const usedSpace = this.extractAmount(calculationsText, /gebruikt.*?€?([0-9,.]+)/i)
    const percentage = this.extractPercentage(calculationsText, /([0-9,.]+)%/)

    return {
      totalWageSum: wageSum || 0,
      freeSpace: freeSpace || (wageSum * 0.017),
      usedSpace: usedSpace || 0,
      usagePercentage: percentage || 0,
      remainingSpace: Math.max(0, (freeSpace || 0) - (usedSpace || 0))
    }
  }

  private extractAmount(text: string, pattern: RegExp): number {
    const match = text.match(pattern)
    if (!match) return 0

    return parseFloat(match[1].replace(/[,\s]/g, '')) || 0
  }

  private extractPercentage(text: string, pattern: RegExp): number {
    const match = text.match(pattern)
    if (!match) return 0

    return parseFloat(match[1].replace(',', '.')) || 0
  }

  private parseAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/[€\s,]/g, '')
    return parseFloat(cleaned) || 0
  }

  private parseWKRRelevant(relevantStr: string): boolean {
    const lower = relevantStr.toLowerCase()
    return lower.includes('ja') || lower.includes('yes') || lower.includes('wel')
  }

  private parseConfidence(confidenceStr: string): number {
    const match = confidenceStr.match(/(\d+)%?/)
    return match ? parseInt(match[1]) : 50
  }
}
```

## Quality Assurance & Validation

### Response Validation
```typescript
// src/lib/prompts/response-validator.ts
export class ResponseValidator {
  validateWKRResponse(response: WKRAnalysisResponse): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate summary
    if (!response.summary || response.summary.length < 50) {
      errors.push('Samenvatting is te kort of ontbreekt')
    }

    // Validate findings
    if (!response.findings || response.findings.length === 0) {
      errors.push('Geen bevindingen gevonden in response')
    }

    for (const finding of response.findings) {
      if (finding.confidence < 10 || finding.confidence > 100) {
        warnings.push(`Onrealistische confidence voor ${finding.transactionId}: ${finding.confidence}%`)
      }

      if (!finding.reasoning || finding.reasoning.length < 10) {
        warnings.push(`Onvoldoende redenering voor ${finding.transactionId}`)
      }
    }

    // Validate calculations
    if (response.calculations.usagePercentage > 120) {
      warnings.push('Zeer hoog verbruik van vrije ruimte gedetecteerd (>120%)')
    }

    if (response.calculations.freeSpace <= 0) {
      errors.push('Vrije ruimte berekening lijkt incorrect')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateQualityScore(response, errors, warnings)
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
    if (response.summary && response.findings.length > 0) score += 5
    if (response.exemptions && response.exemptions.length > 0) score += 5
    if (response.recommendations && response.recommendations.length > 0) score += 5

    // Bonus for high confidence findings
    const avgConfidence = response.findings.reduce((sum, f) => sum + f.confidence, 0) / response.findings.length
    if (avgConfidence > 80) score += 10

    return Math.max(0, Math.min(100, score))
  }
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}
```

## Testing & Quality Assurance

### Prompt Testing
```typescript
// src/lib/prompts/__tests__/wkr-prompts.test.ts
describe('WKR Prompt Engineering', () => {
  test('should build standard prompt with transactions', () => {
    const transactions = [
      {
        grootboek: '440000 Huur',
        boeking: '108308 Spitters Vastgoed BV - 2023-01-01',
        bedrag: 9834.50,
        datum: '2023-01-01',
        accountId: '440000',
        transactionId: '108308'
      }
    ]

    const prompt = WKRPromptBuilder.buildStandardPrompt(transactions)

    expect(prompt).toContain('werkkostenregeling')
    expect(prompt).toContain('440000 Huur')
    expect(prompt).toContain('€9834.50')
    expect(prompt).toContain('Nederlandse boekhoudterminologie')
  })

  test('should parse response correctly', () => {
    const mockResponse = `
## Samenvatting
Dit is een test samenvatting.

## Belangrijkste Bevindingen
| Grootboek | Beschrijving | WKR Relevant | Confidence |
|---|---|---|---|
| 440000 | Huurkosten | Ja | 85% |

## Berekeningen
Loonsom: €100.000
Vrije ruimte: €1.700
Gebruikt: €500
Percentage: 29%
`

    const parser = new WKRResponseParser()
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.summary).toContain('test samenvatting')
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].confidence).toBe(85)
    expect(result.calculations.totalWageSum).toBe(100000)
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "pdf2pic": "^2.1.4"
  }
}
```

## Definition of Done
- [ ] WKR prompt templates geïmplementeerd
- [ ] Context builder met referentie documenten
- [ ] Response parser voor gestructureerde output
- [ ] Validatie van AI responses
- [ ] Nederlandse terminologie consistent gebruikt
- [ ] Error handling voor parsing failures
- [ ] Unit tests voor alle prompt functies
- [ ] Quality score >80 voor test responses

## Performance Targets
- Prompt generatie: <100ms
- Response parsing: <500ms
- Context loading: <2 seconden
- Validation: <200ms
- Overall quality score: >85%