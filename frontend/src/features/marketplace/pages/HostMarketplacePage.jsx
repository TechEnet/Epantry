import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { getCatalogProducts } from "../../grocery/services/catalog.service";
import { listNotifications } from "../../analytics/services/analytics.service";
import {
  createHostPriceRule,
  createInventorySnapshots,
  getHostCurrentInventory,
  getHostEffectivePrice,
  listHostOffers,
  listInventoryNodes,
} from "../services/marketplace.service";

// All inventory below belongs to the authenticated Host organization.
// This screen does not create offers, publish products or change approvals.
const LOW_STOCK_THRESHOLD = 5; // Matches commerce.final.service.js
const money = (minor) =>
  minor === null || minor === undefined
    ? "Not set"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(Number(minor) / 100);
const errorText = (error) =>
  error?.response?.data?.message ||
  error?.message ||
  "Unable to update this product.";
const toMinor = (value) => Math.round(Number(value) * 100);
const validMoney = (value) =>
  String(value).trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0 &&
  Math.abs(Number(value) * 100 - toMinor(value)) < 0.000001;
const cleanId = (value) => String(value || "");

function getProductName(offer, catalog) {
  const product = catalog[cleanId(offer?.packId)];
  return (
    product?.displayName ||
    product?.pack?.name ||
    offer?.merchantSku ||
    `Product ${cleanId(offer?.id).slice(-6)}`
  );
}
function getImage(product) {
  const image = product?.image;
  return typeof image === "string"
    ? image
    : image?.url || image?.secureUrl || image?.src || "";
}
function stockState(offer, snapshot) {
  if (offer?.status !== "active") return "inactive";
  if (!snapshot) return "loading";
  const quantity = Number(snapshot?.inventory?.totals?.sellableQuantity || 0);
  if (quantity === 0) return "out";
  if (quantity < LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}
function Status({ status }) {
  const content = {
    low: ["Low stock", "bg-[#F9E6D9] text-[#A34C2B]"],
    out: ["Out of stock", "bg-[#F8DEDC] text-[#973C32]"],
    ok: ["In stock", "bg-[#E2EDE3] text-[#225642]"],
    inactive: ["Not live", "bg-[#EEECE6] text-[#5F6860]"],
    loading: ["Checking", "bg-[#F0F0EB] text-[#667368]"],
  }[status] || ["Checking", "bg-[#F0F0EB] text-[#667368]"];
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[13px] font-semibold sm:text-[12px] sm:font-bold ${content[1]}`}
    >
      {content[0]}
    </span>
  );
}
function Field({ label, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[13px] font-semibold leading-[1.4] text-[#25463B] sm:mb-1.5 sm:text-[14px] sm:font-bold">
        {label}
      </span>
      {children}
    </label>
  );
}
const inputStyle =
  "w-full min-w-0 rounded-[9px] border border-[#C9D4C8] bg-white px-3 py-2.5 text-[16px] text-[#202421] sm:px-3.5 sm:py-3 outline-none transition-colors focus:border-[#C86C42] focus:ring-2 focus:ring-[#C86C42]/20 disabled:opacity-60";

// A Host with many offers must not lose products to the default 25-row API page.
async function loadAllOffers() {
  const all = [];
  for (let page = 1; page <= 100; page += 1) {
    const response = await listHostOffers({ page, limit: 100, status: "all" });
    const batch = response?.offers || response?.hostOffers || [];
    all.push(...batch);
    if (
      !batch.length ||
      (response?.pagination?.pages && page >= response.pagination.pages) ||
      batch.length < 100
    )
      break;
  }
  return all.filter((offer) => offer?.id && offer.status !== "retired");
}
async function loadAllNodes() {
  const rows = [];
  for (let page = 1; page <= 30; page += 1) {
    const result = await listInventoryNodes({
      page,
      limit: 100,
      status: "active",
    });
    const batch = result?.inventoryNodes || [];
    rows.push(...batch);
    if (
      !batch.length ||
      (result?.pagination?.pages && page >= result.pagination.pages) ||
      batch.length < 100
    )
      break;
  }
  return rows;
}
async function loadCatalogMap(packIds) {
  const map = {};
  if (!packIds.length) return map;
  const needed = new Set(packIds.map(String));
  // Public catalog identifies the product attached to each canonical Pack.
  for (let page = 1; page <= 25 && needed.size; page += 1) {
    const response = await getCatalogProducts({ page, limit: 100 });
    const products = response?.products || [];
    products.forEach((product) => {
      const packId = cleanId(product.packId);
      if (needed.has(packId)) {
        map[packId] = product;
        needed.delete(packId);
      }
    });
    if (
      !products.length ||
      (response?.pagination?.pages && page >= response.pagination.pages) ||
      products.length < 100
    )
      break;
  }
  return map;
}
async function loadOfferStatus(offerId) {
  const [inventory, price] = await Promise.allSettled([
    getHostCurrentInventory(offerId),
    getHostEffectivePrice(offerId),
  ]);
  return {
    inventory: inventory.status === "fulfilled" ? inventory.value : null,
    priceRule:
      price.status === "fulfilled" ? price.value?.priceRule || null : null,
    inventoryError:
      inventory.status === "rejected" ? errorText(inventory.reason) : "",
    priceError: price.status === "rejected" ? errorText(price.reason) : "",
    loadedAt: Date.now(),
  };
}

export default function HostMarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [offers, setOffers] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [nodes, setNodes] = useState([]);
  const [summary, setSummary] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stockLocationId, setStockLocationId] = useState("");
  const [stockMode, setStockMode] = useState("add");
  const [stockValue, setStockValue] = useState("");
  const requestRef = useRef(0);
  const editorRef = useRef(null);
  const deepLinkOffer = searchParams.get("editOffer") || "";
  const deepLinkPack = searchParams.get("packId") || "";
  const deepLinkRef = useRef({ offerId: deepLinkOffer, packId: deepLinkPack });
  deepLinkRef.current = { offerId: deepLinkOffer, packId: deepLinkPack };

  const reload = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadingDetails(false);
    setError("");
    try {
      const [allOffers, allNodes] = await Promise.all([
        loadAllOffers(),
        loadAllNodes(),
      ]);
      if (request !== requestRef.current) return;
      setOffers(allOffers);
      setNodes(allNodes);
      setSummary({});
      const { offerId, packId } = deepLinkRef.current;
      const direct =
        allOffers.find((offer) => cleanId(offer.id) === offerId) ||
        (packId && allOffers.find((offer) => cleanId(offer.packId) === packId));
      setSelectedOfferId(
        (previous) =>
          direct?.id ||
          (allOffers.some((offer) => cleanId(offer.id) === cleanId(previous))
            ? previous
            : allOffers.find((offer) => offer.status === "active")?.id ||
              allOffers[0]?.id ||
              "")
      );
      setLoading(false);
      setLoadingDetails(true);
      // Alerts are independent of the current stock reading; one failure must not hide products.
      const notificationsPromise = listNotifications({ limit: 100 }).catch(
        () => null
      );
      const catalogPromise = loadCatalogMap(
        allOffers.map((offer) => offer.packId)
      ).catch(() => ({}));
      const results = {};
      for (let offset = 0; offset < allOffers.length; offset += 6) {
        const batch = allOffers.slice(offset, offset + 6);
        const loaded = await Promise.all(
          batch.map((offer) => loadOfferStatus(offer.id))
        );
        if (request !== requestRef.current) return;
        loaded.forEach((row, index) => {
          results[batch[index].id] = row;
        });
        setSummary({ ...results });
      }
      const [nextNotifications, nextCatalog] = await Promise.all([
        notificationsPromise,
        catalogPromise,
      ]);
      if (request !== requestRef.current) return;
      setNotifications(
        (nextNotifications?.notifications || []).filter(
          (item) => item.triggerType === "host_inventory_low"
        )
      );
      setCatalog(nextCatalog);
    } catch (cause) {
      if (request === requestRef.current) setError(errorText(cause));
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
        setLoadingDetails(false);
      }
    }
  }, []);

  useEffect(() => {
    reload();
    return () => {
      requestRef.current += 1;
    };
  }, [reload]);

  useEffect(() => {
    const direct =
      offers.find((offer) => cleanId(offer.id) === deepLinkOffer) ||
      (deepLinkPack &&
        offers.find((offer) => cleanId(offer.packId) === deepLinkPack));
    if (direct)
      setSelectedOfferId((current) =>
        current === direct.id ? current : direct.id
      );
  }, [deepLinkOffer, deepLinkPack, offers]);

  const selected = useMemo(
    () =>
      offers.find((offer) => cleanId(offer.id) === cleanId(selectedOfferId)) ||
      null,
    [offers, selectedOfferId]
  );
  const selectedStatus = summary[selectedOfferId] || null;
  const selectedInventory = selectedStatus?.inventory;
  const selectedRows = selectedInventory?.inventory || [];
  const availableNodes = nodes.filter((node) => node.status === "active");
  const chosenRow = selectedRows.find(
    (row) => cleanId(row.inventoryNodeId) === cleanId(stockLocationId)
  );
  const selectedQuantity = Number(chosenRow?.availableQuantity || 0);
  const selectedReserved = Number(chosenRow?.reservedQuantity || 0);

  useEffect(() => {
    if (!selectedStatus) return;
    const rule = selectedStatus.priceRule;
    setListPrice(
      rule?.listPrice?.amountMinor == null
        ? ""
        : String(rule.listPrice.amountMinor / 100)
    );
    setSalePrice(
      rule?.salePrice?.amountMinor == null
        ? ""
        : String(rule.salePrice.amountMinor / 100)
    );
    const rows = selectedStatus.inventory?.inventory || [];
    setStockLocationId((existing) =>
      rows.some((row) => cleanId(row.inventoryNodeId) === cleanId(existing))
        ? existing
        : cleanId(
            rows[0]?.inventoryNodeId ||
              (rows.length === 0 && nodes.length === 1 ? nodes[0]?.id : "")
          )
    );
    setStockValue("");
  }, [selectedOfferId, selectedStatus?.loadedAt, nodes]);

  const offersWithNames = useMemo(
    () =>
      offers.map((offer) => ({
        ...offer,
        name: getProductName(offer, catalog),
        imageUrl: getImage(catalog[cleanId(offer.packId)]),
        availability: stockState(offer, summary[offer.id]),
        sellable:
          summary[offer.id]?.inventory?.totals?.sellableQuantity ?? null,
        currentPrice: summary[offer.id]?.priceRule,
      })),
    [offers, catalog, summary]
  );

  const visible = useMemo(
    () =>
      offersWithNames.filter((offer) => {
        const matches = `${offer.name} ${offer.merchantSku || ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        if (!matches) return false;
        if (filter === "low")
          return offer.availability === "low" || offer.availability === "out";
        if (filter === "active") return offer.status === "active";
        return true;
      }),
    [offersWithNames, query, filter]
  );

  const lowProducts = offersWithNames.filter(
    (offer) => offer.availability === "low" || offer.availability === "out"
  );
  const activeCount = offers.filter(
    (offer) => offer.status === "active"
  ).length;
  const scopedNotifications = notifications.filter((alert) =>
    offers.some((offer) => cleanId(offer.id) === cleanId(alert.relatedEntityId))
  );
  const alertsByOffer = Array.from(
    new Map(
      scopedNotifications.map((alert) => [
        cleanId(alert.relatedEntityId),
        alert,
      ])
    ).values()
  );
  const working = Boolean(busy);

  function choose(offerId, scroll = false) {
    setSelectedOfferId(offerId);
    setError("");
    setNotice("");
    setSearchParams({ editOffer: cleanId(offerId) }, { replace: true });
    if (scroll) {
      // Wait for the selection and URL update to render before scrolling.
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          editorRef.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
            block: "start",
          });
        })
      );
    }
  }

  async function refreshOne(offerId) {
    const result = await loadOfferStatus(offerId);
    setSummary((current) => ({ ...current, [offerId]: result }));
    return result;
  }

  async function savePrice(event) {
    event.preventDefault();
    if (!selected || working || !selectedStatus || selected.status !== "active")
      return;
    if (
      !validMoney(listPrice) ||
      (salePrice !== "" &&
        (!validMoney(salePrice) || Number(salePrice) > Number(listPrice)))
    ) {
      setError(
        "Enter a valid list price and an optional sale price that does not exceed it (maximum two decimal places)."
      );
      return;
    }
    setBusy("price");
    setError("");
    setNotice("");
    try {
      await createHostPriceRule(selected.id, {
        listPrice: { amountMinor: toMinor(listPrice), currency: "INR" },
        salePrice:
          salePrice === ""
            ? null
            : { amountMinor: toMinor(salePrice), currency: "INR" },
        effectiveFrom: new Date().toISOString(),
        effectiveTo: null,
        source: "manual",
        changeReason: "Host updated a live product price",
      });
      await refreshOne(selected.id);
      setNotice(
        `${getProductName(
          selected,
          catalog
        )} price updated. Customer offers use the latest effective price.`
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function saveStock(event) {
    event.preventDefault();
    if (!selected || working || !selectedStatus || selected.status !== "active")
      return;
    if (!stockLocationId) {
      setError("Select a saved stock location for this product.");
      return;
    }
    if (
      !/^\d+$/.test(stockValue.trim()) ||
      !Number.isSafeInteger(Number(stockValue)) ||
      Number(stockValue) > 1000000000
    ) {
      setError("Enter a non-negative whole number of units.");
      return;
    }
    setBusy("stock");
    setError("");
    setNotice("");
    try {
      // Refresh live stock before writing, and retain outstanding reservations.
      // Creating a Snapshot is an existing Host-owned, append-only Marketplace operation.
      const latest = await getHostCurrentInventory(selected.id);
      const row = (latest?.inventory || []).find(
        (item) => cleanId(item.inventoryNodeId) === cleanId(stockLocationId)
      );
      const latestOnHand = Number(row?.availableQuantity || 0);
      const latestReserved = Number(row?.reservedQuantity || 0);
      const nextOnHand =
        stockMode === "add"
          ? latestOnHand + Number(stockValue)
          : Number(stockValue);
      if (
        !Number.isSafeInteger(nextOnHand) ||
        nextOnHand > 1000000000 ||
        nextOnHand < latestReserved
      ) {
        throw new Error(
          `Stock must be a whole number between ${latestReserved} reserved units and 1,000,000,000.`
        );
      }
      if (stockMode === "add" && Number(stockValue) === 0)
        throw new Error("Enter at least 1 unit to add.");
      await createInventorySnapshots([
        {
          offerId: selected.id,
          inventoryNodeId: stockLocationId,
          availableQuantity: nextOnHand,
          reservedQuantity: latestReserved,
          sourceType: "manual",
          sourceReference: `host-stock-page:${selected.id}`,
        },
      ]);
      await refreshOne(selected.id);
      setStockValue("");
      setNotice(
        `${getProductName(selected, catalog)} stock saved. ${
          nextOnHand - latestReserved
        } unit(s) are currently sellable at this location.`
      );
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="epantry-stock-prices-page w-full min-w-0 max-w-full bg-[#F7F6F2] text-[#202421]">
      {/* Use the Host content column's actual width. The shared workspace
          already applies desktop zoom; expanding this child to 133% pushes
          the Live Inventory and Price & Quantity sections off-screen. */}
      <style>{`
        .epantry-stock-prices-list { scrollbar-width: thin; scrollbar-color: #A9BEAF #F5F6F2; }
      `}</style>

      <div className="w-full min-w-0 px-3 pb-9 pt-3 sm:px-5 sm:pt-5 xl:px-7">
        <header className="overflow-hidden rounded-[15px] border border-[#D4DDD2] bg-white">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.55fr)]">
            <div className="relative min-w-0 bg-[#173F35] px-4 py-4 text-white sm:px-8 sm:py-7">
              <div className="flex items-center justify-between gap-3 sm:flex-wrap sm:items-start sm:gap-4">
                <div className="min-w-0">
                  <p className="mb-1 text-[12.5px] font-bold uppercase tracking-[.06em] text-[#F5B999] sm:mb-2 sm:text-[13px] sm:tracking-[.08em]">
                    Host / Selling
                  </p>
                  <h1 className="text-[27px] font-extrabold leading-[1.12] tracking-[-.045em] text-white sm:text-[36px]">
                    Stock &amp; Prices
                  </h1>
                  <p className="mt-2 hidden max-w-[65ch] text-[15px] leading-6 text-[#E4EEE7] sm:block">
                    Manage your listed products' stock and prices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reload}
                  disabled={loading || working}
                  className="inline-flex min-h-[39px] shrink-0 items-center justify-center gap-1.5 rounded-[9px] border border-white/50 bg-white/10 px-3 text-[13px] font-bold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px] sm:gap-2 sm:px-4 sm:text-[14px]"
                >
                  <RefreshCw size={16} aria-hidden="true" /> Refresh
                </button>
              </div>
            </div>
            <div className="hidden min-w-0 flex-col justify-center border-l-4 border-[#C86C42] bg-[#E6EDE5] px-5 py-5 sm:flex sm:px-7">
              <p className="text-[13px] font-bold uppercase tracking-[.07em] text-[#AD5634]">
                Live inventory
              </p>
              <p className="mt-1 text-[21px] font-extrabold leading-tight tracking-[-.025em] text-[#173F35]">
                Stay ready to sell.
              </p>
              <p className="mt-2 text-[14px] leading-[1.55] text-[#526359]">
                Changes appear in customer offers without another approval.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#D7DED4] border-t border-[#D7DED4] bg-[#FFFDF9]">
            <div className="min-w-0 px-3 py-3 sm:px-7 sm:py-4">
              <p className="text-[26px] font-extrabold tabular-nums leading-none text-[#173F35] sm:text-[28px]">
                {activeCount}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[#54665A]">
                Live products
              </p>
            </div>
            <div className="min-w-0 bg-[#F9E9DD]/65 px-3 py-3 sm:px-7 sm:py-4">
              <p className="text-[26px] font-extrabold tabular-nums leading-none text-[#AD5735] sm:text-[28px]">
                {lowProducts.length}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[#765442]">
                Need stock
              </p>
            </div>
            <div className="min-w-0 px-3 py-3 sm:px-7 sm:py-4">
              <p className="text-[26px] font-extrabold tabular-nums leading-none text-[#173F35] sm:text-[28px]">
                {scopedNotifications.length}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-[#54665A]">
                Stock alerts
              </p>
            </div>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mt-4 border-l-4 border-red-700 bg-[#FFF1EC] px-4 py-3 text-[15px] text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 border-l-4 border-[#173F35] bg-[#E5F0E6] px-4 py-3 text-[15px] text-[#173F35]"
          >
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> {notice}
          </p>
        )}
        {loading && (
          <p
            role="status"
            className="py-10 text-center text-[16px] text-[#52655A]"
          >
            Loading your products…
          </p>
        )}

        {!loading && (lowProducts.length > 0 || alertsByOffer.length > 0) && (
          <section
            aria-labelledby="stock-alert-title"
            className="mt-4 border-l-4 border-[#C86C42] bg-[#F9EDE5] px-3 py-3 sm:mt-5 sm:px-6 sm:py-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-[#9A492A]">
                <BellRing size={19} aria-hidden="true" />
                <h2
                  id="stock-alert-title"
                  className="text-[20px] font-extrabold tracking-[-.025em] sm:text-[22px]"
                >
                  Needs attention
                </h2>
              </div>
              <span className="hidden text-[13px] font-semibold text-[#815844] sm:inline">
                Below 5 sellable units
              </span>
            </div>
            <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2 xl:grid-cols-3">
              {lowProducts.slice(0, 9).map((offer) => (
                <button
                  type="button"
                  key={offer.id}
                  onClick={() => choose(offer.id, true)}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[9px] border border-[#E9CCB9] bg-[#FFFDF9] px-3 py-2.5 text-left transition-colors hover:border-[#C86C42] hover:bg-white focus-visible:outline-2 focus-visible:outline-[#C86C42] sm:px-4 sm:py-3"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[15px] font-extrabold text-[#173F35]">
                      {offer.name}
                    </strong>
                    <span className="mt-0.5 block text-[13px] font-semibold text-[#A35030]">
                      {offer.sellable ?? 0} units available
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    className="shrink-0 text-[#A95837]"
                    aria-hidden="true"
                  />
                </button>
              ))}
              {alertsByOffer
                .filter(
                  (item) =>
                    !lowProducts.some(
                      (offer) =>
                        cleanId(offer.id) === cleanId(item.relatedEntityId)
                    )
                )
                .slice(0, 3)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id || item.notificationId}
                    onClick={() => choose(item.relatedEntityId, true)}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-[9px] border border-[#E9CCB9] bg-[#FFFDF9] px-3 py-2.5 text-left transition-colors hover:border-[#C86C42] hover:bg-white sm:px-4 sm:py-3"
                  >
                    <span className="min-w-0 text-[14px] font-semibold text-[#35463D]">
                      {getProductName(
                        offers.find(
                          (offer) =>
                            cleanId(offer.id) === cleanId(item.relatedEntityId)
                        ),
                        catalog
                      )}{" "}
                      · Earlier low-stock alert
                    </span>
                    <ArrowRight
                      size={18}
                      className="shrink-0 text-[#A95837]"
                      aria-hidden="true"
                    />
                  </button>
                ))}
            </div>
          </section>
        )}

        {!loading && (
          <div className="mt-4 grid min-w-0 items-start gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,.88fr)] xl:gap-6">
            {/* A compact, scrollable index lets Hosts find any of their products
                without pushing the editing tools down an extremely long page. */}
            <section
              aria-labelledby="your-products-title"
              className="min-w-0 border-t-[4px] border-[#173F35] bg-white"
            >
              <div className="px-3 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold uppercase tracking-[.07em] text-[#AD5735]">
                      <span className="sm:hidden">01 / Products</span>
                      <span className="hidden sm:inline">
                        01 / Your products
                      </span>
                    </p>
                    <h2
                      id="your-products-title"
                      className="mt-1 text-[22px] font-bold leading-[1.25] tracking-[-.025em] text-[#173F35] sm:text-[26px] sm:font-extrabold sm:leading-tight sm:tracking-[-.035em]"
                    >
                      Choose a product
                    </h2>
                  </div>
                  <Link
                    to="/host/listings"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[8px] border border-[#C8D5CA] px-2.5 text-[13px] font-bold text-[#173F35] transition-colors hover:border-[#C86C42] hover:bg-[#FAEEE6] sm:min-h-[40px] sm:px-3 sm:text-[14px]"
                  >
                    New listing <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_116px] gap-2 sm:mt-4 sm:flex sm:flex-row sm:gap-2.5">
                  <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search your products</span>
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#688072]"
                      aria-hidden="true"
                    />
                    <input
                      className={`${inputStyle} pl-10`}
                      placeholder="Search by product name or SKU"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter products"
                    className={`${inputStyle} sm:w-[158px]`}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="all">All products</option>
                    <option value="low">Needs stock</option>
                    <option value="active">Live only</option>
                  </select>
                </div>
                <div className="mt-3 flex items-center justify-between text-[13px] font-semibold text-[#637267]">
                  <span>
                    {visible.length} of {offers.length} products
                  </span>
                  {loadingDetails && <span>Checking live stock…</span>}
                </div>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_100px_100px_95px] items-center gap-2 border-y border-[#DDE5DB] bg-[#E9EFE8] px-5 py-2.5 text-[13px] font-bold text-[#496153] xl:grid">
                <span>Product</span>
                <span>Available</span>
                <span>Price</span>
                <span className="text-right">Status</span>
              </div>
              <div className="epantry-stock-prices-list max-h-[350px] divide-y divide-[#E2E8E0] overflow-y-auto overscroll-contain border-y border-[#E2E8E0] sm:max-h-none sm:overflow-visible lg:max-h-[720px] lg:overflow-y-auto lg:overscroll-contain xl:border-t-0">
                {visible.map((offer) => {
                  const isSelected =
                    cleanId(offer.id) === cleanId(selectedOfferId);
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() =>
                        choose(
                          offer.id,
                          window.matchMedia("(max-width: 1023px)").matches
                        )
                      }
                      aria-pressed={isSelected}
                      className={`group flex w-full min-w-0 items-center gap-2 border-l-[4px] px-2.5 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-3 xl:grid xl:grid-cols-[minmax(0,1fr)_100px_100px_95px] xl:gap-2 ${
                        isSelected
                          ? "border-l-[#C86C42] bg-[#EDF3EA]"
                          : "border-l-transparent bg-white hover:border-l-[#9FC2AE] hover:bg-[#F6F8F3]"
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3 xl:flex-auto">
                        <span className="grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[#DAE4D9] bg-[#F0F3ED] text-[#173F35] sm:h-[56px] sm:w-[56px]">
                          {offer.imageUrl ? (
                            <img
                              src={offer.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package size={23} aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-[15px] font-extrabold leading-[1.4] text-[#173F35] [overflow-wrap:anywhere]">
                            {offer.name}
                          </strong>
                          <span className="mt-0.5 block text-[12.5px] text-[#627367] sm:mt-1 sm:text-[13px] xl:hidden">
                            {offer.sellable === null
                              ? "Checking stock…"
                              : `${offer.sellable} sellable units`}{" "}
                            ·{" "}
                            {money(
                              offer.currentPrice?.salePrice?.amountMinor ??
                                offer.currentPrice?.listPrice?.amountMinor
                            )}
                          </span>
                        </span>
                      </span>
                      <span className="hidden text-[14px] font-bold tabular-nums text-[#173F35] xl:block">
                        {offer.sellable === null ? "—" : offer.sellable}
                      </span>
                      <span className="hidden text-[14px] font-semibold tabular-nums text-[#42574A] xl:block">
                        {money(
                          offer.currentPrice?.salePrice?.amountMinor ??
                            offer.currentPrice?.listPrice?.amountMinor
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 xl:justify-end">
                        <Status status={offer.availability} />
                        <ArrowRight
                          size={16}
                          className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
                            isSelected ? "text-[#C86C42]" : "text-[#789080]"
                          }`}
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  );
                })}
                {visible.length === 0 && (
                  <p className="px-4 py-10 text-center text-[15px] text-[#52655A]">
                    {offers.length
                      ? "No products match this search or filter."
                      : "No products yet. Create your first listing."}
                  </p>
                )}
              </div>
            </section>

            <section
              ref={editorRef}
              id="stock-editor"
              aria-labelledby="stock-editor-title"
              className="min-w-0 scroll-mt-[86px] border-t-[4px] border-[#C86C42] bg-[#EBF0E7] p-4 sm:scroll-mt-24 sm:p-6 lg:sticky lg:top-5 xl:p-7"
            >
              <p className="text-[13px] font-bold uppercase tracking-[.07em] text-[#A85133]">
                <span className="sm:hidden">02 / Update</span>
                <span className="hidden sm:inline">
                  02 / Update selected product
                </span>
              </p>
              <h2
                id="stock-editor-title"
                className="mt-1 text-[22px] font-bold leading-[1.25] tracking-[-.025em] text-[#173F35] sm:text-[26px] sm:font-extrabold sm:leading-normal sm:tracking-[-.035em]"
              >
                Price &amp; quantity
              </h2>
              {!selected ? (
                <p className="mt-5 text-[15px] text-[#4F6157]">
                  Choose a product from the list to edit its stock and price.
                </p>
              ) : (
                <>
                  <div className="mt-3 flex min-w-0 items-center gap-3 border-b border-[#CAD6C9] pb-3 sm:mt-4 sm:pb-4">
                    {getImage(catalog[cleanId(selected.packId)]) ? (
                      <img
                        src={getImage(catalog[cleanId(selected.packId)])}
                        alt=""
                        className="h-[56px] w-[56px] shrink-0 rounded-[9px] border border-[#D4E0D3] bg-white object-cover sm:h-[70px] sm:w-[70px]"
                      />
                    ) : (
                      <span className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[9px] bg-white text-[#173F35] sm:h-[70px] sm:w-[70px]">
                        <Package size={26} aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] font-bold leading-[1.4] text-[#173F35] [overflow-wrap:anywhere] sm:text-[19px] sm:font-extrabold sm:leading-[1.35]">
                        {getProductName(selected, catalog)}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Status status={stockState(selected, selectedStatus)} />
                        <span className="text-[13px] font-semibold text-[#586C5E]">
                          {selectedInventory
                            ? `${
                                selectedInventory.totals?.sellableQuantity ?? 0
                              } sellable units`
                            : "Checking availability…"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {selected.status !== "active" && (
                    <p className="mt-3 border-l-4 border-[#C86C42] bg-[#FFF3E9] px-3 py-2 text-[14px] text-[#94492D]">
                      This offer is not live. Complete its selling setup in
                      Listing Studio.
                    </p>
                  )}
                  {(selectedStatus?.inventoryError ||
                    selectedStatus?.priceError) && (
                    <p role="alert" className="mt-3 text-[14px] text-red-700">
                      {selectedStatus.inventoryError ||
                        selectedStatus.priceError}
                    </p>
                  )}

                  <form
                    onSubmit={saveStock}
                    className="mt-4 sm:mt-5"
                    aria-label="Update product stock"
                  >
                    <div className="flex items-center gap-2 border-b border-[#CAD6C9] pb-2.5">
                      <Warehouse
                        size={19}
                        className="text-[#B75C39]"
                        aria-hidden="true"
                      />
                      <h3 className="text-[17px] font-bold leading-[1.35] tracking-[-.015em] text-[#173F35] sm:text-[19px] sm:font-extrabold sm:leading-normal sm:tracking-normal">
                        Update quantity
                      </h3>
                    </div>
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      role="group"
                      aria-label="Stock update type"
                    >
                      <button
                        type="button"
                        className={`min-h-[42px] rounded-[8px] px-4 text-[13px] font-semibold transition-colors sm:text-[14px] sm:font-bold ${
                          stockMode === "add"
                            ? "bg-[#173F35] text-white"
                            : "border border-[#BACBBE] bg-white text-[#173F35] hover:bg-[#F8FAF7]"
                        }`}
                        aria-pressed={stockMode === "add"}
                        onClick={() => {
                          setStockMode("add");
                          setStockValue("");
                        }}
                      >
                        <Plus
                          size={15}
                          className="mr-1 inline"
                          aria-hidden="true"
                        />{" "}
                        Add stock
                      </button>
                      <button
                        type="button"
                        className={`min-h-[42px] rounded-[8px] px-4 text-[13px] font-semibold transition-colors sm:text-[14px] sm:font-bold ${
                          stockMode === "set"
                            ? "bg-[#173F35] text-white"
                            : "border border-[#BACBBE] bg-white text-[#173F35] hover:bg-[#F8FAF7]"
                        }`}
                        aria-pressed={stockMode === "set"}
                        onClick={() => {
                          setStockMode("set");
                          setStockValue("");
                        }}
                      >
                        <Minus
                          size={15}
                          className="mr-1 inline"
                          aria-hidden="true"
                        />{" "}
                        Set total
                      </button>
                    </div>
                    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                      <Field label="Stock location">
                        <select
                          value={stockLocationId}
                          onChange={(event) => {
                            setStockLocationId(event.target.value);
                            setStockValue("");
                          }}
                          className={inputStyle}
                          disabled={working}
                          required
                        >
                          <option value="">Choose location</option>
                          {availableNodes.map((node) => (
                            <option value={node.id} key={node.id}>
                              {node.name || "Stock location"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label={
                          stockMode === "add"
                            ? "Units to add"
                            : "New total units"
                        }
                      >
                        <input
                          type="number"
                          min={stockMode === "add" ? "1" : "0"}
                          step="1"
                          max="1000000000"
                          placeholder={
                            stockMode === "add" ? "e.g. 20" : "e.g. 25"
                          }
                          value={stockValue}
                          onChange={(event) =>
                            setStockValue(event.target.value)
                          }
                          className={inputStyle}
                          disabled={working}
                          required
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-[13px] font-medium leading-5 text-[#546A5B] sm:font-normal">
                      <span className="sm:hidden">
                        {selectedQuantity} total · {selectedReserved} reserved
                      </span>
                      <span className="hidden sm:inline">
                        {selectedQuantity} total at this location ·{" "}
                        {selectedReserved} reserved
                      </span>
                    </p>
                    {!availableNodes.length && (
                      <p className="mt-2 text-[14px] text-[#94492D]">
                        No active stock location found. Manage locations in
                        Operations Center.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={
                        working ||
                        !selectedStatus ||
                        selected.status !== "active" ||
                        !stockLocationId ||
                        !stockValue.trim()
                      }
                      className="mt-3 inline-flex min-h-[45px] w-full items-center justify-center rounded-[9px] bg-[#173F35] px-5 text-[14px] font-semibold text-white sm:text-[15px] sm:font-bold transition-colors hover:bg-[#285B4B] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === "stock" ? "Saving stock…" : "Save stock"}
                    </button>
                  </form>

                  <form
                    onSubmit={savePrice}
                    className="mt-4 border-t border-[#CAD6C9] pt-3 sm:mt-5 sm:pt-4"
                    aria-label="Update product price"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        size={19}
                        className="text-[#B75C39]"
                        aria-hidden="true"
                      />
                      <h3 className="text-[17px] font-bold leading-[1.35] tracking-[-.015em] text-[#173F35] sm:text-[19px] sm:font-extrabold sm:leading-normal sm:tracking-normal">
                        Update price
                      </h3>
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-[#52675A] sm:text-[14px]">
                      <span className="sm:hidden">Current price: </span>
                      <span className="hidden sm:inline">
                        Current customer price:{" "}
                      </span>
                      <strong className="font-semibold tabular-nums text-[#173F35] sm:font-bold">
                        {money(
                          selectedStatus?.priceRule?.salePrice?.amountMinor ??
                            selectedStatus?.priceRule?.listPrice?.amountMinor
                        )}
                      </strong>
                    </p>
                    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-1 2xl:grid-cols-2">
                      <Field label="List price (₹)">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={listPrice}
                          onChange={(event) => setListPrice(event.target.value)}
                          disabled={working}
                          className={inputStyle}
                          required
                        />
                      </Field>
                      <Field
                        label={
                          <>
                            <span className="sm:hidden">Sale price (₹)</span>
                            <span className="hidden sm:inline">
                              Sale price (₹, optional)
                            </span>
                          </>
                        }
                      >
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={salePrice}
                          onChange={(event) => setSalePrice(event.target.value)}
                          disabled={working}
                          className={inputStyle}
                        />
                      </Field>
                    </div>
                    <button
                      type="submit"
                      disabled={
                        working ||
                        !selectedStatus ||
                        selected.status !== "active"
                      }
                      className="mt-3 inline-flex min-h-[45px] w-full items-center justify-center rounded-[9px] bg-[#C86C42] px-5 text-[14px] font-semibold text-white sm:text-[15px] sm:font-bold transition-colors hover:bg-[#AD5735] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === "price" ? "Saving price…" : "Save price"}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}

        {!loading && (
          <div className="mt-6 hidden flex-wrap items-center justify-between gap-3 border-t border-[#D4DCD3] pt-4 sm:flex">
            <p className="text-[14px] text-[#53685C]">
              For new products, use Listing Studio.
            </p>
            <Link
              to="/host/listings"
              className="inline-flex items-center gap-1 text-[14px] font-bold text-[#173F35] underline underline-offset-4 hover:text-[#B65F3D]"
            >
              Open Listing Studio <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
