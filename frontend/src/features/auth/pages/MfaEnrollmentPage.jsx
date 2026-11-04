import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Check,
  CircleAlert,
  Clipboard,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../context/AuthContext'

import {
  cancelTotpEnrollment,
  completeTotpEnrollment,
  getMfaEnrollmentErrorMessage,
  getMfaStatus,
  startTotpEnrollment,
} from '../services/mfa.service'

function getPolicyLabel(
  mode,
) {
  switch (
    mode
  ) {
    case 'required':
      return 'Required'

    case 'recommended':
      return 'Recommended'

    default:
      return 'Optional'
  }
}


const MFA_PAGE_STYLE = `
  #ep-mfa-enrollment, #ep-mfa-enrollment * { box-sizing: border-box; }
  #ep-mfa-enrollment { width:100%; max-width:none; margin:0; padding:26px clamp(18px,3vw,44px) 40px; background:#F7F6F2; color:#202421; }
  #ep-mfa-enrollment .mfa-layout { width:100%; max-width:1460px; margin:0 auto; }
  #ep-mfa-enrollment .mfa-hero { display:grid; grid-template-columns:minmax(0,1fr) minmax(260px,.36fr); overflow:hidden; border-radius:20px; background:#173F35; color:#F7F6F2; }
  #ep-mfa-enrollment .mfa-hero-main { padding:30px clamp(24px,3.2vw,46px) 34px; min-width:0; }
  #ep-mfa-enrollment .mfa-hero-side { display:flex; flex-direction:column; justify-content:center; gap:12px; padding:25px; background:#DCE0CF; color:#173F35; }
  #ep-mfa-enrollment .mfa-eyebrow { display:flex; align-items:center; gap:9px; font-size:12px; line-height:18px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
  #ep-mfa-enrollment .mfa-eyebrow-mark { width:30px; height:30px; border:1px solid rgba(247,246,242,.3); display:grid; place-items:center; border-radius:10px; }
  #root #ep-mfa-enrollment h1 { margin:14px 0 10px; font-size:clamp(29px,3.2vw,39px) !important; line-height:1.18 !important; letter-spacing:-.035em; font-weight:700; color:inherit; }
  #root #ep-mfa-enrollment h2 { margin:0; font-size:clamp(21px,2vw,25px) !important; line-height:1.3 !important; letter-spacing:-.025em; font-weight:700; color:#173F35; }
  #root #ep-mfa-enrollment h3 { margin:0; font-size:18px !important; line-height:1.4 !important; font-weight:700; color:#173F35; }
  #ep-mfa-enrollment .mfa-hero-copy { max-width:630px; margin:0; color:#DCE7DF; font-size:15px; line-height:1.6; }
  #ep-mfa-enrollment .mfa-side-icon { display:grid; place-items:center; width:49px; height:49px; border:1px solid #B5C7B7; background:#F7F6F2; border-radius:15px; }
  #ep-mfa-enrollment .mfa-side-title { font-size:18px; font-weight:700; line-height:1.4; }
  #ep-mfa-enrollment .mfa-side-detail { font-size:14px; line-height:1.5; color:#456252; }
  #ep-mfa-enrollment .mfa-content { margin-top:20px; display:grid; grid-template-columns:minmax(0,1.6fr) minmax(260px,.66fr); gap:18px; align-items:start; }
  #ep-mfa-enrollment .mfa-panel { min-width:0; background:#FFFEFC; border:1px solid #DCE0CF; border-radius:18px; overflow:hidden; }
  #ep-mfa-enrollment .mfa-panel-header { padding:20px 26px; border-bottom:1px solid #E3E6DD; display:flex; gap:13px; align-items:center; }
  #ep-mfa-enrollment .mfa-mini-icon { width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center; background:#DCE0CF; color:#173F35; border-radius:11px; }
  #ep-mfa-enrollment .mfa-panel-content { padding:5px 26px; }
  #ep-mfa-enrollment .mfa-status-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:16px; padding:18px 0; border-bottom:1px solid #EBEDE7; }
  #ep-mfa-enrollment .mfa-status-row:last-child {border-bottom:0;}
  #ep-mfa-enrollment .mfa-label { font-size:15px; font-weight:600; color:#34473D; line-height:1.45; }
  #ep-mfa-enrollment .mfa-value { font-size:17px; font-weight:700; color:#173F35; overflow-wrap:anywhere; text-align:right; }
  #ep-mfa-enrollment .mfa-subtext { margin-top:3px; color:#65746A; font-size:13px; line-height:1.4; }
  #ep-mfa-enrollment .mfa-chip { display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border-radius:9px; background:#E3F0E6; color:#175840; font-size:13px; font-weight:700; }
  #ep-mfa-enrollment .mfa-help {padding:25px; border:1px solid #E6CDBE; border-radius:18px; background:#FBE8DC; color:#4B3B30; }
  #ep-mfa-enrollment .mfa-help p {font-size:14px; line-height:1.6; margin:10px 0 0; color:#654D3F;}
  #ep-mfa-enrollment .mfa-help ul {padding-left:19px; margin:14px 0 0; font-size:14px; line-height:1.6; }
  #ep-mfa-enrollment .mfa-bottom { border-top:1px solid #E3E6DD; padding:18px 26px; display:flex; align-items:center; justify-content:space-between; gap:16px; background:#F4F6F0; }
  #ep-mfa-enrollment .mfa-account { min-width:0; font-size:13px; color:#59695E; overflow-wrap:anywhere; }
  #ep-mfa-enrollment .mfa-primary, #ep-mfa-enrollment .mfa-secondary { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:46px; border-radius:11px; padding:10px 18px; font-size:14px; line-height:1.3; font-weight:700; text-decoration:none; transition:background .15s ease, transform .15s ease; cursor:pointer; }
  #ep-mfa-enrollment .mfa-primary {background:#173F35; color:#FFFFFF; border:1px solid #173F35;}
  #ep-mfa-enrollment .mfa-primary:hover {background:#235C4C;}
  #ep-mfa-enrollment .mfa-secondary {background:#FFFEFC; color:#173F35; border:1px solid #BFCDBF;}
  #ep-mfa-enrollment .mfa-secondary:hover {background:#E8F0E5;}
  #ep-mfa-enrollment button:disabled {opacity:.55; cursor:not-allowed;}
  #ep-mfa-enrollment :is(button,a,input):focus-visible {outline:3px solid #C86C42; outline-offset:3px;}
  #ep-mfa-enrollment .mfa-form-wrap {padding:24px 26px 26px;}
  #ep-mfa-enrollment .mfa-form-layout {display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr); gap:0; overflow:hidden; border:1px solid #DCE0CF; border-radius:18px; background:#FFFEFC;}
  #ep-mfa-enrollment .mfa-form-story { padding:30px; background:#E4EDF0; border-right:1px solid #D3E0E5; }
  #ep-mfa-enrollment .mfa-form-story p {color:#506970; margin-top:11px; font-size:14px; line-height:1.62;}
  #ep-mfa-enrollment .mfa-form-story .mfa-step {font-size:13px; text-transform:uppercase; font-weight:700; letter-spacing:.06em; color:#32667A; margin:0 0 12px;}
  #ep-mfa-enrollment .mfa-form-main {min-width:0; padding:30px;}
  #ep-mfa-enrollment .mfa-step-label {color:#A45536; font-size:13px; font-weight:700; margin-bottom:9px;}
  #ep-mfa-enrollment .mfa-form-help {font-size:14px; line-height:1.55; color:#67746C; margin-top:9px;}
  #ep-mfa-enrollment .mfa-input-label {display:block; font-size:14px; font-weight:700; color:#173F35; margin-bottom:8px;}
  #ep-mfa-enrollment .mfa-input {min-height:49px; width:100%; border:1px solid #C9D5C9; background:#FFF; border-radius:11px; padding:11px 14px; font-size:15px; color:#202421;}
  #ep-mfa-enrollment .mfa-input:focus {border-color:#173F35;}
  #ep-mfa-enrollment .mfa-form-actions {display:flex; flex-wrap:wrap; gap:11px; margin-top:19px; align-items:center;}
  #ep-mfa-enrollment .mfa-alert {background:#FEF2EC; color:#8B3324; border:1px solid #E9B8A3; border-radius:10px; padding:11px 14px; margin:15px 0; font-size:14px; line-height:1.5; }
  #ep-mfa-enrollment .mfa-note {background:#EAF0E8; padding:15px 17px; border-radius:12px; color:#415C4C; font-size:14px; line-height:1.55; margin-top:22px;}
  #ep-mfa-enrollment .mfa-setup-columns {display:grid; grid-template-columns:minmax(230px,.8fr) minmax(0,1.2fr); gap:22px; padding:24px 26px;}
  #ep-mfa-enrollment .mfa-qr {background:#FFFFFF; border:1px solid #D5DCCF; border-radius:14px; padding:20px;}
  #ep-mfa-enrollment .mfa-qr img {display:block; width:100%; height:auto; max-width:244px; margin:auto;}
  #ep-mfa-enrollment .mfa-setup-details {background:#F5F7F2; border:1px solid #E1E6DC; border-radius:14px; padding:17px; margin-bottom:18px;}
  #ep-mfa-enrollment .mfa-secret {display:flex; align-items:stretch; gap:8px; margin-top:12px;}
  #ep-mfa-enrollment .mfa-secret code {flex:1; min-width:0; overflow-wrap:anywhere; border:1px solid #D6DCD3; border-radius:10px; padding:11px; background:white; color:#202421; font-size:14px; line-height:1.5; }
  #ep-mfa-enrollment .mfa-code {letter-spacing:.2em; font-size:23px; font-weight:700; text-align:center;}
  #ep-mfa-enrollment .mfa-loading {display:flex; align-items:center; gap:12px; min-height:200px; padding:32px; color:#173F35; font-size:15px; font-weight:600;}
  @media (max-width:850px) {
    #ep-mfa-enrollment .mfa-hero {grid-template-columns:1fr;}
    #ep-mfa-enrollment .mfa-hero-side {flex-direction:row; align-items:center; justify-content:flex-start; padding:17px 23px;}
    #ep-mfa-enrollment .mfa-content {grid-template-columns:1fr;}
    #ep-mfa-enrollment .mfa-help {padding:21px;}
    #ep-mfa-enrollment .mfa-form-layout {grid-template-columns:1fr;}
    #ep-mfa-enrollment .mfa-form-story {border-right:0; border-bottom:1px solid #D3E0E5; padding:22px 25px;}
    #ep-mfa-enrollment .mfa-setup-columns {grid-template-columns:1fr;}
  }
  @media (max-width:580px) {
    #ep-mfa-enrollment {padding:14px 11px 26px;}
    #ep-mfa-enrollment .mfa-hero {border-radius:15px;}
    #ep-mfa-enrollment .mfa-hero-main {padding:23px 19px;}
    #ep-mfa-enrollment .mfa-hero-side {padding:15px 18px;}
    #root #ep-mfa-enrollment h1 {font-size:28px !important; line-height:1.23 !important;}
    #ep-mfa-enrollment .mfa-content {margin-top:12px; gap:12px;}
    #ep-mfa-enrollment .mfa-panel-header {padding:15px 17px;}
    #ep-mfa-enrollment .mfa-panel-content {padding:0 17px;}
    #ep-mfa-enrollment .mfa-status-row {padding:14px 0;}
    #ep-mfa-enrollment .mfa-value {font-size:15px;}
    #ep-mfa-enrollment .mfa-bottom {padding:14px 17px; flex-wrap:wrap;}
    #ep-mfa-enrollment .mfa-bottom .mfa-primary {width:100%;}
    #ep-mfa-enrollment .mfa-form-main {padding:22px 18px;}
    #ep-mfa-enrollment .mfa-setup-columns {padding:17px;}
    #ep-mfa-enrollment .mfa-form-actions > .mfa-primary {width:100%;}
  }
  @media (prefers-reduced-motion:reduce) { #ep-mfa-enrollment * { transition:none !important; animation-duration:.01ms !important; } }
`

function MfaFrame({children}) {
  return (
    <main id="ep-mfa-enrollment">
      <style>{MFA_PAGE_STYLE}</style>
      <div className="mfa-layout">{children}</div>
    </main>
  )
}

function MfaHero({title, description, active=false}) {
  return (
    <section className="mfa-hero">
      <div className="mfa-hero-main">
        <div className="mfa-eyebrow"><span className="mfa-eyebrow-mark"><ShieldCheck size={18} aria-hidden="true" /></span> Account / Security</div>
        <h1>{title}</h1>
        <p className="mfa-hero-copy">{description}</p>
      </div>
      <div className="mfa-hero-side">
        <span className="mfa-side-icon">{active ? <CheckCircle2 size={25} /> : <LockKeyhole size={24} />}</span>
        <div><div className="mfa-side-title">{active ? 'Your account is protected' : 'A safer way to sign in'}</div>
          <div className="mfa-side-detail">{active ? 'An additional sign-in factor is enabled.' : 'Connect an authenticator app in two steps.'}</div></div>
      </div>
    </section>
  )
}

export default function MfaEnrollmentPage() {
  const {
    user,
    activeMode,
  } = useAuth()

  const [
    mfaStatus,
    setMfaStatus,
  ] = useState(null)

  const [
    isLoadingStatus,
    setIsLoadingStatus,
  ] = useState(true)

  const [
    statusError,
    setStatusError,
  ] = useState('')

  const [
    stage,
    setStage,
  ] = useState(
    'reauth',
  )

  const [
    password,
    setPassword,
  ] = useState('')

  const [
    setup,
    setSetup,
  ] = useState(null)

  const [
    verificationCode,
    setVerificationCode,
  ] = useState('')

  const [
    isStarting,
    setIsStarting,
  ] = useState(false)

  const [
    isCompleting,
    setIsCompleting,
  ] = useState(false)

  const [
    actionError,
    setActionError,
  ] = useState('')

  const [
    copiedSecret,
    setCopiedSecret,
  ] = useState(false)

  const [
    sessionRefreshed,
    setSessionRefreshed,
  ] = useState(true)

  /*
  |--------------------------------------------------------------------------
  | Load Authoritative MFA Status
  |--------------------------------------------------------------------------
  */

  const loadStatus =
    useCallback(
      async () => {
        setIsLoadingStatus(
          true,
        )

        setStatusError('')

        try {
          const status =
            await getMfaStatus()

          setMfaStatus(
            status,
          )
        } catch (error) {
          setStatusError(
            error?.message ||
              'Unable to load MFA status.',
          )
        } finally {
          setIsLoadingStatus(
            false,
          )
        }
      },
      [],
    )

  useEffect(() => {
    loadStatus()

    return () => {
      void cancelTotpEnrollment()
    }
  }, [
    loadStatus,
  ])

  /*
  |--------------------------------------------------------------------------
  | Begin Setup
  |--------------------------------------------------------------------------
  */

  const handleStartEnrollment =
    async (
      event,
    ) => {
      event.preventDefault()

      if (!password) {
        setActionError(
          'Enter your current password to continue.',
        )

        return
      }

      setIsStarting(true)
      setActionError('')

      try {
        const enrollmentSetup =
          await startTotpEnrollment({
            email:
              user?.email,

            password,
          })

        setSetup(
          enrollmentSetup,
        )

        setPassword('')

        setVerificationCode('')

        setStage(
          'setup',
        )
      } catch (error) {
        setActionError(
          getMfaEnrollmentErrorMessage(
            error,
          ),
        )
      } finally {
        setIsStarting(false)
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Complete Setup
  |--------------------------------------------------------------------------
  */

  const handleCompleteEnrollment =
    async (
      event,
    ) => {
      event.preventDefault()

      const normalizedCode =
        verificationCode
          .replace(
            /\D/g,
            '',
          )

      const codeLength =
        setup?.codeLength ||
        6

      if (
        normalizedCode.length !==
        codeLength
      ) {
        setActionError(
          `Enter the ${codeLength}-digit code from your authenticator app.`,
        )

        return
      }

      setIsCompleting(true)
      setActionError('')

      try {
        const result =
          await completeTotpEnrollment({
            verificationCode:
              normalizedCode,

            displayName:
              'EPANTRY Authenticator',
          })

        setSessionRefreshed(
          result.sessionRefreshed,
        )

        setStage(
          'success',
        )

        /*
        |--------------------------------------------------------------------------
        | Refresh Backend View
        |--------------------------------------------------------------------------
        */

        try {
          const updatedStatus =
            await getMfaStatus()

          setMfaStatus(
            updatedStatus,
          )
        } catch {
          /*
          |--------------------------------------------------------------------------
          | Enrollment is already complete in Firebase.
          |--------------------------------------------------------------------------
          */
        }
      } catch (error) {
        setActionError(
          getMfaEnrollmentErrorMessage(
            error,
          ),
        )
      } finally {
        setIsCompleting(false)
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Cancel Setup
  |--------------------------------------------------------------------------
  */

  const handleCancelSetup =
    async () => {
      await cancelTotpEnrollment()

      setSetup(null)

      setVerificationCode('')

      setActionError('')

      setStage(
        'reauth',
      )
    }

  /*
  |--------------------------------------------------------------------------
  | Copy Secret
  |--------------------------------------------------------------------------
  */

  const handleCopySecret =
    async () => {
      if (
        !setup?.secretKey
      ) {
        return
      }

      try {
        await navigator.clipboard.writeText(
          setup.secretKey,
        )

        setCopiedSecret(true)

        window.setTimeout(
          () => {
            setCopiedSecret(false)
          },
          2000,
        )
      } catch {
        setActionError(
          'Unable to copy automatically. Select and copy the setup key manually.',
        )
      }
    }

  const policy = mfaStatus?.policy
  const returnPath = activeMode === 'host' ? '/host/profile' : '/'
  const returnLabel = activeMode === 'host' ? 'Back to Host profile' : 'Back to EPANTRY'

  if (isLoadingStatus) {
    return <MfaFrame><div className="mfa-panel mfa-loading" role="status"><LoaderCircle className="animate-spin" size={22} /> Loading your security settings…</div></MfaFrame>
  }

  if (statusError) {
    return (
      <MfaFrame>
        <MfaHero title="Security settings" description="We couldn't check your account protection right now." />
        <section className="mfa-panel" style={{marginTop:20,padding:26}}>
          <div className="mfa-alert" role="alert"><CircleAlert size={18} aria-hidden="true" /> {statusError}</div>
          <button type="button" className="mfa-primary" onClick={loadStatus}><RefreshCw size={17} /> Try again</button>
        </section>
      </MfaFrame>
    )
  }

  if (mfaStatus?.enrolled && stage !== 'success') {
    return (
      <MfaFrame>
        <MfaHero title="Account security" description="Your multi-factor authentication is active. Review your protection and account policy below." active />
        <div className="mfa-content">
          <section className="mfa-panel" aria-label="Security overview">
            <header className="mfa-panel-header">
              <span className="mfa-mini-icon"><ShieldCheck size={20} /></span>
              <div><h2>Security overview</h2><p className="mfa-subtext">Protection enabled for this account</p></div>
            </header>
            <div className="mfa-panel-content">
              <div className="mfa-status-row"><div><div className="mfa-label">Authenticator app</div><p className="mfa-subtext">Time-based verification codes</p></div><span className="mfa-chip"><Check size={16} /> {mfaStatus.totpEnrolled ? 'Enabled' : 'Not enrolled'}</span></div>
              <div className="mfa-status-row"><div className="mfa-label">Enrolled security factors</div><div className="mfa-value">{mfaStatus.factorCount}</div></div>
              <div className="mfa-status-row"><div className="mfa-label">EPANTRY security policy</div><div className="mfa-value">{getPolicyLabel(policy?.mode)}</div></div>
            </div>
            <div className="mfa-bottom"><span className="mfa-account">{user?.email || 'Signed-in account'}</span><Link to={returnPath} className="mfa-primary"><ArrowLeft size={17} /> {returnLabel}</Link></div>
          </section>
          <aside className="mfa-help">
            <span className="mfa-mini-icon" style={{background:'#FFF7F2',color:'#A65536'}}><Info size={20}/></span>
            <h3 style={{marginTop:14}}>Keep your access secure</h3>
            <p>Your authenticator provides a code when an additional sign-in check is needed.</p>
            <p>Keep the authenticator entry on your phone so you can sign in without interruption.</p>
          </aside>
        </div>
      </MfaFrame>
    )
  }

  if (stage === 'success') {
    return (
      <MfaFrame>
        <MfaHero title="Authenticator connected" description="Multi-factor authentication is now enabled for your EPANTRY account." active />
        <div className="mfa-content">
          <section className="mfa-panel" style={{padding:26}}>
            <div className="mfa-chip"><Check size={16}/> Setup complete</div>
            <h2 style={{marginTop:18}}>You're all set</h2>
            <p className="mfa-form-help">Your authenticator app will generate the security codes required when you sign in.</p>
            {!sessionRefreshed && <div className="mfa-alert" role="alert">MFA is enabled, but your EPANTRY session could not be refreshed. You may need to sign in again.</div>}
            <div className="mfa-form-actions"><Link to={returnPath} className="mfa-primary"><ArrowRight size={17}/> {returnLabel}</Link></div>
          </section>
          <aside className="mfa-help"><h3>Keep the app installed</h3><p>Don't delete the EPANTRY entry from your authenticator app. You'll need its rotating codes at future sign-ins.</p></aside>
        </div>
      </MfaFrame>
    )
  }

  return (
    <MfaFrame>
      <MfaHero title="Set up account security" description="Add a second sign-in check to protect your EPANTRY account." />
      <section className="mfa-panel" style={{marginTop:18}} aria-label="Account and policy">
        <div className="mfa-panel-content">
          <div className="mfa-status-row"><span className="mfa-label">Account</span><span className="mfa-value" style={{fontSize:14}}>{user?.email || 'Signed in'}</span></div>
          <div className="mfa-status-row"><span className="mfa-label">Account policy</span><span className="mfa-chip">{getPolicyLabel(policy?.mode)}</span></div>
        </div>
      </section>
      {policy?.reason && <div className="mfa-note" role="note">{policy.reason}</div>}
      {!policy?.enrollmentAllowed ? (
        <section className="mfa-panel" style={{marginTop:18,padding:26}}>
          <div className="mfa-mini-icon"><CircleAlert size={20}/></div>
          <h2 style={{marginTop:14}}>Authenticator setup unavailable</h2>
          <p className="mfa-form-help">Your account currently isn't eligible for enrollment. Please check your account status.</p>
          <div className="mfa-form-actions"><Link to={returnPath} className="mfa-secondary"><ArrowLeft size={17}/> {returnLabel}</Link></div>
        </section>
      ) : stage === 'reauth' ? (
        <section className="mfa-form-layout" style={{marginTop:18}} aria-label="Verify your identity">
          <div className="mfa-form-story">
            <p className="mfa-step">01 / Verify identity</p>
            <h2>First, confirm it's you</h2>
            <p>Enter your current password. This protects your account before the authenticator key is created.</p>
            <div className="mfa-note"><LockKeyhole size={18} aria-hidden="true" style={{display:'inline',verticalAlign:'middle',marginRight:7}} /> Your password goes to Firebase Authentication—not the EPANTRY database.</div>
          </div>
          <div className="mfa-form-main">
            <div className="mfa-step-label">Step 1 of 2</div>
            <h2>Verify your password</h2>
            <p className="mfa-form-help">Use the password for your signed-in account.</p>
            {actionError && <div className="mfa-alert" role="alert">{actionError}</div>}
            <form onSubmit={handleStartEnrollment} style={{marginTop:22}}>
              <label htmlFor="mfa-password" className="mfa-input-label">Current password</label>
              <input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={event=>{setPassword(event.target.value);setActionError('')}} className="mfa-input" placeholder="Enter your password" required />
              <div className="mfa-form-actions">
                <button type="submit" disabled={isStarting} className="mfa-primary">{isStarting?<><LoaderCircle size={17} className="animate-spin"/> Verifying…</>:<><KeyRound size={17}/> Continue to setup <ArrowRight size={16}/></>}</button>
              </div>
            </form>
          </div>
        </section>
      ) : (
        <section className="mfa-panel" style={{marginTop:18}} aria-label="Authenticator setup">
          <header className="mfa-panel-header"><span className="mfa-mini-icon"><Smartphone size={20}/></span><div><div className="mfa-step-label">Step 2 of 2</div><h2>Connect your authenticator</h2><p className="mfa-subtext">Scan the QR code, then confirm the 6-digit code.</p></div></header>
          <div className="mfa-setup-columns">
            <div>
              <div className="mfa-qr">{setup?.qrCodeDataUrl && <img src={setup.qrCodeDataUrl} alt="Authenticator setup QR code" />}</div>
              {setup?.qrCodeUri && <a className="mfa-secondary" style={{marginTop:12,width:'100%'}} href={setup.qrCodeUri}><Smartphone size={16}/> Open authenticator app</a>}
            </div>
            <div>
              <div className="mfa-setup-details">
                <h3>Can't scan the QR?</h3>
                <p className="mfa-form-help">Add EPANTRY manually using this setup key.</p>
                <div className="mfa-secret"><code>{setup?.secretKey}</code><button type="button" className="mfa-secondary" onClick={handleCopySecret} aria-label="Copy authenticator setup key">{copiedSecret?<Check size={18}/>:<Clipboard size={18}/>}</button></div>
                <p className="mfa-subtext" style={{marginTop:9}}>Issuer: {setup?.issuer || 'EPANTRY'} · New code every {setup?.codeIntervalSeconds || 30}s</p>
              </div>
              {actionError && <div className="mfa-alert" role="alert">{actionError}</div>}
              <form onSubmit={handleCompleteEnrollment}>
                <label htmlFor="mfa-code" className="mfa-input-label">Authenticator code</label>
                <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={setup?.codeLength || 6} value={verificationCode} onChange={event=>{setVerificationCode(event.target.value.replace(/\D/g,'').slice(0,setup?.codeLength||6));setActionError('')}} className="mfa-input mfa-code" placeholder="000000" required />
                <div className="mfa-form-actions"><button type="submit" disabled={isCompleting} className="mfa-primary">{isCompleting?<><LoaderCircle size={17} className="animate-spin"/> Enabling…</>:<><ShieldCheck size={17}/> Verify and enable</>}</button><button type="button" disabled={isCompleting} className="mfa-secondary" onClick={handleCancelSetup}>Cancel setup</button></div>
              </form>
            </div>
          </div>
        </section>
      )}
    </MfaFrame>
  )
}
