import { GeminiConfig } from './gemini-client'

export interface AIConfig {
  gemini: GeminiConfig
  rateLimiting: {
    maxRequestsPerMinute: number
    windowMs: number
    retryAfterMs: number
  }
  performance: {
    enabled: boolean
    maxStoredMetrics: number
    slowRequestThresholdMs: number
  }
  features: {
    streamingEnabled: boolean
    cacheEnabled: boolean
    autoRetryEnabled: boolean
  }
}

export function getAIConfig(): AIConfig {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }

  return {
    gemini: {
      apiKey,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.1'),
      topP: parseFloat(process.env.GEMINI_TOP_P || '0.8'),
      topK: parseInt(process.env.GEMINI_TOP_K || '40', 10),
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '4096', 10)
    },
    rateLimiting: {
      maxRequestsPerMinute: parseInt(process.env.GEMINI_MAX_REQUESTS_PER_MINUTE || '60', 10),
      windowMs: parseInt(process.env.GEMINI_RATE_LIMIT_WINDOW_MS || '60000', 10),
      retryAfterMs: parseInt(process.env.GEMINI_RETRY_AFTER_MS || '60000', 10)
    },
    performance: {
      enabled: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
      maxStoredMetrics: parseInt(process.env.MAX_STORED_METRICS || '1000', 10),
      slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '3000', 10)
    },
    features: {
      streamingEnabled: process.env.DISABLE_STREAMING !== 'true',
      cacheEnabled: process.env.DISABLE_CACHE !== 'true',
      autoRetryEnabled: process.env.DISABLE_AUTO_RETRY !== 'true'
    }
  }
}

export function validateAPIKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY
  return !!(apiKey && apiKey.length > 10 && apiKey.startsWith('AI'))
}

export function getEnvironmentInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    apiKeyValid: validateAPIKey()
  }
}

export const AI_CONFIG_SCHEMA = {
  gemini: {
    apiKey: { required: true, type: 'string', description: 'Google Gemini API key' },
    model: { required: false, type: 'string', default: 'gemini-1.5-pro' },
    temperature: { required: false, type: 'number', default: 0.1, min: 0, max: 2 },
    topP: { required: false, type: 'number', default: 0.8, min: 0, max: 1 },
    topK: { required: false, type: 'number', default: 40, min: 1, max: 100 },
    maxOutputTokens: { required: false, type: 'number', default: 4096, min: 1, max: 32768 }
  },
  rateLimiting: {
    maxRequestsPerMinute: { required: false, type: 'number', default: 60, min: 1 },
    windowMs: { required: false, type: 'number', default: 60000, min: 1000 },
    retryAfterMs: { required: false, type: 'number', default: 60000, min: 1000 }
  }
} as const