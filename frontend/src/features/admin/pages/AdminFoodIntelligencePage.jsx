import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  ChevronRight,
  ClipboardCheck,
  ImageIcon,
  Layers3,
  UtensilsCrossed,
  Plus,
  Trash2,
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
  getAdminRecipeVersion,
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
  const pageSize = Number(first?.pagination?.limit || 100)
  const pages = Math.max(
    1,
    Number(first?.pagination?.pages) || Math.ceil(Number(first?.pagination?.total ?? records.length) / pageSize),
  )

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

function StatusPill({ value }) {
  const normalized = String(value || 'unknown').trim().toLowerCase()
  const color = ['active', 'approved'].includes(normalized)
    ? 'border-[#B9D9C1] bg-[#E7F4EA] text-[#1D603B]'
    : ['review_required', 'requires_review', 'in_review', 'calculated'].includes(normalized)
      ? 'border-[#F0D4B2] bg-[#FFF2DF] text-[#865526]'
      : normalized === 'draft'
        ? 'border-[#D8CEE4] bg-[#F3EFF9] text-[#664D7F]'
        : 'border-[#DDE3DC] bg-[#F2F4F0] text-[#5F6A62]'

  return (
    <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold leading-4 ${color}`}>
      {readableStatus(normalized)}
    </span>
  )
}


/* Images come only from version or dish records provided by EPANTRY APIs. */
function foodImageUrl(value) {
  const raw = typeof value === 'string'
    ? value
    : value?.url || value?.src || value?.imageUrl || ''
  const url = String(raw || '').trim()
  return /^(https?:\/\/|\/[^/])/i.test(url) ? url : ''
}

function foodPhotoFromProduct(product) {
  const images = Array.isArray(product?.images) ? [...product.images] : []
  images.sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
  return foodImageUrl(images[0]) || foodImageUrl(product?.primaryImageUrl) || foodImageUrl(product?.imageUrl)
}

function foodPhotoFromRecipe(record) {
  return foodImageUrl(record?.dish?.heroImageUrl || record?.heroImageUrl || record?.dish?.imageUrl)
}

function FoodItemThumb({ src, label, kind = 'recipe', large = false }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return (
    <div className={`relative shrink-0 overflow-hidden bg-[#E0ECE7] ${large ? 'h-20 w-20 rounded-xl sm:h-28 sm:w-28 sm:rounded-2xl' : 'h-[56px] w-[56px] rounded-lg sm:h-[76px] sm:w-[76px] sm:rounded-xl'}`}>
      {src && !failed ? (
        <img src={src} alt={label ? `${label} image` : 'Food image'} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#537769]" aria-label="Image unavailable">
          {kind === 'product' ? <ImageIcon size={large ? 30 : 24} aria-hidden="true" /> : <UtensilsCrossed size={large ? 29 : 23} aria-hidden="true" />}
          <span className="text-[10px] font-semibold">No photo</span>
        </div>
      )}
    </div>
  )
}

function SectionHeading({ number, kicker, title, subtitle, total, tone = 'green' }) {
  const tones = {
    green: ['bg-[#E1F2E9]', 'text-[#156547]'],
    coral: ['bg-[#FFE6D9]', 'text-[#A3482E]'],
    blue: ['bg-[#DCEBF5]', 'text-[#285E78]'],
    violet: ['bg-[#E8E1F5]', 'text-[#675192]'],
  }
  const [bg, fg] = tones[tone] || tones.green
  return (
    <div className="foodint-panel-heading mb-3.5 flex flex-wrap items-end justify-between gap-2 sm:mb-5 sm:gap-3">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 sm:mb-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${bg} ${fg} text-[14px] font-extrabold sm:text-[15px]`}>{number}</span>
          <p className={`text-[13px] font-bold uppercase tracking-[0.055em] ${fg}`}>{kicker}</p>
        </div>
        <h2 className="text-[22px] font-bold leading-[1.18] tracking-[-0.03em] text-[#18372F] sm:text-[28px] sm:leading-[1.2] sm:tracking-[-0.035em]">{title}</h2>
        {subtitle && <p className="mt-1 text-[14px] leading-[1.5] text-[#52665C] sm:mt-2 sm:text-[15px] sm:leading-6">{subtitle}</p>}
      </div>
      {total !== undefined && <span className={`rounded-full px-3 py-1.5 text-[13px] font-bold sm:py-2 ${bg} ${fg}`}>{total}</span>}
    </div>
  )
}

function ReviewPlaceholder({ title, description, kind = 'recipe' }) {
  const isLink = kind === 'link'
  const isRule = kind === 'rule'
  return (
    <div className={`flex flex-col items-start justify-center p-4 sm:min-h-[205px] sm:p-7 ${isLink ? 'bg-[#EFF7FB]' : isRule ? 'bg-[#F7F2FB]' : 'bg-[#F1F6F1]'}`}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl sm:mb-4 sm:h-12 sm:w-12 sm:rounded-2xl ${isLink ? 'bg-[#DAECF6] text-[#2B6F8B]' : isRule ? 'bg-[#E8DDF4] text-[#735497]' : 'bg-[#D9EBDE] text-[#1D6A4C]'}`}>
        {kind === 'recipe' ? <ClipboardCheck size={24} /> : <Layers3 size={24} />}
      </div>
      <h3 className="text-[18px] font-bold text-[#173E34] sm:text-[20px]">{title}</h3>
      <p className="mt-1 max-w-sm text-[14px] leading-[1.5] text-[#617168] sm:mt-2 sm:text-[15px] sm:leading-6">{description}</p>
    </div>
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

  // Keep the API payload structure, but let administrators enter readable fields.
  const [ruleTestForm, setRuleTestForm] = useState({
    ruleName: 'Vegetarian',
    evidenceComplete: false,
    facts: [],
  })
  const [ruleTestError, setRuleTestError] = useState('')
  const nextRuleFactId = useRef(0)

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

  const [selectedDecision, setSelectedDecision] = useState(null)
  // Mobile work selector only. Desktop keeps every section in its original order.
  const [mobileWorkSection, setMobileWorkSection] = useState('checks')
  const mobileActiveSectionRef = useRef(null)
  const [resolvedFoodItems, setResolvedFoodItems] = useState({})
  const requestedFoodItemsRef = useRef(new Set())
  const decisionPanelRef = useRef(null)
  const productRequestRef = useRef(0)
  const reasonInputRef = useRef(null)

  function chooseMobileWorkSection(section) {
    setMobileWorkSection(section)
    if (typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches) return
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      mobileActiveSectionRef.current?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }

  function chooseDecision(kind, id) {
    if (busyKey) return
    setSelectedDecision({ kind, id: String(id) })
    setReasonDetails('')
    setErrorMessage('')
    setSuccessMessage('')
  }

  useEffect(() => {
    if (!selectedDecision || typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches) return
    const handle = window.requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      decisionPanelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(handle)
  }, [selectedDecision])

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
          const requests = [
            ['allergy links', loadAllWorkspaceRecords(listFoodIngredientRelations), setRelations],
            ['dietary rules', loadAllWorkspaceRecords(listFoodRuleProfiles), setRules],
            ['food checks', loadAllWorkspaceRecords(listFoodCalculations), setCalculations],
            ['published products', loadAllPublishedProductVersions(), setPublishedProducts],
            ['recipe names', loadAllAdminRecipes(), setRecipeItems],
          ]
          const results = await Promise.allSettled(requests.map(([, request]) => request))
          const failed = []
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              requests[index][2](result.value)
            } else {
              failed.push(requests[index][0])
            }
          })
          if (failed.length) {
            setErrorMessage(`Unable to refresh ${failed.join(', ')}. Other available data is still shown. Please try Refresh data.`)
          }
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
        const requestId = ++productRequestRef.current
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
          setProductDeclarationLoading(false)
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

          if (requestId !== productRequestRef.current) return

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
          if (requestId !== productRequestRef.current) return
          setSelectedProductVersion(null)
          setProductDeclarationMeta(null)
          setErrorMessage(
            error?.response?.data?.message ||
            error?.message ||
            'Unable to load Product Food Intelligence declaration.',
          )
        } finally {
          if (requestId === productRequestRef.current) {
            setProductDeclarationLoading(false)
          }
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
      return `Recipe · ${shortId(entityId)}`
    }

    if (
      type ===
      'product_version'
    ) {
      return `Product · ${shortId(entityId)}`
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
      if (!selectedDecision || !reasonDetails.trim()) {
        setErrorMessage(
          'Enter a reason before approving or activating this safety-sensitive change.',
        )
        reasonInputRef.current?.focus()

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

        setSuccessMessage(success)
        setReasonDetails('')
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
  | Rule Test - guided inputs, existing API contract
  |--------------------------------------------------------------------------
  */

  function updateRuleTestForm(changes) {
    setRuleTestForm((current) => ({ ...current, ...changes }))
    setRuleTestResult(null)
    setRuleTestError('')
  }

  function updateRuleTestFact(id, changes) {
    setRuleTestForm((current) => ({
      ...current,
      facts: current.facts.map((fact) =>
        fact.id === id ? { ...fact, ...changes } : fact,
      ),
    }))
    setRuleTestResult(null)
    setRuleTestError('')
  }

  function addRuleTestFact() {
    nextRuleFactId.current += 1
    const id = nextRuleFactId.current
    setRuleTestForm((current) => ({
      ...current,
      facts: [...current.facts, { id, name: '', type: 'boolean', expected: '', observed: '' }],
    }))
    setRuleTestResult(null)
    setRuleTestError('')
  }

  function removeRuleTestFact(id) {
    setRuleTestForm((current) => ({
      ...current,
      facts: current.facts.filter((fact) => fact.id !== id),
    }))
    setRuleTestResult(null)
    setRuleTestError('')
  }

  async function handleRuleTest() {
    setErrorMessage('')
    setRuleTestError('')
    setRuleTestResult(null)

    // Translate visible names to stable keys; do not infer any dietary facts.
    const ruleKey = String(ruleTestForm.ruleName || '')
      .trim().toLowerCase().replace(/[\s-]+/g, '_')

    if (ruleKey.length < 2 || ruleKey.length > 120) {
      setRuleTestError('Choose or enter a dietary rule name (2–120 characters).')
      return
    }

    const requiredFacts = []
    const factMap = {}
    const usedFacts = new Set()

    for (let index = 0; index < ruleTestForm.facts.length; index += 1) {
      const fact = ruleTestForm.facts[index]
      const factKey = String(fact.name || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
      const position = index + 1

      if (!factKey) {
        setRuleTestError(`Food detail ${position}: enter what you are checking.`)
        return
      }
      if (usedFacts.has(factKey)) {
        setRuleTestError(`“${readableStatus(factKey)}” is listed twice. Keep one check per food detail.`)
        return
      }
      usedFacts.add(factKey)

      const expectedText = String(fact.expected ?? '').trim()
      if (expectedText === '') {
        setRuleTestError(`Food detail ${position}: choose or enter what the rule requires.`)
        return
      }

      let expectedValue
      if (fact.type === 'boolean') {
        expectedValue = expectedText === 'true'
      } else if (fact.type === 'number') {
        expectedValue = Number(expectedText)
        if (!Number.isFinite(expectedValue)) {
          setRuleTestError(`Food detail ${position}: the required value must be a number.`)
          return
        }
      } else {
        expectedValue = expectedText
      }

      requiredFacts.push({ factKey, expectedValue })

      const observedText = String(fact.observed ?? '').trim()
      if (observedText !== '') {
        if (fact.type === 'number') {
          const number = Number(observedText)
          if (!Number.isFinite(number)) {
            setRuleTestError(`Food detail ${position}: the verified value must be a number.`)
            return
          }
          factMap[factKey] = number
        } else if (fact.type === 'boolean') {
          factMap[factKey] = observedText === 'true'
        } else {
          factMap[factKey] = observedText
        }
      }
    }

    const payload = {
      ruleKey,
      evidenceComplete: ruleTestForm.evidenceComplete,
      requiredFacts,
      factMap,
    }

    setBusyKey('rule-test')
    try {
      const result = await testFoodRule(payload)
      setRuleTestResult(result)
    } catch (error) {
      setRuleTestError(
        error?.response?.data?.message ||
        error?.message ||
        'Unable to test this dietary rule. Please try again.',
      )
    } finally {
      setBusyKey('')
    }
  }


  const relationDesktopItems =
    expandedLists.relations
      ? relations
      : relations.slice(0, 10)

  const ruleDesktopItems =
    expandedLists.rules
      ? rules
      : rules.slice(0, 10)

  const orderedCalculations = useMemo(
    () => [...calculations].sort((left, right) => {
      const pending = (item) => ['calculated', 'requires_review'].includes(readRecordStatus(item)) ? 1 : 0
      return pending(right) - pending(left)
    }),
    [calculations],
  )

  const calculationDesktopItems =
    expandedLists.calculations
      ? orderedCalculations
      : orderedCalculations.slice(0, 10)

  const foodItemsByVersionId = useMemo(() => {
    const result = new Map()
    for (const product of publishedProducts) {
      const id = recordId(product)
      if (id) result.set(String(id), {
        name: product?.displayName || product?.name || 'Product',
        image: foodPhotoFromProduct(product), kind: 'product',
      })
    }
    for (const item of recipeItems) {
      const id = recordId(item?.latestVersion)
      if (id) result.set(String(id), {
        name: item?.dish?.name || item?.latestVersion?.title || 'Recipe',
        image: foodPhotoFromRecipe(item), kind: 'recipe',
      })
    }
    return result
  }, [publishedProducts, recipeItems])

  // Older recipe versions may not be in the latest-version recipe list.
  // Resolve only currently visible unmatched records, never substitute stock photos.
  useEffect(() => {
    let cancelled = false
    const visible = expandedLists.calculations ? orderedCalculations : orderedCalculations.slice(0, 10)
    const missing = visible.filter((item) => {
      const id = String(item?.entityId || item?.subjectId || item?.targetId || '')
      const type = String(item?.entityType || item?.subjectType || item?.targetType || '')
      if (!id || !['recipe_version', 'product_version'].includes(type)) return false
      if (foodItemsByVersionId.has(id) || resolvedFoodItems[id] || requestedFoodItemsRef.current.has(id)) return false
      requestedFoodItemsRef.current.add(id)
      return true
    })
    if (!missing.length) return undefined
    ;(async () => {
      for (let i = 0; i < missing.length; i += 4) {
        if (cancelled) break
        const batch = missing.slice(i, i + 4)
        const found = await Promise.all(batch.map(async (item) => {
          const id = String(item.entityId || item.subjectId || item.targetId)
          try {
            if (item.entityType === 'recipe_version') {
              const record = await getAdminRecipeVersion(id)
              return [id, { name: record?.dish?.name || record?.recipeVersion?.title || 'Recipe', image: foodPhotoFromRecipe(record), kind: 'recipe' }]
            }
            const record = await getAdminProductVersion(id)
            const version = record?.productVersion || record?.version || record
            return [id, { name: version?.displayName || version?.name || 'Product', image: foodPhotoFromProduct(version), kind: 'product' }]
          } catch { return [id, null] }
        }))
        if (!cancelled) {
          setResolvedFoodItems((previous) => ({ ...previous, ...Object.fromEntries(found.filter(([, data]) => data)) }))
        }
      }
    })()
    return () => {
      cancelled = true
      for (const item of missing) requestedFoodItemsRef.current.delete(String(item.entityId || item.subjectId || item.targetId))
    }
  }, [orderedCalculations, expandedLists.calculations, foodItemsByVersionId])

  function calculationItem(calculation) {
    const id = String(calculation?.entityId || calculation?.subjectId || calculation?.targetId || '')
    const kind = String(calculation?.entityType || '').toLowerCase() === 'product_version' ? 'product' : 'recipe'
    const details = foodItemsByVersionId.get(id) || resolvedFoodItems[id]
    return {
      name: details?.name || foodCheckItemName(calculation),
      image: details?.image || '',
      kind: details?.kind || kind,
    }
  }

  const activeCalculation = selectedDecision?.kind === 'calculation'
    ? calculations.find((entry) => recordId(entry) === selectedDecision.id) : null
  const activeRelation = selectedDecision?.kind === 'relation'
    ? relations.find((entry) => recordId(entry) === selectedDecision.id) : null
  const activeRule = selectedDecision?.kind === 'rule'
    ? rules.find((entry) => recordId(entry) === selectedDecision.id) : null

  function toggleExpandedList(key) {
    setExpandedLists((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  return (
    <AdminShell
      title="Food Intelligence Review"
      description="Review food information, safety links and approvals."
      mobileStackHeader
      actions={
        <button type="button" onClick={loadWorkspace} disabled={isLoading}
          className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#C8DCD2] bg-white px-4 text-[14px] font-semibold sm:w-auto text-[#12483D] transition hover:border-[#2C8A6A] hover:bg-[#EDF7F0] disabled:opacity-60">
          <RefreshCw size={17} aria-hidden="true" className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Refreshing…' : 'Refresh data'}
        </button>
      }
    >
      <main className="foodint-reference-mobile -mx-2.5 min-w-0 bg-[#FAF9F6] pb-0 font-sans text-[#1B342C] sm:mx-0 sm:pb-8">
        <style>{`
          @media (max-width: 639px) {
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header {
              background: #f7f6f2;
              border-color: #e3e5df;
              padding: 18px 15px 23px;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header > div:last-child {
              position: relative;
              gap: 8px;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header h1 {
              font-size: clamp(31px, 8.2vw, 39px);
              line-height: 1.08;
              letter-spacing: -0.045em;
              max-width: 270px;
              margin-top: 11px;
              font-weight: 800;
              color: #202421;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header h1 + p {
              font-size: 14px;
              line-height: 1.4;
              font-weight: 500;
              max-width: 310px;
              margin-top: 7px;
              color: #606a64;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header > div:last-child > div:first-child > div:first-child {
              font-size: 12px;
              line-height: 1.25;
              padding: 0;
              border-radius: 0;
              background: transparent;
              letter-spacing: .065em;
              max-width: 190px;
              color: #1a5542;
              gap: 6px;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header > div:last-child > div:last-child {
              position: absolute;
              top: -1px;
              right: 0;
              width: auto;
              min-width: 115px;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > header > div:last-child > div:last-child button {
              background: #f7f6f2;
              color: #203e34;
              min-height: 41px;
              font-size: 14px;
              border-color: #e5e8df;
              border-radius: 24px;
              padding: 8px 11px;
              white-space: nowrap;
            }
            .epantry-workspace-canvas:has(.foodint-reference-mobile) > div:last-child {
              padding: 0;
            }
            .foodint-reference-mobile {
              margin: 0;
              width: 100%;
              background: #f7f6f2;
              overflow-x: clip;
            }
            .foodint-reference-mobile .foodint-hero {
              background: transparent;
            }
            .foodint-reference-mobile .foodint-hero-layout {
              display: block;
              padding: 0;
            }
            .foodint-reference-mobile .foodint-hero-copy {
              padding: 26px 18px 30px;
              background: #173f35;
            }
            .foodint-reference-mobile .foodint-hero-copy h2 {
              font-size: clamp(28px, 7.4vw, 34px);
              line-height: 1.17;
              letter-spacing: -0.042em;
            }
            .foodint-reference-mobile .foodint-hero-copy > p {
              font-size: 15px;
              line-height: 1.55;
              margin-top: 11px;
            }
            .foodint-reference-mobile .foodint-hero-metrics {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0;
            }
            .foodint-reference-mobile .foodint-hero-metrics > div {
              padding: 17px 15px;
              min-height: 95px;
              border-right: 1px solid #d9ddd6;
              border-bottom: 1px solid #d9ddd6;
              border-radius: 0;
              color: #173f35;
            }
            .foodint-reference-mobile .foodint-hero-metrics > div:nth-child(1) { background: #e0e9dd; border-bottom: 3px solid #c56c43; }
            .foodint-reference-mobile .foodint-hero-metrics > div:nth-child(2) { background: #f7e6dc; }
            .foodint-reference-mobile .foodint-hero-metrics > div:nth-child(3) { background: #e2ebf5; }
            .foodint-reference-mobile .foodint-hero-metrics > div:nth-child(4) { background: #eee9f5; }
            .foodint-reference-mobile .foodint-hero-metrics strong { font-size: 31px; color: #173f35; }
            .foodint-reference-mobile .foodint-hero-metrics span { font-size: 14px; line-height: 1.4; color: #52675e; margin-top: 7px; }
            .foodint-reference-mobile .foodint-work-grid button {
              min-height: 137px;
              border: 1px solid #d8e0d8;
              border-radius: 11px;
              background: #ecf0e9;
              color: #183f33;
              text-align: left;
              padding: 15px 13px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-width: 0;
              transition: background-color .16s ease, border-color .16s ease;
            }
            .foodint-reference-mobile .foodint-work-grid button[aria-pressed="true"] {
              background: #173f35;
              border-color: #173f35;
              border-left: 4px solid #c56c43;
              color: white;
            }
            .foodint-reference-mobile .foodint-work-grid button:focus-visible {
              outline: 3px solid #b06b42;
              outline-offset: 2px;
            }
            .foodint-reference-mobile .foodint-work-grid button[aria-pressed="true"] .foodint-tile-count,
            .foodint-reference-mobile .foodint-work-grid button[aria-pressed="true"] .foodint-tile-number { color: #d5eadd; }
            .foodint-reference-mobile .foodint-decision-row { padding: 13px 12px; gap: 11px; }
            .foodint-reference-mobile .foodint-decision-list:not(.foodint-expanded) > button:nth-child(n+6) { display: none; }
            .foodint-reference-mobile .foodint-panel-heading { margin-bottom: 18px; }
            .foodint-reference-mobile .foodint-panel-heading h2 { font-size: 26px; line-height: 1.18; }
            .foodint-reference-mobile .foodint-panel-heading > div:first-child > div:first-child > span {
              background: transparent; border-radius: 0; width: auto; height: auto;
              padding: 0; font-size: 14px;
            }
            .foodint-reference-mobile .foodint-decision-row > span:nth-of-type(1) > span:first-child { font-size: 16px; line-height: 1.35; }
            .foodint-reference-mobile .foodint-decision-row > span:nth-of-type(1) > span:nth-child(2) { font-size: 13px; }
            .foodint-reference-mobile .foodint-queue-header { padding: 15px 14px; background: #dfeff6; border-color: #d1e2ea; }
            .foodint-reference-mobile .foodint-queue-header > div { color: #285a71; font-size: 16px; }
            .foodint-reference-mobile .foodint-queue-header > span { color: #446779; }
            .foodint-reference-mobile .foodint-panel-heading p { font-size: 14px; }
            .foodint-reference-mobile .foodint-content-anchor { scroll-margin-top: 24px; }
          }
        `}</style>

        {(errorMessage || successMessage) && (
          <div role={errorMessage ? 'alert' : 'status'} aria-live={errorMessage ? 'assertive' : 'polite'}
            className={`flex items-start gap-3 border-b px-4 py-3 text-[15px] leading-6 sm:px-7 ${errorMessage ? 'border-[#E6BBB0] bg-[#FFF0EB] text-[#922F23]' : 'border-[#B8DBC8] bg-[#E1F4E6] text-[#165B3B]'}`}>
            {errorMessage ? <AlertTriangle size={19} className="mt-0.5 shrink-0" aria-hidden="true" /> : <BadgeCheck size={19} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span className="font-semibold">{errorMessage || successMessage}</span>
          </div>
        )}

        <section className="foodint-hero relative overflow-hidden bg-[#103F35] text-white">
          <div className="foodint-hero-layout relative grid gap-5 px-4 pb-5 pt-5 sm:gap-7 sm:px-7 sm:pb-8 sm:pt-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(310px,0.9fr)] lg:items-end">
            <div className="foodint-hero-copy">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-bold tracking-[0.045em] text-[#C4EEDB] sm:mb-3 sm:text-[13px] sm:tracking-[0.06em]">
                <span className="h-2 w-2 rounded-full bg-[#F7A378]" /> FOOD SAFETY WORKSPACE
              </div>
              <h2 className="max-w-xl text-[28px] font-extrabold leading-[1.14] tracking-[-0.035em] sm:text-[38px] sm:leading-[1.12] sm:tracking-[-0.04em]">
                Review. Verify. <span className="text-[#F7B28F]">Approve.</span>
              </h2>
              <p className="mt-2.5 max-w-xl text-[14px] leading-[1.55] text-[#D4E6DC] sm:mt-3 sm:text-[15px] sm:leading-6">
                Choose a record, inspect its details, then record a decision for that exact item.
              </p>
              <div className="mt-4 hidden grid-cols-3 items-center gap-2 text-[12px] font-semibold text-[#E1F3E9] sm:mt-6 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-2 sm:text-[13px]">
                <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DFF3AA] font-extrabold text-[#174A34]">1</span> Select</span>
                <ChevronRight size={15} className="hidden text-[#A8C9BA] sm:block" aria-hidden="true" />
                <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DFF3AA] font-extrabold text-[#174A34]">2</span> Inspect</span>
                <ChevronRight size={15} className="hidden text-[#A8C9BA] sm:block" aria-hidden="true" />
                <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DFF3AA] font-extrabold text-[#174A34]">3</span> Decide</span>
              </div>
            </div>
            <div className="foodint-hero-metrics grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 lg:grid-cols-2 xl:grid-cols-4">
              {[
                ['Products', stats.products], ['Pending checks', stats.reviewRequired],
                ['Allergy links', stats.mappings], ['Dietary rules', stats.rules],
              ].map(([label, value], index) => (
                <div key={label} className={`min-w-0 rounded-xl px-3 py-3 sm:px-3.5 sm:py-4 ${index === 1 ? 'bg-[#F6B38F] text-[#542C22]' : 'bg-[#20594A] text-white'}`}>
                  <strong className="block text-[27px] font-extrabold leading-none tracking-[-0.04em] sm:text-[29px]">
                    {isLoading && !publishedProducts.length && !calculations.length && !relations.length && !rules.length ? '…' : value}
                  </strong>
                  <span className={`mt-1.5 block text-[13px] font-semibold leading-4 sm:mt-2 ${index === 1 ? 'text-[#6A3829]' : 'text-[#DBEDE2]'}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <nav aria-label="Food Intelligence sections" className="relative hidden grid-cols-4 gap-0 border-t border-white/15 px-1 py-1 sm:flex sm:gap-1 sm:overflow-x-auto sm:px-6 sm:pb-1 sm:pt-1">
            {[
              ['#food-review-product', '01', 'Products'],
              ['#food-review-checks', '02', 'Decisions'],
              ['#food-review-allergies', '03', 'Allergy links'],
              ['#food-review-rules', '04', 'Dietary rules'],
            ].map(([href, number, name]) => (
              <a key={href} href={href} className="focus-ring flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[12px] font-semibold leading-4 text-[#EBF6EE] transition hover:bg-white/10 hover:text-white sm:inline-flex sm:min-h-11 sm:shrink-0 sm:flex-row sm:gap-2 sm:px-3 sm:py-2 sm:text-[14px] sm:leading-normal">
                <span className="text-[#F8B795]">{number}</span><span className="sm:hidden">{name === "Allergy links" ? "Allergy" : name === "Dietary rules" ? "Dietary" : name}</span><span className="hidden sm:inline">{name}</span>
              </a>
            ))}
          </nav>
        </section>


        {/* Mobile only: reference-style workspace selector; desktop section navigation unchanged. */}
        <section aria-label="Choose Food Intelligence work" className="border-b border-[#D9DFD7] bg-[#F7F6F2] px-4 pb-5 pt-6 sm:hidden">
          <p className="text-[14px] font-extrabold uppercase tracking-[0.02em] text-[#B65F3B]">01 / Work queue</p>
          <h2 className="mt-2 text-[26px] font-extrabold leading-[1.18] tracking-[-0.035em] text-[#173F35]">Choose what to review</h2>
          <p className="mt-2 text-[14px] leading-5 text-[#607166]">Open a workspace below to review its records.</p>
          <div className="foodint-work-grid mt-5 grid grid-cols-2 gap-2.5">
            {[
              ['checks', 'Food checks', stats.reviewRequired, '01'],
              ['product', 'Product details', stats.products, '02'],
              ['relations', 'Allergy links', stats.mappings, '03'],
              ['rules', 'Dietary rules', stats.rules, '04'],
            ].map(([section, label, count, number]) => (
              <button key={section} type="button" aria-pressed={mobileWorkSection === section}
                onClick={() => chooseMobileWorkSection(section)}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="foodint-tile-number text-[15px] font-extrabold text-[#B26343]">{number}</span>
                  <span className="foodint-tile-count text-[17px] font-extrabold text-[#173F35]">{count}</span>
                </span>
                <span className="text-[16px] font-extrabold leading-5">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <div ref={mobileActiveSectionRef} className="foodint-content-anchor scroll-mt-5">
          <div className="px-0 pt-0 sm:px-6 sm:pt-8">

          <section id="food-review-product" className={`scroll-mt-24 px-4 py-6 sm:px-0 sm:pt-0 sm:pb-9 ${mobileWorkSection === 'product' ? 'block' : 'hidden sm:block'}`}>
            <SectionHeading number="01" kicker="Product information" title="Start with a published product"
              subtitle="Choose one product to review its nutrition, allergens and dietary details." tone="coral" />
            <div className="overflow-hidden rounded-[20px] border border-[#E7D6CB] bg-white shadow-[0_6px_26px_rgba(60,53,40,0.045)]">
              <div className="grid items-center gap-4 bg-[#FFE8D9] p-4 sm:p-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div>
                  <p className="text-[17px] font-extrabold text-[#6D3B2E]">Which product needs a review?</p>
                  <p className="mt-1 text-[14px] leading-5 text-[#855647]">Select a published product to open its full form.</p>
                </div>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[14px] font-bold text-[#673D31]">Published product</span>
                  <select value={selectedProductVersionId}
                    onChange={(event) => { setSelectedProductVersionId(event.target.value); setProductDeclarationLoading(Boolean(event.target.value)) }}
                    disabled={isLoading || Boolean(busyKey) || publishedProducts.length === 0}
                    className="focus-ring min-h-12 w-full min-w-0 rounded-xl border border-[#D2B9AC] bg-white px-3 text-[15px] font-semibold text-[#263B32] outline-none focus:border-[#B35F42] disabled:opacity-60">
                    <option value="">Choose a product</option>
                    {publishedProducts.map((product) => (
                      <option key={recordId(product)} value={recordId(product)}>{product.displayName || product.name || 'Unnamed product'}</option>
                    ))}
                  </select>
                </label>
              </div>
              {publishedProducts.length === 0 && !isLoading && (
                <p className="px-5 py-4 text-[14px] text-[#684D43]">No published products are available yet. Published items will appear here automatically.</p>
              )}
              {productDeclarationLoading ? (
                <div className="flex items-center gap-3 px-5 py-8 text-[15px] text-[#37594C]" role="status">
                  <LoaderCircle size={20} className="animate-spin" aria-hidden="true" /> Loading the selected product…
                </div>
              ) : selectedProductVersion && recordId(selectedProductVersion) === selectedProductVersionId ? (
              <form onSubmit={saveProductDeclaration} className="divide-y divide-[#E0E9E3]">
                <div className="flex flex-col gap-4 bg-[#E6F2EE] p-4 sm:flex-row sm:items-center sm:p-6">
                  <FoodItemThumb src={foodPhotoFromProduct(selectedProductVersion)} label={selectedProductVersion.displayName || 'Product'} kind="product" large />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#167456]">Selected product</p>
                    <h3 className="mt-1 break-words text-[22px] font-bold leading-tight text-[#153E34] sm:text-[25px]">{selectedProductVersion.displayName || selectedProductVersion.name || 'Published product'}</h3>
                    <p className="mt-1 text-[14px] leading-6 text-[#48675B]">Check the package details, then record your evidence and final decision below.</p>
                  </div>
                  {productDeclarationMeta && <span className="self-start rounded-full bg-white px-3 py-2 text-[13px] font-semibold text-[#1A694C]">Approved version {productDeclarationMeta.calculationVersion || '—'}</span>}
                </div>
                <div className="grid gap-x-5 gap-y-4 bg-[#FFF3EA] p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
                  {[
                    ['Product', selectedProductVersion.displayName || '—'],
                    ['Ingredients', selectedProductVersion.ingredientDeclarationText || 'Not provided'],
                    ['Origin', selectedProductVersion.countryOfOrigin || 'Not declared'],
                    ['Manufacturer', selectedProductVersion.manufacturerName || 'Not declared'],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#617266]">{label}</p>
                      <p className="mt-1 break-words text-[15px] font-medium leading-6 text-[#1C302B]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-[#FFFFFF] p-4 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[20px] font-bold text-[#12483D]">01 · Nutrition values</h3>
                      <p className="mt-1 text-[14px] leading-5 text-[#536E68]">Use figures from verified product evidence.</p>
                    </div>
                    <label className="flex items-center gap-2 text-[14px] font-semibold text-[#3D5548]">
                      <span>Basis</span>
                      <select
                        value={productDeclarationForm.nutritionBasis}
                        onChange={(event) => setProductDeclarationForm((current) => ({ ...current, nutritionBasis: event.target.value }))}
                        className="focus-ring min-h-11 rounded-lg border border-[#C6D5C8] bg-white px-3 text-[14px] text-[#1C302B]"
                      >
                        <option value="per_100g">Per 100 g</option>
                        <option value="per_100ml">Per 100 ml</option>
                        <option value="per_serving">Per serving</option>
                        <option value="per_pack">Per pack</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                    {PRODUCT_NUTRIENTS.map((item) => (
                      <label key={item.key} className="min-w-0">
                        <span className="mb-1.5 block text-[13px] font-medium text-[#536C65]">{item.label} <span className="text-[#78877D]">({item.unit})</span></span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={productDeclarationForm.nutrition[item.key]}
                          onChange={(event) => setProductDeclarationForm((current) => ({
                            ...current,
                            nutrition: { ...current.nutrition, [item.key]: event.target.value },
                          }))}
                          className="focus-ring min-h-12 w-full min-w-0 rounded-xl border border-[#C9DED6] bg-white px-3 text-[15px] font-medium text-[#1C302B] outline-none focus:border-[#12483D]"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FFF3EA] p-4 sm:p-6">
                  <div className="mb-4">
                    <h3 className="text-[20px] font-bold text-[#12483D]">02 · Allergen information</h3>
                    <p className="mt-1 text-[14px] leading-5 text-[#536E68]">An empty list does not mean allergen-free.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-[14px] font-semibold text-[#194D40]">Package statement</span>
                      <textarea
                        rows={3}
                        value={productDeclarationForm.allergenStatement}
                        onChange={(event) => setProductDeclarationForm((current) => ({ ...current, allergenStatement: event.target.value }))}
                        placeholder="e.g. Contains mustard. May contain sesame."
                        className="focus-ring min-h-[106px] w-full resize-y rounded-xl border border-[#D6DCD3] bg-white p-3 text-[15px] leading-6 text-[#1C302B] outline-none focus:border-[#12483D]"
                      />
                    </label>
                    <div className="min-w-0">
                      <span className="mb-1.5 block text-[14px] font-semibold text-[#194D40]">Add a reviewed allergen</span>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(140px,0.8fr)_auto]">
                        <input
                          aria-label="Allergen name"
                          value={allergenDraft.canonicalName}
                          onChange={(event) => setAllergenDraft((current) => ({ ...current, canonicalName: event.target.value }))}
                          placeholder="e.g. Soy"
                          className="focus-ring min-h-12 w-full min-w-0 rounded-xl border border-[#D6DCD3] bg-white px-3 text-[15px] outline-none focus:border-[#12483D]"
                        />
                        <select
                          aria-label="Allergen relationship"
                          value={allergenDraft.relationship}
                          onChange={(event) => setAllergenDraft((current) => ({ ...current, relationship: event.target.value }))}
                          className="focus-ring min-h-12 min-w-0 rounded-xl border border-[#D6DCD3] bg-white px-3 text-[14px] outline-none focus:border-[#12483D]"
                        >
                          <option value="contains">Contains</option>
                          <option value="may_contain">May contain</option>
                          <option value="cross_contact">Cross-contact</option>
                        </select>
                        <button type="button" onClick={addProductAllergen} className="focus-ring min-h-12 rounded-xl bg-[#12483D] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#146951]">Add</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2" aria-label="Recorded allergens">
                        {productDeclarationForm.allergens.length ? productDeclarationForm.allergens.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => removeProductAllergen(item.key)}
                            title={`Remove ${item.canonicalName}`}
                            className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DBBAA7] bg-[#FDE7D8] px-3 py-1 text-[13px] font-semibold text-[#794B30] transition-colors hover:bg-[#F4D8C7]"
                          >
                            {item.canonicalName} · {readableStatus(item.relationship)} <span aria-hidden="true">×</span>
                          </button>
                        )) : (
                          <span className="text-[14px] leading-6 text-[#6A7269]">No allergen relationships recorded.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#FFFFFF] p-4 sm:p-6">
                  <h3 className="text-[20px] font-bold text-[#12483D]">03 · Dietary suitability</h3>
                  <p className="mt-1 text-[14px] leading-5 text-[#536E68]">If the evidence is unclear, keep “Not declared”.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {PRODUCT_DIETARY_KEYS.map((item) => (
                      <label key={item.key} className="min-w-0">
                        <span className="mb-1.5 block text-[13px] font-medium text-[#536C65]">{item.label}</span>
                        <select
                          value={productDeclarationForm.dietary[item.key]}
                          onChange={(event) => setProductDeclarationForm((current) => ({
                            ...current,
                            dietary: { ...current.dietary, [item.key]: event.target.value },
                          }))}
                          className="focus-ring min-h-12 w-full min-w-0 rounded-xl border border-[#C9DED6] bg-white px-2.5 text-[14px] text-[#1C302B] outline-none focus:border-[#12483D]"
                        >
                          <option value="not_declared">Not declared</option>
                          <option value="eligible">Eligible</option>
                          <option value="not_eligible">Not eligible</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-[#E7F2EF] p-4 sm:p-6">
                  <div className="mb-3"><h3 className="text-[20px] font-bold text-[#12483D]">04 · Evidence &amp; decision</h3><p className="mt-1 text-[14px] leading-5 text-[#516C61]">Review this product before saving approved details.</p></div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-[14px] font-semibold text-[#194D40]">Evidence reviewed <span className="text-[#BD5837]">*</span></span>
                      <textarea
                        required
                        rows={3}
                        value={productDeclarationForm.basis}
                        onChange={(event) => setProductDeclarationForm((current) => ({ ...current, basis: event.target.value }))}
                        className="focus-ring w-full rounded-xl border border-[#C4DBD3] bg-white p-3 text-[15px] leading-6 outline-none focus:border-[#12483D]"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1.5 block text-[14px] font-semibold text-[#194D40]">Reason for decision <span className="text-[#BD5837]">*</span></span>
                      <textarea
                        required
                        rows={3}
                        value={productDeclarationForm.reason}
                        onChange={(event) => setProductDeclarationForm((current) => ({ ...current, reason: event.target.value }))}
                        className="focus-ring w-full rounded-xl border border-[#C4DBD3] bg-white p-3 text-[15px] leading-6 outline-none focus:border-[#12483D]"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[#CCD8CB] pt-4">
                    <p className="max-w-xl text-[13px] leading-5 text-[#486A5C]">Saving creates an approved version. Existing review history is retained.</p>
                    {canProductDeclare ? (
                      <button
                        type="submit"
                        disabled={busyKey === 'product-declaration'}
                        className="focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#12483D] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#146951] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                      >
                        {busyKey === 'product-declaration' ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
                        {productDeclarationMeta ? 'Save reviewed update' : 'Save approved food details'}
                      </button>
                    ) : (
                      <p className="text-[14px] font-semibold text-[#71472E]">Catalog or Trust &amp; Safety edit permission is required to save.</p>
                    )}
                  </div>
                </div>
              </form>
              ) : selectedProductVersionId ? (
                <p role="status" className="p-5 text-[15px] text-[#985332]">Unable to show this product. Select it again or refresh the data.</p>
              ) : (
                <div className="flex items-center gap-3 bg-[#FFFBF8] px-5 py-5 sm:px-6">
                  <PackageCheck size={24} aria-hidden="true" className="shrink-0 text-[#B97552]" />
                  <p className="text-[15px] leading-6 text-[#765D4C]">After selection, the product image and editable food information appear here.</p>
                </div>
              )}
            </div>
          </section>

          <section id="food-review-checks" className={`scroll-mt-24 border-t border-[#E6E4DD] px-4 py-6 sm:px-0 sm:py-9 ${mobileWorkSection === 'checks' ? 'block' : 'hidden sm:block'}`}>
            <SectionHeading number="02" kicker="Decisions" title="Food checks awaiting a decision"
              subtitle="Select a food item to see its evidence, image and approval controls."
              total={`${stats.reviewRequired} need review`} tone="green" />
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-start">
              <div className="order-1 min-w-0 overflow-hidden rounded-[16px] border border-[#D5E3D9] bg-white sm:order-2 sm:rounded-[18px] lg:order-1">
                <div className="foodint-queue-header flex items-center justify-between gap-2 border-b border-[#D6E4D9] bg-[#E6F3EA] px-4 py-3.5 sm:px-5">
                  <div className="inline-flex items-center gap-2 text-[16px] font-bold text-[#154937]"><Layers3 size={19} /> Review queue</div>
                  <span className="text-[13px] font-bold text-[#476958]">{calculations.length} records</span>
                </div>
                {isLoading && calculations.length === 0 ? (
                  <div role="status" className="flex items-center gap-2 p-5 text-[15px] text-[#536C60]"><LoaderCircle size={19} className="animate-spin" /> Loading checks…</div>
                ) : calculations.length === 0 ? (
                  <div className="flex items-center gap-3 p-6 text-[15px] leading-6 text-[#53665B]">
                    <ClipboardCheck size={25} className="shrink-0 text-[#22825D]" /> No food checks are available yet.
                  </div>
                ) : (
                  <>
                    <div className={`foodint-decision-list ${expandedLists.calculations ? 'foodint-expanded max-h-[560px] overflow-y-auto overscroll-contain' : ''}`}>
                      {calculationDesktopItems.map((calculation, index) => {
                        const id = recordId(calculation)
                        const status = readRecordStatus(calculation)
                        const item = calculationItem(calculation)
                        const active = selectedDecision?.kind === 'calculation' && selectedDecision.id === id
                        const pending = ['calculated', 'requires_review'].includes(status)
                        return (
                          <button key={id || index} type="button" onClick={() => chooseDecision('calculation', id)}
                            aria-pressed={active} disabled={Boolean(busyKey)}
                            className={`foodint-decision-row focus-ring flex w-full min-w-0 items-center gap-2.5 border-b border-[#E7EDE7] px-3 py-2.5 text-left transition last:border-b-0 sm:gap-3 sm:px-4 sm:py-3 ${active ? 'bg-[#E5F5E9] shadow-[inset_4px_0_0_#1D865B]' : 'bg-white hover:bg-[#F3F9F4]'} disabled:cursor-wait`}>
                            <FoodItemThumb src={item.image} label={item.name} kind={item.kind} />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-[15px] font-extrabold leading-[1.35] text-[#19372C] [overflow-wrap:anywhere]">{item.name}</span>
                              <span className="mt-0.5 block text-[13px] leading-5 text-[#687B70] sm:mt-1">{readableEntityType(calculation.entityType)} · V{calculation.calculationVersion || calculation.version || '—'}</span>
                              <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-bold sm:mt-1.5 sm:py-1 ${pending ? 'bg-[#FFF0D9] text-[#8E4E20]' : status === 'approved' ? 'bg-[#E1F2E6] text-[#1B6A48]' : 'bg-[#EDF0F1] text-[#53655F]'}`}>{readableStatus(status)}</span>
                            </span>
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${active ? 'bg-[#146C4B] text-white' : 'bg-[#EDF4EF] text-[#176A4C]'}`}>
                              <ChevronRight size={20} aria-label={active ? 'Selected' : 'Open review'} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {calculations.length > 5 && (
                      <div className={`flex justify-center border-t border-[#E1EAE3] bg-[#FAFCF9] p-3 ${calculations.length <= 10 ? 'sm:hidden' : ''}`}>
                        <button type="button" onClick={() => toggleExpandedList('calculations')} className="focus-ring min-h-10 rounded-xl border border-[#BCD7C6] bg-white px-5 text-[14px] font-bold text-[#16583F] hover:bg-[#E9F5EC]">
                          {expandedLists.calculations ? 'Show fewer items' : `View all ${calculations.length} records`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={`${activeCalculation ? "" : "hidden sm:block"} order-2 min-w-0 scroll-mt-20 overflow-hidden rounded-[16px] border border-[#BBDCCA] bg-white sm:order-1 sm:rounded-[18px] lg:sticky lg:top-5 lg:order-2`} ref={selectedDecision?.kind === 'calculation' ? decisionPanelRef : null}>
                {activeCalculation ? (() => {
                  const id = recordId(activeCalculation)
                  const item = calculationItem(activeCalculation)
                  const status = readRecordStatus(activeCalculation)
                  const pending = ['calculated', 'requires_review'].includes(status)
                  return (
                    <>
                      <div className="border-b border-[#D6E7DB] bg-[#DAF0E3] p-4 sm:p-5">
                        <p className="mb-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#247252]">Selected food check</p>
                        <div className="flex items-start gap-3">
                          <FoodItemThumb src={item.image} label={item.name} kind={item.kind} large />
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-[21px] font-extrabold leading-[1.24] text-[#173C31]">{item.name}</h3>
                            <p className="mt-1 text-[14px] text-[#4C6B5C]">{readableEntityType(activeCalculation.entityType)}</p>
                            <div className="mt-2"><StatusPill value={status} /></div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 sm:p-5">
                        <h4 className="text-[17px] font-extrabold text-[#19392D]">Evidence to inspect</h4>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-[14px]">
                          <div><dt className="font-semibold text-[#6C7D72]">Evidence state</dt><dd className="mt-0.5 break-words font-bold text-[#2A4B3A]">{readableStatus(activeCalculation.evidenceState || activeCalculation.overallEvidenceState)}</dd></div>
                          <div><dt className="font-semibold text-[#6C7D72]">Calculation version</dt><dd className="mt-0.5 font-bold text-[#2A4B3A]">{activeCalculation.calculationVersion || activeCalculation.version || '—'}</dd></div>
                          <div><dt className="font-semibold text-[#6C7D72]">Nutrition entries</dt><dd className="mt-0.5 font-bold text-[#2A4B3A]">{activeCalculation.nutrients?.length ?? '—'}</dd></div>
                          <div><dt className="font-semibold text-[#6C7D72]">Allergen / dietary checks</dt><dd className="mt-0.5 font-bold text-[#2A4B3A]">{activeCalculation.allergens?.length ?? '—'} / {activeCalculation.dietary?.length ?? '—'}</dd></div>
                        </dl>
                        {activeCalculation.basis && (
                          <div className="mt-4 rounded-xl bg-[#F3F6F0] p-3.5">
                            <p className="text-[13px] font-bold text-[#3C654D]">Calculation basis</p>
                            <p className="mt-1 break-words text-[14px] leading-6 text-[#4C6053]">{activeCalculation.basis}</p>
                          </div>
                        )}
                        {(activeCalculation.dietary?.length > 0 || activeCalculation.allergens?.length > 0 || activeCalculation.nutrients?.length > 0 || activeCalculation.sourceVersions?.length > 0) && (
                          <details className="mt-3 rounded-xl border border-[#DCE7DC] bg-white p-3.5">
                            <summary className="focus-ring cursor-pointer text-[14px] font-bold text-[#1A5C40]">View calculated findings</summary>
                            <div className="mt-3 space-y-2 text-[14px] leading-5 text-[#495E53]">
                              {activeCalculation.dietary?.map((entry, index) => <p key={`diet-${index}`} className="break-words"><strong>{readableStatus(entry.ruleKey)}:</strong> {readableStatus(entry.outcome)} ({readableStatus(entry.evidenceState)})</p>)}
                              {activeCalculation.allergens?.map((entry, index) => <p key={`allergy-${index}`} className="break-words"><strong>Allergen {shortId(entry.allergenId)}:</strong> {readableStatus(entry.outcome)} ({readableStatus(entry.evidenceState)})</p>)}
                              {activeCalculation.nutrients?.map((entry, index) => <p key={`nutrition-${index}`} className="break-words"><strong>Nutrient {shortId(entry.nutrientId)}:</strong> {displayValue(entry.amount)} {entry.unit || ''} · {readableStatus(entry.basis)} ({readableStatus(entry.evidenceState)})</p>)}
                              {activeCalculation.sourceVersions?.map((entry, index) => <p key={`source-${index}`} className="break-words"><strong>Source {index + 1}:</strong> {readableStatus(entry.sourceType)} · Version {entry.version || '—'} ({readableStatus(entry.evidenceState)})</p>)}
                            </div>
                          </details>
                        )}
                        {canMutate && pending ? (
                          <div className="mt-4 border-t border-[#DCE8DF] pt-4">
                            <label className="block">
                              <span className="block text-[16px] font-extrabold text-[#1D4535]">Record your reason for {item.name}</span>
                              <span className="mt-1 block text-[14px] leading-5 text-[#64766B]">Required before approving this specific check.</span>
                              <textarea ref={reasonInputRef} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)}
                                rows={3} placeholder={`What evidence supports approving ${item.name}?`}
                                className="focus-ring mt-3 min-h-[110px] w-full resize-y rounded-xl border border-[#A8CDBC] bg-white p-3 text-[15px] leading-6 text-[#19372C] outline-none focus:border-[#186B4C]" />
                            </label>
                            <button type="button" disabled={Boolean(busyKey) || !reasonDetails.trim()}
                              onClick={() => runMutation(`calculation-${id}`, () => approveFoodCalculation({ calculationId: id, reasonDetails: reasonDetails.trim() }), `${item.name}: food check approved.`)}
                              className="focus-ring mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#125741] px-5 text-[15px] font-extrabold text-white transition hover:bg-[#147453] disabled:cursor-not-allowed disabled:opacity-50">
                              {busyKey === `calculation-${id}` ? <LoaderCircle size={18} className="animate-spin" /> : <BadgeCheck size={18} />}
                              {busyKey === `calculation-${id}` ? 'Approving…' : `Approve ${item.name}`}
                            </button>
                          </div>
                        ) : <p className="mt-4 rounded-xl bg-[#EEF3EE] px-3.5 py-3 text-[14px] leading-6 font-medium text-[#4D6355]">{pending ? 'Trust & Safety permission is required to approve.' : 'This record is not awaiting approval. Its history is available above.'}</p>}
                      </div>
                    </>
                  )
                })() : <ReviewPlaceholder title="Choose a food check" description="Tap an item in the queue to view its photo and evidence. The decision form opens only for that item." />}
              </div>
            </div>
          </section>

          <section id="food-review-allergies" className={`scroll-mt-24 border-t border-[#E1E6E8] bg-[#EAF3F7] px-4 py-6 sm:-mx-6 sm:px-6 sm:py-9 ${mobileWorkSection === 'relations' ? 'block' : 'hidden sm:block'}`}>
            <SectionHeading number="03" kicker="Safety links" title="Ingredient & allergen links"
              subtitle="Choose a saved link to examine its relationship before activation."
              total={`${relations.length} links`} tone="blue" />
            <div className={`grid gap-4 ${relations.length ? 'lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.9fr)]' : ''} lg:items-start`}>
              <div className="order-1 min-w-0 overflow-hidden rounded-[16px] border border-[#CDDFE9] bg-white sm:order-2 sm:rounded-[18px] lg:order-1">
                <div className="flex items-center justify-between border-b border-[#DFEAF0] bg-[#DAEBF4] px-4 py-3 text-[15px] font-bold text-[#295F79]"><span>Saved relationships</span><span className="text-[13px]">{relations.length}</span></div>
                {isLoading && !relations.length ? <p role="status" className="p-5 text-[15px]">Loading allergy links…</p>
                : !relations.length ? <div className="p-5"><p className="text-[16px] font-bold text-[#284859]">No ingredient–allergen links yet</p><p className="mt-1 text-[14px] leading-6 text-[#5A7280]">Saved links will appear here when available.</p></div>
                : <>
                  <div className={expandedLists.relations ? 'max-h-[450px] overflow-y-auto overscroll-contain' : ''}>
                    {relationDesktopItems.map((relation, index) => {
                      const id = recordId(relation)
                      const active = selectedDecision?.kind === 'relation' && selectedDecision.id === id
                      return <button type="button" key={id || index} onClick={() => chooseDecision('relation', id)} aria-pressed={active} disabled={Boolean(busyKey)}
                        className={`focus-ring flex w-full min-w-0 items-center gap-3 border-b border-[#E7EFF3] px-4 py-3.5 text-left transition last:border-b-0 ${active ? 'bg-[#E5F3FA] shadow-[inset_4px_0_0_#3682A0]' : 'hover:bg-[#F4F9FC]'}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DAEBF3] text-[#277091]"><ShieldAlert size={21} /></span>
                        <span className="min-w-0 flex-1"><strong className="block break-words text-[15px] text-[#263E4D]">Ingredient {shortId(relation.ingredientId || relation.canonicalIngredientId)}</strong>
                          <span className="mt-1 block break-words text-[13px] text-[#627885]">Allergen {shortId(relation.allergenId)} · {readableStatus(relation.relationship || relation.relationType)}</span><span className="mt-2 inline-flex sm:hidden"><StatusPill value={readRecordStatus(relation)} /></span></span>
                        <span className="hidden sm:block"><StatusPill value={readRecordStatus(relation)} /></span>
                        <ChevronRight size={18} className="shrink-0 text-[#397A95]" />
                      </button>
                    })}
                  </div>
                  {relations.length > 10 && <div className="border-t border-[#DFEAF0] p-3 text-center"><button type="button" onClick={() => toggleExpandedList('relations')} className="focus-ring min-h-10 rounded-xl border border-[#B7D5E4] bg-white px-4 text-[14px] font-bold text-[#286887] hover:bg-[#EAF4FA]">{expandedLists.relations ? 'Show fewer' : `View all ${relations.length}`}</button></div>}
                </>}
              </div>
              {relations.length > 0 && <div ref={selectedDecision?.kind === 'relation' ? decisionPanelRef : null} className={`${activeRelation ? "" : "hidden sm:block"} order-2 min-w-0 scroll-mt-20 overflow-hidden rounded-[16px] border border-[#C8DEE8] bg-white sm:order-1 sm:rounded-[18px] lg:order-2`}>
                {activeRelation ? (() => {
                  const id = recordId(activeRelation)
                  const status = readRecordStatus(activeRelation)
                  return <>
                    <div className="bg-[#DCEEF6] p-4 sm:p-5"><p className="text-[13px] font-bold uppercase text-[#326D88]">Selected allergy link</p><h3 className="mt-2 break-words text-[21px] font-extrabold text-[#23485A]">Ingredient {shortId(activeRelation.ingredientId || activeRelation.canonicalIngredientId)}</h3><p className="mt-1 text-[14px] text-[#506F7E]">Linked allergen {shortId(activeRelation.allergenId)}</p></div>
                    <div className="p-4 sm:p-5"><dl className="grid grid-cols-2 gap-4 text-[14px]"><div><dt className="font-semibold text-[#607989]">Relationship</dt><dd className="mt-1 font-bold text-[#2B5367]">{readableStatus(activeRelation.relationship || activeRelation.relationType)}</dd></div><div><dt className="font-semibold text-[#607989]">Evidence</dt><dd className="mt-1 font-bold text-[#2B5367]">{readableStatus(activeRelation.evidenceState)}</dd></div><div><dt className="font-semibold text-[#607989]">Status</dt><dd className="mt-1"><StatusPill value={status} /></dd></div><div><dt className="font-semibold text-[#607989]">Version</dt><dd className="mt-1 font-bold text-[#2B5367]">{activeRelation.version || activeRelation.relationVersion || '—'}</dd></div></dl>
                      {canMutate && status === 'draft' ? <div className="mt-5 border-t border-[#DBEAF1] pt-4"><label className="block"><span className="text-[16px] font-extrabold text-[#254D60]">Record your reason</span><span className="mt-1 block text-[14px] text-[#567485]">Why should this ingredient–allergen link be active?</span><textarea ref={reasonInputRef} rows={3} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)} placeholder="Describe the reviewed evidence for this link" className="focus-ring mt-3 min-h-24 w-full rounded-xl border border-[#BBD5E2] bg-white p-3 text-[15px] leading-6 outline-none focus:border-[#3883A4]" /></label><button type="button" disabled={Boolean(busyKey) || !reasonDetails.trim()} onClick={() => runMutation(`mapping-${id}`, () => activateIngredientRelation({ relationId: id, reasonDetails: reasonDetails.trim() }), 'Ingredient allergy link activated.')} className="focus-ring mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#276B87] px-4 text-[15px] font-bold text-white hover:bg-[#195775] disabled:opacity-50"><BadgeCheck size={17} /> {busyKey === `mapping-${id}` ? 'Activating…' : 'Activate reviewed link'}</button></div> : <p className="mt-5 rounded-xl bg-[#EFF5F8] p-3 text-[14px] text-[#537081]">{status === 'draft' ? 'Trust & Safety permission is required to activate.' : 'This link is not in draft status.'}</p>}
                    </div>
                  </>
                })() : <ReviewPlaceholder kind="link" title="Select an allergy link" description="Click a link on the left to inspect its saved relationship and activate it when eligible." />}
              </div>}
            </div>
          </section>

          <section id="food-review-rules" className={`scroll-mt-24 border-t border-[#E1DEE9] bg-[#F4EFF9] px-4 py-6 sm:-mx-6 sm:px-6 sm:py-9 ${mobileWorkSection === 'rules' ? 'block' : 'hidden sm:block'}`}>
            <SectionHeading number="04" kicker="Policy rules" title="Dietary rules"
              subtitle="Select a rule to inspect its version and activation status."
              total={`${rules.length} rules`} tone="violet" />
            <div className={`grid gap-4 ${rules.length ? 'lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.9fr)]' : ''} lg:items-start`}>
              <div className="order-1 min-w-0 overflow-hidden rounded-[16px] border border-[#DCD3E9] bg-white sm:order-2 sm:rounded-[18px] lg:order-1">
                <div className="flex items-center justify-between border-b border-[#E8E0F1] bg-[#E8DFF2] px-4 py-3 text-[15px] font-bold text-[#684984]"><span>Saved rule profiles</span><span className="text-[13px]">{rules.length}</span></div>
                {isLoading && !rules.length ? <p role="status" className="p-5 text-[15px]">Loading dietary rules…</p>
                : !rules.length ? <div className="p-5"><p className="text-[16px] font-bold text-[#56466A]">No dietary rules configured</p><p className="mt-1 text-[14px] leading-6 text-[#776C83]">Saved rule profiles will appear here.</p></div>
                : <>
                  <div className={expandedLists.rules ? 'max-h-[450px] overflow-y-auto overscroll-contain' : ''}>
                    {ruleDesktopItems.map((rule, index) => {
                      const id = recordId(rule)
                      const active = selectedDecision?.kind === 'rule' && selectedDecision.id === id
                      return <button type="button" key={id || index} onClick={() => chooseDecision('rule', id)} aria-pressed={active} disabled={Boolean(busyKey)}
                        className={`focus-ring flex w-full min-w-0 items-center gap-3 border-b border-[#EEEAF3] px-4 py-3.5 text-left transition last:border-b-0 ${active ? 'bg-[#EEE7F7] shadow-[inset_4px_0_0_#8564AA]' : 'hover:bg-[#FAF7FC]'}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E9E1F5] text-[#75559D]"><Layers3 size={21} /></span>
                        <span className="min-w-0 flex-1"><strong className="block break-words text-[15px] text-[#3E3452]">{rule.key || rule.ruleKey || rule.profileKey || shortId(id)}</strong><span className="mt-1 block text-[13px] text-[#81778B]">Version {rule.version || rule.ruleVersion || '—'} · {rule.jurisdictionCode || rule.jurisdiction || 'All regions'}</span><span className="mt-2 inline-flex sm:hidden"><StatusPill value={readRecordStatus(rule)} /></span></span>
                        <span className="hidden sm:block"><StatusPill value={readRecordStatus(rule)} /></span><ChevronRight size={18} className="shrink-0 text-[#8467A4]" />
                      </button>
                    })}
                  </div>
                  {rules.length > 10 && <div className="border-t border-[#E8E0F1] p-3 text-center"><button type="button" onClick={() => toggleExpandedList('rules')} className="focus-ring min-h-10 rounded-xl border border-[#D3C2E2] bg-white px-4 text-[14px] font-bold text-[#705090] hover:bg-[#F6F0FA]">{expandedLists.rules ? 'Show fewer' : `View all ${rules.length}`}</button></div>}
                </>}
              </div>
              {rules.length > 0 && <div ref={selectedDecision?.kind === 'rule' ? decisionPanelRef : null} className={`${activeRule ? "" : "hidden sm:block"} order-2 min-w-0 scroll-mt-20 overflow-hidden rounded-[16px] border border-[#DCD3E9] bg-white sm:order-1 sm:rounded-[18px] lg:order-2`}>
                {activeRule ? (() => {
                  const id = recordId(activeRule)
                  const status = readRecordStatus(activeRule)
                  const name = activeRule.key || activeRule.ruleKey || activeRule.profileKey || shortId(id)
                  return <>
                    <div className="bg-[#E8DFF3] p-4 sm:p-5"><p className="text-[13px] font-bold uppercase text-[#765998]">Selected dietary rule</p><h3 className="mt-2 break-words text-[21px] font-extrabold text-[#423254]">{name}</h3><p className="mt-1 text-[14px] text-[#78668B]">Check the version before activation</p></div>
                    <div className="p-4 sm:p-5"><dl className="grid grid-cols-2 gap-4 text-[14px]"><div><dt className="font-semibold text-[#7C728B]">Version</dt><dd className="mt-1 font-bold text-[#544466]">{activeRule.version || activeRule.ruleVersion || '—'}</dd></div><div><dt className="font-semibold text-[#7C728B]">Jurisdiction</dt><dd className="mt-1 font-bold text-[#544466]">{activeRule.jurisdictionCode || activeRule.jurisdiction || 'All regions'}</dd></div><div><dt className="font-semibold text-[#7C728B]">Status</dt><dd className="mt-1"><StatusPill value={status} /></dd></div></dl>
                      {canMutate && status === 'draft' ? <div className="mt-5 border-t border-[#EAE2F3] pt-4"><label className="block"><span className="text-[16px] font-extrabold text-[#554069]">Record your reason for {name}</span><span className="mt-1 block text-[14px] text-[#78688B]">Explain why this version is ready to activate.</span><textarea ref={reasonInputRef} rows={3} value={reasonDetails} onChange={(event) => setReasonDetails(event.target.value)} placeholder={`Evidence supporting ${name}`} className="focus-ring mt-3 min-h-24 w-full rounded-xl border border-[#D5C5E4] bg-white p-3 text-[15px] leading-6 outline-none focus:border-[#8567A4]" /></label><button type="button" disabled={Boolean(busyKey) || !reasonDetails.trim()} onClick={() => runMutation(`rule-${id}`, () => activateFoodRule({ ruleProfileId: id, reasonDetails: reasonDetails.trim() }), 'Food rule activated.')} className="focus-ring mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#674D87] px-4 text-[15px] font-bold text-white hover:bg-[#553775] disabled:opacity-50"><BadgeCheck size={17} /> {busyKey === `rule-${id}` ? 'Activating…' : 'Activate selected rule'}</button></div> : <p className="mt-5 rounded-xl bg-[#F5F1F8] p-3 text-[14px] text-[#746782]">{status === 'draft' ? 'Trust & Safety permission is required to activate.' : 'This rule is not in draft status.'}</p>}
                    </div>
                  </>
                })() : <ReviewPlaceholder kind="rule" title="Choose a dietary rule" description="Select a rule on the left to view its version and activation workflow." />}
              </div>}
            </div>

            {canMutate && (
              <details className="group mt-5 overflow-hidden rounded-[18px] border border-[#DDD2EA] bg-white">
                <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-bold text-[#594873] marker:hidden sm:px-5">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <FlaskConical size={19} aria-hidden="true" />
                    Try a dietary rule
                    <span className="text-[13px] font-normal text-[#83748E]">Optional · No changes saved</span>
                  </span>
                  <span className="text-[21px] leading-none group-open:rotate-45" aria-hidden="true">+</span>
                </summary>

                <div className="border-t border-[#EAE1F0] px-4 pb-5 pt-5 sm:px-6 sm:pb-6">
                  <h3 className="text-[21px] font-extrabold tracking-[-0.025em] text-[#3C3151]">Check a claim before using it</h3>
                  <p className="mt-1 max-w-3xl text-[15px] leading-6 text-[#716581]">
                    Choose a rule, tell us whether the evidence is complete, and compare the food details. This is a practice check; it does not approve or change any saved rule.
                  </p>

                  <datalist id="dietary-rule-suggestions">
                    {Array.from(new Set([
                      'Vegetarian', 'Vegan', 'Gluten free', 'Eggitarian', 'Non vegetarian',
                      ...rules.map((rule) => readableStatus(rule.ruleKey || rule.key || rule.profileKey || '')).filter((name) => name !== 'Unknown'),
                    ])).map((name) => <option key={name} value={name} />)}
                  </datalist>
                  <datalist id="dietary-fact-suggestions">
                    {['Contains meat', 'Contains fish', 'Contains milk', 'Contains eggs', 'Contains gluten', 'Contains nuts'].map((name) =>
                      <option key={name} value={name} />,
                    )}
                  </datalist>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#554469]">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAE1F5] text-[13px] text-[#715090]">01</span>
                        Dietary claim to test
                      </span>
                      <input
                        type="text"
                        list="dietary-rule-suggestions"
                        maxLength={120}
                        value={ruleTestForm.ruleName}
                        onChange={(event) => updateRuleTestForm({ ruleName: event.target.value })}
                        placeholder="e.g. Vegetarian"
                        className="focus-ring min-h-12 w-full rounded-xl border border-[#D8CDE7] bg-[#FBF9FD] px-4 text-[15px] text-[#3F3350] outline-none focus:border-[#8261A6]"
                      />
                      <span className="mt-1.5 block text-[13px] leading-5 text-[#7C7189]">Pick a suggested claim or type the name of a saved rule.</span>
                    </label>

                    <fieldset className="min-w-0">
                      <legend className="mb-2 flex items-center gap-2 text-[15px] font-bold text-[#554469]">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAE1F5] text-[13px] text-[#715090]">02</span>
                        Is the supporting evidence complete?
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" aria-pressed={ruleTestForm.evidenceComplete}
                          onClick={() => updateRuleTestForm({ evidenceComplete: true })}
                          className={`focus-ring min-h-12 rounded-xl border px-3 py-2 text-[14px] font-bold transition ${ruleTestForm.evidenceComplete ? 'border-[#377659] bg-[#E1F1E7] text-[#18583E]' : 'border-[#D8CDE7] bg-[#FBF9FD] text-[#685A77] hover:bg-[#F1EBF7]'}`}>
                          Yes, checked
                        </button>
                        <button type="button" aria-pressed={!ruleTestForm.evidenceComplete}
                          onClick={() => updateRuleTestForm({ evidenceComplete: false })}
                          className={`focus-ring min-h-12 rounded-xl border px-3 py-2 text-[14px] font-bold transition ${!ruleTestForm.evidenceComplete ? 'border-[#906CC0] bg-[#EEE7F8] text-[#624483]' : 'border-[#D8CDE7] bg-[#FBF9FD] text-[#685A77] hover:bg-[#F1EBF7]'}`}>
                          Still checking
                        </button>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-5 text-[#7C7189]">Choose “Yes” only when all supporting information has been reviewed.</p>
                    </fieldset>
                  </div>

                  <div className="mt-6 border-t border-[#EAE2F1] pt-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="flex items-center gap-2 text-[17px] font-extrabold text-[#483859]">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAE1F5] text-[13px] text-[#715090]">03</span>
                          Food details to check
                        </h4>
                        <p className="mt-1 text-[14px] leading-6 text-[#776B84]">Enter the answer the rule requires and what the reviewed evidence actually says.</p>
                      </div>
                      <button type="button" onClick={addRuleTestFact}
                        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#BDA8D3] bg-[#F1EAF8] px-4 text-[14px] font-bold text-[#664985] transition hover:bg-[#E6D9F3]">
                        <Plus size={17} aria-hidden="true" /> Add food detail
                      </button>
                    </div>

                    {ruleTestForm.facts.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-[#D9CDE7] bg-[#FAF8FC] px-4 py-5 text-[14px] leading-6 text-[#726680]">
                        No food details added yet. Select <strong>Add food detail</strong> to check something such as whether the food contains meat or milk.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {ruleTestForm.facts.map((fact, index) => (
                          <div key={fact.id} className="rounded-xl border border-[#E2D9EC] bg-[#FCFAFD] p-3 sm:p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[14px] font-bold text-[#594773]">Food detail {index + 1}</p>
                              <button type="button" onClick={() => removeRuleTestFact(fact.id)} aria-label={`Remove food detail ${index + 1}`}
                                className="focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#A0454F] hover:bg-[#FCEFF0]">
                                <Trash2 size={16} aria-hidden="true" /> Remove
                              </button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <label className="block min-w-0">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#594773]">What to check</span>
                                <input type="text" list="dietary-fact-suggestions" value={fact.name}
                                  onChange={(event) => updateRuleTestFact(fact.id, { name: event.target.value })}
                                  placeholder="e.g. Contains meat"
                                  className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]" />
                              </label>
                              <label className="block min-w-0">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#594773]">Answer type</span>
                                <select value={fact.type} onChange={(event) => updateRuleTestFact(fact.id, { type: event.target.value, expected: '', observed: '' })}
                                  className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]">
                                  <option value="boolean">Yes or No</option>
                                  <option value="number">Number</option>
                                  <option value="string">Text</option>
                                </select>
                              </label>
                              <label className="block min-w-0">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#594773]">Rule requires</span>
                                {fact.type === 'boolean' ? (
                                  <select value={fact.expected} onChange={(event) => updateRuleTestFact(fact.id, { expected: event.target.value })}
                                    className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]">
                                    <option value="">Choose answer</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input type={fact.type === 'number' ? 'number' : 'text'} step={fact.type === 'number' ? 'any' : undefined}
                                    value={fact.expected} onChange={(event) => updateRuleTestFact(fact.id, { expected: event.target.value })}
                                    placeholder={fact.type === 'number' ? 'Required number' : 'Required text'}
                                    className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]" />
                                )}
                              </label>
                              <label className="block min-w-0">
                                <span className="mb-1.5 block text-[13px] font-bold text-[#594773]">Evidence says</span>
                                {fact.type === 'boolean' ? (
                                  <select value={fact.observed} onChange={(event) => updateRuleTestFact(fact.id, { observed: event.target.value })}
                                    className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]">
                                    <option value="">Not checked</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input type={fact.type === 'number' ? 'number' : 'text'} step={fact.type === 'number' ? 'any' : undefined}
                                    value={fact.observed} onChange={(event) => updateRuleTestFact(fact.id, { observed: event.target.value })}
                                    placeholder="Leave blank if unknown"
                                    className="focus-ring min-h-11 w-full rounded-lg border border-[#D9CDE6] bg-white px-3 text-[14px] text-[#3F3350] outline-none focus:border-[#8261A6]" />
                                )}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-[13px] leading-5 text-[#7C7189]">If a detail has not been verified, leave “Evidence says” unanswered. The test will flag missing information rather than guess.</p>
                    {ruleTestForm.evidenceComplete && ruleTestForm.facts.length === 0 && (
                      <p className="mt-3 rounded-lg border border-[#EBCFA9] bg-[#FFF6E7] px-3 py-2 text-[14px] font-medium text-[#87592D]">
                        No food details are being checked. A positive result would not prove any dietary claim. Add the relevant details before relying on the test.
                      </p>
                    )}
                  </div>

                  {ruleTestError && <p role="alert" className="mt-4 rounded-xl border border-[#EBC7C3] bg-[#FFF0EE] px-4 py-3 text-[14px] font-semibold text-[#9C3534]">{ruleTestError}</p>}
                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <button type="button" onClick={handleRuleTest} disabled={Boolean(busyKey)}
                      className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#674D87] px-6 text-[15px] font-bold text-white transition hover:bg-[#553775] disabled:opacity-50">
                      {busyKey === 'rule-test' ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <FlaskConical size={18} aria-hidden="true" />}
                      {busyKey === 'rule-test' ? 'Checking…' : 'Check dietary rule'}
                    </button>
                    <span className="text-[13px] text-[#7C7189]">Test only · Nothing is published or activated</span>
                  </div>

                  {ruleTestResult && (() => {
                    const outcome = ruleTestResult?.outcome || ''
                    const reasonCodes = Array.isArray(ruleTestResult?.reasonCodes) ? ruleTestResult.reasonCodes : []
                    const affectedFact = reasonCodes[1] ? readableStatus(reasonCodes[1]) : ''
                    const eligible = outcome === 'eligible'
                    const blocked = outcome === 'not_eligible'
                    const title = eligible ? 'Meets the entered rule' : blocked ? 'Does not meet this rule' : 'More evidence needed'
                    const explanation = reasonCodes.includes('FOOD_EVIDENCE_INCOMPLETE')
                      ? 'The supporting evidence is marked incomplete. Finish checking it before relying on the claim.'
                      : reasonCodes.includes('FOOD_DIETARY_FACT_UNKNOWN')
                        ? `No verified answer was provided for “${affectedFact}”. Check that food detail and try again.`
                        : reasonCodes.includes('FOOD_DIETARY_RULE_NOT_SATISFIED')
                          ? `The verified answer for “${affectedFact}” does not match what the rule requires.`
                          : reasonCodes.includes('FOOD_DIETARY_RULE_SATISFIED')
                            ? 'The verified answers match every food detail entered in this test.'
                            : 'The test has finished. Review the evidence and entered conditions before taking any action.'
                    return (
                      <div role="status" aria-live="polite" className={`mt-5 rounded-2xl border px-4 py-4 sm:px-5 ${eligible ? 'border-[#B7D9C4] bg-[#EAF6EF]' : blocked ? 'border-[#EAC0B8] bg-[#FFF1ED]' : 'border-[#E7D1AA] bg-[#FFF6E9]'}`}>
                        <p className={`text-[13px] font-bold uppercase tracking-wide ${eligible ? 'text-[#2B7550]' : blocked ? 'text-[#A74534]' : 'text-[#946122]'}`}>Test result</p>
                        <h4 className={`mt-1 text-[19px] font-extrabold ${eligible ? 'text-[#185E3F]' : blocked ? 'text-[#87392D]' : 'text-[#805321]'}`}>{title}</h4>
                        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-[#473F48]">{explanation}</p>
                        <p className="mt-2 text-[13px] text-[#756D74]">This checks only the conditions you entered; it is not an approval or a guarantee about a product.</p>
                      </div>
                    )
                  })()}
                </div>
              </details>
            )}
          </section>
          </div>
        </div>
      </main>
    </AdminShell>
  )
}
