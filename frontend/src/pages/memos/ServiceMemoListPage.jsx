// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
// Memo Review Queue + Detail (screens 7-8): approve runs the pricing engine, or return with a note.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Eye, CheckCircle2, CornerUpLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/context/ToastContext'
import { listPendingMemos, getMemo, approveMemo, returnMemo } from '@/api/ar'

// Abbreviated - used in the dense review-queue table below, which has a fixed h-12 row
// height across 6 columns and no room for a long label without wrapping the row.
const SERVICE_LABELS = { eas: 'EAS', mts: 'MTS', event_standby: 'Event Standby', workplace_standby: 'Workplace Standby' }
// Full name - used in the Memo Review Detail panel's 2-column grid, which has the room.
const SERVICE_LABELS_FULL = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Services (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}
const TRANSFER_LABELS = {
  one_way_hospital: 'One-Way Hospital', two_way_hospital: 'Two-Way Hospital', covid_19: 'COVID-19',
  imh_psychiatric: 'IMH / Psychiatric', airport_no_tarmac: 'Airport (No Tarmac)', airport_with_tarmac: 'Airport (With Tarmac)',
  sg_jb_ground: 'SG-JB Ground', air_evacuation: 'Air Evacuation',
}

const yesNo = (v) => (v ? 'Yes' : 'No')

// Time-in-queue colour coding (CLAUDE.md: amber >2h, red >4h).
function queueColour(hours) {
  if (hours >= 4) return 'text-rose-600 font-semibold'
  if (hours >= 2) return 'text-amber-600 font-medium'
  return 'text-slate-600'
}

// Raw hours stop being readable within a day - a memo sitting for a fortnight rendered as
// "433.8h", leaving the reader to divide by 24. Days and hours from 24h up.
function formatQueueAge(hours) {
  const h = Number(hours) || 0
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 24) return `${Math.round(h * 10) / 10}h`
  const days = Math.floor(h / 24)
  const rem = Math.round(h % 24)
  return rem === 0 ? `${days}d` : `${days}d ${rem}h`
}

function Field({ label, value, highlight }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
      <div className={`text-sm ${highlight ? 'text-blue-700 font-semibold' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

export default function ServiceMemoListPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // full memo detail
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function fetchQueue() {
    setLoading(true)
    try {
      const { data } = await listPendingMemos({ limit: 50 })
      setRows(data)
    } catch {
      toast.error('Failed to load the memo review queue.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQueue() }, [])

  async function openDetail(memoId) {
    try {
      const memo = await getMemo(memoId)
      setSelected(memo)
      setNote('')
    } catch {
      toast.error('Failed to load memo detail.')
    }
  }

  async function handleApprove() {
    if (!selected) return
    setBusy(true)
    try {
      const result = await approveMemo(selected.id)
      if (result.warning) {
        toast.warning(`Memo approved, but automatic matching needs attention. ${result.warning.message}`)
      } else {
        toast.success(`Memo approved - invoice #${result.invoice.id} generated ($${Number(result.invoice.total_amount).toFixed(2)}).`)
      }
      setSelected(null)
      await fetchQueue()
      navigate(`/invoices/${result.invoice.id}`)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to approve memo.'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleReturn() {
    if (!selected) return
    if (!note.trim()) { toast.error('Enter a correction note before returning.'); return }
    setBusy(true)
    try {
      await returnMemo(selected.id, note.trim())
      toast.success('Memo returned to the field crew for correction.')
      setSelected(null)
      await fetchQueue()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to return memo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Memo Review</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Awaiting Review</div>
          <div className="text-2xl font-semibold text-slate-900">{rows.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Overdue (&gt;4h)</div>
          <div className="text-2xl font-semibold text-rose-600">{rows.filter((r) => r.hours_since_submission >= 4).length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-500">Approaching (&gt;2h)</div>
          <div className="text-2xl font-semibold text-amber-600">{rows.filter((r) => r.hours_since_submission >= 2 && r.hours_since_submission < 4).length}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Service Memos</CardTitle>
          <CardDescription>Review field memos, approve to run the pricing engine, or return with a correction note.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Booking Ref', 'Client', 'Service', 'Transfer', 'In Queue', 'Action'].map((c) => (
                      <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No memos awaiting review.</td></tr>
                  ) : rows.map((m, idx) => (
                    <tr key={m.id} className={`h-12 hover:bg-slate-50/80 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                      <td className="px-4 py-2">
                        <span className="text-xs font-semibold text-slate-900 font-mono">{m.booking_reference || `#${m.booking_id}`}</span>
                        {/* Marks a memo that has already been round-tripped, so this review is
                            a re-check of a correction rather than a first look. */}
                        {m.was_returned && (
                          <span title="Previously returned to the crew and since corrected" className="ml-2 inline-flex items-center rounded-[6px] bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Corrected
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2"><span className="text-xs font-medium text-slate-800">{m.client_name || '—'}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-800">{SERVICE_LABELS[m.service_type] || m.service_type}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-800">{TRANSFER_LABELS[m.transfer_type] || m.transfer_type}</span></td>
                      <td className="px-4 py-2"><span className={`text-xs ${queueColour(m.hours_since_submission)}`}>{formatQueueAge(m.hours_since_submission)}</span></td>
                      <td className="px-4 py-2">
                        <button onClick={() => openDetail(m.id)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium transition-all">
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

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Memo Review</div>
                <div className="text-sm text-slate-500">Memo #{selected.id} · Booking #{selected.booking_id} · {selected.patient_name}</div>
              </div>
              <button onClick={() => setSelected(null)} className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100"><span className="text-xl leading-none">×</span></button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[3fr_2fr] px-6 py-6" style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {/* Left: memo fields */}
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 gap-4">
                  <Field label="Patient" value={selected.patient_name} />
                  <Field label="Hospital Destination" value={selected.hospital_destination} />
                  <Field label="Job Start" value={new Date(selected.job_start_time).toLocaleString('en-SG')} />
                  <Field label="Job End" value={new Date(selected.job_end_time).toLocaleString('en-SG')} />
                  {/* Documentation only - evacuation_floors does not affect billing
                      (CLAUDE.md logic correction 4); the billable stair/lift charge is the
                      separate Inconvenience Fee flag in the pricing panel below. */}
                  <Field label="Evacuation Floors" value={selected.evacuation_floors} />
                </div>

                {/* Pricing engine inputs - highlighted blue per CLAUDE.md */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <div className="text-xs font-semibold uppercase text-blue-700 mb-3">Pricing Engine Inputs</div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Service Type" value={SERVICE_LABELS_FULL[selected.service_type] || selected.service_type} highlight />
                    <Field label="Transfer Type" value={TRANSFER_LABELS[selected.transfer_type] || selected.transfer_type} highlight />
                    <Field label="Office Hours" value={yesNo(selected.is_office_hours)} />
                    {/* Billable since the engine gained an overtime_per_hour surcharge, so it
                        belongs with the pricing inputs rather than the job-details block. */}
                    <Field label="Overtime (hrs)" value={selected.overtime_hours} highlight={Number(selected.overtime_hours) > 0} />
                    <Field label="Oxygen Litres Used" value={selected.oxygen_litres_used} />
                    <Field label="Inconvenience Fee" value={yesNo(selected.has_inconvenience_fee)} />
                    <Field label="Disposables Used" value={yesNo(selected.disposables_used)} />
                    <Field label="Resuscitation" value={yesNo(selected.resuscitation_performed)} />
                    <Field label="Suction" value={yesNo(selected.suction_performed)} />
                    <Field label="Waiting Time (min)" value={selected.waiting_time_minutes} />
                    <Field label="Patient Weight (kg)" value={selected.patient_weight_kg ?? '—'} />
                    <Field label="Jurong Island" value={yesNo(selected.is_jurong_island)} />
                  </div>
                </div>

                {selected.additional_charges_notes && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Field label="Additional Notes" value={selected.additional_charges_notes} />
                  </div>
                )}
              </div>

              {/* Right: actions */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-3">Approve</div>
                  <p className="text-sm text-slate-600 mb-3">Approving runs the pricing engine against the client's active contract and generates the invoice.</p>
                  <button onClick={handleApprove} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
                    <CheckCircle2 size={16} /> Approve &amp; Match
                  </button>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-3">Return to Crew</div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Correction note for the field crew…" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <button onClick={handleReturn} disabled={busy} className="mt-2 w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium hover:bg-amber-100 disabled:opacity-50">
                    <CornerUpLeft size={16} /> Return Memo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
