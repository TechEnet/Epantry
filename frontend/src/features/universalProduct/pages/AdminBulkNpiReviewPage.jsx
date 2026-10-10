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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function reviewFieldLabel(fieldPath) {
  const labels = {
    displayName: "Product name",
    brandName: "Brand",
    gtin: "Barcode number",
    netQuantity: "Pack size",
    ingredientDeclarationText: "Ingredients",
    allergens: "Allergy information",
    nutrition: "Nutrition details",
    manufacturerName: "Manufacturer",
    countryOfOrigin: "Country of origin",
    claims: "Product claims",
    certifications: "Certifications",
  };

  return labels[fieldPath] || labelize(fieldPath);
}

function reviewSourceLabel(source) {
  const value = String(source || "").toLowerCase();

  if (value.includes("user") || value.includes("host")) return "Provided by Host";
  if (value.includes("open_food") || value.includes("food_facts")) return "Open Food Facts";
  if (value.includes("ai") || value.includes("extract")) return "Auto-read from evidence";
  if (value.includes("external")) return "External source";

  return "Submitted information";
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
      return "bg-orange-100 text-orange-800";
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
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function commerceStatusClasses(status) {
  switch (status) {
    case "live":
      return "bg-emerald-100 text-emerald-800";
    case "prepared":
      return "bg-blue-100 text-blue-800";
    case "action_required":
      return "bg-orange-100 text-orange-800";
    case "processing":
      return "bg-sky-100 text-sky-800";
    case "skipped":
      return "bg-stone-100 text-stone-600";
    default:
      return "bg-sky-100 text-sky-800";
  }
}


function nutritionReviewData(value) {
  let nutritionValue = value;

  if (typeof nutritionValue === "string") {
    try {
      nutritionValue = JSON.parse(nutritionValue);
    } catch {
      return {
        basis: "",
        serving: "",
        rows: nutritionValue.trim()
          ? [{ label: "Nutrition", value: nutritionValue.trim() }]
          : [],
      };
    }
  }

  if (!nutritionValue || typeof nutritionValue !== "object" || Array.isArray(nutritionValue)) {
    return { basis: "", serving: "", rows: [] };
  }

  const basisRaw = nutritionValue.basis || nutritionValue.per || nutritionValue.reference || "";
  const basisMap = {
    per_100g: "Per 100 g",
    per_100ml: "Per 100 ml",
    per_serving: "Per serving",
    per_pack: "Per pack",
    serving: "Per serving",
  };
  const normalizedBasis = String(basisRaw).toLowerCase();
  const basis = normalizedBasis === "unknown"
    ? ""
    : basisMap[normalizedBasis] ||
      (basisRaw ? labelize(String(basisRaw).replace(/^per[_\s-]*/i, "Per ")) : "");

  const servingSize = nutritionValue.servingSize || nutritionValue.serving || null;
  let serving = "";
  if (servingSize && typeof servingSize === "object" && !Array.isArray(servingSize)) {
    const amount = servingSize.value ?? servingSize.amount ?? servingSize.quantity;
    const unit = servingSize.unit || servingSize.unitText || "";
    if (amount !== null && amount !== undefined && amount !== "") {
      serving = `Serving size ${amount}${unit ? ` ${unit}` : ""}`;
    }
  } else if (servingSize !== null && servingSize !== undefined && servingSize !== "") {
    serving = `Serving size ${servingSize}`;
  }

  const nutrientLabels = {
    energy: "Energy",
    calories: "Calories",
    calorie: "Calories",
    protein: "Protein",
    carbohydrate: "Carbohydrates",
    carbohydrates: "Carbohydrates",
    totalcarbohydrate: "Carbohydrates",
    totalcarbohydrates: "Carbohydrates",
    fat: "Total fat",
    totalfat: "Total fat",
    saturatedfat: "Saturated fat",
    transfat: "Trans fat",
    sugar: "Total sugars",
    sugars: "Total sugars",
    totalsugars: "Total sugars",
    addedsugar: "Added sugars",
    addedsugars: "Added sugars",
    fiber: "Dietary fibre",
    fibre: "Dietary fibre",
    dietaryfiber: "Dietary fibre",
    dietaryfibre: "Dietary fibre",
    sodium: "Sodium",
    salt: "Salt",
    cholesterol: "Cholesterol",
    calcium: "Calcium",
    iron: "Iron",
    potassium: "Potassium",
  };

  const formatNutrientLabel = (name) => {
    const raw = String(name || "Nutrient").trim();
    const lookup = raw.replace(/[\s_-]/g, "").toLowerCase();
    return nutrientLabels[lookup] || labelize(raw);
  };

  const rows = [];
  const pushRow = (name, amount, unit = "") => {
    if (amount === null || amount === undefined || amount === "" || typeof amount === "object") return;
    rows.push({
      label: formatNutrientLabel(name),
      value: `${amount}${unit ? ` ${unit}` : ""}`,
    });
  };

  if (Array.isArray(nutritionValue.nutrients)) {
    nutritionValue.nutrients.forEach((nutrient) => {
      if (!nutrient) return;

      if (typeof nutrient !== "object") {
        pushRow("Nutrition", nutrient);
        return;
      }

      const name = nutrient.name || nutrient.label || nutrient.nutrient || nutrient.key || "Nutrient";
      const amount = nutrient.amount ?? nutrient.value ?? nutrient.quantity ?? nutrient.per100g ?? null;
      const unit = nutrient.unit || nutrient.unitText || "";
      pushRow(name, amount, unit);
    });
  } else {
    const nutrientSource =
      nutritionValue.nutrients && typeof nutritionValue.nutrients === "object"
        ? nutritionValue.nutrients
        : nutritionValue;

    Object.entries(nutrientSource).forEach(([key, item]) => {
      if (["basis", "per", "reference", "servingSize", "serving", "nutrients", "confidence"].includes(key)) return;

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const amount = item.value ?? item.amount ?? item.quantity ?? null;
        const unit = item.unit || item.unitText || "";
        pushRow(key, amount, unit);
        return;
      }

      pushRow(key, item);
    });
  }

  return { basis, serving, rows };
}

function readableReviewValue(fieldPath, value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (fieldPath === "netQuantity" && typeof value === "object") {
    if (value.rawText) {
      return String(value.rawText);
    }

    const amount = value.value ?? value.amount;
    const unit = value.unit || value.unitText || "";
    return amount !== null && amount !== undefined
      ? `${amount}${unit ? ` ${unit}` : ""}`
      : "Not provided";
  }

  if (fieldPath === "allergens" && typeof value === "object") {
    const statement = value.statement || value.text || "";
    const items = Array.isArray(value.items)
      ? value.items
          .map((item) => item?.name || item?.label || item)
          .filter(Boolean)
      : [];

    if (statement && items.length) {
      return `${statement}
${items.join(", ")}`;
    }

    if (statement) return String(statement);
    if (items.length) return items.join(", ");
    return "No allergens declared";
  }

  if (fieldPath === "nutrition" && typeof value === "object") {
    const lines = [];
    const basis = value.basis || value.per || value.reference;
    if (basis) lines.push(`Values ${String(basis).replace(/_/g, " ")}`);

    const nutrients = value.nutrients && typeof value.nutrients === "object"
      ? value.nutrients
      : value;

    Object.entries(nutrients).forEach(([key, item]) => {
      if (["basis", "per", "reference", "servingSize"].includes(key)) return;

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const amount = item.value ?? item.amount;
        const unit = item.unit || "";
        if (amount !== null && amount !== undefined) {
          lines.push(`${labelize(key)}: ${amount}${unit ? ` ${unit}` : ""}`);
        }
        return;
      }

      if (item !== null && item !== undefined && typeof item !== "object") {
        lines.push(`${labelize(key)}: ${item}`);
      }
    });

    return lines.length ? lines.join("\n") : "Nutrition details not provided";
  }

  if (["claims", "certifications"].includes(fieldPath)) {
    const items = Array.isArray(value) ? value : [value];
    const labels = items
      .map((item) => {
        if (item && typeof item === "object") {
          return item.label || item.name || item.title || item.statement || null;
        }
        return item;
      })
      .filter(Boolean);

    return labels.length ? labels.join(", ") : "None listed";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (item && typeof item === "object") {
          return item.label || item.name || item.title || item.value || null;
        }
        return item;
      })
      .filter(Boolean);

    return parts.length ? parts.join(", ") : "Not provided";
  }

  if (typeof value === "object") {
    const lines = Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => {
        if (typeof item === "object") {
          return null;
        }
        return `${labelize(key)}: ${item}`;
      })
      .filter(Boolean);

    return lines.length ? lines.join("\n") : "Not provided";
  }

  return String(value);
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
  const draftRequestIdRef = useRef(0);

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
            "Unable to load bulk product review batches."
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
          "Unable to load this product batch."
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
      setBulkNotice("Add a short review note before applying this decision.");
      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setBulkNotice("You do not have permission to approve catalog products.");
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
          "Unable to apply this bulk decision."
        )
      );
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function openDraft(draftId) {
    const requestId = draftRequestIdRef.current + 1;
    draftRequestIdRef.current = requestId;
    setLoadingDraft(true);
    setSingleNotice("");

    try {
      const result = await getAdminNpiDraft(draftId);

      if (draftRequestIdRef.current !== requestId) {
        return;
      }

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
      if (draftRequestIdRef.current !== requestId) {
        return;
      }

      setSingleNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to open this product review."
        )
      );
    } finally {
      if (draftRequestIdRef.current === requestId) {
        setLoadingDraft(false);
      }
    }
  }

  function closeDraftReview() {
    draftRequestIdRef.current += 1;
    setSelectedDraft(null);
    setLoadingDraft(false);
    setSingleNotice("");
    setSingleReason("");
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
      setSingleNotice("Add a short review note before recording the decision.");
      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setSingleNotice("You do not have permission to approve catalog products.");
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
          "Unable to save this product review decision."
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
      description={<>
        <span className="sm:hidden">Review Host batches, fix issues, and approve clean products.</span>
        <span className="hidden sm:inline">Review product batches submitted by Hosts, check issues and duplicates, and approve clean listings without opening the source spreadsheet.</span>
      </>}
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadBatches(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600 shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <section className="overflow-hidden rounded-[18px] bg-[#0f5148] text-white sm:rounded-[22px]">
        <div className="grid gap-3 px-4 py-4 sm:gap-6 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)] lg:items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[0.04em] text-emerald-200 sm:text-[11px] sm:tracking-[0.08em]">
              Batch review workspace
            </p>
            <h2 className="mt-1.5 max-w-3xl text-xl font-extrabold leading-[1.15] sm:mt-2 sm:text-3xl sm:leading-tight">
              <span className="sm:hidden">Review Host batches faster.</span>
              <span className="hidden sm:inline">Review Host product batches in one clear workflow.</span>
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs font-medium leading-4 text-emerald-50/80 sm:mt-2 sm:text-sm sm:leading-6">
              <span className="sm:hidden">Choose a batch, check issues, then decide.</span>
              <span className="hidden sm:inline">Choose a submission, check anything that needs attention, then review or approve the products. Clean rows can be handled together.</span>
            </p>
          </div>

          <div className="grid grid-cols-4 border-t border-white/15 sm:border-l sm:border-t-0">
            {[
              [summary.submitted || 0, "Submitted"],
              [summary.reviewReady || 0, "Ready"],
              [summary.issues || 0, "Need attention"],
              [summary.potentialDuplicates || 0, "Duplicates"],
            ].map(([value, label]) => (
              <div key={label} className="border-r border-white/15 px-2 py-2 last:border-r-0 sm:px-4">
                <p className="text-lg font-extrabold sm:text-2xl">{value}</p>
                <p className="mt-0.5 text-[9px] font-semibold leading-3 text-emerald-100/70 sm:mt-1 sm:text-[11px]">
                  <span className="sm:hidden">{label === "Need attention" ? "Issues" : label}</span>
                  <span className="hidden sm:inline">{label}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/15 bg-[#0b433d] px-4 py-2 text-[10px] font-semibold text-emerald-50/85 sm:gap-x-6 sm:gap-y-2 sm:px-7 sm:py-3 sm:text-xs">
          <span><span className="sm:hidden">{summary.live || 0} live</span><span className="hidden sm:inline">{summary.live || 0} customer live</span></span>
          <span><span className="sm:hidden">{summary.commerceActionRequired || 0} need setup</span><span className="hidden sm:inline">{summary.commerceActionRequired || 0} need selling setup</span></span>
          <span><span className="sm:hidden">{pagination?.total ?? batches.length} batches</span><span className="hidden sm:inline">{pagination?.total ?? batches.length} Host submissions</span></span>
        </div>
      </section>

      <section className="mt-3 border-y border-[#c9dfdb] bg-[#eef7f5] px-3 py-3 sm:mt-5 sm:px-5 sm:py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
            className="col-span-2 flex min-w-0 items-center gap-2 border border-[#c7ddd9] bg-white px-2.5 py-1.5 sm:col-span-1 sm:border-x-0 sm:border-t-0 sm:border-b sm:border-[#a9cbc5] sm:px-3 sm:py-2.5 lg:border-b-0"
          >
            <SearchIcon size={17} className="shrink-0 text-[#176d62]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search Host or file name..."
              className="h-8 min-w-0 flex-1 bg-transparent text-sm font-medium text-stone-800 outline-none sm:h-9"
            />
            <button className="rounded-lg bg-[#155f57] px-4 py-2 text-xs font-bold text-white hover:bg-[#104f48]">
              Search
            </button>
          </form>

          <select
            value={listingType}
            onChange={(event) => setListingType(event.target.value)}
            className="h-10 min-w-0 border border-[#bdd5e2] bg-[#edf5f8] px-2 text-xs font-semibold text-slate-800 outline-none sm:h-[52px] sm:px-3 sm:text-sm"
          >
            {LISTING_FILTERS.map(([value, label]) => (
              <option key={value || "all"} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={batchStatus}
            onChange={(event) => setBatchStatus(event.target.value)}
            className="h-10 min-w-0 border border-[#c8d2dc] bg-white px-2 text-xs font-semibold text-slate-800 outline-none sm:h-[52px] sm:px-3 sm:text-sm"
          >
            {BATCH_STATUS_FILTERS.map(([value, label]) => (
              <option key={value || "all"} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </section>

      {error ? (
        <div className="mt-4 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="mt-3 border border-stone-200 bg-white sm:mt-5">
        <div className="grid gap-2 border-b border-stone-200 bg-[#f7f6f2] px-3 py-3 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center sm:gap-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-sm font-bold text-stone-900">Choose a Host submission</p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-500 sm:mt-1 sm:text-xs">Pick a batch to review.</p>
          </div>

          {loading ? (
            <div className="flex h-12 items-center gap-2 border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-500">
              <LoaderCircle size={17} className="animate-spin text-[#176d62]" />
              Loading submissions...
            </div>
          ) : visibleBatches.length ? (
            <select
              value={selectedBatchId}
              onChange={(event) => {
                const value = event.target.value;
                if (value) openBatch(value);
              }}
              className="h-10 w-full border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#438d83] sm:h-12"
            >
              <option value="">Select a submission</option>
              {visibleBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {(batch.organization?.displayName || "Host organization")} · {labelize(batch.status)} · {batch.review?.submittedRows || 0} products
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-500">
              No submissions match these filters.
            </div>
          )}
        </div>

        {loadingBatch ? (
          <div className="grid min-h-[360px] place-items-center">
            <LoaderCircle size={30} className="animate-spin text-[#176d62]" />
          </div>
        ) : batchDetail?.batch ? (
          <>
            <div className="border-b border-stone-200 bg-[#eaf4f7]">
              <div className="flex flex-col gap-2 px-3 py-3 sm:gap-4 sm:px-5 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${batchStatusClasses(batchDetail.batch.status)}`}>
                      {labelize(batchDetail.batch.status)}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700">
                      {labelize(batchDetail.batch.listingType)}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-extrabold text-stone-950 sm:mt-2 sm:text-xl">
                    {batchDetail.batch.organization?.displayName || "Host organization"}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-stone-500 sm:mt-1 sm:text-xs">
                    {batchDetail.batch.sourceFileName || "Submitted file"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => downloadBatchReport(batchDetail.batch, batchDetail.drafts || [])}
                  className="focus-ring inline-flex items-center justify-center gap-2 self-start rounded-lg bg-[#165f75] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#104f62]"
                >
                  <Download size={14} />
                  <span className="sm:hidden">Report</span><span className="hidden sm:inline">Download review report</span>
                </button>
              </div>

              <div className="grid grid-cols-2 border-t border-[#c9dce3] sm:grid-cols-4">
                {[
                  [batchDetail.batch.review?.submittedRows || 0, "Products"],
                  [batchDetail.batch.review?.reviewReady || 0, "Ready"],
                  [batchDetail.batch.review?.validationIssues || 0, "Need attention"],
                  [batchDetail.batch.review?.potentialDuplicates || 0, "Duplicates"],
                ].map(([value, label], index) => (
                  <div key={label} className={["px-2 py-2 sm:px-4 sm:py-3", index ? "border-l border-[#c9dce3]" : ""].join(" ")}>
                    <p className="text-lg font-extrabold text-stone-900 sm:text-xl">{value}</p>
                    <p className="mt-0.5 text-[9px] font-semibold leading-3 text-stone-500 sm:text-[11px]">
                      <span className="sm:hidden">{label === "Products" ? "Items" : label === "Need attention" ? "Issues" : label === "Duplicates" ? "Dupes" : label}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 py-3 sm:px-5 sm:py-5">
              {batchDetail.validationIssues?.length ? (
                <div className="mb-3 border-l-4 border-orange-500 bg-[#fff5ee] px-3 py-2.5 sm:mb-5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-2 text-orange-900">
                    <ShieldAlert size={17} />
                    <p className="text-sm font-bold">Products that need attention</p>
                  </div>
                  <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {batchDetail.validationIssues.map((item) => (
                      <p key={`${item.rowNumber}-${item.merchantSku}`} className="text-xs font-medium leading-5 text-orange-800">
                        Row {item.rowNumber} · {item.merchantSku || item.productName || "Product"}: {(item.issues || []).join("; ")}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2.5 sm:flex-col sm:items-start sm:gap-3 sm:pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-900">Products in this batch</p>
                  <p className="mt-1 hidden text-xs font-medium text-stone-500 sm:block">Filter the list or open a product when it needs a closer look.</p>
                </div>

                <button
                  type="button"
                  onClick={selectCleanRows}
                  className="focus-ring shrink-0 self-start rounded-lg bg-[#dff3eb] px-2.5 py-1.5 text-[11px] font-bold text-[#176a55] hover:bg-[#d2ecdf] sm:px-3 sm:py-2 sm:text-xs"
                >
                  Select clean rows
                </button>
              </div>

              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:mt-3 sm:gap-2">
                {ROW_FILTERS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRowFilter(value)}
                    className={[
                      "focus-ring shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:py-2 sm:text-xs",
                      rowFilter === value
                        ? "bg-[#17364a] text-white"
                        : "border border-stone-200 bg-white text-stone-600 hover:border-[#8cb6c5]",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 hidden overflow-x-auto border border-stone-200 lg:block">
                <table className="min-w-[1080px] w-full border-collapse text-left">
                  <thead className="bg-[#17364a] text-white">
                    <tr className="text-[10px] font-semibold">
                      <th className="px-3 py-3">Select</th>
                      <th className="px-3 py-3">Row / SKU</th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Price</th>
                      <th className="px-3 py-3">Stock</th>
                      <th className="px-3 py-3">Review</th>
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Needs attention</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {filteredDrafts.map((draft) => {
                      const draftCommercial = draft.commercialDraft || {};
                      const terminal = ["approved_for_catalog", "rejected"].includes(draft.status);

                      return (
                        <tr key={draft.id} className="bg-white text-xs hover:bg-[#fafaf8]">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              disabled={terminal}
                              checked={selectedDraftIds.includes(draft.id)}
                              onChange={() => toggleDraftSelection(draft.id)}
                              className="h-4 w-4 accent-[#176d62] disabled:opacity-40"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-bold text-stone-800">#{draft.bulkRowNumber || "—"}</p>
                            <p className="mt-0.5 font-medium text-stone-500">{draft.merchantSku || "No SKU"}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="max-w-[260px] font-bold text-stone-900">{candidateTitle(draft)}</p>
                            <p className="mt-0.5 text-[10px] font-medium text-stone-500">{labelize(draft.listingType)}</p>
                          </td>
                          <td className="px-3 py-3 font-bold text-stone-800">
                            {moneyFromMinor(draftCommercial.salePriceMinor || draftCommercial.listPriceMinor, draftCommercial.currency)}
                          </td>
                          <td className="px-3 py-3 font-bold text-stone-800">{draftCommercial.availableQuantity ?? "—"}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClasses(draft.status)}`}>
                              {labelize(draft.status)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${commerceStatusClasses(draft.commercializationStatus)}`}>
                              {draft.commercializationStatus === "live" ? "Customer live" : labelize(draft.commercializationStatus || "pending")}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {draft.duplicateCandidateProductVersionId ? (
                              <span className="text-xs font-semibold text-red-700">Possible duplicate</span>
                            ) : draft.bulkReviewEligible ? (
                              <span className="text-xs font-semibold text-emerald-700">Ready for bulk review</span>
                            ) : (
                              <div>
                                <span className="text-xs font-semibold text-orange-700">Review individually</span>
                                {draft.bulkReviewBlockers?.length ? (
                                  <p className="mt-1 max-w-[220px] text-[10px] font-medium leading-4 text-orange-700">
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
                              className="focus-ring rounded-lg bg-[#126f9a] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#0e5c80]"
                            >
                              Review product
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 space-y-2 sm:space-y-0 sm:divide-y sm:divide-stone-200 sm:border-y sm:border-stone-200 lg:hidden">
                {filteredDrafts.map((draft) => {
                  const draftCommercial = draft.commercialDraft || {};
                  const terminal = ["approved_for_catalog", "rejected"].includes(draft.status);

                  return (
                    <div key={draft.id} className="border-l-4 border-[#b7ccd7] bg-[#f8fafb] px-3 py-2.5 sm:border-l-0 sm:bg-white sm:px-1 sm:py-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          disabled={terminal}
                          checked={selectedDraftIds.includes(draft.id)}
                          onChange={() => toggleDraftSelection(draft.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-[#176d62] disabled:opacity-40"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-stone-900">{candidateTitle(draft)}</p>
                              <p className="mt-0.5 truncate text-[10px] font-medium text-stone-500">#{draft.bulkRowNumber || "—"} · {draft.merchantSku || "No SKU"}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openDraft(draft.id)}
                              className="focus-ring shrink-0 rounded-md bg-[#126f9a] px-2.5 py-1.5 text-[10px] font-bold text-white"
                            >
                              Review
                            </button>
                          </div>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-stone-600">
                            <span>{moneyFromMinor(draftCommercial.salePriceMinor || draftCommercial.listPriceMinor, draftCommercial.currency)}</span>
                            <span>Stock {draftCommercial.availableQuantity ?? "—"}</span>
                            <span className={statusClasses(draft.status)}>{labelize(draft.status)}</span>
                          </div>

                          <p className="mt-1.5 text-[10px] font-medium leading-4 text-stone-500">
                            {draft.duplicateCandidateProductVersionId
                              ? "Possible duplicate — review individually."
                              : draft.bulkReviewEligible
                              ? "Clean and ready for bulk review."
                              : "Needs an individual check before a decision."}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!filteredDrafts.length ? (
                <div className="grid min-h-32 place-items-center border-b border-stone-200 bg-[#fafaf8] p-5 text-center">
                  <p className="text-sm font-semibold text-stone-500">No products match this filter.</p>
                </div>
              ) : null}

              {(canCatalogMutate || canTrustSafetyMutate) ? (
                <section className="mt-3 border-t border-[#cbdde8] bg-[#edf5fa] px-3 py-3 sm:mt-5 sm:px-5 sm:py-4">
                  <div className="grid gap-2 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                    <label className="block min-w-0">
                      <span className="text-sm font-bold text-[#17364a]"><span className="sm:hidden">Bulk decision</span><span className="hidden sm:inline">Apply one decision to selected products</span></span>
                      <input
                        value={bulkReason}
                        onChange={(event) => setBulkReason(event.target.value)}
                        placeholder="Why are you making this decision?"
                        className="mt-1.5 h-10 w-full border border-[#bfd2df] bg-white px-3 text-sm font-medium outline-none focus:border-[#6aa0bd] sm:mt-2 sm:h-11"
                      />
                    </label>

                    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                      <button
                        type="button"
                        disabled={bulkSubmitting || !selectedDraftIds.length || !canCatalogMutate}
                        onClick={() => submitBulkDecision("approve_for_catalog")}
                        className="focus-ring rounded-lg bg-[#147554] px-4 py-3 text-xs font-bold text-white hover:bg-[#106346] disabled:opacity-40"
                      >
                        <span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve selected ({selectedDraftIds.length})</span>
                      </button>
                      <button
                        type="button"
                        disabled={bulkSubmitting || !selectedDraftIds.length}
                        onClick={() => submitBulkDecision("request_more_evidence")}
                        className="focus-ring rounded-lg bg-[#d66a2c] px-4 py-3 text-xs font-bold text-white hover:bg-[#bd5821] disabled:opacity-40"
                      >
                        <span className="sm:hidden">Need info</span><span className="hidden sm:inline">Ask for information</span>
                      </button>
                      <button
                        type="button"
                        disabled={bulkSubmitting || !selectedDraftIds.length}
                        onClick={() => submitBulkDecision("reject")}
                        className="focus-ring rounded-lg bg-red-600 px-4 py-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        <span className="sm:hidden">Reject</span><span className="hidden sm:inline">Reject selected</span>
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-[10px] font-medium leading-4 text-slate-600 sm:mt-3 sm:text-xs sm:leading-5">
                    <span className="sm:hidden">Only clean rows can be approved together.</span>
                    <span className="hidden sm:inline">Only clean products that are ready for review can be approved together. Products with duplicates or other checks stay available for individual review.</span>
                  </p>

                  {bulkNotice ? (
                    <p className="mt-3 border border-[#c9dce8] bg-white px-3 py-2.5 text-xs font-semibold text-[#17364a]">
                      {bulkNotice}
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid min-h-[320px] place-items-center p-8 text-center">
            <div>
              <Boxes size={32} className="mx-auto text-stone-300" />
              <p className="mt-3 text-base font-bold text-stone-700">Choose a submission to start review</p>
              <p className="mt-1 text-sm font-medium text-stone-400">Select a Host batch above to see its products.</p>
            </div>
          </div>
        )}
      </section>

      {selectedDraft || loadingDraft ? (
        <div className="fixed inset-0 z-[200] bg-stone-950/55 p-0 backdrop-blur-sm sm:p-6">
          <div className="relative mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-[#f7f5ef] shadow-2xl sm:rounded-[28px]">
            <div className="sticky top-0 z-[205] flex items-start justify-between gap-3 border-b border-stone-200 bg-stone-950 px-4 py-3 text-white sm:static sm:gap-4 sm:p-5">
              <div>
                <p className="text-[10px] font-bold text-sky-300">Product review</p>
                <h2 className="mt-0.5 text-base font-extrabold sm:mt-1 sm:text-xl sm:font-black">{detailDraft ? candidateTitle(detailDraft) : "Loading product..."}</h2>
                {detailDraft ? (
                  <p className="mt-1 text-xs font-semibold text-stone-300">
                    Row #{detailDraft.bulkRowNumber || "—"} · SKU {detailDraft.merchantSku || "—"}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDraftReview}
                className="focus-ring relative z-[210] grid h-9 w-9 shrink-0 touch-manipulation place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:h-10 sm:w-10"
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
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                {detailDraft.duplicateCandidateProductVersionId ? (
                  <div className="mb-3 flex items-start gap-2 border-l-4 border-rose-500 bg-rose-50 px-3 py-2.5 text-rose-900 sm:mb-5 sm:gap-3 sm:rounded-2xl sm:border sm:border-rose-200 sm:p-4">
                    <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold"><span className="sm:hidden">Possible duplicate found</span><span className="hidden sm:inline">Potential canonical duplicate</span></p>
                      <p className="mt-0.5 text-[11px] font-medium leading-4 sm:mt-1 sm:break-all sm:text-xs sm:font-semibold">
                        <span className="sm:hidden">This product may already exist in the catalog. Compare it before approving.</span>
                        <span className="hidden sm:inline">Existing ProductVersion candidate: {detailDraft.duplicateCandidateProductVersionId}</span>
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <section className="border-y border-sky-200 bg-[#f3f8fb] px-3 py-3 sm:rounded-[24px] sm:border sm:bg-sky-50 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-sky-700">Product details</p>
                        <p className="mt-0.5 text-sm font-bold text-sky-950 sm:mt-1 sm:font-black">Check each detail before approving</p>
                      </div>
                      <button
                        type="button"
                        onClick={acceptAllVisibleFields}
                        disabled={!canCatalogMutate || singleSubmitting}
                        className="focus-ring rounded-xl bg-sky-700 px-3 py-2 text-[10px] font-black text-white hover:bg-sky-800 disabled:opacity-40"
                      >
                        Mark all correct
                      </button>
                    </div>

                    <div className="mt-2 grid gap-0 sm:mt-4 sm:gap-3 md:grid-cols-2">
                      {reviewableFields.map(([fieldPath, item]) => {
                        const mutable = allowedFieldForMutation(fieldPath);
                        const safety = SAFETY_FIELDS.has(fieldPath);

                        return (
                          <div key={fieldPath} className="border-b border-sky-100 bg-transparent px-0 py-2.5 sm:rounded-2xl sm:border sm:bg-white sm:p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-stone-800 sm:font-black">{reviewFieldLabel(fieldPath)}</p>
                                <p className="mt-0.5 text-[9px] font-medium text-stone-400 sm:mt-1 sm:font-semibold">{reviewSourceLabel(item?.source)}</p>
                              </div>
                              {safety ? <ShieldAlert size={15} className="shrink-0 text-amber-600" /> : null}
                            </div>

                            {fieldPath === "nutrition" ? (() => {
                              const nutrition = nutritionReviewData(item?.value);

                              return (
                                <div className="mt-2 border-y border-sky-100 bg-white py-2 sm:mt-3 sm:rounded-xl sm:border sm:bg-stone-50 sm:p-3">
                                  {(nutrition.basis || nutrition.serving) ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {nutrition.basis ? (
                                        <span className="rounded-md bg-sky-100 px-2 py-1 text-[9px] font-bold text-sky-800 sm:text-[10px]">
                                          {nutrition.basis}
                                        </span>
                                      ) : null}
                                      {nutrition.serving ? (
                                        <span className="rounded-md bg-stone-100 px-2 py-1 text-[9px] font-bold text-stone-600 sm:text-[10px]">
                                          {nutrition.serving}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {nutrition.rows.length ? (
                                    <div className={`${nutrition.basis || nutrition.serving ? "mt-2" : ""} grid grid-cols-2 gap-x-3 sm:gap-x-4`}>
                                      {nutrition.rows.map((nutrient) => (
                                        <div
                                          key={`${nutrient.label}-${nutrient.value}`}
                                          className="flex min-w-0 items-center justify-between gap-2 border-b border-stone-100 py-1.5 last:border-b-0"
                                        >
                                          <span className="truncate text-[10px] font-semibold text-stone-500 sm:text-[11px]">
                                            {nutrient.label}
                                          </span>
                                          <span className="shrink-0 text-[10px] font-black text-stone-900 sm:text-[11px]">
                                            {nutrient.value}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-semibold text-stone-500 sm:text-[11px]">
                                      Nutrition details not provided.
                                    </p>
                                  )}
                                </div>
                              );
                            })() : (
                              <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-words bg-white p-2 text-[11px] font-medium leading-4 text-stone-700 sm:mt-3 sm:max-h-40 sm:rounded-xl sm:bg-stone-50 sm:p-3 sm:text-xs sm:font-semibold sm:leading-5">
                                {readableReviewValue(fieldPath, item?.value)}
                              </pre>
                            )}

                            <select
                              value={fieldStates[fieldPath] || "pending_review"}
                              disabled={!mutable || singleSubmitting}
                              onChange={(event) =>
                                setFieldStates((current) => ({ ...current, [fieldPath]: event.target.value }))
                              }
                              className="mt-2 h-9 w-full border border-stone-200 bg-white px-2.5 text-[11px] font-bold outline-none disabled:bg-stone-100 disabled:text-stone-400 sm:hidden"
                            >
                              <option value="pending_review">Not reviewed</option>
                              <option value="accepted">Looks correct</option>
                              <option value="needs_evidence">Need more proof</option>
                              <option value="rejected">Mark incorrect</option>
                            </select>

                            <select
                              value={fieldStates[fieldPath] || "pending_review"}
                              disabled={!mutable || singleSubmitting}
                              onChange={(event) =>
                                setFieldStates((current) => ({ ...current, [fieldPath]: event.target.value }))
                              }
                              className="mt-3 hidden w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black outline-none disabled:bg-stone-100 disabled:text-stone-400 sm:block"
                            >
                              <option value="pending_review">Not reviewed</option>
                              <option value="accepted">Looks correct</option>
                              <option value="needs_evidence">Need more proof</option>
                              <option value="rejected">Mark incorrect</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <div className="space-y-3 sm:space-y-5">
                    <section className="bg-emerald-950 p-3 text-white sm:rounded-[24px] sm:p-5">
                      <p className="text-[10px] font-bold text-emerald-300">Selling details from Host</p>

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

                      <div className="mt-3 space-y-2 text-[11px] sm:mt-4 sm:space-y-3 sm:text-xs">
                        {[
                          ["Host product code", detailDraft.merchantSku || "—"],
                          ["Regular price", moneyFromMinor(commercial.listPriceMinor, commercial.currency)],
                          ["Selling price", commercial.salePriceMinor ? moneyFromMinor(commercial.salePriceMinor, commercial.currency) : "—"],
                          ["Stock available", commercial.availableQuantity ?? "—"],
                          ["Stock location", commercial.inventoryNodeName || "—"],
                          ["Location type", labelize(commercial.inventoryNodeType || "") || "—"],
                          ["Location", [commercial.city, commercial.state, commercial.pincode].filter(Boolean).join(", ") || "—"],
                          ["Delivery area", commercial.serviceAreaName || "—"],
                          ["Store listing", detailDraft.marketplaceOfferId ? "Created" : "Not created"],
                          ["Pricing setup", detailDraft.marketplacePriceRuleId ? "Applied" : "Not set"],
                          ["Stock sync", detailDraft.marketplaceInventorySnapshotId ? "Connected" : "Not connected"],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-start justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                            <span className="font-semibold text-emerald-100/65">{label}</span>
                            <span className="text-right font-black">{value}</span>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="border-y border-violet-200 bg-violet-50 p-3 sm:rounded-[24px] sm:border sm:p-5">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={17} className="text-violet-700" />
                        <p className="text-xs font-bold text-violet-950">Uploaded proof</p>
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

                    <section className="border-y border-slate-200 bg-slate-50 p-3 sm:rounded-[24px] sm:border sm:border-amber-200 sm:bg-amber-50 sm:p-5">
                      <p className="text-[10px] font-bold text-slate-700 sm:font-black sm:text-amber-700">Review history</p>
                      <div className="mt-2 space-y-1 text-[11px] font-medium text-slate-700 sm:mt-3 sm:space-y-2 sm:text-xs sm:font-semibold sm:text-amber-950">
                        <p>How details were added: {selectedDraft.extraction?.status ? labelize(selectedDraft.extraction.status) : "Entered by Host"}</p>
                        <p>Safety notes: {selectedDraft.extraction?.safetyFlags?.length ? selectedDraft.extraction.safetyFlags.map(labelize).join(", ") : "No safety concerns reported"}</p>
                        <p>Previous decisions: {selectedDraft.decisions?.length || 0}</p>
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
                  <section className="mt-3 border-y border-stone-200 bg-white p-3 sm:mt-5 sm:rounded-[24px] sm:border sm:p-5">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={18} className="text-emerald-700" />
                      <h3 className="text-sm font-bold text-stone-900">Make a decision</h3>
                    </div>

                    <textarea
                      value={singleReason}
                      onChange={(event) => setSingleReason(event.target.value)}
                      placeholder="Reason for this decision"
                      rows={3}
                      className="mt-2 h-16 w-full border border-stone-200 bg-stone-50 p-2.5 text-sm font-medium outline-none focus:border-emerald-300 sm:mt-4 sm:h-auto sm:rounded-2xl sm:p-3 sm:font-semibold"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={singleSubmitting || !canCatalogMutate}
                        onClick={() => submitSingleDecision("approve_for_catalog")}
                        className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-40"
                      >
                        <CheckCircle2 size={14} />
                        <span className="sm:hidden">Approve</span><span className="hidden sm:inline">Approve for catalog</span>
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() => submitSingleDecision("request_more_evidence")}
                        className="focus-ring rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-amber-950 hover:bg-amber-300 disabled:opacity-40"
                      >
                        <span className="sm:hidden">Need info</span><span className="hidden sm:inline">Request more information</span>
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() => submitSingleDecision("reject")}
                        className="focus-ring rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        <span className="sm:hidden">Reject</span><span className="hidden sm:inline">Reject product</span>
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
