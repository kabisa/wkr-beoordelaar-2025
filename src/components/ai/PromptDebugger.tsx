'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Database, Settings, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PromptDetails {
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

interface PromptDebuggerProps {
  promptDetails?: PromptDetails
  isVisible?: boolean
}

export function PromptDebugger({ promptDetails, isVisible = false }: PromptDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  if (!isVisible || !promptDetails) {
    return null
  }

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section)
  }

  return (
    <Card className="mt-4 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-medium text-blue-900">
                  Prompt Details & Debug Info
                </CardTitle>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {promptDetails.documentsIncluded.length} PDF's • {promptDetails.fullTransactionDataLength} chars
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-blue-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-blue-600" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 pt-4">
            <CardDescription className="text-xs text-blue-700">
              Deze sectie toont de exacte prompt en context die naar Gemini AI is gestuurd
            </CardDescription>

            {/* PDF Documents */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('documents')}
                className="w-full justify-start text-blue-800 hover:bg-blue-100"
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF Documenten ({promptDetails.documentsIncluded.length})
                {activeSection === 'documents' ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Button>

              {activeSection === 'documents' && (
                <div className="rounded-lg bg-white p-3 border border-blue-200">
                  <div className="space-y-2">
                    {promptDetails.documentsIncluded.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded border">
                        <div>
                          <div className="font-mono text-xs text-blue-900">{doc.filename}</div>
                          <div className="text-xs text-blue-600">{doc.displayName}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {doc.size}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* System Instruction */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('system')}
                className="w-full justify-start text-blue-800 hover:bg-blue-100"
              >
                <Settings className="mr-2 h-4 w-4" />
                System Instruction
                {activeSection === 'system' ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Button>

              {activeSection === 'system' && (
                <div className="rounded-lg bg-white p-3 border border-blue-200">
                  <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {promptDetails.systemInstruction}
                  </pre>
                </div>
              )}
            </div>

            {/* Analysis Prompt */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('prompt')}
                className="w-full justify-start text-blue-800 hover:bg-blue-100"
              >
                <Database className="mr-2 h-4 w-4" />
                Analyse Prompt
                {activeSection === 'prompt' ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Button>

              {activeSection === 'prompt' && (
                <div className="rounded-lg bg-white p-3 border border-blue-200">
                  <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {promptDetails.analysisPrompt}
                  </pre>
                </div>
              )}
            </div>

            {/* Transaction Data Preview */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('data')}
                className="w-full justify-start text-blue-800 hover:bg-blue-100"
              >
                <Database className="mr-2 h-4 w-4" />
                Transactie Data Preview
                <Badge variant="outline" className="ml-2 text-xs">
                  {(promptDetails.fullTransactionDataLength / 1024).toFixed(1)}KB
                </Badge>
                {activeSection === 'data' ? (
                  <ChevronDown className="ml-auto h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4" />
                )}
              </Button>

              {activeSection === 'data' && (
                <div className="rounded-lg bg-white p-3 border border-blue-200">
                  <div className="text-xs text-blue-600 mb-2">
                    Eerste 500 karakters van {promptDetails.fullTransactionDataLength} totaal:
                  </div>
                  <pre className="text-xs text-blue-900 whitespace-pre-wrap font-mono leading-relaxed">
                    {promptDetails.transactionDataPreview}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  )
}