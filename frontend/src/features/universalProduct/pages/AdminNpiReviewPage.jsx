import {
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  FileSearch,
  Image as ImageIcon,
  Search,
  ArrowRight,
  LoaderCircle,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link } from "react-router-dom";

import AdminShell from "../../admin/components/AdminShell";

import { useAdmin } from "../../admin/context/AdminContext";

import {
  getAdminNpiDraft,
  getUniversalProductErrorMessage,
  listAdminNpiReviewQueue,
  materializeAdminNpiDraftToCatalog,
  reviewAdminNpiDraft,
} from "../services/universalProduct.service";

const STATUS_OPTIONS = [
  "",
  "provisional",
  "ready_for_review",
  "needs_more_evidence",
  "approved_for_catalog",
  "rejected",
];

const SAFETY_FIELDS = new Set([
  "ingredientDeclarationText",
  "allergens",
  "nutrition",
  "claims",
  "certifications",
]);


const REVIEW_FIELD_LABELS = {
  displayName: "Product name",
  brandName: "Brand",
  gtin: "Barcode number",
  netQuantity: "Pack size",
  ingredientDeclarationText: "Ingredients list",
  allergens: "Allergen information",
  nutrition: "Nutrition information",
  manufacturerName: "Manufacturer",
  countryOfOrigin: "Country of origin",
  claims: "Product claims",
  certifications: "Certifications",
};

const REVIEW_SOURCE_LABELS = {
  host_npi: "Submitted by Host",
  host_manual: "Entered by Host",
  ai_extraction: "Read from product evidence",
  open_food_facts: "Open Food Facts",
  customer_submission: "Customer submission",
  barcode_lookup: "Barcode lookup",
  manual: "Manual entry",
};

function reviewFieldLabel(fieldPath) {
  return REVIEW_FIELD_LABELS[fieldPath] || labelize(fieldPath);
}

function reviewSourceLabel(source) {
  const key = String(source || "").trim();
  return REVIEW_SOURCE_LABELS[key] || (key ? labelize(key) : "Source not available");
}

function readableAllergens(value) {
  if (!value || typeof value !== "object") {
    return printable(value);
  }

  const parts = [];
  if (value.statement) {
    parts.push(String(value.statement));
  }

  if (Array.isArray(value.items) && value.items.length) {
    const items = value.items
      .map((item) => {
        if (!item?.name) return null;
        const relation = String(item.relationType || "").toLowerCase();
        if (relation === "contains") return `Contains ${item.name}`;
        if (relation === "may_contain") return `May contain ${item.name}`;
        return item.name;
      })
      .filter(Boolean);

    if (items.length) {
      parts.push(items.join(", "));
    }
  }

  return parts.length ? parts.join("\n") : "No allergen information declared.";
}

function readableNutrition(value) {
  if (!value || typeof value !== "object") {
    return printable(value);
  }

  const lines = [];
  if (value.basis) {
    lines.push(`Basis: ${labelize(value.basis)}`);
  }
  if (value.servingSize) {
    lines.push(`Serving size: ${quantityLabel(value.servingSize)}`);
  }
  if (Array.isArray(value.nutrients)) {
    value.nutrients.forEach((item) => {
      if (!item?.name) return;
      const amount = item.amount ?? "—";
      const unit = item.unit || "";
      lines.push(`${labelize(item.name)}: ${amount} ${unit}`.trim());
    });
  }

  return lines.length ? lines.join("\n") : "Nutrition information not declared.";
}

function readableLabels(value, emptyLabel) {
  if (!Array.isArray(value)) {
    return printable(value);
  }

  const labels = value
    .map((item) => {
      if (typeof item === "string") return item;
      return item?.label || item?.name || null;
    })
    .filter(Boolean);

  return labels.length ? labels.join(", ") : emptyLabel;
}

function reviewFieldValue(fieldPath, value) {
  switch (fieldPath) {
    case "netQuantity":
      return quantityLabel(value);
    case "allergens":
      return readableAllergens(value);
    case "nutrition":
      return readableNutrition(value);
    case "claims":
      return readableLabels(value, "No product claims declared.");
    case "certifications":
      return readableLabels(value, "No certifications declared.");
    default:
      return printable(value);
  }
}

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(status) {
  switch (status) {
    case "provisional":
      return "Not ready";
    case "ready_for_review":
      return "Ready for review";
    case "needs_more_evidence":
      return "More proof needed";
    case "approved_for_catalog":
      return "Approved for Catalog";
    case "rejected":
      return "Rejected";
    default:
      return "Open reviews";
  }
}

function evidenceFileTypeLabel(mimeType) {
  const value = String(mimeType || "").toLowerCase();
  if (value.startsWith("image/")) return "Image";
  if (value === "application/pdf") return "PDF document";
  if (value.includes("spreadsheet") || value.includes("excel")) return "Spreadsheet";
  if (value.includes("json")) return "Data file";
  return "File";
}

function statusClasses(status) {
  switch (status) {
    case "approved_for_catalog":
      return "bg-emerald-100 text-emerald-900";

    case "ready_for_review":
      return "bg-blue-100 text-blue-900";

    case "needs_more_evidence":
      return "bg-orange-100 text-orange-900";

    case "rejected":
      return "bg-red-100 text-red-800";

    default:
      return "bg-stone-200 text-stone-700";
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

function candidateTitle(draft) {
  const value = draft?.candidateFields?.displayName?.value;

  return String(value || draft?.barcode || "Product awaiting review");
}

function candidateValue(draft, fieldPath) {
  return draft?.candidateFields?.[fieldPath]?.value ?? null;
}

function quantityLabel(value) {
  if (!value) {
    return "Not declared";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value.rawText) {
    return String(value.rawText);
  }

  if (value.value !== null && value.value !== undefined) {
    return `${value.value} ${value.unit || ""}`.trim();
  }

  return "Not declared";
}

function AdminProductDetailsSheet({ draft }) {
  const nutrition = candidateValue(draft, "nutrition");
  const allergens = candidateValue(draft, "allergens");
  const claims = candidateValue(draft, "claims");
  const certifications = candidateValue(draft, "certifications");

  const nutrientRows = Array.isArray(nutrition?.nutrients)
    ? nutrition.nutrients
    : [];

  const allergenRows = Array.isArray(allergens?.items)
    ? allergens.items
    : [];

  const claimRows = Array.isArray(claims) ? claims : [];
  const certificationRows = Array.isArray(certifications) ? certifications : [];

  const detailRows = [
    ["Product type", labelize(draft?.listingType || "packaged")],
    ["Market", draft?.market || "Not declared"],
    ["Brand / grower", candidateValue(draft, "brandName") || "Not declared"],
    ["Barcode", candidateValue(draft, "gtin") || draft?.barcode || "Not declared"],
    ["Pack size", quantityLabel(candidateValue(draft, "netQuantity"))],
    ["Country of origin", candidateValue(draft, "countryOfOrigin") || "Not declared"],
    ["Maker / supplier", candidateValue(draft, "manufacturerName") || "Not declared"],
  ];

  const ingredientDeclaration =
    candidateValue(draft, "ingredientDeclarationText") || "";

  return (
    <div className="space-y-3">
        <dl className="space-y-1.5">
          {detailRows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[minmax(0,98px)_minmax(0,1fr)] gap-2 text-[13px] leading-5 sm:grid-cols-[108px_minmax(0,1fr)]"
            >
              <dt className="font-bold text-stone-400">{label}</dt>
              <dd className="break-words font-bold text-stone-800">{value}</dd>
            </div>
          ))}
        </dl>

        {ingredientDeclaration ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[13px] font-bold text-stone-400">
              Ingredients
            </p>
            <p className="mt-1 text-[13px] font-medium leading-4 text-stone-700">
              {ingredientDeclaration}
            </p>
          </div>
        ) : null}

        {allergens?.statement || allergenRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[13px] font-bold text-stone-400">
              Allergens
            </p>
            {allergens?.statement ? (
              <p className="mt-1 text-[13px] font-medium leading-4 text-stone-700">
                {allergens.statement}
              </p>
            ) : null}
            {allergenRows.length ? (
              <p className="mt-1 text-[13px] font-medium leading-4 text-stone-700">
                {allergenRows
                  .map((item) => `${item.name} (${labelize(item.relationType)})`)
                  .join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {nutrientRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-stone-400">
                Nutrition
              </p>
              <span className="text-[13px] font-bold text-emerald-700">
                {labelize(nutrition?.basis || "nutrition basis")}
                {nutrition?.servingSize
                  ? ` · ${quantityLabel(nutrition.servingSize)}`
                  : ""}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
              {nutrientRows.map((item, index) => (
                <div
                  key={`${item.name || "nutrient"}-${index}`}
                  className="flex items-center justify-between gap-2 border-b border-stone-100 py-1 text-[13px]"
                >
                  <span className="font-bold text-stone-500">
                    {labelize(item.name)}
                  </span>
                  <span className="font-bold text-stone-900">
                    {item.amount} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {claimRows.length || certificationRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[13px] font-bold text-stone-400">
              Claims and certifications
            </p>
            <p className="mt-1 text-[13px] font-medium leading-4 text-stone-700">
              {[...claimRows, ...certificationRows]
                .map((item) => item?.label)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ) : null}
    </div>
  );
}


function FieldReviewRows({ fields, fieldStates, setFieldStates, allowedFieldForMutation, submitting }) {
  const [expandedField, setExpandedField] = useState(fields[0]?.[0] || null);

  if (!fields.length) return <p className="py-5 text-[15px] text-[#647367]">No information was submitted in this group.</p>;
  return (
    <div className="grid min-w-0 gap-x-6 md:grid-cols-2">
      {fields.map(([fieldPath, item]) => {
        const mutable = allowedFieldForMutation(fieldPath);
        const safety = SAFETY_FIELDS.has(fieldPath);
        const decision = fieldStates[fieldPath] || "pending_review";
        const expanded = expandedField === fieldPath;
        const decisionText = decision === "accepted" ? "Accepted" : decision === "rejected" ? "Rejected" : decision === "needs_evidence" ? "Proof needed" : "Unchecked";
        const statusStyle = decision === "accepted" ? "bg-[#DEEEE2] text-[#17543A]" : decision === "rejected" ? "bg-red-100 text-red-800" : decision === "needs_evidence" ? "bg-[#F9E8D8] text-[#8F5639]" : "bg-[#F0F1ED] text-[#5C6A60]";
        return (
          <div key={fieldPath} className={`min-w-0 border-b border-[#DCE3D9] sm:py-5 ${["nutrition", "ingredientDeclarationText", "allergens"].includes(fieldPath) ? "md:col-span-2" : ""}`}>
            <button type="button" onClick={() => setExpandedField(expanded ? null : fieldPath)} aria-expanded={expanded} className="flex min-h-[75px] w-full items-center gap-2 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#173F35] sm:hidden">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-5 text-[#173F35]">{reviewFieldLabel(fieldPath)}</span>
                <span className="mt-1 block truncate text-[13px] leading-5 text-[#647468]">{reviewFieldValue(fieldPath, item?.value).split("\n")[0]}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${statusStyle}`}>{decisionText}</span>
              <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-[#52745C] transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
            </button>
            <div className="hidden flex-wrap items-start justify-between gap-2 sm:flex">
              <div className="flex min-w-0 items-center gap-2">
                <h5 className="text-[16px] font-bold leading-snug text-[#193F35]">{reviewFieldLabel(fieldPath)}</h5>
                {safety ? <ShieldCheck size={16} className="shrink-0 text-[#9A684D]" aria-label="Safety information" /> : null}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusStyle}`}>{decisionText}</span>
            </div>
            <div className={`${expanded ? "block" : "hidden"} min-w-0 pb-4 sm:block sm:pb-0`}>
              <div className="whitespace-pre-line break-words bg-[#F5F7F2] px-3 py-3 text-[15px] leading-[1.55] text-[#35483C] sm:mt-2 sm:bg-transparent sm:p-0">{reviewFieldValue(fieldPath, item?.value)}</div>
              <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
                <p className="max-w-full text-[13px] leading-5 text-[#69796C]">
                  {reviewSourceLabel(item?.source)}
                  {Number.isFinite(Number(item?.confidence)) ? ` · ${Math.round(Number(item.confidence) * 100)}% match` : ""}
                </p>
                <label className="w-full min-w-0 sm:w-auto sm:min-w-[150px] sm:flex-1 sm:max-w-[194px]">
                  <span className="sr-only">Verification decision for {reviewFieldLabel(fieldPath)}</span>
                  <select
                    value={decision}
                    disabled={!mutable || submitting}
                    onChange={(event) => setFieldStates((current) => ({ ...current, [fieldPath]: event.target.value }))}
                    className="min-h-11 w-full rounded-lg border border-[#C6D4C8] bg-white px-3 text-[14px] font-semibold text-[#173F35] outline-none focus:border-[#173F35] focus:ring-2 focus:ring-[#E5F1E8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="pending_review">Not reviewed</option>
                    <option value="accepted">Accept</option>
                    <option value="needs_evidence">Ask for proof</option>
                    <option value="rejected">Reject</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminNpiReviewPage() {
  const { hasAdminPermission } = useAdmin();

  const canCatalogMutate = hasAdminPermission("catalog.mutate");

  const canTrustSafetyMutate = hasAdminPermission("trust_safety.mutate");

  const [status, setStatus] = useState("ready_for_review");

  const [queue, setQueue] = useState([]);

  const [queueSearch, setQueueSearch] = useState("");

  const [mobileQueueExpanded, setMobileQueueExpanded] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);

  const queueRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const reviewRef = useRef(null);

  const [pagination, setPagination] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);

  const [loadingSelected, setLoadingSelected] = useState(false);

  const [fieldStates, setFieldStates] = useState({});

  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [actionNotice, setActionNotice] = useState("");

  const [categoryName, setCategoryName] = useState("");

  const [packType, setPackType] = useState("other");

  const [handoffLoading, setHandoffLoading] = useState(false);

  const loadQueue = useCallback(
    async (background = false) => {
      const requestId = ++queueRequestRef.current;
      if (background) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const result = await listAdminNpiReviewQueue({
          page: 1,
          limit: 25,
          status: status || undefined,
        });
        if (requestId !== queueRequestRef.current) return;
        setQueue(result?.drafts || []);
        setPagination(result?.pagination || null);
        if (!background) {
          const firstDraft = result?.drafts?.[0];
          if (firstDraft?.id) void openDraft(firstDraft.id, false);
        }
      } catch (requestError) {
        if (requestId !== queueRequestRef.current) return;
        setError(getUniversalProductErrorMessage(requestError, "Unable to load product reviews."));
      } finally {
        if (requestId === queueRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [status]
  );

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const filteredQueue = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    if (!query) return queue;
    return queue.filter((draft) =>
      [candidateTitle(draft), draft?.barcode, draft?.candidateFields?.brandName?.value]
        .some((value) => String(value || "").toLowerCase().includes(query))
    );
  }, [queue, queueSearch]);

  const remaining = Math.max(0, Number(pagination?.total || 0) - queue.length);

  async function loadMore() {
    if (loadingMore || loading || refreshing || remaining <= 0) return;
    const requestId = queueRequestRef.current;
    setLoadingMore(true);
    setError("");
    try {
      const result = await listAdminNpiReviewQueue({
        page: Number(pagination?.page || 1) + 1,
        limit: 25,
        status: status || undefined,
      });
      if (requestId !== queueRequestRef.current) return;
      setQueue((current) => {
        const existing = new Set(current.map((draft) => draft.id));
        return [...current, ...(result?.drafts || []).filter((draft) => !existing.has(draft.id))];
      });
      setPagination(result?.pagination || null);
    } catch (requestError) {
      if (requestId !== queueRequestRef.current) return;
      setError(getUniversalProductErrorMessage(requestError, "Unable to load more product reviews."));
    } finally {
      setLoadingMore(false);
    }
  }

  const reviewableFields = useMemo(
    () => Object.entries(selected?.draft?.candidateFields || {}),
    [selected]
  );

  const productFields = reviewableFields.filter(([key]) => !SAFETY_FIELDS.has(key));
  const safetyFields = reviewableFields.filter(([key]) => SAFETY_FIELDS.has(key));
  const checkedCount = reviewableFields.filter(([key]) => fieldStates[key] && fieldStates[key] !== "pending_review").length;
  const proofImage = selected?.evidence?.find((item) => item.readUrl && String(item.mimeType || "").startsWith("image/"));

  async function openDraft(draftId, scrollToReview = true) {
    const requestId = ++detailRequestRef.current;
    setLoadingSelected(true);

    setError("");
    setActionNotice("");

    try {
      const result = await getAdminNpiDraft(draftId);
      if (requestId !== detailRequestRef.current) return;

      setSelected(result);

      setFieldStates(
        Object.fromEntries(
          Object.entries(result?.draft?.candidateFields || {}).map(
            ([key, value]) => [key, value?.reviewState || "pending_review"]
          )
        )
      );

      setReason("");

      setCategoryName("");

      setPackType("other");
      if (scrollToReview && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch (requestError) {
      if (requestId !== detailRequestRef.current) return;
      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to open this product review."
        )
      );
    } finally {
      if (requestId === detailRequestRef.current) setLoadingSelected(false);
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

  function buildHandoffFieldDecisions() {
    return Object.entries(fieldStates)
      .filter(
        ([fieldPath, decision]) =>
          allowedFieldForMutation(fieldPath) && decision === "accepted"
      )
      .map(([fieldPath]) => ({
        fieldPath,
        decision: "accepted",
      }));
  }

  async function submitDecision(decision) {
    const draftId = selected?.draft?.id;

    if (!draftId || submitting) {
      return;
    }

    if (reason.trim().length < 3) {
      setActionNotice("Enter a review reason of at least 3 characters before deciding.");

      return;
    }

    if (decision === "approve_for_catalog" && !canCatalogMutate) {
      setActionNotice(
        "You do not have permission to approve products for the catalog."
      );

      return;
    }

    setSubmitting(true);

    setActionNotice("");

    try {
      const result = await reviewAdminNpiDraft({
        draftId,

        decision,

        fieldDecisions: buildFieldDecisions(),

        reason: reason.trim(),
      });

      setActionNotice(
        decision === "approve_for_catalog"
          ? "Approved for Catalog. The product still needs final catalog approval before it is published."
          : decision === "request_more_evidence"
          ? "Sent back for more proof."
          : "Product review rejected. The decision is saved in the audit history."
      );

      setSelected((current) => ({
        ...current,

        draft: result?.draft || current?.draft,
      }));

      await loadQueue(true);
    } catch (requestError) {
      setActionNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to save this product review decision."
        )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function materializeCatalogDraft() {
    const draftId = selected?.draft?.id;

    if (!draftId || handoffLoading) {
      return;
    }

    if (!categoryName.trim()) {
      setActionNotice(
        "Choose a catalog category before creating the Catalog draft."
      );

      return;
    }

    setHandoffLoading(true);
    setActionNotice("");

    try {
      const result = await materializeAdminNpiDraftToCatalog({
        draftId,
        categoryName: categoryName.trim(),
        packType,
        reason: selected?.draft?.reviewSummary || "",
        fieldDecisions: buildHandoffFieldDecisions(),
      });

      const handoff = result?.handoff;

      setActionNotice(
        handoff?.alreadyMaterialized
          ? `Catalog draft already exists. Reference: ${
              handoff?.packId || "available in Catalog & Listings"
            }.`
          : `Catalog draft created. Reference: ${
              handoff?.packId || "available in Catalog & Listings"
            }.`
      );

      const refreshed = await getAdminNpiDraft(draftId);

      setSelected(refreshed);

      await loadQueue(true);
    } catch (requestError) {
      setActionNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to create the Catalog draft."
        )
      );
    } finally {
      setHandoffLoading(false);
    }
  }

  return (
    <AdminShell
      title="Product Intelligence Review"
      description="Check product information and supporting proof."
      actions={
        <button type="button" disabled={refreshing} onClick={() => loadQueue(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#C9D4CA] bg-white px-4 text-[14px] font-semibold text-[#173F35] hover:bg-[#EFF4EE] disabled:opacity-60">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      <div className="min-w-0 bg-[#F7F6F2] text-[#202421]">
        <section aria-label="Product review status" className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#DCE4DB] bg-[#F1F0E9] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex h-14 min-w-14 items-center justify-center rounded-2xl bg-[#173F35] px-3 text-[29px] font-bold tabular-nums text-white sm:h-16 sm:min-w-16 sm:text-[34px]">{pagination?.total ?? queue.length}</span>
            <div className="min-w-0">
              <h2 className="text-[19px] font-bold leading-tight text-[#173F35] sm:text-[22px]">{statusLabel(status)}</h2>
              <p className="mt-0.5 text-[14px] text-[#66766A]">Product reviews</p>
            </div>
          </div>
          <label className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <span className="text-[14px] font-semibold text-[#4C6454]">Review status</span>
            <select
              value={status}
              onChange={(event) => {
                const nextStatus = event.target.value;
                if (nextStatus !== status) {
                  ++detailRequestRef.current;
                  setSelected(null);
                  setLoadingSelected(false);
                  setQueueSearch("");
                  setStatus(nextStatus);
                }
              }}
              className="min-h-11 w-full min-w-0 rounded-lg border border-[#C4D0C3] sm:w-auto sm:min-w-[188px] sm:max-w-full bg-white px-3 text-[14px] font-semibold text-[#173F35] focus:outline-none focus:ring-2 focus:ring-[#A8C7AF]"
              aria-label="Filter product reviews by status"
            >
              {STATUS_OPTIONS.map((item) => <option key={item || "open"} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>
        </section>

        {error ? <div role="alert" className="mx-4 mt-4 flex gap-3 border-l-4 border-red-500 bg-red-50 p-4 text-[15px] text-red-900 sm:mx-6"><CircleAlert size={19} className="shrink-0" />{error}</div> : null}

        <section aria-label="Product evidence review workspace" className="grid min-w-0 items-start border-b border-[#DCE3D9] lg:grid-cols-[minmax(286px,0.33fr)_minmax(0,1fr)]">
          <aside aria-label="Product review queue" className="min-w-0 border-b border-[#DAE2D9] bg-[#FBFAF6] lg:sticky lg:top-3 lg:border-b-0 lg:border-r">
            <div className="border-b border-[#DCE3DB] bg-[#E8EEE5] px-4 py-3 sm:px-5 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.045em] text-[#69766A]">01 / Select a record</p>
                  <h3 className="mt-1 text-[21px] font-bold leading-tight text-[#173F35] sm:text-[23px]"><span className="sm:hidden">Choose a product</span><span className="hidden sm:inline">Review queue</span></h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[15px] font-bold tabular-nums text-[#173F35]">{pagination?.total ?? queue.length}</span>
              </div>
              <label className="relative mt-3 block sm:mt-4">
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6A806D]" aria-hidden="true" />
                <span className="sr-only">Search products in the loaded review queue</span>
                <input type="search" value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} placeholder="Search name or barcode" className="min-h-11 w-full rounded-lg border border-[#CAD5CB] bg-white pl-10 pr-3 text-[15px] text-[#173F35] outline-none focus:border-[#173F35] focus:ring-2 focus:ring-[#C9E3D1]" />
              </label>
            </div>
            {loading ? <div role="status" className="flex items-center gap-3 p-5 text-[15px] text-[#526A5B]"><LoaderCircle size={18} className="animate-spin" />Loading products…</div> : queue.length === 0 ? <p className="p-5 text-[15px] leading-6 text-[#526A5B]">No products in this status. Try another filter.</p> : filteredQueue.length === 0 ? <p className="p-5 text-[15px] leading-6 text-[#526A5B]">No matching products in the loaded records.</p> : (
              <div className="min-w-0 sm:divide-y sm:divide-[#E3E7DF] lg:max-h-[640px] lg:overflow-y-auto">
                <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-3 py-3 sm:block sm:overflow-visible sm:p-0">
                  {filteredQueue.map((draft, index) => {
                    const chosen = selected?.draft?.id === draft.id;
                    return (
                      <button key={draft.id} type="button" onClick={() => openDraft(draft.id)} aria-pressed={chosen} className={`group flex min-h-[116px] w-[184px] shrink-0 snap-start flex-col justify-between gap-2 border border-[#D9E3D8] border-l-[4px] px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#173F35] sm:min-h-[82px] sm:w-full sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:border-0 sm:border-b sm:border-b-[#E3E7DF] sm:border-l-[4px] sm:px-4 ${!mobileQueueExpanded && index >= 5 && !chosen ? "hidden sm:flex" : "flex"} ${chosen ? "border-l-[#B56845] bg-[#E5EDE5]" : "border-l-transparent bg-white hover:bg-[#F0F3ED]"}`}>
                        <span className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center sm:gap-3">
                          <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-[14px] font-bold sm:h-11 sm:w-11 sm:rounded-lg sm:text-[19px] ${chosen ? "bg-[#173F35] text-white" : "bg-[#E4EAE2] text-[#476653]"}`}>{candidateTitle(draft).trim().charAt(0).toUpperCase() || "P"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block line-clamp-2 break-words text-[14px] font-bold leading-[1.3] text-[#173F35] sm:text-[16px]">{candidateTitle(draft)}</span>
                            <span className="mt-1 hidden flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-[#68776B] sm:flex">
                              <span>{statusLabel(draft.status)}</span>
                              {draft.safetyReviewRequired ? <span className="font-semibold text-[#A45B3E]">Safety check</span> : null}
                            </span>
                          </span>
                        </span>
                        <span className="flex w-full items-center justify-between gap-2 sm:w-auto">
                          <span className="text-[12px] font-semibold text-[#6C786B] sm:hidden">{draft.safetyReviewRequired ? "Safety check" : statusLabel(draft.status)}</span>
                          <ArrowRight aria-hidden="true" size={17} className={`shrink-0 ${chosen ? "text-[#173F35]" : "text-[#769080]"}`} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                {filteredQueue.length > 5 ? (
                  <div className="border-t border-[#E0E9DE] bg-[#F8F9F5] px-3 py-2.5 text-center sm:hidden">
                    <button type="button" onClick={() => setMobileQueueExpanded((open) => !open)} className="min-h-10 rounded-full border border-[#BDCEBF] bg-white px-5 text-[14px] font-semibold text-[#173F35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#173F35]">
                      {mobileQueueExpanded ? "Show fewer" : `View all ${filteredQueue.length} products`}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {remaining > 0 ? <div className="border-t border-[#DDE5DC] p-3 sm:p-4"><button type="button" disabled={loadingMore} onClick={loadMore} className="min-h-11 w-full rounded-lg border border-[#BFCDBE] bg-white px-3 text-[14px] font-semibold text-[#173F35] hover:bg-[#F1F5F0] disabled:opacity-60">{loadingMore ? "Loading more…" : `Load more products (${remaining} remaining)`}</button></div> : null}
            {queueSearch && remaining > 0 ? <p className="px-4 pb-3 text-[13px] text-[#687A6A]">Search covers loaded records. Load more for additional results.</p> : null}
          </aside>

          <div ref={reviewRef} className="min-w-0 scroll-mt-20 bg-[#FFFEFC]">
            {loadingSelected ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-[#173F35]"><LoaderCircle size={23} className="animate-spin" />Opening product…</div> : selected?.draft ? (
              <div className="min-w-0">
                <header className="sm:hidden">
                  <div className="flex items-center justify-between bg-[#173F35] px-4 py-3 text-white">
                    <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-[#E2EBE2]">Product under review</span>
                    <button type="button" onClick={() => setSelected(null)} aria-label="Close product review" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X size={19} /></button>
                  </div>
                  <div className="bg-[#F4F1E9] px-4 pt-5 pb-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="grid h-[152px] w-[124px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#DFE4D9] bg-white p-3 shadow-[0_10px_26px_rgba(24,63,50,0.09)]">
                        {proofImage ? <img src={proofImage.readUrl} alt={`Submitted proof for ${candidateTitle(selected.draft)}`} className="h-full w-full object-contain" /> : <ImageIcon size={44} strokeWidth={1.1} className="text-[#93A99B]" aria-label="Product image not supplied" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pt-1">
                        <span className="rounded-full bg-[#E3EDE1] px-2.5 py-1 text-[12px] font-bold text-[#173F35]">{statusLabel(selected.draft.status)}</span>
                        {selected.draft.verificationStatus ? <span className="text-[12px] font-semibold text-[#68766B]">{labelize(selected.draft.verificationStatus)}</span> : null}
                        <p className="break-words text-[14px] font-semibold leading-5 text-[#173F35]">{candidateValue(selected.draft, "brandName") || "Brand not declared"}</p>
                        <p className="text-[12px] font-medium text-[#66766A]">{selected.draft.market || "IN"}</p>
                      </div>
                    </div>
                    <h2 className="mt-4 break-words text-[26px] font-bold leading-[1.13] tracking-[-0.035em] text-[#173F35]">{candidateTitle(selected.draft)}</h2>
                    <p className="mt-2 break-all text-[13px] leading-5 text-[#617366]">Barcode: {selected.draft.barcode || "Not supplied"}</p>
                  </div>
                  <div className="border-t border-[#C8D8C8] bg-[#E7EFE5] px-4 py-3">
                    <div className="flex items-center justify-between gap-2 text-[13px] font-semibold text-[#476653]">
                      <span>Verification progress</span><span className="tabular-nums text-[#173F35]">{checkedCount} / {reviewableFields.length}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#CBDBCC]" role="progressbar" aria-label="Product fields reviewed" aria-valuenow={checkedCount} aria-valuemin={0} aria-valuemax={reviewableFields.length}>
                      <div className="h-full rounded-full bg-[#173F35] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${reviewableFields.length ? checkedCount / reviewableFields.length * 100 : 0}%` }} />
                    </div>
                  </div>
                </header>
                <header className="relative hidden bg-[#173F35] px-4 py-5 text-white sm:block sm:px-7 sm:py-7">
                  <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:flex-nowrap sm:gap-6">
                    <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#F6F3E9] p-2 sm:h-36 sm:w-36 sm:rounded-2xl sm:p-3">
                      {proofImage ? <img src={proofImage.readUrl} alt={`Submitted proof for ${candidateTitle(selected.draft)}`} className="h-full w-full object-contain" /> : <ImageIcon size={42} strokeWidth={1.2} className="text-[#93A99B]" aria-label="Product image not supplied" />}
                    </div>
                    <div className="w-full min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 pr-12 sm:pr-0">
                        <span className="rounded-full bg-[#E7EDE5] px-3 py-1 text-[12px] font-bold text-[#173F35]">{statusLabel(selected.draft.status)}</span>
                        {selected.draft.verificationStatus ? <span className="rounded-full border border-white/30 px-3 py-1 text-[12px] font-semibold text-white">{labelize(selected.draft.verificationStatus)}</span> : null}
                      </div>
                      <h2 className="mt-3 max-w-full break-words text-[24px] font-bold leading-[1.22] tracking-[-0.025em] sm:text-[30px] lg:text-[33px]">{candidateTitle(selected.draft)}</h2>
                      <p className="mt-2 break-words text-[14px] leading-6 text-[#D3E2D8]">{candidateValue(selected.draft, "brandName") || "Brand not declared"} · {selected.draft.market || "IN"} · {selected.draft.barcode || "No barcode"}</p>
                    </div>
                    <button type="button" onClick={() => setSelected(null)} aria-label="Close product review" className="absolute right-4 top-4 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10 sm:static sm:ml-auto"><X size={18} /></button>
                  </div>
                </header>
                <nav aria-label="Review steps" className="flex min-w-0 bg-[#173F35] text-white sm:hidden">
                  <a href="#npi-review-fields" className="flex min-h-14 flex-1 flex-col justify-center border-r border-white/20 px-3 py-2 text-[13px] font-semibold"><span className="text-[11px] text-[#BFD5C6]">01</span>Details</a>
                  <a href="#npi-review-proof" className="flex min-h-14 flex-1 flex-col justify-center border-r border-white/20 px-3 py-2 text-[13px] font-semibold"><span className="text-[11px] text-[#BFD5C6]">02</span>Proof</a>
                  {((selected.draft.status === "approved_for_catalog" && canCatalogMutate) || ((canCatalogMutate || canTrustSafetyMutate) && !["approved_for_catalog", "rejected"].includes(selected.draft.status))) ? <a href="#npi-review-decision" className="flex min-h-14 flex-1 flex-col justify-center px-3 py-2 text-[13px] font-semibold"><span className="text-[11px] text-[#BFD5C6]">03</span>{selected.draft.status === "approved_for_catalog" ? "Catalog" : "Decide"}</a> : null}
                </nav>
                <div className="hidden min-w-0 flex-wrap gap-x-3 gap-y-2 border-b border-[#D9E2DA] bg-[#E7EFE8] px-4 py-3 text-[14px] font-semibold text-[#173F35] sm:flex sm:gap-x-5 sm:px-7">
                  <a href="#npi-review-fields" className="underline-offset-4 hover:underline">01 / Check details</a>
                  <a href="#npi-review-proof" className="underline-offset-4 hover:underline">02 / Inspect proof</a>
                  {((selected.draft.status === "approved_for_catalog" && canCatalogMutate) || ((canCatalogMutate || canTrustSafetyMutate) && !["approved_for_catalog", "rejected"].includes(selected.draft.status))) ? <a href="#npi-review-decision" className="underline-offset-4 hover:underline">03 / {selected.draft.status === "approved_for_catalog" ? "Catalog" : "Decide"}</a> : null}
                  <span className="basis-full text-[#55735E] tabular-nums sm:ml-auto sm:basis-auto">{checkedCount}/{reviewableFields.length} checked</span>
                </div>

                {selected.draft.duplicateCandidateProductVersionId ? <div className="flex items-start gap-3 border-b border-[#D8E1DB] bg-[#E7EEF5] px-4 py-3 text-[14px] leading-6 text-[#1E4D68] sm:px-7"><CircleAlert size={19} className="mt-0.5 shrink-0" /><span><strong>Possible duplicate.</strong> A catalog item already uses this barcode; check whether this is an update.</span></div> : null}
                {selected.extraction?.safetyFlags?.length ? <div className="flex flex-wrap items-center gap-2 border-b border-[#E9D3C7] bg-[#FCEFE5] px-4 py-3 text-[14px] sm:px-7"><span className="font-bold text-[#8B5035]">Safety flags</span>{selected.extraction.safetyFlags.map((flag) => <span key={labelize(flag)} className="rounded-full bg-white px-3 py-1 font-semibold text-[#895038]">{labelize(flag)}</span>)}</div> : null}

                <section id="npi-review-fields" className="scroll-mt-20 border-b border-[#DCE4DA] bg-white px-4 py-5 sm:px-7 sm:py-7">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#6B806E]">01 / Verification</p><h3 className="mt-1 text-[24px] font-bold leading-tight text-[#173F35] sm:text-[27px]">Check the product details</h3></div>
                    <span className="hidden rounded-full bg-[#E7EFE7] px-3 py-1.5 text-[14px] font-semibold text-[#173F35] sm:inline-flex">{checkedCount} of {reviewableFields.length} checked</span>
                  </div>
                  <div className="mt-5 border-t-2 border-[#183F34]">
                    <h4 className="bg-[#E8EFE7] px-3 py-3 text-[18px] font-bold text-[#173F35] sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0 sm:text-[17px]">Identity & pack</h4>
                    <FieldReviewRows key={`${selected.draft.id}-identity`} fields={productFields} fieldStates={fieldStates} setFieldStates={setFieldStates} allowedFieldForMutation={allowedFieldForMutation} submitting={submitting} />
                  </div>
                  <div className="mt-5 border-t-2 border-[#B56845] bg-[#F8F1E9] px-3 pb-2 sm:mt-6 sm:bg-[#F7F1E9] sm:px-5">
                    <h4 className="-mx-3 bg-[#E8D5C5] px-3 py-3 text-[18px] font-bold text-[#173F35] sm:mx-0 sm:bg-transparent sm:px-0 sm:pt-4 sm:pb-0 sm:text-[17px]">Food safety & claims</h4>
                    <FieldReviewRows key={`${selected.draft.id}-safety`} fields={safetyFields} fieldStates={fieldStates} setFieldStates={setFieldStates} allowedFieldForMutation={allowedFieldForMutation} submitting={submitting} />
                  </div>
                </section>

                <section id="npi-review-proof" className="scroll-mt-20 border-b border-[#DCE4DA] bg-[#F1F5EF] px-4 py-6 sm:px-7 sm:py-7">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div><p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#617D68]">02 / Evidence</p><h3 className="mt-1 text-[24px] font-bold leading-tight text-[#173F35] sm:text-[27px]">Supporting proof</h3></div>
                    <span className="text-[14px] font-semibold text-[#526859]">{selected.evidence?.length || 0} files</span>
                  </div>
                  {selected.evidence?.length ? (
                    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                      {selected.evidence.map((evidence) => (
                        <a key={evidence.id} href={evidence.readUrl || undefined} aria-disabled={!evidence.readUrl} onClick={(event) => { if (!evidence.readUrl) event.preventDefault(); }} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 rounded-xl border border-[#D2DDD1] bg-white p-3 transition hover:border-[#83A78F] hover:shadow-sm">
                          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#F1F3EF]">
                            {evidence.readUrl && String(evidence.mimeType || "").startsWith("image/") ? <img src={evidence.readUrl} alt={labelize(evidence.purpose)} className="h-full w-full object-contain" /> : <ImageIcon size={24} className="text-[#8AA191]" />}
                          </span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold text-[#173F35]">{labelize(evidence.purpose)}</span><span className="mt-1 block text-[13px] text-[#617669]">{evidenceFileTypeLabel(evidence.mimeType)} · {Math.round(Number(evidence.bytes || 0) / 1024)} KB</span><span className="mt-1 block text-[13px] font-semibold text-[#4D7659]">{evidence.readUrl ? "Open proof" : "File unavailable"}</span></span>
                        </a>
                      ))}
                    </div>
                  ) : <p className="mt-4 rounded-lg border border-[#D2DDD1] bg-white p-4 text-[15px] text-[#58705E]">No supporting files have been attached.</p>}
                  <details className="mt-4 rounded-xl border border-[#D3DED4] bg-white">
                    <summary className="cursor-pointer px-4 py-4 text-[15px] font-bold text-[#173F35] marker:text-[#B56845]">View all submitted product information</summary>
                    <div className="border-t border-[#D8E2D9] p-4 sm:p-5"><AdminProductDetailsSheet draft={selected.draft} /></div>
                  </details>
                </section>

                {selected.draft.status === "approved_for_catalog" && canCatalogMutate ? (
                  <section id="npi-review-decision" className="scroll-mt-20 border-b border-[#D6E1D5] bg-[#EAF2E8] px-4 py-6 sm:px-7 sm:py-7">
                    <p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#5E7B65]">03 / Catalog handoff</p><h3 className="mt-1 text-[24px] font-bold text-[#173F35]">Create a catalog draft</h3>
                    {selected.draft.catalogProductVersionId ? (
                      <div className="mt-4 rounded-lg border border-[#C6D9C8] bg-white p-4 text-[14px] text-[#173F35]"><p className="font-bold">Catalog draft created</p><p className="mt-2 break-all">Catalog version: {selected.draft.catalogProductVersionId}</p><p className="mt-1 break-all">Pack reference: {selected.draft.catalogPackId || "—"}</p><Link to="/admin/catalog" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[#173F35] px-4 text-[14px] font-semibold text-white">Open Catalog & Listings</Link></div>
                    ) : (
                      <><p className="mt-2 text-[15px] text-[#5D705F]">Choose its category and pack type to prepare the next catalog step.</p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block"><span className="text-[14px] font-semibold text-[#173F35]">Catalog category</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={180} placeholder="Example: Rice" className="mt-2 min-h-12 w-full rounded-lg border border-[#C6D7C8] bg-white px-3 text-[15px] outline-none focus:border-[#173F35]" /></label>
                        <label className="block"><span className="text-[14px] font-semibold text-[#173F35]">Pack type</span><select value={packType} onChange={(event) => setPackType(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-[#C6D7C8] bg-white px-3 text-[15px] outline-none focus:border-[#173F35]">
                          <option value="other">Other</option><option value="packet">Packet</option><option value="pouch">Pouch</option><option value="box">Box</option><option value="bottle">Bottle</option><option value="jar">Jar</option><option value="carton">Carton</option><option value="can">Can</option><option value="sachet">Sachet</option><option value="tray">Tray</option><option value="tub">Tub</option><option value="wrapper">Wrapper</option>
                        </select></label>
                      </div>
                      <button type="button" disabled={handoffLoading} onClick={materializeCatalogDraft} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#173F35] px-5 text-[15px] font-bold text-white disabled:opacity-60">{handoffLoading ? <LoaderCircle size={17} className="animate-spin" /> : <PackagePlus size={17} />}Create catalog draft</button>
                      </>
                    )}
                    {actionNotice ? <p role="status" className="mt-4 rounded-lg bg-white p-4 text-[14px] font-semibold text-[#173F35]">{actionNotice}</p> : null}
                  </section>
                ) : null}

                {(canCatalogMutate || canTrustSafetyMutate) && !["approved_for_catalog", "rejected"].includes(selected.draft.status) ? (
                  <section id="npi-review-decision" className="scroll-mt-20 bg-[#E9EFE7] px-4 py-6 sm:px-7 sm:py-7">
                    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[12px] font-bold uppercase tracking-[0.055em] text-[#617864]">03 / Decision</p><h3 className="mt-1 text-[24px] font-bold text-[#173F35] sm:text-[27px]">Record your decision</h3></div><span className="max-w-full break-words rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-[#456B50] sm:rounded-full">{candidateTitle(selected.draft)}</span></div>
                    <label className="mt-4 block"><span className="text-[14px] font-bold text-[#173F35]">Reason for this product</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={4000} placeholder={`Explain your decision for ${candidateTitle(selected.draft)}`} className="mt-2 w-full resize-y rounded-xl border border-[#BDCEBF] bg-white px-4 py-3 text-[15px] leading-6 text-[#263F30] outline-none focus:border-[#173F35] focus:ring-2 focus:ring-[#D6E6D8]" /></label>
                    {actionNotice ? <p role="status" className="mt-3 rounded-lg bg-white p-3 text-[14px] font-semibold text-[#173F35]">{actionNotice}</p> : null}
                    <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                      {canCatalogMutate ? <button type="button" disabled={submitting} onClick={() => submitDecision("approve_for_catalog")} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#173F35] px-5 text-[15px] font-bold text-white hover:bg-[#245C46] disabled:opacity-60 sm:w-auto">{submitting ? <LoaderCircle size={17} className="animate-spin" /> : <BadgeCheck size={17} />}Approve for Catalog</button> : null}
                      <button type="button" disabled={submitting} onClick={() => submitDecision("request_more_evidence")} className="min-h-12 w-full rounded-lg border border-[#CEA587] bg-[#F6E2D0] px-5 text-[15px] font-bold text-[#734229] hover:bg-[#F1D7BD] disabled:opacity-60 sm:w-auto">Ask for more proof</button>
                      <button type="button" disabled={submitting} onClick={() => submitDecision("reject")} className="min-h-12 w-full rounded-lg border border-red-200 bg-red-50 px-5 text-[15px] font-bold text-red-800 hover:bg-red-100 disabled:opacity-60 sm:w-auto">Reject product</button>
                    </div>
                    {!canCatalogMutate && canTrustSafetyMutate ? <p className="mt-3 text-[14px] leading-6 text-[#607262]">Only Catalog Admins can approve products. You can request proof or reject on safety grounds.</p> : null}
                  </section>
                ) : null}
              </div>
            ) : <div className="flex min-h-40 flex-col justify-center bg-[#FCFBF7] px-6 py-7"><FileSearch size={25} className="text-[#6C9273]" /><h3 className="mt-2 text-[21px] font-bold text-[#173F35]">Choose a product to review</h3><p className="mt-1 text-[15px] text-[#5A705C]">Its details and proof will appear here.</p></div>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
