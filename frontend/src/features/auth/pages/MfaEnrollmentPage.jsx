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
  #ep-mfa-enrollment { width: 100%; min-width: 0; margin: 0; padding: clamp(16px,2.4vw,32px); background: #F7F6F2; color: #202421; }
  #ep-mfa-enrollment .mfa-layout { width: 100%; min-width: 0; max-width: none; margin: 0 auto; }
  #ep-mfa-enrollment .mfa-hero { display: flex; justify-content: space-between; align-items: stretch; gap: 24px; padding: 0; background: #F8E7DC; border: 1px solid #E8D3C5; border-top: 3px solid #C86C42; border-radius: 16px; overflow: hidden; }
  #ep-mfa-enrollment .mfa-hero-main { min-width: 0; padding: 28px 34px 30px; }
  #ep-mfa-enrollment .mfa-eyebrow { display: flex; align-items: center; gap: 9px; color: #895039; font-size: 12px; line-height: 18px; letter-spacing: .045em; font-weight: 700; text-transform: uppercase; }
  #ep-mfa-enrollment .mfa-eyebrow-mark { width: 28px; height: 28px; display: inline-grid; place-items: center; border: 1px solid #DEB99F; border-radius: 9px; background: #FFF9F4; color: #984C31; }
  #root #ep-mfa-enrollment h1 { margin: 13px 0 8px; font-size: clamp(29px,2.9vw,38px) !important; line-height: 1.18 !important; letter-spacing: -.035em; font-weight: 700; color: #173F35 !important; }
  #root #ep-mfa-enrollment h2 { margin: 0; font-size: clamp(21px,2.1vw,25px) !important; line-height: 1.28 !important; letter-spacing: -.024em; font-weight: 700; color: #173F35 !important; }
  #root #ep-mfa-enrollment h3 { margin: 0; font-size: 18px !important; line-height: 1.35 !important; font-weight: 700; color: #173F35 !important; }
  #ep-mfa-enrollment .mfa-hero-copy { margin: 0; max-width: 590px; color: #60574F; font-size: 15px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-hero-side { flex: 0 0 280px; min-width: 0; display: flex; align-items: center; gap: 15px; padding: 26px 24px; background: #E6EBDD; border-left: 1px solid #D6D9CD; color: #173F35; }
  #ep-mfa-enrollment .mfa-side-icon { width: 51px; height: 51px; flex: 0 0 51px; display: grid; place-items: center; background: #FFFDF8; border: 1px solid #CCD7C8; border-radius: 50%; color: #173F35; }
  #ep-mfa-enrollment .mfa-side-title { font-size: 17px; font-weight: 700; line-height: 1.3; }
  #ep-mfa-enrollment .mfa-side-detail { margin-top: 4px; color: #52665A; font-size: 13px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-security-grid { display: grid; grid-template-columns: minmax(235px,.58fr) minmax(0,1.6fr); margin-top: 18px; border: 1px solid #D8E1D6; border-radius: 16px; overflow: hidden; background: #FFFEFC; }
  #ep-mfa-enrollment .mfa-status-feature { padding: 30px; background: #173F35; color: #F7F6F2; display: flex; flex-direction: column; align-items: flex-start; min-height: 275px; }
  #ep-mfa-enrollment .mfa-feature-icon { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: #E3EBDF; color: #173F35; }
  #ep-mfa-enrollment .mfa-feature-caption { font-size: 12px; line-height: 1.45; font-weight: 700; text-transform: uppercase; letter-spacing: .055em; color: #BBD0C4; margin-top: auto; padding-top: 24px; }
  #ep-mfa-enrollment .mfa-feature-title { margin-top: 4px; font-size: clamp(30px,3.1vw,42px); line-height: 1.15; font-weight: 700; letter-spacing: -.035em; }
  #ep-mfa-enrollment .mfa-feature-text { color: #D5E5DB; font-size: 14px; line-height: 1.55; margin-top: 9px; max-width: 310px; }
  #ep-mfa-enrollment .mfa-security-info { min-width: 0; display: flex; flex-direction: column; }
  #ep-mfa-enrollment .mfa-overview-head { padding: 22px 28px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  #ep-mfa-enrollment .mfa-overview-head p { color: #64746A; margin: 5px 0 0; font-size: 13px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 8px; background: #E1EFE5; color: #205A41; font-size: 13px; line-height: 1.3; font-weight: 700; white-space: nowrap; }
  #ep-mfa-enrollment .mfa-metric-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-top: 1px solid #E8ECE5; border-bottom: 1px solid #E8ECE5; flex: 1; }
  #ep-mfa-enrollment .mfa-metric { min-width: 0; padding: 20px 23px 18px; display: flex; flex-direction: column; justify-content: space-between; gap: 18px; }
  #ep-mfa-enrollment .mfa-metric + .mfa-metric { border-left: 1px solid #E8ECE5; }
  #ep-mfa-enrollment .mfa-metric-label { color: #58665D; font-size: 13px; line-height: 1.45; font-weight: 600; }
  #ep-mfa-enrollment .mfa-metric-value { color: #173F35; font-size: clamp(20px,2.2vw,27px); line-height: 1.2; font-weight: 700; letter-spacing: -.025em; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-security-footer { display: flex; justify-content: space-between; gap: 18px; align-items: center; flex-wrap: wrap; padding: 15px 24px; background: #F5F6F1; }
  #ep-mfa-enrollment .mfa-account { color: #596B61; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; min-width: 0; }
  #ep-mfa-enrollment .mfa-advice { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 17px 23px; margin-top: 16px; border: 1px solid #D7E4E9; border-radius: 13px; background: #E8F1F3; }
  #ep-mfa-enrollment .mfa-advice-message { display: flex; align-items: flex-start; gap: 11px; color: #31576A; font-size: 14px; line-height: 1.5; }
  #ep-mfa-enrollment .mfa-advice-message svg { flex: 0 0 auto; margin-top: 2px; }
  #ep-mfa-enrollment .mfa-advice-message strong { color: #21495B; }
  #ep-mfa-enrollment .mfa-advice-small { font-size: 13px; color: #4A6B78; }
  #ep-mfa-enrollment .mfa-primary, #ep-mfa-enrollment .mfa-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 10px; padding: 9px 17px; font-size: 14px; line-height: 1.35; font-weight: 700; text-decoration: none; cursor: pointer; transition: background .15s ease, border-color .15s ease; }
  #ep-mfa-enrollment .mfa-primary { background: #173F35; color: #FFF; border: 1px solid #173F35; }
  #ep-mfa-enrollment .mfa-primary:hover { background: #28614E; color: #FFF; }
  #ep-mfa-enrollment .mfa-secondary { background: #FFFEFC; color: #173F35; border: 1px solid #B8CCBE; }
  #ep-mfa-enrollment .mfa-secondary:hover { background: #E8F0E5; }
  #ep-mfa-enrollment button:disabled { opacity: .58; cursor: not-allowed; }
  #ep-mfa-enrollment :is(button,a,input):focus-visible { outline: 3px solid #C86C42; outline-offset: 3px; }
  #ep-mfa-enrollment .mfa-panel { min-width: 0; background: #FFFEFC; border: 1px solid #DAE2D8; border-radius: 16px; overflow: hidden; }
  #ep-mfa-enrollment .mfa-content { display: grid; grid-template-columns: minmax(0,1.65fr) minmax(250px,.7fr); align-items: start; gap: 18px; margin-top: 18px; }
  #ep-mfa-enrollment .mfa-panel-header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; background: #E9F0EA; border-bottom: 1px solid #DCE5DC; }
  #ep-mfa-enrollment .mfa-mini-icon { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 10px; background: #DCE8DA; color: #173F35; }
  #ep-mfa-enrollment .mfa-panel-content { padding: 3px 24px; }
  #ep-mfa-enrollment .mfa-status-row { padding: 16px 0; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 14px; border-bottom: 1px solid #E9ECE6; }
  #ep-mfa-enrollment .mfa-status-row:last-child { border-bottom: none; }
  #ep-mfa-enrollment .mfa-label { color: #344F40; font-size: 15px; font-weight: 600; line-height: 1.4; }
  #ep-mfa-enrollment .mfa-value { color: #173F35; font-size: 16px; line-height: 1.4; font-weight: 700; text-align: right; overflow-wrap: anywhere; }
  #ep-mfa-enrollment .mfa-subtext { margin: 4px 0 0; font-size: 13px; line-height: 1.5; color: #64776A; }
  #ep-mfa-enrollment .mfa-bottom { padding: 15px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; background: #F4F6F1; border-top: 1px solid #E3E9E0; }
  #ep-mfa-enrollment .mfa-help { min-width: 0; background: #FBE9DD; border: 1px solid #ECD3C4; border-radius: 16px; padding: 22px; color: #674B3D; }
  #ep-mfa-enrollment .mfa-help p { font-size: 14px; line-height: 1.55; margin: 9px 0 0; color: #654F42; }
  #ep-mfa-enrollment .mfa-help ul { padding-left: 19px; margin: 13px 0 0; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-form-layout { margin-top: 18px; display: grid; grid-template-columns: minmax(0,.8fr) minmax(0,1.2fr); overflow: hidden; border: 1px solid #D6E1E3; border-radius: 16px; background: #FFFEFC; }
  #ep-mfa-enrollment .mfa-form-story { background: #E7F0F3; padding: 28px; border-right: 1px solid #D7E5EA; }
  #ep-mfa-enrollment .mfa-form-story p { margin: 11px 0 0; color: #546F79; font-size: 14px; line-height: 1.6; }
  #ep-mfa-enrollment .mfa-form-story .mfa-step { margin: 0 0 13px; color: #346779; font-size: 13px; letter-spacing: .05em; text-transform: uppercase; font-weight: 700; }
  #ep-mfa-enrollment .mfa-form-main { min-width: 0; padding: 28px; }
  #ep-mfa-enrollment .mfa-step-label { margin-bottom: 8px; color: #A5563D; font-size: 13px; font-weight: 700; }
  #ep-mfa-enrollment .mfa-form-help { margin: 9px 0 0; color: #65756A; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-input-label { display: block; font-size: 14px; font-weight: 700; color: #173F35; margin-bottom: 8px; }
  #ep-mfa-enrollment .mfa-input { width: 100%; min-height: 49px; padding: 11px 14px; border: 1px solid #BFD0C3; border-radius: 10px; background: #FFF; font-size: 15px; color: #202421; }
  #ep-mfa-enrollment .mfa-input:focus { border-color: #173F35; }
  #ep-mfa-enrollment .mfa-form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 19px; }
  #ep-mfa-enrollment .mfa-alert { border: 1px solid #E7B5A3; border-radius: 10px; background: #FFF1E8; color: #893C28; padding: 12px 14px; margin: 15px 0; font-size: 14px; line-height: 1.5; }
  #ep-mfa-enrollment .mfa-note { margin-top: 20px; border: 1px solid #D9E6D7; border-radius: 11px; padding: 14px 16px; background: #EAF2E7; color: #385841; font-size: 14px; line-height: 1.55; }
  #ep-mfa-enrollment .mfa-setup-columns { display: grid; grid-template-columns: minmax(220px,.75fr) minmax(0,1.25fr); gap: 24px; padding: 24px; }
  #ep-mfa-enrollment .mfa-qr { padding: 20px; border: 1px solid #D5DECE; border-radius: 13px; background: #FFF; }
  #ep-mfa-enrollment .mfa-qr img { display: block; width: 100%; max-width: 244px; height: auto; margin: auto; }
  #ep-mfa-enrollment .mfa-setup-details { padding: 18px; margin-bottom: 18px; background: #E8F0F3; border: 1px solid #D8E5E9; border-radius: 12px; }
  #ep-mfa-enrollment .mfa-secret { display: flex; align-items: stretch; gap: 8px; margin-top: 12px; }
  #ep-mfa-enrollment .mfa-secret code { flex: 1; min-width: 0; overflow-wrap: anywhere; border: 1px solid #CCDCD6; background: #FFF; border-radius: 10px; padding: 11px; font-size: 14px; line-height: 1.45; }
  #ep-mfa-enrollment .mfa-code { letter-spacing: .2em; font-size: 23px; font-weight: 700; text-align: center; }
  #ep-mfa-enrollment .mfa-loading { min-height: 160px; display: flex; align-items: center; gap: 12px; padding: 30px; color: #173F35; font-size: 15px; font-weight: 600; }
  @media (max-width: 980px) {
    #ep-mfa-enrollment .mfa-hero-side { flex-basis: 225px; }
    #ep-mfa-enrollment .mfa-security-grid { grid-template-columns: minmax(210px,.65fr) minmax(0,1.35fr); }
    #ep-mfa-enrollment .mfa-status-feature { padding: 24px; }
    #ep-mfa-enrollment .mfa-metric { padding: 18px 14px; }
    #ep-mfa-enrollment .mfa-content { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    #ep-mfa-enrollment .mfa-hero { flex-direction: column; gap: 0; }
    #ep-mfa-enrollment .mfa-hero-main { padding: 24px 22px; }
    #ep-mfa-enrollment .mfa-hero-side { flex: 0 0 auto; border-left: 0; border-top: 1px solid #D6D9CD; padding: 14px 22px; }
    #ep-mfa-enrollment .mfa-side-icon { width: 36px; height: 36px; flex-basis: 36px; }
    #ep-mfa-enrollment .mfa-security-grid { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-status-feature { min-height: auto; display: grid; grid-template-columns: 47px 1fr; align-items: center; column-gap: 15px; padding: 20px; }
    #ep-mfa-enrollment .mfa-feature-icon { width: 47px; height: 47px; grid-row: span 3; border-radius: 12px; }
    #ep-mfa-enrollment .mfa-feature-caption { margin: 0; padding: 0; }
    #ep-mfa-enrollment .mfa-feature-title { font-size: 27px; }
    #ep-mfa-enrollment .mfa-feature-text { margin-top: 2px; }
    #ep-mfa-enrollment .mfa-metric-grid { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-metric { padding: 13px 18px; flex-direction: row; align-items: center; gap: 12px; }
    #ep-mfa-enrollment .mfa-metric + .mfa-metric { border-left: 0; border-top: 1px solid #E8ECE5; }
    #ep-mfa-enrollment .mfa-metric-value { text-align: right; font-size: 19px; }
    #ep-mfa-enrollment .mfa-form-layout { grid-template-columns: 1fr; }
    #ep-mfa-enrollment .mfa-form-story { padding: 22px; border-right: 0; border-bottom: 1px solid #D7E5EA; }
    #ep-mfa-enrollment .mfa-setup-columns { grid-template-columns: 1fr; }
  }
  @media (max-width: 540px) {
    #ep-mfa-enrollment { padding: 12px 10px 24px; }
    #ep-mfa-enrollment .mfa-hero-main { padding: 20px 18px; }
    #root #ep-mfa-enrollment h1 { font-size: 27px !important; }
    #ep-mfa-enrollment .mfa-hero-side { padding: 13px 18px; }
    #ep-mfa-enrollment .mfa-side-title { font-size: 15px; }
    #ep-mfa-enrollment .mfa-side-detail { font-size: 12.5px; }
    #ep-mfa-enrollment .mfa-overview-head { padding: 17px 18px; }
    #ep-mfa-enrollment .mfa-advice { padding: 15px 17px; }
    #ep-mfa-enrollment .mfa-security-footer { align-items: stretch; }
    #ep-mfa-enrollment .mfa-security-footer .mfa-primary { width: 100%; }
    #ep-mfa-enrollment .mfa-panel-header, #ep-mfa-enrollment .mfa-bottom { padding: 16px 18px; }
    #ep-mfa-enrollment .mfa-panel-content { padding: 0 18px; }
    #ep-mfa-enrollment .mfa-form-main { padding: 21px 18px; }
    #ep-mfa-enrollment .mfa-setup-columns { padding: 17px; }
    #ep-mfa-enrollment .mfa-form-actions .mfa-primary { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) { #ep-mfa-enrollment * { transition: none !important; animation-duration: .01ms !important; } }
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
    <header className="mfa-hero">
      <div className="mfa-hero-main">
        <div className="mfa-eyebrow"><span className="mfa-eyebrow-mark"><ShieldCheck size={17} aria-hidden="true" /></span> Account / Security</div>
        <h1>{title}</h1>
        <p className="mfa-hero-copy">{description}</p>
      </div>
      <div className="mfa-hero-side">
        <span className="mfa-side-icon">{active ? <CheckCircle2 size={22} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}</span>
        <div>
          <div className="mfa-side-title">{active ? 'MFA is active' : 'Two-step protection'}</div>
          <div className="mfa-side-detail">{active ? 'An extra sign-in check is ready.' : 'Secure your account with an authenticator.'}</div>
        </div>
      </div>
    </header>
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
        <MfaHero title="Sign-in security" description="Your authenticator is ready whenever an extra sign-in check is needed." active />

        <section className="mfa-security-grid" aria-label="Account protection overview">
          <div className="mfa-status-feature">
            <span className="mfa-feature-icon"><ShieldCheck size={28} aria-hidden="true" /></span>
            <div className="mfa-feature-caption">Protection status</div>
            <div className="mfa-feature-title">Active</div>
            <div className="mfa-feature-text">Your account has an additional security factor.</div>
          </div>
          <div className="mfa-security-info">
            <div className="mfa-overview-head">
              <div>
                <h2>Security details</h2>
                <p>Your current sign-in protection</p>
              </div>
              <span className="mfa-chip"><Check size={15} aria-hidden="true" /> Protected</span>
            </div>
            <div className="mfa-metric-grid">
              <div className="mfa-metric">
                <span className="mfa-metric-label">Authenticator app</span>
                <strong className="mfa-metric-value">{mfaStatus.totpEnrolled ? 'Enabled' : 'Not enrolled'}</strong>
              </div>
              <div className="mfa-metric">
                <span className="mfa-metric-label">Security factors</span>
                <strong className="mfa-metric-value">{mfaStatus.factorCount}</strong>
              </div>
              <div className="mfa-metric">
                <span className="mfa-metric-label">Account policy</span>
                <strong className="mfa-metric-value">{getPolicyLabel(policy?.mode)}</strong>
              </div>
            </div>
            <div className="mfa-security-footer">
              <span className="mfa-account">{user?.email || 'Signed-in account'}</span>
              <Link to={returnPath} className="mfa-primary"><ArrowLeft size={16} aria-hidden="true" /> {returnLabel}</Link>
            </div>
          </div>
        </section>

        <aside className="mfa-advice">
          <div className="mfa-advice-message">
            <Info size={19} aria-hidden="true" />
            <span><strong>Keep your authenticator available.</strong> You'll need its code when EPANTRY requests another sign-in check.</span>
          </div>
          <span className="mfa-advice-small">Account protection</span>
        </aside>
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
