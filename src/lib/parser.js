// Vibedrawing DSL Parser v1.1
// Spec: CLAUDE.md

// ─── ID normalization ──────────────────────────────────────────────────────────
export function normalizeId(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').normalize('NFC')
}

// ─── Extraction ───────────────────────────────────────────────────────────────
// If fenced ```vibe or ```vibedraw blocks exist, use first one; else use all text
export function extractDSL(input) {
  const fence = /^```(?:vibe|vibedraw)\s*\n([\s\S]*?)^```/m
  const match = input.match(fence)
  return match ? match[1] : input
}

// ─── Text formatting ──────────────────────────────────────────────────────────
// Parses **bold** and __underline__ markers from a label string.
// Markers can be nested in any order: **__text__** or __**text**__
function parseTextFormatting(text) {
  let bold = false, underline = false
  let t = text.trim()
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) { bold = true; t = t.slice(2, -2).trim() }
  if (t.startsWith('__') && t.endsWith('__') && t.length > 4) { underline = true; t = t.slice(2, -2).trim() }
  if (!bold && t.startsWith('**') && t.endsWith('**') && t.length > 4) { bold = true; t = t.slice(2, -2).trim() }
  return { label: t, bold, underline }
}

// ─── Icon Inference ───────────────────────────────────────────────────────────
const ICON_KEYWORDS = [
  { re: /\b(user|users|person|people)\b/i, icon: 'User' },
  { re: /\b(db|database)\b/i, icon: 'Database' },
  { re: /\b(cloud)\b/i, icon: 'Cloud' },
  { re: /\b(auth|authentication|authorization)\b/i, icon: 'Lock' },
  { re: /\b(mail|email)\b/i, icon: 'Mail' },
  { re: /\b(api)\b/i, icon: 'Plug' },
  { re: /\b(server)\b/i, icon: 'Server' },
  { re: /\b(lb|load.?balancer)\b/i, icon: 'GitMerge' },
  { re: /\b(queue)\b/i, icon: 'List' },
  { re: /\b(cache)\b/i, icon: 'Zap' },
  { re: /\b(internet|web)\b/i, icon: 'Globe' },
  { re: /\b(login|signin)\b/i, icon: 'LogIn' },
]

function inferIcon(label, explicitIcon) {
  if (explicitIcon) return explicitIcon
  for (const { re, icon } of ICON_KEYWORDS) {
    if (re.test(label)) return icon
  }
  return null
}

// ─── Node parser ─────────────────────────────────────────────────────────────
// Returns { id_key, label, shape, tags, icon } or null
function parseNodeLiteral(token) {
  // Strip surrounding whitespace
  token = token.trim()

  let shape = null
  let inner = null

  if (token.startsWith('[') && token.endsWith(']')) {
    shape = 'box'
    inner = token.slice(1, -1)
  } else if (token.startsWith('(') && token.endsWith(')')) {
    shape = 'cylinder'
    inner = token.slice(1, -1)
  } else if (token.startsWith('?') && token.endsWith('?')) {
    shape = 'diamond'
    inner = token.slice(1, -1)
  } else if (token.startsWith('<') && token.endsWith('>')) {
    shape = 'cloud'
    inner = token.slice(1, -1)
  } else {
    return null
  }

  // Parse explicit icon: inner may have @icon=Name at end
  let explicitIcon = null
  const iconMatch = inner.match(/@icon=(\w+)$/)
  if (iconMatch) {
    explicitIcon = iconMatch[1]
    inner = inner.slice(0, iconMatch.index).trim()
  }

  // Parse tags: collect trailing #tag sequences
  const tags = []
  let tagMatch
  const tagRe = /#(danger|safe|info|warning)\b/g
  while ((tagMatch = tagRe.exec(inner)) !== null) {
    tags.push(tagMatch[1])
  }
  inner = inner.replace(/#(danger|safe|info|warning)\b/g, '').trim()

  // Parse id|label
  let id, label
  if (inner.includes('|')) {
    const pipe = inner.indexOf('|')
    id = inner.slice(0, pipe).trim()
    label = inner.slice(pipe + 1).trim()
  } else {
    id = inner
    label = inner
  }

  const id_key = normalizeId(id)
  const icon = inferIcon(label, explicitIcon)

  return { id_key, label, shape, tags, icon }
}

// ─── Tokenizer / line parser ─────────────────────────────────────────────────
// Returns { nodes: Map, edges: [], groups: [], directives: {}, diagnostics: [] }
export function parseDSL(rawInput) {
  const dsl = extractDSL(rawInput)
  const lines = dsl.split('\n')

  const nodes = new Map() // id_key → node object
  const edges = []
  const groups = []
  const directives = {
    vibe: 'clean',
    layout: 'TD',
    spacing: 40,
    edgeLabels: 'on',
  }
  const diagnostics = []

  // Group stack for nested groups
  let groupStack = []

  function addNode(node) {
    if (!nodes.has(node.id_key)) {
      node.groupIds = groupStack.map(g => g.id)
      nodes.set(node.id_key, node)
    } else {
      const existing = nodes.get(node.id_key)
      // Promote into group if re-encountered inside a deeper group context
      if (groupStack.length > existing.groupIds.length) {
        existing.groupIds = groupStack.map(g => g.id)
      }
      // Merge tags
      for (const t of node.tags) {
        if (!existing.tags.includes(t)) existing.tags.push(t)
      }
    }
  }

  let lineIdx = 0

  function parseLine(line, lineNum) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//')) return

    // Directive lines: key: value
    const directiveMatch = trimmed.match(/^(vibe|layout|spacing|edgeLabels)\s*:\s*(.+)$/)
    if (directiveMatch) {
      const key = directiveMatch[1]
      const val = directiveMatch[2].trim()
      if (key === 'spacing') {
        const n = Number(val)
        if (!isNaN(n)) directives.spacing = n
        else diagnostics.push({ line: lineNum, msg: `Invalid spacing value: ${val}` })
      } else {
        directives[key] = val
      }
      return
    }

    // Group open: group "Title" #tag {
    const groupOpenMatch = trimmed.match(/^group\s+"([^"]+)"(?:\s+#(\w+))?\s*\{$/)
    if (groupOpenMatch) {
      const gId = `group_${groups.length}`
      const g = {
        id: gId,
        label: groupOpenMatch[1],
        tag: groupOpenMatch[2] || null,
        parentId: groupStack.length > 0 ? groupStack[groupStack.length - 1].id : null,
        nodeIds: [],
      }
      groups.push(g)
      groupStack.push(g)
      return
    }

    // Group close
    if (trimmed === '}') {
      if (groupStack.length === 0) {
        diagnostics.push({ line: lineNum, msg: 'Unexpected }' })
      } else {
        groupStack.pop()
      }
      return
    }

    // Relationship line: may contain nodes, edge operators, and quoted labels
    // Strategy: tokenize the line respecting quotes and node delimiters
    parseRelationshipLine(trimmed, lineNum)
  }

  function parseRelationshipLine(line, lineNum) {
    // Tokenize: split on -> and <-> but keep them as tokens
    // Also handle quoted edge labels like "Label"
    // First, collect all node tokens and edge tokens in order

    // We'll parse left-to-right using a mini state machine
    // Possible tokens: node-group (comma-separated nodes), arrow, quoted label

    const parts = tokenizeLine(line, lineNum)
    if (!parts) return

    // parts is an array like:
    // [ {type:'nodes', nodes:[...]}, {type:'arrow', dir:'->'}, {type:'label', text:'...'}, {type:'arrow',...}, {type:'nodes',...} ]
    // Or simpler: nodes -> nodes, nodes -> label -> nodes

    // Find segments separated by arrows
    // We walk through and build edge chains
    let i = 0
    let sources = null

    while (i < parts.length) {
      const part = parts[i]

      if (part.type === 'nodes') {
        if (sources === null) {
          sources = part.nodes
        }
        i++
      } else if (part.type === 'arrow') {
        const dir = part.dir
        i++

        // Collect optional label
        let edgeLabel = null
        if (i < parts.length && parts[i].type === 'label') {
          edgeLabel = parts[i].text
          i++
          // Expect another arrow after label
          if (i < parts.length && parts[i].type === 'arrow') {
            i++ // consume the second arrow
          }
        }

        // Now expect targets
        if (i < parts.length && parts[i].type === 'nodes') {
          const targets = parts[i].nodes
          i++

          // Cartesian expansion
          if (sources) {
            for (const src of sources) {
              for (const tgt of targets) {
                addNode(src)
                addNode(tgt)
                edges.push({
                  from: src.id_key,
                  to: tgt.id_key,
                  dir,
                  label: edgeLabel,
                })
              }
            }
          }
          sources = targets
        } else {
          diagnostics.push({ line: lineNum, msg: 'Expected target node(s) after arrow' })
          break
        }
      } else if (part.type === 'label') {
        // Standalone label without preceding arrow — skip
        i++
      } else {
        i++
      }
    }

    // If only nodes (no arrows), register them
    if (sources !== null && edges.length === 0) {
      // May have just node declarations on a line
    }
    // Register any lone-node lines
    if (parts.length === 1 && parts[0].type === 'nodes') {
      for (const n of parts[0].nodes) addNode(n)
    }
  }

  function tokenizeLine(line, lineNum) {
    const parts = []
    let i = 0
    const len = line.length

    function skipWS() {
      while (i < len && (line[i] === ' ' || line[i] === '\t')) i++
    }

    function readArrow() {
      // <-> or ->
      if (line.slice(i, i + 3) === '<->') { i += 3; return '<->' }
      if (line.slice(i, i + 2) === '->') { i += 2; return '->' }
      return null
    }

    function readQuotedLabel() {
      if (line[i] !== '"') return null
      i++ // skip opening "
      let s = ''
      while (i < len) {
        if (line[i] === '\\' && i + 1 < len) {
          s += line[i + 1]; i += 2
        } else if (line[i] === '"') {
          i++; return s
        } else {
          s += line[i++]
        }
      }
      // Auto-heal: unclosed quote
      return s
    }

    function readNodeGroup() {
      // Comma-separated node literals, possibly with trailing tags
      const nodes = []

      function tryReadNode() {
        skipWS()
        if (i >= len) return false

        let start = i
        let ch = line[i]
        let closeCh, shape

        if (ch === '[') { closeCh = ']'; shape = 'box' }
        else if (ch === '(') { closeCh = ')'; shape = 'cylinder' }
        else if (ch === '?') { closeCh = '?'; shape = 'diamond' }
        else if (ch === '<') { closeCh = '>'; shape = 'cloud' }
        else return false

        i++ // skip open
        let inner = ''
        let depth = 1

        while (i < len) {
          if (line[i] === '\\' && i + 1 < len) {
            // escaped char
            inner += line[i + 1]; i += 2; continue
          }
          if (shape === 'diamond') {
            // ? closes on first unescaped ?
            if (line[i] === '?') { i++; break }
          } else if (shape === 'cloud') {
            if (line[i] === '>') { i++; break }
          } else {
            if (line[i] === closeCh) { i++; break }
          }
          inner += line[i++]
        }

        // For diamonds: consume optional extra trailing ? (handles ??valid?? style)
        if (shape === 'diamond' && i < len && line[i] === '?') i++

        // Read optional tags immediately after node literal
        const tags = []
        while (i < len && line[i] === '#') {
          let tagStr = ''
          i++ // skip #
          while (i < len && /\w/.test(line[i])) tagStr += line[i++]
          if (['danger', 'safe', 'info', 'warning'].includes(tagStr)) tags.push(tagStr)
        }

        // Read optional @icon= outside brackets: [Node]@icon=name
        let outerIcon = null
        if (i < len && line[i] === '@') {
          const m = line.slice(i).match(/^@icon=(\w+)/)
          if (m) {
            const raw = m[1]
            outerIcon = raw.charAt(0).toUpperCase() + raw.slice(1)
            i += m[0].length
          }
        }

        // Parse inner for id|label and optional @icon= inside brackets
        let explicitIcon = outerIcon
        const iconMatch = inner.match(/@icon=(\w+)$/)
        if (iconMatch) {
          if (!explicitIcon) {
            const raw = iconMatch[1]
            explicitIcon = raw.charAt(0).toUpperCase() + raw.slice(1)
          }
          inner = inner.slice(0, iconMatch.index).trim()
        }

        let id, rawLabel
        if (inner.includes('|')) {
          const pipe = inner.indexOf('|')
          id = inner.slice(0, pipe).trim()
          rawLabel = inner.slice(pipe + 1).trim()
        } else {
          id = inner
          rawLabel = inner
        }

        const { label, bold, underline } = parseTextFormatting(rawLabel)
        const id_key = normalizeId(id)
        const icon = inferIcon(label, explicitIcon)

        nodes.push({ id_key, label, shape, tags, icon, bold, underline })
        return true
      }

      if (!tryReadNode()) return null

      // Check for comma-separated list
      while (i < len) {
        skipWS()
        if (i < len && line[i] === ',') {
          i++ // consume comma
          if (!tryReadNode()) break
        } else {
          break
        }
      }

      return nodes
    }

    while (i < len) {
      skipWS()
      if (i >= len) break

      // Try arrow first
      const arrow = readArrow()
      if (arrow) {
        parts.push({ type: 'arrow', dir: arrow })
        continue
      }

      // Try quoted label
      if (line[i] === '"') {
        const text = readQuotedLabel()
        if (text !== null) {
          parts.push({ type: 'label', text })
          continue
        }
      }

      // Try node group
      const nodeGroup = readNodeGroup()
      if (nodeGroup) {
        parts.push({ type: 'nodes', nodes: nodeGroup })
        continue
      }

      // Unknown char — skip
      diagnostics.push({ line: lineNum, msg: `Unexpected character: ${line[i]}` })
      i++
    }

    return parts
  }

  for (let i = 0; i < lines.length; i++) {
    parseLine(lines[i], i + 1)
  }

  // Close unclosed groups (auto-heal)
  if (groupStack.length > 0) {
    diagnostics.push({ line: lines.length, msg: `Unclosed group: "${groupStack[groupStack.length - 1].label}"` })
  }

  // Attach nodeIds to groups based on node.groupIds
  for (const [, node] of nodes) {
    for (const gId of (node.groupIds || [])) {
      const g = groups.find(gr => gr.id === gId)
      if (g && !g.nodeIds.includes(node.id_key)) g.nodeIds.push(node.id_key)
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    groups,
    directives,
    diagnostics,
  }
}
