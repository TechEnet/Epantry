import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ShieldAlert, X } from 'lucide-react'

import {
  API_MFA_VERIFICATION_REQUIRED_EVENT,
} from '../../../api/apiClient'
import {
  AUTH_SESSION_ESTABLISHED_EVENT,
  AUTH_SESSION_CLEARED_EVENT,
} from '../services/auth.service'

// One actionable notice for step-up errors from any Host/Admin API screen.
// No credentials, authenticator codes or MFA tokens are stored in this UI.
export default function MfaVerificationNotice() {
  const location = useLocation()
  const [required, setRequired] = useState(false)
  const [returnTo, setReturnTo] = useState('')

  useEffect(() => {
    const onRequired = (event) => {
      setReturnTo(event.detail?.returnTo || '')
      setRequired(true)
    }
    const onComplete = () => {
      setRequired(false)
      setReturnTo('')
    }

    window.addEventListener(API_MFA_VERIFICATION_REQUIRED_EVENT, onRequired)
    window.addEventListener(AUTH_SESSION_ESTABLISHED_EVENT, onComplete)
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, onComplete)
    return () => {
      window.removeEventListener(API_MFA_VERIFICATION_REQUIRED_EVENT, onRequired)
      window.removeEventListener(AUTH_SESSION_ESTABLISHED_EVENT, onComplete)
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, onComplete)
    }
  }, [])

  if (!required || location.pathname === '/account/security/verify') {
    return null
  }

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="fixed inset-x-4 top-24 z-[120] mx-auto max-w-xl rounded-2xl border border-[#d3e5d9] bg-[#f7fbf8] p-4 shadow-xl sm:inset-x-auto sm:right-6 sm:left-auto sm:w-[430px]"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#18583e]" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[#173f35]">Security verification needed</p>
          <p className="mt-1 text-sm leading-6 text-[#34483f]">
            Confirm your identity to continue this action.
          </p>
          <Link
            to="/account/security/verify"
            state={{ returnTo: returnTo || `${location.pathname}${location.search}${location.hash}` }}
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white transition hover:bg-[#245f4b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35]"
          >
            Verify now
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setRequired(false)}
          aria-label="Dismiss security notice"
          className="rounded-lg p-2 text-[#42574b] hover:bg-[#e5efe8] focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
