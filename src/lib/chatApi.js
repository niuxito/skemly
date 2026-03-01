const SYSTEM_PROMPT = `You are an expert diagramming assistant. Output ONLY raw DSL — no fences, no explanation. When editing, reproduce the COMPLETE updated DSL and preserve existing node IDs and directives unless asked to change them.

## Node shapes
[Text]=Box  (Text)=Cylinder  ?Text?=Diamond  <Text>=Cloud

## IDs & edges
- [id|Label] — if no |, id=label (normalized: lowercase, trim, collapse spaces)
- -> directed  <-> bidirectional  A->"Label"->B
- [A],[B]->[C],[D] = cartesian expansion (4 edges)

## Tags & groups
- Tags: #danger #safe #info #warning — e.g. [Node]#info
- Groups: group "Title" #tag { ... }  (nestable)

## Directives (top of file)
- vibe: clean|handdrawn|cyberpunk  (default: clean)
- layout: TD|LR|MM  (default: TD)
  - TD: sequential flows, pipelines, decision trees
  - LR: 2+ parallel groups or layers side by side
  - MM: mindmaps — root=node with no incoming edges, [Box] nodes only, -> only
- spacing: N  edgeLabels: on|off

## Node attributes (after closing bracket, any order)
- @icon=PascalCaseLucideIcon (e.g. @icon=Database, @icon=Shield, @icon=Globe, @icon=Cpu)
- @bg=#rrggbb or @bg=cssname (e.g. @bg=#1e293b, @bg=tomato, @bg=steelblue)
- @color=#rrggbb or @color=cssname (e.g. @color=#ffffff, @color=white)
- @url=https://...
- Combine freely (NO spaces between attributes): [Node]@icon=Server@bg=#0f172a@color=#38bdf8
- Auto-icons by label keyword: user→User, db→Database, cloud→Cloud, auth→Lock, mail→Mail, api→Plug, server→Server, lb→GitMerge, queue→List, cache→Zap, internet→Globe, login→LogIn

## Text formatting
- [**bold**]  [__underline__]  [**__both__**]

## Critical rules
- EVERY node and edge must fit on a SINGLE line — never use \n or literal newlines inside labels
- Keep labels short with spaces; break long concepts across multiple connected nodes instead`

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

export async function callClaude(userMessage, chatHistory, currentDsl, attachment = null) {
  const contextBlock = currentDsl
    ? `Current diagram DSL:\n\`\`\`\n${currentDsl}\n\`\`\`\n\n`
    : ''

  const augmentedMessage = `${contextBlock}${userMessage}`

  const isFirstShot = chatHistory.length === 0 && !currentDsl

  const messages = [
    ...chatHistory.slice(-5),
    { role: 'user', content: augmentedMessage },
  ]

  const body = {
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
    isFirstShot,
    ...(attachment ? { attachment } : {}),
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

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

  const data = await response.json()
  const rawText = data?.content?.[0]?.text ?? ''
  const dsl = stripFences(rawText)

  const remainingHeader = response.headers.get('X-RateLimit-Remaining')
  const remaining = remainingHeader !== null ? parseInt(remainingHeader, 10) : null

  return { dsl, remaining }
}
