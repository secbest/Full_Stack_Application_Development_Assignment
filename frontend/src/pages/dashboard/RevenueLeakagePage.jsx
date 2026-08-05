// Owner: Kwan Hua.
// Revenue Leakage report - charges the crew recorded on a memo that the client's pricing
// contract had no rate for, so they never reached an invoice.
//
// The pricing engine has always refused to drop these silently (it persists them on the
// invoice as `unpriced_surcharges`), but nothing ever read that column. This screen is the
// read: how much is going unbilled, which surcharge causes it, and - the part that makes it
// actionable - which contract to fix first.
//
// Every amount here is an ESTIMATE and is labelled as one on screen. By definition these
// charges have no contracted rate, so the backend values each at the median rate other
// contracts charge for the same surcharge type, and separately counts what it cannot value
// at all. Presenting an estimate as a billed figure would be worse than showing nothing.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, AlertTriangle, Info, FileWarning, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/context/ToastContext'
import { getRevenueLeakage } from '@/api/leakage'

const money = (n) => `$${Number(n || 0).toFixed(2)}`

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function startOfYearISO() {
  return `${new Date().getFullYear()}-01-01`
}

// Ranges are expressed as YYYY-MM-DD strings because that is what the endpoint validates.
const PRESETS = [
  { id: 'ytd', label: 'Year to date', range: () => ({ date_from: startOfYearISO(), date_to: todayISO() }) },
  {
    id: 'this_month',
    label: 'This month',
    range: () => {
      const now = new Date()
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { date_from: first.toISOString().slice(0, 10), date_to: todayISO() }
    },
  },
  {
    id: 'last_90',
    label: 'Last 90 days',
    range: () => {
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      return { date_from: from.toISOString().slice(0, 10), date_to: todayISO() }
    },
  },
]

function StatCard({ icon: Icon, label, value, tone = 'default', hint }) {
  const toneClass = {
    default: 'text-foreground',
    danger: 'text-red-500',
    warning: 'text-amber-500',
  }[tone]
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon size={14} />
          {label}
        </div>
        <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function RevenueLeakagePage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [preset, setPreset] = useState('ytd')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load(presetId) {
    setLoading(true)
    try {
      const range = PRESETS.find((p) => p.id === presetId).range()
      setReport(await getRevenueLeakage(range))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load the revenue leakage report.')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(preset) }, [preset])

  const summary = report?.summary
  const hasLeakage = Boolean(summary && summary.unpriced_item_count > 0)

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Revenue Leakage</h1>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Charges recorded by the crew that no contract rate could price, so they never reached an invoice.
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`h-8 rounded-md border px-3 text-sm transition-colors ${
              preset === p.id
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-border bg-white text-muted-foreground hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading report...</p>}

      {!loading && report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={TrendingDown}
              label="Estimated leakage"
              value={money(summary.estimated_leakage)}
              tone={summary.estimated_leakage > 0 ? 'danger' : 'default'}
              hint={`${report.period.from} to ${report.period.to}`}
            />
            <StatCard
              icon={FileWarning}
              label="Affected invoices"
              value={summary.affected_invoice_count}
              hint={`${summary.unpriced_item_count} unpriced charge(s)`}
            />
            <StatCard
              icon={AlertTriangle}
              label="No reference rate"
              value={summary.items_without_reference_rate}
              tone={summary.items_without_reference_rate > 0 ? 'warning' : 'default'}
              hint="Counted but cannot be valued"
            />
            <StatCard
              icon={Info}
              label="No recorded quantity"
              value={summary.items_without_recorded_quantity}
              tone={summary.items_without_recorded_quantity > 0 ? 'warning' : 'default'}
              hint="Counted as 1 unit; understates leakage"
            />
          </div>

          {/* The single most useful sentence in the report: the biggest fix available. */}
          {hasLeakage && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex items-start gap-3 pt-6">
                <Wrench className="mt-0.5 w-5 h-5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Fix this first</p>
                  <p className="mt-1 text-sm text-muted-foreground">{summary.top_recommendation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!hasLeakage && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No unpriced surcharges were recorded in this period - every charge the crew logged was priced by a contract rate.
                </p>
              </CardContent>
            </Card>
          )}

          {hasLeakage && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By contract</CardTitle>
                  <CardDescription>
                    A contract missing a rate is the root cause - the same gap recurs on every job until the rate is added.
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Contract</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Missing rates</th>
                        <th className="py-2 pr-4">Invoices</th>
                        <th className="py-2 pr-4 text-right">Estimated</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.by_contract.map((row) => (
                        <tr key={`${row.contract_id ?? 'none'}-${row.client_id}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-medium text-foreground">{row.contract_name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.client_name || '-'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.missing_surcharge_types.length}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.affected_invoices}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-red-500">{money(row.estimated_amount)}</td>
                          <td className="py-2">
                            {row.contract_id && (
                              <button
                                onClick={() => navigate(`/pricing-contracts/${row.contract_id}`)}
                                className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
                              >
                                Open contract
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By surcharge type</CardTitle>
                  <CardDescription>Which charge is costing the most, across all clients.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Surcharge</th>
                        <th className="py-2 pr-4">Occurrences</th>
                        <th className="py-2 pr-4">Total quantity</th>
                        <th className="py-2 pr-4">Rate used</th>
                        <th className="py-2 pr-4 text-right">Estimated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.by_surcharge_type.map((row) => (
                        <tr key={row.surcharge_type} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-medium text-foreground">{row.label}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.occurrences}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.total_quantity}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.unit_rate === null
                              ? <span className="text-amber-600">no reference rate</span>
                              : `${money(row.unit_rate)} (peer median)`}
                          </td>
                          <td className="py-2 pr-4 text-right font-semibold text-red-500">{money(row.estimated_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Affected invoices</CardTitle>
                  <CardDescription>Largest estimated shortfall first.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Invoice</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4">Unpriced items</th>
                        <th className="py-2 pr-4 text-right">Estimated</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.affected_invoices.map((row) => (
                        <tr key={row.invoice_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-4 font-medium text-foreground">#{row.invoice_id}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.client_name || '-'}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.unpriced_count}</td>
                          <td className="py-2 pr-4 text-right font-semibold text-red-500">{money(row.estimated_amount)}</td>
                          <td className="py-2">
                            <button
                              onClick={() => navigate(`/invoices/${row.invoice_id}`)}
                              className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
                            >
                              View invoice
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}

          {/* Stated on screen, not just in the payload: these are estimates. */}
          <Card className="bg-slate-50">
            <CardContent className="flex items-start gap-3 pt-6">
              <Info className="mt-0.5 w-4 h-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">{report.basis_note}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
