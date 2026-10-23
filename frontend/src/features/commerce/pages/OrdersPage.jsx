import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  ArrowRight,
  PackageCheck,
  RefreshCw,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  listOrders,
} from '../services/commerce.service'

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Not available'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}

function formatStatus(
  value,
) {
  return String(
    value ||
      'unknown',
  )
    .split(
      '_',
    )
    .map(
      (
        token,
      ) =>
        `${token
          .charAt(
            0,
          )
          .toUpperCase()}${token.slice(
          1,
        )}`,
    )
    .join(
      ' ',
    )
}

function getOrderDisplayTitle(order) {
  const primaryItemName = String(
    order?.primaryItemName ||
      '',
  ).trim()

  const itemCount = Math.max(
    0,
    Number(
      order?.itemCount ||
        0,
    ) || 0,
  )

  if (primaryItemName) {
    return itemCount > 1
      ? `${primaryItemName} + ${itemCount - 1} more`
      : primaryItemName
  }

  return 'EPANTRY order'
}

const SELLER_STATUS_ORDER = [
  'delivery_failed',
  'seller_cancelled',
  'rejected',
  'partial_unavailable',
  'out_for_delivery',
  'carrier_handoff',
  'packed',
  'picking',
  'seller_accepted',
  'confirmed',
  'delivered',
]

function sellerProgressClass(
  status,
) {
  const normalized =
    String(
      status ||
        '',
    ).toLowerCase()

  if (normalized === 'delivered') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  }

  if (normalized === 'out_for_delivery') {
    return 'border-indigo-200 bg-indigo-100 text-indigo-800'
  }

  if (normalized === 'carrier_handoff') {
    return 'border-sky-200 bg-sky-100 text-sky-800'
  }

  if (
    [
      'seller_cancelled',
      'rejected',
      'partial_unavailable',
      'delivery_failed',
    ].includes(
      normalized,
    )
  ) {
    return 'border-rose-200 bg-rose-100 text-rose-800'
  }

  if (
    [
      'packed',
      'picking',
      'seller_accepted',
    ].includes(
      normalized,
    )
  ) {
    return 'border-violet-200 bg-violet-100 text-violet-800'
  }

  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function sellerProgressGroups(
  order,
) {
  const counts =
    order?.sellerStatusCounts ||
    {}

  const statuses =
    Object.keys(
      counts,
    )
      .filter(
        (status) =>
          Number(
            counts[status] ||
              0,
          ) >
          0,
      )
      .sort(
        (left, right) => {
          const leftIndex =
            SELLER_STATUS_ORDER.indexOf(
              left,
            )

          const rightIndex =
            SELLER_STATUS_ORDER.indexOf(
              right,
            )

          return (
            (leftIndex === -1
              ? 999
              : leftIndex) -
            (rightIndex === -1
              ? 999
              : rightIndex)
          )
        },
      )

  return statuses.map(
    (status) => ({
      status,
      count:
        Number(
          counts[status] ||
            0,
        ),
    }),
  )
}


function orderTone(value) {
  const status = String(value || '').toLowerCase()

  if (['paid', 'delivered'].includes(status)) return 'is-success'
  if (['confirmed', 'out_for_delivery', 'carrier_handoff'].includes(status)) return 'is-info'
  if (['pending', 'payment_pending', 'picking', 'packed', 'seller_accepted'].includes(status)) return 'is-pending'
  if (['failed', 'rejected', 'cancelled', 'seller_cancelled', 'delivery_failed', 'partial_unavailable'].includes(status)) return 'is-danger'
  return 'is-neutral'
}

function formatOrderDate(value) {
  if (!value) return 'Created time unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Created time unavailable'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

const ordersDesign = `
.ep-orders {
  --ep-porcelain:#F7F6F2;
  --ep-forest:#173F35;
  --ep-charcoal:#202421;
  --ep-sage:#D7DDCF;
  --ep-clay:#C56C42;
  --ep-line:#d3d9cf;
  font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;
  color:var(--ep-charcoal);
  background:var(--ep-porcelain);
  width:100%;
}
.ep-orders,.ep-orders * {box-sizing:border-box;}
.ep-orders__content {width:100%;margin:0;padding:26px clamp(18px,3vw,48px) 60px;}

/* A composed editorial introduction, with the actual order total as the feature. */
.ep-orders__intro {
  position:relative;isolation:isolate;overflow:hidden;
  display:grid;grid-template-columns:minmax(0,1.55fr) minmax(240px,.55fr);
  min-height:234px;
  background:var(--ep-porcelain);
  border:1px solid var(--ep-line);border-top:4px solid var(--ep-clay);
  border-radius:18px 18px 4px 4px;
  box-shadow:0 18px 34px rgba(23,63,53,.075);
}
.ep-orders__intro-copy {
  position:relative;align-self:stretch;display:flex;flex-direction:column;justify-content:center;
  min-width:0;padding:clamp(26px,3.7vw,52px);
  background:linear-gradient(110deg,var(--ep-porcelain) 0%,#eef0e8 100%);
}
.ep-orders__eyebrow {
  display:flex;align-items:center;gap:11px;color:var(--ep-forest);
  font-size:13px;font-weight:700;letter-spacing:.075em;text-transform:uppercase;
}
.ep-orders__eyebrow:before {content:'';width:28px;height:3px;background:var(--ep-clay);flex-shrink:0;}
.ep-orders__intro h1 {
  max-width:770px;margin:18px 0 0;
  font-size:clamp(36px,3.65vw,56px);line-height:1.1;letter-spacing:-.045em;
  font-weight:650;color:var(--ep-charcoal);
}
.ep-orders__intro h1 em {font-style:normal;color:var(--ep-forest);}
.ep-orders__refresh {
  align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;gap:10px;
  margin-top:28px;min-height:44px;padding:11px 19px;
  border:1px solid var(--ep-forest);border-radius:7px;
  background:var(--ep-forest);color:var(--ep-porcelain);
  font:650 14px/1.25 'Plus Jakarta Sans',Inter,sans-serif;
  cursor:pointer;transition:background .2s ease,transform .2s ease,box-shadow .2s ease;
}
.ep-orders__refresh:hover:not(:disabled) {
  background:#245c4c;transform:translateY(-2px);box-shadow:0 9px 18px rgba(23,63,53,.17);
}
.ep-orders__refresh:disabled {opacity:.55;cursor:wait;}
.ep-orders__insight {
  min-width:0;display:flex;flex-direction:column;justify-content:center;
  position:relative;padding:31px clamp(25px,3vw,48px);
  border-left:4px solid var(--ep-clay);
  background:var(--ep-forest);color:var(--ep-porcelain);
}
.ep-orders__insight:before {
  content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(145deg,transparent 35%,rgba(215,221,207,.11) 100%);
}
.ep-orders__insight-label,.ep-orders__insight-number,.ep-orders__insight-sub,.ep-orders__insight-rule,.ep-orders__insight-last {position:relative;z-index:1;}
.ep-orders__insight-label {color:#dde9dc;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.ep-orders__insight-number {
  margin:12px 0 3px;font-size:clamp(58px,5vw,78px);font-weight:650;
  line-height:1;letter-spacing:-.055em;font-variant-numeric:tabular-nums;
}
.ep-orders__insight-sub {margin:0;font-size:14px;line-height:1.45;color:#e2e9df;}
.ep-orders__insight-rule {height:1px;background:rgba(247,246,242,.27);margin:22px 0 14px;}
.ep-orders__insight-last {margin:0;font-size:12px;line-height:1.5;color:#dde5db;}
.ep-orders__insight-last strong {display:block;margin-top:4px;color:var(--ep-porcelain);font-size:15px;font-weight:650;}
.ep-orders__error {margin-top:20px;padding:16px 20px;border-left:4px solid #b75144;background:#fff0e9;color:#713b34;font-size:15px;line-height:1.5;}

/* Clay-led latest purchase: a warm, editorial receipt with strong contrast. */
.ep-orders__section[aria-labelledby="latest-order-title"] .ep-orders__section-head h2 {color:var(--ep-charcoal);}
.ep-orders__section[aria-labelledby="orders-history-title"] .ep-orders__section-label {color:var(--ep-clay);}
.ep-orders__section {margin-top:38px;}
.ep-orders__section-head {display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:18px;}
.ep-orders__section-label {color:var(--ep-clay);font-size:13px;font-weight:750;letter-spacing:.07em;text-transform:uppercase;}
.ep-orders__section-head h2 {
  color:var(--ep-charcoal);font-size:clamp(24px,2.1vw,31px);font-weight:650;
  letter-spacing:-.035em;line-height:1.18;margin:8px 0 0;
}
.ep-orders__section-note {margin:0 0 2px;max-width:340px;text-align:right;color:#657067;font-size:14px;line-height:1.5;}
.ep-orders__feature {
  display:grid;grid-template-columns:minmax(0,1fr) minmax(235px,315px);
  min-height:218px;overflow:hidden;position:relative;isolation:isolate;
  background:#f4d4c2;color:var(--ep-charcoal);text-decoration:none;
  border:1px solid rgba(197,108,66,.43);border-top:4px solid var(--ep-clay);border-radius:18px;
  box-shadow:0 20px 35px rgba(119,55,27,.15);
  transition:transform .2s ease,box-shadow .2s ease;
}
.ep-orders__feature:hover {transform:translateY(-3px);box-shadow:0 25px 45px rgba(119,55,27,.22);}
.ep-orders__feature-body {position:relative;min-width:0;padding:29px clamp(25px,3vw,42px);background:linear-gradient(115deg,#e9b39b 0%,#f2d3c2 45%,#faeee6 100%);}
.ep-orders__feature-body:after {
  content:'';position:absolute;left:clamp(25px,3vw,42px);bottom:19px;width:46px;height:3px;
  background:var(--ep-forest);opacity:1;
}
.ep-orders__feature-meta {display:flex;align-items:center;flex-wrap:wrap;gap:8px 17px;color:#3c3b34;font-size:13px;}
.ep-orders__feature-meta strong {font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ep-forest);}
.ep-orders__feature h3 {
  max-width:900px;margin:19px 0 18px;color:var(--ep-charcoal);
  font-size:clamp(23px,2.25vw,33px);font-weight:650;
  line-height:1.25;letter-spacing:-.033em;overflow-wrap:anywhere;
}
.ep-orders__badges {display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ep-orders__pill {
  display:inline-flex;align-items:center;gap:5px;max-width:100%;width:max-content;
  padding:6px 11px;border:1px solid transparent;border-radius:999px;
  font-size:12px;font-weight:700;line-height:1.3;white-space:normal;
}
.ep-orders__pill.is-success {background:#e2eee0;color:#214b38;border-color:#b8d1bd;}
.ep-orders__pill.is-info {background:#e2f0ed;color:#21534f;border-color:#b9d4cc;}
.ep-orders__pill.is-pending {background:#fff0db;color:#83532c;border-color:#ebd3ab;}
.ep-orders__pill.is-danger {background:#fde7e3;color:#883b38;border-color:#ecc5bf;}
.ep-orders__pill.is-neutral {background:#eaece7;color:#506057;border-color:#cdd5cb;}
.ep-orders__seller {display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:16px 0 10px;font-size:13px;line-height:1.5;color:var(--ep-forest);}
.ep-orders__seller-name {margin-right:3px;font-weight:650;}
.ep-orders__seller-chip {border:1px solid rgba(23,63,53,.2);border-radius:999px;background:var(--ep-porcelain);color:var(--ep-forest);padding:4px 9px;font-size:12px;font-weight:600;}
.ep-orders__feature-side {
  position:relative;min-width:0;display:flex;flex-direction:column;justify-content:center;
  padding:28px clamp(22px,2.6vw,38px);background:var(--ep-clay);
  color:#171b17;border-left:2px dashed rgba(23,63,53,.38);
}
.ep-orders__feature-side:before,.ep-orders__feature-side:after {
  content:'';position:absolute;left:-12px;width:22px;height:22px;border-radius:50%;
  background:var(--ep-porcelain);pointer-events:none;
}
.ep-orders__feature-side:before {top:-12px;}.ep-orders__feature-side:after {bottom:-12px;}
.ep-orders__price-label {color:#171b17;font-size:12px;text-transform:uppercase;letter-spacing:.075em;font-weight:750;}
.ep-orders__feature-price {
  margin:7px 0 25px;overflow-wrap:anywhere;
  color:#171b17;font-weight:700;letter-spacing:-.04em;line-height:1.12;
  font-size:clamp(28px,2.6vw,38px);font-variant-numeric:tabular-nums;
}
.ep-orders__view {
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:13px 16px;background:var(--ep-forest);border-radius:7px;
  color:var(--ep-porcelain);font-size:14px;font-weight:700;
  transition:background .2s ease;
}
.ep-orders__feature:hover .ep-orders__view {background:var(--ep-charcoal);}

/* Clay-led order history: bold section header, warm linen rows, readable status details. */
.ep-orders__history {border-top:3px solid var(--ep-clay);background:#faeee8;}
.ep-orders__history-head {
  display:grid;grid-template-columns:54px minmax(0,1.5fr) minmax(180px,.8fr) minmax(140px,.55fr) 32px;
  gap:20px;padding:15px 23px;background:var(--ep-clay);
  color:#171b17;font-size:12px;font-weight:750;letter-spacing:.065em;text-transform:uppercase;
}
.ep-orders__history-row {
  display:grid;grid-template-columns:54px minmax(0,1.5fr) minmax(180px,.8fr) minmax(140px,.55fr) 32px;
  gap:20px;align-items:center;min-width:0;min-height:118px;
  padding:22px 23px;border-bottom:1px solid #dec1b3;
  border-left:3px solid transparent;background:var(--ep-porcelain);
  color:var(--ep-charcoal);text-decoration:none;
  transition:background .2s ease,border-color .2s ease,box-shadow .2s ease;
}
.ep-orders__history-row:nth-child(odd) {background:#f7e7dc;}
.ep-orders__history-row:hover,.ep-orders__history-row:focus-visible {
  background:#eed0bd;border-left-color:var(--ep-clay);
  box-shadow:inset 0 0 0 1px rgba(197,108,66,.22);
}
.ep-orders__history-num {
  display:grid;place-items:center;align-self:center;
  width:43px;height:43px;border:1px solid rgba(101,48,23,.28);border-radius:50%;
  background:var(--ep-clay);color:#171b17;
  font-size:14px;font-weight:750;letter-spacing:.01em;font-variant-numeric:tabular-nums;
}
.ep-orders__history-info {min-width:0;}
.ep-orders__history-info h3 {
  margin:0 0 7px;color:var(--ep-charcoal);font-size:clamp(17px,1.25vw,20px);
  line-height:1.35;font-weight:650;letter-spacing:-.02em;overflow-wrap:anywhere;
}
.ep-orders__history-date {margin:0;color:#58655b;font-size:13px;line-height:1.5;}
.ep-orders__history-sellers {display:flex;align-items:center;flex-wrap:wrap;gap:7px 13px;margin-top:9px;color:#4c5f55;font-size:12px;}
.ep-orders__history-status {display:flex;align-items:center;flex-wrap:wrap;gap:7px;min-width:0;}
.ep-orders__history-amount {min-width:0;text-align:right;}
.ep-orders__history-amount-label {margin:0 0 7px;color:#627067;font-size:11px;font-weight:750;letter-spacing:.055em;text-transform:uppercase;}
.ep-orders__history-amount strong {display:block;color:var(--ep-forest);font-size:19px;line-height:1.2;font-weight:750;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.ep-orders__history-arrow {justify-self:center;width:32px;height:32px;padding:7px;border-radius:50%;background:var(--ep-clay);color:#171b17;transition:background .2s ease,color .2s ease;}
.ep-orders__history-row:hover .ep-orders__history-arrow {background:var(--ep-forest);color:var(--ep-porcelain);}
.ep-orders__empty {margin-top:28px;max-width:100%;padding:60px clamp(24px,5vw,80px);border-top:4px solid var(--ep-forest);background:#e9eee6;}
.ep-orders__empty-icon {display:grid;place-items:center;width:54px;height:54px;margin-bottom:18px;background:var(--ep-sage);border-radius:50%;color:var(--ep-forest);}
.ep-orders__empty h2 {font-size:27px;font-weight:650;line-height:1.25;letter-spacing:-.025em;margin:0 0 8px;}
.ep-orders__empty p {font-size:16px;line-height:1.55;color:#546258;max-width:500px;margin:0;}
.ep-orders__skeleton {margin-top:28px;padding:26px;background:#e9eee5;border-top:4px solid var(--ep-forest);}
.ep-orders__skeleton-line {height:20px;margin:15px 0;border-radius:6px;background:#d3ded2;animation:ep-orders-pulse 1.4s ease-in-out infinite alternate;}
.ep-orders__skeleton-line:nth-child(2) {width:70%;}.ep-orders__skeleton-line:nth-child(3) {width:45%;}
@keyframes ep-orders-pulse {from{opacity:.5;}to{opacity:1;}}
.ep-orders a:focus-visible,.ep-orders button:focus-visible {outline:3px solid var(--ep-clay);outline-offset:3px;}
@media(max-width:900px){
  .ep-orders__intro {grid-template-columns:minmax(0,1fr) minmax(210px,.55fr);}
  .ep-orders__history-head,.ep-orders__history-row {grid-template-columns:43px minmax(0,1fr) minmax(120px,.78fr) minmax(100px,.55fr) 26px;gap:12px;}
  .ep-orders__history-head {padding:12px 15px;}
  .ep-orders__history-row {padding:18px 15px;}
  .ep-orders__feature {grid-template-columns:minmax(0,1fr) minmax(195px,.55fr);}
  .ep-orders__feature-side {padding:24px 20px;}
}
@media(max-width:680px){
  .ep-orders__content {padding:14px 12px 38px;}
  .ep-orders__intro {grid-template-columns:minmax(0,1fr);min-height:0;border-radius:13px 13px 3px 3px;}
  .ep-orders__intro-copy {padding:24px 19px;}
  .ep-orders__intro h1 {font-size:clamp(29px,8vw,34px);margin-top:13px;}
  .ep-orders__refresh {margin-top:20px;font-size:14px;min-height:42px;}
  .ep-orders__insight {display:grid;grid-template-columns:auto 1fr;column-gap:17px;align-items:center;padding:18px 20px;border-left:0;border-top:3px solid var(--ep-clay);}
  .ep-orders__insight-label {grid-column:1/-1;}
  .ep-orders__insight-number {grid-column:1;grid-row:2/4;font-size:54px;margin:7px 0;}
  .ep-orders__insight-sub {grid-column:2;grid-row:2/4;font-size:13px;}
  .ep-orders__insight-rule,.ep-orders__insight-last {display:none;}
  .ep-orders__section {margin-top:29px;}
  .ep-orders__section-head {margin-bottom:13px;align-items:start;}
  .ep-orders__section-head h2 {font-size:24px;}
  .ep-orders__section-note {display:none;}
  .ep-orders__feature {grid-template-columns:minmax(0,1fr);min-height:0;border-radius:13px;}
  .ep-orders__feature-body {padding:23px 20px 31px;}
  .ep-orders__feature-body:after {left:20px;bottom:14px;width:34px;}
  .ep-orders__feature-meta {font-size:12px;gap:8px 12px;}
  .ep-orders__feature h3 {font-size:23px;margin:13px 0 15px;}
  .ep-orders__feature-side {display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:15px;padding:17px 20px;border:0;border-top:2px dashed rgba(23,63,53,.38);}
  .ep-orders__feature-side:before,.ep-orders__feature-side:after {display:none;}
  .ep-orders__feature-price {font-size:25px;margin:5px 0 0;}
  .ep-orders__view {flex:0 0 auto;font-size:13px;padding:11px 13px;}
  .ep-orders__history-head {display:none;}
  .ep-orders__history-row {grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start;min-height:0;padding:19px 15px;}
  .ep-orders__history-num {display:none;}
  .ep-orders__history-info {grid-column:1/-1;grid-row:1;}
  .ep-orders__history-info h3 {font-size:17px;margin-bottom:5px;}
  .ep-orders__history-date {font-size:12px;}
  .ep-orders__history-sellers {margin-top:7px;}
  .ep-orders__history-status {grid-column:1;grid-row:2;}
  .ep-orders__history-amount {grid-column:2;grid-row:2;align-self:center;}
  .ep-orders__history-amount strong {font-size:17px;}
  .ep-orders__history-arrow {display:none;}
  .ep-orders__pill {font-size:11px;padding:5px 8px;}
  .ep-orders__empty {padding:38px 20px;}
}
@media(prefers-reduced-motion:reduce){
  .ep-orders__refresh,.ep-orders__feature,.ep-orders__history-row,.ep-orders__history-arrow,.ep-orders__view {transition:none!important;transform:none!important;}
  .ep-orders__skeleton-line {animation:none!important;}
}
`

export default function OrdersPage() {
  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const load =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (
          refresh
        ) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          const result =
            await listOrders({
              page:
                1,

              limit:
                30,
            })

          setData(
            result,
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load your Orders.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const orders = data?.orders || []
  const latest = orders[0] || null
  const remaining = orders.slice(1)
  const totalOrders = Number.isFinite(Number(data?.pagination?.total))
    ? Number(data.pagination.total)
    : orders.length

  return (
    <main className="ep-orders">
      <style>{ordersDesign}</style>
      <div className="ep-orders__content">
        <section className="ep-orders__intro" aria-labelledby="orders-page-title">
          <div className="ep-orders__intro-copy">
            <span className="ep-orders__eyebrow">Your purchases</span>
            <h1 id="orders-page-title">Your orders, <em>all in one place.</em></h1>
            <button
              type="button"
              className="ep-orders__refresh"
              onClick={() => load({ refresh: true })}
              disabled={refreshing}
              aria-label="Refresh your orders"
            >
              <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
              {refreshing ? 'Refreshing…' : 'Refresh orders'}
            </button>
          </div>
          <aside className="ep-orders__insight" aria-label="Orders overview">
            <span className="ep-orders__insight-label">Your order history</span>
            <strong className="ep-orders__insight-number">{loading && !data ? '—' : totalOrders}</strong>
            <p className="ep-orders__insight-sub">{totalOrders === 1 ? 'order recorded' : 'orders recorded'} on EPANTRY</p>
            <div className="ep-orders__insight-rule" />
            <p className="ep-orders__insight-last">
              Latest order
              <strong>{latest ? formatOrderDate(latest.createdAt) : 'No purchases yet'}</strong>
            </p>
          </aside>
        </section>

        {error && <div className="ep-orders__error" role="alert">{error}</div>}

        {loading ? (
          <div className="ep-orders__skeleton" role="status" aria-label="Loading your orders">
            <div className="ep-orders__skeleton-line" />
            <div className="ep-orders__skeleton-line" />
            <div className="ep-orders__skeleton-line" />
          </div>
        ) : orders.length === 0 ? (
          <section className="ep-orders__empty" aria-labelledby="orders-empty-title">
            <span className="ep-orders__empty-icon"><PackageCheck size={27} aria-hidden="true" /></span>
            <h2 id="orders-empty-title">No orders yet</h2>
            <p>Your purchases will appear here as soon as you place an order.</p>
          </section>
        ) : (
          <>
            <section className="ep-orders__section" aria-labelledby="latest-order-title">
              <div className="ep-orders__section-head">
                <div>
                  <span className="ep-orders__section-label">01 / At a glance</span>
                  <h2 id="latest-order-title">Latest order</h2>
                </div>
                <p className="ep-orders__section-note">Your most recent purchase, ready to review</p>
              </div>
              <Link className="ep-orders__feature" to={`/orders/${latest.id}`}>
                <div className="ep-orders__feature-body">
                  <div className="ep-orders__feature-meta">
                    <strong>Most recent</strong>
                    <span>{formatOrderDate(latest.createdAt)}</span>
                  </div>
                  <h3>{getOrderDisplayTitle(latest)}</h3>
                  <div className="ep-orders__badges">
                    <span className={`ep-orders__pill ${orderTone(latest.status)}`}>{formatStatus(latest.status)}</span>
                    <span className={`ep-orders__pill ${orderTone(latest.paymentStatus)}`}>Payment {formatStatus(latest.paymentStatus)}</span>
                  </div>
                  {Number(latest.sellerCount || 0) > 0 && (
                    <div className="ep-orders__seller">
                      <span className="ep-orders__seller-name">{latest.sellerCount} {Number(latest.sellerCount) === 1 ? 'Host delivery' : 'Host deliveries'}</span>
                      {sellerProgressGroups(latest).map(group => (
                        <span key={group.status} className="ep-orders__seller-chip">
                          {group.count} {formatStatus(group.status)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="ep-orders__feature-side">
                  <div>
                    <span className="ep-orders__price-label">Order total</span>
                    <p className="ep-orders__feature-price">{formatMoney(latest.totals?.totalLandedCostMinor, latest.totals?.currency)}</p>
                  </div>
                  <span className="ep-orders__view">View order <ArrowRight size={17} aria-hidden="true" /></span>
                </div>
              </Link>
            </section>

            {remaining.length > 0 && (
              <section className="ep-orders__section" aria-labelledby="orders-history-title">
                <div className="ep-orders__section-head">
                  <div>
                    <span className="ep-orders__section-label">02 / Your order history</span>
                    <h2 id="orders-history-title">Earlier purchases</h2>
                  </div>
                  <p className="ep-orders__section-note">Select any order to see its details</p>
                </div>
                <div className="ep-orders__history" role="list" aria-label="Earlier orders">
                  <div className="ep-orders__history-head" aria-hidden="true">
                    <span>No.</span><span>Order &amp; delivery</span><span>Status</span><span style={{textAlign:'right'}}>Total</span><span />
                  </div>
                  {remaining.map((order, index) => (
                    <Link key={order.id} role="listitem" className="ep-orders__history-row" to={`/orders/${order.id}`}>
                      <span className="ep-orders__history-num">{String(index + 2).padStart(2, '0')}</span>
                      <div className="ep-orders__history-info">
                        <h3>{getOrderDisplayTitle(order)}</h3>
                        <p className="ep-orders__history-date">{formatOrderDate(order.createdAt)}</p>
                        {Number(order.sellerCount || 0) > 0 && (
                          <div className="ep-orders__history-sellers">
                            <span>{order.sellerCount} {Number(order.sellerCount) === 1 ? 'Host delivery' : 'Host deliveries'}</span>
                            {sellerProgressGroups(order).map(group => (
                              <span key={group.status} className={`ep-orders__pill ${orderTone(group.status)}`}>
                                {group.count} {formatStatus(group.status)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ep-orders__history-status">
                        <span className={`ep-orders__pill ${orderTone(order.status)}`}>{formatStatus(order.status)}</span>
                        <span className={`ep-orders__pill ${orderTone(order.paymentStatus)}`}>Payment {formatStatus(order.paymentStatus)}</span>
                      </div>
                      <div className="ep-orders__history-amount">
                        <p className="ep-orders__history-amount-label">Order total</p>
                        <strong>{formatMoney(order.totals?.totalLandedCostMinor, order.totals?.currency)}</strong>
                      </div>
                      <ArrowRight size={19} className="ep-orders__history-arrow" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
