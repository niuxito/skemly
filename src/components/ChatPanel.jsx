import { useState, useRef, useEffect, useCallback } from 'react'
import { callClaude, looksLikeDsl } from '../lib/chatApi.js'
import { Send, RotateCcw, AlertCircle, Bot, User } from 'lucide-react'

const THEME_TOKENS = {
  clean: {
    bg: 'bg-white',
    text: 'text-slate-800',
    subtext: 'text-slate-500',
    input: 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500',
    sendBtn: 'bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-300',
    userBubble: 'bg-slate-800 text-white',
    assistantBubble: 'bg-slate-100 text-slate-900',
    errorBubble: 'bg-red-50 text-red-700 border border-red-200',
    code: 'bg-slate-800 text-green-400',
    reapplyBtn: 'bg-slate-600 text-white hover:bg-slate-500 text-xs px-2 py-1 rounded',
    border: 'border-slate-200',
  },
  handdrawn: {
    bg: 'bg-amber-50',
    text: 'text-stone-800',
    subtext: 'text-stone-500',
    input: 'bg-amber-100 border-amber-300 text-stone-900 placeholder-stone-400 focus:border-amber-500',
    sendBtn: 'bg-stone-800 text-white hover:bg-stone-700 disabled:bg-stone-300',
    userBubble: 'bg-stone-800 text-white',
    assistantBubble: 'bg-amber-100 text-stone-900',
    errorBubble: 'bg-red-50 text-red-700 border border-red-200',
    code: 'bg-stone-800 text-amber-300',
    reapplyBtn: 'bg-stone-600 text-white hover:bg-stone-500 text-xs px-2 py-1 rounded',
    border: 'border-amber-200',
  },
  cyberpunk: {
    bg: 'bg-gray-950',
    text: 'text-cyan-300',
    subtext: 'text-cyan-600',
    input: 'bg-gray-900 border-cyan-800 text-cyan-100 placeholder-cyan-700 focus:border-cyan-500',
    sendBtn: 'bg-cyan-500 text-black hover:bg-cyan-400 disabled:bg-cyan-900 disabled:text-cyan-700',
    userBubble: 'bg-cyan-900 text-cyan-100',
    assistantBubble: 'bg-gray-900 text-cyan-200',
    errorBubble: 'bg-red-950 text-red-400 border border-red-800',
    code: 'bg-gray-950 text-green-400',
    reapplyBtn: 'bg-cyan-700 text-black hover:bg-cyan-600 text-xs px-2 py-1 rounded',
    border: 'border-cyan-900',
  },
}

function MessageBubble({ msg, onReapply, tk }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2 items-start">
        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${tk.userBubble}`}>
          {msg.content}
        </div>
        <User size={16} className={`mt-1 shrink-0 ${tk.subtext}`} />
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${tk.errorBubble}`}>
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span>{msg.content}</span>
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

export default function ChatPanel({ messages, chatHistory, onMessagesChange, onDslUpdate, currentDsl, theme }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const tk = THEME_TOKENS[theme] ?? THEME_TOKENS.clean

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleReapply = useCallback((dsl) => {
    onDslUpdate(dsl)
  }, [onDslUpdate])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { id: Date.now(), role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    onMessagesChange(newMessages, chatHistory) // optimistic user bubble
    setInput('')
    setLoading(true)

    try {
      const result = await callClaude(text, chatHistory, currentDsl)
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
        [...newMessages, { id: Date.now() + 2, role: 'error', content: errorText }],
        chatHistory
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, chatHistory, currentDsl, onDslUpdate, onMessagesChange])

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
          <MessageBubble key={msg.id} msg={msg} onReapply={handleReapply} tk={tk} />
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
        <div className="flex gap-2 items-end">
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
      </div>
    </div>
  )
}
