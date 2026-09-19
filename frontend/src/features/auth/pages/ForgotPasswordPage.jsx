import {
  useState,
} from 'react'

import {
  ArrowLeft,
  CircleCheckBig,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import {
  getPasswordResetErrorMessage,
  requestPasswordResetEmail,
} from '../services/auth.service'

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const [
    searchParams,
  ] = useSearchParams()

  const initialEmail =
    searchParams.get(
      'email',
    ) || ''

  const [
    email,
    setEmail,
  ] = useState(
    initialEmail,
  )

  const [
    emailError,
    setEmailError,
  ] = useState('')

  const [
    requestError,
    setRequestError,
  ] = useState('')

  const [
    submittedEmail,
    setSubmittedEmail,
  ] = useState('')

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const handleSubmit =
    async (
      event,
    ) => {
      event.preventDefault()

      const normalizedEmail =
        email
          .trim()
          .toLowerCase()

      if (
        !EMAIL_PATTERN.test(
          normalizedEmail,
        )
      ) {
        setEmailError(
          'Enter a valid email address.',
        )

        return
      }

      setEmailError('')
      setRequestError('')
      setIsSubmitting(true)

      try {
        await requestPasswordResetEmail(
          normalizedEmail,
        )

        setSubmittedEmail(
          normalizedEmail,
        )
      } catch (error) {
        setRequestError(
          getPasswordResetErrorMessage(
            error,
          ),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

  const handleEmailChange =
    (event) => {
      setEmail(
        event.target.value,
      )

      if (emailError) {
        setEmailError('')
      }

      if (requestError) {
        setRequestError('')
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Success State
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  |
  | This success message is intentionally generic.
  |
  | It does not confirm whether the email actually exists in Firebase,
  | which helps protect against account enumeration.
  |
  */

  if (submittedEmail) {
    return (
      <main className="page-shell py-8 sm:py-12 lg:py-16">

        <div className="mx-auto max-w-xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-900/5 sm:p-10">

          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">

            <CircleCheckBig
              size={30}
              aria-hidden="true"
            />

          </div>

          <div className="mt-6 text-center">

            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Password recovery
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950">
              Check your email
            </h1>

            <p className="mt-4 text-sm leading-7 text-stone-600">
              If an EPANTRY account is associated with
              {' '}
              <strong className="font-black text-stone-900">
                {submittedEmail}
              </strong>
              , Firebase will send a secure password reset link.
            </p>

            <p className="mt-3 text-sm leading-6 text-stone-500">
              Open the link in the email and follow Firebase&apos;s secure password reset process.
            </p>

          </div>

          <div className="mt-8 space-y-3">

            <Link
              to="/login"
              className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              <ArrowLeft
                size={18}
                aria-hidden="true"
              />

              Back to sign in
            </Link>

            <button
              type="button"
              onClick={() => {
                setSubmittedEmail('')
                setRequestError('')
              }}
              className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
            >
              Try another email
            </button>

          </div>

        </div>

      </main>
    )
  }

  return (
    <main className="page-shell py-8 sm:py-12 lg:py-16">

      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-xl shadow-stone-900/5 lg:grid-cols-[0.85fr_1.15fr]">


        {/* =========================================================
            INFORMATION PANEL
        ========================================================= */}

        <aside className="hidden bg-stone-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">

          <div>

            <div className="grid size-12 place-items-center rounded-2xl bg-emerald-600 text-lg font-black">
              E
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Account recovery
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Reset your password securely.
            </h2>

            <p className="mt-4 text-sm leading-7 text-stone-300">
              Your EPANTRY password is managed by Firebase Authentication. EPANTRY never needs to receive or store your password in MongoDB.
            </p>

          </div>

          <div className="mt-10 flex items-start gap-3 text-sm leading-6 text-stone-300">

            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">

              <ShieldCheck
                size={15}
                aria-hidden="true"
              />

            </span>

            <span>
              Reset links are generated and validated by Firebase Authentication.
            </span>

          </div>

        </aside>


        {/* =========================================================
            RESET FORM
        ========================================================= */}

        <section className="p-5 sm:p-8 lg:p-10">

          <div className="mx-auto max-w-lg">

            <Link
              to="/login"
              className="focus-ring inline-flex items-center gap-2 rounded-lg text-sm font-bold text-stone-500 transition hover:text-stone-950"
            >
              <ArrowLeft
                size={16}
                aria-hidden="true"
              />

              Back to sign in
            </Link>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Forgot password
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              Recover your account
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-500">
              Enter your account email and we&apos;ll request a secure Firebase password reset link.
            </p>


            {requestError && (
              <div
                className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
                role="alert"
              >
                {requestError}
              </div>
            )}


            <form
              onSubmit={
                handleSubmit
              }
              className="mt-8 space-y-5"
              noValidate
            >

              <div>

                <label
                  htmlFor="forgot-password-email"
                  className="mb-2 block text-sm font-bold text-stone-800"
                >
                  Email
                </label>

                <div className="relative">

                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    aria-hidden="true"
                  />

                  <input
                    id="forgot-password-email"
                    type="email"
                    autoComplete="email"
                    value={
                      email
                    }
                    onChange={
                      handleEmailChange
                    }
                    placeholder="you@example.com"
                    className="focus-ring min-h-12 w-full rounded-2xl border border-stone-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-stone-950 placeholder:text-stone-400"
                    aria-invalid={
                      Boolean(
                        emailError,
                      )
                    }
                  />

                </div>

                {emailError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-700">
                    {emailError}
                  </p>
                )}

              </div>


              <button
                type="submit"
                disabled={
                  isSubmitting
                }
                className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {isSubmitting ? (
                  <>
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />

                    Sending reset link...
                  </>
                ) : (
                  <>
                    <Mail
                      size={18}
                      aria-hidden="true"
                    />

                    Send password reset link
                  </>
                )}

              </button>

            </form>


            <div className="mt-8 border-t border-stone-200 pt-6">

              <p className="text-center text-xs leading-6 text-stone-500">
                For privacy, EPANTRY shows the same confirmation whether or not an account exists for the email entered.
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}