import {
  BadgeCheck,
  FileCheck2,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";

import {
  createHostBrandClaim,
  createHostBrandIdentityCheck,
  createHostBrandOverride,
  getBrandWorld,
  listBrandWorlds,
  listHostBrandAuthorities,
  listHostBrandClaims,
  listHostBrandIdentityChecks,
  listHostBrandOverrides,
  submitHostBrandOverride,
} from "../services/brandAuthority.service";

const CLAIM_TYPES = ["owner", "licensee", "distributor"];

const IDENTITY_TYPES = [
  "trademark",
  "corporate_domain",
  "authorization_letter",
  "gs1_company_identity",
  "manufacturer_document",
  "packaging_label",
  "other",
];

const OVERRIDE_FIELDS = [
  "display_name",
  "description",
  "pack_images",
  "ingredient_declaration",
  "allergens",
  "nutrition",
  "dietary_flags",
  "certifications",
  "claims",
  "manufacturer",
  "importer",
  "country_of_origin",
  "net_quantity",
  "preparation_instructions",
  "storage_instructions",
  "category_attributes",
  "packaging",
];

const CRITICAL_FIELDS = new Set([
  "ingredient_declaration",
  "allergens",
  "nutrition",
  "dietary_flags",
  "certifications",
  "claims",
  "net_quantity",
]);

function parseCsv(value) {
  return [
    ...new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to complete this brand request."
  );
}

function StatusPill({ value }) {
  return (
    <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-stone-600">
      {String(value || "unknown").replaceAll("_", " ")}
    </span>
  );
}

export default function HostBrandAuthorityPage() {
  const [brands, setBrands] = useState([]);

  const [checks, setChecks] = useState([]);

  const [claims, setClaims] = useState([]);

  const [authorities, setAuthorities] = useState([]);

  const [proposals, setProposals] = useState([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(null);

  const [success, setSuccess] = useState(null);

  const [identityForm, setIdentityForm] = useState({
    brandId: "",

    checkType: "trademark",

    evidenceReference: "",

    evidenceSummary: "",

    sourceAuthority: "",
  });

  const [claimForm, setClaimForm] = useState({
    brandId: "",

    claimType: "owner",

    markets: "IN",

    evidenceCheckId: "",

    statement: "",
  });

  const [overrideForm, setOverrideForm] = useState({
    authorityGrantId: "",

    packId: "",

    markets: "IN",

    fieldKey: "description",

    proposedValue: "",

    changeReason: "",

    evidenceCheckId: "",
  });

  const [authorityBrandWorld, setAuthorityBrandWorld] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);

    setError(null);

    try {
      const [
        brandResult,
        checkResult,
        claimResult,
        authorityResult,
        proposalResult,
      ] = await Promise.all([
        listBrandWorlds({
          limit: 100,
        }),

        listHostBrandIdentityChecks({
          limit: 100,

          status: "all",
        }),

        listHostBrandClaims({
          limit: 100,

          status: "all",
        }),

        listHostBrandAuthorities({
          limit: 100,

          status: "all",
        }),

        listHostBrandOverrides({
          limit: 100,

          status: "all",
        }),
      ]);

      setBrands(brandResult?.brands || []);

      setChecks(checkResult?.identityChecks || []);

      setClaims(claimResult?.claims || []);

      setAuthorities(authorityResult?.authorities || []);

      setProposals(proposalResult?.proposals || []);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const authority = authorities.find(
      (item) => item.id === overrideForm.authorityGrantId
    );

    if (!authority) {
      setAuthorityBrandWorld(null);

      return;
    }

    let active = true;

    getBrandWorld(authority.brandId)
      .then((result) => {
        if (active) {
          setAuthorityBrandWorld(result);
        }
      })
      .catch(() => {
        if (active) {
          setAuthorityBrandWorld(null);
        }
      });

    setOverrideForm((current) => ({
      ...current,

      markets: authority.marketCodes?.join(", ") || current.markets,
    }));

    return () => {
      active = false;
    };
  }, [authorities, overrideForm.authorityGrantId]);

  const availableProducts = useMemo(
    () =>
      (authorityBrandWorld?.productFamilies || []).flatMap(
        (family) => family.products || []
      ),
    [authorityBrandWorld]
  );

  const selectedProduct =
    availableProducts.find(
      (product) => product.packId === overrideForm.packId
    ) || null;

  const selectedAuthority =
    authorities.find(
      (authority) => authority.id === overrideForm.authorityGrantId
    ) || null;

  const claimEvidenceOptions = checks.filter(
    (check) => check.brandId === claimForm.brandId
  );

  const overrideEvidenceOptions = checks.filter(
    (check) =>
      check.brandId === selectedAuthority?.brandId &&
      check.status === "verified"
  );

  async function execute(operation, message) {
    if (busy) {
      return;
    }

    setBusy(true);

    setError(null);

    setSuccess(null);

    try {
      await operation();

      setSuccess(message);

      await loadAll();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  function submitIdentity(event) {
    event.preventDefault();

    execute(
      () =>
        createHostBrandIdentityCheck(identityForm.brandId, {
          checkType: identityForm.checkType,

          evidenceReference: identityForm.evidenceReference,

          evidenceSummary: identityForm.evidenceSummary,

          sourceAuthority: identityForm.sourceAuthority,
        }),
      "Brand proof submitted for review."
    );
  }

  function submitClaim(event) {
    event.preventDefault();

    execute(
      () =>
        createHostBrandClaim(claimForm.brandId, {
          claimType: claimForm.claimType,

          requestedMarketCodes: parseCsv(claimForm.markets),

          evidenceCheckIds: [claimForm.evidenceCheckId].filter(Boolean),

          statement: claimForm.statement,
        }),
      "Brand access request submitted for review."
    );
  }

  function submitOverrideDraft(event) {
    event.preventDefault();

    if (!selectedProduct) {
      setError("Choose a product before saving this update.");

      return;
    }

    const critical = CRITICAL_FIELDS.has(overrideForm.fieldKey);

    execute(
      () =>
        createHostBrandOverride({
          authorityGrantId: overrideForm.authorityGrantId,

          productFamilyId: selectedProduct.productFamilyId,

          productVariantId: selectedProduct.productVariantId,

          packId: selectedProduct.packId,

          baseProductVersionId: selectedProduct.currentVersion?.id,

          marketCodes: parseCsv(overrideForm.markets),

          fieldChanges: [
            {
              fieldKey: overrideForm.fieldKey,

              proposedValue: overrideForm.proposedValue,

              changeReason: overrideForm.changeReason,

              evidenceCheckIds:
                critical && overrideForm.evidenceCheckId
                  ? [overrideForm.evidenceCheckId]
                  : [],
            },
          ],
        }),
      "Product update draft saved."
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <section className="bg-[#f7f5ef]">
        <div className="page-shell pb-3 pt-0 sm:pb-4 sm:pt-0">
          <div className="rounded-[22px] border border-[#cfe4dc] bg-[linear-gradient(135deg,#e9f7f1_0%,#eef7fb_54%,#f4f1fb_100%)] p-3.5 shadow-[0_12px_30px_rgba(28,74,63,0.08)] sm:rounded-[26px] sm:p-5 lg:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#23614f] ring-1 ring-[#cce4da] sm:text-[10px]">
                  <ShieldCheck size={12} aria-hidden="true" />
                  Brand access
                </div>

                <h1 className="mt-2 text-xl font-black tracking-[-0.035em] text-stone-950 sm:mt-3 sm:text-3xl">
                  Manage Your Brand
                </h1>

                <p className="mt-1 max-w-3xl text-[10px] font-semibold leading-4 text-stone-600 sm:mt-1.5 sm:text-sm sm:leading-5">
                  Prove your connection to a brand, request permission to manage it, and submit product detail updates for review.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <Link
                  to="/host/marketplace"
                  className="focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-[11px] border border-[#cbded7] bg-white/90 px-2.5 text-[9px] font-black text-[#28594b] shadow-sm sm:min-h-10 sm:rounded-[14px] sm:px-4 sm:text-xs"
                >
                  <Store size={13} aria-hidden="true" />
                  <span className="hidden sm:inline">Pricing & Stock</span>
                  <span className="sm:hidden">Next</span>
                </Link>

                <button
                  type="button"
                  onClick={loadAll}
                  className="focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-[11px] border border-[#b9d9cc] bg-[#dff2e9] px-2.5 text-[9px] font-black text-[#1d5f4d] shadow-sm sm:min-h-10 sm:rounded-[14px] sm:px-4 sm:text-xs"
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 lg:grid-cols-4">
              {[
                {
                  number: "01",
                  title: "Add brand proof",
                  text: "Share a trusted document or link that connects your business to the brand.",
                  className: "border-[#c8e7da] bg-[#e4f6ed]",
                },
                {
                  number: "02",
                  title: "Request brand access",
                  text: "Tell EPANTRY whether you are the owner, licensee or distributor.",
                  className: "border-[#cde2ec] bg-[#e8f4f9]",
                },
                {
                  number: "03",
                  title: "Wait for approval",
                  text: "Approved access appears below and unlocks brand-managed product updates.",
                  className: "border-[#ddd5ef] bg-[#f0ecf8]",
                },
                {
                  number: "04",
                  title: "Update & continue",
                  text: "Suggest product updates, then continue to Pricing & Stock when ready.",
                  className: "border-[#c8e7da] bg-[#e4f6ed]",
                },
              ].map((step) => (
                <div
                  key={step.number}
                  className={`min-w-0 rounded-[14px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.className}`}
                >
                  <div className="flex items-start gap-2 sm:gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/90 text-[8px] font-black text-stone-900 shadow-sm sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>

                    <div className="min-w-0">
                      <p className="text-[10px] font-black leading-3.5 text-stone-900 sm:text-xs sm:leading-4">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold leading-3 text-stone-600 sm:mt-1 sm:text-[10px] sm:leading-3.5">
                        {step.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-3 pb-5 pt-0 sm:space-y-4 sm:pb-7">
        {error && (
          <div className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 sm:p-4 sm:text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 sm:p-4 sm:text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="h-[320px] animate-pulse rounded-[22px] border border-stone-200 bg-white sm:h-[420px] sm:rounded-[28px]" />
        ) : (
          <>
            <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
              <form
                onSubmit={submitIdentity}
                className="rounded-[18px] border border-[#cfe6dc] bg-[#edf9f3] p-3.5 shadow-[0_10px_24px_rgba(31,92,72,0.07)] sm:rounded-[24px] sm:p-5"
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-white/85 text-[#197457] shadow-sm sm:size-9 sm:rounded-[13px]">
                    <FileCheck2 size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      1. Prove your connection to the brand
                    </h2>
                    <p className="mt-0.5 text-[9px] font-semibold leading-3.5 text-stone-500 sm:text-xs sm:leading-4">
                      Use a trusted source such as a trademark record, authorization letter, company document or packaging proof.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
                  <select
                    required
                    value={identityForm.brandId}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,
                        brandId: event.target.value,
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d7e5df] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                  >
                    <option value="">Choose the brand you represent</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.displayName || brand.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={identityForm.checkType}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,
                        checkType: event.target.value,
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d7e5df] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                  >
                    {IDENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>

                  <input
                    required
                    value={identityForm.evidenceReference}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,
                        evidenceReference: event.target.value,
                      })
                    }
                    placeholder="Paste the evidence link or document reference"
                    className="focus-ring h-10 rounded-[11px] border border-[#d7e5df] bg-white px-3 text-xs sm:h-11 sm:rounded-xl sm:text-sm"
                  />

                  <input
                    value={identityForm.sourceAuthority}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,
                        sourceAuthority: event.target.value,
                      })
                    }
                    placeholder="Who issued or owns this evidence? (optional)"
                    className="focus-ring h-10 rounded-[11px] border border-[#d7e5df] bg-white px-3 text-xs sm:h-11 sm:rounded-xl sm:text-sm"
                  />

                  <textarea
                    value={identityForm.evidenceSummary}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,
                        evidenceSummary: event.target.value,
                      })
                    }
                    placeholder="Briefly explain how this proves your connection to the brand"
                    rows={3}
                    className="focus-ring rounded-[11px] border border-[#d7e5df] bg-white p-3 text-xs sm:rounded-xl sm:text-sm"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-[11px] bg-[#167455] px-4 text-xs font-black text-white shadow-[0_6px_14px_rgba(22,116,85,0.16)] disabled:opacity-50 sm:min-h-11 sm:rounded-xl sm:text-sm"
                  >
                    {busy && (
                      <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                    )}
                    Send brand proof
                  </button>
                </div>
              </form>

              <form
                onSubmit={submitClaim}
                className="rounded-[18px] border border-[#d5e5ec] bg-[#eef7fb] p-3.5 shadow-[0_10px_24px_rgba(45,92,112,0.06)] sm:rounded-[24px] sm:p-5"
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-white/85 text-[#2c718e] shadow-sm sm:size-9 sm:rounded-[13px]">
                    <BadgeCheck size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      2. Request permission to manage the brand
                    </h2>
                    <p className="mt-0.5 text-[9px] font-semibold leading-3.5 text-stone-500 sm:text-xs sm:leading-4">
                      Tell EPANTRY your relationship with the brand and the market where you need access.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3">
                  <select
                    required
                    value={claimForm.brandId}
                    onChange={(event) =>
                      setClaimForm({
                        ...claimForm,
                        brandId: event.target.value,
                        evidenceCheckId: "",
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d8e4e9] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                  >
                    <option value="">Choose the brand you want to manage</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.displayName || brand.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={claimForm.claimType}
                    onChange={(event) =>
                      setClaimForm({
                        ...claimForm,
                        claimType: event.target.value,
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d8e4e9] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                  >
                    {CLAIM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "owner"
                          ? "Brand owner"
                          : type === "licensee"
                            ? "Licensed partner"
                            : "Authorized distributor"}
                      </option>
                    ))}
                  </select>

                  <input
                    required
                    value={claimForm.markets}
                    onChange={(event) =>
                      setClaimForm({
                        ...claimForm,
                        markets: event.target.value,
                      })
                    }
                    placeholder="Market code, for example IN"
                    className="focus-ring h-10 rounded-[11px] border border-[#d8e4e9] bg-white px-3 text-xs sm:h-11 sm:rounded-xl sm:text-sm"
                  />

                  <select
                    required
                    value={claimForm.evidenceCheckId}
                    onChange={(event) =>
                      setClaimForm({
                        ...claimForm,
                        evidenceCheckId: event.target.value,
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d8e4e9] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                  >
                    <option value="">Choose the brand proof you submitted</option>
                    {claimEvidenceOptions.map((check) => (
                      <option key={check.id} value={check.id}>
                        {check.checkType.replaceAll("_", " ")} - {check.status.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={claimForm.statement}
                    onChange={(event) =>
                      setClaimForm({
                        ...claimForm,
                        statement: event.target.value,
                      })
                    }
                    placeholder="Add any helpful context for the reviewer (optional)"
                    rows={3}
                    className="focus-ring rounded-[11px] border border-[#d8e4e9] bg-white p-3 text-xs sm:rounded-xl sm:text-sm"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="focus-ring min-h-10 rounded-[11px] bg-[#236b80] px-4 text-xs font-black text-white shadow-[0_6px_14px_rgba(35,107,128,0.14)] disabled:opacity-50 sm:min-h-11 sm:rounded-xl sm:text-sm"
                  >
                    Request brand access
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-[18px] border border-[#ddd7ea] bg-[#f5f2fa] p-3.5 shadow-[0_9px_22px_rgba(78,65,108,0.05)] sm:rounded-[24px] sm:p-5">
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-white/85 text-[#66528b] shadow-sm sm:size-9 sm:rounded-[13px]">
                  <PackageCheck size={17} aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    Your approved brand access
                  </h2>
                  <p className="mt-0.5 text-[9px] font-semibold leading-3.5 text-stone-500 sm:text-xs sm:leading-4">
                    Approved access shows which brand areas and markets your Host account can manage.
                  </p>
                </div>
              </div>

              {authorities.length > 0 ? (
                <div className="mt-3 grid gap-2.5 sm:mt-4 sm:gap-3 lg:grid-cols-2">
                  {authorities.map((authority) => (
                    <div
                      key={authority.id}
                      className="rounded-[14px] border border-[#ded9e8] bg-white/85 p-3 sm:rounded-[18px] sm:p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black capitalize text-stone-950 sm:text-sm">
                          {String(authority.authorityType || "brand access").replaceAll("_", " ")}
                        </p>
                        <StatusPill value={authority.status} />
                      </div>

                      <p className="mt-1.5 text-[9px] font-semibold text-stone-500 sm:mt-2 sm:text-xs">
                        Markets: {authority.marketCodes?.join(", ") || "Not listed"}
                      </p>
                      <p className="mt-1 text-[9px] font-semibold text-stone-500 sm:text-xs">
                        You can manage: {authority.scopes?.map((scope) => String(scope).replaceAll("_", " ")).join(", ") || "Not listed"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 sm:mt-4">
                  <EmptyState
                    title="No approved brand access yet"
                    description="Send brand proof first, then request brand access. Approved access will appear here."
                  />
                </div>
              )}
            </section>

            <form
              onSubmit={submitOverrideDraft}
              className="rounded-[18px] border border-[#cfe1e4] bg-[linear-gradient(135deg,#eef8f5_0%,#eef6fa_100%)] p-3.5 shadow-[0_10px_24px_rgba(38,91,90,0.06)] sm:rounded-[24px] sm:p-5"
            >
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-[11px] bg-white/85 text-[#236b70] shadow-sm sm:size-9 sm:rounded-[13px]">
                  <Send size={17} aria-hidden="true" />
                </div>

                <div>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    3. Suggest a product detail update
                  </h2>
                  <p className="mt-0.5 text-[9px] font-semibold leading-3.5 text-stone-500 sm:text-xs sm:leading-4">
                    After brand access is approved, use this section to correct or improve product information. EPANTRY reviews the change before it goes live.
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 md:grid-cols-2">
                <select
                  required
                  value={overrideForm.authorityGrantId}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      authorityGrantId: event.target.value,
                      packId: "",
                    })
                  }
                  className="focus-ring h-10 rounded-[11px] border border-[#d6e3e2] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                >
                  <option value="">Choose approved brand access</option>
                  {authorities
                    .filter((authority) => authority.status === "active")
                    .map((authority) => (
                      <option key={authority.id} value={authority.id}>
                        {authority.brandId} - {String(authority.authorityType || "access").replaceAll("_", " ")}
                      </option>
                    ))}
                </select>

                <select
                  required
                  value={overrideForm.packId}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      packId: event.target.value,
                    })
                  }
                  className="focus-ring h-10 rounded-[11px] border border-[#d6e3e2] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                >
                  <option value="">Choose the product to update</option>
                  {availableProducts.map((product) => (
                    <option key={product.packId} value={product.packId}>
                      {product.currentVersion?.displayName || product.familyName} - {product.packName}
                    </option>
                  ))}
                </select>

                <select
                  value={overrideForm.fieldKey}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      fieldKey: event.target.value,
                    })
                  }
                  className="focus-ring h-10 rounded-[11px] border border-[#d6e3e2] bg-white px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm"
                >
                  {OVERRIDE_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {field.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                <input
                  required
                  value={overrideForm.markets}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      markets: event.target.value,
                    })
                  }
                  placeholder="Market code, for example IN"
                  className="focus-ring h-10 rounded-[11px] border border-[#d6e3e2] bg-white px-3 text-xs sm:h-11 sm:rounded-xl sm:text-sm"
                />

                <textarea
                  required
                  value={overrideForm.proposedValue}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      proposedValue: event.target.value,
                    })
                  }
                  placeholder="Enter the corrected product detail"
                  rows={3}
                  className="focus-ring rounded-[11px] border border-[#d6e3e2] bg-white p-3 text-xs sm:rounded-xl sm:text-sm md:col-span-2"
                />

                <textarea
                  required
                  value={overrideForm.changeReason}
                  onChange={(event) =>
                    setOverrideForm({
                      ...overrideForm,
                      changeReason: event.target.value,
                    })
                  }
                  placeholder="Briefly explain why this product detail should change"
                  rows={3}
                  className="focus-ring rounded-[11px] border border-[#d6e3e2] bg-white p-3 text-xs sm:rounded-xl sm:text-sm md:col-span-2"
                />

                {CRITICAL_FIELDS.has(overrideForm.fieldKey) && (
                  <select
                    required
                    value={overrideForm.evidenceCheckId}
                    onChange={(event) =>
                      setOverrideForm({
                        ...overrideForm,
                        evidenceCheckId: event.target.value,
                      })
                    }
                    className="focus-ring h-10 rounded-[11px] border border-[#d8d1e6] bg-[#f7f4fb] px-3 text-xs text-stone-800 sm:h-11 sm:rounded-xl sm:text-sm md:col-span-2"
                  >
                    <option value="">Choose verified proof for this sensitive detail</option>
                    {overrideEvidenceOptions.map((check) => (
                      <option key={check.id} value={check.id}>
                        {check.checkType.replaceAll("_", " ")} - {check.evidenceReference}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="focus-ring min-h-10 rounded-[11px] bg-[#167455] px-4 text-xs font-black text-white shadow-[0_6px_14px_rgba(22,116,85,0.15)] disabled:opacity-50 sm:min-h-11 sm:rounded-xl sm:text-sm md:col-span-2"
                >
                  Save product update draft
                </button>
              </div>
            </form>

            <section className="grid gap-3 sm:gap-4 xl:grid-cols-2">
              <div className="rounded-[18px] border border-[#d7e6df] bg-[#f4faf7] p-3.5 shadow-[0_8px_20px_rgba(31,92,72,0.04)] sm:rounded-[24px] sm:p-5">
                <div>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    Brand access requests
                  </h2>
                  <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-xs">
                    Track the requests you sent to manage a brand.
                  </p>
                </div>

                <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {claims.length > 0 ? (
                    claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="rounded-[14px] border border-[#d8e5df] bg-white/90 p-3 sm:rounded-[18px] sm:p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black capitalize text-stone-950 sm:text-sm">
                            {claim.claimType === "owner"
                              ? "Brand owner"
                              : claim.claimType === "licensee"
                                ? "Licensed partner"
                                : "Authorized distributor"}
                          </p>
                          <StatusPill value={claim.status} />
                        </div>

                        <p className="mt-1.5 break-all text-[9px] font-semibold text-stone-500 sm:mt-2 sm:text-xs">
                          Brand reference: {claim.brandId}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] font-semibold text-stone-500 sm:text-sm">
                      No brand access requests yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[18px] border border-[#d8e1e8] bg-[#f3f8fb] p-3.5 shadow-[0_8px_20px_rgba(45,92,112,0.04)] sm:rounded-[24px] sm:p-5">
                <div>
                  <h2 className="text-sm font-black text-stone-950 sm:text-base">
                    Product update requests
                  </h2>
                  <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-xs">
                    Review saved product changes and send drafts for approval.
                  </p>
                </div>

                <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {proposals.length > 0 ? (
                    proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-[14px] border border-[#d8e2e8] bg-white/90 p-3 sm:rounded-[18px] sm:p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black capitalize text-stone-950 sm:text-sm">
                            {proposal.fieldChanges?.[0]?.fieldKey?.replaceAll("_", " ") || "Product detail update"}
                          </p>
                          <StatusPill value={proposal.status} />
                        </div>

                        {proposal.status === "draft" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              execute(
                                () => submitHostBrandOverride(proposal.id),
                                "Product update sent for review."
                              )
                            }
                            className="focus-ring mt-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[#236b80] px-3 text-[9px] font-black text-white disabled:opacity-50 sm:mt-3 sm:min-h-9 sm:px-3.5 sm:text-xs"
                          >
                            <Send size={12} aria-hidden="true" />
                            Send for review
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] font-semibold text-stone-500 sm:text-sm">
                      No product update requests yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
