import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  Check,
  ChefHat,
  ChevronDown,
  History,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  Save,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'


import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getRecipeFoodIntelligence,
} from '../../foodIntelligence/services/foodIntelligence.service'

import {
  confirmIHaveThis,
  correctPantryQuantity,
  getPantryErrorMessage,
  getRecipePantry,
  recordRecipeCooked,
  requestPantrySetupReminder,
  updatePantryStorage,
  updatePantryUseSoon,
} from '../../pantry/services/pantry.service'

import {
  getPublicRecipe,
  listPublicRecipes,
  scalePublicRecipe,
} from '../services/recipe.service'

function formatQuantity(
  value,
) {
  const numeric =
    Number(
      value,
    )

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return value
  }

  return new Intl.NumberFormat(
    undefined,
    {
      maximumFractionDigits:
        3,
    },
  ).format(
    numeric,
  )
}

function toDateInputValue(
  value,
) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const RECIPE_CART_PENDING_KEY =
  'epantry-pending-recipe-cart'

const PANTRY_STATUS_LABELS =
  Object.freeze({
    available:
      'Available at home',
    partial:
      'Partially available',
    uncertain:
      'Needs confirmation',
    missing:
      'Missing',
    untracked:
      'Not tracking',
  })

function createPantryIdempotencyKey() {
  if (
    typeof crypto !==
      'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID()
  }

  return [
    'recipe-cooked',
    Date.now(),
    Math.random()
      .toString(36)
      .slice(2),
  ].join('-')
}

function getPantryRequirementLines(
  reconciliation,
) {
  if (
    Array.isArray(
      reconciliation?.requirements,
    )
  ) {
    return reconciliation.requirements
  }

  if (
    Array.isArray(
      reconciliation?.ingredients,
    )
  ) {
    return reconciliation.ingredients
  }

  if (
    Array.isArray(
      reconciliation?.lines,
    )
  ) {
    return reconciliation.lines
  }

  return []
}

function getPantryLineIngredientId(
  line,
) {
  return String(
    line?.canonicalIngredientId ||
      line?.ingredientId ||
      line?.requirement?.canonicalIngredientId ||
      line?.requirement?.ingredientId ||
      '',
  ).trim()
}

function getPantryLineStatus(
  line,
) {
  return (
    line?.status ||
    line?.availabilityStatus ||
    line?.pantryStatus ||
    'uncertain'
  )
}

function savePendingRecipeCart(
  value,
) {
  try {
    window.sessionStorage.setItem(
      RECIPE_CART_PENDING_KEY,
      JSON.stringify(value),
    )
  } catch {
    // Session persistence is best-effort UX state only.
  }
}


function notifyFloatingCartUpdated() {
  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-updated',
      {
        detail: {
          show: true,
        },
      },
    ),
  )
}

function notifyFloatingCartFly({
  name,
  sourceElement,
}) {
  const rect =
    sourceElement
      ?.getBoundingClientRect?.()

  window.dispatchEvent(
    new CustomEvent(
      'epantry-cart-fly',
      {
        detail: {
          name,
          startRect:
            rect
              ? {
                  left:
                    rect.left +
                    rect.width /
                      2,
                  top:
                    rect.top +
                    rect.height /
                      2,
                }
              : null,
        },
      },
    ),
  )
}

function readPendingRecipeCart() {
  try {
    const raw =
      window.sessionStorage.getItem(
        RECIPE_CART_PENDING_KEY,
      )

    return raw
      ? JSON.parse(raw)
      : null
  } catch {
    return null
  }
}

function recipeDetailLabel(
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

function resolveRecipeDietaryBadge(foodIntelligence) {
  const dietaryRows = Array.isArray(foodIntelligence?.dietary)
    ? foodIntelligence.dietary
    : []

  const eligible = dietaryRows.find((item) =>
    String(item?.outcome || item?.status || '')
      .trim()
      .toLowerCase() === 'eligible',
  )

  const key = String(
    eligible?.ruleKey ||
      eligible?.key ||
      eligible?.label ||
      '',
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')

  if (key === 'vegetarian' || key === 'vegan') {
    return { label: 'Veg', kind: 'veg' }
  }

  if (key === 'eggitarian' || key === 'non_vegetarian') {
    return { label: 'Non-veg', kind: 'nonveg' }
  }

  return null
}

function RecipeDetailsSheet({
  dish,
  recipe,
  ingredients,
  foodIntelligence,
}) {
  const scrollRef = useRef(null)
  const resumeTimerRef = useRef(null)
  const animationFrameRef = useRef(null)
  const pausedUntilRef = useRef(0)
  const directionRef = useRef(1)

  const pauseAutoScroll = useCallback(() => {
    pausedUntilRef.current = Date.now() + 3200
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = window.setTimeout(() => {
      pausedUntilRef.current = 0
    }, 3200)
  }, [])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || typeof window === 'undefined') return undefined

    const mobileQuery = window.matchMedia('(max-width: 639px)')
    if (!mobileQuery.matches) return undefined

    let previousTime = performance.now()

    const tick = (time) => {
      const target = scrollRef.current
      if (!target) return

      const delta = Math.min(time - previousTime, 48)
      previousTime = time

      if (Date.now() >= pausedUntilRef.current) {
        const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
        if (maxScroll > 2) {
          if (target.scrollTop >= maxScroll - 1) directionRef.current = -1
          if (target.scrollTop <= 1) directionRef.current = 1
          target.scrollTop += directionRef.current * delta * 0.018
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(tick)
    }

    animationFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current)
      }
    }
  }, [])

  const ingredientRows =
    Array.isArray(
      ingredients,
    )
      ? ingredients
      : []

  const nutritionRows =
    Array.isArray(
      foodIntelligence
        ?.nutrition,
    )
      ? foodIntelligence.nutrition
      : []

  const allergenRows =
    Array.isArray(
      foodIntelligence
        ?.allergens,
    )
      ? foodIntelligence.allergens
      : []

  const dietaryRows =
    Array.isArray(
      foodIntelligence
        ?.dietary,
    )
      ? foodIntelligence.dietary
      : []

  const dietaryBadge = resolveRecipeDietaryBadge(foodIntelligence)

  return (
    <div className="flex h-full min-h-[205px] max-h-[240px] w-full flex-col overflow-hidden bg-[#f4f7f2] sm:min-h-[360px] sm:max-h-[560px]">
      <div className="border-b border-emerald-800 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-700 px-3 py-2 text-white sm:px-5 sm:py-5">
        <p className="text-[7px] font-black uppercase tracking-[0.13em] text-emerald-200 sm:text-[10px] sm:tracking-[0.18em]">
          EPANTRY · Recipe details sheet
        </p>
        <div className="mt-1 flex items-start justify-between gap-2 sm:block">
          <h2 className="min-w-0 font-sans text-[15px] font-black leading-[1.08] sm:mt-2 sm:font-serif sm:text-3xl sm:font-semibold sm:leading-tight">
            {dish?.name ||
              recipe?.title ||
              'Recipe'}
          </h2>
          {dietaryBadge ? (
            <span
              className={[
                'shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] sm:hidden',
                dietaryBadge.kind === 'veg'
                  ? 'border-lime-200 bg-lime-100/95 text-lime-900'
                  : 'border-rose-200 bg-rose-100/95 text-rose-900',
              ].join(' ')}
            >
              {dietaryBadge.label}
            </span>
          ) : null}
        </div>
        <p className="mt-1 hidden text-xs font-semibold leading-4 text-emerald-100/80 sm:block">
          Published recipe details · generated from governed listing data
        </p>
      </div>

      <div
        ref={scrollRef}
        onTouchStart={pauseAutoScroll}
        onTouchMove={pauseAutoScroll}
        onWheel={pauseAutoScroll}
        onPointerDown={pauseAutoScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-5"
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            [
              'Base servings',
              recipe?.baseServings ??
                '—',
            ],
            [
              'Prep time',
              `${Number(
                recipe?.preparationTimeMinutes ||
                  0,
              )} min`,
            ],
            [
              'Cook time',
              `${Number(
                recipe?.cookingTimeMinutes ||
                  0,
              )} min`,
            ],
            [
              'Difficulty',
              recipeDetailLabel(
                recipe?.difficulty,
              ) ||
                '—',
            ],
            [
              'Cuisine',
              dish?.cuisine ||
                '—',
            ],
            [
              'Course',
              dish?.course ||
                '—',
            ],
          ].map(
            ([
              label,
              value,
            ]) => (
              <div
                key={label}
                className="border-b border-stone-200 pb-2"
              >
                <dt className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-400">
                  {label}
                </dt>
                <dd className="mt-1 text-xs font-black text-stone-900">
                  {value}
                </dd>
              </div>
            ),
          )}
        </dl>

        <div className="mt-5 border-t border-stone-200 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Ingredients
          </p>
          <div className="mt-2 space-y-1.5">
            {ingredientRows.length ? (
              ingredientRows.map(
                (
                  ingredient,
                  index,
                ) => (
                  <p
                    key={
                      ingredient.id ||
                      index
                    }
                    className="text-xs font-semibold leading-5 text-stone-700"
                  >
                    <span className="font-black text-stone-900">
                      {formatQuantity(
                        ingredient.quantity,
                      )}{' '}
                      {ingredient.unit}
                    </span>{' '}
                    {ingredient
                      ?.ingredient
                      ?.name ||
                      'Ingredient'}
                    {ingredient.preparationState
                      ? ` · ${ingredient.preparationState}`
                      : ''}
                    {ingredient.optional
                      ? ' · optional'
                      : ''}
                  </p>
                ),
              )
            ) : (
              <p className="text-xs font-semibold text-stone-500">
                Ingredient details are not available.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-stone-200 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Nutrition
            </p>
            <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-400">
              {foodIntelligence
                ?.verificationStatus
                ? recipeDetailLabel(
                    foodIntelligence.verificationStatus,
                  )
                : 'Cannot verify'}
            </span>
          </div>

          {nutritionRows.length ? (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {nutritionRows.map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={`${item?.key ||
                      item?.name ||
                      'nutrient'}-${index}`}
                    className="flex items-center justify-between gap-2 border-b border-stone-100 py-1.5 text-[11px]"
                  >
                    <span className="font-bold text-stone-500">
                      {item?.name ||
                        recipeDetailLabel(
                          item?.key,
                        )}
                    </span>
                    <span className="font-black text-stone-950">
                      {item?.amount ??
                        '—'}{' '}
                      {item?.unit ||
                        ''}
                    </span>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-stone-500">
              Approved nutrition details are not available.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-stone-200 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
            Allergens & dietary
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
            {foodIntelligence
              ?.allergenStatement ||
              (allergenRows.length
                ? allergenRows
                    .map(
                      (
                        item,
                      ) =>
                        `${item?.name ||
                          recipeDetailLabel(
                            item?.key,
                          )}: ${recipeDetailLabel(
                          item?.relationship ||
                            item?.relationType ||
                            item?.outcome ||
                            item?.evidenceState,
                        )}`,
                    )
                    .join(
                      ' · ',
                    )
                : 'No approved allergen declaration available')}
          </p>

          {dietaryRows.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {dietaryRows.map(
                (
                  item,
                  index,
                ) => (
                  <span
                    key={`${item?.ruleKey ||
                      item?.key ||
                      'dietary'}-${index}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800"
                  >
                    {recipeDetailLabel(
                      item?.label ||
                        item?.ruleKey ||
                        item?.key,
                    )}: {recipeDetailLabel(
                      item?.status ||
                        item?.outcome,
                    )}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}



const RECIPE_RECOMMENDATION_LIMIT = 5

function getRecipeRecommendationKey(item) {
  return String(
    item?.dish?.id ||
      item?.recipe?.id ||
      item?.dish?.slug ||
      '',
  ).trim()
}

function getRecipeRecommendationName(item) {
  return (
    item?.dish?.name ||
    item?.recipe?.title ||
    'Recipe'
  )
}

function getRecipeRecommendationPath(item) {
  return (
    item?.path ||
    `/recipes/${encodeURIComponent(
      item?.dish?.slug || '',
    )}`
  )
}

function RecommendedRecipeCard({
  item,
}) {
  const dish = item?.dish || {}
  const recipe = item?.recipe || {}
  const totalMinutes =
    Number(recipe.preparationTimeMinutes || 0) +
    Number(recipe.cookingTimeMinutes || 0)

  return (
    <Link
      to={getRecipeRecommendationPath(item)}
      className="focus-ring group flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-[#e2d8c8] bg-[#fffdf8] shadow-[0_6px_18px_rgba(92,70,38,0.07)] transition duration-300 hover:-translate-y-1.5 hover:border-amber-300 hover:shadow-[0_22px_46px_rgba(92,70,38,0.15)] motion-reduce:transform-none motion-reduce:transition-none sm:rounded-[24px] sm:shadow-[0_10px_30px_rgba(92,70,38,0.08)]"
      aria-label={`Open ${getRecipeRecommendationName(item)}`}
    >
      <div className="relative aspect-[1.08/1] overflow-hidden bg-[linear-gradient(145deg,#fbf2df,#eef5eb)]">
        {dish.heroImageUrl ? (
          <img
            src={dish.heroImageUrl}
            alt={dish.name || getRecipeRecommendationName(item)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-emerald-800/45">
            <ChefHat
              size={44}
              strokeWidth={1.45}
              aria-hidden="true"
            />
          </div>
        )}

        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-2">
          {dish.cuisine ? (
            <span className="rounded-full border border-white/65 bg-white/90 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-[#24543d] shadow-sm backdrop-blur sm:px-2.5 sm:py-1 sm:text-[9px] sm:font-black sm:tracking-[0.12em]">
              {dish.cuisine}
            </span>
          ) : null}
          {dish.course ? (
            <span className="rounded-full border border-amber-100/80 bg-[#fff7e8]/92 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] text-amber-800 shadow-sm backdrop-blur sm:px-2.5 sm:py-1 sm:text-[9px] sm:font-black sm:tracking-[0.12em]">
              {dish.course}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.7em] text-[12px] font-semibold leading-[1.35] tracking-normal text-[#173c2d] sm:text-[16px] sm:font-black sm:tracking-[-0.02em]">
          {getRecipeRecommendationName(item)}
        </h3>

        <div className="mt-1.5 flex min-h-4 items-center gap-1.5 text-[9px] font-medium text-stone-500 sm:mt-2 sm:min-h-5 sm:gap-2 sm:text-[11px] sm:font-semibold">
          {totalMinutes > 0 ? (
            <span>{totalMinutes} min</span>
          ) : null}
          {recipe.difficulty ? (
            <>
              {totalMinutes > 0 ? (
                <span className="text-stone-300">|</span>
              ) : null}
              <span>{recipe.difficulty}</span>
            </>
          ) : null}
        </div>

        <span className="mt-2.5 inline-flex items-center justify-between gap-2 rounded-lg bg-[#edf5e9] px-2.5 py-1.5 text-[10px] font-semibold text-[#1b5a3d] transition group-hover:bg-[#175339] group-hover:text-white sm:mt-4 sm:gap-3 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs sm:font-black">
          Open recipe
          <ArrowRight
            size={15}
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  )
}

function RecipeRecommendationShelf({
  eyebrow,
  title,
  description,
  items,
  loading,
}) {
  if (!loading && items.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:mb-5 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-700 sm:text-[10px] sm:font-black sm:tracking-[0.18em]">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-sans text-[15px] font-semibold tracking-normal text-[#163b2a] sm:mt-1.5 sm:font-serif sm:text-3xl sm:font-semibold sm:tracking-[-0.035em]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-[10px] font-medium leading-4 text-stone-500 sm:mt-1.5 sm:text-sm sm:leading-6">
            {description}
          </p>
        </div>

        <Link
          to="/recipes"
          className="focus-ring inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-[#dccdb5] bg-[#fffdf8] px-3 py-1.5 text-[10px] font-semibold text-[#24543d] shadow-sm transition hover:border-emerald-700 hover:bg-emerald-700 hover:text-white sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm sm:font-black"
        >
          View all
          <ArrowRight
            size={16}
            aria-hidden="true"
          />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: RECIPE_RECOMMENDATION_LIMIT }).map((_, index) => (
              <div
                key={index}
                className={[
                  'aspect-[0.76/1] animate-pulse rounded-[18px] border border-[#e3d7c2] bg-[#fffdf8] sm:rounded-[24px]',
                  index >= 4 ? 'hidden sm:block' : '',
                ].join(' ')}
              />
            ))
          : items.map((item, index) => (
              <div
                key={getRecipeRecommendationKey(item)}
                className={index >= 4 ? 'hidden h-full sm:block' : 'h-full'}
              >
                <RecommendedRecipeCard
                  item={item}
                />
              </div>
            ))}
      </div>
    </section>
  )
}

export default function RecipeDetailPage() {
  const {
    slug,
  } =
    useParams()

  const location =
    useLocation()

  const navigate =
    useNavigate()

  const {
    isAuthenticated,
    customerEnabled,
    superAdminEnabled,
    activeMode,
  } =
    useAuth()

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    cookNextRecipes,
    setCookNextRecipes,
  ] =
    useState(
      [],
    )

  const [
    similarRecipes,
    setSimilarRecipes,
  ] =
    useState(
      [],
    )

  const [
    recipeRecommendationsLoading,
    setRecipeRecommendationsLoading,
  ] =
    useState(
      false,
    )

  const [
    scaledData,
    setScaledData,
  ] =
    useState(
      null,
    )

  const [
    servings,
    setServings,
  ] =
    useState(
      1,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    scaling,
    setScaling,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const [
    recipeHeroView,
    setRecipeHeroView,
  ] =
    useState(
      'photo',
    )

  const [
    detailsFoodIntelligence,
    setDetailsFoodIntelligence,
  ] =
    useState(
      null,
    )

  const [
    pantryReconciliation,
    setPantryReconciliation,
  ] =
    useState(
      null,
    )

  const [
    pantryLoading,
    setPantryLoading,
  ] =
    useState(
      false,
    )

  const [
    pantryActionKey,
    setPantryActionKey,
  ] =
    useState(
      '',
    )

  const [
    pantryError,
    setPantryError,
  ] =
    useState(
      '',
    )

  const [
    pantrySuccess,
    setPantrySuccess,
  ] =
    useState(
      '',
    )

  const [resolvedIngredientIds, setResolvedIngredientIds] = useState(() => new Set())
  const [pantrySetupItem, setPantrySetupItem] = useState(null)
  const [setupQuantity, setSetupQuantity] = useState('')
  const [setupUnit, setSetupUnit] = useState('g')
  const [setupStorage, setSetupStorage] = useState('pantry')
  const [setupUseSoon, setSetupUseSoon] = useState('')
  const [setupSaving, setSetupSaving] = useState(false)
  const [setupError, setSetupError] = useState('')

  const [
    shoppingTray,
    setShoppingTray,
  ] =
    useState(
      [],
    )

  const [
    cartError,
    setCartError,
  ] =
    useState(
      '',
    )

  const ingredientDecisionLockRef =
    useRef(
      new Set(),
    )

  const ingredientScrollRef =
    useRef(
      null,
    )

  const ingredientScrollDirectionRef =
    useRef(
      1,
    )

  const [
    ingredientAutoScrollPaused,
    setIngredientAutoScrollPaused,
  ] =
    useState(
      false,
    )

  const loadRecipe =
    useCallback(
      async () => {
        setLoading(
          true,
        )

        setError(
          '',
        )

        try {
          const nextData =
            await getPublicRecipe(
              slug,
            )

          setData(
            nextData,
          )

          const baseServings =
            Number(
              nextData?.recipe
                ?.baseServings ||
              1,
            )

          setServings(
            Math.max(
              1,
              baseServings,
            ),
          )
        } catch (loadError) {
          setError(
            loadError?.message ||
            'Unable to load recipe.',
          )
        } finally {
          setLoading(
            false,
          )
        }
      },
      [
        slug,
      ],
    )

  useEffect(
    () => {
      loadRecipe()
    },
    [
      loadRecipe,
    ],
  )

  useEffect(
    () => {
      const currentSlug =
        String(
          data?.dish?.slug ||
          slug ||
          '',
        ).trim()

      if (!currentSlug || !data?.dish) {
        setCookNextRecipes([])
        setSimilarRecipes([])
        return undefined
      }

      let active = true

      async function loadRecipeRecommendations() {
        setRecipeRecommendationsLoading(true)

        const cuisine =
          String(
            data?.dish?.cuisine ||
            '',
          ).trim()

        const course =
          String(
            data?.dish?.course ||
            '',
          ).trim()

        try {
          const [generalResult, courseResult, cuisineResult] =
            await Promise.all([
              listPublicRecipes({
                page: 1,
                limit: 24,
              }),
              course
                ? listPublicRecipes({
                    page: 1,
                    limit: 18,
                    course,
                  })
                : Promise.resolve({ recipes: [] }),
              cuisine
                ? listPublicRecipes({
                    page: 1,
                    limit: 18,
                    cuisine,
                  })
                : Promise.resolve({ recipes: [] }),
            ])

          if (!active) {
            return
          }

          const withoutCurrent =
            (items) =>
              (items || []).filter(
                (item) =>
                  String(
                    item?.dish?.slug ||
                    '',
                  ).trim() !== currentSlug,
              )

          const generalRecipes =
            withoutCurrent(
              generalResult?.recipes,
            )

          const courseRecipes =
            withoutCurrent(
              courseResult?.recipes,
            )

          const cuisineRecipes =
            withoutCurrent(
              cuisineResult?.recipes,
            )

          const makeUnique =
            (items) => {
              const seen = new Set()

              return items.filter(
                (item) => {
                  const key =
                    getRecipeRecommendationKey(item)

                  if (!key || seen.has(key)) {
                    return false
                  }

                  seen.add(key)
                  return true
                },
              )
            }

          const nextCook =
            makeUnique([
              ...courseRecipes,
              ...generalRecipes,
            ]).slice(0, RECIPE_RECOMMENDATION_LIMIT)

          const cookKeys =
            new Set(
              nextCook.map(
                getRecipeRecommendationKey,
              ),
            )

          const nextSimilar =
            makeUnique([
              ...cuisineRecipes,
              ...courseRecipes,
              ...generalRecipes,
            ])
              .filter(
                (item) =>
                  !cookKeys.has(
                    getRecipeRecommendationKey(item),
                  ),
              )
              .slice(0, RECIPE_RECOMMENDATION_LIMIT)

          setCookNextRecipes(nextCook)
          setSimilarRecipes(nextSimilar)
        } catch {
          if (active) {
            setCookNextRecipes([])
            setSimilarRecipes([])
          }
        } finally {
          if (active) {
            setRecipeRecommendationsLoading(false)
          }
        }
      }

      loadRecipeRecommendations()

      return () => {
        active = false
      }
    },
    [
      data?.dish,
      slug,
    ],
  )

  useEffect(
    () => {
      const recipeVersionId =
        data?.recipe?.id

      if (!recipeVersionId) {
        setDetailsFoodIntelligence(
          null,
        )
        return undefined
      }

      let active =
        true

      async function loadDetailsFoodIntelligence() {
        try {
          const result =
            await getRecipeFoodIntelligence(
              recipeVersionId,
            )

          if (active) {
            setDetailsFoodIntelligence(
              result,
            )
          }
        } catch {
          if (active) {
            setDetailsFoodIntelligence(
              null,
            )
          }
        }
      }

      loadDetailsFoodIntelligence()

      return () => {
        active =
          false
      }
    },
    [
      data?.recipe?.id,
    ],
  )

  const customerContextBlocked =
    isAuthenticated === true &&
    (
      superAdminEnabled === true ||
      activeMode === 'host' ||
      customerEnabled !== true
    )

  const canUseCustomerFeatures =
    isAuthenticated &&
    customerEnabled ===
      true &&
    superAdminEnabled !==
      true &&
    activeMode !==
      'host'

  const showCustomerActionControls =
    canUseCustomerFeatures ||
    customerContextBlocked

  function openCustomerAccessRequired() {
    const returnTo =
      `${location.pathname}${location.search}${location.hash}`

    navigate(
      `/customer-access-required?returnTo=${encodeURIComponent(
        returnTo,
      )}`,
    )
  }


  useEffect(
    () => {
      if (
        !data?.recipe ||
        !slug
      ) {
        return
      }

      let active =
        true

      async function loadScaling() {
        setScaling(
          true,
        )

        try {
          const nextScaledData =
            await scalePublicRecipe(
              slug,
              servings,
            )

          if (active) {
            setScaledData(
              nextScaledData,
            )
          }
        } catch (scaleError) {
          if (active) {
            setError(
              scaleError?.message ||
              'Unable to scale recipe.',
            )
          }
        } finally {
          if (active) {
            setScaling(
              false,
            )
          }
        }
      }

      loadScaling()

      return () => {
        active =
          false
      }
    },
    [
      data?.recipe,
      servings,
      slug,
    ],
  )

  const ingredientRows =
    useMemo(
      () => {
        const scaled =
          scaledData?.scaling
            ?.ingredients

        if (
          Array.isArray(
            scaled,
          ) &&
          scaled.length >
            0
        ) {
          return scaled
        }

        return (
          data?.ingredients ||
          []
        ).map(
          (
            ingredient,
          ) => ({
            ...ingredient,

            displayQuantity:
              ingredient.quantity,

            displayUnit:
              ingredient.unit,
          }),
        )
      },
      [
        data?.ingredients,
        scaledData,
      ],
    )

  useEffect(
    () => {
      if (
        ingredientAutoScrollPaused ||
        typeof window ===
          'undefined'
      ) {
        return undefined
      }

      const container =
        ingredientScrollRef.current

      if (!container) {
        return undefined
      }

      const timerId =
        window.setInterval(
          () => {
            const maxScroll =
              container.scrollHeight -
              container.clientHeight

            if (maxScroll <= 1) {
              return
            }

            if (
              container.scrollTop >=
              maxScroll - 1
            ) {
              ingredientScrollDirectionRef.current =
                -1
            } else if (
              container.scrollTop <=
              1
            ) {
              ingredientScrollDirectionRef.current =
                1
            }

            container.scrollTop +=
              ingredientScrollDirectionRef.current *
              1.25
          },
          28,
        )

      return () => {
        window.clearInterval(
          timerId,
        )
      }
    },
    [
      ingredientAutoScrollPaused,
      ingredientRows.length,
    ],
  )

  const loadPantryReconciliation =
    useCallback(
      async () => {
        if (
          !canUseCustomerFeatures ||
          !slug
        ) {
          setPantryReconciliation(
            null,
          )
          return
        }

        setPantryLoading(
          true,
        )
        setPantryError(
          '',
        )

        try {
          const result =
            await getRecipePantry(
              slug,
              {
                targetServings:
                  servings,
              },
            )

          setPantryReconciliation(
            result,
          )
        } catch (
          pantryLoadError
        ) {
          setPantryError(
            getPantryErrorMessage(
              pantryLoadError,
              'Unable to compare this Recipe with your Pantry.',
            ),
          )
        } finally {
          setPantryLoading(
            false,
          )
        }
      },
      [
        canUseCustomerFeatures,
        servings,
        slug,
      ],
    )

  useEffect(
    () => {
      loadPantryReconciliation()
    },
    [
      loadPantryReconciliation,
    ],
  )

  const pantryLines =
    useMemo(
      () =>
        getPantryRequirementLines(
          pantryReconciliation,
        ),
      [
        pantryReconciliation,
      ],
    )

  const pantryByIngredientId =
    useMemo(
      () => {
        const map =
          new Map()

        pantryLines.forEach(
          (line) => {
            const ingredientId =
              getPantryLineIngredientId(
                line,
              )

            if (ingredientId) {
              map.set(
                ingredientId,
                line,
              )
            }
          },
        )

        return map
      },
      [
        pantryLines,
      ],
    )


  const dish =
    data?.dish ||
    {}

  const recipe =
    data?.recipe ||
    {}

  const recipeDietaryBadge = resolveRecipeDietaryBadge(detailsFoodIntelligence)


  useEffect(() => {
    ingredientDecisionLockRef.current.clear()
    setResolvedIngredientIds(new Set())
    setPantrySetupItem(null)
    setSetupError('')
  }, [slug])

  useEffect(
    () => {
      const savedCart =
        readPendingRecipeCart()

      if (
        savedCart?.slug ===
          slug &&
        Array.isArray(
          savedCart.items,
        )
      ) {
        setShoppingTray(
          savedCart.items,
        )
      } else {
        setShoppingTray([])
      }
    },
    [
      slug,
    ],
  )


  function setIngredientResolved(canonicalIngredientId, resolved = true) {
    setResolvedIngredientIds((current) => {
      const next = new Set(current)
      if (resolved) next.add(canonicalIngredientId)
      else next.delete(canonicalIngredientId)
      return next
    })
  }

  function preparePantrySetupDrawer({ item, ingredient, name }) {
    if (!item?.id) return

    const suggestedUnit = String(ingredient?.displayUnit || '').trim().toLowerCase()
    const allowedUnits = new Set(['g', 'kg', 'ml', 'l', 'pcs'])

    setPantrySetupItem({
      id: item.id,
      name: name || item.displayName || 'Pantry item',
    })
    setSetupQuantity(
      item?.quantity?.mode === 'exact'
        ? String(item.quantity.value ?? '')
        : '',
    )
    setSetupUnit(
      item?.quantity?.unit ||
        (allowedUnits.has(suggestedUnit) ? suggestedUnit : 'g'),
    )
    setSetupStorage(item?.storageZone || 'pantry')
    setSetupUseSoon(toDateInputValue(item?.useSoonAt))
    setSetupError('')
  }

  async function handleIHaveIngredient(ingredient) {
    if (customerContextBlocked) {
      openCustomerAccessRequired()
      return
    }

    if (pantryActionKey || !canUseCustomerFeatures) return

    const canonicalIngredientId = String(ingredient?.canonicalIngredientId || '').trim()

    if (
      !canonicalIngredientId ||
      resolvedIngredientIds.has(canonicalIngredientId) ||
      ingredientDecisionLockRef.current.has(canonicalIngredientId)
    ) {
      if (!canonicalIngredientId) {
        setPantryError('This Recipe line is not linked to a canonical ingredient yet.')
      }
      return
    }

    const identity = ingredient?.ingredient || {}

    ingredientDecisionLockRef.current.add(canonicalIngredientId)
    setIngredientResolved(canonicalIngredientId, true)
    setPantryActionKey(`have-${canonicalIngredientId}`)
    setPantryError('')
    setPantrySuccess('')

    try {
      const result = await confirmIHaveThis({ canonicalIngredientId })

      setPantrySuccess(
        `${identity.name || 'Ingredient'} confirmed in your Living Pantry. Add a few details now for better planning.`,
      )

      setShoppingTray((current) => {
        const next = current.filter(
          (item) => item.canonicalIngredientId !== canonicalIngredientId,
        )
        savePendingRecipeCart({ slug, servings, items: next })
        notifyFloatingCartUpdated()
        return next
      })

      preparePantrySetupDrawer({
        item: result?.item || null,
        ingredient,
        name: identity.name || 'Ingredient',
      })

      await loadPantryReconciliation()
    } catch (confirmationError) {
      ingredientDecisionLockRef.current.delete(canonicalIngredientId)
      setIngredientResolved(canonicalIngredientId, false)
      setPantryError(
        getPantryErrorMessage(
          confirmationError,
          'Unable to confirm this Pantry item.',
        ),
      )
    } finally {
      setPantryActionKey('')
    }
  }

  async function savePantrySetupDetails() {
    if (!pantrySetupItem?.id || setupSaving) return

    const numericQuantity = Number(setupQuantity)
    if (!Number.isFinite(numericQuantity) || numericQuantity < 0) {
      setSetupError('Enter a valid quantity before saving.')
      return
    }
    if (!setupUnit) {
      setSetupError('Choose a quantity unit before saving.')
      return
    }

    setSetupSaving(true)
    setSetupError('')

    try {
      await correctPantryQuantity(pantrySetupItem.id, {
        value: numericQuantity,
        unit: setupUnit,
      })

      if (setupStorage) {
        await updatePantryStorage(pantrySetupItem.id, setupStorage)
      }
      if (setupUseSoon) {
        await updatePantryUseSoon(pantrySetupItem.id, setupUseSoon)
      }

      setPantrySuccess(`${pantrySetupItem.name} details saved in your Pantry.`)
      setPantrySetupItem(null)
      await loadPantryReconciliation()
    } catch (saveError) {
      setSetupError(
        getPantryErrorMessage(saveError, 'Unable to save these Pantry details.'),
      )
    } finally {
      setSetupSaving(false)
    }
  }

  async function deferPantrySetupDetails() {
    const itemId = pantrySetupItem?.id
    setPantrySetupItem(null)
    setSetupError('')
    if (!itemId) return

    try {
      await requestPantrySetupReminder(itemId)
    } catch {
      // Best-effort reminder; the Pantry item itself is already saved.
    }
  }

  async function handleCookedRecipe() {
    if (customerContextBlocked) {
      openCustomerAccessRequired()
      return
    }

    if (
      pantryActionKey ||
      !canUseCustomerFeatures
    ) {
      return
    }

    setPantryActionKey(
      'cooked',
    )
    setPantryError('')
    setPantrySuccess('')

    try {
      await recordRecipeCooked(
        slug,
        {
          targetServings:
            servings,
          idempotencyKey:
            createPantryIdempotencyKey(),
        },
      )

      setPantrySuccess(
        'Cooked Recipe recorded. Pantry consumption observations have been updated.',
      )

      await loadPantryReconciliation()
    } catch (
      cookedError
    ) {
      setPantryError(
        getPantryErrorMessage(
          cookedError,
          'Unable to record this cooked Recipe.',
        ),
      )
    } finally {
      setPantryActionKey('')
    }
  }

  function addIngredientToRecipeCart(ingredient, sourceElement) {
    if (customerContextBlocked) {
      openCustomerAccessRequired()
      return false
    }
    if (!isAuthenticated || customerEnabled !== true) {
      setCartError('Sign in with Customer access to shop missing Recipe ingredients.')
      return false
    }

    const identity = ingredient?.ingredient || {}
    const name = identity.name || 'Ingredient'
    const canonicalIngredientId = String(ingredient?.canonicalIngredientId || '').trim()

    if (!canonicalIngredientId) {
      setCartError(
        'This Recipe ingredient is not linked to a canonical ingredient and cannot be added to the Recipe Cart yet.',
      )
      return false
    }

    setCartError('')
    setShoppingTray((current) => {
      const existingIndex = current.findIndex(
        (item) => item.canonicalIngredientId === canonicalIngredientId,
      )
      const nextItem = {
        canonicalIngredientId,
        name,
        quantity: ingredient.displayQuantity,
        unit: ingredient.displayUnit,
      }
      const next = existingIndex >= 0
        ? current.map((item, index) => (index === existingIndex ? nextItem : item))
        : [...current, nextItem]

      savePendingRecipeCart({ slug, servings, items: next })
      notifyFloatingCartUpdated()
      return next
    })

    notifyFloatingCartFly({ name, sourceElement })
    return true
  }

  function handleMissingIngredient(ingredient, sourceElement) {
    const canonicalIngredientId = String(ingredient?.canonicalIngredientId || '').trim()
    if (
      !canonicalIngredientId ||
      resolvedIngredientIds.has(canonicalIngredientId) ||
      ingredientDecisionLockRef.current.has(canonicalIngredientId)
    ) return

    ingredientDecisionLockRef.current.add(canonicalIngredientId)
    const added = addIngredientToRecipeCart(ingredient, sourceElement)

    if (added) {
      setIngredientResolved(canonicalIngredientId, true)
    } else {
      ingredientDecisionLockRef.current.delete(canonicalIngredientId)
    }
  }


  if (loading) {
    return (
      <main className="page-shell min-h-screen py-10">

        <div className="h-[620px] animate-pulse rounded-[30px] border border-stone-200 bg-white" />

      </main>
    )
  }

  if (
    error &&
    !data
  ) {
    return (
      <main className="page-shell min-h-screen py-10">

        <div className="rounded-[28px] border border-red-200 bg-red-50 p-8">

          <h1 className="text-xl font-black text-red-950">
            Recipe unavailable
          </h1>

          <p className="mt-2 text-sm text-red-800">
            {
              error
            }
          </p>

          <Link
            to="/recipes"
            className="mt-5 inline-flex font-black text-red-900 underline"
          >
            Back to recipes
          </Link>

        </div>

      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#eef3ef] sm:bg-[#f4efe6]">

      <div className="page-shell pt-2 pb-6 sm:pt-2 sm:pb-10">

        <Link
          to="/recipes"
          className="focus-ring inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-bold text-stone-600 transition hover:text-emerald-800"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Recipes
        </Link>

        <div className="mt-1 overflow-hidden bg-[#fffdf8] sm:rounded-[30px] sm:border sm:border-[#e3d7c2] sm:shadow-[0_18px_50px_rgba(92,70,38,0.10)]">

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

            <div className="relative mx-0 mt-2 h-[29svh] min-h-[205px] max-h-[240px] overflow-hidden rounded-none bg-gradient-to-br from-amber-50 via-stone-50 to-emerald-50 sm:m-5 sm:h-auto sm:min-h-[320px] sm:max-h-none sm:rounded-[24px] lg:mr-0">

              <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border border-white/60 bg-white/90 p-1 shadow-sm backdrop-blur-md sm:right-3 sm:top-3">
                <button
                  type="button"
                  onClick={() =>
                    setRecipeHeroView(
                      'photo',
                    )
                  }
                  className={[
                    'focus-ring rounded-full px-3 py-1.5 text-[10px] font-black transition',
                    recipeHeroView ===
                    'photo'
                      ? 'bg-emerald-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100',
                  ].join(
                    ' ',
                  )}
                >
                  Photo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecipeHeroView(
                      'details',
                    )
                  }
                  className={[
                    'focus-ring rounded-full px-3 py-1.5 text-[10px] font-black transition',
                    recipeHeroView ===
                    'details'
                      ? 'bg-emerald-800 text-white'
                      : 'text-stone-600 hover:bg-stone-100',
                  ].join(
                    ' ',
                  )}
                >
                  Details
                </button>
              </div>

              {recipeHeroView ===
              'details' ? (
                <RecipeDetailsSheet
                  dish={dish}
                  recipe={recipe}
                  ingredients={
                    data?.ingredients ||
                    []
                  }
                  foodIntelligence={
                    detailsFoodIntelligence
                  }
                />
              ) : dish.heroImageUrl ? (
                <img
                  src={
                    dish.heroImageUrl
                  }
                  alt={
                    dish.name
                  }
                  className="h-full w-full object-cover transition duration-500 hover:scale-[1.015] sm:min-h-[360px] sm:max-h-[560px]"
                />
              ) : (
                <div className="grid h-full min-h-[320px] place-items-center">

                  <div className="grid h-28 w-28 place-items-center rounded-[36px] bg-white/80 text-emerald-700 shadow-sm">
                    <ChefHat
                      size={52}
                      aria-hidden="true"
                    />
                  </div>

                </div>
              )}

            </div>

            <div className="px-4 pb-5 pt-3 sm:hidden">

              <div className="flex items-start justify-between gap-3">
                <h1 className="min-w-0 font-sans text-[23px] font-black leading-[1.05] tracking-[-0.035em] text-[#163b2a]">
                  {dish.name || recipe.title}
                </h1>

                {recipeDietaryBadge ? (
                  <span
                    className={[
                      'mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em]',
                      recipeDietaryBadge.kind === 'veg'
                        ? 'border-lime-200 bg-lime-100 text-lime-900'
                        : 'border-rose-200 bg-rose-100 text-rose-900',
                    ].join(' ')}
                  >
                    {recipeDietaryBadge.label}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ['Base servings', recipe.baseServings || '—'],
                  ['Prep time', `${Number(recipe.preparationTimeMinutes || 0)} min`],
                  ['Cook time', `${Number(recipe.cookingTimeMinutes || 0)} min`],
                  ['Difficulty', recipe.difficulty || '—'],
                  ['Cuisine', dish.cuisine || '—'],
                  ['Course', dish.course || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-xl border border-[#e7ddcb] bg-[#fbf6eb] px-2.5 py-2.5 shadow-[0_3px_10px_rgba(92,70,38,0.04)]"
                  >
                    <p className="text-[7px] font-black uppercase leading-3 tracking-[0.08em] text-stone-400">
                      {label}
                    </p>
                    <p className="mt-1 break-words text-[11px] font-black leading-[1.15] capitalize text-stone-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-[#e7ddcb] bg-white/90 px-3 py-3 shadow-[0_4px_14px_rgba(92,70,38,0.05)]">
                <p className="text-[11px] font-black text-[#163b2a]">
                  About this recipe
                </p>
                <p className="mt-1.5 text-[11px] font-medium leading-[1.55] text-stone-600">
                  {recipe.description || dish.description}
                </p>
              </div>

              <Link
                to={`/recipes/${dish.slug}/history`}
                className="focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[9px] font-black text-stone-600 transition hover:bg-stone-50 hover:text-stone-950"
              >
                <History
                  size={13}
                  aria-hidden="true"
                />
                Version history
              </Link>

            </div>

            <div className="hidden flex-col justify-start px-5 pb-6 pt-4 sm:flex sm:p-8 sm:pt-6 lg:p-9 lg:pt-7 xl:p-10 xl:pt-8">

              <h1 className="font-serif text-3xl font-semibold tracking-[-0.035em] text-[#163b2a] sm:text-5xl xl:text-6xl">
                {dish.name || recipe.title}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:mt-3 sm:text-base sm:leading-7">
                {recipe.description || dish.description}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
                {[
                  ['Base servings', recipe.baseServings || '—'],
                  ['Prep time', `${Number(recipe.preparationTimeMinutes || 0)} min`],
                  ['Cook time', `${Number(recipe.cookingTimeMinutes || 0)} min`],
                  ['Difficulty', recipe.difficulty || '—'],
                  ['Cuisine', dish.cuisine || '—'],
                  ['Course', dish.course || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="min-w-0 rounded-2xl border border-[#e8dcc8] bg-[#fbf6eb] px-4 py-4 shadow-[0_4px_14px_rgba(92,70,38,0.05)]"
                  >
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.09em] text-stone-400">
                      {label}
                    </p>
                    <p className="mt-1.5 truncate text-base font-black capitalize text-stone-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <Link
                to={`/recipes/${dish.slug}/history`}
                className="focus-ring mt-3 inline-flex self-end items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-black text-stone-600 transition hover:bg-stone-50 hover:text-stone-950"
              >
                <History
                  size={15}
                  aria-hidden="true"
                />
                Version history
              </Link>

            </div>

          </div>

        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
          >
            {
              error
            }
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)] lg:items-start">

          <section
            onMouseEnter={() => setIngredientAutoScrollPaused(true)}
            onMouseLeave={() => setIngredientAutoScrollPaused(false)}
            className="relative order-1 rounded-[28px] border border-[#e3d7c2] bg-[#fffdf8] p-3 shadow-[0_16px_42px_rgba(92,70,38,0.08)] sm:p-6 lg:order-1 lg:flex lg:h-[560px] lg:flex-col lg:overflow-hidden"
          >

            <div className="flex shrink-0 flex-col gap-2 border-b border-[#eee4d2] pb-2 sm:gap-3 sm:pb-3 xl:flex-row xl:items-start xl:justify-between">

              <div className="max-w-xl">

                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-800 sm:gap-2 sm:px-3 sm:py-1 sm:text-[10px] sm:font-black sm:tracking-[0.16em]">
                  <ShieldCheck
                    size={13}
                    aria-hidden="true"
                  />
                  <span className="sm:hidden">Ingredients · Living Pantry</span>
                  <span className="hidden sm:inline">Ingredients + your Living Pantry</span>
                </div>

                <h2 className="mt-1 font-sans text-[15px] font-semibold tracking-normal text-[#163b2a] sm:mt-2 sm:font-serif sm:text-[28px] sm:font-semibold sm:tracking-tight">
                  <span className="sm:hidden">Can I cook this at home?</span>
                  <span className="hidden sm:inline">Ingredients & Can I cook this from home?</span>
                </h2>


              </div>

              <div className="flex flex-nowrap items-center gap-1.5 sm:flex-wrap sm:gap-2">

                {showCustomerActionControls && (
                  <>
                    <button
                      type="button"
                      onClick={
                        handleCookedRecipe
                      }
                      disabled={
                        Boolean(
                          pantryActionKey,
                        )
                      }
                      className="focus-ring inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-1.5 py-1 text-[9px] font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs sm:font-black"
                    >
                      {pantryActionKey ===
                      'cooked' ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChefHat
                          size={14}
                          aria-hidden="true"
                        />
                      )}
                      I cooked this
                    </button>

                    <Link
                      to="/pantry"
                      className="focus-ring whitespace-nowrap sm:whitespace-normal rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[9px] font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs sm:font-black"
                    >
                      Open Living Pantry →
                    </Link>
                  </>
                )}

                <span className="whitespace-nowrap sm:whitespace-normal rounded-full bg-stone-100 px-1.5 py-1 text-[9px] font-semibold text-stone-600 sm:px-3 sm:py-1.5 sm:text-xs sm:font-bold">
                  {ingredientRows.length} items
                </span>

              </div>

            </div>


            <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/65 px-2.5 py-1.5 sm:mt-3 sm:gap-4 sm:px-3 sm:py-2">
              <div>
                <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-800 sm:text-[9px] sm:font-black sm:tracking-[0.14em]">
                  Servings
                </p>
                <p className="text-[9px] font-medium leading-tight text-stone-500 sm:mt-0.5 sm:text-[10px] sm:font-semibold sm:leading-normal">
                  <span className="sm:hidden">Quantities adjust with servings.</span>
                  <span className="hidden sm:inline">Ingredient quantities update automatically.</span>
                </p>
              </div>

              <div className="flex items-center gap-0.5 rounded-lg border border-emerald-200 bg-white p-0.5 sm:gap-1 sm:rounded-xl sm:p-1">
                <button
                  type="button"
                  onClick={() =>
                    setServings((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                  disabled={servings <= 1}
                  className="focus-ring grid h-7 w-7 place-items-center rounded-md text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 sm:rounded-lg"
                  aria-label="Decrease servings"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>

                <div className="min-w-8 text-center sm:min-w-11">
                  <p className="text-xs font-black text-stone-950 sm:text-sm">
                    {servings}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setServings((current) =>
                      Math.min(1000, current + 1),
                    )
                  }
                  className="focus-ring grid h-7 w-7 place-items-center rounded-md text-emerald-800 transition hover:bg-emerald-50 sm:h-8 sm:w-8 sm:rounded-lg"
                  aria-label="Increase servings"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {scaling && (
              <p className="mt-2 text-[10px] font-bold text-emerald-700">
                Recalculating quantities...
              </p>
            )}

            {!canUseCustomerFeatures && (
              <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs font-semibold leading-5 text-stone-600">
                {customerContextBlocked
                  ? 'Switch to Customer mode or sign in with a Customer account to compare these ingredients with your Living Pantry and shop missing items.'
                  : 'Sign in with Customer access to compare these ingredients with your Living Pantry and shop missing items.'}
              </div>
            )}

            {pantryError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold leading-5 text-rose-800"
              >
                {pantryError}
              </div>
            )}

            {pantrySuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-800">
                <Check
                  size={15}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {pantrySuccess}
              </div>
            )}

            {cartError && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900"
              >
                {cartError}
              </div>
            )}

            <div
              ref={ingredientScrollRef}
              className="mt-2 min-h-0 flex-1 divide-y divide-[#eee4d2] overflow-hidden rounded-2xl border border-[#e8dcc8] bg-white sm:mt-3 lg:overflow-y-auto lg:overscroll-contain"
              aria-label="Recipe ingredients"
            >

              {ingredientRows.map(
                (
                  ingredient,
                ) => {
                  const identity =
                    ingredient.ingredient ||
                    {}

                  const canonicalIngredientId =
                    String(
                      ingredient.canonicalIngredientId ||
                        '',
                    ).trim()

                  const pantryLine =
                    pantryByIngredientId.get(
                      canonicalIngredientId,
                    )

                  const pantryStatus =
                    pantryLine
                      ? getPantryLineStatus(
                          pantryLine,
                        )
                      : pantryLoading
                        ? 'checking'
                        : 'uncertain'

                  const pantryStatusClassName =
                    pantryStatus ===
                    'available'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : pantryStatus ===
                          'missing'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : pantryStatus ===
                            'partial'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-stone-50 text-stone-600 border-stone-200'

                  const haveActionKey =
                    `have-${canonicalIngredientId}`

                  const decisionLocked =
                    Boolean(
                      canonicalIngredientId &&
                      (
                        resolvedIngredientIds.has(canonicalIngredientId) ||
                        shoppingTray.some(
                          (item) => item.canonicalIngredientId === canonicalIngredientId,
                        ) ||
                        pantryStatus === 'available'
                      )
                    )

                  return (
                    <div
                      key={
                        ingredient.id ||
                        `${ingredient.lineNumber}-${ingredient.canonicalIngredientId}`
                      }
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 bg-white px-2.5 py-1.5 transition hover:bg-[#fffaf1] sm:flex sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-2.5"
                    >

                      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-[9px] font-black text-emerald-800 sm:h-8 sm:w-8 sm:text-[11px]">
                        {ingredient.lineNumber}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="text-[13px] font-black leading-tight text-stone-950 sm:text-base sm:leading-normal">
                            {identity.name ||
                              'Canonical ingredient'}
                          </h3>

                          {canUseCustomerFeatures && (
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.06em] sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.08em] ${pantryStatusClassName}`}
                            >
                              {pantryStatus ===
                              'checking'
                                ? 'Checking pantry'
                                : PANTRY_STATUS_LABELS[
                                    pantryStatus
                                  ] ||
                                  'Needs confirmation'}
                            </span>
                          )}
                        </div>

                        {ingredient.preparationState && (
                          <p className="mt-0.5 text-[10px] leading-tight text-stone-500 sm:mt-1 sm:text-xs sm:leading-normal">
                            {ingredient.preparationState}
                          </p>
                        )}

                        {ingredient.optional && (
                          <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-amber-700 sm:mt-1 sm:text-[9px] sm:tracking-[0.12em]">
                            Optional
                          </p>
                        )}
                      </div>

                      <div className="col-start-2 flex flex-nowrap items-center justify-end justify-self-end gap-1.5 sm:col-start-auto sm:flex-wrap sm:gap-2 sm:justify-self-auto sm:justify-end">
                        <span className="whitespace-nowrap sm:whitespace-normal rounded-full bg-stone-100 px-2 py-1.5 text-xs font-black text-stone-800 sm:px-3 sm:py-2 sm:text-sm">
                          {formatQuantity(
                            ingredient.displayQuantity,
                          )}{' '}
                          {ingredient.displayUnit}
                        </span>

                        <button
                          type="button"
                          onClick={(event) =>
                            handleMissingIngredient(
                              ingredient,
                              event.currentTarget,
                            )
                          }
                          disabled={
                            decisionLocked ||
                            !canonicalIngredientId ||
                            (
                              !canUseCustomerFeatures &&
                              !customerContextBlocked
                            )
                          }
                          className={[
                            'focus-ring inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed sm:min-w-24 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs sm:font-black',
                            decisionLocked
                              ? 'pointer-events-none opacity-35 grayscale'
                              : 'disabled:opacity-45',
                          ].join(' ')}
                        >
                          <ShoppingCart
                            size={14}
                            aria-hidden="true"
                          />
                          I want
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleIHaveIngredient(
                              ingredient,
                            )
                          }
                          disabled={
                            decisionLocked ||
                            Boolean(
                              pantryActionKey,
                            ) ||
                            !canonicalIngredientId ||
                            (
                              !canUseCustomerFeatures &&
                              !customerContextBlocked
                            )
                          }
                          className={`focus-ring inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition disabled:cursor-not-allowed sm:min-w-24 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs sm:font-black ${
                            decisionLocked
                              ? 'pointer-events-none border-stone-200 bg-stone-100 text-stone-500 opacity-35 grayscale'
                              : pantryStatus ===
                                'available'
                                ? 'border-emerald-700 bg-emerald-700 text-white'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-45'
                          }`}
                        >
                          {pantryActionKey ===
                          haveActionKey ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Check
                              size={14}
                              aria-hidden="true"
                            />
                          )}
                          I have
                        </button>
                      </div>

                    </div>
                  )
                },
              )}

            </div>

            <div className="mt-2 flex shrink-0 flex-col gap-2 rounded-xl border border-[#e8dcc8] bg-[#fbf6eb] px-3 py-2 text-[9px] leading-4 text-stone-500 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl">
                Missing adds the ingredient to your Recipe Cart. Choose or add a delivery address only when you place your order from the Cart.
              </p>

              {shoppingTray.length > 0 ? (
                <Link
                  to="/cart/recipe"
                  className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-black text-emerald-800 hover:bg-emerald-100"
                >
                  <ShoppingCart
                    size={14}
                    aria-hidden="true"
                  />
                  Open Recipe Cart
                </Link>
              ) : (
                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 font-black text-stone-600">
                  <MapPin
                    size={14}
                    className="text-emerald-700"
                    aria-hidden="true"
                  />
                  Address at checkout
                </div>
              )}
            </div>



          </section>

          <section className="order-2 overflow-hidden rounded-[20px] border border-[#e3d7c2] bg-[#fffdf8] shadow-[0_16px_42px_rgba(92,70,38,0.08)] sm:rounded-[28px] lg:order-2 lg:flex lg:h-[560px] lg:flex-col">

            <div className="border-b border-[#e8dcc8] bg-gradient-to-r from-[#fff8e9] via-[#fffdf8] to-emerald-50/60 px-3 py-2 sm:px-5 sm:py-4">
              <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-700 sm:text-[9px] sm:font-black sm:tracking-[0.16em]">Recipe guide</p>
              <h2 className="mt-1 font-sans text-[15px] font-semibold tracking-normal text-[#163b2a] sm:font-serif sm:text-2xl sm:font-semibold sm:tracking-tight">Cooking & nutrition details</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" data-recipe-guide-scroll>

            <div className="grid grid-cols-2 gap-1.5 border-b border-[#e8dcc8] bg-[#fffaf0] p-2 sm:grid-cols-4 sm:gap-2 sm:p-4">
              {[
                ['Servings', servings || recipe?.baseServings || '—'],
                ['Prep', `${Number(recipe?.preparationTimeMinutes || 0)} min`],
                ['Cook', `${Number(recipe?.cookingTimeMinutes || 0)} min`],
                ['Difficulty', recipeDetailLabel(recipe?.difficulty) || '—'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#eadfca] bg-white px-2 py-1.5 shadow-[0_5px_14px_rgba(92,70,38,0.05)] sm:rounded-2xl sm:px-3 sm:py-3"
                >
                  <p className="text-[7px] font-semibold uppercase tracking-[0.1em] text-stone-400 sm:text-[8px] sm:font-black sm:tracking-[0.12em]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold capitalize text-[#163b2a] sm:mt-1 sm:text-sm sm:font-black">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <details className="group border-b border-[#e8dcc8]">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:gap-4 sm:px-5 sm:py-4">
                <span className="font-sans text-[13px] font-semibold text-[#163b2a] sm:font-serif sm:text-xl sm:font-semibold">
                  Cooking steps
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[#e8dcc8] bg-white text-stone-600 transition group-open:rotate-180 group-open:border-emerald-300 group-open:text-emerald-800 sm:h-8 sm:w-8">
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="border-t border-[#eadfca] bg-[#fbf6eb] px-3 py-1.5 sm:px-5 sm:py-2">
                <ol className="divide-y divide-[#e3d7c2]">
                  {(data?.steps || []).map((step) => (
                    <li
                      key={step.id || step.stepNumber}
                      className="group/step flex gap-2 px-0.5 py-2 transition hover:bg-[#f7ead4]/65 sm:gap-3 sm:px-1 sm:py-3"
                    >
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800 ring-2 ring-emerald-50 sm:h-8 sm:w-8 sm:text-xs sm:font-black">
                        {step.stepNumber}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[11px] font-medium leading-4 text-stone-700 sm:text-xs sm:font-semibold sm:leading-5">
                          {step.instruction}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1 sm:mt-1.5 sm:gap-1.5">
                          {step.timerSeconds !== null && step.timerSeconds !== undefined && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-amber-800 sm:px-2.5 sm:py-1 sm:text-[9px] sm:font-black sm:tracking-[0.08em]">
                              {Math.round(step.timerSeconds / 60)} min timer
                            </span>
                          )}
                          {step.temperature && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-red-700 sm:px-2.5 sm:py-1 sm:text-[9px] sm:font-black sm:tracking-[0.08em]">
                              {step.temperature.value}°{String(step.temperature.unit).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </details>

            <details className="group border-b border-[#e8dcc8]">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-emerald-50/70 group-open:bg-emerald-50 sm:gap-4 sm:px-5 sm:py-4">
                <span className="font-sans text-[13px] font-semibold text-[#163b2a] sm:font-serif sm:text-xl sm:font-semibold">
                  Ingredients
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[#e8dcc8] bg-white text-stone-600 transition group-open:rotate-180 group-open:border-emerald-300 group-open:text-emerald-800 sm:h-8 sm:w-8">
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="border-t border-[#eadfca] bg-[#fbf6eb] px-3 py-2 sm:px-5 sm:py-3">
                {ingredientRows.length ? (
                  <div className="divide-y divide-[#e5d9c5]">
                    {ingredientRows.map((ingredient, index) => (
                      <div
                        key={ingredient.id || ingredient.canonicalIngredientId || index}
                        className="flex items-start justify-between gap-2 py-1.5 sm:gap-4 sm:py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-stone-800 sm:text-xs sm:font-black">
                            {ingredient?.ingredient?.name || ingredient?.name || 'Ingredient'}
                          </p>
                          {ingredient.preparationState ? (
                            <p className="mt-0.5 text-[9px] font-medium text-stone-500 sm:text-[10px] sm:font-semibold">
                              {ingredient.preparationState}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-[#e4d7c2] bg-white px-2 py-0.5 text-[9px] font-semibold text-[#24543d] sm:px-2.5 sm:py-1 sm:text-[10px] sm:font-black">
                          {formatQuantity(ingredient.displayQuantity ?? ingredient.quantity)}{' '}
                          {ingredient.displayUnit || ingredient.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] font-medium text-stone-500 sm:text-xs sm:font-semibold">
                    Ingredient details are not currently published.
                  </p>
                )}
              </div>
            </details>

            {/* Keep the governed Food Intelligence bridge targets intact. */}
            <div id="recipe-nutrition-intelligence-slot" />
            <div id="recipe-allergen-intelligence-slot" />
            <div id="recipe-dietary-intelligence-slot" />
            <div id="recipe-lineage-intelligence-slot" />

            </div>

          </section>

        </div>

        <div className="mt-5 space-y-6 border-t border-[#dfd3c1] pt-5 sm:mt-14 sm:space-y-12 sm:pt-12">
          <RecipeRecommendationShelf
            eyebrow="Cook next"
            title="More recipes to try"
            description="A fresh set of published EPANTRY recipes that fit naturally into your next cooking session."
            items={cookNextRecipes}
            loading={recipeRecommendationsLoading}
          />

          <RecipeRecommendationShelf
            eyebrow="Same table"
            title="Similar recipes"
            description={
              data?.dish?.cuisine
                ? `More ${data.dish.cuisine} recipes with a familiar cooking direction.`
                : 'More recipes with a similar course and cooking style.'
            }
            items={similarRecipes}
            loading={recipeRecommendationsLoading}
          />
        </div>

      </div>

      {pantrySetupItem ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-end bg-stone-950/25 p-3 backdrop-blur-[1px] sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Complete ${pantrySetupItem.name} Pantry details`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) deferPantrySetupDetails()
          }}
        >
          <aside
            className="flex max-h-[calc(100svh-24px)] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-[#fffdf8] shadow-2xl sm:max-h-[calc(100svh-32px)] sm:w-[440px]"
            style={{ width: 'min(460px, calc(100vw - 24px))' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Added to your Pantry</p>
                <h2 className="mt-1.5 text-xl font-black tracking-tight text-stone-950">Complete {pantrySetupItem.name}</h2>
                <p className="mt-1.5 text-xs leading-5 text-stone-600">Add what you know now. This helps EPANTRY plan meals and shopping without guessing your stock.</p>
              </div>
              <button type="button" onClick={deferPantrySetupDetails} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-100" aria-label="Close and remind me later">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                <p className="text-sm font-black text-emerald-950">{pantrySetupItem.name} is confirmed at home.</p>
                <p className="mt-1 text-xs leading-5 text-emerald-800">Quantity is required here. Storage and use-soon are optional but useful.</p>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-stone-800">How much do you have?</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input type="number" min="0" step="any" value={setupQuantity} onChange={(event) => setSetupQuantity(event.target.value)} placeholder="500" className="focus-ring rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-950" />
                    <select value={setupUnit} onChange={(event) => setSetupUnit(event.target.value)} className="focus-ring rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-950">
                      <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="pcs">pcs</option>
                    </select>
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-stone-800">Where is it stored?</span>
                  <select value={setupStorage} onChange={(event) => setSetupStorage(event.target.value)} className="focus-ring rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-950">
                    <option value="pantry">Pantry</option><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="counter">Counter</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-stone-800">Use soon by</span>
                  <input type="date" value={setupUseSoon} onChange={(event) => setSetupUseSoon(event.target.value)} className="focus-ring rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm font-bold text-stone-950" />
                  <span className="text-xs leading-5 text-stone-500">Optional household reminder — this is not treated as a verified expiry date.</span>
                </label>
              </div>

              {setupError ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{setupError}</div> : null}
            </div>

            <div className="border-t border-stone-200 bg-white px-5 py-4">
              <button type="button" onClick={savePantrySetupDetails} disabled={setupSaving} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                {setupSaving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                Save Pantry details
              </button>
              <button type="button" onClick={deferPantrySetupDetails} disabled={setupSaving} className="focus-ring mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
                <BellRing size={17} aria-hidden="true" />
                I'll do this later
              </button>
              <p className="mt-2 text-center text-[11px] leading-5 text-stone-500">If you choose later, EPANTRY adds one notification that opens this exact Pantry item.</p>
            </div>
          </aside>
        </div>
      ) : null}

    </main>
  )
}