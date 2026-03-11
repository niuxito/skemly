import { useState, useCallback, useEffect, useRef } from 'react'
import { getExampleBySlug } from '../../lib/examples.js'
import { sessionsKey, activeKey, loadSessions, saveSessionsToStorage } from './sessionStorage.js'
import { isPaid, createSession, deriveTitle } from './sessionHelpers.js'
import { postSessionToDB, putSessionToDB, deleteSessionFromDB } from './sessionApi.js'

// Remove sessions with duplicate IDs (keep first occurrence)
function dedupe(sessions) {
  const seen = new Set()
  return sessions.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
}

export function useSessions({ user, authResolved, t }) {
  // ─── Sessions state ──────────────────────────────────────────────────────
  const [sessions, setSessions] = useState(() => {
    const saved = loadSessions(sessionsKey(null))
    return saved.length ? dedupe(saved) : [createSession('')]
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
  const [cloudLoading, setCloudLoading] = useState(false)
  const [anonToImport, setAnonToImport] = useState(null)
  // Tracks the user ID for which sessions have been freshly loaded.
  // Prevents the persist effect from saving stale initial sessions to the user key
  // before the load effect has had a chance to set the correct sessions.
  const loadedForUserRef = useRef(undefined)

  // ─── Derived values ──────────────────────────────────────────────────────
  const currentSession = sessions.find(s => s.id === activeSessionId) ?? sessions[0]

  // ─── Session update helper ───────────────────────────────────────────────
  const updateCurrentSession = useCallback((partial) => {
    setSessions(prev => {
      const id = (prev.find(s => s.id === activeSessionId) ?? prev[0])?.id
      if (!id) return prev
      return prev.map(s => s.id === id ? { ...s, ...partial, updatedAt: Date.now() } : s)
    })
  }, [activeSessionId])

  // ─── Session callbacks ───────────────────────────────────────────────────
  const handleNewSession = useCallback((onCreated) => {
    const s = createSession('', t('default_session_title'))
    setSessions(prev => [s, ...prev])
    setActiveSessionId(s.id)
    setHistoryOpen(false)
    if (typeof onCreated === 'function') onCreated()
    if (isPaid(user)) {
      postSessionToDB(s).catch(() => {})
    }
  }, [t, user])

  const handleSwitchSession = useCallback((id, onSwitched) => {
    setActiveSessionId(id)
    setHistoryOpen(false)
    if (typeof onSwitched === 'function') onSwitched()
  }, [])

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

  const commitSessionTitle = useCallback(() => {
    const trimmed = sessionTitleDraft.trim()
    if (trimmed) updateCurrentSession({ title: trimmed, titleManual: true })
    setEditingSessionTitle(false)
  }, [sessionTitleDraft, updateCurrentSession])

  const handleImportAnon = useCallback(() => {
    if (!anonToImport?.length) return
    setSessions(prev => {
      const prevIds = new Set(prev.map(s => s.id))
      const newOnes = anonToImport.filter(s => !prevIds.has(s.id))
      const merged = [...newOnes, ...prev]
      if (isPaid(user)) {
        newOnes.forEach(s => postSessionToDB(s).catch(() => {}))
      }
      return merged
    })
    localStorage.removeItem(sessionsKey(null))
    localStorage.removeItem(activeKey(null))
    setAnonToImport(null)
  }, [anonToImport, user])

  const dismissAnonImport = useCallback(() => {
    localStorage.removeItem(sessionsKey(null))
    localStorage.removeItem(activeKey(null))
    setAnonToImport(null)
  }, [])

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
      const saved = dedupe(loadSessions(key))
      const storedActiveId = localStorage.getItem(activeKey(user?.id))

      loadedForUserRef.current = user?.id
      if (saved.length) {
        setSessions(saved)
        setActiveSessionId(saved.find(s => s.id === storedActiveId) ? storedActiveId : saved[0].id)
        // Destination occupied: offer import as optional banner
        if (anonSessions.length) setAnonToImport(anonSessions)
      } else if (anonSessions.length) {
        // Destination empty: auto-migrate silently
        setSessions(dedupe(anonSessions))
        setActiveSessionId(anonSessions[0].id)
        clearAnonStore()
      } else {
        const s = createSession('')
        setSessions([s])
        setActiveSessionId(s.id)
      }
    } else {
      loadedForUserRef.current = user?.id
      setCloudLoading(true)
      fetch('/api/sessions')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setCloudLoading(false)
          const dbSessions = data?.sessions ?? []

          if (dbSessions.length) {
            setSessions(dedupe(dbSessions))
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

  // ─── Persist sessions to localStorage (non-pro users) ───────────────────
  useEffect(() => {
    if (!authResolved || cloudLoading) return
    // Skip if sessions haven't been loaded yet for this user to avoid overwriting
    // the user's stored sessions with stale initial state.
    if (loadedForUserRef.current !== user?.id) return
    if (!isPaid(user)) {
      saveSessionsToStorage(sessions, sessionsKey(user?.id))
    }
  }, [sessions, user?.plan, user?.id, authResolved, cloudLoading])

  useEffect(() => {
    if (activeSessionId) localStorage.setItem(activeKey(user?.id), activeSessionId)
  }, [activeSessionId, user?.id])

  // ─── Debounced sync to DB for pro/starter ───────────────────────────────
  useEffect(() => {
    if (!isPaid(user) || !currentSession || cloudLoading) return
    const snap = currentSession
    const timer = setTimeout(() => {
      putSessionToDB(snap).catch(() => {})
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.dsl, currentSession?.messages?.length, currentSession?.title, currentSession?.titleManual])

  // ─── Load example via /examples/:slug URL ───────────────────────────────
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
  }, [])

  // ─── Shared DSL via URL hash ─────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash.startsWith('dsl=')) return
    try {
      const sharedDsl = decodeURIComponent(atob(hash.slice(4)))
      const s = createSession(sharedDsl)
      s.title = deriveTitle(sharedDsl, [], t('untitled'))
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // malformed hash — ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load DSL from shared diagram "Edit this diagram" ───────────────────
  useEffect(() => {
    if (sessionStorage.getItem('skemly_new_session')) {
      sessionStorage.removeItem('skemly_new_session')
      const s = createSession('', t('default_session_title'))
      setSessions(prev => [s, ...prev])
      setActiveSessionId(s.id)
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
    } catch { /* malformed — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Auto-title (debounced 800ms) ────────────────────────────────────────
  useEffect(() => {
    const sessionId = currentSession?.id
    const currentTitle = currentSession?.title
    const currentMessages = currentSession?.messages ?? []
    const dsl = currentSession?.dsl ?? ''
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
  }, [currentSession?.dsl, currentSession?.messages?.length])

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    currentSession,
    historyOpen,
    setHistoryOpen,
    editingSessionTitle,
    setEditingSessionTitle,
    sessionTitleDraft,
    setSessionTitleDraft,
    cloudLoading,
    anonToImport,
    updateCurrentSession,
    handleNewSession,
    handleSwitchSession,
    handleDeleteSession,
    commitSessionTitle,
    handleImportAnon,
    dismissAnonImport,
  }
}
