import {
  BadgeCheck,
  ChevronDown,
  CircleAlert,
  FileSearch,
  Image as ImageIcon,
  LoaderCircle,
  PackagePlus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

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
      return "All reviews";
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
              className="grid grid-cols-[108px_minmax(0,1fr)] gap-2 text-[10px] leading-4"
            >
              <dt className="font-bold text-stone-400">{label}</dt>
              <dd className="break-words font-bold text-stone-800">{value}</dd>
            </div>
          ))}
        </dl>

        {ingredientDeclaration ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[10px] font-bold text-stone-400">
              Ingredients
            </p>
            <p className="mt-1 text-[10px] font-medium leading-4 text-stone-700">
              {ingredientDeclaration}
            </p>
          </div>
        ) : null}

        {allergens?.statement || allergenRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[10px] font-bold text-stone-400">
              Allergens
            </p>
            {allergens?.statement ? (
              <p className="mt-1 text-[10px] font-medium leading-4 text-stone-700">
                {allergens.statement}
              </p>
            ) : null}
            {allergenRows.length ? (
              <p className="mt-1 text-[10px] font-medium leading-4 text-stone-700">
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
              <p className="text-[10px] font-bold text-stone-400">
                Nutrition
              </p>
              <span className="text-[10px] font-bold text-emerald-700">
                {labelize(nutrition?.basis || "nutrition basis")}
                {nutrition?.servingSize
                  ? ` · ${quantityLabel(nutrition.servingSize)}`
                  : ""}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {nutrientRows.map((item, index) => (
                <div
                  key={`${item.name || "nutrient"}-${index}`}
                  className="flex items-center justify-between gap-2 border-b border-stone-100 py-1 text-[10px]"
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
            <p className="text-[10px] font-bold text-stone-400">
              Claims and certifications
            </p>
            <p className="mt-1 text-[10px] font-medium leading-4 text-stone-700">
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

export default function AdminNpiReviewPage() {
  const { hasAdminPermission } = useAdmin();

  const canCatalogMutate = hasAdminPermission("catalog.mutate");

  const canTrustSafetyMutate = hasAdminPermission("trust_safety.mutate");

  const [status, setStatus] = useState("ready_for_review");

  const [queue, setQueue] = useState([]);

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
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const result = await listAdminNpiReviewQueue({
          page: 1,

          limit: 50,

          status: status || undefined,
        });

        setQueue(result?.drafts || []);

        setPagination(result?.pagination || null);
      } catch (requestError) {
        setError(
          getUniversalProductErrorMessage(
            requestError,
            "Unable to load the product review list."
          )
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [status]
  );

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const reviewableFields = useMemo(
    () => Object.entries(selected?.draft?.candidateFields || {}),
    [selected]
  );

  async function openDraft(draftId) {
    setLoadingSelected(true);

    setError("");
    setActionNotice("");

    try {
      const result = await getAdminNpiDraft(draftId);

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
    } catch (requestError) {
      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to open this product review."
        )
      );
    } finally {
      setLoadingSelected(false);
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

    if (!reason.trim()) {
      setActionNotice("Add a review reason before recording the decision.");

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
      description="Check product details and proof before they move to Catalog. Safety information always needs a human review."
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadQueue(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-bold text-stone-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <section className="overflow-hidden border border-[#173f38]/20 bg-[#173f38] text-white shadow-[0_14px_38px_rgba(23,63,56,0.12)]">
        <div className="grid gap-4 px-4 py-4 sm:gap-7 sm:px-7 sm:py-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)] xl:items-end">
          <div>
            <p className="text-[11px] font-bold text-emerald-200">
              Product review workspace
            </p>
            <h2 className="mt-1.5 max-w-3xl text-xl font-bold leading-[1.12] tracking-[-0.025em] sm:mt-2 sm:text-3xl">
              Check the product. Confirm the proof. Then decide what happens next.
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-5 text-emerald-50/80 sm:mt-3 sm:leading-6">
              <span className="sm:hidden">Check the submitted details and proof before moving this product to Catalog.</span>
              <span className="hidden sm:inline">Review the submitted details, supporting files and safety information. Approval moves the product to the catalog workflow; it does not publish it.</span>
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/20 border-t border-white/20 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <div className="pr-5">
              <p className="text-[10px] font-bold text-emerald-200/80">
                Waiting for review
              </p>
              <p className="mt-1 text-3xl font-bold">
                {pagination?.total ?? queue.length}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-50/70">
                products in this view
              </p>
            </div>
            <div className="pl-5">
              <p className="text-[10px] font-bold text-emerald-200/80">
                Showing
              </p>
              <p className="mt-2 text-sm font-bold leading-5">
                {statusLabel(status)}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-50/70">
                current filter
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/15 bg-[#11332e] px-3 py-2 sm:px-5 sm:py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_OPTIONS.map((item) => (
              <button
                key={item || "open"}
                type="button"
                onClick={() => setStatus(item)}
                className={[
                  "focus-ring shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition",
                  status === item
                    ? "bg-white text-[#173f38]"
                    : "bg-white/10 text-emerald-50 hover:bg-white/20",
                ].join(" ")}
              >
                {statusLabel(item)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-3 border-l-4 border-[#315f88] bg-[#eef4f8] px-3 py-2.5 text-[#17344e] sm:mt-4 sm:px-5 sm:py-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#315f88]" />
          <div>
            <p className="text-[10px] font-bold text-[#315f88] sm:text-xs">
              Before you approve
            </p>
            <p className="mt-0.5 text-xs font-medium leading-4 sm:mt-1 sm:text-sm sm:leading-5">
              <span className="sm:hidden">Approval sends this product to Catalog as a draft. It is not published yet.</span>
              <span className="hidden sm:inline">Approving this review sends the product to Catalog & Listings as a draft. It is published only after the catalog approval step is completed.</span>
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-3 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          <CircleAlert size={19} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      <section className="mt-4 overflow-hidden border border-[#d8e0e6] bg-white shadow-[0_12px_34px_rgba(30,41,59,0.05)] sm:mt-5">
        <div className="border-b border-[#d8e0e6] bg-[#f4f7f9] px-3 py-3 sm:px-5 sm:py-4">
          <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center sm:gap-4">
            <div>
              <p className="text-xs font-bold text-[#315f88]">Products to review</p>
              <p className="mt-0.5 text-sm font-medium text-slate-500">
                {pagination?.total ?? queue.length} products in this view
              </p>
            </div>

            {loading ? (
              <div className="flex h-12 items-center border border-[#cfd9e1] bg-white px-4 sm:h-14">
                <LoaderCircle size={18} className="animate-spin text-[#315f88]" />
                <span className="ml-2 text-sm font-medium text-slate-500">Loading products...</span>
              </div>
            ) : queue.length ? (
              <div className="relative">
                <select
                  value={selected?.draft?.id || ""}
                  onChange={(event) => {
                    const draftId = event.target.value;
                    if (draftId) openDraft(draftId);
                  }}
                  className="focus-ring h-12 w-full appearance-none border border-[#cfd9e1] bg-white px-4 pr-11 text-sm font-bold text-slate-900 outline-none transition hover:border-[#8aa7bd] focus:border-[#315f88] focus:ring-2 focus:ring-[#dbe8f1] sm:h-14 sm:text-base"
                  aria-label="Choose a product to review"
                >
                  <option value="">Choose a product to review</option>
                  {queue.map((draft) => (
                    <option key={draft.id} value={draft.id}>
                      {candidateTitle(draft)} — {statusLabel(draft.status)}{draft.safetyReviewRequired ? " — Safety check needed" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#315f88]"
                />
              </div>
            ) : (
              <div className="flex min-h-12 items-center border border-[#d8e0e6] bg-white px-4 sm:min-h-14">
                <FileSearch size={18} className="mr-2 shrink-0 text-slate-300" />
                <div>
                  <p className="text-sm font-bold text-slate-700">No products in this view</p>
                  <p className="text-xs font-medium text-slate-400">Choose another review status.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 bg-white">
            {loadingSelected ? (
              <div className="grid min-h-[240px] place-items-center sm:min-h-[520px]">
                <LoaderCircle size={28} className="animate-spin text-emerald-700" />
              </div>
            ) : selected?.draft ? (
              <div>
                <header className="border-b border-stone-200 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${statusClasses(selected.draft.status)}`}>
                          {statusLabel(selected.draft.status)}
                        </span>
                        <span className="rounded-md bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-600">
                          {labelize(selected.draft.verificationStatus)}
                        </span>
                      </div>
                      <h2 className="mt-2 break-words text-xl font-bold leading-[1.12] tracking-[-0.025em] text-stone-950 sm:mt-3 sm:text-3xl">
                        {candidateTitle(selected.draft)}
                      </h2>
                      <p className="mt-1.5 text-xs font-medium leading-4 text-stone-500 sm:mt-2 sm:text-sm">
                        Barcode {selected.draft.barcode || "not available"} · {reviewSourceLabel(selected.draft.origin)} · {selected.draft.market || "IN"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-200"
                      aria-label="Close product review"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </header>

                <div className="space-y-0">
                  {selected.draft.duplicateCandidateProductVersionId ? (
                    <div className="border-b border-blue-200 bg-blue-50 px-3 py-3 text-blue-950 sm:px-6 sm:py-4 lg:px-8">
                      <div className="flex items-start gap-3">
                        <CircleAlert size={18} className="mt-0.5 shrink-0 text-blue-700" />
                        <div>
                          <p className="text-xs font-bold text-blue-700">Possible duplicate</p>
                          <p className="mt-1 text-sm font-medium leading-5">
                            A published catalog item already uses this barcode. Check whether this is an update before creating another product record.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {selected.extraction?.safetyFlags?.length ? (
                    <div className="border-b border-orange-200 bg-orange-50 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="mr-2 text-xs font-bold text-orange-800">Safety checks</p>
                        {selected.extraction.safetyFlags.map((flag) => (
                          <span key={labelize(flag)} className="rounded-md bg-white px-2.5 py-1 text-[10px] font-bold text-orange-800 ring-1 ring-orange-200">
                            {labelize(flag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <section className="border-b border-stone-200 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-800">01 / Product details</p>
                        <h3 className="mt-1 text-xl font-bold tracking-[-0.015em] text-stone-950">Review the product details</h3>
                        <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-stone-500">
                          Check each detail and decide whether to accept it or ask for better proof.
                        </p>
                      </div>
                      <p className="text-xs font-bold text-stone-500">{reviewableFields.length} details</p>
                    </div>

                    <div className="mt-3 border-y border-stone-200 sm:mt-5">
                      {reviewableFields.map(([fieldPath, item]) => {
                        const mutable = allowedFieldForMutation(fieldPath);
                        const safety = SAFETY_FIELDS.has(fieldPath);
                        return (
                          <div
                            key={fieldPath}
                            className={[
                              "grid grid-cols-[minmax(0,1fr)_124px] gap-2 border-b border-stone-200 px-0 py-3 last:border-b-0 sm:grid-cols-1 sm:gap-3 sm:py-4 lg:grid-cols-[180px_minmax(0,1fr)_210px] lg:items-start lg:gap-5",
                              safety ? "bg-[#fff7ed]" : "bg-white",
                            ].join(" ")}
                          >
                            <div className="order-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-stone-900">{reviewFieldLabel(fieldPath)}</p>
                                {safety ? <ShieldCheck size={14} className="text-orange-700" /> : null}
                              </div>
                              <p className="mt-1 text-[10px] font-bold text-stone-400">
                                {Number.isFinite(Number(item?.confidence)) ? `Match confidence: ${Math.round(Number(item.confidence) * 100)}%` : "Match confidence unavailable"}
                              </p>
                              <p className="mt-1 text-[10px] font-bold text-stone-400">{reviewSourceLabel(item?.source)}</p>
                            </div>

                            <pre className="order-3 col-span-2 max-h-40 overflow-auto whitespace-pre-wrap break-words bg-[#f6f5f2] px-2.5 py-2 text-[11px] font-medium leading-4 text-stone-700 sm:order-2 sm:col-span-1 sm:max-h-44 sm:px-3 sm:py-3 sm:text-xs sm:leading-5">
                              {reviewFieldValue(fieldPath, item?.value)}
                            </pre>

                            <select
                              value={fieldStates[fieldPath] || "pending_review"}
                              disabled={!mutable || submitting}
                              onChange={(event) =>
                                setFieldStates((current) => ({ ...current, [fieldPath]: event.target.value }))
                              }
                              className="order-2 h-9 w-full border border-stone-200 bg-white px-2 text-[11px] font-bold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 sm:order-3 sm:h-10 sm:px-3 sm:text-xs"
                            >
                              <option value="pending_review">Not reviewed</option>
                              <option value="accepted">Accept</option>
                              <option value="needs_evidence">Ask for proof</option>
                              <option value="rejected">Reject</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="border-b border-stone-200 bg-[#f4f7f9] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div>
                      <p className="text-[10px] font-bold text-blue-800">02 / Supporting proof</p>
                      <h3 className="mt-1 text-xl font-bold tracking-[-0.015em] text-stone-950">Source & proof</h3>
                      <p className="mt-1 max-w-2xl text-sm font-medium leading-5 text-stone-500">
                        Compare the product details with the files provided.
                      </p>
                    </div>

                    <div className="mt-3 grid gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                      <div className="border border-stone-200 bg-white">
                        <div className="border-b border-stone-200 bg-[#123f3d] px-3 py-3 text-white sm:px-4 sm:py-4">
                          <p className="text-[10px] font-bold text-emerald-200">Submitted product details</p>
                          <h4 className="mt-1 text-base font-bold">{candidateTitle(selected.draft)}</h4>
                          <p className="mt-1 text-[11px] font-medium text-emerald-50/75">Information supplied with this product</p>
                        </div>
                        <div className="p-3 sm:p-5">
                          <AdminProductDetailsSheet draft={selected.draft} />
                        </div>
                      </div>

                      <div className="border border-stone-200 bg-white">
                        <div className="border-b border-stone-200 px-3 py-3 sm:px-4 sm:py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-stone-900">Proof files</p>
                              <p className="mt-1 text-[11px] font-medium text-stone-500">Open a file to check the proof.</p>
                            </div>
                            <span className="text-xs font-bold text-stone-400">{selected.evidence?.length || 0}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-stone-200">
                          {selected.evidence?.length ? selected.evidence.map((evidence) => (
                            <a
                              key={evidence.id}
                              href={evidence.readUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="focus-ring grid grid-cols-[84px_minmax(0,1fr)] gap-3 p-3 transition hover:bg-stone-50"
                            >
                              {evidence.readUrl ? (
                                <img src={evidence.readUrl} alt={labelize(evidence.purpose)} className="h-16 w-[84px] object-cover" />
                              ) : (
                                <div className="grid h-16 w-[84px] place-items-center bg-stone-100 text-stone-300"><ImageIcon size={24} /></div>
                              )}
                              <div className="min-w-0 py-1">
                                <p className="truncate text-xs font-bold text-stone-800">{labelize(evidence.purpose)}</p>
                                <p className="mt-1 text-[10px] font-medium text-stone-400">{evidenceFileTypeLabel(evidence.mimeType)}</p>
                                <p className="mt-1 text-[10px] font-bold text-stone-500">{Math.round(Number(evidence.bytes || 0) / 1024)} KB</p>
                              </div>
                            </a>
                          )) : (
                            <div className="px-3 py-5 text-center text-xs font-medium text-stone-400 sm:px-4 sm:py-8">No proof files attached.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {selected.draft.status === "approved_for_catalog" && canCatalogMutate ? (
                    <section className="border-b border-stone-200 bg-[#eaf5ef] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                      <div>
                        <p className="text-[10px] font-bold text-emerald-800">03 / Add to catalog</p>
                        <h3 className="mt-1 text-xl font-bold tracking-[-0.015em] text-stone-950">Create a Catalog draft</h3>
                        <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-stone-600">
                          This product passed review. Choose its category and pack type, then create a Catalog draft for final approval.
                        </p>
                      </div>

                      {selected.draft.catalogProductVersionId ? (
                        <div className="mt-3 border-l-4 border-emerald-600 bg-white px-3 py-3 sm:mt-5 sm:px-4 sm:py-4">
                          <p className="text-sm font-bold text-emerald-950">Catalog draft created</p>
                          <p className="mt-2 break-all text-xs font-medium text-emerald-800">Catalog version reference: {selected.draft.catalogProductVersionId}</p>
                          <p className="mt-1 break-all text-xs font-medium text-emerald-800">Pack reference: {selected.draft.catalogPackId || "—"}</p>
                          <Link to="/admin/catalog" className="focus-ring mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">Open Catalog & Listings</Link>
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="text-[10px] font-bold text-stone-500">Catalog category</span>
                              <input
                                value={categoryName}
                                onChange={(event) => setCategoryName(event.target.value)}
                                maxLength={180}
                                placeholder="Example: Rice"
                                className="mt-2 h-11 w-full border border-stone-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold text-stone-500">Pack type</span>
                              <select
                                value={packType}
                                onChange={(event) => setPackType(event.target.value)}
                                className="mt-2 h-11 w-full border border-stone-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                              >
                                <option value="other">Other</option><option value="packet">Packet</option><option value="pouch">Pouch</option><option value="box">Box</option><option value="bottle">Bottle</option><option value="jar">Jar</option><option value="carton">Carton</option><option value="can">Can</option><option value="sachet">Sachet</option><option value="tray">Tray</option><option value="tub">Tub</option><option value="wrapper">Wrapper</option>
                              </select>
                            </label>
                          </div>
                          <button
                            type="button"
                            disabled={handoffLoading}
                            onClick={materializeCatalogDraft}
                            className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800 disabled:opacity-60"
                          >
                            {handoffLoading ? <LoaderCircle size={15} className="animate-spin" /> : <PackagePlus size={15} />}
                            Create catalog draft
                          </button>
                        </>
                      )}

                      {actionNotice ? <p className="mt-3 bg-white px-3 py-3 text-xs font-bold leading-5 text-stone-600">{actionNotice}</p> : null}
                    </section>
                  ) : null}

                  {(canCatalogMutate || canTrustSafetyMutate) && !["approved_for_catalog", "rejected"].includes(selected.draft.status) ? (
                    <section className="bg-[#edf3fa] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
                      <div>
                        <p className="text-[10px] font-bold text-blue-800">03 / Final decision</p>
                        <h3 className="mt-1 text-xl font-bold tracking-[-0.015em] text-stone-950">Make a review decision</h3>
                        <p className="mt-1 max-w-3xl text-sm font-medium leading-5 text-stone-600">
                          Add a short reason, then approve, ask for more proof or reject the product.
                        </p>
                      </div>

                      <label className="mt-3 block sm:mt-5">
                        <span className="text-xs font-bold text-stone-500">Review reason</span>
                        <textarea
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          rows={4}
                          maxLength={4000}
                          placeholder="Why are you approving, asking for more proof, or rejecting this product?"
                          className="mt-2 w-full resize-y border border-blue-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      {actionNotice ? <p className="mt-3 bg-white px-3 py-3 text-xs font-bold leading-5 text-stone-600">{actionNotice}</p> : null}

                      <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
                        {canCatalogMutate ? (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => submitDecision("approve_for_catalog")}
                            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            {submitting ? <LoaderCircle size={15} className="animate-spin" /> : <BadgeCheck size={15} />}
                            Approve for Catalog
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => submitDecision("request_more_evidence")}
                          className="focus-ring rounded-lg bg-orange-100 px-4 py-3 text-xs font-bold text-orange-900 hover:bg-orange-200 disabled:opacity-60"
                        >
                          Ask for more proof
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => submitDecision("reject")}
                          className="focus-ring rounded-lg bg-red-100 px-4 py-3 text-xs font-bold text-red-800 hover:bg-red-200 disabled:opacity-60"
                        >
                          Reject product
                        </button>
                      </div>

                      {!canCatalogMutate && canTrustSafetyMutate ? (
                        <p className="mt-3 text-[11px] font-medium leading-5 text-stone-500">
                          You can review safety information and ask for more proof or reject it. Only Catalog Admins can approve a product for Catalog.
                        </p>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid min-h-[320px] place-items-center px-4 py-8 text-center sm:min-h-[520px] sm:px-6 sm:py-12">
                <div className="max-w-xl">
                  <div className="mx-auto grid h-14 w-14 place-items-center bg-[#e8f3ef] text-emerald-800">
                    <FileSearch size={28} />
                  </div>
                  <p className="mt-5 text-[10px] font-bold text-emerald-800">Product review</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-stone-900">Choose a product above to review.</h2>
                  <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-stone-500">
                    Product details, proof and review actions will appear here.
                  </p>
                  <div className="mx-auto mt-5 grid max-w-lg gap-px bg-stone-200 text-left sm:mt-7 sm:grid-cols-3">
                    <div className="bg-white p-3 sm:p-4"><p className="text-[10px] font-bold text-emerald-700">01</p><p className="mt-2 text-xs font-bold text-stone-800">Check details</p></div>
                    <div className="bg-white p-3 sm:p-4"><p className="text-[10px] font-bold text-blue-700">02</p><p className="mt-2 text-xs font-bold text-stone-800">Check proof</p></div>
                    <div className="bg-white p-3 sm:p-4"><p className="text-[10px] font-bold text-stone-500">03</p><p className="mt-2 text-xs font-bold text-stone-800">Make decision</p></div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </section>
    </AdminShell>
  );
}
