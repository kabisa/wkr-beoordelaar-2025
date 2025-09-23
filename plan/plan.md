# Plan van Aanpak: WKR Beoordelaar MVP

## Overzicht
Een Next.js 15.5.2 webapplicatie die XAF bestanden analyseert met Google Gemini AI voor werkkostenregeling beoordeling. De app draait lokaal zonder authenticatie.

## User Stories voor MVP Development

### **Sprint 1: Fundament (3-4 dagen)**

**Story 1: Project Setup**
- Next.js 15.5.2 project initialiseren met Turbopack
- TypeScript configuratie met typed routes
- Tailwind CSS + shadcn/ui setup
- Environment variables voor Gemini API
- *Acceptatiecriteria:* Dev server draait, basis routing werkt

**Story 2: Landing Page & Upload Component**
- Hero sectie met product uitleg
- Drag & drop upload zone
- File validatie (XAF/XML, max 100MB)
- Upload progress indicator
- *Acceptatiecriteria:* Files kunnen geüpload worden met feedback

**Story 3: XAF Parser Basis**
- XML parsing bibliotheek integreren
- XAF schema validatie
- Basis data extractie
- Error handling voor corrupte files
- *Acceptatiecriteria:* XAF wordt geparsed naar JSON structuur

### **Sprint 2: Data Processing (3-4 dagen)**

**Story 4: Filtering Engine**
- Accounts filteren (start met "4", exclusief "49")
- Specifieke accounts excluderen (430000, 403130)
- Data transformatie naar tabel format
- *Acceptatiecriteria:* Gefilterde boekingen in correct format

**Story 5: Gemini API Setup**
- Google AI SDK integratie
- API route voor analyse requests
- Server-side API key management
- Rate limiting implementatie
- *Acceptatiecriteria:* Basis communicatie met Gemini werkt

**Story 6: WKR Prompt Engineering**
- Prompt templates voor WKR analyse
- Context injectie van referentie docs
- Response parsing
- *Acceptatiecriteria:* Gemini geeft gestructureerde WKR analyse

### **Sprint 3: AI Analyse & Streaming (4-5 dagen)**

**Story 7: Referentie Documenten Processing**
- PDF text extractie (wkr1.pdf, wkr2.pdf)
- Context opbouw voor Gemini
- Kennisbank structuur
- *Acceptatiecriteria:* WKR kennis beschikbaar in prompts

**Story 8: Streaming Interface**
- Server-Sent Events implementatie
- Real-time markdown streaming
- Client-side stream handler
- Progress indicators
- *Acceptatiecriteria:* Analyse verschijnt real-time

**Story 9: WKR Analyse Features**
- Beoordeling per boeking
- Zekerheidspercentage berekening
- Vrijstellingen identificatie
- Vrije ruimte calculatie
- *Acceptatiecriteria:* Complete WKR analyse output

### **Sprint 4: Dashboard & Visualisatie (4-5 dagen)**

**Story 10: Analyse Dashboard Layout**
- 3-kolom responsive layout
- Upload status sidebar
- Markdown renderer voor resultaten
- Quick stats panel
- *Acceptatiecriteria:* Overzichtelijk dashboard

**Story 11: Data Visualisaties**
- Recharts integratie
- WKR gebruik grafiek
- Vrijstellingen pie chart
- Vrije ruimte meter
- *Acceptatiecriteria:* Interactieve grafieken

**Story 12: Export Functionaliteit**
- Markdown export
- Basis PDF generatie
- Download handlers
- *Acceptatiecriteria:* Rapporten downloadbaar

### **Sprint 5: Optimalisatie & Polish (3-4 dagen)**

**Story 13: Performance & Caching**
- Response caching strategie
- Optimistische UI updates
- Lazy loading componenten
- *Acceptatiecriteria:* <30 sec analyse tijd

**Story 14: Error Handling & UX**
- Gebruiksvriendelijke error messages
- Retry mechanismen
- Loading states
- Tooltips en help teksten
- *Acceptatiecriteria:* Robuuste gebruikerservaring

**Story 15: Testing & Documentatie**
- Unit tests voor parsers
- Integration tests voor API
- Gebruikersdocumentatie
- Deployment instructies
- *Acceptatiecriteria:* Test coverage >80%

## Technische Architectuur

### Tech Stack met Next.js 15.5.2
- **Framework:** Next.js 15.5.2 met Turbopack voor snelle builds
- **TypeScript:** Typed routes en verbeterde validatie
- **Styling:** Tailwind CSS + shadcn/ui components
- **Charts:** Recharts voor data visualisatie
- **State:** Zustand voor client-side state management
- **AI:** Google Gemini API (gemini-2.5-pro model)
- **Streaming:** Server-Sent Events met TransformStream API

### Project Structuur
```
/wkr-tool
├── /app                    # Next.js app directory
│   ├── /api               # API routes
│   │   ├── /upload        # File upload handler
│   │   └── /analyze       # AI analyse endpoint
│   ├── /dashboard         # Analyse dashboard page
│   └── page.tsx           # Landing page
├── /components
│   ├── /ui               # shadcn/ui components
│   ├── UploadZone.tsx    # Drag & drop upload
│   ├── StreamingOutput.tsx # Real-time AI output
│   └── Charts.tsx        # Data visualisaties
├── /lib
│   ├── /parsers          # XAF parsing logica
│   ├── /ai               # Gemini integration
│   ├── /filters          # Data filtering
│   └── /utils            # Helper functions
├── /public
│   └── /docs             # WKR referentie documenten
└── /types                # TypeScript type definitions
```

## Data Flow
```
XAF Upload → Parse & Validate → Filter Data → Format for AI →
Gemini Analysis → Stream Response → Display Results → Export Options
```

## Prioriteit & Volgorde

### **Kritieke Pad:**
1. **Week 1:** Upload → Parser → Basic UI (Stories 1-3)
2. **Week 2:** Data filtering → Gemini setup (Stories 4-6)
3. **Week 3:** AI analyse → Streaming (Stories 7-9)
4. **Week 4:** Dashboard → Visualisaties (Stories 10-12)
5. **Week 5:** Optimalisatie → Testing (Stories 13-15)

### **Deliverables per Sprint:**
- **Sprint 1:** Werkende upload interface met XAF parsing
- **Sprint 2:** Complete data processing pipeline
- **Sprint 3:** AI analyse met streaming output
- **Sprint 4:** Volledig dashboard met export functionaliteit
- **Sprint 5:** Production-ready MVP

## Kritieke Succesfactoren

### Performance Targets
- Upload processing: < 5 seconden voor 50MB files
- AI analyse start: < 2 seconden
- Complete analyse: < 30 seconden
- Turbopack build tijd: < 10 seconden

### Kwaliteitseisen
- Accurate XAF parsing voor verschillende formaten
- Betrouwbare Gemini API integratie (95%+ uptime)
- Correcte WKR beoordeling volgens Nederlandse regelgeving
- Responsive design voor desktop en tablet
- GDPR compliance (geen permanente data opslag)

### Risico Mitigatie
- **XAF format variaties:** Robuuste parser met extensive error handling
- **Gemini API limieten:** Caching en queue systeem
- **Performance issues:** Streaming en lazy loading
- **Complex WKR regels:** Grondige testing met referentie documenten

## MVP Scope Definitie

### **Must Have (MVP)**
- XAF upload en parsing
- WKR analyse per boeking
- Streaming AI output
- Basis export functionaliteit
- Error handling

### **Should Have (Post-MVP)**
- Geavanceerde visualisaties
- Batch processing
- Historical data comparison
- Advanced export opties

### **Could Have (Future)**
- User accounts
- API voor integraties
- Multi-tenant support
- Advanced analytics dashboard

Deze aanpak zorgt voor iteratieve ontwikkeling waarbij elke sprint een werkend product oplevert met incrementeel meer functionaliteit.