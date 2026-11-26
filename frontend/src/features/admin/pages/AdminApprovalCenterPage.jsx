import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { apiClient } from "../../../api/apiClient";

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

// Excel/ZIP Host Listing Studio records are stored in HostUnifiedListingPacket.
// Drafts and submitted listings live in this same table. The legacy Product
// Evidence (NPI) bulk queue is a different backend collection and remains a
// separate read-only choice below. Never turn an imported draft into approval.
const BULK_LABELS = {
  draft: 'Saved draft',
  submitted_for_review: 'Awaiting approval',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
};
const BULK_FILTERS = [
  ['all', 'All batches'],
  ['draft', 'Saved drafts'],
  ['submitted_for_review', 'Awaiting review'],
  ['approved', 'Approved'],
  ['changes_requested', 'Needs changes'],
  ['rejected', 'Rejected'],
];
const formatBulkDate = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  return Number.isFinite(parsed.valueOf()) ? parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};
const batchSummary = (items) => ({
  draft: items.filter((row) => row.status === 'draft').length,
  submitted: items.filter((row) => row.status === 'submitted_for_review').length,
  approved: items.filter((row) => row.status === 'approved').length,
  changes: items.filter((row) => row.status === 'changes_requested').length,
  rejected: items.filter((row) => row.status === 'rejected').length,
});
const listingPhoto = (item) => {
  const images = item?.packet?.images;
  const first = Array.isArray(images) ? images[0] : null;
  const value = typeof first === 'string' ? first : (first?.url || first?.imageUrl || '');
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';
};

function HostBulkSubmissionsPanel() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hasMore: false, validMode: false });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshNumber, setRefreshNumber] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // Unlike the ordinary approval queue, this secured mode includes drafts.
      // The backend returns the mode marker so an old/stale API cannot silently
      // masquerade as an empty database after only a frontend deploy.
      const result = await apiClient.get('/admin/host-listing-packets', {
        params: { bulkOnly: '1', includeDrafts: '1' },
      });
      const data = result?.data?.data ?? result?.data ?? {};
      if (data?.mode !== 'bulk_overview' || !Array.isArray(data?.listings)) {
        throw new Error('Backend Bulk Overview mode is not active. Replace backend hostUnifiedListing.routes.js and restart the backend; existing Admin approval API intentionally hides drafts.');
      }
      setRows(data.listings);
      setMeta({
        total: Number(data.total) || 0,
        hasMore: data.hasMore === true,
        validMode: true,
      });
    } catch (cause) {
      setRows([]);
      setMeta({ total: 0, hasMore: false, validMode: false });
      setError(cause?.response?.data?.message || cause?.message || 'Cannot read Host imported batches. Check backend connectivity and Super Admin permissions.');
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { load(); }, [load, refreshNumber]);

  const batches = useMemo(() => {
    const grouped = new Map();
    for (const item of rows) {
      if (!item?.bulkBatchId || !item.id) continue;
      if (!grouped.has(item.bulkBatchId)) {
        grouped.set(item.bulkBatchId, { id: item.bulkBatchId, items: [], newest: 0 });
      }
      const group = grouped.get(item.bulkBatchId);
      group.items.push(item);
      group.newest = Math.max(group.newest, new Date(item.updatedAt || item.submittedAt || 0).valueOf() || 0);
    }
    return [...grouped.values()]
      .map((group) => ({ ...group, counts: batchSummary(group.items) }))
      .sort((a, b) => b.newest - a.newest);
  }, [rows]);

  const totalCounts = useMemo(() => batchSummary(rows), [rows]);
  const visibleBatches = useMemo(() => batches.filter((batch) =>
    filter === 'all' || batch.items.some((row) => row.status === filter)
  ), [batches, filter]);
  const active = visibleBatches.find((batch) => batch.id === selectedBatchId) || visibleBatches[0];
  const filteredItems = (active?.items || []).filter((item) => filter === 'all' || item.status === filter);

  return (
    <section aria-label="Host imported bulk listings" className="min-w-0 bg-[#F7F6F2] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D7DDCF] pb-5">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[.08em] text-[#C56C42]">Host listing studio / saved records</p>
          <h2 className="mt-1 text-[29px] font-bold leading-tight tracking-[-.035em] text-[#173F35] sm:text-[34px]">Imported Host batches</h2>
          <p className="mt-1 max-w-3xl text-[15px] leading-6 text-[#637066]">
            See both imported drafts and submitted listings from the actual Host database. Only submitted listings can be approved.
          </p>
        </div>
        <button type="button" onClick={() => setRefreshNumber((n) => n + 1)} disabled={busy}
          className="min-h-11 shrink-0 rounded-lg border border-[#D0D8CB] bg-white px-4 py-2.5 text-[14px] font-bold text-[#173F35] hover:border-[#C56C42] disabled:opacity-50">
          {busy ? 'Loading records…' : 'Refresh from backend'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 border-l-4 border-[#B74138] bg-[#FFF0ED] px-4 py-3 text-[15px] leading-6 text-[#8F3029]">{error}</p>
      )}
      {busy && <p role="status" className="py-8 text-[15px] text-[#5B6C61]">Loading Host listings from EPANTRY…</p>}
      {meta.validMode && !busy && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-[#D7DDCF] py-5 sm:grid-cols-4">
            <div><strong className="block text-[30px] leading-none text-[#173F35]">{batches.length}</strong><span className="mt-1 block text-[13px] text-[#627164]">Imported server batches</span></div>
            <div><strong className="block text-[30px] leading-none text-[#C56C42]">{totalCounts.draft}</strong><span className="mt-1 block text-[13px] text-[#627164]">Saved drafts</span></div>
            <div><strong className="block text-[30px] leading-none text-[#173F35]">{totalCounts.submitted}</strong><span className="mt-1 block text-[13px] text-[#627164]">Awaiting Super Admin</span></div>
            <div><strong className="block text-[30px] leading-none text-[#246041]">{totalCounts.approved}</strong><span className="mt-1 block text-[13px] text-[#627164]">Approved listings</span></div>
          </div>
          {meta.hasMore && <p role="status" className="mt-3 border-l-4 border-[#C56C42] bg-[#FBEEE6] px-4 py-3 text-[14px] text-[#6E4E3E]">
            Showing the newest {rows.length} of {meta.total} imported records. Older batches are outside this API window; do not interpret these counters as all-time totals.
          </p>}
          {totalCounts.draft > 0 && <p className="mt-4 border-l-4 border-[#C56C42] bg-[#FBEEE6] px-4 py-3 text-[14px] leading-6 text-[#5E5146]">
            <strong className="text-[#173F35]">{totalCounts.draft} imported draft{totalCounts.draft === 1 ? '' : 's'} exist.</strong>
            {' '}They have not yet entered the approval queue. Sign in as that Host, open Bulk Listing, and use <strong>Submit to Super Admin</strong>. These drafts are read-only for Admin.
          </p>}
          <nav aria-label="Filter imported Host records" className="mt-5 flex flex-wrap gap-2 border-b border-[#DEE4DA] pb-4">
            {BULK_FILTERS.map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setSelectedBatchId(''); }}
              className={`min-h-10 rounded-lg border px-3.5 py-2 text-[14px] font-semibold transition ${filter === value ? 'border-[#C56C42] bg-[#C56C42] text-white' : 'border-[#D7DDCF] bg-white text-[#173F35] hover:bg-[#EDF2E9]'}`}>{label}</button>)}
          </nav>
          {visibleBatches.length ? (
            <div className="mt-5 grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(225px,290px)_minmax(0,1fr)]">
              <div className="min-w-0 border-y border-[#DDE3D9]">
                {visibleBatches.map((batch) => <button key={batch.id} type="button" aria-pressed={active?.id === batch.id} onClick={() => setSelectedBatchId(batch.id)}
                  className={`flex w-full min-w-0 items-start justify-between gap-3 border-b border-[#E0E6DC] px-3 py-4 text-left transition hover:bg-[#EDEFE7] ${active?.id === batch.id ? 'border-l-[4px] border-l-[#C56C42] bg-[#F4E9DF]' : 'border-l-[4px] border-l-transparent'}`}>
                  <span className="min-w-0">
                    <strong className="block text-[15px] text-[#173F35]">Imported batch</strong>
                    <span className="mt-1 block text-[12px] text-[#67746B]">{formatBulkDate(batch.newest)} · {batch.items.length} items</span>
                    <span className="mt-1 block text-[12px] text-[#6A766D]">{batch.counts.draft} drafts · {batch.counts.submitted} in review</span>
                  </span>
                  <span className="rounded-full bg-[#D7DDCF] px-2 py-1 text-[12px] font-bold text-[#173F35]">{batch.items.length}</span>
                </button>)}
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[20px] font-bold text-[#173F35]">Listings in this batch</h3>
                  <span className="text-[13px] text-[#647367]">{filteredItems.length} displayed</span>
                </div>
                <div className="divide-y divide-[#DCE4DA] border-y border-[#DCE4DA]">
                  {filteredItems.map((item) => {
                    const photo = listingPhoto(item);
                    return <div key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3 sm:flex-nowrap">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-[#D7DDCF]">
                          {photo ? <img src={photo} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[12px] text-[#173F35]">No photo</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words text-[15px] font-bold text-[#202421]">{item.title || 'Untitled listing'}</p>
                          <p className="mt-1 text-[13px] text-[#68766B]">{String(item.type || 'Listing').replaceAll('_', ' ')} · {BULK_LABELS[item.status] || item.status}</p>
                        </div>
                      </div>
                      {item.status === 'submitted_for_review' ? <Link
                        to={`/admin/host-listings?tab=review&focus=${encodeURIComponent(item.id)}`}
                        className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-[#173F35] px-3.5 text-[13px] font-bold text-white hover:bg-[#245643]">Open review</Link>
                        : <span className="shrink-0 rounded-lg border border-[#D7DDCF] bg-[#F7F6F2] px-3 py-2 text-[13px] font-semibold text-[#52655A]">{item.status === 'draft' ? 'Waiting for Host' : BULK_LABELS[item.status] || 'Not pending'}</span>}
                    </div>;
                  })}
                </div>
              </div>
            </div>
          ) : <p className="mt-6 border-y border-[#D7DDCF] py-6 text-[15px] leading-6 text-[#5C6C60]">
            {batches.length ? 'No imported batches match this status filter.' : 'No saved Excel/ZIP Host batches were found in the database. If import preview succeeded but this remains empty, verify that Save Drafts completed successfully in the Host Studio. Preview alone does not create database records.'}
          </p>}
          <p className="mt-4 text-[13px] leading-5 text-[#728073]">One Excel upload of up to 100 listings can be stored as four backend batches of 25. The Product Evidence batch queue is separate and will not contain these Host records.</p>
        </>
      )}
    </section>
  );
}

function CombinedBulkWorkspace() {
  const [source, setSource] = useState('host');
  return <div className="min-w-0">
    <div role="group" aria-label="Choose bulk submission source" className="flex flex-wrap gap-2 border-b border-[#D7DDCF] bg-[#F7F6F2] px-4 py-3 sm:px-6">
      <button type="button" aria-pressed={source === 'host'} onClick={() => setSource('host')}
        className={`min-h-11 rounded-lg px-4 py-2 text-[15px] font-bold transition ${source === 'host' ? 'bg-[#C56C42] text-white' : 'border border-[#D7DDCF] bg-white text-[#173F35]'}`}>Host listing batches</button>
      <button type="button" aria-pressed={source === 'npi'} onClick={() => setSource('npi')}
        className={`min-h-11 rounded-lg px-4 py-2 text-[15px] font-bold transition ${source === 'npi' ? 'bg-[#C56C42] text-white' : 'border border-[#D7DDCF] bg-white text-[#173F35]'}`}>Product evidence batches</button>
    </div>
    {source === 'host' ? <HostBulkSubmissionsPanel /> : <BulkReview />}
  </div>;
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
                {activeId === "recipes" ? <p className="text-[14px] font-semibold text-[#476557]">Choose a recipe task</p> : activeId === "audit" && auditView === "listings" ? null : <h2 className="text-[23px] font-bold leading-tight text-[#173F35]">{activePanel.label}</h2>}
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
                  {activeId === "bulk" && (isRootSuperAdmin ? <CombinedBulkWorkspace /> : <BulkReview />)}
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
