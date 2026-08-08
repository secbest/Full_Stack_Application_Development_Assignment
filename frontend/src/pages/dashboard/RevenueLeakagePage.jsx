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
import { TrendingDown, AlertTriangle, Info, FileWarning, Wrench, CheckCircle2, Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/context/ToastContext'
import { getRevenueLeakage, dismissLeakage, restoreLeakage } from '@/api/leakage'

const money = (n) => `$${Number(n || 0).toFixed(2)}`

// Local calendar day, not the UTC one. toISOString() converts first, so in Singapore
// (UTC+8) any time before 08:00 would send yesterday's date as the range end and silently
// drop today's invoices from the report - the same defect fixed in the backend's
// utils/date.js.
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  // The row being written off, and the reason typed for it. Held here rather than in a
  // per-row component so only one dismissal can be in flight at a time.
  const [dismissing, setDismissing] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDismissed, setShowDismissed] = useState(false)

  async function confirmDismiss() {
    setBusy(true)
    try {
      await dismissLeakage(dismissing.invoice_id, reason.trim())
      toast.success(`Invoice #${dismissing.invoice_id} closed - ${money(dismissing.estimated_amount)} written off the open figure.`)
      setDismissing(null)
      setReason('')
      await load(preset)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dismiss this leakage row.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(row) {
    setBusy(true)
    try {
      await restoreLeakage(row.invoice_id)
      toast.success(`Invoice #${row.invoice_id} reopened - back on the active figure.`)
      await load(preset)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reopen this leakage row.')
    } finally {
      setBusy(false)
    }
  }

  async function load(presetId) {
    setLoading(true)
    try {
      const range = PRESETS.find((p) => p.id === presetId).range()
      const result = await getRevenueLeakage(range)
      // Guard the shape rather than trusting it: every read below assumes `summary` and the
      // three breakdown arrays exist, so a malformed payload would throw during render and
      // blank the whole screen instead of showing an error the user can act on.
      if (!result || !result.summary) throw new Error('The revenue leakage report came back in an unexpected shape.')
      setReport({
        ...result,
        by_surcharge_type: result.by_surcharge_type ?? [],
        by_contract: result.by_contract ?? [],
        affected_invoices: result.affected_invoices ?? [],
        dismissed: result.dismissed ?? { count: 0, estimated_amount: 0, rows: [] },
        period: result.period ?? {},
      })
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to load the revenue leakage report.')
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

      {!loading && !report && (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Could not load the report</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The details are in the notification above. Check that the backend is running, then try again.
              </p>
              <button
                onClick={() => load(preset)}
                className="mt-3 h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
              >
                Retry
              </button>
            </div>
          </CardContent>
        </Card>
      )}

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
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => navigate(`/invoices/${row.invoice_id}`)}
                                className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
                              >
                                View invoice
                              </button>
                              {/* Closing the loop: a gap that has been billed separately or
                                  written off stops inflating the open figure. */}
                              <button
                                onClick={() => { setDismissing(row); setReason('') }}
                                className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
                              >
                                Dismiss
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}

          {/* Closed rows: reported, never merged into the open figure. A write-off that
              disappeared entirely would look identical to a gap that was actually fixed. */}
          {report.dismissed.count > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Closed ({report.dismissed.count})
                    </CardTitle>
                    <CardDescription>
                      {money(report.dismissed.estimated_amount)} reviewed and closed - excluded from the estimated leakage above.
                    </CardDescription>
                  </div>
                  <button
                    onClick={() => setShowDismissed((v) => !v)}
                    className="h-8 shrink-0 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100"
                  >
                    {showDismissed ? 'Hide' : 'Show'}
                  </button>
                </div>
              </CardHeader>
              {showDismissed && (
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4">Invoice</th>
                        <th className="py-2 pr-4">Client</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">Reason</th>
                        <th className="py-2 pr-4">Closed by</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.dismissed.rows.map((row) => (
                        <tr key={row.invoice_id} className="border-b border-slate-100">
                          <td className="py-2 pr-4 font-medium text-foreground">#{row.invoice_id}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.client_name || '-'}</td>
                          <td className="py-2 pr-4 text-right text-muted-foreground line-through">{money(row.estimated_amount)}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{row.dismissed_reason}</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.dismissed_by?.name || 'Unknown'}
                            {row.dismissed_at && (
                              <span className="block text-xs text-slate-400">
                                {new Date(row.dismissed_at).toLocaleDateString()}
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleRestore(row)}
                              disabled={busy}
                              className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-slate-100 disabled:opacity-40"
                            >
                              <Undo2 size={12} /> Reopen
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>
          )}

          {/* Stated on screen, not just in the payload: these are estimates. */}
          <Card className="bg-slate-50">
            <CardContent className="flex items-start gap-3 pt-6">
              <Info className="mt-0.5 w-4 h-4 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-relaxed text-muted-foreground">{report.basis_note}</p>
            </CardContent>
          </Card>

          {/* The reason is mandatory (backend enforces min 10 chars). This is a decision
              that money will not be collected, so it has to carry an author and a why. */}
          {dismissing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
              <Card className="w-full max-w-lg">
                <CardHeader>
                  <CardTitle className="text-base">Dismiss leakage on invoice #{dismissing.invoice_id}</CardTitle>
                  <CardDescription>
                    {dismissing.client_name || 'Unknown client'} · {money(dismissing.estimated_amount)} across {dismissing.unpriced_count} unpriced item(s).
                    This removes the amount from the open figure. The record of what went unbilled is kept, and this can be reopened.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="dismiss-reason">
                    Reason (required)
                  </label>
                  <textarea
                    id="dismiss-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Billed separately on INV-204, or written off - invoice already issued in Xero."
                    className="w-full rounded-lg border border-border p-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-muted-foreground">{reason.trim().length}/10 characters minimum</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setDismissing(null); setReason('') }}
                      className="h-9 rounded-md border border-border px-4 text-sm text-muted-foreground hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDismiss}
                      disabled={busy || reason.trim().length < 10}
                      className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      Dismiss &amp; close
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
