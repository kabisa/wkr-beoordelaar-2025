'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Building2,
  Calendar,
  Timer,
  Database,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Info
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
    }
    stats?: {
      processingStats?: any
      successRate?: number
      memoryUsage?: any
    }
  }
}

export function ParseResults({ result }: ParseResultsProps) {
  if (!result.success || !result.data) {
    return null
  }

  const { data, stats } = result
  const { header, company, metadata, summary, sampleAccounts = [], sampleTransactions = [] } = data

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

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Volgende stappen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">XAF bestand succesvol geparseerd</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Klaar voor WKR filtering (Story 4)</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-orange-500" />
              <span className="text-sm">Klaar voor AI analyse (Story 5)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}