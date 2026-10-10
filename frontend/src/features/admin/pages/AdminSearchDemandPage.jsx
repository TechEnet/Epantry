import {
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
    if (!value) return '—'
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
        label: 'Searches',
        value: data?.totalSearches || 0,
      },
      {
        icon: UsersRound,
        label: 'Customers',
        value: data?.uniqueCustomers || 0,
      },
      {
        icon: TrendingUp,
        label: 'Top search',
        value: data?.topQuery?.query || '—',
      },
      {
        icon: MapPinned,
        label: 'Top area',
        value: areaLabel(data?.topArea),
      },
    ]
  
    return (
      <AdminShell
        title="Customer Search Demand"
        description="See what signed-in customers are searching for and the coarse area attached to that search. Exact addresses and GPS coordinates are not shown here."
        actions={
          <button type="button" onClick={load} disabled={loading} className="focus-ring inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-2 text-xs font-black text-stone-700 shadow-sm disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      >
        <section className="overflow-hidden rounded-[26px] bg-[#174d66] text-white shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#bfe5ef]">Demand signal</p>
              <h2 className="mt-2 max-w-3xl text-[28px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[34px]">
                Know what customers are trying to find.
              </h2>
              <p className="mt-3 max-w-2xl text-[13px] font-semibold leading-5 text-white/72 sm:text-[15px] sm:leading-6">
                Use repeated searches and area patterns to decide what catalog, Host supply or content EPANTRY should improve next.
              </p>
            </div>
  
            <div className="flex border-t border-white/12 px-5 py-4 sm:px-7 lg:border-l lg:border-t-0 lg:px-7 lg:py-8">
              <div className="flex w-full items-center gap-2 lg:w-auto">
                {[7, 30, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    className={`focus-ring flex-1 rounded-full px-4 py-2.5 text-xs font-black transition lg:flex-none ${days === value ? 'bg-white text-[#174d66]' : 'border border-white/18 bg-white/[0.08] text-white hover:bg-white/[0.13]'}`}
                  >
                    {value}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
  
        {error ? <p className="mt-4 rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
  
        <section className="mt-5 overflow-hidden rounded-[26px] border border-[#bad7e4] bg-[#e7f2f7]">
          <div className="border-b border-[#c6dee8] px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2d6f89]">Current demand</p>
            <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <h2 className="text-[20px] font-black tracking-[-0.02em] text-[#123f53] sm:text-[24px]">A quick read of customer intent.</h2>
              <p className="max-w-xl text-[13px] font-semibold leading-5 text-[#476f7e] sm:text-right sm:text-[14px]">
                Search volume, customer reach and the strongest demand signal in this period.
              </p>
            </div>
          </div>
  
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {metrics.map(({ icon: Icon, label, value }, index) => (
              <div
                key={label}
                className={`min-w-0 px-5 py-5 sm:px-7 sm:py-6 ${index % 2 ? 'border-l border-[#c6dee8]' : ''} ${index > 1 ? 'border-t border-[#c6dee8] lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-[#c6dee8]' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4e7988]">{label}</p>
                  <Icon size={17} className="shrink-0 text-[#1b637c]" aria-hidden="true" />
                </div>
                <p className="mt-4 break-words text-[24px] font-black leading-tight tracking-[-0.035em] text-[#102f3c] sm:text-[30px]">{value}</p>
              </div>
            ))}
          </div>
  
          {strongestAreaQuery ? (
            <div className="border-t border-[#9fcdb9] bg-[#dff1e8] px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#237057]">Strongest area + item signal</p>
                <p className="mt-1.5 break-words text-[20px] font-black tracking-[-0.025em] text-[#104d3b] sm:text-[24px]">“{strongestAreaQuery.query}”</p>
              </div>
              <p className="mt-2 shrink-0 text-[13px] font-bold text-[#376f5d] sm:mt-0 sm:text-right sm:text-[14px]">
                {areaLabel(strongestAreaQuery)} · {strongestAreaQuery.searches} searches
              </p>
            </div>
          ) : null}
        </section>
  
        <section className="mt-5 overflow-hidden rounded-[26px] border border-stone-200 bg-[#f7f6f2]">
          <div className="grid lg:grid-cols-2">
            <div className="px-5 py-6 sm:px-7 sm:py-7 lg:pr-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#57798a]">Search patterns</p>
                  <h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-stone-950 sm:text-[24px]">Most searched items & ideas</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-stone-500">Repeated queries across customer search.</p>
                </div>
                <Search size={20} className="mt-1 shrink-0 text-[#2c6a82]" aria-hidden="true" />
              </div>
  
              <div className="mt-5 border-t border-stone-200">
                {(data?.topQueries || []).length ? data.topQueries.map((row, index) => (
                  <div key={`${row.query}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-stone-200 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-black text-stone-900">{row.query}</p>
                      <p className="mt-1 text-[12px] font-semibold text-stone-500">{row.uniqueCustomers} customer{row.uniqueCustomers === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-[18px] font-black text-[#1d627c]">{row.searches}</p>
                  </div>
                )) : (
                  <p className="py-8 text-center text-[13px] font-semibold text-stone-500">No customer searches recorded in this period.</p>
                )}
              </div>
            </div>
  
            <div className="border-t border-stone-200 px-5 py-6 sm:px-7 sm:py-7 lg:border-l lg:border-t-0 lg:pl-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#32725c]">Area patterns</p>
                  <h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-stone-950 sm:text-[24px]">Areas with the most demand</h2>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-stone-500">Coarse city / state / postcode only.</p>
                </div>
                <MapPinned size={20} className="mt-1 shrink-0 text-[#1b6a50]" aria-hidden="true" />
              </div>
  
              <div className="mt-5 border-t border-stone-200">
                {(data?.topAreas || []).length ? data.topAreas.map((row, index) => (
                  <div key={`${areaLabel(row)}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-stone-200 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-black text-stone-900">{areaLabel(row)}</p>
                      <p className="mt-1 text-[12px] font-semibold text-stone-500">{row.uniqueCustomers} customer{row.uniqueCustomers === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-[18px] font-black text-[#1b6a50]">{row.searches}</p>
                  </div>
                )) : (
                  <p className="py-8 text-center text-[13px] font-semibold text-stone-500">Area demand will appear when customers search with a location context.</p>
                )}
              </div>
            </div>
          </div>
        </section>
  
        <section className="mt-5 overflow-hidden rounded-[26px] border border-[#a9d6c2] bg-[#e2f2ea]">
          <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="bg-[#125541] px-5 py-6 text-white sm:px-7 sm:py-7">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b9e3d2]">Local demand</p>
              <h2 className="mt-2 text-[21px] font-black leading-tight tracking-[-0.025em] sm:text-[25px]">What is being searched in each area</h2>
              <p className="mt-2 text-[13px] font-semibold leading-5 text-white/70">Use this list to spot local product or recipe demand.</p>
            </div>
  
            <div className="px-5 py-2 sm:px-7 sm:py-3">
              <div className="divide-y divide-[#bbdccd]">
                {(data?.queryByArea || []).map((row, index) => (
                  <div key={`${row.query}-${areaLabel(row)}-${index}`} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:py-5">
                    <p className="min-w-0 break-words text-[15px] font-black text-[#123f32]">{row.query}</p>
                    <p className="min-w-0 break-words text-[13px] font-semibold text-[#4a7565]">{areaLabel(row)}</p>
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#166047]">{row.searches} searches</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
  
        <section className="mt-5 overflow-hidden rounded-[26px] border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-5 py-5 sm:px-7 sm:py-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#57798a]">Live activity</p>
            <h2 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-stone-950 sm:text-[24px]">Recent customer searches</h2>
          </div>
  
          <div className="divide-y divide-stone-200 px-5 sm:px-7">
            {(data?.recent || []).map((row) => (
              <div key={row.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:py-5">
                <div className="min-w-0">
                  <p className="break-words text-[15px] font-black text-stone-900">{row.query}</p>
                  <p className="mt-1 break-words text-[12px] font-semibold text-stone-500">{areaLabel(row.area)} · {row.surface}</p>
                </div>
                <p className="shrink-0 text-[12px] font-semibold text-stone-400">{time(row.occurredAt)}</p>
              </div>
            ))}
          </div>
        </section>
      </AdminShell>
    )
  }
  