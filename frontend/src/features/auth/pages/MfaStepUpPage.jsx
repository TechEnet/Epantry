import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
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

const STEP_UP_STYLE = `
/* Scoped to this page: do not change any other EPANTRY screen. */
#root .app-frame:has(#ep-mfa-stepup) { height:100svh !important; min-height:100svh !important; overflow:hidden !important; }
#root .app-frame:has(#ep-mfa-stepup) > footer { display:none !important; }
#root .app-frame:has(#ep-mfa-stepup) > .app-content { flex:1 1 0 !important; min-height:0 !important; overflow:hidden !important; display:flex !important; }
#ep-mfa-stepup, #ep-mfa-stepup * { box-sizing:border-box; }
#ep-mfa-stepup {
  width:100% !important; height:100% !important; min-height:0 !important; max-width:none !important;
  display:flex !important; align-items:center !important; justify-content:center !important;
  overflow-y:auto !important; overscroll-behavior:contain;
  padding:18px 22px !important; margin:0 !important;
  background:#F7F6F2 !important; color:#202421 !important;
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
}
#ep-mfa-stepup .ep-stepup-inner { width:100%; max-width:960px; margin:auto; }
#ep-mfa-stepup .ep-stepup-back {
  display:inline-flex; align-items:center; gap:9px; margin:0 0 14px; padding:5px 0;
  color:#173F35; font-size:14px; font-weight:700; text-decoration:none; line-height:1.4;
}
#ep-mfa-stepup .ep-stepup-back:hover {color:#B75D35;}
#ep-mfa-stepup .ep-stepup-card {
  display:grid; grid-template-columns:minmax(0,0.78fr) minmax(0,1.22fr);
  width:100%; min-width:0; overflow:hidden;
  border:1px solid #DAD8D0; border-radius:19px; background:#FFFDFC;
  box-shadow:0 18px 52px rgba(23,45,37,.09);
}
#ep-mfa-stepup .ep-stepup-story {
  padding:30px 30px 28px; display:flex; flex-direction:column; justify-content:space-between; gap:26px;
  background:#F1D8C9; border-right:1px solid #E6BFA9;
}
#ep-mfa-stepup .ep-stepup-emblem {
  width:46px; height:46px; display:flex; align-items:center; justify-content:center;
  border-radius:13px; color:#A45030; background:#FFF8F3; border:1px solid #DDAF96;
}
#ep-mfa-stepup .ep-stepup-eyebrow { margin:19px 0 8px; color:#985031; font-size:12px; font-weight:800; letter-spacing:.065em; text-transform:uppercase; }
#root #ep-mfa-stepup .ep-stepup-heading { margin:0; color:#202421; font-size:34px !important; line-height:1.15 !important; font-weight:700 !important; letter-spacing:-.035em; text-wrap:balance; }
#ep-mfa-stepup .ep-stepup-intro { margin:12px 0 0; color:#604B40; font-size:15px; line-height:1.56; }
#ep-mfa-stepup .ep-stepup-progress { display:flex; flex-direction:column; gap:12px; padding-top:17px; border-top:1px solid #D7AF98; }
#ep-mfa-stepup .ep-stepup-progress-row { display:flex; align-items:center; gap:10px; color:#614C41; font-size:14px; font-weight:600; }
#ep-mfa-stepup .ep-stepup-step-num {
  display:grid; place-items:center; width:30px; height:30px; border:1px solid #C9A28C;
  border-radius:50%; color:#634F43; background:#FBECE1; font-size:12px; flex-shrink:0;
}
#ep-mfa-stepup .ep-stepup-step-num.is-active {color:#FFFDFC; background:#173F35; border-color:#173F35;}
#ep-mfa-stepup .ep-stepup-form-area { padding:31px 40px; display:flex; flex-direction:column; justify-content:center; min-width:0; }
#ep-mfa-stepup .ep-stepup-pill { display:inline-flex; align-items:center; gap:8px; color:#A65B39; font-size:13px; font-weight:700; }
#root #ep-mfa-stepup .ep-stepup-form-title { margin:14px 0 0; color:#202421; font-size:28px !important; line-height:1.24 !important; font-weight:700 !important; letter-spacing:-.028em; }
#ep-mfa-stepup .ep-stepup-help { margin:8px 0 0; max-width:430px; color:#596159; font-size:14px; line-height:1.55; }
#ep-mfa-stepup .ep-stepup-form { display:grid; gap:16px; margin-top:20px; }
#ep-mfa-stepup .ep-stepup-account { padding:11px 14px; background:#F7F6F2; border-radius:11px; border:1px solid #E5E3DB; }
#ep-mfa-stepup .ep-stepup-account-label { display:block; font-size:12px; font-weight:700; color:#667268; }
#ep-mfa-stepup .ep-stepup-email { display:block; margin-top:3px; font-size:14px; font-weight:600; color:#202421; overflow-wrap:anywhere; }
#ep-mfa-stepup .ep-stepup-label { display:block; margin-bottom:7px; font-size:14px; font-weight:700; color:#202421; }
#ep-mfa-stepup .ep-stepup-input {
  display:block; width:100%; height:48px; min-height:48px; border:1px solid #C9CEC7; border-radius:11px;
  background:#FFFFFF; padding:10px 14px; outline:none; color:#202421; font-size:16px;
}
#ep-mfa-stepup .ep-stepup-input:focus { border-color:#C86C42; box-shadow:0 0 0 3px rgba(200,108,66,.17); }
#ep-mfa-stepup .ep-stepup-primary {
  display:flex; align-items:center; justify-content:center; gap:10px; width:100%; min-height:48px;
  padding:11px 18px; border:0; border-radius:11px; color:#FFFFFF !important;
  background:#173F35 !important; font-size:15px !important; font-weight:700; cursor:pointer;
}
#ep-mfa-stepup .ep-stepup-primary:hover { background:#25594A !important; }
#ep-mfa-stepup .ep-stepup-primary:disabled {opacity:.6;cursor:not-allowed;}
#ep-mfa-stepup .ep-stepup-secondary { display:inline-flex; align-items:center; min-height:42px; color:#A95635; font-size:14px; font-weight:700; background:transparent; border:0; cursor:pointer; }
#ep-mfa-stepup .ep-stepup-message { margin-top:20px; padding:13px 14px; color:#173F35; background:#E6F4ED; border-radius:10px; font-size:14px; font-weight:650; line-height:1.5; display:flex; align-items:center; gap:10px; }
#ep-mfa-stepup .ep-stepup-warning { margin-top:20px; padding:13px 14px; color:#79482E; background:#FFF4EC; border:1px solid #F0D6C7; border-radius:10px; font-size:14px; line-height:1.5; }
#ep-mfa-stepup .ep-stepup-error { padding:11px 13px; border:1px solid #F1BFBF; background:#FFF2F0; color:#A32626; border-radius:10px; font-size:14px; line-height:1.5; }
#ep-mfa-stepup .ep-stepup-note { margin:12px 0 0; text-align:center; font-size:12px; color:#69726C; }
#ep-mfa-stepup :where(button,a,input,select):focus-visible { outline:2px solid #C86C42 !important; outline-offset:3px; }
@media (max-width:760px) {
  #ep-mfa-stepup {padding:14px 15px !important; align-items:flex-start !important;}
  #ep-mfa-stepup .ep-stepup-inner {max-width:530px;}
  #ep-mfa-stepup .ep-stepup-card {grid-template-columns:minmax(0,1fr);}
  #ep-mfa-stepup .ep-stepup-story {padding:19px 22px 17px; gap:15px; border-right:0; border-bottom:1px solid #E6BFA9;}
  #ep-mfa-stepup .ep-stepup-emblem {width:37px;height:37px;border-radius:11px;}
  #ep-mfa-stepup .ep-stepup-eyebrow {margin:9px 0 5px;}
  #root #ep-mfa-stepup .ep-stepup-heading {font-size:25px !important;line-height:1.16 !important;}
  #ep-mfa-stepup .ep-stepup-intro {margin-top:6px;font-size:14px;}
  #ep-mfa-stepup .ep-stepup-progress {padding-top:12px;display:flex;flex-direction:row;gap:20px;flex-wrap:wrap;}
  #ep-mfa-stepup .ep-stepup-progress-row {font-size:12px;}
  #ep-mfa-stepup .ep-stepup-step-num {height:26px;width:26px;}
  #ep-mfa-stepup .ep-stepup-form-area {padding:22px;}
  #root #ep-mfa-stepup .ep-stepup-form-title {font-size:24px !important;}
  #ep-mfa-stepup .ep-stepup-form {margin-top:16px;gap:14px;}
}
@media (max-height:720px) and (min-width:761px) {
  #ep-mfa-stepup .ep-stepup-story {padding:20px 27px;}
  #ep-mfa-stepup .ep-stepup-form-area {padding:22px 35px;}
  #root #ep-mfa-stepup .ep-stepup-heading {font-size:30px !important;}
}
@media (prefers-reduced-motion:reduce) {#ep-mfa-stepup *{transition:none !important;animation-duration:.01ms !important;}}
`
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


  const steps = [
    { number: '01', title: 'Account password' },
    { number: '02', title: 'Authenticator code' },
  ]
  const activeStep = stage === 'code' ? 2 : 1

  return (
    <>
      <style>{STEP_UP_STYLE}</style>
      <main id="ep-mfa-stepup">
        <div className="ep-stepup-inner">
          <Link to={returnTo} className="ep-stepup-back">
            <ArrowLeft aria-hidden="true" size={17} /> Back to previous page
          </Link>
          <div className="ep-stepup-card">
            <aside className="ep-stepup-story">
              <div>
                <div className="ep-stepup-emblem"><ShieldCheck aria-hidden="true" size={23} /></div>
                <p className="ep-stepup-eyebrow">Account security</p>
                <h1 className="ep-stepup-heading">A quick check. Back to work.</h1>
                <p className="ep-stepup-intro">Confirm your identity to continue your protected Host or Admin action.</p>
              </div>
              <div className="ep-stepup-progress" aria-label="Verification steps">
                {steps.map((step, index) => {
                  const reached = stage === 'complete' || stage === 'enroll' || index + 1 <= activeStep
                  return (
                    <div key={step.number} className="ep-stepup-progress-row">
                      <span className={`ep-stepup-step-num${reached ? ' is-active' : ''}`}>{step.number}</span>
                      <span>{step.title}</span>
                    </div>
                  )
                })}
              </div>
            </aside>
            <section className="ep-stepup-form-area" aria-labelledby="verify-identity-title">
              <span className="ep-stepup-pill"><LockKeyhole aria-hidden="true" size={16} /> Verification required</span>
              <h2 id="verify-identity-title" className="ep-stepup-form-title">
                {stage === 'complete' ? 'Identity confirmed' : stage === 'enroll' ? 'Set up verification' : stage === 'code' ? 'Enter your security code' : 'Verify your identity'}
              </h2>
              <p className="ep-stepup-help">
                {stage === 'complete'
                  ? 'Your account is verified. Return to finish your action.'
                  : stage === 'code'
                    ? 'Enter the 6-digit code from your authenticator app.'
                    : stage === 'enroll'
                      ? 'Set up an authenticator app to continue.'
                      : 'Enter your password, then your authenticator code.'}
              </p>

              {assuranceLoading ? (
                <p role="status" className="ep-stepup-message"><LoaderCircle aria-hidden="true" size={19} className="animate-spin" /> Checking security status...</p>
              ) : stage === 'complete' ? (
                <div role="status">
                  <div className="ep-stepup-message"><CheckCircle2 aria-hidden="true" size={20} /> Verification complete</div>
                  <button type="button" onClick={() => navigate(returnTo, { replace: true })} className="ep-stepup-primary" style={{ marginTop: 16 }}>
                    Return to previous page <ArrowRight aria-hidden="true" size={17} />
                  </button>
                </div>
              ) : stage === 'enroll' ? (
                <div>
                  <p className="ep-stepup-warning">An authenticator is required before this action can continue.</p>
                  <Link to="/account/security/mfa" state={{ returnTo }} className="ep-stepup-primary" style={{ marginTop: 16, textDecoration: 'none' }}>
                    Set up authenticator <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                </div>
              ) : (
                <form className="ep-stepup-form" onSubmit={stage === 'password' ? handlePasswordSubmit : handleCodeSubmit}>
                  <div className="ep-stepup-account">
                    <span className="ep-stepup-account-label">Signed-in account</span>
                    <span className="ep-stepup-email">{user?.email || 'EPANTRY account'}</span>
                  </div>
                  {stage === 'password' ? (
                    <div>
                      <label className="ep-stepup-label" htmlFor="stepup-password">Account password</label>
                      <input
                        id="stepup-password" className="ep-stepup-input" type="password"
                        autoComplete="current-password" value={password}
                        onChange={(event) => setPassword(event.target.value)} required
                      />
                    </div>
                  ) : (
                    <div>
                      {challenge?.factors?.length > 1 && (
                        <div style={{ marginBottom: 15 }}>
                          <label className="ep-stepup-label" htmlFor="stepup-factor">Authenticator</label>
                          <select id="stepup-factor" className="ep-stepup-input" value={factorUid} onChange={(event) => setFactorUid(event.target.value)}>
                            {challenge.factors.map((factor) => (
                              <option key={factor.uid} value={factor.uid}>{factor.displayName || 'Authenticator app'}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <label className="ep-stepup-label" htmlFor="stepup-code">6-digit authenticator code</label>
                      <input
                        id="stepup-code" className="ep-stepup-input" type="text" inputMode="numeric"
                        pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6}
                        value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required
                        style={{ letterSpacing: '0.15em', fontWeight: 650 }}
                      />
                    </div>
                  )}
                  {error && <p role="alert" className="ep-stepup-error">{error}</p>}
                  <button type="submit" disabled={working} className="ep-stepup-primary">
                    {working ? <LoaderCircle aria-hidden="true" size={18} className="animate-spin" /> : <KeyRound aria-hidden="true" size={18} />}
                    {working ? 'Verifying...' : stage === 'password' ? 'Continue to code' : 'Verify code'}
                    {!working && <ArrowRight aria-hidden="true" size={17} />}
                  </button>
                  {stage === 'code' && (
                    <button
                      type="button" className="ep-stepup-secondary"
                      onClick={async () => {
                        await cancelSensitiveReauthentication()
                        setStage('password')
                        setCode('')
                        setChallenge(null)
                        setError('')
                      }}
                    >
                      Start again
                    </button>
                  )}
                </form>
              )}
            </section>
          </div>
          <p className="ep-stepup-note">Your previous work stays on its page.</p>
        </div>
      </main>
    </>
  )
}
