import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  PackageCheck,
  RefreshCw,
  Truck,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  getCommerceErrorMessage,
  listHostOrders,
} from '../../commerce/services/commerce.service'

const FULFILLMENT_STATUSES =
  new Set([
    'seller_accepted',
    'picking',
    'packed',
    'carrier_handoff',
    'out_for_delivery',
    'delivery_failed',
    'return_requested',
    'returned',
  ])

function label(value) {
  return String(
    value ||
      'unknown',
  )
    .split('_')
    .map(
      (token) =>
        `${token
          .charAt(0)
          .toUpperCase()}${token.slice(1)}`,
    )
    .join(' ')
}

export default function HostFulfillmentPage() {
  const [
    orders,
    setOrders,
  ] =
    useState([])

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const result =
            await listHostOrders({
              page:
                1,

              limit:
                50,
            })

          setOrders(
            result?.orders ||
              [],
          )
        } catch (loadError) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load fulfillment queue.',
            ),
          )
        } finally {
          setLoading(false)
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

  const fulfillmentOrders =
    useMemo(
      () =>
        orders.filter(
          (order) =>
            FULFILLMENT_STATUSES.has(
              order.status,
            ),
        ),
      [
        orders,
      ],
    )

  return (
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Truck
                size={18}
              />

              <p className="text-xs font-black uppercase tracking-[0.14em]">
                S07 · Fulfillment
              </p>
            </div>

            <h1 className="mt-3 text-3xl font-black text-stone-950">
              Fulfillment queue
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              This screen is a Host operating view over the frozen M11 SellerOrder state machine. M16 does not create a second order or shipment truth.
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? 'animate-spin'
                  : ''
              }
            />

            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mt-5 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <div className="h-56 animate-pulse rounded-2xl bg-stone-100" />
        ) : fulfillmentOrders.length ? (
          <div className="space-y-3">
            {fulfillmentOrders.map(
              (order) => (
                <Link
                  key={
                    order.id
                  }
                  to={`/host/orders/${encodeURIComponent(order.id)}`}
                  className="focus-ring flex items-center justify-between gap-4 rounded-2xl border border-stone-200 p-4 hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <PackageCheck
                        size={16}
                        className="text-emerald-700"
                      />

                      <p className="truncate text-sm font-black text-stone-900">
                        SellerOrder {order.id?.slice(-8).toUpperCase()}
                      </p>
                    </div>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      {label(order.status)} · {order.fulfillment?.fulfillmentType || 'fulfillment'} · {order.fulfillment?.pincode || '—'}
                    </p>
                  </div>

                  <ArrowRight
                    size={17}
                    className="shrink-0 text-stone-400"
                  />
                </Link>
              ),
            )}
          </div>
        ) : (
          <div className="py-14 text-center">
            <Truck
              size={34}
              className="mx-auto text-stone-300"
            />

            <p className="mt-3 text-sm font-black text-stone-600">
              No SellerOrders currently need fulfillment action.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}