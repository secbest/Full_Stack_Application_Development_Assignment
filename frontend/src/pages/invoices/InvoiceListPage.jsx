// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
// Invoice List (screen 9): 6-status filter + batch approve & sync.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, Eye, UploadCloud } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { listInvoices, batchApprove } from '@/api/ar'

const STATUSES = ['matched', 'adjusted', 'approved', 'synced_to_xero', 'failed', 'unmatched']
const money = (n) => `$${Number(n || 0).toFixed(2)}`

export default function InvoiceListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)

  async function fetchInvoices() {
    setLoading(true)
    try {
      const { data } = await listInvoices({ limit: 100 })
      setRows(data)
    } catch {
      toast.error('Failed to load invoices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoices() }, [])

  const filtered = useMemo(
    () => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows),
    [rows, statusFilter]
  )

  // Only matched/adjusted invoices are batch-approvable.
  const approvable = filtered.filter((r) => ['matched', 'adjusted'].includes(r.status))

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => {
      if (approvable.every((r) => prev.has(r.id)) && approvable.length > 0) return new Set()
      return new Set(approvable.map((r) => r.id))
    })
  }

  async function handleBatchApprove() {
    const ids = [...selected]
    if (ids.length === 0) { toast.error('Select at least one matched or adjusted invoice.'); return }
    setBusy(true)
    try {
      const result = await batchApprove(ids)
      const synced = result.queued_for_xero.length
      const skipped = result.skipped.length
      toast.success(`Approved ${result.approved.length}, synced ${synced} to Xero${skipped ? `, skipped ${skipped}` : ''}.`)
      setSelected(new Set())
      await fetchInvoices()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Batch approval failed.')
    } finally {
      setBusy(false)
    }
  }

  const counts = STATUSES.reduce((acc, s) => { acc[s] = rows.filter((r) => r.status === s).length; return acc }, {})

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
        </div>
        <button onClick={handleBatchApprove} disabled={busy || selected.size === 0} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
          <UploadCloud size={16} /> Batch Approve &amp; Sync ({selected.size})
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Queue</CardTitle>
          <CardDescription>Review matched invoices, adjust surcharges, batch approve and sync to Xero.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setStatusFilter('')} className={`h-8 px-3 rounded-full text-xs ${!statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All ({rows.length})</button>
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`h-8 px-3 rounded-full text-xs capitalize ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {s.replace(/_/g, ' ')} ({counts[s]})
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" onChange={toggleAll} checked={approvable.length > 0 && approvable.every((r) => selected.has(r.id))} />
                    </th>
                    {['Booking Ref', 'Client', 'Subtotal', 'Total', 'Status', 'Xero ID', 'Action'].map((c) => (
                      <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">No invoices.</td></tr>
                  ) : filtered.map((inv, idx) => {
                    const canSelect = ['matched', 'adjusted'].includes(inv.status)
                    return (
                      <tr key={inv.id} className={`h-12 hover:bg-slate-50/80 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" disabled={!canSelect} checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} />
                        </td>
                        <td className="px-4 py-2"><span className="text-xs font-semibold text-slate-900 font-mono">{inv.booking_reference || `INV#${inv.id}`}</span></td>
                        <td className="px-4 py-2"><span className="text-xs font-medium text-slate-800">{inv.client_name || '—'}</span></td>
                        <td className="px-4 py-2"><span className="text-xs text-slate-600">{money(inv.subtotal)}</span></td>
                        <td className="px-4 py-2"><span className="text-xs font-semibold text-slate-900">{money(inv.total_amount)}</span></td>
                        <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-2"><span className="text-xs text-slate-500 font-mono">{inv.xero_invoice_id || '—'}</span></td>
                        <td className="px-4 py-2">
                          <button onClick={() => navigate(`/invoices/${inv.id}`)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium transition-all">
                            <Eye size={12} /><span>View</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
