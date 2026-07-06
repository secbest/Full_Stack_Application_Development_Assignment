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

export function getFleetOverview(params) {
  return api.get('/dashboard/fleet-overview', { params })
}

export function getVendorExpenses(params) {
  return api.get('/dashboard/vendor-expenses', { params })
}
