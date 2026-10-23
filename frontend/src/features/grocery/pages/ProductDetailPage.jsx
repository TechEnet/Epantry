import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Factory,
  Globe2,
  Images,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
  ZoomIn,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useParams } from "react-router-dom";

import EmptyState from "../../../components/common/EmptyState";

import {
  createCommerceIdempotencyKey,
  createDirectMarketplaceCart,
  getCommerceErrorMessage,
  updateDirectMarketplaceCartItem,
} from "../../commerce/services/commerce.service";

import { getPublicPackOffers } from "../../marketplace/services/marketplace.service";

import useProductDetail from "../hooks/useProductDetail";

import { useCurrentLocation } from "../../location/hooks/useCurrentLocation";
import { useLocationStore } from "../../location/store/location.store";

import {
  getCatalogCategoryProducts,
  getCatalogProducts,
} from "../services/catalog.service";

import { listPublicRecipes } from "../../recipes/services/recipe.service";

import { openAvailabilityNotifyModal } from "../../notifications/components/AvailabilityNotifyModal";

import SponsoredCampaignSlot from "../../retailMedia/components/SponsoredCampaignSlot";

function formatQuantity(quantity) {
  if (!quantity || quantity.value === undefined || quantity.value === null) {
    return "Not declared";
  }

  return `${quantity.value} ${quantity.unit || ""}`.trim();
}

const CODE128_PATTERNS = [
  "212222",
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312",
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231",
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123",
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113",
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131",
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111",
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412",
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242",
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121",
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131",
  "311141",
  "411131",
  "211412",
  "211214",
  "211232",
  "2331112",
];

function normalizeBarcodeValue(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}

function buildCode128Bars(value) {
  const digits = normalizeBarcodeValue(value);

  if (!digits) {
    return null;
  }

  const startCode = 104;
  const values = Array.from(digits).map(
    (character) => character.charCodeAt(0) - 32
  );

  const checksum =
    (startCode +
      values.reduce((sum, code, index) => sum + code * (index + 1), 0)) %
    103;

  const encodedValues = [startCode, ...values, checksum, 106];

  const quietZone = 10;
  let x = quietZone;
  const bars = [];

  encodedValues.forEach((code) => {
    const pattern = CODE128_PATTERNS[code];

    if (!pattern) {
      return;
    }

    Array.from(pattern).forEach((moduleWidth, index) => {
      const width = Number(moduleWidth);

      if (index % 2 === 0) {
        bars.push({
          x,
          width,
        });
      }

      x += width;
    });
  });

  return {
    digits,
    bars,
    width: x + quietZone,
  };
}

function ProductBarcode({ value, compact = false }) {
  const barcode = buildCode128Bars(value);

  if (!barcode) {
    return (
      <span className="text-xs font-bold text-stone-500">Not declared</span>
    );
  }

  const barHeight = compact ? 42 : 56;

  const textY = barHeight + 15;

  return (
    <div className="w-full max-w-[320px]">
      <svg
        viewBox={`0 0 ${barcode.width} ${barHeight + 22}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Barcode ${barcode.digits}`}
        preserveAspectRatio="xMinYMid meet"
        shapeRendering="crispEdges"
      >
        <rect width={barcode.width} height={barHeight + 22} fill="white" />

        {barcode.bars.map((bar, index) => (
          <rect
            key={`${bar.x}-${index}`}
            x={bar.x}
            y="2"
            width={bar.width}
            height={barHeight}
            fill="#111827"
          />
        ))}

        <text
          x={barcode.width / 2}
          y={textY}
          textAnchor="middle"
          fontSize={compact ? 8 : 10}
          fontWeight="700"
          letterSpacing="1.4"
          fill="#292524"
        >
          {barcode.digits}
        </text>
      </svg>
    </div>
  );
}

const COUNTRY_META = {
  india: { code: "IN", cuisine: "Indian" },
  japan: { code: "JP", cuisine: "Japanese" },
  china: { code: "CN", cuisine: "Chinese" },
  italy: { code: "IT", cuisine: "Italian" },
  mexico: { code: "MX", cuisine: "Mexican" },
  thailand: { code: "TH", cuisine: "Thai" },
  france: { code: "FR", cuisine: "French" },
  spain: { code: "ES", cuisine: "Spanish" },
  greece: { code: "GR", cuisine: "Greek" },
  turkey: { code: "TR", cuisine: "Turkish" },
  vietnam: { code: "VN", cuisine: "Vietnamese" },
  indonesia: { code: "ID", cuisine: "Indonesian" },
  malaysia: { code: "MY", cuisine: "Malaysian" },
  singapore: { code: "SG", cuisine: "Singaporean" },
  "south korea": { code: "KR", cuisine: "Korean" },
  korea: { code: "KR", cuisine: "Korean" },
  "united states": { code: "US", cuisine: "American" },
  "united states of america": { code: "US", cuisine: "American" },
  usa: { code: "US", cuisine: "American" },
  canada: { code: "CA", cuisine: "Canadian" },
  brazil: { code: "BR", cuisine: "Brazilian" },
  argentina: { code: "AR", cuisine: "Argentinian" },
  peru: { code: "PE", cuisine: "Peruvian" },
  australia: { code: "AU", cuisine: "Australian" },
  "new zealand": { code: "NZ", cuisine: "New Zealand" },
  germany: { code: "DE", cuisine: "German" },
  portugal: { code: "PT", cuisine: "Portuguese" },
  netherlands: { code: "NL", cuisine: "Dutch" },
  belgium: { code: "BE", cuisine: "Belgian" },
  switzerland: { code: "CH", cuisine: "Swiss" },
  austria: { code: "AT", cuisine: "Austrian" },
  ireland: { code: "IE", cuisine: "Irish" },
  "united kingdom": { code: "GB", cuisine: "British" },
  uk: { code: "GB", cuisine: "British" },
  egypt: { code: "EG", cuisine: "Egyptian" },
  morocco: { code: "MA", cuisine: "Moroccan" },
  lebanon: { code: "LB", cuisine: "Lebanese" },
  israel: { code: "IL", cuisine: "Israeli" },
  "saudi arabia": { code: "SA", cuisine: "Saudi Arabian" },
  "united arab emirates": { code: "AE", cuisine: "Emirati" },
  uae: { code: "AE", cuisine: "Emirati" },
  pakistan: { code: "PK", cuisine: "Pakistani" },
  bangladesh: { code: "BD", cuisine: "Bangladeshi" },
  "sri lanka": { code: "LK", cuisine: "Sri Lankan" },
  nepal: { code: "NP", cuisine: "Nepalese" },
};

function normalizeCountryKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ISO_ALPHA2_CODES =
  `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(
    " "
  );

function findCountryCodeByDisplayName(value) {
  const key = normalizeCountryKey(value);

  if (
    !key ||
    typeof Intl === "undefined" ||
    typeof Intl.DisplayNames !== "function"
  ) {
    return "";
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

    return (
      ISO_ALPHA2_CODES.find(
        (code) => normalizeCountryKey(displayNames.of(code)) === key
      ) || ""
    );
  } catch {
    return "";
  }
}

function resolveCountryMeta(value) {
  const raw = String(value || "").trim();
  const key = normalizeCountryKey(raw);

  if (!raw) {
    return {
      name: "",
      code: "",
      cuisine: "",
      flag: "🌍",
    };
  }

  const directCode = /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : "";

  const known = COUNTRY_META[key] || null;

  const code =
    directCode || known?.code || findCountryCodeByDisplayName(raw) || "";

  const flag =
    code.length === 2
      ? String.fromCodePoint(
          ...Array.from(code).map(
            (character) => 127397 + character.charCodeAt(0)
          )
        )
      : "🌍";

  return {
    name: raw,
    code,
    cuisine: known?.cuisine || "",
    flag,
  };
}

function countryDescription(countryName) {
  const country = String(countryName || "").trim();

  if (!country) {
    return [];
  }

  return [
    `${country} has its own regional food traditions, ingredients, and production practices.`,
    `Foods grown, prepared, or packed there can vary significantly by region and producer.`,
    `EPANTRY shows the published country-of-origin record and connects other listings from the same country when they are available.`,
  ];
}

function recipeCountryCuisine(item) {
  return String(item?.dish?.cuisine || item?.recipe?.cuisine || "").trim();
}

function getCountryRecipeName(item) {
  return item?.dish?.name || item?.recipe?.title || "Recipe";
}

function getCountryRecipePath(item) {
  return (
    item?.path ||
    `/recipes/${encodeURIComponent(
      item?.dish?.slug || item?.recipe?.slug || ""
    )}`
  );
}

function getCountryRecipeImage(item) {
  return item?.dish?.heroImageUrl || item?.recipe?.heroImageUrl || "";
}

const FLOATING_MARKETPLACE_CART_KEY = "epantry-floating-marketplace-cart";

function readFloatingMarketplaceCart() {
  try {
    const raw = window.sessionStorage.getItem(FLOATING_MARKETPLACE_CART_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed?.cartId || !Array.isArray(parsed?.items)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function mapMarketplaceCartItems(result) {
  return (Array.isArray(result?.items) ? result.items : []).map((item) => ({
    id: item.id || item.packId || item.displayName,
    packId: item.packId || "",
    offerId: item.offerId || "",
    organizationId: item.organizationId || "",
    sellerName: item.sellerName || "Marketplace Host",
    name: item.displayName || "Product",
    quantity: Number(item.packCount || 1),
  }));
}

function saveFloatingMarketplaceCart({
  cartId,
  items,
  pincode = "",
  fulfillmentType = "delivery",
}) {
  try {
    window.sessionStorage.setItem(
      FLOATING_MARKETPLACE_CART_KEY,
      JSON.stringify({
        cartId,
        items,
        pincode: String(pincode || "").trim(),
        fulfillmentType: fulfillmentType || "delivery",
        updatedAt: new Date().toISOString(),
      })
    );

    window.sessionStorage.removeItem("epantry-floating-cart-hidden");
  } catch {
    // Session persistence is best-effort UX state only.
  }

  window.dispatchEvent(
    new CustomEvent("epantry-cart-updated", {
      detail: {
        show: true,
      },
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

function formatMoney(amountMinor, currency = "INR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",

    currency,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

function DetailCard({
  title,
  children,
  accent = false,
  description = "",
  icon: Icon = null,
}) {
  return (
    <details className="group border-b border-[#C8D5D2] last:border-b-0">
      <summary className="focus-ring flex min-h-[82px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-[#F5F9F8] sm:py-5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-[#C9D7D4] bg-[#E3F0ED] text-[#174E49]">
            {Icon ? <Icon size={19} strokeWidth={1.8} aria-hidden="true" /> : <ShieldCheck size={19} strokeWidth={1.8} aria-hidden="true" />}
          </span>
          <span className="min-w-0">
            <span className={`block text-[17px] font-semibold tracking-[-0.015em] sm:text-lg ${accent ? "text-[#173F35]" : "text-[#202421]"}`}>
              {title}
            </span>
            {description && <span className="mt-1 block text-sm leading-5 text-[#66736F]">{description}</span>}
          </span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#C8D5D2] bg-white text-[#174E49] transition-colors group-open:bg-[#174E49] group-open:text-white">
          <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="min-w-0 pb-7 pl-0 pt-2 text-[15px] leading-7 text-[#343B36] sm:pb-8 sm:pl-[60px]">
        {children}
      </div>
    </details>
  );
}

function MarketplaceOffers({ product, onOffersResolved }) {
  const currentLocation = useLocationStore((state) => state.currentLocation);
  const { requestCurrentLocation, status: locationStatus } = useCurrentLocation();
  // Only a complete Indian PIN is safe for an availability lookup. Never use
  // an approximate city name or partial postcode as proof of delivery.
  const detectedPincode = String(currentLocation?.postcode || "")
    .replace(/\s/g, "")
    .match(/^\d{6}$/)?.[0] || "";
  const [manualPincode, setManualPincode] = useState(null);
  const [manualDraft, setManualDraft] = useState("");
  const [manualEditorOpen, setManualEditorOpen] = useState(false);
  const [pinEntryError, setPinEntryError] = useState("");
  const pincode = manualPincode === null ? detectedPincode : manualPincode;
  const isLocationApproximate =
    currentLocation?.source === "network" || currentLocation?.accuracyMode === "approximate";

  const [offers, setOffers] = useState([]);

  const [loading, setLoading] = useState(false);

  const [checked, setChecked] = useState(false);
  const [checkedPincode, setCheckedPincode] = useState("");

  const [error, setError] = useState(null);

  const [addingOfferId, setAddingOfferId] = useState("");

  const [quantityByOfferId, setQuantityByOfferId] = useState({});

  function getOfferQuantityBounds(offer) {
    const minimum = Math.max(1, Number(offer?.minimumOrderQuantity || 1));

    const providerMaximum =
      offer?.maximumOrderQuantity === null ||
      offer?.maximumOrderQuantity === undefined
        ? 100000
        : Number(offer.maximumOrderQuantity);

    const maximum = Math.max(
      minimum,
      Number.isFinite(providerMaximum) ? Math.floor(providerMaximum) : 100000
    );

    return {
      minimum,
      maximum,
    };
  }

  function getOfferQuantity(offer) {
    const { minimum, maximum } = getOfferQuantityBounds(offer);

    const current = Number(quantityByOfferId[offer?.id]);

    if (!Number.isInteger(current)) {
      return minimum;
    }

    return Math.min(maximum, Math.max(minimum, current));
  }

  function setOfferQuantity(offer, nextQuantity) {
    const offerId = offer?.id;

    if (!offerId) {
      return;
    }

    const { minimum, maximum } = getOfferQuantityBounds(offer);

    const parsed = Number(nextQuantity);

    const normalized = Number.isFinite(parsed)
      ? Math.min(maximum, Math.max(minimum, Math.floor(parsed)))
      : minimum;

    setQuantityByOfferId((current) => ({
      ...current,
      [offerId]: normalized,
    }));

    return normalized;
  }

  const packId = useMemo(
    () =>
      product?.pack?.id ||
      product?.pack?._id ||
      product?.packId ||
      product?.canonicalPackId ||
      null,
    [product]
  );

  async function syncExistingCartQuantity(offer, nextQuantity) {
    const floatingCart = readFloatingMarketplaceCart();

    if (!floatingCart?.cartId || !packId) {
      return;
    }

    const existingItem = floatingCart.items.find(
      (item) =>
        String(item?.packId || "") === String(packId) &&
        (!item?.offerId || String(item.offerId) === String(offer?.id || ""))
    );

    if (
      !existingItem?.id ||
      Number(existingItem.quantity || 0) === Number(nextQuantity)
    ) {
      return;
    }

    setError(null);

    try {
      const result = await updateDirectMarketplaceCartItem({
        cartId: floatingCart.cartId,
        itemId: existingItem.id,
        operation: "set_quantity",
        quantity: nextQuantity,
      });

      const nextItems = mapMarketplaceCartItems(result);

      saveFloatingMarketplaceCart({
        cartId: result?.cart?.id || floatingCart.cartId,
        items: nextItems.length > 0 ? nextItems : floatingCart.items,
        pincode:
          result?.cart?.pincode || floatingCart.pincode || pincode.trim(),
        fulfillmentType:
          result?.cart?.fulfillmentType ||
          floatingCart.fulfillmentType ||
          "delivery",
      });
    } catch (quantityError) {
      setError(
        getCommerceErrorMessage(
          quantityError,
          "Unable to update the Marketplace Cart quantity."
        )
      );
    }
  }

  function handleQuantityStep(offer, nextQuantity) {
    const normalized = setOfferQuantity(offer, nextQuantity);

    if (normalized !== undefined) {
      void syncExistingCartQuantity(offer, normalized);
    }
  }

  // The public offers endpoint already checks each Host's delivery service
  // areas, active listing, valid price and available stock for this exact PIN.
  // Auto-check the detected PIN and re-check whenever a different PIN or Pack
  // is selected. Ignore responses from superseded requests.
  useEffect(() => {
    let cancelled = false;
    const lookupPincode = pincode.trim();
    const lookupKey = `${packId || ""}:${lookupPincode}`;

    setOffers([]);
    setError(null);
    setChecked(false);
    setCheckedPincode("");

    if (!packId || !/^\d{6}$/.test(lookupPincode)) {
      setLoading(false);
      onOffersResolved?.({ offer: null, pincode: lookupPincode });
      return () => { cancelled = true; };
    }

    setLoading(true);

    async function checkDelivery() {
      try {
        const result = await getPublicPackOffers({
          packId,
          pincode: lookupPincode,
          fulfillmentType: "delivery",
        });
        if (cancelled) return;

        const nextOffers = Array.isArray(result?.offers) ? result.offers : [];
        setOffers(nextOffers);
        setQuantityByOfferId((current) => {
          const next = {};
          const floatingCart = readFloatingMarketplaceCart();
          const floatingItem = floatingCart?.items?.find(
            (item) => String(item?.packId || "") === String(packId)
          );
          for (const offer of nextOffers) {
            const minimum = Math.max(1, Number(offer?.minimumOrderQuantity || 1));
            const rawMax = offer?.maximumOrderQuantity;
            const maximum = Math.max(
              minimum,
              rawMax === null || rawMax === undefined || !Number.isFinite(Number(rawMax))
                ? 100000 : Math.floor(Number(rawMax))
            );
            const cartQuantity = Number(floatingItem?.quantity);
            const existing = Number.isInteger(cartQuantity)
              ? cartQuantity : Number(current[offer.id]);
            next[offer.id] = Number.isInteger(existing)
              ? Math.min(maximum, Math.max(minimum, existing)) : minimum;
          }
          return next;
        });
        setCheckedPincode(lookupKey);
        setChecked(true);
        onOffersResolved?.({ offer: nextOffers[0] || null, pincode: lookupPincode });
      } catch (nextError) {
        if (cancelled) return;
        setOffers([]);
        setCheckedPincode(lookupKey);
        setChecked(true);
        onOffersResolved?.({ offer: null, pincode: lookupPincode });
        setError(nextError?.message || "Unable to check delivery availability.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void checkDelivery();
    return () => { cancelled = true; };
    // Only the Pack ID and chosen PIN determine when availability is rechecked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, pincode]);

  const verifiedForCurrentPin =
    checked && checkedPincode === `${packId || ""}:${pincode.trim()}`;
  const visibleOffers = verifiedForCurrentPin && !error ? offers : [];
  const needsManualPin = !pincode || manualEditorOpen;

  function handleManualPinCheck(event) {
    event.preventDefault();
    const nextPin = manualDraft.replace(/\s/g, "");
    if (!/^\d{6}$/.test(nextPin)) {
      setPinEntryError("Enter a valid 6-digit PIN code.");
      return;
    }
    setPinEntryError("");
    setManualPincode(nextPin);
    setManualEditorOpen(false);
  }

  function openManualPinEditor() {
    setManualDraft(pincode);
    setPinEntryError("");
    setManualEditorOpen(true);
  }

  async function handleAddToCart(offer, sourceElement) {
    if (!packId || !offer?.id || !/^\d{6}$/.test(pincode.trim()) ||
        !verifiedForCurrentPin || !visibleOffers.some((item) => item.id === offer.id) || addingOfferId) {
      return;
    }

    const quantity = getOfferQuantity(offer);

    setAddingOfferId(offer.id);

    setError(null);

    try {
      const existingFloatingCart = readFloatingMarketplaceCart();

      const result = await createDirectMarketplaceCart({
        cartId: existingFloatingCart?.cartId || null,

        packId,

        offerId: offer.id,

        quantity,

        pincode: pincode.trim(),

        fulfillmentType: "delivery",

        idempotencyKey: createCommerceIdempotencyKey("direct-product-cart"),
      });

      const cartId = result?.cart?.id;

      if (!cartId) {
        throw new Error("Marketplace Cart identity was not returned.");
      }

      const cartItemName = product?.displayName || product?.name || "Product";

      const mappedItems = mapMarketplaceCartItems(result);

      const floatingItems =
        mappedItems.length > 0
          ? mappedItems
          : [
              {
                id: packId,
                packId,
                name: cartItemName,
                quantity,
              },
            ];

      saveFloatingMarketplaceCart({
        cartId,
        items: floatingItems,
        pincode: result?.cart?.pincode || pincode.trim(),
        fulfillmentType: result?.cart?.fulfillmentType || "delivery",
      });

      notifyFloatingCartFly({
        name: cartItemName,
        sourceElement,
      });
    } catch (cartError) {
      const errorCodes = Array.isArray(cartError?.response?.data?.errors)
        ? cartError.response.data.errors.map((entry) => entry?.code)
        : [];

      const becameUnavailable = [
        "DIRECT_CART_OFFER_NOT_ELIGIBLE",
        "DIRECT_CART_PRODUCT_STALE",
        "DIRECT_CART_INVENTORY_CHANGED",
        "DIRECT_CART_ITEM_OFFER_STALE",
      ].some((code) => errorCodes.includes(code));

      if (becameUnavailable) {
        openAvailabilityNotifyModal({
          query: product?.displayName || product?.name || "Product",
          displayName: product?.displayName || product?.name || "Product",
          packId,
          source: "product",
        });
      }

      setError(
        getCommerceErrorMessage(
          cartError,
          "Unable to add this Offer to the Marketplace Cart."
        )
      );
    } finally {
      setAddingOfferId("");
    }
  }

  return (
    <section className="ep-product-offers min-w-0 border-t-[3px] border-[#214E4A] bg-[#E8F2F1] px-4 py-3 sm:px-5 sm:py-3">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#C7DCD8] pb-2.5 sm:flex-nowrap">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#CFE4E1] text-[#174E49]">
          <Store size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-[#173F35] sm:text-xl">
            {pincode ? "Delivery availability" : "Check price by pincode"}
          </h2>
          <p className="mt-0.5 text-[13px] leading-5 text-[#676E67]">
            {pincode
              ? `Delivery PIN ${pincode}${manualPincode === null ? (isLocationApproximate ? " · Estimated location" : " · Current location") : " · Selected address"}`
              : "Choose a delivery PIN to see prices and Add to Cart."}
          </p>
        </div>
        {pincode && !manualEditorOpen && (
          <button
            type="button"
            onClick={openManualPinEditor}
            className="focus-ring ml-auto shrink-0 rounded-full border border-[#A9C8C4] bg-white px-3 py-2 text-sm font-semibold text-[#173F35] hover:border-[#173F35]"
          >
            Change PIN
          </button>
        )}
      </div>

      {pincode && !manualEditorOpen && (
        <div className="py-1.5">
          {!packId ? (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              Delivery details are not available for this product yet.
            </p>
          ) : loading || !verifiedForCurrentPin ? (
            <p role="status" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-stone-600">
              Checking delivery to {pincode}...
            </p>
          ) : !error && visibleOffers.length > 0 ? (
            <p role="status" className="border-l-[3px] border-[#2F856D] bg-white/65 px-2.5 py-1.5 text-[13px] font-medium leading-5 text-[#285E50]">
              {visibleOffers.length} seller option{visibleOffers.length === 1 ? "" : "s"} available for PIN {pincode}.
            </p>
          ) : !error ? (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              We don't deliver this product to this PIN code or location right now.
            </p>
          ) : null}
        </div>
      )}

      {needsManualPin && (
        <form
          onSubmit={handleManualPinCheck}
          className="space-y-2 pb-2 pt-2.5"
        >
          <label htmlFor="product-delivery-pincode" className="block text-xs font-semibold text-stone-700">
            {pincode ? "Check delivery to another location" : "Enter your delivery PIN code"}
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <MapPin
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <input
                id="product-delivery-pincode"
                required
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={manualDraft}
                onFocus={() => {
                  setManualEditorOpen(true);
                  if (!detectedPincode && locationStatus !== "requesting") {
                    void requestCurrentLocation();
                  }
                }}
                onChange={(event) => {
                  setManualDraft(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setPinEntryError("");
                }}
                className="focus-ring h-12 w-full rounded-lg border border-[#A9C8C4] bg-white pl-10 pr-3 text-[15px] font-medium text-[#202421] outline-none transition focus:border-[#174E49] focus:ring-2 focus:ring-[#CFE4E1]"
                placeholder="Enter 6-digit pincode"
              />
            </div>
            <button
              type="submit"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#174E49] px-5 py-2 text-[15px] font-semibold text-white transition hover:bg-[#286C62]"
            >
              <Search size={15} aria-hidden="true" />
              Check delivery
            </button>
          </div>
          {detectedPincode && (
            <button
              type="button"
              onClick={() => {
                setManualDraft(detectedPincode);
                setManualPincode(null);
                setManualEditorOpen(false);
                setPinEntryError("");
              }}
              className="focus-ring inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              Use suggested current-location PIN {detectedPincode}
            </button>
          )}
          {!detectedPincode && locationStatus === "requesting" && (
            <p className="text-xs text-stone-500">Finding your location PIN...</p>
          )}
          {pinEntryError && (
            <p role="alert" className="text-xs font-bold text-rose-700">{pinEntryError}</p>
          )}
          {pincode && manualEditorOpen && (
            <button
              type="button"
              onClick={() => { setManualEditorOpen(false); setPinEntryError(""); }}
              className="text-xs font-bold text-stone-600 underline"
            >
              Cancel
            </button>
          )}
        </form>
      )}

      {error && verifiedForCurrentPin && (
        <p role="alert" className="mb-3 border-l-[3px] border-rose-500 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {!manualEditorOpen && visibleOffers.length > 0 && (
        <div
          className="max-h-[300px] divide-y divide-[#C5D8D4] overflow-y-auto overscroll-y-auto border-t border-[#C5D8D4] [scrollbar-width:thin]"
          role="region"
          aria-label="Available delivery offers"
          tabIndex={0}
        >
          {visibleOffers.map((offer) => (
            <article
              key={offer.id}
              className="grid min-w-0 gap-x-4 gap-y-3 bg-white/75 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <p className="min-w-0 break-words text-[14px] font-semibold leading-5 text-[#173F35]">
                    {offer.seller?.name || "Marketplace Host"}
                  </p>
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-[#E5F3E8] px-2 py-0.5 text-[12px] font-semibold text-emerald-900">
                    In stock
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] font-medium capitalize leading-5 text-[#66746D]">
                  {offer.fulfillmentTypes?.join(" · ") || "Delivery"}
                </p>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className="text-[12px] font-semibold text-[#66746D]">Your price</p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:justify-end">
                  <p className="whitespace-nowrap text-[23px] font-semibold leading-tight tracking-[-0.04em] text-[#202421] sm:text-[25px]">
                    {formatMoney(
                      offer.price?.effectiveAmountMinor,
                      offer.price?.currency || "INR"
                    )}
                  </p>
                  {offer.price?.saleAmountMinor !== null &&
                    offer.price?.saleAmountMinor !== undefined &&
                    offer.price?.listAmountMinor !==
                      offer.price?.saleAmountMinor && (
                      <p className="text-xs font-semibold text-stone-400 line-through">
                        {formatMoney(
                          offer.price?.listAmountMinor,
                          offer.price?.currency || "INR"
                        )}
                      </p>
                    )}
                </div>
              </div>

              <div className="flex min-w-0 flex-wrap items-end gap-3 border-t border-[#E1E9E5] pt-2.5 sm:col-span-2 sm:justify-end">
                <div className="shrink-0">
                  <p className="mb-1 text-[12px] font-semibold text-[#66746D]">Quantity</p>
                  <div className="inline-flex items-center overflow-hidden border border-[#D4DAD2] bg-white">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={
                        Boolean(addingOfferId) ||
                        getOfferQuantity(offer) <=
                          getOfferQuantityBounds(offer).minimum
                      }
                      onClick={() =>
                        handleQuantityStep(offer, getOfferQuantity(offer) - 1)
                      }
                      className="focus-ring grid h-9 w-9 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label="Quantity"
                      min={getOfferQuantityBounds(offer).minimum}
                      max={getOfferQuantityBounds(offer).maximum}
                      value={getOfferQuantity(offer)}
                      disabled={Boolean(addingOfferId)}
                      onChange={(event) =>
                        setOfferQuantity(offer, event.target.value)
                      }
                      onBlur={() =>
                        void syncExistingCartQuantity(
                          offer,
                          getOfferQuantity(offer)
                        )
                      }
                      className="h-9 w-11 border-x border-stone-200 bg-white text-center text-sm font-semibold text-stone-950 outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={
                        Boolean(addingOfferId) ||
                        getOfferQuantity(offer) >=
                          getOfferQuantityBounds(offer).maximum
                      }
                      onClick={() =>
                        handleQuantityStep(offer, getOfferQuantity(offer) + 1)
                      }
                      className="focus-ring grid h-9 w-9 place-items-center text-stone-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(addingOfferId)}
                  onClick={(event) =>
                    handleAddToCart(offer, event.currentTarget)
                  }
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 bg-[#173F35] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[#265F49] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart size={16} aria-hidden="true" />
                  {addingOfferId === offer.id
                    ? "Adding..."
                    : `Add ${getOfferQuantity(offer)} to Cart`}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function productDetailLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function ProductDetailsSheet({ product }) {
  const scrollAreaRef = useRef(null);

  const nutrients = Array.isArray(product?.nutrition?.nutrients)
    ? product.nutrition.nutrients
    : [];

  const allergens = Array.isArray(product?.allergens) ? product.allergens : [];

  const detailRows = [
    ["Brand", product?.brand?.name || "Not declared"],
    ["Category", product?.category?.name || "Not declared"],
    ["Net quantity", formatQuantity(product?.netQuantity)],
    ["Pack", product?.pack?.name || product?.pack?.type || "Not declared"],
    [
      "Barcode",
      <ProductBarcode
        key="product-barcode"
        value={product?.gtin || product?.barcode}
        compact
      />,
    ],
    ["Country of origin", product?.countryOfOrigin || "Not declared"],
    ["Manufacturer / supplier", product?.manufacturerName || "Not declared"],
    [
      "Serving size",
      product?.nutrition?.servingSize
        ? formatQuantity(product.nutrition.servingSize)
        : "Not declared",
    ],
  ];

  return (
    <div className="flex h-full min-h-0 w-full items-stretch justify-center bg-[#E9EFF5] p-3 sm:p-4">
      <div className="flex h-full min-h-0 w-full max-w-[760px] flex-col overflow-hidden border border-[#CEDCE5] bg-[#FFFCF8]">
        <div className="shrink-0 border-b border-[#C9DDD7] bg-[#DDECE6] px-4 py-4 text-[#173F35] sm:px-6 sm:py-5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#2D665B]">
            EPANTRY · Product details sheet
          </p>
          <h2 className="mt-1 text-[17px] font-black leading-[1.08] sm:mt-2 sm:text-3xl sm:leading-tight">
            {product?.displayName || "Product"}
          </h2>
          <p className="mt-2 text-[13px] font-medium leading-5 text-[#536D65]">
            Published listing details · generated from governed product data
          </p>
        </div>

        <div
          ref={scrollAreaRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto touch-pan-y p-5 sm:p-6 [scrollbar-width:thin]"
        >
          <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {detailRows.map(([label, value]) => (
              <div key={label} className="border-b border-stone-100 pb-2">
                <dt className="text-[12px] font-black uppercase tracking-[0.1em] text-stone-400">
                  {label}
                </dt>
                <dd className="mt-1 min-w-0 break-words text-xs font-black text-stone-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-stone-200 pt-4">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Ingredients
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.ingredientDeclarationText ||
                (product?.ingredients?.length
                  ? product.ingredients
                      .map((ingredient) => ingredient?.displayName)
                      .filter(Boolean)
                      .join(", ")
                  : "Not declared")}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">
              Allergens
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
              {product?.allergenStatement ||
                (allergens.length
                  ? allergens
                      .map(
                        (allergen) =>
                          `${productDetailLabel(
                            allergen?.allergenKey
                          )} (${productDetailLabel(allergen?.relationType)})`
                      )
                      .join(", ")
                  : "Not declared")}
            </p>
          </div>

          <div className="mt-4 border-t border-stone-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Nutrition
              </p>
              <span className="text-[12px] font-black text-stone-500">
                {product?.nutrition?.basis
                  ? productDetailLabel(product.nutrition.basis)
                  : "Declared basis"}
              </span>
            </div>

            {nutrients.length ? (
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
                {nutrients.map((nutrient, index) => (
                  <div
                    key={`${nutrient?.nutrientKey || "nutrient"}-${index}`}
                    className="flex items-center justify-between gap-2 border-b border-stone-100 py-1.5 text-[12px]"
                  >
                    <span className="font-bold text-stone-500">
                      {productDetailLabel(nutrient?.nutrientKey)}
                    </span>
                    <span className="font-black text-stone-950">
                      {nutrient?.amount ?? "—"} {nutrient?.unit || ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs font-semibold text-stone-500">
                Nutrition not declared.
              </p>
            )}
          </div>

          {product?.claims?.length || product?.certifications?.length ? (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Claims & certifications
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ...(product?.claims || []),
                  ...(product?.certifications || []),
                ].map((item, index) => (
                  <span
                    key={`${item?.key || item?.label || "detail"}-${index}`}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-black text-emerald-800"
                  >
                    {item?.label || productDetailLabel(item?.key)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const PRODUCT_RECOMMENDATION_LIMIT = 5;

const PRODUCT_BROWSE_CATEGORY_RULES = [
  {
    slug: "vegetables",
    pattern:
      /(tomato|okra|bhindi|bottle gourd|lauki|broccoli|bell pepper|capsicum|potato|onion|garlic|carrot|cabbage|cauliflower|spinach|cucumber|brinjal|eggplant|green beans|peas|vegetable)/i,
  },
  {
    slug: "fruits",
    pattern:
      /(banana|mango|pomegranate|avocado|kiwi|apple|orange|grape|guava|papaya|pineapple|pear|peach|plum|berry|berries|watermelon|melon|fruit)/i,
  },
  {
    slug: "beverages",
    pattern:
      /(energy drink|soft drink|beverage|juice|soda|sparkling water|tonic water)/i,
  },
  {
    slug: "rice-grains",
    pattern: /(rice|basmati|jasmine rice|grain|quinoa|oats|wheat|cereal)/i,
  },
  {
    slug: "spices-condiments",
    pattern: /(spice|masala|turmeric|chilli|pepper|sauce|condiment|paste)/i,
  },
  {
    slug: "tea-coffee",
    pattern: /(tea|coffee|matcha)/i,
  },
  {
    slug: "oils-fats",
    pattern: /(oil|ghee|butter|fat)/i,
  },
  {
    slug: "sweeteners-syrups",
    pattern: /(honey|sugar|sweetener|syrup|jaggery)/i,
  },
];

function getProductRecommendationKey(product) {
  return String(
    product?.productVersionId || product?.id || product?.slug || ""
  ).trim();
}

function inferProductRecommendationCategory(product) {
  const categorySlug = String(product?.category?.slug || "").trim();

  const knownBrowseCategory = PRODUCT_BROWSE_CATEGORY_RULES.find(
    (rule) => rule.slug === categorySlug
  );

  if (knownBrowseCategory) {
    return categorySlug;
  }

  const searchableText = [
    product?.displayName,
    product?.family?.name,
    product?.variant?.name,
    product?.category?.name,
  ]
    .filter(Boolean)
    .join(" ");

  const matchedRule = PRODUCT_BROWSE_CATEGORY_RULES.find((rule) =>
    rule.pattern.test(searchableText)
  );

  return matchedRule?.slug || categorySlug;
}

function RecommendationProductCard({ product }) {
  const path = `/grocery/product/${encodeURIComponent(product?.slug || "")}`;

  const imageUrl = product?.image?.url || "";

  const quantity =
    product?.netQuantity?.value !== undefined &&
    product?.netQuantity?.value !== null
      ? `${product.netQuantity.value} ${product.netQuantity.unit || ""}`.trim()
      : "";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[17px] border border-[#CBDDD7] bg-[#FFFEFB] shadow-[0_5px_16px_rgba(22,57,46,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#709D91] hover:shadow-[0_14px_28px_rgba(22,57,46,0.12)] motion-reduce:transform-none motion-reduce:transition-none">
      <Link
        to={path}
        className="focus-ring relative block aspect-[1/1] overflow-hidden bg-[#F5F8F4]"
        aria-label={`View ${product?.displayName || "product"}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.image?.alt || product?.displayName || "Product"}
            className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-emerald-700/35">
            <Package size={42} strokeWidth={1.4} aria-hidden="true" />
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-[#FFFEFA]/95 px-2.5 py-1 text-[12px] font-semibold text-[#23564D] shadow-sm">
          {product?.category?.name || "EPANTRY pick"}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {product?.brand?.name ? (
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#346E60]">
            {product.brand.name}
          </p>
        ) : null}

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.7em] text-[17px] font-semibold leading-[1.35] tracking-[-0.02em] text-[#173F35]">
          {product?.displayName || "Grocery product"}
        </h3>

        <div className="mt-2 min-h-5 text-[12px] font-semibold text-stone-500">
          {quantity || product?.pack?.name || "Published product"}
        </div>

        <Link
          to={path}
          className="focus-ring mt-auto inline-flex min-h-11 items-center justify-between gap-3 rounded-lg bg-[#174E49] px-3.5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#266D62]"
        >
          View product
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function CountryListingCard({ listing }) {
  const isRecipe = listing?.type === "recipe";

  const item = listing?.item || {};

  const path = isRecipe
    ? getCountryRecipePath(item)
    : `/grocery/product/${encodeURIComponent(item?.slug || "")}`;

  const title = isRecipe
    ? getCountryRecipeName(item)
    : item?.displayName || "Grocery product";

  const imageUrl = isRecipe
    ? getCountryRecipeImage(item)
    : item?.image?.url || "";

  const meta = isRecipe
    ? recipeCountryCuisine(item) || "Recipe"
    : item?.category?.name || item?.brand?.name || "Grocery";

  return (
    <Link
      to={path}
      className="focus-ring group flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white p-2.5 shadow-[0_8px_24px_rgba(28,25,23,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_12px_28px_rgba(4,120,87,0.10)] motion-reduce:transform-none"
    >
      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f3f6f1]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package
            size={24}
            className="text-emerald-700/40"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-black uppercase tracking-[0.12em] text-emerald-800">
            {isRecipe ? "Recipe" : "Grocery"}
          </span>
          <span className="truncate text-[12px] font-bold text-stone-400">
            {meta}
          </span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-xs font-black leading-4 text-stone-900">
          {title}
        </p>
      </div>

      <ArrowRight
        size={15}
        className="shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"
        aria-hidden="true"
      />
    </Link>
  );
}

function ProductRecommendationShelf({
  eyebrow,
  title,
  description,
  items,
  loading,
  viewAllTo,
}) {
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#346E60]">
            {eyebrow}
          </p>
          <h2 className="mt-1.5 text-[27px] font-semibold tracking-[-0.035em] text-[#173F35] sm:text-[34px]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-stone-500">
              {description}
            </p>
          ) : null}
        </div>

        <Link
          to={viewAllTo}
          className="focus-ring inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[#B7CDC6] bg-[#FFFEFA] px-4 py-2.5 text-sm font-semibold text-[#174E49] transition hover:border-[#174E49] hover:bg-[#174E49] hover:text-white"
        >
          View all
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 md:grid-cols-3 xl:grid-cols-5">
        {loading
          ? Array.from({ length: PRODUCT_RECOMMENDATION_LIMIT }).map(
              (_, index) => (
                <div
                  key={index}
                  className="w-[64%] shrink-0 snap-start sm:w-auto sm:shrink"
                >
                  <div className="aspect-[0.76/1] animate-pulse rounded-[24px] border border-stone-200 bg-white" />
                </div>
              )
            )
          : items.map((item) => (
              <div
                key={getProductRecommendationKey(item)}
                className="w-[64%] shrink-0 snap-start sm:w-auto sm:shrink"
              >
                <RecommendationProductCard product={item} />
              </div>
            ))}
      </div>
    </section>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();

  const { product, loading, error } = useProductDetail(slug);

  const [zoomPreview, setZoomPreview] = useState(null);

  const [showAllImages, setShowAllImages] = useState(false);

  const [frequentlyBought, setFrequentlyBought] = useState([]);

  const [similarProducts, setSimilarProducts] = useState([]);

  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const [similarCategorySlug, setSimilarCategorySlug] = useState("");

  const [countryPanelOpen, setCountryPanelOpen] = useState(false);

  const [countryListings, setCountryListings] = useState([]);

  const [countryListingsLoading, setCountryListingsLoading] = useState(false);

  useEffect(() => {
    setCountryPanelOpen(false);
    setCountryListings([]);
  }, [product?.slug]);

  useEffect(() => {
    if (!countryPanelOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setCountryPanelOpen(false);
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [countryPanelOpen]);

  useEffect(() => {
    const origin = String(product?.countryOfOrigin || "").trim();

    if (!countryPanelOpen || !origin) {
      if (!origin) {
        setCountryListings([]);
      }

      return undefined;
    }

    let active = true;

    async function loadCountryListings() {
      setCountryListingsLoading(true);

      const countryMeta = resolveCountryMeta(origin);

      try {
        const [productsSettled, recipesSettled] = await Promise.allSettled([
          getCatalogProducts({
            page: 1,
            limit: 100,
          }),
          listPublicRecipes({
            page: 1,
            limit: countryMeta.cuisine ? 18 : 50,
            ...(countryMeta.cuisine
              ? {
                  cuisine: countryMeta.cuisine,
                }
              : {}),
          }),
        ]);

        if (!active) {
          return;
        }

        const currentProductKey = getProductRecommendationKey(product);

        const originKey = normalizeCountryKey(origin);

        const productItems =
          productsSettled.status === "fulfilled"
            ? productsSettled.value?.products || []
            : [];

        const matchingProducts = productItems
          .filter(
            (item) =>
              getProductRecommendationKey(item) !== currentProductKey &&
              normalizeCountryKey(item?.countryOfOrigin) === originKey
          )
          .slice(0, 4)
          .map((item) => ({
            type: "product",
            item,
          }));

        const recipeItems =
          recipesSettled.status === "fulfilled"
            ? recipesSettled.value?.recipes || []
            : [];

        const cuisineKey = normalizeCountryKey(countryMeta.cuisine);

        const matchingRecipes = recipeItems
          .filter((item) => {
            const recipeCuisine = normalizeCountryKey(
              recipeCountryCuisine(item)
            );

            if (!recipeCuisine) {
              return false;
            }

            if (cuisineKey) {
              return (
                recipeCuisine === cuisineKey ||
                recipeCuisine.includes(cuisineKey) ||
                cuisineKey.includes(recipeCuisine)
              );
            }

            return (
              recipeCuisine === originKey ||
              recipeCuisine.includes(originKey) ||
              originKey.includes(recipeCuisine)
            );
          })
          .slice(0, 4)
          .map((item) => ({
            type: "recipe",
            item,
          }));

        const combined = [];
        const maxLength = Math.max(
          matchingProducts.length,
          matchingRecipes.length
        );

        for (let index = 0; index < maxLength; index += 1) {
          if (matchingProducts[index]) {
            combined.push(matchingProducts[index]);
          }

          if (matchingRecipes[index]) {
            combined.push(matchingRecipes[index]);
          }
        }

        setCountryListings(combined.slice(0, 6));
      } catch {
        if (active) {
          setCountryListings([]);
        }
      } finally {
        if (active) {
          setCountryListingsLoading(false);
        }
      }
    }

    loadCountryListings();

    return () => {
      active = false;
    };
  }, [countryPanelOpen, product?.slug, product?.countryOfOrigin]);

  useEffect(() => {
    if (!product?.slug) {
      setFrequentlyBought([]);
      setSimilarProducts([]);
      setSimilarCategorySlug("");
      return undefined;
    }

    let active = true;

    async function loadProductRecommendations() {
      setRecommendationsLoading(true);

      const recommendationCategory =
        inferProductRecommendationCategory(product);

      try {
        const [catalogSettled, categorySettled] = await Promise.allSettled([
          getCatalogProducts({
            page: 1,
            limit: 24,
          }),
          recommendationCategory
            ? getCatalogCategoryProducts({
                categorySlug: recommendationCategory,
                page: 1,
                limit: 18,
              })
            : Promise.resolve({
                products: [],
              }),
        ]);

        if (!active) {
          return;
        }

        const catalogResult =
          catalogSettled.status === "fulfilled"
            ? catalogSettled.value
            : { products: [] };

        const categoryResult =
          categorySettled.status === "fulfilled"
            ? categorySettled.value
            : { products: [] };

        const currentKey = getProductRecommendationKey(product);

        const uniqueProducts = (items) => {
          const seen = new Set();

          return (items || []).filter((item) => {
            const key = getProductRecommendationKey(item);

            if (!key || key === currentKey || seen.has(key)) {
              return false;
            }

            seen.add(key);
            return true;
          });
        };

        const catalogProducts = uniqueProducts(catalogResult?.products);

        const categoryProducts = uniqueProducts(categoryResult?.products);

        const inferredCategoryMatches = recommendationCategory
          ? catalogProducts.filter(
              (item) =>
                inferProductRecommendationCategory(item) ===
                recommendationCategory
            )
          : [];

        // Similar products must stay visible even when the category endpoint
        // has fewer than five published items. Prefer the same category, then
        // fill the row from the live catalog without repeating the current item.
        const nextSimilar = uniqueProducts([
          ...categoryProducts,
          ...inferredCategoryMatches,
          ...catalogProducts,
        ]).slice(0, PRODUCT_RECOMMENDATION_LIMIT);

        // Frequently bought is a separate discovery shelf. It may overlap with
        // Similar products when the published catalog is small; hiding an entire
        // section is worse than repeating a useful product.
        const nextFrequent = catalogProducts.slice(
          0,
          PRODUCT_RECOMMENDATION_LIMIT
        );

        setFrequentlyBought(nextFrequent);
        setSimilarProducts(nextSimilar);
        setSimilarCategorySlug(recommendationCategory);
      } catch {
        if (active) {
          setFrequentlyBought([]);
          setSimilarProducts([]);
          setSimilarCategorySlug("");
        }
      } finally {
        if (active) {
          setRecommendationsLoading(false);
        }
      }
    }

    loadProductRecommendations();

    return () => {
      active = false;
    };
  }, [
    product?.slug,
    product?.displayName,
    product?.category?.name,
    product?.category?.slug,
    product?.family?.name,
    product?.variant?.name,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#dcefe9_0%,#edf5f2_24%,#f4efe5_58%,#deedf1_100%)] sm:bg-[#f5f4ef]">
        <div className="page-shell py-10">
          <div className="h-[560px] animate-pulse rounded-[24px] border border-stone-200 bg-white" />
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#f5f4ef]">
        <div className="page-shell py-12">
          <EmptyState
            title="Product unavailable"
            description={error || "This published product could not be found."}
          />
        </div>
      </main>
    );
  }

  const productImages = (
    product.images?.length
      ? product.images
      : product.image?.url
      ? [product.image]
      : []
  ).filter((image) => Boolean(image?.url));

  const productGalleryItems = productImages.length
    ? [
        {
          type: "image",

          image: productImages[0],
        },
        {
          type: "details",
        },
        ...productImages.slice(1).map((image) => ({
          type: "image",

          image,
        })),
      ]
    : [
        {
          type: "details",
        },
      ];

  const imageCount = productGalleryItems.length;

  const hasClaimsOrCertifications =
    product.claims?.length > 0 || product.certifications?.length > 0;

  const countryMeta = resolveCountryMeta(product.countryOfOrigin);

  const countryCopy = countryDescription(product.countryOfOrigin);

  return (
    <main className="ep-product-page min-h-screen bg-[#FDFDFA] text-[#202421]">
      <div className="mx-auto w-full max-w-[1480px] px-5 pb-14 pt-0 sm:px-9 lg:px-14">
        <div className="flex items-center justify-between gap-4 border-b border-[#E7E9E4] py-0.5">
          <Link to="/grocery" className="focus-ring inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#35463B] transition hover:text-[#C86C42] sm:min-h-9">
            <ArrowLeft size={17} aria-hidden="true" /> Back to Grocery
          </Link>
          <a href="#ep-product-facts" className="focus-ring inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#35463B] transition hover:text-[#C86C42] sm:min-h-9">
            Product information <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <section className="ep-product-hero grid min-w-0 gap-0 border-b border-[#E2E5DE] lg:grid-cols-[minmax(0,1.07fr)_minmax(0,0.93fr)] xl:min-h-[min(870px,96svh)]">
          <div className="min-w-0 lg:pr-10 xl:pr-16">
            <div className="relative flex min-h-[390px] flex-col justify-center bg-[#F6F6F2] sm:min-h-[540px] lg:min-h-[660px] xl:min-h-[min(735px,84svh)]">
              <div className="absolute left-5 top-6 z-10 text-xs font-semibold tracking-[0.08em] text-[#5C6A60] sm:left-8 sm:top-8">
                {product.category?.name || "EPANTRY grocery"}
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-6 pt-16 [scrollbar-width:thin] lg:hidden" aria-label="Swipe product images and details">
                {productGalleryItems.map((item, index) => (
                  <div
                    key={item.type === "details" ? "mobile-product-details-sheet" : `mobile-${item.image?.url}-${index}`}
                    className="h-[340px] w-[88%] shrink-0 snap-center overflow-hidden border border-[#E4E8E0] bg-[#fffefa] sm:h-[470px]"
                  >
                    {item.type === "details" ? (
                      <ProductDetailsSheet product={product} />
                    ) : (
                      <img src={item.image.url} alt={item.image.alt || product.displayName} className="h-full w-full object-contain p-5" />
                    )}
                  </div>
                ))}
              </div>
              <div
                className="relative mx-auto hidden h-[575px] w-full items-center justify-center overflow-hidden px-7 pt-8 lg:flex xl:px-12"
                onMouseMove={(event) => {
                  if (!productImages[0]?.url) return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
                  const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
                  setZoomPreview({ url: productImages[0].url, alt: productImages[0].alt || product.displayName, x, y });
                }}
                onMouseLeave={() => setZoomPreview(null)}
              >
                {productImages[0]?.url ? (
                  <img src={productImages[0].url} alt={productImages[0].alt || product.displayName} className="h-full w-full object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-3 text-[#849187]"><Package size={72} strokeWidth={1.1} aria-hidden="true" /><span className="text-sm">Product image not available</span></span>
                )}
              </div>
              {zoomPreview && (
                <div className="pointer-events-none absolute inset-4 z-20 hidden overflow-hidden border border-[#E0E4DA] bg-white shadow-lg lg:block" aria-label={`Zoomed preview of ${zoomPreview.alt}`}>
                  <div className="h-full w-full bg-white bg-no-repeat" style={{ backgroundImage: `url(${zoomPreview.url})`, backgroundPosition: `${zoomPreview.x}% ${zoomPreview.y}%`, backgroundSize: "235%" }} />
                </div>
              )}
              <button type="button" onClick={() => setShowAllImages(true)} className="focus-ring absolute bottom-5 right-5 z-10 inline-flex min-h-11 items-center gap-2 border border-[#D8DED4] bg-white/95 px-4 text-sm font-semibold text-[#173F35] transition hover:border-[#173F35] sm:bottom-8 sm:right-8">
                <ZoomIn size={17} aria-hidden="true" /> View gallery
              </button>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto py-4 sm:gap-4 sm:py-5" role="group" aria-label="Open product images and details">
              {productGalleryItems.map((item, index) => (
                <button
                  key={item.type === "details" ? "product-facts-gallery-tile" : `product-tile-${item.image?.url}-${index}`}
                  type="button"
                  onClick={() => setShowAllImages(true)}
                  className="focus-ring flex h-[75px] w-[75px] shrink-0 items-center justify-center border border-[#DBDFD7] bg-[#F9F9F5] text-[#173F35] transition hover:border-[#173F35] sm:h-[88px] sm:w-[88px]"
                  aria-label={item.type === "details" ? "Open full product information sheet" : `View ${item.image?.alt || "product photograph"}`}
                >
                  {item.type === "details" ? (
                    <div className="flex h-full w-full flex-col overflow-hidden bg-[#FFFCF7] text-left" aria-hidden="true">
                      <div className="bg-[#DDECE6] px-2 py-1.5 text-[8px] font-semibold tracking-wide text-[#174E49]">EPANTRY</div>
                      <div className="flex flex-1 flex-col justify-center gap-1 px-2.5">
                        <span className="line-clamp-2 text-[9px] font-semibold leading-tight text-[#173F35]">{product.displayName}</span>
                        <span className="h-px bg-[#D6DDD5]" />
                        <span className="text-[8px] text-[#617269]">{product.brand?.name || "Product"}</span>
                        <span className="h-px bg-[#D6DDD5]" />
                        <span className="text-[8px] text-[#617269]">{formatQuantity(product.netQuantity)}</span>
                      </div>
                    </div>
                  ) : (
                    <img src={item.image.url} alt={item.image.alt || product.displayName} className="h-full w-full object-contain p-2" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 px-1 pb-10 pt-9 sm:px-4 sm:pt-14 lg:pb-14 lg:pl-8 xl:pl-14 xl:pt-20">
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[#173F35]">
              <span className="h-[2px] w-7 bg-[#C86C42]" aria-hidden="true" />
              {product.brand?.name || "EPANTRY grocery"}
            </div>
            <h1 className="mt-5 max-w-[650px] break-words text-[38px] font-medium leading-[1.09] tracking-[-0.055em] text-[#202421] sm:text-[50px] xl:text-[clamp(44px,4.4vw,66px)]">
              {product.displayName}
            </h1>
            {product.variant?.name && product.variant.name !== product.displayName && (
              <p className="mt-2 text-xl font-medium text-[#6E806B] sm:text-2xl">{product.variant.name}</p>
            )}
            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-[#E0E6DF] py-4">
              {product.category?.name && (
                <span className="text-[14px] font-medium text-[#34685C]">{product.category.name}</span>
              )}
              {product.category?.name && <span className="h-1 w-1 rounded-full bg-[#9CAEA5]" aria-hidden="true" />}
              <span className="text-[16px] font-semibold text-[#202421]">{formatQuantity(product.netQuantity)}</span>
              {product.pack?.name && product.pack.name !== product.displayName && (
                <span className="text-[14px] font-medium text-[#637267]">{product.pack.name}</span>
              )}
            </div>
            {product.description && product.description.trim() !== "Created through governed M14 NPI to M04 catalog handoff." && <p className="mt-5 max-w-xl whitespace-pre-line text-[15px] leading-[1.75] text-[#495149] sm:text-base">{product.description}</p>}
            {(!product.description || product.description.trim() === "Created through governed M14 NPI to M04 catalog handoff.") && product.ingredientDeclarationText && (
              <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-[#495149] sm:text-base">{product.ingredientDeclarationText}</p>
            )}
            {product.countryOfOrigin && (
              <button type="button" onClick={() => setCountryPanelOpen(true)} className="focus-ring mt-7 inline-flex items-center gap-2 border-b border-[#C2CDC2] pb-2 text-sm font-medium text-[#173F35] transition hover:border-[#173F35]">
                <span aria-hidden="true">{countryMeta.flag}</span> Origin: {product.countryOfOrigin} <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
            <div className="mt-10 sm:mt-12">
              <MarketplaceOffers product={product} />
            </div>
            <a href="#ep-product-facts" className="focus-ring mt-8 inline-flex min-h-11 items-center gap-3 border-b border-[#173F35] text-sm font-semibold text-[#173F35] transition hover:text-[#C86C42]">
              See complete product details <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>
        <SponsoredCampaignSlot
          placement="product_detail"
          slotKey="product_overview"
          embedded
        />

        {showAllImages && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/65 p-4 backdrop-blur-sm sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="All product images"
            onClick={() => setShowAllImages(false)}
          >
            <div
              className="relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[20px] border border-white/20 bg-[#F5F8F8] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#D7E3E5] bg-[#F8FBFA] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Product gallery
                  </p>
                  <h2 className="mt-1 text-lg font-black text-stone-950">
                    All images ({imageCount})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllImages(false)}
                  className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
                  aria-label="Close product gallery"
                >
                  <X size={19} aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto p-3 sm:p-5 [scrollbar-width:thin]">
                <div className="grid auto-rows-auto items-stretch gap-4 sm:grid-cols-2">
                  {productGalleryItems.map((item, index) =>
                    item.type === "details" ? (
                      <div
                        key="all-product-details-sheet"
                        className="h-[min(67dvh,560px)] min-h-[340px] overflow-hidden rounded-[14px] border border-[#CDDFE2] bg-white"
                      >
                        <ProductDetailsSheet product={product} />
                      </div>
                    ) : (
                      <div
                        key={`all-${item.image.url}-${index}`}
                        className="flex h-[min(67dvh,560px)] min-h-[340px] items-center justify-center overflow-hidden rounded-[14px] border border-[#CDDFE2] bg-white"
                      >
                        <img
                          src={item.image.url}
                          alt={item.image.alt || product.displayName}
                          className="h-full w-full object-contain p-5 sm:p-8"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {countryPanelOpen && product.countryOfOrigin ? (
          <div
            className="fixed inset-0 z-[140] bg-stone-950/10 backdrop-blur-[1px]"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCountryPanelOpen(false);
              }
            }}
          >
            <aside
              className="absolute right-4 top-[96px] flex max-h-[min(78dvh,660px)] w-[min(400px,calc(100vw-32px))] flex-col overflow-hidden rounded-[20px] border border-[#D6D9E9] bg-[#FCFBFF] text-[#202421] shadow-[0_24px_70px_rgba(28,25,23,0.22)] sm:right-6 sm:top-[104px]"
              role="dialog"
              aria-modal="true"
              aria-label={`About ${product.countryOfOrigin}`}
            >
              <div className="relative shrink-0 overflow-hidden border-b border-[#D4D6E8] bg-[#E6DFF8] px-5 pb-5 pt-6 text-[#242638]">
                <button
                  type="button"
                  onClick={() => setCountryPanelOpen(false)}
                  className="focus-ring absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-[#BDB5D4] bg-white/80 text-[#292C3E] transition hover:bg-white"
                  aria-label="Close country panel"
                >
                  <X size={18} aria-hidden="true" />
                </button>

                <div className="flex items-center gap-3 pr-11">
                  <span
                    className="text-[42px] leading-none drop-shadow-sm"
                    aria-hidden="true"
                  >
                    {countryMeta.flag}
                  </span>

                  <div className="min-w-0 pb-1">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.07em] text-[#5E567E]">
                      Country of origin
                    </p>
                    <h2 className="mt-1 break-words text-[27px] font-semibold tracking-[-0.03em] text-[#242638]">
                      {product.countryOfOrigin}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto bg-[#FCFBFF] px-5 py-5 [scrollbar-width:thin]">
                <section>
                  <p className="text-[12px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    About the origin
                  </p>

                  <div className="mt-3 space-y-3 text-[15px] font-normal leading-6 text-[#424351]">
                    {countryCopy.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>

                <section className="mt-5 border-t border-stone-200 pt-5">
                  <div>
                    <p className="text-[12px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      More from {product.countryOfOrigin}
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-[#242638]">
                      Grocery & recipes on EPANTRY
                    </h3>
                  </div>

                  {countryListingsLoading ? (
                    <div className="mt-3 grid gap-2.5">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-[74px] animate-pulse rounded-2xl border border-stone-200 bg-white"
                        />
                      ))}
                    </div>
                  ) : countryListings.length > 0 ? (
                    <div className="mt-3 grid gap-2.5">
                      {countryListings.map((listing, index) => (
                        <CountryListingCard
                          key={`${listing.type}-${
                            listing.type === "recipe"
                              ? getCountryRecipePath(listing.item)
                              : getProductRecommendationKey(listing.item)
                          }-${index}`}
                          listing={listing}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-4 text-[13px] font-semibold leading-5 text-stone-500">
                      No other published grocery or recipe listing from this
                      country is available yet.
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        ) : null}

        <SponsoredCampaignSlot
          placement="product_detail"
          slotKey="product_details"
          embedded
        />

        <section id="ep-product-facts" className="scroll-mt-20 border-t border-[#D7DBD3] pt-10 sm:pt-14">
          <div className="grid gap-0 border-b border-[#DDE0D9] lg:grid-cols-[minmax(260px,0.64fr)_minmax(0,1.36fr)]">
            <div className="bg-[#E9E3F5] px-6 py-9 sm:px-9 sm:py-11">
              <p className="text-sm font-semibold text-[#65567B]">01 / Product information</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.045em] text-[#242638] sm:text-[42px]">Everything about<br />this product.</h2>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-[#555268]">Published product facts, clearly presented. Information that has not been supplied is marked as not declared.</p>
            </div>
            <div className="min-w-0 bg-[#FFFDF9] px-6 py-7 sm:px-9 sm:py-9">
              {product.description && product.description.trim() !== "Created through governed M14 NPI to M04 catalog handoff." && (
                <div className="border-b border-[#DDE0D9] pb-7">
                  <h3 className="text-lg font-semibold text-[#173F35]">About this product</h3>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-[#4C554D]">{product.description}</p>
                </div>
              )}
              <dl className="grid gap-x-10 sm:grid-cols-2">
                {[
                  ["Brand", product.brand?.name || "Not declared"],
                  ["Product family", product.family?.name || "Not declared"],
                  ["Variant", product.variant?.name || "Not declared"],
                  ["Category", product.category?.name || "Not declared"],
                  ["Net quantity", formatQuantity(product.netQuantity)],
                  ["Pack", product.pack?.name || product.pack?.type || "Not declared"],
                  ["Pack type", product.pack?.type || "Not declared"],
                  ["Units per pack", product.pack?.multipackCount != null ? String(product.pack.multipackCount) : "Not declared"],
                  ["Manufacturer / packer", product.manufacturerName || "Not declared"],
                  ["Serving size", product.nutrition?.servingSize ? formatQuantity(product.nutrition.servingSize) : "Not declared"],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 border-b border-[#DEE4DF] py-4">
                    <dt className="text-[13px] font-medium text-[#737970]">{label}</dt>
                    <dd className="mt-1 break-words text-base font-semibold text-[#202421]">{value}</dd>
                  </div>
                ))}
                <div className="min-w-0 border-b border-[#DEE4DF] py-4">
                  <dt className="text-[13px] font-medium text-[#737970]">Country of origin</dt>
                  <dd className="mt-1">
                    {product.countryOfOrigin ? (
                      <button type="button" onClick={() => setCountryPanelOpen(true)} className="focus-ring inline-flex items-center gap-2 text-base font-semibold text-[#173F35] hover:underline">
                        {countryMeta.flag} {product.countryOfOrigin} <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    ) : <span className="font-semibold">Not declared</span>}
                  </dd>
                </div>
                <div className="min-w-0 border-b border-[#DEE4DF] py-4">
                  <dt className="text-[13px] font-medium text-[#737970]">Barcode / GTIN</dt>
                  <dd className="mt-2 min-w-0"><ProductBarcode value={product.gtin || product.barcode} compact /></dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 items-stretch gap-6 pb-0 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-8 sm:pt-10">
          <div className="min-w-0 bg-[#EAF2F6] px-5 py-8 sm:px-8 sm:py-10">
            <p className="text-sm font-semibold text-[#476B7C]">02 / Ingredients &amp; safety</p>
            <h2 className="mb-2 mt-3 text-[29px] font-semibold tracking-[-0.045em] text-[#1C454D] sm:text-[36px]">Ingredients & safety</h2>
            <p className="mb-5 max-w-lg text-sm leading-6 text-[#51666A]">
              Open a section to read its published details, declarations and reviewed evidence.
            </p>
            <div className="min-w-0">
              <DetailCard
                title="Ingredients"
                icon={Package}
                description="Reviewed ingredient declaration and recognized ingredients"
              >
                <div className="space-y-4">
                  {product.ingredientDeclarationText && (
                    <div className="border-l-[3px] border-[#C86C42] bg-[#F8F1E8] px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white">
                          <Package size={15} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            Reviewed ingredient declaration
                          </p>
                          <p className="mt-0.5 text-[13px] text-stone-500">
                            Published from the approved product record
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-semibold leading-6 text-stone-800">
                        {product.ingredientDeclarationText}
                      </p>
                    </div>
                  )}

                  {product.ingredients?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Recognized ingredients
                        </p>
                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[13px] font-black text-emerald-700">
                          {product.ingredients.length} mapped
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {product.ingredients.map((ingredient, index) => (
                          <span
                            key={`${
                              ingredient.ingredientId || "ingredient"
                            }-${index}`}
                            className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-sm font-bold text-stone-700 shadow-sm"
                          >
                            {ingredient.displayName || "Canonical ingredient"}
                            {ingredient.percentage !== null && ingredient.percentage !== undefined ? ` · ${ingredient.percentage}%` : ""}
                            {ingredient.notes ? ` · ${ingredient.notes}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="border-l-2 border-[#d0d9cf] bg-[#F9F9F4] px-4 py-3">
                      <p className="text-sm leading-5 text-stone-500">
                        {product.ingredientDeclarationText
                          ? "Canonical ingredient mapping is still pending. The reviewed package declaration is shown above."
                          : "Ingredient information has not been published for this product."}
                      </p>
                    </div>
                  )}
                </div>
              </DetailCard>

              <DetailCard
                title="Product origin"
                icon={Globe2}
                description="Where this product comes from and who made or packed it"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border-l-[3px] border-[#173F35] bg-[#EDF1EA] px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
                        <Globe2 size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-emerald-700">
                          Country of origin
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.countryOfOrigin || "Not declared"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-[3px] border-[#C86C42] bg-[#F8F1E8] px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-900 text-white shadow-sm">
                        <Factory size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-stone-500">
                          Manufacturer / packer
                        </p>
                        <p className="mt-1.5 break-words text-sm font-black leading-5 text-stone-900">
                          {product.manufacturerName || "Not declared"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </DetailCard>

              <DetailCard title="Published claims & certifications" icon={BadgeCheck} description="Approved product claims and certification references">
                {hasClaimsOrCertifications ? (
                  <div className="flex flex-wrap gap-2">
                    {product.claims?.map((claim, index) => (
                      <span
                        key={`${claim.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-800"
                      >
                        <ShieldCheck size={13} aria-hidden="true" />
                        {claim.label || claim.key}
                      </span>
                    ))}

                    {product.certifications?.map((certification, index) => (
                      <span
                        key={`${certification.key}-${index}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-black text-stone-700"
                      >
                        <BadgeCheck
                          size={13}
                          className="text-emerald-700"
                          aria-hidden="true"
                        />
                        {certification.label || certification.key}
                        {certification.certificateReference ? ` · ${certification.certificateReference}` : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="border-l-[3px] border-[#9DB9B0] bg-white/70 px-4 py-3 text-sm leading-6 text-[#566660]">
                    No published claims or certifications are declared for this product.
                  </p>
                )}
              </DetailCard>

              <DetailCard
                title="Allergens"
                icon={ShieldCheck}
                description="Reviewed allergen declaration and governed relationships"
              >
                <div className="space-y-4">
                  {product.allergenStatement ? (
                    <div className="border-l-[3px] border-[#c77b42] bg-[#FFF1DF] px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                          <ShieldCheck size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-black uppercase tracking-[0.12em] text-amber-800">
                            Reviewed package declaration
                          </p>
                          <p className="mt-1.5 text-sm font-bold leading-5 text-stone-900">
                            {product.allergenStatement}
                          </p>
                          <p className="mt-2 text-[13px] leading-4 text-stone-500">
                            A missing positive allergen relationship is not
                            treated as an allergen-free claim.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {product.allergens?.length > 0 ? (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[13px] font-black uppercase tracking-[0.12em] text-stone-400">
                          Published allergen relationships
                        </p>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[13px] font-black text-stone-600">
                          {product.allergens.length} recorded
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {product.allergens.map((allergen, index) => (
                          <div
                            key={`${allergen.allergenKey}-${index}`}
                            className="flex items-center justify-between gap-3 border-b border-[#d6ddd2] bg-[#F8FAF5] px-3 py-3"
                          >
                            <span className="text-sm font-black capitalize text-stone-800">
                              {allergen.allergenKey}
                            </span>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[13px] font-black uppercase tracking-wide text-stone-500 shadow-sm">
                              {allergen.relationType}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="border-l-2 border-[#d0d9cf] bg-[#F9F9F4] px-4 py-3">
                      <p className="text-sm leading-5 text-stone-500">
                        {product.allergenStatement
                          ? "No positive governed allergen relationship is published beyond the reviewed package declaration above."
                          : "Allergen data is currently unknown or not published. EPANTRY does not infer missing safety facts."}
                      </p>
                    </div>
                  )}

                  <div id="product-allergen-intelligence-slot" />
                </div>
              </DetailCard>

              <div id="product-dietary-intelligence-slot" />

              <div id="product-lineage-intelligence-slot" />

              <div id="product-food-intelligence-slot" />
            </div>
          </div>
          <div className="min-w-0 h-full border-t-[3px] border-[#66557B] bg-[#F0EAF7] px-5 pb-6 pt-7 sm:px-8 sm:pb-9 sm:pt-9">
            <p className="text-sm font-semibold text-[#355F4C]">03 / Nutrition</p>
            <h2 className="mt-3 text-[28px] font-medium tracking-[-0.045em] text-[#202421] sm:text-4xl">Nutrition facts</h2>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-b border-[#CDD8CD] pb-5">
              <div><dt className="text-[13px] font-medium text-[#6B776C]">Basis</dt><dd className="mt-1 text-[15px] font-semibold text-[#202421]">{product.nutrition?.basis ? productDetailLabel(product.nutrition.basis) : "Not declared"}</dd></div>
              <div><dt className="text-[13px] font-medium text-[#6B776C]">Serving size</dt><dd className="mt-1 text-[15px] font-semibold text-[#202421]">{product.nutrition?.servingSize ? formatQuantity(product.nutrition.servingSize) : "Not declared"}</dd></div>
            </dl>
            <div className="mt-4">
              {product.nutrition?.nutrients?.length > 0 ? (
                <div className="divide-y divide-stone-200">
                  {product.nutrition.nutrients.map((nutrient, index) => (
                    <div
                      key={`${nutrient.nutrientKey}-${index}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-[12px] sm:gap-4 sm:py-3.5 sm:text-sm"
                    >
                      <span className="font-bold capitalize text-stone-600">
                        {nutrient.nutrientKey}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 font-black text-emerald-950 sm:px-2.5 sm:py-1">
                        {nutrient.amount} {nutrient.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  Nutrition facts are not currently published.
                </p>
              )}

              <div id="product-nutrition-intelligence-slot" className="mt-5" />
            </div>
          </div>
        </section>
        <SponsoredCampaignSlot
          placement="product_detail"
          slotKey="product_recommendations"
          embedded
        />

        <div className="space-y-6">
          {(recommendationsLoading || frequentlyBought.length > 0) && (
          <div className="bg-[#E6F0F4] px-5 py-8 sm:px-9 sm:py-10">
          <ProductRecommendationShelf
            eyebrow="More for your basket"
            title="Frequently bought"
            items={frequentlyBought}
            loading={recommendationsLoading}
            viewAllTo="/grocery"
          />
          </div>
          )}
          {(recommendationsLoading || similarProducts.length > 0) && (
          <div className="bg-[#FBEDD9] px-5 py-8 sm:px-9 sm:py-10">
          <ProductRecommendationShelf
            eyebrow="Same shelf"
            title="Similar products"
            items={similarProducts}
            loading={recommendationsLoading}
            viewAllTo={
              similarCategorySlug
                ? `/grocery/category/${encodeURIComponent(similarCategorySlug)}`
                : "/grocery"
            }
          />
          </div>
          )}
        </div>
      </div>
    </main>
  );
}
