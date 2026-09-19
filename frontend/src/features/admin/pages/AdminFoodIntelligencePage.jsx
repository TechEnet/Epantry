import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  AlertTriangle,
  BadgeCheck,
  FlaskConical,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Save,
  ShieldAlert,
} from 'lucide-react'

import AdminShell from '../components/AdminShell'

import {
  useAdmin,
} from '../context/AdminContext'

import {
  activateFoodRule,
  activateIngredientRelation,
  approveFoodCalculation,
  declareProductFoodIntelligence,
  getAdminProductFoodIntelligenceLatest,
  listFoodCalculations,
  listFoodIngredientRelations,
  listFoodRuleProfiles,
  testFoodRule,
} from '../../foodIntelligence/services/foodIntelligence.service'

import {
  getAdminProductVersion,
  getAdminProductVersions,
} from '../services/catalogAdmin.service'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function readRecordStatus(
  record,
) {
  return (
    record?.status ||
    record?.lifecycleStatus ||
    record?.calculationStatus ||
    record?.reviewStatus ||
    'unknown'
  )
}

function recordId(
  record,
) {
  return (
    record?.id ||
    record?._id ||
    ''
  )
}

function displayValue(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ''
  ) {
    return '—'
  }

  if (
    typeof value ===
      'object'
  ) {
    return JSON.stringify(
      value,
    )
  }

  return String(
    value,
  )
}

function shortId(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    )

  if (
    normalized.length <=
      16
  ) {
    return normalized ||
      '—'
  }

  return `${normalized.slice(
    0,
    8,
  )}…${normalized.slice(
    -6,
  )}`
}


const PRODUCT_NUTRIENTS = [
  {
    key: 'energy',
    label: 'Energy',
    unit: 'kcal',
  },
  {
    key: 'protein',
    label: 'Protein',
    unit: 'g',
  },
  {
    key: 'carbohydrate',
    label: 'Carbohydrate',
    unit: 'g',
  },
  {
    key: 'total_fat',
    label: 'Total Fat',
    unit: 'g',
  },
  {
    key: 'saturated_fat',
    label: 'Saturated Fat',
    unit: 'g',
  },
  {
    key: 'fiber',
    label: 'Dietary Fibre',
    unit: 'g',
  },
  {
    key: 'total_sugars',
    label: 'Total Sugars',
    unit: 'g',
  },
  {
    key: 'sodium',
    label: 'Sodium',
    unit: 'mg',
  },
]

const PRODUCT_DIETARY_KEYS = [
  {
    key: 'vegetarian',
    label: 'Vegetarian',
  },
  {
    key: 'vegan',
    label: 'Vegan',
  },
  {
    key: 'gluten_free',
    label: 'Gluten Free',
  },
  {
    key: 'eggitarian',
    label: 'Eggitarian',
  },
  {
    key: 'non_vegetarian',
    label: 'Non Vegetarian',
  },
]

function emptyProductDeclarationForm() {
  return {
    nutritionBasis: 'per_100g',
    nutrition: Object.fromEntries(
      PRODUCT_NUTRIENTS.map(
        (item) => [
          item.key,
          '',
        ],
      ),
    ),
    allergens: [],
    allergenStatement: '',
    dietary: Object.fromEntries(
      PRODUCT_DIETARY_KEYS.map(
        (item) => [
          item.key,
          'not_declared',
        ],
      ),
    ),
    basis:
      'Reviewed canonical ProductVersion and approved Host/package declarations.',
    reason:
      'Super Admin reviewed Product nutrition, allergen and dietary declarations against the approved canonical ProductVersion and package evidence.',
  }
}

function normalizeNutrientKey(value) {
  const normalized =
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

  const aliases = {
    dietary_fibre: 'fiber',
    dietary_fiber: 'fiber',
    fibre: 'fiber',
    totalfat: 'total_fat',
    saturatedfat: 'saturated_fat',
    totalsugars: 'total_sugars',
  }

  return aliases[normalized] || normalized
}

function productDeclarationFromSources(
  version,
  latestDeclaration,
  packageEvidence = null,
) {
  const next =
    emptyProductDeclarationForm()

  const versionNutrition =
    version?.nutrition ||
    {}

  if (
    versionNutrition?.basis
  ) {
    next.nutritionBasis =
      versionNutrition.basis
  }

  for (
    const item of
      versionNutrition?.nutrients ||
      []
  ) {
    const key =
      normalizeNutrientKey(
        item?.nutrientKey ||
        item?.key ||
        item?.name,
      )

    if (
      Object.prototype.hasOwnProperty.call(
        next.nutrition,
        key,
      )
    ) {
      next.nutrition[key] =
        item?.amount ??
        ''
    }
  }

  next.allergens =
    (version?.allergens || [])
      .filter(
        (item) =>
          item?.allergenKey &&
          [
            'contains',
            'may_contain',
            'cross_contact',
          ].includes(
            item?.relationType,
          ),
      )
      .map(
        (item) => ({
          key:
            item.allergenKey,
          canonicalName:
            String(
              item.allergenKey,
            )
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (character) => character.toUpperCase()),
          relationship:
            item.relationType,
        }),
      )

  next.allergenStatement =
    String(
      version?.allergenStatement ||
      packageEvidence?.allergenStatement ||
      '',
    ).trim()

  for (
    const claim of
      version?.claims ||
      []
  ) {
    const key =
      normalizeNutrientKey(
        claim?.key ||
        claim?.label,
      )

    if (
      Object.prototype.hasOwnProperty.call(
        next.dietary,
        key,
      ) &&
      claim?.evidenceState !==
        'unknown_review_required'
    ) {
      next.dietary[key] =
        'eligible'
    }
  }

  const declaration =
    latestDeclaration ||
    null

  if (
    declaration
  ) {
    next.nutritionBasis =
      declaration.nutritionBasis ||
      next.nutritionBasis

    for (
      const item of
        declaration.nutrition ||
        []
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          next.nutrition,
          item.key,
        )
      ) {
        next.nutrition[item.key] =
          item.amount ??
          ''
      }
    }

    next.allergens =
      Array.isArray(
        declaration.allergens,
      )
        ? declaration.allergens
        : next.allergens

    next.allergenStatement =
      String(
        declaration.allergenStatement ||
        next.allergenStatement ||
        '',
      ).trim()

    for (
      const item of
        declaration.dietary ||
        []
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          next.dietary,
          item.key,
        )
      ) {
        next.dietary[item.key] =
          item.outcome ||
          'not_declared'
      }
    }

    next.basis =
      declaration.basis ||
      next.basis

    next.reason =
      declaration.reason ||
      next.reason
  }

  return next
}

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

function StatusPill({
  value,
}) {
  const normalized =
    String(
      value ||
        'unknown',
    )
      .trim()
      .toLowerCase()

  const className =
    normalized ===
      'active' ||
    normalized ===
      'approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : normalized ===
          'review_required' ||
        normalized ===
          'in_review' ||
        normalized ===
          'calculated'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-stone-200 bg-stone-50 text-stone-600'

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${className}`}
    >
      {
        normalized.replace(
          /_/g,
          ' ',
        )
      }
    </span>
  )
}

/*
|--------------------------------------------------------------------------
| Admin Food Intelligence
|--------------------------------------------------------------------------
*/

export default function AdminFoodIntelligencePage() {
  const {
    hasAdminPermission,
  } =
    useAdmin()

  const canMutate =
    hasAdminPermission(
      'trust_safety.mutate',
    )

  const canProductDeclare =
    canMutate ||
    hasAdminPermission(
      'catalog.mutate',
    )

  const [
    relations,
    setRelations,
  ] =
    useState(
      [],
    )

  const [
    rules,
    setRules,
  ] =
    useState(
      [],
    )

  const [
    calculations,
    setCalculations,
  ] =
    useState(
      [],
    )

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    )

  const [
    busyKey,
    setBusyKey,
  ] =
    useState(
      '',
    )

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      '',
    )

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState(
      '',
    )

  const [
    reasonDetails,
    setReasonDetails,
  ] =
    useState(
      '',
    )

  const [
    ruleTestJson,
    setRuleTestJson,
  ] =
    useState(
      `{
  "facts": {},
  "evidenceState": "unknown_review_required"
}`,
    )

  const [
    ruleTestResult,
    setRuleTestResult,
  ] =
    useState(
      null,
    )

  const [
    publishedProducts,
    setPublishedProducts,
  ] =
    useState(
      [],
    )

  const [
    selectedProductVersionId,
    setSelectedProductVersionId,
  ] =
    useState(
      '',
    )

  const [
    selectedProductVersion,
    setSelectedProductVersion,
  ] =
    useState(
      null,
    )

  const [
    productDeclarationMeta,
    setProductDeclarationMeta,
  ] =
    useState(
      null,
    )

  const [
    productDeclarationForm,
    setProductDeclarationForm,
  ] =
    useState(
      emptyProductDeclarationForm,
    )

  const [
    productDeclarationLoading,
    setProductDeclarationLoading,
  ] =
    useState(
      false,
    )

  const [
    allergenDraft,
    setAllergenDraft,
  ] =
    useState({
      canonicalName:
        '',
      relationship:
        'contains',
    })

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  const loadWorkspace =
    useCallback(
      async () => {
        setIsLoading(
          true,
        )

        setErrorMessage(
          '',
        )

        try {
          const [
            relationResult,
            ruleResult,
            calculationResult,
            productResult,
          ] =
            await Promise.all([
              listFoodIngredientRelations({
                limit:
                  100,
              }),

              listFoodRuleProfiles({
                limit:
                  100,
              }),

              listFoodCalculations({
                limit:
                  100,
              }),

              getAdminProductVersions({
                page:
                  1,
                limit:
                  100,
                publicationStatus:
                  'published',
              }),
            ])

          setRelations(
            relationResult.records,
          )

          setRules(
            ruleResult.records,
          )

          setCalculations(
            calculationResult.records,
          )

          const productItems =
            Array.isArray(
              productResult?.items,
            )
              ? productResult.items
              : Array.isArray(
                    productResult?.productVersions,
                  )
                ? productResult.productVersions
                : Array.isArray(
                      productResult?.versions,
                    )
                  ? productResult.versions
                  : []

          setPublishedProducts(
            productItems.filter(
              (item) =>
                item?.publicationStatus ===
                'published',
            ),
          )
        } catch (
          error
        ) {
          setErrorMessage(
            error?.response?.data?.message ||
            error?.message ||
            'Unable to load Food Intelligence administration.',
          )
        } finally {
          setIsLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      loadWorkspace()
    },
    [
      loadWorkspace,
    ],
  )

  const loadSelectedProductDeclaration =
    useCallback(
      async (
        productVersionId,
      ) => {
        if (
          !productVersionId
        ) {
          setSelectedProductVersion(
            null,
          )
          setProductDeclarationMeta(
            null,
          )
          setProductDeclarationForm(
            emptyProductDeclarationForm(),
          )
          return
        }

        setProductDeclarationLoading(
          true,
        )
        setErrorMessage(
          '',
        )

        try {
          const [
            versionResult,
            declarationResult,
          ] =
            await Promise.all([
              getAdminProductVersion(
                productVersionId,
              ),
              getAdminProductFoodIntelligenceLatest(
                productVersionId,
              ),
            ])

          const version =
            versionResult?.productVersion ||
            versionResult?.version ||
            null

          const latest =
            declarationResult?.latestApproved ||
            declarationResult?.latest ||
            null

          setSelectedProductVersion(
            version,
          )
          setProductDeclarationMeta(
            latest,
          )
          setProductDeclarationForm(
            productDeclarationFromSources(
              version,
              latest?.declaration ||
                null,
              declarationResult?.packageEvidence ||
                null,
            ),
          )
        } catch (
          error
        ) {
          setErrorMessage(
            error?.response?.data?.message ||
            error?.message ||
            'Unable to load Product Food Intelligence declaration.',
          )
        } finally {
          setProductDeclarationLoading(
            false,
          )
        }
      },
      [],
    )

  useEffect(
    () => {
      loadSelectedProductDeclaration(
        selectedProductVersionId,
      )
    },
    [
      selectedProductVersionId,
      loadSelectedProductDeclaration,
    ],
  )

  function addProductAllergen() {
    const canonicalName =
      allergenDraft.canonicalName.trim()

    if (!canonicalName) {
      return
    }

    const key =
      normalizeNutrientKey(
        canonicalName,
      )

    setProductDeclarationForm(
      (current) => ({
        ...current,
        allergens: [
          ...current.allergens.filter(
            (item) =>
              item.key !==
              key,
          ),
          {
            key,
            canonicalName,
            relationship:
              allergenDraft.relationship,
          },
        ],
      }),
    )

    setAllergenDraft({
      canonicalName:
        '',
      relationship:
        'contains',
    })
  }

  function removeProductAllergen(
    key,
  ) {
    setProductDeclarationForm(
      (current) => ({
        ...current,
        allergens:
          current.allergens.filter(
            (item) =>
              item.key !==
              key,
          ),
      }),
    )
  }

  async function saveProductDeclaration(
    event,
  ) {
    event.preventDefault()

    if (
      !selectedProductVersionId ||
      !canProductDeclare
    ) {
      return
    }

    setErrorMessage(
      '',
    )
    setSuccessMessage(
      '',
    )

    try {
      const nutrition =
        PRODUCT_NUTRIENTS.flatMap(
          (item) => {
            const raw =
              productDeclarationForm
                .nutrition[
                  item.key
                ]

            if (
              raw === '' ||
              raw === null ||
              raw === undefined
            ) {
              return []
            }

            const amount =
              Number(
                raw,
              )

            if (
              !Number.isFinite(
                amount,
              ) ||
              amount <
                0
            ) {
              throw new Error(
                `${item.label} must be a valid non-negative number.`,
              )
            }

            return [
              {
                key:
                  item.key,
                amount,
                unit:
                  item.unit,
              },
            ]
          },
        )

      const dietary =
        PRODUCT_DIETARY_KEYS.flatMap(
          (item) => {
            const outcome =
              productDeclarationForm
                .dietary[
                  item.key
                ]

            return outcome ===
              'not_declared'
              ? []
              : [
                  {
                    key:
                      item.key,
                    outcome,
                  },
                ]
          },
        )

      if (
        !nutrition.length &&
        !productDeclarationForm.allergens.length &&
        !productDeclarationForm.allergenStatement.trim() &&
        !dietary.length
      ) {
        throw new Error(
          'Enter Nutrition, an Allergen relationship, or at least one Dietary result before saving.',
        )
      }

      if (
        !productDeclarationForm.basis.trim() ||
        !productDeclarationForm.reason.trim()
      ) {
        throw new Error(
          'Calculation basis and Super Admin review reason are required.',
        )
      }

      setBusyKey(
        'product-declaration',
      )

      await declareProductFoodIntelligence({
        productVersionId:
          selectedProductVersionId,
        nutritionBasis:
          productDeclarationForm.nutritionBasis,
        nutrition,
        allergens:
          productDeclarationForm.allergens,
        allergenStatement:
          productDeclarationForm.allergenStatement.trim(),
        dietary,
        basis:
          productDeclarationForm.basis.trim(),
        reason:
          productDeclarationForm.reason.trim(),
      })

      setSuccessMessage(
        productDeclarationMeta
          ? 'Product Food Intelligence revised. A new immutable approved snapshot is now public.'
          : 'Product Food Intelligence saved and approved. The public Product page can now show the governed declaration.',
      )

      await Promise.all([
        loadSelectedProductDeclaration(
          selectedProductVersionId,
        ),
        loadWorkspace(),
      ])
    } catch (
      error
    ) {
      setErrorMessage(
        error?.response?.data?.message ||
        error?.message ||
        'Unable to save Product Food Intelligence declaration.',
      )
    } finally {
      setBusyKey(
        '',
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Stats
  |--------------------------------------------------------------------------
  */

  const stats =
    useMemo(
      () => ({
        mappings:
          relations.length,

        rules:
          rules.length,

        reviewRequired:
          calculations.filter(
            (
              calculation,
            ) =>
              [
                'review_required',
                'calculated',
                'in_review',
              ].includes(
                readRecordStatus(
                  calculation,
                ),
              ),
          ).length,
      }),
      [
        relations,
        rules,
        calculations,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Mutation Wrapper
  |--------------------------------------------------------------------------
  */

  const runMutation =
    async (
      key,
      callback,
      success,
    ) => {
      if (
        !reasonDetails.trim()
      ) {
        setErrorMessage(
          'Enter a governance reason before a critical Trust & Safety action.',
        )

        return
      }

      setBusyKey(
        key,
      )

      setErrorMessage(
        '',
      )

      setSuccessMessage(
        '',
      )

      try {
        await callback()

        setSuccessMessage(
          success,
        )

        await loadWorkspace()
      } catch (
        error
      ) {
        setErrorMessage(
          error?.response?.data?.message ||
          error?.message ||
          'Food Intelligence governance action failed.',
        )
      } finally {
        setBusyKey(
          '',
        )
      }
    }

  /*
  |--------------------------------------------------------------------------
  | Rule Test
  |--------------------------------------------------------------------------
  */

  const handleRuleTest =
    async () => {
      setErrorMessage(
        '',
      )

      setRuleTestResult(
        null,
      )

      let payload

      try {
        payload =
          JSON.parse(
            ruleTestJson,
          )
      } catch {
        setErrorMessage(
          'Rule test input must be valid JSON.',
        )

        return
      }

      setBusyKey(
        'rule-test',
      )

      try {
        const result =
          await testFoodRule(
            payload,
          )

        setRuleTestResult(
          result,
        )
      } catch (
        error
      ) {
        setErrorMessage(
          error?.response?.data?.message ||
          error?.message ||
          'Unable to test Food Rule.',
        )
      } finally {
        setBusyKey(
          '',
        )
      }
    }

  return (
    <AdminShell
      title="Food Intelligence"
      description="Govern ingredient/allergen mappings, deterministic dietary rules and the Trust & Safety calculation review queue."
      actions={
        <button
          type="button"
          onClick={
            loadWorkspace
          }
          disabled={
            isLoading
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-black text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              isLoading
                ? 'animate-spin'
                : ''
            }
          />

          Refresh
        </button>
      }
    >

      <div className="space-y-6">

        {(errorMessage ||
          successMessage) && (
          <div
            className={[
              'rounded-xl',
              'border',
              'px-4',
              'py-3',
              'text-xs',
              'font-semibold',

              errorMessage
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800',
            ].join(
              ' ',
            )}
          >
            {
              errorMessage ||
              successMessage
            }
          </div>
        )}


        <div className="grid gap-3 sm:grid-cols-3">

          <div className="rounded-2xl border border-stone-200 bg-white p-5">

            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Ingredient mappings
            </p>

            <p className="mt-2 text-3xl font-black text-stone-950">
              {stats.mappings}
            </p>

          </div>


          <div className="rounded-2xl border border-stone-200 bg-white p-5">

            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Rule profiles
            </p>

            <p className="mt-2 text-3xl font-black text-stone-950">
              {stats.rules}
            </p>

          </div>


          <div className="rounded-2xl border border-stone-200 bg-white p-5">

            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Review queue
            </p>

            <p className="mt-2 text-3xl font-black text-amber-700">
              {
                stats.reviewRequired
              }
            </p>

          </div>

        </div>


        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">

          <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-4">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <PackageCheck
                    size={18}
                    className="text-emerald-700"
                  />

                  <h2 className="text-sm font-black text-stone-950">
                    Product Food Intelligence declaration
                  </h2>

                </div>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-stone-600">
                  Select any published ProductVersion. Canonical nutrition, allergen and dietary declarations are prefilled where available. Super Admin can complete or correct them here. Saving creates a new immutable approved FoodCalculation; existing public snapshots are never overwritten.
                </p>

              </div>

              {productDeclarationMeta && (
                <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[10px] font-bold text-emerald-800">
                  Existing approved snapshot · Version {productDeclarationMeta.calculationVersion || '—'}
                </div>
              )}

            </div>

          </div>


          <div className="p-5">

            <label className="block">

              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                Published product
              </span>

              <select
                value={selectedProductVersionId}
                onChange={(event) => setSelectedProductVersionId(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-bold text-stone-800 outline-none focus:border-emerald-500"
              >
                <option value="">
                  Select a canonical published product
                </option>

                {publishedProducts.map((product) => (
                  <option
                    key={product.id || product._id}
                    value={product.id || product._id}
                  >
                    {product.displayName || 'Unnamed product'} · v{product.version || 1} · {product.gtin || 'No GTIN'}
                  </option>
                ))}
              </select>

            </label>


            {productDeclarationLoading ? (
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-stone-50 p-4 text-xs font-bold text-stone-500">
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
                Loading canonical Product facts and latest Food Intelligence…
              </div>
            ) : selectedProductVersion ? (
              <form
                onSubmit={saveProductDeclaration}
                className="mt-5 space-y-5"
              >

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-stone-400">
                      Product
                    </p>
                    <p className="mt-1 text-xs font-black text-stone-900">
                      {selectedProductVersion.displayName || '—'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-stone-400">
                      Ingredients
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-stone-700">
                      {selectedProductVersion.ingredientDeclarationText || 'No canonical ingredient declaration published.'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-stone-400">
                      Origin
                    </p>
                    <p className="mt-1 text-xs font-black text-stone-900">
                      {selectedProductVersion.countryOfOrigin || 'Not declared'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-stone-50 p-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-stone-400">
                      Manufacturer
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-stone-700">
                      {selectedProductVersion.manufacturerName || 'Not declared'}
                    </p>
                  </div>

                </div>


                <div className="rounded-2xl border border-stone-200 p-4">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-stone-950">
                        Nutrition
                      </h3>
                      <p className="mt-1 text-xs text-stone-500">
                        Prefilled from the published ProductVersion when canonical nutrition exists. Edit only against reviewed evidence.
                      </p>
                    </div>

                    <select
                      value={productDeclarationForm.nutritionBasis}
                      onChange={(event) =>
                        setProductDeclarationForm((current) => ({
                          ...current,
                          nutritionBasis: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-black text-stone-700 outline-none focus:border-emerald-500"
                    >
                      <option value="per_100g">Per 100 g</option>
                      <option value="per_100ml">Per 100 ml</option>
                      <option value="per_serving">Per serving</option>
                      <option value="per_pack">Per pack</option>
                    </select>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {PRODUCT_NUTRIENTS.map((item) => (
                      <label
                        key={item.key}
                        className="block"
                      >
                        <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                          {item.label} ({item.unit})
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={productDeclarationForm.nutrition[item.key]}
                          onChange={(event) =>
                            setProductDeclarationForm((current) => ({
                              ...current,
                              nutrition: {
                                ...current.nutrition,
                                [item.key]: event.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500"
                        />
                      </label>
                    ))}
                  </div>

                </div>


                <div className="rounded-2xl border border-stone-200 p-4">

                  <h3 className="text-sm font-black text-stone-950">
                    Allergens
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Enter only positive governed relationships such as Contains, May contain or Cross-contact. Leaving this empty never creates an allergen-free claim.
                  </p>

                  <label className="mt-4 block">
                    <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                      Reviewed package allergen statement
                    </span>
                    <textarea
                      rows={2}
                      value={productDeclarationForm.allergenStatement}
                      onChange={(event) =>
                        setProductDeclarationForm((current) => ({
                          ...current,
                          allergenStatement: event.target.value,
                        }))
                      }
                      placeholder="Example: None declared. / Contains Mustard. / May contain Sesame."
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-semibold leading-5 outline-none focus:border-emerald-500"
                    />
                    <p className="mt-1.5 text-[10px] leading-4 text-stone-400">
                      This is the reviewed package wording. "None declared" is displayed as a declaration only and never converted into an allergen-free claim.
                    </p>
                  </label>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_auto]">
                    <input
                      value={allergenDraft.canonicalName}
                      onChange={(event) =>
                        setAllergenDraft((current) => ({
                          ...current,
                          canonicalName: event.target.value,
                        }))
                      }
                      placeholder="Example: Soy, Sesame, Mustard"
                      className="h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold outline-none focus:border-emerald-500"
                    />

                    <select
                      value={allergenDraft.relationship}
                      onChange={(event) =>
                        setAllergenDraft((current) => ({
                          ...current,
                          relationship: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs font-black outline-none focus:border-emerald-500"
                    >
                      <option value="contains">Contains</option>
                      <option value="may_contain">May contain</option>
                      <option value="cross_contact">Cross-contact</option>
                    </select>

                    <button
                      type="button"
                      onClick={addProductAllergen}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-black text-stone-700 hover:border-emerald-300 hover:text-emerald-800"
                    >
                      Add allergen
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {productDeclarationForm.allergens.length ? (
                      productDeclarationForm.allergens.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => removeProductAllergen(item.key)}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-900"
                          title="Remove allergen declaration"
                        >
                          {item.canonicalName} · {item.relationship.replace(/_/g, ' ')} ×
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] font-semibold text-stone-400">
                        No positive allergen relationship declared.
                      </p>
                    )}
                  </div>

                </div>


                <div className="rounded-2xl border border-stone-200 p-4">

                  <h3 className="text-sm font-black text-stone-950">
                    Dietary
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Each result is explicit. Use Not declared when reviewed evidence is insufficient; unknown is never converted into eligibility.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {PRODUCT_DIETARY_KEYS.map((item) => (
                      <label key={item.key}>
                        <span className="text-[10px] font-black uppercase tracking-wide text-stone-500">
                          {item.label}
                        </span>
                        <select
                          value={productDeclarationForm.dietary[item.key]}
                          onChange={(event) =>
                            setProductDeclarationForm((current) => ({
                              ...current,
                              dietary: {
                                ...current.dietary,
                                [item.key]: event.target.value,
                              },
                            }))
                          }
                          className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2 text-xs font-black outline-none focus:border-emerald-500"
                        >
                          <option value="not_declared">Not declared</option>
                          <option value="eligible">Eligible</option>
                          <option value="not_eligible">Not eligible</option>
                        </select>
                      </label>
                    ))}
                  </div>

                </div>


                <div className="grid gap-4 lg:grid-cols-2">

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                      Calculation basis / source explanation
                    </span>
                    <textarea
                      required
                      rows={4}
                      value={productDeclarationForm.basis}
                      onChange={(event) =>
                        setProductDeclarationForm((current) => ({
                          ...current,
                          basis: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-semibold leading-5 outline-none focus:border-emerald-500"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                      Super Admin review reason
                    </span>
                    <textarea
                      required
                      rows={4}
                      value={productDeclarationForm.reason}
                      onChange={(event) =>
                        setProductDeclarationForm((current) => ({
                          ...current,
                          reason: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs font-semibold leading-5 outline-none focus:border-emerald-500"
                    />
                  </label>

                </div>


                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
                  <strong>Calculation source & rule lineage is not typed manually.</strong> EPANTRY generates the immutable ProductVersion source, calculation version, fingerprint and declaration lineage automatically when this declaration is saved. Because this is a reviewed declaration rather than an automated dietary rule run, the public Rules column will explicitly say that no automated Rule Profile was used.
                </div>


                {canProductDeclare ? (
                  <button
                    type="submit"
                    disabled={busyKey === 'product-declaration'}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busyKey === 'product-declaration' ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    {productDeclarationMeta
                      ? 'Save revised Product Food Intelligence'
                      : 'Save & approve Product Food Intelligence'}
                  </button>
                ) : (
                  <p className="text-xs font-bold text-stone-500">
                    Catalog or Trust & Safety mutation permission is required to save Product Food Intelligence.
                  </p>
                )}

              </form>
            ) : (
              <p className="mt-5 rounded-xl bg-stone-50 p-4 text-xs font-semibold text-stone-500">
                Choose a published product to create or revise its customer-facing Food Intelligence.
              </p>
            )}

          </div>

        </section>


        {canMutate && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">

            <div className="flex gap-3">

              <ShieldAlert
                size={20}
                className="shrink-0 text-amber-700"
              />

              <div className="min-w-0 flex-1">

                <p className="text-sm font-black text-amber-950">
                  Critical governance reason
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Maker-checker and audit validation still runs on the backend. This reason accompanies Trust & Safety actions.
                </p>

                <textarea
                  value={
                    reasonDetails
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setReasonDetails(
                        event
                          .target
                          .value,
                      )
                  }
                  rows={3}
                  placeholder="Explain the evidence/review basis for this action..."
                  className="mt-3 w-full rounded-xl border border-amber-200 bg-white p-3 text-xs text-stone-800 outline-none focus:border-amber-500"
                />

              </div>

            </div>

          </section>
        )}


        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">

          <div className="border-b border-stone-200 px-5 py-4">

            <div className="flex items-center gap-2">

              <BadgeCheck
                size={17}
                className="text-emerald-700"
              />

              <h2 className="text-sm font-black text-stone-950">
                A07 · Ingredient / Allergen Mappings
              </h2>

            </div>

            <p className="mt-1 text-xs text-stone-500">
              Effective-dated governed mappings with provenance.
            </p>

          </div>


          {isLoading ? (

            <div className="flex items-center gap-2 p-5 text-xs font-bold text-stone-500">

              <LoaderCircle
                size={16}
                className="animate-spin"
              />

              Loading mappings...

            </div>

          ) : relations.length ===
          0 ? (

            <p className="p-5 text-xs text-stone-500">
              No mappings found.
            </p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[760px] text-left">

                <thead className="bg-stone-50 text-[9px] font-black uppercase tracking-wide text-stone-400">

                  <tr>
                    <th className="px-5 py-3">
                      Mapping
                    </th>

                    <th className="px-5 py-3">
                      Relationship
                    </th>

                    <th className="px-5 py-3">
                      Evidence
                    </th>

                    <th className="px-5 py-3">
                      Status
                    </th>

                    {canMutate && (
                      <th className="px-5 py-3 text-right">
                        Action
                      </th>
                    )}
                  </tr>

                </thead>

                <tbody className="divide-y divide-stone-100">

                  {relations.map(
                    (
                      relation,
                      index,
                    ) => {
                      const id =
                        recordId(
                          relation,
                        )

                      const status =
                        readRecordStatus(
                          relation,
                        )

                      return (
                        <tr
                          key={
                            id ||
                            index
                          }
                          className="text-xs text-stone-600"
                        >

                          <td className="px-5 py-4">

                            <p className="font-black text-stone-900">
                              {
                                shortId(
                                  relation.ingredientId ||
                                  relation.canonicalIngredientId,
                                )
                              }
                            </p>

                            <p className="mt-1 text-[9px] text-stone-400">
                              Allergen {
                                shortId(
                                  relation.allergenId,
                                )
                              }
                            </p>

                          </td>

                          <td className="px-5 py-4 font-bold">
                            {
                              displayValue(
                                relation.relationship ||
                                relation.relationType,
                              )
                            }
                          </td>

                          <td className="px-5 py-4">
                            {
                              displayValue(
                                relation.evidenceState,
                              )
                            }
                          </td>

                          <td className="px-5 py-4">
                            <StatusPill
                              value={
                                status
                              }
                            />
                          </td>

                          {canMutate && (
                            <td className="px-5 py-4 text-right">

                              {status ===
                                'draft' && (
                                <button
                                  type="button"
                                  disabled={
                                    busyKey ===
                                    `mapping-${id}`
                                  }
                                  onClick={() =>
                                    runMutation(
                                      `mapping-${id}`,

                                      () =>
                                        activateIngredientRelation({
                                          relationId:
                                            id,

                                          reasonDetails,
                                        }),

                                      'Ingredient mapping activated.',
                                    )
                                  }
                                  className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                                >
                                  Activate
                                </button>
                              )}

                            </td>
                          )}

                        </tr>
                      )
                    },
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">

          <div className="border-b border-stone-200 px-5 py-4">

            <div className="flex items-center gap-2">

              <FlaskConical
                size={17}
                className="text-blue-700"
              />

              <h2 className="text-sm font-black text-stone-950">
                Food Rule Profiles
              </h2>

            </div>

          </div>


          <div className="divide-y divide-stone-100">

            {rules.length ===
            0 ? (

              <p className="p-5 text-xs text-stone-500">
                No Food Rule Profiles found.
              </p>

            ) : rules.map(
              (
                rule,
                index,
              ) => {
                const id =
                  recordId(
                    rule,
                  )

                const status =
                  readRecordStatus(
                    rule,
                  )

                return (
                  <div
                    key={
                      id ||
                      index
                    }
                    className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >

                    <div>

                      <p className="text-xs font-black text-stone-900">
                        {
                          rule.key ||
                          rule.ruleKey ||
                          rule.profileKey ||
                          shortId(
                            id,
                          )
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-stone-500">
                        Version {
                          rule.version ||
                          rule.ruleVersion ||
                          '—'
                        } · {
                          rule.jurisdiction ||
                          'No jurisdiction label'
                        }
                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <StatusPill
                        value={
                          status
                        }
                      />

                      {canMutate &&
                        status ===
                          'draft' && (
                        <button
                          type="button"
                          disabled={
                            busyKey ===
                            `rule-${id}`
                          }
                          onClick={() =>
                            runMutation(
                              `rule-${id}`,

                              () =>
                                activateFoodRule({
                                  ruleProfileId:
                                    id,

                                  reasonDetails,
                                }),

                              'Food Rule Profile activated.',
                            )
                          }
                          className="rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}

                    </div>

                  </div>
                )
              },
            )}

          </div>

        </section>


        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">

          <div className="border-b border-stone-200 px-5 py-4">

            <div className="flex items-center gap-2">

              <AlertTriangle
                size={17}
                className="text-amber-700"
              />

              <h2 className="text-sm font-black text-stone-950">
                A17 · Trust / Safety Calculation Queue
              </h2>

            </div>

            <p className="mt-1 text-xs text-stone-500">
              Generated calculations remain separate immutable snapshots; approval creates governed state rather than overwriting history.
            </p>

          </div>


          <div className="divide-y divide-stone-100">

            {calculations.length ===
            0 ? (

              <p className="p-5 text-xs text-stone-500">
                No calculations found.
              </p>

            ) : calculations.map(
              (
                calculation,
                index,
              ) => {
                const id =
                  recordId(
                    calculation,
                  )

                const status =
                  readRecordStatus(
                    calculation,
                  )

                return (
                  <div
                    key={
                      id ||
                      index
                    }
                    className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                  >

                    <div className="min-w-0">

                      <p className="text-xs font-black text-stone-900">
                        {
                          calculation.entityType ||
                          calculation.subjectType ||
                          calculation.targetType ||
                          'Food calculation'
                        } · {
                          shortId(
                            calculation.entityId ||
                            calculation.subjectId ||
                            calculation.targetId,
                          )
                        }
                      </p>

                      <p className="mt-1 text-[10px] text-stone-500">
                        Evidence {
                          calculation.evidenceState ||
                          calculation.overallEvidenceState ||
                          'unknown'
                        } · Version {
                          calculation.calculationVersion ||
                          calculation.version ||
                          '—'
                        }
                      </p>

                    </div>

                    <div className="flex items-center gap-2">

                      <StatusPill
                        value={
                          status
                        }
                      />

                      {canMutate &&
                        [
                          'calculated',
                          'review_required',
                          'in_review',
                        ].includes(
                          status,
                        ) && (
                        <button
                          type="button"
                          disabled={
                            busyKey ===
                            `calculation-${id}`
                          }
                          onClick={() =>
                            runMutation(
                              `calculation-${id}`,

                              () =>
                                approveFoodCalculation({
                                  calculationId:
                                    id,

                                  reasonDetails,
                                }),

                              'Food Calculation approved as a new immutable snapshot.',
                            )
                          }
                          className="rounded-lg bg-stone-950 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}

                    </div>

                  </div>
                )
              },
            )}

          </div>

        </section>


        {canMutate && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5">

            <h2 className="text-sm font-black text-stone-950">
              Deterministic Food Rule Test
            </h2>

            <p className="mt-1 text-xs leading-5 text-stone-500">
              Uses the documented POST /admin/food-rules/test endpoint. This tester does not publish or activate a rule.
            </p>

            <textarea
              value={
                ruleTestJson
              }
              onChange={
                (
                  event,
                ) =>
                  setRuleTestJson(
                    event
                      .target
                      .value,
                  )
              }
              rows={10}
              spellCheck={false}
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-950 p-4 font-mono text-[11px] leading-5 text-stone-100 outline-none focus:border-emerald-500"
            />

            <button
              type="button"
              onClick={
                handleRuleTest
              }
              disabled={
                busyKey ===
                'rule-test'
              }
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {
                busyKey ===
                'rule-test'
                  ? (
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                  )
                  : (
                    <FlaskConical
                      size={15}
                    />
                  )
              }

              Run deterministic test
            </button>


            {ruleTestResult && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-stone-950 p-4 text-[10px] leading-5 text-stone-100">
                {
                  JSON.stringify(
                    ruleTestResult,
                    null,
                    2,
                  )
                }
              </pre>
            )}

          </section>
        )}

      </div>

    </AdminShell>
  )
}