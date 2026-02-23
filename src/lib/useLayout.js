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

  function elkLeafNode(n) {
    const { width, height, lines } = estimateNodeSize(n, charW)
    linesMap[n.id_key] = lines
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
        'elk.padding': '[top=20,left=20,right=20,bottom=20]',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
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
        'elk.direction': 'DOWN',
        'elk.padding': '[top=40,left=20,right=20,bottom=20]',
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
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
      'elk.padding': '[top=20,left=20,right=20,bottom=20]',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    },
    children: [
      ...ungroupedNodes.map(n => elkLeafNode(n)),
      ...topLevelGroups.map(g => buildGroupNode(g)),
    ],
    edges: elkEdges,
  }

  const result = await elk.layout(graph)
  annotateLines(result.children)

  if (direction === 'RIGHT' && topLevelGroups.length > 1) {
    // Post-process: arrange groups left-to-right and center each "sink" group
    // vertically on the source nodes that point into it.

    // Helper: find top-level ancestor group for a node.
    // nodeGroupMap gives the deepest group; we walk up to find the root.
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

    // Build incoming-edge maps per TOP-LEVEL group.
    // Using topLevelGroupOf ensures nested-group edges (e.g. queue→consumer)
    // correctly register their top-level ancestor as the dependency.
    const groupIncomingSources = {}  // groupId → Set<groupId>
    const groupIncomingYs = {}       // groupId → y-centers of source nodes
    for (const e of edges) {
      const sg = topLevelGroupOf(e.from), tg = topLevelGroupOf(e.to)
      if (sg && tg && sg !== tg) {
        (groupIncomingSources[tg] ??= new Set()).add(sg)
        const p = leafPos[e.from]
        if (p) (groupIncomingYs[tg] ??= []).push(p.ay + p.h / 2)
      }
    }

    // Topological sort: sources before sinks
    const gIds = topLevelGroups.map(g => g.id)
    const visited = new Set()
    const sorted = []
    function topoVisit(id) {
      if (visited.has(id)) return
      visited.add(id)
      for (const dep of groupIncomingSources[id] ?? []) {
        if (gIds.includes(dep)) topoVisit(dep)
      }
      sorted.push(id)
    }
    for (const id of gIds) topoVisit(id)

    // Snapshot group positions BEFORE repositioning (for edge translation)
    const groupOldPos = {}
    for (const c of result.children ?? []) {
      groupOldPos[c.id] = { x: c.x ?? 0, y: c.y ?? 0 }
    }

    // Place groups left to right; center sink groups on their source nodes
    let curX = 20
    for (const gId of sorted) {
      const gNode = result.children.find(c => c.id === gId)
      if (!gNode) continue
      gNode.x = curX
      const ys = groupIncomingYs[gId]
      if (ys?.length) {
        const targetCY = (Math.min(...ys) + Math.max(...ys)) / 2
        gNode.y = Math.max(20, targetCY - (gNode.height ?? 0) / 2)
      } else {
        gNode.y = 20
      }
      curX += (gNode.width ?? 0) + spacing * 2
    }

    // Update cross-TOP-LEVEL-group edge sections: translate startPoint by source
    // top-level-group delta and endPoint by target top-level-group delta; discard
    // bendPoints (stale in new layout). DiagramRenderer's synthesizer will build
    // an orthogonal S-shaped path from the translated attachment points.
    // Intra-top-level-group edges (e.g. within Broker) are left untouched so
    // ELK's internally-computed routing is preserved.
    for (const edge of result.edges ?? []) {
      const srcId = edge.sources?.[0]
      const tgtId = edge.targets?.[0]
      const sg = topLevelGroupOf(srcId)
      const tg = topLevelGroupOf(tgtId)
      if (sg && tg && sg !== tg) {
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
