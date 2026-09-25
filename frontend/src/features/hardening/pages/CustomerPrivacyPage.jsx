import {
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  createPrivacyRequest,
  getHardeningErrorMessage,
  getPrivacyContext,
  listOwnPrivacyRequests,
} from '../services/hardening.service'

function formatDate(
  value,
) {
  if (!value) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short',
    },
  ).format(
    new Date(
      value,
    ),
  )
}

function titleize(
  value,
) {
  return String(
    value ||
      '',
  )
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

export default function CustomerPrivacyPage() {
  const [
    context,
    setContext,
  ] = useState(
    null,
  )

  const [
    requests,
    setRequests,
  ] = useState(
    [],
  )

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  )

  const [
    submitting,
    setSubmitting,
  ] = useState(
    '',
  )

  const [
    notice,
    setNotice,
  ] = useState(
    '',
  )

  const [
    error,
    setError,
  ] = useState(
    '',
  )

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const [
            contextResult,
            requestResult,
          ] =
            await Promise.all([
              getPrivacyContext(),

              listOwnPrivacyRequests(),
            ])

          setContext(
            contextResult,
          )

          setRequests(
            requestResult
              ?.privacyRequests ||
              [],
          )
        } catch (
          requestError
        ) {
          setError(
            getHardeningErrorMessage(
              requestError,
              'Unable to load privacy information.',
            ),
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  async function submit(
    requestType,
  ) {
    setSubmitting(
      requestType,
    )

    setError(
      '',
    )

    setNotice(
      '',
    )

    try {
      const result =
        await createPrivacyRequest({
          requestType,

          scope:
            'account',
        })

      setNotice(
        result?.deduplicated
          ? 'An open request already exists, so the existing governed request was returned.'
          : 'Your privacy request was submitted for governed review.',
      )

      await load()
    } catch (
      requestError
    ) {
      setError(
        getHardeningErrorMessage(
          requestError,
          'Unable to submit the privacy request. A recent sign-in may be required.',
        ),
      )
    } finally {
      setSubmitting(
        '',
      )
    }
  }

  return (
    <main className="w-full px-4 pb-6 pt-3 sm:px-6 sm:pb-7 sm:pt-4 lg:px-8">
      <div className="w-full max-w-none">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-stone-950 sm:text-[26px]">
              Privacy Rights Center
            </h1>

            <p className="mt-2 max-w-3xl text-xs font-medium leading-5 text-stone-600 sm:text-[13px]">
              Request an export or deletion review. EPANTRY checks consent and retention rules first.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            className="focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 sm:text-[13px]"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            Refresh
          </button>
        </div>

        <div
          className="mt-3 min-h-5 text-xs font-semibold sm:text-[13px]"
          aria-live="polite"
        >
          {error ? (
            <p className="text-red-700">
              {error}
            </p>
          ) : notice ? (
            <p className="text-emerald-700">
              {notice}
            </p>
          ) : null}
        </div>

        <section className="mt-3 grid gap-3 md:grid-cols-2">
          <article className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <Download
              className="text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <h2 className="mt-3 text-base font-black text-stone-950 sm:text-[17px]">
              Data export
            </h2>

            <p className="mt-1.5 text-xs font-medium leading-5 text-stone-600 sm:text-[13px]">
              Get a copy of eligible account data. We’ll prepare it securely and notify you when it’s ready.
            </p>

            <button
              type="button"
              disabled={
                Boolean(
                  submitting,
                )
              }
              onClick={() =>
                submit(
                  'access_export',
                )
              }
              className="focus-ring mt-3 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50 sm:text-[13px]"
            >
              {submitting ===
              'access_export'
                ? 'Submitting…'
                : 'Request data export'}
            </button>
          </article>

          <article className="rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <Trash2
              className="text-amber-700"
              size={20}
              aria-hidden="true"
            />

            <h2 className="mt-3 text-base font-black text-stone-950 sm:text-[17px]">
              Account deletion
            </h2>

            <p className="mt-1.5 text-xs font-medium leading-5 text-stone-600 sm:text-[13px]">
              Request deletion or restriction of eligible data. Required legal or financial records may remain.
            </p>

            <button
              type="button"
              disabled={
                Boolean(
                  submitting,
                )
              }
              onClick={() =>
                submit(
                  'deletion',
                )
              }
              className="focus-ring mt-3 rounded-xl bg-stone-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50 sm:text-[13px]"
            >
              {submitting ===
              'deletion'
                ? 'Submitting…'
                : 'Request deletion review'}
            </button>
          </article>
        </section>

        <section className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex gap-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <div className="min-w-0">
              <h2 className="text-[13px] font-black text-emerald-950 sm:text-sm">
                Retention is policy-controlled
              </h2>

              <p className="mt-1 text-xs font-medium leading-5 text-emerald-900/80 sm:text-[13px]">
                Deletion follows retention rules, not a full database wipe. Your consent settings stay authoritative.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[20px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-stone-950 sm:text-[17px]">
                Your requests
              </h2>

              <p className="mt-1 text-[11px] font-semibold text-stone-500 sm:text-xs">
                Current workflow status and retention decision snapshots.
              </p>
            </div>

            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-black text-stone-600 sm:text-xs">
              {requests.length}
            </span>
          </div>

          {loading ? (
            <p className="mt-4 text-xs font-semibold text-stone-500 sm:text-[13px]">
              Loading privacy requests…
            </p>
          ) : requests.length ? (
            <div className="mt-4 space-y-2.5">
              {requests.map(
                (
                  request,
                ) => (
                  <article
                    key={
                      request.id
                    }
                    className="rounded-2xl border border-stone-200 p-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-black text-stone-950 sm:text-sm">
                          {titleize(
                            request.requestType,
                          )}
                        </p>

                        <p className="mt-1 text-[11px] font-semibold text-stone-500 sm:text-xs">
                          {request.requestId}
                          {' · '}
                          {formatDate(
                            request.requestedAt,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 sm:text-[10px]">
                        {titleize(
                          request.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-2.5 text-[11px] font-semibold text-stone-500 sm:text-xs">
                      Retention decisions:{' '}
                      {request
                        .retentionEvaluation
                        ?.length ||
                        0}
                      {' · '}
                      Export artifact:{' '}
                      {titleize(
                        request
                          .exportArtifactStatus,
                      )}
                    </p>
                  </article>
                ),
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-stone-50 p-3.5 text-xs font-semibold text-stone-500 sm:text-[13px]">
              No privacy requests have been submitted yet.
            </p>
          )}
        </section>

        {context
          ?.consentSnapshot ? (
          <p className="mt-3 text-[11px] font-medium text-stone-400 sm:text-xs">
            Consent context loaded from the existing M02 consent authority.
          </p>
        ) : null}

      </div>
    </main>
  )
}