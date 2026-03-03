import { useEffect, useRef, useState, useCallback } from 'react'
import rough from 'roughjs'
import { THEMES } from '../lib/themes.js'
import * as LucideIcons from 'lucide-react'
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react'

const ICON_SIZE = 18
const CARD_BODY_LINE_H = 15
const CARD_BODY_PADDING = 8

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
function NodeShape({ node, elkNode, theme, isEditing }) {
  const x = elkNode.x ?? 0
  const y = elkNode.y ?? 0
  const w = elkNode.width
  const h = elkNode.height
  const cx = x + w / 2
  const cy = y + h / 2

  const tagStyle = getTagStyle(node.tags || [], theme)
  const fill = node.bgColor ?? tagStyle?.fill ?? theme.nodeFill
  const stroke = tagStyle?.stroke ?? theme.nodeStroke
  const textColor = node.textColor ?? tagStyle?.text ?? theme.nodeText

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
            <rect x={x} y={y + ry} width={w} height={h - ry * 2} fill={fill} stroke="none" />
            <line x1={x} y1={y + ry} x2={x} y2={y + h - ry} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            <line x1={x + w} y1={y + ry} x2={x + w} y2={y + h - ry} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            {/* Bottom rim: fill="none" so text above isn't visually covered */}
            <ellipse cx={cx} cy={y + h - ry} rx={rx} ry={ry} fill="none" stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            {/* Top face drawn last so it appears above the body */}
            <ellipse cx={cx} cy={y + ry} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
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
      case 'card': {
        const headerH = elkNode.headerH ?? 36
        return (
          <g filter={glowFilter}>
            <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
            <line x1={x + 1} y1={y + headerH} x2={x + w - 1} y2={y + headerH}
              stroke={stroke} strokeWidth={Math.max(theme.nodeStrokeWidth * 0.75, 0.75)} strokeOpacity={0.5} />
          </g>
        )
      }
      default:
        return <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={theme.nodeStrokeWidth} />
    }
  }

  // Multi-line text: vertically center the text block, accounting for icon offset
  const textVisibility = isEditing ? 'hidden' : 'visible'

  function renderText() {
    if (node.shape === 'card') {
      const headerH = elkNode.headerH ?? 36
      const headerCY = y + headerH / 2
      const bodyLines = elkNode.bodyLines ?? []
      const bodyFontSize = Math.max(theme.fontSize - 2, 10)
      const textX = hasIcon ? x + 16 + ICON_SIZE * 1.5 : cx
      const anchor = hasIcon ? 'start' : 'middle'
      return (
        <g visibility={textVisibility} style={{ userSelect: 'none', pointerEvents: 'none' }}>
          <text x={textX} y={headerCY} textAnchor={anchor} dominantBaseline="middle"
            fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor} fontWeight="600">
            {node.label}
          </text>
          {bodyLines.length > 0 && (
            <text x={x + 12} y={y + headerH + CARD_BODY_PADDING}
              textAnchor="start" dominantBaseline="hanging"
              fontFamily={theme.font} fontSize={bodyFontSize} fill={textColor} fillOpacity={0.75}>
              {bodyLines.map((line, i) => (
                <tspan key={i} x={x + 12} dy={i === 0 ? 0 : CARD_BODY_LINE_H}>{line}</tspan>
              ))}
            </text>
          )}
        </g>
      )
    }

    const textYOffset = hasIcon ? 10 : 0  // shift text down when icon is above
    if (isMultiLine) {
      // Center of text block sits at cy + textYOffset
      const blockCY = cy + textYOffset
      const firstLineY = blockCY - (lines.length - 1) * MM_LINE_H / 2
      return (
        <text x={cx} y={firstLineY} textAnchor="middle" dominantBaseline="middle"
          fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
          fontWeight={node.bold ? 'bold' : undefined}
          textDecoration={node.underline ? 'underline' : undefined}
          visibility={textVisibility}
          style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {lines.map((line, i) => (
            <tspan key={i} x={cx} dy={i === 0 ? 0 : MM_LINE_H}>{line}</tspan>
          ))}
        </text>
      )
    }
    // Cylinder: center in the body between ellipse caps (cy is already the body center).
    // Other shapes: +1 compensates for visual baseline rendering.
    const textY = node.shape === 'cylinder' ? cy + textYOffset : cy + textYOffset + 1
    return (
      <text x={cx} y={textY} textAnchor="middle" dominantBaseline="middle"
        fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
        fontWeight={node.bold ? 'bold' : undefined}
        textDecoration={node.underline ? 'underline' : undefined}
        visibility={textVisibility}
        style={{ userSelect: 'none', pointerEvents: 'none' }}>
        {node.label}
      </text>
    )
  }

  const isCard = node.shape === 'card'
  const cardHeaderH = isCard ? (elkNode.headerH ?? 36) : 0
  const iconY = isCard ? y + cardHeaderH / 2 : cy - (hasIcon ? 10 : 0)
  const iconX = isCard ? x + 16 + ICON_SIZE / 2 : cx

  return (
    <g>
      <Shape />
      {hasIcon && <IconSVG name={node.icon} x={iconX} y={iconY} color={textColor} />}
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
  const isBidi = edge.dir === '<->'
  const glowFilter = theme.glow ? `drop-shadow(0 0 3px ${theme.edgeStroke})` : undefined

  // Mindmap: thicker strokes, no arrowheads
  const stroke = theme.edgeStroke
  const strokeW = isMindmap ? theme.edgeStrokeWidth + 0.5 : theme.edgeStrokeWidth

  // Compute label position from the actual path midpoint.
  // ELK's label x/y are computed during DOWN layout and become stale after LR
  // post-processing (groups repositioned, sections translated but labels not).
  // Using path midpoint is always correct regardless of layout direction.
  let labelMidX, labelMidY
  if (showLabels && edge.label && elkEdge.sections?.length) {
    const firstSec = elkEdge.sections[0]
    const lastSec  = elkEdge.sections[elkEdge.sections.length - 1]
    if (firstSec.isBezier && firstSec.cp1 && firstSec.cp2) {
      // Cubic bezier midpoint at t=0.5
      const t = 0.5, mt = 1 - t
      labelMidX = mt**3*firstSec.startPoint.x + 3*mt**2*t*firstSec.cp1.x + 3*mt*t**2*firstSec.cp2.x + t**3*firstSec.endPoint.x
      labelMidY = mt**3*firstSec.startPoint.y + 3*mt**2*t*firstSec.cp1.y + 3*mt*t**2*firstSec.cp2.y + t**3*firstSec.endPoint.y
    } else {
      // Collect all path points, take midpoint of middle segment
      const allPts = []
      for (const s of elkEdge.sections) {
        allPts.push(s.startPoint, ...(s.bendPoints || []))
      }
      allPts.push(lastSec.endPoint)
      const midIdx = Math.floor((allPts.length - 1) / 2)
      const p1 = allPts[midIdx], p2 = allPts[midIdx + 1] ?? allPts[midIdx]
      labelMidX = (p1.x + p2.x) / 2
      labelMidY = (p1.y + p2.y) / 2
    }
  }

  return (
    <g>
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeW}
        strokeLinecap="round"
        markerEnd={isMindmap ? undefined : 'url(#arrowhead)'}
        markerStart={!isMindmap && isBidi ? 'url(#arrowhead-start)' : undefined}
        filter={glowFilter} />
      {showLabels && edge.label && labelMidX != null && (
        <text x={labelMidX} y={labelMidY}
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
        fill={fill} fillOpacity={theme.groupFillOpacity ?? 1}
        stroke={stroke} strokeWidth={1.5} strokeDasharray="6 3" />
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
      const fill = node.bgColor ?? tagStyle?.fill ?? theme.nodeFill
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
        case 'card': {
          rc.rectangle(x, y, w, h, opts)
          const headerH = en.headerH ?? 36
          rc.line(x + 1, y + headerH, x + w - 1, y + headerH, {
            stroke: opts.stroke, strokeWidth: (opts.strokeWidth ?? 1) * 0.75, roughness: 0.5,
          })
          break
        }
        default: rc.rectangle(x, y, w, h, opts)
      }
    }
  }, [ast, nodeMap, theme, totalW, totalH])

  return <canvas ref={canvasRef}
    style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    width={totalW} height={totalH} />
}


// ─── Main DiagramRenderer ─────────────────────────────────────────────────────
export default function DiagramRenderer({ ast, elkLayout, svgRef, canvasRef, onNodeLabelChange, emptyHint }) {
  const themeName = ast?.directives?.vibe ?? 'clean'
  const theme = THEMES[themeName] ?? THEMES.clean
  const containerRef = useRef(null)

  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const lastMouse = useRef(null)
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 20, y: 20 })
  const lastTouches = useRef(null)

  // Keep refs in sync for use in non-React event handlers
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // ─── Inline editing state ──────────────────────────────────────────────────
  const [editingNodeId, setEditingNodeId] = useState(null)
  const [editingValue, setEditingValue] = useState('')

  const commitEdit = useCallback(() => {
    const trimmed = editingValue.trim()
    if (editingNodeId && trimmed) {
      const origNode = ast?.nodes?.find(n => n.id_key === editingNodeId)
      if (origNode && trimmed !== origNode.label) {
        onNodeLabelChange?.(editingNodeId, trimmed)
      }
    }
    setEditingNodeId(null)
  }, [editingNodeId, editingValue, ast, onNodeLabelChange])

  const openEdit = useCallback((node) => {
    setEditingNodeId(node.id_key)
    setEditingValue(node.label)
  }, [])

  // Click = open URL (with delay to avoid firing on dblclick); dblclick = edit label
  const clickTimerRef = useRef(null)
  const handleNodeClick = useCallback((node) => {
    if (!node.url) return
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      window.open(node.url, '_blank', 'noopener,noreferrer')
      clickTimerRef.current = null
    }, 250)
  }, [])
  const handleNodeDblClick = useCallback((node) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null }
    openEdit(node)
  }, [openEdit])

  // Build lookup maps from ELK layout (supports hierarchical compound nodes for groups)
  const { nodeMap, edgeMap, groupMap } = buildFlatLayoutMap(elkLayout)

  const totalW = elkLayout?.width ?? 800
  const totalH = elkLayout?.height ?? 600

  function buildFlatLayoutMap(layout) {
    if (!layout) return { nodeMap: null, edgeMap: null, groupMap: {} }
    const nodeMap = {}
    const edgeMap = {}
    const groupMap = {}
    const groupParentId = {}  // groupId → parent groupId (null = top-level)

    // Translate an edge's section points by an absolute offset
    function translateEdge(edge, dx, dy) {
      if (!dx && !dy) return edge
      return {
        ...edge,
        sections: edge.sections?.map(s => ({
          ...s,
          startPoint: { x: s.startPoint.x + dx, y: s.startPoint.y + dy },
          endPoint:   { x: s.endPoint.x   + dx, y: s.endPoint.y   + dy },
          bendPoints: s.bendPoints?.map(p => ({ x: p.x + dx, y: p.y + dy })),
        })),
        labels: edge.labels?.map(l => ({ ...l, x: (l.x ?? 0) + dx, y: (l.y ?? 0) + dy })),
      }
    }

    // node id → immediate parent group id
    const nodeGroupId = {}

    // Traverse nested ELK children accumulating absolute offsets.
    function traverse(children, offsetX, offsetY, parentGroupId) {
      for (const child of children ?? []) {
        const absX = (child.x ?? 0) + offsetX
        const absY = (child.y ?? 0) + offsetY
        if (child.children?.length) {
          groupMap[child.id] = { x: absX, y: absY, width: child.width, height: child.height }
          groupParentId[child.id] = parentGroupId   // track group hierarchy
          traverse(child.children, absX, absY, child.id)
          // Collect any edges ELK placed inside the compound node (translate to root coords)
          for (const edge of child.edges ?? []) {
            edgeMap[edge.id] = translateEdge(edge, absX, absY)
          }
        } else {
          nodeMap[child.id] = { ...child, x: absX, y: absY }
          if (parentGroupId) nodeGroupId[child.id] = parentGroupId
        }
      }
    }

    traverse(layout.children, 0, 0, null)

    // With INCLUDE_CHILDREN, ELK returns ALL edges at root level.
    // Edge coordinates are relative to the LOWEST COMMON ANCESTOR (LCA) group
    // of both endpoints. For cross-top-level edges the LCA is root → absolute.
    // For intra-group edges (e.g. both within Broker) the LCA is that group.
    //
    // We find the LCA and translate the edge by that group's absolute position.
    function lcaGroup(nodeAId, nodeBId) {
      const aAncestors = new Set()
      let g = nodeGroupId[nodeAId]
      while (g) { aAncestors.add(g); g = groupParentId[g] ?? null }
      g = nodeGroupId[nodeBId]
      while (g) { if (aAncestors.has(g)) return g; g = groupParentId[g] ?? null }
      return null  // no common group ancestor → root-relative (no translation needed)
    }

    for (const edge of layout.edges ?? []) {
      const srcId = edge.sources?.[0]
      const tgtId = edge.targets?.[0]
      const lca = lcaGroup(srcId, tgtId)
      if (lca) {
        const g = groupMap[lca]
        edgeMap[edge.id] = g ? translateEdge(edge, g.x, g.y) : edge
      } else {
        // Cross-top-level-group or ungrouped: coordinates are already absolute
        edgeMap[edge.id] = edge
      }
    }
    return { nodeMap, edgeMap, groupMap }
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

  // Trigger fitView when the container transitions from hidden (size 0) to visible
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevSize = { w: 0, h: 0 }
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if ((prevSize.w === 0 || prevSize.h === 0) && w > 0 && h > 0) {
          fitView()
        }
        prevSize.w = w
        prevSize.h = h
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [fitView])


  const onMouseDown = (e) => {
    if (e.button !== 0) return
    if (editingNodeId) return  // don't drag while editing
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

  // Cursor-centered wheel zoom, slower factor
  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.95 : 1.05
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const z = zoomRef.current
    const p = panRef.current
    const newZ = Math.max(0.1, Math.min(4, z * factor))
    setZoom(newZ)
    setPan({ x: cx - (cx - p.x) * (newZ / z), y: cy - (cy - p.y) * (newZ / z) })
  }

  // Touch: one finger = pan, two fingers = pinch zoom
  const onTouchStart = (e) => {
    if (editingNodeId) return
    const touches = Array.from(e.touches)
    lastTouches.current = {
      touches,
      dist: touches.length >= 2
        ? Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
        : null,
    }
  }
  const onTouchEnd = () => { lastTouches.current = null }

  // touchmove must be non-passive to call preventDefault (prevent page zoom on tablet)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e) => {
      if (!lastTouches.current) return
      e.preventDefault()
      const touches = Array.from(e.touches)
      const prev = lastTouches.current
      if (touches.length === 1 && prev.touches.length === 1) {
        const dx = touches[0].clientX - prev.touches[0].clientX
        const dy = touches[0].clientY - prev.touches[0].clientY
        setPan(p => ({ x: p.x + dx, y: p.y + dy }))
      } else if (touches.length >= 2) {
        const newDist = Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY,
        )
        if (prev.dist) {
          const factor = newDist / prev.dist
          const midX = (touches[0].clientX + touches[1].clientX) / 2
          const midY = (touches[0].clientY + touches[1].clientY) / 2
          const rect = el.getBoundingClientRect()
          const cx = midX - rect.left
          const cy = midY - rect.top
          const z = zoomRef.current
          const p = panRef.current
          const newZ = Math.max(0.1, Math.min(4, z * factor))
          setZoom(newZ)
          setPan({ x: cx - (cx - p.x) * (newZ / z), y: cy - (cy - p.y) * (newZ / z) })
        }
      }
      lastTouches.current = {
        touches,
        dist: touches.length >= 2
          ? Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
          : null,
      }
    }
    el.addEventListener('touchmove', handler, { passive: false })
    return () => el.removeEventListener('touchmove', handler)
  }, [elkLayout]) // re-attach when main container mounts

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement
      setIsFullscreen(isFs)
      if (!isFs) {
        // Wait two frames for the browser to restore layout before refitting
        requestAnimationFrame(() => requestAnimationFrame(() => fitView()))
      }
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [fitView])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenEnabled) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen()
    }
  }, [])

  // Zoom buttons: zoom around viewport center
  const zoomBy = useCallback((factor) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.width / 2
    const cy = rect.height / 2
    const z = zoomRef.current
    const p = panRef.current
    const newZ = Math.max(0.1, Math.min(4, z * factor))
    setZoom(newZ)
    setPan({ x: cx - (cx - p.x) * (newZ / z), y: cy - (cy - p.y) * (newZ / z) })
  }, [])

  if (!ast || !elkLayout || !nodeMap) {
    return (
      <div className="flex items-center justify-center h-full text-sm"
        style={{ background: theme.canvasBg, color: theme.nodeText, fontFamily: theme.font }}>
        {ast?.nodes?.length === 0 ? (emptyHint ?? 'Computing layout…') : 'Computing layout…'}
      </div>
    )
  }

  return (
    <div ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: theme.canvasBg, cursor: dragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove}
      onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Zoom controls */}
      <div
        className="absolute top-3 right-3 z-10 flex items-stretch rounded overflow-hidden opacity-70 hover:opacity-100 transition-opacity"
        style={{ border: `1px solid ${theme.nodeStroke}`, fontFamily: theme.font }}
        onMouseDown={e => e.stopPropagation()}
      >
        {[['−', 0.8], ['+', 1.25]].map(([label, factor]) => (
          <button key={label} onClick={() => zoomBy(factor)}
            className="px-2 py-1 text-xs transition-colors hover:brightness-90"
            style={{ background: theme.nodeFill, color: theme.nodeText, borderRight: `1px solid ${theme.nodeStroke}` }}>
            {label}
          </button>
        ))}
        <span className="px-2 py-1 text-xs cursor-default select-none"
          style={{ background: theme.nodeFill, color: theme.nodeText, minWidth: '3rem', textAlign: 'center', borderRight: `1px solid ${theme.nodeStroke}` }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={fitView}
          className="px-2 py-1 text-xs transition-colors hover:brightness-90"
          style={{ background: theme.nodeFill, color: theme.nodeText, borderRight: document.fullscreenEnabled ? `1px solid ${theme.nodeStroke}` : undefined }}>
          Fit
        </button>
        {document.fullscreenEnabled && (
          <button onClick={toggleFullscreen}
            className="px-2 py-1 text-xs transition-colors hover:brightness-90 flex items-center"
            style={{ background: theme.nodeFill, color: theme.nodeText }}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        )}
      </div>

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
          <GroupRect key={g.id} group={g} bounds={groupMap[g.id]} theme={theme} />
        ))}

        {/* Edges */}
        {ast.edges.map((edge, i) => {
          let elkEdge = edgeMap[`e${i}`]
          // Fallback for cross-group edges with missing or empty sections.
          // Synthesizes an orthogonal S-shaped path routing through the gap between
          // nodes, avoiding crossing intermediate shapes.
          // NOTE: never touch mindmap edges — they use isBezier sections without bendPoints.
          if (nodeMap && !elkLayout.isMindmap) {
            const sec = elkEdge?.sections
            // Sections present but bendPoints cleared (LR post-processing translated
            // start/end) → add orthogonal bends between the two attachment points.
            // Guard: skip bezier sections (mindmap edges use isBezier + cp1/cp2).
            const needsBends = sec?.length && sec.every(s => !s.isBezier && !s.bendPoints?.length)
            // No sections at all → compute attachment points from node bounds too.
            const noSections = !sec?.length

            if (needsBends || noSections) {
              const src = nodeMap[edge.from]
              const tgt = nodeMap[edge.to]
              if (src && tgt) {
                let startPoint, endPoint

                if (needsBends) {
                  // Use already-translated attachment points from ELK
                  startPoint = sec[0].startPoint
                  endPoint   = sec[sec.length - 1].endPoint
                } else {
                  // Compute attachment points from node bounds
                  const srcCX = src.x + src.width / 2,  srcCY = src.y + src.height / 2
                  const tgtCX = tgt.x + tgt.width / 2,  tgtCY = tgt.y + tgt.height / 2
                  const dx = tgtCX - srcCX, dy = tgtCY - srcCY
                  if (Math.abs(dx) >= Math.abs(dy)) {
                    startPoint = dx > 0 ? { x: src.x + src.width, y: srcCY } : { x: src.x, y: srcCY }
                    endPoint   = dx > 0 ? { x: tgt.x, y: tgtCY }             : { x: tgt.x + tgt.width, y: tgtCY }
                  } else {
                    startPoint = dy > 0 ? { x: srcCX, y: src.y + src.height } : { x: srcCX, y: src.y }
                    endPoint   = dy > 0 ? { x: tgtCX, y: tgt.y }              : { x: tgtCX, y: tgt.y + tgt.height }
                  }
                }

                // Build orthogonal S-shaped bend through the midpoint of the gap
                const adx = Math.abs(endPoint.x - startPoint.x)
                const ady = Math.abs(endPoint.y - startPoint.y)
                let bendPoints
                if (adx >= ady) {
                  // Horizontal dominant: exit right/left, bend at gap midpoint, enter left/right
                  const midX = (startPoint.x + endPoint.x) / 2
                  bendPoints = [{ x: midX, y: startPoint.y }, { x: midX, y: endPoint.y }]
                } else {
                  // Vertical dominant: exit bottom/top, bend at gap midpoint, enter top/bottom
                  const midY = (startPoint.y + endPoint.y) / 2
                  bendPoints = [{ x: startPoint.x, y: midY }, { x: endPoint.x, y: midY }]
                }

                elkEdge = { ...elkEdge, sections: [{ startPoint, endPoint, bendPoints }] }
              }
            }
          }
          return <EdgePath key={i} edge={edge} elkEdge={elkEdge}
            directives={ast.directives} theme={theme} isMindmap={!!elkLayout.isMindmap} />
        })}

        {/* Nodes (SVG shapes for clean/cyberpunk) */}
        {!theme.rough && ast.nodes.map(node => {
          const elkNode = nodeMap[node.id_key]
          if (!elkNode) return null
          const isEditing = editingNodeId === node.id_key
          const tagStyle = getTagStyle(node.tags || [], theme)
          const textColor = node.textColor ?? tagStyle?.text ?? theme.nodeText
          const { x = 0, y = 0, width: w } = elkNode
          return (
            <g key={node.id_key} onDoubleClick={e => { e.stopPropagation(); handleNodeDblClick(node) }}
              style={{ cursor: onNodeLabelChange ? 'default' : undefined }}>
              <NodeShape node={node} elkNode={elkNode} theme={theme} isEditing={isEditing} />
              {node.url && (
                <foreignObject x={x + w - 14} y={y + 3} width={11} height={11} style={{ pointerEvents: 'none' }}>
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 11, height: 11, display: 'flex', opacity: 0.55 }}>
                    <ExternalLink size={10} color={textColor} strokeWidth={2} />
                  </div>
                </foreignObject>
              )}
            </g>
          )
        })}

        {/* Text labels only for rough (shapes drawn on canvas) */}
        {theme.rough && ast.nodes.map(node => {
          const elkNode = nodeMap[node.id_key]
          if (!elkNode) return null
          const { x = 0, y = 0, width: w, height: h } = elkNode
          const cx = x + w / 2, cy = y + h / 2
          const isEditing = editingNodeId === node.id_key
          const hasIcon = !!node.icon
          const lines = elkNode.lines
          const isMultiLine = lines && lines.length > 1
          const tagStyle = getTagStyle(node.tags || [], theme)
          const textColor = node.textColor ?? tagStyle?.text ?? theme.nodeText
          const textYOffset = hasIcon ? 10 : 0
          const textVis = isEditing ? 'hidden' : 'visible'

          if (node.shape === 'card') {
            const headerH = elkNode.headerH ?? 36
            const headerCY = y + headerH / 2
            const bodyLines = elkNode.bodyLines ?? []
            const bodyFontSize = Math.max(theme.fontSize - 2, 10)
            const iconRenderX = hasIcon ? x + 16 + ICON_SIZE / 2 : cx
            const textX = hasIcon ? x + 16 + ICON_SIZE * 1.5 : cx
            const anchor = hasIcon ? 'start' : 'middle'
            return (
              <g key={node.id_key} onDoubleClick={e => { e.stopPropagation(); handleNodeDblClick(node) }}>
                {node.url && (
                  <foreignObject x={x + w - 14} y={y + 3} width={11} height={11} style={{ pointerEvents: 'none' }}>
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 11, height: 11, display: 'flex', opacity: 0.55 }}>
                      <ExternalLink size={10} color={textColor} strokeWidth={2} />
                    </div>
                  </foreignObject>
                )}
                {hasIcon && <IconSVG name={node.icon} x={iconRenderX} y={headerCY} color={textColor} />}
                <text x={textX} y={headerCY} textAnchor={anchor} dominantBaseline="middle"
                  fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor} fontWeight="600"
                  visibility={textVis} style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {node.label}
                </text>
                {bodyLines.length > 0 && (
                  <text x={x + 12} y={y + headerH + CARD_BODY_PADDING}
                    textAnchor="start" dominantBaseline="hanging"
                    fontFamily={theme.font} fontSize={bodyFontSize} fill={textColor} fillOpacity={0.75}
                    visibility={textVis} style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {bodyLines.map((line, i) => (
                      <tspan key={i} x={x + 12} dy={i === 0 ? 0 : CARD_BODY_LINE_H}>{line}</tspan>
                    ))}
                  </text>
                )}
              </g>
            )
          }

          return (
            <g key={node.id_key} onDoubleClick={e => { e.stopPropagation(); handleNodeDblClick(node) }}>
              {hasIcon && <IconSVG name={node.icon} x={cx} y={cy - 10} color={textColor} />}
              {node.url && (
                <foreignObject x={x + w - 14} y={y + 3} width={11} height={11} style={{ pointerEvents: 'none' }}>
                  <div xmlns="http://www.w3.org/1999/xhtml" style={{ width: 11, height: 11, display: 'flex', opacity: 0.55 }}>
                    <ExternalLink size={10} color={textColor} strokeWidth={2} />
                  </div>
                </foreignObject>
              )}
              {isMultiLine ? (
                <text x={cx} y={cy + textYOffset - (lines.length - 1) * MM_LINE_H / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
                  visibility={textVis}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {lines.map((line, i) => (
                    <tspan key={i} x={cx} dy={i === 0 ? 0 : MM_LINE_H}>{line}</tspan>
                  ))}
                </text>
              ) : (
                <text x={cx} y={cy + textYOffset + (node.shape === 'cylinder' ? 0 : 1)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontFamily={theme.font} fontSize={theme.fontSize} fill={textColor}
                  fontWeight={node.bold ? 'bold' : undefined}
                  textDecoration={node.underline ? 'underline' : undefined}
                  visibility={textVis}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {node.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Hit areas: click = open URL, dblclick = edit label */}
        {ast.nodes.map(node => {
          const elkNode = nodeMap[node.id_key]
          if (!elkNode) return null
          const hasUrl = !!node.url
          const canEdit = !!onNodeLabelChange
          if (!hasUrl && !canEdit) return null
          return (
            <rect key={`hit-${node.id_key}`}
              x={elkNode.x} y={elkNode.y}
              width={elkNode.width} height={elkNode.height}
              fill="transparent"
              style={{ cursor: hasUrl ? 'pointer' : 'text' }}
              onClick={hasUrl ? (e) => { e.stopPropagation(); handleNodeClick(node) } : undefined}
              onDoubleClick={canEdit ? (e) => { e.stopPropagation(); handleNodeDblClick(node) } : undefined}
            />
          )
        })}
      </svg>

      {/* ─── Inline edit input overlay ──────────────────────────────────── */}
      {editingNodeId && (() => {
        const elkNode = nodeMap[editingNodeId]
        if (!elkNode) return null
        return (
          <div
            style={{
              position: 'absolute',
              left: elkNode.x * zoom + pan.x,
              top: elkNode.y * zoom + pan.y,
              width: elkNode.width * zoom,
              height: elkNode.height * zoom,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              pointerEvents: 'all',
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <input
              autoFocus
              value={editingValue}
              onChange={e => setEditingValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                if (e.key === 'Escape') setEditingNodeId(null)
              }}
              onBlur={commitEdit}
              style={{
                width: '90%',
                textAlign: 'center',
                background: theme.nodeFill,
                color: theme.nodeText,
                border: `2px solid ${theme.nodeStroke}`,
                borderRadius: 4,
                fontFamily: theme.font,
                fontSize: theme.fontSize * zoom,
                padding: '2px 4px',
                outline: 'none',
                boxShadow: `0 0 0 3px ${theme.nodeStroke}44`,
              }}
            />
          </div>
        )
      })()}
    </div>
  )
}
