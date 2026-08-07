// Owner: Kwan Hua (AP Specialist)
// AP Invoice Review (screen 17): two equal panels - PDF viewer left, AI-extracted
// editable fields right. Rebate auto-calculation, low-confidence flag, approve/reject/reextract.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, UploadCloud, XCircle, AlertTriangle, ExternalLink, Pencil, Check, X as XIcon, History, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/context/ToastContext'
import {
  getVendorInvoice,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
  createVendorInvoiceItem,
  updateVendorInvoiceItem,
  deleteVendorInvoiceItem,
} from '@/api/vendor'
import { getXeroExpenseAccounts } from '@/api/xero'

const money = (n) => (n === null || n === undefined ? '—' : `$${Number(n).toFixed(2)}`)
const EDITABLE_STATUSES = ['pending_review', 'extraction_failed', 'failed']
const REJECTABLE_STATUSES = ['pending_review', 'extraction_failed']
const EMPTY_LINE_ITEM = { description: '', quantity: '1', unit_price: '' }

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
  const [addingItem, setAddingItem] = useState(false)
  const [newItemForm, setNewItemForm] = useState(EMPTY_LINE_ITEM)
  const [deleteItemTarget, setDeleteItemTarget] = useState(null)
  const [confirmingReextract, setConfirmingReextract] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [confirmedLowConfidence, setConfirmedLowConfidence] = useState(false)
  const [expenseAccounts, setExpenseAccounts] = useState([])
  const [expenseAccountsLoading, setExpenseAccountsLoading] = useState(true)
  const [expenseAccountsError, setExpenseAccountsError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await getVendorInvoice(id)
      setInvoice(data)
      setForm({
        vendor_name: data.vendor_name || '',
        invoice_number: data.invoice_number || '',
        invoice_date: data.invoice_date || '',
        due_date: data.due_date || '',
        currency_code: data.currency_code || 'SGD',
        supplier_gst_registration_no: data.supplier_gst_registration_no || '',
        gst_treatment: data.gst_treatment || 'non_gst',
        xero_account_code: data.xero_account_code || '',
        subtotal_excluding_gst: data.subtotal_excluding_gst ?? '',
        gst_amount: data.gst_amount ?? '',
        total_including_gst: data.total_including_gst ?? data.extracted_total ?? '',
        rebate_percentage: data.rebate_percentage ?? '1.00',
      })
      setIsDirty(false)
      setConfirmedLowConfidence(false)
    } catch {
      toast.error('Failed to load vendor invoice.')
    } finally {
      setLoading(false)
    }
  }

  async function loadExpenseAccounts() {
    setExpenseAccountsLoading(true)
    try {
      const data = await getXeroExpenseAccounts()
      setExpenseAccounts(data.accounts || [])
      setExpenseAccountsError('')
    } catch (err) {
      setExpenseAccounts([])
      setExpenseAccountsError(err.response?.data?.message || 'Unable to load expense accounts from Xero.')
    } finally {
      setExpenseAccountsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadExpenseAccounts()
  }, [id])

  const editable = invoice && EDITABLE_STATUSES.includes(invoice.status)
  const canReject = invoice && REJECTABLE_STATUSES.includes(invoice.status)
  const approvalValidation = invoice?.approval_validation || { can_approve: false, issues: [] }
  const xeroAccountValid = Boolean(
    form?.xero_account_code
    && expenseAccounts.some((account) => account.code === String(form.xero_account_code))
  )
  const xeroAccountIssue = !expenseAccountsLoading && (!xeroAccountValid || Boolean(expenseAccountsError))

  function changeField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setIsDirty(true)
  }

  async function handleSaveHeader() {
    setBusy(true)
    try {
      await updateVendorInvoice(invoice.id, form)
      toast.success(invoice.status === 'failed'
        ? 'Changes saved. Retry the Xero sync from Sync Status.'
        : 'Changes saved. Rebate recalculated.')
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
      const result = await approveVendorInvoice(invoice.id, confirmedLowConfidence)
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
    setConfirmingReextract(false)
    setBusy(true)
    try {
      await reextractVendorInvoice(invoice.id)
      toast.success('Re-extraction complete.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Re-extraction failed. Your existing invoice data was kept.')
    } finally {
      setBusy(false)
    }
  }

  function requestReextract() {
    if (isDirty) {
      toast.error('Save or discard the current header changes before retrying extraction.')
      return
    }
    setConfirmingReextract(true)
  }

  function startEditItem(item) {
    if (isDirty) {
      toast.error('Save the header changes before editing line items.')
      return
    }
    setAddingItem(false)
    setEditingItemId(item.id)
    setItemForm({ description: item.description, quantity: item.quantity, unit_price: item.unit_price, amount: item.amount })
  }

  function startAddItem() {
    if (isDirty) {
      toast.error('Save the header changes before adding line items.')
      return
    }
    setEditingItemId(null)
    setAddingItem(true)
  }

  function validLineItem(values) {
    const quantity = Number(values.quantity)
    const unitPrice = Number(values.unit_price)
    if (!values.description.trim()) {
      toast.error('Enter a line item description.')
      return false
    }
    if (values.quantity === '' || !Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Quantity must be greater than zero.')
      return false
    }
    if (values.unit_price === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
      toast.error('Unit price cannot be negative.')
      return false
    }
    return true
  }

  async function addItem() {
    if (!validLineItem(newItemForm)) return
    setBusy(true)
    try {
      await createVendorInvoiceItem(invoice.id, newItemForm)
      toast.success(invoice.status === 'extraction_failed'
        ? 'Line item added. The invoice is ready for review.'
        : invoice.status === 'failed'
          ? 'Line item added. Retry the Xero sync from Sync Status.'
          : 'Line item added.')
      setAddingItem(false)
      setNewItemForm(EMPTY_LINE_ITEM)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add line item.')
    } finally {
      setBusy(false)
    }
  }

  async function saveItem() {
    if (!validLineItem(itemForm)) return
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

  async function removeItem() {
    if (!deleteItemTarget) return
    if (isDirty) {
      toast.error('Save the header changes before deleting line items.')
      setDeleteItemTarget(null)
      return
    }
    const itemId = deleteItemTarget.id
    setDeleteItemTarget(null)
    setBusy(true)
    try {
      await deleteVendorInvoiceItem(itemId)
      toast.success('Line item deleted. Totals recalculated.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete line item.')
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
            <button
              onClick={handleApprove}
              disabled={busy || isDirty || !approvalValidation.can_approve || !xeroAccountValid || (approvalValidation.requires_low_confidence_confirmation && !confirmedLowConfidence)}
              title={isDirty ? 'Save your changes before approving.' : (!approvalValidation.can_approve || !xeroAccountValid) ? 'Resolve the validation issues first.' : undefined}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
            >
              <UploadCloud size={16} /> Approve &amp; Sync
            </button>
          )}
          {canReject && (
            <button onClick={() => setRejecting(true)} disabled={busy} className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 disabled:opacity-40">
              <XCircle size={16} /> Reject
            </button>
          )}
        </div>
      </div>

      {invoice.is_low_confidence && (
        <div className="space-y-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} /> Low-confidence extraction ({Math.round((invoice.extraction_confidence || 0) * 100)}%) - verify every field against the source PDF.
          </div>
          {invoice.status === 'pending_review' && (
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" checked={confirmedLowConfidence} onChange={(e) => setConfirmedLowConfidence(e.target.checked)} />
              I checked this invoice against the source document.
            </label>
          )}
        </div>
      )}
      {invoice.status === 'pending_review' && (!approvalValidation.can_approve || isDirty || xeroAccountIssue) && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-semibold">Approval is blocked</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {isDirty && <li>Save the current changes before approving.</li>}
            {xeroAccountIssue && (
              <li>{expenseAccountsError || 'Select an active Xero expense account before approving.'}</li>
            )}
            {(approvalValidation.issues || []).map((validationIssue) => (
              <li key={validationIssue.code}>{validationIssue.message}</li>
            ))}
          </ul>
        </div>
      )}
      {invoice.status === 'extraction_failed' && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          <span className="flex items-center gap-2"><AlertTriangle size={14} /> Gemini could not extract data from this PDF. Enter fields manually or retry extraction.</span>
          <button onClick={requestReextract} disabled={busy} className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-500 disabled:opacity-40">
            <RefreshCw size={12} /> Retry Extraction
          </button>
        </div>
      )}
      {invoice.status === 'failed' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <span className="flex items-center gap-2"><AlertTriangle size={14} /> Xero rejected this approved bill. Correct the invoice fields or lines here, save, then retry the failed sync.</span>
          <button onClick={() => navigate('/xero/sync-status')} className="inline-flex items-center gap-1 h-7 px-2 rounded-md bg-amber-600 text-white text-xs font-medium hover:bg-amber-500">
            Open Sync Status
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
              <Field label="Vendor Name" value={form.vendor_name} editable={editable} onChange={(v) => changeField('vendor_name', v)} />
              <Field label="Invoice Number" value={form.invoice_number} editable={editable} onChange={(v) => changeField('invoice_number', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice Date" type="date" value={form.invoice_date} editable={editable} onChange={(v) => changeField('invoice_date', v)} />
                <Field label="Due Date" type="date" value={form.due_date} editable={editable} onChange={(v) => changeField('due_date', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Currency" value={form.currency_code} editable={editable} onChange={(v) => changeField('currency_code', v.toUpperCase())} />
                <XeroAccountField
                  value={form.xero_account_code}
                  accounts={expenseAccounts}
                  editable={editable}
                  loading={expenseAccountsLoading}
                  error={expenseAccountsError}
                  onChange={(v) => changeField('xero_account_code', v)}
                />
              </div>
              <SelectField
                label="GST Treatment"
                value={form.gst_treatment}
                editable={editable}
                onChange={(v) => changeField('gst_treatment', v)}
                options={[
                  ['standard_rated', 'Standard-rated purchase'],
                  ['zero_rated', 'Zero-rated purchase'],
                  ['exempt', 'Exempt purchase'],
                  ['non_gst', 'Non-GST registered supplier'],
                  ['disallowed', 'GST disallowed expense'],
                ]}
              />
              <Field label="Supplier GST Registration No." value={form.supplier_gst_registration_no} editable={editable} onChange={(v) => changeField('supplier_gst_registration_no', v)} />
              <Field label="Subtotal Excluding GST" type="number" value={form.subtotal_excluding_gst} editable={editable} onChange={(v) => changeField('subtotal_excluding_gst', v)} />
              <Field label="GST Amount" type="number" value={form.gst_amount} editable={editable} onChange={(v) => changeField('gst_amount', v)} />
              <Field label="Total Including GST" type="number" value={form.total_including_gst} editable={editable} onChange={(v) => changeField('total_including_gst', v)} />
              <Field label="Rebate %" type="number" value={form.rebate_percentage} editable={editable} onChange={(v) => changeField('rebate_percentage', v)} />

              {editable && (
                <button onClick={handleSaveHeader} disabled={busy} className="w-full h-9 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">
                  Save Changes
                </button>
              )}

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <Row label="Confidence" value={invoice.extraction_confidence !== null ? `${Math.round(invoice.extraction_confidence * 100)}%` : '—'} />
                <Row label="Effective GST Rate" value={`${Number(invoice.gst_rate_percent || 0).toFixed(2)}%`} />
                <Row label="Xero Tax Type" value={invoice.xero_tax_type || '—'} />
                <Row label="Rebate Amount" value={money(invoice.rebate_amount)} />
                <Row label="Net Payable" value={money(invoice.verified_total)} bold />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {editable && (
                <button
                  type="button"
                  onClick={startAddItem}
                  disabled={busy || addingItem || isDirty}
                  title={isDirty ? 'Save the header changes first.' : undefined}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Plus size={13} /> Add Item
                </button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {addingItem && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_90px_120px]">
                    <Field label="Line Description" value={newItemForm.description} editable onChange={(value) => setNewItemForm((current) => ({ ...current, description: value }))} />
                    <Field label="Quantity" type="number" value={newItemForm.quantity} editable onChange={(value) => setNewItemForm((current) => ({ ...current, quantity: value }))} />
                    <Field label="Unit Price" type="number" value={newItemForm.unit_price} editable onChange={(value) => setNewItemForm((current) => ({ ...current, unit_price: value }))} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setAddingItem(false); setNewItemForm(EMPTY_LINE_ITEM) }} disabled={busy} className="h-8 rounded-md px-3 text-xs font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                    <button type="button" onClick={addItem} disabled={busy} className="h-8 rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-40">Add Line</button>
                  </div>
                </div>
              )}
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
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">{invoice.status === 'extraction_failed' ? 'No line items. Add one manually or retry extraction.' : invoice.status === 'failed' ? 'No line items. Add one manually before retrying sync.' : 'No line items. Add one manually before approving.'}</td></tr>
                    ) : invoice.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0">
                        {editingItemId === item.id ? (
                          <>
                            <td className="px-3 py-2"><input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} className="w-16 h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" step="0.01" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })} className="w-20 h-8 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" /></td>
                            <td className="px-3 py-2"><input type="number" value={Number(itemForm.quantity || 0) * Number(itemForm.unit_price || 0)} disabled title="Calculated from quantity × unit price" className="w-20 h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-500" /></td>
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
                                <div className="flex justify-end gap-2">
                                  <button aria-label={`Edit ${item.description}`} onClick={() => startEditItem(item)} disabled={busy || isDirty} className="text-slate-400 hover:text-blue-600 disabled:opacity-40"><Pencil size={14} /></button>
                                  <button aria-label={`Delete ${item.description}`} onClick={() => setDeleteItemTarget(item)} disabled={busy || isDirty} className="text-slate-400 hover:text-rose-600 disabled:opacity-40"><Trash2 size={14} /></button>
                                </div>
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

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <History size={16} className="text-slate-500" />
          <CardTitle>Audit Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {(invoice.audit_trail || []).length === 0 ? (
            <p className="text-sm text-slate-400">No audit events recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {invoice.audit_trail.map((event) => (
                <div key={event.id} className="relative border-l-2 border-slate-200 pl-4">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-slate-600" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold capitalize text-slate-900">{event.action.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-slate-500">{event.actor?.name || 'System'}</div>
                  {event.note && <div className="mt-1 text-sm text-slate-700">{event.note}</div>}
                  {Object.keys(event.changes || {}).length > 0 && (
                    <div className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {Object.entries(event.changes).map(([field, change]) => (
                        <div key={field}>
                          <span className="font-medium">{field.replace(/_/g, ' ')}:</span>{' '}
                          {change && typeof change === 'object' && 'from' in change
                            ? `${change.from ?? '—'} → ${change.to ?? '—'}`
                            : String(change)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

      <ConfirmDialog
        open={Boolean(deleteItemTarget)}
        title="Delete line item?"
        description={deleteItemTarget ? `Delete “${deleteItemTarget.description}”? The invoice totals will be recalculated.` : ''}
        confirmLabel="Delete Item"
        onCancel={() => setDeleteItemTarget(null)}
        onConfirm={removeItem}
      />

      <ConfirmDialog
        open={confirmingReextract}
        title="Replace extracted invoice data?"
        description={`This will replace the current extracted fields and ${invoice.items.length} line item${invoice.items.length === 1 ? '' : 's'} with a new OCR result. If OCR fails, the current data will be kept.`}
        confirmLabel="Replace & Retry"
        onCancel={() => setConfirmingReextract(false)}
        onConfirm={handleReextract}
      />
    </div>
  )
}

function SelectField({ label, value, onChange, editable, options }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      <select
        value={value}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
      >
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function XeroAccountField({ value, onChange, accounts, editable, loading, error }) {
  const accountExists = accounts.some((account) => account.code === String(value || ''))
  const unavailableCurrent = value && !accountExists
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-500">Xero Expense Account</span>
      <select
        value={value || ''}
        disabled={!editable || loading || Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <option value="">{loading ? 'Loading Xero accounts...' : 'Select an expense account'}</option>
        {unavailableCurrent && <option value={value}>{value} - current code (not active in Xero)</option>}
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>
            {account.code} - {account.name} ({account.type})
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
      {!error && !loading && unavailableCurrent && (
        <span className="mt-1 block text-xs text-amber-700">Select an active Xero expense account before approval.</span>
      )}
    </label>
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
