// Public customer intake submission (UC-01). No auth - reuses the shared `api` axios
// instance purely for its baseURL; the request interceptor only attaches a Bearer
// token when one exists in localStorage, which is harmless (and irrelevant) here.
import api from './index'

export async function submitIntake(payload) {
  const res = await api.post('/intake', payload)
  return res.data.data // { id, reference_number, status, message, created_at }
}
