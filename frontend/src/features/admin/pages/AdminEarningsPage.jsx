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

function PaymentDetails({ row, tone }) {
  const detail = row?.detail || {}
  const source = String(row?.source || '')
  const isOrder = source === 'customer_order'
  const isCreator = source === 'creator_session'
  const isFee = source === 'marketplace_fee'
  const isPro = source === 'pro_membership'
  const isMedia = source === 'retail_media'

  const rows = [
    [isFee ? 'From' : 'Paid by', row?.payerName || '—'],
    [isFee ? 'Earned by' : 'Paid to', row?.recipientName || '—'],
    ['Amount', money(row?.amountMinor)],
    ['Paid on', dateTime(row?.occurredAt)],
    ['Payment for', row?.reason || detail.type || 'Payment'],
  ]

  if (isPro) {
    rows.push(['Membership', detail.plan || row?.reason || 'Pro membership'])
    if (detail.validityMonths) {
      rows.push([
        'Access period',
        `${detail.validityMonths} month${detail.validityMonths === 1 ? '' : 's'}`,
      ])
    }
  }

  if (isMedia) {
    if (detail.campaign) rows.push(['Campaign', detail.campaign])
    if (detail.objective) rows.push(['Campaign goal', readable(detail.objective)])
  }

  if (isOrder) {
    if (detail.orderStatus) rows.push(['Order status', readable(detail.orderStatus)])
    if (detail.fulfillmentType) rows.push(['Fulfilment', readable(detail.fulfillmentType)])
    if (Number(detail.subtotalMinor || 0) > 0) rows.push(['Items subtotal', money(detail.subtotalMinor)])
    if (Number(detail.feesMinor || 0) > 0) rows.push(['Order fees', money(detail.feesMinor)])
  }

  if (isCreator) {
    if (detail.session) rows.push(['Session', detail.session])
    if (detail.startsAt) rows.push(['Session time', dateTime(detail.startsAt)])
  }

  if (isFee && Number(detail.grossMerchandiseMinor || 0) > 0) {
    rows.push(['Order value', money(detail.grossMerchandiseMinor)])
  }

  const items = Array.isArray(detail.items)
    ? detail.items.filter(Boolean)
    : []

  return (
    <div
      className={`border-t px-4 py-4 sm:px-6 ${
        tone === 'platform'
          ? 'border-emerald-900/10 bg-[#f1f7f4]'
          : 'border-[#c5d7e1] bg-[#f1f6f9]'
      }`}
    >
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={`${label}-${value}`} className="min-w-0">
            <p className="text-[11px] font-bold text-stone-500">{label}</p>
            <p className="mt-0.5 break-words text-sm font-bold text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      {items.length ? (
        <div className="mt-4 border-t border-stone-200 pt-3">
          <p className="text-[11px] font-bold text-stone-500">Items paid for</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {items.map((item, index) => (
              <span key={`${item}-${index}`} className="text-xs font-semibold text-stone-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PaymentList({ rows, selectedId, onSelect, tone }) {
  if (!rows.length) {
    return (
      <div className="border-t border-stone-200 px-4 py-6 sm:px-7">
        <p className="text-sm font-bold text-stone-900">No payment records in this view yet.</p>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          Use Refresh after a payment is completed.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-stone-200">
      {rows.map((row, index) => {
        const open = selectedId === row.id

        return (
          <div key={`${row.source}-${row.id}`} className={index ? 'border-t border-stone-100' : ''}>
            <button
              type="button"
              onClick={() => onSelect(open ? '' : row.id)}
              aria-expanded={open}
              className="focus-ring grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-stone-50 sm:grid-cols-[minmax(0,1.5fr)_minmax(160px,0.65fr)_130px_auto] sm:px-7"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-stone-950">
                  {row.label || `${row.payerName || 'Customer'} paid ${row.recipientName || 'EPANTRY'}`}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-stone-500 sm:line-clamp-1">
                  {row.reason || 'Payment'}
                </p>
              </div>

              <p className="hidden text-xs font-semibold text-stone-500 sm:block">
                {dateTime(row.occurredAt)}
              </p>

              <p className={`text-sm font-black ${tone === 'platform' ? 'text-emerald-800' : 'text-[#24536b]'}`}>
                {money(row.amountMinor)}
              </p>

              <span className="hidden items-center gap-1 text-xs font-bold text-stone-500 sm:inline-flex">
                {open ? 'Close' : 'Details'}
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>

            <div className="flex items-center justify-between px-4 pb-3 sm:hidden">
              <p className="text-[11px] font-semibold text-stone-500">{dateTime(row.occurredAt)}</p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600">
                {open ? 'Close' : 'View details'}
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            </div>

            {open ? <PaymentDetails row={row} tone={tone} /> : null}
          </div>
        )
      })}
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
      setError(
        getAdminGovernanceErrorMessage(
          requestError,
          'Unable to load earnings and payments.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setSelectedPaymentId('')
  }, [flow])

  const month = data?.currentMonth || {}
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
    for (const source of Array.isArray(data?.sources) ? data.sources : []) {
      map.set(source.key, source)
    }
    return map
  }, [data])

  return (
    <AdminShell
      title="Earnings & Payments"
      description="See what EPANTRY earned and follow customer payments to Hosts or creators."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-bold text-stone-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="min-h-[100svh] bg-[#f6f4ee] pb-7 sm:pb-9">
        <section className="border-b border-emerald-900/20 bg-[#0d5946] text-white">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="px-4 py-5 sm:px-7 sm:py-7">
              <p className="text-xs font-bold text-emerald-100">Money overview</p>
              <h2 className="mt-1 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">
                Follow every payment without mixing the money flows.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85 sm:hidden line-clamp-2">
                EPANTRY income and customer-to-Host payments stay separate.
              </p>
              <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-emerald-50/85 sm:block">
                Use the switch below to see either money EPANTRY earned or money customers paid to Hosts and creators.
              </p>
            </div>

            <div className="grid grid-cols-3 border-t border-white/15 lg:border-l lg:border-t-0">
              <div className="px-3 py-4 sm:px-5 sm:py-5">
                <p className="text-xl font-black sm:text-2xl">{money(all.platformRevenueMinor)}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-emerald-100 sm:text-xs">EPANTRY earned</p>
              </div>
              <div className="border-l border-white/15 px-3 py-4 sm:px-5 sm:py-5">
                <p className="text-xl font-black sm:text-2xl">{money(all.commerceCollectionsMinor + all.creatorCollectionsMinor)}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-emerald-100 sm:text-xs">Customer payments</p>
              </div>
              <div className="border-l border-white/15 px-3 py-4 sm:px-5 sm:py-5">
                <p className="text-xl font-black sm:text-2xl">{money(data?.pendingHostPayoutMinor)}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-emerald-100 sm:text-xs">Waiting payout</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
            {[
              ['01', 'Choose the money flow', 'EPANTRY income or customer payments.'],
              ['02', 'Open a payment', 'See who paid and who received it.'],
              ['03', 'Check the reason', 'See the plan, campaign, item or session.'],
              ['04', 'Follow the payout', 'See money still waiting for payout.'],
            ].map(([number, title, copy], index) => (
              <div
                key={number}
                className={`px-4 py-3 sm:px-6 sm:py-4 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l lg:border-white/15' : ''}`}
              >
                <p className="text-xs font-black text-emerald-100">{number}</p>
                <p className="mt-1 text-sm font-bold">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-emerald-50/75">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:px-7">
            {error}
          </div>
        ) : null}

        <section className="border-b border-stone-200 bg-white px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-stone-500">View payments</p>
              <h2 className="mt-0.5 text-lg font-black text-stone-950">Choose one money flow</h2>
            </div>

            <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-stone-300 bg-stone-50 p-1 sm:w-auto sm:min-w-[520px]">
              <button
                type="button"
                aria-pressed={flow === 'platform'}
                onClick={() => setFlow('platform')}
                className={`focus-ring rounded-lg px-3 py-2.5 text-left transition ${flow === 'platform' ? 'bg-[#0d5946] text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
              >
                <span className="block text-xs font-black sm:text-sm">EPANTRY income</span>
                <span className={`mt-0.5 block text-[10px] font-semibold sm:text-xs ${flow === 'platform' ? 'text-emerald-100' : 'text-stone-500'}`}>
                  {platformPayments.length} payments
                </span>
              </button>

              <button
                type="button"
                aria-pressed={flow === 'customer'}
                onClick={() => setFlow('customer')}
                className={`focus-ring rounded-lg px-3 py-2.5 text-left transition ${flow === 'customer' ? 'bg-[#173b4f] text-white shadow-sm' : 'text-stone-700 hover:bg-white'}`}
              >
                <span className="block text-xs font-black sm:text-sm">Customer → Host / Creator</span>
                <span className={`mt-0.5 block text-[10px] font-semibold sm:text-xs ${flow === 'customer' ? 'text-sky-100' : 'text-stone-500'}`}>
                  {customerToHostPayments.length} payments
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-white">
          <div className={`px-4 py-4 sm:px-7 sm:py-5 ${flow === 'platform' ? 'bg-[#e7f3ee]' : 'bg-[#e8f1f6]'}`}>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className={`text-xs font-bold ${flow === 'platform' ? 'text-emerald-700' : 'text-[#315f7a]'}`}>
                  {flow === 'platform' ? 'Money paid to EPANTRY' : 'Customer payments to Hosts & creators'}
                </p>
                <h2 className="mt-1 text-xl font-black text-stone-950">
                  {flow === 'platform'
                    ? 'Subscriptions, ads and marketplace income'
                    : 'See who paid whom and what they paid for'}
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600 sm:text-sm">
                  {flow === 'platform'
                    ? 'Open a payment to see the payer, amount, date and reason.'
                    : 'Open a payment to see the customer, Host or creator, item and date.'}
                </p>
              </div>
              <p className={`shrink-0 text-sm font-bold ${flow === 'platform' ? 'text-emerald-800' : 'text-[#315f7a]'}`}>
                {activeRows.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm font-semibold text-stone-500 sm:px-7">Loading payments…</div>
          ) : (
            <PaymentList
              rows={activeRows}
              selectedId={selectedPaymentId}
              onSelect={setSelectedPaymentId}
              tone={activeTone}
            />
          )}
        </section>

        <section className="bg-[#f1f3f5] px-4 py-4 sm:px-7 sm:py-5">
          {flow === 'platform' ? (
            <div className="grid grid-cols-3 divide-x divide-stone-300">
              <div className="pr-3">
                <Crown size={15} className="text-[#5f4d87]" aria-hidden="true" />
                <p className="mt-1 text-xs font-bold text-stone-800">Memberships</p>
                <p className="mt-0.5 text-xs text-stone-500">{money(sourceMap.get('pro_membership')?.amountMinor)}</p>
              </div>
              <div className="px-3">
                <Megaphone size={15} className="text-[#315f7a]" aria-hidden="true" />
                <p className="mt-1 text-xs font-bold text-stone-800">Ads</p>
                <p className="mt-0.5 text-xs text-stone-500">{money(sourceMap.get('retail_media')?.amountMinor)}</p>
              </div>
              <div className="pl-3">
                <IndianRupee size={15} className="text-emerald-700" aria-hidden="true" />
                <p className="mt-1 text-xs font-bold text-stone-800">Marketplace fees</p>
                <p className="mt-0.5 text-xs text-stone-500">{money(sourceMap.get('marketplace_fee')?.amountMinor)}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-stone-300">
              <div className="pr-4">
                <ShoppingBasket size={15} className="text-emerald-700" aria-hidden="true" />
                <p className="mt-1 text-xs font-bold text-stone-800">Marketplace orders</p>
                <p className="mt-0.5 text-xs text-stone-500">{money(sourceMap.get('customer_orders')?.amountMinor)}</p>
              </div>
              <div className="pl-4">
                <UsersRound size={15} className="text-[#315f7a]" aria-hidden="true" />
                <p className="mt-1 text-xs font-bold text-stone-800">Creator sessions</p>
                <p className="mt-0.5 text-xs text-stone-500">{money(sourceMap.get('creator_sessions')?.amountMinor)}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  )
}
