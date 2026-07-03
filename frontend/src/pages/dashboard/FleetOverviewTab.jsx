import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import { PieChart } from '@mui/x-charts/PieChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/context/ToastContext'
import { getFleetOverview } from '@/api/fieldOps'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
]

const STATUS_COLORS = { confirmed: '#3B82F6', in_progress: '#F59E0B', completed: '#22C55E', invoiced: '#94A3B8' }

function KpiCard({ label, value, valueColor, borderColor }) {
  return (
    <Card className={borderColor ? 'border-l-4' : undefined} style={borderColor ? { borderLeftColor: borderColor } : undefined}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1" style={valueColor ? { color: valueColor } : undefined}>{value}</p>
      </CardContent>
    </Card>
  )
}

export default function FleetOverviewTab() {
  const [period, setPeriod] = useState('today')
  const [overview, setOverview] = useState(null)
  const [status, setStatus] = useState('loading')
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const { data } = await getFleetOverview({ period })
      setOverview(data.data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load fleet overview.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  if (status === 'loading') {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading fleet overview...</div>
  }
  if (status === 'error') {
    return (
      <Card><CardContent className="p-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Couldn't load the fleet overview.</p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4 mr-2" /> Retry</Button>
      </CardContent></Card>
    )
  }

  const pieData = overview.booking_status_breakdown.map((b) => ({
    id: b.status, value: b.count, label: b.status, color: STATUS_COLORS[b.status],
  }))

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>{PERIODS.map((p) => <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Total Bookings" value={overview.totals.bookings_total} />
        <KpiCard label="Active Jobs" value={overview.totals.active_jobs} valueColor="#F59E0B" />
        <KpiCard
          label="Pending Memo Submission"
          value={overview.totals.pending_memo_submission}
          valueColor="#EF4444"
          borderColor={overview.revenue_risk.warning ? '#EF4444' : undefined}
        />
        <KpiCard label="Invoices Synced" value={overview.totals.invoices_synced_to_xero} valueColor="#22C55E" />
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle>Booking Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.every((d) => d.value === 0) ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No bookings in this period.</p>
            ) : (
              <PieChart series={[{ data: pieData, innerRadius: 50, outerRadius: 90, paddingAngle: 2 }]} height={260} />
            )}
          </CardContent>
        </Card>

        <Card className={overview.revenue_risk.warning ? 'border-l-4' : undefined} style={overview.revenue_risk.warning ? { borderLeftColor: '#EF4444' } : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {overview.revenue_risk.warning && <AlertTriangle className="w-4 h-4 text-[#EF4444]" />}
              Revenue Leakage Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.revenue_risk.warning ? (
              <p className="text-sm text-[#EF4444]">
                {overview.revenue_risk.completed_without_memo} completed job(s) have no memo submitted yet.
              </p>
            ) : (
              <p className="text-sm text-[#22C55E]">All completed jobs have memos.</p>
            )}
            <p className="text-xs text-muted-foreground mt-3">Source: booking data. Read-only view.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
