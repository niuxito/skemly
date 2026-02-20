// Custom mindmap layout — radial tree with root centered, branches left & right
// Activated when directive: layout: MM

const H_GAP = 72   // horizontal gap between levels
const V_GAP = 18   // vertical gap between siblings

const MAX_NODE_W = 160  // max node width (px)
const CHAR_W     = 7.2  // avg char width at default font size
const LINE_H     = 17   // line height (px)
const PAD_W      = 24   // horizontal padding (12px each side)
const PAD_V      = 10   // vertical padding (5px top + 5px bottom)

// Wrap a label into lines that fit within maxInnerW pixels
function wrapLabel(label, maxInnerW) {
  const words = label.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length * CHAR_W <= maxInnerW) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word  // single oversized word: keep as-is
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [label]
}

function nodeSize(n) {
  const maxInnerW = MAX_NODE_W - PAD_W
  const lines = wrapLabel(n.label, maxInnerW)
  // Width: single-line uses exact text width; multi-line always uses MAX_NODE_W
  const w = lines.length > 1
    ? MAX_NODE_W
    : Math.max(Math.min(n.label.length * CHAR_W + PAD_W, MAX_NODE_W), 72)
  const textH = lines.length * LINE_H
  const iconExtra = n.icon ? 22 : 0  // space for icon above text
  const h = n.shape === 'diamond'
    ? Math.max(52, textH + PAD_V * 2)
    : Math.max(n.icon ? 52 : 34, textH + PAD_V * 2 + iconExtra)
  return { width: w, height: h, lines }
}

// Recursively compute the total vertical space a subtree needs
function subtreeH(id, childrenMap, sizeMap, memo = {}) {
  if (id in memo) return memo[id]
  const kids = childrenMap[id] || []
  if (kids.length === 0) {
    memo[id] = sizeMap[id].height
    return memo[id]
  }
  const total = kids.reduce((s, kid, i) =>
    s + subtreeH(kid, childrenMap, sizeMap, memo) + (i > 0 ? V_GAP : 0), 0)
  memo[id] = Math.max(sizeMap[id].height, total)
  return memo[id]
}

// Place a subtree rooted at `id` with its center at (cx, cy), growing in `dir` (-1=left, 1=right)
function placeSubtree(id, cx, cy, dir, childrenMap, sizeMap, memo, positions) {
  const sz = sizeMap[id]
  positions[id] = {
    x: dir >= 0 ? cx : cx - sz.width,
    y: cy - sz.height / 2,
    width: sz.width,
    height: sz.height,
  }

  const kids = childrenMap[id] || []
  if (kids.length === 0) return

  const totalH = kids.reduce((s, kid, i) =>
    s + subtreeH(kid, childrenMap, sizeMap, memo) + (i > 0 ? V_GAP : 0), 0)

  const nextCx = dir >= 0 ? cx + sz.width + H_GAP : cx - sz.width - H_GAP
  let childCy = cy - totalH / 2

  for (const kid of kids) {
    const kH = subtreeH(kid, childrenMap, sizeMap, memo)
    placeSubtree(kid, nextCx, childCy + kH / 2, dir, childrenMap, sizeMap, memo, positions)
    childCy += kH + V_GAP
  }
}

export function mindmapLayout(ast) {
  const { nodes, edges } = ast
  if (!nodes.length) return null

  // Build adjacency and in-degree
  const childrenMap = {}
  const inDegree = {}
  for (const n of nodes) { childrenMap[n.id_key] = []; inDegree[n.id_key] = 0 }
  for (const e of edges) {
    childrenMap[e.from]?.push(e.to)
    inDegree[e.to] = (inDegree[e.to] || 0) + 1
  }

  // Root = node with no incoming edges (most children wins ties)
  const root = nodes
    .filter(n => !inDegree[n.id_key])
    .sort((a, b) => (childrenMap[b.id_key]?.length ?? 0) - (childrenMap[a.id_key]?.length ?? 0))[0]
    ?? nodes[0]

  // Size map
  const sizeMap = {}
  for (const n of nodes) sizeMap[n.id_key] = nodeSize(n)

  const positions = {}
  const memo = {}
  const rootSz = sizeMap[root.id_key]

  // Place root at origin center
  positions[root.id_key] = { x: -rootSz.width / 2, y: -rootSz.height / 2, ...rootSz }

  // Split level-1 children: right half and left half
  const level1 = childrenMap[root.id_key] || []
  const rightCount = Math.ceil(level1.length / 2)
  const rightKids = level1.slice(0, rightCount)
  const leftKids = level1.slice(rightCount)

  // Right side
  const rightTotalH = rightKids.reduce((s, kid, i) =>
    s + subtreeH(kid, childrenMap, sizeMap, memo) + (i > 0 ? V_GAP : 0), 0)
  let ry = -rightTotalH / 2
  for (const kid of rightKids) {
    const kH = subtreeH(kid, childrenMap, sizeMap, memo)
    placeSubtree(kid, rootSz.width / 2 + H_GAP, ry + kH / 2, 1, childrenMap, sizeMap, memo, positions)
    ry += kH + V_GAP
  }

  // Left side
  const leftTotalH = leftKids.reduce((s, kid, i) =>
    s + subtreeH(kid, childrenMap, sizeMap, memo) + (i > 0 ? V_GAP : 0), 0)
  let ly = -leftTotalH / 2
  for (const kid of leftKids) {
    const kH = subtreeH(kid, childrenMap, sizeMap, memo)
    placeSubtree(kid, -rootSz.width / 2 - H_GAP, ly + kH / 2, -1, childrenMap, sizeMap, memo, positions)
    ly += kH + V_GAP
  }

  // Normalize to positive coordinates
  const allPos = Object.values(positions)
  const minX = Math.min(...allPos.map(p => p.x)) - 48
  const minY = Math.min(...allPos.map(p => p.y)) - 48
  const maxX = Math.max(...allPos.map(p => p.x + p.width)) + 48
  const maxY = Math.max(...allPos.map(p => p.y + p.height)) + 48

  const offset = (p) => ({ ...p, x: p.x - minX, y: p.y - minY })
  const offsetPt = ({ x, y }) => ({ x: x - minX, y: y - minY })

  // Build ELK-compatible children list
  const children = Object.entries(positions).map(([id, pos]) => ({
    id,
    ...offset(pos),
    labels: [{ text: nodes.find(n => n.id_key === id)?.label ?? id }],
    lines: sizeMap[id]?.lines,   // word-wrapped lines for multi-line rendering
  }))

  // Build bezier edge sections
  const layoutEdges = edges.map((e, i) => {
    const from = positions[e.from]
    const to = positions[e.to]
    if (!from || !to) return null

    const fromCx = from.x + from.width / 2
    const fromCy = from.y + from.height / 2
    const toCx = to.x + to.width / 2
    const toCy = to.y + to.height / 2

    const toRight = toCx >= fromCx
    const startX = toRight ? from.x + from.width : from.x
    const endX   = toRight ? to.x               : to.x + to.width

    const cp1 = { x: startX + (toRight ? H_GAP * 0.6 : -H_GAP * 0.6), y: fromCy }
    const cp2 = { x: endX   + (toRight ? -H_GAP * 0.6 : H_GAP * 0.6), y: toCy }

    const midX = (startX + endX) / 2
    const midY = (fromCy + toCy) / 2

    return {
      id: `e${i}`,
      isMindmapEdge: true,
      sources: [e.from],
      targets: [e.to],
      labels: e.label ? [{ text: e.label, x: midX - minX - 20, y: midY - minY - 8, width: 40, height: 16 }] : [],
      sections: [{
        isBezier: true,
        startPoint: offsetPt({ x: startX, y: fromCy }),
        endPoint:   offsetPt({ x: endX,   y: toCy }),
        cp1: offsetPt(cp1),
        cp2: offsetPt(cp2),
        bendPoints: [],
      }],
    }
  }).filter(Boolean)

  return {
    id: 'root',
    isMindmap: true,
    x: 0, y: 0,
    width: maxX - minX,
    height: maxY - minY,
    children,
    edges: layoutEdges,
  }
}
