// Public, unauthenticated intake portal (UC-01). Not part of the Figma Make prototype
// (see design/figma-make-prompts.md's "Public Intake Form Note") - the prototype only
// covers the internal queue review (IntakeQueuePage) that happens after a submission
// already exists. This is the missing front door: an external customer/hospital fills
// this in and it POSTs to the already-implemented public POST /api/intake endpoint.
import { useState } from 'react'
import { useFormik } from 'formik'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RequiredLabel } from '@/components/RequiredLabel'
import { FieldError } from '@/components/FieldError'
import { submitIntake } from '@/api/intake'
import { intakeCreateSchema, SERVICE_TYPES, SERVICE_TYPE_LABELS, SERVICE_TIERS, SERVICE_TIER_LABELS } from '@/validation/intakeValidation'

const INITIAL_VALUES = {
  customer_name: '',
  organisation: '',
  contact_email: '',
  contact_phone: '',
  service_type: '',
  service_tier: '',
  preferred_date: '',
  preferred_time: '',
  pickup_location: '',
  destination: '',
  additional_notes: '',
}

export default function PublicIntakeFormPage() {
  const [result, setResult] = useState(null) // { reference_number, message } once submitted
  const [submitError, setSubmitError] = useState('')

  const formik = useFormik({
    initialValues: INITIAL_VALUES,
    validationSchema: intakeCreateSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setSubmitError('')
      try {
        const payload = { ...values, organisation: values.organisation || undefined, additional_notes: values.additional_notes || undefined }
        const data = await submitIntake(payload)
        setResult(data)
      } catch (err) {
        const code = err.response?.data?.code
        const message = err.response?.data?.message
        if (code === 'DUPLICATE_SUBMISSION') {
          setSubmitError(`${message || 'A similar request was already submitted a few minutes ago.'}${err.response?.data?.reference_number ? ` Reference: ${err.response.data.reference_number}` : ''}`)
        } else {
          setSubmitError(message || 'We could not submit your request. Please check the form and try again.')
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  if (result) {
    return (
      <PageShell>
        <Card className="max-w-lg w-full">
          <CardContent className="flex flex-col items-center text-center gap-4 py-10">
            <CheckCircle2 size={48} style={{ color: '#22C55E' }} />
            <div>
              <h1 className="text-xl font-semibold" style={{ color: '#1E293B' }}>Request Received</h1>
              <p className="text-sm mt-2" style={{ color: '#64748B' }}>{result.message}</p>
            </div>
            <div className="rounded-lg px-4 py-2 border" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
              <span className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Reference Number</span>
              <p className="text-lg font-semibold" style={{ color: '#1E293B' }}>{result.reference_number}</p>
            </div>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Please keep this reference number for any follow-up enquiries.</p>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <CardTitle>Request Ambulance Service</CardTitle>
          <CardDescription><span className="text-[#EF4444]">*</span> Required field</CardDescription>
        </CardHeader>
        <form onSubmit={formik.handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <RequiredLabel htmlFor="customer_name">Full Name</RequiredLabel>
                <Input id="customer_name" name="customer_name" placeholder="John Tan" value={formik.values.customer_name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="customer_name" />
              </div>
              <div>
                <RequiredLabel htmlFor="organisation">Organisation</RequiredLabel>
                <Input id="organisation" name="organisation" placeholder="Changi General Hospital" value={formik.values.organisation} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="organisation" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <RequiredLabel htmlFor="contact_email">Contact Email</RequiredLabel>
                <Input id="contact_email" name="contact_email" type="email" placeholder="john.tan@cgh.com.sg" value={formik.values.contact_email} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="contact_email" />
              </div>
              <div>
                <RequiredLabel htmlFor="contact_phone">Contact Phone</RequiredLabel>
                <Input id="contact_phone" name="contact_phone" placeholder="91234567" value={formik.values.contact_phone} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="contact_phone" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <RequiredLabel htmlFor="service_type">Service Type</RequiredLabel>
                <Select value={formik.values.service_type} onValueChange={(v) => formik.setFieldValue('service_type', v)}>
                  <SelectTrigger id="service_type"><SelectValue placeholder="Select a service type…" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError formik={formik} name="service_type" />
              </div>
              <div>
                <RequiredLabel htmlFor="service_tier">Service Tier</RequiredLabel>
                <Select value={formik.values.service_tier} onValueChange={(v) => formik.setFieldValue('service_tier', v)}>
                  <SelectTrigger id="service_tier"><SelectValue placeholder="Select a service tier…" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TIERS.map((t) => <SelectItem key={t} value={t}>{SERVICE_TIER_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError formik={formik} name="service_tier" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <RequiredLabel htmlFor="preferred_date">Preferred Date</RequiredLabel>
                <Input id="preferred_date" name="preferred_date" type="date" value={formik.values.preferred_date} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="preferred_date" />
              </div>
              <div>
                <RequiredLabel htmlFor="preferred_time">Preferred Time</RequiredLabel>
                <Input id="preferred_time" name="preferred_time" type="time" value={formik.values.preferred_time} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="preferred_time" />
              </div>
            </div>

            <div>
              <RequiredLabel htmlFor="pickup_location">Pickup Location</RequiredLabel>
              <Input id="pickup_location" name="pickup_location" placeholder="Changi General Hospital, 2 Simei Street 3, Singapore 529889" value={formik.values.pickup_location} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="pickup_location" />
            </div>

            <div>
              <RequiredLabel htmlFor="destination">Destination</RequiredLabel>
              <Input id="destination" name="destination" placeholder="Singapore General Hospital, Outram Road, Singapore 169608" value={formik.values.destination} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="destination" />
            </div>

            <div>
              <label htmlFor="additional_notes" className="text-sm font-medium" style={{ color: '#1E293B' }}>Additional Notes</label>
              <Textarea id="additional_notes" name="additional_notes" placeholder="e.g. Patient requires oxygen support during transfer." value={formik.values.additional_notes} onChange={formik.handleChange} onBlur={formik.handleBlur} className="mt-1.5" />
              <FieldError formik={formik} name="additional_notes" />
            </div>

            {submitError && (
              <div className="rounded-lg px-3.5 py-2.5 text-sm border" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#EF4444' }}>
                {submitError}
              </div>
            )}
          </CardContent>

          <div className="px-6 pb-6">
            <Button type="submit" disabled={formik.isSubmitting} className="w-full">
              {formik.isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                : 'Submit Request'}
            </Button>
          </div>
        </form>
      </Card>
    </PageShell>
  )
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ backgroundColor: '#F8FAFC', fontFamily: "'Inter', sans-serif" }}>
      <div className="flex flex-col items-center gap-2 mb-8 select-none">
        <div
          style={{ width: 56, height: 56, border: '2px solid #1E293B', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none" aria-label="Medical cross">
            <rect x="15" y="4" width="10" height="32" rx="2" stroke="#1E293B" strokeWidth="2" />
            <rect x="4" y="15" width="32" height="10" rx="2" stroke="#1E293B" strokeWidth="2" />
          </svg>
        </div>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#1E293B', letterSpacing: '-0.02em' }}>EFAR</span>
        <span style={{ fontSize: 14, color: '#64748B' }}>Emergencies First Aid &amp; Rescue - Service Request</span>
      </div>
      {children}
    </div>
  )
}
