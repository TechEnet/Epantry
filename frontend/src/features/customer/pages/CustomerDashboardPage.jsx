import {
  ArrowRight,
  Bell,
  BookOpen,
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
  useCallback,
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

import {
  getCommerceErrorMessage,
  listOrders,
} from '../../commerce/services/commerce.service'

const customerFlowStages = [
  {
    step: 'Step 1',
    title: 'Check your pantry',
    description: 'See what is available at home, what is running low and what should be used soon before planning the next meal.',
    to: '/pantry',
    action: 'Open My Pantry',
    icon: PackageSearch,
    className: 'border-amber-200 bg-[#fff2c9]',
    iconClassName: 'bg-amber-500 text-stone-950',
  },
  {
    step: 'Step 2',
    title: 'Plan the next meals',
    description: 'Build a practical meal plan around your household, food preferences and the ingredients you already have.',
    to: '/meal-plan',
    action: 'Open Meal Planner',
    icon: ListChecks,
    className: 'border-sky-200 bg-[#e5f4ff]',
    iconClassName: 'bg-sky-600 text-white',
  },
  {
    step: 'Step 3',
    title: 'Build the next basket',
    description: 'Turn pantry and planning signals into the next useful shopping basket without losing the context of what is at home.',
    to: '/next-basket',
    action: 'Open Next Basket',
    icon: ShoppingBasket,
    className: 'border-emerald-200 bg-[#dcf7e8]',
    iconClassName: 'bg-emerald-700 text-white',
  },
  {
    step: 'Step 4',
    title: 'Use food before it is wasted',
    description: 'Prioritise ingredients that should be used soon and keep avoidable food waste visible in your everyday workflow.',
    to: '/waste-reduction',
    action: 'Reduce Waste',
    icon: Sparkles,
    className: 'border-violet-200 bg-[#eee8ff]',
    iconClassName: 'bg-violet-600 text-white',
  },
]

const quickAccessItems = [
  {
    title: 'My Pantry',
    description: 'See what you have, what is running low and what should be used soon.',
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
  {
    title: 'Notifications',
    description: 'Open your notification center and review anything that needs your attention.',
    to: '/notifications',
    icon: Bell,
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
    currentUser?.email ||
    'Customer'

  const loadPaymentSummary = useCallback(async () => {
    setPaymentLoading(true)
    setPaymentError('')

    try {
      const firstPage = await listOrders({
        page: 1,
        limit: 50,
      })

      let nextOrders = Array.isArray(firstPage?.orders)
        ? [...firstPage.orders]
        : []

      const pages = Number(firstPage?.pagination?.pages || 1)

      if (pages > 1) {
        const remainingPages = await Promise.all(
          Array.from(
            { length: pages - 1 },
            (_, index) =>
              listOrders({
                page: index + 2,
                limit: 50,
              }),
          ),
        )

        nextOrders = nextOrders.concat(
          ...remainingPages.map((page) =>
            Array.isArray(page?.orders)
              ? page.orders
              : [],
          ),
        )
      }

      setOrders(nextOrders)
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

    const monthOrders = orders.filter(
      (order) => isSameMonth(order?.createdAt, now),
    )

    const paidOrders = monthOrders.filter(
      (order) => order?.paymentStatus === 'paid',
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
      monthOrderCount: monthOrders.length,
      monthLabel: now.toLocaleDateString(
        'en-IN',
        {
          month: 'long',
          year: 'numeric',
        },
      ),
    }
  }, [orders])

  return (
    <main className="min-h-screen bg-[#eef4f0] p-3 sm:bg-[#f7f5ef] sm:p-7">
      <section className="relative overflow-hidden rounded-[22px] border border-[#24594c] bg-[#173f35] px-4 py-5 text-white shadow-[0_28px_70px_-48px_rgba(16,55,45,0.75)] sm:rounded-[30px] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#f0dfb8] sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.16em]">
                Customer Dashboard
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.14em]">
                Customer mode
              </span>
            </div>

            <p className="mt-4 text-xs font-bold text-white/55 sm:mt-6 sm:text-sm">
              Welcome back
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl sm:tracking-[-0.045em]">
              {name}
            </h1>

            <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/70 sm:mt-4 sm:text-base sm:leading-7">
              Manage your pantry, meals, shopping and orders from one place.
            </p>
          </div>

          <Link
            to="/pantry"
            className="focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f6f0e4] sm:h-12 sm:rounded-2xl sm:px-5 sm:text-sm"
          >
            Start with My Pantry
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mt-2.5 sm:mt-6">
        <div className="relative overflow-hidden rounded-[22px] border border-[#24594c] bg-[linear-gradient(135deg,#153f35_0%,#1e5a49_58%,#286854_100%)] p-2.5 text-white shadow-[0_28px_70px_-48px_rgba(16,55,45,0.75)] sm:rounded-[28px] sm:border-[#1f594a] sm:p-6 sm:shadow-[0_24px_60px_-42px_rgba(21,63,53,0.85)]">
          <div className="pointer-events-none absolute -right-20 -top-24 size-60 rounded-full bg-[#f0c978]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 size-56 rounded-full bg-emerald-200/10 blur-3xl" />

          <div className="relative grid gap-2 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#f2dcad]/40 bg-[#f0d39a] text-[#173f35] shadow-[0_3px_0_#b99659] sm:size-12 sm:rounded-2xl sm:shadow-[0_5px_0_#b99659]">
                <ReceiptIndianRupee size={22} aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#eed9ac] sm:text-[10px] sm:tracking-[0.18em]">
                  Your spending
                </p>

                <div className="mt-0.5 flex flex-wrap items-end gap-x-2 gap-y-0.5">
                  <p className="text-xl font-black tracking-[-0.03em] text-white sm:text-4xl sm:tracking-[-0.035em]">
                    {paymentLoading
                      ? 'Loading…'
                      : paymentError
                        ? '—'
                        : formatMoney(
                            monthSummary.amountMinor,
                            monthSummary.currency,
                          )}
                  </p>
                  <p className="pb-0 text-[10px] font-bold text-white/60 sm:pb-1 sm:text-sm">
                    in {monthSummary.monthLabel}
                  </p>
                </div>

                <p className="mt-0.5 text-[10px] font-semibold leading-4 text-white/70 sm:mt-2 sm:text-sm">
                  {paymentLoading
                    ? 'Getting your latest order activity…'
                    : paymentError
                      ? 'Your spending summary could not be loaded right now.'
                      : `${monthSummary.paidOrderCount} paid ${monthSummary.paidOrderCount === 1 ? 'order' : 'orders'} this month.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-row sm:gap-3 lg:justify-end">
              <div className="min-w-0 rounded-lg border border-white/12 bg-white/10 px-2 py-1 backdrop-blur-sm sm:min-w-[130px] sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-white/50 sm:text-[10px] sm:tracking-[0.12em]">
                  Orders this month
                </p>
                <p className="text-base font-black text-white sm:mt-1 sm:text-xl">
                  {paymentLoading || paymentError
                    ? '—'
                    : monthSummary.monthOrderCount}
                </p>
              </div>

              <div className="min-w-0 rounded-lg border border-white/12 bg-white/10 px-2 py-1 backdrop-blur-sm sm:min-w-[130px] sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-white/50 sm:text-[10px] sm:tracking-[0.12em]">
                  Paid orders
                </p>
                <p className="text-base font-black text-white sm:mt-1 sm:text-xl">
                  {paymentLoading || paymentError
                    ? '—'
                    : monthSummary.paidOrderCount}
                </p>
              </div>

              <Link
                to="/account/spending"
                className="focus-ring col-span-2 inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff8ec] sm:col-auto sm:min-h-[58px] sm:gap-2 sm:rounded-2xl sm:px-5 sm:text-sm"
              >
                View spending
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-3 sm:mt-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700 sm:text-[10px] sm:tracking-[0.18em]">
            Recommended flow
          </p>
          <h2 className="mt-0.5 text-lg font-black tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-3xl sm:tracking-[-0.035em]">
            What to do next
          </h2>
          <p className="hidden max-w-3xl text-xs leading-5 text-stone-500 sm:mt-2 sm:block sm:text-sm sm:leading-6">
            The same Customer tools from the sidebar are arranged here in a simple everyday food sequence.
          </p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-1 sm:gap-4 xl:grid-cols-4">
          {customerFlowStages.map((stage) => {
            const Icon = stage.icon

            return (
              <Link
                key={stage.step}
                to={stage.to}
                className={`focus-ring group flex min-h-0 flex-col rounded-[14px] border p-2.5 transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:min-h-[255px] sm:rounded-[26px] sm:p-5 ${stage.className}`}
              >
                <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] text-stone-600 sm:text-[10px] sm:tracking-[0.16em]">
                    {stage.step}
                  </span>

                  <span className={`grid size-7 place-items-center rounded-lg sm:size-11 sm:rounded-2xl ${stage.iconClassName}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </div>

                <h3 className="mt-2 text-sm font-black leading-4 tracking-[-0.02em] text-stone-950 sm:mt-6 sm:text-xl sm:leading-normal sm:tracking-[-0.025em]">
                  {stage.title}
                </h3>

                <p className="hidden flex-1 text-xs leading-5 text-stone-600 sm:mt-2 sm:block sm:text-sm sm:leading-6">
                  {stage.description}
                </p>

                <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black leading-3 text-stone-900 sm:mt-5 sm:gap-2 sm:text-xs">
                  {stage.action}
                  <ArrowRight
                    size={15}
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-5 -mx-3 rounded-[18px] border-y border-[#344255]/20 bg-[linear-gradient(145deg,#edf0f4_0%,#e6eaf0_58%,#eef1f5_100%)] px-3 py-3 shadow-[0_16px_34px_-28px_rgba(31,41,55,0.55)] sm:mx-0 sm:mt-7 sm:rounded-[30px] sm:border sm:border-stone-200 sm:bg-none sm:bg-white sm:p-6 sm:shadow-sm">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#344255] sm:text-[10px] sm:tracking-[0.18em] sm:text-violet-700">
            Customer workspace
          </p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#1f2937] sm:text-2xl sm:tracking-[-0.035em] sm:text-stone-950">
            Quick access
          </h2>
        </div>

        <div className="mt-2 grid gap-0 sm:mt-5 sm:gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickAccessItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className="focus-ring group flex items-start gap-2 rounded-none border-0 border-b border-[#344255]/12 bg-transparent px-0 py-2.5 shadow-none transition duration-200 last:border-b-0 hover:bg-[#344255]/[0.04] sm:gap-4 sm:rounded-[22px] sm:border sm:border-stone-200 sm:bg-[#faf8f2] sm:p-4 sm:shadow-none sm:hover:border-emerald-200 sm:hover:bg-emerald-50/70"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-none border-0 bg-transparent text-[#344255] shadow-none sm:size-11 sm:rounded-2xl sm:border-0 sm:bg-white sm:text-emerald-800">
                  <Icon size={18} aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black leading-4 text-[#243041] sm:text-base sm:leading-normal sm:text-stone-950">
                      {item.title}
                    </span>
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-[#526174] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#243041] sm:text-stone-400 sm:group-hover:text-emerald-700"
                    />
                  </span>

                  <span className="mt-0.5 block text-[10px] leading-[14px] text-[#667386] sm:mt-1.5 sm:text-xs sm:leading-5 sm:text-stone-500">
                    {item.description}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
