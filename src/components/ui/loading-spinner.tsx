import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
        sizeClasses[size],
        className
      )}
    />
  )
}

interface LoadingStateProps {
  isLoading: boolean
  children: React.ReactNode
  loadingText?: string
  spinner?: boolean
}

export function LoadingState({
  isLoading,
  children,
  loadingText = "Loading...",
  spinner = true
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          {spinner && <LoadingSpinner />}
          <span className="text-gray-600">{loadingText}</span>
        </div>
      </div>
    )
  }

  return <>{children}</>
}