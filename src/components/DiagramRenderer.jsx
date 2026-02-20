import { useEffect, useRef, useState, useCallback } from 'react'
import rough from 'roughjs'
import { THEMES } from '../lib/themes.js'
import * as LucideIcons from 'lucide-react'

const ICON_SIZE = 18
const GROUP_PADDING = 18
const GROUP_LABEL_H = 24

// ─── Icon ─────────────────────────────────────────────────────────────────────
function IconSVG({ name, x, y, size = ICON_SIZE, color }) {
  const IconComp = LucideIcons[name]
  if (!IconComp) return null
  return (
    <foreignObject x={x - size / 2} y={y - size / 2} width={size} height={size}>
      <div xmlns="http://www.w3.org/1999/xhtml"
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconComp size={size} color={color} strokeWidth={1.5} />
      </div>
    </foreignObject>
  )
}

// ─── Tag style helper ─────────────────────────────────────────────────────────
function getTagStyle(tags, theme) {
  for (const p of ['danger', 'warning', 'info', 'safe']) {
    if (tags.includes(p)) return theme.tagColors[p]
  }
  return null
}

const MM_LINE_H = 17  // must match mindmapLayout.js LINE_H

// ─── Node shape ───────────────────────────────────────────────────────────────
function NodeShape({ node, elkNode, theme }) {
  const x = elkNode.x ?? 0
  const y = elkNode.y ?? 0
  const w = elkNode.width
  const h = elkNode.height
  const cx = x + w / 2
  const cy = y + h / 2

  const tagStyle = getTagStyle(node.tags || [], theme)
  const fill = tagStyle?.fill ?? theme.nodeFill
  const stroke = tagStyle?.stroke ?? theme.nodeStroke
  const textColor = tagStyle?.text ?? theme.nodeText

  const hasIcon = !!node.icon
  const lines = elkNode.lines   // set only for mindmap nodes with >1 line
  const isMultiLine = lines && lines.length > 1

  const glowFilter = theme.glow ? `drop-shadow(0 0 4px ${stroke})` : undefined

  function Shape() {
    switch (node.shape) {
      case 'box':
        return <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke}
          strokeWidth={theme.nodeStrokeWidth} filter={glowFilter} />
      case 'cylinder': {
        const rx = w / 2, ry = 10
        return (
          <g filter={glowFilter}>
            <ellipse cx={cx} cy={y + ry} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            <rect x={x} y={y + ry} width={w} height={h - ry * 2} fill={fill} stroke="none" />
            <line x1={x} y1={y + ry} x2={x} y2={y + h - ry} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            <line x1={x + w} y1={y + ry} x2={x + w} y2={y + h - ry} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            <ellipse cx={cx} cy={y + h - ry} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
          </g>
        )
      }
      case 'diamond': {
        const hw = w / 2, hh = h / 2
        const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`
        return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} filter={glowFilter} />
      }
      case 'cloud':
        return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={stroke}
          strokeWidth={theme.nodeStrokeWidth} strokeDasharray="4 2" filter={glowFilter} />
      default:
        return <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
    }
  }

  // Multi-line text: vertically center the text block, accounting for icon offset
  function renderText() {
    const textYOffset = hasIcon ? 10 : 0  // shift text down when icon is above
    if (isMultiLine) {
      // Center of text block sits at cy + textYOffset
      const blockCY = cy + textYOffset
      const firstLineY = blockCY - (lines.length - 1) * MM_LINE_H / 2
      return (
        <text x={cx} y={firstLineY} textAnchor="middle" dominantBaseline="middle"
          fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {lines.map((line, i) => (
            <tspan key={i} x={cx} dy={i === 0 ? 0 : MM_LINE_H}>{line}</tspan>
          ))}
        </text>
      )
    }
    return (
      <text x={cx} y={cy + textYOffset + 5} textAnchor="middle" dominantBaseline="middle"
        fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
        style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {node.label}
      </text>
    )
  }

  const iconY = cy - (hasIcon ? 10 : 0)

  return (
    <g>
      <Shape />
      {hasIcon && <IconSVG name={node.icon} x={cx} y={iconY} color={textColor} />}
      {renderText()}
    </g>
  )
}

// ─── Edge ─────────────────────────────────────────────────────────────────────
function EdgePath({ edge, elkEdge, directives, theme, isMindmap }) {
  if (!elkEdge?.sections?.length) return null

  const sec = elkEdge.sections[0]
  let d

  if (sec.isBezier && sec.cp1 && sec.cp2) {
    // Smooth bezier curve for mindmap edges
    d = `M${sec.startPoint.x},${sec.startPoint.y} C${sec.cp1.x},${sec.cp1.y} ${sec.cp2.x},${sec.cp2.y} ${sec.endPoint.x},${sec.endPoint.y}`
  } else {
    // Orthogonal path for regular diagrams (concatenate all sections)
    d = ''
    for (const s of elkEdge.sections) {
      const pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint]
      pts.forEach((p, i) => { d += `${i === 0 && d === '' ? 'M' : 'L'}${p.x},${p.y} ` })
    }
    d = d.trim()
  }

  const showLabels = directives?.edgeLabels !== 'off'
  const labelEl = elkEdge.labels?.[0]
  const isBidi = edge.dir === '<->'
  const glowFilter = theme.glow ? `drop-shadow(0 0 3px ${theme.edgeStroke})` : undefined

  // Mindmap: thicker strokes, no arrowheads
  const stroke = theme.edgeStroke
  const strokeW = isMindmap ? theme.edgeStrokeWidth + 0.5 : theme.edgeStrokeWidth

  return (
    <g>
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeW}
        strokeLinecap="round"
        markerEnd={isMindmap ? undefined : 'url(#arrowhead)'}
        markerStart={!isMindmap && isBidi ? 'url(#arrowhead-start)' : undefined}
        filter={glowFilter} />
      {showLabels && labelEl && edge.label && (
        <text x={labelEl.x + (labelEl.width ?? 0) / 2} y={labelEl.y + (labelEl.height ?? 0) / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontFamily={theme.font} fontSize={theme.fontSize - 1} fill={theme.labelText}
          style={{ userSelect: 'none' }}>
          {edge.label}
        </text>
      )}
    </g>
  )
}

// ─── Group box (computed from node positions, not ELK hierarchy) ──────────────
function GroupRect({ group, bounds, theme }) {
  if (!bounds) return null
  const { x, y, width: w, height: h } = bounds
  const tagStyle = group.tag ? theme.tagColors[group.tag] : null
  const fill = tagStyle?.fill ?? theme.groupFill
  const stroke = tagStyle?.stroke ?? theme.groupStroke
  const textColor = tagStyle?.text ?? theme.groupText

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8}
        fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={x + 12} y={y + 16} fontFamily={theme.font} fontSize={theme.fontSize - 1}
        fontWeight="600" fill={textColor} style={{ userSelect: 'none' }}>
        {group.label}
      </text>
    </g>
  )
}

// ─── Rough canvas overlay (handdrawn theme) ───────────────────────────────────
function RoughOverlay({ ast, nodeMap, theme, totalW, totalH, canvasRef: externalRef }) {
  const internalRef = useRef(null)
  const canvasRef = externalRef ?? internalRef

  useEffect(() => {
    if (!canvasRef.current || !ast || !nodeMap) return
    const canvas = canvasRef.current
    canvas.width = totalW
    canvas.height = totalH
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, totalW, totalH)
    const rc = rough.canvas(canvas)

    for (const node of ast.nodes) {
      const en = nodeMap[node.id_key]
      if (!en) continue
      const { x = 0, y = 0, width: w, height: h } = en
      const cx = x + w / 2, cy = y + h / 2
      const tagStyle = getTagStyle(node.tags || [], theme)
      const fill = tagStyle?.fill ?? theme.nodeFill
      const stroke = tagStyle?.stroke ?? theme.nodeStroke
      const opts = { fill, fillStyle: 'solid', stroke, strokeWidth: theme.nodeStrokeWidth, roughness: 1.2, bowing: 0.8 }

      switch (node.shape) {
        case 'box': rc.rectangle(x, y, w, h, opts); break
        case 'cylinder':
          rc.rectangle(x, y + 8, w, h - 16, { ...opts, stroke: 'none' })
          rc.ellipse(cx, y + 8, w, 16, opts)
          rc.ellipse(cx, y + h - 8, w, 16, opts)
          rc.line(x, y + 8, x, y + h - 8, { stroke, strokeWidth: opts.strokeWidth, roughness: 1 })
          rc.line(x + w, y + 8, x + w, y + h - 8, { stroke, strokeWidth: opts.strokeWidth, roughness: 1 })
          break
        case 'diamond':
          rc.polygon([[cx, cy - h / 2], [cx + w / 2, cy], [cx, cy + h / 2], [cx - w / 2, cy]], opts); break
        case 'cloud':
          rc.rectangle(x, y, w, h, { ...opts, roughness: 2 }); break
        default: rc.rectangle(x, y, w, h, opts)
      }
    }
  }, [ast, nodeMap, theme, totalW, totalH])

  return <canvas ref={canvasRef}
    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    width={totalW} height={totalH} />
}

// ─── Post-layout group bounds computation ─────────────────────────────────────
function computeGroupBounds(groups, nodeMap) {
  const bounds = {}
  // Sort groups so parent groups are computed after children (innermost first)
  const sorted = [...groups].sort((a, b) => {
    // Groups with no parentId come last (outermost)
    if (!a.parentId && b.parentId) return 1
    if (a.parentId && !b.parentId) return -1
    return 0
  })

  for (const g of sorted) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const nodeId of g.nodeIds) {
      const n = nodeMap[nodeId]
      if (!n) continue
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    }

    // Include child group bounds in parent
    for (const child of groups) {
      if (child.parentId === g.id && bounds[child.id]) {
        const cb = bounds[child.id]
        minX = Math.min(minX, cb.x)
        minY = Math.min(minY, cb.y)
        maxX = Math.max(maxX, cb.x + cb.width)
        maxY = Math.max(maxY, cb.y + cb.height)
      }
    }

    if (minX === Infinity) continue

    bounds[g.id] = {
      x: minX - GROUP_PADDING,
      y: minY - GROUP_PADDING - GROUP_LABEL_H,
      width: maxX - minX + GROUP_PADDING * 2,
      height: maxY - minY + GROUP_PADDING * 2 + GROUP_LABEL_H,
    }
  }
  return bounds
}

// ─── Main DiagramRenderer ─────────────────────────────────────────────────────
export default function DiagramRenderer({ ast, elkLayout, svgRef, canvasRef }) {
  const themeName = ast?.directives?.vibe ?? 'clean'
  const theme = THEMES[themeName] ?? THEMES.clean
  const containerRef = useRef(null)

  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const lastMouse = useRef(null)

  // Build flat lookup maps from ELK layout (flat graph — all nodes at root)
  const { nodeMap, edgeMap } = buildFlatLayoutMap(elkLayout)
  const groupBounds = ast && nodeMap ? computeGroupBounds(ast.groups ?? [], nodeMap) : {}

  const totalW = elkLayout?.width ?? 800
  const totalH = elkLayout?.height ?? 600

  function buildFlatLayoutMap(layout) {
    if (!layout) return { nodeMap: null, edgeMap: null }
    const nodeMap = {}
    const edgeMap = {}
    for (const child of layout.children ?? []) {
      nodeMap[child.id] = child
    }
    for (const edge of layout.edges ?? []) {
      edgeMap[edge.id] = edge
    }
    return { nodeMap, edgeMap }
  }

  // Fit to view
  const fitView = useCallback(() => {
    if (!containerRef.current || !elkLayout) return
    const { clientWidth: cw, clientHeight: ch } = containerRef.current
    const margin = 40
    const newZoom = Math.min((cw - margin * 2) / totalW, (ch - margin * 2) / totalH, 2)
    setZoom(newZoom)
    setPan({ x: (cw - totalW * newZoom) / 2, y: (ch - totalH * newZoom) / 2 })
  }, [elkLayout, totalW, totalH])

  useEffect(() => { if (elkLayout) fitView() }, [elkLayout, fitView])

  const onMouseDown = (e) => {
    if (e.button !== 0) return
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }
  const onMouseUp = () => { dragging.current = false }
  const onWheel = (e) => {
    e.preventDefault()
    setZoom(z => Math.max(0.1, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }

  if (!ast || !elkLayout || !nodeMap) {
    return (
      <div className="flex items-center justify-center h-full text-sm"
        style={{ background: theme.canvasBg, color: theme.nodeText, fontFamily: theme.font }}>
        {ast?.nodes?.length === 0 ? 'Start typing DSL on the left…' : 'Computing layout…'}
      </div>
    )
  }

  return (
    <div ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: theme.canvasBg, cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>

      <button
        className="absolute top-3 right-3 z-10 px-2 py-1 rounded text-xs opacity-70 hover:opacity-100 transition-opacity"
        style={{ background: theme.nodeFill, color: theme.nodeText, border: `1px solid ${theme.nodeStroke}`, fontFamily: theme.font }}
        onClick={fitView} onMouseDown={e => e.stopPropagation()}>
        Fit
      </button>

      {/* Rough canvas — rendered BEFORE the SVG so shapes stay behind text/edges */}
      {theme.rough && nodeMap && (
        <div style={{
          position: 'absolute',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}>
          <RoughOverlay ast={ast} nodeMap={nodeMap} theme={theme} totalW={totalW} totalH={totalH} canvasRef={canvasRef} />
        </div>
      )}

      <svg ref={svgRef} width={totalW} height={totalH}
        style={{
          position: 'absolute',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          overflow: 'visible',
        }}
        xmlns="http://www.w3.org/2000/svg" data-theme={themeName}>

        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={theme.arrowFill} />
          </marker>
          <marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill={theme.arrowFill} />
          </marker>
        </defs>

        {/* Groups rendered behind everything */}
        {ast.groups.map(g => (
          <GroupRect key={g.id} group={g} bounds={groupBounds[g.id]} theme={theme} />
        ))}

        {/* Edges */}
        {ast.edges.map((edge, i) => (
          <EdgePath key={i} edge={edge} elkEdge={edgeMap[`e${i}`]}
            directives={ast.directives} theme={theme} isMindmap={!!elkLayout.isMindmap} />
        ))}

        {/* Nodes (SVG shapes for clean/cyberpunk) */}
        {!theme.rough && ast.nodes.map(node => {
          const elkNode = nodeMap[node.id_key]
          if (!elkNode) return null
          return <NodeShape key={node.id_key} node={node} elkNode={elkNode} theme={theme} />
        })}

        {/* Text labels only for rough (shapes drawn on canvas) */}
        {theme.rough && ast.nodes.map(node => {
          const elkNode = nodeMap[node.id_key]
          if (!elkNode) return null
          const { x = 0, y = 0, width: w, height: h } = elkNode
          const cx = x + w / 2, cy = y + h / 2
          const hasIcon = !!node.icon
          const lines = elkNode.lines
          const isMultiLine = lines && lines.length > 1
          const tagStyle = getTagStyle(node.tags || [], theme)
          const textColor = tagStyle?.text ?? theme.nodeText
          const textYOffset = hasIcon ? 10 : 0
          return (
            <g key={node.id_key}>
              {hasIcon && <IconSVG name={node.icon} x={cx} y={cy - 10} color={textColor} />}
              {isMultiLine ? (
                <text x={cx} y={cy + textYOffset - (lines.length - 1) * MM_LINE_H / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {lines.map((line, i) => (
                    <tspan key={i} x={cx} dy={i === 0 ? 0 : MM_LINE_H}>{line}</tspan>
                  ))}
                </text>
              ) : (
                <text x={cx} y={cy + textYOffset + 5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {node.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
