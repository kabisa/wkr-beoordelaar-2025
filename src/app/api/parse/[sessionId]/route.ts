import { NextRequest, NextResponse } from 'next/server'

// GET endpoint to retrieve full parsed data by session ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Check if we have the data cached
    if (!(global as any).parsedDataCache || !(global as any).parsedDataCache.has(sessionId)) {
      return NextResponse.json(
        { error: 'Session data not found or expired' },
        { status: 404 }
      )
    }

    const cachedData = (global as any).parsedDataCache.get(sessionId)

    // Check if data is not too old (1 hour expiry)
    const isExpired = Date.now() - cachedData.timestamp > 60 * 60 * 1000
    if (isExpired) {
      (global as any).parsedDataCache.delete(sessionId)
      return NextResponse.json(
        { error: 'Session data has expired' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        transactions: cachedData.transactions,
        accounts: cachedData.accounts,
        sessionId,
        retrievedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error retrieving session data:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session data' },
      { status: 500 }
    )
  }
}