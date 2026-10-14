import { ArrowLeft, ArrowUpRight, ChevronDown, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";
import useGroceryCatalog from "../hooks/useGroceryCatalog";
import { getCatalogProducts } from "../services/catalog.service";

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

function CategoryProductTile({ product, index, showAll }) {
  const imageUrl = product?.image?.url || "";
  const quantity = formatQuantity(product?.netQuantity);
  const productName = product?.displayName || "Unnamed product";
  const productPath = `/grocery/product/${encodeURIComponent(
    product?.slug || "",
  )}`;
  const packType =
    product?.pack?.type && product.pack.type !== "other"
      ? product.pack.type
      : null;
  // Mobile/tablet previews show 4 items; laptop previews show 12.
  const previewClass = showAll
    ? ""
    : index >= 12
      ? "hidden"
      : index >= 4
        ? "hidden lg:block"
        : "";

  return (
    <article className={`group min-w-0 ${previewClass}`}>
      <Link
        to={productPath}
        aria-label={`View product: ${productName}`}
        className="focus-ring flex h-full min-h-[170px] min-w-0 overflow-hidden rounded-[17px] border border-[#dfe7df] bg-white shadow-[0_3px_14px_-10px_rgba(25,63,43,0.18)] transition-[border-color,box-shadow] duration-300 hover:border-[#9fbea9] hover:shadow-[0_12px_26px_-15px_rgba(25,63,43,0.26)] focus-visible:border-[#1f7650] motion-reduce:transition-none sm:min-h-[190px] sm:rounded-[20px]"
      >
        <div className="relative flex w-[39%] min-w-[108px] max-w-[205px] shrink-0 items-center justify-center overflow-hidden border-r border-[#eef1ec] bg-[#fafbf8] sm:w-[42%] sm:min-w-[145px]">
          <div className="relative aspect-square w-full">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product?.image?.alt || productName}
                loading={index < 4 ? "eager" : "lazy"}
                decoding="async"
                className="absolute inset-0 h-full w-full object-contain p-2.5 transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none sm:p-4"
              />
            ) : (
              <div className="grid h-full place-items-center text-[#8caa92]">
                <Package size={36} strokeWidth={1.35} aria-hidden="true" />
              </div>
            )}
          </div>
          <span className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-16px)] rounded-md border border-[#dce9df] bg-[#edf6ef] px-1.5 py-1 text-[10px] font-semibold leading-none text-[#286443] sm:left-3 sm:top-3 sm:px-2 sm:text-[11px]">
            Canonical
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-3.5 py-3 sm:px-4.5 sm:py-4 lg:px-5">
          {product?.brand?.name ? (
            <p className="min-w-0 break-words text-[12px] font-semibold leading-[1.4] text-[#32724e] sm:text-[13px]">
              {product.brand.name}
            </p>
          ) : null}

          <h2 className="mt-1 min-w-0 break-words text-[16px] font-bold leading-[1.3] tracking-[-0.027em] text-[#1b3225] sm:mt-1.5 sm:text-[19px]">
            {productName}
          </h2>

          {product?.category?.name || packType ? (
            <p className="mt-1.5 min-w-0 break-words text-[12px] leading-[1.45] text-[#718074] sm:mt-2 sm:text-[13px]">
              {product?.category?.name || null}
              {product?.category?.name && packType ? (
                <span className="px-1.5 text-[#a8b6aa]" aria-hidden="true">
                  ·
                </span>
              ) : null}
              {packType ? <span className="capitalize">{packType}</span> : null}
            </p>
          ) : null}

          {quantity ? (
            <p className="mt-1.5 w-fit rounded-md bg-[#f1f5ef] px-2 py-1 text-[11px] font-semibold leading-[1.3] text-[#425d49] sm:mt-2.5 sm:text-xs">
              {quantity}
            </p>
          ) : null}

          <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-[#edf0ea] pt-2.5 sm:pt-3">
            <span className="text-[12px] font-bold text-[#165d3c] sm:text-[13px]">
              View product
            </span>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e8f2e9] text-[#165d3c] transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-[#165d3c] group-hover:text-white motion-reduce:transform-none sm:size-8">
              <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function CategoryProductSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[170px] min-w-0 overflow-hidden rounded-[17px] border border-[#dfe7df] bg-white sm:min-h-[190px] sm:rounded-[20px]"
    >
      <div className="w-[39%] min-w-[108px] max-w-[205px] shrink-0 animate-pulse bg-[#edf2ec] sm:w-[42%] sm:min-w-[145px]" />
      <div className="flex min-w-0 flex-1 flex-col px-3.5 py-4 sm:px-5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-[#edf0e9]" />
        <div className="mt-3 h-5 w-5/6 animate-pulse rounded bg-[#e8ede7]" />
        <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-[#edf0e9]" />
        <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-[#edf0e9]" />
        <div className="mt-auto flex items-center justify-between border-t border-[#edf0ea] pt-3">
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#edf0e9]" />
          <div className="size-7 animate-pulse rounded-full bg-[#edf0e9]" />
        </div>
      </div>
    </div>
  );
}

function ViewAllButton({ showAll, loadingAll, onClick, className }) {
  return (
    <div className={`mt-6 justify-center sm:mt-8 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={showAll}
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full border border-[#bfd4c3] bg-white px-6 py-2.5 text-sm font-semibold text-[#175b3b] shadow-[0_4px_16px_-10px_rgba(25,63,43,0.2)] transition-[border-color,background-color] duration-200 hover:border-[#1b7550] hover:bg-[#edf6ef] motion-reduce:transition-none"
      >
        {loadingAll ? "Loading products…" : showAll ? "View less" : "View all"}
        <ChevronDown
          size={17}
          strokeWidth={2}
          aria-hidden="true"
          className={`transition-transform duration-200 motion-reduce:transition-none ${
            showAll ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}

export default function CategoryPage() {
  const { slug } = useParams();
  const { products, categories, pagination, loading, error } = useGroceryCatalog({
    initialCategorySlug: slug || "",
  });
  const category = categories.find((item) => item.slug === slug);

  const [showAll, setShowAll] = useState(false);
  const [fullProducts, setFullProducts] = useState(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [viewAllError, setViewAllError] = useState("");
  const viewAllRequest = useRef(0);

  // A different category must not display a previous category's expanded list.
  useEffect(() => {
    viewAllRequest.current += 1;
    setShowAll(false);
    setFullProducts(null);
    setLoadingAll(false);
    setViewAllError("");
  }, [slug]);

  const productCount = Math.max(products.length, Number(pagination?.total) || 0);
  const displayedProducts = showAll && fullProducts ? fullProducts : products;

  const toggleViewAll = async () => {
    if (showAll) {
      viewAllRequest.current += 1;
      setShowAll(false);
      setLoadingAll(false);
      setViewAllError("");
      return;
    }

    setViewAllError("");
    setShowAll(true);

    // The normal catalogue hook loads 24 entries at once. Fetch any additional
    // API pages only after View all is requested, so "all" truly means all.
    if (productCount <= products.length || (fullProducts?.length || 0) >= productCount) {
      return;
    }

    const requestId = ++viewAllRequest.current;
    setLoadingAll(true);

    try {
      const results = [];
      let page = 1;
      while (true) {
        const response = await getCatalogProducts({
          page,
          limit: 100,
          categorySlug: slug || "",
        });
        if (viewAllRequest.current !== requestId) return;

        const batch = response.products || [];
        results.push(...batch);
        const totalPages = Math.max(
          1,
          Number(response.pagination?.pages) ||
            Math.ceil((Number(response.pagination?.total) || results.length) / 100),
        );
        if (!batch.length || page >= totalPages) break;
        page += 1;
      }
      if (viewAllRequest.current === requestId) {
        setFullProducts(results);
      }
    } catch {
      if (viewAllRequest.current === requestId) {
        setShowAll(false);
        setViewAllError("Couldn't load all products. Please try again.");
      }
    } finally {
      if (viewAllRequest.current === requestId) setLoadingAll(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5]">
      <section className="border-b border-[#e0e8df] bg-[#f2f6f0]">
        <div className="mx-auto flex w-full max-w-[1520px] flex-wrap items-center justify-between gap-x-5 gap-y-1 px-4 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              to="/grocery"
              className="focus-ring inline-flex min-h-9 shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[#1a6b48] transition-colors hover:text-[#0f4f34]"
            >
              <ArrowLeft size={17} strokeWidth={1.8} aria-hidden="true" />
              Grocery
            </Link>
            <span className="text-[#a8b9a9]" aria-hidden="true">
              /
            </span>
            <span className="text-[12px] font-medium text-[#738475] sm:text-[13px]">
              Category
            </span>
            <span className="hidden text-[#a8b9a9] sm:inline" aria-hidden="true">
              /
            </span>
            <h1 className="min-w-0 break-words text-[23px] font-bold leading-[1.2] tracking-[-0.035em] text-[#173d2a] sm:text-[30px]">
              {category?.name || "Grocery category"}
            </h1>
          </div>
          {category?.description ? (
            <p className="min-w-0 break-words text-[12px] leading-[1.5] text-[#65786a] sm:text-[13px]">
              {category.description}
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-label="Category products"
        className="mx-auto w-full max-w-[1520px] px-3 pb-10 pt-3.5 sm:px-6 sm:pb-14 sm:pt-5 lg:px-8"
      >
        {error ? (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div
            className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
            aria-label="Loading products"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <CategoryProductSkeleton key={index} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
              {displayedProducts.map((product, index) => (
                <CategoryProductTile
                  key={product.productVersionId || product.id}
                  product={product}
                  index={index}
                  showAll={showAll}
                />
              ))}
            </div>
            {viewAllError ? (
              <p role="alert" className="mt-4 text-center text-sm text-red-700">
                {viewAllError}
              </p>
            ) : null}
            {productCount > 4 ? (
              <ViewAllButton
                showAll={showAll}
                loadingAll={loadingAll}
                onClick={toggleViewAll}
                className="flex lg:hidden"
              />
            ) : null}
            {productCount > 12 ? (
              <ViewAllButton
                showAll={showAll}
                loadingAll={loadingAll}
                onClick={toggleViewAll}
                className="hidden lg:flex"
              />
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No published products"
            description="There are currently no published canonical products in this category."
          />
        )}
      </section>
    </main>
  );
}
