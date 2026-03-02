import { useState, useEffect, useRef } from 'react'
import { X, LogIn, UserPlus, Mail } from 'lucide-react'
import { useT } from '../lib/i18n.jsx'

export default function AuthModal({
  open,
  onClose,
  onAuthSuccess,
  onVerifySuccess,
  defaultTab = 'login',
  defaultEmail = '',
}) {
  const [tab, setTab] = useState(defaultTab)
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const panelRef = useRef(null)
  const cooldownRef = useRef(null)

  // Sync defaultTab / defaultEmail when they change
  useEffect(() => {
    if (open) {
      setTab(defaultTab)
      setEmail(defaultEmail || '')
      setPassword('')
      setName('')
      setOtp('')
      setError('')
      setLoading(false)
    }
  }, [open, defaultTab, defaultEmail])

  // Reset form when switching tabs (but NOT when switching to verify — keep email)
  useEffect(() => {
    setError('')
    setOtp('')
    if (tab !== 'verify') {
      setPassword('')
    }
  }, [tab])

  // Cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return
    cooldownRef.current = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(cooldownRef.current)
  }, [resendCooldown])

  // Esc key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    setTimeout(() => window.addEventListener('mousedown', handler), 50)
    return () => window.removeEventListener('mousedown', handler)
  }, [open, onClose])

  const t = useT()
  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = tab === 'login'
      ? { email, password }
      : { email, password, name: name.trim() || undefined }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('auth_error_unknown'))
        return
      }
      if (tab === 'register') {
        onAuthSuccess({ token: data.token, user: data.user })
        setTab('verify')
        setResendCooldown(60)
      } else {
        onAuthSuccess({ token: data.token, user: data.user })
        onClose()
      }
    } catch {
      setError(t('auth_error_connection'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('auth_error_unknown'))
        return
      }
      onVerifySuccess(data.user)
      onClose()
    } catch {
      setError(t('auth_error_connection'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError('')
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t('auth_resend_error'))
        return
      }
      setResendCooldown(60)
    } catch {
      setError(t('auth_error_connection'))
    }
  }

  function handleOtpChange(val) {
    const clean = val.replace(/\D/g, '').slice(0, 6)
    setOtp(clean)
    if (clean.length === 6) {
      setTimeout(() => {
        document.getElementById('otp-verify-btn')?.click()
      }, 80)
    }
  }

  const headerTitle = tab === 'login' ? t('auth_login_tab') : tab === 'register' ? t('auth_register_tab') : t('auth_verify_title')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-xl shadow-2xl overflow-hidden bg-white border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="font-bold text-sm text-slate-800">{headerTitle}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-slate-100 text-slate-400">
            <X size={15} />
          </button>
        </div>

        {/* Tabs — hidden on verify step */}
        {tab !== 'verify' && (
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all ${tab === 'login' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <LogIn size={12} />
              {t('auth_login_tab')}
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all ${tab === 'register' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              <UserPlus size={12} />
              {t('auth_register_tab')}
            </button>
          </div>
        )}

        {/* ── Verify step ── */}
        {tab === 'verify' ? (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-xs bg-blue-50 border-blue-200 text-blue-700">
              <Mail size={14} className="shrink-0 mt-0.5" />
              <span>{t('auth_verify_sent')} <strong>{email}</strong>. {t('auth_verify_check_inbox')}</span>
            </div>

            <form onSubmit={handleVerify} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">{t('auth_verify_code_label')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => handleOtpChange(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors text-center tracking-[0.4em] font-mono bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                id="otp-verify-btn"
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-slate-800 text-white hover:bg-slate-700"
              >
                {loading ? t('auth_verifying') : t('auth_verify_btn')}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="underline text-slate-600 hover:text-slate-800"
                >
                  {t('auth_change_email')}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className={`underline disabled:no-underline disabled:cursor-default ${resendCooldown > 0 ? 'text-slate-500' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  {resendCooldown > 0 ? t('auth_resend_cooldown', resendCooldown) : t('auth_resend')}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ── Login / Register form ── */
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-700">
                  {t('auth_name_label')} <span className="text-slate-500">{t('auth_name_optional')}</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('auth_name_placeholder')}
                  autoComplete="name"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-700">{t('auth_email_label')}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-slate-700">{t('auth_password_label')}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={tab === 'register' ? t('auth_password_min') : t('auth_password_mask')}
                required
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-colors bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-slate-800 text-white hover:bg-slate-700"
            >
              {loading
                ? (tab === 'login' ? t('auth_loading_login') : t('auth_loading_register'))
                : (tab === 'login' ? t('auth_submit_login') : t('auth_submit_register'))
              }
            </button>

            <p className="text-center text-xs text-slate-500">
              {tab === 'login' ? (
                <>{t('auth_no_account')}{' '}
                  <button type="button" onClick={() => setTab('register')} className="underline text-slate-600 hover:text-slate-800">
                    {t('auth_register_link')}
                  </button>
                </>
              ) : (
                <>{t('auth_has_account')}{' '}
                  <button type="button" onClick={() => setTab('login')} className="underline text-slate-600 hover:text-slate-800">
                    {t('auth_login_link')}
                  </button>
                </>
              )}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
