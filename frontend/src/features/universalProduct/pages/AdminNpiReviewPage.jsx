import {
  BadgeCheck,
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

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  return String(value || draft?.barcode || "Provisional product");
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
    ["Listing", labelize(draft?.listingType || "packaged")],
    ["Market", draft?.market || "Not declared"],
    ["Brand / grower", candidateValue(draft, "brandName") || "Not declared"],
    ["GTIN", candidateValue(draft, "gtin") || draft?.barcode || "Not declared"],
    ["Net quantity", quantityLabel(candidateValue(draft, "netQuantity"))],
    ["Country of origin", candidateValue(draft, "countryOfOrigin") || "Not declared"],
    ["Manufacturer / supplier", candidateValue(draft, "manufacturerName") || "Not declared"],
  ];

  const ingredientDeclaration =
    candidateValue(draft, "ingredientDeclarationText") || "";

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm sm:col-span-2 lg:col-span-2">
      <div className="border-b border-emerald-800 bg-emerald-950 px-4 py-3 text-white">
        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-200">
          Listing details sheet
        </p>
        <h4 className="mt-1 text-sm font-black leading-tight">
          {candidateTitle(draft)}
        </h4>
        <p className="mt-1 text-[9px] font-semibold text-emerald-100/80">
          Generated from the submitted listing data
        </p>
      </div>

      <div className="space-y-3 p-4">
        <dl className="space-y-1.5">
          {detailRows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[108px_minmax(0,1fr)] gap-2 text-[10px] leading-4"
            >
              <dt className="font-black text-stone-400">{label}</dt>
              <dd className="break-words font-bold text-stone-800">{value}</dd>
            </div>
          ))}
        </dl>

        {ingredientDeclaration ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Ingredients
            </p>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700">
              {ingredientDeclaration}
            </p>
          </div>
        ) : null}

        {allergens?.statement || allergenRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Allergens
            </p>
            {allergens?.statement ? (
              <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700">
                {allergens.statement}
              </p>
            ) : null}
            {allergenRows.length ? (
              <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700">
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
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
                Nutrition
              </p>
              <span className="text-[9px] font-black text-emerald-700">
                {labelize(nutrition?.basis || "declared basis")}
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
                  <span className="font-black text-stone-900">
                    {item.amount} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {claimRows.length || certificationRows.length ? (
          <div className="border-t border-stone-200 pt-3">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-stone-400">
              Claims & certifications
            </p>
            <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-700">
              {[...claimRows, ...certificationRows]
                .map((item) => item?.label)
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
        ) : null}
      </div>
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
            "Unable to load the NPI review queue."
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
          "Unable to load the NPI review draft."
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
        "catalog.mutate permission is required for M04 catalog handoff approval."
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
          ? "Draft approved for M04 catalog handoff. No canonical Product Version was auto-published."
          : decision === "request_more_evidence"
          ? "Draft returned for additional evidence."
          : "Draft rejected and the decision was audit logged."
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
          "Unable to record this NPI review decision."
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
        "Enter the canonical M04 category name before creating the catalog draft."
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
          ? `M04 catalog draft already exists. Pack ID: ${
              handoff?.packId || "available in A04"
            }.`
          : `M04 catalog draft created. Pack ID: ${
              handoff?.packId || "available in A04"
            }.`
      );

      const refreshed = await getAdminNpiDraft(draftId);

      setSelected(refreshed);

      await loadQueue(true);
    } catch (requestError) {
      setActionNotice(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to materialize this approved NPI draft into M04 catalog."
        )
      );
    } finally {
      setHandoffLoading(false);
    }
  }

  return (
    <AdminShell
      title="Product Intelligence Review"
      description="Review AI/external product evidence before any M04 canonical catalog action. Safety-critical fields remain explicit human decisions."
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadQueue(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-stone-600 shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <ShieldAlert size={20} className="mt-0.5 shrink-0" />

        <p className="text-xs font-semibold leading-5">
          AI extraction, Open Food Facts, and customer/Host evidence are
          non-canonical. Approval here only marks a draft ready for governed M04
          catalog onboarding; it does not create or publish ProductVersion.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((item) => (
          <button
            key={item || "open"}
            type="button"
            onClick={() => setStatus(item)}
            className={[
              "focus-ring rounded-full px-4 py-2 text-xs font-black transition",

              status === item
                ? "bg-emerald-700 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-800",
            ].join(" ")}
          >
            {item ? labelize(item) : "Open queue"}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} className="mt-0.5 shrink-0" />

          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
              Review queue
            </p>

            <p className="mt-1 text-sm font-bold text-stone-700">
              {pagination?.total ?? queue.length} drafts
            </p>
          </div>

          {loading ? (
            <div className="grid min-h-72 place-items-center">
              <LoaderCircle
                size={28}
                className="animate-spin text-emerald-700"
              />
            </div>
          ) : queue.length ? (
            <div className="max-h-[720px] overflow-y-auto p-3">
              {queue.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => openDraft(draft.id)}
                  className={[
                    "focus-ring mb-2 block w-full rounded-2xl border p-4 text-left transition last:mb-0",

                    selected?.draft?.id === draft.id
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-stone-200 hover:border-emerald-200 hover:bg-stone-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-stone-900">
                        {candidateTitle(draft)}
                      </p>

                      <p className="mt-1 text-[11px] font-semibold text-stone-500">
                        {draft.origin} · {draft.market || "IN"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black ${statusClasses(
                        draft.status
                      )}`}
                    >
                      {labelize(draft.status)}
                    </span>
                  </div>

                  {draft.safetyReviewRequired ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-amber-700">
                      <ShieldAlert size={13} />
                      Safety review required
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-72 place-items-center p-6 text-center">
              <div>
                <FileSearch size={30} className="mx-auto text-stone-300" />

                <p className="mt-3 text-sm font-black text-stone-700">
                  No drafts in this filter
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          {loadingSelected ? (
            <div className="grid min-h-72 place-items-center">
              <LoaderCircle
                size={28}
                className="animate-spin text-emerald-700"
              />
            </div>
          ) : selected?.draft ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${statusClasses(
                        selected.draft.status
                      )}`}
                    >
                      {labelize(selected.draft.status)}
                    </span>

                    <span className="rounded-full bg-stone-100 px-3 py-1 text-[10px] font-black text-stone-600">
                      {selected.draft.verificationStatus}
                    </span>
                  </div>

                  <h2 className="mt-3 text-2xl font-black text-stone-950">
                    {candidateTitle(selected.draft)}
                  </h2>

                  <p className="mt-1 text-xs font-semibold text-stone-500">
                    GTIN {selected.draft.barcode || "not extracted"} ·{" "}
                    {selected.draft.origin}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500"
                >
                  <X size={16} />
                </button>
              </div>

              {selected.draft.duplicateCandidateProductVersionId ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
                  <CircleAlert size={18} className="mt-0.5 shrink-0" />

                  <p className="text-xs font-semibold leading-5">
                    A published ProductVersion with the same extracted GTIN
                    already exists. Treat this as a duplicate/change-history
                    investigation before creating any new canonical record.
                  </p>
                </div>
              ) : null}

              {selected.extraction?.safetyFlags?.length ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                    Extraction safety flags
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.extraction.safetyFlags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-amber-800"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-700" />

                  <h3 className="text-lg font-black text-stone-950">
                    Candidate fields
                  </h3>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {reviewableFields.map(([fieldPath, item]) => {
                    const mutable = allowedFieldForMutation(fieldPath);

                    const safety = SAFETY_FIELDS.has(fieldPath);

                    return (
                      <div
                        key={fieldPath}
                        className={[
                          "rounded-2xl border p-4",

                          safety
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-stone-200 bg-stone-50",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                              {labelize(fieldPath)}
                            </p>

                            <p className="mt-1 text-[10px] font-bold text-amber-700">
                              {Number.isFinite(Number(item?.confidence))
                                ? `${Math.round(
                                    Number(item.confidence) * 100
                                  )}% confidence`
                                : "Confidence unknown"}{" "}
                              · {item?.source || "unknown source"}
                            </p>
                          </div>

                          {safety ? (
                            <ShieldCheck
                              size={16}
                              className="shrink-0 text-amber-700"
                            />
                          ) : null}
                        </div>

                        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-stone-700">
                          {printable(item?.value)}
                        </pre>

                        <select
                          value={fieldStates[fieldPath] || "pending_review"}
                          disabled={!mutable || submitting}
                          onChange={(event) =>
                            setFieldStates((current) => ({
                              ...current,

                              [fieldPath]: event.target.value,
                            }))
                          }
                          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black outline-none disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                        >
                          <option value="pending_review">Pending review</option>

                          <option value="accepted">
                            Accept evidence field
                          </option>

                          <option value="needs_evidence">
                            Needs more evidence
                          </option>

                          <option value="rejected">Reject field</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-emerald-700" />

                  <h3 className="text-lg font-black text-stone-950">
                    Source evidence
                  </h3>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <AdminProductDetailsSheet draft={selected.draft} />

                  {selected.evidence?.map((evidence) => (
                    <a
                      key={evidence.id}
                      href={evidence.readUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 transition hover:border-emerald-300"
                    >
                      {evidence.readUrl ? (
                        <img
                          src={evidence.readUrl}
                          alt={labelize(evidence.purpose)}
                          className="aspect-video w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-video place-items-center text-stone-300">
                          <ImageIcon size={28} />
                        </div>
                      )}

                      <div className="p-3">
                        <p className="text-xs font-black text-stone-700">
                          {labelize(evidence.purpose)}
                        </p>

                        <p className="mt-1 text-[10px] font-semibold text-stone-400">
                          {evidence.mimeType} ·{" "}
                          {Math.round(Number(evidence.bytes || 0) / 1024)} KB
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {selected.draft.status === "approved_for_catalog" &&
              canCatalogMutate ? (
                <div className="mt-7 border-t border-stone-200 pt-6">
                  <div className="flex items-center gap-2">
                    <PackagePlus size={18} className="text-emerald-700" />

                    <h3 className="text-lg font-black text-stone-950">
                      Governed M04 catalog handoff
                    </h3>
                  </div>

                  <p className="mt-2 max-w-3xl text-xs font-semibold leading-5 text-stone-500">
                    This action materializes the approved NPI into the existing
                    M04 Brand → Category → Product Family → Variant → Pack →
                    ProductVersion hierarchy. It creates a draft ProductVersion;
                    publication remains a separate A04 governance action.
                    For an already-approved draft, any candidate field currently
                    set to Accept evidence field is persisted atomically with this
                    handoff before M04 validates the required canonical fields.
                  </p>

                  {selected.draft.catalogProductVersionId ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-black text-emerald-900">
                        M04 catalog draft created
                      </p>

                      <p className="mt-2 break-all text-xs font-semibold text-emerald-800">
                        ProductVersion ID: {selected.draft.catalogProductVersionId}
                      </p>

                      <p className="mt-1 break-all text-xs font-semibold text-emerald-800">
                        Pack ID: {selected.draft.catalogPackId || "—"}
                      </p>

                      <Link
                        to="/admin/catalog"
                        className="focus-ring mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800"
                      >
                        Open A04 Catalog Products
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                            Canonical category name
                          </span>

                          <input
                            value={categoryName}
                            onChange={(event) =>
                              setCategoryName(event.target.value)
                            }
                            maxLength={180}
                            placeholder="Example: Rice"
                            className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>

                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                            Pack type
                          </span>

                          <select
                            value={packType}
                            onChange={(event) => setPackType(event.target.value)}
                            className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                          >
                            <option value="other">Other</option>
                            <option value="packet">Packet</option>
                            <option value="pouch">Pouch</option>
                            <option value="box">Box</option>
                            <option value="bottle">Bottle</option>
                            <option value="jar">Jar</option>
                            <option value="carton">Carton</option>
                            <option value="can">Can</option>
                            <option value="sachet">Sachet</option>
                            <option value="tray">Tray</option>
                            <option value="tub">Tub</option>
                            <option value="wrapper">Wrapper</option>
                          </select>
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={handoffLoading}
                        onClick={materializeCatalogDraft}
                        className="focus-ring mt-4 inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-4 py-3 text-xs font-black text-white hover:bg-stone-800 disabled:opacity-60"
                      >
                        {handoffLoading ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <PackagePlus size={15} />
                        )}
                        Create M04 catalog draft
                      </button>
                    </>
                  )}

                  {actionNotice ? (
                    <p className="mt-3 rounded-2xl bg-stone-100 p-3 text-xs font-bold leading-5 text-stone-600">
                      {actionNotice}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {(canCatalogMutate || canTrustSafetyMutate) &&
              !["approved_for_catalog", "rejected"].includes(
                selected.draft.status
              ) ? (
                <div className="mt-7 border-t border-stone-200 pt-6">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                      Review reason
                    </span>

                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      maxLength={4000}
                      placeholder="Explain the evidence decision, missing panels, duplicate handling, or catalog handoff rationale."
                      className="mt-2 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  {actionNotice ? (
                    <p className="mt-3 rounded-2xl bg-stone-100 p-3 text-xs font-bold leading-5 text-stone-600">
                      {actionNotice}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {canCatalogMutate ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => submitDecision("approve_for_catalog")}
                        className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {submitting ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <BadgeCheck size={15} />
                        )}
                        Approve for M04 handoff
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitDecision("request_more_evidence")}
                      className="focus-ring rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                    >
                      Request more evidence
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitDecision("reject")}
                      className="focus-ring rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Reject draft
                    </button>
                  </div>

                  {!canCatalogMutate && canTrustSafetyMutate ? (
                    <p className="mt-3 text-[11px] font-semibold leading-5 text-stone-400">
                      Your current permission profile can review safety-scoped
                      fields and request/reject evidence. Catalog handoff
                      approval remains unavailable without catalog.mutate.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center text-center">
              <div>
                <FileSearch size={34} className="mx-auto text-stone-300" />

                <h2 className="mt-4 text-lg font-black text-stone-800">
                  Choose an NPI draft
                </h2>

                <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">
                  Review candidate fields, confidence, safety flags, evidence
                  images, and duplicate signals before recording a governed
                  decision.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
