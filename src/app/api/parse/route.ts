import { NextRequest, NextResponse } from 'next/server'
import { XAFParser } from '@/lib/parsers/xaf-parser'
import { MemoryOptimizedXAFParser } from '@/lib/parsers/xaf-stream-parser'
import { handleParsingError, createUserFriendlyError, logParsingError, XAFProcessingStats } from '@/lib/parsers/xaf-errors'
import { XAFParseError } from '@/types/xaf'

export async function POST(request: NextRequest) {
  const stats = XAFProcessingStats.getInstance()
  let fileName: string | undefined
  let file: File | null = null

  try {
    const formData = await request.formData()
    file = formData.get('file') as File
    const useOptimizedParser = formData.get('optimized') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand ontvangen' },
        { status: 400 }
      )
    }

    fileName = file.name

    // Validate file type and size
    const allowedExtensions = ['.xaf', '.xml']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Bestandstype niet ondersteund. Alleen ${allowedExtensions.join(', ')} bestanden toegestaan.` },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()
    const fileSize = content.length

    // Choose parser based on file size and user preference
    const parser = (useOptimizedParser || fileSize > 50 * 1024 * 1024)
      ? new MemoryOptimizedXAFParser()
      : new XAFParser()

    let parsedData

    const startTime = performance.now()

    if (parser instanceof MemoryOptimizedXAFParser) {
      // Use memory-optimized parsing with progress tracking
      parsedData = await parser.parseXAFSafely(content, (progress) => {
        // In a real implementation, you might send progress via Server-Sent Events
        console.log(`Parsing progress: ${progress.toFixed(1)}%`)
      })
    } else {
      // Use regular parsing
      parsedData = await parser.parseXAF(content)
    }

    const parseTime = performance.now() - startTime

    // Record successful parsing
    stats.recordSuccess(parseTime, fileSize)

    // Prepare response data
    const responseData = {
      success: true,
      message: 'XAF bestand succesvol geparseerd',
      data: {
        header: parsedData.header,
        company: parsedData.company,
        metadata: parsedData.metadata,
        summary: {
          fileName: file.name,
          fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
          parseTime: `${parseTime.toFixed(0)}ms`,
          accounts: parsedData.accounts.length,
          transactions: parsedData.transactions.length,
          journals: parsedData.journals.length,
          dateRange: parsedData.metadata.dateRange,
          xafVersion: parsedData.metadata.xafVersion,
          parserUsed: parser instanceof MemoryOptimizedXAFParser ? 'optimized' : 'standard'
        },
        // Include sample data for preview - limit size for large datasets
        sampleAccounts: parsedData.accounts.slice(0, Math.min(10, parsedData.accounts.length)),
        sampleTransactions: parsedData.transactions.slice(0, Math.min(5, parsedData.transactions.length)).map(transaction => ({
          ...transaction,
          lines: transaction.lines.slice(0, 3) // Limit lines for response size
        })),
        // Add pagination info for large datasets
        pagination: {
          totalAccounts: parsedData.accounts.length,
          totalTransactions: parsedData.transactions.length,
          accountsShowing: Math.min(10, parsedData.accounts.length),
          transactionsShowing: Math.min(5, parsedData.transactions.length),
          hasMoreData: parsedData.accounts.length > 10 || parsedData.transactions.length > 5
        }
      },
      stats: {
        processingStats: stats.getStats(),
        successRate: stats.getSuccessRate(),
        memoryUsage: parser instanceof MemoryOptimizedXAFParser ? parser.getMemoryUsage() : undefined
      }
    }

    // Store parsed data in session or temporary storage for next steps
    // In a real application, you might use Redis or a database
    // For now, we'll include a sessionId for frontend state management
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store full data temporarily (in memory for this demo)
    // In production, this would be stored in Redis/database
    if (!(global as any).parsedDataCache) {
      (global as any).parsedDataCache = new Map()
    }

    (global as any).parsedDataCache.set(sessionId, {
      transactions: parsedData.transactions,
      accounts: parsedData.accounts,
      timestamp: Date.now()
    })

    // Type assertion for sessionId
    const responseDataWithSession = {
      ...responseData,
      data: {
        ...responseData.data,
        sessionId,
        // Include full data for smaller datasets, otherwise provide access method
        fullTransactions: parsedData.transactions.length <= 1000 ? parsedData.transactions : undefined,
        fullAccounts: parsedData.accounts.length <= 1000 ? parsedData.accounts : undefined,
        hasFullData: true,
        fullDataAvailable: parsedData.transactions.length > 1000
      }
    }

    return NextResponse.json(responseDataWithSession)

  } catch (error) {
    // Handle parsing errors
    const xafError = handleParsingError(error, { fileName, fileSize: file?.size || 0 })

    // Log error for debugging
    logParsingError(xafError, fileName)

    // Record failed parsing
    stats.recordError(xafError)

    // Return user-friendly error
    const userMessage = createUserFriendlyError(xafError)

    return NextResponse.json(
      {
        error: userMessage,
        details: {
          code: xafError.code,
          fileName: fileName || 'unknown',
          timestamp: new Date().toISOString()
        },
        stats: {
          processingStats: stats.getStats(),
          successRate: stats.getSuccessRate()
        }
      },
      { status: xafError.code === 'FILE_TOO_LARGE' ? 413 : 400 }
    )
  }
}

// GET endpoint for parsing statistics
export async function GET() {
  try {
    const stats = XAFProcessingStats.getInstance()

    return NextResponse.json({
      success: true,
      data: {
        stats: stats.getStats(),
        successRate: stats.getSuccessRate(),
        commonErrors: stats.getMostCommonErrors(),
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      }
    })

  } catch (error) {
    console.error('Error retrieving parsing stats:', error)

    return NextResponse.json(
      { error: 'Fout bij ophalen van statistieken' },
      { status: 500 }
    )
  }
}