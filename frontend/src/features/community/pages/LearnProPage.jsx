import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChefHat,
  CircleAlert,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  CalendarDays,
  CreditCard,
  Crown,
  Sparkles,
} from 'lucide-react'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import CreatorProTransactionsPanel from '../../expansionExecution/components/CreatorProTransactionsPanel'

import {
  createProMembershipCheckout,
  getProMembershipOverview,
  getPublicProCatalog,
  verifyProMembershipPayment,
} from '../../learning/services/learning.service'

import {
  getCommunityErrorMessage,
  getLearningPro,
  listCreatorCourses,
  prepareCreatorCourse,
} from '../services/community.service'

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
let razorpayScriptPromise = null

function getPlanQualities(plan) {
  const months = Number(plan?.validityMonths || 0)
  const durationLabel = months === 1 ? '1 month' : `${months} months`

  return [
    `${durationLabel} of EPANTRY Pro access`,
    'Premium courses, recipe libraries & chef-led learning',
    'Progress, bookmarks and personal notes stay saved',
    'Captions, transcripts and eligible premium classes',
  ]
}

function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.resolve(false)
  }

  if (window.Razorpay) {
    return Promise.resolve(true)
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise
  }

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_URL}"]`)

    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_URL
    script.async = true
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  return razorpayScriptPromise
}

export default function LearnProPage() {
  const {
    isAuthenticated,
    customerEnabled,
  } = useAuth()

  const [courses, setCourses] = useState([])
  const [learning, setLearning] = useState(null)
  const [proCatalog, setProCatalog] = useState(null)
  const [proOverview, setProOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyCourseId, setBusyCourseId] = useState('')
  const [busyPlanCode, setBusyPlanCode] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [prepared, setPrepared] = useState({})

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const [courseResult, catalogResult] = await Promise.all([
          listCreatorCourses({
            page: 1,
            limit: 50,
          }),
          getPublicProCatalog(),
        ])

        if (!active) {
          return
        }

        setCourses(courseResult?.courses || [])
        setProCatalog(catalogResult)

        if (isAuthenticated && customerEnabled) {
          const [proResult, membershipResult] = await Promise.all([
            getLearningPro(),
            getProMembershipOverview(),
          ])

          if (active) {
            setLearning(proResult)
            setProOverview(membershipResult)
          }
        } else {
          setLearning(null)
          setProOverview(null)
        }
      } catch (requestError) {
        if (active) {
          setError(
            getCommunityErrorMessage(
              requestError,
              'Unable to load EPANTRY Learn & Pro.',
            ),
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [isAuthenticated, customerEnabled])

  const entitledCourseIds = useMemo(
    () =>
      new Set(
        (learning?.entitlements || [])
          .map((item) => item.course?.id)
          .filter(Boolean),
      ),
    [learning],
  )

  const planLocksByCode = useMemo(
    () =>
      new Map(
        (proOverview?.purchaseLocks || []).map((item) => [
          item.planCode,
          item,
        ]),
      ),
    [proOverview],
  )

  async function refreshProState() {
    const [membershipResult, learningResult] = await Promise.all([
      getProMembershipOverview(),
      getLearningPro(),
    ])

    setProOverview(membershipResult)
    setLearning(learningResult)
  }

  async function purchaseProPlan(plan) {
    if (!isAuthenticated || !customerEnabled || busyPlanCode) {
      return
    }

    setBusyPlanCode(plan.code)
    setError('')
    setPaymentMessage('')

    try {
      const result = await createProMembershipCheckout(plan.code)
      const checkout = result?.checkout
      const paymentId = result?.payment?.id

      if (
        !checkout?.configured ||
        checkout?.mode !== 'test' ||
        !checkout?.keyId ||
        !checkout?.providerOrderId ||
        !paymentId
      ) {
        throw new Error('Razorpay test checkout is not available for this Pro plan.')
      }

      const loaded = await loadRazorpayCheckout()

      if (!loaded || !window.Razorpay) {
        throw new Error('Unable to load Razorpay test checkout.')
      }

      const razorpay = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amountMinor,
        currency: checkout.currency,
        name: 'EPANTRY Pro',
        description: `${plan.name} membership`,
        order_id: checkout.providerOrderId,
        handler: async (response) => {
          try {
            await verifyProMembershipPayment({
              paymentId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            })

            await refreshProState()
            setPaymentMessage(
              `${plan.name} payment verified. Your EPANTRY Pro validity is updated.`,
            )
          } catch (requestError) {
            setError(
              getCommunityErrorMessage(
                requestError,
                'Payment completed, but EPANTRY could not verify the Pro membership yet.',
              ),
            )
          } finally {
            setBusyPlanCode('')
          }
        },
        modal: {
          ondismiss: () => {
            setBusyPlanCode('')
          },
        },
      })

      razorpay.on('payment.failed', (failure) => {
        setBusyPlanCode('')
        setError(
          failure?.error?.description ||
            'Razorpay could not complete this test payment.',
        )
      })

      razorpay.open()
    } catch (requestError) {
      setBusyPlanCode('')
      setError(
        getCommunityErrorMessage(
          requestError,
          'Unable to start EPANTRY Pro checkout.',
        ),
      )
    }
  }

  async function prepare(courseItem) {
    if (!isAuthenticated || !customerEnabled) {
      return
    }

    const courseId = courseItem.course.id

    setBusyCourseId(courseId)
    setError('')

    try {
      const result = await prepareCreatorCourse({
        courseId,
        targetServings: 2,
      })

      setPrepared((current) => ({
        ...current,
        [courseId]: result,
      }))
    } catch (requestError) {
      setError(
        getCommunityErrorMessage(
          requestError,
          'Unable to prepare this class.',
        ),
      )
    } finally {
      setBusyCourseId('')
    }
  }

  return (
    <main className="page-shell overflow-x-hidden pb-4 pt-1 sm:pb-8 sm:pt-3">
      <section className="w-full max-w-full overflow-hidden rounded-[20px] border border-emerald-100 bg-[linear-gradient(120deg,#ecfdf5_0%,#f8fafc_48%,#eef2ff_100%)] shadow-sm sm:rounded-[22px]">
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 p-3 sm:p-5 lg:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white sm:h-10 sm:w-10">
                <BookOpen size={19} aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 sm:text-[10px]">
                  EPANTRY Learn
                </p>
                <h1 className="mt-0.5 line-clamp-2 max-w-full text-[18px] font-black leading-[1.12] tracking-tight text-stone-950 sm:text-[28px] sm:leading-tight">
                  Learn recipes. Build skills. Keep your progress.
                </h1>
                <p className="mt-1.5 block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-medium leading-4 text-stone-600 sm:mt-2 sm:max-w-3xl sm:whitespace-normal sm:text-[13px] sm:leading-5">
                  Browse practical food courses, open free lessons, or use Pro for protected classes. Your saved progress stays with your Customer account.
                </p>
              </div>
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 lg:mt-4 lg:grid-cols-4">
              {[
                {
                  icon: BookOpen,
                  step: '01',
                  title: 'Browse courses',
                  copy: 'Find a topic you want to learn.',
                  tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
                },
                {
                  icon: ShieldCheck,
                  step: '02',
                  title: 'Choose access',
                  copy: 'Start free or unlock Pro lessons.',
                  tone: 'border-blue-200 bg-blue-50 text-blue-900',
                },
                {
                  icon: GraduationCap,
                  step: '03',
                  title: 'Learn & track',
                  copy: 'Continue lessons without losing progress.',
                  tone: 'border-violet-200 bg-violet-50 text-violet-900',
                },
                {
                  icon: PackageCheck,
                  step: '04',
                  title: 'Prepare to cook',
                  copy: 'Use recipe and pantry help when available.',
                  tone: 'border-amber-200 bg-amber-50 text-amber-900',
                },
              ].map((item) => {
                const Icon = item.icon

                return (
                  <article
                    key={item.step}
                    className={`min-w-0 overflow-hidden rounded-xl border p-2.5 sm:min-h-[104px] sm:rounded-2xl sm:p-3.5 ${item.tone}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-lg bg-white/80 sm:h-7 sm:w-7">
                        <Icon size={14} aria-hidden="true" />
                      </div>
                      <span className="text-[9px] font-black tracking-[0.14em] opacity-55">
                        {item.step}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[10px] font-black leading-4 sm:mt-2 sm:text-xs">
                      {item.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[8px] font-semibold leading-[13px] opacity-70 sm:text-[10px] sm:leading-4">
                      {item.copy}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>

          <aside className="min-w-0 border-t border-emerald-100 bg-white/70 p-3 sm:p-5 lg:border-l lg:border-t-0">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-[13px] font-black text-stone-900">
                  Your learning access
                </h2>
                <p className="mt-1 block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] leading-4 text-stone-600 sm:whitespace-normal sm:text-[11px] sm:leading-[18px]">
                  Pro unlocks protected lessons. It does not change your Customer or Host account.
                </p>
              </div>
            </div>

            {isAuthenticated && customerEnabled ? (
              <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-emerald-100 bg-white p-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                    Available courses
                  </p>
                  <p className="mt-0.5 text-lg font-black text-stone-950">
                    {learning?.entitlements?.length || 0}
                  </p>
                </div>

                <Link
                  to="/account/learning"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-stone-950 px-3 py-2 text-[10px] font-black text-white"
                >
                  <GraduationCap size={13} aria-hidden="true" />
                  My Learning
                </Link>
              </div>
            ) : (
              <Link
                to="/login?returnTo=%2Flearn"
                className="focus-ring mt-2.5 inline-flex w-full items-center justify-center rounded-xl bg-stone-950 px-3 py-2 text-[10px] font-black text-white sm:mt-3 sm:py-2.5 sm:text-xs"
              >
                Sign in to start learning
              </Link>
            )}
          </aside>
        </div>
      </section>

      <section className="mt-2 w-full max-w-full overflow-hidden rounded-[20px] border border-violet-100 bg-[#fffaf3] shadow-sm sm:mt-4 sm:rounded-[22px]">
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_290px]">
          <div className="min-w-0 p-3 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
                <Crown size={18} aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-violet-700 sm:text-[10px]">
                  EPANTRY Pro
                </p>
                <h2 className="mt-0.5 line-clamp-2 max-w-full text-[16px] font-black leading-[1.15] text-stone-950 sm:text-[22px] sm:leading-tight">
                  Unlock more learning when you need it
                </h2>
                <p className="mt-1 block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-medium leading-4 text-stone-600 sm:mt-1.5 sm:max-w-3xl sm:whitespace-normal sm:text-xs sm:leading-5">
                  Choose a plan for protected courses, saved learning progress and eligible premium classes. Your account type stays the same.
                </p>
              </div>
            </div>

            {(proCatalog?.benefits || []).length ? (
              <div className="mt-2.5 grid min-w-0 grid-cols-2 gap-1.5 sm:mt-3 sm:gap-2">
                {(proCatalog?.benefits || []).map((benefit, index) => (
                  <div
                    key={`${benefit}-${index}`}
                    className="flex min-w-0 items-start gap-1.5 overflow-hidden rounded-xl bg-white/85 px-2 py-1.5 text-[8px] font-bold leading-[13px] text-stone-700 sm:min-h-[46px] sm:gap-2 sm:px-2.5 sm:py-2 sm:text-[10px] sm:leading-4"
                  >
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 border-t border-amber-200 bg-amber-100/70 p-3 sm:p-4 lg:border-l lg:border-t-0">
            <div className="flex items-start gap-2.5">
              <CalendarDays size={17} className="mt-0.5 shrink-0 text-amber-800" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-900">
                  Membership
                </p>
                {isAuthenticated && customerEnabled ? (
                  proOverview?.membership?.active ? (
                    <>
                      <p className="mt-1.5 text-base font-black text-stone-950">Pro is active</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-700">
                        {proOverview.membership.remainingDays} day{proOverview.membership.remainingDays === 1 ? '' : 's'} remaining
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-stone-600">
                        Until {new Date(proOverview.membership.validUntil).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1.5 text-base font-black text-stone-950">Choose a Pro plan</p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-700">
                        Pick the duration that fits your learning time.
                      </p>
                    </>
                  )
                ) : (
                  <>
                    <p className="mt-1.5 text-base font-black text-stone-950">Sign in to activate Pro</p>
                    <p className="mt-0.5 text-[11px] font-semibold leading-4 text-stone-700">
                      You can compare prices before signing in.
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="border-t border-stone-200 bg-white/75 p-2.5 sm:p-4">
          <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
            {(proCatalog?.plans || []).map((plan) => (
              <article
                key={plan.code}
                className={[
                  'flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border p-2.5 sm:p-3.5',
                  plan.code === 'annual'
                    ? 'border-violet-200 bg-violet-50'
                    : plan.code === 'half_year'
                      ? 'border-blue-200 bg-blue-50'
                      : plan.code === 'quarterly'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50',
                ].join(' ')}
              >
                <p className="text-[11px] font-black text-stone-950 sm:text-xs">{plan.name}</p>
                <p className="mt-0.5 text-xl font-black leading-none text-stone-950 sm:text-2xl">
                  ₹{Math.round((plan.priceMinor || 0) / 100).toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-[9px] font-bold text-stone-600 sm:text-[10px]">
                  {plan.validityMonths} month{plan.validityMonths === 1 ? '' : 's'} access
                </p>
                <p className="mt-1.5 text-[8px] font-semibold leading-[13px] text-stone-500 sm:text-[9px] sm:leading-4">
                  {plan.shortDescription}
                </p>

                <ul className="mt-2 space-y-1.5">
                  {getPlanQualities(plan).map((quality, index) => (
                    <li
                      key={`${plan.code}-quality-${index}`}
                      className="flex min-w-0 items-start gap-1.5 text-[8px] font-bold leading-[12px] text-stone-700 sm:text-[9px] sm:leading-[14px]"
                    >
                      <CheckCircle2
                        size={11}
                        className="mt-px shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>{quality}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2.5">
                  {(() => {
                    const lock = planLocksByCode.get(plan.code)
                    const lockedUntil = lock?.lockedUntil ? new Date(lock.lockedUntil) : null
                    const paymentAvailable = proCatalog?.policy?.checkoutAvailable === true

                    if (!isAuthenticated || !customerEnabled) {
                      return (
                        <Link
                          to="/login?returnTo=%2Flearn"
                          className="focus-ring inline-flex w-full items-center justify-center rounded-xl bg-stone-950 px-2.5 py-2 text-[10px] font-black text-white"
                        >
                          Sign in to buy
                        </Link>
                      )
                    }

                    return (
                      <>
                        <button
                          type="button"
                          disabled={Boolean(lock) || busyPlanCode === plan.code || !paymentAvailable}
                          onClick={() => purchaseProPlan(plan)}
                          className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-950 px-2 py-2 text-[9px] font-black text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 sm:text-[10px]"
                        >
                          {busyPlanCode === plan.code ? (
                            <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
                          ) : (
                            <CreditCard size={12} aria-hidden="true" />
                          )}
                          {lock
                            ? 'Purchased'
                            : busyPlanCode === plan.code
                              ? 'Opening...'
                              : paymentAvailable
                                ? `Buy ${plan.name}`
                                : 'Unavailable'}
                        </button>

                        {lockedUntil ? (
                          <p className="mt-1.5 text-[8px] font-bold leading-3 text-stone-500 sm:text-[9px]">
                            Buy again after {lockedUntil.toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}.
                          </p>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-2 flex min-w-0 items-start gap-2 overflow-hidden rounded-xl bg-stone-50 px-2.5 py-1.5 text-[8px] font-semibold leading-[13px] text-stone-500 sm:mt-2.5 sm:px-3 sm:py-2 sm:text-[10px] sm:leading-4">
            <CreditCard size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Payments currently use Razorpay test mode. If you buy another plan while Pro is active, its time is added after your current validity.
            </p>
          </div>
        </div>
      </section>

      {paymentMessage ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {paymentMessage}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid min-h-52 place-items-center">
          <LoaderCircle className="animate-spin text-emerald-700" aria-label="Loading courses" />
        </div>
      ) : courses.length ? (
        <section className="mt-3 min-w-0 sm:mt-4">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                Courses
              </p>
              <h2 className="mt-0.5 text-lg font-black text-stone-950 sm:text-xl">
                Choose what you want to learn
              </h2>
            </div>
            <span className="text-[10px] font-bold text-stone-400">
              {courses.length} available
            </span>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
            {courses.map((item) => {
              const course = item.course
              const isFree = course.accessType === 'free'
              const entitled =
                isFree ||
                proOverview?.membership?.active === true ||
                entitledCourseIds.has(course.id)
              const preparedResult = prepared[course.id]
              const outcomePlanId =
                preparedResult?.preparation?.outcomePlan?.plan?.id || null

              const detailPath = `/learn/courses/${encodeURIComponent(course.id)}`
              const detailTarget =
                isAuthenticated && customerEnabled
                  ? detailPath
                  : `/login?returnTo=${encodeURIComponent(detailPath)}`

              return (
                <article
                  key={course.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                >
                  <div className="aspect-[16/9] bg-stone-100">
                    {item.recipe?.heroImageUrl ? (
                      <img
                        src={item.recipe.heroImageUrl}
                        alt={item.recipe.name || course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-stone-300">
                        <BookOpen size={28} aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-3 sm:p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-[9px]">
                          {course.category || 'Cooking course'}
                        </p>
                        <h3 className="mt-0.5 line-clamp-2 text-[13px] font-black leading-[18px] text-stone-950 sm:text-sm sm:leading-5">
                          {course.title}
                        </h3>
                      </div>

                      <span className={[
                        'shrink-0 rounded-full px-2 py-1 text-[8px] font-black uppercase',
                        isFree
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-950 text-white',
                      ].join(' ')}>
                        {isFree ? 'Free' : 'Pro'}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[9px] leading-4 text-stone-600 sm:text-[10px]">
                      {course.summary || 'A practical EPANTRY course you can learn at your own pace.'}
                    </p>

                    {item.creator?.id ? (
                      <Link
                        to={`/creators/${encodeURIComponent(item.creator.id)}`}
                        className="focus-ring mt-2 inline-flex w-fit max-w-full items-center gap-1.5 truncate text-[9px] font-black text-stone-500 hover:text-emerald-800"
                      >
                        <ChefHat size={12} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.creator.displayName}</span>
                      </Link>
                    ) : null}

                    <Link
                      to={detailTarget}
                      className="focus-ring mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-stone-950 px-2.5 py-2 text-[10px] font-black text-white"
                    >
                      View course
                      <ArrowRight size={13} aria-hidden="true" />
                    </Link>

                    {isAuthenticated && customerEnabled ? (
                      <div className="mt-2">
                        {preparedResult ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                            <div className="flex items-start gap-1.5">
                              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-emerald-900">Ready for class</p>
                                {outcomePlanId ? (
                                  <Link
                                    to={`/outcome-plans/${encodeURIComponent(outcomePlanId)}`}
                                    className="focus-ring mt-1.5 inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1.5 text-[8px] font-black text-white"
                                  >
                                    <PackageCheck size={11} aria-hidden="true" />
                                    Open prep basket
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : entitled && item.recipe ? (
                          <button
                            type="button"
                            disabled={busyCourseId === course.id}
                            onClick={() => prepare(item)}
                            className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-[9px] font-black text-emerald-800 disabled:opacity-50"
                          >
                            {busyCourseId === course.id ? (
                              <LoaderCircle size={12} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Sparkles size={12} aria-hidden="true" />
                            )}
                            Prepare · 2 servings
                          </button>
                        ) : entitled ? (
                          <div className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-[8px] font-semibold leading-[14px] text-sky-900 sm:text-[9px]">
                            This course does not need a recipe preparation basket.
                          </div>
                        ) : (
                          <div className="flex items-start gap-1.5 rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-600">
                            <LockKeyhole size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p className="text-[8px] leading-[14px] sm:text-[9px]">
                              Pro or course access is needed for protected lessons.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-7 text-center">
          <BookOpen size={28} className="mx-auto text-stone-300" aria-hidden="true" />
          <p className="mt-2 text-xs font-black text-stone-700">
            No courses are available yet.
          </p>
        </div>
      )}

      {isAuthenticated && customerEnabled ? (
        <CreatorProTransactionsPanel mode="customer" />
      ) : null}
    </main>
  )
}
