import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBasket,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  addProductPassportToPantry,
  getProductPassport,
  getUniversalProductErrorMessage,
} from '../services/universalProduct.service'

function formatDate(value) {
  if (!value) {
    return 'Open-ended'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat(
    'en-IN',
    {
      dateStyle:
        'medium',
    },
  ).format(
    date,
  )
}

function quantityText(
  quantity,
) {
  if (
    !quantity ||
    quantity.value === null ||
    quantity.value ===
      undefined
  ) {
    return 'Not declared'
  }

  return `${quantity.value} ${quantity.unit || ''}`.trim()
}

function titleCase(value) {
  return String(
    value || '',
  )
    .replace(
      /_/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    )
}

export default function ProductPassportPage() {
  const {
    productVersionId,
  } =
    useParams()

  const [
    passport,
    setPassport,
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
    useState('')

  const [
    pantryBusy,
    setPantryBusy,
  ] =
    useState(false)

  const [
    pantryNotice,
    setPantryNotice,
  ] =
    useState('')

  useEffect(
    () => {
      let active =
        true

      setLoading(true)
      setError('')

      getProductPassport(
        productVersionId,
      )
        .then(
          (
            result,
          ) => {
            if (active) {
              setPassport(
                result?.passport ||
                  null,
              )
            }
          },
        )
        .catch(
          (
            requestError,
          ) => {
            if (active) {
              setError(
                getUniversalProductErrorMessage(
                  requestError,
                  'Unable to load this Product Passport.',
                ),
              )
            }
          },
        )
        .finally(
          () => {
            if (active) {
              setLoading(
                false,
              )
            }
          },
        )

      return () => {
        active =
          false
      }
    },
    [
      productVersionId,
    ],
  )

  async function handleAddToPantry() {
    if (
      pantryBusy
    ) {
      return
    }

    setPantryBusy(
      true,
    )

    setPantryNotice('')

    try {
      await addProductPassportToPantry({
        productVersionId,
      })

      setPantryNotice(
        'Added to Living Pantry as a customer-confirmed barcode acquisition signal.',
      )
    } catch (
      requestError
    ) {
      setPantryNotice(
        getUniversalProductErrorMessage(
          requestError,
          'Unable to add this product to your pantry.',
        ),
      )
    } finally {
      setPantryBusy(
        false,
      )
    }
  }

  if (loading) {
    return (
      <main className="page-shell grid min-h-[420px] place-items-center py-10">
        <div className="text-center">
          <LoaderCircle
            size={30}
            className="mx-auto animate-spin text-emerald-700"
          />

          <p className="mt-3 text-sm font-bold text-stone-500">
            Loading Product Passport…
          </p>
        </div>
      </main>
    )
  }

  if (
    error ||
    !passport
  ) {
    return (
      <main className="page-shell py-10">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-start gap-3">
            <CircleAlert
              size={22}
              className="mt-0.5 shrink-0"
            />

            <div>
              <h1 className="text-xl font-black">
                Product Passport unavailable
              </h1>

              <p className="mt-2 text-sm leading-6">
                {error ||
                  'The requested published product could not be found.'}
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const product =
    passport.product ||
    {}

  const safety =
    passport.safety ||
    {}

  return (
    <main className="page-shell py-8 sm:py-10">
      <Link
        to="/scan"
        className="focus-ring inline-flex items-center gap-2 text-sm font-black text-stone-600 hover:text-emerald-800"
      >
        <ArrowLeft
          size={17}
        />

        Back to Scan Anything
      </Link>

      <section className="mt-5 overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="bg-stone-100 p-6 sm:p-8">
            {product
              .image
              ?.url ? (
              <img
                src={
                  product
                    .image
                    .url
                }
                alt={
                  product
                    .image
                    .alt ||
                  product.displayName
                }
                className="aspect-square w-full rounded-[24px] object-cover shadow-sm"
              />
            ) : (
              <div className="grid aspect-square w-full place-items-center rounded-[24px] bg-white text-stone-400">
                <PackageCheck
                  size={46}
                />
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                <CheckCircle2
                  size={14}
                />

                {passport
                  .verification
                  ?.state ===
                'verified_historical'
                  ? 'Verified historical version'
                  : 'Verified current version'}
              </span>

              <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-600">
                Canonical EPANTRY Product Version
              </span>
            </div>

            <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
              {product
                .brand
                ?.name ||
                'Product'}
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              {
                product.displayName
              }
            </h1>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-stone-500">
              <span>
                GTIN:{' '}
                {product.gtin ||
                  'Not declared'}
              </span>

              <span>
                Pack:{' '}
                {quantityText(
                  product.netQuantity,
                )}
              </span>

              <span>
                Origin:{' '}
                {product.countryOfOrigin ||
                  'Not declared'}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={
                  pantryBusy
                }
                onClick={
                  handleAddToPantry
                }
                className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {pantryBusy ? (
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <ShoppingBasket
                    size={17}
                  />
                )}

                Add to Pantry
              </button>

              {product.slug ? (
                <Link
                  to={`/grocery/product/${encodeURIComponent(
                    product.slug,
                  )}`}
                  className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
                >
                  <Search
                    size={17}
                  />

                  Product choices
                </Link>
              ) : null}

              <Link
                to={`/search?q=${encodeURIComponent(
                  product.displayName ||
                    '',
                )}`}
                className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 text-sm font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
              >
                See recipes / alternatives
              </Link>
            </div>

            {pantryNotice ? (
              <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-xs font-bold leading-5 text-stone-600">
                {
                  pantryNotice
                }
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-stone-950">
              Ingredients
            </h2>

            {product.ingredientDeclarationText ? (
              <p className="mt-4 text-sm leading-7 text-stone-700">
                {
                  product.ingredientDeclarationText
                }
              </p>
            ) : (
              <p className="mt-4 text-sm font-semibold text-stone-500">
                Ingredient declaration is not available on this published version.
              </p>
            )}

            {product
              .ingredients
              ?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {product.ingredients.map(
                  (
                    ingredient,
                  ) => (
                    <span
                      key={`${ingredient.ingredientId}-${ingredient.order}`}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700"
                    >
                      {ingredient.displayName ||
                        ingredient.ingredientId}
                    </span>
                  ),
                )}
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black text-stone-950">
              Nutrition
            </h2>

            {product
              .nutrition
              ?.nutrients
              ?.length ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
                {product.nutrition.nutrients.map(
                  (
                    nutrient,
                    index,
                  ) => (
                    <div
                      key={`${nutrient.nutrientKey}-${index}`}
                      className="flex items-center justify-between gap-4 border-b border-stone-100 px-4 py-3 last:border-b-0"
                    >
                      <span className="text-sm font-bold text-stone-700">
                        {titleCase(
                          nutrient.nutrientKey,
                        )}
                      </span>

                      <span className="text-sm font-black text-stone-950">
                        {
                          nutrient.amount
                        }{' '}
                        {
                          nutrient.unit
                        }
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-stone-500">
                Nutrition values are not available on this published version.
              </p>
            )}
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <ShieldCheck
                size={20}
                className="text-emerald-700"
              />

              <h2 className="text-xl font-black text-stone-950">
                Allergens, claims & certifications
              </h2>
            </div>

            <div className="mt-5 rounded-2xl bg-stone-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                Allergen coverage
              </p>

              <p className="mt-2 text-sm font-bold text-stone-800">
                {safety.allergenCoverageStatus ===
                'declared_relationships_available'
                  ? 'Declared allergen relationships are available.'
                  : 'Allergen coverage is unknown / not declared. This does not mean allergen-free.'}
              </p>
            </div>

            {safety
              .allergens
              ?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {safety.allergens.map(
                  (
                    allergen,
                    index,
                  ) => (
                    <span
                      key={`${allergen.allergenKey}-${index}`}
                      className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-700"
                    >
                      {titleCase(
                        allergen.allergenKey,
                      )}{' '}
                      ·{' '}
                      {titleCase(
                        allergen.relationType,
                      )}
                    </span>
                  ),
                )}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                  Claims
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {safety
                    .claims
                    ?.length ? (
                    safety.claims.map(
                      (
                        claim,
                        index,
                      ) => (
                        <span
                          key={`${claim.key}-${index}`}
                          className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                        >
                          {claim.label ||
                            claim.key}
                        </span>
                      ),
                    )
                  ) : (
                    <span className="text-sm font-semibold text-stone-400">
                      None declared
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                  Certifications
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {safety
                    .certifications
                    ?.length ? (
                    safety.certifications.map(
                      (
                        certification,
                        index,
                      ) => (
                        <span
                          key={`${certification.key}-${index}`}
                          className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"
                        >
                          {certification.label ||
                            certification.key}
                        </span>
                      ),
                    )
                  ) : (
                    <span className="text-sm font-semibold text-stone-400">
                      None declared
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-stone-950">
              Evidence status
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-stone-500">
                  Field evidence
                </span>

                <span className="font-black text-stone-900">
                  {passport
                    .evidence
                    ?.fieldEvidenceCount ||
                    0}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="font-semibold text-stone-500">
                  Review-required evidence
                </span>

                <span className="font-black text-stone-900">
                  {passport
                    .evidence
                    ?.hasReviewRequiredEvidence
                    ? 'Yes'
                    : 'No'}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="font-semibold text-stone-500">
                  Source of truth
                </span>

                <span className="text-right text-xs font-black text-emerald-700">
                  Published canonical version
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3
                size={19}
                className="text-emerald-700"
              />

              <h2 className="text-lg font-black text-stone-950">
                Historical pack timeline
              </h2>
            </div>

            <div className="mt-5 space-y-3">
              {(passport.historicalTimeline ||
                []).map(
                (
                  version,
                ) => (
                  <Link
                    key={
                      version.productVersionId
                    }
                    to={`/products/${encodeURIComponent(
                      version.productVersionId,
                    )}/passport`}
                    className="focus-ring block rounded-2xl border border-stone-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-900">
                          Version{' '}
                          {
                            version.version
                          }
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-5 text-stone-500">
                          {formatDate(
                            version.effectiveFrom,
                          )}{' '}
                          →{' '}
                          {formatDate(
                            version.effectiveTo,
                          )}
                        </p>
                      </div>

                      {version.currentNow ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-800">
                          Current
                        </span>
                      ) : null}
                    </div>

                    {version.changeReason ? (
                      <p className="mt-3 text-xs leading-5 text-stone-600">
                        {
                          version.changeReason
                        }
                      </p>
                    ) : null}
                  </Link>
                ),
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <div className="flex items-start gap-3">
              <CircleAlert
                size={20}
                className="mt-0.5 shrink-0"
              />

              <div>
                <h2 className="text-sm font-black">
                  Safety interpretation
                </h2>

                <p className="mt-2 text-xs leading-5 text-amber-900/80">
                  Product Passport shows stored evidence and platform calculations. Unknown or absent data must not be interpreted as a medical or allergen-safety guarantee.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}