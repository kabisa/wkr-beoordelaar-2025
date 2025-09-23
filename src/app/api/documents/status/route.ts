import { NextRequest, NextResponse } from 'next/server'
import { GeminiWithDocuments } from '@/lib/ai/gemini-with-docs'
import { DocumentValidator } from '@/lib/documents/document-validator'

export async function GET(request: NextRequest) {
  try {
    // Check API key
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API configuratie ontbreekt' },
        { status: 500 }
      )
    }

    // Create document manager
    const geminiWithDocs = new GeminiWithDocuments(apiKey)

    // Get comprehensive status
    const [documentStatus, localValidation] = await Promise.all([
      geminiWithDocs.getDocumentStatus(),
      DocumentValidator.validateLocalDocuments()
    ])

    // Validate uploaded documents if they exist
    let uploadValidation = {
      isValid: false,
      documentsCount: 0,
      errors: ['No documents uploaded yet']
    }

    let contentValidation = {
      isValid: false,
      contentChecks: []
    }

    if (documentStatus.documentsAvailable > 0) {
      const [uploadVal, contentVal] = await Promise.all([
        DocumentValidator.validateUploadedDocuments(geminiWithDocs['documentManager']),
        DocumentValidator.validateDocumentContent(geminiWithDocs['documentManager'])
      ])
      uploadValidation = uploadVal
      contentValidation = contentVal
    }

    // Generate validation report
    const validationReport = DocumentValidator.formatValidationReport(
      localValidation,
      uploadValidation,
      contentValidation
    )

    const overallStatus = {
      ready: localValidation.overallValid && uploadValidation.isValid && contentValidation.isValid,
      localDocuments: localValidation.overallValid,
      uploadedDocuments: uploadValidation.isValid,
      contentAccessible: contentValidation.isValid
    }

    return NextResponse.json({
      success: true,
      data: {
        status: overallStatus,
        documentStatus,
        localValidation,
        uploadValidation,
        contentValidation,
        validationReport,
        lastChecked: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Document status check error:', error)

    return NextResponse.json(
      {
        error: 'Fout bij ophalen document status',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()

    // Check API key
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API configuratie ontbreekt' },
        { status: 500 }
      )
    }

    const geminiWithDocs = new GeminiWithDocuments(apiKey)

    switch (action) {
      case 'refresh':
        console.log('🔄 Refreshing documents...')
        await geminiWithDocs.refreshDocuments()
        const refreshedStatus = await geminiWithDocs.getDocumentStatus()

        return NextResponse.json({
          success: true,
          data: {
            message: 'Documents refreshed successfully',
            status: refreshedStatus,
            timestamp: new Date().toISOString()
          }
        })

      case 'validate':
        console.log('🔍 Validating documents...')
        const isValid = await geminiWithDocs.validateDocuments()

        return NextResponse.json({
          success: true,
          data: {
            isValid,
            message: isValid ? 'All documents are accessible' : 'Some documents are not accessible',
            timestamp: new Date().toISOString()
          }
        })

      case 'cleanup':
        console.log('🗑️ Cleaning up remote documents...')
        const deletedCount = await geminiWithDocs.cleanupDocuments()

        return NextResponse.json({
          success: true,
          data: {
            deletedCount,
            message: `Cleaned up ${deletedCount} remote documents`,
            timestamp: new Date().toISOString()
          }
        })

      case 'list':
        console.log('📋 Listing remote documents...')
        const remoteFiles = await geminiWithDocs.listRemoteDocuments()

        return NextResponse.json({
          success: true,
          data: {
            remoteFiles,
            count: remoteFiles.length,
            timestamp: new Date().toISOString()
          }
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Document action error:', error)

    return NextResponse.json(
      {
        error: 'Fout bij uitvoeren document actie',
        details: error.message
      },
      { status: 500 }
    )
  }
}