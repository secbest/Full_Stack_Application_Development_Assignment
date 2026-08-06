// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
// Invoice Detail (screen 10): line items (Auto/Manual badges), adjustments, approve & sync, retry.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UploadCloud, RefreshCw, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/StatusBadge'
import { NumberStepper } from '@/components/NumberStepper'
import { useToast } from '@/context/ToastContext'
import { getInvoice, rematchInvoice, addLineItem, deleteLineItem, batchApprove, retryXero } from '@/api/ar'
import { SURCHARGE_TYPES } from '@/validation/contractValidation'
import { SURCHARGE_TYPE_LABELS, SURCHARGE_DEFAULT_AMOUNTS } from '@/lib/contractLabels'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
// Realistic ceilings for a manual adjustment - mirror backend/src/controllers/invoiceController.js.
const MAX_UNIT_PRICE = 50000
const MAX_QUANTITY = 999
const LOCKED = ['approved', 'synced_to_xero']
const LOCKED_STATUS_LABELS = {
  approved: 'approved',
  synced_to_xero: 'synced to Xero',
}
// 'other' isn't a real surcharge_type - it just tells the form to leave description/
// unit_price blank for manual entry instead of auto-filling from the published schedule.
const ADJUSTMENT_TYPE_OPTIONS = [...SURCHARGE_TYPES, 'other']
const ADJUSTMENT_TYPE_LABELS = { ...SURCHARGE_TYPE_LABELS, other: 'Other (custom)' }

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState('')
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

  // Picking a published surcharge type pre-fills description + its default amount as a
  // starting point (still editable below) - "other" leaves both blank for a genuinely
  // ad-hoc charge, since this form exists precisely for cases the pricing engine didn't cover.
  function handleTypeChange(type) {
    setAdjustmentType(type)
    if (type === 'other') {
      setForm({ description: '', quantity: '1', unit_price: '' })
    } else {
      const preset = SURCHARGE_DEFAULT_AMOUNTS[type]
      setForm({ description: SURCHARGE_TYPE_LABELS[type], quantity: '1', unit_price: preset != null ? preset.toFixed(2) : '' })
    }
  }

  async function handleAdd() {
    const quantity = Number(form.quantity)
    const unit_price = Number(form.unit_price)
    if (!form.description.trim() || !(quantity > 0) || !(unit_price > 0)) {
      toast.error('Enter a description and positive quantity and unit price.')
      return
    }
    if (quantity > MAX_QUANTITY) {
      toast.error(`Quantity cannot exceed ${MAX_QUANTITY}.`)
      return
    }
    if (unit_price > MAX_UNIT_PRICE) {
      toast.error(`Unit price cannot exceed $${MAX_UNIT_PRICE.toLocaleString()}.`)
      return
    }
    setBusy(true)
    try {
      await addLineItem(invoice.id, { description: form.description.trim(), quantity, unit_price })
      toast.success('Manual adjustment added.')
      setForm({ description: '', quantity: '1', unit_price: '' })
      setAdjustmentType('')
      setAdding(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add line item.')
    } finally {
      setBusy(false)
    }
  }

  function handleCloseAdjustment() {
    setAdding(false)
    setAdjustmentType('')
    setForm({ description: '', quantity: '1', unit_price: '' })
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

  async function handleRematch() {
    setBusy(true)
    try {
      const result = await rematchInvoice(invoice.id)
      if (result.warning) toast.warning(`Invoice matched. ${result.warning.message}`)
      else toast.success('Invoice matched successfully using the active pricing contract.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'The invoice still could not be matched.')
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
          {invoice.status === 'unmatched' && (
            <button onClick={handleRematch} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-40">
              <RefreshCw size={16} /> Retry Match
            </button>
          )}
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

      {invoice.status === 'unmatched' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">Automatic pricing needs a contract or matching rate</p>
            <p className="mt-0.5 text-xs text-amber-800">
              Create or update the client's pricing contract so it covers the booking's service date and memo combination, then select Retry Match. You can also price every charge manually below.
            </p>
          </div>
          <button onClick={() => navigate('/pricing-contracts')} className="mt-3 shrink-0 rounded-md border border-amber-400 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 sm:mt-0">
            View Pricing Contracts
          </button>
        </div>
      )}

      {/* Charges the crew recorded that this contract has no rate for. Without this the
          engine would drop them silently, which is the exact revenue leakage the platform
          exists to prevent - so it is a prominent warning, not a footnote. */}
      {invoice.unpriced_surcharges?.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900">
            {invoice.unpriced_surcharges.length} recorded charge{invoice.unpriced_surcharges.length > 1 ? 's' : ''} awaiting pricing
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            {invoice.contract_name
              ? 'The crew recorded these on the memo, but the matched contract has no rate for them.'
              : 'The crew recorded these on the memo, but no active contract was available to price them.'}{' '}
            They are <strong>not</strong> included in the total. Add them as adjustments below, or add the missing rates and select Retry Match while the invoice is unmatched.
          </p>
          <ul className="mt-2 space-y-1">
            {invoice.unpriced_surcharges.map((u) => (
              <li key={u.surcharge_type} className="text-xs text-amber-900">
                <span className="font-medium">{u.label}</span>
                {u.detail ? <span className="text-amber-700"> - {u.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

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
            <Row
              label={invoice.gst_rate_percent === null || invoice.gst_rate_percent === undefined
                ? 'GST'
                : `GST (${Number(invoice.gst_rate_percent)}%)`}
              value={money(invoice.tax_amount)}
            />
            <Row label="Total" value={money(invoice.total_amount)} bold />
            {invoice.xero_invoice_id && <Row label="Xero ID" value={invoice.xero_invoice_id} mono />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            {!locked && (
              <div className="flex items-center gap-2">
                <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium">
                  <Plus size={12} /> Add Adjustment
                </button>
                {adding && (
                  <button onClick={handleCloseAdjustment} className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-medium">
                    <X size={12} /> Close
                  </button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {locked && <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">This invoice has been {LOCKED_STATUS_LABELS[invoice.status] || invoice.status.replace(/_/g, ' ')} - line items are locked.</div>}

            {adding && !locked && (
              <div className="mb-3 grid grid-cols-[1.3fr_1.7fr_0.7fr_0.9fr_auto] gap-2 items-end rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="text-xs text-slate-500">Type
                  <Select value={adjustmentType} onValueChange={handleTypeChange}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {ADJUSTMENT_TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{ADJUSTMENT_TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="text-xs text-slate-500">Description
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-500" />
                </label>
                <label className="text-xs text-slate-500">Qty
                  <NumberStepper value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} min={0} max={MAX_QUANTITY} step={1} bigStep={10} ariaLabel="Quantity" className="mt-1 w-full h-9" />
                </label>
                <label className="text-xs text-slate-500">Unit Price
                  <NumberStepper value={form.unit_price} onChange={(v) => setForm({ ...form, unit_price: v })} min={0} max={MAX_UNIT_PRICE} step={1} bigStep={10} decimals={2} placeholder="0.00" ariaLabel="Unit price" className="mt-1 w-full h-9" />
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
                      <td className="px-3 py-2"><SourceBadge item={li} /></td>
                      <td className="px-3 py-2 text-sm text-slate-600">{Number(li.quantity)}</td>
                      <td className="px-3 py-2 text-sm text-slate-600">
                        {money(li.unit_price)}
                        {/* The engine's original figure, kept visible so an overridden rate is
                            reviewable rather than merely flagged. */}
                        {li.was_manually_edited && li.engine_unit_price != null && (
                          <span className="ml-1 text-[11px] text-slate-400 line-through">{money(li.engine_unit_price)}</span>
                        )}
                      </td>
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

/**
 * Line-item provenance. Three states, not two: a row the engine produced, a row the engine
 * produced that someone then overrode, and a row added by hand. Collapsing the middle case
 * into "Auto" made the invoice assert the pricing engine had calculated a figure a person
 * had actually typed - a false attribution on the one screen whose job is to be auditable.
 */
function SourceBadge({ item }) {
  const variant = item.is_manual_adjustment
    ? { label: 'Manual', className: 'bg-amber-100 text-amber-700', title: 'Added by hand by the AR Specialist' }
    : item.was_manually_edited
      ? { label: 'Auto · edited', className: 'bg-orange-100 text-orange-800', title: 'Generated by the pricing engine, then overridden by hand' }
      : { label: 'Auto', className: 'bg-blue-100 text-blue-700', title: 'Calculated by the pricing engine from the contract' }

  return (
    <span title={variant.title} className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${variant.className}`}>
      {variant.label}
    </span>
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
