import { useEffect, useState } from 'react'

// Instance status, fetched once per page load and shared by every caller.
let statusPromise = null

function fetchStatus() {
  statusPromise ??= fetch('/api/stripe/status')
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({}))
  return statusPromise
}

function useStatusFlag(read) {
  const [value, setValue] = useState(null)
  useEffect(() => {
    let active = true
    fetchStatus().then(data => { if (active) setValue(read(data)) })
    return () => { active = false }
  }, [])
  return value
}

/**
 * Whether this instance sells plans. Returns null while loading, then a
 * boolean. Self-hosted instances without Stripe get false.
 */
export function useBillingEnabled() {
  return useStatusFlag(data => data.enabled === true)
}

/**
 * Whether new accounts can be created. Returns null while loading, then a
 * boolean (true unless the server says otherwise).
 */
export function useRegistrationEnabled() {
  return useStatusFlag(data => data.registration !== false)
}
