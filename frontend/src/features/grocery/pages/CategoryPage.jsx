import { ArrowLeft } from "lucide-react";

import { Link, useParams } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";

import ProductCard from "../components/ProductCard";

import useGroceryCatalog from "../hooks/useGroceryCatalog";

export default function CategoryPage() {
  const { slug } = useParams();

  const { products, categories, loading, error } = useGroceryCatalog({
    initialCategorySlug: slug || "",
  });

  const category = categories.find((item) => item.slug === slug);

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-stone-200 bg-white">
        <div className="page-shell py-9 sm:py-12">
          <Link
            to="/grocery"
            className="focus-ring inline-flex items-center gap-2 text-sm font-black text-emerald-700"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Grocery
          </Link>

          <div className="mt-5">
            <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
              Category
            </div>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
              {category?.name || "Grocery category"}
            </h1>

            {category?.description && (
              <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-500">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="page-shell py-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({
              length: 8,
            }).map((_, index) => (
              <div
                key={index}
                className="h-[360px] animate-pulse rounded-[24px] border border-stone-200 bg-white"
              />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.productVersionId || product.id}
                product={product}
              />
            ))}
          </div>
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
