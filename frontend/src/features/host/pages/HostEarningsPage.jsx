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
/* Host earnings: Balanced Japandi editorial finance layout.
   Scoped to this page; global navigation and footer are unchanged. */
.hee-page {
  --hee-porcelain: #F7F6F2;
  --hee-forest: #173F35;
  --hee-charcoal: #202421;
  --hee-sage: #DCE0CF;
  --hee-clay: #C86C42;
  --hee-muted: #57655D;
  --hee-border: #D8DED3;
  --hee-surface: #FFFEFB;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  padding: clamp(20px, 2.6vw, 36px) clamp(16px, 3vw, 42px) 54px;
  background: var(--hee-porcelain);
  color: var(--hee-charcoal);
  font: 400 16px/1.6 'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, sans-serif;
}
.hee-page *, .hee-page *::before, .hee-page *::after { box-sizing: border-box; }
.hee-page :is(a, button) { font-family: inherit; }
.hee-page :is(a, button):focus-visible { outline: 3px solid var(--hee-clay); outline-offset: 3px; }
.hee-intro { border-bottom: 1px solid var(--hee-border); padding-bottom: 25px; }
.hee-intro-top { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.hee-kicker, .hee-section-label { display: inline-flex; align-items: center; gap: 11px; color: #975037; font-size: 13px; line-height: 1.5; font-weight: 700; text-transform: uppercase; letter-spacing: .055em; }
.hee-kicker::before { content: ''; display: block; width: 25px; height: 2px; background: var(--hee-clay); }
.hee-live-tools { display: flex; align-items: center; gap: 16px; }
.hee-live { display: inline-flex; align-items: center; gap: 9px; color: var(--hee-muted); font-size: 13.5px; font-weight: 600; white-space: nowrap; }
.hee-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #42835F; box-shadow: 0 0 0 4px #42835F20; }
.hee-refresh { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; padding: 10px 16px; border-radius: 12px; border: 1px solid #BBC7BB; background: #FFFEFB; color: var(--hee-forest); font-size: 14px; font-weight: 650; cursor: pointer; transition: background-color .18s ease, border-color .18s ease; }
.hee-refresh:hover:not(:disabled) { border-color: var(--hee-forest); background: #EEF1E9; }
.hee-refresh:disabled { opacity: .66; cursor: wait; }
.hee-heading-panel { display: flex; justify-content: space-between; align-items: flex-end; gap: 22px; margin-top: 23px; }
.hee-heading-panel h1 { margin: 0 0 7px!important; color: var(--hee-forest)!important; font-size: clamp(30px, 3.1vw, 38px)!important; line-height: 1.2!important; font-weight: 650!important; letter-spacing: -.042em!important; }
.hee-heading-panel p { margin: 0; color: var(--hee-muted); font-size: 16px; line-height: 1.6; }
.hee-updated { display: inline-block; flex: none; padding-bottom: 3px; font-size: 13.5px; line-height: 1.5; color: var(--hee-muted); text-align: right; }
.hee-snapshot { display: grid; grid-template-columns: minmax(290px, .88fr) minmax(0, 1.12fr); overflow: hidden; border-radius: 16px; margin-top: 26px; background: var(--hee-surface); border: 1px solid var(--hee-border); }
.hee-captured { position: relative; display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 32px 36px; min-height: 275px; background: var(--hee-forest); color: #F7F6F2; }
.hee-captured::before { content: ''; width: 38px; height: 3px; background: var(--hee-clay); position: absolute; top: 31px; left: 36px; }
.hee-captured-label { display: block; font-size: 15px; line-height: 1.5; font-weight: 600; color: #DCE0CF; margin-top: 15px; }
.hee-captured-value { display: block; color: #F7F6F2; margin: 7px 0 10px; font-size: clamp(38px, 4.3vw, 54px); font-weight: 650; line-height: 1.18; letter-spacing: -.052em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hee-captured-sub { display: block; max-width: 370px; color: #E0E8DD; font-size: 14px; line-height: 1.6; }
.hee-metrics { display: flex; flex-direction: column; min-width: 0; }
.hee-metric { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 20px 27px; flex: 1 1 0; min-width: 0; }
.hee-metric + .hee-metric { border-top: 1px solid var(--hee-border); }
.hee-metric[data-kind='await'] { background: #F9F1EB; }
.hee-metric-copy { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hee-metric-icon { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: #E8EEE3; flex: none; color: var(--hee-forest); }
.hee-metric[data-kind='await'] .hee-metric-icon { background: #F4DDD0; color: #9D5037; }
.hee-metric-text { display: block; min-width: 0; }
.hee-metric-label { display: block; color: var(--hee-charcoal); font-size: 15px; line-height: 1.4; font-weight: 650; }
.hee-metric-note { display: block; color: var(--hee-muted); margin-top: 3px; font-size: 13px; line-height: 1.45; }
.hee-metric-number { display: block; margin-left: 8px; flex: none; color: var(--hee-forest); font-size: clamp(23px, 2.2vw, 31px); line-height: 1.2; letter-spacing: -.045em; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; overflow-wrap: anywhere; }
.hee-metric[data-kind='await'] .hee-metric-number { color: #8F422D; }
.hee-error { margin-top: 18px; padding: 13px 18px; border-left: 3px solid #B3453E; background: #F8E7E4; color: #853C34; font-size: 14px; }
.hee-sales { min-width: 0; margin-top: 42px; }
.hee-section-header { display: flex; align-items: end; justify-content: space-between; gap: 18px; flex-wrap: wrap; padding: 0 0 19px; }
.hee-section-label { color: #A75B3A; }
.hee-section-header h2, .hee-payout-head h2 { margin: 5px 0 0!important; font-size: clamp(25px, 2.7vw, 30px)!important; line-height: 1.28!important; font-weight: 650!important; letter-spacing: -.036em!important; color: var(--hee-forest)!important; }
.hee-section-sub { margin: 5px 0 0; font-size: 15px; color: var(--hee-muted); line-height: 1.5; }
.hee-sales-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 19px; padding-bottom: 3px; }
.hee-count { color: var(--hee-muted); font-size: 14px; font-weight: 600; }
.hee-plain-link, .hee-payout-link { display: inline-flex; align-items: center; gap: 8px; width: fit-content; text-decoration: none; color: var(--hee-forest); font-size: 14px; font-weight: 700; border-bottom: 1px solid #8BA897; padding: 4px 0; transition: color .18s, border-color .18s; }
.hee-plain-link:hover, .hee-payout-link:hover { color: #9B4E32; border-bottom-color: var(--hee-clay); }
.hee-order-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0; border: 1px solid var(--hee-border); border-radius: 14px; overflow: hidden; background: var(--hee-surface); }
.hee-order { position: relative; min-width: 0; min-height: 115px; display: flex; align-items: center; gap: 14px; padding: 18px 18px; background: var(--hee-surface); border-bottom: 1px solid #E4E8E0; color: inherit; text-decoration: none; transition: background-color .18s ease; }
.hee-order:nth-child(2n) { border-left: 1px solid var(--hee-border); }
.hee-order:last-child, .hee-order:nth-last-child(2):nth-child(odd) { border-bottom: 0; }
.hee-order:hover { background: #F0F3EB; }
.hee-order:hover .hee-visit { border-color: var(--hee-forest); background: var(--hee-forest); color: #FFF; }
.hee-photo { flex: 0 0 70px; width: 70px; height: 70px; overflow: hidden; position: relative; background: #EFF1EB; border-radius: 10px; display: block; }
.hee-photo img { display: block; width: 100%; height: 100%; object-fit: contain; background: #FAFAF7; }
.hee-photo-blank { display: grid; place-items: center; height: 100%; padding: 5px; text-align: center; font-size: 12px; line-height: 1.3; color: var(--hee-muted); }
.hee-photo-number { position: absolute; right: 3px; bottom: 3px; padding: 2px 5px; background: var(--hee-forest); border-radius: 5px; font-size: 11px; line-height: 1.35; font-weight: 700; color: #FFF; }
.hee-order-information { display: block; flex: 1 1 auto; min-width: 0; }
.hee-product-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; color: var(--hee-charcoal); font-size: 15px; font-weight: 650; line-height: 1.45; }
.hee-product-meta { display: block; margin-top: 5px; color: var(--hee-muted); font-size: 12.5px; line-height: 1.5; overflow-wrap: anywhere; }
.hee-order-money { flex: 0 0 auto; min-width: 108px; align-self: center; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; text-align: right; }
.hee-order-price { color: var(--hee-forest); font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -.035em; white-space: nowrap; }
.hee-badge { display: inline-flex; align-items: center; padding: 4px 8px; background: #E5EFE5; color: #285D3C; border-radius: 6px; font-size: 12px; font-weight: 600; line-height: 1.35; text-align: center; }
.hee-badge[data-status='awaiting_settlement'] { background: #F9E6D9; color: #944A2F; }
.hee-badge[data-status='not_yet_settleable'] { background: #E4EEF1; color: #2D6474; }
.hee-badge[data-status='pending_approval'] { background: #EDE8F5; color: #5C4C7A; }
.hee-badge[data-status='rejected'], .hee-badge[data-status='void'] { background: #F6E4E3; color: #973F3A; }
.hee-visit { display: inline-grid; place-items: center; width: 24px; height: 24px; border: 1px solid #D6DFD6; border-radius: 50%; color: var(--hee-forest); transition: background-color .18s, border-color .18s, color .18s; }
.hee-sales-foot { display: flex; align-items: center; justify-content: space-between; gap: 15px; flex-wrap: wrap; padding: 13px 2px 0; }
.hee-sales-foot p { margin: 0; color: var(--hee-muted); font-size: 13.5px; }
.hee-empty-sales { grid-column: 1 / -1; padding: 32px 26px; color: var(--hee-muted); font-size: 15px; }
.hee-payouts { display: grid; grid-template-columns: minmax(250px, .64fr) minmax(0, 1.36fr); min-width: 0; margin-top: 39px; overflow: hidden; border-radius: 14px; border: 1px solid var(--hee-border); background: var(--hee-surface); }
.hee-payout-head { min-width: 0; padding: 31px 32px; background: var(--hee-sage); }
.hee-payout-head .hee-section-label { color: #74503D; }
.hee-payout-head p { color: #4D5F54; font-size: 15px; margin: 8px 0 19px; line-height: 1.5; }
.hee-payout-link { color: var(--hee-forest); }
.hee-payout-list { display: flex; flex-direction: column; justify-content: center; min-width: 0; padding: 18px 30px; }
.hee-payout-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 15px 0; border-bottom: 1px solid var(--hee-border); }
.hee-payout-row:last-child { border-bottom: 0; }
.hee-payout-value { display: block; color: var(--hee-forest); font-size: 22px; font-weight: 650; line-height: 1.25; font-variant-numeric: tabular-nums; }
.hee-payout-meta { display: block; margin-top: 5px; color: var(--hee-muted); font-size: 13px; line-height: 1.5; }
.hee-payout-empty { display: flex; align-items: center; gap: 17px; padding: 16px 0; }
.hee-payout-empty-icon { display: inline-grid; flex: none; place-items: center; width: 46px; height: 46px; border-radius: 12px; color: var(--hee-forest); background: #E8EEE4; }
.hee-payout-empty strong { display: block; color: var(--hee-forest); font-size: 16px; line-height: 1.4; font-weight: 650; }
.hee-payout-empty p { margin: 4px 0 0; color: var(--hee-muted); font-size: 14px; line-height: 1.55; }
@media (max-width: 1150px) {
  .hee-metric { padding: 18px 20px; }
  .hee-order { gap: 11px; padding: 16px 13px; }
  .hee-photo { width: 62px; height: 66px; flex-basis: 62px; }
  .hee-order-money { min-width: 98px; }
  .hee-product-name { font-size: 14.5px; }
}
@media (max-width: 980px) {
  .hee-order-list { grid-template-columns: 1fr; }
  .hee-order:nth-child(2n) { border-left: 0; }
  .hee-order:nth-last-child(2) { border-bottom: 1px solid #E4E8E0; }
  .hee-order { min-height: 101px; padding: 14px 22px; }
  .hee-photo { width: 68px; height: 70px; flex-basis: 68px; }
}
@media (max-width: 760px) {
  .hee-page { padding: 18px 16px 40px; }
  .hee-intro { padding-bottom: 19px; }
  .hee-heading-panel { align-items: flex-start; flex-direction: column; gap: 10px; margin-top: 19px; }
  .hee-updated { text-align: left; }
  .hee-snapshot { grid-template-columns: 1fr; margin-top: 21px; }
  .hee-captured { min-height: 205px; padding: 30px 26px 26px; }
  .hee-captured::before { left: 26px; top: 23px; }
  .hee-captured-value { font-size: 41px; }
  .hee-metric { min-height: 86px; padding: 16px 22px; }
  .hee-sales { margin-top: 29px; }
  .hee-payouts { margin-top: 30px; grid-template-columns: 1fr; }
  .hee-payout-head { padding: 22px 24px; }
  .hee-payout-list { padding: 14px 24px; }
}
@media (max-width: 520px) {
  .hee-page { padding: 15px 12px 35px; }
  .hee-intro-top { gap: 8px; }
  .hee-kicker, .hee-section-label { font-size: 12.5px; }
  .hee-live-tools { gap: 11px; }
  .hee-live { font-size: 12.5px; }
  .hee-refresh { min-height: 44px; padding: 9px 11px; font-size: 13px; }
  .hee-heading-panel h1 { font-size: 30px!important; }
  .hee-heading-panel p { font-size: 15px; }
  .hee-snapshot { border-radius: 13px; }
  .hee-captured { min-height: 194px; padding: 29px 21px 23px; }
  .hee-captured::before { left: 21px; }
  .hee-captured-label { font-size: 14px; }
  .hee-captured-value { font-size: clamp(33px, 9vw, 41px); }
  .hee-captured-sub { font-size: 13.5px; }
  .hee-metric { padding: 15px 16px; gap: 8px; }
  .hee-metric-copy { gap: 10px; }
  .hee-metric-icon { width: 36px; height: 36px; border-radius: 10px; }
  .hee-metric-label { font-size: 14px; }
  .hee-metric-note { font-size: 12.5px; }
  .hee-metric-number { font-size: clamp(21px, 6.1vw, 26px); margin-left: 3px; }
  .hee-section-header { align-items: flex-start; gap: 12px; }
  .hee-section-header h2, .hee-payout-head h2 { font-size: 26px!important; }
  .hee-section-sub { font-size: 14px; }
  .hee-sales-actions { gap: 16px; }
  .hee-order { padding: 13px 11px; min-height: 94px; gap: 9px; }
  .hee-photo { width: 57px; height: 61px; flex-basis: 57px; border-radius: 8px; }
  .hee-product-name { font-size: 14px; }
  .hee-product-meta { font-size: 12px; }
  .hee-order-money { min-width: 94px; gap: 5px; }
  .hee-order-price { font-size: 15px; }
  .hee-badge { font-size: 11.5px; padding: 4px 6px; }
  .hee-sales-foot { padding-top: 12px; }
  .hee-payout-head { padding: 22px 20px; }
  .hee-payout-list { padding: 10px 20px; }
  .hee-payout-row { align-items: flex-start; flex-wrap: wrap; gap: 9px; }
}
@media (max-width: 365px) {
  .hee-live-tools { gap: 8px; }
  .hee-live { font-size: 11.5px; }
  .hee-refresh { padding: 8px 9px; }
  .hee-order { gap: 7px; padding-left: 8px; padding-right: 8px; }
  .hee-photo { width: 48px; height: 54px; flex-basis: 48px; }
  .hee-order-money { min-width: 88px; }
  .hee-order-price { font-size: 14px; }
  .hee-badge { font-size: 11px; }
  .hee-metric-icon { width: 32px; height: 32px; }
  .hee-metric-copy { gap: 7px; }
  .hee-metric-label { font-size: 13px; }
  .hee-metric-note { font-size: 12px; }
  .hee-metric-number { font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) { .hee-page :is(a, button) { transition: none !important; } }
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
            <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="hee-heading-panel">
        <div>
          <h1>Your earnings</h1>
          <p>Sales, payments and payouts for your business, all in one place.</p>
        </div>
        <span className="hee-updated">Updated {earnings.refreshedAt ? dateTime(earnings.refreshedAt) : 'when data is available'}</span>
      </div>
    </header>

    <section className="hee-snapshot" aria-label="Earnings summary">
      <div className="hee-captured">
        <span className="hee-captured-label">Total captured revenue</span>
        <strong className="hee-captured-value">{loading ? '—' : currencyMinor(earnings.totalEarnedMinor, currency)}</strong>
        <span className="hee-captured-sub">Received from successful customer payments</span>
      </div>
      <div className="hee-metrics">
        <div className="hee-metric" data-kind="paid">
          <span className="hee-metric-copy">
            <span className="hee-metric-icon"><Check size={20} aria-hidden="true" /></span>
            <span className="hee-metric-text"><span className="hee-metric-label">Paid to you</span><span className="hee-metric-note">Completed payouts</span></span>
          </span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.paidMinor, currency)}</strong>
        </div>
        <div className="hee-metric" data-kind="process">
          <span className="hee-metric-copy">
            <span className="hee-metric-icon"><WalletCards size={20} aria-hidden="true" /></span>
            <span className="hee-metric-text"><span className="hee-metric-label">In settlement</span><span className="hee-metric-note">Under review or approved</span></span>
          </span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.inSettlementMinor, currency)}</strong>
        </div>
        <div className="hee-metric" data-kind="await">
          <span className="hee-metric-copy">
            <span className="hee-metric-icon"><Clock3 size={20} aria-hidden="true" /></span>
            <span className="hee-metric-text"><span className="hee-metric-label">Awaiting settlement</span><span className="hee-metric-note">Delivered, not settled yet</span></span>
          </span>
          <strong className="hee-metric-number">{loading ? '—' : currencyMinor(earnings.awaitingSettlementMinor, currency)}</strong>
        </div>
      </div>
    </section>

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
          <Link className="hee-plain-link" to="/host/orders">All orders <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="hee-order-list">
        {recentOrders.length ? recentOrders.map((order) => (
          <OrderSale key={order.sellerOrderId} order={order} images={images} currency={currency} />
        )) : <div className="hee-empty-sales">{loading ? 'Loading your orders…' : 'No paid orders yet.'}</div>}
      </div>
      <div className="hee-sales-foot">
        <p>{loading ? 'Loading sales…' : `Showing ${recentOrders.length} recent ${recentOrders.length === 1 ? 'order' : 'orders'}`}</p>
        <Link className="hee-plain-link" to="/host/orders">Manage orders <ArrowRight size={17} aria-hidden="true" /></Link>
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
          <span className="hee-payout-empty-icon"><WalletCards size={21} aria-hidden="true" /></span>
          <div>
            <strong>{loading ? 'Loading settlements…' : 'No settlements yet'}</strong>
            <p>{loading ? 'Checking payout records.' : 'Payout records will appear here when they are created.'}</p>
          </div>
        </div>}
      </div>
    </section>
  </main>
}
