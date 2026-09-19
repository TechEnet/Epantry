import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowLeft,
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

export default function MfaEnrollmentPage() {
  const {
    user,
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

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (
    isLoadingStatus
  ) {
    return (
      <main className="page-shell py-16">

        <div className="mx-auto flex min-h-[360px] max-w-4xl items-center justify-center">

          <div className="text-center">

            <LoaderCircle
              size={28}
              className="mx-auto animate-spin text-emerald-700"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-bold text-stone-600">
              Loading account security...
            </p>

          </div>

        </div>

      </main>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Status Error
  |--------------------------------------------------------------------------
  */

  if (
    statusError
  ) {
    return (
      <main className="page-shell py-12">

        <div className="mx-auto max-w-xl rounded-[2rem] border border-red-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8">

          <CircleAlert
            size={34}
            className="text-red-600"
            aria-hidden="true"
          />

          <h1 className="mt-5 text-2xl font-black text-stone-950">
            Unable to load account security
          </h1>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            {statusError}
          </p>

          <button
            type="button"
            onClick={
              loadStatus
            }
            className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >

            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            Try again

          </button>

        </div>

      </main>
    )
  }

  const policy =
    mfaStatus?.policy

  /*
  |--------------------------------------------------------------------------
  | Already Enrolled
  |--------------------------------------------------------------------------
  */

  if (
    mfaStatus?.enrolled &&
    stage !==
      'success'
  ) {
    return (
      <main className="page-shell py-8 sm:py-12">

        <div className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-10">

          <div className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">

            <ShieldCheck
              size={32}
              aria-hidden="true"
            />

          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Account security
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            Multi-factor authentication is active
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Your Firebase account already has a second authentication factor enrolled.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">

              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                TOTP
              </p>

              <p className="mt-2 font-black text-stone-950">
                {mfaStatus.totpEnrolled
                  ? 'Enabled'
                  : 'Not enrolled'}
              </p>

            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">

              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Factors
              </p>

              <p className="mt-2 font-black text-stone-950">
                {mfaStatus.factorCount}
              </p>

            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">

              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                EPANTRY policy
              </p>

              <p className="mt-2 font-black text-stone-950">
                {getPolicyLabel(
                  policy?.mode,
                )}
              </p>

            </div>

          </div>

          <Link
            to="/"
            className="focus-ring mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >

            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            Back to EPANTRY

          </Link>

        </div>

      </main>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Successful Enrollment
  |--------------------------------------------------------------------------
  */

  if (
    stage ===
    'success'
  ) {
    return (
      <main className="page-shell py-8 sm:py-12">

        <div className="mx-auto max-w-3xl rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-10">

          <div className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">

            <Check
              size={32}
              aria-hidden="true"
            />

          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            MFA enrollment complete
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
            Your authenticator is connected
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600">
            Firebase now requires your authenticator code as a second factor when this account signs in.
          </p>

          {!sessionRefreshed && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
              MFA was enabled successfully, but EPANTRY could not refresh the server session. Your existing session can continue until you sign in again.
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-5">

            <div className="flex items-start gap-3">

              <ShieldCheck
                size={22}
                className="mt-0.5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />

              <div>

                <p className="font-black text-stone-950">
                  Important
                </p>

                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Do not remove the EPANTRY entry from your authenticator app. Future sign-ins will require its rotating code.
                </p>

              </div>

            </div>

          </div>

          <Link
            to="/"
            className="focus-ring mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-950 px-5 text-sm font-black text-white"
          >

            Continue to EPANTRY

          </Link>

        </div>

      </main>
    )
  }

  return (
    <main className="page-shell py-8 sm:py-12 lg:py-16">

      <div className="mx-auto max-w-5xl">


        {/* =========================================================
            HEADER
        ========================================================= */}

        <div className="mb-8">

          <Link
            to="/"
            className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-stone-500 transition hover:text-stone-950"
          >

            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            Back to EPANTRY

          </Link>

          <p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            Account security
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
            Multi-factor authentication
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            Add an authenticator app as a second security factor for your EPANTRY account.
          </p>

        </div>


        {/* =========================================================
            POLICY
        ========================================================= */}

        <div className="mb-6 grid gap-4 sm:grid-cols-3">

          <div className="rounded-2xl border border-stone-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Account
            </p>

            <p className="mt-2 truncate font-black text-stone-950">
              {user?.email}
            </p>

          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
              MFA policy
            </p>

            <p className="mt-2 font-black text-stone-950">
              {getPolicyLabel(
                policy?.mode,
              )}
            </p>

          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4">

            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Status
            </p>

            <p className="mt-2 font-black text-stone-950">
              Not enrolled
            </p>

          </div>

        </div>


        {policy?.reason && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900">
            {policy.reason}
          </div>
        )}


        {!policy?.enrollmentAllowed ? (

          <div className="rounded-[2rem] border border-amber-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-8">

            <CircleAlert
              size={30}
              className="text-amber-600"
              aria-hidden="true"
            />

            <h2 className="mt-5 text-2xl font-black text-stone-950">
              MFA enrollment is not available
            </h2>

            <p className="mt-3 text-sm leading-7 text-stone-600">
              Your current EPANTRY account state does not allow MFA enrollment yet.
            </p>

          </div>

        ) : stage ===
          'reauth' ? (

          /* =======================================================
              RE-AUTHENTICATION
          ======================================================= */

          <div className="grid overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-xl shadow-stone-900/5 lg:grid-cols-[0.9fr_1.1fr]">

            <aside className="hidden bg-stone-950 p-10 text-white lg:block">

              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-600">

                <ShieldCheck
                  size={24}
                  aria-hidden="true"
                />

              </div>

              <h2 className="mt-8 text-2xl font-black">
                Verify it&apos;s really you
              </h2>

              <p className="mt-4 text-sm leading-7 text-stone-300">
                MFA enrollment changes how your account signs in. For security, Firebase requires a recent authentication before creating the authenticator secret.
              </p>

              <div className="mt-8 flex items-start gap-3 text-sm leading-6 text-stone-300">

                <LockKeyhole
                  size={18}
                  className="mt-0.5 shrink-0 text-emerald-300"
                  aria-hidden="true"
                />

                <span>
                  Your password goes directly to Firebase Authentication and is never sent to EPANTRY&apos;s Express API or MongoDB.
                </span>

              </div>

            </aside>


            <section className="p-5 sm:p-8 lg:p-10">

              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Step 1 of 2
              </p>

              <h2 className="mt-3 text-2xl font-black text-stone-950">
                Re-enter your password
              </h2>

              <p className="mt-3 text-sm leading-6 text-stone-500">
                Confirm your current EPANTRY password before generating an authenticator key.
              </p>


              {actionError && (
                <div
                  className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
                  role="alert"
                >
                  {actionError}
                </div>
              )}


              <form
                onSubmit={
                  handleStartEnrollment
                }
                className="mt-7"
              >

                <label
                  htmlFor="mfa-password"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Current password
                </label>

                <div className="relative">

                  <LockKeyhole
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    aria-hidden="true"
                  />

                  <input
                    id="mfa-password"
                    type="password"
                    autoComplete="current-password"
                    value={
                      password
                    }
                    onChange={(
                      event,
                    ) => {
                      setPassword(
                        event.target.value,
                      )

                      setActionError('')
                    }}
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-stone-950"
                    placeholder="Enter your password"
                  />

                </div>


                <button
                  type="submit"
                  disabled={
                    isStarting
                  }
                  className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {isStarting ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                        aria-hidden="true"
                      />

                      Verifying...
                    </>
                  ) : (
                    <>
                      <KeyRound
                        size={18}
                        aria-hidden="true"
                      />

                      Continue to authenticator setup
                    </>
                  )}

                </button>

              </form>

            </section>

          </div>

        ) : (

          /* =======================================================
              AUTHENTICATOR SETUP
          ======================================================= */

          <div className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-xl shadow-stone-900/5 sm:p-8 lg:p-10">

            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Step 2 of 2
            </p>

            <h2 className="mt-3 text-2xl font-black text-stone-950">
              Connect your authenticator
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              Scan the QR code using Google Authenticator, Microsoft Authenticator, 1Password, or another compatible TOTP app.
            </p>


            {actionError && (
              <div
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
                role="alert"
              >
                {actionError}
              </div>
            )}


            <div className="mt-8 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">


              {/* ===================================================
                  QR
              =================================================== */}

              <div>

                <div className="rounded-3xl border border-stone-200 bg-white p-5">

                  {setup?.qrCodeDataUrl && (
                    <img
                      src={
                        setup.qrCodeDataUrl
                      }
                      alt="EPANTRY authenticator setup QR code"
                      className="mx-auto aspect-square w-full max-w-[280px]"
                    />
                  )}

                </div>

                <a
                  href={
                    setup?.qrCodeUri
                  }
                  className="focus-ring mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-black text-stone-700 transition hover:bg-stone-100"
                >

                  <Smartphone
                    size={17}
                    aria-hidden="true"
                  />

                  Open authenticator app

                </a>

              </div>


              {/* ===================================================
                  MANUAL + OTP
              =================================================== */}

              <div>

                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">

                  <p className="text-sm font-black text-stone-950">
                    Can&apos;t scan the QR code?
                  </p>

                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Add the account manually using this setup key:
                  </p>


                  <div className="mt-4 flex items-stretch gap-2">

                    <code className="min-w-0 flex-1 break-all rounded-xl border border-stone-200 bg-white px-3 py-3 font-mono text-sm font-bold tracking-wider text-stone-900">
                      {setup?.secretKey}
                    </code>

                    <button
                      type="button"
                      onClick={
                        handleCopySecret
                      }
                      className="focus-ring grid w-12 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:text-stone-950"
                      aria-label="Copy authenticator setup key"
                    >

                      {copiedSecret ? (
                        <Check
                          size={18}
                          className="text-emerald-700"
                          aria-hidden="true"
                        />
                      ) : (
                        <Clipboard
                          size={18}
                          aria-hidden="true"
                        />
                      )}

                    </button>

                  </div>


                  <div className="mt-4 grid gap-3 text-xs text-stone-500 sm:grid-cols-2">

                    <p>
                      Issuer:{' '}
                      <strong className="text-stone-800">
                        {setup?.issuer}
                      </strong>
                    </p>

                    <p>
                      Code refresh:{' '}
                      <strong className="text-stone-800">
                        {setup?.codeIntervalSeconds || 30}s
                      </strong>
                    </p>

                  </div>

                </div>


                <form
                  onSubmit={
                    handleCompleteEnrollment
                  }
                  className="mt-6"
                >

                  <label
                    htmlFor="mfa-code"
                    className="block text-sm font-black text-stone-900"
                  >
                    Authenticator code
                  </label>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Enter the current rotating code shown in your authenticator app.
                  </p>

                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={
                      setup?.codeLength ||
                      6
                    }
                    value={
                      verificationCode
                    }
                    onChange={(
                      event,
                    ) => {
                      setVerificationCode(
                        event.target.value
                          .replace(
                            /\D/g,
                            '',
                          )
                          .slice(
                            0,
                            setup?.codeLength ||
                              6,
                          ),
                      )

                      setActionError('')
                    }}
                    className="focus-ring mt-3 min-h-14 w-full rounded-2xl border border-stone-200 bg-white px-4 text-center font-mono text-2xl font-black tracking-[0.35em] text-stone-950"
                    placeholder="000000"
                  />


                  <button
                    type="submit"
                    disabled={
                      isCompleting
                    }
                    className="focus-ring mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    {isCompleting ? (
                      <>
                        <LoaderCircle
                          size={18}
                          className="animate-spin"
                          aria-hidden="true"
                        />

                        Enabling MFA...
                      </>
                    ) : (
                      <>
                        <ShieldCheck
                          size={18}
                          aria-hidden="true"
                        />

                        Verify and enable MFA
                      </>
                    )}

                  </button>


                  <button
                    type="button"
                    onClick={
                      handleCancelSetup
                    }
                    disabled={
                      isCompleting
                    }
                    className="focus-ring mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-50"
                  >
                    Cancel setup
                  </button>

                </form>

              </div>

            </div>

          </div>

        )}

      </div>
    </main>
  )
}