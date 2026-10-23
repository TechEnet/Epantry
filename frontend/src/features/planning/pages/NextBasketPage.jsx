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

import { Link, useNavigate } from "react-router-dom";

import {
  getNextBasket,
  getPlanningErrorMessage,
  listMealPlans,
  submitNextBasketFeedback,
  updateNextBasketPreferences,
} from "../services/planning.service";

import { getCatalogProducts } from "../../grocery/services/catalog.service";

import { getPublicPackOffers } from "../../marketplace/services/marketplace.service";

import { getDefaultDeliveryAddress } from "../../deliveryAddresses/services/deliveryAddress.service";

import {
  createCommerceIdempotencyKey,
  createDirectMarketplaceCart,
  getCommerceErrorMessage,
} from "../../commerce/services/commerce.service";

import SponsoredCampaignSlot from "../../retailMedia/components/SponsoredCampaignSlot";

const FLOATING_MARKETPLACE_CART_KEY = "epantry-floating-marketplace-cart";

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
  optional_usual_purchase: "This is based on your usual purchase pattern.",
  value_opportunity: "This item may be useful for your upcoming needs.",
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
  const minimum = Math.max(1, Number(offer?.minimumOrderQuantity || 1));

  const maximumCandidate = Number(offer?.maximumOrderQuantity);
  const maximum = Number.isFinite(maximumCandidate)
    ? Math.max(minimum, Math.floor(maximumCandidate))
    : 100000;

  const required =
    item?.proposedQuantity?.mode === "exact"
      ? toBaseQuantity(item.proposedQuantity.value, item.proposedQuantity.unit)
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
  return (
    [...(products || [])]
      .map((product) => ({
        product,
        score: getProductMatchScore(product, ingredientName),
      }))
      .filter((entry) => entry.score > 0 && entry.product?.packId)
      .sort((left, right) => right.score - left.score)[0]?.product || null
  );
}

function chooseBestOffer(offers) {
  return (
    [...(offers || [])]
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
      })[0] || null
  );
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
  const [showAllOtherItems, setShowAllOtherItems] = useState(false);

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
    const availableBelow =
      Math.min(window.innerHeight, pageBottom ?? window.innerHeight) -
      rect.bottom;

    // Open upwards near the end of the viewport/page, rather than clipping actions.
    setActionsPlacement(
      availableBelow < 280 && rect.top > 280 ? "above" : "below"
    );
    setOpenActionsId((current) => (current === actionKey ? "" : actionKey));
  }

  function chooseFeedback(item, action, extras = {}) {
    actionsRef.current?.querySelector("[data-next-basket-trigger]")?.focus();
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
        idempotencyKey: createCommerceIdempotencyKey(`next-basket-${item.id}`),
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

  const recommendationsEnabled = data?.preferences?.nextBasketEnabled !== false;

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

  const otherItems = allItems.filter((item) => !groupedItemIds.has(item.id));

  const openMealPlan =
    mealPlanGroups.find((mealPlan) => mealPlan.id === openMealPlanId) || null;

  function renderSuggestionCard(item, index, contextKey, mobileHidden = false) {
    const itemWorking = workingId === item.id;
    const itemAdding = cartWorkingId === item.id;
    const anyItemWorking = Boolean(workingId || cartWorkingId);
    const actionKey = `${contextKey}:${item.id}`;
    const actionsOpen = openActionsId === actionKey;
    const hasExactQuantity = item.proposedQuantity?.mode === "exact";
    const confidenceClass = String(item.confidenceClass || "")
      .trim()
      .toLowerCase();
    const elementKey = `${contextKey}-${index}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const moreActions = [
      { action: "still_have", label: "Still have", icon: PackageCheck },
      {
        action: "bought_elsewhere",
        label: "Bought elsewhere",
        icon: ReceiptText,
      },
      { action: "snooze", label: "Snooze 7d", icon: Clock3 },
      { action: "reject", label: "Remove", icon: X },
      { action: "stop_suggesting", label: "Stop suggesting", icon: BellOff },
    ];

    return (
      <article
        key={`${contextKey}-${item.id}`}
        aria-labelledby={`next-basket-item-${elementKey}`}
        className={`nb2-item group ${mobileHidden ? "nb2-mobile-hidden" : ""} ${
          actionsOpen ? "nb2-menu-active" : ""
        }`}
      >
        <div className="nb2-item-sequence" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="nb2-item-description">
          <p className="nb2-item-kind">
            {CLASSIFICATION_LABELS[item.classification] ||
              "Shopping suggestion"}
          </p>
          <h4 id={`next-basket-item-${elementKey}`} className="nb2-item-name">
            {item.ingredientName}
          </h4>
          <p className="nb2-item-why">
            {CLASSIFICATION_EXPLANATIONS[item.classification] ||
              "Suggested based on your Pantry and shopping needs."}
          </p>
          {confidenceClass && (
            <p className="nb2-item-source">
              {confidenceClass === "high"
                ? "Strong supporting information"
                : "Check before adding"}
            </p>
          )}
        </div>
        <div className="nb2-item-quantity">
          <span>Suggested amount</span>
          <strong className={hasExactQuantity ? "" : "nb2-quantity-unknown"}>
            {formatQuantity(item.proposedQuantity)}
          </strong>
        </div>
        <div className="nb2-item-actions">
          <div className="flex items-center gap-2 border-t border-[#D7DDCF] px-3 py-3 sm:px-4 sm:py-4">
            <button
              type="button"
              disabled={anyItemWorking}
              onClick={(event) => handleAddToCart(item, event.currentTarget)}
              aria-label={`Add ${item.ingredientName} to cart`}
              className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[9px] bg-[#173F35] px-2 text-[13px] font-semibold text-[#F7F6F2] transition-colors hover:bg-[#245D4E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56C42] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[14px]"
            >
              {itemAdding ? (
                <LoaderCircle
                  size={16}
                  className="shrink-0 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <ShoppingCart
                  size={16}
                  className="shrink-0"
                  aria-hidden="true"
                />
              )}
              <span>{itemAdding ? "Adding..." : "Add to cart"}</span>
            </button>
            <button
              type="button"
              disabled={anyItemWorking}
              onClick={() => feedback(item, "accept")}
              aria-label={`Accept suggestion for ${item.ingredientName}`}
              title="Save this suggestion without creating a cart"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-[9px] border border-[#CBD4C6] bg-white px-2.5 text-[13px] font-semibold text-[#173F35] transition-colors hover:bg-[#D7DDCF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56C42] focus-visible:ring-offset-2 disabled:opacity-50 sm:px-3"
            >
              {itemWorking ? (
                <LoaderCircle
                  size={15}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              Accept
            </button>
            <div
              ref={actionsOpen ? actionsRef : null}
              className="relative shrink-0"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setOpenActionsId((current) =>
                    current === actionKey ? "" : current
                  );
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
                aria-controls={
                  actionsOpen ? `next-basket-actions-${elementKey}` : undefined
                }
                onClick={(event) => toggleActions(event, actionKey)}
                className={`grid h-11 w-11 place-items-center rounded-[9px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56C42] focus-visible:ring-offset-2 disabled:opacity-50 ${
                  actionsOpen
                    ? "border-[#C56C42] bg-[#F2E2D8] text-[#173F35]"
                    : "border-[#CBD4C6] bg-white text-[#173F35] hover:border-[#C56C42] hover:bg-[#F2E2D8]"
                }`}
              >
                <MoreHorizontal size={19} aria-hidden="true" />
              </button>
              {actionsOpen && (
                <div
                  id={`next-basket-actions-${elementKey}`}
                  role="group"
                  aria-label={`More actions for ${item.ingredientName}`}
                  className={`absolute right-0 z-40 w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] p-1.5 shadow-[0_18px_35px_rgba(23,63,53,0.2)] ${
                    actionsPlacement === "above"
                      ? "bottom-full mb-2"
                      : "top-full mt-2"
                  }`}
                >
                  <p className="px-3 py-2 text-[12px] font-semibold text-[#173F35]">
                    Manage suggestion
                  </p>
                  {moreActions.map((action, actionIndex) => {
                    const ActionIcon = action.icon;
                    return (
                      <div
                        key={action.action}
                        className={
                          actionIndex === 3
                            ? "mt-1 border-t border-[#D7DDCF] pt-1"
                            : ""
                        }
                      >
                        <button
                          type="button"
                          disabled={anyItemWorking}
                          onClick={() =>
                            chooseFeedback(
                              item,
                              action.action,
                              action.action === "snooze"
                                ? {
                                    snoozeUntil: new Date(
                                      Date.now() + 7 * 86_400_000
                                    ).toISOString(),
                                  }
                                : {}
                            )
                          }
                          className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56C42] disabled:opacity-50 ${
                            action.action === "stop_suggesting"
                              ? "text-[#A2422B] hover:bg-[#F2E2D8]"
                              : "text-[#173F35] hover:bg-[#E9EDE5]"
                          }`}
                        >
                          <ActionIcon
                            size={16}
                            className="shrink-0"
                            aria-hidden="true"
                          />
                          {action.label}
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
    <main className="nb2-page" data-next-basket-page>
      <style>{`
        .nb2-page{--porcelain:#F7F6F2;--forest:#173F35;--charcoal:#202421;--sage:#D7DDCF;--clay:#C56C42;--quiet:#647168;--hair:rgba(23,63,53,.16);font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;background:var(--porcelain);color:var(--charcoal);min-width:0}
        .nb2-page *{box-sizing:border-box}
        .nb2-inner{width:100%;padding:22px clamp(16px,2.5vw,38px) 40px}
        .nb2-hero{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,.75fr);border:1px solid var(--hair);min-width:0;overflow:hidden;border-radius:5px 5px 20px 5px;box-shadow:0 16px 36px rgba(23,63,53,.07)}
        .nb2-hero-editorial{position:relative;background:var(--porcelain);padding:clamp(26px,4vw,58px);display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;min-width:0}
        .nb2-hero-editorial:before{content:'';position:absolute;top:0;left:0;right:0;height:6px;background:var(--clay)}
        .nb2-eyebrow{color:var(--forest);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:12px}
        .nb2-eyebrow:before{content:'';width:27px;height:2px;background:var(--clay)}
        .nb2-hero-title{font-size:clamp(36px,4.4vw,64px);line-height:1.08;letter-spacing:-.057em;font-weight:650;max-width:720px;margin:27px 0 0}
        .nb2-hero-title em{font-style:normal;color:var(--forest)}
        .nb2-hero-copy{margin:20px 0 0;max-width:565px;color:#48534B;font-size:16px;line-height:1.6}
        .nb2-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}
        .nb2-btn{min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:1px solid var(--forest);border-radius:8px;padding:10px 20px;font-size:14px;font-weight:650;text-decoration:none;transition:background-color .2s,color .2s,transform .2s}
        .nb2-btn:focus-visible,.nb2-toolbar button:focus-visible,.nb2-board a:focus-visible{outline:3px solid var(--clay);outline-offset:3px}
        .nb2-btn:hover{transform:translateY(-1px)}
        .nb2-btn-primary{background:var(--forest);color:var(--porcelain)}.nb2-btn-primary:hover{background:#255849;color:white}
        .nb2-btn-outline{background:transparent;color:var(--forest)}.nb2-btn-outline:hover{background:var(--sage)}
        .nb2-receipt{position:relative;min-width:0;background:var(--forest);color:var(--porcelain);padding:clamp(24px,3vw,44px);display:flex;flex-direction:column;justify-content:space-between}
        .nb2-receipt:after{content:'';position:absolute;inset:0 0 auto auto;width:45%;height:100%;pointer-events:none;opacity:.16;background:repeating-linear-gradient(90deg,transparent 0,transparent 30px,#D7DDCF 31px,transparent 32px)}
        .nb2-receipt > *{position:relative;z-index:1}
        .nb2-receipt-top{display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--sage);font-size:12px;font-weight:700;letter-spacing:.065em}
        .nb2-receipt-stat{margin-top:22px;display:flex;gap:16px;align-items:baseline;border-bottom:1px dashed rgba(247,246,242,.45);padding-bottom:20px}
        .nb2-receipt-stat strong{font-size:clamp(62px,6vw,90px);font-weight:650;line-height:1;letter-spacing:-.07em}
        .nb2-receipt-stat span{max-width:135px;font-size:15px;line-height:1.35;color:#E4EBDF}
        .nb2-receipt-list{display:grid;gap:11px;margin-top:22px}
        .nb2-receipt-line{display:flex;justify-content:space-between;gap:12px;min-width:0;font-size:14px}
        .nb2-receipt-line span:first-child{overflow-wrap:anywhere}
        .nb2-receipt-line span:last-child{color:var(--sage);flex-shrink:0}
        .nb2-receipt-footer{margin-top:25px;padding-top:15px;border-top:1px dashed rgba(247,246,242,.4);font-size:12px;line-height:1.6;color:var(--sage)}
        .nb2-path{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--hair);margin:25px 0 0;background:rgba(215,221,207,.38)}
        .nb2-path-step{min-width:0;padding:18px 20px;border-right:1px solid var(--hair)}.nb2-path-step:last-child{border-right:0}
        .nb2-path-num{color:var(--forest);font-size:12px;font-weight:700}.nb2-path-step strong{display:block;margin-top:5px;font-size:16px;font-weight:650;color:var(--forest)}
        .nb2-path-step p{margin:5px 0 0;font-size:13px;line-height:1.5;color:#59645B}
        .nb2-board{margin-top:28px;display:grid;grid-template-columns:minmax(220px,290px) minmax(0,1fr);align-items:start;gap:24px;min-width:0}
        .nb2-rail{min-width:0;padding:28px 24px 26px;background:var(--sage);border-left:5px solid var(--clay);position:sticky;top:92px}
        .nb2-rail h2{font-size:29px;line-height:1.14;font-weight:650;letter-spacing:-.035em;margin:13px 0 0;color:var(--forest)}
        .nb2-rail p{font-size:14px;line-height:1.6;color:#4D5B50;margin:14px 0 0}
        .nb2-rail-divider{height:1px;background:rgba(23,63,53,.22);margin:22px 0}
        .nb2-rail-count{display:flex;align-items:baseline;gap:10px}
        .nb2-rail-count strong{font-size:43px;line-height:1;color:var(--forest);font-weight:650}
        .nb2-rail-count span{font-size:13px;color:#415346}
        .nb2-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:19px}
        .nb2-toolbar button{font-size:13px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:9px 12px;border:1px solid rgba(23,63,53,.32);border-radius:7px;background:var(--porcelain);color:var(--forest)}
        .nb2-toolbar button:hover{background:white}
        .nb2-toolbar button:disabled{opacity:.55;cursor:default}
        .nb2-rail-link{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:11px 0;border-top:1px solid rgba(23,63,53,.18);color:var(--forest);font-weight:650;font-size:14px;text-decoration:none}
        .nb2-rail-link:hover{color:var(--clay)}
        .nb2-groups{min-width:0;display:grid;gap:24px}
        .nb2-group{min-width:0;position:relative;background:#fffefa;border:1px solid var(--hair);border-radius:2px 14px 14px 2px;box-shadow:0 9px 24px rgba(23,63,53,.05)}
        .nb2-group-header{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;flex-wrap:wrap;padding:25px 28px 21px;border-left:5px solid var(--clay);border-bottom:1px solid var(--hair)}
        .nb2-group-forest .nb2-group-header{border-left-color:var(--forest)}
        .nb2-group-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;color:var(--forest)}
        .nb2-group-forest .nb2-group-eyebrow{color:var(--forest)}
        .nb2-group-title{margin-top:6px;font-size:clamp(23px,2vw,30px);line-height:1.2;letter-spacing:-.035em;font-weight:650;color:var(--charcoal);overflow-wrap:anywhere}
        .nb2-group-badge{background:var(--sage);color:var(--forest);padding:8px 13px;border-radius:100px;font-size:13px;font-weight:650;white-space:nowrap}
        .nb2-item{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(160px,.35fr);gap:18px;padding:23px 25px 19px;align-items:start;position:relative;min-width:0;border-bottom:1px solid var(--hair);transition:background-color .2s}
        .nb2-item:last-child{border-bottom:0}.nb2-item:hover,.nb2-item:focus-within{background:#F2F3EB}
        .nb2-item.nb2-menu-active{z-index:12;background:#F2F3EB}
        .nb2-item-sequence{height:38px;width:38px;display:flex;justify-content:center;align-items:center;border-radius:50%;font-size:13px;font-weight:700;color:var(--forest);background:var(--sage)}
        .nb2-item-kind{font-size:12px;font-weight:650;color:var(--forest);line-height:1.45}
        .nb2-item-name{font-size:clamp(18px,2vw,23px);font-weight:650;color:var(--charcoal);line-height:1.2;letter-spacing:-.025em;margin:5px 0 0;overflow-wrap:anywhere}
        .nb2-item-why{font-size:14px;line-height:1.55;color:#576158;margin:9px 0 0;max-width:590px}
        .nb2-item-source{font-size:12px;color:var(--forest);font-weight:600;margin:7px 0 0}
        .nb2-item-quantity{min-width:0;background:rgba(215,221,207,.48);border-left:2px solid var(--sage);padding:12px 14px}
        .nb2-item-quantity span{display:block;font-size:12px;color:#506156;font-weight:600;margin-bottom:6px}
        .nb2-item-quantity strong{font-size:clamp(17px,1.8vw,21px);font-weight:650;line-height:1.25;color:var(--forest);overflow-wrap:anywhere}
        .nb2-item-quantity strong.nb2-quantity-unknown{font-size:14px;color:#8D5039}
        .nb2-item-actions{grid-column:2/-1;justify-self:start;width:min(100%,455px)}
        .nb2-item-actions>div{border:0!important;padding:0!important;gap:9px}
        .nb2-item-actions>div>button:first-child{min-width:142px}
        .nb2-group-footer{display:flex;justify-content:flex-end;padding:15px 24px 19px;background:rgba(215,221,207,.25)}
        .nb2-group-footer button{min-height:42px;padding:9px 16px;border:1px solid var(--forest);border-radius:7px;background:var(--forest);color:var(--porcelain);font-size:13px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;gap:9px}
        .nb2-group-footer button:hover{background:#255849}.nb2-footer-mobile-only{display:flex}
        .nb2-loading{padding:28px;display:grid;gap:14px}.nb2-loading div{height:70px;background:var(--sage);opacity:.65;animation:nb2pulse 1.6s ease-in-out infinite alternate;border-radius:6px}@keyframes nb2pulse{to{opacity:.28}}
        .nb2-empty{padding:55px 20px;text-align:center}.nb2-empty h3{font-size:23px;font-weight:650;color:var(--forest)}.nb2-empty p{max-width:440px;margin:11px auto 0;color:#58665B;font-size:14px;line-height:1.65}
        .nb2-finish{margin-top:28px;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;border-radius:14px;background:var(--forest);color:var(--porcelain)}
        .nb2-finish>div{padding:28px clamp(22px,3vw,40px)}.nb2-finish h2{font-size:clamp(22px,2.4vw,31px);line-height:1.2;font-weight:650;letter-spacing:-.025em;margin-top:8px}.nb2-finish p{font-size:14px;line-height:1.6;color:#E4E9E0;margin-top:12px;max-width:580px}
        .nb2-finish-links{background:var(--sage);display:flex;flex-direction:column;justify-content:center;gap:1px;box-shadow:inset 5px 0 0 var(--clay)}
        .nb2-finish-links a{display:flex;min-height:49px;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(23,63,53,.25);color:var(--forest);font-size:15px;font-weight:650;text-decoration:none}
        .nb2-finish-links a:last-child{border-bottom:0}.nb2-finish-links a:hover{text-decoration:underline}
        .nb2-modal-overlay{position:fixed;inset:0;z-index:100;display:flex;justify-content:center;align-items:center;padding:16px;background:rgba(32,36,33,.62);backdrop-filter:blur(7px)}
        .nb2-modal{width:100%;max-width:1000px;max-height:87dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:var(--porcelain);box-shadow:0 24px 80px rgba(0,0,0,.24)}
        .nb2-modal-header{padding:22px 25px;display:flex;justify-content:space-between;gap:20px;align-items:flex-start;background:var(--forest);color:var(--porcelain)}
        .nb2-modal-header h2{font-size:26px;font-weight:650;line-height:1.25;margin-top:5px}
        .nb2-modal-header p{font-size:13px;margin-top:5px;color:var(--sage)}
        .nb2-modal-close{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;background:var(--porcelain);color:var(--forest);border:0;border-radius:50%;cursor:pointer}
        .nb2-modal-content{overflow-y:auto;min-height:0;overscroll-behavior:auto}
        @media(max-width:1100px){.nb2-board{grid-template-columns:220px minmax(0,1fr);gap:18px}.nb2-item{grid-template-columns:36px minmax(0,1fr);gap:13px}.nb2-item-quantity{grid-column:2}.nb2-item-actions{grid-column:2}.nb2-hero{grid-template-columns:minmax(0,1.3fr) minmax(260px,.8fr)}}
        @media(max-width:800px){.nb2-hero{grid-template-columns:1fr}.nb2-receipt{padding:24px}.nb2-receipt-stat strong{font-size:64px}.nb2-board{grid-template-columns:1fr}.nb2-rail{position:static;display:grid;grid-template-columns:1fr auto;column-gap:24px;padding:24px}.nb2-rail h2{font-size:24px}.nb2-rail p{grid-column:1/-1}.nb2-rail-divider{grid-column:1/-1;margin:12px 0}.nb2-rail-count{grid-column:2;grid-row:1/3;align-self:center}.nb2-toolbar,.nb2-rail-link{grid-column:1/-1}.nb2-path{grid-template-columns:repeat(2,minmax(0,1fr))}.nb2-path-step:nth-child(2){border-right:0}.nb2-path-step:nth-child(-n+2){border-bottom:1px solid var(--hair)}}
        @media(max-width:580px){.nb2-inner{padding:10px 10px 28px}.nb2-hero{border-radius:5px 5px 14px 5px}.nb2-hero-editorial{padding:25px 20px}.nb2-eyebrow{font-size:11px}.nb2-hero-title{font-size:36px;margin-top:18px}.nb2-hero-copy{font-size:14px;margin-top:13px}.nb2-hero-actions{margin-top:21px}.nb2-btn{font-size:13px;padding:9px 14px;min-height:43px}.nb2-receipt{padding:20px}.nb2-receipt-stat{margin-top:10px;padding-bottom:12px}.nb2-receipt-stat strong{font-size:53px}.nb2-receipt-list{grid-template-columns:1fr 1fr;margin-top:14px;gap:10px}.nb2-receipt-footer{margin-top:15px}.nb2-path{margin-top:15px}.nb2-path-step{padding:13px}.nb2-path-step strong{font-size:14px}.nb2-path-step p{font-size:12px}.nb2-board{margin-top:16px;gap:17px}.nb2-rail{padding:19px 17px}.nb2-rail h2{font-size:23px}.nb2-rail-count strong{font-size:34px}.nb2-group-header{padding:19px 16px 16px}.nb2-group-title{font-size:23px}.nb2-item{padding:19px 14px 16px;grid-template-columns:33px minmax(0,1fr);column-gap:11px;row-gap:11px}.nb2-item-sequence{height:33px;width:33px;font-size:12px}.nb2-item-kind{font-size:11px}.nb2-item-name{font-size:19px}.nb2-item-why{font-size:13px}.nb2-item-quantity{padding:9px 12px}.nb2-item-actions{width:100%;grid-column:1/-1}.nb2-item-actions>div{gap:6px}.nb2-item-actions>div>button:first-child{min-width:0}.nb2-group-footer{padding:13px}.nb2-finish{margin-top:18px;grid-template-columns:1fr}.nb2-finish>div{padding:23px}.nb2-modal-overlay{padding:10px}.nb2-modal{max-height:86dvh}.nb2-modal-header{padding:18px}.nb2-modal-header h2{font-size:23px}}
        .nb2-mobile-copy{display:none}
        /* Mobile-only: occupy the Customer workspace width without clipping controls. */
        @media(max-width:580px){
          .nb2-page{width:calc(100% + 14px);max-width:none;margin-inline:-7px;min-width:0;overflow-x:clip}
          .nb2-inner{padding:4px 5px 17px;width:100%;min-width:0}
          .nb2-page :is(.nb2-hero,.nb2-board,.nb2-group,.nb2-receipt,.nb2-rail,.nb2-finish){min-width:0;max-width:100%}
          .nb2-mobile-copy{display:inline}
          .nb2-desktop-copy{display:none}
          .nb2-hero{border-radius:5px 5px 9px 5px;box-shadow:none}
          .nb2-hero-editorial{padding:18px 13px 14px;gap:0}
          .nb2-hero-title{font-size:clamp(28px,8.3vw,34px);margin-top:10px;line-height:1.13;letter-spacing:-.045em}
          .nb2-eyebrow{font-size:11px;letter-spacing:.045em;gap:7px}
          .nb2-eyebrow:before{width:17px}
          .nb2-hero-copy{font-size:13px;line-height:1.4;margin-top:8px}
          .nb2-hero-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%;margin-top:13px}
          .nb2-hero-actions .nb2-btn{width:100%;min-width:0;min-height:42px;padding:8px 4px;gap:4px;white-space:nowrap;font-size:clamp(11px,3.15vw,13px)}
          .nb2-hero-actions .nb2-btn svg{width:14px;height:14px;flex-shrink:0}
          .nb2-receipt{padding:11px 13px 12px}
          .nb2-receipt-top{font-size:10px;letter-spacing:.04em}
          .nb2-receipt-top svg{width:15px;height:15px}
          .nb2-receipt-stat{margin-top:6px;padding-bottom:8px;gap:9px}
          .nb2-receipt-stat strong{font-size:33px}
          .nb2-receipt-stat span{max-width:none;font-size:12px;line-height:1.3}
          .nb2-receipt-list{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:9px;gap:5px}
          .nb2-receipt-line{display:flex;flex-direction:column;gap:3px;font-size:11px;line-height:1.3;min-width:0}
          .nb2-receipt-line span:last-child{font-weight:700;white-space:normal}
          .nb2-receipt-footer{display:none}
          .nb2-path{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:8px}
          .nb2-path-step{padding:9px 4px 10px;border-bottom:0!important;border-right:1px solid var(--hair)!important;text-align:center}
          .nb2-path-step:last-child{border-right:0!important}
          .nb2-path-num{font-size:11px}
          .nb2-path-step strong{margin-top:2px;font-size:12px;line-height:1.2}
          .nb2-path-step p{display:none}
          .nb2-board{margin-top:10px;gap:9px;grid-template-columns:minmax(0,1fr)}
          .nb2-rail{padding:12px 12px 11px;grid-template-columns:minmax(0,1fr) auto;column-gap:10px;row-gap:8px;border-left-width:3px}
          .nb2-rail .nb2-eyebrow{font-size:10px}
          .nb2-rail h2{font-size:21px;margin:4px 0 0;line-height:1.18}
          .nb2-rail > p{display:none}
          .nb2-rail-count{grid-row:1;grid-column:2;align-items:center;gap:5px;white-space:nowrap}
          .nb2-rail-count strong{font-size:27px}
          .nb2-rail-count span{font-size:11px}
          .nb2-rail-divider{display:none}
          .nb2-toolbar{grid-column:1/-1;grid-row:2;margin-top:0;gap:7px;flex-wrap:nowrap}
          .nb2-toolbar button{min-height:40px;padding:7px 11px;font-size:12px;flex:1;min-width:0}
          .nb2-rail-link{grid-row:3;grid-column:auto;min-height:36px;padding:6px 1px;font-size:12px;line-height:1.25;min-width:0}
          .nb2-rail-link svg{width:14px;height:14px;flex-shrink:0}
          .nb2-groups{gap:10px}
          .nb2-group{border-radius:3px 9px 9px 3px;box-shadow:none}
          .nb2-group-header{padding:12px 10px 11px;gap:7px;align-items:center}
          .nb2-group-eyebrow{font-size:10px;letter-spacing:.045em}
          .nb2-group-title{margin-top:3px;font-size:21px;line-height:1.2}
          .nb2-group-badge{padding:5px 7px;font-size:11px}
          .nb2-item{grid-template-columns:minmax(0,1fr) minmax(85px,32%);gap:7px 8px;padding:12px 10px}
          .nb2-item-sequence{display:none}
          .nb2-item-description{grid-column:1;min-width:0}
          .nb2-item-kind{font-size:11px;line-height:1.25}
          .nb2-item-name{font-size:17px;line-height:1.2;margin-top:3px}
          .nb2-item-why{font-size:12px;line-height:1.35;margin-top:5px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden}
          .nb2-item-source{font-size:11px;margin-top:3px}
          .nb2-item-quantity{grid-column:2;grid-row:1;min-width:0;padding:7px 7px;align-self:start}
          .nb2-item-quantity span{font-size:10px;line-height:1.2;margin-bottom:3px}
          .nb2-item-quantity strong,.nb2-item-quantity strong.nb2-quantity-unknown{font-size:13px;line-height:1.25;overflow-wrap:break-word}
          .nb2-item-actions{grid-column:1/-1;min-width:0;width:100%;margin-top:2px}
          .nb2-item-actions>div{gap:5px}
          .nb2-item-actions>div>button{font-size:12px;min-height:44px}
          .nb2-item-actions>div>button:first-child{min-width:0}
          .nb2-item-actions>div>div{min-width:0}
          .nb2-group-footer{padding:8px 10px 10px}
          .nb2-group-footer button{min-height:40px;font-size:12px;padding:7px 11px}
          .nb2-loading{padding:13px;gap:7px}
          .nb2-loading div{height:50px}
          .nb2-empty{padding:25px 13px}
          .nb2-finish{margin-top:10px;border-radius:8px}
          .nb2-finish>div{padding:14px 13px}
          .nb2-finish h2{font-size:21px;line-height:1.2;margin-top:5px}
          .nb2-finish p{margin-top:6px;font-size:12px;line-height:1.45}
          .nb2-finish-links{box-shadow:inset 3px 0 0 var(--clay)}
          .nb2-finish-links a{min-height:40px;font-size:13px;padding:7px 0}
          .nb2-modal-overlay{padding:8px}
          .nb2-modal{max-height:79dvh;border-radius:10px}
          .nb2-modal-header{padding:12px 13px}
          .nb2-modal-header h2{font-size:20px}
          .nb2-modal-content{overscroll-behavior:auto}
        }
        @media(min-width:581px){.nb2-mobile-hidden{display:grid!important}}
        @media(min-width:640px){.nb2-footer-mobile-only{display:none!important}}
        @media(max-width:580px){.nb2-mobile-hidden{display:none!important}}
        @media(prefers-reduced-motion:reduce){.nb2-page *, .nb2-page *:before, .nb2-page *:after{scroll-behavior:auto!important;animation-duration:.001ms!important;transition-duration:.001ms!important}}
      `}</style>
      <div className="nb2-inner">
        <header className="nb2-hero">
          <div className="nb2-hero-editorial">
            <div>
              <p className="nb2-eyebrow">A better way to shop</p>
              <h1 className="nb2-hero-title">
                Your next basket, <em>thoughtfully planned.</em>
              </h1>
              <p className="nb2-hero-copy">
                <span className="nb2-desktop-copy">
                  Made from your planned meals and Pantry needs. Review the
                  list, then choose what belongs in your cart.
                </span>
                <span className="nb2-mobile-copy">
                  Your meal plans and Pantry, ready to shop.
                </span>
              </p>
            </div>
            <div className="nb2-hero-actions">
              <a
                className="nb2-btn nb2-btn-primary"
                href="#next-basket-suggestions"
              >
                Explore your list <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <Link className="nb2-btn nb2-btn-outline" to="/meal-plan">
                View meal plan <CalendarDays size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <aside className="nb2-receipt" aria-label="Shopping overview">
            <div>
              <div className="nb2-receipt-top">
                <span>YOUR SHOPPING NOTE</span>
                <ShoppingCart size={19} aria-hidden="true" />
              </div>
              <div className="nb2-receipt-stat">
                <strong>{data ? itemCount : "—"}</strong>
                <span>
                  {itemCount === 1 ? "item suggested" : "items suggested"} for
                  your next shop
                </span>
              </div>
              <div className="nb2-receipt-list">
                <div className="nb2-receipt-line">
                  <span>From meal plans</span>
                  <span>
                    {mealPlanGroups.length}{" "}
                    {mealPlanGroups.length === 1 ? "plan" : "plans"}
                  </span>
                </div>
                <div className="nb2-receipt-line">
                  <span>Other needs</span>
                  <span>
                    {otherItems.length}{" "}
                    {otherItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="nb2-receipt-line">
                  <span>Suggestions</span>
                  <span>{recommendationsEnabled ? "On" : "Paused"}</span>
                </div>
              </div>
            </div>
            <p className="nb2-receipt-footer">
              Nothing is purchased automatically. You choose what to accept or
              add to cart.
            </p>
          </aside>
        </header>

        <SponsoredCampaignSlot
          placement="pantry_replenishment"
          slotKey="pantry_header"
          embedded
        />

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 border-l-4 border-[#C56C42] bg-[#F3E2D8] p-4 text-[14px] text-[#7C361F]"
          >
            <TriangleAlert className="shrink-0" size={19} aria-hidden="true" />
            {error}
          </div>
        )}

        <section className="nb2-path" aria-label="How Next Basket works">
          {[
            ["01", "Plan", "Choose what you intend to cook."],
            ["02", "Check", "Compare with your Pantry."],
            ["03", "Review", "Check suggested amounts."],
            ["04", "Decide", "Accept or add to cart."],
          ].map(([number, title, body]) => (
            <div key={number} className="nb2-path-step">
              <span className="nb2-path-num">{number}</span>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          ))}
        </section>
        <SponsoredCampaignSlot
          placement="pantry_replenishment"
          slotKey="pantry_steps"
          embedded
        />

        <div
          id="next-basket-suggestions"
          className="nb2-board"
          aria-label="Shopping suggestions"
        >
          <aside className="nb2-rail">
            <div>
              <p className="nb2-eyebrow">Your shopping workspace</p>
              <h2>Your basket, your call.</h2>
            </div>
            <div className="nb2-rail-count">
              <strong>{data ? itemCount : "—"}</strong>
              <span>suggestions</span>
            </div>
            <p>
              Suggestions come from saved information. Check amounts before
              shopping.
            </p>
            <div className="nb2-rail-divider" />
            <div className="nb2-toolbar">
              <button
                type="button"
                onClick={toggleRecommendations}
                aria-label={
                  recommendationsEnabled
                    ? "Pause shopping suggestions"
                    : "Resume shopping suggestions"
                }
              >
                {recommendationsEnabled ? (
                  <PauseCircle size={17} aria-hidden="true" />
                ) : (
                  <Play size={17} aria-hidden="true" />
                )}{" "}
                {recommendationsEnabled ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                aria-label="Refresh Next Basket"
              >
                <RefreshCw
                  size={16}
                  className={
                    loading ? "animate-spin motion-reduce:animate-none" : ""
                  }
                  aria-hidden="true"
                />{" "}
                Refresh
              </button>
            </div>
            <div className="nb2-rail-divider" />
            <Link to="/pantry" className="nb2-rail-link">
              Review Pantry <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/meal-plan" className="nb2-rail-link">
              Update meal plan <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </aside>

          <div className="nb2-groups">
            <p className="sr-only" role="status" aria-live="polite">
              {loading
                ? "Updating shopping suggestions."
                : `${itemCount} suggestions available.`}
            </p>
            <SponsoredCampaignSlot
              placement="pantry_replenishment"
              slotKey="pantry_suggestions"
              embedded
            />

            {loading && !data && (
              <div
                className="nb2-group nb2-loading"
                aria-label="Loading shopping suggestions"
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} aria-hidden="true" />
                ))}
              </div>
            )}

            {!loading && !error && itemCount === 0 && (
              <section className="nb2-group nb2-empty">
                <CheckCircle2
                  size={30}
                  className="mx-auto text-[#173F35]"
                  aria-hidden="true"
                />
                <h3>
                  {recommendationsEnabled
                    ? "Nothing to add right now"
                    : "Suggestions are paused"}
                </h3>
                <p>
                  {recommendationsEnabled
                    ? "If your meal plans or Pantry suggest something to replenish, it will appear here."
                    : "Resume suggestions whenever you're ready. Your saved plans stay unchanged."}
                </p>
              </section>
            )}

            {!loading &&
              mealPlanGroups.map((mealPlan) => {
                const visibleItems = mealPlan.items.slice(0, 6);
                return (
                  <section
                    key={mealPlan.id}
                    className="nb2-group"
                    aria-labelledby={`meal-plan-suggestions-${mealPlan.id}`}
                  >
                    <div className="nb2-group-header">
                      <div>
                        <p className="nb2-group-eyebrow">From your meal plan</p>
                        <h3
                          id={`meal-plan-suggestions-${mealPlan.id}`}
                          className="nb2-group-title"
                        >
                          {mealPlan.title || "Meal plan"}
                        </h3>
                      </div>
                      <span className="nb2-group-badge">
                        {mealPlan.items.length}{" "}
                        {mealPlan.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <div>
                      {visibleItems.map((item, index) =>
                        renderSuggestionCard(
                          item,
                          index,
                          `meal-plan-${mealPlan.id}`,
                          index >= 3
                        )
                      )}
                    </div>
                    {mealPlan.items.length > 3 && (
                      <div
                        className={`nb2-group-footer ${
                          mealPlan.items.length <= 6
                            ? "nb2-footer-mobile-only"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionsId("");
                            setOpenMealPlanId(mealPlan.id);
                          }}
                        >
                          View all {mealPlan.items.length} items{" "}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}

            {!loading && otherItems.length > 0 && (
              <section
                className="nb2-group nb2-group-forest"
                aria-labelledby="other-next-basket-suggestions"
              >
                <div className="nb2-group-header">
                  <div>
                    <p className="nb2-group-eyebrow">Your other needs</p>
                    <h3
                      className="nb2-group-title"
                      id="other-next-basket-suggestions"
                    >
                      From your Pantry
                    </h3>
                  </div>
                  <span className="nb2-group-badge">
                    {otherItems.length}{" "}
                    {otherItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div>
                  {otherItems.map((item, index) =>
                    renderSuggestionCard(
                      item,
                      index,
                      "other-suggestions",
                      index >= 3 && !showAllOtherItems
                    )
                  )}
                </div>
                {otherItems.length > 3 && (
                  <div className="nb2-group-footer nb2-footer-mobile-only">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenActionsId("");
                        setShowAllOtherItems((current) => !current);
                      }}
                    >
                      {showAllOtherItems
                        ? "Show fewer"
                        : `View all ${otherItems.length} items`}{" "}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>

        {openMealPlan && (
          <div
            className="nb2-modal-overlay"
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
            <div className="nb2-modal">
              <div className="nb2-modal-header">
                <div>
                  <p className="text-[12px] font-semibold tracking-wider text-[#D7DDCF]">
                    ALL MEAL PLAN ITEMS
                  </p>
                  <h2 id="next-basket-meal-plan-dialog-title">
                    {openMealPlan.title || "Meal plan"}
                  </h2>
                  <p>{openMealPlan.items.length} shopping suggestions</p>
                </div>
                <button
                  type="button"
                  className="nb2-modal-close"
                  onClick={() => {
                    setOpenActionsId("");
                    setOpenMealPlanId("");
                  }}
                  aria-label="Close meal plan items"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="nb2-modal-content">
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
        )}

        <section className="nb2-finish" aria-labelledby="nb2-finish-title">
          <div>
            <p className="text-[12px] font-bold tracking-[.08em] text-[#D7DDCF]">
              BEFORE YOU SHOP
            </p>
            <h2 id="nb2-finish-title">Use what you have. Buy what you need.</h2>
            <p>
              <span className="nb2-desktop-copy">
                Shopping suggestions do not change your Pantry, meal plans or
                orders automatically. Add items to cart to check current seller
                offers.
              </span>
              <span className="nb2-mobile-copy">
                You choose what goes in your cart. Nothing is ordered
                automatically.
              </span>
            </p>
          </div>
          <div className="nb2-finish-links">
            <Link to="/pantry">
              Check my Pantry <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/meal-plan">
              Review meal plans <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
