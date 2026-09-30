import { useState, useEffect } from 'react'
import { Check, X, Zap, ArrowLeft } from 'lucide-react'
import { useAuth } from '../features/auth/useAuth.js'
import AuthModal from '../components/AuthModal.jsx'
import { useBillingEnabled } from '../hooks/useBillingEnabled.js'

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '',
    description: 'Para empezar a diagramar',
    cta: 'Empezar gratis',
    popular: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$12',
    period: '/mes',
    description: 'Para usuarios activos',
    cta: 'Upgrade a Starter',
    popular: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$24',
    period: '/mes',
    description: 'Para equipos y poder usuarios',
    cta: 'Upgrade a Pro',
    popular: false,
  },
]

const FEATURES = [
  { label: 'Requests IA/día',       free: '20',          starter: '50',           pro: 'Ilimitado' },
  { label: 'Adjuntos/día',          free: '2',           starter: '10',           pro: 'Ilimitado' },
  { label: 'Cloud sync',            free: false,         starter: true,           pro: true },
  { label: 'Export sin watermark',  free: false,         starter: true,           pro: true },
  { label: 'Compartir diagramas',   free: true,          starter: true,           pro: true },
  { label: 'Soporte',               free: '—',           starter: 'Email',        pro: 'Prioritario' },
]

function FeatureValue({ value }) {
  if (value === true)  return <Check size={16} className="text-emerald-500 mx-auto" />
  if (value === false) return <X     size={16} className="text-slate-300 mx-auto" />
  return <span className="text-slate-700">{value}</span>
}

export default function PricingPage() {
  const { user, authOpen, setAuthOpen, authDefaultTab, authDefaultEmail, handleAuthSuccess, handleVerifySuccess, openAuthModal } = useAuth()
  const [loading, setLoading] = useState(null) // key of plan being purchased
  const [banner, setBanner] = useState(null)   // { type: 'success' | 'canceled', message }
  const billingEnabled = useBillingEnabled()

  // No plans on instances without Stripe
  useEffect(() => {
    if (billingEnabled === false) window.location.replace('/')
  }, [billingEnabled])

  // Read query params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      setBanner({ type: 'success', message: 'Pago completado. Tu plan ha sido activado.' })
      // Clean URL
      window.history.replaceState({}, '', '/pricing')
    } else if (params.get('canceled') === '1') {
      setBanner({ type: 'canceled', message: 'Pago cancelado. No se ha realizado ningún cargo.' })
      window.history.replaceState({}, '', '/pricing')
    }
  }, [])

  async function handleUpgrade(plan) {
    if (!user) {
      openAuthModal('login')
      return
    }
    if (user.plan === plan) return

    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setBanner({ type: 'canceled', message: data.error ?? 'Error al iniciar el pago.' })
        return
      }
      window.location.href = data.url
    } catch {
      setBanner({ type: 'canceled', message: 'Error de conexión. Inténtalo de nuevo.' })
    } finally {
      setLoading(null)
    }
  }

  function getPlanCta(plan) {
    if (plan.key === 'free') return null // handled separately
    if (!user) return { label: 'Crear cuenta', disabled: false }
    if (user.plan === plan.key) return { label: 'Plan actual', disabled: true }
    return { label: plan.cta, disabled: false }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <ArrowLeft size={13} />
            Volver al editor
          </a>
          <span className="text-slate-200">|</span>
          <span className="font-bold text-slate-800">Skemly</span>
          <span className="text-xs text-slate-400">Planes</span>
        </div>
        {user ? (
          <span className="text-xs text-slate-500">{user.email}</span>
        ) : (
          <button
            onClick={() => openAuthModal('login')}
            className="text-xs px-3 py-1.5 rounded bg-slate-800 text-white hover:bg-slate-700 transition-colors"
          >
            Iniciar sesión
          </button>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        {/* Banner */}
        {banner && (
          <div className={`mb-8 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            <span>{banner.message}</span>
            <button onClick={() => setBanner(null)} className="ml-4 opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Elige tu plan</h1>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            Empieza gratis. Escala cuando lo necesites. Sin compromisos.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const cta = getPlanCta(plan)
            const isCurrent = user?.plan === plan.key

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border bg-white p-6 flex flex-col ${
                  plan.popular
                    ? 'border-slate-800 shadow-lg ring-1 ring-slate-800'
                    : 'border-slate-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">
                      <Zap size={10} />
                      Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-1">{plan.name}</h2>
                  <p className="text-xs text-slate-500 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
                  </div>
                </div>

                {/* Feature bullets for this plan */}
                <ul className="space-y-2 mb-8 flex-1">
                  {FEATURES.map(f => {
                    const val = f[plan.key]
                    if (val === false) return null
                    return (
                      <li key={f.label} className="flex items-center gap-2 text-xs text-slate-600">
                        <Check size={13} className="text-emerald-500 shrink-0" />
                        <span>
                          {f.label}
                          {typeof val === 'string' && val !== '—' && val !== 'true' ? `: ${val}` : ''}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                {plan.key === 'free' ? (
                  isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-400 cursor-default"
                    >
                      Plan actual
                    </button>
                  ) : (
                    <a
                      href="/"
                      className="block w-full py-2 rounded-lg text-sm font-medium text-center bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      {plan.cta}
                    </a>
                  )
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={cta?.disabled || loading === plan.key}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      cta?.disabled
                        ? 'bg-slate-100 text-slate-400 cursor-default'
                        : plan.popular
                          ? 'bg-slate-800 text-white hover:bg-slate-700'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    } disabled:opacity-60`}
                  >
                    {loading === plan.key ? 'Redirigiendo...' : cta?.label ?? plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Feature comparison table */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Comparativa de funcionalidades</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 w-1/2">Funcionalidad</th>
                  {PLANS.map(p => (
                    <th key={p.key} className="px-4 py-3 text-center text-xs font-semibold text-slate-700">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr key={f.label} className={i % 2 === 0 ? 'bg-slate-50/50' : ''}>
                    <td className="px-6 py-3 text-slate-600 text-xs">{f.label}</td>
                    {PLANS.map(p => (
                      <td key={p.key} className="px-4 py-3 text-center text-xs">
                        <FeatureValue value={f[p.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manage subscription link */}
        {user && user.plan !== 'free' && (
          <p className="text-center mt-8 text-xs text-slate-500">
            ¿Quieres gestionar o cancelar tu suscripción?{' '}
            <button
              className="underline hover:text-slate-700 transition-colors"
              onClick={async () => {
                const res = await fetch('/api/stripe/portal', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                })
                if (res.ok) {
                  const { url } = await res.json()
                  window.location.href = url
                }
              }}
            >
              Accede al portal de facturación
            </button>
          </p>
        )}
      </main>

      {/* Auth modal (reused from App) */}
      <AuthModal
        open={authOpen}
        defaultTab={authDefaultTab}
        defaultEmail={authDefaultEmail}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        onVerifySuccess={handleVerifySuccess}
      />
    </div>
  )
}
