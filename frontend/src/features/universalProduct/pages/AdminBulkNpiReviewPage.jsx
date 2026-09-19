import {
  BadgeCheck,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Download,
  FileSearch,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Search as SearchIcon,
  ShieldAlert,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdminShell from "../../admin/components/AdminShell";

import { useAdmin } from "../../admin/context/AdminContext";

import {
  getAdminNpiBulkBatch,
  getAdminNpiDraft,
  getUniversalProductErrorMessage,
  listAdminNpiBulkBatches,
  reviewAdminNpiBulkSelection,
  reviewAdminNpiDraft,
} from "../services/universalProduct.service";

const SAFETY_FIELDS = new Set([
  "ingredientDeclarationText",
  "allergens",
  "nutrition",
  "claims",
  "certifications",
]);

const LISTING_FILTERS = [
  ["", "All product types"],
  ["packaged", "Packaged Food"],
  ["vegetable", "Vegetables"],
  ["fruit", "Fruits"],
];

const BATCH_STATUS_FILTERS = [
  ["", "All batch states"],
  ["submitted", "Submitted"],
  ["needs_attention", "Needs attention"],
  ["in_review", "In review"],
  ["completed", "Completed"],
];

const ROW_FILTERS = [
  ["all", "All"],
  ["review_ready", "Review-ready"],
  ["duplicates", "Potential duplicates"],
  ["needs_evidence", "Needs information"],
  ["approved", "Approved"],
  ["live", "Customer live"],
  ["commerce_action", "Commerce action"],
  ["rejected", "Rejected"],
];

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function candidateValue(draft, fieldPath) {
  return draft?.candidateFields?.[fieldPath]?.value ?? null;
}

function candidateTitle(draft) {
  return String(
    candidateValue(draft, "displayName") || draft?.barcode || "Provisional product"
  );
}

function moneyFromMinor(value, currency = "INR") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const minor = Number(value);

  if (!Number.isFinite(minor)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function statusClasses(status) {
  switch (status) {
    case "approved_for_catalog":
      return "bg-emerald-100 text-emerald-800";
    case "ready_for_review":
      return "bg-blue-100 text-blue-800";
    case "needs_more_evidence":
      return "bg-amber-100 text-amber-800";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

function batchStatusClasses(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "in_review":
      return "bg-blue-100 text-blue-800";
    case "needs_attention":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-violet-100 text-violet-800";
  }
}

function commerceStatusClasses(status) {
  switch (status) {
    case "live":
      return "bg-emerald-100 text-emerald-800";
    case "prepared":
      return "bg-blue-100 text-blue-800";
    case "action_required":
      return "bg-amber-100 text-amber-800";
    case "processing":
      return "bg-violet-100 text-violet-800";
    case "skipped":
      return "bg-stone-100 text-stone-600";
    default:
      return "bg-sky-100 text-sky-800";
  }
}

function printable(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadBatchReport(batch, drafts) {
  const rows = [
    [
      "rowNumber",
      "merchantSku",
      "productName",
      "listingType",
      "status",
      "potentialDuplicate",
      "bulkReviewEligible",
      "blockers",
      "listPrice",
      "salePrice",
      "availableQuantity",
      "inventoryNode",
      "serviceArea",
      "commerceStatus",
      "commerceError",
      "marketplaceOfferId",
    ],
    ...drafts.map((draft) => {
      const commercial = draft.commercialDraft || {};

      return [
        draft.bulkRowNumber || "",
        draft.merchantSku || "",
        candidateTitle(draft),
        draft.listingType || "",
        draft.status || "",
        draft.duplicateCandidateProductVersionId ? "yes" : "no",
        draft.bulkReviewEligible ? "yes" : "no",
        (draft.bulkReviewBlockers || []).join("; "),
        moneyFromMinor(commercial.listPriceMinor, commercial.currency),
        commercial.salePriceMinor
          ? moneyFromMinor(commercial.salePriceMinor, commercial.currency)
          : "",
        commercial.availableQuantity ?? "",
        commercial.inventoryNodeName || "",
        commercial.serviceAreaName || "",
        draft.commercializationStatus || "",
        draft.commercializationError || "",
        draft.marketplaceOfferId || "",
      ];
    }),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `epantry-bulk-npi-review-${batch?.id || "batch"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminBulkNpiReviewPage() {
  const { hasAdminPermission } = useAdmin();

  const canCatalogMutate = hasAdminPermission("catalog.mutate");
  const canTrustSafetyMutate = hasAdminPermission("trust_safety.mutate");

  const [batches, setBatches] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [listingType, setListingType] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [batchDetail, setBatchDetail] = useState(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [rowFilter, setRowFilter] = useState("all");
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");

  const [selectedDraft, setSelectedDraft] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [fieldStates, setFieldStates] = useState({});
  const [singleReason, setSingleReason] = useState("");
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [singleNotice, setSingleNotice] = useState("");

  const loadBatches = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await listAdminNpiBulkBatches({
          page: 1,
          limit: 50,
          listingType: listingType || undefined,
          search: search || undefined,
        });

        const nextBatches = result?.batches || [];

        setBatches(nextBatches);
        setSummary(result?.summary || {});
        setPagination(result?.pagination || null);

        if (
          selectedBatchId &&
          !nextBatches.some((item) => item.id === selectedBatchId)
        ) {
          setSelectedBatchId("");
          setBatchDetail(null);
        }
      } catch (requestError) {
        setError(
          getUniversalProductErrorMessage(
            requestError,
            "Unable to load Bulk NPI review batches."
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [listingType, search, selectedBatchId]
  );

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function openBatch(batchId) {
    setSelectedBatchId(batchId);
    setLoadingBatch(true);
    setError("");
    setBulkNotice("");
    setSelectedDraftIds([]);
    setSelectedDraft(null);

    try {
      const result = await getAdminNpiBulkBatch(batchId);
      setBatchDetail(result);
    } catch (requestError) {
      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to load this Bulk NPI batch."
        )
      );
    } finally {
      setLoadingBatch(false);
    }
  }

  async function refreshSelectedBatch() {
    if (!selectedBatchId) {
      return;
    }

    const result = await getAdminNpiBulkBatch(selectedBatchId);
    setBatchDetail(result);
  }

  const visibleBatches = useMemo(
    () =>
      batchStatus
        ? batches.filter((batch) => batch.status === batchStatus)
        : batches,
    [batchStatus, batches]
  );

  const filteredDrafts = useMemo(() => {
    const drafts = batchDetail?.drafts || [];

    return drafts.filter((draft) => {
      if (rowFilter === "review_ready") {
        return draft.status === "ready_for_review";
      }

      if (rowFilter === "duplicates") {
        return Boolean(draft.duplicateCandidateProductVersionId);
      }

      if (rowFilter === "needs_evidence") {
        return draft.status === "needs_more_evidence";
      }

      if (rowFilter === "approved") {
        return draft.status === "approved_for_catalog";
      }

      if (rowFilter === "live") {
        return draft.commercializationStatus === "live";
      }

      if (rowFilter === "commerce_action") {
        return draft.commercializationStatus === "action_required";
      }

      if (rowFilter === "rejected") {
        return draft.status === "rejected";
      }

      return true;
    });
  }, [batchDetail, rowFilter]);

  function toggleDraftSelection(draftId) {
    setSelectedDraftIds((current) =>
      current.includes(draftId)
        ? current.filter((item) => item !== draftId)
        : [...current, draftId]
    );
  }

  function selectCleanRows() {
    setSelectedDraftIds(
      (batchDetail?.drafts || [])
        .filter((draft) => draft.bulkReviewEligible)
        .map((draft) => draft.id)
    );
  }

  async function submitBulkDecision(decision) {
    if (!selectedBatchId || !selectedDraftIds.length || bulkSubmitting) {
      return;
    }

    if (!bulkReason.trim()) {
      setBulkNotice("Add a review reason before applying a bulk decision.");
      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setBulkNotice("catalog.mutate permission is required for bulk approval.");
      return;
    }

    setBulkSubmitting(true);
    setBulkNotice("");

    try {
      const chunks = [];

      for (let index = 0; index < selectedDraftIds.length; index += 25) {
        chunks.push(selectedDraftIds.slice(index, index + 25));
      }

      let latestResult = null;
      let processed = 0;
      let skipped = 0;
      let live = 0;
      let commerceActionRequired = 0;
      let prepared = 0;

      for (const draftIds of chunks) {
        const result = await reviewAdminNpiBulkSelection({
          batchId: selectedBatchId,
          draftIds,
          decision,
          reason: bulkReason.trim(),
        });

        latestResult = result;
        processed += result?.processed?.length || 0;
        skipped += result?.skipped?.length || 0;
        live += (result?.processed || []).filter(
          (item) => item.commercializationStatus === "live"
        ).length;
        commerceActionRequired += (result?.processed || []).filter(
          (item) => item.commercializationStatus === "action_required"
        ).length;
        prepared += (result?.processed || []).filter(
          (item) => item.commercializationStatus === "prepared"
        ).length;
      }

      setBatchDetail((current) => ({
        ...(current || {}),
        batch: latestResult?.batch || current?.batch,
        drafts: latestResult?.drafts || current?.drafts || [],
      }));

      setBulkNotice(
        decision === "approve_for_catalog"
          ? `${processed} product${processed === 1 ? "" : "s"} approved · ${live} customer-live${
              prepared ? ` · ${prepared} prepared` : ""
            }${
              commerceActionRequired ? ` · ${commerceActionRequired} need commerce action` : ""
            }${
              skipped ? ` · ${skipped} skipped because they require individual attention` : ""
            }.`
          : `${processed} product${processed === 1 ? "" : "s"} updated${
              skipped ? ` · ${skipped} skipped because they require individual attention` : ""
            }.`
      );
      setSelectedDraftIds([]);
      await loadBatches(true);
    } catch (requestError) {
      setBulkNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to apply this bulk review decision."
        )
      );
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function openDraft(draftId) {
    setLoadingDraft(true);
    setSingleNotice("");

    try {
      const result = await getAdminNpiDraft(draftId);
      setSelectedDraft(result);
      setFieldStates(
        Object.fromEntries(
          Object.entries(result?.draft?.candidateFields || {}).map(
            ([key, value]) => [key, value?.reviewState || "pending_review"]
          )
        )
      );
      setSingleReason("");
    } catch (requestError) {
      setSingleNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to open this product review."
        )
      );
    } finally {
      setLoadingDraft(false);
    }
  }

  function allowedFieldForMutation(fieldPath) {
    if (canCatalogMutate) {
      return true;
    }

    return canTrustSafetyMutate && SAFETY_FIELDS.has(fieldPath);
  }

  function buildFieldDecisions() {
    return Object.entries(fieldStates)
      .filter(([fieldPath]) => allowedFieldForMutation(fieldPath))
      .map(([fieldPath, decision]) => ({
        fieldPath,
        decision,
        note: "",
      }));
  }

  function acceptAllVisibleFields() {
    setFieldStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([fieldPath, value]) => [
          fieldPath,
          allowedFieldForMutation(fieldPath) ? "accepted" : value,
        ])
      )
    );
  }

  async function submitSingleDecision(decision) {
    const draftId = selectedDraft?.draft?.id;

    if (!draftId || singleSubmitting) {
      return;
    }

    if (!singleReason.trim()) {
      setSingleNotice("Add a review reason before recording the decision.");
      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setSingleNotice("catalog.mutate permission is required for approval.");
      return;
    }

    setSingleSubmitting(true);
    setSingleNotice("");

    try {
      const result = await reviewAdminNpiDraft({
        draftId,
        decision,
        fieldDecisions: buildFieldDecisions(),
        reason: singleReason.trim(),
      });

      setSelectedDraft((current) => ({
        ...(current || {}),
        draft: result?.draft || current?.draft,
      }));

      setSingleNotice(
        decision === "approve_for_catalog"
          ? result?.commercialization?.status === "live"
            ? "Product approved, published and customer-live with the Host workbook price and availability."
            : result?.commercialization?.status === "action_required"
            ? `Product approved, but commerce needs attention: ${result.commercialization.message}`
            : result?.commercialization?.status === "prepared"
            ? "Product approved and commercially prepared. Automatic customer activation is disabled for this row."
            : "Product approved for governed catalog handoff."
          : decision === "request_more_evidence"
          ? "Product returned for more information."
          : "Product rejected."
      );

      await Promise.all([refreshSelectedBatch(), loadBatches(true)]);
    } catch (requestError) {
      setSingleNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to record this product review decision."
        )
      );
    } finally {
      setSingleSubmitting(false);
    }
  }

  const detailDraft = selectedDraft?.draft;
  const reviewableFields = Object.entries(detailDraft?.candidateFields || {});
  const commercial = detailDraft?.commercialDraft || {};

  return (
    <AdminShell
      title="Bulk Product Review"
      description="Review Host warehouse-scale NPI batches in a web dashboard. Excel is the Host input format; Super Admin reviews normalized products, evidence, duplicates and commercial drafts here."
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadBatches(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <section className="overflow-hidden rounded-[26px] bg-gradient-to-br from-violet-950 via-violet-900 to-fuchsia-800 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
              Warehouse-scale governance
            </p>
            <h2 className="mt-2 text-2xl font-black">Bulk NPI batches</h2>
            <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-violet-100/80">
              Review normalized product rows without opening the Host workbook. Potential duplicates and evidence problems stay visible and can be opened individually before any decision.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [summary.submitted || 0, "Submitted"],
              [summary.reviewReady || 0, "Review-ready"],
              [summary.issues || 0, "Issues"],
              [summary.potentialDuplicates || 0, "Duplicates"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
                <p className="text-xl font-black">{value}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-violet-100/75">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className="rounded-full bg-emerald-300/20 px-3 py-1.5 text-[10px] font-black text-emerald-100">
              {summary.live || 0} customer-live
            </span>
            <span className="rounded-full bg-amber-300/20 px-3 py-1.5 text-[10px] font-black text-amber-100">
              {summary.commerceActionRequired || 0} commerce action required
            </span>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_190px_150px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
          className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-2"
        >
          <SearchIcon size={17} className="ml-2 text-sky-700" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search Host organization or source workbook..."
            className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-slate-800 outline-none"
          />
          <button className="rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-800">
            Search
          </button>
        </form>

        <select
          value={listingType}
          onChange={(event) => setListingType(event.target.value)}
          className="h-[58px] rounded-2xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-900 outline-none"
        >
          {LISTING_FILTERS.map(([value, label]) => (
            <option key={value || "all"} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={batchStatus}
          onChange={(event) => setBatchStatus(event.target.value)}
          className="h-[58px] rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-900 outline-none"
        >
          {BATCH_STATUS_FILTERS.map(([value, label]) => (
            <option key={value || "all"} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div className="grid place-items-center rounded-2xl border border-stone-200 bg-white px-4 text-center">
          <p className="text-xs font-black text-stone-700">
            {pagination?.total ?? batches.length} batches
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-stone-950 p-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-300">
              Review batches
            </p>
            <p className="mt-1 text-sm font-black">Select a Host submission</p>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <LoaderCircle size={28} className="animate-spin text-violet-700" />
            </div>
          ) : visibleBatches.length ? (
            <div className="max-h-[760px] overflow-y-auto p-3">
              {visibleBatches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => openBatch(batch.id)}
                  className={[
                    "focus-ring mb-2 block w-full rounded-2xl border p-4 text-left transition last:mb-0",
                    selectedBatchId === batch.id
                      ? "border-violet-300 bg-violet-50"
                      : "border-stone-200 hover:border-violet-200 hover:bg-stone-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-stone-900">
                        {batch.organization?.displayName || "Host organization"}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-stone-500">
                        {batch.sourceFileName || "Bulk workbook"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${batchStatusClasses(batch.status)}`}>
                      {labelize(batch.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-blue-50 p-2">
                      <p className="text-sm font-black text-blue-800">{batch.review?.reviewReady || 0}</p>
                      <p className="text-[8px] font-black uppercase text-blue-600">Ready</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-2">
                      <p className="text-sm font-black text-amber-800">{batch.review?.validationIssues || 0}</p>
                      <p className="text-[8px] font-black uppercase text-amber-600">Issues</p>
                    </div>
                    <div className="rounded-xl bg-rose-50 p-2">
                      <p className="text-sm font-black text-rose-700">{batch.review?.potentialDuplicates || 0}</p>
                      <p className="text-[8px] font-black uppercase text-rose-600">Duplicates</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[8px] font-black uppercase text-emerald-700">
                      {batch.review?.live || 0} live
                    </span>
                    {batch.review?.commerceActionRequired ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[8px] font-black uppercase text-amber-700">
                        {batch.review.commerceActionRequired} action required
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center p-6 text-center">
              <div>
                <FileSearch size={30} className="mx-auto text-stone-300" />
                <p className="mt-3 text-sm font-black text-stone-700">No bulk batches found</p>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          {loadingBatch ? (
            <div className="grid min-h-[620px] place-items-center">
              <LoaderCircle size={30} className="animate-spin text-violet-700" />
            </div>
          ) : batchDetail?.batch ? (
            <>
              <div className="border-b border-stone-200 bg-violet-50 p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black ${batchStatusClasses(batchDetail.batch.status)}`}>
                        {labelize(batchDetail.batch.status)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-violet-700">
                        {labelize(batchDetail.batch.listingType)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-black text-stone-950">
                      {batchDetail.batch.organization?.displayName || "Host organization"}
                    </h2>
                    <p className="mt-1 text-xs font-semibold text-stone-500">
                      {batchDetail.batch.sourceFileName || "Bulk workbook"} · {batchDetail.batch.review?.submittedRows || 0} submitted products
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadBatchReport(batchDetail.batch, batchDetail.drafts || [])}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-800"
                  >
                    <Download size={14} />
                    Download review report
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    [batchDetail.batch.review?.submittedRows || 0, "Submitted", "bg-white text-stone-900"],
                    [batchDetail.batch.review?.reviewReady || 0, "Review-ready", "bg-blue-100 text-blue-900"],
                    [batchDetail.batch.review?.validationIssues || 0, "Workbook issues", "bg-amber-100 text-amber-900"],
                    [batchDetail.batch.review?.potentialDuplicates || 0, "Potential duplicates", "bg-rose-100 text-rose-900"],
                  ].map(([value, label, className]) => (
                    <div key={label} className={`rounded-2xl p-3 ${className}`}>
                      <p className="text-lg font-black">{value}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] opacity-70">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-800">
                    {batchDetail.batch.review?.live || 0} customer-live
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black text-amber-800">
                    {batchDetail.batch.review?.commerceActionRequired || 0} commerce action required
                  </span>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {batchDetail.validationIssues?.length ? (
                  <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-900">
                      <ShieldAlert size={17} />
                      <p className="text-xs font-black">Workbook validation issues</p>
                    </div>
                    <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
                      {batchDetail.validationIssues.map((item) => (
                        <p key={`${item.rowNumber}-${item.merchantSku}`} className="text-xs font-semibold text-amber-800">
                          Row {item.rowNumber} · {item.merchantSku || item.productName || "Product"}: {(item.issues || []).join("; ")}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {ROW_FILTERS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRowFilter(value)}
                        className={[
                          "focus-ring rounded-full px-3 py-2 text-[10px] font-black transition",
                          rowFilter === value
                            ? "bg-stone-950 text-white"
                            : "border border-stone-200 bg-white text-stone-600 hover:border-violet-300",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={selectCleanRows}
                    className="focus-ring rounded-xl bg-emerald-100 px-3 py-2 text-[10px] font-black text-emerald-800 hover:bg-emerald-200"
                  >
                    Select all clean review-ready rows
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-stone-200">
                  <table className="min-w-[1120px] w-full border-collapse text-left">
                    <thead className="bg-stone-950 text-white">
                      <tr className="text-[9px] font-black uppercase tracking-[0.08em]">
                        <th className="px-3 py-3">Select</th>
                        <th className="px-3 py-3">Row / SKU</th>
                        <th className="px-3 py-3">Product</th>
                        <th className="px-3 py-3">Price</th>
                        <th className="px-3 py-3">Stock</th>
                        <th className="px-3 py-3">Review state</th>
                        <th className="px-3 py-3">Customer status</th>
                        <th className="px-3 py-3">Attention</th>
                        <th className="px-3 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrafts.map((draft) => {
                        const draftCommercial = draft.commercialDraft || {};
                        const terminal = ["approved_for_catalog", "rejected"].includes(draft.status);

                        return (
                          <tr key={draft.id} className="border-t border-stone-100 text-xs">
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                disabled={terminal}
                                checked={selectedDraftIds.includes(draft.id)}
                                onChange={() => toggleDraftSelection(draft.id)}
                                className="h-4 w-4 accent-violet-700 disabled:opacity-40"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-black text-stone-800">#{draft.bulkRowNumber || "—"}</p>
                              <p className="mt-1 font-semibold text-stone-500">{draft.merchantSku || "No SKU"}</p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="max-w-[250px] font-black text-stone-900">{candidateTitle(draft)}</p>
                              <p className="mt-1 text-[10px] font-semibold text-stone-500">{labelize(draft.listingType)}</p>
                            </td>
                            <td className="px-3 py-3 font-black text-stone-800">
                              {moneyFromMinor(
                                draftCommercial.salePriceMinor || draftCommercial.listPriceMinor,
                                draftCommercial.currency
                              )}
                            </td>
                            <td className="px-3 py-3 font-black text-stone-800">
                              {draftCommercial.availableQuantity ?? "—"}
                            </td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${statusClasses(draft.status)}`}>
                                {labelize(draft.status)}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${commerceStatusClasses(draft.commercializationStatus)}`}>
                                {draft.commercializationStatus === "live"
                                  ? "Customer live"
                                  : labelize(draft.commercializationStatus || "pending")}
                              </span>
                              {draft.commercializationStatus === "action_required" && draft.commercializationError ? (
                                <p className="mt-1 max-w-[220px] text-[9px] font-semibold leading-4 text-amber-700">
                                  {draft.commercializationError}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-3">
                              {draft.duplicateCandidateProductVersionId ? (
                                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[9px] font-black text-rose-700">
                                  Duplicate check
                                </span>
                              ) : draft.bulkReviewEligible ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-700">
                                  Bulk eligible
                                </span>
                              ) : (
                                <div>
                                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-700">
                                    Individual review
                                  </span>
                                  {draft.bulkReviewBlockers?.length ? (
                                    <p className="mt-1 max-w-[190px] text-[9px] font-semibold leading-4 text-amber-700">
                                      {draft.bulkReviewBlockers.join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => openDraft(draft.id)}
                                className="focus-ring rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800"
                              >
                                Open product
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!filteredDrafts.length ? (
                    <div className="grid min-h-40 place-items-center bg-stone-50 p-5 text-center">
                      <p className="text-sm font-black text-stone-500">No products in this filter.</p>
                    </div>
                  ) : null}
                </div>

                {(canCatalogMutate || canTrustSafetyMutate) ? (
                  <div className="mt-5 rounded-[22px] border border-violet-200 bg-violet-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <label className="block min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-violet-700">
                          Bulk review reason
                        </span>
                        <input
                          value={bulkReason}
                          onChange={(event) => setBulkReason(event.target.value)}
                          placeholder="Example: Selected clean rows verified against submitted package evidence."
                          className="mt-2 h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold outline-none focus:border-violet-400"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={bulkSubmitting || !selectedDraftIds.length || !canCatalogMutate}
                          onClick={() => submitBulkDecision("approve_for_catalog")}
                          className="focus-ring rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-40"
                        >
                          Approve selected ({selectedDraftIds.length})
                        </button>
                        <button
                          type="button"
                          disabled={bulkSubmitting || !selectedDraftIds.length}
                          onClick={() => submitBulkDecision("request_more_evidence")}
                          className="focus-ring rounded-xl bg-amber-500 px-4 py-3 text-xs font-black text-amber-950 hover:bg-amber-400 disabled:opacity-40"
                        >
                          Request info
                        </button>
                        <button
                          type="button"
                          disabled={bulkSubmitting || !selectedDraftIds.length}
                          onClick={() => submitBulkDecision("reject")}
                          className="focus-ring rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"
                        >
                          Reject selected
                        </button>
                      </div>
                    </div>

                    <p className="mt-3 text-[10px] font-semibold leading-4 text-violet-800/75">
                      Bulk approval is intentionally restricted to clean review-ready rows. Potential duplicates, privacy/evidence holds and non-review-ready rows are skipped and remain available for individual review.
                    </p>

                    {bulkNotice ? (
                      <p className="mt-3 rounded-xl bg-white p-3 text-xs font-bold text-violet-900">
                        {bulkNotice}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="grid min-h-[620px] place-items-center p-8 text-center">
              <div>
                <Boxes size={34} className="mx-auto text-stone-300" />
                <p className="mt-3 text-base font-black text-stone-700">Select a Bulk NPI batch</p>
                <p className="mt-1 text-xs font-semibold text-stone-400">The Host workbook is normalized into a review table here.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedDraft || loadingDraft ? (
        <div className="fixed inset-0 z-[90] bg-stone-950/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-[#f7f5ef] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-stone-950 p-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-300">Individual product review</p>
                <h2 className="mt-1 text-xl font-black">{detailDraft ? candidateTitle(detailDraft) : "Loading product..."}</h2>
                {detailDraft ? (
                  <p className="mt-1 text-xs font-semibold text-stone-300">
                    Row #{detailDraft.bulkRowNumber || "—"} · SKU {detailDraft.merchantSku || "—"}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDraft(null)}
                className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Close product review"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDraft ? (
              <div className="grid flex-1 place-items-center">
                <LoaderCircle size={30} className="animate-spin text-violet-700" />
              </div>
            ) : detailDraft ? (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                {detailDraft.duplicateCandidateProductVersionId ? (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-black">Potential canonical duplicate</p>
                      <p className="mt-1 break-all text-xs font-semibold">Existing ProductVersion candidate: {detailDraft.duplicateCandidateProductVersionId}</p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <section className="rounded-[24px] border border-sky-200 bg-sky-50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">Candidate product fields</p>
                        <p className="mt-1 text-sm font-black text-sky-950">Review each submitted fact</p>
                      </div>
                      <button
                        type="button"
                        onClick={acceptAllVisibleFields}
                        disabled={!canCatalogMutate || singleSubmitting}
                        className="focus-ring rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800 disabled:opacity-40"
                      >
                        Accept all submitted fields
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {reviewableFields.map(([fieldPath, item]) => {
                        const mutable = allowedFieldForMutation(fieldPath);
                        const safety = SAFETY_FIELDS.has(fieldPath);

                        return (
                          <div key={fieldPath} className="rounded-2xl border border-sky-100 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-black text-stone-800">{labelize(fieldPath)}</p>
                                <p className="mt-1 text-[9px] font-semibold text-stone-400">Source: {labelize(item?.source || "unknown")}</p>
                              </div>
                              {safety ? <ShieldAlert size={15} className="shrink-0 text-amber-600" /> : null}
                            </div>

                            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-stone-50 p-3 text-xs font-semibold leading-5 text-stone-700">
                              {printable(item?.value)}
                            </pre>

                            <select
                              value={fieldStates[fieldPath] || "pending_review"}
                              disabled={!mutable || singleSubmitting}
                              onChange={(event) =>
                                setFieldStates((current) => ({ ...current, [fieldPath]: event.target.value }))
                              }
                              className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black outline-none disabled:bg-stone-100 disabled:text-stone-400"
                            >
                              <option value="pending_review">Pending review</option>
                              <option value="accepted">Accept evidence field</option>
                              <option value="needs_evidence">Needs more evidence</option>
                              <option value="rejected">Reject field</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="space-y-5">
                    <section className="rounded-[24px] bg-emerald-950 p-5 text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-300">Commercial draft from Host workbook</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black ${commerceStatusClasses(detailDraft.commercializationStatus)}`}>
                          {detailDraft.commercializationStatus === "live"
                            ? "Customer live"
                            : labelize(detailDraft.commercializationStatus || "pending")}
                        </span>
                        {detailDraft.marketplaceOfferId ? (
                          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-black text-emerald-100">
                            Offer created
                          </span>
                        ) : null}
                      </div>

                      {detailDraft.commercializationError ? (
                        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs font-bold leading-5 text-amber-100">
                          {detailDraft.commercializationError}
                        </p>
                      ) : null}

                      <div className="mt-4 space-y-3 text-xs">
                        {[
                          ["Merchant SKU", detailDraft.merchantSku || "—"],
                          ["List price", moneyFromMinor(commercial.listPriceMinor, commercial.currency)],
                          ["Sale price", commercial.salePriceMinor ? moneyFromMinor(commercial.salePriceMinor, commercial.currency) : "—"],
                          ["Available", commercial.availableQuantity ?? "—"],
                          ["Inventory node", commercial.inventoryNodeName || "—"],
                          ["Node type", labelize(commercial.inventoryNodeType || "") || "—"],
                          ["Location", [commercial.city, commercial.state, commercial.pincode].filter(Boolean).join(", ") || "—"],
                          ["Service area", commercial.serviceAreaName || "—"],
                          ["Marketplace offer", detailDraft.marketplaceOfferId || "—"],
                          ["Price rule", detailDraft.marketplacePriceRuleId || "—"],
                          ["Inventory snapshot", detailDraft.marketplaceInventorySnapshotId || "—"],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-start justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                            <span className="font-semibold text-emerald-100/65">{label}</span>
                            <span className="text-right font-black">{value}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-violet-200 bg-violet-50 p-5">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={17} className="text-violet-700" />
                        <p className="text-xs font-black text-violet-950">Product evidence</p>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(selectedDraft.evidence || []).map((evidence) => (
                          <a
                            key={evidence.id}
                            href={evidence.readUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring overflow-hidden rounded-xl border border-violet-200 bg-white"
                          >
                            {evidence.readUrl ? (
                              <img src={evidence.readUrl} alt={labelize(evidence.purpose)} className="aspect-square w-full object-cover" />
                            ) : (
                              <div className="grid aspect-square place-items-center text-stone-300"><ImageIcon size={24} /></div>
                            )}
                            <p className="truncate p-2 text-[9px] font-black text-stone-600">{labelize(evidence.purpose)}</p>
                          </a>
                        ))}
                      </div>
                      {!selectedDraft.evidence?.length ? (
                        <p className="mt-3 text-xs font-semibold text-violet-700/60">No readable evidence is attached.</p>
                      ) : null}
                    </section>

                    <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Review context</p>
                      <div className="mt-3 space-y-2 text-xs font-semibold text-amber-950">
                        <p>Extraction: {selectedDraft.extraction?.status ? labelize(selectedDraft.extraction.status) : "Manual / no extraction job"}</p>
                        <p>Safety flags: {selectedDraft.extraction?.safetyFlags?.length ? selectedDraft.extraction.safetyFlags.map(labelize).join(", ") : "None reported"}</p>
                        <p>Previous governance decisions: {selectedDraft.decisions?.length || 0}</p>
                      </div>

                      {selectedDraft.decisions?.length ? (
                        <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">
                          {selectedDraft.decisions.slice(0, 4).map((decision) => (
                            <div key={decision.id} className="rounded-xl bg-white p-3">
                              <p className="text-[10px] font-black text-stone-800">{labelize(decision.decision)}</p>
                              <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-500">{decision.reason || "No reason recorded."}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>

                {(canCatalogMutate || canTrustSafetyMutate) && !["approved_for_catalog", "rejected"].includes(detailDraft.status) ? (
                  <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={18} className="text-emerald-700" />
                      <h3 className="text-sm font-black text-stone-900">Record individual governance decision</h3>
                    </div>

                    <textarea
                      value={singleReason}
                      onChange={(event) => setSingleReason(event.target.value)}
                      placeholder="Review reason"
                      rows={3}
                      className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm font-semibold outline-none focus:border-emerald-300"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={singleSubmitting || !canCatalogMutate}
                        onClick={() => submitSingleDecision("approve_for_catalog")}
                        className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-40"
                      >
                        <CheckCircle2 size={14} />
                        Approve for catalog
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() => submitSingleDecision("request_more_evidence")}
                        className="focus-ring rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-amber-950 hover:bg-amber-300 disabled:opacity-40"
                      >
                        Request more information
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() => submitSingleDecision("reject")}
                        className="focus-ring rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        Reject product
                      </button>
                    </div>

                    {singleNotice ? (
                      <p className="mt-3 rounded-xl bg-stone-100 p-3 text-xs font-bold text-stone-700">{singleNotice}</p>
                    ) : null}
                  </section>
                ) : (
                  <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-xs font-bold text-stone-600">
                    Current decision: <span className={statusClasses(detailDraft.status)}>{labelize(detailDraft.status)}</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
