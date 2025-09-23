import { NextRequest, NextResponse } from 'next/server'
import { TransactionFilter } from '@/lib/filters/transaction-filter'
import { OptimizedTransactionFilter } from '@/lib/filters/optimized-filter'
import { WKRTransformer } from '@/lib/transformers/wkr-transformer'
import { FilterConfigManager } from '@/lib/config/filter-config'
import {
  FilterRules,
  FilterConfiguration,
  FilterError,
  DEFAULT_WKR_FILTER_RULES
} from '@/types/filter'
import { XAFTransaction, XAFAccount } from '@/types/xaf'

export async function POST(request: NextRequest) {
  const startTime = performance.now()

  try {
    const body = await request.json()
    const {
      transactions,
      accounts = [],
      filterConfig,
      useOptimized = true,
      format = 'json'
    } = body

    // Validate input
    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json(
        {
          error: 'Ongeldige transactie data',
          details: 'Transactions moet een array zijn'
        },
        { status: 400 }
      )
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          error: 'Geen transacties om te filteren',
          details: 'De transactie array is leeg'
        },
        { status: 400 }
      )
    }

    // Determine filter rules
    let rules: FilterRules = DEFAULT_WKR_FILTER_RULES

    if (filterConfig) {
      if (typeof filterConfig === 'string') {
        // Load by name
        const configManager = new FilterConfigManager()
        const config = configManager.loadConfiguration(filterConfig)
        if (config) {
          rules = config.rules
        }
      } else if (filterConfig.rules) {
        // Direct configuration object
        rules = filterConfig.rules
      }
    }

    // Choose filter implementation based on dataset size and user preference
    const shouldUseOptimized = useOptimized || transactions.length > 1000
    const filter = shouldUseOptimized
      ? new OptimizedTransactionFilter(rules)
      : new TransactionFilter(rules)

    const transformer = new WKRTransformer()

    // Apply filtering with progress tracking for large datasets
    let filtered: any[]

    if (shouldUseOptimized && filter instanceof OptimizedTransactionFilter) {
      if (transactions.length > 10000) {
        // Use batch processing for very large datasets
        filtered = await filter.filterTransactionsBatchOptimized(
          transactions as XAFTransaction[],
          accounts as XAFAccount[],
          1000
        )
      } else {
        // Use standard optimized filtering
        filtered = await filter.filterTransactionsBatch(
          transactions as XAFTransaction[],
          accounts as XAFAccount[]
        )
      }
    } else {
      // Use standard filtering
      filtered = filter.filterTransactions(
        transactions as XAFTransaction[],
        accounts as XAFAccount[]
      )
    }

    // Calculate processing time
    const processingTime = performance.now() - startTime

    // Calculate statistics
    const totalInputLines = transactions.reduce(
      (sum: number, tx: XAFTransaction) => sum + tx.lines.length,
      0
    )

    const stats = transformer.calculateStats(filtered, totalInputLines)

    // Generate different output formats
    const tableFormat = transformer.transformToTableFormat(filtered)
    const csvFormat = transformer.transformToCSV(filtered)
    const summaryText = transformer.generateSummaryText(stats)

    // Prepare response based on requested format
    const responseData: any = {
      success: true,
      data: {
        filtered: format === 'minimal' ? filtered.slice(0, 100) : filtered,
        stats: {
          ...stats,
          processingTime: Math.round(processingTime),
          filterMethod: shouldUseOptimized ? 'optimized' : 'standard'
        },
        summary: summaryText
      }
    }

    // Include formatted data based on request
    if (format === 'table' || format === 'all') {
      responseData.data.tableFormat = tableFormat
    }

    if (format === 'csv' || format === 'all') {
      responseData.data.csvFormat = csvFormat
    }

    // Add download information for large datasets
    if (filtered.length > 1000) {
      responseData.data.downloadInfo = {
        recommendDownload: true,
        totalSize: filtered.length,
        sampleSize: format === 'minimal' ? 100 : filtered.length
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Filter API error:', error)

    // Handle specific filter errors
    if (error instanceof FilterError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.context
        },
        { status: 400 }
      )
    }

    // Handle generic errors
    return NextResponse.json(
      {
        error: 'Fout bij filteren van transacties',
        details: error instanceof Error ? error.message : 'Onbekende fout'
      },
      { status: 500 }
    )
  }
}

// GET endpoint for filter configurations and metadata
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const configManager = new FilterConfigManager()

    switch (action) {
      case 'list-configs':
        const configurations = configManager.listConfigurations()
        const predefined = configManager.getPredefinedConfigurations()

        return NextResponse.json({
          success: true,
          data: {
            saved: configurations,
            predefined: predefined.map(config => configManager.getConfigurationSummary(config))
          }
        })

      case 'get-config':
        const configName = searchParams.get('name')
        if (!configName) {
          return NextResponse.json(
            { error: 'Configuratie naam is verplicht' },
            { status: 400 }
          )
        }

        const config = configManager.loadConfiguration(configName)
        if (!config) {
          return NextResponse.json(
            { error: 'Configuratie niet gevonden' },
            { status: 404 }
          )
        }

        return NextResponse.json({
          success: true,
          data: config
        })

      case 'default-config':
        return NextResponse.json({
          success: true,
          data: configManager.getDefaultConfiguration()
        })

      case 'predefined-configs':
        return NextResponse.json({
          success: true,
          data: configManager.getPredefinedConfigurations()
        })

      default:
        return NextResponse.json({
          success: true,
          data: {
            endpoints: {
              'POST /api/filter': 'Filter transacties met opgegeven regels',
              'GET /api/filter?action=list-configs': 'Lijst van beschikbare configuraties',
              'GET /api/filter?action=get-config&name=X': 'Specifieke configuratie ophalen',
              'GET /api/filter?action=default-config': 'Standaard configuratie',
              'GET /api/filter?action=predefined-configs': 'Voorgedefinieerde configuraties'
            },
            version: '1.0.0',
            description: 'WKR Transaction Filtering API'
          }
        })
    }

  } catch (error) {
    console.error('Filter GET API error:', error)

    return NextResponse.json(
      {
        error: 'Fout bij ophalen van filter informatie',
        details: error instanceof Error ? error.message : 'Onbekende fout'
      },
      { status: 500 }
    )
  }
}

// PUT endpoint for saving filter configurations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { configuration } = body

    if (!configuration) {
      return NextResponse.json(
        { error: 'Configuratie data is verplicht' },
        { status: 400 }
      )
    }

    const configManager = new FilterConfigManager()

    // Validate and save configuration
    configManager.saveConfiguration(configuration as FilterConfiguration)

    return NextResponse.json({
      success: true,
      message: 'Configuratie succesvol opgeslagen',
      data: {
        name: configuration.name,
        savedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Filter PUT API error:', error)

    if (error instanceof FilterError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Fout bij opslaan van configuratie',
        details: error instanceof Error ? error.message : 'Onbekende fout'
      },
      { status: 500 }
    )
  }
}

// DELETE endpoint for removing filter configurations
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const configName = searchParams.get('name')

    if (!configName) {
      return NextResponse.json(
        { error: 'Configuratie naam is verplicht' },
        { status: 400 }
      )
    }

    const configManager = new FilterConfigManager()
    const success = configManager.deleteConfiguration(configName)

    if (!success) {
      return NextResponse.json(
        { error: 'Configuratie niet gevonden of kon niet worden verwijderd' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Configuratie succesvol verwijderd',
      data: {
        name: configName,
        deletedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Filter DELETE API error:', error)

    return NextResponse.json(
      {
        error: 'Fout bij verwijderen van configuratie',
        details: error instanceof Error ? error.message : 'Onbekende fout'
      },
      { status: 500 }
    )
  }
}