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
  Eye,
  BarChart3
} from 'lucide-react'

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
  const [showFilterDetails, setShowFilterDetails] = useState(false)
  const [fullData, setFullData] = useState<{ transactions: any[], accounts: any[] } | null>(null)
  const [isLoadingFullData, setIsLoadingFullData] = useState(false)

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
      setShowFilterDetails(true)

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

      {/* Sample Data Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sample Accounts */}
        {sampleAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voorbeeld Rekeningen</CardTitle>
              <CardDescription>
                Eerste {sampleAccounts.length} van {summary?.accounts} rekeningen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sampleAccounts.slice(0, 5).map((account: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-sm">{account.id}</p>
                      <p className="text-xs text-gray-600">{account.name}</p>
                    </div>
                    <Badge variant={account.type === 'P' ? 'default' : 'secondary'}>
                      {account.type === 'P' ? 'W&V' : 'Balans'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sample Transactions */}
        {sampleTransactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voorbeeld Transacties</CardTitle>
              <CardDescription>
                Eerste {sampleTransactions.length} van {summary?.transactions} transacties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sampleTransactions.slice(0, 3).map((transaction: any, index: number) => (
                  <div key={index} className="p-3 bg-gray-50 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-sm">#{transaction.transactionNumber}</p>
                        <p className="text-xs text-gray-600">{transaction.description}</p>
                      </div>
                      <Badge variant="outline">{transaction.date}</Badge>
                    </div>

                    {transaction.lines && transaction.lines.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {transaction.lines.slice(0, 2).map((line: any, lineIndex: number) => (
                          <div key={lineIndex} className="flex justify-between text-xs">
                            <span className="text-gray-600">{line.accountId} - {line.description}</span>
                            <span className={`font-mono ${line.amountType === 'D' ? 'text-red-600' : 'text-green-600'}`}>
                              {line.amountType === 'D' ? '-' : '+'} €{Math.abs(line.amount).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {transaction.lines.length > 2 && (
                          <p className="text-xs text-gray-400">... en {transaction.lines.length - 2} meer regels</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Technical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Technische informatie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-sm text-gray-600">Parser gebruikt</h4>
              <p className="text-sm">{summary?.parserUsed === 'optimized' ? 'Geoptimaliseerd (groot bestand)' : 'Standaard'}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-600">XAF versie</h4>
              <p className="text-sm">{summary?.xafVersion || 'Onbekend'}</p>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-600">Sessie ID</h4>
              <p className="text-xs font-mono text-gray-400">{data.sessionId}</p>
            </div>
          </div>

          {stats?.successRate !== undefined && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-sm text-gray-600">Systeemprestaties</h4>
                <span className="text-sm text-green-600">
                  {stats.successRate.toFixed(1)}% success rate
                </span>
              </div>
              <Progress value={stats.successRate} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* WKR Filtering Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-blue-500" />
            WKR Filtering (Story 4)
          </CardTitle>
          <CardDescription>
            Filter transacties voor Nederlandse Werkkostenregeling analyse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filter Controls */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleWKRFilter}
                disabled={isFiltering || isLoadingFullData}
                className="flex items-center gap-2"
              >
                {isFiltering || isLoadingFullData ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {isLoadingFullData ? 'Data laden...' : 'Filteren...'}
                  </>
                ) : (
                  <>
                    <Filter className="h-4 w-4" />
                    Start WKR Filtering
                  </>
                )}
              </Button>

              {filterResult && (
                <Button
                  variant="outline"
                  onClick={() => setShowFilterDetails(!showFilterDetails)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  {showFilterDetails ? 'Verberg Details' : 'Toon Details'}
                </Button>
              )}
            </div>

            {/* Filter Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">XAF bestand succesvol geparseerd</span>
                {fullDataAvailable && (
                  <Badge variant="outline" className="text-xs">
                    Grote dataset - {summary?.transactions?.toLocaleString()} transacties
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {filterResult ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Timer className="h-4 w-4 text-orange-500" />
                )}
                <span className="text-sm">
                  {filterResult ? 'WKR filtering voltooid' : 'Klaar voor WKR filtering'}
                </span>
                {fullDataAvailable && !fullData && !fullTransactions && (
                  <Badge variant="secondary" className="text-xs">
                    Volledige data wordt geladen bij filtering
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Klaar voor AI analyse (Story 5)</span>
              </div>
            </div>

            {/* Filter Error */}
            {filterError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Fout bij filteren: {filterError}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filter Results */}
      {filterResult && showFilterDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
              WKR Filter Resultaten
            </CardTitle>
            <CardDescription>
              Gefilterde transacties voor WKR analyse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Filter Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{filterResult.stats?.totalFiltered || 0}</p>
                  <p className="text-sm text-blue-700">Gefilterde regels</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{filterResult.stats?.filterRatio || '0'}%</p>
                  <p className="text-sm text-green-700">Filter ratio</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">
                    €{filterResult.stats?.totalAmount?.toLocaleString('nl-NL') || '0'}
                  </p>
                  <p className="text-sm text-purple-700">Totaal bedrag</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{filterResult.stats?.processingTime || 0}ms</p>
                  <p className="text-sm text-orange-700">Verwerkingstijd</p>
                </div>
              </div>

              {/* Filter Summary */}
              {filterResult.summary && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Samenvatting</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{filterResult.summary}</pre>
                </div>
              )}

              {/* Sample Filtered Data */}
              {filterResult.filtered && filterResult.filtered.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Voorbeeld gefilterde transacties</h4>
                  <div className="space-y-2">
                    {filterResult.filtered.slice(0, 5).map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-white border rounded">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.grootboek}</p>
                          <p className="text-xs text-gray-600">{item.boeking}</p>
                          {item.filterReason && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {item.filterReason}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm">€{item.bedrag?.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{item.datum}</p>
                        </div>
                      </div>
                    ))}
                    {filterResult.filtered.length > 5 && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        ... en {filterResult.filtered.length - 5} meer gefilterde transacties
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Download Options */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}