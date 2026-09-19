import {
  BadgeIndianRupee,
  Boxes,
  CheckCircle2,
  CircleAlert,
  MapPinned,
  PackagePlus,
  Pencil,
  RefreshCw,
  Store,
  Warehouse,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router-dom";

import { getCatalogProducts } from "../../grocery/services/catalog.service";

import {
  createHostOffer,
  createHostPriceRule,
  createInventoryNode,
  createInventorySnapshots,
  createServiceArea,
  getHostCurrentInventory,
  getHostEffectivePrice,
  getHostMarketplaceOrganization,
  getHostOfferReadiness,
  activateHostOffer,
  listHostOffers,
  listInventoryNodes,
  listServiceAreas,
  updateHostOffer,
} from "../services/marketplace.service";

function getErrorMessage(error) {
  return error?.message || "Something went wrong.";
}

function moneyFromMinor(amountMinor, currency = "INR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",

    currency,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon size={18} aria-hidden="true" />
        </div>

        <div>
          <h2 className="font-black text-stone-950">{title}</h2>

          {description && (
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
        {label}
      </span>

      {children}
    </label>
  );
}

const inputClassName =
  "focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none";

export default function HostMarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const scannedPackId = String(searchParams.get("packId") || "").trim();

  const requestedEditOfferId = String(searchParams.get("editOffer") || "").trim();

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState(null);

  const [notice, setNotice] = useState(null);

  const [organization, setOrganization] = useState(null);

  const [offers, setOffers] = useState([]);

  const [publishedProducts, setPublishedProducts] = useState([]);

  const [inventoryNodes, setInventoryNodes] = useState([]);

  const [serviceAreas, setServiceAreas] = useState([]);

  const [selectedOfferId, setSelectedOfferId] = useState("");

  const [readiness, setReadiness] = useState(null);

  const [effectivePrice, setEffectivePrice] = useState(null);

  const [currentInventory, setCurrentInventory] = useState(null);

  const [offerForm, setOfferForm] = useState({
    packId: "",

    merchantSku: "",

    fulfillmentTypes: ["delivery"],
  });

  const [editingOfferId, setEditingOfferId] = useState("");

  const [editOfferForm, setEditOfferForm] = useState({
    merchantSku: "",
    fulfillmentTypes: ["delivery"],
    minimumOrderQuantity: 1,
    maximumOrderQuantity: "",
    externalReference: "",
  });

  const [priceForm, setPriceForm] = useState({
    listPrice: "",

    salePrice: "",

    changeReason: "",
  });

  const [nodeForm, setNodeForm] = useState({
    name: "",

    nodeType: "warehouse",

    city: "",

    state: "",

    postalCode: "",
  });

  const [inventoryForm, setInventoryForm] = useState({
    inventoryNodeId: "",

    availableQuantity: "0",

    reservedQuantity: "0",
  });

  const [serviceAreaForm, setServiceAreaForm] = useState({
    name: "",

    inventoryNodeId: "",

    postalCodes: "",

    fulfillmentTypes: ["delivery"],
  });

  const selectedPublishedProduct = useMemo(
    () =>
      publishedProducts.find(
        (product) => String(product.packId) === String(offerForm.packId)
      ) || null,
    [publishedProducts, offerForm.packId]
  );

  const existingOfferPackIds = useMemo(
    () => new Set(offers.map((offer) => String(offer.packId || ""))),
    [offers]
  );

  const selectedOffer = useMemo(
    () =>
      offers.find((offer) => String(offer.id) === String(selectedOfferId)) ||
      null,
    [offers, selectedOfferId]
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);

    setError(null);

    try {
      const [
        organizationResult,
        offersResult,
        nodesResult,
        areasResult,
        catalogResult,
      ] = await Promise.all([
        getHostMarketplaceOrganization(),

        listHostOffers(),

        listInventoryNodes(),

        listServiceAreas(),

        getCatalogProducts({
          page: 1,
          limit: 100,
        }),
      ]);

      const nextOffers = (offersResult?.offers || offersResult?.hostOffers || []).filter(
        (offer) => offer.status !== "retired"
      );

      setOrganization(
        organizationResult?.organization || organizationResult || null
      );

      setOffers(nextOffers);

      setPublishedProducts(catalogResult?.products || []);

      setInventoryNodes(nodesResult?.inventoryNodes || []);

      setServiceAreas(areasResult?.serviceAreas || []);

      setSelectedOfferId((current) => {
        if (
          current &&
          nextOffers.some((offer) => String(offer.id) === String(current))
        ) {
          return current;
        }

        return nextOffers[0]?.id || "";
      });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelectedOfferState = useCallback(async (offerId) => {
    if (!offerId) {
      setReadiness(null);

      setEffectivePrice(null);

      setCurrentInventory(null);

      return;
    }

    const results = await Promise.allSettled([
      getHostOfferReadiness(offerId),

      getHostEffectivePrice(offerId),

      getHostCurrentInventory(offerId),
    ]);

    const readinessResult = results[0];

    const priceResult = results[1];

    const inventoryResult = results[2];

    setReadiness(
      readinessResult.status === "fulfilled" ? readinessResult.value : null
    );

    if (priceResult.status === "fulfilled") {
      setEffectivePrice(
        priceResult.value?.effectivePrice ||
          priceResult.value?.priceRule ||
          priceResult.value ||
          null
      );
    } else {
      setEffectivePrice(null);
    }

    setCurrentInventory(
      inventoryResult.status === "fulfilled" ? inventoryResult.value : null
    );
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!scannedPackId) {
      return;
    }

    setOfferForm((current) =>
      current.packId
        ? current
        : {
            ...current,

            packId: scannedPackId,
          }
    );
  }, [scannedPackId]);

  useEffect(() => {
    if (
      !requestedEditOfferId ||
      loading ||
      editingOfferId === requestedEditOfferId
    ) {
      return;
    }

    const offer = offers.find(
      (item) => String(item.id) === requestedEditOfferId
    );

    if (offer) {
      startEditOffer(offer);
    }
  }, [requestedEditOfferId, loading, offers, editingOfferId]);

  useEffect(() => {
    loadSelectedOfferState(selectedOfferId);
  }, [selectedOfferId, loadSelectedOfferState]);

  async function runMutation(callback, successMessage) {
    setBusy(true);

    setError(null);

    setNotice(null);

    try {
      await callback();

      setNotice(successMessage);

      await loadWorkspace();

      if (selectedOfferId) {
        await loadSelectedOfferState(selectedOfferId);
      }

      return true;
    } catch (nextError) {
      setError(getErrorMessage(nextError));

      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateOffer(event) {
    event.preventDefault();

    const success = await runMutation(async () => {
      const result = await createHostOffer({
        packId: offerForm.packId.trim(),

        merchantSku: offerForm.merchantSku.trim(),

        fulfillmentTypes: offerForm.fulfillmentTypes,
      });

      const createdOffer = result?.offer || null;

      if (createdOffer?.id) {
        setSelectedOfferId(createdOffer.id);
      }
    }, "Host Offer created.");

    if (success) {
      setOfferForm({
        packId: "",

        merchantSku: "",

        fulfillmentTypes: ["delivery"],
      });
    }
  }

  function startEditOffer(offer) {
    setSelectedOfferId(offer.id);
    setEditingOfferId(offer.id);
    setEditOfferForm({
      merchantSku: offer.merchantSku || "",
      fulfillmentTypes: offer.fulfillmentTypes?.length
        ? offer.fulfillmentTypes
        : ["delivery"],
      minimumOrderQuantity: Number(offer.minimumOrderQuantity || 1),
      maximumOrderQuantity:
        offer.maximumOrderQuantity === null ||
        offer.maximumOrderQuantity === undefined
          ? ""
          : Number(offer.maximumOrderQuantity),
      externalReference: offer.externalReference || "",
    });
  }

  function cancelEditOffer() {
    setEditingOfferId("");
    setEditOfferForm({
      merchantSku: "",
      fulfillmentTypes: ["delivery"],
      minimumOrderQuantity: 1,
      maximumOrderQuantity: "",
      externalReference: "",
    });

    if (requestedEditOfferId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("editOffer");
      setSearchParams(nextParams, { replace: true });
    }
  }

  async function handleSaveOffer(event) {
    event.preventDefault();

    if (!editingOfferId) {
      return;
    }

    const success = await runMutation(
      () =>
        updateHostOffer(editingOfferId, {
          merchantSku: editOfferForm.merchantSku.trim(),
          fulfillmentTypes: editOfferForm.fulfillmentTypes,
          minimumOrderQuantity: Number(editOfferForm.minimumOrderQuantity || 1),
          maximumOrderQuantity:
            editOfferForm.maximumOrderQuantity === ""
              ? null
              : Number(editOfferForm.maximumOrderQuantity),
          externalReference: editOfferForm.externalReference.trim(),
        }),
      "Grocery listing updated."
    );

    if (success) {
      cancelEditOffer();
    }
  }


  async function handleCreatePrice(event) {
    event.preventDefault();

    if (!selectedOfferId) {
      return;
    }

    const listAmountMinor = Math.round(Number(priceForm.listPrice) * 100);

    const saleAmountMinor = priceForm.salePrice
      ? Math.round(Number(priceForm.salePrice) * 100)
      : null;

    const success = await runMutation(
      () =>
        createHostPriceRule(selectedOfferId, {
          listPrice: {
            amountMinor: listAmountMinor,

            currency: "INR",
          },

          salePrice:
            saleAmountMinor === null
              ? null
              : {
                  amountMinor: saleAmountMinor,

                  currency: "INR",
                },

          effectiveFrom: new Date().toISOString(),

          effectiveTo: null,

          source: "manual",

          changeReason: priceForm.changeReason.trim(),
        }),
      "Price Rule recorded."
    );

    if (success) {
      setPriceForm({
        listPrice: "",

        salePrice: "",

        changeReason: "",
      });
    }
  }

  async function handleCreateNode(event) {
    event.preventDefault();

    const success = await runMutation(
      () =>
        createInventoryNode({
          name: nodeForm.name.trim(),

          nodeType: nodeForm.nodeType,

          address: {
            city: nodeForm.city.trim(),

            state: nodeForm.state.trim(),

            postalCode: nodeForm.postalCode.trim(),

            countryCode: "IN",
          },
        }),
      "Inventory Node created."
    );

    if (success) {
      setNodeForm({
        name: "",

        nodeType: "warehouse",

        city: "",

        state: "",

        postalCode: "",
      });
    }
  }

  async function handleInventorySnapshot(event) {
    event.preventDefault();

    if (!selectedOfferId) {
      return;
    }

    const success = await runMutation(
      () =>
        createInventorySnapshots([
          {
            offerId: selectedOfferId,

            inventoryNodeId: inventoryForm.inventoryNodeId,

            availableQuantity: Number(inventoryForm.availableQuantity),

            reservedQuantity: Number(inventoryForm.reservedQuantity),

            sourceType: "manual",

            sourceReference: "host-marketplace-ui",
          },
        ]),
      "Inventory Snapshot recorded."
    );

    if (success) {
      setInventoryForm((current) => ({
        ...current,

        availableQuantity: "0",

        reservedQuantity: "0",
      }));
    }
  }

  async function handleCreateServiceArea(event) {
    event.preventDefault();

    const postalCodes = serviceAreaForm.postalCodes
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const success = await runMutation(
      () =>
        createServiceArea({
          name: serviceAreaForm.name.trim(),

          inventoryNodeId: serviceAreaForm.inventoryNodeId || null,

          postalCodes,

          fulfillmentTypes: serviceAreaForm.fulfillmentTypes,
        }),
      "Service Area created."
    );

    if (success) {
      setServiceAreaForm({
        name: "",

        inventoryNodeId: "",

        postalCodes: "",

        fulfillmentTypes: ["delivery"],
      });
    }
  }

  async function handleActivateOffer() {
    if (!selectedOfferId) {
      return;
    }

    await runMutation(
      () => activateHostOffer(selectedOfferId),
      "Host Offer activated."
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-8">
          <div className="h-[680px] animate-pulse rounded-[28px] border border-stone-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell py-7 sm:py-10">
        <section className="rounded-[28px] bg-stone-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                <Store size={14} aria-hidden="true" />
                Host marketplace
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Pricing & Inventory
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
                Manage commercial Offers, prices, inventory nodes and delivery
                serviceability without changing canonical Product truth.
              </p>
            </div>

            <button
              type="button"
              onClick={loadWorkspace}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-stone-950"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                Organization
              </p>

              <p className="mt-1 font-black">
                {organization?.displayName || "Host organization"}
              </p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                Offers
              </p>

              <p className="mt-1 text-xl font-black">{offers.length}</p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                Inventory nodes
              </p>

              <p className="mt-1 text-xl font-black">{inventoryNodes.length}</p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            {notice}
          </div>
        )}

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <SectionCard
            title="Host Offers"
            description="Attach commercial identity to an existing canonical Pack."
            icon={PackagePlus}
          >
            <form onSubmit={handleCreateOffer} className="grid gap-3">
              <Field label="Published Product">
                <select
                  required
                  value={offerForm.packId}
                  onChange={(event) =>
                    setOfferForm((current) => ({
                      ...current,

                      packId: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">Select a canonical published product</option>

                  {publishedProducts.map((product) => {
                    const hasExistingOffer = existingOfferPackIds.has(
                      String(product.packId || "")
                    );

                    const quantity = product.netQuantity?.value
                      ? `${product.netQuantity.value} ${product.netQuantity.unit || ""}`.trim()
                      : product.pack?.name || "";

                    const brand = product.brand?.name || "Unbranded";
                    const gtin = product.gtin ? ` • GTIN ${product.gtin}` : "";
                    const packLabel = quantity ? ` • ${quantity}` : "";

                    return (
                      <option
                        key={product.productVersionId || product.id}
                        value={product.packId || ""}
                        disabled={!product.packId || hasExistingOffer}
                      >
                        {product.displayName || "Published product"} • {brand}
                        {packLabel}
                        {gtin}
                        {hasExistingOffer ? " • Offer already exists" : ""}
                      </option>
                    );
                  })}
                </select>

                <p className="mt-1.5 text-xs leading-5 text-stone-500">
                  Choose from Super Admin-published catalog products. Internal database IDs stay hidden from Host users.
                </p>

                {selectedPublishedProduct && (
                  <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 text-xs text-stone-700">
                    <p className="font-black text-stone-950">
                      {selectedPublishedProduct.displayName}
                    </p>
                    <p className="mt-1">
                      Brand: {selectedPublishedProduct.brand?.name || "Unbranded"}
                      {selectedPublishedProduct.gtin
                        ? ` • GTIN: ${selectedPublishedProduct.gtin}`
                        : ""}
                      {selectedPublishedProduct.netQuantity?.value
                        ? ` • Pack: ${selectedPublishedProduct.netQuantity.value} ${selectedPublishedProduct.netQuantity.unit || ""}`
                        : ""}
                    </p>
                  </div>
                )}

                {!loading && publishedProducts.length === 0 && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    No canonical published products are available yet. A Super Admin must publish a Product Version before a Host Offer can be created.
                  </p>
                )}
              </Field>

              <Field label="Merchant SKU">
                <input
                  value={offerForm.merchantSku}
                  onChange={(event) =>
                    setOfferForm((current) => ({
                      ...current,

                      merchantSku: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  placeholder="Optional internal SKU"
                />
              </Field>

              <button
                disabled={busy}
                className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
              >
                Create Offer
              </button>
            </form>

            {editingOfferId ? (
              <form
                onSubmit={handleSaveOffer}
                className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-stone-950">
                      Edit grocery listing
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Canonical Pack identity stays unchanged; commercial listing details can be edited.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={cancelEditOffer}
                    className="focus-ring rounded-xl border border-stone-200 bg-white p-2 text-stone-600"
                    aria-label="Cancel grocery listing edit"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Merchant SKU">
                    <input
                      value={editOfferForm.merchantSku}
                      onChange={(event) =>
                        setEditOfferForm((current) => ({
                          ...current,
                          merchantSku: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="External reference">
                    <input
                      value={editOfferForm.externalReference}
                      onChange={(event) =>
                        setEditOfferForm((current) => ({
                          ...current,
                          externalReference: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Minimum order quantity">
                    <input
                      type="number"
                      min="1"
                      value={editOfferForm.minimumOrderQuantity}
                      onChange={(event) =>
                        setEditOfferForm((current) => ({
                          ...current,
                          minimumOrderQuantity: event.target.value,
                        }))
                      }
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Maximum order quantity">
                    <input
                      type="number"
                      min="1"
                      value={editOfferForm.maximumOrderQuantity}
                      onChange={(event) =>
                        setEditOfferForm((current) => ({
                          ...current,
                          maximumOrderQuantity: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      placeholder="No maximum"
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
                    Fulfillment
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {["delivery", "pickup"].map((type) => {
                      const active = editOfferForm.fulfillmentTypes.includes(type);

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setEditOfferForm((current) => {
                              const next = active
                                ? current.fulfillmentTypes.filter(
                                    (item) => item !== type
                                  )
                                : [...current.fulfillmentTypes, type];

                              return {
                                ...current,
                                fulfillmentTypes: next.length ? next : [type],
                              };
                            })
                          }
                          className={[
                            "focus-ring rounded-xl px-3 py-2 text-xs font-black",
                            active
                              ? "bg-emerald-700 text-white"
                              : "border border-stone-200 bg-white text-stone-600",
                          ].join(" ")}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  disabled={busy || !editOfferForm.fulfillmentTypes.length}
                  className="focus-ring mt-4 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  Save Listing Changes
                </button>
              </form>
            ) : null}

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <Field label="Offer used for pricing & inventory operations">
                <select
                  value={selectedOfferId}
                  onChange={(event) => setSelectedOfferId(event.target.value)}
                  className={inputClassName}
                  disabled={!offers.length}
                >
                  {!offers.length ? (
                    <option value="">No active Host Offers yet</option>
                  ) : null}

                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.merchantSku || offer.offerKey || offer.id} · {offer.status}
                    </option>
                  ))}
                </select>
              </Field>

              <p className="mt-3 text-xs leading-5 text-stone-500">
                Full Grocery listing history plus Edit/Delete actions now live in the dedicated Listing History page.
              </p>
            </div>

          </SectionCard>

          <SectionCard
            title="Offer readiness"
            description="Activation is allowed only after commercial readiness checks pass."
            icon={CheckCircle2}
          >
            {!selectedOffer ? (
              <p className="text-sm text-stone-500">Select an Offer first.</p>
            ) : (
              <>
                <p className="text-sm font-black text-stone-950">
                  {selectedOffer.merchantSku || selectedOffer.id}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {Object.entries(readiness?.checks || {}).map(
                    ([key, value]) => (
                      <div key={key} className="rounded-xl bg-stone-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                          {key}
                        </p>

                        <p
                          className={[
                            "mt-1",
                            "text-sm",
                            "font-black",

                            value ? "text-emerald-700" : "text-stone-500",
                          ].join(" ")}
                        >
                          {value ? "Ready" : "Pending"}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !readiness?.ready ||
                    selectedOffer?.status === "active"
                  }
                  onClick={handleActivateOffer}
                  className="focus-ring mt-4 w-full rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {selectedOffer?.status === "active"
                    ? "Offer Active"
                    : "Activate Offer"}
                </button>
              </>
            )}
          </SectionCard>

          <SectionCard
            title="Effective Price"
            description="Price history remains append-only and effective-dated."
            icon={BadgeIndianRupee}
          >
            {selectedOfferId && (
              <div className="mb-4 rounded-xl bg-stone-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                  Current effective price
                </p>

                <p className="mt-1 text-xl font-black text-stone-950">
                  {moneyFromMinor(
                    effectivePrice?.effectivePrice?.amountMinor ??
                      effectivePrice?.effectiveAmountMinor ??
                      effectivePrice?.salePrice?.amountMinor ??
                      effectivePrice?.listPrice?.amountMinor,
                    effectivePrice?.effectivePrice?.currency ||
                      effectivePrice?.salePrice?.currency ||
                      effectivePrice?.listPrice?.currency ||
                      "INR"
                  )}
                </p>
              </div>
            )}

            <form onSubmit={handleCreatePrice} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="List price ₹">
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceForm.listPrice}
                    onChange={(event) =>
                      setPriceForm((current) => ({
                        ...current,

                        listPrice: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Sale price ₹">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceForm.salePrice}
                    onChange={(event) =>
                      setPriceForm((current) => ({
                        ...current,

                        salePrice: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Change reason">
                <textarea
                  required
                  minLength={3}
                  value={priceForm.changeReason}
                  onChange={(event) =>
                    setPriceForm((current) => ({
                      ...current,

                      changeReason: event.target.value,
                    }))
                  }
                  className={`${inputClassName} min-h-[82px] resize-y`}
                  placeholder="Why is this price changing?"
                />
              </Field>

              <button
                disabled={busy || !selectedOfferId}
                className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                Record Price
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Inventory Nodes"
            description="Warehouses, stores and fulfillment locations remain Host scoped."
            icon={Warehouse}
          >
            <form onSubmit={handleCreateNode} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Node name">
                  <input
                    required
                    value={nodeForm.name}
                    onChange={(event) =>
                      setNodeForm((current) => ({
                        ...current,

                        name: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Node type">
                  <select
                    value={nodeForm.nodeType}
                    onChange={(event) =>
                      setNodeForm((current) => ({
                        ...current,

                        nodeType: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="warehouse">Warehouse</option>

                    <option value="store">Store</option>

                    <option value="dark_store">Dark store</option>

                    <option value="distribution_center">
                      Distribution center
                    </option>

                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="City">
                  <input
                    value={nodeForm.city}
                    onChange={(event) =>
                      setNodeForm((current) => ({
                        ...current,

                        city: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="State">
                  <input
                    value={nodeForm.state}
                    onChange={(event) =>
                      setNodeForm((current) => ({
                        ...current,

                        state: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Pincode">
                  <input
                    value={nodeForm.postalCode}
                    onChange={(event) =>
                      setNodeForm((current) => ({
                        ...current,

                        postalCode: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>

              <button
                disabled={busy}
                className="focus-ring rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                Create Inventory Node
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {inventoryNodes.map((node) => (
                <span
                  key={node.id}
                  className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-700"
                >
                  {node.name} · {node.status}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Inventory Snapshot"
            description="Every stock observation is append-only. Existing history is never overwritten."
            icon={Boxes}
          >
            {currentInventory && (
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                    Availability
                  </p>

                  <p className="mt-1 text-sm font-black capitalize text-stone-950">
                    {currentInventory.availability?.replace("_", " ") ||
                      "Unknown"}
                  </p>
                </div>

                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                    Sellable
                  </p>

                  <p className="mt-1 text-sm font-black text-stone-950">
                    {currentInventory.totals?.sellableQuantity ?? 0}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleInventorySnapshot} className="grid gap-3">
              <Field label="Inventory Node">
                <select
                  required
                  value={inventoryForm.inventoryNodeId}
                  onChange={(event) =>
                    setInventoryForm((current) => ({
                      ...current,

                      inventoryNodeId: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">Select node</option>

                  {inventoryNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Available">
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={inventoryForm.availableQuantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,

                        availableQuantity: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Reserved">
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={inventoryForm.reservedQuantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,

                        reservedQuantity: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>

              <button
                disabled={busy || !selectedOfferId}
                className="focus-ring rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                Record Inventory
              </button>
            </form>
          </SectionCard>

          <SectionCard
            title="Service Areas"
            description="Explicit pincodes determine where this Host can fulfill Orders."
            icon={MapPinned}
          >
            <form onSubmit={handleCreateServiceArea} className="grid gap-3">
              <Field label="Area name">
                <input
                  required
                  value={serviceAreaForm.name}
                  onChange={(event) =>
                    setServiceAreaForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="Inventory Node">
                <select
                  value={serviceAreaForm.inventoryNodeId}
                  onChange={(event) =>
                    setServiceAreaForm((current) => ({
                      ...current,

                      inventoryNodeId: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">All active nodes</option>

                  {inventoryNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Pincodes">
                <textarea
                  required
                  value={serviceAreaForm.postalCodes}
                  onChange={(event) =>
                    setServiceAreaForm((current) => ({
                      ...current,

                      postalCodes: event.target.value,
                    }))
                  }
                  className={`${inputClassName} min-h-[82px] resize-y`}
                  placeholder="273001, 273002, 273003"
                />
              </Field>

              <button
                disabled={busy}
                className="focus-ring rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"
              >
                Create Service Area
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {serviceAreas.map((area) => (
                <div key={area.id} className="rounded-xl bg-stone-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-stone-900">
                      {area.name}
                    </p>

                    <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                      {area.status}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-stone-500">
                    {area.postalCodes?.slice(0, 6).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
