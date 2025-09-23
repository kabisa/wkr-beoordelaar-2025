import { XMLParser } from 'fast-xml-parser'
import {
  ParsedXAF,
  XAFParserOptions,
  XAFParseError,
  XAFValidationError,
  RawXAFStructure,
  XAFHeader,
  XAFCompany,
  XAFAccount,
  XAFTransaction,
  XAFTransactionLine,
  XAFJournal,
  XAFMetadata
} from '@/types/xaf'

export const DEFAULT_PARSER_OPTIONS: XAFParserOptions = {
  ignoreAttributes: false,
  parseAttributeValue: true,
  trimValues: true,
  processEntities: true,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  validateSchema: true,
  preserveOrder: false
}

export class XAFParser {
  private xmlParser: XMLParser
  private options: XAFParserOptions

  constructor(options: XAFParserOptions = DEFAULT_PARSER_OPTIONS) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options }
    this.xmlParser = new XMLParser({
      ignoreAttributes: this.options.ignoreAttributes,
      parseAttributeValue: this.options.parseAttributeValue,
      trimValues: this.options.trimValues,
      processEntities: this.options.processEntities,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseTagValue: true
    })
  }

  async parseXAF(fileContent: string): Promise<ParsedXAF> {
    const startTime = performance.now()

    try {
      // Pre-validation
      this.validateXMLStructure(fileContent)

      // Check file size
      if (this.options.maxFileSize && fileContent.length > this.options.maxFileSize) {
        throw new XAFParseError(
          `Bestand is te groot (${Math.round(fileContent.length / 1024 / 1024)}MB). Maximum ${Math.round(this.options.maxFileSize / 1024 / 1024)}MB toegestaan.`,
          'FILE_TOO_LARGE'
        )
      }

      // Parse XML
      const parsed: RawXAFStructure = this.xmlParser.parse(fileContent)

      if (this.options.validateSchema) {
        this.validateXAFSchema(parsed)
      }

      // Extract structured data
      const result = await this.extractXAFData(parsed, fileContent.length, performance.now() - startTime)

      return result

    } catch (error) {
      if (error instanceof XAFParseError || error instanceof XAFValidationError) {
        throw error
      }

      throw new XAFParseError(
        `XAF parsing mislukt: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        'PARSE_ERROR',
        error instanceof Error ? error : undefined
      )
    }
  }

  private validateXMLStructure(content: string): void {
    // Check for XML declaration
    if (!content.trim().startsWith('<?xml')) {
      throw new XAFValidationError('Ongeldig XML: XML declaratie ontbreekt')
    }

    // Check for XAF namespace
    if (!content.includes('auditfile')) {
      throw new XAFValidationError('Ongeldig XAF: auditfile root element ontbreekt')
    }

    // Basic well-formedness check (simplified)
    const openTags = (content.match(/<[^/!?][^>]*>/g) || []).length
    const closeTags = (content.match(/<\/[^>]*>/g) || []).length
    const selfClosingTags = (content.match(/<[^>]*\/>/g) || []).length

    if (openTags !== closeTags + selfClosingTags) {
      throw new XAFValidationError('Ongeldig XML: Tag structuur niet gebalanceerd')
    }
  }

  private validateXAFSchema(parsed: RawXAFStructure): void {
    if (!parsed.auditfile) {
      throw new XAFValidationError('Ongeldig XAF: auditfile root element ontbreekt')
    }

    const auditfile = parsed.auditfile

    // Check required sections
    const requiredSections = ['header', 'company']
    for (const section of requiredSections) {
      if (!auditfile[section as keyof typeof auditfile]) {
        throw new XAFValidationError(`Ongeldig XAF: Verplichte sectie '${section}' ontbreekt`)
      }
    }

    // Validate header
    if (!auditfile.header.fiscalYear) {
      throw new XAFValidationError('Ongeldig XAF: fiscalYear ontbreekt in header')
    }

    // Validate company
    if (!auditfile.company.companyIdent) {
      throw new XAFValidationError('Ongeldig XAF: companyIdent ontbreekt in company')
    }

    // Check for essential data
    if (!auditfile.generalLedgerAccounts && !auditfile.transactions) {
      throw new XAFValidationError('Ongeldig XAF: Geen rekeningen of transacties gevonden')
    }
  }

  private async extractXAFData(parsed: RawXAFStructure, fileSize: number, parseTime: number): Promise<ParsedXAF> {
    const auditfile = parsed.auditfile

    const header = this.extractHeader(auditfile.header)
    const company = this.extractCompany(auditfile.company)
    const accounts = this.extractAccounts(auditfile.generalLedgerAccounts)
    const { transactions, journals } = this.extractTransactions(auditfile.transactions, accounts)

    const metadata: XAFMetadata = {
      fileSize,
      numberOfTransactions: transactions.length,
      numberOfAccounts: accounts.length,
      dateRange: this.calculateDateRange(transactions),
      parseTime: Math.round(parseTime),
      xafVersion: this.extractXAFVersion(auditfile),
      namespace: this.extractNamespace(auditfile)
    }

    return {
      header,
      company,
      accounts,
      transactions,
      journals,
      metadata
    }
  }

  private extractHeader(headerData: any): XAFHeader {
    return {
      fiscalYear: this.safeString(headerData.fiscalYear),
      startDate: this.safeString(headerData.startDate),
      endDate: this.safeString(headerData.endDate),
      curCode: this.safeString(headerData.curCode, 'EUR'),
      dateCreated: this.safeString(headerData.dateCreated),
      softwareDesc: this.safeString(headerData.softwareDesc, 'Unknown'),
      softwareVersion: this.safeString(headerData.softwareVersion, '1.0'),
      companyID: this.safeString(headerData.companyID),
      taxRegIdent: this.safeString(headerData.taxRegIdent),
      companyName: this.safeString(headerData.companyName)
    }
  }

  private extractCompany(companyData: any): XAFCompany {
    return {
      companyIdent: this.safeString(companyData.companyIdent),
      companyName: this.safeString(companyData.companyName),
      taxRegistrationCountry: this.safeString(companyData.taxRegistrationCountry, 'NL'),
      taxRegIdent: this.safeString(companyData.taxRegIdent),
      streetAddressLine1: this.safeString(companyData.streetAddressLine1),
      city: this.safeString(companyData.city),
      postalCode: this.safeString(companyData.postalCode),
      region: this.safeString(companyData.region),
      country: this.safeString(companyData.country),
      website: this.safeString(companyData.website),
      commerceRegIdent: this.safeString(companyData.commerceRegIdent),
      email: this.safeString(companyData.email),
      fax: this.safeString(companyData.fax),
      telephone: this.safeString(companyData.telephone)
    }
  }

  private extractAccounts(accountsData: any): XAFAccount[] {
    if (!accountsData || !accountsData.generalLedgerAccount) {
      return []
    }

    const accounts = Array.isArray(accountsData.generalLedgerAccount)
      ? accountsData.generalLedgerAccount
      : [accountsData.generalLedgerAccount]

    return accounts.map((account: any) => ({
      id: this.safeString(account.accID),
      name: this.safeString(account.accDesc),
      type: this.safeString(account.accType, 'P') as 'P' | 'B',
      standardAccountID: this.safeString(account.standardAccountID),
      groupingCategory: this.safeString(account.groupingCategory),
      accountCreationDate: this.safeString(account.accountCreationDate),
      openingDebitBalance: this.safeNumber(account.openingDebitBalance),
      openingCreditBalance: this.safeNumber(account.openingCreditBalance),
      closingDebitBalance: this.safeNumber(account.closingDebitBalance),
      closingCreditBalance: this.safeNumber(account.closingCreditBalance)
    }))
  }

  private extractTransactions(transactionsData: any, accounts: XAFAccount[]): { transactions: XAFTransaction[]; journals: XAFJournal[] } {
    if (!transactionsData || !transactionsData.journal) {
      return { transactions: [], journals: [] }
    }

    const journals = Array.isArray(transactionsData.journal)
      ? transactionsData.journal
      : [transactionsData.journal]

    const allTransactions: XAFTransaction[] = []
    const extractedJournals: XAFJournal[] = []

    for (const journal of journals) {
      const journalTransactions = this.extractJournalTransactions(journal, accounts)

      extractedJournals.push({
        journalID: this.safeString(journal.jrnID),
        description: this.safeString(journal.desc),
        journalType: this.safeString(journal.jrnTp, 'G') as 'S' | 'P' | 'G',
        transactions: journalTransactions
      })

      allTransactions.push(...journalTransactions)
    }

    return { transactions: allTransactions, journals: extractedJournals }
  }

  private extractJournalTransactions(journal: any, accounts: XAFAccount[]): XAFTransaction[] {
    if (!journal.transaction) {
      return []
    }

    const transactions = Array.isArray(journal.transaction)
      ? journal.transaction
      : [journal.transaction]

    return transactions.map((transaction: any) => ({
      transactionNumber: this.safeString(transaction.nr),
      description: this.safeString(transaction.desc),
      date: this.safeString(transaction.trDt),
      journal: this.safeString(journal.jrnID),
      period: this.safeNumber(transaction.periodNumber, 1),
      transactionType: this.safeString(transaction.trTp),
      systemEntryDate: this.safeString(transaction.systemEntryDate),
      systemEntryTime: this.safeString(transaction.systemEntryTime),
      glPostingDate: this.safeString(transaction.glPostingDate),
      sourceDocumentID: this.safeString(transaction.sourceDocumentID),
      lines: this.extractTransactionLines(transaction.line, accounts)
    }))
  }

  private extractTransactionLines(linesData: any, accounts: XAFAccount[]): XAFTransactionLine[] {
    if (!linesData) {
      return []
    }

    const lines = Array.isArray(linesData) ? linesData : [linesData]

    return lines.map((line: any) => {
      const accountId = this.safeString(line.accID)
      const account = accounts.find(acc => acc.id === accountId)

      return {
        lineNumber: this.safeNumber(line.nr, 1),
        accountId,
        accountName: account?.name || this.safeString(line.accDesc),
        description: this.safeString(line.desc),
        amount: this.safeNumber(line.amnt, 0),
        amountType: this.safeString(line.amntTp, 'D') as 'D' | 'C',
        effectiveDate: this.safeString(line.effDate),
        documentReference: this.safeString(line.docRef),
        customerID: this.safeString(line.custID),
        supplierID: this.safeString(line.supplierID),
        systemEntryDate: this.safeString(line.systemEntryDate),
        systemEntryTime: this.safeString(line.systemEntryTime),
        glPostingDate: this.safeString(line.glPostingDate),
        recordID: this.safeString(line.recordID)
      }
    })
  }

  private calculateDateRange(transactions: XAFTransaction[]): { earliest: string; latest: string } {
    if (transactions.length === 0) {
      const today = new Date().toISOString().split('T')[0]
      return { earliest: today, latest: today }
    }

    const dates = transactions
      .map(t => t.date)
      .filter(date => date && date.length >= 10)
      .sort()

    return {
      earliest: dates[0] || new Date().toISOString().split('T')[0],
      latest: dates[dates.length - 1] || new Date().toISOString().split('T')[0]
    }
  }

  private extractXAFVersion(auditfile: any): string | undefined {
    // Try to extract version from attributes or elements
    return auditfile['@_version'] || auditfile.version || undefined
  }

  private extractNamespace(auditfile: any): string | undefined {
    // Try to extract namespace
    return auditfile['@_xmlns'] || auditfile.xmlns || undefined
  }

  // Utility methods for safe data extraction
  private safeString(value: any, defaultValue?: string): string {
    if (value === null || value === undefined) {
      return defaultValue || ''
    }
    return String(value).trim()
  }

  private safeNumber(value: any, defaultValue?: number): number {
    if (value === null || value === undefined) {
      return defaultValue || 0
    }
    const num = parseFloat(String(value))
    return isNaN(num) ? (defaultValue || 0) : num
  }
}