import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import {
  cancelSensitiveReauthentication,
  completeSensitiveReauthenticationMfa,
  getCurrentAuthAssurance,
  getReauthenticationErrorMessage,
  startSensitiveReauthentication,
} from '../services/reauth.service'
import { useAdmin } from '../../admin/context/AdminContext'

function safeReturnPath(value, fallback) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.startsWith('/account/security/verify')
  ) {
    return fallback
  }
  return value
}

export default function MfaStepUpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { refreshAdminAccess } = useAdmin()
  const fallback = user?.superAdminEnabled === true ? '/admin' : '/host/listings'
  const returnTo = safeReturnPath(location.state?.returnTo, fallback)

  const [stage, setStage] = useState('password')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState(null)
  const [factorUid, setFactorUid] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [assuranceLoading, setAssuranceLoading] = useState(true)

  const complete = useCallback(async () => {
    setPassword('')
    setCode('')
    setError('')
    setStage('complete')
    // Re-evaluate the Admin context after the signed-in session changes.
    try {
      if (user?.superAdminEnabled === true) {
        await refreshAdminAccess()
      }
    } catch {
      // Server authorization still applies when returning to the page.
    }
  }, [refreshAdminAccess, user?.superAdminEnabled])

  useEffect(() => {
    let active = true
    getCurrentAuthAssurance()
      .then((result) => {
        if (!active) return
        if (
          result?.assurance?.recentlyAuthenticated === true &&
          result?.assurance?.mfaAuthenticated === true
        ) {
          setStage('complete')
        }
      })
      .catch(() => {
        // The existing authenticated route and backend own access decisions.
      })
      .finally(() => {
        if (active) setAssuranceLoading(false)
      })
    return () => {
      active = false
      void cancelSensitiveReauthentication()
    }
  }, [])

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    if (!password || !user?.email) {
      setError('Enter your current account password to continue.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const result = await startSensitiveReauthentication({
        email: user.email,
        password,
      })
      setPassword('')
      if (result?.mfaRequired) {
        const factors = result.challenge?.factors || []
        setChallenge(result.challenge)
        setFactorUid(factors[0]?.uid || '')
        setStage('code')
      } else if (result?.assurance?.mfaAuthenticated === true) {
        await complete()
      } else {
        setStage('enroll')
      }
    } catch (caught) {
      setError(getReauthenticationErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  async function handleCodeSubmit(event) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setWorking(true)
    setError('')
    try {
      const result = await completeSensitiveReauthenticationMfa({
        factorUid,
        verificationCode: code,
      })
      if (result?.assurance?.mfaAuthenticated === true) {
        await complete()
      } else {
        setStage('enroll')
      }
    } catch (caught) {
      setError(getReauthenticationErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="min-h-[70svh] bg-[#f7f6f2] px-4 py-10 text-[#202421] sm:py-16">
      <div className="mx-auto max-w-lg">
        <Link
          to={returnTo}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#173f35] hover:underline"
        >
          <ArrowLeft aria-hidden="true" size={17} /> Back to previous page
        </Link>

        <section className="rounded-2xl border border-[#dfe7de] bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#e6f4ed] text-[#173f35]">
            <ShieldCheck aria-hidden="true" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Verify your identity</h1>
          <p className="mt-2 text-sm leading-6 text-[#526157]">
            For your security, confirm your account before making this change.
          </p>

          {assuranceLoading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-[#526157]">
              <LoaderCircle className="animate-spin" size={18} /> Checking security status...
            </p>
          ) : stage === 'complete' ? (
            <div className="mt-6 space-y-4" role="status">
              <div className="flex items-center gap-2 font-semibold text-[#173f35]">
                <CheckCircle2 size={20} /> Verification complete
              </div>
              <p className="text-sm text-[#526157]">You can now try your previous action again.</p>
              <button
                type="button"
                onClick={() => navigate(returnTo, { replace: true })}
                className="min-h-11 rounded-lg bg-[#173f35] px-5 font-semibold text-white hover:bg-[#245f4b]"
              >
                Continue
              </button>
            </div>
          ) : stage === 'enroll' ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm leading-6 text-[#526157]">
                This account needs an authenticator app set up before it can complete MFA verification.
              </p>
              <Link
                to="/account/security/mfa"
                state={{ returnTo }}
                className="inline-flex min-h-11 items-center rounded-lg bg-[#173f35] px-5 text-sm font-semibold text-white"
              >
                Set up authenticator
              </Link>
            </div>
          ) : (
            <form onSubmit={stage === 'password' ? handlePasswordSubmit : handleCodeSubmit} className="mt-6 space-y-4">
              <div className="rounded-lg bg-[#f2f6f2] px-3 py-3 text-sm text-[#35483c]">
                {user?.email || 'Signed-in EPANTRY account'}
              </div>
              {stage === 'password' ? (
                <div>
                  <label htmlFor="stepup-password" className="mb-2 block text-sm font-semibold">
                    Account password
                  </label>
                  <input
                    id="stepup-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="min-h-12 w-full rounded-lg border border-[#c9d5cd] bg-white px-3 text-base outline-offset-2 focus-visible:outline-[#173f35]"
                  />
                  <p className="mt-2 text-sm text-[#526157]">Next, enter the code from your authenticator app.</p>
                </div>
              ) : (
                <div>
                  {challenge?.factors?.length > 1 && (
                    <div className="mb-4">
                      <label htmlFor="stepup-factor" className="mb-2 block text-sm font-semibold">Authenticator</label>
                      <select
                        id="stepup-factor"
                        value={factorUid}
                        onChange={(event) => setFactorUid(event.target.value)}
                        className="min-h-12 w-full rounded-lg border border-[#c9d5cd] bg-white px-3"
                      >
                        {challenge.factors.map((factor) => (
                          <option key={factor.uid} value={factor.uid}>{factor.displayName || 'Authenticator app'}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <label htmlFor="stepup-code" className="mb-2 block text-sm font-semibold">Authenticator code</label>
                  <input
                    id="stepup-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className="min-h-12 w-full rounded-lg border border-[#c9d5cd] bg-white px-3 text-lg tracking-widest outline-offset-2 focus-visible:outline-[#173f35]"
                  />
                </div>
              )}
              {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={working}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#173f35] px-4 text-sm font-semibold text-white hover:bg-[#245f4b] disabled:opacity-60"
              >
                {working ? <LoaderCircle size={17} className="animate-spin" /> : <KeyRound size={17} />}
                {working ? 'Verifying...' : stage === 'password' ? 'Continue to code' : 'Verify code'}
              </button>
              {stage === 'code' && (
                <button
                  type="button"
                  onClick={async () => {
                    await cancelSensitiveReauthentication()
                    setStage('password')
                    setCode('')
                    setChallenge(null)
                    setError('')
                  }}
                  className="text-sm font-semibold text-[#173f35] hover:underline"
                >
                  Start again
                </button>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
