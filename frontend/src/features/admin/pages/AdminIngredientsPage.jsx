import {
  CheckCircle2,
  ChevronDown,
  Leaf,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import AdminShell from "../components/AdminShell";

import useAdminCatalogGovernance from "../hooks/useAdminCatalogGovernance";

const MOBILE_VISIBLE_LIMIT = 12;
const DESKTOP_VISIBLE_LIMIT = 24;

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Find the ingredient",
    description: "Look for the standard ingredient name before using another variation.",
    mobileDescription: "Find the approved ingredient name before using a variation.",
    icon: Search,
  },
  {
    number: "02",
    title: "Check the spelling",
    description: "Use the approved name so products and recipes stay consistent.",
    mobileDescription: "Use the approved spelling across products and recipes.",
    icon: Leaf,
  },
  {
    number: "03",
    title: "Reuse the same record",
    description: "The same ingredient should be used wherever it appears across EPANTRY.",
    mobileDescription: "Reuse the same ingredient record everywhere it appears.",
    icon: Network,
  },
  {
    number: "04",
    title: "Confirm it is active",
    description: "Check the status before relying on an ingredient in live content.",
    mobileDescription: "Check it is active before using it in live content.",
    icon: ShieldCheck,
  },
];

function getIngredientName(ingredient) {
  return ingredient?.canonicalName || ingredient?.name || "Unnamed ingredient";
}

function getIngredientReference(ingredient) {
  return (
    ingredient?.normalizedKey ||
    ingredient?.key ||
    ingredient?.slug ||
    "No reference available"
  );
}

function getIngredientStatus(ingredient) {
  const rawStatus = String(ingredient?.status || "active")
    .trim()
    .toLowerCase();

  if (!rawStatus) {
    return "Active";
  }

  return rawStatus
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized.includes("inactive") ||
    normalized.includes("retired") ||
    normalized.includes("disabled")
  ) {
    return "bg-red-50 text-red-700";
  }

  if (normalized.includes("active") || normalized.includes("approved")) {
    return "bg-emerald-100 text-emerald-800";
  }

  return "bg-sky-100 text-sky-800";
}

function groupIngredients(items) {
  return items.reduce((groups, ingredient) => {
    const name = getIngredientName(ingredient).trim();
    const firstCharacter = name.charAt(0).toUpperCase();
    const groupKey = /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(ingredient);
    return groups;
  }, {});
}

function IngredientGroups({ items }) {
  const groupedIngredients = groupIngredients(items);
  const letters = Object.keys(groupedIngredients).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      {letters.map((letter) => (
        <section
          key={letter}
          className="grid border-b border-slate-200 last:border-b-0 md:grid-cols-[86px_minmax(0,1fr)]"
        >
          <div className="flex items-center gap-3 bg-slate-100 px-4 py-3 md:items-start md:justify-center md:px-3 md:py-5 max-sm:gap-2 max-sm:px-3.5 max-sm:py-2.5">
            <span className="text-2xl font-black leading-none text-[#0F5B45] md:text-3xl max-sm:text-xl">
              {letter}
            </span>
            <span className="text-xs font-semibold text-slate-500 md:hidden">
              {groupedIngredients[letter].length} ingredient
              {groupedIngredients[letter].length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="divide-y divide-slate-100 bg-white">
            {groupedIngredients[letter].map((ingredient) => {
              const status = getIngredientStatus(ingredient);

              return (
                <div
                  key={ingredient.id || ingredient._id}
                  className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-emerald-50/45 sm:grid-cols-[40px_minmax(0,1fr)_minmax(170px,0.55fr)_auto] sm:px-5 sm:py-3.5 max-sm:gap-2.5 max-sm:px-3.5 max-sm:py-2.5"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-[#0F6A50] sm:h-10 sm:w-10 max-sm:h-8 max-sm:w-8">
                    <Leaf size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-950 sm:text-[15px] max-sm:text-[13px]">
                      {getIngredientName(ingredient)}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500 sm:hidden max-sm:text-[11px]">
                      Reference: {getIngredientReference(ingredient)}
                    </p>
                  </div>

                  <p className="hidden truncate text-sm font-medium text-slate-500 sm:block">
                    {getIngredientReference(ingredient)}
                  </p>

                  <span
                    className={`justify-self-end rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-xs ${getStatusClass(
                      status,
                    )}`}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdminIngredientsPage() {
  const { ingredients, loading, error, loadIngredients } =
    useAdminCatalogGovernance();

  const [showAllMobile, setShowAllMobile] = useState(false);
  const [showAllDesktop, setShowAllDesktop] = useState(false);

  useEffect(() => {
    loadIngredients({
      page: 1,
      limit: 100,
    }).catch(() => {});
  }, [loadIngredients]);

  const sortedIngredients = useMemo(
    () =>
      [...ingredients].sort((a, b) =>
        getIngredientName(a).localeCompare(getIngredientName(b), undefined, {
          sensitivity: "base",
        }),
      ),
    [ingredients],
  );

  const mobileIngredients = showAllMobile
    ? sortedIngredients
    : sortedIngredients.slice(0, MOBILE_VISIBLE_LIMIT);

  const desktopIngredients = showAllDesktop
    ? sortedIngredients
    : sortedIngredients.slice(0, DESKTOP_VISIBLE_LIMIT);

  return (
    <AdminShell
      title="Ingredient Library"
      description="Review the standard ingredient names EPANTRY uses across products and recipes."
      actions={
        <button
          type="button"
          onClick={() =>
            loadIngredients({
              page: 1,
              limit: 100,
            })
          }
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh list
        </button>
      }
    >
      {error && (
        <div className="mb-5 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          We could not load the ingredient list. {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[24px] bg-[#0F5B45] text-white shadow-[0_18px_50px_rgba(15,91,69,0.14)] max-sm:rounded-[18px]">
        <div className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[1.45fr_0.55fr] lg:items-end lg:px-9 lg:py-8 max-sm:gap-3 max-sm:px-4 max-sm:py-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.04em] text-emerald-100 sm:text-sm max-sm:mb-2">
              <Leaf size={16} aria-hidden="true" />
              Ingredient workspace
            </div>

            <h2 className="max-w-2xl text-2xl font-extrabold leading-tight sm:text-3xl lg:text-[34px] max-sm:text-xl max-sm:leading-[1.18]">
              <span className="sm:hidden">
                Keep one ingredient name consistent across EPANTRY.
              </span>
              <span className="hidden sm:inline">
                Keep one clear ingredient name everywhere EPANTRY uses it.
              </span>
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/90 sm:text-[15px] max-sm:mt-2 max-sm:text-[13px] max-sm:leading-5">
              <span className="line-clamp-2 sm:hidden">
                Confirm the approved ingredient name before reviewing products or recipes.
              </span>
              <span className="hidden sm:inline">
                Use this library to confirm the standard name before reviewing product or recipe data. This keeps ingredient records consistent for everyone.
              </span>
            </p>
          </div>

          <div className="border-t border-white/15 pt-4 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0 max-sm:flex max-sm:items-end max-sm:gap-2 max-sm:pt-3">
            <p className="text-3xl font-extrabold leading-none sm:text-4xl max-sm:text-2xl">
              {ingredients.length}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-100 sm:text-sm max-sm:mb-0.5 max-sm:mt-0">
              standard ingredients loaded
            </p>
          </div>
        </div>

        <div className="border-t border-white/15 bg-[#0C4D3C]">
          <div className="px-5 py-3 sm:px-7 max-sm:px-4 max-sm:py-2.5">
            <p className="text-xs font-bold text-emerald-100 sm:text-sm">
              How to use this page
            </p>
          </div>

          <div className="grid border-t border-white/10 sm:grid-cols-2 xl:grid-cols-4 max-sm:grid-cols-2">
            {WORKFLOW_STEPS.map((step, index) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className={`px-5 py-4 sm:px-6 sm:py-5 max-sm:px-3.5 max-sm:py-3 ${
                    index > 0
                      ? "border-t border-white/10 sm:border-l sm:border-t-0"
                      : ""
                  } ${index === 2 ? "sm:border-l-0 xl:border-l" : ""} ${
                    index === 1 ? "max-sm:border-l max-sm:border-t-0" : ""
                  } ${
                    index === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""
                  } ${
                    index === 3 ? "max-sm:border-l max-sm:border-t" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 max-sm:gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-emerald-100 max-sm:h-7 max-sm:w-7 max-sm:rounded-md">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-bold text-emerald-200">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold sm:text-base max-sm:mt-2 max-sm:text-[13px] max-sm:leading-4">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-emerald-50/80 sm:text-[13px] max-sm:text-[11px] max-sm:leading-[1.45]">
                    <span className="line-clamp-2 sm:hidden">
                      {step.mobileDescription}
                    </span>
                    <span className="hidden sm:inline">{step.description}</span>
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] border border-sky-100 bg-[#F3F8FA] sm:mt-6 max-sm:mt-3 max-sm:rounded-[18px]">
        <div className="grid gap-4 border-b border-sky-100 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[1fr_auto] lg:items-end max-sm:gap-2.5 max-sm:px-4 max-sm:py-3.5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B5870] sm:text-sm">
              <CheckCircle2 size={15} aria-hidden="true" />
              Standard ingredient names
            </div>
            <h2 className="mt-2 text-xl font-extrabold text-slate-950 sm:text-2xl max-sm:mt-1.5 max-sm:text-lg">
              Browse ingredients from A to Z
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px] max-sm:text-[13px] max-sm:leading-5">
              <span className="line-clamp-2 sm:hidden">
                Browse A–Z. Use the reference only to tell similar ingredients apart.
              </span>
              <span className="hidden sm:inline">
                Ingredients are grouped by their first letter so you can find the right record quickly. The reference key is shown only to help distinguish similar records.
              </span>
            </p>
          </div>

          <div className="text-left lg:text-right max-sm:flex max-sm:items-baseline max-sm:gap-1.5">
            <p className="text-2xl font-extrabold text-[#0F5B45] sm:text-3xl max-sm:text-xl">
              {ingredients.length}
            </p>
            <p className="text-xs font-semibold text-slate-500 sm:text-sm max-sm:text-[11px]">
              records available
            </p>
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100 bg-white">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="grid min-h-[66px] animate-pulse grid-cols-[40px_1fr_auto] items-center gap-3 px-5 py-3 sm:px-7"
              >
                <div className="h-9 w-9 rounded-lg bg-slate-100" />
                <div>
                  <div className="h-4 w-40 rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="h-6 w-16 rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : sortedIngredients.length > 0 ? (
          <>
            <div className="sm:hidden">
              <IngredientGroups items={mobileIngredients} />

              {sortedIngredients.length > MOBILE_VISIBLE_LIMIT && (
                <div className="border-t border-sky-100 bg-[#E7F3F6] px-4 py-4 text-center max-sm:py-3">
                  <p className="mb-3 text-xs font-semibold text-slate-600 max-sm:mb-2">
                    {showAllMobile
                      ? `Showing all ${sortedIngredients.length} ingredients`
                      : `Showing ${MOBILE_VISIBLE_LIMIT} of ${sortedIngredients.length} ingredients`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllMobile((current) => !current)}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F5B45] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0C4D3C] max-sm:py-2 max-sm:text-[13px]"
                  >
                    {showAllMobile ? "Show fewer" : "View all ingredients"}
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={showAllMobile ? "rotate-180" : ""}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="hidden sm:block">
              <div className="grid grid-cols-[86px_minmax(0,1fr)] border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                <span className="px-4 py-3 text-center">A–Z</span>
                <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(170px,0.55fr)_auto] items-center gap-3 px-5 py-3 sm:px-5 lg:gap-4">
                  <span />
                  <span>Ingredient</span>
                  <span>Reference</span>
                  <span className="text-right">Status</span>
                </div>
              </div>

              <IngredientGroups items={desktopIngredients} />

              {sortedIngredients.length > DESKTOP_VISIBLE_LIMIT && (
                <div className="border-t border-sky-100 bg-[#E7F3F6] px-5 py-4 text-center sm:px-7">
                  <p className="mb-3 text-sm font-semibold text-slate-600">
                    {showAllDesktop
                      ? `Showing all ${sortedIngredients.length} ingredients`
                      : `Showing ${DESKTOP_VISIBLE_LIMIT} of ${sortedIngredients.length} ingredients`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAllDesktop((current) => !current)}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F5B45] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0C4D3C]"
                  >
                    {showAllDesktop ? "Show fewer" : "View all ingredients"}
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={showAllDesktop ? "rotate-180" : ""}
                    />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white px-5 py-10 text-center sm:px-7 sm:py-12">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-[#0F6A50]">
              <Leaf size={20} aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              No ingredients are available yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Standard ingredient records will appear here when they are available for review.
            </p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
