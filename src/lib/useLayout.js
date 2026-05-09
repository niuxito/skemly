import { useState, useEffect, useRef } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { mindmapLayout } from './mindmapLayout.js'
import { treeLayout } from './treeLayout.js'
import { sequenceLayout } from './sequenceLayout.js'

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
      // Support \n as explicit row separator (used for ER entity attributes)
      const rawRows = node.body.split(/\\n/)
      bodyLines = rawRows.flatMap(row => wrapText(row.trim(), maxBodyInnerW, BODY_CHAR_W))
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

export async function runLayout(ast) {
  // Custom layout modes — skip ELK
  if (ast.directives?.layout === 'MM')   return mindmapLayout(ast)
  if (ast.directives?.layout === 'TREE') return treeLayout(ast)
  if (ast.directives?.layout === 'SEQ')  return sequenceLayout(ast)

  const { nodes, edges, directives, groups = [] } = ast
  const spacing = directives?.spacing ?? 40
  const isER = directives?.layout === 'ER'
  const direction = (directives?.layout === 'LR' || isER) ? 'RIGHT' : 'DOWN'

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
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 2.5),
        'elk.spacing.edgeNode': String(Math.max(20, spacing / 2)),
        'elk.spacing.edgeEdge': String(Math.max(8, spacing / 6)),
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

  // TWO-PHASE HIERARCHICAL LAYOUT
  //
  // Phase A — layout each top-level group independently with its own direction.
  //            Sub-groups remain as compound nodes within (INCLUDE_CHILDREN per group).
  //            Gives correct internal layout + accurate group dimensions.
  //
  // Phase B — meta-graph: each top-level group becomes an opaque node with Phase A
  //            dimensions; ungrouped nodes are leaves. ELK positions everything using
  //            the global top-level direction — no post-processing hacks needed.
  //
  // Phase C — compose: groups placed at Phase B positions, Phase A children attached
  //            as sub-tree. Reuse ELK sections whenever they exist so the renderer's
  //            synthesizer remains a fallback instead of the primary router.

  // ── Group membership ──────────────────────────────────────────────────────
  function groupDepth(g) {
    let d = 0, cur = g
    while (cur.parentId) {
      cur = groups.find(x => x.id === cur.parentId)
      if (!cur) break
      d++
    }
    return d
  }

  const nodeGroupMap = {}
  const sortedByDepth = [...groups].sort((a, b) => groupDepth(b) - groupDepth(a))
  for (const g of sortedByDepth) {
    for (const nodeId of g.nodeIds) {
      if (!nodeGroupMap[nodeId]) nodeGroupMap[nodeId] = g.id
    }
  }

  const topLevelGroups = groups.filter(g => !g.parentId)
  const ungroupedNodes = nodes.filter(n => !nodeGroupMap[n.id_key])

  // Shared ELK options used across all three phases
  const commonOpts = {
    'elk.algorithm': 'layered',
    'elk.spacing.nodeNode': String(spacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 2.5),
    'elk.spacing.edgeNode': String(Math.max(20, spacing / 2)),
    'elk.spacing.edgeEdge': String(Math.max(8, spacing / 6)),
    'elk.edgeRouting': 'ORTHOGONAL',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  }

  // Resolve the top-level group ancestor for a node (used in Phase B meta edges)
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

  // ── Phase A: layout each top-level group independently ───────────────────
  const groupLayouts = {}  // groupId → elk.layout result (children relative to group origin)

  async function layoutTopLevelGroup(g) {
    // Default: groups inherit the canvas direction. Only override if @layout was explicitly declared.
    const dir = g.layoutDir === 'LR' ? 'RIGHT'
              : g.layoutDir === 'TD' ? 'DOWN'
              : direction

    // Collect all nodeIds in this group's subtree (direct + all nested groups)
    const allNodeIds = new Set()
    function collectIds(grp) {
      for (const nid of grp.nodeIds) allNodeIds.add(nid)
      for (const sg of groups.filter(x => x.parentId === grp.id)) collectIds(sg)
    }
    collectIds(g)

    // Intra-group edges only (both endpoints within this group's node set)
    const intraEdges = edges
      .map((e, i) => ({ edge: e, index: i }))
      .filter(({ edge }) => allNodeIds.has(edge.from) && allNodeIds.has(edge.to))
      .map(({ edge, index }) => ({
        id: `e${index}`,
        sources: [edge.from],
        targets: [edge.to],
        labels: edge.label && directives?.edgeLabels !== 'off' ? [{ text: edge.label }] : [],
      }))

    // Recursively build compound ELK nodes for nested sub-groups
    function buildSubGroup(sg) {
      const sgDirect = nodes.filter(n => nodeGroupMap[n.id_key] === sg.id)
      const sgNested = groups.filter(x => x.parentId === sg.id)
      return {
        id: sg.id,
        labels: [{ text: sg.label }],
        layoutOptions: {
          'elk.direction': sg.layoutDir === 'LR' ? 'RIGHT'
                         : sg.layoutDir === 'TD' ? 'DOWN'
                         : direction,
          'elk.padding': '[top=40,left=20,right=20,bottom=20]',
        },
        children: [
          ...sgDirect.map(n => elkLeafNode(n)),
          ...sgNested.map(cg => buildSubGroup(cg)),
        ],
      }
    }

    const directNodes = nodes.filter(n => nodeGroupMap[n.id_key] === g.id)
    const childGroups = groups.filter(x => x.parentId === g.id)

    // Guard: empty group gets a minimal placeholder
    if (directNodes.length === 0 && childGroups.length === 0) {
      groupLayouts[g.id] = { id: `pa_${g.id}`, x: 0, y: 0, width: 120, height: 60, children: [], edges: [] }
      return
    }

    groupLayouts[g.id] = await elk.layout({
      id: `pa_${g.id}`,
      layoutOptions: {
        ...commonOpts,
        'elk.direction': dir,
        'elk.padding': '[top=40,left=20,right=20,bottom=20]',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: [
        ...directNodes.map(n => elkLeafNode(n)),
        ...childGroups.map(cg => buildSubGroup(cg)),
      ],
      edges: intraEdges,
    })
  }

  // All Phase A layouts run in parallel
  await Promise.all(topLevelGroups.map(g => layoutTopLevelGroup(g)))

  // ── Phase B: meta-graph layout ────────────────────────────────────────────
  // Top-level groups are opaque meta-nodes (Phase A dimensions).
  // Ungrouped nodes participate as regular leaves.
  // ELK places everything with the global topDirection — no post-processing.

  const metaChildren = [
    ...ungroupedNodes.map(n => elkLeafNode(n)),
    ...topLevelGroups.map(g => {
      const pa = groupLayouts[g.id]
      return {
        id: g.id,
        width:  Math.ceil(pa?.width  ?? 200),
        height: Math.ceil(pa?.height ?? 100),
        labels: [{ text: g.label }],
      }
    }),
  ]

  // Cross-entity edges (inter-group or group↔ungrouped). Keep one meta edge per
  // original edge so ELK can account for routing density and parallel links.
  const metaEdges = []
  for (const [index, e] of edges.entries()) {
    const src = topLevelGroupOf(e.from) ?? e.from
    const tgt = topLevelGroupOf(e.to)   ?? e.to
    if (src === tgt) continue  // intra-group: handled in Phase A
    metaEdges.push({
      id: `e${index}`,
      sources: [src],
      targets: [tgt],
      labels: e.label && directives?.edgeLabels !== 'off' ? [{ text: e.label }] : [],
    })
  }

  const metaResult = await elk.layout({
    id: 'root',
    layoutOptions: {
      ...commonOpts,
      'elk.direction': direction,
      'elk.padding': '[top=20,left=20,right=20,bottom=20]',
    },
    children: metaChildren,
    edges: metaEdges,
  })

  // ── Phase C: compose ──────────────────────────────────────────────────────
  // Groups at Phase B position + Phase A internal layout as sub-tree.
  // Ungrouped nodes at Phase B position.
  // Intra-group edges: reuse Phase A ELK sections (translated to absolute coords).
  // Cross-group edges: reuse Phase B ELK sections when available; otherwise fall
  // back to the renderer synthesizer.

  const metaById = Object.fromEntries(
    (metaResult.children ?? []).map(c => [c.id, c])
  )

  // Collect Phase A edge sections (group-local coordinates — NO translation here).
  // DiagramRenderer's LCA logic already translates root-level edge sections by
  // the LCA group's absolute position, which is exactly (mc.x, mc.y). Translating
  // here too would double-offset every intra-group edge.
  const phaseAEdgeSections = {}  // edgeId → { sections, labels }
  for (const g of topLevelGroups) {
    const pa = groupLayouts[g.id]
    for (const paEdge of (pa?.edges ?? [])) {
      if (!paEdge.id || !paEdge.sections?.length) continue
      phaseAEdgeSections[paEdge.id] = {
        sections: paEdge.sections,
        labels:   paEdge.labels ?? [],
      }
    }
  }

  const metaEdgeSections = Object.fromEntries(
    (metaResult.edges ?? [])
      .filter(edge => edge.id && edge.sections?.length)
      .map(edge => [edge.id, { sections: edge.sections, labels: edge.labels ?? [] }])
  )

  const composedChildren = [
    // Ungrouped nodes: Phase B provides absolute position and size
    ...ungroupedNodes.map(n => {
      const mc = metaById[n.id_key] ?? {}
      return {
        id: n.id_key,
        x: mc.x ?? 0,
        y: mc.y ?? 0,
        width:  mc.width  ?? 140,
        height: mc.height ?? 50,
        labels: [{ text: n.label }],
        lines: linesMap[n.id_key],
        ...(bodyLinesMap[n.id_key] !== undefined ? { bodyLines: bodyLinesMap[n.id_key] } : {}),
        ...(headerHMap[n.id_key]   !== undefined ? { headerH:   headerHMap[n.id_key]   } : {}),
      }
    }),
    // Top-level groups: Phase B position + Phase A internal layout
    ...topLevelGroups.map(g => {
      const mc = metaById[g.id]     ?? {}
      const pa = groupLayouts[g.id] ?? {}
      annotateLines(pa.children)
      return {
        id: g.id,
        x: mc.x ?? 0,
        y: mc.y ?? 0,
        width:  pa.width  ?? mc.width  ?? 200,
        height: pa.height ?? mc.height ?? 100,
        labels: [{ text: g.label }],
        children: pa.children ?? [],
        edges: [],
      }
    }),
  ]

  // Build composedEdges:
  //  - Intra-group edges → use Phase A ELK sections (translated to absolute coords)
  //  - Cross-group / ungrouped edges → sections: [] for synthesizer routing
  const composedEdges = elkEdges.map(e => {
    const from = e.sources[0], to = e.targets[0]
    const fromGroup = topLevelGroupOf(from)
    const toGroup   = topLevelGroupOf(to)
    const isIntraGroup = fromGroup !== null && fromGroup === toGroup
    if (isIntraGroup) {
      const phaseA = phaseAEdgeSections[e.id]
      if (phaseA?.sections?.length) {
        return { ...e, sections: phaseA.sections, labels: phaseA.labels }
      }
    }
    const metaEdge = metaEdgeSections[e.id]
    if (metaEdge?.sections?.length) {
      return { ...e, sections: metaEdge.sections, labels: metaEdge.labels }
    }
    // Final fallback: synthesizer routes from node bounds
    return { ...e, sections: [] }
  })

  return {
    id: 'root',
    x: 0, y: 0,
    width:  metaResult.width  ?? 800,
    height: metaResult.height ?? 600,
    children: composedChildren,
    edges: composedEdges,
  }
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
