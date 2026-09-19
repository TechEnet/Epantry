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
        bg-[#f8f8f8]
        shadow-[inset_3px_3px_6px_#dedede,inset_-3px_-3px_6px_#ffffff]
        transition
        duration-200
        focus-within:border-emerald-200
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
      className="
        relative
        overflow-hidden
        bg-[#f7f5ef]
        py-4
        lg:py-5
      "
    >

      <div
        className="
          pointer-events-none
          absolute
          -left-24
          top-10
          size-72
          rounded-full
          bg-emerald-100/50
          blur-3xl
        "
        aria-hidden="true"
      />

      <div
        className="
          pointer-events-none
          absolute
          -right-24
          bottom-12
          size-80
          rounded-full
          bg-amber-100/50
          blur-3xl
        "
        aria-hidden="true"
      />

      <div className="page-shell relative">

        <div
          className="
            mx-auto
            grid
            max-w-6xl
            overflow-hidden
            rounded-[28px]
            border
            border-stone-200/80
            bg-white
            shadow-[0_20px_65px_rgba(28,25,23,0.08)]
            lg:grid-cols-[0.9fr_1.1fr]
          "
        >

          <aside
            className="
              relative
              hidden
              min-h-[610px]
              overflow-hidden
              bg-stone-950
              p-8
              text-white
              lg:flex
              lg:flex-col
              xl:p-10
            "
          >

            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(245,158,11,0.10),transparent_32%)]
              "
              aria-hidden="true"
            />

            <Link
              to="/"
              className="
                focus-ring
                relative
                z-10
                inline-flex
                w-fit
                items-center
                gap-3
                rounded-xl
              "
            >
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-sm font-black text-white">
                E
              </span>

              <span>
                <span className="block text-lg font-black tracking-tight">
                  EPANTRY
                </span>

                <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-[0.22em] text-stone-400">
                  Food Intelligence
                </span>
              </span>
            </Link>

            <div className="relative z-10 flex flex-1 items-center justify-center py-5">

              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="EPANTRY login"
                className="
                  block
                  max-h-[360px]
                  w-auto
                  max-w-[280px]
                  rounded-[20px]
                  object-contain
                "
              >
                <source
                  src="/video/Login.mp4"
                  type="video/mp4"
                />

                Your browser does not support video playback.
              </video>

            </div>

          </aside>

          <section
            className="
              flex
              min-h-[610px]
              items-center
              bg-white
              px-6
              py-8
              sm:px-8
              lg:px-10
              xl:px-12
            "
          >
            <div className="mx-auto w-full max-w-[500px]">
              {children}
            </div>
          </section>

        </div>

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
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">

        <section
          style={{
            width:
              'min(500px, calc(100vw - 32px))',
          }}
          className="
            shrink-0
            rounded-[22px]
            border
            border-stone-200/80
            bg-white
            px-8
            py-8
            shadow-[0_24px_70px_rgba(41,37,36,0.13),0_4px_18px_rgba(41,37,36,0.06)]
          "
        >

          <button
            type="button"
            onClick={
              handleBackToPassword
            }
            disabled={
              isCompletingMfa
            }
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 transition hover:text-stone-950 disabled:opacity-50"
          >
            <ArrowLeft
              size={15}
            />
            Back to password
          </button>

          <div className="mx-auto mt-7 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-[4px_4px_10px_#dedede,-4px_-4px_10px_#ffffff]">
            <ShieldCheck
              size={27}
            />
          </div>

          <div className="mt-6 text-center">

            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700">
              Two-step verification
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-stone-950">
              Security check
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-stone-500">
              Enter the current 6-digit code from your authenticator app.
            </p>

          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3.5">

            <Mail
              size={17}
              className="shrink-0 text-stone-400"
            />

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Signing in as
              </p>

              <p className="mt-0.5 truncate text-xs font-semibold text-stone-800">
                {form.email.trim()}
              </p>
            </div>

          </div>

          {errorMessage && (
            <div
              className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
              role="alert"
            >
              <CircleAlert
                size={17}
                className="mt-0.5 shrink-0"
              />

              <p className="text-xs font-medium leading-5">
                {errorMessage}
              </p>
            </div>
          )}

          <form
            onSubmit={
              handleMfaSubmit
            }
            className="mt-7"
            noValidate
          >

            {factors.length > 1 && (
              <div className="mb-6">

                <label
                  htmlFor="mfa-factor"
                  className="mb-2 block text-xs font-semibold text-stone-700"
                >
                  Authenticator
                </label>

                <InputShell>

                  <Smartphone
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  />

                  <select
                    id="mfa-factor"
                    value={
                      selectedFactorUid
                    }
                    onChange={(
                      event,
                    ) => {
                      setSelectedFactorUid(
                        event.target.value,
                      )

                      setVerificationCode('')
                      setErrorMessage('')
                    }}
                    className="h-12 w-full appearance-none bg-transparent pl-11 pr-4 text-xs font-semibold text-stone-900 outline-none"
                  >
                    {factors.map(
                      (
                        factor,
                        index,
                      ) => (
                        <option
                          key={
                            factor.uid
                          }
                          value={
                            factor.uid
                          }
                        >
                          {getFactorLabel(
                            factor,
                            index,
                          )}
                        </option>
                      ),
                    )}
                  </select>

                </InputShell>

              </div>
            )}

            {factors.length === 1 && (
              <div className="mb-6 flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">

                <Smartphone
                  size={17}
                  className="text-emerald-700"
                />

                <div>
                  <p className="text-xs font-semibold text-stone-900">
                    {getFactorLabel(
                      selectedFactor,
                      0,
                    )}
                  </p>

                  <p className="mt-0.5 text-[10px] text-stone-400">
                    TOTP authenticator
                  </p>
                </div>

              </div>
            )}

            <label
              htmlFor="login-mfa-code"
              className="mb-2 block text-xs font-semibold text-stone-700"
            >
              Authentication code
            </label>

            <InputShell>

              <input
                id="login-mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={
                  MFA_CODE_LENGTH
                }
                value={
                  verificationCode
                }
                onChange={
                  handleVerificationCodeChange
                }
                autoFocus
                className="h-16 w-full bg-transparent px-4 text-center font-mono text-2xl font-bold tracking-[0.42em] text-stone-950 outline-none placeholder:text-stone-300"
                placeholder="000000"
              />

            </InputShell>

            <button
              type="submit"
              disabled={
                isCompletingMfa ||
                verificationCode.length !==
                  MFA_CODE_LENGTH ||
                !selectedFactorUid
              }
              className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 text-xs font-bold text-white transition hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCompletingMfa ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck
                    size={17}
                  />
                  Verify & sign in
                </>
              )}
            </button>

          </form>

        </section>

      </main>
    )
  }

  return (
    <LoginShell>

      <div className="text-center">

        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-lg font-black text-emerald-700 shadow-[4px_4px_9px_#dddddd,-4px_-4px_9px_#ffffff]">
          E
        </div>

        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-700">
          Welcome back
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-950">
          Login
        </h1>

        <p className="mt-2 text-xs leading-5 text-stone-500">
          Sign in to continue to EPANTRY.
        </p>

      </div>

      {sessionNotice && (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800"
          role="status"
        >
          <CircleAlert
            size={17}
            className="mt-0.5 shrink-0"
          />

          <p className="min-w-0 flex-1 text-xs font-medium leading-5">
            {sessionNotice}
          </p>

          <button
            type="button"
            onClick={
              clearSessionNotice
            }
            className="grid size-6 shrink-0 place-items-center rounded-md text-amber-700 transition hover:bg-amber-100"
            aria-label="Dismiss session message"
          >
            <X
              size={14}
            />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"
          role="alert"
        >
          <CircleAlert
            size={17}
            className="mt-0.5 shrink-0"
          />

          <p className="text-xs font-medium leading-5">
            {errorMessage}
          </p>
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-8 space-y-6"
        noValidate
      >

        <div>

          <InputShell>

            <Mail
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            />

            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder=" "
              value={
                form.email
              }
              onChange={(
                event,
              ) =>
                updateField(
                  'email',
                  event.target.value,
                )
              }
              className="peer h-14 w-full bg-transparent pb-2 pl-11 pr-4 pt-5 text-sm font-medium text-stone-950 outline-none placeholder:text-transparent"
              aria-invalid={
                Boolean(
                  fieldErrors.email,
                )
              }
            />

            <label
              htmlFor="login-email"
              className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400 transition-all duration-200 peer-focus:top-3 peer-focus:text-[9px] peer-focus:text-emerald-700 peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:text-[9px]"
            >
              Email address
            </label>

          </InputShell>

          <FieldError
            message={
              fieldErrors.email
            }
          />

        </div>

        <div>

          <InputShell>

            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
            />

            <input
              id="login-password"
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              autoComplete="current-password"
              placeholder=" "
              value={
                form.password
              }
              onChange={(
                event,
              ) =>
                updateField(
                  'password',
                  event.target.value,
                )
              }
              className="peer h-14 w-full bg-transparent pb-2 pl-11 pr-12 pt-5 text-sm font-medium text-stone-950 outline-none placeholder:text-transparent"
              aria-invalid={
                Boolean(
                  fieldErrors.password,
                )
              }
            />

            <label
              htmlFor="login-password"
              className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400 transition-all duration-200 peer-focus:top-3 peer-focus:text-[9px] peer-focus:text-emerald-700 peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:text-[9px]"
            >
              Password
            </label>

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (current) =>
                    !current,
                )
              }
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-800"
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
            >
              {showPassword ? (
                <EyeOff
                  size={16}
                />
              ) : (
                <Eye
                  size={16}
                />
              )}
            </button>

          </InputShell>

          <div className="mt-2 flex items-start justify-between gap-3">

            <FieldError
              message={
                fieldErrors.password
              }
            />

            <Link
              to={
                forgotPasswordPath
              }
              className="ml-auto shrink-0 text-[11px] font-semibold text-stone-500 transition hover:text-emerald-700"
            >
              Forgot password?
            </Link>

          </div>

        </div>

        <button
          type="submit"
          disabled={
            isAuthenticating
          }
          className="
            flex
            h-12
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-stone-950
            text-xs
            font-bold
            tracking-wide
            text-white
            shadow-[0_8px_18px_rgba(41,37,36,0.18)]
            transition
            hover:bg-emerald-800
            active:translate-y-px
            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >
          {isAuthenticating ? (
            <>
              <LoaderCircle
                size={17}
                className="animate-spin"
              />
              Signing in...
            </>
          ) : (
            <>
              Login
              <ArrowRight
                size={16}
              />
            </>
          )}
        </button>

      </form>

      <div className="my-7 flex items-center gap-3">
        <div className="h-px flex-1 bg-stone-200" />

        <ShieldCheck
          size={13}
          className="text-stone-300"
        />

        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <p className="text-center text-[11px] text-stone-500">
        Don&apos;t have an account?{' '}

        <Link
          to={registerHref}
          className="font-bold text-stone-950 transition hover:text-emerald-700"
        >
          Sign Up
        </Link>
      </p>

      <div className="mt-6 flex items-center justify-center gap-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-300">
        <LockKeyhole
          size={11}
        />

        Secure EPANTRY session
      </div>

    </LoginShell>
  )
}