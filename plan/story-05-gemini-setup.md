# Story 5: Gemini API Setup

**Sprint:** 2
**Estimate:** 1-2 dagen
**Priority:** Critical

## User Story
Als systeem wil ik kunnen communiceren met Google Gemini AI zodat ik WKR analyses kan uitvoeren op gefilterde boekhouddata.

## Acceptatiecriteria
- [x] Google AI SDK geïntegreerd
- [x] API route voor analyse requests
- [x] Server-side API key management
- [x] Rate limiting implementatie
- [x] Error handling en retry logica
- [x] Streaming response setup
- [x] Token usage monitoring

## Technical Implementation

### Google AI SDK Integration
```typescript
// src/lib/ai/gemini-client.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

export interface GeminiConfig {
  apiKey: string
  model: string
  temperature?: number
  topP?: number
  topK?: number
  maxOutputTokens?: number
}

export const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  apiKey: process.env.GOOGLE_AI_API_KEY!,
  model: 'gemini-2.5-pro',
  temperature: 0.1,  // Low temperature for consistent analysis
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 8192
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel
  private config: GeminiConfig

  constructor(config: GeminiConfig = DEFAULT_GEMINI_CONFIG) {
    this.config = config
    this.genAI = new GoogleGenerativeAI(config.apiKey)
    this.model = this.genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
      }
    })
  }

  async generateAnalysis(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      throw new GeminiError(
        'Failed to generate analysis',
        'GENERATION_ERROR',
        error
      )
    }
  }

  async generateStreamingAnalysis(prompt: string): Promise<AsyncIterable<string>> {
    try {
      const result = await this.model.generateContentStream(prompt)

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
      throw new GeminiError(
        'Failed to start streaming analysis',
        'STREAMING_ERROR',
        error
      )
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const testPrompt = "Respond with 'OK' if you can read this message."
      const response = await this.generateAnalysis(testPrompt)
      return response.toLowerCase().includes('ok')
    } catch {
      return false
    }
  }
}
```

### Error Handling & Retry Logic
```typescript
// src/lib/ai/gemini-errors.ts
export class GeminiError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

export class RetryableGeminiClient extends GeminiClient {
  private maxRetries: number = 3
  private baseDelay: number = 1000 // 1 second

  async generateAnalysisWithRetry(prompt: string): Promise<string> {
    let lastError: Error

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.generateAnalysis(prompt)
      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw error
        }

        // Wait before retry with exponential backoff
        if (attempt < this.maxRetries - 1) {
          const delay = this.baseDelay * Math.pow(2, attempt)
          await this.sleep(delay)
        }
      }
    }

    throw new GeminiError(
      `Failed after ${this.maxRetries} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      lastError
    )
  }

  private isRetryableError(error: any): boolean {
    // Retry on rate limits, temporary server errors
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'INTERNAL_ERROR',
      'SERVICE_UNAVAILABLE',
      'DEADLINE_EXCEEDED'
    ]

    const errorMessage = error?.message?.toLowerCase() || ''
    const isNetworkError = errorMessage.includes('network') ||
                          errorMessage.includes('timeout') ||
                          errorMessage.includes('connection')

    return retryableCodes.some(code =>
      errorMessage.includes(code.toLowerCase())
    ) || isNetworkError
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Rate Limiting
```typescript
// src/lib/ai/rate-limiter.ts
export class RateLimiter {
  private requests: number[] = []
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  async checkLimit(userId: string = 'default'): Promise<boolean> {
    const now = Date.now()

    // Clean old requests outside window
    this.requests = this.requests.filter(time => now - time < this.windowMs)

    // Check if under limit
    if (this.requests.length >= this.maxRequests) {
      return false
    }

    // Record this request
    this.requests.push(now)
    return true
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0

    const oldestRequest = Math.min(...this.requests)
    const resetTime = oldestRequest + this.windowMs
    return Math.max(0, resetTime - Date.now())
  }

  getRemainingRequests(): number {
    return Math.max(0, this.maxRequests - this.requests.length)
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter(60, 60000) // 60 requests per minute
```

### Token Usage Monitoring
```typescript
// src/lib/ai/token-monitor.ts
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requestId: string
  timestamp: Date
  cost: number
}

export class TokenMonitor {
  private usage: TokenUsage[] = []
  private readonly COST_PER_TOKEN = 0.000002 // Example pricing

  recordUsage(usage: Omit<TokenUsage, 'cost' | 'timestamp' | 'requestId'>): void {
    const tokenUsage: TokenUsage = {
      ...usage,
      cost: usage.totalTokens * this.COST_PER_TOKEN,
      timestamp: new Date(),
      requestId: this.generateRequestId()
    }

    this.usage.push(tokenUsage)

    // Keep only last 1000 records to prevent memory issues
    if (this.usage.length > 1000) {
      this.usage = this.usage.slice(-1000)
    }
  }

  getTotalUsage(timeframe?: 'hour' | 'day' | 'month'): {
    totalTokens: number
    totalCost: number
    requestCount: number
  } {
    let filteredUsage = this.usage

    if (timeframe) {
      const now = new Date()
      const cutoff = new Date()

      switch (timeframe) {
        case 'hour':
          cutoff.setHours(now.getHours() - 1)
          break
        case 'day':
          cutoff.setDate(now.getDate() - 1)
          break
        case 'month':
          cutoff.setMonth(now.getMonth() - 1)
          break
      }

      filteredUsage = this.usage.filter(u => u.timestamp >= cutoff)
    }

    return {
      totalTokens: filteredUsage.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCost: filteredUsage.reduce((sum, u) => sum + u.cost, 0),
      requestCount: filteredUsage.length
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const tokenMonitor = new TokenMonitor()
```

## API Endpoints

### Analysis API Route
```typescript
// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { RetryableGeminiClient } from '@/lib/ai/gemini-client'
import { globalRateLimiter } from '@/lib/ai/rate-limiter'
import { tokenMonitor } from '@/lib/ai/token-monitor'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const canProceed = await globalRateLimiter.checkLimit()
    if (!canProceed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          resetTime: globalRateLimiter.getTimeUntilReset()
        },
        { status: 429 }
      )
    }

    const { prompt, data } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      )
    }

    // Initialize Gemini client
    const geminiClient = new RetryableGeminiClient()

    // Generate analysis
    const analysis = await geminiClient.generateAnalysisWithRetry(prompt)

    // Monitor token usage (estimated)
    const estimatedTokens = prompt.length / 4 + analysis.length / 4
    tokenMonitor.recordUsage({
      promptTokens: Math.floor(prompt.length / 4),
      completionTokens: Math.floor(analysis.length / 4),
      totalTokens: Math.floor(estimatedTokens)
    })

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        tokensUsed: Math.floor(estimatedTokens),
        remainingRequests: globalRateLimiter.getRemainingRequests()
      }
    })

  } catch (error) {
    console.error('Analysis error:', error)

    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Streaming Analysis Route
```typescript
// src/app/api/analyze/stream/route.ts
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    // Rate limiting check
    const canProceed = await globalRateLimiter.checkLimit()
    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const geminiClient = new RetryableGeminiClient()

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamingResponse = await geminiClient.generateStreamingAnalysis(prompt)

          for await (const chunk of streamingResponse) {
            const data = `data: ${JSON.stringify({ chunk })}\n\n`
            controller.enqueue(new TextEncoder().encode(data))
          }

          // Send completion signal
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()

        } catch (error) {
          const errorData = `data: ${JSON.stringify({
            error: error.message
          })}\n\n`
          controller.enqueue(new TextEncoder().encode(errorData))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to start streaming' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
```

## Environment Configuration

### Environment Variables
```bash
# .env.local
GOOGLE_AI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
GEMINI_TEMPERATURE=0.1
GEMINI_MAX_TOKENS=8192

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=60
RATE_LIMIT_WINDOW_MS=60000

# Development settings
NODE_ENV=development
```

### Configuration Validation
```typescript
// src/lib/config/env-validation.ts
import { z } from 'zod'

const envSchema = z.object({
  GOOGLE_AI_API_KEY: z.string().min(1, 'Google AI API key is required'),
  GEMINI_MODEL: z.string().default('gemini-2.5-pro'),
  GEMINI_TEMPERATURE: z.string().transform(Number).default('0.1'),
  GEMINI_MAX_TOKENS: z.string().transform(Number).default('8192'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('60'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
})

export const env = envSchema.parse(process.env)

export function validateEnvironment(): void {
  try {
    envSchema.parse(process.env)
    console.log('✅ Environment configuration is valid')
  } catch (error) {
    console.error('❌ Environment configuration error:', error)
    process.exit(1)
  }
}
```

## Testing

### Unit Tests
```typescript
// src/lib/ai/__tests__/gemini-client.test.ts
import { GeminiClient } from '../gemini-client'

// Mock the Google AI SDK
jest.mock('@google/generative-ai')

describe('GeminiClient', () => {
  let client: GeminiClient

  beforeEach(() => {
    client = new GeminiClient({
      apiKey: 'test-key',
      model: 'gemini-2.5-pro'
    })
  })

  test('should generate analysis', async () => {
    const mockResponse = 'Generated analysis content'
    // Mock implementation

    const result = await client.generateAnalysis('Test prompt')
    expect(result).toBe(mockResponse)
  })

  test('should handle API errors gracefully', async () => {
    // Mock API error

    await expect(client.generateAnalysis('Test'))
      .rejects
      .toThrow('Failed to generate analysis')
  })

  test('should validate connection', async () => {
    const isValid = await client.validateConnection()
    expect(typeof isValid).toBe('boolean')
  })
})
```

### Integration Tests
```typescript
// src/app/api/analyze/__tests__/route.test.ts
import { POST } from '../route'

describe('/api/analyze', () => {
  test('should analyze prompt successfully', async () => {
    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Analyze this data: ...'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.analysis).toBeDefined()
  })

  test('should handle rate limiting', async () => {
    // Simulate rate limit exceeded
    // ... test implementation
  })
})
```

## Performance Monitoring

### Response Time Tracking
```typescript
// src/lib/ai/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Array<{
    operation: string
    duration: number
    timestamp: Date
    success: boolean
  }> = []

  async trackOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    let success = true

    try {
      const result = await fn()
      return result
    } catch (error) {
      success = false
      throw error
    } finally {
      const duration = performance.now() - start
      this.metrics.push({
        operation,
        duration,
        timestamp: new Date(),
        success
      })

      // Log slow operations
      if (duration > 5000) {
        console.warn(`Slow operation detected: ${operation} took ${duration}ms`)
      }
    }
  }

  getAverageResponseTime(operation?: string): number {
    const filteredMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics

    if (filteredMetrics.length === 0) return 0

    const total = filteredMetrics.reduce((sum, m) => sum + m.duration, 0)
    return total / filteredMetrics.length
  }

  getSuccessRate(operation?: string): number {
    const filteredMetrics = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics

    if (filteredMetrics.length === 0) return 100

    const successful = filteredMetrics.filter(m => m.success).length
    return (successful / filteredMetrics.length) * 100
  }
}

export const performanceMonitor = new PerformanceMonitor()
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "@google/generative-ai": "^0.15.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0"
  }
}
```

## Definition of Done
- [ ] Gemini API successfully geïntegreerd
- [ ] Rate limiting werkend (60 req/min)
- [ ] Error handling met retry logic
- [ ] Streaming responses mogelijk
- [ ] Token usage monitoring actief
- [ ] Unit tests coverage >90%
- [ ] Integration tests met echte API
- [ ] Performance monitoring geïmplementeerd
- [ ] Environment validation werkend

## Performance Targets
- API response tijd: <2 seconden
- Rate limiting: 60 requests per minuut
- Error rate: <5%
- Retry success rate: >90%
- Token usage tracking: Real-time