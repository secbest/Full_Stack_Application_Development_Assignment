import React, { useEffect, useState } from 'react';
import { CalendarDays, Search, ChevronDown, Eye, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { intakeRejectSchema } from '@/schemas';
import api from '../../api';

const serviceTypeLabels = {
  eas: 'EAS (Emergency Ambulance Services)',
  mts: 'MTS (Medical Transfer Services)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
};

const serviceTierLabels = {
  basic: 'Basic',
  advanced: 'Advanced',
  critical: 'Critical',
};

function formatServiceType(type) {
  return serviceTypeLabels[type] || type
}

function formatServiceTier(tier) {
  return serviceTierLabels[tier] || tier
}

function formatDate(dateString) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })
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
  const [internalNotes, setInternalNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

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
      const { data } = await api.get('/intake', { params: { status: 'pending', limit: 50 } })
      setIntakes(data.data.map((item) => ({
        ref: item.reference_number,
        submitted: new Date(item.created_at).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        name: item.customer_name,
        org: item.organisation || '',
        email: item.contact_email,
        phone: item.contact_phone,
        serviceType: formatServiceType(item.service_type),
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
    try {
      const body = {
        service_tier: actionTier ? actionTier.toLowerCase() : null,
        notes: internalNotes.trim() || null,
      }
      await api.post(`/intake/${intake.id}/confirm`, body)
      setToast({ type: 'success', message: `Booking created from ${intake.ref}.` })
      await fetchIntakes()
      setSelectedIntake(null)
      setShowDetails(false)
      setActionTier('')
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
      setInternalNotes('')
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to reject submission.'
      setToast({ type: 'error', message })
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
        <div className={`fixed bottom-5 right-5 z-50 w-full max-w-sm rounded-2xl border px-4 py-3 shadow-2xl transition ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
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
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Pending' ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Pending Review</div>
            <div className="text-2xl font-semibold text-amber-500">{intakes.filter((i) => i.status === 'Pending').length}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Confirmed')}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Confirmed' ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Confirmed</div>
            <div className="text-2xl font-semibold text-blue-600">{intakes.filter((i) => i.status === 'Confirmed').length}</div>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Rejected')}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Rejected' ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
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
                    placeholder="Search by name, reference, or organisation…"
                    className={`w-full h-[38px] pl-[34px] pr-3.5 rounded-lg border bg-white text-xs text-slate-800 outline-none transition-colors ${
                      searchFocused ? 'border-blue-500' : 'border-slate-200'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setStatusFilter('')} className={`h-8 px-3 rounded-full text-xs ${statusFilter === '' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>All</button>
                  <button onClick={() => setStatusFilter('Pending')} className={`h-8 px-3 rounded-full text-xs ${statusFilter === 'Pending' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Pending</button>
                  <button onClick={() => setStatusFilter('Confirmed')} className={`h-8 px-3 rounded-full text-xs ${statusFilter === 'Confirmed' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Confirmed</button>
                  <button onClick={() => setStatusFilter('Rejected')} className={`h-8 px-3 rounded-full text-xs ${statusFilter === 'Rejected' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>Rejected</button>
                </div>

                <div className="relative">
                  <select value={serviceTypeFilter} onChange={(e) => setServiceTypeFilter(e.target.value)} className="h-[38px] pl-3 pr-8 rounded-lg border bg-white text-xs outline-none appearance-none cursor-pointer text-slate-400">
                    <option value="">All Service Types</option>
                    <option value="EAS">EAS</option>
                    <option value="MTS">MTS</option>
                    <option value="Event Standby">Event Standby</option>
                    <option value="Workplace Standby">Workplace Standby</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                  <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="h-[38px] pl-3 pr-8 rounded-lg border bg-white text-xs outline-none appearance-none cursor-pointer text-slate-400">
                    <option value="">All Tiers</option>
                    <option value="Basic">Basic</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {['Reference', 'Customer', 'Organisation', 'Service Type', 'Service Tier', 'Preferred Date', 'Time in Queue', 'Action'].map((col) => (
                          <th key={col} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIntakes.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-16 text-center text-slate-400 text-sm">No intake submissions found.</td>
                        </tr>
                      ) : (
                        filteredIntakes.map((it, i) => (
                          <tr key={it.ref} className={`h-12 hover:bg-slate-50/80 transition-colors ${i % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                            <td className="px-4 py-2 align-middle"><span className="text-xs font-semibold text-slate-900 tracking-wide font-mono">{it.ref}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs font-medium text-slate-800">{it.name}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.org}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.serviceType}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{it.tier}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-600">{it.preferredDate}</span></td>
                            <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-600">1h 12m</span></td>
                            <td className="px-4 py-2 align-middle">
                              <button onClick={() => { setSelectedIntake(it); setShowDetails(true); }} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-all">
                                <Eye size={12} />
                                <span>Review</span>
                              </button>
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
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Review Submission</div>
                <div className="text-sm text-slate-500">{selectedIntake.ref} · {selectedIntake.status}</div>
              </div>
              <button onClick={() => { setShowDetails(false); setSelectedIntake(null); setActionTier(''); setInternalNotes('') }} className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] px-6 py-6">
              <div className="space-y-4">
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
                    <div className="text-sm text-slate-900">{selectedIntake.email}</div>
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
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Action</div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Service Tier</label>
                  <select value={actionTier} onChange={(e) => setActionTier(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none">
                    <option value="Basic">Basic</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase text-slate-500">Internal Notes</label>
                  <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} className="mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm outline-none" rows={4} />
                </div>
                <div className="space-y-2">
                  <button onClick={() => { handleConfirmBooking(selectedIntake); }} className="w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-950">Confirm Booking</button>
                  <button onClick={() => { handleReject(selectedIntake); setShowDetails(false); setSelectedIntake(null); setActionTier(''); setInternalNotes('') }} className="w-full rounded-lg bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600">Reject Submission</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
