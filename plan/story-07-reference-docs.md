# Story 7: Referentie Documenten Processing

**Sprint:** 3
**Estimate:** 1 dag
**Priority:** High

## User Story
Als systeem wil ik WKR referentie documenten kunnen verwerken zodat de AI analyse kan worden verrijkt met actuele Nederlandse regelgeving.

## Acceptatiecriteria
- [x] PDF text extractie (wkr1.pdf, wkr2.pdf)
- [x] Context opbouw voor Gemini
- [x] Kennisbank structuur
- [x] OCR ondersteuning voor gescande PDFs
- [x] Tekst preprocessing en cleaning
- [x] Chunking voor grote documenten

## Technical Implementation

### PDF Processing Pipeline
```typescript
// src/lib/documents/pdf-processor.ts
import pdf from 'pdf-parse'
import fs from 'fs/promises'
import path from 'path'

export interface ProcessedDocument {
  filename: string
  title: string
  content: string
  chunks: DocumentChunk[]
  metadata: DocumentMetadata
  lastProcessed: Date
}

export interface DocumentChunk {
  id: string
  content: string
  section: string
  startPage: number
  endPage: number
  relevanceScore?: number
}

export interface DocumentMetadata {
  pageCount: number
  size: number
  version?: string
  subject?: string
  author?: string
  creationDate?: Date
}

export class PDFProcessor {
  private readonly documentsPath = path.join(process.cwd(), 'plan')

  async processWKRDocuments(): Promise<ProcessedDocument[]> {
    const documents: ProcessedDocument[] = []

    try {
      const wkr1 = await this.processDocument('wkr1.pdf')
      const wkr2 = await this.processDocument('wkr2.pdf')

      documents.push(wkr1, wkr2)

      // Cache processed documents
      await this.cacheDocuments(documents)

      return documents
    } catch (error) {
      throw new DocumentProcessingError(
        'Failed to process WKR documents',
        error
      )
    }
  }

  private async processDocument(filename: string): Promise<ProcessedDocument> {
    const filePath = path.join(this.documentsPath, filename)

    // Check if file exists
    await this.validateFile(filePath)

    // Read and parse PDF
    const buffer = await fs.readFile(filePath)
    const pdfData = await pdf(buffer)

    // Extract and clean text
    const cleanedText = this.cleanText(pdfData.text)

    // Create chunks
    const chunks = this.createChunks(cleanedText, filename)

    // Extract metadata
    const metadata = this.extractMetadata(pdfData, buffer)

    return {
      filename,
      title: this.extractTitle(cleanedText) || filename,
      content: cleanedText,
      chunks,
      metadata,
      lastProcessed: new Date()
    }
  }

  private async validateFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) {
        throw new Error(`${filePath} is not a file`)
      }

      if (stats.size === 0) {
        throw new Error(`${filePath} is empty`)
      }

      if (stats.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error(`${filePath} is too large (>50MB)`)
      }

    } catch (error) {
      throw new DocumentProcessingError(
        `File validation failed: ${filePath}`,
        error
      )
    }
  }

  private cleanText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page numbers and headers/footers
      .replace(/\n\s*\d+\s*\n/g, '\n')
      // Remove special characters that interfere with parsing
      .replace(/[^\w\s\n.,;:!?()-]/g, '')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      // Remove empty lines
      .replace(/\n\s*\n/g, '\n')
      .trim()
  }

  private createChunks(text: string, filename: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const maxChunkSize = 1500 // characters
    const overlap = 200 // character overlap between chunks

    // Split by sections first
    const sections = this.identifySections(text)

    for (const section of sections) {
      if (section.content.length <= maxChunkSize) {
        chunks.push({
          id: `${filename}_${section.title}_${chunks.length}`,
          content: section.content,
          section: section.title,
          startPage: section.startPage,
          endPage: section.endPage
        })
      } else {
        // Split large sections into smaller chunks
        const sectionChunks = this.splitIntoChunks(
          section.content,
          maxChunkSize,
          overlap
        )

        sectionChunks.forEach((chunk, index) => {
          chunks.push({
            id: `${filename}_${section.title}_${index}`,
            content: chunk,
            section: section.title,
            startPage: section.startPage,
            endPage: section.endPage
          })
        })
      }
    }

    return chunks
  }

  private identifySections(text: string): Array<{
    title: string
    content: string
    startPage: number
    endPage: number
  }> {
    const sections = []

    // Common WKR document section patterns
    const sectionPatterns = [
      /(?:hoofdstuk|artikel|paragraaf|sectie)\s+\d+[^\\n]*/gi,
      /\d+\.\s+[A-Z][^\\n]{10,}/g,
      /[A-Z][A-Z\s]{5,}(?=\n)/g
    ]

    // Simple implementation - split by major headings
    const lines = text.split('\n')
    let currentSection = { title: 'Inleiding', content: '', startPage: 1, endPage: 1 }

    for (const line of lines) {
      const isHeading = sectionPatterns.some(pattern => pattern.test(line))

      if (isHeading && currentSection.content.length > 100) {
        sections.push({ ...currentSection })
        currentSection = {
          title: line.trim(),
          content: '',
          startPage: currentSection.endPage,
          endPage: currentSection.endPage
        }
      } else {
        currentSection.content += line + '\n'
      }
    }

    if (currentSection.content.length > 0) {
      sections.push(currentSection)
    }

    return sections
  }

  private splitIntoChunks(
    text: string,
    maxSize: number,
    overlap: number
  ): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      let end = Math.min(start + maxSize, text.length)

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastSentence = text.lastIndexOf('.', end)
        const lastNewline = text.lastIndexOf('\n', end)
        const breakPoint = Math.max(lastSentence, lastNewline)

        if (breakPoint > start + maxSize * 0.7) {
          end = breakPoint + 1
        }
      }

      chunks.push(text.slice(start, end).trim())
      start = Math.max(start + maxSize - overlap, end)
    }

    return chunks
  }

  private extractMetadata(pdfData: any, buffer: Buffer): DocumentMetadata {
    return {
      pageCount: pdfData.numpages || 0,
      size: buffer.length,
      version: pdfData.version,
      subject: pdfData.info?.Subject,
      author: pdfData.info?.Author,
      creationDate: pdfData.info?.CreationDate ? new Date(pdfData.info.CreationDate) : undefined
    }
  }

  private extractTitle(text: string): string | null {
    // Extract title from first few lines
    const lines = text.split('\n').slice(0, 10)

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 10 && trimmed.length < 100) {
        // Likely a title
        if (trimmed.toLowerCase().includes('werkkosten') ||
            trimmed.toLowerCase().includes('wkr') ||
            trimmed.toLowerCase().includes('regeling')) {
          return trimmed
        }
      }
    }

    return null
  }

  private async cacheDocuments(documents: ProcessedDocument[]): Promise<void> {
    const cacheDir = path.join(process.cwd(), '.cache', 'documents')

    try {
      await fs.mkdir(cacheDir, { recursive: true })

      for (const doc of documents) {
        const cachePath = path.join(cacheDir, `${doc.filename}.json`)
        await fs.writeFile(cachePath, JSON.stringify(doc, null, 2))
      }
    } catch (error) {
      console.warn('Failed to cache documents:', error)
      // Non-critical error, continue execution
    }
  }
}
```

### Knowledge Base Builder
```typescript
// src/lib/documents/knowledge-base.ts
export class WKRKnowledgeBase {
  private documents: ProcessedDocument[] = []
  private searchIndex: Map<string, DocumentChunk[]> = new Map()

  async initialize(): Promise<void> {
    const processor = new PDFProcessor()
    this.documents = await processor.processWKRDocuments()
    await this.buildSearchIndex()
  }

  private async buildSearchIndex(): Promise<void> {
    // Build keyword-based search index
    const keywords = [
      'werkkostenregeling', 'wkr', 'vrije ruimte', 'loonsom',
      'vrijstelling', 'vergoeding', 'verstrekking', 'werkgever',
      'werknemer', 'belasting', 'reiskosten', 'representatie',
      'opleiding', 'relatiegeschenk', 'fiets'
    ]

    for (const keyword of keywords) {
      const relevantChunks = this.findRelevantChunks(keyword)
      this.searchIndex.set(keyword.toLowerCase(), relevantChunks)
    }
  }

  private findRelevantChunks(keyword: string): DocumentChunk[] {
    const relevantChunks: DocumentChunk[] = []

    for (const doc of this.documents) {
      for (const chunk of doc.chunks) {
        const content = chunk.content.toLowerCase()
        const keywordLower = keyword.toLowerCase()

        // Calculate relevance score
        const occurrences = (content.match(new RegExp(keywordLower, 'g')) || []).length
        const proximity = this.calculateProximity(content, keywordLower)
        const relevanceScore = occurrences * 10 + proximity

        if (relevanceScore > 5) {
          relevantChunks.push({
            ...chunk,
            relevanceScore
          })
        }
      }
    }

    // Sort by relevance score
    return relevantChunks.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  private calculateProximity(text: string, keyword: string): number {
    const words = text.split(/\s+/)
    let proximityScore = 0

    for (let i = 0; i < words.length; i++) {
      if (words[i].includes(keyword)) {
        // Higher score if keyword appears near important terms
        const context = words.slice(Math.max(0, i - 5), i + 6).join(' ')
        const importantTerms = ['artikel', 'regel', 'bepaling', 'vrijstelling', 'berekening']

        for (const term of importantTerms) {
          if (context.includes(term)) {
            proximityScore += 5
          }
        }
      }
    }

    return proximityScore
  }

  getRelevantContext(query: string): string {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const relevantChunks: DocumentChunk[] = []

    // Find chunks relevant to query terms
    for (const term of queryTerms) {
      const chunks = this.searchIndex.get(term) || []
      relevantChunks.push(...chunks.slice(0, 3)) // Top 3 per term
    }

    // Remove duplicates and sort by relevance
    const uniqueChunks = Array.from(
      new Map(relevantChunks.map(chunk => [chunk.id, chunk])).values()
    ).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))

    // Combine top chunks into context
    const topChunks = uniqueChunks.slice(0, 5)
    return topChunks.map(chunk => `
**${chunk.section}**
${chunk.content}
`).join('\n---\n')
  }

  getWKRRules(): string {
    const ruleChunks = this.findRelevantChunks('regel')
      .concat(this.findRelevantChunks('artikel'))
      .concat(this.findRelevantChunks('bepaling'))

    const uniqueRules = Array.from(
      new Map(ruleChunks.map(chunk => [chunk.id, chunk])).values()
    ).slice(0, 10)

    return uniqueRules.map(chunk => chunk.content).join('\n\n')
  }

  getExemptionRules(): string {
    const exemptionChunks = this.findRelevantChunks('vrijstelling')
      .concat(this.findRelevantChunks('uitgezonderd'))
      .concat(this.findRelevantChunks('niet belast'))

    return exemptionChunks.slice(0, 8)
      .map(chunk => chunk.content)
      .join('\n\n')
  }

  getCalculationRules(): string {
    const calcChunks = this.findRelevantChunks('berekening')
      .concat(this.findRelevantChunks('loonsom'))
      .concat(this.findRelevantChunks('vrije ruimte'))
      .concat(this.findRelevantChunks('1,7%'))

    return calcChunks.slice(0, 6)
      .map(chunk => chunk.content)
      .join('\n\n')
  }

  searchDocuments(query: string, limit: number = 5): DocumentChunk[] {
    const queryTerms = query.toLowerCase().split(/\s+/)
    const allChunks = this.documents.flatMap(doc => doc.chunks)

    // Score each chunk based on query terms
    const scoredChunks = allChunks.map(chunk => {
      let score = 0
      const content = chunk.content.toLowerCase()

      for (const term of queryTerms) {
        const occurrences = (content.match(new RegExp(term, 'g')) || []).length
        score += occurrences * 10

        // Bonus for exact phrase matches
        if (content.includes(query.toLowerCase())) {
          score += 50
        }
      }

      return { ...chunk, relevanceScore: score }
    })

    return scoredChunks
      .filter(chunk => chunk.relevanceScore! > 0)
      .sort((a, b) => b.relevanceScore! - a.relevanceScore!)
      .slice(0, limit)
  }
}
```

### Document Error Handling
```typescript
// src/lib/documents/document-errors.ts
export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public documentPath?: string
  ) {
    super(message)
    this.name = 'DocumentProcessingError'
  }
}

export class DocumentValidator {
  static async validateWKRDocuments(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    const requiredFiles = ['wkr1.pdf', 'wkr2.pdf']

    for (const filename of requiredFiles) {
      const result = await this.validateDocument(filename)
      results.push(result)
    }

    return results
  }

  private static async validateDocument(filename: string): Promise<ValidationResult> {
    const filePath = path.join(process.cwd(), 'plan', filename)

    try {
      const stats = await fs.stat(filePath)

      // Basic file validation
      if (!stats.isFile()) {
        return {
          filename,
          isValid: false,
          errors: ['File is not a regular file']
        }
      }

      if (stats.size === 0) {
        return {
          filename,
          isValid: false,
          errors: ['File is empty']
        }
      }

      // Try to parse PDF
      const buffer = await fs.readFile(filePath)
      const pdfData = await pdf(buffer)

      const warnings: string[] = []

      if (pdfData.numpages < 5) {
        warnings.push('Document has very few pages (<5)')
      }

      if (!pdfData.text || pdfData.text.length < 1000) {
        warnings.push('Document contains very little text')
      }

      if (!pdfData.text.toLowerCase().includes('werkkosten')) {
        warnings.push('Document may not be WKR-related')
      }

      return {
        filename,
        isValid: true,
        warnings,
        metadata: {
          pageCount: pdfData.numpages,
          size: stats.size,
          textLength: pdfData.text?.length || 0
        }
      }

    } catch (error) {
      return {
        filename,
        isValid: false,
        errors: [`Failed to process document: ${error.message}`]
      }
    }
  }
}

interface ValidationResult {
  filename: string
  isValid: boolean
  errors?: string[]
  warnings?: string[]
  metadata?: {
    pageCount: number
    size: number
    textLength: number
  }
}
```

### Integration with Prompt System
```typescript
// src/lib/documents/context-integration.ts
export class DocumentContextIntegrator {
  private knowledgeBase: WKRKnowledgeBase

  constructor(knowledgeBase: WKRKnowledgeBase) {
    this.knowledgeBase = knowledgeBase
  }

  async enhancePromptWithContext(
    basePrompt: string,
    transactionData: FilteredTransaction[]
  ): Promise<string> {
    // Analyze transaction types to determine relevant context
    const contextQueries = this.generateContextQueries(transactionData)

    // Gather relevant context from knowledge base
    const contexts = await Promise.all(
      contextQueries.map(query => this.knowledgeBase.getRelevantContext(query))
    )

    // Combine and deduplicate context
    const combinedContext = this.combineContexts(contexts)

    return `${basePrompt}

REFERENTIE CONTEXT UIT WKR DOCUMENTEN:
${combinedContext}

Let op: Gebruik deze context als aanvulling op je bestaande kennis. Bij tegenstrijdigheden geef je voorrang aan de meest recente officiële regelgeving.`
  }

  private generateContextQueries(transactions: FilteredTransaction[]): string[] {
    const queries = new Set<string>()

    // Add base queries
    queries.add('werkkostenregeling algemeen')
    queries.add('vrije ruimte berekening')
    queries.add('loonsom bepaling')

    // Analyze transaction patterns to add specific queries
    for (const tx of transactions) {
      const description = tx.boeking.toLowerCase()

      if (description.includes('reis') || description.includes('km')) {
        queries.add('reiskosten woon-werk')
        queries.add('zakelijke reiskosten')
      }

      if (description.includes('telefoon') || description.includes('mobiel')) {
        queries.add('telefoonkosten zakelijk privé')
      }

      if (description.includes('opleiding') || description.includes('cursus')) {
        queries.add('opleidingskosten vrijstelling')
      }

      if (description.includes('representatie') || description.includes('relatie')) {
        queries.add('representatiekosten')
        queries.add('relatiegeschenken')
      }

      if (description.includes('fiets') || description.includes('lease')) {
        queries.add('fiets van de zaak')
        queries.add('leaseauto privégebruik')
      }
    }

    return Array.from(queries)
  }

  private combineContexts(contexts: string[]): string {
    // Remove duplicates and combine contexts
    const uniqueContexts = Array.from(new Set(contexts.filter(ctx => ctx.trim())))

    // Limit total context length to prevent token overflow
    const maxContextLength = 3000 // characters
    let combinedLength = 0
    const includedContexts: string[] = []

    for (const context of uniqueContexts) {
      if (combinedLength + context.length < maxContextLength) {
        includedContexts.push(context)
        combinedLength += context.length
      }
    }

    return includedContexts.join('\n\n---\n\n')
  }
}
```

## API Integration

### Document Processing Endpoint
```typescript
// src/app/api/documents/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WKRKnowledgeBase } from '@/lib/documents/knowledge-base'

export async function POST(request: NextRequest) {
  try {
    const knowledgeBase = new WKRKnowledgeBase()
    await knowledgeBase.initialize()

    return NextResponse.json({
      success: true,
      message: 'Documents processed successfully',
      documentsCount: 2
    })

  } catch (error) {
    console.error('Document processing error:', error)

    return NextResponse.json(
      { error: 'Failed to process documents' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter required' },
        { status: 400 }
      )
    }

    const knowledgeBase = new WKRKnowledgeBase()
    await knowledgeBase.initialize()

    const results = knowledgeBase.searchDocuments(query, 10)

    return NextResponse.json({
      success: true,
      query,
      results: results.map(chunk => ({
        section: chunk.section,
        content: chunk.content.substring(0, 500),
        relevance: chunk.relevanceScore
      }))
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
```

## Testing

### Unit Tests
```typescript
// src/lib/documents/__tests__/pdf-processor.test.ts
import { PDFProcessor } from '../pdf-processor'
import fs from 'fs/promises'

describe('PDFProcessor', () => {
  let processor: PDFProcessor

  beforeEach(() => {
    processor = new PDFProcessor()
  })

  test('should process PDF documents', async () => {
    // Mock PDF file
    const mockPDFContent = Buffer.from('Mock PDF content')
    jest.spyOn(fs, 'readFile').mockResolvedValue(mockPDFContent)

    // Mock pdf-parse
    jest.mock('pdf-parse', () => ({
      __esModule: true,
      default: jest.fn().mockResolvedValue({
        text: 'Sample WKR document content about werkkostenregeling',
        numpages: 10,
        info: { Title: 'WKR Handleiding' }
      })
    }))

    const result = await processor.processWKRDocuments()

    expect(result).toHaveLength(2)
    expect(result[0].filename).toBe('wkr1.pdf')
    expect(result[0].content).toContain('werkkostenregeling')
  })

  test('should handle processing errors gracefully', async () => {
    jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'))

    await expect(processor.processWKRDocuments())
      .rejects
      .toThrow('Failed to process WKR documents')
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "tesseract.js": "^5.0.0"
  }
}
```

## Definition of Done
- [ ] PDF processing pipeline werkend
- [ ] Knowledge base geïndexeerd
- [ ] Context integratie met prompts
- [ ] Error handling voor document failures
- [ ] Search functionaliteit operationeel
- [ ] Caching van verwerkte documenten
- [ ] Unit tests coverage >85%
- [ ] Performance test met echte PDF bestanden

## Performance Targets
- PDF processing: <10 seconden per document
- Knowledge base initialization: <5 seconden
- Context search: <500ms
- Memory usage: <200MB voor beide PDFs
- Cache hit ratio: >80% na eerste load