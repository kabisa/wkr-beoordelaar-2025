import { NextRequest, NextResponse } from 'next/server'
import { GeminiWithDocuments } from '@/lib/ai/gemini-with-docs'
import { GlobalRateLimiter } from '@/lib/ai/rate-limiter'
import { GeminiError } from '@/lib/ai/gemini-errors'
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

    // Create Gemini client with documents
    const geminiWithDocs = new GeminiWithDocuments(apiKey)

    // Build prompt (reuse logic from analyze-with-docs route)
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

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Get document status for initial metadata
          const documentStatus = await geminiWithDocs.getDocumentStatus()

          // Send initial metadata
          const initialData = {
            type: 'metadata',
            data: {
              analysisType,
              transactionCount: transactions.length,
              timestamp: new Date().toISOString(),
              documentEnhanced: true,
              documentsUsed: documentStatus.documentsAvailable,
              documentInfo: documentStatus.documentInfo,
              rateLimitInfo: {
                remaining: rateLimiter.getRemainingRequests(clientIP),
                resetTime: rateLimiter.getResetTime(clientIP)
              }
            }
          }

          controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`)

          // Stream analysis content with document context
          const streamingResult = await geminiWithDocs.generateStreamingAnalysisWithDocuments(
            analysisPrompt,
            transactionData
          )

          for await (const chunk of streamingResult) {
            const streamData = {
              type: 'content',
              data: chunk
            }

            controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
          }

          // Use existing document status for completion metadata

          // Send completion signal with prompt details
          const completionData = {
            type: 'complete',
            data: {
              timestamp: new Date().toISOString(),
              documentEnhanced: true,
              metadata: {
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
          }

          controller.enqueue(`data: ${JSON.stringify(completionData)}\n\n`)
          controller.close()

        } catch (error) {
          console.error('Document-enhanced streaming error:', error)

          // Check if this is a document access error (403 Forbidden)
          const isDocumentAccessError = error instanceof GeminiError &&
            (error.message.includes('403') ||
             error.message.includes('Forbidden') ||
             error.message.includes('do not have permission') ||
             error.message.includes('may not exist'))

          if (isDocumentAccessError) {
            console.log('📋 Document access failed, falling back to regular streaming analysis...')

            // Fallback to regular Gemini analysis
            try {
              // Import regular Gemini client
              const { GeminiClient } = await import('@/lib/ai/gemini-client')
              const regularGemini = new GeminiClient({
                apiKey: process.env.GOOGLE_AI_API_KEY!,
                model: 'gemini-2.5-pro',
                temperature: 0.1
              })

              // Update metadata to show fallback mode
              const fallbackData = {
                type: 'metadata',
                data: {
                  analysisType,
                  transactionCount: transactions.length,
                  timestamp: new Date().toISOString(),
                  documentEnhanced: false,
                  documentsUsed: 0,
                  fallbackMode: true,
                  rateLimitInfo: {
                    remaining: rateLimiter.getRemainingRequests(clientIP),
                    resetTime: rateLimiter.getResetTime(clientIP)
                  }
                }
              }

              controller.enqueue(`data: ${JSON.stringify(fallbackData)}\n\n`)

              // Build regular prompt without document context
              const regularPrompt = buildRegularWKRPrompt(analysisPrompt, transactionData)

              // Stream regular analysis
              const regularResult = await regularGemini.generateStreamingAnalysis(regularPrompt)

              for await (const chunk of regularResult) {
                const streamData = {
                  type: 'content',
                  data: chunk
                }
                controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
              }

              // Send completion signal for fallback
              const completionData = {
                type: 'complete',
                data: {
                  timestamp: new Date().toISOString(),
                  documentEnhanced: false,
                  fallbackMode: true,
                  metadata: {
                    promptDetails: {
                      analysisPrompt: regularPrompt,
                      transactionDataPreview: transactionData.substring(0, 500) + '...',
                      fullTransactionDataLength: transactionData.length,
                      systemInstruction: 'Standard WKR analysis without document context',
                      documentsIncluded: []
                    }
                  }
                }
              }

              controller.enqueue(`data: ${JSON.stringify(completionData)}\n\n`)
              controller.close()
              return

            } catch (fallbackError) {
              console.error('Fallback analysis also failed:', fallbackError)

              const errorData = {
                type: 'error',
                data: {
                  message: 'Zowel document-enhanced als fallback analyse zijn mislukt',
                  code: 'FALLBACK_FAILED',
                  documentEnhanced: false
                }
              }

              controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
              controller.close()
              return
            }
          }

          // For other errors, send regular error response
          const errorData = {
            type: 'error',
            data: {
              message: error instanceof GeminiError ? error.message : 'Document-enhanced streaming fout opgetreden',
              code: error instanceof GeminiError ? error.code : 'STREAMING_ERROR',
              documentEnhanced: true
            }
          }

          controller.enqueue(`data: ${JSON.stringify(errorData)}\n\n`)
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Document-Enhanced': 'true', // Indicate this is document-enhanced
      },
    })

  } catch (error) {
    console.error('Document-enhanced stream setup error:', error)

    return NextResponse.json(
      {
        error: 'Fout bij opstarten van document-enhanced streaming analyse',
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

function buildRegularWKRPrompt(analysisPrompt: string, transactionData: string): string {
  return `Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je analyseert boekhoudkundige transacties om te bepalen welke kosten onder de WKR vallen.

BELANGRIJK:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen waar relevant
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte context en je kennis

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering voor je beslissing**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. Samenvatting
2. Belangrijkste bevindingen per boeking
3. Vrijstellingen overzicht
4. Berekeningen vrije ruimte
5. Aanbevelingen

${analysisPrompt}

TRANSACTIEGEGEVENS:
${transactionData}`
}