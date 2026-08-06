import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import { PieChart, pieArcLabelClasses } from '@mui/x-charts/PieChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/context/ToastContext'
import { getFleetOverview, getCycleTime, getXeroHealth, getRevenueTrend, getTopClients } from '@/api/fieldOps'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
]

const STATUS_COLORS = { confirmed: '#3B82F6', in_progress: '#F59E0B', completed: '#22C55E', invoiced: '#94A3B8' }

// "in_progress" -> "In Progress" for the donut's legend/tooltip labels.
function formatStatusLabel(status) {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

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
  const [cycleTime, setCycleTime] = useState(null)
  const [xeroHealth, setXeroHealth] = useState(null)
  const [revenueTrend, setRevenueTrend] = useState(null)
  const [topClients, setTopClients] = useState(null)
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

  // These four are independent of the period filter above (each covers its own trailing
  // window or is a point-in-time snapshot), so they load once rather than re-fetching
  // on every Today/This Week/This Month click.
  async function loadAnalyticsWidgets() {
    try {
      const [cycleRes, xeroRes, trendRes, clientsRes] = await Promise.all([
        getCycleTime(), getXeroHealth(), getRevenueTrend(), getTopClients(),
      ])
      setCycleTime(cycleRes.data.data)
      setXeroHealth(xeroRes.data.data)
      setRevenueTrend(trendRes.data.data)
      setTopClients(clientsRes.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load some dashboard analytics.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    loadAnalyticsWidgets()
  }, [])

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

  // Zero-count statuses are dropped rather than passed through as 0-value arcs -
  // MUI still carves out a paddingAngle gap for each arc regardless of its value, so
  // with e.g. 1 total booking the other 3 statuses' phantom slices ate most of the
  // ring and left the real segment looking like a small wedge instead of a full circle.
  const pieData = overview.booking_status_breakdown
    .filter((b) => b.count > 0)
    .map((b) => ({
      id: b.status, value: b.count, label: formatStatusLabel(b.status), color: STATUS_COLORS[b.status],
    }))

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>{PERIODS.map((p) => <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total Bookings" value={overview.totals.bookings_total} />
        <KpiCard label="Active Jobs" value={overview.totals.active_jobs} valueColor="#F59E0B" />
        <KpiCard
          label="Pending Memo Submission"
          value={overview.totals.pending_memo_submission}
          valueColor="#EF4444"
          borderColor={overview.revenue_risk.warning ? '#EF4444' : undefined}
        />
        <KpiCard label="Invoices Synced" value={overview.totals.invoices_synced_to_xero} valueColor="#22C55E" />
        <KpiCard
          label="Average Billing Cycle"
          value={cycleTime && cycleTime.overall_average_days != null ? `${cycleTime.overall_average_days} days` : '—'}
        />
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle>Booking Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No bookings in this period.</p>
            ) : (
              <PieChart
                series={[{ data: pieData, innerRadius: 50, outerRadius: 90, paddingAngle: pieData.length > 1 ? 2 : 0, arcLabel: 'value', arcLabelMinAngle: 20 }]}
                height={260}
                sx={{ [`& .${pieArcLabelClasses.root}`]: { fill: '#FFFFFF', fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif" } }}
              />
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

      {xeroHealth && (
        <Card className={xeroHealth.counts.failed > 0 ? 'border-l-4' : undefined} style={xeroHealth.counts.failed > 0 ? { borderLeftColor: '#EF4444' } : undefined}>
          <CardHeader>
            <CardTitle>Xero Sync Health</CardTitle>
            <p className="text-xs text-muted-foreground">All time.</p>
          </CardHeader>
          <CardContent className="flex items-center gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Synced</p>
              <p className="text-2xl font-bold" style={{ color: '#22C55E' }}>{xeroHealth.counts.synced}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{xeroHealth.counts.pending}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold" style={{ color: xeroHealth.counts.failed > 0 ? '#EF4444' : '#1E293B' }}>{xeroHealth.counts.failed}</p>
            </div>
            <div className="ml-auto text-right">
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={xeroHealth.mode.simulated
                  ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }
                  : { background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
              >
                {xeroHealth.mode.label}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {xeroHealth.last_synced_at ? `Last sync: ${new Date(xeroHealth.last_synced_at).toLocaleString()}` : 'No successful sync yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <p className="text-xs text-muted-foreground">Trailing 12 months.</p>
          </CardHeader>
          <CardContent>
            {!revenueTrend || revenueTrend.trend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Not enough synced revenue yet to show a trend.</p>
            ) : (
              <LineChart
                height={220}
                xAxis={[{ scaleType: 'point', data: revenueTrend.trend.map((t) => t.bucket) }]}
                series={[{ data: revenueTrend.trend.map((t) => Number(t.total_revenue)), label: 'Revenue ($)', color: '#3B82F6' }]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Clients</CardTitle>
            <p className="text-xs text-muted-foreground">All time.</p>
          </CardHeader>
          <CardContent>
            {!topClients || topClients.top_clients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No synced invoices yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground text-left">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Invoiced Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.top_clients.map((c) => (
                    <tr key={c.client_id} className="border-t">
                      <td className="py-2">{c.client_name}</td>
                      <td className="py-2 text-right font-semibold">${Number(c.total_revenue).toFixed(2)}</td>
                      <td className="py-2 text-right text-muted-foreground">{c.booking_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
