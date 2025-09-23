# Story 3: XAF Parser Basis

**Sprint:** 1
**Estimate:** 1-2 dagen
**Priority:** Critical

## User Story
Als systeem wil ik XAF bestanden kunnen parsen en valideren zodat ik de boekhoudkundige data kan extraheren voor analyse.

## Acceptatiecriteria
- [x] XML parsing bibliotheek geïntegreerd
- [x] XAF schema validatie
- [x] Data extractie naar JSON structuur
- [x] Error handling voor corrupte files
- [x] Support voor verschillende XAF versies
- [x] Memory-efficient parsing voor grote bestanden

## XAF File Structure Understanding

### Typical XAF Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
  <header>
    <fiscalYear>2023</fiscalYear>
    <startDate>2023-01-01</startDate>
    <endDate>2023-12-31</endDate>
    <curCode>EUR</curCode>
    <dateCreated>2024-01-15</dateCreated>
    <softwareDesc>Exact Online</softwareDesc>
    <softwareVersion>1.0</softwareVersion>
  </header>
  <company>
    <companyIdent>12345678</companyIdent>
    <companyName>Example B.V.</companyName>
    <taxRegistrationCountry>NL</taxRegistrationCountry>
    <taxRegIdent>NL123456789B01</taxRegIdent>
  </company>
  <generalLedgerAccounts>
    <generalLedgerAccount>
      <accID>400000</accID>
      <accDesc>Omzet algemeen</accDesc>
      <accType>P</accType>
    </generalLedgerAccount>
  </generalLedgerAccounts>
  <transactions>
    <linesCount>1250</linesCount>
    <totalDebit>500000.00</totalDebit>
    <totalCredit>500000.00</totalCredit>
    <journal>
      <jrnID>VK</jrnID>
      <desc>Verkopen</desc>
      <jrnTp>S</jrnTp>
      <transaction>
        <nr>108308</nr>
        <desc>Spitters Vastgoed BV_Kazernelaan</desc>
        <periodNumber>1</periodNumber>
        <trDt>2023-01-01</trDt>
        <amnt>9834.50</amnt>
        <line>
          <nr>1</nr>
          <accID>440000</accID>
          <docRef>INV-2023-001</docRef>
          <effDate>2023-01-01</effDate>
          <desc>Huur januari 2023</desc>
          <amnt>9834.50</amnt>
          <amntTp>D</amntTp>
        </line>
      </transaction>
    </journal>
  </transactions>
</auditfile>
```

## Technical Implementation

### XML Parser Setup
```typescript
// src/lib/parsers/xaf-parser.ts
import { XMLParser } from 'fast-xml-parser'

export interface XAFParserOptions {
  ignoreAttributes: boolean
  parseAttributeValue: boolean
  trimValues: boolean
  processEntities: boolean
}

export const defaultParserOptions: XAFParserOptions = {
  ignoreAttributes: false,
  parseAttributeValue: true,
  trimValues: true,
  processEntities: true
}

export class XAFParser {
  private xmlParser: XMLParser

  constructor(options: XAFParserOptions = defaultParserOptions) {
    this.xmlParser = new XMLParser({
      ignoreAttributes: options.ignoreAttributes,
      parseAttributeValue: options.parseAttributeValue,
      trimValues: options.trimValues,
      processEntities: options.processEntities,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    })
  }

  async parseXAF(fileContent: string): Promise<ParsedXAF> {
    try {
      // Pre-validation
      this.validateXMLStructure(fileContent)

      // Parse XML
      const parsed = this.xmlParser.parse(fileContent)

      // Validate XAF schema
      this.validateXAFSchema(parsed)

      // Extract structured data
      return this.extractXAFData(parsed)

    } catch (error) {
      throw new XAFParseError(
        `XAF parsing failed: ${error.message}`,
        error
      )
    }
  }

  private validateXMLStructure(content: string): void {
    // Check for XML declaration
    if (!content.trim().startsWith('<?xml')) {
      throw new Error('Invalid XML: Missing XML declaration')
    }

    // Check for XAF namespace
    if (!content.includes('auditfile')) {
      throw new Error('Invalid XAF: Missing auditfile root element')
    }

    // Basic well-formedness check
    const openTags = (content.match(/<[^/][^>]*>/g) || []).length
    const closeTags = (content.match(/<\/[^>]*>/g) || []).length
    if (openTags !== closeTags) {
      throw new Error('Invalid XML: Mismatched tags')
    }
  }

  private validateXAFSchema(parsed: any): void {
    if (!parsed.auditfile) {
      throw new Error('Invalid XAF: Missing auditfile root element')
    }

    const required = ['header', 'company', 'generalLedgerAccounts', 'transactions']
    for (const field of required) {
      if (!parsed.auditfile[field]) {
        throw new Error(`Invalid XAF: Missing required section '${field}'`)
      }
    }
  }
}
```

### Data Extraction Logic
```typescript
// src/lib/parsers/xaf-extractor.ts
export interface ParsedXAF {
  header: XAFHeader
  company: XAFCompany
  accounts: XAFAccount[]
  transactions: XAFTransaction[]
  metadata: XAFMetadata
}

export interface XAFTransaction {
  transactionNumber: string
  description: string
  date: string
  lines: XAFTransactionLine[]
  journal: string
  period: number
}

export interface XAFTransactionLine {
  lineNumber: number
  accountId: string
  accountName?: string
  description: string
  amount: number
  amountType: 'D' | 'C' // Debit or Credit
  effectiveDate: string
  documentReference?: string
}

export class XAFExtractor {
  extractXAFData(parsed: any): ParsedXAF {
    const auditfile = parsed.auditfile

    return {
      header: this.extractHeader(auditfile.header),
      company: this.extractCompany(auditfile.company),
      accounts: this.extractAccounts(auditfile.generalLedgerAccounts),
      transactions: this.extractTransactions(auditfile.transactions),
      metadata: this.extractMetadata(auditfile)
    }
  }

  private extractTransactions(transactionsData: any): XAFTransaction[] {
    const transactions: XAFTransaction[] = []

    // Handle different XAF structures
    const journals = Array.isArray(transactionsData.journal)
      ? transactionsData.journal
      : [transactionsData.journal]

    for (const journal of journals) {
      const journalTransactions = Array.isArray(journal.transaction)
        ? journal.transaction
        : [journal.transaction]

      for (const transaction of journalTransactions) {
        transactions.push({
          transactionNumber: transaction.nr,
          description: transaction.desc || '',
          date: transaction.trDt,
          journal: journal.jrnID,
          period: parseInt(transaction.periodNumber || '1'),
          lines: this.extractTransactionLines(transaction.line)
        })
      }
    }

    return transactions
  }

  private extractTransactionLines(linesData: any): XAFTransactionLine[] {
    const lines = Array.isArray(linesData) ? linesData : [linesData]

    return lines.map(line => ({
      lineNumber: parseInt(line.nr),
      accountId: line.accID,
      description: line.desc || '',
      amount: parseFloat(line.amnt),
      amountType: line.amntTp as 'D' | 'C',
      effectiveDate: line.effDate,
      documentReference: line.docRef
    }))
  }

  private extractAccounts(accountsData: any): XAFAccount[] {
    const accounts = Array.isArray(accountsData.generalLedgerAccount)
      ? accountsData.generalLedgerAccount
      : [accountsData.generalLedgerAccount]

    return accounts.map(account => ({
      id: account.accID,
      name: account.accDesc,
      type: account.accType
    }))
  }
}
```

### Error Handling
```typescript
// src/lib/parsers/xaf-errors.ts
export class XAFParseError extends Error {
  constructor(
    message: string,
    public originalError?: Error,
    public context?: any
  ) {
    super(message)
    this.name = 'XAFParseError'
  }
}

export class XAFValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any
  ) {
    super(message)
    this.name = 'XAFValidationError'
  }
}

export function handleParsingError(error: unknown): XAFParseError {
  if (error instanceof XAFParseError) {
    return error
  }

  if (error instanceof Error) {
    if (error.message.includes('XML')) {
      return new XAFParseError(
        'Ongeldig XML bestand. Controleer of het bestand niet beschadigd is.',
        error
      )
    }

    if (error.message.includes('namespace')) {
      return new XAFParseError(
        'Ongeldig XAF bestand. Controleer of het een geldig XAF formaat heeft.',
        error
      )
    }
  }

  return new XAFParseError(
    'Onbekende fout bij het verwerken van het XAF bestand.',
    error instanceof Error ? error : new Error(String(error))
  )
}
```

## Memory Management for Large Files

### Streaming Parser for Large XAF Files
```typescript
// src/lib/parsers/xaf-stream-parser.ts
import { Transform } from 'stream'

export class XAFStreamParser extends Transform {
  private buffer = ''
  private isInTransaction = false
  private currentTransaction = ''

  _transform(chunk: any, encoding: string, callback: Function) {
    this.buffer += chunk.toString()

    // Process complete transactions
    while (this.hasCompleteTransaction()) {
      const transaction = this.extractNextTransaction()
      if (transaction) {
        this.push(transaction)
      }
    }

    callback()
  }

  private hasCompleteTransaction(): boolean {
    return this.buffer.includes('</transaction>')
  }

  private extractNextTransaction(): string | null {
    const start = this.buffer.indexOf('<transaction>')
    const end = this.buffer.indexOf('</transaction>') + '</transaction>'.length

    if (start !== -1 && end !== -1) {
      const transaction = this.buffer.slice(start, end)
      this.buffer = this.buffer.slice(end)
      return transaction
    }

    return null
  }
}
```

## API Integration

### Parser API Endpoint
```typescript
// src/app/api/parse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { XAFParser } from '@/lib/parsers/xaf-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand ontvangen' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    // Parse XAF
    const parser = new XAFParser()
    const parsedData = await parser.parseXAF(content)

    // Return structured data
    return NextResponse.json({
      success: true,
      data: parsedData,
      stats: {
        totalTransactions: parsedData.transactions.length,
        totalAccounts: parsedData.accounts.length,
        dateRange: {
          start: parsedData.header.startDate,
          end: parsedData.header.endDate
        }
      }
    })

  } catch (error) {
    console.error('XAF parsing error:', error)

    if (error instanceof XAFParseError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Interne serverfout bij het verwerken van het XAF bestand' },
      { status: 500 }
    )
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
// src/lib/parsers/__tests__/xaf-parser.test.ts
import { XAFParser } from '../xaf-parser'

describe('XAFParser', () => {
  let parser: XAFParser

  beforeEach(() => {
    parser = new XAFParser()
  })

  test('should parse valid XAF file', async () => {
    const validXAF = `<?xml version="1.0" encoding="UTF-8"?>
      <auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
        <!-- Valid XAF content -->
      </auditfile>`

    const result = await parser.parseXAF(validXAF)
    expect(result).toBeDefined()
    expect(result.header).toBeDefined()
    expect(result.transactions).toBeInstanceOf(Array)
  })

  test('should throw error for invalid XML', async () => {
    const invalidXML = '<invalid>unclosed tag'

    await expect(parser.parseXAF(invalidXML))
      .rejects
      .toThrow('XAF parsing failed')
  })

  test('should handle large transaction volumes', async () => {
    // Test with file containing 10000+ transactions
    const largeXAF = generateLargeXAF(10000)
    const result = await parser.parseXAF(largeXAF)

    expect(result.transactions.length).toBe(10000)
  })
})
```

### Integration Tests
```typescript
// src/app/api/parse/__tests__/route.test.ts
import { POST } from '../route'

describe('/api/parse', () => {
  test('should parse uploaded XAF file', async () => {
    const file = new File(['<valid xaf content>'], 'test.xaf', {
      type: 'application/xml'
    })

    const formData = new FormData()
    formData.append('file', file)

    const request = new Request('http://localhost/api/parse', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "fast-xml-parser": "^4.3.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "jest": "^29.7.0"
  }
}
```

## Definition of Done
- [ ] XAF files parsed correctly naar JSON structure
- [ ] Schema validatie voorkomt invalid files
- [ ] Error handling geeft duidelijke feedback
- [ ] Memory usage blijft onder 512MB voor 100MB files
- [ ] Parser werkt met verschillende XAF versies (3.2, 4.0)
- [ ] Unit tests coverage >90%
- [ ] Integration tests met echte XAF bestanden
- [ ] Performance test: 50MB file in <5 seconden

## Performance Targets
- Parse 10MB XAF file: <2 seconden
- Parse 50MB XAF file: <5 seconden
- Parse 100MB XAF file: <10 seconden
- Memory usage: Max 2x file size
- Support voor 10,000+ transactions