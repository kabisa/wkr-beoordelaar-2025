import fs from 'fs/promises'
import path from 'path'
import { WKRDocumentManager } from './file-manager'

export interface ValidationResult {
  filename: string
  isValid: boolean
  errors?: string[]
  warnings?: string[]
  metadata?: {
    size: number
    lastModified: Date
  }
}

export interface DocumentValidationSummary {
  totalFiles: number
  validFiles: number
  invalidFiles: number
  warnings: number
  results: ValidationResult[]
  overallValid: boolean
}

export class DocumentValidator {
  static async validateLocalDocuments(): Promise<DocumentValidationSummary> {
    const results: ValidationResult[] = []
    const requiredFiles = ['wkr1.pdf', 'wkr2.pdf']
    const documentsPath = path.join(process.cwd(), 'plan')

    console.log('🔍 Validating local WKR documents...')

    for (const filename of requiredFiles) {
      const result = await this.validateLocalDocument(filename, documentsPath)
      results.push(result)
    }

    const validFiles = results.filter(r => r.isValid).length
    const invalidFiles = results.filter(r => !r.isValid).length
    const warnings = results.reduce((sum, r) => sum + (r.warnings?.length || 0), 0)

    const summary: DocumentValidationSummary = {
      totalFiles: results.length,
      validFiles,
      invalidFiles,
      warnings,
      results,
      overallValid: invalidFiles === 0
    }

    console.log(
      `📊 Validation complete: ${validFiles}/${results.length} valid, ${warnings} warnings`
    )

    return summary
  }

  private static async validateLocalDocument(
    filename: string,
    documentsPath: string
  ): Promise<ValidationResult> {
    const filePath = path.join(documentsPath, filename)

    try {
      const stats = await fs.stat(filePath)

      if (!stats.isFile()) {
        return {
          filename,
          isValid: false,
          errors: [`${filename} is not a file`]
        }
      }

      if (stats.size === 0) {
        return {
          filename,
          isValid: false,
          errors: [`${filename} is empty`]
        }
      }

      // Size limit check (Gemini supports files up to 2GB, but we use 100MB practical limit)
      if (stats.size > 100 * 1024 * 1024) {
        return {
          filename,
          isValid: false,
          errors: ['File too large (>100MB). Consider splitting the document.']
        }
      }

      const warnings: string[] = []

      // Check if file is likely a WKR document based on filename
      if (!filename.toLowerCase().includes('wkr')) {
        warnings.push('Filename does not indicate WKR content')
      }

      // Check file age
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
      if (ageInDays > 365) {
        warnings.push(`Document is over 1 year old (${Math.round(ageInDays)} days)`)
      }

      // Check if file is very small (might not contain much content)
      if (stats.size < 10 * 1024) { // Less than 10KB
        warnings.push('File is very small and may not contain substantial content')
      }

      console.log(`✅ ${filename}: Valid (${Math.round(stats.size / 1024)}KB)`)

      return {
        filename,
        isValid: true,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          size: stats.size,
          lastModified: stats.mtime
        }
      }

    } catch (error) {
      console.error(`❌ ${filename}: Validation failed -`, error instanceof Error ? error.message : 'Unknown error')

      return {
        filename,
        isValid: false,
        errors: [`Failed to access document: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  static async validateUploadedDocuments(documentManager: WKRDocumentManager): Promise<{
    isValid: boolean
    documentsCount: number
    errors: string[]
  }> {
    console.log('🔍 Validating uploaded documents...')

    try {
      const isAccessible = await documentManager.validateDocumentAccess()
      const documentInfo = await documentManager.getDocumentInfo()

      if (!isAccessible) {
        return {
          isValid: false,
          documentsCount: 0,
          errors: ['Documents are not accessible in Gemini']
        }
      }

      if (documentInfo.length === 0) {
        return {
          isValid: false,
          documentsCount: 0,
          errors: ['No documents found in cache']
        }
      }

      const errors: string[] = []

      // Check if all required documents are present
      const requiredDocs = ['wkr1.pdf', 'wkr2.pdf']
      const uploadedDocs = documentInfo.map(doc => doc.filename)

      for (const required of requiredDocs) {
        if (!uploadedDocs.includes(required)) {
          errors.push(`Required document missing: ${required}`)
        }
      }

      // Check document age
      const oldDocuments = documentInfo.filter(doc => {
        const ageInHours = (Date.now() - doc.uploadedAt.getTime()) / (1000 * 60 * 60)
        return ageInHours > 48 // Older than 48 hours
      })

      if (oldDocuments.length > 0) {
        errors.push(`${oldDocuments.length} documents are older than 48 hours`)
      }

      console.log(
        `📊 Upload validation: ${documentInfo.length} documents, ${errors.length} errors`
      )

      return {
        isValid: errors.length === 0,
        documentsCount: documentInfo.length,
        errors
      }

    } catch (error) {
      console.error('❌ Failed to validate uploaded documents:', error)

      return {
        isValid: false,
        documentsCount: 0,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  static async validateDocumentContent(documentManager: WKRDocumentManager): Promise<{
    isValid: boolean
    contentChecks: Array<{
      check: string
      passed: boolean
      details?: string
    }>
  }> {
    console.log('🔍 Validating document content accessibility...')

    const checks: Array<{
      check: string
      passed: boolean
      details?: string
    }> = [
      { check: 'Documents initialized', passed: false },
      { check: 'Document access working', passed: false },
      { check: 'Cache file readable', passed: false },
      { check: 'Required documents present', passed: false }
    ]

    try {
      // Check 1: Can initialize documents
      const documentInfo = await documentManager.getDocumentInfo()
      checks[0].passed = documentInfo.length > 0
      checks[0].details = `${documentInfo.length} documents found`

      // Check 2: Can access documents
      const isAccessible = await documentManager.validateDocumentAccess()
      checks[1].passed = isAccessible
      checks[1].details = isAccessible ? 'All documents accessible' : 'Some documents inaccessible'

      // Check 3: Cache is working
      try {
        const cacheExists = documentInfo.length > 0 && documentInfo[0].uploadedAt
        checks[2].passed = !!cacheExists
        checks[2].details = cacheExists ? 'Cache working correctly' : 'Cache not functioning'
      } catch {
        checks[2].passed = false
        checks[2].details = 'Cache read failed'
      }

      // Check 4: Required documents
      const requiredDocs = ['wkr1.pdf', 'wkr2.pdf']
      const uploadedDocs = documentInfo.map(doc => doc.filename)
      const missingDocs = requiredDocs.filter(doc => !uploadedDocs.includes(doc))

      checks[3].passed = missingDocs.length === 0
      checks[3].details = missingDocs.length === 0
        ? 'All required documents present'
        : `Missing: ${missingDocs.join(', ')}`

      const allPassed = checks.every(check => check.passed)

      console.log(
        `📊 Content validation: ${checks.filter(c => c.passed).length}/${checks.length} checks passed`
      )

      return {
        isValid: allPassed,
        contentChecks: checks
      }

    } catch (error) {
      console.error('❌ Content validation failed:', error)

      return {
        isValid: false,
        contentChecks: checks.map(check => ({
          ...check,
          passed: false,
          details: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }))
      }
    }
  }

  static formatValidationReport(
    localValidation: DocumentValidationSummary,
    uploadValidation: { isValid: boolean; documentsCount: number; errors: string[] },
    contentValidation: { isValid: boolean; contentChecks: Array<{ check: string; passed: boolean; details?: string }> }
  ): string {
    const lines = [
      '# WKR Document Validation Report',
      '',
      `**Generated:** ${new Date().toLocaleString('nl-NL')}`,
      '',
      '## Local Documents',
      `- **Total files:** ${localValidation.totalFiles}`,
      `- **Valid files:** ${localValidation.validFiles}`,
      `- **Invalid files:** ${localValidation.invalidFiles}`,
      `- **Warnings:** ${localValidation.warnings}`,
      `- **Overall status:** ${localValidation.overallValid ? '✅ Valid' : '❌ Invalid'}`,
      ''
    ]

    if (localValidation.results.length > 0) {
      lines.push('### File Details')
      for (const result of localValidation.results) {
        const status = result.isValid ? '✅' : '❌'
        const size = result.metadata ? ` (${Math.round(result.metadata.size / 1024)}KB)` : ''
        lines.push(`- **${result.filename}** ${status}${size}`)

        if (result.errors) {
          result.errors.forEach(error => lines.push(`  - ❌ ${error}`))
        }
        if (result.warnings) {
          result.warnings.forEach(warning => lines.push(`  - ⚠️ ${warning}`))
        }
      }
      lines.push('')
    }

    lines.push(
      '## Uploaded Documents',
      `- **Documents count:** ${uploadValidation.documentsCount}`,
      `- **Upload status:** ${uploadValidation.isValid ? '✅ Valid' : '❌ Invalid'}`,
      ''
    )

    if (uploadValidation.errors.length > 0) {
      lines.push('### Upload Issues')
      uploadValidation.errors.forEach(error => lines.push(`- ❌ ${error}`))
      lines.push('')
    }

    lines.push(
      '## Content Validation',
      `- **Content status:** ${contentValidation.isValid ? '✅ Valid' : '❌ Invalid'}`,
      ''
    )

    if (contentValidation.contentChecks.length > 0) {
      lines.push('### Content Checks')
      for (const check of contentValidation.contentChecks) {
        const status = check.passed ? '✅' : '❌'
        lines.push(`- **${check.check}** ${status}`)
        if (check.details) {
          lines.push(`  - ${check.details}`)
        }
      }
      lines.push('')
    }

    const overallValid = localValidation.overallValid && uploadValidation.isValid && contentValidation.isValid
    lines.push(
      '## Overall Status',
      `**${overallValid ? '✅ All validations passed' : '❌ Some validations failed'}**`,
      '',
      overallValid
        ? 'Documents are ready for use in WKR analysis.'
        : 'Please resolve the issues above before proceeding with document-enhanced analysis.'
    )

    return lines.join('\n')
  }
}