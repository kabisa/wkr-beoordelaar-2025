# Story 7: Referentie Documenten Processing

**Sprint:** 3
**Estimate:** 1 dag
**Priority:** High

## User Story
Als systeem wil ik WKR referentie documenten kunnen verwerken zodat de AI analyse kan worden verrijkt met actuele Nederlandse regelgeving.

## Acceptatiecriteria
- [x] Google AI File API integratie
- [x] Eenmalige upload van referentie documenten (wkr1.pdf, wkr2.pdf)
- [x] File ID caching en hergebruik
- [x] Context enrichment voor Gemini prompts
- [x] Automatische document updates bij wijzigingen
- [x] Error handling voor file operations

## Technical Implementation

### Google AI File Manager Integration
```typescript
// src/lib/documents/file-manager.ts
import { GoogleAIFileManager } from '@google/generative-ai/server'
import fs from 'fs/promises'
import path from 'path'

export interface UploadedDocument {
  filename: string
  fileUri: string
  uploadedAt: Date
  displayName: string
  mimeType: string
  sizeBytes: number
}

export interface DocumentCache {
  documents: UploadedDocument[]
  lastUpdated: Date
  version: string
}

export class WKRDocumentManager {
  private fileManager: GoogleAIFileManager
  private cacheFile = path.join(process.cwd(), '.cache', 'document-cache.json')
  private documentsPath = path.join(process.cwd(), 'plan')

  constructor(apiKey: string) {
    this.fileManager = new GoogleAIFileManager(apiKey)
  }

  async initializeDocuments(): Promise<UploadedDocument[]> {
    try {
      // Check cache first
      const cached = await this.loadCache()
      if (cached && this.isCacheValid(cached)) {
        console.log('Using cached document references')
        return cached.documents
      }

      // Upload documents if not cached or cache is invalid
      console.log('Uploading WKR reference documents...')
      const documents = await this.uploadWKRDocuments()

      // Save to cache
      await this.saveCache({
        documents,
        lastUpdated: new Date(),
        version: '1.0.0'
      })

      return documents

    } catch (error) {
      console.error('Failed to initialize documents:', error)
      throw new DocumentManagerError('Document initialization failed', error)
    }
  }

  private async uploadWKRDocuments(): Promise<UploadedDocument[]> {
    const documentFiles = [
      { filename: 'wkr1.pdf', displayName: 'WKR Regelgeving Deel 1' },
      { filename: 'wkr2.pdf', displayName: 'WKR Regelgeving Deel 2' }
    ]

    const uploadedDocs: UploadedDocument[] = []

    for (const doc of documentFiles) {
      const filePath = path.join(this.documentsPath, doc.filename)

      try {
        // Verify file exists
        await fs.access(filePath)
        const stats = await fs.stat(filePath)

        console.log(`Uploading ${doc.filename}...`)

        const uploadResult = await this.fileManager.uploadFile(filePath, {
          mimeType: 'application/pdf',
          displayName: doc.displayName
        })

        uploadedDocs.push({
          filename: doc.filename,
          fileUri: uploadResult.file.uri,
          uploadedAt: new Date(),
          displayName: doc.displayName,
          mimeType: 'application/pdf',
          sizeBytes: stats.size
        })

        console.log(`✅ Uploaded ${doc.filename} -> ${uploadResult.file.uri}`)

      } catch (error) {
        console.error(`Failed to upload ${doc.filename}:`, error)
        throw new DocumentManagerError(`Upload failed for ${doc.filename}`, error)
      }
    }

    return uploadedDocs
  }

  async getDocumentReferences(): Promise<Array<{ fileUri: string; mimeType: string }>> {
    const documents = await this.initializeDocuments()
    return documents.map(doc => ({
      fileUri: doc.fileUri,
      mimeType: doc.mimeType
    }))
  }

  async refreshDocuments(): Promise<UploadedDocument[]> {
    console.log('Refreshing document cache...')

    // Delete old files from Gemini
    const cached = await this.loadCache()
    if (cached) {
      for (const doc of cached.documents) {
        try {
          await this.fileManager.deleteFile(this.extractFileId(doc.fileUri))
          console.log(`Deleted old file: ${doc.filename}`)
        } catch (error) {
          console.warn(`Failed to delete ${doc.filename}:`, error)
        }
      }
    }

    // Clear cache and re-upload
    await this.clearCache()
    return this.initializeDocuments()
  }

  private async loadCache(): Promise<DocumentCache | null> {
    try {
      const cacheData = await fs.readFile(this.cacheFile, 'utf-8')
      return JSON.parse(cacheData)
    } catch {
      return null
    }
  }

  private async saveCache(cache: DocumentCache): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true })
      await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2))
    } catch (error) {
      console.warn('Failed to save document cache:', error)
    }
  }

  private async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFile)
    } catch {
      // Cache file doesn't exist, that's fine
    }
  }

  private isCacheValid(cache: DocumentCache): boolean {
    // Cache is valid for 24 hours
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    const age = Date.now() - new Date(cache.lastUpdated).getTime()

    return age < maxAge && cache.documents.length > 0
  }

  private extractFileId(fileUri: string): string {
    // Extract file ID from URI like "files/abc123..."
    return fileUri.split('/').pop() || fileUri
  }

  async validateDocumentAccess(): Promise<boolean> {
    try {
      const documents = await this.initializeDocuments()

      for (const doc of documents) {
        const fileId = this.extractFileId(doc.fileUri)
        await this.fileManager.getFile(fileId)
      }

      return true
    } catch (error) {
      console.error('Document access validation failed:', error)
      return false
    }
  }

  async getDocumentInfo(): Promise<Array<{
    filename: string
    displayName: string
    sizeBytes: number
    uploadedAt: Date
  }>> {
    const documents = await this.initializeDocuments()
    return documents.map(doc => ({
      filename: doc.filename,
      displayName: doc.displayName,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt
    }))
  }
}
```

### Enhanced Gemini Client with Document Support
```typescript
// src/lib/ai/gemini-with-docs.ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { WKRDocumentManager } from '@/lib/documents/file-manager'

export class GeminiWithDocuments {
  private genAI: GoogleGenerativeAI
  private documentManager: WKRDocumentManager
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.documentManager = new WKRDocumentManager(apiKey)
  }

  async initialize(): Promise<void> {
    // Initialize documents and get references
    await this.documentManager.initializeDocuments()

    // Create model with system instruction
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      systemInstruction: `
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je hebt toegang tot de officiële WKR documentatie die als referentie is geüpload.

BELANGRIJKE INSTRUCTIES:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen uit de geüploade documenten
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte documenten en transacties

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering met verwijzing naar documenten**
      `
    })
  }

  async generateAnalysisWithDocuments(
    prompt: string,
    transactionData: string
  ): Promise<string> {
    try {
      // Get document references
      const documentRefs = await this.documentManager.getDocumentReferences()

      // Prepare content array with documents and prompt
      const content = [
        // Include document references
        ...documentRefs.map(doc => ({
          fileData: {
            fileUri: doc.fileUri,
            mimeType: doc.mimeType
          }
        })),
        // Add the analysis prompt and data
        {
          text: `
TRANSACTIEGEGEVENS:
${transactionData}

ANALYSE OPDRACHT:
${prompt}

Analyseer de bovenstaande transacties volgens de Nederlandse werkkostenregeling,
gebaseerd op de geüploade WKR documentatie.
          `
        }
      ]

      const result = await this.model.generateContent(content)
      const response = await result.response
      return response.text()

    } catch (error) {
      console.error('Document-enhanced analysis failed:', error)
      throw new Error(`Analysis with documents failed: ${error.message}`)
    }
  }

  async generateStreamingAnalysisWithDocuments(
    prompt: string,
    transactionData: string
  ): Promise<AsyncIterable<string>> {
    try {
      const documentRefs = await this.documentManager.getDocumentReferences()

      const content = [
        ...documentRefs.map(doc => ({
          fileData: {
            fileUri: doc.fileUri,
            mimeType: doc.mimeType
          }
        })),
        {
          text: `
TRANSACTIEGEGEVENS:
${transactionData}

ANALYSE OPDRACHT:
${prompt}
          `
        }
      ]

      const result = await this.model.generateContentStream(content)

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            if (chunkText) {
              yield chunkText
            }
          }
        }
      }

    } catch (error) {
      console.error('Streaming analysis with documents failed:', error)
      throw new Error(`Streaming analysis failed: ${error.message}`)
    }
  }

  async getDocumentStatus(): Promise<{
    isInitialized: boolean
    documentsAvailable: number
    lastUpdate: Date | null
  }> {
    try {
      const documents = await this.documentManager.getDocumentInfo()
      return {
        isInitialized: documents.length > 0,
        documentsAvailable: documents.length,
        lastUpdate: documents.length > 0 ? documents[0].uploadedAt : null
      }
    } catch {
      return {
        isInitialized: false,
        documentsAvailable: 0,
        lastUpdate: null
      }
    }
  }

  async refreshDocuments(): Promise<void> {
    await this.documentManager.refreshDocuments()
  }
}
```

### Document Error Handling
```typescript
// src/lib/documents/document-errors.ts
export class DocumentManagerError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public documentFilename?: string
  ) {
    super(message)
    this.name = 'DocumentManagerError'
  }
}

export class DocumentValidator {
  static async validateLocalDocuments(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = []
    const requiredFiles = ['wkr1.pdf', 'wkr2.pdf']
    const documentsPath = path.join(process.cwd(), 'plan')

    for (const filename of requiredFiles) {
      const result = await this.validateLocalDocument(filename, documentsPath)
      results.push(result)
    }

    return results
  }

  private static async validateLocalDocument(
    filename: string,
    documentsPath: string
  ): Promise<ValidationResult> {
    const filePath = path.join(documentsPath, filename)

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

      // Size limit check (Gemini supports files up to 2GB)
      if (stats.size > 100 * 1024 * 1024) { // 100MB practical limit
        return {
          filename,
          isValid: false,
          errors: ['File too large (>100MB). Consider splitting the document.']
        }
      }

      const warnings: string[] = []

      // Check if file is likely a WKR document based on filename
      if (!filename.toLowerCase().includes('wkr')) {
        warnings.push('Filename does not indicate WKR content')
      }

      return {
        filename,
        isValid: true,
        warnings,
        metadata: {
          size: stats.size,
          lastModified: stats.mtime
        }
      }

    } catch (error) {
      return {
        filename,
        isValid: false,
        errors: [`Failed to access document: ${error.message}`]
      }
    }
  }

  static async validateUploadedDocuments(documentManager: WKRDocumentManager): Promise<boolean> {
    try {
      return await documentManager.validateDocumentAccess()
    } catch (error) {
      console.error('Failed to validate uploaded documents:', error)
      return false
    }
  }
}

interface ValidationResult {
  filename: string
  isValid: boolean
  errors?: string[]
  warnings?: string[]
  metadata?: {
    size: number
    lastModified: Date
  }
}
```

### Integration with Analysis System
```typescript
// src/lib/analysis/document-enhanced-analysis.ts
import { GeminiWithDocuments } from '@/lib/ai/gemini-with-docs'
import { WKRPromptBuilder } from '@/lib/prompts/wkr-prompts'

export class DocumentEnhancedAnalysis {
  private geminiWithDocs: GeminiWithDocuments

  constructor(apiKey: string) {
    this.geminiWithDocs = new GeminiWithDocuments(apiKey)
  }

  async initialize(): Promise<void> {
    await this.geminiWithDocs.initialize()
  }

  async performAnalysisWithDocuments(
    transactions: FilteredTransaction[],
    analysisType: 'standard' | 'compliance' | 'detailed' = 'standard'
  ): Promise<string> {
    // Format transaction data
    const transactionData = this.formatTransactionsForAnalysis(transactions)

    // Build enhanced prompt based on analysis type
    const basePrompt = this.buildPromptForAnalysisType(analysisType, transactions)

    // Perform analysis with document context
    return await this.geminiWithDocs.generateAnalysisWithDocuments(
      basePrompt,
      transactionData
    )
  }

  async performStreamingAnalysisWithDocuments(
    transactions: FilteredTransaction[],
    analysisType: 'standard' | 'compliance' | 'detailed' = 'standard'
  ): Promise<AsyncIterable<string>> {
    const transactionData = this.formatTransactionsForAnalysis(transactions)
    const basePrompt = this.buildPromptForAnalysisType(analysisType, transactions)

    return await this.geminiWithDocs.generateStreamingAnalysisWithDocuments(
      basePrompt,
      transactionData
    )
  }

  private formatTransactionsForAnalysis(transactions: FilteredTransaction[]): string {
    const header = "| Grootboek | Boeking | Bedrag | Datum |"
    const separator = "|---|---|---|---|"

    const rows = transactions.map(tx =>
      `| ${tx.grootboek} | ${tx.boeking} | €${tx.bedrag.toFixed(2)} | ${tx.datum} |`
    )

    return [header, separator, ...rows].join('\n')
  }

  private buildPromptForAnalysisType(
    analysisType: string,
    transactions: FilteredTransaction[]
  ): string {
    const basePrompt = `
Analyseer de onderstaande transacties volgens de Nederlandse werkkostenregeling.
Gebruik de geüploade WKR documentatie als primaire bron voor je analyse.

Voor elke transactie:
1. Bepaal of deze onder de WKR valt (ja/nee)
2. Geef een zekerheidspercentage (0-100%)
3. Identificeer relevante vrijstellingen
4. Verwijs naar specifieke artikelen uit de documenten

Formatteer je antwoord als duidelijk gestructureerde markdown.
    `

    switch (analysisType) {
      case 'compliance':
        return `${basePrompt}

FOCUS OP COMPLIANCE:
- Identificeer mogelijke compliance risico's
- Controleer op correcte toepassing van vrijstellingen
- Geef aanbevelingen voor risicomitigatie
        `

      case 'detailed':
        return `${basePrompt}

GEDETAILLEERDE ANALYSE:
- Bereken de vrije ruimte op basis van geschatte loonsom
- Geef specifieke aanbevelingen per transactie
- Analyseer trends en patronen in de uitgaven
- Suggereer optimalisaties voor WKR gebruik
        `

      default:
        return basePrompt
    }
  }

  async getDocumentStatus() {
    return await this.geminiWithDocs.getDocumentStatus()
  }

  async refreshDocuments(): Promise<void> {
    await this.geminiWithDocs.refreshDocuments()
  }
}
```

## API Integration

### Document Management Endpoint
```typescript
// src/app/api/documents/initialize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WKRDocumentManager } from '@/lib/documents/file-manager'

export async function POST(request: NextRequest) {
  try {
    const documentManager = new WKRDocumentManager(process.env.GOOGLE_AI_API_KEY!)
    const documents = await documentManager.initializeDocuments()

    return NextResponse.json({
      success: true,
      message: 'Documents initialized successfully',
      documents: documents.map(doc => ({
        filename: doc.filename,
        displayName: doc.displayName,
        uploadedAt: doc.uploadedAt,
        sizeBytes: doc.sizeBytes
      }))
    })

  } catch (error) {
    console.error('Document initialization error:', error)

    return NextResponse.json(
      { error: 'Failed to initialize documents' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const documentManager = new WKRDocumentManager(process.env.GOOGLE_AI_API_KEY!)
    const status = await documentManager.validateDocumentAccess()

    if (!status) {
      return NextResponse.json(
        { error: 'Documents not accessible' },
        { status: 503 }
      )
    }

    const documents = await documentManager.getDocumentInfo()

    return NextResponse.json({
      success: true,
      status: 'available',
      documents
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Document status check failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const documentManager = new WKRDocumentManager(process.env.GOOGLE_AI_API_KEY!)
    await documentManager.refreshDocuments()

    return NextResponse.json({
      success: true,
      message: 'Documents refreshed successfully'
    })

  } catch (error) {
    console.error('Document refresh error:', error)

    return NextResponse.json(
      { error: 'Failed to refresh documents' },
      { status: 500 }
    )
  }
}
```

### Enhanced Analysis Endpoint
```typescript
// src/app/api/analyze/with-documents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { DocumentEnhancedAnalysis } from '@/lib/analysis/document-enhanced-analysis'

export async function POST(request: NextRequest) {
  try {
    const { transactions, analysisType = 'standard' } = await request.json()

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Invalid transactions data' },
        { status: 400 }
      )
    }

    // Initialize document-enhanced analysis
    const analysis = new DocumentEnhancedAnalysis(process.env.GOOGLE_AI_API_KEY!)
    await analysis.initialize()

    // Perform analysis with document context
    const result = await analysis.performAnalysisWithDocuments(
      transactions,
      analysisType
    )

    // Get document status for metadata
    const documentStatus = await analysis.getDocumentStatus()

    return NextResponse.json({
      success: true,
      analysis: result,
      metadata: {
        analysisType,
        processedTransactions: transactions.length,
        documentsUsed: documentStatus.documentsAvailable,
        documentLastUpdate: documentStatus.lastUpdate,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Document-enhanced analysis error:', error)

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

### Unit Tests
```typescript
// src/lib/documents/__tests__/file-manager.test.ts
import { WKRDocumentManager } from '../file-manager'
import { GoogleAIFileManager } from '@google/generative-ai/server'

// Mock the Google AI File Manager
jest.mock('@google/generative-ai/server')

describe('WKRDocumentManager', () => {
  let documentManager: WKRDocumentManager
  let mockFileManager: jest.Mocked<GoogleAIFileManager>

  beforeEach(() => {
    mockFileManager = {
      uploadFile: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn()
    } as any

    ;(GoogleAIFileManager as jest.Mock).mockImplementation(() => mockFileManager)

    documentManager = new WKRDocumentManager('test-api-key')
  })

  test('should upload documents successfully', async () => {
    // Mock successful file upload
    mockFileManager.uploadFile.mockResolvedValue({
      file: {
        uri: 'files/test123',
        name: 'wkr1.pdf'
      }
    })

    // Mock file system
    const mockStats = { size: 1024000, mtime: new Date() }
    jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined)
    jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue(mockStats)

    const documents = await documentManager.initializeDocuments()

    expect(documents).toHaveLength(2)
    expect(documents[0].fileUri).toBe('files/test123')
    expect(mockFileManager.uploadFile).toHaveBeenCalledTimes(2)
  })

  test('should use cached documents when available', async () => {
    // Mock cache file
    const cachedData = {
      documents: [{
        filename: 'wkr1.pdf',
        fileUri: 'files/cached123',
        uploadedAt: new Date(),
        displayName: 'Cached WKR Doc',
        mimeType: 'application/pdf',
        sizeBytes: 1024
      }],
      lastUpdated: new Date(),
      version: '1.0.0'
    }

    jest.spyOn(require('fs/promises'), 'readFile')
      .mockResolvedValue(JSON.stringify(cachedData))

    const documents = await documentManager.initializeDocuments()

    expect(documents).toHaveLength(1)
    expect(documents[0].fileUri).toBe('files/cached123')
    expect(mockFileManager.uploadFile).not.toHaveBeenCalled()
  })

  test('should handle upload failures gracefully', async () => {
    mockFileManager.uploadFile.mockRejectedValue(new Error('Upload failed'))

    jest.spyOn(require('fs/promises'), 'access').mockResolvedValue(undefined)
    jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 })

    await expect(documentManager.initializeDocuments())
      .rejects
      .toThrow('Document initialization failed')
  })

  test('should validate document access', async () => {
    // Mock successful validation
    mockFileManager.getFile.mockResolvedValue({ name: 'wkr1.pdf' })

    // Mock cached documents
    jest.spyOn(documentManager as any, 'loadCache').mockResolvedValue({
      documents: [{
        fileUri: 'files/test123',
        filename: 'wkr1.pdf'
      }]
    })

    const isValid = await documentManager.validateDocumentAccess()
    expect(isValid).toBe(true)
  })
})
```

### Integration Tests
```typescript
// src/lib/documents/__tests__/document-enhanced-analysis.test.ts
import { DocumentEnhancedAnalysis } from '../document-enhanced-analysis'

describe('DocumentEnhancedAnalysis', () => {
  let analysis: DocumentEnhancedAnalysis

  beforeEach(() => {
    analysis = new DocumentEnhancedAnalysis('test-api-key')
  })

  test('should perform analysis with document context', async () => {
    const mockTransactions = [
      {
        grootboek: '440000 Huur',
        boeking: '108308 Kantoorhuur',
        bedrag: 2000,
        datum: '2023-01-01',
        accountId: '440000',
        transactionId: '108308'
      }
    ]

    // Mock the document-enhanced analysis
    jest.spyOn(analysis as any, 'geminiWithDocs').mockImplementation({
      initialize: jest.fn(),
      generateAnalysisWithDocuments: jest.fn().mockResolvedValue('Mock analysis result')
    })

    await analysis.initialize()
    const result = await analysis.performAnalysisWithDocuments(mockTransactions)

    expect(result).toBe('Mock analysis result')
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.15.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0"
  }
}
```

## Definition of Done
- [ ] Google AI File Manager integratie werkend
- [ ] Eenmalige document upload met caching
- [ ] File ID hergebruik in alle requests
- [ ] Document-enhanced analysis pipeline
- [ ] Error handling voor file operations
- [ ] API endpoints voor document management
- [ ] Unit tests coverage >90%
- [ ] Integration tests met mock File API

## Performance Targets
- Document upload: Eenmalig, <30 seconden voor beide PDFs
- Cache validation: <1 seconde
- Document-enhanced analysis: <10 seconden extra vs normale analyse
- File API calls: <500ms per request
- Cache hit ratio: >95% na initiële upload