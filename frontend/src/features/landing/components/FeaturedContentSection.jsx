import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  ArrowRight,
  Clock3,
  Eye,
  Package,
  ShoppingBasket,
  Users,
} from 'lucide-react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  useLandingFeaturedQuery,
} from '../hooks/useLandingFeaturedQuery'

const mobileRailFrames = new WeakMap()

function updateMobileRailFocus(rail) {
  if (!rail?.children?.length) {
    return
  }

  const railRect = rail.getBoundingClientRect()
  const railCenter = railRect.left + railRect.width / 2
  const focusDistance = Math.max(railRect.width * 0.72, 1)

  Array.from(rail.children).forEach((child) => {
    const card = child.firstElementChild

    if (!card) {
      return
    }

    const childRect = child.getBoundingClientRect()
    const childCenter = childRect.left + childRect.width / 2
    const distance = Math.min(
      Math.abs(childCenter - railCenter) / focusDistance,
      1,
    )
    const scale = 1.035 - distance * 0.115
    const translateY = distance * 8
    const opacity = 1 - distance * 0.045

    card.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`
    card.style.opacity = opacity.toFixed(3)
  })
}

function handleMobileRailScroll(event) {
  const rail = event.currentTarget
  const previousFrame = mobileRailFrames.get(rail)

  if (previousFrame) {
    cancelAnimationFrame(previousFrame)
  }

  const nextFrame = requestAnimationFrame(() => {
    updateMobileRailFocus(rail)
    mobileRailFrames.delete(rail)
  })

  mobileRailFrames.set(rail, nextFrame)
}

function initializeMobileRail(rail) {
  if (!rail || typeof requestAnimationFrame === 'undefined') {
    return
  }

  requestAnimationFrame(() => {
    const startCard = rail.querySelector('[data-mobile-rail-start]')

    if (startCard) {
      const centeredScrollLeft =
        startCard.offsetLeft -
        (rail.clientWidth - startCard.offsetWidth) / 2

      rail.scrollLeft = Math.max(centeredScrollLeft, 0)
    }

    updateMobileRailFocus(rail)
  })
}

export default function FeaturedContentSection({
  groceryEntranceEdgeOpacity,
  groceryEntranceScale,
  groceryEntranceLift,
}) {
  const shouldReduceMotion =
    useReducedMotion()

  const navigate =
    useNavigate()

  const [
    selectedBrandFilter,
    setSelectedBrandFilter,
  ] = useState('all')

  const {
    data,
    isLoading,
    isError,
    error,
  } = useLandingFeaturedQuery()

  if (isLoading) {
    return <FeaturedLoading />
  }

  if (isError) {
    return (
      <section className="flex min-h-[100svh] items-center bg-white">

        <div className="page-shell">

          <div className="rounded-3xl border border-[#DC2626]/15 bg-[#FEF2F2] p-8 text-center">

            <p className="font-bold text-[#991B1B]">
              Featured content could not be loaded.
            </p>

            <p className="mt-2 text-sm text-[#DC2626]">

              {error?.message ||
                'Please try again later.'}

            </p>

          </div>

        </div>

      </section>
    )
  }

  const grocery =
    data?.grocery || []

  const brands =
    data?.brands || []

  const brandFilterGroups =
    buildBrandFilterGroups(
      brands,
    )

  const visibleBrands =
    getVisibleBrands({
      brands,
      brandFilterGroups,
      selectedBrandFilter,
    })

  const recipes =
    data?.recipes || []

  const mobileRecipeItems =
    recipes.slice(0, 4)

  const mobileRecipeCards =
    mobileRecipeItems.map(
      (recipe) => ({
        recipe,
      }),
    )

  /*
  |--------------------------------------------------------------------------
  | Temporary Featured Cart
  |--------------------------------------------------------------------------
  |
  | The real basket module does not exist yet.
  | This keeps the Featured Grocery button functional without creating
  | another store/file. It can later be replaced by the real basket action.
  |
  */

  const handleAddToCart = (
    product,
  ) => {
    const productPath =
      product?.path ||
      (product?.slug
        ? `/grocery/product/${product.slug}`
        : '/grocery')

    navigate(
      productPath,
    )
  }

  return (
    <>

      {/* =============================================================
          FEATURED GROCERY
      ============================================================= */}

      <FeaturedGroceryScrollStory
        products={grocery}
        onAddToCart={handleAddToCart}
        shouldReduceMotion={shouldReduceMotion}
        entranceEdgeOpacity={groceryEntranceEdgeOpacity}
        entranceScale={groceryEntranceScale}
        entranceLift={groceryEntranceLift}
      />

      {/* =============================================================
          FEATURED RECIPES
      ============================================================= */}

      <FeaturedRecipesScrollStory
        recipes={recipes}
        shouldReduceMotion={shouldReduceMotion}
      />

      {/* =============================================================
          FEATURED BRANDS
      ============================================================= */}

      <FeaturedBrandsMotionWall
        brands={visibleBrands}
        allBrands={brands}
        brandFilterGroups={brandFilterGroups}
        selectedBrandFilter={selectedBrandFilter}
        onSelectBrandFilter={setSelectedBrandFilter}
        shouldReduceMotion={shouldReduceMotion}
      />

    </>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Brands Motion Wall
|--------------------------------------------------------------------------
|
| Reference behavior:
| - one 100svh canvas
| - fixed editorial heading
| - two open typographic brand rows
| - top row continuously travels left
| - bottom row continuously travels right
| - lightweight hover separators, no heavy card chrome
|
| Existing Brand deep links and range filters remain available.
|
*/

function FeaturedBrandsMotionWall({
  brands,
  allBrands,
  brandFilterGroups,
  selectedBrandFilter,
  onSelectBrandFilter,
  shouldReduceMotion,
}) {
  const sourceBrands =
    Array.isArray(brands) &&
    brands.length > 0
      ? brands
      : Array.isArray(allBrands)
        ? allBrands
        : []

  if (sourceBrands.length === 0) {
    return (
      <section className="flex h-[100svh] min-h-[100svh] items-center bg-[#f4f4f2] px-5 text-black sm:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h2 className="mt-4 text-[clamp(48px,7vw,104px)] font-normal leading-[0.92] tracking-[-0.055em]">
            Featured Brands
          </h2>
          <div className="mt-12">
            <EmptyState
              message="Featured brands will appear here once brand data is available."
            />
          </div>
        </div>
      </section>
    )
  }

  const splitIndex =
    Math.max(
      1,
      Math.ceil(
        sourceBrands.length /
          2,
      ),
    )

  const rotatedBrands = [
    ...sourceBrands.slice(
      splitIndex,
    ),
    ...sourceBrands.slice(
      0,
      splitIndex,
    ),
  ]

  return (
    <section
      className="relative h-[100svh] min-h-[100svh] overflow-hidden bg-[#f4f4f2] text-[#111111]"
      aria-labelledby="featured-brands-title"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_46%,rgba(255,255,255,0.9),rgba(244,244,242,0)_58%)]" />

      <style>{`
        @keyframes epantry-brand-scroll-left {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @keyframes epantry-brand-scroll-right {
          from { transform: translate3d(-50%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
      `}</style>

      <div className="absolute left-5 right-5 top-[clamp(88px,10svh,118px)] z-20 sm:left-8 sm:right-8 lg:left-10 lg:right-10">
        <div className="max-w-[min(76rem,calc(100vw-8rem))]">

          <h2
            id="featured-brands-title"
            className="mt-3 [font-family:Arial,Helvetica,sans-serif] text-[clamp(46px,6.2vw,104px)] font-normal leading-[0.88] tracking-[-0.06em] text-black"
          >
            Featured Brands
          </h2>
        </div>
      </div>

      <div className="absolute right-5 top-[clamp(96px,11svh,128px)] z-30 hidden items-center gap-2 sm:flex lg:right-10">
        <button
          type="button"
          onClick={() =>
            onSelectBrandFilter(
              'all',
            )
          }
          className={[
            'focus-ring rounded-full px-3 py-1.5 [font-family:Arial,Helvetica,sans-serif] text-[11px] transition-colors duration-300',
            selectedBrandFilter ===
            'all'
              ? 'bg-black text-white'
              : 'text-black/55 hover:bg-black/5 hover:text-black',
          ].join(' ')}
        >
          All
        </button>

        {brandFilterGroups.map(
          (group) => (
            <button
              key={group.id}
              type="button"
              onClick={() =>
                onSelectBrandFilter(
                  group.id,
                )
              }
              className={[
                'focus-ring rounded-full px-3 py-1.5 [font-family:Arial,Helvetica,sans-serif] text-[11px] transition-colors duration-300',
                selectedBrandFilter ===
                group.id
                  ? 'bg-black text-white'
                  : 'text-black/55 hover:bg-black/5 hover:text-black',
              ].join(' ')}
            >
              {group.label}
            </button>
          ),
        )}
      </div>

      <div className="absolute inset-x-0 top-[34svh] z-10 sm:top-[35svh] lg:top-[34svh]">
        <BrandMotionRow
          brands={sourceBrands}
          direction="left"
          duration={26}
          shouldReduceMotion={shouldReduceMotion}
        />
      </div>

      <div className="absolute inset-x-0 top-[66svh] z-10 sm:top-[67svh] lg:top-[68svh]">
        <BrandMotionRow
          brands={rotatedBrands}
          direction="right"
          duration={29}
          shouldReduceMotion={shouldReduceMotion}
        />
      </div>

      <Link
        to="/brands"
        className="focus-ring group absolute right-5 top-[57svh] z-30 inline-flex -translate-y-1/2 items-center gap-2 rounded-full border border-black/15 bg-[#f4f4f2]/92 px-4 py-2.5 [font-family:Arial,Helvetica,sans-serif] text-xs font-medium text-black backdrop-blur-sm transition hover:border-black/35 sm:right-0 sm:top-[59svh] sm:rounded-l-[4px] sm:rounded-r-none sm:border-r-0 sm:px-4 sm:py-7 lg:px-5"
      >
        <span className="sm:[writing-mode:vertical-rl] sm:rotate-180">
          Explore Brands
        </span>
        <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 sm:hidden" />
      </Link>

      <div className="absolute bottom-5 left-5 z-20 flex gap-1.5 sm:hidden">
        <button
          type="button"
          onClick={() =>
            onSelectBrandFilter(
              'all',
            )
          }
          className={[
            'focus-ring rounded-full px-3 py-1.5 [font-family:Arial,Helvetica,sans-serif] text-[10px]',
            selectedBrandFilter ===
            'all'
              ? 'bg-black text-white'
              : 'bg-black/5 text-black/55',
          ].join(' ')}
        >
          All
        </button>
        {brandFilterGroups
          .slice(0, 2)
          .map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() =>
                onSelectBrandFilter(
                  group.id,
                )
              }
              className={[
                'focus-ring rounded-full px-3 py-1.5 [font-family:Arial,Helvetica,sans-serif] text-[10px]',
                selectedBrandFilter ===
                group.id
                  ? 'bg-black text-white'
                  : 'bg-black/5 text-black/55',
              ].join(' ')}
            >
              {group.label}
            </button>
          ))}
      </div>
    </section>
  )
}

function BrandMotionRow({
  brands,
  direction,
  duration,
  shouldReduceMotion,
}) {
  const [isPaused, setIsPaused] = useState(false)

  const group = (
    <div className="flex shrink-0 items-center gap-[clamp(24px,4vw,74px)] pr-[clamp(24px,4vw,74px)]">
      {brands.map(
        (
          brand,
          index,
        ) => (
          <BrandMotionItem
            key={`${direction}-${brand.id || brand.slug || brand.name}-${index}`}
            brand={brand}
            index={index}
            onHoverChange={setIsPaused}
          />
        ),
      )}
    </div>
  )

  return (
    <div className="w-full overflow-hidden">
      <div
        className="flex w-max items-center will-change-transform"
        style={{
          animation: shouldReduceMotion
            ? 'none'
            : `epantry-brand-scroll-${direction} ${duration}s linear infinite`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {group}
        <div aria-hidden="true" className="shrink-0">
          {group}
        </div>
      </div>
    </div>
  )
}

function BrandMotionItem({
  brand,
  index,
  onHoverChange,
}) {
  const displayName =
    String(
      brand?.name ||
        'Brand',
    ).trim()

  const weightClass =
    index % 3 === 0
      ? 'font-semibold'
      : index % 3 === 1
        ? 'font-normal'
        : 'font-medium'

  return (
    <Link
      to={getFeaturedBrandPath(
        brand,
      )}
      className="focus-ring group relative flex h-[112px] w-[clamp(190px,18vw,330px)] shrink-0 items-center justify-center px-5 sm:h-[132px] lg:h-[148px]"
      aria-label={`Explore ${displayName}`}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <span className="pointer-events-none absolute inset-y-3 left-0 w-px origin-center scale-y-0 bg-[#d76565]/55 transition-transform duration-300 ease-out group-hover:scale-y-100" />
      <span className="pointer-events-none absolute inset-y-3 right-0 w-px origin-center scale-y-0 bg-[#d76565]/55 transition-transform duration-300 ease-out group-hover:scale-y-100" />

      <span className="flex max-w-full flex-col items-center text-center">
        <span
          className={[
            '[font-family:Arial,Helvetica,sans-serif] text-[clamp(18px,1.65vw,31px)] leading-[0.96] tracking-[-0.045em] text-black transition-[color,transform] duration-300 ease-out group-hover:scale-[1.025] group-hover:text-[#B4232B]',
            weightClass,
          ].join(' ')}
        >
          {displayName}
        </span>

        <span className="mt-2 [font-family:Arial,Helvetica,sans-serif] text-[9px] font-normal tracking-[0.04em] text-black/38 transition-colors duration-300 group-hover:text-black/62 sm:text-[10px]">
          {formatBrandProductCount(
            brand?.productCount,
          )}
        </span>
      </span>
    </Link>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Grocery Scroll Story
|--------------------------------------------------------------------------
|
| The visible scene is always exactly 100svh. The outer track is taller so
| native page scroll can advance five products plus the final View all card while the scene remains pinned.
| This is deliberately shared by desktop and mobile so the interaction model
| does not change between breakpoints.
|
*/

const FEATURED_GROCERY_PALETTES = [
  {
    base: '#C99A25',
    deep: '#76500D',
    glow: '#F4D472',
  },
  {
    base: '#A83C46',
    deep: '#541821',
    glow: '#DF7A82',
  },
  {
    base: '#7EA14E',
    deep: '#3F5D25',
    glow: '#BFD78A',
  },
  {
    base: '#526D3D',
    deep: '#26351E',
    glow: '#8DAA6F',
  },
  {
    base: '#8C6A50',
    deep: '#493326',
    glow: '#C8A68B',
  },
]

function getFeaturedGroceryPalette(
  product,
  index,
) {
  const identity =
    `${product?.name || ''} ${product?.subCategory || ''} ${product?.brand || ''}`
      .toLowerCase()

  if (
    identity.includes('mango') ||
    identity.includes('aam')
  ) {
    return FEATURED_GROCERY_PALETTES[0]
  }

  if (
    identity.includes('pomegranate') ||
    identity.includes('anar')
  ) {
    return FEATURED_GROCERY_PALETTES[1]
  }

  if (
    identity.includes('bottle gourd') ||
    identity.includes('lauki') ||
    identity.includes('gourd')
  ) {
    return FEATURED_GROCERY_PALETTES[2]
  }

  if (
    identity.includes('matcha') ||
    identity.includes('green tea') ||
    identity.includes('tea')
  ) {
    return FEATURED_GROCERY_PALETTES[3]
  }

  return FEATURED_GROCERY_PALETTES[
    index %
      FEATURED_GROCERY_PALETTES.length
  ]
}

function FeaturedGroceryScrollStory({
  products,
  onAddToCart,
  shouldReduceMotion,
  entranceEdgeOpacity,
  entranceScale,
  entranceLift,
}) {
  const productItems =
    Array.isArray(products)
      ? products.slice(0, 5)
      : []

  const items = [
    ...productItems,
    {
      id: 'featured-grocery-view-all',
      name: 'View all',
      subCategory: 'Grocery catalogue',
      path: '/grocery',
      isViewAll: true,
    },
  ]

  const sectionRef =
    useRef(null)

  const animationFrameRef =
    useRef(null)

  const lastActiveIndexRef =
    useRef(0)

  const [
    activeIndex,
    setActiveIndex,
  ] = useState(0)

  const [
    direction,
    setDirection,
  ] = useState(1)

  useEffect(
    () => {
      if (
        items.length <= 1 ||
        typeof window === 'undefined'
      ) {
        return undefined
      }

      const resolveActiveIndex = () => {
        const section = sectionRef.current
        if (!section) {
          return 0
        }

        const sectionRect = section.getBoundingClientRect()
        // 100svh does not change when mobile browser chrome expands or
        // collapses. Use the real sticky panel's height, not innerHeight.
        const stickyHeight =
          section.firstElementChild?.getBoundingClientRect().height ||
          sectionRect.height
        const travel = Math.max(sectionRect.height - stickyHeight, 1)
        const progress = Math.min(
          Math.max(-sectionRect.top / travel, 0),
          1,
        )

        return Math.min(
          items.length - 1,
          Math.floor(Math.min(progress * items.length, items.length - 0.0001)),
        )
      }

      const updateActiveCard = () => {
        animationFrameRef.current = null
        const nextIndex = resolveActiveIndex()

        if (nextIndex !== lastActiveIndexRef.current) {
          setDirection(nextIndex > lastActiveIndexRef.current ? 1 : -1)
          lastActiveIndexRef.current = nextIndex
          setActiveIndex(nextIndex)
        }
      }

      const scheduleUpdate = () => {
        if (animationFrameRef.current === null) {
          animationFrameRef.current = window.requestAnimationFrame(
            updateActiveCard,
          )
        }
      }

      // Initial sync also handles browser back/forward scroll restoration.
      updateActiveCard()
      window.addEventListener('scroll', scheduleUpdate, { passive: true })
      window.addEventListener('resize', scheduleUpdate)
      window.addEventListener('pageshow', scheduleUpdate)

      return () => {
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        window.removeEventListener('scroll', scheduleUpdate)
        window.removeEventListener('resize', scheduleUpdate)
        window.removeEventListener('pageshow', scheduleUpdate)
      }
    },
    [items.length],
  )

  if (productItems.length === 0) {
    return (
      <section className="relative z-30 h-[100svh] overflow-hidden bg-[#26351E] shadow-[0_-22px_74px_rgba(17,24,39,0.16)]">
        <div className="page-shell flex h-full items-center justify-center">
          <EmptyState
            message="Featured grocery products will appear here once catalog data is available."
          />
        </div>
      </section>
    )
  }

  const resolvedActiveIndex =
    Math.min(
      activeIndex,
      items.length - 1,
    )

  const activeProduct =
    items[
      resolvedActiveIndex
    ]

  const isViewAll =
    activeProduct?.isViewAll ===
    true

  const previousProduct =
    resolvedActiveIndex > 0
      ? items[
          resolvedActiveIndex - 1
        ]
      : null

  const nextProduct =
    resolvedActiveIndex <
    items.length - 1
      ? items[
          resolvedActiveIndex + 1
        ]
      : null

  const activeNutrition =
    isViewAll
      ? []
      : getProductNutrition(
          activeProduct,
        ).slice(
          0,
          6,
        )

  const mobileNutrition =
    activeNutrition

  const productPath =
    activeProduct?.path ||
    (activeProduct?.slug
      ? `/grocery/product/${activeProduct.slug}`
      : '/grocery')

  const productKey =
    activeProduct?.id ||
    activeProduct?.slug ||
    `featured-product-${resolvedActiveIndex}`

  const palette =
    isViewAll
      ? {
          base: '#315A42',
          deep: '#153323',
          glow: '#8CB795',
        }
      : getFeaturedGroceryPalette(
          activeProduct,
          resolvedActiveIndex,
        )

  const motionDuration =
    shouldReduceMotion
      ? 0
      : 0.58

  /*
   * Keep one viewport for the sticky surface, with a consistent 70svh
   * scroll interval per card. All products and View all still get their
   * own stage, and the sticky surface releases without a blank spacer.
   */
  const storyHeight =
    `${Math.max(items.length * 70 + 100, 200)}svh`

  return (
    <section
      ref={sectionRef}
      className="relative z-30 isolate shadow-[0_-22px_74px_rgba(17,24,39,0.16)]"
      style={{
        height:
          storyHeight,
      }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden [perspective:1800px]">
        {/* The Grocery scene is one elevated surface. Scaling its inner plane
            (not the sticky viewport) exposes the retreating Explore scene
            along the sides and avoids sticky-position transform jitter. */}
        <motion.div
          className="relative h-full w-full overflow-hidden bg-[#26351E] shadow-[0_-40px_120px_-24px_rgba(0,0,0,0.75)] [backface-visibility:hidden]"
          style={{
            scale:
              entranceScale,
            y:
              entranceLift,
            transformOrigin:
              '50% 0%',
          }}
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-40 h-[16px] bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.06)_30%,transparent_100%)]"
            style={{
              opacity:
                entranceEdgeOpacity,
            }}
          />

        {/* Product-driven colour field. */}
        <AnimatePresence
          mode="sync"
          initial={false}
        >
          <motion.div
            key={`grocery-background-${productKey}`}
            aria-hidden="true"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration:
                shouldReduceMotion
                  ? 0
                  : 0.6,

              ease: [
                0.22,
                1,
                0.36,
                1,
              ],
            }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 52% 42%, ${palette.glow} 0%, ${palette.base} 38%, ${palette.deep} 100%)`,
            }}
          >
            {activeProduct?.image && (
              <img
                src={activeProduct.image}
                alt=""
                className="absolute left-1/2 top-1/2 h-[125%] w-[125%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.10] blur-[26px] saturate-110 sm:opacity-[0.11] lg:opacity-[0.13] lg:blur-[34px]"
              />
            )}

            <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(8,12,9,0.50)_0%,rgba(8,12,9,0.20)_44%,rgba(8,12,9,0.28)_66%,rgba(8,12,9,0.58)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.08),transparent_54%)]" />
          </motion.div>
        </AnimatePresence>

        <div className="page-shell relative z-10 flex h-full min-h-0 flex-col pb-3 pt-[76px] text-white sm:pb-4 sm:pt-[82px] md:pt-[138px] lg:pt-[138px] xl:pb-6 xl:pt-[86px]">

          <div className="flex shrink-0 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.24em] text-white/92 sm:text-[10px] lg:text-[15px]">
                Featured Grocery
              </p>


              <p className="shrink-0 text-[9px] font-black tabular-nums tracking-[0.15em] text-white/56 sm:text-[10px] lg:text-[13px]">
                {String(resolvedActiveIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
              </p>
            </div>

            <Link
              to="/grocery"
              className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/24 bg-black/15 px-3 text-[9px] font-black text-white shadow-sm backdrop-blur-md transition hover:bg-black/24 sm:h-9 sm:px-3.5 sm:text-[10px] lg:h-10 lg:px-4 lg:text-xs"
            >
              Explore Grocery
              <ArrowRight
                size={13}
                aria-hidden="true"
              />
            </Link>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 py-3 sm:gap-3 sm:py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(390px,1.2fr)_minmax(0,0.9fr)] lg:grid-rows-1 lg:items-center lg:gap-8 lg:py-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.18fr)_minmax(0,0.92fr)] xl:gap-11">

            {/* Left: current product identity. */}
            <div className="min-w-0 lg:self-center lg:pb-9 lg:pr-3">
              <AnimatePresence
                mode="wait"
                initial={false}
              >
                <motion.div
                  key={`grocery-copy-${productKey}`}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y:
                            direction > 0
                              ? 26
                              : -26,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          y:
                            direction > 0
                              ? -18
                              : 18,
                        }
                  }
                  transition={{
                    duration:
                      motionDuration,

                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                  className="flex min-w-0 flex-col items-start justify-center text-left"
                >
                  <div className="min-w-0 w-full">
                    <div className="flex min-w-0 items-center gap-3">
                      <span aria-hidden="true" className="h-[2px] w-8 shrink-0 bg-white/85 sm:w-10" />
                      <p className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80 sm:text-xs lg:text-[13px]">
                        {activeProduct?.subCategory || 'Grocery'}
                      </p>
                    </div>

                    <h2 className="mt-3 max-w-[92vw] break-words text-[clamp(27px,7.5vw,38px)] font-black leading-[1.03] tracking-[-0.047em] text-white [text-wrap:balance] sm:mt-4 sm:max-w-[520px] sm:text-[clamp(34px,6vw,48px)] lg:mt-5 lg:max-w-full lg:text-[clamp(34px,3.05vw,53px)] lg:leading-[1.04] xl:text-[clamp(38px,3.2vw,56px)]">
                      {activeProduct?.name || 'Grocery Product'}
                    </h2>
                  </div>

                  {(activeProduct?.quantity || activeProduct?.unit || activeProduct?.brand) && (
                    <div className="mt-4 flex w-full max-w-[390px] flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/30 pt-3 sm:mt-5 sm:pt-4 lg:mt-7 lg:pt-5">
                      {(activeProduct?.quantity || activeProduct?.unit) && (
                        <p className="text-base font-bold tracking-[-0.025em] text-white sm:text-lg lg:text-[22px]">
                          {activeProduct?.quantity}{activeProduct?.quantity && activeProduct?.unit ? ' ' : ''}{activeProduct?.unit || ''}
                        </p>
                      )}

                      {activeProduct?.brand && (
                        <p className="min-w-0 text-xs font-semibold tracking-[0.02em] text-white/75 sm:text-sm lg:text-[15px]">
                          {activeProduct.brand}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Centre: active visual remains crisp while the scene scrolls. */}
            <div className="relative flex min-h-0 flex-col items-center justify-center lg:h-full lg:py-[8svh]">

              {previousProduct?.image && (
                <motion.div
                  key={`grocery-previous-${previousProduct.id || previousProduct.slug || resolvedActiveIndex}`}
                  aria-hidden="true"
                  initial={false}
                  animate={{
                    opacity:
                      shouldReduceMotion
                        ? 0
                        : 0.24,
                    y: 0,
                  }}
                  className="pointer-events-none absolute left-1/2 top-0 hidden aspect-[1.25/1] w-[32%] -translate-x-1/2 overflow-hidden rounded-[16px] border border-white/18 bg-black/12 shadow-lg backdrop-blur-sm lg:block"
                >
                  <img
                    src={previousProduct.image}
                    alt=""
                    className="h-full w-full object-contain opacity-80"
                  />
                </motion.div>
              )}

              <AnimatePresence
                mode="popLayout"
                initial={false}
                custom={direction}
              >
                <motion.div
                  key={`grocery-visual-${productKey}`}
                  custom={direction}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y:
                            direction > 0
                              ? 110
                              : -110,
                          scale: 0.88,
                          rotate:
                            direction > 0
                              ? 1.8
                              : -1.8,
                        }
                  }
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    rotate: 0,
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          y:
                            direction > 0
                              ? -110
                              : 110,
                          scale: 0.91,
                          rotate:
                            direction > 0
                              ? -1.4
                              : 1.4,
                        }
                  }
                  transition={{
                    duration:
                      motionDuration,

                    ease: [
                      0.2,
                      0.86,
                      0.24,
                      1,
                    ],
                  }}
                  className="relative flex min-h-0 w-full flex-1 items-center justify-center lg:absolute lg:inset-0 lg:[perspective:1500px]"
                  style={{
                    willChange:
                      'transform, opacity',
                  }}
                >
                  <Link
                    to={productPath}
                    className={`focus-ring group relative block h-[min(30svh,292px)] w-[min(78vw,380px)] overflow-hidden rounded-[22px] sm:h-[min(34svh,350px)] sm:w-[min(66vw,460px)] sm:rounded-[26px] lg:h-auto lg:aspect-[1.12/1] lg:w-[min(34vw,520px)] lg:rounded-[28px] xl:rounded-[30px] ${isViewAll
                      ? 'border border-white/38 bg-white/92 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.24)] sm:p-5 lg:p-6 xl:p-7'
                      : 'border border-white/35 bg-white p-0 shadow-[12px_28px_70px_rgba(0,0,0,0.38),-5px_-5px_24px_rgba(255,255,255,0.08)] transition-[transform,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:[transform:rotateY(-5deg)_rotateX(2deg)] lg:hover:[transform:rotateY(0deg)_rotateX(0deg)_translateY(-6px)] lg:hover:shadow-[0_38px_90px_rgba(0,0,0,0.42)] motion-reduce:transition-none'
                    }`}
                    aria-label={
                      isViewAll
                        ? 'View all grocery products'
                        : undefined
                    }
                  >
                    {isViewAll ? (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,1),rgba(249,250,247,0.95)_58%,rgba(231,235,228,0.86)_100%)]" />
                    ) : null}

                    {isViewAll ? (
                      <div className="relative flex h-full flex-col items-center justify-center px-5 text-center text-[#153323]">
                        <div className="mb-5 flex -space-x-4 sm:mb-6">
                          {productItems.slice(0, 3).map((item, previewIndex) => (
                            <span
                              key={`view-all-grocery-preview-${item.id || item.slug || previewIndex}`}
                              className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border-2 border-white bg-[#F8FAF7] shadow-md sm:h-16 sm:w-16"
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  className="h-full w-full object-contain p-1.5"
                                />
                              ) : (
                                <Package
                                  size={24}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          ))}
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#315A42]/65 sm:text-xs">
                          Explore the full grocery catalogue
                        </p>

                        <h3 className="mt-2 text-[clamp(32px,9vw,52px)] font-black leading-none tracking-[-0.05em] sm:text-[54px]">
                          View all
                        </h3>

                        <span className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#153323] px-5 text-xs font-black text-white shadow-[0_12px_28px_rgba(21,51,35,0.22)] transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-[#214D33]">
                          Explore Grocery
                          <ArrowRight
                            size={15}
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center">
                        {activeProduct?.image ? (
                          <img
                            src={activeProduct.image}
                            alt={activeProduct?.name || 'Grocery product'}
                            className="block h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[#166534]">
                            <Package
                              size={54}
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {!isViewAll ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_2px_0_rgba(255,255,255,0.48),inset_-10px_0_18px_-15px_rgba(0,0,0,0.45)]"
                      />
                    ) : null}
                  </Link>
                </motion.div>
              </AnimatePresence>

              {/* Actions intentionally arrive from the right and sit under the active card. */}
              {!isViewAll && (
                <AnimatePresence
                  mode="wait"
                  initial={false}
                >
                  <motion.div
                    key={`grocery-actions-${productKey}`}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          x: 90,
                          y: 8,
                        }
                  }
                  animate={{
                    opacity: 1,
                    x: 0,
                    y: 0,
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          x: -38,
                          y: -4,
                        }
                  }
                  transition={{
                    duration:
                      shouldReduceMotion
                        ? 0
                        : 0.68,

                    delay:
                      shouldReduceMotion
                        ? 0
                        : 0.08,

                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                  className="relative z-20 mt-2 grid w-[min(78vw,380px)] grid-cols-2 gap-2 sm:mt-3 sm:w-[min(66vw,460px)] lg:absolute lg:bottom-[2.4svh] lg:left-1/2 lg:w-[min(34vw,520px)] lg:-translate-x-1/2"
                >
                  <Link
                    to={productPath}
                    className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/28 bg-black/24 px-3 text-[10px] font-black text-white shadow-sm backdrop-blur-md transition hover:bg-black/34 sm:h-10 sm:text-[11px] lg:h-11 lg:text-xs"
                  >
                    <Eye
                      size={14}
                      aria-hidden="true"
                    />
                    View product
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      onAddToCart(
                        activeProduct,
                      )
                    }
                    className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[10px] font-black text-[#132016] shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:bg-white sm:h-10 sm:text-[11px] lg:h-11 lg:text-xs"
                  >
                    <ShoppingBasket
                      size={14}
                      aria-hidden="true"
                    />
                    Add to cart
                  </button>
                  </motion.div>
                </AnimatePresence>
              )}

              {nextProduct?.image && (
                <motion.div
                  key={`grocery-next-${nextProduct.id || nextProduct.slug || resolvedActiveIndex}`}
                  aria-hidden="true"
                  initial={false}
                  animate={{
                    opacity:
                      shouldReduceMotion
                        ? 0
                        : 0.16,
                  }}
                  className="pointer-events-none absolute bottom-0 left-1/2 hidden aspect-[1.25/1] w-[27%] -translate-x-1/2 translate-y-[36%] overflow-hidden rounded-[14px] border border-white/14 bg-black/10 shadow-lg backdrop-blur-sm lg:block"
                >
                  <img
                    src={nextProduct.image}
                    alt=""
                    className="h-full w-full object-contain opacity-80"
                  />
                </motion.div>
              )}
            </div>

            {/* Right: approved Nutrition. Mobile keeps the same content below the visual. */}
            <div className="min-w-0 lg:self-center lg:pb-9">
              <AnimatePresence
                mode="wait"
                initial={false}
              >
                <motion.div
                  key={`grocery-nutrition-${productKey}`}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          x:
                            direction > 0
                              ? 26
                              : -12,
                        }
                  }
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  exit={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          x:
                            direction > 0
                              ? -18
                              : 18,
                        }
                  }
                  transition={{
                    duration:
                      motionDuration,

                    delay:
                      shouldReduceMotion
                        ? 0
                        : 0.04,

                    ease: [
                      0.22,
                      1,
                      0.36,
                      1,
                    ],
                  }}
                  className="rounded-[18px] border border-white/14 bg-black/10 p-3 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
                >
                  {isViewAll ? (
                    <div className="flex min-h-[92px] items-center justify-between gap-4 lg:min-h-0 lg:block">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/88 lg:text-[10px] lg:tracking-[0.24em]">
                          All Grocery
                        </p>
                        <p className="mt-1 max-w-[280px] text-[10px] font-semibold leading-4 text-white/55 sm:text-xs lg:mt-3 lg:text-sm lg:leading-6">
                          Continue to the full EPANTRY grocery catalogue.
                        </p>
                      </div>

                      <ArrowRight
                        size={20}
                        aria-hidden="true"
                        className="shrink-0 text-white/70 lg:mt-5"
                      />
                    </div>
                  ) : (
                    <>
                  <div className="flex items-end justify-between gap-4 border-b border-white/18 pb-2.5 lg:max-w-[340px] lg:pb-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/88 lg:text-[13px] lg:tracking-[0.24em]">
                        Nutrition
                      </p>
                      <p className="mt-0.5 hidden text-xs font-semibold text-white/46 sm:block lg:text-sm">
                        Approved product information
                      </p>
                    </div>

                    <span className="text-[9px] font-black tabular-nums text-white/38 lg:text-xs">
                      {String(resolvedActiveIndex + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {(activeNutrition.length > 0) ? (
                    <>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 lg:hidden">
                        {mobileNutrition.map(
                          (
                            nutrient,
                            nutrientIndex,
                          ) => (
                            <div
                              key={
                                nutrient.key ||
                                nutrient.name ||
                                `${productKey}-mobile-nutrition-${nutrientIndex}`
                              }
                              className="flex min-h-[26px] items-center justify-between gap-2 py-1"
                            >
                              <span className="min-w-0 pr-1 text-[8px] font-bold leading-3 text-white/58 sm:text-[10px] sm:leading-4">
                                {nutrient.name || nutrient.key || 'Nutrient'}
                              </span>

                              <span className="shrink-0 text-[9px] font-black text-white sm:text-[10px]">
                                {formatNutritionValue(
                                  nutrient.amount,
                                  nutrient.unit,
                                )}
                              </span>
                            </div>
                          ),
                        )}
                      </div>

                      <div className="mt-4 hidden space-y-1 lg:block lg:max-w-[340px]">
                        {activeNutrition.map(
                          (
                            nutrient,
                            nutrientIndex,
                          ) => (
                            <div
                              key={
                                nutrient.key ||
                                nutrient.name ||
                                `${productKey}-nutrition-${nutrientIndex}`
                              }
                              className="flex items-center justify-between gap-5 border-b border-white/[0.10] py-2.5"
                            >
                              <span className="min-w-0 truncate text-[14px] font-bold text-white/52">
                                {nutrient.name || nutrient.key || 'Nutrient'}
                              </span>

                              <span className="shrink-0 text-[14px] font-black text-white">
                                {formatNutritionValue(
                                  nutrient.amount,
                                  nutrient.unit,
                                )}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 text-[10px] font-semibold leading-4 text-white/48 sm:text-xs lg:mt-5 lg:max-w-[270px] lg:text-sm lg:leading-6">
                      Approved nutrition is not available for this product yet.
                    </p>
                  )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
        </motion.div>
      </div>
    </section>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Recipes Scroll Story
|--------------------------------------------------------------------------
*/

const FEATURED_RECIPE_CAMERA_SEQUENCE = [
  2,
  0,
  3,
  1,
]

const RECIPE_WORLD_GEOMETRY = {
  mobile: {
    centerScale: 0.88,
    scaleDrop: 0.14,
    minScale: 0.58,
    xRatio: 0.72,
    xCurve: 0.82,
    maxXRatio: 0.98,
    yStep: 18,
    zStep: 140,
    rotateY: 10,
    rotateZ: 1.1,
  },
  desktop: {
    centerScale: 1,
    scaleDrop: 0.19,
    minScale: 0.58,
    xRatio: 0.34,
    xCurve: 0.84,
    maxXRatio: 0.58,
    yStep: 24,
    zStep: 210,
    rotateY: 14,
    rotateZ: 1.5,
  },
}

const RECIPE_STAGE_SHARDS = [
  { left: '3%', top: '79%', size: 48, rotate: -17, opacity: 0.42 },
  { left: '10%', top: '72%', size: 34, rotate: 26, opacity: 0.32 },
  { left: '18%', top: '84%', size: 64, rotate: -38, opacity: 0.48 },
  { left: '27%', top: '75%', size: 40, rotate: 11, opacity: 0.36 },
  { left: '37%', top: '87%', size: 58, rotate: 41, opacity: 0.44 },
  { left: '48%', top: '73%', size: 42, rotate: -11, opacity: 0.34 },
  { left: '56%', top: '86%', size: 72, rotate: 19, opacity: 0.46 },
  { left: '66%', top: '77%', size: 44, rotate: -32, opacity: 0.38 },
  { left: '76%', top: '88%', size: 58, rotate: 27, opacity: 0.42 },
  { left: '86%', top: '74%', size: 38, rotate: -9, opacity: 0.30 },
  { left: '93%', top: '85%', size: 66, rotate: 34, opacity: 0.40 },
]

function clampRecipeStoryValue(
  value,
  min = 0,
  max = 1,
) {
  return Math.min(
    Math.max(
      value,
      min,
    ),
    max,
  )
}

function smoothRecipeStoryStep(
  value,
) {
  const resolved =
    clampRecipeStoryValue(
      value,
    )

  return (
    resolved *
    resolved *
    (3 - 2 * resolved)
  )
}

function recipePath(
  recipe,
) {
  return (
    recipe?.path ||
    (recipe?.slug
      ? `/recipes/${recipe.slug}`
      : '/recipes')
  )
}

function FeaturedRecipesScrollStory({
  recipes,
  shouldReduceMotion,
}) {
  const sectionRef =
    useRef(null)

  const stageRef =
    useRef(null)

  const animationFrameRef =
    useRef(null)

  const pointerFrameRef =
    useRef(null)

  const pointerTargetRef =
    useRef({
      x: 0.5,
      y: 0.34,
    })

  const pointerCurrentRef =
    useRef({
      x: 0.5,
      y: 0.34,
    })

  const [
    storyProgress,
    setStoryProgress,
  ] = useState(0)

  const [
    mobileOpenKey,
    setMobileOpenKey,
  ] = useState('')

  const worldRecipes =
    (recipes || []).slice(
      0,
      4,
    )

  const storyItems = [
    ...worldRecipes.map(
      (recipe) => ({
        type: 'recipe',
        recipe,
        key:
          recipe.id ||
          recipe.slug ||
          recipe.name,
      }),
    ),
    {
      type: 'view-all',
      key: 'view-all-recipes',
    },
  ]

  const preferredFocusSequence = [
    ...FEATURED_RECIPE_CAMERA_SEQUENCE,
    storyItems.length - 1,
  ]

  const focusSequence =
    preferredFocusSequence
      .filter(
        (itemIndex, index, all) =>
          itemIndex >= 0 &&
          itemIndex < storyItems.length &&
          all.indexOf(
            itemIndex,
          ) === index,
      )

  for (
    let itemIndex = 0;
    itemIndex < storyItems.length;
    itemIndex += 1
  ) {
    if (
      !focusSequence.includes(
        itemIndex,
      )
    ) {
      focusSequence.push(
        itemIndex,
      )
    }
  }

  /*
   * The reference keeps every card planted in one physical row and moves the
   * camera forward through that row. The requested focus order is therefore
   * also the left-to-right stage order. This avoids the backwards camera jumps
   * caused by keeping the original recipe array order in the world.
   */
  const cameraItems =
    focusSequence
      .map(
        (itemIndex) =>
          storyItems[
            itemIndex
          ],
      )
      .filter(Boolean)

  /*
   * Timeline (viewport scroll units):
   * 0     = closed intro title
   * 0-1   = curtain opens with the third recipe already framed
   * 1-5   = camera travels 3rd -> 1st -> 4th -> 2nd -> View all
   * 5-6   = curtain closes over the final camera position
   * 6-7   = closed outro title hold
   *
   * The cards stay fixed in one horizontal world in the requested focus
   * sequence. Scroll moves the camera monotonically across that world; cards
   * never jump or swap positions.
   */
  const storyHeight =
    '590svh'

  useEffect(
    () => {
      if (typeof window === 'undefined') {
        return undefined
      }

      const isMobile = window.matchMedia('(max-width: 767px)').matches
      let lastRendered = -1
      let lastFrameTime = -Infinity

      const resolveProgress = () => {
        const section = sectionRef.current
        if (!section) {
          return 0
        }

        const sectionRect = section.getBoundingClientRect()
        // Match the 100svh sticky stage, independent of mobile browser UI.
        const stickyHeight =
          stageRef.current?.getBoundingClientRect().height ||
          sectionRect.height
        const travel = Math.max(sectionRect.height - stickyHeight, 1)

        return clampRecipeStoryValue((-sectionRect.top / travel) * 7, 0, 7)
      }

      const updateProgress = (frameTime) => {
        animationFrameRef.current = null
        const next = resolveProgress()
        // Complex 3D recipe cards redraw in React; cap minor updates on
        // mobile while keeping big flings responsive and final state exact.
        if (
          isMobile &&
          frameTime - lastFrameTime < 32 &&
          Math.abs(next - lastRendered) < 0.18
        ) {
          animationFrameRef.current = window.requestAnimationFrame(updateProgress)
          return
        }

        if (Math.abs(next - lastRendered) > 0.001) {
          lastRendered = next
          lastFrameTime = frameTime
          setStoryProgress(next)
        }
      }

      const scheduleProgress = () => {
        if (animationFrameRef.current === null) {
          animationFrameRef.current = window.requestAnimationFrame(updateProgress)
        }
      }

      // Sync directly on mount, including browser scroll restoration.
      lastRendered = resolveProgress()
      setStoryProgress(lastRendered)
      window.addEventListener('scroll', scheduleProgress, { passive: true })
      window.addEventListener('resize', scheduleProgress)
      window.addEventListener('pageshow', scheduleProgress)

      return () => {
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        window.removeEventListener('scroll', scheduleProgress)
        window.removeEventListener('resize', scheduleProgress)
        window.removeEventListener('pageshow', scheduleProgress)
      }
    },
    [],
  )

  useEffect(
    () => {
      if (
        shouldReduceMotion ||
        typeof window ===
          'undefined'
      ) {
        return undefined
      }

      const animatePointer =
        () => {
          pointerFrameRef.current =
            null

          const current =
            pointerCurrentRef.current

          const target =
            pointerTargetRef.current

          const nextX =
            current.x +
            (target.x - current.x) *
              0.09

          const nextY =
            current.y +
            (target.y - current.y) *
              0.09

          pointerCurrentRef.current = {
            x: nextX,
            y: nextY,
          }

          const stage =
            stageRef.current

          if (stage) {
            stage.style.setProperty(
              '--recipe-pointer-x',
              `${(
                nextX *
                100
              ).toFixed(2)}%`,
            )

            stage.style.setProperty(
              '--recipe-pointer-y',
              `${(
                nextY *
                100
              ).toFixed(2)}%`,
            )

            stage.style.setProperty(
              '--recipe-pointer-nx',
              (
                (nextX - 0.5) *
                2
              ).toFixed(4),
            )

            stage.style.setProperty(
              '--recipe-pointer-ny',
              (
                (nextY - 0.5) *
                2
              ).toFixed(4),
            )
          }

          if (
            Math.abs(
              target.x - nextX,
            ) > 0.0005 ||
            Math.abs(
              target.y - nextY,
            ) > 0.0005
          ) {
            pointerFrameRef.current =
              window.requestAnimationFrame(
                animatePointer,
              )
          }
        }

      const ensurePointerFrame =
        () => {
          if (
            pointerFrameRef.current ===
            null
          ) {
            pointerFrameRef.current =
              window.requestAnimationFrame(
                animatePointer,
              )
          }
        }

      ensurePointerFrame()

      return () => {
        if (
          pointerFrameRef.current !==
          null
        ) {
          window.cancelAnimationFrame(
            pointerFrameRef.current,
          )
        }
      }
    },
    [shouldReduceMotion],
  )

  const handlePointerMove =
    (event) => {
      if (
        shouldReduceMotion ||
        event.pointerType ===
          'touch'
      ) {
        return
      }

      const stage =
        stageRef.current

      if (!stage) {
        return
      }

      const rect =
        stage.getBoundingClientRect()

      pointerTargetRef.current = {
        x:
          clampRecipeStoryValue(
            (
              event.clientX -
              rect.left
            ) /
              Math.max(
                rect.width,
                1,
              ),
          ),
        y:
          clampRecipeStoryValue(
            (
              event.clientY -
              rect.top
            ) /
              Math.max(
                rect.height,
                1,
              ),
          ),
      }

      if (
        pointerFrameRef.current ===
        null &&
        typeof window !==
          'undefined'
      ) {
        pointerFrameRef.current =
          window.requestAnimationFrame(
            function movePointerFrame() {
              pointerFrameRef.current =
                null

              const current =
                pointerCurrentRef.current

              const target =
                pointerTargetRef.current

              const nextX =
                current.x +
                (target.x - current.x) *
                  0.12

              const nextY =
                current.y +
                (target.y - current.y) *
                  0.12

              pointerCurrentRef.current = {
                x: nextX,
                y: nextY,
              }

              const currentStage =
                stageRef.current

              if (currentStage) {
                currentStage.style.setProperty(
                  '--recipe-pointer-x',
                  `${(
                    nextX *
                    100
                  ).toFixed(2)}%`,
                )

                currentStage.style.setProperty(
                  '--recipe-pointer-y',
                  `${(
                    nextY *
                    100
                  ).toFixed(2)}%`,
                )

                currentStage.style.setProperty(
                  '--recipe-pointer-nx',
                  (
                    (nextX - 0.5) *
                    2
                  ).toFixed(4),
                )

                currentStage.style.setProperty(
                  '--recipe-pointer-ny',
                  (
                    (nextY - 0.5) *
                    2
                  ).toFixed(4),
                )
              }

              if (
                Math.abs(
                  target.x - nextX,
                ) > 0.0005 ||
                Math.abs(
                  target.y - nextY,
                ) > 0.0005
              ) {
                pointerFrameRef.current =
                  window.requestAnimationFrame(
                    movePointerFrame,
                  )
              }
            },
          )
      }
    }

  const handlePointerLeave =
    () => {
      pointerTargetRef.current = {
        x: 0.5,
        y: 0.34,
      }
    }

  const openingProgress =
    shouldReduceMotion
      ? 1
      : smoothRecipeStoryStep(
          storyProgress,
        )

  const closingProgress =
    shouldReduceMotion
      ? 0
      : smoothRecipeStoryStep(
          storyProgress -
            5,
        )

  const curtainOpenAmount =
    shouldReduceMotion
      ? 1
      : clampRecipeStoryValue(
          openingProgress -
            closingProgress,
        )

  const focusTravelProgress =
    clampRecipeStoryValue(
      storyProgress -
        1,
      0,
      Math.max(
        cameraItems.length -
          1,
        0,
      ),
    )

  const focusSegmentIndex =
    Math.min(
      Math.floor(
        focusTravelProgress,
      ),
      Math.max(
        cameraItems.length -
          1,
        0,
      ),
    )

  const focusSegmentLocalProgress =
    focusTravelProgress -
    focusSegmentIndex

  /*
   * Keep each target card visually settled for a short beat, then move the
   * camera through the fixed row. The cards themselves never translate.
   */
  const focusSegmentProgress =
    smoothRecipeStoryStep(
      clampRecipeStoryValue(
        (
          focusSegmentLocalProgress -
          0.14
        ) /
          0.72,
      ),
    )

  const cameraFromSlot =
    focusSegmentIndex

  const cameraToSlot =
    Math.min(
      focusSegmentIndex +
        1,
      Math.max(
        cameraItems.length -
          1,
        0,
      ),
    )

  const cameraWorldSlot =
    storyProgress < 1
      ? 0
      : cameraFromSlot +
        (
          cameraToSlot -
          cameraFromSlot
        ) *
          focusSegmentProgress

  const activeSequenceIndex =
    Math.min(
      Math.max(
        Math.round(
          focusTravelProgress,
        ),
        0,
      ),
      Math.max(
        cameraItems.length -
          1,
        0,
      ),
    )

  const activeItem =
    cameraItems[
      activeSequenceIndex
    ] ||
    null

  const activeItemKey =
    activeItem?.key ||
    'recipe-story-empty'

  const introOpacity =
    shouldReduceMotion
      ? 0
      : clampRecipeStoryValue(
          1 -
            storyProgress /
              0.72,
        )

  const outroOpacity =
    shouldReduceMotion
      ? 0
      : clampRecipeStoryValue(
          (
            storyProgress -
            5.82
          ) /
            0.34,
        )

  const cardOpacity =
    shouldReduceMotion
      ? 1
      : clampRecipeStoryValue(
          Math.min(
            storyProgress,
            6 -
              storyProgress,
          ) /
            0.72,
        )

  const activeCardCentered =
    Math.abs(
      cameraWorldSlot -
        activeSequenceIndex,
    ) < 0.12

  useEffect(
    () => {
      if (
        typeof window ===
          'undefined' ||
        !activeItem ||
        activeItem.type !==
          'recipe' ||
        !activeCardCentered ||
        !window.matchMedia(
          '(max-width: 767px)',
        ).matches
      ) {
        setMobileOpenKey('')
        return undefined
      }

      const openTimer =
        window.setTimeout(
          () => {
            setMobileOpenKey(
              activeItemKey,
            )
          },
          shouldReduceMotion
            ? 0
            : 280,
        )

      const closeTimer =
        window.setTimeout(
          () => {
            setMobileOpenKey('')
          },
          shouldReduceMotion
            ? 400
            : 1550,
        )

      return () => {
        window.clearTimeout(
          openTimer,
        )

        window.clearTimeout(
          closeTimer,
        )
      }
    },
    [
      activeItemKey,
      activeItem?.type,
      activeCardCentered,
      shouldReduceMotion,
    ],
  )

  if (
    storyItems.length ===
    1 &&
    storyItems[0]?.type ===
      'view-all'
  ) {
    return (
      <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black text-white">
        <Link
          to="/recipes"
          className="focus-ring rounded-full border border-red-500/40 px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-red-400"
        >
          Explore Recipes
        </Link>
      </section>
    )
  }

  return (
    <section
      ref={sectionRef}
      className="relative z-20 isolate bg-black"
      style={{
        height:
          storyHeight,
      }}
    >
      <motion.div
        ref={stageRef}
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                y: 54,
              }
        }
        whileInView={{
          opacity: 1,
          y: 0,
        }}
        viewport={{
          once: true,
          amount: 0.08,
        }}
        transition={{
          duration:
            shouldReduceMotion
              ? 0
              : 0.9,
          ease: [
            0.22,
            1,
            0.36,
            1,
          ],
        }}
        onPointerMove={
          handlePointerMove
        }
        onPointerLeave={
          handlePointerLeave
        }
        className="sticky top-0 h-[100svh] overflow-hidden bg-[#020202] text-white"
        style={{
          '--recipe-pointer-x':
            '50%',
          '--recipe-pointer-y':
            '34%',
          '--recipe-pointer-nx':
            0,
          '--recipe-pointer-ny':
            0,
        }}
      >
        {/* Mouse-responsive red atmosphere from the supplied reference. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at var(--recipe-pointer-x) var(--recipe-pointer-y), rgba(235,0,0,0.42) 0%, rgba(155,0,0,0.24) 13%, rgba(45,0,0,0.10) 28%, transparent 48%), radial-gradient(circle at 50% 52%, rgba(95,0,0,0.22), transparent 48%), #020202',
          }}
        />

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[46%] origin-bottom"
          style={{
            perspective:
              '900px',
          }}
        >
          <div
            className="absolute -inset-x-[16%] -bottom-[32%] h-[150%] opacity-75"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,28,28,0.20) 1px, transparent 1px), linear-gradient(90deg, rgba(255,28,28,0.16) 1px, transparent 1px)',
              backgroundSize:
                '48px 48px',
              transform:
                'rotateX(66deg) translate3d(calc(var(--recipe-pointer-nx) * 8px), calc(var(--recipe-pointer-ny) * 5px), 0)',
              transformOrigin:
                'center bottom',
              transition:
                'transform 160ms linear',
              maskImage:
                'linear-gradient(to top, black 20%, rgba(0,0,0,0.92) 58%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to top, black 20%, rgba(0,0,0,0.92) 58%, transparent 100%)',
            }}
          />

          {RECIPE_STAGE_SHARDS.map(
            (
              shard,
              index,
            ) => (
              <span
                key={`recipe-stage-shard-${index}`}
                className="absolute bg-gradient-to-br from-[#F52323] via-[#780000] to-[#160000] shadow-[0_0_28px_rgba(255,0,0,0.12)]"
                style={{
                  left:
                    shard.left,
                  top:
                    shard.top,
                  width:
                    shard.size,
                  height:
                    shard.size *
                    0.66,
                  opacity:
                    shard.opacity,
                  clipPath:
                    'polygon(50% 0%, 100% 100%, 0% 78%)',
                  transform:
                    `rotate(${shard.rotate}deg) translate3d(calc(var(--recipe-pointer-nx) * ${index % 2 ? -4 : 4}px), calc(var(--recipe-pointer-ny) * ${index % 3 ? 3 : -3}px), 0)`,
                  transition:
                    'transform 180ms linear',
                }}
              />
            ),
          )}
        </div>

        {/* Intro / outro reference-style title. */}
        <RecipeStoryTitle
          opacity={
            Math.max(
              introOpacity,
              outroOpacity,
            )
          }
          closing={
            outroOpacity >
            introOpacity
          }
        />

        {/* Cards live behind the curtains. */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-center px-4 pb-9 pt-[78px] sm:px-8 sm:pb-10 sm:pt-[92px] lg:pb-12 lg:pt-[104px]"
          style={{
            opacity:
              cardOpacity,
            transform:
              `translate3d(calc(var(--recipe-pointer-nx) * -5px), calc(var(--recipe-pointer-ny) * -3px), 0)`,
            transition:
              'transform 170ms linear',
          }}
        >
          <div className="relative h-full w-full">
            <div className="absolute left-4 top-0 z-20 sm:left-6 lg:left-8">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/54 sm:text-[10px] lg:text-[12px]">
                Featured Recipes
              </p>
              <p className="mt-1 text-[9px] font-bold tabular-nums tracking-[0.14em] text-red-400/70 sm:text-[10px] lg:text-[11px]">
                {String(
                  activeSequenceIndex +
                    1,
                ).padStart(
                  2,
                  '0',
                )}{' '}
                /{' '}
                {String(
                  cameraItems.length,
                ).padStart(
                  2,
                  '0',
                )}
              </p>
            </div>

            <div className="absolute inset-0 overflow-hidden [perspective:1700px]">
              {(() => {
                const viewportWidth =
                  typeof window !==
                  'undefined'
                    ? window.innerWidth
                    : 1280

                const isMobileViewport =
                  viewportWidth <
                  768

                const geometry =
                  isMobileViewport
                    ? RECIPE_WORLD_GEOMETRY.mobile
                    : RECIPE_WORLD_GEOMETRY.desktop

                return (
                  <div className="absolute inset-0 [transform-style:preserve-3d]">
                    {cameraItems.map(
                      (
                        item,
                        stageIndex,
                      ) => {
                        const relativePosition =
                          stageIndex -
                          cameraWorldSlot

                        const distanceFromCamera =
                          Math.abs(
                            relativePosition,
                          )

                        const direction =
                          relativePosition ===
                          0
                            ? 0
                            : relativePosition >
                                0
                              ? 1
                              : -1

                        const isActive =
                          stageIndex ===
                          activeSequenceIndex

                        const curvedDistance =
                          Math.pow(
                            distanceFromCamera,
                            geometry.xCurve,
                          )

                        const xOffset =
                          direction *
                          Math.min(
                            viewportWidth *
                              geometry.xRatio *
                              curvedDistance,
                            viewportWidth *
                              geometry.maxXRatio,
                          )

                        const yOffset =
                          Math.min(
                            distanceFromCamera,
                            2.4,
                          ) *
                          geometry.yStep

                        const zOffset =
                          -Math.min(
                            distanceFromCamera,
                            2.6,
                          ) *
                          geometry.zStep

                        const cardScale =
                          Math.max(
                            geometry.minScale,
                            geometry.centerScale -
                              distanceFromCamera *
                                geometry.scaleDrop,
                          )

                        const rotateY =
                          -direction *
                          Math.min(
                            distanceFromCamera,
                            1.35,
                          ) *
                          geometry.rotateY

                        const rotateZ =
                          direction *
                          Math.min(
                            distanceFromCamera,
                            1,
                          ) *
                          geometry.rotateZ

                        const cardOpacity =
                          Math.max(
                            0.42,
                            1 -
                              distanceFromCamera *
                                0.18,
                          )

                        return (
                          <div
                            key={
                              item.key
                            }
                            className="absolute left-1/2 top-1/2 flex items-center justify-center [transform-style:preserve-3d]"
                            style={{
                              pointerEvents:
                                isActive &&
                                activeCardCentered
                                  ? 'auto'
                                  : 'none',
                              zIndex:
                                Math.round(
                                  80 -
                                    Math.min(
                                      distanceFromCamera *
                                        12,
                                      60,
                                    ),
                                ),
                              opacity:
                                cardOpacity,
                              transform:
                                `translate3d(calc(-50% + ${xOffset}px), calc(-50% + ${yOffset}px), ${zOffset}px) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${cardScale})`,
                              transformOrigin:
                                'center center',
                              willChange:
                                'transform, opacity',
                            }}
                          >
                            {item.type ===
                            'view-all' ? (
                              <RecipeStoryViewAllCard
                                recipes={
                                  worldRecipes
                                }
                              />
                            ) : (
                              <RecipeStoryBookCard
                                recipe={
                                  item.recipe
                                }
                                mobileOpen={
                                  mobileOpenKey ===
                                  item.key
                                }
                                shouldReduceMotion={
                                  shouldReduceMotion
                                }
                              />
                            )}
                          </div>
                        )
                      },
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Two curtain leaves: closed on intro, open for cards, closed on outro. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40"
        >
          <div
            className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,#020202_0%,#050000_72%,#250000_100%)] shadow-[16px_0_42px_rgba(0,0,0,0.75)]"
            style={{
              transform:
                `translate3d(${-curtainOpenAmount * 100}%, 0, 0)`,
              transition: 'none',
            }}
          >
            <span className="absolute inset-y-0 right-0 w-px bg-red-600/45 shadow-[0_0_22px_rgba(255,0,0,0.62)]" />
          </div>

          <div
            className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(270deg,#020202_0%,#050000_72%,#250000_100%)] shadow-[-16px_0_42px_rgba(0,0,0,0.75)]"
            style={{
              transform:
                `translate3d(${curtainOpenAmount * 100}%, 0, 0)`,
              transition: 'none',
            }}
          >
            <span className="absolute inset-y-0 left-0 w-px bg-red-600/45 shadow-[0_0_22px_rgba(255,0,0,0.62)]" />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex items-center justify-between px-5 text-[8px] font-black uppercase tracking-[0.22em] text-white/38 sm:bottom-4 sm:px-8 sm:text-[9px] lg:px-11 lg:text-[10px]">
          <span>Discover</span>
          <span>Cook</span>
          <span>Connect</span>
          <span>Explore</span>
        </div>
      </motion.div>
    </section>
  )
}

function RecipeStoryTitle({
  opacity,
  closing,
}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center px-5 text-center"
      style={{
        opacity,
        transform:
          `translate3d(0, ${closing ? 0 : 18 * (1 - opacity)}px, 0)`,
        transition:
          'opacity 120ms linear',
      }}
    >
      <div className="relative -mt-[3svh]">
        <p
          className="relative z-10 -mb-[0.30em] text-[clamp(42px,10vw,112px)] font-normal leading-[0.72] text-[#D30000] sm:text-[clamp(58px,8vw,126px)] lg:text-[clamp(70px,7.4vw,138px)]"
          style={{
            fontFamily:
              "'Brush Script MT', 'Segoe Script', cursive",
            fontStyle:
              'italic',
            letterSpacing:
              '-0.06em',
          }}
        >
          Featured
        </p>

        <p className="text-[clamp(48px,13vw,108px)] font-black uppercase leading-[0.78] tracking-[-0.065em] text-[#D30000] sm:text-[clamp(66px,10vw,132px)] lg:text-[clamp(74px,9vw,152px)]">
          Recipes
        </p>

        <p className="mx-auto mt-5 max-w-[470px] text-[8px] font-bold uppercase leading-4 tracking-[0.12em] text-red-400/58 sm:mt-7 sm:text-[9px] sm:leading-5">
          Curated dishes, approved food intelligence and ingredients connected back to EPANTRY Grocery.
        </p>
      </div>
    </div>
  )
}

function RecipeStoryBookCard({
  recipe,
  mobileOpen,
  shouldReduceMotion,
}) {
  const [
    desktopOpen,
    setDesktopOpen,
  ] = useState(false)

  const nutrition =
    Array.isArray(
      recipe?.nutrition,
    )
      ? recipe.nutrition.slice(
          0,
          5,
        )
      : []

  const coverOpen =
    mobileOpen ||
    desktopOpen

  const openTransform =
    coverOpen
      ? 'translate3d(-7px, 0, 2px) rotateY(-84deg)'
      : 'translateZ(2px) rotateY(0deg)'

  return (
    <div
      className="group relative h-[58svh] max-h-[610px] min-h-[390px] w-[72vw] max-w-[420px] sm:h-[62svh] sm:w-[48vw] md:w-[390px] lg:h-[64svh] lg:w-[410px]"
      onMouseEnter={() =>
        setDesktopOpen(true)
      }
      onMouseLeave={() =>
        setDesktopOpen(false)
      }
      style={{
        perspective:
          '1900px',
        WebkitPerspective:
          '1900px',
        perspectiveOrigin:
          'left center',
        WebkitPerspectiveOrigin:
          'left center',
      }}
    >
      <Link
        to={
          recipePath(
            recipe,
          )
        }
        className="absolute inset-0 overflow-hidden rounded-[14px] border border-red-500/20 bg-[#090303] shadow-[0_32px_90px_rgba(0,0,0,0.58)] sm:rounded-[16px]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(225,0,0,0.24),transparent_44%)]" />

        <div className="relative flex h-full flex-col p-5 sm:p-6 lg:p-7">
          <p className="text-[8px] font-black uppercase tracking-[0.22em] text-red-400 sm:text-[9px]">
            Recipe details
          </p>

          <h3 className="mt-2 line-clamp-2 text-[24px] font-black leading-[0.92] tracking-[-0.04em] text-white sm:text-[30px]">
            {recipe?.name ||
              'Recipe'}
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
            <div className="rounded-[12px] border border-red-500/15 bg-white/[0.055] p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-red-400">
                <Users
                  size={14}
                  aria-hidden="true"
                />
                <span className="text-[7px] font-black uppercase tracking-[0.13em] sm:text-[8px]">
                  Servings
                </span>
              </div>
              <p className="mt-2 text-sm font-black text-white sm:text-base">
                {recipe?.servings
                  ? `${recipe.servings}`
                  : '—'}
              </p>
            </div>

            <div className="rounded-[12px] border border-red-500/15 bg-white/[0.055] p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-red-400">
                <Clock3
                  size={14}
                  aria-hidden="true"
                />
                <span className="text-[7px] font-black uppercase tracking-[0.13em] sm:text-[8px]">
                  Total time
                </span>
              </div>
              <p className="mt-2 text-sm font-black text-white sm:text-base">
                {recipe?.totalTime >
                0
                  ? `${recipe.totalTime} min`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[12px] border border-red-500/15 bg-white/[0.05] p-3 sm:mt-4 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/80 sm:text-xs">
                Nutrition
              </p>
              {nutrition.length >
                0 && (
                <span className="text-[7px] font-black uppercase tracking-[0.10em] text-red-400/80 sm:text-[8px]">
                  Approved
                </span>
              )}
            </div>

            {nutrition.length >
            0 ? (
              <div className="mt-2.5 space-y-1.5 sm:mt-3 sm:space-y-2">
                {nutrition.map(
                  (
                    nutrient,
                    nutrientIndex,
                  ) => (
                    <div
                      key={
                        nutrient.key ||
                        nutrient.nutrientId ||
                        `${recipe?.id || recipe?.slug}-story-nutrient-${nutrientIndex}`
                      }
                      className="flex items-center justify-between gap-3 rounded-[9px] bg-black/24 px-2.5 py-2 text-[9px] sm:px-3 sm:text-[10px]"
                    >
                      <span className="min-w-0 truncate font-bold text-white/54">
                        {nutrient.name ||
                          nutrient.key ||
                          'Nutrient'}
                      </span>
                      <span className="shrink-0 font-black text-white/90">
                        {formatNutritionValue(
                          nutrient.amount,
                          nutrient.unit,
                        )}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-3 text-[9px] font-semibold leading-4 text-white/44 sm:text-[10px] sm:leading-5">
                Approved nutrition is not available for this recipe yet.
              </p>
            )}
          </div>

          <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.12em] text-white/38 sm:text-[9px]">
            Open full recipe
          </p>
        </div>
      </Link>

      <Link
        to={
          recipePath(
            recipe,
          )
        }
        className="absolute inset-0 z-20 overflow-hidden rounded-[14px] border border-white/10 bg-[#190000] shadow-[0_30px_80px_rgba(0,0,0,0.56)] [transform-origin:left_center] [backface-visibility:hidden] sm:rounded-[16px]"
        style={{
          transform:
            openTransform,
          WebkitTransform:
            openTransform,
          transformStyle:
            'preserve-3d',
          WebkitTransformStyle:
            'preserve-3d',
          WebkitTransformOrigin:
            'left center',
          transition:
            shouldReduceMotion
              ? 'none'
              : 'transform 920ms cubic-bezier(0.20,0.84,0.22,1)',
          willChange:
            'transform',
        }}
      >
        {recipe?.image ? (
          <img
            src={
              recipe.image
            }
            alt={
              recipe.name ||
              'Recipe'
            }
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#190000] text-5xl">
            🍽️
          </div>
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.16)_42%,rgba(0,0,0,0.88)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,35,35,0.20),transparent_36%)]" />

        <div className="absolute left-4 top-4 text-[7px] font-black uppercase tracking-[0.18em] text-white/72 sm:left-5 sm:top-5 sm:text-[8px]">
          EPANTRY Recipe
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-red-300/80 sm:text-[9px]">
            {recipe?.cuisine ||
              recipe?.dietaryType ||
              'Featured'}
          </p>
          <h3 className="mt-2 text-[28px] font-black leading-[0.9] tracking-[-0.05em] text-white sm:text-[34px]">
            {recipe?.name ||
              'Recipe'}
          </h3>
        </div>
      </Link>
    </div>
  )
}

function RecipeStoryViewAllCard({
  recipes,
}) {
  return (
    <Link
      to="/recipes"
      className="focus-ring group relative flex h-[58svh] max-h-[610px] min-h-[390px] w-[72vw] max-w-[420px] flex-col overflow-hidden rounded-[14px] border border-red-500/28 bg-[#130000] p-5 shadow-[0_32px_90px_rgba(0,0,0,0.58)] sm:h-[62svh] sm:w-[48vw] sm:rounded-[16px] sm:p-6 md:w-[390px] lg:h-[64svh] lg:w-[410px] lg:p-7"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_24%,rgba(255,0,0,0.26),transparent_38%),linear-gradient(155deg,#160000_0%,#050202_62%,#000_100%)]" />

      <div className="relative z-10 flex h-full flex-col">
        <p className="text-[8px] font-black uppercase tracking-[0.22em] text-red-400 sm:text-[9px]">
          EPANTRY Recipes
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
          {recipes.slice(
            0,
            4,
          ).map(
            (
              recipe,
              index,
            ) => (
              <div
                key={`recipe-story-view-all-${recipe?.id || recipe?.slug || index}`}
                className="aspect-square overflow-hidden rounded-[10px] border border-white/10 bg-black/30"
              >
                {recipe?.image ? (
                  <img
                    src={
                      recipe.image
                    }
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-2xl">
                    🍽️
                  </div>
                )}
              </div>
            ),
          )}
        </div>

        <div className="mt-auto pt-5 sm:pt-6">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/42 sm:text-[9px]">
            Full collection
          </p>
          <h3 className="mt-2 text-[38px] font-black uppercase leading-[0.82] tracking-[-0.065em] text-white sm:text-[46px]">
            View all
          </h3>
          <p className="mt-3 max-w-[280px] text-[9px] font-semibold leading-4 text-white/48 sm:text-[10px] sm:leading-5">
            Explore every published EPANTRY recipe and choose what to cook next.
          </p>

          <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-red-500/34 bg-red-600 px-4 text-[9px] font-black uppercase tracking-[0.10em] text-white shadow-[0_0_26px_rgba(220,0,0,0.22)] sm:h-11 sm:text-[10px]">
            Explore Recipes
            <ArrowRight
              size={14}
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </Link>
  )
}

/*
|--------------------------------------------------------------------------
| Featured Section Layout
|--------------------------------------------------------------------------
*/

function FeaturedSection({
  children,
  texture,
  tone = 'grocery',
  className = '',
}) {
  return (
    <section
      className={[
        'relative min-h-[100svh] w-full overflow-hidden bg-[#F8FAF7]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >

      <SectionTexture
        variant={
          texture
        }
        tone={
          tone
        }
      />

      <div className="page-shell relative z-10 flex min-h-[100svh] flex-col py-8 sm:py-10">

        {children}

      </div>

    </section>
  )
}

/*
|--------------------------------------------------------------------------
| Header
|--------------------------------------------------------------------------
*/

function SectionHeader({
  eyebrow,
  title,
  description,
  path,
  action,
  tone = 'grocery',
}) {
  const toneClasses =
    tone === 'brands'
      ? {
          eyebrow:
            'text-[#2563EB]',

          action:
            'border-[#2563EB]/25 text-[#2563EB] hover:border-[#2563EB]/45',
        }
      : tone === 'recipes'
        ? {
            eyebrow:
              'text-[#EA580C]',

            action:
              'border-[#F59E0B]/30 text-[#EA580C] hover:border-[#EA580C]/45',
          }
        : {
            eyebrow:
              'text-[#166534]',

            action:
              'border-[#16A34A]/25 text-[#166534] hover:border-[#16A34A]/45',
          }

  return (
    <div className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end">

      <div className="max-w-2xl">

        <p className={`text-sm font-black uppercase tracking-[0.2em] sm:text-base ${toneClasses.eyebrow}`}>
          {eyebrow}
        </p>

        <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[#111827] sm:text-5xl lg:text-[56px]">
          {title}
        </h2>

        <p className="mt-3 leading-7 text-[#6B7280]">
          {description}
        </p>

      </div>

      <Link
        to={path}
        className={`focus-ring inline-flex w-fit items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-sm font-bold transition ${toneClasses.action}`}
      >

        {action}

        <ArrowRight
          size={16}
          aria-hidden="true"
        />

      </Link>

    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Texture
|--------------------------------------------------------------------------
*/

function SectionTexture({
  variant,
  tone = 'grocery',
}) {
  const shouldReduceMotion =
    useReducedMotion()

  const toneColor =
    tone === 'brands'
      ? '37, 99, 235'
      : tone === 'recipes'
        ? '234, 88, 12'
        : '22, 101, 52'

  const textureStyles = {
    grid: {
      backgroundImage:
        `linear-gradient(rgba(${toneColor}, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(${toneColor}, 0.14) 1px, transparent 1px)`,

      backgroundSize:
        '38px 38px',
    },

    dots: {
      backgroundImage:
        `radial-gradient(circle, rgba(${toneColor}, 0.30) 1.35px, transparent 1.35px)`,

      backgroundSize:
        '27px 27px',
    },

    diagonal: {
      backgroundImage:
        `repeating-linear-gradient(135deg, rgba(${toneColor}, 0.12) 0px, rgba(${toneColor}, 0.12) 1px, transparent 1px, transparent 25px)`,
    },
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >

      <div
        className="absolute inset-0 opacity-65"
        style={
          textureStyles[
            variant
          ] ||
          textureStyles.dots
        }
      />

      <motion.div
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [
                  0,
                  35,
                  0,
                ],

                y: [
                  0,
                  -25,
                  0,
                ],
              }
        }
        transition={{
          duration: 12,

          repeat:
            Infinity,

          ease:
            'easeInOut',
        }}
        className={[
          'absolute',
          '-right-24',
          'top-[36%]',
          'h-80',
          'w-80',
          'rounded-full',
          'blur-3xl',
          tone === 'brands'
            ? 'bg-[#2563EB]/20'
            : tone === 'recipes'
              ? 'bg-[#F59E0B]/20'
              : 'bg-[#16A34A]/20',
        ].join(
          ' ',
        )}
      />

    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Media
|--------------------------------------------------------------------------
*/

function MediaBox({
  image,
  alt,
  type,
}) {
  if (!image) {
    return (
      <div className="grid aspect-[4/3] place-items-center bg-[#F8FAF7] text-[#16A34A]">

        {type ===
        'product' ? (
          <Package
            size={36}
            aria-hidden="true"
          />
        ) : (
          <span className="text-4xl">
            🍽️
          </span>
        )}

      </div>
    )
  }

  return (
    <div className="aspect-[4/3] overflow-hidden bg-[#F8FAF7]">

      <img
        src={image}
        alt={alt || ''}
        loading="lazy"
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />

    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Grocery Nutrition Helpers
|--------------------------------------------------------------------------
*/

function getProductNutrition(
  product,
) {
  const candidates = [
    product?.nutrition,
    product?.nutritionFacts,
    product?.foodIntelligence?.nutrition,
    product?.foodIntelligence?.nutritionFacts,
  ]

  const source =
    candidates.find(
      (candidate) =>
        candidate &&
        (
          Array.isArray(
            candidate,
          )
            ? candidate.length >
              0
            : typeof candidate ===
              'object'
        ),
    )

  if (!source) {
    return []
  }

  if (
    Array.isArray(
      source,
    )
  ) {
    return source
      .map(
        (
          nutrient,
          index,
        ) => normalizeNutritionItem(
          nutrient,
          index,
        ),
      )
      .filter(Boolean)
  }

  return Object.entries(
    source,
  )
    .filter(
      ([key]) =>
        ![
          'basis',
          'nutritionBasis',
          'servingSize',
          'servingUnit',
          'source',
          'evidenceState',
        ].includes(
          key,
        ),
    )
    .map(
      (
        [
          key,
          value,
        ],
        index,
      ) =>
        normalizeNutritionItem(
          {
            key,
            name:
              humanizeNutritionKey(
                key,
              ),
            amount:
              typeof value ===
              'object'
                ? value?.amount ??
                  value?.value
                : value,
            unit:
              typeof value ===
              'object'
                ? value?.unit
                : inferNutritionUnit(
                    key,
                  ),
          },
          index,
        ),
    )
    .filter(Boolean)
}

function normalizeNutritionItem(
  nutrient,
  index,
) {
  if (
    nutrient == null
  ) {
    return null
  }

  if (
    typeof nutrient ===
      'number' ||
    typeof nutrient ===
      'string'
  ) {
    const amount =
      Number(
        nutrient,
      )

    if (
      !Number.isFinite(
        amount,
      )
    ) {
      return null
    }

    return {
      key:
        `nutrient-${index}`,
      name:
        `Nutrient ${index + 1}`,
      amount,
      unit: '',
    }
  }

  const key =
    nutrient.key ||
    nutrient.nutrientId ||
    nutrient.name ||
    `nutrient-${index}`

  const amount =
    Number(
      nutrient.amount ??
      nutrient.value,
    )

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    return null
  }

  return {
    key,
    name:
      nutrient.name ||
      humanizeNutritionKey(
        key,
      ),
    amount,
    unit:
      nutrient.unit ||
      inferNutritionUnit(
        key,
      ),
  }
}

function humanizeNutritionKey(
  value,
) {
  return String(
    value || '',
  )
    .replace(
      /[_-]+/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}

function inferNutritionUnit(
  key,
) {
  const normalized =
    String(
      key || '',
    ).toLowerCase()

  if (
    normalized.includes(
      'energy',
    ) ||
    normalized.includes(
      'calorie',
    ) ||
    normalized.includes(
      'kcal',
    )
  ) {
    return 'kcal'
  }

  if (
    normalized.includes(
      'sodium',
    ) ||
    normalized.includes(
      'salt',
    )
  ) {
    return 'mg'
  }

  return 'g'
}

/*
|--------------------------------------------------------------------------
| Cart Helpers
|--------------------------------------------------------------------------
*/

function getProductId(
  product,
) {
  return String(
    product?.id ||
      product?.slug ||
      product?.name ||
      '',
  )
}

/*
|--------------------------------------------------------------------------
| Featured Brand Filters
|--------------------------------------------------------------------------
*/

const FEATURED_BRAND_LIMIT =
  15

function getBrandInitial(
  brand,
) {
  const initial =
    String(
      brand?.name ||
        '',
    )
      .trim()
      .charAt(0)
      .toUpperCase()

  return /^[A-Z]$/.test(
    initial,
  )
    ? initial
    : '#'
}

function sortBrandsAlphabetically(
  brands,
) {
  return [
    ...(Array.isArray(
      brands,
    )
      ? brands
      : []),
  ].sort(
    (left, right) =>
      String(
        left?.name ||
          '',
      ).localeCompare(
        String(
          right?.name ||
            '',
        ),
        undefined,
        {
          sensitivity:
            'base',
        },
      ),
  )
}

function buildBrandFilterGroups(
  brands,
) {
  const sortedBrands =
    sortBrandsAlphabetically(
      brands,
    )

  const buckets =
    new Map()

  for (
    const brand of
    sortedBrands
  ) {
    const initial =
      getBrandInitial(
        brand,
      )

    const current =
      buckets.get(
        initial,
      ) || []

    current.push(
      brand,
    )

    buckets.set(
      initial,
      current,
    )
  }

  const orderedInitials = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '#',
  ].filter(
    (initial) =>
      buckets.has(
        initial,
      ),
  )

  const groups = []
  let currentGroup = null

  const pushCurrentGroup =
    () => {
      if (
        !currentGroup ||
        currentGroup.brands.length ===
          0
      ) {
        return
      }

      groups.push({
        ...currentGroup,
        id:
          `brand-range-${groups.length}-${currentGroup.start}-${currentGroup.end}`,
        label:
          currentGroup.start ===
          currentGroup.end
            ? currentGroup.start
            : `${currentGroup.start}-${currentGroup.end}`,
      })

      currentGroup = null
    }

  for (
    const initial of
    orderedInitials
  ) {
    const bucketBrands =
      buckets.get(
        initial,
      ) || []

    if (
      bucketBrands.length >
      FEATURED_BRAND_LIMIT
    ) {
      pushCurrentGroup()

      for (
        let offset = 0;
        offset <
        bucketBrands.length;
        offset +=
          FEATURED_BRAND_LIMIT
      ) {
        const chunk =
          bucketBrands.slice(
            offset,
            offset +
              FEATURED_BRAND_LIMIT,
          )

        const chunkIndex =
          Math.floor(
            offset /
              FEATURED_BRAND_LIMIT,
          ) +
          1

        groups.push({
          id:
            `brand-range-${groups.length}-${initial}-${chunkIndex}`,
          label:
            `${initial} · ${chunkIndex}`,
          start:
            initial,
          end:
            initial,
          brands:
            chunk,
        })
      }

      continue
    }

    if (!currentGroup) {
      currentGroup = {
        start:
          initial,
        end:
          initial,
        brands: [
          ...bucketBrands,
        ],
      }

      continue
    }

    if (
      currentGroup.brands.length +
        bucketBrands.length <=
      FEATURED_BRAND_LIMIT
    ) {
      currentGroup.end =
        initial

      currentGroup.brands.push(
        ...bucketBrands,
      )

      continue
    }

    pushCurrentGroup()

    currentGroup = {
      start:
        initial,
      end:
        initial,
      brands: [
        ...bucketBrands,
      ],
    }
  }

  pushCurrentGroup()

  return groups
}

function getVisibleBrands({
  brands,
  brandFilterGroups,
  selectedBrandFilter,
}) {
  if (
    selectedBrandFilter ===
    'all'
  ) {
    return sortBrandsAlphabetically(
      brands,
    ).slice(
      0,
      FEATURED_BRAND_LIMIT,
    )
  }

  const selectedGroup =
    brandFilterGroups.find(
      (group) =>
        group.id ===
        selectedBrandFilter,
    )

  if (!selectedGroup) {
    return sortBrandsAlphabetically(
      brands,
    ).slice(
      0,
      FEATURED_BRAND_LIMIT,
    )
  }

  return selectedGroup.brands.slice(
    0,
    FEATURED_BRAND_LIMIT,
  )
}

function getFeaturedBrandPath(
  brand,
) {
  const brandKey =
    String(
      brand?.slug ||
        brand?.id ||
        brand?._id ||
        '',
    ).trim()

  return brandKey
    ? `/brands/${encodeURIComponent(
        brandKey,
      )}`
    : '/brands'
}

function formatBrandProductCount(
  value,
) {
  const count =
    Number.isFinite(
      Number(value),
    )
      ? Math.max(
          0,
          Number(value),
        )
      : 0

  return `${count} ${
    count === 1
      ? 'product'
      : 'products'
  } listed`
}

/*
|--------------------------------------------------------------------------
| Empty State
|--------------------------------------------------------------------------
*/

function EmptyState({
  message,
}) {
  return (
    <div className="w-full rounded-3xl border border-dashed border-[#E5E7EB] bg-white/80 p-10 text-center">

      <p className="text-sm font-semibold text-[#6B7280]">
        {message}
      </p>

    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Loading
|--------------------------------------------------------------------------
*/

function FeaturedLoading() {
  return (
    <section className="min-h-[100svh] bg-white">

      <div className="page-shell py-10">

        <div className="animate-pulse">

          <div className="h-3 w-32 rounded bg-[#E5E7EB]" />

          <div className="mt-4 h-9 max-w-xl rounded bg-[#E5E7EB]" />

          <div className="mt-10 grid gap-5 md:grid-cols-3">

            {[1, 2, 3].map(
              (item) => (
                <div
                  key={item}
                  className="h-[360px] rounded-[28px] bg-[#F8FAF7]"
                />
              ),
            )}

          </div>

        </div>

      </div>

    </section>
  )
}

/*
|--------------------------------------------------------------------------
| Nutrition
|--------------------------------------------------------------------------
*/

function formatNutritionValue(
  amount,
  unit,
) {
  const numeric =
    Number(
      amount,
    )

  if (
    !Number.isFinite(
      numeric,
    )
  ) {
    return '—'
  }

  const formatted =
    new Intl.NumberFormat(
      undefined,
      {
        maximumFractionDigits:
          2,
      },
    ).format(
      numeric,
    )

  return [
    formatted,
    unit || '',
  ]
    .filter(Boolean)
    .join(' ')
}

/*
|--------------------------------------------------------------------------
| Price
|--------------------------------------------------------------------------
*/

function formatPrice(
  value,
  currency = 'INR',
) {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency:
        currency ||
        'INR',

      maximumFractionDigits:
        0,
    },
  ).format(
    Number(value) ||
      0,
  )
}
