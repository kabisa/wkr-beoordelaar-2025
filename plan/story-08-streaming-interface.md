# Story 8: Streaming Interface

**Sprint:** 3
**Estimate:** 2 dagen
**Priority:** Critical

## User Story
Als gebruiker wil ik de AI analyse real-time zien verschijnen zodat ik niet hoef te wachten op de complete analyse en de voortgang kan volgen.

## Acceptatiecriteria
- [x] Server-Sent Events implementatie
- [x] Real-time markdown streaming
- [x] Client-side stream handler
- [x] Progress indicators
- [x] Error recovery tijdens streaming
- [x] Graceful fallback naar non-streaming
- [x] Streaming performance optimalisatie

## Technical Architecture

### Server-Side Streaming Implementation
```typescript
// src/lib/streaming/gemini-stream.ts
import { ReadableStream } from 'stream/web'
import { GeminiClient } from '@/lib/ai/gemini-client'

export interface StreamChunk {
  type: 'content' | 'progress' | 'metadata' | 'error' | 'complete'
  data: any
  timestamp: number
}

export class GeminiStreamProcessor {
  private client: GeminiClient

  constructor(client: GeminiClient) {
    this.client = client
  }

  async createAnalysisStream(prompt: string): Promise<ReadableStream> {
    return new ReadableStream({
      async start(controller) {
        try {
          // Send initial progress
          controller.enqueue(this.createChunk('progress', {
            stage: 'initializing',
            message: 'Starting AI analysis...'
          }))

          // Get streaming response from Gemini
          const geminiStream = await this.client.generateStreamingAnalysis(prompt)

          let accumulatedContent = ''
          let chunkCount = 0

          controller.enqueue(this.createChunk('progress', {
            stage: 'streaming',
            message: 'Receiving analysis...'
          }))

          for await (const chunk of geminiStream) {
            chunkCount++
            accumulatedContent += chunk

            // Send content chunk
            controller.enqueue(this.createChunk('content', {
              chunk,
              accumulated: accumulatedContent,
              chunkNumber: chunkCount
            }))

            // Send progress updates periodically
            if (chunkCount % 5 === 0) {
              controller.enqueue(this.createChunk('progress', {
                stage: 'streaming',
                chunksReceived: chunkCount,
                contentLength: accumulatedContent.length
              }))
            }

            // Allow other tasks to run
            await new Promise(resolve => setTimeout(resolve, 0))
          }

          // Send completion signal
          controller.enqueue(this.createChunk('complete', {
            totalChunks: chunkCount,
            totalLength: accumulatedContent.length,
            content: accumulatedContent
          }))

          controller.close()

        } catch (error) {
          controller.enqueue(this.createChunk('error', {
            error: error.message,
            code: error.code || 'STREAMING_ERROR'
          }))
          controller.close()
        }
      }
    })
  }

  private createChunk(type: StreamChunk['type'], data: any): Uint8Array {
    const chunk: StreamChunk = {
      type,
      data,
      timestamp: Date.now()
    }

    const serialized = JSON.stringify(chunk)
    return new TextEncoder().encode(`data: ${serialized}\n\n`)
  }
}
```

### Enhanced Streaming Route
```typescript
// src/app/api/analyze/stream/route.ts
import { NextRequest } from 'next/server'
import { RetryableGeminiClient } from '@/lib/ai/gemini-client'
import { GeminiStreamProcessor } from '@/lib/streaming/gemini-stream'
import { WKRPromptBuilder } from '@/lib/prompts/wkr-prompts'
import { WKRKnowledgeBase } from '@/lib/documents/knowledge-base'
import { globalRateLimiter } from '@/lib/ai/rate-limiter'

export async function POST(request: NextRequest) {
  // Set headers for SSE
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  try {
    const { transactions, analysisType = 'standard', companyInfo } = await request.json()

    // Rate limiting
    const canProceed = await globalRateLimiter.checkLimit()
    if (!canProceed) {
      return new Response(
        `data: ${JSON.stringify({
          type: 'error',
          data: { error: 'Rate limit exceeded', resetTime: globalRateLimiter.getTimeUntilReset() }
        })}\n\n`,
        { status: 429, headers }
      )
    }

    // Validate input
    if (!transactions || !Array.isArray(transactions)) {
      return new Response(
        `data: ${JSON.stringify({
          type: 'error',
          data: { error: 'Invalid transactions data' }
        })}\n\n`,
        { status: 400, headers }
      )
    }

    // Initialize components
    const geminiClient = new RetryableGeminiClient()
    const streamProcessor = new GeminiStreamProcessor(geminiClient)
    const knowledgeBase = new WKRKnowledgeBase()

    // Create enhanced stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Initialize knowledge base
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'progress',
              data: { stage: 'loading_context', message: 'Loading WKR knowledge base...' }
            })}\n\n`
          ))

          await knowledgeBase.initialize()

          // Build enhanced prompt
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'progress',
              data: { stage: 'building_prompt', message: 'Preparing analysis prompt...' }
            })}\n\n`
          ))

          let prompt: string
          switch (analysisType) {
            case 'compliance':
              prompt = WKRPromptBuilder.buildCompliancePrompt(transactions, companyInfo)
              break
            case 'detailed':
              prompt = WKRPromptBuilder.buildDetailedPrompt(transactions, companyInfo?.wageSum)
              break
            default:
              prompt = WKRPromptBuilder.buildStandardPrompt(transactions)
          }

          // Enhance with context
          const context = knowledgeBase.getRelevantContext(
            transactions.map(t => t.boeking).join(' ')
          )
          prompt += `\n\nCONTEXT:\n${context}`

          // Start streaming analysis
          const analysisStream = await streamProcessor.createAnalysisStream(prompt)
          const reader = analysisStream.getReader()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            controller.enqueue(value)
          }

        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify({
              type: 'error',
              data: { error: error.message || 'Streaming failed' }
            })}\n\n`
          ))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, { headers })

  } catch (error) {
    console.error('Stream setup error:', error)
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        data: { error: 'Failed to initialize stream' }
      })}\n\n`,
      { status: 500, headers }
    )
  }
}
```

### Client-Side Stream Handler
```typescript
// src/lib/streaming/stream-client.ts
export interface StreamState {
  status: 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  content: string
  progress: ProgressState
  error?: string
  metadata?: any
}

export interface ProgressState {
  stage: string
  message: string
  chunksReceived?: number
  contentLength?: number
  percentage?: number
}

export class AnalysisStreamClient {
  private eventSource: EventSource | null = null
  private callbacks: StreamCallbacks = {}

  constructor(callbacks: StreamCallbacks) {
    this.callbacks = callbacks
  }

  async startStream(payload: {
    transactions: any[]
    analysisType?: string
    companyInfo?: any
  }): Promise<void> {
    try {
      // Close existing stream
      this.stopStream()

      // Send POST request to start stream
      const response = await fetch('/api/analyze/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Create EventSource-like reader
      this.readStream(response)

    } catch (error) {
      this.callbacks.onError?.(error.message)
    }
  }

  private async readStream(response: Response): Promise<void> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    this.callbacks.onStatusChange?.('connecting')

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete messages
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              await this.handleStreamMessage(data)
            } catch (error) {
              console.warn('Failed to parse stream message:', line)
            }
          }
        }
      }

    } catch (error) {
      this.callbacks.onError?.(error.message)
    } finally {
      reader.releaseLock()
    }
  }

  private async handleStreamMessage(message: StreamChunk): Promise<void> {
    switch (message.type) {
      case 'progress':
        this.callbacks.onProgress?.(message.data)
        if (message.data.stage === 'streaming') {
          this.callbacks.onStatusChange?.('streaming')
        }
        break

      case 'content':
        this.callbacks.onContent?.(message.data.chunk, message.data.accumulated)
        break

      case 'complete':
        this.callbacks.onComplete?.(message.data.content)
        this.callbacks.onStatusChange?.('complete')
        break

      case 'error':
        this.callbacks.onError?.(message.data.error)
        this.callbacks.onStatusChange?.(error')
        break

      case 'metadata':
        this.callbacks.onMetadata?.(message.data)
        break
    }
  }

  stopStream(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}

export interface StreamCallbacks {
  onStatusChange?: (status: StreamState['status']) => void
  onProgress?: (progress: ProgressState) => void
  onContent?: (chunk: string, accumulated: string) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: string) => void
  onMetadata?: (metadata: any) => void
}
```

### React Hook for Streaming
```tsx
// src/hooks/useAnalysisStream.ts
import { useState, useCallback, useRef } from 'react'
import { AnalysisStreamClient, StreamState } from '@/lib/streaming/stream-client'

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    content: '',
    progress: { stage: '', message: '' }
  })

  const clientRef = useRef<AnalysisStreamClient | null>(null)

  const startAnalysis = useCallback(async (payload: {
    transactions: any[]
    analysisType?: string
    companyInfo?: any
  }) => {
    // Initialize client if needed
    if (!clientRef.current) {
      clientRef.current = new AnalysisStreamClient({
        onStatusChange: (status) => {
          setState(prev => ({ ...prev, status }))
        },

        onProgress: (progress) => {
          setState(prev => ({ ...prev, progress }))
        },

        onContent: (chunk, accumulated) => {
          setState(prev => ({
            ...prev,
            content: accumulated
          }))
        },

        onComplete: (fullContent) => {
          setState(prev => ({
            ...prev,
            content: fullContent,
            status: 'complete'
          }))
        },

        onError: (error) => {
          setState(prev => ({
            ...prev,
            error,
            status: 'error'
          }))
        },

        onMetadata: (metadata) => {
          setState(prev => ({ ...prev, metadata }))
        }
      })
    }

    // Reset state
    setState({
      status: 'idle',
      content: '',
      progress: { stage: '', message: '' },
      error: undefined
    })

    // Start streaming
    await clientRef.current.startStream(payload)
  }, [])

  const stopAnalysis = useCallback(() => {
    clientRef.current?.stopStream()
    setState(prev => ({ ...prev, status: 'idle' }))
  }, [])

  const resetAnalysis = useCallback(() => {
    clientRef.current?.stopStream()
    setState({
      status: 'idle',
      content: '',
      progress: { stage: '', message: '' },
      error: undefined
    })
  }, [])

  return {
    state,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    isStreaming: state.status === 'streaming' || state.status === 'connecting'
  }
}
```

### Streaming UI Components
```tsx
// src/components/StreamingOutput.tsx
import { useState, useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Square, RotateCcw } from 'lucide-react'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import ReactMarkdown from 'react-markdown'

interface StreamingOutputProps {
  transactions: any[]
  analysisType?: string
  companyInfo?: any
  onComplete?: (analysis: string) => void
}

export function StreamingOutput({
  transactions,
  analysisType = 'standard',
  companyInfo,
  onComplete
}: StreamingOutputProps) {
  const { state, startAnalysis, stopAnalysis, resetAnalysis, isStreaming } = useAnalysisStream()

  const handleStart = async () => {
    await startAnalysis({
      transactions,
      analysisType,
      companyInfo
    })
  }

  useEffect(() => {
    if (state.status === 'complete' && onComplete) {
      onComplete(state.content)
    }
  }, [state.status, state.content, onComplete])

  const getProgressPercentage = (): number => {
    switch (state.progress.stage) {
      case 'loading_context': return 10
      case 'building_prompt': return 20
      case 'initializing': return 30
      case 'streaming': return 50 + Math.min(40, (state.progress.chunksReceived || 0) * 2)
      default: return state.status === 'complete' ? 100 : 0
    }
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {!isStreaming && state.status !== 'complete' && (
              <Button onClick={handleStart} disabled={!transactions.length}>
                <Loader2 className="h-4 w-4 mr-2" />
                Start WKR Analysis
              </Button>
            )}

            {isStreaming && (
              <Button onClick={stopAnalysis} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop Analysis
              </Button>
            )}

            {(state.status === 'complete' || state.status === 'error') && (
              <Button onClick={resetAnalysis} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}

            <div className="flex-1">
              <div className="text-sm text-gray-600 mb-1">
                {state.progress.message || 'Ready to analyze'}
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Details */}
      {isStreaming && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{state.progress.stage}: {state.progress.message}</span>
              {state.progress.chunksReceived && (
                <span className="ml-auto">
                  {state.progress.chunksReceived} chunks received
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {state.status === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-700">
              <h3 className="font-medium mb-2">Analysis Error</h3>
              <p className="text-sm">{state.error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaming Content */}
      {state.content && (
        <Card>
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {children}
                    </td>
                  )
                }}
              >
                {state.content}
              </ReactMarkdown>

              {/* Typing indicator */}
              {isStreaming && (
                <div className="flex items-center gap-2 mt-4 text-gray-500">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm">AI is analyzing...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### Error Recovery & Fallback
```typescript
// src/lib/streaming/fallback-handler.ts
export class StreamFallbackHandler {
  private maxRetries = 3
  private retryDelay = 1000

  async handleStreamWithFallback(
    streamFn: () => Promise<void>,
    fallbackFn: () => Promise<string>
  ): Promise<string> {
    let lastError: Error

    // Try streaming first
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await streamFn()
        return '' // Streaming successful
      } catch (error) {
        lastError = error as Error

        if (this.isRetryableError(error)) {
          await this.delay(this.retryDelay * Math.pow(2, attempt))
          continue
        } else {
          break // Non-retryable error, go to fallback
        }
      }
    }

    console.warn('Streaming failed, falling back to non-streaming:', lastError)

    // Fallback to non-streaming
    try {
      return await fallbackFn()
    } catch (fallbackError) {
      throw new Error(`Both streaming and fallback failed: ${fallbackError.message}`)
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableMessages = [
      'network',
      'timeout',
      'connection',
      'stream',
      'abort'
    ]

    const errorMessage = error?.message?.toLowerCase() || ''
    return retryableMessages.some(msg => errorMessage.includes(msg))
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

## Testing

### Integration Tests
```typescript
// src/lib/streaming/__tests__/stream-integration.test.ts
import { GeminiStreamProcessor } from '../gemini-stream'
import { GeminiClient } from '@/lib/ai/gemini-client'

describe('Streaming Integration', () => {
  test('should stream analysis content', async () => {
    const mockClient = {
      generateStreamingAnalysis: jest.fn().mockImplementation(async function* () {
        yield 'Chunk 1: '
        yield 'Analysis '
        yield 'content '
        yield 'here.'
      })
    }

    const processor = new GeminiStreamProcessor(mockClient as any)
    const stream = await processor.createAnalysisStream('Test prompt')

    const reader = stream.getReader()
    const chunks: any[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const decoded = new TextDecoder().decode(value)
      const lines = decoded.split('\n').filter(line => line.startsWith('data: '))

      for (const line of lines) {
        const data = JSON.parse(line.slice(6))
        chunks.push(data)
      }
    }

    expect(chunks).toHaveLength(7) // progress + 4 content + complete + progress
    expect(chunks.filter(c => c.type === 'content')).toHaveLength(4)
    expect(chunks.find(c => c.type === 'complete')).toBeDefined()
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "react-markdown": "^9.0.0"
  }
}
```

## Definition of Done
- [ ] Server-Sent Events streaming werkend
- [ ] Real-time content updates in UI
- [ ] Progress indicators accuraat
- [ ] Error recovery geïmplementeerd
- [ ] Fallback naar non-streaming werkt
- [ ] Performance optimalisatie toegepast
- [ ] Cross-browser compatibility getest
- [ ] Memory leaks voorkomen

## Performance Targets
- Stream initialization: <1 seconde
- Chunk processing: <50ms per chunk
- UI update latency: <100ms
- Memory usage: <50MB tijdens streaming
- Connection recovery: <3 seconden