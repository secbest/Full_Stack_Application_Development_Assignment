// Field Operations & Executive Dashboard API calls.
// Reuses the shared `api` axios instance (src/api/index.js) rather than a new instance -
// it already reads VITE_API_BASE_URL, attaches the JWT bearer token on every request, and
// redirects to /login on a real 401. A second axios instance would just duplicate that.
import api from './index'

export function uploadSignature(file) {
  const form = new FormData()
  form.append('file', file)
  return api.post('/service-memos/upload-signature', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function uploadHospitalStamp(file) {
  const form = new FormData()
  form.append('file', file)
  return api.post('/service-memos/upload-hospital-stamp', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function createServiceMemo(payload) {
  return api.post('/service-memos', payload)
}

export function listServiceMemos(params) {
  return api.get('/service-memos', { params })
}

export function getServiceMemo(id) {
  return api.get(`/service-memos/${id}`)
}

export function listMyJobs(dateFilter) {
  return api.get('/bookings/my-jobs', { params: dateFilter ? { date_filter: dateFilter } : {} })
}

export function getBooking(id) {
  return api.get(`/bookings/${id}`)
}

// Client feedback item 1 - live tap-to-timestamp. The server records the time; the
// client only names the milestone, so there is nothing to backdate.
export function recordMilestone(bookingId, milestoneType) {
  return api.post(`/bookings/${bookingId}/milestone`, { milestone_type: milestoneType })
}

// Sends a job back to Quotations for reassignment - the crew must give a reason.
export function rejectJob(bookingId, reason) {
  return api.post(`/bookings/${bookingId}/reject`, { reason })
}

export function getFleetOverview(params) {
  return api.get('/dashboard/fleet-overview', { params })
}

export function getVendorExpenses(params) {
  return api.get('/dashboard/vendor-expenses', { params })
}

export function getCycleTime(params) {
  return api.get('/dashboard/cycle-time', { params })
}

export function getXeroHealth() {
  return api.get('/dashboard/xero-health')
}

export function getRevenueTrend(params) {
  return api.get('/dashboard/revenue-trend', { params })
}

export function getTopClients() {
  return api.get('/dashboard/top-clients')
}

export function getRevenueByServiceType(params) {
  return api.get('/dashboard/revenue-by-service-type', { params })
}

export function getLeakageHistory(params) {
  return api.get('/dashboard/leakage-history', { params })
}

export function getCrewPositions() {
  return api.get('/dashboard/crew-positions')
}
