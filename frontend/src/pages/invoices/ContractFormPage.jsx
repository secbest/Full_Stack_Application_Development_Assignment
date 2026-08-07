// Owner: Jasper (AR Specialist) - Wave 2B.
// Create/Edit Contract Form (screen 13): contract details + initial rates section,
// sticky save footer. One component for both /pricing-contracts/new and
// /pricing-contracts/:id/edit - see the "Deviations from the Figma mockup" note below.
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFormik } from 'formik'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredLabel } from '@/components/RequiredLabel'
import { FieldError } from '@/components/FieldError'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MiniSelect } from '@/components/MiniSelect'
import { NumberStepper } from '@/components/NumberStepper'
import { useToast } from '@/context/ToastContext'
import { getContract, createContract, updateContract, listClients } from '@/api/contracts'
import { createContractSchema, editContractSchema, rateSchema, updateSurchargeSchema, SERVICE_TYPES, TRANSFER_TYPES, TIME_OF_DAY, SURCHARGE_TYPES, MAX_RATE_AMOUNT, MAX_SURCHARGE_AMOUNT } from '@/validation/contractValidation'
import { SERVICE_TYPE_LABELS, TRANSFER_TYPE_LABELS, TIME_OF_DAY_LABELS, SURCHARGE_TYPE_LABELS, SURCHARGE_DEFAULT_AMOUNTS } from '@/lib/contractLabels'

const EMPTY_NEW_RATE = { service_type: '', transfer_type: '', time_of_day: '', base_amount: '' }

function defaultSurcharges() {
  return SURCHARGE_TYPES.map((surcharge_type) => ({ surcharge_type, amount: String(SURCHARGE_DEFAULT_AMOUNTS[surcharge_type] ?? 0) }))
}

export default function ContractFormPage() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedClientId = isEditing ? '' : searchParams.get('client_id') || ''
  const toast = useToast()

  const [loading, setLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState(false)
  const [clients, setClients] = useState([])
  const [rates, setRates] = useState([])
  const [newRate, setNewRate] = useState(EMPTY_NEW_RATE)
  const [surcharges, setSurcharges] = useState(isEditing ? [] : defaultSurcharges())

  const formik = useFormik({
    initialValues: { client_id: requestedClientId, contract_name: '', effective_from: '', effective_to: '' },
    validationSchema: isEditing ? editContractSchema : createContractSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (isEditing) {
          await submitEdit(values)
        } else {
          await submitCreate(values)
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  useEffect(() => {
    if (isEditing) {
      getContract(id)
        .then((c) => {
          formik.setValues({ client_id: c.client_id, contract_name: c.contract_name, effective_from: c.effective_from, effective_to: c.effective_to })
        })
        .catch(() => {
          toast.error('Failed to load contract.')
          setLoadError(true)
        })
        .finally(() => setLoading(false))
    } else {
      listClients().then(setClients).catch(() => toast.error('Failed to load client list.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Mirrors the backend's surchargeInputSchema (amount must be >= 0) - previously this
  // card had NO validation at all, unlike the rate row's positive-number check, so a
  // negative or blank surcharge amount only ever surfaced as a generic top-level 400
  // from the backend instead of a field-specific message before submitting.
  async function validateSurcharges() {
    for (const s of surcharges) {
      try {
        await updateSurchargeSchema.validate({ amount: s.amount })
      } catch (err) {
        toast.error(`${SURCHARGE_TYPE_LABELS[s.surcharge_type]}: ${err.message}`)
        return false
      }
    }
    return true
  }

  async function submitCreate(values) {
    if (!(await validateSurcharges())) return

    const payload = {
      client_id: Number(values.client_id),
      contract_name: values.contract_name,
      effective_from: values.effective_from,
      effective_to: values.effective_to,
      rates: rates.map((r) => ({ ...r, base_amount: Number(r.base_amount) })),
      surcharges: surcharges.map((s) => ({ ...s, amount: Number(s.amount) })),
    }
    try {
      const created = await createContract(payload)
      // UC-01: the backend flags contracts saved with zero rates (warning !== null) -
      // still a success (the contract is valid), but Sarah needs to know it won't
      // match any jobs yet, not just see a plain "created successfully".
      toast.success(created.warning ? `Contract created. ${created.warning}` : 'Contract created successfully.')
      navigate(`/pricing-contracts/${created.id}`)
    } catch (err) {
      handleSubmitError(err)
    }
  }

  async function submitEdit(values) {
    const payload = { contract_name: values.contract_name, effective_from: values.effective_from, effective_to: values.effective_to }
    try {
      await updateContract(id, payload)
      toast.success('Contract updated successfully.')
      navigate(`/pricing-contracts/${id}`)
    } catch (err) {
      if (err.response?.data?.code === 'HAS_MATCHED_INVOICES') {
        const proceed = window.confirm(`${err.response.data.message}\n\nProceed anyway? This will not change any already-matched invoices.`)
        if (proceed) {
          try {
            await updateContract(id, { ...payload, acknowledge_matched_invoices: true })
            toast.success('Contract updated successfully.')
            navigate(`/pricing-contracts/${id}`)
            return
          } catch (err2) {
            handleSubmitError(err2)
            return
          }
        }
        return
      }
      handleSubmitError(err)
    }
  }

  // Surfaces every field-level Yup error the backend found (not just the generic
  // "One or more fields failed validation." top-level message), and routes known
  // conflict codes to their exact backend wording - same pattern as MemoWizardPage's
  // handleFinalSubmit error handling.
  function handleSubmitError(err) {
    const fieldErrors = err.response?.data?.errors
    const message = fieldErrors?.length
      ? fieldErrors.map((e) => `${e.field ? e.field + ': ' : ''}${e.message}`).join(' ')
      : err.response?.data?.message || 'Failed to save contract. Please try again.'
    toast.error(message)
  }

  // Validates against the real rateSchema (mirrors the backend's rateInputSchema)
  // instead of a hand-rolled `!service_type || !transfer_type || ...` check, so this
  // row can never silently drift from what the backend actually requires.
  async function addRate() {
    try {
      await rateSchema.validate(newRate)
    } catch (err) {
      toast.error(err.message)
      return
    }
    if (rates.some((r) => r.service_type === newRate.service_type && r.transfer_type === newRate.transfer_type && r.time_of_day === newRate.time_of_day)) {
      toast.error('A rate with the same service type, transfer type, and time of day is already in this list.')
      return
    }
    setRates((prev) => [...prev, newRate])
    setNewRate(EMPTY_NEW_RATE)
  }

  function removeRate(idx) {
    setRates((prev) => prev.filter((_, i) => i !== idx))
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading contract…
      </div>
    )
  }

  // Bail out instead of rendering an empty-but-submittable form against a contract id
  // that might not exist (404) or that we simply failed to fetch (dropped connection) -
  // matches ContractDetailPage's "Contract not found." pattern rather than silently
  // showing a blank Contract Details card the user could fill in and PATCH.
  if (loadError) {
    return (
      <div className="p-6 space-y-3">
        <div className="text-sm text-slate-400">Contract not found.</div>
        <Button variant="outline" onClick={() => navigate('/pricing-contracts')}>Back to Pricing Contracts</Button>
      </div>
    )
  }

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} /> Back
        </button>

        <h1 className="text-2xl font-semibold text-foreground">{isEditing ? 'Edit Contract' : 'New Pricing Contract'}</h1>

        <div className="max-w-2xl space-y-4 pb-6">
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
              {!isEditing && <CardDescription><span className="text-[#EF4444]">*</span> Required field</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <RequiredLabel htmlFor="contract_name">Contract Name</RequiredLabel>
                <Input
                  id="contract_name" name="contract_name" placeholder="e.g. TTSH - FY2027 Service Agreement"
                  value={formik.values.contract_name} onChange={formik.handleChange} onBlur={formik.handleBlur}
                />
                <FieldError formik={formik} name="contract_name" />
              </div>

              {!isEditing && (
                <div>
                  <RequiredLabel htmlFor="client_id">Client</RequiredLabel>
                  <Select value={formik.values.client_id ? String(formik.values.client_id) : ''} onValueChange={(v) => formik.setFieldValue('client_id', v)}>
                    <SelectTrigger id="client_id"><SelectValue placeholder="Select a client…" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError formik={formik} name="client_id" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <RequiredLabel htmlFor="effective_from">Effective From</RequiredLabel>
                  <Input id="effective_from" name="effective_from" type="date" value={formik.values.effective_from} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  <FieldError formik={formik} name="effective_from" />
                </div>
                <div>
                  <RequiredLabel htmlFor="effective_to">Effective To</RequiredLabel>
                  <Input id="effective_to" name="effective_to" type="date" value={formik.values.effective_to} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                  <FieldError formik={formik} name="effective_to" />
                  {formik.values.effective_to && formik.values.effective_to < new Date().toISOString().slice(0, 10) && (
                    <div className="flex items-center gap-2 mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                      <span className="text-xs text-amber-700">This contract will be created as Expired.</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Initial Pricing Rates</CardTitle>
                <CardDescription>You can add rates now or later from the contract detail screen.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-3">
                  {/* table-fixed + colgroup: column widths must stay constant regardless of
                      which option is selected. With the default table-layout: auto, the
                      browser recomputes each column's width from whatever text currently
                      sits in it, so picking a longer label (e.g. "Workplace Standby") widens
                      that column and shoves every column after it - including the Add
                      button - sideways. Fixed percentage widths remove that dependency. */}
                  <table className="w-full border-collapse table-fixed">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[30%]" />
                      <col className="w-[18%]" />
                      <col className="w-[19%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        {['Service Type', 'Transfer Type', 'Time of Day', 'Base Amount (SGD)', ''].map((c) => (
                          <th key={c} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rates.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">No rates added yet.</td></tr>
                      ) : rates.map((r, idx) => (
                        <tr key={`${r.service_type}-${r.transfer_type}-${r.time_of_day}`} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 text-sm text-slate-800 whitespace-nowrap">{SERVICE_TYPE_LABELS[r.service_type]}</td>
                          <td className="px-3 py-2 text-sm text-slate-800">{TRANSFER_TYPE_LABELS[r.transfer_type]}</td>
                          <td className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap">{TIME_OF_DAY_LABELS[r.time_of_day]}</td>
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">${Number(r.base_amount).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => removeRate(idx)} className="text-xs font-medium text-[#EF4444] underline underline-offset-2">Remove</button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50/60">
                        <td className="p-2"><MiniSelect value={newRate.service_type} onChange={(v) => setNewRate({ ...newRate, service_type: v })} options={SERVICE_TYPES} labels={SERVICE_TYPE_LABELS} placeholder="Type" /></td>
                        <td className="p-2"><MiniSelect value={newRate.transfer_type} onChange={(v) => setNewRate({ ...newRate, transfer_type: v })} options={TRANSFER_TYPES} labels={TRANSFER_TYPE_LABELS} placeholder="Transfer type" /></td>
                        <td className="p-2"><MiniSelect value={newRate.time_of_day} onChange={(v) => setNewRate({ ...newRate, time_of_day: v })} options={TIME_OF_DAY} labels={TIME_OF_DAY_LABELS} placeholder="Time of day" /></td>
                        <td className="p-2">
                          <NumberStepper
                            value={newRate.base_amount}
                            onChange={(v) => setNewRate({ ...newRate, base_amount: v })}
                            min={0} max={MAX_RATE_AMOUNT} step={1} bigStep={10}
                            placeholder="0.00" ariaLabel="Base amount" className="w-full h-9"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button type="button" onClick={addRate} className="h-9 px-3 rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700">Add</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle>Surcharge Schedule</CardTitle>
                <CardDescription>
                  Pre-filled with the published default amounts - adjust as needed. This is the only time surcharges can be
                  set; after the contract is created, amounts can be edited but new surcharge types cannot be added.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {surcharges.map((s, idx) => (
                  <div key={s.surcharge_type} className={`flex items-center justify-between px-5 py-2.5 ${idx < surcharges.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <span className="text-sm text-slate-600">{SURCHARGE_TYPE_LABELS[s.surcharge_type]}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">$</span>
                      <NumberStepper
                        value={s.amount}
                        onChange={(v) => setSurcharges((prev) => prev.map((x, i) => i === idx ? { ...x, amount: v } : x))}
                        min={0} max={MAX_SURCHARGE_AMOUNT} step={1} bigStep={10}
                        ariaLabel={`${SURCHARGE_TYPE_LABELS[s.surcharge_type]} amount`} className="w-28 h-8"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Sticky save footer */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : isEditing ? 'Save Changes' : 'Save Contract'}
        </Button>
      </div>
    </form>
  )
}
