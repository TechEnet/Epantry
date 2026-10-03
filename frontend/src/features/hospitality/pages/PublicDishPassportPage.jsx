import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Info,
  Leaf,
  Printer,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  useParams,
} from 'react-router-dom'

import {
  getHospitalityErrorMessage,
  getPublicDishPassport,
} from '../services/hospitality.service'

function titleize(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map(
      (part) =>
        `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
    )
    .join(' ')
}

function friendlyOutcome(value) {
  const normalized = String(value || '').trim().toLowerCase()

  const labels = {
    confirmed: 'Confirmed',
    contains: 'Contains',
    may_contain: 'May contain',
    eligible: 'Meets this label',
    not_eligible: 'Does not meet this label',
    excluded: 'Does not apply',
    unknown: 'Not confirmed',
    not_declared: 'Not declared',
    no_evidence: 'No confirmed information',
  }

  return labels[normalized] || titleize(value)
}

function friendlySourceLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()

  const labels = {
    hospitality_production_recipe_version: 'Kitchen recipe',
    production_recipe_version: 'Kitchen recipe',
    recipe_version: 'EPANTRY recipe',
    food_calculation: 'Food information review',
  }

  return labels[normalized] || titleize(value)
}

function formatPublishedAt(value) {
  if (!value) return 'Not available'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'

  return date.toLocaleString()
}

export default function PublicDishPassportPage() {
  const {
    publicId,
  } =
    useParams()

  const [passport, setPassport] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  useEffect(
    () => {
      let active =
        true

      async function load() {
        setLoading(true)
        setError('')

        try {
          const data =
            await getPublicDishPassport(
              publicId,
            )

          if (active) {
            setPassport(
              data?.dishPassport ||
              null,
            )
          }
        } catch (requestError) {
          if (active) {
            setError(
              getHospitalityErrorMessage(
                requestError,
                'Published Dish Passport is unavailable.',
              ),
            )
          }
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }

      load()

      return () => {
        active =
          false
      }
    },
    [publicId],
  )

  if (loading) {
    return (
      <main className="bg-[#f7f5ef] py-8 sm:py-12">
        <div className="page-shell max-w-6xl">
          <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-7 text-center text-sm font-bold text-emerald-900 shadow-sm">
            Loading published dish information…
          </div>
        </div>
      </main>
    )
  }

  if (
    error ||
    !passport
  ) {
    return (
      <main className="bg-[#f7f5ef] py-8 sm:py-12">
        <div className="page-shell max-w-6xl">
          <div className="rounded-[26px] border border-red-200 bg-red-50 p-7 shadow-sm">
            <AlertTriangle className="text-red-700" />
            <h1 className="mt-4 text-xl font-black text-red-950">
              This dish record is not available
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-red-800">
              This published record could not be opened. It may no longer be published, or the link may be invalid. Please ask the outlet for the latest dish information.
            </p>
          </div>
        </div>
      </main>
    )
  }

  const ingredients = passport.ingredients || []
  const allergens = passport.allergens || []
  const nutrients = passport.nutrition?.nutrients || []
  const dietary = passport.dietary || []
  const provenance = passport.provenance || []
  const publishedAt = formatPublishedAt(passport.governance?.publishedAt)

  return (
    <main className="bg-[#f7f5ef] py-5 sm:py-8 print:bg-white print:py-0">
      <div className="page-shell max-w-6xl">
        <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.08)] print:border-0 print:shadow-none">
          <header className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50 p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm">
                  <ShieldCheck size={14} />
                  Published & approved dish record
                </div>

                <h1 className="mt-4 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl lg:text-4xl">
                  {passport.dish?.name ||
                    'Dish'}
                </h1>

                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-stone-600">
                  Approved information about what is in this dish, its allergen checks, nutrition details and dietary labels.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1.5 text-[10px] font-black text-emerald-900 sm:text-xs">
                    <UtensilsCrossed size={13} />
                    {passport.outlet?.name || 'Outlet'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/80 px-3 py-1.5 text-[10px] font-black text-sky-900 sm:text-xs">
                    <BadgeCheck size={13} />
                    Record version {passport.versionNumber}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-100/80 px-3 py-1.5 text-[10px] font-black text-violet-900 sm:text-xs">
                    <Clock3 size={13} />
                    Published {publishedAt}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  window.print()
                }
                className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-800 shadow-sm hover:bg-stone-50 print:hidden"
              >
                <Printer size={15} />
                Print record
              </button>
            </div>
          </header>

          <div className="space-y-4 p-4 sm:space-y-5 sm:p-6 lg:p-7">
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={19} />
                <div>
                  <p className="text-sm font-black text-emerald-950 sm:text-base">
                    This is the approved published information for this dish
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-emerald-800 sm:text-sm sm:leading-6">
                    EPANTRY shows only information included in the approved record. If an allergen or dietary claim has not been confirmed, this page will not label the dish as free from it.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-[22px] border border-emerald-200 bg-emerald-50/75 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
                    <Leaf size={17} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                      Ingredients
                    </p>
                    <h2 className="mt-0.5 text-base font-black text-stone-950 sm:text-lg">
                      What is used in this dish
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      These are the ingredients and quantities recorded in the approved kitchen recipe.
                    </p>
                  </div>
                </div>

                {ingredients.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {ingredients.map(
                      (item) => (
                        <div
                          key={`${item.lineNumber}:${item.canonicalIngredientId}`}
                          className="rounded-[16px] border border-white/90 bg-white/85 p-3.5 shadow-sm"
                        >
                          <p className="text-sm font-black text-stone-950">
                            {item.canonicalName}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            {item.quantity} {item.unit}
                            {item.optional
                              ? ' · Optional'
                              : ''}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] border border-emerald-100 bg-white/75 p-4 text-xs font-semibold leading-5 text-stone-600">
                    No ingredient list is available in this published record yet.
                  </div>
                )}
              </section>

              <section className="rounded-[22px] border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                    <AlertTriangle size={17} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800 sm:text-[10px]">
                      Allergy information
                    </p>
                    <h2 className="mt-0.5 text-base font-black text-stone-950 sm:text-lg">
                      Allergens & cross-contact
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Check this section carefully if you have a food allergy or intolerance.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {allergens.length ? (
                    allergens.map(
                      (item) => (
                        <div
                          key={item.allergenId}
                          className="flex flex-col justify-between gap-2 rounded-[16px] border border-white/90 bg-white/85 p-3.5 shadow-sm sm:flex-row sm:items-center"
                        >
                          <p className="text-sm font-black text-stone-950">
                            {item.name}
                          </p>
                          <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black text-amber-900">
                            {friendlyOutcome(item.outcome)}
                          </span>
                        </div>
                      ),
                    )
                  ) : (
                    <div className="rounded-[16px] border border-amber-200 bg-white/75 p-4">
                      <div className="flex items-start gap-2.5">
                        <Info className="mt-0.5 shrink-0 text-amber-700" size={17} />
                        <p className="text-xs font-semibold leading-5 text-stone-700">
                          No approved allergen information has been added to this record yet. This does <strong>not</strong> mean the dish is allergen-free. If you have an allergy, please check with the outlet before ordering.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[22px] border border-sky-200 bg-sky-50/80 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-600 text-white shadow-sm">
                    <HeartPulse size={17} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                      Nutrition
                    </p>
                    <h2 className="mt-0.5 text-base font-black text-stone-950 sm:text-lg">
                      Nutrition information
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Only approved nutrition values are shown here.
                    </p>
                  </div>
                </div>

                {nutrients.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
                    {nutrients.map(
                      (item) => (
                        <div
                          key={item.nutrientId}
                          className="rounded-[16px] border border-white/90 bg-white/85 p-3.5 shadow-sm"
                        >
                          <p className="text-[10px] font-bold text-stone-500">
                            {item.name}
                          </p>
                          <p className="mt-1 text-base font-black text-stone-950">
                            {item.amount} {item.unit}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] border border-sky-200 bg-white/75 p-4 text-xs font-semibold leading-5 text-stone-700">
                    Nutrition values have not been added to this approved dish record yet.
                  </div>
                )}
              </section>

              <section className="rounded-[22px] border border-violet-200 bg-violet-50/80 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
                    <BadgeCheck size={17} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                      Dietary information
                    </p>
                    <h2 className="mt-0.5 text-base font-black text-stone-950 sm:text-lg">
                      Dietary labels
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Only dietary labels confirmed in the approved record are shown as confirmed.
                    </p>
                  </div>
                </div>

                {dietary.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {dietary.map(
                      (item) => (
                        <span
                          key={item.ruleKey}
                          className="rounded-full border border-violet-200 bg-white/85 px-3 py-2 text-[10px] font-black text-violet-900 shadow-sm sm:text-xs"
                        >
                          {titleize(item.ruleKey)} · {friendlyOutcome(item.outcome)}
                        </span>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] border border-violet-200 bg-white/75 p-4 text-xs font-semibold leading-5 text-stone-700">
                    No approved dietary labels have been added to this dish record yet.
                  </div>
                )}
              </section>
            </div>

            <section className="rounded-[22px] border border-stone-200 bg-stone-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-stone-800 text-white">
                  <ShieldCheck size={17} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-500 sm:text-[10px]">
                    Record details
                  </p>
                  <h2 className="mt-0.5 text-base font-black text-stone-950 sm:text-lg">
                    What this published record is based on
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    These versions were used when this dish information was approved and published. Older published versions remain part of the record history.
                  </p>
                </div>
              </div>

              {provenance.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {provenance.map(
                    (source) => (
                      <div
                        key={`${source.sourceType}:${source.sourceId}:${source.version}`}
                        className="rounded-[16px] border border-stone-200 bg-white p-3.5"
                      >
                        <p className="text-xs font-black text-stone-800">
                          {friendlySourceLabel(source.sourceType)}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-stone-500">
                          Approved version {source.version}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-stone-500 sm:text-xs">
                <Clock3 size={14} />
                Published {publishedAt}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
