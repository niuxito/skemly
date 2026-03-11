import { useCallback, useState } from 'react'
import { THEMES } from '../lib/themes.js'
import { toFilename } from '../features/sessions/sessionHelpers.js'

export function useExport({ svgRef, canvasRef, ast, user, currentSession }) {
  const [copied, setCopied] = useState(false)

  // ─── Export SVG ────────────────────────────────────────────────────────────
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgW = svgEl.width?.baseVal?.value || 800
    const svgH = svgEl.height?.baseVal?.value || 600
    const theme = THEMES[ast?.directives?.vibe ?? 'clean'] ?? THEMES.clean

    const svgClone = svgEl.cloneNode(true)
    svgClone.style.transform = ''
    svgClone.style.position = ''
    svgClone.style.transformOrigin = ''

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bgRect.setAttribute('x', '0')
    bgRect.setAttribute('y', '0')
    bgRect.setAttribute('width', String(svgW))
    bgRect.setAttribute('height', String(svgH))
    bgRect.setAttribute('fill', theme.canvasBg)
    svgClone.insertBefore(bgRect, svgClone.firstChild)

    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      imgEl.setAttribute('x', '0')
      imgEl.setAttribute('y', '0')
      imgEl.setAttribute('width', String(svgW))
      imgEl.setAttribute('height', String(svgH))
      imgEl.setAttribute('href', dataUrl)
      svgClone.insertBefore(imgEl, svgClone.children[1])
    }

    const isPaidSvg = user?.plan === 'pro' || user?.plan === 'starter'
    if (!isPaidSvg) {
      const wm = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      wm.setAttribute('x', String(svgW - 8))
      wm.setAttribute('y', String(svgH - 8))
      wm.setAttribute('text-anchor', 'end')
      wm.setAttribute('font-size', '11')
      wm.setAttribute('font-family', 'sans-serif')
      wm.setAttribute('fill', '#94a3b8')
      wm.setAttribute('opacity', '0.6')
      wm.textContent = 'Made with Skemly'
      svgClone.appendChild(wm)
    }

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgClone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${toFilename(currentSession?.title)}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [ast, user, currentSession?.title, svgRef, canvasRef])

  // ─── Export PNG ────────────────────────────────────────────────────────────
  const exportPNG = useCallback(() => {
    if (!svgRef.current) return
    const svgEl = svgRef.current
    const svgW = svgEl.width?.baseVal?.value || 800
    const svgH = svgEl.height?.baseVal?.value || 600
    const scale = 2
    const theme = THEMES[ast?.directives?.vibe ?? 'clean'] ?? THEMES.clean

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = svgW * scale
    exportCanvas.height = svgH * scale
    const ctx = exportCanvas.getContext('2d')
    ctx.scale(scale, scale)

    ctx.fillStyle = theme.canvasBg
    ctx.fillRect(0, 0, svgW, svgH)

    if (canvasRef.current) {
      ctx.drawImage(canvasRef.current, 0, 0, svgW, svgH)
    }

    const svgClone = svgEl.cloneNode(true)
    svgClone.style.transform = ''
    svgClone.style.position = ''
    svgClone.style.transformOrigin = ''
    for (const fo of svgClone.querySelectorAll('foreignObject')) fo.remove()

    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgClone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const isPaidPng = user?.plan === 'pro' || user?.plan === 'starter'
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, svgW, svgH)
      if (!isPaidPng) {
        ctx.font = '11px sans-serif'
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
        ctx.textAlign = 'right'
        ctx.fillText('Made with Skemly', svgW - 8, svgH - 8)
        ctx.textAlign = 'left'
      }
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.href = exportCanvas.toDataURL('image/png')
      a.download = `${toFilename(currentSession?.title)}.png`
      a.click()
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }, [ast, user, currentSession?.title, svgRef, canvasRef])

  // ─── Copy DSL ──────────────────────────────────────────────────────────────
  const copyDSL = useCallback(async (dsl) => {
    await navigator.clipboard.writeText(dsl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return { exportSVG, exportPNG, copyDSL, copied }
}
