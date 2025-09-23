// XAF (XML Audit Files) Type Definitions for Dutch Standard

export interface XAFHeader {
  fiscalYear: string
  startDate: string
  endDate: string
  curCode: string
  dateCreated: string
  softwareDesc: string
  softwareVersion: string
  companyID?: string
  taxRegIdent?: string
  companyName?: string
}

export interface XAFCompany {
  companyIdent: string
  companyName: string
  taxRegistrationCountry: string
  taxRegIdent: string
  streetAddressLine1?: string
  city?: string
  postalCode?: string
  region?: string
  country?: string
  website?: string
  commerceRegIdent?: string
  email?: string
  fax?: string
  telephone?: string
}

export interface XAFAccount {
  id: string
  name: string
  type: 'P' | 'B' // P = Profit & Loss, B = Balance Sheet
  standardAccountID?: string
  groupingCategory?: string
  accountCreationDate?: string
  openingDebitBalance?: number
  openingCreditBalance?: number
  closingDebitBalance?: number
  closingCreditBalance?: number
}

export interface XAFTransactionLine {
  lineNumber: number
  accountId: string
  accountName?: string
  description: string
  amount: number
  amountType: 'D' | 'C' // Debit or Credit
  effectiveDate: string
  documentReference?: string
  customerID?: string
  supplierID?: string
  systemEntryDate?: string
  systemEntryTime?: string
  glPostingDate?: string
  recordID?: string
}

export interface XAFTransaction {
  transactionNumber: string
  description: string
  date: string
  lines: XAFTransactionLine[]
  journal: string
  period: number
  transactionType?: string
  systemEntryDate?: string
  systemEntryTime?: string
  glPostingDate?: string
  sourceDocumentID?: string
}

export interface XAFJournal {
  journalID: string
  description: string
  journalType: 'S' | 'P' | 'G' // S = Sales, P = Purchase, G = General
  transactions: XAFTransaction[]
}

export interface XAFCustomer {
  customerID: string
  accountID: string
  customerTaxID?: string
  companyName?: string
  contact?: string
  telephone?: string
  fax?: string
  email?: string
  website?: string
  streetAddressLine1?: string
  streetAddressLine2?: string
  city?: string
  postalCode?: string
  region?: string
  country?: string
  bankAccount?: string
  customerSinceDate?: string
  openingDebitBalance?: number
  openingCreditBalance?: number
  closingDebitBalance?: number
  closingCreditBalance?: number
}

export interface XAFSupplier {
  supplierID: string
  accountID: string
  supplierTaxID?: string
  companyName?: string
  contact?: string
  telephone?: string
  fax?: string
  email?: string
  website?: string
  streetAddressLine1?: string
  streetAddressLine2?: string
  city?: string
  postalCode?: string
  region?: string
  country?: string
  bankAccount?: string
  supplierSinceDate?: string
  openingDebitBalance?: number
  openingCreditBalance?: number
  closingDebitBalance?: number
  closingCreditBalance?: number
}

export interface XAFMetadata {
  fileSize: number
  numberOfTransactions: number
  numberOfAccounts: number
  numberOfCustomers?: number
  numberOfSuppliers?: number
  dateRange: {
    earliest: string
    latest: string
  }
  parseTime: number
  xafVersion?: string
  namespace?: string
}

export interface ParsedXAF {
  header: XAFHeader
  company: XAFCompany
  accounts: XAFAccount[]
  transactions: XAFTransaction[]
  journals: XAFJournal[]
  customers?: XAFCustomer[]
  suppliers?: XAFSupplier[]
  metadata: XAFMetadata
}

// Parser configuration options
export interface XAFParserOptions {
  ignoreAttributes: boolean
  parseAttributeValue: boolean
  trimValues: boolean
  processEntities: boolean
  maxFileSize?: number // in bytes
  validateSchema?: boolean
  preserveOrder?: boolean
}

// Error types for XAF parsing
export class XAFParseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error,
    public context?: any
  ) {
    super(message)
    this.name = 'XAFParseError'
  }
}

export class XAFValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public value?: any,
    public context?: any
  ) {
    super(message)
    this.name = 'XAFValidationError'
  }
}

// Raw XML structure interfaces (for internal parsing)
export interface RawXAFStructure {
  auditfile: {
    header: any
    company: any & {
      generalLedger?: {
        ledgerAccount: any | any[]
      }
      transactions?: {
        linesCount?: string
        totalDebit?: string
        totalCredit?: string
        journal: any | any[]
      }
    }
    generalLedgerAccounts?: {
      generalLedgerAccount: any | any[]
    }
    generalLedger?: {
      ledgerAccount: any | any[]
    }
    customers?: {
      customer: any | any[]
    }
    suppliers?: {
      supplier: any | any[]
    }
    transactions: {
      linesCount?: string
      totalDebit?: string
      totalCredit?: string
      journal: any | any[]
    }
  }
}