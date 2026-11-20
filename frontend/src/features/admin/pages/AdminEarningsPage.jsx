import {
  ChevronDown,
  ChevronRight,
  Crown,
  IndianRupee,
  Megaphone,
  RefreshCw,
  ShoppingBasket,
  UsersRound,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import AdminShell from '../components/AdminShell'

import {
  getAdminEarningsOverview,
  getAdminGovernanceErrorMessage,
} from '../../adminGovernance/services/adminGovernance.service'

function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0) / 100)
}

function dateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function readable(value) {
  const text = String(value || '').trim()
  if (!text) return '—'

  return text
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function legacyPaymentRow(row) {
  const source = String(row?.source || '')
  const isPlatform = ['pro_membership', 'retail_media', 'marketplace_fee'].includes(source)
  const isCustomerFlow = ['customer_order', 'creator_session'].includes(source)

  if (!isPlatform && !isCustomerFlow) return null

  const defaultReason = {
    pro_membership: 'Pro membership',
    retail_media: 'Ads & paid placements',
    marketplace_fee: 'Marketplace fee',
    customer_order: 'Marketplace order',
    creator_session: 'Creator session',
  }[source] || 'Payment'

  const defaultTitle = {
    pro_membership: 'Customer paid EPANTRY',
    retail_media: 'Brand paid EPANTRY',
    marketplace_fee: 'EPANTRY earned a marketplace fee',
    customer_order: 'Customer paid a Host',
    creator_session: 'Customer paid a creator',
  }[source] || row?.label || 'Payment'

  return {
    ...row,
    id: String(row?.id || `${source}-${row?.occurredAt || row?.amountMinor || 'payment'}`),
    label: row?.label || defaultTitle,
    payerName: row?.payerName || (isPlatform ? 'Customer / business' : 'Customer'),
    recipientName: row?.recipientName || (isPlatform ? 'EPANTRY' : source === 'creator_session' ? 'Creator' : 'Host'),
    reason: row?.reason || defaultReason,
    detail: row?.detail || { type: defaultReason },
  }
}

function PaymentDetails({ row }) {
  const detail = row?.detail || {}
  const source = String(row?.source || '')
  const isOrder = source === 'customer_order'
  const isCreator = source === 'creator_session'
  const isFee = source === 'marketplace_fee'
  const isPro = source === 'pro_membership'
  const isMedia = source === 'retail_media'

  const details = [
    [isFee ? 'From' : 'Paid by', row?.payerName || '—'],
    [isFee ? 'Earned by' : 'Paid to', row?.recipientName || '—'],
    ['Amount', money(row?.amountMinor)],
    ['Paid on', dateTime(row?.occurredAt)],
    ['Payment for', row?.reason || detail.type || 'Payment'],
  ]

  if (isPro) {
    details.push(['Membership', detail.plan || row?.reason || 'Pro membership'])
    if (detail.validityMonths) {
      details.push(['Access period', `${detail.validityMonths} month${detail.validityMonths === 1 ? '' : 's'}`])
    }
  }
  if (isMedia) {
    if (detail.campaign) details.push(['Campaign', detail.campaign])
    if (detail.objective) details.push(['Campaign goal', readable(detail.objective)])
  }
  if (isOrder) {
    if (detail.orderStatus) details.push(['Order status', readable(detail.orderStatus)])
    if (detail.fulfillmentType) details.push(['Fulfilment', readable(detail.fulfillmentType)])
    if (Number(detail.subtotalMinor || 0) > 0) details.push(['Items subtotal', money(detail.subtotalMinor)])
    if (Number(detail.feesMinor || 0) > 0) details.push(['Order fees', money(detail.feesMinor)])
  }
  if (isCreator) {
    if (detail.session) details.push(['Session', detail.session])
    if (detail.startsAt) details.push(['Session time', dateTime(detail.startsAt)])
  }
  if (isFee && Number(detail.grossMerchandiseMinor || 0) > 0) {
    details.push(['Order value', money(detail.grossMerchandiseMinor)])
  }

  const items = Array.isArray(detail.items) ? detail.items.filter(Boolean) : []

  return (
    <div className="border-t border-[#D7DDCF] bg-[#D7DDCF]/35 px-4 py-5 sm:px-6 sm:py-6">
      <p className="mb-4 flex items-center gap-2 text-[13px] font-bold text-[#173F35]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C56C42]" aria-hidden="true" />
        Payment details
      </p>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="min-w-0">
            <dt className="text-[13px] font-medium text-[#202421]/65">{label}</dt>
            <dd className="mt-1 break-words text-[15px] font-semibold leading-6 text-[#202421]">{value}</dd>
          </div>
        ))}
      </dl>
      {items.length ? (
        <div className="mt-5 border-t border-[#173F35]/15 pt-4">
          <p className="text-[13px] font-bold text-[#173F35]">Items paid for</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((item, index) => (
              <span key={`${item}-${index}`} className="border border-[#173F35]/15 bg-[#F7F6F2] px-3 py-1.5 text-[13px] font-medium text-[#202421]">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PaymentList({ rows, selectedId, onSelect, tone, mobileCustomerScroll = false }) {
  const paymentRowsRef = useRef(null)
  const [mobileListHeight, setMobileListHeight] = useState(null)
  const isScrollable = mobileCustomerScroll && rows.length > 5

  useLayoutEffect(() => {
    if (!isScrollable || !paymentRowsRef.current) {
      setMobileListHeight(null)
      return undefined
    }

    const list = paymentRowsRef.current
    const firstSix = Array.from(list.children).slice(0, 6)
    if (firstSix.length !== 6) return undefined

    const mobileQuery = window.matchMedia('(max-width: 639px)')
    const measure = () => {
      if (!mobileQuery.matches) return
      // Five entire items + half the sixth, even when text wraps differently.
      const height = firstSix.slice(0, 5).reduce((sum, item) => sum + item.getBoundingClientRect().height, 0)
        + firstSix[5].getBoundingClientRect().height / 2
      const rounded = Math.ceil(height)
      setMobileListHeight((previous) => previous === rounded ? previous : rounded)
    }

    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    firstSix.forEach((item) => observer?.observe(item))
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isScrollable, rows, selectedId])

  if (!rows.length) {
    return (
      <div className="border-t border-[#173F35]/10 px-5 py-9 sm:px-7">
        <p className="text-[17px] font-bold text-[#202421]">No payments in this flow yet</p>
        <p className="mt-1 text-[14px] leading-6 text-[#202421]/70">New records will appear here when available. Use Refresh to check again.</p>
      </div>
    )
  }

  const icons = {
    pro_membership: Crown,
    retail_media: Megaphone,
    marketplace_fee: IndianRupee,
    customer_order: ShoppingBasket,
    creator_session: UsersRound,
  }

  return (
    <div className="border-t border-[#173F35]/10">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(150px,0.75fr)_auto] gap-5 border-b border-[#173F35]/10 bg-[#D7DDCF]/30 px-6 py-2.5 text-[12px] font-bold text-[#173F35] sm:grid">
        <span>Payment</span>
        <span>Date</span>
        <span className="text-right">Amount</span>
      </div>
      <div
        ref={paymentRowsRef}
        className={`divide-y divide-[#173F35]/10 ${isScrollable ? 'max-h-[var(--mobile-payment-list-height)] overflow-y-auto overscroll-y-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C56C42] sm:max-h-none sm:overflow-visible' : ''}`}
        style={isScrollable ? { '--mobile-payment-list-height': `${mobileListHeight || 660}px`, WebkitOverflowScrolling: 'touch' } : undefined}
        tabIndex={isScrollable ? 0 : undefined}
        role={isScrollable ? 'region' : undefined}
        aria-label={isScrollable ? `Customer transactions: scroll to view all ${rows.length} payments` : undefined}
      >
        {rows.map((row) => {
          const open = selectedId === row.id
          const Icon = icons[row.source] || IndianRupee
          return (
            <div key={`${row.source}-${row.id}`}>
              <button
                type="button"
                onClick={() => onSelect(open ? '' : row.id)}
                aria-expanded={open}
                className={`focus-ring grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-4 text-left transition-colors sm:grid-cols-[minmax(0,1.4fr)_minmax(150px,0.75fr)_auto] sm:gap-x-5 sm:px-6 sm:py-5 ${open ? 'bg-[#D7DDCF]/40' : 'hover:bg-[#D7DDCF]/25'}`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone === 'platform' ? 'bg-[#C56C42]/15 text-[#C56C42]' : 'bg-[#D7DDCF] text-[#173F35]'}`}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-bold leading-6 text-[#202421]">
                      {row.label || `${row.payerName || 'Customer'} paid ${row.recipientName || 'EPANTRY'}`}
                    </p>
                    <p className="mt-0.5 break-words text-[13px] leading-5 text-[#202421]/65">{row.reason || 'Payment'}</p>
                    <p className="mt-1 text-[12px] text-[#202421]/60 sm:hidden">{dateTime(row.occurredAt)}</p>
                  </div>
                </div>
                <p className="hidden text-[13px] text-[#202421]/70 sm:block">{dateTime(row.occurredAt)}</p>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="whitespace-nowrap text-[19px] font-extrabold leading-6 text-[#173F35]">{money(row.amountMinor)}</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold text-[#C56C42]">
                    {open ? 'Hide details' : 'Details'}
                    {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                  </span>
                </div>
              </button>
              {open ? <PaymentDetails row={row} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminEarningsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flow, setFlow] = useState('platform')
  const [selectedPaymentId, setSelectedPaymentId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getAdminEarningsOverview()
      setData(result || null)
    } catch (requestError) {
      setError(getAdminGovernanceErrorMessage(requestError, 'Unable to load earnings and payments.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelectedPaymentId('') }, [flow])

  const all = data?.allTime || {}
  const legacyRecent = useMemo(
    () => (Array.isArray(data?.recent) ? data.recent.map(legacyPaymentRow).filter(Boolean) : []),
    [data],
  )

  const platformPayments = useMemo(() => {
    if (Array.isArray(data?.platformPayments) && data.platformPayments.length) {
      return data.platformPayments.map(legacyPaymentRow).filter(Boolean)
    }
    return legacyRecent.filter((row) =>
      ['pro_membership', 'retail_media', 'marketplace_fee'].includes(row.source),
    )
  }, [data, legacyRecent])

  const customerToHostPayments = useMemo(() => {
    if (Array.isArray(data?.customerToHostPayments) && data.customerToHostPayments.length) {
      return data.customerToHostPayments.map(legacyPaymentRow).filter(Boolean)
    }
    return legacyRecent.filter((row) =>
      ['customer_order', 'creator_session'].includes(row.source),
    )
  }, [data, legacyRecent])

  const activeRows = flow === 'platform' ? platformPayments : customerToHostPayments
  const activeTone = flow === 'platform' ? 'platform' : 'host'
  const sourceMap = useMemo(() => {
    const map = new Map()
    for (const source of Array.isArray(data?.sources) ? data.sources : []) map.set(source.key, source)
    return map
  }, [data])

  const sourceRows = flow === 'platform'
    ? [
      { key: 'pro_membership', name: 'Memberships', icon: Crown },
      { key: 'retail_media', name: 'Ads & placements', icon: Megaphone },
      { key: 'marketplace_fee', name: 'Marketplace fees', icon: IndianRupee },
    ]
    : [
      { key: 'customer_orders', name: 'Marketplace orders', icon: ShoppingBasket },
      { key: 'creator_sessions', name: 'Creator sessions', icon: UsersRound },
    ]

  const customerTotalMinor = Number(all.commerceCollectionsMinor || 0) + Number(all.creatorCollectionsMinor || 0)
  const breakdownTotal = sourceRows.reduce((sum, row) => sum + Math.max(0, Number(sourceMap.get(row.key)?.amountMinor || 0)), 0)

  const displayingInitialLoad = loading && !data

  return (
    <AdminShell
      title="Earnings & Payments"
      description="Platform income and customer payments, clearly separated."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3.5 py-2 text-[13px] font-semibold text-[#173F35] transition hover:border-[#C56C42] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
        </button>
      }
    >
      <main className="w-full min-w-0 bg-[#F7F6F2] pb-8 text-[#202421] sm:pb-10">
        {/* Only source-backed amounts are displayed in the overview. */}
        <section aria-label="Financial overview" className="overflow-hidden rounded-[18px] border border-[#173F35]/10">
          <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.1fr)]">
            <div className="relative flex flex-col justify-between gap-3 bg-[#C56C42] px-4 py-5 sm:gap-6 sm:px-8 sm:py-8">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.09em] text-[#202421]">
                <span className="h-[2px] w-6 bg-[#202421]" aria-hidden="true" />
                EPANTRY revenue
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#202421]/85">Money EPANTRY earned</p>
                <p className="mt-1 break-words text-[clamp(2.5rem,5vw,4.1rem)] font-extrabold leading-[1.08] tracking-[-0.055em] text-[#202421]">
                  {displayingInitialLoad ? '—' : money(all.platformRevenueMinor)}
                </p>
                <p className="mt-2 max-w-md text-[13px] font-medium leading-5 text-[#202421]/90 sm:mt-3 sm:text-[14px] sm:leading-6">
                  Memberships, advertising and marketplace fees.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 bg-[#202421] text-[#F7F6F2] sm:grid-cols-2 lg:grid-cols-1">
              <div className="flex min-w-0 flex-col justify-center border-r border-[#F7F6F2]/20 px-4 py-4 sm:border-b-0 sm:border-r sm:px-7 sm:py-5 lg:border-b lg:border-r-0 lg:py-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#D7DDCF]">Customer payments</p>
                  <ShoppingBasket size={19} className="text-[#C56C42]" aria-hidden="true" />
                </div>
                <p className="mt-2 break-words text-[clamp(1.7rem,3vw,2.35rem)] font-bold tracking-[-0.035em]">
                  {displayingInitialLoad ? '—' : money(customerTotalMinor)}
                </p>
                <p className="mt-1 text-[13px] text-[#D7DDCF]">Orders and creator sessions</p>
              </div>
              <div className="flex min-w-0 flex-col justify-center px-4 py-4 sm:px-7 sm:py-5 lg:py-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-[#D7DDCF]">Pending Host payouts</p>
                  <IndianRupee size={19} className="text-[#C56C42]" aria-hidden="true" />
                </div>
                <p className="mt-2 break-words text-[clamp(1.7rem,3vw,2.35rem)] font-bold tracking-[-0.035em]">
                  {displayingInitialLoad ? '—' : money(data?.pendingHostPayoutMinor)}
                </p>
                <p className="mt-1 text-[13px] text-[#D7DDCF]">Not counted as platform revenue</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div role="alert" className="mt-4 border-l-4 border-[#C56C42] bg-[#D7DDCF]/45 px-4 py-3 text-[14px] font-semibold text-[#202421]">
            {error}
          </div>
        ) : null}

        <section aria-label="Payment activity" className="mt-6 min-w-0 sm:mt-9">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#173F35]/20 pb-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.09em] text-[#C56C42]">Payment activity</p>
              <h2 className="mt-1 text-[25px] font-extrabold tracking-[-0.035em] text-[#202421] sm:text-[32px]">Payment history</h2>
            </div>
            <p className="hidden max-w-md text-[14px] leading-6 text-[#202421]/70 sm:block">Choose a flow to see its payments and sources.</p>
          </div>

          <div
            className="mt-3 grid gap-2 sm:mt-2 sm:flex sm:flex-wrap sm:gap-x-7 sm:gap-y-1 sm:border-b sm:border-[#173F35]/15"
            role="group"
            aria-label="Choose which payments to view"
          >
            <button
              type="button"
              onClick={() => setFlow('platform')}
              aria-pressed={flow === 'platform'}
              className={`focus-ring flex min-h-[68px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors sm:inline-flex sm:min-h-[56px] sm:w-auto sm:justify-start sm:gap-2 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b-[3px] sm:bg-transparent sm:px-1 sm:py-3 sm:text-[15px] ${flow === 'platform'
                ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2] sm:border-[#C56C42] sm:text-[#173F35]'
                : 'border-[#173F35]/20 bg-[#D7DDCF]/35 text-[#202421] hover:border-[#173F35] sm:border-transparent sm:text-[#202421]/65 sm:hover:text-[#173F35]'}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:hidden ${flow === 'platform' ? 'bg-[#F7F6F2]/15' : 'bg-[#D7DDCF]'}`}>
                  <IndianRupee size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-5 sm:inline">EPANTRY income</span>
                  <span className={`mt-0.5 block text-[12px] leading-4 sm:hidden ${flow === 'platform' ? 'text-[#F7F6F2]/85' : 'text-[#202421]/65'}`}>Payments received by EPANTRY</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-[12px] font-bold ${flow === 'platform'
                  ? 'bg-[#F7F6F2]/20 text-[#F7F6F2] sm:bg-[#C56C42]/15 sm:text-[#173F35]'
                  : 'bg-[#D7DDCF] text-[#173F35] sm:bg-[#D7DDCF]/60 sm:text-[#202421]/75'}`}>{platformPayments.length}</span>
                <ChevronRight size={18} className="sm:hidden" aria-hidden="true" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFlow('customer')}
              aria-pressed={flow === 'customer'}
              className={`focus-ring flex min-h-[68px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors sm:inline-flex sm:min-h-[56px] sm:w-auto sm:justify-start sm:gap-2 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b-[3px] sm:bg-transparent sm:px-1 sm:py-3 sm:text-[15px] ${flow === 'customer'
                ? 'border-[#173F35] bg-[#173F35] text-[#F7F6F2] sm:border-[#C56C42] sm:text-[#173F35]'
                : 'border-[#173F35]/20 bg-[#D7DDCF]/35 text-[#202421] hover:border-[#173F35] sm:border-transparent sm:text-[#202421]/65 sm:hover:text-[#173F35]'}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:hidden ${flow === 'customer' ? 'bg-[#F7F6F2]/15' : 'bg-[#D7DDCF]'}`}>
                  <UsersRound size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-5 sm:inline">Customer → Host / Creator</span>
                  <span className={`mt-0.5 block text-[12px] leading-4 sm:hidden ${flow === 'customer' ? 'text-[#F7F6F2]/85' : 'text-[#202421]/65'}`}>Payments made to Hosts or creators</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`inline-flex min-w-7 justify-center rounded-full px-2 py-0.5 text-[12px] font-bold ${flow === 'customer'
                  ? 'bg-[#F7F6F2]/20 text-[#F7F6F2] sm:bg-[#C56C42]/15 sm:text-[#173F35]'
                  : 'bg-[#D7DDCF] text-[#173F35] sm:bg-[#D7DDCF]/60 sm:text-[#202421]/75'}`}>{customerToHostPayments.length}</span>
                <ChevronRight size={18} className="sm:hidden" aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="mt-4 grid min-w-0 items-start gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-[minmax(0,1.66fr)_minmax(290px,0.72fr)]">
            <section aria-label="Payment records" className="min-w-0 overflow-hidden rounded-xl border border-[#173F35]/15 bg-[#F7F6F2]">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#C56C42]">{flow === 'platform' ? 'EPANTRY earnings' : 'Customer transactions'}</p>
                  <h3 className="mt-1 text-[20px] font-bold leading-tight text-[#202421]">Recent payments</h3>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#D7DDCF]/60 px-3 py-1.5 text-[13px] font-bold text-[#173F35]">
                  {activeRows.length} {activeRows.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              {loading && !data ? (
                <div role="status" className="border-t border-[#173F35]/10 px-4 py-9 text-[15px] font-medium text-[#202421]/70 sm:px-6">Loading payments…</div>
              ) : (
                <PaymentList rows={activeRows} selectedId={selectedPaymentId} onSelect={setSelectedPaymentId} tone={activeTone} mobileCustomerScroll={flow === 'customer'} />
              )}
            </section>

            <aside aria-label="Payment breakdown" className="min-w-0 overflow-hidden rounded-xl border border-[#173F35]/10 bg-[#D7DDCF]/45">
              <div className="border-b border-[#173F35]/15 px-5 pb-4 pt-5 sm:px-6">
                <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#C56C42]">
                  <span className="h-[2px] w-5 bg-[#C56C42]" aria-hidden="true" />
                  Sources
                </p>
                <h3 className="mt-2 text-[22px] font-bold leading-tight text-[#202421]">
                  {flow === 'platform' ? 'Where income came from' : 'Where payments went'}
                </h3>
              </div>
              <div className="space-y-5 px-5 py-5 sm:px-6">
                {sourceRows.map(({ key, name, icon: Icon }) => {
                  const value = Math.max(0, Number(sourceMap.get(key)?.amountMinor || 0))
                  const percent = breakdownTotal > 0 ? (value / breakdownTotal) * 100 : 0
                  return (
                    <div key={key}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon size={17} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                          <span className="text-[14px] font-semibold leading-5 text-[#202421]">{name}</span>
                        </div>
                        <span className="whitespace-nowrap text-[15px] font-extrabold text-[#173F35]">{displayingInitialLoad ? '—' : money(value)}</span>
                      </div>
                      <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-[#F7F6F2]" role="img" aria-label={`${name}: ${displayingInitialLoad ? 'Loading' : money(value)}`}>
                        <div className="h-full rounded-full bg-[#C56C42] transition-[width] duration-300" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="border-t border-[#173F35]/15 px-5 py-4 text-[13px] font-medium leading-5 text-[#173F35] sm:px-6">
                {flow === 'platform'
                  ? 'Platform earnings are separate from customer collections.'
                  : 'Customer collections are not EPANTRY income.'}
              </p>
            </aside>
          </div>
        </section>
      </main>
    </AdminShell>
  )
}
