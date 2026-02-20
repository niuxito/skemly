import { useState, useEffect, useRef } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import { mindmapLayout } from './mindmapLayout.js'

const elk = new ELK()

const BASE_WIDTH = 140
const BASE_HEIGHT = 50
const ICON_SIZE = 20
const PADDING_H = 24
const MAX_WIDTH = 220
const CHAR_WIDTH = 7.5

function estimateNodeSize(node) {
  const labelLen = (node.label || '').length
  const rawW = Math.min(
    labelLen * CHAR_WIDTH + PADDING_H * 2 + (node.icon ? ICON_SIZE + 8 : 0),
    MAX_WIDTH
  )
  return {
    width: Math.max(rawW, BASE_WIDTH),
    height: BASE_HEIGHT + (node.shape === 'diamond' ? 20 : 0),
  }
}

async function runLayout(ast) {
  // Mindmap mode — custom layout, skip ELK
  if (ast.directives?.layout === 'MM') {
    return mindmapLayout(ast)
  }
  const { nodes, edges, directives } = ast
  const spacing = directives?.spacing ?? 40
  const direction = directives?.layout === 'LR' ? 'RIGHT' : 'DOWN'

  // FLAT graph — no ELK groups. Group boxes are computed post-layout from node positions.
  const elkNodes = nodes.map(n => {
    const { width, height } = estimateNodeSize(n)
    return {
      id: n.id_key,
      width,
      height,
      labels: [{ text: n.label }],
    }
  })

  const elkEdges = edges.map((e, i) => ({
    id: `e${i}`,
    sources: [e.from],
    targets: [e.to],
    labels: e.label && directives?.edgeLabels !== 'off' ? [{ text: e.label }] : [],
  }))

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.5),
      'elk.padding': '[top=20,left=20,right=20,bottom=20]',
    },
    children: elkNodes,
    edges: elkEdges,
  }

  return elk.layout(graph)
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
