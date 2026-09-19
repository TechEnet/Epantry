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
    <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[22px] border border-dashed border-sky-100 bg-sky-50/70 px-6 py-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/90 text-sky-700 shadow-sm ring-1 ring-sky-100">
        <Icon size={20} />
      </div>

      <h3 className="mt-4 text-base font-black text-stone-950">
        {title}
      </h3>

      <p className="mt-2 max-w-xl text-sm leading-6 text-stone-500">
        {body}
      </p>
    </div>
  )
}

function SectionShell({
  eyebrow,
  title,
  description,
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
      className="scroll-mt-28 overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fbff] shadow-[0_1px_0_rgba(28,25,23,0.03)]"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconClassName}`}>
            <Icon size={20} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-400">
              {eyebrow}
            </p>

            <h2 className="mt-1 text-xl font-black tracking-tight text-stone-950 sm:text-2xl">
              {title}
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">
              {description}
            </p>
          </div>
        </div>

        <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] ${badgeClassName}`}>
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="p-5 sm:p-6">
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
        <section className="overflow-hidden rounded-[30px] border border-emerald-200 bg-[#dff7ef] shadow-[0_14px_50px_rgba(16,185,129,0.08)]">
          <div className="grid gap-7 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-4">
              <div className="grid h-13 w-13 shrink-0 place-items-center rounded-[18px] bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
                <Sparkles size={23} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  Use what you have first
                </p>

                <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                  Use soon. Plan smarter. Waste less.
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                  Keep your Pantry current. EPANTRY shows what to use soon, which meals may be worth cooking earlier, and recipes that fit what you already have. Use soon by is a household reminder, not an expiry date.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link
                to="/meal-plan"
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-800 transition hover:border-indigo-300 hover:bg-indigo-100"
              >
                Meal Plan
              </Link>

              <Link
                to="/next-basket"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-800"
              >
                Next Basket
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="border-t border-emerald-200 bg-white/45 px-6 py-4 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-emerald-100">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <PackageCheck size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.09em] text-emerald-700">1 · Update Pantry</p>
                  <p className="mt-1 text-xs font-semibold text-stone-600">Quantity + Use soon by</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-emerald-100">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Clock3 size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.09em] text-emerald-700">2 · Review items</p>
                  <p className="mt-1 text-xs font-semibold text-stone-600">Check what to use soon</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-emerald-100">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <CalendarClock size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.09em] text-emerald-700">3 · Check meals</p>
                  <p className="mt-1 text-xs font-semibold text-stone-600">See what may work earlier</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-emerald-100">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <ChefHat size={17} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.09em] text-emerald-700">4 · Pick a recipe</p>
                  <p className="mt-1 text-xs font-semibold text-stone-600">Cook from what you have</p>
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

        <section className="mt-5 rounded-[24px] border border-indigo-100 bg-[#e8eefc] px-5 py-4 shadow-[0_1px_0_rgba(28,25,23,0.03)] sm:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-stone-900">
                Evidence review window
              </p>
              <p className="mt-1 text-[11px] leading-4 text-stone-500">
                Change how far ahead EPANTRY reviews household use-soon evidence. This never creates an expiry date.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-indigo-200 bg-white/85 p-1">
                {HORIZON_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setHorizonDays(option)}
                    className={`rounded-lg px-4 py-2 text-xs font-black transition ${
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
                className="grid h-10 w-10 place-items-center rounded-xl border border-indigo-200 bg-white/85 text-indigo-700 transition hover:border-indigo-300"
                aria-label="Refresh Waste Reduction"
              >
                <RefreshCw
                  size={16}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-indigo-100 bg-white/70 px-4 py-3"
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

        <div className="mt-6 space-y-5">
          <SectionShell
            eyebrow="Use-soon priority"
            title="Pantry items worth reviewing"
            description="Only current household evidence appears here. No evidence means no artificial urgency."
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
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleSignals.map((signal) => (
                  <article
                    key={signal.signalKey}
                    className="rounded-[22px] border border-violet-100 bg-violet-50/65 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-violet-900">
                            {PRIORITY_LABELS[signal.priorityClass] || signal.priorityClass}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.07em] text-stone-600 ring-1 ring-stone-200">
                            {signal.confidenceClass} evidence
                          </span>
                        </div>

                        <h3 className="mt-3 text-xl font-black text-stone-950">
                          {signal.ingredientName}
                        </h3>
                      </div>

                      <Clock3 size={19} className="text-violet-700" />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                          Current signal
                        </p>
                        <p className="mt-2 text-sm font-bold leading-5 text-stone-800">
                          {signal.signalType === 'use_soon'
                            ? `Use soon around ${formatDate(signal.useSoonAt)}`
                            : 'Marked as running low'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-stone-200 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                          Proven balance
                        </p>
                        <p className="mt-2 text-sm font-bold leading-5 text-stone-800">
                          {formatProvenQuantity(signal.provenUnreservedQuantity)}
                        </p>
                      </div>
                    </div>

                    {signal.plannedUseConflict && (
                      <div className="mt-4 flex gap-2 rounded-2xl border border-violet-200 bg-violet-100/70 p-4 text-xs font-semibold leading-5 text-violet-900">
                        <CalendarClock size={16} className="mt-0.5 shrink-0" />
                        A planned-use date sits after this use-soon signal. Review the evidence before changing your plan.
                      </div>
                    )}

                    <p className="mt-4 text-xs leading-5 text-stone-500">
                      Evidence reason: <span className="font-semibold text-stone-700">{formatReason(signal.reasonCode)}</span>
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to={`/pantry/items/${signal.pantryItemId}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white"
                      >
                        Review / correct Pantry evidence
                        <ArrowRight size={13} />
                      </Link>

                      <Link
                        to="/meal-plan"
                        className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-xs font-black text-sky-800"
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
            description="These suggestions only appear when a planned meal can use Pantry evidence before its household use-soon point."
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
              <div className="grid gap-4 lg:grid-cols-2">
                {groupedRescues.map((rescue) => (
                  <article
                    key={rescue.groupKey}
                    className="rounded-[22px] border border-sky-100 bg-sky-50/45 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-800 ring-1 ring-sky-100">
                          {rescue.confidenceClass} evidence
                        </span>
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-sky-900">
                          {rescue.affectedItems.length} {rescue.affectedItems.length === 1 ? 'item' : 'items'} to review
                        </span>
                      </div>
                      <CalendarClock size={19} className="text-sky-600" />
                    </div>

                    <h3 className="mt-4 text-xl font-black text-stone-950">
                      {rescue.recipeTitle}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      This meal is planned after the use-soon dates for the Pantry items below. Review the timing if you want to use them earlier.
                    </p>

                    <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-sky-100">
                      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                        Planned meal
                      </p>
                      <p className="mt-1 text-sm font-black text-stone-800">
                        {formatDate(rescue.plannedAt)}
                      </p>
                    </div>

                    <div className="mt-3 space-y-2">
                      {rescue.affectedItems.map((item) => (
                        <div
                          key={item.pantryItemId}
                          className="flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-sky-100 sm:flex-row sm:items-center sm:justify-between"
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

                    <div className="mt-4">
                      <Link
                        to="/meal-plan"
                        className="inline-flex rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-black text-white"
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
            description="Only published recipes justified by current use-soon evidence are shown here."
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
              <div className="grid gap-4 lg:grid-cols-3">
                {visiblePossibilities.map((possibility) => (
                  <article
                    key={possibility.possibilityKey}
                    className="overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_1px_0_rgba(28,25,23,0.03)]"
                  >
                    {possibility.heroImageUrl ? (
                      <img
                        src={possibility.heroImageUrl}
                        alt=""
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-32 place-items-center bg-emerald-50 text-emerald-700">
                        <ChefHat size={28} />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800">
                          {possibility.confidenceClass} evidence
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase text-stone-600">
                          <CircleGauge size={11} />
                          Deterministic
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-black text-stone-950">
                        {possibility.recipeTitle}
                      </h3>

                      <p className="mt-2 text-xs leading-5 text-stone-500">
                        {formatReason(possibility.reasonCode)}
                      </p>

                      <div className="mt-4 space-y-2">
                        {(possibility.matchedIngredients || []).map((match) => (
                          <div
                            key={`${possibility.possibilityKey}:${match.pantryItemId}`}
                            className="rounded-2xl bg-stone-50 p-3"
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

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to={`/recipes/${possibility.recipeSlug}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white"
                        >
                          Open Recipe
                          <ArrowRight size={13} />
                        </Link>

                        {possibility.matchedIngredients?.[0]?.pantryItemId && (
                          <Link
                            to={`/pantry/items/${possibility.matchedIngredients[0].pantryItemId}`}
                            className="rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-black text-stone-700"
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

        <section className="mt-5 overflow-hidden rounded-[26px] border border-emerald-100 bg-emerald-50/60">
          <div className="grid lg:grid-cols-2">
            <div className="p-6 lg:border-r lg:border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <h2 className="text-base font-black text-stone-950">
                    Evidence stays honest
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    EPANTRY does not claim a verified expiry date, spoilage state, leftover state or exact quantity unless that exact evidence exists. Use-soon remains household guidance, not expiry truth.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-sky-100 bg-sky-50/70 p-6 lg:border-t-0">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700">
                  <RefreshCw size={18} />
                </div>

                <div className="min-w-0">
                  <h2 className="text-base font-black text-stone-950">
                    Correct anything that looks wrong
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Update Living Pantry evidence when a household signal is wrong, or use Next Basket feedback for purchase recommendations. These corrections never grant recommendation code authority over Cart, Checkout, Order or Payment truth.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
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
