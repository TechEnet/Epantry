import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  PackageSearch,
  ReceiptIndianRupee,
  ReceiptText,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
  UsersRound,
} from 'lucide-react'

import {
  motion,
} from 'motion/react'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getCommerceErrorMessage,
  listOrders,
} from '../../commerce/services/commerce.service'

const quickActions = [
  {
    title: 'My Pantry',
    description: 'See what you have, what is running low, and what should be used soon.',
    to: '/pantry',
    icon: PackageSearch,
  },
  {
    title: 'Meal Plan',
    description: 'Plan meals around your household, pantry and food preferences.',
    to: '/meal-plan',
    icon: ListChecks,
  },
  {
    title: 'Next Basket',
    description: 'Build the next useful basket from pantry and planning signals.',
    to: '/next-basket',
    icon: ShoppingBasket,
  },
  {
    title: 'Waste Reduction',
    description: 'Find ingredients to use soon and reduce avoidable food waste.',
    to: '/waste-reduction',
    icon: Sparkles,
  },
  {
    title: 'Orders',
    description: 'Track current orders and review your EPANTRY order history.',
    to: '/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Household',
    description: 'Manage the household context used for shared food decisions.',
    to: '/account/household',
    icon: UsersRound,
  },
  {
    title: 'Purchase Intelligence',
    description: 'Connect optional purchase sources and correct the history used for learning.',
    to: '/account/purchase-intelligence',
    icon: ReceiptText,
  },
  {
    title: 'My Learning',
    description: 'Continue free or entitled courses, track progress, bookmarks and lesson notes.',
    to: '/account/learning',
    icon: BookOpen,
  },
]

function isSameMonth(
  value,
  reference,
) {
  if (!value) {
    return false
  }

  const date = new Date(value)

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  )
}

function formatMoney(
  amountMinor,
  currency = 'INR',
) {
  if (!Number.isFinite(Number(amountMinor))) {
    return '₹0'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    },
  ).format(Number(amountMinor) / 100)
}

function getCircularOffset(
  index,
  activeIndex,
  total,
) {
  let offset = index - activeIndex
  const half = total / 2

  if (offset > half) {
    offset -= total
  }

  if (offset < -half) {
    offset += total
  }

  return offset
}

function WorkspaceCarousel({
  items,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const total = items.length

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => (current - 1 + total) % total)
  }, [total])

  const goNext = useCallback(() => {
    setActiveIndex((current) => (current + 1) % total)
  }, [total])

  const wheelLockRef = useRef(false)
  const wheelResetRef = useRef(null)

  const handleWheel = useCallback((event) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY

    if (Math.abs(delta) < 14) {
      return
    }

    event.preventDefault()

    if (wheelLockRef.current) {
      return
    }

    wheelLockRef.current = true

    if (delta > 0) {
      goNext()
    } else {
      goPrevious()
    }

    window.clearTimeout(wheelResetRef.current)
    wheelResetRef.current = window.setTimeout(() => {
      wheelLockRef.current = false
    }, 460)
  }, [
    goNext,
    goPrevious,
  ])

  useEffect(() => () => {
    window.clearTimeout(wheelResetRef.current)
  }, [])

  return (
    <div
      onWheel={handleWheel}
      className="mt-5 flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-[36px] border border-[#d8d2c5] bg-[linear-gradient(145deg,#f4f0e7_0%,#fbfaf6_52%,#eef3ef_100%)] px-4 pb-6 pt-5 shadow-[0_30px_80px_-58px_rgba(26,46,37,0.42)] sm:px-7"
    >
      <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-[#6f6a5e]">
        <span className="size-2 rounded-full bg-[#9b7a43]" />
        Scroll or use the controls to move through your workspace
      </div>

      <div className="relative mt-3 min-h-[430px] flex-1 w-full overflow-hidden [perspective:1700px]">
        {items.map((item, index) => {
          const offset = getCircularOffset(index, activeIndex, total)
          const distance = Math.abs(offset)
          const isActive = offset === 0
          const isVisible = distance <= 2
          const Icon = item.icon

          const x = `${offset * 66}%`
          const scale = isActive ? 1 : distance === 1 ? 0.9 : 0.82
          const rotateY = offset * -18
          const opacity = isVisible ? (isActive ? 1 : distance === 1 ? 0.76 : 0.28) : 0
          const zIndex = 30 - distance

          return (
            <motion.div
              key={item.key || item.to}
              initial={false}
              animate={{
                x,
                scale,
                rotateY,
                opacity,
              }}
              transition={{
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                zIndex,
                transformStyle: 'preserve-3d',
                pointerEvents: isVisible ? 'auto' : 'none',
                willChange: 'transform, opacity',
              }}
              className="absolute left-1/2 top-1/2 w-[min(82vw,520px)] -translate-x-1/2 -translate-y-1/2 transform-gpu"
            >
              {isActive ? (
                <Link
                  to={item.to}
                  className="focus-ring group relative flex h-[330px] w-full flex-col justify-between overflow-hidden rounded-[32px] border border-[#315e50] bg-[linear-gradient(145deg,#173c33_0%,#102f28_56%,#0b211c_100%)] p-8 text-white shadow-[0_34px_70px_-38px_rgba(9,29,25,0.72)] transition-colors duration-300 hover:border-[#bca36f]"
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-bl-[120px] bg-[#d1b87e]/10" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/18 to-transparent" />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="grid size-14 place-items-center rounded-[20px] border border-white/12 bg-white/10 text-[#ead9ad]">
                      <Icon size={23} aria-hidden="true" />
                    </div>

                    <div className="flex items-center gap-2">
                      {item.meta ? (
                        <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black text-[#efe3c4] sm:inline-flex">
                          <CalendarDays size={11} aria-hidden="true" />
                          {item.meta}
                        </span>
                      ) : null}
                      <div className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white/72 transition duration-300 group-hover:translate-x-1 group-hover:border-[#d8c28f]/55 group-hover:text-[#f3e4bf]">
                        <ArrowRight size={17} aria-hidden="true" />
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    {item.eyebrow ? (
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#d8c28f]">
                        {item.eyebrow}
                      </p>
                    ) : null}
                    <h3 className={`${item.largeTitle ? 'text-3xl tracking-[-0.045em]' : 'text-2xl tracking-[-0.035em]'} font-black text-white`}>
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[15px] leading-7 text-white/70">
                      {item.description}
                    </p>
                  </div>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="focus-ring group relative flex h-[330px] w-full flex-col justify-between overflow-hidden rounded-[32px] border border-[#d8d0be] bg-[linear-gradient(150deg,#fffdf9_0%,#f2eee5_100%)] p-8 text-left shadow-[0_24px_56px_-42px_rgba(45,40,31,0.46)] transition-colors duration-300 hover:border-[#bba06e]"
                  aria-label={`Focus ${item.eyebrow || item.title}`}
                >
                  <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-bl-[120px] bg-[#ccb98c]/12" />
                  <div className="relative grid size-14 place-items-center rounded-[20px] border border-[#cadbd3] bg-[#e7efe9] text-[#184b3d]">
                    <Icon size={23} aria-hidden="true" />
                  </div>

                  <div className="relative">
                    {item.eyebrow ? (
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b6a35]">
                        {item.eyebrow}
                      </p>
                    ) : null}
                    <h3 className="text-2xl font-black tracking-[-0.035em] text-stone-950">
                      {item.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[15px] leading-7 text-stone-500">
                      {item.description}
                    </p>
                  </div>
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goPrevious}
          className="focus-ring grid size-12 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:-translate-x-0.5 hover:border-[#b89b69] hover:text-[#173b32]"
          aria-label="Previous workspace card"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3">
          <span
            aria-live="polite"
            className="min-w-[58px] rounded-full border border-[#d8d0be] bg-white px-3 py-2 text-center text-[11px] font-black tabular-nums text-[#173b32] shadow-sm"
          >
            {activeIndex + 1} / {total}
          </span>

          <div className="flex flex-wrap items-center justify-center gap-2">
          {items.map((item, index) => (
            <button
              key={`dot-${item.key || item.to}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`focus-ring h-2.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? 'w-8 bg-[#173b32]'
                  : 'w-2.5 bg-[#c9c0af] hover:bg-[#b89b69]'
              }`}
              aria-label={`Show ${item.eyebrow || item.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            />
          ))}
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          className="focus-ring grid size-12 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition hover:translate-x-0.5 hover:border-[#b89b69] hover:text-[#173b32]"
          aria-label="Next workspace card"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function CustomerDashboardPage() {
  const {
    currentUser,
  } = useAuth()

  const [orders, setOrders] = useState([])
  const [paymentLoading, setPaymentLoading] = useState(true)
  const [paymentError, setPaymentError] = useState('')

  const name =
    currentUser?.displayName ||
    currentUser?.name ||
    'there'

  const loadPaymentSummary = useCallback(async () => {
    setPaymentLoading(true)
    setPaymentError('')

    try {
      const result = await listOrders({
        page: 1,
        limit: 100,
      })

      setOrders(
        Array.isArray(result?.orders)
          ? result.orders
          : [],
      )
    } catch (error) {
      setPaymentError(
        getCommerceErrorMessage(
          error,
          'Unable to load payment summary.',
        ),
      )
    } finally {
      setPaymentLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPaymentSummary()
  }, [loadPaymentSummary])

  const monthSummary = useMemo(() => {
    const now = new Date()

    const paidOrders = orders.filter(
      (order) =>
        order?.paymentStatus === 'paid' &&
        isSameMonth(order?.createdAt, now),
    )

    const amountMinor = paidOrders.reduce(
      (total, order) =>
        total + Number(order?.totals?.totalLandedCostMinor || 0),
      0,
    )

    const currency =
      paidOrders.find((order) => order?.totals?.currency)?.totals?.currency ||
      'INR'

    return {
      amountMinor,
      currency,
      paidOrderCount: paidOrders.length,
      monthLabel: now.toLocaleDateString(
        'en-IN',
        {
          month: 'long',
          year: 'numeric',
        },
      ),
    }
  }, [orders])

  const workspaceItems = useMemo(() => {
    const paymentTitle = paymentLoading
      ? 'Loading payments…'
      : paymentError
        ? 'Payment summary unavailable'
        : formatMoney(
            monthSummary.amountMinor,
            monthSummary.currency,
          )

    const paymentDescription = paymentLoading
      ? 'Checking your paid orders for this month.'
      : paymentError
        ? 'Open payment history to try again.'
        : `${monthSummary.paidOrderCount} paid ${monthSummary.paidOrderCount === 1 ? 'order' : 'orders'} this month`

    const paymentItem = {
      key: 'payment-summary',
      title: paymentTitle,
      description: paymentDescription,
      to: '/account/spending',
      icon: ReceiptIndianRupee,
      eyebrow: 'Paid this month',
      meta: monthSummary.monthLabel,
      largeTitle: true,
    }

    return [
      ...quickActions.slice(0, 5),
      paymentItem,
      ...quickActions.slice(5),
    ]
  }, [
    monthSummary.amountMinor,
    monthSummary.currency,
    monthSummary.monthLabel,
    monthSummary.paidOrderCount,
    paymentError,
    paymentLoading,
  ])

  return (
    <div className="w-full min-w-0 overflow-x-clip">
      <header className="relative flex min-h-[100svh] w-full flex-col overflow-hidden border-y border-[#315e50]/30 bg-[#173f35] px-6 text-white shadow-[0_34px_90px_-58px_rgba(11,37,31,0.74)] sm:px-10 lg:min-h-[133.333svh] lg:px-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-[#b89b69]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-[12%] size-[24rem] rounded-full bg-emerald-300/8 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/15 to-transparent" />

        <div className="relative flex items-center justify-between gap-4 pt-7 sm:pt-9">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e0cea6]">
            Customer Dashboard
          </p>

          <div className="rounded-full border border-[#ead9b4]/25 bg-white/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#efe3c4]">
            Customer mode
          </div>
        </div>

        <div className="relative flex flex-1 items-center py-12 sm:py-16">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-12">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.13,
                  },
                },
              }}
              className="min-w-0"
            >
              {[
                'Welcome back.',
                'Your pantry, meal plans and orders are ready.',
                'Everything stays organised in one place.',
                'Pick up exactly where you left off.',
              ].map((line, index) => (
                <motion.p
                  key={line}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{
                    duration: 0.62,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={[
                    index === 0
                      ? 'text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl'
                      : 'mt-3 max-w-3xl text-lg font-semibold leading-8 text-white/72 sm:text-xl lg:text-2xl',
                  ].join(' ')}
                >
                  {line}
                </motion.p>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 34 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.72, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-w-0 flex-col items-start lg:items-end lg:text-right"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/46">
                Good to have you here
              </p>
              <p className="mt-3 max-w-full whitespace-nowrap font-serif text-5xl font-semibold leading-none tracking-[-0.045em] text-[#efd39a] sm:text-6xl lg:text-[clamp(3.75rem,5.2vw,6.25rem)]">
                {name}
              </p>

              <Link
                to="/notifications"
                className="focus-ring mt-8 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-4 py-3 text-xs font-black text-[#173b32] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#f5efe2]"
              >
                <Bell size={16} aria-hidden="true" />
                Open notifications
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.a
          href="#customer-workspace"
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 1.45, repeat: Infinity, ease: 'easeInOut' }}
          className="focus-ring relative mx-auto mb-5 flex w-fit flex-col items-center gap-2 rounded-full px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.16em] text-white/70 transition hover:text-white"
        >
          <span>Scroll to your workspace</span>
          <span className="grid size-9 place-items-center rounded-full border border-white/18 bg-white/10">
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </motion.a>
      </header>

      <section
        id="customer-workspace"
        className="flex min-h-[100svh] w-full scroll-mt-0 flex-col bg-[#f7f5ef] px-4 py-8 sm:px-6 sm:py-10 lg:px-7"
      >
        <div className="shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8b6a35]">
            Your workspace
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-stone-950 sm:text-4xl">
            Pick up where you left off
          </h2>
        </div>

        <WorkspaceCarousel items={workspaceItems} />
      </section>
    </div>
  )
}
