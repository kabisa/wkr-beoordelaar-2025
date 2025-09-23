# Story 15: Testing & Documentatie

**Sprint:** 5
**Estimate:** 2 dagen
**Priority:** High

## User Story
Als developer en gebruiker wil ik een goed geteste applicatie met duidelijke documentatie zodat de kwaliteit gewaarborgd is en het onderhoud eenvoudig blijft.

## Acceptatiecriteria
- [x] Unit tests voor alle core functies
- [x] Integration tests voor API endpoints
- [x] E2E tests voor critical paths
- [x] Gebruikersdocumentatie
- [x] API documentatie
- [x] Deployment instructies
- [x] Test coverage >85%

## Testing Strategy

### Test Architecture
```typescript
// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    '/node_modules/(?!(recharts|d3-|@react-spring)/)',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
```

### Unit Tests

#### XAF Parser Tests
```typescript
// src/lib/parsers/__tests__/xaf-parser.test.ts
import { XAFParser } from '../xaf-parser'
import { XAFParseError } from '../xaf-errors'

describe('XAFParser', () => {
  let parser: XAFParser

  beforeEach(() => {
    parser = new XAFParser()
  })

  describe('parseXAF', () => {
    test('should parse valid XAF file successfully', async () => {
      const validXAF = `<?xml version="1.0" encoding="UTF-8"?>
<auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
  <header>
    <fiscalYear>2023</fiscalYear>
    <startDate>2023-01-01</startDate>
    <endDate>2023-12-31</endDate>
    <curCode>EUR</curCode>
  </header>
  <company>
    <companyIdent>12345678</companyIdent>
    <companyName>Test Company B.V.</companyName>
  </company>
  <generalLedgerAccounts>
    <generalLedgerAccount>
      <accID>400000</accID>
      <accDesc>Revenue</accDesc>
      <accType>P</accType>
    </generalLedgerAccount>
  </generalLedgerAccounts>
  <transactions>
    <journal>
      <jrnID>VK</jrnID>
      <desc>Sales</desc>
      <jrnTp>S</jrnTp>
      <transaction>
        <nr>1001</nr>
        <desc>Test transaction</desc>
        <trDt>2023-01-01</trDt>
        <amnt>1000.00</amnt>
        <line>
          <nr>1</nr>
          <accID>400000</accID>
          <desc>Test revenue</desc>
          <amnt>1000.00</amnt>
          <amntTp>C</amntTp>
          <effDate>2023-01-01</effDate>
        </line>
      </transaction>
    </journal>
  </transactions>
</auditfile>`

      const result = await parser.parseXAF(validXAF)

      expect(result).toBeDefined()
      expect(result.header.fiscalYear).toBe(2023)
      expect(result.company.name).toBe('Test Company B.V.')
      expect(result.transactions).toHaveLength(1)
      expect(result.transactions[0].transactionNumber).toBe('1001')
      expect(result.transactions[0].lines).toHaveLength(1)
      expect(result.transactions[0].lines[0].amount).toBe(1000)
    })

    test('should throw error for invalid XML', async () => {
      const invalidXML = '<invalid>unclosed tag'

      await expect(parser.parseXAF(invalidXML))
        .rejects
        .toThrow(XAFParseError)
    })

    test('should throw error for missing required sections', async () => {
      const incompleteXAF = `<?xml version="1.0" encoding="UTF-8"?>
<auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
  <header>
    <fiscalYear>2023</fiscalYear>
  </header>
</auditfile>`

      await expect(parser.parseXAF(incompleteXAF))
        .rejects
        .toThrow('Invalid XAF: Missing required section')
    })

    test('should handle large XAF files efficiently', async () => {
      const largeXAF = generateLargeXAF(10000) // Generate 10k transactions

      const startTime = performance.now()
      const result = await parser.parseXAF(largeXAF)
      const duration = performance.now() - startTime

      expect(result.transactions).toHaveLength(10000)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })

  describe('validation', () => {
    test('should validate XAF schema correctly', () => {
      const validStructure = {
        auditfile: {
          header: { fiscalYear: 2023 },
          company: { companyName: 'Test' },
          generalLedgerAccounts: {},
          transactions: {}
        }
      }

      expect(() => parser.validateXAFSchema(validStructure)).not.toThrow()
    })

    test('should reject invalid structure', () => {
      const invalidStructure = {
        auditfile: {
          header: { fiscalYear: 2023 }
          // Missing required sections
        }
      }

      expect(() => parser.validateXAFSchema(invalidStructure))
        .toThrow('Invalid XAF: Missing required section')
    })
  })
})

function generateLargeXAF(transactionCount: number): string {
  const transactions = Array.from({ length: transactionCount }, (_, i) => `
    <transaction>
      <nr>${1000 + i}</nr>
      <desc>Transaction ${i}</desc>
      <trDt>2023-01-${String((i % 28) + 1).padStart(2, '0')}</trDt>
      <amnt>${(Math.random() * 10000).toFixed(2)}</amnt>
      <line>
        <nr>1</nr>
        <accID>40${String(i % 10).padStart(4, '0')}</accID>
        <desc>Line ${i}</desc>
        <amnt>${(Math.random() * 10000).toFixed(2)}</amnt>
        <amntTp>D</amntTp>
        <effDate>2023-01-${String((i % 28) + 1).padStart(2, '0')}</effDate>
      </line>
    </transaction>
  `).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
  <header>
    <fiscalYear>2023</fiscalYear>
    <startDate>2023-01-01</startDate>
    <endDate>2023-12-31</endDate>
    <curCode>EUR</curCode>
  </header>
  <company>
    <companyIdent>12345678</companyIdent>
    <companyName>Test Company B.V.</companyName>
  </company>
  <generalLedgerAccounts>
    <generalLedgerAccount>
      <accID>400000</accID>
      <accDesc>Revenue</accDesc>
      <accType>P</accType>
    </generalLedgerAccount>
  </generalLedgerAccounts>
  <transactions>
    <journal>
      <jrnID>VK</jrnID>
      <desc>Sales</desc>
      <jrnTp>S</jrnTp>
      ${transactions}
    </journal>
  </transactions>
</auditfile>`
}
```

#### WKR Analysis Tests
```typescript
// src/lib/wkr/__tests__/analysis-orchestrator.test.ts
import { WKRAnalysisOrchestrator } from '../analysis-orchestrator'
import { WKRCalculationEngine } from '../calculation-engine'
import { MockGeminiClient } from '../../__mocks__/gemini-client'

// Mock external dependencies
jest.mock('@/lib/ai/gemini-client')
jest.mock('@/lib/documents/knowledge-base')

describe('WKRAnalysisOrchestrator', () => {
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
      },
      {
        grootboek: '460001 Telefoonkosten',
        boeking: '108310 Mobiele telefoon',
        bedrag: 150,
        datum: '2023-01-01',
        accountId: '460001',
        transactionId: '108310'
      }
    ]
  })

  describe('performCompleteAnalysis', () => {
    test('should perform standard analysis correctly', async () => {
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

      expect(result.findings).toHaveLength(3)
      expect(result.calculations.totalWageSum).toBe(100000)
      expect(result.calculations.freeSpace).toBe(1700) // 1.7% of 100k
      expect(result.confidence).toBeGreaterThan(0)
    })

    test('should handle compliance analysis', async () => {
      const request = {
        transactions: mockTransactions,
        analysisType: 'compliance' as const,
        companyInfo: {
          name: 'Test Company',
          kvkNumber: '12345678',
          fiscalYear: 2023,
          wageSum: 100000
        },
        includeCalculations: true
      }

      const result = await orchestrator.performCompleteAnalysis(request)

      expect(result.complianceScore).toBeDefined()
      expect(result.riskLevel).toMatch(/LOW|MEDIUM|HIGH/)
    })

    test('should identify WKR relevant transactions', async () => {
      const result = await orchestrator.performCompleteAnalysis({
        transactions: mockTransactions,
        analysisType: 'standard',
        includeCalculations: true
      })

      const wkrRelevantFindings = result.findings.filter(f => f.isWKRRelevant)
      expect(wkrRelevantFindings.length).toBeGreaterThan(0)

      // Travel costs should be WKR relevant
      const travelFinding = result.findings.find(f => f.transactionId === '108309')
      expect(travelFinding?.isWKRRelevant).toBe(true)
    })

    test('should calculate free space usage correctly', async () => {
      const result = await orchestrator.performCompleteAnalysis({
        transactions: mockTransactions,
        analysisType: 'standard',
        companyInfo: { wageSum: 100000 },
        includeCalculations: true
      })

      expect(result.calculations.totalWageSum).toBe(100000)
      expect(result.calculations.freeSpace).toBe(1700)
      expect(result.calculations.usagePercentage).toBeGreaterThanOrEqual(0)
      expect(result.calculations.usagePercentage).toBeLessThanOrEqual(200) // Reasonable upper bound
    })

    test('should handle analysis errors gracefully', async () => {
      // Mock AI failure
      jest.mocked(MockGeminiClient.prototype.generateAnalysisWithRetry)
        .mockRejectedValueOnce(new Error('AI service unavailable'))

      await expect(orchestrator.performCompleteAnalysis({
        transactions: mockTransactions,
        analysisType: 'standard',
        includeCalculations: true
      })).rejects.toThrow('Complete WKR analysis failed')
    })
  })

  describe('performance', () => {
    test('should handle large transaction sets efficiently', async () => {
      const largeTransactionSet = Array.from({ length: 1000 }, (_, i) => ({
        grootboek: `40${i.toString().padStart(4, '0')} Account ${i}`,
        boeking: `TX${i} Transaction ${i}`,
        bedrag: Math.random() * 10000,
        datum: '2023-01-01',
        accountId: `40${i.toString().padStart(4, '0')}`,
        transactionId: `tx${i}`
      }))

      const startTime = performance.now()

      const result = await orchestrator.performCompleteAnalysis({
        transactions: largeTransactionSet,
        analysisType: 'standard',
        includeCalculations: true
      })

      const duration = performance.now() - startTime

      expect(result.findings).toHaveLength(1000)
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })
})
```

#### Filter Engine Tests
```typescript
// src/lib/filters/__tests__/transaction-filter.test.ts
import { TransactionFilter, DEFAULT_WKR_FILTER_RULES } from '../transaction-filter'

describe('TransactionFilter', () => {
  let filter: TransactionFilter

  beforeEach(() => {
    filter = new TransactionFilter(DEFAULT_WKR_FILTER_RULES)
  })

  describe('filterTransactions', () => {
    test('should include accounts starting with 4', () => {
      const transactions = [
        createMockTransaction('400000', 'Revenue account'),
        createMockTransaction('440000', 'Rent expense'),
        createMockTransaction('300000', 'Asset account') // Should be excluded
      ]

      const result = filter.filterTransactions(transactions)

      expect(result).toHaveLength(2)
      expect(result.every(tx => tx.accountId.startsWith('4'))).toBe(true)
    })

    test('should exclude accounts starting with 49', () => {
      const transactions = [
        createMockTransaction('400000', 'Include this'),
        createMockTransaction('490000', 'Exclude this'),
        createMockTransaction('450000', 'Include this')
      ]

      const result = filter.filterTransactions(transactions)

      expect(result).toHaveLength(2)
      expect(result.find(tx => tx.accountId === '490000')).toBeUndefined()
    })

    test('should exclude specific accounts', () => {
      const transactions = [
        createMockTransaction('430000', 'Should be excluded'),
        createMockTransaction('403130', 'Should be excluded'),
        createMockTransaction('430001', 'Should be included')
      ]

      const result = filter.filterTransactions(transactions)

      expect(result).toHaveLength(1)
      expect(result[0].accountId).toBe('430001')
    })

    test('should handle empty transaction list', () => {
      const result = filter.filterTransactions([])
      expect(result).toHaveLength(0)
    })

    test('should preserve transaction data in filtered results', () => {
      const transactions = [
        createMockTransaction('440000', 'Test description', 1000, '2023-01-01')
      ]

      const result = filter.filterTransactions(transactions)

      expect(result[0]).toMatchObject({
        accountId: '440000',
        amount: 1000,
        date: '2023-01-01'
      })
      expect(result[0].grootboek).toContain('Test description')
    })
  })

  describe('performance', () => {
    test('should filter large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) =>
        createMockTransaction(`40${i.toString().padStart(4, '0')}`, `Account ${i}`)
      )

      const startTime = performance.now()
      const result = filter.filterTransactions(largeDataset)
      const endTime = performance.now()

      expect(result).toHaveLength(10000)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })
})

function createMockTransaction(
  accountId: string,
  description: string,
  amount: number = 100,
  date: string = '2023-01-01'
): XAFTransaction {
  return {
    transactionNumber: '123',
    description,
    date,
    journal: 'VK',
    period: 1,
    lines: [{
      lineNumber: 1,
      accountId,
      description,
      amount,
      amountType: 'D',
      effectiveDate: date
    }]
  }
}
```

### Integration Tests

#### API Route Tests
```typescript
// src/app/api/analyze/__tests__/route.test.ts
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/ai/gemini-client')
jest.mock('@/lib/cache/analysis-cache')

describe('/api/analyze', () => {
  test('should analyze transactions successfully', async () => {
    const requestBody = {
      transactions: [
        {
          grootboek: '440000 Huur',
          boeking: '108308 Kantoorhuur',
          bedrag: 2000,
          datum: '2023-01-01',
          accountId: '440000',
          transactionId: '108308'
        }
      ],
      analysisType: 'standard',
      companyInfo: { wageSum: 100000 }
    }

    const request = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.analysis).toBeDefined()
    expect(data.analysis.findings).toBeDefined()
    expect(data.metadata.processedTransactions).toBe(1)
  })

  test('should handle invalid input', async () => {
    const request = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' })
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  test('should respect rate limiting', async () => {
    // Mock rate limiter to return false
    jest.mocked(globalRateLimiter.checkLimit).mockResolvedValueOnce(false)

    const request = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: [],
        analysisType: 'standard'
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(429)
  })

  test('should handle AI service errors', async () => {
    // Mock AI service failure
    jest.mocked(RetryableGeminiClient.prototype.generateAnalysisWithRetry)
      .mockRejectedValueOnce(new Error('AI service unavailable'))

    const request = new NextRequest('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactions: [createMockTransaction()],
        analysisType: 'standard'
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
  })
})
```

### End-to-End Tests

#### Critical Path E2E Tests
```typescript
// e2e/critical-path.spec.ts
import { test, expect } from '@playwright/test'

test.describe('WKR Analysis Critical Path', () => {
  test('complete analysis workflow', async ({ page }) => {
    // Navigate to app
    await page.goto('/')

    // Verify landing page
    await expect(page.getByText('WKR Beoordelaar 2025')).toBeVisible()

    // Upload XAF file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/sample.xaf')

    // Wait for parsing to complete
    await expect(page.getByText('File successfully parsed')).toBeVisible({ timeout: 30000 })

    // Start analysis
    await page.getByRole('button', { name: 'Start Analysis' }).click()

    // Wait for analysis to complete
    await expect(page.getByText('Analysis complete')).toBeVisible({ timeout: 60000 })

    // Verify results are displayed
    await expect(page.getByText('Samenvatting')).toBeVisible()
    await expect(page.getByText('Belangrijkste Bevindingen')).toBeVisible()
    await expect(page.getByText('Berekeningen')).toBeVisible()

    // Check for calculation results
    await expect(page.getByText(/€.*Vrije ruimte/)).toBeVisible()
    await expect(page.getByText(/\d+%.*verbruik/i)).toBeVisible()

    // Test export functionality
    await page.getByRole('button', { name: 'Export Results' }).click()
    await page.getByText('PDF Document').click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/wkr-analysis.*\.pdf/)
  })

  test('error handling workflow', async ({ page }) => {
    await page.goto('/')

    // Try to upload invalid file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/invalid.txt')

    // Should show error message
    await expect(page.getByText(/alleen XAF en XML bestanden/i)).toBeVisible()

    // Upload too large file
    await fileInput.setInputFiles('tests/fixtures/large-file.xaf')
    await expect(page.getByText(/bestand te groot/i)).toBeVisible()

    // Test network error handling
    await page.route('/api/analyze', route => route.abort())

    // Upload valid file
    await fileInput.setInputFiles('tests/fixtures/sample.xaf')
    await page.getByRole('button', { name: 'Start Analysis' }).click()

    // Should show network error
    await expect(page.getByText(/unable to connect/i)).toBeVisible()

    // Should show retry button
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
  })

  test('responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Should show mobile-optimized layout
    await expect(page.getByText('WKR Beoordelaar 2025')).toBeVisible()

    // Upload zone should be responsive
    const uploadZone = page.locator('[data-testid="upload-zone"]')
    await expect(uploadZone).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()

    // Should adapt to tablet layout
    await expect(page.getByText('WKR Beoordelaar 2025')).toBeVisible()
  })

  test('accessibility compliance', async ({ page }) => {
    await page.goto('/')

    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()

    // Test screen reader support
    const mainContent = page.locator('main')
    await expect(mainContent).toHaveAttribute('role', 'main')

    // Test color contrast (would need specific tools)
    // Test focus indicators
    const uploadButton = page.getByRole('button', { name: /upload/i })
    await uploadButton.focus()
    await expect(uploadButton).toHaveClass(/focus/)
  })
})
```

### Performance Tests
```typescript
// tests/performance/load-testing.test.ts
import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('large file processing performance', async ({ page }) => {
    await page.goto('/')

    // Monitor performance
    const startTime = Date.now()

    // Upload large XAF file (10MB+)
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/large-sample.xaf')

    // Wait for parsing
    await expect(page.getByText('File successfully parsed')).toBeVisible({ timeout: 30000 })

    const parseTime = Date.now() - startTime
    expect(parseTime).toBeLessThan(15000) // Should parse within 15 seconds

    // Start analysis
    const analysisStartTime = Date.now()
    await page.getByRole('button', { name: 'Start Analysis' }).click()

    // Wait for completion
    await expect(page.getByText('Analysis complete')).toBeVisible({ timeout: 60000 })

    const analysisTime = Date.now() - analysisStartTime
    expect(analysisTime).toBeLessThan(45000) // Should analyze within 45 seconds
  })

  test('memory usage during analysis', async ({ page }) => {
    await page.goto('/')

    // Monitor memory usage
    const memoryBefore = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    // Perform analysis
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/sample.xaf')
    await page.getByRole('button', { name: 'Start Analysis' }).click()
    await expect(page.getByText('Analysis complete')).toBeVisible({ timeout: 60000 })

    const memoryAfter = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0
    })

    const memoryIncrease = memoryAfter - memoryBefore
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Should use <100MB additional memory
  })
})
```

## Documentation

### User Documentation
```markdown
<!-- docs/user-guide.md -->
# WKR Beoordelaar 2025 - Gebruikershandleiding

## Inleiding

De WKR Beoordelaar 2025 is een webapplicatie die u helpt bij het analyseren van uw XAF bestanden voor werkkostenregeling (WKR) compliance. Deze handleiding begeleidt u door alle functionaliteiten van de applicatie.

## Aan de slag

### Stap 1: XAF bestand uploaden

1. Open de WKR Beoordelaar in uw webbrowser
2. Sleep uw XAF bestand naar de upload zone, of klik om een bestand te selecteren
3. Wacht tot het bestand is geparst (dit kan enkele seconden duren)

**Ondersteunde bestandsformaten:**
- .xaf bestanden (XML Audit Files)
- .xml bestanden in XAF formaat
- Maximale bestandsgrootte: 100MB

### Stap 2: Analyse starten

1. Nadat uw bestand is geparsd, klik op "Start WKR Analysis"
2. De AI begint met het analyseren van uw transacties
3. Resultaten verschijnen real-time in het hoofdpaneel

### Stap 3: Resultaten bekijken

Het analyse dashboard toont:

#### Samenvatting
- Overzicht van de belangrijkste bevindingen
- Totale zekerheidscore van de analyse

#### Bevindingen
- Per transactie: WKR relevant ja/nee
- Zekerheidspercentage per beoordeling
- Redenering achter elke beslissing

#### Berekeningen
- **Loonsom:** Geschatte of verstrekte loonsom
- **Vrije ruimte:** 1,7% van de loonsom
- **Gebruikt:** Totaal van WKR-relevante kosten
- **Verbruik:** Percentage van de vrije ruimte gebruikt

#### Vrijstellingen
- Geïdentificeerde mogelijkheden voor gerichte vrijstellingen
- Potentiële besparingen per vrijstellingstype

### Stap 4: Resultaten exporteren

1. Klik op "Export Results" in het dashboard
2. Kies uw gewenste format:
   - **PDF:** Volledig rapport voor print/archief
   - **Excel:** Data in spreadsheet formaat
   - **CSV:** Ruwe transactiedata
   - **Markdown:** Tekst-gebaseerd rapport

3. Configureer export opties (branding, content selectie)
4. Download uw rapport

## Belangrijke begrippen

### Werkkostenregeling (WKR)
De WKR staat werkgevers toe om belastingvrije vergoedingen te verstrekken aan werknemers tot 1,7% van de loonsom.

### Vrije ruimte
Het maximale bedrag dat u belastingvrij kunt besteden:
- Berekening: 1,7% × loonsom
- Minimum: €500 per werknemer per jaar
- Maximum: €1.200 per werknemer per jaar

### Gerichte vrijstellingen
Specifieke kostensoorten die buiten de vrije ruimte om belastingvrij vergoed kunnen worden:
- Reiskosten woon-werk (€0,23/km)
- Zakelijke reiskosten
- Opleidingskosten
- Relatiegeschenken (max €50)

## Veelgestelde vragen

### Hoe accuraat zijn de analyses?
De AI geeft per transactie een zekerheidspercentage. Transacties met lage zekerheid (<70%) verdienen handmatige controle.

### Wat als mijn XAF bestand niet werkt?
- Controleer of het bestand geldig XAF formaat heeft
- Probeer het bestand opnieuw te exporteren uit uw boekhoudsoftware
- Contacteer support als het probleem aanhoudt

### Kan ik de analyse resultaten vertrouwen?
De tool geeft indicaties voor WKR compliance, maar vervangt geen professioneel belastingadvies. Raadpleeg altijd een belastingadviseur voor definitieve beslissingen.

## Ondersteuning

Voor technische ondersteuning of vragen over de werkkostenregeling:
- Gebruik de Help functie in de applicatie
- Raadpleeg de Nederlandse belastingdienst voor officiële WKR informatie
```

### API Documentation
```markdown
<!-- docs/api-reference.md -->
# API Reference

## Authentication
The WKR tool currently runs on localhost without authentication. In production, implement proper API key authentication.

## Endpoints

### POST /api/upload
Upload and parse XAF files.

**Request:**
```bash
curl -X POST \
  -F "file=@sample.xaf" \
  http://localhost:3000/api/upload
```

**Response:**
```json
{
  "success": true,
  "fileName": "sample.xaf",
  "size": 1024000,
  "uploadId": "abc123"
}
```

### POST /api/parse
Parse uploaded XAF file and extract transactions.

**Request:**
```json
{
  "uploadId": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "header": { "fiscalYear": 2023 },
    "company": { "name": "Company B.V." },
    "transactions": [...],
    "accounts": [...]
  },
  "stats": {
    "totalTransactions": 1250,
    "totalAccounts": 45,
    "dateRange": {
      "start": "2023-01-01",
      "end": "2023-12-31"
    }
  }
}
```

### POST /api/filter
Filter transactions based on WKR rules.

**Request:**
```json
{
  "transactions": [...],
  "filterConfig": {
    "rules": {
      "includePatterns": ["4*"],
      "excludePatterns": ["49*"],
      "excludeSpecific": ["430000", "403130"]
    }
  }
}
```

### POST /api/analyze
Perform WKR analysis on filtered transactions.

**Request:**
```json
{
  "transactions": [...],
  "analysisType": "standard",
  "companyInfo": {
    "wageSum": 100000
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "summary": "...",
    "findings": [...],
    "calculations": {
      "totalWageSum": 100000,
      "freeSpace": 1700,
      "usedSpace": 850,
      "usagePercentage": 50
    },
    "exemptions": [...],
    "recommendations": [...]
  }
}
```

### POST /api/analyze/stream
Stream real-time analysis results using Server-Sent Events.

**Request:** Same as /api/analyze

**Response:** Server-Sent Events stream
```
data: {"type":"progress","data":{"stage":"initializing"}}

data: {"type":"content","data":{"chunk":"## Samenvatting\n"}}

data: {"type":"complete","data":{"content":"..."}}
```

### POST /api/export
Export analysis results in various formats.

**Request:**
```json
{
  "analysis": {...},
  "transactions": [...],
  "options": {
    "format": "pdf",
    "includeCharts": true,
    "branding": {
      "companyName": "My Company"
    }
  }
}
```

## Error Responses

All endpoints return errors in consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

Common HTTP status codes:
- 400: Bad Request (invalid input)
- 429: Too Many Requests (rate limited)
- 500: Internal Server Error
```

### Deployment Guide
```markdown
<!-- docs/deployment.md -->
# Deployment Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Google AI API key (Gemini)

## Environment Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Configure environment variables:
   ```env
   GOOGLE_AI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-pro
   NEXTAUTH_SECRET=your_secret_key
   ```

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run e2e tests
npm run test:e2e

# Build for production
npm run build
```

## Production Deployment

### Docker Deployment

1. Build Docker image:
   ```bash
   docker build -t wkr-tool .
   ```

2. Run container:
   ```bash
   docker run -p 3000:3000 \
     -e GOOGLE_AI_API_KEY=your_key \
     wkr-tool
   ```

### Vercel Deployment

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard

### Performance Optimization

- Enable gzip compression
- Configure CDN for static assets
- Set appropriate cache headers
- Monitor Core Web Vitals

### Security Checklist

- [ ] API rate limiting enabled
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] File upload validation
- [ ] XSS protection enabled
- [ ] HTTPS enforced

### Monitoring

Set up monitoring for:
- Application performance
- Error rates
- API response times
- Memory usage
- Disk space (for file uploads)
```

## Test Configuration

### Test Setup
```javascript
// jest.setup.js
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock file reader
global.FileReader = class {
  readAsText = jest.fn()
  readAsArrayBuffer = jest.fn()
  onload = null
  onerror = null
  result = null
}

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
})
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run type-check

      - name: Run unit tests
        run: npm run test:coverage

      - name: Run e2e tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Archive build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-files
          path: .next/
```

## Definition of Done
- [ ] Unit test coverage >85%
- [ ] Integration tests voor alle API endpoints
- [ ] E2E tests voor critical user journeys
- [ ] Performance tests voor large files
- [ ] Accessibility tests (WCAG 2.1 AA)
- [ ] User documentation compleet
- [ ] API documentation bijgewerkt
- [ ] Deployment guide beschikbaar
- [ ] CI/CD pipeline operationeel

## Testing Targets
- **Unit Test Coverage:** >85%
- **Integration Test Coverage:** >80%
- **E2E Test Coverage:** Critical paths covered
- **Performance:** Large files tested
- **Accessibility:** WCAG 2.1 AA compliance
- **Cross-browser:** Chrome, Firefox, Safari, Edge