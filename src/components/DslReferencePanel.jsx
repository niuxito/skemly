import { useEffect, useRef } from 'react'
import { X, BookMarked } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'

export default function DslReferencePanel({ open, onClose }) {
  const t = useT()
  const sections = t('dsl_sections')
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    setTimeout(() => window.addEventListener('mousedown', handler), 50)
    return () => window.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-slate-900/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden bg-white border border-slate-200"
        style={{ maxHeight: 'calc(100vh - 6rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookMarked size={15} className="text-slate-500" />
            <span className="font-bold text-sm text-slate-800">{t('dsl_ref_title')}</span>
            <span className="text-xs text-slate-500">— Skemly v1.1</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-400">
            <X size={15} />
          </button>
        </div>

        {/* Grid of sections */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
          <div className="grid grid-cols-2 gap-3">
            {sections.map(section => (
              <div key={section.title} className="rounded-lg p-3 bg-slate-50">
                <div className="text-xs font-bold uppercase tracking-wide mb-2 text-slate-700">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.rows.map((row, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <code className="text-xs rounded px-1.5 py-0.5 font-mono shrink-0 bg-slate-100 text-slate-800">
                        {row.syntax}
                      </code>
                      <span className="text-xs leading-tight text-slate-500">{row.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-2.5 border-t border-slate-100 text-slate-500 text-xs">
          {t('dsl_ref_close_hint')}
        </div>
      </div>
    </div>
  )
}
