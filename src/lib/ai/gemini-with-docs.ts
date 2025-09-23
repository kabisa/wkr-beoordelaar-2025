import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'
import { WKRDocumentManager } from '@/lib/documents/file-manager'
import { GeminiError } from './gemini-errors'

export interface DocumentStatus {
  isInitialized: boolean
  documentsAvailable: number
  lastUpdate: Date | null
  documentInfo: Array<{
    filename: string
    displayName: string
    sizeBytes: number
  }>
}

export interface DocumentEnhancedResult {
  content: string
  metadata: {
    tokensUsed?: number
    responseTime: number
    model: string
    timestamp: Date
    documentsUsed: number
    documentRefs: string[]
  }
}

export class GeminiWithDocuments {
  private genAI: GoogleGenerativeAI
  private documentManager: WKRDocumentManager
  private model: GenerativeModel
  private modelName: string
  private isInitialized = false

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.documentManager = new WKRDocumentManager(apiKey)
  }

  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Gemini with WKR documents...')

      // Initialize documents first
      await this.documentManager.initializeDocuments()

      // Create model with enhanced system instruction
      this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
      console.log(`🤖 Using Gemini model: ${this.modelName}`)

      this.model = this.genAI.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.1'),
          topP: 0.8,
          topK: 40,
          maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '8192')
        },
        systemInstruction: `
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je hebt toegang tot de officiële WKR documentatie die als referentie is geüpload.

BELANGRIJKE INSTRUCTIES:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen uit de geüploade documenten waar mogelijk
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte documenten en transacties

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering met verwijzing naar documenten**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. **Samenvatting** - Overzicht van de analyse
2. **Belangrijkste bevindingen** - Per boeking met WKR status
3. **Vrijstellingen overzicht** - Toepasselijke vrijstellingen
4. **Berekeningen vrije ruimte** - Loonsom en verbruik
5. **Aanbevelingen** - Concrete actiepunten
6. **Documentverwijzingen** - Welke delen van de WKR documenten zijn gebruikt
        `
      })

      this.isInitialized = true
      console.log('✅ Gemini with documents initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize Gemini with documents:', error)
      throw new GeminiError('Failed to initialize document-enhanced Gemini', 'INIT_ERROR', error)
    }
  }

  async generateAnalysisWithDocuments(
    prompt: string,
    transactionData: string
  ): Promise<DocumentEnhancedResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const startTime = performance.now()

    try {
      // Get document references
      const documentRefs = await this.documentManager.getDocumentReferences()
      console.log(`📋 Using ${documentRefs.length} WKR reference documents`)

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
TRANSACTIEGEGEVENS VOOR WKR ANALYSE:
${transactionData}

ANALYSE OPDRACHT:
${prompt}

Analyseer de bovenstaande transacties volgens de Nederlandse werkkostenregeling,
gebaseerd op de geüploade WKR documentatie. Verwijs naar specifieke secties
uit de documenten waar relevant.
          `
        }
      ]

      // Log de volledige prompt naar console
      console.log('🔍 VOLLEDIGE GEMINI PROMPT:')
      console.log('=====================================')
      console.log('SYSTEM INSTRUCTION:')
      console.log(`
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je hebt toegang tot de officiële WKR documentatie die als referentie is geüpload.

BELANGRIJKE INSTRUCTIES:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen uit de geüploade documenten waar mogelijk
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte documenten en transacties

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering met verwijzing naar documenten**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. **Samenvatting** - Overzicht van de analyse
2. **Belangrijkste bevindingen** - Per boeking met WKR status
3. **Vrijstellingen overzicht** - Toepasselijke vrijstellingen
4. **Berekeningen vrije ruimte** - Loonsom en verbruik
5. **Aanbevelingen** - Concrete actiepunten
6. **Documentverwijzingen** - Welke delen van de WKR documenten zijn gebruikt
      `)
      console.log('-------------------------------------')
      content.forEach((item, index) => {
        if (item.fileData) {
          console.log(`Content ${index}: [DOCUMENT] ${item.fileData.fileUri} (${item.fileData.mimeType})`)
        } else if (item.text) {
          console.log(`Content ${index}: [TEXT]`)
          console.log(item.text)
        }
        console.log('-------------------------------------')
      })
      console.log('=====================================')

      const result = await this.model.generateContent(content)
      const response = await result.response
      const responseText = response.text()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      return {
        content: responseText,
        metadata: {
          responseTime,
          model: this.modelName,
          timestamp: new Date(),
          tokensUsed: this.estimateTokens(prompt + transactionData + responseText),
          documentsUsed: documentRefs.length,
          documentRefs: documentRefs.map(doc => doc.fileUri)
        }
      }

    } catch (error) {
      console.error('❌ Document-enhanced analysis failed:', error)
      throw new GeminiError(
        `Analysis with documents failed: ${error.message}`,
        'ANALYSIS_ERROR',
        error
      )
    }
  }

  async generateStreamingAnalysisWithDocuments(
    prompt: string,
    transactionData: string
  ): Promise<AsyncIterable<string>> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      const documentRefs = await this.documentManager.getDocumentReferences()
      console.log(`📋 Streaming analysis with ${documentRefs.length} WKR documents`)

      const content = [
        ...documentRefs.map(doc => ({
          fileData: {
            fileUri: doc.fileUri,
            mimeType: doc.mimeType
          }
        })),
        {
          text: `
TRANSACTIEGEGEVENS VOOR WKR ANALYSE:
${transactionData}

ANALYSE OPDRACHT:
${prompt}

Analyseer de bovenstaande transacties volgens de Nederlandse werkkostenregeling,
gebaseerd op de geüploade WKR documentatie. Verwijs naar specifieke secties
uit de documenten waar relevant.
          `
        }
      ]

      // Log de volledige prompt naar console voor streaming
      console.log('🔍 VOLLEDIGE GEMINI STREAMING PROMPT:')
      console.log('=====================================')
      console.log('SYSTEM INSTRUCTION:')
      console.log(`
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je hebt toegang tot de officiële WKR documentatie die als referentie is geüpload.

BELANGRIJKE INSTRUCTIES:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen uit de geüploade documenten waar mogelijk
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte documenten en transacties

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering met verwijzing naar documenten**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. **Samenvatting** - Overzicht van de analyse
2. **Belangrijkste bevindingen** - Per boeking met WKR status
3. **Vrijstellingen overzicht** - Toepasselijke vrijstellingen
4. **Berekeningen vrije ruimte** - Loonsom en verbruik
5. **Aanbevelingen** - Concrete actiepunten
6. **Documentverwijzingen** - Welke delen van de WKR documenten zijn gebruikt
      `)
      console.log('-------------------------------------')
      content.forEach((item, index) => {
        if (item.fileData) {
          console.log(`Content ${index}: [DOCUMENT] ${item.fileData.fileUri} (${item.fileData.mimeType})`)
        } else if (item.text) {
          console.log(`Content ${index}: [TEXT]`)
          console.log(item.text)
        }
        console.log('-------------------------------------')
      })
      console.log('=====================================')

      const result = await this.model.generateContentStream(content)

      return {
        async *[Symbol.asyncIterator]() {
          try {
            for await (const chunk of result.stream) {
              const chunkText = chunk.text()
              if (chunkText) {
                yield chunkText
              }
            }
          } catch (error) {
            console.error('❌ Streaming error:', error)
            throw new GeminiError(
              `Streaming analysis failed: ${error.message}`,
              'STREAMING_ERROR',
              error
            )
          }
        }
      }

    } catch (error) {
      console.error('❌ Streaming analysis with documents failed:', error)
      throw new GeminiError(
        `Streaming analysis failed: ${error.message}`,
        'STREAMING_ERROR',
        error
      )
    }
  }

  async getDocumentStatus(): Promise<DocumentStatus> {
    try {
      const documentInfo = await this.documentManager.getDocumentInfo()

      return {
        isInitialized: this.isInitialized && documentInfo.length > 0,
        documentsAvailable: documentInfo.length,
        lastUpdate: documentInfo.length > 0 ? documentInfo[0].uploadedAt : null,
        documentInfo: documentInfo.map(doc => ({
          filename: doc.filename,
          displayName: doc.displayName,
          sizeBytes: doc.sizeBytes
        }))
      }
    } catch (error) {
      console.error('❌ Failed to get document status:', error)
      return {
        isInitialized: false,
        documentsAvailable: 0,
        lastUpdate: null,
        documentInfo: []
      }
    }
  }

  async refreshDocuments(): Promise<void> {
    console.log('🔄 Refreshing WKR documents...')

    try {
      await this.documentManager.refreshDocuments()
      console.log('✅ Documents refreshed successfully')
    } catch (error) {
      console.error('❌ Failed to refresh documents:', error)
      throw new GeminiError(
        'Failed to refresh documents',
        'REFRESH_ERROR',
        error
      )
    }
  }

  async validateDocuments(): Promise<boolean> {
    try {
      return await this.documentManager.validateDocumentAccess()
    } catch (error) {
      console.error('❌ Document validation failed:', error)
      return false
    }
  }

  async listRemoteDocuments(): Promise<Array<{ name: string; uri: string; state: string }>> {
    try {
      return await this.documentManager.listRemoteFiles()
    } catch (error) {
      console.error('❌ Failed to list remote documents:', error)
      return []
    }
  }

  async cleanupDocuments(): Promise<number> {
    try {
      const deletedCount = await this.documentManager.cleanupRemoteFiles()
      console.log(`🗑️ Cleaned up ${deletedCount} remote files`)

      if (deletedCount > 0) {
        this.isInitialized = false // Force re-initialization
      }

      return deletedCount
    } catch (error) {
      console.error('❌ Failed to cleanup documents:', error)
      return 0
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for most languages
    return Math.ceil(text.length / 4)
  }

  getModel(): GenerativeModel {
    if (!this.isInitialized) {
      throw new GeminiError('Model not initialized', 'NOT_INITIALIZED')
    }
    return this.model
  }

  isReady(): boolean {
    return this.isInitialized
  }
}