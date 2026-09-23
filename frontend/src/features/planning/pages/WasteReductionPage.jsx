import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  CircleGauge,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'

import {
  Link,
  useLocation,
} from 'react-router-dom'

import {
  getPlanningErrorMessage,
  getWasteReduction,
} from '../services/planning.service'

const HORIZON_OPTIONS = Object.freeze([
  3,
  7,
  14,
])

const PRIORITY_LABELS = Object.freeze({
  use_now: 'Use now',
  use_very_soon: 'Use very soon',
  use_soon: 'Use soon',
  attention: 'Needs attention',
})

function formatDate(value) {
  if (!value) {
    return 'Not provided'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not provided'
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatReason(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .toLowerCase()
}

function formatProvenQuantity(quantity) {
  if (
    quantity?.mode !== 'exact' ||
    !Number.isFinite(Number(quantity.value))
  ) {
    return 'Quantity not confirmed'
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

function EmptySection({
  icon: Icon = PackageCheck,
  title,
  body,
}) {
  return (
    <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[18px] border border-dashed border-sky-100 bg-sky-50/70 px-3 py-3 text-center sm:min-h-[170px] sm:rounded-[22px] sm:px-6 sm:py-8">
      <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/90 text-sky-700 shadow-sm ring-1 ring-sky-100 sm:h-11 sm:w-11 sm:rounded-2xl">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>

      <h3 className="mt-2 whitespace-nowrap text-[12px] font-black text-stone-950 sm:mt-4 sm:text-base">
        {title}
      </h3>

      <p className="mt-1 max-w-xl whitespace-nowrap text-[8px] leading-4 text-stone-500 sm:mt-2 sm:whitespace-normal sm:text-sm sm:leading-6">
        {body}
      </p>
    </div>
  )
}

function SectionShell({
  eyebrow,
  title,
  mobileTitle,
  description,
  mobileDescription,
  count,
  icon: Icon,
  iconClassName,
  badgeClassName,
  children,
  id,
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-[22px] border border-slate-200 bg-[#f8fbff] shadow-[0_1px_0_rgba(28,25,23,0.03)] sm:rounded-[28px]"
    >
      <div className="flex flex-col gap-1.5 border-b border-slate-200/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-11 sm:w-11 sm:rounded-2xl ${iconClassName}`}>
            <Icon className="h-[14px] w-[14px] sm:h-5 sm:w-5" />
          </div>

          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-stone-400 sm:text-[10px] sm:tracking-[0.14em]">
              {eyebrow}
            </p>

            <h2 className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-black leading-tight tracking-tight text-stone-950 sm:mt-1 sm:overflow-visible sm:whitespace-normal sm:text-2xl">
              {mobileTitle ? (
                <>
                  <span className="whitespace-nowrap text-[15px] font-black sm:hidden">{mobileTitle}</span>
                  <span className="hidden sm:inline">{title}</span>
                </>
              ) : (
                title
              )}
            </h2>

            {mobileDescription ? (
              <>
                <p className="mt-0.5 whitespace-nowrap text-[7.5px] font-medium leading-3 text-stone-500 sm:hidden">
                  {mobileDescription}
                </p>
                <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-stone-500 sm:block">
                  {description}
                </p>
              </>
            ) : (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
                {description}
              </p>
            )}
          </div>
        </div>

        <span className={`w-fit rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.06em] sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.08em] ${badgeClassName}`}>
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="p-2.5 sm:p-6">
        {children}
      </div>
    </section>
  )
}

export default function WasteReductionPage() {
  const location = useLocation()

  const [horizonDays, setHorizonDays] = useState(7)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [showAllPossibilities, setShowAllPossibilities] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setData(
        await getWasteReduction({
          horizonDays,
        }),
      )
    } catch (loadError) {
      setError(
        getPlanningErrorMessage(
          loadError,
          'Unable to load Waste Reduction right now.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [horizonDays])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (
      location.pathname === '/next-possibility' &&
      !loading
    ) {
      document
        .getElementById('next-possibility')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    }
  }, [location.pathname, loading])

  const signals = data?.atRiskPantrySignals || []
  const rescues = data?.plannedMealRescues || []
  const possibilities = data?.nextPossibilities || []
  const visibleSignals = showAllSignals
    ? signals
    : signals.slice(0, 4)
  const visiblePossibilities = showAllPossibilities
    ? possibilities
    : possibilities.slice(0, 3)

  const groupedRescues = useMemo(() => {
    const groups = new Map()

    for (const rescue of rescues) {
      const groupKey =
        rescue.plannedMealId ||
        `${rescue.recipeVersionId || rescue.recipeTitle}:${rescue.plannedAt}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          plannedMealId: rescue.plannedMealId,
          mealPlanId: rescue.mealPlanId,
          recipeVersionId: rescue.recipeVersionId,
          recipeSlug: rescue.recipeSlug,
          recipeTitle: rescue.recipeTitle,
          plannedAt: rescue.plannedAt,
          mealType: rescue.mealType,
          servings: rescue.servings,
          confidenceClass: rescue.confidenceClass,
          affectedItems: [],
        })
      }

      const group = groups.get(groupKey)
      const alreadyAdded = group.affectedItems.some(
        (item) => item.pantryItemId === rescue.pantryItemId,
      )

      if (!alreadyAdded) {
        group.affectedItems.push({
          pantryItemId: rescue.pantryItemId,
          ingredientName: rescue.ingredientName,
          useSoonAt: rescue.useSoonAt,
          confidenceClass: rescue.confidenceClass,
        })
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      affectedItems: [...group.affectedItems].sort(
        (left, right) =>
          new Date(left.useSoonAt).getTime() -
            new Date(right.useSoonAt).getTime() ||
          String(left.ingredientName || '').localeCompare(
            String(right.ingredientName || ''),
          ),
      ),
    }))
  }, [rescues])

  const summaryCards = useMemo(
    () => [
      {
        label: 'At-risk signals',
        value: data?.summary?.totalAtRiskSignals ?? 0,
        description: 'Pantry evidence that deserves a closer look.',
      },
      {
        label: 'Use-soon',
        value: data?.summary?.useSoonSignals ?? 0,
        description: 'Household use-soon signals in this review window.',
      },
      {
        label: 'Meal rescues',
        value: groupedRescues.length,
        description: 'Planned meals worth reviewing earlier.',
      },
      {
        label: 'Possibilities',
        value: data?.summary?.nextPossibilities ?? 0,
        description: 'Published recipes supported by current evidence.',
      },
    ],
    [data, groupedRescues.length],
  )

  return (
    <main className="min-h-screen bg-[#eef4f7]">
      <div className="page-shell py-7 sm:py-9">
        <section className="flex h-[40svh] flex-col overflow-hidden rounded-[24px] border border-emerald-200 bg-[#dff7ef] shadow-[0_10px_34px_rgba(16,185,129,0.07)] sm:h-auto sm:rounded-[30px] sm:shadow-[0_14px_50px_rgba(16,185,129,0.08)]">
          <div className="grid gap-2.5 px-4 py-3.5 sm:gap-7 sm:px-8 sm:py-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-2.5 sm:gap-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 sm:h-13 sm:w-13 sm:rounded-[18px]">
                <Sparkles className="h-[18px] w-[18px] sm:h-[23px] sm:w-[23px]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-emerald-700 sm:text-[10px] sm:font-black sm:tracking-[0.16em]">
                  Use what you have first
                </p>

                <h1 className="mt-1 whitespace-nowrap text-[15px] font-extrabold tracking-[-0.02em] text-stone-950 sm:mt-2 sm:max-w-3xl sm:whitespace-normal sm:text-4xl sm:font-black sm:tracking-tight">
                  Use soon. Plan smarter. Waste less.
                </h1>

                <p className="mt-1.5 text-[10px] font-medium leading-[1.45] text-stone-600 sm:hidden">
                  <span className="block whitespace-nowrap">See what to use soon and which meals to cook earlier.</span>
                  <span className="block whitespace-nowrap">Find fitting recipes; “Use soon by” is not an expiry date.</span>
                </p>
                <p className="mt-3 hidden max-w-3xl text-sm leading-7 text-stone-600 sm:block">
                  Keep your Pantry current. EPANTRY shows what to use soon, which meals may be worth cooking earlier, and recipes that fit what you already have. Use soon by is a household reminder, not an expiry date.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-0">
              <div className="flex flex-wrap justify-end gap-1.5 sm:justify-start sm:gap-2 lg:justify-end">
                <Link
                  to="/meal-plan"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-extrabold text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs sm:font-black"
                >
                  Meal Plan
                </Link>

                <Link
                  to="/next-basket"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-emerald-800 sm:gap-1.5 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs sm:font-black"
                >
                  Next Basket
                  <ArrowRight className="h-[11px] w-[11px] sm:h-[13px] sm:w-[13px]" />
                </Link>
              </div>

              <div className="flex justify-end gap-1.5 sm:hidden">
                <Link
                  to="/pantry"
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[8px] font-extrabold whitespace-nowrap text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100"
                >
                  Open Living Pantry
                </Link>

                <Link
                  to="/next-basket"
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[8px] font-extrabold whitespace-nowrap text-white transition hover:bg-emerald-800"
                >
                  Open Next Basket feedback
                  <ArrowRight className="h-[10px] w-[10px]" />
                </Link>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 border-t border-emerald-200 bg-white/45 px-4 py-2.5 sm:flex-none sm:px-8 sm:py-4">
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-2 sm:h-auto sm:grid-cols-2 sm:grid-rows-none sm:gap-3 xl:grid-cols-4">
              <div className="flex min-h-0 items-center gap-2 rounded-xl border border-emerald-100/90 bg-white/80 px-2.5 py-2 shadow-[0_3px_12px_rgba(16,185,129,0.04)] sm:gap-3 sm:rounded-2xl sm:border-0 sm:bg-white/70 sm:px-4 sm:py-3 sm:shadow-none sm:ring-1 sm:ring-emerald-100">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 sm:h-9 sm:w-9 sm:rounded-xl">
                  <PackageCheck className="h-[14px] w-[14px] sm:h-[17px] sm:w-[17px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.04em] text-emerald-700 sm:text-[10px] sm:font-black sm:tracking-[0.09em]">1 · Update Pantry</p>
                  <p className="mt-0.5 text-[9px] font-medium leading-tight text-stone-600 sm:mt-1 sm:text-xs sm:font-semibold">Quantity + Use soon by</p>
                </div>
              </div>

              <div className="flex min-h-0 items-center gap-2 rounded-xl border border-emerald-100/90 bg-white/80 px-2.5 py-2 shadow-[0_3px_12px_rgba(16,185,129,0.04)] sm:gap-3 sm:rounded-2xl sm:border-0 sm:bg-white/70 sm:px-4 sm:py-3 sm:shadow-none sm:ring-1 sm:ring-emerald-100">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 sm:h-9 sm:w-9 sm:rounded-xl">
                  <Clock3 className="h-[14px] w-[14px] sm:h-[17px] sm:w-[17px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.04em] text-emerald-700 sm:text-[10px] sm:font-black sm:tracking-[0.09em]">2 · Review items</p>
                  <p className="mt-0.5 text-[9px] font-medium leading-tight text-stone-600 sm:mt-1 sm:text-xs sm:font-semibold">Check what to use soon</p>
                </div>
              </div>

              <div className="flex min-h-0 items-center gap-2 rounded-xl border border-emerald-100/90 bg-white/80 px-2.5 py-2 shadow-[0_3px_12px_rgba(16,185,129,0.04)] sm:gap-3 sm:rounded-2xl sm:border-0 sm:bg-white/70 sm:px-4 sm:py-3 sm:shadow-none sm:ring-1 sm:ring-emerald-100">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 sm:h-9 sm:w-9 sm:rounded-xl">
                  <CalendarClock className="h-[14px] w-[14px] sm:h-[17px] sm:w-[17px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.04em] text-emerald-700 sm:text-[10px] sm:font-black sm:tracking-[0.09em]">3 · Check meals</p>
                  <p className="mt-0.5 text-[9px] font-medium leading-tight text-stone-600 sm:mt-1 sm:text-xs sm:font-semibold">See what may work earlier</p>
                </div>
              </div>

              <div className="flex min-h-0 items-center gap-2 rounded-xl border border-emerald-100/90 bg-white/80 px-2.5 py-2 shadow-[0_3px_12px_rgba(16,185,129,0.04)] sm:gap-3 sm:rounded-2xl sm:border-0 sm:bg-white/70 sm:px-4 sm:py-3 sm:shadow-none sm:ring-1 sm:ring-emerald-100">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 sm:h-9 sm:w-9 sm:rounded-xl">
                  <ChefHat className="h-[14px] w-[14px] sm:h-[17px] sm:w-[17px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8.5px] font-extrabold uppercase tracking-[0.04em] text-emerald-700 sm:text-[10px] sm:font-black sm:tracking-[0.09em]">4 · Pick a recipe</p>
                  <p className="mt-0.5 text-[9px] font-medium leading-tight text-stone-600 sm:mt-1 sm:text-xs sm:font-semibold">Cook from what you have</p>
                </div>
              </div>
            </div>
          </div>

        </section>

        {error && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <TriangleAlert size={18} className="shrink-0" />
            {error}
          </div>
        )}

        <section className="mt-4 rounded-[24px] border border-indigo-100 bg-[#e8eefc] px-4 py-3 shadow-[0_1px_0_rgba(28,25,23,0.03)] sm:mt-5 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-black tracking-tight text-stone-950 sm:text-xs sm:tracking-normal sm:text-stone-900">
                Evidence review window
              </p>
              <p className="mt-1 whitespace-nowrap text-[9px] font-medium leading-4 text-stone-500 sm:hidden">
                Review use-soon evidence ahead — never an expiry date.
              </p>
              <p className="mt-1 hidden text-[11px] leading-4 text-stone-500 sm:block">
                Change how far ahead EPANTRY reviews household use-soon evidence. This never creates an expiry date.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <div className="inline-flex rounded-xl border border-indigo-200 bg-white/85 p-0.5 sm:p-1">
                {HORIZON_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setHorizonDays(option)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition sm:px-4 sm:py-2 sm:text-xs ${
                      option === horizonDays
                        ? 'bg-indigo-700 text-white shadow-sm'
                        : 'text-stone-600 hover:bg-indigo-50 hover:text-indigo-900'
                    }`}
                  >
                    {option} days
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={load}
                className="grid h-9 w-9 place-items-center rounded-xl border border-indigo-200 bg-white/85 text-indigo-700 transition hover:border-indigo-300 sm:h-10 sm:w-10"
                aria-label="Refresh Waste Reduction"
              >
                <RefreshCw
                  size={16}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2 sm:mt-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-indigo-100 bg-white/70 px-4 py-2.5 sm:py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">
                    {card.label}
                  </p>
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                </div>

                <div className="mt-1 flex items-end gap-3">
                  <p className="text-2xl font-black tracking-tight text-stone-950">
                    {card.value}
                  </p>
                  <p className="pb-0.5 text-[10px] leading-4 text-stone-500">
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-3 space-y-2 sm:mt-6 sm:space-y-5">
          <SectionShell
            eyebrow="Use-soon priority"
            title="Pantry items worth reviewing"
            description="Only current household evidence appears here. No evidence means no artificial urgency."
            mobileDescription="Current Pantry evidence only — no signal, no urgency."
            count={signals.length}
            icon={Clock3}
            iconClassName="bg-violet-100 text-violet-800 ring-1 ring-violet-200"
            badgeClassName="bg-violet-100 text-violet-900"
          >
            {!loading && signals.length === 0 ? (
              <EmptySection
                icon={PackageCheck}
                title="Nothing needs attention in this window"
                body="Your current Pantry evidence does not justify a use-soon or running-low action right now."
              />
            ) : (
              <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
                {visibleSignals.map((signal) => (
                  <article
                    key={signal.signalKey}
                    className="rounded-[18px] border border-violet-100 bg-violet-50/65 p-3 sm:rounded-[22px] sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-violet-900">
                            {PRIORITY_LABELS[signal.priorityClass] || signal.priorityClass}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-stone-600 ring-1 ring-stone-200">
                            {signal.confidenceClass} evidence
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-black text-stone-950 sm:mt-3 sm:text-xl">
                          {signal.ingredientName}
                        </h3>
                      </div>

                      <Clock3 size={19} className="text-violet-700" />
                    </div>

                    <div className="mt-2 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                      <div className="rounded-xl border border-stone-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                          Current signal
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-4 text-stone-800 sm:mt-2 sm:text-sm sm:leading-5">
                          {signal.signalType === 'use_soon'
                            ? `Use soon around ${formatDate(signal.useSoonAt)}`
                            : 'Marked as running low'}
                        </p>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-white p-3 sm:rounded-2xl sm:p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                          Proven balance
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-4 text-stone-800 sm:mt-2 sm:text-sm sm:leading-5">
                          {formatProvenQuantity(signal.provenUnreservedQuantity)}
                        </p>
                      </div>
                    </div>

                    {signal.plannedUseConflict && (
                      <div className="mt-2 flex gap-2 rounded-xl border border-violet-200 bg-violet-100/70 p-3 text-[10px] font-semibold leading-4 text-violet-900 sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-xs sm:leading-5">
                        <CalendarClock size={16} className="mt-0.5 shrink-0" />
                        A planned-use date sits after this use-soon signal. Review the evidence before changing your plan.
                      </div>
                    )}

                    <p className="mt-2 text-[10px] leading-4 text-stone-500 sm:mt-4 sm:text-xs sm:leading-5">
                      Evidence reason: <span className="font-semibold text-stone-700">{formatReason(signal.reasonCode)}</span>
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2 sm:mt-4">
                      <Link
                        to={`/pantry/items/${signal.pantryItemId}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-[10px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                      >
                        Review / correct Pantry evidence
                        <ArrowRight size={13} />
                      </Link>

                      <Link
                        to="/meal-plan"
                        className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-[10px] font-black text-sky-800 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                      >
                        Meal Plan
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {signals.length > 4 && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllSignals((current) => !current)}
                  className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-xs font-black text-violet-800 transition hover:bg-violet-50"
                >
                  {showAllSignals ? 'View less' : `View all (${signals.length})`}
                </button>
              </div>
            )}
          </SectionShell>

          <SectionShell
            eyebrow="Planned-meal rescue"
            title="Meals that may be worth moving earlier"
            mobileTitle="Meals worth moving earlier"
            description="These suggestions only appear when a planned meal can use Pantry evidence before its household use-soon point."
            mobileDescription="Shown when planned meals can use food before use-soon."
            count={groupedRescues.length}
            icon={CalendarClock}
            iconClassName="bg-sky-50 text-sky-700 ring-1 ring-sky-100"
            badgeClassName="bg-sky-50 text-sky-800"
          >
            {!loading && groupedRescues.length === 0 ? (
              <EmptySection
                icon={CalendarClock}
                title="No meal rescue is needed"
                body="No planned meal currently conflicts with a supported use-soon Pantry signal."
              />
            ) : (
              <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
                {groupedRescues.map((rescue) => (
                  <article
                    key={rescue.groupKey}
                    className="rounded-[18px] border border-sky-100 bg-sky-50/45 p-3 sm:rounded-[22px] sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-800 ring-1 ring-sky-100">
                          {rescue.confidenceClass} evidence
                        </span>
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-900">
                          {rescue.affectedItems.length} {rescue.affectedItems.length === 1 ? 'item' : 'items'} to review
                        </span>
                      </div>
                      <CalendarClock size={19} className="text-sky-600" />
                    </div>

                    <h3 className="mt-2 text-base font-black text-stone-950 sm:mt-4 sm:text-xl">
                      {rescue.recipeTitle}
                    </h3>

                    <p className="mt-1 text-[11px] leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
                      This meal is planned after the use-soon dates for the Pantry items below. Review the timing if you want to use them earlier.
                    </p>

                    <div className="mt-2 rounded-xl bg-white p-2.5 ring-1 ring-sky-100 sm:mt-4 sm:rounded-2xl sm:p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                        Planned meal
                      </p>
                      <p className="mt-1 text-sm font-black text-stone-800">
                        {formatDate(rescue.plannedAt)}
                      </p>
                    </div>

                    <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
                      {rescue.affectedItems.map((item) => (
                        <div
                          key={item.pantryItemId}
                          className="flex flex-col gap-2 rounded-xl bg-white p-2.5 ring-1 ring-sky-100 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-2xl sm:p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-black text-stone-900">
                              {item.ingredientName}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-stone-500">
                              Use soon by {formatDate(item.useSoonAt)}
                            </p>
                          </div>

                          <Link
                            to={`/pantry/items/${item.pantryItemId}`}
                            className="shrink-0 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-800"
                          >
                            Correct evidence
                          </Link>
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 sm:mt-4">
                      <Link
                        to="/meal-plan"
                        className="inline-flex rounded-lg bg-sky-700 px-3 py-2 text-[10px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                      >
                        Review Meal Plan
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            id="next-possibility"
            eyebrow="Next possibility"
            title="Recipes that fit what your Pantry can support"
            mobileTitle="Recipes your Pantry can support"
            description="Only published recipes justified by current use-soon evidence are shown here."
            mobileDescription="Published recipes backed by current use-soon evidence only."
            count={possibilities.length}
            icon={ChefHat}
            iconClassName="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            badgeClassName="bg-emerald-50 text-emerald-800"
          >
            {!loading && possibilities.length === 0 ? (
              <EmptySection
                icon={ChefHat}
                title="No recipe possibility is justified right now"
                body="As use-soon Pantry evidence appears, EPANTRY can surface matching published recipes here."
              />
            ) : (
              <div className="grid gap-2 sm:gap-4 lg:grid-cols-3">
                {visiblePossibilities.map((possibility) => (
                  <article
                    key={possibility.possibilityKey}
                    className="overflow-hidden rounded-[18px] border border-stone-200 bg-white shadow-[0_1px_0_rgba(28,25,23,0.03)] sm:rounded-[22px]"
                  >
                    {possibility.heroImageUrl ? (
                      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-stone-100 sm:aspect-auto sm:border-b-0">
                        <img
                          src={possibility.heroImageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover object-center sm:static sm:h-44 sm:object-cover"
                        />
                      </div>
                    ) : (
                      <div className="grid h-32 place-items-center bg-emerald-50 text-emerald-700 sm:h-32">
                        <ChefHat size={28} />
                      </div>
                    )}

                    <div className="border-t border-emerald-100/70 bg-white p-3 sm:border-t-0 sm:p-5">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                          {possibility.confidenceClass} evidence
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                          <CircleGauge size={11} />
                          Deterministic
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-black text-stone-950 sm:mt-4 sm:text-xl">
                        {possibility.recipeTitle}
                      </h3>

                      <p className="mt-1 text-[10px] leading-4 text-stone-500 sm:mt-2 sm:text-xs sm:leading-5">
                        {formatReason(possibility.reasonCode)}
                      </p>

                      <div className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2">
                        {(possibility.matchedIngredients || []).map((match) => (
                          <div
                            key={`${possibility.possibilityKey}:${match.pantryItemId}`}
                            className="rounded-xl bg-stone-50 p-2.5 sm:rounded-2xl sm:p-3"
                          >
                            <p className="text-sm font-black text-stone-800">
                              {match.ingredientName}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-stone-500">
                              Use soon {formatDate(match.useSoonAt)} · {formatProvenQuantity(match.provenUnreservedQuantity)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 sm:mt-4">
                        <Link
                          to={`/recipes/${possibility.recipeSlug}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                        >
                          Open Recipe
                          <ArrowRight size={13} />
                        </Link>

                        {possibility.matchedIngredients?.[0]?.pantryItemId && (
                          <Link
                            to={`/pantry/items/${possibility.matchedIngredients[0].pantryItemId}`}
                            className="rounded-lg border border-stone-300 px-3 py-2 text-[10px] font-black text-stone-700 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
                          >
                            Correct evidence
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}


            {possibilities.length > 3 && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllPossibilities((current) => !current)}
                  className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 transition hover:bg-emerald-50"
                >
                  {showAllPossibilities
                    ? 'View less'
                    : `View all (${possibilities.length})`}
                </button>
              </div>
            )}
          </SectionShell>
        </div>

        <section className="mt-5 overflow-hidden rounded-[22px] border border-emerald-100 bg-emerald-50/60 sm:rounded-[26px]">
          <div className="grid grid-cols-2 sm:grid-cols-1 lg:grid-cols-2">
            <div className="border-r border-emerald-100 p-3 sm:border-r-0 sm:p-6 lg:border-r lg:border-emerald-100">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 sm:h-10 sm:w-10 sm:rounded-2xl">
                  <ShieldCheck className="h-[14px] w-[14px] sm:h-[19px] sm:w-[19px]" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-[10px] font-black leading-tight text-stone-950 sm:text-base">
                    Evidence stays honest
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[8px] font-medium leading-[1.35] text-stone-600 sm:mt-2 sm:line-clamp-none sm:text-sm sm:leading-6">
                    <span className="sm:hidden">Use-soon is guidance, not expiry truth. Verified evidence only.</span>
                    <span className="hidden sm:inline">EPANTRY does not claim a verified expiry date, spoilage state, leftover state or exact quantity unless that exact evidence exists. Use-soon remains household guidance, not expiry truth.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-sky-50/70 p-3 sm:border-t sm:border-sky-100 sm:p-6 lg:border-t-0">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-700 sm:h-10 sm:w-10 sm:rounded-2xl">
                  <RefreshCw className="h-[14px] w-[14px] sm:h-[18px] sm:w-[18px]" />
                </div>

                <div className="min-w-0">
                  <h2 className="text-[10px] font-black leading-tight text-stone-950 sm:text-base">
                    Correct anything that looks wrong
                  </h2>
                  <p className="mt-1 line-clamp-2 text-[8px] font-medium leading-[1.35] text-stone-600 sm:mt-2 sm:line-clamp-none sm:text-sm sm:leading-6">
                    <span className="sm:hidden">Fix Pantry or Basket signals anytime. Orders and payments stay authoritative.</span>
                    <span className="hidden sm:inline">Update Living Pantry evidence when a household signal is wrong, or use Next Basket feedback for purchase recommendations. These corrections never grant recommendation code authority over Cart, Checkout, Order or Payment truth.</span>
                  </p>

                  <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
                    <Link
                      to="/pantry"
                      className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                    >
                      Open Living Pantry
                    </Link>

                    <Link
                      to="/next-basket"
                      className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-xs font-black text-sky-800"
                    >
                      Open Next Basket feedback
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {data?.scanPolicy?.pantry?.truncated && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs leading-5 text-rose-900">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            Pantry evidence scan reached its bounded limit. Recommendations shown are based only on the evidence actually scanned; missing items are not inferred.
          </div>
        )}
      </div>
    </main>
  )
}
