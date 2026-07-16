// Owner: Jasper (AR Specialist) - Wave 2B.
// Pricing Contract Detail (screen 12): rates table with inline add/edit/delete,
// surcharge schedule with a batch edit mode.
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { MiniSelect } from '@/components/MiniSelect'
import { NumberStepper } from '@/components/NumberStepper'
import { useToast } from '@/context/ToastContext'
import { getContract, updateContract, addRate, updateRate, deleteRate, updateSurcharge } from '@/api/contracts'
import { SERVICE_TYPES, TRANSFER_TYPES, TIME_OF_DAY, rateSchema, updateRateSchema, updateSurchargeSchema, MAX_RATE_AMOUNT, MAX_SURCHARGE_AMOUNT } from '@/validation/contractValidation'
import { SERVICE_TYPE_LABELS, TRANSFER_TYPE_LABELS, TIME_OF_DAY_LABELS, SURCHARGE_TYPE_LABELS, getContractDisplayStatus } from '@/lib/contractLabels'

const money = (n) => `$${Number(n || 0).toFixed(2)}`
function formatDate(dateOnly) {
  if (!dateOnly) return '—'
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_NEW_RATE = { service_type: '', transfer_type: '', time_of_day: '', base_amount: '' }

export default function ContractDetailPage() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()

  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [addingRate, setAddingRate] = useState(false)
  const [newRate, setNewRate] = useState(EMPTY_NEW_RATE)
  const [editingRateId, setEditingRateId] = useState(null)
  const [editAmount, setEditAmount] = useState('')

  const [editingSurcharges, setEditingSurcharges] = useState(false)
  const [surchargeDraft, setSurchargeDraft] = useState({})

  async function load() {
    setLoading(true)
    try {
      setContract(await getContract(id))
    } catch {
      toast.error('Failed to load contract.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // Sentinel distinguishing "user declined the confirm dialog" from "the request
  // actually failed" - the two must never be handled the same way. Returning it
  // (instead of throwing) means a deliberate Cancel doesn't get reported to the user
  // as an error just because it shares a code path with a real API failure.
  const DECLINED = Symbol('declined')

  // Sends a PATCH, and if the contract has matched invoices the backend responds
  // 400 HAS_MATCHED_INVOICES instead of applying it (UC-02) - this re-sends with the
  // acknowledgment flag once the user confirms, rather than failing silently.
  async function patchWithAcknowledgment(payload) {
    try {
      return await updateContract(id, payload)
    } catch (err) {
      if (err.response?.data?.code === 'HAS_MATCHED_INVOICES') {
        const proceed = window.confirm(
          `${err.response.data.message}\n\nProceed anyway? This will not change any already-matched invoices.`
        )
        if (proceed) return updateContract(id, { ...payload, acknowledge_matched_invoices: true })
        return DECLINED
      }
      throw err
    }
  }

  async function handleDeactivate(status) {
    const confirmMessage = status === 'upcoming'
      ? 'Deactivate this contract? It has not started yet and will never become active unless you reactivate it.'
      : 'Deactivate this contract? It will stop matching new jobs immediately.'
    if (!window.confirm(confirmMessage)) return
    setBusy(true)
    try {
      const result = await patchWithAcknowledgment({ is_active: false })
      if (result === DECLINED) return
      toast.success('Contract deactivated.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate contract.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddRate() {
    try {
      await rateSchema.validate(newRate)
    } catch (err) {
      toast.error(err.message)
      return
    }
    const { service_type, transfer_type, time_of_day, base_amount } = newRate
    setBusy(true)
    try {
      await addRate(contract.id, { service_type, transfer_type, time_of_day, base_amount: Number(base_amount) })
      toast.success('Rate added.')
      setNewRate(EMPTY_NEW_RATE)
      setAddingRate(false)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add rate.')
    } finally {
      setBusy(false)
    }
  }

  // Only base_amount is editable on an existing rate (PUT .../rates/:id only accepts
  // base_amount) - service_type/transfer_type/time_of_day are fixed once created, since
  // changing them would silently change which jobs this rate matches. Delete + re-add
  // is the intended path for changing the combination itself.
  async function handleSaveRateEdit(rateId) {
    try {
      await updateRateSchema.validate({ base_amount: editAmount })
    } catch (err) {
      toast.error(err.message)
      return
    }
    setBusy(true)
    try {
      await updateRate(contract.id, rateId, { base_amount: Number(editAmount) })
      toast.success('Rate updated.')
      setEditingRateId(null)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update rate.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteRate(rateId) {
    if (!window.confirm('Delete this rate row? This cannot be undone.')) return
    setBusy(true)
    try {
      await deleteRate(contract.id, rateId)
      toast.success('Rate deleted.')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete rate.')
    } finally {
      setBusy(false)
    }
  }

  function startEditSurcharges() {
    const draft = {}
    contract.surcharges.forEach((s) => { draft[s.id] = s.amount })
    setSurchargeDraft(draft)
    setEditingSurcharges(true)
  }

  async function handleSaveSurcharges() {
    for (const s of contract.surcharges) {
      try {
        await updateSurchargeSchema.validate({ amount: surchargeDraft[s.id] })
      } catch (err) {
        toast.error(`${SURCHARGE_TYPE_LABELS[s.surcharge_type]}: ${err.message}`)
        return
      }
    }
    setBusy(true)
    try {
      // Each surcharge is its own independent PUT - there's no backend endpoint that
      // updates all 12 in one transaction, so this can never be truly atomic. Using
      // allSettled (not all) means a single failure doesn't hide which rows actually
      // saved: every row that succeeded stays saved, we tell the user exactly which
      // one(s) failed, and we always reload so the UI reflects the real server state
      // instead of the stale pre-edit draft staying on screen next to a vague error.
      const results = await Promise.allSettled(
        contract.surcharges.map((s) => updateSurcharge(contract.id, s.id, { amount: Number(surchargeDraft[s.id]) }))
      )
      const failures = results
        .map((r, i) => ({ r, s: contract.surcharges[i] }))
        .filter(({ r }) => r.status === 'rejected')

      if (failures.length === 0) {
        toast.success('Surcharge schedule updated.')
        setEditingSurcharges(false)
      } else {
        const names = failures.map(({ s }) => SURCHARGE_TYPE_LABELS[s.surcharge_type]).join(', ')
        toast.error(`Failed to update: ${names}. Other changes were saved - review and retry the failed row(s).`)
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  if (!contract) return <div className="p-6 text-sm text-slate-400">Contract not found.</div>

  // is_active alone can't tell "not started yet" / "lapsed" / "manually withdrawn"
  // apart - see contractLabels.getContractDisplayStatus for how the four states are
  // derived. Editing/rate management stays available for active and upcoming contracts
  // only; both expired (lapsed) and deactivated (manually withdrawn) are read-only.
  // Deactivate only makes sense for a contract that isn't already inactive.
  const status = getContractDisplayStatus(contract)
  const canEdit = status === 'active' || status === 'upcoming'
  const canDeactivate = status === 'active' || status === 'upcoming'

  return (
    <div className="p-6 space-y-4 font-sans">
      <button onClick={() => navigate('/pricing-contracts')} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Pricing Contracts
      </button>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{contract.contract_name}</h1>
          <div className="text-sm text-slate-500">
            {contract.client_name} · {formatDate(contract.effective_from)} – {formatDate(contract.effective_to)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/pricing-contracts/${contract.id}/edit`)}>Edit Contract</Button>
          )}
          {canDeactivate && (
            <button
              onClick={() => handleDeactivate(status)}
              disabled={busy}
              className="h-10 px-4 rounded-lg border border-[#EF4444] text-[#EF4444] text-sm font-medium hover:bg-[#FEF2F2] disabled:opacity-40"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {contract.matched_invoice_count > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{contract.matched_invoice_count} invoice(s) have already been matched using this contract. Editing rules will not retroactively change those invoices.</span>
        </div>
      )}

      {status === 'expired' && (
        <div className="text-xs text-slate-500 italic">This contract is expired and read-only.</div>
      )}
      {status === 'deactivated' && (
        <div className="text-xs text-slate-500 italic">This contract has been deactivated and is read-only.</div>
      )}
      {status === 'upcoming' && (
        <div className="text-xs text-slate-500 italic">This contract has not started yet - it will begin matching jobs automatically on {formatDate(contract.effective_from)}.</div>
      )}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Pricing Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pricing Rates</CardTitle>
            {canEdit && !addingRate && (
              <button onClick={() => setAddingRate(true)} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium">
                <Plus size={12} /> Add Rate
              </button>
            )}
          </CardHeader>
          <CardContent>
            {addingRate && (
              // minmax(0, Nfr), not plain Nfr - a bare `1fr` track's minimum width is its
              // content's min-content size, so a long selected label (e.g. "Workplace
              // Standby") can still force that column wider than its fair share and shove
              // the Add/Cancel buttons sideways. minmax(0, ...) removes that content-based
              // floor so the columns stay proportionally fixed no matter what's selected.
              <div className="mb-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-2 items-end rounded-lg border border-slate-200 bg-green-50/60 p-3">
                <MiniSelect value={newRate.service_type} onChange={(v) => setNewRate({ ...newRate, service_type: v })} options={SERVICE_TYPES} labels={SERVICE_TYPE_LABELS} placeholder="Type" />
                <MiniSelect value={newRate.transfer_type} onChange={(v) => setNewRate({ ...newRate, transfer_type: v })} options={TRANSFER_TYPES} labels={TRANSFER_TYPE_LABELS} placeholder="Transfer type" />
                <MiniSelect value={newRate.time_of_day} onChange={(v) => setNewRate({ ...newRate, time_of_day: v })} options={TIME_OF_DAY} labels={TIME_OF_DAY_LABELS} placeholder="Time of day" />
                <NumberStepper
                  value={newRate.base_amount}
                  onChange={(v) => setNewRate({ ...newRate, base_amount: v })}
                  min={0} max={MAX_RATE_AMOUNT} step={1} bigStep={10}
                  placeholder="0.00" ariaLabel="Base amount" className="h-9 w-full"
                />
                <div className="flex gap-1">
                  <button onClick={handleAddRate} disabled={busy} className="h-9 px-3 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40">Add</button>
                  <button onClick={() => { setAddingRate(false); setNewRate(EMPTY_NEW_RATE) }} className="h-9 px-2 rounded-md text-slate-500 text-xs hover:text-slate-800">Cancel</button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    {['Service Type', 'Transfer Type', 'Time of Day', 'Base Amount', 'Actions'].map((c) => (
                      <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contract.rates.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">No rates added yet - the pricing engine cannot match jobs for this contract until rates are added.</td></tr>
                  ) : contract.rates.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 text-sm text-slate-800 whitespace-nowrap">{SERVICE_TYPE_LABELS[r.service_type]}</td>
                      <td className="px-3 py-2 text-sm text-slate-800">{TRANSFER_TYPE_LABELS[r.transfer_type]}</td>
                      <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">{TIME_OF_DAY_LABELS[r.time_of_day]}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-900">
                        {editingRateId === r.id ? (
                          <NumberStepper
                            value={editAmount}
                            onChange={setEditAmount}
                            min={0} max={MAX_RATE_AMOUNT} step={1} bigStep={10}
                            autoFocus ariaLabel="Base amount" className="w-28 h-8"
                          />
                        ) : money(r.base_amount)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {!canEdit ? null : editingRateId === r.id ? (
                          <div className="inline-flex gap-2">
                            <button onClick={() => handleSaveRateEdit(r.id)} disabled={busy} className="text-xs font-medium text-blue-600 hover:text-blue-800">Save</button>
                            <button onClick={() => setEditingRateId(null)} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button onClick={() => { setEditingRateId(r.id); setEditAmount(String(r.base_amount)) }} className="text-slate-400 hover:text-blue-600"><Pencil size={14} /></button>
                            <button onClick={() => handleDeleteRate(r.id)} disabled={busy} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Surcharge Schedule */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Surcharges</CardTitle>
            {canEdit && !editingSurcharges && (
              <button onClick={startEditSurcharges} className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-800 hover:text-white text-xs font-medium">
                Edit Surcharges
              </button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {contract.surcharges.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-slate-400">No surcharge schedule on this contract.</div>
            ) : contract.surcharges.map((s, idx) => (
              <div key={s.id} className={`flex items-center justify-between px-5 py-2.5 ${idx < contract.surcharges.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <span className="text-sm text-slate-600">{SURCHARGE_TYPE_LABELS[s.surcharge_type]}</span>
                {editingSurcharges ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">$</span>
                    <NumberStepper
                      value={surchargeDraft[s.id] ?? ''}
                      onChange={(v) => setSurchargeDraft({ ...surchargeDraft, [s.id]: v })}
                      min={0} max={MAX_SURCHARGE_AMOUNT} step={1} bigStep={10}
                      ariaLabel={`${SURCHARGE_TYPE_LABELS[s.surcharge_type]} amount`} className="w-28 h-8"
                    />
                  </div>
                ) : (
                  <span className="text-sm font-medium text-slate-900">{money(s.amount)}</span>
                )}
              </div>
            ))}
            {editingSurcharges && (
              <div className="flex gap-2 px-5 py-3 border-t border-slate-200">
                <button onClick={handleSaveSurcharges} disabled={busy} className="flex-1 h-9 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">Save Changes</button>
                <button onClick={() => setEditingSurcharges(false)} className="h-9 px-4 rounded-md border border-slate-200 text-slate-600 text-sm hover:text-slate-900">Cancel</button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
