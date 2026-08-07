import React, { useEffect, useState } from 'react';
import { CalendarDays, Search, ChevronDown, Eye, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { intakeRejectSchema } from '@/schemas';
import { getPublishedRate, classifyAgainstPublished, RATE_CARD_SERVICE } from '@/lib/publishedRateCard';
import api from '../../api';

const serviceTypeLabels = {
  eas: 'EAS (Emergency Ambulance Services)',
  mts: 'MTS (Medical Transport Services)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
};

const serviceTierLabels = {
  basic: 'Basic',
  advanced: 'Advanced',
  critical: 'Critical',
};

const transferTypeOptions = [
  ['one_way_hospital', 'One-Way Hospital Transfer'],
  ['two_way_hospital', 'Two-Way Hospital Transfer'],
  ['covid_19', 'COVID-19 Transport'],
  ['imh_psychiatric', 'IMH / Psychiatric Transfer'],
  ['airport_no_tarmac', 'Airport Transfer (No Tarmac)'],
  ['airport_with_tarmac', 'Airport Transfer (With Tarmac)'],
  ['sg_jb_ground', 'SG-JB Ground Transfer'],
  ['air_evacuation', 'Air Evacuation'],
]

function formatServiceType(type) {
  return serviceTypeLabels[type] || type
}

function formatServiceTier(tier) {
  return serviceTierLabels[tier] || 'To be assessed'
}

function formatDate(dateString) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Status badge colors follow the CLAUDE.md status pattern: Pending/Warning = amber,
// Confirmed/Info = blue, Rejected/Error = red.
const STATUS_BADGE_CLASSES = {
  Pending: 'bg-amber-100 text-amber-700',
  Confirmed: 'bg-blue-100 text-blue-700',
  Rejected: 'bg-red-100 text-red-700',
}

// Status filter pills. The active fill follows the CLAUDE.md status reference colors so
// the pill reads as the status it filters to: Pending = amber (#F59E0B / Warning),
// Confirmed = blue (#3B82F6 / Info), Rejected = red (#EF4444 / Error). "All" stays
// neutral slate since it isn't a status.
const STATUS_FILTER_PILLS = [
  { value: '', label: 'All', activeClass: 'bg-slate-900 text-white border-slate-900', inactiveClass: 'bg-slate-100 text-slate-700 border-slate-900 hover:bg-slate-200' },
  { value: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500', inactiveClass: 'bg-amber-50 text-amber-700 border-amber-500 hover:bg-amber-100' },
  { value: 'Confirmed', label: 'Confirmed', activeClass: 'bg-blue-500 text-white border-blue-500', inactiveClass: 'bg-blue-50 text-blue-700 border-blue-500 hover:bg-blue-100' },
  { value: 'Rejected', label: 'Rejected', activeClass: 'bg-red-500 text-white border-red-500', inactiveClass: 'bg-red-50 text-red-700 border-red-500 hover:bg-red-100' },
]

// Shows the published rate band for the selected transfer type and time category, and
// flags an agreed price that falls outside it. Guidance only - an outlier is a warning,
// never a block, because the specialist may have genuinely negotiated the figure.
function PublishedRateHint({ transferType, timeOfDay, serviceTypeCode, amount }) {
  if (!transferType || !timeOfDay) {
    return <p className="mt-1 text-xs text-slate-500">Select a transfer type and time category to see the published rate.</p>
  }

  const rate = getPublishedRate(transferType, timeOfDay)
  if (!rate) return <p className="mt-1 text-xs text-slate-500">No published rate for this combination - agree the price with the client.</p>
  if (rate.quoteOnly) {
    return <p className="mt-1 text-xs text-amber-700">Published table lists this as <strong>Call for Quote</strong> - confirm the agreed figure with operations before proceeding.</p>
  }

  const verdict = classifyAgainstPublished(amount, transferType, timeOfDay)
  // The published table is headed "Medical Transport Services"; other service types are
  // negotiated separately, so the band is a weaker reference and is labelled as such.
  const offCard = serviceTypeCode && serviceTypeCode !== RATE_CARD_SERVICE

  return (
    <div className="mt-1 space-y-1">
      <p className="text-xs text-slate-600">
        Published rate: <strong className="text-slate-900">{rate.label}</strong>
        {offCard ? <span className="text-slate-500"> (Medical Transport Services table - this service is negotiated separately)</span> : null}
      </p>
      {verdict === 'below' ? (
        <p className="text-xs font-medium text-amber-700">Below the published rate - confirm this discount is agreed, or the shortfall becomes revenue leakage.</p>
      ) : verdict === 'above' ? (
        <p className="text-xs font-medium text-amber-700">Above the published rate - confirm the client agreed this premium.</p>
      ) : verdict === 'ok' ? (
        <p className="text-xs font-medium text-emerald-700">Within the published rate.</p>
      ) : null}
    </div>
  )
}

export default function IntakeQueuePage() {
  const [intakes, setIntakes] = useState([])
  const [query, setQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedIntake, setSelectedIntake] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [actionTier, setActionTier] = useState('')
  const [pricingSource, setPricingSource] = useState('')
  const [quotedTransferType, setQuotedTransferType] = useState('')
  const [quotedTimeOfDay, setQuotedTimeOfDay] = useState('')
  const [quotedBaseAmount, setQuotedBaseAmount] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Build the filtered intake list based on search text and dropdown filters.
  const filteredIntakes = intakes.filter((i) => {
    const q = query.trim().toLowerCase();
    if (q && !(i.ref.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.org.toLowerCase().includes(q))) return false;
    if (statusFilter && statusFilter !== '' && i.status !== statusFilter) return false;
    if (serviceTypeFilter && i.serviceType.indexOf(serviceTypeFilter) === -1) return false;
    if (tierFilter && i.tier !== tierFilter) return false;
    return true;
  });

  async function fetchIntakes() {
    setLoading(true)
    try {
      // status: '' fetches every status - the Pending/Confirmed/Rejected filter pills and
      // stat cards below are client-side, so a confirmed or rejected submission needs to
      // stay in `intakes` (with its updated status) instead of disappearing from the list.
      const { data } = await api.get('/intake', { params: { status: '', limit: 50 } })
      setIntakes(data.data.data.map((item) => ({
        ref: item.reference_number,
        submitted: new Date(item.created_at).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        name: item.customer_name,
        org: item.organisation || '',
        email: item.contact_email,
        phone: item.contact_phone,
        serviceType: formatServiceType(item.service_type),
        serviceTypeCode: item.service_type,
        tier: formatServiceTier(item.service_tier),
        status: item.status === 'pending' ? 'Pending' : item.status === 'confirmed' ? 'Confirmed' : 'Rejected',
        preferredDate: formatDate(item.preferred_date),
        preferredTime: item.preferred_time,
        pickup: item.pickup_location,
        destination: item.destination,
        notes: item.additional_notes || '',
        id: item.id,
      })))
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load intake queue. Please refresh.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntakes()
  }, [])

  async function handleConfirmBooking(intake) {
    if (!actionTier) {
      setToast({ type: 'error', message: 'Select a service tier before confirming the booking.' })
      return
    }
    if (!pricingSource || !quotedTransferType || !quotedTimeOfDay) {
      setToast({ type: 'error', message: 'Complete the pricing source, transfer type, and time category before confirming.' })
      return
    }
    const amount = Number(quotedBaseAmount)
    if (pricingSource === 'one_off_quote' && (!(amount > 0) || amount > 50000)) {
      setToast({ type: 'error', message: 'Enter an agreed base price between $0.01 and $50,000.' })
      return
    }
    try {
      const body = {
        service_tier: actionTier.toLowerCase(),
        pricing_source: pricingSource,
        quoted_transfer_type: quotedTransferType,
        quoted_time_of_day: quotedTimeOfDay,
        quoted_base_amount: pricingSource === 'one_off_quote' ? amount : null,
        notes: internalNotes.trim() || null,
      }
      await api.post(`/intake/${intake.id}/confirm`, body)
      setToast({ type: 'success', message: `Booking created from ${intake.ref}.` })
      await fetchIntakes()
      setSelectedIntake(null)
      setShowDetails(false)
      setActionTier('')
      setPricingSource('')
      setQuotedTransferType('')
      setQuotedTimeOfDay('')
      setQuotedBaseAmount('')
      setInternalNotes('')
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to confirm booking.' })
    }
  }

  // Reject the intake submission after validating the rejection reason.
  async function handleReject(intake) {
    try {
      intakeRejectSchema.validateSync({ rejectionReason })
      await api.post(`/intake/${intake.id}/reject`, { rejection_reason: rejectionReason })
      setToast({ type: 'success', message: `Submission ${intake.ref} rejected.` })
      await fetchIntakes()
      setSelectedIntake(null)
      setRejectionReason('')
      setShowDetails(false)
      setActionTier('')
      setPricingSource('')
      setQuotedTransferType('')
      setQuotedTimeOfDay('')
      setQuotedBaseAmount('')
      setInternalNotes('')
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to reject submission.'
      setToast({ type: 'error', message })
    }
  }

  // Only rejected submissions can be deleted (see backend/src/controllers/intakeController.js) -
  // pending ones are still awaiting a decision, and a confirmed one already produced a booking.
  async function confirmDelete() {
    const intake = deleteTarget
    if (!intake) return
    try {
      await api.delete(`/intake/${intake.id}`)
      setToast({ type: 'success', message: `Submission ${intake.ref} deleted.` })
      await fetchIntakes()
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || 'Failed to delete submission.' })
    } finally {
      setDeleteTarget(null)
    }
  }

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <div className="p-6 space-y-4 font-sans">
      {toast ? (
        <div className={`fixed bottom-5 right-5 z-[60] w-full max-w-sm rounded-2xl border px-4 py-3 shadow-2xl transition ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {toast.message}
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Intake Queue</h1>
      </div>

      <div className="p-4 bg-white rounded-lg border mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter('Pending')}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Pending' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Pending Review</div>
            <div className="text-2xl font-semibold text-amber-500">{intakes.filter((i) => i.status === 'Pending').length}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Confirmed')}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Confirmed' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Confirmed</div>
            <div className="text-2xl font-semibold text-blue-600">{intakes.filter((i) => i.status === 'Confirmed').length}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Rejected')}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Rejected' ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Rejected</div>
            <div className="text-2xl font-semibold text-red-500">{intakes.filter((i) => i.status === 'Rejected').length}</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>Intake Queue</CardTitle>
              <CardDescription>Review incoming service requests</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px] relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Search by name, reference, or organisation"
                    className={`w-full h-[38px] pl-[34px] pr-3.5 rounded-lg border-2 bg-white text-xs text-slate-800 outline-none transition-colors ${
                      searchFocused ? 'border-blue-500' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {STATUS_FILTER_PILLS.map((pill) => (
                    <button
                      key={pill.value || 'all'}
                      onClick={() => setStatusFilter(pill.value)}
                      className={`h-8 px-3 rounded-full border text-xs transition-colors ${statusFilter === pill.value ? pill.activeClass : pill.inactiveClass}`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className={`h-[38px] pl-3 pr-8 rounded-lg border-2 bg-white text-xs font-medium outline-none appearance-none cursor-pointer transition-colors hover:border-slate-400 focus:border-blue-500 ${serviceTypeFilter ? 'border-slate-300 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                    <option value="">All Service Types</option>
                    <option value="EAS">EAS</option>
                    <option value="MTS">MTS</option>
                    <option value="Event Standby">Event Standby</option>
                    <option value="Workplace Standby">Workplace Standby</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className={`h-[38px] pl-3 pr-8 rounded-lg border-2 bg-white text-xs font-medium outline-none appearance-none cursor-pointer transition-colors hover:border-slate-400 focus:border-blue-500 ${tierFilter ? 'border-slate-300 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                    <option value="">All Tiers</option>
                    <option value="Basic">Basic</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {['Reference', 'Customer', 'Organisation', 'Service Type', 'Service Tier', 'Status', 'Preferred Date', 'Time in Queue', 'Action'].map((col) => (
                          <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIntakes.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-16 text-center text-slate-400 text-sm">No intake submissions found.</td>
                        </tr>
                      ) : (
                        filteredIntakes.map((it) => (
                          <tr
                            key={it.ref}
                            onClick={() => { setSelectedIntake(it); setShowDetails(true); setActionTier(''); setPricingSource(''); setQuotedTransferType(''); setQuotedTimeOfDay(''); setQuotedBaseAmount(''); setInternalNotes(''); setRejectionReason(''); }}
                            className="h-12 cursor-pointer odd:bg-white even:bg-slate-50 hover:bg-slate-100"
                          >
                            <td className="px-4 py-2 align-middle"><span className="text-xs font-semibold text-slate-900 tracking-wide font-mono">{it.ref}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs font-medium text-slate-800">{it.name}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.org}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.serviceType}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.tier}</span></td>
                            <td className="px-4 py-2 align-middle">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_BADGE_CLASSES[it.status] || 'bg-slate-100 text-slate-600'}`}>
                                {it.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-600">{it.preferredDate}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-600">1h 12m</span></td>
                            <td className="px-4 py-2 align-middle">
                              <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setSelectedIntake(it); setShowDetails(true); setActionTier(''); setPricingSource(''); setQuotedTransferType(''); setQuotedTimeOfDay(''); setQuotedBaseAmount(''); setInternalNotes(''); setRejectionReason(''); }} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-all">
                                  <Eye size={12} />
                                  <span>Review</span>
                                </button>
                                {it.status === 'Rejected' ? (
                                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(it); }} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-all">
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/30 text-[12px] text-slate-500">Showing {filteredIntakes.length} intake submission{filteredIntakes.length !== 1 ? 's' : ''}.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showDetails && selectedIntake ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Review Submission</div>
                <div className="text-sm text-slate-500">{selectedIntake.ref} · {selectedIntake.status}</div>
              </div>
              <button onClick={() => { setShowDetails(false); setSelectedIntake(null); setActionTier(''); setPricingSource(''); setQuotedTransferType(''); setQuotedTimeOfDay(''); setQuotedBaseAmount(''); setInternalNotes(''); setRejectionReason('') }} className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Reference</div>
                    <div className="text-sm text-slate-900">{selectedIntake.ref}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Submitted</div>
                    <div className="text-sm text-slate-900">{selectedIntake.submitted}</div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Customer Name</div>
                    <div className="text-sm text-slate-900">{selectedIntake.name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Organisation</div>
                    <div className="text-sm text-slate-900">{selectedIntake.org}</div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Email</div>
                    <div className="text-sm text-slate-900 break-all">{selectedIntake.email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Phone</div>
                    <div className="text-sm text-slate-900">{selectedIntake.phone}</div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Service Type</div>
                    <div className="text-sm text-slate-900">{selectedIntake.serviceType}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Service Tier</div>
                    <div className="text-sm text-slate-900">{selectedIntake.tier}</div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Preferred Date</div>
                    <div className="text-sm text-slate-900">{selectedIntake.preferredDate}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Preferred Time</div>
                    <div className="text-sm text-slate-900">{selectedIntake.preferredTime}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Pickup Location</div>
                  <div className="text-sm text-slate-900">{selectedIntake.pickup}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Destination</div>
                  <div className="text-sm text-slate-900">{selectedIntake.destination}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Additional Notes</div>
                  <div className="text-sm text-slate-900">{selectedIntake.notes}</div>
                </div>
              </div>
              <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-slate-50">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Action</div>
                </div>
                <div>
                  <label htmlFor="action_service_tier" className="text-xs font-medium uppercase text-slate-500">Service Tier <span className="text-red-500">*</span></label>
                  <select id="action_service_tier" value={actionTier} onChange={(e) => setActionTier(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none">
                    <option value="" disabled>Select service tier</option>
                    <option value="Basic">Basic</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pricing_source" className="text-xs font-medium uppercase text-slate-500">Pricing Source <span className="text-red-500">*</span></label>
                  <select id="pricing_source" value={pricingSource} onChange={(e) => { setPricingSource(e.target.value); setQuotedBaseAmount(''); }} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none">
                    <option value="" disabled>Select pricing source</option>
                    <option value="contract">Existing client contract</option>
                    <option value="one_off_quote">One-off agreed quotation</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">The agreed base price is frozen on this booking for AR invoicing.</p>
                </div>
                <div>
                  <label htmlFor="quoted_transfer_type" className="text-xs font-medium uppercase text-slate-500">Transfer Type <span className="text-red-500">*</span></label>
                  <select id="quoted_transfer_type" value={quotedTransferType} onChange={(e) => setQuotedTransferType(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none">
                    <option value="" disabled>Select transfer type</option>
                    {transferTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="quoted_time_of_day" className="text-xs font-medium uppercase text-slate-500">Time Category <span className="text-red-500">*</span></label>
                  <select id="quoted_time_of_day" value={quotedTimeOfDay} onChange={(e) => setQuotedTimeOfDay(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none">
                    <option value="" disabled>Select time category</option>
                    <option value="office_hours">Office Hours</option>
                    <option value="non_office_hours">Non-Office Hours</option>
                    <option value="all_hours">All Hours</option>
                  </select>
                </div>
                {pricingSource === 'one_off_quote' ? (
                  <div>
                    <label htmlFor="quoted_base_amount" className="text-xs font-medium uppercase text-slate-500">Agreed Base Price (SGD) <span className="text-red-500">*</span></label>
                    <input id="quoted_base_amount" type="number" min="0.01" max="50000" step="0.01" value={quotedBaseAmount} onChange={(e) => setQuotedBaseAmount(e.target.value)} placeholder="0.00" className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none" />
                    <PublishedRateHint
                      transferType={quotedTransferType}
                      timeOfDay={quotedTimeOfDay}
                      serviceTypeCode={selectedIntake.serviceTypeCode}
                      amount={quotedBaseAmount}
                    />
                  </div>
                ) : pricingSource === 'contract' ? (
                  // The contract path never showed a figure at all, so the specialist
                  // confirmed a booking without ever seeing the price being frozen onto it.
                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                    <p className="text-xs font-medium text-blue-900">Base price comes from the client's contract</p>
                    <p className="mt-0.5 text-xs text-blue-800">
                      The rate for this service, transfer type and time category is read from the client's active
                      pricing contract and frozen onto the booking. Confirming fails if the contract has no matching rate.
                    </p>
                  </div>
                ) : null}
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Internal Notes</label>
                  <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none" rows={4} />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Rejection Reason</label>
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Required if rejecting this submission" className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none" rows={3} />
                </div>
              </div>
              <div className="shrink-0 space-y-2 border-t border-slate-200 p-4">
                <button onClick={() => { handleConfirmBooking(selectedIntake); }} className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-950">Confirm Booking</button>
                <button onClick={() => { handleReject(selectedIntake); }} className="w-full rounded-lg bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600">Reject Submission</button>
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this submission?"
        description={deleteTarget ? `Submission ${deleteTarget.ref} will be permanently deleted. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
