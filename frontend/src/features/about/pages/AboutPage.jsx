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
    <main className="relative overflow-hidden bg-[#F8FAF7] py-12 sm:py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(22,101,52,0.10),transparent_25%),radial-gradient(circle_at_92%_44%,rgba(37,99,235,0.055),transparent_22%)]" />
      <div className="page-shell relative z-10">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-[34px] border border-emerald-200/70 bg-[linear-gradient(135deg,#FFFFFF_0%,#F3FAF5_55%,#ECFDF5_100%)] p-7 shadow-[0_24px_70px_rgba(22,101,52,0.09)] sm:p-9 lg:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-emerald-200/60 bg-emerald-100/45" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-blue-100/30 blur-3xl" />
          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                <Sparkles size={14} aria-hidden="true" />
                About EPANTRY
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-0.045em] text-stone-950 sm:text-5xl lg:text-6xl">
                Food discovery, shopping and everyday decisions — connected.
              </h1>

              <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-stone-600 sm:text-base">
                EPANTRY is designed to help you move from finding food to understanding it, buying it, cooking it and planning what comes next without treating each step as a separate app experience.
              </p>
            </div>

            <div className="rounded-[28px] border border-emerald-200 bg-white/90 p-6 shadow-[0_14px_40px_rgba(22,101,52,0.08)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Layers3 size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-black text-stone-950">One connected food ecosystem</p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">Grocery · Brands · Recipes · Pantry · Planning · Marketplace</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {['Discover', 'Understand', 'Act'].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-emerald-50 px-2 py-3 text-[11px] font-black text-emerald-800"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow="For customers"
            title="What you can do with EPANTRY"
            description="The customer experience goes beyond placing an order. It connects shopping with the food context you already have and the meals you actually want to make."
          />

          <CapabilityGrid items={customerCapabilities} />
        </section>

        <section className="mt-12">
          <SectionHeading
            eyebrow="Privacy and trust"
            title="Your data should make the product useful — not invisible to you"
            description="EPANTRY keeps privacy, security and marketplace governance as explicit parts of the product so customers can understand where their personal context and marketplace trust come from."
          />

          <CapabilityGrid items={customerPrivacy} />
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0C0A09_0%,#111827_100%)] p-7 text-white shadow-[0_20px_60px_rgba(17,24,39,0.14)] sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
              What makes EPANTRY different
            </p>

            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              It is not only about getting an item to your door.
            </h2>

            <p className="mt-4 text-sm leading-7 text-stone-400">
              EPANTRY connects governed product discovery, trusted brand context, recipes, Pantry awareness, household planning and shopping. The goal is to help you make better food decisions before, during and after a purchase — not simply make checkout faster.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                'Governed marketplace trust',
                'Recipes connected to shopping',
                'Pantry and planning context',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-stone-800 bg-stone-900 p-4 text-xs font-black leading-5 text-stone-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-[0_16px_46px_rgba(17,24,39,0.06)] sm:p-9">
            <ShieldCheck size={24} className="text-emerald-700" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black text-stone-950">Your controls</h2>
            <p className="mt-3 text-sm leading-6 text-stone-500">
              Review your account settings, security options and privacy controls whenever you need them. EPANTRY keeps these controls separate from product recommendations and marketplace browsing.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/account/settings"
                    className="focus-ring inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800"
                  >
                    Account Settings
                  </Link>

                  <Link
                    to="/account/privacy"
                    className="focus-ring inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-xs font-black text-stone-700 transition hover:bg-stone-50"
                  >
                    Privacy Rights Center
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="focus-ring inline-flex h-10 items-center justify-center rounded-full bg-emerald-700 px-4 text-xs font-black text-white transition hover:bg-emerald-800"
                  >
                    Create Account
                  </Link>

                  <Link
                    to="/login"
                    className="focus-ring inline-flex h-10 items-center justify-center rounded-full border border-stone-200 bg-white px-4 text-xs font-black text-stone-700 transition hover:bg-stone-50"
                  >
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
