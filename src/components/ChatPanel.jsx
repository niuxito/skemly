import { useState, useRef, useEffect, useCallback } from 'react'
import { callClaude, looksLikeDsl } from '../lib/chatApi.js'
import { Send, RotateCcw, AlertCircle, Bot, User, Paperclip, X, FileText, Image, Mic } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'

const FILE_MAX_SIZE = 2 * 1024 * 1024 // 2 MB — must match server default
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json'

function AttachmentPill({ name, mediaType, onRemove }) {
  const isImage = mediaType?.startsWith('image/')
  const Icon = isImage ? Image : FileText
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs max-w-[200px] bg-slate-200 text-slate-700">
      <Icon size={11} className="shrink-0" />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-slate-300"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

function MessageBubble({ msg, onReapply, onRetry }) {
  const t = useT()
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-2 items-start">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm space-y-1.5 bg-slate-800 text-white">
          {msg.attachment && (
            <AttachmentPill name={msg.attachment.name} mediaType={msg.attachment.mediaType} />
          )}
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <User size={16} className="mt-1 shrink-0 text-slate-500" />
      </div>
    )
  }

  if (msg.role === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <div className="flex-1 flex items-start justify-between gap-2">
          <span>{msg.content}</span>
          {msg.retryText && (
            <button
              onClick={() => onRetry?.(msg.retryText, msg.id, msg.retryAttachment)}
              className="shrink-0 flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100 transition-opacity"
            >
              <RotateCcw size={10} />
              {t('chat_retry')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // assistant
  return (
    <div className="flex gap-2 items-start">
      <Bot size={16} className="mt-1 shrink-0 text-slate-500" />
      <div className="max-w-[90%] rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-900">
        {msg.isDsl ? (
          <div className="space-y-2">
            <pre
              className="text-xs rounded p-2 overflow-auto font-mono bg-slate-800 text-green-400"
              style={{ maxHeight: 200 }}
            >
              <code>{msg.content}</code>
            </pre>
            <button
              onClick={() => onReapply(msg.content)}
              className="bg-slate-600 text-white hover:bg-slate-500 text-xs px-2 py-1 rounded"
            >
              <RotateCcw size={10} className="inline mr-1" />
              {t('chat_reapply')}
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

export default function ChatPanel({ messages, chatHistory, onMessagesChange, onDslUpdate, currentDsl, remainingRequests, onRemainingChange }) {
  const t = useT()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachError, setAttachError] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

  const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  const toggleMic = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) return

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRec()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = navigator.language
    recognitionRef.current = recognition

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.onresult = (e) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
      }
      if (finalText) {
        setInput(prev => {
          const separator = prev && !prev.endsWith(' ') ? ' ' : ''
          return prev + separator + finalText
        })
      }
    }

    recognition.start()
  }, [isListening])

  const handleReapply = useCallback((dsl) => {
    onDslUpdate(dsl)
  }, [onDslUpdate])

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!e.target) return
    e.target.value = ''
    if (!file) return

    setAttachError(null)

    if (file.size > FILE_MAX_SIZE) {
      setAttachError(t('chat_file_too_large', Math.round(FILE_MAX_SIZE / 1024 / 1024)))
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
      setAttachError(t('chat_file_read_error'))
    }
  }, [t])

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
      let errorText = t('chat_unknown_error')
      if (err instanceof TypeError) {
        errorText = t('chat_network_error')
      } else if (err?.message) {
        errorText = err.message
      }
      onMessagesChange(
        [...newMessages, { id: Date.now() + 2, role: 'error', content: errorText, retryText: text, retryAttachment: currentAttachment }],
        chatHistory
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, chatHistory, currentDsl, attachment, onDslUpdate, onMessagesChange])

  const handleRetry = useCallback(async (retryText, errorMsgId, retryAttachment) => {
    if (loading) return
    const messagesWithoutError = messages.filter(m => m.id !== errorMsgId)
    onMessagesChange(messagesWithoutError, chatHistory)
    setLoading(true)
    try {
      const { dsl: result, remaining } = await callClaude(retryText, chatHistory, currentDsl, retryAttachment ?? null)
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
      let errorText = t('chat_unknown_error')
      if (err instanceof TypeError) errorText = t('chat_network_error')
      else if (err?.message) errorText = err.message
      onMessagesChange(
        [...messagesWithoutError, { id: Date.now(), role: 'error', content: errorText, retryText, retryAttachment }],
        chatHistory
      )
    } finally {
      setLoading(false)
    }
  }, [loading, messages, chatHistory, currentDsl, onDslUpdate, onMessagesChange, onRemainingChange, t])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm mt-8 text-slate-500">
            <Bot size={28} className="mx-auto mb-2 opacity-40" />
            <p>{t('chat_empty_title')}</p>
            <p className="text-xs mt-1 opacity-70">{t('chat_empty_hint')}</p>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} onReapply={handleReapply} onRetry={handleRetry} />
        ))}
        {loading && (
          <div className="flex gap-2 items-center">
            <Bot size={16} className="shrink-0 text-slate-500" />
            <div className="rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-900">
              <span className="animate-pulse">{t('chat_thinking')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-3 py-2 border-slate-200">
        {attachment && (
          <div className="mb-1.5">
            <AttachmentPill
              name={attachment.name}
              mediaType={attachment.mediaType}
              onRemove={clearAttachment}
            />
          </div>
        )}
        {attachError && (
          <p className="text-xs text-red-500 mb-1">{attachError}</p>
        )}

        <div className="flex gap-2 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || !!attachment}
            title={t('chat_attach_tooltip')}
            className="shrink-0 p-2 rounded transition-colors disabled:opacity-30 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <Paperclip size={14} />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat_placeholder')}
            rows={2}
            disabled={loading}
            className="flex-1 resize-none rounded border px-2 py-1.5 text-sm outline-none font-mono transition-colors bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500"
            style={{ lineHeight: '1.5' }}
          />
          {hasSpeechAPI && (
            <button
              onClick={toggleMic}
              disabled={loading}
              title={isListening ? t('chat_mic_stop') : t('chat_mic_start')}
              className={`shrink-0 p-2 rounded transition-colors disabled:opacity-30 ${
                isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Mic size={14} />
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 p-2 rounded transition-colors bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-300"
          >
            <Send size={14} />
          </button>
        </div>
        {remainingRequests !== null && (
          <p className="text-center text-xs mt-1 text-slate-500 opacity-60">
            {t('chat_requests_remaining', remainingRequests)}
          </p>
        )}
      </div>
    </div>
  )
}
