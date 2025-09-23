# Story 11: Data Visualisaties

**Sprint:** 4
**Estimate:** 2 dagen
**Priority:** Medium

## User Story
Als gebruiker wil ik interactieve grafieken en visualisaties zien van mijn WKR analyse zodat ik snel inzicht krijg in de belangrijkste metrics en trends.

## Acceptatiecriteria
- [x] Recharts integratie
- [x] WKR gebruik visualisatie (donut chart)
- [x] Vrijstellingen pie chart
- [x] Vrije ruimte progress meter
- [x] Transactie trend timeline
- [x] Account category breakdown
- [x] Interactieve tooltips en hover effects
- [x] Responsive chart design

## Chart Components Architecture

### Chart Container & Theming
```tsx
// src/components/charts/ChartContainer.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReactNode } from 'react'

interface ChartContainerProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function ChartContainer({
  title,
  description,
  children,
  className = '',
  action
}: ChartContainerProps) {
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[300px]">
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

// Chart theme configuration
export const chartTheme = {
  colors: {
    primary: '#3b82f6',    // Blue
    secondary: '#10b981',  // Green
    accent: '#f59e0b',     // Amber
    danger: '#ef4444',     // Red
    warning: '#f97316',    // Orange
    muted: '#6b7280',      // Gray
    background: '#ffffff',
    grid: '#f3f4f6'
  },
  fonts: {
    default: 'Inter, system-ui, sans-serif'
  }
}
```

### WKR Usage Donut Chart
```tsx
// src/components/charts/WKRUsageChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ChartContainer, chartTheme } from './ChartContainer'

interface WKRUsageChartProps {
  freeSpace: number
  usedSpace: number
  overage?: number
}

export function WKRUsageChart({ freeSpace, usedSpace, overage = 0 }: WKRUsageChartProps) {
  const remainingSpace = Math.max(0, freeSpace - usedSpace)

  const data = [
    {
      name: 'Used Space',
      value: Math.min(usedSpace, freeSpace),
      color: usedSpace > freeSpace ? chartTheme.colors.danger : chartTheme.colors.primary,
      percentage: ((Math.min(usedSpace, freeSpace) / freeSpace) * 100).toFixed(1)
    },
    {
      name: 'Remaining Space',
      value: remainingSpace,
      color: chartTheme.colors.muted,
      percentage: ((remainingSpace / freeSpace) * 100).toFixed(1)
    }
  ]

  if (overage > 0) {
    data.push({
      name: 'Overage',
      value: overage,
      color: chartTheme.colors.danger,
      percentage: ((overage / freeSpace) * 100).toFixed(1)
    })
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">
            €{data.value.toFixed(2)} ({data.percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (parseFloat(percentage) < 5) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${percentage}%`}
      </text>
    )
  }

  return (
    <ChartContainer
      title="Free Space Usage"
      description="Current usage of your WKR free space allocation"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {value}: €{entry.payload.value.toFixed(2)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
```

### Exemptions Breakdown Chart
```tsx
// src/components/charts/ExemptionsChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartContainer, chartTheme } from './ChartContainer'

interface ExemptionsChartProps {
  exemptions: Array<{
    type: string
    totalAmount: number
    exemptAmount: number
    savings: number
  }>
}

export function ExemptionsChart({ exemptions }: ExemptionsChartProps) {
  const data = exemptions.map(exemption => ({
    name: exemption.type.replace(' ', '\n'), // Break long names
    total: exemption.totalAmount,
    exempt: exemption.exemptAmount,
    savings: exemption.savings,
    shortName: exemption.type.split(' ')[0] // First word only for compact display
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p>Total Amount: €{data.total.toFixed(2)}</p>
            <p>Exempt Amount: €{data.exempt.toFixed(2)}</p>
            <p className="text-green-600 font-medium">
              Savings: €{data.savings.toFixed(2)}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ChartContainer
      title="Exemption Opportunities"
      description="Potential savings through targeted exemptions"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
          <XAxis
            dataKey="shortName"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="total"
            fill={chartTheme.colors.muted}
            name="Total Amount"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="exempt"
            fill={chartTheme.colors.secondary}
            name="Exempt Amount"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
```

### Transaction Timeline Chart
```tsx
// src/components/charts/TransactionTimelineChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { ChartContainer, chartTheme } from './ChartContainer'
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

interface TransactionTimelineChartProps {
  transactions: Array<{
    datum: string
    bedrag: number
    isWKRRelevant?: boolean
  }>
}

export function TransactionTimelineChart({ transactions }: TransactionTimelineChartProps) {
  // Group transactions by month
  const groupedData = transactions.reduce((acc, transaction) => {
    const month = format(parseISO(transaction.datum), 'yyyy-MM')

    if (!acc[month]) {
      acc[month] = {
        month,
        total: 0,
        wkrRelevant: 0,
        count: 0
      }
    }

    acc[month].total += Math.abs(transaction.bedrag)
    acc[month].count += 1

    if (transaction.isWKRRelevant) {
      acc[month].wkrRelevant += Math.abs(transaction.bedrag)
    }

    return acc
  }, {} as Record<string, any>)

  // Convert to array and sort by date
  const data = Object.values(groupedData)
    .sort((a: any, b: any) => a.month.localeCompare(b.month))
    .map((item: any) => ({
      ...item,
      displayMonth: format(parseISO(`${item.month}-01`), 'MMM yyyy')
    }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p>Total Expenses: €{data.total.toFixed(2)}</p>
            <p>WKR Relevant: €{data.wkrRelevant.toFixed(2)}</p>
            <p>Transactions: {data.count}</p>
            <p className="text-blue-600 font-medium">
              WKR %: {((data.wkrRelevant / data.total) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ChartContainer
      title="Monthly Expense Trends"
      description="Track your WKR-relevant expenses over time"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.colors.grid} />
          <XAxis
            dataKey="displayMonth"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stackId="1"
            stroke={chartTheme.colors.muted}
            fill={chartTheme.colors.muted}
            fillOpacity={0.3}
            name="Total Expenses"
          />
          <Area
            type="monotone"
            dataKey="wkrRelevant"
            stackId="2"
            stroke={chartTheme.colors.primary}
            fill={chartTheme.colors.primary}
            fillOpacity={0.6}
            name="WKR Relevant"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
```

### Account Category Breakdown
```tsx
// src/components/charts/AccountCategoryChart.tsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { ChartContainer, chartTheme } from './ChartContainer'

interface AccountCategoryChartProps {
  transactions: Array<{
    accountId: string
    bedrag: number
    grootboek: string
  }>
}

export function AccountCategoryChart({ transactions }: AccountCategoryChartProps) {
  // Group by account category (first 2 digits)
  const categoryData = transactions.reduce((acc, transaction) => {
    const category = transaction.accountId.substring(0, 2)
    const categoryName = getCategoryName(category)

    if (!acc[categoryName]) {
      acc[categoryName] = {
        name: categoryName,
        value: 0,
        count: 0,
        accounts: new Set()
      }
    }

    acc[categoryName].value += Math.abs(transaction.bedrag)
    acc[categoryName].count += 1
    acc[categoryName].accounts.add(transaction.accountId)

    return acc
  }, {} as Record<string, any>)

  const data = Object.values(categoryData)
    .map((item: any) => ({
      name: item.name,
      value: item.value,
      count: item.count,
      accounts: item.accounts.size,
      percentage: 0 // Will be calculated below
    }))
    .sort((a, b) => b.value - a.value)

  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.value, 0)
  data.forEach(item => {
    item.percentage = ((item.value / total) * 100).toFixed(1)
  })

  const colors = [
    chartTheme.colors.primary,
    chartTheme.colors.secondary,
    chartTheme.colors.accent,
    chartTheme.colors.warning,
    chartTheme.colors.danger,
    chartTheme.colors.muted
  ]

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <div className="space-y-1 text-sm">
            <p>Amount: €{data.value.toFixed(2)}</p>
            <p>Percentage: {data.percentage}%</p>
            <p>Transactions: {data.count}</p>
            <p>Unique Accounts: {data.accounts}</p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ChartContainer
      title="Expense Categories"
      description="Breakdown of expenses by account category"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ percentage }: any) => `${percentage}%`}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value, entry: any) => (
              <span style={{ color: entry.color }}>
                {value}: €{entry.payload.value.toFixed(0)}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

function getCategoryName(categoryCode: string): string {
  const categories: Record<string, string> = {
    '40': 'Revenue',
    '41': 'Other Revenue',
    '42': 'Cost of Sales',
    '43': 'General Expenses',
    '44': 'Personnel Costs',
    '45': 'Depreciation',
    '46': 'Other Operating',
    '47': 'Financial',
    '48': 'Extraordinary'
  }

  return categories[categoryCode] || `Category ${categoryCode}`
}
```

### Progress Meter Component
```tsx
// src/components/charts/ProgressMeter.tsx
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'

interface ProgressMeterProps {
  title: string
  current: number
  target: number
  unit?: string
  format?: (value: number) => string
  showTrend?: boolean
  trendValue?: number
  warningThreshold?: number
  dangerThreshold?: number
}

export function ProgressMeter({
  title,
  current,
  target,
  unit = '',
  format = (value) => value.toFixed(2),
  showTrend = false,
  trendValue = 0,
  warningThreshold = 80,
  dangerThreshold = 100
}: ProgressMeterProps) {
  const percentage = Math.min(100, (current / target) * 100)
  const isWarning = percentage >= warningThreshold && percentage < dangerThreshold
  const isDanger = percentage >= dangerThreshold

  const getProgressColor = () => {
    if (isDanger) return 'bg-red-500'
    if (isWarning) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusIcon = () => {
    if (isDanger) return <AlertTriangle className="h-5 w-5 text-red-500" />
    if (isWarning) return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    return null
  }

  const getTrendIcon = () => {
    if (!showTrend) return null
    if (trendValue > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trendValue < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">{title}</span>
          {getStatusIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Current</span>
            <span className="font-medium">
              {format(current)}{unit}
            </span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Target</span>
            <span>{format(target)}{unit}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Progress
            value={percentage}
            className={`h-3 ${getProgressColor()}`}
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>0{unit}</span>
            <span className="font-medium">{percentage.toFixed(1)}%</span>
            <span>{format(target)}{unit}</span>
          </div>
        </div>

        {showTrend && (
          <div className="flex items-center gap-2 text-sm">
            {getTrendIcon()}
            <span>
              {trendValue > 0 ? '+' : ''}{format(trendValue)}{unit} vs last period
            </span>
          </div>
        )}

        {isDanger && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            Over limit by {format(current - target)}{unit}
          </div>
        )}

        {isWarning && !isDanger && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            Approaching limit - {format(target - current)}{unit} remaining
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### Dashboard Integration
```tsx
// src/components/dashboard/ChartsSection.tsx
import { WKRUsageChart } from '@/components/charts/WKRUsageChart'
import { ExemptionsChart } from '@/components/charts/ExemptionsChart'
import { TransactionTimelineChart } from '@/components/charts/TransactionTimelineChart'
import { AccountCategoryChart } from '@/components/charts/AccountCategoryChart'
import { ProgressMeter } from '@/components/charts/ProgressMeter'
import { useDashboard } from './DashboardContext'

export function ChartsSection() {
  const { state } = useDashboard()

  if (!state.analysisResult) {
    return (
      <div className="text-center text-gray-500 py-8">
        No analysis data available for visualization
      </div>
    )
  }

  const { analysisResult, transactions } = state

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ProgressMeter
          title="Free Space Usage"
          current={analysisResult.calculations.usedSpace}
          target={analysisResult.calculations.freeSpace}
          unit="€"
          warningThreshold={85}
          dangerThreshold={100}
        />

        <ProgressMeter
          title="Analysis Confidence"
          current={analysisResult.confidence}
          target={100}
          unit="%"
          format={(value) => value.toFixed(0)}
          warningThreshold={70}
          dangerThreshold={50}
        />

        <div className="md:col-span-2 lg:col-span-1">
          <WKRUsageChart
            freeSpace={analysisResult.calculations.freeSpace}
            usedSpace={analysisResult.calculations.usedSpace}
            overage={Math.max(0, analysisResult.calculations.usedSpace - analysisResult.calculations.freeSpace)}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionTimelineChart
          transactions={transactions.map(tx => ({
            ...tx,
            isWKRRelevant: analysisResult.findings.find(f => f.transactionId === tx.transactionId)?.isWKRRelevant
          }))}
        />

        <AccountCategoryChart transactions={transactions} />
      </div>

      {/* Exemptions Chart */}
      {analysisResult.exemptions && analysisResult.exemptions.length > 0 && (
        <ExemptionsChart exemptions={analysisResult.exemptions} />
      )}
    </div>
  )
}
```

## Performance Optimization

### Chart Loading & Lazy Loading
```tsx
// src/components/charts/LazyChart.tsx
import { lazy, Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const ChartComponent = lazy(() => import('./WKRUsageChart'))

export function LazyWKRUsageChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartComponent {...props} />
    </Suspense>
  )
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}
```

## Testing

### Chart Component Tests
```tsx
// src/components/charts/__tests__/WKRUsageChart.test.tsx
import { render, screen } from '@testing-library/react'
import { WKRUsageChart } from '../WKRUsageChart'

describe('WKRUsageChart', () => {
  test('renders usage chart correctly', () => {
    render(
      <WKRUsageChart
        freeSpace={1000}
        usedSpace={800}
        overage={0}
      />
    )

    expect(screen.getByText('Free Space Usage')).toBeInTheDocument()
    expect(screen.getByText(/Used Space/)).toBeInTheDocument()
    expect(screen.getByText(/Remaining Space/)).toBeInTheDocument()
  })

  test('shows overage when exceeded', () => {
    render(
      <WKRUsageChart
        freeSpace={1000}
        usedSpace={1200}
        overage={200}
      />
    )

    expect(screen.getByText(/Overage/)).toBeInTheDocument()
  })
})
```

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "recharts": "^2.8.0",
    "date-fns": "^2.30.0"
  }
}
```

## Definition of Done
- [ ] Recharts integratie werkend
- [ ] Alle chart types geïmplementeerd
- [ ] Responsive design op alle schermgroottes
- [ ] Interactieve tooltips en hover effects
- [ ] Performance optimalisatie (lazy loading)
- [ ] Accessibility support (ARIA labels)
- [ ] Unit tests voor chart componenten
- [ ] Integration met dashboard context

## Performance Targets
- Chart render tijd: <200ms
- Responsive resize: <100ms
- Memory usage: <30MB voor alle charts
- 60fps tijdens animaties
- Lazy loading: <500ms initial load