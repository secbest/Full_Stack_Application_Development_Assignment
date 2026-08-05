// Revenue leakage report (Kwan Hua). Reuses the shared `api` axios instance
// (src/api/index.js) for the JWT bearer token and 401 handling.
import api from './index'

// GET /api/dashboard/revenue-leakage - aggregated unpriced surcharges.
// Authorised for managing_director and ar_specialist: the MD reads the number, the AR
// Specialist fixes the contracts it points at.
//
// Returns res.data.data, i.e. the report itself. The shared response interceptor passes
// the FULL axios response through (it only handles 401 redirects), so unwrapping is each
// api module's job - see api/xero.js for the same pattern. Returning the raw response here
// left the page reading `summary` off an axios object and blanked the screen.
export async function getRevenueLeakage(params) {
  const res = await api.get('/dashboard/revenue-leakage', { params })
  return res.data.data
}
