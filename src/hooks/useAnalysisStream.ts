import { useState, useCallback, useRef, useEffect } from 'react'

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

export interface StreamCallbacks {
  onStatusChange?: (status: StreamState['status']) => void
  onProgress?: (progress: ProgressState) => void
  onContent?: (chunk: string, accumulated: string) => void
  onComplete?: (fullContent: string) => void
  onError?: (error: string) => void
  onMetadata?: (metadata: any) => void
}

export function useAnalysisStream() {
  const [state, setState] = useState<StreamState>({
    status: 'idle',
    content: '',
    progress: { stage: '', message: '' }
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const startAnalysis = useCallback(async (payload: {
    transactions: any[]
    analysisType?: string
    prompt?: string
  }) => {
    try {
      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      // Reset state
      setState({
        status: 'connecting',
        content: '',
        progress: { stage: 'initializing', message: 'Verbinden met analysedienst...' },
        error: undefined
      })

      // Start streaming analysis (with server-side fallback)
      const response = await fetch('/api/ai/stream-with-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      await readStream(response)

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setState(prev => ({ ...prev, status: 'idle' }))
      } else {
        setState(prev => ({
          ...prev,
          error: error.message,
          status: 'error'
        }))
      }
    }
  }, [])

  const readStream = async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body available')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    setState(prev => ({ ...prev, status: 'streaming' }))

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
              await handleStreamMessage(data, fullContent, (content) => {
                fullContent = content
              })
            } catch (error) {
              console.warn('Failed to parse stream message:', line)
            }
          }
        }
      }

      // Mark as complete if we haven't already
      setState(prev => prev.status !== 'complete' ? {
        ...prev,
        status: 'complete',
        content: fullContent,
        progress: { ...prev.progress, stage: 'complete', message: 'Analyse voltooid!' }
      } : prev)

    } catch (error: any) {
      throw error
    } finally {
      reader.releaseLock()
    }
  }

  const handleStreamMessage = async (
    message: any,
    currentContent: string,
    updateContent: (content: string) => void
  ) => {
    switch (message.type) {
      case 'metadata':
        setState(prev => ({
          ...prev,
          metadata: message.data,
          progress: {
            stage: 'initialized',
            message: `Verwerken van ${message.data.transactionCount} transacties${message.data.fallbackMode ? ' (noodmodus)' : ''}...`,
            percentage: 10
          }
        }))
        break

      case 'content':
        const newContent = currentContent + message.data
        updateContent(newContent)
        setState(prev => ({
          ...prev,
          content: newContent,
          progress: {
            ...prev.progress,
            stage: 'streaming',
            message: 'Analyse ontvangen...',
            contentLength: newContent.length,
            percentage: Math.min(90, 30 + (newContent.length / 100))
          }
        }))
        break

      case 'complete':
        const finalContent = message.data.content || currentContent
        updateContent(finalContent)
        setState(prev => ({
          ...prev,
          content: finalContent,
          status: 'complete',
          progress: {
            stage: 'complete',
            message: 'Analyse voltooid!',
            percentage: 100
          },
          metadata: {
            ...prev.metadata,
            ...message.data.metadata
          }
        }))
        break

      case 'error':
        setState(prev => ({
          ...prev,
          error: message.data.message,
          status: 'error'
        }))
        break
    }
  }

  const stopAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState(prev => ({ ...prev, status: 'idle' }))
  }, [])

  const resetAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setState({
      status: 'idle',
      content: '',
      progress: { stage: '', message: '' },
      error: undefined
    })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    state,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    isStreaming: state.status === 'streaming' || state.status === 'connecting'
  }
}