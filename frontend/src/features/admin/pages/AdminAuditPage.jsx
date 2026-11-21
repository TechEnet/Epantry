import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, Clock3,
  FileClock, LoaderCircle, Search, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react'
import AdminShell from '../components/AdminShell'
import { useAdminAuditEvent, useAdminAuditEvents } from '../hooks/useAdminAuditExplorer'

// Display names only. All audit codes and identifiers stay unchanged in the API.
const ACTION_OPTIONS = [
  { value: '', label: 'All activities' },
  { value: 'media_privacy.review.resolve', label: 'Image privacy reviews' },
  { value: 'trust_safety.mutate', label: 'Safety and promotion changes' },
  { value: 'learning.pro.plan.update', label: 'Learning plan changes' },
  { value: 'recipe.mutate', label: 'Recipe changes' },
  { value: 'catalog.publish', label: 'Product publishing' },
  { value: 'catalog.mutate', label: 'Product catalog changes' },
  { value: 'marketplace.mutate', label: 'Marketplace changes' },
  { value: 'host.review.approve', label: 'Host approvals' },
]

const EMPTY_FIELDS = { action: '', outcome: '', actorUserId: '', requestId: '' }
const FIELD_CLASS = 'focus-ring w-full min-w-0 rounded-md border border-[#D7DDCF] bg-white px-3.5 py-3 text-sm font-medium text-[#202421] outline-none focus:border-[#173F35]'

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date)
}

function readableCode(value) {
  const text = String(value || '').replace(/[._:-]+/g, ' ').trim()
  return text ? text.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded'
}

function eventSubject(event) {
  const name = event?.subjectName
  if (typeof name === 'string' && name.trim()) return name.trim()
  const type = String(event?.entity?.type || '')
  const fieldNames = {
    dish: ['name', 'title'],
    recipe_version: ['title', 'name'],
    product_version: ['displayName', 'name', 'title'],
    retail_media_campaign: ['title', 'name'],
    community_product_draft: ['productName', 'name', 'title'],
    npi_catalog_handoff: ['productName', 'name', 'title'],
    pro_plan: ['name', 'title'],
  }[type] || []
  for (const snapshot of [event?.afterSnapshot, event?.beforeSnapshot]) {
    for (const key of fieldNames) {
      const value = snapshot?.[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return ''
}

function eventActionName(event) {
  const action = String(event?.action || '')
  const entity = String(event?.entity?.type || '')
  const subject = eventSubject(event)
  const operation = String(event?.metadata?.operation || '')
  const decision = String(event?.metadata?.decision || '').toLowerCase()
  const lifecycle = String(event?.metadata?.lifecycleAction || '').toLowerCase()
  if (action === 'media_privacy.review.resolve') return 'Image privacy review completed'
  if (action === 'trust_safety.mutate' && entity === 'retail_media_campaign') return subject ? `${subject} promotion reviewed` : 'Promotion review updated'
  if (action === 'trust_safety.mutate') return 'Safety review updated'
  if (action === 'learning.pro.plan.update') return subject ? `${subject} plan updated` : 'Learning plan updated'
  if (action === 'recipe.mutate') {
    const recipe = subject ? `${subject} recipe` : 'Recipe'
    if (operation === 'recipe_submit_for_review') return `${recipe} submitted for review`
    if (operation === 'recipe_review' && ['approved', 'rejected'].includes(decision)) return `${recipe} ${decision}`
    if (operation === 'recipe_review' && decision === 'changes_requested') return `Changes requested for ${recipe}`
    if (lifecycle === 'retire' || lifecycle === 'retired') return `${recipe} retired`
    if (lifecycle === 'disable') return `${recipe} disabled`
    if (lifecycle === 'restore') return `${recipe} restored`
    if (lifecycle === 'activate' || lifecycle === 'activated') return `${recipe} activated`
    return `${recipe} updated`
  }
  if (action === 'catalog.publish') return subject ? `${subject} published` : 'Product published'
  if (action === 'catalog.mutate' && entity === 'community_product_draft') return subject ? `${subject} product draft updated` : 'Product draft updated'
  if (action === 'catalog.mutate' && entity === 'npi_catalog_handoff') return subject ? `${subject} submitted for catalog review` : 'Product submitted for catalog review'
  if (action === 'catalog.mutate') return subject ? `${subject} catalog record updated` : 'Product catalog updated'
  if (action === 'marketplace.mutate' && entity === 'host_kyb_case') return 'Host verification updated'
  if (action === 'marketplace.mutate') return 'Marketplace record updated'
  if (action === 'host.review.approve') return 'Host review approved'
  return readableCode(action)
}

function eventName(event) {
  const label = eventActionName(event)
  if (event?.outcome === 'denied') return `Access denied: ${label}`
  if (event?.outcome === 'failed') return `Failed: ${label}`
  return label
}

const ENTITY_NAMES = {
  privacy_review_case: 'Uploaded image review',
  retail_media_campaign: 'Promotion campaign',
  pro_plan: 'Learning plan',
  dish: 'Recipe',
  product_version: 'Product listing',
  npi_catalog_handoff: 'Product review submission',
  community_product_draft: 'Product draft',
  host_kyb_case: 'Host verification',
  user: 'User account',
}

function entityName(event) {
  const kind = String(event?.entity?.type || '')
  return ENTITY_NAMES[kind] || readableCode(kind || 'Record')
}

function actorName(event) {
  const actor = event?.actor || {}
  if (actor.isRootSuperAdmin) return 'Root Super Admin'
  const source = String(actor.source || '').toLowerCase()
  if (source === 'super_admin' || source === 'root_super_admin') return 'Super Admin'
  if (source === 'assignment') return 'Assigned administrator'
  if (source === 'none' || !source) return 'Actor not recorded'
  return readableCode(source)
}

function outcomeName(outcome) {
  if (outcome === 'success') return 'Completed'
  if (outcome === 'denied') return 'Access denied'
  if (outcome === 'failed') return 'Failed'
  return readableCode(outcome)
}

function outcomeClasses(outcome) {
  if (outcome === 'success') return 'bg-[#D7DDCF] text-[#173F35]'
  if (outcome === 'denied') return 'border-l-[3px] border-[#C56C42] bg-[#F7F6F2] text-[#202421]'
  if (outcome === 'failed') return 'border-l-[3px] border-[#C56C42] bg-[#202421] text-[#F7F6F2]'
  return 'bg-[#F7F6F2] text-[#202421]'
}

function getErrorMessage(error) {
  return error?.message || 'Could not load activity history. Please try again.'
}

function DataField({ title, value }) {
  return (
    <div className="min-w-0 border-b border-stone-100 py-2.5 last:border-b-0">
      <p className="text-xs font-semibold text-stone-500">{title}</p>
      <p className="mt-0.5 break-all text-sm font-medium text-stone-800">
        {value === null || value === undefined || value === '' ? 'Not recorded' : String(value)}
      </p>
    </div>
  )
}

// Show every saved field in a readable format; original snapshots remain available verbatim.
const ORIGINAL_FIELD_LABELS = {
  _id: 'Record ID',
  privacyReviewCaseId: 'Image review case ID',
  imageEvidenceId: 'Uploaded image ID',
  assessmentId: 'Privacy assessment ID',
  assignedToUserId: 'Assigned reviewer ID',
  resolutionNote: "Reviewer's note",
  reasonCodes: 'Review checks',
}

function originalRecordFields(value, path = '', depth = 0) {
  if (depth < 20 && Array.isArray(value)) {
    if (!value.length) return [{ path: path || 'Value', value: 'None' }]
    return value.flatMap((item, index) => originalRecordFields(item, `${path}[${index}]`, depth + 1))
  }
  if (depth < 20 && value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return [{ path: path || 'Value', value: 'Empty record' }]
    return entries.flatMap(([key, entry]) => originalRecordFields(entry, path ? `${path}.${key}` : key, depth + 1))
  }
  return [{ path: path || 'Value', value }]
}

function originalFieldName(path) {
  return String(path).split('.').map((segment) => {
    const match = segment.match(/^(.*?)\[(\d+)\]$/)
    const key = match ? match[1] : segment
    const name = ORIGINAL_FIELD_LABELS[key] || humanAuditField(key)
    return match ? `${name} ${Number(match[2]) + 1}` : name
  }).join(' / ')
}

function SnapshotBlock({ title, value }) {
  if (value === null || value === undefined) return null
  const fields = originalRecordFields(value)
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-3.5 py-3">
        <h4 className="text-sm font-bold text-stone-900">{title}</h4>
        <span className="text-xs font-medium text-stone-500">{fields.length} field{fields.length === 1 ? '' : 's'}</span>
      </div>
      <dl className="min-w-0 divide-y divide-stone-100">
        {fields.map((field, index) => (
          <div key={`${field.path}-${index}`} className="min-w-0 px-3.5 py-2.5">
            <dt className="text-xs font-semibold text-stone-500">{originalFieldName(field.path)}</dt>
            <dd className="mt-1 min-w-0 break-words text-sm font-medium leading-5 text-stone-800 [overflow-wrap:anywhere]">
              {typeof field.value === 'object' && field.value !== null
                ? JSON.stringify(field.value)
                : humanAuditValue(field.value)}
            </dd>
          </div>
        ))}
      </dl>
      <details className="group min-w-0 border-t border-stone-200">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-xs font-semibold text-[#173F35] marker:hidden hover:bg-[#D7DDCF]/55">
          <span>View original JSON</span>
          <ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <pre className="max-h-64 min-w-0 overflow-y-auto whitespace-pre-wrap break-all bg-stone-950 p-3 font-mono text-xs leading-5 text-stone-100 [overflow-wrap:anywhere]">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </section>
  )
}


// Keep audit snapshots intact. Only their presentation is simplified for admins.
const AUDIT_FIELD_LABELS = {
  status: 'Review status',
  decision: 'Decision',
  resolutionNote: "Reviewer note",
  reasonCodes: 'Review checks',
  assignedToUserId: 'Assigned reviewer',
  riskLevel: 'Risk level',
  visibility: 'Visibility',
  moderationStatus: 'Moderation status',
  approvalStatus: 'Approval status',
  lifecycleStatus: 'Record status',
  title: 'Title',
  name: 'Name',
  isActive: 'Active',
  active: 'Active',
  published: 'Published',
}

const AUDIT_VALUE_LABELS = {
  safe_to_use: 'Safe to use',
  redaction_required: 'Needs private information removed',
  reupload_required: 'Needs a new image',
  delete_media: 'Remove uploaded image',
  resolved: 'Resolved',
  open: 'Open',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  submitted: 'Submitted',
  blocked: 'Blocked',
  closed: 'Closed',
  privacy_detector_failed: 'Automated privacy check could not finish',
}

function humanAuditValue(value) {
  if (value === undefined || value === null || value === '') return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.length ? value.map(humanAuditValue).join(', ') : 'None'
  if (typeof value === 'object') return 'Details updated (see original record)'
  const raw = String(value)
  const label = AUDIT_VALUE_LABELS[raw.toLowerCase()]
  return label || (raw.includes('_') ? readableCode(raw) : raw)
}

function humanAuditField(path) {
  const leaf = String(path).split('.').pop() || ''
  return AUDIT_FIELD_LABELS[leaf] || readableCode(leaf.replace(/([a-z])([A-Z])/g, '$1 $2'))
}

function flattenAuditFields(value, prefix = '', result = {}, depth = 0) {
  if (value && typeof value === 'object' && !Array.isArray(value) && depth < 6) {
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      flattenAuditFields(entry, path, result, depth + 1)
    }
  } else if (prefix) {
    result[prefix] = value
  }
  return result
}

function isTechnicalAuditField(path) {
  const leaf = String(path).split('.').pop() || ''
  return leaf === '_id' || leaf === 'id' || leaf === '__v' ||
    /Id(s)?$/.test(leaf) || /^(createdAt|updatedAt|deletedAt)$/i.test(leaf)
}

function snapshotChanges(event) {
  const before = flattenAuditFields(event?.beforeSnapshot)
  const after = flattenAuditFields(event?.afterSnapshot)
  const paths = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...paths]
    .filter((path) => !isTechnicalAuditField(path))
    .filter((path) => JSON.stringify(before[path]) !== JSON.stringify(after[path]))
    .map((path) => ({ path, name: humanAuditField(path), before: humanAuditValue(before[path]), after: humanAuditValue(after[path]) }))
    .sort((a, b) => {
      const priorities = ['status', 'decision', 'resolutionNote', 'reasonCodes']
      const aRank = priorities.indexOf(a.path.split('.').pop())
      const bRank = priorities.indexOf(b.path.split('.').pop())
      return (aRank === -1 ? 100 : aRank) - (bRank === -1 ? 100 : bRank)
    })
}

function auditMeaning(event) {
  if (event?.action === 'media_privacy.review.resolve') {
    return 'An uploaded image was checked for privacy concerns. This is not an approval of the product listing.'
  }
  if (event?.action === 'catalog.publish') return 'A product listing was published to the catalog.'
  if (event?.action === 'recipe.mutate') return 'An administrator recorded a change to this recipe.'
  if (event?.action === 'host.review.approve') return 'An administrator approved a Host review.'
  return 'This is a saved history of an administrative action. It cannot be edited here.'
}

function OutcomeTag({ outcome }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-bold ${outcomeClasses(outcome)}`}>
      {outcomeName(outcome)}
    </span>
  )
}

export default function AdminAuditPage() {
  // Start with 5 rows on mobile and 15 on desktop; request more only when asked.
  // The backend caps each page at 100, so pagination retains all older records.
  const [filters, setFilters] = useState({ page: 1, limit: typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 5 : 15, ...EMPTY_FIELDS })
  const [form, setForm] = useState({ ...EMPTY_FIELDS })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [showAllChanges, setShowAllChanges] = useState(false)
  const [viewAll, setViewAll] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (viewAll) return
    const limit = isMobile ? 5 : 15
    setFilters((current) => current.limit === limit && current.page === 1 ? current : { ...current, page: 1, limit })
  }, [isMobile, viewAll])

  const { events, pagination, isLoading, isFetching, error } = useAdminAuditEvents(filters)
  const {
    event: selectedEvent,
    isLoading: isLoadingDetail,
    error: detailError,
  } = useAdminAuditEvent(selectedEventId)

  useEffect(() => {
    if (!selectedEventId) return undefined
    setShowAllChanges(false)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onEscape = (event) => {
      if (event.key === 'Escape') setSelectedEventId('')
    }
    document.addEventListener('keydown', onEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onEscape)
    }
  }, [selectedEventId])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const submitFilters = (event) => {
    event.preventDefault()
    setViewAll(false)
    setFilters((current) => ({ ...current, ...form, page: 1, limit: initialCount }))
  }
  const clearFilters = () => {
    setForm({ ...EMPTY_FIELDS })
    setViewAll(false)
    setFilters({ page: 1, limit: initialCount, ...EMPTY_FIELDS })
  }
  const totalPages = pagination?.totalPages || 0
  const currentPage = pagination?.page || filters.page
  const totalCount = pagination?.total ?? 0
  const filtered = Boolean(filters.action || filters.outcome || filters.actorUserId || filters.requestId)
  const actionKnown = ACTION_OPTIONS.some((option) => option.value === form.action)
  const initialCount = isMobile ? 5 : 15
  const visibleEvents = viewAll ? events : events.slice(0, initialCount)
  const canViewMore = events.length > initialCount || totalCount > initialCount
  const displayedCount = events.length ? (currentPage - 1) * filters.limit + visibleEvents.length : 0
  const toggleAll = () => {
    const next = !viewAll
    setViewAll(next)
    setFilters((current) => ({ ...current, page: 1, limit: next ? 100 : initialCount }))
  }

  const changedFields = selectedEvent ? snapshotChanges(selectedEvent) : []
  const snapshotAvailable = selectedEvent && (selectedEvent.beforeSnapshot !== null && selectedEvent.beforeSnapshot !== undefined || selectedEvent.afterSnapshot !== null && selectedEvent.afterSnapshot !== undefined)
  const visibleChangeFields = showAllChanges ? changedFields : changedFields.slice(0, 6)

  return (
    <AdminShell
      title="Admin Activity History"
      description={isMobile ? "" : "Review who made a change, when it happened and the result."}
      actions={isFetching && !isLoading ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[#173F35]">
          <LoaderCircle size={16} className="animate-spin" /> Updating
        </span>
      ) : null}
    >
      {/* The shared shell remains unchanged globally. This page alone fills its mobile frame. */}
      <style>{`
        @media (max-width: 767px) {
          .page-shell:has(#epantry-admin-audit-content) {
            width: 100% !important;
            max-width: none !important;
            margin-inline: 0 !important;
            padding: 0 !important;
          }
          .page-shell:has(#epantry-admin-audit-content) > div {
            border-radius: 0 !important;
            border-left: 0 !important;
            border-right: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
      <div id="epantry-admin-audit-content" className="-mx-2.5 min-w-0 sm:-mx-5 md:mx-0">
      {/* Mobile: keep only the actionable total. Desktop keeps its approved overview. */}
      <section aria-label="Admin activity count" className="flex items-center justify-between border-b border-[#D7DDCF] bg-[#173F35] px-4 py-3 text-[#F7F6F2] md:hidden">
        <div className="flex items-baseline gap-2.5">
          <strong className="text-[25px] font-bold tabular-nums leading-none">{isLoading ? '—' : totalCount}</strong>
          <span className="text-[13px] font-medium">{filtered ? 'Matching activities' : 'Recorded activities'}</span>
        </div>
        <span className="text-xs font-medium text-[#D7DDCF]">Read-only</span>
      </section>
      {/* Compact overview: actual count only, no decorative or invented statistics. */}
      <section aria-label="Admin activity overview" className="hidden min-w-0 border-b border-[#D7DDCF] bg-[#F7F6F2] md:grid md:overflow-hidden md:border md:grid-cols-[minmax(0,1fr)_minmax(200px,0.32fr)]">
        <div className="min-w-0 border-l-[4px] border-[#C56C42] px-4 py-4 md:border-l-[5px] md:px-7 md:py-7">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#C56C42] md:text-xs md:tracking-[0.08em]">
            <FileClock size={17} /> Admin record / Read only
          </div>
          <h2 className="mt-2 max-w-2xl text-[21px] font-extrabold leading-[1.2] tracking-tight text-[#202421] md:mt-3 md:text-[32px] md:leading-[1.15]">
            Every change, on record.
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#173F35] md:mt-2 md:text-base md:leading-6">
            Check what changed, who did it and whether it worked.
          </p>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 bg-[#173F35] px-4 py-3.5 text-[#F7F6F2] md:block md:px-6 md:py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#D7DDCF] md:text-xs md:tracking-[0.08em]">{filtered ? 'Matching actions' : 'Recorded actions'}</p>
            <p className="mt-1 text-[30px] font-extrabold tabular-nums leading-none md:text-5xl">{isLoading ? '—' : totalCount}</p>
          </div>
          <div className="flex max-w-[135px] items-center gap-2 border-l border-[#D7DDCF]/30 pl-3 text-[11px] leading-4 text-[#D7DDCF] md:mt-5 md:max-w-none md:border-l-0 md:border-t md:pl-0 md:pt-3 md:text-xs md:leading-5">
            <ShieldCheck size={18} className="shrink-0 text-[#C56C42]" /> Saved history cannot be edited
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-0 md:mt-5 md:gap-5 xl:grid-cols-[minmax(260px,0.29fr)_minmax(0,1fr)] xl:items-start">
        {/* Filters and their exact API keys are preserved. */}
        <section aria-label="Filter admin activity" className="min-w-0 border-b border-[#BFC9B9] bg-[#D7DDCF] md:border-b-0 xl:sticky xl:top-5">
          <header className="border-b border-[#BFC9B9] px-4 pb-2.5 pt-4 md:border-[#D7DDCF] md:px-6 md:pb-4 md:pt-5">
            <p className="hidden text-xs font-bold uppercase tracking-[0.08em] text-[#C56C42] md:block">01 / Search history</p>
            <h2 className="text-[18px] font-bold leading-tight text-[#202421] md:mt-1.5 md:text-[22px]"><span className="md:hidden">Filter activity</span><span className="hidden md:inline">Find an activity</span></h2>
            <p className="mt-1 hidden text-sm text-[#173F35] md:block">Choose what you want to check.</p>
          </header>
          <form onSubmit={submitFilters} className="px-4 pb-4 pt-3 md:px-6 md:py-5">
            <div className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-1">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-bold text-[#202421]"><span className="md:hidden">Type</span><span className="hidden md:inline">Activity type</span></span>
                <select value={actionKnown ? form.action : '__custom'} onChange={(event) => setField('action', event.target.value === '__custom' ? '' : event.target.value)} className={FIELD_CLASS}>
                  {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  {!actionKnown && <option value="__custom">Custom activity code</option>}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-bold text-[#202421]">Result</span>
                <select value={form.outcome} onChange={(event) => setField('outcome', event.target.value)} className={FIELD_CLASS}>
                  <option value="">All results</option>
                  <option value="success">Completed</option>
                  <option value="denied">Access denied</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>
            <button type="submit" className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-[#173F35] px-5 py-3 text-sm font-bold text-[#F7F6F2] transition hover:bg-[#202421] md:mt-4">
              <Search size={17} /><span className="md:hidden">Search</span><span className="hidden md:inline">Search activity</span>
            </button>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#BFC9B9] pt-3 md:mt-4 md:border-[#D7DDCF] md:pt-4">
              <button type="button" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced} className="focus-ring inline-flex items-center gap-1.5 text-sm font-bold text-[#173F35] hover:underline">
                <SlidersHorizontal size={16} /><span className="md:hidden">{showAdvanced ? 'Hide ID search' : 'Search by ID'}</span><span className="hidden md:inline">{showAdvanced ? 'Hide ID filters' : 'Search by ID'}</span>
              </button>
              <button type="button" onClick={clearFilters} className="focus-ring text-sm font-semibold text-[#202421] underline-offset-4 hover:underline"><span className="md:hidden">Clear</span><span className="hidden md:inline">Clear filters</span></button>
            </div>
            {showAdvanced && (
              <div className="mt-4 grid gap-3 border-t border-[#D7DDCF] pt-4">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-[#202421]">Exact action code</span>
                  <input className={FIELD_CLASS} value={form.action} onChange={(event) => setField('action', event.target.value)} placeholder="e.g. catalog.publish" />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-[#202421]">Admin user ID</span>
                  <input className={FIELD_CLASS} value={form.actorUserId} onChange={(event) => setField('actorUserId', event.target.value)} placeholder="Optional user ID" />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-sm font-semibold text-[#202421]">Request ID</span>
                  <input className={FIELD_CLASS} value={form.requestId} onChange={(event) => setField('requestId', event.target.value)} placeholder="Optional request ID" />
                </label>
              </div>
            )}
          </form>
        </section>

        <section aria-label="Recorded admin activity" className="min-w-0 border-t-[3px] border-[#C56C42] bg-[#F7F6F2] md:border-t-[4px]">
          <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#D7DDCF] px-4 py-4 md:px-6 md:py-5">
            <div className="min-w-0">
              <p className="hidden text-xs font-bold uppercase tracking-[0.08em] text-[#C56C42] md:block">02 / Activity ledger</p>
              <h2 className="text-[18px] font-bold leading-tight text-[#202421] md:mt-1.5 md:text-2xl"><span className="md:hidden">Activities</span><span className="hidden md:inline">Recorded activity</span></h2>
              <p className="mt-1 hidden text-sm text-[#173F35] md:block">Select a record to see the details.</p>
            </div>
            {!isLoading && !error && (
              <span className="border-l-[3px] border-[#C56C42] bg-[#D7DDCF] px-3 py-1.5 text-[13px] font-bold tabular-nums text-[#173F35] md:py-2 md:text-sm">
                {displayedCount || 0} of {totalCount}
              </span>
            )}
          </header>
          {isLoading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-[#173F35]">
              <LoaderCircle size={20} className="animate-spin text-[#173F35]" /> Loading activity…
            </div>
          ) : error ? (
            <div className="m-4 flex items-start gap-2 border-l-4 border-[#C56C42] bg-[#D7DDCF] p-4 text-sm text-[#202421]">
              <CircleAlert size={18} className="shrink-0" /> {getErrorMessage(error)}
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-start gap-3 px-5 py-10 sm:px-6">
              <ShieldCheck size={26} className="shrink-0 text-[#173F35]" />
              <div>
                <h3 className="text-base font-bold text-[#202421]">No matching activity</h3>
                <p className="mt-1 text-sm text-[#173F35]">Try another filter or clear the search.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed text-left">
                  <thead className="bg-[#202421] text-sm font-semibold text-[#F7F6F2]">
                    <tr>
                      <th className="w-[39%] px-5 py-3.5">Activity</th>
                      <th className="w-[18%] px-3 py-3.5">By</th>
                      <th className="w-[15%] px-3 py-3.5">Result</th>
                      <th className="w-[23%] px-3 py-3.5">When</th>
                      <th className="w-[5%] px-2 py-3.5" aria-label="Open details" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D7DDCF]">
                    {visibleEvents.map((auditEvent) => (
                      <tr key={auditEvent.eventId} onClick={() => setSelectedEventId(auditEvent.eventId)}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedEventId(auditEvent.eventId) } }}
                        role="button" tabIndex={0} aria-label={`View details: ${eventName(auditEvent)}`}
                        className="group focus-ring cursor-pointer align-middle transition hover:bg-[#D7DDCF]/55 focus:bg-[#D7DDCF]/55">
                        <td className="border-l-[3px] border-transparent px-5 py-4 group-hover:border-[#C56C42]">
                          <p className="break-words text-[15px] font-bold leading-snug text-[#202421]">{eventName(auditEvent)}</p>
                          <p className="mt-1 text-[13px] text-[#173F35]">{entityName(auditEvent)}</p>
                        </td>
                        <td className="break-words px-3 py-4 text-sm text-[#202421]">{actorName(auditEvent)}</td>
                        <td className="px-3 py-4"><OutcomeTag outcome={auditEvent.outcome} /></td>
                        <td className="break-words px-3 py-4 text-sm text-[#173F35]">{formatDate(auditEvent.occurredAt)}</td>
                        <td className="px-2 py-4"><ArrowRight size={18} className="text-[#C56C42]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-[#D7DDCF] md:hidden">
                {visibleEvents.map((auditEvent) => (
                  <button type="button" key={auditEvent.eventId} onClick={() => setSelectedEventId(auditEvent.eventId)}
                    className="focus-ring block w-full border-l-[3px] border-transparent px-4 py-3.5 text-left transition hover:border-[#C56C42] hover:bg-[#D7DDCF]/40">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-[#202421]">{eventName(auditEvent)}</p>
                      <OutcomeTag outcome={auditEvent.outcome} />
                    </div>
                    <div className="mt-1.5 flex min-w-0 items-start justify-between gap-2 text-[12px] leading-4 text-[#173F35]">
                      <span className="min-w-0">{actorName(auditEvent)} · {formatDate(auditEvent.occurredAt)}</span>
                      <ArrowRight size={16} className="shrink-0 text-[#C56C42]" />
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center gap-2 border-t border-[#D7DDCF] px-4 py-4 md:px-4">
                {canViewMore && (
                  <button type="button" onClick={toggleAll}
                    className="focus-ring inline-flex w-full items-center justify-center gap-2 border border-[#173F35] bg-[#F7F6F2] px-5 py-2.5 text-sm font-bold text-[#173F35] transition hover:bg-[#D7DDCF] md:w-auto md:min-w-44">
                    {viewAll ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                    {viewAll ? 'Show fewer' : 'View all activity'}
                  </button>
                )}
                {viewAll && totalCount > filters.limit && (
                  <p className="text-center text-xs text-[#173F35]">Showing up to 100 actions per page. Use Next for older records.</p>
                )}
              </div>
            </>
          )}
          {!isLoading && !error && viewAll && events.length > 0 && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D7DDCF] px-4 py-3 sm:px-6">
              <span className="text-sm font-medium text-[#202421]">Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous page" disabled={currentPage <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                  className="focus-ring inline-flex items-center gap-1 border border-[#D7DDCF] px-3 py-2 text-sm font-semibold text-[#202421] disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={17} /> Previous
                </button>
                <button type="button" aria-label="Next page" disabled={currentPage >= totalPages}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                  className="focus-ring inline-flex items-center gap-1 border border-[#D7DDCF] px-3 py-2 text-sm font-semibold text-[#202421] disabled:cursor-not-allowed disabled:opacity-40">
                  Next <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      </div>

      {selectedEventId && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-stone-950/65 px-3 py-4 backdrop-blur-[3px] sm:px-5"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEventId('') }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Activity details"
            className="flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-2xl"
            style={{ maxWidth: 850, maxHeight: 'min(90dvh, 780px)' }}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#D7DDCF] bg-[#D7DDCF] px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="hidden text-xs font-bold uppercase tracking-wide text-[#173F35] sm:block">Activity history / Record details</p>
                <h2 className="mt-1 break-words text-lg font-extrabold leading-snug text-[#173F35] sm:text-2xl">
                  {selectedEvent ? eventName(selectedEvent) : 'Activity details'}
                </h2>
                <p className="mt-1 hidden text-sm text-stone-600 sm:block">A read-only record of what an admin did.</p>
              </div>
              <button type="button" aria-label="Close activity details" onClick={() => setSelectedEventId('')}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D7DDCF] bg-white text-stone-800 hover:bg-stone-50">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-600">
                  <LoaderCircle size={22} className="animate-spin text-[#173F35]" /> Loading details…
                </div>
              ) : detailError ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{getErrorMessage(detailError)}</p>
              ) : selectedEvent ? (
                <>
                  <div className="rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] px-3.5 py-3.5 sm:px-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <OutcomeTag outcome={selectedEvent.outcome} />
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700"><Clock3 size={15} /> {formatDate(selectedEvent.occurredAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-stone-700">{auditMeaning(selectedEvent)}</p>
                  </div>

                  <div className="grid gap-x-5 gap-y-2 border-b border-stone-200 pb-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Changed by</p>
                      <p className="mt-0.5 text-sm font-bold text-stone-900">{actorName(selectedEvent)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Record</p>
                      <p className="mt-0.5 break-words text-sm font-bold text-stone-900">
                        {eventSubject(selectedEvent) || entityName(selectedEvent)}
                      </p>
                    </div>
                  </div>

                  {snapshotAvailable && (
                    <section aria-label="What changed" className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-extrabold text-[#173F35]">What changed?</h3>
                        <span className="text-xs font-semibold text-stone-500">{changedFields.length} visible change{changedFields.length === 1 ? '' : 's'}</span>
                      </div>
                      {changedFields.length ? (
                        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
                          {visibleChangeFields.map((field) => (
                            <div key={field.path} className="border-b border-stone-100 px-3.5 py-3 last:border-b-0 sm:px-4">
                              <p className="text-sm font-bold text-stone-900">{field.name}</p>
                              <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-2 sm:gap-4">
                                <div className="min-w-0 rounded-lg bg-stone-50 p-2.5">
                                  <p className="text-xs font-semibold text-stone-500">Before</p>
                                  <p className="mt-1 break-words text-sm leading-5 text-stone-700">{field.before}</p>
                                </div>
                                <div className="min-w-0 rounded-lg bg-[#D7DDCF]/55 p-2.5">
                                  <p className="text-xs font-semibold text-[#173F35]">After</p>
                                  <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#173F35]">{field.after}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {changedFields.length > 6 && (
                            <button type="button" onClick={() => setShowAllChanges((value) => !value)}
                              className="focus-ring flex w-full items-center justify-center gap-2 border-t border-stone-100 px-3 py-3 text-sm font-bold text-[#173F35] hover:bg-[#D7DDCF]/55">
                              {showAllChanges ? <><ChevronUp size={16} /> Show fewer changes</> : <><ChevronDown size={16} /> Show all {changedFields.length} changes</>}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-600">
                          No everyday fields changed in the saved snapshots. Original records are available below.
                        </p>
                      )}
                    </section>
                  )}

                  <section className="border-t border-stone-200 pt-4">
                    <h3 className="text-base font-bold text-stone-900">Reason for this action</h3>
                    <p className="mt-1.5 break-words text-sm leading-6 text-stone-700">
                      {selectedEvent.reason?.details || (selectedEvent.reason?.code ? readableCode(selectedEvent.reason.code) : 'No written reason was recorded.')}
                    </p>
                  </section>

                  <details className="group min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3.5 text-sm font-bold text-stone-800 marker:hidden sm:px-4">
                      <span>Technical details & original records</span>
                      <ChevronDown size={18} className="shrink-0 text-stone-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-4 border-t border-stone-200 px-3.5 py-3.5 sm:px-4">
                      <p className="text-sm leading-5 text-stone-600">Exact IDs, system codes and saved snapshots for technical investigation. The original data is unchanged.</p>
                      <div className="grid gap-x-5 sm:grid-cols-2">
                        <DataField title="Original action code" value={selectedEvent.action} />
                        <DataField title="Event ID" value={selectedEvent.eventId} />
                        <DataField title="Administrator user ID" value={selectedEvent.actor?.userId} />
                        <DataField title="Administrator source" value={selectedEvent.actor?.source} />
                        <DataField title="Root Super Admin" value={selectedEvent.actor?.isRootSuperAdmin === true ? 'Yes' : 'No'} />
                        <DataField title="Recorded roles" value={selectedEvent.actor?.roleKeys?.join(', ')} />
                        <DataField title="Recorded permissions" value={selectedEvent.actor?.permissionKeys?.join(', ')} />
                        <DataField title="Permission required" value={selectedEvent.permissionKey} />
                        <DataField title="Record type" value={selectedEvent.entity?.type} />
                        <DataField title="Record ID" value={selectedEvent.entity?.id} />
                        <DataField title="Request ID" value={selectedEvent.requestId} />
                        <DataField title="Reason code" value={selectedEvent.reason?.code} />
                        <DataField title="Created on" value={selectedEvent.createdAt ? formatDate(selectedEvent.createdAt) : null} />
                      </div>
                      {snapshotAvailable && (
                        <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                          <SnapshotBlock title="Original before record" value={selectedEvent.beforeSnapshot} />
                          <SnapshotBlock title="Original after record" value={selectedEvent.afterSnapshot} />
                        </div>
                      )}
                      <SnapshotBlock title="Additional metadata" value={selectedEvent.metadata} />
                    </div>
                  </details>
                </>
              ) : <p className="text-sm text-stone-600">Activity details are not available.</p>}
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 sm:px-6">
              <p className="hidden text-xs font-medium text-stone-500 sm:block">Read-only · No changes can be made here</p>
              <button type="button" onClick={() => setSelectedEventId('')}
                className="focus-ring shrink-0 rounded-xl bg-[#173F35] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#202421]">Close</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}

    </AdminShell>
  )
}
