import {
  Eye,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'

import { useCallback, useEffect, useState } from 'react'

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

export default function MediaPrivacyReviewQueue() {
  const [status, setStatus] = useState('open')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [decision, setDecision] = useState('safe_to_use')
  const [note, setNote] = useState('Reviewed under M24 upload privacy safeguards.')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await listAdminMediaPrivacyReviews({
        status,
        limit: 30,
      })
      setItems(data?.reviewCases || [])
    } catch (requestError) {
      setError(
        getMediaPrivacyErrorMessage(
          requestError,
          'Unable to load the media privacy review queue.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  async function resolveCase(item) {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      await resolveAdminMediaPrivacyReview({
        privacyReviewCaseId: item.id,
        decision,
        resolutionNote: note,
      })
      setNotice('Media privacy review resolved and audit evidence recorded.')
      await load()
    } catch (requestError) {
      setError(
        getMediaPrivacyErrorMessage(
          requestError,
          'Unable to resolve the media privacy review.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <ShieldAlert size={19} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-black text-stone-950">
              M24 media privacy review
            </h2>
            <p className="mt-1 text-xs font-semibold text-stone-500">
              Review only privacy-risk evidence. Product truth and label extraction remain paused until clearance.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
          >
            {['open', 'in_review', 'resolved', 'cancelled', 'all'].map((value) => (
              <option key={value} value={value}>
                {titleize(value)}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={load}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 min-h-5 text-xs font-bold" aria-live="polite">
        {error ? <p className="text-red-700">{error}</p> : null}
        {!error && notice ? <p className="text-emerald-700">{notice}</p> : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm font-semibold text-stone-500">Loading privacy review queue…</p>
      ) : items.length ? (
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-stone-950">
                    {item.owner?.email || item.owner?.id || 'Customer media'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    {titleize(item.evidence?.purpose || 'evidence')} · {titleize(item.status)}
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                  {titleize(item.assessment?.highestSeverity || item.assessment?.decision || 'review')}
                </span>
              </div>

              {item.evidence?.previewUrl ? (
                <a
                  href={item.evidence.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700"
                >
                  <Eye size={15} aria-hidden="true" />
                  Open protected evidence
                </a>
              ) : null}

              {item.reasonCodes?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.reasonCodes.map((reason) => (
                    <span key={reason} className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">
                      {titleize(reason)}
                    </span>
                  ))}
                </div>
              ) : null}

              {['open', 'in_review'].includes(item.status) ? (
                <div className="mt-4 space-y-2">
                  <select
                    value={decision}
                    onChange={(event) => setDecision(event.target.value)}
                    className="focus-ring w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
                  >
                    {[
                      'safe_to_use',
                      'redaction_required',
                      'reupload_required',
                      'delete_media',
                    ].map((value) => (
                      <option key={value} value={value}>
                        {titleize(value)}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    className="focus-ring w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                  />

                  <button
                    type="button"
                    disabled={busy || note.trim().length < 3}
                    onClick={() => resolveCase(item)}
                    className="focus-ring rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Resolve review
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs font-bold text-stone-500">
                  Decision: {titleize(item.decision || 'none')}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
          No media privacy review cases in this queue.
        </p>
      )}
    </section>
  )
}
