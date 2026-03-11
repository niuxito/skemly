import { useRef, useEffect } from 'react'
import { ChevronDown, Edit2, Plus } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'
import { relativeTime } from '../features/sessions/sessionHelpers.js'

export default function SessionBar({
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
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onCommitTitle,
  newLabel,
}) {
  const t = useT()
  const historyRef = useRef(null)

  useEffect(() => {
    if (!historyOpen) return
    function handleOutsideClick(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [historyOpen, setHistoryOpen])

  return (
    <div className="relative shrink-0" ref={historyRef}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-white border-slate-200">
        <div className="flex items-center gap-1 flex-1 min-w-0 mr-2 text-xs font-medium text-slate-800">
          {editingSessionTitle ? (
            <input
              autoFocus
              value={sessionTitleDraft}
              onChange={e => setSessionTitleDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); onCommitTitle() }
                if (e.key === 'Escape') setEditingSessionTitle(false)
              }}
              onBlur={onCommitTitle}
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
          onClick={onNewSession}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs shrink-0 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
        >
          <Plus size={11} />
          {newLabel ?? 'New'}
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
                  onClick={() => onSwitchSession(session.id)}
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
                    onClick={e => { e.stopPropagation(); onDeleteSession(session.id) }}
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
  )
}
