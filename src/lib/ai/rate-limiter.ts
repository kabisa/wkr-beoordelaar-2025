interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  retryAfterMs?: number
}

interface RateLimitInfo {
  remaining: number
  resetTime: number
  retryAfter?: number
}

interface RequestRecord {
  timestamp: number
  count: number
}

export class RateLimiter {
  private config: RateLimitConfig
  private requests: Map<string, RequestRecord[]> = new Map()

  constructor(config: RateLimitConfig) {
    this.config = {
      retryAfterMs: 60000, // Default 1 minute
      ...config
    }
  }

  checkLimit(identifier: string): RateLimitInfo {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // Get existing requests for this identifier
    let userRequests = this.requests.get(identifier) || []

    // Remove old requests outside the window
    userRequests = userRequests.filter(req => req.timestamp > windowStart)

    // Count total requests in window
    const totalRequests = userRequests.reduce((sum, req) => sum + req.count, 0)

    // Update the requests map
    this.requests.set(identifier, userRequests)

    const remaining = Math.max(0, this.config.maxRequests - totalRequests)
    const resetTime = windowStart + this.config.windowMs

    if (remaining === 0) {
      return {
        remaining: 0,
        resetTime,
        retryAfter: this.config.retryAfterMs
      }
    }

    return {
      remaining,
      resetTime
    }
  }

  async recordRequest(identifier: string, count: number = 1): Promise<boolean> {
    const limitInfo = this.checkLimit(identifier)

    if (limitInfo.remaining < count) {
      return false
    }

    const now = Date.now()
    let userRequests = this.requests.get(identifier) || []

    // Add new request
    userRequests.push({
      timestamp: now,
      count
    })

    this.requests.set(identifier, userRequests)
    return true
  }

  getRemainingRequests(identifier: string): number {
    return this.checkLimit(identifier).remaining
  }

  getResetTime(identifier: string): number {
    return this.checkLimit(identifier).resetTime
  }

  async waitForRateLimit(identifier: string): Promise<void> {
    const limitInfo = this.checkLimit(identifier)

    if (limitInfo.remaining > 0) {
      return
    }

    const waitTime = limitInfo.retryAfter || this.config.retryAfterMs!
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  cleanup(): void {
    const now = Date.now()

    for (const [identifier, requests] of this.requests.entries()) {
      const windowStart = now - this.config.windowMs
      const validRequests = requests.filter(req => req.timestamp > windowStart)

      if (validRequests.length === 0) {
        this.requests.delete(identifier)
      } else {
        this.requests.set(identifier, validRequests)
      }
    }
  }

  getStats(): { activeUsers: number; totalRequests: number } {
    let totalRequests = 0

    for (const requests of this.requests.values()) {
      totalRequests += requests.reduce((sum, req) => sum + req.count, 0)
    }

    return {
      activeUsers: this.requests.size,
      totalRequests
    }
  }
}

export const DEFAULT_GEMINI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60, // Gemini API limit: 60 requests per minute
  windowMs: 60000, // 1 minute window
  retryAfterMs: 60000 // Wait 1 minute before retry
}

export const createGeminiRateLimiter = () => {
  return new RateLimiter(DEFAULT_GEMINI_RATE_LIMIT)
}

export class GlobalRateLimiter {
  private static instance: RateLimiter

  static getInstance(): RateLimiter {
    if (!GlobalRateLimiter.instance) {
      GlobalRateLimiter.instance = createGeminiRateLimiter()

      // Cleanup old requests every 5 minutes
      setInterval(() => {
        GlobalRateLimiter.instance.cleanup()
      }, 5 * 60 * 1000)
    }

    return GlobalRateLimiter.instance
  }

  static reset(): void {
    GlobalRateLimiter.instance = createGeminiRateLimiter()
  }
}