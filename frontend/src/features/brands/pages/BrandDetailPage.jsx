import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Box,
  Clock3,
  Package,
} from 'lucide-react'

import {
  useEffect,
  useState,
} from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import EmptyState from '../../../components/common/EmptyState'

import {
  getBrandWorld,
} from '../services/brandAuthority.service'

function getErrorMessage(
  error,
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    'Unable to load Brand World.'
  )
}

function isInternalCatalogCopy(
  value,
) {
  const text =
    String(
      value ||
        '',
    ).toLowerCase()

  return (
    text.includes(
      'm14',
    ) ||
    text.includes(
      'm04',
    ) ||
    text.includes(
      'npi',
    ) ||
    text.includes(
      'canonical product graph',
    ) ||
    text.includes(
      'catalog handoff',
    )
  )
}

function getBrandDescription(
  brand,
) {
  const brandName =
    brand?.displayName ||
    brand?.name ||
    'this brand'

  if (
    brand?.description &&
    !isInternalCatalogCopy(
      brand.description,
    )
  ) {
    return brand.description
  }

  return `Explore products from ${brandName} available on EPANTRY, with clear product information in one connected place.`
}

function getProductDescription({
  product,
  brand,
}) {
  const description =
    product?.currentVersion
      ?.description ||
    ''

  if (
    description &&
    !isInternalCatalogCopy(
      description,
    )
  ) {
    return description
  }

  const brandName =
    brand?.displayName ||
    brand?.name ||
    'this brand'

  return `Explore this ${brandName} product and view its complete published product details on EPANTRY.`
}

export default function BrandDetailPage() {
  const {
    brandKey,
  } =
    useParams()

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    error,
    setError,
  ] =
    useState(
      null,
    )

  useEffect(
    () => {
      let active =
        true

      async function load() {
        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          const result =
            await getBrandWorld(
              brandKey,
            )

          if (active) {
            setData(
              result,
            )
          }
        } catch (
          requestError
        ) {
          if (active) {
            setError(
              getErrorMessage(
                requestError,
              ),
            )
          }
        } finally {
          if (active) {
            setLoading(
              false,
            )
          }
        }
      }

      load()

      return () => {
        active =
          false
      }
    },
    [brandKey],
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8FAF7]">

        <div className="page-shell py-12">

          <div className="h-[420px] animate-pulse rounded-[28px] border border-[#E5E7EB] bg-white" />

        </div>

      </main>
    )
  }

  if (
    error ||
    !data?.brand
  ) {
    return (
      <main className="min-h-screen bg-[#F8FAF7]">

        <div className="page-shell py-12">

          <EmptyState
            title="Brand World unavailable"
            description={
              error ||
              'This Brand could not be loaded.'
            }
          />

        </div>

      </main>
    )
  }

  const {
    brand,
    productFamilies = [],
    productCount = 0,
  } =
    data

  const resolvedBrandKey =
    brand.slug ||
    brand.id

  const brandName =
    brand.displayName ||
    brand.name ||
    'Brand'

  return (
    <main className="min-h-screen bg-[#F8FAF7]">

      {/* =========================================================
          BRAND INTRO
      ========================================================= */}

      <section className="relative overflow-hidden border-b border-[#E5E7EB] bg-white">

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(37,99,235,0.16) 1.2px, transparent 1.2px)',
            backgroundSize:
              '28px 28px',
          }}
        />

        <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-[#2563EB]/10 blur-3xl" />

        <div className="page-shell relative z-10 py-8 sm:py-12">

          <Link
            to="/brands"
            className="focus-ring inline-flex items-center gap-2 text-sm font-black text-[#6B7280] transition hover:text-[#2563EB]"
          >

            <ArrowLeft
              size={16}
              aria-hidden="true"
            />

            All Brands

          </Link>


          <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div className="max-w-3xl">

              <div className="flex flex-wrap items-center gap-2">

                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2563EB]">
                  Brand Collection
                </p>

                {brand.verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#1D4ED8]">

                    <BadgeCheck
                      size={13}
                      aria-hidden="true"
                    />

                    Verified Brand

                  </span>
                )}

              </div>


              <h1 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#111827] sm:text-5xl">
                {brandName}
              </h1>


              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6B7280] sm:text-base">
                {getBrandDescription(
                  brand,
                )}
              </p>

            </div>


            <div className="min-w-[170px] rounded-[22px] border border-[#2563EB]/15 bg-white px-5 py-4 shadow-sm">

              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6B7280]">
                Products listed
              </p>

              <p className="mt-1 text-2xl font-black text-[#111827]">
                {productCount}
              </p>

            </div>

          </div>


          {brand.verifiedMarkets?.length >
            0 && (
            <div className="mt-6 flex flex-wrap gap-2">

              {brand.verifiedMarkets.map(
                (
                  market,
                ) => (
                  <span
                    key={
                      market
                    }
                    className="rounded-full border border-[#2563EB]/20 bg-[#EFF6FF] px-3 py-1 text-xs font-black text-[#1D4ED8]"
                  >
                    {market}
                  </span>
                ),
              )}

            </div>
          )}

        </div>

      </section>


      {/* =========================================================
          BRAND PRODUCTS
      ========================================================= */}

      <div className="page-shell py-8">

        {productFamilies.length ===
        0 ? (
          <EmptyState
            title="No published products"
            description="Published products from this Brand will appear here."
          />
        ) : (
          <div className="space-y-8">

            {productFamilies.map(
              (
                family,
              ) => (
                <section
                  key={
                    family.id
                  }
                >

                  <div className="mb-4 flex items-center gap-2">

                    <Box
                      size={18}
                      className="text-[#2563EB]"
                      aria-hidden="true"
                    />

                    <h2 className="text-xl font-black tracking-tight text-[#111827]">
                      {family.name}
                    </h2>

                  </div>


                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                    {family.products.map(
                      (
                        product,
                      ) => {
                        const image =
                          product
                            ?.currentVersion
                            ?.image

                        const productName =
                          product
                            ?.currentVersion
                            ?.displayName ||
                          product.familyName ||
                          'Brand product'

                        return (
                          <article
                            key={
                              product.packId
                            }
                            className="group overflow-hidden rounded-[26px] border border-[#2563EB]/15 bg-white p-3.5 shadow-sm transition duration-300 hover:border-[#2563EB]/30 hover:shadow-xl hover:shadow-[#111827]/8"
                          >

                            {/* =========================================
                                PRODUCT IMAGE
                            ========================================= */}

                            <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white">

                              {image?.url ? (
                                <img
                                  src={
                                    image.url
                                  }
                                  alt={
                                    image.alt ||
                                    productName
                                  }
                                  loading="lazy"
                                  className="h-full w-full object-contain p-3"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center bg-[#EFF6FF] text-[#2563EB]">

                                  <Package
                                    size={42}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />

                                </div>
                              )}


                              <span className="absolute left-3 top-3 rounded-full border border-[#2563EB]/15 bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#1D4ED8] shadow-sm backdrop-blur-sm">
                                Published
                              </span>

                            </div>


                            {/* =========================================
                                PRODUCT CONTENT
                            ========================================= */}

                            <div className="px-1 pb-1 pt-4">

                              <h3 className="line-clamp-2 text-lg font-black leading-snug text-[#111827]">
                                {productName}
                              </h3>


                              <p className="mt-2 text-xs font-semibold leading-5 text-[#6B7280]">
                                {[product.variantName, product.packName]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    ' · ',
                                  )}
                              </p>


                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#6B7280]">
                                {getProductDescription({
                                  product,
                                  brand,
                                })}
                              </p>


                              <div className="mt-5 flex flex-wrap items-center gap-3">

                                {product.productPath && (
                                  <Link
                                    to={
                                      product.productPath
                                    }
                                    className="focus-ring inline-flex items-center gap-2 text-sm font-black text-[#2563EB] transition hover:text-[#1D4ED8]"
                                  >

                                    View product

                                    <ArrowRight
                                      size={16}
                                      aria-hidden="true"
                                    />

                                  </Link>
                                )}


                                <Link
                                  to={`/brands/${encodeURIComponent(
                                    resolvedBrandKey,
                                  )}/products/${encodeURIComponent(
                                    product.packId,
                                  )}/history`}
                                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-black text-[#6B7280] transition hover:border-[#2563EB]/25 hover:text-[#2563EB]"
                                >

                                  <Clock3
                                    size={14}
                                    aria-hidden="true"
                                  />

                                  Version history

                                </Link>

                              </div>

                            </div>

                          </article>
                        )
                      },
                    )}

                  </div>

                </section>
              ),
            )}

          </div>
        )}

      </div>

    </main>
  )
}
