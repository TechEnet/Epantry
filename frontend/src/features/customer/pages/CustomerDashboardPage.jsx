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
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section className="relative overflow-hidden rounded-[30px] border border-[#24594c] bg-[#173f35] px-6 py-8 text-white shadow-[0_28px_70px_-48px_rgba(16,55,45,0.75)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#f0dfb8]">
                Customer Dashboard
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                Customer mode
              </span>
            </div>

            <p className="mt-6 text-sm font-bold text-white/55">
              Welcome back
            </p>

            <h1 className="mt-1 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              {name}
            </h1>

            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/70">
              Follow your food workflow in order, or jump straight into the Customer area you need from this dashboard.
            </p>
          </div>

          <Link
            to="/pantry"
            className="focus-ring inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f6f0e4]"
          >
            Start with My Pantry
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <div className="relative overflow-hidden rounded-[28px] border border-[#1f594a] bg-[linear-gradient(135deg,#153f35_0%,#1e5a49_58%,#286854_100%)] p-5 text-white shadow-[0_24px_60px_-42px_rgba(21,63,53,0.85)] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 size-60 rounded-full bg-[#f0c978]/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 size-56 rounded-full bg-emerald-200/10 blur-3xl" />

          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#f2dcad]/40 bg-[#f0d39a] text-[#173f35] shadow-[0_5px_0_#b99659]">
                <ReceiptIndianRupee size={22} aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#eed9ac]">
                  Your spending
                </p>

                <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                    {paymentLoading
                      ? 'Loading…'
                      : paymentError
                        ? '—'
                        : formatMoney(
                            monthSummary.amountMinor,
                            monthSummary.currency,
                          )}
                  </p>
                  <p className="pb-1 text-sm font-bold text-white/60">
                    in {monthSummary.monthLabel}
                  </p>
                </div>

                <p className="mt-2 text-sm font-semibold text-white/70">
                  {paymentLoading
                    ? 'Getting your latest order activity…'
                    : paymentError
                      ? 'Your spending summary could not be loaded right now.'
                      : `${monthSummary.paidOrderCount} paid ${monthSummary.paidOrderCount === 1 ? 'order' : 'orders'} this month.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <div className="min-w-[130px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  Orders this month
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {paymentLoading || paymentError
                    ? '—'
                    : monthSummary.monthOrderCount}
                </p>
              </div>

              <div className="min-w-[130px] rounded-2xl border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  Paid orders
                </p>
                <p className="mt-1 text-xl font-black text-white">
                  {paymentLoading || paymentError
                    ? '—'
                    : monthSummary.paidOrderCount}
                </p>
              </div>

              <Link
                to="/account/spending"
                className="focus-ring inline-flex min-h-[58px] items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff8ec]"
              >
                View spending
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Recommended flow
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
            What to do next
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            The same Customer tools from the sidebar are arranged here in a simple everyday food sequence.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {customerFlowStages.map((stage) => {
            const Icon = stage.icon

            return (
              <Link
                key={stage.step}
                to={stage.to}
                className={`focus-ring group flex min-h-[255px] flex-col rounded-[26px] border p-5 transition duration-200 hover:-translate-y-1 hover:shadow-lg ${stage.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-600">
                    {stage.step}
                  </span>

                  <span className={`grid size-11 place-items-center rounded-2xl ${stage.iconClassName}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-black tracking-[-0.025em] text-stone-950">
                  {stage.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">
                  {stage.description}
                </p>

                <span className="mt-5 inline-flex items-center gap-2 text-xs font-black text-stone-900">
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

      <section className="mt-7 rounded-[30px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">
            Customer workspace
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-stone-950">
            Quick access
          </h2>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickAccessItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className="focus-ring group flex items-start gap-4 rounded-[22px] border border-stone-200 bg-[#faf8f2] p-4 transition duration-200 hover:border-emerald-200 hover:bg-emerald-50/70"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-800 shadow-sm">
                  <Icon size={18} aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-black text-stone-950">
                      {item.title}
                    </span>
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-stone-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-emerald-700"
                    />
                  </span>

                  <span className="mt-1.5 block text-xs leading-5 text-stone-500">
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
