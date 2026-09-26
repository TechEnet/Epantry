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
  getHostCurrentInventory,
  getHostEffectivePrice,
  getHostMarketplaceOrganization,
  getHostOfferReadiness,
  activateHostOffer,
  listHostOffers,
  listInventoryNodes,
  listServiceAreas,
  updateHostOffer,
  updateServiceArea,
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

function SectionCard({ title, description, icon: Icon, children, tone = "mint" }) {
  const toneClassName =
    tone === "blue"
      ? "border-sky-100 bg-[#eef7fb]"
      : tone === "lavender"
        ? "border-violet-100 bg-[#f3f0fb]"
        : "border-emerald-100 bg-[#edf8f3]";

  const iconClassName =
    tone === "blue"
      ? "bg-white/80 text-sky-700"
      : tone === "lavender"
        ? "bg-white/80 text-violet-700"
        : "bg-white/80 text-emerald-700";

  return (
    <section
      className={`rounded-[18px] border p-3 shadow-[0_10px_28px_rgba(41,55,49,0.06)] sm:rounded-[24px] sm:p-5 ${toneClassName}`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${iconClassName}`}
        >
          <Icon size={16} className="sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <h2 className="text-[13px] font-black leading-4 text-stone-950 sm:text-base sm:leading-5">
            {title}
          </h2>

          {description && (
            <p className="mt-0.5 text-[10px] leading-4 text-stone-600 sm:mt-1 sm:text-xs sm:leading-5">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 sm:mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.11em] text-stone-500 sm:mb-1.5 sm:text-[10px] sm:tracking-[0.12em]">
        {label}
      </span>

      {children}
    </label>
  );
}

function getReadinessLabel(key) {
  const labels = {
    canonicalPublished: "Product approved",
    effectivePrice: "Price added",
    serviceArea: "Delivery area added",
    activeInventoryNode: "Stock location active",
    serviceableInventoryNode: "Location can serve customers",
    inventorySnapshot: "Stock quantity added",
  };

  if (labels[key]) {
    return labels[key];
  }

  return String(key || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const inputClassName =
  "focus-ring w-full rounded-[11px] border border-stone-200 bg-white px-3 py-2 text-[12px] font-semibold text-stone-900 outline-none sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm";

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

    postalCodes: "",
  });

  const [editingServiceAreaId, setEditingServiceAreaId] = useState("");

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

        listServiceAreas({
          page: 1,
          limit: 100,
          status: "active",
        }),

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
    }, "Listing created.");

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
      "Price saved."
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
      "Stock location added."
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
      "Stock updated."
    );

    if (success) {
      setInventoryForm((current) => ({
        ...current,

        availableQuantity: "0",

        reservedQuantity: "0",
      }));
    }
  }

  function startEditServiceArea(area) {
    setEditingServiceAreaId(area.id);
    setServiceAreaForm({
      name: area.name || "",
      postalCodes: (area.postalCodes || []).join(", "),
    });
  }

  function cancelEditServiceArea() {
    setEditingServiceAreaId("");
    setServiceAreaForm({
      name: "",
      postalCodes: "",
    });
  }

  async function handleUpdateServiceArea(event) {
    event.preventDefault();

    if (!editingServiceAreaId) {
      return;
    }

    const postalCodes = serviceAreaForm.postalCodes
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    const success = await runMutation(
      () =>
        updateServiceArea(editingServiceAreaId, {
          name: serviceAreaForm.name.trim(),
          postalCodes,
        }),
      "Delivery area updated everywhere."
    );

    if (success) {
      cancelEditServiceArea();
    }
  }

  async function handleActivateOffer() {
    if (!selectedOfferId) {
      return;
    }

    await runMutation(
      () => activateHostOffer(selectedOfferId),
      "Listing activated."
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell pt-0 pb-3 sm:pt-0 sm:pb-6">
          <div className="h-[680px] animate-pulse rounded-[28px] border border-stone-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell pt-0 pb-3 sm:pt-0 sm:pb-6">
        <section className="rounded-[20px] border border-emerald-100 bg-[linear-gradient(135deg,#e6f6ef_0%,#e9f4fb_54%,#f1effa_100%)] p-3 shadow-[0_12px_32px_rgba(41,55,49,0.07)] sm:rounded-[28px] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.14em]">
                <Store size={12} className="sm:h-[14px] sm:w-[14px]" aria-hidden="true" />
                Selling workspace
              </div>

              <h1 className="mt-2 text-[22px] font-black leading-7 tracking-[-0.035em] text-stone-950 sm:mt-3 sm:text-4xl sm:leading-tight">
                Pricing & Inventory
              </h1>

              <p className="mt-1.5 max-w-2xl text-[10px] leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
                <span className="line-clamp-2 sm:hidden">Set your product, price, stock and delivery coverage in one place.</span>
                <span className="hidden sm:inline">Set up what you sell, the price customers see, where stock is kept, and the pincodes you can serve.</span>
              </p>
            </div>

            <button
              type="button"
              onClick={loadWorkspace}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[11px] border border-emerald-200 bg-white/80 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <RefreshCw size={13} className="sm:h-4 sm:w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Choose a product", "Create a selling listing from an approved product."],
              ["02", "Set price & stock", "Add the customer price and current stock quantity."],
              ["03", "Add delivery area", "Choose the stock location and pincodes you can serve."],
              ["04", "Activate & manage", "When everything is ready, activate it; use Listing History for later changes."],
            ].map(([number, title, copy], index) => (
              <div
                key={number}
                className={[
                  "rounded-[13px] border p-2.5 sm:rounded-2xl sm:p-4",
                  index === 1
                    ? "border-sky-100 bg-[#edf6fb]"
                    : index === 2
                      ? "border-violet-100 bg-[#f3f0fa]"
                      : "border-emerald-100 bg-[#edf8f3]",
                ].join(" ")}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:h-7 sm:w-7 sm:text-[9px]">
                    {number}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-3.5 text-stone-950 sm:text-sm sm:leading-5">
                      {title}
                    </p>
                    <p className="mt-0.5 text-[8px] leading-3 text-stone-600 sm:mt-1 sm:text-[10px] sm:leading-4">
                      {copy}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
            <div className="rounded-[12px] border border-white/80 bg-white/75 p-2.5 sm:rounded-2xl sm:p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[10px] sm:tracking-[0.12em]">
                Business
              </p>
              <p className="mt-0.5 truncate text-[11px] font-black text-stone-950 sm:mt-1 sm:text-base">
                {organization?.displayName || "Host organization"}
              </p>
            </div>

            <div className="rounded-[12px] border border-white/80 bg-white/75 p-2.5 sm:rounded-2xl sm:p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[10px] sm:tracking-[0.12em]">
                Listings
              </p>
              <p className="mt-0.5 text-[15px] font-black text-stone-950 sm:mt-1 sm:text-xl">{offers.length}</p>
            </div>

            <div className="rounded-[12px] border border-white/80 bg-white/75 p-2.5 sm:rounded-2xl sm:p-4">
              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[10px] sm:tracking-[0.12em]">
                Stock locations
              </p>
              <p className="mt-0.5 text-[15px] font-black text-stone-950 sm:mt-1 sm:text-xl">{inventoryNodes.length}</p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-[15px] border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-800 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm">
            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            {error}
          </div>
        )}

        {notice && (
          <div className="mt-3 flex items-start gap-2.5 rounded-[15px] border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800 sm:mt-5 sm:gap-3 sm:rounded-2xl sm:p-4 sm:text-sm">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />

            {notice}
          </div>
        )}

        <div className="mt-3 flex flex-col gap-3 sm:mt-5 sm:gap-5 xl:grid xl:grid-cols-2 xl:items-start">
          <div className="contents xl:flex xl:flex-col xl:gap-5">
            <div className="order-1 xl:order-none">
              <SectionCard
                title="Product listing setup"
                description={
                  <>
                    <span className="line-clamp-2 sm:hidden">Choose an approved product to start its selling setup.</span>
                    <span className="hidden sm:inline">Choose an approved product and create the listing your business will price and stock.</span>
                  </>
                }
                icon={PackagePlus}
              >
                <form onSubmit={handleCreateOffer} className="grid gap-2.5 sm:gap-3">
                  <Field label="Product to sell">
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
                      <option value="">Choose an approved product</option>

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
                            {hasExistingOffer ? " • Listing already exists" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <p className="mt-1.5 text-[10px] font-medium leading-4 text-stone-500 sm:text-xs sm:leading-5">
                      <span className="line-clamp-2 sm:hidden">Choose the product to sell. Its catalog details stay unchanged.</span>
                      <span className="hidden sm:inline">Pick the catalog product you want to sell. Product facts stay separate from your price, stock and delivery settings.</span>
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
                        No approved products are available yet. Submit products from Add / Edit Products first; approved products will appear here.
                      </p>
                    )}
                  </Field>

                  <Field label="Your SKU (optional)">
                    <input
                      value={offerForm.merchantSku}
                      onChange={(event) =>
                        setOfferForm((current) => ({
                          ...current,

                          merchantSku: event.target.value,
                        }))
                      }
                      className={inputClassName}
                      placeholder="Your internal product code"
                    />
                  </Field>

                  <button
                    disabled={busy}
                    className="focus-ring rounded-[11px] bg-emerald-700 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-50"
                  >
                    Create listing
                  </button>
                </form>

                {editingOfferId ? (
                  <form
                    onSubmit={handleSaveOffer}
                    className="mt-3 rounded-[15px] border border-emerald-200 bg-white/75 p-3 sm:mt-5 sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-stone-950">
                          Edit listing
                        </p>
                        <p className="mt-1 text-[10px] font-medium leading-4 text-stone-500 sm:text-xs sm:leading-5">
                          <span className="line-clamp-2 sm:hidden">Only selling details change here; product facts stay the same.</span>
                          <span className="hidden sm:inline">Product facts stay unchanged. Update only the selling details for this listing.</span>
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
                      <Field label="Your SKU (optional)">
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

                      <Field label="Reference (optional)">
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

                      <Field label="Minimum order">
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

                      <Field label="Maximum order">
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
                        Order options
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
                      className="focus-ring mt-4 w-full rounded-[11px] bg-emerald-700 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-50"
                    >
                      Save listing changes
                    </button>
                  </form>
                ) : null}

                <div className="mt-3 rounded-[15px] border border-sky-100 bg-white/75 p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                  <Field label="Listing to manage">
                    <select
                      value={selectedOfferId}
                      onChange={(event) => setSelectedOfferId(event.target.value)}
                      className={inputClassName}
                      disabled={!offers.length}
                    >
                      {!offers.length ? (
                        <option value="">No listings yet</option>
                      ) : null}

                      {offers.map((offer) => (
                        <option key={offer.id} value={offer.id}>
                          {offer.merchantSku || offer.offerKey || offer.id} · {offer.status}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <p className="mt-2 text-[10px] font-medium leading-4 text-stone-500 sm:mt-3 sm:text-xs sm:leading-5">
                    <span className="line-clamp-2 sm:hidden">For older listings, use Listing History to edit or remove them.</span>
                    <span className="hidden sm:inline">Need to edit or remove an older listing? Use Listing History after you finish the setup here.</span>
                  </p>
                </div>

              </SectionCard>
            </div>

            <div className="order-3 xl:order-none">
              <SectionCard
                title="Customer price"
                description="Set the price customers should see for the selected listing."
                icon={BadgeIndianRupee}
                tone="lavender"
              >
                {selectedOfferId && (
                  <div className="mb-3 rounded-xl bg-white/75 p-3 sm:mb-4 sm:p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                      Current price
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

                <form onSubmit={handleCreatePrice} className="grid gap-2.5 sm:gap-3">
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <Field label="Regular price ₹">
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

                    <Field label="Sale price ₹ (optional)">
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

                  <Field label="Price update note">
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
                      placeholder="Example: weekend offer or supplier price change"
                    />
                  </Field>

                  <button
                    disabled={busy || !selectedOfferId}
                    className="focus-ring rounded-[11px] bg-emerald-700 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-40"
                  >
                    Save price
                  </button>
                </form>
              </SectionCard>
            </div>

            <div className="order-5 xl:order-none">
              <SectionCard
                title="Stock quantity"
                description={
                  <>
                    <span className="line-clamp-2 sm:hidden">Update the available units for the selected stock location.</span>
                    <span className="hidden sm:inline">Update how many units are currently available at the selected stock location.</span>
                  </>
                }
                icon={Boxes}
              >
                {currentInventory && (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3">
                    <div className="rounded-xl bg-white/75 p-2.5 sm:p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                        Stock status
                      </p>

                      <p className="mt-1 text-sm font-black capitalize text-stone-950">
                        {currentInventory.availability?.replace("_", " ") ||
                          "Unknown"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/75 p-2.5 sm:p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
                        Available to sell
                      </p>

                      <p className="mt-1 text-sm font-black text-stone-950">
                        {currentInventory.totals?.sellableQuantity ?? 0}
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleInventorySnapshot} className="grid gap-2.5 sm:gap-3">
                  <Field label="Stock location">
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
                      <option value="">Choose a stock location</option>

                      {inventoryNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                    className="focus-ring rounded-[11px] bg-emerald-700 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-40"
                  >
                    Save stock
                  </button>
                </form>
              </SectionCard>
            </div>
          </div>

          <div className="contents xl:flex xl:flex-col xl:gap-5">
            <div className="order-2 xl:order-none">
              <div className="self-start">
                <SectionCard
                  title="Ready to go live?"
                  description={
                    <>
                      <span className="line-clamp-2 sm:hidden">Check what is ready and what still needs attention.</span>
                      <span className="hidden sm:inline">See what is complete and what still needs attention before this listing can be activated.</span>
                    </>
                  }
                  icon={CheckCircle2}
                  tone="blue"
                >
                {!selectedOffer ? (
                  <p className="text-sm text-stone-500">Choose a listing first.</p>
                ) : (
                  <>
                    <p className="text-sm font-black text-stone-950">
                      {selectedOffer.merchantSku || selectedOffer.id}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
                      {Object.entries(readiness?.checks || {}).map(
                        ([key, value]) => (
                          <div key={key} className="rounded-xl bg-white/75 p-2.5 sm:p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                              {getReadinessLabel(key)}
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
                      className="focus-ring mt-4 w-full rounded-[11px] bg-emerald-800 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {selectedOffer?.status === "active"
                        ? "Listing active"
                        : "Activate listing"}
                    </button>
                  </>
                )}
                </SectionCard>
              </div>
            </div>

            <div className="order-4 xl:order-none">
              <SectionCard
                title="Stock locations"
                description="Add each store, warehouse or fulfillment location where you keep stock."
                icon={Warehouse}
                tone="blue"
              >
                <form onSubmit={handleCreateNode} className="grid gap-2.5 sm:gap-3">
                  <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <Field label="Location name">
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

                    <Field label="Location type">
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

                  <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
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
                    className="focus-ring rounded-[11px] bg-emerald-800 px-3 py-2 text-[12px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-40"
                  >
                    Add stock location
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
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
            </div>

            <div className="order-6 xl:order-none">
              <SectionCard
                title="Delivery areas"
                description={
                  <>
                    <span className="line-clamp-2 sm:hidden">Uses the same active delivery areas saved in Operations Center.</span>
                    <span className="hidden sm:inline">These are the same active delivery areas managed in Operations Center. Edit here or there and the same saved data is used everywhere.</span>
                  </>
                }
                icon={MapPinned}
                tone="lavender"
              >
                {editingServiceAreaId ? (
                  <form
                    onSubmit={handleUpdateServiceArea}
                    className="mb-3 grid gap-2.5 rounded-[14px] border border-violet-100 bg-white/70 p-2.5 sm:mb-4 sm:gap-3 sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-stone-950 sm:text-sm">
                          Edit shared delivery area
                        </p>
                        <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-xs sm:leading-5">
                          Saving here updates the same Delivery Area shown in Operations Center.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={cancelEditServiceArea}
                        className="focus-ring grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 sm:h-8 sm:w-8"
                        aria-label="Cancel delivery area edit"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <Field label="Delivery area name">
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

                    <Field label="Delivery pincodes">
                      <textarea
                        required
                        value={serviceAreaForm.postalCodes}
                        onChange={(event) =>
                          setServiceAreaForm((current) => ({
                            ...current,
                            postalCodes: event.target.value,
                          }))
                        }
                        className={`${inputClassName} min-h-[70px] resize-y sm:min-h-[82px]`}
                        placeholder="273001, 273002, 273003"
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={busy}
                        className="focus-ring rounded-[11px] bg-emerald-800 px-3 py-2 text-[11px] font-black text-white sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-40"
                      >
                        Save changes
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEditServiceArea}
                        className="focus-ring rounded-[11px] border border-stone-200 bg-white px-3 py-2 text-[11px] font-black text-stone-700 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                {serviceAreas.length ? (
                  <div className="space-y-2">
                    {serviceAreas.map((area) => (
                      <div
                        key={area.id}
                        className="rounded-xl border border-white/70 bg-white/75 p-2.5 sm:p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-stone-900 sm:text-sm">
                              {area.name}
                            </p>

                            <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-500 sm:text-xs sm:leading-5">
                              {(area.postalCodes || []).join(", ")}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => startEditServiceArea(area)}
                              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-violet-100 bg-white px-2 py-1.5 text-[9px] font-black text-violet-700 sm:px-2.5 sm:text-[10px]"
                            >
                              <Pencil size={11} aria-hidden="true" />
                              Edit
                            </button>

                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-[10px]">
                              {area.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-violet-100 bg-white/70 p-3 sm:rounded-2xl sm:p-4">
                    <p className="text-[11px] font-black text-stone-900 sm:text-sm">
                      No active delivery areas yet
                    </p>
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-stone-500 sm:text-xs sm:leading-5">
                      Add your delivery pincodes in Operations Center. They will automatically appear here.
                    </p>
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
