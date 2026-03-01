import { useEffect, useRef, useState } from 'react'
import { X, BookOpen, Link } from 'lucide-react'
import { EXAMPLES, TYPE_COLORS, THEME_COLORS } from '../lib/examples.js'
import { useT } from '../lib/i18n.jsx'

const THEME_ICON = { clean: '☀️', handdrawn: '✏️', cyberpunk: '⚡' }

export default function ExamplesPanel({ open, onClose, onLoad }) {
  const t = useT()
  const panelRef = useRef(null)
  const [copiedSlug, setCopiedSlug] = useState(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Close on outside click
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden bg-white border border-slate-200"
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-slate-500" />
            <span className="font-bold text-base text-slate-800">{t('examples_title')}</span>
            <span className="text-xs text-slate-500">— {t('examples_count', EXAMPLES.length)}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
          <div className="grid grid-cols-2 gap-3">
            {EXAMPLES.map((ex) => (
              <div
                key={ex.id}
                className="group relative rounded-lg border p-4 transition-all shadow-sm hover:shadow-md cursor-pointer bg-slate-50 hover:bg-white border-slate-200"
                onClick={() => { onLoad(ex.dsl); onClose() }}
              >
                {/* Copy link button */}
                <button
                  onClick={e => {
                    e.stopPropagation()
                    const url = `${window.location.origin}/examples/${ex.slug}`
                    navigator.clipboard.writeText(url).then(() => {
                      setCopiedSlug(ex.slug)
                      setTimeout(() => setCopiedSlug(null), 2000)
                    })
                  }}
                  className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity hover:bg-slate-100 text-slate-400"
                  title={t('examples_copy_link')}
                >
                  <Link size={11} />
                </button>

                {/* Number + badges */}
                <div className="flex items-start justify-between gap-2 mb-2 pr-4">
                  <span className="text-xs font-mono opacity-40 text-slate-800">{ex.id}</span>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[ex.type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {ex.type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${THEME_COLORS[ex.theme] ?? ''}`}>
                      {THEME_ICON[ex.theme]} {ex.theme}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div className="font-semibold text-sm mb-1 text-slate-800">{ex.title}</div>

                {/* Description */}
                <div className="text-xs leading-relaxed text-slate-500">{ex.description}</div>

                {/* Copied feedback */}
                {copiedSlug === ex.slug && (
                  <div className={`absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded ${TYPE_COLORS['Flowchart']}`}>
                    {t('examples_link_copied')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-slate-100 text-slate-500 text-xs">
          {t('examples_footer')}
        </div>
      </div>
    </div>
  )
}
