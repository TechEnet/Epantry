import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function titleCase(
  value,
) {
  return String(
    value ||
      '',
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

function displayName(
  item,
  fallback,
) {
  return (
    item?.name ||
    item?.label ||
    item?.key ||
    fallback
  )
}

function statusDefinition(
  status,
) {
  switch (
    status
  ) {
    case 'verified':
      return {
        label:
          'Verified source',

        classes:
          'border-emerald-200 bg-emerald-50 text-emerald-800',

        Icon:
          BadgeCheck,
      }

    case 'calculated':
      return {
        label:
          'Deterministically calculated',

        classes:
          'border-blue-200 bg-blue-50 text-blue-800',

        Icon:
          FlaskConical,
      }

    case 'declared':
      return {
        label:
          'Source declared',

        classes:
          'border-amber-200 bg-amber-50 text-amber-800',

        Icon:
          ShieldCheck,
      }

    default:
      return {
        label:
          'Cannot verify',

        classes:
          'border-red-200 bg-red-50 text-red-800',

        Icon:
          AlertTriangle,
      }
  }
}

/*
|--------------------------------------------------------------------------
| Badge
|--------------------------------------------------------------------------
*/

function StatusBadge({
  status,
}) {
  const definition =
    statusDefinition(
      status,
    )

  const Icon =
    definition.Icon

  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-full',
        'border',
        'px-3',
        'py-1.5',
        'text-[10px]',
        'font-black',
        'uppercase',
        'tracking-[0.08em]',
        definition.classes,
      ].join(
        ' ',
      )}
    >
      <Icon
        size={13}
        aria-hidden="true"
      />

      {definition.label}
    </span>
  )
}

function customerProductStatusDefinition(
  status,
) {
  switch (
    status
  ) {
    case 'verified':
      return {
        label:
          'Verified evidence',

        description:
          'Published food information is supported by governed evidence reviewed by EPANTRY.',

        classes:
          'border-emerald-200 bg-emerald-50 text-emerald-800',

        Icon:
          BadgeCheck,
      }

    case 'calculated':
      return {
        label:
          'Calculated from reviewed data',

        description:
          'Some values were calculated from reviewed product information using governed calculation rules.',

        classes:
          'border-blue-200 bg-blue-50 text-blue-800',

        Icon:
          FlaskConical,
      }

    case 'declared':
      return {
        label:
          'Reviewed declaration',

        description:
          'The product information was submitted with source evidence and reviewed before publication. This is not independent laboratory testing by EPANTRY.',

        classes:
          'border-amber-200 bg-amber-50 text-amber-800',

        Icon:
          ShieldCheck,
      }

    default:
      return {
        label:
          'Verification incomplete',

        description:
          'Some required evidence is missing or uncertain, so stronger nutrition or safety claims cannot be confirmed.',

        classes:
          'border-red-200 bg-red-50 text-red-800',

        Icon:
          AlertTriangle,
      }
  }
}

function CustomerProductStatusBadge({
  status,
}) {
  const definition =
    customerProductStatusDefinition(
      status,
    )

  const Icon =
    definition.Icon

  return (
    <span
      className={[
        'inline-flex',
        'items-center',
        'gap-1.5',
        'rounded-full',
        'border',
        'px-3',
        'py-1.5',
        'text-[10px]',
        'font-black',
        'uppercase',
        'tracking-[0.08em]',
        definition.classes,
      ].join(
        ' ',
      )}
    >
      <Icon
        size={13}
        aria-hidden="true"
      />

      {definition.label}
    </span>
  )
}

function friendlyProductSourceLabel(
  sourceType,
) {
  const normalized =
    String(
      sourceType ||
        '',
    )
      .trim()
      .toLowerCase()

  if (
    normalized.includes(
      'product_version',
    ) ||
    normalized.includes(
      'productversion',
    )
  ) {
    return 'Approved product information'
  }

  if (
    normalized.includes(
      'evidence',
    )
  ) {
    return 'Submitted product evidence'
  }

  if (
    normalized.includes(
      'package',
    ) ||
    normalized.includes(
      'label',
    )
  ) {
    return 'Product package or label'
  }

  if (
    normalized.includes(
      'operator',
    ) ||
    normalized.includes(
      'declaration',
    )
  ) {
    return 'Submitted product declaration'
  }

  return sourceType
    ? titleCase(
        sourceType,
      )
    : 'Reviewed product source'
}

function formatPublicReviewDate(
  value,
) {
  if (!value) {
    return null
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
    return null
  }

  return new Intl.DateTimeFormat(
    'en',
    {
      day:
        'numeric',
      month:
        'short',
      year:
        'numeric',
    },
  ).format(
    date,
  )
}

/*
|--------------------------------------------------------------------------
| Section
|--------------------------------------------------------------------------
*/

function IntelligenceSection({
  title,
  description,
  children,
  productStyle =
    false,
}) {
  if (!productStyle) {
    return (
      <section className="rounded-[24px] border border-[#e3d7c2] bg-[#fffdf8] p-5 shadow-[0_10px_28px_rgba(92,70,38,0.06)]">

        <h3 className="font-serif text-xl font-semibold text-[#163b2a]">
          {title}
        </h3>

        {description && (
          <p className="mt-1.5 text-xs leading-5 text-stone-500">
            {description}
          </p>
        )}

        <div className="mt-4">
          {children}
        </div>

      </section>
    )
  }

  return (
    <section className="h-full overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_14px_34px_rgba(4,120,87,0.11)] ring-1 ring-emerald-100">

      <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-5 py-4">

        <h3 className="text-sm font-black text-white">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-xs leading-5 text-emerald-50/80">
            {description}
          </p>
        )}

      </div>

      <div className="p-5">
        {children}
      </div>

    </section>
  )
}

function ProductAccordion({
  title,
  children,
  description =
    '',
  icon: Icon =
    null,
}) {
  if (
    !description
  ) {
    return (
      <details className="group border-b border-stone-200 last:border-b-0">
        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
                <Icon
                  size={17}
                  aria-hidden="true"
                />
              </span>
            )}

            <div className="min-w-0">
              <h3 className="text-sm font-black text-stone-950 transition-colors duration-200 group-open:text-emerald-900">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-stone-500 group-open:hidden">
                Click to view details
              </p>
            </div>
          </div>

          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
            <ChevronDown
              size={17}
              className="transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>

        <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
          {children}
        </div>
      </details>
    )
  }

  return (
    <details className="group border-b border-stone-200 last:border-b-0">
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
              <Icon
                size={17}
                aria-hidden="true"
              />
            </span>
          )}

          <div className="min-w-0">
            <h3 className="text-sm font-black text-stone-950 transition-colors duration-200 group-open:text-emerald-900">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-stone-500 group-open:hidden">
              {description}
            </p>
          </div>
        </div>

        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition duration-200 group-hover:border-emerald-200 group-hover:text-emerald-800 group-open:border-emerald-300 group-open:bg-emerald-700 group-open:text-white">
          <ChevronDown
            size={17}
            className="transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>

      <div className="border-t border-emerald-100 bg-white px-5 py-5 sm:px-6">
        {children}
      </div>
    </details>
  )
}

/*
|--------------------------------------------------------------------------
| Empty
|--------------------------------------------------------------------------
*/

function EmptyIntelligence({
  children,
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-5 text-stone-600">

      <CircleHelp
        size={16}
        className="mt-0.5 shrink-0 text-stone-400"
        aria-hidden="true"
      />

      <p>
        {children}
      </p>

    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Food Intelligence Panel
|--------------------------------------------------------------------------
*/

export default function FoodIntelligencePanel({
  foodIntelligence,
  title =
    'Food Intelligence',
  recipeDetailPortal =
    false,
}) {
  const [
    dietaryFilter,
    setDietaryFilter,
  ] =
    useState(
      'all',
    )


  const [
    productTargets,
    setProductTargets,
  ] =
    useState({
      dietary:
        null,
      lineage:
        null,
      foodIntelligence:
        null,
      allergen:
        null,
      nutrition:
        null,
    })

  const [
    recipeTargets,
    setRecipeTargets,
  ] =
    useState({
      nutrition:
        null,
      allergen:
        null,
      dietary:
        null,
      lineage:
        null,
    })

  const nutrition =
    Array.isArray(
      foodIntelligence
        ?.nutrition,
    )
      ? foodIntelligence.nutrition
      : []

  const allergens =
    Array.isArray(
      foodIntelligence
        ?.allergens,
    )
      ? foodIntelligence.allergens
      : []

  const allergenStatement =
    String(
      foodIntelligence
        ?.allergenStatement ||
      '',
    ).trim()

  const dietary =
    Array.isArray(
      foodIntelligence
        ?.dietary,
    )
      ? foodIntelligence.dietary
      : []

  const filteredDietary =
    useMemo(
      () => {
        if (
          dietaryFilter ===
          'all'
        ) {
          return dietary
        }

        return dietary.filter(
          (
            item,
          ) =>
            item?.status ===
            dietaryFilter,
        )
      },
      [
        dietary,
        dietaryFilter,
      ],
    )

  const verificationStatus =
    foodIntelligence
      ?.verificationStatus ||
    'cannot_verify'

  const available =
    foodIntelligence
      ?.available ===
    true

  const subjectLabel =
    foodIntelligence
      ?.subject
      ?.type ===
      'product_version'
      ? 'Product'
      : 'Recipe'

  const isProductSubject =
    subjectLabel ===
    'Product'


  useEffect(
    () => {
      if (
        !isProductSubject ||
        typeof document ===
          'undefined'
      ) {
        return undefined
      }

      let animationFrameId =
        null

      let observer =
        null

      const resolveProductTargets =
        () => {
          const nextTargets = {
            dietary:
              document.getElementById(
                'product-dietary-intelligence-slot',
              ),
            lineage:
              document.getElementById(
                'product-lineage-intelligence-slot',
              ),
            foodIntelligence:
              document.getElementById(
                'product-food-intelligence-slot',
              ),
            allergen:
              document.getElementById(
                'product-allergen-intelligence-slot',
              ),
            nutrition:
              document.getElementById(
                'product-nutrition-intelligence-slot',
              ),
          }

          setProductTargets(
            nextTargets,
          )

          return Object.values(
            nextTargets,
          ).every(
            Boolean,
          )
        }

      const allTargetsReady =
        resolveProductTargets()

      if (
        !allTargetsReady
      ) {
        animationFrameId =
          window.requestAnimationFrame(
            resolveProductTargets,
          )

        observer =
          new MutationObserver(
            () => {
              if (
                resolveProductTargets()
              ) {
                observer?.disconnect()
                observer =
                  null
              }
            },
          )

        observer.observe(
          document.body,
          {
            childList:
              true,
            subtree:
              true,
          },
        )
      }

      return () => {
        if (
          animationFrameId !==
          null
        ) {
          window.cancelAnimationFrame(
            animationFrameId,
          )
        }

        observer?.disconnect()
      }
    },
    [
      isProductSubject,
    ],
  )

  useEffect(
    () => {
      if (
        !recipeDetailPortal ||
        isProductSubject ||
        typeof document ===
          'undefined'
      ) {
        return undefined
      }

      let animationFrameId =
        null

      let observer =
        null

      const resolveRecipeTargets =
        () => {
          const nextTargets = {
            nutrition:
              document.getElementById(
                'recipe-nutrition-intelligence-slot',
              ),
            allergen:
              document.getElementById(
                'recipe-allergen-intelligence-slot',
              ),
            dietary:
              document.getElementById(
                'recipe-dietary-intelligence-slot',
              ),
            lineage:
              document.getElementById(
                'recipe-lineage-intelligence-slot',
              ),
          }

          setRecipeTargets(
            nextTargets,
          )

          return Object.values(
            nextTargets,
          ).every(
            Boolean,
          )
        }

      const allTargetsReady =
        resolveRecipeTargets()

      if (
        !allTargetsReady
      ) {
        animationFrameId =
          window.requestAnimationFrame(
            resolveRecipeTargets,
          )

        observer =
          new MutationObserver(
            () => {
              if (
                resolveRecipeTargets()
              ) {
                observer?.disconnect()
                observer =
                  null
              }
            },
          )

        observer.observe(
          document.body,
          {
            childList:
              true,
            subtree:
              true,
          },
        )
      }

      return () => {
        if (
          animationFrameId !==
          null
        ) {
          window.cancelAnimationFrame(
            animationFrameId,
          )
        }

        observer?.disconnect()
      }
    },
    [
      isProductSubject,
      recipeDetailPortal,
    ],
  )

  if (
    isProductSubject
  ) {
    const dietaryPortal =
      productTargets.dietary
        ? createPortal(
            <ProductAccordion
              title="Dietary"
              description="Suitability based on the current approved product evidence"
              icon={BadgeCheck}
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 p-4 shadow-[0_8px_20px_rgba(4,120,87,0.05)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                        Dietary suitability
                      </p>
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        Each result is shown exactly to the confidence supported by the approved product record.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[9px] font-black text-emerald-700 shadow-sm">
                        {dietary.length} result{dietary.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <label className="mt-3 block">
                    <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Show
                    </span>

                    <select
                      value={dietaryFilter}
                      onChange={(event) =>
                        setDietaryFilter(
                          event.target.value,
                        )
                      }
                      className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="all">All results</option>
                      <option value="eligible">Eligible</option>
                      <option value="not_eligible">Not eligible</option>
                      <option value="cannot_verify">Cannot verify</option>
                    </select>
                  </label>
                </div>

                {filteredDietary.length === 0 ? (
                  <EmptyIntelligence>
                    {dietary.length === 0
                      ? available
                        ? `No dietary classification was declared for this ${subjectLabel}.`
                        : 'Dietary classification cannot currently be verified.'
                      : 'No dietary result matches this filter.'}
                  </EmptyIntelligence>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredDietary.map((item, index) => {
                      const status = item?.status || 'cannot_verify'
                      const statusLabel =
                        status === 'eligible'
                          ? 'Eligible'
                          : status === 'not_eligible'
                            ? 'Not eligible'
                            : 'Cannot verify'
                      const statusClasses =
                        status === 'eligible'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : status === 'not_eligible'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-amber-200 bg-amber-50 text-amber-800'

                      return (
                        <div
                          key={item.key || index}
                          className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-[0_6px_16px_rgba(28,25,23,0.04)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-black leading-5 text-stone-900">
                              {displayName(item, 'Dietary rule')}
                            </p>

                            <span
                              className={[
                                'shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide',
                                statusClasses,
                              ].join(' ')}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          {item.reason && (
                            <p className="mt-2 border-t border-stone-100 pt-2 text-[10px] leading-4 text-stone-500">
                              {item.reason}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </ProductAccordion>,
            productTargets.dietary,
          )
        : null

    const lineagePortal =
      productTargets.lineage
        ? createPortal(
            <ProductAccordion
              title="Calculation source & rule lineage"
              description="How published product information was reviewed and prepared"
              icon={FlaskConical}
            >
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Information source
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {foodIntelligence?.lineage?.sources?.length ? (
                        Array.from(
                          new Set(
                            foodIntelligence.lineage.sources.map(
                              (source) =>
                                friendlyProductSourceLabel(
                                  source?.sourceType,
                                ),
                            ),
                          ),
                        ).map((label) => (
                          <p
                            key={label}
                            className="text-xs font-bold leading-5 text-stone-900"
                          >
                            {label}
                          </p>
                        ))
                      ) : (
                        <p className="text-xs leading-5 text-stone-600">
                          {available
                            ? 'Reviewed product information'
                            : 'No approved source information is currently available.'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      Review status
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-stone-900">
                      {verificationStatus === 'declared'
                        ? 'Reviewed before publication'
                        : verificationStatus === 'verified'
                          ? 'Supported by verified evidence'
                          : verificationStatus === 'calculated'
                            ? 'Calculated from reviewed information'
                            : 'Verification is incomplete'}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-stone-500">
                      {verificationStatus === 'cannot_verify'
                        ? 'EPANTRY does not make a stronger claim when required evidence is missing or uncertain.'
                        : 'Customer-facing information is limited to the evidence available for this approved product.'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                      How values were prepared
                    </p>
                    <p className="mt-2 text-xs font-bold leading-5 text-stone-900">
                      {verificationStatus === 'declared'
                        ? 'Reviewed source declaration'
                        : verificationStatus === 'calculated'
                          ? 'Governed calculation from reviewed data'
                          : verificationStatus === 'verified'
                            ? 'Governed verified sources'
                            : 'Awaiting sufficient approved evidence'}
                    </p>
                    {formatPublicReviewDate(
                      foodIntelligence?.calculation?.generatedAt,
                    ) && (
                      <p className="mt-1 text-[10px] leading-4 text-stone-500">
                        Information record updated {formatPublicReviewDate(
                          foodIntelligence.calculation.generatedAt,
                        )}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-[10px] leading-5 text-emerald-950/75">
                    Technical record IDs, calculation fingerprints and internal rule versions are kept by EPANTRY for audit and traceability, but are intentionally not shown on the customer page.
                  </p>
                </div>
              </div>
            </ProductAccordion>,
            productTargets.lineage,
          )
        : null

    const foodIntelligencePortal =
      productTargets.foodIntelligence
        ? createPortal(
            <ProductAccordion
              title="Product Food Intelligence"
              description="Confidence summary for nutrition, allergens and dietary information"
              icon={ShieldCheck}
            >
              <div className="rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 p-5 text-white shadow-[0_14px_34px_rgba(4,120,87,0.18)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
                      EPANTRY review summary
                    </p>
                    <h4 className="mt-1 text-lg font-black">
                      What this product information means
                    </h4>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-emerald-50/80">
                      EPANTRY shows nutrition, allergen and dietary information only to the level supported by the approved product evidence. Missing information is not treated as proof of a stronger claim.
                    </p>
                  </div>
                  <CustomerProductStatusBadge status={verificationStatus} />
                </div>

                <div
                  className={[
                    'mt-4 rounded-xl border px-4 py-3 text-xs leading-5',
                    verificationStatus === 'cannot_verify'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900',
                  ].join(' ')}
                >
                  {customerProductStatusDefinition(
                    verificationStatus,
                  ).description}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Nutrition
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-white">
                      {nutrition.length > 0
                        ? `${nutrition.length} reviewed nutrient value${nutrition.length === 1 ? '' : 's'} published`
                        : 'No reviewed nutrient values published'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Allergens
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-white">
                      {allergenStatement
                        ? 'Reviewed allergen declaration available'
                        : allergens.length > 0
                          ? `${allergens.length} allergen relationship${allergens.length === 1 ? '' : 's'} published`
                          : 'No allergen-free claim is implied'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">
                      Dietary information
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-white">
                      {dietary.length > 0
                        ? `${dietary.length} reviewed dietary result${dietary.length === 1 ? '' : 's'} published`
                        : 'No dietary classification published'}
                    </p>
                  </div>
                </div>
              </div>
            </ProductAccordion>,
            productTargets.foodIntelligence,
          )
        : null

    const allergenPortal =
      productTargets.allergen
        ? createPortal(
            <div className="border-t border-stone-100 pt-4">
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                      Governed evidence review
                    </p>
                    <p className="mt-1 text-xs leading-5 text-stone-500">
                      EPANTRY keeps declared allergen wording separate from governed allergen relationships.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 shadow-sm">
                    {allergens.length} relationship{allergens.length === 1 ? '' : 's'}
                  </span>
                </div>

                {allergenStatement && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <ShieldCheck
                      size={15}
                      className="mt-0.5 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-800">
                        Package declaration reviewed
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-stone-600">
                        The reviewed declaration is shown above. The records below only add governed relationship evidence.
                      </p>
                    </div>
                  </div>
                )}

                {allergens.length === 0 ? (
                  <div className="mt-3">
                    <EmptyIntelligence>
                      {allergenStatement
                        ? 'No additional governed allergen relationship is published beyond the reviewed package declaration.'
                        : 'No governed allergen relationship is published here. Absence is not treated as a free-from claim.'}
                    </EmptyIntelligence>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {allergens.map((item, index) => (
                      <div
                        key={item.allergenId || item.key || index}
                        className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs font-black leading-5 text-stone-900">
                            {displayName(item, 'Allergen')}
                          </p>
                          <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600">
                            {titleCase(item.relationship || 'relationship recorded')}
                          </span>
                        </div>

                        {item.evidenceState && (
                          <p className="mt-2 border-t border-stone-100 pt-2 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                            Evidence: {titleCase(item.evidenceState)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            productTargets.allergen,
          )
        : null

    const nutritionPortal =
      productTargets.nutrition
        ? createPortal(
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Evidence confidence
                  </p>
                  <p className="mt-1.5 text-xs leading-5 text-stone-500">
                    {nutrition.length > 0
                      ? `${nutrition.length} governed nutrient values are backed by the current approved calculation.`
                      : available
                        ? 'No additional governed nutrient evidence is published for this calculation.'
                        : 'Nutrition evidence cannot currently be verified.'}
                  </p>
                </div>
                <StatusBadge status={verificationStatus} />
              </div>
            </div>,
            productTargets.nutrition,
          )
        : null

    return (
      <>
        {dietaryPortal}
        {lineagePortal}
        {foodIntelligencePortal}
        {allergenPortal}
        {nutritionPortal}
      </>
    )
  }

  if (
    recipeDetailPortal
  ) {
    const accordionClassName =
      'group border-b border-[#e8dcc8] last:border-b-0'

    const summaryClassName =
      'focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#fff5e2] group-open:bg-[#f7ead4]'

    const chevron = (
      <span className="grid h-8 w-8 place-items-center rounded-full border border-[#e8dcc8] bg-white text-stone-600 transition group-open:rotate-180 group-open:border-emerald-300 group-open:text-emerald-800">
        <ChevronDown
          size={16}
          aria-hidden="true"
        />
      </span>
    )

    const nutritionPortal =
      recipeTargets.nutrition
        ? createPortal(
            <details className={`${accordionClassName} overflow-hidden`}>
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors duration-200 hover:bg-orange-50 group-open:bg-gradient-to-r group-open:from-orange-100 group-open:via-amber-50 group-open:to-[#fff8ed]">
                <span className="font-serif text-xl font-semibold text-[#163b2a] transition-colors duration-200 group-open:text-[#a94b12]">Nutrition</span>
                {chevron}
              </summary>
              <div className="border-t border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-[#fffaf1] px-5 py-4 shadow-[inset_4px_0_0_#f59e0b]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] leading-4 text-stone-500">
                    Governed nutrient values from the current approved calculation.
                  </p>
                  <StatusBadge status={verificationStatus} />
                </div>
                {nutrition.length === 0 ? (
                  <EmptyIntelligence>
                    {available
                      ? 'No governed nutrient values are published for this calculation.'
                      : 'Nutrition cannot currently be verified.'}
                  </EmptyIntelligence>
                ) : (
                  <div className="divide-y divide-[#dfd1b8]">
                    {nutrition.map((item, index) => (
                      <div
                        key={item.nutrientId || item.key || index}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-stone-800">
                            {displayName(item, 'Nutrient')}
                          </p>
                          {item.evidenceState && (
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                              {titleCase(item.evidenceState)}
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-xs font-black text-stone-950">
                          {item.amount ?? '—'}{item.unit ? ` ${item.unit}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>,
            recipeTargets.nutrition,
          )
        : null

    const allergenPortal =
      recipeTargets.allergen
        ? createPortal(
            <details className={accordionClassName}>
              <summary className={summaryClassName}>
                <span className="font-serif text-xl font-semibold text-[#163b2a]">Allergens</span>
                {chevron}
              </summary>
              <div className="border-t border-[#eadfca] bg-[#fbf1df] px-5 py-4">
                {allergenStatement && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-amber-800">
                      Reviewed package declaration
                    </p>
                    <p className="mt-1 text-xs font-bold leading-5 text-stone-800">
                      {allergenStatement}
                    </p>
                  </div>
                )}
                {allergens.length === 0 ? (
                  <EmptyIntelligence>
                    {allergenStatement
                      ? 'No additional governed allergen relationship is published beyond the reviewed Recipe declaration.'
                      : available
                        ? 'No positive allergen relationship was declared for this Recipe. This is not a free-from claim.'
                        : 'No governed allergen relationship is published here. Absence is not treated as a free-from claim.'}
                  </EmptyIntelligence>
                ) : (
                  <div className="divide-y divide-[#dfd1b8] overflow-hidden rounded-xl border border-[#e3d7c2] bg-white/55">
                    {allergens.map((item, index) => (
                      <div
                        key={item.allergenId || item.key || index}
                        className="bg-transparent p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black text-stone-900">
                            {displayName(item, 'Allergen')}
                          </p>
                          <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 shadow-sm">
                            {titleCase(item.relationship || 'relationship recorded')}
                          </span>
                        </div>
                        {item.evidenceState && (
                          <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                            Evidence: {titleCase(item.evidenceState)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>,
            recipeTargets.allergen,
          )
        : null

    const dietaryPortal =
      recipeTargets.dietary
        ? createPortal(
            <details className={accordionClassName}>
              <summary className={summaryClassName}>
                <span className="font-serif text-xl font-semibold text-[#163b2a]">Dietary</span>
                {chevron}
              </summary>
              <div className="border-t border-[#eadfca] bg-[#fbf1df] px-5 py-4">
                <label className="mb-3 block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                    Filter dietary results
                  </span>
                  <select
                    value={dietaryFilter}
                    onChange={(event) => setDietaryFilter(event.target.value)}
                    className="h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 outline-none focus:border-emerald-500"
                  >
                    <option value="all">All results</option>
                    <option value="eligible">Eligible</option>
                    <option value="not_eligible">Not eligible</option>
                    <option value="cannot_verify">Cannot verify</option>
                  </select>
                </label>
                {filteredDietary.length === 0 ? (
                  <EmptyIntelligence>
                    {dietary.length === 0
                      ? available
                        ? 'No dietary classification was declared for this Recipe.'
                        : 'Dietary classification cannot currently be verified.'
                      : 'No dietary result matches this filter.'}
                  </EmptyIntelligence>
                ) : (
                  <div className="divide-y divide-[#dfd1b8] overflow-hidden rounded-xl border border-[#e3d7c2] bg-white/55">
                    {filteredDietary.map((item, index) => (
                      <div
                        key={item.key || index}
                        className="flex items-start justify-between gap-3 bg-transparent p-3"
                      >
                        <div>
                          <p className="text-xs font-black text-stone-900">
                            {displayName(item, 'Dietary rule')}
                          </p>
                          {item.reason && (
                            <p className="mt-1 text-[10px] leading-4 text-stone-500">
                              {item.reason}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 shadow-sm">
                          {titleCase(item.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>,
            recipeTargets.dietary,
          )
        : null

    const lineagePortal =
      recipeTargets.lineage
        ? createPortal(
            <details className={accordionClassName}>
              <summary className={summaryClassName}>
                <span className="font-serif text-xl font-semibold text-[#163b2a]">
                  Calculation source & rule lineage
                </span>
                {chevron}
              </summary>
              <div className="border-t border-[#eadfca] bg-[#fbf1df] px-5 py-4">
                <div className="grid gap-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">Calculation</p>
                    <dl className="mt-2 space-y-1 text-[10px] text-stone-600">
                      <div className="flex justify-between gap-3">
                        <dt>Version</dt>
                        <dd className="font-bold text-stone-900">
                          {foodIntelligence?.calculation?.version ?? '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Evidence</dt>
                        <dd className="font-bold text-stone-900">
                          {titleCase(foodIntelligence?.evidenceState || 'unknown')}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Method</dt>
                        <dd className="text-right font-bold text-stone-900">
                          {verificationStatus === 'declared'
                            ? 'Reviewed source declaration'
                            : verificationStatus === 'calculated'
                              ? 'Deterministic calculation'
                              : verificationStatus === 'verified'
                                ? 'Governed verified sources'
                                : 'Awaiting approved evidence'}
                        </dd>
                      </div>
                    </dl>
                    {foodIntelligence?.calculation?.fingerprint && (
                      <p className="mt-3 break-all rounded-lg bg-stone-50 p-2 font-mono text-[9px] leading-4 text-stone-500">
                        {foodIntelligence.calculation.fingerprint}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">Sources</p>
                    <div className="mt-2 space-y-2">
                      {foodIntelligence?.lineage?.sources?.length ? (
                        foodIntelligence.lineage.sources.map((source, index) => (
                          <div
                            key={`${source.sourceId || 'source'}-${index}`}
                            className="rounded-lg bg-stone-50 p-2 text-[10px] leading-4 text-stone-600"
                          >
                            <p className="font-bold text-stone-900">
                              {titleCase(source.sourceType || 'source')}
                            </p>
                            <p className="break-all">
                              {source.sourceId || source.evidenceSourceId || 'Governed source'}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-stone-400">
                          No public source lineage available.
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">Rules</p>
                    <div className="mt-2 space-y-2">
                      {foodIntelligence?.lineage?.rules?.length ? (
                        foodIntelligence.lineage.rules.map((rule, index) => (
                          <div
                            key={`${rule.ruleProfileId || rule.ruleKey || 'rule'}-${index}`}
                            className="rounded-lg bg-stone-50 p-2 text-[10px] leading-4 text-stone-600"
                          >
                            <p className="font-bold text-stone-900">
                              {rule.ruleKey || 'Governed rule'}
                            </p>
                            <p>Version {rule.ruleVersion || '—'}</p>
                            {rule.jurisdiction && <p>{rule.jurisdiction}</p>}
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] leading-4 text-stone-400">
                          {verificationStatus === 'declared'
                            ? 'No automated rule profile was used. This snapshot comes from a reviewed source declaration.'
                            : 'No public rule lineage available.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </details>,
            recipeTargets.lineage,
          )
        : null

    return (
      <>
        {nutritionPortal}
        {allergenPortal}
        {dietaryPortal}
        {lineagePortal}
      </>
    )
  }

  return (
    <section
      className={[
        'overflow-hidden',
        'rounded-3xl',
        'border',
        'border-stone-200',
        isProductSubject
          ? 'bg-gradient-to-b from-emerald-50/70 via-white to-white ring-1 ring-emerald-100'
          : 'bg-[#fffdf8]',
        isProductSubject
          ? 'shadow-[0_18px_48px_rgba(4,120,87,0.12)]'
          : 'shadow-[0_16px_42px_rgba(92,70,38,0.08)]',
        isProductSubject
          ? 'grid grid-cols-1 lg:grid-cols-2 lg:items-stretch'
          : '',
      ].join(
        ' ',
      )}
      aria-labelledby="food-intelligence-title"
    >

      <div
        className={
          isProductSubject
            ? 'col-start-1 row-start-2 border-b border-emerald-800 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900 px-5 py-5 text-white sm:px-7 lg:m-4 lg:mr-2 lg:mt-2 lg:rounded-2xl lg:border lg:border-emerald-800 lg:shadow-[0_16px_36px_rgba(4,120,87,0.2)]'
            : 'border-b border-[#e8dcc8] bg-gradient-to-r from-[#fff8e9] via-[#fffdf8] to-emerald-50/50 px-5 py-5 sm:px-7'
        }
      >

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div>

            <p className={isProductSubject ? 'text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200' : 'text-[10px] font-black uppercase tracking-[0.16em] text-amber-700'}>
              EPANTRY safety intelligence
            </p>

            <h2
              id="food-intelligence-title"
              className={isProductSubject ? 'mt-1 text-xl font-black tracking-tight text-white' : 'mt-1 font-serif text-2xl font-semibold tracking-tight text-[#163b2a]'}
            >
              {title}
            </h2>

            <p className={isProductSubject ? 'mt-2 max-w-3xl text-xs leading-5 text-emerald-50/80' : 'mt-2 max-w-3xl text-xs leading-5 text-stone-500'}>
              Nutrition, allergen and dietary information is shown with its evidence confidence. Missing evidence is never converted into a stronger safety claim.
            </p>

          </div>

          <StatusBadge
            status={
              verificationStatus
            }
          />

        </div>


        {verificationStatus === 'cannot_verify' && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800">
            Food safety information cannot currently be verified.
          </div>
        )}

      </div>


      <div
        className={
          isProductSubject
            ? 'col-start-1 row-start-1 grid gap-4 p-4 sm:p-6 lg:col-span-2 lg:grid-cols-3'
            : 'grid gap-4 p-4 sm:p-6 lg:grid-cols-3'
        }
      >

        <IntelligenceSection
          title="Nutrition"
          description="Governed nutrient values from the current approved calculation."
          productStyle={
            isProductSubject
          }
        >

          {nutrition.length ===
          0 ? (

            <EmptyIntelligence>
              {
                available
                  ? 'No governed nutrient values are published for this calculation.'
                  : 'Nutrition cannot currently be verified.'
              }
            </EmptyIntelligence>

          ) : (

            <div
              className={
                isProductSubject
                  ? 'divide-y divide-stone-200'
                  : 'divide-y divide-stone-100'
              }
            >

              {nutrition.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.nutrientId ||
                      item.key ||
                      index
                    }
                    className={
                      isProductSubject
                        ? 'flex items-center justify-between gap-4 py-3'
                        : 'flex items-center justify-between gap-4 py-2.5'
                    }
                  >

                    <div className="min-w-0">

                      <p className="truncate text-xs font-bold text-stone-800">
                        {
                          displayName(
                            item,
                            'Nutrient',
                          )
                        }
                      </p>

                      {item.evidenceState && (
                        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                          {
                            titleCase(
                              item.evidenceState,
                            )
                          }
                        </p>
                      )}

                    </div>

                    <p
                      className={
                        isProductSubject
                          ? 'shrink-0 text-xs font-black text-stone-950'
                          : 'shrink-0 text-xs font-black text-stone-950'
                      }
                    >
                      {
                        item.amount ??
                        '—'
                      }{
                        item.unit
                          ? ` ${item.unit}`
                          : ''
                      }
                    </p>

                  </div>
                ),
              )}

            </div>

          )}

        </IntelligenceSection>


        <IntelligenceSection
          title="Allergens"
          description="Contains, may-contain and cross-contact stay separate."
          productStyle={
            isProductSubject
          }
        >

          {allergenStatement && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-wide text-amber-800">
                Reviewed package declaration
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-stone-800">
                {allergenStatement}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-stone-500">
                This wording is source-declared. It does not create an allergen-free or free-from claim.
              </p>
            </div>
          )}

          {allergens.length ===
          0 ? (

            <EmptyIntelligence>
              {
                allergenStatement
                  ? `No positive governed allergen relationship is published beyond the reviewed ${subjectLabel} package declaration above.`
                  : available
                    ? `No positive allergen relationship was declared for this ${subjectLabel}. This is not a free-from claim.`
                    : 'No governed allergen relationship is published here. Absence is not treated as a free-from claim.'
              }
            </EmptyIntelligence>

          ) : (

            <div className="space-y-2">

              {allergens.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.allergenId ||
                      item.key ||
                      index
                    }
                    className={
                      isProductSubject
                        ? 'rounded-xl border border-stone-200 bg-stone-50/70 p-3'
                        : 'rounded-xl border border-stone-200 bg-stone-50 p-3'
                    }
                  >

                    <div className="flex items-center justify-between gap-3">

                      <p className="text-xs font-black text-stone-900">
                        {
                          displayName(
                            item,
                            'Allergen',
                          )
                        }
                      </p>

                      <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 shadow-sm">
                        {
                          titleCase(
                            item.relationship ||
                            'relationship recorded',
                          )
                        }
                      </span>

                    </div>

                    {item.evidenceState && (
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-stone-400">
                        Evidence: {
                          titleCase(
                            item.evidenceState,
                          )
                        }
                      </p>
                    )}

                  </div>
                ),
              )}

            </div>

          )}

        </IntelligenceSection>


        <IntelligenceSection
          title="Dietary"
          description="Rules fail closed when required governed facts are missing."
          productStyle={
            isProductSubject
          }
        >

          <label className="mb-3 block">

            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Filter dietary results
            </span>

            <select
              value={
                dietaryFilter
              }
              onChange={
                (
                  event,
                ) =>
                  setDietaryFilter(
                    event
                      .target
                      .value,
                  )
              }
              className={
                isProductSubject
                  ? 'h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-xs font-bold text-stone-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100'
                  : 'h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 outline-none focus:border-emerald-500'
              }
            >
              <option value="all">
                All results
              </option>

              <option value="eligible">
                Eligible
              </option>

              <option value="not_eligible">
                Not eligible
              </option>

              <option value="cannot_verify">
                Cannot verify
              </option>
            </select>

          </label>


          {filteredDietary.length ===
          0 ? (

            <EmptyIntelligence>
              {
                dietary.length ===
                  0
                  ? available
                    ? `No dietary classification was declared for this ${subjectLabel}.`
                    : 'Dietary classification cannot currently be verified.'
                  : 'No dietary result matches this filter.'
              }
            </EmptyIntelligence>

          ) : (

            <div className="space-y-2">

              {filteredDietary.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.key ||
                      index
                    }
                    className={
                      isProductSubject
                        ? 'flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3'
                        : 'flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3'
                    }
                  >

                    <div>

                      <p className="text-xs font-black text-stone-900">
                        {
                          displayName(
                            item,
                            'Dietary rule',
                          )
                        }
                      </p>

                      {item.reason && (
                        <p className="mt-1 text-[10px] leading-4 text-stone-500">
                          {item.reason}
                        </p>
                      )}

                    </div>

                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-stone-600 shadow-sm">
                      {
                        titleCase(
                          item.status,
                        )
                      }
                    </span>

                  </div>
                ),
              )}

            </div>

          )}

        </IntelligenceSection>

      </div>


      <div
        className={
          isProductSubject
            ? 'col-start-1 row-start-3 px-4 pb-4 sm:px-6 sm:pb-6 lg:col-start-2 lg:row-start-2 lg:m-4 lg:ml-2 lg:mt-2 lg:p-0'
            : 'px-4 pb-4 sm:px-6 sm:pb-6'
        }
      >

        <details
          className={
            isProductSubject
              ? 'group rounded-2xl border border-stone-200 bg-white shadow-[0_8px_24px_rgba(28,25,23,0.05)] lg:open:h-full lg:open:max-h-[230px] lg:open:overflow-hidden'
              : 'group rounded-2xl border border-[#e3d7c2] bg-[#fffdf8]'
          }
        >

          <summary
            className={
              isProductSubject
                ? 'flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border-b border-transparent bg-stone-50/80 px-4 py-3 text-xs font-black text-stone-900 group-open:rounded-b-none group-open:border-stone-200'
                : 'flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-xs font-black text-[#163b2a]'
            }
          >

            <span>
              Calculation source & rule lineage
            </span>

            <ChevronDown
              size={16}
              className="transition group-open:rotate-180"
              aria-hidden="true"
            />

          </summary>


          <div
            className={
              isProductSubject
                ? 'border-t border-stone-200 p-4 lg:max-h-[178px] lg:overflow-y-auto lg:overscroll-contain'
                : 'border-t border-stone-100 p-4'
            }
          >

            <div
              className={
                isProductSubject
                  ? 'grid gap-5'
                  : 'grid gap-5 lg:grid-cols-3'
              }
            >

              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                  Calculation
                </p>

                <dl className="mt-2 space-y-1 text-[10px] text-stone-600">

                  <div className="flex justify-between gap-3">
                    <dt>
                      Version
                    </dt>

                    <dd className="font-bold text-stone-900">
                      {
                        foodIntelligence
                          ?.calculation
                          ?.version ??
                        '—'
                      }
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>
                      Evidence
                    </dt>

                    <dd className="font-bold text-stone-900">
                      {
                        titleCase(
                          foodIntelligence
                            ?.evidenceState ||
                          'unknown',
                        )
                      }
                    </dd>
                  </div>

                  <div className="flex justify-between gap-3">
                    <dt>
                      Method
                    </dt>

                    <dd className="font-bold text-stone-900">
                      {verificationStatus ===
                        'declared'
                        ? 'Reviewed source declaration'
                        : verificationStatus ===
                            'calculated'
                          ? 'Deterministic calculation'
                          : verificationStatus ===
                              'verified'
                            ? 'Governed verified sources'
                            : 'Awaiting approved evidence'}
                    </dd>
                  </div>

                </dl>

                {foodIntelligence
                  ?.calculation
                  ?.fingerprint && (
                  <p className="mt-3 break-all rounded-lg bg-stone-50 p-2 font-mono text-[9px] leading-4 text-stone-500">
                    {
                      foodIntelligence
                        .calculation
                        .fingerprint
                    }
                  </p>
                )}

              </div>


              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                  Sources
                </p>

                <div className="mt-2 space-y-2">

                  {
                    foodIntelligence
                      ?.lineage
                      ?.sources
                      ?.length
                      ? foodIntelligence
                          .lineage
                          .sources
                          .map(
                            (
                              source,
                              index,
                            ) => (
                              <div
                                key={
                                  `${
                                    source.sourceId ||
                                    'source'
                                  }-${index}`
                                }
                                className="rounded-lg bg-stone-50 p-2 text-[10px] leading-4 text-stone-600"
                              >
                                <p className="font-bold text-stone-900">
                                  {
                                    titleCase(
                                      source.sourceType ||
                                      'source',
                                    )
                                  }
                                </p>

                                <p className="break-all">
                                  {
                                    source.sourceId ||
                                    source.evidenceSourceId ||
                                    'Governed source'
                                  }
                                </p>
                              </div>
                            ),
                          )
                      : (
                        <p className="text-[10px] text-stone-400">
                          No public source lineage available.
                        </p>
                      )
                  }

                </div>

              </div>


              <div>

                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                  Rules
                </p>

                <div className="mt-2 space-y-2">

                  {
                    foodIntelligence
                      ?.lineage
                      ?.rules
                      ?.length
                      ? foodIntelligence
                          .lineage
                          .rules
                          .map(
                            (
                              rule,
                              index,
                            ) => (
                              <div
                                key={
                                  `${
                                    rule.ruleProfileId ||
                                    rule.ruleKey ||
                                    'rule'
                                  }-${index}`
                                }
                                className="rounded-lg bg-stone-50 p-2 text-[10px] leading-4 text-stone-600"
                              >
                                <p className="font-bold text-stone-900">
                                  {
                                    rule.ruleKey ||
                                    'Governed rule'
                                  }
                                </p>

                                <p>
                                  Version {
                                    rule.ruleVersion ||
                                    '—'
                                  }
                                </p>

                                {rule.jurisdiction && (
                                  <p>
                                    {
                                      rule.jurisdiction
                                    }
                                  </p>
                                )}
                              </div>
                            ),
                          )
                      : (
                        <p className="text-[10px] leading-4 text-stone-400">
                          {verificationStatus ===
                            'declared'
                            ? 'No automated rule profile was used. This snapshot comes from a reviewed source declaration; EPANTRY generated the immutable calculation record and source lineage automatically.'
                            : 'No public rule lineage available.'}
                        </p>
                      )
                  }

                </div>

              </div>

            </div>

          </div>

        </details>

      </div>

    </section>
  )
}