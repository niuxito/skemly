import { useState, useEffect, useRef } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { mindmapLayout } from './mindmapLayout.js'

const elk = new ELK()

const BASE_WIDTH = 140
const BASE_HEIGHT = 50
const ICON_SIZE = 20
const PADDING_H = 24
const PADDING_V = 10
const MAX_WIDTH = 220
const LINE_H = 17
const CARD_MAX_WIDTH = 280
const CARD_HEADER_H_MIN = 36
const BODY_CHAR_W = 6.5
const BODY_LINE_H = 15
const BODY_PADDING_V = 8

// Per-theme character width estimates (monospace vs proportional)
const CHAR_WIDTH_BY_VIBE = {
  clean:     7.5,
  handdrawn: 8.0,
  cyberpunk: 8.0,  // Courier New — wider average than Inter
}

function wrapText(label, maxInnerW, charW) {
  const words = (label || '').split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length * charW <= maxInnerW) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [label || '']
}

function estimateNodeSize(node, charW) {
  if (node.shape === 'card') {
    const iconExtra = node.icon ? ICON_SIZE + 8 : 0
    const maxHeaderInnerW = CARD_MAX_WIDTH - PADDING_H * 2 - iconExtra
    const headerLines = wrapText(node.label, maxHeaderInnerW, charW)
    const headerH = Math.max(CARD_HEADER_H_MIN, headerLines.length * LINE_H + PADDING_V * 2)

    let bodyLines = [], bodyH = BODY_PADDING_V * 2
    if (node.body) {
      const maxBodyInnerW = CARD_MAX_WIDTH - PADDING_H * 2
      bodyLines = wrapText(node.body, maxBodyInnerW, BODY_CHAR_W)
      bodyH = bodyLines.length * BODY_LINE_H + BODY_PADDING_V * 2
    }

    const headerLineW = Math.max(...headerLines.map(l => l.length)) * charW + iconExtra + PADDING_H * 2
    // Cards with body always use full CARD_MAX_WIDTH so body wrapping
    // (done above assuming CARD_MAX_WIDTH - PAD inner space) always fits.
    const w = node.body
      ? CARD_MAX_WIDTH
      : Math.min(Math.max(headerLineW, 160), CARD_MAX_WIDTH)
    const h = headerH + bodyH

    return { width: w, height: h, lines: headerLines, bodyLines, headerH }
  }

  const iconExtra = node.icon ? ICON_SIZE + 8 : 0
  const maxInnerW = MAX_WIDTH - PADDING_H * 2 - iconExtra
  const lines = wrapText(node.label, maxInnerW, charW)

  const longestLineW = Math.max(...lines.map(l => l.length)) * charW
  const rawW = longestLineW + PADDING_H * 2 + iconExtra
  const w = Math.max(Math.min(rawW, MAX_WIDTH), BASE_WIDTH)

  const textH = lines.length * LINE_H
  const iconH = node.icon ? ICON_SIZE + 4 : 0
  const extraH = node.shape === 'diamond' ? 20 : 0
  const h = Math.max(BASE_HEIGHT + extraH, textH + PADDING_V * 2 + iconH + extraH)

  return { width: w, height: h, lines }
}

async function runLayout(ast) {
  // Mindmap mode — custom layout, skip ELK
  if (ast.directives?.layout === 'MM') {
    return mindmapLayout(ast)
  }

  const { nodes, edges, directives, groups = [] } = ast
  const spacing = directives?.spacing ?? 40
  const direction = directives?.layout === 'LR' ? 'RIGHT' : 'DOWN'

  const vibe = ast.directives?.vibe ?? 'clean'
  const charW = CHAR_WIDTH_BY_VIBE[vibe] ?? 7.5

  // Store word-wrap lines keyed by node id to re-attach after ELK layout
  const linesMap = {}
  const bodyLinesMap = {}
  const headerHMap = {}

  function elkLeafNode(n) {
    const { width, height, lines, bodyLines, headerH } = estimateNodeSize(n, charW)
    linesMap[n.id_key] = lines
    if (bodyLines !== undefined) bodyLinesMap[n.id_key] = bodyLines
    if (headerH !== undefined) headerHMap[n.id_key] = headerH
    return {
      id: n.id_key,
      width,
      height,
      labels: [{ text: n.label }],
    }
  }

  // Recursively annotate leaf nodes with pre-computed word-wrap lines
  function annotateLines(children) {
    if (!children) return
    for (const child of children) {
      if (child.children?.length) {
        annotateLines(child.children)
      } else {
        child.lines = linesMap[child.id]
        if (bodyLinesMap[child.id] !== undefined) child.bodyLines = bodyLinesMap[child.id]
        if (headerHMap[child.id] !== undefined) child.headerH = headerHMap[child.id]
      }
    }
  }

  const elkEdges = edges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.from],
    targets: [e.to],
    labels: e.label && directives?.edgeLabels !== 'off' ? [{ text: e.label }] : [],
  }))

  if (groups.length === 0) {
    // FLAT graph — no groups
    const elkNodes = nodes.map(n => elkLeafNode(n))
    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
        'elk.spacing.edgeNode': String(Math.max(15, spacing / 2.5)),
        'elk.spacing.edgeEdge': String(Math.max(5, spacing / 8)),
        'elk.padding': '[top=20,left=20,right=20,bottom=20]',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      },
      children: elkNodes,
      edges: elkEdges,
    }
    const result = await elk.layout(graph)
    annotateLines(result.children)
    return result
  }

  // HIERARCHICAL graph — groups become compound ELK nodes

  // Compute depth of each group so "deepest group wins" when a node belongs to multiple
  function groupDepth(g) {
    let d = 0, cur = g
    while (cur.parentId) {
      cur = groups.find(x => x.id === cur.parentId)
      if (!cur) break
      d++
    }
    return d
  }

  // Map each node to its most-specific (deepest) containing group
  const nodeGroupMap = {}
  const sortedByDepth = [...groups].sort((a, b) => groupDepth(b) - groupDepth(a))
  for (const g of sortedByDepth) {
    for (const nodeId of g.nodeIds) {
      if (!nodeGroupMap[nodeId]) nodeGroupMap[nodeId] = g.id
    }
  }

  // Recursively build a compound ELK node for a group.
  // All groups use DOWN direction — INCLUDE_CHILDREN ensures ELK routes
  // cross-group edges correctly while each group lays out its chain vertically.
  function buildGroupNode(g) {
    const childGroups = groups.filter(x => x.parentId === g.id)
    const directNodes = nodes.filter(n => nodeGroupMap[n.id_key] === g.id)
    return {
      id: g.id,
      labels: [{ text: g.label }],
      layoutOptions: {
        'elk.direction': g.layoutDir === 'LR' ? 'RIGHT' : 'DOWN',
        'elk.padding': '[top=40,left=20,right=20,bottom=20]',
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
        'elk.spacing.edgeNode': String(Math.max(15, spacing / 2.5)),
        'elk.spacing.edgeEdge': String(Math.max(5, spacing / 8)),
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      },
      children: [
        ...directNodes.map(n => elkLeafNode(n)),
        ...childGroups.map(cg => buildGroupNode(cg)),
      ],
    }
  }

  const topLevelGroups = groups.filter(g => !g.parentId)
  const ungroupedNodes = nodes.filter(n => !nodeGroupMap[n.id_key])

  // Always run ELK with DOWN + INCLUDE_CHILDREN for best edge routing.
  // For LR layout we post-process to reposition groups side by side.
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
      'elk.spacing.edgeNode': String(Math.max(15, spacing / 2.5)),
      'elk.spacing.edgeEdge': String(Math.max(5, spacing / 8)),
      'elk.padding': '[top=20,left=20,right=20,bottom=20]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
    },
    children: [
      ...ungroupedNodes.map(n => elkLeafNode(n)),
      ...topLevelGroups.map(g => buildGroupNode(g)),
    ],
    edges: elkEdges,
  }

  const result = await elk.layout(graph)
  annotateLines(result.children)

  // Post-process: rearrange nodes within @layout=LR groups left-to-right.
  // ELK ignores elk.direction on compound nodes when INCLUDE_CHILDREN is used,
  // so we apply the same manual repositioning pattern as the top-level LR logic.
  const lrGroups = groups.filter(g => g.layoutDir === 'LR')
  if (lrGroups.length > 0) {
    function findCompound(children, id) {
      for (const c of children ?? []) {
        if (c.id === id) return c
        if (c.children?.length) { const f = findCompound(c.children, id); if (f) return f }
      }
      return null
    }
    function collectLeafIds(node, ids = new Set()) {
      for (const c of node.children ?? []) {
        if (c.children?.length) collectLeafIds(c, ids); else ids.add(c.id)
      }
      return ids
    }
    const repositionedIds = new Set()
    for (const g of lrGroups) {
      const compound = findCompound(result.children, g.id)
      if (!compound?.children?.length) continue
      const children = [...compound.children].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
      const topPad = 40, sidePad = 20, botPad = 20
      const maxH = Math.max(...children.map(c => c.height ?? 0))
      let curX = sidePad
      for (const child of children) {
        child.x = curX
        child.y = topPad + Math.round((maxH - (child.height ?? 0)) / 2)
        curX += (child.width ?? 0) + spacing
      }
      compound.width  = curX - spacing + sidePad
      compound.height = maxH + topPad + botPad
      collectLeafIds(compound, repositionedIds)
      // Clear edges stored INSIDE the compound node (ELK puts intra-group edges here)
      for (const e of compound.edges ?? []) { e.sections = [] }
    }
    // Also clear root-level edges touching repositioned nodes
    for (const edge of result.edges ?? []) {
      if (repositionedIds.has(edge.sources?.[0]) || repositionedIds.has(edge.targets?.[0])) {
        edge.sections = []
      }
    }
  }

  if (direction === 'RIGHT' && topLevelGroups.length > 1) {
    // Post-process: arrange top-level groups left-to-right.
    //
    // ORDER STRATEGY: sort by ELK's DOWN-layout Y position, NOT by topological
    // sort. Topo-sort breaks when there are back-edges (e.g. ACK/NACK cycles);
    // ELK already handles cycles internally and its Y ordering encodes the
    // intended flow direction reliably.
    //
    // CENTERING: use only forward edges (earlier→later in Y order) so that
    // back-edges (e.g. Consumers→Broker) don't distort group Y positions.

    // Helper: find top-level ancestor group for a node.
    function topLevelGroupOf(nodeId) {
      let gId = nodeGroupMap[nodeId]
      if (!gId) return null
      let g = groups.find(x => x.id === gId)
      while (g?.parentId) {
        const parent = groups.find(x => x.id === g.parentId)
        if (!parent) break
        g = parent
      }
      return g?.id ?? null
    }

    // Collect absolute leaf positions from the ELK (DOWN) result
    const leafPos = {}
    function collectLeafPos(children, ox, oy) {
      for (const c of children ?? []) {
        const ax = (c.x ?? 0) + ox, ay = (c.y ?? 0) + oy
        if (c.children?.length) collectLeafPos(c.children, ax, ay)
        else leafPos[c.id] = { ay, h: c.height ?? 0 }
      }
    }
    collectLeafPos(result.children, 0, 0)

    // Use DSL definition order of top-level groups for LR positioning.
    // Y-sorting and topo-sort both break when back-edges create cycles
    // (e.g. ACK/NACK Consumers→Broker). The user writes groups in the
    // intended left-to-right flow order, so DSL order is the right heuristic.
    const sortedGroupNodes = topLevelGroups
      .map(g => result.children.find(c => c.id === g.id))
      .filter(Boolean)

    // Build Y-centering hints: only accumulate from groups earlier in sorted order
    // (forward edges), skipping back-edges that would skew the vertical alignment.
    const groupIncomingYs = {}
    for (const e of edges) {
      const sg = topLevelGroupOf(e.from), tg = topLevelGroupOf(e.to)
      if (!sg || !tg || sg === tg) continue
      const sgIdx = sortedGroupNodes.findIndex(c => c.id === sg)
      const tgIdx = sortedGroupNodes.findIndex(c => c.id === tg)
      if (sgIdx >= 0 && tgIdx > sgIdx) {
        const p = leafPos[e.from]
        if (p) (groupIncomingYs[tg] ??= []).push(p.ay + p.h / 2)
      }
    }

    // Snapshot group positions BEFORE repositioning (for edge translation)
    const groupOldPos = {}
    for (const c of result.children ?? []) {
      groupOldPos[c.id] = { x: c.x ?? 0, y: c.y ?? 0 }
    }

    // Place groups left to right in Y-sorted order;
    // center each group vertically on its upstream source nodes
    let curX = 20
    for (const gNode of sortedGroupNodes) {
      gNode.x = curX
      const ys = groupIncomingYs[gNode.id]
      if (ys?.length) {
        const targetCY = (Math.min(...ys) + Math.max(...ys)) / 2
        gNode.y = Math.max(20, targetCY - (gNode.height ?? 0) / 2)
      } else {
        gNode.y = 20
      }
      curX += (gNode.width ?? 0) + spacing * 2
    }

    // Translate cross-top-level-group edge sections by their group deltas.
    // Intra-top-level-group edges (e.g. within Broker) are left untouched.
    for (const edge of result.edges ?? []) {
      const srcId = edge.sources?.[0]
      const tgtId = edge.targets?.[0]
      const sg = topLevelGroupOf(srcId)
      const tg = topLevelGroupOf(tgtId)
      if (sg !== tg && (sg || tg)) {  // at least one endpoint is in a group
        const srcGroupNode = result.children.find(c => c.id === sg)
        const tgtGroupNode = result.children.find(c => c.id === tg)
        const oldSrc = groupOldPos[sg] ?? { x: 0, y: 0 }
        const oldTgt = groupOldPos[tg] ?? { x: 0, y: 0 }
        const dxSrc = (srcGroupNode?.x ?? 0) - oldSrc.x
        const dySrc = (srcGroupNode?.y ?? 0) - oldSrc.y
        const dxTgt = (tgtGroupNode?.x ?? 0) - oldTgt.x
        const dyTgt = (tgtGroupNode?.y ?? 0) - oldTgt.y

        if (edge.sections?.length) {
          // Translate startPoint (source side) and endPoint (target side);
          // drop bendPoints because the inter-group space has shifted.
          edge.sections = edge.sections.map((s, si) => ({
            ...s,
            startPoint: si === 0
              ? { x: s.startPoint.x + dxSrc, y: s.startPoint.y + dySrc }
              : s.startPoint,
            endPoint: si === edge.sections.length - 1
              ? { x: s.endPoint.x + dxTgt, y: s.endPoint.y + dyTgt }
              : s.endPoint,
            bendPoints: [],   // cleared — synthesizer will add orthogonal bends
          }))
        } else {
          edge.sections = []  // trigger synthesizer
        }
      }
    }

    // Expand canvas to fit all repositioned groups
    let maxX = 0, maxY = 0
    for (const c of result.children ?? []) {
      maxX = Math.max(maxX, (c.x ?? 0) + (c.width ?? 0))
      maxY = Math.max(maxY, (c.y ?? 0) + (c.height ?? 0))
    }
    result.width  = maxX + 20
    result.height = maxY + 20
  }

  return result
}

export function useLayout(ast) {
  const [layout, setLayout] = useState(null)
  const [error, setError] = useState(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (!ast || ast.nodes.length === 0) {
      setLayout(null)
      setError(null)
      return
    }

    const runId = ++runIdRef.current

    runLayout(ast)
      .then((result) => {
        if (runId === runIdRef.current) {
          setLayout(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (runId === runIdRef.current) {
          setError(err.message || String(err))
        }
      })
  }, [ast])

  return { layout, error }
}
