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

Kopieer het voorbeeld configuratie bestand:
```bash
cp .env.example .env.local
```

En pas de volgende verplichte waarden aan in `.env.local`:
```bash
# Verplicht: Je Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here

# Optioneel: Pas configuratie aan (defaults zijn al ingesteld)
GEMINI_MODEL=gemini-2.5-pro
GEMINI_TEMPERATURE=0.1
GEMINI_MAX_OUTPUT_TOKENS=4096
```

**📋 Volledige configuratie opties** (zie `.env.example` voor alle beschikbare opties):
- `GEMINI_API_KEY` - **Verplicht**: Google Gemini API sleutel
- `GEMINI_MODEL` - AI model (default: gemini-2.5-pro)
- `GEMINI_TEMPERATURE` - Creativiteit (0.0-2.0, default: 0.1)
- `GEMINI_MAX_OUTPUT_TOKENS` - Max response tokens (default: 4096)
- `GEMINI_MAX_REQUESTS_PER_MINUTE` - Rate limiting (default: 60)
- `ENABLE_PERFORMANCE_MONITORING` - Performance tracking (default: true)

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

De applicatie gebruikt Google Gemini 2.5 Pro om WKR-gefilterde transacties te analyseren met 4 verschillende analyse types:

### 📊 Analyse Types

1. **🎯 WKR Compliance Analyse**
   - Identificeert WKR-relevante transacties
   - Controleert naleving van de Werkkostenregeling
   - Geeft risico-categorieën (Hoog/Gemiddeld/Laag)
   - Concrete aanbevelingen voor compliance verbetering

2. **⚠️ Risico Analyse**
   - Financiële risico's en ongebruikelijke patronen
   - Compliance risico's voor overheidsregeling
   - Operationele risico's en procesfouten
   - Prioritering naar impact en waarschijnlijkheid

3. **🔍 Patroon Analyse**
   - Frequentie en timing patronen
   - Ongebruikelijke bedragen en herhalingen
   - Account combinaties en anomalieën
   - Seizoens trends en uitschieters

4. **✨ Aangepaste Analyse**
   - Gebruik je eigen prompts voor specifieke vragen
   - Flexibele analyse voor unieke use cases
   - Gerichte inzichten op maat

### 🚀 Features

- **Real-time Streaming**: Live analyse output tijdens verwerking
- **Performance Monitoring**: Token usage en response times
- **Rate Limiting**: 60 requests per minuut voor stabiele performance
- **Error Handling**: Uitgebreide error recovery met retry logic

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

## 🔧 API Endpoints

De applicatie biedt verschillende API endpoints voor AI functionaliteit:

### Core Endpoints
- `POST /api/parse` - Upload en parseer XAF bestanden
- `GET /api/parse/[sessionId]` - Ophalen van volledige transactiedata
- `POST /api/ai/analyze` - Standaard AI analyse van transacties
- `POST /api/ai/stream` - Streaming AI analyse voor real-time output
- `GET /api/ai/stats` - Performance statistieken en monitoring

### AI Analysis Request Format
```json
{
  "transactions": [...],        // Array van WKR-gefilterde transacties
  "analysisType": "wkr-compliance", // "risk-assessment", "pattern-analysis", "custom"
  "prompt": "..."              // Alleen voor custom analyse type
}
```

### Response Format
```json
{
  "success": true,
  "data": {
    "analysis": "AI analyse resultaat...",
    "metadata": {
      "tokensUsed": 1250,
      "responseTime": 3400,
      "model": "gemini-2.5-pro",
      "analysisType": "wkr-compliance",
      "transactionCount": 2740
    }
  }
}
```

## 📊 Performance

- **Upload verwerking**: < 5 seconden voor 50MB bestanden
- **WKR filtering**: < 3 seconden voor 10k+ transacties
- **AI analyse start**: < 2 seconden (met rate limiting)
- **Complete AI analyse**: 15-45 seconden afhankelijk van complexity
- **Streaming analyse**: Real-time chunks elke 1-2 seconden
- **Memory usage**: Max 2x bestandsgrootte tijdens parsing
- **Rate limiting**: 60 AI requests per minuut per gebruiker

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