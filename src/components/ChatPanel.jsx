import { useState, useRef, useEffect, useCallback } from 'react'
import { callClaude, looksLikeDsl } from '../lib/chatApi.js'
import { Send, RotateCcw, AlertCircle, Bot, User, Paperclip, X, FileText, Image } from 'lucide-react'

const FILE_MAX_SIZE = 2 * 1024 * 1024 // 2 MB — must match server default
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json'

const THEME_TOKENS = {
  clean: {
    bg: 'bg-white',
    text: 'text-slate-800',
    subtext: 'text-slate-500',
    input: 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500',
    sendBtn: 'bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-300',
    attachBtn: 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
    userBubble: 'bg-slate-800 text-white',
    assistantBubble: 'bg-slate-100 text-slate-900',
    errorBubble: 'bg-red-50 text-red-700 border border-red-200',
    code: 'bg-slate-800 text-green-400',
    reapplyBtn: 'bg-slate-600 text-white hover:bg-slate-500 text-xs px-2 py-1 rounded',
    border: 'border-slate-200',
    pill: 'bg-slate-200 text-slate-700',
    pillRemove: 'hover:bg-slate-300',
  },
  handdrawn: {
    bg: 'bg-amber-50',
    text: 'text-stone-800',
    subtext: 'text-stone-500',
    input: 'bg-amber-100 border-amber-300 text-stone-900 placeholder-stone-400 focus:border-amber-500',
    sendBtn: 'bg-stone-800 text-white hover:bg-stone-700 disabled:bg-stone-300',
    attachBtn: 'text-stone-400 hover:text-stone-600 hover:bg-amber-200',
    userBubble: 'bg-stone-800 text-white',
    assistantBubble: 'bg-amber-100 text-stone-900',
    errorBubble: 'bg-red-50 text-red-700 border border-red-200',
    code: 'bg-stone-800 text-amber-300',
    reapplyBtn: 'bg-stone-600 text-white hover:bg-stone-500 text-xs px-2 py-1 rounded',
    border: 'border-amber-200',
    pill: 'bg-amber-200 text-stone-700',
    pillRemove: 'hover:bg-amber-300',
  },
  cyberpunk: {
    bg: 'bg-gray-950',
    text: 'text-cyan-300',
    subtext: 'text-cyan-600',
    input: 'bg-gray-900 border-cyan-800 text-cyan-100 placeholder-cyan-700 focus:border-cyan-500',
    sendBtn: 'bg-cyan-500 text-black hover:bg-cyan-400 disabled:bg-cyan-900 disabled:text-cyan-700',
    attachBtn: 'text-cyan-700 hover:text-cyan-400 hover:bg-gray-800',
    userBubble: 'bg-cyan-900 text-cyan-100',
    assistantBubble: 'bg-gray-900 text-cyan-200',
    errorBubble: 'bg-red-950 text-red-400 border border-red-800',
    code: 'bg-gray-950 text-green-400',
    reapplyBtn: 'bg-cyan-700 text-black hover:bg-cyan-600 text-xs px-2 py-1 rounded',
    border: 'border-cyan-900',
    pill: 'bg-cyan-900 text-cyan-300',
    pillRemove: 'hover:bg-cyan-800',
  },
}

function AttachmentPill({ name, mediaType, onRemove, tk }) {
  const isImage = mediaType?.startsWith('image/')
  const Icon = isImage ? Image : FileText
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs max-w-[200px] ${tk.pill}`}>
      <Icon size={11} className="shrink-0" />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className={`shrink-0 rounded-full p-0.5 transition-colors ${tk.pillRemove}`}
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

function MessageBubble({ msg, onReapply, onRetry, tk }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2 items-start">
        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm space-y-1.5 ${tk.userBubble}`}>
          {msg.attachment && (
            <AttachmentPill name={msg.attachment.name} mediaType={msg.attachment.mediaType} tk={tk} />
          )}
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <User size={16} className={`mt-1 shrink-0 ${tk.subtext}`} />
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${tk.errorBubble}`}>
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <div className="flex-1 flex items-start justify-between gap-2">
          <span>{msg.content}</span>
          {msg.retryText && (
            <button
              onClick={() => onRetry?.(msg.retryText, msg.id)}
              className="shrink-0 flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100 transition-opacity"
            >
              <RotateCcw size={10} />
              Reintentar
            </button>
          )}
        </div>
      </div>
    )
  }

  // assistant
  return (
    <div className="flex gap-2 items-start">
      <Bot size={16} className={`mt-1 shrink-0 ${tk.subtext}`} />
      <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${tk.assistantBubble}`}>
        {msg.isDsl ? (
          <div className="space-y-2">
            <pre
              className={`text-xs rounded p-2 overflow-auto font-mono ${tk.code}`}
              style={{ maxHeight: 200 }}
            >
              <code>{msg.content}</code>
            </pre>
            <button
              onClick={() => onReapply(msg.content)}
              className={tk.reapplyBtn}
            >
              <RotateCcw size={10} className="inline mr-1" />
              Re-apply
            </button>
          </div>
        ) : (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        )}
      </div>
    </div>
  )
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:<mediaType>;base64,<data>" — strip the prefix
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export default function ChatPanel({ messages, chatHistory, onMessagesChange, onDslUpdate, currentDsl, theme, remainingRequests, onRemainingChange }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachment, setAttachment] = useState(null) // { name, mediaType, data/text, size, isText }
  const [attachError, setAttachError] = useState(null)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const tk = THEME_TOKENS[theme] ?? THEME_TOKENS.clean

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleReapply = useCallback((dsl) => {
    onDslUpdate(dsl)
  }, [onDslUpdate])

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!e.target) return
    e.target.value = '' // reset so same file can be re-selected
    if (!file) return

    setAttachError(null)

    if (file.size > FILE_MAX_SIZE) {
      setAttachError(`El fichero es demasiado grande (máx. ${Math.round(FILE_MAX_SIZE / 1024 / 1024)} MB).`)
      return
    }

    const isText = file.type.startsWith('text/') || file.type === 'application/json'

    try {
      if (isText) {
        const text = await readFileAsText(file)
        setAttachment({ name: file.name, mediaType: file.type || 'text/plain', text, size: file.size, isText: true })
      } else {
        const data = await readFileAsBase64(file)
        setAttachment({ name: file.name, mediaType: file.type, data, size: file.size, isText: false })
      }
    } catch {
      setAttachError('No se pudo leer el fichero.')
    }
  }, [])

  const clearAttachment = useCallback(() => {
    setAttachment(null)
    setAttachError(null)
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const currentAttachment = attachment
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      attachment: currentAttachment ? { name: currentAttachment.name, mediaType: currentAttachment.mediaType } : null,
    }
    const newMessages = [...messages, userMsg]
    onMessagesChange(newMessages, chatHistory)
    setInput('')
    setAttachment(null)
    setAttachError(null)
    setLoading(true)

    try {
      const { dsl: result, remaining } = await callClaude(text, chatHistory, currentDsl, currentAttachment)
      const isDsl = looksLikeDsl(result)

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result,
        isDsl,
      }
      const newHistory = [
        ...chatHistory.slice(-10),
        { role: 'user', content: text },
        { role: 'assistant', content: result },
      ]
      onMessagesChange([...newMessages, assistantMsg], newHistory)

      if (remaining !== null) onRemainingChange?.(remaining)
      if (isDsl) {
        onDslUpdate(result)
      }
    } catch (err) {
      let errorText = 'Unknown error'
      if (err instanceof TypeError) {
        errorText = 'Network error — check your connection'
      } else if (err?.message) {
        errorText = err.message
      }
      onMessagesChange(
        [...newMessages, { id: Date.now() + 2, role: 'error', content: errorText, retryText: text }],
        chatHistory
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, chatHistory, currentDsl, attachment, onDslUpdate, onMessagesChange])

  const handleRetry = useCallback(async (retryText, errorMsgId) => {
    if (loading) return
    const messagesWithoutError = messages.filter(m => m.id !== errorMsgId)
    onMessagesChange(messagesWithoutError, chatHistory)
    setLoading(true)
    try {
      const { dsl: result, remaining } = await callClaude(retryText, chatHistory, currentDsl)
      const isDsl = looksLikeDsl(result)
      const assistantMsg = { id: Date.now(), role: 'assistant', content: result, isDsl }
      const newHistory = [
        ...chatHistory.slice(-10),
        { role: 'user', content: retryText },
        { role: 'assistant', content: result },
      ]
      onMessagesChange([...messagesWithoutError, assistantMsg], newHistory)
      if (remaining !== null) onRemainingChange?.(remaining)
      if (isDsl) onDslUpdate(result)
    } catch (err) {
      let errorText = 'Unknown error'
      if (err instanceof TypeError) errorText = 'Network error — check your connection'
      else if (err?.message) errorText = err.message
      onMessagesChange(
        [...messagesWithoutError, { id: Date.now(), role: 'error', content: errorText, retryText }],
        chatHistory
      )
    } finally {
      setLoading(false)
    }
  }, [loading, messages, chatHistory, currentDsl, onDslUpdate, onMessagesChange, onRemainingChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className={`flex flex-col h-full ${tk.bg}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className={`text-center text-sm mt-8 ${tk.subtext}`}>
            <Bot size={28} className="mx-auto mb-2 opacity-40" />
            <p>Describe the diagram you want to create.</p>
            <p className="text-xs mt-1 opacity-70">e.g. "Create an architecture diagram with a load balancer and two app servers"</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onReapply={handleReapply} onRetry={handleRetry} tk={tk} />
        ))}
        {loading && (
          <div className="flex gap-2 items-center">
            <Bot size={16} className={`shrink-0 ${tk.subtext}`} />
            <div className={`rounded-lg px-3 py-2 text-sm ${tk.assistantBubble}`}>
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={`border-t px-3 py-2 ${tk.border}`}>
        {/* Attachment pill */}
        {attachment && (
          <div className="mb-1.5">
            <AttachmentPill
              name={attachment.name}
              mediaType={attachment.mediaType}
              onRemove={clearAttachment}
              tk={tk}
            />
          </div>
        )}
        {/* Attach error */}
        {attachError && (
          <p className="text-xs text-red-500 mb-1">{attachError}</p>
        )}

        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || !!attachment}
            title="Adjuntar fichero (imágenes, PDF, texto)"
            className={`shrink-0 p-2 rounded transition-colors disabled:opacity-30 ${tk.attachBtn}`}
          >
            <Paperclip size={14} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a diagram… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={loading}
            className={`flex-1 resize-none rounded border px-2 py-1.5 text-sm outline-none font-mono transition-colors ${tk.input}`}
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`shrink-0 p-2 rounded transition-colors ${tk.sendBtn}`}
          >
            <Send size={14} />
          </button>
        </div>
        {remainingRequests !== null && (
          <p className={`text-center text-xs mt-1 ${tk.subtext} opacity-60`}>
            {remainingRequests} solicitudes restantes hoy
          </p>
        )}
      </div>
    </div>
  )
}
