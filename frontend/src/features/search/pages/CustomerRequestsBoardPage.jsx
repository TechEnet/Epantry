import { ArrowRight, Bell, PackageCheck, RefreshCw, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../../../api/apiClient'
import AdminShell from '../../admin/components/AdminShell'

function dateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function RequestBoard({ isAdmin }) {
  const [status, setStatus] = useState('active')
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState({ items: [], hasMore: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ status, page: String(page), ...(query ? { query } : {}) })
    apiClient.get(`/notifications/customer-demand?${params}`)
      .then(({ data: result }) => { if (live) setData(result?.data || { items: [], hasMore: false }) })
      .catch((err) => {
        if (!live) return
        setData({ items: [], hasMore: false })
        setError(err?.response?.data?.message || err?.message || 'Unable to load requests.')
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [page, query, refresh, status])

  const changeStatus = (value) => { setStatus(value); setPage(1) }
  const rows = Array.isArray(data.items) ? data.items : []
  return (
    <main className="min-w-0 bg-[#F7F6F1] text-[#173F35]">
      <div className="mx-auto max-w-[1360px] px-3 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#CEDDD2] pb-5">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[.08em] text-[#AB6246]">Customer demand / Requested products</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-.035em] sm:text-[34px]">What customers want next.</h1>
            <p className="mt-2 max-w-[690px] text-[15px] leading-6 text-[#53675A]">See products customers couldn't find. Hosts can submit them for Super Admin approval; customers are alerted only when a matching product is ready to buy.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => setRefresh((v) => v + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#B7CDBE] bg-white px-4 text-[14px] font-semibold disabled:opacity-50"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh</button>
            <Link to={isAdmin ? '/admin/host-listings' : '/host/listings/new?type=grocery'} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-4 text-[14px] font-bold text-white">{isAdmin ? 'Review listings' : 'Create listing'} <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </header>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[#3D6951]"><Bell size={19} aria-hidden="true" /><h2 className="text-[21px] font-bold">Product requests</h2></div>
          <div role="group" aria-label="Request status" className="inline-flex rounded-lg bg-[#E4ECE4] p-1">
            {[["active", "Open"], ["notified", "Fulfilled"]].map(([value, label]) => <button key={value} type="button" onClick={() => changeStatus(value)} aria-pressed={status === value} className={`min-h-10 rounded-md px-4 text-[14px] font-semibold ${status === value ? 'bg-[#173F35] text-white' : 'text-[#345949] hover:bg-[#DAE7DB]'}`}>{label}</button>)}
          </div>
        </div>
        <form className="mt-4 flex max-w-[560px] gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(text.trim().slice(0, 80)); setPage(1) }}>
          <label htmlFor="demand-search" className="sr-only">Find requested product</label>
          <div className="relative min-w-0 flex-1"><Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B8473]" /><input id="demand-search" value={text} onChange={(event) => setText(event.target.value)} type="search" placeholder="Find a product request" maxLength={80} className="min-h-11 w-full rounded-lg border border-[#BDCFBF] bg-white pl-10 pr-3 text-[15px] outline-offset-2" /></div>
          <button type="submit" className="min-h-11 rounded-lg border border-[#B0C7B4] bg-[#E5F0E8] px-4 text-[14px] font-bold">Find</button>
        </form>
        {error ? <p role="alert" className="mt-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-[14px] text-red-800">{error}</p> : null}
        <section aria-busy={loading} className="mt-4 overflow-hidden border-y border-[#C9D9CC] bg-[#FBFCF8]">
          {loading ? <p role="status" className="px-5 py-8 text-[15px]">Loading customer requests…</p> : rows.length ? <div className="divide-y divide-[#D8E2D7]">
            {rows.map((item, i) => <article key={`${item.query}-${i}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6">
              <div className="min-w-0"><h3 className="break-words text-[17px] font-bold sm:text-[18px]">{item.query}</h3><p className="mt-1 text-[13px] leading-5 text-[#607567]">{status === 'active' ? `Last requested ${dateLabel(item.lastRequestedAt)}` : `Customer notified ${dateLabel(item.notifiedAt)}`}{item.matchedProductName ? ` · Listed as ${item.matchedProductName}` : ''}</p></div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1E9] px-3 py-1.5 text-[13px] font-bold text-[#276447]"><Users size={15} aria-hidden="true" />{item.customers} {item.customers === 1 ? 'customer' : 'customers'}</span>{status === 'active' && !isAdmin ? <Link to="/host/listings/new?type=grocery" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-[#174F3B] hover:underline">List this item <ArrowRight size={16} aria-hidden="true" /></Link> : null}</div>
            </article>)}
          </div> : <div className="px-5 py-10 text-center"><PackageCheck size={32} className="mx-auto text-[#32775B]" aria-hidden="true" /><h3 className="mt-2 text-[18px] font-bold">No {status === 'active' ? 'open' : 'fulfilled'} requests found.</h3><p className="mt-1 text-[14px] text-[#607567]">Try another search or switch the status.</p></div>}
        </section>
        <div className="mt-4 flex items-center justify-center gap-4"><button type="button" disabled={loading || page === 1} onClick={() => setPage((v) => Math.max(1, v - 1))} className="min-h-10 rounded-lg border border-[#B7CDBE] px-4 text-[14px] font-bold disabled:opacity-40">Previous</button><span className="text-[14px] font-semibold">Page {page}</span><button type="button" disabled={loading || !data.hasMore} onClick={() => setPage((v) => v + 1)} className="min-h-10 rounded-lg border border-[#B7CDBE] px-4 text-[14px] font-bold disabled:opacity-40">Next</button></div>
        <p className="mt-7 text-[13px] leading-5 text-[#647A6A]">Only explicit customer requests appear here. Customer identities and addresses remain private. Approval and active selling are required before anyone receives an availability alert.</p>
      </div>
    </main>
  )
}

export default function CustomerRequestsBoardPage({ isAdmin = false }) {
  return isAdmin ? <AdminShell title="Customer Requests" showWorkspaceBadge={false}><RequestBoard isAdmin /></AdminShell> : <RequestBoard isAdmin={false} />
}
