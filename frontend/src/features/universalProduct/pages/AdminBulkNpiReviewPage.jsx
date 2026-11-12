import {
  BadgeCheck,
  ArrowRight,
  ChevronRight,
  Layers3,
  CheckCircle2,
  CircleAlert,
  Download,
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

  if (value.includes("user") || value.includes("host"))
    return "Provided by Host";
  if (value.includes("open_food") || value.includes("food_facts"))
    return "Open Food Facts";
  if (value.includes("ai") || value.includes("extract"))
    return "Auto-read from evidence";
  if (value.includes("external")) return "External source";

  return "Submitted information";
}

function candidateValue(draft, fieldPath) {
  return draft?.candidateFields?.[fieldPath]?.value ?? null;
}

function candidateTitle(draft) {
  return String(
    candidateValue(draft, "displayName") ||
      draft?.barcode ||
      "Provisional product"
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

function commerceStatusClasses(status) {
  switch (status) {
    case "live":
      return "bg-emerald-100 text-emerald-800";
    case "prepared":
      return "bg-blue-100 text-blue-800";
    case "action_required":
      return "bg-orange-100 text-orange-800";
    case "processing":
      return "bg-[#E0EBE1] text-[#173F35]";
    case "skipped":
      return "bg-stone-100 text-stone-600";
    default:
      return "bg-[#E0EBE1] text-[#173F35]";
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

  if (
    !nutritionValue ||
    typeof nutritionValue !== "object" ||
    Array.isArray(nutritionValue)
  ) {
    return { basis: "", serving: "", rows: [] };
  }

  const basisRaw =
    nutritionValue.basis ||
    nutritionValue.per ||
    nutritionValue.reference ||
    "";
  const basisMap = {
    per_100g: "Per 100 g",
    per_100ml: "Per 100 ml",
    per_serving: "Per serving",
    per_pack: "Per pack",
    serving: "Per serving",
  };
  const normalizedBasis = String(basisRaw).toLowerCase();
  const basis =
    normalizedBasis === "unknown"
      ? ""
      : basisMap[normalizedBasis] ||
        (basisRaw
          ? labelize(String(basisRaw).replace(/^per[_\s-]*/i, "Per "))
          : "");

  const servingSize =
    nutritionValue.servingSize || nutritionValue.serving || null;
  let serving = "";
  if (
    servingSize &&
    typeof servingSize === "object" &&
    !Array.isArray(servingSize)
  ) {
    const amount =
      servingSize.value ?? servingSize.amount ?? servingSize.quantity;
    const unit = servingSize.unit || servingSize.unitText || "";
    if (amount !== null && amount !== undefined && amount !== "") {
      serving = `Serving size ${amount}${unit ? ` ${unit}` : ""}`;
    }
  } else if (
    servingSize !== null &&
    servingSize !== undefined &&
    servingSize !== ""
  ) {
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
    if (
      amount === null ||
      amount === undefined ||
      amount === "" ||
      typeof amount === "object"
    )
      return;
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

      const name =
        nutrient.name ||
        nutrient.label ||
        nutrient.nutrient ||
        nutrient.key ||
        "Nutrient";
      const amount =
        nutrient.amount ??
        nutrient.value ??
        nutrient.quantity ??
        nutrient.per100g ??
        null;
      const unit = nutrient.unit || nutrient.unitText || "";
      pushRow(name, amount, unit);
    });
  } else {
    const nutrientSource =
      nutritionValue.nutrients && typeof nutritionValue.nutrients === "object"
        ? nutritionValue.nutrients
        : nutritionValue;

    Object.entries(nutrientSource).forEach(([key, item]) => {
      if (
        [
          "basis",
          "per",
          "reference",
          "servingSize",
          "serving",
          "nutrients",
          "confidence",
        ].includes(key)
      )
        return;

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

    const nutrients =
      value.nutrients && typeof value.nutrients === "object"
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
          return (
            item.label || item.name || item.title || item.statement || null
          );
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
  const [loadingMore, setLoadingMore] = useState(false);
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
  const batchRequestIdRef = useRef(0);
  const batchListRequestIdRef = useRef(0);
  const reviewDeskRef = useRef(null);

  // Keep server pagination and selection in sync; never silently truncate the queue.
  const loadBatches = useCallback(
    async (background = false) => {
      const requestId = ++batchListRequestIdRef.current;
      setLoadingMore(false);
      if (background) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const result = await listAdminNpiBulkBatches({
          page: 1,
          limit: 50,
          listingType: listingType || undefined,
          search: search || undefined,
        });
        if (batchListRequestIdRef.current !== requestId) return;
        const nextBatches = result?.batches || [];
        setBatches(nextBatches);
        setSummary(result?.summary || {});
        setPagination(result?.pagination || null);
        setSelectedBatchId((current) =>
          nextBatches.some((item) => item.id === current) ? current : ""
        );
      } catch (requestError) {
        if (batchListRequestIdRef.current === requestId) {
          setError(
            getUniversalProductErrorMessage(
              requestError,
              "Unable to load Host submissions."
            )
          );
        }
      } finally {
        if (batchListRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [listingType, search]
  );

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  async function loadMoreBatches() {
    const nextPage = Number(pagination?.page || 1) + 1;
    if (loadingMore || nextPage > Number(pagination?.pages || 1)) return;
    const requestId = batchListRequestIdRef.current;
    setLoadingMore(true);
    setError("");
    try {
      const result = await listAdminNpiBulkBatches({
        page: nextPage,
        limit: 50,
        listingType: listingType || undefined,
        search: search || undefined,
      });
      if (batchListRequestIdRef.current !== requestId) return;
      setBatches((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [
          ...current,
          ...(result?.batches || []).filter((item) => !ids.has(item.id)),
        ];
      });
      setSummary((current) => {
        const next = { ...current };
        for (const [key, value] of Object.entries(result?.summary || {})) {
          next[key] = (Number(current?.[key]) || 0) + (Number(value) || 0);
        }
        return next;
      });
      setPagination(result?.pagination || pagination);
    } catch (requestError) {
      if (batchListRequestIdRef.current === requestId) {
        setError(
          getUniversalProductErrorMessage(
            requestError,
            "Unable to load more submissions."
          )
        );
      }
    } finally {
      if (batchListRequestIdRef.current === requestId) setLoadingMore(false);
    }
  }

  async function openBatch(batchId) {
    const requestId = ++batchRequestIdRef.current;
    setSelectedBatchId(batchId);
    setBatchDetail(null);
    setLoadingBatch(true);
    setError("");
    setBulkNotice("");
    setBulkReason("");
    setSelectedDraftIds([]);
    setRowFilter("all");
    closeDraftReview();
    try {
      const result = await getAdminNpiBulkBatch(batchId);
      if (batchRequestIdRef.current === requestId) setBatchDetail(result);
    } catch (requestError) {
      if (batchRequestIdRef.current === requestId) {
        setError(
          getUniversalProductErrorMessage(
            requestError,
            "Unable to load this Host submission."
          )
        );
      }
    } finally {
      if (batchRequestIdRef.current === requestId) setLoadingBatch(false);
    }
  }

  async function refreshSelectedBatch() {
    if (!selectedBatchId) return;
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

  useEffect(() => {
    if (loading) return;
    if (!visibleBatches.length) {
      batchRequestIdRef.current += 1;
      setSelectedBatchId("");
      setBatchDetail(null);
      setLoadingBatch(false);
      return;
    }
    if (!visibleBatches.some((item) => item.id === selectedBatchId)) {
      openBatch(visibleBatches[0].id);
    }
    // Selection is driven by loaded/filter results, never by the refresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, visibleBatches, selectedBatchId]);

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
        .filter(
          (draft) =>
            draft.bulkReviewEligible &&
            !["approved_for_catalog", "rejected"].includes(draft.status)
        )
        .map((draft) => draft.id)
    );
  }

  async function submitBulkDecision(decision) {
    if (!selectedBatchId || !selectedDraftIds.length || bulkSubmitting) {
      return;
    }

    if (bulkReason.trim().length < 3 || bulkReason.trim().length > 2000) {
      setBulkNotice(
        "Enter a reason of 3–2,000 characters before applying a decision."
      );
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

      await refreshSelectedBatch();

      setBulkNotice(
        decision === "approve_for_catalog"
          ? `${processed} product${
              processed === 1 ? "" : "s"
            } approved · ${live} customer-live${
              prepared ? ` · ${prepared} prepared` : ""
            }${
              commerceActionRequired
                ? ` · ${commerceActionRequired} need commerce action`
                : ""
            }${
              skipped
                ? ` · ${skipped} skipped because they require individual attention`
                : ""
            }.`
          : `${processed} product${processed === 1 ? "" : "s"} updated${
              skipped
                ? ` · ${skipped} skipped because they require individual attention`
                : ""
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

    if (singleReason.trim().length < 3 || singleReason.trim().length > 2000) {
      setSingleNotice(
        "Enter a reason of 3–2,000 characters before recording a decision."
      );
      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setSingleNotice(
        "You do not have permission to approve catalog products."
      );
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

  // Read-only presentation helpers for the Product review dialog. API decisions stay unchanged.
  const checkedFieldCount = reviewableFields.filter(
    ([fieldPath]) =>
      fieldStates[fieldPath] && fieldStates[fieldPath] !== "pending_review"
  ).length;
  const identityFields = reviewableFields.filter(
    ([fieldPath]) => !SAFETY_FIELDS.has(fieldPath)
  );
  const safetyFields = reviewableFields.filter(([fieldPath]) =>
    SAFETY_FIELDS.has(fieldPath)
  );

  const renderReviewField = ([fieldPath, item]) => {
    const mutable = allowedFieldForMutation(fieldPath);
    const safety = SAFETY_FIELDS.has(fieldPath);
    const nutrition =
      fieldPath === "nutrition" ? nutritionReviewData(item?.value) : null;

    return (
      <div
        key={fieldPath}
        className="grid min-w-0 gap-2 border-b border-[#E6E4DD] px-0 py-4 last:border-b-0 md:grid-cols-[minmax(125px,0.7fr)_minmax(0,1.4fr)_minmax(145px,0.85fr)] md:items-start md:gap-4"
      >
        <div className="min-w-0">
          <div className="flex items-start gap-1.5">
            <span className="text-[14px] font-bold leading-5 text-[#173F35]">
              {reviewFieldLabel(fieldPath)}
            </span>
            {safety ? (
              <ShieldAlert
                size={15}
                className="mt-0.5 shrink-0 text-[#AF6547]"
                aria-label="Safety-sensitive field"
              />
            ) : null}
          </div>
          <p className="mt-1 text-[12px] leading-4 text-[#69746D]">
            {reviewSourceLabel(item?.source)}
          </p>
        </div>
        <div className="min-w-0">
          {nutrition ? (
            <div className="min-w-0">
              {nutrition.basis || nutrition.serving ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {nutrition.basis ? (
                    <span className="bg-[#E7EEE5] px-2 py-1 text-[12px] font-semibold text-[#173F35]">
                      {nutrition.basis}
                    </span>
                  ) : null}
                  {nutrition.serving ? (
                    <span className="bg-[#F6EBE5] px-2 py-1 text-[12px] font-semibold text-[#774E3C]">
                      {nutrition.serving}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {nutrition.rows.length ? (
                <div className="grid grid-cols-2 gap-x-4">
                  {nutrition.rows.map((nutrient) => (
                    <div
                      key={`${nutrient.label}-${nutrient.value}`}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 border-b border-[#ECEAE4] py-1.5"
                    >
                      <span className="text-[12px] text-[#637168]">
                        {nutrient.label}
                      </span>
                      <span className="text-[12px] font-bold text-[#202421]">
                        {nutrient.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#657168]">
                  Nutrition details not provided.
                </p>
              )}
            </div>
          ) : (
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words font-sans text-[14px] font-medium leading-[1.55] text-[#27332C]">
              {readableReviewValue(fieldPath, item?.value)}
            </pre>
          )}
        </div>
        <label className="min-w-0">
          <span className="sr-only">Review {reviewFieldLabel(fieldPath)}</span>
          <select
            value={fieldStates[fieldPath] || "pending_review"}
            disabled={!mutable || singleSubmitting}
            onChange={(event) =>
              setFieldStates((current) => ({
                ...current,
                [fieldPath]: event.target.value,
              }))
            }
            className="focus-ring min-h-11 w-full border border-[#D9DED6] bg-white px-3 text-[13px] font-semibold text-[#173F35] outline-none disabled:bg-[#F1F2EF] disabled:text-[#8A918B]"
          >
            <option value="pending_review">Not reviewed</option>
            <option value="accepted">Looks correct</option>
            <option value="needs_evidence">Need more proof</option>
            <option value="rejected">Mark incorrect</option>
          </select>
        </label>
      </div>
    );
  };

  return (
    <AdminShell
      title="Bulk Product Review"
      description="Review Host submissions, investigate issues and record product decisions."
      actions={
        <button
          type="button"
          disabled={refreshing || loading}
          onClick={() => loadBatches(true)}
          className="focus-ring inline-flex min-h-11 items-center gap-2 border border-[#CFDBD0] bg-white px-4 text-sm font-semibold text-[#173F35] hover:bg-[#F0F5F0] disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />{" "}
          Refresh
        </button>
      }
    >
      <section
        aria-label="Bulk product review workspace"
        className="bulk-review-redesign min-w-0 bg-[#F7F6F2] text-[#202421]"
      >
        <style>{`
          @media (max-width: 639px) {
            /* Scope these changes to the Bulk Review workspace on a phone. */
            .page-shell:has(.bulk-review-redesign) {
              box-sizing: border-box !important;
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .page-shell:has(.bulk-review-redesign) .epantry-workspace-canvas > div:last-child {
              padding: 0 !important;
            }
            .listing-approvals-mobile-root:has(.bulk-review-redesign) {
              width: 100% !important;
              max-width: 100% !important;
              padding-bottom: 0 !important;
            }
            .bulk-review-redesign {
              box-sizing: border-box;
              width: 100%;
              max-width: 100%;
              min-width: 0;
              border-radius: 0;
              overflow-x: clip;
              background: #fffdfb;
            }
            .bulk-review-redesign .bulk-hero {
              padding: 18px 16px;
              border-bottom-width: 2px;
            }
            .bulk-review-redesign .bulk-hero-copy > p:last-child { display: none; }
            .bulk-review-redesign .bulk-hero-count {
              min-width: auto;
              padding: 9px 12px;
              gap: 9px;
              align-self: flex-start;
            }
            .bulk-review-redesign .bulk-hero-count > span:first-child {
              font-size: 24px;
            }
            .bulk-review-redesign .bulk-summary-grid,
            .bulk-review-redesign .bulk-batch-summary {
              grid-template-columns: repeat(2,minmax(0,1fr));
            }
            .bulk-review-redesign .bulk-summary-item {
              display: flex;
              flex-direction: row;
              align-items: center;
              gap: 9px;
              min-height: 61px;
              padding: 10px 13px;
            }
            .bulk-review-redesign .bulk-summary-item > div:first-child {
              flex-shrink: 0;
              font-size: 23px;
              line-height: 1.1;
            }
            .bulk-review-redesign .bulk-summary-item > div:last-child {
              font-size: 12px;
              line-height: 1.3;
            }
            .bulk-review-redesign .bulk-directory-toolbar { padding: 15px 14px 7px; }
            .bulk-review-redesign .bulk-directory-toolbar h3 { font-size: 20px; }
            .bulk-review-redesign .bulk-directory-toolbar form { margin-top: 12px; }
            .bulk-review-redesign .bulk-batch-filters { margin-top: 9px; }
            .bulk-review-redesign .bulk-mobile-batch-picker {
              padding: 0 14px 14px;
              background: #f1f4ee;
            }
            .bulk-review-redesign .bulk-mobile-filters {
              margin-top: 9px;
              border-top: 1px solid #d6ded4;
            }
            .bulk-review-redesign .bulk-mobile-filters summary {
              display: flex;
              align-items: center;
              justify-content: space-between;
              min-height: 42px;
              color: #173f35;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              list-style: none;
            }
            .bulk-review-redesign .bulk-mobile-filters summary::-webkit-details-marker { display: none; }
            .bulk-review-redesign .bulk-mobile-filters[open] summary {
              border-bottom: 1px solid #d6ded4;
            }
            .bulk-review-redesign .bulk-mobile-filters form { margin-top: 10px; }
            .page-shell:has(.bulk-review-redesign) .epantry-workspace-canvas > header p {
              display: none !important;
            }
            .bulk-review-redesign .bulk-mobile-batch-picker select {
              display: block;
              box-sizing: border-box;
              width: 100%;
              min-width: 0;
              min-height: 46px;
              padding: 10px 12px;
              border: 1px solid #c5d4c7;
              background: #fffdfb;
              color: #173f35;
              font-size: 14px;
              font-weight: 700;
            }
            .bulk-review-redesign .bulk-batch-detail-header { padding: 17px 15px; }
            .bulk-review-redesign .bulk-batch-detail-header h3 {
              font-size: 22px;
              line-height: 1.2;
            }
            .bulk-review-redesign .bulk-batch-stat {
              display: flex;
              align-items: center;
              min-height: 53px;
              gap: 10px;
              padding: 9px 13px;
            }
            .bulk-review-redesign .bulk-batch-stat > div {
              font-size: 22px;
              line-height: 1;
              flex-shrink: 0;
            }
            .bulk-review-redesign .bulk-batch-stat > p {
              min-width: 0;
              font-size: 12px;
              line-height: 1.3;
            }
            .bulk-review-redesign .bulk-products-section {
              padding: 18px 13px 15px;
            }
            .bulk-review-redesign .bulk-products-header h3 {
              font-size: 21px;
              line-height: 1.22;
            }
            .bulk-review-redesign .bulk-select-clean-button:disabled { display: none; }
            .bulk-review-redesign .bulk-row-filters {
              margin-top: 13px;
              padding-bottom: 5px;
              scrollbar-width: thin;
            }
            .bulk-review-redesign .bulk-row-filters button {
              min-height: 38px;
              font-size: 12px;
              padding: 8px 12px;
            }
            .bulk-review-redesign .bulk-product-row {
              display: grid;
              grid-template-columns: 19px minmax(0,1fr) auto;
              grid-template-rows: auto auto;
              column-gap: 10px;
              row-gap: 2px;
              padding: 15px 0;
              align-items: start;
              background: #fffdfb;
            }
            .bulk-review-redesign .bulk-product-checkbox {
              grid-column: 1;
              grid-row: 1;
              margin-top: 3px;
            }
            .bulk-review-redesign .bulk-product-copy {
              grid-column: 2;
              grid-row: 1;
            }
            .bulk-review-redesign .bulk-product-copy h4 {
              font-size: 15px;
              line-height: 1.4;
              overflow-wrap: anywhere;
            }
            .bulk-review-redesign .bulk-product-copy > p,
            .bulk-review-redesign .bulk-product-copy > div {
              font-size: 13px;
              line-height: 1.4;
            }
            .bulk-review-redesign .bulk-product-commercial {
              grid-column: 2;
              grid-row: 2;
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 4px 12px;
              font-size: 13px;
              padding-top: 6px;
            }
            .bulk-review-redesign .bulk-product-commercial > span {
              display: inline;
              margin: 0;
            }
            .bulk-review-redesign .bulk-product-action {
              grid-column: 3;
              grid-row: 1 / span 2;
              justify-self: end;
              align-self: center;
              min-height: 44px;
              padding: 0 10px;
              font-size: 13px;
              white-space: nowrap;
            }
            .bulk-review-redesign .bulk-decision-section { padding: 19px 15px 21px; }
            .bulk-review-redesign .bulk-decision-section h3 { font-size: 21px; }
            .bulk-review-redesign .bulk-decision-hint { display: none; }
            .bulk-review-redesign .bulk-decision-actions {
              display: grid;
              grid-template-columns: repeat(2,minmax(0,1fr));
              gap: 8px;
            }
            .bulk-review-redesign .bulk-decision-actions button {
              width: 100%;
              min-width: 0;
              min-height: 45px;
              padding: 8px 10px;
              font-size: 13px;
              white-space: normal;
              line-height: 1.3;
            }
            .bulk-review-redesign .bulk-decision-actions button:first-child {
              grid-column: 1 / -1;
            }
          }
          @media (max-width: 359px) {
            .bulk-review-redesign .bulk-batch-filters { grid-template-columns: 1fr; }
            .bulk-review-redesign .bulk-hero-count { width: 100%; }
          }
          .bulk-review-dialog [class*="text-[9px]"],
          .bulk-review-dialog [class*="text-[10px]"] { font-size: 12px; line-height: 1.5; }
          .bulk-review-dialog [class*="text-[11px]"] { font-size: 13px; line-height: 1.55; }
          .bulk-review-dialog button, .bulk-review-dialog select { min-height: 38px; }
        `}</style>

        <div className="bulk-hero border-b-[3px] border-[#C86C42] bg-[#EED7C8] px-4 py-6 sm:px-7 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="bulk-hero-copy max-w-2xl">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8C4C34]">
                05 / Bulk review
              </p>
              <h2 className="mt-1 text-[27px] font-bold leading-tight tracking-[-0.035em] text-[#173F35] sm:text-[34px]">
                Host submissions
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[#594B40]">
                Choose a batch, check its products, then record the right
                decision.
              </p>
            </div>
            <div className="bulk-hero-count flex min-w-[170px] items-center gap-3 bg-[#173F35] px-4 py-3 sm:py-4">
              <span className="text-[33px] font-bold tabular-nums leading-none text-white">
                {pagination?.total ?? batches.length}
              </span>
              <span className="text-[13px] font-semibold leading-5 text-[#E7EFE7]">
                Host
                <br />
                submissions
              </span>
            </div>
          </div>
        </div>

        <div className="bulk-summary-grid grid grid-cols-2 border-b border-[#D6DDD3] bg-[#FFFDFB] sm:grid-cols-4">
          {[
            [summary.submitted || 0, "Products submitted (loaded)"],
            [summary.reviewReady || 0, "Ready to review"],
            [summary.issues || 0, "Needs attention"],
            [summary.potentialDuplicates || 0, "Possible duplicates"],
          ].map(([value, label], index) => (
            <div
              key={label}
              className={`bulk-summary-item min-w-0 px-4 py-4 sm:px-6 sm:py-5 bg-[#FFFDFB] ${
                index % 2 ? "border-l border-[#E1DFD7]" : ""
              } ${
                index > 1 && index % 2 === 0
                  ? "sm:border-l sm:border-[#E9DFD7]"
                  : ""
              } ${index > 1 ? "border-t sm:border-t-0 border-[#E9DFD7]" : ""}`}
            >
              <div className="text-[27px] font-bold tabular-nums text-[#173F35] sm:text-[32px]">
                {value}
              </div>
              <div className="text-[13px] font-medium leading-5 text-[#586A5E]">
                {label}
              </div>
            </div>
          ))}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold text-red-800 sm:px-6"
          >
            <CircleAlert size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        ) : null}

        <div className="bulk-workspace-layout grid min-w-0 lg:grid-cols-[minmax(270px,320px)_minmax(0,1fr)]">
          <aside
            aria-label="Host batch directory"
            className="bulk-batch-directory min-w-0 border-b border-[#DAE1D9] bg-[#F1F4EE] lg:border-b-0 lg:border-r"
          >
            <div className="bulk-directory-toolbar px-4 pb-4 pt-5 sm:px-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#99553C]">
                    01 / Select
                  </p>
                  <h3 className="mt-1 text-[22px] font-bold leading-tight text-[#173F35]">
                    Choose a batch
                  </h3>
                </div>
                <span className="hidden border border-[#E4D5CB] bg-white px-2.5 py-1.5 text-[13px] font-bold tabular-nums text-[#173F35] sm:inline-flex">
                  {visibleBatches.length} loaded
                </span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSearch(searchInput.trim());
                }}
                className="mt-4 hidden min-w-0 items-center border border-[#DED1C8] bg-white sm:flex"
              >
                <SearchIcon
                  size={18}
                  className="ml-3 shrink-0 text-[#8A7568]"
                />
                <input
                  aria-label="Search Host or file"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Host or file name"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[14px] text-[#202421] outline-none"
                />
                <button
                  type="submit"
                  className="h-11 border-l border-[#E6DAD2] px-3 text-[13px] font-bold text-[#173F35]"
                >
                  Find
                </button>
              </form>
              <div className="bulk-batch-filters mt-2 hidden grid-cols-2 gap-2 sm:grid">
                <label className="min-w-0">
                  <span className="sr-only">Product type</span>
                  <select
                    value={listingType}
                    onChange={(event) => {
                      setListingType(event.target.value);
                      setSelectedBatchId("");
                      setBatchDetail(null);
                    }}
                    className="h-11 w-full min-w-0 border border-[#DED1C8] bg-white px-2 text-[13px] font-semibold text-[#173F35] outline-none"
                  >
                    {LISTING_FILTERS.map(([value, label]) => (
                      <option key={value || "all"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="sr-only">Batch status</span>
                  <select
                    value={batchStatus}
                    onChange={(event) => setBatchStatus(event.target.value)}
                    className="h-11 w-full min-w-0 border border-[#DED1C8] bg-white px-2 text-[13px] font-semibold text-[#173F35] outline-none"
                  >
                    {BATCH_STATUS_FILTERS.map(([value, label]) => (
                      <option key={value || "all"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="bulk-mobile-batch-picker sm:hidden">
              <label htmlFor="bulk-mobile-batch-select" className="sr-only">
                Select Host batch
              </label>
              <select
                id="bulk-mobile-batch-select"
                value={selectedBatchId}
                onChange={(event) => {
                  if (event.target.value) openBatch(event.target.value);
                }}
                disabled={loading || !visibleBatches.length}
              >
                <option value="" disabled>
                  Choose a Host submission
                </option>
                {visibleBatches.map((batch, index) => (
                  <option key={batch.id} value={batch.id}>
                    {index + 1}.{" "}
                    {batch.organization?.displayName || "Host organization"} —{" "}
                    {labelize(batch.status)} ·{" "}
                    {batch.review?.submittedRows ?? "—"} products
                  </option>
                ))}
              </select>
              <details className="bulk-mobile-filters">
                <summary>
                  Search or filter submissions{" "}
                  <SearchIcon size={16} aria-hidden="true" />
                </summary>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearch(searchInput.trim());
                  }}
                  className="flex min-w-0 items-center border border-[#DED1C8] bg-white"
                >
                  <SearchIcon
                    size={17}
                    className="ml-3 shrink-0 text-[#8A7568]"
                    aria-hidden="true"
                  />
                  <input
                    aria-label="Search Host or file name"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Host or file name"
                    className="h-11 min-w-0 flex-1 bg-transparent px-2 text-[14px] text-[#202421] outline-none"
                  />
                  <button
                    type="submit"
                    className="h-11 border-l border-[#E6DAD2] px-3 text-[13px] font-bold text-[#173F35]"
                  >
                    Find
                  </button>
                </form>
                <div className="bulk-batch-filters mt-2 grid grid-cols-2 gap-2">
                  <label className="min-w-0">
                    <span className="sr-only">Product type</span>
                    <select
                      value={listingType}
                      onChange={(event) => {
                        setListingType(event.target.value);
                        setSelectedBatchId("");
                        setBatchDetail(null);
                      }}
                      className="h-11 w-full min-w-0 border border-[#DED1C8] bg-white px-2 text-[13px] font-semibold text-[#173F35] outline-none"
                    >
                      {LISTING_FILTERS.map(([value, label]) => (
                        <option key={value || "all"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Batch status</span>
                    <select
                      value={batchStatus}
                      onChange={(event) => setBatchStatus(event.target.value)}
                      className="h-11 w-full min-w-0 border border-[#DED1C8] bg-white px-2 text-[13px] font-semibold text-[#173F35] outline-none"
                    >
                      {BATCH_STATUS_FILTERS.map(([value, label]) => (
                        <option key={value || "all"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
            </div>
            <div className="bulk-batch-list hidden max-h-[480px] overflow-y-auto border-y border-[#E7DBD1] sm:block lg:max-h-[680px]">
              {loading ? (
                <div
                  role="status"
                  className="flex items-center gap-2 px-5 py-8 text-[15px] text-[#65574D]"
                >
                  <LoaderCircle size={19} className="animate-spin" /> Loading
                  submissions…
                </div>
              ) : visibleBatches.length ? (
                visibleBatches.map((batch) => {
                  const active = batch.id === selectedBatchId;
                  return (
                    <button
                      key={batch.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        openBatch(batch.id);
                        if (window.innerWidth < 1024)
                          window.setTimeout(
                            () =>
                              reviewDeskRef.current?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              }),
                            120
                          );
                      }}
                      className={`focus-ring flex w-full items-start gap-3 border-b border-[#E9DED5] px-4 py-4 text-left transition-colors last:border-b-0 sm:px-5 ${
                        active
                          ? "border-l-[3px] border-l-[#C86C42] bg-[#173F35] text-white"
                          : "bg-[#FFFDFB] text-[#173F35] hover:bg-[#F6E9DF]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center ${
                          active
                            ? "bg-[#E8C1AA] text-[#173F35]"
                            : "bg-[#E9EEE7] text-[#173F35]"
                        }`}
                      >
                        <Layers3 size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-5">
                          {batch.organization?.displayName ||
                            "Host organization"}
                        </span>
                        <span
                          className={`mt-1 block truncate text-[12px] ${
                            active ? "text-[#E2EDE5]" : "text-[#6B756B]"
                          }`}
                        >
                          {batch.sourceFileName || "Submitted batch"}
                        </span>
                        <span
                          className={`mt-2 flex flex-wrap items-center gap-2 text-[12px] font-semibold ${
                            active ? "text-[#E2EDE5]" : "text-[#6B756B]"
                          }`}
                        >
                          <span>
                            {batch.review?.submittedRows || 0} products
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{labelize(batch.status)}</span>
                        </span>
                      </span>
                      <ChevronRight
                        size={19}
                        className={`mt-2 shrink-0 ${
                          active ? "text-[#E7CAB6]" : "text-[#64776A]"
                        }`}
                      />
                    </button>
                  );
                })
              ) : (
                <div className="px-5 py-7 text-[14px] text-[#6D5D51]">
                  No Host batches match the current filters.
                </div>
              )}
            </div>
            {Number(pagination?.page || 1) < Number(pagination?.pages || 0) ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMoreBatches}
                className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 border-b border-[#D4DFD6] bg-[#E0E9DF] px-4 text-[14px] font-bold text-[#173F35] disabled:opacity-50"
              >
                {loadingMore ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : null}{" "}
                Load more submissions ({batches.length} of {pagination?.total})
              </button>
            ) : null}
            <div className="hidden px-4 py-3 text-[12px] leading-5 text-[#76695F] sm:block">
              {pagination?.total > batches.length
                ? "Load more to browse remaining submissions."
                : `${batches.length} submissions available in this view.`}
            </div>
          </aside>

          <main
            ref={reviewDeskRef}
            aria-label="Selected batch review"
            className="min-w-0 bg-white"
          >
            {loadingBatch ? (
              <div
                role="status"
                className="flex items-center gap-3 px-5 py-12 text-[16px] text-[#6D5D51]"
              >
                <LoaderCircle size={22} className="animate-spin" /> Opening
                batch…
              </div>
            ) : batchDetail?.batch ? (
              <>
                <header className="bulk-batch-detail-header border-b border-[#D0DED0] bg-[#E4ECE3] px-4 py-5 sm:px-7 sm:py-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#416D58]">
                        02 / Inspect batch
                      </p>
                      <h3 className="mt-1 text-[23px] font-bold leading-tight tracking-[-0.025em] text-[#173F35] sm:text-[28px]">
                        {batchDetail.batch.organization?.displayName ||
                          "Host organization"}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#426452]">
                        <span className="border border-[#C9D8CA] bg-white px-2.5 py-1">
                          {labelize(batchDetail.batch.status)}
                        </span>
                        <span>{labelize(batchDetail.batch.listingType)}</span>
                      </div>
                      <p className="mt-2 break-words text-[13px] text-[#607568]">
                        {batchDetail.batch.sourceFileName || "Submitted file"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBatchReport(
                          batchDetail.batch,
                          batchDetail.drafts || []
                        )
                      }
                      className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start border border-[#BCD0BF] bg-white px-4 text-[13px] font-bold text-[#173F35] hover:bg-[#F3F8F3]"
                    >
                      <Download size={16} /> Review report
                    </button>
                  </div>
                </header>

                <div className="bulk-batch-summary grid grid-cols-2 border-b border-[#EAE0D8] sm:grid-cols-4">
                  {[
                    [batchDetail.batch.review?.submittedRows || 0, "Products"],
                    [
                      batchDetail.batch.review?.reviewReady || 0,
                      "Review-ready",
                    ],
                    [
                      (batchDetail.batch.review?.validationIssues || 0) +
                        (batchDetail.batch.review?.needsEvidence || 0),
                      "Needs attention",
                    ],
                    [
                      batchDetail.batch.review?.potentialDuplicates || 0,
                      "Possible duplicates",
                    ],
                  ].map(([value, label], index) => (
                    <div
                      key={label}
                      className={`bulk-batch-stat px-4 py-3 sm:px-6 ${
                        index % 2 ? "border-l border-[#EAE0D8]" : ""
                      } ${
                        index > 1 && index % 2 === 0
                          ? "sm:border-l sm:border-[#EAE0D8]"
                          : ""
                      } ${
                        index > 1
                          ? "border-t sm:border-t-0 border-[#EAE0D8]"
                          : ""
                      }`}
                    >
                      <div className="text-[25px] font-bold tabular-nums text-[#173F35]">
                        {value}
                      </div>
                      <p className="text-[13px] leading-5 text-[#77695E]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {batchDetail.validationIssues?.length ? (
                  <details className="border-b border-[#E5D9CB] bg-[#F7E8DF] px-4 py-3 sm:px-6">
                    <summary className="cursor-pointer text-[15px] font-bold text-[#704832]">
                      Issues to inspect · {batchDetail.validationIssues.length}
                    </summary>
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                      {batchDetail.validationIssues.map((item, i) => (
                        <p
                          key={`${item.rowNumber}-${item.merchantSku}-${i}`}
                          className="text-[13px] leading-5 text-[#624A3B]"
                        >
                          Row {item.rowNumber} ·{" "}
                          {item.merchantSku || item.productName || "Product"}:{" "}
                          {(item.issues || []).join("; ")}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}

                <section className="bulk-products-section min-w-0 bg-white px-4 pb-5 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
                  <div className="bulk-products-header flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#99553C]">
                        03 / Review products
                      </p>
                      <h3 className="mt-1 text-[23px] font-bold text-[#173F35]">
                        Products in this batch
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={selectCleanRows}
                      disabled={
                        !batchDetail.drafts?.some(
                          (draft) => draft.bulkReviewEligible
                        )
                      }
                      className="bulk-select-clean-button focus-ring min-h-10 border border-[#C9D9CB] bg-[#F1F5EF] px-3 text-[13px] font-bold text-[#173F35] hover:bg-[#E4EDE2] disabled:opacity-40"
                    >
                      Select all clean products
                    </button>
                  </div>
                  <div
                    className="bulk-row-filters mt-4 flex gap-2 overflow-x-auto pb-2"
                    role="group"
                    aria-label="Filter products by review state"
                  >
                    {ROW_FILTERS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRowFilter(value)}
                        aria-pressed={rowFilter === value}
                        className={`focus-ring min-h-10 shrink-0 border px-3 text-[13px] font-semibold ${
                          rowFilter === value
                            ? "border-[#173F35] bg-[#173F35] text-white"
                            : "border-[#E7D8CE] bg-white text-[#5C4F45] hover:bg-[#F9EEE7]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 border-y border-[#E9DFD6]">
                    {filteredDrafts.map((draft) => {
                      const commercialInfo = draft.commercialDraft || {};
                      const terminal = [
                        "approved_for_catalog",
                        "rejected",
                      ].includes(draft.status);
                      return (
                        <article
                          key={draft.id}
                          className="bulk-product-row grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-b border-[#EAE0D8] bg-white px-1 py-4 last:border-b-0 hover:bg-[#F2F6F1] sm:grid-cols-[auto_minmax(0,1fr)_minmax(130px,0.45fr)_auto] sm:items-center sm:px-3"
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${candidateTitle(
                              draft
                            )} for bulk decision`}
                            disabled={terminal}
                            checked={selectedDraftIds.includes(draft.id)}
                            onChange={() => toggleDraftSelection(draft.id)}
                            className="bulk-product-checkbox mt-1 h-[18px] w-[18px] shrink-0 accent-[#173F35] disabled:opacity-40"
                          />
                          <div className="bulk-product-copy min-w-0">
                            <h4 className="text-[15px] font-bold leading-5 text-[#173F35] sm:text-[16px]">
                              {candidateTitle(draft)}
                            </h4>
                            <p className="mt-1 break-words text-[12px] leading-5 text-[#77695E]">
                              Row {draft.bulkRowNumber || "—"} ·{" "}
                              {draft.merchantSku || "No SKU"}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-semibold text-[#6D5D51]">
                              <span>{labelize(draft.status)}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {draft.commercializationStatus === "live"
                                  ? "Customer live"
                                  : labelize(
                                      draft.commercializationStatus || "pending"
                                    )}
                              </span>
                            </div>
                            {draft.duplicateCandidateProductVersionId ||
                            draft.bulkReviewBlockers?.length ? (
                              <>
                                <p
                                  className={`mt-1.5 text-[12px] font-semibold leading-4 text-[#985A3E] ${
                                    terminal ? "hidden sm:block" : ""
                                  }`}
                                >
                                  {draft.duplicateCandidateProductVersionId
                                    ? "Possible duplicate — individual review"
                                    : (draft.bulkReviewBlockers || []).join(
                                        " · "
                                      )}
                                </p>
                                {terminal ? (
                                  <details className="mt-1.5 text-[12px] text-[#755B49] sm:hidden">
                                    <summary className="cursor-pointer font-semibold">
                                      Review notes
                                    </summary>
                                    <p className="mt-1 break-words leading-5">
                                      {draft.duplicateCandidateProductVersionId
                                        ? "Possible duplicate — individual review"
                                        : (draft.bulkReviewBlockers || []).join(
                                            " · "
                                          )}
                                    </p>
                                  </details>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                          <div className="bulk-product-commercial col-start-2 text-[12px] font-semibold text-[#5F4C41] sm:col-auto sm:text-[13px]">
                            <span className="block">
                              {moneyFromMinor(
                                commercialInfo.salePriceMinor ??
                                  commercialInfo.listPriceMinor,
                                commercialInfo.currency
                              )}
                            </span>
                            <span className="mt-1 block text-[#77695E]">
                              Stock {commercialInfo.availableQuantity ?? "—"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openDraft(draft.id)}
                            className="bulk-product-action focus-ring col-start-3 row-span-2 inline-flex min-h-10 items-center gap-1 self-center border border-[#C5D8C9] bg-[#E6EFE6] px-3 text-[13px] font-bold text-[#173F35] hover:bg-[#D5E5D7] sm:col-auto sm:row-auto"
                          >
                            Review <ArrowRight size={15} />
                          </button>
                        </article>
                      );
                    })}
                    {!filteredDrafts.length ? (
                      <div className="px-4 py-8 text-[15px] text-[#77695E]">
                        No products match this filter.
                      </div>
                    ) : null}
                  </div>
                </section>

                {canCatalogMutate || canTrustSafetyMutate ? (
                  <section
                    aria-label="Apply bulk decision"
                    className="bulk-decision-section border-t-[3px] border-[#C86C42] bg-[#EFD7C8] px-4 py-5 sm:px-6 sm:py-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#995A3B]">
                          04 / Record decision
                        </p>
                        <h3 className="mt-1 text-[21px] font-bold text-[#173F35]">
                          Selected products{" "}
                          <span className="tabular-nums">
                            ({selectedDraftIds.length})
                          </span>
                        </h3>
                      </div>
                      <span className="bulk-decision-hint text-[12px] font-medium text-[#6B5D52]">
                        Only eligible products can be bulk-approved
                      </span>
                    </div>
                    <label
                      className="mt-4 block text-[13px] font-bold text-[#4E483F]"
                      htmlFor="bulk-review-reason"
                    >
                      Reason for this decision
                    </label>
                    <textarea
                      id="bulk-review-reason"
                      rows={2}
                      maxLength={2000}
                      value={bulkReason}
                      onChange={(event) => setBulkReason(event.target.value)}
                      placeholder="Record the reason for this batch decision"
                      className="mt-1.5 w-full border border-[#D7B9A7] bg-white px-3 py-3 text-[15px] text-[#202421] outline-none focus:border-[#173F35]"
                    />
                    <div className="bulk-decision-actions mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          bulkSubmitting ||
                          !selectedDraftIds.length ||
                          !canCatalogMutate
                        }
                        onClick={() =>
                          submitBulkDecision("approve_for_catalog")
                        }
                        className="focus-ring min-h-11 bg-[#173F35] px-4 text-[14px] font-bold text-white hover:bg-[#0E3027] disabled:opacity-40"
                      >
                        Approve selected
                      </button>
                      <button
                        type="button"
                        disabled={bulkSubmitting || !selectedDraftIds.length}
                        onClick={() =>
                          submitBulkDecision("request_more_evidence")
                        }
                        className="focus-ring min-h-11 border border-[#D5B99B] bg-[#FFF9F2] px-4 text-[14px] font-bold text-[#724B35] hover:bg-white disabled:opacity-40"
                      >
                        Ask for information
                      </button>
                      <button
                        type="button"
                        disabled={bulkSubmitting || !selectedDraftIds.length}
                        onClick={() => submitBulkDecision("reject")}
                        className="focus-ring min-h-11 border border-red-200 bg-white px-4 text-[14px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Reject selected
                      </button>
                    </div>
                    {bulkNotice ? (
                      <p
                        role="status"
                        className="mt-3 border border-[#D9CFC2] bg-white px-3 py-3 text-[13px] font-semibold leading-5 text-[#173F35]"
                      >
                        {bulkNotice}
                      </p>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : (
              <div className="px-5 py-8 sm:px-7 sm:py-11">
                <div className="border-l-[3px] border-[#173F35] pl-4">
                  <h3 className="text-[19px] font-bold text-[#173F35]">
                    No batch selected
                  </h3>
                  <p className="mt-1 text-[14px] leading-6 text-[#6D5D51]">
                    Choose a Host submission to review its products.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </section>

      {selectedDraft || loadingDraft ? (
        <div className="bulk-review-dialog fixed inset-0 z-[200] flex items-center justify-center bg-[#10251E]/70 backdrop-blur-[3px] sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-product-review-title"
            className="flex h-[100dvh] w-full max-w-[1220px] flex-col overflow-hidden bg-[#F7F6F2] shadow-2xl sm:h-[92dvh] sm:max-h-[960px] sm:rounded-[18px]"
          >
            <header className="z-[205] shrink-0 border-b border-[#315E4D] bg-[#173F35] px-5 py-4 text-white sm:px-8 sm:py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.055em] text-[#D5E5D8]">
                    Product review / Host submission
                  </p>
                  <h2
                    id="bulk-product-review-title"
                    className="mt-1 break-words text-[24px] font-bold leading-tight tracking-[-0.025em] text-white sm:text-[30px]"
                  >
                    {detailDraft
                      ? candidateTitle(detailDraft)
                      : "Loading product..."}
                  </h2>
                  {detailDraft ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#DCE8DF]">
                      <span>Row #{detailDraft.bulkRowNumber || "—"}</span>
                      <span className="hidden h-1 w-1 rounded-full bg-[#AEC5B3] sm:inline-block" />
                      <span className="break-all">
                        SKU {detailDraft.merchantSku || "—"}
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeDraftReview}
                  aria-label="Close product review"
                  className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <X size={20} />
                </button>
              </div>
              {detailDraft && reviewableFields.length ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/20 pt-3">
                  <span className="text-[13px] font-semibold text-white">
                    {checkedFieldCount} of {reviewableFields.length} details
                    checked
                  </span>
                  <div
                    className="h-[5px] min-w-[100px] max-w-[260px] flex-1 overflow-hidden rounded-full bg-white/20"
                    role="progressbar"
                    aria-label="Product details reviewed"
                    aria-valuenow={checkedFieldCount}
                    aria-valuemin={0}
                    aria-valuemax={reviewableFields.length}
                  >
                    <div
                      className="h-full rounded-full bg-[#E6C0AA] transition-all"
                      style={{
                        width: `${
                          (checkedFieldCount / reviewableFields.length) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-[#D8E6DB]">
                    Check details, then record your decision
                  </span>
                </div>
              ) : null}
            </header>

            {loadingDraft ? (
              <div
                role="status"
                className="grid flex-1 place-items-center gap-3 p-8 text-[15px] text-[#173F35]"
              >
                <LoaderCircle size={30} className="animate-spin" />
                Loading product review…
              </div>
            ) : detailDraft ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {detailDraft.duplicateCandidateProductVersionId ? (
                  <div
                    role="alert"
                    className="flex gap-3 border-b border-[#E9CFB9] bg-[#FFF0E4] px-5 py-3 text-[#814A32] sm:px-8"
                  >
                    <ShieldAlert size={20} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold">
                        Possible duplicate — compare before approving
                      </p>
                      <p className="mt-1 break-all text-[12px]">
                        Existing product version:{" "}
                        {detailDraft.duplicateCandidateProductVersionId}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <main className="min-w-0 bg-[#FFFDFB] px-5 py-5 sm:px-8 sm:py-7">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9DED7] pb-4">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.055em] text-[#8F5940]">
                          01 / Verify
                        </p>
                        <h3 className="mt-1 text-[23px] font-bold tracking-[-0.025em] text-[#173F35]">
                          Check product details
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={acceptAllVisibleFields}
                        disabled={!canCatalogMutate || singleSubmitting}
                        className="focus-ring min-h-11 border border-[#173F35] bg-[#173F35] px-4 text-[13px] font-bold text-white hover:bg-[#0F3027] disabled:opacity-40"
                      >
                        <BadgeCheck size={16} className="mr-1.5 inline" /> Mark
                        all correct
                      </button>
                    </div>

                    {identityFields.length ? (
                      <section
                        aria-label="Identity and packaging review"
                        className="mt-5"
                      >
                        <div className="flex items-baseline justify-between gap-3 bg-[#EEF1EA] px-4 py-3">
                          <h4 className="text-[17px] font-bold text-[#173F35]">
                            Identity & packaging
                          </h4>
                          <span className="text-[12px] font-semibold tabular-nums text-[#5D6A60]">
                            {identityFields.length} details
                          </span>
                        </div>
                        <div className="px-1 sm:px-3">
                          {identityFields.map(renderReviewField)}
                        </div>
                      </section>
                    ) : null}

                    {safetyFields.length ? (
                      <section
                        aria-label="Food safety and claims review"
                        className="mt-6"
                      >
                        <div className="flex items-baseline justify-between gap-3 border-l-[3px] border-[#B76B4A] bg-[#F8EEE7] px-4 py-3">
                          <h4 className="text-[17px] font-bold text-[#173F35]">
                            Food safety & claims
                          </h4>
                          <span className="text-[12px] font-semibold tabular-nums text-[#8A5843]">
                            {safetyFields.length} details
                          </span>
                        </div>
                        <div className="px-1 sm:px-3">
                          {safetyFields.map(renderReviewField)}
                        </div>
                      </section>
                    ) : null}
                    {!reviewableFields.length ? (
                      <p className="mt-5 text-[14px] text-[#68766D]">
                        No product details are available for verification.
                      </p>
                    ) : null}
                  </main>

                  <aside className="min-w-0 border-t border-[#E0E2DB] bg-[#F4F3EE] px-5 py-5 sm:px-8 sm:py-7 xl:border-l xl:border-t-0 xl:px-5">
                    <section
                      aria-label="Selling information"
                      className="border border-[#DDE1DA] bg-white"
                    >
                      <div className="border-b border-[#DDE1DA] px-4 py-4">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7A665A]">
                          02 / Host information
                        </p>
                        <h3 className="mt-1 text-[19px] font-bold text-[#173F35]">
                          Selling details
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`px-2.5 py-1 text-[12px] font-bold ${commerceStatusClasses(
                              detailDraft.commercializationStatus
                            )}`}
                          >
                            {detailDraft.commercializationStatus === "live"
                              ? "Customer live"
                              : labelize(
                                  detailDraft.commercializationStatus ||
                                    "pending"
                                )}
                          </span>
                          {detailDraft.marketplaceOfferId ? (
                            <span className="bg-[#E9EFE7] px-2.5 py-1 text-[12px] font-semibold text-[#173F35]">
                              Offer created
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {detailDraft.commercializationError ? (
                        <p
                          role="alert"
                          className="m-4 bg-[#FFF1E7] p-3 text-[13px] leading-5 text-[#8A4934]"
                        >
                          {detailDraft.commercializationError}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-2 gap-px bg-[#E7E9E3]">
                        {[
                          [
                            "Selling price",
                            commercial.salePriceMinor
                              ? moneyFromMinor(
                                  commercial.salePriceMinor,
                                  commercial.currency
                                )
                              : "—",
                          ],
                          [
                            "Regular price",
                            moneyFromMinor(
                              commercial.listPriceMinor,
                              commercial.currency
                            ),
                          ],
                          [
                            "Stock available",
                            commercial.availableQuantity ?? "—",
                          ],
                          ["Delivery area", commercial.serviceAreaName || "—"],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="min-w-0 bg-white px-3 py-3"
                          >
                            <p className="text-[12px] leading-4 text-[#68766D]">
                              {label}
                            </p>
                            <p className="mt-1 break-words text-[16px] font-bold leading-5 text-[#173F35]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <details className="group px-4 py-3">
                        <summary className="cursor-pointer text-[13px] font-bold text-[#173F35] underline-offset-4 hover:underline">
                          View all Host selling details
                        </summary>
                        <dl className="mt-3 space-y-2 border-t border-[#E7E8E3] pt-3">
                          {[
                            [
                              "Host product code",
                              detailDraft.merchantSku || "—",
                            ],
                            [
                              "Stock location",
                              commercial.inventoryNodeName || "—",
                            ],
                            [
                              "Location type",
                              labelize(commercial.inventoryNodeType || "") ||
                                "—",
                            ],
                            [
                              "Location",
                              [
                                commercial.city,
                                commercial.state,
                                commercial.pincode,
                              ]
                                .filter(Boolean)
                                .join(", ") || "—",
                            ],
                            [
                              "Store listing",
                              detailDraft.marketplaceOfferId
                                ? "Created"
                                : "Not created",
                            ],
                            [
                              "Pricing setup",
                              detailDraft.marketplacePriceRuleId
                                ? "Applied"
                                : "Not set",
                            ],
                            [
                              "Stock sync",
                              detailDraft.marketplaceInventorySnapshotId
                                ? "Connected"
                                : "Not connected",
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-[#ECEDE8] pb-2 last:border-b-0"
                            >
                              <dt className="text-[12px] text-[#647269]">
                                {label}
                              </dt>
                              <dd className="max-w-full break-words text-right text-[12px] font-semibold text-[#173F35]">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </section>

                    <section
                      aria-label="Submitted proof"
                      className="mt-5 border border-[#E1C6B5] bg-[#F3E4D9] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-[17px] font-bold text-[#173F35]">
                          <ImageIcon size={18} /> Uploaded proof
                        </h3>
                        <span className="text-[12px] font-semibold text-[#7F5948]">
                          {selectedDraft.evidence?.length || 0} files
                        </span>
                      </div>
                      {(selectedDraft.evidence || []).length ? (
                        <div
                          className={`mt-3 grid gap-2 ${
                            (selectedDraft.evidence || []).length === 1
                              ? "grid-cols-1"
                              : "grid-cols-2"
                          }`}
                        >
                          {(selectedDraft.evidence || []).map((evidence) => (
                            <a
                              key={evidence.id}
                              href={evidence.readUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="focus-ring group min-w-0 overflow-hidden border border-[#E6D2C5] bg-white hover:border-[#B76B4A]"
                            >
                              {evidence.readUrl ? (
                                <img
                                  src={evidence.readUrl}
                                  alt={labelize(evidence.purpose)}
                                  className={`${
                                    (selectedDraft.evidence || []).length === 1
                                      ? "h-56"
                                      : "h-40"
                                  } w-full bg-white object-contain p-2`}
                                />
                              ) : (
                                <div className="grid h-40 place-items-center text-[#85998B]">
                                  <ImageIcon size={28} />
                                </div>
                              )}
                              <p className="truncate border-t border-[#EAE8E2] px-3 py-2 text-[12px] font-semibold text-[#173F35]">
                                {labelize(evidence.purpose)}
                              </p>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-[13px] leading-5 text-[#785B4F]">
                          No readable evidence is attached.
                        </p>
                      )}
                    </section>

                    <details className="mt-5 border border-[#DDE2DA] bg-white px-4 py-4">
                      <summary className="cursor-pointer text-[15px] font-bold text-[#173F35]">
                        Review history & safety notes
                      </summary>
                      <div className="mt-3 space-y-2 border-t border-[#E4E8E1] pt-3 text-[13px] leading-5 text-[#4F6256]">
                        <p>
                          How details were added:{" "}
                          {selectedDraft.extraction?.status
                            ? labelize(selectedDraft.extraction.status)
                            : "Entered by Host"}
                        </p>
                        <p>
                          Safety notes:{" "}
                          {selectedDraft.extraction?.safetyFlags?.length
                            ? selectedDraft.extraction.safetyFlags
                                .map(labelize)
                                .join(", ")
                            : "No safety concerns reported"}
                        </p>
                        <p>
                          Previous decisions:{" "}
                          {selectedDraft.decisions?.length || 0}
                        </p>
                        {(selectedDraft.decisions || [])
                          .slice(0, 4)
                          .map((decision) => (
                            <div
                              key={decision.id}
                              className="border-t border-[#E8EAE5] pt-2"
                            >
                              <p className="font-bold text-[#173F35]">
                                {labelize(decision.decision)}
                              </p>
                              <p className="mt-0.5">
                                {decision.reason || "No reason recorded."}
                              </p>
                            </div>
                          ))}
                      </div>
                    </details>
                  </aside>
                </div>

                {(canCatalogMutate || canTrustSafetyMutate) &&
                !["approved_for_catalog", "rejected"].includes(
                  detailDraft.status
                ) ? (
                  <section
                    aria-label="Record a product decision"
                    className="border-t-[3px] border-[#B76B4A] bg-[#F7EAE1] px-5 py-5 sm:px-8 sm:py-7"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[#955A40]">
                          03 / Decision
                        </p>
                        <h3 className="mt-1 text-[23px] font-bold text-[#173F35]">
                          Record your decision
                        </h3>
                      </div>
                      <span className="text-[12px] text-[#6B655E]">
                        A reason is required (3–2,000 characters)
                      </span>
                    </div>
                    <label
                      htmlFor="single-bulk-review-reason"
                      className="mt-4 block text-[13px] font-bold text-[#173F35]"
                    >
                      Reason for {candidateTitle(detailDraft)}
                    </label>
                    <textarea
                      id="single-bulk-review-reason"
                      maxLength={2000}
                      value={singleReason}
                      onChange={(event) => setSingleReason(event.target.value)}
                      placeholder="Explain why this product is ready, needs more information or should be rejected"
                      rows={3}
                      className="focus-ring mt-2 block min-h-[100px] w-full border border-[#D7BEAE] bg-white p-3 text-[14px] leading-6 text-[#202421] outline-none focus:border-[#173F35]"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={singleSubmitting || !canCatalogMutate}
                        onClick={() =>
                          submitSingleDecision("approve_for_catalog")
                        }
                        className="focus-ring min-h-11 bg-[#173F35] px-5 text-[14px] font-bold text-white hover:bg-[#0F3027] disabled:opacity-40"
                      >
                        <CheckCircle2 size={16} className="mr-1.5 inline" />{" "}
                        Approve for catalog
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() =>
                          submitSingleDecision("request_more_evidence")
                        }
                        className="focus-ring min-h-11 border border-[#D7BEAE] bg-white px-5 text-[14px] font-bold text-[#714A37] hover:bg-[#FFFDFB] disabled:opacity-40"
                      >
                        Request more information
                      </button>
                      <button
                        type="button"
                        disabled={singleSubmitting}
                        onClick={() => submitSingleDecision("reject")}
                        className="focus-ring min-h-11 border border-red-200 bg-white px-5 text-[14px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                      >
                        Reject product
                      </button>
                    </div>
                    {singleNotice ? (
                      <p
                        role="status"
                        className="mt-3 border border-[#E3C7B5] bg-white px-3 py-3 text-[13px] font-medium text-[#173F35]"
                      >
                        {singleNotice}
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <div className="border-t border-[#E3E5DF] bg-white px-5 py-5 sm:px-8">
                    <p className="text-[14px] font-semibold text-[#173F35]">
                      Current decision:{" "}
                      <span className={statusClasses(detailDraft.status)}>
                        {labelize(detailDraft.status)}
                      </span>
                    </p>
                    {singleNotice ? (
                      <p
                        role="status"
                        className="mt-2 text-[13px] text-[#173F35]"
                      >
                        {singleNotice}
                      </p>
                    ) : null}
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
