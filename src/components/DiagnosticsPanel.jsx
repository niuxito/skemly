import { AlertTriangle } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'

export default function DiagnosticsPanel({ diagnostics }) {
  const t = useT()
  if (!diagnostics || diagnostics.length === 0) return null

  return (
    <div
      className="border-t px-3 py-2 text-xs space-y-0.5 font-mono overflow-auto"
      style={{
        maxHeight: 100,
        background: '#fef2f2',
        color: '#991b1b',
        borderColor: '#fca5a5',
      }}
    >
      {diagnostics.map((d, i) => (
        <div key={i} className="flex items-start gap-1">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          <span>{t('line_prefix')} {d.line}: {d.msg}</span>
        </div>
      ))}
    </div>
  )
}
