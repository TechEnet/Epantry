import {
  Apple,
  BadgeCheck,
  ChefHat,
  CircleAlert,
  Leaf,
  LoaderCircle,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
  listAdminNpiReviewQueue,
} from "../../universalProduct/services/universalProduct.service";

import {
  changeAdminDishLifecycle,
  listAdminRecipes,
} from "../../recipes/services/recipe.service";

import AdminShell from "../components/AdminShell";
import { useAdmin } from "../context/AdminContext";
import useAdminCatalog from "../hooks/useAdminCatalog";

const CATALOG_SECTIONS = [
  ["packaged", "Packaged Food", Package],
  ["vegetable", "Vegetables", Leaf],
  ["fruit", "Fruits", Apple],
  ["recipe", "Recipes", ChefHat],
];

function titleize(value) {
  return String(value || "unknown")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function getStatusClasses(status) {
  switch (status) {
    case "active":
    case "published":
      return "bg-emerald-50 text-emerald-800";

    case "draft":
      return "bg-blue-50 text-blue-800";

    case "in_review":
      return "bg-violet-50 text-violet-800";

    case "disabled":
    case "retired":
      return "bg-stone-200 text-stone-600";

    default:
      return "bg-blue-50 text-blue-800";
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusClasses(
        status,
      )}`}
    >
      {titleize(status)}
    </span>
  );
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function getRecipeRows(result) {
  return Array.isArray(result?.recipes) ? result.recipes : [];
}

function getDraftRows(result) {
  return Array.isArray(result?.drafts) ? result.drafts : [];
}

export default function AdminCatalogPage() {
  const navigate = useNavigate();
  const { hasAdminPermission } = useAdmin();

  const canReadCatalog = hasAdminPermission("catalog.read");
  const canMutateCatalog = hasAdminPermission("catalog.mutate");
  const canReadRecipes = hasAdminPermission("recipe.read");
  const canMutateRecipes = hasAdminPermission("recipe.mutate");

  const {
    versions,
    loading: catalogLoading,
    mutating,
    error: catalogError,
    loadVersions,
    submitForReview,
    publishVersion,
    retireVersion,
  } = useAdminCatalog();

  const [activeSection, setActiveSection] = useState(
    canReadCatalog ? "packaged" : "recipe",
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [localError, setLocalError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [listingTypeByVersionId, setListingTypeByVersionId] = useState({});
  const [listingTypeByPackId, setListingTypeByPackId] = useState({});
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [isDesktopView, setIsDesktopView] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 640px)").matches
      : true,
  );

  const loadListingTypeMap = useCallback(async () => {
    if (!canReadCatalog) {
      setListingTypeByVersionId({});
      setListingTypeByPackId({});
      return;
    }

    const firstPage = await listAdminNpiReviewQueue({
      page: 1,
      limit: 100,
      status: "approved_for_catalog",
    });

    const firstDrafts = getDraftRows(firstPage);
    const totalPages = Number(firstPage?.pagination?.pages || 1);
    let drafts = firstDrafts;

    if (totalPages > 1) {
      const requests = [];

      for (let page = 2; page <= totalPages; page += 1) {
        requests.push(
          listAdminNpiReviewQueue({
            page,
            limit: 100,
            status: "approved_for_catalog",
          }),
        );
      }

      const remainingPages = await Promise.all(requests);
      drafts = [
        ...firstDrafts,
        ...remainingPages.flatMap((result) => getDraftRows(result)),
      ];
    }

    const nextVersionMap = {};
    const nextPackMap = {};

    drafts.forEach((draft) => {
      const listingType = draft?.listingType || "packaged";
      const versionId = draft?.catalogProductVersionId;
      const packId = draft?.catalogPackId;

      if (versionId) {
        nextVersionMap[String(versionId)] = listingType;
      }

      if (packId) {
        nextPackMap[String(packId)] = listingType;
      }
    });

    setListingTypeByVersionId(nextVersionMap);
    setListingTypeByPackId(nextPackMap);
  }, [canReadCatalog]);

  const loadRecipes = useCallback(async () => {
    if (!canReadRecipes) {
      setRecipes([]);
      return;
    }

    setRecipeLoading(true);

    try {
      const result = await listAdminRecipes({
        page: 1,
        limit: 100,
        status: "all",
      });

      setRecipes(getRecipeRows(result));
    } finally {
      setRecipeLoading(false);
    }
  }, [canReadRecipes]);

  const refreshWorkspace = useCallback(async () => {
    setLocalError("");

    try {
      const requests = [];

      if (canReadCatalog) {
        requests.push(
          loadVersions({
            page: 1,
            limit: 100,
          }),
        );
        requests.push(loadListingTypeMap());
      }

      if (canReadRecipes) {
        requests.push(loadRecipes());
      }

      await Promise.all(requests);
    } catch (requestError) {
      setLocalError(
        errorMessage(
          requestError,
          "Unable to refresh Catalog & Listings.",
        ),
      );
    }
  }, [
    canReadCatalog,
    canReadRecipes,
    loadListingTypeMap,
    loadRecipes,
    loadVersions,
  ]);

  useEffect(() => {
    refreshWorkspace().catch(() => {});
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!canReadCatalog && canReadRecipes) {
      setActiveSection("recipe");
    }
  }, [canReadCatalog, canReadRecipes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const syncViewport = () => setIsDesktopView(mediaQuery.matches);

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  const productRowsByType = useMemo(() => {
    const groups = {
      packaged: [],
      vegetable: [],
      fruit: [],
    };

    versions.forEach((version) => {
      const versionId = String(version?.id || version?._id || "");
      const packId = String(version?.packId || "");
      const listingType =
        listingTypeByVersionId[versionId] ||
        listingTypeByPackId[packId] ||
        "packaged";

      if (listingType === "vegetable" || listingType === "fruit") {
        groups[listingType].push(version);
      } else {
        groups.packaged.push(version);
      }
    });

    return groups;
  }, [listingTypeByPackId, listingTypeByVersionId, versions]);

  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    setShowAllRecords(false);
  }, [activeSection, statusFilter, normalizedSearch, isDesktopView]);

  const visibleProducts = useMemo(() => {
    if (activeSection === "recipe") {
      return [];
    }

    const source = productRowsByType[activeSection] || [];

    return source.filter((version) => {
      if (
        statusFilter !== "all" &&
        statusFilter !== "current" &&
        version.publicationStatus !== statusFilter
      ) {
        return false;
      }

      if (
        statusFilter === "current" &&
        version.publicationStatus === "retired"
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        version.displayName,
        version.gtin,
        version.packId,
        version.id,
        version._id,
        version.publicationStatus,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });
  }, [
    activeSection,
    normalizedSearch,
    productRowsByType,
    statusFilter,
  ]);

  const visibleRecipes = useMemo(() => {
    if (activeSection !== "recipe") {
      return [];
    }

    return recipes.filter((item) => {
      const dish = item?.dish || {};
      const version = item?.latestVersion || {};
      const effectiveStatus = version.status || dish.status;

      if (
        statusFilter !== "all" &&
        statusFilter !== "current" &&
        effectiveStatus !== statusFilter
      ) {
        return false;
      }

      if (statusFilter === "current" && dish.status === "retired") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        dish.name,
        dish.cuisine,
        dish.course,
        dish.id,
        dish.status,
        version.id,
        version.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });
  }, [activeSection, normalizedSearch, recipes, statusFilter]);

  const sectionCounts = useMemo(
    () => ({
      packaged: productRowsByType.packaged.length,
      vegetable: productRowsByType.vegetable.length,
      fruit: productRowsByType.fruit.length,
      recipe: recipes.length,
    }),
    [productRowsByType, recipes.length],
  );

  async function handleSubmitForReview(version) {
    const versionId = version?.id || version?._id;

    if (!versionId || mutating || !canMutateCatalog) {
      return;
    }

    setActionNotice("");
    setLocalError("");

    try {
      await submitForReview(versionId);
      setActionNotice(
        `${version.displayName || "Product Version"} moved to M04 review.`,
      );
      await refreshWorkspace();
    } catch (requestError) {
      setLocalError(
        errorMessage(
          requestError,
          "Unable to submit this Product Version for review.",
        ),
      );
    }
  }

  async function handlePublish(version) {
    const versionId = version?.id || version?._id;

    if (!versionId || mutating || !canMutateCatalog) {
      return;
    }

    setActionNotice("");
    setLocalError("");

    try {
      await publishVersion(versionId, {
        reasonCode: "catalog.governance",
        reasonDetails:
          "Governed M04 publication after approved evidence handoff and Product Version review.",
      });

      setActionNotice(
        `${version.displayName || "Product Version"} published to the canonical catalog.`,
      );
      await refreshWorkspace();
    } catch (requestError) {
      setLocalError(
        errorMessage(requestError, "Unable to publish this Product Version."),
      );
    }
  }

  async function deleteProduct(version) {
    const versionId = version?.id || version?._id;

    if (
      !versionId ||
      !canMutateCatalog ||
      version.publicationStatus === "retired" ||
      busyId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${version.displayName || "this product listing"}"? The Product Version will be retired so governed history remains intact.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(`product:${versionId}`);
    setActionNotice("");
    setLocalError("");

    try {
      await retireVersion(versionId, {
        reasonCode: "catalog.deleted_by_admin",
        reasonDetails:
          "Deleted from the merged Catalog & Listings workspace. Canonical history is retained as a retired Product Version.",
      });

      setActionNotice(
        "Product listing removed from the current catalog. Governed history is retained.",
      );
      await refreshWorkspace();
    } catch (requestError) {
      setLocalError(
        errorMessage(requestError, "Unable to delete product listing."),
      );
    } finally {
      setBusyId("");
    }
  }

  async function deleteRecipe(dish) {
    if (
      !dish?.id ||
      !canMutateRecipes ||
      dish.status === "retired" ||
      busyId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${dish.name || "this Recipe"}"? The Dish will be retired so governed Recipe history remains available for audit.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(`recipe:${dish.id}`);
    setActionNotice("");
    setLocalError("");

    try {
      await changeAdminDishLifecycle(dish.id, {
        action: "retire",
        reason:
          "Deleted from the merged Catalog & Listings workspace. Governed Recipe history is retained as retired.",
      });

      setActionNotice(
        "Recipe removed from current listings. Governed history is retained.",
      );
      await refreshWorkspace();
    } catch (requestError) {
      setLocalError(errorMessage(requestError, "Unable to delete Recipe listing."));
    } finally {
      setBusyId("");
    }
  }

  const activeLabel =
    CATALOG_SECTIONS.find(([value]) => value === activeSection)?.[1] ||
    "Packaged Food";
  const pageLoading = catalogLoading || recipeLoading;
  const visibleCount =
    activeSection === "recipe" ? visibleRecipes.length : visibleProducts.length;
  const recordLimit = isDesktopView ? 20 : 8;
  const displayedProducts = showAllRecords
    ? visibleProducts
    : visibleProducts.slice(0, recordLimit);
  const displayedRecipes = showAllRecords
    ? visibleRecipes
    : visibleRecipes.slice(0, recordLimit);
  const displayedCount = showAllRecords
    ? visibleCount
    : Math.min(visibleCount, recordLimit);
  const hasHiddenRecords = !showAllRecords && visibleCount > recordLimit;

  return (
    <AdminShell
      title="Catalog & Listings"
      description="Manage approved catalog records and governed listing history from one workspace. Recipe creation and review remain in Recipe Management."
      actions={
        <button
          type="button"
          onClick={() => refreshWorkspace().catch(() => {})}
          disabled={pageLoading}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"
        >
          <RefreshCw
            size={15}
            className={pageLoading ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <section className="overflow-hidden rounded-[22px] bg-[#083E35] text-white sm:rounded-[26px]">
          <div className="grid gap-5 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8CE2BF] sm:text-[11px]">
                Catalog workspace
              </p>
              <h2 className="mt-2 text-[24px] font-black leading-[1.08] tracking-[-0.035em] text-white sm:text-[30px]">
                Govern every listing from one clear workspace.
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] font-semibold leading-5 text-white/72 sm:text-[15px] sm:leading-6">
                Review current records, edit governed details and retire listings without splitting history across separate pages.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5 border-t border-white/15 pt-4 lg:min-w-[250px] lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8CE2BF] sm:text-[10px]">
                  Matching records
                </p>
                <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">
                  {visibleCount}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8CE2BF] sm:text-[10px]">
                  Active category
                </p>
                <p className="mt-2 text-sm font-black text-white">
                  {activeLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/15 sm:grid-cols-4">
            {CATALOG_SECTIONS.map(([value, label, Icon], index) => {
              const selected = activeSection === value;
              const allowed = value === "recipe" ? canReadRecipes : canReadCatalog;

              if (!allowed) {
                return null;
              }

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveSection(value)}
                  className={[
                    "focus-ring flex min-h-[68px] items-center gap-2.5 px-3.5 py-3 text-left transition sm:min-h-[78px] sm:px-5 sm:py-4",
                    index % 2 === 1 ? "border-l border-white/15" : "",
                    index > 1 ? "border-t border-white/15 sm:border-t-0" : "",
                    index > 0 ? "sm:border-l sm:border-white/15" : "",
                    selected
                      ? "bg-[#18A36B] text-white"
                      : "bg-transparent text-white hover:bg-white/10",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10",
                      selected
                        ? "bg-white/18 text-white"
                        : "bg-white/10 text-[#A7EBCF]",
                    ].join(" ")}
                  >
                    <Icon size={18} aria-hidden="true" />
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-black sm:text-sm">
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-white/65 sm:text-xs">
                      {sectionCounts[value]} records
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-[22px] border border-[#BBDACF] bg-[#E7F4EF] sm:rounded-[24px]">
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-6 sm:py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0B7154]">
                Listing controls
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.025em] text-stone-950 sm:text-[22px]">
                {activeLabel}
              </h2>
              <p className="mt-1 text-[13px] font-semibold text-stone-600 sm:text-sm">
                Filter the governed record set before editing or retiring anything.
              </p>
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="focus-ring h-11 rounded-xl border border-[#AFCFC3] bg-white px-3 text-sm font-bold text-stone-700 outline-none"
            >
              <option value="all">All records</option>
              <option value="current">Current only</option>
              <option value="draft">Draft</option>
              <option value="in_review">In review</option>
              <option value="published">Published</option>
              <option value="retired">Retired</option>
            </select>
          </div>

          <div className="border-t border-[#C6E0D7] px-5 py-3.5 sm:px-6 sm:py-4">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${activeLabel.toLowerCase()}...`}
                className="focus-ring h-11 w-full rounded-xl border border-[#AFCFC3] bg-white pl-10 pr-3 text-sm font-semibold text-stone-800 outline-none"
              />
            </div>
          </div>
        </section>

        {catalogError || localError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {localError || catalogError}
          </div>
        ) : null}

        {actionNotice ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {actionNotice}
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[22px] border border-stone-200 bg-[#FBFAF7] sm:rounded-[24px]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 bg-[#F4F1EA] px-5 py-4 sm:px-6 sm:py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#204B63]">
                Governed catalog
              </p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-stone-950 sm:text-xl">
                {activeLabel} records
              </h2>
              <p className="mt-1 text-[12px] font-semibold text-stone-500 sm:text-[13px]">
                Showing {displayedCount} of {visibleCount} matching records
              </p>
            </div>

            <span className="rounded-full bg-[#DDEAF1] px-3 py-1.5 text-xs font-black text-[#204B63]">
              {visibleCount} items
            </span>
          </div>

          {pageLoading ? (
            <div className="grid min-h-56 place-items-center">
              <LoaderCircle
                size={28}
                className="animate-spin text-[#0B6A50]"
                aria-label="Loading catalog listings"
              />
            </div>
          ) : activeSection === "recipe" ? (
            visibleRecipes.length > 0 ? (
              <div className="divide-y divide-stone-200">
                {displayedRecipes.map((item) => {
                  const dish = item?.dish || {};
                  const version = item?.latestVersion || {};
                  const foodIntelligence = item?.foodIntelligence || {};
                  const canEdit = Boolean(version.id) && dish.status !== "retired";
                  const canDelete = canMutateRecipes && dish.status !== "retired";

                  return (
                    <article
                      key={dish.id || version.id}
                      className="grid gap-3 px-5 py-4 transition hover:bg-white/70 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E4ECF2] text-[#204B63] sm:h-11 sm:w-11">
                          <ChefHat size={19} aria-hidden="true" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 truncate text-[15px] font-black text-stone-950 sm:text-base">
                              {dish.name || "Untitled Recipe"}
                            </h3>
                            <StatusBadge status={version.status || dish.status} />
                            <span
                              className={[
                                "rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]",
                                foodIntelligence.approved
                                  ? "bg-emerald-50 text-emerald-800"
                                  : foodIntelligence.status === "requires_review"
                                    ? "bg-violet-50 text-violet-800"
                                    : "bg-rose-50 text-rose-700",
                              ].join(" ")}
                            >
                              Food: {foodIntelligence.approved
                                ? "approved"
                                : foodIntelligence.status === "requires_review"
                                  ? "review required"
                                  : "missing"}
                            </span>
                          </div>

                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-500">
                            <span>{dish.cuisine || "Cuisine not set"}</span>
                            <span>{dish.course || "Course not set"}</span>
                            <span>Version {version.versionNumber || "-"}</span>
                          </div>

                          <div className="mt-2 grid gap-1 text-[11px] font-semibold text-stone-400 sm:grid-cols-2 sm:gap-x-5">
                            <p className="break-all">RecipeVersion ID: {version.id || "-"}</p>
                            <p>Updated {formatDate(version.updatedAt || dish.updatedAt)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 pl-[52px] sm:pl-[60px] lg:pl-0">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/recipes/${encodeURIComponent(version.id)}`)
                            }
                            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </button>
                        ) : null}

                        {canDelete ? (
                          <button
                            type="button"
                            disabled={Boolean(busyId)}
                            onClick={() => deleteRecipe(dish)}
                            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                          >
                            {busyId === `recipe:${dish.id}` ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2 size={14} aria-hidden="true" />
                            )}
                            Delete
                          </button>
                        ) : (
                          <span className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500">
                            {dish.status === "retired"
                              ? "Historical record"
                              : "Read-only permission"}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-sm font-semibold text-stone-500 sm:px-6">
                No Recipe records match this filter.
              </div>
            )
          ) : visibleProducts.length > 0 ? (
            <div className="divide-y divide-stone-200">
              {displayedProducts.map((version) => {
                const versionId = version.id || version._id;
                const canEdit = Boolean(versionId) && version.publicationStatus !== "retired";
                const canDelete =
                  canMutateCatalog && version.publicationStatus !== "retired";

                return (
                  <article
                    key={versionId}
                    className="grid gap-3 px-5 py-4 transition hover:bg-white/70 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DDF4E8] text-[#0B6A50] sm:h-11 sm:w-11">
                        {activeSection === "vegetable" ? (
                          <Leaf size={19} aria-hidden="true" />
                        ) : activeSection === "fruit" ? (
                          <Apple size={19} aria-hidden="true" />
                        ) : (
                          <Package size={19} aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="min-w-0 truncate text-[15px] font-black text-stone-950 sm:text-base">
                            {version.displayName || "Unnamed product"}
                          </h3>
                          <StatusBadge status={version.publicationStatus} />
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-stone-500">
                          <span>Version {version.version || 1}</span>
                          <span>{version.gtin || "No GTIN"}</span>
                        </div>

                        <div className="mt-2 grid gap-1 text-[11px] font-semibold text-stone-400 sm:grid-cols-2 sm:gap-x-5">
                          <p className="break-all">Pack ID: {version.packId || "-"}</p>
                          <p className="break-all">ProductVersion ID: {versionId || "-"}</p>
                          <p>Updated {formatDate(version.updatedAt || version.createdAt)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 pl-[52px] sm:pl-[60px] lg:pl-0">
                      {version.publicationStatus === "draft" && canMutateCatalog ? (
                        <button
                          type="button"
                          disabled={mutating || Boolean(busyId)}
                          onClick={() => handleSubmitForReview(version)}
                          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                          <Send size={14} aria-hidden="true" />
                          Submit for review
                        </button>
                      ) : null}

                      {version.publicationStatus === "in_review" && canMutateCatalog ? (
                        <button
                          type="button"
                          disabled={mutating || Boolean(busyId)}
                          onClick={() => handlePublish(version)}
                          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#0B6A50] px-3 py-2 text-xs font-black text-white hover:bg-[#095640] disabled:opacity-60"
                        >
                          <BadgeCheck size={14} aria-hidden="true" />
                          Publish
                        </button>
                      ) : null}

                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/admin/catalog/products/${encodeURIComponent(versionId)}`)
                          }
                          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </button>
                      ) : null}

                      {canDelete ? (
                        <button
                          type="button"
                          disabled={Boolean(busyId) || mutating}
                          onClick={() => deleteProduct(version)}
                          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
                        >
                          {busyId === `product:${versionId}` ? (
                            <LoaderCircle
                              size={14}
                              className="animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 size={14} aria-hidden="true" />
                          )}
                          Delete
                        </button>
                      ) : version.publicationStatus === "retired" ? (
                        <span className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-500">
                          Historical record
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-8 text-sm font-semibold text-stone-500 sm:px-6">
              No {activeLabel.toLowerCase()} records match this filter.
            </div>
          )}

          {hasHiddenRecords ? (
            <div className="border-t border-stone-200 bg-white px-5 py-4 text-center sm:px-6">
              <button
                type="button"
                onClick={() => setShowAllRecords(true)}
                className="focus-ring inline-flex min-h-10 items-center justify-center rounded-xl bg-[#204B63] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#173A4D]"
              >
                View all {visibleCount} records
              </button>
              <p className="mt-2 text-[11px] font-semibold text-stone-500 sm:text-xs">
                Showing the first {recordLimit} records for this screen size.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}