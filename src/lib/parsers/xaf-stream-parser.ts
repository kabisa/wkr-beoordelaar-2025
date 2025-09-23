import { Transform } from 'stream'
import { XAFParser } from './xaf-parser'
import { ParsedXAF, XAFParseError } from '@/types/xaf'

export interface StreamParsingOptions {
  chunkSize?: number
  maxMemoryUsage?: number // in bytes
  progressCallback?: (progress: number) => void
  validateChunks?: boolean
}

export class XAFStreamParser extends Transform {
  private buffer = ''
  private isInTransaction = false
  private currentTransaction = ''
  private processedTransactions = 0
  private options: Required<StreamParsingOptions>

  constructor(options: StreamParsingOptions = {}) {
    super({ objectMode: true })
    this.options = {
      chunkSize: options.chunkSize || 1000,
      maxMemoryUsage: options.maxMemoryUsage || 512 * 1024 * 1024, // 512MB
      progressCallback: options.progressCallback || (() => {}),
      validateChunks: options.validateChunks || false
    }
  }

  _transform(chunk: any, encoding: string, callback: Function) {
    try {
      this.buffer += chunk.toString()

      // Check memory usage
      if (this.buffer.length > this.options.maxMemoryUsage) {
        callback(new XAFParseError(
          'Memory limit exceeded during streaming parse',
          'MEMORY_LIMIT_EXCEEDED'
        ))
        return
      }

      // Process complete transactions
      while (this.hasCompleteTransaction()) {
        const transaction = this.extractNextTransaction()
        if (transaction) {
          this.processedTransactions++
          this.options.progressCallback(this.processedTransactions)
          this.push(transaction)
        }
      }

      callback()
    } catch (error) {
      callback(error)
    }
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

      if (this.options.validateChunks) {
        // Basic validation of extracted transaction
        if (!transaction.includes('<nr>') || !transaction.includes('<line>')) {
          // Skip invalid transactions
          return null
        }
      }

      return transaction
    }

    return null
  }

  _flush(callback: Function) {
    // Process any remaining data in buffer
    if (this.buffer.trim()) {
      // Check if there's an incomplete transaction
      if (this.buffer.includes('<transaction>') && !this.buffer.includes('</transaction>')) {
        callback(new XAFParseError(
          'Incomplete transaction found at end of file',
          'INCOMPLETE_TRANSACTION'
        ))
        return
      }
    }

    callback()
  }
}

export class BatchXAFProcessor {
  private parser: XAFParser
  private batchSize: number
  private processedBatches = 0

  constructor(batchSize: number = 1000) {
    this.parser = new XAFParser()
    this.batchSize = batchSize
  }

  async processInBatches<T>(
    items: T[],
    processor: (batch: T[]) => Promise<any>,
    progressCallback?: (progress: number) => void
  ): Promise<any[]> {
    const results: any[] = []
    const totalBatches = Math.ceil(items.length / this.batchSize)

    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize)

      try {
        const batchResult = await processor(batch)
        results.push(...(Array.isArray(batchResult) ? batchResult : [batchResult]))

        this.processedBatches++
        if (progressCallback) {
          progressCallback((this.processedBatches / totalBatches) * 100)
        }

        // Yield control to event loop
        await new Promise(resolve => setTimeout(resolve, 0))

      } catch (error) {
        throw new XAFParseError(
          `Batch processing failed at batch ${this.processedBatches + 1}`,
          'BATCH_PROCESSING_ERROR',
          error instanceof Error ? error : undefined,
          { batchIndex: this.processedBatches, batchSize: batch.length }
        )
      }
    }

    return results
  }

  reset(): void {
    this.processedBatches = 0
  }
}

export class MemoryOptimizedXAFParser extends XAFParser {
  private memoryThreshold: number
  private batchProcessor: BatchXAFProcessor

  constructor(memoryThresholdMB: number = 256) {
    super()
    this.memoryThreshold = memoryThresholdMB * 1024 * 1024
    this.batchProcessor = new BatchXAFProcessor()
  }

  async parseXAFSafely(
    fileContent: string,
    progressCallback?: (progress: number) => void
  ): Promise<ParsedXAF> {
    // Check if we need memory-optimized parsing
    if (fileContent.length > this.memoryThreshold) {
      return this.parseWithMemoryOptimization(fileContent, progressCallback)
    }

    // Use regular parsing for smaller files
    return this.parseXAF(fileContent)
  }

  private async parseWithMemoryOptimization(
    fileContent: string,
    progressCallback?: (progress: number) => void
  ): Promise<ParsedXAF> {
    const contentSize = fileContent.length
    // Split file into logical chunks (by transactions)
    const transactionChunks = this.splitIntoTransactionChunks(fileContent)

    if (progressCallback) {
      progressCallback(10) // 10% - chunking complete
    }

    // Parse header and metadata first (smaller data)
    const headerResult = await this.parseHeaderAndMetadata(fileContent)

    if (progressCallback) {
      progressCallback(20) // 20% - header parsed
    }

    // Process transactions in batches
    const transactions = await this.batchProcessor.processInBatches(
      transactionChunks,
      async (chunk) => this.parseTransactionChunk(chunk.join('')),
      (batchProgress) => {
        // Map batch progress to overall progress (20% to 90%)
        const overallProgress = 20 + (batchProgress * 0.7)
        if (progressCallback) {
          progressCallback(overallProgress)
        }
      }
    )

    if (progressCallback) {
      progressCallback(95) // 95% - processing complete
    }

    // Combine results
    const result: ParsedXAF = {
      header: headerResult.header || {
        fiscalYear: '',
        startDate: '',
        endDate: '',
        curCode: 'EUR',
        dateCreated: '',
        softwareDesc: 'Unknown',
        softwareVersion: '1.0'
      },
      company: headerResult.company || {
        companyIdent: '',
        companyName: '',
        taxRegistrationCountry: 'NL',
        taxRegIdent: ''
      },
      accounts: headerResult.accounts || [],
      journals: headerResult.journals || [],
      transactions: transactions.flat(),
      customers: headerResult.customers,
      suppliers: headerResult.suppliers,
      metadata: {
        ...headerResult.metadata,
        numberOfTransactions: transactions.flat().length,
        fileSize: contentSize,
        numberOfAccounts: headerResult.metadata?.numberOfAccounts || 0,
        dateRange: headerResult.metadata?.dateRange || { earliest: '', latest: '' },
        parseTime: headerResult.metadata?.parseTime || 0
      }
    }

    if (progressCallback) {
      progressCallback(100) // 100% - complete
    }

    return result
  }

  private splitIntoTransactionChunks(content: string): string[] {
    const chunks: string[] = []
    const transactionRegex = /<transaction>[\s\S]*?<\/transaction>/g
    let match

    while ((match = transactionRegex.exec(content)) !== null) {
      chunks.push(match[0])
    }

    return chunks
  }

  private async parseHeaderAndMetadata(content: string): Promise<Partial<ParsedXAF>> {
    // Extract just the header and company sections
    const headerMatch = content.match(/<header>[\s\S]*?<\/header>/)
    const companyMatch = content.match(/<company>[\s\S]*?<\/company>/)
    const accountsMatch = content.match(/<generalLedgerAccounts>[\s\S]*?<\/generalLedgerAccounts>/)

    const minimalXAF = `<?xml version="1.0" encoding="UTF-8"?>
      <auditfile xmlns="http://www.auditfiles.nl/XAF/3.2">
        ${headerMatch ? headerMatch[0] : '<header></header>'}
        ${companyMatch ? companyMatch[0] : '<company></company>'}
        ${accountsMatch ? accountsMatch[0] : '<generalLedgerAccounts></generalLedgerAccounts>'}
        <transactions></transactions>
      </auditfile>`

    return this.parseXAF(minimalXAF)
  }

  private async parseTransactionChunk(chunk: string): Promise<any[]> {
    // Parse individual transaction chunk
    // This is a simplified implementation - in real use you'd need more sophisticated parsing

    // For now, return empty array - this would be implemented based on your specific needs
    return []
  }

  getMemoryUsage(): { used: number; percentage: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        percentage: (usage.heapUsed / usage.heapTotal) * 100
      }
    }

    return { used: 0, percentage: 0 }
  }
}