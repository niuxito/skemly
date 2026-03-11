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

export function applyVibeChange(dsl, key) {
  const newDsl = dsl.replace(/^vibe\s*:.*$/m, `vibe: ${key}`)
  if (newDsl === dsl && !dsl.match(/^vibe\s*:/m)) {
    return `vibe: ${key}\n` + dsl
  }
  return newDsl
}
