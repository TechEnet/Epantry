import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";

import { Link, useLocation, useParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import { useLocationStore } from "../../location/store/location.store";

import {
  getCommerceErrorMessage,
  getOrder,
} from "../services/commerce.service";

import SponsoredCampaignSlot from "../../retailMedia/components/SponsoredCampaignSlot";
import { getCookingReturnPath } from "../../recipes/utils/cookingJourney";

function formatMoney(amountMinor, currency = "INR") {
  if (amountMinor == null || amountMinor === "" || !Number.isInteger(Number(amountMinor))) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",

    currency,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

function label(value) {
  return String(value || "unknown")
    .split("_")
    .map((token) => `${token.charAt(0).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}

function buildRetailMediaPreviewOrderData() {
  const createdAt = new Date(Date.now() - 35 * 60 * 1000).toISOString();
  const updatedAt = new Date(Date.now() - 8 * 60 * 1000).toISOString();

  return {
    order: {
      id: "retail-media-preview",
      status: "confirmed",
      paymentStatus: "paid",
      paymentProvider: "razorpay",
      createdAt,
      updatedAt,
      totals: {
        itemSubtotalMinor: 124500,
        knownFeesMinor: 4900,
        totalLandedCostMinor: 129400,
        currency: "INR",
      },
      deliveryAddressSnapshot: {
        recipientName: "Customer",
        addressLine1: "Delivery address preview",
        area: "EPANTRY service area",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110001",
        country: "India",
        deliveryInstructions: "Live customer data is hidden in placement preview.",
      },
    },
    sellerOrders: [
      {
        id: "retail-media-preview-seller",
        sellerName: "EPANTRY Host",
        status: "seller_accepted",
        updatedAt,
        items: [
          {
            cartItemId: "retail-media-preview-item-1",
            displayName: "Fresh grocery item",
            packCount: 1,
            packQuantity: 1,
            packUnit: "pack",
          },
          {
            cartItemId: "retail-media-preview-item-2",
            displayName: "Kitchen essential",
            packCount: 2,
            packQuantity: 500,
            packUnit: "g",
          },
        ],
        promise: {
          cancellationPolicySummary:
            "Cancellation terms appear here exactly as they do on the live order page.",
          returnPolicySummary:
            "Return terms appear here exactly as they do on the live order page.",
        },
      },
    ],
    timeline: [
      {
        eventType: "payment_captured",
        occurredAt: createdAt,
      },
      {
        sellerOrderId: "retail-media-preview-seller",
        status: "seller_accepted",
        eventType: "seller_accepted",
        occurredAt: updatedAt,
      },
    ],
    deliveryEta: null,
  };
}

const SELLER_PROGRESS_STEPS = [
  {
    status: "seller_accepted",

    title: "Order accepted",

    description: "The Host accepted your order.",
  },
  {
    status: "picking",

    title: "Picking items",

    description: "The Host is preparing the items in your order.",
  },
  {
    status: "packed",

    title: "Packed",

    description: "Your order has been packed and is ready for dispatch.",
  },
  {
    status: "carrier_handoff",

    title: "Handed to carrier",

    description: "The packed order has been handed over for delivery.",
  },
  {
    status: "out_for_delivery",

    title: "Out for delivery",

    description: "Your order is on the way.",
  },
  {
    status: "delivered",

    title: "Delivered",

    description: "The Host marked this order as delivered.",
  },
];

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
}

function findTimelineEvent({ timeline, sellerOrderId, status, eventType }) {
  return (
    timeline.find((event) => {
      if (
        sellerOrderId &&
        String(event.sellerOrderId || "") !== String(sellerOrderId)
      ) {
        return false;
      }

      if (status && event.toStatus !== status) {
        return false;
      }

      if (eventType && event.eventType !== eventType) {
        return false;
      }

      return true;
    }) || null
  );
}

function paymentIsComplete(paymentStatus) {
  const normalized = String(paymentStatus || "").toLowerCase();

  return (
    normalized.includes("paid") ||
    normalized.includes("captured") ||
    normalized.includes("complete")
  );
}

function formatReceiptMoney(amountMinor, currency = "INR") {
  if (!Number.isInteger(Number(amountMinor))) {
    return "Not available";
  }

  return `${currency || "INR"} ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100)}`;
}

function asciiReceiptText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value) {
  return asciiReceiptText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapReceiptText(value, maxLength = 72) {
  const words = asciiReceiptText(value).trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);

      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildReceiptPdf({ order, sellerOrders, customerName }) {
  const encoder = new TextEncoder();

  const createdAt = order.createdAt ? new Date(order.createdAt) : null;

  const orderDate =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString()
      : "Not available";

  const orderTime =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleTimeString()
      : "Not available";

  const hostNames =
    Array.from(
      new Set(
        sellerOrders
          .map((sellerOrder) => sellerOrder.sellerName)
          .filter(Boolean)
      )
    ).join(", ") || "Not available";

  const totalMinor = Number.isInteger(
    Number(order.totals?.totalLandedCostMinor)
  )
    ? order.totals?.totalLandedCostMinor
    : order.totals?.itemSubtotalMinor;

  const details = [
    ["Order ID", order.id || "Not available"],
    ["Ordered by", customerName || "Customer"],
    ["Order date", orderDate],
    ["Order time", orderTime],
    ["Payment amount", formatReceiptMoney(totalMinor, order.totals?.currency)],
    [
      "Payment gateway / application",
      order.paymentProvider ? label(order.paymentProvider) : "Not recorded",
    ],
    ["Payment status", label(order.paymentStatus)],
    ["Order status", label(order.status)],
    ["Host / Seller", hostNames],
    [
      "Items subtotal",
      formatReceiptMoney(
        order.totals?.itemSubtotalMinor,
        order.totals?.currency
      ),
    ],
    [
      "Known fees",
      formatReceiptMoney(order.totals?.knownFeesMinor, order.totals?.currency),
    ],
    ["Total paid", formatReceiptMoney(totalMinor, order.totals?.currency)],
  ];

  sellerOrders.forEach((sellerOrder, index) => {
    details.push([
      `Seller ${index + 1}`,
      `${sellerOrder.sellerName || "Host"} - ${label(sellerOrder.status)}`,
    ]);
  });

  let y = 730;

  const stream = [
    "0.02 0.45 0.31 rg",
    "40 755 515 55 re f",
    "1 1 1 rg",
    "BT",
    "/F2 19 Tf",
    "1 0 0 1 55 787 Tm",
    "(EPANTRY ORDER RECEIPT) Tj",
    "ET",
    "0.12 0.12 0.12 rg",
  ];

  details.forEach(([key, value]) => {
    stream.push(
      "BT",
      "/F2 10 Tf",
      `1 0 0 1 55 ${y} Tm`,
      `(${escapePdfText(key)}) Tj`,
      "ET"
    );

    const valueLines = wrapReceiptText(value, 58);

    valueLines.forEach((line, lineIndex) => {
      stream.push(
        "BT",
        "/F1 10 Tf",
        `1 0 0 1 220 ${y - lineIndex * 14} Tm`,
        `(${escapePdfText(line)}) Tj`,
        "ET"
      );
    });

    y -= Math.max(24, valueLines.length * 14 + 10);
  });

  stream.push(
    "0.83 0.83 0.80 RG",
    `50 ${Math.max(70, y - 2)} m 545 ${Math.max(70, y - 2)} l S`,
    "0.35 0.35 0.35 rg",
    "BT",
    "/F1 9 Tf",
    `1 0 0 1 55 ${Math.max(50, y - 24)} Tm`,
    "(Generated by EPANTRY from the current order record.) Tj",
    "ET"
  );

  const content = `${stream.join("\n")}\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${
      encoder.encode(content).length
    } >>\nstream\n${content}endstream`,
  ];

  let pdf = "%PDF-1.4\n";

  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);

    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = encoder.encode(pdf).length;

  pdf += `xref\n0 ${objects.length + 1}\n`;

  pdf += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return encoder.encode(pdf);
}

function downloadOrderReceipt({ order, sellerOrders, customerName }) {
  const pdfBytes = buildReceiptPdf({
    order,
    sellerOrders,
    customerName,
  });

  const blob = new Blob([pdfBytes], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download = `EPANTRY-Order-${String(order.id || "receipt")
    .slice(-8)
    .toUpperCase()}-Receipt.pdf`;

  document.body.appendChild(anchor);

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function DeliveryTruckAnimation() {
  return (
    <div
      className="od-delivery-truck relative h-[166px] w-full max-w-full shrink-0 overflow-hidden rounded-[16px] border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 shadow-[0_14px_34px_rgba(67,56,202,0.10)] sm:h-[180px] sm:w-[310px] sm:rounded-[22px]"
      aria-label="Delivery vehicle animation"
      role="img"
    >
      <style>{`
        @keyframes epantryTruckBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes epantryTruckRoad {
          from { background-position-x: 0; }
          to { background-position-x: -90px; }
        }

        @keyframes epantryTruckPost {
          from { transform: translateX(80px); }
          to { transform: translateX(-390px); }
        }

        @keyframes epantryTruckLight {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .epantry-delivery-motion,
          .epantry-delivery-wheel,
          .epantry-delivery-road,
          .epantry-delivery-post,
          .epantry-delivery-light {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative z-20 flex min-w-0 items-start justify-between gap-2 px-3 pt-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-700">
            Live delivery
          </p>
          <p className="mt-1 text-xs font-black leading-4 text-stone-900">
            Your order is on the way
          </p>
        </div>

        <span className="shrink-0 rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
          Moving
        </span>
      </div>

      <div
        className="epantry-delivery-post absolute bottom-[31px] right-[-34px] h-20 w-1 bg-stone-700/70"
        style={{
          animation: "epantryTruckPost 2.9s linear infinite",
        }}
        aria-hidden="true"
      >
        <div className="absolute -left-2 -top-2 h-4 w-5 rounded-t-sm bg-stone-700/70" />
      </div>

      <div
        className="epantry-delivery-motion absolute bottom-[25px] left-2 h-[86px] w-[228px] origin-bottom-left scale-[0.82] sm:bottom-[31px] sm:left-7 sm:scale-100"
        style={{
          animation: "epantryTruckBounce .42s ease-in-out infinite",
        }}
        aria-hidden="true"
      >
        <div className="absolute bottom-5 left-0 h-[70px] w-[145px] rounded-t-md border-t-4 border-stone-400 bg-stone-300 shadow-sm">
          <div className="absolute left-2 top-2 h-3 w-[130px] rounded-sm bg-stone-100 shadow-[0_18px_0_#f5f5f4,0_36px_0_#f5f5f4]" />
          <div className="absolute bottom-0 left-0 h-3 w-full bg-slate-800" />
          <div className="absolute bottom-0 left-1 h-1.5 w-[128px] bg-[repeating-linear-gradient(90deg,#ef4444_0_8px,#fff_8px_16px)]" />
        </div>

        <div
          className="absolute bottom-5 left-[145px] h-[58px] w-[66px] bg-stone-200 shadow-sm"
          style={{
            clipPath: "polygon(0 0, 48% 0, 100% 58%, 100% 100%, 0 100%)",
          }}
        >
          <div
            className="absolute left-3 top-3 h-7 w-9 border-2 border-stone-400 bg-sky-300"
            style={{
              clipPath: "polygon(0 0, 42% 0, 100% 100%, 0 100%)",
            }}
          />
          <div className="absolute bottom-3 left-2 h-1.5 w-3 rounded bg-stone-700" />
        </div>

        <div
          className="epantry-delivery-light absolute bottom-5 left-[204px] h-4 w-2 rounded-r bg-sky-200 shadow-[inset_0_-6px_rgba(185,28,28,.7)]"
          style={{
            animation: "epantryTruckLight 1.5s ease-in-out infinite",
          }}
        />

        <div className="epantry-delivery-wheel absolute bottom-0 left-7 h-10 w-10 rounded-full border-[8px] border-stone-950 bg-stone-300 shadow-[0_0_0_3px_#57534e] animate-spin">
          <div className="absolute inset-[7px] rounded-full bg-stone-600" />
        </div>

        <div className="epantry-delivery-wheel absolute bottom-0 left-[163px] h-10 w-10 rounded-full border-[8px] border-stone-950 bg-stone-300 shadow-[0_0_0_3px_#57534e] animate-spin">
          <div className="absolute inset-[7px] rounded-full bg-stone-600" />
        </div>
      </div>

      <div
        className="epantry-delivery-road absolute bottom-[22px] left-0 h-[3px] w-full opacity-70 sm:bottom-[27px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #292524 0 52px, transparent 52px 86px)",
          animation: "epantryTruckRoad 1.1s linear infinite",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function getOrderDisplayTitle(sellerOrders = []) {
  const itemNames = sellerOrders.flatMap((sellerOrder) =>
    (sellerOrder?.items || [])
      .map((item) => String(item?.displayName || "").trim())
      .filter(Boolean)
  );

  if (!itemNames.length) {
    return "EPANTRY order";
  }

  return itemNames.length > 1
    ? `${itemNames[0]} + ${itemNames.length - 1} more`
    : itemNames[0];
}

function formatDeliveryAddress(address) {
  if (!address) {
    return "";
  }

  return [
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function sellerProblemCopy(status) {
  const normalized = String(status || "").toLowerCase();

  const messages = {
    rejected:
      "This Host could not accept this part of your order. Review the affected items below.",

    partial_unavailable:
      "Some items in this Host delivery are unavailable and need your attention.",

    seller_cancelled:
      "This Host cancelled their delivery. The affected items stay visible below for clarity.",

    delivery_failed:
      "The delivery attempt was not completed. Check the latest status before planning around these items.",
  };

  return messages[normalized] || "";
}

function sellerItemQuantity(item) {
  const parts = [];

  if (Number(item?.packCount || 0) > 0) {
    parts.push(
      `${item.packCount} pack${Number(item.packCount) === 1 ? "" : "s"}`
    );
  }

  if (Number(item?.packQuantity || 0) > 0 && item?.packUnit) {
    parts.push(`${item.packQuantity} ${item.packUnit} each`);
  }

  return parts.join(" · ");
}

function getOrderItemImage(item) {
  const candidates = [
    item?.imageUrl,
    item?.thumbnailUrl,
    item?.photoUrl,
    typeof item?.image === "string" ? item.image : item?.image?.url,
    Array.isArray(item?.images) ? item.images[0]?.url || item.images[0] : "",
    Array.isArray(item?.photos) ? item.photos[0]?.url || item.photos[0] : "",
    Array.isArray(item?.media) ? item.media[0]?.url || item.media[0] : "",
  ];

  return (
    candidates.find(
      (url) =>
        typeof url === "string" &&
        (/^https?:\/\//i.test(url) || url.startsWith("/"))
    ) || ""
  );
}

function OrderStatus({ value, prefix = "" }) {
  const state = String(value || "").toLowerCase();
  const tone = /cancel|fail|reject|unavailable|refund/.test(state) ? "error"
    : /^(paid|confirmed|captured|completed|complete|delivered)$/.test(state) ? "success" : "neutral";
  return <span className="od4-status" data-tone={tone}>{tone === "success" && <CheckCircle2 size={15} aria-hidden="true" />}{prefix}{label(value)}</span>;
}

function OrderItemPhoto({ item }) {
  const photo = getOrderItemImage(item);
  const [failedPhoto, setFailedPhoto] = useState("");
  return <div className="od4-photo">
    {photo && failedPhoto !== photo ? <img src={photo} alt={item.displayName || "Order item"} loading="lazy" onError={() => setFailedPhoto(photo)} /> : <PackageCheck size={25} aria-label="Product image unavailable" />}
  </div>;
}

function SellerJourneyTimeline({ order, timeline, sellerOrder, sellerIndex }) {
  const paymentEvent =
    timeline.find(
      (event) =>
        event.eventType === "payment_captured" ||
        String(event.eventType || "").includes("payment_captured")
    ) || null;

  const paymentComplete = paymentIsComplete(order.paymentStatus);
  const currentIndex = SELLER_PROGRESS_STEPS.findIndex(
    (step) => step.status === sellerOrder.status
  );
  const journeySteps = [
    {
      key: "order_placed",
      title: "Order placed",
      description: "Your order was received by EPANTRY.",
      completed: true,
      current: !paymentComplete,
      occurredAt: order.createdAt,
    },
    {
      key: "payment_confirmed",
      title: "Payment confirmed",
      description: paymentComplete
        ? "Payment was successfully verified."
        : "Waiting for payment confirmation.",
      completed: paymentComplete,
      current:
        paymentComplete &&
        (!sellerOrder.status || sellerOrder.status === "confirmed"),
      occurredAt: paymentComplete
        ? paymentEvent?.occurredAt || order.updatedAt
        : null,
    },
    ...SELLER_PROGRESS_STEPS.map((step, stepIndex) => {
      const event = findTimelineEvent({
        timeline,
        sellerOrderId: sellerOrder.id,
        status: step.status,
      });
      const completed =
        Boolean(event) || (currentIndex >= 0 && stepIndex <= currentIndex);

      return {
        ...step,
        key: step.status,
        completed,
        current: sellerOrder.status === step.status,
        occurredAt: completed
          ? event?.occurredAt ||
            (sellerOrder.status === step.status ? sellerOrder.updatedAt : null)
          : null,
      };
    }),
  ];
  const confirmedCount = journeySteps.filter((step) => step.completed).length;
  const currentStep = journeySteps.find((step) => step.current);
  const mostRecentCompleted = [...journeySteps]
    .reverse()
    .find((step) => step.completed);
  const highlightedStep = currentStep || mostRecentCompleted;

  const sellerName = sellerOrder.sellerName || `Host ${sellerIndex + 1}`;

  return (
    <article className="od4-tracking" aria-label={`Tracking for ${sellerName}`}>
      <div className="od4-track-top">
        <div className="od4-track-stage">
          <div className="od4-kicker">{sellerName} · Delivery {sellerIndex + 1}</div>
          <h3>{highlightedStep?.title || "Tracking updates pending"}</h3>
          <p>{highlightedStep?.description || "Updates will appear when available."}</p>
          {highlightedStep?.occurredAt && <time>{formatTimestamp(highlightedStep.occurredAt)}</time>}
        </div>
        <div className="od4-progress">
          <div><span>Delivery progress</span><strong>{confirmedCount}/{journeySteps.length}</strong></div>
          <div className="od4-progress-track" role="progressbar" aria-label={`Completed milestones for ${sellerName}`} aria-valuemin={0} aria-valuemax={journeySteps.length} aria-valuenow={confirmedCount}>
            <div style={{ width: `${confirmedCount / journeySteps.length * 100}%` }} />
          </div>
          <OrderStatus value={sellerOrder.status} />
        </div>
      </div>
      {journeySteps.some(step => step.current && step.key === "out_for_delivery") && (
        <div className="od4-truck"><DeliveryTruckAnimation /></div>
      )}
      <ol className="od4-milestones" aria-label={`Milestones for ${sellerName}`}>
        {journeySteps.map((step, index) => (
          <li key={step.key} className={`od4-milestone ${step.current ? "is-current" : step.completed ? "is-done" : "is-upcoming"}`} aria-current={step.current ? "step" : undefined}>
            <div className="od4-step-mark" aria-hidden="true">{step.completed && !step.current ? <CheckCircle2 size={18} /> : String(index + 1).padStart(2, "0")}</div>
            <div className="od4-step-copy"><strong>{step.title}</strong><p>{step.description}</p></div>
            <div className="od4-step-meta"><span>{step.current ? "Current" : step.completed ? "Completed" : "Upcoming"}</span>{step.occurredAt && <time>{formatTimestamp(step.occurredAt)}</time>}</div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function getRemainingEtaMinutes(eta, nowMs) {
  if (!eta?.available) {
    return null;
  }

  const arrivalAtMs = Date.parse(eta.estimatedArrivalAt || "");

  if (Number.isFinite(arrivalAtMs)) {
    return Math.max(
      0,
      Math.ceil((arrivalAtMs - nowMs) / 60000)
    );
  }

  return Number.isFinite(Number(eta.estimatedDeliveryMinutes))
    ? Math.max(0, Math.ceil(Number(eta.estimatedDeliveryMinutes)))
    : null;
}

function formatEtaDistance(value) {
  const distance = Number(value);

  return Number.isFinite(distance) && distance >= 0
    ? `${distance.toFixed(distance >= 10 ? 0 : 1)} km approx.`
    : "Distance estimate unavailable";
}

export default function OrderDetailPage() {
  const { orderId } = useParams();

  const location = useLocation();

  const retailMediaPreview =
    typeof window !== "undefined" &&
    window.self !== window.top &&
    new URLSearchParams(location.search).get("retailMediaPreview") === "1";

  const { currentUser } = useAuth();

  const setDeliveryContext = useLocationStore(
    (state) => state.setDeliveryContext
  );

  const [nowMs, setNowMs] = useState(() => Date.now());

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const load = useCallback(
    async ({ refresh = false } = {}) => {
      if (!orderId) {
        setError("Order ID is missing.");

        setLoading(false);

        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        if (retailMediaPreview) {
          setData(buildRetailMediaPreviewOrderData());
        } else {
          setData(await getOrder(orderId));
        }
      } catch (loadError) {
        setError(
          getCommerceErrorMessage(loadError, "Unable to load Order detail.")
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [orderId, retailMediaPreview]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.deliveryEta?.available) {
      return undefined;
    }

    setNowMs(Date.now());

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [data?.deliveryEta?.available, data?.deliveryEta?.estimatedArrivalAt]);

  useEffect(() => {
    if (retailMediaPreview) {
      return;
    }

    const eta = data?.deliveryEta;

    if (!eta?.available) {
      return;
    }

    setDeliveryContext({
      city: eta.destination?.city || "",
      state: eta.destination?.state || "",
      country: eta.destination?.country || "India",
      label:
        eta.destination?.label ||
        (eta.destination?.postalCode
          ? `PIN ${eta.destination.postalCode}`
          : "Delivery destination"),
      estimatedDeliveryMinutes: Number(eta.estimatedDeliveryMinutes),
      estimatedArrivalAt: eta.estimatedArrivalAt || "",
      estimatedRoadDistanceKm: Number(eta.estimatedRoadDistanceKm),
      averageSpeedKmh: Number(eta.averageSpeedKmh),
      targetPath: `/orders/${encodeURIComponent(String(orderId))}`,
      calculationMethod: eta.calculationMethod || "",
    });
  }, [
    data?.deliveryEta,
    orderId,
    retailMediaPreview,
    setDeliveryContext,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-8">
          <div className="h-[600px] animate-pulse rounded-[30px] border border-emerald-100 bg-white" />
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-10">
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-7 text-rose-900 shadow-sm">
            <h1 className="font-black">Order unavailable</h1>

            <p className="mt-2 text-sm">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const order = data?.order || {};

  const sellerOrders = data?.sellerOrders || [];

  const timeline = data?.timeline || [];
  const deliveryEta = data?.deliveryEta || null;
  const remainingEtaMinutes = getRemainingEtaMinutes(deliveryEta, nowMs);
  const orderDisplayTitle = getOrderDisplayTitle(sellerOrders);
  const cookingPath = getCookingReturnPath({ orderId });
  const totalItems = sellerOrders.reduce((total, seller) => total + (seller.items || []).length, 0);
  const address = order.deliveryAddressSnapshot;
  const currency = order.totals?.currency;

  return (
    <main className="od4-page">
      <style>{`
        .od4-page {--od-clay:#C56C42;--od-forest:#173F35;--od-ink:#202421;--od-sage:#D7DDCF;--od-paper:#F7F6F2;--od-line:#D7DDCF; color:var(--od-ink);background:var(--od-paper);width:100%;min-width:0;}
        .od4-page * {box-sizing:border-box;}
        .od4-page .od4-content {width:100%;max-width:1500px;margin:0 auto;padding:14px 28px 36px;}
        .od4-page :is(h1,h2,h3,p,ol,dl,dd) {margin:0;}
        .od4-page h1 {font-size:clamp(25px,2.3vw,34px)!important;line-height:1.17!important;font-weight:750!important;letter-spacing:-.035em!important;color:var(--od-ink)!important;overflow-wrap:anywhere;}
        .od4-page h2 {font-size:24px!important;line-height:1.25!important;letter-spacing:-.025em!important;font-weight:750!important;color:var(--od-ink)!important;}
        .od4-page h3 {font-size:18px!important;line-height:1.35!important;font-weight:700!important;color:var(--od-ink)!important;overflow-wrap:anywhere;}
        .od4-page p,.od4-page time {font-size:14px;line-height:1.5;overflow-wrap:anywhere;}
        .od4-page .od4-toolbar {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px;}
        .od4-page .od4-toolbar a {display:inline-flex;align-items:center;gap:7px;color:var(--od-forest)!important;font-size:14px;font-weight:700;text-decoration:none;}
        .od4-page .od4-toolbar time {color:#4A5B52!important;}
        .od4-page .od4-hero {display:flex;align-items:center;justify-content:space-between;gap:20px;background:var(--od-clay)!important;color:var(--od-ink)!important;border-radius:14px;padding:20px 24px;}
        .od4-page .od4-hero-main {min-width:0;display:grid;gap:7px;}
        .od4-page .od4-hero .od4-kicker {color:#141815!important;}
        .od4-page .od4-kicker {font-size:13px;font-weight:700;line-height:1.4;color:inherit;overflow-wrap:anywhere;}
        .od4-page .od4-statuses {display:flex;flex-wrap:wrap;align-items:center;gap:7px;}
        .od4-page .od4-status {display:inline-flex;align-items:center;gap:5px;border:1px solid #B8C5B6!important;background:var(--od-paper)!important;color:var(--od-forest)!important;border-radius:6px;padding:4px 9px;font-size:13px!important;font-weight:700!important;line-height:1.4!important;white-space:normal;overflow-wrap:anywhere;}
        .od4-page .od4-status[data-tone="success"] {background:#E5F1E6!important;color:#173F35!important;border-color:#ADC6AE!important;}
        .od4-page .od4-status[data-tone="error"] {background:#FBE7E3!important;color:#8A2D25!important;border-color:#E8BCB4!important;}
        .od4-page .od4-actions {display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0;}
        .od4-page button.od4-button {display:inline-flex;justify-content:center;align-items:center;gap:7px;min-height:42px;padding:9px 13px;border:1px solid var(--od-forest)!important;border-radius:8px;font-size:14px!important;font-weight:700!important;line-height:1.35!important;background:var(--od-forest)!important;color:var(--od-paper)!important;cursor:pointer;}
        .od4-page button.od4-button.secondary {background:var(--od-paper)!important;color:var(--od-forest)!important;border-color:var(--od-paper)!important;}
        .od4-page button.od4-button:disabled {opacity:.6;cursor:wait;}
        .od4-page :is(button,a):focus-visible {outline:2px solid var(--od-forest);outline-offset:3px;}
        .od4-page .od4-grid {display:grid;grid-template-columns:minmax(0,1fr) minmax(250px,32%);gap:24px;align-items:start;margin-top:24px;}
        .od4-page .od4-grid > * {min-width:0;}
        .od4-page .od4-section-head {display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:2px solid var(--od-clay);padding:0 0 12px;margin:0 0 14px;}
        .od4-page .od4-section-head > span {font-size:14px;color:var(--od-forest)!important;flex-shrink:0;}
        .od4-page .od4-seller {border-bottom:1px solid var(--od-line);margin-bottom:16px;}
        .od4-page .od4-seller-head {background:var(--od-sage)!important;padding:12px 15px;border-radius:9px 9px 0 0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
        .od4-page .od4-seller-name {display:flex;gap:9px;align-items:center;min-width:0;}
        .od4-page .od4-item {display:grid;grid-template-columns:76px minmax(0,1fr) auto;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--od-line);min-width:0;}
        .od4-page .od4-photo {width:76px;height:76px;display:grid;place-items:center;background:#fff!important;border:1px solid var(--od-line);border-radius:9px;overflow:hidden;color:var(--od-forest)!important;}
        .od4-page .od4-photo img {width:100%;height:100%;object-fit:contain;display:block;}
        .od4-page .od4-item strong {display:block;font-size:16px;line-height:1.45;color:var(--od-ink)!important;overflow-wrap:anywhere;}
        .od4-page .od4-item p {margin-top:4px;color:#4A5B52!important;}
        .od4-page .od4-price {font-size:16px;font-weight:750;color:var(--od-forest)!important;white-space:nowrap;}
        .od4-page .od4-policy {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px;padding:13px 0 16px;}
        .od4-page .od4-policy strong {display:flex;align-items:center;gap:6px;font-size:14px;color:var(--od-forest)!important;}
        .od4-page .od4-policy p {margin-top:5px;color:#48544B!important;}
        .od4-page .od4-side {display:grid;gap:16px;}
        .od4-page .od4-payment {border:1px solid var(--od-line);border-radius:12px;overflow:hidden;background:#fff!important;}
        .od4-page .od4-payment-top {background:var(--od-clay)!important;color:var(--od-ink)!important;padding:16px 19px;}
        .od4-page .od4-payment-top > p {display:flex;align-items:center;gap:7px;font-weight:700;color:#141815!important;}
        .od4-page .od4-total {display:block;font-size:clamp(27px,2.4vw,36px)!important;line-height:1.15;font-weight:800;color:var(--od-ink)!important;margin-top:6px;overflow-wrap:anywhere;}
        .od4-page .od4-payment dl {padding:14px 19px;display:grid;gap:9px;}
        .od4-page .od4-payment dl > div {display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:14px;color:var(--od-ink)!important;}
        .od4-page .od4-payment dd {font-weight:700;text-align:right;overflow-wrap:anywhere;}
        .od4-page .od4-address {background:var(--od-sage)!important;padding:17px 19px;border-radius:12px;color:var(--od-ink)!important;}
        .od4-page .od4-address h2 {display:flex;align-items:center;gap:8px;font-size:19px!important;}
        .od4-page .od4-address p {margin-top:7px;color:var(--od-ink)!important;}
        .od4-page .od4-address .od4-eta {border-top:1px solid #B8C5B6;margin-top:12px;padding-top:10px;}
        .od4-page .od4-journey {margin-top:30px;}
        .od4-page .od4-tracking {border:1px solid var(--od-line);border-radius:12px;overflow:hidden;margin-bottom:16px;}
        .od4-page .od4-track-top {display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,30%);align-items:center;gap:18px;background:var(--od-sage)!important;padding:16px 20px;color:var(--od-ink)!important;}
        .od4-page .od4-track-stage h3 {margin:4px 0;font-size:22px!important;}
        .od4-page .od4-track-stage time {display:block;margin-top:3px;color:#4A5B52!important;}
        .od4-page .od4-progress > div:first-child {display:flex;justify-content:space-between;gap:8px;font-size:14px;}
        .od4-page .od4-progress-track {height:7px;background:#B6C4B5!important;border-radius:9px;overflow:hidden;margin:9px 0;}
        .od4-page .od4-progress-track > div {height:100%;background:var(--od-forest)!important;transition:width .3s;}
        .od4-page .od4-truck {padding:14px 20px;}
        .od4-page .od4-milestones {list-style:none;padding:4px 20px 8px;}
        .od4-page .od4-milestone {display:grid;grid-template-columns:34px minmax(0,1fr) minmax(110px,auto);gap:12px;align-items:start;padding:10px 8px;position:relative;border-bottom:1px solid var(--od-line);}
        .od4-page .od4-milestone:last-child {border-bottom:0;}
        .od4-page .od4-milestone.is-current {background:#F2E1D7!important;border-radius:7px;}
        .od4-page .od4-step-mark {position:relative;width:34px;height:34px;border:1px solid #A8B5A7;border-radius:50%;display:grid;place-items:center;color:var(--od-forest)!important;background:var(--od-paper)!important;font-size:13px;font-weight:700;}
        .od4-page .is-done .od4-step-mark {background:var(--od-forest)!important;color:var(--od-paper)!important;border-color:var(--od-forest);}
        .od4-page .is-current .od4-step-mark {background:var(--od-clay)!important;color:#141815!important;border-color:var(--od-clay);}
        .od4-page .od4-step-copy strong {font-size:15px;color:var(--od-ink)!important;line-height:1.4;}
        .od4-page .od4-step-copy p {font-size:14px;color:#4A5B52!important;}
        .od4-page .od4-step-meta {display:grid;text-align:right;gap:3px;font-size:13px;font-weight:700;color:var(--od-forest)!important;}
        .od4-page .od4-step-meta time {font-size:13px;font-weight:400;color:#4A5B52!important;}
        .od4-page .od4-empty {padding:15px 0;color:#4A5B52!important;}
        .od4-page .od4-alert {border-left:3px solid #A33C32;background:#FBE7E3!important;color:#862F26!important;padding:12px 15px;margin:12px 0;}
        @media(max-width:1100px) {.od4-page .od4-hero {align-items:flex-start;flex-direction:column;gap:12px;} .od4-page .od4-grid {grid-template-columns:minmax(0,1fr) minmax(225px,33%);gap:16px;} }
        @media(max-width:850px) {.od4-page .od4-grid {grid-template-columns:minmax(0,1fr);} .od4-page .od4-side {grid-template-columns:repeat(2,minmax(0,1fr));align-items:start;} }
        @media(max-width:639px) {.od4-page {width:calc(100% + var(--ep-content-gutter,16px) + var(--ep-content-gutter,16px) - 2px);max-width:none;margin-inline:calc(0px - var(--ep-content-gutter,16px));overflow-x:clip;} .od4-page .od4-content {padding:12px 12px 25px;} .od4-page .od4-hero {padding:15px;gap:12px;} .od4-page h1 {font-size:25px!important;} .od4-page h2 {font-size:21px!important;} .od4-page .od4-actions {width:100%;display:grid;grid-template-columns:1fr 1fr;} .od4-page button.od4-button {padding:8px;font-size:13px!important;min-width:0;} .od4-page .od4-grid {margin-top:20px;} .od4-page .od4-side {grid-template-columns:minmax(0,1fr);} .od4-page .od4-item {grid-template-columns:60px minmax(0,1fr);gap:7px 11px;} .od4-page .od4-photo {height:60px;width:60px;grid-row:span 2;} .od4-page .od4-price {grid-column:2;white-space:normal;} .od4-page .od4-policy {grid-template-columns:1fr;gap:12px;} .od4-page .od4-track-top {grid-template-columns:1fr;gap:12px;padding:14px;} .od4-page .od4-milestones {padding:3px 8px;} .od4-page .od4-milestone {grid-template-columns:30px minmax(0,1fr);gap:4px 10px;padding:10px 6px;} .od4-page .od4-step-mark {width:30px;height:30px;grid-row:span 2;} .od4-page .od4-step-meta {grid-column:2;text-align:left;display:flex;flex-wrap:wrap;gap:6px 10px;} .od4-page .od4-journey {margin-top:24px;} }
        @media(prefers-reduced-motion:reduce) {.od4-page .od4-progress-track > div {transition:none;}}
      `}</style>
      <div className="od4-content">
        <div className="od4-toolbar">
          <Link to="/orders"><ArrowLeft size={17} aria-hidden="true" /> Back to orders</Link>
          {cookingPath && <Link to={cookingPath}>Continue guided cooking</Link>}
          {order.createdAt && <time>{`Placed ${formatTimestamp(order.createdAt)}`}</time>}
        </div>
        <header className="od4-hero" aria-labelledby="od-title">
          <div className="od4-hero-main">
            <div className="od4-kicker">Your order</div>
            <h1 id="od-title">{orderDisplayTitle}</h1>
            <div className="od4-statuses"><OrderStatus value={order.status} /><OrderStatus prefix="Payment " value={order.paymentStatus} /></div>
          </div>
          <div className="od4-actions">
            <button type="button" className="od4-button secondary" onClick={() => downloadOrderReceipt({ order, sellerOrders, customerName: currentUser?.name || "Customer" })}><Download size={16} aria-hidden="true" /> Receipt</button>
            <button type="button" className="od4-button" onClick={() => load({ refresh: true })} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" /> {refreshing ? "Refreshing..." : "Refresh order"}</button>
          </div>
        </header>
        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_summary" embedded />
        {error && <p role="alert" className="od4-alert">{error}</p>}
        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_items" embedded />
        <div className="od4-grid">
          <section aria-labelledby="od-host-heading">
            <header className="od4-section-head"><h2 id="od-host-heading">Items ordered</h2><span>{totalItems} {totalItems === 1 ? "item" : "items"}</span></header>
            {!sellerOrders.length && <p className="od4-empty">Delivery details are not available yet.</p>}
            {sellerOrders.map((sellerOrder, sellerIndex) => (
              <article className="od4-seller" key={sellerOrder.id || sellerIndex} aria-label={`Delivery from ${sellerOrder.sellerName || "Host"}`}>
                <header className="od4-seller-head"><div className="od4-seller-name"><Store size={20} aria-hidden="true" /><h3>{sellerOrder.sellerName || "EPANTRY Host"}</h3></div><OrderStatus value={sellerOrder.status} /></header>
                {sellerProblemCopy(sellerOrder.status) && <div role="status" className="od4-alert"><strong>Delivery needs attention</strong><p>{sellerProblemCopy(sellerOrder.status)}</p></div>}
                {!(sellerOrder.items || []).length && <p className="od4-empty">No items are available for this delivery yet.</p>}
                {(sellerOrder.items || []).map((item, index) => (
                  <div className="od4-item" key={item.cartItemId || item.offerId || index}>
                    <OrderItemPhoto item={item} />
                    <div><strong>{item.displayName || "Marketplace item"}</strong>{sellerItemQuantity(item) && <p>{sellerItemQuantity(item)}</p>}</div>
                    {item.lineTotal?.amountMinor != null && <span className="od4-price">{formatMoney(item.lineTotal.amountMinor, item.lineTotal.currency || currency)}</span>}
                  </div>
                ))}
                <div className="od4-policy">
                  <div><strong><ShieldCheck size={16} aria-hidden="true" /> Cancellation</strong><p>{sellerOrder.promise?.cancellationPolicySummary || "Not captured"}</p></div>
                  <div><strong><RotateCcw size={16} aria-hidden="true" /> Returns</strong><p>{sellerOrder.promise?.returnPolicySummary || "Not captured"}</p></div>
                </div>
              </article>
            ))}
          </section>
          <aside className="od4-side" aria-label="Order summary">
            <section className="od4-payment" aria-label="Payment summary">
              <div className="od4-payment-top"><p><WalletCards size={18} aria-hidden="true" />{paymentIsComplete(order.paymentStatus) ? "Total paid" : "Total payable"}</p><strong className="od4-total">{formatMoney(order.totals?.totalLandedCostMinor, currency)}</strong></div>
              <dl><div><dt>Items subtotal</dt><dd>{formatMoney(order.totals?.itemSubtotalMinor, currency)}</dd></div><div><dt>Known fees</dt><dd>{formatMoney(order.totals?.knownFeesMinor, currency)}</dd></div><div><dt>Deliveries</dt><dd>{sellerOrders.length}</dd></div></dl>
            </section>
            {address && <section className="od4-address" aria-labelledby="od-delivery"><h2 id="od-delivery"><MapPin size={19} aria-hidden="true" /> Delivery address</h2><p><strong>{address.recipientName || "Recipient"}</strong>{address.phone ? ` · ${address.phone}` : ""}</p><p>{formatDeliveryAddress(address)}</p>{address.deliveryInstructions && <p>Delivery note: {address.deliveryInstructions}</p>}{deliveryEta?.available && <div className="od4-eta"><p><strong>Approx. delivery: {Number.isFinite(remainingEtaMinutes) ? remainingEtaMinutes <= 0 ? "Arriving now" : `~${remainingEtaMinutes} min` : `~${deliveryEta.estimatedDeliveryMinutes} min`}</strong></p><p>{formatEtaDistance(deliveryEta.estimatedRoadDistanceKm)}</p></div>}</section>}
          </aside>
        </div>
        <section className="od4-journey" aria-labelledby="od-journey-heading">
          <header className="od4-section-head"><h2 id="od-journey-heading">Track delivery</h2><span>{sellerOrders.length} {sellerOrders.length === 1 ? "delivery" : "deliveries"}</span></header>
          {!sellerOrders.length && <p className="od4-empty">Tracking updates will appear when a delivery is available.</p>}
          {sellerOrders.map((sellerOrder, sellerIndex) => <SellerJourneyTimeline key={sellerOrder.id || sellerIndex} order={order} timeline={timeline} sellerOrder={sellerOrder} sellerIndex={sellerIndex} />)}
        </section>
        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_follow_up" embedded />
      </div>
    </main>
  );
}
