import { NextRequest, NextResponse } from 'next/server'
import { GlobalPerformanceMonitor } from '@/lib/ai/performance-monitor'
import { GlobalRateLimiter } from '@/lib/ai/rate-limiter'

export async function GET() {
  try {
    const performanceMonitor = GlobalPerformanceMonitor.getInstance()
    const rateLimiter = GlobalRateLimiter.getInstance()

    const performanceStats = performanceMonitor.getStats()
    const recentMetrics = performanceMonitor.getRecentMetrics(20)
    const slowRequests = performanceMonitor.getSlowRequests(3000) // Requests slower than 3 seconds
    const tokenUsageByDay = performanceMonitor.getTokenUsageByDay()
    const rateLimiterStats = rateLimiter.getStats()

    return NextResponse.json({
      success: true,
      data: {
        performance: {
          ...performanceStats,
          recentRequests: recentMetrics,
          slowRequests: slowRequests.slice(0, 10), // Top 10 slowest
          tokenUsageByDay
        },
        rateLimiting: rateLimiterStats,
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Error retrieving AI stats:', error)

    return NextResponse.json(
      { error: 'Fout bij ophalen van AI statistieken' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Reset all monitoring systems
    GlobalPerformanceMonitor.reset()
    GlobalRateLimiter.reset()

    return NextResponse.json({
      success: true,
      message: 'AI statistieken succesvol gereset'
    })

  } catch (error) {
    console.error('Error resetting AI stats:', error)

    return NextResponse.json(
      { error: 'Fout bij resetten van AI statistieken' },
      { status: 500 }
    )
  }
}