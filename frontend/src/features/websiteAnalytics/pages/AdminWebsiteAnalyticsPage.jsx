import { useEffect, useMemo, useState } from 'react'
import {
  Activity, BarChart3, CalendarDays,
  CheckCircle2, Download, Eye, Globe2, MousePointerClick,
  RefreshCw, ShieldCheck, ShoppingBag, Smartphone, Users,
} from 'lucide-react'
import AdminShell from '../../admin/components/AdminShell'
import {
  getWebsiteAnalyticsReport,
  websiteAnalyticsErrorMessage,
} from '../services/websiteAnalytics.admin.service'

const comma = new Intl.NumberFormat('en-IN')
const compact = (value) => comma.format(Number(value) || 0)
const forest = '#173F35'
const clay = '#C86C42'
function formatPaidAmount(currency, minor) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100) }
  catch { return `${compact(minor)} minor units (${currency || 'unknown currency'})` }
}

function SectionHeading({ number, title, subtitle, right, tone = 'green' }) {
  const line = tone === 'clay' ? 'border-[#C86C42]' : tone === 'blue' ? 'border-[#4F8291]' : 'border-[#173F35]'
  return (
    <div className={`flex flex-wrap items-end justify-between gap-3 border-t-2 ${line} pt-3 sm:pt-4`}>
      <div className="min-w-0">
        <p className="text-[13px] font-bold uppercase tracking-[0.03em] text-[#C86C42]">{number}</p>
        <h2 className="mt-1 text-[22px] font-bold leading-tight text-[#173F35] sm:text-[27px]">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-[780px] text-[14px] leading-6 text-[#4B5B53] sm:text-[15px]">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  )
}

function Metric({ label, value, icon: Icon, note, highlight = false }) {
  return (
    <div className={`min-w-0 border-b border-[#D6DED7] px-3 py-3 last:border-b-0 sm:px-4 sm:py-4 lg:border-b-0 lg:border-r lg:last:border-r-0 ${highlight ? 'bg-[#DCE0CF]' : 'bg-[#F7F6F2]'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-[#365549] sm:text-[15px]">{label}</span>
        <Icon size={19} aria-hidden="true" className="shrink-0 text-[#416E5B]" />
      </div>
      <div className="mt-2 text-[28px] font-bold leading-tight tabular-nums text-[#173F35] sm:text-[34px]">{value}</div>
      {note && <p className="mt-1 text-[13px] leading-5 text-[#56665B]">{note}</p>}
    </div>
  )
}

function TrendChart({ rows }) {
  const values = rows.map((row) => row.pageViews)
  const max = Math.max(1, ...values)
  const plotWidth = 694
  const plotHeight = 176
  const xOf = (index) => 35 + (values.length === 1 ? plotWidth / 2 : index * plotWidth / (values.length - 1))
  const yOf = (value) => 194 - value / max * plotHeight
  const points = values.map((value, index) => `${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`).join(' ')
  const label = `Consented page views by day, from ${rows[0]?.day || ''} to ${rows.at(-1)?.day || ''}`
  const visible = values.some((value) => value > 0)
  return (
    <figure className="min-w-0" aria-label="Page-view activity trend">
      {visible ? (
        <>
          <svg className="block h-auto w-full" viewBox="0 0 760 235" role="img" aria-label={label}>
            {[0, 0.5, 1].map((step) => (
              <g key={step}>
                <line x1="35" x2="729" y1={yOf(max * step)} y2={yOf(max * step)} stroke="#D2DDD5" strokeDasharray={step === 0 ? 'none' : '4 5'} />
                <text x="27" y={yOf(max * step) + 4} textAnchor="end" fontSize="11" fill="#63736A">{compact(Math.round(max * step))}</text>
              </g>
            ))}
            <polyline points={points} fill="none" stroke={forest} strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {values.length <= 14 && values.map((value, index) => (
              <circle key={rows[index].day} cx={xOf(index)} cy={yOf(value)} r="4" fill={clay} stroke="#FFF" strokeWidth="2" />
            ))}
            <text x="35" y="225" fontSize="11" fill="#63736A">{rows[0]?.day}</text>
            <text x="729" y="225" textAnchor="end" fontSize="11" fill="#63736A">{rows.at(-1)?.day}</text>
          </svg>
          <figcaption className="text-[12px] leading-5 text-[#617067]">Consented page views · UTC</figcaption>
        </>
      ) : (
        <p className="py-7 text-center text-[15px] text-[#53675B]">No page-view data yet</p>
      )}
    </figure>
  )
}

function MiniBars({ rows, labelKey, countKey, emptyMessage }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[countKey]) || 0))
  return rows.length ? (
    <div className="divide-y divide-[#DFE5DF]">
      {rows.map((row, index) => (
        <div key={`${row[labelKey]}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
          <span className="min-w-0 break-words text-[14px] font-semibold text-[#254C3B] sm:text-[15px]">{row[labelKey]}</span>
          <span className="text-[15px] font-bold tabular-nums text-[#173F35]">{compact(row[countKey])}</span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[#E3E9E1]">
            <div className="h-full rounded-full bg-[#2A8B62]" style={{ width: `${Math.max(0, Math.min(100, (Number(row[countKey]) || 0) / max * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  ) : <p className="py-4 text-[14px] text-[#617067]">{emptyMessage}</p>
}

function DataTable({ headings, rows, empty }) {
  return rows.length ? (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px] sm:text-[15px]">
        <thead><tr className="bg-[#E6EBDD]">{headings.map((heading) => <th key={heading} className="px-3 py-2.5 font-bold text-[#173F35]">{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-[#DFE5DF] last:border-b-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`break-words px-3 py-2.5 ${cellIndex ? 'text-[#435B4E]' : 'font-semibold text-[#244E3C]'}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  ) : <p className="py-4 text-[14px] text-[#617067]">{empty}</p>
}

function csvCell(value) {
  const string = String(value ?? '')
  const escaped = /^[=+\-@\t\r]/.test(string) ? `'${string}` : string
  return `"${escaped.replaceAll('"', '""')}"`
}

function exportAggregateCsv(report) {
  if (typeof window === 'undefined') return
  const rows = [
    ['EPANTRY Website Analytics', 'Aggregate report'],
    ['Period UTC', `${report.window.from} to ${report.window.to}`],
    ['Metric', 'Count'],
    ...Object.entries(report.overview).map(([key, value]) => [key, value]),
    ['paid_orders_verified', report.commerce.paidOrders],
    [], ['Daily activity (UTC)', 'Page views', 'Sessions', 'Recipe views', 'Product views'],
    ...report.daily.map((row) => [row.day, row.pageViews, row.sessions, row.recipeViews, row.productViews]),
    [], ['Source', 'Medium', 'Consented sessions'],
    ...report.acquisition.map((row) => [row.source, row.medium, row.sessions]),
    [], ['Top page template', 'Page views'],
    ...report.topPages.map((row) => [row.page, row.views]),
    [], ['Content type', 'Public content ID', 'Views'],
    ...report.topContent.map((row) => [row.type, row.id, row.views]),
  ]
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `epantry-website-analytics-${report.window.from}-${report.window.to}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export default function AdminWebsiteAnalyticsPage({ embedded = false, activeView = "overview", reportDays = 30, refreshToken = 0 }) {
  const [period, setPeriod] = useState(String(reportDays))
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState({ days: reportDays, serial: 0 })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    if (!embedded) return
    setPeriod(String(reportDays))
    setApplied((current) => ({ days: reportDays, serial: current.serial + 1 }))
  }, [embedded, reportDays])
  useEffect(() => {
    if (embedded && refreshToken > 0) setApplied((current) => ({ ...current, serial: current.serial + 1 }))
  }, [refreshToken, embedded])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setReport(null)
    getWebsiteAnalyticsReport({ ...applied, signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setReport(result)
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(websiteAnalyticsErrorMessage(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [applied])

  const applyRange = () => {
    if (period === 'custom') {
      if (!from || !to || from > to) {
        setFilterError('Choose a valid start and end date.')
        return
      }
      setFilterError('')
      setApplied((old) => ({ from, to, serial: old.serial + 1 }))
    } else {
      setFilterError('')
      setApplied((old) => ({ days: Number(period), serial: old.serial + 1 }))
    }
  }

  const dailyTableRows = useMemo(() => (report?.daily || []).map((day) => [day.day, compact(day.pageViews), compact(day.sessions), compact(day.recipeViews), compact(day.productViews)]), [report])
  const comparison = report?.previous
  const overview = report?.overview
  const hasData = Boolean(report?.coverage?.hasTrackedData)
  const consentDecisions = Number(report?.consent?.currentSavedChoices || 0)
  const recordedEvents = Number(report?.overview?.recordedEvents || 0)
  const toPercent = (value, baseline) => baseline > 0 ? `${Math.round((value - baseline) / baseline * 100)}%` : 'Not comparable'
  const compareLabel = comparison ? `${toPercent(overview.pageViews, comparison.pageViews)} vs previous period` : 'Previous period unavailable within 90-day retention'
  const paidCurrencies = report?.commerce?.byCurrency || []

  const isOverview = activeView === 'overview'
  const content = (
    <div className="wi-embedded flex w-full min-w-0 flex-col gap-5 pb-5 text-[#202421]">
      <style>{`
        .wi-embedded {--wi-green:#173F35;--wi-sage:#DCE0CF}
        .wi-embedded button:focus-visible,.wi-embedded summary:focus-visible {outline:2px solid #173F35;outline-offset:3px}
        .wi-embedded .wi-panel {border:1px solid #D8E1D7;background:#FFFEFB}
        .wi-embedded .wi-panel h3 {color:#173F35!important}
      `}</style>
      {isOverview ? (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#DCE3DA] pb-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#C86C42]">01 / WEBSITE OVERVIEW</p>
            <h2 className="mt-1 text-[25px] font-bold leading-tight text-[#173F35] sm:text-[30px]">Website performance</h2>
            <p className="mt-1 text-[14px] text-[#56675C]">Only visits with analytics permission are counted.</p>
          </div>
          <button type="button" onClick={() => report && exportAggregateCsv(report)} disabled={!report || loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#BACCBF] bg-[#FFFDF9] px-4 text-[14px] font-semibold text-[#173F35] disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#DCE3DA] pb-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#C86C42]">03 / SHOPPING</p>
            <h2 className="mt-1 text-[25px] font-bold leading-tight text-[#173F35] sm:text-[30px]">Shopping & content insights</h2>
            <p className="mt-1 text-[14px] text-[#56675C]">Product activity and confirmed orders.</p>
          </div>
          <button type="button" onClick={() => report && exportAggregateCsv(report)} disabled={!report || loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#BACCBF] bg-[#FFFDF9] px-4 text-[14px] font-semibold text-[#173F35] disabled:opacity-50">
            <Download size={16} /> Export CSV
          </button>
        </div>
      )}

      {isOverview && (
        <details className="border-l-[3px] border-[#C86C42] bg-[#E9EDE5] px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-[#173F35]">Custom website date range · UTC</summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="min-w-[150px] flex-1 text-[13px] font-semibold text-[#365549]">From
              <input type="date" value={from} onChange={(e) => {setFrom(e.target.value);setPeriod('custom')}} className="mt-1 block min-h-11 w-full border border-[#BDCBBF] bg-white px-3 text-[15px] text-[#173F35]" />
            </label>
            <label className="min-w-[150px] flex-1 text-[13px] font-semibold text-[#365549]">To
              <input type="date" value={to} onChange={(e) => {setTo(e.target.value);setPeriod('custom')}} className="mt-1 block min-h-11 w-full border border-[#BDCBBF] bg-white px-3 text-[15px] text-[#173F35]" />
            </label>
            <button type="button" onClick={applyRange} className="min-h-11 rounded-md bg-[#173F35] px-5 text-[14px] font-semibold text-white">Apply</button>
            <button type="button" onClick={() => {setPeriod(String(reportDays));setApplied((old) => ({days:reportDays,serial:old.serial+1}))}} className="min-h-11 rounded-md border border-[#A8BFB0] px-4 text-[14px] font-semibold text-[#173F35]">Use shared period</button>
          </div>
          {filterError && <p role="alert" className="mt-2 text-[14px] text-[#9B3E31]">{filterError}</p>}
          {applied.from && <p className="mt-2 text-[13px] text-[#5F6A63]">Custom dates apply to website analytics only; Customer Demand uses the shared period.</p>}
        </details>
      )}
      {report && !loading && (
        <p className="text-[13px] font-medium text-[#50685A]">{report.window?.from} to {report.window?.to} · UTC{applied.from ? ' · Custom range' : ''}</p>
      )}
      {loading && <p role="status" className="py-12 text-center text-[15px] text-[#54665B]">Loading website analytics...</p>}
      {!loading && error && (
        <div role="alert" className="border-l-[3px] border-[#C86C42] bg-[#FFF0E7] p-5">
          <p className="font-semibold text-[#173F35]">Website report unavailable</p>
          <p className="mt-1 text-[14px]">{error}</p>
          <button type="button" onClick={() => setApplied((old) => ({ ...old, serial: old.serial + 1 }))} className="mt-3 min-h-11 border border-[#9BAD9F] px-4 font-semibold text-[#173F35]">Try again</button>
        </div>
      )}
      {report && !loading && (isOverview ? (
        <>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#D5DED5] sm:grid-cols-4">
            <Metric label="Visitors" value={compact(report.overview.visitors)} icon={Users} highlight note="Consented browsers" />
            <Metric label="Sessions" value={compact(report.overview.sessions)} icon={Activity} />
            <Metric label="Page views" value={compact(report.overview.pageViews)} icon={Eye} />
            <Metric label="Recipe views" value={compact(report.overview.recipeViews)} icon={BarChart3} />
          </div>
          {!hasData && (
            <section className="border border-[#D6DFD5] bg-[#E9EEE7] px-5 py-5 sm:px-6 sm:py-6" aria-label="Tracking status">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h3 className="flex items-center gap-2 text-[20px] font-bold text-[#173F35]"><ShieldCheck size={22} aria-hidden="true" /> No consented visits yet</h3>
                  <p className="mt-2 text-[15px] leading-6 text-[#465F50]">{consentDecisions === 0
                    ? 'No cookie decisions have been saved yet. Analytics begins only after someone allows it.'
                    : 'Cookie choices exist, but no website events were recorded in this period.'}</p>
                </div>
                <div className="flex gap-6 border-l border-[#CAD8CB] pl-4 text-[13px] text-[#526658]">
                  <span>Recorded events<strong className="block text-[26px] font-bold text-[#173F35]">{compact(recordedEvents)}</strong></span>
                  <span>Saved choices<strong className="block text-[26px] font-bold text-[#173F35]">{compact(consentDecisions)}</strong></span>
                </div>
              </div>
              <details className="mt-4 border-t border-[#CCD9CE] pt-3 text-[14px] text-[#4A6254]">
                <summary className="cursor-pointer font-bold text-[#173F35]">Check tracking</summary>
                <p className="mt-2 leading-6">In a Customer or guest browser, allow Analytics under Cookie settings, visit a public Grocery or Recipe page, then refresh this report. Host/Admin workspace visits and searches are not part of public website tracking.</p>
              </details>
            </section>
          )}
          {hasData && <div className="wi-panel rounded-lg p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-[19px] font-bold">Traffic over time</h3><span className="text-[12px] text-[#6E786F]">UTC</span></div>
            <TrendChart rows={report.daily} />
            {report.previous && <p className="mt-1 text-[13px] text-[#657469]">Previous period: {compact(report.previous.pageViews)} page views</p>}
          </div>}
          {hasData && <div className="grid gap-4 lg:grid-cols-2">
            <div className="wi-panel rounded-lg p-5">
              <h3 className="mb-2 flex items-center gap-2 text-[18px] font-bold"><Globe2 size={18}/> Traffic sources</h3>
              <MiniBars rows={report.acquisition.map((row) => ({ label:`${row.source} / ${row.medium}`,sessions:row.sessions }))} labelKey="label" countKey="sessions" emptyMessage="No source data yet"/>
              {report.campaigns?.length > 0 && <details className="mt-4 border-t border-[#D7E1D8] pt-3"><summary className="cursor-pointer text-[14px] font-semibold text-[#173F35]">Campaigns ({report.campaigns.length})</summary>
                <DataTable headings={['Campaign','Sessions']} rows={report.campaigns.map((row) => [row.name,compact(row.sessions)])} empty="No campaign activity" />
              </details>}
            </div>
            <div className="wi-panel rounded-lg p-5"><h3 className="mb-2 flex items-center gap-2 text-[18px] font-bold"><Smartphone size={18}/> Devices</h3>
              <MiniBars rows={report.devices} labelKey="device" countKey="sessions" emptyMessage="No device data yet"/>
            </div>
          </div>}
          <div className="border-t border-[#D6E0D6] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#E8EEE3] p-4 sm:p-5">
              <div className="flex items-center gap-3"><ShieldCheck size={22} color="#173F35"/><div><p className="text-[14px] font-semibold text-[#365549]">Saved cookie choices</p>
                <p className="text-[21px] font-bold text-[#173F35]">{report.consent.enabledShare == null ? 'No saved choices' : `${report.consent.enabledShare}% allowed`}</p></div></div>
              <div className="flex gap-6"><div className="text-[13px] text-[#526558]">Allowed<strong className="block text-[21px] text-[#173F35]">{compact(report.consent.analyticsEnabled)}</strong></div>
                <div className="text-[13px] text-[#526558]">Not allowed<strong className="block text-[21px] text-[#173F35]">{compact(report.consent.analyticsRejected)}</strong></div></div>
            </div>
            <details className="mt-2 border-b border-[#DAE2DA] py-3"><summary className="cursor-pointer text-[14px] font-semibold text-[#173F35]">Definitions & data coverage</summary>
              <div className="space-y-2 pt-3 text-[14px] leading-6 text-[#506052]"><p>{report.coverage.note}</p><p>{report.consent.note}</p><p>{report.commerce.note}</p><p>Report dates are UTC. Raw website events are retained up to 90 days.</p></div>
            </details>
            <details className="border-b border-[#DAE2DA] py-3"><summary className="cursor-pointer text-[14px] font-semibold text-[#173F35]">Daily activity table</summary>
              <div className="mt-3"><DataTable headings={['UTC day','Page views','Sessions','Recipe views','Product views']} rows={dailyTableRows} empty="No daily activity"/></div>
            </details>
          </div>
          <p className="text-right text-[12px] text-[#66776C]">Updated {new Date(report.generatedAt).toLocaleString('en-IN')}</p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#D5DED5] sm:grid-cols-4">
            <Metric label="Product views" value={compact(report.overview.productViews)} icon={ShoppingBag} highlight />
            <Metric label="Consented searches" value={compact(report.overview.searches)} icon={MousePointerClick} />
            <Metric label="Saved items" value={compact(report.overview.bookmarks)} icon={ShieldCheck} />
            <Metric label="Cart actions" value={compact(report.overview.cartActions)} icon={ShoppingBag} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
            <div className="wi-panel rounded-lg p-5">
              <h3 className="mb-3 text-[19px] font-bold">Path to checkout</h3>
              <div className="divide-y divide-[#D9E2D9]">
                {report.funnel.map((step, index) => (
                  <div key={step.event} className="flex min-w-0 items-center justify-between gap-4 py-4">
                    <div><p className="text-[12px] font-bold text-[#C86C42]">STEP {String(index+1).padStart(2,'0')}</p>
                      <p className="mt-1 text-[16px] font-semibold text-[#173F35]">{({product_view:'Product viewed',add_to_cart:'Added to cart',begin_checkout:'Checkout started'})[step.event] || step.event}</p></div>
                    <strong className="text-[27px] font-bold text-[#173F35]">{compact(step.sessions)}</strong>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-[#647469]">Consented sessions per action, not individually linked conversions.</p>
            </div>
            <div className="flex flex-col justify-between rounded-lg border-l-[4px] border-[#C86C42] bg-[#173F35] p-5 text-white sm:p-6">
              <div><p className="text-[15px] font-semibold text-[#DBE6DA]">Verified paid orders</p>
                <p className="mt-3 text-[42px] font-bold text-white">{compact(report.commerce.paidOrders)}</p></div>
              <div className="mt-5 space-y-2 border-t border-white/20 pt-4">
                {(report.commerce.byCurrency || []).length ? report.commerce.byCurrency.map((entry) => (
                  <div key={entry.currency}><p className="text-[22px] font-semibold text-white">{formatPaidAmount(entry.currency,entry.amountMinor)}</p>
                    <p className="text-[12px] text-[#C9DACC]">Gross paid · {entry.currency}</p></div>
                )) : <p className="text-[14px] text-[#D5E5D7]">No paid orders in this period</p>}
                <p className="text-[12px] text-[#C5D7C8]">Source: verified payment records, not tracking events.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="wi-panel rounded-lg p-5"><h3 className="mb-2 text-[18px] font-bold">Popular pages</h3>
              <DataTable headings={['Page','Views']} rows={report.topPages.map((row) => [row.page,compact(row.views)])} empty="No page views yet" />
            </div>
            <div className="wi-panel rounded-lg p-5"><h3 className="mb-2 text-[18px] font-bold">Products & recipes</h3>
              <DataTable headings={['Content','Views']} rows={report.topContent.map((row) => [`${row.type||'content'} / ${row.id||'unknown'}`, compact(row.views)])} empty="No content views yet" />
            </div>
          </div>

        </>
      ))}
    </div>
  )
  if (embedded) return content
  return <AdminShell title="Website analytics" description="" showWorkspaceBadge={false}>{content}</AdminShell>
}
