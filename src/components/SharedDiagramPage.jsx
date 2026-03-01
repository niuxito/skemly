import { useState, useEffect, useRef } from 'react'
import { parseDSL } from '../lib/parser.js'
import { useLayout } from '../lib/useLayout.js'
import DiagramRenderer from './DiagramRenderer.jsx'
import { ExternalLink, Edit2 } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'

export default function SharedDiagramPage() {
  const t = useT()
  const [diagramData, setDiagramData] = useState(null) // { dsl, title }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const svgRef = useRef(null)
  const canvasRef = useRef(null)

  // Extract short_id: last 6 chars after the final '-'
  const pathname = window.location.pathname
  const short_id = pathname.slice(pathname.lastIndexOf('-') + 1)

  useEffect(() => {
    if (!short_id) {
      setError('Invalid share URL')
      setLoading(false)
      return
    }

    fetch(`/api/share?id=${short_id}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.error ?? 'Not found')))
      .then(data => {
        setDiagramData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(typeof err === 'string' ? err : 'Failed to load diagram')
        setLoading(false)
      })
  }, [short_id])

  useEffect(() => {
    if (diagramData?.title) {
      document.title = `${diagramData.title} — Skemly`
    }
  }, [diagramData?.title])

  const ast = diagramData ? parseDSL(diagramData.dsl) : null
  const { layout: elkLayout } = useLayout(ast)

  function handleEdit() {
    sessionStorage.setItem('skemly_edit_dsl', JSON.stringify({
      dsl: diagramData.dsl,
      title: diagramData.title,
    }))
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-slate-500 text-sm">{t('shared_loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100 gap-4">
        <div className="text-slate-700 text-base font-medium">{t('shared_not_found')}</div>
        <div className="text-slate-500 text-sm">{error}</div>
        <button
          onClick={() => {
            sessionStorage.setItem('skemly_new_session', '1')
            window.location.href = '/'
          }}
          className="px-4 py-2 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 transition-colors"
        >
          {t('shared_create')} →
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: '100dvh' }}>
      {/* CTA banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-800 text-sm shrink-0">Skemly</span>
          {diagramData.title && (
            <>
              <span className="text-slate-300 shrink-0">/</span>
              <span className="text-slate-600 text-sm truncate">{diagramData.title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Edit2 size={12} />
            {t('shared_edit')}
          </button>
          <button
            onClick={() => {
              sessionStorage.setItem('skemly_new_session', '1')
              window.location.href = '/'
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            <ExternalLink size={12} />
            {t('shared_create')}
          </button>
        </div>
      </div>

      {/* Diagram canvas */}
      <div className="flex-1 overflow-hidden">
        <DiagramRenderer
          ast={ast}
          elkLayout={elkLayout}
          svgRef={svgRef}
          canvasRef={canvasRef}
          onNodeLabelChange={() => {}} // read-only
        />
      </div>
    </div>
  )
}
