import { lazy, Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  Boxes,
  ClipboardCheck,
  FileCheck2,
  History,
  Package,
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
    icon: ClipboardCheck,
    permission: "host.review.read",
  },
  {
    id: "evidence",
    label: "Product evidence",
    icon: FileCheck2,
    permission: "catalog.read",
  },
  {
    id: "catalog",
    label: "Catalog management",
    icon: Package,
    permission: "catalog.read",
  },
  {
    id: "recipes",
    label: "Recipe governance",
    icon: BookOpen,
    permission: "recipe.read",
  },
  {
    id: "bulk",
    label: "Bulk review",
    icon: Boxes,
    permission: "catalog.read",
  },
  {
    id: "audit",
    label: "Audit & history",
    icon: History,
    permission: "admin.audit.read",
  },
];

const subButton = (selected) =>
  `min-h-11 border-b-[3px] px-3 py-2 text-[15px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] ${
    selected
      ? "border-[#173F35] text-[#173F35]"
      : "border-transparent text-[#526457] hover:border-[#B8C9B9] hover:text-[#173F35]"
  }`;

function Loading() {
  return (
    <div
      role="status"
      className="min-h-28 animate-pulse bg-[#E7EEE8] px-5 py-7 text-[16px] text-[#173F35]"
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
      description="Manage Host approvals, product evidence and catalog records."
      showWorkspaceBadge={false}
    >
      <main className={`listing-approvals-mobile-root ${activeId === "recipes" && recipeView === "library" ? "listing-recipes-active" : ""} min-w-0 bg-[#F7F6F2] pb-5 text-[#202421]`}>
        <style>{`
          @media (max-width: 639px) {
            /* Recipe governance ONLY: remove nested mobile headings and use the screen width. */
            .page-shell:has(.listing-recipes-active) .epantry-workspace-canvas > header {
              padding: 8px 12px !important;
            }
            .page-shell:has(.listing-recipes-active) .epantry-workspace-canvas > header > div.grid {
              display: none !important;
            }
            .listing-recipes-active [aria-label="Recipe governance workspace"] > div:first-child {
              padding: 0 !important;
              background: #FFFFFF !important;
              border-bottom: 1px solid #D8E1D8 !important;
            }
            .listing-recipes-active [aria-label="Recipe governance workspace"] > div:first-child > p {
              display: none !important;
            }
            .listing-recipes-active [aria-label="Recipe governance workspace"] > div:first-child [role="group"] {
              width: 100%;
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0 !important;
            }
            .listing-recipes-active [aria-label="Recipe governance workspace"] > div:first-child [role="group"] button {
              min-width: 0;
              min-height: 48px;
              text-align: center;
              font-size: 15px;
              padding: 10px 8px;
            }
            .listing-recipes-active [aria-label="Recipe Review & Creation"] > div:first-child {
              display: none !important;
            }
            .listing-recipes-active [aria-label="Recipe Review & Creation"] > div:last-child {
              padding: 0 !important;
            }
            .listing-recipes-active section[aria-label="Listing management work areas"] > div:nth-child(2) {
              padding: 9px 12px !important;
            }
            .listing-recipes-active section[aria-label="Listing management work areas"] label > span,
            .listing-recipes-active section[aria-label="Listing management work areas"] label + span {
              display: none !important;
            }
            .listing-recipes-active select[aria-label="Choose listing review workspace"] {
              height: 46px;
            }
            .listing-recipes-active select[aria-label="Choose listing review workspace"] + svg {
              bottom: 12px;
            }

            .page-shell:has(.listing-approvals-mobile-root) {
              box-sizing: border-box !important;
              width: 100% !important;
              max-width: none !important;
              margin-inline: 0 !important;
              padding: 0 !important;
            }
            .page-shell:has(.listing-approvals-mobile-root) > div {
              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .page-shell:has(.listing-approvals-mobile-root) .epantry-workspace-canvas > div:last-child {
              padding: 0 !important;
            }
            .listing-approvals-mobile-root [aria-label="Product Intelligence Review"] > div:last-child {
              padding: 0 !important;
            }
            .listing-approvals-mobile-root [aria-label="Product Intelligence Review"] > div:first-child {
              padding: 14px 16px !important;
            }
            .page-shell:has(.listing-approvals-mobile-root) .epantry-workspace-canvas > header h1 {
              font-size: 25px !important;
              line-height: 1.18 !important;
              letter-spacing: -0.035em !important;
            }
            .page-shell:has(.listing-approvals-mobile-root) .epantry-workspace-canvas > header p {
              font-size: 13px !important;
              line-height: 1.5 !important;
            }
            .listing-approvals-mobile-root, .listing-approvals-mobile-root > section {
              width: 100%;
              max-width: 100%;
              min-width: 0;
            }
          }
        `}</style>
        <section aria-label="Listing management work areas" className="min-w-0">
          <div className="hidden flex-wrap items-end justify-between gap-3 border-b border-[#DAE1D8] bg-[#E8EEE6] px-4 py-3 sm:flex sm:px-6 sm:py-5">
            <div>
              <p className="hidden text-[12px] font-bold uppercase tracking-[0.065em] text-[#66816D] sm:block">Listing workspace</p>
              <h2 className="text-[19px] font-bold leading-tight tracking-[-0.025em] text-[#173F35] sm:mt-1 sm:text-[27px]"><span className="sm:hidden">Review workspaces</span><span className="hidden sm:inline">What needs reviewing?</span></h2>
            </div>
            <div className="hidden rounded-full border border-[#C2D2C4] bg-white px-3 py-2 text-[13px] font-semibold text-[#496B52] sm:block">{visiblePanels.length} work areas</div>
          </div>
          <div className="flex min-w-0 items-center gap-3 border-b border-[#D8E1D8] bg-[#E7EDE6] px-3 py-3 sm:hidden">
            <label className="relative min-w-0 flex-1">
              <span className="mb-1 block text-[12px] font-bold uppercase tracking-[0.045em] text-[#476557]">Review workspace</span>
              <select
                aria-label="Choose listing review workspace"
                value={activeId || ""}
                onChange={(event) => selectTab(event.target.value)}
                className="focus-ring h-12 w-full appearance-none rounded-lg border border-[#BFCFC2] bg-white py-2 pl-3 pr-10 text-[16px] font-bold text-[#173F35]"
              >
                {visiblePanels.map((panel) => (
                  <option key={panel.id} value={panel.id}>{panel.label}</option>
                ))}
              </select>
              <ChevronDown size={19} aria-hidden="true" className="pointer-events-none absolute bottom-[14px] right-3 text-[#315745]" />
            </label>
            <span className="mt-4 shrink-0 rounded-md bg-[#D5E1D5] px-2.5 py-2 text-[13px] font-semibold tabular-nums text-[#315745]">
              {visiblePanels.findIndex((panel) => panel.id === activeId) + 1} / {visiblePanels.length}
            </span>
          </div>
          <nav aria-label="Listing management areas" className="hidden min-w-0 gap-px bg-[#D8E1D8] sm:grid sm:grid-cols-3 xl:grid-cols-6">
            {visiblePanels.map((tab, i) => {
              const Icon = tab.icon;
              const selected = tab.id === activeId;
              return (
                <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} aria-pressed={selected} className={`group flex min-h-[64px] w-[158px] shrink-0 snap-start items-center gap-2 border-b-[3px] px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#173F35] sm:min-h-[88px] sm:w-auto sm:min-w-0 sm:gap-3 sm:px-4 ${selected ? "border-[#B56845] bg-[#173F35] text-white" : "border-transparent bg-[#FCFBF9] text-[#173F35] hover:bg-[#EFF3ED]"}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 ${selected ? "bg-white/15 text-white" : "bg-[#E5EEE6] text-[#3A654A]"}`}><Icon size={19} aria-hidden="true" /></span>
                  <span className="min-w-0"><span className={`block text-[12px] font-bold ${selected ? "text-[#D0E4D5]" : "text-[#839387]"}`}>{String(i + 1).padStart(2, "0")}</span><span className="mt-0.5 block text-[15px] font-bold leading-5 sm:text-[16px]">{tab.label}</span></span>
                </button>
              );
            })}
          </nav>
        </section>

        {activePanel ? (
          <section aria-label={`${activePanel.label} workspace`} className="mt-0 min-w-0 sm:mt-4">
            {activeId !== "evidence" && activeId !== "catalog" && activeId !== "bulk" ? (
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#D2DED3] px-4 sm:px-6 ${activeId === "recipes" ? "bg-[#FCFBF8] py-3" : "bg-[#ECF2EB] py-4"}`}>
                {activeId !== "recipes" ? <h2 className="text-[23px] font-bold leading-tight text-[#173F35]">{activePanel.label}</h2> : <p className="text-[14px] font-semibold text-[#476557]">Choose a recipe task</p>}
                {activeId === "recipes" ? <div role="group" aria-label="Recipe tasks" className="flex flex-wrap gap-2"><button type="button" className={subButton(recipeView === "library")} aria-pressed={recipeView === "library"} onClick={() => setView("library")}>Recipe library</button><button type="button" className={subButton(recipeView === "review")} aria-pressed={recipeView === "review"} onClick={() => setView("review")}>Recipe checks</button></div> : null}
                {activeId === "audit" ? <div role="group" aria-label="History views" className="flex flex-wrap gap-2"><button type="button" className={subButton(auditView === "listings")} aria-pressed={auditView === "listings"} onClick={() => setView("listings")}>Listing versions</button><button type="button" className={subButton(auditView === "admin")} aria-pressed={auditView === "admin"} onClick={() => setView("admin")}>Admin audit</button></div> : null}
              </div>
            ) : null}
            <div className="min-w-0 bg-[#FCFBF8]">
              <AdminEmbeddedShellContext.Provider value={true}>
                <Suspense fallback={<Loading />}>
                  {activeId === "review" && <HostPacketReview />}
                  {activeId === "evidence" && <EvidenceReview />}
                  {activeId === "catalog" && <CatalogGovernance productOnly />}
                  {activeId === "recipes" && (recipeView === "library" ? <RecipeLibrary /> : <RecipeReview section="recipeReview" />)}
                  {activeId === "bulk" && <BulkReview />}
                  {activeId === "audit" && (auditView === "listings" ? <ListingHistory /> : <AdminAudit />)}
                </Suspense>
              </AdminEmbeddedShellContext.Provider>
            </div>
          </section>
        ) : <div role="alert" className="mt-5 border border-[#D9E1D9] bg-white p-5 text-[16px] text-[#173F35]">Your Admin role cannot access these workspaces.</div>}
      </main>
    </AdminShell>
  );
}
