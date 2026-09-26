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
    title: 'Business Setup & Readiness',
    description: 'Complete business setup, KYB, commercial checks and operational readiness.',
    to: '/host/operations-center',
    icon: Store,
  },
  {
    title: 'Business Profile',
    description: 'Review how your business appears to customers and keep core business details up to date.',
    to: '/host/business-profile',
    icon: Building2,
  },
  {
    title: 'Catalog',
    description: 'Add, edit and organize the products you sell, including bulk catalog updates.',
    to: '/host/catalog',
    icon: Boxes,
  },
  {
    title: 'Product Setup & Intake',
    description: 'Review product details, fix product data and prepare new items before listing.',
    to: '/host/product-intelligence',
    icon: FileSearch,
  },
  {
    title: 'Pricing & Inventory',
    description: 'Set selling prices and keep stock availability accurate for customers.',
    to: '/host/marketplace',
    icon: Warehouse,
  },
  {
    title: 'Orders',
    description: 'Review incoming customer orders and manage each order from confirmation onward.',
    to: '/host/orders',
    icon: ShoppingBag,
  },
  {
    title: 'Fulfillment',
    description: 'Pack, dispatch and track active orders through delivery.',
    to: '/host/fulfillment',
    icon: Truck,
  },
  {
    title: 'Finance',
    description: 'Track earnings, settlement progress and finance-related actions.',
    to: '/host/finance',
    icon: WalletCards,
  },
  {
    title: 'Recipe Listings',
    description: 'Create and manage recipe listings for your Host or Brand.',
    to: '/host/brand-recipes',
    icon: ChefHat,
  },
  {
    title: 'Analytics',
    description: 'See sales, orders and business performance in one place.',
    to: '/host/analytics',
    icon: BarChart3,
  },
  {
    title: 'Business Settings & Team',
    description: 'Manage business documents, team access and connected integrations.',
    to: '/host/settings',
    icon: Settings,
  },
  {
    title: 'Hospitality Operations',
    description: 'Open hospitality tools when your business uses restaurant or service operations.',
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
    <main className="min-h-screen bg-[#f7f5ef] p-3 sm:p-7">
      <section className="relative overflow-hidden rounded-[24px] border border-[#24594c] bg-[#173f35] px-4 py-5 text-white shadow-[0_28px_70px_-48px_rgba(16,55,45,0.75)] sm:rounded-[30px] sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#f0dfb8] sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.16em]">
                Host Dashboard
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-100 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.14em]">
                {accessLabel}
              </span>
            </div>

            <p className="mt-3 text-[11px] font-bold text-white/55 sm:mt-6 sm:text-sm">
              Welcome back
            </p>

            <h1 className="mt-0.5 text-[28px] font-black tracking-[-0.045em] text-white sm:mt-1 sm:text-5xl">
              {name}
            </h1>

            <p className="mt-2 max-w-2xl text-[11px] font-medium leading-[18px] text-white/70 sm:mt-4 sm:text-base sm:leading-7">
              <span className="sm:hidden">Run your Host workflow or jump straight to the tool you need.</span>
              <span className="hidden sm:inline">Follow the Host workflow in order, or jump straight into the business area you need from this dashboard.</span>
            </p>
          </div>

          <Link
            to="/host/operations-center"
            className="focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-[11px] font-black text-[#173f35] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f6f0e4] sm:h-12 sm:gap-2 sm:rounded-2xl sm:px-5 sm:text-sm"
          >
            Start with Operations Center
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mt-3 sm:mt-6">
        <Link
          to="/host/earnings"
          className="focus-ring group relative block overflow-hidden rounded-[24px] border border-sky-800 bg-[#123f63] p-4 text-white shadow-[0_24px_60px_-42px_rgba(14,60,95,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-40px_rgba(14,60,95,0.9)] sm:rounded-[28px] sm:p-6"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-52 rounded-full bg-violet-300/10 blur-3xl" />

          <div className="relative flex flex-col gap-3 sm:gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-[#102f49] shadow-sm sm:size-12 sm:rounded-2xl">
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

                <p className="mt-1 text-[26px] font-black tracking-[-0.035em] text-white sm:mt-2 sm:text-4xl">
                  {earningsLoading
                    ? 'Loading…'
                    : formatMinorCurrency(
                        earnings?.totalEarnedMinor,
                        earnings?.currency,
                      )}
                </p>

                <p className="mt-0.5 text-[10px] font-semibold leading-4 text-white/65 sm:mt-1 sm:text-sm sm:leading-normal">
                  <span className="sm:hidden">Revenue captured from successful customer payments.</span>
                  <span className="hidden sm:inline">Captured revenue from successful customer payments. Settlement still follows delivery and finance review.</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 xl:min-w-[520px]">
              <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/50 sm:text-[10px] sm:tracking-[0.12em]">
                  Paid
                </p>
                <p className="mt-0.5 text-[12px] font-black text-white sm:mt-1 sm:text-base">
                  {formatMinorCurrency(
                    earnings?.paidMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/50 sm:text-[10px] sm:tracking-[0.12em]">
                  In settlement
                </p>
                <p className="mt-0.5 text-[12px] font-black text-white sm:mt-1 sm:text-base">
                  {formatMinorCurrency(
                    earnings?.inSettlementMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/50 sm:text-[10px] sm:tracking-[0.12em]">
                  Awaiting settlement
                </p>
                <p className="mt-0.5 text-[12px] font-black text-white sm:mt-1 sm:text-base">
                  {formatMinorCurrency(
                    earnings?.awaitingSettlementMinor,
                    earnings?.currency,
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3 sm:mt-4 sm:gap-4 sm:pt-4">
            <p className="text-[9px] font-semibold text-white/55 sm:text-xs">
              {earningsError ||
                `${earnings?.capturedOrders || 0} paid orders · ${earnings?.deliveredOrders || 0} delivered · auto-refreshes every 15 seconds`}
            </p>

            <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-black text-cyan-100 sm:gap-2 sm:text-xs">
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

      <section className="mt-3 sm:mt-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Recommended flow
          </p>
          <h2 className="mt-0.5 text-[18px] font-black tracking-[-0.035em] text-stone-950 sm:mt-1 sm:text-3xl">
            What to do next
          </h2>
          <p className="mt-1 max-w-3xl text-[10px] leading-4 text-stone-500 sm:mt-2 sm:text-sm sm:leading-6">
            <span className="sm:hidden">Follow the core Host workflow in four simple steps.</span>
            <span className="hidden sm:inline">The same Host tools from the sidebar are arranged here in a simple business sequence.</span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-1 sm:gap-4 xl:grid-cols-4">
          {workflowStages.map((stage) => {
            const Icon = stage.icon

            return (
              <Link
                key={stage.step}
                to={stage.to}
                className={`focus-ring group flex min-h-[168px] flex-col rounded-[20px] border p-3 transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:min-h-[255px] sm:rounded-[26px] sm:p-5 ${stage.className}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-600 sm:text-[10px] sm:tracking-[0.16em]">
                    {stage.step}
                  </span>

                  <span className={`grid size-8 place-items-center rounded-xl sm:size-11 sm:rounded-2xl ${stage.iconClassName}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                </div>

                <h3 className="mt-3 text-[13px] font-black tracking-[-0.02em] text-stone-950 sm:mt-6 sm:text-xl sm:tracking-[-0.025em]">
                  {stage.title}
                </h3>

                <p className="mt-1 flex-1 text-[9.5px] leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
                  <span className="sm:hidden">
                    {stage.step === 'Step 1' && 'Finish setup, KYB and business readiness.'}
                    {stage.step === 'Step 2' && 'Add products and prepare trusted listings.'}
                    {stage.step === 'Step 3' && 'Manage pricing, stock, orders and fulfilment.'}
                    {stage.step === 'Step 4' && 'Use campaigns and analytics to grow.'}
                  </span>
                  <span className="hidden sm:inline">{stage.description}</span>
                </p>

                <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-stone-900 sm:mt-5 sm:gap-2 sm:text-xs">
                  <span className="sm:hidden">
                    {stage.step === 'Step 1' && 'Open setup'}
                    {stage.step === 'Step 2' && 'Open catalog'}
                    {stage.step === 'Step 3' && 'Open marketplace'}
                    {stage.step === 'Step 4' && 'Open campaigns'}
                  </span>
                  <span className="hidden sm:inline">{stage.action}</span>
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

      <section className="mt-4 rounded-[24px] border border-stone-200 bg-white p-3 shadow-sm sm:mt-7 sm:rounded-[30px] sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">
            Host workspace
          </p>
          <h2 className="mt-0.5 text-[18px] font-black tracking-[-0.035em] text-stone-950 sm:mt-1 sm:text-2xl">
            Quick access
          </h2>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
          {quickAccessItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.to}
                to={item.to}
                className="focus-ring group flex items-start gap-2 rounded-[16px] border border-stone-200 bg-[#faf8f2] p-2.5 transition duration-200 hover:border-emerald-200 hover:bg-emerald-50/70 sm:gap-4 sm:rounded-[22px] sm:p-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-emerald-800 shadow-sm sm:size-11 sm:rounded-2xl">
                  <Icon size={18} aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black leading-4 text-stone-950 sm:text-base">
                      {item.title}
                    </span>
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="shrink-0 text-stone-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-emerald-700"
                    />
                  </span>

                  <span className="mt-0.5 block text-[8.5px] leading-[14px] text-stone-500 sm:mt-1.5 sm:text-xs sm:leading-5">
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
