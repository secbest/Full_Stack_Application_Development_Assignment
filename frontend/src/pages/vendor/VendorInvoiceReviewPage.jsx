// Owner: Kwan Hua (AP Specialist)
// AP Invoice Review (screen 17): two equal panels - PDF viewer left, AI-extracted
// editable fields right. Rebate auto-calculation, low-confidence flag, approve/reject/reextract.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, UploadCloud, XCircle, AlertTriangle, ExternalLink, Pencil, Check, X as XIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import {
  getVendorInvoice,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
  updateVendorInvoiceItem,
} from '@/api/vendor'

const money = (n) => (n === null || n === undefined ? '—' : `$${Number(n).toFixed(2)}`)
const EDITABLE_STATUSES = ['pending_review', 'extraction_failed']

export default function VendorInvoiceReviewPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [editingItemId, setEditingItemId] = useState(null)
  const [itemForm, setItemForm] = useState({})

  async function load() {
    setLoading(true)
    try {
      const data = await getVendorInvoice(id)
      setInvoice(data)
      setForm({
        vendor_name: data.vendor_name || '',
        invoice_number: data.invoice_number || '',
        invoice_date: data.invoice_date || '',
        extracted_total: data.extracted_total ?? '',
        rebate_percentage: data.rebate_percentage ?? '1.00',
      })
    } catch {
      toast.error('Failed to load vendor invoice.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const editable = invoice && EDITABLE_STATUSES.includes(invoice.status)

  async function handleSaveHeader() {
    setBusy(true)
    try {
      await updateVendorInvoice(invoice.id, form)
      toast.success('Changes saved. Rebate recalculated.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save changes.')
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    setBusy(true)
    try {
      const result = await approveVendorInvoice(invoice.id)
      if (result.status === 'synced_to_xero') toast.success('Approved and synced to Xero.')
      else toast.error(`Approved, but the Xero sync failed: ${result.sync_log?.error_message || 'unknown error'}. Retry from Xero Sync Status.`)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { toast.error('Enter a reason for rejecting this invoice.'); return }
    setBusy(true)
    try {
      await rejectVendorInvoice(invoice.id, rejectReason.trim())
      toast.success('Invoice rejected.')
      setRejecting(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject invoice.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReextract() {
    setBusy(true)
    try {
      await reextractVendorInvoice(invoice.id)
      toast.success('Re-extraction complete.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Re-extraction failed again.')
    } finally {
      setBusy(false)
    }
  }

  function startEditItem(item) {
    setEditingItemId(item.id)
    setItemForm({ description: item.description, quantity: item.quantity, unit_price: item.unit_price, amount: item.amount })
  }

  async function saveItem() {
    setBusy(true)
    try {
      await updateVendorInvoiceItem(editingItemId, itemForm)
      toast.success('Line item updated.')
      setEditingItemId(null)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update line item.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  if (!invoice) return <div className="p-6 text-sm text-slate-400">Vendor invoice not found.</div>

  return (
    <div className="p-6 space-y-4 font-sans">
      <button onClick={() => navigate('/vendor-invoices')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Vendor Invoices
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{invoice.vendor_name}</h1>
          <div className="text-sm text-slate-500">{invoice.invoice_number}</div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={invoice.status} />
          {invoice.status === 'pending_review' && (
            <button onClick={handleApprove} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
              <UploadCloud size={16} /> Approve &amp; Sync
            </button>
          )}
          {editable && (
            <button onClick={() => setRejecting(true)} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 disabled:opacity-40">
              <XCircle size={16} /> Reject
            </button>
          )}
        </div>
      </div>

      {invoice.is_low_confidence && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={14} /> Low-confidence extraction ({Math.round((invoice.extraction_confidence || 0) * 100)}%) - please verify every field before approving.
        </div>
      )}
      {invoice.status === 'extraction_failed' && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          <span className="flex items-center gap-2"><AlertTriangle size={14} /> Gemini could not extract data from this PDF. Enter fields manually or retry extraction.</span>
          <button onClick={handleReextract} disabled={busy} className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 disabled:opacity-40">
            <RefreshCw size={12} /> Retry Extraction
          </button>
        </div>
      )}
      {invoice.status === 'rejected' && invoice.rejection_reason && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
          <span className="font-medium">Rejection reason:</span> {invoice.rejection_reason}
        </div>
      )}
      {invoice.status === 'synced_to_xero' && invoice.xero_bill_id && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
          Synced to Xero - Bill ID <span className="font-mono">{invoice.xero_bill_id}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: PDF viewer */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Source Document</CardTitle>
            <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink size={12} /> Open in new tab
            </a>
          </CardHeader>
          <CardContent className="p-0">
            <iframe title="Vendor invoice PDF" src={invoice.pdf_url} className="w-full" style={{ height: '640px', border: 'none' }} />
          </CardContent>
        </Card>

        {/* Right: extracted fields + rebate + line items */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Extracted Fields</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Vendor Name" value={form.vendor_name} editable={editable} onChange={(v) => setForm({ ...form, vendor_name: v })} />
              <Field label="Invoice Number" value={form.invoice_number} editable={editable} onChange={(v) => setForm({ ...form, invoice_number: v })} />
              <Field label="Invoice Date" type="date" value={form.invoice_date} editable={editable} onChange={(v) => setForm({ ...form, invoice_date: v })} />
              <Field label="Extracted Total" type="number" value={form.extracted_total} editable={editable} onChange={(v) => setForm({ ...form, extracted_total: v })} />
              <Field label="Rebate %" type="number" value={form.rebate_percentage} editable={editable} onChange={(v) => setForm({ ...form, rebate_percentage: v })} />

              {editable && (
                <button onClick={handleSaveHeader} disabled={busy} className="w-full h-9 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
                  Save Changes
                </button>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <Row label="Confidence" value={invoice.extraction_confidence !== null ? `${Math.round(invoice.extraction_confidence * 100)}%` : '—'} />
                <Row label="Rebate Amount" value={money(invoice.rebate_amount)} />
                <Row label="Verified Total" value={money(invoice.verified_total)} bold />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      {['Description', 'Qty', 'Unit', 'Amount', ''].map((c) => (
                        <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">No line items extracted.</td></tr>
                    ) : invoice.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0">
                        {editingItemId === item.id ? (
                          <>
                            <td className="px-3 py-2"><input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} className="w-16 h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })} className="w-20 h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={itemForm.amount} onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })} className="w-20 h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button onClick={saveItem} disabled={busy} className="text-emerald-600 hover:text-emerald-700 mr-2"><Check size={14} /></button>
                              <button onClick={() => setEditingItemId(null)} className="text-slate-400 hover:text-slate-600"><XIcon size={14} /></button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-sm text-slate-800">{item.description}</td>
                            <td className="px-3 py-2 text-sm text-slate-600">{Number(item.quantity)}</td>
                            <td className="px-3 py-2 text-sm text-slate-600">{money(item.unit_price)}</td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-900">{money(item.amount)}</td>
                            <td className="px-3 py-2 text-right">
                              {editable && (
                                <button onClick={() => startEditItem(item)} className="text-slate-400 hover:text-blue-600"><Pencil size={14} /></button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4 text-lg font-semibold text-slate-900">Reject Vendor Invoice</div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-600">This invoice will be excluded from the AP sync queue but remains visible in the audit log.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Reason for rejection…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setRejecting(false)} className="h-10 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={handleReject} disabled={busy} className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 disabled:opacity-40">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, editable, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  )
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
