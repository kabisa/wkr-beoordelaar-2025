'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  FileText,
  Building2,
  Calendar,
  Timer,
  Database,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Info,
  Filter,
  Download,
  Eye
} from 'lucide-react'

import AIAnalysisPanelEnhanced from '../ai/AIAnalysisPanelEnhanced'

interface ParseResultsProps {
  result: {
    success: boolean
    message: string
    data: {
      header?: any
      company?: any
      metadata?: any
      summary?: any
      sampleAccounts?: any[]
      sampleTransactions?: any[]
      sessionId?: string
      // Add full data access
      fullTransactions?: any[]
      fullAccounts?: any[]
      fullDataAvailable?: boolean
    }
    stats?: {
      processingStats?: any
      successRate?: number
      memoryUsage?: any
    }
  }
}

export function ParseResults({ result }: ParseResultsProps) {
  const [filterResult, setFilterResult] = useState<any>(null)
  const [isFiltering, setIsFiltering] = useState(false)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [fullData, setFullData] = useState<{ transactions: any[], accounts: any[] } | null>(null)
  const [isLoadingFullData, setIsLoadingFullData] = useState(false)

  // Automatically start WKR filtering when component mounts
  useEffect(() => {
    const autoStartFiltering = async () => {
      if (result.success && result.data && !filterResult && !isFiltering) {
        // Small delay to let the UI render first
        setTimeout(() => {
          handleWKRFilter()
        }, 500)
      }
    }

    autoStartFiltering()
  }, [result.success]) // Only run when result changes

  if (!result.success || !result.data) {
    return null
  }

  const { data, stats } = result
  const { header, company, metadata, summary, sampleAccounts = [], sampleTransactions = [], fullTransactions, fullAccounts, fullDataAvailable, sessionId } = data

  // Function to fetch full data when needed
  const fetchFullData = async () => {
    if (!sessionId || fullData || isLoadingFullData) return null

    setIsLoadingFullData(true)
    try {
      const response = await fetch(`/api/parse/${sessionId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch full data')
      }
      const fullDataResponse = await response.json()
      if (fullDataResponse.success) {
        const fetchedData = {
          transactions: fullDataResponse.data.transactions,
          accounts: fullDataResponse.data.accounts
        }
        setFullData(fetchedData)
        return fetchedData
      }
    } catch (error) {
      console.error('Error fetching full data:', error)
      setFilterError('Fout bij ophalen van volledige data')
    } finally {
      setIsLoadingFullData(false)
    }
    return null
  }

  const handleWKRFilter = async () => {
    setIsFiltering(true)
    setFilterError(null)

    try {
      // Determine which data to use for filtering
      let transactionsToFilter = sampleTransactions
      let accountsToFilter = sampleAccounts

      // If full data is already available in the response, use it
      if (fullTransactions && fullTransactions.length > 0) {
        transactionsToFilter = fullTransactions
        accountsToFilter = fullAccounts || sampleAccounts
      }
      // If we have a large dataset that needs to be fetched, fetch it first
      else if (fullDataAvailable && sessionId && !fullData && !isLoadingFullData) {
        const fetchedData = await fetchFullData()
        if (fetchedData) {
          transactionsToFilter = fetchedData.transactions || sampleTransactions
          accountsToFilter = fetchedData.accounts || sampleAccounts
        }
      }
      // If full data was already fetched, use it
      else if (fullData) {
        transactionsToFilter = (fullData as any).transactions || sampleTransactions
        accountsToFilter = (fullData as any).accounts || sampleAccounts
      }


      const response = await fetch('/api/filter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: transactionsToFilter,
          accounts: accountsToFilter,
          filterConfig: 'WKR 2025 Standaard',
          useOptimized: true,
          format: 'all'
        })
      })

      if (!response.ok) {
        throw new Error('Filtering failed')
      }

      const filterData = await response.json()
      setFilterResult(filterData.data)

    } catch (error) {
      setFilterError(error instanceof Error ? error.message : 'Onbekende fout bij filteren')
    } finally {
      setIsFiltering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Bestandsgrootte</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.fileSize}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Verwerkt in {summary?.parseTime}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Transacties</p>
                <p className="text-2xl font-bold text-green-600">{summary?.transactions?.toLocaleString()}</p>
              </div>
              <Database className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Verspreid over {summary?.journals} dagboeken
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rekeningen</p>
                <p className="text-2xl font-bold text-purple-600">{summary?.accounts?.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Grootboekrekeningen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Information */}
      {company && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bedrijfsinformatie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-600">Bedrijfsnaam</h4>
                <p className="text-lg font-semibold">{company.companyName}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600">BTW-nummer</h4>
                <p className="text-lg font-mono">{company.taxRegIdent}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600">KvK-nummer</h4>
                <p className="text-lg font-mono">{company.companyIdent}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600">Land</h4>
                <p className="text-lg">{company.taxRegistrationCountry}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Information */}
      {header && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Periode informatie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-600">Boekjaar</h4>
                <p className="text-lg font-semibold">{header.fiscalYear}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600">Periode</h4>
                <p className="text-lg">{header.startDate} - {header.endDate}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-600">Software</h4>
                <p className="text-lg">{header.softwareDesc} {header.softwareVersion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}



      {/* WKR Filtering Status - Hidden but show loading */}
      {(isFiltering || isLoadingFullData) && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3">
              <LoadingSpinner size="sm" />
              <span className="text-sm">
                {isLoadingFullData ? 'Data laden...' : 'WKR filtering wordt uitgevoerd...'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Error */}
      {filterError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Fout bij filteren: {filterError}
          </AlertDescription>
        </Alert>
      )}


      {/* Enhanced AI Analysis Panel - Only show after successful WKR filtering */}
      {filterResult && filterResult.filtered && filterResult.filtered.length > 0 && (
        <AIAnalysisPanelEnhanced
          transactions={filterResult.filtered}
          onAnalysisComplete={(analysis, metadata) => {
            console.log('AI Analysis completed:', { analysis, metadata })
          }}
        />
      )}
    </div>
  )
}