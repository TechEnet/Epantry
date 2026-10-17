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

// Component-scoped Japandi palette. Use only the five senior-approved colors.
// Scoped styles protect this page from legacy universal color remaps.
const ABOUT_COLORS = {
  porcelain: '#F7F6F2',
  forest: '#173F35',
  charcoal: '#202421',
  sage: '#DCE0CF',
  clay: '#C86C42',
}

const ABOUT_STYLE = `
/* About Page - editorial Japandi, scoped to this page only. */
.ep-about {
  --ep-porcelain: ${ABOUT_COLORS.porcelain};
  --ep-forest: ${ABOUT_COLORS.forest};
  --ep-charcoal: ${ABOUT_COLORS.charcoal};
  --ep-sage: ${ABOUT_COLORS.sage};
  --ep-clay: ${ABOUT_COLORS.clay};
  background: var(--ep-porcelain) !important;
  color: var(--ep-charcoal) !important;
  font-family: 'Plus Jakarta Sans', Inter, sans-serif;
}
.ep-about :is(h1,h2,h3) {
  color: inherit !important;
  font-weight: 600 !important;
  letter-spacing: -.035em;
}
.ep-about h1 { font-size: 36px !important; line-height: 42px !important; }
.ep-about h2 { font-size: 28px !important; line-height: 36px !important; }
.ep-about h3 { font-size: 22px !important; line-height: 30px !important; }
.ep-about p { line-height: 1.6; }
.ep-about .ep-text { color: var(--ep-charcoal) !important; }
.ep-about .ep-muted { color: var(--ep-charcoal) !important; opacity: .83; }
.ep-about .ep-eyebrow {
  color: var(--ep-forest) !important;
  font-size: 14px !important;
  line-height: 21px !important;
  letter-spacing: .10em;
  font-weight: 600 !important;
}
.ep-about .ep-surface { background: var(--ep-porcelain) !important; color: var(--ep-charcoal) !important; }
.ep-about .ep-sage { background: var(--ep-sage) !important; color: var(--ep-charcoal) !important; }
.ep-about .ep-dark { background: var(--ep-porcelain) !important; color: var(--ep-charcoal) !important; }
.ep-about .ep-dark :is(h1,h2,h3,p,span) { color: var(--ep-charcoal) !important; }
.ep-about .ep-border, .ep-about .ep-line { border-color: var(--ep-forest) !important; }
.ep-about .ep-mark { color: var(--ep-forest) !important; }
.ep-about .ep-clay-mark { color: var(--ep-clay) !important; }

/* Buttons stay readable in light and tinted sections, without changing routes. */
.ep-about .ep-cta {
  background: var(--ep-forest) !important;
  border: 1px solid var(--ep-forest) !important;
  color: var(--ep-porcelain) !important;
}
.ep-about .ep-cta:hover { background: var(--ep-charcoal) !important; border-color: var(--ep-charcoal) !important; }
.ep-about .ep-outline {
  background: transparent !important;
  color: var(--ep-forest) !important;
  border: 1px solid var(--ep-forest) !important;
}
.ep-about .ep-outline:hover { background: var(--ep-sage) !important; }
.ep-about .ep-cta:focus-visible, .ep-about .ep-outline:focus-visible {
  outline: 3px solid var(--ep-clay);
  outline-offset: 3px;
}

/* Third concept: open porcelain-led hero with a strong Forest sidebar.
   Previous all-Forest hero and Sage-only panel are intentionally gone. */
.ep-about :is(.ep-hero-customer,.ep-hero-host,.ep-hero-admin) {
  background: var(--ep-porcelain) !important;
  color: var(--ep-charcoal) !important;
  border: 1px solid var(--ep-sage) !important;
  border-left: 6px solid var(--ep-clay) !important;
  border-radius: 18px !important;
  box-shadow: 0 14px 42px rgba(32,36,33,.055);
}
.ep-about :is(.ep-hero-customer,.ep-hero-host,.ep-hero-admin) :is(h1,h2,h3,p,span) {
  color: var(--ep-charcoal) !important;
}
.ep-about :is(.ep-hero-customer,.ep-hero-host,.ep-hero-admin) .ep-eyebrow {
  color: var(--ep-forest) !important;
}
.ep-about .ep-hero-customer .ep-hero-title span {
  color: var(--ep-clay) !important;
}
.ep-about :is(.ep-hero-customer,.ep-hero-host) .ep-muted {
  color: var(--ep-charcoal) !important;
  opacity: .83;
}
.ep-about .ep-hero-host .ep-text { color: var(--ep-charcoal) !important; }
.ep-about .ep-hero-steps {
  position: relative;
  align-self: stretch;
  background: var(--ep-forest) !important;
  color: var(--ep-porcelain) !important;
  border: none !important;
  border-radius: 16px;
  padding: 24px 27px;
  box-shadow: 0 16px 36px rgba(23,63,53,.15);
}
.ep-about .ep-hero-steps :is(h1,h2,h3,p,span) { color: var(--ep-porcelain) !important; }
.ep-about .ep-hero-steps .ep-eyebrow { color: var(--ep-sage) !important; }
.ep-about .ep-hero-steps .ep-mark { color: var(--ep-porcelain) !important; }
.ep-about .ep-hero-steps .ep-step-index { color: var(--ep-sage) !important; }
.ep-about .ep-hero-steps .ep-step-row { border-color: rgba(247,246,242,.24) !important; }

/* The content is editorial: airy dividers, no repeated bright cards. */
.ep-about .ep-capability-band {
  background: var(--ep-porcelain) !important;
  border-top: 2px solid var(--ep-clay) !important;
  padding-top: 25px;
}
.ep-about .ep-capability-band .ep-mark { color: var(--ep-forest) !important; }
.ep-about .ep-capability-row { border-color: rgba(23,63,53,.23) !important; }
.ep-about .ep-capability-row:hover { border-color: var(--ep-clay) !important; }
.ep-about .ep-feature-mark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: 12px;
  background: var(--ep-sage) !important;
  color: var(--ep-forest) !important;
}

/* Trust takes Sage instead of the previous heavy charcoal block. */
.ep-about .ep-privacy {
  background: var(--ep-sage) !important;
  color: var(--ep-charcoal) !important;
  border: none !important;
  border-radius: 18px !important;
  box-shadow: none !important;
}
.ep-about .ep-privacy :is(h1,h2,h3,p,span) { color: var(--ep-charcoal) !important; }
.ep-about .ep-privacy .ep-eyebrow, .ep-about .ep-privacy .ep-mark { color: var(--ep-forest) !important; }
.ep-about .ep-privacy .ep-privacy-row { border-color: rgba(23,63,53,.22) !important; }

/* Reverse the closing composition: bold Forest "Why", calm porcelain account CTA. */
.ep-about .ep-why {
  background: var(--ep-forest) !important;
  color: var(--ep-porcelain) !important;
  border: none !important;
  border-radius: 18px !important;
}
.ep-about .ep-why :is(h1,h2,h3,p,span) { color: var(--ep-porcelain) !important; opacity: 1 !important; }
.ep-about .ep-why .ep-eyebrow { color: var(--ep-sage) !important; }
.ep-about .ep-why .ep-text { color: var(--ep-porcelain) !important; }
.ep-about .ep-why div.border-t { border-color: rgba(247,246,242,.24) !important; }
.ep-about .ep-account-panel {
  background: var(--ep-porcelain) !important;
  color: var(--ep-charcoal) !important;
  border: 1px solid var(--ep-sage) !important;
  border-top: 4px solid var(--ep-clay) !important;
  border-radius: 18px !important;
}
.ep-about .ep-account-panel :is(h1,h2,h3,p,span) { color: var(--ep-charcoal) !important; }
.ep-about .ep-account-panel .ep-eyebrow { color: var(--ep-forest) !important; }
.ep-about .ep-account-panel svg { color: var(--ep-forest) !important; }

/* Host/Admin-specific shared layout stays intact, palette gets deliberate contrast. */
.ep-about .ep-host-trust {
  background: var(--ep-sage) !important;
  border: none !important;
  border-radius: 18px !important;
}
.ep-about .ep-host-trust .ep-mark { color: var(--ep-forest) !important; }
.ep-about .ep-admin-principles {
  background: var(--ep-sage) !important;
  border: none !important;
  border-left: 5px solid var(--ep-clay) !important;
  border-radius: 18px !important;
}
.ep-about .ep-admin-principles .ep-mark { color: var(--ep-forest) !important; }

@media (min-width: 1024px) {
  .ep-about h1 { font-size: 56px !important; line-height: 64px !important; }
  .ep-about h2 { font-size: 36px !important; line-height: 44px !important; }
  .ep-about h3 { font-size: 24px !important; line-height: 32px !important; }
  .ep-about .ep-hero-steps { padding: 31px 36px; }
}
@media (max-width: 639px) {
  .ep-about .ep-hero-steps { padding: 20px 21px; }
  .ep-about :is(.ep-hero-customer,.ep-hero-host,.ep-hero-admin) { border-left-width: 4px !important; }
}
`


function AboutHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-3xl">
      <p className="ep-eyebrow uppercase">{eyebrow}</p>
      <h2 className="mt-2">{title}</h2>
      {description ? <p className="ep-muted mt-3 max-w-3xl text-base">{description}</p> : null}
    </div>
  )
}

function AboutCapabilities({ items, numbered = false }) {
  return (
    <div className="mt-6 grid gap-x-7 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <article key={item.title} className="ep-text ep-capability-row min-w-0 border-t py-5" style={{ borderColor: 'rgba(23,63,53,.25)' }}>
            <div className="mb-4 flex items-center justify-between">
              <Icon className="ep-mark" size={25} aria-hidden="true" />
              {numbered ? <span className="ep-eyebrow">{String(index + 1).padStart(2, '0')}</span> : null}
            </div>
            <h3>{item.title}</h3>
            <p className="ep-muted mt-2 text-base">{item.description}</p>
          </article>
        )
      })}
    </div>
  )
}

function AboutLink({ to, children, outline = false }) {
  return (
    <Link to={to} className={`${outline ? 'ep-outline' : 'ep-cta'} focus-ring inline-flex min-h-12 w-fit items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition-colors`}>
      {children}
    </Link>
  )
}

function AboutPageBody({ children }) {
  return (
    <main className="ep-about min-w-0 overflow-x-clip py-6 sm:py-9 lg:py-12">
      <style>{ABOUT_STYLE}</style>
      <div className="page-shell"><div className="mx-auto max-w-7xl px-1 sm:px-3 lg:px-5">{children}</div></div>
    </main>
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

  const isSuperAdmin = superAdminEnabled === true
  const isPendingHost = hostAccessStatus === 'pending' && hostEnabled !== true
  const isHostView = !isSuperAdmin && (activeMode === 'host' || isPendingHost)
  const displayName = currentUser?.displayName || currentUser?.name || ''
  const hostStatusKnown = HOST_STATUSES.has(hostAccessStatus)

  if (isSuperAdmin) {
    return (
      <AboutPageBody>
        <section className="ep-dark ep-hero-admin relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="ep-eyebrow flex items-center gap-2 uppercase"><ShieldCheck size={18} aria-hidden="true" /> Super Admin</p>
              <h1 className="mt-4 max-w-4xl">EPANTRY governance control plane</h1>
              <p className="mt-4 max-w-2xl text-base">{displayName ? `${displayName}, ` : ''}your About view focuses on administrative authority: what can be reviewed, governed, approved, audited and monitored across EPANTRY.</p>
            </div>
            <AboutLink to="/admin">Open Admin Dashboard</AboutLink>
          </div>
        </section>

        <section className="ep-capability-band mt-12 sm:mt-16">
          <AboutHeading eyebrow="Administrative capabilities" title="What Super Admin can control" description="EPANTRY keeps governance responsibilities explicit so operational power is separated into reviewable administrative domains." />
          <AboutCapabilities items={adminCapabilities} numbered />
        </section>

        <section className="ep-sage ep-admin-principles mt-9 grid gap-6 rounded-3xl px-6 py-7 sm:px-9 sm:py-10 lg:grid-cols-3">
          {[
            { icon: KeyRound, title: 'Permission-scoped authority', description: 'Administrative access is enforced by backend authority and permissions. A visible dashboard is not treated as the source of authorization.' },
            { icon: LockKeyhole, title: 'Security before privileged actions', description: 'Administrative surfaces can require stronger authentication assurance so privileged workflows stay separate from ordinary account convenience.' },
            { icon: FileClock, title: 'Traceable governance', description: 'Audit, history and governance records help preserve who changed what and where review is still required.' },
          ].map(({ icon: Icon, title, description }) => (
            <article className="min-w-0" key={title}>
              <Icon className="ep-mark mb-4" size={25} aria-hidden="true" />
              <h3>{title}</h3>
              <p className="ep-muted mt-2 text-base">{description}</p>
            </article>
          ))}
        </section>
      </AboutPageBody>
    )
  }

  if (isHostView) {
    return (
      <AboutPageBody>
        <section className="ep-dark ep-hero-host rounded-3xl px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="ep-eyebrow flex items-center gap-2 uppercase"><Store size={18} aria-hidden="true" /> Host / Seller / Brand / B2B</p>
              <h1 className="mt-4 max-w-4xl">Build trust before you build volume</h1>
              <p className="ep-muted mt-4 max-w-2xl text-base">EPANTRY gives Hosts a governed operating workspace for listings, brand authority, marketplace operations and fulfillment while keeping the customer-facing experience connected to the same trusted ecosystem.</p>
              {hostStatusKnown ? <p className="ep-text mt-4 inline-flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="ep-mark" size={18} aria-hidden="true" /> Host access status: {hostAccessStatus.replaceAll('_', ' ')}</p> : null}
            </div>
            <AboutLink to={hostEnabled ? '/host/operations' : '/dashboard'}>{hostEnabled ? 'Open Host Dashboard' : 'Open Account Dashboard'}</AboutLink>
          </div>
        </section>
        <section className="ep-capability-band mt-12 sm:mt-16">
          <AboutHeading eyebrow="Host workspace" title="What EPANTRY gives you as a Host" description="The Host experience is designed around controlled marketplace participation, not just a form for uploading products." />
          <AboutCapabilities items={hostCapabilities} numbered />
        </section>
        <section className="ep-sage ep-host-trust mt-12 rounded-3xl px-6 py-8 sm:px-9 sm:py-10">
          <AboutHeading eyebrow="Trust and responsibility" title="How Host participation stays reliable" description="The same marketplace that gives Hosts reach also carries review, history and authority checks so customer trust is not separated from seller operations." />
          <AboutCapabilities items={hostPrinciples} numbered />
        </section>
        <section className="ep-dark ep-account-panel mt-11 rounded-3xl px-6 py-9 sm:px-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="ep-eyebrow uppercase">One identity, controlled capabilities</p>
              <h2 className="mt-2">Host access does not erase your Customer experience.</h2>
              <p className="mt-3 max-w-3xl text-base">Approved Hosts can switch between Customer and Host experiences where their account allows it. The switch changes presentation; backend access rules still decide what the account is authorized to do.</p>
            </div>
            <AboutLink to="/account/settings">Account Settings</AboutLink>
          </div>
        </section>
      </AboutPageBody>
    )
  }

  return (
    <AboutPageBody>
      <section aria-labelledby="about-intro-title" className="ep-dark ep-hero-customer relative overflow-hidden rounded-3xl px-6 py-10 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <p className="ep-eyebrow uppercase">About EPANTRY</p>
            <h1 id="about-intro-title" className="ep-hero-title mt-4 max-w-3xl">
              Food made simple.<span className="block">Life made easier.</span>
            </h1>
            <p className="ep-muted mt-5 text-base">Shop, cook and plan. All in one place.</p>
          </div>
          <div className="ep-hero-steps min-w-0">
            <p className="ep-eyebrow mb-2 uppercase">How it connects</p>
            {[
              { label: 'Discover', icon: ShoppingBasket },
              { label: 'Understand', icon: ScanLine },
              { label: 'Cook', icon: BookOpenCheck },
              { label: 'Plan', icon: Boxes },
            ].map(({ label, icon: Icon }, index) => (
              <div key={label} className="ep-step-row flex items-center gap-4 border-b py-3 last:border-b-0">
                <span className="ep-step-index ep-eyebrow w-7 shrink-0 tabular-nums">0{index + 1}</span>
                <span className="ep-text min-w-0 flex-1 text-lg font-semibold">{label}</span>
                <Icon className="ep-mark shrink-0" size={21} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ep-capability-band mt-12 sm:mt-16" aria-labelledby="about-customer-title">
        <p className="ep-eyebrow uppercase">01 / Everyday EPANTRY</p>
        <h2 id="about-customer-title" className="mt-2">Everything food, connected.</h2>
        <div className="mt-7 grid gap-x-6 gap-y-0 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Shop smarter', icon: ShoppingBasket },
            { title: 'Find recipes', icon: BookOpenCheck },
            { title: 'Know your Pantry', icon: Boxes },
            { title: 'Understand products', icon: ScanLine },
          ].map(({ title, icon: Icon }, index) => (
            <div key={title} className="flex items-center gap-4 border-t py-5 lg:items-start lg:flex-col" style={{ borderColor: 'rgba(23,63,53,.25)' }}>
              <span className="ep-feature-mark"><Icon className="ep-mark" size={24} aria-hidden="true" /></span>
              <div><span className="ep-eyebrow">0{index + 1}</span><h3 className="mt-1">{title}</h3></div>
            </div>
          ))}
        </div>
      </section>

      <section className="ep-privacy mt-12 rounded-3xl px-6 py-8 sm:px-9 sm:py-10 lg:px-12" aria-labelledby="about-trust-title">
        <div className="grid gap-7 lg:grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)] lg:gap-12">
          <div>
            <p className="ep-eyebrow uppercase">02 / Privacy & trust</p>
            <h2 id="about-trust-title" className="mt-2">Your data. Your choice.</h2>
          </div>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {[
              { title: 'Clear privacy controls', icon: LockKeyhole },
              { title: 'Useful, optional context', icon: DatabaseZap },
              { title: 'Secure account access', icon: ShieldCheck },
              { title: 'Reviewed marketplace listings', icon: BadgeCheck },
            ].map(({ title, icon: Icon }) => (
              <div key={title} className="ep-privacy-row flex items-center gap-3 border-t py-5">
                <Icon className="ep-mark shrink-0" size={23} aria-hidden="true" /><h3>{title}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-11 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]" aria-label="Why EPANTRY and account options">
        <article className="ep-sage ep-why min-w-0 rounded-3xl px-6 py-9 sm:px-9">
          <p className="ep-eyebrow uppercase">03 / Why EPANTRY</p>
          <h2 className="mt-2">More than a shopping app.</h2>
          <div className="mt-5">
            {['Trusted products & brands', 'Recipes connected to shopping', 'Pantry & meal planning'].map((item, index) => (
              <div key={item} className="flex items-center gap-4 border-t py-3" style={{ borderColor: 'rgba(23,63,53,.22)' }}>
                <span className="ep-eyebrow w-7 shrink-0">0{index + 1}</span>
                <p className="ep-text text-base font-semibold">{item}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="ep-dark ep-account-panel flex min-w-0 flex-col rounded-3xl px-6 py-9 sm:px-9">
          <ShieldCheck size={26} aria-hidden="true" className="mb-4" />
          <h2>{isAuthenticated ? 'Your account. Your control.' : 'Ready to join EPANTRY?'}</h2>
          <div className="mt-auto flex flex-wrap gap-3 pt-7">
            {isAuthenticated ? (
              <><AboutLink to="/account/settings">Account Settings</AboutLink><AboutLink to="/account/privacy" outline>Privacy Rights Center</AboutLink></>
            ) : (
              <><AboutLink to="/register">Create Account</AboutLink><AboutLink to="/login" outline>Login</AboutLink></>
            )}
          </div>
        </article>
      </section>
    </AboutPageBody>
  )
}
