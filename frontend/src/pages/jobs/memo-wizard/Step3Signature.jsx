import { useCallback, useEffect, useRef, useState } from 'react'
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
import { resizeCanvasToDisplaySize, toCanvasPos } from '@/lib/canvas'

const STROKE_COLOR = '#1E293B'
const STROKE_WIDTH = 2

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

  // Match the bitmap to the element's rendered box at native device resolution. The pad
  // used to declare a fixed 400x200 bitmap and stretch it with `w-full`, so pointer
  // offsets were fed into a bitmap of a different size and the ink landed away from the
  // finger - about a 29% horizontal error in the ~311px column a 375px phone gives it.
  // Sizing to devicePixelRatio also stops signatures being upscaled from 400x200.
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    if (!resizeCanvasToDisplaySize(canvas, dpr)) return

    // Assigning width/height clears the canvas and resets context state, so anything
    // already drawn is gone. Warn only if there was actually ink to lose.
    if (formik.values.signature_image_url === 'drawn-pending-upload') {
      formik.setFieldValue('signature_image_url', null)
      toast.error('Signature pad was resized - please sign again.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.signature_image_url])

  // Size once on mount, then track rotation and window resizes.
  useEffect(() => {
    syncCanvasSize()
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(syncCanvasSize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [syncCanvasSize])

  function handlePointerDown(e) {
    if (formik.values.is_waived) return
    isDrawingRef.current = true
    // Keep receiving move events if the finger slides off the pad mid-stroke.
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = toCanvasPos(canvasRef.current, e.clientX, e.clientY)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e) {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const { x, y } = toCanvasPos(canvas, e.clientX, e.clientY)
    ctx.lineTo(x, y)
    ctx.strokeStyle = STROKE_COLOR
    // Scale the stroke with the bitmap, or a 2px line drawn into a 2x bitmap renders
    // hairline-thin on a retina phone.
    ctx.lineWidth = STROKE_WIDTH * (window.devicePixelRatio || 1)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
      {/* `lg`, not `md`: at 768px the 240px sidebar leaves ~464px, so a 2-up split gave
          the signature pad only 182px - too cramped to sign, with the Status card mostly
          empty beside it. Verified in a real browser at 768px. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Handover Signature</CardTitle>
            <p className="text-xs text-muted-foreground">A drawn signature or a documented waiver is required.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* No width/height attributes: syncCanvasSize sets the bitmap from the real
                rendered box, so the two sizes can never disagree. The CSS height is what
                drives it - taller on desktop, compact enough to keep the signer name and
                waiver toggle in view on a phone. `touch-none` stops the page scrolling
                under the finger while signing. */}
            <canvas
              ref={canvasRef}
              className="w-full h-40 sm:h-[200px] border border-input rounded-lg bg-white touch-none"
              style={{ opacity: formik.values.is_waived ? 0.4 : 1, pointerEvents: formik.values.is_waived ? 'none' : 'auto' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground md:hidden">Sign with your finger in the box above.</p>
              <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={formik.values.is_waived} className="h-10 md:h-9 flex-shrink-0">
                Clear
              </Button>
            </div>
            <FieldError formik={formik} name="signature_image_url" />

            <div>
              <RequiredLabel htmlFor="signer_name">Signer Name</RequiredLabel>
              <Input id="signer_name" name="signer_name" value={formik.values.signer_name} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              <FieldError formik={formik} name="signer_name" />
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-[#F59E0B] bg-[#F59E0B]/10 px-3 py-3 md:py-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 md:h-4 md:w-4 mt-0.5 flex-shrink-0 rounded border-input"
                checked={formik.values.is_waived}
                onChange={(e) => toggleWaived(e.target.checked)}
              />
              <span className="text-sm">Patient / client representative unable to sign (e.g. unconscious, no representative present)</span>
            </label>

            {formik.values.is_waived && (
              <div>
                <RequiredLabel htmlFor="waiver_reason">Waiver Reason</RequiredLabel>
                <Textarea id="waiver_reason" name="waiver_reason" placeholder="e.g. Patient unconscious - ICU transfer" value={formik.values.waiver_reason} onChange={formik.handleChange} onBlur={formik.handleBlur} />
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

      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={uploading} className="w-full h-11 md:w-auto md:h-10">Back</Button>
        <Button type="submit" disabled={uploading} className="w-full h-11 md:w-auto md:h-10">
          {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading signature...</> : 'Next: Stamp & Submit'}
        </Button>
      </div>
    </form>
  )
}
