import { describe, test, expect } from '@jest/globals'
import { WKRResponseParser } from '../response-parser'

describe('WKR Response Parser', () => {
  const parser = new WKRResponseParser()

  const mockResponse = `
## Samenvatting
Dit is een WKR analyse van de verstrekte transacties. De meeste kosten vallen onder de werkkostenregeling met verschillende vertrouwenspercentages.

## Belangrijkste Bevindingen
| Grootboek | Beschrijving | Bedrag | WKR Relevant | Confidence | Redenering |
|---|---|---|---|---|---|
| 440000 | Huurkosten kantoor | €9834.50 | Nee | 95% | Kantoorhuur valt niet onder WKR |
| 470000 | Reiskosten werknemer | €45.67 | Ja | 85% | Zakelijke reiskosten zijn WKR-relevant |

## Vrijstellingen Overzicht
1. Reiskosten zakelijk - Totaal: €45.67

2. Representatiekosten - Totaal: €0.00

## Berekeningen Vrije Ruimte
Loonsom: €100000
Vrije ruimte: €1700 (1,7%)
Gebruikt: €45.67
Percentage: 3%
Resterende ruimte: €1654.33

## Aanbevelingen
- Controleer of alle reiskosten zakelijk zijn
- Overweeg gerichte vrijstellingen voor reiskosten
- Houd administratie bij van alle WKR-relevante kosten
`

  test('should parse response correctly', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.summary).toContain('WKR analyse van de verstrekte transacties')
    expect(result.findings).toHaveLength(2)
    expect(result.exemptions).toHaveLength(2)
    expect(result.calculations.totalWageSum).toBe(100000)
    expect(result.recommendations).toHaveLength(3)
    expect(result.confidence).toBeGreaterThan(0)
  })

  test('should extract summary correctly', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.summary).toContain('Dit is een WKR analyse')
    expect(result.summary).toContain('vertrouwenspercentages')
  })

  test('should parse findings from table format', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.findings).toHaveLength(2)

    const firstFinding = result.findings[0]
    expect(firstFinding.accountId).toBe('440000')
    expect(firstFinding.amount).toBe(9834.50)
    expect(firstFinding.isWKRRelevant).toBe(false)
    expect(firstFinding.confidence).toBe(95)
    expect(firstFinding.reasoning).toContain('Kantoorhuur valt niet onder WKR')

    const secondFinding = result.findings[1]
    expect(secondFinding.accountId).toBe('470000')
    expect(secondFinding.amount).toBe(45.67)
    expect(secondFinding.isWKRRelevant).toBe(true)
    expect(secondFinding.confidence).toBe(85)
  })

  test('should parse exemptions correctly', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.exemptions).toHaveLength(2)

    const firstExemption = result.exemptions[0]
    expect(firstExemption.type).toContain('Reiskosten zakelijk')
    expect(firstExemption.totalAmount).toBe(45.67)

    const secondExemption = result.exemptions[1]
    expect(secondExemption.type).toContain('Representatiekosten')
    expect(secondExemption.totalAmount).toBe(0)
  })

  test('should parse calculations correctly', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.calculations.totalWageSum).toBe(100000)
    expect(result.calculations.freeSpace).toBe(1700)
    expect(result.calculations.usedSpace).toBe(45.67)
    expect(result.calculations.usagePercentage).toBe(3)
    expect(result.calculations.remainingSpace).toBeCloseTo(1654.33, 2)
  })

  test('should parse recommendations correctly', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    expect(result.recommendations).toHaveLength(3)
    expect(result.recommendations[0]).toContain('Controleer of alle reiskosten zakelijk zijn')
    expect(result.recommendations[1]).toContain('Overweeg gerichte vrijstellingen')
    expect(result.recommendations[2]).toContain('Houd administratie bij')
  })

  test('should calculate overall confidence from individual confidences', () => {
    const result = parser.parseAnalysisResponse(mockResponse)

    // Should be average of confidence values found
    expect(result.confidence).toBeGreaterThan(70)
  })

  test('should handle response without tables', () => {
    const listResponse = `
## Samenvatting
Test samenvatting

## Belangrijkste Bevindingen
1. 440000 Huurkosten - €1000 - Niet WKR relevant - 90%
2. 470000 Reiskosten - €50 - WKR relevant - 80%

## Berekeningen
Loonsom: €50000
Vrije ruimte: €850
`

    const result = parser.parseAnalysisResponse(listResponse)

    expect(result.summary).toContain('Test samenvatting')
    expect(result.findings).toHaveLength(2)
    expect(result.calculations.totalWageSum).toBe(50000)
    expect(result.calculations.freeSpace).toBe(850)
  })

  test('should handle empty or malformed response gracefully', () => {
    const emptyResponse = ''

    const result = parser.parseAnalysisResponse(emptyResponse)

    expect(result.summary).toBe('Geen samenvatting beschikbaar')
    expect(result.findings).toHaveLength(0)
    expect(result.exemptions).toHaveLength(0)
    expect(result.recommendations).toHaveLength(0)
    expect(result.calculations.totalWageSum).toBe(0)
  })

  test('should handle response with missing sections', () => {
    const partialResponse = `
## Samenvatting
Alleen een samenvatting
`

    const result = parser.parseAnalysisResponse(partialResponse)

    expect(result.summary).toContain('Alleen een samenvatting')
    expect(result.findings).toHaveLength(0)
    expect(result.exemptions).toHaveLength(0)
    expect(result.recommendations).toHaveLength(0)
  })

  test('should parse amounts with different formats', () => {
    const amountTestResponse = `
## Belangrijkste Bevindingen
| Account | Beschrijving | Bedrag | Relevant |
|---|---|---|---|
| 440000 | Test 1 | €1.234,56 | Ja |
| 440001 | Test 2 | €1,234.56 | Nee |
| 440002 | Test 3 | 1234.56 | Ja |
`

    const result = parser.parseAnalysisResponse(amountTestResponse)

    expect(result.findings).toHaveLength(3)
    expect(result.findings[0].amount).toBe(1234.56)
    expect(result.findings[1].amount).toBe(1234.56)
    expect(result.findings[2].amount).toBe(1234.56)
  })

  test('should handle WKR relevance in different languages/formats', () => {
    const relevanceTestResponse = `
## Belangrijkste Bevindingen
| Account | Beschrijving | Relevant |
|---|---|---|
| 440000 | Test 1 | Ja |
| 440001 | Test 2 | Nee |
| 440002 | Test 3 | Yes |
| 440003 | Test 4 | No |
| 440004 | Test 5 | Wel relevant |
| 440005 | Test 6 | Niet relevant |
`

    const result = parser.parseAnalysisResponse(relevanceTestResponse)

    expect(result.findings).toHaveLength(6)
    expect(result.findings[0].isWKRRelevant).toBe(true)  // Ja
    expect(result.findings[1].isWKRRelevant).toBe(false) // Nee
    expect(result.findings[2].isWKRRelevant).toBe(true)  // Yes
    expect(result.findings[3].isWKRRelevant).toBe(false) // No
    expect(result.findings[4].isWKRRelevant).toBe(true)  // Wel relevant
    expect(result.findings[5].isWKRRelevant).toBe(false) // Niet relevant
  })
})