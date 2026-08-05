// Revenue leakage report (Kwan Hua). Reuses the shared `api` axios instance
// (src/api/index.js) for the JWT bearer token and 401 handling.
import api from './index'

// GET /api/dashboard/revenue-leakage - aggregated unpriced surcharges.
// Authorised for managing_director and ar_specialist: the MD reads the number, the AR
// Specialist fixes the contracts it points at.
export function getRevenueLeakage(params) {
  return api.get('/dashboard/revenue-leakage', { params })
}
