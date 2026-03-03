import { useState, useRef, useCallback, useEffect } from 'react'
import { parseDSL, normalizeId } from './lib/parser.js'
import { useLayout } from './lib/useLayout.js'
import { THEMES } from './lib/themes.js'
import DiagramRenderer from './components/DiagramRenderer.jsx'
import ExamplesPanel from './components/ExamplesPanel.jsx'
import { getExampleBySlug } from './lib/examples.js'
import DslReferencePanel from './components/DslReferencePanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import { Download, Copy, Check, AlertTriangle, BookOpen, MessageSquare, Code2, Trash2, Plus, ChevronDown, Link, Edit2, HelpCircle, Bot, LayoutTemplate, LogOut, Globe } from 'lucide-react'
import AuthModal from './components/AuthModal.jsx'
import { useI18n, useT } from './lib/i18n.jsx'

// ─── Session helpers ──────────────────────────────────────────────────────────
const isPaid = (user) => user?.plan === 'pro' || user?.plan === 'starter'
const sessionsKey = (userId) => userId ? `vibediag_sessions_${userId}` : 'vibediag_sessions'
const activeKey   = (userId) => userId ? `vibediag_active_${userId}`   : 'vibediag_active'

function loadSessions(key) {
  try {
    const raw = localStorage.getItem(key ?? 'vibediag_sessions')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSessionsToStorage(sessions, key) {
  try {
    localStorage.setItem(key ?? 'vibediag_sessions', JSON.stringify(sessions))
  } catch { /* quota exceeded – skip */ }
}

function createSession(dsl = '', title = 'Nueva sesión') {
  return {
    id: crypto.randomUUID(),
    title,
    dsl,
    messages: [],
    chatHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// ─── DB helpers (pro/starter users) ──────────────────────────────────────────
// Auth is handled via HttpOnly cookie — no manual token needed.
async function postSessionToDB(session) {
  await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: session.id,
      title: session.title,
      dsl: session.dsl,
      messages: session.messages,
      chatHistory: session.chatHistory,
      titleManual: session.titleManual,
    }),
  })
}

async function putSessionToDB(session) {
  await fetch(`/api/sessions?id=${encodeURIComponent(session.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: session.title,
      dsl: session.dsl,
      messages: session.messages,
      chatHistory: session.chatHistory,
      titleManual: session.titleManual,
    }),
  })
}

async function deleteSessionFromDB(id) {
  await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

function deriveTitle(dsl, messages, untitled = 'Sin título') {
  const match = dsl?.match(/\[(?:[^\]|]+\|)?([^\]]+)\]/)
  if (match) return match[1].trim().slice(0, 40)
  const firstUser = messages?.find(m => m.role === 'user')
  if (firstUser) return firstUser.content.slice(0, 35)
  return untitled
}

// ─── DSL label rewriter ───────────────────────────────────────────────────────
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripFormatting(text) {
  let t = text.trim()
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) t = t.slice(2, -2).trim()
  if (t.startsWith('__') && t.endsWith('__') && t.length > 4) t = t.slice(2, -2).trim()
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) t = t.slice(2, -2).trim()
  return t
}

function preserveFormatting(rawContent, newLabel) {
  let t = rawContent.trim()
  const markers = []
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) { markers.push('**'); t = t.slice(2, -2).trim() }
  if (t.startsWith('__') && t.endsWith('__') && t.length > 4) { markers.push('__'); t = t.slice(2, -2).trim() }
  if (markers[0] !== '**' && t.startsWith('**') && t.endsWith('**') && t.length > 4) { markers.push('**'); }
  let result = newLabel
  for (let i = markers.length - 1; i >= 0; i--) result = `${markers[i]}${result}${markers[i]}`
  return result
}

function rewriteNodeLabel(dsl, idKey, oldLabel, newLabel) {
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

    let matched = false
    const reExplicit = new RegExp(`${eo}([^|${ec}]*)\\|([^${ec}]*)${ec}`, 'g')
    result = result.replace(reExplicit, (match, rawId, rawLabelContent) => {
      if (normalizeId(rawId) === idKey && stripFormatting(rawLabelContent) === oldLabel) {
        matched = true
        return `${open}${rawId}|${preserveFormatting(rawLabelContent, newLabel)}${close}`
      }
      return match
    })

    if (!matched) {
      const reNonExplicit = new RegExp(`${eo}([^${ec}]*)${ec}`, 'g')
      result = result.replace(reNonExplicit, (match, rawContent) => {
        if (rawContent.includes('|')) return match
        if (stripFormatting(rawContent) === oldLabel) {
          matched = true
          return `${open}${idKey}|${preserveFormatting(rawContent, newLabel)}${close}`
        }
        return match
      })
    }
  }
  return result
}

function toFilename(title) {
  const clean = (title ?? '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
  return clean || 'vibediagram'
}

function relativeTime(ts, t) {
  const diff = Date.now() - ts
  if (diff < 60_000) return t('just_now')
  if (diff < 3_600_000) return t('minutes_ago', Math.floor(diff / 60_000))
  if (diff < 86_400_000) return t('hours_ago', Math.floor(diff / 3_600_000))
  return t('days_ago', Math.floor(diff / 86_400_000))
}

// ─── VibeBar — overlaid on diagram canvas ────────────────────────────────────
const VIBES = [
  { key: 'clean',     icon: '☀️', label: 'Clean'     },
  { key: 'handdrawn', icon: '✏️', label: 'Handdrawn' },
  { key: 'cyberpunk', icon: '⚡', label: 'Cyberpunk' },
]

function VibeBar({ current, onChange }) {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 bg-white/85 backdrop-blur-sm rounded-lg border border-slate-200 p-0.5 shadow-sm">
      {VIBES.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            current === key
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {icon} <span className="hidden sm:inline ml-0.5">{label}</span>
        </button>
      ))}
    </div>
  )
}

function DiagnosticsPanel({ diagnostics }) {
  const t = useT()
  if (!diagnostics || diagnostics.length === 0) return null

  return (
    <div
      className="border-t px-3 py-2 text-xs space-y-0.5 font-mono overflow-auto"
      style={{
        maxHeight: 100,
        background: '#fef2f2',
        color: '#991b1b',
        borderColor: '#fca5a5',
      }}
    >
      {diagnostics.map((d, i) => (
        <div key={i} className="flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{t('line_prefix')} {d.line}: {d.msg}</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const { lang, setLang, t } = useI18n()

  // ─── Sessions state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions(sessionsKey(null))
    return saved.length ? saved : [createSession('')]
  })
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = loadSessions(sessionsKey(null))
    if (saved.length) {
      const storedId = localStorage.getItem(activeKey(null))
      return saved.find(s => s.id === storedId) ? storedId : saved[0].id
    }
    return null
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [editingSessionTitle, setEditingSessionTitle] = useState(false)
  const [sessionTitleDraft, setSessionTitleDraft] = useState('')
  const historyRef = useRef(null)

  // ─── Auth state ───────────────────────────────────────────────────────────
  const [user, setUser] = useState(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [anonToImport, setAnonToImport] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authDefaultTab, setAuthDefaultTab] = useState('login')
  const [authDefaultEmail, setAuthDefaultEmail] = useState('')

  useEffect(() => {
    // Cookie is sent automatically — no token needed in headers
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user)
        setAuthResolved(true)
      })
      .catch(() => { setAuthResolved(true) })
  }, [])

  function handleAuthSuccess({ user: u }) {
    // Cookie is set by the server — no client-side token storage needed
    setUser(u)
  }

  function handleVerifySuccess(updatedUser) {
    setUser(updatedUser)
  }

  async function handleLogout() {
    // Increment token_version server-side and clear the HttpOnly cookie
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    setUser(null)
    // sessions loading effect will re-run with user=null → loads anonymous sessions
  }

  function openAuthModal(tab = 'login', email = '') {
    setAuthDefaultTab(tab)
    setAuthDefaultEmail(email)
    setAuthOpen(true)
  }

  async function handleOpenVerify() {
    if (!user?.email) return
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      })
    } catch { /* ignore */ }
    openAuthModal('verify', user.email)
  }

  // ─── Other state ─────────────────────────────────────────────────────────
  const [ast, setAst] = useState(null)
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [remainingRequests, setRemainingRequests] = useState(null)
  const [examplesOpen, setExamplesOpen] = useState(false)
  const [dslRefOpen, setDslRefOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('editor')
  const [mobileView, setMobileView] = useState('chat')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const textareaRef = useRef(null)
  const exportRef = useRef(null)
  const accountRef = useRef(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

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
    if (isMobile) setMobileView('diagram')
  }, [updateCurrentSession, isMobile])

  const handleMessagesChange = useCallback((messages, chatHistory) => {
    updateCurrentSession({ messages, chatHistory })
  }, [updateCurrentSession])

  const handleNewSession = useCallback(() => {
    const s = createSession('', t('default_session_title'))
    setSessions(prev => [s, ...prev])
    setActiveSessionId(s.id)
    setHistoryOpen(false)
    setActiveTab('chat')
    setMobileView('chat')
    if (isPaid(user)) {
      postSessionToDB(s).catch(() => {})
    }
  }, [t, user])

  const handleSwitchSession = useCallback((id) => {
    setActiveSessionId(id)
    setHistoryOpen(false)
    setActiveTab('chat')
    setMobileView('chat')
  }, [])

  const handleNodeLabelChange = useCallback((idKey, newLabel) => {
    if (!ast) return
    const node = ast.nodes.find(n => n.id_key === idKey)
    if (!node) return
    updateCurrentSession({ dsl: rewriteNodeLabel(dsl, idKey, node.label, newLabel) })
  }, [ast, dsl, updateCurrentSession])

  const commitSessionTitle = useCallback(() => {
    const trimmed = sessionTitleDraft.trim()
    if (trimmed) updateCurrentSession({ title: trimmed, titleManual: true })
    setEditingSessionTitle(false)
  }, [sessionTitleDraft, updateCurrentSession])

  const handleImportAnon = useCallback(() => {
    if (!anonToImport?.length) return
    setSessions(prev => {
      const merged = [...anonToImport, ...prev]
      if (isPaid(user)) {
        anonToImport.forEach(s => postSessionToDB(s).catch(() => {}))
      }
      return merged
    })
    localStorage.removeItem(sessionsKey(null))
    localStorage.removeItem(activeKey(null))
    setAnonToImport(null)
  }, [anonToImport, user])

  const handleDeleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        const fresh = createSession('')
        setActiveSessionId(fresh.id)
        setHistoryOpen(false)
        if (isPaid(user)) {
          postSessionToDB(fresh).catch(() => {})
        }
        return [fresh]
      }
      if (id === activeSessionId) {
        setActiveSessionId(next[0].id)
      }
      return next
    })
    if (isPaid(user)) {
      deleteSessionFromDB(id).catch(() => {})
    }
  }, [activeSessionId, user])

  // ─── Vibe change ─────────────────────────────────────────────────────────
  const handleVibeChange = useCallback((key) => {
    const newDsl = dsl.replace(/^vibe\s*:.*$/m, `vibe: ${key}`)
    if (newDsl === dsl && !dsl.match(/^vibe\s*:/m)) {
      updateCurrentSession({ dsl: `vibe: ${key}\n` + dsl })
    } else {
      updateCurrentSession({ dsl: newDsl })
    }
  }, [dsl, updateCurrentSession])

  // ─── Load sessions when auth resolves / user changes ────────────────────
  useEffect(() => {
    if (!authResolved) return

    // Reset any pending import offer from a previous login
    setAnonToImport(null)

    // Anonymous sessions that have actual content (skip pristine empties)
    const anonSessions = user
      ? loadSessions(sessionsKey(null)).filter(s => s.dsl?.trim() || s.messages?.length)
      : []

    function clearAnonStore() {
      localStorage.removeItem(sessionsKey(null))
      localStorage.removeItem(activeKey(null))
    }

    if (!isPaid(user)) {
      const key = sessionsKey(user?.id)
      const saved = loadSessions(key)
      const storedActiveId = localStorage.getItem(activeKey(user?.id))

      if (saved.length) {
        setSessions(saved)
        setActiveSessionId(saved.find(s => s.id === storedActiveId) ? storedActiveId : saved[0].id)
        // Destination occupied: offer import as optional banner
        if (anonSessions.length) setAnonToImport(anonSessions)
      } else if (anonSessions.length) {
        // Destination empty: auto-migrate silently
        setSessions(anonSessions)
        setActiveSessionId(anonSessions[0].id)
        clearAnonStore()
      } else {
        const s = createSession('')
        setSessions([s])
        setActiveSessionId(s.id)
      }
    } else {
      setCloudLoading(true)
      fetch('/api/sessions')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setCloudLoading(false)
          const dbSessions = data?.sessions ?? []

          if (dbSessions.length) {
            setSessions(dbSessions)
            const storedActiveId = localStorage.getItem(activeKey(user.id))
            const found = dbSessions.find(s => s.id === storedActiveId)
            setActiveSessionId(found ? storedActiveId : dbSessions[0].id)
            // Destination occupied: offer import as optional banner
            if (anonSessions.length) setAnonToImport(anonSessions)
          } else if (anonSessions.length) {
            // Destination empty: auto-migrate silently to DB
            setSessions(anonSessions)
            setActiveSessionId(anonSessions[0].id)
            Promise.all(anonSessions.map(s => postSessionToDB(s))).catch(() => {})
            clearAnonStore()
          } else {
            const s = createSession('', t('default_session_title'))
            setSessions([s])
            setActiveSessionId(s.id)
            postSessionToDB(s).catch(() => {})
          }
        })
        .catch(() => {
          setCloudLoading(false)
          // Network error: fallback to localStorage
          const key = sessionsKey(user.id)
          const saved = loadSessions(key)
          const storedActiveId = localStorage.getItem(activeKey(user.id))
          if (saved.length) {
            setSessions(saved)
            setActiveSessionId(saved.find(s => s.id === storedActiveId) ? storedActiveId : saved[0].id)
            if (anonSessions.length) setAnonToImport(anonSessions)
          } else if (anonSessions.length) {
            setSessions(anonSessions)
            setActiveSessionId(anonSessions[0].id)
            clearAnonStore()
          } else {
            const s = createSession('')
            setSessions([s])
            setActiveSessionId(s.id)
          }
        })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved, user?.id, user?.plan])

  // ─── Persist sessions to localStorage (non-pro users) ────────────────────
  useEffect(() => {
    if (!authResolved || cloudLoading) return
    if (!isPaid(user)) {
      saveSessionsToStorage(sessions, sessionsKey(user?.id))
    }
  }, [sessions, user?.plan, user?.id, authResolved, cloudLoading])

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(activeKey(user?.id), activeSessionId)
  }, [activeSessionId, user?.id])

  // ─── Debounced sync to DB for pro/starter ────────────────────────────────
  useEffect(() => {
    if (!isPaid(user) || !currentSession || cloudLoading) return
    const snap = currentSession
    const timer = setTimeout(() => {
      putSessionToDB(snap).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.dsl, currentSession?.messages?.length, currentSession?.title, currentSession?.titleManual])

  // ─── Load example via /examples/:slug URL ────────────────────────────────
  useEffect(() => {
    const match = window.location.pathname.match(/^\/examples\/([^/]+)\/?$/)
    if (!match) return
    const ex = getExampleBySlug(match[1])
    window.history.replaceState(null, '', '/')
    if (!ex) return
    const s = createSession(ex.dsl)
    s.title = ex.title
    setSessions(prev => [s, ...prev])
    setActiveSessionId(s.id)
    setActiveTab('chat')
    setMobileView('chat')
  }, [])

  // ─── Shared DSL via URL hash ──────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash.startsWith('dsl=')) return
    try {
      const sharedDsl = decodeURIComponent(atob(hash.slice(4)))
      const s = createSession(sharedDsl)
      s.title = deriveTitle(sharedDsl, [], t('untitled'))
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      setActiveTab('chat')
      setMobileView('chat')
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // malformed hash — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load DSL from shared diagram "Edit this diagram" ────────────────────
  useEffect(() => {
    if (sessionStorage.getItem('skemly_new_session')) {
      sessionStorage.removeItem('skemly_new_session')
      const s = createSession('', t('default_session_title'))
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      setActiveTab('chat')
      setMobileView('chat')
      return
    }

    const raw = sessionStorage.getItem('skemly_edit_dsl')
    if (!raw) return
    sessionStorage.removeItem('skemly_edit_dsl')
    try {
      const { dsl: sharedDsl, title } = JSON.parse(raw)
      const s = createSession(sharedDsl)
      s.title = title || deriveTitle(sharedDsl, [], t('untitled'))
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      setActiveTab('chat')
      setMobileView('chat')
    } catch { /* malformed — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // ─── Auto-title (debounced 800ms) ─────────────────────────────────────────
  useEffect(() => {
    const sessionId = currentSession?.id
    const currentTitle = currentSession?.title
    const currentMessages = currentSession?.messages ?? []
    const timer = setTimeout(() => {
      if (!sessionId) return
      if (currentSession?.titleManual) return
      const newTitle = deriveTitle(dsl, currentMessages, t('untitled'))
      if (newTitle !== currentTitle) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, title: newTitle } : s
        ))
      }
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsl, currentSession?.messages?.length])

  // ─── Outside click closes menus ───────────────────────────────────────────
  useEffect(() => {
    if (!historyOpen) return
    function handleOutsideClick(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [historyOpen])

  useEffect(() => {
    if (!exportOpen) return
    function handleOutsideClick(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [exportOpen])

  useEffect(() => {
    if (!accountOpen) return
    function handleOutsideClick(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [accountOpen])

  // ─── Responsive breakpoint ────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ─── Parse DSL ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setAst(parseDSL(dsl))
    }, 150)
    return () => clearTimeout(timer)
  }, [dsl])

  const { layout: elkLayout, error: layoutError } = useLayout(ast)
  const themeName = ast?.directives?.vibe ?? 'clean'

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

    const isPaidSvg = user?.plan === 'pro' || user?.plan === 'starter'
    if (!isPaidSvg) {
      const wm = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      wm.setAttribute('x', String(svgW - 8))
      wm.setAttribute('y', String(svgH - 8))
      wm.setAttribute('text-anchor', 'end')
      wm.setAttribute('font-size', '11')
      wm.setAttribute('font-family', 'sans-serif')
      wm.setAttribute('fill', '#94a3b8')
      wm.setAttribute('opacity', '0.6')
      wm.textContent = 'Made with Skemly'
      svgClone.appendChild(wm)
    }

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgClone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${toFilename(currentSession?.title)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [ast, user, currentSession?.title])

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
    const isPaidPng = user?.plan === 'pro' || user?.plan === 'starter'
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, svgW, svgH)
      if (!isPaidPng) {
        ctx.font = '11px sans-serif'
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
        ctx.textAlign = 'right'
        ctx.fillText('Made with Skemly', svgW - 8, svgH - 8)
        ctx.textAlign = 'left'
      }
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.href = exportCanvas.toDataURL('image/png')
      a.download = `${toFilename(currentSession?.title)}.png`
      a.click()
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [ast, user, currentSession?.title])

  // ─── Copy DSL ─────────────────────────────────────────────────────────────
  const copyDSL = useCallback(async () => {
    await navigator.clipboard.writeText(dsl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [dsl])

  const allErrors = [
    ...(ast?.diagnostics ?? []),
    ...(layoutError ? [{ line: 0, msg: `${t('layout_error_prefix')}: ${layoutError}` }] : []),
  ]

  return (
    <div className="flex flex-col bg-slate-100" style={{ height: '100dvh' }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-slate-800">Skemly</span>
            <span className="text-xs opacity-50 hidden md:inline text-slate-800">v1.1</span>
          </div>
          <button
            onClick={() => setExamplesOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <BookOpen size={12} />
            <span className="hidden md:inline">{t('examples')}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Share */}
          <button
            onClick={shareDiagram}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            title={t('copy_shareable_link')}
          >
            {shared ? <Check size={12} /> : <Link size={12} />}
            <span>{shared ? t('copied') : t('share')}</span>
          </button>

          {/* Export dropdown */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(o => !o)}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown size={10} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg border z-50 overflow-hidden bg-white border-slate-200">
                {[
                  { label: t('copy_dsl'), icon: Copy, action: () => { copyDSL(); setExportOpen(false) } },
                  { label: 'SVG',         icon: Download, action: () => { exportSVG(); setExportOpen(false) } },
                  { label: 'PNG',         icon: Download, action: () => { exportPNG(); setExportOpen(false) } },
                ].map(({ label, icon: Icon, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account dropdown */}
          <div className="relative" ref={accountRef}>
            <button
              onClick={() => setAccountOpen(o => !o)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium ${user ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              {user ? (
                <>
                  <span className="max-w-[80px] truncate hidden sm:inline">
                    {user.name || user.email.split('@')[0]}
                  </span>
                  <ChevronDown size={10} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
                </>
              ) : (
                <span>{t('sign_in')}</span>
              )}
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-lg border z-50 overflow-hidden bg-white border-slate-200">
                <button
                  onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                >
                  <Globe size={11} />
                  {lang === 'en' ? 'Español' : 'English'}
                </button>
                <div className="border-t mx-2 border-slate-100" />
                {user ? (
                  <button
                    onClick={() => { handleLogout(); setAccountOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut size={11} />
                    {t('sign_out')}
                  </button>
                ) : (
                  <button
                    onClick={() => { openAuthModal('login'); setAccountOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-slate-700 hover:bg-slate-50"
                  >
                    <LogOut size={11} className="rotate-180" />
                    {t('sign_in')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Email verification banner ───────────────────────────────────── */}
      {user && !user.email_verified && (
        <div className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0 bg-yellow-50 border-b border-yellow-200 text-yellow-800">
          <span>{t('verify_email_banner')}</span>
          <button
            onClick={handleOpenVerify}
            className="underline font-medium ml-2 shrink-0 hover:opacity-70 transition-opacity"
          >
            {t('verify_now')}
          </button>
        </div>
      )}

      {/* ─── Anonymous import banner ─────────────────────────────────────── */}
      {anonToImport?.length > 0 && (
        <div className="flex items-center justify-between px-4 py-1.5 text-xs shrink-0 bg-blue-50 border-b border-blue-200 text-blue-800">
          <span>{t('anon_import_banner', anonToImport.length)}</span>
          <div className="flex items-center gap-3 ml-2 shrink-0">
            <button
              onClick={handleImportAnon}
              className="underline font-medium hover:opacity-70 transition-opacity"
            >
              {t('anon_import_btn')}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(sessionsKey(null))
                localStorage.removeItem(activeKey(null))
                setAnonToImport(null)
              }}
              className="opacity-50 hover:opacity-80 transition-opacity leading-none text-sm font-medium"
              title={t('anon_import_dismiss')}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {isMobile ? (
        /* ─── Mobile layout ──────────────────────────────────────────────── */
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Session bar */}
          <div className="relative shrink-0" ref={historyRef}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white border-slate-200">
              <div className="flex items-center gap-1 flex-1 min-w-0 mr-2 text-xs font-medium text-slate-800">
                {editingSessionTitle ? (
                  <input
                    autoFocus
                    value={sessionTitleDraft}
                    onChange={e => setSessionTitleDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitSessionTitle() }
                      if (e.key === 'Escape') setEditingSessionTitle(false)
                    }}
                    onBlur={commitSessionTitle}
                    className="flex-1 min-w-0 bg-transparent border-b outline-none truncate text-slate-800"
                    style={{ borderColor: 'currentColor' }}
                  />
                ) : (
                  <button
                    className="group flex items-center gap-1 min-w-0 opacity-70 hover:opacity-100 transition-opacity"
                    title={t('rename_diagram')}
                    onClick={() => {
                      setSessionTitleDraft(currentSession?.title ?? '')
                      setEditingSessionTitle(true)
                    }}
                  >
                    <span className="truncate">{currentSession?.title ?? t('default_session_title')}</span>
                    <Edit2 size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                )}
                <button
                  onClick={() => setHistoryOpen(o => !o)}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <ChevronDown size={11} />
                </button>
              </div>
              <button
                onClick={handleNewSession}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs shrink-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <Plus size={11} />
                {t('new_session_btn')}
              </button>
            </div>

            {historyOpen && (
              <div
                className="absolute top-full left-0 right-0 z-50 border-b shadow-lg overflow-y-auto bg-white border-slate-200"
                style={{ maxHeight: 240 }}
              >
                {cloudLoading ? (
                  <div className="px-3 py-3 text-xs text-slate-400 text-center">{t('loading_diagrams')}</div>
                ) : (
                  [...sessions]
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(session => (
                      <div
                        key={session.id}
                        onClick={() => handleSwitchSession(session.id)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-opacity text-slate-800 ${
                          session.id === (activeSessionId ?? sessions[0]?.id)
                            ? 'font-semibold bg-slate-100'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        {session.id === (activeSessionId ?? sessions[0]?.id) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                        )}
                        <span className="flex-1 truncate">{session.title}</span>
                        <span className="shrink-0 opacity-40 text-[10px]">{relativeTime(session.updatedAt, t)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteSession(session.id) }}
                          className="shrink-0 opacity-40 hover:opacity-100 leading-none text-sm font-medium ml-1"
                          title={t('delete_session')}
                        >
                          ×
                        </button>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Diagram tab — always mounted, shown/hidden for state preservation */}
          <div className={`flex-1 overflow-hidden relative ${mobileView !== 'diagram' ? 'hidden' : ''}`}>
            <DiagramRenderer
              ast={ast}
              elkLayout={elkLayout}
              svgRef={svgRef}
              canvasRef={canvasRef}
              onNodeLabelChange={handleNodeLabelChange}
              emptyHint={t('canvas_empty_hint')}
            />
            <VibeBar current={themeName} onChange={handleVibeChange} />
          </div>

          {/* Chat tab */}
          <div className={`flex flex-col flex-1 overflow-hidden ${mobileView !== 'chat' ? 'hidden' : ''}`}>
            <ChatPanel
              messages={currentSession?.messages ?? []}
              chatHistory={currentSession?.chatHistory ?? []}
              onMessagesChange={handleMessagesChange}
              onDslUpdate={handleDslUpdate}
              currentDsl={dsl}
              remainingRequests={remainingRequests}
              onRemainingChange={setRemainingRequests}
              key={activeSessionId ?? sessions[0]?.id}
            />
          </div>

          {/* DSL tab */}
          <div className={`flex flex-col flex-1 overflow-hidden ${mobileView !== 'dsl' ? 'hidden' : ''}`}>
            <textarea
              ref={textareaRef}
              value={dsl}
              onChange={e => updateCurrentSession({ dsl: e.target.value })}
              spellCheck={false}
              className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-white text-slate-900"
              style={{ lineHeight: '1.6', tabSize: 2 }}
              placeholder="Type your Skemly DSL here…"
            />
            <DiagnosticsPanel diagnostics={allErrors} />
            <div className="flex items-center justify-between px-3 py-1.5 text-xs border-t text-slate-800 bg-white border-slate-200">
              <span className="opacity-40">
                {ast?.nodes?.length ?? 0} nodes · {ast?.edges?.length ?? 0} edges · {ast?.groups?.length ?? 0} groups
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDslRefOpen(true)}
                  className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity"
                  title="Referencia DSL"
                >
                  <HelpCircle size={11} />
                  Referencia
                </button>
                <button
                  onClick={() => updateCurrentSession({ dsl: '' })}
                  className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity"
                  title="Clear DSL"
                >
                  <Trash2 size={11} />
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Bottom navigation */}
          <div className="flex shrink-0 border-t bg-white border-slate-200">
            {[
              { id: 'diagram', Icon: LayoutTemplate, labelKey: 'mobile_diagram' },
              { id: 'chat',    Icon: Bot,             labelKey: 'mobile_chat'    },
              { id: 'dsl',     Icon: Code2,           labelKey: 'mobile_code'   },
            ].map(({ id, Icon, labelKey }) => (
              <button
                key={id}
                onClick={() => setMobileView(id)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs transition-opacity text-slate-800 ${mobileView === id ? '' : 'opacity-40'}`}
              >
                <Icon size={18} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ─── Desktop / tablet split view ───────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="flex flex-col md:w-1/3 lg:w-2/5 min-w-[280px] max-w-[520px] shrink-0 border-r border-slate-200">

            {/* ─── Session header ─────────────────────────────────────────── */}
            <div className="relative shrink-0" ref={historyRef}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white border-slate-200">
                <div className="flex items-center gap-1 flex-1 min-w-0 mr-2 text-xs font-medium text-slate-800">
                  {editingSessionTitle ? (
                    <input
                      autoFocus
                      value={sessionTitleDraft}
                      onChange={e => setSessionTitleDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); commitSessionTitle() }
                        if (e.key === 'Escape') setEditingSessionTitle(false)
                      }}
                      onBlur={commitSessionTitle}
                      className="flex-1 min-w-0 bg-transparent border-b outline-none truncate text-slate-800"
                      style={{ borderColor: 'currentColor' }}
                    />
                  ) : (
                    <button
                      className="group flex items-center gap-1 min-w-0 opacity-70 hover:opacity-100 transition-opacity"
                      title={t('rename_diagram')}
                      onClick={() => {
                        setSessionTitleDraft(currentSession?.title ?? '')
                        setEditingSessionTitle(true)
                      }}
                    >
                      <span className="truncate">{currentSession?.title ?? t('default_session_title')}</span>
                      <Edit2 size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                  <button
                    onClick={() => setHistoryOpen(o => !o)}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>
                <button
                  onClick={handleNewSession}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs shrink-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={11} />
                  New
                </button>
              </div>

              {historyOpen && (
                <div
                  className="absolute top-full left-0 right-0 z-50 border-b shadow-lg overflow-y-auto bg-white border-slate-200"
                  style={{ maxHeight: 240 }}
                >
                  {cloudLoading ? (
                    <div className="px-3 py-3 text-xs text-slate-400 text-center">{t('loading_diagrams')}</div>
                  ) : (
                    [...sessions]
                      .sort((a, b) => b.updatedAt - a.updatedAt)
                      .map(session => (
                        <div
                          key={session.id}
                          onClick={() => handleSwitchSession(session.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-opacity text-slate-800 ${
                            session.id === (activeSessionId ?? sessions[0]?.id)
                              ? 'font-semibold bg-slate-100'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {session.id === (activeSessionId ?? sessions[0]?.id) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                          )}
                          <span className="flex-1 truncate">{session.title}</span>
                          <span className="shrink-0 opacity-40 text-[10px]">{relativeTime(session.updatedAt, t)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSession(session.id) }}
                            className="shrink-0 opacity-40 hover:opacity-100 leading-none text-sm font-medium ml-1"
                            title={t('delete_session')}
                          >
                            ×
                          </button>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Tab switcher */}
            <div className="flex border-b shrink-0 bg-white border-slate-200">
              <button
                onClick={() => setActiveTab('editor')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 text-slate-800 ${
                  activeTab === 'editor'
                    ? 'border-current'
                    : 'border-transparent opacity-40 hover:opacity-60'
                }`}
              >
                <Code2 size={12} />
                {t('tab_editor')}
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all border-b-2 text-slate-800 ${
                  activeTab === 'chat'
                    ? 'border-current'
                    : 'border-transparent opacity-40 hover:opacity-60'
                }`}
              >
                <MessageSquare size={12} />
                {t('tab_chat')}
              </button>
            </div>

            {/* Editor — always mounted, hidden when chat is active */}
            <div className={`flex flex-col flex-1 overflow-hidden ${activeTab === 'editor' ? '' : 'hidden'}`}>
              <textarea
                ref={textareaRef}
                value={dsl}
                onChange={e => updateCurrentSession({ dsl: e.target.value })}
                spellCheck={false}
                className="flex-1 p-3 font-mono text-sm resize-none outline-none bg-white text-slate-900"
                style={{ lineHeight: '1.6', tabSize: 2 }}
                placeholder={t('editor_placeholder')}
              />
              <DiagnosticsPanel diagnostics={allErrors} />
              <div className="flex items-center justify-between px-3 py-1.5 text-xs border-t text-slate-800 bg-white border-slate-200">
                <span className="opacity-40">
                  {ast?.nodes?.length ?? 0} {t('nodes')} · {ast?.edges?.length ?? 0} {t('edges')} · {ast?.groups?.length ?? 0} {t('groups')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDslRefOpen(true)}
                    className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity"
                    title={t('dsl_ref_title')}
                  >
                    <HelpCircle size={11} />
                    {t('reference')}
                  </button>
                  <button
                    onClick={() => updateCurrentSession({ dsl: '' })}
                    className="flex items-center gap-1 opacity-40 hover:opacity-80 transition-opacity"
                    title={t('clear')}
                  >
                    <Trash2 size={11} />
                    {t('clear')}
                  </button>
                </div>
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
              emptyHint={t('canvas_empty_hint')}
            />
            <VibeBar current={themeName} onChange={handleVibeChange} />
          </div>
        </div>
      )}

      <DslReferencePanel
        open={dslRefOpen}
        onClose={() => setDslRefOpen(false)}
      />

      <ExamplesPanel
        open={examplesOpen}
        onClose={() => setExamplesOpen(false)}
        onLoad={(newDsl) => {
          const s = createSession(newDsl)
          s.title = deriveTitle(newDsl, [], t('untitled'))
          setSessions(prev => [s, ...prev])
          setActiveSessionId(s.id)
          setExamplesOpen(false)
          setActiveTab('chat')
          setMobileView('chat')
        }}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onVerifySuccess={handleVerifySuccess}
        defaultTab={authDefaultTab}
        defaultEmail={authDefaultEmail}
      />
    </div>
  )
}
