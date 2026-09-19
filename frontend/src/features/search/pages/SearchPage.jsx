import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  ArrowRight,
  Bot,
  Building2,
  ChefHat,
  CircleHelp,
  Leaf,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import FoodCopilotPanel from '../components/FoodCopilotPanel'

import SafeSponsoredPlacement from '../../expansionExecution/components/SafeSponsoredPlacement'

import {
  explainSearchDecision,
  getSearchErrorMessage,
  refineSmartSearch,
  runSmartSearch,
} from '../services/search.service'

const MODES =
  Object.freeze([
    {
      key:
        'all',

      label:
        'All',
    },

    {
      key:
        'recipe',

      label:
        'Recipes',
    },

    {
      key:
        'product',

      label:
        'Products',
    },

    {
      key:
        'ingredient',

      label:
        'Ingredients',
    },

    {
      key:
        'brand',

      label:
        'Brands',
    },
  ])

const EXAMPLES =
  Object.freeze([
    '20 min me 4 logon ke liye paneer aur spinach se dinner under 800',
    'South Indian breakfast in 20 minutes',
    'Use what I already have for dinner',
    'Vegetarian pasta dinner for 4',
  ])

const RESULT_ICONS = {
  recipe:
    ChefHat,

  product:
    Package,

  ingredient:
    Leaf,

  brand:
    Building2,
}

const UNRESOLVED_MESSAGES = {
  BUDGET_REQUIRES_COMMERCE_QUOTE:
    'Budget was captured, but M12 does not invent price truth. Final price, stock, fees and landed cost belong to M11 fulfillment comparison.',

  ONE_RETAILER_REQUIRES_M11_FULFILLMENT_COMPARE:
    'One-retailer intent was captured. M11 decides whether one Host organization can actually fulfill every requirement.',

  PANTRY_CONTEXT_REQUIRES_CUSTOMER:
    'Household Pantry context requires an authenticated Customer capability.',

  PANTRY_CONTEXT_REQUIRES_HOUSEHOLD:
    'No active Household is available for Pantry-aware search.',

  FOOD_SAFETY_EVIDENCE_UNAVAILABLE:
    'Some candidates were removed because governed food-safety evidence could not verify the hard constraint.',

  DIETARY_CONSTRAINT_NOT_VERIFIED:
    'Some candidates were removed because the requested dietary rule could not be verified.',

  ALLERGEN_FREE_STATUS_NOT_VERIFIED:
    'Some candidates were removed because EPANTRY could not verify the requested allergen-free status.',

  ALLERGEN_CONSTRAINT_VIOLATED:
    'Some candidates were removed because governed allergen evidence conflicted with the requested exclusion.',

  TIME_CONSTRAINT_VIOLATED:
    'Recipes outside the stated time limit were removed.',
}

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    amountMinor ===
      null ||
    amountMinor ===
      undefined ||
    !Number.isFinite(
      Number(
        amountMinor,
      ),
    )
  ) {
    return null
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        0,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}

function buildConstraintChips(
  constraints,
) {
  if (
    !constraints
  ) {
    return []
  }

  const chips = []

  if (
    constraints.maxTimeMinutes
  ) {
    chips.push(
      `${constraints.maxTimeMinutes} min max`,
    )
  }

  if (
    constraints.servings
  ) {
    chips.push(
      `Serve ${constraints.servings}`,
    )
  }

  if (
    constraints.budgetMinor !==
      null &&
    constraints.budgetMinor !==
      undefined
  ) {
    chips.push(
      `Budget ${formatMoney(
        constraints.budgetMinor,
        constraints.currency,
      )}`,
    )
  }

  if (
    constraints.course
  ) {
    chips.push(
      constraints.course,
    )
  }

  if (
    constraints.cuisine
  ) {
    chips.push(
      constraints.cuisine,
    )
  }

  for (
    const key
    of constraints.dietaryKeys ||
    []
  ) {
    chips.push(
      key,
    )
  }

  for (
    const key
    of constraints.excludedAllergens ||
    []
  ) {
    chips.push(
      `No ${key}`,
    )
  }

  if (
    constraints.usePantry
  ) {
    chips.push(
      'Use Pantry',
    )
  }

  if (
    constraints.commerceObjective ===
    'one_retailer'
  ) {
    chips.push(
      'One retailer',
    )
  }

  return chips
}

function ResultCard({
  result,
  onExplain,
  explanation,
  explanationLoading,
}) {
  const Icon =
    RESULT_ICONS[
      result.type
    ] ||
    Search

  return (
    <article className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-stone-950 text-white">
          <Icon
            size={20}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-600">
              {result.type}
            </span>

            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
              Organic
            </span>
          </div>

          <h2 className="mt-3 text-xl font-black tracking-tight text-stone-950">
            {result.displayName}
          </h2>

          {result.subtitle && (
            <p className="mt-1 text-sm font-semibold text-stone-500">
              {result.subtitle}
            </p>
          )}

          {result.type ===
            'recipe' &&
            result.meta?.totalTimeMinutes !==
              null &&
            result.meta?.totalTimeMinutes !==
              undefined && (
              <p className="mt-3 text-xs font-bold text-stone-500">
                Published recipe time:{' '}
                {result.meta.totalTimeMinutes}{' '}
                min
              </p>
            )}

          <div className="mt-4 flex flex-wrap gap-2">
            {(result.reasonCodes || [])
              .slice(
                0,
                4,
              )
              .map(
                (
                  code,
                ) => (
                  <span
                    key={
                      code
                    }
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-stone-600"
                  >
                    {code.replaceAll(
                      '_',
                      ' ',
                    )}
                  </span>
                ),
              )}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {result.path && (
              <Link
                to={
                  result.path
                }
                className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-stone-800"
              >
                Open

                <ArrowRight
                  size={15}
                  aria-hidden="true"
                />
              </Link>
            )}

            <button
              type="button"
              onClick={() =>
                onExplain(
                  result,
                )
              }
              disabled={
                explanationLoading
              }
              className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CircleHelp
                size={15}
                aria-hidden="true"
              />

              {explanationLoading
                ? 'Loading…'
                : 'Why this match?'}
            </button>
          </div>

          {explanation && (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-sky-800">
                Recorded decision explanation
              </p>

              <ul className="mt-2 space-y-2 text-sm leading-6 text-sky-950">
                {(explanation.reasons || []).map(
                  (
                    reason,
                  ) => (
                    <li
                      key={
                        reason.code
                      }
                    >
                      {reason.text}
                    </li>
                  ),
                )}
              </ul>

              <p className="mt-3 text-xs font-semibold leading-5 text-sky-700">
                {explanation.transparency?.statement}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default function SearchPage() {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams()

  const initialQuery =
    searchParams.get(
      'q',
    ) ||
    ''

  const initialMode =
    MODES.some(
      (
        item,
      ) =>
        item.key ===
        searchParams.get(
          'mode',
        ),
    )
      ? searchParams.get(
          'mode',
        )
      : 'all'

  const [
    query,
    setQuery,
  ] =
    useState(
      initialQuery,
    )

  const [
    mode,
    setMode,
  ] =
    useState(
      initialMode,
    )

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
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    refinement,
    setRefinement,
  ] =
    useState(
      '',
    )

  const [
    refining,
    setRefining,
  ] =
    useState(
      false,
    )

  const [
    explanations,
    setExplanations,
  ] =
    useState(
      {},
    )

  const [
    explanationLoadingKey,
    setExplanationLoadingKey,
  ] =
    useState(
      '',
    )

  const [
    copilotOpen,
    setCopilotOpen,
  ] =
    useState(
      false,
    )

  const [
    copilotSearchSession,
    setCopilotSearchSession,
  ] =
    useState(
      null,
    )

  const autoSearchStarted =
    useRef(
      false,
    )

  const constraintChips =
    useMemo(
      () =>
        buildConstraintChips(
          data?.session?.constraints,
        ),
      [
        data?.session?.constraints,
      ],
    )

  const unresolvedMessages =
    useMemo(
      () =>
        [
          ...new Set(
            data?.summary
              ?.unresolvedConstraintCodes ||
              [],
          ),
        ]
          .map(
            (
              code,
            ) =>
              UNRESOLVED_MESSAGES[
                code
              ] ||
              null,
          )
          .filter(
            Boolean,
          ),
      [
        data?.summary
          ?.unresolvedConstraintCodes,
      ],
    )

  async function executeSearch(
    nextQuery =
      query,
    nextMode =
      mode,
  ) {
    const normalized =
      String(
        nextQuery ||
        '',
      ).trim()

    if (
      normalized.length <
      2
    ) {
      setError(
        'Enter at least 2 characters to search.',
      )

      return
    }

    setLoading(
      true,
    )

    setError(
      '',
    )

    setExplanations(
      {},
    )

    try {
      const result =
        await runSmartSearch({
          query:
            normalized,

          mode:
            nextMode,
        })

      setData(
        result,
      )

      setCopilotSearchSession(
        result?.session ||
        null,
      )

      setSearchParams({
        q:
          normalized,

        mode:
          nextMode,
      })
    } catch (
      requestError
    ) {
      setError(
        getSearchErrorMessage(
          requestError,
        ),
      )
    } finally {
      setLoading(
        false,
      )
    }
  }

  useEffect(
    () => {
      if (
        autoSearchStarted.current ||
        initialQuery
          .trim()
          .length <
          2
      ) {
        return
      }

      autoSearchStarted.current =
        true

      executeSearch(
        initialQuery,
        initialMode,
      )
    },
    [],
  )

  async function handleSubmit(
    event,
  ) {
    event.preventDefault()

    await executeSearch()
  }

  async function handleRefine(
    event,
  ) {
    event.preventDefault()

    if (
      !data?.session?.id ||
      !data?.session?.token ||
      !refinement.trim()
    ) {
      return
    }

    setRefining(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await refineSmartSearch({
          sessionId:
            data.session.id,

          sessionToken:
            data.session.token,

          refinement,

          mode,
        })

      setData(
        result,
      )

      setCopilotSearchSession(
        result?.session ||
        null,
      )

      setQuery(
        result?.session?.query ||
        query,
      )

      setRefinement(
        '',
      )

      setExplanations(
        {},
      )
    } catch (
      requestError
    ) {
      setError(
        getSearchErrorMessage(
          requestError,

          'Unable to refine this Search session.',
        ),
      )
    } finally {
      setRefining(
        false,
      )
    }
  }

  async function handleExplain(
    result,
  ) {
    const key =
      `${result.type}:${result.id}`

    if (
      explanations[
        key
      ]
    ) {
      setExplanations(
        (
          current,
        ) => {
          const next = {
            ...current,
          }

          delete next[
            key
          ]

          return next
        },
      )

      return
    }

    setExplanationLoadingKey(
      key,
    )

    setError(
      '',
    )

    try {
      const explanation =
        await explainSearchDecision({
          sessionId:
            data.session.id,

          sessionToken:
            data.session.token,

          candidateType:
            result.type,

          candidateId:
            result.id,
        })

      setExplanations(
        (
          current,
        ) => ({
          ...current,

          [key]:
            explanation,
        }),
      )
    } catch (
      requestError
    ) {
      setError(
        getSearchErrorMessage(
          requestError,

          'Unable to explain this Search decision.',
        ),
      )
    } finally {
      setExplanationLoadingKey(
        '',
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell py-7 sm:py-10">
        <section className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-sm">
          <div className="grid gap-7 bg-stone-950 p-7 text-white sm:p-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <Search
                  size={18}
                  aria-hidden="true"
                />

                <p className="text-xs font-black uppercase tracking-[0.15em]">
                  M12 · P02 Smart Search
                </p>
              </div>

              <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
                Search food intent, not just keywords.
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300 sm:text-base">
                Search remains deterministic. Recipe, Product, Pantry and Food Intelligence truth still comes from the frozen domain services. AI is not required for this Search to work.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-stone-800 bg-stone-900 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-400"
                    aria-hidden="true"
                  />

                  <div>
                    <p className="font-black">
                      Safety boundary
                    </p>

                    <p className="mt-1 text-xs leading-5 text-stone-400">
                      Hard dietary and allergen constraints fail closed when governed evidence cannot verify them. No result is better than a fabricated safe result.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCopilotOpen(
                    true,
                  )
                }
                className="flex w-full items-center justify-between rounded-[20px] bg-emerald-500 px-4 py-3.5 text-left text-stone-950 transition hover:bg-emerald-400"
              >
                <div className="flex items-center gap-3">
                  <Bot
                    size={20}
                    aria-hidden="true"
                  />

                  <div>
                    <p className="text-sm font-black">
                      Open Food Copilot
                    </p>

                    <p className="mt-0.5 text-[11px] font-semibold text-emerald-950/70">
                      Conversational layer over EPANTRY tools
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={17}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <form
            onSubmit={
              handleSubmit
            }
            className="p-5 sm:p-7"
          >
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />

                <input
                  type="search"
                  value={
                    query
                  }
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. 20 min me paneer aur spinach se dinner for 4"
                  className="focus-ring min-h-14 w-full rounded-2xl border border-stone-300 bg-stone-50 py-3 pl-11 pr-4 text-sm font-bold text-stone-950 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={
                  loading
                }
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={17}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                  aria-hidden="true"
                />

                {loading
                  ? 'Searching…'
                  : 'Search EPANTRY'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {MODES.map(
                (
                  item,
                ) => (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    onClick={() => {
                      setMode(
                        item.key,
                      )

                      if (
                        data
                      ) {
                        executeSearch(
                          query,
                          item.key,
                        )
                      }
                    }}
                    className={[
                      'rounded-full border px-3 py-1.5 text-xs font-black transition',

                      mode ===
                      item.key
                        ? 'border-stone-950 bg-stone-950 text-white'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-400',
                    ].join(
                      ' ',
                    )}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>

            <div className="mt-5 border-t border-stone-200 pt-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                Try a documented intent
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {EXAMPLES.map(
                  (
                    example,
                  ) => (
                    <button
                      key={
                        example
                      }
                      type="button"
                      onClick={() => {
                        setQuery(
                          example,
                        )

                        executeSearch(
                          example,
                          mode,
                        )
                      }}
                      className="rounded-xl bg-stone-100 px-3 py-2 text-left text-xs font-bold text-stone-700 transition hover:bg-stone-200"
                    >
                      {example}
                    </button>
                  ),
                )}
              </div>
            </div>
          </form>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {data && (
          <>
            <section className="mt-5 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-emerald-700">
                    Parsed Search intent
                  </p>

                  <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
                    {data.summary?.total || 0}{' '}
                    trustworthy result
                    {Number(
                      data.summary?.total ||
                        0,
                    ) ===
                    1
                      ? ''
                      : 's'}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Deterministic ranking · AI used: no · Price or stock claimed: no
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCopilotOpen(
                        true,
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white transition hover:bg-emerald-800"
                  >
                    <Bot
                      size={16}
                      aria-hidden="true"
                    />

                    Ask Food Copilot
                  </button>

                  <Link
                    to="/recipes/what-should-we-cook"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-black text-stone-700 transition hover:bg-stone-50"
                  >
                    <ChefHat
                      size={16}
                      aria-hidden="true"
                    />

                    Open What Should We Cook?
                  </Link>
                </div>
              </div>

              {constraintChips.length >
                0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {constraintChips.map(
                    (
                      chip,
                    ) => (
                      <span
                        key={
                          chip
                        }
                        className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800"
                      >
                        {chip}
                      </span>
                    ),
                  )}
                </div>
              )}

              {(data.resolvedEntities?.ingredients || [])
                .length >
                0 && (
                <p className="mt-4 text-xs font-semibold text-stone-500">
                  Canonical ingredients resolved:{' '}
                  {data.resolvedEntities.ingredients
                    .map(
                      (
                        item,
                      ) =>
                        item.name,
                    )
                    .join(
                      ', ',
                    )}
                </p>
              )}
            </section>

            {unresolvedMessages.length >
              0 && (
              <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <TriangleAlert
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />

                  <div>
                    <h2 className="font-black text-amber-950">
                      Constraint transparency
                    </h2>

                    <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900">
                      {unresolvedMessages.map(
                        (
                          message,
                        ) => (
                          <li
                            key={
                              message
                            }
                          >
                            {message}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {data.session?.id && (
              <section className="mt-5 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                  Refine this Search session
                </p>

                <form
                  onSubmit={
                    handleRefine
                  }
                  className="mt-3 flex flex-col gap-3 sm:flex-row"
                >
                  <input
                    type="text"
                    value={
                      refinement
                    }
                    onChange={(
                      event,
                    ) =>
                      setRefinement(
                        event.target.value,
                      )
                    }
                    placeholder='Try “quicker”, “less spicy”, “use my pantry” or “one retailer only”'
                    className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-4 text-sm font-bold outline-none"
                  />

                  <button
                    type="submit"
                    disabled={
                      refining ||
                      !refinement.trim()
                    }
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {refining
                      ? 'Refining…'
                      : 'Refine'}
                  </button>
                </form>
              </section>
            )}

            {(data.results || []).length ===
            0 ? (
              <section className="mt-5 rounded-[28px] border border-dashed border-stone-300 bg-white p-9 text-center">
                <TriangleAlert
                  size={34}
                  className="mx-auto text-stone-400"
                  aria-hidden="true"
                />

                <h2 className="mt-3 text-xl font-black text-stone-950">
                  No trustworthy match found
                </h2>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-500">
                  EPANTRY returns no result instead of fabricating a Product, Recipe or safety claim.
                </p>

                <div className="mx-auto mt-5 max-w-xl space-y-2 text-left text-sm font-semibold text-stone-600">
                  {(data.suggestions || []).map(
                    (
                      suggestion,
                    ) => (
                      <p
                        key={
                          suggestion
                        }
                        className="rounded-xl bg-stone-50 px-4 py-3"
                      >
                        {suggestion}
                      </p>
                    ),
                  )}
                </div>
              </section>
            ) : (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {(data.results || []).map(
                  (
                    result,
                  ) => {
                    const key =
                      `${result.type}:${result.id}`

                    return (
                      <ResultCard
                        key={
                          key
                        }
                        result={
                          result
                        }
                        onExplain={
                          handleExplain
                        }
                        explanation={
                          explanations[
                            key
                          ] ||
                          null
                        }
                        explanationLoading={
                          explanationLoadingKey ===
                          key
                        }
                      />
                    )
                  },
                )}
              </section>
            )}
          </>
        )}

        {data?.session?.id ? (
          <SafeSponsoredPlacement
            searchSessionId={data.session.id}
            placement="search"
          />
        ) : null}
      </div>

      <FoodCopilotPanel
        open={
          copilotOpen
        }
        onClose={() =>
          setCopilotOpen(
            false,
          )
        }
        searchSession={
          copilotSearchSession
        }
        onSearchSessionChange={
          setCopilotSearchSession
        }
      />
    </main>
  )
}