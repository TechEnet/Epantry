import {
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Search,
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
} from 'react-router-dom'

import {
  listPublicRecipes,
} from '../services/recipe.service'

const FEATURED_RECIPE_COUNT = 8
const VISIBLE_CATEGORY_COUNT = 6
const SCROLL_STEP_VH = 58
const SHOWCASE_END_HOLD_VH = 58

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  )
}

function recipeKey(item, index = 0) {
  return (
    item?.recipe?.id ||
    item?.dish?.id ||
    item?.dish?.slug ||
    `recipe-${index}`
  )
}

function recipeName(item) {
  return (
    item?.dish?.name ||
    item?.recipe?.title ||
    'Recipe'
  )
}

function recipePath(item) {
  return (
    item?.path ||
    `/recipes/${item?.dish?.slug || ''}`
  )
}

function recipeCuisine(item) {
  return (
    item?.dish?.cuisine ||
    item?.recipe?.cuisine ||
    ''
  )
}

function recipeCourse(item) {
  return (
    item?.dish?.course ||
    item?.recipe?.course ||
    item?.dish?.mealType ||
    item?.recipe?.mealType ||
    'Recipe'
  )
}

function ModalShell({
  children,
  onClose,
  ariaLabel,
  wide = false,
}) {
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#140b07]/55 p-4 backdrop-blur-xl sm:p-7"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative flex max-h-[84svh] w-full flex-col overflow-hidden rounded-[30px] border border-white/45 bg-[#fffaf2]/88 shadow-[0_32px_100px_rgba(30,14,8,0.34)] backdrop-blur-2xl ${
          wide
            ? 'max-w-[1180px]'
            : 'max-w-[980px]'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="focus-ring absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full border border-stone-900/10 bg-white/85 text-stone-700 shadow-sm backdrop-blur transition hover:bg-white hover:text-stone-950"
          aria-label="Close"
        >
          <X
            size={18}
            aria-hidden="true"
          />
        </button>

        {children}
      </section>
    </div>
  )
}

function RecipePreviewCard({
  item,
  index,
}) {
  const dish = item?.dish || {}
  const cuisine = recipeCuisine(item)
  const course = recipeCourse(item)

  return (
    <Link
      to={recipePath(item)}
      className="focus-ring group relative block h-full w-full overflow-hidden rounded-[28px] bg-[#17100c] shadow-[0_30px_90px_rgba(12,6,3,0.34)]"
      aria-label={`Open ${recipeName(item)}`}
    >
      {dish.heroImageUrl ? (
        <img
          src={dish.heroImageUrl}
          alt={dish.name || recipeName(item)}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#4d2112] via-[#24120d] to-[#120a07] text-orange-100">
          <ChefHat
            size={56}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/62 via-black/22 to-transparent px-5 pb-5 pt-16">
        <div className="flex flex-wrap items-center gap-2">
          {cuisine && (
            <span className="rounded-full border border-white/35 bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.17em] text-white backdrop-blur-md">
              {cuisine}
            </span>
          )}

          {course && (
            <span className="rounded-full border border-orange-200/55 bg-[#f59e0b]/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.17em] text-orange-50 backdrop-blur-md">
              {course}
            </span>
          )}
        </div>
      </div>

      <span className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/85 backdrop-blur-md">
        {String(index + 1).padStart(2, '0')}
      </span>
    </Link>
  )
}

function ViewAllSlide({
  onOpen,
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="focus-ring group flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-orange-100/35 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.28),transparent_38%),linear-gradient(145deg,rgba(83,35,17,0.96),rgba(27,13,8,0.98))] px-8 text-center shadow-[0_30px_90px_rgba(12,6,3,0.35)] transition hover:border-orange-200/55"
    >
      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200/80">
        Full recipe collection
      </span>

      <span className="mt-4 max-w-[9ch] font-serif text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-[#fff7ed] sm:text-6xl">
        View all recipes.
      </span>

      <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-orange-100/25 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur transition group-hover:bg-white/15">
        Explore collection
        <ChevronRight
          size={17}
          aria-hidden="true"
        />
      </span>
    </button>
  )
}

export default function RecipesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [carouselPosition, setCarouselPosition] = useState(0)
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  const showcaseRef = useRef(null)
  const animationFrameRef = useRef(null)
  const positionRef = useRef(0)
  const targetPositionRef = useRef(0)

  const loadRecipes = useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const data = await listPublicRecipes({
          page: 1,
          limit: 48,
          search,
        })

        setRecipes(
          Array.isArray(data?.recipes)
            ? data.recipes
            : [],
        )
      } catch (loadError) {
        setError(
          loadError?.message ||
            'Unable to load recipes.',
        )
      } finally {
        setLoading(false)
      }
    },
    [search],
  )

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const featuredRecipes = useMemo(
    () => recipes.slice(0, FEATURED_RECIPE_COUNT),
    [recipes],
  )

  const slides = useMemo(
    () => [
      ...featuredRecipes.map((item) => ({
        type: 'recipe',
        item,
      })),
      {
        type: 'view-all',
        item: null,
      },
    ],
    [featuredRecipes],
  )

  const categories = useMemo(() => {
    const counts = new Map()

    recipes.forEach((item) => {
      const category = recipeCourse(item)

      if (!category) {
        return
      }

      counts.set(
        category,
        (counts.get(category) || 0) + 1,
      )
    })

    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count
        }

        return a.name.localeCompare(b.name)
      })
  }, [recipes])

  const visibleCategories = categories.slice(
    0,
    VISIBLE_CATEGORY_COUNT,
  )

  const slideCount = Math.max(1, slides.length)
  const scrollSteps = Math.max(1, slideCount - 1)
  const showcaseEndHoldVh =
    slideCount > 1
      ? SHOWCASE_END_HOLD_VH
      : 0
  const showcaseHeight = `calc(100svh + ${(scrollSteps * SCROLL_STEP_VH) + showcaseEndHoldVh}vh)`
  const activeIndex = clamp(
    Math.round(carouselPosition),
    0,
    slideCount - 1,
  )
  const activeSlide = slides[activeIndex] || slides[0]
  const activeRecipe =
    activeSlide?.type === 'recipe'
      ? activeSlide.item
      : null

  useEffect(() => {
    function updateTargetFromScroll() {
      const section = showcaseRef.current

      if (!section || slideCount <= 1) {
        targetPositionRef.current = 0
        return
      }

      const rect = section.getBoundingClientRect()
      const sectionScrollDistance = Math.max(
        1,
        section.offsetHeight - window.innerHeight,
      )
      const endHoldDistance =
        window.innerHeight *
        (SHOWCASE_END_HOLD_VH / 100)
      const carouselScrollDistance = Math.max(
        1,
        sectionScrollDistance - endHoldDistance,
      )
      const travelled = clamp(
        -rect.top,
        0,
        carouselScrollDistance,
      )
      const progress =
        travelled / carouselScrollDistance

      targetPositionRef.current =
        progress * (slideCount - 1)
    }

    function animate() {
      const current = positionRef.current
      const target = targetPositionRef.current
      const next = current + (target - current) * 0.095

      positionRef.current =
        Math.abs(target - next) < 0.001
          ? target
          : next

      setCarouselPosition(positionRef.current)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    updateTargetFromScroll()
    window.addEventListener('scroll', updateTargetFromScroll, {
      passive: true,
    })
    window.addEventListener('resize', updateTargetFromScroll)
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('scroll', updateTargetFromScroll)
      window.removeEventListener('resize', updateTargetFromScroll)

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [slideCount])

  useEffect(() => {
    if (!recipeModalOpen && !categoryModalOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setRecipeModalOpen(false)
        setCategoryModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [recipeModalOpen, categoryModalOpen])

  function handleSearch(event) {
    event.preventDefault()
    setSearch(searchInput.trim())
  }

  function scrollToSlide(nextIndex) {
    const section = showcaseRef.current

    if (!section) {
      return
    }

    const index = clamp(
      nextIndex,
      0,
      slideCount - 1,
    )
    const sectionScrollDistance = Math.max(
      1,
      section.offsetHeight - window.innerHeight,
    )
    const endHoldDistance =
      slideCount > 1
        ? window.innerHeight *
          (SHOWCASE_END_HOLD_VH / 100)
        : 0
    const carouselScrollDistance = Math.max(
      1,
      sectionScrollDistance - endHoldDistance,
    )
    const sectionTop =
      window.scrollY + section.getBoundingClientRect().top
    const ratio =
      slideCount <= 1
        ? 0
        : index / (slideCount - 1)

    window.scrollTo({
      top: sectionTop + carouselScrollDistance * ratio,
      behavior: 'smooth',
    })
  }

  return (
    <main className="min-h-screen bg-[#f7f1e8]">
      <section
        className="relative min-h-[100svh] overflow-hidden bg-[#f7d7b2] bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,239,219,0.98) 0%, rgba(255,239,219,0.94) 22%, rgba(255,239,219,0.72) 36%, rgba(255,239,219,0.24) 48%, rgba(255,239,219,0) 58%, rgba(255,239,219,0) 100%), url('/hero/recipe.png')",
          backgroundSize: 'cover',
        }}
      >
        <div className="page-shell flex min-h-[100svh] items-center pb-20 pt-[148px] md:pt-[156px] xl:pt-[92px]">
          <div className="w-full max-w-3xl">
            <span className="inline-flex rounded-full border border-orange-200/80 bg-[#fff8ef]/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.17em] text-[#9a3412] shadow-sm backdrop-blur">
              Recipes
            </span>

            <h1 className="mt-5 max-w-[13ch] font-serif text-5xl font-semibold leading-[0.94] tracking-[-0.045em] text-[#21120b] sm:text-6xl lg:text-[72px]">
              Cook from real recipe requirements.
            </h1>

            <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#5b4338] sm:text-lg">
              Real recipes, clear cooking steps.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-7 flex max-w-2xl gap-2"
            >
              <label
                htmlFor="recipe-search"
                className="sr-only"
              >
                Search recipes
              </label>

              <div className="relative min-w-0 flex-1">
                <Search
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-500"
                  aria-hidden="true"
                />

                <input
                  id="recipe-search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(event.target.value)
                  }
                  placeholder="Search Paneer Tikka, rice, breakfast..."
                  className="focus-ring h-14 w-full rounded-[20px] border border-white/70 bg-white/88 pl-12 pr-4 text-sm font-semibold text-stone-900 shadow-[0_16px_42px_rgba(83,42,20,0.10)] outline-none backdrop-blur-xl"
                />
              </div>

              <button
                type="submit"
                className="focus-ring rounded-[20px] bg-[#b45309] px-6 text-sm font-black text-white shadow-[0_12px_30px_rgba(180,83,9,0.22)] transition hover:bg-[#92400e]"
              >
                Search
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/recipes/what-should-we-cook"
                className="focus-ring inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-[#fff8ef]/88 px-4 py-2 text-xs font-black text-[#8a3415] shadow-sm backdrop-blur transition hover:bg-white"
              >
                <ChefHat
                  size={15}
                  aria-hidden="true"
                />
                What Should We Cook?
              </Link>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            showcaseRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }}
          className="focus-ring absolute bottom-7 left-1/2 inline-flex -translate-x-1/2 flex-col items-center gap-2 rounded-full px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#6f351d] transition hover:text-[#3c1a0d]"
        >
          <span>Scroll to explore recipes</span>
          <span className="h-8 w-px bg-gradient-to-b from-[#9a4b24] to-transparent" />
        </button>
      </section>

      <section
        ref={showcaseRef}
        className="relative bg-[#1b100c]"
        style={{
          minHeight: showcaseHeight,
        }}
      >
        <div className="sticky top-0 min-h-[100svh] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(146,64,14,0.24),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(245,158,11,0.11),transparent_31%),linear-gradient(135deg,#120a07_0%,#23120c_46%,#3a1d0f_100%)] text-white">
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:72px_72px]" />

          <div className="relative mx-auto flex min-h-[100svh] max-w-[1500px] flex-col px-5 pb-6 pt-[118px] sm:px-8 lg:px-12">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200/70">
                  EPANTRY / Recipe collection
                </p>
                <p className="mt-1 text-xs font-semibold text-white/45">
                  Scroll or use the arrows to browse.
                </p>
              </div>

              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
                Scroll-controlled
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mx-auto mt-8 w-full max-w-3xl rounded-2xl border border-red-300/30 bg-red-950/45 px-5 py-4 text-sm font-semibold text-red-100 backdrop-blur"
              >
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-[390px] w-[300px] animate-pulse rounded-[28px] bg-white/8 sm:h-[470px] sm:w-[360px]" />
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="max-w-lg rounded-[28px] border border-white/12 bg-white/6 p-8 text-center backdrop-blur-xl">
                  <ChefHat
                    size={42}
                    className="mx-auto text-orange-200"
                    aria-hidden="true"
                  />
                  <h2 className="mt-4 text-2xl font-black">
                    No published recipes found
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    Try another search.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="relative mt-2 flex min-h-0 flex-1 items-center justify-center">
                  <div className="relative h-[360px] w-full sm:h-[430px] lg:h-[470px]">
                    {slides.map((slide, index) => {
                      const offset = index - carouselPosition
                      const distance = Math.abs(offset)
                      const visible = distance < 2.25

                      if (!visible) {
                        return null
                      }

                      const translateX = offset * 52
                      const translateY = distance * 5
                      const scale = Math.max(
                        0.56,
                        1 - distance * 0.25,
                      )
                      const rotateY = clamp(
                        offset * -34,
                        -58,
                        58,
                      )
                      const opacity = clamp(
                        1 - Math.max(0, distance - 1) * 0.7,
                        0,
                        1,
                      )
                      const blur =
                        distance > 1.15
                          ? Math.min(4, (distance - 1.15) * 4)
                          : 0
                      const endPairShift =
                        slideCount <= 1
                          ? 0.5
                          : clamp(
                              carouselPosition -
                                (slideCount - 2),
                              0,
                              1,
                            )
                      const desktopTranslateX =
                        (offset - 0.5 + endPairShift) * 30
                      const desktopPairDistance = Math.max(
                        0,
                        (Math.abs(desktopTranslateX) - 15) / 30,
                      )
                      const desktopTranslateY =
                        desktopPairDistance * 5
                      const desktopScale = Math.max(
                        0.56,
                        1 - desktopPairDistance * 0.25,
                      )
                      const desktopRotateY = clamp(
                        desktopTranslateX * -0.2,
                        -18,
                        18,
                      )
                      const desktopBlur =
                        desktopPairDistance > 1.15
                          ? Math.min(
                              4,
                              (desktopPairDistance - 1.15) * 4,
                            )
                          : 0

                      return (
                        <div
                          key={
                            slide.type === 'recipe'
                              ? recipeKey(slide.item, index)
                              : 'view-all-recipes'
                          }
                          className={`recipe-showcase-slide absolute left-1/2 top-1/2 h-[330px] w-[248px] sm:h-[400px] sm:w-[300px] lg:h-[450px] lg:w-[338px] ${
                            distance < 0.58
                              ? 'pointer-events-auto'
                              : 'pointer-events-none'
                          } ${
                            distance < 1.05
                              ? 'lg:pointer-events-auto'
                              : 'lg:pointer-events-none'
                          }`}
                          style={{
                            '--recipe-mobile-x': `${translateX}vw`,
                            '--recipe-mobile-y': `${translateY}px`,
                            '--recipe-mobile-scale': scale,
                            '--recipe-mobile-rotate': `${rotateY}deg`,
                            '--recipe-mobile-blur': `${blur}px`,
                            '--recipe-desktop-x': `${desktopTranslateX}vw`,
                            '--recipe-desktop-y': `${desktopTranslateY}px`,
                            '--recipe-desktop-scale': desktopScale,
                            '--recipe-desktop-rotate': `${desktopRotateY}deg`,
                            '--recipe-desktop-blur': `${desktopBlur}px`,
                            transformOrigin: 'center center',
                            opacity,
                            zIndex: Math.round(100 - distance * 20),
                            willChange: 'transform, opacity, filter',
                          }}
                        >
                          {slide.type === 'recipe' ? (
                            <RecipePreviewCard
                              item={slide.item}
                              index={index}
                            />
                          ) : (
                            <ViewAllSlide
                              onOpen={() => setRecipeModalOpen(true)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mx-auto -mt-1 w-full max-w-5xl text-center">
                  <div className="min-h-[62px]">
                    <p
                      key={activeIndex}
                      className="animate-[recipeTitleRise_.42s_ease-out] font-serif text-2xl font-semibold tracking-[-0.025em] text-[#fff7ed] sm:text-3xl"
                    >
                      {activeRecipe
                        ? recipeName(activeRecipe)
                        : 'Explore every published recipe'}
                    </p>
                  </div>

                  <div className="mt-1 inline-flex items-center gap-4 rounded-full border border-white/12 bg-black/18 px-4 py-2.5 shadow-lg backdrop-blur-xl">
                    <button
                      type="button"
                      onClick={() => scrollToSlide(activeIndex - 1)}
                      disabled={activeIndex <= 0}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Previous recipe"
                    >
                      <ChevronLeft
                        size={22}
                        aria-hidden="true"
                      />
                    </button>

                    <div className="flex items-center gap-2">
                      {slides.map((slide, index) => (
                        <span
                          key={
                            slide.type === 'recipe'
                              ? `dot-${recipeKey(slide.item, index)}`
                              : 'dot-view-all'
                          }
                          className={`block h-2 rounded-full transition-all duration-300 ${
                            index === activeIndex
                              ? 'w-9 bg-orange-100'
                              : 'w-2 bg-white/28'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => scrollToSlide(activeIndex + 1)}
                      disabled={activeIndex >= slideCount - 1}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Next recipe"
                    >
                      <ChevronRight
                        size={22}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <div className="mx-auto mt-4 w-full max-w-[1280px] rounded-[24px] border border-white/10 bg-white/[0.055] p-3 shadow-[0_18px_60px_rgba(0,0,0,.16)] backdrop-blur-xl sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-4 px-1">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-200/65">
                        Browse categories
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white/45">
                        Explore recipes by course.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCategoryModalOpen(true)}
                      className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-xs font-black text-white transition hover:bg-white/12"
                    >
                      View all categories
                      <ChevronRight
                        size={15}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {visibleCategories.map((category, index) => (
                      <div
                        key={category.name}
                        className="rounded-[18px] border border-white/10 bg-black/12 px-4 py-3 text-left"
                      >
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-200/55">
                          {String(index + 1).padStart(2, '0')}
                        </p>
                        <p className="mt-2 truncate text-sm font-black text-white">
                          {category.name}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-white/40">
                          {category.count}{' '}
                          {category.count === 1
                            ? 'recipe'
                            : 'recipes'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                  <span>Scroll down to explore. Scroll up to revisit.</span>
                  <span>
                    {String(activeIndex + 1).padStart(2, '0')} /{' '}
                    {String(slideCount).padStart(2, '0')}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {recipeModalOpen && (
        <ModalShell
          onClose={() => setRecipeModalOpen(false)}
          ariaLabel="All recipes"
          wide
        >
          <header className="border-b border-stone-900/10 px-6 pb-5 pt-7 sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
              Recipe collection
            </p>
            <h2 className="mt-2 pr-14 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#35180d] sm:text-4xl">
              All recipes
            </h2>
            <p className="mt-2 text-sm font-semibold text-stone-500">
              {recipes.length}{' '}
              {recipes.length === 1
                ? 'recipe'
                : 'recipes'}{' '}
              available
            </p>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2 sm:p-6 lg:auto-rows-max lg:content-start lg:items-start lg:grid-cols-3">
            {recipes.map((item, index) => (
              <Link
                key={recipeKey(item, index)}
                to={recipePath(item)}
                onClick={() => setRecipeModalOpen(false)}
                className="focus-ring group overflow-hidden rounded-[22px] border border-stone-900/10 bg-white/78 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg lg:h-fit lg:self-start"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f1e7db] lg:aspect-[16/10]">
                  {item?.dish?.heroImageUrl ? (
                    <img
                      src={item.dish.heroImageUrl}
                      alt={recipeName(item)}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-orange-700">
                      <ChefHat
                        size={34}
                        aria-hidden="true"
                      />
                    </div>
                  )}

                  <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-2">
                    {recipeCuisine(item) && (
                      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
                        {recipeCuisine(item)}
                      </span>
                    )}
                    <span className="rounded-full bg-[#c65d16]/85 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
                      {recipeCourse(item)}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-4 lg:min-h-[74px]">
                  <h3 className="line-clamp-2 text-base font-black leading-tight text-stone-950 lg:font-serif lg:text-lg lg:font-semibold lg:tracking-[-0.015em] lg:text-[#35180d]">
                    {recipeName(item)}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </ModalShell>
      )}

      {categoryModalOpen && (
        <ModalShell
          onClose={() => setCategoryModalOpen(false)}
          ariaLabel="Recipe categories"
        >
          <header className="border-b border-stone-900/10 px-6 pb-5 pt-7 sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-700">
              Browse recipes
            </p>
            <h2 className="mt-2 pr-14 font-serif text-3xl font-semibold tracking-[-0.03em] text-[#35180d] sm:text-4xl">
              All categories
            </h2>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-4">
            {categories.map((category, index) => (
              <div
                key={category.name}
                className="rounded-[22px] border border-orange-900/10 bg-white/72 p-5 shadow-sm"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-700/65">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <p className="mt-5 font-serif text-2xl font-semibold leading-none text-[#3f1d0f]">
                  {category.name}
                </p>
                <p className="mt-3 text-xs font-bold text-stone-500">
                  {category.count}{' '}
                  {category.count === 1
                    ? 'recipe'
                    : 'recipes'}
                </p>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      <style>{`
        .recipe-showcase-slide {
          transform: translate3d(
              calc(-50% + var(--recipe-mobile-x)),
              calc(-50% + var(--recipe-mobile-y)),
              0
            )
            perspective(1200px)
            rotateY(var(--recipe-mobile-rotate))
            scale(var(--recipe-mobile-scale));
          filter: blur(var(--recipe-mobile-blur));
        }

        @media (min-width: 1024px) {
          .recipe-showcase-slide {
            transform: translate3d(
                calc(-50% + var(--recipe-desktop-x)),
                calc(-50% + var(--recipe-desktop-y)),
                0
              )
              perspective(1200px)
              rotateY(var(--recipe-desktop-rotate))
              scale(var(--recipe-desktop-scale));
            filter: blur(var(--recipe-desktop-blur));
          }
        }

        @keyframes recipeTitleRise {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  )
}
