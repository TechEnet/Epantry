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
    <main className="w-full px-4 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-8">
      <div className="w-full max-w-none">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-stone-950">
              Privacy Rights Center
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-stone-600">
              Request a governed data export or account deletion review.
              Requests are evaluated against current consent and effective
              retention policies before any action is completed.
            </p>
          </div>

          <button
            type="button"
            onClick={
              load
            }
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-bold text-stone-700"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            Refresh
          </button>
        </div>

        <div
          className="mt-5 min-h-6 text-sm font-semibold"
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

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            <Download
              className="text-emerald-700"
              size={24}
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-black text-stone-950">
              Data export
            </h2>

            <p className="mt-2 text-sm font-medium leading-6 text-stone-600">
              Ask for an access/export package of eligible account information.
              Export generation is a controlled workflow and may require
              additional processing before an artifact becomes available.
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
              className="focus-ring mt-5 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting ===
              'access_export'
                ? 'Submitting…'
                : 'Request data export'}
            </button>
          </article>

          <article className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            <Trash2
              className="text-amber-700"
              size={24}
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-black text-stone-950">
              Account deletion
            </h2>

            <p className="mt-2 text-sm font-medium leading-6 text-stone-600">
              Ask EPANTRY to review eligible account data for deletion,
              anonymization or restriction. Legal, security, financial,
              audit or other immutable records may remain under applicable
              retention rules.
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
              className="focus-ring mt-5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
            >
              {submitting ===
              'deletion'
                ? 'Submitting…'
                : 'Request deletion review'}
            </button>
          </article>
        </section>

        <section className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex gap-3">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-emerald-700"
              size={20}
              aria-hidden="true"
            />

            <div>
              <h2 className="text-sm font-black text-emerald-950">
                Retention is policy-controlled
              </h2>

              <p className="mt-1 text-sm font-medium leading-6 text-emerald-900/80">
                A deletion request is not a blind database cascade.
                The request stores the effective retention decisions used
                for review, while M02 remains the consent source of truth.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-stone-950">
                Your requests
              </h2>

              <p className="mt-1 text-xs font-semibold text-stone-500">
                Current workflow status and retention decision snapshots.
              </p>
            </div>

            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-600">
              {requests.length}
            </span>
          </div>

          {loading ? (
            <p className="mt-5 text-sm font-semibold text-stone-500">
              Loading privacy requests…
            </p>
          ) : requests.length ? (
            <div className="mt-5 space-y-3">
              {requests.map(
                (
                  request,
                ) => (
                  <article
                    key={
                      request.id
                    }
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          {titleize(
                            request.requestType,
                          )}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-stone-500">
                          {request.requestId}
                          {' · '}
                          {formatDate(
                            request.requestedAt,
                          )}
                        </p>
                      </div>

                      <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-stone-600">
                        {titleize(
                          request.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-stone-500">
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
            <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
              No privacy requests have been submitted yet.
            </p>
          )}
        </section>

        {context
          ?.consentSnapshot ? (
          <p className="mt-4 text-xs font-medium text-stone-400">
            Consent context loaded from the existing M02 consent authority.
          </p>
        ) : null}

      </div>
    </main>
  )
}