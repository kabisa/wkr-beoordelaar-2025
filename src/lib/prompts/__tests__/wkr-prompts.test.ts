import { describe, test, expect } from '@jest/globals'
import { WKRPromptBuilder } from '../wkr-prompts'
import { FilteredTransaction } from '../../../types/wkr-analysis'

describe('WKR Prompt Engineering', () => {
  const mockTransactions: FilteredTransaction[] = [
    {
      grootboek: '440000 Huur',
      boeking: '108308 Spitters Vastgoed BV - 2023-01-01',
      bedrag: 9834.50,
      datum: '2023-01-01',
      accountId: '440000',
      transactionId: '108308'
    },
    {
      grootboek: '470000 Reiskosten',
      boeking: '108309 Tankstation Shell - 2023-01-05',
      bedrag: 45.67,
      datum: '2023-01-05',
      accountId: '470000',
      transactionId: '108309'
    }
  ]

  test('should build standard prompt with transactions', () => {
    const prompt = WKRPromptBuilder.buildStandardPrompt(mockTransactions)

    expect(prompt).toContain('werkkostenregeling')
    expect(prompt).toContain('Nederlandse boekhoudterminologie')
    expect(prompt).toContain('440000 Huur')
    expect(prompt).toContain('€9834.50')
    expect(prompt).toContain('470000 Reiskosten')
    expect(prompt).toContain('€45.67')
    expect(prompt).toContain('2023-01-01')
    expect(prompt).toContain('zekerheidspercentage')
  })

  test('should build standard prompt with context', () => {
    const context = 'Extra WKR context information'
    const prompt = WKRPromptBuilder.buildStandardPrompt(mockTransactions, context)

    expect(prompt).toContain('CONTEXT:')
    expect(prompt).toContain(context)
  })

  test('should build compliance prompt with company info', () => {
    const companyInfo = {
      name: 'Test BV',
      kvkNumber: '12345678',
      fiscalYear: 2023
    }

    const prompt = WKRPromptBuilder.buildCompliancePrompt(mockTransactions, companyInfo)

    expect(prompt).toContain('BEDRIJFSGEGEVENS:')
    expect(prompt).toContain('Test BV')
    expect(prompt).toContain('12345678')
    expect(prompt).toContain('2023')
    expect(prompt).toContain('COMPLIANCE CHECK:')
    expect(prompt).toContain('belastingdienst')
  })

  test('should build compliance prompt without KvK number', () => {
    const companyInfo = {
      name: 'Test BV',
      fiscalYear: 2023
    }

    const prompt = WKRPromptBuilder.buildCompliancePrompt(mockTransactions, companyInfo)

    expect(prompt).toContain('Niet beschikbaar')
  })

  test('should build detailed prompt with wage sum', () => {
    const wageSum = 250000

    const prompt = WKRPromptBuilder.buildDetailedPrompt(mockTransactions, wageSum)

    expect(prompt).toContain('LOONSOM: €250000.00')
    expect(prompt).toContain('GEDETAILLEERDE ANALYSE:')
    expect(prompt).toContain('vrije ruimte berekening')
    expect(prompt).toContain('1,7% van loonsom')
  })

  test('should build detailed prompt without wage sum', () => {
    const prompt = WKRPromptBuilder.buildDetailedPrompt(mockTransactions)

    expect(prompt).toContain('LOONSOM: Niet beschikbaar')
    expect(prompt).toContain('schat een redelijke loonsom')
  })

  test('should format transactions correctly for AI', () => {
    const prompt = WKRPromptBuilder.buildStandardPrompt(mockTransactions)

    expect(prompt).toContain('| Grootboek | Boeking | Bedrag | Datum |')
    expect(prompt).toContain('|---|---|---|---|')
    expect(prompt).toContain('| 440000 Huur | 108308 Spitters Vastgoed BV - 2023-01-01 | €9834.50 | 2023-01-01 |')
    expect(prompt).toContain('| 470000 Reiskosten | 108309 Tankstation Shell - 2023-01-05 | €45.67 | 2023-01-05 |')
  })

  test('should handle empty transactions array', () => {
    const prompt = WKRPromptBuilder.buildStandardPrompt([])

    expect(prompt).toContain('| Grootboek | Boeking | Bedrag | Datum |')
    expect(prompt).toContain('|---|---|---|---|')
    expect(prompt).toContain('werkkostenregeling')
  })

  test('should include all required WKR elements in base prompt', () => {
    const prompt = WKRPromptBuilder.buildStandardPrompt(mockTransactions)

    expect(prompt).toContain('Nederlandse fiscalist')
    expect(prompt).toContain('werkkostenregeling')
    expect(prompt).toContain('WKR')
    expect(prompt).toContain('zekerheidspercentage')
    expect(prompt).toContain('gerichte vrijstelling')
    expect(prompt).toContain('Samenvatting')
    expect(prompt).toContain('Belangrijkste bevindingen')
    expect(prompt).toContain('Vrijstellingen overzicht')
    expect(prompt).toContain('Berekeningen vrije ruimte')
    expect(prompt).toContain('Aanbevelingen')
  })

  test('should handle special characters in transaction data', () => {
    const specialTransactions: FilteredTransaction[] = [
      {
        grootboek: '440000 Huur & Servicekosten',
        boeking: '108308 Spitters Vastgoed B.V. - Factuur #123 - 2023-01-01',
        bedrag: 1234.56,
        datum: '2023-01-01',
        accountId: '440000',
        transactionId: '108308'
      }
    ]

    const prompt = WKRPromptBuilder.buildStandardPrompt(specialTransactions)

    expect(prompt).toContain('Huur & Servicekosten')
    expect(prompt).toContain('Factuur #123')
    expect(prompt).toContain('€1234.56')
  })
})