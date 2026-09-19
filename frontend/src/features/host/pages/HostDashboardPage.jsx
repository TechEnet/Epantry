import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  FileSearch,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  WalletCards,
  Warehouse,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getHostEarningsOverview,
} from '../../hostOperations/services/hostOperations.service'

const workflowStages = [
  {
    step: 'Step 1',
    title: 'Set up the business',
    description: 'Complete operations readiness, business profile, KYB, documents and access setup before moving deeper into commerce.',
    to: '/host/operations-center',
    action: 'Open Operations Center',
    icon: Building2,
    className: 'border-amber-200 bg-[#fff2c9]',
    iconClassName: 'bg-amber-500 text-stone-950',
  },
  {
    step: 'Step 2',
    title: 'Build the catalog',
    description: 'Create and review products, scan items, resolve NPI work, improve data quality and prepare trusted listings.',
    to: '/host/catalog',
    action: 'Open Catalog',
    icon: Boxes,
    className: 'border-sky-200 bg-[#e5f4ff]',
    iconClassName: 'bg-sky-600 text-white',
  },
  {
    step: 'Step 3',
    title: 'Sell and fulfill',
    description: 'Manage pricing, inventory, incoming orders, fulfillment work and the finance trail connected to commerce.',
    to: '/host/marketplace',
    action: 'Open Pricing & Inventory',
    icon: ShoppingBag,
    className: 'border-emerald-200 bg-[#dcf7e8]',
    iconClassName: 'bg-emerald-700 text-white',
  },
  {
    step: 'Step 4',
    title: 'Grow and understand',
    description: 'Use campaigns and host analytics after the core business flow is ready and operating.',
    to: '/host/campaigns',
    action: 'Open Campaigns',
    icon: BarChart3,
    className: 'border-violet-200 bg-[#eee8ff]',
    iconClassName: 'bg-violet-600 text-white',
  },
]

const quickAccessItems = [
  {
    title: 'Operations Center',
    description: 'Readiness, commercial setup, KYB and execution-scale operations.',
    to: '/host/operations-center',
    icon: Store,
  },
  {
    title: 'Business Profile',
    description: 'Review the Host business type and business-facing profile information.',
    to: '/host/business-profile',
    icon: Building2,
  },
  {
    title: 'Catalog',
    description: 'Manage the product catalog and bulk catalog workflow.',
    to: '/host/catalog',
    icon: Boxes,
  },
  {
    title: 'Product Editor / NPI',
    description: 'Work on product intelligence and new product intake.',
    to: '/host/product-intelligence',
    icon: FileSearch,
  },
  {
    title: 'Pricing & Inventory',
    description: 'Control marketplace pricing and inventory availability.',
    to: '/host/marketplace',
    icon: Warehouse,
  },
  {
    title: 'Orders',
    description: 'Open Host orders and continue order operations.',
    to: '/host/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Fulfillment',
    description: 'Continue fulfillment work for active Host orders.',
    to: '/host/fulfillment',
    icon: Truck,
  },
  {
    title: 'Finance',
    description: 'Review finance summaries and settlement-related work.',
    to: '/host/finance',
    icon: WalletCards,
  },
  {
    title: 'Recipe Listings',
    description: 'Manage Host and Brand recipe listings.',
    to: '/host/brand-recipes',
    icon: ChefHat,
  },
  {
    title: 'Analytics',
    description: 'Open unified Host analytics for business visibility.',
    to: '/host/analytics',
    icon: BarChart3,
  },
  {
    title: 'Documents / Team / API',
    description: 'Manage Host documents, team access and integration settings.',
    to: '/host/settings',
    icon: Settings,
  },
  {
    title: 'Hospitality / Pro Ops',
    description: 'Open the Hospitality workspace when this business flow applies.',
    to: '/host/hospitality',
    icon: LayoutDashboard,
  },
]

function formatMinorCurrency(
  amountMinor,
  currency = 'INR',
) {
  const amount =
    Number(
      amountMinor ||
        0,
    ) / 100

  try {
    return new Intl.NumberFormat(
      'en-IN',
      {
        style:
          'currency',
        currency:
          currency ||
          'INR',
        maximumFractionDigits:
          2,
      },
    ).format(
      amount,
    )
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

export default function HostDashboardPage() {
  const {
    currentUser,
    hostAccessStatus,
  } = useAuth()


  const [earnings, setEarnings] = useState(null)
  const [earningsLoading, setEarningsLoading] = useState(true)
  const [earningsError, setEarningsError] = useState('')

  const loadEarnings = useCallback(async () => {
    try {
      const result =
        await getHostEarningsOverview()

      setEarnings(
        result?.earnings ||
        null,
      )
      setEarningsError('')
    } catch (error) {
      setEarningsError(
        error?.response?.data?.message ||
        error?.message ||
        'Earnings are temporarily unavailable.',
      )
    } finally {
      setEarningsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEarnings()

    const interval =
      window.setInterval(
        loadEarnings,
        15000,
      )

    window.addEventListener(
      'focus',
      loadEarnings,
    )

    return () => {
      window.clearInterval(
        interval,
      )

      window.removeEventListener(
        'focus',
        loadEarnings,
      )
    }
  }, [loadEarnings])

  const name =
    currentUser?.displayName ||
    currentUser?.name ||
    currentUser?.email ||
    'Host'

  const accessLabel =
    hostAccessStatus === 'active'
      ? 'Active Host'
      : 'Host workspace'

  return (
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section className="relative overflow-hidden rounded-[30px] border border-[#24594c] bg-[#173f35] px-6 py-8 text-white shadow-[0_28px_70px_-48px_rgba(16,55,45,0.75)] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#f0dfb8]">
                Host Dashboard
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                {accessLabel}
              </span>
            </div>

            <p className="mt-6 text-sm font-bold text-white/55">
              Welcome back
            </p>

            <h1 className="mt-1 text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl">
              {name}
            </h1>

            <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-white/70">
              Follow the Host workflow in order, or jump straight into the business area you need from this dashboard.
            </p>
          </div>

          <Link
            to="/host/operations-center"
            className="focus-ring inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f6f0e4]"
          >
            Start with Operations Center
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mt-6">
        <Link
          to="/host/earnings"
          className="focus-ring group relative block overflow-hidden rounded-[28px] border border-sky-800 bg-[#123f63] p-5 text-white shadow-[0_24px_60px_-42px_rgba(14,60,95,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-40px_rgba(14,60,95,0.9)] sm:p-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full bg-violet-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cyan-300 text-[#102f49] shadow-sm">
                <Banknote size={22} aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                    Earnings
                  </p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50">
                    <span className="size-1.5 rounded-full bg-cyan-300" />
                    Live refresh
                  </span>
                </div>

                <p className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                  {earningsLoading
                    ? 'Loading…'
                    : formatMinorCurrency(
                        earnings?.totalEarnedMinor,
                        earnings?.currency,
                      )}
                </p>

                <p className="mt-1 text-sm font-semibold text-white/65">
                  Captured revenue from successful customer payments. Settlement still follows delivery and finance review.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  Paid
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {formatMinorCurrency(
                    earnings?.paidMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  In settlement
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {formatMinorCurrency(
                    earnings?.inSettlementMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">
                  Awaiting settlement
                </p>
                <p className="mt-1 text-base font-black text-white">
                  {formatMinorCurrency(
                    earnings?.awaitingSettlementMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold text-white/55">
              {earningsError ||
                `${earnings?.capturedOrders || 0} paid orders · ${earnings?.deliveredOrders || 0} delivered · auto-refreshes every 15 seconds`}
            </p>

            <span className="inline-flex shrink-0 items-center gap-2 text-xs font-black text-cyan-100">
              Open earnings
              <ArrowRight
                size={15}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </span>
          </div>
        </Link>
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
            The same Host tools from the sidebar are arranged here in a simple business sequence.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {workflowStages.map((stage) => {
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
            Host workspace
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
