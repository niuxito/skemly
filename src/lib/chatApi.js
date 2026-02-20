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
- vibe: clean | handdrawn | cyberpunk (default: clean)
- layout: TD | LR | MM (default: TD). Use MM for mindmaps.
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

### Icon Inference (automatic by keyword)
- user, db, database, cloud, auth, mail, email, api, server, lb, queue, cache
- Explicit override: [Node]@icon=name

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

export async function callClaude(userMessage, chatHistory, currentDsl) {
  const contextBlock = currentDsl
    ? `Current diagram DSL:\n\`\`\`\n${currentDsl}\n\`\`\`\n\n`
    : ''

  const augmentedMessage = `${contextBlock}${userMessage}`

  const messages = [
    ...chatHistory.slice(-10),
    { role: 'user', content: augmentedMessage },
  ]

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!response.ok) {
    let errorMsg = `API error ${response.status}`
    try {
      const errData = await response.json()
      errorMsg = errData?.error?.message ?? errorMsg
    } catch (_) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()
  const rawText = data?.content?.[0]?.text ?? ''
  return stripFences(rawText)
}
