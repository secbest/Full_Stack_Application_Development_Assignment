import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const ToastContext = createContext(null)

// Per CLAUDE.md: all confirmations use in-app toasts (bottom-right, auto-dismiss,
// green success / red error) - there is no email service anywhere in this stack.
const AUTO_DISMISS_MS = 8000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((type, message) => {
    const id = ++nextId.current
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const toast = {
    success: (message) => notify('success', message),
    warning: (message) => notify('warning', message),
    error: (message) => notify('error', message),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`flex items-start gap-2 rounded-lg border-l-4 bg-[#1E293B] px-4 py-3 text-sm text-white shadow-lg ${
              t.type === 'success'
                ? 'border-[#22C55E]'
                : t.type === 'warning'
                  ? 'border-amber-400'
                  : 'border-[#EF4444]'
            }`}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#22C55E]" />
              : t.type === 'warning'
                ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#EF4444]" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
