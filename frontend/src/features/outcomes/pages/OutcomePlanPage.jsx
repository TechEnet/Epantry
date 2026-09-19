import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChefHat,
  CircleHelp,
  ClipboardList,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Scale,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  createOutcomePlanIdempotencyKey,
  getOutcomePlan,
  getOutcomePlanErrorMessage,
  updateOutcomePlanRequirements,
} from '../services/outcomePlan.service'

const GROUPS =
  Object.freeze([
    {
      key:
        'needed',

      label:
        'Needed',

      description:
        'Confirmed genuine shortages that become purchase requirements.',

      icon:
        ShoppingBasket,
    },

    {
      key:
        'already_have',

      label:
        'Already Have',

      description:
        'Confirmed Pantry quantity is enough for this requirement.',

      icon:
        PackageCheck,
    },

    {
      key:
        'running_low',

      label:
        'Running Low',

      description:
        'Pantry signal says low, but EPANTRY will not invent an exact shortage.',

      icon:
        AlertTriangle,
    },

    {
      key:
        'needs_confirmation',

      label:
        'Needs Confirmation',

      description:
        'Likely, uncertain or untracked Pantry evidence needs a clearer signal.',

      icon:
        CircleHelp,
    },

    {
      key:
        'optional_upgrade',

      label:
        'Optional Upgrade',

      description:
        'Optional Recipe requirements stay outside the basket until you include them.',

      icon:
        Sparkles,
    },
  ])

const READINESS =
  Object.freeze({
    ready: {
      label:
        'Ready from Pantry',

      description:
        'No confirmed mandatory shortage remains.',

      className:
        'border-emerald-200 bg-emerald-50 text-emerald-800',
    },

    almost_there: {
      label:
        'Almost there',

      description:
        'You already have part of the plan; only genuine shortages remain.',

      className:
        'border-amber-200 bg-amber-50 text-amber-800',
    },

    missing: {
      label:
        'Missing requirements',

      description:
        'Mandatory requirements need confirmed purchase quantities.',

      className:
        'border-rose-200 bg-rose-50 text-rose-800',
    },

    needs_confirmation: {
      label:
        'Needs confirmation',

      description:
        'Pantry uncertainty must be explained or confirmed before exact shortage math.',

      className:
        'border-stone-300 bg-stone-100 text-stone-700',
    },
  })

const PANTRY_REASON_LABELS =
  Object.freeze({
    confirmed_quantity_satisfies_requirement:
      'Confirmed Pantry quantity covers this requirement.',

    confirmed_quantity_below_requirement:
      'Confirmed Pantry quantity covers only part of this requirement.',

    no_matching_pantry_observation:
      'No matching Pantry observation is available.',

    pantry_state_not_exactly_confirmed:
      'Pantry evidence is not exact enough to calculate a genuine shortage.',

    pantry_reconciliation_unavailable:
      'Pantry reconciliation needs confirmation.',
  })

function formatQuantity(
  quantity,
  unit,
) {
  if (
    quantity ===
      null ||
    quantity ===
      undefined ||
    !Number.isFinite(
      Number(
        quantity,
      ),
    )
  ) {
    return 'Not exact'
  }

  return `${Number(
    quantity,
  )} ${unit || ''}`.trim()
}

function getReasonLabel(
  reason,
) {
  if (!reason) {
    return ''
  }

  return (
    PANTRY_REASON_LABELS[
      reason
    ] ||
    String(
      reason,
    )
      .split(
        '_',
      )
      .filter(
        Boolean,
      )
      .map(
        (
          word,
        ) =>
          `${word
            .charAt(
              0,
            )
            .toUpperCase()}${word.slice(
            1,
          )}`,
      )
      .join(
        ' ',
      )
  )
}

function RequirementCard({
  line,
  actionKey,
  onOptionalDecision,
}) {
  const isOptional =
    line.optional ===
    true

  const included =
    line.includedInBasket ===
    true

  const pending =
    actionKey ===
    `optional-${line.id}`

  return (
    <article className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-stone-950">
              {
                line.label ||
                'Canonical ingredient'
              }
            </h3>

            {isOptional && (
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-violet-800">
                Optional
              </span>
            )}

            {line.needsConfirmation && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-stone-700">
                Confirmation required
              </span>
            )}
          </div>

          <div className="mt-3 grid gap-2 text-sm text-stone-600 sm:grid-cols-3">
            <p>
              <span className="font-black text-stone-800">
                Recipe needs:{' '}
              </span>

              {
                formatQuantity(
                  line.requiredQuantity,
                  line.requiredUnit,
                )
              }
            </p>

            <p>
              <span className="font-black text-stone-800">
                Confirmed usable:{' '}
              </span>

              {
                formatQuantity(
                  line.usablePantryQuantity,
                  line.requiredUnit,
                )
              }
            </p>

            <p>
              <span className="font-black text-stone-800">
                Genuine missing:{' '}
              </span>

              {
                line.shortageState ===
                  'confirmed'
                  ? formatQuantity(
                      line.genuineShortage,
                      line.shortageUnit,
                    )
                  : line.shortageState ===
                      'none'
                    ? '0'
                    : 'Needs confirmation'
              }
            </p>
          </div>

          {line.pantryReason && (
            <p className="mt-3 inline-flex rounded-xl bg-stone-50 px-3 py-2 text-xs font-bold leading-5 text-stone-600">
              {
                getReasonLabel(
                  line.pantryReason,
                )
              }
            </p>
          )}
        </div>

        {isOptional &&
          line.shortageState ===
            'confirmed' &&
          Number(
            line.genuineShortage,
          ) > 0 && (
            <button
              type="button"
              onClick={() =>
                onOptionalDecision(
                  line,

                  included
                    ? 'exclude_optional'
                    : 'include_optional',
                )
              }
              disabled={
                pending
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-black text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {
                included
                  ? (
                      <Minus
                        size={15}
                        aria-hidden="true"
                      />
                    )
                  : (
                      <Plus
                        size={15}
                        aria-hidden="true"
                      />
                    )
              }

              {
                pending
                  ? 'Updating…'
                  : included
                    ? 'Remove upgrade'
                    : 'Include upgrade'
              }
            </button>
          )}
      </div>
    </article>
  )
}

function RequirementBasketView({
  data,
}) {
  const basket =
    data?.requirementBasket ||
    []

  return (
    <section className="mt-6 rounded-[28px] border border-stone-200 bg-white shadow-sm">
      <header className="border-b border-stone-200 p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
            <ShoppingBasket
              size={21}
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              P20 · Requirement Basket
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-stone-950">
              Genuine quantities to solve
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              This is a requirement basket, not a product cart. Only confirmed
              shortages appear here. Product pack, Host offer, price, stock,
              serviceability and checkout decisions belong to the next module.
            </p>
          </div>
        </div>
      </header>

      <div className="p-5 sm:p-7">
        {basket.length ===
        0 ? (
          <div className="rounded-[22px] border border-dashed border-emerald-300 bg-emerald-50 px-5 py-10 text-center">
            <Check
              size={28}
              className="mx-auto text-emerald-700"
              aria-hidden="true"
            />

            <p className="mt-3 font-black text-emerald-950">
              No confirmed purchase requirement right now.
            </p>

            <p className="mt-1 text-sm text-emerald-800">
              Any uncertain Pantry line stays outside exact shortage math until
              it is confirmed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {basket.map(
              (
                line,
              ) => (
                <article
                  key={
                    line.requirementLineId ||
                    `${line.canonicalIngredientId}-${line.unit}`
                  }
                  className="flex flex-col gap-3 rounded-[22px] border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-stone-950">
                      {
                        line.label ||
                        'Canonical ingredient'
                      }
                    </p>

                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      Genuine shortage after confirmed Pantry subtraction
                    </p>
                  </div>

                  <div className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-stone-900 shadow-sm">
                    {
                      formatQuantity(
                        line.quantity,
                        line.unit,
                      )
                    }
                  </div>
                </article>
              ),
            )}
          </div>
        )}

        <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <strong>
            M11 handoff boundary:
          </strong>{' '}

          this screen supplies normalized ingredient requirements only. It does
          not choose a Product, seller/Host offer, price, inventory snapshot or
          checkout route.
        </div>
      </div>
    </section>
  )
}

export default function OutcomePlanPage({
  view =
    'plan',
}) {
  const {
    planId,
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
    targetServings,
    setTargetServings,
  ] =
    useState(
      '',
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    )

  const [
    actionKey,
    setActionKey,
  ] =
    useState(
      '',
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    success,
    setSuccess,
  ] =
    useState(
      '',
    )

  const loadPlan =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (!planId) {
          setError(
            'Outcome Plan ID is missing.',
          )

          setLoading(
            false,
          )

          return
        }

        if (refresh) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          const result =
            await getOutcomePlan(
              planId,
            )

          setData(
            result,
          )

          setTargetServings(
            String(
              result?.plan
                ?.targetServings ??
                '',
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getOutcomePlanErrorMessage(
              loadError,

              'Unable to load this Outcome Plan.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },

      [
        planId,
      ],
    )

  useEffect(
    () => {
      loadPlan()
    },

    [
      loadPlan,
    ],
  )

  const grouped =
    useMemo(
      () => {
        const map =
          new Map(
            GROUPS.map(
              (
                group,
              ) => [
                group.key,

                [],
              ],
            ),
          )

        for (
          const line
          of data?.requirements ||
          []
        ) {
          if (
            !map.has(
              line.group,
            )
          ) {
            map.set(
              line.group,

              [],
            )
          }

          map.get(
            line.group,
          ).push(
            line,
          )
        }

        return map
      },

      [
        data?.requirements,
      ],
    )

  const readiness =
    READINESS[
      data?.plan
        ?.readinessState
    ] ||
    READINESS.needs_confirmation

  const applyUpdate =
    async ({
      nextServings,
      decisions,
      keyPrefix,
      successMessage,
    }) => {
      if (
        !planId ||
        actionKey
      ) {
        return
      }

      setActionKey(
        keyPrefix,
      )

      setError(
        '',
      )

      setSuccess(
        '',
      )

      try {
        const result =
          await updateOutcomePlanRequirements(
            planId,

            {
              ...(nextServings !==
              undefined
                ? {
                    targetServings:
                      nextServings,
                  }
                : {}),

              ...(Array.isArray(
                decisions,
              )
                ? {
                    decisions,
                  }
                : {}),

              idempotencyKey:
                createOutcomePlanIdempotencyKey(
                  keyPrefix,
                ),
            },
          )

        setData(
          result,
        )

        setTargetServings(
          String(
            result?.plan
              ?.targetServings ??
              '',
          ),
        )

        setSuccess(
          successMessage,
        )
      } catch (
        updateError
      ) {
        setError(
          getOutcomePlanErrorMessage(
            updateError,
          ),
        )
      } finally {
        setActionKey(
          '',
        )
      }
    }

  const handleServingUpdate =
    async (
      event,
    ) => {
      event.preventDefault()

      const parsed =
        Number(
          targetServings,
        )

      if (
        !Number.isFinite(
          parsed,
        ) ||
        parsed <= 0
      ) {
        setError(
          'Enter a valid serving count.',
        )

        return
      }

      if (
        parsed ===
        Number(
          data?.plan
            ?.targetServings,
        )
      ) {
        setError(
          'Choose a different serving count before recalculating.',
        )

        return
      }

      await applyUpdate({
        nextServings:
          parsed,

        keyPrefix:
          'servings',

        successMessage:
          'Servings changed. Recipe requirements, Pantry reconciliation and genuine shortages were recalculated.',
      })
    }

  const handleOptionalDecision =
    async (
      line,
      action,
    ) => {
      await applyUpdate({
        decisions: [
          {
            requirementLineId:
              line.id,

            action,
          },
        ],

        keyPrefix:
          `optional-${line.id}`,

        successMessage:
          action ===
          'include_optional'
            ? 'Optional upgrade added to the Requirement Basket.'
            : 'Optional upgrade removed from the Requirement Basket.',
      })
    }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-8">
          <div className="h-[620px] animate-pulse rounded-[30px] border border-stone-200 bg-white" />
        </div>
      </main>
    )
  }

  if (
    error &&
    !data
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-10">
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-7">
            <h1 className="text-xl font-black text-rose-950">
              Outcome Plan unavailable
            </h1>

            <p className="mt-2 text-sm text-rose-800">
              {error}
            </p>

            <Link
              to="/recipes"
              className="mt-5 inline-flex font-black text-rose-900 underline"
            >
              Back to Recipes
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const plan =
    data?.plan ||
    {}

  const summary =
    data?.summary ||
    {}

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell py-6 sm:py-9">
        <Link
          to={`/recipes/${plan.sourceRecipeSlug || ''}`}
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 hover:text-stone-950"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to Recipe
        </Link>

        <section className="mt-3 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <ClipboardList
                  size={18}
                  aria-hidden="true"
                />

                <p className="text-xs font-black uppercase tracking-[0.14em]">
                  P18 · Outcome Plan
                </p>
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                {
                  plan.sourceRecipeTitle ||
                  'Recipe Outcome Plan'
                }
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
                What to make, what your household already has, what is uncertain
                and the exact confirmed shortage that remains after Pantry
                reconciliation.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${readiness.className}`}
                >
                  {readiness.label}
                </span>

                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-700">
                  Revision {
                    plan.revision
                  }
                </span>

                <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-black text-stone-700">
                  {
                    summary.basketLines ||
                    0
                  } basket requirement{
                    summary.basketLines ===
                    1
                      ? ''
                      : 's'
                  }
                </span>
              </div>

              <p className="mt-3 text-xs font-semibold text-stone-500">
                {readiness.description}
              </p>
            </div>

            <form
              onSubmit={
                handleServingUpdate
              }
              className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 sm:min-w-[250px]"
            >
              <label className="block text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                Target servings

                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={
                      targetServings
                    }
                    onChange={(
                      event,
                    ) =>
                      setTargetServings(
                        event
                          .target
                          .value,
                      )
                    }
                    className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-black outline-none transition focus:border-emerald-600"
                  />

                  <button
                    type="submit"
                    disabled={
                      Boolean(
                        actionKey,
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-950 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Scale
                      size={15}
                      aria-hidden="true"
                    />

                    Recalculate
                  </button>
                </div>
              </label>
            </form>
          </div>

          <div className="border-t border-stone-200 bg-stone-50/70 px-5 py-3 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Link
                  to={`/outcome-plans/${planId}`}
                  className={[
                    'rounded-full px-3.5 py-2 text-xs font-black transition',

                    view ===
                    'plan'
                      ? 'bg-stone-950 text-white'
                      : 'border border-stone-200 bg-white text-stone-700',
                  ].join(
                    ' ',
                  )}
                >
                  Outcome Plan
                </Link>

                <Link
                  to={`/outcome-plans/${planId}/basket`}
                  className={[
                    'rounded-full px-3.5 py-2 text-xs font-black transition',

                    view ===
                    'basket'
                      ? 'bg-emerald-700 text-white'
                      : 'border border-stone-200 bg-white text-stone-700',
                  ].join(
                    ' ',
                  )}
                >
                  Requirement Basket
                </Link>
              </div>

              <button
                type="button"
                onClick={() =>
                  loadPlan({
                    refresh:
                      true,
                  })
                }
                disabled={
                  refreshing ||
                  Boolean(
                    actionKey,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-stone-600 transition hover:bg-white disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                  aria-hidden="true"
                />

                Refresh
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {success}
          </div>
        )}

        {view ===
        'basket' ? (
          <RequirementBasketView
            data={
              data
            }
          />
        ) : (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
                <ChefHat
                  size={19}
                  className="text-stone-500"
                  aria-hidden="true"
                />

                <p className="mt-3 text-2xl font-black text-stone-950">
                  {
                    summary.mandatoryLines ||
                    0
                  }
                </p>

                <p className="text-xs font-bold text-stone-500">
                  Mandatory requirements
                </p>
              </div>

              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
                <PackageCheck
                  size={19}
                  className="text-emerald-700"
                  aria-hidden="true"
                />

                <p className="mt-3 text-2xl font-black text-emerald-950">
                  {
                    summary.alreadyHave ||
                    0
                  }
                </p>

                <p className="text-xs font-bold text-emerald-700">
                  Already have
                </p>
              </div>

              <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                <ShoppingBasket
                  size={19}
                  className="text-amber-700"
                  aria-hidden="true"
                />

                <p className="mt-3 text-2xl font-black text-amber-950">
                  {
                    summary.needed ||
                    0
                  }
                </p>

                <p className="text-xs font-bold text-amber-700">
                  Confirmed shortages
                </p>
              </div>

              <div className="rounded-[22px] border border-stone-300 bg-stone-100 p-4">
                <CircleHelp
                  size={19}
                  className="text-stone-600"
                  aria-hidden="true"
                />

                <p className="mt-3 text-2xl font-black text-stone-950">
                  {
                    (
                      summary.needsConfirmation ||
                      0
                    ) +
                    (
                      summary.runningLow ||
                      0
                    )
                  }
                </p>

                <p className="text-xs font-bold text-stone-600">
                  Need clearer Pantry evidence
                </p>
              </div>
            </section>

            <div className="mt-6 space-y-5">
              {GROUPS.map(
                (
                  group,
                ) => {
                  const lines =
                    grouped.get(
                      group.key,
                    ) ||
                    []

                  if (
                    lines.length ===
                    0
                  ) {
                    return null
                  }

                  const Icon =
                    group.icon

                  return (
                    <section
                      key={
                        group.key
                      }
                      className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5 sm:p-6"
                    >
                      <header className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-stone-700 shadow-sm">
                          <Icon
                            size={19}
                            aria-hidden="true"
                          />
                        </div>

                        <div>
                          <h2 className="text-lg font-black text-stone-950">
                            {group.label}
                          </h2>

                          <p className="mt-1 text-sm leading-6 text-stone-500">
                            {group.description}
                          </p>
                        </div>
                      </header>

                      <div className="mt-4 space-y-3">
                        {lines.map(
                          (
                            line,
                          ) => (
                            <RequirementCard
                              key={
                                line.id ||
                                line.identityKey
                              }
                              line={
                                line
                              }
                              actionKey={
                                actionKey
                              }
                              onOptionalDecision={
                                handleOptionalDecision
                              }
                            />
                          ),
                        )}
                      </div>
                    </section>
                  )
                },
              )}
            </div>

            <section className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.13em] text-emerald-700">
                    Genuine Missing → Requirement Basket
                  </p>

                  <h2 className="mt-2 text-xl font-black text-emerald-950">
                    Confirmed missing quantities are ready
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-800">
                    Mandatory confirmed shortages are included automatically.
                    Uncertain Pantry states are intentionally excluded from
                    exact purchase quantity until confirmed.
                  </p>
                </div>

                <Link
                  to={`/outcome-plans/${planId}/basket`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <ShoppingBasket
                    size={17}
                    aria-hidden="true"
                  />

                  Add missing to Requirement Basket
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}