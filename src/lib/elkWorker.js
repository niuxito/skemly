// ELK layout worker — runs in Web Worker context
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

// Node sizing constants (matches renderer)
const BASE_WIDTH = 140
const BASE_HEIGHT = 50
const ICON_SIZE = 20
const PADDING_H = 24
const PADDING_V = 16
const MAX_WIDTH = 220
const CHAR_WIDTH = 7.5 // approx px per char in label

function estimateNodeSize(node) {
  const labelLen = (node.label || '').length
  const rawW = Math.min(labelLen * CHAR_WIDTH + PADDING_H * 2 + (node.icon ? ICON_SIZE + 8 : 0), MAX_WIDTH)
  const w = Math.max(rawW, BASE_WIDTH)
  const h = BASE_HEIGHT + (node.shape === 'diamond' ? 20 : 0)
  return { width: w, height: h }
}

self.onmessage = async (evt) => {
  const { nodes, edges, groups, directives } = evt.data

  const spacing = directives?.spacing ?? 40
  const direction = directives?.layout === 'LR' ? 'RIGHT' : 'DOWN'

  try {
    // Build ELK node map
    const nodeMap = {}
    for (const n of nodes) {
      const { width, height } = estimateNodeSize(n)
      nodeMap[n.id_key] = {
        id: n.id_key,
        width,
        height,
        labels: [{ text: n.label }],
        layoutOptions: {},
      }
    }

    // Build group containers
    const groupMap = {}
    for (const g of groups) {
      groupMap[g.id] = {
        id: g.id,
        labels: [{ text: g.label }],
        children: [],
        edges: [],
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.spacing.nodeNode': String(spacing),
          'elk.padding': '[top=40,left=20,right=20,bottom=20]',
        },
      }
    }

    // Nest children into groups
    // A node goes to its innermost group
    const nodeToGroup = {}
    for (const n of nodes) {
      if (n.groupIds && n.groupIds.length > 0) {
        const innermostId = n.groupIds[n.groupIds.length - 1]
        nodeToGroup[n.id_key] = innermostId
      }
    }

    // Build top-level ELK graph
    const rootChildren = []
    const rootEdges = []

    // Populate group children
    for (const [id_key, groupId] of Object.entries(nodeToGroup)) {
      groupMap[groupId].children.push(nodeMap[id_key])
    }

    // Nest sub-groups into parent groups
    for (const g of groups) {
      if (g.parentId && groupMap[g.parentId]) {
        groupMap[g.parentId].children.push(groupMap[g.id])
      } else {
        rootChildren.push(groupMap[g.id])
      }
    }

    // Top-level nodes (not in any group)
    for (const n of nodes) {
      if (!nodeToGroup[n.id_key]) {
        rootChildren.push(nodeMap[n.id_key])
      }
    }

    // Build edges — ELK needs edges at the correct hierarchy level
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]
      const edge = {
        id: `e${i}`,
        sources: [e.from],
        targets: [e.to],
        labels: e.label && directives?.edgeLabels !== 'off' ? [{ text: e.label }] : [],
      }

      // Determine which container owns this edge (LCA of from and to)
      const fromGroup = nodeToGroup[e.from]
      const toGroup = nodeToGroup[e.to]
      if (fromGroup && toGroup && fromGroup === toGroup) {
        groupMap[fromGroup].edges.push(edge)
      } else {
        rootEdges.push(edge)
      }
    }

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
        'elk.padding': '[top=20,left=20,right=20,bottom=20]',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: rootChildren,
      edges: rootEdges,
    }

    const layout = await elk.layout(graph)
    self.postMessage({ layout, error: null })
  } catch (err) {
    self.postMessage({ layout: null, error: err.message || String(err) })
  }
}
