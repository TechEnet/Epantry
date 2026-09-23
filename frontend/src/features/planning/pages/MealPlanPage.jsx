import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Clock3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UtensilsCrossed,
  UsersRound,
  X,
} from 'lucide-react'

import {
  Link,
} from 'react-router-dom'

import {
  addPlannedMeal,
  createMealPlan,
  deleteMealPlan,
  getPlanningErrorMessage,
  listMealPlans,
  updatePlannedMeal,
} from '../services/planning.service'

import {
  listPublicRecipes,
} from '../../recipes/services/recipe.service'

const MEAL_PLAN_VISUALS = [
  '/video/meal 1.png',
  '/video/meal 2.png',
  '/video/meal 3.png',
  '/video/meal 4.png',
  '/video/meal 5.png',
]

const READINESS_LABELS = {
  enough:
    'Enough',

  likely_enough:
    'Likely enough',

  running_low_before_meal:
    'Running low',

  expected_depleted:
    'Expected depleted',

  missing:
    'Missing',

  needs_confirmation:
    'Needs confirmation',
}

const READINESS_CLASSES = {
  enough:
    'border-emerald-200 bg-emerald-50 text-emerald-800',

  likely_enough:
    'border-sky-200 bg-sky-50 text-sky-800',

  running_low_before_meal:
    'border-violet-200 bg-violet-50 text-violet-800',

  expected_depleted:
    'border-rose-200 bg-rose-50 text-rose-800',

  missing:
    'border-rose-200 bg-rose-50 text-rose-800',

  needs_confirmation:
    'border-stone-200 bg-stone-100 text-stone-700',
}

function isoDate(
  date,
) {
  return date
    .toISOString()
    .slice(
      0,
      10,
    )
}

function defaultPlanDates() {
  const start =
    new Date()

  const end =
    new Date()

  end.setDate(
    end.getDate() +
      7,
  )

  return {
    start:
      isoDate(
        start,
      ),

    end:
      isoDate(
        end,
      ),
  }
}

function formatDateTime(
  value,
) {
  if (!value) {
    return 'Not scheduled'
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

function formatDateOnly(
  value,
) {
  if (!value) {
    return 'Not set'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    new Date(
      value,
    ),
  )
}

function titleCase(
  value,
) {
  if (!value) {
    return ''
  }

  return String(
    value,
  )
    .replace(
      /_/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        character,
      ) =>
        character.toUpperCase(),
    )
}

function ReadinessBadge({
  state,
}) {
  const key =
    state ||
    'needs_confirmation'

  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
        READINESS_CLASSES[
          key
        ] ||
          READINESS_CLASSES
            .needs_confirmation,
      ].join(
        ' ',
      )}
    >
      {READINESS_LABELS[
        key
      ] ||
        'Needs confirmation'}
    </span>
  )
}

export default function MealPlanPage() {
  const defaults =
    useMemo(
      defaultPlanDates,
      [],
    )

  const [
    mealPlans,
    setMealPlans,
  ] =
    useState([])

  const [
    selectedPlanId,
    setSelectedPlanId,
  ] =
    useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    saving,
    setSaving,
  ] =
    useState(false)

  const [
    deleting,
    setDeleting,
  ] =
    useState(false)

  const [
    planPendingDelete,
    setPlanPendingDelete,
  ] =
    useState(null)

  const [
    error,
    setError,
  ] =
    useState('')

  const [
    recipeOptions,
    setRecipeOptions,
  ] =
    useState([])

  const [
    recipeOptionsLoading,
    setRecipeOptionsLoading,
  ] =
    useState(true)

  const [
    recipeOptionsError,
    setRecipeOptionsError,
  ] =
    useState('')

  const [
    planForm,
    setPlanForm,
  ] =
    useState({
      title:
        'This Week',

      horizonStart:
        defaults.start,

      horizonEnd:
        defaults.end,
    })

  const [
    mealForm,
    setMealForm,
  ] =
    useState({
      recipeSlug:
        '',

      plannedAt:
        '',

      mealType:
        'dinner',

      servings:
        2,
    })

  const [
    mealVisualIndex,
    setMealVisualIndex,
  ] =
    useState(0)

  const selectedPlan =
    useMemo(
      () =>
        mealPlans.find(
          (
            plan,
          ) =>
            plan.id ===
            selectedPlanId,
        ) ||
        mealPlans[0] ||
        null,
      [
        mealPlans,
        selectedPlanId,
      ],
    )

  useEffect(
    () => {
      if (
        selectedPlan
      ) {
        return undefined
      }

      const timer =
        window.setInterval(
          () => {
            setMealVisualIndex(
              (
                current,
              ) =>
                (current + 1) %
                MEAL_PLAN_VISUALS.length,
            )
          },
          3200,
        )

      return () =>
        window.clearInterval(
          timer,
        )
    },
    [
      selectedPlan,
    ],
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
          const result =
            await listMealPlans()

          const rows =
            result?.mealPlans ||
            []

          setMealPlans(
            rows,
          )

          setSelectedPlanId(
            (
              current,
            ) =>
              rows.some(
                (
                  row,
                ) =>
                  row.id ===
                  current,
              )
                ? current
                : rows[0]?.id ||
                  '',
          )
        } catch (
          loadError
        ) {
          setError(
            getPlanningErrorMessage(
              loadError,
              'Unable to load your Meal Plan.',
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

  useEffect(
    () => {
      let active =
        true

      async function loadPublishedRecipes() {
        setRecipeOptionsLoading(
          true,
        )

        setRecipeOptionsError(
          '',
        )

        try {
          const result =
            await listPublicRecipes({
              page:
                1,

              limit:
                50,
            })

          if (!active) {
            return
          }

          setRecipeOptions(
            Array.isArray(
              result?.recipes,
            )
              ? result.recipes
              : [],
          )
        } catch (
          recipeLoadError
        ) {
          if (!active) {
            return
          }

          setRecipeOptionsError(
            recipeLoadError?.response?.data?.message ||
              recipeLoadError?.message ||
              'Unable to load published recipes.',
          )

          setRecipeOptions(
            [],
          )
        } finally {
          if (active) {
            setRecipeOptionsLoading(
              false,
            )
          }
        }
      }

      loadPublishedRecipes()

      return () => {
        active =
          false
      }
    },
    [],
  )

  async function handleCreatePlan(
    event,
  ) {
    event.preventDefault()

    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      const result =
        await createMealPlan({
          title:
            planForm.title,

          horizonStart:
            new Date(
              `${planForm.horizonStart}T00:00:00`,
            ).toISOString(),

          horizonEnd:
            new Date(
              `${planForm.horizonEnd}T23:59:59`,
            ).toISOString(),
        })

      setSelectedPlanId(
        result?.mealPlan?.id ||
        '',
      )

      await load()
    } catch (
      saveError
    ) {
      setError(
        getPlanningErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  async function handleAddMeal(
    event,
  ) {
    event.preventDefault()

    if (
      !selectedPlan?.id
    ) {
      return
    }

    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      await addPlannedMeal({
        mealPlanId:
          selectedPlan.id,

        recipeSlug:
          mealForm.recipeSlug,

        plannedAt:
          new Date(
            mealForm.plannedAt,
          ).toISOString(),

        mealType:
          mealForm.mealType,

        servings:
          Number(
            mealForm.servings,
          ),

        priority:
          3,
      })

      setMealForm(
        (
          current,
        ) => ({
          ...current,

          recipeSlug:
            '',
        }),
      )

      await load()
    } catch (
      saveError
    ) {
      setError(
        getPlanningErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  async function changeMeal({
    mealId,
    changes,
  }) {
    setSaving(
      true,
    )

    setError(
      '',
    )

    try {
      await updatePlannedMeal({
        plannedMealId:
          mealId,

        changes,
      })

      await load()
    } catch (
      saveError
    ) {
      setError(
        getPlanningErrorMessage(
          saveError,
        ),
      )
    } finally {
      setSaving(
        false,
      )
    }
  }

  async function handleDeletePlan() {
    if (
      !planPendingDelete?.id
    ) {
      return
    }

    setDeleting(
      true,
    )

    setError(
      '',
    )

    try {
      await deleteMealPlan({
        mealPlanId:
          planPendingDelete.id,
      })

      setPlanPendingDelete(
        null,
      )

      await load()
    } catch (
      deleteError
    ) {
      setError(
        getPlanningErrorMessage(
          deleteError,
          'Unable to delete this Meal Plan.',
        ),
      )
    } finally {
      setDeleting(
        false,
      )
    }
  }

  return (
    <main className="min-h-screen bg-[#f1f6f7]">
      <div className="page-shell py-4 sm:py-6">
        <section className="overflow-hidden rounded-[24px] border border-[#86d8b1] bg-[#c9f3df] shadow-[0_10px_34px_rgba(31,95,68,0.09)] sm:rounded-[30px] sm:shadow-[0_18px_55px_rgba(31,95,68,0.12)]">
          <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-9 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#0f6b4f] bg-[#0f6b4f] px-2.5 py-1 text-white shadow-sm sm:gap-2 sm:px-3 sm:py-1.5">
                <CalendarDays
                  className="h-[13px] w-[13px] sm:h-4 sm:w-4"
                  aria-hidden="true"
                />

                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.12em] sm:text-[11px] sm:font-black sm:tracking-[0.14em]">
                  Meal planning
                </span>
              </div>

              <h1 className="mt-2 max-w-4xl whitespace-nowrap text-[14px] font-extrabold tracking-[-0.03em] text-[#103f32] sm:mt-4 sm:whitespace-normal sm:text-4xl sm:font-black sm:tracking-tight">
                Plan meals without double-counting Pantry.
              </h1>

              <p className="mt-1.5 max-w-3xl text-[10px] font-medium leading-4 text-[#356252] sm:mt-3 sm:text-sm sm:font-semibold sm:leading-7">
                Plan upcoming meals without changing what&apos;s currently in your Pantry.
              </p>
            </div>

            <div className="flex w-full shrink-0 items-center justify-between gap-2.5 rounded-xl border border-[#a9b7ef] bg-[#e5e9ff] p-3 shadow-[0_6px_16px_rgba(74,88,164,0.10)] sm:gap-4 sm:rounded-2xl sm:p-4 sm:shadow-[0_10px_24px_rgba(74,88,164,0.12)] lg:w-auto lg:min-w-[320px]">
              <div>
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-[#46517b] sm:text-[10px] sm:font-black sm:tracking-[0.14em]">
                  Next basket
                </p>

                <p className="mt-0.5 max-w-[180px] text-[9px] font-medium leading-3.5 text-[#5d668a] sm:mt-1 sm:text-xs sm:font-semibold sm:leading-5">
                  Review what your planned meals may need next.
                </p>
              </div>

              <Link
                to="/next-basket"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#5061bd] px-3 py-2 text-[10px] font-extrabold text-white shadow-[0_6px_14px_rgba(80,97,189,0.18)] transition hover:bg-[#4352a4] sm:gap-2 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm sm:font-black sm:shadow-[0_8px_20px_rgba(80,97,189,0.22)]"
              >
                Open

                <ArrowRight
                  className="h-[12px] w-[12px] sm:h-4 sm:w-4"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[20px] border border-[#bea9ee] bg-[#e9e0ff] p-3 shadow-[0_8px_22px_rgba(87,65,150,0.08)] sm:mt-5 sm:rounded-[24px] sm:p-5 sm:shadow-[0_12px_30px_rgba(87,65,150,0.10)]">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mb-3">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#6048a9] sm:text-[10px] sm:font-black sm:tracking-[0.15em]">
              How this page works
            </p>

            {/* <h2 className="text-base font-black leading-tight text-[#3f2f78]">
              Plan your meals in 4 simple steps
            </h2> */}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3 lg:grid-cols-4 lg:items-stretch">
            <div className="min-w-0 rounded-xl border border-[#8eb8f5] bg-[#cfe3ff] px-2.5 py-2 sm:rounded-[18px] sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[9px] font-extrabold text-white sm:h-7 sm:w-7 sm:text-xs sm:font-black">
                  1
                </span>

                <p className="text-[10px] font-extrabold text-[#173f77] sm:text-sm sm:font-black">
                  Create a plan
                </p>
              </div>

              <p className="mt-1 text-[9px] font-medium leading-3.5 text-[#365b89] sm:mt-2 sm:text-xs sm:font-semibold sm:leading-5">
                Give it a name and choose the start and end dates.
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-[#78c6df] bg-[#ccefff] px-2.5 py-2 sm:rounded-[18px] sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#007a9e] text-[9px] font-extrabold text-white sm:h-7 sm:w-7 sm:text-xs sm:font-black">
                  2
                </span>

                <p className="text-[10px] font-extrabold text-[#10556b] sm:text-sm sm:font-black">
                  Add a recipe
                </p>
              </div>

              <p className="mt-1 text-[9px] font-medium leading-3.5 text-[#356b7b] sm:mt-2 sm:text-xs sm:font-semibold sm:leading-5">
                Pick the recipe, meal time and servings you are planning.
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-[#efc759] bg-[#ffe6a3] px-2.5 py-2 sm:rounded-[18px] sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#d38b00] text-[9px] font-extrabold text-white sm:h-7 sm:w-7 sm:text-xs sm:font-black">
                  3
                </span>

                <p className="text-[10px] font-extrabold text-[#6c4a05] sm:text-sm sm:font-black">
                  Check Pantry
                </p>
              </div>

              <p className="mt-1 text-[9px] font-medium leading-3.5 text-[#775d20] sm:mt-2 sm:text-xs sm:font-semibold sm:leading-5">
                See what is enough, running low or missing for that meal.
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-[#8fd1a6] bg-[#d2f2dc] px-2.5 py-2 sm:rounded-[18px] sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#16794a] text-[9px] font-extrabold text-white sm:h-7 sm:w-7 sm:text-xs sm:font-black">
                  4
                </span>

                <p className="text-[10px] font-extrabold text-[#195b3b] sm:text-sm sm:font-black">
                  Adjust &amp; review
                </p>
              </div>

              <p className="mt-1 text-[9px] font-medium leading-3.5 text-[#396c52] sm:mt-2 sm:text-xs sm:font-semibold sm:leading-5">
                Adjust servings or meals, then review what you may need next.
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 shadow-sm">
            <TriangleAlert
              size={18}
              className="shrink-0"
            />

            {error}
          </div>
        )}

        <section className="mt-6 space-y-5">
          {selectedPlan ? (
            <>
              <div className="grid items-start gap-5 lg:h-[406px] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,1.1fr)] lg:items-stretch">
          <form
            onSubmit={
              handleCreatePlan
            }
            className="min-w-0 rounded-[24px] border border-[#8cbcff] bg-[#d9eaff] p-3 shadow-[0_12px_30px_rgba(50,96,170,0.10)] sm:p-5 lg:h-full"
          >
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-xl">
                <Plus
                  size={19}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="font-black text-stone-950">
                  Create Meal Plan
                </h2>

                <p className="mt-1 text-xs font-semibold leading-5 text-[#445f89]">
                  Give the plan a name and choose its date range.
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                  Plan name
                </span>

                <input
                  value={
                    planForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanForm(
                      (
                        current,
                      ) => ({
                        ...current,

                        title:
                          event.target.value,
                      }),
                    )
                  }
                  className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3"
                  placeholder="Plan title"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                    Starts
                  </span>

                  <input
                    type="date"
                    value={
                      planForm.horizonStart
                    }
                    onChange={(
                      event,
                    ) =>
                      setPlanForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          horizonStart:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                    Ends
                  </span>

                  <input
                    type="date"
                    value={
                      planForm.horizonEnd
                    }
                    onChange={(
                      event,
                    ) =>
                      setPlanForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          horizonEnd:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                saving
              }
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-black text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 sm:py-3"
            >
              <Plus
                size={16}
                aria-hidden="true"
              />

              Create Plan
            </button>
          </form>

          <section className="min-w-0 rounded-[24px] border border-[#d7c5a8] bg-[#f3eadc] p-5 shadow-[0_12px_30px_rgba(84,67,45,0.10)] lg:h-full">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-stone-950">
                  Plans
                </h2>

                <p className="mt-1 text-xs text-stone-500">
                  {mealPlans.length} active {mealPlans.length === 1 ? 'plan' : 'plans'}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  load
                }
                disabled={
                  loading
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d4c09f] bg-[#fffaf2] text-[#2f654f] transition hover:bg-white hover:text-[#184936] disabled:opacity-50"
                aria-label="Refresh Meal Plans"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? 'animate-spin'
                      : ''
                  }
                />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {mealPlans.map(
                (
                  plan,
                ) => {
                  const isSelected =
                    selectedPlan?.id ===
                    plan.id

                  return (
                    <div
                      key={
                        plan.id
                      }
                      className={[
                        'group rounded-2xl border p-3 transition',
                        isSelected
                          ? 'border-[#c6aa7d] bg-[#e7d5bb] shadow-[0_7px_18px_rgba(84,67,45,0.12)]'
                          : 'border-[#deceb5] bg-[#fbf6ee] hover:border-[#c6aa7d] hover:bg-[#fffdf9]',
                      ].join(
                        ' ',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPlanId(
                              plan.id,
                            )
                          }
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={[
                              'truncate text-sm font-black',
                              isSelected
                                ? 'text-[#255542]'
                                : 'text-stone-900',
                            ].join(
                              ' ',
                            )}
                          >
                            {plan.title}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-stone-500">
                            <span className="inline-flex items-center gap-1">
                              <UtensilsCrossed
                                size={12}
                                aria-hidden="true"
                              />

                              {(plan.meals || []).length} meals
                            </span>

                            <span className="inline-flex items-center gap-1">
                              <CalendarRange
                                size={12}
                                aria-hidden="true"
                              />

                              {formatDateOnly(
                                plan.horizonStart,
                              )}
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPlanPendingDelete(
                              plan,
                            )
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-600 lg:opacity-0 lg:group-hover:opacity-100"
                          aria-label={`Delete ${plan.title}`}
                          title="Delete plan"
                        >
                          <Trash2
                            size={15}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                  )
                },
              )}

              {!loading &&
                mealPlans.length ===
                  0 && (
                  <div className="rounded-2xl border border-dashed border-[#d4c09f] bg-[#fbf6ee] px-4 py-6 text-center">
                    <CalendarDays
                      size={24}
                      className="mx-auto text-stone-400"
                    />

                    <p className="mt-2 text-sm font-black text-stone-800">
                      No active plans yet
                    </p>

                    <p className="mt-1 text-xs font-semibold leading-5 text-[#445f89]">
                      Create a plan above to start scheduling meals.
                    </p>
                  </div>
                )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#8bd7c2] bg-[#d9f5ec] shadow-[0_12px_30px_rgba(45,118,96,0.10)] lg:flex lg:h-full lg:flex-col">
            <div className="flex flex-col gap-2 border-b border-[#75cdb3] bg-[#bcebdc] p-3 sm:gap-4 sm:p-5 lg:relative lg:block">
              <div className="min-w-0 lg:pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#0f766e] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                    Active plan
                  </span>

                  <span className="text-xs font-bold text-[#35675d]">
                    {(selectedPlan.meals || []).length} planned {(selectedPlan.meals || []).length === 1 ? 'meal' : 'meals'}
                  </span>
                </div>

                <div className="lg:mt-2 lg:flex lg:min-w-0 lg:items-center lg:gap-3">
                  <h2 className="mt-1 truncate text-xl font-black tracking-tight text-stone-950 sm:mt-2 sm:text-2xl lg:mt-0">
                    {selectedPlan.title}
                  </h2>

                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#35675d] lg:mt-0 lg:flex-nowrap lg:whitespace-nowrap">
                    <CalendarRange
                      size={14}
                      aria-hidden="true"
                    />

                    {formatDateOnly(
                      selectedPlan.horizonStart,
                    )}

                    <span>→</span>

                    {formatDateOnly(
                      selectedPlan.horizonEnd,
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPlanPendingDelete(
                    selectedPlan,
                  )
                }
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d65252] bg-[#fff2f2] px-3 py-2 text-xs font-black text-[#a92525] transition hover:bg-white sm:px-3.5 sm:py-2.5 lg:absolute lg:bottom-5 lg:right-5 lg:h-9 lg:w-9 lg:p-0"
                aria-label="Delete plan"
                title="Delete plan"
              >
                <Trash2
                  size={15}
                  aria-hidden="true"
                />

                <span className="lg:sr-only">
                  Delete Plan
                </span>
              </button>
            </div>

            <form
              onSubmit={
                handleAddMeal
              }
              className="bg-[#d7f4ff] p-3 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#007a9e] text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-xl">
                  <ChefHat
                    size={20}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h3 className="font-black text-stone-950">
                    Add planned Recipe
                  </h3>

                  <p className="mt-1 text-xs font-semibold leading-5 text-[#445f89]">
                    Choose a recipe to add it to this meal plan.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:mt-5 sm:gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.11em] text-[#315f70]">
                    Recipe
                  </span>

                  <select
                    value={
                      mealForm.recipeSlug
                    }
                    onChange={(
                      event,
                    ) =>
                      setMealForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          recipeSlug:
                            event.target.value,
                        }),
                      )
                    }
                    required
                    disabled={
                      recipeOptionsLoading ||
                      recipeOptions.length ===
                        0
                    }
                    className="w-full rounded-xl border border-[#8bcde2] bg-white/85 px-3 py-2 text-sm outline-none transition focus:border-[#007a9e] focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-3"
                  >
                    <option value="">
                      {recipeOptionsLoading
                        ? 'Loading published recipes…'
                        : recipeOptions.length ===
                            0
                          ? 'No published recipes available'
                          : 'Choose a published recipe'}
                    </option>

                    {recipeOptions.map(
                      (
                        item,
                      ) => {
                        const dish =
                          item?.dish ||
                          {}

                        const recipe =
                          item?.recipe ||
                          {}

                        const slug =
                          dish.slug ||
                          recipe.slug ||
                          ''

                        if (!slug) {
                          return null
                        }

                        return (
                          <option
                            key={
                              slug
                            }
                            value={
                              slug
                            }
                          >
                            {dish.name ||
                              recipe.title ||
                              slug}
                          </option>
                        )
                      },
                    )}
                  </select>

                  {recipeOptionsError && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600">
                      {recipeOptionsError}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.11em] text-[#315f70]">
                    Date & time
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      mealForm.plannedAt
                    }
                    onChange={(
                      event,
                    ) =>
                      setMealForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          plannedAt:
                            event.target.value,
                        }),
                      )
                    }
                    required
                    className="w-full rounded-xl border border-[#8bcde2] bg-white/85 px-3 py-2 text-sm outline-none transition focus:border-[#007a9e] focus:bg-white focus:ring-4 focus:ring-cyan-100 sm:px-4 sm:py-3"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.11em] text-[#315f70]">
                    Meal type
                  </span>

                  <select
                    value={
                      mealForm.mealType
                    }
                    onChange={(
                      event,
                    ) =>
                      setMealForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          mealType:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#8bcde2] bg-white/85 px-3 py-2 text-sm outline-none transition focus:border-[#007a9e] focus:bg-white focus:ring-4 focus:ring-cyan-100 sm:px-4 sm:py-3"
                  >
                    <option value="breakfast">
                      Breakfast
                    </option>

                    <option value="brunch">
                      Brunch
                    </option>

                    <option value="lunch">
                      Lunch
                    </option>

                    <option value="snack">
                      Snack
                    </option>

                    <option value="dinner">
                      Dinner
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.11em] text-[#315f70]">
                    Servings
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={
                      mealForm.servings
                    }
                    onChange={(
                      event,
                    ) =>
                      setMealForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          servings:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#8bcde2] bg-white/85 px-3 py-2 text-sm outline-none transition focus:border-[#007a9e] focus:bg-white focus:ring-4 focus:ring-cyan-100 sm:px-4 sm:py-3"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  !mealForm.recipeSlug ||
                  !mealForm.plannedAt
                }
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#007a9e] px-4 py-2 text-sm font-black text-white shadow-[0_8px_20px_rgba(0,122,158,0.20)] transition hover:bg-[#005e7a] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 sm:px-5 sm:py-3"
              >
                <Plus
                  size={16}
                  aria-hidden="true"
                />

                Add Meal
              </button>
            </form>
          </section>
              </div>

        <section className="rounded-[24px] border border-[#d8c7ab] bg-[#f5ede2] p-5 shadow-[0_12px_30px_rgba(84,67,45,0.10)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2f654f]">
                Meal schedule
              </p>

              <h2 className="mt-1 text-xl font-black text-stone-950">
                Planned meals
              </h2>
            </div>

            <p className="text-xs font-bold text-[#6f6355]">
              {(selectedPlan.meals || []).length} {(selectedPlan.meals || []).length === 1 ? 'meal' : 'meals'} in this plan
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {(selectedPlan.meals || []).map(
              (
                meal,
              ) => (
                <article
                  key={
                    meal.id
                  }
                  className="ml-0 mr-[-2.5rem] w-[calc(100%+2.5rem)] overflow-hidden rounded-[20px] border border-[#ddccb2] bg-[#fffaf2] shadow-[0_8px_18px_rgba(84,67,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#c8ad82] hover:shadow-[0_12px_24px_rgba(84,67,45,0.12)] sm:mx-0 sm:w-auto"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ReadinessBadge
                          state={
                            meal.readinessState
                          }
                        />

                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-600">
                          {titleCase(
                            meal.mealType,
                          )}
                        </span>

                        {meal.status !==
                          'planned' && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                            {titleCase(
                              meal.status,
                            )}
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-lg font-black text-stone-950">
                        {meal.recipeTitle}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-stone-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3
                            size={13}
                            aria-hidden="true"
                          />

                          {formatDateTime(
                            meal.plannedAt,
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <UsersRound
                            size={13}
                            aria-hidden="true"
                          />

                          {meal.servings} servings
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/recipes/${meal.recipeSlug}`}
                      className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-emerald-700 transition hover:text-emerald-900"
                    >
                      Recipe

                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                      />
                    </Link>
                  </div>

                  {(meal.forecastLines || []).length >
                    0 && (
                    <div className="border-t border-[#a9cae8] bg-[#dceeff] px-4 py-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#365f7d]">
                        Pantry forecast
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {meal.forecastLines.map(
                          (
                            line,
                          ) => (
                            <div
                              key={`${line.canonicalIngredientId}:${line.requiredUnit}`}
                              className="flex items-center justify-between gap-3 rounded-xl bg-[#f7fbff] px-3 py-2 text-xs ring-1 ring-[#a9cae8]"
                            >
                              <span className="min-w-0 truncate font-bold text-stone-700">
                                {line.label || 'Ingredient'}
                              </span>

                              <span className="shrink-0 text-right text-stone-500">
                                {line.requiredQuantity} {line.requiredUnit}
                                {' · '}
                                {READINESS_LABELS[
                                  line.readinessState
                                ] ||
                                  'Needs confirmation'}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {meal.status ===
                    'planned' && (
                    <div className="grid grid-cols-4 gap-1.5 border-t border-[#b8c8e8] bg-[#e9f1ff] px-2 py-2 sm:flex sm:flex-wrap sm:gap-2 sm:px-4 sm:py-3">
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          changeMeal({
                            mealId:
                              meal.id,

                            changes: {
                              servings:
                                Math.max(
                                  1,
                                  Number(
                                    meal.servings,
                                  ) -
                                    1,
                                ),
                            },
                          })
                        }
                        className="w-full whitespace-nowrap rounded-lg border border-stone-200 bg-white px-1 py-2 text-[9px] font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 sm:w-auto sm:px-3 sm:text-xs"
                      >
                        − Serving
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          changeMeal({
                            mealId:
                              meal.id,

                            changes: {
                              servings:
                                Number(
                                  meal.servings,
                                ) +
                                1,
                            },
                          })
                        }
                        className="w-full whitespace-nowrap rounded-lg border border-stone-200 bg-white px-1 py-2 text-[9px] font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 sm:w-auto sm:px-3 sm:text-xs"
                      >
                        + Serving
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          changeMeal({
                            mealId:
                              meal.id,

                            changes: {
                              status:
                                'skipped',
                            },
                          })
                        }
                        className="w-full whitespace-nowrap rounded-lg border border-violet-200 bg-violet-50 px-1 py-2 text-[9px] font-black text-violet-800 transition hover:bg-violet-100 disabled:opacity-50 sm:w-auto sm:px-3 sm:text-xs"
                      >
                        Skip meal
                      </button>

                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          changeMeal({
                            mealId:
                              meal.id,

                            changes: {
                              status:
                                'cancelled',
                            },
                          })
                        }
                        className="w-full whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-1 py-2 text-[9px] font-black text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 sm:w-auto sm:px-3 sm:text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              ),
            )}

            {(selectedPlan.meals || []).length ===
              0 && (
              <div className="rounded-[20px] border border-dashed border-[#b8ace9] bg-[#f1efff] p-8 text-center">
                <ChefHat
                  size={28}
                  className="mx-auto text-stone-400"
                />

                <h3 className="mt-3 font-black text-stone-900">
                  No meals planned yet
                </h3>

                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-stone-500">
                  Add the first recipe above and EPANTRY will calculate its planning readiness against your Pantry.
                </p>
              </div>
            )}
          </div>
        </section>
            </>
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-4">
            <form
              onSubmit={
                handleCreatePlan
              }
              className="min-w-0 rounded-[24px] border border-[#8cbcff] bg-[#d9eaff] p-3 shadow-[0_12px_30px_rgba(50,96,170,0.10)] sm:p-5 lg:p-4"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-xl lg:h-9 lg:w-9">
                  <Plus
                    size={19}
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <h2 className="font-black text-stone-950">
                    Create Meal Plan
                  </h2>

                  <p className="mt-1 text-xs font-semibold leading-5 text-[#445f89]">
                    Give the plan a name and choose its date range.
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2.5 sm:mt-5 sm:space-y-4 lg:mt-4 lg:space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                    Plan name
                  </span>

                  <input
                    value={
                      planForm.title
                    }
                    onChange={(
                      event,
                    ) =>
                      setPlanForm(
                        (
                          current,
                        ) => ({
                          ...current,

                          title:
                            event.target.value,
                        }),
                      )
                    }
                    className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3 lg:py-2.5"
                    placeholder="Plan title"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                      Starts
                    </span>

                    <input
                      type="date"
                      value={
                        planForm.horizonStart
                      }
                      onChange={(
                        event,
                      ) =>
                        setPlanForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            horizonStart:
                              event.target.value,
                          }),
                        )
                      }
                      className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3 lg:py-2.5"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#31547f]">
                      Ends
                    </span>

                    <input
                      type="date"
                      value={
                        planForm.horizonEnd
                      }
                      onChange={(
                        event,
                      ) =>
                        setPlanForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            horizonEnd:
                              event.target.value,
                          }),
                        )
                      }
                      className="w-full rounded-xl border border-[#9ebff0] bg-white/80 px-3 py-2 text-sm font-semibold text-stone-900 outline-none transition focus:border-[#2563eb] focus:bg-white focus:ring-4 focus:ring-blue-100 sm:px-4 sm:py-3 lg:py-2.5"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  saving
                }
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-black text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5 sm:py-3 lg:mt-4 lg:py-2.5"
              >
                <Plus
                  size={16}
                  aria-hidden="true"
                />

                Create Plan
              </button>
            </form>

              <div
                className="relative min-h-[360px] overflow-hidden sm:min-h-[420px] lg:min-h-[350px]"
                aria-hidden="true"
              >
                {!loading && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center">
                      {MEAL_PLAN_VISUALS.map(
                        (
                          image,
                          index,
                        ) => (
                          <img
                            key={
                              image
                            }
                            src={
                              image
                            }
                            alt=""
                            className={[
                              'absolute max-h-[92%] w-full max-w-[680px] object-contain px-4 transition-all duration-[900ms] ease-in-out lg:max-h-[86%] lg:max-w-[560px]',
                              mealVisualIndex ===
                              index
                                ? 'translate-x-0 scale-100 opacity-100'
                                : 'translate-x-6 scale-[0.97] opacity-0',
                            ].join(
                              ' ',
                            )}
                          />
                        ),
                      )}
                    </div>

                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#5cb5ef] bg-[#bfe7ff] p-4 text-xs font-semibold leading-5 text-[#0f4c6d]">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>Reservations do not consume Pantry; inferred or uncertain Pantry stays uncertain until stronger evidence exists.</span>
        </div>
      </div>

      {planPendingDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget &&
              !deleting
            ) {
              setPlanPendingDelete(
                null,
              )
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-meal-plan-title"
            className="w-full max-w-md rounded-[24px] border border-rose-100 bg-white p-6 shadow-[0_28px_80px_rgba(28,25,23,0.24)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2
                  size={20}
                  aria-hidden="true"
                />
              </div>

              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={() =>
                  setPlanPendingDelete(
                    null,
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:opacity-50"
                aria-label="Close delete confirmation"
              >
                <X
                  size={17}
                  aria-hidden="true"
                />
              </button>
            </div>

            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600">
              Delete Meal Plan
            </p>

            <h2
              id="delete-meal-plan-title"
              className="mt-1 text-2xl font-black tracking-tight text-stone-950"
            >
              Delete {planPendingDelete.title}?
            </h2>

            <p className="mt-3 text-sm leading-6 text-stone-600">
              This removes the plan from your active Meal Plans and cancels its still-planned meals so they no longer affect Pantry forecasting. Existing planning history is preserved.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={() =>
                  setPlanPendingDelete(
                    null,
                  )
                }
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={
                  handleDeletePlan
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2
                  size={15}
                  aria-hidden="true"
                />

                {deleting
                  ? 'Deleting...'
                  : 'Delete Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
