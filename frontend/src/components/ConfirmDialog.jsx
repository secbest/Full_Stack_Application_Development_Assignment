import { AlertTriangle } from 'lucide-react'

// Shared destructive-action confirmation modal - replaces window.confirm() so delete
// flows (Intake Queue, Bookings) match the app's own dialog styling instead of a
// browser-native prompt. Renders nothing when `open` is false.
export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 px-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-6 pb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
            <AlertTriangle size={18} style={{ color: '#EF4444' }} />
          </div>
          <div className="pt-1">
            <div id="confirm-dialog-title" className="text-base font-semibold text-slate-900">{title}</div>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-md px-4 text-sm font-semibold text-white"
            style={{ background: '#EF4444' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#DC2626' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#EF4444' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
