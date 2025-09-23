# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Kabisa WKR beoordelaar 2025** - a Next.js web application that analyzes Dutch XAF (XML Audit Files) using Google Gemini AI to provide tax insights and anomaly detection specifically for the Dutch "Werkkostenregeling" (WKR).

**Key Technologies:**
- Next.js 15+ with App Router and Turbopack
- TypeScript with strict mode
- Tailwind CSS + shadcn/ui
- Google Gemini AI (gemini-2.5-pro)
- Server-Sent Events for streaming responses

## Development Commands

Based on the project setup documentation:

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Production build
npm run lint         # ESLint check
npm run typecheck    # TypeScript type checking

# Testing
npm test             # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Architecture Overview

### Core Components

1. **XAF Parser** (`src/lib/parsers/`)
   - Parses and validates XML Audit Files
   - Handles different XAF versions (3.2, 4.0)
   - Memory-efficient streaming for large files (>50MB)
   - Error handling for corrupt/invalid files

2. **Filtering Engine** (`src/lib/filters/`)
   - Filters transactions based on WKR rules:
     - Include: Account IDs starting with "4"
     - Exclude: Account IDs starting with "49"
     - Exclude: Specific accounts (430000, 403130)
   - Configurable filter rules
   - Performance-optimized for large datasets

3. **Gemini AI Integration** (`src/lib/ai/`)
   - Google Gemini API client with retry logic
   - Rate limiting (60 requests/minute)
   - Streaming analysis responses
   - Token usage monitoring
   - Reference documents integration (plan/wkr1.pdf, plan/wkr2.pdf)

4. **Data Transformation** (`src/lib/transformers/`)
   - Converts XAF data to WKR analysis format:
     ```
     Grootboek: [account_id account_name] | Boeking: [transaction_id description] | Bedrag: [amount] | Datum: [date]
     ```

### API Routes

- `POST /api/parse` - Parse uploaded XAF files
- `POST /api/filter` - Filter transactions based on WKR rules
- `POST /api/analyze` - Generate AI analysis (non-streaming)
- `POST /api/analyze/stream` - Generate streaming AI analysis

### Data Flow

```
XAF Upload → Parse & Validate → Filter (WKR rules) → Format for AI → Gemini Analysis → Stream Response
```

## Key Environment Variables

Required in `.env.local`:
```bash
GOOGLE_AI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
GEMINI_TEMPERATURE=0.1
```

## Critical Implementation Notes

### XAF File Structure
- XAF files contain Dutch accounting data in XML format
- Key sections: header, company, generalLedgerAccounts, transactions
- Transactions contain journal entries with multiple lines
- Each line has: accountId, amount, description, date

### WKR Analysis Requirements
- Focus on expense accounts (4xxxx series)
- Determine if expenses fall under WKR (Dutch tax regulation)
- Calculate "vrije ruimte" (free allowance) based on salary costs
- Identify specific exemptions and uncertain cases
- Provide confidence percentages for classifications

### Performance Requirements
- Parse 50MB XAF files in <5 seconds
- Filter 10k transactions in <1 second
- Gemini API response start in <2 seconds
- Memory usage: max 2x file size

### Security & Privacy
- No permanent storage of accounting data
- Session-based data (auto-delete after 1 hour)
- Server-side API key management only
- TLS 1.3 for all data transfer

## Testing Strategy

- **Unit Tests**: Individual components (parsers, filters, transformers)
- **Integration Tests**: API endpoints with real XAF data
- **Performance Tests**: Large file handling and processing speed
- **Coverage Target**: >90% for core business logic

## File Organization

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── ai/                # Gemini AI integration
│   ├── parsers/           # XAF parsing logic
│   ├── filters/           # Transaction filtering
│   ├── transformers/      # Data transformation
│   ├── config/            # Configuration management
│   └── utils.ts           # Utility functions
└── types/                 # TypeScript definitions
```

## Common Development Patterns

### Error Handling
- Custom error classes for each domain (XAFParseError, GeminiError, FilterError)
- Graceful degradation for API failures
- User-friendly Dutch error messages
- Retry logic for transient failures

### Data Processing
- Streaming for large files to prevent memory issues
- Batch processing for large transaction sets
- Progress indicators for long-running operations
- Efficient filtering with compiled regex patterns

### AI Integration
- Low temperature (0.1) for consistent analysis
- Structured prompts with domain expertise
- Reference document integration for accurate WKR guidance
- Real-time streaming of analysis results

## Development Workflow

1. **File Upload**: Drag & drop XAF files with validation
2. **Parsing**: XML parsing with schema validation
3. **Filtering**: Apply WKR-specific transaction filters
4. **Analysis**: Send filtered data to Gemini with specialized prompts
5. **Streaming**: Real-time display of AI analysis results
6. **Export**: Markdown/PDF export of analysis results