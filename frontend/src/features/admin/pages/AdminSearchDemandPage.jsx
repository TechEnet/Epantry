import {
  Clock3,
  MapPinned,
  RefreshCw,
  Search,
  TrendingUp,
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
  getAdminGovernanceErrorMessage,
  getAdminSearchDemand,
} from '../../adminGovernance/services/adminGovernance.service'

function areaLabel(row) {
  const parts = [row?.city, row?.state, row?.postcode].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Area not available'
}

function time(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminSearchDemandPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getAdminSearchDemand({ days, limit: 50 }))
    } catch (requestError) {
      setError(getAdminGovernanceErrorMessage(requestError, 'Unable to load customer search demand.'))
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  const strongestAreaQuery = useMemo(() => data?.queryByArea?.[0] || null, [data])

  const metrics = [
    {
      icon: Search,
      label: 'Total searches',
      value: data?.totalSearches || 0,
    },
    {
      icon: UsersRound,
      label: 'Customers',
      value: data?.uniqueCustomers || 0,
    },
    {
      icon: TrendingUp,
      label: 'Most searched',
      value: data?.topQuery?.query || 'No searches yet',
    },
    {
      icon: MapPinned,
      label: 'Top location',
      value: areaLabel(data?.topArea),
    },
  ]

  return (
    <AdminShell
      title="Customer Search Demand"
      showWorkspaceBadge={false}
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-bold text-stone-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        <section className="overflow-hidden rounded-[20px] bg-[#174d48] text-white sm:rounded-[24px]">
          <div className="grid gap-5 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-7 lg:px-7">
            <div className="min-w-0">
              <h2 className="text-[23px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[28px]">
                What customers are searching for
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-white/85 sm:text-[15px]">
                See searches from signed-in customers and the general area linked to each search. Exact addresses and GPS coordinates are not shown.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-start">
              <span className="text-[13px] font-semibold text-white/80">Reporting period</span>
              <div className="inline-flex w-full rounded-xl border border-white/20 bg-white/10 p-1 sm:w-auto" aria-label="Reporting period">
                {[7, 30, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    aria-pressed={days === value}
                    className={`focus-ring min-h-10 flex-1 rounded-lg px-3 py-2 text-[14px] font-bold transition sm:flex-none ${days === value ? 'bg-white text-[#174d48] shadow-sm' : 'text-white hover:bg-white/15'}`}
                  >
                    {value} days
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-[14px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-[20px] border border-[#dbe6df] bg-white sm:rounded-[24px]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e1e9e3] px-4 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[21px] font-extrabold tracking-tight text-[#193f33] sm:text-[24px]">Search overview</h2>
            <span className="rounded-full bg-[#ebf5ed] px-3 py-1 text-[13px] font-semibold text-[#296c4c]">Last {days} days</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ icon: Icon, label, value }, index) => (
              <div
                key={label}
                className={`min-w-0 px-4 py-5 sm:px-6 sm:py-6 ${index % 2 ? 'border-l border-[#e1e9e3]' : ''} ${index > 1 ? 'border-t border-[#e1e9e3] lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-[#e1e9e3]' : ''}`}
              >
                <div className="flex items-center gap-2 text-[#3b735e]">
                  <Icon size={17} className="shrink-0" aria-hidden="true" />
                  <p className="text-[14px] font-semibold leading-5 text-stone-600">{label}</p>
                </div>
                <p className="mt-3 break-words text-[24px] font-extrabold leading-tight tracking-tight text-[#183c30] sm:text-[30px]">{value}</p>
              </div>
            ))}
          </div>

          {strongestAreaQuery ? (
            <div className="flex flex-col gap-2 border-t border-[#c7e1d1] bg-[#edf7f0] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#3b7058]">Leading search by location</p>
                <p className="mt-1 break-words text-[19px] font-extrabold text-[#174c38] sm:text-[21px]">{strongestAreaQuery.query}</p>
              </div>
              <p className="min-w-0 break-words text-[14px] font-semibold text-[#345f4c] sm:text-right">
                {areaLabel(strongestAreaQuery)} <span className="mx-1 text-[#8baa98]">/</span> {strongestAreaQuery.searches} searches
              </p>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[20px] border border-stone-200 bg-[#fdfdfb] sm:rounded-[24px]">
          <div className="border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[21px] font-extrabold tracking-tight text-stone-900 sm:text-[24px]">Search patterns</h2>
          </div>

          <div className="grid lg:grid-cols-2">
            <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-center gap-2">
                <Search size={18} className="text-[#267553]" aria-hidden="true" />
                <h3 className="text-[18px] font-bold text-stone-900">Popular searches</h3>
              </div>
              <div className="mt-3 divide-y divide-stone-200 border-t border-stone-200">
                {(data?.topQueries || []).length ? data.topQueries.map((row, index) => (
                  <div key={`${row.query}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 sm:py-4">
                    <div className="min-w-0">
                      <p className="break-words text-[15px] font-bold text-stone-900">{row.query}</p>
                      <p className="mt-0.5 text-[13px] text-stone-600">{row.uniqueCustomers} customer{row.uniqueCustomers === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-[17px] font-extrabold tabular-nums text-[#1c6948]">{row.searches}</p>
                  </div>
                )) : (
                  <p className="py-6 text-[14px] text-stone-600">No searches in this period.</p>
                )}
              </div>
            </div>

            <div className="min-w-0 border-t border-stone-200 px-4 py-4 sm:px-6 sm:py-5 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-2">
                <MapPinned size={18} className="text-[#267553]" aria-hidden="true" />
                <h3 className="text-[18px] font-bold text-stone-900">Top locations</h3>
              </div>
              <div className="mt-3 divide-y divide-stone-200 border-t border-stone-200">
                {(data?.topAreas || []).length ? data.topAreas.map((row, index) => (
                  <div key={`${areaLabel(row)}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 sm:py-4">
                    <div className="min-w-0">
                      <p className="break-words text-[15px] font-bold text-stone-900">{areaLabel(row)}</p>
                      <p className="mt-0.5 text-[13px] text-stone-600">{row.uniqueCustomers} customer{row.uniqueCustomers === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-[17px] font-extrabold tabular-nums text-[#1c6948]">{row.searches}</p>
                  </div>
                )) : (
                  <p className="py-6 text-[14px] text-stone-600">No location details recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-[#cde2d4] bg-[#f0f7f2] sm:rounded-[24px]">
          <div className="flex items-center gap-2 border-b border-[#d1e3d7] px-4 py-4 sm:px-6 sm:py-5">
            <MapPinned size={20} className="text-[#1e6949]" aria-hidden="true" />
            <h2 className="text-[21px] font-extrabold tracking-tight text-[#173e2e] sm:text-[24px]">Demand by location</h2>
          </div>
          <div className="px-4 sm:px-6">
            {(data?.queryByArea || []).length ? (
              <div className="divide-y divide-[#d4e6da]">
                {(data?.queryByArea || []).map((row, index) => (
                  <div key={`${row.query}-${areaLabel(row)}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-5">
                    <div className="min-w-0">
                      <p className="break-words text-[15px] font-bold text-[#173e2e]">{row.query}</p>
                      <p className="mt-1 break-words text-[13px] text-[#53735e] sm:hidden">{areaLabel(row)}</p>
                    </div>
                    <p className="hidden min-w-0 break-words text-[14px] text-[#416851] sm:block">{areaLabel(row)}</p>
                    <p className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[#1e6949]">{row.searches} searches</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-[14px] text-[#496b58]">No local search demand in this period.</p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] border border-stone-200 bg-white sm:rounded-[24px]">
          <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-4 sm:px-6 sm:py-5">
            <Clock3 size={20} className="text-[#226c4d]" aria-hidden="true" />
            <h2 className="text-[21px] font-extrabold tracking-tight text-stone-900 sm:text-[24px]">Recent searches</h2>
          </div>
          <div className="divide-y divide-stone-200 px-4 sm:px-6">
            {(data?.recent || []).length ? (data?.recent || []).map((row) => (
              <div key={row.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <div className="min-w-0">
                  <p className="break-words text-[15px] font-bold text-stone-900">{row.query}</p>
                  <p className="mt-1 break-words text-[13px] text-stone-600">{areaLabel(row.area)} / {row.surface}</p>
                </div>
                <p className="flex items-center gap-1.5 text-[13px] text-stone-500 sm:justify-end">
                  <Clock3 size={14} className="shrink-0" aria-hidden="true" />
                  {time(row.occurredAt)}
                </p>
              </div>
            )) : (
              <p className="py-6 text-[14px] text-stone-600">No recent searches in this period.</p>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  )
}
