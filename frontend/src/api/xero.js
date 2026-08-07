// Xero Foundation (Kwan Hua) API calls: connection lifecycle + shared AP/AR sync log panel.
import api from './index'

export async function getXeroStatus() {
  const res = await api.get('/xero/status')
  return res.data.data
}

export async function getXeroConnectUrl() {
  const res = await api.get('/xero/connect')
  return res.data.data.auth_url
}

export async function disconnectXero() {
  const res = await api.delete('/xero/disconnect')
  return res.data.data
}

export async function getXeroExpenseAccounts() {
  const res = await api.get('/xero/expense-accounts')
  return res.data.data // { accounts: [...], simulated }
}

export async function listSyncLogs(params) {
  const res = await api.get('/xero/sync-logs', { params })
  return res.data.data // { data: [...], pagination, xero_connected }
}

export async function retrySyncLog(id) {
  const res = await api.post(`/xero/sync-logs/${id}/retry`)
  return res.data.data
}
