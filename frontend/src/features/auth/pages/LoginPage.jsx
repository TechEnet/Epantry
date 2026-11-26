import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react'

import {
  Link,
  useLocation,
} from 'react-router-dom'

import {
  useAuth,
} from '../context/AuthContext'

import {
  getLoginErrorMessage,
} from '../services/auth.service'

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MFA_CODE_LENGTH =
  6

function validateLoginForm(
  form,
) {
  const errors = {}

  if (
    !EMAIL_PATTERN.test(
      form.email.trim(),
    )
  ) {
    errors.email =
      'Enter a valid email address.'
  }

  if (
    !form.password
  ) {
    errors.password =
      'Enter your password.'
  }

  return errors
}

function FieldError({
  message,
}) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-2 text-xs font-semibold text-red-600">
      {message}
    </p>
  )
}

function getFactorLabel(
  factor,
  index,
) {
  const displayName =
    String(
      factor?.displayName ||
        '',
    ).trim()

  if (displayName) {
    return displayName
  }

  return `Authenticator ${index + 1}`
}

function InputShell({
  children,
}) {
  return (
    <div
      className="
        relative
        w-full
        rounded-xl
        border
        border-stone-100
        bg-[#F7F6F2]
        shadow-[inset_3px_3px_6px_#dedede,inset_-3px_-3px_6px_#ffffff]
        transition
        duration-200
        focus-within:border-[#173F35]
        focus-within:bg-white
        focus-within:shadow-[inset_2px_2px_5px_#dedede,inset_-2px_-2px_5px_#ffffff,0_0_0_3px_rgba(16,185,129,0.08)]
      "
    >
      {children}
    </div>
  )
}

function LoginShell({
  children,
}) {
  return (
    <main
      id="epantry-login"
      className="flex min-h-[calc(100svh-76px)] w-full items-center bg-[#F6F4F0] px-3 py-4 sm:px-5 lg:px-6"
    >
      <div className="mx-auto grid w-full max-w-[1280px] overflow-hidden rounded-[18px] border border-[#E6E0D9] bg-[#FFFDFB] shadow-[0_15px_40px_rgba(43,36,30,0.045)] lg:h-[calc(100svh-126px)] lg:max-h-[690px] lg:min-h-[550px] lg:grid-cols-[35%_65%] lg:rounded-[20px]">
        <aside className="flex min-w-0 flex-col bg-[#EAC9B6] px-5 py-5 sm:px-7 lg:px-8 lg:py-7">
          <div className="flex items-center gap-2 text-[13px] font-bold text-[#6F4C3F]">
            <span>EPANTRY</span>
            <span className="h-1 w-1 rounded-full bg-[#A97059]" aria-hidden="true" />
            <span className="font-medium">Welcome back</span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 sm:gap-6 lg:my-auto lg:flex-col lg:justify-center lg:gap-7">
            <div className="min-w-0 lg:text-center">
              <h2 className="max-w-[320px] text-[22px] font-bold leading-[1.18] tracking-[-0.03em] text-[#244539] sm:text-[27px] lg:mx-auto lg:text-[clamp(25px,2.25vw,31px)]">
                Back to what you love.
              </h2>
              <p className="mt-2 hidden text-[14px] leading-[1.5] text-[#65574F] sm:block">
                Your food journey continues here.
              </p>
            </div>

            <div className="w-[106px] shrink-0 overflow-hidden rounded-[16px] border-[5px] border-[#F8EBE3] bg-[#F9F5F0] shadow-[0_12px_25px_rgba(81,48,35,0.09)] sm:w-[146px] lg:aspect-square lg:w-[min(72%,238px)] lg:rounded-[20px] lg:border-[7px]">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="EPANTRY login animation"
                className="block aspect-square h-full w-full bg-[#F8F4EE] object-contain"
              >
                <source src="/video/Login.mp4" type="video/mp4" />
                Your browser does not support video playback.
              </video>
            </div>
          </div>
          <div className="mt-5 hidden h-px w-full bg-[#D5AE9B] lg:block" aria-hidden="true" />
        </aside>

        <section className="flex min-w-0 flex-col justify-center bg-[#FFFDFB] px-5 py-6 sm:px-8 lg:overflow-y-auto lg:px-[clamp(28px,4vw,62px)] lg:py-9">
          <div className="mx-auto w-full max-w-[540px]">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}

export default function LoginPage() {
  const location =
    useLocation()

  const {
    login,
    completeMfaLogin,
    cancelMfaLogin,
    isAuthenticating,
    isMfaRequired,
    mfaChallenge,
    isCompletingMfa,
    sessionNotice,
    clearSessionNotice,
  } = useAuth()

  const returnTo =
    new URLSearchParams(
      location.search,
    ).get(
      'returnTo',
    ) ||
    ''

  const safeReturnTo =
    returnTo.startsWith('/') &&
    !returnTo.startsWith('//')
      ? returnTo
      : ''

  const registerHref =
    safeReturnTo
      ? `/register?returnTo=${encodeURIComponent(
          safeReturnTo,
        )}`
      : '/register'

  const [
    form,
    setForm,
  ] = useState({
    email: '',
    password: '',
  })

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({})

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [
    verificationCode,
    setVerificationCode,
  ] = useState('')

  const [
    selectedFactorUid,
    setSelectedFactorUid,
  ] = useState('')

  const factors =
    useMemo(
      () =>
        Array.isArray(
          mfaChallenge?.factors,
        )
          ? mfaChallenge.factors
          : [],
      [
        mfaChallenge,
      ],
    )

  useEffect(() => {
    if (
      !isMfaRequired ||
      factors.length ===
        0
    ) {
      setSelectedFactorUid('')
      return
    }

    const selectedExists =
      factors.some(
        (factor) =>
          factor.uid ===
          selectedFactorUid,
      )

    if (
      selectedExists
    ) {
      return
    }

    setSelectedFactorUid(
      factors[0].uid,
    )
  }, [
    factors,
    isMfaRequired,
    selectedFactorUid,
  ])

  useEffect(
    () => {
      return () => {
        void cancelMfaLogin()
      }
    },
    [
      cancelMfaLogin,
    ],
  )

  const updateField = (
    key,
    value,
  ) => {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )

    if (
      fieldErrors[key]
    ) {
      setFieldErrors(
        (current) => ({
          ...current,
          [key]: undefined,
        }),
      )
    }

    setErrorMessage('')
  }

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault()

      const nextErrors =
        validateLoginForm(
          form,
        )

      if (
        Object.keys(
          nextErrors,
        ).length >
        0
      ) {
        setFieldErrors(
          nextErrors,
        )
        return
      }

      setFieldErrors({})
      setErrorMessage('')

      try {
        const result =
          await login({
            email:
              form.email.trim(),

            password:
              form.password,
          })

        if (
          result?.mfaRequired ===
          true
        ) {
          setForm(
            (current) => ({
              ...current,
              password: '',
            }),
          )

          setShowPassword(false)
          setVerificationCode('')
        }
      } catch (error) {
        setErrorMessage(
          getLoginErrorMessage(
            error,
          ),
        )
      }
    }

  const handleVerificationCodeChange =
    (
      event,
    ) => {
      const digitsOnly =
        event.target.value
          .replace(
            /\D/g,
            '',
          )
          .slice(
            0,
            MFA_CODE_LENGTH,
          )

      setVerificationCode(
        digitsOnly,
      )

      setErrorMessage('')
    }

  const handleMfaSubmit =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        verificationCode.length !==
        MFA_CODE_LENGTH
      ) {
        setErrorMessage(
          `Enter the ${MFA_CODE_LENGTH}-digit code from your authenticator app.`,
        )
        return
      }

      if (
        !selectedFactorUid
      ) {
        setErrorMessage(
          'Select an authenticator to continue.',
        )
        return
      }

      setErrorMessage('')

      try {
        await completeMfaLogin({
          factorUid:
            selectedFactorUid,

          verificationCode,
        })

        setVerificationCode('')
      } catch (error) {
        setErrorMessage(
          getLoginErrorMessage(
            error,
          ),
        )

        if (
          error?.code ===
            'auth/invalid-verification-code' ||
          error?.code ===
            'auth/invalid-mfa-code' ||
          error?.code ===
            'auth/code-expired'
        ) {
          setVerificationCode('')
        }
      }
    }

  const handleBackToPassword =
    async () => {
      if (
        isCompletingMfa
      ) {
        return
      }

      await cancelMfaLogin()

      setVerificationCode('')
      setSelectedFactorUid('')
      setErrorMessage('')
      setFieldErrors({})

      setForm(
        (current) => ({
          ...current,
          password: '',
        }),
      )
    }

  const forgotPasswordPath =
    form.email.trim()
      ? `/forgot-password?email=${encodeURIComponent(
          form.email.trim(),
        )}`
      : '/forgot-password'

  const selectedFactor =
    factors.find(
      (factor) =>
        factor.uid ===
        selectedFactorUid,
    ) ||
    factors[0] ||
    null

  if (
    isMfaRequired
  ) {
    return (
      <main id="epantry-login-mfa" className="w-full bg-[#F7F6F2] px-4 py-7 sm:px-6 sm:py-12">
        <style>{`
          #epantry-login-mfa { display:grid; place-items:center; min-height: min(720px, calc(100svh - 76px)); padding: 32px 20px; }
          #epantry-login-mfa .mfa-wrap { width:100%; max-width:480px; border:1px solid #D7DDCF; border-radius:18px; overflow:hidden; background:#fff; box-shadow:0 16px 48px rgba(23,63,53,.09); }
          #epantry-login-mfa .mfa-header { background:#C56C42; color:#202421; padding:24px 30px; }
          #epantry-login-mfa .mfa-header h1 { font-size:30px !important; line-height:1.15 !important; letter-spacing:-.035em; margin:16px 0 5px; }
          #epantry-login-mfa .mfa-body { padding:24px 30px 28px; }
          #epantry-login-mfa .mfa-code-wrap { position:relative; display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
          #epantry-login-mfa .mfa-digit { height:58px; display:grid; place-items:center; border:1px solid #D7DDCF; border-radius:9px; background:#F7F6F2; font-size:25px; font-weight:700; color:#202421; }
          #epantry-login-mfa .mfa-code-wrap:focus-within .mfa-digit.is-current { border-color:#C56C42; box-shadow:0 0 0 2px #C56C42; }
          #epantry-login-mfa .mfa-code { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:text; }
          #epantry-login-mfa button:focus-visible, #epantry-login-mfa select:focus-visible { outline:2px solid #173F35; outline-offset:3px; }
          @media(max-width:480px) { #epantry-login-mfa { padding:20px 14px; min-height:0; } #epantry-login-mfa .mfa-header, #epantry-login-mfa .mfa-body { padding:20px; } #epantry-login-mfa .mfa-header h1 { font-size:27px !important; } #epantry-login-mfa .mfa-digit { height:50px; } #epantry-login-mfa .mfa-code-wrap { gap:6px; } }
        `}</style>
        <section className="mfa-wrap">
          <header className="mfa-header">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={handleBackToPassword} disabled={isCompletingMfa} className="inline-flex items-center gap-2 text-[14px] font-semibold hover:underline disabled:opacity-50"><ArrowLeft size={17}/> Back</button>
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold"><ShieldCheck size={18} aria-hidden="true"/> Step 2 of 2</span>
            </div>
            <h1 className="font-bold">Two-step verification</h1>
            <p className="text-[15px] leading-relaxed">Enter the code from your authenticator app.</p>
          </header>
          <div className="mfa-body min-w-0">
            <div className="flex items-center gap-3 rounded-[10px] bg-[#D7DDCF] px-4 py-3">
              <Mail size={19} className="shrink-0 text-[#173F35]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] text-[#173F35]">Signing in as</p>
                <p className="break-all text-[15px] font-semibold text-[#202421]">{form.email.trim()}</p>
              </div>
            </div>

            {errorMessage && (
              <div className="mt-4 flex items-start gap-3 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-red-800" role="alert">
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <p className="text-[14px] font-medium leading-5">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleMfaSubmit} className="mt-5" noValidate>
              {factors.length > 1 && (
                <div className="mb-5">
                  <label htmlFor="mfa-factor" className="mb-2 block text-[14px] font-semibold text-[#202421]">Authenticator</label>
                  <div className="relative">
                    <Smartphone size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#173F35]" aria-hidden="true" />
                    <select
                      id="mfa-factor"
                      value={selectedFactorUid}
                      onChange={(event) => {
                        setSelectedFactorUid(event.target.value)
                        setVerificationCode('')
                        setErrorMessage('')
                      }}
                      className="h-12 w-full rounded-[10px] border border-[#D7DDCF] bg-white pl-10 pr-3 text-[15px] font-semibold text-[#202421]"
                    >
                      {factors.map((factor, index) => (
                        <option key={factor.uid} value={factor.uid}>{getFactorLabel(factor, index)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {factors.length === 1 && (
                <div className="mb-5 flex items-center gap-3 border-b border-[#D7DDCF] px-1 pb-4">
                  <Smartphone size={20} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-semibold text-[#202421]">{getFactorLabel(selectedFactor, 0)}</p>
                    
                  </div>
                </div>
              )}

              <label htmlFor="login-mfa-code" className="mb-2 block text-[15px] font-semibold text-[#202421]">6-digit code</label>
              <div className="mfa-code-wrap">
                {Array.from({ length: MFA_CODE_LENGTH }, (_, index) => (
                  <span key={index} aria-hidden="true" className={`mfa-digit ${index === Math.min(verificationCode.length, MFA_CODE_LENGTH - 1) ? 'is-current' : ''}`}>
                    {verificationCode[index] || <span className="text-[#D7DDCF]">–</span>}
                  </span>
                ))}
                <input id="login-mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={MFA_CODE_LENGTH} value={verificationCode} onChange={handleVerificationCodeChange} autoFocus className="mfa-code" />
              </div>

              <button
                type="submit"
                disabled={isCompletingMfa || verificationCode.length !== MFA_CODE_LENGTH || !selectedFactorUid}
                className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-[#C56C42] px-4 text-[15px] font-bold text-[#202421] transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCompletingMfa ? (
                  <><LoaderCircle size={18} className="animate-spin" /> Verifying...</>
                ) : (
                  <>Verify & sign in <ArrowRight size={18} aria-hidden="true" /></>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
    )
  }

  return (
    <LoginShell>
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-[#EAE6E0] pb-5 sm:mb-7">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#B3644A]">
            Your EPANTRY account
          </p>
          <h1 className="mt-1.5 text-[clamp(30px,3vw,39px)] font-bold leading-[1.15] tracking-[-0.035em] text-[#233B30]">
            Welcome back
          </h1>
        </div>
        <Link
          to={registerHref}
          className="shrink-0 pt-1 text-[14px] font-semibold text-[#AC5D43] underline-offset-4 transition hover:underline"
        >
          Sign up
        </Link>
      </header>

      {sessionNotice && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[14px] text-amber-900"
          role="status"
        >
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p className="min-w-0 flex-1 leading-5">{sessionNotice}</p>
          <button
            type="button"
            onClick={clearSessionNotice}
            className="grid size-7 shrink-0 place-items-center rounded-lg transition hover:bg-amber-100"
            aria-label="Dismiss session message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-800"
          role="alert"
        >
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p className="leading-5">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]"
          >
            Email address
          </label>
          <div className="flex h-[50px] items-center gap-3 rounded-[12px] border border-[#DFDED8] bg-white px-4 transition focus-within:border-[#B86C51] focus-within:ring-[3px] focus-within:ring-[#B86C51]/10">
            <Mail size={18} className="shrink-0 text-[#8A938B]" aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
              className="h-full w-full min-w-0 bg-transparent text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96]"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p id="login-email-error" className="mt-1.5 text-[13px] font-medium text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              htmlFor="login-password"
              className="text-[14px] font-semibold text-[#2C4035]"
            >
              Password
            </label>
            <Link
              to={forgotPasswordPath}
              className="text-[13px] font-semibold text-[#AC6147] underline-offset-4 transition hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="flex h-[50px] items-center gap-3 rounded-[12px] border border-[#DFDED8] bg-white pl-4 pr-2 transition focus-within:border-[#B86C51] focus-within:ring-[3px] focus-within:ring-[#B86C51]/10">
            <LockKeyhole size={18} className="shrink-0 text-[#8A938B]" aria-hidden="true" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="h-full w-full min-w-0 bg-transparent text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96]"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-[#887E72] transition hover:bg-[#F7EAE3]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="login-password-error" className="mt-1.5 text-[13px] font-medium text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isAuthenticating}
          className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#B86C51] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[#9E553D] active:bg-[#88442F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAuthenticating ? (
            <>
              <LoaderCircle size={18} className="animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Log in
              <ArrowRight size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-[#716B66]">
        New to EPANTRY?{' '}
        <Link to={registerHref} className="font-bold text-[#A95D44] underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </LoginShell>
  )
}
