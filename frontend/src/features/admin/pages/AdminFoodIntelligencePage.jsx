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

import {
  listAdminRecipes,
} from '../../recipes/services/recipe.service'

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
      'Reviewed the published product record and available package evidence.',
    reason:
      'Super Admin checked the product nutrition, allergy and dietary details against the reviewed product and package evidence.',
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


function readableStatus(value) {
  const normalized = String(value || 'unknown')
    .trim()
    .replace(/_/g, ' ')

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function readableEntityType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()

  if (normalized === 'product_version') {
    return 'Product food check'
  }

  if (normalized === 'recipe_version') {
    return 'Recipe food check'
  }

  return normalized
    ? readableStatus(normalized)
    : 'Food check'
}

async function loadAllWorkspaceRecords(loader) {
  const first = await loader({ page: 1, limit: 100 })
  const records = Array.isArray(first?.records) ? [...first.records] : []
  const pages = Number(first?.pagination?.pages || 1)

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        loader({ page: index + 2, limit: 100 }),
      ),
    )

    for (const page of rest) {
      if (Array.isArray(page?.records)) {
        records.push(...page.records)
      }
    }
  }

  return records
}

function productVersionItems(result) {
  if (Array.isArray(result?.items)) return result.items
  if (Array.isArray(result?.productVersions)) return result.productVersions
  if (Array.isArray(result?.versions)) return result.versions
  return []
}

async function loadAllPublishedProductVersions() {
  const first = await getAdminProductVersions({
    page: 1,
    limit: 100,
    publicationStatus: 'published',
  })

  const items = [...productVersionItems(first)]
  const pages = Number(first?.pagination?.pages || 1)

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        getAdminProductVersions({
          page: index + 2,
          limit: 100,
          publicationStatus: 'published',
        }),
      ),
    )

    for (const page of rest) {
      items.push(...productVersionItems(page))
    }
  }

  return items.filter((item) => item?.publicationStatus === 'published')
}

async function loadAllAdminRecipes() {
  const first = await listAdminRecipes({
    page: 1,
    limit: 100,
    status: 'all',
  })

  const items = Array.isArray(first?.recipes) ? [...first.recipes] : []
  const pages = Number(first?.pagination?.pages || 1)

  if (pages > 1) {
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        listAdminRecipes({
          page: index + 2,
          limit: 100,
          status: 'all',
        }),
      ),
    )

    for (const page of rest) {
      if (Array.isArray(page?.recipes)) {
        items.push(...page.recipes)
      }
    }
  }

  return items
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
          'requires_review' ||
        normalized ===
          'in_review' ||
        normalized ===
          'calculated'
        ? 'border-orange-200 bg-orange-50 text-orange-800'
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
    expandedLists,
    setExpandedLists,
  ] =
    useState({
      relations: false,
      rules: false,
      calculations: false,
    })

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
    recipeItems,
    setRecipeItems,
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
            relationRecords,
            ruleRecords,
            calculationRecords,
            productItems,
            recipeRecords,
          ] =
            await Promise.all([
              loadAllWorkspaceRecords(
                listFoodIngredientRelations,
              ),
              loadAllWorkspaceRecords(
                listFoodRuleProfiles,
              ),
              loadAllWorkspaceRecords(
                listFoodCalculations,
              ),
              loadAllPublishedProductVersions(),
              loadAllAdminRecipes(),
            ])

          setRelations(
            relationRecords,
          )

          setRules(
            ruleRecords,
          )

          setCalculations(
            calculationRecords,
          )

          setPublishedProducts(
            productItems,
          )

          setRecipeItems(
            recipeRecords,
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
          ? 'Food details updated and approved. The latest approved version is now available.'
          : 'Food details saved and approved. Customers can now see the reviewed information where applicable.',
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
        products:
          publishedProducts.length,

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
                'requires_review',
                'calculated',
              ].includes(
                readRecordStatus(
                  calculation,
                ),
              ),
          ).length,
      }),
      [
        publishedProducts,
        relations,
        rules,
        calculations,
      ],
    )

  const foodCheckNameByEntityId =
    useMemo(
      () => {
        const names =
          new Map()

        for (
          const product
          of publishedProducts
        ) {
          const id =
            recordId(
              product,
            )

          if (id) {
            names.set(
              String(id),
              String(
                product?.displayName ||
                product?.name ||
                'Product',
              ),
            )
          }
        }

        for (
          const item
          of recipeItems
        ) {
          const version =
            item?.latestVersion ||
            {}

          const id =
            recordId(
              version,
            )

          if (id) {
            names.set(
              String(id),
              String(
                item?.dish?.name ||
                version?.title ||
                'Recipe',
              ),
            )
          }
        }

        return names
      },
      [
        publishedProducts,
        recipeItems,
      ],
    )

  function foodCheckItemName(
    calculation,
  ) {
    const entityId =
      String(
        calculation?.entityId ||
        calculation?.subjectId ||
        calculation?.targetId ||
        '',
      )

    const matchedName =
      entityId
        ? foodCheckNameByEntityId.get(
            entityId,
          )
        : ''

    if (matchedName) {
      return matchedName
    }

    const type =
      String(
        calculation?.entityType ||
        calculation?.subjectType ||
        calculation?.targetType ||
        '',
      ).toLowerCase()

    if (
      type ===
      'recipe_version'
    ) {
      return 'Recipe name unavailable'
    }

    if (
      type ===
      'product_version'
    ) {
      return 'Product name unavailable'
    }

    return 'Food item'
  }

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
          'Enter a reason before approving or activating this safety-sensitive change.',
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
          'Unable to complete this Food Intelligence action.',
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


  const relationDesktopItems =
    expandedLists.relations
      ? relations
      : relations.slice(0, 10)

  const relationMobileItems =
    expandedLists.relations
      ? relations
      : relations.slice(0, 6)

  const ruleDesktopItems =
    expandedLists.rules
      ? rules
      : rules.slice(0, 10)

  const ruleMobileItems =
    expandedLists.rules
      ? rules
      : rules.slice(0, 6)

  const calculationDesktopItems =
    expandedLists.calculations
      ? calculations
      : calculations.slice(0, 10)

  const calculationMobileItems =
    expandedLists.calculations
      ? calculations
      : calculations.slice(0, 6)

  function toggleExpandedList(key) {
    setExpandedLists((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <AdminShell
      title="Food Intelligence Review"
      description="Review nutrition, allergy and dietary information before it is trusted across EPANTRY."
      actions={
        <button
          type="button"
          onClick={loadWorkspace}
          disabled={isLoading}
          className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isLoading ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <div className="min-h-[100svh] overflow-hidden bg-[#f6f4ee]">
        {(errorMessage || successMessage) && (
          <div
            className={`border-b px-4 py-3 text-sm font-semibold sm:px-7 ${
              errorMessage
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {errorMessage || successMessage}
          </div>
        )}

        <section className="bg-[#0c5f4c] text-white">
          <div className="px-4 py-5 sm:px-7 sm:py-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-bold text-emerald-100">Food Intelligence workspace</p>
                <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">
                  Keep customer-facing food information accurate and reviewable.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/90">
                  <span className="sm:hidden line-clamp-2">
                    Review product food details, safety links and food checks before approving changes.
                  </span>
                  <span className="hidden sm:inline">
                    Review published product nutrition, allergy information, dietary suitability and safety checks in one governed workspace.
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-4 border-t border-white/15 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                {[
                  ['Products', stats.products],
                  ['Allergy links', stats.mappings],
                  ['Food rules', stats.rules],
                  ['Needs review', stats.reviewRequired],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`${index > 0 ? 'border-l border-white/15 pl-3 sm:pl-4' : ''}`}
                  >
                    <p className="text-xl font-black sm:text-2xl">{value}</p>
                    <p className="mt-0.5 text-[10px] font-semibold leading-4 text-emerald-100 sm:text-xs">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
            {[
              {
                number: '01',
                title: 'Choose what to review',
                mobile: 'Select a published product or open a pending food check.',
                desktop: 'Start with a published product, an allergy link, a food rule or a food check waiting for review.',
              },
              {
                number: '02',
                title: 'Check the evidence',
                mobile: 'Compare the values with the reviewed product or safety evidence.',
                desktop: 'Confirm nutrition, allergy and dietary information against the product and safety evidence you trust.',
              },
              {
                number: '03',
                title: 'Record the reason',
                mobile: 'Explain why a safety-sensitive change is being approved.',
                desktop: 'Add a clear reason before activating a safety link, rule or calculation that changes governed data.',
              },
              {
                number: '04',
                title: 'Approve the change',
                mobile: 'Save or approve only after the details are clear.',
                desktop: 'Save the reviewed product details or approve the pending governed check without overwriting history.',
              },
            ].map((step, index) => (
              <div
                key={step.number}
                className={`px-4 py-3.5 sm:px-6 sm:py-5 ${index % 2 === 1 ? 'border-l border-white/15' : ''} ${index >= 2 ? 'border-t border-white/15 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-emerald-200">{step.number}</span>
                  {index === 0 ? <PackageCheck size={15} aria-hidden="true" className="text-emerald-200" /> : null}
                  {index === 1 ? <BadgeCheck size={15} aria-hidden="true" className="text-emerald-200" /> : null}
                  {index === 2 ? <ShieldAlert size={15} aria-hidden="true" className="text-emerald-200" /> : null}
                  {index === 3 ? <Save size={15} aria-hidden="true" className="text-emerald-200" /> : null}
                </div>
                <p className="mt-2 text-sm font-bold">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80 sm:hidden line-clamp-2">{step.mobile}</p>
                <p className="mt-1 hidden text-xs leading-5 text-emerald-50/80 sm:block">{step.desktop}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#eaf6f1] px-4 py-5 sm:px-7 sm:py-7">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            <div>
              <p className="text-xs font-bold text-emerald-700">Product food details</p>
              <h2 className="mt-1 text-xl font-black text-stone-950">Review what customers will see</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600 sm:hidden line-clamp-2">
                Choose a published product, review its food details and save an approved update.
              </p>
              <p className="mt-2 hidden text-sm leading-6 text-stone-600 sm:block">
                Choose a published product. Existing nutrition and package information is loaded where available so you can review or correct it before saving.
              </p>
              {productDeclarationMeta ? (
                <p className="mt-3 text-xs font-bold text-emerald-800">
                  Approved food record · version {productDeclarationMeta.calculationVersion || '—'}
                </p>
              ) : null}
            </div>

            <div className="min-w-0">
              <label className="block">
                <span className="text-xs font-bold text-stone-700">Choose a published product</span>
                <select
                  value={selectedProductVersionId}
                  onChange={(event) => setSelectedProductVersionId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-emerald-500"
                >
                  <option value="">Select product</option>
                  {publishedProducts.map((product) => (
                    <option key={product.id || product._id} value={product.id || product._id}>
                      {product.displayName || 'Unnamed product'}
                    </option>
                  ))}
                </select>
              </label>

              {publishedProducts.length === 0 && !isLoading ? (
                <p className="mt-2 text-xs font-semibold text-stone-500">
                  No published products are available yet. Publish a product in Catalog & Listings first.
                </p>
              ) : null}

              {productDeclarationLoading ? (
                <div className="mt-4 flex items-center gap-2 border-t border-emerald-900/10 pt-4 text-sm font-semibold text-stone-600">
                  <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                  Loading product food details…
                </div>
              ) : selectedProductVersion ? (
                <form onSubmit={saveProductDeclaration} className="mt-5 border-t border-emerald-900/10 pt-5">
                  <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Product', selectedProductVersion.displayName || '—'],
                      ['Ingredients', selectedProductVersion.ingredientDeclarationText || 'Not provided'],
                      ['Country of origin', selectedProductVersion.countryOfOrigin || 'Not declared'],
                      ['Manufacturer', selectedProductVersion.manufacturerName || 'Not declared'],
                    ].map(([label, value], index) => (
                      <div key={label} className={`${index > 0 ? 'sm:border-l sm:border-emerald-900/10 sm:pl-5' : ''}`}>
                        <p className="text-[11px] font-bold text-emerald-800">{label}</p>
                        <p className="mt-1 text-sm font-semibold leading-5 text-stone-800">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-emerald-900/10 pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h3 className="text-base font-black text-stone-950">Nutrition values</h3>
                        <p className="mt-1 text-xs leading-5 text-stone-600 sm:hidden line-clamp-2">
                          Check each value against the reviewed label or product evidence.
                        </p>
                        <p className="mt-1 hidden text-xs leading-5 text-stone-600 sm:block">
                          Values are prefilled when the published product already has nutrition data. Change them only when reviewed evidence supports the update.
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
                        className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 outline-none focus:border-emerald-500"
                      >
                        <option value="per_100g">Per 100 g</option>
                        <option value="per_100ml">Per 100 ml</option>
                        <option value="per_serving">Per serving</option>
                        <option value="per_pack">Per pack</option>
                      </select>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {PRODUCT_NUTRIENTS.map((item) => (
                        <label key={item.key} className="block">
                          <span className="text-xs font-semibold text-stone-600">{item.label} ({item.unit})</span>
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
                            className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-emerald-900/10 pt-5">
                    <h3 className="text-base font-black text-stone-950">Allergy information</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-600 sm:hidden line-clamp-2">
                      Add only allergies supported by reviewed packaging or safety evidence.
                    </p>
                    <p className="mt-1 hidden text-xs leading-5 text-stone-600 sm:block">
                      Record only confirmed relationships such as Contains, May contain or Cross-contact. Leaving this empty does not mean the product is allergy-free.
                    </p>

                    <label className="mt-4 block">
                      <span className="text-xs font-semibold text-stone-600">Package allergy statement</span>
                      <textarea
                        rows={2}
                        value={productDeclarationForm.allergenStatement}
                        onChange={(event) =>
                          setProductDeclarationForm((current) => ({
                            ...current,
                            allergenStatement: event.target.value,
                          }))
                        }
                        placeholder="Example: Contains mustard. May contain sesame."
                        className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm font-semibold leading-5 outline-none focus:border-emerald-500"
                      />
                    </label>

                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_auto]">
                      <input
                        value={allergenDraft.canonicalName}
                        onChange={(event) =>
                          setAllergenDraft((current) => ({
                            ...current,
                            canonicalName: event.target.value,
                          }))
                        }
                        placeholder="Allergen name, e.g. soy"
                        className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-500"
                      />
                      <select
                        value={allergenDraft.relationship}
                        onChange={(event) =>
                          setAllergenDraft((current) => ({
                            ...current,
                            relationship: event.target.value,
                          }))
                        }
                        className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold outline-none focus:border-emerald-500"
                      >
                        <option value="contains">Contains</option>
                        <option value="may_contain">May contain</option>
                        <option value="cross_contact">Cross-contact</option>
                      </select>
                      <button
                        type="button"
                        onClick={addProductAllergen}
                        className="focus-ring rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        Add allergy
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {productDeclarationForm.allergens.length ? (
                        productDeclarationForm.allergens.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => removeProductAllergen(item.key)}
                            className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-bold text-orange-900"
                            title="Remove allergy"
                          >
                            {item.canonicalName} · {item.relationship.replace(/_/g, ' ')} ×
                          </button>
                        ))
                      ) : (
                        <p className="text-xs font-semibold text-stone-500">No confirmed allergy relationship added.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-emerald-900/10 pt-5">
                    <h3 className="text-base font-black text-stone-950">Dietary suitability</h3>
                    <p className="mt-1 text-xs leading-5 text-stone-600 sm:hidden line-clamp-2">
                      Mark a diet only when the reviewed evidence supports it.
                    </p>
                    <p className="mt-1 hidden text-xs leading-5 text-stone-600 sm:block">
                      Choose Eligible or Not eligible only when the evidence is clear. Leave it as Not declared when there is not enough evidence.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {PRODUCT_DIETARY_KEYS.map((item) => (
                        <label key={item.key}>
                          <span className="text-xs font-semibold text-stone-600">{item.label}</span>
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
                            className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-white px-2 text-xs font-bold outline-none focus:border-emerald-500"
                          >
                            <option value="not_declared">Not declared</option>
                            <option value="eligible">Eligible</option>
                            <option value="not_eligible">Not eligible</option>
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 border-t border-emerald-900/10 pt-5 lg:grid-cols-2">
                    <label>
                      <span className="text-xs font-semibold text-stone-600">What evidence was checked?</span>
                      <textarea
                        required
                        rows={3}
                        value={productDeclarationForm.basis}
                        onChange={(event) =>
                          setProductDeclarationForm((current) => ({
                            ...current,
                            basis: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm font-semibold leading-5 outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-semibold text-stone-600">Why are you saving this decision?</span>
                      <textarea
                        required
                        rows={3}
                        value={productDeclarationForm.reason}
                        onChange={(event) =>
                          setProductDeclarationForm((current) => ({
                            ...current,
                            reason: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm font-semibold leading-5 outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>

                  <p className="mt-4 border-l-4 border-[#315f7a] bg-[#edf5f9] px-4 py-3 text-xs leading-5 text-[#173b4f]">
                    EPANTRY records the product version, calculation history and approval trail automatically when you save.
                  </p>

                  {canProductDeclare ? (
                    <button
                      type="submit"
                      disabled={busyKey === 'product-declaration'}
                      className="focus-ring mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {busyKey === 'product-declaration' ? (
                        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Save size={16} aria-hidden="true" />
                      )}
                      {productDeclarationMeta ? 'Save reviewed update' : 'Save approved food details'}
                    </button>
                  ) : (
                    <p className="mt-4 text-xs font-bold text-stone-500">
                      You need permission to edit Catalog or Trust & Safety data before saving these details.
                    </p>
                  )}
                </form>
              ) : (
                <p className="mt-4 border-t border-emerald-900/10 pt-4 text-sm font-semibold text-stone-600">
                  Choose a published product to review its customer-facing food information.
                </p>
              )}
            </div>
          </div>
        </section>

        {canMutate ? (
          <section className="border-b border-stone-200 bg-[#edf5f9] px-4 py-4 sm:px-7 sm:py-5">
            <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
              <div>
                <p className="text-xs font-bold text-[#315f7a]">Reason for safety changes</p>
                <p className="mt-1 text-sm leading-5 text-stone-600 sm:hidden line-clamp-2">
                  Add a clear reason before activating or approving a safety-sensitive record.
                </p>
                <p className="mt-1 hidden text-sm leading-6 text-stone-600 sm:block">
                  This reason is saved with allergy links, food rules and food checks so the decision can be understood later.
                </p>
              </div>
              <textarea
                value={reasonDetails}
                onChange={(event) => setReasonDetails(event.target.value)}
                rows={2}
                placeholder="Explain the evidence or review reason for this action."
                className="w-full rounded-xl border border-[#bfd3df] bg-white p-3 text-sm text-stone-800 outline-none focus:border-[#315f7a]"
              />
            </div>
          </section>
        ) : null}

        <section className="border-b border-stone-200 bg-white">
          <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="bg-[#173b4f] px-4 py-5 text-white sm:px-7 sm:py-6 lg:px-6">
              <p className="text-xs font-bold text-blue-100">Ingredient allergy links</p>
              <h2 className="mt-1 text-xl font-black">Check governed ingredient-to-allergy links</h2>
              <p className="mt-2 text-sm leading-6 text-blue-50/90 sm:hidden line-clamp-2">
                Review saved links between ingredients and allergies before activating a draft.
              </p>
              <p className="mt-2 hidden text-sm leading-6 text-blue-50/90 sm:block">
                These links tell EPANTRY when an ingredient contains, may contain or can have cross-contact with an allergen.
              </p>
              <p className="mt-3 text-xs font-bold text-blue-100">{relations.length} links loaded</p>
            </div>

            <div className="min-w-0 px-4 sm:px-7">
              {isLoading ? (
                <div className="flex items-center gap-2 py-5 text-sm font-semibold text-stone-500">
                  <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Loading allergy links…
                </div>
              ) : relations.length === 0 ? (
                <div className="py-5">
                  <p className="text-sm font-bold text-stone-900">No ingredient allergy links have been added yet.</p>
                  <p className="mt-1 text-xs text-stone-500">No ingredient-to-allergy links are currently available for review.</p>
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {relationMobileItems.map((relation, index) => {
                      const id = recordId(relation)
                      const status = readRecordStatus(relation)
                      return (
                        <div key={id || index} className={`py-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-stone-900">Ingredient reference {shortId(relation.ingredientId || relation.canonicalIngredientId)}</p>
                              <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">Allergen reference {shortId(relation.allergenId)} · {readableStatus(relation.relationship || relation.relationType)}</p>
                            </div>
                            <StatusPill value={status} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-stone-500">Evidence: {readableStatus(relation.evidenceState)}</span>
                            {canMutate && status === 'draft' ? (
                              <button
                                type="button"
                                disabled={busyKey === `mapping-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `mapping-${id}`,
                                    () => activateIngredientRelation({ relationId: id, reasonDetails }),
                                    'Ingredient allergy link activated.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#173b4f] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Activate
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden sm:block">
                    <div className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-4 border-b border-stone-200 py-3 text-[11px] font-bold text-stone-500">
                      <span>Ingredient / allergen</span><span>Relationship</span><span>Evidence</span><span>Status</span><span>Action</span>
                    </div>
                    {relationDesktopItems.map((relation, index) => {
                      const id = recordId(relation)
                      const status = readRecordStatus(relation)
                      return (
                        <div key={id || index} className="grid grid-cols-[1.4fr_1fr_1fr_auto_auto] items-center gap-4 border-b border-stone-100 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900">Ingredient {shortId(relation.ingredientId || relation.canonicalIngredientId)}</p>
                            <p className="mt-0.5 text-xs text-stone-500">Allergen {shortId(relation.allergenId)}</p>
                          </div>
                          <span className="font-semibold text-stone-700">{readableStatus(relation.relationship || relation.relationType)}</span>
                          <span className="text-stone-600">{readableStatus(relation.evidenceState)}</span>
                          <StatusPill value={status} />
                          <div className="text-right">
                            {canMutate && status === 'draft' ? (
                              <button
                                type="button"
                                disabled={busyKey === `mapping-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `mapping-${id}`,
                                    () => activateIngredientRelation({ relationId: id, reasonDetails }),
                                    'Ingredient allergy link activated.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#173b4f] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Activate
                              </button>
                            ) : <span className="text-xs text-stone-400">—</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="py-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('relations')}
                      className={`${relations.length > 6 ? 'inline-flex sm:hidden' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-[#bfd3df] bg-[#edf5f9] px-4 text-xs font-bold text-[#173b4f]`}
                    >
                      {expandedLists.relations ? 'Show fewer' : `View all ${relations.length}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('relations')}
                      className={`${relations.length > 10 ? 'hidden sm:inline-flex' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-[#bfd3df] bg-[#edf5f9] px-4 text-xs font-bold text-[#173b4f]`}
                    >
                      {expandedLists.relations ? 'Show fewer' : `View all ${relations.length}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#f2eff8]">
          <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="px-4 py-5 sm:px-7 sm:py-6 lg:px-6">
              <p className="text-xs font-bold text-[#624a87]">Dietary rules</p>
              <h2 className="mt-1 text-xl font-black text-stone-950">See the rules EPANTRY can apply automatically</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600 sm:hidden line-clamp-2">
                Review rule versions and activate drafts only after the rule is ready.
              </p>
              <p className="mt-2 hidden text-sm leading-6 text-stone-600 sm:block">
                Food rules are versioned so changes stay traceable. Draft rules can be activated only with the required safety permission and reason.
              </p>
              <p className="mt-3 text-xs font-bold text-[#624a87]">{rules.length} rules loaded</p>
            </div>

            <div className="min-w-0 bg-white/70 px-4 sm:px-7">
              {rules.length === 0 ? (
                <div className="py-5">
                  <p className="text-sm font-bold text-stone-900">No food rules have been configured yet.</p>
                  <p className="mt-1 text-xs text-stone-500">No dietary rules are currently available for review.</p>
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {ruleMobileItems.map((rule, index) => {
                      const id = recordId(rule)
                      const status = readRecordStatus(rule)
                      return (
                        <div key={id || index} className={`py-3 ${index > 0 ? 'border-t border-stone-200/70' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-stone-900">{rule.key || rule.ruleKey || rule.profileKey || shortId(id)}</p>
                              <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">Version {rule.version || rule.ruleVersion || '—'} · {rule.jurisdiction || 'All regions'}</p>
                            </div>
                            <StatusPill value={status} />
                          </div>
                          {canMutate && status === 'draft' ? (
                            <div className="mt-2 text-right">
                              <button
                                type="button"
                                disabled={busyKey === `rule-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `rule-${id}`,
                                    () => activateFoodRule({ ruleProfileId: id, reasonDetails }),
                                    'Food rule activated.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#624a87] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Activate
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden sm:block">
                    {ruleDesktopItems.map((rule, index) => {
                      const id = recordId(rule)
                      const status = readRecordStatus(rule)
                      return (
                        <div key={id || index} className={`flex items-center justify-between gap-4 py-3 ${index > 0 ? 'border-t border-stone-200/70' : ''}`}>
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900">{rule.key || rule.ruleKey || rule.profileKey || shortId(id)}</p>
                            <p className="mt-0.5 text-xs text-stone-500">Version {rule.version || rule.ruleVersion || '—'} · {rule.jurisdiction || 'All regions'}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <StatusPill value={status} />
                            {canMutate && status === 'draft' ? (
                              <button
                                type="button"
                                disabled={busyKey === `rule-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `rule-${id}`,
                                    () => activateFoodRule({ ruleProfileId: id, reasonDetails }),
                                    'Food rule activated.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#624a87] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Activate
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="py-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('rules')}
                      className={`${rules.length > 6 ? 'inline-flex sm:hidden' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-[#cfc3df] bg-white px-4 text-xs font-bold text-[#624a87]`}
                    >
                      {expandedLists.rules ? 'Show fewer' : `View all ${rules.length}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('rules')}
                      className={`${rules.length > 10 ? 'hidden sm:inline-flex' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-[#cfc3df] bg-white px-4 text-xs font-bold text-[#624a87]`}
                    >
                      {expandedLists.rules ? 'Show fewer' : `View all ${rules.length}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="border-b border-stone-200 bg-[#eef6f4]">
          <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="bg-[#0f5f49] px-4 py-5 text-white sm:px-7 sm:py-6 lg:px-6">
              <p className="text-xs font-bold text-emerald-100">Food checks waiting for review</p>
              <h2 className="mt-1 text-xl font-black">Approve checks that need a human decision</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50/90 sm:hidden line-clamp-2">
                Review the evidence state, then approve checks that are ready.
              </p>
              <p className="mt-2 hidden text-sm leading-6 text-emerald-50/90 sm:block">
                Calculations are saved as separate versions. Approving one records a new governed result and keeps the earlier history intact.
              </p>
              <p className="mt-3 text-xs font-bold text-emerald-100">{calculations.length} checks loaded</p>
            </div>

            <div className="min-w-0 bg-white/80 px-4 sm:px-7">
              {calculations.length === 0 ? (
                <div className="py-5">
                  <p className="text-sm font-bold text-stone-900">No food checks are waiting in this workspace.</p>
                  <p className="mt-1 text-xs text-stone-500">There are no food checks to review right now.</p>
                </div>
              ) : (
                <>
                  <div className="sm:hidden">
                    {calculationMobileItems.map((calculation, index) => {
                      const id = recordId(calculation)
                      const status = readRecordStatus(calculation)
                      return (
                        <div key={id || index} className={`py-3 ${index > 0 ? 'border-t border-stone-100' : ''}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-stone-900">{foodCheckItemName(calculation)}</p>
                              <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{readableEntityType(calculation.entityType || calculation.subjectType || calculation.targetType)} · {readableStatus(calculation.evidenceState || calculation.overallEvidenceState)}</p>
                            </div>
                            <StatusPill value={status} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-stone-500">Version {calculation.calculationVersion || calculation.version || '—'}</span>
                            {canMutate && ['calculated', 'requires_review'].includes(status) ? (
                              <button
                                type="button"
                                disabled={busyKey === `calculation-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `calculation-${id}`,
                                    () => approveFoodCalculation({ calculationId: id, reasonDetails }),
                                    'Food check approved.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#0f5f49] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Approve
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden sm:block">
                    <div className="grid grid-cols-[1.2fr_1fr_100px_auto_auto] gap-4 border-b border-stone-200 py-3 text-[11px] font-bold text-stone-500">
                      <span>Food check</span><span>Evidence</span><span>Version</span><span>Status</span><span>Action</span>
                    </div>
                    {calculationDesktopItems.map((calculation, index) => {
                      const id = recordId(calculation)
                      const status = readRecordStatus(calculation)
                      return (
                        <div key={id || index} className="grid grid-cols-[1.2fr_1fr_100px_auto_auto] items-center gap-4 border-b border-stone-100 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900">{foodCheckItemName(calculation)}</p>
                            <p className="mt-0.5 text-xs text-stone-500">{readableEntityType(calculation.entityType || calculation.subjectType || calculation.targetType)}</p>
                          </div>
                          <span className="text-stone-600">{readableStatus(calculation.evidenceState || calculation.overallEvidenceState)}</span>
                          <span className="font-semibold text-stone-600">{calculation.calculationVersion || calculation.version || '—'}</span>
                          <StatusPill value={status} />
                          <div className="text-right">
                            {canMutate && ['calculated', 'requires_review'].includes(status) ? (
                              <button
                                type="button"
                                disabled={busyKey === `calculation-${id}`}
                                onClick={() =>
                                  runMutation(
                                    `calculation-${id}`,
                                    () => approveFoodCalculation({ calculationId: id, reasonDetails }),
                                    'Food check approved.',
                                  )
                                }
                                className="focus-ring rounded-lg bg-[#0f5f49] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              >
                                Approve
                              </button>
                            ) : <span className="text-xs text-stone-400">—</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="py-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('calculations')}
                      className={`${calculations.length > 6 ? 'inline-flex sm:hidden' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 text-xs font-bold text-emerald-800`}
                    >
                      {expandedLists.calculations ? 'Show fewer' : `View all ${calculations.length}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpandedList('calculations')}
                      className={`${calculations.length > 10 ? 'hidden sm:inline-flex' : 'hidden'} focus-ring min-h-9 items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 text-xs font-bold text-emerald-800`}
                    >
                      {expandedLists.calculations ? 'Show fewer' : `View all ${calculations.length}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {canMutate ? (
          <section className="bg-[#f1f3f5] px-4 py-5 sm:px-7 sm:py-6">
            <details>
              <summary className="cursor-pointer list-none text-sm font-black text-stone-900">
                Advanced rule check
                <span className="ml-2 text-xs font-semibold text-stone-500">Optional</span>
              </summary>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-stone-600 sm:hidden line-clamp-2">
                Test an existing rule payload without publishing or activating anything.
              </p>
              <p className="mt-2 hidden max-w-3xl text-xs leading-5 text-stone-600 sm:block">
                Use this only when you already have a rule test payload. It checks how the rule evaluates and does not publish, activate or change customer-facing data.
              </p>
              <textarea
                value={ruleTestJson}
                onChange={(event) => setRuleTestJson(event.target.value)}
                rows={8}
                spellCheck={false}
                className="mt-4 w-full rounded-xl border border-stone-300 bg-[#111827] p-4 font-mono text-[11px] leading-5 text-stone-100 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleRuleTest}
                disabled={busyKey === 'rule-test'}
                className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#173b4f] px-4 text-xs font-bold text-white disabled:opacity-50"
              >
                {busyKey === 'rule-test' ? (
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <FlaskConical size={15} aria-hidden="true" />
                )}
                Run test
              </button>
              {ruleTestResult ? (
                <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-[#111827] p-4 text-[10px] leading-5 text-stone-100">
                  {JSON.stringify(ruleTestResult, null, 2)}
                </pre>
              ) : null}
            </details>
          </section>
        ) : null}
      </div>
    </AdminShell>
  )
}
