import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CakeSlice,
  ChevronLeft,
  ChevronRight,
  Compass,
  CookingPot,
  Globe2,
  Martini,
  ShoppingBasket,
  UtensilsCrossed,
  X,
} from 'lucide-react'

import { useAuth } from '../../auth/context/AuthContext'
import { publicImageProps } from '../../../lib/publicMediaDelivery'
import { getLocalMeal, getSmartRecipes } from '../../recipes/utils/smartDiscovery'

// Keep the Hero, its published recipe catalog, and its Veg/Non-Veg state as
// the single source of truth. This section does not issue duplicate API calls.
const DESTINATIONS = [
  { id: 'cook', label: 'Cook Today', icon: UtensilsCrossed, colour: 'sage' },
  { id: 'pantry', label: 'Use What I Have', icon: ShoppingBasket, path: '/cook-today', colour: 'peach' },
  { id: 'plan', label: 'Meal Plan', icon: CalendarDays, path: '/meal-plan', colour: 'lavender' },
  { id: 'world', label: 'World Cuisines', icon: Globe2, colour: 'cyan' },
  { id: 'desserts', label: 'Desserts', icon: CakeSlice, colour: 'peach' },
  { id: 'drinks', label: 'Drinks Studio', icon: Martini, colour: 'sage' },
  { id: 'shop', label: 'Shop Ingredients', icon: ShoppingBasket, path: '/grocery', colour: 'yellow' },
  { id: 'explore', label: 'Explore EPANTRY', icon: Compass, colour: 'lavender' },
]

// Desktop/mobile artwork is already stored in frontend/public/banners.
// Only these four discovery destinations have a banner; other actions keep
// their existing route/modal behavior.
const DISCOVERY_BANNERS = {
  cook: {
    desktop: '/banners/cook_today_desktop.webp',
    mobile: '/banners/cook_today_mobile.webp',
  },
  cookNonveg: {
    desktop: '/banners/cook_today_nonveg_desktop.webp',
    mobile: '/banners/cook_today_nonveg_mobile.webp',
  },
  world: {
    desktop: '/banners/world_cuisines_desktop.webp',
    mobile: '/banners/world_cuisines_mobile.webp',
  },
  desserts: {
    desktop: '/banners/desserts_desktop.webp',
    mobile: '/banners/desserts_mobile.webp',
  },
  drinks: {
    desktop: '/banners/drinks_studio_desktop.webp',
    mobile: '/banners/drinks_studio_mobile.webp',
  },
}

const MEAL_TYPES = ['Dinner', 'Lunch', 'Breakfast', 'Snacks', 'Weekend']
const GENERIC_CUISINES = new Set([
  'recipe', 'recipes', 'food', 'dish', 'meal', 'drinks', 'drink',
  'sweets', 'desserts', 'bakery', 'ready made food',
])
const clean = (value) => String(value || '').trim().toLowerCase()
  .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

function sourceLabels(recipe) {
  return (Array.isArray(recipe.courseLabels) ? recipe.courseLabels : [])
    .map(clean).filter(Boolean)
}

// Lunch and Dinner are different destinations. Generic labels such as
// "main course" are not evidence that a recipe belongs in BOTH tabs.
const MEAL_LABELS = {
  Breakfast: ['breakfast', 'brunch', 'morning meal'],
  Lunch: ['lunch', 'midday meal', 'afternoon meal'],
  Snacks: ['snack', 'snacks', 'starter', 'appetizer', 'small plates'],
  Dinner: ['dinner', 'supper', 'evening meal'],
  Weekend: ['weekend', 'weekend special', 'special occasion', 'celebration'],
}

function mealMatches(recipe, selected) {
  if (recipe.kind !== 'meal') return false
  return sourceLabels(recipe).some((label) => MEAL_LABELS[selected]?.some((term) => label === term || label.startsWith(`${term} `)))
}

function categoryTitle(active) {
  return {
    cook: 'What are you cooking today?',
    world: 'The world on your plate',
    desserts: 'Something sweet to make',
    drinks: 'Drinks to try',
  }[active] || 'What are you cooking today?'
}

function RecipeTile({ recipe }) {
  const showDuration = Number.isSafeInteger(recipe.minutes) && recipe.minutes > 0
  const duration = showDuration
    ? recipe.minutes < 60
      ? `${recipe.minutes} min`
      : `${Math.floor(recipe.minutes / 60)} hr${recipe.minutes % 60 ? ` ${recipe.minutes % 60} min` : ''}`
    : null
  // These parts come from the published RecipeVersion/approved Host listing;
  // the aggregate minutes alone cannot tell a customer what prep requires.
  const timeParts = [
    Number.isSafeInteger(recipe.prepMinutes) && recipe.prepMinutes > 0 ? `Prep ${recipe.prepMinutes} min` : null,
    Number.isSafeInteger(recipe.cookMinutes) && recipe.cookMinutes > 0 ? `Cook ${recipe.cookMinutes} min` : null,
  ].filter(Boolean)
  const timeLabel = timeParts.length ? timeParts.join(' · ') : (duration ? `Total ${duration}` : null)

  return (
    <Link
      to={recipe.path}
      className="epantry-todays-recipe-card focus-ring group snap-start"
      aria-label={`View recipe: ${recipe.name}`}
    >
      <div className="epantry-cook-card-media">
        {recipe.image ? (
          <img
            {...publicImageProps(recipe.image, { sizes: '(max-width: 640px) 76vw, (max-width: 1024px) 44vw, 24vw' })}
            alt={recipe.name}
            loading="lazy"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="epantry-cook-card-image-fallback">
            <CookingPot size={29} aria-hidden="true" />
          </div>
        )}
        {timeLabel && <span className="epantry-cook-time">{timeLabel}</span>}
      </div>
      <div className="epantry-cook-card-body">
        <h3 className="epantry-cook-card-title">{recipe.name}</h3>
        <div className="epantry-cook-card-footer">
          <span>View recipe</span>
          <span className="epantry-cook-card-arrow" aria-hidden="true"><ArrowRight size={16} strokeWidth={2} /></span>
        </div>
      </div>
    </Link>
  )
}

// A compact feature-specific prompt; the destination and return route remain
// the existing customer login/register flow.
function AccessDialog({ destination, onClose }) {
  const closeRef = useRef(null)
  const dialogRef = useRef(null)
  const titleId = 'epantry-discovery-login-title'
  const descriptionId = 'epantry-discovery-login-description'
  const isPantry = destination?.id === 'pantry'
  const target = destination?.path || '/'
  const linkSuffix = `?returnTo=${encodeURIComponent(target)}`
  const headline = isPantry ? 'Your next great meal starts here.' : 'Meals planned. Stress gone.'
  const explanation = isPantry
    ? 'Your pantry has possibilities. Log in to find recipes using what you have.'
    : 'A delicious week starts with a plan. Log in to build yours.'
  const Icon = isPantry ? ShoppingBasket : CalendarDays

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusables = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href]')]
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      className="epantry-cook-access-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        background: 'rgba(15, 39, 32, .58)',
        backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)',
      }}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="epantry-cook-access-dialog"
        style={{
          position: 'relative', boxSizing: 'border-box',
          width: 'min(520px, calc(100vw - 32px))', maxWidth: '520px',
          height: 'min(340px, calc(100dvh - 32px))', maxHeight: 'calc(100dvh - 32px)',
          flex: '0 0 auto', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', borderRadius: '20px',
          background: '#F8F7F2', border: '1px solid #DBE2D8',
          boxShadow: '0 28px 85px rgba(10, 35, 26, .30)',
        }}
      >
        <div className="h-[4px] shrink-0 bg-gradient-to-r from-[#C56C42] via-[#DCA68A] to-[#B8CFAE]" aria-hidden="true" />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
          <button
            ref={closeRef}
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="focus-ring absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-[#D5DED2] bg-white text-[#173F35] transition hover:border-[#A7C1AB] hover:bg-[#E8F0E4]"
          ><X size={18} aria-hidden="true" /></button>

          <div className="flex items-center gap-3 pr-10">
            <span className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[#E0EAD9] text-[#173F35]">
              <Icon size={22} strokeWidth={1.85} aria-hidden="true" />
            </span>
            <span className="text-[12px] font-bold uppercase tracking-[.11em] text-[#AF5637]">
              {isPantry ? 'USE WHAT I HAVE' : 'MEAL PLAN'}
            </span>
          </div>
          <h2 id={titleId} className="mt-4 max-w-[410px] pr-2 text-[25px] font-extrabold leading-[1.15] tracking-[-.04em] text-[#173F35] sm:text-[29px]">
            {headline}
          </h2>
          <p id={descriptionId} className="mt-2.5 max-w-[430px] text-[14px] leading-[1.55] text-[#4D6157] sm:text-[15px]">
            {explanation}
          </p>

          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#DBE3D7] pt-4">
            <Link
              to={`/login${linkSuffix}`}
              onClick={onClose}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#173F35] px-3 py-2 text-[15px] font-bold text-white transition hover:bg-[#225744]"
            >Login <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link
              to={`/register${linkSuffix}`}
              onClick={onClose}
              className="focus-ring inline-flex min-h-11 items-center justify-center rounded-[12px] border border-[#B4C8B7] bg-white px-3 py-2 text-[15px] font-bold text-[#173F35] transition hover:bg-[#E7F0E6]"
            >Register</Link>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function CookTodayDiscoverySection({ recipes = [], selectedDiet = 'veg' }) {
  const navigate = useNavigate()
  const { isAuthenticated, isBootstrapping } = useAuth()
  const [activeDestination, setActiveDestination] = useState('cook')
  const activeBanner = activeDestination === 'cook' && selectedDiet === 'nonveg'
    ? DISCOVERY_BANNERS.cookNonveg
    : DISCOVERY_BANNERS[activeDestination]
  const [mealType, setMealType] = useState(() => getLocalMeal())
  const [curation, setCuration] = useState('meal')
  const [cuisine, setCuisine] = useState('all')
  const [loginDestination, setLoginDestination] = useState(null)
  const recipeRailRef = useRef(null)
  const discoverySectionRef = useRef(null)
  const [railHasOverflow, setRailHasOverflow] = useState(false)

  // Never assume dietary classification. Use the already checked catalog
  // published by HeroSection; the Hero's switch controls this selection.
  const confirmed = useMemo(
    () => recipes.filter((recipe) => recipe.diet === selectedDiet),
    [recipes, selectedDiet],
  )
  // Recipes without trustworthy dietary evidence must not be labelled as
  // vegetarian/non-vegetarian. If no proven matches exist, offer a separately
  // disclosed general discovery selection rather than an incorrect empty API
  // state or a false dietary claim.
  const unknownDiet = useMemo(
    () => recipes.filter((recipe) => recipe.diet === 'unknown'),
    [recipes],
  )
  const neutralDietaryFallback = confirmed.length === 0 && unknownDiet.length > 0
  const eligible = neutralDietaryFallback ? unknownDiet : confirmed
  const cuisines = useMemo(() => [...new Set(eligible
    .filter((recipe) => recipe.kind === 'meal')
    .map((recipe) => String(recipe.cuisine || '').trim())
    .filter((value) => value && !GENERIC_CUISINES.has(clean(value))))]
    .sort((a, b) => a.localeCompare(b)), [eligible])

  const { shownRecipes, isFallback } = useMemo(() => {
    if (activeDestination === 'cook') {
      const meals = eligible.filter((recipe) => recipe.kind === 'meal')
      if (curation !== 'meal') {
        const result = getSmartRecipes(meals, { mode: curation, meal: mealType, limit: 36 })
        // An empty curated collection is never presented as currently seasonal.
        // Fall back visibly to ordinary eligible meals without a false label.
        return { shownRecipes: result.matched ? result.items : meals, isFallback: !result.matched }
      }
      if (mealType === 'Dinner' || mealType === 'Lunch') {
        // Do not silently assign generic main-course dishes to a specific meal.
        const tagged = meals.filter((recipe) => mealMatches(recipe, mealType))
        return { shownRecipes: tagged.length ? tagged : meals, isFallback: !tagged.length && meals.length > 0 }
      }
      const exact = meals.filter((recipe) => mealMatches(recipe, mealType))
      // Preserve the other meal tabs' existing discovery fallback.
      return { shownRecipes: exact.length ? exact : meals, isFallback: !exact.length && meals.length > 0 }
    }
    if (activeDestination === 'world') return {
      shownRecipes: eligible.filter((recipe) => recipe.kind === 'meal'
        && Boolean(recipe.cuisine) && !GENERIC_CUISINES.has(clean(recipe.cuisine))
        && (cuisine === 'all' || clean(recipe.cuisine) === clean(cuisine))),
      isFallback: false,
    }
    if (activeDestination === 'desserts') return {
      // Desserts, like Drinks Studio, are a shared discovery collection in
      // both modes. Display published sweets without relabelling their diet.
      shownRecipes: recipes.filter((recipe) => recipe.kind === 'sweet'),
      isFallback: false,
    }
    if (activeDestination === 'drinks') return {
      // Drinks remain available in both diet modes, exactly like the Hero.
      shownRecipes: recipes.filter((recipe) => recipe.kind === 'drink'),
      isFallback: false,
    }
    return { shownRecipes: [], isFallback: false }
  }, [activeDestination, eligible, mealType, cuisine, recipes, curation])

  // Re-create the carousel whenever its selection or contents change.
  // This prevents the previous tab's scrollLeft from revealing a clipped
  // card at the left edge when the visitor changes Lunch/Dinner/diet.
  const railKey = [activeDestination, selectedDiet, mealType, cuisine, curation,
    ...shownRecipes.map((recipe) => String(recipe.id || recipe.path || ''))].join('|')

  // Keep swipe arrows honest: hide them when every published card already
  // fits. A fifth card deliberately peeks into the rail when more data exists.
  useLayoutEffect(() => {
    const rail = recipeRailRef.current
    if (!rail) {
      setRailHasOverflow(false)
      return undefined
    }
    rail.scrollLeft = 0
    const measure = () => setRailHasOverflow(rail.scrollWidth > rail.clientWidth + 2)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [railKey])

  // Re-open the selected category from its banner, even when the visitor
  // clicks another category after scrolling down under the sticky bar.
  // Keep the strip below the existing fixed navbar (70px/60px).
  const returnToDiscoveryTop = () => {
    const section = discoverySectionRef.current
    if (!section || typeof window === 'undefined') return
    const navbarHeight = window.matchMedia('(max-width: 767px)').matches ? 60 : 70
    const sectionPosition = section.getBoundingClientRect().top
    // Do not scroll down when the user is already looking at the top.
    if (sectionPosition >= navbarHeight - 2) return
    const target = Math.max(0, window.scrollY + sectionPosition - navbarHeight)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: target, behavior: reduceMotion ? 'instant' : 'smooth' })
  }

  const selectDestination = (destination) => {
    const { id, path } = destination
    if (id === 'pantry' || id === 'plan') {
      if (isBootstrapping) return
      if (!isAuthenticated) {
        setLoginDestination(destination)
        return
      }
      navigate(path)
      return
    }
    if (path) {
      navigate(path)
      return
    }
    if (id === 'explore') {
      // The original Explore EPANTRY scene already exists in LandingPage.
      // Scroll there rather than creating a second, duplicate section.
      document.querySelector('[data-landing-story="explore"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setActiveDestination(id)
    setMealType(getLocalMeal())
    setCuration('meal')
    setCuisine('all')
    window.requestAnimationFrame(returnToDiscoveryTop)
  }

  const scrollRecipes = (direction) => {
    const rail = recipeRailRef.current
    if (!rail) return
    const card = rail.querySelector('.epantry-todays-recipe-card')
    if (!card) return
    const spacing = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 16
    const step = card.getBoundingClientRect().width + spacing
    const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth)
    const next = Math.max(0, Math.min(maxScroll, rail.scrollLeft + direction * step))
    // LTR: positive scrollLeft advances cards from right to left; negative
    // returns to previous cards. Never overshoot the first/last card.
    rail.scrollTo({ left: next, behavior: 'smooth' })
  }
  return (
    <section
      ref={discoverySectionRef}
      data-destination={activeDestination}
      className={`epantry-cook-discovery relative isolate w-full text-[#202421] ${selectedDiet === 'nonveg' ? 'epantry-discovery-nonveg' : ''}`}
      aria-label="Explore food and recipes"
    >
      <style>{`
        /* All visual changes are isolated to the Landing discovery section. */
        .epantry-cook-discovery {
          overflow:visible; /* hidden overflow would stop position:sticky */
          --ep-cook-rail-gap: 16px;
          --ep-cook-tint: #DDE8D4;
          --ep-cook-soft: #EFF4E9;
          --ep-cook-accent: #8EB69A;
          --ep-cook-line: #D6E2D6;
          --ep-cook-title: #173F35;
          font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
          background:
            radial-gradient(ellipse 43% 68% at -6% 61%, rgba(202,228,206,.48), transparent 84%),
            radial-gradient(ellipse 44% 66% at 102% 15%, rgba(253,224,207,.36), transparent 82%),
            #F7F6F2;
          padding-bottom: clamp(20px, 2.5vw, 42px);
          transition: background-color .3s ease;
        }
        .epantry-cook-discovery.epantry-discovery-nonveg {
          --ep-cook-tint: #F6DCCB;
          --ep-cook-soft: #FCF0E8;
          --ep-cook-accent: #DB9B7D;
          --ep-cook-line: #E9D8CF;
          background:
            radial-gradient(ellipse 48% 65% at -7% 61%, rgba(250,208,186,.47), transparent 81%),
            radial-gradient(ellipse 46% 61% at 105% 11%, rgba(236,221,208,.36), transparent 81%),
            #F7F6F2;
        }
        .epantry-cook-discovery[data-destination="world"] {
          --ep-cook-tint: #D6EDEB;
          --ep-cook-soft: #EAF5F3;
          --ep-cook-accent: #7CBBB5;
          --ep-cook-line: #CFE5E0;
        }
        .epantry-cook-discovery[data-destination="desserts"] {
          --ep-cook-tint: #F6E0E9;
          --ep-cook-soft: #FCF0F4;
          --ep-cook-accent: #DCA1B9;
          --ep-cook-line: #EAD6E0;
        }
        .epantry-cook-discovery[data-destination="drinks"] {
          --ep-cook-tint: #D8F0EF;
          --ep-cook-soft: #E9F7F5;
          --ep-cook-accent: #82C9BD;
          --ep-cook-line: #CCE8E2;
        }
        /* Avoid the global page-shell max-width: the content should use the screen. */
        .epantry-cook-wide {
          width: calc(100% - clamp(24px, 3.2vw, 52px));
          max-width: 2240px;
          margin-inline: auto;
        }
        .epantry-cook-destination-bar,
        .epantry-cook-recipe-rail { scrollbar-width:none; }
        .epantry-cook-destination-bar::-webkit-scrollbar,
        .epantry-cook-recipe-rail::-webkit-scrollbar { display:none; }
        .epantry-cook-destination[data-colour="sage"] { --destination-hover:#E2ECD9; --destination-active:#D1E2C4; }
        .epantry-cook-destination[data-colour="peach"] { --destination-hover:#F9E5D8; --destination-active:#F4D7C5; }
        .epantry-cook-destination[data-colour="lavender"] { --destination-hover:#F0EBFF; --destination-active:#E9E1FF; }
        .epantry-cook-destination[data-colour="yellow"] { --destination-hover:#FFF5CC; --destination-active:#FDF0B3; }
        .epantry-cook-destination[data-colour="cyan"] { --destination-hover:#E6F3F4; --destination-active:#D8EDF0; }
        .epantry-cook-destination {
          display:flex; flex:1 0 123px; align-items:center; justify-content:center;
          flex-direction:column; gap:8px; min-height:75px;
          border:1px solid transparent; border-radius:14px;
          padding:10px 8px; background:transparent; color:#173F35;
          transition:background-color .22s ease,transform .22s ease,border-color .22s ease,box-shadow .22s ease;
        }
        .epantry-cook-destination:hover {
          background:var(--destination-hover); transform:translateY(-2px);
          border-color:rgba(23,63,53,.085);
        }
        .epantry-cook-destination[aria-pressed="true"] {
          background:var(--destination-active); border-color:rgba(23,63,53,.16);
          box-shadow:inset 0 -3px 0 #173F35,0 8px 15px rgba(23,63,53,.07);
        }
        .epantry-cook-destination:focus-visible,
        .epantry-cook-filter:focus-visible { outline:3px solid #C56C42; outline-offset:2px; }
        /* Keep this navigation pinned below the existing EPANTRY navbar.
           CSS sticky is bounded by .epantry-cook-discovery, so it naturally
           scrolls away just before the existing Explore EPANTRY section. */
        .epantry-cook-destination-strip {
          position:sticky; top:70px; z-index:40;
          background:linear-gradient(105deg,rgba(246,248,241,.98),rgba(250,247,242,.97) 58%,rgba(237,245,237,.98));
          border-bottom:1px solid rgba(23,63,53,.13);
          box-shadow:0 8px 20px rgba(23,63,53,.055);
          -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
        }
        @media (max-width:760px) {
          .epantry-cook-destination-strip { top:60px; }
        }
        /* A single continuous editorial feature, rather than nested floating cards. */
        .epantry-cook-story {
          overflow:hidden; border-radius:21px;
          border:1px solid rgba(23,63,53,.10);
          background:#FAFBF7;
          box-shadow:0 14px 42px rgba(23,63,53,.075),0 2px 4px rgba(23,63,53,.028);
        }
        .epantry-cook-feature-banner {
          position:relative; isolation:isolate;
          height:clamp(250px,22vw,378px); overflow:hidden;
          background:var(--ep-cook-tint);
        }
        .epantry-cook-feature-banner picture,
        .epantry-cook-feature-banner picture img { display:block; width:100%; height:100%; }
        .epantry-cook-feature-banner picture img {
          object-fit:cover; object-position:center 70%;
          transition:transform .6s ease;
        }
        .epantry-cook-feature-banner::after {
          content:''; position:absolute; z-index:1; inset:0; pointer-events:none;
          background:linear-gradient(90deg,rgba(250,250,246,.94) 0%,rgba(250,250,246,.73) 25%,rgba(250,250,246,.1) 54%,transparent 77%);
        }
        .epantry-cook-discovery[data-destination="desserts"] .epantry-cook-feature-banner::after {
          background:linear-gradient(90deg,rgba(255,245,248,.94),rgba(255,245,248,.67) 26%,rgba(255,245,248,.04) 60%,transparent 80%);
        }
        .epantry-cook-feature-copy {
          position:absolute; z-index:2; left:clamp(25px,4vw,74px); top:50%;
          transform:translateY(-50%); width:min(48%,610px);
        }
        .epantry-cook-feature-eyebrow {
          display:inline-flex; align-items:center; gap:11px;
          color:#34584B; font-size:13px; font-weight:750;
          letter-spacing:.10em; text-transform:uppercase;
        }
        .epantry-cook-feature-eyebrow::before {
          content:''; display:block; width:27px; height:3px;
          border-radius:99px; background:#C56C42;
        }
        .epantry-cook-feature-title {
          margin:17px 0 0; max-width:630px;
          font-size:clamp(33px,3.7vw,58px); line-height:1.08;
          font-weight:800; letter-spacing:-.05em;
          color:var(--ep-cook-title); text-wrap:balance;
        }
        .epantry-cook-feature-accent {
          display:block; margin-top:20px; width:72px; height:4px;
          border-radius:99px; background:#C56C42;
        }
        /* A coloured, integrated recipe surface for strong visual hierarchy. */
        .epantry-cook-gallery {
          position:relative;
          padding:clamp(20px,2.2vw,33px) clamp(17px,2.7vw,48px) 23px;
          border-top:3px solid var(--ep-cook-accent);
          background:linear-gradient(115deg,var(--ep-cook-soft) 0%,#FBFBF8 36%,#F8F9F5 100%);
        }
        .epantry-cook-gallery-toolbar {
          display:flex; justify-content:space-between; align-items:center;
          flex-wrap:wrap; gap:14px 24px; margin-bottom:21px;
        }
        .epantry-cook-gallery-label {
          display:inline-flex; align-items:center; gap:11px;
          font-size:17px; font-weight:750; color:var(--ep-cook-title);
        }
        .epantry-cook-gallery-label::before {
          content:''; display:block; width:5px; height:27px;
          border-radius:5px; background:#C56C42;
        }
        .epantry-cook-filter-strip {
          display:flex; align-items:center; gap:8px;
          max-width:100%; overflow-x:auto; padding-block:3px;
          scrollbar-width:none;
        }
        .epantry-cook-filter-strip::-webkit-scrollbar { display:none; }
        .epantry-cook-filter {
          flex-shrink:0; min-height:38px; padding:8px 16px;
          border-radius:50px; border:1px solid #D2DDD3;
          background:rgba(255,255,255,.9); color:#40554A;
          font-size:13px; font-weight:650;
          transition:background-color .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease;
        }
        .epantry-cook-filter:hover {
          border-color:#9FC4AD; background:var(--ep-cook-soft); transform:translateY(-1px);
        }
        .epantry-cook-filter[aria-pressed="true"] {
          background:#173F35; border-color:#173F35; color:#FFFFFF;
          box-shadow:0 5px 12px rgba(23,63,53,.15);
        }
        .epantry-cook-recipe-rail {
          display:flex; flex-wrap:nowrap; align-items:stretch; width:100%;
          direction:ltr; gap:var(--ep-cook-rail-gap); padding:3px 2px 14px;
          overflow-x:auto; overscroll-behavior-x:contain; overflow-anchor:none;
          scroll-snap-type:x proximity; scroll-padding-left:2px;
          -webkit-overflow-scrolling:touch;
        }
        .epantry-cook-discovery .epantry-todays-recipe-card {
          display:flex; flex-direction:column;
          flex:0 0 calc((100% - 4 * var(--ep-cook-rail-gap)) / 4.4);
          width:calc((100% - 4 * var(--ep-cook-rail-gap)) / 4.4);
          min-width:0; height:315px; min-height:315px; max-height:315px;
          scroll-snap-align:start; overflow:hidden; border-radius:16px;
          border:1px solid rgba(23,63,53,.11);
          background:#FFFFFF; color:#202421; text-decoration:none;
          box-shadow:0 3px 10px rgba(23,63,53,.045);
          transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease;
        }
        .epantry-cook-discovery .epantry-todays-recipe-card:hover {
          transform:translateY(-4px); border-color:#A6CDB0;
          box-shadow:0 15px 24px rgba(23,63,53,.12);
        }
        .epantry-cook-discovery .epantry-cook-card-media {
          position:relative; flex:0 0 197px; height:197px;
          min-height:197px; width:100%; overflow:hidden; background:#E1E9DE;
        }
        .epantry-cook-discovery .epantry-cook-card-media img {
          display:block; width:100%; height:100%; object-fit:cover;
        }
        .epantry-cook-card-image-fallback {
          display:flex; align-items:center; justify-content:center;
          width:100%; height:100%; color:#607A68;
        }
        .epantry-cook-time {
          position:absolute; bottom:10px; left:11px; padding:6px 10px;
          border:1px solid rgba(255,255,255,.8); border-radius:30px;
          background:rgba(250,250,248,.96); color:#203F34;
          font-size:12px; font-weight:700; line-height:1.25;
          max-width:calc(100% - 22px); box-sizing:border-box;
          overflow-wrap:anywhere;
          box-shadow:0 2px 8px rgba(0,0,0,.06);
        }
        .epantry-cook-discovery .epantry-cook-card-body {
          display:flex; flex:1 1 auto; min-height:0;
          flex-direction:column; padding:14px 15px 13px;
        }
        .epantry-cook-discovery .epantry-cook-card-title {
          margin:0; display:-webkit-box; -webkit-box-orient:vertical;
          -webkit-line-clamp:2; overflow:hidden; max-height:2.55em;
          font-size:16px; font-weight:700;
          letter-spacing:-.023em; line-height:1.28; color:#202421;
        }
        /* Dessert and drink names can be genuinely long. Keep their complete
           published names visible instead of forcing a two-line ellipsis. */
        .epantry-cook-discovery:is([data-destination="desserts"], [data-destination="drinks"]) .epantry-todays-recipe-card {
          height:auto; min-height:315px; max-height:none;
        }
        .epantry-cook-discovery:is([data-destination="desserts"], [data-destination="drinks"]) .epantry-cook-card-title {
          display:block; max-height:none; overflow:visible;
          -webkit-line-clamp:unset; overflow-wrap:anywhere;
        }
        .epantry-cook-card-footer {
          display:flex; align-items:center; justify-content:space-between;
          gap:9px; margin-top:auto; color:#3B6753;
          font-size:13px; font-weight:700;
        }
        .epantry-cook-card-arrow {
          display:grid; place-items:center; width:30px; height:30px;
          border-radius:50%; background:#E7EFDF; color:#173F35;
          transition:background-color .2s ease,transform .2s ease;
        }
        .epantry-todays-recipe-card:hover .epantry-cook-card-arrow {
          background:#CDE2BD; transform:translateX(2px);
        }
        .epantry-cook-rail-controls {
          display:flex; align-items:center; justify-content:flex-end; gap:8px;
        }
        .epantry-cook-rail-controls button {
          display:grid; place-items:center; width:38px; height:38px;
          border:1px solid #C8D7CC; border-radius:50%;
          background:#FFFFFF; color:#173F35;
          transition:background-color .2s ease,border-color .2s ease,transform .2s ease;
        }
        .epantry-cook-rail-controls button:hover {
          background:var(--ep-cook-tint); border-color:#A7C4AD; transform:translateY(-2px);
        }
        .epantry-cook-access-backdrop {
          background:rgba(16,43,34,.52);
          backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
        }
        .epantry-cook-access-dialog { flex:none; }
        @media (max-width:1023px) {
          .epantry-cook-discovery .epantry-todays-recipe-card {
            flex-basis:calc((100% - 2 * var(--ep-cook-rail-gap)) / 2.4);
            width:calc((100% - 2 * var(--ep-cook-rail-gap)) / 2.4);
          }
          .epantry-cook-feature-copy { width:min(56%,450px); }
        }
        @media (max-width:767px) {
          .epantry-cook-discovery { --ep-cook-rail-gap:12px; }
          .epantry-cook-wide { width:calc(100% - 20px); }
          /* Three full destinations plus 70% of World Cuisines at first load.
             The cropped fourth button is the natural horizontal-swipe cue. */
          .epantry-cook-destination-bar { scroll-snap-type:x proximity; }
          .epantry-cook-destination {
            flex:0 0 calc((100% - 24px) / 3.7);
            width:calc((100% - 24px) / 3.7);
            min-width:0; min-height:75px; gap:4px; padding:8px 3px;
            scroll-snap-align:start;
          }
          .epantry-cook-destination svg { width:21px; height:21px; flex-shrink:0; }
          .epantry-cook-destination span {
            display:block; max-width:100%; text-align:center;
            font-size:10.5px; line-height:1.14;
            overflow-wrap:break-word;
          }
          .epantry-cook-story { border-radius:16px; }
          /* Keep the mobile artwork editorial, not a full-screen empty panel. */
          .epantry-cook-feature-banner { height:clamp(275px, 48svh, 420px); }
          .epantry-cook-feature-banner picture img { object-position:center 82%; }
          .epantry-cook-feature-banner::after {
            background:linear-gradient(180deg,rgba(249,249,246,.87) 0%,rgba(249,249,246,.35) 43%,transparent 77%);
          }
          .epantry-cook-discovery[data-destination="desserts"] .epantry-cook-feature-banner::after {
            background:linear-gradient(180deg,rgba(255,244,248,.88) 0%,rgba(255,244,248,.34) 43%,transparent 78%);
          }
          .epantry-cook-feature-copy {
            left:22px; right:22px; top:clamp(20px,5.5vw,32px);
            transform:none; width:auto;
          }
          .epantry-cook-feature-title {
            font-size:clamp(27px,7.6vw,36px); line-height:1.1;
            max-width:290px;
          }
          .epantry-cook-feature-accent { margin-top:14px; }
          .epantry-cook-gallery { padding:20px 14px 22px; }
          .epantry-cook-gallery-label { font-size:15px; }
          .epantry-cook-gallery-toolbar { margin-bottom:15px; }
          /* Mobile meal tabs: four complete options and half of the next.
             The clipped Weekend tab signals that the row can be swiped. */
          .epantry-cook-meal-filter-strip {
            flex:0 0 100%; width:100%; min-width:0; max-width:100%;
            flex-wrap:nowrap; justify-content:flex-start; gap:6px;
            scroll-snap-type:x proximity; scroll-padding-inline:0;
            -webkit-overflow-scrolling:touch;
          }
          .epantry-cook-meal-filter-strip .epantry-cook-filter {
            flex:0 0 calc(22.2222% - 5.333px);
            width:calc(22.2222% - 5.333px); min-width:0;
            padding:7px 2px; min-height:36px;
            font-size:10.5px; line-height:1.2; white-space:nowrap;
            scroll-snap-align:start;
          }
          .epantry-cook-discovery .epantry-todays-recipe-card {
            flex-basis:calc((100% - var(--ep-cook-rail-gap)) / 1.4);
            width:calc((100% - var(--ep-cook-rail-gap)) / 1.4);
            height:290px; min-height:290px; max-height:290px;
          }
          .epantry-cook-discovery .epantry-cook-card-media {
            flex-basis:178px; height:178px; min-height:178px;
          }
          .epantry-cook-discovery:is([data-destination="desserts"], [data-destination="drinks"]) .epantry-todays-recipe-card {
            height:auto; min-height:290px; max-height:none;
          }
        }
        @media (max-width:420px) {
          .epantry-cook-feature-copy { top:22px; }
          .epantry-cook-gallery { padding-inline:12px; }
          .epantry-cook-gallery-toolbar { gap:11px; }
        }
        @media (prefers-reduced-motion:reduce) {
          .epantry-cook-discovery .epantry-cook-destination,
          .epantry-cook-discovery .epantry-todays-recipe-card,
          .epantry-cook-discovery .epantry-cook-filter,
          .epantry-cook-feature-banner picture img { transition:none!important; }
        }
      `}</style>

      <nav aria-label="Food and cooking destinations" className="epantry-cook-destination-strip">
        <div className="epantry-cook-destination-bar epantry-cook-wide flex items-stretch gap-2 overflow-x-auto py-3 md:gap-2 lg:justify-between">
          {DESTINATIONS.map((destination) => {
            const { id, label, icon: Icon, colour } = destination
            const selected = id === activeDestination
            return (
              <button
                key={id}
                type="button"
                data-colour={colour}
                aria-pressed={selected}
                aria-label={label}
                disabled={isBootstrapping && (id === 'pantry' || id === 'plan')}
                onClick={() => selectDestination(destination)}
                className="epantry-cook-destination focus-ring shrink-0 disabled:cursor-wait disabled:opacity-60"
              >
                <Icon size={25} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[13px] font-semibold leading-[1.25]">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className="epantry-cook-wide pt-4 sm:pt-5 lg:pt-6">
        <div className="epantry-cook-story">
          {activeBanner && (
            <div className="epantry-cook-feature-banner">
              <picture key={activeBanner.desktop} className="block h-full w-full" aria-hidden="true">
                <source media="(max-width: 767px)" srcSet={activeBanner.mobile} type="image/webp" />
                <img
                  src={activeBanner.desktop}
                  alt=""
                  width="1440"
                  height="810"
                  loading="eager"
                  decoding="async"
                />
              </picture>
              <div className="epantry-cook-feature-copy">
                <span className="epantry-cook-feature-eyebrow">{DESTINATIONS.find((item) => item.id === activeDestination)?.label || 'Cook Today'}</span>
                <h2 className="epantry-cook-feature-title">{categoryTitle(activeDestination)}</h2>
                <span className="epantry-cook-feature-accent" aria-hidden="true" />
              </div>
            </div>
          )}

          <div className="epantry-cook-gallery">
            <div className="epantry-cook-gallery-toolbar">
              <span className="epantry-cook-gallery-label">Recipes</span>
              {activeDestination === 'cook' ? (
                <div className="epantry-cook-filter-strip epantry-cook-meal-filter-strip" role="group" aria-label="Select meal type">
                  {MEAL_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setMealType(type); setCuration('meal') }}
                      aria-pressed={curation === 'meal' && mealType === type}
                      className="epantry-cook-filter focus-ring"
                    >{type}</button>
                  ))}
                </div>
              ) : activeDestination === 'world' ? (
                <div className="epantry-cook-filter-strip" role="group" aria-label="Select cuisine">
                  {['all', ...cuisines].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCuisine(value)}
                      aria-pressed={cuisine === value}
                      className="epantry-cook-filter focus-ring"
                    >{value === 'all' ? 'All cuisines' : value}</button>
                  ))}
                </div>
              ) : (
                <Link to="/recipes" className="focus-ring inline-flex min-h-9 items-center gap-2 text-[13px] font-bold text-[#173F35] hover:underline">
                  Browse recipes <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>

            {activeDestination === 'cook' && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#D7E0D5] pb-3 pt-3" role="group" aria-label="Discover curated recipes">
                <span className="mr-1 text-[12px] font-semibold text-[#526B5B]">Discover</span>
                {[
                  { id: 'meal', label: 'By meal' },
                  { id: 'seasonal', label: 'In season' },
                  { id: 'editorial', label: 'Editor picks' },
                ].map((option) => (
                  <button key={option.id} type="button" aria-pressed={curation === option.id}
                    onClick={() => setCuration(option.id)}
                    className={`focus-ring min-h-9 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${curation === option.id ? 'border-[#173F35] bg-[#173F35] text-white' : 'border-[#D7E0D5] bg-white text-[#173F35] hover:bg-[#E7EEE5]'}`}
                  >{option.label}</button>
                ))}
                {curation !== 'meal' && !getSmartRecipes(eligible.filter((r) => r.kind === 'meal'), { mode: curation, limit: 1 }).matched && (
                  <span className="text-[12px] text-[#526B5B]">No live {curation === 'seasonal' ? 'seasonal' : 'editorial'} collection yet. Showing available recipes.</span>
                )}
              </div>
            )}

            {(activeDestination === 'cook' || activeDestination === 'world') && neutralDietaryFallback && (
              <p className="mb-3 text-[13px] leading-5 text-[#53665B]" role="status">
                No confirmed {selectedDiet === 'veg' ? 'Veg' : 'Non-Veg'} recipes are available in this selection. These are general published recipes without verified dietary information; check their ingredients before cooking.
              </p>
            )}

            {activeDestination === 'cook' && !neutralDietaryFallback && isFallback && curation === 'meal' && (
              <p className="mb-3 text-[12px] text-[#526B5B]" role="status">No recipes explicitly labelled {mealType.toLowerCase()} yet. Showing available {selectedDiet === 'veg' ? 'vegetarian' : 'non-vegetarian'} recipes instead.</p>
            )}

            {shownRecipes.length ? (
              <>
                <div
                  key={railKey}
                  ref={recipeRailRef}
                  className="epantry-cook-recipe-rail"
                  aria-live="polite"
                >
                  {shownRecipes.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)}
                </div>
                {railHasOverflow && (
                  <div className="epantry-cook-rail-controls mt-3">
                    <button type="button" onClick={() => scrollRecipes(-1)} aria-label="Previous recipes" className="focus-ring"><ChevronLeft size={18} aria-hidden="true" /></button>
                    <button type="button" onClick={() => scrollRecipes(1)} aria-label="Next recipes" className="focus-ring"><ChevronRight size={18} aria-hidden="true" /></button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex min-h-[145px] flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#DBE5DA] bg-white px-5 py-6" aria-live="polite">
                <p className="text-[14px] leading-6 text-[#53665B]">No published recipes found for this selection.</p>
                <Link to="/recipes" className="focus-ring inline-flex items-center gap-2 text-[14px] font-bold text-[#173F35] hover:underline">Browse all recipes <ArrowRight size={16} aria-hidden="true" /></Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {loginDestination && <AccessDialog destination={loginDestination} onClose={() => setLoginDestination(null)} />}
    </section>
  )
}
