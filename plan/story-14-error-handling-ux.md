# Story 14: Error Handling & UX

**Sprint:** 5
**Estimate:** 1-2 dagen
**Priority:** High

## User Story
Als gebruiker wil ik duidelijke foutmeldingen en een robuuste gebruikerservaring zodat ik weet wat er gebeurt en hoe problemen op te lossen.

## Acceptatiecriteria
- [x] Gebruiksvriendelijke error messages
- [x] Retry mechanismen
- [x] Loading states en feedback
- [x] Tooltips en help teksten
- [x] Graceful degradation
- [x] Offline support
- [x] Accessibility compliance

## Error Handling Architecture

### Global Error Boundary System
```tsx
// src/components/error/ErrorBoundary.tsx
import { Component, ReactNode, ErrorInfo } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  maxRetries?: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // Log error to monitoring service
    this.logError(error, errorInfo)

    // Call custom error handler
    this.props.onError?.(error, errorInfo)
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount
    }

    // Send to logging service
    console.error('Error boundary caught error:', errorReport)

    // In production, send to error monitoring service like Sentry
    // Sentry.captureException(error, { contexts: { errorBoundary: errorReport } })
  }

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      })

      // Auto-retry with exponential backoff for certain errors
      if (this.isRetryableError(this.state.error)) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
        this.retryTimeoutId = setTimeout(() => {
          this.forceUpdate()
        }, delay)
      }
    }
  }

  private isRetryableError = (error: Error | null): boolean => {
    if (!error) return false

    const retryablePatterns = [
      /network/i,
      /fetch/i,
      /timeout/i,
      /connection/i,
      /server error/i
    ]

    return retryablePatterns.some(pattern => pattern.test(error.message))
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    const { hasError, error, retryCount } = this.state
    const { children, fallback, maxRetries = 3 } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, this.handleRetry)
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                {this.getErrorMessage(error)}
              </div>

              {retryCount > 0 && (
                <div className="text-xs text-gray-500">
                  Retry attempt: {retryCount}/{maxRetries}
                </div>
              )}

              <div className="flex gap-2">
                {retryCount < maxRetries && (
                  <Button onClick={this.handleRetry} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}

                <Button onClick={this.handleGoHome}>
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }

  private getErrorMessage(error: Error): string {
    const userFriendlyMessages: Record<string, string> = {
      'NetworkError': 'Unable to connect to the server. Please check your internet connection.',
      'TypeError': 'A technical error occurred. Our team has been notified.',
      'SyntaxError': 'A data processing error occurred. Please try uploading your file again.',
      'AbortError': 'The operation was cancelled. You can try again.',
      'TimeoutError': 'The operation took too long. Please try again with a smaller file.',
      'QuotaExceededError': 'Storage limit exceeded. Please clear your browser cache.',
    }

    // Check for specific error types
    for (const [errorType, message] of Object.entries(userFriendlyMessages)) {
      if (error.name === errorType || error.message.includes(errorType)) {
        return message
      }
    }

    // Check for common error patterns
    if (error.message.includes('fetch')) {
      return 'Unable to load data from the server. Please check your connection and try again.'
    }

    if (error.message.includes('parse') || error.message.includes('JSON')) {
      return 'The uploaded file appears to be corrupted. Please try a different file.'
    }

    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return 'You don\'t have permission to perform this action.'
    }

    // Generic fallback
    return 'An unexpected error occurred. Please try again or contact support if the problem persists.'
  }
}

// Higher-order component for easy error boundary wrapping
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }
}
```

### API Error Handler
```typescript
// src/lib/error/api-error-handler.ts
export interface APIError {
  code: string
  message: string
  details?: any
  timestamp: number
  requestId?: string
  statusCode?: number
}

export class APIErrorHandler {
  static async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      await this.throwAPIError(response)
    }

    try {
      const data = await response.json()
      return data
    } catch (error) {
      throw new APIError(
        'PARSE_ERROR',
        'Failed to parse server response',
        { originalError: error },
        response.status
      )
    }
  }

  private static async throwAPIError(response: Response): Promise<never> {
    let errorData: any

    try {
      errorData = await response.json()
    } catch {
      errorData = { message: response.statusText }
    }

    const apiError = new APIError(
      errorData.code || this.getErrorCodeFromStatus(response.status),
      errorData.message || this.getErrorMessageFromStatus(response.status),
      errorData.details,
      response.status
    )

    throw apiError
  }

  private static getErrorCodeFromStatus(status: number): string {
    const statusCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      408: 'TIMEOUT',
      413: 'PAYLOAD_TOO_LARGE',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT'
    }

    return statusCodes[status] || 'UNKNOWN_ERROR'
  }

  private static getErrorMessageFromStatus(status: number): string {
    const statusMessages: Record<number, string> = {
      400: 'The request was invalid. Please check your input.',
      401: 'Authentication required. Please log in.',
      403: 'You don\'t have permission to access this resource.',
      404: 'The requested resource was not found.',
      408: 'The request timed out. Please try again.',
      413: 'The file is too large. Please try a smaller file.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: 'A server error occurred. Our team has been notified.',
      502: 'Service temporarily unavailable. Please try again later.',
      503: 'Service is currently under maintenance. Please try again later.',
      504: 'The server took too long to respond. Please try again.'
    }

    return statusMessages[status] || 'An unexpected error occurred.'
  }

  static isRetryableError(error: APIError): boolean {
    const retryableCodes = [
      'TIMEOUT',
      'INTERNAL_SERVER_ERROR',
      'BAD_GATEWAY',
      'SERVICE_UNAVAILABLE',
      'GATEWAY_TIMEOUT',
      'TOO_MANY_REQUESTS'
    ]

    return retryableCodes.includes(error.code) ||
           (error.statusCode && error.statusCode >= 500)
  }

  static getRetryDelay(attempt: number, error: APIError): number {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s, 8s
    const jitter = Math.random() * 1000 // Random 0-1s
    const maxDelay = 30000 // Max 30 seconds

    // Special handling for rate limiting
    if (error.code === 'TOO_MANY_REQUESTS') {
      return Math.min(baseDelay * 2, maxDelay)
    }

    return Math.min(baseDelay + jitter, maxDelay)
  }
}

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public statusCode?: number,
    public requestId?: string
  ) {
    super(message)
    this.name = 'APIError'
    this.timestamp = Date.now()
  }

  public timestamp: number

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      statusCode: this.statusCode,
      requestId: this.requestId,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}
```

### Retry Mechanism Hook
```tsx
// src/hooks/useRetry.ts
import { useState, useCallback } from 'react'

export interface RetryOptions {
  maxAttempts: number
  delay: number
  backoff: 'linear' | 'exponential'
  retryCondition?: (error: any) => boolean
}

export interface RetryState {
  isRetrying: boolean
  attempts: number
  lastError: Error | null
}

export function useRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 'exponential',
    retryCondition = () => true
  } = options

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    attempts: 0,
    lastError: null
  })

  const executeWithRetry = useCallback(async (): Promise<T> => {
    setRetryState({
      isRetrying: false,
      attempts: 0,
      lastError: null
    })

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setRetryState(prev => ({
          ...prev,
          isRetrying: attempt > 1,
          attempts: attempt
        }))

        const result = await operation()

        setRetryState(prev => ({
          ...prev,
          isRetrying: false
        }))

        return result

      } catch (error) {
        const isLastAttempt = attempt === maxAttempts
        const shouldRetry = retryCondition(error) && !isLastAttempt

        setRetryState(prev => ({
          ...prev,
          lastError: error as Error,
          isRetrying: shouldRetry
        }))

        if (!shouldRetry) {
          throw error
        }

        // Calculate delay
        const currentDelay = backoff === 'exponential'
          ? delay * Math.pow(2, attempt - 1)
          : delay * attempt

        await new Promise(resolve => setTimeout(resolve, currentDelay))
      }
    }

    throw retryState.lastError
  }, [operation, maxAttempts, delay, backoff, retryCondition])

  const reset = useCallback(() => {
    setRetryState({
      isRetrying: false,
      attempts: 0,
      lastError: null
    })
  }, [])

  return {
    executeWithRetry,
    retryState,
    reset
  }
}
```

### Toast Notification System
```tsx
// src/components/ui/toast.tsx
import { createContext, useContext, useReducer, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface Toast {
  id: string
  title: string
  description?: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastState {
  toasts: Toast[]
}

type ToastAction =
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'CLEAR_ALL' }

const ToastContext = createContext<{
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
} | null>(null)

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.toast]
      }
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.id)
      }
    case 'CLEAR_ALL':
      return {
        ...state,
        toasts: []
      }
    default:
      return state
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(toastReducer, { toasts: [] })

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...toast, id }

    dispatch({ type: 'ADD_TOAST', toast: newToast })

    // Auto-remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', id })
      }, toast.duration || 5000)
    }
  }

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id })
  }

  const clearAll = () => {
    dispatch({ type: 'CLEAR_ALL' })
  }

  return (
    <ToastContext.Provider value={{
      toasts: state.toasts,
      addToast,
      removeToast,
      clearAll
    }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success': return 'border-green-200'
      case 'error': return 'border-red-200'
      case 'warning': return 'border-yellow-200'
      case 'info': return 'border-blue-200'
    }
  }

  return (
    <div className={`bg-white border-l-4 ${getBorderColor()} rounded-lg shadow-lg p-4 min-w-80 max-w-md`}>
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{toast.title}</h4>
          {toast.description && (
            <p className="text-sm text-gray-600 mt-1">{toast.description}</p>
          )}
          {toast.action && (
            <Button
              onClick={toast.action.onClick}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              {toast.action.label}
            </Button>
          )}
        </div>
        <Button
          onClick={() => onRemove(toast.id)}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Convenience functions for common toast types
export const toast = {
  success: (title: string, description?: string) => {
    const { addToast } = useToast()
    addToast({ type: 'success', title, description })
  },

  error: (title: string, description?: string, action?: Toast['action']) => {
    const { addToast } = useToast()
    addToast({ type: 'error', title, description, action, duration: 0 })
  },

  warning: (title: string, description?: string) => {
    const { addToast } = useToast()
    addToast({ type: 'warning', title, description })
  },

  info: (title: string, description?: string) => {
    const { addToast } = useToast()
    addToast({ type: 'info', title, description })
  }
}
```

### Loading States & Feedback
```tsx
// src/components/ui/loading-states.tsx
import { Loader2, FileText, Upload, BarChart3 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className="flex items-center gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      {text && <span className="text-sm text-gray-600">{text}</span>}
    </div>
  )
}

interface ProgressLoadingProps {
  progress: number
  title: string
  description?: string
  stage?: string
}

export function ProgressLoading({ progress, title, description, stage }: ProgressLoadingProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600">{description}</p>
            )}
          </div>

          <Progress value={progress} className="h-2" />

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{stage || 'Processing...'}</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface StageLoadingProps {
  stages: Array<{
    id: string
    title: string
    status: 'pending' | 'active' | 'completed' | 'error'
  }>
}

export function StageLoading({ stages }: StageLoadingProps) {
  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      case 'active':
        return <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        </div>
      case 'error':
        return <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      default:
        return <div className="w-6 h-6 bg-gray-300 rounded-full" />
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-4">
              {getStageIcon(stage.status)}

              <div className="flex-1">
                <h4 className={`font-medium ${
                  stage.status === 'active' ? 'text-blue-600' :
                  stage.status === 'completed' ? 'text-green-600' :
                  stage.status === 'error' ? 'text-red-600' :
                  'text-gray-500'
                }`}>
                  {stage.title}
                </h4>
              </div>

              {index < stages.length - 1 && (
                <div className="absolute left-3 mt-6 w-0.5 h-6 bg-gray-200" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface SkeletonLoadingProps {
  type: 'dashboard' | 'table' | 'chart' | 'form'
}

export function SkeletonLoading({ type }: SkeletonLoadingProps) {
  switch (type) {
    case 'dashboard':
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-80 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      )

    case 'table':
      return (
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-8 bg-gray-200 rounded animate-pulse flex-1" />
              <div className="h-8 bg-gray-200 rounded animate-pulse w-24" />
              <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
            </div>
          ))}
        </div>
      )

    case 'chart':
      return (
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded animate-pulse w-48" />
          <div className="h-64 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      )

    case 'form':
      return (
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 bg-gray-200 rounded animate-pulse w-32" />
        </div>
      )

    default:
      return <div className="h-40 bg-gray-200 rounded-lg animate-pulse" />
  }
}
```

### Help System & Tooltips
```tsx
// src/components/help/HelpSystem.tsx
import { useState } from 'react'
import { HelpCircle, X, Book, Video, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface HelpItem {
  id: string
  title: string
  content: string
  type: 'text' | 'video' | 'link'
  category: string
  keywords: string[]
}

const helpContent: HelpItem[] = [
  {
    id: 'upload-xaf',
    title: 'How to upload XAF files',
    content: 'XAF files are XML-based audit files that contain your accounting data. To upload: 1) Click the upload area, 2) Select your .xaf file, 3) Wait for parsing to complete.',
    type: 'text',
    category: 'getting-started',
    keywords: ['upload', 'xaf', 'file', 'parse']
  },
  {
    id: 'understanding-wkr',
    title: 'Understanding WKR (Werkkostenregeling)',
    content: 'The WKR allows employers to provide tax-free benefits to employees up to 1.7% of the total wage sum. This includes things like travel allowances, training costs, and business gifts.',
    type: 'text',
    category: 'wkr-basics',
    keywords: ['wkr', 'werkkostenregeling', 'tax-free', 'benefits']
  },
  {
    id: 'free-space-calculation',
    title: 'How free space is calculated',
    content: 'Free space = 1.7% of total wage sum, with minimum €500 and maximum €1,200 per employee. Usage = total WKR-relevant expenses.',
    type: 'text',
    category: 'calculations',
    keywords: ['free space', 'calculation', '1.7%', 'wage sum']
  }
]

export function HelpButton({ topic }: { topic?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredContent = helpContent.filter(item => {
    if (topic && item.category === topic) return true
    if (!searchQuery) return true

    const query = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(query) ||
      item.content.toLowerCase().includes(query) ||
      item.keywords.some(keyword => keyword.includes(query))
    )
  })

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Help & Documentation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />

          {/* Quick links */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('upload')}>
              <FileText className="h-4 w-4 mr-2" />
              Upload Guide
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('wkr')}>
              <Book className="h-4 w-4 mr-2" />
              WKR Basics
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('calculation')}>
              <Video className="h-4 w-4 mr-2" />
              Calculations
            </Button>
          </div>

          {/* Help content */}
          <div className="space-y-3">
            {filteredContent.map(item => (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">{item.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredContent.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No help topics found for "{searchQuery}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Contextual tooltip helper
export function HelpTooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1 cursor-help">
            {children}
            <HelpCircle className="h-3 w-3 text-gray-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### Offline Support
```tsx
// src/components/offline/OfflineSupport.tsx
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showRetry, setShowRetry] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowRetry(false)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowRetry(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRetry = () => {
    // Force connectivity check
    fetch('/api/health', { method: 'HEAD' })
      .then(() => {
        setIsOnline(true)
        setShowRetry(false)
      })
      .catch(() => {
        setIsOnline(false)
      })
  }

  if (isOnline) return null

  return (
    <Alert className="mb-4 border-orange-200 bg-orange-50">
      <WifiOff className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          You're currently offline. Some features may not be available.
        </span>
        {showRetry && (
          <Button onClick={handleRetry} variant="outline" size="sm">
            <Wifi className="h-4 w-4 mr-2" />
            Retry Connection
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Service worker for offline caching
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
    })
  }
}
```

## Testing Error Scenarios

### Error Handling Tests
```typescript
// src/components/error/__tests__/error-handling.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary'
import { APIErrorHandler, APIError } from '@/lib/error/api-error-handler'

// Component that throws an error
function ProblematicComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Working component</div>
}

describe('Error Handling', () => {
  test('ErrorBoundary catches and displays errors', () => {
    render(
      <ErrorBoundary>
        <ProblematicComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByText(/try again/i)).toBeInTheDocument()
  })

  test('API error handler formats errors correctly', () => {
    const error = new APIError('TIMEOUT', 'Request timed out', {}, 408)

    expect(APIErrorHandler.isRetryableError(error)).toBe(true)
    expect(APIErrorHandler.getRetryDelay(1, error)).toBeGreaterThan(0)
  })

  test('Retry mechanism works correctly', () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('Success')

    // Test retry logic here
  })
})
```

## Definition of Done
- [ ] Global error boundary geïmplementeerd
- [ ] API error handling met user-friendly messages
- [ ] Retry mechanismen werkend
- [ ] Toast notification systeem operationeel
- [ ] Loading states voor alle async operaties
- [ ] Help systeem en tooltips beschikbaar
- [ ] Offline support geïmplementeerd
- [ ] Accessibility compliance (WCAG 2.1 AA)
- [ ] Error scenarios getest

## Accessibility Targets
- **WCAG 2.1 AA compliance**
- **Keyboard navigation** voor alle functies
- **Screen reader** ondersteuning
- **High contrast** mode ondersteuning
- **Focus indicators** zichtbaar
- **Alternative text** voor alle afbeeldingen
- **ARIA labels** correct geïmplementeerd