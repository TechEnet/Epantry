import { useCallback, useEffect, useRef, useState } from "react";

import {
  ArrowUpRight,
  BellOff,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Lightbulb,
  LoaderCircle,
  MoreHorizontal,
  Package,
  PackageCheck,
  PauseCircle,
  Play,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  getNextBasket,
  getPlanningErrorMessage,
  listMealPlans,
  submitNextBasketFeedback,
  updateNextBasketPreferences,
} from "../services/planning.service";

import {
  getCatalogProducts,
} from "../../grocery/services/catalog.service";

import {
  getPublicPackOffers,
} from "../../marketplace/services/marketplace.service";

import {
  getDefaultDeliveryAddress,
} from "../../deliveryAddresses/services/deliveryAddress.service";

import {
  createCommerceIdempotencyKey,
  createDirectMarketplaceCart,
  getCommerceErrorMessage,
} from "../../commerce/services/commerce.service";

const FLOATING_MARKETPLACE_CART_KEY =
  "epantry-floating-marketplace-cart";

function saveFloatingMarketplaceCart({ cartId, items }) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        updatedAt: new Date().toISOString(),
      })
    );
    window.sessionStorage.removeItem("epantry-floating-cart-hidden");
  } catch {
    // Session persistence is best-effort UX state only.
  }

  window.dispatchEvent(
    new CustomEvent("epantry-cart-updated", {
      detail: { show: true },
    })
  );
}

function notifyFloatingCartFly({ name, sourceElement }) {
  const rect = sourceElement?.getBoundingClientRect?.();

  window.dispatchEvent(
    new CustomEvent("epantry-cart-fly", {
      detail: {
        name,
        startRect: rect
          ? {
              left: rect.left + rect.width / 2,
              top: rect.top + rect.height / 2,
            }
          : null,
      },
    })
  );
}

const CLASSIFICATION_LABELS = {
  required_for_planned_meal: "Needed for a planned meal",
  likely_running_low: "Likely running low",
  predicted_staple_replenishment: "May need a refill",
  optional_usual_purchase: "Usually purchased",
  value_opportunity: "Worth considering",
  enough_already_available: "Enough available",
};

const CLASSIFICATION_EXPLANATIONS = {
  required_for_planned_meal:
    "Your planned meals need more of this than your Pantry currently covers.",
  likely_running_low:
    "Your Pantry signals suggest this item may be running low soon.",
  predicted_staple_replenishment:
    "This looks like an item you may need to replenish soon.",
  optional_usual_purchase:
    "This is based on your usual purchase pattern.",
  value_opportunity:
    "This item may be useful for your upcoming needs.",
  enough_already_available:
    "Your Pantry currently appears to have enough of this item.",
};

function formatQuantity(quantity) {
  if (!quantity || quantity.mode === "unknown") {
    return "Quantity needs confirmation";
  }

  if (quantity.mode === "exact") {
    return `${quantity.value} ${quantity.unit || ""}`.trim();
  }

  return "Quantity needs confirmation";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProductMatchScore(product, ingredientName) {
  const productName = normalizeText(product?.displayName);
  const ingredient = normalizeText(ingredientName);

  if (!productName || !ingredient) {
    return 0;
  }

  if (productName === ingredient) {
    return 100;
  }

  if (productName.startsWith(`${ingredient} `)) {
    return 90;
  }

  if (productName.includes(ingredient)) {
    return 80;
  }

  const ingredientTokens = ingredient.split(" ").filter(Boolean);
  const matchedTokens = ingredientTokens.filter((token) =>
    productName.includes(token)
  ).length;

  return ingredientTokens.length > 0
    ? Math.round((matchedTokens / ingredientTokens.length) * 60)
    : 0;
}

function toBaseQuantity(value, unit) {
  const numeric = Number(value);
  const normalizedUnit = String(unit || "")
    .trim()
    .toLowerCase();

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  const mass = {
    mg: 0.001,
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
  };

  const volume = {
    ml: 1,
    millilitre: 1,
    millilitres: 1,
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    litre: 1000,
    litres: 1000,
    liter: 1000,
    liters: 1000,
  };

  const count = {
    unit: 1,
    units: 1,
    pc: 1,
    pcs: 1,
    piece: 1,
    pieces: 1,
    count: 1,
  };

  if (Object.prototype.hasOwnProperty.call(mass, normalizedUnit)) {
    return {
      dimension: "mass",
      value: numeric * mass[normalizedUnit],
    };
  }

  if (Object.prototype.hasOwnProperty.call(volume, normalizedUnit)) {
    return {
      dimension: "volume",
      value: numeric * volume[normalizedUnit],
    };
  }

  if (Object.prototype.hasOwnProperty.call(count, normalizedUnit)) {
    return {
      dimension: "count",
      value: numeric * count[normalizedUnit],
    };
  }

  return null;
}

function getSuggestedPackCount(item, product, offer) {
  const minimum = Math.max(
    1,
    Number(offer?.minimumOrderQuantity || 1)
  );

  const maximumCandidate = Number(offer?.maximumOrderQuantity);
  const maximum = Number.isFinite(maximumCandidate)
    ? Math.max(minimum, Math.floor(maximumCandidate))
    : 100000;

  const required =
    item?.proposedQuantity?.mode === "exact"
      ? toBaseQuantity(
          item.proposedQuantity.value,
          item.proposedQuantity.unit
        )
      : null;

  const pack = toBaseQuantity(
    product?.netQuantity?.value,
    product?.netQuantity?.unit
  );

  let quantity = minimum;

  if (
    required &&
    pack &&
    required.dimension === pack.dimension &&
    pack.value > 0
  ) {
    quantity = Math.ceil(required.value / pack.value);
  }

  return Math.min(maximum, Math.max(minimum, quantity));
}

function chooseBestProduct(products, ingredientName) {
  return [...(products || [])]
    .map((product) => ({
      product,
      score: getProductMatchScore(product, ingredientName),
    }))
    .filter((entry) => entry.score > 0 && entry.product?.packId)
    .sort((left, right) => right.score - left.score)[0]?.product || null;
}

function chooseBestOffer(offers) {
  return [...(offers || [])]
    .filter((offer) => offer?.id)
    .sort((left, right) => {
      const leftPrice = Number(left?.price?.effectiveAmountMinor);
      const rightPrice = Number(right?.price?.effectiveAmountMinor);

      if (!Number.isFinite(leftPrice) && !Number.isFinite(rightPrice)) {
        return 0;
      }

      if (!Number.isFinite(leftPrice)) {
        return 1;
      }

      if (!Number.isFinite(rightPrice)) {
        return -1;
      }

      return leftPrice - rightPrice;
    })[0] || null;
}

export default function NextBasketPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [cartWorkingId, setCartWorkingId] = useState("");
  const [error, setError] = useState("");
  const [openMealPlanId, setOpenMealPlanId] = useState("");

  // Disclosure state is local to this page; shopping/feedback requests are unchanged.
  const [openActionsId, setOpenActionsId] = useState("");
  const [actionsPlacement, setActionsPlacement] = useState("below");
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!openActionsId) {
      return undefined;
    }

    function handleOutsidePointer(event) {
      if (!actionsRef.current?.contains(event.target)) {
        setOpenActionsId("");
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        actionsRef.current
          ?.querySelector("[data-next-basket-trigger]")
          ?.focus();
        setOpenActionsId("");
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openActionsId]);

  useEffect(() => {
    if (workingId || cartWorkingId || loading) {
      setOpenActionsId("");
    }
  }, [workingId, cartWorkingId, loading]);

  function toggleActions(event, actionKey) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pageBottom = event.currentTarget
      .closest("[data-next-basket-page]")
      ?.getBoundingClientRect().bottom;
    const availableBelow = Math.min(
      window.innerHeight,
      pageBottom ?? window.innerHeight
    ) - rect.bottom;

    // Open upwards near the end of the viewport/page, rather than clipping actions.
    setActionsPlacement(
      availableBelow < 280 && rect.top > 280 ? "above" : "below"
    );
    setOpenActionsId((current) => (current === actionKey ? "" : actionKey));
  }

  function chooseFeedback(item, action, extras = {}) {
    actionsRef.current
      ?.querySelector("[data-next-basket-trigger]")
      ?.focus();
    setOpenActionsId("");
    feedback(item, action, extras);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const nextBasketData = await getNextBasket();
      const mealPlanData = await listMealPlans();

      setData(nextBasketData);
      setMealPlans(mealPlanData?.mealPlans || []);
    } catch (loadError) {
      setError(
        getPlanningErrorMessage(loadError, "Unable to load Next Basket.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function feedback(item, action, extras = {}) {
    setWorkingId(item.id);
    setError("");

    try {
      await submitNextBasketFeedback({
        predictionId: item.id,
        action,
        ...extras,
      });

      await load();
    } catch (requestError) {
      setError(getPlanningErrorMessage(requestError));
    } finally {
      setWorkingId("");
    }
  }

  async function toggleRecommendations() {
    const enabled = data?.preferences?.nextBasketEnabled !== false;

    try {
      await updateNextBasketPreferences({
        nextBasketEnabled: !enabled,
      });

      await load();
    } catch (requestError) {
      setError(getPlanningErrorMessage(requestError));
    }
  }

  async function handleAddToCart(item, sourceElement) {
    if (cartWorkingId || workingId) {
      return;
    }

    setCartWorkingId(item.id);
    setError("");

    try {
      const addressResult = await getDefaultDeliveryAddress();
      const address = addressResult?.address || null;
      const pincode = String(address?.postalCode || "").trim();

      if (!/^\d{6}$/.test(pincode)) {
        navigate(
          `/delivery-addresses?returnTo=${encodeURIComponent("/next-basket")}`
        );
        return;
      }

      const catalogResult = await getCatalogProducts({
        search: item.ingredientName,
        page: 1,
        limit: 24,
        listedOnly: true,
      });

      const product = chooseBestProduct(
        catalogResult?.products,
        item.ingredientName
      );

      if (!product?.packId) {
        throw new Error(
          `No directly purchasable EPANTRY product is available for ${item.ingredientName} yet.`
        );
      }

      const offerResult = await getPublicPackOffers({
        packId: product.packId,
        pincode,
        fulfillmentType: "delivery",
      });

      const offer = chooseBestOffer(offerResult?.offers);

      if (!offer?.id) {
        throw new Error(
          `No delivery offer for ${item.ingredientName} is available at your saved pincode right now.`
        );
      }

      const quantity = getSuggestedPackCount(item, product, offer);

      const cartResult = await createDirectMarketplaceCart({
        packId: product.packId,
        offerId: offer.id,
        quantity,
        pincode,
        fulfillmentType: "delivery",
        idempotencyKey: createCommerceIdempotencyKey(
          `next-basket-${item.id}`
        ),
      });

      const cartId = cartResult?.cart?.id;

      if (!cartId) {
        throw new Error("Marketplace Cart identity was not returned.");
      }

      const cartItemName =
        product?.displayName || item.ingredientName || "Product";

      saveFloatingMarketplaceCart({
        cartId,
        items: [
          {
            id: product.packId,
            packId: product.packId,
            name: cartItemName,
            quantity,
          },
        ],
      });

      notifyFloatingCartFly({
        name: cartItemName,
        sourceElement,
      });

      navigate(`/cart/${cartId}`);
    } catch (cartError) {
      setError(
        getCommerceErrorMessage(
          cartError,
          "Unable to add this recommendation to your cart right now."
        )
      );
    } finally {
      setCartWorkingId("");
    }
  }

  const recommendationsEnabled =
    data?.preferences?.nextBasketEnabled !== false;

  const itemCount = (data?.items || []).length;

  const allItems = data?.items || [];
  const groupedItemIds = new Set();

  const mealPlanGroups = mealPlans
    .map((mealPlan) => {
      const plannedMealIds = new Set(
        (mealPlan.meals || []).map((meal) => String(meal.id || ""))
      );

      const items = allItems.filter((item) =>
        (item.evidenceReferences || []).some((reference) => {
          if (!String(reference || "").startsWith("plannedMeal:")) {
            return false;
          }

          return plannedMealIds.has(
            String(reference).slice("plannedMeal:".length)
          );
        })
      );

      items.forEach((item) => groupedItemIds.add(item.id));

      return {
        ...mealPlan,
        items,
      };
    })
    .filter((mealPlan) => mealPlan.items.length > 0);

  const otherItems = allItems.filter(
    (item) => !groupedItemIds.has(item.id)
  );

  const openMealPlan = mealPlanGroups.find(
    (mealPlan) => mealPlan.id === openMealPlanId
  ) || null;

  function renderSuggestionCard(item, index, contextKey) {
    const itemWorking = workingId === item.id;
    const itemAdding = cartWorkingId === item.id;
    const anyItemWorking = Boolean(workingId || cartWorkingId);
    const actionKey = `${contextKey}:${item.id}`;
    const actionsOpen = openActionsId === actionKey;
    const confidence = String(item.confidenceClass || "").toLowerCase();
    const highConfidence = confidence === "high";
    const classificationIcon = item.classification === "required_for_planned_meal"
      ? CalendarDays
      : item.classification === "likely_running_low"
        ? Clock3
        : item.classification === "enough_already_available"
          ? PackageCheck
          : Lightbulb;
    const ClassificationIcon = classificationIcon;
    const hasExactQuantity = item.proposedQuantity?.mode === "exact";
    const elementKey = `${contextKey}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const moreActions = [
      { action: "still_have", label: "Still have", icon: PackageCheck },
      { action: "bought_elsewhere", label: "Bought elsewhere", icon: ReceiptText },
      { action: "snooze", label: "Snooze 7d", icon: Clock3 },
      { action: "reject", label: "Remove", icon: X },
      { action: "stop_suggesting", label: "Stop suggesting", icon: BellOff },
    ];

    return (
      <article
        key={`${contextKey}-${item.id}`}
        aria-labelledby={`next-basket-item-${elementKey}`}
        className={`relative flex min-w-0 flex-col rounded-2xl border border-violet-200/90 bg-[#f4f0ff] shadow-[0_2px_8px_rgba(76,29,149,0.045)] transition-[border-color,box-shadow] duration-200 hover:border-emerald-300 hover:shadow-[0_8px_24px_rgba(6,78,59,0.07)] ${actionsOpen ? "z-30" : ""}`}
      >
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold leading-4 text-emerald-800">
              <ClassificationIcon size={12} className="shrink-0" aria-hidden="true" />
              {CLASSIFICATION_LABELS[item.classification] || "Suggested for you"}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium leading-4 ${highConfidence ? "text-emerald-700" : "text-stone-500"}`}>
              {highConfidence && <CheckCircle2 size={12} className="shrink-0" aria-hidden="true" />}
              {highConfidence ? "High confidence" : `${item.confidenceClass || "Suggested"} confidence`}
            </span>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id={`next-basket-item-${elementKey}`} className="text-[20px] font-bold leading-7 tracking-[-0.025em] text-stone-950 [overflow-wrap:anywhere]">
                {item.ingredientName}
              </h3>
            </div>
            <div className={`shrink-0 rounded-lg px-2.5 py-1.5 text-right ${hasExactQuantity ? "bg-[#dff4ff]" : "max-w-[45%] bg-rose-100"}`}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-500">Suggested amount</p>
              <p className={`mt-0.5 font-bold leading-5 tabular-nums ${hasExactQuantity ? "text-[14px] text-emerald-900" : "text-[11px] text-rose-800"}`}>
                {formatQuantity(item.proposedQuantity)}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-5 text-stone-500">
            {CLASSIFICATION_EXPLANATIONS[item.classification] ||
              "EPANTRY found a useful shopping signal for this item."}
          </p>
        </div>

        <div className="mx-4 border-t border-violet-100 pb-4 pt-3 sm:mx-5 sm:pb-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={anyItemWorking}
              onClick={(event) =>
                handleAddToCart(item, event.currentTarget)
              }
              aria-label={`Add ${item.ingredientName} to cart`}
              className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 text-white shadow-[0_2px_4px_rgba(6,78,59,0.12)] transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {itemAdding ? <LoaderCircle size={15} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShoppingCart size={15} className="shrink-0" aria-hidden="true" />}
              <span className="whitespace-nowrap text-[13px] font-semibold">
                {itemAdding ? "Adding..." : "Add to cart"}
              </span>
            </button>
            <button
              type="button"
              disabled={anyItemWorking}
              onClick={() => feedback(item, "accept")}
              aria-label={`Accept suggestion for ${item.ingredientName}`}
              title="Save this suggestion without creating a cart"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-stone-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {itemWorking ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
              <span className="text-xs font-semibold">{itemWorking ? "Saving..." : "Accept"}</span>
            </button>

            <div
              ref={actionsOpen ? actionsRef : null}
              className="relative shrink-0"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setOpenActionsId((current) => current === actionKey ? "" : current);
                }
              }}
            >
              <button
                type="button"
                data-next-basket-trigger
                disabled={anyItemWorking}
                aria-label={`More actions for ${item.ingredientName}`}
                title="More actions"
                aria-expanded={actionsOpen}
                aria-controls={actionsOpen ? `next-basket-actions-${elementKey}` : undefined}
                onClick={(event) => toggleActions(event, actionKey)}
                className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${actionsOpen ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-white text-stone-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"}`}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {actionsOpen && (
                <div
                  id={`next-basket-actions-${elementKey}`}
                  role="group"
                  aria-label={`More actions for ${item.ingredientName}`}
                  className={`absolute right-0 z-40 w-56 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_12px_40px_rgba(28,25,23,0.16)] ${actionsPlacement === "above" ? "bottom-full mb-2" : "top-full mt-2"}`}
                >
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Manage suggestion</p>
                  {moreActions.map((action, actionIndex) => {
                    const ActionIcon = action.icon;
                    return (
                      <div key={action.action} className={actionIndex === 3 ? "mt-1 border-t border-stone-100 pt-1" : ""}>
                        <button
                          type="button"
                          disabled={anyItemWorking}
                          onClick={() => chooseFeedback(
                            item,
                            action.action,
                            action.action === "snooze" ? {
                              snoozeUntil: new Date(Date.now() + 7 * 86_400_000).toISOString(),
                            } : {}
                          )}
                          className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 ${action.action === "stop_suggesting" ? "text-rose-700 hover:bg-rose-50" : "text-stone-600 hover:bg-emerald-50 hover:text-emerald-900"}`}
                        >
                          <ActionIcon size={15} className="shrink-0" aria-hidden="true" />
                          <span className="text-[13px] font-medium">{action.label}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef]" data-next-basket-page>
      <div className="page-shell pt-0 pb-5 sm:pb-6">
        <div className="px-1 sm:px-3 lg:px-4">
          <header className="relative mt-3 overflow-hidden rounded-3xl border border-sky-300/80 bg-[#d9efff] shadow-[0_6px_22px_rgba(14,116,144,0.08)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(186,230,253,0.72),rgba(207,250,254,0.48)_48%,rgba(255,255,255,0.18)_100%)]"
            />
            <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="min-w-0 max-w-3xl">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sky-900">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-200/90 text-sky-900">
                    <ShoppingCart size={14} aria-hidden="true" />
                  </span>
                  Next Basket
                </div>
                <h1 className="text-[27px] font-extrabold leading-tight tracking-[-0.035em] text-stone-950 sm:text-[32px]">
                  Shop what you may need next.
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-stone-600 sm:text-sm">
                  Suggestions come from your planned meals and Pantry signals.
                  You choose what to keep, skip or add to your cart.
                </p>
              </div>
              <Link
                to="/meal-plan"
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2.5 self-start rounded-xl border border-blue-700 bg-blue-700 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:border-blue-800 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:self-center"
              >
                <CalendarDays size={16} aria-hidden="true" />
                Open Meal Plan
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </header>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="min-w-0 leading-6">{error}</p>
            </div>
          )}

          <section
            className="mt-5 rounded-3xl border border-violet-300/80 bg-[#eee7ff] p-4 sm:p-5"
            aria-labelledby="next-basket-steps-heading"
          >
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-800">
                How this page works
              </p>
              <h2
                id="next-basket-steps-heading"
                className="mt-1 text-lg font-extrabold tracking-tight text-stone-950"
              >
                Review your next basket in 4 simple steps
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-sky-300/80 bg-[#d9efff] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-700 text-white">
                    <CalendarDays size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-800">Step 1</p>
                    <p className="mt-1 text-sm font-extrabold text-stone-950">Plan your meals</p>
                    <p className="mt-1 text-xs leading-5 text-stone-700">Next Basket reads what your planned meals may need.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-300/90 bg-[#ffe1eb] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-600 text-white">
                    <Package size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-900">Step 2</p>
                    <p className="mt-1 text-sm font-extrabold text-stone-950">EPANTRY checks Pantry</p>
                    <p className="mt-1 text-xs leading-5 text-stone-700">It compares those needs with your current Pantry signals.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-violet-300/90 bg-[#e3d8ff] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-700 text-white">
                    <CheckCircle2 size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-900">Step 3</p>
                    <p className="mt-1 text-sm font-extrabold text-stone-950">Review each suggestion</p>
                    <p className="mt-1 text-xs leading-5 text-stone-700">Check why it is suggested and the amount EPANTRY recommends.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-300/90 bg-[#cef4df] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white">
                    <ShoppingCart size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-900">Step 4</p>
                    <p className="mt-1 text-sm font-extrabold text-stone-950">Choose what to do</p>
                    <p className="mt-1 text-xs leading-5 text-stone-700">Add to cart, Accept, or use the more menu to manage the suggestion.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            className="mt-5 rounded-3xl border border-teal-300/80 bg-[#dff6f1] p-4 sm:p-5"
            aria-labelledby="next-basket-suggestions-heading"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2
                    id="next-basket-suggestions-heading"
                    className="text-base font-bold tracking-tight text-stone-900"
                  >
                    Shopping suggestions
                  </h2>
                  <span
                    aria-label={`${itemCount} suggestions`}
                    className="inline-flex min-w-7 items-center justify-center rounded-lg border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-900"
                  >
                    {data ? itemCount : "--"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Pause anytime. Your Pantry and meal plans stay unchanged.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                <span
                  className={`mr-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                    recommendationsEnabled ? "text-emerald-800" : "text-stone-500"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      recommendationsEnabled ? "bg-emerald-600" : "bg-stone-400"
                    }`}
                  />
                  {recommendationsEnabled ? "Suggestions on" : "Paused"}
                </span>
                <button
                  type="button"
                  onClick={toggleRecommendations}
                  aria-label={recommendationsEnabled ? "Pause shopping suggestions" : "Resume shopping suggestions"}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  {recommendationsEnabled ? (
                    <PauseCircle size={14} aria-hidden="true" />
                  ) : (
                    <Play size={14} aria-hidden="true" />
                  )}
                  <span className="text-xs font-semibold">
                    {recommendationsEnabled ? "Pause" : "Resume"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  aria-label="Refresh Next Basket"
                  title="Refresh suggestions"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="sr-only" role="status" aria-live="polite">
              {loading ? "Updating shopping suggestions." : `${itemCount} suggestions available.`}
            </p>

            {loading && !data && (
              <div className="grid gap-4 lg:grid-cols-3" aria-label="Loading suggestions">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} aria-hidden="true" className="animate-pulse rounded-2xl border border-violet-200 bg-[#f4f0ff] p-5 motion-reduce:animate-none">
                    <div className="h-4 w-36 rounded bg-violet-100" />
                    <div className="mt-5 h-6 w-2/3 rounded bg-violet-100" />
                    <div className="mt-4 h-3 w-full rounded bg-violet-100" />
                    <div className="mt-2 h-3 w-3/4 rounded bg-violet-100" />
                    <div className="mt-6 h-10 rounded-lg bg-emerald-50" />
                  </div>
                ))}
              </div>
            )}

            {!loading && !error && itemCount === 0 && (
              <div className="rounded-3xl border border-dashed border-emerald-300 bg-[#f0fff6] px-6 py-12 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                  {recommendationsEnabled ? <Check size={25} aria-hidden="true" /> : <PauseCircle size={25} aria-hidden="true" />}
                </span>
                <h3 className="mt-4 text-lg font-bold text-stone-900">
                  {recommendationsEnabled ? "Nothing needs your attention right now" : "Shopping suggestions are paused"}
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                  {recommendationsEnabled
                    ? "When a planned meal or Pantry signal suggests a need, it will appear here for you to review."
                    : "Resume suggestions whenever you are ready. Your Pantry and saved meal plans are unchanged."}
                </p>
              </div>
            )}

            {!loading && mealPlanGroups.length > 0 && (
              <div className="space-y-5" aria-busy={loading}>
                {mealPlanGroups.map((mealPlan) => {
                  const visibleItems = mealPlan.items.slice(0, 6);

                  return (
                    <section
                      key={mealPlan.id}
                      className="rounded-2xl border border-teal-200/90 bg-white/55 p-4 sm:p-5"
                      aria-labelledby={`meal-plan-suggestions-${mealPlan.id}`}
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-800">
                            Meal plan
                          </p>
                          <h3
                            id={`meal-plan-suggestions-${mealPlan.id}`}
                            className="mt-1 truncate text-xl font-extrabold capitalize tracking-tight text-stone-950"
                          >
                            {mealPlan.title || "Meal plan"}
                          </h3>
                        </div>
                        <span className="inline-flex items-center rounded-lg border border-teal-300 bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-900">
                          {mealPlan.items.length} {mealPlan.items.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      <div className="grid items-stretch gap-4 lg:grid-cols-3">
                        {visibleItems.map((item, index) =>
                          renderSuggestionCard(
                            item,
                            index,
                            `meal-plan-${mealPlan.id}`
                          )
                        )}
                      </div>

                      {mealPlan.items.length > 6 && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionsId("");
                              setOpenMealPlanId(mealPlan.id);
                            }}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-violet-300 bg-violet-700 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
                          >
                            View all ({mealPlan.items.length})
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}

            {!loading && otherItems.length > 0 && (
              <section className={mealPlanGroups.length > 0 ? "mt-5" : ""} aria-labelledby="other-next-basket-suggestions">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 id="other-next-basket-suggestions" className="text-base font-extrabold text-stone-900">
                    Other suggestions
                  </h3>
                  <span className="inline-flex items-center rounded-lg border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-900">
                    {otherItems.length} {otherItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="grid items-stretch gap-4 lg:grid-cols-3">
                  {otherItems.map((item, index) =>
                    renderSuggestionCard(item, index, "other-suggestions")
                  )}
                </div>
              </section>
            )}
          </section>

          {openMealPlan && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-md"
              role="dialog"
              aria-modal="true"
              aria-labelledby="next-basket-meal-plan-dialog-title"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setOpenActionsId("");
                  setOpenMealPlanId("");
                }
              }}
            >
              <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/70 bg-[#e8e1ff]/80 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-800">
                      All meal plan items
                    </p>
                    <h2
                      id="next-basket-meal-plan-dialog-title"
                      className="mt-1 truncate text-2xl font-extrabold capitalize tracking-tight text-stone-950"
                    >
                      {openMealPlan.title || "Meal plan"}
                    </h2>
                    <p className="mt-1 text-xs text-stone-600">
                      {openMealPlan.items.length} {openMealPlan.items.length === 1 ? "suggestion" : "suggestions"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenActionsId("");
                      setOpenMealPlanId("");
                    }}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-violet-200 bg-white/80 text-stone-700 transition-colors hover:bg-violet-100 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                    aria-label="Close meal plan items"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <div className="max-h-[calc(88vh-105px)] overflow-y-auto p-5 sm:p-6">
                  <div className="grid items-stretch gap-4 lg:grid-cols-3">
                    {openMealPlan.items.map((item, index) =>
                      renderSuggestionCard(
                        item,
                        index,
                        `meal-plan-popup-${openMealPlan.id}`
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2.5 border-t border-stone-200/80 px-1 pb-2 pt-4 text-xs leading-5 text-stone-500">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p>
              <span className="font-semibold text-stone-700">You are in control.</span>{" "}
              Accept saves a suggestion. Add to cart checks product and delivery
              availability. Nothing is ordered until you complete checkout.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
