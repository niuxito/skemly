import { useEffect, useState } from 'react'

// Fetched once per page load and shared by every caller.
let statusPromise = null

function fetchBillingStatus() {
  statusPromise ??= fetch('/api/stripe/status')
    .then(r => (r.ok ? r.json() : { enabled: false }))
    .then(data => data.enabled === true)
    .catch(() => false)
  return statusPromise
}

/**
 * Whether this instance sells plans. Returns null while loading, then a
 * boolean. Self-hosted instances without Stripe get false.
 */
export function useBillingEnabled() {
  const [enabled, setEnabled] = useState(null)
  useEffect(() => {
    let active = true
    fetchBillingStatus().then(value => { if (active) setEnabled(value) })
    return () => { active = false }
  }, [])
  return enabled
}
