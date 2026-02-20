import { useEffect, useRef } from 'react'
import { X, BookOpen } from 'lucide-react'
import { EXAMPLES, TYPE_COLORS, THEME_COLORS } from '../lib/examples.js'

const THEME_ICON = { clean: '☀️', handdrawn: '✏️', cyberpunk: '⚡' }

export default function ExamplesPanel({ open, onClose, onLoad, currentTheme }) {
  const panelRef = useRef(null)

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
    // Delay so the opening click doesn't immediately close
    setTimeout(() => window.addEventListener('mousedown', handler), 50)
    return () => window.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  // Theme-aware palette
  const isCyber = currentTheme === 'cyberpunk'
  const isHand  = currentTheme === 'handdrawn'

  const overlayBg   = isCyber ? 'bg-gray-950/80' : 'bg-slate-900/40'
  const panelBg     = isCyber ? 'bg-gray-900 border border-cyan-800' : isHand ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'
  const titleColor  = isCyber ? 'text-cyan-300' : isHand ? 'text-stone-800' : 'text-slate-800'
  const subtitleColor = isCyber ? 'text-cyan-600' : isHand ? 'text-stone-500' : 'text-slate-500'
  const cardBg      = isCyber ? 'bg-gray-800 hover:bg-gray-700 border-gray-700' : isHand ? 'bg-white hover:bg-amber-100 border-amber-200' : 'bg-slate-50 hover:bg-white border-slate-200'
  const cardTitle   = isCyber ? 'text-cyan-100' : isHand ? 'text-stone-800' : 'text-slate-800'
  const cardDesc    = isCyber ? 'text-gray-400' : isHand ? 'text-stone-500' : 'text-slate-500'
  const closeBg     = isCyber ? 'hover:bg-gray-700 text-gray-400' : isHand ? 'hover:bg-amber-200 text-stone-500' : 'hover:bg-slate-100 text-slate-400'
  const fontFamily  = isCyber ? '"Courier New", monospace' : isHand ? '"Segoe Print", cursive' : 'inherit'
  const divider     = isCyber ? 'border-gray-700' : isHand ? 'border-amber-200' : 'border-slate-100'

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 ${overlayBg} backdrop-blur-sm`}>
      <div
        ref={panelRef}
        className={`w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden ${panelBg}`}
        style={{ fontFamily, maxHeight: 'calc(100vh - 8rem)' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${divider}`}>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className={subtitleColor} />
            <span className={`font-bold text-base ${titleColor}`}>Ejemplos</span>
            <span className={`text-xs ${subtitleColor}`}>— {EXAMPLES.length} diagramas listos para usar</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${closeBg}`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
          <div className="grid grid-cols-2 gap-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.id}
                onClick={() => { onLoad(ex.dsl); onClose() }}
                className={`text-left rounded-lg border p-4 transition-all shadow-sm hover:shadow-md ${cardBg}`}
              >
                {/* Number + badges */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`text-xs font-mono opacity-40 ${cardTitle}`}>{ex.id}</span>
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
                <div className={`font-semibold text-sm mb-1 ${cardTitle}`}>{ex.title}</div>

                {/* Description */}
                <div className={`text-xs leading-relaxed ${cardDesc}`}>{ex.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer hint */}
        <div className={`px-5 py-3 border-t ${divider} ${subtitleColor} text-xs`}>
          Haz clic en cualquier ejemplo para cargarlo en el editor
        </div>
      </div>
    </div>
  )
}
