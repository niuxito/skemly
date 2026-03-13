import { useState, useEffect, useRef, useCallback } from 'react'
import { LayoutGrid, Search, MoreVertical, ArrowLeft, Trash2, Copy, Edit2, ExternalLink } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth.js'
import { isPaid } from '../features/sessions/sessionHelpers.js'
import { sessionsKey, loadSessions, saveSessionsToStorage } from '../features/sessions/sessionStorage.js'
import { createSession } from '../features/sessions/sessionHelpers.js'
import { deleteSessionFromDB } from '../features/sessions/sessionApi.js'

// ─── Relative date (ES) ──────────────────────────────────────────────────────
function relativeDate(ts) {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'ahora'
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`
  if (diff < 2 * 86_400_000) return 'ayer'
  const d = new Date(ts)
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

// ─── Thumbnail display ───────────────────────────────────────────────────────
function ThumbnailPreview({ svgString }) {
  if (!svgString) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100">
        <LayoutGrid size={32} className="text-slate-300" />
      </div>
    )
  }

  // Encode SVG for use as img src — avoids XSS from dangerouslySetInnerHTML
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
  return (
    <img
      src={encoded}
      alt="Thumbnail"
      className="w-full h-full object-contain bg-slate-50"
      draggable={false}
    />
  )
}

// ─── Three-dot menu ──────────────────────────────────────────────────────────
function CardMenu({ onOpen, onRename, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  function action(fn) {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-500"
        title="Opciones"
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 rounded-lg shadow-lg border z-50 overflow-hidden bg-white border-slate-200">
          {[
            { label: 'Abrir',     Icon: ExternalLink, fn: onOpen      },
            { label: 'Renombrar', Icon: Edit2,         fn: onRename    },
            { label: 'Duplicar',  Icon: Copy,          fn: onDuplicate },
            { label: 'Eliminar',  Icon: Trash2,        fn: onDelete,   danger: true },
          ].map(({ label, Icon, fn, danger }) => (
            <button
              key={label}
              onClick={e => { e.stopPropagation(); action(fn) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-slate-50 ${danger ? 'text-red-600' : 'text-slate-700'}`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Gallery card ─────────────────────────────────────────────────────────────
function GalleryCard({ session, onOpen, onRename, onDuplicate, onDelete }) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function startRename() {
    setDraft(session.title)
    setRenaming(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== session.title) onRename(trimmed)
    setRenaming(false)
  }

  return (
    <div
      className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen()}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-slate-100" style={{ height: 160 }}>
        <ThumbnailPreview svgString={session.thumbnailSvg} />
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                if (e.key === 'Escape') setRenaming(false)
              }}
              className="w-full text-xs font-medium text-slate-800 bg-transparent border-b border-slate-400 outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <p className="text-xs font-medium text-slate-800 truncate">{session.title}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">{relativeDate(session.updatedAt)}</p>
        </div>
        <CardMenu
          onOpen={onOpen}
          onRename={startRename}
          onDuplicate={() => onDuplicate()}
          onDelete={() => onDelete()}
        />
      </div>
    </div>
  )
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────
function ConfirmDialog({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-5 w-80 mx-4">
        <p className="text-sm font-semibold text-slate-800 mb-1">Eliminar diagrama</p>
        <p className="text-xs text-slate-500 mb-4">
          ¿Eliminar <span className="font-medium text-slate-700">{title}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs rounded bg-red-600 text-white hover:bg-red-700"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main GalleryPage ─────────────────────────────────────────────────────────
export default function GalleryPage() {
  const { user, authResolved } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, title }

  // Load sessions on mount / when auth resolves
  useEffect(() => {
    if (!authResolved) return
    if (isPaid(user)) {
      setLoading(true)
      fetch('/api/sessions')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          setSessions(data?.sessions ?? [])
          setLoading(false)
        })
        .catch(() => {
          // Fallback to localStorage cache
          const key = sessionsKey(user.id)
          setSessions(loadSessions(key))
          setLoading(false)
        })
    } else {
      const key = sessionsKey(user?.id)
      setSessions(loadSessions(key))
      setLoading(false)
    }
  }, [authResolved, user?.id, user?.plan])

  // Persist non-paid sessions back to localStorage after mutations
  const persistLocally = useCallback((updated) => {
    if (!isPaid(user)) {
      const key = sessionsKey(user?.id)
      saveSessionsToStorage(updated, key)
    }
  }, [user])

  // ─── Actions ─────────────────────────────────────────────────────────────
  function openSession(session) {
    // Store the active session id in localStorage so App picks it up
    const activeKey = user?.id ? `vibediag_active_${user.id}` : 'vibediag_active'
    localStorage.setItem(activeKey, session.id)
    window.location.href = '/'
  }

  function renameSession(id, newTitle) {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s)
      persistLocally(updated)
      if (isPaid(user)) {
        // Fire-and-forget PUT with minimal body
        const session = updated.find(s => s.id === id)
        if (session) {
          fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: session.title,
              dsl: session.dsl,
              messages: session.messages ?? [],
              chatHistory: session.chatHistory ?? [],
              titleManual: true,
              thumbnailSvg: session.thumbnailSvg ?? null,
            }),
          }).catch(() => {})
        }
      }
      return updated
    })
  }

  function duplicateSession(id) {
    const orig = sessions.find(s => s.id === id)
    if (!orig) return
    const copy = createSession(orig.dsl, `${orig.title} (copia)`)
    copy.messages = orig.messages ?? []
    copy.chatHistory = orig.chatHistory ?? []
    copy.titleManual = true
    copy.thumbnailSvg = orig.thumbnailSvg ?? null
    setSessions(prev => {
      const updated = [copy, ...prev]
      persistLocally(updated)
      if (isPaid(user)) {
        fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: copy.id,
            title: copy.title,
            dsl: copy.dsl,
            messages: copy.messages,
            chatHistory: copy.chatHistory,
            titleManual: copy.titleManual,
            thumbnailSvg: copy.thumbnailSvg,
          }),
        }).catch(() => {})
      }
      return updated
    })
  }

  function requestDelete(id) {
    const s = sessions.find(sess => sess.id === id)
    if (!s) return
    setConfirmDelete({ id, title: s.title })
  }

  function confirmDeleteSession() {
    if (!confirmDelete) return
    const { id } = confirmDelete
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id)
      persistLocally(updated)
      return updated
    })
    if (isPaid(user)) {
      deleteSessionFromDB(id).catch(() => {})
    }
    setConfirmDelete(null)
  }

  // ─── Filtered & sorted sessions ──────────────────────────────────────────
  const filtered = [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver al editor</span>
          </a>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <LayoutGrid size={15} />
            Galería
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar diagramas…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors w-48 sm:w-64"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full">
        {!authResolved || loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-400">
            Cargando diagramas…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <LayoutGrid size={28} className="text-slate-300" />
            </div>
            {search ? (
              <>
                <p className="text-sm font-medium text-slate-600">Sin resultados</p>
                <p className="text-xs text-slate-400">Ningún diagrama coincide con <span className="font-medium">"{search}"</span></p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">No tienes diagramas guardados aún</p>
                <a
                  href="/"
                  className="mt-1 px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                >
                  Crear mi primer diagrama
                </a>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4">
              {filtered.length} {filtered.length === 1 ? 'diagrama' : 'diagramas'}
              {search && <> que coinciden con <span className="font-medium">"{search}"</span></>}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(session => (
                <GalleryCard
                  key={session.id}
                  session={session}
                  onOpen={() => openSession(session)}
                  onRename={(newTitle) => renameSession(session.id, newTitle)}
                  onDuplicate={() => duplicateSession(session.id)}
                  onDelete={() => requestDelete(session.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.title}
          onConfirm={confirmDeleteSession}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
