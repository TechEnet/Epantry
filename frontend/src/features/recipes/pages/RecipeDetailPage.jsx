import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Leaf,
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
  checkItemAvailability,
} from '../../analytics/services/analytics.service'

import {
  openAvailabilityNotifyModal,
} from '../../notifications/components/AvailabilityNotifyModal'

import {
  createCommerceIdempotencyKey,
  createRestaurantRecipeMarketplaceCart,
  getCommerceErrorMessage,
} from '../../commerce/services/commerce.service'

import {
  getDefaultDeliveryAddress,
} from '../../deliveryAddresses/services/deliveryAddress.service'

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

import { recordApprovedFoodView, recordRecipeView } from '../utils/recipeEngagement'

import {
  getPublicRecipe,
  getRecipeDiscovery,
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

function formatMoney(
  price,
) {
  const amountMinor =
    Number(
      price?.amountMinor,
    )

  if (
    !Number.isInteger(
      amountMinor,
    ) ||
    amountMinor <
      0
  ) {
    return 'Not available'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',
      currency:
        price?.currency ||
        'INR',
      maximumFractionDigits:
        2,
    },
  ).format(
    amountMinor /
      100,
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

function getRecipeIngredientCanonicalId(
  ingredient,
) {
  return String(
    ingredient?.canonicalIngredientId ||
      ingredient?.ingredient?.id ||
      ingredient?.ingredientId ||
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

function RecipeLocalNames({ origin }) {
  if (!origin?.localName && !origin?.englishName) return null
  return (
    <div className="mt-2 space-y-1.5" aria-label="Documented recipe names">
      {origin.localName ? (
        <p className="text-[19px] font-medium leading-snug text-[#173F35] sm:text-[22px]" lang="und">
          {origin.localName}
          {origin.localLanguage ? <span className="ml-2 text-[12px] font-medium text-[#202421]/60">{origin.localLanguage}</span> : null}
        </p>
      ) : null}
      {origin.reading ? (
        <p className="text-[13px] font-medium leading-5 text-[#202421]/75">
          English reading: <span className="font-semibold text-[#202421]">{origin.reading}</span>
        </p>
      ) : origin.englishName ? (
        <p className="text-[13px] font-medium leading-5 text-[#202421]/75">
          Also known as: <span className="font-semibold text-[#202421]">{origin.englishName}</span>
        </p>
      ) : null}
    </div>
  )
}

function RecipeDetailsSheet({
  dish,
  recipe,
  ingredients,
  foodIntelligence,
  discoveryOrigin,
}) {
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
    <div className="recipe-details-sheet flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F1F4ED]">
      <div className="recipe-details-sheet-header border-b border-[#E2CFC4] bg-[#F4E6DD] px-4 pb-4 pt-[60px] text-[#173F35] sm:px-6 sm:py-6">
        <p className="text-[13px] font-semibold uppercase tracking-[0.09em] text-[#965C40] sm:text-[13px] sm:tracking-[0.12em]">
          EPANTRY · Recipe details sheet
        </p>
        <div className="mt-1 flex items-start justify-between gap-2 sm:block">
          <h2 className="min-w-0 text-[24px] font-semibold leading-[1.2] sm:mt-2 sm:text-[32px]">
            {dish?.name ||
              recipe?.title ||
              'Recipe'}
          </h2>
          {dietaryBadge ? (
            <span
              className={[
                'shrink-0 rounded-full border px-2 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] sm:hidden',
                dietaryBadge.kind === 'veg'
                  ? 'border-lime-200 bg-lime-100/95 text-lime-900'
                  : 'border-rose-200 bg-rose-100/95 text-rose-900',
              ].join(' ')}
            >
              {dietaryBadge.label}
            </span>
          ) : null}
        </div>
        <RecipeLocalNames origin={discoveryOrigin} />
        <p className="mt-2 hidden text-[14px] font-medium leading-5 text-[#486354] sm:block">
          Published recipe details · generated from governed listing data
        </p>
      </div>

      <div
        className="recipe-details-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-y-auto p-4 sm:p-5"
        tabIndex={0}
        role="region"
        aria-label="Recipe details"
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
                className="border-b border-[#DCE0CF] pb-2"
              >
                <dt className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#173F35]/65">
                  {label}
                </dt>
                <dd className="mt-1 text-[14px] font-semibold text-[#202421]">
                  {value}
                </dd>
              </div>
            ),
          )}
        </dl>

        <div className="mt-5 border-t border-[#DCE0CF] pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35]">
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
                    className="text-[14px] font-medium leading-6 text-[#202421]"
                  >
                    <span className="font-semibold text-[#202421]">
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
              <p className="text-[14px] font-medium text-[#202421]/70">
                Ingredient details are not available.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-[#DCE0CF] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35]">
              Nutrition
            </p>
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#173F35]/65">
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
                    className="flex items-center justify-between gap-2 border-b border-[#DCE0CF]/50 py-1.5 text-[14px]"
                  >
                    <span className="font-bold text-[#202421]/70">
                      {item?.name ||
                        recipeDetailLabel(
                          item?.key,
                        )}
                    </span>
                    <span className="font-semibold text-[#202421]">
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
            <p className="mt-2 text-xs font-semibold text-[#202421]/70">
              Approved nutrition details are not available.
            </p>
          )}
        </div>

        <div className="mt-5 border-t border-[#DCE0CF] pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35]">
            Allergens & dietary
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-[#202421]">
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
                    className="rounded-full border border-[#DCE0CF] bg-[#DCE0CF]/55 px-2.5 py-1 text-[13px] font-semibold text-[#173F35]"
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




function RecipeEvidenceFallback({ kind, evidence }) {
  const nutrition = Array.isArray(evidence?.nutrition) ? evidence.nutrition : []
  const allergens = Array.isArray(evidence?.allergens) ? evidence.allergens : []
  const dietaryBadge = resolveRecipeDietaryBadge(evidence)
  const title = {
    nutrition: 'Nutrition',
    allergens: 'Allergens',
    dietary: 'Dietary',
    lineage: 'Calculation source & rule lineage',
  }[kind]
  return (
    <div className="epantry-inline-evidence" aria-live="polite">
      <details className="epantry-intelligence-fallback group">
        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3">
          <span>{title}</span>
          <ChevronDown size={18} aria-hidden="true" className="epantry-intelligence-chevron shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="epantry-intelligence-fallback-content">
      {kind === 'nutrition' && (
        nutrition.length > 0 ? (
          <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
            {nutrition.map((row, index) => (
              <div key={row?.key || row?.nutrientId || index} className="flex justify-between gap-4 border-b border-[#DCE0CF] py-2 text-[14px]">
                <dt>{row?.name || recipeDetailLabel(row?.key) || 'Nutrient'}</dt>
                <dd className="font-semibold">{row?.amount ?? '—'} {row?.unit || ''}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-2 text-[14px]">Approved nutrition values cannot currently be verified.</p>
      )}
      {kind === 'allergens' && (
        <div className="mt-2 text-[14px]">
          {evidence?.allergenStatement ? <p className="mb-2 font-medium">{evidence.allergenStatement}</p> : null}
          {allergens.length ? (
            <ul className="space-y-2">
              {allergens.map((row, index) => (
                <li key={row?.key || row?.allergenId || index} className="flex flex-wrap justify-between gap-3 border-b border-[#DCE0CF] py-2">
                  <span>{row?.name || recipeDetailLabel(row?.key) || 'Allergen'}</span>
                  <span className="font-semibold">{recipeDetailLabel(row?.relationship || row?.evidenceState || 'Recorded')}</span>
                </li>
              ))}
            </ul>
          ) : <p>{evidence?.allergenStatement ? 'No further governed allergen relationships are published.' : 'Allergen information cannot currently be verified. This is not an allergen-free claim.'}</p>}
        </div>
      )}
      {kind === 'dietary' && (
        dietaryBadge ? (
          <div className="mt-3 flex items-center gap-3 text-[15px] font-semibold text-[#173F35]">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[7px] border-2 ${dietaryBadge.kind === 'veg' ? 'border-[#278C49]' : 'border-[#9E583B]'}`} aria-hidden="true">
              <span className={`h-3 w-3 rounded-full ${dietaryBadge.kind === 'veg' ? 'bg-[#278C49]' : 'bg-[#B14638]'}`} />
            </span>
            {dietaryBadge.label}
          </div>
        ) : <p className="mt-2 text-[14px]">Dietary suitability cannot currently be verified.</p>
      )}
      {kind === 'lineage' && (
        <p className="mt-2 text-[14px]">{evidence?.calculation?.version
          ? `Calculation version: ${evidence.calculation.version}. Evidence: ${recipeDetailLabel(evidence?.evidenceState || 'Unknown')}.`
          : 'Calculation source and rule lineage are not currently available.'}</p>
      )}
        </div>
      </details>
    </div>
  )
}

function RecipeOriginMap({ origin, map }) {
  const view = useMemo(() => {
    const shapes = map?.outline || []
    const coordinates = shapes.flatMap(feature => feature.rings || []).flat()
    if (!coordinates.length) return null
    const xs = coordinates.map(([x]) => x).filter(Number.isFinite)
    const ys = coordinates.map(([,y]) => y).filter(Number.isFinite)
    if (!xs.length || !ys.length) return null
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const deltaX = Math.max(maxX - minX, 0.001)
    const deltaY = Math.max(maxY - minY, 0.001)
    const padding = 24
    const scale = Math.min(552 / deltaX, 312 / deltaY)
    const projected = ([x,y]) => [
      padding + (x-minX)*scale + (552-deltaX*scale)/2,
      padding + (maxY-y)*scale + (312-deltaY*scale)/2,
    ]
    const path = rings => rings.map(ring =>
      ring.map((point,index) => {
        const [x,y]=projected(point)
        return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
      }).join(' ') + ' Z',
    ).join(' ')
    return {
      outline: shapes.map(shape => path(shape.rings)),
      states: (map?.states || []).map(shape => ({ name: shape.name, path: path(shape.rings) })),
    }
  }, [map])
  if (!view) return (
    <div className="flex min-h-52 items-center justify-center border border-dashed border-[#DCE0CF] bg-[#F7F6F2] px-5 text-center text-[14px] text-[#173F35]/70">
      Verified map boundaries are not available right now.
    </div>
  )
  const regionName = String(origin?.region?.name || '').toLowerCase().trim()
  return (
    <figure className="min-w-0 bg-[#F7F6F2] p-3 sm:p-5">
      <svg viewBox="0 0 600 360" className="h-auto max-h-[290px] w-full" role="img" aria-label={`Map showing ${origin.country.name}${origin.region ? `, ${origin.region.name}` : ''}`}>
        {view.outline.map((path,i) => <path key={`country-${i}`} d={path} fill="#D8E2D6" stroke="#A8BDB2" strokeWidth="1.4" fillRule="evenodd" />)}
        {view.states.map((shape,i) => <path key={`region-${i}`} d={shape.path} fill={regionName && shape.name.toLowerCase() === regionName ? '#C86C42' : 'transparent'} stroke="#FCFCF9" strokeWidth="0.8" fillRule="evenodd" />)}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#173F35]/70">
        <span>{origin.country.name}{origin.region?.name ? ` · ${origin.region.name}` : ''}</span>
        <a href={map.credit?.url || 'https://www.geoboundaries.org/'} target="_blank" rel="noreferrer" className="underline underline-offset-2">{map.credit?.label || 'geoBoundaries'}</a>
      </figcaption>
    </figure>
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
      className="focus-ring group flex h-full min-w-0 flex-col overflow-hidden rounded-[12px] border border-[#DCE0CF] bg-[#F7F6F2] transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
      aria-label={`Open ${getRecipeRecommendationName(item)}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#DCE0CF]">
        {dish.heroImageUrl ? (
          <img
            src={dish.heroImageUrl}
            alt={dish.name || getRecipeRecommendationName(item)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#173F35]/45">
            <ChefHat
              size={44}
              strokeWidth={1.45}
              aria-hidden="true"
            />
          </div>
        )}

        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-2">
          {dish.cuisine ? (
            <span className="rounded-full border border-white/65 bg-white/90 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#173F35] shadow-sm backdrop-blur sm:px-2.5 sm:py-1 sm:text-[13px] sm:font-semibold sm:tracking-[0.12em]">
              {dish.cuisine}
            </span>
          ) : null}
          {dish.course ? (
            <span className="rounded-full border border-amber-100/80 bg-[#F7F6F2]/92 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-amber-800 shadow-sm backdrop-blur sm:px-2.5 sm:py-1 sm:text-[13px] sm:font-semibold sm:tracking-[0.12em]">
              {dish.course}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.7em] text-[15px] font-semibold leading-[1.35] tracking-normal text-[#173F35] sm:text-[17px] sm:font-semibold sm:tracking-[-0.02em]">
          {getRecipeRecommendationName(item)}
        </h3>

        <div className="mt-1.5 flex min-h-4 items-center gap-1.5 text-[13px] font-medium text-[#202421]/70 sm:mt-2 sm:min-h-5 sm:gap-2 sm:text-[14px] sm:font-semibold">
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

        <span data-recipe-recommendation-cta className="mt-auto inline-flex items-center justify-between gap-2 rounded-lg bg-[#173F35] px-3 py-2.5 text-sm font-semibold text-[#F7F6F2] transition-colors group-hover:bg-[#202421] sm:mt-4">
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
  showViewAll = true,
}) {
  if (!loading && items.length === 0) {
    return null
  }

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:mb-5 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#C86C42] sm:text-[13px] sm:font-semibold sm:tracking-[0.18em]">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-[24px] font-semibold leading-[1.25] text-[#173F35] sm:text-[32px] sm:font-semibold sm:tracking-[-0.035em]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 hidden max-w-2xl text-[13px] font-medium leading-4 text-[#202421]/70 sm:mt-1.5 sm:block sm:text-sm sm:leading-6">
              {description}
            </p>
          ) : null}
        </div>

        {showViewAll ? (
        <Link
          to="/recipes"
          className="focus-ring inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-[#DCE0CF] bg-[#F7F6F2] px-3 py-1.5 text-[13px] font-semibold text-[#173F35] shadow-sm transition hover:border-emerald-700 hover:bg-[#173F35] hover:text-white sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm sm:font-semibold"
        >
          View all
          <ArrowRight
            size={16}
            aria-hidden="true"
          />
        </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: RECIPE_RECOMMENDATION_LIMIT }).map((_, index) => (
              <div
                key={index}
                className={[
                  'aspect-[0.76/1] animate-pulse rounded-[18px] border border-[#DCE0CF] bg-[#F7F6F2] sm:rounded-[24px]',
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


function HostDeclaredRecipeFacts({ submission, section }) {
  const nutrition = submission?.nutrition || {}
  const facts = [
    ['Energy', 'energyKcal', 'kcal'], ['Protein', 'proteinG', 'g'],
    ['Carbohydrates', 'carbohydrateG', 'g'], ['Fat', 'fatG', 'g'],
    ['Fibre', 'fiberG', 'g'], ['Sugar', 'sugarG', 'g'], ['Sodium', 'sodiumMg', 'mg'],
  ].filter(([, key]) => nutrition[key] !== null && nutrition[key] !== undefined && nutrition[key] !== '')
  const allergenRows = (submission?.allergens || []).map(row => ({
    name: typeof row === 'string' ? row : (row.key || row.name || row.allergenKey || ''),
    status: typeof row === 'string' ? 'Host-declared' : (row.status || row.relationType || row.value || 'Host-declared'),
  })).filter(row => row.name)
  const name = section === 'nutrition' ? 'Nutrition' : section === 'allergens' ? 'Allergens' : 'Dietary'
  return (
    <details className="epantry-guide-accordion group border-b border-[#DCE0CF]">
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[15px] font-semibold text-[#173F35] sm:px-5 sm:py-4 sm:text-xl">
        {name} <ChevronDown size={17} className="transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#DCE0CF] bg-[#F7F6F2] p-4 sm:p-5">
        <p className="mb-3 text-sm text-[#79543D]">Host-declared information. Listing approval does not independently verify food claims.</p>
        {section === 'nutrition' ? (facts.length ? (
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {facts.map(([label, key, unit]) => <div key={key} className="flex justify-between border-b border-[#DCE0CF] py-2 text-sm"><dt>{label}</dt><dd className="font-semibold">{nutrition[key]} {unit}</dd></div>)}
          </dl>
        ) : <p className="text-sm">Nutrition not declared.</p>) : null}
        {section === 'allergens' ? (allergenRows.length ? (
          <dl className="space-y-2">{allergenRows.map((row, i) => <div key={i} className="flex flex-wrap justify-between gap-2 border-b border-[#DCE0CF] pb-2 text-sm"><dt>{row.name}</dt><dd className="font-semibold">{row.status}</dd></div>)}</dl>
        ) : <p className="text-sm">Allergen status not declared.</p>) : null}
        {section === 'dietary' ? <p className="text-sm">{submission?.dietary || 'Not declared'}</p> : null}
      </div>
    </details>
  )
}

export default function RecipeDetailPage() {
  const {
    slug,
  } =
    useParams()

  const hostListingMode = String(slug || '').startsWith('host--')

  const location =
    useLocation()

  const navigate =
    useNavigate()

  const {
    isAuthenticated,
    isBootstrapping,
    user,
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

  const [recipeDiscovery, setRecipeDiscovery] = useState(null)
  const [recipeDiscoveryLoading, setRecipeDiscoveryLoading] = useState(false)

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

  const [
    restaurantOrderSubmitting,
    setRestaurantOrderSubmitting,
  ] =
    useState(
      false,
    )

  const [
    restaurantOrderError,
    setRestaurantOrderError,
  ] =
    useState(
      '',
    )

  const restaurantOrderResumeRef =
    useRef(
      false,
    )

  const ingredientDecisionLockRef =
    useRef(
      new Set(),
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

  useEffect(() => { setRecipeHeroView('photo') }, [slug])

  useEffect(
    () => {
      const currentSlug =
        String(
          data?.dish?.slug ||
          slug ||
          '',
        ).trim()

      if (!currentSlug || !data?.dish || hostListingMode) {
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
      hostListingMode,
    ],
  )

  useEffect(() => {
    if (!slug || !data?.recipe?.id) {
      setRecipeDiscovery(null)
      setRecipeDiscoveryLoading(false)
      return undefined
    }
    let active = true
    setRecipeDiscovery(null)
    setRecipeDiscoveryLoading(true)
    getRecipeDiscovery(slug)
      .then(result => { if (active) setRecipeDiscovery(result || null) })
      .catch(() => { if (active) setRecipeDiscovery(null) })
      .finally(() => { if (active) setRecipeDiscoveryLoading(false) })
    return () => { active = false }
  }, [slug, data?.recipe?.id])

  useEffect(
    () => {
      const recipeVersionId =
        data?.recipe?.id

      if (!recipeVersionId || hostListingMode) {
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
      hostListingMode,
    ],
  )

  const customerContextBlocked =
    !hostListingMode && isAuthenticated === true &&
    (
      superAdminEnabled === true ||
      activeMode === 'host' ||
      customerEnabled !== true
    )

  const canUseCustomerFeatures =
    !hostListingMode && isAuthenticated &&
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

  useEffect(() => {
    if (hostListingMode) {
      if (!isBootstrapping && data?.hostSubmission?.id) {
        recordApprovedFoodView(data.hostSubmission, isAuthenticated ? (user?.id || user?._id || user?.uid) : '')
      }
      return
    }
    if (isBootstrapping || !dish?.slug || !dish?.name || !data?.recipe?.id) return
    recordRecipeView({
      slug: dish.slug,
      name: dish.name,
      image: dish.heroImageUrl || '',
      cuisine: dish.cuisine || '',
    }, isAuthenticated ? (user?.id || user?._id || user?.uid) : '')
  }, [dish?.slug, dish?.name, dish?.heroImageUrl, dish?.cuisine, data?.recipe?.id, data?.hostSubmission, hostListingMode, isBootstrapping, isAuthenticated, user?.id, user?._id, user?.uid])

  const recipe =
    data?.recipe ||
    {}

  const restaurant =
    data?.restaurant ||
    null

  const restaurantOrder =
    scaledData?.restaurantOrder ||
    data?.restaurantOrder ||
    null

  const isRestaurantRecipe =
    recipe?.source?.type ===
      'chef' &&
    Boolean(
      restaurant,
    )

  const restaurantOrderPriceCurrent =
    Number(
      restaurantOrder?.servings,
    ) ===
      Number(
        servings,
      )

  const recipeDietaryBadge = resolveRecipeDietaryBadge(detailsFoodIntelligence)

  useEffect(() => {
    if (!data?.recipe?.id || typeof MutationObserver === 'undefined') return undefined
    const ids = [
      'recipe-nutrition-intelligence-slot',
      'recipe-allergen-intelligence-slot',
      'recipe-dietary-intelligence-slot',
    ]
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const exposeBridgePanels = () => {
      targets.forEach((target) => {
        const panel = target.querySelector(':scope > details')
        if (panel && panel.dataset.epantryInitiallyOpened !== 'true') {
          panel.open = true
          panel.dataset.epantryInitiallyOpened = 'true'
        }
      })
    }
    exposeBridgePanels()
    const observer = new MutationObserver(exposeBridgePanels)
    targets.forEach((target) => observer.observe(target, { childList: true }))
    return () => observer.disconnect()
  }, [data?.recipe?.id])


  useEffect(() => {
    ingredientDecisionLockRef.current.clear()
    restaurantOrderResumeRef.current = false
    setResolvedIngredientIds(new Set())
    setPantrySetupItem(null)
    setSetupError('')
    setRestaurantOrderError('')
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

    const canonicalIngredientId = getRecipeIngredientCanonicalId(ingredient)

    if (
      !canonicalIngredientId ||
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
      ingredientDecisionLockRef.current.delete(canonicalIngredientId)
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

  async function addIngredientToRecipeCart(ingredient, sourceElement) {
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
    const canonicalIngredientId = getRecipeIngredientCanonicalId(ingredient)

    if (!canonicalIngredientId) {
      setCartError(
        'This Recipe ingredient is not linked to a canonical ingredient and cannot be added to the Recipe Cart yet.',
      )
      return false
    }

    setCartError('')

    try {
      const availability =
        await checkItemAvailability({
          query:
            name,
          canonicalIngredientId,
          source:
            'recipe',
        })

      if (
        availability?.available !==
          true
      ) {
        openAvailabilityNotifyModal({
          query:
            name,
          displayName:
            name,
          canonicalIngredientId,
          source:
            'recipe',
        })

        return false
      }
    } catch (availabilityError) {
      setCartError(
        availabilityError?.response?.data?.message ||
          availabilityError?.message ||
          'Unable to check whether this ingredient is available on EPANTRY right now.',
      )

      return false
    }
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

  async function handleMissingIngredient(ingredient, sourceElement) {
    const canonicalIngredientId = getRecipeIngredientCanonicalId(ingredient)
    if (
      !canonicalIngredientId ||
      ingredientDecisionLockRef.current.has(canonicalIngredientId)
    ) return

    ingredientDecisionLockRef.current.add(canonicalIngredientId)
    try {
      const added =
        await addIngredientToRecipeCart(
          ingredient,
          sourceElement,
        )

      if (added) {
        setIngredientResolved(canonicalIngredientId, true)
      }
    } finally {
      ingredientDecisionLockRef.current.delete(canonicalIngredientId)
    }
  }


  async function handleDirectRestaurantOrder({
    resumeAfterAddress =
      false,
  } = {}) {
    if (
      restaurantOrderSubmitting
    ) {
      return
    }

    if (
      !canUseCustomerFeatures
    ) {
      openCustomerAccessRequired()
      return
    }

    if (
      !isRestaurantRecipe ||
      restaurantOrder?.available !==
        true ||
      !restaurantOrderPriceCurrent
    ) {
      setRestaurantOrderError(
        'This prepared dish is not currently available to order at the selected servings.',
      )
      return
    }

    setRestaurantOrderSubmitting(
      true,
    )
    setRestaurantOrderError(
      '',
    )

    try {
      const addressResult =
        await getDefaultDeliveryAddress()

      const address =
        addressResult?.address ||
        null

      const pincode =
        String(
          address?.postalCode ||
            '',
        )
          .trim()
          .replace(
            /\s+/g,
            '',
          )

      if (
        !/^\d{6}$/.test(
          pincode,
        )
      ) {
        if (
          resumeAfterAddress
        ) {
          throw new Error(
            'Choose a delivery address with a valid 6-digit pincode before ordering this Restaurant dish.',
          )
        }

        const returnTo =
          `${location.pathname}${location.search}${location.hash}`

        navigate(
          `/delivery-addresses?returnTo=${encodeURIComponent(
            returnTo,
          )}`,
          {
            state: {
              restaurantRecipeOrderResume:
                true,
              restaurantRecipeOrderServings:
                servings,
            },
          },
        )
        return
      }

      const result =
        await createRestaurantRecipeMarketplaceCart({
          slug,
          servings,
          pincode,
          fulfillmentType:
            'delivery',
          idempotencyKey:
            createCommerceIdempotencyKey(
              'restaurant-recipe-order',
            ),
        })

      const cartId =
        result?.cart?.id

      if (!cartId) {
        throw new Error(
          'Restaurant order Cart identity was not returned.',
        )
      }

      navigate(
        `/cart/${cartId}`,
        {
          state: {
            restaurantRecipeOrder:
              true,
          },
        },
      )
    } catch (orderError) {
      setRestaurantOrderError(
        getCommerceErrorMessage(
          orderError,
          'Unable to start this Restaurant order.',
        ),
      )
    } finally {
      setRestaurantOrderSubmitting(
        false,
      )
    }
  }

  useEffect(
    () => {
      if (
        location.state
          ?.restaurantRecipeOrderResume !==
          true ||
        location.state
          ?.deliveryAddressSaved !==
          true ||
        restaurantOrderResumeRef.current
      ) {
        return
      }

      const requestedServings =
        Number(
          location.state
            ?.restaurantRecipeOrderServings ||
            servings,
        )

      if (
        Number.isInteger(
          requestedServings,
        ) &&
        requestedServings >
          0 &&
        requestedServings !==
          servings
      ) {
        setServings(
          requestedServings,
        )
        return
      }

      if (
        loading ||
        scaling ||
        !isRestaurantRecipe ||
        !restaurantOrderPriceCurrent
      ) {
        return
      }

      restaurantOrderResumeRef.current =
        true

      navigate(
        `${location.pathname}${location.search}${location.hash}`,
        {
          replace:
            true,
          state:
            null,
        },
      )

      handleDirectRestaurantOrder({
        resumeAfterAddress:
          true,
      })
    },
    [
      isRestaurantRecipe,
      loading,
      location.hash,
      location.pathname,
      location.search,
      location.state,
      navigate,
      restaurantOrderPriceCurrent,
      scaling,
      servings,
    ],
  )


  if (loading) {
    return (
      <main className="page-shell min-h-screen py-10">

        <div className="h-[620px] animate-pulse rounded-[30px] border border-[#DCE0CF] bg-white" />

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

          <h1 className="text-xl font-semibold text-red-950">
            Recipe unavailable
          </h1>

          <p className="mt-2 text-sm text-red-800">
            {
              error
            }
          </p>

          <Link
            to="/recipes"
            className="mt-5 inline-flex font-semibold text-red-900 underline"
          >
            Back to recipes
          </Link>

        </div>

      </main>
    )
  }

  return (
    <main className="epantry-recipe-detail min-h-screen bg-[#F7F6F2]">
      <style>{`
        /* EPANTRY Recipe Editorial: same five-color Japandi tokens as the public pages. */
        .epantry-recipe-detail {
          --rd-paper: #F7F6F2;
          --rd-forest: #173F35;
          --rd-ink: #202421;
          --rd-sage: #DCE0CF;
          --rd-clay: #C86C42;
          background: var(--rd-paper);
          color: var(--rd-ink);
          font-family: "Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .epantry-recipe-detail h1,
        .epantry-recipe-detail h2,
        .epantry-recipe-detail h3 {
          font-family: inherit;
          letter-spacing: -.035em;
          overflow-wrap: anywhere;
        }
        /* One editorial spread: story left, photograph right, rather than two cards. */
        .epantry-recipe-detail .epantry-recipe-hero {
          position: relative;
          isolation: isolate;
          background: var(--rd-paper) !important;
          border: 1px solid rgba(23,63,53,.19) !important;
          box-shadow: 0 17px 44px rgba(32,36,33,.055);
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info,
        .epantry-recipe-detail .epantry-recipe-mobile-info {
          background: var(--rd-paper) !important;
          color: var(--rd-ink) !important;
        }
        .epantry-recipe-detail .recipe-edition-eyebrow {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          color: var(--rd-forest);
          font-size: 13px;
          line-height: 1.5;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
        }
        .epantry-recipe-detail .recipe-edition-eyebrow::before {
          content: '';
          display: block;
          width: 28px;
          height: 3px;
          background: var(--rd-clay);
          flex: none;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info h1,
        .epantry-recipe-detail .epantry-recipe-mobile-info h1 {
          color: var(--rd-ink) !important;
          font-weight: 600 !important;
          line-height: 1.1 !important;
          letter-spacing: -.05em !important;
          text-wrap: balance;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow),
        .epantry-recipe-detail .epantry-recipe-mobile-info > p:not(.recipe-edition-eyebrow) {
          color: var(--rd-ink) !important;
          line-height: 1.65 !important;
        }
        .epantry-recipe-detail .epantry-recipe-photo {
          background: var(--rd-sage) !important;
          isolation: isolate;
        }
        .epantry-recipe-detail .epantry-recipe-photo > img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .epantry-recipe-detail .epantry-recipe-metric {
          min-width: 0;
          background: none !important;
          border: 0 !important;
          border-top: 1px solid rgba(23,63,53,.22) !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 12px 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-metric p:first-child {
          color: var(--rd-forest) !important;
          font-size: 13px !important;
          font-weight: 600;
          line-height: 1.45;
          white-space: normal;
          letter-spacing: .065em;
        }
        .epantry-recipe-detail .epantry-recipe-metric p:last-child {
          color: var(--rd-ink) !important;
          font-size: 15px !important;
          font-weight: 700;
          line-height: 1.5;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .epantry-recipe-detail .epantry-recipe-workspace {
          display: flex;
          flex-direction: column;
          gap: 0 !important;
        }
        /* Prep chapter: spacious rows, no internal scroller, genuine pantry actions. */
        .epantry-recipe-detail .epantry-recipe-ingredients {
          width: 100%;
          background: var(--rd-sage) !important;
          border: 0 !important;
          border-radius: 16px !important;
          box-shadow: none !important;
          padding: clamp(18px, 3.1vw, 40px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients h2 {
          color: var(--rd-ink) !important;
          font-size: clamp(24px, 2.75vw, 36px) !important;
          font-weight: 600 !important;
          line-height: 1.2 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child {
          padding-bottom: 22px !important;
          border-color: rgba(23,63,53,.22) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list {
          background: var(--rd-paper) !important;
          overflow: visible !important;
          border: 1px solid rgba(23,63,53,.17) !important;
          border-radius: 12px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          min-width: 0;
          align-items: center;
          gap: 10px;
          padding: 13px 16px !important;
          border-color: rgba(23,63,53,.10) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
          background: rgba(220,224,207,.25) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list h3 {
          color: var(--rd-ink) !important;
          font-size: 15px !important;
          line-height: 1.45;
          font-weight: 600;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button {
          min-height: 40px;
          font-size: 13px;
        }
        /* Cooking chapter follows the prep chapter in the natural document flow. */
        .epantry-recipe-detail .epantry-recipe-guide {
          width: 100%;
          margin-top: clamp(22px, 3vw, 36px);
          border: 1px solid rgba(23,63,53,.18) !important;
          border-radius: 16px !important;
          background: var(--rd-paper) !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > div:first-child {
          color: var(--rd-paper) !important;
          background: var(--rd-forest) !important;
          padding: clamp(20px, 2.8vw, 34px) clamp(20px, 3.3vw, 42px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > div:first-child h2 {
          color: var(--rd-paper) !important;
          font-size: clamp(24px, 2.7vw, 34px) !important;
          font-weight: 600;
          line-height: 1.2;
        }
        .epantry-recipe-detail .epantry-recipe-guide > div:first-child p {
          color: var(--rd-sage) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] {
          overflow: visible !important;
          max-height: none !important;
          scroll-behavior: auto;
        }
        .epantry-recipe-detail .epantry-recipe-guide details {
          border-color: rgba(23,63,53,.17) !important;
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide summary {
          min-height: 60px;
          padding: 18px clamp(18px, 2.5vw, 34px) !important;
          color: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide summary span:first-child {
          color: var(--rd-ink) !important;
          font-size: 18px !important;
          font-weight: 600;
          line-height: 1.4;
        }
        .epantry-recipe-detail .epantry-recipe-guide details[open] > summary {
          background: rgba(220,224,207,.55) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide details > div {
          border-color: rgba(23,63,53,.15) !important;
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide ol li p {
          color: var(--rd-ink) !important;
          font-size: 16px !important;
          line-height: 1.65 !important;
          font-weight: 500;
        }
        .epantry-recipe-detail .epantry-recipe-guide ol li > div:first-child {
          border-radius: 50%;
        }
        /* Preserve existing published Food Intelligence slots and portal contents. */
        .epantry-recipe-detail .epantry-recipe-intelligence-slot:has(> details) > .epantry-inline-evidence {
          display: none;
        }
        .epantry-recipe-detail .epantry-inline-evidence {
          padding: 20px clamp(18px, 2.5vw, 34px);
          color: var(--rd-ink);
          background: var(--rd-paper);
          border-bottom: 1px solid rgba(23,63,53,.17);
        }
        .epantry-recipe-detail .epantry-inline-evidence h3 {
          color: var(--rd-forest);
          font-size: 18px;
          font-weight: 600;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details {
          border-bottom: 1px solid rgba(23,63,53,.17) !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div {
          background: var(--rd-paper) !important;
          border-color: var(--rd-sage) !important;
          box-shadow: none !important;
          padding: 20px clamp(18px, 2.5vw, 34px);
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary {
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details[open] > summary {
          background: var(--rd-sage) !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child {
          color: var(--rd-ink) !important;
          font-family: inherit !important;
          font-size: 18px !important;
          font-weight: 600 !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot p,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot select {
          font-family: inherit !important;
          font-size: 15px;
          line-height: 1.6;
        }
        /* Final chapter: related recipes as an editorial shelf, not a card jungle. */
        .epantry-recipe-detail .epantry-recipe-related {
          border: 0 !important;
          border-top: 3px solid var(--rd-clay) !important;
          border-radius: 0 !important;
          background: var(--rd-forest) !important;
          padding: clamp(22px, 3.2vw, 42px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child h2 {
          color: var(--rd-paper) !important;
          font-size: clamp(24px, 2.7vw, 34px) !important;
          line-height: 1.25;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child p {
          color: var(--rd-sage) !important;
          font-size: 14px !important;
          line-height: 1.6;
        }
        .epantry-recipe-detail .epantry-recipe-related [data-recipe-recommendation-cta] {
          background: var(--rd-ink) !important;
          color: var(--rd-paper) !important;
        }
        /* 100svh photograph on desktop, tablet and mobile; information stays in natural flow. */
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-hero-grid {
            min-height: 100svh !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100% !important;
            min-height: 100svh !important;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important;
            min-height: 100svh !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important;
            min-height: 100svh !important;
            max-height: none !important;
          }
        }
        /* Ingredients / Living Pantry: editorial preparation workspace, not nested cards. */
        .epantry-recipe-detail .epantry-recipe-ingredients {
          background: var(--rd-paper) !important;
          border: 1px solid rgba(23,63,53,.18) !important;
          border-left: 4px solid var(--rd-clay) !important;
          border-radius: 14px !important;
          padding: clamp(18px, 2.8vw, 34px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child {
          padding-bottom: 24px !important;
          margin-bottom: 4px;
          border-bottom: 1px solid rgba(23,63,53,.24) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child > div:first-child > div:first-child {
          background: var(--rd-sage) !important;
          border: 0 !important;
          border-radius: 4px !important;
          padding: 6px 12px !important;
          color: var(--rd-forest) !important;
          letter-spacing: .045em !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients h2 {
          color: var(--rd-ink) !important;
          font-size: clamp(24px, 2.8vw, 32px) !important;
          letter-spacing: -.035em;
          line-height: 1.2 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients .epantry-recipe-servings {
          border: 0 !important;
          border-radius: 10px !important;
          background: var(--rd-sage) !important;
          padding: 12px 18px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list {
          border: 0 !important;
          border-top: 1px solid rgba(23,63,53,.2) !important;
          border-bottom: 1px solid rgba(23,63,53,.2) !important;
          border-radius: 0 !important;
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          background: transparent !important;
          border-bottom: 1px solid rgba(23,63,53,.12) !important;
          padding: 14px 12px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
          background: rgba(220,224,207,.3) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:hover {
          background: rgba(220,224,207,.58) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list h3 {
          font-size: 15px !important;
        }
        /* Food intelligence: light Sage dropdown headers, warm Porcelain expanded body. */
        .epantry-recipe-detail .epantry-recipe-intelligence {
          display: grid;
          gap: 10px;
          background: var(--rd-paper);
          padding: 18px clamp(14px, 2.5vw, 32px) 26px;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot {
          overflow: hidden;
          border: 1px solid rgba(23,63,53,.19);
          border-radius: 10px;
          background: var(--rd-paper);
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details,
        .epantry-recipe-detail .epantry-intelligence-fallback {
          background: var(--rd-paper) !important;
          border: 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 58px;
          padding: 16px 20px !important;
          background: var(--rd-sage) !important;
          color: var(--rd-forest) !important;
          transition: background-color .2s ease;
          cursor: pointer;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary:hover,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary:hover {
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary span:first-child {
          color: var(--rd-forest) !important;
          font-family: inherit !important;
          font-size: 16px !important;
          font-weight: 700 !important;
          line-height: 1.45;
          letter-spacing: -.015em;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div,
        .epantry-recipe-detail .epantry-intelligence-fallback-content {
          background: var(--rd-paper) !important;
          border-top: 1px solid rgba(23,63,53,.15) !important;
          box-shadow: none !important;
          padding: 18px clamp(16px, 2.5vw, 28px) !important;
          color: var(--rd-ink) !important;
          font-size: 15px;
          line-height: 1.6;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot .epantry-inline-evidence {
          padding: 0 !important;
          border: 0 !important;
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot:has(> details) > .epantry-inline-evidence {
          display: none;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot p,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot select {
          font-family: inherit !important;
          line-height: 1.6 !important;
        }
        /* Related recipes are a soft-sage editorial collection, not a dark green block. */
        .epantry-recipe-detail .epantry-recipe-related {
          border: 0 !important;
          border-top: 3px solid var(--rd-clay) !important;
          border-radius: 14px !important;
          background: var(--rd-sage) !important;
          padding: clamp(20px, 3vw, 38px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section + section {
          padding-top: clamp(24px, 3.2vw, 40px);
          border-top: 1px solid rgba(23,63,53,.23);
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child h2 {
          color: var(--rd-ink) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child p {
          color: var(--rd-forest) !important;
          font-size: 15px !important;
        }
        .epantry-recipe-detail .epantry-recipe-related [data-recipe-recommendation-cta] {
          background: var(--rd-forest) !important;
          color: var(--rd-paper) !important;
        }
        .epantry-recipe-detail button:focus-visible,
        .epantry-recipe-detail a:focus-visible,
        .epantry-recipe-detail summary:focus-visible {
          outline: 2px solid var(--rd-clay) !important;
          outline-offset: 3px;
        }
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-hero-grid {
            display: grid;
            grid-template-columns: minmax(0, .93fr) minmax(0, 1.07fr) !important;
            min-height: 570px;
            align-items: stretch;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            order: 1;
            display: flex !important;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start !important;
            padding: clamp(30px, 4.5vw, 70px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info h1 {
            font-size: clamp(38px, 4.2vw, 56px) !important;
            margin-top: 16px;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            font-size: 16px !important;
            margin-top: 24px !important;
            max-width: 46ch;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info .epantry-recipe-metrics {
            width: 100%;
            margin-top: auto !important;
            padding-top: 34px;
            gap: 10px 24px;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info > a:last-child {
            margin-top: 20px !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo {
            order: 2;
            margin: 0 !important;
            height: 100% !important;
            min-height: 570px;
            border-radius: 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo::after {
            content: '';
            position: absolute;
            z-index: 2;
            top: 0;
            right: 0;
            bottom: 0;
            width: 5px;
            background: var(--rd-clay);
            pointer-events: none;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            border-bottom: 1px solid rgba(23,63,53,.11);
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            margin: 16px 16px 0 !important;
            height: 410px !important;
            border-radius: 12px !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            padding: 24px 30px 32px !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info h1 {
            font-size: 38px !important;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-hero {
            border-radius: 12px !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 43svh !important;
            min-height: 260px;
            max-height: 460px;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info {
            padding: 22px !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info h1 {
            font-size: 36px !important;
          }
          .epantry-recipe-detail .epantry-recipe-metric p:last-child {
            font-size: 14px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            padding: 12px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list button {
            min-height: 38px;
          }
          .epantry-recipe-detail .epantry-recipe-workspace {
            gap: 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide {
            margin-top: 22px;
          }
          .epantry-recipe-detail .epantry-recipe-guide summary span:first-child,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child {
            font-size: 16px !important;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-ingredients {
            padding: 18px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child {
            gap: 16px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            padding: 12px 8px !important;
          }
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
          .epantry-recipe-detail .epantry-intelligence-fallback > summary {
            min-height: 54px;
            padding: 14px 16px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related {
            padding: 18px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-recipe-detail * {
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
        /* Final viewport override after legacy responsive rules. */
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-hero-grid { min-height: 100svh !important; }
          .epantry-recipe-detail .epantry-recipe-photo { height: 100% !important; min-height: 100svh !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important; min-height: 100svh !important;
            max-height: none !important; margin: 0 !important; border-radius: 0 !important;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important; min-height: 100svh !important; max-height: none !important;
          }
        }
        /* Phase 3: page-scoped, full-width editorial layout. Keep the 100svh image
           and all existing cooking, Pantry and Food Intelligence interactions. */
        .epantry-recipe-detail > .page-shell {
          width: 100% !important;
          max-width: none !important;
          margin-inline: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
        .epantry-recipe-detail > .page-shell > a:first-child {
          margin: 4px 0 6px clamp(16px, 3.2vw, 48px) !important;
          font-size: 14px;
        }
        .epantry-recipe-detail .epantry-recipe-hero {
          margin-top: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info,
        .epantry-recipe-detail .epantry-recipe-mobile-info {
          border: 0 !important;
          border-radius: 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-workspace {
          margin-top: 0 !important;
          gap: 0 !important;
        }
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            justify-content: center !important;
            padding: clamp(32px, 4vw, 72px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info .epantry-recipe-metrics {
            margin-top: clamp(32px, 5vh, 56px) !important;
            padding-top: 0 !important;
          }
        }

        /* 01 / Ingredients + Living Pantry: one full-width preparation section,
           not a rounded card containing multiple other cards. */
        .epantry-recipe-detail .epantry-recipe-ingredients {
          --rd-chapter-padding: clamp(16px, 3.2vw, 44px);
          margin: 0 !important;
          padding: 0 0 clamp(24px, 3vw, 36px) !important;
          border: 0 !important;
          border-top: 1px solid rgba(23,63,53,.17) !important;
          border-radius: 0 !important;
          background: var(--rd-paper) !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child {
          margin: 0 !important;
          padding: clamp(22px, 3vw, 34px) var(--rd-chapter-padding) !important;
          border: 0 !important;
          border-bottom: 2px solid rgba(23,63,53,.30) !important;
          background: var(--rd-sage) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child > div:first-child > div:first-child {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: none !important;
          color: var(--rd-forest) !important;
          font-size: 14px !important;
          letter-spacing: .055em !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients h2 {
          max-width: 26ch;
          margin-top: 12px !important;
          color: var(--rd-ink) !important;
          font-size: clamp(26px, 3vw, 36px) !important;
          font-weight: 600 !important;
          line-height: 1.2 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > :not(:first-child) {
          margin-right: var(--rd-chapter-padding) !important;
          margin-left: var(--rd-chapter-padding) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings {
          margin-top: 20px !important;
          padding: 16px 20px !important;
          border: 0 !important;
          border-left: 3px solid var(--rd-clay) !important;
          border-radius: 0 !important;
          background: rgba(220,224,207,.70) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:first-child p:first-child {
          font-size: 14px !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:first-child p:last-child {
          font-size: 14px !important;
          line-height: 1.5;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list {
          margin-top: 18px !important;
          border: 0 !important;
          border-top: 1px solid rgba(23,63,53,.22) !important;
          border-bottom: 1px solid rgba(23,63,53,.22) !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          border-radius: 0 !important;
          padding: 15px 12px !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
          background: rgba(220,224,207,.21) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list h3 {
          font-size: 16px !important;
          line-height: 1.4 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button {
          min-height: 42px;
          font-size: 14px !important;
        }
        .epantry-recipe-detail .epantry-recipe-access-note,
        .epantry-recipe-detail .epantry-recipe-checkout-note {
          border: 0 !important;
          border-bottom: 1px solid rgba(23,63,53,.18) !important;
          border-radius: 0 !important;
          background: transparent !important;
          font-size: 14px !important;
          line-height: 1.55 !important;
        }
        .epantry-recipe-detail .epantry-recipe-checkout-note {
          margin-top: 18px !important;
          padding: 12px 0 !important;
        }

        /* 02 / Recipe guide: editorial section with one consistent accordion
           treatment for Steps, Ingredients and all four governed data sources. */
        .epantry-recipe-detail .epantry-recipe-guide {
          margin-top: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #FFFFFF !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > div:first-child {
          padding: clamp(24px, 3.2vw, 38px) clamp(16px, 3.2vw, 44px) !important;
          border-bottom: 0 !important;
          background: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > div:first-child h2 {
          font-size: clamp(26px, 3vw, 36px) !important;
          line-height: 1.2 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > div:first-child {
          padding: 20px clamp(16px, 3.2vw, 44px) !important;
          border-color: rgba(23,63,53,.14) !important;
          background: var(--rd-paper) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details,
        .epantry-recipe-detail .epantry-intelligence-fallback {
          margin: 0 !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(23,63,53,.16) !important;
          border-radius: 0 !important;
          background: #FFFFFF !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence {
          display: block !important;
          padding: 0 !important;
          background: #FFFFFF !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot {
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot .epantry-inline-evidence {
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary {
          display: flex;
          align-items: center;
          min-height: 62px;
          margin: 0 !important;
          padding: 18px clamp(16px, 3.2vw, 44px) !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: rgba(220,224,207,.46) !important;
          color: var(--rd-ink) !important;
          cursor: pointer;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details[open] > summary,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details[open] > summary,
        .epantry-recipe-detail .epantry-intelligence-fallback[open] > summary {
          background: var(--rd-sage) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary span:first-child,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary span:first-child {
          font-family: inherit !important;
          font-size: 18px !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
          letter-spacing: -.015em !important;
          color: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > div,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div,
        .epantry-recipe-detail .epantry-intelligence-fallback-content {
          padding: 20px clamp(16px, 3.2vw, 44px) !important;
          border-top: 1px solid rgba(23,63,53,.14) !important;
          border-radius: 0 !important;
          background: #FFFFFF !important;
          background-image: none !important;
          box-shadow: none !important;
          color: var(--rd-ink) !important;
          font-size: 15px;
          line-height: 1.6;
        }

        /* Bridge-provided evidence includes legacy tiny print. Keep all published
           values, but make the expanded rows readable on this page only. */
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div :is(p, span, dt, dd, li, button),
        .epantry-recipe-detail .epantry-intelligence-fallback-content :is(p, span, dt, dd, li, button) {
          font-size: 14px !important;
          line-height: 1.55 !important;
        }
        /* Related chapters have no giant enclosing card; ONLY recipe entries
           stay cards, and keep their existing routes and hover interactions. */
        .epantry-recipe-detail .epantry-recipe-related {
          margin-top: 0 !important;
          padding: clamp(26px, 3.5vw, 48px) clamp(16px, 3.2vw, 44px) !important;
          border: 0 !important;
          border-top: 1px solid rgba(23,63,53,.20) !important;
          border-radius: 0 !important;
          background: var(--rd-paper) !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section + section {
          margin-top: clamp(28px, 3.5vw, 42px) !important;
          padding-top: clamp(24px, 3vw, 36px) !important;
          border-top: 1px solid rgba(23,63,53,.20) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child h2 {
          color: var(--rd-ink) !important;
          font-size: clamp(24px, 2.8vw, 34px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child p {
          color: var(--rd-forest) !important;
          font-size: 15px !important;
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-ingredients {
            --rd-chapter-padding: 16px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > div:first-child {
            padding: 22px 16px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients h2,
          .epantry-recipe-detail .epantry-recipe-guide > div:first-child h2 {
            font-size: 26px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            padding: 12px 6px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary span:first-child,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child,
          .epantry-recipe-detail .epantry-intelligence-fallback > summary span:first-child {
            font-size: 17px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related {
            padding: 24px 16px !important;
          }
        }
      `}</style>

      <style>{`
        /* PHASE 3 / Recipe Detail — second editorial direction.
           Only this page is restyled; business handlers, navigation and the
           four approved Food Intelligence accordion slots stay unchanged. */
        .epantry-recipe-detail {
          --rd-fog: #E7EBE3;
          --rd-parchment: #F0EFE8;
          --rd-ivory: #FBFAF6;
          --rd-divider: rgba(23,63,53,.2);
          overflow: clip;
        }
        .epantry-recipe-detail > .page-shell {
          width: 100% !important;
          max-width: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .epantry-recipe-detail > .page-shell > a:first-child {
          display: inline-flex;
          margin: 0 !important;
          padding: 12px clamp(18px,3.5vw,64px) !important;
          min-height: 48px;
          background: var(--rd-ivory);
          color: var(--rd-forest);
          font-size: 14px;
          border-bottom: 1px solid var(--rd-divider);
        }
        /* HERO: image-led, photo on left, editorial story on the right.
           The photo keeps the previously approved 100svh size. */
        .epantry-recipe-detail .epantry-recipe-hero {
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: var(--rd-ivory) !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-hero-grid {
          gap: 0 !important;
          background: var(--rd-ivory);
        }
        .epantry-recipe-detail .epantry-recipe-photo {
          background: #B9BCAE !important;
          isolation: isolate;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-photo::after {
          display: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-photo > img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: saturate(.96);
        }
        .epantry-recipe-detail .epantry-recipe-photo-caption {
          position: absolute;
          left: clamp(16px,3vw,48px);
          bottom: clamp(18px,3vw,42px);
          z-index: 4;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          pointer-events: none;
        }
        .epantry-recipe-detail .epantry-recipe-photo-caption span {
          padding: 8px 13px;
          border: 1px solid rgba(255,255,255,.7);
          background: rgba(251,250,246,.91);
          color: var(--rd-forest);
          font-size: 13px;
          font-weight: 700;
          text-transform: capitalize;
          letter-spacing: .01em;
          backdrop-filter: blur(8px);
        }
        .epantry-recipe-detail .epantry-recipe-photo > div:first-child {
          top: clamp(16px,2.3vw,32px) !important;
          right: clamp(16px,2.3vw,32px) !important;
          border-radius: 7px !important;
          border: 1px solid rgba(255,255,255,.8) !important;
          box-shadow: 0 6px 24px rgba(0,0,0,.09) !important;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info,
        .epantry-recipe-detail .epantry-recipe-mobile-info {
          position: relative;
          background: var(--rd-ivory) !important;
          color: var(--rd-ink);
          border: 0 !important;
          border-radius: 0 !important;
        }
        .epantry-recipe-detail .recipe-edition-eyebrow {
          color: var(--rd-clay) !important;
          font-size: 14px !important;
          font-weight: 700;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .epantry-recipe-detail .recipe-edition-eyebrow::before {
          width: 33px;
          height: 2px;
          background: var(--rd-clay);
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info h1,
        .epantry-recipe-detail .epantry-recipe-mobile-info h1 {
          font-size: clamp(38px,4.7vw,74px) !important;
          font-weight: 600 !important;
          line-height: 1.06 !important;
          letter-spacing: -.06em !important;
          color: var(--rd-forest) !important;
          text-wrap: balance;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
          color: var(--rd-ink) !important;
          max-width: 46ch;
          font-size: clamp(16px,1.15vw,19px) !important;
          line-height: 1.75 !important;
        }
        .epantry-recipe-detail .epantry-recipe-metrics {
          width: 100%;
          gap: 0 !important;
          border-top: 1px solid var(--rd-divider);
        }
        .epantry-recipe-detail .epantry-recipe-metric {
          min-width: 0;
          border: 0 !important;
          border-bottom: 1px solid var(--rd-divider) !important;
          padding: 16px 7px 15px 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-metric p:first-child {
          font-size: 13px !important;
          font-weight: 600 !important;
          letter-spacing: .025em !important;
          text-transform: none !important;
          color: rgba(23,63,53,.7) !important;
        }
        .epantry-recipe-detail .epantry-recipe-metric p:last-child {
          font-size: 16px !important;
          font-weight: 700 !important;
          color: var(--rd-forest) !important;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .epantry-recipe-detail .epantry-recipe-desktop-info > a:last-child,
        .epantry-recipe-detail .epantry-recipe-mobile-info > a:last-child {
          align-self: flex-start;
          min-height: 42px;
          padding: 10px 0 !important;
          border: 0 !important;
          border-bottom: 1px solid var(--rd-clay) !important;
          border-radius: 0 !important;
          background: transparent !important;
          font-size: 14px !important;
          color: var(--rd-forest) !important;
        }
        /* RESTAURANT: read as a service strip; no nested stack of cards. */
        .epantry-recipe-detail .epantry-recipe-restaurant {
          margin: 0 !important;
          border: 0 !important;
          border-top: 1px solid var(--rd-divider) !important;
          border-bottom: 1px solid var(--rd-divider) !important;
          border-radius: 0 !important;
          background: var(--rd-fog) !important;
        }
        .epantry-recipe-detail .epantry-recipe-restaurant > div {
          padding: clamp(24px,3vw,42px) clamp(18px,4.2vw,70px) !important;
          gap: clamp(20px,3vw,50px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-restaurant > div > div:last-child {
          border-radius: 0 !important;
          border: 0 !important;
          border-left: 2px solid var(--rd-clay) !important;
          box-shadow: none !important;
          background: rgba(255,255,255,.56) !important;
        }
        .epantry-recipe-detail .epantry-recipe-restaurant > div > div:last-child > div:first-child > div {
          border-radius: 0 !important;
          background: transparent !important;
        }
        /* PREP WORKSPACE: Sage left editorial rail, spacious ingredient rows right. */
        .epantry-recipe-detail .epantry-recipe-workspace {
          gap: 0 !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients {
          --rd-prep-pad: clamp(18px,3.2vw,52px);
          position: relative;
          display: grid !important;
          grid-template-columns: minmax(0, 1fr);
          grid-template-rows: auto minmax(0, 1fr);
          height: 100svh;
          min-height: 0;
          max-height: 100svh;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: var(--rd-parchment) !important;
          box-shadow: none !important;
          overflow: hidden !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro {
          display: flex !important;
          flex-direction: column !important;
          justify-content: flex-start !important;
          align-items: flex-start !important;
          gap: clamp(16px,2vw,26px) !important;
          margin: 0 !important;
          padding: clamp(30px,4vw,64px) var(--rd-prep-pad) !important;
          border: 0 !important;
          background: #DDE7DC !important;
          min-height: 0;
          max-height: 42svh;
          overflow-y: auto;
          overscroll-behavior-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #95AA9B #DDE7DC;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:first-child {
          width: 100%;
          max-width: none;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro > div:first-child > div:first-child {
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: var(--rd-clay) !important;
          font-size: 13px !important;
          font-weight: 700;
          letter-spacing: .09em !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients h2 {
          max-width: 17ch !important;
          margin-top: 18px !important;
          font-size: clamp(31px,3.4vw,48px) !important;
          color: var(--rd-forest) !important;
          line-height: 1.13 !important;
          font-weight: 600 !important;
          letter-spacing: -.045em !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child {
          flex-direction: column !important;
          align-items: stretch !important;
          width: 100%;
          gap: 10px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child > :is(button,a) {
          display: inline-flex;
          min-height: 46px;
          width: 100%;
          justify-content: center;
          border-radius: 5px !important;
          font-size: 14px !important;
          white-space: normal;
          line-height: 1.35;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child > span {
          order: -1;
          width: fit-content;
          padding: 8px 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          color: var(--rd-forest) !important;
          font-size: 14px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
          min-width: 0;
          min-height: 0;
          height: 100%;
          margin: 0 !important;
          padding: clamp(18px,2.8vw,38px) var(--rd-prep-pad) clamp(24px,3vw,42px) !important;
          background: var(--rd-ivory);
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #95AA9B #F1F4ED;
          scroll-padding-block: 16px;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-body > :not(:first-child) {
          margin-left: 0 !important;
          margin-right: 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-body .epantry-recipe-servings {
          margin-top: 0 !important;
          min-height: 72px;
          padding: 12px 0 21px !important;
          border: 0 !important;
          border-bottom: 2px solid var(--rd-forest) !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:first-child p:first-child {
          font-size: 16px !important;
          text-transform: none !important;
          letter-spacing: -.01em !important;
          color: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:first-child p:last-child {
          margin-top: 3px;
          font-size: 14px !important;
          font-weight: 400 !important;
          line-height: 1.4 !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child {
          background: var(--rd-forest) !important;
          border: 0 !important;
          border-radius: 5px !important;
          padding: 5px !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child button {
          width: 38px !important;
          height: 38px !important;
          color: white !important;
          border-radius: 4px !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child button:hover {
          background: rgba(255,255,255,.18) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child p {
          color: white !important;
          font-size: 17px !important;
          font-weight: 700;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list {
          display: block !important;
          margin-top: 12px !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          overflow: visible !important;
          height: auto;
          max-height: none;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          display: grid !important;
          grid-template-columns: 32px minmax(0,1fr) minmax(0,auto);
          gap: clamp(10px,1.3vw,18px) !important;
          align-items: center !important;
          padding: 16px 0 !important;
          border: 0 !important;
          border-bottom: 1px solid var(--rd-divider) !important;
          border-radius: 0 !important;
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
          background: transparent !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:hover {
          background: rgba(220,224,207,.17) !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:first-child {
          width: 30px;
          height: 30px;
          border: 0 !important;
          border-radius: 5px !important;
          background: var(--rd-fog) !important;
          font-size: 13px !important;
          font-weight: 700;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list h3 {
          color: var(--rd-ink) !important;
          font-size: 16px !important;
          font-weight: 600;
          line-height: 1.4;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child {
          grid-column: auto !important;
          justify-self: end;
          justify-content: flex-end;
          gap: 7px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child > span {
          padding: 6px 10px !important;
          border-radius: 4px !important;
          background: var(--rd-parchment) !important;
          color: var(--rd-forest);
          font-size: 14px !important;
          font-weight: 700;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button {
          min-height: 38px !important;
          padding: 8px 10px !important;
          border-radius: 4px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          line-height: 1.3;
        }
        .epantry-recipe-detail .epantry-recipe-checkout-note,
        .epantry-recipe-detail .epantry-recipe-access-note {
          margin-top: 16px !important;
          padding: 15px 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          border-top: 1px solid var(--rd-divider) !important;
          background: transparent !important;
          color: rgba(32,36,33,.72);
          font-size: 14px !important;
          line-height: 1.6 !important;
        }
        /* GUIDE: charcoal chapter rail and off-white reading canvas.
           Approved Food Intelligence accordion markup and styles are untouched. */
        .epantry-recipe-detail .epantry-recipe-guide {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr);
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #F3F5F0 !important;
          overflow: visible !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro {
          position: relative;
          margin: 0 !important;
          padding: clamp(30px,4vw,64px) clamp(18px,3.2vw,52px) !important;
          border: 0 !important;
          border-top: 3px solid var(--rd-clay) !important;
          background: #E6EBDD !important;
          color: var(--rd-forest);
        }
        .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro p {
          color: #995A3D !important;
          font-size: 14px !important;
          letter-spacing: .08em !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro h2 {
          max-width: 13ch;
          margin-top: 17px !important;
          color: var(--rd-forest) !important;
          font-size: clamp(31px,3.4vw,48px) !important;
          font-weight: 600 !important;
          line-height: 1.13 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] {
          min-width: 0;
          max-height: none !important;
          overflow: visible !important;
          background: #F3F5F0;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > div:first-child {
          padding: 22px clamp(18px,3.2vw,52px) !important;
          border: 0 !important;
          border-bottom: 2px solid var(--rd-forest) !important;
          background: #EBEFE7 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > div:first-child > div {
          border-left: 0 !important;
          border-top: 2px solid var(--rd-clay);
          padding: 9px 4px 2px 0 !important;
        }
        /* Only the two cooking accordions are redesigned. Do not target the
           four Nutrition/Allergens/Dietary/Lineage slots below them. */
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details {
          border: 0 !important;
          border-bottom: 1px solid var(--rd-divider) !important;
          background: #F9FAF7 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary {
          min-height: 70px;
          padding: 18px clamp(18px,3.2vw,52px) !important;
          background: #F9FAF7 !important;
          border-left: 4px solid transparent;
          transition: background-color .2s ease, border-color .2s ease;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary:hover,
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details[open] > summary {
          background: #E4EBDD !important;
          border-left-color: var(--rd-clay);
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary span:first-child {
          font-size: 19px !important;
          font-weight: 600 !important;
          color: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > div {
          padding: 20px clamp(18px,3.2vw,52px) !important;
          background: #FFFFFF !important;
          border-top: 1px solid var(--rd-divider) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details ol li {
          padding: 15px 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details ol li > div:first-child {
          background: #E6EBDD;
          border: 1px solid rgba(23,63,53,.15);
          border-radius: 4px !important;
          box-shadow: none !important;
        }
        /* RECIPES: two editorial chapters, only individual tiles remain cards. */
        .epantry-recipe-detail .epantry-recipe-related {
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: var(--rd-parchment) !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section {
          margin: 0 !important;
          padding: clamp(32px,4vw,64px) clamp(18px,4vw,64px) !important;
          border: 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section:nth-child(2) {
          border-top: 1px solid var(--rd-divider) !important;
          background: var(--rd-fog) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child {
          margin-bottom: clamp(20px,2vw,28px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child h2 {
          color: var(--rd-forest) !important;
          font-size: clamp(28px,3vw,42px) !important;
          font-weight: 600;
          letter-spacing: -.04em;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child p {
          color: rgba(32,36,33,.77) !important;
          font-size: 15px !important;
          line-height: 1.6 !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:first-child p:first-child {
          color: var(--rd-clay) !important;
          font-weight: 700;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a {
          border: 0 !important;
          border-radius: 9px !important;
          background: var(--rd-ivory) !important;
          box-shadow: 0 5px 22px rgba(23,63,53,.045);
          transition: transform .25s ease, box-shadow .25s ease !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px rgba(23,63,53,.09);
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a > div:first-child {
          aspect-ratio: 5 / 4;
          border-radius: 9px 9px 0 0;
          background: #CFD5C9;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a > div:last-child {
          padding: 17px 16px 18px !important;
        }
        .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a h3 {
          color: var(--rd-forest) !important;
          font-size: 17px !important;
          line-height: 1.4 !important;
          min-height: 2.8em;
        }
        .epantry-recipe-detail .epantry-recipe-related [data-recipe-recommendation-cta] {
          margin-top: auto;
          padding: 14px 0 0 !important;
          border-top: 1px solid var(--rd-divider);
          border-radius: 0 !important;
          background: transparent !important;
          color: var(--rd-forest) !important;
          font-weight: 700;
          font-size: 14px;
        }
        /* Visible native scrollbars: wheel/touch/keyboard can scroll the panel,
           then native scroll chaining continues to the next page section. */
        .epantry-recipe-detail .recipe-details-sheet-body,
        .epantry-recipe-detail .epantry-recipe-ingredients-body,
        .epantry-recipe-detail .epantry-recipe-ingredients-intro {
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: auto !important;
          scrollbar-gutter: stable;
        }
        .epantry-recipe-detail .recipe-details-sheet-body {
          scrollbar-width: thin;
          scrollbar-color: #AA8974 #F1F4ED;
        }
        .epantry-recipe-detail .recipe-details-sheet-body::-webkit-scrollbar,
        .epantry-recipe-detail .epantry-recipe-ingredients-body::-webkit-scrollbar,
        .epantry-recipe-detail .epantry-recipe-ingredients-intro::-webkit-scrollbar {
          width: 9px;
        }
        .epantry-recipe-detail .recipe-details-sheet-body::-webkit-scrollbar-track {
          background: #F1F4ED;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-body::-webkit-scrollbar-track,
        .epantry-recipe-detail .epantry-recipe-ingredients-intro::-webkit-scrollbar-track {
          background: #E8EFE7;
        }
        .epantry-recipe-detail .recipe-details-sheet-body::-webkit-scrollbar-thumb {
          background: #AA8974;
          border: 2px solid #F1F4ED;
          border-radius: 999px;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-body::-webkit-scrollbar-thumb,
        .epantry-recipe-detail .epantry-recipe-ingredients-intro::-webkit-scrollbar-thumb {
          background: #95AA9B;
          border: 2px solid #E8EFE7;
          border-radius: 999px;
        }
        .epantry-recipe-detail .recipe-details-sheet-body:focus-visible,
        .epantry-recipe-detail .epantry-recipe-ingredients-body:focus-visible {
          outline: 2px solid var(--rd-clay);
          outline-offset: -3px;
        }
        .epantry-recipe-detail :is(button,a,summary):focus-visible {
          outline: 2px solid var(--rd-clay) !important;
          outline-offset: 3px;
        }
        @media (min-width: 1440px) {
          .epantry-recipe-detail .epantry-recipe-ingredient-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0,1fr)) !important;
            column-gap: clamp(16px,2vw,32px);
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            grid-template-columns: 30px minmax(0,1fr) !important;
            align-content: start;
            min-height: 122px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child {
            grid-column: 2 !important;
            justify-self: start !important;
            justify-content: flex-start !important;
            flex-wrap: wrap;
          }
        }
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-hero-grid {
            display: grid !important;
            grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr) !important;
            min-height: 100svh !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo {
            order: 1 !important;
            height: 100svh !important;
            min-height: 100svh !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            order: 2 !important;
            display: flex !important;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center !important;
            gap: 0;
            min-height: 100svh;
            padding: clamp(36px,5vw,90px) clamp(28px,4vw,70px) !important;
            border-left: 1px solid var(--rd-divider) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info h1 {
            margin-top: clamp(20px,3vw,42px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            margin-top: clamp(20px,2vw,30px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info .epantry-recipe-metrics {
            margin-top: clamp(36px,6vh,78px) !important;
            padding-top: 0 !important;
            grid-template-columns: repeat(3,minmax(0,1fr));
            row-gap: 0;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients {
            grid-template-columns: minmax(280px, .36fr) minmax(0, .64fr) !important;
            grid-template-rows: minmax(0, 1fr) !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro {
            max-height: 100svh;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro {
            grid-column: 1;
            align-self: stretch;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
            grid-column: 2;
          }
          .epantry-recipe-detail .epantry-recipe-guide {
            grid-template-columns: minmax(280px,.36fr) minmax(0,.64fr) !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro {
            grid-column: 1;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] {
            grid-column: 2;
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important;
            min-height: 100svh !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            padding: 32px clamp(24px,5vw,52px) 42px !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info h1 {
            font-size: 48px !important;
            margin-top: 18px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro,
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro {
            padding: 34px clamp(24px,5vw,52px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child {
            flex-direction: row !important;
            flex-wrap: wrap;
            align-items: center !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child > :is(button,a) {
            width: auto;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
            padding: 30px clamp(24px,5vw,52px) 46px !important;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100svh !important;
            min-height: 100svh !important;
            max-height: none !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info {
            padding: 27px 20px 36px !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info h1 {
            font-size: clamp(34px,9.5vw,48px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info .epantry-recipe-metrics {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            margin-top: 24px !important;
          }
          .epantry-recipe-detail .epantry-recipe-mobile-info > div:nth-last-child(2) {
            padding: 14px 0 !important;
            border: 0 !important;
            border-top: 2px solid var(--rd-clay) !important;
            background: transparent !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients h2,
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro h2 {
            font-size: clamp(25px,7vw,32px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro,
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro {
            padding: 24px 20px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro {
            max-height: 42svh;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
            padding: 22px 18px 34px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-body .epantry-recipe-servings {
            align-items: center;
            gap: 8px;
          }
          .epantry-recipe-detail .epantry-recipe-servings > div:last-child button {
            width: 34px !important;
            height: 34px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            grid-template-columns: 28px minmax(0,1fr) !important;
            gap: 10px !important;
            padding: 14px 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child {
            grid-column: 2 !important;
            justify-self: stretch;
            justify-content: flex-start !important;
            flex-wrap: wrap;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:first-child {
            width: 28px;
            height: 28px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list button {
            min-height: 40px !important;
            font-size: 13px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > div:first-child {
            padding: 18px 20px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > summary {
            padding: 18px 20px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > details > div {
            padding: 18px 20px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related > section {
            padding: 30px 18px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a > div:last-child {
            padding: 14px 12px 16px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a h3 {
            font-size: 16px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-recipe-detail .epantry-recipe-related > section > div:last-child > div > a {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>

      <style>{`
        /* Targeted refinement: only the hero's three intro text nodes move.
           Metrics, version link, photo and layout retain their positions. */
        @media (min-width: 1024px) and (min-height: 720px) {
          .epantry-recipe-detail .epantry-recipe-desktop-info > .recipe-edition-eyebrow,
          .epantry-recipe-detail .epantry-recipe-desktop-info > h1,
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            transform: translateY(clamp(-88px, -8svh, -48px));
          }
        }
        @media (min-width: 1024px) and (max-height: 719px) {
          .epantry-recipe-detail .epantry-recipe-desktop-info > .recipe-edition-eyebrow,
          .epantry-recipe-detail .epantry-recipe-desktop-info > h1,
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            transform: translateY(-20px);
          }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .epantry-recipe-detail .epantry-recipe-desktop-info > .recipe-edition-eyebrow,
          .epantry-recipe-detail .epantry-recipe-desktop-info > h1,
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            transform: translateY(-12px);
          }
        }

        /* 01 — right-side preparation canvas only. Left editorial rail and
           viewport-limited native scroll remain exactly as implemented. */
        .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
          background: #FCFCF9 !important;
          padding-top: clamp(22px, 2.8vw, 42px) !important;
        }
        .epantry-recipe-detail .epantry-prep-list-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px 18px;
          padding: 0 0 17px;
          border-bottom: 1px solid rgba(23,63,53,.22);
        }
        .epantry-recipe-detail .epantry-prep-list-heading p {
          color: #9E6044;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          line-height: 1.45;
        }
        .epantry-recipe-detail .epantry-prep-list-heading h3 {
          margin-top: 6px;
          color: var(--rd-forest);
          font-size: clamp(22px, 2.2vw, 30px);
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -.035em;
        }
        .epantry-recipe-detail .epantry-prep-list-heading > span {
          padding-bottom: 4px;
          font-size: 14px;
          font-weight: 600;
          color: var(--rd-forest);
          white-space: nowrap;
        }
        .epantry-recipe-detail .epantry-recipe-ingredients-body .epantry-recipe-servings {
          margin-top: 16px !important;
          padding: 15px clamp(14px, 1.8vw, 25px) !important;
          border: 0 !important;
          border-left: 4px solid var(--rd-clay) !important;
          background: #E8EEE4 !important;
          min-height: 80px;
          gap: 12px;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child {
          background: #FCFCF9 !important;
          border: 1px solid #BFCDBF !important;
          border-radius: 6px !important;
          padding: 4px !important;
          flex-shrink: 0;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child button,
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child p {
          color: var(--rd-forest) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child button:hover {
          background: #DCE7D9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list {
          margin-top: 18px !important;
          border-top: 1px solid rgba(23,63,53,.28) !important;
          border-bottom: 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          padding: 18px clamp(8px, 1vw, 16px) !important;
          border-bottom: 1px solid rgba(23,63,53,.14) !important;
          transition: background-color .2s ease;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(2n) {
          background: #F2F5EF !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:hover {
          background: #EAF1E8 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:first-child {
          background: #DCE7DC !important;
          color: #173F35 !important;
          border-radius: 50% !important;
          width: 32px;
          height: 32px;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list h3 {
          color: #202421 !important;
          font-size: 16px !important;
          line-height: 1.4 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child > span {
          background: #E4E9DD !important;
          color: var(--rd-forest) !important;
          border-radius: 5px !important;
          font-variant-numeric: tabular-nums;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button {
          border-radius: 6px !important;
          min-height: 40px !important;
          line-height: 1.3 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button:first-of-type:not(:disabled) {
          border-color: #E9BDAF !important;
          background: #FCF0EC !important;
          color: #9E433E !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list button:first-of-type:not(:disabled):hover {
          background: #F7DDD5 !important;
        }
        .epantry-recipe-detail .epantry-recipe-checkout-note {
          margin-top: 22px !important;
          border-top: 1px solid rgba(23,63,53,.2) !important;
          color: #46574C;
        }

        /* 02 — only the right reading column, its overview and its TWO
           cooking accordions. Food Intelligence slots remain untouched. */
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] {
          background: #FCFCF9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide-overview {
          padding: clamp(20px, 2.6vw, 36px) clamp(18px, 3vw, 46px) !important;
          background: #E7EDE4 !important;
          border-top: 4px solid #C86C42 !important;
          border-bottom: 1px solid rgba(23,63,53,.2) !important;
          gap: 20px 12px !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide-overview > .epantry-guide-metric {
          border: 0 !important;
          border-left: 1px solid rgba(23,63,53,.25) !important;
          padding: 3px 10px 2px clamp(10px, 1.5vw, 22px) !important;
        }
        .epantry-recipe-detail .epantry-guide-metric p:first-child {
          color: #586D5C !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          letter-spacing: .055em !important;
        }
        .epantry-recipe-detail .epantry-guide-metric p:last-child {
          margin-top: 9px !important;
          color: var(--rd-forest) !important;
          font-size: clamp(17px, 1.7vw, 23px) !important;
          font-weight: 600 !important;
          line-height: 1.25 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion {
          border: 0 !important;
          border-bottom: 1px solid rgba(23,63,53,.2) !important;
          background: #FCFCF9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 82px;
          padding: 18px clamp(18px, 3vw, 46px) !important;
          background: #FCFCF9 !important;
          border-left: 0 !important;
          transition: background-color .2s ease;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion:first-of-type > summary::before {
          content: '01';
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion:nth-of-type(2) > summary::before {
          content: '02';
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary::before {
          flex: none;
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border: 1px solid #CAD7CB;
          border-radius: 50%;
          background: #E7EEE5;
          color: #173F35;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary:hover,
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion[open] > summary {
          background: #E8F0E7 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary span:first-child {
          flex: 1;
          color: #173F35 !important;
          font-size: clamp(17px, 1.7vw, 21px) !important;
          font-weight: 600 !important;
          line-height: 1.35 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > div {
          padding: clamp(18px, 2.4vw, 32px) clamp(18px, 3vw, 46px) !important;
          background: #F3F5EE !important;
          border-top: 1px solid rgba(23,63,53,.18) !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion ol li {
          padding: 18px 0 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion ol li > div:first-child {
          border: 1px solid #AFC3B0 !important;
          background: #DFEADD !important;
          color: #173F35 !important;
          border-radius: 50% !important;
        }
        @media (min-width: 1440px) {
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            min-height: 118px;
          }
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-prep-list-heading h3 {
            font-size: 22px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-body .epantry-recipe-servings {
            padding: 12px !important;
            gap: 8px;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            padding: 14px 8px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide-overview {
            padding: 20px 18px !important;
            gap: 18px 12px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary {
            min-height: 70px;
            padding: 16px 18px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > div {
            padding: 18px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div,
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary {
            transition: none !important;
          }
        }
        /* PHASE 3: Targeted two-column refresh. Senior reference palette:
           porcelain + peach for preparation; blue + lavender for guide.
           The existing sage editorial side rails and global UI stay intact. */
        .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
          height: 100% !important;
          box-sizing: border-box;
          overflow: hidden !important;
          padding-bottom: 0 !important;
          background: #FFF9F5 !important;
        }
        .epantry-recipe-detail .epantry-prep-list-heading {
          flex: none;
          align-items: center;
          padding-bottom: 15px !important;
          border-bottom: 1px solid #DFBCAC !important;
        }
        .epantry-recipe-detail .epantry-prep-list-heading p {
          color: #98583F !important;
        }
        .epantry-recipe-detail .epantry-prep-list-heading h3 {
          color: #173F35 !important;
        }
        .epantry-recipe-detail .epantry-prep-list-heading > span {
          color: #785C52 !important;
        }
        /* Servings remains OUTSIDE the scroll area on all screen sizes. */
        .epantry-recipe-detail .epantry-recipe-ingredients-body > .epantry-recipe-servings {
          flex: none !important;
          margin-top: 16px !important;
          margin-bottom: 0 !important;
          min-height: 74px;
          border: 0 !important;
          border-left: 4px solid #C86C42 !important;
          border-radius: 7px !important;
          background: #FFE0CF !important;
          padding: 12px clamp(13px,1.6vw,22px) !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child {
          background: #FFFCF9 !important;
          border: 1px solid #E3AE96 !important;
          border-radius: 7px !important;
        }
        .epantry-recipe-detail .epantry-recipe-servings > div:last-child button:hover {
          background: #FFE9DD !important;
        }
        .epantry-recipe-detail .epantry-prep-scroll {
          min-height: 0;
          min-width: 0;
          flex: 1 1 auto;
          overflow-x: hidden;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #C58D74 #FFF0E7;
          scrollbar-gutter: stable;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: auto;
          scroll-padding-block: 15px;
          margin: 14px -8px 0 0;
          padding: 0 8px 30px 0;
        }
        .epantry-recipe-detail .epantry-prep-scroll::-webkit-scrollbar { width: 9px; }
        .epantry-recipe-detail .epantry-prep-scroll::-webkit-scrollbar-track { background: #FFF0E7; }
        .epantry-recipe-detail .epantry-prep-scroll::-webkit-scrollbar-thumb {
          background: #C58D74;
          border: 2px solid #FFF0E7;
          border-radius: 999px;
        }
        .epantry-recipe-detail .epantry-prep-scroll:focus-visible {
          outline: 2px solid #C86C42;
          outline-offset: -2px;
        }
        .epantry-recipe-detail .epantry-prep-scroll > .epantry-recipe-ingredient-list {
          display: block;
          flex: none !important;
          margin-top: 16px !important;
          border: 0 !important;
          border-top: 1px solid #E8CABB !important;
          border-radius: 0 !important;
          background: transparent !important;
          overflow: visible !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
          min-height: 0 !important;
          border-bottom: 1px solid #EBD6CD !important;
          padding: 15px clamp(7px,1.3vw,19px) !important;
          background: #FFFCF9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
          background: #FFF1E8 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div:hover {
          background: #FFE8DB !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:first-child {
          background: #F6D5C3 !important;
          color: #75412F !important;
          border: 1px solid #EBC0AB !important;
          border-radius: 7px !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > div:last-child > span {
          background: #F5E9DF !important;
          color: #173F35 !important;
        }
        .epantry-recipe-detail .epantry-prep-scroll > .epantry-recipe-checkout-note,
        .epantry-recipe-detail .epantry-prep-scroll > .epantry-recipe-access-note {
          border-top: 1px solid #E8CABB !important;
        }
        /* Right-side recipe guide: shared accordion treatment from 01 to 06;
           Food Intelligence content is still supplied by the existing portals. */
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] {
          background: #F8FAFD !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide-overview {
          background: #DDEEFF !important;
          border-top: 3px solid #8473BA !important;
          border-bottom: 1px solid #BBCFE5 !important;
          padding: clamp(19px,2.5vw,30px) clamp(18px,3vw,46px) !important;
          gap: 16px 10px !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide-overview > .epantry-guide-metric {
          border-left: 2px solid #8473BA !important;
        }
        .epantry-recipe-detail .epantry-guide-metric p:first-child { color: #4B5873 !important; }
        .epantry-recipe-detail .epantry-guide-metric p:last-child { color: #173F35 !important; }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details,
        .epantry-recipe-detail .epantry-intelligence-fallback {
          margin: 0 !important;
          border: 0 !important;
          border-bottom: 1px solid #C9C5DD !important;
          border-radius: 0 !important;
          background: #F8FAFD !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 14px !important;
          min-height: 72px !important;
          padding: 17px clamp(18px,3vw,46px) !important;
          border: 0 !important;
          border-left: 3px solid transparent !important;
          border-radius: 0 !important;
          background: #E9E1FF !important;
          background-image: none !important;
          transition: background-color .2s ease, border-color .2s ease;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary:hover,
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion[open] > summary,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary:hover,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details[open] > summary,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary:hover,
        .epantry-recipe-detail .epantry-intelligence-fallback[open] > summary {
          border-left-color: #8473BA !important;
          background: #DDD2FA !important;
          background-image: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary span:first-child,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary span:first-child,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary span:first-child {
          flex: 1 1 auto !important;
          font-family: inherit !important;
          color: #173F35 !important;
          font-size: clamp(16px,1.4vw,19px) !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion:nth-of-type(1) { --rd-guide-index: '01'; }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion:nth-of-type(2) { --rd-guide-index: '02'; }
        .epantry-recipe-detail #recipe-nutrition-intelligence-slot { --rd-guide-index: '03'; }
        .epantry-recipe-detail #recipe-allergen-intelligence-slot { --rd-guide-index: '04'; }
        .epantry-recipe-detail #recipe-dietary-intelligence-slot { --rd-guide-index: '05'; }
        .epantry-recipe-detail #recipe-lineage-intelligence-slot { --rd-guide-index: '06'; }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary::before,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary::before,
        .epantry-recipe-detail .epantry-intelligence-fallback > summary::before {
          content: var(--rd-guide-index, '') !important;
          display: grid !important;
          place-items: center !important;
          flex: 0 0 36px !important;
          width: 36px !important;
          height: 36px !important;
          border: 1px solid #B9ACDE !important;
          border-radius: 8px !important;
          background: #F8F4FF !important;
          color: #564585 !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          letter-spacing: .01em !important;
          font-variant-numeric: tabular-nums;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > div,
        .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div,
        .epantry-recipe-detail .epantry-intelligence-fallback-content {
          padding: clamp(17px,2.4vw,29px) clamp(18px,3vw,46px) !important;
          border-top: 1px solid #D4CCE6 !important;
          background: #F8F7FC !important;
          background-image: none !important;
          color: #202421 !important;
          box-shadow: none !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence {
          background: #F8FAFD !important;
        }
        .epantry-recipe-detail .epantry-recipe-intelligence-slot {
          overflow: visible !important;
          background: #F8FAFD !important;
        }
        .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion ol li > div:first-child {
          border: 1px solid #B9ACDE !important;
          border-radius: 8px !important;
          background: #E9E1FF !important;
          color: #564585 !important;
        }
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
            padding-bottom: 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-body > .epantry-recipe-servings {
            margin-top: 12px !important;
            min-height: 66px;
            padding: 11px !important;
          }
          .epantry-recipe-detail .epantry-prep-scroll { margin-top: 10px; }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
          .epantry-recipe-detail .epantry-intelligence-fallback > summary {
            min-height: 65px !important;
            gap: 10px !important;
            padding: 14px 15px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary::before,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary::before,
          .epantry-recipe-detail .epantry-intelligence-fallback > summary::before {
            flex-basis: 31px !important;
            width: 31px !important;
            height: 31px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > div,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > div,
          .epantry-recipe-detail .epantry-intelligence-fallback-content {
            padding: 16px 15px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div,
          .epantry-recipe-detail .epantry-recipe-guide [data-recipe-guide-scroll] > .epantry-guide-accordion > summary,
          .epantry-recipe-detail .epantry-recipe-intelligence-slot > details > summary,
          .epantry-recipe-detail .epantry-intelligence-fallback > summary {
            transition: none !important;
          }
        }
      `}</style>

      <style>{`
        /* Recipe hero: fit the first desktop fold below the fixed/sticky header
           and Recipes breadcrumb. Let unusually long content grow naturally. */
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-hero-grid {
            --ep-recipe-fold: calc(100svh - 126px);
            min-height: var(--ep-recipe-fold) !important;
            grid-template-rows: minmax(var(--ep-recipe-fold), auto) !important;
          }
          .epantry-recipe-detail .epantry-recipe-photo {
            height: 100% !important;
            min-height: 0 !important;
            align-self: stretch;
          }
          .epantry-recipe-detail .epantry-recipe-photo > img {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info {
            min-height: 0 !important;
            align-self: stretch;
            padding-top: clamp(22px, 3.2vh, 38px) !important;
            padding-bottom: clamp(22px, 3.2vh, 38px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info h1 {
            margin-top: clamp(14px, 2vh, 22px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info > p:not(.recipe-edition-eyebrow) {
            margin-top: clamp(12px, 1.8vh, 20px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info .epantry-recipe-metrics {
            margin-top: clamp(20px, 3.4vh, 34px) !important;
          }
          .epantry-recipe-detail .epantry-recipe-desktop-info .epantry-recipe-metric {
            padding-top: clamp(10px, 1.45vh, 15px) !important;
            padding-bottom: clamp(10px, 1.45vh, 15px) !important;
          }
        }
      `}</style>

      <style>{`
        /* Requested recipe prep refinements; other sections remain unchanged. */
        @media (min-width: 1024px) {
          .epantry-recipe-detail .epantry-recipe-ingredients {
            height: 100svh !important;
            min-height: 100svh !important;
            max-height: 100svh !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro {
            max-height: 100svh !important;
            overflow: hidden !important;
          }
          .epantry-recipe-detail .epantry-recipe-cart-preview {
            display: flex !important;
            flex: 1 1 auto;
            align-items: center;
            justify-content: center;
            min-height: 0;
            width: 100%;
            overflow: hidden;
          }
          .epantry-recipe-detail .epantry-recipe-cart-preview img {
            display: block;
            width: 100%;
            height: 100%;
            max-height: 100%;
            object-fit: contain;
            object-position: center;
          }
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > .epantry-prep-index--white {
          background: #FFFFFF !important;
          color: #173F35 !important;
          border-color: #E3CABB !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div > .epantry-prep-index--clay {
          background: #C86C42 !important;
          color: #FFFFFF !important;
          border-color: #C86C42 !important;
        }
        /* Restore original Prep list layout; only alternating row colours vary. */
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--white {
          background: #FFFCF9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--clay {
          background: #EAB89C !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--white:hover {
          background: #FFF2E9 !important;
        }
        .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--clay:hover {
          background: #E3AC8D !important;
        }
      `}</style>

      <style>{`
        /* Mobile-only: the preparation chapter scrolls naturally instead of
           trapping a full viewport of ingredients behind a nested scroller. */
        @media (max-width: 639px) {
          .epantry-recipe-detail .epantry-recipe-ingredients {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            grid-template-rows: auto auto !important;
            overflow: visible !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-intro {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            gap: 10px !important;
            padding: 16px 16px 14px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients h2 {
            margin-top: 8px !important;
            line-height: 1.16 !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child {
            gap: 5px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child > span {
            padding: 3px 0 !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-intro > div:last-child > :is(button, a) {
            min-height: 40px !important;
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients > .epantry-recipe-ingredients-body {
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 14px 16px 16px !important;
          }
          .epantry-recipe-detail .epantry-prep-list-heading {
            padding-bottom: 10px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredients-body > .epantry-recipe-servings {
            margin-top: 10px !important;
            min-height: 0 !important;
            padding: 9px 10px !important;
          }
          .epantry-recipe-detail .epantry-prep-scroll {
            flex: 0 0 auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            scrollbar-gutter: auto !important;
            margin: 8px 0 0 !important;
            padding: 0 0 8px !important;
          }
          .epantry-recipe-detail .epantry-prep-scroll > .epantry-recipe-ingredient-list {
            margin-top: 8px !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div {
            gap: 6px 9px !important;
            padding: 10px 8px !important;
          }
          /* Plain white ingredient rows on mobile, regardless of desktop's
             alternating clay/white pattern. Preserve the existing buttons. */
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--white,
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--clay,
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div:nth-child(even) {
            background: #FFFFFF !important;
          }
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--white:hover,
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div.epantry-prep-row--clay:hover,
          .epantry-recipe-detail .epantry-recipe-ingredient-list > div:hover {
            background: #F7F6F2 !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro {
            padding: 18px 16px !important;
          }
          .epantry-recipe-detail .epantry-recipe-guide > .epantry-recipe-guide-intro h2 {
            margin-top: 8px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related {
            margin-top: 18px !important;
            padding: 18px 16px !important;
            row-gap: 22px !important;
          }
          .epantry-recipe-detail .epantry-recipe-related > section {
            padding: 18px 0 !important;
          }
        }
      `}</style>

      <div className="page-shell pb-10 pt-5 sm:pb-16 sm:pt-7">

        <Link
          to="/recipes"
          className="focus-ring mb-3 inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-semibold text-[#173F35] transition hover:text-[#C86C42]"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Recipes
        </Link>

        <div className="epantry-recipe-hero mt-2 overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2]">

          <div className="epantry-recipe-hero-grid grid gap-0 lg:grid-cols-[minmax(0,1.16fr)_minmax(0,0.84fr)]">

            <div className="epantry-recipe-photo relative h-[38svh] min-h-[290px] overflow-hidden bg-[#DCE0CF] sm:m-4 sm:h-[480px] sm:rounded-[12px] lg:m-5 lg:mr-0 lg:h-[540px]">

              <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full border border-white/60 bg-white/90 p-1 shadow-sm backdrop-blur-md sm:right-3 sm:top-3">
                <button
                  type="button"
                  onClick={() =>
                    setRecipeHeroView(
                      'photo',
                    )
                  }
                  className={[
                    'focus-ring rounded-full px-3 py-1.5 text-[13px] font-semibold transition',
                    recipeHeroView ===
                    'photo'
                      ? 'bg-[#173F35] text-white'
                      : 'text-[#202421]/80 hover:bg-[#DCE0CF]/50',
                  ].join(
                    ' ',
                  )}
                >
                  Photo
                </button>
                {data?.hostSubmission?.videoUrl ? (
                  <button
                    type="button"
                    onClick={() => setRecipeHeroView('video')}
                    className={[
                      'focus-ring rounded-full px-3 py-1.5 text-[13px] font-semibold transition',
                      recipeHeroView === 'video'
                        ? 'bg-[#173F35] text-white'
                        : 'text-[#202421]/80 hover:bg-[#DCE0CF]/50',
                    ].join(' ')}
                  >
                    Video
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setRecipeHeroView(
                      'details',
                    )
                  }
                  className={[
                    'focus-ring rounded-full px-3 py-1.5 text-[13px] font-semibold transition',
                    recipeHeroView ===
                    'details'
                      ? 'bg-[#173F35] text-white'
                      : 'text-[#202421]/80 hover:bg-[#DCE0CF]/50',
                  ].join(
                    ' ',
                  )}
                >
                  Details
                </button>
              </div>

              {recipeHeroView === 'photo' && (dish.course || dish.cuisine) ? (
                <div className="epantry-recipe-photo-caption" aria-hidden="true">
                  {dish.cuisine ? <span>{dish.cuisine}</span> : null}
                  {dish.course ? <span>{dish.course}</span> : null}
                </div>
              ) : null}

              {recipeHeroView === 'video' && data?.hostSubmission?.videoUrl ? (
                <video
                  key={data.hostSubmission.videoUrl}
                  src={data.hostSubmission.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-[#173F35] object-contain"
                  aria-label={`${dish.name || 'Recipe'} preparation video`}
                />
              ) : recipeHeroView ===
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
                  discoveryOrigin={recipeDiscovery?.origin}
                />
              ) : dish.heroImageUrl ? (
                <img
                  src={
                    dish.heroImageUrl
                  }
                  alt={
                    dish.name
                  }
                  className="h-full w-full object-cover transition-transform duration-500 motion-safe:hover:scale-[1.015]"
                />
              ) : (
                <div className="grid h-full min-h-[320px] place-items-center">

                  <div className="grid h-28 w-28 place-items-center rounded-[36px] bg-white/80 text-[#173F35] shadow-sm">
                    <ChefHat
                      size={52}
                      aria-hidden="true"
                    />
                  </div>

                </div>
              )}

            </div>

            <div className="epantry-recipe-mobile-info px-5 pb-6 pt-5 sm:hidden">

              <p className="recipe-edition-eyebrow mb-3">
                {dish.cuisine || 'EPANTRY Recipe'}
              </p>
              <div className="flex items-start justify-between gap-3">
                <h1 className="min-w-0 text-[36px] font-semibold leading-[1.15] tracking-[-0.045em] text-[#202421]">
                  {dish.name || recipe.title}
                </h1>

                {recipeDietaryBadge ? (
                  <span
                    className={[
                      'mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[13px] font-semibold uppercase tracking-[0.08em]',
                      recipeDietaryBadge.kind === 'veg'
                        ? 'border-lime-200 bg-lime-100 text-lime-900'
                        : 'border-rose-200 bg-rose-100 text-rose-900',
                    ].join(' ')}
                  >
                    {recipeDietaryBadge.label}
                  </span>
                ) : null}
              </div>

              <RecipeLocalNames origin={recipeDiscovery?.origin} />

              <div className="epantry-recipe-metrics mt-5 grid grid-cols-3 gap-x-3 gap-y-2">
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
                    className="epantry-recipe-metric min-w-0 border-b border-[#DCE0CF] py-3"
                  >
                    <p className="text-[13px] font-semibold uppercase leading-[1.4] tracking-[0.08em] text-[#173F35]/80">
                      {label}
                    </p>
                    <p className="mt-1 break-words text-[14px] font-semibold leading-[1.15] capitalize text-[#202421]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-l-[3px] border-[#C86C42] bg-[#DCE0CF]/40 px-4 py-3">
                <p className="text-[14px] font-semibold text-[#173F35]">
                  About this recipe
                </p>
                <p className="mt-1.5 text-[14px] font-medium leading-[1.55] text-[#202421]/80">
                  {recipe.description || dish.description}
                </p>
              </div>

              {!hostListingMode && <Link
                to={`/recipes/${dish.slug}/history`}
                className="focus-ring mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#DCE0CF] bg-white px-2.5 py-1 text-[13px] font-semibold text-[#202421]/80 transition hover:bg-[#F7F6F2] hover:text-[#202421]"
              >
                <History
                  size={13}
                  aria-hidden="true"
                />
                Version history
              </Link>}

            </div>

            <div className="epantry-recipe-desktop-info hidden flex-col justify-center bg-[#DCE0CF] px-6 py-8 sm:flex lg:px-9 lg:py-10">

              <p className="recipe-edition-eyebrow">
                {dish.cuisine || 'EPANTRY Recipe'}
              </p>
              <h1 className="text-[36px] font-semibold leading-[1.12] tracking-[-0.04em] text-[#202421] lg:text-[56px] lg:leading-[1.14]">
                {dish.name || recipe.title}
              </h1>
              <RecipeLocalNames origin={recipeDiscovery?.origin} />

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#202421]/80 sm:mt-3 sm:text-base sm:leading-7">
                {recipe.description || dish.description}
              </p>

              <div className="epantry-recipe-metrics mt-7 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3">
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
                    className="epantry-recipe-metric min-w-0 border-b border-[#DCE0CF] px-0 py-3"
                  >
                    <p className="truncate text-[13px] font-semibold uppercase tracking-[0.09em] text-[#173F35]/65">
                      {label}
                    </p>
                    <p className="mt-1.5 truncate text-base font-semibold capitalize text-[#202421]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {!hostListingMode && <Link
                to={`/recipes/${dish.slug}/history`}
                className="focus-ring mt-3 inline-flex self-end items-center gap-1.5 rounded-full border border-[#DCE0CF] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#202421]/80 transition hover:bg-[#F7F6F2] hover:text-[#202421]"
              >
                <History
                  size={15}
                  aria-hidden="true"
                />
                Version history
              </Link>}

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

        {isRestaurantRecipe ? (
          <section className="epantry-recipe-restaurant mt-8 overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-[#DCE0CF]/60">
            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-[#C86C42]/40 bg-white/65 px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#173F35]">
                  Restaurant Recipe
                </span>

                <h2 className="mt-3 font-sans text-2xl font-semibold tracking-[-0.03em] text-[#202421] sm:text-3xl">
                  From {restaurant?.restaurantName || 'Restaurant'}
                </h2>

                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-[#202421]">
                  <MapPin
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-[#173F35]"
                  />
                  <span>
                    {restaurant?.outletName || 'Restaurant outlet'}
                  </span>
                </div>

                <p className="mt-3 max-w-2xl text-xs font-semibold leading-5 text-[#202421]">
                  Adjust people below. Recipe ingredient quantities and the prepared-dish order price update together.
                </p>
              </div>

              <div className="rounded-[22px] border border-[#C86C42]/30 bg-white/75 p-3 shadow-sm backdrop-blur sm:min-w-[360px] sm:p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[#F7F6F2] px-3 py-3">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35]/65">
                      Per serving
                    </p>
                    <p className="mt-1 text-base font-semibold text-[#202421]">
                      {restaurantOrder?.available === true
                        ? formatMoney(restaurantOrder.pricePerServing)
                        : 'Not available'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#DCE0CF] px-3 py-3">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35]/65">
                      Total for {servings}
                    </p>
                    <p className="mt-1 text-base font-semibold text-[#173F35]">
                      {scaling || !restaurantOrderPriceCurrent
                        ? 'Updating…'
                        : restaurantOrder?.available === true
                          ? formatMoney(restaurantOrder.totalPrice)
                          : 'Not available'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div className="flex shrink-0 items-center rounded-xl border border-[#C86C42]/40 bg-white p-1">
                    <button
                      type="button"
                      onClick={() =>
                        setServings((current) =>
                          Math.max(1, current - 1),
                        )
                      }
                      disabled={servings <= 1 || restaurantOrderSubmitting}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-[#173F35] transition hover:bg-[#F7F6F2] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Decrease Restaurant order servings"
                    >
                      <Minus
                        size={16}
                        aria-hidden="true"
                      />
                    </button>

                    <div className="min-w-12 text-center">
                      <p className="text-sm font-semibold text-[#202421]">
                        {servings}
                      </p>
                      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#173F35]/65">
                        people
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setServings((current) =>
                          Math.min(1000, current + 1),
                        )
                      }
                      disabled={restaurantOrderSubmitting}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-[#173F35] transition hover:bg-[#F7F6F2] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Increase Restaurant order servings"
                    >
                      <Plus
                        size={16}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleDirectRestaurantOrder()
                    }
                    disabled={
                      restaurantOrderSubmitting ||
                      scaling ||
                      !restaurantOrderPriceCurrent ||
                      restaurantOrder?.available !== true
                    }
                    className="focus-ring inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 py-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(23,63,53,0.15)] transition hover:bg-[#202421] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {restaurantOrderSubmitting ? (
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShoppingCart
                        size={16}
                        aria-hidden="true"
                      />
                    )}
                    {restaurantOrderSubmitting
                      ? 'Starting order…'
                      : 'Order prepared dish'}
                  </button>
                </div>

                {restaurantOrder?.available !== true ? (
                  <p className="mt-2 text-[13px] font-bold leading-4 text-[#202421]">
                    Direct ordering becomes available when this approved dish has an active Restaurant menu price.
                  </p>
                ) : null}

                {restaurantOrderError ? (
                  <div
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-bold leading-4 text-red-800"
                  >
                    {restaurantOrderError}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {recipeDiscovery?.origin?.country ? (
          <section className="epantry-origin-chapter mt-8 grid gap-5 border-y border-[#DCE0CF] bg-[#F1F3EB] px-4 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8" aria-label="Verified recipe origin">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#C86C42]">From its roots</p>
              <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[#173F35] sm:text-[34px]">Origin & tradition</h2>
              <p className="mt-2 text-[16px] font-medium text-[#202421]">
                {recipeDiscovery.origin.country.name}
                {recipeDiscovery.origin.region?.name ? ` · ${recipeDiscovery.origin.region.name}` : ''}
              </p>
              <p className="mt-3 max-w-prose text-[13px] leading-6 text-[#202421]/75">
                Source-reported origin, not an EPANTRY popularity ranking.
              </p>
              {recipeDiscovery.origin.sourceUrl ? (
                <a href={recipeDiscovery.origin.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[13px] font-semibold text-[#173F35] underline decoration-[#C86C42] underline-offset-4">Verify origin on Wikidata</a>
              ) : null}
            </div>
            <RecipeOriginMap origin={recipeDiscovery.origin} map={recipeDiscovery.map} />
          </section>
        ) : null}

        <div className="epantry-recipe-workspace mt-8 flex flex-col gap-8">

          <section
            className="epantry-recipe-ingredients relative order-1 min-w-0 rounded-[16px] border border-[#DCE0CF] bg-[#F7F6F2] p-4 sm:p-6 lg:flex lg:flex-col"
          >

            <div className="epantry-recipe-ingredients-intro flex shrink-0 flex-col gap-2 border-b border-[#DCE0CF] pb-2 sm:gap-3 sm:pb-3 xl:flex-row xl:items-start xl:justify-between">

              <div className="max-w-xl">

                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE0CF] bg-[#DCE0CF]/55 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35] sm:gap-2 sm:px-3 sm:py-1 sm:text-[13px] sm:font-semibold sm:tracking-[0.16em]">
                  <ShieldCheck
                    size={13}
                    aria-hidden="true"
                  />
                  <span className="sm:hidden">Ingredients · Living Pantry</span>
                  <span className="hidden sm:inline">01 / Ingredients + your Living Pantry</span>
                </div>

                <h2 className="mt-2 text-[24px] font-semibold leading-[1.25] tracking-[-0.03em] text-[#173F35] sm:text-[32px] sm:font-semibold sm:tracking-tight">
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
                      className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#173F35] px-3 py-2 text-[14px] font-semibold text-[#F7F6F2] transition hover:bg-[#173F35] disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
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
                      className="focus-ring min-h-10 whitespace-nowrap sm:whitespace-normal rounded-lg border border-[#DCE0CF] bg-[#DCE0CF]/55 px-3 py-2 text-[14px] font-semibold text-[#173F35] transition hover:bg-[#DCE0CF] sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm sm:font-semibold"
                    >
                      Open Living Pantry →
                    </Link>
                  </>
                )}

                <span className="whitespace-nowrap sm:whitespace-normal rounded-full bg-[#DCE0CF]/50 px-1.5 py-1 text-[13px] font-semibold text-[#202421]/80 sm:px-3 sm:py-1.5 sm:text-sm sm:font-bold">
                  {ingredientRows.length} items
                </span>

              </div>

              {shoppingTray.length > 0 ? (
                <div className="epantry-recipe-cart-preview hidden lg:flex" aria-live="polite">
                  <img
                    src="/video/cart.png"
                    alt="EPANTRY Recipe Cart with selected ingredients"
                    loading="lazy"
                    draggable="false"
                  />
                </div>
              ) : null}

            </div>


            <div className="epantry-recipe-ingredients-body">
              <div className="epantry-prep-list-heading">
                <div>
                  <p>Prep list</p>
                  <h3>Your ingredients</h3>
                </div>
                <span>{ingredientRows.length} ingredients</span>
              </div>
            <div className="epantry-recipe-servings mt-4 flex shrink-0 items-center justify-between gap-2 rounded-xl border border-[#DCE0CF] bg-[#DCE0CF]/65 px-3 py-3 sm:mt-5 sm:gap-4 sm:px-4">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#173F35] sm:text-[13px] sm:font-semibold sm:tracking-[0.14em]">
                  Servings
                </p>
                <p className="text-[13px] font-medium leading-tight text-[#202421]/70 sm:mt-0.5 sm:text-[13px] sm:font-semibold sm:leading-normal">
                  <span className="sm:hidden">Quantities adjust with servings.</span>
                  <span className="hidden sm:inline">Ingredient quantities update automatically.</span>
                </p>
              </div>

              <div className="flex items-center gap-0.5 rounded-lg border border-[#DCE0CF] bg-white p-0.5 sm:gap-1 sm:rounded-xl sm:p-1">
                <button
                  type="button"
                  onClick={() =>
                    setServings((current) =>
                      Math.max(1, current - 1),
                    )
                  }
                  disabled={servings <= 1}
                  className="focus-ring grid h-7 w-7 place-items-center rounded-md text-[#173F35] transition hover:bg-[#DCE0CF]/55 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 sm:rounded-lg"
                  aria-label="Decrease servings"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>

                <div className="min-w-8 text-center sm:min-w-11">
                  <p className="text-xs font-semibold text-[#202421] sm:text-sm">
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
                  className="focus-ring grid h-7 w-7 place-items-center rounded-md text-[#173F35] transition hover:bg-[#DCE0CF]/55 sm:h-8 sm:w-8 sm:rounded-lg"
                  aria-label="Increase servings"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div
              className="epantry-prep-scroll"
              tabIndex={0}
              role="region"
              aria-label="Scrollable ingredient checklist and Living Pantry actions"
            >
            {scaling && (
              <p className="mt-2 text-[13px] font-bold text-[#173F35]">
                Recalculating quantities...
              </p>
            )}

            {!canUseCustomerFeatures && (
              <div className="epantry-recipe-access-note mt-5 rounded-2xl border border-[#DCE0CF] bg-[#F7F6F2] p-4 text-xs font-semibold leading-5 text-[#202421]/80">
                {hostListingMode
                  ? 'This is a Super Admin-approved Host submission. Ingredient quantities are Host-declared; Living Pantry matching and shopping require a separately published canonical EPANTRY recipe.'
                  : customerContextBlocked
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
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-[#DCE0CF] bg-[#DCE0CF]/55 px-4 py-3 text-xs font-semibold leading-5 text-[#173F35]">
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
              className="epantry-recipe-ingredient-list mt-4 min-h-0 flex-1 divide-y divide-[#DCE0CF] overflow-visible rounded-[12px] border border-[#DCE0CF] bg-[#F7F6F2]"
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
                    getRecipeIngredientCanonicalId(
                      ingredient,
                    )

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
                      ? 'bg-[#DCE0CF]/55 text-[#173F35] border-[#DCE0CF]'
                      : pantryStatus ===
                          'missing'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : pantryStatus ===
                            'partial'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-[#F7F6F2] text-[#202421]/80 border-[#DCE0CF]'

                  const haveActionKey =
                    `have-${canonicalIngredientId}`

                  const decisionLocked =
                    Boolean(
                      canonicalIngredientId &&
                      resolvedIngredientIds.has(canonicalIngredientId) &&
                      ingredientDecisionLockRef.current.has(canonicalIngredientId)
                    )

                  const prepIndexTone =
                    [0, 1].includes(Number(ingredient.lineNumber) % 4)
                      ? 'white'
                      : 'clay'

                  return (
                    <div
                      key={
                        ingredient.id ||
                        `${ingredient.lineNumber}-${ingredient.canonicalIngredientId}`
                      }
                      className={`epantry-prep-row--${prepIndexTone} grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 bg-white px-2.5 py-1.5 transition hover:bg-[#fffaf1] sm:flex sm:flex-row sm:items-center sm:gap-2 sm:px-3 sm:py-2.5`}
                    >

                      <div className={`epantry-prep-index--${prepIndexTone} grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[13px] font-semibold sm:h-8 sm:w-8 sm:text-[14px]`}>
                        {ingredient.lineNumber}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Link
                        to={`/ingredients/${encodeURIComponent(identity.id || identity.slug || identity.name || 'ingredient')}`}
                        className="group/ingredient relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#DCE0CF] bg-[#F7F6F2] text-[#173F35] transition duration-200 hover:scale-[1.05] hover:border-[#C86C42] hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#C86C42]"
                        aria-label={`Explore ${identity.name || 'ingredient'} details`}
                        title={`Explore ${identity.name || 'ingredient'}`}
                      >
                        {(ingredient.imageUrl || identity.imageUrl) ? (
                          <img src={ingredient.imageUrl || identity.imageUrl} alt={identity.name || 'Ingredient'} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover/ingredient:scale-110" />
                        ) : <Leaf size={19} aria-hidden="true" />}
                        <ArrowUpRight size={12} aria-hidden="true" className="absolute bottom-0 right-0 rounded-tl bg-white/90 text-[#C86C42]" />
                      </Link>
                          <h3 className="text-[13px] font-semibold leading-tight text-[#202421] sm:text-base sm:leading-normal">
                            {identity.name ||
                              'Canonical ingredient'}
                          </h3>

                          {canUseCustomerFeatures && (
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[13px] font-semibold uppercase tracking-[0.06em] sm:px-2.5 sm:py-1 sm:text-[13px] sm:tracking-[0.08em] ${pantryStatusClassName}`}
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
                          <p className="mt-0.5 text-[13px] leading-tight text-[#202421]/70 sm:mt-1 sm:text-sm sm:leading-normal">
                            {ingredient.preparationState}
                          </p>
                        )}

                        {ingredient.optional && (
                          <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#C86C42] sm:mt-1 sm:text-[13px] sm:tracking-[0.12em]">
                            Optional
                          </p>
                        )}
                      </div>

                      <div className="col-start-2 flex flex-wrap items-center justify-end justify-self-end gap-1.5 sm:col-start-auto sm:gap-2 sm:justify-self-auto">
                        <span className="whitespace-nowrap sm:whitespace-normal rounded-full bg-[#DCE0CF]/50 px-2 py-1.5 text-xs font-semibold text-[#202421] sm:px-3 sm:py-2 sm:text-sm">
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
                            'focus-ring inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[13px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed sm:min-w-24 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm sm:font-semibold',
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
                          className={`focus-ring inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[13px] font-semibold transition disabled:cursor-not-allowed sm:min-w-24 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm sm:font-semibold ${
                            decisionLocked
                              ? 'pointer-events-none border-[#DCE0CF] bg-[#DCE0CF]/50 text-[#202421]/70 opacity-35 grayscale'
                              : pantryStatus ===
                                'available'
                                ? 'border-emerald-700 bg-[#173F35] text-white'
                                : 'border-[#DCE0CF] bg-[#DCE0CF]/55 text-[#173F35] hover:bg-[#DCE0CF] disabled:opacity-45'
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

            <div className="epantry-recipe-checkout-note mt-2 flex shrink-0 flex-col gap-2 rounded-xl border border-[#DCE0CF] bg-[#F7F6F2] px-3 py-2 text-[13px] leading-4 text-[#202421]/70 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl">
                Missing adds the ingredient to your Recipe Cart. Choose or add a delivery address only when you place your order from the Cart.
              </p>

              {shoppingTray.length > 0 ? (
                <Link
                  to="/cart/recipe"
                  className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#DCE0CF] bg-[#DCE0CF]/55 px-3 py-2 font-semibold text-[#173F35] hover:bg-[#DCE0CF]"
                >
                  <ShoppingCart
                    size={14}
                    aria-hidden="true"
                  />
                  Open Recipe Cart
                </Link>
              ) : (
                <div className="flex shrink-0 items-center gap-2 rounded-xl border border-[#DCE0CF] bg-white px-3 py-2 font-semibold text-[#202421]/80">
                  <MapPin
                    size={14}
                    className="text-[#173F35]"
                    aria-hidden="true"
                  />
                  Address at checkout
                </div>
              )}
            </div>
            </div>
            </div>

          </section>

          <section className="epantry-recipe-guide order-2 min-w-0 overflow-hidden rounded-[16px] border border-[#DCE0CF] bg-white">

            <div className="epantry-recipe-guide-intro border-b border-[#DCE0CF] bg-[#202421] px-5 py-6 sm:px-8 sm:py-8">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#DCE0CF] sm:text-[14px] sm:tracking-[0.16em]">02 / Recipe guide</p>
              <h2 className="mt-2 text-[24px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#F7F6F2] sm:text-[28px]">Cooking & nutrition details</h2>
            </div>

            <div className="min-h-0 flex-1 overflow-visible" data-recipe-guide-scroll>

            <div className="epantry-recipe-guide-overview grid grid-cols-2 gap-x-6 gap-y-4 border-b border-[#DCE0CF] bg-[#DCE0CF]/60 px-5 py-5 sm:grid-cols-4 sm:px-8">
              {[
                ['Servings', servings || recipe?.baseServings || '—'],
                ['Prep', `${Number(recipe?.preparationTimeMinutes || 0)} min`],
                ['Cook', `${Number(recipe?.cookingTimeMinutes || 0)} min`],
                ['Difficulty', recipeDetailLabel(recipe?.difficulty) || '—'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="epantry-guide-metric min-w-0 border-l-[2px] border-[#C86C42] py-1 pl-3"
                >
                  <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#173F35]/65 sm:text-[13px] sm:font-semibold sm:tracking-[0.12em]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold capitalize text-[#173F35] sm:mt-1 sm:text-sm sm:font-semibold">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <details defaultOpen className="epantry-guide-accordion group border-b border-[#DCE0CF]">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-[#DCE0CF]/70 group-open:bg-[#DCE0CF]/55 sm:gap-4 sm:px-5 sm:py-4">
                <span className="font-sans text-[13px] font-semibold text-[#173F35] sm:font-sans sm:text-xl sm:font-semibold">
                  Cooking steps
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[#DCE0CF] bg-white text-[#202421]/80 transition group-open:rotate-180 group-open:border-[#DCE0CF] group-open:text-[#173F35] sm:h-8 sm:w-8">
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="border-t border-[#DCE0CF] bg-[#F7F6F2] px-3 py-1.5 sm:px-5 sm:py-2">
                <ol className="divide-y divide-[#DCE0CF]">
                  {(data?.steps || []).map((step) => (
                    <li
                      key={step.id || step.stepNumber}
                      className="group/step flex gap-2 px-0.5 py-2 transition hover:bg-[#DCE0CF]/65 sm:gap-3 sm:px-1 sm:py-3"
                    >
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#DCE0CF] text-[13px] font-semibold text-[#173F35] ring-2 ring-emerald-50 sm:h-8 sm:w-8 sm:text-sm sm:font-semibold">
                        {step.stepNumber}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[15px] font-medium leading-[1.65] text-[#202421] sm:text-[16px] sm:font-medium sm:leading-[1.65]">
                          {step.instruction}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1 sm:mt-1.5 sm:gap-1.5">
                          {step.timerSeconds !== null && step.timerSeconds !== undefined && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-amber-800 sm:px-2.5 sm:py-1 sm:text-[13px] sm:font-semibold sm:tracking-[0.08em]">
                              {Math.round(step.timerSeconds / 60)} min timer
                            </span>
                          )}
                          {step.temperature && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-red-700 sm:px-2.5 sm:py-1 sm:text-[13px] sm:font-semibold sm:tracking-[0.08em]">
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

            <details className="epantry-guide-accordion group border-b border-[#DCE0CF]">
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 transition hover:bg-[#DCE0CF]/70 group-open:bg-[#DCE0CF]/55 sm:gap-4 sm:px-5 sm:py-4">
                <span className="font-sans text-[13px] font-semibold text-[#173F35] sm:font-sans sm:text-xl sm:font-semibold">
                  Ingredients
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full border border-[#DCE0CF] bg-white text-[#202421]/80 transition group-open:rotate-180 group-open:border-[#DCE0CF] group-open:text-[#173F35] sm:h-8 sm:w-8">
                  <ChevronDown size={16} aria-hidden="true" />
                </span>
              </summary>

              <div className="border-t border-[#DCE0CF] bg-[#F7F6F2] px-3 py-2 sm:px-5 sm:py-3">
                {ingredientRows.length ? (
                  <div className="divide-y divide-[#DCE0CF]">
                    {ingredientRows.map((ingredient, index) => (
                      <div
                        key={ingredient.id || ingredient.canonicalIngredientId || index}
                        className="flex items-start justify-between gap-2 py-1.5 sm:gap-4 sm:py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-[#202421] sm:text-sm sm:font-semibold">
                            {ingredient?.ingredient?.name || ingredient?.name || 'Ingredient'}
                          </p>
                          {ingredient.preparationState ? (
                            <p className="mt-0.5 text-[13px] font-medium text-[#202421]/70 sm:text-[13px] sm:font-semibold">
                              {ingredient.preparationState}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full border border-[#DCE0CF] bg-white px-2 py-0.5 text-[13px] font-semibold text-[#173F35] sm:px-2.5 sm:py-1 sm:text-[13px] sm:font-semibold">
                          {formatQuantity(ingredient.displayQuantity ?? ingredient.quantity)}{' '}
                          {ingredient.displayUnit || ingredient.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] font-medium text-[#202421]/70 sm:text-sm sm:font-semibold">
                    Ingredient details are not currently published.
                  </p>
                )}
              </div>
            </details>

            {/* Published Food Intelligence bridge targets: keep IDs/portals working.
                Until the bridge mounts, show the same approved API response
                or an explicit cannot-verify state. No values are invented. */}
            <div className="epantry-recipe-intelligence" aria-label="Nutrition, allergens and dietary information">
              <div id="recipe-nutrition-intelligence-slot" className="epantry-recipe-intelligence-slot">
                {hostListingMode ? <HostDeclaredRecipeFacts submission={data?.hostSubmission} section="nutrition" /> : null}
                <RecipeEvidenceFallback kind="nutrition" evidence={detailsFoodIntelligence} />
              </div>
              <div id="recipe-allergen-intelligence-slot" className="epantry-recipe-intelligence-slot">
                {hostListingMode ? <HostDeclaredRecipeFacts submission={data?.hostSubmission} section="allergens" /> : null}
                <RecipeEvidenceFallback kind="allergens" evidence={detailsFoodIntelligence} />
              </div>
              <div id="recipe-dietary-intelligence-slot" className="epantry-recipe-intelligence-slot">
                {hostListingMode ? <HostDeclaredRecipeFacts submission={data?.hostSubmission} section="dietary" /> : null}
                <RecipeEvidenceFallback kind="dietary" evidence={detailsFoodIntelligence} />
              </div>
            </div>

            </div>

          </section>

        </div>

        <div className="epantry-recipe-related mt-10 space-y-10 rounded-[16px] bg-[#DCE0CF] px-5 py-8 sm:mt-14 sm:space-y-12 sm:px-8 sm:py-10">
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
            description="Published recipes sharing real ingredients with this dish."
            items={recipeDiscovery?.similarRecipes || []}
            loading={recipeDiscoveryLoading}
          />
          {recipeDiscovery?.origin?.country && recipeDiscovery?.moreFromCountry?.length > 0 ? (
            <RecipeRecommendationShelf
              eyebrow="Explore this cuisine"
              title={`More from ${recipeDiscovery.origin.country.name}`}
              showViewAll={false}
              items={recipeDiscovery.moreFromCountry}
              loading={false}
            />
          ) : null}
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
            className="flex max-h-[calc(100svh-24px)] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-[#DCE0CF] bg-[#F7F6F2] shadow-2xl sm:max-h-[calc(100svh-32px)] sm:w-[440px]"
            style={{ width: 'min(460px, calc(100vw - 24px))' }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#DCE0CF] px-5 py-4">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#173F35]">Added to your Pantry</p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#202421]">Complete {pantrySetupItem.name}</h2>
                <p className="mt-1.5 text-xs leading-5 text-[#202421]/80">Add what you know now. This helps EPANTRY plan meals and shopping without guessing your stock.</p>
              </div>
              <button type="button" onClick={deferPantrySetupDetails} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#DCE0CF] bg-white text-[#202421]/80 hover:bg-[#DCE0CF]/50" aria-label="Close and remind me later">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <div className="rounded-2xl border border-[#DCE0CF] bg-[#DCE0CF]/55 p-3.5">
                <p className="text-sm font-semibold text-emerald-950">{pantrySetupItem.name} is confirmed at home.</p>
                <p className="mt-1 text-xs leading-5 text-[#173F35]">Quantity is required here. Storage and use-soon are optional but useful.</p>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#202421]">How much do you have?</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                    <input type="number" min="0" step="any" value={setupQuantity} onChange={(event) => setSetupQuantity(event.target.value)} placeholder="500" className="focus-ring rounded-xl border border-[#DCE0CF] bg-white px-3 py-3 text-sm font-bold text-[#202421]" />
                    <select value={setupUnit} onChange={(event) => setSetupUnit(event.target.value)} className="focus-ring rounded-xl border border-[#DCE0CF] bg-white px-3 py-3 text-sm font-bold text-[#202421]">
                      <option value="g">g</option><option value="kg">kg</option><option value="ml">ml</option><option value="l">L</option><option value="pcs">pcs</option>
                    </select>
                  </div>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#202421]">Where is it stored?</span>
                  <select value={setupStorage} onChange={(event) => setSetupStorage(event.target.value)} className="focus-ring rounded-xl border border-[#DCE0CF] bg-white px-3 py-3 text-sm font-bold text-[#202421]">
                    <option value="pantry">Pantry</option><option value="fridge">Fridge</option><option value="freezer">Freezer</option><option value="counter">Counter</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[#202421]">Use soon by</span>
                  <input type="date" value={setupUseSoon} onChange={(event) => setSetupUseSoon(event.target.value)} className="focus-ring rounded-xl border border-[#DCE0CF] bg-white px-3 py-3 text-sm font-bold text-[#202421]" />
                  <span className="text-xs leading-5 text-[#202421]/70">Optional household reminder — this is not treated as a verified expiry date.</span>
                </label>
              </div>

              {setupError ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{setupError}</div> : null}
            </div>

            <div className="border-t border-[#DCE0CF] bg-white px-5 py-4">
              <button type="button" onClick={savePantrySetupDetails} disabled={setupSaving} className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173F35] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#173F35] disabled:cursor-not-allowed disabled:opacity-50">
                {setupSaving ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                Save Pantry details
              </button>
              <button type="button" onClick={deferPantrySetupDetails} disabled={setupSaving} className="focus-ring mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#DCE0CF] bg-white px-4 py-3 text-sm font-semibold text-[#202421] transition hover:bg-[#F7F6F2] disabled:cursor-not-allowed disabled:opacity-50">
                <BellRing size={17} aria-hidden="true" />
                I'll do this later
              </button>
              <p className="mt-2 text-center text-[14px] leading-5 text-[#202421]/70">If you choose later, EPANTRY adds one notification that opens this exact Pantry item.</p>
            </div>
          </aside>
        </div>
      ) : null}

    </main>
  )
}