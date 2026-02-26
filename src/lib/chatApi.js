const SYSTEM_PROMPT = `You are an expert diagramming assistant for Vibedrawing, an LLM-native diagramming tool.

## DSL Specification

### Node Shapes (inferred by delimiters)
- [Text] → Box (Process/Entity)
- (Text) → Cylinder/Pill (Database/Storage/State)
- ?Text? → Diamond (Decision/Gateway)
- <Text> → Cloud (External Network/SaaS/Internet)

### Stable IDs
- Syntax: [id|Label] e.g. [app1|App Server]
- If | is missing, id defaults to label
- Normalization: trim + lowercase + collapse internal spaces

### Relationships
- -> directed edge
- <-> bidirectional edge
- Labels: A -> "Label" -> B
- Cartesian expansion: [A], [B] -> [C], [D] expands to 4 edges

### Tags & Groups
- Tags: #danger, #safe, #info, #warning applied to nodes e.g. [Node]#info
- Groups: group "Title" #tag { ... } — can be nested

### Directives (top of file)
- vibe: clean | handdrawn | cyberpunk (default: clean) — affects visual rendering ONLY, never layout or positioning
- layout: TD | LR | MM (default: TD)
  - TD (Top-Down): best for sequential flows, pipelines, decision trees, and single-chain processes. Groups stack vertically.
  - LR (Left-Right): best when there are multiple parallel groups, phases, or clusters that should appear side by side. Use LR when the diagram has 2+ groups whose nodes flow horizontally (e.g. a pipeline with stages, an architecture with distinct layers, or a long chain in one group with a summary group beside it).
  - MM: use for mindmaps and concept maps only.
- spacing: <number> (default: 40)
- edgeLabels: on | off (default: on)

### Mindmap layout (layout: MM)
When the user asks for a mindmap, concept map, or mind map, use \`layout: MM\`.
- The node with no incoming edges becomes the root (center)
- Children branch left and right automatically
- Use plain [Box] nodes for all levels — avoid groups and diamonds
- Connect with -> edges only (no <->)
- Example:
\`\`\`
vibe: clean
layout: MM

[Topic] -> [Branch A], [Branch B], [Branch C]
[Branch A] -> [Detail A1], [Detail A2]
[Branch B] -> [Detail B1], [Detail B2]
[Branch C] -> [Detail C1]
\`\`\`

### Custom Node Colors (optional)
- Background color: [Node]@bg=#1e293b or [Node]@bg=steelblue
- Text color: [Node]@color=#ffffff or [Node]@color=white
- Both together: [Node]@bg=#1e293b@color=#f8fafc
- Combinable with @icon= in any order: [Node]@icon=Server@bg=#111@color=#0ff
- Accepts hex (#rrggbb) and CSS named colors (steelblue, tomato, white…)
- Custom colors override semantic tags (#danger, #safe, etc.) for that property

### Icon Inference (automatic by keyword in label)
- user/users/person/people → User icon
- db/database → Database icon
- cloud → Cloud icon
- auth/authentication → Lock icon
- mail/email → Mail icon
- api → Plug icon
- server → Server icon
- lb/load balancer → GitMerge icon
- queue → List icon
- cache → Zap icon
- internet/web → Globe icon
- login/signin → LogIn icon
- Explicit override: [Node]@icon=IconName where IconName is PascalCase Lucide icon (e.g. @icon=User, @icon=Database, @icon=Shield, @icon=Globe, @icon=Cpu, @icon=Smartphone)

### Text formatting in node labels
- Bold: [**Node label**]
- Underline: [__Node label__]
- Both: [**__Node label__**] or [__**Node label**__]

### Example
\`\`\`
vibe: clean
layout: TD

<internet|Internet> -> [lb|Load Balancer]#info

group "Private Cloud" #safe {
  [lb|Load Balancer] -> [app1|App Server 1], [app2|App Server 2]
  [app1|App Server 1], [app2|App Server 2] -> (db|Main Database)#safe
}

[app1|App Server 1] -> "Auth Check" -> ?valid|Valid??
?valid|Valid?? -> "no" -> [login|Login Page]#danger
\`\`\`

Output ONLY the raw DSL. No markdown fences. No explanation. When editing, reproduce the COMPLETE updated DSL. Preserve existing node IDs and directives unless asked to change them.`

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

  const messages = [
    ...chatHistory.slice(-10),
    { role: 'user', content: augmentedMessage },
  ]

  const body = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
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
