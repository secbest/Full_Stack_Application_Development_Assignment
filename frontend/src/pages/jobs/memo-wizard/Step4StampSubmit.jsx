import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/context/ToastContext'
import { uploadHospitalStamp } from '@/api/fieldOps'

export default function Step4StampSubmit({ initialValues, summary, onBack, onSubmit, submitting }) {
  const [stampUrl, setStampUrl] = useState(initialValues.hospital_stamp_image_url || null)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data } = await uploadHospitalStamp(file)
      setStampUrl(data.data.hospital_stamp_image_url)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload hospital stamp to storage. Please retry.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload and summary stack below `lg`: the summary is the last thing read before
          submitting, so it belongs below the upload rather than beside it. `lg` rather
          than `md` for the same reason as Step 3 - at 768px two columns leave each about
          200px, which squeezes the summary's values into a ragged wrap. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Hospital Stamp (optional)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stampUrl ? (
              <div className="relative inline-block">
                <img src={stampUrl} alt="Hospital stamp" className="w-full max-h-48 object-contain rounded-lg border border-input" />
                <button
                  type="button"
                  onClick={() => setStampUrl(null)}
                  className="absolute -top-2 -right-2 bg-[#EF4444] text-white rounded-full p-1"
                  aria-label="Remove stamp"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-input rounded-lg p-6 md:p-8 min-h-[112px] cursor-pointer text-sm text-muted-foreground text-center">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {/* "Click" is wrong on a touch device; the wording swaps at `md`. */}
                    <span className="md:hidden">Tap to photograph or upload the stamped document</span>
                    <span className="hidden md:inline">Click to upload a photo of the stamped document</span>
                  </>
                )}
                {/* accept without `capture` deliberately: mobile browsers then offer both
                    "Take Photo" and the gallery, so a stamp photographed earlier in the
                    shift can still be attached. Forcing capture would block that. */}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">Not all hospitals require a physical stamp - this field can be left empty.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review Before Submitting</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* A manpower-only standby memo (client feedback item 4) has no patient and
                no hospital destination - show a dash rather than an empty gap. */}
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Patient</span><span className="text-right min-w-0 break-words">{summary.patient_name || '-'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Destination</span><span className="text-right min-w-0 break-words">{summary.hospital_destination || '-'}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Service</span><span className="text-right min-w-0 break-words">{summary.service_type} / {summary.transfer_type}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Overtime</span><span className="text-right min-w-0 break-words">{summary.overtime_hours}h</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Evacuation Floors</span><span className="text-right min-w-0 break-words">{summary.evacuation_floors}</span></div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Signature</span>
              <span className="text-right min-w-0 break-words">{summary.is_waived ? 'Waived' : 'Captured'}</span>
            </div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Hospital Stamp</span><span className="text-right min-w-0 break-words">{stampUrl ? 'Attached' : 'Not attached'}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting} className="w-full h-11 md:w-auto md:h-10">Back</Button>
        <Button type="button" onClick={() => onSubmit(stampUrl)} disabled={submitting || uploading} className="w-full h-11 md:w-auto md:h-10">
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting memo...</> : 'Submit Memo'}
        </Button>
      </div>
    </div>
  )
}
