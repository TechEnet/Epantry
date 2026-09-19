import {
  AlertTriangle,
  CheckCircle2,
  Printer,
  ShieldCheck,
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
      <main className="page-shell py-12">
        <div className="rounded-[28px] border border-stone-200 bg-white p-8 text-center text-sm font-bold text-stone-500">
          Loading verified Dish Passport…
        </div>
      </main>
    )
  }

  if (
    error ||
    !passport
  ) {
    return (
      <main className="page-shell py-12">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-8">
          <AlertTriangle className="text-red-700" />
          <h1 className="mt-4 text-xl font-black text-red-950">
            Dish Passport unavailable
          </h1>
          <p className="mt-2 text-sm text-red-800">
            {error ||
              'No effective verified publication was found.'}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-[#f7f5ef] py-8 sm:py-12 print:bg-white">
      <div className="page-shell max-w-5xl">
        <section className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-sm print:border-0 print:shadow-none">
          <header className="bg-stone-950 p-6 text-white sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                  <ShieldCheck size={14} />
                  Published Dish Passport
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight">
                  {passport.dish?.name ||
                    'Dish'}
                </h1>

                <p className="mt-2 text-sm text-stone-400">
                  {passport.outlet?.name ||
                    'Outlet'} · Passport v{passport.versionNumber}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  window.print()
                }
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-stone-900 print:hidden"
              >
                <Printer size={15} />
                Print
              </button>
            </div>
          </header>

          <div className="space-y-7 p-6 sm:p-8">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={18} />
                <div>
                  <p className="text-sm font-black text-emerald-950">
                    Verified governed projection
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    This page is generated from pinned approved source versions. Unknown allergen evidence is not presented as a free-from claim.
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h2 className="text-lg font-black">
                Ingredients
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(passport.ingredients || []).map(
                  (item) => (
                    <div
                      key={`${item.lineNumber}:${item.canonicalIngredientId}`}
                      className="rounded-2xl border border-stone-200 p-4"
                    >
                      <p className="font-black">
                        {item.canonicalName}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {item.quantity} {item.unit}
                        {item.optional
                          ? ' · optional'
                          : ''}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black">
                Allergens & cross-contact
              </h2>

              <div className="mt-3 space-y-2">
                {(passport.allergens || []).length ? (
                  passport.allergens.map(
                    (item) => (
                      <div
                        key={item.allergenId}
                        className="flex flex-col justify-between gap-2 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center"
                      >
                        <p className="font-black">
                          {item.name}
                        </p>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black text-stone-700">
                          {titleize(item.outcome)}
                        </span>
                      </div>
                    ),
                  )
                ) : (
                  <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                    No allergen result rows are present in the pinned approved calculation. This is not a blanket free-from statement.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black">
                Nutrition
              </h2>

              <p className="mt-1 text-xs text-stone-500">
                Basis: {passport.nutrition?.basis || 'Not supplied'}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(passport.nutrition?.nutrients || []).map(
                  (item) => (
                    <div
                      key={item.nutrientId}
                      className="rounded-2xl border border-stone-200 p-4"
                    >
                      <p className="text-xs font-bold text-stone-500">
                        {item.name}
                      </p>
                      <p className="mt-1 text-lg font-black">
                        {item.amount} {item.unit}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black">
                Dietary evaluation
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {(passport.dietary || []).map(
                  (item) => (
                    <span
                      key={item.ruleKey}
                      className="rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-black"
                    >
                      {titleize(item.ruleKey)} · {titleize(item.outcome)}
                    </span>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-stone-50 p-5">
              <h2 className="text-sm font-black">
                Provenance
              </h2>

              <div className="mt-3 space-y-2 text-xs text-stone-500">
                {(passport.provenance || []).map(
                  (source) => (
                    <p key={`${source.sourceType}:${source.sourceId}:${source.version}`}>
                      <strong className="text-stone-700">
                        {titleize(source.sourceType)}
                      </strong>{' '}
                      · version {source.version} · {source.sourceId}
                    </p>
                  ),
                )}
              </div>

              <p className="mt-4 text-[11px] text-stone-400">
                Published {passport.governance?.publishedAt
                  ? new Date(passport.governance.publishedAt).toLocaleString()
                  : '—'}
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}