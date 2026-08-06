// AR Billing (Wave 3, implemented by Kwan Hua; AR design by Jasper) API calls:
// memo review, invoices, line items, Xero sync.
// Reuses the shared `api` axios instance (JWT + baseURL + 401 handling). Every helper
// unwraps the standard { success, data } envelope and returns the inner `data` payload.
import api from './index'

// ─── Memo review queue ───────────────────────────────────────────────────────
export async function listPendingMemos(params) {
  const res = await api.get('/service-memos/pending-review', { params })
  return res.data.data // { data: [...], meta }
}

export async function getMemo(id) {
  const res = await api.get(`/service-memos/${id}`)
  return res.data.data
}

export async function approveMemo(id) {
  const res = await api.patch(`/service-memos/${id}/approve`)
  return res.data.data // { memo_id, memo_status, invoice }
}

export async function returnMemo(id, note) {
  const res = await api.patch(`/service-memos/${id}/return`, { note })
  return res.data.data
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export async function listInvoices(params) {
  const res = await api.get('/invoices', { params })
  return res.data.data // { data: [...], meta }
}

export async function getInvoice(id) {
  const res = await api.get(`/invoices/${id}`)
  return res.data.data
}

export async function rematchInvoice(id) {
  const res = await api.post(`/invoices/${id}/rematch`)
  return res.data.data
}

export async function addLineItem(invoiceId, payload) {
  const res = await api.post(`/invoices/${invoiceId}/line-items`, payload)
  return res.data.data // { data: item, invoice }
}

export async function updateLineItem(invoiceId, itemId, payload) {
  const res = await api.put(`/invoices/${invoiceId}/line-items/${itemId}`, payload)
  return res.data.data
}

export async function deleteLineItem(invoiceId, itemId) {
  const res = await api.delete(`/invoices/${invoiceId}/line-items/${itemId}`)
  return res.data.data
}

export async function batchApprove(invoiceIds) {
  const res = await api.post('/invoices/batch-approve', { invoice_ids: invoiceIds })
  return res.data.data // { approved, skipped, queued_for_xero }
}

export async function retryXero(id) {
  const res = await api.post(`/invoices/${id}/retry-xero`)
  return res.data.data
}
