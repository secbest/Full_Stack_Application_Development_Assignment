import { useFormik } from 'formik'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RequiredLabel } from '@/components/RequiredLabel'
import { Label } from '@/components/ui/label'
import { buildStep1Schema, isManpowerOnlyServiceType } from '@/validation/serviceMemoValidation'

function FieldError({ formik, name }) {
  if (!formik.touched[name] || !formik.errors[name]) return null
  return <p className="text-xs text-[#EF4444] mt-1">{formik.errors[name]}</p>
}

// A datetime-local input holds LOCAL wall-clock time with no zone, so an ISO instant
// has to be converted through the local calendar fields rather than sliced off the
// ISO string (which is UTC and would show the wrong time for a Singapore crew).
function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function milestoneTime(booking, type) {
  return (booking.milestones || []).find((m) => m.milestone_type === type)?.recorded_at || null
}

export default function Step1JobDetails({ booking, initialValues, onNext }) {
  // Client feedback item 1: the crew already tapped these times live on the job card,
  // so pre-fill from the recorded milestones instead of asking them to type times a
  // second time. Still editable - the memo remains the document of record.
  const activatedAt = toDatetimeLocal(milestoneTime(booking, 'activated'))
  const completedAt = toDatetimeLocal(milestoneTime(booking, 'job_completed'))

  // Client feedback item 4: a manpower-only standby job has no patient and no hospital
  // run, so both fields become optional. Driven by the BOOKING's service type.
  const manpowerOnly = isManpowerOnlyServiceType(booking.service_type)

  const formik = useFormik({
    initialValues: {
      job_start_time: initialValues.job_start_time || activatedAt,
      job_end_time: initialValues.job_end_time || completedAt,
      overtime_hours: initialValues.overtime_hours ?? 0,
      evacuation_floors: initialValues.evacuation_floors ?? 0,
      patient_name: initialValues.patient_name || '',
      // For a standby job the booking "destination" is the event site, not a hospital,
      // so it must not be copied into hospital_destination.
      hospital_destination: initialValues.hospital_destination || (manpowerOnly ? '' : booking.destination || ''),
      additional_charges_notes: initialValues.additional_charges_notes || '',
    },
    validationSchema: buildStep1Schema(booking.service_type),
    onSubmit: (values) => onNext(values),
  })

  const prefilledFromMilestones = !!(activatedAt || completedAt)

  // Live duration readout so the 8-hour standard-shift assumption (see step1Schema's
  // overtime-consistency test) is visible before the user hits an error, not just after.
  const { job_start_time, job_end_time } = formik.values
  const rawDuration = job_start_time && job_end_time
    ? (new Date(job_end_time) - new Date(job_start_time)) / 3_600_000
    : null
  const durationHours = rawDuration != null && rawDuration > 0 ? rawDuration : null

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Booking Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[#EFF6FF] rounded-lg p-4 mx-4 md:mx-6 mb-6 mt-0">
          <div><span className="text-muted-foreground">Client</span><p className="font-medium">{booking.client?.name}</p></div>
          <div><span className="text-muted-foreground">Reference</span><p className="font-medium">{booking.reference_number}</p></div>
          <div><span className="text-muted-foreground">Pickup</span><p className="font-medium">{booking.pickup_location}</p></div>
          <div><span className="text-muted-foreground">Destination</span><p className="font-medium">{booking.destination}</p></div>
          <div><span className="text-muted-foreground">Scheduled</span><p className="font-medium">{booking.scheduled_date} at {booking.scheduled_time}</p></div>
          <div><span className="text-muted-foreground">Service</span><p className="font-medium">{booking.service_type} - {booking.service_tier}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
          <p className="text-xs text-muted-foreground"><span className="text-[#EF4444]">*</span> Required field</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefilledFromMilestones && (
            <p className="text-xs text-[#22C55E]">
              Times pre-filled from the milestones you recorded on the job card. Adjust them if needed.
            </p>
          )}

          {/* Two datetime-local inputs cannot share a 343px row - each needs roughly
              200px before its native picker text clips. Stacked below `sm`. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <RequiredLabel htmlFor="job_start_time">Job Start Time</RequiredLabel>
              <Input id="job_start_time" name="job_start_time" type="datetime-local" value={formik.values.job_start_time} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="job_start_time" />
            </div>
            <div>
              <RequiredLabel htmlFor="job_end_time">Job End Time</RequiredLabel>
              <Input id="job_end_time" name="job_end_time" type="datetime-local" value={formik.values.job_end_time} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="job_end_time" />
            </div>
          </div>

          {durationHours != null && (
            <p className={`text-xs -mt-2 ${durationHours > 8.5 ? 'text-[#F59E0B]' : 'text-muted-foreground'}`}>
              Job duration: {durationHours.toFixed(1)}h
              {durationHours > 8.5 && ' - exceeds the standard 8-hour shift. Log overtime hours below or explain in Additional Notes.'}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <RequiredLabel htmlFor="overtime_hours">Overtime Hours</RequiredLabel>
              <Input id="overtime_hours" name="overtime_hours" type="number" step="0.25" min="0" value={formik.values.overtime_hours} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <p className="text-xs text-muted-foreground mt-1">Jobs over 8 hours must log overtime here or explain why in Additional Notes.</p>
              <FieldError formik={formik} name="overtime_hours" />
            </div>
            <div>
              <RequiredLabel htmlFor="evacuation_floors">Evacuation Floors (enter 0 if none)</RequiredLabel>
              <Input id="evacuation_floors" name="evacuation_floors" type="number" step="1" min="0" value={formik.values.evacuation_floors} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="evacuation_floors" />
            </div>
          </div>

          {/* Client feedback item 4: an event/workplace standby job dispatches crew with
              no ambulance and no patient, so these two stop being mandatory. A standby
              job CAN still have a casualty, so the fields remain available. */}
          {manpowerOnly && (
            <p className="text-xs text-[#3B82F6] bg-[#EFF6FF] rounded-lg px-3 py-2">
              Manpower-only standby job - leave the patient fields blank if there was no patient.
            </p>
          )}

          <div>
            {manpowerOnly ? (
              <Label htmlFor="patient_name">Patient Name (optional)</Label>
            ) : (
              <RequiredLabel htmlFor="patient_name">Patient Name</RequiredLabel>
            )}
            <Input id="patient_name" name="patient_name" value={formik.values.patient_name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            <FieldError formik={formik} name="patient_name" />
          </div>

          <div>
            {manpowerOnly ? (
              <Label htmlFor="hospital_destination">Hospital Destination (optional)</Label>
            ) : (
              <RequiredLabel htmlFor="hospital_destination">Hospital Destination</RequiredLabel>
            )}
            <Input id="hospital_destination" name="hospital_destination" value={formik.values.hospital_destination} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            <FieldError formik={formik} name="hospital_destination" />
          </div>

          <div>
            <Label htmlFor="additional_charges_notes">Additional Notes (optional)</Label>
            <Textarea id="additional_charges_notes" name="additional_charges_notes" value={formik.values.additional_charges_notes} onChange={formik.handleChange} onBlur={formik.handleBlur} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" className="w-full h-11 md:w-auto md:h-10">Next: Service &amp; Charges</Button>
      </div>
    </form>
  )
}
