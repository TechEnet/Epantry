import {
  ArrowLeft,
  ArrowRight,
  Package,
} from "lucide-react";

import { Link, useParams } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";

import ProductCard from "../components/ProductCard";

import useGroceryCatalog from "../hooks/useGroceryCatalog";

function formatQuantity(quantity) {
  if (
    !quantity ||
    quantity.value === null ||
    quantity.value === undefined
  ) {
    return null;
  }

  return `${quantity.value} ${quantity.unit || ""}`.trim();
}

function MobileCategoryProductCard({ product }) {
  const imageUrl = product?.image?.url || "";
  const quantity = formatQuantity(product?.netQuantity);
  const productPath = `/grocery/product/${encodeURIComponent(
    product?.slug || "",
  )}`;

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#bdd4da]/90 bg-[linear-gradient(155deg,rgba(249,252,252,0.92),rgba(218,238,242,0.86),rgba(239,230,216,0.72))] shadow-[0_14px_34px_rgba(64,87,94,0.13)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-[#c9e3e9]/72 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 size-32 rounded-full bg-[#e3d3bb]/60 blur-3xl" />

      <div className="relative m-2.5 mb-0 overflow-hidden rounded-[17px] border border-[#c7dade]/90 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.98),rgba(222,239,242,0.88),rgba(238,230,218,0.72))]">
        <Link
          to={productPath}
          aria-label={`View ${product?.displayName || "grocery product"}`}
          className="focus-ring relative block aspect-square overflow-hidden"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={
                product?.image?.alt ||
                product?.displayName ||
                "Grocery product"
              }
              className="absolute inset-0 h-full w-full object-contain p-3.5"
            />
          ) : (
            <div className="grid h-full place-items-center text-stone-400/70">
              <Package size={34} strokeWidth={1.35} aria-hidden="true" />
            </div>
          )}
        </Link>

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1.5">
          <span className="inline-flex rounded-full border border-[#c5d9dd]/95 bg-white/82 px-2 py-1 text-[7px] font-black uppercase tracking-[0.11em] text-[#48636b] shadow-sm backdrop-blur-md">
            Canonical
          </span>

          {quantity ? (
            <span className="max-w-[52%] rounded-full border border-[#c5d9dd]/95 bg-white/82 px-2 py-1 text-[8px] font-bold leading-none text-[#48636b] shadow-sm backdrop-blur-md">
              {quantity}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-1 flex-col px-3 pb-3 pt-3">
        {product?.brand?.name ? (
          <p className="break-words text-[8px] font-black uppercase tracking-[0.12em] text-[#5f7680]">
            {product.brand.name}
          </p>
        ) : null}

        <h2 className="mt-1.5 break-words text-[13.5px] font-black leading-[1.18] tracking-[-0.025em] text-stone-950">
          {product?.displayName || "Unnamed product"}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[8.5px] font-bold leading-4 text-stone-600">
          {product?.category?.name ? (
            <span className="rounded-full border border-[#c5d9dd]/90 bg-[#edf6f7]/82 px-2 py-0.5 text-[#516a73] backdrop-blur-sm">
              {product.category.name}
            </span>
          ) : null}

          {product?.pack?.type && product.pack.type !== "other" ? (
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[#c5d9dd]/90 bg-[#edf6f7]/82 px-2 py-0.5 capitalize text-[#516a73] backdrop-blur-sm">
              <Package size={9} strokeWidth={1.65} aria-hidden="true" />
              <span className="break-words">{product.pack.type}</span>
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-3">
          <Link
            to={productPath}
            aria-label={`View product: ${
              product?.displayName || "Unnamed product"
            }`}
            className="focus-ring flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-[#b9d1d7]/95 bg-[linear-gradient(135deg,rgba(250,252,252,0.90),rgba(218,238,242,0.82))] px-3 py-2 text-[10px] font-black text-[#314f59] shadow-[inset_0_1px_0_rgba(255,255,255,0.90),0_6px_16px_rgba(64,87,94,0.07)] backdrop-blur-md transition active:scale-[0.98]"
          >
            <span>View product</span>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[#b9d1d7]/95 bg-white/82">
              <ArrowRight size={11} strokeWidth={1.9} aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();

  const { products, categories, loading, error } = useGroceryCatalog({
    initialCategorySlug: slug || "",
  });

  const category = categories.find((item) => item.slug === slug);

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-stone-200 bg-white">
        <div className="page-shell py-2.5 sm:py-12">
          <div className="flex items-center justify-between gap-3 sm:block">
            <Link
              to="/grocery"
              className="focus-ring inline-flex items-center gap-1.5 text-[12px] font-black text-emerald-700 sm:gap-2 sm:text-sm"
            >
              <ArrowLeft size={14} className="sm:size-4" aria-hidden="true" />
              Grocery
            </Link>

            <div className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-emerald-800 sm:hidden">
              Category
            </div>
          </div>

          <div className="mt-1.5 sm:mt-5">
            <div className="hidden rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800 sm:inline-flex">
              Category
            </div>

            <h1 className="text-[22px] font-black leading-tight tracking-tight text-stone-950 sm:mt-3 sm:text-4xl">
              {category?.name || "Grocery category"}
            </h1>

            {category?.description && (
              <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-stone-500 sm:mt-3 sm:text-sm sm:leading-7">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="page-shell py-4 sm:py-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[286px] animate-pulse rounded-[22px] border border-[#bdd4da]/90 bg-[linear-gradient(155deg,rgba(249,252,252,0.92),rgba(218,238,242,0.86),rgba(239,230,216,0.72))]"
                />
              ))}
            </div>

            <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[360px] animate-pulse rounded-[24px] border border-stone-200 bg-white"
                />
              ))}
            </div>
          </>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 items-stretch gap-2.5 sm:hidden">
              {products.map((product) => (
                <MobileCategoryProductCard
                  key={product.productVersionId || product.id}
                  product={product}
                />
              ))}
            </div>

            <div className="hidden gap-5 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.productVersionId || product.id}
                  product={product}
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No published products"
            description="There are currently no published canonical products in this category."
          />
        )}
      </div>
    </main>
  );
}
