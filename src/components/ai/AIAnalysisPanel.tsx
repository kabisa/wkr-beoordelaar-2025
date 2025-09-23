'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { AlertCircle, Brain, Clock, Target, Zap } from 'lucide-react'
import { XAFTransaction } from '@/types/xaf'

interface AIAnalysisPanelProps {
  transactions?: XAFTransaction[]
  onAnalysisComplete?: (analysis: string, metadata: any) => void
}

interface AnalysisResult {
  analysis: string
  metadata: {
    tokensUsed?: number
    responseTime: number
    model: string
    analysisType: string
    transactionCount: number
  }
}

export default function AIAnalysisPanel({ transactions = [], onAnalysisComplete }: AIAnalysisPanelProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const analysisTypes = [
    {
      id: 'wkr-compliance',
      title: 'WKR Compliance Analyse',
      description: 'Controleert naleving van de Werkkostenregeling',
      icon: Target
    },
    {
      id: 'risk-assessment',
      title: 'Risico Analyse',
      description: 'Identificeert financiële en compliance risico\'s',
      icon: AlertCircle
    },
    {
      id: 'pattern-analysis',
      title: 'Patroon Analyse',
      description: 'Zoekt naar ongebruikelijke patronen en anomalieën',
      icon: Brain
    },
    {
      id: 'custom',
      title: 'Aangepaste Analyse',
      description: 'Gebruik je eigen prompt voor specifieke vragen',
      icon: Zap
    }
  ]

  const handleAnalyze = async (useStreaming = false) => {
    if (!selectedAnalysis) {
      setError('Selecteer een analyse type')
      return
    }

    if (selectedAnalysis === 'custom' && !customPrompt.trim()) {
      setError('Voer een custom prompt in')
      return
    }

    if (!transactions || transactions.length === 0) {
      setError('Geen transacties beschikbaar voor analyse')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setResult(null)
    setStreamingContent('')

    try {
      const payload = {
        transactions,
        analysisType: selectedAnalysis,
        prompt: selectedAnalysis === 'custom' ? customPrompt : undefined
      }

      if (useStreaming) {
        await handleStreamingAnalysis(payload)
      } else {
        await handleRegularAnalysis(payload)
      }

    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Onbekende fout opgetreden')
    } finally {
      setIsAnalyzing(false)
      setIsStreaming(false)
    }
  }

  const handleRegularAnalysis = async (payload: any) => {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Analyse mislukt')
    }

    const analysisResult: AnalysisResult = {
      analysis: data.data.analysis,
      metadata: data.data.metadata
    }

    setResult(analysisResult)
    onAnalysisComplete?.(analysisResult.analysis, analysisResult.metadata)
  }

  const handleStreamingAnalysis = async (payload: any) => {
    setIsStreaming(true)

    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Streaming analyse mislukt')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('Geen response stream beschikbaar')
    }

    let fullContent = ''
    let metadata: any = null

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'metadata') {
                metadata = data.data
              } else if (data.type === 'content') {
                fullContent += data.data
                setStreamingContent(fullContent)
              } else if (data.type === 'complete') {
                const finalResult: AnalysisResult = {
                  analysis: fullContent,
                  metadata: metadata || {
                    responseTime: 0,
                    model: 'unknown',
                    analysisType: selectedAnalysis,
                    transactionCount: transactions.length
                  }
                }

                setResult(finalResult)
                onAnalysisComplete?.(finalResult.analysis, finalResult.metadata)
              } else if (data.type === 'error') {
                throw new Error(data.data.message)
              }
            } catch (parseError) {
              console.warn('Failed to parse streaming data:', parseError)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  const selectedType = analysisTypes.find(type => type.id === selectedAnalysis)

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Analyse van WKR Transacties
        </CardTitle>
        <CardDescription>
          Gebruik AI om inzichten te krijgen in je gefilterde transacties ({transactions?.length || 0} items)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Analyse Type</label>
            <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een analyse type" />
              </SelectTrigger>
              <SelectContent>
                {analysisTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{type.title}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedAnalysis === 'custom' && (
            <div>
              <label className="text-sm font-medium mb-2 block">Custom Prompt</label>
              <Textarea
                placeholder="Beschrijf wat je wilt analyseren..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => handleAnalyze(false)}
              disabled={isAnalyzing || !selectedAnalysis || !transactions || transactions.length === 0}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Analyseren...
                </>
              ) : (
                'Start Analyse'
              )}
            </Button>

            <Button
              onClick={() => handleAnalyze(true)}
              disabled={isAnalyzing || !selectedAnalysis || !transactions || transactions.length === 0}
              variant="outline"
            >
              Streaming
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Analyse Fout</h4>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isStreaming && streamingContent && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Streaming analyse...</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm">{streamingContent}</pre>
            </div>
          </div>
        )}

        {result && !isStreaming && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Analyse Resultaat</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {result.metadata.responseTime && (
                  <span>⏱️ {result.metadata.responseTime.toFixed(0)}ms</span>
                )}
                {result.metadata.tokensUsed && (
                  <span>🎯 {result.metadata.tokensUsed} tokens</span>
                )}
                <span>📊 {result.metadata.transactionCount || 0} transacties</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border">
              <pre className="whitespace-pre-wrap text-sm">{result.analysis}</pre>
            </div>
          </div>
        )}

        {selectedType && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-2">
              <selectedType.icon className="h-4 w-4 mt-0.5 text-blue-600" />
              <div>
                <h4 className="font-medium text-sm">{selectedType.title}</h4>
                <p className="text-xs text-muted-foreground">{selectedType.description}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}