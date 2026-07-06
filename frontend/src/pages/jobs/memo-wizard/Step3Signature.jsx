import { useRef, useState } from 'react'
import { useFormik } from 'formik'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RequiredLabel } from '@/components/RequiredLabel'
import { Textarea } from '@/components/ui/textarea'
import { step3Schema } from '@/validation/serviceMemoValidation'
import { useToast } from '@/context/ToastContext'
import { uploadSignature } from '@/api/fieldOps'

function FieldError({ formik, name }) {
  if (!formik.touched[name] || !formik.errors[name]) return null
  return <p className="text-xs text-[#EF4444] mt-1">{formik.errors[name]}</p>
}

export default function Step3Signature({ initialValues, onNext, onBack }) {
  const canvasRef = useRef(null)
  const isDrawingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const toast = useToast()

  const formik = useFormik({
    initialValues: {
      signer_name: initialValues.signer_name || '',
      is_waived: initialValues.is_waived ?? false,
      waiver_reason: initialValues.waiver_reason || '',
      signature_image_url: initialValues.signature_image_url || null,
    },
    validationSchema: step3Schema,
    onSubmit: async (values) => {
      if (values.is_waived) {
        onNext(values)
        return
      }
      setUploading(true)
      try {
        const canvas = canvasRef.current
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        const file = new File([blob], 'signature.png', { type: 'image/png' })
        const { data } = await uploadSignature(file)
        onNext({ ...values, signature_image_url: data.data.signature_image_url })
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to upload signature to storage. Please retry.')
      } finally {
        setUploading(false)
      }
    },
  })

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e) {
    if (formik.values.is_waived) return
    isDrawingRef.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e) {
    if (!isDrawingRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getCanvasPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1E293B'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    if (formik.values.signature_image_url !== 'drawn-pending-upload') {
      formik.setFieldValue('signature_image_url', 'drawn-pending-upload')
    }
  }

  function handlePointerUp() {
    isDrawingRef.current = false
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    formik.setFieldValue('signature_image_url', null)
  }

  function toggleWaived(checked) {
    formik.setFieldValue('is_waived', checked)
    if (checked) clearCanvas()
  }

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Handover Signature</CardTitle>
            <p className="text-xs text-muted-foreground">A drawn signature or a documented waiver is required.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={200}
              className="w-full border border-input rounded-lg bg-white touch-none"
              style={{ opacity: formik.values.is_waived ? 0.4 : 1, pointerEvents: formik.values.is_waived ? 'none' : 'auto' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={formik.values.is_waived}>
              Clear
            </Button>
            <FieldError formik={formik} name="signature_image_url" />

            <div>
              <RequiredLabel htmlFor="signer_name">Signer Name</RequiredLabel>
              <Input id="signer_name" name="signer_name" value={formik.values.signer_name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="signer_name" />
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={formik.values.is_waived}
                onChange={(e) => toggleWaived(e.target.checked)}
              />
              <span className="text-sm">Signature Unavailable (e.g. patient unconscious)</span>
            </label>

            {formik.values.is_waived && (
              <div>
                <RequiredLabel htmlFor="waiver_reason">Waiver Reason</RequiredLabel>
                <Textarea id="waiver_reason" name="waiver_reason" value={formik.values.waiver_reason} onChange={formik.handleChange} onBlur={formik.handleBlur} />
                <FieldError formik={formik} name="waiver_reason" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent>
            {formik.values.is_waived ? (
              <p className="text-sm text-[#F59E0B]">Signature waived - reason will be recorded on the memo.</p>
            ) : formik.values.signature_image_url ? (
              <p className="text-sm text-[#22C55E]">Ready to submit - signature captured.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Signature required before continuing.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={uploading}>Back</Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading signature...</> : 'Next: Stamp & Submit'}
        </Button>
      </div>
    </form>
  )
}
