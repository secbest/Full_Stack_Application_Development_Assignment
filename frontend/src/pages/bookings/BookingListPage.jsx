import React, { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, Eye, Search, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { bookingAssignmentSchema } from '@/schemas'
import api from '../../api'

// Backend stores service_type as a lowercase code; the filter/table need the display label.
const SERVICE_TYPE_LABELS = {
  eas: 'EAS',
  mts: 'MTS',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

// Backend stores status as a lowercase code. A naive "capitalize first letter, replace
// underscore with space" (the previous approach) turns in_progress into "In progress"
// (lowercase p) - which matches neither the "In Progress" filter buttons below nor the
// STATUS_BADGE_CLASSES/STATUS_ROW_CLASSES keys, so in-progress bookings silently fell
// through to the default/no-match styling. An explicit label map avoids that mismatch.
const BOOKING_STATUS_LABELS = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
}

// Status badge colors follow the CLAUDE.md status pattern: Confirmed/Info = blue,
// In Progress/Warning = amber, Invoiced/Success = green, Completed = neutral slate.
const STATUS_BADGE_CLASSES = {
  Confirmed: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-slate-200 text-slate-700',
  Invoiced: 'bg-emerald-100 text-emerald-700',
}

// Filter pill active-state colors, following the same CLAUDE.md status pattern as
// STATUS_BADGE_CLASSES above and IntakeQueuePage's STATUS_FILTER_PILLS: the active pill
// fills with the color of the status it filters to, so e.g. "In Progress" (this page's
// closest equivalent to Intake's amber "Pending") turns amber/yellow when selected,
// instead of every pill turning the same neutral black regardless of which status it is.
const BOOKING_STATUS_FILTER_PILLS = [
  { value: '', label: 'All', activeClass: 'bg-slate-900 text-white' },
  { value: 'Confirmed', label: 'Confirmed', activeClass: 'bg-blue-500 text-white' },
  { value: 'In Progress', label: 'In Progress', activeClass: 'bg-amber-500 text-white' },
  { value: 'Completed', label: 'Completed', activeClass: 'bg-slate-600 text-white' },
  { value: 'Invoiced', label: 'Invoiced', activeClass: 'bg-emerald-500 text-white' },
]

// Row tint mirrors the badge colors so status is readable at a glance; unassigned
// takes priority since it's the most actionable state regardless of booking status.
const STATUS_ROW_CLASSES = {
  Confirmed: 'bg-blue-100/70',
  'In Progress': 'bg-amber-100/70',
  Completed: 'bg-slate-200/70',
  Invoiced: 'bg-emerald-100/70',
}

function getRowBackground(booking) {
  if (!booking.assignedCrew) return 'bg-red-200/60'
  return STATUS_ROW_CLASSES[booking.status] || 'bg-white'
}

// Booking.js documents each stage as driven by a different team: Confirmed (Quotations),
// In Progress (crew assignment, since there's no separate "Start Job" action yet),
// Completed (field crew's memo submission), Invoiced (AR's Xero sync). The timeline
// below reads directly off the real booking.status instead of always showing
// "Confirmed" as the only reached stage.
const STATUS_STAGES = ['Confirmed', 'In Progress', 'Completed', 'Invoiced']

// Labels for the Linked Records panel - service_memos.status and invoices.status are
// both lowercase backend enums.
const MEMO_STATUS_LABELS = {
  submitted: 'Submitted - pending AR review',
  reviewed: 'Reviewed by AR',
  invoiced: 'Invoiced',
}
const INVOICE_STATUS_LABELS = {
  matched: 'Matched',
  adjusted: 'Adjusted',
  approved: 'Approved',
  synced_to_xero: 'Synced to Xero',
  failed: 'Failed to sync',
  unmatched: 'Unmatched',
}

function getStageNote(stage, booking, reached) {
  if (!reached) return 'Pending'
  if (stage === 'Confirmed') return booking.created
  if (stage === 'In Progress') return booking.assignedCrew ? `Crew assigned: ${booking.assignedCrew}` : 'Reached'
  if (stage === 'Completed') return 'Service memo submitted by field crew'
  if (stage === 'Invoiced') return 'Synced to Xero by AR'
  return 'Reached'
}

const INITIAL_BOOKINGS = []

export default function BookingListPage() {
  // Local component state for filter inputs, search, and modal selection.
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS)
  const [query, setQuery] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [unassignedFilter, setUnassignedFilter] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [assignedCrew, setAssignedCrew] = useState('')
  const [assignmentNotification, setAssignmentNotification] = useState(null)
  const [notificationVisible, setNotificationVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [crewOptions, setCrewOptions] = useState([])
  const [crewMenuOpen, setCrewMenuOpen] = useState(false)
  const [crewSearch, setCrewSearch] = useState('')
  const crewMenuRef = useRef(null)
  const [viewedIntake, setViewedIntake] = useState(null)
  const [viewedIntakeLoading, setViewedIntakeLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Derived counts used for the stats cards at the top of the page.
  const totalCount = bookings.length
  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length
  const inProgressCount = bookings.filter((b) => b.status === 'In Progress').length
  const completedCount = bookings.filter((b) => b.status === 'Completed').length
  const invoicedCount = bookings.filter((b) => b.status === 'Invoiced').length
  const unassignedCount = bookings.filter((b) => !b.assignedCrew).length

  // Parse the human-readable scheduled string into a Date object.
  // Returns null for invalid date strings so filters can safely skip bad records.
  const parseBookingDate = (booking) => {
    const date = new Date(booking.scheduled)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Apply the selected date filter to each booking.
  // Supports Today, This Week, and This Month selections.
  const matchesDateFilter = (booking) => {
    if (!dateFilter) return true
    const schedule = parseBookingDate(booking)
    if (!schedule) return false
    const now = new Date()
    const normalizedToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const normalizedSchedule = new Date(schedule.getFullYear(), schedule.getMonth(), schedule.getDate())

    if (dateFilter === 'Today') {
      return normalizedSchedule.getTime() === normalizedToday.getTime()
    }

    if (dateFilter === 'This Week') {
      const startOfWeek = new Date(normalizedToday)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return normalizedSchedule.getTime() >= startOfWeek.getTime() && normalizedSchedule.getTime() <= endOfWeek.getTime()
    }

    if (dateFilter === 'This Month') {
      return normalizedSchedule.getMonth() === normalizedToday.getMonth() && normalizedSchedule.getFullYear() === normalizedToday.getFullYear()
    }

    return true
  }

  // Combine search and filter criteria into a single filtered list for the table.
  const filtered = bookings.filter((b) => {
    const q = query.trim().toLowerCase()
    if (q && !(b.ref.toLowerCase().includes(q) || b.client.toLowerCase().includes(q))) return false
    if (statusFilter && b.status !== statusFilter) return false
    if (unassignedFilter && b.assignedCrew) return false
    if (serviceTypeFilter && b.serviceType !== serviceTypeFilter) return false
    if (tierFilter && b.tier !== tierFilter) return false
    if (!matchesDateFilter(b)) return false
    return true
  })

  async function fetchBookings() {
    setLoading(true)
    try {
      const { data } = await api.get('/bookings', { params: { limit: 50 } })
      setBookings(data.data.data.map((booking) => ({
        ref: booking.reference_number,
        id: booking.id,
        created: new Date(booking.created_at).toLocaleString('en-SG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
        createdBy: booking.created_by_name || booking.created_by,
        linkedIntake: booking.intake_reference || booking.intake_submission_id,
        intakeSubmissionId: booking.intake_submission_id,
        client: booking.client_name || 'Unknown client',
        serviceType: SERVICE_TYPE_LABELS[booking.service_type] || booking.service_type,
        tier: booking.service_tier.charAt(0).toUpperCase() + booking.service_tier.slice(1),
        status: BOOKING_STATUS_LABELS[booking.status] || booking.status,
        tierNote: booking.original_service_tier ? `Adjusted from: ${booking.original_service_tier}` : '',
        scheduled: booking.scheduled_date && booking.scheduled_time ? `${booking.scheduled_date}, ${booking.scheduled_time}` : '',
        pickup: booking.pickup_location || '',
        destination: booking.destination || '',
        internalNotes: booking.notes || '',
        assignedCrew: booking.assigned_crew_name || '',
        hasMemo: booking.has_memo,
        memoStatus: booking.memo_status,
        hasInvoice: booking.has_invoice,
        invoiceStatus: booking.invoice_status,
      })))
    } catch (err) {
      setAssignmentNotification({ type: 'error', message: 'Failed to load bookings. Please refresh.' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchCrewOptions() {
    try {
      const { data } = await api.get('/users', { params: { role: 'field_crew' } })
      setCrewOptions(data.data.map((user) => ({ id: user.id, name: user.name })))
    } catch (err) {
      setAssignmentNotification({ type: 'error', message: 'Failed to load crew list.' })
    }
  }

  useEffect(() => {
    fetchBookings()
    fetchCrewOptions()
  }, [])

  // Close the crew search dropdown when clicking outside of it.
  useEffect(() => {
    if (!crewMenuOpen) return undefined
    const handleClickOutside = (e) => {
      if (crewMenuRef.current && !crewMenuRef.current.contains(e.target)) setCrewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [crewMenuOpen])

  const filteredCrewOptions = crewOptions.filter((crew) =>
    crew.name.toLowerCase().includes(crewSearch.trim().toLowerCase())
  )

  async function handleViewLinkedIntake(intakeSubmissionId) {
    if (!intakeSubmissionId) return
    setViewedIntakeLoading(true)
    try {
      const { data } = await api.get(`/intake/${intakeSubmissionId}`)
      setViewedIntake(data.data)
    } catch (err) {
      setAssignmentNotification({ type: 'error', message: 'Failed to load linked intake submission.' })
    } finally {
      setViewedIntakeLoading(false)
    }
  }

  async function handleSaveAssignment(bookingRef) {
    try {
      bookingAssignmentSchema.validateSync({ assignedCrew })
      const booking = bookings.find((b) => b.ref === bookingRef)
      if (!booking) throw new Error('Booking not found.')
      const selected = crewOptions.find((crew) => crew.name === assignedCrew)
      if (!selected) throw new Error('Selected crew member is invalid.')

      const { data } = await api.patch(`/bookings/${booking.id}/crew`, { assigned_crew_id: selected.id })
      // Assigning crew to a 'confirmed' booking flips it to 'in_progress' server-side
      // (see bookingController.updateBookingCrew) - reflect that status change locally too,
      // so the Status Timeline updates immediately instead of needing a refetch.
      const status = BOOKING_STATUS_LABELS[data.data.status] || data.data.status
      setBookings((bs) => bs.map((b) => (b.ref === bookingRef ? { ...b, assignedCrew, status } : b)))
      if (selectedBooking && selectedBooking.ref === bookingRef) setSelectedBooking({ ...selectedBooking, assignedCrew, status })
      setAssignmentNotification({ type: 'success', message: `Assigned ${assignedCrew} to ${bookingRef}` })
      setCrewMenuOpen(false)
      setCrewSearch('')
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to assign crew.'
      setAssignmentNotification({ type: 'error', message })
    }
  }

  // Only invoiced bookings can be deleted (see backend/src/controllers/bookingController.js) -
  // by that stage Xero holds the master copy, so this just clears completed clutter locally.
  async function confirmDelete() {
    const booking = deleteTarget
    if (!booking) return
    try {
      await api.delete(`/bookings/${booking.id}`)
      setAssignmentNotification({ type: 'success', message: `Booking ${booking.ref} deleted.` })
      if (selectedBooking && selectedBooking.ref === booking.ref) setSelectedBooking(null)
      await fetchBookings()
    } catch (err) {
      setAssignmentNotification({ type: 'error', message: err.response?.data?.message || 'Failed to delete booking.' })
    } finally {
      setDeleteTarget(null)
    }
  }

  useEffect(() => {
    if (!assignmentNotification) {
      setNotificationVisible(false)
      return undefined
    }

    setNotificationVisible(true)
    const hideTimer = window.setTimeout(() => setNotificationVisible(false), 2800)
    const clearTimer = window.setTimeout(() => setAssignmentNotification(null), 3200)

    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(clearTimer)
    }
  }, [assignmentNotification])

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <CalendarDays className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
      </div>

      {assignmentNotification ? (
        <div className={`fixed bottom-5 right-5 z-[60] w-full max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl transition-all duration-300 ease-out ${notificationVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
          <div className={`text-sm font-medium ${assignmentNotification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {assignmentNotification.message}
          </div>
        </div>
      ) : null}

      <div className="p-4 bg-white rounded-lg border mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setUnassignedFilter(false) }}
            className={`text-left rounded-2xl border p-4 transition ${!statusFilter && !unassignedFilter ? 'border-slate-900 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Total Bookings</div>
            <div className="text-2xl font-semibold text-foreground">{totalCount}</div>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Confirmed'); setUnassignedFilter(false) }}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Confirmed' ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Confirmed</div>
            <div className="text-2xl font-semibold text-blue-600">{confirmedCount}</div>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Completed'); setUnassignedFilter(false) }}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Completed' ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Completed (Memo Pending)</div>
            <div className="text-2xl font-semibold text-slate-900">{completedCount}</div>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('Invoiced'); setUnassignedFilter(false) }}
            className={`text-left rounded-2xl border p-4 transition ${statusFilter === 'Invoiced' ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Invoiced</div>
            <div className="text-2xl font-semibold text-emerald-600">{invoicedCount}</div>
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setUnassignedFilter(true) }}
            className={`text-left rounded-2xl border p-4 transition ${unassignedFilter ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="text-sm text-slate-500">Unassigned</div>
            <div className="text-2xl font-semibold text-amber-500">{unassignedCount}</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Bookings</CardTitle>
              <CardDescription>Manage bookings and view details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px] relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    placeholder="Search by reference or client"
                    className={`w-full h-[38px] pl-[34px] pr-3.5 rounded-lg border-2 bg-white text-xs text-slate-800 outline-none transition-colors ${
                      searchFocused ? 'border-blue-500' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  />
                </div>

                <div className="flex gap-2 items-center">
                  <div className="flex items-center gap-2">
                    {BOOKING_STATUS_FILTER_PILLS.map((pill) => (
                      <button
                        key={pill.value || 'all'}
                        onClick={() => { setStatusFilter(pill.value); setUnassignedFilter(false) }}
                        className={`h-8 px-3 rounded-full text-xs transition-colors ${statusFilter === pill.value && !unassignedFilter ? pill.activeClass : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
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
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>

                  <div className="relative">
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={`h-[38px] pl-3 pr-8 rounded-lg border-2 bg-white text-xs font-medium outline-none appearance-none cursor-pointer transition-colors hover:border-slate-400 focus:border-blue-500 ${dateFilter ? 'border-slate-300 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                      <option value="">All Dates</option>
                      <option value="Today">Today</option>
                      <option value="This Week">This Week</option>
                      <option value="This Month">This Month</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>

                  <div className="relative">
                    <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className={`h-[38px] pl-3 pr-8 rounded-lg border-2 bg-white text-xs font-medium outline-none appearance-none cursor-pointer transition-colors hover:border-slate-400 focus:border-blue-500 ${tierFilter ? 'border-slate-300 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                      <option value="">All Tiers</option>
                      <option value="Basic">Basic</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Critical">Critical</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {['Booking Ref', 'Client', 'Service Type', 'Tier', 'Status', 'Scheduled', 'Assigned', 'Action'].map((c) => (
                          <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => (
                        <tr
                          key={b.ref}
                          onClick={() => { setSelectedBooking(b); setAssignedCrew(b.assignedCrew || ''); setCrewSearch(''); setCrewMenuOpen(false); }}
                          className={`h-12 cursor-pointer ${getRowBackground(b)}`}
                        >
                          <td className="px-4 py-2 align-middle"><span className="text-xs font-semibold text-slate-900 tracking-wide font-mono">{b.ref}</span></td>
                          <td className="px-4 py-2 align-middle"><span className="text-xs font-medium text-slate-800">{b.client}</span></td>
                          <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{b.serviceType}</span></td>
                          <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-800">{b.tier}</span></td>
                          <td className="px-4 py-2 align-middle">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_BADGE_CLASSES[b.status] || 'bg-slate-100 text-slate-600'}`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 align-middle"><span className="text-xs text-slate-600">{b.scheduled}</span></td>
                          <td className="px-4 py-2 align-middle">
                            {b.assignedCrew ? (
                              <span className="text-xs text-slate-600">{b.assignedCrew}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 whitespace-nowrap">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-2 align-middle">
                            <div className="flex items-center gap-2">
                              <button onClick={(e) => { e.stopPropagation(); setSelectedBooking(b); setAssignedCrew(b.assignedCrew || ''); setCrewSearch(''); setCrewMenuOpen(false); }} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-all">
                                <Eye size={12} />
                                <span>Review</span>
                              </button>
                              {b.status === 'Invoiced' ? (
                                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-medium cursor-pointer whitespace-nowrap transition-all">
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              ) : null}
                            </div>
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
      </div>
      {selectedBooking ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-6xl max-h-[calc(100vh-80px)] rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Booking Details</div>
                <div className="text-sm text-slate-500">{selectedBooking.ref} · {selectedBooking.status}</div>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="grid gap-6 lg:grid-cols-[2.4fr_0.75fr] overflow-hidden px-6 py-6" style={{ maxHeight: 'calc(100vh - 250px)' }}>
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr] overflow-y-auto pr-0 lg:pr-6" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase text-slate-500">Booking Summary</div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Booking Ref</div>
                    <div className="text-sm font-semibold text-slate-900">{selectedBooking.ref}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Created</div>
                    <div className="text-sm text-slate-900">{selectedBooking.created} by {selectedBooking.createdBy}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Client</div>
                    <div className="text-sm text-slate-900">{selectedBooking.client}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Linked Intake</div>
                    {selectedBooking.intakeSubmissionId ? (
                      <button
                        type="button"
                        onClick={() => handleViewLinkedIntake(selectedBooking.intakeSubmissionId)}
                        className="text-sm text-blue-600 underline cursor-pointer hover:text-blue-800"
                      >
                        {selectedBooking.linkedIntake}
                      </button>
                    ) : (
                      <div className="text-sm text-slate-400">Not linked to an intake submission</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase text-slate-500">Status Timeline</div>
                  <div className="space-y-4">
                    {STATUS_STAGES.map((stage) => {
                      const currentIndex = STATUS_STAGES.indexOf(selectedBooking.status)
                      const reached = STATUS_STAGES.indexOf(stage) <= currentIndex
                      return (
                        <div className="flex items-start gap-3" key={stage}>
                          <div className={`mt-1 h-3 w-3 rounded-full ${reached ? 'bg-slate-900' : 'border border-slate-300 bg-white'}`}></div>
                          <div>
                            <div className={`text-sm font-semibold ${reached ? 'text-slate-900' : 'text-slate-500'}`}>{stage}</div>
                            <div className={`text-xs ${reached ? 'text-slate-500' : 'text-slate-400'}`}>{getStageNote(stage, selectedBooking, reached)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-medium uppercase text-slate-500">Booking Details</div>
                    <div className="mt-3 space-y-4">
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Service Type</div>
                        <div className="text-sm text-slate-900">{selectedBooking.serviceType}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Service Tier</div>
                        <div className="text-sm text-slate-900">{selectedBooking.tier}</div>
                        <div className="text-xs text-slate-400">{selectedBooking.tierNote}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Scheduled</div>
                        <div className="text-sm text-slate-900">{selectedBooking.scheduled}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Assigned Crew</div>
                        <div className="text-sm text-slate-900">{selectedBooking.assignedCrew || 'Unassigned'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Pickup</div>
                        <div className="text-sm text-slate-900">{selectedBooking.pickup}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Destination</div>
                        <div className="text-sm text-slate-900">{selectedBooking.destination}</div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase text-slate-500">Internal Notes</div>
                        <div className="text-sm text-slate-900">{selectedBooking.internalNotes}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                <div className="text-xs font-medium uppercase text-slate-500">Actions & Links</div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Crew Assignment</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="relative" ref={crewMenuRef}>
                        <button
                          type="button"
                          onClick={() => setCrewMenuOpen((open) => !open)}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none"
                        >
                          <span className={assignedCrew ? 'text-slate-800' : 'text-slate-400'}>{assignedCrew || '-- Select crew member --'}</span>
                          <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {crewMenuOpen ? (
                          <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                            <div className="relative border-b border-slate-100 p-2">
                              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                autoFocus
                                value={crewSearch}
                                onChange={(e) => setCrewSearch(e.target.value)}
                                placeholder="Search crew…"
                                className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="max-h-40 overflow-y-auto py-1">
                              {filteredCrewOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-slate-400">No crew found.</div>
                              ) : (
                                filteredCrewOptions.map((crew) => (
                                  <button
                                    type="button"
                                    key={crew.id}
                                    onClick={() => { setAssignedCrew(crew.name); setCrewMenuOpen(false); setCrewSearch(''); }}
                                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 ${assignedCrew === crew.name ? 'bg-slate-50 font-medium text-slate-900' : 'text-slate-700'}`}
                                  >
                                    {crew.name}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <button onClick={() => handleSaveAssignment(selectedBooking.ref)} className="h-10 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800">Save</button>
                      {selectedBooking.assignedCrew && <div className="text-sm text-slate-700">Currently: {selectedBooking.assignedCrew}</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Linked Records</div>
                    <div className="mt-2 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span>Service Memo</span>
                        <span className={selectedBooking.hasMemo ? 'font-medium text-slate-900' : 'text-slate-500'}>
                          {selectedBooking.hasMemo ? (MEMO_STATUS_LABELS[selectedBooking.memoStatus] || selectedBooking.memoStatus) : 'Not yet submitted'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Invoice</span>
                        <span className={selectedBooking.hasInvoice ? 'font-medium text-slate-900' : 'text-slate-500'}>
                          {selectedBooking.hasInvoice ? (INVOICE_STATUS_LABELS[selectedBooking.invoiceStatus] || selectedBooking.invoiceStatus) : 'Not yet generated'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right">
              <button onClick={() => setSelectedBooking(null)} className="h-10 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {viewedIntakeLoading || viewedIntake ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">Linked Intake (read-only)</div>
                {viewedIntake ? (
                  <div className="text-sm text-slate-500">{viewedIntake.reference_number} · {viewedIntake.status}</div>
                ) : null}
              </div>
              <button onClick={() => setViewedIntake(null)} className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-6 py-6">
              {viewedIntakeLoading ? (
                <div className="py-10 text-center text-sm text-slate-400">Loading intake submission…</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Customer Name</div>
                    <div className="text-sm text-slate-900">{viewedIntake.customer_name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Organisation</div>
                    <div className="text-sm text-slate-900">{viewedIntake.organisation || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Email</div>
                    <div className="text-sm text-slate-900 break-all">{viewedIntake.contact_email}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Phone</div>
                    <div className="text-sm text-slate-900">{viewedIntake.contact_phone}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Service Type</div>
                    <div className="text-sm text-slate-900">{SERVICE_TYPE_LABELS[viewedIntake.service_type] || viewedIntake.service_type}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Service Tier</div>
                    <div className="text-sm text-slate-900">{viewedIntake.service_tier ? viewedIntake.service_tier.charAt(0).toUpperCase() + viewedIntake.service_tier.slice(1) : 'To be assessed'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Preferred Date</div>
                    <div className="text-sm text-slate-900">{viewedIntake.preferred_date}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-slate-500">Preferred Time</div>
                    <div className="text-sm text-slate-900">{viewedIntake.preferred_time}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase text-slate-500">Pickup Location</div>
                    <div className="text-sm text-slate-900">{viewedIntake.pickup_location}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase text-slate-500">Destination</div>
                    <div className="text-sm text-slate-900">{viewedIntake.destination}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase text-slate-500">Additional Notes</div>
                    <div className="text-sm text-slate-900">{viewedIntake.additional_notes || '-'}</div>
                  </div>
                  {viewedIntake.rejection_reason ? (
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase text-slate-500">Rejection Reason</div>
                      <div className="text-sm text-slate-900">{viewedIntake.rejection_reason}</div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-right">
              <button onClick={() => setViewedIntake(null)} className="h-10 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this booking?"
        description={deleteTarget ? `Booking ${deleteTarget.ref} and its service memo, invoice, and job milestones will be permanently deleted. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
