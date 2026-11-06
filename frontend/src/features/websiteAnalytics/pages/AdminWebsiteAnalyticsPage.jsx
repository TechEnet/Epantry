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

export default function AdminWebsiteAnalyticsPage() {
  const [period, setPeriod] = useState('7')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [applied, setApplied] = useState({ days: 7, serial: 0 })
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')

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
  const toPercent = (value, baseline) => baseline > 0 ? `${Math.round((value - baseline) / baseline * 100)}%` : 'Not comparable'
  const compareLabel = comparison ? `${toPercent(overview.pageViews, comparison.pageViews)} vs previous period` : 'Previous period unavailable within 90-day retention'
  const paidCurrencies = report?.commerce?.byCurrency || []

  return (
    <AdminShell
      title="Website analytics"
      description="Traffic, content and confirmed sales in one place."
      actions={
        <button type="button" onClick={() => setApplied((old) => ({ ...old, serial: old.serial + 1 }))}
          className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#A9BDB0] bg-[#F7F6F2] px-4 text-[14px] font-semibold text-[#173F35] transition-colors hover:bg-[#E6F4ED]">
          <RefreshCw size={17} aria-hidden="true" /> Refresh
        </button>
      }
    >
      <div className="flex w-full min-w-0 flex-col gap-6 pb-8 text-[#202421] sm:gap-8">
        {/* Filter controls stay visible; the compact ribbon replaces the tall filter panel. */}
        <section aria-label="Report filters" className="border-t-[3px] border-[#C86C42] bg-[#E6EBDD] px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
            <div className="min-w-[155px] flex-1 sm:max-w-[275px]">
              <label htmlFor="website-period" className="mb-1 block text-[13px] font-semibold text-[#254638]">Date range</label>
              <select id="website-period" value={period} onChange={(event) => { setPeriod(event.target.value); setFilterError('') }}
                className="focus-ring min-h-11 w-full border border-[#B9C7B6] bg-[#FFFDF9] px-3 text-[15px] text-[#173F35]">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="custom">Custom dates (UTC)</option>
              </select>
            </div>
            {period === 'custom' && <>
              <div className="min-w-[145px] flex-1 sm:max-w-[220px]">
                <label htmlFor="website-from" className="mb-1 block text-[13px] font-semibold text-[#254638]">From</label>
                <input id="website-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="focus-ring min-h-11 w-full border border-[#B9C7B6] bg-[#FFFDF9] px-3 text-[15px] text-[#173F35]" />
              </div>
              <div className="min-w-[145px] flex-1 sm:max-w-[220px]">
                <label htmlFor="website-to" className="mb-1 block text-[13px] font-semibold text-[#254638]">To</label>
                <input id="website-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="focus-ring min-h-11 w-full border border-[#B9C7B6] bg-[#FFFDF9] px-3 text-[15px] text-[#173F35]" />
              </div>
            </>}
            <button type="button" onClick={applyRange} className="focus-ring min-h-11 border border-[#173F35] bg-[#173F35] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#265A46]">Apply</button>
            <button type="button" onClick={() => report && exportAggregateCsv(report)} disabled={!report || loading}
              className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#A9BDB0] bg-[#F7F6F2] px-4 text-[14px] font-semibold text-[#173F35] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} aria-hidden="true" /> Export CSV
            </button>
            <span className="hidden text-[12px] text-[#4E6457] xl:ml-auto xl:block" title="All reporting dates are UTC. Raw analytics events are retained for up to 90 days.">UTC · 90-day event history</span>
          </div>
          {filterError && <p role="alert" className="mt-2 text-[14px] font-semibold text-[#9C2E2E]">{filterError}</p>}
        </section>

        {loading && <div role="status" className="flex min-h-[160px] items-center justify-center gap-3 bg-[#EFF3ED] p-5 text-[15px] text-[#365549]"><RefreshCw size={20} className="animate-spin" aria-hidden="true" /> Loading analytics...</div>}
        {!loading && error && <section role="alert" className="border-l-4 border-[#C86C42] bg-[#FFF0E4] px-5 py-5">
          <h2 className="text-[21px] font-bold text-[#173F35]">Couldn't load analytics</h2>
          <p className="mt-2 text-[15px] leading-6 text-[#544E48]">{error}</p>
          <button type="button" onClick={() => setApplied((old) => ({ ...old, serial: old.serial + 1 }))} className="focus-ring mt-3 min-h-11 border border-[#173F35] px-5 font-semibold text-[#173F35]">Try again</button>
        </section>}

        {!loading && report && <>
          <section aria-label="Analytics overview" className="min-w-0">
            <SectionHeading number="01 / PERFORMANCE" title="At a glance" right={<span className="text-[13px] font-medium text-[#587063]">{report.window.from} — {report.window.to} · UTC</span>} />
            <div className="mt-4 grid grid-cols-2 border border-[#D6DED7] sm:grid-cols-3 xl:grid-cols-5">
              <Metric label="Visitors" value={compact(overview.visitors)} icon={Users} highlight />
              <Metric label="Sessions" value={compact(overview.sessions)} icon={Activity} />
              <Metric label="Page views" value={compact(overview.pageViews)} icon={Eye} note={comparison && comparison.pageViews > 0 ? compareLabel : undefined} />
              <Metric label="Product views" value={compact(overview.productViews)} icon={ShoppingBag} />
              <Metric label="Recipe views" value={compact(overview.recipeViews)} icon={BarChart3} />
            </div>
            {!hasData && <p className="mt-2 flex items-center gap-2 text-[13px] leading-5 text-[#5A6B60]"><ShieldCheck size={16} className="shrink-0 text-[#406552]" aria-hidden="true" /> No consented activity recorded yet.</p>}

            <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(265px,0.8fr)]">
              <div className="min-w-0 border border-[#DDE4D9] bg-[#EEF2EB] px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[18px] font-semibold text-[#173F35]">Page views over time</h3>
                  <BarChart3 size={19} className="text-[#527464]" aria-hidden="true" />
                </div>
                <div className="mt-2"><TrendChart rows={report.daily} /></div>
              </div>
              <div className="relative flex min-w-0 flex-col justify-between overflow-hidden border-t-[3px] border-[#C86C42] bg-[#173F35] px-5 py-5 text-[#F7F6F2] sm:px-6">
                <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/10" />
                <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 h-28 w-28 rounded-full border border-white/10" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-2 text-[14px] font-medium text-[#DBE8DC]"><span>Verified paid orders</span><CheckCircle2 size={19} aria-hidden="true" /></div>
                  <p className="mt-3 text-[44px] font-semibold leading-none tabular-nums text-white">{compact(report.commerce.paidOrders)}</p>
                </div>
                <div className="relative mt-5 border-t border-white/20 pt-3">
                  {paidCurrencies.length ? paidCurrencies.map((currency) => (
                    <p key={currency.currency} className="mt-2 first:mt-0">
                      <strong className="block text-[22px] font-semibold tabular-nums text-white">{formatPaidAmount(currency.currency, currency.amountMinor)}</strong>
                      <span className="mt-0.5 block text-[12px] text-[#CBDCD0]">Gross paid · {currency.currency}</span>
                    </p>
                  )) : <p className="text-[14px] text-[#D5E9DE]">No paid orders in this period</p>}
                  <span className="mt-3 block text-[12px] text-[#BFD7C8]">From verified payments</span>
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Audience and traffic">
            <SectionHeading number="02 / AUDIENCE" title="Where people came from" />
            <div className="mt-3 grid min-w-0 border border-[#DCE4DD] bg-[#F7F6F2] lg:grid-cols-2 lg:divide-x lg:divide-[#DCE4DD]">
              <div className="min-w-0 px-4 py-4 sm:px-5">
                <h3 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-[#173F35]"><Globe2 size={18} aria-hidden="true" /> Traffic sources</h3>
                <MiniBars rows={report.acquisition.map((row) => ({ label: `${row.source} / ${row.medium}`, sessions: row.sessions }))} labelKey="label" countKey="sessions" emptyMessage="No source data yet" />
              </div>
              <div className="min-w-0 border-t border-[#DCE4DD] px-4 py-4 sm:px-5 lg:border-t-0">
                <h3 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-[#173F35]"><Smartphone size={18} aria-hidden="true" /> Devices</h3>
                <MiniBars rows={report.devices} labelKey="device" countKey="sessions" emptyMessage="No device data yet" />
              </div>
            </div>
            {report.campaigns.length > 0 && <details className="mt-2 border-b border-[#D5DFD6] px-1 py-2">
              <summary className="focus-ring cursor-pointer py-1 text-[14px] font-semibold text-[#173F35]">Campaign details ({report.campaigns.length})</summary>
              <div className="mt-2"><DataTable headings={['Campaign', 'Sessions']} rows={report.campaigns.map((row) => [row.name, compact(row.sessions)])} empty="No campaign entries" /></div>
            </details>}
          </section>

          <section aria-label="Content discovery">
            <SectionHeading number="03 / DISCOVERY" title="What people explored" />
            <div className="mt-3 grid min-w-0 border-y border-[#D9E0D9] lg:grid-cols-2 lg:divide-x lg:divide-[#D9E0D9]">
              <div className="min-w-0 px-3 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[16px] font-semibold text-[#173F35]">Popular pages</h3><Eye size={18} className="text-[#5B7866]" aria-hidden="true" /></div>
                <DataTable headings={['Page', 'Views']} rows={report.topPages.map((row) => [row.page, compact(row.views)])} empty="No page views yet" />
              </div>
              <div className="min-w-0 border-t border-[#D9E0D9] px-3 py-4 sm:px-5 lg:border-t-0">
                <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-[16px] font-semibold text-[#173F35]">Products & recipes</h3><ShoppingBag size={18} className="text-[#5B7866]" aria-hidden="true" /></div>
                <DataTable headings={['Content', 'Views']} rows={report.topContent.map((row) => [`${row.type || 'content'} / ${row.id || 'unknown'}`, compact(row.views)])} empty="No content views yet" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 border border-[#D6DED7] sm:grid-cols-3">
              <Metric label="Searches" value={compact(overview.searches)} icon={MousePointerClick} />
              <Metric label="Saved items" value={compact(overview.bookmarks)} icon={ShieldCheck} />
              <Metric label="Cart additions" value={compact(overview.cartActions)} icon={ShoppingBag} />
            </div>
          </section>

          <section aria-label="Shopping activity">
            <SectionHeading number="04 / SHOPPING" title="From product to checkout" />
            <div className="mt-3 grid min-w-0 grid-cols-1 border-l-[3px] border-[#C86C42] bg-[#E6EBDD] px-4 py-2 sm:grid-cols-3 sm:py-4">
              {report.funnel.map((step, index) => (
                <div key={step.event} className="flex min-w-0 items-center justify-between gap-4 border-b border-[#C7D2C5] py-3 last:border-0 sm:border-b-0 sm:border-r sm:px-4 sm:last:border-r-0">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[#AD5D3C]">{String(index + 1).padStart(2, '0')}</p>
                    <h3 className="mt-0.5 text-[15px] font-semibold leading-5 text-[#173F35]">{({ product_view: 'Product viewed', add_to_cart: 'Added to cart', begin_checkout: 'Checkout started' })[step.event] || step.event}</h3>
                  </div>
                  <strong className="text-[29px] font-semibold tabular-nums text-[#173F35]">{compact(step.sessions)}</strong>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-5 text-[#64746A]">Consented sessions at each step · not a linked customer funnel</p>
          </section>

          <section aria-label="Privacy and report details">
            <SectionHeading number="05 / DATA QUALITY" title="Consent & report details" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-l-[3px] border-[#173F35] bg-[#DCE0CF] px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} className="shrink-0 text-[#173F35]" aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-medium text-[#486252]">Analytics consent</p>
                  <p className="text-[24px] font-semibold leading-tight text-[#173F35]">{report.consent.enabledShare == null ? 'No saved choices' : `${report.consent.enabledShare}% allowed`}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-[14px] text-[#365549]">
                <span>Allowed <strong className="block text-[23px] leading-tight tabular-nums text-[#173F35]">{compact(report.consent.analyticsEnabled)}</strong></span>
                <span>Not allowed <strong className="block text-[23px] leading-tight tabular-nums text-[#173F35]">{compact(report.consent.analyticsRejected)}</strong></span>
              </div>
            </div>
            <div className="mt-3 divide-y divide-[#DEE4DC] border-y border-[#DEE4DC]">
              <details className="px-2 py-2.5 sm:px-3">
                <summary className="focus-ring cursor-pointer py-1 text-[14px] font-semibold text-[#173F35]">How these numbers work</summary>
                <div className="max-w-[1020px] space-y-2 pb-2 pt-3 text-[14px] leading-6 text-[#4B5B53]">
                  <p>{report.coverage.note}</p>
                  <p>{report.consent.note}</p>
                  <p>{report.commerce.note}</p>
                  <p>All report dates are in UTC. Raw analytics events are retained for up to 90 days.</p>
                </div>
              </details>
              <details className="px-2 py-2.5 sm:px-3">
                <summary className="focus-ring cursor-pointer py-1 text-[14px] font-semibold text-[#173F35]">Daily data table</summary>
                <div className="mt-3"><DataTable headings={['UTC day', 'Page views', 'Sessions', 'Recipe views', 'Product views']} rows={dailyTableRows} empty="No daily activity" /></div>
              </details>
            </div>
            <p className="mt-2 text-right text-[12px] text-[#64746A]">Updated {new Date(report.generatedAt).toLocaleString('en-IN')}</p>
          </section>
        </>}
      </div>
    </AdminShell>
  )
}
