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
      <div className="grid grid-cols-2 gap-4">
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
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-input rounded-lg p-8 cursor-pointer text-sm text-muted-foreground">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Click to upload a photo of the stamped document'}
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">Not all hospitals require a physical stamp - this field can be left empty.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Review Before Submitting</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Patient</span><span className="text-right">{summary.patient_name}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Destination</span><span className="text-right">{summary.hospital_destination}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Service</span><span className="text-right">{summary.service_type} / {summary.transfer_type}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Overtime</span><span className="text-right">{summary.overtime_hours}h</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Evacuation Floors</span><span className="text-right">{summary.evacuation_floors}</span></div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Signature</span>
              <span className="text-right">{summary.is_waived ? 'Waived' : 'Captured'}</span>
            </div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground shrink-0">Hospital Stamp</span><span className="text-right">{stampUrl ? 'Attached' : 'Not attached'}</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>Back</Button>
        <Button type="button" onClick={() => onSubmit(stampUrl)} disabled={submitting || uploading}>
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting memo...</> : 'Submit Memo'}
        </Button>
      </div>
    </div>
  )
}
