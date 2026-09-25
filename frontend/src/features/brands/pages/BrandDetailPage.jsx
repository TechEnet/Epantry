import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Box,
  Clock3,
  Package,
} from "lucide-react";

import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";

import { getBrandWorld } from "../services/brandAuthority.service";

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load Brand World."
  );
}

function isInternalCatalogCopy(value) {
  const text = String(value || "").toLowerCase();

  return (
    text.includes("m14") ||
    text.includes("m04") ||
    text.includes("npi") ||
    text.includes("canonical product graph") ||
    text.includes("catalog handoff")
  );
}

function getBrandDescription(brand) {
  const brandName = brand?.displayName || brand?.name || "this brand";

  if (brand?.description && !isInternalCatalogCopy(brand.description)) {
    return brand.description;
  }

  return `Explore products from ${brandName} available on EPANTRY, with clear product information in one connected place.`;
}

function getProductDescription({ product, brand }) {
  const description = product?.currentVersion?.description || "";

  if (description && !isInternalCatalogCopy(description)) {
    return description;
  }

  const brandName = brand?.displayName || brand?.name || "this brand";

  return `Explore this ${brandName} product and view its complete published product details on EPANTRY.`;
}

export default function BrandDetailPage() {
  const { brandKey } = useParams();

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      setError(null);

      try {
        const result = await getBrandWorld(brandKey);

        if (active) {
          setData(result);
        }
      } catch (requestError) {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [brandKey]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8FAF7]">
        <div className="page-shell py-12">
          <div className="h-[420px] animate-pulse rounded-[28px] border border-[#E5E7EB] bg-white" />
        </div>
      </main>
    );
  }

  if (error || !data?.brand) {
    return (
      <main className="min-h-screen bg-[#F8FAF7]">
        <div className="page-shell py-12">
          <EmptyState
            title="Brand World unavailable"
            description={error || "This Brand could not be loaded."}
          />
        </div>
      </main>
    );
  }

  const { brand, productFamilies = [], productCount = 0 } = data;

  const resolvedBrandKey = brand.slug || brand.id;

  const brandName = brand.displayName || brand.name || "Brand";

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
              "radial-gradient(circle, rgba(37,99,235,0.16) 1.2px, transparent 1.2px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-[#2563EB]/10 blur-3xl" />

        <div className="page-shell relative z-10 py-4 sm:py-12">
          <Link
            to="/brands"
            className="focus-ring inline-flex items-center gap-1.5 text-xs font-black text-[#6B7280] transition hover:text-[#2563EB] sm:gap-2 sm:text-sm"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            All Brands
          </Link>

          <div className="mt-4 flex flex-col gap-3 sm:mt-7 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#2563EB] sm:text-xs sm:tracking-[0.16em]">
                  Brand Collection
                </p>

                {brand.verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#1D4ED8]">
                    <BadgeCheck size={13} aria-hidden="true" />
                    Verified Brand
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-[24px] font-black tracking-[-0.03em] text-[#111827] sm:mt-3 sm:text-5xl">
                {brandName}
              </h1>

              <p className="mt-2 whitespace-nowrap text-[10px] font-semibold leading-4 text-[#6B7280] sm:hidden">
                Shop {brandName} products with clear details on EPANTRY.
              </p>

              <p className="mt-4 hidden max-w-3xl text-sm leading-7 text-[#6B7280] sm:block sm:text-base">
                {getBrandDescription(brand)}
              </p>
            </div>

            <div className="flex w-full items-center justify-between rounded-[16px] border border-[#2563EB]/20 bg-[#F3F8FF] px-3 py-2 shadow-sm sm:block sm:w-auto sm:min-w-[170px] sm:rounded-[22px] sm:bg-white sm:px-5 sm:py-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#2563EB] sm:text-[10px] sm:text-[#6B7280]">
                  Products listed
                </p>

                <p className="mt-0.5 text-[10px] font-semibold text-[#6B7280] sm:hidden">
                  Published in this collection
                </p>
              </div>

              <p className="text-xl font-black text-[#111827] sm:mt-1 sm:text-2xl">
                {productCount}
              </p>
            </div>
          </div>

          {brand.verifiedMarkets?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
              {brand.verifiedMarkets.map((market) => (
                <span
                  key={market}
                  className="rounded-full border border-[#2563EB]/20 bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-black text-[#1D4ED8] sm:px-3 sm:text-xs"
                >
                  {market}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* =========================================================
          BRAND PRODUCTS
      ========================================================= */}

      <div className="page-shell py-4 sm:py-8">
        {productFamilies.length === 0 ? (
          <EmptyState
            title="No published products"
            description="Published products from this Brand will appear here."
          />
        ) : (
          <div className="space-y-5 sm:space-y-8">
            {productFamilies.map((family) => (
              <section key={family.id}>
                <div className="hidden items-center gap-2 sm:mb-4 sm:flex sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <Box
                    size={16}
                    className="shrink-0 text-[#2563EB] sm:h-[18px] sm:w-[18px]"
                    aria-hidden="true"
                  />

                  <h2 className="min-w-0 text-[15px] font-black leading-tight tracking-tight text-[#111827] sm:text-xl">
                    {family.name}
                  </h2>
                </div>

                <div className="grid gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {family.products.map((product) => {
                    const image = product?.currentVersion?.image;

                    const productName =
                      product?.currentVersion?.displayName ||
                      product.familyName ||
                      "Brand product";

                    return (
                      <article
                        key={product.packId}
                        className="group overflow-hidden rounded-[20px] border border-[#2563EB]/15 bg-white p-2.5 shadow-sm transition duration-300 hover:border-[#2563EB]/30 hover:shadow-xl hover:shadow-[#111827]/8 sm:rounded-[26px] sm:p-3.5"
                      >
                        {/* =========================================
                                PRODUCT IMAGE
                            ========================================= */}

                        <div className="relative aspect-[16/10] overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white sm:aspect-[4/3] sm:rounded-[20px]">
                          {image?.url ? (
                            <img
                              src={image.url}
                              alt={image.alt || productName}
                              loading="lazy"
                              className="h-full w-full object-contain p-2 sm:p-3"
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

                          <span className="absolute left-2 top-2 rounded-full border border-[#2563EB]/15 bg-white/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#1D4ED8] shadow-sm backdrop-blur-sm sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.12em]">
                            Published
                          </span>
                        </div>

                        {/* =========================================
                                PRODUCT CONTENT
                            ========================================= */}

                        <div className="px-0.5 pb-0.5 pt-2.5 sm:px-1 sm:pb-1 sm:pt-4">
                          <h3 className="line-clamp-2 text-[15px] font-black leading-snug text-[#111827] sm:text-lg">
                            {productName}
                          </h3>

                          <p className="mt-1 text-[10px] font-semibold leading-4 text-[#6B7280] sm:mt-2 sm:text-xs sm:leading-5">
                            {[product.variantName, product.packName]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>

                          <p className="mt-2 line-clamp-2 text-[11px] leading-[18px] text-[#6B7280] sm:mt-3 sm:text-sm sm:leading-6">
                            {getProductDescription({
                              product,
                              brand,
                            })}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-5 sm:gap-3">
                            {product.productPath && (
                              <Link
                                to={product.productPath}
                                className="focus-ring inline-flex items-center gap-1.5 text-xs font-black text-[#2563EB] transition hover:text-[#1D4ED8] sm:gap-2 sm:text-sm"
                              >
                                View product
                                <ArrowRight size={16} aria-hidden="true" />
                              </Link>
                            )}

                            <Link
                              to={`/brands/${encodeURIComponent(
                                resolvedBrandKey
                              )}/products/${encodeURIComponent(
                                product.packId
                              )}/history`}
                              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[10px] font-black text-[#6B7280] transition hover:border-[#2563EB]/25 hover:text-[#2563EB] sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs"
                            >
                              <Clock3 size={14} aria-hidden="true" />
                              Version history
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
