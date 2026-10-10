import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  ChefHat,
  CircleUserRound,
  Crown,
  DatabaseZap,
  FileSearch,
  FileWarning,
  Flag,
  FlaskConical,
  IndianRupee,
  List,
  Megaphone,
  Package,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  UsersRound,
  WalletCards,
  Webhook,
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

import AdminAiQualityPanel from '../../search/components/AdminAiQualityPanel'

import {
  getAdminCommandCenter,
  getAdminEarningsOverview,
  getAdminGovernanceErrorMessage,
  getAdminSearchDemand,
} from '../../adminGovernance/services/adminGovernance.service'

import {
  useAdmin,
} from '../context/AdminContext'

import AdminShell from '../components/AdminShell'


function formatMoney(amountMinor) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amountMinor || 0) / 100)
}


const ADMIN_TOOL_PRIORITY = [
  'Host approvals',
  'Ads & promotions review',
  'Product review',
  'Recipe review',
  'Brands & claims',
  'Orders & disputes',
  'Earnings & collections',
  'Payments & settlements',
  'Customer search demand',
  'Catalog & listings',
  'Recipes',
  'Ingredient library',
  'Food Intelligence',
  'People & businesses',
  'Analytics overview',
  'Trust & safety',
  'Bulk product review',
  'Integrations',
  'Pro memberships',
  'Homepage & content',
  'Access & permissions',
  'Platform rules & features',
  'Privacy & consent',
  'Activity & system logs',
  'AI quality review',
]

const ADMIN_TOOL_PRIORITY_INDEX = new Map(
  ADMIN_TOOL_PRIORITY.map((title, index) => [title, index]),
)

const TOOL_GROUPS = [
  {
    key: 'reviews',
    eyebrow: 'Reviews & decisions',
    title: 'Work that needs a decision.',
    description: 'Approvals, disputes and review queues that can block Hosts, listings or marketplace activity.',
    mobileDescription: 'Approvals, disputes & reviews.',
    shell: 'border-[#e8c998] bg-[#fff4df]',
    intro: 'bg-[#915017] text-white',
    line: 'border-[#e8c998]',
    icon: 'text-[#915017]',
    meta: 'text-[#7b4b1d]',
    titles: [
      'Host approvals',
      'Ads & promotions review',
      'Product review',
      'Recipe review',
      'Brands & claims',
      'Orders & disputes',
      'Trust & safety',
      'Bulk product review',
    ],
  },
  {
    key: 'catalog',
    eyebrow: 'Catalog & food content',
    title: 'What customers can discover.',
    description: 'Products, recipes and governed food data that shape the customer-facing EPANTRY experience.',
    mobileDescription: 'Products, recipes & food data.',
    shell: 'border-[#a9d1be] bg-[#e4f2eb]',
    intro: 'bg-[#175342] text-white',
    line: 'border-[#b9dccc]',
    icon: 'text-[#175342]',
    meta: 'text-[#2c6658]',
    titles: [
      'Catalog & listings',
      'Recipes',
      'Ingredient library',
      'Food Intelligence',
      'Homepage & content',
    ],
  },
  {
    key: 'business',
    eyebrow: 'Business & operations',
    title: 'How the platform is moving.',
    description: 'Demand, money, people and operational infrastructure that keep the marketplace running.',
    mobileDescription: 'Demand, money, people & ops.',
    shell: 'border-[#abcde5] bg-[#e5f1f9]',
    intro: 'bg-[#1b587c] text-white',
    line: 'border-[#c0d9ea]',
    icon: 'text-[#1b587c]',
    meta: 'text-[#376b88]',
    titles: [
      'Analytics overview',
      'Customer search demand',
      'People & businesses',
      'Earnings & collections',
      'Payments & settlements',
      'Integrations',
      'Pro memberships',
    ],
  },
  {
    key: 'governance',
    eyebrow: 'Governance & control',
    title: 'Rules, access and platform oversight.',
    description: 'Sensitive controls for permissions, policy, privacy, audit history and AI reliability.',
    mobileDescription: 'Access, policy, privacy, audit & AI.',
    shell: 'border-[#cbbbe2] bg-[#eee8f7]',
    intro: 'bg-[#60457f] text-white',
    line: 'border-[#d7cce8]',
    icon: 'text-[#60457f]',
    meta: 'text-[#725d8e]',
    titles: [
      'Access & permissions',
      'Platform rules & features',
      'Privacy & consent',
      'Activity & system logs',
      'AI quality review',
    ],
  },
]

const FLOW_STEPS = [
  {
    number: '01',
    title: 'Check what needs attention',
    copy: 'Start with reviews, Host approvals and operational exceptions that need a decision.',
    mobileCopy: 'Reviews and approvals first.',
    icon: FileWarning,
  },
  {
    number: '02',
    title: 'See what customers want',
    copy: 'Use search demand to understand which products and recipes people are looking for by area.',
    mobileCopy: 'See customer demand by area.',
    icon: Search,
  },
  {
    number: '03',
    title: 'Track money moving through EPANTRY',
    copy: 'Review platform earnings, subscriptions, paid placements and money collected through checkout.',
    mobileCopy: 'Check money and payouts.',
    icon: IndianRupee,
  },
  {
    number: '04',
    title: 'Open the right control page',
    copy: 'Move into catalog, Hosts, safety, finance or permissions only when that area needs action.',
    mobileCopy: 'Open the right admin tool.',
    icon: ShieldCheck,
  },
]

function CommandMetric({ label, mobileLabel, value, icon: Icon, to, index }) {
  const content = (
    <div className="flex min-h-[76px] flex-col justify-between px-4 py-3 sm:min-h-[92px] sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9.6px] font-black uppercase tracking-[0.14em] text-white/55 sm:hidden">{mobileLabel || label}</p>
        <p className="hidden text-[10.8px] font-black uppercase tracking-[0.15em] text-white/55 sm:block">{label}</p>
        <Icon size={14} className="shrink-0 text-[#b7d9ca]" aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[33.6px] font-black leading-none tracking-[-0.055em] text-white sm:text-[43.2px]">{value}</p>
        {to ? <ArrowRight size={14} className="mb-1 text-white/25" aria-hidden="true" /> : null}
      </div>
    </div>
  )

  const className = `focus-ring block min-w-0 transition hover:bg-white/[0.055] ${index % 2 ? 'border-l border-white/12' : ''} ${index > 1 ? 'border-t border-white/12 sm:border-t-0' : ''} ${index > 0 ? 'sm:border-l sm:border-white/12' : ''} ${index > 2 ? 'sm:border-t sm:border-white/12' : ''}`

  if (to) {
    return <Link to={to} className={className}>{content}</Link>
  }

  return <div className={className}>{content}</div>
}

function FlowStep({ item, index }) {
  const Icon = item.icon

  return (
    <article className={`relative py-3 sm:py-4 lg:px-5 ${index ? 'border-t border-[#ddcfaf] lg:border-l lg:border-t-0' : ''}`}>
      <div className="flex items-start gap-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d2c39f] bg-[#fff8e8] text-[#174e40]">
          <Icon size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-[9.6px] font-black tracking-[0.16em] text-[#9a8861]">{item.number}</span>
            <h3 className="text-[13.2px] font-black leading-4 text-stone-950 sm:text-[14.4px]">{item.title}</h3>
          </div>
          <p className="mt-1.5 text-[10.8px] font-semibold leading-4 text-stone-600 sm:hidden">{item.mobileCopy}</p>
          <p className="mt-1.5 hidden max-w-[250px] text-[12px] font-semibold leading-[1.55] text-stone-600 sm:block">{item.copy}</p>
        </div>
      </div>
    </article>
  )
}

function ToolRow({ item, group }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className={`focus-ring group grid min-w-0 grid-cols-[26px_minmax(0,1fr)_16px] items-start gap-3 border-t py-4 transition hover:bg-white/45 sm:grid-cols-[30px_minmax(0,1fr)_18px] sm:py-[18px] ${group.line}`}
    >
      <Icon size={16} className={`mt-0.5 ${group.icon}`} aria-hidden="true" />

      <div className="min-w-0">
        <h3 className="text-[13.2px] font-black leading-4 text-stone-950 sm:text-[14.4px] sm:leading-5">{item.title}</h3>
        <p className="mt-1 text-[10.8px] font-semibold leading-4 text-stone-600 sm:hidden">{item.mobileDescription || item.description}</p>
        <p className="mt-1 hidden max-w-[520px] text-[12px] font-semibold leading-[1.55] text-stone-600 sm:block">{item.description}</p>
      </div>

      <ArrowRight size={14} className="mt-1 text-stone-400 transition group-hover:translate-x-1 group-hover:text-stone-800" aria-hidden="true" />
    </Link>
  )
}

function WorkspaceSection({ group, items }) {
  if (!items.length) return null

  return (
    <section className={`overflow-hidden rounded-[24px] border ${group.shell}`}>
      <div className="grid lg:grid-cols-[285px_minmax(0,1fr)]">
        <header className={`${group.intro} p-4 sm:p-6 lg:min-h-full lg:p-7`}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[9.6px] font-black uppercase tracking-[0.18em] text-white/70 sm:text-[10.8px]">{group.eyebrow}</p>
            <span className="rounded-full border border-white/20 px-2.5 py-1 text-[9.6px] font-black uppercase tracking-[0.13em] text-white/65">
              {items.length} tools
            </span>
          </div>
          <h2 className="mt-3 max-w-[230px] text-[24px] font-black leading-[1.04] tracking-[-0.035em] text-white sm:mt-7 sm:text-[32.4px]">{group.title}</h2>
          <p className="mt-2 whitespace-nowrap text-[10.2px] font-semibold leading-4 text-white/72 sm:hidden">{group.mobileDescription || group.description}</p>
          <p className="mt-3 hidden max-w-[235px] text-[13.2px] font-semibold leading-5 text-white/72 sm:block">{group.description}</p>
          <div className="mt-3 h-px w-14 bg-white/30 sm:mt-7" />
        </header>

        <div className="px-4 sm:px-5 lg:px-6">
          <div className="grid gap-x-7 md:grid-cols-2">
            {items.map((item) => (
              <ToolRow key={item.to} item={item} group={group} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AdminDashboardPage() {
  const {
    isRootSuperAdmin,
    adminSource,
    adminPermissionKeys,
    hasAdminPermission,
  } = useAdmin()

  const canReadAiQuality = hasAdminPermission('admin.audit.read')

  const [commandCenter, setCommandCenter] = useState(null)
  const [earnings, setEarnings] = useState(null)
  const [demand, setDemand] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const [commandResult, earningsResult, demandResult] = await Promise.allSettled([
      getAdminCommandCenter(),
      getAdminEarningsOverview(),
      getAdminSearchDemand({ days: 30, limit: 20 }),
    ])

    if (commandResult.status === 'fulfilled') {
      setCommandCenter(commandResult.value)
    } else {
      setError(
        getAdminGovernanceErrorMessage(
          commandResult.reason,
          'Some overview information could not be loaded.',
        ),
      )
    }

    setEarnings(earningsResult.status === 'fulfilled' ? earningsResult.value : null)
    setDemand(demandResult.status === 'fulfilled' ? demandResult.value : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const metrics = commandCenter?.metrics || {}

  const pendingReviews =
    Number(metrics.reviewQueue?.open || 0) +
    Number(metrics.catalog?.productVersionsInReview || 0) +
    Number(metrics.recipe?.recipeVersionsInReview || 0) +
    Number(metrics.recipe?.brandRecipeSubmissions || 0)

  const hostApprovals =
    Number(metrics.marketplace?.hostActivationAwaitingReview || 0) +
    Number(metrics.marketplace?.kybAwaitingReview || 0)

  const adminAlerts =
    Number(metrics.marketplace?.failedWebhooks || 0) +
    Number(metrics.trustSafety?.activeIncidents || 0) +
    Number(metrics.audit?.deniedOrFailedLast24Hours || 0)

  const commandMetrics = [
    ['Reviews', 'Reviews', pendingReviews, FileWarning, '/admin/trust-safety'],
    ['Host approvals', 'Hosts', hostApprovals, Store, '/admin/host-operations'],
    ['Ad approvals', 'Ads', Number(metrics.marketplace?.pendingCampaignReviews || 0), CheckCircle2, '/admin/community#retail-media-review'],
    ['Order issues', 'Orders', Number(metrics.marketplace?.orderExceptions || 0), AlertTriangle, '/admin/orders-disputes'],
    ['Settlements', 'Payouts', Number(metrics.finance?.pendingSettlements || 0), WalletCards, '/admin/finance-ops'],
    ['Admin alerts', 'Alerts', adminAlerts, Webhook, '/admin/audit'],
  ]


  const accessibleModules = useMemo(() => [
    {
      icon: BarChart3,
      title: 'Analytics overview',
      description: 'See platform activity, operational signals and business performance in one place.',
      mobileDescription: 'Platform activity and performance.',
      to: '/admin/analytics',
      visible: hasAdminPermission('admin.dashboard.read') || canReadAiQuality,
      tone: 'sky',
    },
    {
      icon: Search,
      title: 'Customer search demand',
      description: 'See what customers search for and which areas are asking for those items most.',
      mobileDescription: 'Search demand by area.',
      to: '/admin/search-demand',
      visible: hasAdminPermission('admin.dashboard.read') || hasAdminPermission('marketplace.read') || hasAdminPermission('catalog.read'),
      tone: 'sky',
    },
    {
      icon: CircleUserRound,
      title: 'People & businesses',
      description: 'Review users, organizations and the business accounts operating on EPANTRY.',
      mobileDescription: 'Users and business accounts.',
      to: '/admin/users-organizations',
      visible: hasAdminPermission('admin.dashboard.read') || hasAdminPermission('host.review.read') || hasAdminPermission('marketplace.read') || hasAdminPermission('trust_safety.read'),
      tone: 'white',
    },
    {
      icon: ShieldCheck,
      title: 'Access & permissions',
      description: 'Control which internal admin profiles can open sensitive Super Admin tools.',
      mobileDescription: 'Manage admin access.',
      to: '/admin/roles',
      visible: isRootSuperAdmin,
      tone: 'violet',
    },
    {
      icon: Package,
      title: 'Catalog & listings',
      description: 'Manage product and Recipe listing records from one governed workspace.',
      mobileDescription: 'Manage catalog listings.',
      to: '/admin/catalog',
      visible: hasAdminPermission('catalog.read') || hasAdminPermission('recipe.read'),
      tone: 'emerald',
    },
    {
      icon: FileSearch,
      title: 'Product review',
      description: 'Check product information that needs verification before it reaches customers.',
      mobileDescription: 'Review product information.',
      to: '/admin/product-intelligence',
      visible: hasAdminPermission('catalog.read') || hasAdminPermission('trust_safety.read'),
      tone: 'amber',
    },
    {
      icon: Boxes,
      title: 'Bulk product review',
      description: 'Review larger batches of product records and resolve catalog issues faster.',
      mobileDescription: 'Review product batches.',
      to: '/admin/bulk-product-review',
      visible: hasAdminPermission('catalog.read') || hasAdminPermission('trust_safety.read'),
      tone: 'amber',
    },
    {
      icon: BadgeCheck,
      title: 'Brands & claims',
      description: 'Review brand ownership, product claims and brand information that needs approval.',
      mobileDescription: 'Review brands and claims.',
      to: '/admin/brands',
      visible: hasAdminPermission('catalog.read') || hasAdminPermission('trust_safety.read'),
      tone: 'violet',
    },
    {
      icon: List,
      title: 'Ingredient library',
      description: 'Maintain the ingredient records used across products, recipes and Food Intelligence.',
      mobileDescription: 'Manage ingredient records.',
      to: '/admin/catalog/ingredients',
      visible: hasAdminPermission('catalog.read'),
      tone: 'emerald',
    },
    {
      icon: ChefHat,
      title: 'Recipes',
      description: 'Manage recipe records and the content customers can discover and cook from.',
      mobileDescription: 'Manage recipe content.',
      to: '/admin/recipes',
      visible: hasAdminPermission('recipe.read'),
      tone: 'sky',
    },
    {
      icon: FlaskConical,
      title: 'Recipe review',
      description: 'Review recipe submissions and governed changes before they become customer-visible.',
      mobileDescription: 'Review recipe submissions.',
      to: '/admin/recipe-review',
      visible: hasAdminPermission('recipe.read') || hasAdminPermission('trust_safety.read'),
      tone: 'violet',
    },
    {
      icon: DatabaseZap,
      title: 'Food Intelligence',
      description: 'Review the food data EPANTRY uses for nutrition, allergens and dietary context.',
      mobileDescription: 'Review food intelligence.',
      to: '/admin/food-intelligence',
      visible: hasAdminPermission('catalog.read') || hasAdminPermission('recipe.read') || hasAdminPermission('trust_safety.read'),
      tone: 'emerald',
    },
    {
      icon: Store,
      title: 'Host approvals',
      description: 'Review Host applications, business readiness and activation decisions.',
      mobileDescription: 'Approve or review Hosts.',
      to: '/admin/host-operations',
      visible: hasAdminPermission('host.review.read') || hasAdminPermission('marketplace.read') || hasAdminPermission('trust_safety.read'),
      tone: 'emerald',
    },
    {
      icon: ShoppingBasket,
      title: 'Orders & disputes',
      description: 'Handle order exceptions, disputes and marketplace cases that need admin help.',
      mobileDescription: 'Resolve order issues.',
      to: '/admin/orders-disputes',
      visible: hasAdminPermission('marketplace.read') || hasAdminPermission('trust_safety.read'),
      tone: 'amber',
    },
    {
      icon: Webhook,
      title: 'Integrations',
      description: 'Check marketplace integrations and failures that can interrupt platform operations.',
      mobileDescription: 'Check integrations.',
      to: '/admin/integrations',
      visible: hasAdminPermission('marketplace.read'),
      tone: 'white',
    },
    {
      icon: IndianRupee,
      title: 'Earnings & collections',
      description: 'See money collected through EPANTRY and the platform revenue inside it.',
      mobileDescription: 'Track platform money.',
      to: '/admin/earnings',
      visible: isRootSuperAdmin || hasAdminPermission('finance.read') || hasAdminPermission('admin.dashboard.read'),
      tone: 'emerald',
    },
    {
      icon: WalletCards,
      title: 'Payments & settlements',
      description: 'Review payment activity, Host settlements and finance items waiting for action.',
      mobileDescription: 'Payments and settlements.',
      to: '/admin/finance-ops',
      visible: hasAdminPermission('finance.read'),
      tone: 'sky',
    },
    {
      icon: Crown,
      title: 'Pro memberships',
      description: 'Review EPANTRY Pro membership activity and subscription operations.',
      mobileDescription: 'Manage Pro memberships.',
      to: '/admin/pro',
      visible: isRootSuperAdmin,
      tone: 'violet',
    },
    {
      icon: Boxes,
      title: 'Homepage & content',
      description: 'Manage governed homepage and editorial content shown across EPANTRY.',
      mobileDescription: 'Manage site content.',
      to: '/admin/cms',
      visible: hasAdminPermission('cms.read'),
      tone: 'sky',
    },
    {
      icon: Megaphone,
      title: 'Ads & promotions review',
      description: 'Approve paid Host campaigns and sponsored placements before they go live.',
      mobileDescription: 'Review paid campaigns.',
      to: '/admin/ad-review',
      visible: hasAdminPermission('marketplace.read') || hasAdminPermission('trust_safety.read'),
      tone: 'amber',
    },
    {
      icon: Flag,
      title: 'Platform rules & features',
      description: 'Control governed platform rules, feature switches and operational policies.',
      mobileDescription: 'Manage platform rules.',
      to: '/admin/policy',
      visible: hasAdminPermission('admin.dashboard.read'),
      tone: 'white',
    },
    {
      icon: ShieldAlert,
      title: 'Trust & safety',
      description: 'Review safety cases, escalations and platform decisions that need intervention.',
      mobileDescription: 'Handle safety cases.',
      to: '/admin/trust-safety',
      visible: hasAdminPermission('trust_safety.read'),
      tone: 'amber',
    },
    {
      icon: UsersRound,
      title: 'Image Privacy & Safety Review',
      description: 'Review uploaded images for privacy risks, and manage customer data requests and policies.',
      mobileDescription: 'Review image safety and privacy.',
      to: '/admin/privacy',
      visible: hasAdminPermission('trust_safety.read'),
      tone: 'violet',
    },
    {
      icon: ScrollText,
      title: 'Activity & system logs',
      description: 'Trace important admin actions, system events and recorded operational history.',
      mobileDescription: 'Review admin activity.',
      to: '/admin/audit',
      visible: canReadAiQuality,
      tone: 'white',
    },
    {
      icon: Bot,
      title: 'AI quality review',
      description: 'Inspect Food Copilot reliability and repeated AI execution problems.',
      mobileDescription: 'Review AI reliability.',
      to: '/admin/ai-quality',
      visible: canReadAiQuality || hasAdminPermission('catalog.read') || hasAdminPermission('trust_safety.read'),
      tone: 'sky',
    },
  ]
    .filter((item) => item.visible)
    .sort((left, right) => {
      const leftPriority = ADMIN_TOOL_PRIORITY_INDEX.get(left.title) ?? Number.MAX_SAFE_INTEGER
      const rightPriority = ADMIN_TOOL_PRIORITY_INDEX.get(right.title) ?? Number.MAX_SAFE_INTEGER
      return leftPriority - rightPriority
    }), [canReadAiQuality, hasAdminPermission, isRootSuperAdmin])

  const moduleGroups = TOOL_GROUPS
    .map((group) => ({
      ...group,
      items: group.titles
        .map((title) => accessibleModules.find((item) => item.title === title))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <AdminShell
      flushTop
      title={<span className="text-[1.2em]">Super Admin Overview</span>}
      description={
        <span className="text-[1.2em]">
          <span className="sm:hidden">Reviews, demand, money and controls.</span>
          <span className="hidden sm:inline">See what needs attention, what customers are asking for, where money is moving, and which control area to open next.</span>
        </span>
      }
      actions={
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-stone-300 bg-[#f8f5ed] px-3.5 py-2 text-[14.4px] font-black text-stone-700 transition hover:border-stone-400 hover:bg-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="-m-2.5 bg-[#f1eee6] p-2.5 sm:-m-5 sm:p-5 lg:-m-6 lg:p-6">
        <div className="space-y-3 sm:space-y-6">
          <div className="sm:hidden">
            <section className="w-full overflow-hidden rounded-[22px] border border-[#24574c] bg-[#0f4539] shadow-[0_14px_38px_rgba(38,49,45,0.10)]">
              <div className="relative px-4 py-3.5">
                <div className="absolute right-[-52px] top-[-58px] h-32 w-32 rounded-full border border-white/10" aria-hidden="true" />
                <div className="absolute right-[-14px] top-[-20px] h-20 w-20 rounded-full border border-[#dcbf79]/20" aria-hidden="true" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[8.8px] font-black uppercase tracking-[0.15em] text-[#c3dfd3]">
                      <CheckCircle2 size={11} className="shrink-0" aria-hidden="true" />
                      <span>Super Admin control room</span>
                    </span>
                    <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.11em] text-white/40">
                      {adminSource === 'super_admin' ? 'Super Admin' : 'Assigned Admin'}
                    </span>
                  </div>

                  <h2 className="mt-3 text-[25px] font-black leading-[0.98] tracking-[-0.045em] text-white">
                    What needs attention now.
                  </h2>

                  <p className="mt-2 whitespace-nowrap text-[9.8px] font-semibold leading-4 text-white/68">
                    Reviews, approvals, money & alerts in one view.
                  </p>
                </div>
              </div>

              <details className="group border-t border-[#d8c694] bg-[#efe1bd]">
                <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[11px] font-black text-[#4f421f] [&::-webkit-details-marker]:hidden">
                  <span>Open admin signals</span>
                  <span className="text-[15px] leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>

                <div className="border-t border-[#d8c694] bg-[#0f4539]">
                  <div className="grid grid-cols-2 border-b border-white/12 px-4 py-3">
                    <div>
                      <p className="text-[20px] font-black leading-none tracking-[-0.04em] text-[#f0d18c]">{adminPermissionKeys.length}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">Permissions</p>
                    </div>
                    <div className="border-l border-white/12 pl-4">
                      <p className="text-[20px] font-black leading-none tracking-[-0.04em] text-[#f0d18c]">{accessibleModules.length}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/45">Tools available</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2">
                    {commandMetrics.map(([label, mobileLabel, value, Icon, to], index) => (
                      <CommandMetric
                        key={label}
                        label={label}
                        mobileLabel={mobileLabel}
                        value={loading && !commandCenter ? '...' : value}
                        icon={Icon}
                        to={to}
                        index={index}
                      />
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#d8c694] px-3.5 py-2.5">
                  <p className="text-[8.8px] font-black uppercase tracking-[0.16em] text-[#6f5828]">Quick dashboard flow</p>
                  <div className="mt-1.5">
                    {FLOW_STEPS.map((item, index) => (
                      <FlowStep key={item.number} item={item} index={index} />
                    ))}
                  </div>
                </div>
              </details>
            </section>
          </div>

          <section className="hidden overflow-hidden rounded-[26px] border border-[#24574c] bg-[#0f4539] shadow-[0_18px_55px_rgba(38,49,45,0.10)] sm:block">
            <div className="grid lg:grid-cols-[minmax(290px,0.9fr)_minmax(0,1.45fr)]">
              <div className="relative overflow-hidden border-b border-white/12 p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
                <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border border-white/10" aria-hidden="true" />
                <div className="absolute right-[-22px] top-[-22px] h-24 w-24 rounded-full border border-[#dcbf79]/20" aria-hidden="true" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-2 text-[9.6px] font-black uppercase tracking-[0.18em] text-[#c3dfd3] sm:text-[10.8px]">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      Super Admin control room
                    </span>
                    <span className="text-[9.6px] font-black uppercase tracking-[0.13em] text-white/40">
                      {adminSource === 'super_admin' ? 'Super Admin' : 'Assigned Admin'}
                    </span>
                  </div>

                  <h2 className="mt-5 max-w-[430px] text-[34.8px] font-black leading-[0.98] tracking-[-0.05em] text-white sm:text-[48px] lg:text-[55.2px]">
                    What needs attention right now.
                  </h2>

                  <p className="mt-3 max-w-[500px] text-[12px] font-semibold leading-5 text-white/65 sm:text-[14.4px] sm:leading-6">
                    Reviews, approvals, marketplace issues and finance signals are grouped here before you move into the detailed admin sections below.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-y-3 border-t border-white/12 pt-4">
                    <div>
                      <p className="text-[24px] font-black leading-none tracking-[-0.04em] text-[#f0d18c] sm:text-[28.8px]">{adminPermissionKeys.length}</p>
                      <p className="mt-1.5 text-[9.6px] font-black uppercase tracking-[0.14em] text-white/45">Permissions</p>
                    </div>
                    <div className="border-l border-white/12 pl-5">
                      <p className="text-[24px] font-black leading-none tracking-[-0.04em] text-[#f0d18c] sm:text-[28.8px]">{accessibleModules.length}</p>
                      <p className="mt-1.5 text-[9.6px] font-black uppercase tracking-[0.14em] text-white/45">Tools available</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3">
                {commandMetrics.map(([label, mobileLabel, value, Icon, to], index) => (
                  <CommandMetric
                    key={label}
                    label={label}
                    mobileLabel={mobileLabel}
                    value={loading && !commandCenter ? '...' : value}
                    icon={Icon}
                    to={to}
                    index={index}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-[#d8c694] bg-[#efe1bd] px-4 sm:px-5 lg:px-6">
              <div className="grid lg:grid-cols-[210px_minmax(0,1fr)]">
                <div className="border-b border-[#d8c694] py-3 lg:border-b-0 lg:border-r lg:py-4 lg:pr-5">
                  <p className="text-[9.6px] font-black uppercase tracking-[0.18em] text-[#6f5828]">Quick dashboard flow</p>
                  <p className="mt-1.5 text-[15.6px] font-black leading-4 text-stone-950">Read the page in this order.</p>
                </div>
                <div className="grid lg:grid-cols-4 lg:pl-5">
                  {FLOW_STEPS.map((item, index) => (
                    <FlowStep key={item.number} item={item} index={index} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[14.4px] font-semibold text-red-700 sm:px-5">{error}</div>
          ) : null}

          {(commandCenter?.incidentBanners || []).length ? (
            <section className="overflow-hidden rounded-[18px] border border-amber-300 bg-amber-50">
              {(commandCenter.incidentBanners || []).map((incident, index) => (
                <div key={incident.id} className={`flex items-start gap-3 px-4 py-3.5 sm:px-5 ${index ? 'border-t border-amber-200' : ''}`}>
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
                  <div>
                    <p className="text-[16.8px] font-black text-amber-950">{incident.title}</p>
                    <p className="mt-1 text-[14.4px] font-semibold leading-5 text-amber-800">{incident.banner?.message || incident.summary}</p>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="w-full overflow-hidden rounded-[20px] border border-[#bed4ca] bg-[#f7f4ec] sm:hidden">
            <header className="bg-[#d8e9df] px-4 py-2.5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8.8px] font-black uppercase tracking-[0.16em] text-[#1b5a49]">Business pulse</p>
                  <h2 className="mt-0.5 text-[17px] font-black leading-5 tracking-[-0.03em] text-stone-950">Money + customer demand</h2>
                </div>
                <p className="shrink-0 whitespace-nowrap text-[8.4px] font-bold text-stone-600">At a glance</p>
              </div>
              <p className="mt-1 whitespace-nowrap text-[9.4px] font-semibold leading-4 text-stone-600">
                Money and demand signals in one place.
              </p>
            </header>

            <div className="grid grid-cols-2">
              <Link
                to="/admin/earnings"
                className="focus-ring min-w-0 border-r border-[#bed4ca] bg-[#cce7da] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2 text-[#145846]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <IndianRupee size={13} className="shrink-0" aria-hidden="true" />
                    <p className="text-[8.4px] font-black uppercase tracking-[0.1em]">Money</p>
                  </div>
                  <ArrowRight size={12} className="shrink-0 text-[#5f8f82]" aria-hidden="true" />
                </div>
                <p className="mt-2 break-words text-[22px] font-black leading-none tracking-[-0.05em] text-stone-950">{formatMoney(earnings?.currentMonth?.grossCollectionsMinor)}</p>
                <p className="mt-1.5 break-words text-[8.8px] font-semibold leading-[1.35] text-stone-600">
                  This month · platform {formatMoney(earnings?.currentMonth?.platformRevenueMinor)}
                </p>
              </Link>

              <Link
                to="/admin/search-demand"
                className="focus-ring min-w-0 bg-[#d5e8f4] px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2 text-[#15527a]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Search size={13} className="shrink-0" aria-hidden="true" />
                    <p className="text-[8.4px] font-black uppercase tracking-[0.1em]">Demand</p>
                  </div>
                  <ArrowRight size={12} className="shrink-0 text-[#668da7]" aria-hidden="true" />
                </div>
                <p className="mt-2 break-words text-[22px] font-black leading-none tracking-[-0.05em] text-stone-950">{demand?.totalSearches ?? 0}</p>
                <p className="mt-1.5 break-words text-[8.8px] font-semibold leading-[1.3] text-stone-600">
                  30 days{demand?.topQuery?.query ? ` · top: “${demand.topQuery.query}”` : ' · no top search yet'}
                </p>
                {demand?.topArea ? (
                  <p className="mt-1 break-words text-[8.4px] font-bold leading-[1.25] text-stone-500">
                    {[demand.topArea.city, demand.topArea.state, demand.topArea.postcode].filter(Boolean).join(', ') || 'Area not available'}
                  </p>
                ) : null}
              </Link>
            </div>
          </section>

          <section className="hidden overflow-hidden rounded-[26px] border border-[#bed4ca] bg-[#f7f4ec] sm:block">
            <div className="grid lg:grid-cols-[250px_minmax(0,1fr)]">
              <header className="bg-[#d8e9df] p-5 sm:p-6 lg:p-7">
                <p className="text-[9.6px] font-black uppercase tracking-[0.18em] text-[#1b5a49] sm:text-[10.8px]">Business pulse</p>
                <h2 className="mt-5 max-w-[210px] text-[27.6px] font-black leading-[1.02] tracking-[-0.04em] text-stone-950 sm:text-[33.6px]">Money and customer demand.</h2>
                <p className="mt-3 max-w-[220px] text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13.2px]">
                  Two signals that tell you how EPANTRY is being used and where business activity is moving.
                </p>
              </header>

              <div className="grid lg:grid-cols-2">
                <Link
                  to="/admin/earnings"
                  className="focus-ring group flex min-h-[190px] flex-col justify-between border-t border-[#bed4ca] bg-[#cce7da] p-5 transition hover:bg-[#c3e1d3] sm:min-h-[220px] sm:p-6 lg:border-l lg:border-t-0 lg:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 text-[#145846]">
                      <IndianRupee size={17} aria-hidden="true" />
                      <p className="text-[9.6px] font-black uppercase tracking-[0.16em]">Money through EPANTRY</p>
                    </div>
                    <ArrowRight size={16} className="text-[#5f8f82] transition group-hover:translate-x-1 group-hover:text-[#145846]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[45.6px] font-black leading-none tracking-[-0.06em] text-stone-950 sm:text-[60px]">{formatMoney(earnings?.currentMonth?.grossCollectionsMinor)}</p>
                    <p className="mt-3 max-w-[420px] text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13.2px]">
                      This month · platform earnings inside this: {formatMoney(earnings?.currentMonth?.platformRevenueMinor)}
                    </p>
                  </div>
                </Link>

                <Link
                  to="/admin/search-demand"
                  className="focus-ring group flex min-h-[190px] flex-col justify-between border-t border-[#bdd2e2] bg-[#d5e8f4] p-5 transition hover:bg-[#cce3f1] sm:min-h-[220px] sm:p-6 lg:border-l lg:border-t-0 lg:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 text-[#15527a]">
                      <Search size={17} aria-hidden="true" />
                      <p className="text-[9.6px] font-black uppercase tracking-[0.16em]">Customer search demand</p>
                    </div>
                    <ArrowRight size={16} className="text-[#668da7] transition group-hover:translate-x-1 group-hover:text-[#15527a]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[45.6px] font-black leading-none tracking-[-0.06em] text-stone-950 sm:text-[60px]">{demand?.totalSearches ?? 0} searches</p>
                    <p className="mt-3 max-w-[420px] text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13.2px]">
                      Last 30 days · {demand?.topQuery?.query ? `top search: “${demand.topQuery.query}”` : 'search demand will appear as customers use EPANTRY search'}
                    </p>
                    {demand?.topArea ? (
                      <p className="mt-1 text-[10.8px] font-bold text-stone-500 sm:text-[12px]">Top area: {[demand.topArea.city, demand.topArea.state, demand.topArea.postcode].filter(Boolean).join(', ') || 'Area not available'}</p>
                    ) : null}
                  </div>
                </Link>
              </div>
            </div>
          </section>

          <section className="pt-1">
            <div className="mb-3 grid gap-2 border-y border-[#d7d0c5] py-3 sm:mb-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-3 sm:py-5">
              <div>
                <p className="text-[9.6px] font-black uppercase tracking-[0.18em] text-[#185442] sm:text-[10.8px]">Admin workspaces</p>
                <h2 className="mt-1.5 text-[25.2px] font-black leading-[1.02] tracking-[-0.04em] text-stone-950 sm:mt-2 sm:text-[37.2px] sm:leading-none">Open the right area. Keep every job separate.</h2>
              </div>
              <p className="max-w-[420px] text-[12px] font-semibold leading-5 text-stone-600 sm:text-right sm:text-[13.2px]">
                Reviews, catalog, business operations and governance are separated so each kind of work has a clear home.
              </p>
            </div>

            <div className="space-y-3 sm:space-y-5">
              {moduleGroups.map((group) => (
                <WorkspaceSection key={group.key} group={group} items={group.items} />
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-[#2d3632] bg-[#232a27] text-white">
            <div className="grid sm:grid-cols-[220px_minmax(0,1fr)]">
              <header className="border-b border-white/10 p-4 sm:border-b-0 sm:border-r sm:p-5">
                <p className="text-[9.6px] font-black uppercase tracking-[0.16em] text-[#a9cabd]">Admin safeguards</p>
                <h2 className="mt-2 text-[19.2px] font-black leading-5 text-white">Built into every control.</h2>
              </header>

              <div className="grid sm:grid-cols-3">
                {[
                  ['Secure sign-in', 'MFA protects sensitive admin actions.'],
                  ['Scoped access', 'Only approved admin controls are available.'],
                  ['Audit trail', 'Important admin decisions are recorded.'],
                ].map(([title, copy], index) => (
                  <article key={title} className={`flex items-start gap-3 p-4 sm:p-5 ${index ? 'border-t border-white/10 sm:border-l sm:border-t-0' : ''}`}>
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#9ac8b5]" aria-hidden="true" />
                    <div>
                      <h3 className="text-[12px] font-black leading-4 text-white sm:text-[13.2px]">{title}</h3>
                      <p className="mt-1 text-[10.8px] font-semibold leading-4 text-white/55 sm:text-[12px]">{copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {canReadAiQuality ? <AdminAiQualityPanel /> : null}
        </div>
      </div>
    </AdminShell>
  )

}
