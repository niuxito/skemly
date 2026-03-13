import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../features/auth/useAuth.js'
import { Save, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Plan Config Panel ────────────────────────────────────────────────────────

function PlanConfigPanel() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [drafts, setDrafts] = useState({})

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/plan-config')
      if (!res.ok) throw new Error('Failed to fetch plan config')
      const data = await res.json()
      setPlans(data.plans ?? [])
      // Initialize drafts from fetched data
      const initial = {}
      for (const p of data.plans ?? []) {
        initial[p.plan] = {
          daily_requests: p.features.daily_requests ?? '',
          daily_files: p.features.daily_files ?? '',
          model_tier: p.features.model_tier ?? 'default',
        }
      }
      setDrafts(initial)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  async function savePlan(plan) {
    setSaving(s => ({ ...s, [plan]: true }))
    try {
      const d = drafts[plan]
      const features = {
        daily_requests: d.daily_requests === '' || d.daily_requests === 'null' ? null : Number(d.daily_requests),
        daily_files:    d.daily_files    === '' || d.daily_files    === 'null' ? null : Number(d.daily_files),
        model_tier:     d.model_tier,
      }
      await fetch(`/api/admin/plan-config/${plan}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
      })
      await fetchPlans()
    } finally {
      setSaving(s => ({ ...s, [plan]: false }))
    }
  }

  if (loading) return <div className="text-sm text-slate-500 p-4">Cargando configuración de planes...</div>

  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Configuración de Planes</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Plan</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Peticiones/día</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Archivos/día</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Modelo</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map(p => (
              <tr key={p.plan} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    p.plan === 'pro' ? 'bg-violet-100 text-violet-700' :
                    p.plan === 'starter' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{p.plan}</span>
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    value={drafts[p.plan]?.daily_requests ?? ''}
                    onChange={e => setDrafts(d => ({ ...d, [p.plan]: { ...d[p.plan], daily_requests: e.target.value } }))}
                    placeholder="null = ilimitado"
                    className="w-28 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="text"
                    value={drafts[p.plan]?.daily_files ?? ''}
                    onChange={e => setDrafts(d => ({ ...d, [p.plan]: { ...d[p.plan], daily_files: e.target.value } }))}
                    placeholder="null = ilimitado"
                    className="w-28 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={drafts[p.plan]?.model_tier ?? 'default'}
                    onChange={e => setDrafts(d => ({ ...d, [p.plan]: { ...d[p.plan], model_tier: e.target.value } }))}
                    className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
                  >
                    <option value="default">default</option>
                    <option value="pro">pro</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => savePlan(p.plan)}
                    disabled={saving[p.plan]}
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    <Save size={11} />
                    {saving[p.plan] ? 'Guardando...' : 'Guardar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({ user, onSaved }) {
  const [expanded, setExpanded] = useState(false)
  const [planDraft, setPlanDraft] = useState(user.plan ?? 'free')
  const [expiresDraft, setExpiresDraft] = useState(
    user.plan_expires_at ? new Date(user.plan_expires_at).toISOString().slice(0, 10) : ''
  )
  const [overrideDraft, setOverrideDraft] = useState({
    daily_requests: user.override_features?.daily_requests ?? '',
    daily_files:    user.override_features?.daily_files    ?? '',
    notes:          user.override_notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function savePlan() {
    setSaving(true)
    try {
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planDraft,
          plan_expires_at: expiresDraft || null,
        }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function saveOverride() {
    setSaving(true)
    try {
      const features = {}
      if (overrideDraft.daily_requests !== '') {
        features.daily_requests = overrideDraft.daily_requests === 'null' ? null : Number(overrideDraft.daily_requests)
      }
      if (overrideDraft.daily_files !== '') {
        features.daily_files = overrideDraft.daily_files === 'null' ? null : Number(overrideDraft.daily_files)
      }
      await fetch(`/api/admin/users/${user.id}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, notes: overrideDraft.notes || null }),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  async function deleteOverride() {
    setSaving(true)
    try {
      await fetch(`/api/admin/users/${user.id}/override`, { method: 'DELETE' })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[200px] truncate">{user.email}</td>
        <td className="px-4 py-2.5">
          <select
            value={planDraft}
            onChange={e => setPlanDraft(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 bg-white"
          >
            <option value="free">free</option>
            <option value="starter">starter</option>
            <option value="pro">pro</option>
          </select>
        </td>
        <td className="px-4 py-2.5">
          <input
            type="date"
            value={expiresDraft}
            onChange={e => setExpiresDraft(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </td>
        <td className="px-4 py-2.5 text-xs text-slate-600 text-center">{user.requests_today ?? 0}</td>
        <td className="px-4 py-2.5">
          {user.override_features ? (
            <span className="inline-block px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              {JSON.stringify(user.override_features)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1">
            <button
              onClick={savePlan}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              <Save size={10} />
              Plan
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              Override
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50 border-b border-slate-200">
          <td colSpan={6} className="px-6 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Peticiones/día override</label>
                <input
                  type="text"
                  value={overrideDraft.daily_requests}
                  onChange={e => setOverrideDraft(d => ({ ...d, daily_requests: e.target.value }))}
                  placeholder="vacío = sin override"
                  className="w-36 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Archivos/día override</label>
                <input
                  type="text"
                  value={overrideDraft.daily_files}
                  onChange={e => setOverrideDraft(d => ({ ...d, daily_files: e.target.value }))}
                  placeholder="vacío = sin override"
                  className="w-36 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notas</label>
                <input
                  type="text"
                  value={overrideDraft.notes}
                  onChange={e => setOverrideDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Motivo del override"
                  className="w-52 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={saveOverride}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save size={10} />
                  Guardar override
                </button>
                {user.override_features && (
                  <button
                    onClick={deleteOverride}
                    disabled={saving}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={10} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Users Panel ──────────────────────────────────────────────────────────────

function UsersPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to fetch users')
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    : users

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Usuarios ({users.length})</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por email..."
            className="px-3 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 w-52"
          />
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Plan</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Expira</th>
              <th className="text-center px-4 py-2.5 font-medium text-slate-600">Uso hoy</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Override</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">Cargando usuarios...</td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">No se encontraron usuarios.</td>
              </tr>
            )}
            {!loading && filtered.map(u => (
              <UserRow key={u.id} user={u} onSaved={fetchUsers} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── AdminPage ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, authResolved } = useAuth()

  if (!authResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-sm text-slate-400">Cargando...</span>
      </div>
    )
  }

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-2">Acceso restringido a administradores.</p>
          <a href="/" className="text-xs text-slate-400 hover:underline">Volver al inicio</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="font-bold text-slate-800 text-sm hover:text-slate-600">Skemly</a>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-600 font-medium">Admin</span>
        </div>
        <span className="text-xs text-slate-400">{user.email}</span>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PlanConfigPanel />
        <UsersPanel />
      </main>
    </div>
  )
}
