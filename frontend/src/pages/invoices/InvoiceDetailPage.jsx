// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
// Invoice Detail (screen 10): line items (Auto/Manual badges), adjustments, approve & sync, retry.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UploadCloud, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { getInvoice, addLineItem, deleteLineItem, batchApprove, retryXero } from '@/api/ar'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
const LOCKED = ['approved', 'synced_to_xero']

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ description: '', quantity: '1', unit_price: '' })

  async function load() {
    setLoading(true)
    try {
      setInvoice(await getInvoice(id))
    } catch {
      toast.error('Failed to load invoice.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const locked = invoice && LOCKED.includes(invoice.status)

  async function handleAdd() {
    const quantity = Number(form.quantity)
    const unit_price = Number(form.unit_price)
    if (!form.description.trim() || !(quantity > 0) || !(unit_price > 0)) {
      toast.error('Enter a description and positive quantity and unit price.')
      return
    }
    setBusy(true)
    try {
      await addLineItem(invoice.id, { description: form.description.trim(), quantity, unit_price })
      toast.success('Manual adjustment added.')
      setForm({ description: '', quantity: '1', unit_price: '' })
      setAdding(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add line item.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(itemId) {
    setBusy(true)
    try {
      await deleteLineItem(invoice.id, itemId)
      toast.success('Line item removed.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove line item.')
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    setBusy(true)
    try {
      const result = await batchApprove([invoice.id])
      if (result.queued_for_xero.includes(invoice.id)) toast.success('Invoice approved and synced to Xero.')
      else if (result.approved.includes(invoice.id)) toast.error('Approved, but the Xero sync failed. Retry from the invoice.')
      else toast.error('Invoice could not be approved in its current status.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry() {
    setBusy(true)
    try {
      await retryXero(invoice.id)
      toast.success('Xero sync succeeded.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xero sync failed again.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  if (!invoice) return <div className="p-6 text-sm text-slate-400">Invoice not found.</div>

  return (
    <div className="p-6 space-y-4 font-sans">
      <button onClick={() => navigate('/invoices')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Invoices
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Invoice #{invoice.id}</h1>
          <div className="text-sm text-slate-500">{invoice.booking_reference} · {invoice.client_name}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          {['matched', 'adjusted'].includes(invoice.status) && (
            <button onClick={handleApprove} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
              <UploadCloud size={16} /> Approve &amp; Sync
            </button>
          )}
          {invoice.status === 'failed' && (
            <button onClick={handleRetry} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 disabled:opacity-40">
              <RefreshCw size={16} /> Retry Xero Sync
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Client" value={invoice.client_name} />
            <Row label="Booking" value={invoice.booking_reference} />
            <Row label="Contract" value={invoice.contract_name || '—'} />
            <Row label="Memo ID" value={`#${invoice.memo_id}`} />
            <div className="border-t border-slate-100 pt-3" />
            <Row label="Subtotal" value={money(invoice.subtotal)} />
            <Row label="Tax" value={money(invoice.tax_amount)} />
            <Row label="Total" value={money(invoice.total_amount)} bold />
            {invoice.xero_invoice_id && <Row label="Xero ID" value={invoice.xero_invoice_id} mono />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            {!locked && (
              <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium">
                <Plus size={12} /> Add Adjustment
              </button>
            )}
          </CardHeader>
          <CardContent>
            {locked && <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">This invoice is {invoice.status.replace(/_/g, ' ')} - line items are locked.</div>}

            {adding && !locked && (
              <div className="mb-3 grid grid-cols-[2fr_0.7fr_0.9fr_auto] gap-2 items-end rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs text-slate-500">Description
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
                </label>
                <label className="text-xs text-slate-500">Qty
                  <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
                </label>
                <label className="text-xs text-slate-500">Unit Price
                  <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
                </label>
                <button onClick={handleAdd} disabled={busy} className="h-9 px-4 rounded-md bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-40">Add</button>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Description', 'Source', 'Qty', 'Unit', 'Amount', ''].map((c) => (
                      <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">No line items (unmatched invoice - add adjustments manually).</td></tr>
                  ) : invoice.line_items.map((li) => (
                    <tr key={li.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-sm text-slate-800">{li.description}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${li.is_manual_adjustment ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {li.is_manual_adjustment ? 'Manual' : 'Auto'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-600">{Number(li.quantity)}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">{money(li.unit_price)}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">{money(li.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {li.is_manual_adjustment && !locked && (
                          <button onClick={() => handleDelete(li.id)} disabled={busy} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value, bold, mono }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-slate-900' : 'text-slate-800'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
