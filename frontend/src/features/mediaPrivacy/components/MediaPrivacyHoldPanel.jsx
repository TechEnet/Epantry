import {
  EyeOff,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from 'lucide-react'

import { useState } from 'react'

import {
  getMediaPrivacyErrorMessage,
  recheckMediaPrivacy,
  requestMediaCleanup,
  requestMediaRedaction,
} from '../services/mediaPrivacy.service'

function titleize(value) {
  return String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export default function MediaPrivacyHoldPanel({
  holds = [],
  scope = 'customer',
  onChanged,
}) {
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  if (!holds.length) {
    return null
  }

  async function run(imageEvidenceId, action) {
    setBusyId(imageEvidenceId)
    setNotice('')
    setError('')

    try {
      await action()
      setNotice('Privacy action recorded. Product intelligence remains paused until the media is cleared.')
      await onChanged?.()
    } catch (requestError) {
      setError(
        getMediaPrivacyErrorMessage(
          requestError,
          'Unable to update the privacy state.',
        ),
      )
    } finally {
      setBusyId('')
    }
  }

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
          <ShieldAlert size={20} aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-base font-black text-amber-950">
            Upload paused for privacy protection
          </h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900/80">
            These images are not being used for product extraction while privacy review is pending. EPANTRY does not store raw OCR text or face embeddings from this screening step.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {holds.map((hold) => {
          const assessment = hold.assessment || {}
          const reviewCase = hold.reviewCase || {}
          const operations = Array.isArray(hold.suggestedRedactions)
            ? hold.suggestedRedactions
            : []
          const imageEvidenceId = hold.imageEvidenceId
          const isBusy = busyId === imageEvidenceId

          return (
            <div
              key={imageEvidenceId}
              className="rounded-2xl border border-amber-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">
                    {titleize(assessment.decision || 'needs_review')}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    Review: {titleize(reviewCase.status || 'pending')}
                  </p>
                </div>

                {assessment.highestSeverity ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase text-amber-800">
                    {assessment.highestSeverity} risk
                  </span>
                ) : null}
              </div>

              {assessment.reasonCodes?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {assessment.reasonCodes.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600"
                    >
                      {titleize(reason)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {operations.length && assessment.id ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      run(imageEvidenceId, () =>
                        requestMediaRedaction({
                          imageEvidenceId,
                          assessmentId: assessment.id,
                          operations,
                          scope,
                        }),
                      )
                    }
                    className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    <EyeOff size={15} aria-hidden="true" />
                    Request redaction
                  </button>
                ) : null}

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    run(imageEvidenceId, () =>
                      recheckMediaPrivacy(imageEvidenceId, scope),
                    )
                  }
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Recheck
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Request cleanup of this uploaded media? The request is governed by retention policy and is not an instant destructive delete.',
                      )
                    ) {
                      run(imageEvidenceId, () =>
                        requestMediaCleanup(imageEvidenceId, scope),
                      )
                    }
                  }}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Request cleanup
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 min-h-5 text-xs font-bold" aria-live="polite">
        {error ? (
          <p className="text-red-700">{error}</p>
        ) : notice ? (
          <p className="text-emerald-700">{notice}</p>
        ) : (
          <p className="text-amber-800">
            You can also remove the local image and upload a cropped version that contains only the package label.
          </p>
        )}
      </div>
    </section>
  )
}
