import { useState, useRef, useCallback, useEffect } from 'react'
import { parseDSL, normalizeId } from './lib/parser.js'
import { useLayout } from './lib/useLayout.js'
import { THEMES } from './lib/themes.js'
import DiagramRenderer from './components/DiagramRenderer.jsx'
import ExamplesPanel from './components/ExamplesPanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import { Download, Copy, Check, AlertTriangle, BookOpen, MessageSquare, Code2, Trash2, Plus, ChevronDown, Link } from 'lucide-react'

// ─── Session helpers ──────────────────────────────────────────────────────────
const SESSIONS_KEY = 'vibediag_sessions'
const ACTIVE_KEY   = 'vibediag_active'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessionsToStorage(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  } catch { /* quota exceeded – skip */ }
}

function createSession(dsl = '') {
  return {
    id: uid(),
    title: 'Nueva sesión',
    dsl,
    messages: [],
    chatHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function deriveTitle(dsl, messages) {
  const match = dsl?.match(/\[(?:[^\]|]+\|)?([^\]]+)\]/)
  if (match) return match[1].trim().slice(0, 40)
  const firstUser = messages?.find(m => m.role === 'user')
  if (firstUser) return firstUser.content.slice(0, 35)
  return 'Sin título'
}

// ─── DSL label rewriter ───────────────────────────────────────────────────────
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Rewrites a node's label in the raw DSL text, preserving explicit ids and edges.
function rewriteNodeLabel(dsl, idKey, oldLabel, newLabel) {
  const hasExplicitId = normalizeId(oldLabel) !== idKey

  // Shape delimiter pairs used in the DSL
  const shapes = [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '?', close: '?' },
  ]

  let result = dsl
  for (const { open, close } of shapes) {
    const eo = escapeRegex(open)
    const ec = escapeRegex(close)
    const el = escapeRegex(oldLabel)

    if (hasExplicitId) {
      // [rawId|oldLabel] → [rawId|newLabel]  (case-insensitive id match)
      const re = new RegExp(`${eo}([^|${ec}]*)\\|${el}${ec}`, 'g')
      result = result.replace(re, (match, rawId) =>
        normalizeId(rawId) === idKey
          ? `${open}${rawId}|${newLabel}${close}`
          : match
      )
    } else {
      // [oldLabel] → [idKey|newLabel]  (inject explicit id to preserve edges)
      const re = new RegExp(`${eo}${el}${ec}`, 'g')
      result = result.replace(re, `${open}${idKey}|${newLabel}${close}`)
    }
  }
  return result
}

function relativeTime(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_DSL = `vibe: clean
layout: TD

<internet|Internet> -> [lb|Load Balancer]#info

group "Private Cloud" #safe {
  [lb|Load Balancer] -> [app1|App Server 1], [app2|App Server 2]
  [app1|App Server 1], [app2|App Server 2] -> (db|Main Database)#safe
}

[app1|App Server 1] -> "Auth Check" -> ?valid|Valid??
?valid|Valid?? -> "no" -> [login|Login Page]#danger
`

const THEME_LABELS = {
  clean: { label: 'Clean', icon: '☀️' },
  handdrawn: { label: 'Handdrawn', icon: '✏️' },
  cyberpunk: { label: 'Cyberpunk', icon: '⚡' },
}

function DiagnosticsPanel({ diagnostics, theme }) {
  if (!diagnostics || diagnostics.length === 0) return null

  const bgMap = { clean: '#fef2f2', handdrawn: '#fff7ed', cyberpunk: '#1a0000' }
  const textMap = { clean: '#991b1b', handdrawn: '#9a3412', cyberpunk: '#ff4444' }

  return (
    <div
      className="border-t px-3 py-2 text-xs space-y-0.5 font-mono overflow-auto"
      style={{
        maxHeight: 100,
        background: bgMap[theme] ?? bgMap.clean,
        color: textMap[theme] ?? textMap.clean,
        borderColor: '#fca5a5',
      }}
    >
      {diagnostics.map((d, i) => (
        <div key={i} className="flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>Line {d.line}: {d.msg}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  // ─── Sessions state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions()
    return saved.length ? saved : [createSession(DEFAULT_DSL)]
  })
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = loadSessions()
    if (saved.length) {
      const storedId = localStorage.getItem(ACTIVE_KEY)
      return saved.find(s => s.id === storedId) ? storedId : saved[0].id
    }
    return null
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef(null)

  // ─── Other state ─────────────────────────────────────────────────────────
  const [ast, setAst] = useState(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [remainingRequests, setRemainingRequests] = useState(null)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const textareaRef = useRef(null)

  // ─── Derived values ───────────────────────────────────────────────────────
  const currentSession = sessions.find(s => s.id === activeSessionId) ?? sessions[0]
  const dsl = currentSession?.dsl ?? ''

  // ─── Session update helper ────────────────────────────────────────────────
  const updateCurrentSession = useCallback((partial) => {
    setSessions(prev => {
      const id = (prev.find(s => s.id === activeSessionId) ?? prev[0])?.id
      if (!id) return prev
      return prev.map(s => s.id === id ? { ...s, ...partial, updatedAt: Date.now() } : s)
    })
  }, [activeSessionId])

  // ─── Session callbacks ────────────────────────────────────────────────────
  const handleDslUpdate = useCallback((newDsl) => {
    updateCurrentSession({ dsl: newDsl })
  }, [updateCurrentSession])

  const handleMessagesChange = useCallback((messages, chatHistory) => {
    updateCurrentSession({ messages, chatHistory })
  }, [updateCurrentSession])

  const handleNewSession = useCallback(() => {
    const s = createSession('')
    setSessions(prev => [s, ...prev])
    setActiveSessionId(s.id)
    setHistoryOpen(false)
  }, [])

  const handleSwitchSession = useCallback((id) => {
    setActiveSessionId(id)
    setHistoryOpen(false)
  }, [])

  const handleNodeLabelChange = useCallback((idKey, newLabel) => {
    if (!ast) return
    const node = ast.nodes.find(n => n.id_key === idKey)
    if (!node) return
    updateCurrentSession({ dsl: rewriteNodeLabel(dsl, idKey, node.label, newLabel) })
  }, [ast, dsl, updateCurrentSession])

  const handleDeleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        const fresh = createSession('')
        setActiveSessionId(fresh.id)
        setHistoryOpen(false)
        return [fresh]
      }
      if (id === activeSessionId) {
        setActiveSessionId(next[0].id)
      }
      return next
    })
  }, [activeSessionId])

  // ─── localStorage persistence ─────────────────────────────────────────────
  useEffect(() => {
    saveSessionsToStorage(sessions)
  }, [sessions])

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(ACTIVE_KEY, activeSessionId)
  }, [activeSessionId])

  // ─── Shared DSL via URL hash ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash.startsWith('dsl=')) return
    try {
      const sharedDsl = decodeURIComponent(atob(hash.slice(4)))
      const s = createSession(sharedDsl)
      s.title = deriveTitle(sharedDsl, [])
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // malformed hash — ignore
    }
  }, []) // runs once on mount

  const shareDiagram = useCallback(async () => {
    if (!dsl) return
    const encoded = btoa(encodeURIComponent(dsl))
    const url = `${window.location.origin}${window.location.pathname}#dsl=${encoded}`
    await navigator.clipboard.writeText(url)
    setShared(true)
    setTimeout(() => setShared(false), 2000)
  }, [dsl])

  // ─── Auto-title (debounced 800ms) ─────────────────────────────────────────
  useEffect(() => {
    const sessionId = currentSession?.id
    const currentTitle = currentSession?.title
    const currentMessages = currentSession?.messages ?? []
    const t = setTimeout(() => {
      if (!sessionId) return
      const newTitle = deriveTitle(dsl, currentMessages)
      if (newTitle !== currentTitle) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title: newTitle } : s
        ))
      }
    }, 800)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsl, currentSession?.messages?.length])

  // ─── Outside click closes history ─────────────────────────────────────────
  useEffect(() => {
    if (!historyOpen) return
    function handleOutsideClick(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [historyOpen])

  // ─── Parse DSL ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setAst(parseDSL(dsl))
    }, 150)
    return () => clearTimeout(timer)
  }, [dsl])

  const { layout: elkLayout, error: layoutError } = useLayout(ast)
  const themeName = ast?.directives?.vibe ?? 'clean'

  // ─── Theme-aware styles ───────────────────────────────────────────────────
  const themeStyles = {
    clean: {
      appBg: 'bg-slate-100',
      headerBg: 'bg-white border-b border-slate-200',
      headerText: 'text-slate-800',
      editorBg: 'bg-white',
      editorText: 'text-slate-900',
      editorBorder: 'border-r border-slate-200',
      btnPrimary: 'bg-slate-800 text-white hover:bg-slate-700',
      btnSecondary: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50',
      activeThemeBtn: 'bg-slate-800 text-white',
      inactiveThemeBtn: 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50',
      sessionHighlight: 'bg-slate-100',
    },
    handdrawn: {
      appBg: 'bg-amber-50',
      headerBg: 'bg-amber-100 border-b border-amber-200',
      headerText: 'text-stone-800',
      editorBg: 'bg-amber-50',
      editorText: 'text-stone-900',
      editorBorder: 'border-r border-amber-200',
      btnPrimary: 'bg-stone-800 text-white hover:bg-stone-700',
      btnSecondary: 'bg-amber-100 border border-amber-300 text-stone-700 hover:bg-amber-200',
      activeThemeBtn: 'bg-stone-800 text-white',
      inactiveThemeBtn: 'bg-amber-100 border border-amber-200 text-stone-600 hover:bg-amber-200',
      sessionHighlight: 'bg-amber-100',
    },
    cyberpunk: {
      appBg: 'bg-gray-950',
      headerBg: 'bg-gray-900 border-b border-cyan-900',
      headerText: 'text-cyan-300',
      editorBg: 'bg-gray-950',
      editorText: 'text-cyan-100',
      editorBorder: 'border-r border-cyan-900',
      btnPrimary: 'bg-cyan-500 text-black hover:bg-cyan-400',
      btnSecondary: 'bg-gray-900 border border-cyan-800 text-cyan-300 hover:bg-gray-800',
      activeThemeBtn: 'bg-cyan-500 text-black',
      inactiveThemeBtn: 'bg-gray-900 border border-cyan-900 text-cyan-500 hover:bg-gray-800',
      sessionHighlight: 'bg-gray-800',
    },
  }

  const ts = themeStyles[themeName] ?? themeStyles.clean

  // ─── Export SVG ───────────────────────────────────────────────────────────
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgW = svgEl.width?.baseVal?.value || 800
    const svgH = svgEl.height?.baseVal?.value || 600
    const theme = THEMES[ast?.directives?.vibe ?? 'clean'] ?? THEMES.clean

    const svgClone = svgEl.cloneNode(true)
    svgClone.style.transform = ''
    svgClone.style.position = ''
    svgClone.style.transformOrigin = ''

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bgRect.setAttribute('x', '0')
    bgRect.setAttribute('y', '0')
    bgRect.setAttribute('width', String(svgW))
    bgRect.setAttribute('height', String(svgH))
    bgRect.setAttribute('fill', theme.canvasBg)
    svgClone.insertBefore(bgRect, svgClone.firstChild)

    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      imgEl.setAttribute('x', '0')
      imgEl.setAttribute('y', '0')
      imgEl.setAttribute('width', String(svgW))
      imgEl.setAttribute('height', String(svgH))
      imgEl.setAttribute('href', dataUrl)
      svgClone.insertBefore(imgEl, svgClone.children[1])
    }

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgClone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vibediagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [ast])

  // ─── Export PNG ───────────────────────────────────────────────────────────
  const exportPNG = useCallback(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgW = svgEl.width?.baseVal?.value || 800
    const svgH = svgEl.height?.baseVal?.value || 600
    const scale = 2
    const theme = THEMES[ast?.directives?.vibe ?? 'clean'] ?? THEMES.clean

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = svgW * scale
    exportCanvas.height = svgH * scale
    const ctx = exportCanvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = theme.canvasBg
    ctx.fillRect(0, 0, svgW, svgH)

    if (canvasRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0, svgW, svgH)
    }

    const svgClone = svgEl.cloneNode(true)
    svgClone.style.transform = ''
    svgClone.style.position = ''
    svgClone.style.transformOrigin = ''
    for (const fo of svgClone.querySelectorAll('foreignObject')) fo.remove()

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgClone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, svgW, svgH)
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.href = exportCanvas.toDataURL('image/png')
      a.download = 'vibediagram.png'
      a.click()
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [ast])

  // ─── Copy DSL ─────────────────────────────────────────────────────────────
  const copyDSL = useCallback(async () => {
    await navigator.clipboard.writeText(dsl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [dsl])

  const allErrors = [
    ...(ast?.diagnostics ?? []),
    ...(layoutError ? [{ line: 0, msg: `Layout error: ${layoutError}` }] : []),
  ]

  return (
    <div className={`flex flex-col h-screen ${ts.appBg}`}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className={`flex items-center justify-between px-4 py-2 shrink-0 ${ts.headerBg}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`font-bold text-base tracking-tight ${ts.headerText}`}>
              Vibedrawing
            </span>
            <span className={`text-xs opacity-50 ${ts.headerText}`}>v1.1</span>
          </div>
          <button
            onClick={() => setExamplesOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${ts.inactiveThemeBtn}`}
          >
            <BookOpen size={12} />
            Ejemplos
          </button>
        </div>

        {/* Theme switcher */}
        <div className="flex items-center gap-1">
          {Object.entries(THEME_LABELS).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => {
                const newDsl = dsl.replace(/^vibe\s*:.*$/m, `vibe: ${key}`)
                if (newDsl === dsl && !dsl.match(/^vibe\s*:/m)) {
                  updateCurrentSession({ dsl: `vibe: ${key}\n` + dsl })
                } else {
                  updateCurrentSession({ dsl: newDsl })
                }
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                themeName === key ? ts.activeThemeBtn : ts.inactiveThemeBtn
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={shareDiagram}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${ts.btnSecondary}`}
            title="Copy shareable link"
          >
            {shared ? <Check size={12} /> : <Link size={12} />}
            {shared ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={copyDSL}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${ts.btnSecondary}`}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy DSL'}
          </button>
          <button
            onClick={exportSVG}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${ts.btnSecondary}`}
          >
            <Download size={12} />
            SVG
          </button>
          <button
            onClick={exportPNG}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${ts.btnSecondary}`}
          >
            <Download size={12} />
            PNG
          </button>
        </div>
      </header>

      {/* ─── Split view ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className={`flex flex-col w-2/5 min-w-[280px] max-w-[520px] shrink-0 ${ts.editorBorder}`}>

          {/* ─── Session header ─────────────────────────────────────────── */}
          <div className="relative shrink-0" ref={historyRef}>
            <div
              className={`flex items-center justify-between px-3 py-1.5 border-b ${ts.editorBg}`}
              style={{ borderColor: 'inherit' }}
            >
              <button
                onClick={() => setHistoryOpen(o => !o)}
                className={`flex items-center gap-1 text-xs font-medium flex-1 min-w-0 mr-2 text-left ${ts.headerText} opacity-60 hover:opacity-100 transition-opacity`}
              >
                <span className="truncate">{currentSession?.title ?? 'Nueva sesión'}</span>
                <ChevronDown size={11} className="shrink-0 ml-1" />
              </button>
              <button
                onClick={handleNewSession}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs shrink-0 ${ts.btnSecondary}`}
              >
                <Plus size={11} />
                New
              </button>
            </div>

            {historyOpen && (
              <div
                className={`absolute top-full left-0 right-0 z-50 border-b shadow-lg overflow-y-auto ${ts.editorBg}`}
                style={{ borderColor: 'inherit', maxHeight: 240 }}
              >
                {[...sessions]
                  .sort((a, b) => b.updatedAt - a.updatedAt)
                  .map(session => (
                    <div
                      key={session.id}
                      onClick={() => handleSwitchSession(session.id)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-opacity ${ts.headerText} ${
                        session.id === (activeSessionId ?? sessions[0]?.id)
                          ? `font-semibold ${ts.sessionHighlight}`
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {session.id === (activeSessionId ?? sessions[0]?.id) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      )}
                      <span className="flex-1 truncate">{session.title}</span>
                      <span className="shrink-0 opacity-40 text-[10px]">{relativeTime(session.updatedAt)}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteSession(session.id) }}
                        className="shrink-0 opacity-40 hover:opacity-100 leading-none text-sm font-medium ml-1"
                        title="Delete session"
                      >
                        ×
                      </button>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          {/* Tab switcher */}
          <div className={`flex border-b shrink-0 ${ts.editorBg}`} style={{ borderColor: 'inherit' }}>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'editor'
                  ? `border-current ${ts.headerText}`
                  : `border-transparent opacity-40 ${ts.headerText} hover:opacity-60`
              }`}
            >
              <Code2 size={12} />
              DSL Editor
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'chat'
                  ? `border-current ${ts.headerText}`
                  : `border-transparent opacity-40 ${ts.headerText} hover:opacity-60`
              }`}
            >
              <MessageSquare size={12} />
              AI Chat
            </button>
          </div>

          {/* Editor — always mounted, hidden when chat is active */}
          <div className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
            <textarea
              ref={textareaRef}
              value={dsl}
              onChange={e => updateCurrentSession({ dsl: e.target.value })}
              spellCheck={false}
              className={`flex-1 p-3 font-mono text-sm resize-none outline-none ${ts.editorBg} ${ts.editorText}`}
              style={{ lineHeight: '1.6', tabSize: 2 }}
              placeholder="Type your Vibedrawing DSL here…"
            />
            <DiagnosticsPanel diagnostics={allErrors} theme={themeName} />
            <div className={`flex items-center justify-between px-3 py-1.5 text-xs border-t ${ts.headerText} ${ts.editorBg}`}
                 style={{ borderColor: 'inherit' }}>
              <span className="opacity-40">
                {ast?.nodes?.length ?? 0} nodes · {ast?.edges?.length ?? 0} edges · {ast?.groups?.length ?? 0} groups
              </span>
              <button
                onClick={() => updateCurrentSession({ dsl: '' })}
                className={`flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity`}
                title="Clear DSL"
              >
                <Trash2 size={11} />
                Clear
              </button>
            </div>
          </div>

          {/* Chat — always mounted, hidden when editor is active */}
          <div className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'chat' ? '' : 'hidden'}`}>
            <ChatPanel
              messages={currentSession?.messages ?? []}
              chatHistory={currentSession?.chatHistory ?? []}
              onMessagesChange={handleMessagesChange}
              onDslUpdate={handleDslUpdate}
              currentDsl={dsl}
              theme={themeName}
              remainingRequests={remainingRequests}
              onRemainingChange={setRemainingRequests}
              key={activeSessionId ?? sessions[0]?.id}
            />
          </div>
        </div>

        {/* Diagram preview */}
        <div className="flex-1 relative overflow-hidden">
          <DiagramRenderer
            ast={ast}
            elkLayout={elkLayout}
            svgRef={svgRef}
            canvasRef={canvasRef}
            onNodeLabelChange={handleNodeLabelChange}
          />
        </div>
      </div>

      <ExamplesPanel
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onLoad={(newDsl) => {
          const s = createSession(newDsl)
          s.title = deriveTitle(newDsl, [])
          setSessions(prev => [s, ...prev])
          setActiveSessionId(s.id)
          setExamplesOpen(false)
        }}
        currentTheme={themeName}
      />
    </div>
  )
}
