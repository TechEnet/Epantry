import { CheckCircle2, ChevronDown, ChevronUp, Eye, RefreshCw, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getMediaPrivacyErrorMessage,
  listAdminMediaPrivacyReviews,
  resolveAdminMediaPrivacyReview,
} from '../../mediaPrivacy/services/mediaPrivacy.service'

function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

const reviewDecisions = [
  ['safe_to_use', 'Safe to use'],
  ['redaction_required', 'Hide private details first'],
  ['reupload_required', 'Ask for a new image'],
  ['delete_media', 'Remove this image'],
]

export default function MediaPrivacyReviewQueue() {
  const [status, setStatus] = useState('open')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [activeReviewId, setActiveReviewId] = useState('')
  const [decisions, setDecisions] = useState({})
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError('')

    try {
      const first = await listAdminMediaPrivacyReviews({ status, page: 1, limit: 30 })
      if (!Array.isArray(first?.reviewCases)) throw new Error('The image review response was incomplete.')
      let loaded = first.reviewCases
      const totalPages = Math.max(1, Number(first?.pagination?.totalPages) || 1)

      // View all must fetch every permitted review, not just the first API page.
      if (showAll && totalPages > 1) {
        for (let page = 2; page <= totalPages; page += 4) {
          const pages = Array.from(
            { length: Math.min(4, totalPages - page + 1) },
            (_, index) => page + index,
          )
          const responses = await Promise.all(
            pages.map((nextPage) => listAdminMediaPrivacyReviews({ status, page: nextPage, limit: 30 })),
          )
          for (const response of responses) {
            if (!Array.isArray(response?.reviewCases)) throw new Error('Could not load all image reviews.')
            loaded = loaded.concat(response.reviewCases)
          }
        }
      }

      if (sequence !== requestSequence.current) return
      setItems(loaded)
      setTotal(Math.max(loaded.length, Number(first?.pagination?.total) || 0))
    } catch (requestError) {
      if (sequence !== requestSequence.current) return
      setError(getMediaPrivacyErrorMessage(requestError, 'Could not load image reviews. Please try Refresh.'))
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [status, showAll])

  useEffect(() => {
    load()
    return () => { requestSequence.current += 1 }
  }, [load])

  async function resolveCase(item) {
    const decision = decisions[item.id]
    const resolutionNote = (notes[item.id] ?? 'Reviewed the uploaded media and privacy evidence.').trim()
    if (!decision || resolutionNote.length < 3) return

    setBusyId(item.id)
    setError('')
    setNotice('')
    try {
      await resolveAdminMediaPrivacyReview({
        privacyReviewCaseId: item.id,
        decision,
        resolutionNote,
      })
      setNotice('Image review saved. Your decision is recorded.')
      setActiveReviewId('')
      await load()
    } catch (requestError) {
      setError(getMediaPrivacyErrorMessage(requestError, 'Could not save this review.'))
    } finally {
      setBusyId('')
    }
  }

  const isExpandable = total > 3
  const visibleItems = showAll ? items : items.slice(0, 6)

  return (
    <section className="min-w-0 overflow-hidden rounded-[16px] border border-[#d8e7df] bg-white" aria-label="Image privacy reviews">
      <div className="flex min-w-0 flex-col gap-3 bg-[#f1f8f4] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d9eee3] text-[#0f5d42]">
            <ShieldAlert size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-snug text-[#173d30]">Uploaded image reviews</h3>
            <p className="mt-0.5 text-sm leading-5 text-stone-600">
              Check photos for faces, personal details or other privacy concerns before use.
            </p>
            {!loading && !error ? <p className="mt-1 text-xs font-semibold text-[#176344]">{total} {titleize(status)} review{total === 1 ? '' : 's'}</p> : null}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <label className="min-w-0 flex-1 sm:flex-none">
            <span className="sr-only">Filter image reviews by status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setShowAll(false)
                setActiveReviewId('')
                setNotice('')
              }}
              className="focus-ring w-full min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700"
            >
              {['open', 'in_review', 'resolved', 'cancelled', 'all'].map((value) => (
                <option key={value} value={value}>{titleize(value)}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-[#164b38] disabled:opacity-50"
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="border-t border-[#d8e7df] px-4 py-2 text-sm text-stone-600 sm:px-6">
        <strong className="text-[#173d30]">Decision guide:</strong> Open evidence → Choose an action → Add a reason → Save.
        <span className="mt-1 block text-xs">Image privacy clearance does not approve the product listing.</span>
      </div>

      {error ? <p role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-800 sm:mx-6">{error}</p> : null}
      {notice ? <p role="status" className="mx-4 mt-3 flex gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800 sm:mx-6"><CheckCircle2 size={17} className="shrink-0" aria-hidden="true" />{notice}</p> : null}
      {loading ? <p className="px-4 py-5 text-sm font-medium text-stone-600 sm:px-6">Loading image reviews…</p> : null}
      {!loading && !items.length && !error ? <p className="px-4 py-5 text-sm text-stone-600 sm:px-6">No image reviews match this filter.</p> : null}

      {!loading && items.length ? (
        <div className="grid min-w-0 gap-px border-t border-stone-200 bg-stone-200 lg:grid-cols-2">
          {visibleItems.map((item, index) => (
            <article
              key={item.id}
              className={`min-w-0 bg-white p-4 sm:p-5 ${!showAll && index >= 3 ? 'max-sm:hidden' : ''}`}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-stone-900">{item.owner?.email || item.owner?.id || 'Uploaded image'}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {titleize(item.evidence?.purpose || 'evidence')} · {titleize(item.status)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#fff0d8] px-2.5 py-1 text-xs font-semibold text-[#8a4b0b]">
                  {titleize(item.assessment?.highestSeverity || item.assessment?.decision || 'review')}
                </span>
              </div>
              {item.reasonCodes?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.reasonCodes.map((reason) => (
                    <span key={reason} className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">{titleize(reason)}</span>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.evidence?.previewUrl ? (
                  <a href={item.evidence.previewUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg border border-stone-200 px-3 text-sm font-semibold text-[#164b38]">
                    <Eye size={15} aria-hidden="true" /> View evidence
                  </a>
                ) : <span className="text-xs text-stone-500">No preview attached</span>}
                {['open', 'in_review'].includes(item.status) ? (
                  <button
                    type="button"
                    aria-expanded={activeReviewId === item.id}
                    onClick={() => setActiveReviewId((current) => current === item.id ? '' : item.id)}
                    className="focus-ring inline-flex min-h-9 items-center rounded-lg bg-[#105338] px-3 text-sm font-semibold text-white"
                  >
                    {activeReviewId === item.id ? 'Close decision' : 'Review & decide'}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-stone-600">Decision: {titleize(item.decision || 'none')}</span>
                )}
              </div>
              {activeReviewId === item.id && ['open', 'in_review'].includes(item.status) ? (
                <div className="mt-4 space-y-3 border-t border-stone-200 pt-3">
                  <label className="block text-sm font-semibold text-stone-700">
                    Decision
                    <select
                      value={decisions[item.id] || ''}
                      onChange={(event) => setDecisions((current) => ({ ...current, [item.id]: event.target.value }))}
                      className="focus-ring mt-1 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium text-stone-800"
                    >
                      <option value="">Choose an action</option>
                      {reviewDecisions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    Reason for this decision
                    <textarea
                      value={notes[item.id] ?? 'Reviewed the uploaded media and privacy evidence.'}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      rows={2}
                      className="focus-ring mt-1 w-full min-w-0 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(busyId) || !decisions[item.id] || (notes[item.id] ?? 'Reviewed the uploaded media and privacy evidence.').trim().length < 3}
                    onClick={() => resolveCase({ ...item })}
                    className="focus-ring min-h-10 rounded-lg bg-stone-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === item.id ? 'Saving…' : 'Save decision'}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {!loading && isExpandable && !error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-[#f8faf8] px-4 py-3 sm:px-6">
          <p className="text-sm text-stone-600">
            {showAll ? `Showing ${items.length} of ${total}` : 'Showing the first reviews'}
          </p>
          <button
            type="button"
            onClick={() => { setShowAll((current) => !current); setActiveReviewId('') }}
            className={`focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#bcdccc] bg-white px-4 text-sm font-semibold text-[#115139] ${!showAll && total <= 6 ? 'sm:hidden' : ''}`}
          >
            {showAll ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            {showAll ? 'Show fewer' : `View all ${total} reviews`}
          </button>
        </div>
      ) : null}
    </section>
  )
}
