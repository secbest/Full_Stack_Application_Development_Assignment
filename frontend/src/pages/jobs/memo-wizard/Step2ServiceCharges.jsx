import { useFormik } from 'formik'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredLabel } from '@/components/RequiredLabel'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldError } from '@/components/FieldError'
import { step2Schema, SERVICE_TYPES, TRANSFER_TYPES } from '@/validation/serviceMemoValidation'

const SERVICE_TYPE_LABELS = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Services (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}
const TRANSFER_TYPE_LABELS = {
  one_way_hospital: 'One-Way Hospital', two_way_hospital: 'Two-Way Hospital', covid_19: 'COVID-19',
  imh_psychiatric: 'IMH Psychiatric', airport_no_tarmac: 'Airport (No Tarmac)', airport_with_tarmac: 'Airport (With Tarmac)',
  sg_jb_ground: 'SG-JB Ground', air_evacuation: 'Air Evacuation', standby: 'Manpower Standby (No Transfer)',
}

// The whole row is the label, so tapping anywhere toggles - important with gloves on.
// Taller rows and a larger box below `md` bring the target to ~48px; from `md` up the
// original denser desktop sizing is restored.
function ToggleRow({ label, checked, onChange, feeNote }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-3 md:py-2.5 cursor-pointer">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        {checked && feeNote && (
          <span className="text-xs rounded-full bg-[#F59E0B]/15 text-[#F59E0B] px-2 py-0.5 whitespace-nowrap">{feeNote}</span>
        )}
        <input type="checkbox" className="h-5 w-5 md:h-4 md:w-4 rounded border-input" checked={checked} onChange={onChange} />
      </div>
    </label>
  )
}

export default function Step2ServiceCharges({ booking, initialValues, onNext, onBack }) {
  const formik = useFormik({
    initialValues: {
      // The booking already states the service type - defaulting from it saves a tap and
      // avoids a memo whose service type contradicts its own booking, which would send
      // the pricing engine looking for the wrong rate row. Still changeable on the spot.
      service_type: initialValues.service_type || booking?.service_type || '',
      // Quotations already picked this during the intake review (see
      // IntakeQueuePage's "Transfer Type" field) - defaulting from it saves a tap and
      // keeps the memo consistent with what was quoted. Still changeable on the spot.
      transfer_type: initialValues.transfer_type || booking?.quoted_transfer_type || '',
      // Default from the time category Quotations quoted, for the same reason as the two
      // fields above. Hardcoding `true` here meant a job sold as non-office-hours arrived
      // at AR claiming office hours, which fails quotationMatchesMemo and drops the whole
      // invoice into manual pricing over a toggle nobody had touched. The crew still
      // records reality - this only changes which way the toggle starts.
      is_office_hours: initialValues.is_office_hours
        ?? (booking?.quoted_time_of_day === 'non_office_hours' ? false : true),
      oxygen_litres_used: initialValues.oxygen_litres_used ?? 0,
      has_inconvenience_fee: initialValues.has_inconvenience_fee ?? false,
      disposables_used: initialValues.disposables_used ?? false,
      resuscitation_performed: initialValues.resuscitation_performed ?? false,
      suction_performed: initialValues.suction_performed ?? false,
      waiting_time_minutes: initialValues.waiting_time_minutes ?? 0,
      patient_weight_kg: initialValues.patient_weight_kg ?? '',
      is_jurong_island: initialValues.is_jurong_island ?? false,
    },
    validationSchema: step2Schema,
    onSubmit: (values) => onNext({ ...values, patient_weight_kg: values.patient_weight_kg === '' ? null : values.patient_weight_kg }),
  })

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
          <p className="text-xs text-muted-foreground"><span className="text-[#EF4444]">*</span> Required field</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <RequiredLabel>Service Type</RequiredLabel>
              <Select value={formik.values.service_type} onValueChange={(v) => formik.setFieldValue('service_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select service type" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{SERVICE_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError formik={formik} name="service_type" />
            </div>
            <div>
              <RequiredLabel>Transfer Type</RequiredLabel>
              <Select value={formik.values.transfer_type} onValueChange={(v) => formik.setFieldValue('transfer_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select transfer type" /></SelectTrigger>
                <SelectContent>
                  {TRANSFER_TYPES.map((t) => <SelectItem key={t} value={t}>{TRANSFER_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError formik={formik} name="transfer_type" />
            </div>
          </div>

          <ToggleRow
            label="This job occurred during office hours"
            checked={formik.values.is_office_hours}
            onChange={(e) => formik.setFieldValue('is_office_hours', e.target.checked)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Surcharges &amp; Special Conditions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="oxygen_litres_used">Oxygen Litres Used</Label>
            <Input id="oxygen_litres_used" name="oxygen_litres_used" type="number" step="0.5" min="0" value={formik.values.oxygen_litres_used} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            <FieldError formik={formik} name="oxygen_litres_used" />
          </div>

          {/* Surcharge labels are full questions ("Were stairs or elevator access
              required?"), so a 2-up grid on a phone would wrap each to three lines and
              make the column of toggles unscannable. One per row below `sm`. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow label="Were stairs or elevator access required?" feeNote="+$50" checked={formik.values.has_inconvenience_fee} onChange={(e) => formik.setFieldValue('has_inconvenience_fee', e.target.checked)} />
            <ToggleRow label="Disposables used" feeNote="+$20" checked={formik.values.disposables_used} onChange={(e) => formik.setFieldValue('disposables_used', e.target.checked)} />
            <ToggleRow label="Resuscitation performed" feeNote="+$320" checked={formik.values.resuscitation_performed} onChange={(e) => formik.setFieldValue('resuscitation_performed', e.target.checked)} />
            <ToggleRow label="Suction performed" feeNote="+$50" checked={formik.values.suction_performed} onChange={(e) => formik.setFieldValue('suction_performed', e.target.checked)} />
            <ToggleRow label="Jurong Island destination" feeNote="+$150-200" checked={formik.values.is_jurong_island} onChange={(e) => formik.setFieldValue('is_jurong_island', e.target.checked)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="waiting_time_minutes">Waiting Time (minutes)</Label>
              <Input id="waiting_time_minutes" name="waiting_time_minutes" type="number" step="1" min="0" value={formik.values.waiting_time_minutes} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="waiting_time_minutes" />
            </div>
            <div>
              <Label htmlFor="patient_weight_kg">Patient Weight (kg, optional)</Label>
              <Input id="patient_weight_kg" name="patient_weight_kg" type="number" step="0.1" min="0" value={formik.values.patient_weight_kg} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="patient_weight_kg" />
              {Number(formik.values.patient_weight_kg) >= 90 && (
                <p className="text-xs text-[#F59E0B] mt-1">Heavy lifting surcharge applies (&ge;90kg)</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* flex-col-reverse puts the primary action above Back on a phone - thumb-nearest
          and first in reading order - while DOM order stays Back-then-Next so the
          keyboard tab sequence is unchanged from desktop. */}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between">
        <Button type="button" variant="outline" onClick={onBack} className="w-full h-11 md:w-auto md:h-10">Back</Button>
        <Button type="submit" className="w-full h-11 md:w-auto md:h-10">Next: Signature</Button>
      </div>
    </form>
  )
}
