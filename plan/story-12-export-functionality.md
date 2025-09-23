# Story 12: Export Functionaliteit

**Sprint:** 4
**Estimate:** 1-2 dagen
**Priority:** Medium

## User Story
Als gebruiker wil ik mijn WKR analyse kunnen exporteren naar verschillende formaten zodat ik de resultaten kan delen, printen of archiveren.

## Acceptatiecriteria
- [x] Markdown export
- [x] PDF generatie
- [x] Excel/CSV export voor data
- [x] Download functionaliteit
- [x] Branded report templates
- [x] Custom export configuratie
- [x] Batch export opties

## Export Architecture

### Export Service
```typescript
// src/lib/export/export-service.ts
export interface ExportOptions {
  format: 'markdown' | 'pdf' | 'excel' | 'csv' | 'json'
  includeCharts: boolean
  includeTables: boolean
  includeRawData: boolean
  template?: 'standard' | 'detailed' | 'summary'
  branding?: {
    companyName?: string
    logo?: string
    colors?: {
      primary: string
      secondary: string
    }
  }
}

export interface ExportResult {
  filename: string
  blob: Blob
  size: number
  downloadUrl: string
}

export class WKRExportService {
  async exportAnalysis(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    switch (options.format) {
      case 'markdown':
        return this.exportMarkdown(analysis, transactions, options)
      case 'pdf':
        return this.exportPDF(analysis, transactions, options)
      case 'excel':
        return this.exportExcel(analysis, transactions, options)
      case 'csv':
        return this.exportCSV(analysis, transactions, options)
      case 'json':
        return this.exportJSON(analysis, transactions, options)
      default:
        throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  private async exportMarkdown(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const template = new MarkdownTemplate(options.template)
    const content = template.generate(analysis, transactions, options)

    const blob = new Blob([content], { type: 'text/markdown' })
    const filename = this.generateFilename('wkr-analysis', 'md')

    return {
      filename,
      blob,
      size: blob.size,
      downloadUrl: URL.createObjectURL(blob)
    }
  }

  private async exportPDF(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const htmlTemplate = new HTMLTemplate(options.template)
    const htmlContent = htmlTemplate.generate(analysis, transactions, options)

    // Convert HTML to PDF using a PDF library
    const pdfBuffer = await this.htmlToPDF(htmlContent, options)
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const filename = this.generateFilename('wkr-analysis', 'pdf')

    return {
      filename,
      blob,
      size: blob.size,
      downloadUrl: URL.createObjectURL(blob)
    }
  }

  private async exportExcel(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const excelGenerator = new ExcelGenerator()
    const workbook = excelGenerator.createWorkbook(analysis, transactions, options)

    const blob = await workbook.writeToBuffer()
    const filename = this.generateFilename('wkr-analysis', 'xlsx')

    return {
      filename,
      blob: new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      size: blob.length,
      downloadUrl: URL.createObjectURL(new Blob([blob]))
    }
  }

  private async exportCSV(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const csvGenerator = new CSVGenerator()
    const content = csvGenerator.generateTransactionCSV(analysis, transactions)

    const blob = new Blob([content], { type: 'text/csv' })
    const filename = this.generateFilename('wkr-transactions', 'csv')

    return {
      filename,
      blob,
      size: blob.size,
      downloadUrl: URL.createObjectURL(blob)
    }
  }

  private async exportJSON(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const exportData = {
      analysis,
      transactions: options.includeRawData ? transactions : null,
      metadata: {
        exportDate: new Date().toISOString(),
        options,
        version: '1.0.0'
      }
    }

    const content = JSON.stringify(exportData, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const filename = this.generateFilename('wkr-analysis', 'json')

    return {
      filename,
      blob,
      size: blob.size,
      downloadUrl: URL.createObjectURL(blob)
    }
  }

  private generateFilename(prefix: string, extension: string): string {
    const date = new Date().toISOString().split('T')[0]
    const timestamp = new Date().toTimeString().split(' ')[0].replace(/:/g, '-')
    return `${prefix}-${date}-${timestamp}.${extension}`
  }

  private async htmlToPDF(htmlContent: string, options: ExportOptions): Promise<ArrayBuffer> {
    // This would use a library like Puppeteer or jsPDF
    // For now, returning a placeholder
    throw new Error('PDF generation not implemented yet')
  }
}
```

### Markdown Template Generator
```typescript
// src/lib/export/templates/markdown-template.ts
export class MarkdownTemplate {
  constructor(private templateType: string = 'standard') {}

  generate(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): string {
    const sections = [
      this.generateHeader(options.branding),
      this.generateSummary(analysis),
      this.generateFindings(analysis.findings),
      this.generateCalculations(analysis.calculations),
      this.generateExemptions(analysis.exemptions),
      this.generateRecommendations(analysis.recommendations),
      options.includeRawData ? this.generateTransactionTable(transactions) : '',
      this.generateFooter()
    ]

    return sections.filter(Boolean).join('\n\n---\n\n')
  }

  private generateHeader(branding?: ExportOptions['branding']): string {
    const companyName = branding?.companyName || 'Company'
    const date = new Date().toLocaleDateString('nl-NL')

    return `# WKR Analyse Rapport

**Bedrijf:** ${companyName}
**Datum:** ${date}
**Gegenereerd door:** WKR Beoordelaar 2025

`
  }

  private generateSummary(analysis: WKRAnalysisResponse): string {
    return `## Samenvatting

${analysis.summary}

**Totale zekerheid:** ${analysis.confidence}%

`
  }

  private generateFindings(findings: WKRFinding[]): string {
    const wkrRelevant = findings.filter(f => f.isWKRRelevant)
    const notRelevant = findings.filter(f => !f.isWKRRelevant)

    let content = `## Bevindingen

### WKR Relevante Transacties (${wkrRelevant.length})

| Account | Beschrijving | Bedrag | Zekerheid | Redenering |
|---------|--------------|--------|-----------|------------|
`

    wkrRelevant.forEach(finding => {
      content += `| ${finding.accountId} | ${finding.description} | €${finding.amount.toFixed(2)} | ${finding.confidence}% | ${finding.reasoning} |\n`
    })

    content += `\n### Niet WKR Relevante Transacties (${notRelevant.length})

| Account | Beschrijving | Bedrag | Zekerheid | Redenering |
|---------|--------------|--------|-----------|------------|
`

    notRelevant.slice(0, 10).forEach(finding => { // Limit to 10 for brevity
      content += `| ${finding.accountId} | ${finding.description} | €${finding.amount.toFixed(2)} | ${finding.confidence}% | ${finding.reasoning} |\n`
    })

    if (notRelevant.length > 10) {
      content += `\n*Nog ${notRelevant.length - 10} transacties niet getoond...*\n`
    }

    return content
  }

  private generateCalculations(calculations: WKRCalculations): string {
    const usagePercentage = calculations.usagePercentage.toFixed(1)
    const isOverLimit = calculations.usagePercentage > 100

    return `## Berekeningen

### Vrije Ruimte Overzicht

- **Loonsom:** €${calculations.totalWageSum.toFixed(2)}
- **Vrije ruimte (1,7%):** €${calculations.freeSpace.toFixed(2)}
- **Gebruikt:** €${calculations.usedSpace.toFixed(2)}
- **Resterend:** €${calculations.remainingSpace.toFixed(2)}
- **Verbruik:** ${usagePercentage}%

${isOverLimit ? `
⚠️ **WAARSCHUWING:** Vrije ruimte overschreden met €${(calculations.usedSpace - calculations.freeSpace).toFixed(2)}

Dit betekent dat het overschot als loon belast wordt bij de werknemers.
` : ''}

${calculations.usagePercentage > 80 && !isOverLimit ? `
💡 **TIP:** U nadert de limiet van uw vrije ruimte. Overweeg gerichte vrijstellingen.
` : ''}

`
  }

  private generateExemptions(exemptions: WKRExemption[]): string {
    if (!exemptions || exemptions.length === 0) {
      return `## Vrijstellingen

Geen specifieke vrijstellingen geïdentificeerd.

`
    }

    let content = `## Vrijstellingen

### Geïdentificeerde Vrijstellingen

| Type | Beschrijving | Bedrag | Potentiële Besparing |
|------|--------------|--------|---------------------|
`

    exemptions.forEach(exemption => {
      content += `| ${exemption.type} | ${exemption.description} | €${exemption.totalAmount.toFixed(2)} | €${(exemption.totalAmount * 0.37).toFixed(2)} |\n`
    })

    const totalSavings = exemptions.reduce((sum, ex) => sum + ex.totalAmount * 0.37, 0)
    content += `\n**Totale potentiële besparing:** €${totalSavings.toFixed(2)}\n`

    return content
  }

  private generateRecommendations(recommendations: string[]): string {
    if (!recommendations || recommendations.length === 0) {
      return `## Aanbevelingen

Geen specifieke aanbevelingen op dit moment.

`
    }

    let content = `## Aanbevelingen

`

    recommendations.forEach((rec, index) => {
      content += `${index + 1}. ${rec}\n`
    })

    return content
  }

  private generateTransactionTable(transactions: FilteredTransaction[]): string {
    let content = `## Ruwe Transactiegegevens

| Grootboek | Boeking | Bedrag | Datum |
|-----------|---------|--------|-------|
`

    transactions.forEach(tx => {
      content += `| ${tx.grootboek} | ${tx.boeking} | €${tx.bedrag.toFixed(2)} | ${tx.datum} |\n`
    })

    return content
  }

  private generateFooter(): string {
    return `## Disclaimer

Dit rapport is gegenereerd door WKR Beoordelaar 2025 en dient als indicatie voor WKR compliance.
Voor definitieve belastingadvies dient u altijd een belastingadviseur te raadplegen.

**Gegenereerd op:** ${new Date().toLocaleString('nl-NL')}

`
  }
}
```

### PDF Generator
```typescript
// src/lib/export/generators/pdf-generator.ts
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

export class PDFGenerator {
  async generatePDF(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): Promise<ArrayBuffer> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Add company branding
    this.addHeader(doc, options.branding)

    // Add title
    doc.setFontSize(20)
    doc.text('WKR Analyse Rapport', 20, 40)

    // Add date
    doc.setFontSize(12)
    doc.text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, 20, 50)

    let yPosition = 70

    // Add summary section
    yPosition = this.addSection(doc, 'Samenvatting', analysis.summary, yPosition)

    // Add calculations section
    yPosition = this.addCalculationsSection(doc, analysis.calculations, yPosition)

    // Add findings section (top findings only for space)
    yPosition = this.addFindingsSection(doc, analysis.findings.slice(0, 10), yPosition)

    // Add recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      yPosition = this.addRecommendationsSection(doc, analysis.recommendations, yPosition)
    }

    // Add footer
    this.addFooter(doc)

    return doc.output('arraybuffer')
  }

  private addHeader(doc: jsPDF, branding?: ExportOptions['branding']): void {
    // Add company logo if provided
    if (branding?.logo) {
      // doc.addImage(branding.logo, 'PNG', 150, 10, 40, 20)
    }

    // Add company name
    if (branding?.companyName) {
      doc.setFontSize(14)
      doc.text(branding.companyName, 20, 20)
    }
  }

  private addSection(doc: jsPDF, title: string, content: string, yPosition: number): number {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(16)
    doc.text(title, 20, yPosition)
    yPosition += 10

    doc.setFontSize(11)
    const lines = doc.splitTextToSize(content, 170)
    doc.text(lines, 20, yPosition)

    return yPosition + lines.length * 5 + 10
  }

  private addCalculationsSection(doc: jsPDF, calculations: WKRCalculations, yPosition: number): number {
    yPosition = this.addSection(doc, 'Berekeningen', '', yPosition)

    doc.setFontSize(11)
    const calculationLines = [
      `Loonsom: €${calculations.totalWageSum.toFixed(2)}`,
      `Vrije ruimte: €${calculations.freeSpace.toFixed(2)}`,
      `Gebruikt: €${calculations.usedSpace.toFixed(2)}`,
      `Verbruik: ${calculations.usagePercentage.toFixed(1)}%`,
    ]

    calculationLines.forEach(line => {
      doc.text(line, 25, yPosition)
      yPosition += 7
    })

    if (calculations.usagePercentage > 100) {
      doc.setTextColor(255, 0, 0)
      doc.text('⚠️ WAARSCHUWING: Vrije ruimte overschreden', 25, yPosition)
      doc.setTextColor(0, 0, 0)
      yPosition += 7
    }

    return yPosition + 10
  }

  private addFindingsSection(doc: jsPDF, findings: WKRFinding[], yPosition: number): number {
    yPosition = this.addSection(doc, 'Belangrijkste Bevindingen', '', yPosition)

    doc.setFontSize(10)
    findings.forEach(finding => {
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }

      const status = finding.isWKRRelevant ? '✓ WKR Relevant' : '✗ Niet Relevant'
      doc.text(`${status} - €${finding.amount.toFixed(2)} (${finding.confidence}%)`, 25, yPosition)
      yPosition += 5

      const description = doc.splitTextToSize(finding.description, 160)
      doc.text(description, 30, yPosition)
      yPosition += description.length * 4 + 3
    })

    return yPosition + 10
  }

  private addRecommendationsSection(doc: jsPDF, recommendations: string[], yPosition: number): number {
    yPosition = this.addSection(doc, 'Aanbevelingen', '', yPosition)

    doc.setFontSize(11)
    recommendations.forEach((rec, index) => {
      if (yPosition > 270) {
        doc.addPage()
        yPosition = 20
      }

      const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, 170)
      doc.text(lines, 25, yPosition)
      yPosition += lines.length * 5 + 3
    })

    return yPosition + 10
  }

  private addFooter(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages()

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.text(
        `Gegenereerd door WKR Beoordelaar 2025 - Pagina ${i} van ${pageCount}`,
        20,
        285
      )
    }
  }
}
```

### Excel Generator
```typescript
// src/lib/export/generators/excel-generator.ts
import * as XLSX from 'xlsx'

export class ExcelGenerator {
  createWorkbook(
    analysis: WKRAnalysisResponse,
    transactions: FilteredTransaction[],
    options: ExportOptions
  ): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new()

    // Summary sheet
    const summarySheet = this.createSummarySheet(analysis)
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Samenvatting')

    // Findings sheet
    const findingsSheet = this.createFindingsSheet(analysis.findings)
    XLSX.utils.book_append_sheet(workbook, findingsSheet, 'Bevindingen')

    // Calculations sheet
    const calculationsSheet = this.createCalculationsSheet(analysis.calculations)
    XLSX.utils.book_append_sheet(workbook, calculationsSheet, 'Berekeningen')

    // Transactions sheet (if requested)
    if (options.includeRawData) {
      const transactionsSheet = this.createTransactionsSheet(transactions)
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacties')
    }

    // Exemptions sheet (if available)
    if (analysis.exemptions && analysis.exemptions.length > 0) {
      const exemptionsSheet = this.createExemptionsSheet(analysis.exemptions)
      XLSX.utils.book_append_sheet(workbook, exemptionsSheet, 'Vrijstellingen')
    }

    return workbook
  }

  private createSummarySheet(analysis: WKRAnalysisResponse): XLSX.WorkSheet {
    const data = [
      ['WKR Analyse Samenvatting'],
      [''],
      ['Gegenereerd op:', new Date().toLocaleDateString('nl-NL')],
      ['Totale zekerheid:', `${analysis.confidence}%`],
      [''],
      ['Samenvatting:'],
      [analysis.summary],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { width: 20 },
      { width: 50 }
    ]

    return worksheet
  }

  private createFindingsSheet(findings: WKRFinding[]): XLSX.WorkSheet {
    const headers = [
      'Account ID',
      'Beschrijving',
      'Bedrag',
      'WKR Relevant',
      'Zekerheid (%)',
      'Redenering'
    ]

    const data = [headers, ...findings.map(finding => [
      finding.accountId,
      finding.description,
      finding.amount,
      finding.isWKRRelevant ? 'Ja' : 'Nee',
      finding.confidence,
      finding.reasoning
    ])]

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { width: 12 },
      { width: 40 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 50 }
    ]

    return worksheet
  }

  private createCalculationsSheet(calculations: WKRCalculations): XLSX.WorkSheet {
    const data = [
      ['WKR Berekeningen'],
      [''],
      ['Loonsom', calculations.totalWageSum],
      ['Vrije ruimte (1.7%)', calculations.freeSpace],
      ['Gebruikt', calculations.usedSpace],
      ['Resterend', calculations.remainingSpace],
      ['Verbruik percentage', `${calculations.usagePercentage.toFixed(1)}%`],
      [''],
      ['Status', calculations.usagePercentage > 100 ? 'OVERSCHRIJDING' : 'BINNEN LIMIET']
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 },
      { width: 15 }
    ]

    return worksheet
  }

  private createTransactionsSheet(transactions: FilteredTransaction[]): XLSX.WorkSheet {
    const headers = [
      'Grootboek',
      'Boeking',
      'Bedrag',
      'Datum',
      'Account ID'
    ]

    const data = [headers, ...transactions.map(tx => [
      tx.grootboek,
      tx.boeking,
      tx.bedrag,
      tx.datum,
      tx.accountId
    ])]

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { width: 25 },
      { width: 50 },
      { width: 12 },
      { width: 12 },
      { width: 12 }
    ]

    return worksheet
  }

  private createExemptionsSheet(exemptions: WKRExemption[]): XLSX.WorkSheet {
    const headers = [
      'Type',
      'Beschrijving',
      'Totaal Bedrag',
      'Wettelijke Basis'
    ]

    const data = [headers, ...exemptions.map(ex => [
      ex.type,
      ex.description,
      ex.totalAmount,
      ex.legalReference
    ])]

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Set column widths
    worksheet['!cols'] = [
      { width: 20 },
      { width: 40 },
      { width: 15 },
      { width: 30 }
    ]

    return worksheet
  }

  async writeToBuffer(): Promise<ArrayBuffer> {
    return XLSX.write(this.workbook, {
      bookType: 'xlsx',
      type: 'array'
    })
  }
}
```

### Export UI Components
```tsx
// src/components/export/ExportDialog.tsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Download, FileText, Table, Image } from 'lucide-react'
import { WKRExportService, ExportOptions } from '@/lib/export/export-service'

interface ExportDialogProps {
  analysis: WKRAnalysisResponse
  transactions: FilteredTransaction[]
  trigger?: React.ReactNode
}

export function ExportDialog({ analysis, transactions, trigger }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeCharts: true,
    includeTables: true,
    includeRawData: false,
    template: 'standard',
    branding: {
      companyName: '',
      colors: {
        primary: '#3b82f6',
        secondary: '#10b981'
      }
    }
  })

  const exportService = new WKRExportService()

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const result = await exportService.exportAnalysis(analysis, transactions, options)

      // Trigger download
      const link = document.createElement('a')
      link.href = result.downloadUrl
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Cleanup
      URL.revokeObjectURL(result.downloadUrl)

      setIsOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      // Show error message
    } finally {
      setIsExporting(false)
    }
  }

  const formatOptions = [
    { value: 'pdf', label: 'PDF Document', icon: FileText },
    { value: 'markdown', label: 'Markdown', icon: FileText },
    { value: 'excel', label: 'Excel Spreadsheet', icon: Table },
    { value: 'csv', label: 'CSV Data', icon: Table },
    { value: 'json', label: 'JSON Data', icon: FileText },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export Analysis
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export WKR Analysis</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Export Format</Label>
            <RadioGroup
              value={options.format}
              onValueChange={(value) => setOptions(prev => ({ ...prev, format: value as any }))}
            >
              {formatOptions.map(format => (
                <div key={format.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={format.value} id={format.value} />
                  <Label htmlFor={format.value} className="flex items-center gap-2">
                    <format.icon className="h-4 w-4" />
                    {format.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Content Options */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Include Content</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCharts"
                  checked={options.includeCharts}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeCharts: !!checked }))
                  }
                />
                <Label htmlFor="includeCharts">Charts and visualizations</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeTables"
                  checked={options.includeTables}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeTables: !!checked }))
                  }
                />
                <Label htmlFor="includeTables">Data tables</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeRawData"
                  checked={options.includeRawData}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, includeRawData: !!checked }))
                  }
                />
                <Label htmlFor="includeRawData">Raw transaction data</Label>
              </div>
            </div>
          </div>

          {/* Branding Options */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Branding (Optional)</Label>
            <div className="space-y-2">
              <Input
                placeholder="Company name"
                value={options.branding?.companyName || ''}
                onChange={(e) =>
                  setOptions(prev => ({
                    ...prev,
                    branding: { ...prev.branding, companyName: e.target.value }
                  }))
                }
              />
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Bulk Export Component
```tsx
// src/components/export/BulkExportComponent.tsx
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Download, Package } from 'lucide-react'

interface BulkExportProps {
  analysis: WKRAnalysisResponse
  transactions: FilteredTransaction[]
}

export function BulkExportComponent({ analysis, transactions }: BulkExportProps) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['pdf'])
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const formats = [
    { id: 'pdf', label: 'PDF Report', description: 'Complete analysis report' },
    { id: 'excel', label: 'Excel Workbook', description: 'Data in spreadsheet format' },
    { id: 'csv', label: 'CSV Data', description: 'Transaction data only' },
    { id: 'markdown', label: 'Markdown', description: 'Text-based report' },
    { id: 'json', label: 'JSON Data', description: 'Raw structured data' },
  ]

  const handleBulkExport = async () => {
    setIsExporting(true)
    setProgress(0)

    const exportService = new WKRExportService()
    const results = []

    for (let i = 0; i < selectedFormats.length; i++) {
      const format = selectedFormats[i]

      try {
        const result = await exportService.exportAnalysis(analysis, transactions, {
          format: format as any,
          includeCharts: true,
          includeTables: true,
          includeRawData: format === 'csv' || format === 'json',
          template: 'standard'
        })

        results.push(result)
        setProgress(((i + 1) / selectedFormats.length) * 100)
      } catch (error) {
        console.error(`Failed to export ${format}:`, error)
      }
    }

    // Create ZIP file with all exports
    const zip = new JSZip()

    for (const result of results) {
      zip.file(result.filename, result.blob)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const downloadUrl = URL.createObjectURL(zipBlob)

    // Trigger download
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `wkr-analysis-bundle-${new Date().toISOString().split('T')[0]}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Cleanup
    URL.revokeObjectURL(downloadUrl)
    results.forEach(result => URL.revokeObjectURL(result.downloadUrl))

    setIsExporting(false)
    setProgress(0)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Bulk Export
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-3">
            Select multiple formats to export in a single ZIP file
          </p>

          <div className="space-y-2">
            {formats.map(format => (
              <div key={format.id} className="flex items-center space-x-2">
                <Checkbox
                  id={format.id}
                  checked={selectedFormats.includes(format.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedFormats(prev => [...prev, format.id])
                    } else {
                      setSelectedFormats(prev => prev.filter(f => f !== format.id))
                    }
                  }}
                />
                <div>
                  <Label htmlFor={format.id} className="font-medium">
                    {format.label}
                  </Label>
                  <p className="text-xs text-gray-500">{format.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {isExporting && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-gray-600">
              Exporting {selectedFormats.length} formats... {Math.round(progress)}%
            </p>
          </div>
        )}

        <Button
          onClick={handleBulkExport}
          disabled={selectedFormats.length === 0 || isExporting}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting...' : `Export ${selectedFormats.length} Format(s)`}
        </Button>
      </CardContent>
    </Card>
  )
}
```

## API Integration

### Export API Endpoint
```typescript
// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WKRExportService } from '@/lib/export/export-service'

export async function POST(request: NextRequest) {
  try {
    const { analysis, transactions, options } = await request.json()

    const exportService = new WKRExportService()
    const result = await exportService.exportAnalysis(analysis, transactions, options)

    return NextResponse.json({
      success: true,
      filename: result.filename,
      size: result.size,
      downloadUrl: result.downloadUrl
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "html2canvas": "^1.4.1",
    "xlsx": "^0.18.5",
    "jszip": "^3.10.1"
  }
}
```

## Definition of Done
- [ ] Alle export formaten geïmplementeerd
- [ ] Download functionaliteit werkend
- [ ] Branded templates beschikbaar
- [ ] Bulk export optie
- [ ] Progress indicators tijdens export
- [ ] Error handling bij export failures
- [ ] File size optimalisatie
- [ ] Cross-browser compatibility

## Performance Targets
- PDF generatie: <5 seconden
- Excel generatie: <3 seconden
- File size: <5MB voor complete export
- Memory usage: <100MB tijdens export
- Concurrent exports: Tot 3 gelijktijdig