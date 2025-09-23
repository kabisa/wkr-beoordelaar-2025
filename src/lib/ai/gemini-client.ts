import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GeminiError, RetryableGeminiError, createGeminiError } from './gemini-errors'

export interface GeminiConfig {
  apiKey: string
  model: string
  temperature?: number
  topP?: number
  topK?: number
  maxOutputTokens?: number
}

export const DEFAULT_GEMINI_CONFIG: Omit<GeminiConfig, 'apiKey'> = {
  model: 'gemini-1.5-pro',
  temperature: 0.1,  // Low temperature for consistent analysis
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 8192
}

export interface AnalysisMetadata {
  tokensUsed?: number
  responseTime: number
  model: string
  timestamp: Date
}

export interface AnalysisResult {
  content: string
  metadata: AnalysisMetadata
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel
  private config: GeminiConfig

  constructor(config: GeminiConfig) {
    this.config = config
    this.genAI = new GoogleGenerativeAI(config.apiKey)
    this.model = this.genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ]
    })
  }

  async generateAnalysis(prompt: string): Promise<AnalysisResult> {
    const startTime = performance.now()

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const content = response.text()

      const endTime = performance.now()
      const responseTime = endTime - startTime

      return {
        content,
        metadata: {
          responseTime,
          model: this.config.model,
          timestamp: new Date(),
          tokensUsed: this.estimateTokens(prompt + content)
        }
      }
    } catch (error) {
      const geminiError = createGeminiError(error)
      throw new GeminiError(
        `Failed to generate analysis: ${geminiError.message}`,
        geminiError.code,
        error
      )
    }
  }

  async generateStreamingAnalysis(prompt: string): Promise<AsyncIterable<string>> {
    try {
      const result = await this.model.generateContentStream(prompt)

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
            const geminiError = createGeminiError(error)
            throw new GeminiError(
              `Streaming error: ${geminiError.message}`,
              geminiError.code,
              error
            )
          }
        }
      }
    } catch (error) {
      const geminiError = createGeminiError(error)
      throw new GeminiError(
        `Failed to start streaming analysis: ${geminiError.message}`,
        geminiError.code,
        error
      )
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const testPrompt = "Respond with 'OK' if you can read this message."
      const result = await this.generateAnalysis(testPrompt)
      return result.content.toLowerCase().includes('ok')
    } catch {
      return false
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for most languages
    return Math.ceil(text.length / 4)
  }

  getConfig(): GeminiConfig {
    return { ...this.config }
  }
}

export class RetryableGeminiClient extends GeminiClient {
  private maxRetries: number = 3
  private baseDelay: number = 1000 // 1 second

  constructor(config: GeminiConfig, maxRetries: number = 3) {
    super(config)
    this.maxRetries = maxRetries
  }

  async generateAnalysisWithRetry(prompt: string): Promise<AnalysisResult> {
    let lastError: Error = new Error('Unknown error')

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
          const delay = this.calculateDelay(attempt, error)
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

  async generateStreamingAnalysisWithRetry(prompt: string): Promise<AsyncIterable<string>> {
    let lastError: Error = new Error('Unknown error')

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.generateStreamingAnalysis(prompt)
      } catch (error) {
        lastError = error as Error

        if (!this.isRetryableError(error)) {
          throw error
        }

        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateDelay(attempt, error)
          await this.sleep(delay)
        }
      }
    }

    throw new GeminiError(
      `Streaming failed after ${this.maxRetries} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      lastError
    )
  }

  private isRetryableError(error: any): boolean {
    if (error instanceof RetryableGeminiError) {
      return true
    }

    const errorMessage = error?.message?.toLowerCase() || ''
    const retryablePatterns = [
      'rate limit',
      'quota exceeded',
      'network',
      'timeout',
      'connection',
      'temporary',
      'service unavailable',
      'internal error',
      'deadline exceeded'
    ]

    return retryablePatterns.some(pattern => errorMessage.includes(pattern))
  }

  private calculateDelay(attempt: number, error: any): number {
    // Use custom retry delay if provided by error
    if (error instanceof RetryableGeminiError && error.retryAfter) {
      return error.retryAfter
    }

    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt)
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter
    return exponentialDelay + jitter
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Factory function for creating clients
export function createGeminiClient(apiKey: string, options?: Partial<GeminiConfig>): RetryableGeminiClient {
  const config: GeminiConfig = {
    ...DEFAULT_GEMINI_CONFIG,
    ...options,
    apiKey
  }

  return new RetryableGeminiClient(config)
}