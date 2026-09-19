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
    "Unable to complete Brand Authority request."
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
      "Identity evidence submitted."
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
      "Brand Claim submitted for review."
    );
  }

  function submitOverrideDraft(event) {
    event.preventDefault();

    if (!selectedProduct) {
      setError("Choose a canonical Product Pack.");

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
      "Brand Content Override draft created."
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-stone-200 bg-white">
        <div className="page-shell py-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                <ShieldCheck size={13} aria-hidden="true" />
                Host Brand Authority
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950">
                Brand Authority Workspace
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                Submit Brand ownership evidence, request scoped authority and
                propose governed canonical changes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/host/marketplace"
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full border border-stone-200 bg-white px-4 text-xs font-black text-stone-700"
              >
                <Store size={15} aria-hidden="true" />
                Marketplace
              </Link>

              <button
                type="button"
                onClick={loadAll}
                className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full bg-stone-950 px-4 text-xs font-black text-white"
              >
                <RefreshCw size={15} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="page-shell space-y-6 py-7">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            {success}
          </div>
        )}

        {loading ? (
          <div className="h-[420px] animate-pulse rounded-[28px] border border-stone-200 bg-white" />
        ) : (
          <>
            <section className="grid gap-5 xl:grid-cols-2">
              <form
                onSubmit={submitIdentity}
                className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <FileCheck2
                    size={20}
                    className="text-emerald-700"
                    aria-hidden="true"
                  />

                  <div>
                    <h2 className="font-black text-stone-950">
                      1. Identity Evidence
                    </h2>

                    <p className="text-xs text-stone-400">
                      Evidence does not grant authority by itself.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <select
                    required
                    value={identityForm.brandId}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,

                        brandId: event.target.value,
                      })
                    }
                    className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  >
                    <option value="">Choose canonical Brand</option>

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
                    className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
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
                    placeholder="Evidence URL / controlled asset reference"
                    className="focus-ring h-11 rounded-xl border border-stone-200 px-3 text-sm"
                  />

                  <input
                    value={identityForm.sourceAuthority}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,

                        sourceAuthority: event.target.value,
                      })
                    }
                    placeholder="Source authority"
                    className="focus-ring h-11 rounded-xl border border-stone-200 px-3 text-sm"
                  />

                  <textarea
                    value={identityForm.evidenceSummary}
                    onChange={(event) =>
                      setIdentityForm({
                        ...identityForm,

                        evidenceSummary: event.target.value,
                      })
                    }
                    placeholder="Evidence summary"
                    rows={3}
                    className="focus-ring rounded-xl border border-stone-200 p-3 text-sm"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {busy && (
                      <LoaderCircle
                        size={15}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    Submit Evidence
                  </button>
                </div>
              </form>

              <form
                onSubmit={submitClaim}
                className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <BadgeCheck
                    size={20}
                    className="text-emerald-700"
                    aria-hidden="true"
                  />

                  <div>
                    <h2 className="font-black text-stone-950">
                      2. Brand Claim
                    </h2>

                    <p className="text-xs text-stone-400">
                      Platform verification is required.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
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
                    className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  >
                    <option value="">Choose Brand</option>

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
                    className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  >
                    {CLAIM_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
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
                    placeholder="Markets, e.g. IN"
                    className="focus-ring h-11 rounded-xl border border-stone-200 px-3 text-sm"
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
                    className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                  >
                    <option value="">Choose submitted evidence</option>

                    {claimEvidenceOptions.map((check) => (
                      <option key={check.id} value={check.id}>
                        {check.checkType} — {check.status}
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
                    placeholder="Claim statement"
                    rows={3}
                    className="focus-ring rounded-xl border border-stone-200 p-3 text-sm"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="focus-ring min-h-11 rounded-xl bg-stone-950 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    Submit Brand Claim
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <PackageCheck
                  size={20}
                  className="text-emerald-700"
                  aria-hidden="true"
                />

                <div>
                  <h2 className="font-black text-stone-950">
                    Verified Authorities
                  </h2>

                  <p className="text-xs text-stone-400">
                    Scoped authority only. This is not a new application role.
                  </p>
                </div>
              </div>

              {authorities.length > 0 ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {authorities.map((authority) => (
                    <div
                      key={authority.id}
                      className="rounded-2xl border border-stone-200 bg-[#f7f5ef] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-stone-950">
                          {authority.authorityType}
                        </p>

                        <StatusPill value={authority.status} />
                      </div>

                      <p className="mt-2 text-xs text-stone-500">
                        Markets: {authority.marketCodes?.join(", ") || "—"}
                      </p>

                      <p className="mt-1 text-xs text-stone-500">
                        Scopes: {authority.scopes?.join(", ") || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState
                    title="No verified authority yet"
                    description="Submit evidence and a Brand Claim first."
                  />
                </div>
              )}
            </section>

            <form
              onSubmit={submitOverrideDraft}
              className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Send
                  size={20}
                  className="text-emerald-700"
                  aria-hidden="true"
                />

                <div>
                  <h2 className="font-black text-stone-950">
                    3. Content Override Proposal
                  </h2>

                  <p className="text-xs text-stone-400">
                    Creates a proposal only. It never directly overwrites
                    canonical Product truth.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
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
                  className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                >
                  <option value="">Choose active authority</option>

                  {authorities
                    .filter((authority) => authority.status === "active")
                    .map((authority) => (
                      <option key={authority.id} value={authority.id}>
                        {authority.brandId} — {authority.authorityType}
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
                  className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
                >
                  <option value="">Choose canonical Pack</option>

                  {availableProducts.map((product) => (
                    <option key={product.packId} value={product.packId}>
                      {product.currentVersion?.displayName ||
                        product.familyName}{" "}
                      — {product.packName}
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
                  className="focus-ring h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm"
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
                  placeholder="Markets"
                  className="focus-ring h-11 rounded-xl border border-stone-200 px-3 text-sm"
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
                  placeholder="Proposed canonical value"
                  rows={4}
                  className="focus-ring rounded-xl border border-stone-200 p-3 text-sm md:col-span-2"
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
                  placeholder="Why is this canonical change required?"
                  rows={3}
                  className="focus-ring rounded-xl border border-stone-200 p-3 text-sm md:col-span-2"
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
                    className="focus-ring h-11 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm md:col-span-2"
                  >
                    <option value="">
                      Critical field — choose verified evidence
                    </option>

                    {overrideEvidenceOptions.map((check) => (
                      <option key={check.id} value={check.id}>
                        {check.checkType} — {check.evidenceReference}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="focus-ring min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white md:col-span-2 disabled:opacity-50"
                >
                  Create Override Draft
                </button>
              </div>
            </form>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-stone-950">Claims</h2>

                <div className="mt-4 space-y-3">
                  {claims.length > 0 ? (
                    claims.map((claim) => (
                      <div
                        key={claim.id}
                        className="rounded-2xl border border-stone-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-stone-950">
                            {claim.claimType}
                          </p>

                          <StatusPill value={claim.status} />
                        </div>

                        <p className="mt-2 break-all text-xs text-stone-400">
                          Brand: {claim.brandId}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-400">
                      No claims submitted.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-stone-950">
                  Override Proposals
                </h2>

                <div className="mt-4 space-y-3">
                  {proposals.length > 0 ? (
                    proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-2xl border border-stone-200 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-stone-950">
                            {proposal.fieldChanges?.[0]?.fieldKey ||
                              "Content proposal"}
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
                                "Override proposal submitted for platform review."
                              )
                            }
                            className="focus-ring mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-stone-950 px-3.5 text-xs font-black text-white disabled:opacity-50"
                          >
                            <Send size={13} aria-hidden="true" />
                            Submit for review
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-stone-400">
                      No content proposals yet.
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
