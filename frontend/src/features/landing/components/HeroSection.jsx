import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CookingPot, Search } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '../../auth/context/AuthContext'
import { listOrders } from '../../commerce/services/commerce.service'
import { listPublicRecipes } from '../../recipes/services/recipe.service'
import { getRecipeFoodIntelligence } from '../../foodIntelligence/services/foodIntelligence.service'
import { RECIPE_VIEWED_EVENT, getRecentRecipeViews } from '../../recipes/utils/recipeEngagement'
import { apiClient } from '../../../api/apiClient'
import { publicImageProps } from '../../../lib/publicMediaDelivery'
import { normalizeName, normalizeRecipeSources, selectHeroRecipes } from '../utils/heroRecipeSelection'
import { useLandingFeaturedQuery } from '../hooks/useLandingFeaturedQuery'

const LANDING_COOK_QUERY_KEY = 'epantry-cook-today-landing-input'
const ROTATION_LIMIT = 4
const ROTATION_DELAYS = { main: 4200, drink: 5000, new: 5600 }
const COMMON_WORDS = new Set(['recipe', 'homemade', 'the', 'with', 'and', 'from', 'fresh', 'easy', 'quick', 'food', 'dish', 'style'])
const DIETARY_CHECK_CONCURRENCY = 6

// Match only actual, published dietary declarations. Never infer vegetarian
// status from a recipe name or from an empty dietary field.
function declaredDietaryKind(values) {
  const labels = values
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase().replace(/[_-]+/g, ' '))
  if (labels.some((value) => ['non veg', 'non vegetarian', 'nonveg', 'eggitarian', 'eggetarian'].includes(value))) return 'nonveg'
  if (labels.some((value) => ['veg', 'vegetarian', 'vegan'].includes(value))) return 'veg'
  return 'unknown'
}

function publicRecipeDietaryKind(item) {
  return declaredDietaryKind([
    item?.dish?.dietaryType, item?.recipe?.dietaryType,
    item?.dish?.dietaryClassification, item?.recipe?.dietaryClassification,
    ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
    ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
  ])
}

function intelligenceDietaryKind(intelligence) {
  const labels = (Array.isArray(intelligence?.dietary) ? intelligence.dietary : [])
    .filter((entry) => entry?.eligible === true || String(entry?.status || '').toLowerCase() === 'eligible')
    .map((entry) => entry?.key)
  return declaredDietaryKind(labels)
}

// Display only a duration explicitly recorded in the published recipe data.
// Missing, default-zero or invalid fields must never become an invented time.
function verifiedMinutes(...values) {
  if (!values.length || values.some((value) =>
    value === null || value === undefined ||
    (typeof value === 'string' && !value.trim()))) return null
  const minutes = values.map(Number)
  if (minutes.some((value) => !Number.isSafeInteger(value) || value < 0)) return null
  const total = minutes.reduce((sum, value) => sum + value, 0)
  return Number.isSafeInteger(total) && total > 0 ? total : null
}

// Separate published preparation and cooking durations. A zero default is
// not proof of a measured time, so show a component only when positive.
function publishedTimePart(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const minutes = Number(value)
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null
}

// Some catalog entries were created by the development seed with a blanket
// 10-minute preparation + 20-minute cooking duration. Those values are test
// fixtures, not timings verified for each dish, so never advertise them.
function isDevelopmentSeedRecipe(item) {
  return /\bdevelopment seed\b/i.test(String(item?.recipe?.source?.name || ''))
}

function publishedTimestamp(value) {
  const stamp = Date.parse(value || '')
  return Number.isFinite(stamp) ? stamp : 0
}

function recipeKind(metadata) {
  const values = metadata.map((value) => normalizeName(value)).filter(Boolean)
  const tokens = new Set(values.flatMap((value) => value.split(' ')))
  if (['drink', 'drinks', 'beverage', 'beverages', 'smoothie', 'smoothies', 'mocktail', 'mocktails', 'cocktail', 'cocktails', 'juice', 'juices', 'shake', 'shakes', 'tea', 'coffee', 'latte', 'lemonade', 'lassi', 'milkshake', 'milkshakes', 'sherbet', 'sharbat', 'soda', 'sodas', 'kombucha'].some((key) => tokens.has(key))) return 'drink'
  if (['sweet', 'sweets', 'dessert', 'desserts', 'mithai', 'pudding', 'puddings', 'cake', 'cakes', 'pastry', 'pastries', 'bakery', 'halwa', 'kheer', 'jalebi', 'barfi', 'brownie', 'brownies'].some((key) => tokens.has(key))) return 'sweet'
  return 'meal'
}

function recipeWords(value) {
  return normalizeName(value).split(' ').filter((word) => word.length > 2 && !COMMON_WORDS.has(word))
}

// Compact, consistent outlined food icons instead of OS-dependent emoji.
// Matches the circular broccoli/drumstick thumb from the supplied video.
function DietaryThumbIcon({ kind }) {
  // Standard Indian food labels: green dot for vegetarian, brown-red
  // triangle for non-vegetarian. The original circular switch motion stays.
  const isVeg = kind === 'veg'
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.7" y="2.7" width="18.6" height="18.6" rx="1.6" stroke={isVeg ? '#14834B' : '#A83C32'} strokeWidth="2.1" />
      {isVeg
        ? <circle cx="12" cy="12" r="5.3" fill="#14834B" />
        : <path d="M12 6.4 18 16.9H6L12 6.4Z" fill="#A83C32" />}
    </svg>
  )
}

function RecipePhoto({ recipe, className = '', loading = 'lazy' }) {
  if (!recipe?.image) {
    return (
      <div className={`flex items-center justify-center bg-[#E6EADD] text-[#557365] ${className}`} aria-label="Recipe photo not available">
        <CookingPot className="h-9 w-9" aria-hidden="true" />
      </div>
    )
  }
  return (
    <img
      {...publicImageProps(recipe.image, {
        sizes: loading === 'eager' ? '(max-width: 767px) 100vw, 54vw' : '(max-width: 640px) 42vw, 96px',
        priority: loading === 'eager',
      })}
      alt={recipe.name}
      className={`object-cover ${className}`}
    />
  )
}

function useRotatingIndex(items, delay, reduceMotion, paused) {
  const [index, setIndex] = useState(0)
  const keys = items.map((item) => item.id).join('|')

  useEffect(() => {
    setIndex(0)
  }, [keys])

  useEffect(() => {
    if (reduceMotion || paused || items.length <= 1) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setIndex((current) => (current + 1) % items.length)
    }, delay)
    return () => window.clearInterval(timer)
  }, [keys, items.length, delay, reduceMotion, paused])

  return items.length ? items[index % items.length] : null
}

// This is an editorial ranking from published/featured records, NOT a claim of
// measured platform-wide popularity. The existing public API has no public
// recipe-view-count leaderboard. Account-specific signals are real recent views
// and previously matched orders, read only for signed-in Customers.
function rankRecipes(recipes, { featuredIds, recentViews, priorityIds, personalized, allRecipes = recipes }) {
  const recentIds = recentViews.map((view) => view.listingId ? `host:${view.listingId}` : `recipe:${view.slug}`)
  const viewedRecipes = recentIds.map((id) => allRecipes.find((item) => item.id === id)).filter(Boolean)
  const viewedWords = new Set(viewedRecipes.slice(0, 5).flatMap((item) => recipeWords(item.name)))
  const viewedCuisines = new Set(viewedRecipes.slice(0, 5).map((item) => normalizeName(item.cuisine)).filter(Boolean))
  const now = Date.now()

  return [...recipes].sort((a, b) => {
    const score = (recipe) => {
      const newest = publishedTimestamp(recipe.publishedAt)
      const ageDays = newest ? Math.max(0, (now - newest) / 86400000) : Infinity
      let total = (recipe.image ? 18 : 0)
        + (featuredIds.has(recipe.id) ? 26 : 0)
        + (Number.isFinite(ageDays) ? Math.max(0, 18 - ageDays / 7) : 0)
      if (personalized) {
        const viewedIndex = recentIds.indexOf(recipe.id)
        if (viewedIndex >= 0) total += Math.max(65, 160 - viewedIndex * 15)
        if (viewedCuisines.has(normalizeName(recipe.cuisine))) total += 40
        total += Math.min(5, recipeWords(recipe.name).filter((word) => viewedWords.has(word)).length) * 12
        const priorityIndex = priorityIds.indexOf(recipe.id)
        if (priorityIndex >= 0) total += Math.max(5, 45 - priorityIndex * 5)
      }
      return total
    }
    return score(b) - score(a)
      || publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt)
      || a.id.localeCompare(b.id)
  })
}

function SmallRecipeSlot({ item, slot, isLoading, reduceMotion }) {
  const title = slot === 'drink' ? 'DRINKS TO TRY' : 'RECIPE DISCOVERY'
  const emptyText = slot === 'drink' ? 'No published drinks yet.' : 'Published recipes will appear here.'
  return (
    <div className="epantry-hero-related-slot flex min-w-0 flex-col border-t border-[#D6DED4] pt-2.5">
      {item ? (
        // The row itself never moves. Only its contents dissolve, without
        // jumping vertically or leaving a blank gap between suggestions.
        <div className="epantry-hero-related-content relative min-h-[72px] flex-1 overflow-hidden sm:min-h-[76px]">
          <AnimatePresence initial={false}>
            <motion.div
              key={item.id}
              className="absolute inset-0"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.55, ease: 'easeInOut' }}
            >
              <Link to={item.path} className="focus-ring group flex min-w-0 items-center gap-3 rounded-[8px] transition-colors hover:text-[#173F35]">
                <RecipePhoto recipe={item} className="h-[64px] w-[64px] shrink-0 rounded-[5px] sm:h-[70px] sm:w-[70px]" />
                <span className="min-w-0 flex-1">
                  <span className="epantry-hero-slot-label">{title}</span>
                  <span className="epantry-hero-slot-name line-clamp-2 group-hover:underline">{item.name}</span>
                </span>
                <ArrowRight size={16} className="epantry-hero-slot-arrow" aria-hidden="true" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex min-h-[72px] flex-1 items-center gap-2 text-[#53675C]">
          <CookingPot size={20} className="shrink-0" aria-hidden="true" />
          <span className="text-[13px] leading-5">{isLoading ? 'Checking published recipes…' : emptyText}</span>
        </div>
      )}
    </div>
  )
}

export default function HeroSection({ selectedDiet = 'veg', onDietChange, onCatalogChange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const shouldReduceMotion = useReducedMotion()
  const [cookInput, setCookInput] = useState('')
  const [cookInputError, setCookInputError] = useState('')
  const [intelligenceById, setIntelligenceById] = useState({})
  const [checkingDietary, setCheckingDietary] = useState(false)
  const [showBrowseWhileLoading, setShowBrowseWhileLoading] = useState(false)
  const [paused, setPaused] = useState(false)
  const checkedDietaryIds = useRef(new Set())

  const { user, isAuthenticated, customerEnabled, isBootstrapping } = useAuth()
  const accountId = isAuthenticated ? String(user?.id || user?._id || user?.uid || '') : ''
  const personalize = !isBootstrapping && isAuthenticated && customerEnabled === true && Boolean(accountId)
  const [recentViews, setRecentViews] = useState([])

  useEffect(() => {
    if (isBootstrapping) return undefined
    const refresh = () => setRecentViews(personalize ? getRecentRecipeViews(accountId) : [])
    refresh()
    window.addEventListener(RECIPE_VIEWED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RECIPE_VIEWED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [accountId, personalize, isBootstrapping])

  const { data: featuredData, isLoading: featuredLoading } = useLandingFeaturedQuery()
  // The first published page is enough to begin rendering. The old query
  // blocked everything while it fetched page two sequentially.
  const { data: publicData, isLoading: publicLoading } = useQuery({
    queryKey: ['landing', 'hero', 'published-recipes', 1],
    queryFn: () => listPublicRecipes({ page: 1, limit: 50 }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: nextPublicPage } = useQuery({
    queryKey: ['landing', 'hero', 'published-recipes', 2],
    queryFn: () => listPublicRecipes({ page: 2, limit: 50 }),
    enabled: Number(publicData?.pagination?.pages || 0) > 1,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  const { data: approvedData, isLoading: approvedLoading } = useQuery({
    queryKey: ['landing', 'hero', 'approved-food-listings'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/public/host-listings')
        return response?.data?.data || { listings: [] }
      } catch (error) {
        if (error?.response?.status === 404) return { listings: [] }
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const { data: orderData } = useQuery({
    queryKey: ['landing', 'hero', 'paid-order-recipe-matches', accountId],
    queryFn: () => listOrders({ page: 1, limit: 30 }),
    enabled: personalize,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  const featuredRecipes = useMemo(() => Array.isArray(featuredData?.recipes) ? featuredData.recipes : [], [featuredData])
  const publicRecipes = useMemo(() => [
    ...(Array.isArray(publicData?.recipes) ? publicData.recipes : []),
    ...(Array.isArray(nextPublicPage?.recipes) ? nextPublicPage.recipes : []),
  ], [publicData, nextPublicPage])
  const hostListings = useMemo(() => Array.isArray(approvedData?.listings) ? approvedData.listings : [], [approvedData])

  const catalog = useMemo(() => normalizeRecipeSources({
    publicRecipes, featuredRecipes, hostListings,
  }), [publicRecipes, featuredRecipes, hostListings])

  const personalizedRecipes = useMemo(() => selectHeroRecipes({
    catalog,
    orders: personalize && Array.isArray(orderData?.orders) ? orderData.orders : [],
    recentViews: personalize ? recentViews : [],
    maxItems: 30,
  }), [catalog, orderData, recentViews, personalize])

  const recipeDetails = useMemo(() => {
    const details = new Map()
    for (const item of publicRecipes) {
      const slug = String(item?.dish?.slug || '').trim()
      if (!slug) continue
      details.set(`recipe:${slug}`, {
        diet: publicRecipeDietaryKind(item),
        recipeVersionId: String(item?.recipe?.id || ''),
        description: item?.dish?.description || item?.recipe?.description || '',
        minutes: isDevelopmentSeedRecipe(item)
          ? null
          : verifiedMinutes(item?.recipe?.preparationTimeMinutes, item?.recipe?.cookingTimeMinutes),
        prepMinutes: isDevelopmentSeedRecipe(item) ? null : publishedTimePart(item?.recipe?.preparationTimeMinutes),
        cookMinutes: isDevelopmentSeedRecipe(item) ? null : publishedTimePart(item?.recipe?.cookingTimeMinutes),
        servings: Number(item?.recipe?.baseServings) > 0 ? Number(item.recipe.baseServings) : null,
        kind: recipeKind([
          item?.dish?.course, item?.recipe?.course, item?.dish?.mealType,
          item?.recipe?.mealType, item?.dish?.category, item?.recipe?.category,
          ...(Array.isArray(item?.dish?.tags) ? item.dish.tags : []),
          ...(Array.isArray(item?.recipe?.tags) ? item.recipe.tags : []),
          item?.dish?.name, item?.recipe?.title,
        ]),
      })
    }
    for (const item of featuredRecipes) {
      const slug = String(item?.slug || '').trim()
      if (!slug || details.has(`recipe:${slug}`)) continue
      details.set(`recipe:${slug}`, {
        // /landing/featured uses dietaryType for course/difficulty; it cannot
        // prove Veg/Non-Veg classification for these legacy cards.
        diet: 'unknown',
        description: item?.description || '',
        // Featured totalTime is a derived summary with no source metadata;
        // the primary /recipes response supplies source-backed timings.
        minutes: null,
        prepMinutes: null,
        cookMinutes: null,
        servings: Number(item?.servings) > 0 ? Number(item.servings) : null,
        kind: recipeKind([item?.cuisine, item?.course, item?.name, item?.title]),
      })
    }
    for (const item of hostListings) {
      if (!item?.id) continue
      details.set(`host:${item.id}`, {
        diet: declaredDietaryKind([item?.dietary]),
        description: item?.description || '',
        minutes: verifiedMinutes(item?.preparationMinutes, item?.cookingMinutes),
        prepMinutes: publishedTimePart(item?.preparationMinutes),
        cookMinutes: publishedTimePart(item?.cookingMinutes),
        servings: Number(item?.baseServings) > 0 ? Number(item.baseServings) : null,
        kind: recipeKind([item?.category, item?.type, item?.title]),
      })
    }
    return details
  }, [publicRecipes, featuredRecipes, hostListings])

  // Check only public, published recipe versions. Individual answers are
  // cached and rendered as soon as they return; an unrelated slow request
  // must not hold all visible recipe cards hostage.
  const unresolvedIds = useMemo(() => {
    const ids = []
    const prioritized = personalizedRecipes.concat(catalog.filter((item) => !personalizedRecipes.some((priority) => priority.id === item.id)))
    // Bounded and balanced: verify up to 8 meal, 8 drink and 8 sweet
    // versions, instead of making a request for every published recipe.
    const firstPass = ['meal', 'drink', 'sweet'].flatMap((kind) =>
      prioritized.filter((item) => recipeDetails.get(item.id)?.kind === kind).slice(0, 8))
    for (const recipe of firstPass.concat(prioritized)) {
      if (ids.length >= 24) break
      const details = recipeDetails.get(recipe.id)
      const id = details?.recipeVersionId
      if (id && details?.diet === 'unknown' && !ids.includes(id)) ids.push(id)
    }
    return ids
  }, [personalizedRecipes, catalog, recipeDetails])
  const unresolvedKey = unresolvedIds.join('|')

  useEffect(() => {
    const pending = unresolvedIds.filter((id) => !checkedDietaryIds.current.has(id))
    if (!pending.length) {
      setCheckingDietary(false)
      return undefined
    }
    let cancelled = false
    setCheckingDietary(true)
    async function verifyDietary() {
      for (let index = 0; index < pending.length; index += DIETARY_CHECK_CONCURRENCY) {
        if (cancelled) return
        const batch = pending.slice(index, index + DIETARY_CHECK_CONCURRENCY)
        await Promise.all(batch.map(async (id) => {
          let result = null
          try {
            result = await queryClient.fetchQuery({
              queryKey: ['landing', 'hero', 'recipe-diet', id],
              queryFn: () => getRecipeFoodIntelligence(id),
              staleTime: 10 * 60 * 1000,
              gcTime: 20 * 60 * 1000,
              retry: false,
            })
          } catch { /* Without approved evidence the dietary type stays unknown. */ }
          if (cancelled) return
          checkedDietaryIds.current.add(id)
          // Update each finished recipe immediately instead of waiting for
          // the whole network batch (or all 24 checks) to finish.
          setIntelligenceById((current) => ({ ...current, [id]: result }))
        }))
      }
      if (!cancelled) setCheckingDietary(false)
    }
    void verifyDietary()
    return () => { cancelled = true }
  }, [unresolvedKey, queryClient])

  const recipes = useMemo(() => {
    const hostShared = new Set(hostListings.filter((item) => item?.shareRecipe === true).map((item) => `host:${item.id}`))
    return catalog
      .filter((item) => item.id.startsWith('recipe:') || hostShared.has(item.id))
      .map((item) => {
        const details = recipeDetails.get(item.id) || {}
        const diet = details.diet === 'unknown' && details.recipeVersionId
          ? intelligenceDietaryKind(intelligenceById[details.recipeVersionId])
          : (details.diet || 'unknown')
        return { ...item, ...details, diet, kind: details.kind || 'meal' }
      })
  }, [catalog, recipeDetails, intelligenceById, hostListings])

  // Landing's Cook Today and Featured Recipes must receive the SAME live,
  // governed public catalog and dietary state as the hero. Previously these
  // props were ignored and both downstream sections always received [].
  useEffect(() => {
    onCatalogChange?.(recipes)
  }, [onCatalogChange, recipes])

  const displayed = useMemo(() => {
    const eligible = recipes.filter((recipe) => recipe.diet === selectedDiet)
    const featuredIds = new Set(featuredRecipes.map((item) => `recipe:${item.slug}`))
    const priorityIds = personalizedRecipes.map((item) => item.id)
    const rank = (items) => rankRecipes(items, {
      featuredIds, recentViews, priorityIds, personalized: personalize, allRecipes: recipes,
    })

    // Only the main course and fresh recipe recommendations depend on the
    // Veg/Non-Veg switch. Drinks are a shared discovery rail in BOTH modes,
    // so changing to Non-Veg never makes existing drinks disappear.
    const main = rank(eligible.filter((item) => item.kind === 'meal')).slice(0, ROTATION_LIMIT)
    const drink = rank(recipes.filter((item) => item.kind === 'drink')).slice(0, ROTATION_LIMIT)

    // New approved Host recipe shares take priority when they arrive; until
    // then show already published recipes. Never leave the slot empty merely
    // because every eligible recipe is also in the main carousel.
    const otherRecipes = eligible.filter((item) => item.kind !== 'drink')
    const latestFirst = (a, b) => publishedTimestamp(b.publishedAt) - publishedTimestamp(a.publishedAt) || a.id.localeCompare(b.id)
    const newestPublished = [...otherRecipes].sort(latestFirst)
    // A newly approved Host listing has approvedAt as publishedAt and rises to
    // the top automatically. Before another listing arrives, the currently
    // approved recipe pool remains available as a stable fallback.
    const alternatives = newestPublished.filter((item) => !main.some((mainItem) => mainItem.id === item.id))
    const freshest = newestPublished[0]
    const hasNewHost = freshest?.id.startsWith('host:') && publishedTimestamp(freshest.publishedAt) > 0
    const source = hasNewHost ? newestPublished : (alternatives.length ? alternatives : newestPublished)
    const rankedNew = personalize && recentViews.length
      ? rank(source.slice(0, 12))
      : source
    // A newly approved Host recipe stays in the fresh rail even when recent
    // views would otherwise push it outside the top four recommendations.
    const newest = (hasNewHost && !rankedNew.slice(0, ROTATION_LIMIT).some((item) => item.id === freshest.id)
      ? [freshest, ...rankedNew.filter((item) => item.id !== freshest.id)]
      : rankedNew).slice(0, ROTATION_LIMIT)

    // If no alternate recipe exists, the one approved available recipe remains
    // visible until another Host or public recipe is published.
    return { main, drink, new: newest }
  }, [recipes, selectedDiet, featuredRecipes, personalizedRecipes, recentViews, personalize])

  const mainRecipe = useRotatingIndex(displayed.main, ROTATION_DELAYS.main, shouldReduceMotion, paused)
  const drinkRecipe = useRotatingIndex(displayed.drink, ROTATION_DELAYS.drink, shouldReduceMotion, paused)
  const newRecipe = useRotatingIndex(displayed.new, ROTATION_DELAYS.new, shouldReduceMotion, paused)
  // Featured content and host listings enrich discovery but cannot block
  // the main published-recipe response. Dietary checks run progressively.
  const catalogLoading = publicLoading || (
    !catalog.length && (featuredLoading || approvedLoading)
  ) || (!displayed.main.length && checkingDietary)

  // If the API is genuinely slow, keep the browsing escape hatch usable
  // without inventing recipe data or hiding the ongoing request.
  useEffect(() => {
    if (!catalogLoading) {
      setShowBrowseWhileLoading(false)
      return undefined
    }
    const timer = window.setTimeout(() => setShowBrowseWhileLoading(true), 2500)
    return () => window.clearTimeout(timer)
  }, [catalogLoading])

  const handleCookTodaySubmit = (event) => {
    event.preventDefault()
    const query = cookInput.trim()
    if (!query) {
      setCookInputError('Enter a dish or ingredient to get started.')
      return
    }
    setCookInputError('')
    try { window.sessionStorage.setItem(LANDING_COOK_QUERY_KEY, query) } catch { /* route state is enough */ }
    navigate('/cook-today', { state: { landingCookQuery: query } })
  }

  return (
    <motion.section
      aria-label="Discover recipes, drinks and food ideas"
      className="epantry-recipe-hero relative isolate w-full overflow-hidden border-b border-[#DDE4DA] bg-[#F7F6F2] text-[#202421]"
      initial={false}
      animate={{ backgroundColor: selectedDiet === 'veg' ? '#F2F6F0' : '#F9F0EB' }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeInOut' }}
    >
      <style>{`
        .epantry-recipe-hero {
          font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
          isolation: isolate;
          --hero-green: #143E32;
          --hero-rust: #B65C42;
        }
        .epantry-hero-kicker {
          display: flex;
          align-items: center;
          gap: 11px;
          font-size: 12px;
          line-height: 1.2;
          letter-spacing: .085em;
          text-transform: uppercase;
          color: #315B4A;
          font-weight: 800;
        }
        .epantry-hero-kicker::before { content: ''; width: 30px; height: 2px; background: var(--hero-rust); flex: none; }
        .epantry-recipe-hero .epantry-hero-title {
          margin: 18px 0 0;
          max-width: 630px;
          font-size: clamp(51px, 5.05vw, 79px) !important;
          line-height: 1.055 !important;
          font-weight: 800 !important;
          letter-spacing: -.060em !important;
          color: var(--hero-green);
          text-transform: none !important;
        }
        .epantry-hero-title-line { display: block; white-space: nowrap; }
        .epantry-hero-title-accent {
          color: #A75138;
          font-style: normal;
          position: relative;
        }
        .epantry-hero-intro {
          max-width: 440px;
          margin-top: 22px;
          font-size: clamp(15px, 1.1vw, 17px);
          line-height: 1.62;
          color: #53685F;
          font-weight: 500;
        }
        .epantry-hero-search { max-width: 520px; margin-top: 28px; }
        .epantry-hero-search-field {
          min-height: 62px;
          border: 1px solid #C8D6CB;
          border-radius: 12px;
          background: #FFF;
          box-shadow: 0 10px 34px rgba(26, 59, 43, .07);
          display: flex; align-items: center; gap: 9px;
          padding: 6px 7px 6px 16px;
        }
        .epantry-hero-search-field:focus-within { outline: 2px solid #468A6C; outline-offset: 2px; }
        .epantry-hero-search-input {
          flex: 1; min-width: 0; border: 0; outline: 0;
          background: transparent; padding: 8px 2px; color: #22342C;
          font-size: 15px; font-weight: 500;
        }
        .epantry-hero-search-input::placeholder { color: #708178; opacity: 1; }
        .epantry-hero-search-button {
          min-height: 46px; display: inline-flex; align-items: center; justify-content: center;
          gap: 9px; padding: 9px 17px; border-radius: 9px;
          background: var(--hero-green); color: white;
          font-size: 14px; font-weight: 800;
          transition: background-color .18s ease, transform .18s ease;
        }
        .epantry-hero-search-button:hover { background: #245B47; transform: translateY(-1px); }
        .epantry-hero-links { display: flex; align-items: center; flex-wrap: wrap; gap: 22px; margin-top: 23px; }
        .epantry-hero-links a {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 14px; font-weight: 750; text-underline-offset: 4px;
          color: var(--hero-green);
        }
        .epantry-hero-links a:hover { text-decoration: underline; }
        .epantry-hero-links a + a { color: #7F493B; }
        .epantry-hero-layout { min-width: 0; }
        .epantry-hero-visual {
          position: relative; border-radius: 7px !important; overflow: hidden;
          border: 1px solid rgba(20,62,50,.15) !important;
          box-shadow: 0 18px 44px rgba(28, 65, 45, .12) !important;
          background-color: #E2E9DB;
        }
        .epantry-hero-visual img { transition: transform 1s cubic-bezier(.2,.65,.3,1); }
        .epantry-hero-visual:hover img { transform: scale(1.035); }
        .epantry-hero-feature-card {
          position: absolute; right: 17px; bottom: 16px;
          width: min(54%, 304px);
          background: rgba(250,249,245,.975);
          padding: 18px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.85);
          box-shadow: 0 13px 42px rgba(12,32,25,.24);
          backdrop-filter: blur(12px);
        }
        .epantry-recipe-hero .epantry-hero-recipe-title {
          margin: 6px 0 8px;
          font-size: clamp(18px,1.65vw,24px) !important;
          font-weight: 800; line-height: 1.18; letter-spacing: -.035em;
          color: #183D31;
        }
        .epantry-hero-feature-meta { display: flex; flex-wrap: wrap; gap: 5px 12px; font-size: 12px; color: #617167; margin-bottom: 12px; }
        .epantry-hero-feature-action {
          min-height: 40px; display: inline-flex; width: 100%; justify-content: space-between;
          gap: 8px; align-items: center; padding: 9px 13px; border-radius: 8px;
          color: #FFF; background: var(--hero-green); font-size: 13px; font-weight: 800;
          transition: background-color .18s ease;
        }
        .epantry-hero-feature-action:hover { background: #255946; }
        .epantry-hero-related { gap: clamp(14px,1.7vw,28px); }
        .epantry-hero-related-slot {
          min-width: 0;
          padding-top: 11px !important;
          border-top: 1px solid #C6D3C8 !important;
        }
        .epantry-hero-related-slot a { height: 100%; }
        .epantry-hero-related-slot a img { border-radius: 5px; object-fit: cover; }
        .epantry-hero-related-slot a:hover img { filter: saturate(1.08); }
        .epantry-hero-related-slot .epantry-hero-slot-label {
          display: block; margin-bottom: 5px; font-size: 10px;
          letter-spacing: .09em; font-weight: 800;
          text-transform: uppercase; color: #7D5847;
        }
        .epantry-hero-related-slot .epantry-hero-slot-name {
          display: block; color: #24382F;
          font-size: 13px; font-weight: 800; line-height: 1.33;
        }
        .epantry-hero-slot-arrow { color: #4B6D5D; flex: none; margin-left: 3px; }
        .epantry-hero-toggle { border: 1px solid rgba(25,65,48,.18) !important; box-shadow: 0 5px 16px rgba(23,63,53,.09); }
        @media (min-width: 768px) {
          .epantry-recipe-hero { height: 100svh; min-height: 0; }
          .epantry-hero-shell {
            box-sizing: border-box; height: 100%; min-height: 0;
            display: grid; grid-template-rows: 40px minmax(0, 1fr);
            row-gap: clamp(12px, 2.3svh, 25px);
            padding-top: calc(70px + clamp(16px, 2svh, 24px));
            padding-bottom: clamp(22px, 3svh, 34px);
          }
          .epantry-hero-toggle-row { margin: 0 !important; align-items: center; }
          .epantry-hero-layout {
            display: grid; height: 100%; min-height: 0;
            grid-template-columns: minmax(0,.91fr) minmax(0,1.09fr);
            gap: clamp(30px, 4.6vw, 84px);
            align-items: center;
          }
          .epantry-hero-copy { align-self: center; margin-top: -12px; min-width: 0; }
          .epantry-hero-feature-column {
            display: flex; flex-direction: column; min-height: 0;
            align-self: center; width: 100%; gap: clamp(12px,1.7svh,20px);
          }
          .epantry-hero-visual { height: clamp(310px, 51svh, 500px) !important; flex: none; width: 100%; }
          .epantry-hero-related { height: clamp(87px, 11svh, 114px); margin: 0 !important; min-height: 0; flex: none; }
          .epantry-hero-related-slot { min-height: 0; }
          .epantry-hero-related-content { min-height: 0 !important; height: 100%; }
        }
        @media (min-width:768px) and (max-width:1120px) {
          .epantry-recipe-hero .epantry-hero-title { font-size: clamp(43px,5vw,62px) !important; }
          .epantry-hero-layout { gap: clamp(22px,3vw,42px); }
          .epantry-hero-intro { margin-top: 16px; }
          .epantry-hero-search { margin-top: 20px; }
          .epantry-hero-links { margin-top: 16px; }
          .epantry-hero-feature-card { width: min(64%,285px); padding: 14px; }
        }
        @media (min-width:768px) and (max-height:700px) {
          .epantry-hero-shell { padding-top: 77px; padding-bottom: 12px; row-gap: 9px; }
          .epantry-hero-copy { margin-top: 0; }
          .epantry-hero-visual { height: clamp(250px, 49svh, 365px) !important; }
          .epantry-hero-related { height: 88px; }
          .epantry-recipe-hero .epantry-hero-title { font-size: clamp(40px,4.15vw,62px) !important; margin-top: 12px; }
          .epantry-hero-intro { margin-top: 13px; font-size: 14px; }
          .epantry-hero-search { margin-top: 15px; }
          .epantry-hero-links { margin-top: 13px; }
        }
        @media (max-width:767px) {
          .epantry-recipe-hero { box-sizing: border-box; height: 100svh; min-height: 0; }
          .epantry-hero-shell {
            display: flex; flex-direction: column;
            box-sizing: border-box; height: 100%; min-height: 0;
            padding-top: 68px;
            padding-bottom: max(55px,calc(env(safe-area-inset-bottom,0px) + 49px));
          }
          .epantry-hero-toggle-row { flex: 0 0 36px; margin: 0 0 6px !important; }
          .epantry-hero-toggle { transform-origin: right center; transform: scale(.89); }
          .epantry-hero-layout {
            display: grid; flex: 1 1 auto; min-height: 0; height: 100%;
            grid-template-columns: minmax(0,1fr);
            grid-template-rows: auto minmax(0,1fr);
            gap: clamp(8px,1.2svh,13px);
          }
          .epantry-hero-copy { min-width: 0; align-self: start; }
          .epantry-hero-kicker { font-size: 10px; gap: 9px; }
          .epantry-hero-kicker::before { width: 21px; }
          .epantry-recipe-hero .epantry-hero-title {
            margin-top: 8px; font-size: clamp(30px,8.2vw,43px) !important;
            line-height: 1.03 !important;
          }
          .epantry-hero-intro { margin-top: 9px; font-size: 12.7px; line-height: 1.42; max-width: 370px; }
          .epantry-hero-search { margin-top: 12px; max-width: none; }
          .epantry-hero-search-field { min-height: 44px; padding: 3px 4px 3px 10px; gap: 6px; border-radius: 9px; }
          .epantry-hero-search-input { font-size: 12.5px; padding: 6px 0; }
          .epantry-hero-search-button { min-height: 36px; padding: 6px 10px; font-size: 12px; border-radius: 7px; gap: 5px; }
          .epantry-hero-links { margin-top: 10px; gap: 16px; }
          .epantry-hero-links a { font-size: 12px; gap: 4px; }
          .epantry-hero-feature-column { display: grid; grid-template-rows: minmax(0,1fr) 119px; min-height: 0; height: 100%; gap: 7px; }
          .epantry-hero-visual { min-height: 0; height: 100% !important; max-height: none; width: 100%; border-radius: 7px !important; }
          .epantry-hero-feature-card {
            left: 8px; right: 8px; bottom: 8px; width: auto;
            padding: 9px 10px; border-radius: 8px;
            display: grid; grid-template-columns: minmax(0, 1fr) auto;
            align-items: center; column-gap: 9px; row-gap: 2px;
          }
          .epantry-hero-feature-card > p:first-child { grid-column: 1; font-size: 9px; line-height: 1.15; margin: 0; }
          .epantry-recipe-hero .epantry-hero-recipe-title { grid-column: 1; font-size: 15px !important; margin: 2px 0; }
          .epantry-hero-feature-meta { grid-column: 1; font-size: 10px; gap: 3px 8px; margin-bottom: 0; }
          .epantry-hero-feature-action {
            grid-column: 2; grid-row: 1 / span 3;
            align-self: center; width: auto; white-space: nowrap;
            min-height: 35px; padding: 7px 9px; font-size: 10.5px;
          }
          .epantry-hero-feature-action svg { width: 13px; height: 13px; }
          .epantry-hero-related { grid-template-columns: minmax(0,1fr) !important; grid-template-rows: repeat(2,minmax(0,1fr)); height: 119px; margin: 0 !important; gap: 6px; }
          .epantry-hero-related-slot { height: 100%; padding-top: 5px !important; min-height: 0; }
          .epantry-hero-related-content { height: 100%; min-height: 0 !important; }
          .epantry-hero-related-content > div { height: 100%; }
          .epantry-hero-related-content a { height: 100%; gap: 9px; }
          .epantry-hero-related-slot a img { width: 43px; height: 43px; border-radius: 5px; }
          .epantry-hero-related-slot .epantry-hero-slot-label { font-size: 9px; margin-bottom: 1px; }
          .epantry-hero-related-slot .epantry-hero-slot-name { font-size: 11.5px; line-height: 1.2; }
          .epantry-hero-slot-arrow { width: 13px; }
        }
        @media (max-width:767px) and (max-height:720px) {
          .epantry-hero-shell { padding-top: 65px; padding-bottom: max(51px,calc(env(safe-area-inset-bottom,0px) + 46px)); }
          .epantry-hero-toggle-row { flex-basis: 32px; margin-bottom: 4px !important; }
          .epantry-hero-layout { gap: 6px; }
          .epantry-recipe-hero .epantry-hero-title { font-size: clamp(27px,7.7vw,36px) !important; margin-top: 6px; }
          .epantry-hero-intro { margin-top: 5px; font-size: 12px; line-height: 1.32; }
          .epantry-hero-search { margin-top: 8px; }
          .epantry-hero-search-field { min-height: 41px; }
          .epantry-hero-search-button { min-height: 32px; }
          .epantry-hero-links { margin-top: 7px; }
          .epantry-hero-feature-column { grid-template-rows: minmax(0,1fr) 104px; gap: 5px; }
          .epantry-hero-related { height: 104px; gap: 4px; }
          .epantry-hero-related-slot a img { width: 36px; height: 36px; }
          .epantry-hero-related-slot .epantry-hero-slot-name { font-size: 11px; }
          .epantry-hero-feature-card { padding: 7px 8px; column-gap: 7px; }
          .epantry-recipe-hero .epantry-hero-recipe-title { font-size: 13px !important; }
          .epantry-hero-feature-meta { margin-bottom: 0; }
          .epantry-hero-feature-action { min-height: 29px; padding: 5px 7px; font-size: 10px; }
        }
        @media (max-width:767px) and (max-height:600px) {
          .epantry-hero-intro { display: none; }
          .epantry-hero-links a { font-size: 11px; }
          .epantry-hero-feature-column { grid-template-rows: minmax(0,1fr) 94px; }
          .epantry-hero-related { height: 94px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-hero-search-button, .epantry-hero-visual img { transition: none; }
        }
      `}</style>

      {/* A restrained editorial wash, rather than a flat colour swap. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 51% 68% at 2% 55%, rgba(183,220,184,.47), transparent 85%), linear-gradient(113deg, #F3F6EE 0%, #F9F9F5 48%, #F5F7F0 100%)' }}
        initial={false}
        animate={{ opacity: selectedDiet === 'veg' ? 1 : 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 50% 73% at 2% 55%, rgba(245,201,184,.49), transparent 84%), linear-gradient(113deg, #FAF1EC 0%, #FBF9F5 48%, #F8F4EF 100%)' }}
        initial={false}
        animate={{ opacity: selectedDiet === 'nonveg' ? 1 : 0 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.7, ease: 'easeInOut' }}
      />

      <div className="epantry-hero-shell page-shell relative z-10 mx-auto flex w-full min-h-0 flex-col">
        {/* Keep the video's sliding + rotating thumb, at a compact size. */}
        <div className="epantry-hero-toggle-row mb-2 flex w-full shrink-0 justify-end sm:mb-3">
          <div
            className="epantry-hero-toggle relative h-[40px] w-[112px] rounded-full border border-[#D6DDD3] bg-white/90 shadow-[0_4px_12px_rgba(23,63,53,.09)]"
            role="group"
            aria-label="Choose Veg or Non-Veg recipes"
          >
            <div className="absolute inset-0 grid grid-cols-2 items-center justify-items-center" aria-hidden="true">
              <span className="opacity-40"><DietaryThumbIcon kind="veg" /></span>
              <span className="opacity-40"><DietaryThumbIcon kind="nonveg" /></span>
            </div>
            <motion.div
              aria-hidden="true"
              initial={false}
              animate={{
                x: selectedDiet === 'veg' ? 0 : 56,
                rotate: selectedDiet === 'veg' ? 0 : 360,
                backgroundColor: selectedDiet === 'veg' ? '#E0F1E5' : '#FAE5DE',
              }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.53, ease: [0.2, 0.8, 0.2, 1] }}
              className="pointer-events-none absolute left-[12px] top-[4px] flex h-[30px] w-[30px] items-center justify-center rounded-full shadow-[0_2px_7px_rgba(23,63,53,.12)] ring-1 ring-white"
            >
              <DietaryThumbIcon kind={selectedDiet} />
            </motion.div>
            <button
              type="button"
              onClick={() => onDietChange?.('veg')}
              aria-label="Show vegetarian recipes"
              aria-pressed={selectedDiet === 'veg'}
              title="Veg"
              className="focus-ring absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-full outline-offset-2"
            ><span className="sr-only">Veg</span></button>
            <button
              type="button"
              onClick={() => onDietChange?.('nonveg')}
              aria-label="Show non-vegetarian recipes"
              aria-pressed={selectedDiet === 'nonveg'}
              title="Non-Veg"
              className="focus-ring absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-full outline-offset-2"
            ><span className="sr-only">Non-Veg</span></button>
          </div>
        </div>

        <div className="epantry-hero-layout grid min-w-0 items-center gap-5 md:items-stretch md:grid-cols-[minmax(0,.83fr)_minmax(0,1.17fr)] md:gap-7 lg:gap-[clamp(30px,4.8vw,82px)]">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .5 }}
            className="epantry-hero-copy min-w-0"
          >
            <p className="epantry-hero-kicker">Recipes for every moment</p>
            <h1 className="epantry-hero-title">
              Discover what <span className="epantry-hero-title-line">to make <em className="epantry-hero-title-accent">next.</em></span>
            </h1>
            <p className="epantry-hero-intro">
              Discover something delicious, or start with the ingredients you already have at home.
            </p>

            <form onSubmit={handleCookTodaySubmit} className="epantry-hero-search">
              <label className="sr-only" htmlFor="landing-cook-today-input">What would you like to make?</label>
              <div className="epantry-hero-search-field">
                <Search size={19} aria-hidden="true" className="shrink-0 text-[#365B4B]" />
                <input
                  id="landing-cook-today-input"
                  type="search"
                  autoComplete="off"
                  value={cookInput}
                  onChange={(event) => { setCookInput(event.target.value); if (cookInputError) setCookInputError('') }}
                  placeholder="Search recipes or ingredients"
                  aria-invalid={Boolean(cookInputError)}
                  aria-describedby={cookInputError ? 'landing-cook-error' : undefined}
                  className="epantry-hero-search-input"
                />
                <button type="submit" className="focus-ring epantry-hero-search-button">
                  Search <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
              {cookInputError && <p id="landing-cook-error" role="alert" className="mt-2 text-[13px] font-semibold text-[#A23524]">{cookInputError}</p>}
            </form>
            <div className="epantry-hero-links">
              <Link to="/cook-today" className="focus-ring">Use what I have <ArrowRight size={15} aria-hidden="true" /></Link>
              <Link to="/recipes" className="focus-ring">Browse recipes <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </motion.div>

          <div
            className="epantry-hero-feature-column min-w-0"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
          >
            {mainRecipe ? (
              <div className={`epantry-hero-visual relative isolate h-[295px] overflow-hidden rounded-[15px] border bg-[#E5EADD] shadow-[0_18px_44px_rgba(23,63,53,.16)] sm:h-[345px] ${selectedDiet === 'veg' ? 'border-[#BBD1C0]' : 'border-[#E5BDAB]'}`}>
                <AnimatePresence initial={false}>
                  <motion.div
                    key={`${selectedDiet}:${mainRecipe.id}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 1.025 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.75, ease: 'easeInOut' }}
                    className="absolute inset-0"
                  >
                    <RecipePhoto recipe={mainRecipe} loading="eager" className="absolute inset-0 h-full w-full" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                    <div className="epantry-hero-feature-card">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.075em] text-[#A54A2E]">
                        {personalize && recentViews.length ? 'Picked for you' : 'Featured recipe'}
                      </p>
                      <h2 className="epantry-hero-recipe-title line-clamp-2">{mainRecipe.name}</h2>
                      {(mainRecipe.prepMinutes || mainRecipe.cookMinutes || mainRecipe.servings) && (
                        <div className="epantry-hero-feature-meta">
                          {mainRecipe.prepMinutes ? <span>Prep {mainRecipe.prepMinutes} min</span> : null}
                          {mainRecipe.cookMinutes ? <span>Cook {mainRecipe.cookMinutes} min</span> : null}
                          {mainRecipe.servings ? <span>{mainRecipe.servings} servings</span> : null}
                        </div>
                      )}
                      <Link to={mainRecipe.path} className="focus-ring epantry-hero-feature-action">
                        Let&apos;s make this <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            ) : (
              <div className="epantry-hero-visual flex h-[295px] flex-col items-center justify-center rounded-[15px] border border-[#D7DED5] bg-[#EDF0E9] px-6 py-5 text-center sm:h-[345px]">
                <CookingPot size={34} aria-hidden="true" className="text-[#527161]" />
                <h2 className="mt-3 text-[18px] font-bold text-[#173F35]">
                  {catalogLoading
                    ? (showBrowseWhileLoading ? 'Finding recipes is taking longer than usual.' : 'Finding published recipes...')
                    : `No ${selectedDiet === 'veg' ? 'Veg' : 'Non-Veg'} recipes available yet`}
                </h2>
                <p className="mt-2 max-w-sm text-[13px] leading-5 text-[#536559]">
                  {catalogLoading ? 'Checking available recipes and their dietary information.' : 'Only approved, publicly shared recipes with a declared dietary type can appear here.'}
                </p>
                {(!catalogLoading || showBrowseWhileLoading) && (
                  <Link to="/recipes" className="focus-ring mt-4 inline-flex min-h-10 items-center gap-2 rounded-[9px] bg-[#173F35] px-5 text-[13px] font-bold text-white hover:bg-[#225846]">
                    Browse recipes <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
            <div className="epantry-hero-related mt-3 grid grid-cols-2 gap-3 sm:gap-4" aria-label="More recipe discoveries">
              <SmallRecipeSlot item={drinkRecipe} slot="drink" isLoading={catalogLoading} reduceMotion={shouldReduceMotion} />
              <SmallRecipeSlot key={`new:${selectedDiet}`} item={newRecipe} slot="new" isLoading={catalogLoading} reduceMotion={shouldReduceMotion} />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
