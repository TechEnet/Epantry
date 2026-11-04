import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Clock3, RefreshCw, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'

import { getCatalogProducts } from '../../grocery/services/catalog.service'
import { listHostListingPackets } from '../services/hostUnifiedListing.service'
import {
  getHostEarningsOverview,
  getHostOperationsErrorMessage,
} from '../../hostOperations/services/hostOperations.service'

const earningsStyles = String.raw`
/* EPANTRY / Host earnings / Editorial ledger
   Component-scoped CSS; navbar, sidebar and footer are not affected. */
.hee-page {
  --hee-forest: #173f35;
  --hee-forest-dark: #102f29;
  --hee-clay: #c9714a;
  --hee-clay-dark: #aa5635;
  --hee-charcoal: #222a25;
  --hee-sage: #e3ebe0;
  --hee-soft-sage: #edf2e9;
  --hee-porcelain: #f7f6f1;
  --hee-muted: #596d62;
  --hee-rule: #d8e0d7;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  padding: clamp(14px, 2.2vw, 32px) clamp(14px, 2.5vw, 36px) 48px;
  background: var(--hee-porcelain);
  color: var(--hee-charcoal);
  font: 400 15px/1.5 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif;
}
.hee-page *, .hee-page *::before, .hee-page *::after { box-sizing: border-box; }
.hee-page :is(a, button) { font: inherit; }
.hee-page :is(a, button):focus-visible { outline: 3px solid var(--hee-clay); outline-offset: 3px; }
.hee-intro {
  border: 1px solid var(--hee-rule);
  border-top: 4px solid var(--hee-clay);
  background: #fcfcf8;
  border-radius: 12px;
  overflow: hidden;
}
.hee-intro-top {
  min-height: 55px;
  padding: 13px 30px 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.hee-kicker { display: flex; gap: 9px; align-items: center; font-size: 12px; letter-spacing: .065em; text-transform: uppercase; font-weight: 800; color: var(--hee-clay-dark); }
.hee-kicker::before { content: ''; width: 22px; height: 2px; background: var(--hee-clay); }
.hee-live-tools { display: flex; align-items: center; gap: 15px; flex-wrap: wrap; }
.hee-live { display: inline-flex; align-items: center; gap: 7px; color: var(--hee-muted); font-weight: 700; font-size: 13px; }
.hee-live::before { content: ''; width: 7px; height: 7px; background: #4c926c; border-radius: 50%; box-shadow: 0 0 0 3px #4c926c1e; }
.hee-refresh { display: inline-flex; justify-content: center; align-items: center; min-height: 36px; gap: 7px; padding: 7px 13px; border: 1px solid #c4d4c8; background: #fff; color: var(--hee-forest); border-radius: 6px; font-weight: 760!important; font-size: 13px!important; cursor: pointer; transition: background .18s, border-color .18s; }
.hee-refresh:hover:not(:disabled) { background: var(--hee-soft-sage); border-color: #97b8a1; }
.hee-refresh:disabled { opacity: .65; cursor: wait; }
.hee-intro-body { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(285px, .78fr); align-items: stretch; }
.hee-heading-panel { padding: 19px 30px 35px; min-width: 0; }
.hee-heading-panel h1 { font-size: clamp(32px, 3.2vw, 45px)!important; line-height: 1.1!important; letter-spacing: -.05em!important; color: var(--hee-forest)!important; margin: 0 0 13px!important; font-weight: 800!important; }
.hee-heading-panel p { margin: 0; max-width: 480px; color: var(--hee-muted); font-size: 15px; line-height: 1.65; }
.hee-captured {
  padding: 20px 30px 25px;
  border-left: 1px solid var(--hee-rule);
  background: var(--hee-sage);
  position: relative;
  min-width: 0;
}
.hee-captured::after { content: ''; position: absolute; width: 160px; height: 160px; border: 1px solid #b4c8b9; border-radius: 50%; right: -66px; top: -88px; pointer-events: none; box-shadow: 0 0 0 25px #d4e1d354; }
.hee-captured-label { display: block; font-size: 13px; font-weight: 780; color: #516d5b; }
.hee-captured-value { display: block; font-size: clamp(32px, 3vw, 44px); font-weight: 820; letter-spacing: -.052em; line-height: 1.25; color: var(--hee-forest); margin: 8px 0 4px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; position: relative; }
.hee-captured-sub { font-size: 13px; color: #587163; display: block; }
.hee-updated { display: block; border-top: 1px solid #c9d8c9; margin-top: 17px; padding-top: 10px; font-size: 12.5px; color: #547062; }
.hee-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--hee-rule); }
.hee-metric { min-width: 0; padding: 20px 27px 23px; border-right: 1px solid var(--hee-rule); background: #fdfcf9; }
.hee-metric:last-child { border-right: 0; }
.hee-metric[data-kind='process'] { background: #f0f3ed; }
.hee-metric[data-kind='await'] { background: #f7e9e0; }
.hee-metric-label { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 750; color: #4c6255; }
.hee-metric-label svg { flex: none; color: #4e7c62; }
.hee-metric[data-kind='await'] .hee-metric-label svg { color: var(--hee-clay-dark); }
.hee-metric-number { display: block; margin-top: 6px; font-size: clamp(26px, 2.5vw, 35px); line-height: 1.23; font-weight: 800; letter-spacing: -.04em; color: var(--hee-forest); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hee-metric-note { display: block; margin-top: 4px; color: var(--hee-muted); font-size: 12.5px; line-height: 1.5; }
.hee-error { margin-top: 17px; padding: 13px 15px; border-left: 3px solid #af443b; background: #faebe7; font-size: 14px; color: #933b33; }
.hee-sales { min-width: 0; margin-top: 31px; border: 1px solid var(--hee-rule); border-top: 3px solid var(--hee-clay); border-radius: 11px; overflow: hidden; background: #fffefa; }
.hee-section-header { padding: 26px 28px 22px; display: flex; justify-content: space-between; align-items: end; flex-wrap: wrap; gap: 15px; background: #f9eee7; border-bottom: 1px solid #e9d9cf; }
.hee-section-label { display: inline-flex; align-items: center; gap: 8px; color: var(--hee-clay-dark); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .055em; }
.hee-section-header h2, .hee-payout-head h2 { margin: 6px 0 0!important; font-size: clamp(24px, 2.25vw, 30px)!important; font-weight: 800!important; letter-spacing: -.042em!important; line-height: 1.19!important; color: var(--hee-forest)!important; }
.hee-section-sub { margin: 6px 0 0; color: var(--hee-muted); font-size: 14px; }
.hee-sales-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.hee-count { font-size: 13px; font-weight: 760; color: #3c6150; padding: 8px 11px; background: var(--hee-soft-sage); border-radius: 5px; }
.hee-plain-link { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; color: var(--hee-forest); font-size: 14px; font-weight: 790; border-bottom: 1px solid #9db5a5; padding: 5px 0; }
.hee-plain-link:hover { color: var(--hee-clay-dark); border-bottom-color: var(--hee-clay); }
.hee-order-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--hee-rule); min-width: 0; }
.hee-order { min-width: 0; min-height: 118px; display: flex; align-items: center; gap: 14px; padding: 19px 22px; border-bottom: 1px solid #e2e9e0; text-decoration: none; color: inherit; background: #fffefa; position: relative; transition: background .18s ease; }
.hee-order:nth-child(even) { border-left: 1px solid var(--hee-rule); }
.hee-order:hover { background: #edf3ec; }
.hee-order:hover .hee-visit { transform: translateX(2px); color: var(--hee-clay-dark); border-color: #d5a184; }
.hee-photo { flex: 0 0 78px; width: 78px; height: 78px; overflow: hidden; position: relative; background: #f1f3ed; border: 1px solid #e2e9df; border-radius: 7px; display: block; }
.hee-photo img { width: 100%; height: 100%; object-fit: contain; display: block; background: #f9faf7; }
.hee-photo-blank { height: 100%; display: grid; place-items: center; text-align: center; font-size: 11px; color: #697f70; line-height: 1.25; }
.hee-photo-number { position: absolute; right: 2px; bottom: 2px; padding: 2px 5px; color: #fff; background: var(--hee-forest); border-radius: 3px; font-size: 10px; font-weight: 800; }
.hee-order-information { min-width: 0; flex: 1 1 auto; display: block; }
.hee-product-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; font-size: 15.5px; line-height: 1.37; color: var(--hee-charcoal); font-weight: 780; }
.hee-product-meta { display: block; margin-top: 7px; font-size: 12.5px; line-height: 1.4; color: #697c6d; }
.hee-order-money { min-width: 121px; align-self: center; display: flex; flex-direction: column; align-items: flex-end; gap: 7px; text-align: right; }
.hee-order-price { font-size: 16px; font-weight: 815; color: var(--hee-forest); white-space: nowrap; font-variant-numeric: tabular-nums; letter-spacing: -.03em; }
.hee-badge { display: inline-flex; align-items: center; padding: 4px 7px; border-radius: 4px; background: #e2eee6; color: #346448; font-size: 11.5px; font-weight: 760; line-height: 1.3; text-align: center; }
.hee-badge[data-status='awaiting_settlement'] { background: #f9e6d7; color: #9f4a2d; }
.hee-badge[data-status='not_yet_settleable'] { background: #e3edf0; color: #356c76; }
.hee-badge[data-status='pending_approval'] { background: #ede8f6; color: #675184; }
.hee-badge[data-status='rejected'], .hee-badge[data-status='void'] { background: #f6e6e4; color: #9d403b; }
.hee-visit { display: inline-grid; place-items: center; color: #638375; width: 25px; height: 25px; border: 1px solid #cedcd1; border-radius: 50%; transition: transform .18s, color .18s, border-color .18s; }
.hee-sales-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 28px; background: var(--hee-soft-sage); color: var(--hee-muted); font-size: 13px; }
.hee-sales-foot p { margin: 0; }
.hee-empty-sales { grid-column: 1/-1; padding: 36px 28px; font-size: 14px; color: var(--hee-muted); }
.hee-payouts { display: grid; grid-template-columns: minmax(265px, .44fr) minmax(0, 1fr); margin-top: 28px; border: 1px solid var(--hee-rule); border-radius: 11px; overflow: hidden; background: #fffefa; }
.hee-payout-head { padding: 25px 27px; background: var(--hee-forest); min-width: 0; }
.hee-payout-head h2 { color: #fffefa!important; }
.hee-payout-head .hee-section-label { color: #f0bd9d; }
.hee-payout-head p { margin: 8px 0 15px; color: #d2e2d7; font-size: 14px; }
.hee-payout-link { display: inline-flex; align-items: center; gap: 9px; font-size: 14px; font-weight: 780; text-decoration: none; color: #fffdf7; border-bottom: 1px solid #91baa5; padding-bottom: 4px; }
.hee-payout-link:hover { color: #f0bd9d; border-bottom-color: #f0bd9d; }
.hee-payout-list { padding: 13px 25px; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.hee-payout-row { padding: 13px 0; display: flex; justify-content: space-between; align-items: center; gap: 15px; border-bottom: 1px solid var(--hee-rule); }
.hee-payout-row:last-child { border-bottom: 0; }
.hee-payout-value { display: block; color: var(--hee-forest); font-size: 20px; line-height: 1.25; font-weight: 810; font-variant-numeric: tabular-nums; }
.hee-payout-meta { display: block; margin-top: 3px; color: var(--hee-muted); font-size: 12.5px; }
.hee-payout-empty { display: flex; align-items: flex-start; gap: 13px; padding: 16px 2px; }
.hee-payout-empty-icon { flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; color: var(--hee-forest); background: var(--hee-soft-sage); }
.hee-payout-empty strong { display: block; font-size: 16px; color: var(--hee-forest); }
.hee-payout-empty p { margin: 5px 0 0; color: var(--hee-muted); font-size: 14px; }
@media (max-width: 1100px) {
  .hee-order { padding: 16px 15px; gap: 10px; }
  .hee-order-money { min-width: 99px; }
  .hee-photo { width: 66px; height: 70px; flex-basis: 66px; }
  .hee-product-name { font-size: 14.5px; }
}
@media (max-width: 850px) {
  .hee-intro-body { grid-template-columns: minmax(0, 1fr) minmax(245px, .95fr); }
  .hee-heading-panel, .hee-captured { padding-left: 23px; padding-right: 23px; }
  .hee-order-list { grid-template-columns: 1fr; }
  .hee-order:nth-child(even) { border-left: 0; }
  .hee-order { min-height: 104px; padding: 14px 23px; }
  .hee-photo { width: 70px; height: 72px; flex-basis: 70px; }
  .hee-sales-foot { padding: 13px 23px; }
}
@media (max-width: 620px) {
  .hee-page { padding: 11px 10px 35px; font-size: 14px; }
  .hee-intro-top { padding: 15px 18px 9px; gap: 9px; }
  .hee-kicker { font-size: 11px; }
  .hee-live { font-size: 12px; }
  .hee-refresh { min-height: 34px; padding: 6px 10px; }
  .hee-intro-body { grid-template-columns: 1fr; }
  .hee-heading-panel { padding: 12px 18px 22px; }
  .hee-heading-panel h1 { font-size: 31px!important; margin-bottom: 7px!important; }
  .hee-heading-panel p { font-size: 14px; }
  .hee-captured { border-left: 0; border-top: 1px solid var(--hee-rule); padding: 15px 18px 17px; }
  .hee-captured-label { font-size: 12.5px; }
  .hee-captured-value { font-size: 34px; margin-top: 3px; }
  .hee-captured-sub { font-size: 12.5px; }
  .hee-updated { margin-top: 10px; padding-top: 8px; font-size: 12px; }
  .hee-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hee-metric { padding: 15px 14px; }
  .hee-metric[data-kind='paid'] { grid-column: 1/-1; border-right: 0; border-bottom: 1px solid var(--hee-rule); }
  .hee-metric[data-kind='process'] { border-bottom: 0; }
  .hee-metric-label { font-size: 12.5px; }
  .hee-metric-number { font-size: 26px; }
  .hee-metric-note { font-size: 12px; }
  .hee-sales { margin-top: 19px; }
  .hee-section-header { padding: 19px 17px 17px; }
  .hee-section-header h2, .hee-payout-head h2 { font-size: 24px!important; }
  .hee-section-sub { font-size: 13px; }
  .hee-sales-actions { gap: 12px; }
  .hee-count { padding: 6px 8px; font-size: 12px; }
  .hee-plain-link { font-size: 13px; }
  .hee-order { gap: 10px; padding: 13px 12px; }
  .hee-photo { flex-basis: 63px; width: 63px; height: 66px; }
  .hee-product-name { font-size: 14px; }
  .hee-product-meta { font-size: 12px; margin-top: 5px; }
  .hee-order-money { min-width: 98px; gap: 6px; }
  .hee-order-price { font-size: 14px; }
  .hee-badge { font-size: 11px; }
  .hee-sales-foot { padding: 12px 15px; }
  .hee-payouts { margin-top: 18px; grid-template-columns: 1fr; }
  .hee-payout-head { padding: 19px 18px 15px; }
  .hee-payout-head p { font-size: 13px; margin: 7px 0 10px; }
  .hee-payout-list { padding: 10px 18px; }
}
@media (max-width: 370px) {
  .hee-intro-top { align-items: flex-start; }
  .hee-live { display: none; }
  .hee-photo { flex-basis: 54px; width: 54px; height: 58px; }
  .hee-order { gap: 8px; padding: 12px 9px; }
  .hee-order-money { min-width: 91px; }
  .hee-product-name { font-size: 13.5px; }
  .hee-order-price { font-size: 13.5px; }
  .hee-metric-number { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) { .hee-page :is(a,button) { transition: none !important; } }
`

function currencyMinor(value, currency = 'INR') {
  const amount = Number(value || 0) / 100
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`
  }
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function shortOrderId(value) {
  return String(value || '').slice(-8).toUpperCase() || '—'
}

function cleanProductName(value) {
  const raw = String(value || '').trim()
  return raw && !/^order\s+[a-z0-9]{5,}$/i.test(raw) ? raw : ''
}

function normalizeTitle(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function safeImageUrl(value) {
  const text = String(value || '').trim()
  return /^https?:\/\//i.test(text) || /^\/(?!\/)/.test(text) ? text : ''
}

function pickImage(value) {
  return safeImageUrl(value?.image?.url || value?.imageUrl || value?.thumbnailUrl ||
    value?.images?.[0]?.url || value?.images?.[0] ||
    value?.packet?.images?.[0]?.url || value?.packet?.images?.[0] ||
    value?.packet?.imageUrl)
}

const STATUS = {
  not_yet_settleable: 'Payment captured',
  awaiting_settlement: 'Awaiting settlement',
  pending_approval: 'Under review',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
  void: 'Void',
}

function Status({ status }) {
  return <span className="hee-badge" data-status={status || 'not_yet_settleable'}>
    {STATUS[status] || String(status || 'Payment captured').replace(/_/g, ' ')}
  </span>
}

function ProductPhoto({ src, name, count }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return <span className="hee-photo">
    {src && !failed ? (
      <img src={src} alt={name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    ) : <span className="hee-photo-blank">Photo<br />unavailable</span>}
    {count > 1 ? <span className="hee-photo-number">+{count - 1}</span> : null}
  </span>
}

function OrderSale({ order, images, currency }) {
  const previews = Array.isArray(order.itemPreviews) ? order.itemPreviews : []
  const names = Array.isArray(order.itemNames) ? order.itemNames.filter(cleanProductName) : []
  const first = previews.find((item) => cleanProductName(item?.name)) || previews[0] || {}
  const name = cleanProductName(first.name) || cleanProductName(names[0]) || 'Product name unavailable'
  const count = Number(order.itemCount || names.length || previews.length || 1)
  const title = count > 1 ? `${name} + ${count - 1} more` : name
  const image = safeImageUrl(first.imageUrl) ||
    images[`v:${first.productVersionId}`] || images[`n:${normalizeTitle(name)}`] || ''
  const priceMinor = order.netPayableMinor ?? order.grossMinor

  return <Link className="hee-order" to={`/host/orders/${order.sellerOrderId}`}
    aria-label={`View ${title}, order ${shortOrderId(order.sellerOrderId)}`}>
    <ProductPhoto src={image} name={name} count={count} />
    <span className="hee-order-information">
      <strong className="hee-product-name">{title}</strong>
      <span className="hee-product-meta">#{shortOrderId(order.sellerOrderId)} · {dateTime(order.updatedAt || order.createdAt)}</span>
    </span>
    <span className="hee-order-money">
      <strong className="hee-order-price">{currencyMinor(priceMinor, order.currency || currency)}</strong>
      <Status status={order.settlementStatus} />
      <span className="hee-visit" aria-hidden="true"><ArrowRight size={15} /></span>
    </span>
  </Link>
}

export default function HostEarningsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [images, setImages] = useState({})

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await getHostEarningsOverview()
      setData(result || null)
      setError('')
    } catch (loadError) {
      setError(getHostOperationsErrorMessage(loadError, 'Unable to load earnings.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = window.setInterval(() => load({ quiet: true }), 10000)
    const refreshOnFocus = () => load({ quiet: true })
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') refreshOnFocus()
    }
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnVisibility)
    }
  }, [load])

  const earnings = data?.earnings || {}
  const currency = earnings.currency || 'INR'
  const recentOrders = Array.isArray(data?.recentOrders) ? data.recentOrders : []
  const recentSettlements = Array.isArray(data?.recentSettlements) ? data.recentSettlements : []

  const imageLookupKey = useMemo(() => recentOrders.map((order) =>
    (order.itemPreviews || []).map((item) => `${item.productVersionId || ''}:${item.name || ''}`).join('|') ||
    (order.itemNames || []).join('|'),
  ).join('||'), [recentOrders])

  // Use only existing EPANTRY images. Do not fetch stock pictures or invent assets.
  // This runs when the list of sold products changes, NOT at every 10-second refresh.
  useEffect(() => {
    if (!imageLookupKey) return undefined
    let active = true
    const wantedNames = new Set()
    const wantedVersions = new Set()
    recentOrders.forEach((order) => {
      if (Array.isArray(order.itemPreviews) && order.itemPreviews.length) {
        order.itemPreviews.forEach((item) => {
          // The Earnings API now returns the real catalog photo directly.
          // Do not make extra catalog requests when that photo is available.
          if (safeImageUrl(item?.imageUrl)) return
          if (normalizeTitle(item?.name)) wantedNames.add(normalizeTitle(item.name))
          if (item?.productVersionId) wantedVersions.add(String(item.productVersionId))
        })
      } else {
        ;(order.itemNames || []).forEach((name) => {
          if (normalizeTitle(name)) wantedNames.add(normalizeTitle(name))
        })
      }
    })
    if (!wantedNames.size && !wantedVersions.size) return undefined

    const foundKeys = new Set()
    const publish = (items) => {
      const found = {}
      items.forEach(({ name, image, versionId }) => {
        const url = safeImageUrl(image)
        const key = normalizeTitle(name)
        if (!url) return
        if (key && wantedNames.has(key)) {
          found[`n:${key}`] = url
          foundKeys.add(`n:${key}`)
        }
        if (versionId && wantedVersions.has(String(versionId))) {
          found[`v:${versionId}`] = url
          foundKeys.add(`v:${versionId}`)
        }
      })
      if (active && Object.keys(found).length) {
        setImages((current) => ({ ...current, ...found }))
      }
    }
    const applyCatalog = (products) => publish((Array.isArray(products) ? products : []).map((product) => ({
      name: product?.displayName || product?.title || product?.name,
      image: pickImage(product),
      versionId: product?.productVersionId || product?.id,
    })))
    const hostTask = listHostListingPackets().then((result) => publish((result?.listings || [])
      .filter((listing) => listing?.status === 'approved')
      .map((listing) => ({
        name: listing?.title || listing?.packet?.title,
        image: pickImage(listing),
        versionId: listing?.packet?.catalogProductVersionId,
      })))).catch(() => {})
    const catalogTask = getCatalogProducts({ page: 1, limit: 100 })
      .then((result) => applyCatalog(result?.products)).catch(() => {})

    Promise.allSettled([hostTask, catalogTask]).then(async () => {
      if (!active) return
      // A targeted catalog lookup is a fallback for products beyond page one.
      const names = [...wantedNames].filter((name) => !foundKeys.has(`n:${name}`)).slice(0, 12)
      for (let index = 0; index < names.length && active; index += 6) {
        await Promise.allSettled(names.slice(index, index + 6).map(async (name) => {
          const result = await getCatalogProducts({ search: name, page: 1, limit: 15 })
          applyCatalog(result?.products)
        }))
      }
    }).catch(() => {})

    return () => { active = false }
    // imageLookupKey is a primitive snapshot, so refreshes with the same items do not restart requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageLookupKey])

  return <main className="hee-page">
    <style>{earningsStyles}</style>

    <header className="hee-intro">
      <div className="hee-intro-top">
        <span className="hee-kicker">Host / Finance</span>
        <div className="hee-live-tools">
          <span className="hee-live">Live · 10 sec</span>
          <button type="button" className="hee-refresh" onClick={() => load({ quiet: true })}
            disabled={refreshing}>
            <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="hee-intro-body">
        <div className="hee-heading-panel">
          <h1>Your earnings</h1>
          <p>Sales, payments and payouts for your business, all in one place.</p>
        </div>
        <div className="hee-captured">
          <span className="hee-captured-label">Total captured revenue</span>
          <strong className="hee-captured-value">{loading ? '—' : currencyMinor(earnings.totalEarnedMinor, currency)}</strong>
          <span className="hee-captured-sub">Received from successful customer payments</span>
          <span className="hee-updated">Updated {earnings.refreshedAt ? dateTime(earnings.refreshedAt) : 'when data is available'}</span>
        </div>
      </div>
      <section className="hee-metrics" aria-label="Earnings summary">
        <div className="hee-metric" data-kind="paid">
          <span className="hee-metric-label"><Check size={17} aria-hidden="true" /> Paid to you</span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.paidMinor, currency)}</strong>
          <span className="hee-metric-note">Completed payouts</span>
        </div>
        <div className="hee-metric" data-kind="process">
          <span className="hee-metric-label"><WalletCards size={17} aria-hidden="true" /> In settlement</span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.inSettlementMinor, currency)}</strong>
          <span className="hee-metric-note">Under review or approved</span>
        </div>
        <div className="hee-metric" data-kind="await">
          <span className="hee-metric-label"><Clock3 size={17} aria-hidden="true" /> Awaiting settlement</span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.awaitingSettlementMinor, currency)}</strong>
          <span className="hee-metric-note">Delivered, not settled yet</span>
        </div>
      </section>
    </header>

    {error ? <div className="hee-error" role="alert">{error}</div> : null}

    <section className="hee-sales" aria-labelledby="hee-sales-heading">
      <div className="hee-section-header">
        <div>
          <span className="hee-section-label">01 / Sales</span>
          <h2 id="hee-sales-heading">Recent sales</h2>
          <p className="hee-section-sub">Your latest paid orders and products.</p>
        </div>
        <div className="hee-sales-actions">
          <span className="hee-count">{loading ? '—' : Number(earnings.capturedOrders || 0)} paid orders</span>
          <Link className="hee-plain-link" to="/host/orders">All orders <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="hee-order-list">
        {recentOrders.length ? recentOrders.map((order) => (
          <OrderSale key={order.sellerOrderId} order={order} images={images} currency={currency} />
        )) : <div className="hee-empty-sales">{loading ? 'Loading your orders…' : 'No paid orders yet.'}</div>}
      </div>
      <div className="hee-sales-foot">
        <p>{loading ? 'Loading sales…' : `Showing ${recentOrders.length} recent ${recentOrders.length === 1 ? 'order' : 'orders'}`}</p>
        <Link className="hee-plain-link" to="/host/orders">Manage orders <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
    </section>

    <section className="hee-payouts" aria-labelledby="hee-payout-heading">
      <div className="hee-payout-head">
        <span className="hee-section-label">02 / Payouts</span>
        <h2 id="hee-payout-heading">Settlements</h2>
        <p>Payments sent or being processed.</p>
        <Link className="hee-payout-link" to="/host/finance">Payments &amp; Finance <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <div className="hee-payout-list">
        {recentSettlements.length ? recentSettlements.map((settlement) => (
          <div className="hee-payout-row" key={settlement.id}>
            <div>
              <strong className="hee-payout-value">{currencyMinor(settlement.totals?.netPayableMinor, settlement.currency || currency)}</strong>
              <span className="hee-payout-meta">{settlement.lineCount || 0} {settlement.lineCount === 1 ? 'order' : 'orders'} · {dateTime(settlement.periodStart)} – {dateTime(settlement.periodEnd)}</span>
            </div>
            <Status status={settlement.status} />
          </div>
        )) : <div className="hee-payout-empty">
          <span className="hee-payout-empty-icon"><WalletCards size={20} aria-hidden="true" /></span>
          <div>
            <strong>{loading ? 'Loading settlements…' : 'No settlements yet'}</strong>
            <p>{loading ? 'Checking payout records.' : 'Payout records will appear here when they are created.'}</p>
          </div>
        </div>}
      </div>
    </section>
  </main>
}
