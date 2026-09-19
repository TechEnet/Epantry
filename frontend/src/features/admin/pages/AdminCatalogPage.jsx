import {
  Apple,
  BadgeCheck,
  CircleAlert,
  History,
  ImagePlus,
  Leaf,
  LoaderCircle,
  Package,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { extractMediaPrivacyHolds } from "../../mediaPrivacy/services/mediaPrivacy.service";

import {
  createAdminNpiFromImages,
  getUniversalProductErrorMessage,
  uploadProductEvidenceBatch,
} from "../../universalProduct/services/universalProduct.service";

import AdminShell from "../components/AdminShell";

import { useAdmin } from "../context/AdminContext";

import useAdminCatalog from "../hooks/useAdminCatalog";

const LISTING_TYPES = [
  ["packaged", "Packaged Food", "Existing catalog workflow"],
  ["vegetable", "Vegetables", "Fresh vegetable listing"],
  ["fruit", "Fruits", "Fresh fruit listing"],
];

const PRODUCE_NUTRIENTS = [
  ["energy", "Energy", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrate", "Carbohydrate", "g"],
  ["total_fat", "Total Fat", "g"],
  ["saturated_fat", "Saturated Fat", "g"],
  ["dietary_fibre", "Dietary Fibre", "g"],
  ["total_sugars", "Total Sugars", "g"],
  ["sodium", "Sodium", "mg"],
];

const EMPTY_PRODUCE_DETAILS = {
  name: "",
  brandName: "",
  quantityValue: "",
  quantityUnit: "kg",
  countryOfOrigin: "",
  manufacturerName: "",
  nutrients: Object.fromEntries(
    PRODUCE_NUTRIENTS.map(([key]) => [key, ""])
  ),
};

function getStatusClasses(status) {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-800";

    case "in_review":
      return "bg-amber-50 text-amber-800";

    case "retired":
      return "bg-stone-200 text-stone-600";

    default:
      return "bg-blue-50 text-blue-800";
  }
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function buildProduceDeclarations(details) {
  return {
    ingredientDeclarationText: "",
    allergenStatement: "",
    allergens: [],
    nutrition: {
      basis: "per_100g",
      servingSize: null,
      nutrients: PRODUCE_NUTRIENTS.map(([key, label, unit]) => ({
        name: label,
        amount: Number(details.nutrients?.[key]),
        unit,
      })).filter(
        (item) => Number.isFinite(item.amount) && item.amount >= 0
      ),
    },
    countryOfOrigin: details.countryOfOrigin.trim(),
    manufacturerName: details.manufacturerName.trim(),
    claims: [],
  };
}

function AdminProduceNpiForm({ listingType }) {
  const [market, setMarket] = useState("IN");
  const [details, setDetails] = useState(EMPTY_PRODUCE_DETAILS);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [privacyPendingAssets, setPrivacyPendingAssets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isVegetable = listingType === "vegetable";
  const typeLabel = isVegetable ? "Vegetable" : "Fruit";
  const TypeIcon = isVegetable ? Leaf : Apple;

  function addProduceFiles(event) {
    setPrivacyPendingAssets([]);
    setError("");

    const files = Array.from(event.target.files || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    event.target.value = "";

    setEvidenceFiles((current) =>
      [
        ...current,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random()}`,
          purpose: "front_pack",
          file,
        })),
      ].slice(0, 4)
    );
  }

  async function submitProduce(event) {
    event.preventDefault();

    const quantityValue = Number(details.quantityValue);
    const nutritionComplete = PRODUCE_NUTRIENTS.every(([key]) => {
      const value = Number(details.nutrients?.[key]);
      return details.nutrients?.[key] !== "" && Number.isFinite(value) && value >= 0;
    });

    if (!details.name.trim()) {
      setError(`${typeLabel} name is required.`);
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setError(`Enter a valid ${typeLabel.toLowerCase()} quantity.`);
      return;
    }

    if (!details.countryOfOrigin.trim()) {
      setError("Country of origin is required for fresh produce.");
      return;
    }

    if (!nutritionComplete) {
      setError("Complete all required nutrition values per 100 g.");
      return;
    }

    if (!evidenceFiles.length && !privacyPendingAssets.length) {
      setError(`Add at least one ${typeLabel.toLowerCase()} photo.`);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");
    setProgress({
      completed: 0,
      total: evidenceFiles.length,
    });

    let assets = privacyPendingAssets;

    try {
      if (!assets.length) {
        assets = await uploadProductEvidenceBatch({
          evidenceFiles,
          scope: "admin",
          onProgress: setProgress,
        });
      }

      const result = await createAdminNpiFromImages({
        assets,
        market,
        listingType,
        hints: {
          title: details.name.trim(),
          brandName: details.brandName.trim() || "Fresh Produce",
          barcode: "",
          netQuantityText: `${quantityValue} ${details.quantityUnit}`,
        },
        hostDeclarations: buildProduceDeclarations(details),
      });

      setSuccess(
        result?.resolution?.draft?.status === "ready_for_review"
          ? `${typeLabel} draft created. It is now in the governed Product Intelligence review queue.`
          : `${typeLabel} evidence saved. Review the draft status in Product Intelligence.`
      );

      setDetails(EMPTY_PRODUCE_DETAILS);
      setEvidenceFiles([]);
      setPrivacyPendingAssets([]);
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      if (holds.length) {
        setPrivacyPendingAssets(assets);
      }

      setError(
        getUniversalProductErrorMessage(
          requestError,
          holds.length
            ? "The product photo is waiting for privacy clearance before the draft can enter review."
            : `Unable to create the ${typeLabel.toLowerCase()} NPI draft.`
        )
      );
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <section className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <TypeIcon size={20} aria-hidden="true" />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
            New {typeLabel.toLowerCase()} draft
          </p>
          <h2 className="text-lg font-black text-stone-950">
            Create fresh {typeLabel.toLowerCase()} listing
          </h2>
        </div>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-500">
        Enter the fresh-produce facts and photo here. The draft still goes through
        Product Intelligence review before the existing governed catalog handoff
        and publication flow.
      </p>

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <p>{success}</p>
          <Link
            to="/admin/product-intelligence"
            className="focus-ring mt-3 inline-flex rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-800"
          >
            Open Product Intelligence Review
          </Link>
        </div>
      ) : null}

      <form onSubmit={submitProduce} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="text-xs font-black text-stone-500">
              {typeLabel} name *
            </span>
            <input
              value={details.name}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={isVegetable ? "Example: Tomato" : "Example: Banana"}
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">Market</span>
            <input
              value={market}
              onChange={(event) =>
                setMarket(event.target.value.toUpperCase().slice(0, 10))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">
              Country of origin *
            </span>
            <input
              value={details.countryOfOrigin}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  countryOfOrigin: event.target.value,
                }))
              }
              placeholder="Example: India"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">Quantity *</span>
            <input
              type="number"
              min="0"
              step="any"
              value={details.quantityValue}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  quantityValue: event.target.value,
                }))
              }
              placeholder="Example: 1"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">Unit *</span>
            <select
              value={details.quantityUnit}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  quantityUnit: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="piece">piece</option>
              <option value="dozen">dozen</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">
              Grower / brand (optional)
            </span>
            <input
              value={details.brandName}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  brandName: event.target.value,
                }))
              }
              placeholder="Defaults to Fresh Produce"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="md:col-span-2 xl:col-span-3">
            <span className="text-xs font-black text-stone-500">
              Grower / supplier name (optional)
            </span>
            <input
              value={details.manufacturerName}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  manufacturerName: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
            Nutrition per 100 g · required
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRODUCE_NUTRIENTS.map(([key, label, unit]) => (
              <label key={key}>
                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                  {label} ({unit}) *
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={details.nutrients[key]}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      nutrients: {
                        ...current.nutrients,
                        [key]: event.target.value,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-black text-stone-700">
            {typeLabel} photo *
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-stone-500">
            Add a clear product photo for governed evidence.
          </p>

          <label className="focus-ring mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white hover:bg-stone-800">
            <Upload size={15} />
            Add {typeLabel.toLowerCase()} photo
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={addProduceFiles}
              className="sr-only"
            />
          </label>

          {evidenceFiles.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {evidenceFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-white p-3"
                >
                  <ImagePlus size={15} className="text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-stone-800">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-500">
                      Product photo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPrivacyPendingAssets([]);
                      setEvidenceFiles((current) =>
                        current.filter((candidate) => candidate.id !== item.id)
                      );
                    }}
                    className="focus-ring grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-50 hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitting || (!evidenceFiles.length && !privacyPendingAssets.length)}
          className="focus-ring inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <TypeIcon size={17} />
          )}
          {submitting
            ? progress
              ? `Uploading ${progress.completed}/${progress.total}…`
              : "Submitting…"
            : `Create ${typeLabel.toLowerCase()} NPI draft`}
        </button>
      </form>
    </section>
  );
}

export default function AdminCatalogPage() {
  const { hasAdminPermission } = useAdmin();

  const canMutate = hasAdminPermission("catalog.mutate");

  const {
    versions,
    loading,
    mutating,
    error,
    loadVersions,
    submitForReview,
    publishVersion,
  } = useAdminCatalog();

  const [listingType, setListingType] = useState("packaged");
  const [statusFilter, setStatusFilter] = useState("current");
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    loadVersions({
      page: 1,
      limit: 100,
    }).catch(() => {});
  }, [loadVersions]);

  const filteredVersions = useMemo(() => {
    if (statusFilter === "current") {
      return versions.filter(
        (version) => version.publicationStatus !== "retired"
      );
    }

    return versions.filter(
      (version) => version.publicationStatus === statusFilter
    );
  }, [versions, statusFilter]);

  async function refreshVersions() {
    await loadVersions({
      page: 1,
      limit: 100,
    });
  }

  async function handleSubmitForReview(version) {
    const versionId = version?.id || version?._id;

    if (!versionId || mutating) {
      return;
    }

    setActionNotice("");

    try {
      await submitForReview(versionId);

      setActionNotice(
        `${version.displayName || "Product Version"} moved to M04 review.`
      );

      await refreshVersions();
    } catch (requestError) {
      setActionNotice(
        errorMessage(
          requestError,
          "Unable to submit this Product Version for M04 review."
        )
      );
    }
  }

  async function handlePublish(version) {
    const versionId = version?.id || version?._id;

    if (!versionId || mutating) {
      return;
    }

    setActionNotice("");

    try {
      await publishVersion(versionId, {
        reasonCode: "catalog.governance",
        reasonDetails:
          "Governed M04 publication after approved NPI evidence handoff and Product Version review.",
      });

      setActionNotice(
        `${version.displayName || "Product Version"} published to the canonical M04 catalog.`
      );

      await refreshVersions();
    } catch (requestError) {
      setActionNotice(
        errorMessage(
          requestError,
          "Unable to publish this Product Version."
        )
      );
    }
  }

  return (
    <AdminShell
      title="Catalog Products"
      description="Manage canonical Product Versions separately from seller pricing and inventory."
      actions={
        <button
          type="button"
          onClick={() => refreshVersions().catch(() => {})}
          className="focus-ring inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        {LISTING_TYPES.map(([value, label, description]) => {
          const selected = listingType === value;
          const TypeIcon =
            value === "packaged" ? Package : value === "vegetable" ? Leaf : Apple;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setListingType(value)}
              className={[
                "focus-ring flex min-h-24 items-center gap-4 rounded-[22px] border p-4 text-left transition",
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                  : "border-stone-200 bg-white text-stone-800 hover:border-emerald-300 hover:bg-emerald-50/40",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                  selected ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                <TypeIcon size={22} aria-hidden="true" />
              </span>

              <span>
                <span className="block text-sm font-black">{label}</span>
                <span
                  className={[
                    "mt-1 block text-xs font-semibold",
                    selected ? "text-emerald-50" : "text-stone-500",
                  ].join(" ")}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {listingType !== "packaged" ? (
        <div className="mt-5">
          {canMutate ? (
            <AdminProduceNpiForm key={listingType} listingType={listingType} />
          ) : (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
              catalog.mutate permission is required to create a fresh-produce NPI draft.
            </div>
          )}
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-stone-950">Product Versions</h2>

                <p className="mt-1 text-sm text-stone-500">
                  {versions.length} records loaded
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="focus-ring h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-bold text-stone-700 outline-none"
                >
                  <option value="current">Current governance queue</option>
                  <option value="draft">Draft</option>
                  <option value="in_review">In review</option>
                  <option value="published">Published</option>
                </select>

                <Link
                  to="/admin/listing-history"
                  className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-black text-stone-700 hover:bg-stone-50"
                >
                  <History size={15} aria-hidden="true" />
                  Listing History
                </Link>
              </div>
            </div>
          </section>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {actionNotice ? (
            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-700">
              {actionNotice}
            </div>
          ) : null}

          <section className="mt-5">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-[20px] border border-stone-200 bg-white"
                  />
                ))}
              </div>
            ) : filteredVersions.length > 0 ? (
              <div className="space-y-3">
                {filteredVersions.map((version) => (
                  <article
                    key={version.id || version._id}
                    className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Package size={20} aria-hidden="true" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-black text-stone-950">
                              {version.displayName || "Unnamed product"}
                            </h2>

                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusClasses(
                                version.publicationStatus
                              )}`}
                            >
                              {version.publicationStatus || "draft"}
                            </span>
                          </div>

                          <p className="mt-1 text-xs font-semibold text-stone-500">
                            Version {version.version || 1}
                            {" · "}
                            {version.gtin || "No GTIN"}
                          </p>

                          <p className="mt-1 break-all text-[11px] font-semibold text-stone-400">
                            Pack ID: {version.packId || "—"}
                          </p>

                          <p className="mt-1 break-all text-[11px] font-semibold text-stone-400">
                            ProductVersion ID: {version.id || version._id || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {version.publicationStatus === "draft" ? (
                          <button
                            type="button"
                            disabled={mutating}
                            onClick={() => handleSubmitForReview(version)}
                            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                          >
                            <Send size={15} aria-hidden="true" />
                            Submit for review
                          </button>
                        ) : null}

                        {version.publicationStatus === "in_review" ? (
                          <button
                            type="button"
                            disabled={mutating}
                            onClick={() => handlePublish(version)}
                            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60"
                          >
                            <BadgeCheck size={15} aria-hidden="true" />
                            Publish ProductVersion
                          </button>
                        ) : null}

                        {version.publicationStatus === "published" ? (
                          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-800">
                            <BadgeCheck size={15} aria-hidden="true" />
                            Canonical published
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-stone-200 bg-white p-7 text-sm text-stone-500">
                No Product Versions match this filter.
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
