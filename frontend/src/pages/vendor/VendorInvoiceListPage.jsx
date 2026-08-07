// Owner: Kwan Hua (AP Specialist)
// Vendor Invoice List (screen 16): upload modal (PDF drag-drop), OCR confidence column,
// color-coded confidence %, status filter tabs.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Eye, UploadCloud, FileText, Mail, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks'
import { getVendorInvoiceIntakeSettings, listVendorInvoices, uploadVendorInvoice } from '@/api/vendor'
import { getGmailConnectUrl, getGmailIntakeStatus, importGmailInvoices } from '@/api/gmail'

const STATUSES = ['pending_review', 'extraction_failed', 'approved', 'synced_to_xero', 'failed', 'rejected']
const money = (n) => (n === null || n === undefined ? '—' : `$${Number(n).toFixed(2)}`)

function ConfidenceCell({ confidence, isLowConfidence }) {
  if (confidence === null || confidence === undefined) return <span className="text-xs text-slate-400">—</span>
  const pct = Math.round(confidence * 100)
  const color = isLowConfidence || pct < 80 ? 'text-rose-600' : pct < 90 ? 'text-amber-600' : 'text-emerald-600'
  return <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
}

export default function VendorInvoiceListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [statusCounts, setStatusCounts] = useState({})
  const [uploadOpen, setUploadOpen] = useState(false)
  const [intakeSettings, setIntakeSettings] = useState(null)
  const [gmailStatus, setGmailStatus] = useState(undefined)
  const [gmailBusy, setGmailBusy] = useState(false)

  async function fetchInvoices() {
    setLoading(true)
    try {
      const { data, status_counts: counts } = await listVendorInvoices({ limit: 100, status: statusFilter || undefined })
      setRows(data)
      setStatusCounts(counts || {})
    } catch {
      toast.error('Failed to load vendor invoices.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInvoices() }, [statusFilter])
  useEffect(() => {
    // This is supplementary information; a temporarily unavailable configuration
    // endpoint must never stop staff from opening the AP queue.
    getVendorInvoiceIntakeSettings().then(setIntakeSettings).catch(() => {})
  }, [])
  useEffect(() => { getGmailIntakeStatus().then(setGmailStatus).catch(() => setGmailStatus(false)) }, [])

  async function connectGmail() {
    setGmailBusy(true)
    try { window.location.href = await getGmailConnectUrl() }
    catch (err) { toast.error(err.response?.data?.message || 'Could not start Gmail connection.') ; setGmailBusy(false) }
  }

  async function importFromGmail() {
    setGmailBusy(true)
    try {
      const result = await importGmailInvoices()
      const successful = result.imported.filter((row) => row.imported).length
      toast.success(successful ? `${successful} Gmail message(s) imported into AP.` : 'No labelled PDF invoices are waiting in Gmail.')
      await fetchInvoices()
    } catch (err) { toast.error(err.response?.data?.message || 'Gmail import failed.') }
    finally { setGmailBusy(false) }
  }

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Vendor Invoices</h1>
        </div>
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
        >
          <UploadCloud size={16} /> Upload Invoice
        </button>
      </div>

      {intakeSettings && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          intakeSettings.configured
            ? 'border-blue-200 bg-blue-50 text-blue-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <Mail size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Email invoice intake</div>
            {intakeSettings.configured ? (
              <p className="mt-0.5 text-xs">Forward vendor PDF invoices to <span className="font-mono font-semibold">{intakeSettings.forwarding_address}</span>. Each attachment enters this review queue automatically.</p>
            ) : (
              <p className="mt-0.5 text-xs">Automatic forwarding has not been configured yet. You can still upload a PDF manually.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="flex items-start gap-3">
          <Mail size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <div>
            <div className="font-semibold text-slate-900">Gmail AP intake</div>
            <p className="mt-0.5 text-xs text-slate-600">
              {gmailStatus === undefined ? 'Checking Gmail connection…' : gmailStatus === false ? 'Gmail status could not load. Refresh the page and make sure you are signed in as AP or Managing Director.' : gmailStatus.is_connected ? `Connected to ${gmailStatus.gmail_address}. Label invoice emails “${gmailStatus.intake_label}”, then import them.` : 'Connect the invoice Gmail inbox to import labelled PDF invoices.'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {gmailStatus && gmailStatus.is_connected ? (
            <button onClick={importFromGmail} disabled={gmailBusy} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-40">{gmailBusy ? 'Importing…' : 'Import Gmail'}</button>
          ) : gmailStatus && user?.role === 'managing_director' ? (
            <button onClick={connectGmail} disabled={gmailBusy || !gmailStatus.configured} className="h-8 rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-40">Connect Gmail</button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AP Invoice Queue</CardTitle>
          <CardDescription>Upload vendor PDFs, review OCR-extracted data, verify rebate, approve for Xero.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button onClick={() => setStatusFilter('')} className={`h-8 px-3 rounded-full text-xs ${!statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All</button>
            {STATUSES.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`h-8 px-3 rounded-full text-xs capitalize ${statusFilter === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {s.replace(/_/g, ' ')} ({statusCounts[s] ?? 0})
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Vendor', 'Invoice #', 'Invoice Date', 'Due Date', 'GST', 'Net Payable', 'Confidence', 'Status', 'Action'].map((c) => (
                      <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">No vendor invoices. Upload a PDF to get started.</td></tr>
                  ) : rows.map((inv, idx) => (
                    <tr key={inv.id} className={`h-12 hover:bg-slate-50/80 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                      <td className="px-4 py-2"><span className="text-xs font-semibold text-slate-900">{inv.vendor_name}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600 font-mono">{inv.invoice_number}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600">{inv.invoice_date || '—'}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600">{inv.due_date || '—'}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600">{money(inv.gst_amount)}</span></td>
                      <td className="px-4 py-2"><span className="text-xs font-semibold text-slate-900">{money(inv.verified_total)}</span></td>
                      <td className="px-4 py-2"><ConfidenceCell confidence={inv.extraction_confidence} isLowConfidence={inv.is_low_confidence} /></td>
                      <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-2">
                        <button onClick={() => navigate(`/vendor-invoices/${inv.id}`)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium transition-all">
                          <Eye size={12} /><span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={(invoice) => { setUploadOpen(false); navigate(`/vendor-invoices/${invoice.id}`) }}
          onExtractionFailed={(invoice) => { setUploadOpen(false); navigate(`/vendor-invoices/${invoice.id}`) }}
        />
      )}
    </div>
  )
}

function UploadModal({ onClose, onUploaded, onExtractionFailed }) {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [rebate, setRebate] = useState('1.00')
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  function handleFiles(fileList) {
    const f = fileList?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted. Please scan the invoice and upload as a PDF.')
      return
    }
    setFile(f)
  }

  async function handleSubmit() {
    if (!file) { toast.error('Select a PDF file to upload.'); return }
    setBusy(true)
    try {
      const invoice = await uploadVendorInvoice(file, rebate)
      toast.success(`Uploaded - extracted total ${invoice.extracted_total ? `$${invoice.extracted_total}` : 'pending'}.`)
      onUploaded(invoice)
    } catch (err) {
      const response = err.response?.data
      const savedInvoice = response?.code === 'OCR_EXTRACTION_FAILED' && response.data?.id
        ? response.data
        : null
      if (savedInvoice) {
        toast.warning('OCR failed, but the invoice was saved. Enter the details manually or retry extraction.')
        onExtractionFailed(savedInvoice)
      } else {
        toast.error(response?.message || 'Upload failed. Please retry.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="text-lg font-semibold text-slate-900">Upload Vendor Invoice</div>
          <button onClick={onClose} className="inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {file ? (
              <>
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="text-sm font-medium text-slate-900">{file.name}</div>
                <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB - click or drop to replace</div>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-slate-400" />
                <div className="text-sm font-medium text-slate-700">Drag and drop a PDF here, or click to browse</div>
                <div className="text-xs text-slate-400">PDF only, max 10 MB</div>
              </>
            )}
          </div>

          <label className="block text-xs font-medium text-slate-600">
            Rebate % (defaults to 1.00 if left blank)
            <input
              type="number" min="0" max="100" step="0.01"
              value={rebate}
              onChange={(e) => setRebate(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-500"
            />
          </label>

          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
            Gemini will extract the vendor, invoice number, date, line items, and total automatically. You can correct any field before approving.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={busy || !file}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
          >
            {busy ? 'Uploading & running OCR…' : 'Upload & Extract'}
          </button>
        </div>
      </div>
    </div>
  )
}
