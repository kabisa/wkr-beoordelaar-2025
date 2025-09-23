import { NextRequest, NextResponse } from 'next/server'
import { createGeminiClient } from '@/lib/ai/gemini-client'
import { GlobalRateLimiter } from '@/lib/ai/rate-limiter'
import { GeminiError } from '@/lib/ai/gemini-errors'

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
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API configuratie ontbreekt' },
        { status: 500 }
      )
    }

    // Rate limiting
    const rateLimiter = GlobalRateLimiter.getInstance()
    const clientIP = request.ip || 'unknown'

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

    // Create Gemini client
    const client = createGeminiClient(apiKey, {
      temperature: 0.1,
      maxOutputTokens: 4096
    })

    // Build prompt (reuse logic from analyze route)
    let analysisPrompt = ''

    switch (analysisType) {
      case 'wkr-compliance':
        analysisPrompt = buildWKRCompliancePrompt(transactions)
        break
      case 'risk-assessment':
        analysisPrompt = buildRiskAssessmentPrompt(transactions)
        break
      case 'pattern-analysis':
        analysisPrompt = buildPatternAnalysisPrompt(transactions)
        break
      case 'custom':
        if (!prompt) {
          return NextResponse.json(
            { error: 'Custom prompt is vereist voor aangepaste analyse' },
            { status: 400 }
          )
        }
        analysisPrompt = buildCustomPrompt(transactions, prompt)
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
          const streamingResult = await client.generateStreamingAnalysisWithRetry(analysisPrompt)

          // Send initial metadata
          const initialData = {
            type: 'metadata',
            data: {
              analysisType,
              transactionCount: transactions.length,
              timestamp: new Date().toISOString(),
              rateLimitInfo: {
                remaining: rateLimiter.getRemainingRequests(clientIP),
                resetTime: rateLimiter.getResetTime(clientIP)
              }
            }
          }

          controller.enqueue(`data: ${JSON.stringify(initialData)}\n\n`)

          // Stream analysis content
          for await (const chunk of streamingResult) {
            const streamData = {
              type: 'content',
              data: chunk
            }

            controller.enqueue(`data: ${JSON.stringify(streamData)}\n\n`)
          }

          // Send completion signal
          const completionData = {
            type: 'complete',
            data: {
              timestamp: new Date().toISOString()
            }
          }

          controller.enqueue(`data: ${JSON.stringify(completionData)}\n\n`)
          controller.close()

        } catch (error) {
          console.error('Streaming error:', error)

          const errorData = {
            type: 'error',
            data: {
              message: error instanceof GeminiError ? error.message : 'Streaming fout opgetreden',
              code: error instanceof GeminiError ? error.code : 'STREAMING_ERROR'
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
      },
    })

  } catch (error) {
    console.error('Stream setup error:', error)

    return NextResponse.json(
      { error: 'Fout bij opstarten van streaming analyse' },
      { status: 500 }
    )
  }
}

// Reuse prompt building functions from analyze route
function buildWKRCompliancePrompt(transactions: any[]): string {
  const transactionSample = transactions // Use all transactions

  // Format transactions for the prompt
  const formattedTransactions = transactionSample.map(transaction => {
    const lines = transaction.lines || []
    return lines.map((line: any) =>
      `Grootboek: ${line.accountId || 'N/A'} ${line.accountDescription || ''} | Boeking: ${transaction.nr || 'N/A'} ${transaction.desc || line.description || ''} | Bedrag: €${line.amount || '0,00'} | Datum: ${transaction.trDt || line.effectiveDate || 'N/A'}`
    ).join('\n')
  }).join('\n')

  return `Je bent een gespecialiseerde fiscalist. Je krijgt financiële boekingen als input en bepaalt:

1. **Valt de boeking onder de werkkostenregeling?**
2. **Hoe zeker ben je?** Een percentage.
3. **Is er een gerichte vrijstelling van toepassing?**

Je ontvangt de boekingen in het volgende format, per regel: Grootboek: [grootboeknummer en naam] | Boeking: [boekingnummer en omschrijving] | Bedrag: [bedrag in euros] | Datum: [datum]

Dit doe je altijd op boeking niveau en geef de specifieke boekingen terug welke onder een vrijstellingsregeling vallen of waar je over twijfelt.

Bereken de vrije ruimte basis van de loonkosten.

Als laatste geef je aan hoeveel gebruik er wordt gemaakt in de vrije ruimte met deze boekingen.

GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN

Gebruik Nederlandse boekhoudterminologie.

TRANSACTIES VOOR ANALYSE:
${formattedTransactions}

**Dataset Context:**
- Analyseer ALLE ${transactions.length} gefilterde WKR-relevante transacties
- Geef volledige analyse van complete dataset

Geef gestructureerde output met:
1. **Samenvatting**
2. **Belangrijkste bevindingen**
3. **Aandachtspunten**
4. **Aanbevelingen**

Voor elke relevante boeking, geef aan:
- WKR status (Ja/Nee + zekerheidspercentage)
- Eventuele vrijstellingen
- Risico niveau`
}

function buildRiskAssessmentPrompt(transactions: any[]): string {
  const transactionSample = transactions // Use all transactions

  return `Voer een risico-analyse uit op deze Nederlandse boekhoudtransacties.

TRANSACTIES:
${JSON.stringify(transactionSample, null, 2)}

Identificeer en analyseer:

1. **Financiële Risico's**: Ongebruikelijke bedragen, patronen, of afwijkingen
2. **Compliance Risico's**: Mogelijke overheidsregeling overtredingen
3. **Operationele Risico's**: Procesfouten of inconsistenties
4. **Prioritering**: Rangschik risico's naar impact en waarschijnlijkheid

Geef voor elk risico een risiconiveau (Hoog/Gemiddeld/Laag) en concrete mitigatie maatregelen.

Totaal aantal transacties: ${transactions.length}`
}

function buildPatternAnalysisPrompt(transactions: any[]): string {
  const transactionSample = transactions // Use all transactions

  return `Analyseer patronen in deze Nederlandse boekhoudtransacties.

TRANSACTIES:
${JSON.stringify(transactionSample, null, 2)}

Zoek naar:

1. **Frequentie Patronen**: Regelmatige of ongebruikelijke timing
2. **Bedrag Patronen**: Ronde bedragen, herhalende bedragen, afwijkingen
3. **Account Patronen**: Ongebruikelijke account combinaties
4. **Seizoens Patronen**: Tijdsgerelateerde trends
5. **Anomalieën**: Uitschieters die aandacht verdienen

Presenteer bevindingen met concrete voorbeelden en percentages waar mogelijk.

Totaal aantal transacties: ${transactions.length}`
}

function buildCustomPrompt(transactions: any[], userPrompt: string): string {
  const transactionSample = transactions // Use all transactions

  return `${userPrompt}

TRANSACTIES DATA:
${JSON.stringify(transactionSample, null, 2)}

Totaal aantal transacties: ${transactions.length}

Beantwoord de vraag gebaseerd op de Nederlandse boekhoudtransacties hierboven.`
}