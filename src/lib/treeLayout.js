// Custom top-down tree layout — BFS level-by-level, each level centered.
// Activated when directive: layout: TREE
// Works best for strict trees; emits a diagnostic if cycles / multiple parents detected.

const H_GAP = 60   // horizontal gap between sibling nodes
const V_GAP = 80   // vertical gap between levels

const MAX_NODE_W = 180
const CHAR_W     = 7.2
const LINE_H     = 17
const PAD_W      = 24
const PAD_V      = 10

const CARD_MAX_W        = 240
const CARD_HEADER_H_MIN = 36
const BODY_CHAR_W       = 6.5
const BODY_LINE_H       = 15
const BODY_PAD_V        = 8

function wrapLabel(label, maxInnerW) {
  const words = (label || '').split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length * CHAR_W <= maxInnerW) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [label || '']
}

function nodeSize(n) {
  if (n.shape === 'card') {
    const maxHeaderInnerW = CARD_MAX_W - PAD_W
    const headerLines = wrapLabel(n.label, maxHeaderInnerW)
    const headerH = Math.max(CARD_HEADER_H_MIN, headerLines.length * LINE_H + PAD_V * 2)

    let bodyLines = [], bodyH = BODY_PAD_V * 2
    if (n.body) {
      const rawRows = n.body.split(/\\n/)
      bodyLines = rawRows.flatMap(row => wrapLabel(row.trim(), CARD_MAX_W - PAD_W))
      bodyH = bodyLines.length * BODY_LINE_H + BODY_PAD_V * 2
    }
    const longestHeaderW = Math.max(...headerLines.map(l => l.length * CHAR_W)) + PAD_W
    const w = n.body ? CARD_MAX_W : Math.min(CARD_MAX_W, Math.max(140, longestHeaderW))
    return { width: w, height: headerH + bodyH, lines: headerLines, bodyLines, headerH }
  }

  const maxInnerW = MAX_NODE_W - PAD_W
  const lines = wrapLabel(n.label, maxInnerW)
  const w = lines.length > 1
    ? MAX_NODE_W
    : Math.max(Math.min(n.label.length * CHAR_W + PAD_W, MAX_NODE_W), 72)
  const iconExtra = n.icon ? 22 : 0
  const h = n.shape === 'diamond'
    ? Math.max(52, lines.length * LINE_H + PAD_V * 2)
    : Math.max(n.icon ? 52 : 34, lines.length * LINE_H + PAD_V * 2 + iconExtra)
  return { width: w, height: h, lines }
}

// Recursively compute the total width a subtree needs
function subtreeW(id, childrenMap, sizeMap, memo = {}) {
  if (id in memo) return memo[id]
  const kids = childrenMap[id] || []
  if (kids.length === 0) {
    memo[id] = sizeMap[id].width
    return memo[id]
  }
  const total = kids.reduce((s, kid, i) =>
    s + subtreeW(kid, childrenMap, sizeMap, memo) + (i > 0 ? H_GAP : 0), 0)
  memo[id] = Math.max(sizeMap[id].width, total)
  return memo[id]
}

// Place a subtree rooted at `id` with its horizontal center at `cx` and top at `y`
function placeSubtree(id, cx, y, childrenMap, sizeMap, wMemo, positions) {
  const sz = sizeMap[id]
  positions[id] = { x: cx - sz.width / 2, y, width: sz.width, height: sz.height }

  const kids = childrenMap[id] || []
  if (kids.length === 0) return

  const totalW = kids.reduce((s, kid, i) =>
    s + subtreeW(kid, childrenMap, sizeMap, wMemo) + (i > 0 ? H_GAP : 0), 0)

  let childX = cx - totalW / 2
  const childY = y + sz.height + V_GAP

  for (const kid of kids) {
    const kW = subtreeW(kid, childrenMap, sizeMap, wMemo)
    placeSubtree(kid, childX + kW / 2, childY, childrenMap, sizeMap, wMemo, positions)
    childX += kW + H_GAP
  }
}

export function treeLayout(ast) {
  const { nodes, edges } = ast
  if (!nodes.length) return null

  const childrenMap = {}
  const inDegree = {}
  for (const n of nodes) { childrenMap[n.id_key] = []; inDegree[n.id_key] = 0 }
  for (const e of edges) {
    childrenMap[e.from]?.push(e.to)
    inDegree[e.to] = (inDegree[e.to] || 0) + 1
  }

  const roots = nodes.filter(n => !inDegree[n.id_key])
  const root = roots.sort((a, b) =>
    (childrenMap[b.id_key]?.length ?? 0) - (childrenMap[a.id_key]?.length ?? 0)
  )[0] ?? nodes[0]

  const sizeMap = {}
  for (const n of nodes) sizeMap[n.id_key] = nodeSize(n)

  const positions = {}
  const wMemo = {}
  placeSubtree(root.id_key, 0, 0, childrenMap, sizeMap, wMemo, positions)

  // Place any disconnected nodes to the right of the tree
  const placed = new Set(Object.keys(positions))
  let offsetX = subtreeW(root.id_key, childrenMap, sizeMap, wMemo) / 2 + H_GAP * 2
  for (const n of nodes) {
    if (!placed.has(n.id_key)) {
      const sz = sizeMap[n.id_key]
      positions[n.id_key] = { x: offsetX, y: 0, width: sz.width, height: sz.height }
      offsetX += sz.width + H_GAP
    }
  }

  // Normalize to positive coordinates with padding
  const PAD = 48
  const allPos = Object.values(positions)
  const minX = Math.min(...allPos.map(p => p.x)) - PAD
  const minY = Math.min(...allPos.map(p => p.y)) - PAD
  const maxX = Math.max(...allPos.map(p => p.x + p.width))  + PAD
  const maxY = Math.max(...allPos.map(p => p.y + p.height)) + PAD

  const shift = (p) => ({ ...p, x: p.x - minX, y: p.y - minY })
  const shiftPt = ({ x, y }) => ({ x: x - minX, y: y - minY })

  // Flat children — absolute positions, no compound nesting.
  // Keeping them flat ensures buildFlatLayoutMap never marks nodes as
  // group-members, so LCA is always null and edge sections are never
  // double-translated.
  const children = Object.entries(positions).map(([id, pos]) => {
    const sz = sizeMap[id]
    return {
      id,
      ...shift(pos),
      labels: [{ text: nodes.find(n => n.id_key === id)?.label ?? id }],
      lines: sz?.lines,
      ...(sz?.bodyLines !== undefined ? { bodyLines: sz.bodyLines } : {}),
      ...(sz?.headerH   !== undefined ? { headerH:   sz.headerH   } : {}),
    }
  })

  // Compute group bounding boxes (absolute, after shift) and expose them as
  // treeGroupBoxes so buildFlatLayoutMap can inject them directly into groupMap
  // without affecting nodeGroupId / LCA logic.
  const groups = ast.groups ?? []
  const treeGroupBoxes = groups.map(g => {
    const members = (g.nodeIds || []).map(id => {
      const pos = positions[id]
      return pos ? shift(pos) : null
    }).filter(Boolean)
    if (!members.length) return null

    const G_PAD_H   = 20
    const G_PAD_TOP = 36
    const G_PAD_BOT = 16

    return {
      id:     g.id,
      label:  g.label,
      tag:    g.tag ?? null,
      x:      Math.min(...members.map(p => p.x))            - G_PAD_H,
      y:      Math.min(...members.map(p => p.y))            - G_PAD_TOP,
      width:  Math.max(...members.map(p => p.x + p.width))  - Math.min(...members.map(p => p.x)) + G_PAD_H * 2,
      height: Math.max(...members.map(p => p.y + p.height)) - Math.min(...members.map(p => p.y)) + G_PAD_TOP + G_PAD_BOT,
    }
  }).filter(Boolean)

  // Straight vertical edges: bottom-center of parent → top-center of child
  const layoutEdges = edges.map((e, i) => {
    const from = positions[e.from]
    const to   = positions[e.to]
    if (!from || !to) return null

    const startX = from.x + from.width  / 2
    const startY = from.y + from.height
    const endX   = to.x   + to.width    / 2
    const endY   = to.y

    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2

    // Elbow route: vertical down then horizontal then vertical to target
    const bendPoints = startX !== endX
      ? [shiftPt({ x: startX, y: midY }), shiftPt({ x: endX, y: midY })]
      : []

    return {
      id: `e${i}`,
      isTreeEdge: true,
      sources: [e.from],
      targets: [e.to],
      labels: e.label ? [{ text: e.label, x: midX - minX - 20, y: midY - minY - 10, width: 40, height: 16 }] : [],
      sections: [{
        startPoint: shiftPt({ x: startX, y: startY }),
        endPoint:   shiftPt({ x: endX,   y: endY }),
        bendPoints,
      }],
    }
  }).filter(Boolean)

  return {
    id: 'root',
    isTree: true,
    x: 0, y: 0,
    width:  maxX - minX,
    height: maxY - minY,
    children,
    edges: layoutEdges,
    treeGroupBoxes,
  }
}
