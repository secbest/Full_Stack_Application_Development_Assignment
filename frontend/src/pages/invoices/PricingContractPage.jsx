// Owner: Jasper (AR Specialist) - Wave 2B.
// Pricing Contracts List (screen 11): active/expired filter, expired rows at 50% opacity.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeDollarSign, Plus, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { useToast } from '@/context/ToastContext'
import { listContracts } from '@/api/contracts'
import { getContractDisplayStatus } from '@/lib/contractLabels'
import { MAX_CONTRACTS_PER_PAGE } from '@/validation/contractValidation'

const BASE_FILTERS = [
  { key: 'all', label: 'All Contracts' },
  { key: 'active', label: 'Active' },
  { key: 'upcoming', label: 'Upcoming' },
]
// Only shown when "Show inactive contracts" is checked - see PricingContractPage's
// showInactive state for why these are hidden by default.
const INACTIVE_FILTERS = [
  { key: 'deactivated', label: 'Deactivated' },
  { key: 'expired', label: 'Expired' },
]

function formatDate(dateOnly) {
  if (!dateOnly) return '—'
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PricingContractPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Deactivated/expired contracts are hidden by default - they're done, they don't need
  // action, and they just crowd out the ones that do. Checking this reveals their tabs
  // and includes them under "All Contracts" again.
  const [showInactive, setShowInactive] = useState(false)

  function toggleShowInactive() {
    setShowInactive((prev) => {
      const next = !prev
      // Land back on "All Contracts" rather than leaving the user stranded on a tab
      // that's about to disappear (e.g. they were viewing "Expired" and just hid it).
      if (!next && (filter === 'deactivated' || filter === 'expired')) setFilter('all')
      return next
    })
  }

  async function fetchContracts() {
    setLoading(true)
    try {
      const { data, meta } = await listContracts({ limit: MAX_CONTRACTS_PER_PAGE })
      setRows(data)
      setTotalCount(meta?.total ?? data.length)
    } catch {
      toast.error('Failed to load pricing contracts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContracts() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((c) => {
      const status = getContractDisplayStatus(c)
      // Inactive statuses are excluded even from "All Contracts" while hidden - the
      // toggle controls visibility everywhere, not just which tabs are offered.
      if (!showInactive && (status === 'deactivated' || status === 'expired')) return false
      if (filter !== 'all' && status !== filter) return false
      if (q && !c.contract_name.toLowerCase().includes(q) && !(c.client_name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, search, showInactive])

  const visibleFilters = showInactive ? [...BASE_FILTERS, ...INACTIVE_FILTERS] : BASE_FILTERS
  const inactiveCount = rows.filter((c) => ['deactivated', 'expired'].includes(getContractDisplayStatus(c))).length

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgeDollarSign className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Pricing Contracts</h1>
        </div>
        <Button onClick={() => navigate('/pricing-contracts/new')} className="inline-flex items-center gap-2">
          <Plus size={16} /> New Contract
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Contracts</CardTitle>
          <CardDescription>Manage client-specific pricing tables used by the automated matching engine.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {visibleFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
                    filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by client or contract name…"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <label className="mb-3 flex items-center gap-2 text-xs text-slate-500 cursor-pointer w-fit">
            <input type="checkbox" checked={showInactive} onChange={toggleShowInactive} className="h-3.5 w-3.5 rounded border-slate-300" />
            Show inactive contracts (deactivated / expired){!showInactive && inactiveCount > 0 ? ` - ${inactiveCount} hidden` : ''}
          </label>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Contract Name', 'Client', 'Effective From', 'Effective To', 'Status', 'Action'].map((c) => (
                      <th key={c} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No contracts match the current filters.</td></tr>
                  ) : filtered.map((c, idx) => {
                    const status = getContractDisplayStatus(c)
                    return (
                    <tr
                      key={c.id}
                      className={`h-12 hover:bg-slate-50/80 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'} ${['expired', 'deactivated'].includes(status) ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2"><span className="text-xs font-medium text-slate-900">{c.contract_name}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-700">{c.client_name || '—'}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600 whitespace-nowrap">{formatDate(c.effective_from)}</span></td>
                      <td className="px-4 py-2"><span className="text-xs text-slate-600 whitespace-nowrap">{formatDate(c.effective_to)}</span></td>
                      <td className="px-4 py-2"><StatusBadge status={status} /></td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => navigate(`/pricing-contracts/${c.id}`)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!loading && (
              <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500">
                Showing {filtered.length} of {rows.length} contracts
                {totalCount > MAX_CONTRACTS_PER_PAGE && (
                  <span className="text-amber-600"> - {totalCount - MAX_CONTRACTS_PER_PAGE} more exist but aren't shown; pagination isn't implemented on this screen yet.</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
