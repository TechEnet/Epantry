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
    <div className={`flex flex-wrap items-end justify-between gap-3 border-t-[3px] ${line} pt-4 sm:pt-5`}>
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
    <div className={`min-w-0 border-b border-[#D6DED7] px-3 py-4 last:border-b-0 sm:px-5 sm:py-5 lg:border-b-0 lg:border-r lg:last:border-r-0 ${highlight ? 'bg-[#DCE0CF]' : 'bg-[#F7F6F2]'}`}>
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
          <figcaption className="text-[12px] leading-5 text-[#617067]">Counts include only successfully recorded, consented page-view events. Daily values are in UTC.</figcaption>
        </>
      ) : (
        <p className="py-10 text-center text-[15px] text-[#53675B]">No consented page views for this period.</p>
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
  ) : <p className="py-7 text-[14px] text-[#617067]">{emptyMessage}</p>
}

function DataTable({ headings, rows, empty }) {
  return rows.length ? (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px] sm:text-[15px]">
        <thead><tr className="bg-[#E6EBDD]">{headings.map((heading) => <th key={heading} className="px-3 py-3 font-bold text-[#173F35]">{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index} className="border-b border-[#DFE5DF] last:border-b-0">{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-3 py-3 ${cellIndex ? 'text-[#435B4E]' : 'font-semibold text-[#244E3C]'}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  ) : <p className="py-7 text-[14px] text-[#617067]">{empty}</p>
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
      description="Measure consented visits, discovery and shopping activity. Verified purchases come from EPANTRY payments."
      actions={
        <button type="button" onClick={() => setApplied((old) => ({ ...old, serial: old.serial + 1 }))}
          className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#A9BDB0] bg-[#F7F6F2] px-4 text-[14px] font-semibold text-[#173F35] hover:bg-[#E6F4ED]">
          <RefreshCw size={17} aria-hidden="true" /> Refresh
        </button>
      }
    >
      <div className="mx-auto flex w-full max-w-[1360px] min-w-0 flex-col gap-7 pb-10 text-[#202421] sm:gap-9">
        <section aria-label="Report filters" className="border-t-[3px] border-[#C86C42] bg-[#E6EBDD] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1">
              <label htmlFor="website-period" className="mb-1.5 block text-[14px] font-semibold text-[#214B38]">Reporting period</label>
              <select id="website-period" value={period} onChange={(event) => { setPeriod(event.target.value); setFilterError('') }}
                className="focus-ring min-h-11 w-full border border-[#BDCDBD] bg-white px-3 text-[15px] text-[#173F35]">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="custom">Custom dates (UTC)</option>
              </select>
            </div>
            {period === 'custom' && <>
              <div className="min-w-[135px] flex-1">
                <label htmlFor="website-from" className="mb-1.5 block text-[14px] font-semibold text-[#214B38]">From</label>
                <input id="website-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="focus-ring min-h-11 w-full border border-[#BDCDBD] bg-white px-3 text-[15px] text-[#173F35]" />
              </div>
              <div className="min-w-[135px] flex-1">
                <label htmlFor="website-to" className="mb-1.5 block text-[14px] font-semibold text-[#214B38]">To</label>
                <input id="website-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="focus-ring min-h-11 w-full border border-[#BDCDBD] bg-white px-3 text-[15px] text-[#173F35]" />
              </div>
            </>}
            <button type="button" onClick={applyRange} className="focus-ring min-h-11 border border-[#173F35] bg-[#173F35] px-6 text-[15px] font-semibold text-white hover:bg-[#2A694F]">Apply</button>
            <button type="button" onClick={() => report && exportAggregateCsv(report)} disabled={!report || loading}
              className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#A9BDB0] bg-white px-4 text-[14px] font-semibold text-[#173F35] disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={17} aria-hidden="true" /> Export CSV
            </button>
          </div>
          {filterError && <p role="alert" className="mt-3 text-[14px] font-semibold text-[#9C2E2E]">{filterError}</p>}
          <p className="mt-3 flex items-center gap-2 text-[13px] leading-5 text-[#4E6457]"><CalendarDays size={16} aria-hidden="true" /> Report dates are UTC. Raw event history is retained for up to 90 days.</p>
        </section>

        {loading && <div role="status" className="flex min-h-[200px] items-center justify-center gap-3 bg-[#EFF3ED] p-6 text-[15px] text-[#365549]"><RefreshCw size={20} className="animate-spin" aria-hidden="true" /> Loading verified analytics...</div>}
        {!loading && error && <section role="alert" className="border-l-4 border-[#C86C42] bg-[#FFF0E4] px-5 py-6">
          <h2 className="text-[21px] font-bold text-[#173F35]">Website analytics couldn't load</h2>
          <p className="mt-2 text-[15px] leading-6 text-[#544E48]">{error}</p>
          <button type="button" onClick={() => setApplied((old) => ({ ...old, serial: old.serial + 1 }))} className="focus-ring mt-4 min-h-11 border border-[#173F35] px-5 font-semibold text-[#173F35]">Try again</button>
        </section>}

        {!loading && report && <>
          <section>
            <SectionHeading number="01 / OVERVIEW" title="Your website, at a glance" subtitle={`Recorded activity, ${report.window.from} to ${report.window.to}. These are consented browsers, not all visitors.`} />
            <div className="mt-4 grid grid-cols-2 overflow-hidden border border-[#D6DED7] sm:grid-cols-3 lg:grid-cols-5">
              <Metric label="Visitors" value={compact(overview.visitors)} icon={Users} highlight note="Approximate unique browsers" />
              <Metric label="Sessions" value={compact(overview.sessions)} icon={Activity} note="Consented visits" />
              <Metric label="Page views" value={compact(overview.pageViews)} icon={Eye} note={compareLabel} />
              <Metric label="Product views" value={compact(overview.productViews)} icon={ShoppingBag} />
              <Metric label="Recipe views" value={compact(overview.recipeViews)} icon={BarChart3} />
            </div>
            {!hasData && <div className="mt-4 flex items-start gap-3 border-l-[3px] border-[#C86C42] bg-[#FFF0E4] px-4 py-4 text-[14px] leading-6 text-[#4B514B]">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#173F35]" aria-hidden="true" />
              <p><strong>No consented website events yet.</strong> The tracker only records activity after analytics permission. This is not evidence that nobody visited EPANTRY.</p>
            </div>}
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
              <div className="min-w-0 bg-[#EFF3ED] p-4 sm:p-6">
                <h3 className="text-[17px] font-bold text-[#173F35]">Page views over time</h3>
                <p className="mb-3 text-[13px] text-[#52685C]">Daily recorded page views</p>
                <TrendChart rows={report.daily} />
              </div>
              <div className="bg-[#173F35] p-5 text-white sm:p-6">
                <div className="flex items-center justify-between gap-3"><p className="text-[15px] font-semibold text-[#DBEDE3]">Verified paid orders</p><CheckCircle2 size={21} aria-hidden="true" /></div>
                <p className="mt-3 text-[38px] font-bold leading-none tabular-nums">{compact(report.commerce.paidOrders)}</p>
                <p className="mt-3 text-[13px] leading-5 text-[#D5E9DE]">From confirmed backend payment records, independently of optional visitor tracking.</p>
                {paidCurrencies.length ? paidCurrencies.map((currency) => (
                  <p key={currency.currency} className="mt-3 border-t border-white/20 pt-3 text-[17px] font-semibold tabular-nums">
                    {formatPaidAmount(currency.currency, currency.amountMinor)}
                    <span className="mt-1 block text-[12px] font-normal text-[#CFE7DA]">Gross paid order value - {currency.currency}</span>
                  </p>
                )) : <p className="mt-3 border-t border-white/20 pt-3 text-[14px] text-[#D5E9DE]">No verified payments during this period.</p>}
              </div>
            </div>
          </section>

          <section>
            <SectionHeading number="02 / ACQUISITION" title="Where visitors came from" subtitle="Source and device breakdown for sessions that started with analytics consent." tone="blue" />
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className="min-w-0 bg-[#F1F6F7] p-4 sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-[#173F35]"><Globe2 size={20} aria-hidden="true" /> Traffic source</h3>
                <MiniBars rows={report.acquisition.map((row) => ({ label: `${row.source} / ${row.medium}`, sessions: row.sessions }))} labelKey="label" countKey="sessions" emptyMessage="No attributable sessions recorded." />
              </div>
              <div className="min-w-0 bg-[#EFF3ED] p-4 sm:p-6">
                <h3 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-[#173F35]"><Smartphone size={20} aria-hidden="true" /> Devices</h3>
                <MiniBars rows={report.devices} labelKey="device" countKey="sessions" emptyMessage="No device breakdown available yet." />
              </div>
            </div>
            {report.campaigns.length > 0 && <div className="mt-4 bg-[#F7F6F2] p-4 sm:p-5">
              <h3 className="mb-3 text-[17px] font-bold text-[#173F35]">Campaigns (approved UTM values)</h3>
              <DataTable headings={['Campaign', 'Sessions']} rows={report.campaigns.map((row) => [row.name, compact(row.sessions)])} empty="No campaign entries." />
            </div>}
          </section>

          <section>
            <SectionHeading number="03 / DISCOVERY" title="What people explored" subtitle="Most viewed public routes and approved recipe/product references. Private customer data is never listed." tone="clay" />
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div className="min-w-0 border-t border-[#CBD7CC] bg-[#F7F6F2] p-4 sm:p-5">
                <h3 className="mb-4 text-[17px] font-bold text-[#173F35]">Popular pages</h3>
                <DataTable headings={['Page template', 'Views']} rows={report.topPages.map((row) => [row.page, compact(row.views)])} empty="No page views to rank yet." />
              </div>
              <div className="min-w-0 border-t border-[#DAB8A4] bg-[#FFF3EB] p-4 sm:p-5">
                <h3 className="mb-4 text-[17px] font-bold text-[#173F35]">Popular products and recipes</h3>
                <DataTable headings={['Public reference', 'Views']} rows={report.topContent.map((row) => [`${row.type || 'content'} / ${row.id || 'unknown'}`, compact(row.views)])} empty="No product or recipe views yet." />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 border border-[#D6DED7] sm:grid-cols-3">
              <Metric label="Search actions" value={compact(overview.searches)} icon={MousePointerClick} note="Search text not stored" />
              <Metric label="Saved items" value={compact(overview.bookmarks)} icon={ShieldCheck} note="Bookmark add events" />
              <Metric label="Cart additions" value={compact(overview.cartActions)} icon={ShoppingBag} note="Action events, not sales" />
            </div>
          </section>

          <section>
            <SectionHeading number="04 / COMMERCE" title="From interest to checkout" subtitle="Distinct consented sessions performing each action. These are directional activity counts, not a linked per-person conversion funnel." />
            <div className="mt-4 bg-[#E6EBDD] px-4 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {report.funnel.map((step, index) => (
                  <div key={step.event} className="flex min-w-0 items-center justify-between gap-3 border-b border-[#BCCBBE] py-3 last:border-b-0 md:border-b-0 md:border-r md:px-4 md:last:border-r-0">
                    <div>
                      <p className="text-[12px] font-bold text-[#C86C42]">STEP {String(index + 1).padStart(2, '0')}</p>
                      <h3 className="mt-1 text-[15px] font-bold text-[#173F35]">{({ product_view: 'Viewed a product', add_to_cart: 'Added to cart', begin_checkout: 'Began checkout' })[step.event]}</h3>
                    </div>
                    <strong className="text-[27px] tabular-nums text-[#173F35]">{compact(step.sessions)}</strong>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-5 text-[#4B5B53]">A user can enter the cart directly; each step has its own denominator. Paid orders above are verified separately and cannot be attributed to a specific consented session.</p>
            </div>
          </section>

          <section>
            <SectionHeading number="05 / PRIVACY & DATA QUALITY" title="Understand the coverage" subtitle="The dashboard tells you what it knows and what it cannot measure." tone="blue" />
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <div className="bg-[#DCE0CF] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[17px] font-bold text-[#173F35]"><ShieldCheck size={21} aria-hidden="true" /> Current cookie decisions</div>
                <p className="mt-4 text-[30px] font-bold tabular-nums text-[#173F35]">{report.consent.enabledShare == null ? 'No choices' : `${report.consent.enabledShare}%`}</p>
                <p className="mt-1 text-[14px] text-[#365549]">of stored current-policy decisions allow analytics</p>
                <div className="mt-5 flex gap-6 border-t border-[#B6C8B8] pt-4 text-[14px]">
                  <span>Allowed <strong className="block text-[20px] text-[#173F35]">{compact(report.consent.analyticsEnabled)}</strong></span>
                  <span>Rejected <strong className="block text-[20px] text-[#173F35]">{compact(report.consent.analyticsRejected)}</strong></span>
                </div>
              </div>
              <div className="border-l-[3px] border-[#C86C42] bg-[#F7F6F2] p-5 sm:p-6">
                <h3 className="text-[17px] font-bold text-[#173F35]">How to read these numbers</h3>
                <p className="mt-2 text-[14px] leading-6 text-[#4B5B53]">{report.coverage.note}</p>
                <p className="mt-3 text-[14px] leading-6 text-[#4B5B53]">{report.consent.note}</p>
                <p className="mt-3 text-[14px] leading-6 text-[#4B5B53]">{report.commerce.note}</p>
                <p className="mt-3 text-[13px] font-semibold text-[#476354]">Generated: {new Date(report.generatedAt).toLocaleString('en-IN')}</p>
              </div>
            </div>
            <details className="mt-4 bg-[#F1F5EE] p-4 sm:p-5">
              <summary className="cursor-pointer text-[15px] font-bold text-[#173F35]">View daily figures as a table</summary>
              <div className="mt-4"><DataTable headings={['UTC day', 'Page views', 'Sessions started', 'Recipe views', 'Product views']} rows={dailyTableRows} empty="No daily activity." /></div>
            </details>
          </section>
        </>}
      </div>
    </AdminShell>
  )
}
