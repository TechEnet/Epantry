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

  const productCards = productFamilies.flatMap((family) =>
    (family.products || []).map((product) => ({
      family,
      product,
    }))
  );

  const productCardTones = [
    {
      card: "border-[#A9D4BE] bg-[linear-gradient(145deg,#DFF3E8_0%,#F6EBCF_100%)]",
      image: "border-[#C6E1D2] bg-[#FFFDF7]",
      badge: "border-[#9BCBB2] bg-[#EAF7EF] text-[#17613D]",
      family: "bg-[#CDEAD9] text-[#145C39]",
      primary: "bg-[#17613D] text-white hover:bg-[#104E31]",
      secondary: "border-[#8FBEA5] bg-[#F6FFF9]/80 text-[#2B6B4C] hover:bg-[#F6FFF9]",
    },
    {
      card: "border-[#EDC3A8] bg-[linear-gradient(145deg,#FBE6D8_0%,#F6E8C9_100%)]",
      image: "border-[#F0D3BD] bg-[#FFF9F4]",
      badge: "border-[#E7B894] bg-[#FFF0E5] text-[#9A4D20]",
      family: "bg-[#F4D1B7] text-[#8A431E]",
      primary: "bg-[#A65327] text-white hover:bg-[#88411F]",
      secondary: "border-[#DCB08F] bg-[#FFF9F4]/80 text-[#8A4A29] hover:bg-[#FFF9F4]",
    },
    {
      card: "border-[#B9CCE8] bg-[linear-gradient(145deg,#E1ECF7_0%,#EAE4F6_100%)]",
      image: "border-[#CAD8ED] bg-[#FAFCFF]",
      badge: "border-[#ABC2E0] bg-[#EDF4FC] text-[#315C8C]",
      family: "bg-[#D1DDF1] text-[#31557D]",
      primary: "bg-[#345E8B] text-white hover:bg-[#294C72]",
      secondary: "border-[#AFC4DF] bg-[#F8FBFF]/80 text-[#3E6389] hover:bg-[#F8FBFF]",
    },
  ];

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
        {productCards.length === 0 ? (
          <EmptyState
            title="No published products"
            description="Published products from this Brand will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {productCards.map(({ family, product }, index) => {
              const image = product?.currentVersion?.image;

              const productName =
                product?.currentVersion?.displayName ||
                product.familyName ||
                "Brand product";

              const tone = productCardTones[index % productCardTones.length];

              return (
                <article
                  key={product.packId}
                  className={`group relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border p-2.5 shadow-[0_18px_48px_-34px_rgba(17,24,39,0.48)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_-34px_rgba(17,24,39,0.58)] sm:rounded-[30px] sm:p-3.5 ${tone.card}`}
                >
                  <div
                    className={`relative aspect-[4/3] overflow-hidden rounded-[19px] border sm:rounded-[23px] ${tone.image}`}
                  >
                    {image?.url ? (
                      <img
                        src={image.url}
                        alt={image.alt || productName}
                        loading="lazy"
                        className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.025] sm:p-4"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[#476B59]">
                        <Package
                          size={42}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </div>
                    )}

                    <div className="absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2 sm:left-3.5 sm:right-3.5 sm:top-3.5">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm sm:px-3 sm:text-[10px] sm:tracking-[0.12em] ${tone.badge}`}
                      >
                        Published
                      </span>

                      <span
                        className={`inline-flex max-w-[58%] items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black leading-tight sm:px-3 sm:text-[10px] ${tone.family}`}
                      >
                        <Box
                          size={12}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">{family.name}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col px-1 pb-1 pt-3 sm:px-1.5 sm:pb-1.5 sm:pt-4">
                    <h3 className="line-clamp-2 text-[16px] font-black leading-snug tracking-[-0.02em] text-[#17211C] sm:text-[19px]">
                      {productName}
                    </h3>

                    <p className="mt-1 text-[10px] font-bold leading-4 text-[#536259] sm:mt-2 sm:text-xs sm:leading-5">
                      {[product.variantName, product.packName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <p className="mt-2 line-clamp-2 text-[11px] leading-[18px] text-[#5E6C63] sm:mt-3 sm:text-[13px] sm:leading-5">
                      {getProductDescription({
                        product,
                        brand,
                      })}
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 sm:gap-2.5 sm:pt-5">
                      {product.productPath && (
                        <Link
                          to={product.productPath}
                          className={`focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-[11px] font-black transition sm:min-h-10 sm:gap-2 sm:px-4 sm:text-xs ${tone.primary}`}
                        >
                          View product
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      )}

                      <Link
                        to={`/brands/${encodeURIComponent(
                          resolvedBrandKey
                        )}/products/${encodeURIComponent(
                          product.packId
                        )}/history`}
                        className={`focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-[10px] font-black transition sm:min-h-10 sm:gap-2 sm:px-3.5 sm:text-[11px] ${tone.secondary}`}
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
        )}
      </div>
    </main>
  );
}
