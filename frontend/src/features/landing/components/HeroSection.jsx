import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChefHat,
  CookingPot,
  Search,
  ShoppingBasket,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '../../auth/context/AuthContext'
import { listOrders } from '../../commerce/services/commerce.service'
import { listPublicRecipes } from '../../recipes/services/recipe.service'
import { RECIPE_VIEWED_EVENT, getRecentRecipeViews } from '../../recipes/utils/recipeEngagement'
import { apiClient } from '../../../api/apiClient'
import { normalizeRecipeSources, selectHeroRecipes } from '../utils/heroRecipeSelection'

import { landingHero } from '../content/landingContent'
import { useLandingFeaturedQuery } from '../hooks/useLandingFeaturedQuery'

/*
 * Hero photography: five optimized WebP files per breakpoint.
 * Desktop files: frontend/public/hero/1.webp ... 5.webp
 * Mobile files:  frontend/public/hero/1.1.webp ... 1.5.webp
 * Keep the matching desktop/mobile scene in the same slide position.
 */
const desktopHeroSlides = [
  '/hero/1.webp',
  '/hero/2.webp',
  '/hero/3.webp',
  '/hero/4.webp',
  '/hero/5.webp',
]

const mobileHeroSlides = [
  '/hero/1.1.webp',
  '/hero/1.2.webp',
  '/hero/1.3.webp',
  '/hero/1.4.webp',
  '/hero/1.5.webp',
]

const SLIDE_INTERVAL_MS = 5000
const LANDING_COOK_QUERY_KEY = 'epantry-cook-today-landing-input'

function useMobileHero() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const update = (event) => setIsMobile(event.matches)

    setIsMobile(mediaQuery.matches)

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update)
      return () => mediaQuery.removeEventListener('change', update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  return isMobile
}

export default function HeroSection() {
  const navigate = useNavigate()
  const shouldReduceMotion = useReducedMotion()
  const isMobile = useMobileHero()
  const [activeSlide, setActiveSlide] = useState(0)
  const [cookInput, setCookInput] = useState('')
  const [cookInputError, setCookInputError] = useState('')

  const { user, isAuthenticated, customerEnabled, isBootstrapping } = useAuth()
  const accountId = isAuthenticated ? String(user?.id || user?._id || user?.uid || '') : ''
  const [recentViews, setRecentViews] = useState([])

  // Observe real Recipe Detail visits. History stays separate per signed-in
  // account (and separate from anonymous browsing on a shared computer).
  useEffect(() => {
    if (isBootstrapping) return undefined
    const refresh = () => setRecentViews(getRecentRecipeViews(accountId))
    refresh()
    window.addEventListener(RECIPE_VIEWED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(RECIPE_VIEWED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [accountId, isBootstrapping])

  const { data: featuredData, isLoading: featuredLoading } = useLandingFeaturedQuery()
  const { data: publicData, isLoading: publicLoading } = useQuery({
    queryKey: ['landing', 'hero', 'published-recipes'],
    queryFn: () => listPublicRecipes({ page: 1, limit: 50 }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // M3 public listing packets become visible here only AFTER approval.
  // The endpoint may not yet exist in older deployments; keep the working
  // canonical public recipes visible when that optional API returns 404.
  const { data: approvedData } = useQuery({
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

  // Paid orders only. Grocery ingredient purchases are not labeled as
  // a recipe order unless the ordered item name exactly matches a live
  // published recipe / approved prepared-food listing.
  const { data: orderData } = useQuery({
    queryKey: ['landing', 'hero', 'paid-order-recipe-matches', accountId],
    queryFn: () => listOrders({ page: 1, limit: 30 }),
    enabled: !isBootstrapping && isAuthenticated && customerEnabled === true && Boolean(accountId),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  const featuredRecipes = Array.isArray(featuredData?.recipes) ? featuredData.recipes : []
  const catalog = useMemo(() => normalizeRecipeSources({
    publicRecipes: Array.isArray(publicData?.recipes) ? publicData.recipes : [],
    featuredRecipes,
    hostListings: Array.isArray(approvedData?.listings) ? approvedData.listings : [],
  }), [publicData, featuredData, approvedData])
  const personalizedRecipes = useMemo(() => selectHeroRecipes({
    catalog,
    orders: Array.isArray(orderData?.orders) ? orderData.orders : [],
    recentViews,
    maxItems: 9,
  }), [catalog, orderData, recentViews])
  const recipesLoading = (featuredLoading || publicLoading) && !personalizedRecipes.length

  const heroSlides = isMobile ? mobileHeroSlides : desktopHeroSlides
  const currentSlide = heroSlides[activeSlide % heroSlides.length]

  useEffect(() => {
    if (shouldReduceMotion || heroSlides.length < 2) return undefined

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, SLIDE_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [heroSlides.length, shouldReduceMotion])

  const handleCookTodaySubmit = (event) => {
    event.preventDefault()
    const query = cookInput.trim()

    if (!query) {
      setCookInputError('Enter a dish or ingredients to get started.')
      return
    }

    setCookInputError('')
    try {
      window.sessionStorage.setItem(LANDING_COOK_QUERY_KEY, query)
    } catch {
      // Navigation state remains available when storage is disabled.
    }

    navigate('/cook-today', {
      state: { landingCookQuery: query },
    })
  }

  return (
    <section
      aria-label="Discover food and recipes with EPANTRY"
      className="epantry-hero-refined relative isolate flex min-h-[100svh] w-full flex-col overflow-hidden bg-[#F7F6F2] text-[#202421]"
    >
      {/* Overrides are scoped because global EPANTRY heading rules use !important. */}
      <style>{`
        .epantry-hero-refined .epantry-hero-headline {
          font-size: clamp(38px, 9.1vw, 47px) !important;
          line-height: 1.105 !important;
          letter-spacing: -.045em !important;
          font-weight: 600 !important;
          text-transform: none !important;
          text-wrap: balance;
        }
        .epantry-hero-refined .epantry-hero-photo-overlay {
          background:
            linear-gradient(180deg,
              rgba(247,246,242,.84) 0%,
              rgba(247,246,242,.67) 31%,
              rgba(247,246,242,.18) 67%,
              rgba(247,246,242,.03) 100%);
        }
        .epantry-hero-refined .epantry-hero-recipe-rail {
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .epantry-hero-refined .epantry-hero-recipe-rail::-webkit-scrollbar {
          display: none;
        }
        /* A low, porcelain editorial shelf rather than a dark dashboard slab.
           The narrow desktop footprint keeps the food photograph unobscured. */
        .epantry-hero-refined .epantry-hero-recipe-ribbon {
          width: min(100%, 790px) !important;
          max-width: 790px !important;
          background: linear-gradient(115deg,
            rgba(247,246,242,.97) 0%,
            rgba(247,246,242,.95) 52%,
            rgba(232,238,229,.94) 100%);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          box-shadow: 0 14px 34px rgba(23,47,38,.17),
                      inset 0 1px 0 rgba(255,255,255,.9);
        }
        /* EPANTRY global typography includes !important rules. Scope compact
           sizes here so labels never collide or get truncated in the shelf. */
        .epantry-hero-refined .epantry-hero-recipe-heading {
          font-size: 16px !important;
          line-height: 1.25 !important;
          letter-spacing: -.024em !important;
          font-weight: 700 !important;
          text-transform: none !important;
        }
        .epantry-hero-refined .epantry-hero-recipe-eyebrow {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
          letter-spacing: .065em !important;
        }
        .epantry-hero-refined .epantry-hero-recipe-status {
          font-size: 11.5px !important;
          line-height: 1.25 !important;
        }
        .epantry-hero-refined .epantry-hero-recipe-name {
          font-size: 14px !important;
          line-height: 1.27 !important;
          font-weight: 700 !important;
          overflow-wrap: anywhere;
        }
        .epantry-hero-refined .epantry-hero-recipe-cuisine {
          font-size: 11.5px !important;
          line-height: 1.26 !important;
        }
        @media (min-width: 640px) {
          .epantry-hero-refined .epantry-hero-headline {
            font-size: clamp(49px, 5vw, 62px) !important;
            line-height: 1.07 !important;
          }
        }
        @media (min-width: 768px) {
          .epantry-hero-refined .epantry-hero-photo-overlay {
            background:
              linear-gradient(90deg,
                rgba(247,246,242,.85) 0%,
                rgba(247,246,242,.68) 21%,
                rgba(247,246,242,.25) 43%,
                rgba(247,246,242,.02) 66%),
              linear-gradient(0deg,
                rgba(17,48,37,.07) 0%,
                rgba(17,48,37,0) 25%);
          }
        }
        @media (min-width: 1024px) {
          .epantry-hero-refined .epantry-hero-headline {
            font-size: clamp(56px, 4.25vw, 66px) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .epantry-hero-refined * {
            scroll-behavior: auto !important;
          }
        }
      `}</style>

      {/* Full-bleed photos, five images per device and original crossfade behaviour. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <AnimatePresence mode="sync" initial={false}>
          <motion.img
            key={currentSlide}
            src={currentSlide}
            alt=""
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 h-full w-full object-cover object-[58%_center] md:object-center"
            draggable={false}
          />
        </AnimatePresence>
        <div className="epantry-hero-photo-overlay absolute inset-0" />
      </div>

      <div className="page-shell relative z-10 flex min-h-[100svh] w-full flex-1 flex-col justify-between gap-6 px-3.5 pb-[84px] pt-7 sm:px-5 sm:pb-[90px] sm:pt-12 lg:gap-7 lg:pb-[90px] lg:pt-[clamp(58px,9svh,112px)]">
        <div className="w-full max-w-[720px]">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mb-3 inline-flex items-center gap-2.5 text-[12px] font-semibold tracking-[.06em] text-[#173F35] sm:mb-4 sm:text-[13px]">
              <span aria-hidden="true" className="h-[3px] w-6 rounded-full bg-[#C86C42]" />
              Good food, made simpler
            </p>

            <h1 className="epantry-hero-headline max-w-[700px] text-[#202421]">
              What shall we <span className="text-[#173F35]">cook today?</span>
            </h1>

            <p className="mt-3 max-w-[550px] text-[15px] font-normal leading-[1.55] text-[#3F4840] sm:mt-5 sm:text-[16px] sm:leading-[1.6]">
              Find a recipe, check your pantry, and get what you need to make it.
            </p>
          </motion.div>

          {/* Primary discovery search is always visible, never tied to a slide. */}
          <form onSubmit={handleCookTodaySubmit} className="mt-5 max-w-[640px] sm:mt-7">
            <label htmlFor="landing-cook-today-input" className="sr-only">
              What would you like to cook, or which ingredients do you have?
            </label>
            <div className="flex min-h-[54px] w-full items-center gap-1.5 rounded-[15px] border border-[#C9D2C6] bg-[#F7F6F2]/96 p-1.5 shadow-[0_12px_40px_rgba(30,48,38,.10)] sm:min-h-[62px] sm:gap-3 sm:p-2">
              <Search size={19} aria-hidden="true" className="ml-2 shrink-0 text-[#173F35]" />
              <input
                id="landing-cook-today-input"
                type="search"
                autoComplete="off"
                value={cookInput}
                onChange={(event) => {
                  setCookInput(event.target.value)
                  if (cookInputError) setCookInputError('')
                }}
                placeholder="A dish, paneer, rice..."
                className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[14px] font-normal text-[#202421] outline-none placeholder:text-[#657069] sm:text-base"
                aria-invalid={Boolean(cookInputError)}
                aria-describedby={cookInputError ? 'landing-cook-error' : undefined}
              />
              <button
                type="submit"
                className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[11px] bg-[#173F35] px-3.5 text-[13px] font-semibold text-[#F7F6F2] transition-colors hover:bg-[#225946] sm:px-5 sm:text-[15px]"
              >
                <span>Find recipes</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            {cookInputError ? (
              <p id="landing-cook-error" className="mt-2 text-sm font-semibold text-[#A23524]" role="alert">
                {cookInputError}
              </p>
            ) : null}
          </form>

          {/* Same destinations, now a quieter editorial secondary-action row. */}
          <nav aria-label="Explore EPANTRY" className="mt-4 grid w-full max-w-[640px] grid-cols-3 gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:gap-2.5">
            <Link
              to="/cook-today"
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#B8C5B5] bg-[#DCE0CF]/90 px-2.5 py-2 text-center text-[12px] font-semibold leading-tight text-[#173F35] transition-colors hover:border-[#173F35] hover:bg-[#DCE0CF] sm:px-4 sm:text-sm"
            >
              <ChefHat size={16} className="hidden shrink-0 sm:block" aria-hidden="true" />
              Cook today
            </Link>
            <Link
              to={landingHero.secondaryAction.path}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#D1D7CC] bg-[#F7F6F2]/82 px-2.5 py-2 text-center text-[12px] font-semibold leading-tight text-[#202421] transition-colors hover:border-[#173F35]/55 hover:bg-[#F7F6F2] sm:px-4 sm:text-sm"
            >
              <CookingPot size={16} className="hidden shrink-0 sm:block" aria-hidden="true" />
              {landingHero.secondaryAction.label}
            </Link>
            <Link
              to={landingHero.primaryAction.path}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#D1D7CC] bg-[#F7F6F2]/82 px-2.5 py-2 text-center text-[12px] font-semibold leading-tight text-[#202421] transition-colors hover:border-[#173F35]/55 hover:bg-[#F7F6F2] sm:px-4 sm:text-sm"
            >
              <ShoppingBasket size={16} className="hidden shrink-0 sm:block" aria-hidden="true" />
              {landingHero.primaryAction.label}
            </Link>
          </nav>
        </div>

        {/* Photo-first, account-aware editorial shelf. Limit desktop width to
            leave the right-hand hero dish visible; on mobile recipes swipe. */}
        <section
          aria-label="Your recipe discoveries"
          className="epantry-hero-recipe-ribbon self-start overflow-hidden rounded-[18px] border border-[#E1E6DD]/90"
        >
          <div className="flex min-w-0 flex-col md:flex-row">
            <div className="relative flex min-h-[53px] shrink-0 items-center justify-between gap-3 border-b border-[#D5DDD2] px-4 py-2.5 md:min-h-[116px] md:w-[176px] md:flex-col md:items-start md:justify-center md:gap-2 md:border-b-0 md:border-r md:py-3.5">
              <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-[#C86C42] md:bottom-5 md:top-5" />
              <div className="min-w-0">
                <p className="epantry-hero-recipe-eyebrow font-bold uppercase text-[#A55332]">
                  From the kitchen
                </p>
                <h2 className="epantry-hero-recipe-heading mt-1 text-[#173F35]">
                  Picked for you
                </h2>
              </div>
              <Link
                to="/recipes"
                className="focus-ring inline-flex min-h-9 shrink-0 items-center gap-1.5 text-[12px] font-semibold text-[#173F35] underline-offset-4 transition-colors hover:text-[#A55332] hover:underline"
              >
                All recipes <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>

            {personalizedRecipes.length ? (
              <div
                className="epantry-hero-recipe-rail flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto"
                role="list"
                aria-label="Ordered, recently viewed and recommended food"
              >
                {personalizedRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    to={recipe.path}
                    role="listitem"
                    aria-label={`${recipe.label}: ${recipe.name} (${recipe.cuisine})`}
                    className="focus-ring group flex min-h-[108px] w-[218px] shrink-0 snap-start items-center gap-2.5 border-r border-[#D5DDD2]/75 px-2.5 py-3 transition-colors hover:bg-[#E2EADD]/70 last:border-r-0 sm:w-[218px] md:min-h-[116px] md:w-[204px]"
                  >
                    {recipe.image ? (
                      <img
                        src={recipe.image}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-[72px] w-[68px] shrink-0 rounded-[10px] object-cover shadow-[0_4px_12px_rgba(31,48,36,.13)] transition-transform duration-300 group-hover:scale-[1.035] motion-reduce:transform-none"
                      />
                    ) : (
                      <span aria-hidden="true" className="flex h-[72px] w-[68px] shrink-0 items-center justify-center rounded-[10px] bg-[#D7DDCF] text-[#173F35]">
                        <CookingPot size={22} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`epantry-hero-recipe-status block font-semibold ${recipe.label === 'Ordered' ? 'text-[#173F35]' : 'text-[#A55332]'}`}>
                        {recipe.label}
                      </span>
                      <span className="epantry-hero-recipe-name mt-1 block text-[#202421]">
                        {recipe.name}
                      </span>
                      <span className="epantry-hero-recipe-cuisine mt-1 block font-medium text-[#52675C]">
                        {recipe.cuisine}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[108px] min-w-0 flex-1 items-center px-4 py-3 text-sm text-[#334D41]">
                {recipesLoading ? 'Finding recipes for you…' : (
                  <Link to="/recipes" className="focus-ring inline-flex min-h-11 items-center gap-2 font-semibold text-[#173F35] hover:underline">
                    Discover published recipes <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
