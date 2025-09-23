export class WKRContextBuilder {
  private wkrRules: string = ''
  private exemptions: string = ''
  private calculations: string = ''

  async loadWKRContext(): Promise<void> {
    this.wkrRules = await this.loadWKRRules()
    this.exemptions = await this.loadExemptions()
    this.calculations = await this.loadCalculationRules()
  }

  buildContext(): string {
    return `
WERKKOSTENREGELING CONTEXT:

${this.wkrRules}

VRIJSTELLINGEN:
${this.exemptions}

BEREKENINGEN:
${this.calculations}

BELANGRIJKE UITGANGSPUNTEN:
- Vrije ruimte = 1,7% van de loonsom (2025)
- Werknemers kunnen kiezen tussen vrije ruimte en gerichte vrijstellingen
- Overschrijding van vrije ruimte wordt belast als loon
- Administratieplicht voor alle verstrekte vergoedingen
`
  }

  private async loadWKRRules(): Promise<string> {
    return `
WERKKOSTENREGELING BASISREGELS:

1. Definitie werkkosten:
   - Kosten die de werkgever maakt voor de werknemer
   - Vergoedingen en verstrekkingen aan werknemers
   - Niet-loonbestanddelen die wel belast kunnen worden

2. Vrije ruimte:
   - 1,7% van de loonsom (belastbaar loon)
   - Werkgever mag vrij besteden binnen deze ruimte
   - Overschrijding wordt belast als loon bij werknemer

3. Gerichte vrijstellingen:
   - Alternatief voor vrije ruimte
   - Specifieke kostensoorten met eigen regels
   - Geen belasting bij juiste toepassing
`
  }

  private async loadExemptions(): Promise<string> {
    return `
GERICHTE VRIJSTELLINGEN:

1. Reiskosten woon-werk:
   - €0,23 per km (2025)
   - Maximaal 75 km enkele reis
   - Alternatief: OV-vergoeding werkelijke kosten

2. Reiskosten zakelijk:
   - €0,23 per km zakelijke kilometers
   - Werkelijke kosten OV zakelijk
   - Verblijfkosten volgens normen

3. Opleidingskosten:
   - Vakgerichte opleidingen volledig vrijgesteld
   - Algemene opleidingen beperkt vrijgesteld

4. Relatiegeschenken:
   - Maximaal €50 per relatie per jaar
   - Bedrijfslogo verplicht

5. Representatiekosten:
   - Zakelijke bijeenkomsten
   - Maximaal redelijke kosten

6. Computer/telefoon thuiswerk:
   - Maximaal €2.500 per jaar per werknemer
   - Voor thuiswerk doeleinden

7. Kleine beloningen:
   - Maximaal €50 per keer
   - Voor bijzondere prestaties

8. Periodieke geschenken:
   - Maximaal €100 per jaar per werknemer
   - Zoals kerstpakketten, bloemen

9. Bedrijfsfeesten:
   - Maximaal €3.200 per werknemer per jaar
   - Inclusief zakelijke bijeenkomsten

10. Arbo/gezondheidskosten:
    - Preventieve gezondheidsonderzoeken
    - Werkplek-ergonomie verbeteringen
`
  }

  private async loadCalculationRules(): Promise<string> {
    return `
BEREKENING VRIJE RUIMTE:

1. Loonsom bepaling:
   - Alle belastbare lonen
   - Exclusief DGA-loon (bij <5% aandeelhouderschap)
   - Inclusief bonussen en overwerk

2. Vrije ruimte berekening:
   - Loonsom × 1,7% = vrije ruimte
   - Minimum €500 per werknemer
   - Maximum €1.200 per werknemer

3. Verbruik tracking:
   - Som alle WKR-relevante kosten
   - Vergelijk met beschikbare ruimte
   - Monitor overschrijding per periode

4. Jaarlijkse afhandeling:
   - Overschrijding belast bij werknemer
   - Loonheffing verschuldigd door werkgever
   - Aangifteplicht in loonaangifte
`
  }

  getQuickReference(): string {
    return `
WKR QUICK REFERENCE 2025:

✓ Vrije ruimte: 1,7% van loonsom
✓ Reiskosten: €0,23/km (max 75km woon-werk)
✓ Computer thuiswerk: max €2.500/jaar
✓ Bedrijfsfeesten: max €3.200/werknemer/jaar
✓ Relatiegeschenken: max €50/relatie/jaar
✓ Kleine beloningen: max €50/keer
✓ Periodieke geschenken: max €100/werknemer/jaar

⚠️ Administratieplicht voor alle vergoedingen
⚠️ Overschrijding = belasting bij werknemer
⚠️ Keuze vrijstellingen XOR vrije ruimte
`
  }
}