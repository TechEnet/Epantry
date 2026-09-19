import {
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
  motion,
  useReducedMotion,
} from 'motion/react'

import {
  useLandingFeaturedQuery,
} from '../hooks/useLandingFeaturedQuery'

export default function FeaturedContentSection() {
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

      <FeaturedSection
        texture="grid"
        tone="grocery"
      >

        <SectionHeader
          eyebrow="Featured Grocery"
          title="Everyday essentials worth discovering."
          description="A curated preview of grocery products available inside the EPANTRY catalog."
          path="/grocery"
          action="Explore Grocery"
          tone="grocery"
        />

        <div className="flex flex-1 items-center py-5">

          {grocery.length > 0 ? (
            <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4">

              {grocery.map(
                (
                  product,
                  index,
                ) => {
                  const productId =
                    getProductId(
                      product,
                    )

                  const nutrition =
                    getProductNutrition(
                      product,
                    )

                  return (
                    <motion.article
                      key={
                        product.id ||
                        product.slug
                      }
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 20,
                            }
                      }
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        duration: 0.35,

                        delay:
                          shouldReduceMotion
                            ? 0
                            : index *
                              0.05,
                      }}
                      className="group relative h-full"
                    >

                      {/* =============================================
                          MOBILE / TABLET

                          Existing grocery card behavior is preserved.
                          The new two-phase interaction is desktop-only.
                      ============================================== */}

                      <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-[#E5E7EB] bg-white p-3.5 shadow-sm transition-all duration-300 hover:border-[#16A34A]/30 hover:bg-white hover:shadow-xl hover:shadow-[#111827]/10 lg:hidden">

                        <div className="relative h-[210px] shrink-0 overflow-hidden rounded-[20px] bg-white">

                          {product.image ? (
                            <img
                              src={
                                product.image
                              }
                              alt={
                                product.name ||
                                'Grocery product'
                              }
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-[#F8FAF7] text-[#16A34A]">

                              <Package
                                size={36}
                                aria-hidden="true"
                              />

                            </div>
                          )}

                        </div>

                        <div className="flex flex-1 flex-col px-1 pt-4">

                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#166534]">

                            {product.subCategory ||
                              'Grocery'}

                          </p>

                          <h3 className="mt-2 line-clamp-2 text-lg font-black leading-snug text-[#111827]">

                            {product.name ||
                              'Grocery Product'}

                          </h3>

                          <div className="mt-auto flex items-end justify-between gap-3 pt-4">

                            <div>

                              {(product.quantity ||
                                product.unit) && (
                                <p className="text-xs font-medium text-[#6B7280]/70">

                                  {
                                    product.quantity
                                  }{' '}
                                  {
                                    product.unit
                                  }

                                </p>
                              )}

                              {product.price !=
                                null && (
                                <p className="mt-1 text-lg font-black text-[#111827]">

                                  {formatPrice(
                                    product.price,
                                    product.currency,
                                  )}

                                </p>
                              )}

                            </div>

                            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#F0FDF4] text-[#166534]">

                              <ShoppingBasket
                                size={18}
                                aria-hidden="true"
                              />

                            </div>

                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">

                            <Link
                              to="/grocery"
                              className="focus-ring flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#1F2937] px-3 text-xs font-bold text-white transition duration-300 hover:bg-[#111827]"
                            >

                              <Eye
                                size={15}
                                aria-hidden="true"
                              />

                              View

                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  product,
                                )
                              }
                              className="focus-ring flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#166534] px-3 text-xs font-bold text-white transition duration-300 hover:bg-[#14532D]"
                            >

                              <ShoppingBasket
                                size={15}
                                aria-hidden="true"
                              />

                              Add to Cart

                            </button>

                          </div>

                        </div>

                      </div>

                      {/* =============================================
                          DESKTOP TWO-PHASE GROCERY CARD

                          Phase 1:
                          Only product image + product name.

                          Phase 2:
                          Image remains behind a glass blur while approved
                          nutrition is revealed. Existing View/Add actions
                          remain available so functionality is not removed.
                      ============================================== */}

                      <div className="relative hidden h-[330px] w-full overflow-hidden rounded-[26px] border border-[#E5E7EB] bg-white shadow-sm transition-all duration-500 ease-out lg:block lg:group-hover:-translate-y-1 lg:group-hover:scale-[1.025] lg:group-hover:border-[#16A34A]/30 lg:group-hover:shadow-2xl lg:group-hover:shadow-[#111827]/12">

                        {/* PHASE 1 */}

                        <div className="absolute inset-0 z-20 overflow-hidden rounded-[26px] bg-white opacity-100 transition-all duration-500 ease-[cubic-bezier(0.20,0.85,0.25,1)] [transform:rotate(0deg)_scale(1)] group-hover:pointer-events-none group-hover:opacity-0 group-hover:[transform:rotate(-4deg)_scale(0.94)]">

                          {product.image ? (
                            <img
                              src={
                                product.image
                              }
                              alt={
                                product.name ||
                                'Grocery product'
                              }
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-contain"
                            />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center bg-[#F8FAF7] text-[#16A34A]">

                              <Package
                                size={44}
                                aria-hidden="true"
                              />

                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />

                          <div className="absolute inset-x-0 bottom-0 p-5">

                            <div className="inline-flex max-w-full rounded-2xl border border-white/20 bg-black/20 px-3.5 py-2.5 backdrop-blur-[3px]">

                              <h3 className="line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-sm">

                                {product.name ||
                                  'Grocery Product'}

                              </h3>

                            </div>

                          </div>

                        </div>

                        {/* PHASE 2 BACKGROUND IMAGE */}

                        <div className="absolute inset-0 z-0 overflow-hidden rounded-[26px]">

                          {product.image ? (
                            <img
                              src={
                                product.image
                              }
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-contain blur-[7px] brightness-[0.62] saturate-[0.85]"
                            />
                          ) : (
                            <div className="h-full w-full bg-[#F0FDF4]" />
                          )}

                          <div className="absolute inset-0 bg-gradient-to-br from-[#F8FAF7]/78 via-white/62 to-[#ECFDF5]/72 backdrop-blur-[4px]" />

                        </div>

                        {/* PHASE 2 CONTENT */}

                        <div className="absolute inset-0 z-10 flex h-full w-full rotate-90 scale-75 flex-col p-4 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.20,0.85,0.25,1)] group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-100">

                          <div className="flex items-start justify-between gap-3">

                            <div className="min-w-0">

                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#166534]">
                                Nutrition
                              </p>

                              <h3 className="mt-1 line-clamp-1 text-base font-black text-[#111827]">

                                {product.name ||
                                  'Grocery Product'}

                              </h3>

                            </div>

                            {(product.quantity ||
                              product.unit) && (
                              <span className="shrink-0 rounded-full border border-[#16A34A]/15 bg-white/70 px-2.5 py-1 text-[10px] font-black text-[#166534] backdrop-blur-md">

                                {
                                  product.quantity
                                }{' '}
                                {
                                  product.unit
                                }

                              </span>
                            )}

                          </div>

                          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[18px] border border-white/60 bg-white/64 p-3 shadow-sm backdrop-blur-xl">

                            {nutrition.length >
                            0 ? (
                              <div className="h-full space-y-1.5 overflow-y-auto pr-1">

                                {nutrition.map(
                                  (
                                    nutrient,
                                    nutrientIndex,
                                  ) => (
                                    <div
                                      key={
                                        nutrient.key ||
                                        nutrient.name ||
                                        `${productId}-nutrition-${nutrientIndex}`
                                      }
                                      className="flex items-center justify-between gap-3 rounded-xl bg-white/68 px-2.5 py-2 backdrop-blur-md"
                                    >

                                      <span className="min-w-0 truncate text-[11px] font-bold text-[#6B7280]">

                                        {nutrient.name ||
                                          nutrient.key ||
                                          'Nutrient'}

                                      </span>

                                      <span className="shrink-0 text-[11px] font-black text-[#111827]">

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
                              <div className="grid h-full place-items-center text-center">

                                <div>

                                  <p className="text-xs font-black text-[#111827]">
                                    Nutrition not available
                                  </p>

                                  <p className="mt-1 text-[10px] font-semibold leading-4 text-[#6B7280]">
                                    Approved nutrition will appear here once it is available for this product.
                                  </p>

                                </div>

                              </div>
                            )}

                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">

                            <Link
                              to="/grocery"
                              className="focus-ring flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#1F2937]/95 px-3 text-[11px] font-bold text-white transition hover:bg-[#111827]"
                            >

                              <Eye
                                size={14}
                                aria-hidden="true"
                              />

                              View

                            </Link>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  product,
                                )
                              }
                              className="focus-ring flex h-9 items-center justify-center gap-1.5 rounded-full bg-[#166534]/95 px-3 text-[11px] font-bold text-white transition hover:bg-[#14532D]"
                            >

                              <ShoppingBasket
                                size={14}
                                aria-hidden="true"
                              />

                              Add to Cart

                            </button>

                          </div>

                        </div>

                      </div>

                    </motion.article>
                  )
                },
              )}

            </div>
          ) : (
            <EmptyState
              message="Featured grocery products will appear here once catalog data is available."
            />
          )}

        </div>

      </FeaturedSection>

      {/* =============================================================
          FEATURED RECIPES
      ============================================================= */}

      <FeaturedSection
        texture="diagonal"
        tone="recipes"
      >

        <SectionHeader
          eyebrow="Featured Recipes"
          title="Discover a meal, then connect it to your basket."
          description="Recipes connect ingredients back to grocery products instead of existing as isolated content."
          path="/recipes"
          action="Explore Recipes"
          tone="recipes"
        />

        <div className="flex flex-1 items-center py-5">

          {recipes.length > 0 ? (
            <div className="grid w-full gap-5 md:grid-cols-3">

              {recipes.map(
                (
                  recipe,
                  index,
                ) => (
                  <motion.article
                    key={
                      recipe.id ||
                      recipe.slug
                    }
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 20,
                          }
                    }
                    whileInView={{
                      opacity: 1,
                      y: 0,
                    }}
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      duration: 0.35,

                      delay:
                        shouldReduceMotion
                          ? 0
                          : index *
                            0.06,
                    }}
                    className="group relative mx-auto w-full lg:aspect-square lg:max-w-[410px] lg:rounded-[28px] lg:hover:z-20"
                  >

                    <div className="overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white/95 shadow-sm lg:hidden">

                      <Link
                        to={
                          recipe.path ||
                          (recipe.slug
                            ? `/recipes/${recipe.slug}`
                            : '/recipes')
                        }
                        className="block h-full"
                      >

                        <MediaBox
                          image={
                            recipe.image
                          }
                          alt={
                            recipe.name
                          }
                          type="recipe"
                        />

                        <div className="p-6">

                          <div className="flex flex-wrap gap-2">

                            {recipe.cuisine && (
                              <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-bold text-[#EA580C]">

                                {
                                  recipe.cuisine
                                }

                              </span>
                            )}

                            {recipe.dietaryType && (
                              <span className="rounded-full bg-[#F8FAF7] px-3 py-1 text-xs font-bold text-[#6B7280]">

                                {
                                  recipe.dietaryType
                                }

                              </span>
                            )}

                          </div>

                          <h3 className="mt-4 text-xl font-black text-[#111827]">

                            {recipe.name ||
                              'Recipe'}

                          </h3>

                          {recipe.description && (
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6B7280]">

                              {
                                recipe.description
                              }

                            </p>
                          )}

                          <div className="mt-5 flex flex-wrap items-center gap-5 text-xs font-bold text-[#6B7280]">

                            {recipe.totalTime >
                              0 && (
                              <span className="flex items-center gap-1.5">

                                <Clock3
                                  size={15}
                                  aria-hidden="true"
                                />

                                {
                                  recipe.totalTime
                                }{' '}
                                min

                              </span>
                            )}

                            {recipe.servings && (
                              <span className="flex items-center gap-1.5">

                                <Users
                                  size={15}
                                  aria-hidden="true"
                                />

                                {
                                  recipe.servings
                                }{' '}
                                servings

                              </span>
                            )}

                          </div>

                        </div>

                      </Link>

                    </div>

                    <Link
                      to={
                        recipe.path ||
                        (recipe.slug
                          ? `/recipes/${recipe.slug}`
                          : '/recipes')
                      }
                      className="relative hidden h-full w-full rounded-[28px] lg:block"
                      style={{
                        perspective: '2000px',
                        WebkitPerspective: '2000px',
                        perspectiveOrigin: 'left center',
                        WebkitPerspectiveOrigin: 'left center',
                        transformStyle: 'preserve-3d',
                        WebkitTransformStyle: 'preserve-3d',
                      }}
                    >

                      <div className="absolute inset-0 overflow-hidden rounded-[28px] border border-[#F59E0B]/20 bg-[#FFF7ED] shadow-sm [transform:translateZ(0)] [backface-visibility:hidden]">

                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_42%)]" />

                        <div className="relative flex h-full flex-col p-6 sm:p-7">

                          <div>

                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#EA580C]">
                              Recipe details
                            </p>

                            <h3 className="mt-2 line-clamp-2 text-2xl font-black leading-tight text-[#111827]">

                              {recipe.name ||
                                'Recipe'}

                            </h3>

                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-3">

                            <div className="rounded-2xl border border-[#F59E0B]/20 bg-white/80 p-4 backdrop-blur-sm">

                              <div className="flex items-center gap-2 text-[#EA580C]">

                                <Users
                                  size={16}
                                  aria-hidden="true"
                                />

                                <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                                  Base servings
                                </span>

                              </div>

                              <p className="mt-2 text-lg font-black text-[#111827]">
                                {recipe.servings
                                  ? `${recipe.servings} servings`
                                  : '—'}
                              </p>

                            </div>

                            <div className="rounded-2xl border border-[#F59E0B]/20 bg-white/80 p-4 backdrop-blur-sm">

                              <div className="flex items-center gap-2 text-[#EA580C]">

                                <Clock3
                                  size={16}
                                  aria-hidden="true"
                                />

                                <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                                  Total time
                                </span>

                              </div>

                              <p className="mt-2 text-lg font-black text-[#111827]">
                                {recipe.totalTime >
                                0
                                  ? `${recipe.totalTime} min`
                                  : '—'}
                              </p>

                            </div>

                          </div>

                          <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#F59E0B]/20 bg-white/85 p-4 backdrop-blur-sm">

                            <div className="flex items-center justify-between gap-3">

                              <h4 className="text-sm font-black text-[#111827]">
                                Nutrition
                              </h4>

                              {Array.isArray(
                                recipe.nutrition,
                              ) &&
                                recipe.nutrition.length >
                                  0 && (
                                  <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#EA580C]">
                                    Approved data
                                  </span>
                                )}

                            </div>

                            {Array.isArray(
                              recipe.nutrition,
                            ) &&
                            recipe.nutrition.length >
                              0 ? (
                              <div className="mt-3 max-h-full space-y-2 overflow-y-auto pr-1">

                                {recipe.nutrition.map(
                                  (
                                    nutrient,
                                    nutrientIndex,
                                  ) => (
                                    <div
                                      key={
                                        nutrient.key ||
                                        nutrient.nutrientId ||
                                        `${recipe.id || recipe.slug}-nutrient-${nutrientIndex}`
                                      }
                                      className="flex items-center justify-between gap-4 rounded-xl bg-[#F8FAF7] px-3 py-2"
                                    >

                                      <span className="min-w-0 truncate text-xs font-bold text-[#6B7280]">
                                        {nutrient.name ||
                                          nutrient.key ||
                                          'Nutrient'}
                                      </span>

                                      <span className="shrink-0 text-xs font-black text-[#111827]">
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
                              <div className="mt-3 rounded-xl bg-[#F8FAF7] px-3 py-3 text-xs font-semibold leading-5 text-[#6B7280]">
                                Nutrition information is not available for this recipe yet.
                              </div>
                            )}

                          </div>

                          <p className="mt-4 text-[11px] font-bold text-[#6B7280]">
                            Click to open the full recipe.
                          </p>

                        </div>

                      </div>

                      <div
                        className={[
                          'absolute',
                          'inset-0',
                          'z-10',
                          'overflow-hidden',
                          'rounded-[28px]',
                          'border',
                          'border-[#E5E7EB]',
                          'bg-white',
                          'shadow-sm',
                          '[transform-origin:left_center]',
                          '[transform:translateZ(1px)_rotateY(0deg)]',
                          '[backface-visibility:hidden]',
                          'transition-transform',
                          'duration-[950ms]',
                          'ease-[cubic-bezier(0.20,0.85,0.25,1)]',
                          'will-change-transform',
                          'lg:group-hover:[transform:translateX(-10px)_translateZ(2px)_rotateY(-88deg)]',
                        ].join(
                          ' ',
                        )}
                        style={{
                          WebkitTransformOrigin: 'left center',
                          WebkitBackfaceVisibility: 'hidden',
                          WebkitTransformStyle: 'preserve-3d',
                        }}
                      >

                        {recipe.image ? (
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
                          <div className="absolute inset-0 grid place-items-center bg-[#FFF7ED] text-5xl">
                            🍽️
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">

                          <h3 className="text-2xl font-black leading-tight text-white drop-shadow-sm">

                            {recipe.name ||
                              'Recipe'}

                          </h3>

                        </div>

                      </div>

                    </Link>

                  </motion.article>
                ),
              )}

            </div>
          ) : (
            <EmptyState
              message="Featured recipes will appear here once recipe data is available."
            />
          )}

        </div>

      </FeaturedSection>

      {/* =============================================================
          FEATURED BRANDS
      ============================================================= */}

      <FeaturedSection
        texture="dots"
        tone="brands"
      >

        <SectionHeader
          eyebrow="Featured Brands"
          title="Know the brands behind the products."
          description="Discover trusted brands and explore how their products connect across the EPANTRY ecosystem."
          path="/brands"
          action="Explore Brands"
          tone="brands"
        />

        <div className="flex flex-1 flex-col py-6 sm:py-7">

          {brands.length > 0 ? (
            <div className="mt-2 flex flex-1 flex-col rounded-[32px] border border-[#2563EB]/10 bg-white/55 p-4 shadow-[0_20px_70px_rgba(37,99,235,0.08)] backdrop-blur-[2px] sm:p-6">

              <div className="flex flex-wrap items-center gap-2 border-b border-[#2563EB]/10 pb-5">

                <button
                  type="button"
                  onClick={() =>
                    setSelectedBrandFilter(
                      'all',
                    )
                  }
                  className={[
                    'focus-ring',
                    'rounded-full',
                    'border',
                    'px-4',
                    'py-2',
                    'text-xs',
                    'font-black',
                    'transition',
                    selectedBrandFilter ===
                    'all'
                      ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm shadow-[#2563EB]/20'
                      : 'border-[#2563EB]/15 bg-white text-[#2563EB] hover:border-[#2563EB]/35 hover:bg-[#EFF6FF]',
                  ].join(
                    ' ',
                  )}
                >
                  All
                </button>

                {brandFilterGroups.map(
                  (group) => (
                    <button
                      key={
                        group.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedBrandFilter(
                          group.id,
                        )
                      }
                      className={[
                        'focus-ring',
                        'rounded-full',
                        'border',
                        'px-4',
                        'py-2',
                        'text-xs',
                        'font-black',
                        'transition',
                        selectedBrandFilter ===
                        group.id
                          ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm shadow-[#2563EB]/20'
                          : 'border-[#2563EB]/15 bg-white text-[#2563EB] hover:border-[#2563EB]/35 hover:bg-[#EFF6FF]',
                      ].join(
                        ' ',
                      )}
                    >
                      {group.label}
                    </button>
                  ),
                )}

              </div>

              <div className="mt-5 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">

                {visibleBrands.map(
                  (
                    brand,
                    index,
                  ) => (
                    <motion.article
                      key={
                        brand.id ||
                        brand.slug ||
                        brand.name
                      }
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 14,
                            }
                      }
                      whileInView={{
                        opacity: 1,
                        y: 0,
                      }}
                      viewport={{
                        once: true,
                      }}
                      transition={{
                        duration: 0.28,
                        delay:
                          shouldReduceMotion
                            ? 0
                            : index *
                              0.025,
                      }}
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : {
                              y: -4,
                            }
                      }
                      className="group relative min-h-[138px] overflow-hidden rounded-[22px] border border-[#2563EB]/12 bg-white shadow-[0_8px_28px_rgba(17,24,39,0.06)] transition duration-300 hover:border-[#2563EB]/30 hover:shadow-[0_16px_38px_rgba(37,99,235,0.12)]"
                    >

                      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-[#2563EB]/5 transition duration-300 group-hover:scale-125 group-hover:bg-[#2563EB]/10" />

                      <Link
                        to="/brands"
                        className="relative flex h-full min-h-[138px] flex-col justify-between p-5"
                      >

                        <h3 className="line-clamp-2 pr-4 text-[17px] font-black leading-snug text-[#111827] transition duration-300 group-hover:text-[#2563EB]">

                          {brand.name ||
                            'Brand'}

                        </h3>

                        <div className="mt-5">

                          <span className="inline-flex rounded-full border border-[#2563EB]/10 bg-[#EFF6FF] px-3 py-1.5 text-[11px] font-black text-[#2563EB]">
                            {formatBrandProductCount(
                              brand.productCount,
                            )}
                          </span>

                        </div>

                      </Link>

                    </motion.article>
                  ),
                )}

              </div>

            </div>
          ) : (
            <EmptyState
              message="Featured brands will appear here once brand data is available."
            />
          )}

        </div>

      </FeaturedSection>

    </>
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
}) {
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden bg-[#F8FAF7]">

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
