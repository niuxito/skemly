import { normalizeId } from '../../lib/parser.js'

// ─── DSL label rewriter ────────────────────────────────────────────────────────
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripFormatting(text) {
  let t = text.trim()
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) t = t.slice(2, -2).trim()
  if (t.startsWith('__') && t.endsWith('__') && t.length > 4) t = t.slice(2, -2).trim()
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) t = t.slice(2, -2).trim()
  return t
}

function preserveFormatting(rawContent, newLabel) {
  let t = rawContent.trim()
  const markers = []
  if (t.startsWith('**') && t.endsWith('**') && t.length > 4) { markers.push('**'); t = t.slice(2, -2).trim() }
  if (t.startsWith('__') && t.endsWith('__') && t.length > 4) { markers.push('__'); t = t.slice(2, -2).trim() }
  if (markers[0] !== '**' && t.startsWith('**') && t.endsWith('**') && t.length > 4) { markers.push('**'); }
  let result = newLabel
  for (let i = markers.length - 1; i >= 0; i--) result = `${markers[i]}${result}${markers[i]}`
  return result
}

export function rewriteNodeLabel(dsl, idKey, oldLabel, newLabel) {
  const shapes = [
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
    { open: '?', close: '?' },
  ]

  let result = dsl
  for (const { open, close } of shapes) {
    const eo = escapeRegex(open)
    const ec = escapeRegex(close)

    let matched = false
    const reExplicit = new RegExp(`${eo}([^|${ec}]*)\\|([^${ec}]*)${ec}`, 'g')
    result = result.replace(reExplicit, (match, rawId, rawLabelContent) => {
      if (normalizeId(rawId) === idKey && stripFormatting(rawLabelContent) === oldLabel) {
        matched = true
        return `${open}${rawId}|${preserveFormatting(rawLabelContent, newLabel)}${close}`
      }
      return match
    })

    if (!matched) {
      const reNonExplicit = new RegExp(`${eo}([^${ec}]*)${ec}`, 'g')
      result = result.replace(reNonExplicit, (match, rawContent) => {
        if (rawContent.includes('|')) return match
        if (stripFormatting(rawContent) === oldLabel) {
          matched = true
          return `${open}${idKey}|${preserveFormatting(rawContent, newLabel)}${close}`
        }
        return match
      })
    }
  }
  return result
}

// ─── Edge label rewriter ────────────────────────────────────────────────────────
// Best-effort: finds the line(s) containing the from→to connection and
// adds/replaces/removes the quoted label after the arrow.
// Works for the common case where each edge is on its own line.
function nodeContainsText(line, label, id) {
  const targets = [label, id].filter(Boolean)
  // Match node token contents (inside any pair of delimiters)
  const tokenRe = /[\[(<{?]([^|\])<>{}?]*)(?:\|([^|\])<>{}?]*))?[\]>)}?]/g
  let m
  while ((m = tokenRe.exec(line)) !== null) {
    const inner = m[1]?.trim() ?? ''
    const labelPart = m[2]?.trim() ?? inner
    if (targets.some(t => labelPart === t || inner === t)) return true
  }
  return targets.some(t => line.includes(t))
}

export function rewriteEdgeLabel(dsl, fromLabel, fromId, toLabel, toId, oldLabel, newLabel) {
  const lines = dsl.split('\n')
  let applied = false

  const result = lines.map(line => {
    if (applied) return line
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || !trimmed.includes('->')) return line

    if (!nodeContainsText(line, fromLabel, fromId)) return line
    if (!nodeContainsText(line, toLabel, toId)) return line

    applied = true

    if (newLabel === null || newLabel === '') {
      // Remove existing label
      return line.replace(/(<->|->)\s*"[^"]*"(?:#[0-9a-fA-F]{3,8})?/, '$1')
    }
    if (oldLabel) {
      // Replace existing quoted label (preserve color suffix)
      const replaced = line.replace(
        new RegExp(`((?:<->|->)\\s*)"${escapeRegex(oldLabel)}"(#[0-9a-fA-F]{3,8})?`),
        (_, arrow, color) => `${arrow}"${newLabel}"${color ?? ''}`
      )
      if (replaced !== line) return replaced
    }
    // Add label after first arrow (no existing label to replace)
    return line.replace(/(<->|->)/, `$1 "${newLabel}"`)
  }).join('\n')

  return result
}

export function applyVibeChange(dsl, key) {
  const newDsl = dsl.replace(/^vibe\s*:.*$/m, `vibe: ${key}`)
  if (newDsl === dsl && !dsl.match(/^vibe\s*:/m)) {
    return `vibe: ${key}\n` + dsl
  }
  return newDsl
}
