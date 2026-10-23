import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
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

function formatMoney(amountMinor, currency = "INR") {
  if (!Number.isInteger(Number(amountMinor))) {
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

function statusClass(value) {
  const normalized = String(value || "").toLowerCase();

  if (
    normalized.includes("confirm") ||
    normalized.includes("paid") ||
    normalized.includes("captured") ||
    normalized.includes("complete")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (normalized.includes("pending") || normalized.includes("ready")) {
    return "border-violet-200 bg-violet-50 text-violet-800";
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("unavailable")
  ) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-stone-200 bg-stone-100 text-stone-700";
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

  return (
    <article
      className="border-b border-[#D2D7CC] last:border-b-0"
      aria-label={`Tracking for ${sellerOrder.sellerName || "EPANTRY Host"}`}
    >
      <div className="grid min-w-0 lg:grid-cols-[minmax(235px,0.34fr)_minmax(0,0.66fr)]">
        {/* A single, readable summary instead of repeated milestone cards. */}
        <div className="od-timeline-summary relative flex min-w-0 flex-col justify-between overflow-hidden bg-[#173F35] px-5 py-7 text-[#F7F6F2] sm:px-8 sm:py-9 lg:px-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-[#F7F6F2]/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-9 h-36 w-36 rounded-full border border-[#F7F6F2]/10" />

          <div className="relative min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#E6B59E]">
              Delivery {String(sellerIndex + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 break-words text-[1.45rem] font-semibold leading-tight tracking-[-0.025em] sm:text-[1.7rem]">
              {sellerOrder.sellerName || "EPANTRY Host"}
            </h3>
            <span className={`mt-4 inline-flex max-w-full rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(sellerOrder.status)}`}>
              {label(sellerOrder.status)}
            </span>
          </div>

          <div className="od-current-stage relative mt-7 border-l-[3px] border-[#C56C42] pl-4 lg:mt-11">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#D7DDCF]">
              {currentStep ? "Current stage" : "Last recorded milestone"}
            </p>
            <p className="mt-2 break-words text-xl font-semibold leading-tight text-[#F7F6F2] sm:text-[1.55rem]">
              {highlightedStep?.title || "Tracking updates pending"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#E1E8DD]">
              {highlightedStep?.description || "Updates will appear when they are available."}
            </p>
          </div>

          <div className="od-journey-progress-wrap relative mt-auto pt-7">
            {journeySteps.some(
              (step) => step.current && step.key === "out_for_delivery"
            ) && (
              <div className="od-truck-wrap mb-2 flex min-w-0 flex-col items-start gap-3" aria-label="Live delivery update">
                <p className="od-mobile-hide-copy max-w-[310px] text-sm leading-6 text-[#E1E8DD]">
                  Your order has left the Host and is moving toward your delivery address.
                </p>
                <div className="w-full max-w-[310px]">
                  <DeliveryTruckAnimation />
                </div>
              </div>
            )}

            <div className="od-progress relative border-t border-[#F7F6F2]/20 pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-[#E1E8DD]">Recorded progress</p>
                <p className="text-base font-semibold tabular-nums text-[#F7F6F2]">
                  {confirmedCount} <span className="font-normal text-[#D7DDCF]">/ {journeySteps.length}</span>
                </p>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-[#F7F6F2]/20"
                role="progressbar"
                aria-label={`Completed milestones for ${sellerOrder.sellerName || "Host"}`}
                aria-valuemin={0}
                aria-valuemax={journeySteps.length}
                aria-valuenow={confirmedCount}
              >
                <div
                  className="h-full rounded-full bg-[#C56C42] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${(confirmedCount / journeySteps.length) * 100}%` }}
                />
              </div>
              <p className="od-mobile-hide-copy mt-2 text-xs leading-5 text-[#D7DDCF]">
                Only recorded or reached milestones are shown as complete.
              </p>
            </div>
          </div>
        </div>

        {/* One continuous path, with the active milestone visually anchored. */}
        <div className="od-timeline-steps min-w-0 bg-[#F7F6F2] px-4 py-6 sm:px-8 sm:py-8 lg:px-9">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-[#D5D9D0] pb-4">
            <h4 className="text-base font-semibold text-[#202421]">Tracking milestones</h4>
            <p className="od-mobile-hide-copy text-xs font-medium text-[#647066]">From order placed to delivered</p>
          </div>
          <ol className="relative min-w-0 before:pointer-events-none before:absolute before:bottom-7 before:left-[18px] before:top-6 before:w-[2px] before:bg-[#C7CFC1] before:content-['']" aria-label={`Milestones for ${sellerOrder.sellerName || "Host"}`}>
            {journeySteps.map((step, index) => (
              <li
                key={step.key}
                className={`od-timeline-step relative grid min-w-0 grid-cols-[38px_minmax(0,1fr)] items-start gap-3 py-2.5 sm:gap-4 ${
                  step.current ? "rounded-xl bg-[#F6E7DC]" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative z-10 flex h-[38px] w-[38px] items-center justify-center rounded-full border-[2px] text-xs font-semibold tabular-nums shadow-[0_0_0_4px_#F7F6F2] ${
                    step.current
                      ? "border-[#C56C42] bg-[#C56C42] text-white"
                      : step.completed
                        ? "border-[#173F35] bg-[#173F35] text-[#F7F6F2]"
                        : "border-[#C7CFC1] bg-[#F7F6F2] text-[#778174]"
                  }`}
                >
                  {step.completed && !step.current ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <div className={`min-w-0 ${step.current ? "pr-3" : "pr-1"}`}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <p className={`break-words text-[15px] font-semibold leading-6 sm:text-base ${
                      step.completed || step.current ? "text-[#202421]" : "text-[#6E786C]"
                    }`}>
                      {step.title}
                    </p>
                    {step.current ? (
                      <span className="rounded-full bg-[#C56C42] px-2.5 py-1 text-[11px] font-semibold text-white">
                        Current
                      </span>
                    ) : step.completed ? (
                      <span className="text-xs font-semibold text-[#173F35]">Completed</span>
                    ) : (
                      <span className="text-xs font-medium text-[#7A8376]">Upcoming</span>
                    )}
                  </div>
                  <p className={`od-milestone-description mt-0.5 break-words text-sm leading-[1.45rem] ${
                    step.current ? "text-[#654935]" : "text-[#5B685D]"
                  }`}>
                    {step.description}
                  </p>
                  {step.occurredAt && (
                    <p className="mt-1 text-xs font-medium tabular-nums text-[#536255]">
                      {formatTimestamp(step.occurredAt)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
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

  const isSingleHost = sellerOrders.length === 1;

  const timeline = data?.timeline || [];

  const deliveryEta = data?.deliveryEta || null;

  const remainingEtaMinutes = getRemainingEtaMinutes(deliveryEta, nowMs);

  const orderDisplayTitle = getOrderDisplayTitle(sellerOrders);

  return (
    <main className="od-mobile-page min-h-screen bg-[#F7F6F2] text-[#202421]">
      <style>{`
        /* Order Detail: phone-only density and safe full-width layout.
           All desktop styles and data-bearing elements remain unchanged. */
        @media (max-width: 639px) {
          .od-mobile-page {
            box-sizing: border-box;
            width: calc(100% + var(--ep-content-gutter, 16px) + var(--ep-content-gutter, 16px) - 2px);
            max-width: none;
            margin-inline: calc(0px - var(--ep-content-gutter, 16px));
            overflow-x: clip;
          }
          .od-mobile-page .od-content { padding: 9px 12px 25px; }
          .od-mobile-page .od-toolbar { margin-bottom: 9px; gap: 6px; }
          .od-mobile-page .od-toolbar > p { font-size: 11px; line-height: 17px; }
          .od-mobile-page .od-receipt { border-radius: 14px; }
          .od-mobile-page .od-receipt-title-area { padding: 18px 16px 17px; }
          .od-mobile-page #od-title { font-size: clamp(1.65rem, 7.1vw, 2rem); line-height: 1.14; }
          .od-mobile-page .od-receipt-title-area > div:first-child { margin-bottom: 10px; }
          .od-mobile-page .od-header-status { margin-top: 13px; gap: 7px; }
          .od-mobile-page .od-header-status > span { padding: 5px 9px; }
          .od-mobile-page .od-receipt-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: 14px;
            gap: 8px;
          }
          .od-mobile-page .od-receipt-actions > button {
            min-width: 0;
            min-height: 40px;
            padding: 9px 7px;
            font-size: 12px;
            line-height: 17px;
            gap: 5px;
            white-space: normal;
          }
          .od-mobile-page .od-receipt-actions > button svg { flex-shrink: 0; width: 14px; height: 14px; }
          .od-mobile-page .od-receipt-total { padding: 13px 16px; }
          .od-mobile-page .od-receipt-amount { margin-top: 5px; font-size: 1.85rem; }
          .od-mobile-page .od-total-meta { margin-top: 9px; padding-top: 9px; }
          .od-mobile-page .od-cost-strip > div {
            padding: 10px 14px;
            gap: 8px;
            font-size: 14px;
          }
          .od-mobile-page .od-cost-strip > div p { overflow-wrap: anywhere; }
          .od-mobile-page .od-delivery-address { margin-top: 17px; padding: 14px 15px; }
          .od-mobile-page .od-delivery-address > div { gap: 12px; }
          .od-mobile-page .od-delivery-address > div > div:first-child { gap: 10px; }
          .od-mobile-page .od-delivery-address > div > div:first-child > span {
            width: 33px; height: 33px;
          }
          .od-mobile-page .od-delivery-address p { line-height: 21px; }
          .od-mobile-page .od-delivery-eta { min-width: 0; }
          .od-mobile-page .od-host-section, .od-mobile-page .od-journey-section {
            margin-top: 22px;
          }
          .od-mobile-page .od-host-header, .od-mobile-page .od-journey-header {
            padding: 16px;
            gap: 10px;
          }
          .od-mobile-page .od-host-header h2, .od-mobile-page .od-journey-header h2 {
            font-size: 1.43rem;
            line-height: 1.75rem;
          }
          .od-mobile-page .od-host-header > p { padding-left: 9px; }
          .od-mobile-page .od-journey-header > div { padding-left: 12px; }
          .od-mobile-page .od-host-identity {
            padding: 15px 16px;
            gap: 12px;
          }
          .od-mobile-page .od-host-identity h3 { margin-top: 5px; font-size: 1.3rem; }
          .od-mobile-page .od-item-list { padding: 13px 16px; }
          .od-mobile-page .od-item-list > div:first-child { padding-bottom: 8px; }
          .od-mobile-page .od-item-row { padding: 9px 0; gap: 3px; }
          .od-mobile-page .od-policies > div { padding: 13px 16px; }
          .od-mobile-page .od-policies p { margin-top: 6px; font-size: 13px; line-height: 20px; }
          .od-mobile-page .od-timeline-summary { padding: 16px; }
          .od-mobile-page .od-timeline-summary h3 { margin-top: 7px; font-size: 1.35rem; }
          .od-mobile-page .od-timeline-summary span.rounded-full { margin-top: 9px; }
          .od-mobile-page .od-current-stage { margin-top: 18px; padding-left: 12px; }
          .od-mobile-page .od-current-stage p:nth-child(2) { margin-top: 5px; font-size: 1.15rem; }
          .od-mobile-page .od-current-stage p:last-child { margin-top: 4px; line-height: 20px; }
          .od-mobile-page .od-journey-progress-wrap { padding-top: 15px; }
          .od-mobile-page .od-truck-wrap { gap: 8px; margin-bottom: 10px; }
          .od-mobile-page .od-truck-wrap > div { max-width: 310px; }
          .od-mobile-page .od-progress { padding-top: 12px; }
          .od-mobile-page .od-progress [role="progressbar"] { margin-top: 8px; }
          .od-mobile-page .od-timeline-steps { padding: 16px; }
          .od-mobile-page .od-timeline-steps > div:first-child { margin-bottom: 11px; padding-bottom: 11px; }
          .od-mobile-page .od-timeline-step { padding: 7px 0; gap: 10px; }
          .od-mobile-page .od-timeline-step .od-milestone-description { font-size: 12px; line-height: 19px; }
          .od-mobile-page .od-timeline-step p.tabular-nums { margin-top: 3px; font-size: 11px; }
          /* Hide duplicated explanatory copy, never receipts, values, policy text,
             delivery address, items, stages, timestamps or notices. */
          .od-mobile-page .od-mobile-hide-copy { display: none; }
        }
      `}</style>
      <div className="od-content w-full px-3 pb-9 pt-2 sm:px-6 sm:pb-12 sm:pt-3 xl:px-9">
        <div className="od-toolbar mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-5">
          <Link to="/orders" className="focus-ring inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#173F35] transition-colors hover:text-[#C56C42]">
            <ArrowLeft size={17} aria-hidden="true" /> Back to Orders
          </Link>
          <p className="min-w-0 break-all text-xs text-[#626A63] sm:text-sm">
            {order.createdAt ? `Placed ${formatTimestamp(order.createdAt)}` : "Order details"}
          </p>
        </div>

        {/* The only large feature card: a purchase receipt, not another dashboard. */}
        <section aria-labelledby="od-title" className="od-receipt overflow-hidden rounded-[18px] border border-[#C9D1C3] bg-[#F7F6F2] shadow-[0_14px_36px_rgba(23,63,53,0.07)] sm:rounded-[22px]">
          <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.67fr)]">
            <div className="od-receipt-title-area relative min-w-0 bg-[#173F35] px-5 py-7 text-[#F7F6F2] sm:px-8 sm:py-9 xl:px-10">
              <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-[#E5EBDD]">
                <span className="h-[2px] w-9 bg-[#C56C42]" aria-hidden="true" />
                01 / Your order
              </div>
              <h1 id="od-title" className="max-w-[800px] break-words text-[clamp(1.7rem,3.1vw,3rem)] font-semibold leading-[1.14] tracking-[-0.035em] text-[#F7F6F2]">
                {orderDisplayTitle}
              </h1>
              <p className="od-mobile-hide-copy mt-3 max-w-2xl text-sm leading-6 text-[#E1E9DF] sm:text-base">
                Your payment, Host deliveries and order updates in one place.
              </p>
              <div className="od-header-status mt-5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(order.status)}`}>{label(order.status)}</span>
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(order.paymentStatus)}`}>Payment {label(order.paymentStatus)}</span>
              </div>
              <div className="od-receipt-actions mt-6 flex flex-wrap gap-2.5">
                <button type="button" onClick={() => downloadOrderReceipt({ order, sellerOrders, customerName: currentUser?.name || "Customer" })} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#F7F6F2] px-4 py-2.5 text-sm font-semibold text-[#173F35] transition hover:bg-[#D7DDCF]">
                  <Download size={16} aria-hidden="true" /> Download receipt
                </button>
                <button type="button" onClick={() => load({ refresh: true })} disabled={refreshing} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#A2B8A9] px-4 py-2.5 text-sm font-semibold text-[#F7F6F2] transition hover:bg-[#275344] disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />{refreshing ? "Refreshing..." : "Refresh order"}
                </button>
              </div>
            </div>
            <div className="od-receipt-total flex min-w-0 flex-col justify-between bg-[#AC502D] px-5 py-6 text-[#F7F6F2] sm:px-8 sm:py-8 lg:px-7">
              <div>
                <p className="text-sm font-semibold text-[#FFF1E8]">Total paid / payable</p>
                <p className="od-receipt-amount mt-3 break-words text-[clamp(1.9rem,3vw,2.9rem)] font-semibold leading-tight tracking-[-0.035em] tabular-nums text-white">
                  {formatMoney(order.totals?.totalLandedCostMinor, order.totals?.currency)}
                </p>
              </div>
              <div className="od-total-meta mt-6 border-t border-white/45 pt-4">
                <p className="text-sm font-medium text-[#FFF1E8]">{sellerOrders.length} Host {sellerOrders.length === 1 ? "delivery" : "deliveries"}</p>
                <p className="od-mobile-hide-copy mt-1 text-sm leading-6 text-[#FFF1E8]">Each Host's items, policies and journey are listed below.</p>
              </div>
            </div>
          </div>
          <div className="od-cost-strip grid grid-cols-1 divide-y divide-[#D7DDCF] bg-[#EBEEE5] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5 sm:block sm:px-7 sm:py-5">
              <p className="text-sm font-semibold text-[#56675B]">Items subtotal</p>
              <p className="break-words text-base font-semibold tabular-nums text-[#202421] sm:mt-1.5 sm:text-xl">{formatMoney(order.totals?.itemSubtotalMinor, order.totals?.currency)}</p>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5 sm:block sm:px-7 sm:py-5">
              <p className="text-sm font-semibold text-[#56675B]">Known fees</p>
              <p className="break-words text-base font-semibold tabular-nums text-[#202421] sm:mt-1.5 sm:text-xl">{formatMoney(order.totals?.knownFeesMinor, order.totals?.currency)}</p>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-3 px-5 py-3.5 sm:block sm:px-7 sm:py-5">
              <p className="text-sm font-semibold text-[#56675B]">Payment</p>
              <p className="break-words text-base font-semibold text-[#173F35] sm:mt-1.5 sm:text-xl">{label(order.paymentStatus)}</p>
            </div>
          </div>
        </section>

        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_summary" embedded />

        {order.deliveryAddressSnapshot && (
          <section className="od-delivery-address mt-5 border-y border-[#CBD3C5] bg-[#D7DDCF] px-4 py-5 sm:mt-8 sm:px-7 sm:py-7" aria-labelledby="od-delivery">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#173F35] text-[#F7F6F2]"><MapPin size={19} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h2 id="od-delivery" className="text-sm font-semibold text-[#173F35]">Delivery address at checkout</h2>
                  <p className="mt-1 text-base font-semibold text-[#202421]">{order.deliveryAddressSnapshot.recipientName || "Recipient"}{order.deliveryAddressSnapshot.phone ? ` · ${order.deliveryAddressSnapshot.phone}` : ""}</p>
                  <p className="mt-1 break-words text-sm leading-6 text-[#3F5045] sm:text-base">{formatDeliveryAddress(order.deliveryAddressSnapshot)}</p>
                  {order.deliveryAddressSnapshot.deliveryInstructions && <p className="mt-2 break-words text-sm leading-5 text-[#586A5B]">Delivery note: {order.deliveryAddressSnapshot.deliveryInstructions}</p>}
                </div>
              </div>
              {deliveryEta?.available && (
                <div className="od-delivery-eta min-w-[170px] border-l-[3px] border-[#C56C42] pl-4">
                  <p className="text-sm font-semibold text-[#556559]">Approx. delivery</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-[#173F35]">
                    {Number.isFinite(remainingEtaMinutes) ? remainingEtaMinutes <= 0 ? "Arriving now" : `~${remainingEtaMinutes} min` : `~${deliveryEta.estimatedDeliveryMinutes} min`}
                  </p>
                  <p className="mt-0.5 text-sm text-[#59685E]">{formatEtaDistance(deliveryEta.estimatedRoadDistanceKm)}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {error && <p role="alert" className="mt-4 border-l-4 border-rose-600 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">{error}</p>}

        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_items" embedded />

        {/* 02: Host details, purchased items, and exact published promises. */}
        <section className="od-host-section mt-7 overflow-hidden border-y border-[#C9D1C3] sm:mt-10" aria-labelledby="od-host-heading">
          <header className="od-host-header flex flex-wrap items-end justify-between gap-4 bg-[#D7DDCF] px-5 py-6 sm:px-8 sm:py-7">
            <div>
              <p className="text-sm font-semibold text-[#945032]">02 / Host deliveries</p>
              <h2 id="od-host-heading" className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.025em] text-[#173F35] sm:text-[2.1rem]">
                Who is bringing your items
              </h2>
            </div>
            <p className="border-l-[3px] border-[#C56C42] pl-3 text-sm font-semibold text-[#173F35]">
              {sellerOrders.length} {sellerOrders.length === 1 ? "Host delivery" : "Host deliveries"}
            </p>
          </header>

          {sellerOrders.length === 0 && (
            <p className="bg-[#FBFAF7] px-5 py-7 text-sm leading-6 text-[#47574C] sm:px-8">
              Host delivery details are not available for this order yet.
            </p>
          )}

          <div className="divide-y divide-[#C9D1C3]">
            {sellerOrders.map((sellerOrder, sellerIndex) => (
              <article
                key={sellerOrder.id || sellerIndex}
                aria-label={`Delivery from ${sellerOrder.sellerName || "Host"}`}
                className="grid min-w-0 bg-[#FBFAF7] lg:grid-cols-[minmax(215px,.30fr)_minmax(0,.70fr)]"
              >
                <div className="od-host-identity flex min-w-0 flex-col justify-between gap-5 bg-[#173F35] px-5 py-6 text-[#F7F6F2] sm:px-8 sm:py-7">
                  <div>
                    <p className="text-sm font-medium text-[#D7DDCF]">
                      Delivery {String(sellerIndex + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-2 break-words text-xl font-semibold leading-snug sm:text-2xl">
                      {sellerOrder.sellerName || "EPANTRY Host"}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(sellerOrder.status)}`}>
                      {label(sellerOrder.status)}
                    </span>
                    <span className="text-sm text-[#E1E8DB]">
                      {(sellerOrder.items || []).length} {(sellerOrder.items || []).length === 1 ? "item" : "items"}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  {sellerProblemCopy(sellerOrder.status) && (
                    <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 sm:px-8" role="status">
                      <p className="text-sm font-semibold text-rose-800">This delivery needs attention</p>
                      <p className="mt-1 text-sm leading-6 text-rose-900">
                        {sellerProblemCopy(sellerOrder.status)}
                      </p>
                    </div>
                  )}

                  <div className="od-item-list px-5 py-5 sm:px-8 sm:py-6">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#D7DDCF] pb-3">
                      <h4 className="text-base font-semibold text-[#173F35]">Items in this delivery</h4>
                      <p className="text-sm text-[#58665A]">
                        {(sellerOrder.items || []).length} {(sellerOrder.items || []).length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    {(sellerOrder.items || []).length === 0 ? (
                      <p className="py-4 text-sm text-[#58665A]">No item details are available for this Host yet.</p>
                    ) : (
                      <div className="divide-y divide-[#E0E3D9]">
                        {(sellerOrder.items || []).map((item, itemIndex) => (
                          <div
                            key={item.cartItemId || item.offerId || `${item.displayName}-${itemIndex}`}
                            className="od-item-row grid min-w-0 gap-1 py-3.5 transition-colors hover:bg-[#EEF1E9] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-2"
                          >
                            <span className="min-w-0 break-words text-sm font-semibold text-[#202421] sm:text-base">
                              {item.displayName || "Marketplace item"}
                            </span>
                            {sellerItemQuantity(item) && (
                              <span className="min-w-0 break-words text-sm text-[#526356] sm:text-right">
                                {sellerItemQuantity(item)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="od-policies grid border-t border-[#D7DDCF] bg-[#F0F1E9] md:grid-cols-2 md:divide-x md:divide-[#D1D9CB]">
                    <div className="px-5 py-5 sm:px-8">
                      <div className="flex items-center gap-2 text-[#95472D]">
                        <ShieldCheck size={17} aria-hidden="true" />
                        <h4 className="text-sm font-semibold">Cancellation promise</h4>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-[#35443A]">
                        {sellerOrder.promise?.cancellationPolicySummary || "Not captured"}
                      </p>
                    </div>
                    <div className="border-t border-[#D1D9CB] px-5 py-5 sm:px-8 md:border-t-0">
                      <div className="flex items-center gap-2 text-[#173F35]">
                        <RotateCcw size={17} aria-hidden="true" />
                        <h4 className="text-sm font-semibold">Return promise</h4>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-[#35443A]">
                        {sellerOrder.promise?.returnPolicySummary || "Not captured"}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 03: An individual, chronological journey for every Host delivery. */}
        <section className="od-journey-section mt-7 overflow-hidden border-y border-[#C9D1C3] sm:mt-10" aria-labelledby="od-journey-heading">
          <header className="od-journey-header flex flex-wrap items-end justify-between gap-5 bg-[#D7DDCF] px-5 py-6 sm:px-8 sm:py-8">
            <div className="max-w-[740px] border-l-[4px] border-[#C56C42] pl-4 sm:pl-5">
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#954E31]">03 / Order journey</p>
              <h2 id="od-journey-heading" className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-[#173F35] sm:text-[2.2rem]">
                Your delivery, step by step
              </h2>
              <p className="od-mobile-hide-copy mt-2 text-sm leading-6 text-[#405444]">
                Follow each Host's progress from payment to delivery.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-[#B8C6B4] bg-[#F7F6F2] px-4 py-2 text-sm font-semibold text-[#173F35]">
              {sellerOrders.length} {sellerOrders.length === 1 ? "delivery" : "deliveries"}
            </span>
          </header>
          {sellerOrders.length === 0 ? (
            <p className="bg-[#FBFAF7] px-5 py-7 text-sm leading-6 text-[#47574C] sm:px-8">
              Tracking updates will appear when a Host delivery is available.
            </p>
          ) : (
            <div>
              {sellerOrders.map((sellerOrder, sellerIndex) => (
                <SellerJourneyTimeline
                  key={sellerOrder.id || sellerIndex}
                  order={order}
                  timeline={timeline}
                  sellerOrder={sellerOrder}
                  sellerIndex={sellerIndex}
                />
              ))}
            </div>
          )}
        </section>

        <SponsoredCampaignSlot placement="post_purchase" slotKey="post_purchase_follow_up" embedded />
      </div>
    </main>
  );
}
