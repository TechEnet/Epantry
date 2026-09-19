import { Leaf, RefreshCw } from "lucide-react";

import { useEffect } from "react";

import AdminShell from "../components/AdminShell";

import useAdminCatalogGovernance from "../hooks/useAdminCatalogGovernance";

export default function AdminIngredientsPage() {
  const { ingredients, loading, error, loadIngredients } =
    useAdminCatalogGovernance();

  useEffect(() => {
    loadIngredients({
      page: 1,

      limit: 100,
    }).catch(() => {});
  }, [loadIngredients]);

  return (
    <AdminShell
      title="Ingredient Dictionary"
      description="Minimal canonical Ingredient Dictionary for normalized product facts and future recipe lineage."
      actions={
        <button
          type="button"
          onClick={() =>
            loadIngredients({
              page: 1,

              limit: 100,
            })
          }
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[22px] border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 p-5">
          <h2 className="font-black text-stone-950">Canonical Ingredients</h2>

          <p className="mt-1 text-sm text-stone-500">
            {ingredients.length} dictionary records loaded
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-5">
            {Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-stone-100"
              />
            ))}
          </div>
        ) : ingredients.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {ingredients.map((ingredient) => (
              <div
                key={ingredient.id || ingredient._id}
                className="flex items-center gap-4 p-5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Leaf size={18} aria-hidden="true" />
                </div>

                <div className="min-w-0">
                  <p className="font-black text-stone-900">
                    {ingredient.canonicalName ||
                      ingredient.name ||
                      "Unnamed ingredient"}
                  </p>

                  <p className="mt-1 truncate text-xs font-semibold text-stone-500">
                    {ingredient.normalizedKey ||
                      ingredient.key ||
                      ingredient.slug ||
                      "Canonical ingredient"}
                  </p>
                </div>

                {ingredient.status && (
                  <span className="ml-auto rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-600">
                    {ingredient.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-7 text-sm text-stone-500">
            Ingredient Dictionary is currently empty.
          </div>
        )}
      </section>
    </AdminShell>
  );
}
