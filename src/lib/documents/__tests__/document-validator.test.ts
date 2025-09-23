import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { DocumentValidator } from '../document-validator'
import fs from 'fs/promises'
import path from 'path'

// Mock fs module
jest.mock('fs/promises')
const mockFs = fs as jest.Mocked<typeof fs>

describe('DocumentValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateLocalDocuments', () => {
    test('should validate existing documents successfully', async () => {
      // Mock successful file access
      mockFs.stat = jest.fn().mockImplementation((filePath: string) => {
        const filename = path.basename(filePath as string)
        return Promise.resolve({
          isFile: () => true,
          size: filename === 'wkr1.pdf' ? 200457 : 103185,
          mtime: new Date('2023-09-22T10:37:00Z')
        })
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.totalFiles).toBe(2)
      expect(result.validFiles).toBe(2)
      expect(result.invalidFiles).toBe(0)
      expect(result.overallValid).toBe(true)
      expect(result.results).toHaveLength(2)

      const wkr1Result = result.results.find(r => r.filename === 'wkr1.pdf')
      expect(wkr1Result?.isValid).toBe(true)
      expect(wkr1Result?.metadata?.size).toBe(200457)
    })

    test('should detect missing files', async () => {
      // Mock file not found
      mockFs.stat = jest.fn().mockRejectedValue(new Error('ENOENT: no such file or directory'))

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.totalFiles).toBe(2)
      expect(result.validFiles).toBe(0)
      expect(result.invalidFiles).toBe(2)
      expect(result.overallValid).toBe(false)

      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(false)
        expect(fileResult.errors?.[0]).toContain('Failed to access document')
      })
    })

    test('should detect empty files', async () => {
      mockFs.stat = jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 0,
        mtime: new Date()
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.overallValid).toBe(false)
      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(false)
        expect(fileResult.errors).toContain(`${fileResult.filename} is empty`)
      })
    })

    test('should detect files that are too large', async () => {
      mockFs.stat = jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 150 * 1024 * 1024, // 150MB
        mtime: new Date()
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.overallValid).toBe(false)
      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(false)
        expect(fileResult.errors).toContain('File too large (>100MB). Consider splitting the document.')
      })
    })

    test('should warn about old documents', async () => {
      const oldDate = new Date()
      oldDate.setFullYear(oldDate.getFullYear() - 2) // 2 years ago

      mockFs.stat = jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 50000,
        mtime: oldDate
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.overallValid).toBe(true) // Still valid, just warnings
      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(true)
        expect(fileResult.warnings?.some(warning => warning.includes('Document is over 1 year old'))).toBe(true)
      })
    })

    test('should warn about very small files', async () => {
      mockFs.stat = jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 5000, // 5KB - very small
        mtime: new Date()
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.overallValid).toBe(true)
      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(true)
        expect(fileResult.warnings).toContain('File is very small and may not contain substantial content')
      })
    })

    test('should handle directories instead of files', async () => {
      mockFs.stat = jest.fn().mockResolvedValue({
        isFile: () => false, // It's a directory
        size: 4096,
        mtime: new Date()
      })

      const result = await DocumentValidator.validateLocalDocuments()

      expect(result.overallValid).toBe(false)
      result.results.forEach(fileResult => {
        expect(fileResult.isValid).toBe(false)
        expect(fileResult.errors).toContain(`${fileResult.filename} is not a file`)
      })
    })
  })

  describe('validateUploadedDocuments', () => {
    test('should validate accessible uploaded documents', async () => {
      const mockDocumentManager = {
        validateDocumentAccess: jest.fn().mockResolvedValue(true),
        getDocumentInfo: jest.fn().mockResolvedValue([
          {
            filename: 'wkr1.pdf',
            displayName: 'WKR Deel 1',
            sizeBytes: 200457,
            uploadedAt: new Date()
          },
          {
            filename: 'wkr2.pdf',
            displayName: 'WKR Deel 2',
            sizeBytes: 103185,
            uploadedAt: new Date()
          }
        ])
      }

      const result = await DocumentValidator.validateUploadedDocuments(mockDocumentManager as any)

      expect(result.isValid).toBe(true)
      expect(result.documentsCount).toBe(2)
      expect(result.errors).toHaveLength(0)
    })

    test('should detect inaccessible documents', async () => {
      const mockDocumentManager = {
        validateDocumentAccess: jest.fn().mockResolvedValue(false),
        getDocumentInfo: jest.fn().mockResolvedValue([])
      }

      const result = await DocumentValidator.validateUploadedDocuments(mockDocumentManager as any)

      expect(result.isValid).toBe(false)
      expect(result.documentsCount).toBe(0)
      expect(result.errors).toContain('Documents are not accessible in Gemini')
    })

    test('should detect missing required documents', async () => {
      const mockDocumentManager = {
        validateDocumentAccess: jest.fn().mockResolvedValue(true),
        getDocumentInfo: jest.fn().mockResolvedValue([
          {
            filename: 'wkr1.pdf',
            displayName: 'WKR Deel 1',
            sizeBytes: 200457,
            uploadedAt: new Date()
          }
          // Missing wkr2.pdf
        ])
      }

      const result = await DocumentValidator.validateUploadedDocuments(mockDocumentManager as any)

      expect(result.isValid).toBe(false)
      expect(result.documentsCount).toBe(1)
      expect(result.errors).toContain('Required document missing: wkr2.pdf')
    })

    test('should detect old uploaded documents', async () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 3) // 3 days ago

      const mockDocumentManager = {
        validateDocumentAccess: jest.fn().mockResolvedValue(true),
        getDocumentInfo: jest.fn().mockResolvedValue([
          {
            filename: 'wkr1.pdf',
            displayName: 'WKR Deel 1',
            sizeBytes: 200457,
            uploadedAt: oldDate
          },
          {
            filename: 'wkr2.pdf',
            displayName: 'WKR Deel 2',
            sizeBytes: 103185,
            uploadedAt: oldDate
          }
        ])
      }

      const result = await DocumentValidator.validateUploadedDocuments(mockDocumentManager as any)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('2 documents are older than 48 hours')
    })
  })

  describe('validateDocumentContent', () => {
    test('should validate document content access successfully', async () => {
      const mockDocumentManager = {
        getDocumentInfo: jest.fn().mockResolvedValue([
          { filename: 'wkr1.pdf', uploadedAt: new Date() },
          { filename: 'wkr2.pdf', uploadedAt: new Date() }
        ]),
        validateDocumentAccess: jest.fn().mockResolvedValue(true)
      }

      const result = await DocumentValidator.validateDocumentContent(mockDocumentManager as any)

      expect(result.isValid).toBe(true)
      expect(result.contentChecks).toHaveLength(4)

      const passedChecks = result.contentChecks.filter(check => check.passed)
      expect(passedChecks).toHaveLength(4)
    })

    test('should detect content access issues', async () => {
      const mockDocumentManager = {
        getDocumentInfo: jest.fn().mockResolvedValue([]),
        validateDocumentAccess: jest.fn().mockResolvedValue(false)
      }

      const result = await DocumentValidator.validateDocumentContent(mockDocumentManager as any)

      expect(result.isValid).toBe(false)

      const failedChecks = result.contentChecks.filter(check => !check.passed)
      expect(failedChecks.length).toBeGreaterThan(0)
    })
  })

  describe('formatValidationReport', () => {
    test('should format comprehensive validation report', () => {
      const localValidation = {
        totalFiles: 2,
        validFiles: 2,
        invalidFiles: 0,
        warnings: 1,
        results: [
          {
            filename: 'wkr1.pdf',
            isValid: true,
            warnings: ['Test warning'],
            metadata: { size: 200457, lastModified: new Date() }
          },
          {
            filename: 'wkr2.pdf',
            isValid: true,
            metadata: { size: 103185, lastModified: new Date() }
          }
        ],
        overallValid: true
      }

      const uploadValidation = {
        isValid: true,
        documentsCount: 2,
        errors: []
      }

      const contentValidation = {
        isValid: true,
        contentChecks: [
          { check: 'Documents initialized', passed: true, details: '2 documents found' },
          { check: 'Document access working', passed: true, details: 'All documents accessible' }
        ]
      }

      const report = DocumentValidator.formatValidationReport(
        localValidation,
        uploadValidation,
        contentValidation
      )

      expect(report).toContain('# WKR Document Validation Report')
      expect(report).toContain('✅ All validations passed')
      expect(report).toContain('wkr1.pdf')
      expect(report).toContain('wkr2.pdf')
      expect(report).toContain('Test warning')
      expect(report).toContain('Documents are ready for use')
    })

    test('should format report with validation failures', () => {
      const localValidation = {
        totalFiles: 2,
        validFiles: 1,
        invalidFiles: 1,
        warnings: 0,
        results: [
          {
            filename: 'wkr1.pdf',
            isValid: true,
            metadata: { size: 200457, lastModified: new Date() }
          },
          {
            filename: 'wkr2.pdf',
            isValid: false,
            errors: ['File not found']
          }
        ],
        overallValid: false
      }

      const uploadValidation = {
        isValid: false,
        documentsCount: 1,
        errors: ['Required document missing: wkr2.pdf']
      }

      const contentValidation = {
        isValid: false,
        contentChecks: [
          { check: 'Documents initialized', passed: false, details: 'Initialization failed' }
        ]
      }

      const report = DocumentValidator.formatValidationReport(
        localValidation,
        uploadValidation,
        contentValidation
      )

      expect(report).toContain('❌ Some validations failed')
      expect(report).toContain('File not found')
      expect(report).toContain('Required document missing')
      expect(report).toContain('Please resolve the issues above')
    })
  })
})