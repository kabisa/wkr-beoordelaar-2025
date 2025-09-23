# Story 10: Analyse Dashboard Layout

**Sprint:** 4
**Estimate:** 1-2 dagen
**Priority:** High

## User Story
Als gebruiker wil ik een overzichtelijk dashboard zien met upload status, streaming AI output en quick stats zodat ik alle informatie op één plek kan bekijken tijdens de analyse.

## Acceptatiecriteria
- [x] 3-kolom responsive layout
- [x] Upload status sidebar
- [x] Markdown renderer voor resultaten
- [x] Quick stats panel
- [x] Real-time updates tijdens streaming
- [x] Responsive design voor verschillende schermgroottes
- [x] Navigatie tussen verschillende analyse secties

## Dashboard Architecture

### Main Dashboard Layout
```tsx
// src/app/dashboard/page.tsx
import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard/DashboardLayout'
import { UploadStatusSidebar } from '@/components/dashboard/UploadStatusSidebar'
import { AnalysisOutputPanel } from '@/components/dashboard/AnalysisOutputPanel'
import { QuickStatsPanel } from '@/components/dashboard/QuickStatsPanel'
import { DashboardProvider } from '@/components/dashboard/DashboardContext'

export default function DashboardPage() {
  return (
    <DashboardProvider>
      <DashboardLayout>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          {/* Left Sidebar - Upload & Status */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <Suspense fallback={<div>Loading upload status...</div>}>
              <UploadStatusSidebar />
            </Suspense>
          </aside>

          {/* Main Content - Analysis Output */}
          <main className="lg:col-span-6 xl:col-span-7">
            <Suspense fallback={<div>Loading analysis...</div>}>
              <AnalysisOutputPanel />
            </Suspense>
          </main>

          {/* Right Sidebar - Stats & Navigation */}
          <aside className="lg:col-span-3 xl:col-span-3">
            <Suspense fallback={<div>Loading statistics...</div>}>
              <QuickStatsPanel />
            </Suspense>
          </aside>
        </div>
      </DashboardLayout>
    </DashboardProvider>
  )
}
```

### Dashboard Context & State Management
```tsx
// src/components/dashboard/DashboardContext.tsx
import { createContext, useContext, useReducer, ReactNode } from 'react'

export interface DashboardState {
  uploadedFile: File | null
  parseStatus: 'idle' | 'parsing' | 'parsed' | 'error'
  transactions: FilteredTransaction[]
  analysisStatus: 'idle' | 'running' | 'complete' | 'error'
  analysisResult: WKRAnalysisResponse | null
  currentSection: string
  error: string | null
}

type DashboardAction =
  | { type: 'SET_UPLOADED_FILE'; payload: File }
  | { type: 'SET_PARSE_STATUS'; payload: DashboardState['parseStatus'] }
  | { type: 'SET_TRANSACTIONS'; payload: FilteredTransaction[] }
  | { type: 'SET_ANALYSIS_STATUS'; payload: DashboardState['analysisStatus'] }
  | { type: 'SET_ANALYSIS_RESULT'; payload: WKRAnalysisResponse }
  | { type: 'SET_CURRENT_SECTION'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET_STATE' }

const initialState: DashboardState = {
  uploadedFile: null,
  parseStatus: 'idle',
  transactions: [],
  analysisStatus: 'idle',
  analysisResult: null,
  currentSection: 'upload',
  error: null
}

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFile: action.payload, parseStatus: 'idle' }
    case 'SET_PARSE_STATUS':
      return { ...state, parseStatus: action.payload }
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload, parseStatus: 'parsed' }
    case 'SET_ANALYSIS_STATUS':
      return { ...state, analysisStatus: action.payload }
    case 'SET_ANALYSIS_RESULT':
      return { ...state, analysisResult: action.payload, analysisStatus: 'complete' }
    case 'SET_CURRENT_SECTION':
      return { ...state, currentSection: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'RESET_STATE':
      return initialState
    default:
      return state
  }
}

const DashboardContext = createContext<{
  state: DashboardState
  dispatch: React.Dispatch<DashboardAction>
} | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState)

  return (
    <DashboardContext.Provider value={{ state, dispatch }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
```

### Dashboard Layout Component
```tsx
// src/components/dashboard/DashboardLayout.tsx
import { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Navigation } from '@/components/dashboard/Navigation'
import { Breadcrumbs } from '@/components/dashboard/Breadcrumbs'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Dashboard Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WKR Analyse Dashboard</h1>
              <Breadcrumbs />
            </div>
            <Navigation />
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-140px)]">
        {children}
      </div>
    </div>
  )
}
```

### Upload Status Sidebar
```tsx
// src/components/dashboard/UploadStatusSidebar.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  RotateCcw
} from 'lucide-react'
import { useDashboard } from './DashboardContext'
import { UploadZone } from '@/components/UploadZone'

export function UploadStatusSidebar() {
  const { state, dispatch } = useDashboard()

  const getStatusIcon = () => {
    switch (state.parseStatus) {
      case 'parsing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'parsed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Upload className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (state.parseStatus) {
      case 'parsing':
        return 'Parsing XAF file...'
      case 'parsed':
        return 'File successfully parsed'
      case 'error':
        return 'Parsing failed'
      default:
        return 'No file uploaded'
    }
  }

  const handleReset = () => {
    dispatch({ type: 'RESET_STATE' })
  }

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            File Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!state.uploadedFile ? (
            <UploadZone
              onFileSelect={(file) => dispatch({ type: 'SET_UPLOADED_FILE', payload: file })}
              isUploading={state.parseStatus === 'parsing'}
              error={state.parseStatus === 'error' ? state.error : undefined}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-sm font-medium">{state.uploadedFile.name}</span>
              </div>

              <div className="text-xs text-gray-500">
                Size: {(state.uploadedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>

              <Badge variant={state.parseStatus === 'parsed' ? 'default' : 'secondary'}>
                {getStatusText()}
              </Badge>

              {state.parseStatus === 'parsing' && (
                <Progress value={65} className="h-2" />
              )}

              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Upload New File
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Summary */}
      {state.transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transaction Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total transactions:</span>
                <span className="font-medium">{state.transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total amount:</span>
                <span className="font-medium">
                  €{state.transactions.reduce((sum, tx) => sum + tx.bedrag, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Date range:</span>
                <span className="font-medium text-xs">
                  {state.transactions.length > 0 && (
                    <>
                      {new Date(Math.min(...state.transactions.map(tx => new Date(tx.datum).getTime()))).toLocaleDateString()} -
                      {new Date(Math.max(...state.transactions.map(tx => new Date(tx.datum).getTime()))).toLocaleDateString()}
                    </>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Status */}
      {state.analysisStatus !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {state.analysisStatus === 'running' && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {state.analysisStatus === 'complete' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {state.analysisStatus === 'error' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {state.analysisStatus === 'running' && 'Analyzing...'}
                {state.analysisStatus === 'complete' && 'Analysis complete'}
                {state.analysisStatus === 'error' && 'Analysis failed'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### Analysis Output Panel
```tsx
// src/components/dashboard/AnalysisOutputPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Play,
  Download,
  FileText,
  BarChart3,
  Shield,
  AlertTriangle
} from 'lucide-react'
import { useDashboard } from './DashboardContext'
import { StreamingOutput } from '@/components/StreamingOutput'
import ReactMarkdown from 'react-markdown'

export function AnalysisOutputPanel() {
  const { state, dispatch } = useDashboard()

  const startAnalysis = () => {
    if (state.transactions.length === 0) return

    dispatch({ type: 'SET_ANALYSIS_STATUS', payload: 'running' })
    // Analysis logic will be handled by StreamingOutput component
  }

  const exportResults = () => {
    if (!state.analysisResult) return

    const dataStr = JSON.stringify(state.analysisResult, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `wkr-analysis-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (state.parseStatus !== 'parsed') {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Upload and parse an XAF file to begin analysis</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 h-full">
      {/* Analysis Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>WKR Analysis</CardTitle>
            <div className="flex gap-2">
              {state.analysisStatus === 'idle' && (
                <Button onClick={startAnalysis}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Analysis
                </Button>
              )}
              {state.analysisResult && (
                <Button onClick={exportResults} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analysis Content */}
      <Card className="flex-1">
        <CardContent className="p-0 h-full">
          <Tabs defaultValue="analysis" className="h-full">
            <div className="px-6 pt-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="analysis">
                  <FileText className="h-4 w-4 mr-2" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="calculations">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Calculations
                </TabsTrigger>
                <TabsTrigger value="exemptions">
                  <Shield className="h-4 w-4 mr-2" />
                  Exemptions
                </TabsTrigger>
                <TabsTrigger value="compliance">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Compliance
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analysis" className="px-6 pb-6 h-full overflow-auto">
              <StreamingOutput
                transactions={state.transactions}
                analysisType="standard"
                onComplete={(analysis) => {
                  // Parse and store the complete analysis
                  // This would need to be implemented based on the actual response format
                }}
              />
            </TabsContent>

            <TabsContent value="calculations" className="px-6 pb-6 h-full overflow-auto">
              {state.analysisResult?.calculations ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Free Space Calculations</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">
                          €{state.analysisResult.calculations.freeSpace.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">Available Free Space</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">
                          €{state.analysisResult.calculations.usedSpace.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600">Used Space</div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  No calculation data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="exemptions" className="px-6 pb-6 h-full overflow-auto">
              {state.analysisResult?.exemptions ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Available Exemptions</h3>
                  {state.analysisResult.exemptions.map((exemption, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <h4 className="font-medium">{exemption.type}</h4>
                        <p className="text-sm text-gray-600">{exemption.description}</p>
                        <div className="mt-2">
                          <span className="text-lg font-bold">€{exemption.totalAmount.toFixed(2)}</span>
                          <span className="text-sm text-gray-600 ml-2">total amount</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  No exemption data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="compliance" className="px-6 pb-6 h-full overflow-auto">
              {state.analysisResult ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Compliance Overview</h3>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">
                        {state.analysisResult.confidence}%
                      </div>
                      <div className="text-sm text-gray-600">Overall Confidence</div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  No compliance data available
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Quick Stats Panel
```tsx
// src/components/dashboard/QuickStatsPanel.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  DollarSign,
  Percent,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useDashboard } from './DashboardContext'

export function QuickStatsPanel() {
  const { state } = useDashboard()

  const getComplianceColor = (percentage: number) => {
    if (percentage < 50) return 'text-red-500'
    if (percentage < 80) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getUsageStatus = (percentage: number) => {
    if (percentage > 100) return { color: 'red', text: 'Over Limit' }
    if (percentage > 90) return { color: 'yellow', text: 'Near Limit' }
    return { color: 'green', text: 'Within Limit' }
  }

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium">View Trends</div>
              <div className="text-sm text-gray-600">Analyze spending patterns</div>
            </div>
          </button>
          <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <div>
              <div className="font-medium">Review Risks</div>
              <div className="text-sm text-gray-600">Check compliance issues</div>
            </div>
          </button>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      {state.analysisResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Free Space Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">
                    {state.analysisResult.calculations.usagePercentage.toFixed(1)}%
                  </span>
                  <Badge
                    variant={getUsageStatus(state.analysisResult.calculations.usagePercentage).color === 'green' ? 'default' : 'destructive'}
                  >
                    {getUsageStatus(state.analysisResult.calculations.usagePercentage).text}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(100, state.analysisResult.calculations.usagePercentage)}
                  className="h-2"
                />
                <div className="text-xs text-gray-600">
                  €{state.analysisResult.calculations.usedSpace.toFixed(2)} of €{state.analysisResult.calculations.freeSpace.toFixed(2)} used
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Analysis Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className={`text-2xl font-bold ${getComplianceColor(state.analysisResult.confidence)}`}>
                  {state.analysisResult.confidence}%
                </div>
                <Progress value={state.analysisResult.confidence} className="h-2" />
                <div className="text-xs text-gray-600">
                  Based on {state.analysisResult.findings.length} transactions analyzed
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>WKR Relevant:</span>
                  <span className="font-medium">
                    {state.analysisResult.findings.filter(f => f.isWKRRelevant).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Not Relevant:</span>
                  <span className="font-medium">
                    {state.analysisResult.findings.filter(f => !f.isWKRRelevant).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>High Confidence:</span>
                  <span className="font-medium">
                    {state.analysisResult.findings.filter(f => f.confidence > 80).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Needs Review:</span>
                  <span className="font-medium text-orange-600">
                    {state.analysisResult.findings.filter(f => f.confidence < 60).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {state.uploadedFile && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>File uploaded: {state.uploadedFile.name}</span>
              </div>
            )}
            {state.parseStatus === 'parsed' && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Parsed {state.transactions.length} transactions</span>
              </div>
            )}
            {state.analysisStatus === 'complete' && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Analysis completed</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Responsive Design Utilities
```tsx
// src/components/dashboard/ResponsiveHelper.tsx
import { useEffect, useState } from 'react'

export function useResponsive() {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) {
        setScreenSize('mobile')
      } else if (window.innerWidth < 1024) {
        setScreenSize('tablet')
      } else {
        setScreenSize('desktop')
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return screenSize
}

// Mobile-optimized dashboard layout
export function MobileDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  )
}
```

## Testing

### Component Tests
```tsx
// src/components/dashboard/__tests__/DashboardLayout.test.tsx
import { render, screen } from '@testing-library/react'
import { DashboardLayout } from '../DashboardLayout'
import { DashboardProvider } from '../DashboardContext'

const TestComponent = () => (
  <DashboardProvider>
    <DashboardLayout>
      <div>Test Content</div>
    </DashboardLayout>
  </DashboardProvider>
)

describe('DashboardLayout', () => {
  test('renders dashboard layout correctly', () => {
    render(<TestComponent />)

    expect(screen.getByText('WKR Analyse Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  test('shows responsive grid layout', () => {
    render(<TestComponent />)

    const container = screen.getByText('Test Content').closest('.grid')
    expect(container).toHaveClass('grid-cols-1', 'lg:grid-cols-12')
  })
})
```

## Definition of Done
- [ ] 3-kolom responsive layout werkend
- [ ] Upload status sidebar functioneel
- [ ] Analysis output panel integreert met streaming
- [ ] Quick stats panel toont relevante metrics
- [ ] Responsive design werkt op alle schermgroottes
- [ ] State management via Context API
- [ ] Navigation tussen secties
- [ ] Export functionaliteit beschikbaar

## Performance Targets
- Initial render: <500ms
- Layout shift: <0.1 CLS
- Responsive breakpoints: <200ms transition
- Memory usage: <50MB voor dashboard state
- 60fps tijdens animations en transitions