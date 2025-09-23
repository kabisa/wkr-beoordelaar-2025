# Story 9: WKR Analyse Features

**Sprint:** 3
**Estimate:** 2 dagen
**Priority:** Critical

## User Story
Als gebruiker wil ik een complete WKR analyse ontvangen met beoordeling per boeking, zekerheidspercentages, vrijstellingen en vrije ruimte berekening zodat ik een compleet inzicht krijg in mijn WKR compliance.

## Acceptatiecriteria
- [x] Beoordeling per boeking (WKR relevant ja/nee)
- [x] Zekerheidspercentage berekening (0-100%)
- [x] Vrijstellingen identificatie
- [x] Vrije ruimte calculatie
- [x] Overschrijding detectie en waarschuwingen
- [x] Aanbevelingen voor optimalisatie
- [x] Compliance risico assessment

## Core WKR Analysis Engine

### WKR Analysis Orchestrator
```typescript
// src/lib/wkr/analysis-orchestrator.ts
import { WKRAnalysisRequest, WKRAnalysisResponse } from '@/lib/prompts/wkr-analysis-types'
import { RetryableGeminiClient } from '@/lib/ai/gemini-client'
import { WKRPromptBuilder } from '@/lib/prompts/wkr-prompts'
import { WKRResponseParser } from '@/lib/prompts/response-parser'
import { WKRCalculationEngine } from './calculation-engine'
import { WKRExemptionAnalyzer } from './exemption-analyzer'
import { WKRComplianceChecker } from './compliance-checker'

export class WKRAnalysisOrchestrator {
  private geminiClient: RetryableGeminiClient
  private responseParser: WKRResponseParser
  private calculationEngine: WKRCalculationEngine
  private exemptionAnalyzer: WKRExemptionAnalyzer
  private complianceChecker: WKRComplianceChecker

  constructor() {
    this.geminiClient = new RetryableGeminiClient()
    this.responseParser = new WKRResponseParser()
    this.calculationEngine = new WKRCalculationEngine()
    this.exemptionAnalyzer = new WKRExemptionAnalyzer()
    this.complianceChecker = new WKRComplianceChecker()
  }

  async performCompleteAnalysis(request: WKRAnalysisRequest): Promise<WKRAnalysisResponse> {
    try {
      // Step 1: Generate AI analysis
      const aiAnalysis = await this.generateAIAnalysis(request)

      // Step 2: Enhance with calculations
      const enhancedAnalysis = await this.enhanceWithCalculations(aiAnalysis, request)

      // Step 3: Analyze exemptions
      const exemptionResults = await this.exemptionAnalyzer.analyzeExemptions(
        request.transactions,
        enhancedAnalysis.findings
      )

      // Step 4: Perform compliance check
      const complianceResults = await this.complianceChecker.checkCompliance(
        enhancedAnalysis,
        exemptionResults
      )

      // Step 5: Generate recommendations
      const recommendations = await this.generateRecommendations(
        enhancedAnalysis,
        exemptionResults,
        complianceResults
      )

      return {
        ...enhancedAnalysis,
        exemptions: exemptionResults,
        recommendations,
        complianceScore: complianceResults.score,
        riskLevel: complianceResults.riskLevel
      }

    } catch (error) {
      throw new WKRAnalysisError(
        'Complete WKR analysis failed',
        'ANALYSIS_ERROR',
        error
      )
    }
  }

  private async generateAIAnalysis(request: WKRAnalysisRequest): Promise<Partial<WKRAnalysisResponse>> {
    // Build appropriate prompt based on analysis type
    let prompt: string

    switch (request.analysisType) {
      case 'compliance':
        prompt = WKRPromptBuilder.buildCompliancePrompt(
          request.transactions,
          request.companyInfo
        )
        break
      case 'detailed':
        prompt = WKRPromptBuilder.buildDetailedPrompt(
          request.transactions,
          request.companyInfo?.wageSum
        )
        break
      default:
        prompt = WKRPromptBuilder.buildStandardPrompt(request.transactions)
    }

    // Get AI response
    const rawResponse = await this.geminiClient.generateAnalysisWithRetry(prompt)

    // Parse response into structured format
    return this.responseParser.parseAnalysisResponse(rawResponse)
  }

  private async enhanceWithCalculations(
    analysis: Partial<WKRAnalysisResponse>,
    request: WKRAnalysisRequest
  ): Promise<WKRAnalysisResponse> {
    // Calculate WKR metrics
    const calculations = this.calculationEngine.calculateWKRMetrics(
      request.transactions,
      analysis.findings || [],
      request.companyInfo?.wageSum
    )

    // Enhance findings with calculation details
    const enhancedFindings = analysis.findings?.map(finding => ({
      ...finding,
      calculationDetails: this.calculationEngine.getTransactionCalculationDetails(
        finding.transactionId,
        request.transactions
      )
    })) || []

    return {
      summary: analysis.summary || 'No summary available',
      findings: enhancedFindings,
      exemptions: analysis.exemptions || [],
      calculations,
      recommendations: analysis.recommendations || [],
      confidence: analysis.confidence || 50
    }
  }

  private async generateRecommendations(
    analysis: WKRAnalysisResponse,
    exemptions: WKRExemption[],
    compliance: any
  ): Promise<string[]> {
    const recommendations: string[] = []

    // Usage optimization recommendations
    if (analysis.calculations.usagePercentage > 90) {
      recommendations.push(
        'Overweeg gerichte vrijstellingen om de vrije ruimte te ontlasten'
      )
    }

    if (analysis.calculations.usagePercentage > 100) {
      recommendations.push(
        'URGENT: Vrije ruimte overschreden - neem direct actie om belastingaanslag te voorkomen'
      )
    }

    // Exemption recommendations
    const reiskostenTransactions = analysis.findings.filter(f =>
      f.description.toLowerCase().includes('reis') ||
      f.description.toLowerCase().includes('km')
    )

    if (reiskostenTransactions.length > 0) {
      recommendations.push(
        'Overweeg de reiskostenvrijstelling voor woon-werkverkeer (€0,23/km)'
      )
    }

    // Low confidence recommendations
    const lowConfidenceFindings = analysis.findings.filter(f => f.confidence < 70)
    if (lowConfidenceFindings.length > 0) {
      recommendations.push(
        `${lowConfidenceFindings.length} transacties hebben lage zekerheid - controleer handmatig`
      )
    }

    // Compliance recommendations
    if (compliance.riskLevel === 'HIGH') {
      recommendations.push(
        'Hoog compliance risico gedetecteerd - raadpleeg een fiscalist'
      )
    }

    return recommendations
  }
}
```

### WKR Calculation Engine
```typescript
// src/lib/wkr/calculation-engine.ts
export interface WKRCalculationDetails {
  transactionId: string
  isWKRRelevant: boolean
  amount: number
  exemptionApplied?: string
  impactOnFreeSpace: number
  reasoning: string[]
}

export class WKRCalculationEngine {
  private readonly FREE_SPACE_PERCENTAGE = 0.017 // 1.7% for 2025
  private readonly MIN_FREE_SPACE_PER_EMPLOYEE = 500
  private readonly MAX_FREE_SPACE_PER_EMPLOYEE = 1200

  calculateWKRMetrics(
    transactions: FilteredTransaction[],
    findings: WKRFinding[],
    providedWageSum?: number
  ): WKRCalculations {
    // Calculate or estimate wage sum
    const wageSum = providedWageSum || this.estimateWageSum(transactions)

    // Calculate free space
    const baseFreeSpace = wageSum * this.FREE_SPACE_PERCENTAGE
    const freeSpace = this.applyFreeSpaceLimits(baseFreeSpace, this.estimateEmployeeCount(wageSum))

    // Calculate used space from WKR-relevant transactions
    const usedSpace = this.calculateUsedSpace(findings)

    // Calculate metrics
    const usagePercentage = freeSpace > 0 ? (usedSpace / freeSpace) * 100 : 0
    const remainingSpace = Math.max(0, freeSpace - usedSpace)

    return {
      totalWageSum: wageSum,
      freeSpace,
      usedSpace,
      usagePercentage,
      remainingSpace,
      estimatedEmployees: this.estimateEmployeeCount(wageSum),
      overage: Math.max(0, usedSpace - freeSpace),
      isOverLimit: usedSpace > freeSpace
    }
  }

  private estimateWageSum(transactions: FilteredTransaction[]): number {
    // Look for salary-related transactions to estimate wage sum
    const salaryTransactions = transactions.filter(tx =>
      tx.accountId.startsWith('44') && (
        tx.boeking.toLowerCase().includes('salaris') ||
        tx.boeking.toLowerCase().includes('loon') ||
        tx.boeking.toLowerCase().includes('uitkering')
      )
    )

    if (salaryTransactions.length > 0) {
      const totalSalaryExpenses = salaryTransactions.reduce((sum, tx) => sum + tx.bedrag, 0)
      // Rough estimate: multiply by factor to get annual wage sum
      return totalSalaryExpenses * 12
    }

    // Fallback: estimate based on transaction volume (rough heuristic)
    const totalTransactionVolume = transactions.reduce((sum, tx) => sum + Math.abs(tx.bedrag), 0)
    return Math.max(50000, totalTransactionVolume * 0.3) // Conservative estimate
  }

  private estimateEmployeeCount(wageSum: number): number {
    // Rough estimate: average salary of €45,000
    return Math.max(1, Math.round(wageSum / 45000))
  }

  private applyFreeSpaceLimits(baseFreeSpace: number, employeeCount: number): number {
    const minFreeSpace = employeeCount * this.MIN_FREE_SPACE_PER_EMPLOYEE
    const maxFreeSpace = employeeCount * this.MAX_FREE_SPACE_PER_EMPLOYEE

    return Math.max(minFreeSpace, Math.min(maxFreeSpace, baseFreeSpace))
  }

  private calculateUsedSpace(findings: WKRFinding[]): number {
    return findings
      .filter(finding => finding.isWKRRelevant)
      .reduce((sum, finding) => sum + finding.amount, 0)
  }

  getTransactionCalculationDetails(
    transactionId: string,
    transactions: FilteredTransaction[]
  ): WKRCalculationDetails | null {
    const transaction = transactions.find(tx => tx.transactionId === transactionId)
    if (!transaction) return null

    const isWKRRelevant = this.isTransactionWKRRelevant(transaction)
    const exemption = this.identifyPossibleExemption(transaction)

    return {
      transactionId,
      isWKRRelevant,
      amount: transaction.bedrag,
      exemptionApplied: exemption,
      impactOnFreeSpace: isWKRRelevant ? transaction.bedrag : 0,
      reasoning: this.getCalculationReasoning(transaction, isWKRRelevant, exemption)
    }
  }

  private isTransactionWKRRelevant(transaction: FilteredTransaction): boolean {
    const description = transaction.boeking.toLowerCase()
    const accountId = transaction.accountId

    // Expense accounts starting with 4 are generally WKR relevant
    if (!accountId.startsWith('4')) return false

    // Specific exclusions
    if (accountId.startsWith('49')) return false
    if (['430000', '403130'].includes(accountId)) return false

    // Cost types that are likely WKR relevant
    const wkrKeywords = [
      'representatie', 'relatie', 'cadeau', 'gift',
      'opleiding', 'cursus', 'training',
      'telefoon', 'mobiel', 'communicatie',
      'auto', 'lease', 'brandstof', 'parkeren',
      'reis', 'verblijf', 'hotel', 'restaurant',
      'kantoor', 'faciliteit', 'catering'
    ]

    return wkrKeywords.some(keyword => description.includes(keyword))
  }

  private identifyPossibleExemption(transaction: FilteredTransaction): string | undefined {
    const description = transaction.boeking.toLowerCase()

    if (description.includes('reis') || description.includes('km')) {
      return 'Reiskostenvrijstelling'
    }

    if (description.includes('opleiding') || description.includes('cursus')) {
      return 'Opleidingsvrijstelling'
    }

    if (description.includes('cadeau') || description.includes('relatie')) {
      return 'Relatiegeschenkenvrijstelling'
    }

    if (description.includes('fiets')) {
      return 'Fiets van de zaak'
    }

    return undefined
  }

  private getCalculationReasoning(
    transaction: FilteredTransaction,
    isRelevant: boolean,
    exemption?: string
  ): string[] {
    const reasoning: string[] = []

    if (isRelevant) {
      reasoning.push('Transactie valt onder de werkkostenregeling')

      if (exemption) {
        reasoning.push(`Mogelijke toepassing: ${exemption}`)
      } else {
        reasoning.push('Gebruik van vrije ruimte')
      }
    } else {
      reasoning.push('Transactie valt niet onder de werkkostenregeling')

      if (transaction.accountId.startsWith('49')) {
        reasoning.push('Account categorie uitgesloten (49xxx)')
      } else if (['430000', '403130'].includes(transaction.accountId)) {
        reasoning.push('Specifiek uitgesloten account')
      } else {
        reasoning.push('Geen WKR-relevante kostensoort')
      }
    }

    return reasoning
  }
}
```

### WKR Exemption Analyzer
```typescript
// src/lib/wkr/exemption-analyzer.ts
export interface ExemptionRule {
  name: string
  description: string
  maxAmount?: number
  conditions: (transaction: FilteredTransaction) => boolean
  calculationMethod: (transactions: FilteredTransaction[]) => number
}

export class WKRExemptionAnalyzer {
  private exemptionRules: ExemptionRule[] = [
    {
      name: 'Reiskosten woon-werk',
      description: 'Vergoeding woon-werkverkeer €0,23/km, max 75km',
      conditions: (tx) => this.isCommuteTravel(tx),
      calculationMethod: (txs) => this.calculateCommuteAllowance(txs)
    },
    {
      name: 'Zakelijke reiskosten',
      description: 'Werkelijke kosten zakelijke reizen',
      conditions: (tx) => this.isBusinessTravel(tx),
      calculationMethod: (txs) => txs.reduce((sum, tx) => sum + tx.bedrag, 0)
    },
    {
      name: 'Opleidingskosten',
      description: 'Vakgerichte opleidingen volledig vrijgesteld',
      conditions: (tx) => this.isTrainingCost(tx),
      calculationMethod: (txs) => txs.reduce((sum, tx) => sum + tx.bedrag, 0)
    },
    {
      name: 'Relatiegeschenken',
      description: 'Max €50 per relatie per jaar met bedrijfslogo',
      maxAmount: 50,
      conditions: (tx) => this.isBusinessGift(tx),
      calculationMethod: (txs) => Math.min(txs.reduce((sum, tx) => sum + tx.bedrag, 0), 50)
    },
    {
      name: 'Fiets van de zaak',
      description: 'Volledig vrijgesteld bij zakelijk gebruik',
      conditions: (tx) => this.isCompanyBike(tx),
      calculationMethod: (txs) => txs.reduce((sum, tx) => sum + tx.bedrag, 0)
    }
  ]

  async analyzeExemptions(
    transactions: FilteredTransaction[],
    findings: WKRFinding[]
  ): Promise<WKRExemption[]> {
    const exemptions: WKRExemption[] = []

    for (const rule of this.exemptionRules) {
      const applicableTransactions = transactions.filter(rule.conditions)

      if (applicableTransactions.length > 0) {
        const totalAmount = rule.calculationMethod(applicableTransactions)
        const exemptAmount = rule.maxAmount ? Math.min(totalAmount, rule.maxAmount) : totalAmount
        const excess = totalAmount - exemptAmount

        exemptions.push({
          type: rule.name,
          description: rule.description,
          applicableTransactions: applicableTransactions.map(tx => tx.transactionId),
          totalAmount: totalAmount,
          exemptAmount,
          excessAmount: excess,
          savings: exemptAmount,
          legalReference: this.getLegalReference(rule.name)
        })
      }
    }

    return exemptions
  }

  private isCommuteTravel(transaction: FilteredTransaction): boolean {
    const desc = transaction.boeking.toLowerCase()
    return (desc.includes('reis') || desc.includes('km')) &&
           (desc.includes('woon') || desc.includes('werk') || desc.includes('heen'))
  }

  private isBusinessTravel(transaction: FilteredTransaction): boolean {
    const desc = transaction.boeking.toLowerCase()
    return (desc.includes('reis') || desc.includes('hotel') || desc.includes('verblijf')) &&
           !this.isCommuteTravel(transaction)
  }

  private isTrainingCost(transaction: FilteredTransaction): boolean {
    const desc = transaction.boeking.toLowerCase()
    return desc.includes('opleiding') || desc.includes('cursus') || desc.includes('training')
  }

  private isBusinessGift(transaction: FilteredTransaction): boolean {
    const desc = transaction.boeking.toLowerCase()
    return desc.includes('cadeau') || desc.includes('geschenk') || desc.includes('relatie')
  }

  private isCompanyBike(transaction: FilteredTransaction): boolean {
    const desc = transaction.boeking.toLowerCase()
    return desc.includes('fiets') || desc.includes('bike')
  }

  private calculateCommuteAllowance(transactions: FilteredTransaction[]): number {
    // Simple calculation - in practice would need more details about distances
    return transactions.reduce((sum, tx) => {
      // Assume reasonable commute allowance
      return sum + Math.min(tx.bedrag, 1000) // Cap at reasonable amount
    }, 0)
  }

  private getLegalReference(exemptionType: string): string {
    const references: Record<string, string> = {
      'Reiskosten woon-werk': 'Artikel 31a lid 2 Uitvoeringsbesluit LB',
      'Zakelijke reiskosten': 'Artikel 31a lid 3 Uitvoeringsbesluit LB',
      'Opleidingskosten': 'Artikel 31a lid 4 Uitvoeringsbesluit LB',
      'Relatiegeschenken': 'Artikel 31a lid 5 Uitvoeringsbesluit LB',
      'Fiets van de zaak': 'Artikel 31a lid 6 Uitvoeringsbesluit LB'
    }

    return references[exemptionType] || 'Geen specifieke verwijzing'
  }
}
```

### WKR Compliance Checker
```typescript
// src/lib/wkr/compliance-checker.ts
export interface ComplianceResult {
  score: number // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  issues: ComplianceIssue[]
  recommendations: string[]
}

export interface ComplianceIssue {
  severity: 'INFO' | 'WARNING' | 'ERROR'
  category: string
  description: string
  impact: string
  solution: string
}

export class WKRComplianceChecker {
  async checkCompliance(
    analysis: WKRAnalysisResponse,
    exemptions: WKRExemption[]
  ): Promise<ComplianceResult> {
    const issues: ComplianceIssue[] = []
    let score = 100

    // Check free space overage
    if (analysis.calculations.isOverLimit) {
      const severityLevel = analysis.calculations.usagePercentage > 120 ? 'ERROR' : 'WARNING'
      issues.push({
        severity: severityLevel,
        category: 'Vrije Ruimte',
        description: `Vrije ruimte overschreden met ${analysis.calculations.overage.toFixed(2)}`,
        impact: 'Belastingaanslag voor werknemers',
        solution: 'Toepassen gerichte vrijstellingen of kosten reduceren'
      })
      score -= severityLevel === 'ERROR' ? 30 : 15
    }

    // Check low confidence findings
    const lowConfidenceFindings = analysis.findings.filter(f => f.confidence < 60)
    if (lowConfidenceFindings.length > 0) {
      issues.push({
        severity: 'WARNING',
        category: 'Zekerheid',
        description: `${lowConfidenceFindings.length} transacties met lage zekerheid (<60%)`,
        impact: 'Mogelijke fouten in WKR toepassing',
        solution: 'Handmatige controle van onzekere transacties'
      })
      score -= lowConfidenceFindings.length * 2
    }

    // Check missing exemptions
    const missedSavings = this.identifyMissedExemptions(analysis, exemptions)
    if (missedSavings > 0) {
      issues.push({
        severity: 'INFO',
        category: 'Optimalisatie',
        description: `Potentiële besparing van €${missedSavings.toFixed(2)} door gerichte vrijstellingen`,
        impact: 'Suboptimaal gebruik van vrijstellingen',
        solution: 'Onderzoek toepassing van gerichte vrijstellingen'
      })
      score -= 5
    }

    // Check administrative requirements
    if (analysis.calculations.usedSpace > 0) {
      issues.push({
        severity: 'INFO',
        category: 'Administratie',
        description: 'Administratieplicht voor WKR vergoedingen',
        impact: 'Compliance met belastingdienst',
        solution: 'Zorg voor adequate registratie van alle vergoedingen'
      })
    }

    // Determine risk level
    const riskLevel = this.determineRiskLevel(score, issues)

    return {
      score: Math.max(0, score),
      riskLevel,
      issues,
      recommendations: this.generateComplianceRecommendations(issues, analysis)
    }
  }

  private identifyMissedExemptions(
    analysis: WKRAnalysisResponse,
    exemptions: WKRExemption[]
  ): number {
    // Calculate potential savings from unused exemptions
    let potentialSavings = 0

    // Check for travel costs that could use exemption
    const travelFindings = analysis.findings.filter(f =>
      f.description.toLowerCase().includes('reis') && f.isWKRRelevant
    )

    const travelExemption = exemptions.find(e => e.type.includes('reis'))
    if (travelFindings.length > 0 && !travelExemption) {
      potentialSavings += travelFindings.reduce((sum, f) => sum + f.amount, 0)
    }

    return potentialSavings
  }

  private determineRiskLevel(score: number, issues: ComplianceIssue[]): 'LOW' | 'MEDIUM' | 'HIGH' {
    const hasErrors = issues.some(i => i.severity === 'ERROR')
    const warningCount = issues.filter(i => i.severity === 'WARNING').length

    if (hasErrors || score < 60) return 'HIGH'
    if (warningCount > 2 || score < 80) return 'MEDIUM'
    return 'LOW'
  }

  private generateComplianceRecommendations(
    issues: ComplianceIssue[],
    analysis: WKRAnalysisResponse
  ): string[] {
    const recommendations: string[] = []

    // High-priority recommendations
    if (issues.some(i => i.category === 'Vrije Ruimte' && i.severity === 'ERROR')) {
      recommendations.push('URGENT: Neem onmiddellijk actie om vrije ruimte overschrijding op te lossen')
    }

    // General recommendations based on usage
    if (analysis.calculations.usagePercentage > 80) {
      recommendations.push('Overweeg implementatie van gerichte vrijstellingen voor komend jaar')
    }

    if (analysis.calculations.usagePercentage < 20) {
      recommendations.push('Vrije ruimte wordt weinig benut - mogelijkheden voor extra vergoedingen')
    }

    // Quality recommendations
    const lowConfidenceCount = analysis.findings.filter(f => f.confidence < 70).length
    if (lowConfidenceCount > 0) {
      recommendations.push(`Controleer ${lowConfidenceCount} transacties met lage zekerheid handmatig`)
    }

    return recommendations
  }
}
```

## API Integration

### Enhanced Analysis Endpoint
```typescript
// src/app/api/analyze/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WKRAnalysisOrchestrator } from '@/lib/wkr/analysis-orchestrator'

export async function POST(request: NextRequest) {
  try {
    const {
      transactions,
      analysisType = 'standard',
      companyInfo,
      includeCalculations = true
    } = await request.json()

    // Validate input
    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid transactions data' },
        { status: 400 }
      )
    }

    // Perform complete analysis
    const orchestrator = new WKRAnalysisOrchestrator()
    const result = await orchestrator.performCompleteAnalysis({
      transactions,
      analysisType,
      companyInfo,
      includeCalculations
    })

    return NextResponse.json({
      success: true,
      analysis: result,
      metadata: {
        analysisType,
        processedTransactions: transactions.length,
        confidenceScore: result.confidence,
        complianceScore: result.complianceScore,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Complete analysis error:', error)

    return NextResponse.json(
      {
        error: 'Analysis failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
```

## Testing

### Comprehensive Test Suite
```typescript
// src/lib/wkr/__tests__/analysis-integration.test.ts
import { WKRAnalysisOrchestrator } from '../analysis-orchestrator'
import { WKRCalculationEngine } from '../calculation-engine'

describe('WKR Analysis Integration', () => {
  let orchestrator: WKRAnalysisOrchestrator
  let mockTransactions: FilteredTransaction[]

  beforeEach(() => {
    orchestrator = new WKRAnalysisOrchestrator()
    mockTransactions = [
      {
        grootboek: '440000 Huur',
        boeking: '108308 Kantoorhuur januari',
        bedrag: 2000,
        datum: '2023-01-01',
        accountId: '440000',
        transactionId: '108308'
      },
      {
        grootboek: '450001 Reiskosten',
        boeking: '108309 Woon-werk reiskosten',
        bedrag: 500,
        datum: '2023-01-01',
        accountId: '450001',
        transactionId: '108309'
      }
    ]
  })

  test('should perform complete WKR analysis', async () => {
    const request = {
      transactions: mockTransactions,
      analysisType: 'standard' as const,
      companyInfo: { wageSum: 100000 },
      includeCalculations: true
    }

    const result = await orchestrator.performCompleteAnalysis(request)

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('findings')
    expect(result).toHaveProperty('calculations')
    expect(result).toHaveProperty('exemptions')
    expect(result).toHaveProperty('recommendations')
    expect(result.confidence).toBeGreaterThan(0)
  })

  test('should calculate free space correctly', () => {
    const engine = new WKRCalculationEngine()
    const calculations = engine.calculateWKRMetrics(mockTransactions, [], 100000)

    expect(calculations.totalWageSum).toBe(100000)
    expect(calculations.freeSpace).toBe(1700) // 1.7% of 100000
    expect(calculations.usagePercentage).toBeGreaterThanOrEqual(0)
  })

  test('should identify potential exemptions', () => {
    const travelTransaction: FilteredTransaction = {
      grootboek: '450001 Reiskosten',
      boeking: '108309 Woon-werk reiskosten 50km',
      bedrag: 500,
      datum: '2023-01-01',
      accountId: '450001',
      transactionId: '108309'
    }

    const engine = new WKRCalculationEngine()
    const details = engine.getTransactionCalculationDetails('108309', [travelTransaction])

    expect(details?.exemptionApplied).toBe('Reiskostenvrijstelling')
  })
})
```

## Definition of Done
- [ ] Complete WKR analysis pipeline werkend
- [ ] Accurate berekening vrije ruimte
- [ ] Vrijstellingen correct geïdentificeerd
- [ ] Zekerheidspercentages accuraat
- [ ] Compliance checker functioneel
- [ ] Aanbevelingen relevant en actionable
- [ ] Performance binnen targets (<30 sec)
- [ ] Unit tests coverage >90%

## Performance Targets
- Complete analysis: <30 seconden
- Calculation engine: <5 seconden
- Exemption analysis: <3 seconden
- Compliance check: <2 seconden
- Memory usage: <100MB tijdens analyse