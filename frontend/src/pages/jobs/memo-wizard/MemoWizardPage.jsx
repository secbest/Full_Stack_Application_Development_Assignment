import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FilePlus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/context/ToastContext'
import { getBooking, createServiceMemo } from '@/api/fieldOps'
import WizardProgressBar from './WizardProgressBar'
import Step1JobDetails from './Step1JobDetails'
import Step2ServiceCharges from './Step2ServiceCharges'
import Step3Signature from './Step3Signature'
import Step4StampSubmit from './Step4StampSubmit'
import MemoSubmittedView from './MemoSubmittedView'

export default function MemoWizardPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const [bookingStatus, setBookingStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [booking, setBooking] = useState(null)
  const [step, setStep] = useState(1)
  const [wizardData, setWizardData] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submittedMemo, setSubmittedMemo] = useState(null)

  useEffect(() => {
    getBooking(bookingId)
      .then(({ data }) => { setBooking(data.data); setBookingStatus('ready') })
      .catch((err) => {
        setBookingStatus('error')
        toast.error(err.response?.data?.message || 'Failed to load this booking.')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  function mergeAndAdvance(values) {
    setWizardData((prev) => ({ ...prev, ...values }))
    setStep((s) => s + 1)
  }

  function handleBackToJobs() {
    if (step > 1 && !window.confirm('Discard this memo and return to My Jobs?')) return
    navigate('/jobs')
  }

  async function handleFinalSubmit(hospitalStampUrl) {
    const d = wizardData
    const payload = {
      booking_id: Number(bookingId),
      job_start_time: d.job_start_time,
      job_end_time: d.job_end_time,
      overtime_hours: Number(d.overtime_hours),
      evacuation_floors: Number(d.evacuation_floors),
      patient_name: d.patient_name,
      hospital_destination: d.hospital_destination,
      additional_charges_notes: d.additional_charges_notes || null,
      hospital_stamp_image_url: hospitalStampUrl,
      service_type: d.service_type,
      transfer_type: d.transfer_type,
      is_office_hours: d.is_office_hours,
      oxygen_litres_used: Number(d.oxygen_litres_used) || 0,
      has_inconvenience_fee: d.has_inconvenience_fee,
      disposables_used: d.disposables_used,
      resuscitation_performed: d.resuscitation_performed,
      suction_performed: d.suction_performed,
      waiting_time_minutes: Number(d.waiting_time_minutes) || 0,
      patient_weight_kg: d.patient_weight_kg === '' || d.patient_weight_kg == null ? null : Number(d.patient_weight_kg),
      is_jurong_island: d.is_jurong_island,
      signature: {
        signer_name: d.signer_name,
        signature_image_url: d.is_waived ? null : d.signature_image_url,
        signed_at: new Date().toISOString(),
        is_waived: d.is_waived,
        waiver_reason: d.is_waived ? d.waiver_reason : null,
      },
    }

    setSubmitting(true)
    try {
      const { data } = await createServiceMemo(payload)
      toast.success('Memo submitted successfully.')
      setSubmittedMemo(data.data)
    } catch (err) {
      const code = err.response?.data?.code
      const fieldErrors = err.response?.data?.errors
      // VALIDATION_ERROR's top-level message is generic ("One or more fields failed
      // validation.") - the useful detail is in the errors array. Surface each field's
      // actual message instead of just the generic sentence, or the crew member has no
      // way to know what to go back and fix.
      const message = fieldErrors?.length
        ? fieldErrors.map((e) => `${e.field ? e.field + ': ' : ''}${e.message}`).join(' ')
        : err.response?.data?.message || 'Failed to submit service memo. Please try again.'
      toast.error(message)
      // Duplicate submission or an already-invoiced booking can't be retried from this
      // screen - send the crew member back to My Jobs instead of leaving them stuck here.
      if (code === 'MEMO_ALREADY_EXISTS' || code === 'BOOKING_ALREADY_INVOICED') {
        navigate('/jobs')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedMemo) {
    return (
      <div className="p-4 md:p-6">
        <MemoSubmittedView memo={submittedMemo} />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Title and escape hatch share a row from `md` up. On a phone the title keeps the
          full width and the back button sits under it - side by side, the button would
          push "New Service Memo" into a two-line wrap. */}
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <FilePlus className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">New Service Memo</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleBackToJobs} className="w-full h-11 md:w-auto md:h-9">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Jobs
        </Button>
      </div>

      {bookingStatus === 'loading' && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading booking...
        </div>
      )}

      {bookingStatus === 'error' && (
        <Card>
          <CardContent className="p-4 md:p-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <p className="text-sm text-muted-foreground">Couldn't load this booking.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/jobs')} className="w-full h-11 md:w-auto md:h-9">Back to My Jobs</Button>
          </CardContent>
        </Card>
      )}

      {bookingStatus === 'ready' && (
        <>
          <WizardProgressBar currentStep={step} />

          {step === 1 && (
            <Step1JobDetails booking={booking} initialValues={wizardData} onNext={mergeAndAdvance} />
          )}
          {step === 2 && (
            <Step2ServiceCharges initialValues={wizardData} onNext={mergeAndAdvance} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3Signature initialValues={wizardData} onNext={mergeAndAdvance} onBack={() => setStep(2)} />
          )}
          {step === 4 && (
            <Step4StampSubmit
              initialValues={wizardData}
              summary={wizardData}
              onBack={() => setStep(3)}
              onSubmit={handleFinalSubmit}
              submitting={submitting}
            />
          )}
        </>
      )}
    </div>
  )
}
