// Owner: Kwan Hua (Xero Foundation)
// Xero Sync Status (screen 14/19, shared AP + AR): stat cards, retry logic,
// max-retry warning (3 attempts).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, RefreshCw, AlertTriangle, ArrowLeft, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { listSyncLogs, retrySyncLog } from '@/api/xero'

const MAX_ATTEMPTS = 3
const STATUS_FILTERS = ['pending', 'success', 'failed']
const ENTITY_LABELS = { vendor_invoice: 'AP - Vendor Invoice', ar_invoice: 'AR Invoice' }

export default function XeroSyncStatusPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [xeroConnected, setXeroConnected] = useState(true)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [retryingId, setRetryingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const { data, xero_connected } = await listSyncLogs({
        limit: 100,
        status: statusFilter || undefined,
        entity_type: entityFilter || undefined,
      })
      setRows(data)
      setXeroConnected(xero_connected)
    } catch {
      toast.error('Failed to load Xero sync logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, entityFilter])

  const counts = useMemo(
    () => STATUS_FILTERS.reduce((acc, s) => { acc[s] = rows.filter((r) => r.status === s).length; return acc }, {}),
    [rows]
  )

  async function handleRetry(id) {
    setRetryingId(id)
    try {
      const result = await retrySyncLog(id)
      if (result.status === 'success') toast.success('Retry succeeded - synced to Xero.')
      else toast.error(`Retry failed: ${result.error_message || 'unknown error'}`)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Retry failed.')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <div className="p-6 space-y-4 font-sans">
      <button onClick={() => navigate('/settings/xero')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Xero Connection
      </button>

      <div className="flex items-center gap-3">
        <History className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Xero Sync Status</h1>
      </div>

      {!xeroConnected && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          <AlertTriangle size={16} /> Xero is not connected. Retries will fail until the Managing Director reconnects.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending" value={counts.pending} color="#F59E0B" />
        <StatCard label="Success" value={counts.success} color="#22C55E" />
        <StatCard label="Failed" value={counts.failed} color="#EF4444" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync Backlogs</CardTitle>
          <CardDescription>Unified sync log across AP vendor bills and AR invoices. Failed syncs can be retried up to {MAX_ATTEMPTS} times.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setStatusFilter('')} className={`h-8 px-3 rounded-full text-xs ${!statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All Statuses</button>
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`h-8 px-3 rounded-full text-xs capitalize ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{s}</button>
            ))}
            <span className="w-px h-5 bg-slate-200 mx-1" />
            <button onClick={() => setEntityFilter('')} className={`h-8 px-3 rounded-full text-xs ${!entityFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All Types</button>
            <button onClick={() => setEntityFilter('vendor_invoice')} className={`h-8 px-3 rounded-full text-xs ${entityFilter === 'vendor_invoice' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>AP</button>
            <button onClick={() => setEntityFilter('ar_invoice')} className={`h-8 px-3 rounded-full text-xs ${entityFilter === 'ar_invoice' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>AR</button>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Type', 'Reference', 'Status', 'Attempts', 'Xero ID', 'Error', 'Synced At', 'Action'].map((c) => (
                      <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">No sync activity yet.</td></tr>
                  ) : rows.map((log, idx) => (
                    <tr key={log.id} className={`h-12 hover:bg-slate-50/80 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span></td>
                      <td className="px-4 py-2"><span className="text-xs font-medium text-slate-800">{log.entity_reference || `#${log.entity_id}`}</span></td>
                      <td className="px-4 py-2"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${log.attempt_count >= MAX_ATTEMPTS ? 'text-rose-600' : 'text-slate-600'}`}>{log.attempt_count} / {MAX_ATTEMPTS}</span>
                      </td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-500 font-mono">{log.xero_record_id || '—'}</span></td>
                      <td className="px-4 py-2"><ErrorDetails message={log.error_message} /></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-500">{log.synced_at ? new Date(log.synced_at).toLocaleString() : '—'}</span></td>
                      <td className="px-4 py-2">
                        {log.status === 'failed' && (
                          log.retry_available ? (
                            <button onClick={() => handleRetry(log.id)} disabled={retryingId === log.id} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium transition-all disabled:opacity-40">
                              <RefreshCw size={12} /> {retryingId === log.id ? 'Retrying…' : 'Retry'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400" title="Max retries reached or Xero disconnected">Retry unavailable</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ErrorDetails({ message }) {
  if (!message) return <span className="text-xs text-slate-400">—</span>

  return (
    <details className="group min-w-[120px] max-w-[260px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-rose-600 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 [&::-webkit-details-marker]:hidden">
        View reason
        <ChevronDown size={13} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <p className="mt-2 whitespace-normal break-words rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs leading-relaxed text-rose-700">
        {message}
      </p>
    </details>
  )
}

function StatCard({ label, value, color }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase text-slate-500">{label}</div>
        <div className="text-2xl font-semibold mt-1" style={{ color }}>{value ?? 0}</div>
      </CardContent>
    </Card>
  )
}
