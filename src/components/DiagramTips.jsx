import { useMemo, useState } from 'react'
import { Lightbulb, X, ChevronRight } from 'lucide-react'

// Rule-based diagram analysis — no API call, instant
function analyzeDiagram(ast) {
  if (!ast) return []
  const { nodes, edges, groups, directives } = ast
  if (nodes.length < 2) return []

  const tips = []

  // Layout suggestions
  if (directives?.layout === 'TD' && groups.length > 1) {
    tips.push({
      id: 'layout-lr',
      label: 'Switch to LR layout',
      detail: 'LR works better with multiple groups — they appear side by side.',
      action: 'Change the layout to LR so groups appear horizontally side by side',
    })
  }
  if (directives?.layout !== 'MM' && directives?.layout !== 'TREE' && nodes.length >= 5 && edges.length === 0) {
    tips.push({
      id: 'no-edges',
      label: 'Connect your nodes',
      detail: 'No edges found — add arrows to show relationships.',
      action: 'Add meaningful directed edges (arrows) between the nodes to show their relationships',
    })
  }

  // Grouping
  if (nodes.length >= 7 && groups.length === 0 && directives?.layout !== 'MM') {
    tips.push({
      id: 'add-groups',
      label: 'Group related nodes',
      detail: 'Large diagrams read better when nodes are organized into labelled groups.',
      action: 'Organize the nodes into 2–3 logical groups using group "Title" { } blocks',
    })
  }

  // Icons
  const noIconCount = nodes.filter(n => !n.icon).length
  if (nodes.length >= 4 && noIconCount === nodes.length) {
    tips.push({
      id: 'add-icons',
      label: 'Add icons to nodes',
      detail: 'Icons help readers identify components at a glance.',
      action: 'Add relevant @icon=PascalCaseName attributes to the main nodes (e.g. @icon=Database, @icon=Server, @icon=Shield)',
    })
  }

  // Edge labels
  const longUnlabeled = edges.filter(e => !e.label).length
  if (edges.length >= 4 && longUnlabeled === edges.length && directives?.edgeLabels !== 'off') {
    tips.push({
      id: 'label-edges',
      label: 'Label key edges',
      detail: 'Short labels on edges explain what flows or happens between nodes.',
      action: 'Add short descriptive labels to the most important edges using the "Label" syntax (e.g. [A]->"calls"->[B])',
    })
  }

  // Colors / tags
  const tagged = nodes.filter(n => n.tags?.length > 0 || n.bgColor)
  if (nodes.length >= 5 && tagged.length === 0) {
    tips.push({
      id: 'add-color',
      label: 'Highlight with colors',
      detail: 'Use tags or @bg= to draw attention to critical components.',
      action: 'Add #danger, #info, #safe or #warning tags (or @bg=#hex) to nodes that need visual emphasis',
    })
  }

  // Mindmap improvement
  if (directives?.layout === 'MM') {
    const roots = nodes.filter(n => !edges.some(e => e.to === n.id_key))
    if (roots.length > 1) {
      tips.push({
        id: 'mm-multiple-roots',
        label: 'Consolidate roots',
        detail: 'Mindmap works best with a single root node branching outward.',
        action: 'Add a single central root node and connect the current root nodes to it',
      })
    }
  }

  // Card nodes suggestion for data-heavy diagrams
  const cardNodes = nodes.filter(n => n.shape === 'card')
  if (nodes.length >= 4 && cardNodes.length === 0 && nodes.some(n => n.label.length > 20)) {
    tips.push({
      id: 'use-cards',
      label: 'Use card nodes for details',
      detail: 'Nodes with long labels work better as card nodes with header + body.',
      action: 'Convert nodes with long labels to card nodes: {id | Short Title | Longer description here}',
    })
  }

  return tips.slice(0, 4)
}

export default function DiagramTips({ ast, onSendToChat }) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(new Set())

  const allTips = useMemo(() => analyzeDiagram(ast), [ast])
  const tips = allTips.filter(t => !dismissed.has(t.id))

  if (!tips.length) return null

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
      {open && (
        <div className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 w-72 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suggestions</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          </div>
          {tips.map(tip => (
            <div key={tip.id} className="flex items-start gap-2 group">
              <button
                className="flex-1 text-left rounded-lg px-3 py-2 text-xs bg-slate-50 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-slate-100 hover:border-blue-200"
                onClick={() => { onSendToChat?.(tip.action); setOpen(false) }}
              >
                <span className="font-medium">{tip.label}</span>
                <span className="block text-slate-400 group-hover:text-blue-500 mt-0.5">{tip.detail}</span>
              </button>
              <button
                className="mt-1.5 text-slate-300 hover:text-slate-500 shrink-0"
                title="Dismiss"
                onClick={() => setDismissed(s => new Set([...s, tip.id]))}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 pt-1">Clicking a suggestion sends it to the chat panel.</p>
        </div>
      )}

      <button
        className="pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition-colors bg-white border border-slate-200 text-slate-600 hover:bg-yellow-50 hover:border-yellow-300 hover:text-yellow-700"
        onClick={() => setOpen(o => !o)}
        title={`${tips.length} suggestion${tips.length !== 1 ? 's' : ''}`}
      >
        <Lightbulb size={13} className={open ? 'text-yellow-500' : ''} />
        {tips.length} suggestion{tips.length !== 1 ? 's' : ''}
        <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
    </div>
  )
}
