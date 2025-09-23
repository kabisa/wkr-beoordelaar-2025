export interface WKRAnalysisRequest {
  transactions: FilteredTransaction[]
  companyInfo?: {
    name: string
    kvkNumber?: string
    fiscalYear: number
  }
  analysisType: 'standard' | 'compliance' | 'detailed'
  includeCalculations: boolean
}

export interface WKRAnalysisResponse {
  summary: string
  findings: WKRFinding[]
  exemptions: WKRExemption[]
  calculations: WKRCalculations
  recommendations: string[]
  confidence: number
}

export interface WKRFinding {
  transactionId: string
  accountId: string
  description: string
  amount: number
  isWKRRelevant: boolean
  confidence: number
  reasoning: string
  exemptionApplied?: string
}

export interface WKRExemption {
  type: string
  description: string
  applicableTransactions: string[]
  totalAmount: number
  legalReference: string
}

export interface WKRCalculations {
  totalWageSum: number
  freeSpace: number
  usedSpace: number
  usagePercentage: number
  remainingSpace: number
}

export interface FilteredTransaction {
  grootboek: string
  boeking: string
  bedrag: number
  datum: string
  accountId: string
  transactionId: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number
}

export class ResponseParsingError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'ResponseParsingError'
  }
}