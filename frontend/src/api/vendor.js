// AP Processing (Kwan Hua) API calls: PDF upload, OCR review, rebate verification, approve/reject.
// Reuses the shared `api` axios instance (JWT + baseURL + 401 handling). Every helper
// unwraps the standard { success, data } envelope and returns the inner `data` payload.
import api from './index'

export async function uploadVendorInvoice(file, rebatePercentage) {
  const form = new FormData()
  form.append('file', file)
  if (rebatePercentage !== undefined && rebatePercentage !== '') {
    form.append('rebate_percentage', rebatePercentage)
  }
  const res = await api.post('/vendor-invoices', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}

export async function listVendorInvoices(params) {
  const res = await api.get('/vendor-invoices', { params })
  return res.data.data // { data: [...], pagination }
}

export async function getVendorInvoice(id) {
  const res = await api.get(`/vendor-invoices/${id}`)
  return res.data.data
}

export async function updateVendorInvoice(id, payload) {
  const res = await api.patch(`/vendor-invoices/${id}`, payload)
  return res.data.data
}

export async function approveVendorInvoice(id, confirmLowConfidence = false) {
  const res = await api.post(`/vendor-invoices/${id}/approve`, {
    confirm_low_confidence: confirmLowConfidence,
  })
  return res.data.data // { id, status, xero_bill_id, approved_at, sync_log }
}

export async function rejectVendorInvoice(id, reason) {
  const res = await api.post(`/vendor-invoices/${id}/reject`, { rejection_reason: reason })
  return res.data.data
}

export async function reextractVendorInvoice(id) {
  const res = await api.post(`/vendor-invoices/${id}/reextract`, { confirm_replace: true })
  return res.data.data
}

export async function getVendorInvoiceIntakeSettings() {
  const res = await api.get('/vendor-invoices/intake-settings')
  return res.data.data
}

export async function updateVendorInvoiceItem(itemId, payload) {
  const res = await api.patch(`/vendor-invoice-items/${itemId}`, payload)
  return res.data.data // { ...item, parent_invoice }
}

export async function createVendorInvoiceItem(invoiceId, payload) {
  const res = await api.post(`/vendor-invoices/${invoiceId}/items`, payload)
  return res.data.data // { ...item, parent_invoice }
}

export async function deleteVendorInvoiceItem(itemId) {
  const res = await api.delete(`/vendor-invoice-items/${itemId}`)
  return res.data.data // { id, parent_invoice }
}
