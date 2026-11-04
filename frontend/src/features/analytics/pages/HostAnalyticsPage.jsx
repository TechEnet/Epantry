import {
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Eye,
  RefreshCw,
  ShoppingBag,
  Store,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAnalyticsErrorMessage,
  getHostAnalyticsDashboard,
} from '../services/analytics.service'

const HOST_ORGANIZATION_STORAGE_KEY = 'epantry_hospitality_organization_id'

// This stylesheet is scoped to Host Analytics. It does not change any shared UI.
const analyticsStyles = String.raw`
/* Scoped to the Host Analytics page; shell, navigation and other pages are unaffected. */
.hax-page {
  --hax-forest: #173f35;
  --hax-forest-deep: #12362e;
  --hax-ink: #202421;
  --hax-muted: #536259;
  --hax-stone: #f7f6f2;
  --hax-sage: #dce0cf;
  --hax-clay: #c86c42;
  --hax-rule: #dce1d9;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-width: 0;
  margin: 0;
  padding: clamp(16px, 2vw, 30px) clamp(14px, 2.2vw, 36px) 36px;
  color: var(--hax-ink);
  font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
.hax-page *, .hax-page *::before, .hax-page *::after { box-sizing: border-box; }
.hax-page h1, .hax-page h2, .hax-page h3, .hax-page p { margin-top: 0; }
.hax-page button, .hax-page input { font: inherit; }
.hax-page a { text-decoration: none; }
.hax-page a:focus-visible, .hax-page button:focus-visible,
.hax-page input:focus-visible, .hax-page summary:focus-visible {
  outline: 3px solid var(--hax-clay); outline-offset: 3px;
}
.hax-page button:disabled { cursor: wait; opacity: .65; }
.hax-eyebrow {
  display: inline-flex; align-items: center; gap: 9px;
  color: #ffbf9c; font-size: 13px; font-weight: 700;
  letter-spacing: .045em; text-transform: uppercase;
}
.hax-eyebrow::before { content: ''; width: 23px; height: 2px; background: currentColor; }
/* Full-width editorial masthead: no centered narrow inner container. */
.hax-hero {
  display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(240px, .62fr);
  min-width: 0; overflow: hidden; border: 1px solid #335b4d;
  border-radius: 18px; background: var(--hax-forest);
}
.hax-hero-main {
  min-width: 0; padding: clamp(23px, 2.6vw, 39px) clamp(24px, 3vw, 47px);
  background: var(--hax-forest);
}
.hax-page .hax-hero-title {
  margin: 13px 0 6px; color: #fffdf7;
  font-size: clamp(29px, 2.55vw, 38px); font-weight: 700;
  line-height: 1.16; letter-spacing: -.035em; overflow-wrap: anywhere;
}
.hax-hero-copy {
  max-width: 690px; margin-bottom: 14px; color: #e1eae3;
  font-size: 15px; line-height: 1.55;
}
.hax-links { display: flex; align-items: center; gap: 10px 22px; flex-wrap: wrap; }
.hax-plain-link {
  display: inline-flex; gap: 7px; align-items: center; min-height: 36px;
  border-bottom: 1px solid #d6e5d5; color: #ffffff; font-size: 14px; font-weight: 700;
  transition: border-color .18s, color .18s;
}
.hax-plain-link:hover { border-color: #ffc7a8; color: #ffc7a8; }
.hax-hero-side {
  display: flex; flex-direction: column; justify-content: center; align-items: flex-start;
  gap: 10px; min-width: 0; padding: 23px clamp(22px, 2.2vw, 34px);
  border-left: 1px solid #bfcbb8; background: #dce8d8;
}
.hax-side-label { color: #3c5946; font-size: 13px; font-weight: 700; }
.hax-side-range { color: var(--hax-forest); font-size: 20px; font-weight: 700; line-height: 1.25; }
.hax-refresh {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  min-height: 44px; margin-top: 4px; padding: 9px 19px;
  border: 1px solid var(--hax-forest); border-radius: 9px;
  background: var(--hax-forest); color: #fff;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: background .2s;
}
.hax-refresh:hover:not(:disabled) { background: #285b47; }
.hax-loading { min-height: 19px; color: #395743; font-size: 13px; }
.hax-loading:empty { display: none; }
.hax-rotating { animation: hax-spin 1s linear infinite; }
@keyframes hax-spin { to { transform: rotate(360deg); } }
.hax-error {
  display: flex; justify-content: space-between; align-items: center; gap: 14px;
  margin-top: 15px; padding: 14px 17px; border: 1px solid #e1b0a5;
  border-radius: 10px; background: #fff0eb; color: #7e3022; font-size: 14px;
}
.hax-error p { margin: 0; }
.hax-error button {
  flex: none; padding: 9px 13px; border: 1px solid #b26d59;
  border-radius: 8px; background: #fffdfa; color: #7e3022; font-weight: 700; cursor: pointer;
}
.hax-section { min-width: 0; margin-top: clamp(24px, 2.3vw, 36px); }
.hax-section-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 15px; }
.hax-section-head h2 {
  margin: 3px 0 0; color: var(--hax-forest);
  font-size: clamp(22px, 2vw, 27px); font-weight: 700;
  letter-spacing: -.025em; line-height: 1.25;
}
.hax-section-head p { margin: 5px 0 0; color: var(--hax-muted); font-size: 14px; }
.hax-section-number { color: #a64b2c; font-size: 13px; font-weight: 700; letter-spacing: .02em; }
/* One integrated revenue-and-orders group; color differentiates statuses. */
.hax-sale-panel {
  display: grid; grid-template-columns: minmax(265px, .76fr) minmax(0, 1.64fr);
  min-width: 0; overflow: hidden; border: 1px solid #d8dcd2;
  border-radius: 16px; background: #fffefa;
}
.hax-revenue {
  display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
  min-width: 0; padding: clamp(22px, 2.4vw, 35px); color: var(--hax-forest);
  border-top: 4px solid var(--hax-clay); background: #ffe0cf;
}
.hax-revenue-mark { display: block; width: 30px; height: 2px; margin-bottom: 17px; background: #ad593a; }
.hax-revenue-label { color: #653e2f; font-size: 14px; font-weight: 700; }
.hax-page .hax-revenue-amount {
  margin: 6px 0 7px; color: var(--hax-forest);
  font-size: clamp(34px, 3.25vw, 49px); font-weight: 700;
  line-height: 1.12; letter-spacing: -.04em; overflow-wrap: anywhere;
}
.hax-revenue-note { max-width: 390px; margin-bottom: 20px; color: #714f41; font-size: 13px; line-height: 1.5; }
.hax-units {
  display: inline-flex; flex-wrap: wrap; gap: 9px; align-items: baseline;
  padding-top: 14px; width: 100%; border-top: 1px solid #e7bba8;
  color: #624534; font-size: 14px;
}
.hax-units strong { color: var(--hax-forest); font-size: 22px; font-weight: 700; }
.hax-sale-metrics { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); min-width: 0; }
.hax-sale-metric { min-width: 0; padding: 23px clamp(19px, 2.3vw, 34px); }
.hax-sale-metric:nth-child(1) { background: #e1f0ff; }
.hax-sale-metric:nth-child(2) { background: #fff1bf; }
.hax-sale-metric:nth-child(3) { background: #e6f1df; }
.hax-sale-metric:nth-child(4) { background: #ece5f9; }
.hax-sale-metric:nth-child(odd) { border-right: 1px solid rgba(26,45,34,.12); }
.hax-sale-metric:nth-child(-n+2) { border-bottom: 1px solid rgba(26,45,34,.12); }
.hax-metric-label { color: #31473e; font-size: 14px; font-weight: 700; }
.hax-page .hax-metric-value {
  margin: 8px 0 2px; color: var(--hax-forest);
  font-size: clamp(29px, 2.7vw, 38px); font-weight: 700; letter-spacing: -.035em; line-height: 1.14;
}
.hax-metric-note { color: #536059; font-size: 13px; line-height: 1.45; }
/* Two complementary editorial bands instead of a grid of white cards. */
.hax-two-column { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 17px; min-width: 0; }
.hax-business-panel {
  min-width: 0; padding: clamp(22px, 2.35vw, 35px); border-radius: 15px;
  border: 1px solid transparent;
}
.hax-listings-panel { border-color: #b7d2ba; background: #dcebd8; }
.hax-activity-panel { border-color: #ded1f4; background: #ebe0ff; }
.hax-panel-heading { display: flex; align-items: flex-start; gap: 12px; }
.hax-panel-icon {
  flex: none; display: grid; place-items: center; width: 42px; height: 42px;
  border-radius: 11px; border: 1px solid #a8c6ab;
  background: #f8fff3; color: var(--hax-forest);
}
.hax-activity-panel .hax-panel-icon { border-color: #cab9ea; background: #f9f5ff; color: #604378; }
.hax-panel-heading h3 { margin: 0 0 2px; color: var(--hax-forest); font-size: 20px; font-weight: 700; line-height: 1.3; }
.hax-panel-heading p { margin: 0; color: #506156; font-size: 14px; line-height: 1.5; }
.hax-activity-panel .hax-panel-heading p { color: #685678; }
.hax-catalog-main { display: flex; align-items: flex-end; gap: 15px; margin-top: 22px; padding-bottom: 18px; border-bottom: 1px solid #b7cbb6; }
.hax-page .hax-catalog-value { margin: 0; color: var(--hax-forest); font-size: 51px; font-weight: 700; line-height: 1; letter-spacing: -.045em; }
.hax-catalog-main p { max-width: 180px; margin: 0 0 4px; color: #365345; font-size: 14px; font-weight: 700; line-height: 1.35; }
.hax-catalog-secondary { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 15px 0 0; }
.hax-catalog-secondary span { color: #4a6354; font-size: 14px; }
.hax-catalog-secondary strong { color: var(--hax-forest); font-size: 21px; font-weight: 700; }
.hax-manage-link {
  display: inline-flex; gap: 7px; align-items: center; min-height: 38px;
  margin-top: 13px; color: var(--hax-forest); font-size: 14px; font-weight: 700;
  border-bottom: 1px solid #678971;
}
.hax-manage-link:hover { border-bottom-color: var(--hax-clay); }
.hax-activity-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); margin-top: 17px; }
.hax-activity-item { min-width: 0; padding: 13px 17px; border-top: 1px solid #cfc0e7; }
.hax-activity-item:nth-child(odd) { padding-left: 0; border-right: 1px solid #cfc0e7; }
.hax-activity-item:nth-child(even) { padding-right: 0; }
.hax-activity-item span { display: block; color: #594b6b; font-size: 13px; }
.hax-activity-item strong { display: block; margin-top: 3px; color: #37284b; font-size: 27px; font-weight: 700; line-height: 1.25; }
.hax-activity-note { margin: 10px 0 0; color: #5b4a6b; font-size: 13px; line-height: 1.5; }
/* Discovery as a distinct sky-blue band paired with warm peach results. */
.hax-reach {
  display: grid; grid-template-columns: minmax(0,1.6fr) minmax(260px,.57fr);
  min-width: 0; overflow: hidden; border: 1px solid #bbd4e8;
  border-radius: 15px; background: #ddeeff;
}
.hax-reach-left { min-width: 0; padding: 23px clamp(21px,2.2vw,32px); }
.hax-reach-label { display: flex; align-items: center; gap: 9px; color: var(--hax-forest); font-size: 18px; font-weight: 700; }
.hax-reach-sub { margin: 4px 0 15px; color: #4f6570; font-size: 14px; }
.hax-discovery { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); min-width: 0; }
.hax-discovery div { min-width: 0; padding: 3px 17px; border-right: 1px solid #bcd1e0; }
.hax-discovery div:first-child { padding-left: 0; }
.hax-discovery div:last-child { border: none; }
.hax-discovery span { display: block; color: #475f6b; font-size: 13px; }
.hax-discovery strong { display: block; margin-top: 3px; color: var(--hax-forest); font-size: 30px; font-weight: 700; line-height: 1.2; }
.hax-notification {
  display: flex; flex-direction: column; justify-content: center; min-width: 0;
  border-left: 1px solid #e9baa8; background: #ffe0cf;
  padding: 23px clamp(21px,2.2vw,32px);
}
.hax-notification-heading { display: flex; align-items: center; gap: 8px; color: #76452e; font-size: 14px; font-weight: 700; }
.hax-page .hax-notification-rate { margin: 6px 0 4px; color: #9e4c30; font-size: 39px; line-height: 1.15; font-weight: 700; letter-spacing: -.035em; }
.hax-notification p { margin: 0; color: #76513f; font-size: 13px; line-height: 1.5; }
.hax-footnote {
  display: flex; align-items: flex-start; gap: 10px; min-width: 0;
  margin-top: 25px; padding: 15px 4px; border-top: 1px solid #d9dfd5;
  color: #506057; font-size: 14px; line-height: 1.55;
}
.hax-footnote svg { flex: none; margin-top: 2px; color: #437459; }
.hax-footnote p { margin: 0; }
.hax-footnote strong { color: var(--hax-forest); font-weight: 700; }
.hax-workspace { margin-top: 12px; border: 1px solid #d5ddd5; border-radius: 11px; background: #f0f3ec; overflow: hidden; }
.hax-workspace summary {
  display: flex; align-items: center; gap: 9px; padding: 15px 18px;
  color: var(--hax-forest); font-size: 14px; font-weight: 700; cursor: pointer; list-style: none;
}
.hax-workspace summary::-webkit-details-marker { display: none; }
.hax-workspace summary svg { margin-left: auto; transition: transform .18s; }
.hax-workspace[open] summary svg { transform: rotate(180deg); }
.hax-workspace-body { padding: 0 18px 18px; }
.hax-workspace-body p { margin: 0 0 10px; color: #546458; font-size: 14px; }
.hax-workspace-row { display: flex; gap: 9px; }
.hax-workspace input {
  flex: 1; min-width: 0; min-height: 44px; border: 1px solid #bcccbc;
  border-radius: 8px; padding: 9px 12px; background: #fff; color: var(--hax-ink); font-size: 14px;
}
.hax-workspace button {
  min-height: 44px; padding: 9px 16px; border: 0; border-radius: 8px;
  background: var(--hax-forest); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
}
@media (max-width: 1020px) {
  .hax-hero { grid-template-columns: minmax(0,1fr) minmax(210px,.4fr); }
  .hax-sale-panel { grid-template-columns: minmax(230px,.78fr) minmax(0,1.22fr); }
  .hax-reach { grid-template-columns: minmax(0,1fr) minmax(225px,.49fr); }
}
@media (max-width: 760px) {
  .hax-page { padding: 13px 12px 28px; }
  .hax-hero { grid-template-columns: minmax(0,1fr); border-radius: 14px; }
  .hax-hero-main { padding: 21px 20px 17px; }
  .hax-page .hax-hero-title { font-size: 28px; }
  .hax-hero-copy { margin-bottom: 10px; font-size: 14px; }
  .hax-hero-side {
    display: flex; flex-direction: row; align-items: center; justify-content: space-between;
    gap: 12px; border-left: 0; border-top: 1px solid #bed3bc; padding: 13px 20px;
  }
  .hax-hero-side > div { min-width: 0; }
  .hax-side-range { font-size: 16px; }
  .hax-refresh { margin-top: 0; }
  .hax-section { margin-top: 23px; }
  .hax-section-head h2 { font-size: 23px; }
  .hax-sale-panel { grid-template-columns: minmax(0,1fr); }
  .hax-revenue { padding: 22px; }
  .hax-revenue-mark { margin-bottom: 9px; }
  .hax-revenue-note { margin-bottom: 13px; }
  .hax-page .hax-revenue-amount { font-size: 38px; }
  .hax-sale-metric { padding: 16px 18px; }
  .hax-two-column { grid-template-columns: minmax(0,1fr); gap: 13px; }
  .hax-business-panel { padding: 21px; }
  .hax-catalog-main { margin-top: 17px; }
  .hax-reach { grid-template-columns: minmax(0,1fr); }
  .hax-reach-left { padding: 20px; }
  .hax-notification { border-left: 0; border-top: 1px solid #e7b29d; padding: 17px 20px; }
  .hax-page .hax-notification-rate { font-size: 34px; }
}
@media (max-width: 420px) {
  .hax-page { padding: 11px 9px 25px; }
  .hax-hero-main { padding: 19px 17px 15px; }
  .hax-hero-side { padding: 12px 17px; }
  .hax-eyebrow, .hax-section-number { font-size: 12px; }
  .hax-page .hax-hero-title { font-size: 27px; }
  .hax-section-head { align-items: flex-start; }
  .hax-section-head h2 { font-size: 22px; }
  .hax-sale-metric { padding: 15px 13px; }
  .hax-page .hax-metric-value { font-size: 28px; }
  .hax-metric-label, .hax-metric-note { font-size: 13px; }
  .hax-business-panel { padding: 18px; }
  .hax-activity-item { padding: 10px 11px; }
  .hax-page .hax-catalog-value { font-size: 45px; }
  .hax-reach-left { padding: 17px; }
  .hax-discovery div { padding-left: 10px; padding-right: 10px; }
  .hax-discovery strong { font-size: 25px; }
  .hax-workspace-row { flex-direction: column; }
  .hax-error { flex-direction: column; align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .hax-page *, .hax-page *::before, .hax-page *::after { animation: none !important; transition: none !important; }
}
`

function formatCount(value, available) {
  if (!available) return '—'
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number.toLocaleString('en-IN') : '—'
}

function moneyFromMinor(value, currency = 'INR') {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format((Number.isFinite(amount) ? amount : 0) / 100)
}

function compactDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date)
}

function actionPercentage(value, available) {
  if (!available) return '—'
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : '—'
}

function SalesMetric({ label, value, note }) {
  return (
    <div className="hax-sale-metric">
      <div className="hax-metric-label">{label}</div>
      <p className="hax-metric-value">{value}</p>
      <div className="hax-metric-note">{note}</div>
    </div>
  )
}

function ActivityMetric({ label, value }) {
  return (
    <div className="hax-activity-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function HostAnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [organizationId, setOrganizationId] = useState(
    () => window.localStorage.getItem(HOST_ORGANIZATION_STORAGE_KEY) || '',
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getHostAnalyticsDashboard()
      if (!result || typeof result !== 'object' || !result.operational || !result.organization) {
        throw new Error('The business analytics response is incomplete. Please refresh to retry.')
      }
      setData(result)
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError, 'Unable to load business analytics.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasData = Boolean(data)
  const operational = data?.operational || {}
  const rangeText = data?.range?.start && data?.range?.end
    ? `${compactDate(data.range.start)} – ${compactDate(data.range.end)}`
    : 'Last 30 days'
  const count = (value) => formatCount(value, hasData)

  return (
    <main className="hax-page" aria-busy={loading}>
      <style>{analyticsStyles}</style>

      <header className="hax-hero">
        <div className="hax-hero-main">
          <div className="hax-eyebrow">Host / Business analytics</div>
          <h1 className="hax-hero-title">
            {data?.organization?.displayName || 'Business analytics'}
          </h1>
          <p className="hax-hero-copy">
            Track sales, live listings and customer engagement in one place.
          </p>
          <nav className="hax-links" aria-label="Analytics quick links">
            <Link to="/host/orders" className="hax-plain-link">
              Open orders <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
        <div className="hax-hero-side">
          <div>
            <div className="hax-side-label">Reporting period</div>
            <div className="hax-side-range">{rangeText}</div>
          </div>
          <button type="button" className="hax-refresh" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'hax-rotating' : ''} aria-hidden="true" />
            {loading ? 'Loading' : 'Refresh'}
          </button>
          <div className="hax-loading" role="status" aria-live="polite">
            {loading ? 'Updating business data…' : ''}
          </div>
        </div>
      </header>

      {error ? (
        <div className="hax-error" role="alert">
          <p>{error}{hasData ? ' Showing the last loaded values.' : ''}</p>
          <button type="button" onClick={load} disabled={loading}>Try again</button>
        </div>
      ) : null}

      <section className="hax-section" aria-labelledby="hax-sales-heading">
        <div className="hax-section-head">
          <div>
            <span className="hax-section-number">01 / Sales</span>
            <h2 id="hax-sales-heading">Sales performance</h2>
            <p>Orders recorded during this reporting period.</p>
          </div>
        </div>
        <div className="hax-sale-panel">
          <div className="hax-revenue">
            <div>
              <span className="hax-revenue-mark" aria-hidden="true" />
              <div className="hax-revenue-label">Tracked order value</div>
              <p className="hax-revenue-amount">
                {hasData ? moneyFromMinor(operational.trackedOrderValueMinor, operational.currency) : '—'}
              </p>
              <p className="hax-revenue-note">Item totals before settlement; cancelled and refunded orders are excluded.</p>
            </div>
            <div className="hax-units">
              <strong>{count(operational.unitsOrdered)}</strong> Units ordered
            </div>
          </div>
          <div className="hax-sale-metrics">
            <SalesMetric label="Orders received" value={count(operational.ordersReceived)} note="Orders in the period" />
            <SalesMetric label="In progress" value={count(operational.activeOrders)} note="Open orders requiring follow-up" />
            <SalesMetric label="Delivered" value={count(operational.deliveredOrders)} note="Marked as delivered" />
            <SalesMetric label="Completed" value={count(operational.completedOrders)} note="Closed orders, including other outcomes" />
          </div>
        </div>
      </section>

      <section className="hax-section" aria-labelledby="hax-business-heading">
        <div className="hax-section-head">
          <div>
            <span className="hax-section-number">02 / Business pulse</span>
            <h2 id="hax-business-heading">Products & customer activity</h2>
            <p>What is available to buy, and how customers engage.</p>
          </div>
        </div>
        <div className="hax-two-column">
          <section className="hax-business-panel hax-listings-panel" aria-labelledby="hax-listing-heading">
            <div className="hax-panel-heading">
              <span className="hax-panel-icon"><Store size={20} aria-hidden="true" /></span>
              <div>
                <h3 id="hax-listing-heading">Your listings</h3>
                <p>Products ready for customers.</p>
              </div>
            </div>
            <div className="hax-catalog-main">
              <p className="hax-catalog-value">{count(operational.activeListings)}</p>
              <p>Active product listings</p>
            </div>
            <div className="hax-catalog-secondary">
              <span>Total listings you manage</span>
              <strong>{count(operational.managedListings)}</strong>
            </div>
            <Link to="/host/marketplace" className="hax-manage-link">
              Manage listings <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </section>

          <section className="hax-business-panel hax-activity-panel" aria-labelledby="hax-customer-heading">
            <div className="hax-panel-heading">
              <span className="hax-panel-icon"><Eye size={20} aria-hidden="true" /></span>
              <div>
                <h3 id="hax-customer-heading">Customer activity</h3>
                <p>Recorded engagement linked to your business.</p>
              </div>
            </div>
            <div className="hax-activity-list">
              <ActivityMetric label="Baskets created" value={count(data?.lenses?.commerce?.basketCreated)} />
              <ActivityMetric label="Recipe views" value={count(data?.lenses?.recipes?.viewed)} />
              <ActivityMetric label="Recipe selections" value={count(data?.lenses?.recipes?.selected)} />
              <ActivityMetric label="Recipes cooked" value={count(data?.lenses?.recipes?.cooked)} />
            </div>
            <p className="hax-activity-note">Only tracked customer activity is counted, so these figures may be lower than order totals.</p>
          </section>
        </div>
      </section>

      <section className="hax-section" aria-labelledby="hax-reach-heading">
        <div className="hax-section-head">
          <div>
            <span className="hax-section-number">03 / Visibility</span>
            <h2 id="hax-reach-heading">Discovery & notifications</h2>
            <p>How shoppers discover content and respond to messages.</p>
          </div>
        </div>
        <div className="hax-reach">
          <div className="hax-reach-left">
            <div className="hax-reach-label"><BarChart3 size={19} aria-hidden="true" /> Discovery mix</div>
            <p className="hax-reach-sub">Tracked organic and sponsored discovery.</p>
            <div className="hax-discovery">
              <div><span>Organic</span><strong>{count(data?.organicSponsored?.organic)}</strong></div>
              <div><span>Sponsored</span><strong>{count(data?.organicSponsored?.sponsored)}</strong></div>
              <div><span>Mixed</span><strong>{count(data?.organicSponsored?.mixed)}</strong></div>
            </div>
          </div>
          <div className="hax-notification">
            <div className="hax-notification-heading"><BellRing size={18} aria-hidden="true" /> Notification action rate</div>
            <p className="hax-notification-rate">{actionPercentage(data?.notificationUtility?.actionRate, hasData)}</p>
            <p>Share of notification intents that led to an action.</p>
          </div>
        </div>
      </section>

      <div className="hax-footnote">
        <CheckCircle2 size={19} aria-hidden="true" />
        <p><strong>About these numbers.</strong> Order and listing totals come from saved business records. Customer and discovery metrics use privacy-safe activity signals; they do not change safety, search or ranking decisions.</p>
      </div>

      <details className="hax-workspace">
        <summary>
          <ShoppingBag size={17} aria-hidden="true" />
          Manage another business workspace
          <ChevronDown size={18} aria-hidden="true" />
        </summary>
        <div className="hax-workspace-body">
          <p>Only use this if your Host account manages more than one business.</p>
          <div className="hax-workspace-row">
            <input
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              placeholder="Business workspace ID"
              aria-label="Business workspace ID"
            />
            <button
              type="button"
              onClick={() => {
                const value = organizationId.trim()
                if (value) {
                  window.localStorage.setItem(HOST_ORGANIZATION_STORAGE_KEY, value)
                } else {
                  window.localStorage.removeItem(HOST_ORGANIZATION_STORAGE_KEY)
                }
                setData(null)
                load()
              }}
            >
              Switch workspace
            </button>
          </div>
        </div>
      </details>
    </main>
  )
}
