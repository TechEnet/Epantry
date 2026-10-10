import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react'
import { getSearchAiQuality } from '../services/searchAdmin.service'

const PAGE_SIZE = 25
const FILTERS = [
  { value: '', label: 'All runs' },
  { value: 'succeeded', label: 'Worked normally' },
  { value: 'fallback', label: 'Used backup' },
  { value: 'failed', label: 'Needs attention' },
]

const STATUS_LABELS = {
  succeeded: 'Worked normally',
  fallback: 'Used backup search',
  failed: 'Needs attention',
}

const STATUS_CLASSES = {
  succeeded: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  fallback: 'border-amber-200 bg-amber-50 text-amber-800',
  failed: 'border-rose-200 bg-rose-50 text-rose-800',
}

function niceName(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (initial) => initial.toUpperCase()) || 'Not recorded'
}

function dateLabel(value) {
  if (!value) return 'Time not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Time not recorded' : date.toLocaleString()
}

function formatActorType(value) {
  const roles = {
    customer: 'Customer', host: 'Host', admin: 'Admin', system: 'EPANTRY system',
  }
  return roles[String(value || '').toLowerCase()] || niceName(value)
}

function RunField({ label, value }) {
  return (
    <div className="min-w-0 border-b border-stone-100 py-2.5 last:border-0">
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold leading-5 text-stone-800 [overflow-wrap:anywhere]">{value ?? 'Not recorded'}</dd>
    </div>
  )
}

function RunHistoryItem({ item }) {
  const status = item.status || ''
  const isProblem = status === 'failed' || status === 'fallback'
  const sourceIds = Array.isArray(item.sourceIds) ? item.sourceIds : []
  const toolNames = Array.isArray(item.toolNames) ? item.toolNames : []

  return (
    <article className="border-b border-stone-200 px-3.5 py-3.5 last:border-b-0 sm:px-6 sm:py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_CLASSES[status] || 'border-stone-200 bg-stone-50 text-stone-700'}`}>
              {STATUS_LABELS[status] || niceName(status)}
            </span>
            <span className="text-xs font-semibold text-stone-500">{formatActorType(item.actorType)}</span>
          </div>
          <h4 className="mt-2 text-base font-bold leading-5 text-[#173d33]">
            {isProblem ? 'AI needed help with this request' : 'AI request completed'}
          </h4>
          <p className="mt-1 text-sm leading-5 text-stone-600">
            {isProblem
              ? niceName(item.fallbackCode || item.errorCode || 'Result needs checking')
              : 'Completed using the available AI service.'}
          </p>
        </div>
        <div className="min-w-0 text-left sm:text-right">
          <p className="text-xs font-semibold text-stone-500">{dateLabel(item.recordedAt)}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 sm:justify-end">
            <Clock3 size={13} aria-hidden="true" />
            {item.latencyMs === null || item.latencyMs === undefined ? 'Time unavailable' : `${item.latencyMs} ms`}
          </p>
        </div>
      </div>
      <details className="group mt-3 border-t border-stone-100 pt-2.5">
        <summary className="focus-ring w-fit cursor-pointer rounded-md py-1 text-sm font-bold text-emerald-800 hover:text-emerald-950">
          View run details <span className="inline-block transition-transform group-open:rotate-90">›</span>
        </summary>
        <dl className="mt-2 grid min-w-0 gap-x-5 border-t border-stone-100 sm:grid-cols-2 lg:grid-cols-3">
          <RunField label="AI model" value={item.modelId || 'Not recorded'} />
          <RunField label="AI provider" value={niceName(item.provider)} />
          <RunField label="Setup version" value={item.promptVersion || 'Not recorded'} />
          <RunField label="Confidence score" value={item.confidence === null || item.confidence === undefined ? 'Not recorded' : item.confidence} />
          <RunField label="Tools used" value={toolNames.length ? toolNames.map(niceName).join(', ') : 'None recorded'} />
          <RunField label="Reason / error" value={item.fallbackCode || item.errorCode ? niceName(item.fallbackCode || item.errorCode) : 'None recorded'} />
          <RunField label="Interaction type" value={niceName(item.interactionType)} />
          <RunField label="Run ID" value={item.id || 'Not recorded'} />
          <RunField label="Session ID" value={item.sessionId || 'Not recorded'} />
          <RunField label="Source records" value={sourceIds.length ? sourceIds.join(', ') : 'None recorded'} />
        </dl>
        {item.usage != null && (
          <div className="mt-2 border-t border-stone-100 pt-3">
            <p className="text-xs font-semibold text-stone-500">Provider usage details</p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-700">{JSON.stringify(item.usage, null, 2)}</pre>
          </div>
        )}
      </details>
    </article>
  )
}

export default function AdminAiQualityPanel({ refreshSignal = 0 }) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestNumber = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestNumber.current
    setLoading(true)
    setError('')
    try {
      const result = await getSearchAiQuality({ page, limit: PAGE_SIZE, status })
      if (requestNumber.current === requestId) setData(result)
    } catch (requestError) {
      if (requestNumber.current === requestId) {
        setData(null)
        setError(requestError?.response?.data?.message || requestError?.message || 'Unable to load AI activity. Please try again.')
      }
    } finally {
      if (requestNumber.current === requestId) setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
    return () => { requestNumber.current += 1 }
  }, [load, refreshSignal])

  const summary = data?.summary || {}
  const pages = Math.max(0, Number(data?.pagination?.pages || 0))
  const totalInFilter = Number(data?.pagination?.total || 0)
  const items = Array.isArray(data?.items) ? data.items : []

  return (
    <section id="ai-quality" className="min-w-0 space-y-4 sm:space-y-5">
      <div className="overflow-hidden rounded-[20px] border border-[#c9e4da] bg-[#e4f3eb]">
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800">AI reliability</p>
            <h2 className="mt-1 text-[24px] font-extrabold leading-tight text-[#124633] sm:text-[29px]">Check how the AI assistant is working</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-5 text-[#416558] sm:text-base sm:leading-6">
              <span className="sm:hidden">Review AI results, backups and errors.</span>
              <span className="hidden sm:inline">See when Food Copilot answers normally, uses backup search or needs attention. Customer messages stay private.</span>
            </p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="focus-ring inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh AI results
          </button>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[#cde7dd]">
          {[
            ['01', 'Check results'],
            ['02', 'Find problems'],
            ['03', 'Review details'],
          ].map(([number, label]) => (
            <div key={number} className="min-w-0 bg-[#f3faf6] px-2 py-2.5 text-center text-xs font-semibold text-[#225945] sm:py-3 sm:text-sm">
              <strong className="mr-1 text-emerald-800">{number}</strong>{label}
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[#d3e4ee] bg-[#edf5fa]">
        <div className="flex items-center justify-between gap-3 border-b border-[#d5e3ed] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-[#2b5871]"><Bot size={17} aria-hidden="true" /><h3 className="text-base font-bold">Food Copilot results</h3></div>
          <span className="text-xs font-semibold text-[#537186]">All recorded runs</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#d5e3ed] sm:grid-cols-4">
          {[
            ['Total runs', summary.total],
            ['Worked normally', summary.succeeded],
            ['Used backup', summary.fallback],
            ['Needs attention', summary.failed],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 bg-white px-3 py-3.5 sm:px-5 sm:py-4">
              <p className="text-2xl font-extrabold leading-none text-[#173f50] sm:text-3xl">{data ? (value ?? 0) : '—'}</p>
              <p className="mt-1.5 text-xs font-semibold leading-4 text-[#526b79] sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[18px] border border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-3.5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-stone-950 sm:text-xl">Recent AI activity</h3>
              <p className="mt-1 text-sm text-stone-600">Choose a result to check what happened.</p>
            </div>
            {!error && data && <p className="text-sm font-bold text-emerald-800">{totalInFilter} {totalInFilter === 1 ? 'run' : 'runs'}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter AI run results">
            {FILTERS.map((filter) => (
              <button type="button" key={filter.label} aria-pressed={status === filter.value} onClick={() => { if (status !== filter.value) { setStatus(filter.value); setPage(1) } }} className={`focus-ring rounded-lg border px-3 py-2 text-xs font-semibold sm:text-sm ${status === filter.value ? 'border-[#195640] bg-[#195640] text-white' : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'}`}>
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm font-semibold text-stone-600" role="status"><RefreshCw size={16} className="animate-spin" aria-hidden="true" /> Loading AI activity…</div>
        ) : error ? (
          <div className="flex flex-col gap-3 bg-rose-50 px-4 py-5 sm:px-6" role="alert">
            <div className="flex items-start gap-2"><AlertCircle size={18} className="shrink-0 text-rose-700" aria-hidden="true" /><p className="min-w-0 break-words text-sm font-semibold text-rose-800">Could not load AI activity: {error}</p></div>
            <button type="button" onClick={load} className="focus-ring w-fit rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-800">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center sm:px-6">
            <CheckCircle2 size={24} className="mx-auto text-[#4b876d]" aria-hidden="true" />
            <p className="mt-2 text-base font-bold text-stone-900">{status ? 'No runs match this filter' : 'No Food Copilot runs recorded yet'}</p>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-5 text-stone-600">
              {status ? 'Try All runs to see the other results.' : 'A record appears here after Food Copilot is used and its activity is saved. Product scans and recipe reviews are tracked in their own workflows.'}
            </p>
          </div>
        ) : (
          <div>{items.map((item) => <RunHistoryItem key={item.id} item={item} />)}</div>
        )}

        {!loading && !error && pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-3.5 py-3 sm:px-6">
            <span className="text-sm font-semibold text-stone-600">Page {page} of {pages} · {totalInFilter} runs</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))} className="focus-ring inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><ArrowLeft size={14} aria-hidden="true" /> Previous</button>
              <button type="button" disabled={page >= pages} onClick={() => setPage((previous) => Math.min(pages, previous + 1))} className="focus-ring inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40">Next <ArrowRight size={14} aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-start gap-2.5 border-l-4 border-[#96c6b6] bg-[#f0f7f4] px-3.5 py-3.5 text-sm leading-5 text-[#305b4c] sm:px-5">
        <ShieldCheck className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>This report tracks Food Copilot runs, not every AI process. AI suggestions do not approve products, recipes or food-safety decisions.</p>
      </div>
    </section>
  )
}
