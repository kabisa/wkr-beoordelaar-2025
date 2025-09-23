import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand ontvangen' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['application/xml', 'text/xml']
    const allowedExtensions = ['.xaf', '.xml']

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: `Bestandstype niet ondersteund. Alleen ${allowedExtensions.join(', ')} bestanden toegestaan.` },
        { status: 400 }
      )
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024 // 100MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Bestand is te groot. Maximum 100MB toegestaan.' },
        { status: 400 }
      )
    }

    // Read file content
    const content = await file.text()

    // Basic XML validation
    if (!content.trim().startsWith('<?xml')) {
      return NextResponse.json(
        { error: 'Ongeldig XML bestand. Controleer of het bestand niet beschadigd is.' },
        { status: 400 }
      )
    }

    // Check for XAF-specific elements
    if (!content.includes('auditfile')) {
      return NextResponse.json(
        { error: 'Geen geldig XAF bestand. Het bestand mist de vereiste auditfile structuur.' },
        { status: 400 }
      )
    }

    // Extract basic metadata for quick validation
    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      uploadTime: new Date().toISOString(),
      hasTransactions: content.includes('<transaction'),
      hasAccounts: content.includes('<generalLedgerAccount'),
      contentPreview: content.substring(0, 500) + '...'
    }

    // Parse the XAF file immediately after upload
    try {
      const parseResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/parse`, {
        method: 'POST',
        body: formData
      })

      if (!parseResponse.ok) {
        const parseError = await parseResponse.json()
        return NextResponse.json(
          { error: `Parsing fout: ${parseError.error}` },
          { status: 400 }
        )
      }

      const parseResult = await parseResponse.json()

      return NextResponse.json({
        success: true,
        message: 'XAF bestand succesvol geüpload en geparseerd',
        data: parseResult.data,
        stats: parseResult.stats
      })

    } catch (parseError) {
      // If parsing fails, fall back to basic metadata
      console.warn('Parsing failed, falling back to basic metadata:', parseError)

      return NextResponse.json({
        success: true,
        message: 'XAF bestand geüpload (parsing gefaald)',
        data: {
          metadata,
          stats: {
            fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            estimatedTransactions: (content.match(/<transaction/g) || []).length,
            estimatedAccounts: (content.match(/<generalLedgerAccount/g) || []).length,
            parsingError: 'Parsing failed, using basic validation only'
          }
        }
      })
    }

  } catch (error) {
    console.error('Upload error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('XML')) {
        return NextResponse.json(
          { error: 'Fout bij het lezen van het XML bestand. Controleer of het bestand geldig is.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Interne serverfout bij het verwerken van het bestand' },
      { status: 500 }
    )
  }
}