'use client'

import { useState, useCallback } from 'react'
import { Upload, File, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove: () => void
  onUploadComplete: (result: any) => void
  acceptedTypes?: string[]
  maxSize?: number // in MB
}

interface UploadState {
  file: File | null
  isDragging: boolean
  isUploading: boolean
  uploadProgress: number
  error: string | null
  success: boolean
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  onUploadComplete,
  acceptedTypes = ['.xaf', '.xml'],
  maxSize = 100
}: FileUploadProps) {
  const [state, setState] = useState<UploadState>({
    file: null,
    isDragging: false,
    isUploading: false,
    uploadProgress: 0,
    error: null,
    success: false
  })

  const validateFile = useCallback((file: File): string | null => {
    // Check file size (convert MB to bytes)
    if (file.size > maxSize * 1024 * 1024) {
      return `Bestand is te groot. Maximum ${maxSize}MB toegestaan.`
    }

    // Check file extension
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedTypes.includes(fileExtension)) {
      return `Bestandstype niet ondersteund. Alleen ${acceptedTypes.join(', ')} bestanden toegestaan.`
    }

    // Basic XAF validation - check if it contains XML structure
    return null
  }, [acceptedTypes, maxSize])

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file)

    if (error) {
      setState(prev => ({
        ...prev,
        error,
        file: null,
        success: false
      }))
      return
    }

    setState(prev => ({
      ...prev,
      file,
      error: null,
      success: false,
      uploadProgress: 0
    }))

    onFileSelect(file)
  }, [onFileSelect, validateFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, isDragging: true }))
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, isDragging: false }))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, isDragging: false }))

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleRemoveFile = useCallback(() => {
    setState(prev => ({
      ...prev,
      file: null,
      error: null,
      success: false,
      uploadProgress: 0,
      isUploading: false
    }))
    onFileRemove()
  }, [onFileRemove])

  const handleUpload = async () => {
    if (!state.file) return

    setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0, error: null }))

    try {
      const formData = new FormData()
      formData.append('file', state.file)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          uploadProgress: Math.min(prev.uploadProgress + 10, 90)
        }))
      }, 200)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        success: true
      }))

      onUploadComplete(result)

    } catch (error) {
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 0,
        error: error instanceof Error ? error.message : 'Upload failed'
      }))
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Upload Area */}
      {!state.file && (
        <Card>
          <CardContent className="p-0">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                state.isDragging
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-gray-400"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Sleep uw XAF bestand hier naartoe
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Of klik om een bestand te selecteren
              </p>
              <p className="text-xs text-gray-400">
                Ondersteunde formaten: {acceptedTypes.join(', ')} • Max {maxSize}MB
              </p>

              <input
                id="file-input"
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected File Display */}
      {state.file && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium text-sm">{state.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(state.file.size)}</p>
                </div>
              </div>

              {!state.isUploading && !state.success && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {state.success && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </div>

            {/* Upload Progress */}
            {state.isUploading && (
              <div className="mt-4 space-y-2">
                <Progress value={state.uploadProgress} className="h-2" />
                <p className="text-xs text-gray-500 text-center">
                  Uploading... {state.uploadProgress}%
                </p>
              </div>
            )}

            {/* Upload Button */}
            {state.file && !state.isUploading && !state.success && (
              <div className="mt-4">
                <Button
                  onClick={handleUpload}
                  className="w-full"
                  disabled={state.isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Analyseer XAF Bestand
                </Button>
              </div>
            )}

            {/* Success Message */}
            {state.success && (
              <div className="mt-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Bestand succesvol geüpload en verwerkt!
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {state.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}