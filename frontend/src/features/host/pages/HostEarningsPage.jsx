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
/* EPANTRY Host Earnings. Local styles only; global shell remains untouched. */
.hee-page{box-sizing:border-box;--forest:#173F35;--forest-deep:#113A30;--forest-2:#24594A;--clay:#C66E48;--clay-dark:#A84D2D;--sage:#E4EBE1;--sage-dark:#CDD9CB;--porcelain:#F7F6F2;--charcoal:#252B27;--ink-muted:#58695F;--line:#D9E1D7;min-width:0;width:100%;background:var(--porcelain);color:var(--charcoal);font:400 16px/1.5 'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;padding:clamp(14px,2.2vw,34px) clamp(12px,2.5vw,38px) 54px}
.hee-page *,.hee-page *::before,.hee-page *::after{box-sizing:border-box}
.hee-page :is(button,a){font:inherit}
.hee-page :is(button,a):focus-visible{outline:3px solid #C66E48;outline-offset:3px}
.hee-top{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,.68fr);border:1px solid #D8E0D6;border-radius:15px;overflow:hidden;background:var(--forest);min-width:0}
.hee-top-main{position:relative;padding:clamp(26px,3.4vw,46px);overflow:hidden;isolation:isolate;background:linear-gradient(118deg,#123A30 0%,#1B4C3E 100%)}
.hee-top-main::after{content:'';position:absolute;width:330px;height:330px;right:-160px;top:-165px;border:1px solid #FFFFFF22;border-radius:50%;box-shadow:0 0 0 39px #FFFFFF08,0 0 0 78px #FFFFFF05;pointer-events:none;z-index:-1}
.hee-kicker{display:flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#F2BB99}
.hee-kicker::before{content:'';width:22px;height:2px;background:var(--clay)}
.hee-top h1{margin:13px 0 0;color:#FDFCF9;font-size:clamp(34px,3.4vw,48px)!important;line-height:1.09!important;letter-spacing:-.052em!important;font-weight:810!important}
.hee-lead{max-width:575px;margin:14px 0 0;color:#E2E9E2;font-size:15px;line-height:1.65}
.hee-top-bottom{display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin-top:28px}
.hee-live{display:inline-flex;align-items:center;gap:8px;color:#D6E9DA;font-size:13px;font-weight:650}
.hee-live::before{content:'';width:7px;height:7px;background:#9FCEAC;border-radius:50%;box-shadow:0 0 0 3px #9FCEAC22}
.hee-refresh{display:inline-flex;justify-content:center;align-items:center;gap:7px;min-height:39px;border:1px solid #8AA798;border-radius:7px;padding:8px 13px;color:white;background:#FFFFFF12;font-size:13px!important;font-weight:750!important;cursor:pointer;transition:background .18s,border-color .18s}
.hee-refresh:hover:not(:disabled){background:#FFFFFF25;border-color:#D1E4D5}.hee-refresh:disabled{opacity:.65;cursor:wait}
.hee-top-figure{display:flex;flex-direction:column;justify-content:center;background:#E4ECE2;border-left:4px solid var(--clay);padding:clamp(22px,2.6vw,34px);min-width:0}
.hee-figure-label{font-size:13px;color:#446455;font-weight:800}
.hee-figure-value{font-size:clamp(34px,3.3vw,49px);font-weight:820;letter-spacing:-.055em;line-height:1.16;color:var(--forest);margin-top:10px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.hee-figure-caption{font-size:14px;color:#51685B;margin-top:10px;line-height:1.55}
.hee-last-refresh{padding-top:13px;margin-top:20px;border-top:1px solid #C9D6CA;font-size:12.5px;color:#597062}
.hee-error{margin-top:17px;border-left:4px solid #B8473F;background:#FAECE7;padding:13px 16px;color:#8B3A2F;font-size:14px;font-weight:650}
.hee-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:20px;background:#FEFDF9;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.hee-metric{padding:21px clamp(17px,2.2vw,29px);min-width:0;border-right:1px solid var(--line);border-top:3px solid transparent}
.hee-metric:last-child{border-right:0}.hee-metric[data-type='paid']{border-top-color:#396E51}.hee-metric[data-type='process']{border-top-color:#7B997D;background:#EDF2EB}.hee-metric[data-type='await']{border-top-color:var(--clay);background:#F9EDE6}
.hee-metric-head{display:flex;align-items:center;gap:9px;font-size:14px;color:#4A5F53;font-weight:750}
.hee-metric-head svg{color:#447762;flex:none}.hee-metric[data-type='await'] .hee-metric-head svg{color:var(--clay-dark)}
.hee-metric strong{display:block;margin:9px 0 0;font-size:clamp(25px,2.4vw,34px);font-weight:815;letter-spacing:-.04em;line-height:1.25;color:var(--forest);font-variant-numeric:tabular-nums}
.hee-metric small{display:block;margin-top:5px;font-size:12.5px;color:#627167;line-height:1.4}
.hee-main-grid{display:grid;grid-template-columns:minmax(0,1.62fr) minmax(305px,.82fr);gap:22px;align-items:start;margin-top:30px;min-width:0}
.hee-sales{min-width:0;background:#FFFEFB;border:1px solid var(--line);border-top:3px solid var(--clay);border-radius:11px;overflow:hidden}
.hee-section-header{display:flex;align-items:flex-end;justify-content:space-between;gap:15px;flex-wrap:wrap;padding:25px 26px 19px;border-bottom:1px solid var(--line)}
.hee-section-number{font-size:12px;font-weight:800;letter-spacing:.055em;text-transform:uppercase;color:#B15433}
.hee-section-header h2{font-size:clamp(23px,2.1vw,29px)!important;font-weight:810!important;letter-spacing:-.04em!important;line-height:1.22!important;margin:6px 0 0;color:var(--forest)}
.hee-section-descriptor{font-size:14px;color:var(--ink-muted);margin:6px 0 0}
.hee-heading-count{color:var(--forest);background:#E9EFE7;padding:6px 11px;border-radius:5px;font-size:13px;font-weight:800;white-space:nowrap}
.hee-row-head{display:grid;grid-template-columns:minmax(0,1.1fr) 116px 152px;align-items:center;gap:14px;padding:11px 26px;background:#F1F4EE;border-bottom:1px solid var(--line);font-size:12px;color:#53685B;font-weight:750}
.hee-row-head span:last-child{text-align:right}
.hee-order-list{max-height:756px;overflow:auto;overscroll-behavior:auto;scrollbar-color:#B7C6B5 #F9FAF6;scrollbar-width:thin}
.hee-order{display:grid;grid-template-columns:minmax(0,1.1fr) 116px 152px;gap:14px;align-items:center;min-width:0;padding:15px 26px;border-bottom:1px solid #E6EAE3;background:#FFFEFB;color:inherit;text-decoration:none;transition:background .18s}
.hee-order:nth-child(even){background:#F8F9F5}.hee-order:last-child{border-bottom:0}
.hee-order:hover{background:#EAF1E8}.hee-order:focus-visible{position:relative;z-index:1}
.hee-product{display:flex;align-items:center;gap:13px;min-width:0}
.hee-photo{display:block;position:relative;flex:0 0 64px;width:64px;height:68px;background:#EDF1E9;border:1px solid #E1E6DE;border-radius:8px;overflow:hidden}
.hee-photo img{width:100%;height:100%;object-fit:contain;background:#F8F8F3;display:block}
.hee-photo-blank{height:100%;display:grid;place-items:center;text-align:center;color:#87998B;font-size:11px;font-weight:700;line-height:1.2}
.hee-photo-number{position:absolute;right:2px;bottom:2px;background:var(--forest);color:white;font-size:10px;font-weight:800;border-radius:4px;padding:2px 5px}
.hee-product-copy{display:block;min-width:0}
.hee-product-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:15px;line-height:1.38;font-weight:790;color:var(--forest);overflow-wrap:anywhere}
.hee-product-meta{display:block;font-size:12px;color:#607168;margin-top:4px}
.hee-order-price{font-size:15px;font-weight:805;color:var(--charcoal);font-variant-numeric:tabular-nums;white-space:nowrap}
.hee-order-right{display:flex;flex-direction:column;align-items:flex-end;gap:7px;min-width:0}
.hee-badge{display:inline-flex;align-items:center;border-radius:5px;padding:4px 8px;font-size:11.5px;font-weight:760;line-height:1.35;white-space:normal;text-align:center;background:#E2ECE6;color:#2B5D43}
.hee-badge[data-status='awaiting_settlement']{background:#F8E5D8;color:#A24F2F}
.hee-badge[data-status='not_yet_settleable']{background:#E5EFF1;color:#366A70}
.hee-badge[data-status='pending_approval']{background:#EBE8F2;color:#625077}
.hee-badge[data-status='approved']{background:#E5EFE7;color:#285E43}
.hee-badge[data-status='rejected'],.hee-badge[data-status='void']{background:#F7E7E5;color:#A04440}
.hee-updated{font-size:12px;color:#627369;text-align:right}
.hee-order-arrow{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#A85432;font-weight:800}
.hee-sales-bottom{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:14px 26px;background:#F7F8F4;border-top:1px solid var(--line)}
.hee-sales-bottom p{margin:0;color:#5D7062;font-size:13px}.hee-text-link{display:inline-flex;align-items:center;gap:6px;color:var(--forest);text-decoration:none;font-size:13px;font-weight:800;white-space:nowrap}
.hee-text-link:hover{text-decoration:underline;text-underline-offset:4px;color:#A85432}
.hee-empty{padding:34px 26px;color:#5F7064;font-size:14px}
.hee-settlements{min-width:0;background:#E8EEE5;border:1px solid #D5E0D4;border-top:3px solid #3E745F;border-radius:11px;overflow:hidden}
.hee-settlements .hee-section-header{padding:25px 25px 19px;border-color:#CFDCCF}
.hee-settlements .hee-section-number{color:#476E5C}
.hee-settlement-list{padding:0 25px}
.hee-settlement{padding:17px 0;border-bottom:1px solid #CEDBCE}
.hee-settlement-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.hee-settlement-money{color:var(--forest);font-size:21px;font-weight:820;line-height:1.3;letter-spacing:-.035em;white-space:nowrap}
.hee-settlement-sub{display:block;margin-top:5px;font-size:13px;color:#637167}
.hee-settlement-time{margin-top:10px;font-size:12.5px;color:#53665A}
.hee-settlement-empty{margin:20px 0;color:#52685A;font-size:14px;line-height:1.55}
.hee-finance-link{display:flex;align-items:center;justify-content:space-between;gap:13px;background:var(--forest);padding:15px 24px;color:white;text-decoration:none;font-size:14px;font-weight:780;transition:background .18s}
.hee-finance-link:hover{background:#245748}
.hee-bottom-note{margin-top:24px;border-top:1px solid var(--line);padding:17px 2px 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px;color:#5A6A5F}
.hee-bottom-note strong{color:var(--forest);font-weight:760}
@media(max-width:1150px){.hee-main-grid{grid-template-columns:minmax(0,1fr)}.hee-order-list{max-height:708px}.hee-settlements{max-width:none}.hee-settlement-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:26px}.hee-settlement:nth-last-child(2){border-bottom:0}}
@media(max-width:730px){.hee-page{padding:12px 11px 35px}.hee-top{grid-template-columns:1fr}.hee-top-main{padding:26px 22px}.hee-top h1{font-size:35px!important}.hee-lead{font-size:14px;margin-top:10px}.hee-top-bottom{margin-top:19px}.hee-top-figure{border-left:0;border-top:3px solid var(--clay);padding:18px 22px 19px}.hee-figure-value{font-size:34px}.hee-figure-caption{font-size:13px;margin-top:4px}.hee-last-refresh{margin-top:12px;padding-top:9px}.hee-metrics{margin-top:13px}.hee-metric{padding:16px 12px}.hee-metric-head{font-size:12.5px}.hee-metric strong{font-size:24px}.hee-metric small{font-size:12px}.hee-main-grid{margin-top:22px;gap:20px}.hee-section-header{padding:20px 17px 16px}.hee-section-header h2{font-size:24px!important}.hee-section-descriptor{font-size:13px}.hee-row-head{display:none}.hee-order{padding:14px 15px;grid-template-columns:minmax(0,1fr) auto;gap:10px}.hee-product{grid-column:1;gap:11px}.hee-photo{width:56px;height:60px;flex-basis:56px}.hee-product-name{font-size:14px}.hee-product-meta{font-size:11.5px}.hee-order-price{grid-column:2;grid-row:1;align-self:start;font-size:14px;text-align:right;margin-top:3px}.hee-order-right{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;gap:9px;padding-left:67px}.hee-updated{font-size:11.5px;text-align:left}.hee-order-arrow{margin-left:auto}.hee-sales-bottom{padding:14px 16px}.hee-settlements .hee-section-header{padding:20px 17px 15px}.hee-settlement-list{padding:0 18px}.hee-settlement-money{font-size:19px}}
@media(max-width:460px){.hee-metrics{grid-template-columns:1fr 1fr}.hee-metric{border-right:0;border-bottom:1px solid var(--line)}.hee-metric[data-type='paid']{grid-column:1/-1}.hee-metric[data-type='process']{border-right:1px solid var(--line);border-bottom:0}.hee-metric[data-type='await']{border-bottom:0}.hee-metric strong{font-size:25px}.hee-order{grid-template-columns:1fr}.hee-product{grid-column:1}.hee-order-price{grid-column:1;grid-row:2;justify-self:start;margin:0 0 0 67px}.hee-order-right{grid-row:3;padding-left:67px;flex-wrap:wrap}.hee-order-arrow{margin-left:auto}.hee-settlement-list{display:block}.hee-settlement:nth-last-child(2){border-bottom:1px solid #CEDBCE}.hee-section-header{align-items:start}.hee-heading-count{font-size:12px}.hee-sales-bottom{align-items:flex-start}.hee-sales-bottom p{max-width:48%}.hee-bottom-note{gap:7px}}
@media(prefers-reduced-motion:reduce){.hee-page :is(a,button){transition:none!important}}
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
    <span className="hee-product">
      <ProductPhoto src={image} name={name} count={count} />
      <span className="hee-product-copy">
        <strong className="hee-product-name">{title}</strong>
        <span className="hee-product-meta">Order #{shortOrderId(order.sellerOrderId)}</span>
      </span>
    </span>
    <strong className="hee-order-price">{currencyMinor(priceMinor, order.currency || currency)}</strong>
    <span className="hee-order-right">
      <Status status={order.settlementStatus} />
      <span className="hee-updated">{dateTime(order.updatedAt || order.createdAt)}</span>
      <span className="hee-order-arrow">View order <ArrowRight size={14} aria-hidden="true" /></span>
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

    <header className="hee-top">
      <div className="hee-top-main">
        <div className="hee-kicker">Host / Earnings</div>
        <h1>Your earnings</h1>
        <p className="hee-lead">Track what customers have paid, what is being settled, and what has reached your business.</p>
        <div className="hee-top-bottom">
          <span className="hee-live">Updated every 10 seconds</span>
          <button type="button" className="hee-refresh" onClick={() => load({ quiet: true })}
            disabled={refreshing}>
            <RefreshCw size={15} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div className="hee-top-figure">
        <span className="hee-figure-label">Total captured sales</span>
        <strong className="hee-figure-value">{loading ? '—' : currencyMinor(earnings.totalEarnedMinor, currency)}</strong>
        <p className="hee-figure-caption">From successful customer payments.</p>
        <span className="hee-last-refresh">Last updated: {earnings.refreshedAt ? dateTime(earnings.refreshedAt) : 'Waiting for data'}</span>
      </div>
    </header>

    {error ? <div className="hee-error" role="alert">{error}</div> : null}

    <section className="hee-metrics" aria-label="Earnings summary">
      <div className="hee-metric" data-type="paid">
        <span className="hee-metric-head"><Check size={17} aria-hidden="true" /> Paid to you</span>
        <strong>{loading ? '—' : currencyMinor(earnings.paidMinor, currency)}</strong>
        <small>Settlements marked paid</small>
      </div>
      <div className="hee-metric" data-type="process">
        <span className="hee-metric-head"><WalletCards size={17} aria-hidden="true" /> In settlement</span>
        <strong>{loading ? '—' : currencyMinor(earnings.inSettlementMinor, currency)}</strong>
        <small>Under review or approved</small>
      </div>
      <div className="hee-metric" data-type="await">
        <span className="hee-metric-head"><Clock3 size={17} aria-hidden="true" /> Awaiting settlement</span>
        <strong>{loading ? '—' : currencyMinor(earnings.awaitingSettlementMinor, currency)}</strong>
        <small>Delivered, not settled yet</small>
      </div>
    </section>

    <div className="hee-main-grid">
      <section className="hee-sales" aria-labelledby="hee-products-title">
        <div className="hee-section-header">
          <div>
            <span className="hee-section-number">01 / Sales history</span>
            <h2 id="hee-products-title">Products sold</h2>
            <p className="hee-section-descriptor">Your latest paid orders, with their actual products.</p>
          </div>
          <span className="hee-heading-count">{loading ? '—' : Number(earnings.capturedOrders || 0)} paid orders</span>
        </div>
        <div className="hee-row-head"><span>Product</span><span>Amount</span><span>Payment status</span></div>
        <div className="hee-order-list">
          {recentOrders.length ? recentOrders.map((order) => (
            <OrderSale key={order.sellerOrderId} order={order} images={images} currency={currency} />
          )) : <div className="hee-empty">{loading ? 'Loading your orders…' : 'No paid orders yet.'}</div>}
        </div>
        <div className="hee-sales-bottom">
          <p>Latest {recentOrders.length} orders</p>
          <Link className="hee-text-link" to="/host/orders">All orders <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="hee-settlements" aria-labelledby="hee-settlement-title">
        <div className="hee-section-header">
          <div>
            <span className="hee-section-number">02 / Payment progress</span>
            <h2 id="hee-settlement-title">Settlements</h2>
            <p className="hee-section-descriptor">Your payout history and current status.</p>
          </div>
          <span className="hee-heading-count">{recentSettlements.length} records</span>
        </div>
        <div className="hee-settlement-list">
          {recentSettlements.length ? recentSettlements.map((settlement) => (
            <div className="hee-settlement" key={settlement.id}>
              <div className="hee-settlement-top">
                <div>
                  <strong className="hee-settlement-money">{currencyMinor(settlement.totals?.netPayableMinor, settlement.currency || currency)}</strong>
                  <span className="hee-settlement-sub">{settlement.lineCount || 0} {settlement.lineCount === 1 ? 'order' : 'orders'}</span>
                </div>
                <Status status={settlement.status} />
              </div>
              <div className="hee-settlement-time">{dateTime(settlement.periodStart)} – {dateTime(settlement.periodEnd)}</div>
            </div>
          )) : <p className="hee-settlement-empty">{loading ? 'Loading settlements…' : 'No settlements recorded yet. They will appear after eligible deliveries are reviewed.'}</p>}
        </div>
        <Link className="hee-finance-link" to="/host/finance">
          Payments &amp; Finance <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>

    <div className="hee-bottom-note">
      <span><strong>Sales are read-only here.</strong> Manage each order from the Orders page.</span>
      <Link to="/host/orders" className="hee-text-link">Manage orders <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
  </main>
}
