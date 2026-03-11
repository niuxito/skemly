import { useState, useEffect } from 'react'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authDefaultTab, setAuthDefaultTab] = useState('login')
  const [authDefaultEmail, setAuthDefaultEmail] = useState('')

  useEffect(() => {
    // Cookie is sent automatically — no token needed in headers
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user)
        setAuthResolved(true)
      })
      .catch(() => { setAuthResolved(true) })
  }, [])

  function handleAuthSuccess({ user: u }) {
    // Cookie is set by the server — no client-side token storage needed
    setUser(u)
  }

  function handleVerifySuccess(updatedUser) {
    setUser(updatedUser)
  }

  async function handleLogout() {
    // Increment token_version server-side and clear the HttpOnly cookie
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    setUser(null)
    // sessions loading effect will re-run with user=null → loads anonymous sessions
  }

  function openAuthModal(tab = 'login', email = '') {
    setAuthDefaultTab(tab)
    setAuthDefaultEmail(email)
    setAuthOpen(true)
  }

  async function handleOpenVerify(userEmail) {
    if (!userEmail) return
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      })
    } catch { /* ignore */ }
    openAuthModal('verify', userEmail)
  }

  return {
    user,
    setUser,
    authResolved,
    authOpen,
    setAuthOpen,
    authDefaultTab,
    authDefaultEmail,
    handleAuthSuccess,
    handleVerifySuccess,
    handleLogout,
    openAuthModal,
    handleOpenVerify,
  }
}
