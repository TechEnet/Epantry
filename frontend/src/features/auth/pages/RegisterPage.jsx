import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  ChefHat,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Store,
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
    description: 'Cook, shop & save',
    icon: ShoppingBasket,
  },
  {
    value: 'host',
    label: 'Host',
    description: 'Apply to list & sell',
    icon: Building2,
  },
]

const PHONE_COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: '🇦🇫' },
  { code: 'AL', name: 'Albania', dial: '+355', flag: '🇦🇱' },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: '🇩🇿' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'AM', name: 'Armenia', dial: '+374', flag: '🇦🇲' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'AZ', name: 'Azerbaijan', dial: '+994', flag: '🇦🇿' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { code: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'BG', name: 'Bulgaria', dial: '+359', flag: '🇧🇬' },
  { code: 'KH', name: 'Cambodia', dial: '+855', flag: '🇰🇭' },
  { code: 'CM', name: 'Cameroon', dial: '+237', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'HR', name: 'Croatia', dial: '+385', flag: '🇭🇷' },
  { code: 'CY', name: 'Cyprus', dial: '+357', flag: '🇨🇾' },
  { code: 'CZ', name: 'Czechia', dial: '+420', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'GE', name: 'Georgia', dial: '+995', flag: '🇬🇪' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary', dial: '+36', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', dial: '+354', flag: '🇮🇸' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { code: 'IR', name: 'Iran', dial: '+98', flag: '🇮🇷' },
  { code: 'IQ', name: 'Iraq', dial: '+964', flag: '🇮🇶' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', dial: '+1', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: '🇯🇴' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7', flag: '🇰🇿' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '+996', flag: '🇰🇬' },
  { code: 'LA', name: 'Laos', dial: '+856', flag: '🇱🇦' },
  { code: 'LV', name: 'Latvia', dial: '+371', flag: '🇱🇻' },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: '🇱🇧' },
  { code: 'LT', name: 'Lithuania', dial: '+370', flag: '🇱🇹' },
  { code: 'LU', name: 'Luxembourg', dial: '+352', flag: '🇱🇺' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { code: 'MT', name: 'Malta', dial: '+356', flag: '🇲🇹' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'MN', name: 'Mongolia', dial: '+976', flag: '🇲🇳' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦' },
  { code: 'MM', name: 'Myanmar', dial: '+95', flag: '🇲🇲' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'PA', name: 'Panama', dial: '+507', flag: '🇵🇦' },
  { code: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾' },
  { code: 'PE', name: 'Peru', dial: '+51', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { code: 'RO', name: 'Romania', dial: '+40', flag: '🇷🇴' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', dial: '+221', flag: '🇸🇳' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'SK', name: 'Slovakia', dial: '+421', flag: '🇸🇰' },
  { code: 'SI', name: 'Slovenia', dial: '+386', flag: '🇸🇮' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'SY', name: 'Syria', dial: '+963', flag: '🇸🇾' },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: '🇹🇼' },
  { code: 'TZ', name: 'Tanzania', dial: '+255', flag: '🇹🇿' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
  { code: 'TN', name: 'Tunisia', dial: '+216', flag: '🇹🇳' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'UG', name: 'Uganda', dial: '+256', flag: '🇺🇬' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾' },
  { code: 'UZ', name: 'Uzbekistan', dial: '+998', flag: '🇺🇿' },
  { code: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'YE', name: 'Yemen', dial: '+967', flag: '🇾🇪' },
  { code: 'ZM', name: 'Zambia', dial: '+260', flag: '🇿🇲' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263', flag: '🇿🇼' },
]

const HOST_WORKSPACE_TYPES = [
  {
    value: 'b2b',
    label: 'B2B',
    description:
      'Wholesale & business orders',
    icon: Building2,
  },
  {
    value: 'brand_seller',
    label: 'Brand / Seller',
    description:
      'Products, listings & sales',
    icon: Store,
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description:
      'B2B + brand selling',
    icon: BadgeCheck,
  },
  {
    value: 'chef_restaurant',
    label: 'Chef + Restaurant',
    description:
      'Recipes & restaurant operations',
    icon: ChefHat,
  },
]

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PHONE_PATTERN =
  /^\+[1-9]\d{7,14}$/

function getNationalPhone(phone, country) {
  const full = String(phone || '')
  return full.startsWith(country.dial)
    ? full.slice(country.dial.length).replace(/\D/g, '')
    : ''
}

function toInternationalPhone(country, value) {
  const maxDigits = Math.min(12, 15 - country.dial.length + 1)
  const national = String(value || '').replace(/\D/g, '').slice(0, maxDigits)
  return `${country.dial}${national}`
}

function validateRegistrationForm(
  form,
  phoneCountry,
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

  const nationalPhone = getNationalPhone(form.phone, phoneCountry)
  if (
    !PHONE_PATTERN.test(form.phone.trim()) ||
    nationalPhone.length < 7 ||
    nationalPhone.length > 12 ||
    (phoneCountry.code === 'IN' && nationalPhone.length !== 10) ||
    (['US', 'CA'].includes(phoneCountry.code) && nationalPhone.length !== 10)
  ) {
    errors.phone = phoneCountry.code === 'IN'
      ? 'Enter a valid 10-digit mobile number.'
      : 'Check your mobile number for the selected country.'
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

function InputShell({ children, hasError = false }) {
  return (
    <div className={[
      'relative w-full min-w-0 overflow-hidden rounded-[12px] border bg-white transition-all duration-150',
      'focus-within:border-[#BC775B] focus-within:ring-[3px] focus-within:ring-[#BC775B]/10',
      hasError ? 'border-red-400' : 'border-[#DDDCD6] hover:border-[#BCAFA6]',
    ].join(' ')}>
      {children}
    </div>
  )
}

function FieldError({ message, helper }) {
  if (!message && !helper) return null
  return (
    <p className={message ? 'mt-1.5 text-[13px] font-medium text-red-700' : 'mt-1.5 text-[13px] text-[#746F69]'}>
      {message || helper}
    </p>
  )
}

function AccountTypeCard({ item, selected, onSelect }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      aria-pressed={selected}
      aria-label={`${item.label}: ${item.description}`}
      className={[
        'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] border px-3 text-[14px] font-semibold transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B66D52]',
        selected
          ? 'border-[#B56B50] bg-[#F8E8DE] text-[#874B36]'
          : 'border-[#DDDCD6] bg-white text-[#39483F] hover:border-[#C9A696] hover:bg-[#FFFBF8]',
      ].join(' ')}
    >
      <Icon size={17} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
      {selected ? <Check size={15} className="shrink-0" aria-hidden="true" /> : null}
    </button>
  )
}

function AuthNotice({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800" role="alert">
      <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="text-[14px] font-medium leading-5">{message}</p>
    </div>
  )
}

function HostWorkspaceTypeCard({ item, selected, onSelect }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      aria-pressed={selected}
      className={[
        'flex min-h-[76px] items-center gap-3 rounded-[12px] border px-3 py-3 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B7684E]',
        selected ? 'border-[#245642] bg-[#E9F0E9]' : 'border-[#DCDDD7] bg-white hover:border-[#97B4A4]',
      ].join(' ')}>
      <span className={[
        'grid size-9 shrink-0 place-items-center rounded-[10px]',
        selected ? 'bg-[#245642] text-white' : 'bg-[#F3EAE5] text-[#AA654F]',
      ].join(' ')}>
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[15px] font-bold text-[#24352E]">
          {item.label}
          {selected ? <Check size={16} className="text-[#245642]" aria-hidden="true" /> : null}
        </span>
        <span className="mt-0.5 block text-[13px] leading-[1.35] text-[#697269]">{item.description}</span>
      </span>
    </button>
  )
}

function AuthShell({
  eyebrow,
  title,
  description,
  videoSrc,
  videoLabel,
  leftAudience = 'Join us',
  leftHeadline = 'A little more food, a lot more together.',
  leftSubheading = 'Cook, discover and share with EPANTRY.',
  children,
}) {
  return (
    <main
      id="epantry-register"
      className="min-h-[calc(100svh-76px)] w-full bg-[#F6F4F0] lg:h-[calc(100svh-76px)] lg:overflow-y-auto"
    >
      <div className="mx-auto flex min-h-[calc(100svh-76px)] w-full max-w-[1420px] items-center px-3 py-3 sm:px-5 lg:h-full lg:min-h-[620px] lg:px-6 lg:py-5">
        <div className="grid w-full overflow-hidden rounded-[18px] border border-[#E6E0D9] bg-[#FFFDFB] shadow-[0_15px_40px_rgba(43,36,30,0.045)] lg:h-full lg:grid-cols-[34%_66%] lg:rounded-[20px]">
          <aside className="flex min-w-0 flex-col bg-[#EAC9B6] px-5 py-5 sm:px-7 lg:px-8 lg:py-7">
            <div className="flex items-center gap-2 text-[13px] font-bold text-[#6F4C3F]">
              <span>EPANTRY</span>
              <span className="h-1 w-1 rounded-full bg-[#A97059]" aria-hidden="true" />
              <span className="font-medium">{leftAudience}</span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 sm:gap-6 lg:my-auto lg:flex-col lg:justify-center lg:gap-7">
              <div className="min-w-0 lg:text-center">
                <h2 className="max-w-[330px] text-[23px] font-bold leading-[1.19] tracking-[-0.03em] text-[#244539] sm:text-[27px] lg:mx-auto lg:text-[clamp(25px,2.25vw,30px)]">
                  {leftHeadline}
                </h2>
                <p className="mt-2 hidden text-[14px] leading-[1.55] text-[#65574F] sm:block lg:mt-3">
                  {leftSubheading}
                </p>
              </div>
              <div className="w-[108px] shrink-0 overflow-hidden rounded-[15px] border-[5px] border-[#F8EBE3] bg-[#F9F5F0] shadow-[0_12px_25px_rgba(81,48,35,0.09)] sm:w-[150px] lg:aspect-square lg:w-[min(72%,238px)] lg:rounded-[20px] lg:border-[7px]">
                <video
                  key={videoSrc}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={videoLabel || 'EPANTRY registration video'}
                  className="block aspect-square h-full w-full bg-[#F8F4EE] object-contain"
                >
                  <source src={videoSrc || '/video/customer.mp4'} type="video/mp4" />
                  Your browser does not support video playback.
                </video>
              </div>
            </div>

            <div className="mt-5 hidden h-px w-full bg-[#D5AE9B] lg:block" aria-hidden="true" />
          </aside>

          <section className="flex min-w-0 flex-col justify-center bg-[#FFFDFB] px-5 py-6 sm:px-8 lg:overflow-y-auto lg:px-[clamp(26px,3.2vw,52px)] lg:py-6">
            <div className="mx-auto w-full max-w-[840px]">
              <header className="mb-6 flex items-start justify-between gap-4 border-b border-[#EAE6E0] pb-5 lg:mb-6">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#B3644A]">{eyebrow}</p>
                  <h1 className="mt-1.5 text-[clamp(27px,2.45vw,35px)] font-bold leading-[1.14] tracking-[-0.035em] text-[#233B30]">{title}</h1>
                  {description ? <p className="mt-2 max-w-[560px] text-[14px] leading-[1.5] text-[#756E68]">{description}</p> : null}
                </div>
                <Link to="/login" className="shrink-0 pt-1 text-[14px] font-semibold text-[#AC5D43] underline-offset-4 transition hover:underline">
                  Log in
                </Link>
              </header>
              {children}
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

  const [phoneCountryCode, setPhoneCountryCode] = useState('IN')

  const phoneCountry = useMemo(
    () => PHONE_COUNTRIES.find((country) => country.code === phoneCountryCode) || PHONE_COUNTRIES.find((country) => country.code === 'IN'),
    [phoneCountryCode],
  )

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
    selectedHostWorkspaceType,
    setSelectedHostWorkspaceType,
  ] = useState('')

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
          phoneCountry,
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
      hostWorkspaceType = null,
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

            hostWorkspaceType,
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

        if (
          form.accountType ===
          'host'
        ) {
          setIsSubmitting(false)
          setStep('host-intent')
          return
        }

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

  const handleHostIntentSubmit =
    async () => {
      if (
        !verificationProof?.registrationProof
      ) {
        setErrorMessage(
          'Email verification is required before choosing your Host workspace.',
        )
        setStep('otp')
        return
      }

      if (
        !HOST_WORKSPACE_TYPES.some(
          (item) =>
            item.value ===
            selectedHostWorkspaceType,
        )
      ) {
        setErrorMessage(
          'Choose the Host workspace you are applying for.',
        )
        return
      }

      await completeAccount(
        verificationProof,
        selectedHostWorkspaceType,
      )
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
      setSelectedHostWorkspaceType('')
      setResendSeconds(0)
      setExpiresSeconds(0)
      setErrorMessage('')
    }

  if (
    step ===
    'host-intent'
  ) {
    return (
      <AuthShell
        eyebrow="Host application"
        title="Choose your Host type"
        description="Select the workspace that fits your business."
        videoSrc={registrationVideoSrc}
        videoLabel={registrationVideoLabel}
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {HOST_WORKSPACE_TYPES.map(
              (item) => (
                <HostWorkspaceTypeCard
                  key={item.value}
                  item={item}
                  selected={
                    selectedHostWorkspaceType ===
                    item.value
                  }
                  onSelect={(value) => {
                    setSelectedHostWorkspaceType(value)
                    setErrorMessage('')
                  }}
                />
              ),
            )}
          </div>

          <div className="flex items-start gap-2.5 border-l-[3px] border-[#B86C51] bg-[#F9F1EA] px-3 py-2.5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#A95B41]" aria-hidden="true" />
            <p className="text-[13px] leading-[1.5] text-[#634D43]">
              Host access starts after Super Admin approval. Until then, you can continue as a Customer.
            </p>
          </div>

          {errorMessage ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">
              <CircleAlert size={16} className="mt-0.5 shrink-0" />
              <p className="text-[13px] font-semibold leading-4">
                {errorMessage}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleHostIntentSubmit}
            disabled={
              !selectedHostWorkspaceType ||
              isSubmitting
            }
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#20503D] text-[14px] font-black text-white transition hover:bg-[#173F30] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <ArrowRight size={14} />
            )}
            Submit Host application
          </button>
        </div>
      </AuthShell>
    )
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
        <div className="rounded-xl border border-stone-100 bg-[#F7F6F2] p-5">

          <div className="flex flex-col items-center py-5 text-center">

            <div className="grid size-12 place-items-center rounded-xl bg-[#20503D] text-white">
              <LoaderCircle
                size={24}
                className="animate-spin"
              />
            </div>

            <p className="mt-4 text-base font-black text-[#202421]">
              Finalizing secure registration
            </p>

            <p className="mt-1 max-w-md text-[14px] leading-4 text-stone-500">
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

                <p className="mt-1 text-[14px] leading-4 text-emerald-800">
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
              h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-[#20503D]
              text-[14px]
              font-bold
              text-white
              transition
              hover:bg-[#173F30]
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
              h-12
              w-full
              items-center
              justify-center
              rounded-lg
              border
              border-stone-200
              bg-white
              text-[14px]
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

            <p className="mt-1 text-[14px] leading-4 text-emerald-800">
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
              h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-[#20503D]
              text-[14px]
              font-bold
              text-white
              transition
              hover:bg-[#173F30]
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
                <p className="text-[12px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Host status
                </p>

                <p className="mt-1 text-base font-black text-amber-950">
                  Pending review
                </p>

                <p className="mt-1 text-[14px] leading-4 text-amber-800">
                  You can continue using EPANTRY as a Customer while your Host application is reviewed.
                </p>

                <p className="mt-2 text-[13px] font-bold text-amber-900">
                  Requested workspace: {HOST_WORKSPACE_TYPES.find((item) => item.value === (result?.user?.hostWorkspaceType || selectedHostWorkspaceType))?.label || 'Host'}
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
              h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-[#20503D]
              text-[14px]
              font-bold
              text-white
              transition
              hover:bg-[#173F30]
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

          <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-[#F7F6F2] px-3 py-2.5">

            <div className="flex min-w-0 items-center gap-2.5">

              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#A45C42] shadow-sm">
                <Mail
                  size={14}
                />
              </span>

              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-stone-400">
                  Verification email
                </p>

                <p className="truncate text-[14px] font-black text-stone-900">
                  {form.email}
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={
                handleEditDetails
              }
              className="text-[13px] font-black text-[#A45C42]"
            >
              Edit
            </button>

          </div>

          <div>

            <label
              htmlFor="registration-otp"
              className="mb-1.5 block text-[14px] font-bold text-stone-700"
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
                  text-[#202421]
                  outline-none
                  placeholder:text-stone-300
                "
                autoFocus
              />

            </InputShell>

            <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-stone-400">

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
                className="font-black text-[#A45C42] disabled:text-stone-400"
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
              h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              bg-[#20503D]
              text-[14px]
              font-bold
              text-white
              transition
              hover:bg-[#173F30]
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
              text-[13px]
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
      eyebrow="Create an account"
      title="Join EPANTRY"
      videoSrc={registrationVideoSrc}
      videoLabel={registrationVideoLabel}
      leftAudience={form.accountType === 'host' ? 'For hosts' : 'For customers'}
      leftHeadline={form.accountType === 'host' ? 'Bring your food to more tables.' : 'Discover food you love.'}
      leftSubheading={form.accountType === 'host' ? 'Apply to list and sell.' : 'Cook, shop and save.'}
    >
      <form onSubmit={handleRequestOtp} className="space-y-4 lg:space-y-5" noValidate>
        <AuthNotice message={errorMessage} />

        {invitationPreview ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-[14px] font-bold text-violet-900">Household invitation</p>
            <p className="mt-1 text-[13px] leading-5 text-violet-800">
              {invitationPreview?.inviter?.name || 'A household administrator'} invited you to{' '}
              {invitationPreview?.household?.name || 'a household'} as{' '}
              {invitationPreview?.invitation?.role === 'admin'
                ? 'Admin'
                : invitationPreview?.invitation?.roleLabel || 'Member'}.
              Register with {invitationPreview?.invitation?.invitedEmail} to respond.
            </p>
          </div>
        ) : null}

        {invitationPreviewError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-800">
            {invitationPreviewError}
          </div>
        ) : null}

        {/* Row 1: equal-width name and email */}
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-x-5">
          <div className="min-w-0">
            <label htmlFor="registration-name" className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]">Full name</label>
            <InputShell hasError={Boolean(fieldErrors.name)}>
              <UserRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A938B]" aria-hidden="true" />
              <input
                id="registration-name" type="text" autoComplete="name" value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="h-12 w-full min-w-0 bg-transparent pl-11 pr-3 text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96]"
                placeholder="Your full name"
              />
            </InputShell>
            <FieldError message={fieldErrors.name} />
          </div>
          <div className="min-w-0">
            <label htmlFor="registration-email" className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]">Email address</label>
            <InputShell hasError={Boolean(fieldErrors.email)}>
              <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A938B]" aria-hidden="true" />
              <input
                id="registration-email" type="email" autoComplete="email"
                value={form.email} readOnly={Boolean(invitationPreview)}
                onChange={(event) => updateField('email', event.target.value)}
                className="h-12 w-full min-w-0 bg-transparent pl-11 pr-3 text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96] read-only:bg-[#F6F2EE]"
                placeholder="you@example.com"
              />
            </InputShell>
            <FieldError message={fieldErrors.email} />
          </div>
        </div>

        {/* Row 2: mobile number and password */}
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-x-5">
          <div className="min-w-0">
            <label htmlFor="registration-phone" className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]">Mobile number</label>
            <div className={[
              'flex h-12 min-w-0 overflow-hidden rounded-[12px] border bg-white transition-all duration-150',
              'focus-within:border-[#BC775B] focus-within:ring-[3px] focus-within:ring-[#BC775B]/10',
              fieldErrors.phone ? 'border-red-400' : 'border-[#DDDCD6] hover:border-[#BCAFA6]',
            ].join(' ')}>
              <div className="relative flex w-[104px] shrink-0 items-center justify-center gap-1.5 border-r border-[#E9E1DA] bg-[#F9F2EC] px-2 sm:w-[108px]">
                <span className="text-[17px] leading-none" aria-hidden="true">{phoneCountry.flag}</span>
                <span className="text-[14px] font-semibold text-[#664C40]" aria-hidden="true">{phoneCountry.dial}</span>
                <ChevronDown size={13} className="shrink-0 text-[#987A6C]" aria-hidden="true" />
                <select
                  aria-label="Country and dialing code"
                  title={`${phoneCountry.name} (${phoneCountry.dial})`}
                  value={phoneCountryCode}
                  onChange={(event) => {
                    const country = PHONE_COUNTRIES.find((item) => item.code === event.target.value)
                    if (!country) return
                    const previousLocal = getNationalPhone(form.phone, phoneCountry)
                    setPhoneCountryCode(country.code)
                    updateField('phone', toInternationalPhone(country, previousLocal))
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {PHONE_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.name} ({country.dial})
                    </option>
                  ))}
                </select>
              </div>
              <input
                id="registration-phone" type="tel" inputMode="numeric" autoComplete="tel-national"
                value={getNationalPhone(form.phone, phoneCountry)}
                onChange={(event) => updateField('phone', toInternationalPhone(phoneCountry, event.target.value))}
                className="h-full w-full min-w-0 bg-transparent px-3 text-[15px] text-[#26382F] outline-none placeholder:text-[#A39D97]"
                placeholder={phoneCountry.code === 'IN' ? '9876543210' : 'Mobile number'}
                aria-label={`Mobile number without country code (${phoneCountry.dial} selected)`}
              />
            </div>
            <FieldError message={fieldErrors.phone} />
          </div>

          <div className="min-w-0">
            <label htmlFor="registration-password" className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]">Password</label>
            <InputShell hasError={Boolean(fieldErrors.password)}>
              <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A938B]" aria-hidden="true" />
              <input
                id="registration-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                className="h-12 w-full min-w-0 bg-transparent pl-11 pr-11 text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96]"
                placeholder="At least 8 characters"
              />
              <button
                type="button" onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#887E72] transition hover:bg-[#F7EAE3]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </InputShell>
            <FieldError message={fieldErrors.password} />
          </div>
        </div>

        {/* Row 3: confirm password and account type (last) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:gap-x-5">
          <div className="min-w-0">
            <label htmlFor="registration-confirm-password" className="mb-1.5 block text-[14px] font-semibold text-[#2C4035]">Confirm password</label>
            <InputShell hasError={Boolean(fieldErrors.confirmPassword)}>
              <LockKeyhole size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A938B]" aria-hidden="true" />
              <input
                id="registration-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                className="h-12 w-full min-w-0 bg-transparent pl-11 pr-3 text-[15px] text-[#26382F] outline-none placeholder:text-[#9A9D96]"
                placeholder="Repeat password"
              />
            </InputShell>
            <FieldError message={fieldErrors.confirmPassword} />
          </div>

          <fieldset className="min-w-0">
            <legend className="mb-1.5 text-[14px] font-semibold leading-[21px] text-[#2C4035]">Account type</legend>
            <div className="flex min-w-0 gap-2.5">
              {(invitationPreview ? ACCOUNT_TYPES.filter((item) => item.value === 'customer') : ACCOUNT_TYPES).map((item) => (
                <AccountTypeCard
                  key={item.value}
                  item={item}
                  selected={form.accountType === item.value}
                  onSelect={(value) => updateField('accountType', value)}
                />
              ))}
            </div>
            {fieldErrors.accountType ? <FieldError message={fieldErrors.accountType} /> : null}
          </fieldset>
        </div>

        <p className="text-[13px] leading-[1.55] text-[#74716C]">
          By continuing, you agree to our{' '}
          <Link to="/terms" className="font-semibold text-[#AC6147] underline underline-offset-[3px] hover:text-[#88442F]">Terms &amp; Conditions</Link>
          {' '}and{' '}
          <Link to="/privacy-policy" className="font-semibold text-[#AC6147] underline underline-offset-[3px] hover:text-[#88442F]">Privacy Policy</Link>.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || invitationPreviewPending || Boolean(invitationToken && invitationPreviewError)}
          className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-[12px] bg-[#B86C51] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[#9E553D] active:bg-[#88442F] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <><LoaderCircle size={18} className="animate-spin" />Sending code...</>
          ) : (
            <>Send verification code <ArrowRight size={18} aria-hidden="true" /></>
          )}
        </button>
      </form>
    </AuthShell>
  )
}
