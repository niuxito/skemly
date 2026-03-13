import { useState, useRef, useCallback, useEffect } from 'react'
import { parseDSL } from './lib/parser.js'
import { useLayout } from './lib/useLayout.js'
import DiagramRenderer from './components/DiagramRenderer.jsx'
import ExamplesPanel from './components/ExamplesPanel.jsx'
import DslReferencePanel from './components/DslReferencePanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import AuthModal from './components/AuthModal.jsx'
import Header from './components/Header.jsx'
import SessionBar from './components/SessionBar.jsx'
import VibeBar from './components/VibeBar.jsx'
import DiagnosticsPanel from './components/DiagnosticsPanel.jsx'
import { Code2, MessageSquare, HelpCircle, Trash2, LayoutTemplate, Bot } from 'lucide-react'
import { useT } from './lib/i18n.jsx'
import { useAuth } from './features/auth/useAuth.js'
import { useSessions } from './features/sessions/useSessions.js'
import { useExport } from './hooks/useExport.js'
import { rewriteNodeLabel, applyVibeChange } from './features/editor/dslHelpers.js'
import { createSession, deriveTitle } from './features/sessions/sessionHelpers.js'

export default function App() {
  const tFn = useT()

  // ─── Auth ────────────────────────────────────────────────────────────────
  const {
    user, authResolved,
    authOpen, setAuthOpen, authDefaultTab, authDefaultEmail,
    handleAuthSuccess, handleVerifySuccess,
    handleLogout, openAuthModal, handleOpenVerify,
  } = useAuth()

  // ─── Sessions ────────────────────────────────────────────────────────────
  const {
    sessions, setSessions,
    activeSessionId, setActiveSessionId,
    currentSession,
    historyOpen, setHistoryOpen,
    editingSessionTitle, setEditingSessionTitle,
    sessionTitleDraft, setSessionTitleDraft,
    cloudLoading, anonToImport,
    updateCurrentSession,
    updateThumbnail,
    handleNewSession,
    handleSwitchSession,
    handleDeleteSession,
    commitSessionTitle,
    handleImportAnon,
    dismissAnonImport,
  } = useSessions({ user, authResolved, t: tFn })

  // ─── UI state ─────────────────────────────────────────────────────────────
  const [shared, setShared] = useState(false)
  const [remainingRequests, setRemainingRequests] = useState(null)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [dslRefOpen, setDslRefOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const [mobileView, setMobileView] = useState('chat')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [ast, setAst] = useState(null)

  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const textareaRef = useRef(null)

  const dsl = currentSession?.dsl ?? ''

  // ─── Responsive breakpoint ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ─── Parse DSL ───────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => { setAst(parseDSL(dsl)) }, 150)
    return () => clearTimeout(timer)
  }, [dsl])

  const { layout: elkLayout, error: layoutError } = useLayout(ast)
  const themeName = ast?.directives?.vibe ?? 'clean'

  // ─── Export ──────────────────────────────────────────────────────────────
  const { exportSVG, exportPNG, copyDSL, copied } = useExport({
    svgRef, canvasRef, ast, user, currentSession,
  })

  // ─── Session callbacks ───────────────────────────────────────────────────
  const handleDslUpdate = useCallback((newDsl) => {
    updateCurrentSession({ dsl: newDsl })
    if (isMobile) setMobileView('diagram')
  }, [updateCurrentSession, isMobile])

  const handleMessagesChange = useCallback((messages, chatHistory) => {
    updateCurrentSession({ messages, chatHistory })
  }, [updateCurrentSession])

  const handleNodeLabelChange = useCallback((idKey, newLabel) => {
    if (!ast) return
    const node = ast.nodes.find(n => n.id_key === idKey)
    if (!node) return
    updateCurrentSession({ dsl: rewriteNodeLabel(dsl, idKey, node.label, newLabel) })
  }, [ast, dsl, updateCurrentSession])

  const handleVibeChange = useCallback((key) => {
    updateCurrentSession({ dsl: applyVibeChange(dsl, key) })
  }, [dsl, updateCurrentSession])

  // ─── Share diagram ────────────────────────────────────────────────────────
  const shareDiagram = useCallback(async () => {
    if (!dsl) return
    try {
      const resp = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dsl, title: currentSession?.title }),
      })
      if (resp.ok) {
        const { path } = await resp.json()
        await navigator.clipboard.writeText(`${window.location.origin}${path}`)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        return
      }
    } catch { /* fall through to hash fallback */ }
    const encoded = btoa(encodeURIComponent(dsl))
    const url = `${window.location.origin}${window.location.pathname}#dsl=${encoded}`
    await navigator.clipboard.writeText(url)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }, [dsl, currentSession?.title])

  // ─── Examples load handler ────────────────────────────────────────────────
  const handleLoadExample = useCallback((newDsl) => {
    const s = createSession(newDsl)
    s.title = deriveTitle(newDsl, [], tFn('untitled'))
    setSessions(prev => [s, ...prev])
    setActiveSessionId(s.id)
    setExamplesOpen(false)
    setActiveTab('chat')
    setMobileView('chat')
  }, [tFn, setSessions, setActiveSessionId])

  const allErrors = [
    ...(ast?.diagnostics ?? []),
    ...(layoutError ? [{ line: 0, msg: `${tFn('layout_error_prefix')}: ${layoutError}` }] : []),
  ]

  // ─── Thumbnail capture (debounced 2s after layout renders) ───────────────
  const thumbnailTimerRef = useRef(null)
  useEffect(() => {
    if (!elkLayout || !svgRef.current) return
    const sessionId = (sessions.find(s => s.id === activeSessionId) ?? sessions[0])?.id
    if (!sessionId) return
    clearTimeout(thumbnailTimerRef.current)
    thumbnailTimerRef.current = setTimeout(() => {
      try {
        const svgEl = svgRef.current
        if (!svgEl) return
        const serializer = new XMLSerializer()
        const raw = serializer.serializeToString(svgEl)
        // Add XML declaration and namespace so it renders as standalone SVG
        const svgString = raw.startsWith('<?xml') ? raw : `<?xml version="1.0" encoding="UTF-8"?>${raw}`
        updateThumbnail(sessionId, svgString)
      } catch { /* serialization failed — skip */ }
    }, 2000)
    return () => clearTimeout(thumbnailTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elkLayout, activeSessionId])

  // ─── Shared session bar props ─────────────────────────────────────────────
  const sessionBarProps = {
    sessions,
    activeSessionId,
    currentSession,
    historyOpen,
    setHistoryOpen,
    editingSessionTitle,
    setEditingSessionTitle,
    sessionTitleDraft,
    setSessionTitleDraft,
    cloudLoading,
    onCommitTitle: commitSessionTitle,
    onDeleteSession: handleDeleteSession,
    onSwitchSession: (id) => {
      handleSwitchSession(id)
      setActiveTab('chat')
      setMobileView('chat')
    },
  }

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: '100dvh' }}>
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <Header
        user={user}
        shared={shared}
        copied={copied}
        onShare={shareDiagram}
        onExportSVG={exportSVG}
        onExportPNG={exportPNG}
        onCopyDSL={() => copyDSL(dsl)}
        onOpenExamples={() => setExamplesOpen(true)}
        onLogin={() => openAuthModal('login')}
        onLogout={handleLogout}
      />

      {/* ─── Email verification banner ────────────────────────────────── */}
      {user && !user.email_verified && (
        <div className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0 bg-yellow-50 border-b border-yellow-200 text-yellow-800">
          <span>{tFn('verify_email_banner')}</span>
          <button
            onClick={() => handleOpenVerify(user.email)}
            className="underline font-medium ml-2 shrink-0 hover:opacity-70 transition-opacity"
          >
            {tFn('verify_now')}
          </button>
        </div>
      )}

      {/* ─── Anonymous import banner ──────────────────────────────────── */}
      {anonToImport?.length > 0 && (
        <div className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0 bg-blue-50 border-b border-blue-200 text-blue-800">
          <span>{tFn('anon_import_banner', anonToImport.length)}</span>
          <div className="flex items-center gap-3 ml-2 shrink-0">
            <button onClick={handleImportAnon} className="underline font-medium hover:opacity-70 transition-opacity">
              {tFn('anon_import_btn')}
            </button>
            <button
              onClick={dismissAnonImport}
              className="opacity-50 hover:opacity-80 transition-opacity leading-none text-sm font-medium"
              title={tFn('anon_import_dismiss')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        /* ─── Mobile layout ──────────────────────────────────────────── */
        <div className="flex flex-col flex-1 overflow-hidden">
          <SessionBar
            {...sessionBarProps}
            onNewSession={() => {
              handleNewSession()
              setActiveTab('chat')
              setMobileView('chat')
            }}
            newLabel={tFn('new_session_btn')}
          />

          <div className={`flex-1 overflow-hidden relative ${mobileView !== 'diagram' ? 'hidden' : ''}`}>
            <DiagramRenderer ast={ast} elkLayout={elkLayout} svgRef={svgRef} canvasRef={canvasRef} onNodeLabelChange={handleNodeLabelChange} emptyHint={tFn('canvas_empty_hint')} />
            <VibeBar current={themeName} onChange={handleVibeChange} />
          </div>

          <div className={`flex flex-col flex-1 overflow-hidden ${mobileView !== 'chat' ? 'hidden' : ''}`}>
            <ChatPanel messages={currentSession?.messages ?? []} chatHistory={currentSession?.chatHistory ?? []} onMessagesChange={handleMessagesChange} onDslUpdate={handleDslUpdate} currentDsl={dsl} remainingRequests={remainingRequests} onRemainingChange={setRemainingRequests} key={activeSessionId ?? sessions[0]?.id} />
          </div>

          <div className={`flex flex-col flex-1 overflow-hidden ${mobileView !== 'dsl' ? 'hidden' : ''}`}>
            <textarea ref={textareaRef} value={dsl} onChange={e => updateCurrentSession({ dsl: e.target.value })} spellCheck={false} className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-white text-slate-900" style={{ lineHeight: '1.6', tabSize: 2 }} placeholder="Type your Skemly DSL here…" />
            <DiagnosticsPanel diagnostics={allErrors} />
            <div className="flex items-center justify-between px-3 py-1.5 text-xs border-t text-slate-800 bg-white border-slate-200">
              <span className="opacity-40">{ast?.nodes?.length ?? 0} nodes · {ast?.edges?.length ?? 0} edges · {ast?.groups?.length ?? 0} groups</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setDslRefOpen(true)} className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity" title="Referencia DSL"><HelpCircle size={11} />Referencia</button>
                <button onClick={() => updateCurrentSession({ dsl: '' })} className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity" title="Clear DSL"><Trash2 size={11} />Clear</button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 border-t bg-white border-slate-200">
            {[
              { id: 'diagram', Icon: LayoutTemplate, labelKey: 'mobile_diagram' },
              { id: 'chat',    Icon: Bot,             labelKey: 'mobile_chat'    },
              { id: 'dsl',     Icon: Code2,           labelKey: 'mobile_code'   },
            ].map(({ id, Icon, labelKey }) => (
              <button key={id} onClick={() => setMobileView(id)} className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs transition-opacity text-slate-800 ${mobileView === id ? '' : 'opacity-40'}`}>
                <Icon size={18} />
                {tFn(labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ─── Desktop / tablet split view ────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col md:w-1/3 lg:w-2/5 min-w-[280px] max-w-[520px] shrink-0 border-r border-slate-200">
            <SessionBar
              {...sessionBarProps}
              onNewSession={() => {
                handleNewSession()
                setActiveTab('chat')
              }}
            />

            <div className="flex border-b shrink-0 bg-white border-slate-200">
              <button onClick={() => setActiveTab('editor')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 text-slate-800 ${activeTab === 'editor' ? 'border-current' : 'border-transparent opacity-40 hover:opacity-60'}`}>
                <Code2 size={12} />{tFn('tab_editor')}
              </button>
              <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 text-slate-800 ${activeTab === 'chat' ? 'border-current' : 'border-transparent opacity-40 hover:opacity-60'}`}>
                <MessageSquare size={12} />{tFn('tab_chat')}
              </button>
            </div>

            <div className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
              <textarea ref={textareaRef} value={dsl} onChange={e => updateCurrentSession({ dsl: e.target.value })} spellCheck={false} className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-white text-slate-900" style={{ lineHeight: '1.6', tabSize: 2 }} placeholder={tFn('editor_placeholder')} />
              <DiagnosticsPanel diagnostics={allErrors} />
              <div className="flex items-center justify-between px-3 py-1.5 text-xs border-t text-slate-800 bg-white border-slate-200">
                <span className="opacity-40">{ast?.nodes?.length ?? 0} {tFn('nodes')} · {ast?.edges?.length ?? 0} {tFn('edges')} · {ast?.groups?.length ?? 0} {tFn('groups')}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDslRefOpen(true)} className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity" title={tFn('dsl_ref_title')}><HelpCircle size={11} />{tFn('reference')}</button>
                  <button onClick={() => updateCurrentSession({ dsl: '' })} className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity" title={tFn('clear')}><Trash2 size={11} />{tFn('clear')}</button>
                </div>
              </div>
            </div>

            <div className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'chat' ? '' : 'hidden'}`}>
              <ChatPanel messages={currentSession?.messages ?? []} chatHistory={currentSession?.chatHistory ?? []} onMessagesChange={handleMessagesChange} onDslUpdate={handleDslUpdate} currentDsl={dsl} remainingRequests={remainingRequests} onRemainingChange={setRemainingRequests} key={activeSessionId ?? sessions[0]?.id} />
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <DiagramRenderer ast={ast} elkLayout={elkLayout} svgRef={svgRef} canvasRef={canvasRef} onNodeLabelChange={handleNodeLabelChange} emptyHint={tFn('canvas_empty_hint')} />
            <VibeBar current={themeName} onChange={handleVibeChange} />
          </div>
        </div>
      )}

      <DslReferencePanel open={dslRefOpen} onClose={() => setDslRefOpen(false)} />

      <ExamplesPanel open={examplesOpen} onClose={() => setExamplesOpen(false)} onLoad={handleLoadExample} />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onVerifySuccess={handleVerifySuccess}
        defaultTab={authDefaultTab}
        defaultEmail={authDefaultEmail}
      />

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="shrink-0 flex items-center justify-center gap-4 px-4 py-1 bg-white border-t border-slate-100 text-xs text-slate-400">
        <a href="/terms" className="hover:text-slate-600 transition-colors">Términos de Servicio</a>
        <span className="opacity-30">·</span>
        <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacidad</a>
      </footer>
    </div>
  )
}
