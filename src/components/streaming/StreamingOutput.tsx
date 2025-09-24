'use client'

import { useState, useEffect, useRef } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Square, RotateCcw, Play, Zap, Clock, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react'
import { useAnalysisStream } from '@/hooks/useAnalysisStream'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface StreamingOutputProps {
  transactions: any[]
  analysisType?: string
  prompt?: string
  onComplete?: (analysis: string, metadata?: any) => void
}

export function StreamingOutput({
  transactions,
  analysisType = 'wkr-compliance',
  prompt,
  onComplete
}: StreamingOutputProps) {
  const { state, startAnalysis, stopAnalysis, resetAnalysis, isStreaming } = useAnalysisStream()
  const [startTime, setStartTime] = useState<number | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const completedRef = useRef(false)

  const handleStart = async () => {
    setStartTime(Date.now())
    completedRef.current = false
    await startAnalysis({
      transactions,
      analysisType,
      prompt
    })
  }

  const handleReset = () => {
    completedRef.current = false
    setIsCopied(false)
    resetAnalysis()
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(state.content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  useEffect(() => {
    if (state.status === 'complete' && onComplete && !completedRef.current) {
      completedRef.current = true
      onComplete(state.content, state.metadata)
    }
  }, [state.status, state.content, state.metadata, onComplete])

  const getProgressPercentage = (): number => {
    if (state.progress.percentage) {
      return state.progress.percentage
    }

    switch (state.progress.stage) {
      case 'initializing': return 5
      case 'initialized': return 15
      case 'streaming': return 30 + Math.min(60, (state.content.length / 50))
      case 'complete': return 100
      default: return 0
    }
  }

  const getStatusIcon = () => {
    switch (state.status) {
      case 'idle':
        return <Play className="h-4 w-4" />
      case 'connecting':
      case 'streaming':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Play className="h-4 w-4" />
    }
  }

  const getElapsedTime = (): string => {
    if (!startTime) return ''
    const elapsed = Date.now() - startTime
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`
  }

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Streaming WKR Analysis
            {state.metadata?.documentEnhanced && (
              <Badge variant="secondary" className="ml-2 hidden">
                Document verrijkt
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {state.status === 'idle' && (
              <Button onClick={handleStart} disabled={!transactions.length}>
                {getStatusIcon()}
                <span className="ml-2">Start Analyse</span>
              </Button>
            )}

            {isStreaming && (
              <Button onClick={stopAnalysis} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
                Stop Analyse
              </Button>
            )}

            {(state.status === 'complete' || state.status === 'error') && (
              <Button onClick={handleReset} variant="outline">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}

            <div className="flex-1">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>{state.progress.message || 'Klaar om te analyseren'}</span>
                <div className="flex items-center gap-2">
                  {startTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{getElapsedTime()}</span>
                    </div>
                  )}
                  {state.metadata?.transactionCount && (
                    <Badge variant="outline" className="text-xs">
                      {state.metadata.transactionCount} transacties
                    </Badge>
                  )}
                </div>
              </div>
              <Progress value={getProgressPercentage()} className="h-2" />
            </div>
          </div>

          {/* Metadata Display */}
          {state.metadata && (
            <div className="flex items-center gap-4 text-xs text-gray-500 hidden">
              {state.metadata.documentsUsed > 0 && (
                <span>📄 {state.metadata.documentsUsed} WKR documenten</span>
              )}
              {state.metadata.model && (
                <span>🤖 {state.metadata.model}</span>
              )}
              {state.metadata.responseTime && (
                <span>⏱️ {state.metadata.responseTime.toFixed(0)}ms</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress Details */}
      {isStreaming && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900">
                  {state.progress.stage}: {state.progress.message}
                </div>
                {state.progress.contentLength && (
                  <div className="text-xs text-blue-700 mt-1">
                    {state.progress.contentLength} tekens ontvangen
                  </div>
                )}
              </div>
              <div className="text-right text-xs text-blue-600">
                {getProgressPercentage().toFixed(0)}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {state.status === 'error' && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 mb-1">Analysefout</h3>
                <p className="text-sm text-red-700">{state.error}</p>
                <Button
                  onClick={handleStart}
                  variant="outline"
                  size="sm"
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  Probeer opnieuw
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streaming Content */}
      {state.content && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">WKR Analyse Resultaten</CardTitle>
              <div className="flex items-center gap-2">
                {state.status === 'complete' && state.content && (
                  <Button
                    onClick={handleCopyMarkdown}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4 text-green-600" />
                        <span>Gekopieerd!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Kopieer Markdown</span>
                      </>
                    )}
                  </Button>
                )}
                {state.status === 'complete' && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Voltooid
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none text-left">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[]}
                components={{
                  // Enhanced table styling
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6">
                      <table className="min-w-full border-collapse border border-gray-300 bg-white shadow-sm rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-50">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="bg-white divide-y divide-gray-200">
                      {children}
                    </tbody>
                  ),
                  th: ({ children }) => (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-50">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-6 py-4 text-sm text-gray-900 border border-gray-200 whitespace-nowrap">
                      {children}
                    </td>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-gray-50 transition-colors duration-150">
                      {children}
                    </tr>
                  ),
                  // Enhanced headings
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium text-gray-700 mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  // Enhanced lists
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 my-3">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 my-3">
                      {children}
                    </ol>
                  ),
                  // Enhanced code blocks
                  code: ({ children, className }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                        {children}
                      </code>
                    )
                  },
                  // Enhanced blockquotes
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-blue-200 pl-4 py-2 my-4 bg-blue-50 italic">
                      {children}
                    </blockquote>
                  )
                }}
              >
                {state.content}
              </ReactMarkdown>

              {/* Typing indicator */}
              {isStreaming && (
                <div className="flex items-center gap-3 mt-6 p-3 bg-gray-50 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm text-gray-600">AI analyseert je transacties...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}