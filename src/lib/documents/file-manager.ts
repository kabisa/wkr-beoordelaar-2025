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
        console.log('📋 Using cached document references')
        return cached.documents
      }

      // Upload documents if not cached or cache is invalid
      console.log('🔄 Uploading WKR reference documents...')
      const documents = await this.uploadWKRDocuments()

      // Save to cache
      await this.saveCache({
        documents,
        lastUpdated: new Date(),
        version: '1.0.0'
      })

      return documents

    } catch (error) {
      console.error('❌ Failed to initialize documents:', error)
      throw new DocumentManagerError('Document initialization failed', error)
    }
  }

  private async uploadWKRDocuments(): Promise<UploadedDocument[]> {
    const documentFiles = [
      { filename: 'wkr1.pdf', displayName: 'WKR Regelgeving Deel 1 - Algemene Bepalingen' },
      { filename: 'wkr2.pdf', displayName: 'WKR Regelgeving Deel 2 - Vrijstellingen en Berekeningen' }
    ]

    const uploadedDocs: UploadedDocument[] = []

    for (const doc of documentFiles) {
      const filePath = path.join(this.documentsPath, doc.filename)

      try {
        // Verify file exists
        await fs.access(filePath)
        const stats = await fs.stat(filePath)

        console.log(`📤 Uploading ${doc.filename}... (${Math.round(stats.size / 1024)}KB)`)

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
        console.error(`❌ Failed to upload ${doc.filename}:`, error)
        throw new DocumentManagerError(`Upload failed for ${doc.filename}`, error, doc.filename)
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
    console.log('🔄 Refreshing document cache...')

    // Delete old files from Gemini
    const cached = await this.loadCache()
    if (cached) {
      for (const doc of cached.documents) {
        try {
          const fileId = this.extractFileId(doc.fileUri)
          await this.fileManager.deleteFile(fileId)
          console.log(`🗑️ Deleted old file: ${doc.filename}`)
        } catch (error) {
          console.warn(`⚠️ Failed to delete ${doc.filename}:`, error)
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
      const cache = JSON.parse(cacheData)

      // Convert date strings back to Date objects
      cache.lastUpdated = new Date(cache.lastUpdated)
      cache.documents.forEach((doc: any) => {
        doc.uploadedAt = new Date(doc.uploadedAt)
      })

      return cache
    } catch {
      return null
    }
  }

  private async saveCache(cache: DocumentCache): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cacheFile), { recursive: true })
      await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2))
      console.log(`💾 Document cache saved`)
    } catch (error) {
      console.warn('⚠️ Failed to save document cache:', error)
    }
  }

  private async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFile)
      console.log(`🗑️ Document cache cleared`)
    } catch {
      // Cache file doesn't exist, that's fine
    }
  }

  private isCacheValid(cache: DocumentCache): boolean {
    // Cache is valid for 24 hours
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    const age = Date.now() - new Date(cache.lastUpdated).getTime()

    const isValid = age < maxAge && cache.documents.length > 0

    if (!isValid) {
      console.log(`📋 Cache expired (age: ${Math.round(age / (60 * 60 * 1000))}h)`)
    }

    return isValid
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

      console.log(`✅ All ${documents.length} documents accessible`)
      return true
    } catch (error) {
      console.error('❌ Document access validation failed:', error)
      return false
    }
  }

  async getDocumentInfo(): Promise<Array<{
    filename: string
    displayName: string
    sizeBytes: number
    uploadedAt: Date
    fileUri: string
  }>> {
    const documents = await this.initializeDocuments()
    return documents.map(doc => ({
      filename: doc.filename,
      displayName: doc.displayName,
      sizeBytes: doc.sizeBytes,
      uploadedAt: doc.uploadedAt,
      fileUri: doc.fileUri
    }))
  }

  async listRemoteFiles(): Promise<Array<{ name: string; uri: string; state: string }>> {
    try {
      const files = await this.fileManager.listFiles()
      return files.files.map(file => ({
        name: file.displayName || 'Unknown',
        uri: file.uri,
        state: file.state
      }))
    } catch (error) {
      console.error('❌ Failed to list remote files:', error)
      return []
    }
  }

  async cleanupRemoteFiles(): Promise<number> {
    let deletedCount = 0

    try {
      const remoteFiles = await this.listRemoteFiles()

      for (const file of remoteFiles) {
        if (file.name.includes('WKR') || file.name.includes('wkr')) {
          try {
            const fileId = this.extractFileId(file.uri)
            await this.fileManager.deleteFile(fileId)
            console.log(`🗑️ Deleted remote file: ${file.name}`)
            deletedCount++
          } catch (error) {
            console.warn(`⚠️ Failed to delete ${file.name}:`, error)
          }
        }
      }

      if (deletedCount > 0) {
        await this.clearCache()
      }

    } catch (error) {
      console.error('❌ Failed to cleanup remote files:', error)
    }

    return deletedCount
  }
}