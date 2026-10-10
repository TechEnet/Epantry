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
const FIELD_CLASS = 'focus-ring w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none focus:border-emerald-600'

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
  if (outcome === 'success') return 'bg-emerald-100 text-emerald-800'
  if (outcome === 'denied') return 'bg-amber-100 text-amber-900'
  if (outcome === 'failed') return 'bg-red-100 text-red-700'
  return 'bg-stone-100 text-stone-700'
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
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-xs font-semibold text-emerald-800 marker:hidden hover:bg-emerald-50">
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
      description="See what changed, who made the change and whether it was successful."
      actions={isFetching && !isLoading ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-stone-500">
          <LoaderCircle size={16} className="animate-spin" /> Updating
        </span>
      ) : null}
    >
      <section className="overflow-hidden rounded-[18px] border border-[#CFE6D9] bg-[#E6F4ED]">
        <div className="grid gap-4 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 sm:px-6 sm:py-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Admin record</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-[#124E3A] sm:mt-1 sm:text-2xl">Know who changed what.</h2>
            <p className="mt-3 whitespace-nowrap text-[13px] leading-5 tracking-tight text-stone-700 max-[350px]:whitespace-normal sm:hidden">
              Who, what, when, result & why. Read-only.
            </p>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-stone-700 sm:block">
              EPANTRY keeps a history of important admin actions: who made a change, when it happened and whether it worked.
              Open any activity to see its reason and details. This page is read-only.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-xl border border-emerald-100 bg-white/90 px-4 py-3 sm:self-center">
            <FileClock size={22} className="text-emerald-800" />
            <div>
              <p className="text-2xl font-extrabold tabular-nums text-[#124E3A]">{isLoading ? '—' : totalCount}</p>
              <p className="text-xs font-medium text-stone-600">{filtered ? 'Matching actions' : 'Recorded actions'}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-emerald-100 border-t border-emerald-100 bg-white/60 text-center text-xs font-semibold text-[#124E3A] sm:text-sm">
          <div className="px-1 py-3.5 sm:px-3 sm:py-3">01 Find a change</div>
          <div className="px-1 py-3.5 sm:px-3 sm:py-3">02 Check who & when</div>
          <div className="px-1 py-3.5 sm:px-3 sm:py-3">03 Read the details</div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[16px] border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-base font-bold text-stone-900">Find an activity</h2>
            <p className="text-sm text-stone-600">Choose an action or result to narrow the history.</p>
          </div>
        </div>
        <form onSubmit={submitFilters} className="px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-3">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700 sm:mb-1">Activity</span>
              <select value={actionKnown ? form.action : '__custom'} onChange={(event) => setField('action', event.target.value === '__custom' ? '' : event.target.value)} className={FIELD_CLASS}>
                {ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                {!actionKnown && <option value="__custom">Custom activity code</option>}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700 sm:mb-1">Result</span>
              <select value={form.outcome} onChange={(event) => setField('outcome', event.target.value)} className={FIELD_CLASS}>
                <option value="">All results</option>
                <option value="success">Completed</option>
                <option value="denied">Access denied</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <button type="submit" className="focus-ring inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[#0F5132] px-5 text-sm font-bold text-white">
              <Search size={16} /> Search
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 sm:mt-3">
            <button type="button" onClick={() => setShowAdvanced((value) => !value)} aria-expanded={showAdvanced} className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <SlidersHorizontal size={16} /> {showAdvanced ? 'Hide ID filters' : 'Search by ID'}
            </button>
            <button type="button" onClick={clearFilters} className="focus-ring text-sm font-semibold text-stone-600 underline-offset-4 hover:underline">Clear filters</button>
          </div>
          {showAdvanced && (
            <div className="mt-3 grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-3">
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-stone-700 sm:mb-1">Exact action code</span>
                <input className={FIELD_CLASS} value={form.action} onChange={(event) => setField('action', event.target.value)} placeholder="e.g. catalog.publish" />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-stone-700 sm:mb-1">Admin user ID</span>
                <input className={FIELD_CLASS} value={form.actorUserId} onChange={(event) => setField('actorUserId', event.target.value)} placeholder="Optional user ID" />
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-stone-700 sm:mb-1">Request ID</span>
                <input className={FIELD_CLASS} value={form.requestId} onChange={(event) => setField('requestId', event.target.value)} placeholder="Optional request ID" />
              </label>
            </div>
          )}
        </form>
      </section>

      <section className="mt-5 overflow-hidden rounded-[16px] border border-stone-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-stone-100 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Recorded activity</h2>
            <p className="mt-0.5 text-sm text-stone-600">Select an action to see what happened.</p>
          </div>
          {!isLoading && !error && <span className="text-sm font-semibold tabular-nums text-stone-600">{displayedCount || 0} of {totalCount}</span>}
        </div>
        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-stone-600">
            <LoaderCircle size={20} className="animate-spin text-emerald-700" /> Loading activity…
          </div>
        ) : error ? (
          <div className="m-4 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert size={18} className="shrink-0" /> {getErrorMessage(error)}
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ShieldCheck size={30} className="mx-auto text-emerald-700" />
            <h3 className="mt-3 font-bold text-stone-900">No matching activity</h3>
            <p className="mt-1 text-sm text-stone-600">Try another filter or clear your search.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-stone-50 text-sm font-semibold text-stone-600">
                  <tr>
                    <th className="w-[39%] px-4 py-3">Change</th>
                    <th className="w-[18%] px-3 py-3">By</th>
                    <th className="w-[15%] px-3 py-3">Result</th>
                    <th className="w-[23%] px-3 py-3">When</th>
                    <th className="w-[5%] px-2 py-3" aria-label="Open details" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibleEvents.map((auditEvent) => (
                    <tr key={auditEvent.eventId} onClick={() => setSelectedEventId(auditEvent.eventId)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedEventId(auditEvent.eventId) } }}
                      role="button" tabIndex={0} aria-label={`View details: ${eventName(auditEvent)}`}
                      className="focus-ring cursor-pointer align-top transition hover:bg-emerald-50/60 focus:bg-emerald-50/60">
                      <td className="px-4 py-3">
                        <p className="break-words text-sm font-bold text-stone-900">{eventName(auditEvent)}</p>
                        <p className="mt-0.5 text-xs text-stone-500">{entityName(auditEvent)}</p>
                      </td>
                      <td className="break-words px-3 py-3.5 text-sm text-stone-700">{actorName(auditEvent)}</td>
                      <td className="px-3 py-3.5"><OutcomeTag outcome={auditEvent.outcome} /></td>
                      <td className="break-words px-3 py-3.5 text-sm text-stone-600">{formatDate(auditEvent.occurredAt)}</td>
                      <td className="px-2 py-3.5"><ArrowRight size={17} className="text-emerald-800" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-stone-100 md:hidden">
              {visibleEvents.map((auditEvent) => (
                <button type="button" key={auditEvent.eventId} onClick={() => setSelectedEventId(auditEvent.eventId)}
                  className="focus-ring block w-full px-4 py-4 text-left transition hover:bg-emerald-50/50 sm:py-3.5">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-bold leading-5 text-stone-900">{eventName(auditEvent)}</p>
                    <OutcomeTag outcome={auditEvent.outcome} />
                  </div>
                  <p className="mt-2 text-xs text-stone-600 sm:mt-1">{actorName(auditEvent)} · {entityName(auditEvent)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-stone-500 sm:mt-1.5">
                    <span className="min-w-0">{formatDate(auditEvent.occurredAt)}</span>
                    <ArrowRight size={16} className="shrink-0 text-emerald-800" />
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center gap-2 border-t border-stone-100 px-4 py-4">
              {canViewMore && (
                <button type="button" onClick={toggleAll}
                  className="focus-ring inline-flex min-w-44 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-bold text-[#0F5132] hover:bg-emerald-100">
                  {viewAll ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  {viewAll ? 'Show fewer' : 'View all'}
                </button>
              )}
              {viewAll && totalCount > filters.limit && (
                <p className="text-center text-xs text-stone-500">Showing up to 100 actions per page. Use Next for older records.</p>
              )}
            </div>
          </>
        )}
        {!isLoading && !error && viewAll && events.length > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 sm:px-5">
            <span className="text-sm font-medium text-stone-600">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous page" disabled={currentPage <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft size={17} /> Previous
              </button>
              <button type="button" aria-label="Next page" disabled={currentPage >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">
                Next <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

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
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#cce5d7] bg-[#E6F4ED] px-4 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Activity history / Record details</p>
                <h2 className="mt-1 break-words text-lg font-extrabold leading-snug text-[#124E3A] sm:text-2xl">
                  {selectedEvent ? eventName(selectedEvent) : 'Activity details'}
                </h2>
                <p className="mt-1 text-sm text-stone-600">A read-only record of what an admin did.</p>
              </div>
              <button type="button" aria-label="Close activity details" onClick={() => setSelectedEventId('')}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#cce5d7] bg-white text-stone-800 hover:bg-stone-50">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-600">
                  <LoaderCircle size={22} className="animate-spin text-emerald-700" /> Loading details…
                </div>
              ) : detailError ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{getErrorMessage(detailError)}</p>
              ) : selectedEvent ? (
                <>
                  <div className="rounded-xl border border-emerald-100 bg-[#F4F9F6] px-3.5 py-3.5 sm:px-4">
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
                        <h3 className="text-base font-extrabold text-[#124E3A]">What changed?</h3>
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
                                <div className="min-w-0 rounded-lg bg-emerald-50 p-2.5">
                                  <p className="text-xs font-semibold text-emerald-800">After</p>
                                  <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#124E3A]">{field.after}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {changedFields.length > 6 && (
                            <button type="button" onClick={() => setShowAllChanges((value) => !value)}
                              className="focus-ring flex w-full items-center justify-center gap-2 border-t border-stone-100 px-3 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50">
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
              <p className="text-xs font-medium text-stone-500">Read-only · No changes can be made here</p>
              <button type="button" onClick={() => setSelectedEventId('')}
                className="focus-ring shrink-0 rounded-xl bg-[#0F5132] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#124E3A]">Close</button>
            </footer>
          </section>
        </div>,
        document.body,
      )}

    </AdminShell>
  )
}
