import { FilteredTransaction } from '../../types/wkr-analysis'

export class WKRPromptBuilder {
  private static readonly BASE_PROMPT = `
Je bent een gespecialiseerde Nederlandse fiscalist met expertise in de werkkostenregeling (WKR).
Je analyseert boekhoudkundige transacties om te bepalen welke kosten onder de WKR vallen.

BELANGRIJK:
- Gebruik ALLEEN Nederlandse boekhoudterminologie
- Geef ALTIJD een zekerheidspercentage (0-100%)
- Verwijs naar specifieke WKR artikelen waar relevant
- GEBRUIK NOOIT HET INTERNET OM TE ZOEKEN
- Baseer je analyse uitsluitend op de verstrekte context en je kennis

Voor elke boeking bepaal je:
1. **Valt de boeking onder de werkkostenregeling?** (Ja/Nee)
2. **Hoe zeker ben je?** (percentage)
3. **Is er een gerichte vrijstelling van toepassing?**
4. **Specifieke redenering voor je beslissing**

OUTPUTFORMAAT:
Geef een gestructureerde markdown analyse met:
1. Samenvatting
2. Belangrijkste bevindingen per boeking
3. Vrijstellingen overzicht
4. Berekeningen vrije ruimte
5. Aanbevelingen
`

  static buildStandardPrompt(
    transactions: FilteredTransaction[],
    context?: string
  ): string {
    const transactionsData = this.formatTransactionsForAI(transactions)

    return `${this.BASE_PROMPT}

${context ? `CONTEXT:\n${context}\n` : ''}

TRANSACTIEGEGEVENS:
${transactionsData}

Analyseer deze transacties volgens de Nederlandse werkkostenregeling.`
  }

  static buildCompliancePrompt(
    transactions: FilteredTransaction[],
    companyInfo: {
      name: string
      kvkNumber?: string
      fiscalYear: number
    }
  ): string {
    return `${this.BASE_PROMPT}

BEDRIJFSGEGEVENS:
- Naam: ${companyInfo.name}
- KvK: ${companyInfo.kvkNumber || 'Niet beschikbaar'}
- Boekjaar: ${companyInfo.fiscalYear}

COMPLIANCE CHECK:
Voer een grondige compliance check uit volgens de Nederlandse WKR-regelgeving.
Let specifiek op:
- Juiste toepassing van vrijstellingen
- Overschrijding van vrije ruimte
- Mogelijke risico's voor de belastingdienst
- Aanbevelingen voor verbetering

TRANSACTIEGEGEVENS:
${this.formatTransactionsForAI(transactions)}

Geef een compliance rapport met risico-inschatting.`
  }

  static buildDetailedPrompt(
    transactions: FilteredTransaction[],
    wageSum?: number
  ): string {
    const wageSumText = wageSum
      ? `LOONSOM: €${wageSum.toFixed(2)} (voor berekening vrije ruimte)`
      : 'LOONSOM: Niet beschikbaar - schat een redelijke loonsom voor MKB bedrijf'

    return `${this.BASE_PROMPT}

${wageSumText}

GEDETAILLEERDE ANALYSE:
Voor elke transactie geef je:
1. WKR classificatie met redenering
2. Toepasselijke vrijstelling (indien van toepassing)
3. Impact op vrije ruimte berekening
4. Mogelijke aandachtspunten
5. Alternatieve behandeling indien mogelijk

BEREKENINGEN:
- Bereken de vrije ruimte (1,7% van loonsom)
- Toon het verbruik van de vrije ruimte
- Geef percentage gebruikt van beschikbare ruimte
- Waarschuw bij overschrijding

TRANSACTIEGEGEVENS:
${this.formatTransactionsForAI(transactions)}

Geef een uitgebreide analyse met alle berekeningen.`
  }

  private static formatTransactionsForAI(
    transactions: FilteredTransaction[]
  ): string {
    const header = "| Grootboek | Boeking | Bedrag | Datum |"
    const separator = "|---|---|---|---|"

    const rows = transactions.map(tx =>
      `| ${tx.grootboek} | ${tx.boeking} | €${tx.bedrag.toFixed(2)} | ${tx.datum} |`
    )

    return [header, separator, ...rows].join('\n')
  }
}