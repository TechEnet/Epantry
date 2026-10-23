import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ReceiptIndianRupee,
  RefreshCw,
  ShoppingBag,
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

import {
  getCommerceErrorMessage,
  listOrders,
} from '../../commerce/services/commerce.service'

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isFinite(
      Number(
        amountMinor,
      ),
    )
  ) {
    return '₹0'
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

function isSameMonth(
  value,
  reference,
) {
  if (!value) {
    return false
  }

  const date =
    new Date(
      value,
    )

  return (
    !Number.isNaN(
      date.getTime(),
    ) &&
    date.getFullYear() ===
      reference.getFullYear() &&
    date.getMonth() ===
      reference.getMonth()
  )
}

function formatOrderDate(
  value,
) {
  if (!value) {
    return 'Date unavailable'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Date unavailable'
  }

  return date.toLocaleString(
    'en-IN',
    {
      day:
        '2-digit',
      month:
        'short',
      year:
        'numeric',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
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

function getMobileOrderDisplayTitle(order) {
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

  if (itemCount > 1) {
    return `${itemCount}-item EPANTRY order`
  }

  return primaryItemName || 'EPANTRY order'
}

function isPaidOrder(order) {
  return [
    'paid',
    'captured',
    'completed',
    'success',
    'succeeded',
  ].includes(
    String(order?.paymentStatus || '')
      .trim()
      .toLowerCase(),
  )
}

function getOrderPaidAmountMinor(order) {
  const candidates = [
    order?.totals?.totalLandedCostMinor,
    order?.totals?.itemSubtotalMinor,
    order?.totalLandedCostMinor,
    order?.payment?.amountMinor,
    order?.paymentAmountMinor,
    order?.amountMinor,
  ]

  for (const candidate of candidates) {
    const value = Number(candidate)

    if (Number.isFinite(value) && value > 0) {
      return value
    }
  }

  return 0
}

export default function CustomerSpendingPage() {
  const [
    orders,
    setOrders,
  ] = useState(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  )

  const [
    refreshing,
    setRefreshing,
  ] = useState(
    false,
  )

  const [
    error,
    setError,
  ] = useState(
    '',
  )

  const load =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (refresh) {
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
          const firstPage =
            await listOrders({
              page:
                1,
              limit:
                50,
            })

          let nextOrders =
            Array.isArray(
              firstPage?.orders,
            )
              ? [...firstPage.orders]
              : []

          const pages =
            Number(
              firstPage?.pagination
                ?.pages ||
                1,
            )

          if (pages > 1) {
            const remaining =
              await Promise.all(
                Array.from(
                  {
                    length:
                      pages - 1,
                  },
                  (
                    _,
                    index,
                  ) =>
                    listOrders({
                      page:
                        index +
                        2,
                      limit:
                        50,
                    }),
                ),
              )

            nextOrders =
              nextOrders.concat(
                ...remaining.map(
                  (
                    page,
                  ) =>
                    Array.isArray(
                      page?.orders,
                    )
                      ? page.orders
                      : [],
                ),
              )
          }

          setOrders(
            nextOrders,
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load your payment history.',
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

  const summary =
    useMemo(
      () => {
        const now =
          new Date()

        const paidOrders =
          orders.filter(
            isPaidOrder,
          )

        const monthPaidOrders =
          paidOrders.filter(
            (order) =>
              isSameMonth(
                order?.createdAt,
                now,
              ),
          )

        const amountMinor =
          paidOrders.reduce(
            (
              total,
              order,
            ) =>
              total +
              getOrderPaidAmountMinor(
                order,
              ),
            0,
          )

        const currency =
          paidOrders.find(
            (
              order,
            ) =>
              order?.totals
                ?.currency,
          )?.totals
            ?.currency ||
          'INR'

        return {
          paidOrders,
          monthPaidOrderCount: monthPaidOrders.length,
          amountMinor,
          currency,
          monthLabel:
            now.toLocaleDateString(
              'en-IN',
              {
                month:
                  'long',
                year:
                  'numeric',
              },
            ),
        }
      },
      [
        orders,
      ],
    )

  return (
    <main className="sp-page">
      <style>{`
        .sp-page { --sp-porcelain:#F7F6F2; --sp-forest:#173F35; --sp-charcoal:#202421; --sp-sage:#D7DDCF; --sp-clay:#C56C42; min-width:0; width:100%; background:var(--sp-porcelain); color:var(--sp-charcoal); }
        .sp-page *, .sp-page *::before, .sp-page *::after { box-sizing:border-box; }
        .sp-page .sp-content { width:100%; max-width:none; margin:0; padding:24px clamp(18px,3.2vw,48px) 48px; }
        .sp-page .sp-bar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
        .sp-page .sp-back, .sp-page .sp-refresh { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:40px; font-size:14px; font-weight:650; text-decoration:none; line-height:1.2; border-radius:8px; transition:color .18s, background .18s, border-color .18s, transform .18s; }
        .sp-page .sp-back { padding:10px 0; color:var(--sp-forest); }
        .sp-page .sp-back:hover { color:var(--sp-clay); }
        .sp-page .sp-refresh { padding:10px 17px; border:1px solid #b9c6b7; background:var(--sp-porcelain); color:var(--sp-forest); cursor:pointer; }
        .sp-page .sp-refresh:hover { background:var(--sp-sage); border-color:var(--sp-forest); }
        .sp-page .sp-refresh:disabled { cursor:wait; opacity:.65; }
        .sp-page :is(a,button):focus-visible { outline:3px solid var(--sp-clay); outline-offset:3px; }
        .sp-page .sp-hero { position:relative; isolation:isolate; display:grid; grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr); overflow:hidden; border:1px solid #d8dcd1; border-radius:22px; background:var(--sp-sage); }
        .sp-page .sp-hero-intro { position:relative; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; min-height:290px; padding:40px clamp(24px,4.1vw,60px); }
        .sp-page .sp-overline { display:inline-flex; align-items:center; gap:10px; font-size:13px; font-weight:750; letter-spacing:.075em; color:var(--sp-forest); text-transform:uppercase; line-height:1.4; }
        .sp-page .sp-overline::before { display:block; content:""; height:2px; width:28px; background:var(--sp-clay); flex:none; }
        .sp-page h1.sp-title { margin:20px 0 14px; font-size:clamp(30px,3.15vw,44px) !important; font-weight:750 !important; letter-spacing:-.048em; line-height:1.12 !important; color:var(--sp-charcoal); }
        .sp-page .sp-hero-desc { max-width:480px; margin:0; font-size:16px; font-weight:450; line-height:1.55; color:#334840; }
        .sp-page .sp-hero-footer { display:flex; gap:12px; align-items:center; margin-top:28px; padding-top:14px; border-top:1px solid rgba(23,63,53,.2); font-size:14px; color:var(--sp-forest); font-weight:650; }
        .sp-page .sp-total { background:var(--sp-clay); color:var(--sp-porcelain); display:flex; flex-direction:column; justify-content:space-between; gap:28px; padding:34px clamp(22px,3vw,42px); }
        .sp-page .sp-total-label { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:#fff7f2; }
        .sp-page .sp-total-amount { margin:9px 0 0; font-size:clamp(30px,3.15vw,46px); line-height:1.1; font-weight:760; letter-spacing:-.055em; color:#fffdfb; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
        .sp-page .sp-total-caption { margin:9px 0 0; font-size:14px; color:#fff2eb; line-height:1.45; }
        .sp-page .sp-totals-bottom { display:grid; grid-template-columns:1fr 1fr; gap:0; border-top:1px solid rgba(255,255,255,.38); padding-top:18px; }
        .sp-page .sp-total-mini { min-width:0; padding:0 14px; }
        .sp-page .sp-total-mini:first-child { padding-left:0; border-right:1px solid rgba(255,255,255,.35); }
        .sp-page .sp-total-mini:last-child { padding-right:0; }
        .sp-page .sp-total-mini strong { display:block; font-size:27px; font-weight:750; line-height:1.15; color:#fff; font-variant-numeric:tabular-nums; }
        .sp-page .sp-total-mini span { display:block; margin-top:6px; font-size:13px; line-height:1.4; color:#fff6f0; }
        .sp-page .sp-error { margin-top:18px; padding:14px 18px; border-left:4px solid #ab3b35; background:#fff1ed; color:#80352c; border-radius:5px; font-size:15px; line-height:1.5; }
        .sp-page .sp-history { margin-top:32px; }
        .sp-page .sp-history-titlebar { display:flex; align-items:end; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .sp-page .sp-section-kicker { font-size:13px; color:var(--sp-clay); font-weight:750; letter-spacing:.07em; text-transform:uppercase; }
        .sp-page h2.sp-section-title { margin:8px 0 0; font-size:clamp(25px,2.25vw,32px) !important; line-height:1.15 !important; font-weight:750 !important; letter-spacing:-.04em; color:var(--sp-charcoal); }
        .sp-page .sp-history-count { font-size:14px; color:var(--sp-forest); font-weight:650; white-space:nowrap; padding-bottom:5px; }
        .sp-page .sp-ledger { border:1px solid #d7dfd6; border-radius:15px; overflow:hidden; background:#fcfbf8; }
        .sp-page .sp-ledger-head { display:grid; grid-template-columns:56px minmax(0,1fr) 128px 150px 22px; align-items:center; gap:16px; padding:14px 24px; background:var(--sp-forest); color:var(--sp-porcelain); font-size:13px; font-weight:700; letter-spacing:.045em; text-transform:uppercase; }
        .sp-page .sp-ledger-head span:nth-child(3) { text-align:center; }
        .sp-page .sp-ledger-head span:nth-child(4) { text-align:right; }
        .sp-page .sp-row { display:grid; grid-template-columns:56px minmax(0,1fr) 128px 150px 22px; gap:16px; align-items:center; padding:20px 24px; border-bottom:1px solid #e1e5df; background:#fcfbf8; color:inherit; text-decoration:none; transition:background-color .2s, box-shadow .2s; }
        .sp-page .sp-row:last-child { border-bottom:0; }
        .sp-page .sp-row:nth-of-type(even) { background:#f1f2ec; }
        .sp-page .sp-row:hover, .sp-page .sp-row:focus-visible { background:#e5e9de; box-shadow:inset 4px 0 var(--sp-clay); }
        .sp-page .sp-number { display:flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:50%; background:var(--sp-sage); color:var(--sp-forest); font-size:15px; font-weight:750; font-variant-numeric:tabular-nums; }
        .sp-page .sp-item { min-width:0; }
        .sp-page .sp-item-title { margin:0; font-size:17px; font-weight:700; line-height:1.35; color:var(--sp-charcoal); overflow-wrap:anywhere; }
        .sp-page .sp-item-date { margin:6px 0 0; font-size:14px; line-height:1.4; color:#526257; }
        .sp-page .sp-paid { justify-self:center; display:inline-flex; align-items:center; gap:8px; border:1px solid #a6bca6; background:#d7ddcf; color:var(--sp-forest); border-radius:999px; padding:6px 11px; font-size:13px; line-height:1.2; font-weight:750; }
        .sp-page .sp-paid::before { content:""; width:7px; height:7px; background:var(--sp-forest); border-radius:50%; flex:none; }
        .sp-page .sp-amount { text-align:right; font-size:18px; line-height:1.3; font-weight:750; color:var(--sp-forest); font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
        .sp-page .sp-row-arrow { justify-self:end; color:var(--sp-clay); transition:transform .2s; }
        .sp-page .sp-row:hover .sp-row-arrow { transform:translateX(3px); }
        .sp-page .sp-loading { display:grid; gap:0; background:#fcfbf8; border:1px solid #d7dfd6; border-radius:14px; overflow:hidden; }
        .sp-page .sp-skeleton { height:92px; background:linear-gradient(90deg,#fcfbf8,#e8e9e3,#fcfbf8); background-size:220% 100%; animation:sp-glow 1.8s linear infinite; border-bottom:1px solid #e1e5df; }
        @keyframes sp-glow { 0%{background-position:100% 50%} 100%{background-position:-100% 50%} }
        .sp-page .sp-empty { padding:44px 24px; text-align:center; border:1px dashed #b5c2b0; border-radius:14px; background:#fcfbf8; }
        .sp-page .sp-empty-icon { display:grid; place-items:center; width:56px; height:56px; border-radius:50%; margin:0 auto 14px; background:var(--sp-sage); color:var(--sp-forest); }
        .sp-page .sp-empty-title { margin:0 0 7px; font-size:20px; font-weight:750; color:var(--sp-charcoal); }
        .sp-page .sp-empty-text { margin:0; font-size:15px; color:#526257; }
        @media (max-width:900px) {
          .sp-page .sp-hero { grid-template-columns:minmax(0,1fr) minmax(290px,.8fr); }
          .sp-page .sp-hero-intro { padding:30px 25px; }
          .sp-page .sp-total { padding:28px 24px; }
          .sp-page .sp-ledger-head, .sp-page .sp-row { grid-template-columns:42px minmax(0,1fr) 90px 120px 20px; gap:12px; padding-inline:16px; }
        }
        @media (max-width:680px) {
          .sp-page .sp-content { padding:12px 10px 28px; }
          .sp-page .sp-bar { margin-bottom:12px; }
          .sp-page .sp-back,.sp-page .sp-refresh { font-size:13px; min-height:36px; }
          .sp-page .sp-refresh { padding:8px 12px; }
          .sp-page .sp-hero { grid-template-columns:minmax(0,1fr); border-radius:13px; }
          .sp-page .sp-hero-intro { min-height:unset; padding:23px 18px 24px; }
          .sp-page .sp-overline { font-size:12px; }
          .sp-page h1.sp-title { font-size:29px !important; margin:13px 0 9px; line-height:1.13 !important; }
          .sp-page .sp-hero-desc { font-size:14px; line-height:1.45; }
          .sp-page .sp-hero-footer { margin-top:14px; padding-top:12px; font-size:13px; }
          .sp-page .sp-total { gap:14px; padding:21px 18px; }
          .sp-page .sp-total-label { font-size:12.5px; }
          .sp-page .sp-total-amount { font-size:34px; }
          .sp-page .sp-total-caption { font-size:13px; margin-top:5px; }
          .sp-page .sp-totals-bottom { padding-top:14px; }
          .sp-page .sp-total-mini strong { font-size:23px; }
          .sp-page .sp-total-mini span { font-size:12.5px; }
          .sp-page .sp-history { margin-top:25px; }
          .sp-page .sp-history-titlebar { margin-bottom:12px; }
          .sp-page h2.sp-section-title { font-size:23px !important; }
          .sp-page .sp-history-count { font-size:12.5px; }
          .sp-page .sp-ledger { border-radius:11px; }
          .sp-page .sp-ledger-head { display:none; }
          .sp-page .sp-row { display:grid; grid-template-columns:32px minmax(0,1fr) auto; gap:10px; padding:15px 12px; align-items:center; }
          .sp-page .sp-number { height:31px; width:31px; font-size:12.5px; }
          .sp-page .sp-item-title { font-size:15px; }
          .sp-page .sp-item-date { font-size:12.5px; margin-top:4px; }
          .sp-page .sp-paid { grid-column:2; grid-row:2; justify-self:start; padding:4px 9px; font-size:12.5px; }
          .sp-page .sp-amount { grid-column:3; grid-row:1; font-size:16px; max-width:110px; }
          .sp-page .sp-row-arrow { grid-column:3; grid-row:2; }
          .sp-page .sp-skeleton { height:86px; }
          .sp-page .sp-empty { padding:32px 15px; }
        }
        @media (prefers-reduced-motion:reduce) { .sp-page .sp-skeleton{animation:none} .sp-page :is(.sp-row,.sp-refresh,.sp-back,.sp-row-arrow){transition:none} }
      `}</style>

      <div className="sp-content">
        <div className="sp-bar">
          <Link to="/dashboard" className="sp-back">
            <ArrowLeft size={17} aria-hidden="true" />
            Dashboard
          </Link>
          <button type="button" className="sp-refresh" disabled={refreshing} onClick={() => load({ refresh: true })}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <section className="sp-hero" aria-labelledby="sp-page-title">
          <div className="sp-hero-intro">
            <p className="sp-overline">01 / Account overview</p>
            <h1 id="sp-page-title" className="sp-title">Your spending,<br />made clear.</h1>
            <p className="sp-hero-desc">Your paid orders and spending, together in one place.</p>
            <p className="sp-hero-footer"><ReceiptIndianRupee size={19} aria-hidden="true" /> Payments recorded on EPANTRY</p>
          </div>
          <div className="sp-total">
            <div>
              <p className="sp-total-label"><CalendarDays size={18} aria-hidden="true" /> All-time spending</p>
              <p className="sp-total-amount" aria-label="Total paid amount">{loading ? '—' : formatMoney(summary.amountMinor, summary.currency)}</p>
              <p className="sp-total-caption">Total from your recorded paid orders.</p>
            </div>
            <div className="sp-totals-bottom">
              <div className="sp-total-mini">
                <strong>{loading ? '—' : summary.paidOrders.length}</strong>
                <span>Paid {summary.paidOrders.length === 1 ? 'order' : 'orders'}</span>
              </div>
              <div className="sp-total-mini">
                <strong>{loading ? '—' : summary.monthPaidOrderCount}</strong>
                <span>In {summary.monthLabel}</span>
              </div>
            </div>
          </div>
        </section>

        {error ? <div className="sp-error" role="alert">{error}</div> : null}

        <section className="sp-history" aria-labelledby="sp-history-title">
          <div className="sp-history-titlebar">
            <div>
              <p className="sp-section-kicker">02 / Payment history</p>
              <h2 id="sp-history-title" className="sp-section-title">Paid orders</h2>
            </div>
            <p className="sp-history-count">{loading ? 'Loading…' : `${summary.paidOrders.length} ${summary.paidOrders.length === 1 ? 'order' : 'orders'}`}</p>
          </div>
          {loading ? (
            <div className="sp-loading" aria-label="Loading payment history" aria-busy="true">
              {[1, 2, 3].map((item) => <div className="sp-skeleton" key={item} />)}
            </div>
          ) : error && summary.paidOrders.length === 0 ? null : summary.paidOrders.length === 0 ? (
            <div className="sp-empty">
              <div className="sp-empty-icon"><ShoppingBag size={24} aria-hidden="true" /></div>
              <h3 className="sp-empty-title">No paid orders yet</h3>
              <p className="sp-empty-text">Your completed payments will appear here.</p>
            </div>
          ) : (
            <div className="sp-ledger">
              <div className="sp-ledger-head" aria-hidden="true">
                <span>No.</span><span>Order</span><span>Status</span><span>Paid amount</span><span />
              </div>
              {summary.paidOrders.map((order, index) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="sp-row" aria-label={`View ${getOrderDisplayTitle(order)}, paid ${formatMoney(getOrderPaidAmountMinor(order), order?.totals?.currency)}`}>
                  <span className="sp-number">{String(index + 1).padStart(2, '0')}</span>
                  <div className="sp-item">
                    <p className="sp-item-title">{getOrderDisplayTitle(order)}</p>
                    <p className="sp-item-date">{formatOrderDate(order.createdAt)}</p>
                  </div>
                  <span className="sp-paid">Paid</span>
                  <strong className="sp-amount">{formatMoney(getOrderPaidAmountMinor(order), order?.totals?.currency)}</strong>
                  <ArrowRight size={19} className="sp-row-arrow" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
