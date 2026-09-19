import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  UserRound,
} from 'lucide-react'

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'


import {
  getHouseholdInvitationPreview,
} from '../../households/services/householdInvitation.service'

import {
  useAuth,
} from '../context/AuthContext'

import {
  completeVerifiedRegistration,
  getRegistrationErrorMessage,
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from '../services/registration.service'

const INITIAL_FORM = {
  name: '',
  email: '',
  phone: '+91',
  password: '',
  confirmPassword: '',
  accountType: 'customer',
}

const ACCOUNT_TYPES = [
  {
    value: 'customer',
    label: 'Customer',
    description:
      'Shop, plan meals and build your personal EPANTRY experience.',
    icon: ShoppingBasket,
  },
  {
    value: 'host',
    label: 'Host',
    description:
      'Create a Customer account and submit your Host access for review.',
    icon: Building2,
  },
]

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PHONE_PATTERN =
  /^\+[1-9]\d{7,14}$/

function normalizePhone(
  value,
) {
  const raw =
    String(
      value || '',
    ).trim()

  const hasPlus =
    raw.startsWith('+')

  const digits =
    raw.replace(
      /\D/g,
      '',
    )

  if (!digits) {
    return hasPlus
      ? '+'
      : ''
  }

  return `+${digits.slice(
    0,
    15,
  )}`
}

function validateRegistrationForm(
  form,
) {
  const errors = {}

  if (
    form.name.trim().length <
    2
  ) {
    errors.name =
      'Enter your full name.'
  }

  if (
    !EMAIL_PATTERN.test(
      form.email.trim(),
    )
  ) {
    errors.email =
      'Enter a valid email address.'
  }

  if (
    !PHONE_PATTERN.test(
      form.phone.trim(),
    )
  ) {
    errors.phone =
      'Use international phone format.'
  }

  if (
    form.password.length <
    8
  ) {
    errors.password =
      'Use at least 8 characters.'
  }

  if (
    form.confirmPassword !==
    form.password
  ) {
    errors.confirmPassword =
      'Passwords do not match.'
  }

  if (
    !ACCOUNT_TYPES.some(
      (item) =>
        item.value ===
        form.accountType,
    )
  ) {
    errors.accountType =
      'Choose Customer or Host.'
  }

  return errors
}

function InputShell({
  children,
  hasError = false,
}) {
  return (
    <div
      className={[
        'relative',
        'w-full',
        'rounded-lg',
        'border',
        'bg-[#f8f8f8]',
        'shadow-[inset_2px_2px_5px_#e2e2e2,inset_-2px_-2px_5px_#ffffff]',
        'transition',
        'duration-200',
        'focus-within:bg-white',
        'focus-within:shadow-[inset_2px_2px_4px_#dedede,inset_-2px_-2px_4px_#ffffff,0_0_0_2px_rgba(16,185,129,0.08)]',
        hasError
          ? 'border-red-200'
          : 'border-stone-100 focus-within:border-emerald-200',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function FieldError({
  message,
  helper,
}) {
  if (message) {
    return (
      <p className="mt-1 text-[9px] font-semibold leading-3 text-red-600">
        {message}
      </p>
    )
  }

  if (helper) {
    return (
      <p className="mt-1 text-[8px] leading-3 text-stone-400">
        {helper}
      </p>
    )
  }

  return null
}

function AccountTypeCard({
  item,
  selected,
  onSelect,
}) {
  const Icon =
    item.icon

  return (
    <button
      type="button"
      onClick={() =>
        onSelect(
          item.value,
        )
      }
      className={[
        'relative',
        'min-h-[72px]',
        'rounded-lg',
        'border',
        'p-2.5',
        'text-left',
        'transition',
        'duration-200',
        'focus:outline-none',
        'focus-visible:ring-2',
        'focus-visible:ring-emerald-500',
        selected
          ? 'border-emerald-500 bg-emerald-50'
          : 'border-stone-100 bg-[#fafafa] hover:border-stone-200 hover:bg-white',
      ].join(' ')}
      aria-pressed={
        selected
      }
    >
      <div className="flex items-start gap-2">

        <div
          className={[
            'grid',
            'size-7',
            'shrink-0',
            'place-items-center',
            'rounded-md',
            selected
              ? 'bg-emerald-700 text-white'
              : 'bg-white text-stone-500 shadow-sm',
          ].join(' ')}
        >
          <Icon
            size={13}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 pr-3">
          <p className="text-[10px] font-black text-stone-950">
            {item.label}
          </p>

          <p className="mt-0.5 text-[8px] leading-[1.35] text-stone-500">
            {item.description}
          </p>
        </div>

      </div>

      {selected && (
        <span
          className="
            absolute
            right-2
            top-2
            grid
            size-4
            place-items-center
            rounded-full
            bg-emerald-700
            text-white
          "
        >
          <Check
            size={10}
            strokeWidth={3}
            aria-hidden="true"
          />
        </span>
      )}

    </button>
  )
}

function AuthNotice({
  message,
}) {
  if (!message) {
    return null
  }

  return (
    <div
      className="
        flex
        items-start
        gap-2
        rounded-lg
        border
        border-red-200
        bg-red-50
        px-3
        py-2
        text-red-700
      "
      role="alert"
    >
      <CircleAlert
        size={14}
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      />

      <p className="text-[9px] font-semibold leading-4">
        {message}
      </p>
    </div>
  )
}

function AuthShell({
  eyebrow,
  title,
  description,
  videoSrc,
  videoLabel,
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
              <span
                className="
                  grid
                  size-10
                  place-items-center
                  rounded-xl
                  bg-emerald-600
                  text-sm
                  font-black
                  text-white
                "
              >
                E
              </span>

              <span>
                <span className="block text-lg font-black tracking-tight">
                  EPANTRY
                </span>

                <span
                  className="
                    mt-0.5
                    block
                    text-[7px]
                    font-bold
                    uppercase
                    tracking-[0.22em]
                    text-stone-400
                  "
                >
                  Food Intelligence
                </span>
              </span>
            </Link>

            <div
              className="
                relative
                z-10
                flex
                flex-1
                items-center
                justify-center
                py-5
              "
            >

              <video
                key={
                  videoSrc
                }
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={
                  videoLabel
                }
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
                  src={
                    videoSrc
                  }
                  type="video/mp4"
                />

                Your browser does not support video playback.
              </video>

            </div>

          </aside>

          <section
            className="
              bg-white
              px-5
              py-5
              sm:px-6
              lg:px-7
              lg:py-5
              xl:px-8
            "
          >

            <div className="mx-auto w-full max-w-[620px]">

              <p
                className="
                  text-[8px]
                  font-black
                  uppercase
                  tracking-[0.24em]
                  text-emerald-700
                "
              >
                {eyebrow}
              </p>

              <h1
                className="
                  mt-1
                  text-2xl
                  font-black
                  tracking-tight
                  text-stone-950
                "
              >
                {title}
              </h1>

              {description && (
                <p
                  className="
                    mt-1
                    max-w-xl
                    text-[9px]
                    leading-4
                    text-stone-500
                  "
                >
                  {description}
                </p>
              )}

              <div
                className={
                  description
                    ? 'mt-4'
                    : 'mt-3'
                }
              >
                {children}
              </div>

            </div>

          </section>

        </div>

      </div>

    </main>
  )
}


function getSafeReturnTo(
  search,
) {
  const value =
    new URLSearchParams(
      search,
    ).get(
      'returnTo',
    ) ||
    ''

  return value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : ''
}

function getInvitationTokenFromReturnTo(
  returnTo,
) {
  const match =
    String(
      returnTo ||
      '',
    ).match(
      /^\/household-invitations\/([^/?#]+)/,
    )

  return match?.[1]
    ? decodeURIComponent(
        match[1],
      )
    : ''
}

export default function RegisterPage() {
  const location =
    useLocation()

  const navigate =
    useNavigate()

  const {
    refreshSession,
  } = useAuth()

  const returnTo =
    getSafeReturnTo(
      location.search,
    )

  const invitationToken =
    getInvitationTokenFromReturnTo(
      returnTo,
    )

  const [
    invitationPreview,
    setInvitationPreview,
  ] = useState(null)

  const [
    invitationPreviewError,
    setInvitationPreviewError,
  ] = useState('')

  const invitationPreviewPending =
    Boolean(
      invitationToken &&
      !invitationPreview &&
      !invitationPreviewError,
    )

  const [
    form,
    setForm,
  ] = useState(
    INITIAL_FORM,
  )

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({})

  const [
    step,
    setStep,
  ] = useState(
    'form',
  )

  const [
    otp,
    setOtp,
  ] = useState('')

  const [
    challengeId,
    setChallengeId,
  ] = useState('')

  const [
    verificationProof,
    setVerificationProof,
  ] = useState(null)

  const [
    resendSeconds,
    setResendSeconds,
  ] = useState(0)

  const [
    expiresSeconds,
    setExpiresSeconds,
  ] = useState(0)

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('')

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false)

  const [
    showPassword,
    setShowPassword,
  ] = useState(false)

  const [
    result,
    setResult,
  ] = useState(null)

  const selectedAccount =
    useMemo(
      () =>
        ACCOUNT_TYPES.find(
          (item) =>
            item.value ===
            form.accountType,
        ),
      [
        form.accountType,
      ],
    )

  const registrationVideoSrc =
    form.accountType ===
    'host'
      ? '/video/host.mp4'
      : '/video/customer.mp4'

  const registrationVideoLabel =
    form.accountType ===
    'host'
      ? 'EPANTRY Host registration'
      : 'EPANTRY Customer registration'

  useEffect(() => {
    let isActive =
      true

    if (!invitationToken) {
      setInvitationPreview(
        null,
      )
      setInvitationPreviewError('')
      return () => {
        isActive =
          false
      }
    }

    const loadPreview =
      async () => {
        setInvitationPreviewError('')

        try {
          const data =
            await getHouseholdInvitationPreview(
              invitationToken,
            )

          if (!isActive) {
            return
          }

          setInvitationPreview(
            data,
          )

          const invitedEmail =
            String(
              data?.invitation?.invitedEmail ||
              '',
            )
              .trim()
              .toLowerCase()

          if (invitedEmail) {
            setForm(
              (current) => ({
                ...current,
                email:
                  invitedEmail,
                accountType:
                  'customer',
              }),
            )
          }
        } catch (error) {
          if (!isActive) {
            return
          }

          setInvitationPreviewError(
            error?.response?.data?.message ||
            error?.message ||
            'Unable to load the household invitation.',
          )
        }
      }

    void loadPreview()

    return () => {
      isActive =
        false
    }
  }, [
    invitationToken,
  ])

  useEffect(() => {
    if (
      step !==
      'otp'
    ) {
      return undefined
    }

    const timer =
      window.setInterval(
        () => {
          setResendSeconds(
            (current) =>
              Math.max(
                0,
                current - 1,
              ),
          )

          setExpiresSeconds(
            (current) =>
              Math.max(
                0,
                current - 1,
              ),
          )
        },
        1000,
      )

    return () =>
      window.clearInterval(
        timer,
      )
  }, [
    step,
  ])

  const updateField = (
    key,
    value,
  ) => {
    if (
      invitationPreview &&
      (
        key ===
          'email' ||
        key ===
          'accountType'
      )
    ) {
      return
    }

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

  const handleRequestOtp =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        invitationToken &&
        !invitationPreview
      ) {
        setErrorMessage(
          invitationPreviewError ||
            'Please wait while the household invitation is verified.',
        )
        return
      }

      const nextErrors =
        validateRegistrationForm(
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

      setIsSubmitting(true)
      setErrorMessage('')

      try {
        const response =
          await requestRegistrationOtp({
            name: form.name,
            email: form.email,
            phone: form.phone,
            accountType:
              form.accountType,
          })

        setChallengeId(
          response?.challengeId ||
            '',
        )

        setResendSeconds(
          Number(
            response?.resendAfterSeconds ||
              0,
          ),
        )

        setExpiresSeconds(
          Number(
            response?.expiresInSeconds ||
              0,
          ),
        )

        setOtp('')
        setVerificationProof(null)
        setStep('otp')
      } catch (error) {
        setErrorMessage(
          getRegistrationErrorMessage(
            error,
          ),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

  const completeAccount =
    async (
      proof,
    ) => {
      setStep('creating')
      setIsSubmitting(true)
      setErrorMessage('')

      try {
        const completed =
          await completeVerifiedRegistration({
            email:
              form.email,

            password:
              form.password,

            challengeId,

            registrationProof:
              proof.registrationProof,
          })

        setResult(
          completed,
        )

        if (
          invitationPreview &&
          returnTo
        ) {
          await refreshSession()

          navigate(
            returnTo,
            {
              replace:
                true,
            },
          )
          return
        }

        if (
          completed?.nextStep ===
          'application-status'
        ) {
          setStep(
            'application-status',
          )
        } else {
          setStep(
            'customer-success',
          )
        }
      } catch (error) {
        setErrorMessage(
          getRegistrationErrorMessage(
            error,
          ),
        )

        setStep(
          'completion-error',
        )
      } finally {
        setIsSubmitting(false)
      }
    }

  const handleVerifyOtp =
    async (
      event,
    ) => {
      event.preventDefault()

      if (
        !/^\d{6}$/.test(
          otp,
        )
      ) {
        setErrorMessage(
          'Enter the 6-digit verification code.',
        )

        return
      }

      setIsSubmitting(true)
      setErrorMessage('')

      try {
        const verified =
          await verifyRegistrationOtp({
            challengeId,

            email:
              form.email,

            otp,
          })

        const proof = {
          registrationProof:
            verified?.registrationProof,

          registrationProofExpiresAt:
            verified?.registrationProofExpiresAt,
        }

        if (
          !proof.registrationProof
        ) {
          throw new Error(
            'Email verification did not return a registration proof.',
          )
        }

        setVerificationProof(
          proof,
        )

        await completeAccount(
          proof,
        )
      } catch (error) {
        setErrorMessage(
          getRegistrationErrorMessage(
            error,
          ),
        )

        setIsSubmitting(false)
      }
    }

  const handleResendOtp =
    async () => {
      if (
        isSubmitting ||
        resendSeconds >
          0
      ) {
        return
      }

      setIsSubmitting(true)
      setErrorMessage('')

      try {
        const response =
          await requestRegistrationOtp({
            name: form.name,
            email: form.email,
            phone: form.phone,
            accountType:
              form.accountType,
          })

        setChallengeId(
          response?.challengeId ||
            '',
        )

        setResendSeconds(
          Number(
            response?.resendAfterSeconds ||
              0,
          ),
        )

        setExpiresSeconds(
          Number(
            response?.expiresInSeconds ||
              0,
          ),
        )

        setOtp('')
      } catch (error) {
        setErrorMessage(
          getRegistrationErrorMessage(
            error,
          ),
        )
      } finally {
        setIsSubmitting(false)
      }
    }

  const handleEditDetails =
    () => {
      setStep('form')
      setOtp('')
      setChallengeId('')
      setVerificationProof(null)
      setResendSeconds(0)
      setExpiresSeconds(0)
      setErrorMessage('')
    }

  if (
    step ===
    'creating'
  ) {
    return (
      <AuthShell
        eyebrow="Secure account setup"
        title="Creating your account..."
        description="Your email is verified. EPANTRY is now creating your identity, application profile and secure session."
        videoSrc={
          registrationVideoSrc
        }
        videoLabel={
          registrationVideoLabel
        }
      >
        <div className="rounded-xl border border-stone-100 bg-[#fafafa] p-5">

          <div className="flex flex-col items-center py-5 text-center">

            <div className="grid size-12 place-items-center rounded-xl bg-stone-950 text-white">
              <LoaderCircle
                size={24}
                className="animate-spin"
              />
            </div>

            <p className="mt-4 text-base font-black text-stone-950">
              Finalizing secure registration
            </p>

            <p className="mt-1 max-w-md text-[10px] leading-4 text-stone-500">
              Please keep this page open while your verified account is completed.
            </p>

          </div>

        </div>
      </AuthShell>
    )
  }

  if (
    step ===
    'completion-error'
  ) {
    return (
      <AuthShell
        eyebrow="Email verified"
        title="Account setup needs one more try"
        description="Your email was verified successfully, but final account setup did not finish."
        videoSrc={
          registrationVideoSrc
        }
        videoLabel={
          registrationVideoLabel
        }
      >
        <div className="space-y-4">

          <AuthNotice
            message={
              errorMessage
            }
          />

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">

            <div className="flex gap-3">

              <CheckCircle2
                size={18}
                className="shrink-0 text-emerald-700"
              />

              <div>
                <p className="text-xs font-black text-emerald-950">
                  {form.email}
                </p>

                <p className="mt-1 text-[10px] leading-4 text-emerald-800">
                  Email ownership is already verified for this registration attempt.
                </p>
              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              completeAccount(
                verificationProof,
              )
            }
            disabled={
              !verificationProof ||
              isSubmitting
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-stone-950
              text-[10px]
              font-black
              text-white
              transition
              hover:bg-emerald-800
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={14}
            />

            Retry account setup
          </button>

          <button
            type="button"
            onClick={
              handleEditDetails
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              rounded-lg
              border
              border-stone-200
              bg-white
              text-[10px]
              font-bold
              text-stone-600
            "
          >
            Start registration again
          </button>

        </div>
      </AuthShell>
    )
  }

  if (
    step ===
    'customer-success'
  ) {
    return (
      <AuthShell
        eyebrow="Registration complete"
        title={`Welcome to EPANTRY${
          result?.user?.name
            ? `, ${result.user.name}`
            : ''
        }`}
        description="Your Customer access is active and your secure EPANTRY session has been created."
        videoSrc={
          registrationVideoSrc
        }
        videoLabel={
          registrationVideoLabel
        }
      >
        <div className="space-y-4">

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">

            <CheckCircle2
              size={30}
              className="text-emerald-700"
            />

            <p className="mt-3 text-base font-black text-emerald-950">
              You are registered and signed in.
            </p>

            <p className="mt-1 text-[10px] leading-4 text-emerald-800">
              Your Customer experience is ready.
            </p>

          </div>

          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-stone-950
              text-[10px]
              font-black
              text-white
              transition
              hover:bg-emerald-800
            "
          >
            Continue to EPANTRY

            <ArrowRight
              size={14}
            />
          </button>

        </div>
      </AuthShell>
    )
  }

  if (
    step ===
    'application-status'
  ) {
    return (
      <AuthShell
        eyebrow="Host application received"
        title={`${selectedAccount?.label || 'Host'} access submitted`}
        description="Your Customer access is active. Host access remains disabled until your application is approved."
        videoSrc={
          registrationVideoSrc
        }
        videoLabel={
          registrationVideoLabel
        }
      >
        <div className="space-y-4">

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

            <div className="flex items-start gap-3">

              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <Building2
                  size={18}
                />
              </div>

              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Host status
                </p>

                <p className="mt-1 text-base font-black text-amber-950">
                  Pending review
                </p>

                <p className="mt-1 text-[10px] leading-4 text-amber-800">
                  You can continue using EPANTRY as a Customer while your Host application is reviewed.
                </p>
              </div>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              navigate('/')
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-stone-950
              text-[10px]
              font-black
              text-white
              transition
              hover:bg-emerald-800
            "
          >
            Continue as Customer

            <ArrowRight
              size={14}
            />
          </button>

        </div>
      </AuthShell>
    )
  }

  if (
    step ===
    'otp'
  ) {
    return (
      <AuthShell
        eyebrow="Verify your email"
        title="Enter verification code"
        description={`We sent a 6-digit verification code to ${form.email}.`}
        videoSrc={
          registrationVideoSrc
        }
        videoLabel={
          registrationVideoLabel
        }
      >

        <form
          onSubmit={
            handleVerifyOtp
          }
          className="space-y-4"
          noValidate
        >

          <AuthNotice
            message={
              errorMessage
            }
          />

          <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-[#fafafa] px-3 py-2.5">

            <div className="flex min-w-0 items-center gap-2.5">

              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm">
                <Mail
                  size={14}
                />
              </span>

              <div className="min-w-0">
                <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-stone-400">
                  Verification email
                </p>

                <p className="truncate text-[10px] font-black text-stone-900">
                  {form.email}
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={
                handleEditDetails
              }
              className="text-[9px] font-black text-emerald-700"
            >
              Edit
            </button>

          </div>

          <div>

            <label
              htmlFor="registration-otp"
              className="mb-1.5 block text-[10px] font-bold text-stone-700"
            >
              Verification code
            </label>

            <InputShell>

              <input
                id="registration-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={
                  otp
                }
                onChange={(
                  event,
                ) => {
                  setOtp(
                    event.target.value
                      .replace(
                        /\D/g,
                        '',
                      )
                      .slice(
                        0,
                        6,
                      ),
                  )

                  setErrorMessage('')
                }}
                maxLength={6}
                placeholder="000000"
                className="
                  h-14
                  w-full
                  bg-transparent
                  px-4
                  text-center
                  font-mono
                  text-xl
                  font-black
                  tracking-[0.4em]
                  text-stone-950
                  outline-none
                  placeholder:text-stone-300
                "
                autoFocus
              />

            </InputShell>

            <div className="mt-1.5 flex items-center justify-between gap-2 text-[8px] text-stone-400">

              <span>
                {expiresSeconds >
                0
                  ? `Expires ${Math.floor(
                      expiresSeconds /
                        60,
                    )}:${String(
                      expiresSeconds %
                        60,
                    ).padStart(
                      2,
                      '0',
                    )}`
                  : 'Code may have expired.'}
              </span>

              <button
                type="button"
                onClick={
                  handleResendOtp
                }
                disabled={
                  isSubmitting ||
                  resendSeconds >
                    0
                }
                className="font-black text-emerald-700 disabled:text-stone-400"
              >
                {resendSeconds >
                0
                  ? `Resend in ${resendSeconds}s`
                  : 'Resend code'}
              </button>

            </div>

          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              otp.length !==
                6
            }
            className="
              flex
              h-10
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-stone-950
              text-[10px]
              font-black
              text-white
              transition
              hover:bg-emerald-800
              disabled:opacity-50
            "
          >
            {isSubmitting ? (
              <>
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck
                  size={14}
                />
                Verify & create account
              </>
            )}
          </button>

          <button
            type="button"
            onClick={
              handleEditDetails
            }
            className="
              flex
              h-9
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              text-[9px]
              font-bold
              text-stone-500
              hover:bg-stone-50
            "
          >
            <ArrowLeft
              size={13}
            />

            Back to registration details
          </button>

        </form>

      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Join EPANTRY"
      videoSrc={
        registrationVideoSrc
      }
      videoLabel={
        registrationVideoLabel
      }
    >

      <form
        onSubmit={
          handleRequestOtp
        }
        className="space-y-3"
        noValidate
      >

        <AuthNotice
          message={
            errorMessage
          }
        />

        {invitationPreview ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-700">
              Household invitation
            </p>
            <p className="mt-1 text-sm font-black text-violet-950">
              Invited by {invitationPreview?.inviter?.name || 'a household administrator'}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-violet-800">
              Join {invitationPreview?.household?.name || 'this household'} as {invitationPreview?.invitation?.role === 'admin' ? 'Admin' : invitationPreview?.invitation?.roleLabel || 'Member'}. Register as a Customer with {invitationPreview?.invitation?.invitedEmail} to review and accept or reject this invitation.
            </p>
          </div>
        ) : null}

        {invitationPreviewError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] font-semibold leading-4 text-red-700">
            {invitationPreviewError}
          </div>
        ) : null}

        <div>

          <label
            htmlFor="registration-name"
            className="mb-1 block text-[9px] font-bold text-stone-700"
          >
            Full Name
          </label>

          <InputShell
            hasError={
              Boolean(
                fieldErrors.name,
              )
            }
          >
            <UserRound
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />

            <input
              id="registration-name"
              type="text"
              autoComplete="name"
              value={
                form.name
              }
              onChange={(
                event,
              ) =>
                updateField(
                  'name',
                  event.target.value,
                )
              }
              className="h-10 w-full bg-transparent pl-9 pr-3 text-[10px] font-semibold text-stone-950 outline-none placeholder:text-stone-400"
              placeholder="Your full name"
            />
          </InputShell>

          <FieldError
            message={
              fieldErrors.name
            }
          />

        </div>

        <div className="grid gap-3 sm:grid-cols-2">

          <div>

            <label
              htmlFor="registration-email"
              className="mb-1 block text-[9px] font-bold text-stone-700"
            >
              Email
            </label>

            <InputShell
              hasError={
                Boolean(
                  fieldErrors.email,
                )
              }
            >
              <Mail
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />

              <input
                id="registration-email"
                type="email"
                autoComplete="email"
                value={
                  form.email
                }
                readOnly={
                  Boolean(
                    invitationPreview,
                  )
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    'email',
                    event.target.value,
                  )
                }
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[10px] font-semibold text-stone-950 outline-none placeholder:text-stone-400"
                placeholder="you@example.com"
              />
            </InputShell>

            <FieldError
              message={
                fieldErrors.email
              }
            />

          </div>

          <div>

            <label
              htmlFor="registration-phone"
              className="mb-1 block text-[9px] font-bold text-stone-700"
            >
              Mobile
            </label>

            <InputShell
              hasError={
                Boolean(
                  fieldErrors.phone,
                )
              }
            >
              <Smartphone
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />

              <input
                id="registration-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={
                  form.phone
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    'phone',
                    normalizePhone(
                      event.target.value,
                    ),
                  )
                }
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[10px] font-semibold text-stone-950 outline-none"
                placeholder="+919876543210"
              />
            </InputShell>

            <FieldError
              message={
                fieldErrors.phone
              }
            />

          </div>

        </div>

        <div className="grid gap-3 sm:grid-cols-2">

          <div>

            <label
              htmlFor="registration-password"
              className="mb-1 block text-[9px] font-bold text-stone-700"
            >
              Password
            </label>

            <InputShell
              hasError={
                Boolean(
                  fieldErrors.password,
                )
              }
            >
              <LockKeyhole
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />

              <input
                id="registration-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                autoComplete="new-password"
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
                className="h-10 w-full bg-transparent pl-9 pr-9 text-[10px] font-semibold text-stone-950 outline-none"
                placeholder="Create a password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
                  )
                }
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-stone-400 hover:bg-white hover:text-stone-800"
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
              >
                {showPassword ? (
                  <EyeOff
                    size={13}
                  />
                ) : (
                  <Eye
                    size={13}
                  />
                )}
              </button>
            </InputShell>

            <FieldError
              message={
                fieldErrors.password
              }
              helper="Use at least 8 characters."
            />

          </div>

          <div>

            <label
              htmlFor="registration-confirm-password"
              className="mb-1 block text-[9px] font-bold text-stone-700"
            >
              Confirm Password
            </label>

            <InputShell
              hasError={
                Boolean(
                  fieldErrors.confirmPassword,
                )
              }
            >
              <LockKeyhole
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
              />

              <input
                id="registration-confirm-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                autoComplete="new-password"
                value={
                  form.confirmPassword
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    'confirmPassword',
                    event.target.value,
                  )
                }
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[10px] font-semibold text-stone-950 outline-none"
                placeholder="Repeat your password"
              />
            </InputShell>

            <FieldError
              message={
                fieldErrors.confirmPassword
              }
            />

          </div>

        </div>

        <fieldset>

          <legend className="text-[9px] font-bold text-stone-700">
            Account Type
          </legend>

          <div className={invitationPreview ? 'mt-2 grid gap-2' : 'mt-2 grid gap-2 sm:grid-cols-2'}>

            {(invitationPreview
              ? ACCOUNT_TYPES.filter(
                  (item) =>
                    item.value ===
                    'customer',
                )
              : ACCOUNT_TYPES
            ).map(
              (
                item,
              ) => (
                <AccountTypeCard
                  key={
                    item.value
                  }
                  item={
                    item
                  }
                  selected={
                    form.accountType ===
                    item.value
                  }
                  onSelect={(
                    value,
                  ) =>
                    updateField(
                      'accountType',
                      value,
                    )
                  }
                />
              ),
            )}

          </div>

          {fieldErrors.accountType && (
            <p className="mt-1 text-[9px] font-semibold text-red-600">
              {fieldErrors.accountType}
            </p>
          )}

        </fieldset>

        <div className="rounded-lg border border-stone-100 bg-[#fafafa] px-3 py-2">

          <div className="flex items-start gap-2">

            <ShieldCheck
              size={13}
              className="mt-0.5 shrink-0 text-emerald-700"
            />

            <p className="text-[8px] leading-3 text-stone-500">
              Clicking{' '}
              <strong className="font-black text-stone-700">
                Send verification code
              </strong>
              {' '}sends your profile for the OTP challenge. Your password is not sent to the OTP endpoint.
            </p>

          </div>

        </div>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            invitationPreviewPending ||
            Boolean(
              invitationToken &&
              invitationPreviewError,
            )
          }
          className="
            flex
            h-10
            w-full
            items-center
            justify-center
            gap-2
            rounded-lg
            bg-stone-950
            text-[10px]
            font-black
            text-white
            shadow-[0_6px_14px_rgba(41,37,36,0.14)]
            transition
            hover:bg-emerald-800
            active:translate-y-px
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {isSubmitting ? (
            <>
              <LoaderCircle
                size={14}
                className="animate-spin"
              />
              Sending code...
            </>
          ) : (
            <>
              <Mail
                size={14}
              />
              Send verification code
              <ArrowRight
                size={13}
              />
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200" />

          <ShieldCheck
            size={10}
            className="text-stone-300"
          />

          <div className="h-px flex-1 bg-stone-200" />
        </div>

        <p className="text-center text-[9px] text-stone-500">
          Already have an account?{' '}

          <Link
            to="/login"
            className="font-black text-stone-950 transition hover:text-emerald-700"
          >
            Login
          </Link>
        </p>

        <div className="flex items-center justify-center gap-1.5 text-[6px] font-semibold uppercase tracking-[0.14em] text-stone-300">
          <LockKeyhole
            size={8}
          />
          Secure EPANTRY registration
        </div>

      </form>

    </AuthShell>
  )
}