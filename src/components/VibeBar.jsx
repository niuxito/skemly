// ─── VibeBar — overlaid on diagram canvas ────────────────────────────────────
const VIBES = [
  { key: 'clean',     icon: '☀️', label: 'Clean'     },
  { key: 'handdrawn', icon: '✏️', label: 'Handdrawn' },
  { key: 'cyberpunk', icon: '⚡', label: 'Cyberpunk' },
]

export default function VibeBar({ current, onChange }) {
  return (
    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-0.5 bg-white/85 backdrop-blur-sm rounded-lg border border-slate-200 p-0.5 shadow-sm">
      {VIBES.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
            current === key
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {icon} <span className="hidden sm:inline ml-0.5">{label}</span>
        </button>
      ))}
    </div>
  )
}
