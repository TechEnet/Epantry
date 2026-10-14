import {
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileClock,
  HeartHandshake,
  KeyRound,
  Layers3,
  LockKeyhole,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

const HOST_STATUSES = new Set([
  'pending',
  'active',
  'suspended',
  'rejected',
])

const customerCapabilities = [
  {
    icon: ShoppingBasket,
    title: 'Shop with more context',
    description: 'Browse Grocery and Brands with product, pricing and marketplace information kept connected instead of treating every purchase as an isolated order.',
  },
  {
    icon: BookOpenCheck,
    title: 'Turn recipes into action',
    description: 'Discover recipes, understand what they need, connect them to your Pantry and move naturally from cooking inspiration to the next useful basket.',
  },
  {
    icon: Boxes,
    title: 'Use your Pantry intelligently',
    description: 'Keep track of what you already have, what may be running low and what should be used soon so planning can start from your real household context.',
  },
  {
    icon: ScanLine,
    title: 'Scan and understand products',
    description: 'Use EPANTRY product intelligence and passports where available to move beyond a simple product tile and understand the item you are considering.',
  },
]

const customerPrivacy = [
  {
    icon: LockKeyhole,
    title: 'Privacy controls stay visible',
    description: 'Your account includes dedicated privacy controls for governed data export and deletion requests rather than hiding those choices inside unrelated settings.',
  },
  {
    icon: DatabaseZap,
    title: 'Optional context is purposeful',
    description: 'Household, Pantry, purchase-source and planning context is used to make EPANTRY more useful to you. Optional sources remain separate from the core shopping experience.',
  },
  {
    icon: LockKeyhole,
    title: 'Account security is separated from convenience',
    description: 'Authentication, security settings and MFA controls are handled as account protections, while food preferences and marketplace activity remain product context.',
  },
  {
    icon: ShieldCheck,
    title: 'Catalog trust is governed',
    description: 'EPANTRY is designed around governed listings, brand authority and review workflows so customers are not expected to judge every marketplace claim on their own.',
  },
]

const hostCapabilities = [
  {
    icon: Store,
    title: 'Operate one Host workspace',
    description: 'Manage the Host side of EPANTRY for product listings, business operations and marketplace participation without creating a separate consumer identity.',
  },
  {
    icon: PackageCheck,
    title: 'Build governed listings',
    description: 'Create and maintain catalog or marketplace information while EPANTRY keeps approval, authority and listing-history responsibilities separate from simple editing.',
  },
  {
    icon: BadgeCheck,
    title: 'Work with brand authority',
    description: 'Brand relationships, product ownership signals and marketplace presence can be handled through the existing Host and Brand authority workflows.',
  },
  {
    icon: Layers3,
    title: 'Connect operations to fulfillment',
    description: 'Orders, fulfillment, business profile, analytics and supported hospitality workflows live in the same ecosystem as the products customers eventually discover.',
  },
]

const hostPrinciples = [
  {
    icon: ClipboardCheck,
    title: 'Approval is part of the model',
    description: 'Host access and governed marketplace content can require review. This protects the quality of the shared marketplace instead of treating every submission as automatically trusted.',
  },
  {
    icon: FileClock,
    title: 'Changes keep history',
    description: 'EPANTRY includes listing and governance history so important marketplace changes can be reviewed rather than disappearing behind the latest edit.',
  },
  {
    icon: UsersRound,
    title: 'Customer and Host modes remain distinct',
    description: 'An approved Host can still use Customer capabilities. The mode switch changes the experience you are using, not the underlying authorization rules.',
  },
  {
    icon: LockKeyhole,
    title: 'Your account still has privacy controls',
    description: 'Host capability does not replace your personal account controls. Security, account settings and governed privacy requests remain separate from business operations.',
  },
]

const adminCapabilities = [
  {
    icon: UserRoundCheck,
    title: 'Host access governance',
    description: 'Review Host applications, approve or restrict access and manage the lifecycle of marketplace operators.',
  },
  {
    icon: PackageCheck,
    title: 'Catalog and listing governance',
    description: 'Review products, ingredients, listing changes and evidence-backed marketplace information across the governed catalog.',
  },
  {
    icon: BadgeCheck,
    title: 'Brand authority',
    description: 'Review brand claims, authority evidence and brand-content governance before those signals become trusted marketplace context.',
  },
  {
    icon: BookOpenCheck,
    title: 'Recipe governance',
    description: 'Manage recipe review, publishing and food-intelligence connections while preserving the separation between editorial content and governed evidence.',
  },
  {
    icon: HeartHandshake,
    title: 'Marketplace and trust operations',
    description: 'Oversee marketplace operations, escalations and trust-and-safety workflows that need administrative review.',
  },
  {
    icon: KeyRound,
    title: 'Roles and permissions',
    description: 'Control administrative authority through permission-scoped access rather than relying on a single visual admin mode.',
  },
  {
    icon: FileClock,
    title: 'Audit and history',
    description: 'Inspect audit records, listing history and governance events so important administrative actions remain traceable.',
  },
  {
    icon: BarChart3,
    title: 'Analytics and observability',
    description: 'Use administrative analytics, operational signals and approved observability surfaces to understand platform health and governance workload.',
  },
]

function CapabilityGrid({
  items,
  accent = 'green',
}) {
  const accentClasses =
    accent === 'orange'
      ? 'bg-amber-50 text-amber-700'
      : accent === 'slate'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-emerald-50 text-emerald-700'

  return (
    <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon

        return (
          <article
            key={item.title}
            className="group relative overflow-hidden rounded-[28px] border border-stone-200/90 bg-white/95 p-6 shadow-[0_8px_30px_rgba(17,24,39,0.045)] transition-all duration-300 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_18px_44px_rgba(17,24,39,0.09)]"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-current opacity-[0.035]" />

            <div className={`relative grid size-12 place-items-center rounded-2xl ring-1 ring-black/[0.03] transition-transform duration-300 group-hover:scale-105 ${accentClasses}`}>
              <Icon size={20} aria-hidden="true" />
            </div>

            <h3 className="relative mt-5 text-[17px] font-black tracking-[-0.015em] text-stone-950">
              {item.title}
            </h3>

            <p className="relative mt-2.5 text-sm leading-6 text-stone-500">
              {item.description}
            </p>
          </article>
        )
      })}
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}) {
  return (
    <div className="max-w-4xl">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-stone-950 sm:text-4xl">
        {title}
      </h2>

      {description ? (
        <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-stone-600 sm:text-[15px]">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export default function AboutPage() {
  const {
    currentUser,
    isAuthenticated,
    activeMode,
    hostEnabled,
    hostAccessStatus,
    superAdminEnabled,
  } = useAuth()

  const isSuperAdmin =
    superAdminEnabled === true

  const isPendingHost =
    hostAccessStatus === 'pending' &&
    hostEnabled !== true

  const isHostView =
    !isSuperAdmin &&
    (
      activeMode === 'host' ||
      isPendingHost
    )

  const displayName =
    currentUser?.displayName ||
    currentUser?.name ||
    ''

  const hostStatusKnown =
    HOST_STATUSES.has(
      hostAccessStatus,
    )

  if (isSuperAdmin) {
    return (
      <main className="relative overflow-hidden bg-[#F8FAF7] py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(51,65,85,0.08),transparent_24%),radial-gradient(circle_at_88%_32%,rgba(51,65,85,0.06),transparent_22%)]" />
        <div className="page-shell relative z-10">
        <div className="mx-auto max-w-7xl">
          <section className="relative overflow-hidden rounded-[34px] border border-slate-800 bg-[linear-gradient(135deg,#0F172A_0%,#111827_58%,#1E293B_100%)] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:p-9 lg:p-12">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-white/10 bg-white/[0.035]" />
            <div className="pointer-events-none absolute -bottom-28 right-1/4 size-64 rounded-full bg-slate-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
                  <ShieldCheck size={14} aria-hidden="true" />
                  Super Admin
                </div>

                <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                  EPANTRY governance control plane
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
                  {displayName ? `${displayName}, ` : ''}your About view focuses on administrative authority: what can be reviewed, governed, approved, audited and monitored across EPANTRY.
                </p>
              </div>

              <Link
                to="/admin"
                className="focus-ring inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-black text-slate-950 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                Open Admin Dashboard
              </Link>
            </div>
          </section>

          <section className="mt-12">
            <SectionHeading
              eyebrow="Administrative capabilities"
              title="What Super Admin can control"
              description="EPANTRY keeps governance responsibilities explicit so operational power is separated into reviewable administrative domains."
            />

            <CapabilityGrid
              items={adminCapabilities}
              accent="slate"
            />
          </section>

          <section className="mt-12 grid gap-5 lg:grid-cols-3">
            <article className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_10px_34px_rgba(17,24,39,0.05)]">
              <KeyRound className="text-slate-700" size={22} aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-stone-950">Permission-scoped authority</h2>
              <p className="relative mt-2.5 text-sm leading-6 text-stone-500">
                Administrative access is enforced by backend authority and permissions. A visible dashboard is not treated as the source of authorization.
              </p>
            </article>

            <article className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_10px_34px_rgba(17,24,39,0.05)]">
              <LockKeyhole className="text-slate-700" size={22} aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-stone-950">Security before privileged actions</h2>
              <p className="relative mt-2.5 text-sm leading-6 text-stone-500">
                Administrative surfaces can require stronger authentication assurance so privileged workflows stay separate from ordinary account convenience.
              </p>
            </article>

            <article className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-[0_10px_34px_rgba(17,24,39,0.05)]">
              <FileClock className="text-slate-700" size={22} aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-stone-950">Traceable governance</h2>
              <p className="relative mt-2.5 text-sm leading-6 text-stone-500">
                Audit, history and governance records help preserve who changed what and where review is still required.
              </p>
            </article>
          </section>
        </div>
        </div>
      </main>
    )
  }

  if (isHostView) {
    return (
      <main className="relative overflow-hidden bg-[#F8FAF7] py-12 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(245,158,11,0.10),transparent_24%),radial-gradient(circle_at_92%_36%,rgba(22,101,52,0.07),transparent_24%)]" />
        <div className="page-shell relative z-10">
        <div className="mx-auto max-w-7xl">
          <section className="relative overflow-hidden rounded-[34px] border border-amber-200/80 bg-[linear-gradient(135deg,#FFFDF5_0%,#FFF7E3_56%,#F8FAF7_100%)] p-7 shadow-[0_24px_70px_rgba(120,53,15,0.09)] sm:p-9 lg:p-12">
            <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-amber-200/70 bg-amber-100/55" />
            <div className="pointer-events-none absolute -bottom-24 right-1/4 size-64 rounded-full bg-emerald-200/25 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-800">
                  <Store size={14} aria-hidden="true" />
                  Host / Seller / Brand / B2B
                </div>

                <h1 className="mt-6 text-4xl font-black tracking-[-0.045em] text-stone-950 sm:text-5xl lg:text-6xl">
                  Build trust before you build volume
                </h1>

                <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-stone-600 sm:text-base">
                  EPANTRY gives Hosts a governed operating workspace for listings, brand authority, marketplace operations and fulfillment while keeping the customer-facing experience connected to the same trusted ecosystem.
                </p>

                {hostStatusKnown ? (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-900">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Host access status: {hostAccessStatus.replaceAll('_', ' ')}
                  </div>
                ) : null}
              </div>

              <Link
                to={hostEnabled ? '/host/operations' : '/dashboard'}
                className="focus-ring inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-6 text-sm font-black text-stone-950 shadow-lg shadow-amber-900/10 transition hover:-translate-y-0.5 hover:bg-amber-400"
              >
                {hostEnabled ? 'Open Host Dashboard' : 'Open Account Dashboard'}
              </Link>
            </div>
          </section>

          <section className="mt-12">
            <SectionHeading
              eyebrow="Host workspace"
              title="What EPANTRY gives you as a Host"
              description="The Host experience is designed around controlled marketplace participation, not just a form for uploading products."
            />

            <CapabilityGrid
              items={hostCapabilities}
              accent="orange"
            />
          </section>

          <section className="mt-12">
            <SectionHeading
              eyebrow="Trust and responsibility"
              title="How Host participation stays reliable"
              description="The same marketplace that gives Hosts reach also carries review, history and authority checks so customer trust is not separated from seller operations."
            />

            <CapabilityGrid
              items={hostPrinciples}
              accent="orange"
            />
          </section>

          <section className="relative mt-12 overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0C0A09_0%,#111827_100%)] p-7 text-white shadow-[0_20px_60px_rgba(17,24,39,0.14)] sm:p-9">
            <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border border-amber-400/10 bg-amber-400/[0.04]" />
            <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-400">
                  One identity, controlled capabilities
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Host access does not erase your Customer experience.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-400">
                  Approved Hosts can switch between Customer and Host experiences where their account allows it. The switch changes presentation; backend access rules still decide what the account is authorized to do.
                </p>
              </div>

              <Link
                to="/account/settings"
                className="focus-ring inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-stone-950 transition hover:bg-stone-100"
              >
                Account Settings
              </Link>
            </div>
          </section>
        </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-w-0 overflow-x-clip bg-[#F8F9F6] pb-10 text-[#18372D] sm:pb-14">
      <div className="page-shell">
        <div className="mx-auto max-w-7xl px-1 sm:px-3 lg:px-5">
          {/* Public About hero: a light introduction with four short steps. */}
          <section
            aria-labelledby="about-intro-title"
            className="relative isolate mt-3 overflow-hidden rounded-[24px] border border-[#D6E5D9] bg-[#EAF3EC] sm:mt-5 sm:rounded-[30px]"
          >
            <div className="relative grid gap-8 px-5 py-8 sm:px-9 sm:py-12 lg:grid-cols-[minmax(0,1.14fr)_minmax(300px,0.86fr)] lg:items-center lg:gap-16 lg:px-12 lg:py-16">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[#276B4B]">
                  <span className="size-2 rounded-full bg-[#3A9267]" aria-hidden="true" />
                  About EPANTRY
                </p>
                <h1 id="about-intro-title" className="mt-5 max-w-[720px] text-[clamp(2.4rem,5vw,5rem)] font-extrabold leading-[1.07] tracking-[-0.055em] text-[#133E2D]">
                  Food made <span className="text-[#358560]">simple.</span>
                  <span className="block">Life made easier.</span>
                </h1>
                <p className="mt-5 text-[16px] font-medium leading-6 text-[#406554] sm:text-[18px]">
                  Shop, cook and plan. All in one place.
                </p>
              </div>

              <div className="min-w-0 border-t border-[#CBDDD0] pt-3 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-0">
                <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.13em] text-[#397353]">How it connects</p>
                {[
                  { number: '01', label: 'Discover', icon: ShoppingBasket },
                  { number: '02', label: 'Understand', icon: ScanLine },
                  { number: '03', label: 'Cook', icon: BookOpenCheck },
                  { number: '04', label: 'Plan', icon: Boxes },
                ].map(({ number, label, icon: Icon }) => (
                  <div key={number} className="flex items-center gap-4 border-b border-[#CBDDD0] py-3 last:border-b-0 sm:py-4">
                    <span className="w-7 shrink-0 text-[12px] font-semibold tabular-nums text-[#6B9D7D]">{number}</span>
                    <span className="min-w-0 flex-1 text-[19px] font-bold tracking-[-0.025em] text-[#183E2F] sm:text-[21px]">{label}</span>
                    <Icon size={20} className="shrink-0 text-[#388461]" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Capability names are sufficient here: no repeated descriptions. */}
          <section aria-labelledby="about-customer-title" className="py-11 sm:py-14 lg:py-16">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-7">
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#2E7F5A]">01 / Everyday EPANTRY</p>
                <h2 id="about-customer-title" className="mt-2 text-[clamp(1.85rem,3.5vw,3.1rem)] font-extrabold leading-[1.12] tracking-[-0.045em] text-[#19382C]">
                  Everything food, connected.
                </h2>
              </div>
              <span className="hidden h-px flex-1 bg-[#D5DED6] sm:block" aria-hidden="true" />
            </div>
            <div className="mt-7 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
              {[
                { title: 'Shop smarter', icon: ShoppingBasket },
                { title: 'Find recipes', icon: BookOpenCheck },
                { title: 'Know your Pantry', icon: Boxes },
                { title: 'Understand products', icon: ScanLine },
              ].map(({ title, icon: Icon }, index) => (
                <div key={title} className="flex min-w-0 items-center gap-4 border-t border-[#D0DBD2] py-5 sm:items-start sm:gap-3 lg:flex-col lg:py-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[#E3EDE5] text-[#2E7552]">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 lg:mt-2">
                    <span className="mb-1 hidden text-[12px] font-semibold tabular-nums text-[#92A49A] lg:block">0{index + 1}</span>
                    <h3 className="text-[17px] font-bold leading-6 tracking-[-0.025em] text-[#203D31] sm:text-[18px]">{title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Trust is a quiet band, with short labels rather than explanatory cards. */}
          <section aria-labelledby="about-trust-title" className="rounded-[24px] bg-[#EFF2EF] px-5 py-8 sm:rounded-[28px] sm:px-9 sm:py-11 lg:px-12">
            <div className="grid gap-7 lg:grid-cols-[minmax(230px,0.78fr)_minmax(0,1.22fr)] lg:gap-12">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#487057]">02 / Privacy & trust</p>
                <h2 id="about-trust-title" className="mt-3 text-[clamp(1.85rem,3.2vw,3rem)] font-extrabold leading-[1.14] tracking-[-0.04em] text-[#263D30]">
                  Your data. Your choice.
                </h2>
              </div>
              <div className="grid min-w-0 gap-x-6 sm:grid-cols-2">
                {[
                  { title: 'Clear privacy controls', icon: LockKeyhole },
                  { title: 'Useful, optional context', icon: DatabaseZap },
                  { title: 'Secure account access', icon: ShieldCheck },
                  { title: 'Reviewed marketplace listings', icon: BadgeCheck },
                ].map(({ title, icon: Icon }) => (
                  <div key={title} className="flex min-w-0 items-center gap-3 border-t border-[#D4DED7] py-4.5 sm:py-5">
                    <Icon size={21} className="shrink-0 text-[#3E795A]" aria-hidden="true" />
                    <h3 className="text-[16px] font-semibold leading-6 text-[#263D30]">{title}</h3>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* A compact difference statement, then the same working account actions. */}
          <section aria-label="Why EPANTRY and account options" className="grid gap-5 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <article className="min-w-0 rounded-[24px] bg-[#F2F2EB] px-5 py-8 sm:rounded-[28px] sm:px-9 sm:py-10">
              <p className="text-[12px] font-bold uppercase tracking-[0.13em] text-[#5B745F]">03 / Why EPANTRY</p>
              <h2 className="mt-3 max-w-[520px] text-[clamp(1.85rem,3vw,2.8rem)] font-extrabold leading-[1.14] tracking-[-0.045em] text-[#283C30]">
                More than a shopping app.
              </h2>
              <div className="mt-7 grid gap-0 divide-y divide-[#E8D3B7] border-y border-[#D7DED3]">
                {[
                  'Trusted products & brands',
                  'Recipes connected to shopping',
                  'Pantry & meal planning',
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-4 py-3.5">
                    <span className="w-6 shrink-0 text-[12px] font-bold text-[#7B9A81]">0{index + 1}</span>
                    <p className="text-[15px] font-semibold leading-6 text-[#354A3A]">{item}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="flex min-w-0 flex-col rounded-[24px] border border-[#D6E5DB] bg-white px-5 py-8 sm:rounded-[28px] sm:px-9 sm:py-10">
              <div className="grid size-11 place-items-center rounded-[13px] bg-[#E6F3E9] text-[#287653]">
                <ShieldCheck size={23} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-[clamp(1.85rem,2.6vw,2.6rem)] font-extrabold leading-[1.15] tracking-[-0.04em] text-[#203D31]">
                {isAuthenticated ? 'Your account. Your control.' : 'Ready to join EPANTRY?'}
              </h2>
              <div className="mt-auto flex flex-col gap-3 pt-7 sm:flex-row sm:flex-wrap">
                {isAuthenticated ? (
                  <>
                    <Link to="/account/settings" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-[#215D42] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#164930]">
                      Account Settings
                    </Link>
                    <Link to="/account/privacy" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full border border-[#BCD4C4] px-6 text-[14px] font-bold text-[#215D42] transition-colors hover:bg-[#F1F8F2]">
                      Privacy Rights Center
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full bg-[#215D42] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#164930]">
                      Create Account
                    </Link>
                    <Link to="/login" className="focus-ring inline-flex min-h-12 items-center justify-center rounded-full border border-[#BCD4C4] px-6 text-[14px] font-bold text-[#215D42] transition-colors hover:bg-[#F1F8F2]">
                      Login
                    </Link>
                  </>
                )}
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  )
}
