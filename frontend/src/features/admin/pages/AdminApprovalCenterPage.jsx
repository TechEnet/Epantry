import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  BookOpen,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  History,
  Package,
  ShieldCheck,
} from "lucide-react";
import AdminShell, {
  AdminEmbeddedShellContext,
} from "../components/AdminShell";
import { useAdmin } from "../context/AdminContext";

// Reuse proven tools and their existing protected APIs. No second approval
// mutation is introduced, and no historical data is copied or rewritten.
const HostPacketReview = lazy(() =>
  import("../../host/pages/AdminUnifiedListingReviewPage")
);
const EvidenceReview = lazy(() =>
  import("../../universalProduct/pages/AdminNpiReviewPage")
);
const CatalogGovernance = lazy(() => import("./AdminCatalogPage"));
const RecipeLibrary = lazy(() => import("./AdminRecipesPage"));
const RecipeReview = lazy(() =>
  import("../../adminGovernance/pages/AdminGovernancePage")
);
const BulkReview = lazy(() =>
  import("../../universalProduct/pages/AdminBulkNpiReviewPage")
);
const ListingHistory = lazy(() =>
  import("../../listingHistory/pages/AdminListingHistoryPage")
);
const AdminAudit = lazy(() => import("./AdminAuditPage"));

const PANELS = [
  {
    id: "review",
    label: "Host approvals",
    hint: "Decide once, activate selling",
    icon: ClipboardCheck,
    permission: "host.review.read",
  },
  {
    id: "evidence",
    label: "Product evidence",
    hint: "Verify labels and claims",
    icon: FileCheck2,
    permission: "catalog.read",
  },
  {
    id: "catalog",
    label: "Catalog management",
    hint: "Versions and retirement",
    icon: Package,
    permission: "catalog.read",
  },
  {
    id: "recipes",
    label: "Recipe governance",
    hint: "Recipes and food checks",
    icon: BookOpen,
    permission: "recipe.read",
  },
  {
    id: "bulk",
    label: "Bulk review",
    hint: "Product evidence batches",
    icon: Boxes,
    permission: "catalog.read",
  },
  {
    id: "audit",
    label: "Audit & history",
    hint: "Decisions and changes",
    icon: History,
    permission: "admin.audit.read",
  },
];

const subButton = (selected) =>
  `min-h-10 border-b-2 px-3 py-2 text-[14px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] ${
    selected
      ? "border-[#C86C42] text-[#173F35]"
      : "border-transparent text-[#57695B] hover:border-[#C3D0C4] hover:text-[#173F35]"
  }`;

function Loading() {
  return (
    <div
      role="status"
      className="min-h-40 animate-pulse bg-[#EBF0E8] px-5 py-8 text-[16px] text-[#173F35]"
    >
      Opening workspace…
    </div>
  );
}

export default function AdminApprovalCenterPage() {
  const [params, setParams] = useSearchParams();
  const { hasAdminPermission, isRootSuperAdmin } = useAdmin();
  const recipeView = params.get("view") === "review" ? "review" : "library";
  const auditView = params.get("view") === "admin" ? "admin" : "listings";
  const setView = (view) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    setParams(next);
  };
  const visiblePanels = useMemo(
    () =>
      PANELS.filter(
        (panel) => isRootSuperAdmin || hasAdminPermission(panel.permission)
      ),
    [isRootSuperAdmin, hasAdminPermission]
  );
  const requestedPanel = params.get("tab") || "review";
  const activePanel =
    visiblePanels.find((panel) => panel.id === requestedPanel) ||
    visiblePanels[0];
  const activeId = activePanel?.id;
  const selectTab = (id) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    // A packet id belongs to the Host decision view, not to other workspaces.
    if (id !== "review") next.delete("focus");
    next.delete("view");
    setParams(next);
  };

  return (
    <AdminShell
      title="Listing approvals & management"
      description="One workspace for approvals, evidence, catalog, recipes, batches and history."
      showWorkspaceBadge={false}
    >
      <main className="min-w-0 bg-[#F7F6F2] text-[#202421]">
        <header className="border-b border-[#D6DED5] pb-4 sm:pb-5">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#5C6F62]">
            <ShieldCheck
              size={17}
              className="text-[#173F35]"
              aria-hidden="true"
            />
            <span>
              Host selling goes live from one final decision in Host approvals.
              Other tools manage supporting catalog records.
            </span>
          </div>
        </header>
        <nav
          aria-label="Listing management areas"
          className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
        >
          {visiblePanels.map((tab, i) => {
            const Icon = tab.icon;
            const selected = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                aria-pressed={selected}
                className={`group min-w-0 rounded-lg border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C86C42] sm:px-3.5 ${
                  selected
                    ? "border-[#173F35] bg-[#173F35] text-white shadow-[0_3px_12px_rgba(23,63,53,.13)]"
                    : "border-[#D5DFD4] bg-[#FFFEFB] text-[#173F35] hover:border-[#C86C42] hover:bg-[#EFF2E9]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex size-8 items-center justify-center rounded-md ${
                      selected
                        ? "bg-white/15 text-white"
                        : "bg-[#DCE0CF] text-[#173F35]"
                    }`}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span
                    className={`text-[12px] font-semibold tabular-nums ${
                      selected ? "text-[#E7EBDD]" : "text-[#B45F3A]"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <span className="mt-2 block text-[15px] font-bold leading-5">
                  {tab.label}
                </span>
                <span
                  className={`mt-1 block text-[13px] leading-[1.35] ${
                    selected ? "text-[#D9E6DB]" : "text-[#667769]"
                  }`}
                >
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </nav>
        {activePanel ? (
          <section
            aria-labelledby="approval-center-current"
            className="mt-5 min-w-0 border-t-2 border-[#C86C42] bg-[#FFFEFB]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEE5DA] px-3 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <BadgeCheck size={19} className="text-[#C86C42]" />
                <h2
                  id="approval-center-current"
                  className="text-[21px] font-semibold text-[#173F35]"
                >
                  {activePanel.label}
                </h2>
              </div>
              {activeId === "recipes" && (
                <div
                  role="group"
                  aria-label="Recipe tasks"
                  className="flex flex-wrap items-center gap-1"
                >
                  <button
                    type="button"
                    className={subButton(recipeView === "library")}
                    aria-pressed={recipeView === "library"}
                    onClick={() => setView("library")}
                  >
                    Recipe library
                  </button>
                  <button
                    type="button"
                    className={subButton(recipeView === "review")}
                    aria-pressed={recipeView === "review"}
                    onClick={() => setView("review")}
                  >
                    Recipe checks
                  </button>
                </div>
              )}
              {activeId === "audit" && (
                <div
                  role="group"
                  aria-label="History views"
                  className="flex flex-wrap items-center gap-1"
                >
                  <button
                    type="button"
                    className={subButton(auditView === "listings")}
                    aria-pressed={auditView === "listings"}
                    onClick={() => setView("listings")}
                  >
                    Listing versions
                  </button>
                  <button
                    type="button"
                    className={subButton(auditView === "admin")}
                    aria-pressed={auditView === "admin"}
                    onClick={() => setView("admin")}
                  >
                    Admin audit
                  </button>
                </div>
              )}
            </div>
            <AdminEmbeddedShellContext.Provider value={true}>
              <Suspense fallback={<Loading />}>
                {activeId === "review" && <HostPacketReview />}
                {activeId === "evidence" && <EvidenceReview />}
                {activeId === "catalog" && <CatalogGovernance productOnly />}
                {activeId === "recipes" &&
                  (recipeView === "library" ? (
                    <RecipeLibrary />
                  ) : (
                    <RecipeReview section="recipeReview" />
                  ))}
                {activeId === "bulk" && <BulkReview />}
                {activeId === "audit" &&
                  (auditView === "listings" ? (
                    <ListingHistory />
                  ) : (
                    <AdminAudit />
                  ))}
              </Suspense>
            </AdminEmbeddedShellContext.Provider>
          </section>
        ) : (
          <div
            role="alert"
            className="mt-5 border border-[#D9E1D9] bg-white p-5 text-[#173F35]"
          >
            Your Admin role cannot access these workspaces.
          </div>
        )}
      </main>
    </AdminShell>
  );
}
