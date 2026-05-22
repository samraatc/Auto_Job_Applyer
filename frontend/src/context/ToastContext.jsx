import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error:   <XCircle    className="w-4 h-4 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info:    <Info       className="w-4 h-4 text-blue-400" />,
}

const BG = {
  success: 'border-emerald-500/30 bg-emerald-950/80',
  error:   'border-red-500/30 bg-red-950/80',
  warning: 'border-amber-500/30 bg-amber-950/80',
  info:    'border-blue-500/30 bg-blue-950/80',
}

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 350)
  }, [])

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, leaving: false }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Convenience helpers
  toast.success = (msg, dur) => toast(msg, 'success', dur)
  toast.error   = (msg, dur) => toast(msg, 'error', dur)
  toast.warning = (msg, dur) => toast(msg, 'warning', dur)
  toast.info    = (msg, dur) => toast(msg, 'info', dur)

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Portal — fixed bottom-right stack */}
      <div
        aria-live="polite"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        style={{ maxWidth: 360 }}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl
              text-sm text-white pointer-events-auto
              transition-all duration-350
              ${BG[t.type]}
              ${t.leaving
                ? 'opacity-0 translate-y-2 scale-95'
                : 'opacity-100 translate-y-0 scale-100'}
            `}
          >
            <span className="mt-0.5 shrink-0">{ICONS[t.type]}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 shrink-0 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
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
