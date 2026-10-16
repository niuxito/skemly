// ─── Client-side prompt injection detection ───────────────────────────────────
// Mirrors api/_promptGuard.js — fast early rejection before any network call.
const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+|these\s+)?instructions?\b/i,
  /\bforget\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+|these\s+)?instructions?\b/i,
  /\bdisregard\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+)?instructions?\b/i,
  /\boverride\s+(all\s+)?(your\s+|previous\s+|the\s+|above\s+)?instructions?\b/i,
  /\byour\s+(system\s+)?prompt\b/i,
  /\byou\s+are\s+now\s+/i,
  /\bpretend\s+(to\s+be|you\s+(are|were))\b/i,
  /\bnew\s+(role|task|persona|identity|directive)\s*[:\-]/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
  /\bdon['']?t\s+(return|output|generate|create|make|produce|give)\s+(a\s+|any\s+)?(diagram|dsl|chart|graph|visual)\b/i,
  /\bskip\s+(the\s+)?(diagram|dsl)\b/i,
  /\binstead\s+of\s+(a\s+|the\s+)?(diagram|dsl)\b/i,
  /\b(reveal|show|print|output|expose|leak|display)\s+(me\s+)?(your\s+|the\s+)?(system\s+prompt|instructions|rules|directives|training)\b/i,
  /\bwhat\s+(are\s+)?(your|the)\s+(instructions|rules|system\s+prompt|directives)\b/i,
  /\brepeat\s+(your\s+|the\s+)?(system\s+prompt|instructions|above)\b/i,
  /\bignora\s+(todas?\s+)?(tus\s+|mis\s+|las\s+|estas\s+)?instrucciones?\b/i,
  /\bolvida\s+(todas?\s+)?(tus\s+|las\s+)?instrucciones?\b/i,
  /\bignora\s+(lo\s+anterior|lo\s+de\s+arriba|el\s+sistema)\b/i,
  /\btu\s+(system\s+)?prompt\b/i,
  /\bno\s+(me\s+)?devuelvas?\s+(un\s+|el\s+|ningún\s+)?(diagrama|dsl|gráfico|grafico)\b/i,
  /\bno\s+(me\s+)?generes?\s+(un\s+|el\s+|ningún\s+)?(diagrama|dsl|gráfico|grafico)\b/i,
  /\bsin\s+(diagrama|dsl|gráfico)\b/i,
  /\bahora\s+eres\b/i,
  /\bactúa\s+como\b/i,
  /\bfinge\s+(ser|que\s+eres)\b/i,
  /\bnueva\s+(tarea|instrucción|instruccion|misión|mision|función|funcion|orden)\s*[:\-]/i,
  /\b(revela|muestra|imprime|enseña|expón)\s+(me\s+)?(tus\s+|las\s+)?(instrucciones|sistema|prompt|reglas)\b/i,
  /\bcuáles\s+son\s+tus\s+(instrucciones|reglas|normas)\b/i,
]

export function detectInjection(text) {
  if (!text || typeof text !== 'string') return false
  return INJECTION_PATTERNS.some(p => p.test(text))
}

function stripFences(text) {
  // Remove ```vibe, ```vibedraw, ``` fences
  return text
    .replace(/^```(?:vibe|vibedraw)?\s*\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim()
}

export function looksLikeDsl(text) {
  return /[\[\]()<>?]|^(vibe|layout|spacing|edgeLabels|group)\s*:/m.test(text)
}

async function callAnthropicProxy(body) {
  return fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Prompt enhancer ──────────────────────────────────────────────────────────
// Calls /api/enhance-prompt with a strict timeout and falls back to the
// original prompt on any error/timeout. Returns null when the enhancement
// should be skipped (e.g. DSL-like input, attachment present, too short).
const ENHANCE_TIMEOUT_MS = 5000
const ENHANCE_MIN_LEN = 15

export async function enhancePrompt(userPrompt, { lang = 'es', signal } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ENHANCE_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })

  try {
    const res = await fetch('/api/chat?op=enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ op: 'enhance', userPrompt, lang }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const enhanced = data?.enhanced
    if (typeof enhanced !== 'string' || enhanced.length < ENHANCE_MIN_LEN) return null
    return enhanced
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function shouldEnhance({ userMessage, hasAttachment, autoEnhance }) {
  // The enhancer adds value whenever the prompt is a vague natural-language
  // request. We deliberately don't gate on isFirstShot because users often
  // type a fresh generative prompt on top of an existing diagram, and that
  // is exactly the case where refinement pays off.
  if (!autoEnhance) return false
  if (hasAttachment) return false
  if (typeof userMessage !== 'string') return false
  if (userMessage.length < ENHANCE_MIN_LEN) return false
  if (looksLikeDsl(userMessage)) return false
  return true
}

export async function callClaude(userMessage, chatHistory, currentDsl, attachment = null, options = {}) {
  const { autoEnhance = false, lang = 'es', onPhase = null } = options

  // ── Client-side injection guard (immediate, no network call) ───────────────
  if (detectInjection(userMessage)) {
    throw new Error('El mensaje contiene instrucciones que intentan modificar el comportamiento del asistente. Por favor, reformula tu petición.')
  }

  const contextBlock = currentDsl
    ? `Current diagram DSL:\n\`\`\`\n${currentDsl}\n\`\`\`\n\n`
    : ''

  const isFirstShot = chatHistory.length === 0 && !currentDsl

  // Optionally enhance the prompt before sending to /api/chat.
  // Pure best-effort: any failure falls back to the original userMessage.
  let enhancedPrompt = null
  if (shouldEnhance({ userMessage, hasAttachment: !!attachment, autoEnhance })) {
    onPhase?.('enhancing')
    const enhanced = await enhancePrompt(userMessage, { lang })
    if (enhanced && enhanced !== userMessage) enhancedPrompt = enhanced
  }
  onPhase?.('generating')

  const effectivePrompt = enhancedPrompt ?? userMessage

  // Wrap user content to clearly delimit untrusted input for the model
  const augmentedMessage = `${contextBlock}<user_request>\n${effectivePrompt}\n</user_request>`

  const messages = [
    ...chatHistory.slice(-5),
    { role: 'user', content: augmentedMessage },
  ]

  // The server sets the model, system prompt and max_tokens
  const body = {
    messages,
    isFirstShot,
    ...(attachment ? { attachment } : {}),
  }

  const response = await callAnthropicProxy(body)

  if (!response.ok) {
    // Special handling for our IP rate limit 429
    if (response.status === 429 || response.status === 400) {
      let errBody
      try { errBody = await response.json() } catch { /* ignore */ }

      if (errBody?.error?.type === 'rate_limit_exceeded') {
        const resetAt = new Date(errBody.error.reset_at)
        const diffMs = resetAt - Date.now()
        const diffH = Math.floor(diffMs / 3_600_000)
        const diffM = Math.floor((diffMs % 3_600_000) / 60_000)
        const timeStr = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`
        throw new Error(
          `Has alcanzado el límite diario (${errBody.error.limit} solicitudes). Podrás volver a usar el asistente a las 00:00 UTC (en ${timeStr}).`
        )
      }

      if (errBody?.error?.type === 'file_rate_limit_exceeded') {
        const resetAt = new Date(errBody.error.reset_at)
        const diffMs = resetAt - Date.now()
        const diffH = Math.floor(diffMs / 3_600_000)
        const diffM = Math.floor((diffMs % 3_600_000) / 60_000)
        const timeStr = diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`
        throw new Error(
          `Has alcanzado el límite diario de ficheros adjuntos (${errBody.error.limit}/día). Podrás adjuntar más a las 00:00 UTC (en ${timeStr}).`
        )
      }

      if (errBody?.error?.type === 'file_too_large') {
        throw new Error(errBody.error.message)
      }

      // Server-side injection detection (bypassed client guard)
      if (errBody?.error?.type === 'prompt_injection_detected') {
        throw new Error(errBody.error.message)
      }

      // Anthropic API errors forwarded from proxy (e.g. PDF too many pages)
      if (errBody?.error?.message) {
        throw new Error(`Error al procesar el fichero: ${errBody.error.message}`)
      }
    }

    const friendlyErrors = {
      429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
      503: 'El asistente no está disponible temporalmente. Inténtalo en unos segundos.',
    }
    const msg = friendlyErrors[response.status]
      ?? (response.status >= 500
          ? 'El asistente no está disponible en este momento.'
          : 'No se pudo procesar la solicitud. Inténtalo de nuevo.')
    throw new Error(msg)
  }

  const remainingHeader = response.headers.get('X-RateLimit-Remaining')
  const remaining = remainingHeader !== null ? parseInt(remainingHeader, 10) : null

  const data = await response.json()
  const rawText = data?.content?.[0]?.text ?? ''
  let dsl = stripFences(rawText)

  // ── Output validation: if response doesn't look like DSL, retry once ───────
  if (!looksLikeDsl(dsl)) {
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: rawText },
      { role: 'user', content: 'Your previous response was not valid DSL. You MUST respond with only DSL code — no explanations, no plain text.' },
    ]
    const retryResponse = await callAnthropicProxy({ ...body, messages: retryMessages, isFirstShot: false })
    if (retryResponse.ok) {
      const retryData = await retryResponse.json()
      const retryRaw = retryData?.content?.[0]?.text ?? ''
      const retryDsl = stripFences(retryRaw)
      if (looksLikeDsl(retryDsl)) dsl = retryDsl
    }
  }

  return { dsl, remaining, enhancedPrompt }
}
