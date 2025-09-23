# Story 2: Landing Page & Upload Component

**Sprint:** 1
**Estimate:** 1-2 dagen
**Priority:** High

## User Story
Als gebruiker wil ik een duidelijke landing page zien met upload functionaliteit zodat ik mijn XAF bestanden kan uploaden voor analyse.

## Acceptatiecriteria
- [x] Hero sectie met value proposition
- [x] Drag & drop upload zone
- [x] File validatie (XAF/XML formaten, max 100MB)
- [x] Upload progress indicator
- [x] Error messages bij invalid files
- [x] Responsive design voor desktop en tablet

## UI Components

### Landing Page Layout
```tsx
// src/app/page.tsx
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <HeroSection />
      <UploadSection />
      <FeaturePreview />
    </div>
  )
}
```

### Hero Section
```tsx
// src/components/HeroSection.tsx
interface HeroSectionProps {}

export function HeroSection() {
  return (
    <section className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-5xl font-bold text-gray-900 mb-6">
        WKR Beoordelaar 2025
      </h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Automatische analyse van uw XAF grootboek voor werkkostenregeling
        compliance met AI-powered inzichten
      </p>
      <div className="flex gap-4 justify-center">
        <Button size="lg" onClick={() => scrollToUpload()}>
          Start Analyse
        </Button>
        <Button variant="outline" size="lg">
          Meer Info
        </Button>
      </div>
    </section>
  )
}
```

### Upload Zone Component
```tsx
// src/components/UploadZone.tsx
interface UploadZoneProps {
  onFileSelect: (file: File) => void
  isUploading: boolean
  error?: string
}

export function UploadZone({ onFileSelect, isUploading, error }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer?.files || [])
    const xafFile = files.find(file =>
      file.name.endsWith('.xaf') || file.name.endsWith('.xml')
    )

    if (xafFile) {
      validateAndUpload(xafFile)
    }
  }

  const validateAndUpload = (file: File) => {
    // Size validation
    if (file.size > 100 * 1024 * 1024) {
      setError('Bestand te groot (max 100MB)')
      return
    }

    // Format validation
    if (!file.name.match(/\.(xaf|xml)$/i)) {
      setError('Alleen XAF en XML bestanden toegestaan')
      return
    }

    onFileSelect(file)
  }

  return (
    <div className={cn(
      "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
      isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300",
      error ? "border-red-500 bg-red-50" : ""
    )}>
      {/* Upload UI */}
    </div>
  )
}
```

### Upload Progress Component
```tsx
// src/components/UploadProgress.tsx
interface UploadProgressProps {
  progress: number
  fileName: string
  status: 'uploading' | 'processing' | 'complete' | 'error'
}

export function UploadProgress({ progress, fileName, status }: UploadProgressProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {status === 'uploading' && <Loader2 className="h-5 w-5 animate-spin" />}
        {status === 'processing' && <Clock className="h-5 w-5 text-blue-500" />}
        {status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500" />}
        {status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}

        <span className="font-medium">{fileName}</span>
      </div>

      <Progress value={progress} className="h-2" />

      <p className="text-sm text-gray-600">
        {status === 'uploading' && `Uploading... ${progress}%`}
        {status === 'processing' && 'Verwerken van XAF bestand...'}
        {status === 'complete' && 'Upload voltooid'}
        {status === 'error' && 'Upload mislukt'}
      </p>
    </div>
  )
}
```

## File Validation Logic

### File Type Validation
```typescript
// src/lib/validation.ts
export interface FileValidationResult {
  isValid: boolean
  error?: string
  file?: File
}

export function validateXAFFile(file: File): FileValidationResult {
  // Size check
  if (file.size > 100 * 1024 * 1024) {
    return {
      isValid: false,
      error: 'Bestand is te groot. Maximaal 100MB toegestaan.'
    }
  }

  // Format check
  const validExtensions = ['.xaf', '.xml']
  const hasValidExtension = validExtensions.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  )

  if (!hasValidExtension) {
    return {
      isValid: false,
      error: 'Alleen XAF (.xaf) en XML (.xml) bestanden zijn toegestaan.'
    }
  }

  // MIME type check
  const validMimeTypes = ['text/xml', 'application/xml', 'application/xaf']
  if (file.type && !validMimeTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Ongeldig bestandstype. Upload een geldig XAF bestand.'
    }
  }

  return {
    isValid: true,
    file
  }
}
```

## State Management

### Upload Hook
```typescript
// src/hooks/useFileUpload.ts
export function useFileUpload() {
  const [uploadState, setUploadState] = useState<{
    file: File | null
    progress: number
    status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
    error: string | null
  }>({
    file: null,
    progress: 0,
    status: 'idle',
    error: null
  })

  const uploadFile = async (file: File) => {
    setUploadState({
      file,
      progress: 0,
      status: 'uploading',
      error: null
    })

    try {
      // Upload logic with progress tracking
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100
          setUploadState(prev => ({ ...prev, progress }))
        }
      }

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadState(prev => ({
            ...prev,
            status: 'processing',
            progress: 100
          }))
        }
      }

      xhr.open('POST', '/api/upload')
      xhr.send(formData)

    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        status: 'error',
        error: 'Upload mislukt. Probeer opnieuw.'
      }))
    }
  }

  return {
    uploadState,
    uploadFile,
    resetUpload: () => setUploadState({
      file: null,
      progress: 0,
      status: 'idle',
      error: null
    })
  }
}
```

## Styling & Responsive Design

### Tailwind Classes
```css
/* Key responsive breakpoints */
.upload-zone {
  @apply border-2 border-dashed border-gray-300 rounded-lg p-8 md:p-12;
  @apply hover:border-blue-400 hover:bg-blue-50;
  @apply transition-all duration-200 ease-in-out;
}

.hero-section {
  @apply container mx-auto px-4 py-12 md:py-20;
  @apply text-center;
}

.hero-title {
  @apply text-3xl md:text-5xl font-bold text-gray-900 mb-4 md:mb-6;
}

.hero-subtitle {
  @apply text-lg md:text-xl text-gray-600 mb-6 md:mb-8;
  @apply max-w-xl md:max-w-2xl mx-auto;
}
```

## API Endpoint

### Upload Handler
```typescript
// src/app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Geen bestand ontvangen' },
        { status: 400 }
      )
    }

    // Validate file
    const validation = validateXAFFile(file)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Store temporarily (memory or temp file)
    const buffer = await file.arrayBuffer()
    const fileName = `upload_${Date.now()}_${file.name}`

    return NextResponse.json({
      success: true,
      fileName,
      size: file.size,
      uploadId: generateUploadId()
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Upload mislukt' },
      { status: 500 }
    )
  }
}
```

## Definition of Done
- [ ] Landing page toont correct op desktop en mobile
- [ ] Drag & drop werkt in alle moderne browsers
- [ ] File validatie blokkeert invalid bestanden
- [ ] Progress indicator toont tijdens upload
- [ ] Error states zijn gebruiksvriendelijk
- [ ] Upload API endpoint functioneel
- [ ] Responsive design getest op verschillende schermgroottes

## Testing Checklist
- [ ] Upload 50MB XAF bestand
- [ ] Upload 101MB bestand (should fail)
- [ ] Upload .txt bestand (should fail)
- [ ] Drag & drop functionaliteit
- [ ] Click to upload functionaliteit
- [ ] Progress indicator werkt
- [ ] Error recovery werkt