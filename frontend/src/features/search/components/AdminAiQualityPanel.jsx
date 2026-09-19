import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Bot,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import {
  getSearchAiQuality,
} from '../services/searchAdmin.service'

function formatDate(
  value,
) {
  if (
    !value
  ) {
    return '—'
  }

  const date =
    new Date(
      value,
    )

  return Number.isNaN(
    date.getTime(),
  )
    ? '—'
    : date.toLocaleString()
}

function StatusBadge({
  status,
}) {
  const className =
    status ===
    'succeeded'
      ? 'bg-emerald-100 text-emerald-800'
      : status ===
        'fallback'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-rose-100 text-rose-800'

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${className}`}
    >
      {status || 'unknown'}
    </span>
  )
}

export default function AdminAiQualityPanel() {
  const [
    data,
    setData,
  ] =
    useState(null)

  const [
    status,
    setStatus,
  ] =
    useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState('')

  const load =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          setData(
            await getSearchAiQuality({
              page:
                1,

              limit:
                25,

              status,
            }),
          )
        } catch (
          requestError
        ) {
          setError(
            requestError?.response?.data?.message ||
              requestError?.message ||
              'Unable to load Search/AI quality data.',
          )
        } finally {
          setLoading(false)
        }
      },
      [
        status,
      ],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  const summary =
    data?.summary ||
    {
      succeeded:
        0,

      fallback:
        0,

      failed:
        0,

      total:
        0,
    }

  return (
    <section
      id="ai-quality"
      className="mt-6 overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-sm"
    >
      <header className="flex flex-col gap-4 border-b border-stone-200 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Bot
              size={18}
              aria-hidden="true"
            />

            <p className="text-xs font-black uppercase tracking-[0.13em]">
              A21 · AI Extraction / Model Quality Queue
            </p>
          </div>

          <h2 className="mt-2 text-xl font-black text-stone-950">
            Food Copilot operational quality
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Metadata-only review of model ID, prompt version, tool usage, fallback/error state, latency and token usage. Raw customer prompts are intentionally not shown or persisted here.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-black text-stone-700 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
            aria-hidden="true"
          />

          Refresh
        </button>
      </header>

      <div className="grid gap-px bg-stone-200 sm:grid-cols-4">
        {[
          [
            'Total',
            summary.total,
          ],
          [
            'Succeeded',
            summary.succeeded,
          ],
          [
            'Fallback',
            summary.fallback,
          ],
          [
            'Failed',
            summary.failed,
          ],
        ].map(
          ([
            label,
            value,
          ]) => (
            <div
              key={label}
              className="bg-stone-50 p-4"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                {label}
              </p>

              <p className="mt-1 text-2xl font-black text-stone-950">
                {value || 0}
              </p>
            </div>
          ),
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {[
            [
              '',
              'All',
            ],
            [
              'succeeded',
              'Succeeded',
            ],
            [
              'fallback',
              'Fallback',
            ],
            [
              'failed',
              'Failed',
            ],
          ].map(
            ([
              key,
              label,
            ]) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setStatus(key)
                }
                className={[
                  'rounded-full border px-3 py-1.5 text-xs font-black',

                  status ===
                  key
                    ? 'border-stone-950 bg-stone-950 text-white'
                    : 'border-stone-200 text-stone-600',
                ].join(' ')}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            {error}
          </div>
        )}

        {!error &&
          !loading &&
          (data?.items || []).length ===
            0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
              No Food Copilot quality records match this filter yet.
            </div>
          )}

        <div className="mt-4 space-y-3">
          {(data?.items || []).map(
            (
              item,
            ) => (
              <article
                key={item.id}
                className="rounded-[20px] border border-stone-200 bg-stone-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={item.status}
                      />

                      <span className="text-xs font-bold text-stone-500">
                        {item.actorType}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-black text-stone-950">
                      {item.modelId || 'Model unavailable'}
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      Prompt {item.promptVersion || '—'} · {formatDate(item.recordedAt)}
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-stone-500 sm:text-right">
                    <p>
                      Latency: {item.latencyMs ?? '—'} ms
                    </p>

                    <p className="mt-1">
                      Confidence: {item.confidence ?? '—'}
                    </p>
                  </div>
                </div>

                {(item.toolNames || []).length >
                  0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.toolNames.map(
                      (
                        tool,
                      ) => (
                        <span
                          key={tool}
                          className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-stone-600"
                        >
                          {tool}
                        </span>
                      ),
                    )}
                  </div>
                )}

                {(item.fallbackCode || item.errorCode) && (
                  <p className="mt-3 text-xs font-semibold text-amber-800">
                    {item.fallbackCode || item.errorCode}
                  </p>
                )}
              </article>
            ),
          )}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs leading-5 text-sky-900">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          A21 is permission-gated by M03 `AdminAssignment → AdminRole → permissionKeys`. Super Admin receives deployed permissions through the same resolver; Host/Customer mode is never admin authorization.
        </div>
      </div>
    </section>
  )
}