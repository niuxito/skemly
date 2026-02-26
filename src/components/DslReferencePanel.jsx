import { useEffect, useRef } from 'react'
import { X, BookMarked } from 'lucide-react'

const SECTIONS = [
  {
    title: 'Formas',
    rows: [
      { syntax: '[Texto]',   desc: 'Caja (proceso, entidad)' },
      { syntax: '(Texto)',   desc: 'Cilindro (base de datos)' },
      { syntax: '?Texto?',   desc: 'Diamante (decisión)' },
      { syntax: '<Texto>',   desc: 'Nube (externo, SaaS)' },
    ],
  },
  {
    title: 'Relaciones',
    rows: [
      { syntax: 'A -> B',              desc: 'Flecha dirigida' },
      { syntax: 'A <-> B',             desc: 'Bidireccional' },
      { syntax: 'A -> "Label" -> B',   desc: 'Con etiqueta' },
      { syntax: '[A],[B] -> [C],[D]',  desc: 'Expansión cartesiana' },
    ],
  },
  {
    title: 'IDs estables',
    rows: [
      { syntax: '[id|Label]',       desc: 'ID explícito + etiqueta' },
      { syntax: '[app1|Servidor]',  desc: 'Ejemplo: id "app1"' },
    ],
  },
  {
    title: 'Tags',
    rows: [
      { syntax: '[Nodo]#danger',   desc: 'Rojo — peligro / error' },
      { syntax: '[Nodo]#warning',  desc: 'Naranja — advertencia' },
      { syntax: '[Nodo]#info',     desc: 'Azul — informativo' },
      { syntax: '[Nodo]#safe',     desc: 'Verde — OK / seguro' },
    ],
  },
  {
    title: 'Grupos',
    rows: [
      { syntax: 'group "Título" {',   desc: 'Grupo sin tag' },
      { syntax: 'group "Título" #info {', desc: 'Grupo con tag' },
      { syntax: '  [Nodo]',           desc: 'Nodo dentro del grupo' },
      { syntax: '}',                  desc: 'Cierre del grupo' },
    ],
  },
  {
    title: 'Directivas',
    rows: [
      { syntax: 'vibe: clean',       desc: 'Tema: clean · handdrawn · cyberpunk' },
      { syntax: 'layout: TD',        desc: 'Dirección: TD (top-down) · LR · MM' },
      { syntax: 'spacing: 40',       desc: 'Separación entre nodos' },
      { syntax: 'edgeLabels: off',   desc: 'Ocultar etiquetas de aristas' },
    ],
  },
  {
    title: 'Iconos',
    rows: [
      { syntax: '[User]',            desc: 'Auto: user, users, person, people' },
      { syntax: '[Database]',        desc: 'Auto: db, database' },
      { syntax: '[API]',             desc: 'Auto: api, server, cache, queue…' },
      { syntax: '[N]@icon=Shield',   desc: 'Explícito: cualquier icono Lucide' },
    ],
  },
  {
    title: 'Colores',
    rows: [
      { syntax: '[N]@bg=#1e293b',         desc: 'Color de fondo (hex o CSS)' },
      { syntax: '[N]@color=white',        desc: 'Color del texto' },
      { syntax: '[N]@bg=#111@color=#0ff', desc: 'Ambos combinados' },
      { syntax: '[N]@icon=X@bg=steelblue', desc: 'Con icono' },
    ],
  },
  {
    title: 'Formato de texto',
    rows: [
      { syntax: '[**Negrita**]',        desc: 'Texto en negrita' },
      { syntax: '[__Subrayado__]',      desc: 'Texto subrayado' },
      { syntax: '[**__Ambos__**]',      desc: 'Negrita y subrayado' },
    ],
  },
]

export default function DslReferencePanel({ open, onClose, theme }) {
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

  const isCyber = theme === 'cyberpunk'
  const isHand  = theme === 'handdrawn'

  const overlayBg  = isCyber ? 'bg-gray-950/80' : 'bg-slate-900/40'
  const panelBg    = isCyber ? 'bg-gray-900 border border-cyan-800' : isHand ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-200'
  const titleColor = isCyber ? 'text-cyan-300' : isHand ? 'text-stone-800' : 'text-slate-800'
  const subColor   = isCyber ? 'text-cyan-600' : isHand ? 'text-stone-500' : 'text-slate-500'
  const closeBg    = isCyber ? 'hover:bg-gray-700 text-gray-400' : isHand ? 'hover:bg-amber-200 text-stone-500' : 'hover:bg-slate-100 text-slate-400'
  const divider    = isCyber ? 'border-gray-700' : isHand ? 'border-amber-200' : 'border-slate-100'
  const sectionBg  = isCyber ? 'bg-gray-800' : isHand ? 'bg-white' : 'bg-slate-50'
  const sectionTitle = isCyber ? 'text-cyan-400' : isHand ? 'text-stone-700' : 'text-slate-700'
  const codeBg     = isCyber ? 'bg-gray-950 text-green-400' : isHand ? 'bg-amber-100 text-stone-800' : 'bg-slate-100 text-slate-800'
  const descColor  = isCyber ? 'text-gray-400' : isHand ? 'text-stone-500' : 'text-slate-500'
  const fontFamily = isCyber ? '"Courier New", monospace' : isHand ? '"Segoe Print", cursive' : 'inherit'

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 ${overlayBg} backdrop-blur-sm`}>
      <div
        ref={panelRef}
        className={`w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden ${panelBg}`}
        style={{ fontFamily, maxHeight: 'calc(100vh - 6rem)' }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3 border-b ${divider}`}>
          <div className="flex items-center gap-2">
            <BookMarked size={15} className={subColor} />
            <span className={`font-bold text-sm ${titleColor}`}>Referencia DSL</span>
            <span className={`text-xs ${subColor}`}>— Vibedrawing v1.1</span>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${closeBg}`}>
            <X size={15} />
          </button>
        </div>

        {/* Grid of sections */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
          <div className="grid grid-cols-2 gap-3">
            {SECTIONS.map(section => (
              <div key={section.title} className={`rounded-lg p-3 ${sectionBg}`}>
                <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${sectionTitle}`}>
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.rows.map((row, i) => (
                    <div key={i} className="flex items-baseline gap-2">
                      <code className={`text-xs rounded px-1.5 py-0.5 font-mono shrink-0 ${codeBg}`}>
                        {row.syntax}
                      </code>
                      <span className={`text-xs leading-tight ${descColor}`}>{row.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`px-5 py-2.5 border-t ${divider} ${subColor} text-xs`}>
          Pulsa <kbd className={`px-1 py-0.5 rounded text-xs font-mono ${codeBg}`}>Esc</kbd> para cerrar
        </div>
      </div>
    </div>
  )
}
