import {
  ArrowLeft,
  History,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  getPublicRecipeHistory,
} from '../services/recipe.service'

function formatDate(
  value,
) {
  if (!value) {
    return 'Not recorded'
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Not recorded'
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        'medium',
    },
  ).format(
    date,
  )
}

function statusClass(
  status,
) {
  if (
    status ===
    'published'
  ) {
    return 'bg-emerald-50 text-emerald-800'
  }

  if (
    status ===
    'retired'
  ) {
    return 'bg-stone-100 text-stone-700'
  }

  return 'bg-amber-50 text-amber-800'
}

export default function RecipeHistoryPage() {
  const {
    slug,
  } =
    useParams()

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    error,
    setError,
  ] =
    useState(
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
          setData(
            await getPublicRecipeHistory(
              slug,
              50,
            ),
          )
        } catch (loadError) {
          setError(
            loadError?.message ||
            'Unable to load recipe history.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        slug,
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

  return (
    <main className="min-h-screen bg-[#f7f5ef]">

      <div className="page-shell py-8 sm:py-10">

        <Link
          to={
            `/recipes/${slug}`
          }
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to recipe
        </Link>

        <div className="mt-3 rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">

          <div className="flex items-start gap-4">

            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <History
                size={23}
                aria-hidden="true"
              />
            </div>

            <div>

              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Recipe governance
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">
                {
                  data?.dish?.name ||
                  'Recipe'
                } history
              </h1>

              <p className="mt-2 text-sm leading-6 text-stone-500">
                Public history preserves published and retired versions rather
                than silently rewriting previous recipe truth.
              </p>

            </div>

          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {
                error
              }
            </div>
          )}

          {loading ? (
            <div className="mt-7 h-64 animate-pulse rounded-2xl bg-stone-100" />
          ) : (
            <div className="mt-7 space-y-3">

              {(data?.versions || []).map(
                (
                  version,
                ) => (
                  <article
                    key={
                      version.id
                    }
                    className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-3">

                      <div>

                        <h2 className="text-lg font-black text-stone-950">
                          Version {
                            version.versionNumber
                          }
                        </h2>

                        <p className="mt-1 text-sm font-semibold text-stone-600">
                          {
                            version.title
                          }
                        </p>

                      </div>

                      <span
                        className={[
                          'rounded-full',
                          'px-3',
                          'py-1',
                          'text-[10px]',
                          'font-black',
                          'uppercase',
                          'tracking-[0.12em]',
                          statusClass(
                            version.status,
                          ),
                        ].join(
                          ' ',
                        )}
                      >
                        {
                          version.status
                        }
                      </span>

                    </div>

                    {version.changeReason && (
                      <p className="mt-4 text-sm leading-6 text-stone-600">
                        {
                          version.changeReason
                        }
                      </p>
                    )}

                    <div className="mt-4 grid gap-2 text-xs text-stone-500 sm:grid-cols-3">

                      <div>
                        <span className="font-black text-stone-700">
                          Published:
                        </span>{' '}
                        {
                          formatDate(
                            version.publishedAt,
                          )
                        }
                      </div>

                      <div>
                        <span className="font-black text-stone-700">
                          Effective:
                        </span>{' '}
                        {
                          formatDate(
                            version.effectiveFrom,
                          )
                        }
                      </div>

                      <div>
                        <span className="font-black text-stone-700">
                          Ended:
                        </span>{' '}
                        {
                          formatDate(
                            version.effectiveTo,
                          )
                        }
                      </div>

                    </div>

                  </article>
                ),
              )}

              {(data?.versions || [])
                .length ===
                0 && (
                <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
                  No public Recipe Version history is available.
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </main>
  )
}