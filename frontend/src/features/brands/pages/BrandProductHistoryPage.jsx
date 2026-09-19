import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  History,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import EmptyState from '../../../components/common/EmptyState'

import {
  getBrandProductHistory,
} from '../services/brandAuthority.service'

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to load Product history.'
  )
}

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
    return String(
      value,
    )
  }

  return date.toLocaleString()
}

export default function BrandProductHistoryPage() {
  const {
    brandKey,
    packId,
  } =
    useParams()

  const [
    data,
    setData,
  ] =
    useState(null)

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState(null)

  useEffect(
    () => {
      let active =
        true

      async function load() {
        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          const result =
            await getBrandProductHistory(
              brandKey,
              packId,
            )

          if (active) {
            setData(
              result,
            )
          }
        } catch (requestError) {
          if (active) {
            setError(
              getErrorMessage(
                requestError,
              ),
            )
          }
        } finally {
          if (active) {
            setLoading(
              false,
            )
          }
        }
      }

      load()

      return () => {
        active =
          false
      }
    },
    [
      brandKey,
      packId,
    ],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-12">
          <div className="h-[420px] animate-pulse rounded-[28px] border border-stone-200 bg-white" />
        </div>
      </main>
    )
  }

  if (
    error ||
    !data
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-12">

          <EmptyState
            title="History unavailable"
            description={
              error ||
              'Product version history could not be loaded.'
            }
          />

        </div>
      </main>
    )
  }

  const history =
    data.history ||
    []

  return (
    <main className="min-h-screen bg-[#f7f5ef]">

      <section className="border-b border-stone-200 bg-white">

        <div className="page-shell py-9">

          <Link
            to={`/brands/${encodeURIComponent(
              brandKey,
            )}`}
            className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-500"
          >
            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            Brand World
          </Link>


          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">

            <History
              size={13}
              aria-hidden="true"
            />

            Canonical version timeline

          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950">
            {
              data.product
                ?.familyName ||
              'Product History'
            }
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            {
              [
                data.product
                  ?.variantName,
                data.product
                  ?.packName,
              ]
                .filter(
                  Boolean,
                )
                .join(
                  ' · ',
                )
            }
          </p>

        </div>

      </section>


      <div className="page-shell py-8">

        {history.length ===
        0 ? (
          <EmptyState
            title="No public history available"
            description="Published and retired canonical versions will appear here."
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">

            {history.map(
              (
                version,
                index,
              ) => (
                <article
                  key={
                    version.id
                  }
                  className="relative rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
                >

                  <div className="flex items-start gap-4">

                    <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">

                      {index ===
                      0 ? (
                        <CheckCircle2
                          size={20}
                          aria-hidden="true"
                        />
                      ) : (
                        <Clock3
                          size={20}
                          aria-hidden="true"
                        />
                      )}

                    </div>


                    <div className="min-w-0 flex-1">

                      <div className="flex flex-wrap items-center gap-2">

                        <h2 className="font-black text-stone-950">
                          Version {
                            version.versionNumber ??
                            '—'
                          }
                        </h2>

                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-600">
                          {version.status}
                        </span>

                      </div>


                      <p className="mt-3 text-sm leading-6 text-stone-500">
                        {
                          version.changeReason ||
                          'No public change summary recorded.'
                        }
                      </p>


                      <div className="mt-4 grid gap-2 text-xs font-semibold text-stone-400 sm:grid-cols-2">

                        <p>
                          Effective:{' '}
                          {
                            formatDate(
                              version.effectiveFrom,
                            )
                          }
                        </p>

                        <p>
                          Published:{' '}
                          {
                            formatDate(
                              version.publishedAt,
                            )
                          }
                        </p>

                      </div>

                    </div>

                  </div>

                </article>
              ),
            )}

          </div>
        )}

      </div>

    </main>
  )
}