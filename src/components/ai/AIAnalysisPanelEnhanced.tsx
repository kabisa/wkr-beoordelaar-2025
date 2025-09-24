'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Brain, Target, Zap, Sparkles, Clock, Activity } from 'lucide-react'
import { XAFTransaction } from '@/types/xaf'
import { PromptDebugger } from './PromptDebugger'
import { StreamingOutput } from '@/components/streaming/StreamingOutput'

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
    promptDetails?: {
      analysisPrompt: string
      transactionDataPreview: string
      fullTransactionDataLength: number
      systemInstruction: string
      documentsIncluded: Array<{
        filename: string
        displayName: string
        size: string
      }>
    }
  }
}

export default function AIAnalysisPanelEnhanced({ transactions = [], onAnalysisComplete }: AIAnalysisPanelProps) {
  const [selectedAnalysis, setSelectedAnalysis] = useState<string>('wkr-compliance')
  const [customPrompt, setCustomPrompt] = useState('')
  const [showPromptDebugger, setShowPromptDebugger] = useState(false)
  const [useStreaming] = useState(true) // Always true, option hidden
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const analysisTypes = [
    {
      id: 'wkr-compliance',
      title: 'WKR Compliance Analyse',
      description: 'Controleert naleving van de Werkkostenregeling met specifieke WKR-regelgeving',
      icon: Target,
      features: ['Automatische WKR-categorisatie', 'Vrijstellingen detectie', 'Compliance score']
    },
    {
      id: 'wkr-detailed',
      title: 'Gedetailleerde WKR Analyse',
      description: 'Uitgebreide analyse met berekeningen en aanbevelingen',
      icon: Brain,
      features: ['Vrije ruimte berekening', 'Kostenspecificatie', 'Actieplan']
    },
    {
      id: 'custom',
      title: 'Aangepaste Analyse',
      description: 'Gebruik je eigen prompt voor specifieke vragen',
      icon: Zap,
      features: ['Flexible prompting', 'Domain expertise', 'Custom outputs']
    }
  ]

  const selectedType = analysisTypes.find(type => type.id === selectedAnalysis)

  // Check for debug mode from URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      setIsDebugMode(urlParams.get('debug') === 'true')
    }
  }, [])

  const handleAnalysisComplete = (analysis: string, metadata?: any) => {
    const finalResult: AnalysisResult = {
      analysis,
      metadata: {
        responseTime: metadata?.responseTime || 0,
        model: metadata?.model || 'gemini-2.5-pro',
        analysisType: selectedAnalysis,
        transactionCount: transactions.length,
        tokensUsed: metadata?.tokensUsed,
        promptDetails: metadata?.promptDetails
      }
    }

    setResult(finalResult)
    onAnalysisComplete?.(analysis, finalResult.metadata)
  }

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card className="hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Enhanced AI Analysis voor WKR Transacties
          </CardTitle>
          <CardDescription>
            Gebruik geavanceerde AI met document-enhanced analyse voor nauwkeurige WKR inzichten
            ({transactions?.length || 0} transacties)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Analysis Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Analyse Type</Label>
            <Select value={selectedAnalysis} onValueChange={setSelectedAnalysis}>
              <SelectTrigger>
                <SelectValue placeholder="Kies een analyse type" />
              </SelectTrigger>
              <SelectContent>
                {analysisTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-start gap-3 py-2">
                        <Icon className="h-4 w-4 mt-0.5 text-blue-600" />
                        <div className="flex-1">
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

          {/* Selected Type Features */}
          {selectedType && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <selectedType.icon className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">{selectedType.title}</h4>
                  <p className="text-sm text-blue-700 mb-3">{selectedType.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedType.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          {selectedAnalysis === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Prompt</Label>
              <Textarea
                placeholder="Beschrijf specifiek wat je wilt analyseren in de WKR context..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Vermeld specifieke WKR-aspecten zoals categorieën, vrijstellingen, of berekeningen
              </p>
            </div>
          )}

          {/* Settings - Only show debug toggle in debug mode */}
          {isDebugMode && (
            <div className="grid grid-cols-1 gap-4">
              {/* Debug Toggle - Only visible with ?debug=true */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <div>
                    <Label htmlFor="debug-mode" className="text-sm font-medium">
                      Debug Informatie
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Toon prompt details en metadata
                    </p>
                  </div>
                </div>
                <Switch
                  id="debug-mode"
                  checked={showPromptDebugger}
                  onCheckedChange={setShowPromptDebugger}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Streaming Analysis Output */}
      {useStreaming ? (
        <StreamingOutput
          transactions={transactions}
          analysisType={selectedAnalysis}
          prompt={selectedAnalysis === 'custom' ? customPrompt : undefined}
          onComplete={handleAnalysisComplete}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>Non-streaming modus is nog niet geïmplementeerd.</p>
            <p className="text-sm mt-2">Gebruik streaming voor de beste ervaring.</p>
          </CardContent>
        </Card>
      )}

      {/* Prompt Debugger - Only show in debug mode */}
      {isDebugMode && (
        <PromptDebugger
          promptDetails={result?.metadata?.promptDetails}
          isVisible={showPromptDebugger && !!result?.metadata?.promptDetails}
        />
      )}
    </div>
  )
}