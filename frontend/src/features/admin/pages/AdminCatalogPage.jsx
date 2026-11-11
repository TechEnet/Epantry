import {
  Apple,
  BadgeCheck,
  ChefHat,
  CircleAlert,
  ChevronDown,
  ChevronRight,
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
import { getAdminProductVersions } from "../services/catalogAdmin.service";
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
      return "bg-[#E4F1E8] text-[#1A6546]";

    case "draft":
      return "bg-[#E6EEF5] text-[#315F7C]";

    case "in_review":
      return "bg-[#ECE7F5] text-[#68548C]";

    case "disabled":
    case "retired":
      return "bg-[#E9E9E5] text-[#686B64]";

    default:
      return "bg-[#E6EEF5] text-[#315F7C]";
  }
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold sm:px-2.5 sm:py-1 ${getStatusClasses(
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


function CatalogImage({ src, name, type }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const Icon = type === "recipe" ? ChefHat : type === "vegetable" ? Leaf : type === "fruit" ? Apple : Package;
  return (
    <div className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-lg bg-[#E5EBE3] text-[#315847] sm:h-[68px] sm:w-[68px]">
      {src && !failed ? (
        <img src={src} alt={name || "Catalog item"} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <Icon size={26} strokeWidth={1.7} aria-hidden="true" />
      )}
    </div>
  );
}

function RecordDetails({ children, open, onToggle, id }) {
  return (
    <div className="sm:col-span-2">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-[#476456] hover:text-[#173F35] focus-ring">
        {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
        {open ? "Hide record details" : "Record details"}
      </button>
      {open ? <div id={id} className="mt-1 grid gap-x-8 gap-y-2 rounded-md border border-[#DEE5DD] bg-[#F5F7F2] px-4 py-3 text-[13px] leading-5 text-[#4A5D52] sm:grid-cols-2">{children}</div> : null}
    </div>
  );
}

export default function AdminCatalogPage({ productOnly = false }) {
  const navigate = useNavigate();
  const { hasAdminPermission } = useAdmin();

  const canReadCatalog = hasAdminPermission("catalog.read");
  const canMutateCatalog = hasAdminPermission("catalog.mutate");
  const canReadRecipes = !productOnly && hasAdminPermission("recipe.read");
  const canMutateRecipes = !productOnly && hasAdminPermission("recipe.mutate");

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
  const [expandedRecord, setExpandedRecord] = useState("");
  const [extraVersions, setExtraVersions] = useState([]);
  const [catalogPaging, setCatalogPaging] = useState(false);
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

  // The API has a 100-row page limit; collect subsequent pages instead of
  // silently presenting the first page as the entire governed catalog.
  const loadAllVersions = useCallback(async () => {
    setCatalogPaging(true);
    setExtraVersions([]);
    try {
      const first = await loadVersions({ page: 1, limit: 100 });
      const pageCount = Math.max(1, Number(first?.pagination?.pages || 1));
      const extra = [];
      for (let start = 2; start <= pageCount; start += 3) {
        const pages = await Promise.all(
          Array.from({ length: Math.min(3, pageCount - start + 1) }, (_, offset) =>
            getAdminProductVersions({ page: start + offset, limit: 100 })
          )
        );
        pages.forEach((page) => {
          extra.push(...(page?.items || page?.productVersions || page?.versions || []));
        });
      }
      setExtraVersions(extra);
    } finally {
      setCatalogPaging(false);
    }
  }, [loadVersions]);

  const loadRecipes = useCallback(async () => {
    if (!canReadRecipes) {
      setRecipes([]);
      return;
    }

    setRecipeLoading(true);

    try {
      const first = await listAdminRecipes({ page: 1, limit: 100, status: "all" });
      const allRecipes = getRecipeRows(first);
      const pageCount = Math.max(1, Number(first?.pagination?.pages || 1));
      for (let start = 2; start <= pageCount; start += 3) {
        const results = await Promise.all(
          Array.from({ length: Math.min(3, pageCount - start + 1) }, (_, offset) =>
            listAdminRecipes({ page: start + offset, limit: 100, status: "all" })
          )
        );
        results.forEach((page) => allRecipes.push(...getRecipeRows(page)));
      }
      setRecipes(allRecipes);
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
          loadAllVersions(),
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
    loadAllVersions,
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

  const allCatalogVersions = useMemo(() => [...versions, ...extraVersions], [versions, extraVersions]);

  const productRowsByType = useMemo(() => {
    const groups = {
      packaged: [],
      vegetable: [],
      fruit: [],
    };

    allCatalogVersions.forEach((version) => {
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
  }, [allCatalogVersions, listingTypeByPackId, listingTypeByVersionId]);

  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    setShowAllRecords(false);
    setExpandedRecord("");
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
  const pageLoading = catalogLoading || catalogPaging || recipeLoading;
  const visibleCount =
    activeSection === "recipe" ? visibleRecipes.length : visibleProducts.length;
  const recordLimit = isDesktopView ? 10 : 5;
  const displayedProducts = showAllRecords
    ? visibleProducts
    : visibleProducts.slice(0, recordLimit);
  const displayedRecipes = showAllRecords
    ? visibleRecipes
    : visibleRecipes.slice(0, recordLimit);
  const displayedCount = showAllRecords
    ? visibleCount
    : Math.min(visibleCount, recordLimit);

  return (
    <AdminShell
      title="Catalog & Listings"
      actions={
        <button
          type="button"
          onClick={() => refreshWorkspace().catch(() => {})}
          disabled={pageLoading}
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFD9CF] bg-white px-4 text-[14px] font-semibold text-[#173F35] hover:bg-[#EDF3EB] disabled:opacity-60"
        >
          <RefreshCw size={16} className={pageLoading ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <main className="min-w-0 bg-[#F7F6F2] text-[#202421]">
        {/* The workspace title and refresh action are shown in AdminShell. Keep the
            catalog categories as the first action instead of repeating the page
            title, summary text and active record count in extra hero panels. */}
        <section aria-label="Catalog categories" className="border-y border-[#D8DED8] bg-[#FCFBF8]">
          <nav aria-label="Catalog types" className={`grid min-w-0 gap-px bg-[#DBE0D9] ${productOnly ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
            {CATALOG_SECTIONS.map(([value, label, Icon]) => {
              const allowed = value === "recipe" ? canReadRecipes : canReadCatalog;
              if (!allowed) return null;
              const selected = value === activeSection;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveSection(value)}
                  className={`focus-ring flex min-h-[74px] min-w-0 flex-col items-start justify-center gap-1 border-b-[3px] px-2.5 py-2 text-left transition sm:min-h-[76px] sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-3 ${selected ? "border-[#173F35] bg-[#173F35] text-white" : "border-transparent bg-[#FCFBF8] text-[#344F43] hover:bg-[#F1F4EF]"}`}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0 sm:h-[22px] sm:w-[22px]" strokeWidth={1.7} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold leading-[17px] sm:text-[16px] sm:leading-5">{label}</span>
                    <span className="mt-0.5 block text-[12px] font-medium leading-4 opacity-80 sm:text-[13px]">{sectionCounts[value]} records</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </section>

        <section aria-label="Search and filter listings" className="border-b border-[#DFE5DF] bg-[#F2F2ED] px-3 py-3.5 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[21px] font-bold leading-tight text-[#173F35] sm:text-[25px]">{activeLabel} records</h2>
              <p className="mt-1 text-[14px] text-[#53685A]">{visibleCount} matching records{normalizedSearch || statusFilter !== "all" ? " · filtered results" : ""}</p>
            </div>
            {(normalizedSearch || statusFilter !== "all") ? (
              <button type="button" onClick={() => { setSearch(""); setStatusFilter("all"); }} className="focus-ring min-h-10 text-[14px] font-semibold text-[#315F49] underline underline-offset-4">Clear filters</button>
            ) : null}
          </div>
          <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_116px] gap-2 sm:mt-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:gap-3">
            <label className="relative block min-w-0">
              <span className="sr-only">Search catalog by name, barcode or record ID</span>
              <Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#53705C]" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={isDesktopView ? "Search name, barcode or record ID" : "Search records"}
                className="focus-ring h-12 w-full min-w-0 rounded-md border border-[#CBD7CB] bg-white pl-10 pr-2 text-[14px] text-[#173F35] outline-none placeholder:text-[#7F8D81] sm:pl-11 sm:pr-3 sm:text-[15px]"
              />
            </label>
            <label className="block">
              <span className="sr-only">Filter by publication status</span>
              <select
                aria-label="Filter by publication status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="focus-ring h-12 w-full min-w-0 rounded-md border border-[#CBD7CB] bg-white px-2 text-[13px] font-semibold text-[#173F35] outline-none sm:px-3 sm:text-[15px]"
              >
                <option value="all">All statuses</option>
                <option value="current">Current only</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="published">Published</option>
                <option value="retired">Retired</option>
              </select>
            </label>
          </div>
        </section>

        {catalogError || localError ? (
          <div role="alert" className="mx-4 mt-4 flex items-start gap-3 border-l-4 border-[#B94C4C] bg-[#FEF0EE] px-4 py-3 text-[15px] text-[#933D3D] sm:mx-6">
            <CircleAlert size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{localError || catalogError}</span>
          </div>
        ) : null}
        {actionNotice ? <div role="status" className="mx-4 mt-4 border-l-4 border-[#2F835C] bg-[#E8F2E9] px-4 py-3 text-[15px] text-[#1B5B3B] sm:mx-6">{actionNotice}</div> : null}

        <section aria-label="Catalog results" id="catalog-results" className="min-w-0 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#E0E6E0] bg-[#F6F8F5] px-3 py-2.5 sm:px-6 sm:py-4">
            <div>
              <h3 className="hidden text-[18px] font-bold text-[#173F35] sm:block sm:text-[20px]">Records</h3>
              <p className="text-[13px] font-medium text-[#647369] sm:font-normal">Showing {displayedCount} of {visibleCount}</p>
            </div>
            <span className="border border-[#CAD7CA] bg-[#EDF2EB] px-3 py-1.5 text-[14px] font-semibold tabular-nums text-[#264E39]">{visibleCount} found</span>
          </div>

          {pageLoading ? (
            <div role="status" className="flex min-h-44 items-center justify-center gap-3 p-6 text-[16px] text-[#42634D]">
              <LoaderCircle size={23} className="animate-spin" aria-hidden="true" /> Loading records…
            </div>
          ) : activeSection === "recipe" ? (
            visibleRecipes.length ? (
              <div className="divide-y divide-[#E3E7E3]">
                {displayedRecipes.map((item) => {
                  const dish = item?.dish || {};
                  const version = item?.latestVersion || {};
                  const food = item?.foodIntelligence || {};
                  const key = String(dish.id || version.id || "");
                  const detailsId = `catalog-recipe-${key}`;
                  const canEdit = Boolean(version.id) && dish.status !== "retired";
                  const canDelete = canMutateRecipes && dish.status !== "retired";
                  return (
                    <article key={key} className="grid min-w-0 gap-2 px-3 py-3 transition hover:bg-[#F3F8F6] sm:gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-4">
                      <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                        <CatalogImage src={dish.heroImageUrl || version.heroImageUrl} name={dish.name} type="recipe" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h4 className="min-w-0 text-[16px] font-bold leading-6 text-[#173F35] sm:text-[17px]">{dish.name || "Untitled recipe"}</h4>
                            <StatusBadge status={version.status || dish.status} />
                          </div>
                          <p className="mt-1 text-[14px] leading-5 text-[#647165]">{[dish.cuisine, dish.course, `Version ${version.versionNumber || "–"}`].filter(Boolean).join(" · ")}</p>
                          <p className="mt-1 text-[13px] font-semibold text-[#506B57]">Food check: {food.approved ? "Approved" : food.status === "requires_review" ? "Needs review" : "Not available"}</p>
                          <RecordDetails id={detailsId} open={expandedRecord === `recipe:${key}`} onToggle={() => setExpandedRecord((current) => current === `recipe:${key}` ? "" : `recipe:${key}`)}>
                            <p className="break-all"><strong>Recipe version ID:</strong> {version.id || "–"}</p>
                            <p><strong>Updated:</strong> {formatDate(version.updatedAt || dish.updatedAt)}</p>
                            <p className="break-all"><strong>Dish ID:</strong> {dish.id || "–"}</p>
                          </RecordDetails>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-[62px] sm:justify-end sm:pl-0">
                        {canEdit ? (
                          <button type="button" onClick={() => navigate(`/admin/recipes/${encodeURIComponent(version.id)}`)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#BDD2C1] bg-white px-3 text-[14px] font-semibold text-[#173F35] hover:bg-[#E9F1E8]"><Pencil size={15} aria-hidden="true" /> Edit</button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" disabled={Boolean(busyId)} onClick={() => deleteRecipe(dish)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#F1C9C7] bg-[#FFF3F1] px-3 text-[14px] font-semibold text-[#AE4242] disabled:opacity-50">
                            {busyId === `recipe:${dish.id}` ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />} Delete
                          </button>
                        ) : <span className="text-[13px] text-[#778477]">{dish.status === "retired" ? "Historical record" : "Read-only access"}</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <p className="px-5 py-8 text-[15px] text-[#647165]">No recipes match your search or filters.</p>
          ) : visibleProducts.length ? (
            <div className="divide-y divide-[#E3E7E3]">
              {displayedProducts.map((version) => {
                const versionId = version.id || version._id;
                const key = String(versionId);
                const detailsId = `catalog-product-${key}`;
                const canEdit = Boolean(versionId) && version.publicationStatus !== "retired";
                const canDelete = canMutateCatalog && version.publicationStatus !== "retired";
                const imageUrl = version?.images?.find((image) => image?.url)?.url;
                return (
                  <article key={key} className="grid min-w-0 gap-2 px-3 py-3 transition hover:bg-[#F3F8F6] sm:gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                      <CatalogImage src={imageUrl} name={version.displayName} type={activeSection} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h4 className="min-w-0 text-[16px] font-bold leading-6 text-[#173F35] sm:text-[17px]">{version.displayName || "Unnamed product"}</h4>
                          <StatusBadge status={version.publicationStatus} />
                        </div>
                        <p className="mt-1 text-[14px] leading-5 text-[#627267]">
                          Version {version.version || 1} <span className="mx-1.5 text-[#A0AEA1]">·</span> {version.gtin ? `Barcode ${version.gtin}` : "Barcode not available"}
                        </p>
                        <RecordDetails id={detailsId} open={expandedRecord === `product:${key}`} onToggle={() => setExpandedRecord((current) => current === `product:${key}` ? "" : `product:${key}`)}>
                          <p className="break-all"><strong>Pack ID:</strong> {version.packId || "–"}</p>
                          <p className="break-all"><strong>Product version ID:</strong> {key || "–"}</p>
                          <p><strong>Updated:</strong> {formatDate(version.updatedAt || version.createdAt)}</p>
                          <p><strong>Barcode:</strong> {version.gtin || "Not available"}</p>
                        </RecordDetails>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pl-[62px] sm:justify-end sm:pl-0">
                      {version.publicationStatus === "draft" && canMutateCatalog ? (
                        <button type="button" disabled={mutating || Boolean(busyId)} onClick={() => handleSubmitForReview(version)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[#305F83] px-3 text-[14px] font-semibold text-white disabled:opacity-50"><Send size={15} aria-hidden="true" /> Submit for review</button>
                      ) : null}
                      {version.publicationStatus === "in_review" && canMutateCatalog ? (
                        <button type="button" disabled={mutating || Boolean(busyId)} onClick={() => handlePublish(version)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[#173F35] px-3 text-[14px] font-semibold text-white disabled:opacity-50"><BadgeCheck size={15} aria-hidden="true" /> Publish</button>
                      ) : null}
                      {canEdit ? (
                        <button type="button" onClick={() => navigate(`/admin/catalog/products/${encodeURIComponent(versionId)}`)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#BDD2C1] bg-white px-3 text-[14px] font-semibold text-[#173F35] hover:bg-[#E9F1E8]"><Pencil size={15} aria-hidden="true" /> Edit</button>
                      ) : null}
                      {canDelete ? (
                        <button type="button" disabled={Boolean(busyId) || mutating} onClick={() => deleteProduct(version)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[#F1C9C7] bg-[#FFF3F1] px-3 text-[14px] font-semibold text-[#AE4242] disabled:opacity-50">
                          {busyId === `product:${key}` ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Trash2 size={15} aria-hidden="true" />} Delete
                        </button>
                      ) : version.publicationStatus === "retired" ? <span className="text-[13px] text-[#778477]">Historical record</span> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="px-5 py-8 text-[15px] text-[#647165]">No {activeLabel.toLowerCase()} records match your search or filters.</p>}

          {visibleCount > recordLimit ? (
            <div className="flex flex-col items-center justify-center gap-2 border-t border-[#DFE5DF] bg-[#F6F8F5] px-4 py-5 sm:px-6">
              <p className="text-center text-[14px] text-[#52685A]">{showAllRecords ? `All ${visibleCount} matching records are shown` : `${visibleCount - displayedCount} more records available`}</p>
              <button type="button" onClick={() => setShowAllRecords((previous) => !previous)} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#173F35] px-5 text-[14px] font-semibold text-white hover:bg-[#275C46]">
                {showAllRecords ? "Show fewer" : `View all ${visibleCount} records`}
                {showAllRecords ? <ChevronDown size={15} className="rotate-180" aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </AdminShell>
  );
}
