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
  'Catalog & listings',
  'Recipes',
  'Ingredient library',
  'Food Intelligence',
  'People & businesses',
  'Analytics & customer demand',
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
    title: 'Reviews & approvals',
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
    title: 'Catalog & content',
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
    title: 'Business operations',
    description: 'Demand, money, people and operational infrastructure that keep the marketplace running.',
    mobileDescription: 'Demand, money, people & ops.',
    shell: 'border-[#abcde5] bg-[#e5f1f9]',
    intro: 'bg-[#1b587c] text-white',
    line: 'border-[#c0d9ea]',
    icon: 'text-[#1b587c]',
    meta: 'text-[#376b88]',
    titles: [
      'Analytics & customer demand',
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
    title: 'Governance & access',
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
    title: 'Review alerts',
    copy: 'Start with reviews, Host approvals and operational exceptions that need a decision.',
    mobileCopy: 'Reviews and approvals first.',
    icon: FileWarning,
  },
  {
    number: '02',
    title: 'Check demand',
    copy: 'Use search demand to understand which products and recipes people are looking for by area.',
    mobileCopy: 'See customer demand by area.',
    icon: Search,
  },
  {
    number: '03',
    title: 'Review finances',
    copy: 'Review platform earnings, subscriptions, paid placements and money collected through checkout.',
    mobileCopy: 'Check money and payouts.',
    icon: IndianRupee,
  },
  {
    number: '04',
    title: 'Choose a tool',
    copy: 'Move into catalog, Hosts, safety, finance or permissions only when that area needs action.',
    mobileCopy: 'Open the right admin tool.',
    icon: ShieldCheck,
  },
]

const superAdminStyles = String.raw`
/* Dashboard-scoped styling. Mirrors the approved Host palette without global overrides. */
.sad-page {--sad-green:#173F35;--sad-dark:#10382F;--sad-sage:#DCE0CF;--sad-cream:#F7F6F2;--sad-clay:#C86C42;--sad-ink:#202421;--sad-muted:#53645B;--sad-line:#D8DFD6;background:var(--sad-cream);color:var(--sad-ink);font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;font-size:16px;line-height:1.5;min-width:0;padding:clamp(12px,1.75vw,28px) clamp(12px,1.75vw,28px) 34px}
.sad-page *, .sad-page *::before, .sad-page *::after {box-sizing:border-box}
.sad-page a {text-decoration:none}
.sad-page button {font:inherit}
.sad-page button:focus-visible,.sad-page a:focus-visible,.sad-page summary:focus-visible {outline:3px solid var(--sad-clay);outline-offset:3px}
.sad-kicker {margin:0;display:flex;align-items:center;gap:9px;color:#AB5633;font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
.sad-kicker::before {content:'';width:23px;height:2px;flex:none;background:currentColor}
.sad-kicker--light {color:#F5B99C}
.sad-title {margin:6px 0 0;color:var(--sad-green)!important;font-size:clamp(26px,2.35vw,35px)!important;font-weight:850!important;letter-spacing:-.045em;line-height:1.16!important}
.sad-sub {margin:7px 0 0;color:#5F6C62;font-size:15px;line-height:1.5}
.sad-hero {display:grid;grid-template-columns:minmax(0,1.48fr) minmax(335px,.95fr);overflow:hidden;border-radius:15px;border:1px solid #CCD8CE;background:#E9EEE6}
.sad-hero-main {background:linear-gradient(115deg,#10382F,#194B3D);padding:clamp(24px,3vw,41px);min-width:0;display:flex;flex-direction:column;justify-content:space-between;min-height:265px}
.sad-hero-eyebrow {display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.sad-role {padding:4px 10px;border:1px solid #ffffff36;border-radius:100px;color:#E4F0E8;background:#ffffff13;font-size:12px;font-weight:750}
.sad-hero h1 {margin:12px 0 0;max-width:660px;color:#FFFEFA!important;font-size:clamp(32px,3.5vw,52px)!important;line-height:1.12!important;letter-spacing:-.052em;font-weight:850!important}
.sad-hero-desc {margin:12px 0 0;color:#E0EAE3;font-size:16px;line-height:1.58;max-width:590px}
.sad-hero-foot {display:flex;align-items:center;flex-wrap:wrap;gap:9px 18px;margin-top:24px;border-top:1px solid #ffffff24;padding-top:15px;color:#D7E7DC;font-size:13px;font-weight:650}
.sad-hero-foot strong {font-size:17px;color:white;font-weight:850}
.sad-hero-side {padding:clamp(20px,2.25vw,31px);border-left:4px solid var(--sad-clay);display:flex;flex-direction:column;justify-content:center}
.sad-hero-side h2 {margin:7px 0 12px;font-size:clamp(21px,1.8vw,27px)!important;line-height:1.2!important;color:var(--sad-green)!important;letter-spacing:-.04em;font-weight:850!important}
.sad-flow {display:grid;grid-template-columns:1fr 1fr;gap:0 15px}
.sad-step {display:flex;min-width:0;gap:9px;align-items:flex-start;padding:11px 0;border-top:1px solid #CFD9CD}
.sad-step-number {font-size:13px;font-weight:850;color:#B45A35;flex:none;margin-top:1px}
.sad-step-name {font-size:14.5px;font-weight:800;color:var(--sad-green);line-height:1.3}
.sad-step-desc {font-size:12.5px;line-height:1.4;color:#59685D;margin-top:3px}
.sad-section {margin-top:clamp(25px,2.5vw,35px);min-width:0}
.sad-section-head {display:flex;align-items:end;justify-content:space-between;flex-wrap:wrap;gap:10px 18px;margin-bottom:14px}
.sad-metrics {border:1px solid #D3DDD2;border-top:3px solid var(--sad-clay);border-radius:12px;overflow:hidden;background:#FFFEFB;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.sad-metric {position:relative;min-width:0;padding:18px 21px;display:flex;align-items:center;gap:14px;border-right:1px solid #E1E6DE;border-bottom:1px solid #E1E6DE;color:var(--sad-green);transition:background .18s}
.sad-metric:nth-child(3n) {border-right:0}
.sad-metric:nth-child(n+4) {border-bottom:0}
.sad-metric[href]:hover {background:#EEF3EA}
.sad-metric-icon {flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#E7EEE5;color:#315E48}
.sad-metric:nth-child(2) .sad-metric-icon,.sad-metric:nth-child(5) .sad-metric-icon {background:#F6E5D8;color:#A65A35}
.sad-metric-content {min-width:0;flex:1}
.sad-metric-label {display:block;color:#5A695E;font-size:14px;font-weight:700;line-height:1.35}
.sad-metric-value {display:block;color:var(--sad-green);font-size:clamp(24px,2vw,33px);font-weight:850;letter-spacing:-.04em;line-height:1.22;margin-top:2px}
.sad-metric-arrow {flex:none;color:#769184;transition:transform .18s}
.sad-metric[href]:hover .sad-metric-arrow {transform:translateX(3px)}
.sad-business {display:grid;grid-template-columns:1fr 1fr;min-width:0;border:1px solid #D1DCCE;border-radius:12px;overflow:hidden}
.sad-business-item {min-width:0;padding:22px clamp(18px,2.2vw,30px);display:flex;align-items:center;justify-content:space-between;gap:15px;background:#E7EEE4;transition:background .2s}
.sad-business-item + .sad-business-item {border-left:1px solid #CBD7CB;background:#F5E5DA}
.sad-business-item:hover {background:#DCE7D9}
.sad-business-item + .sad-business-item:hover {background:#F1DACC}
.sad-business-label {font-size:13px;color:#9F542F;font-weight:800;text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:7px}
.sad-business-value {margin:8px 0 0;font-size:clamp(27px,2.6vw,42px);font-weight:850;letter-spacing:-.052em;line-height:1.13;color:var(--sad-green);overflow-wrap:anywhere}
.sad-business-desc {margin:7px 0 0;font-size:14px;line-height:1.47;color:#53665A;overflow-wrap:anywhere}
.sad-business-arrow {display:grid;place-items:center;width:39px;height:39px;flex:none;border-radius:50%;border:1px solid #BFCFC0;background:#FBFCF8;color:var(--sad-green);transition:transform .18s}
.sad-business-item:hover .sad-business-arrow {transform:translateX(3px)}
.sad-workspace {display:grid;grid-template-columns:minmax(230px,27%) minmax(0,1fr);overflow:hidden;border:1px solid #D6DED6;border-radius:14px;background:#FFFEFB;min-width:0}
.sad-workspace-aside {padding:19px 14px;background:#E7EDE5;border-right:1px solid #D1DCD1}
.sad-workspace-intro {display:flex;align-items:center;justify-content:space-between;gap:9px;margin:0 7px 13px;color:#4D6857;font-size:13px;font-weight:750}
.sad-workspace-tabs {display:grid;gap:7px}
.sad-workspace-tab {appearance:none;display:flex;align-items:center;gap:10px;width:100%;padding:12px 11px;min-width:0;border:1px solid transparent;border-radius:9px;text-align:left;background:transparent;color:#345648;cursor:pointer;transition:background .2s,border-color .2s}
.sad-workspace-tab:hover {background:#F5F7F2;border-color:#CCD8CC}
.sad-workspace-tab[aria-pressed='true'] {background:#173F35;color:#FFFEFB;border-color:#173F35}
.sad-workspace-number {display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:7px;background:#F9FBF7;color:#356249;font-size:14px;font-weight:850}
.sad-workspace-tab[aria-pressed='true'] .sad-workspace-number {background:#FFFFFF22;color:#FFFEFB}
.sad-workspace-name {display:block;min-width:0;flex:1;font-size:15px;font-weight:850;line-height:1.28}
.sad-workspace-count {display:block;margin-top:2px;font-size:12px;font-weight:650;opacity:.75}
.sad-workspace-tab svg {flex:none;transition:transform .2s}
.sad-workspace-tab[aria-pressed='true'] svg {transform:translateX(2px)}
.sad-workspace-main {padding:clamp(18px,2.1vw,30px);min-width:0}
.sad-workspace-heading {display:flex;align-items:center;gap:13px;border-bottom:1px solid #E0E6DD;padding-bottom:17px}
.sad-workspace-heading-icon {width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:10px;background:#E7EEE4;color:#173F35}
.sad-workspace-heading h3 {margin:4px 0 0;font-size:clamp(21px,1.9vw,28px)!important;line-height:1.2!important;color:var(--sad-green)!important;letter-spacing:-.037em;font-weight:850!important}
.sad-workspace-hint {margin:5px 0 0;color:#5E6B60;font-size:14px}
.sad-tool-list {display:grid;grid-template-columns:1fr 1fr;column-gap:20px;min-width:0}
.sad-tool {display:grid;grid-template-columns:36px minmax(0,1fr) 29px;align-items:center;gap:11px;min-width:0;min-height:74px;padding:15px 2px;border-bottom:1px solid #E3E8DF;color:var(--sad-green);transition:background .2s,padding-left .2s}
.sad-tool:hover {background:#F2F5F0;padding-left:7px}
.sad-tool-icon {display:grid;place-items:center;width:35px;height:35px;border-radius:9px;background:#E8EEE6;color:#285841}
.sad-tool:nth-child(3n+2) .sad-tool-icon {background:#F7E8DC;color:#A45F39}
.sad-tool-name {display:block;color:#173F35;font-size:15px;font-weight:800;line-height:1.35}
.sad-tool-desc {display:block;color:#647066;font-size:12.5px;line-height:1.42;margin-top:3px}
.sad-tool-arrow {display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#F5F8F2;border:1px solid #D8E1D5;color:#285A47;transition:transform .2s}
.sad-tool:hover .sad-tool-arrow {transform:translateX(3px)}
.sad-error {margin-top:16px;padding:13px 16px;border-left:4px solid #B53F32;background:#FFF0E9;color:#872C27;font-size:15px;font-weight:650;line-height:1.5}
.sad-incidents {margin-top:15px;background:#FFF4E7;border:1px solid #EDCFB2;border-left:4px solid #B85E37;border-radius:9px;overflow:hidden}
.sad-incident {display:flex;gap:10px;padding:13px 16px;color:#693A24}
.sad-incident + .sad-incident {border-top:1px solid #EDCFB2}
.sad-incident h3 {margin:0;font-weight:800;font-size:16px!important;color:#713D27!important}
.sad-incident p {margin:3px 0 0;font-size:14px;color:#7C533C}
.sad-page #ai-quality {border:1px solid #D6DED3!important;background:#FFFEFB!important;border-radius:13px!important;box-shadow:none!important}
.sad-page #ai-quality > div:first-child {background:#E6ECE2!important;border-bottom:1px solid #D1DCD0!important}
.sad-page #ai-quality > div:first-child h2 {color:#173F35!important}
.sad-page #ai-quality > div:first-child p {color:#536A58!important}
.sad-page #ai-quality > div:first-child button {background:#FFFEFB!important;color:#173F35!important}
.sad-page #ai-quality > div:nth-child(2) {background:#FFFEFB!important}
@media(max-width:1000px){.sad-hero{grid-template-columns:1fr}.sad-hero-main{min-height:0}.sad-hero-side{border-left:0;border-top:4px solid var(--sad-clay)}.sad-flow{grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}.sad-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.sad-metric:nth-child(n){border-right:1px solid #E1E6DE;border-bottom:1px solid #E1E6DE}.sad-metric:nth-child(2n){border-right:0}.sad-metric:nth-child(n+5){border-bottom:0}.sad-workspace{grid-template-columns:minmax(210px,32%) minmax(0,1fr)}.sad-tool-list{grid-template-columns:1fr}}
@media(max-width:690px){.sad-page{padding:11px 11px 27px;font-size:15px}.sad-hero{border-radius:11px}.sad-hero-main{padding:22px 20px}.sad-hero h1{font-size:31px!important}.sad-hero-desc{font-size:14.5px}.sad-hero-foot{margin-top:15px;padding-top:12px}.sad-hero-side{padding:17px 19px}.sad-hero-side h2{font-size:21px!important}.sad-flow{grid-template-columns:1fr 1fr;gap:0 12px}.sad-step{padding:10px 0}.sad-step-name{font-size:13.5px}.sad-step-desc{display:none}.sad-section{margin-top:23px}.sad-metrics{grid-template-columns:1fr 1fr}.sad-metric{padding:13px 12px;gap:9px;min-height:82px}.sad-metric-icon{width:31px;height:31px}.sad-metric-icon svg{width:16px;height:16px}.sad-metric-value{font-size:26px}.sad-metric-label{font-size:13px}.sad-metric-arrow{display:none}.sad-business{grid-template-columns:1fr}.sad-business-item{padding:19px 17px}.sad-business-item + .sad-business-item{border-left:0;border-top:1px solid #CBD7CB}.sad-business-value{font-size:30px}.sad-workspace{grid-template-columns:1fr}.sad-workspace-aside{padding:14px;border-right:0;border-bottom:1px solid #D1DCD1}.sad-workspace-tabs{grid-template-columns:1fr 1fr;gap:7px}.sad-workspace-tab{padding:10px 8px;gap:7px;min-height:62px}.sad-workspace-number{width:28px;height:28px;font-size:12px}.sad-workspace-name{font-size:13.5px}.sad-workspace-count{font-size:11.5px}.sad-workspace-tab svg{display:none}.sad-workspace-main{padding:17px 15px}.sad-workspace-heading h3{font-size:22px!important}.sad-tool-list{grid-template-columns:1fr}.sad-tool{min-height:64px;padding:12px 0}.sad-tool-desc{font-size:12.5px}}
@media(prefers-reduced-motion:reduce){.sad-page a,.sad-page button,.sad-page svg{animation:none!important;transition:none!important}}
`;

function CommandMetric({ label, value, icon: Icon, to }) {
  const content = (
    <>
      <span className="sad-metric-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="sad-metric-content"><span className="sad-metric-label">{label}</span><span className="sad-metric-value">{value}</span></span>
      {to ? <ArrowRight size={17} className="sad-metric-arrow" aria-hidden="true" /> : null}
    </>
  )
  return to
    ? <Link className="sad-metric" to={to}>{content}</Link>
    : <div className="sad-metric">{content}</div>
}

function FlowStep({ item }) {
  return (
    <div className="sad-step">
      <span className="sad-step-number">{item.number}</span>
      <div className="min-w-0"><div className="sad-step-name">{item.title}</div><div className="sad-step-desc">{item.mobileCopy || item.copy}</div></div>
    </div>
  )
}

function WorkspaceToolLink({ item }) {
  const Icon = item.icon
  return (
    <Link to={item.to} className="sad-tool">
      <span className="sad-tool-icon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
      <span className="min-w-0"><span className="sad-tool-name">{item.title}</span><span className="sad-tool-desc">{item.mobileDescription || item.description}</span></span>
      <span className="sad-tool-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
    </Link>
  )
}

function WorkspaceDirectory({ groups, activeKey, onSelect }) {
  if (!groups.length) return null
  const activeGroup = groups.find((group) => group.key === activeKey) || groups[0]
  const activeIndex = groups.findIndex((group) => group.key === activeGroup.key)
  const categoryIcons = { reviews: BadgeCheck, catalog: Package, business: BarChart3, governance: ShieldCheck }
  const ActiveIcon = categoryIcons[activeGroup.key] || Boxes
  return (
    <div className="sad-workspace">
      <nav className="sad-workspace-aside" aria-label="Super Admin work areas">
        <div className="sad-workspace-intro"><span>Work areas</span><span>{groups.length} sections</span></div>
        <div className="sad-workspace-tabs">
          {groups.map((group, index) => {
            const selected = activeGroup.key === group.key
            return (
              <button
                key={group.key}
                type="button"
                aria-pressed={selected}
                aria-controls="super-admin-workspace-panel"
                onClick={() => onSelect(group.key)}
                onPointerEnter={(event) => { if (event.pointerType === 'mouse' && !selected) onSelect(group.key) }}
                className="sad-workspace-tab"
              >
                <span className="sad-workspace-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1"><span className="sad-workspace-name">{group.eyebrow}</span><span className="sad-workspace-count">{group.items.length} tools</span></span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </nav>
      <section id="super-admin-workspace-panel" className="sad-workspace-main" aria-label={activeGroup.eyebrow} role="region">
        <div className="sad-workspace-heading">
          <span className="sad-workspace-heading-icon"><ActiveIcon size={21} strokeWidth={1.8} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="sad-kicker">Section {String(activeIndex + 1).padStart(2, '0')} / {String(groups.length).padStart(2, '0')}</p>
            <h3>{activeGroup.title}</h3>
            <p className="sad-workspace-hint">{activeGroup.mobileDescription}</p>
          </div>
        </div>
        <div className="sad-tool-list">{activeGroup.items.map((item) => <WorkspaceToolLink key={item.to} item={item} />)}</div>
      </section>
    </div>
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
  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState('reviews')

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
      title: 'Analytics & customer demand',
      description: 'Customer activity, demand by area and controlled experiments in one place.',
      mobileDescription: 'Activity, demand & experiments.',
      to: '/admin/analytics',
      visible: hasAdminPermission('admin.dashboard.read') || hasAdminPermission('admin.audit.read') || hasAdminPermission('marketplace.read') || hasAdminPermission('trust_safety.read') || hasAdminPermission('catalog.read'),
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

  const openWorkspaceKey = moduleGroups.some((group) => group.key === activeWorkspaceKey)
    ? activeWorkspaceKey
    : moduleGroups[0]?.key

  return (
    <AdminShell
      flushTop
      title={<span className="text-[24px] leading-tight sm:text-[30px]">Super Admin overview</span>}
      showWorkspaceBadge={false}
      actions={
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cdd9cd] bg-[#fffefa] px-3.5 py-2 text-[14px] font-bold text-[#173F35] transition hover:bg-[#e7eee4] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <style>{superAdminStyles}</style>
      <main className="sad-page">
        <section className="sad-hero" aria-label="Super Admin overview">
          <div className="sad-hero-main">
            <div>
              <div className="sad-hero-eyebrow">
                <p className="sad-kicker sad-kicker--light">EPANTRY / Super Admin</p>
                <span className="sad-role">{adminSource === 'super_admin' ? 'Super Admin' : 'Assigned Admin'}</span>
              </div>
              <h1>Keep the platform moving.</h1>
              <p className="sad-hero-desc">Review what needs attention, understand your marketplace and open the right tools in one place.</p>
            </div>
            <div className="sad-hero-foot">
              <span><strong>{adminPermissionKeys.length}</strong> permissions</span>
              <span><strong>{accessibleModules.length}</strong> available tools</span>
            </div>
          </div>
          <div className="sad-hero-side">
            <p className="sad-kicker">Your starting point</p>
            <h2>Four simple priorities</h2>
            <div className="sad-flow">{FLOW_STEPS.map((item) => <FlowStep key={item.number} item={item} />)}</div>
          </div>
        </section>

        {error ? <div className="sad-error" role="alert">{error}</div> : null}
        {(commandCenter?.incidentBanners || []).length ? (
          <section className="sad-incidents" aria-label="Admin incident alerts">
            {commandCenter.incidentBanners.map((incident) => (
              <div key={incident.id} className="sad-incident">
                <AlertTriangle size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div><h3>{incident.title}</h3><p>{incident.banner?.message || incident.summary}</p></div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="sad-section" aria-labelledby="sad-metrics-title">
          <div className="sad-section-head">
            <div><p className="sad-kicker">Platform pulse</p><h2 id="sad-metrics-title" className="sad-title">Today’s priorities</h2></div>
            <p className="sad-sub">Live review queues and operational signals</p>
          </div>
          <div className="sad-metrics">
            {commandMetrics.map(([label, , value, Icon, to]) => (
              <CommandMetric key={label} label={label} value={!commandCenter ? (loading ? '…' : '—') : value} icon={Icon} to={to} />
            ))}
          </div>
        </section>

        <section className="sad-section" aria-labelledby="sad-business-title">
          <div className="sad-section-head">
            <div><p className="sad-kicker">Business overview</p><h2 id="sad-business-title" className="sad-title">Money & demand</h2></div>
            <p className="sad-sub">Collections this month and customer searches over 30 days</p>
          </div>
          <div className="sad-business">
            <Link to="/admin/earnings" className="sad-business-item">
              <div className="min-w-0">
                <div className="sad-business-label"><IndianRupee size={15} aria-hidden="true" /> Collections</div>
                <p className="sad-business-value">{earnings ? formatMoney(earnings.currentMonth?.grossCollectionsMinor) : '—'}</p>
                <p className="sad-business-desc">Platform earnings: {earnings ? formatMoney(earnings.currentMonth?.platformRevenueMinor) : 'Not available'}</p>
              </div>
              <span className="sad-business-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </Link>
            <Link to="/admin/analytics#customer-demand" className="sad-business-item">
              <div className="min-w-0">
                <div className="sad-business-label"><Search size={15} aria-hidden="true" /> Customer searches</div>
                <p className="sad-business-value">{demand ? Number(demand.totalSearches ?? 0).toLocaleString('en-IN') : '—'}</p>
                <p className="sad-business-desc">{demand?.topQuery?.query ? `Top search: “${demand.topQuery.query}”` : demand ? 'No top search recorded yet' : 'Search data unavailable'}</p>
                {demand?.topArea ? <p className="sad-business-desc">Area: {[demand.topArea.city, demand.topArea.state, demand.topArea.postcode].filter(Boolean).join(', ') || 'Not available'}</p> : null}
              </div>
              <span className="sad-business-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
            </Link>
          </div>
        </section>

        <section className="sad-section" aria-labelledby="sad-workspaces-title">
          <div className="sad-section-head">
            <div><p className="sad-kicker">Admin workspaces</p><h2 id="sad-workspaces-title" className="sad-title">Choose a workspace</h2></div>
            <p className="sad-sub">Select an area to see its tools</p>
          </div>
          <WorkspaceDirectory groups={moduleGroups} activeKey={openWorkspaceKey} onSelect={setActiveWorkspaceKey} />
        </section>

        {canReadAiQuality ? <section className="sad-section" aria-label="Food Copilot reliability"><AdminAiQualityPanel condensed /></section> : null}
      </main>
    </AdminShell>
  )
}
