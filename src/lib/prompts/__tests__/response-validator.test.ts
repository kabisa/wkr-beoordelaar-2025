import { describe, test, expect } from '@jest/globals'
import { ResponseValidator } from '../response-validator'
import { WKRAnalysisResponse, WKRFinding, WKRExemption, WKRCalculations } from '../../../types/wkr-analysis'

describe('Response Validator', () => {
  const validator = new ResponseValidator()

  const createValidResponse = (): WKRAnalysisResponse => ({
    summary: 'Dit is een uitgebreide WKR analyse van de verstrekte transacties volgens de Nederlandse werkkostenregeling.',
    findings: [
      {
        transactionId: '108308',
        accountId: '440000',
        description: 'Huurkosten kantoor',
        amount: 9834.50,
        isWKRRelevant: false,
        confidence: 95,
        reasoning: 'Kantoorhuur valt niet onder de werkkostenregeling omdat het geen vergoeding aan werknemers betreft.'
      },
      {
        transactionId: '108309',
        accountId: '470000',
        description: 'Reiskosten werknemer',
        amount: 45.67,
        isWKRRelevant: true,
        confidence: 85,
        reasoning: 'Zakelijke reiskosten kunnen onder de WKR vallen als gerichte vrijstelling of vrije ruimte.'
      }
    ],
    exemptions: [
      {
        type: 'Reiskosten zakelijk',
        description: 'Vergoeding voor zakelijke kilometers tegen €0,23 per km',
        applicableTransactions: ['108309'],
        totalAmount: 45.67,
        legalReference: 'WKR 2025'
      }
    ],
    calculations: {
      totalWageSum: 100000,
      freeSpace: 1700,
      usedSpace: 45.67,
      usagePercentage: 2.7,
      remainingSpace: 1654.33
    },
    recommendations: [
      'Controleer of alle reiskosten zakelijk zijn',
      'Overweeg gerichte vrijstellingen voor reiskosten'
    ],
    confidence: 90
  })

  test('should validate complete valid response', () => {
    const response = createValidResponse()
    const result = validator.validateWKRResponse(response)

    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.score).toBeGreaterThan(80)
  })

  test('should detect missing summary', () => {
    const response = createValidResponse()
    response.summary = ''

    const result = validator.validateWKRResponse(response)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Samenvatting ontbreekt')
  })

  test('should warn about short summary', () => {
    const response = createValidResponse()
    response.summary = 'Te kort'

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Samenvatting is zeer kort (< 50 karakters)')
  })

  test('should detect missing findings', () => {
    const response = createValidResponse()
    response.findings = []

    const result = validator.validateWKRResponse(response)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Geen bevindingen gevonden in response')
  })

  test('should validate finding properties', () => {
    const response = createValidResponse()
    response.findings[0].transactionId = ''
    response.findings[0].accountId = ''
    response.findings[0].amount = -100
    response.findings[0].confidence = 150

    const result = validator.validateWKRResponse(response)

    expect(result.errors).toContain('Bevinding 1: TransactionId ontbreekt')
    expect(result.errors).toContain('Bevinding 1: AccountId ontbreekt')
    expect(result.warnings).toContain('Bevinding 1: Ongeldig bedrag (-100)')
    expect(result.warnings).toContain('Bevinding 1: Onrealistische confidence (150%)')
  })

  test('should warn about low confidence', () => {
    const response = createValidResponse()
    response.findings[0].confidence = 25

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Bevinding 1: Zeer lage confidence (25%)')
  })

  test('should validate WKR relevance type', () => {
    const response = createValidResponse()
    // @ts-ignore - Testing invalid type
    response.findings[0].isWKRRelevant = 'maybe'

    const result = validator.validateWKRResponse(response)

    expect(result.errors).toContain('Bevinding 1: WKR relevantie moet ja/nee zijn')
  })

  test('should validate calculations', () => {
    const response = createValidResponse()
    response.calculations.totalWageSum = -1000
    response.calculations.freeSpace = 0
    response.calculations.usedSpace = -500
    response.calculations.usagePercentage = 150

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Ongeldig loonsom bedrag: -1000')
    expect(result.errors).toContain('Vrije ruimte berekening lijkt incorrect')
    expect(result.warnings).toContain('Ongeldig gebruikt bedrag: -500')
    expect(result.warnings).toContain('Zeer hoog verbruik van vrije ruimte gedetecteerd (>120%)')
  })

  test('should detect calculation inconsistencies', () => {
    const response = createValidResponse()
    response.calculations.freeSpace = 1000
    response.calculations.usedSpace = 500
    response.calculations.usagePercentage = 75 // Should be 50%
    response.calculations.remainingSpace = 600 // Should be 500

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Inconsistentie in percentage berekening gedetecteerd')
    expect(result.warnings).toContain('Inconsistentie in resterende ruimte berekening')
  })

  test('should warn about usage over 100%', () => {
    const response = createValidResponse()
    response.calculations.usagePercentage = 105

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Overschrijding van vrije ruimte gedetecteerd')
  })

  test('should validate exemptions', () => {
    const response = createValidResponse()
    response.exemptions = []

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Geen vrijstellingen geanalyseerd')
  })

  test('should validate exemption properties', () => {
    const response = createValidResponse()
    response.exemptions[0].type = 'X'
    response.exemptions[0].description = 'Te kort'
    response.exemptions[0].totalAmount = -100

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Vrijstelling 1: Onduidelijk type')
    expect(result.warnings).toContain('Vrijstelling 1: Onvoldoende beschrijving')
    expect(result.warnings).toContain('Vrijstelling 1: Ongeldig bedrag')
  })

  test('should validate recommendations', () => {
    const response = createValidResponse()
    response.recommendations = []

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Geen aanbevelingen gegeven')
  })

  test('should validate recommendation length', () => {
    const response = createValidResponse()
    response.recommendations = ['Te kort', '']

    const result = validator.validateWKRResponse(response)

    expect(result.warnings).toContain('Aanbeveling 1: Te kort of leeg')
    expect(result.warnings).toContain('Aanbeveling 2: Te kort of leeg')
  })

  test('should calculate quality score correctly', () => {
    const response = createValidResponse()
    const result = validator.validateWKRResponse(response)

    // Should get high score for complete, valid response
    expect(result.score).toBeGreaterThan(85)
  })

  test('should penalize errors more than warnings', () => {
    const responseWithErrors = createValidResponse()
    responseWithErrors.summary = ''
    responseWithErrors.findings = []

    const responseWithWarnings = createValidResponse()
    responseWithWarnings.summary = 'Te kort'
    responseWithWarnings.findings[0].confidence = 25

    const errorsResult = validator.validateWKRResponse(responseWithErrors)
    const warningsResult = validator.validateWKRResponse(responseWithWarnings)

    expect(errorsResult.score).toBeLessThan(warningsResult.score)
  })

  test('should give bonus for high confidence', () => {
    const highConfidenceResponse = createValidResponse()
    highConfidenceResponse.findings.forEach(finding => finding.confidence = 95)

    const lowConfidenceResponse = createValidResponse()
    lowConfidenceResponse.findings.forEach(finding => finding.confidence = 60)

    const highResult = validator.validateWKRResponse(highConfidenceResponse)
    const lowResult = validator.validateWKRResponse(lowConfidenceResponse)

    expect(highResult.score).toBeGreaterThan(lowResult.score)
  })

  test('should detect Dutch terminology', () => {
    const dutchResponse = createValidResponse()
    const englishResponse = createValidResponse()
    englishResponse.summary = 'This is an English analysis with no Dutch terms'

    const dutchResult = validator.validateWKRResponse(dutchResponse)
    const englishResult = validator.validateWKRResponse(englishResponse)

    expect(dutchResult.score).toBeGreaterThan(englishResult.score)
  })

  test('should generate validation summary', () => {
    const response = createValidResponse()
    response.summary = '' // Add error
    response.findings[0].confidence = 25 // Add warning

    const result = validator.validateWKRResponse(response)
    const summary = validator.getValidationSummary(result)

    expect(summary).toContain('Validatie Score:')
    expect(summary).toContain('❌ (Ongeldig)')
    expect(summary).toContain('Fouten (1):')
    expect(summary).toContain('Samenvatting ontbreekt')
    expect(summary).toContain('Waarschuwingen')
    expect(summary).toContain('Zeer lage confidence')
  })

  test('should handle missing calculations object', () => {
    const response = createValidResponse()
    // @ts-ignore - Testing missing calculations
    response.calculations = null

    const result = validator.validateWKRResponse(response)

    expect(result.errors).toContain('Berekeningen ontbreken')
  })
})