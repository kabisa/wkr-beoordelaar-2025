# Kabisa WKR Beoordelaar 2025

Een Next.js webapplicatie die Nederlandse XAF (XML Audit Files) automatisch analyseert met behulp van Google Gemini AI om boekhoudkundige inzichten op het gebied van de werkkostenregeling te genereren.

## 🎯 Doel van de Applicatie

Deze tool helpt accountants, boekhouders en financiële controllers bij het analyseren van XAF bestanden voor de Nederlandse Werkkostenregeling (WKR). De applicatie:

- **Parseert XAF bestanden** en extraheert relevante transacties
- **Filtert automatisch** op WKR-relevante rekeningen (4xxxx serie, exclusief 49xxx)
- **Analyseert met AI** welke uitgaven onder de werkkostenregeling vallen
- **Berekent vrije ruimte** op basis van loonkosten
- **Identificeert vrijstellingen** en twijfelgevallen
- **Genereert rapporten** met confidence scores en aanbevelingen

## 🚀 Aan de Slag

### Vereisten

- Node.js 18 of hoger
- Google Gemini API key

### Installatie

1. **Clone de repository**
```bash
git clone <repository-url>
cd wkr-tool
```

2. **Installeer dependencies**
```bash
npm install
```

3. **Configureer environment variables**

Maak een `.env.local` bestand in de root directory:
```bash
GOOGLE_AI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
GEMINI_TEMPERATURE=0.1
NODE_ENV=development
```

### Google Gemini API Key verkrijgen

1. Ga naar [Google AI Studio](https://aistudio.google.com/)
2. Log in met je Google account
3. Klik op "Get API key" in de navigatie
4. Kies "Create API key" en selecteer een Google Cloud project
5. Kopieer de gegenereerde API key
6. Voeg deze toe aan je `.env.local` bestand

### Development Server Starten

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in je browser.

## 📁 XAF Bestanden

De applicatie accepteert Nederlandse XAF (XML Audit Files) bestanden tot 100MB. Deze bestanden bevatten gestructureerde boekhouddata en worden gegenereerd door de meeste Nederlandse boekhoudpakketten.

### Ondersteunde Formaten
- `.xaf` bestanden
- `.xml` bestanden (XAF geformatteerd)

### Filtering Logica
- ✅ **Include**: Rekeningen beginnend met "4" (omzet- en kostenrekeningen)
- ❌ **Exclude**: Rekeningen beginnend met "49"
- ❌ **Exclude**: Specifieke rekeningen (430000, 403130)

## 🧠 AI Analyse

De applicatie gebruikt Google Gemini 2.5 Pro om te bepalen:

1. **WKR Relevantie**: Valt de uitgave onder de werkkostenregeling?
2. **Confidence Score**: Hoe zeker is de AI over deze classificatie?
3. **Vrijstellingen**: Is er een gerichte vrijstelling van toepassing?
4. **Vrije Ruimte**: Berekening van beschikbare ruimte o.b.v. loonkosten
5. **Gebruik**: Hoeveel van de vrije ruimte wordt gebruikt?

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint check
npm run typecheck    # TypeScript validation

# Testing
npm test             # Run tests
npm run test:watch   # Tests in watch mode
npm run test:coverage # Coverage report
```

## 📊 Performance

- **Upload verwerking**: < 5 seconden voor 50MB bestanden
- **AI analyse start**: < 2 seconden
- **Complete analyse**: < 30 seconden voor standaard XAF
- **Memory usage**: Max 2x bestandsgrootte

## 🔒 Privacy & Beveiliging

- **Geen permanente opslag** van boekhouddata
- **Session-based**: Data wordt na 1 uur automatisch verwijderd
- **TLS 1.3** encryptie voor alle data transfer
- **API keys** server-side only via environment variables
- **GDPR compliant** - geen persoonlijke data opslag

## 🏗️ Tech Stack

- **Frontend**: Next.js 15+ met App Router en Turbopack
- **UI**: Tailwind CSS + shadcn/ui componenten
- **Backend**: Next.js API Routes
- **AI**: Google Gemini API (gemini-2.5-pro)
- **Parser**: fast-xml-parser voor XAF verwerking
- **Streaming**: Server-Sent Events voor real-time analyse

## 📝 Licentie

Dit project is ontwikkeld voor Kabisa en is bedoeld voor interne WKR analyses.