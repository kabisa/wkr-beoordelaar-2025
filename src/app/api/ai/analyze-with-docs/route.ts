import { NextRequest, NextResponse } from 'next/server'
import { GeminiWithDocuments } from '@/lib/ai/gemini-with-docs'
import { GlobalRateLimiter } from '@/lib/ai/rate-limiter'
import { GeminiError } from '@/lib/ai/gemini-errors'
import { GlobalPerformanceMonitor } from '@/lib/ai/performance-monitor'
import { WKRPromptBuilder } from '@/lib/prompts/wkr-prompts'

export async function POST(request: NextRequest) {
  try {
    const { transactions, analysisType, prompt } = await request.json()

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        { error: 'Geen geldige transacties data ontvangen' },
        { status: 400 }
      )
    }

    if (!analysisType) {
      return NextResponse.json(
        { error: 'Analyse type is vereist' },
        { status: 400 }
      )
    }

    // Check API key
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API configuratie ontbreekt' },
        { status: 500 }
      )
    }

    // Rate limiting
    const rateLimiter = GlobalRateLimiter.getInstance()
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    const canProceed = await rateLimiter.recordRequest(clientIP)
    if (!canProceed) {
      const limitInfo = rateLimiter.checkLimit(clientIP)
      return NextResponse.json(
        {
          error: 'Rate limit overschreden. Probeer het later opnieuw.',
          retryAfter: limitInfo.retryAfter
        },
        { status: 429 }
      )
    }

    // Start performance monitoring
    const monitor = GlobalPerformanceMonitor.getInstance()
    const requestId = monitor.startRequest(`${analysisType}-with-docs`, transactions.length)

    // Create Gemini client with documents
    const geminiWithDocs = new GeminiWithDocuments(apiKey)

    // Build analysis prompt based on type
    let analysisPrompt = ''
    let transactionData = ''

    switch (analysisType) {
      case 'wkr-compliance':
        analysisPrompt = WKRPromptBuilder.buildStandardPrompt(transactions)
        transactionData = formatTransactionsForPrompt(transactions)
        break
      case 'wkr-detailed':
        analysisPrompt = WKRPromptBuilder.buildDetailedPrompt(transactions)
        transactionData = formatTransactionsForPrompt(transactions)
        break
      case 'custom':
        if (!prompt) {
          return NextResponse.json(
            { error: 'Custom prompt is vereist voor aangepaste analyse' },
            { status: 400 }
          )
        }
        analysisPrompt = prompt
        transactionData = formatTransactionsForPrompt(transactions)
        break
      default:
        return NextResponse.json(
          { error: 'Onbekend analyse type' },
          { status: 400 }
        )
    }

    // Generate analysis with document context
    const result = await geminiWithDocs.generateAnalysisWithDocuments(
      analysisPrompt,
      transactionData
    )

    // Get document status for metadata
    const documentStatus = await geminiWithDocs.getDocumentStatus()

    // End performance monitoring
    monitor.endRequest(requestId, true, result.metadata.tokensUsed)

    return NextResponse.json({
      success: true,
      data: {
        analysis: result.content,
        metadata: {
          ...result.metadata,
          analysisType,
          transactionCount: transactions.length,
          documentEnhanced: true,
          documentsUsed: documentStatus.documentsAvailable,
          documentInfo: documentStatus.documentInfo,
          rateLimitInfo: {
            remaining: rateLimiter.getRemainingRequests(clientIP),
            resetTime: rateLimiter.getResetTime(clientIP)
          },
          performanceStats: monitor.getStats(),
          promptDetails: {
            analysisPrompt,
            transactionDataPreview: transactionData.substring(0, 500) + '...',
            fullTransactionDataLength: transactionData.length,
            systemInstruction: `Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je hebt toegang tot de officiële WKR documentatie die als referentie is geüpload.

BELANGRIJKE INSTRUCTIES:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen uit de geüploade documenten waar mogelijk
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte documenten en transacties`,
            documentsIncluded: documentStatus.documentInfo.map(doc => ({
              filename: doc.filename,
              displayName: doc.displayName,
              size: `${Math.round(doc.sizeBytes / 1024)}KB`
            }))
          }
        }
      }
    })

  } catch (error) {
    console.error('Document-enhanced AI Analysis error:', error)

    // End performance monitoring with error
    const monitor = GlobalPerformanceMonitor.getInstance()
    const errorMessage = error instanceof GeminiError ? error.message : 'Unknown error'

    // Try to find the requestId from the most recent request
    const recentMetrics = monitor.getRecentMetrics(1)
    if (recentMetrics.length > 0 && !recentMetrics[0].endTime) {
      monitor.endRequest(recentMetrics[0].requestId, false, undefined, errorMessage)
    }

    if (error instanceof GeminiError) {
      return NextResponse.json(
        {
          error: 'Document-enhanced AI analyse fout: ' + error.message,
          code: error.code,
          documentEnhanced: true
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'Interne server fout tijdens document-enhanced AI analyse',
        documentEnhanced: true
      },
      { status: 500 }
    )
  }
}

function formatTransactionsForPrompt(transactions: any[]): string {
  return transactions.map(transaction => {
    const lines = transaction.lines || []
    return lines.map((line: any) =>
      `Grootboek: ${line.accountId || 'N/A'} ${line.accountDescription || ''} | Boeking: ${transaction.nr || 'N/A'} ${transaction.desc || line.description || ''} | Bedrag: €${line.amount || '0,00'} | Datum: ${transaction.trDt || line.effectiveDate || 'N/A'}`
    ).join('\n')
  }).join('\n')
}