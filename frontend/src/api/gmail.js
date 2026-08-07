import api from './index'

export async function getGmailIntakeStatus() {
  const res = await api.get('/gmail/status')
  return res.data.data
}

export async function getGmailConnectUrl() {
  const res = await api.get('/gmail/connect')
  return res.data.data.auth_url
}

export async function importGmailInvoices() {
  const res = await api.post('/gmail/import')
  return res.data.data
}
