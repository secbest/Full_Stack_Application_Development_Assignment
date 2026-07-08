// Pricing Contracts (Wave 2B, Jasper) API calls.
// Reuses the shared `api` axios instance (JWT + baseURL from VITE_API_BASE_URL + 401
// handling) - same pattern as api/ar.js. Every helper unwraps the standard
// { success, data } envelope and returns the inner `data` payload.
import api from './index'

export async function listContracts(params) {
  const res = await api.get('/contracts', { params })
  return res.data.data // { data: [...], meta }
}

export async function getContract(id) {
  const res = await api.get(`/contracts/${id}`)
  return res.data.data
}

export async function createContract(payload) {
  const res = await api.post('/contracts', payload)
  return res.data.data
}

export async function updateContract(id, payload) {
  const res = await api.patch(`/contracts/${id}`, payload)
  return res.data.data
}

export async function addRate(contractId, payload) {
  const res = await api.post(`/contracts/${contractId}/rates`, payload)
  return res.data.data
}

export async function updateRate(contractId, rateId, payload) {
  const res = await api.put(`/contracts/${contractId}/rates/${rateId}`, payload)
  return res.data.data
}

export async function deleteRate(contractId, rateId) {
  const res = await api.delete(`/contracts/${contractId}/rates/${rateId}`)
  return res.data
}

export async function updateSurcharge(contractId, surchargeId, payload) {
  const res = await api.put(`/contracts/${contractId}/surcharges/${surchargeId}`, payload)
  return res.data.data
}

export async function listClients() {
  const res = await api.get('/clients')
  return res.data.data
}
