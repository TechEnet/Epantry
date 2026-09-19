import {
  useCallback,
  useEffect,
  useState,
} from 'react'

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
} from 'lucide-react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import {
  useAuth,
} from '../../auth/context/AuthContext'

import {
  getCommerceErrorMessage,
  getOrder,
} from '../services/commerce.service'

function formatMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Not available'
  }

  return new Intl.NumberFormat(
    'en-IN',
    {
      style:
        'currency',

      currency,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )
}

function label(
  value,
) {
  return String(
    value ||
      'unknown',
  )
    .split(
      '_',
    )
    .map(
      (
        token,
      ) =>
        `${token
          .charAt(
            0,
          )
          .toUpperCase()}${token.slice(
          1,
        )}`,
    )
    .join(
      ' ',
    )
}

const SELLER_PROGRESS_STEPS = [
  {
    status:
      'seller_accepted',

    title:
      'Order accepted',

    description:
      'The Host accepted your order.',
  },
  {
    status:
      'picking',

    title:
      'Picking items',

    description:
      'The Host is preparing the items in your order.',
  },
  {
    status:
      'packed',

    title:
      'Packed',

    description:
      'Your order has been packed and is ready for dispatch.',
  },
  {
    status:
      'carrier_handoff',

    title:
      'Handed to carrier',

    description:
      'The packed order has been handed over for delivery.',
  },
  {
    status:
      'out_for_delivery',

    title:
      'Out for delivery',

    description:
      'Your order is on the way.',
  },
  {
    status:
      'delivered',

    title:
      'Delivered',

    description:
      'The Host marked this order as delivered.',
  },
]

function formatTimestamp(
  value,
) {
  if (!value) {
    return ''
  }

  const date =
    new Date(
      value,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  return date.toLocaleString()
}

function findTimelineEvent({
  timeline,
  sellerOrderId,
  status,
  eventType,
}) {
  return (
    timeline.find(
      (
        event,
      ) => {
        if (
          sellerOrderId &&
          String(
            event.sellerOrderId ||
              '',
          ) !==
            String(
              sellerOrderId,
            )
        ) {
          return false
        }

        if (
          status &&
          event.toStatus !==
            status
        ) {
          return false
        }

        if (
          eventType &&
          event.eventType !==
            eventType
        ) {
          return false
        }

        return true
      },
    ) ||
    null
  )
}

function paymentIsComplete(
  paymentStatus,
) {
  const normalized =
    String(
      paymentStatus ||
        '',
    ).toLowerCase()

  return (
    normalized.includes(
      'paid',
    ) ||
    normalized.includes(
      'captured',
    ) ||
    normalized.includes(
      'complete',
    )
  )
}

function formatReceiptMoney(
  amountMinor,
  currency =
    'INR',
) {
  if (
    !Number.isInteger(
      Number(
        amountMinor,
      ),
    )
  ) {
    return 'Not available'
  }

  return `${currency || 'INR'} ${new Intl.NumberFormat(
    'en-IN',
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  ).format(
    Number(
      amountMinor,
    ) /
      100,
  )}`
}

function asciiReceiptText(
  value,
) {
  return String(
    value ??
      '',
  )
    .normalize(
      'NFKD',
    )
    .replace(
      /[^\x20-\x7E]/g,
      '',
    )
}

function escapePdfText(
  value,
) {
  return asciiReceiptText(
    value,
  )
    .replace(
      /\\/g,
      '\\\\',
    )
    .replace(
      /\(/g,
      '\\(',
    )
    .replace(
      /\)/g,
      '\\)',
    )
}

function wrapReceiptText(
  value,
  maxLength =
    72,
) {
  const words =
    asciiReceiptText(
      value,
    )
      .trim()
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      )

  if (
    words.length ===
    0
  ) {
    return ['']
  }

  const lines = []
  let current = ''

  words.forEach(
    (
      word,
    ) => {
      const next =
        current
          ? `${current} ${word}`
          : word

      if (
        next.length >
          maxLength &&
        current
      ) {
        lines.push(
          current,
        )

        current =
          word
      } else {
        current =
          next
      }
    },
  )

  if (current) {
    lines.push(
      current,
    )
  }

  return lines
}

function buildReceiptPdf({
  order,
  sellerOrders,
  customerName,
}) {
  const encoder =
    new TextEncoder()

  const createdAt =
    order.createdAt
      ? new Date(
          order.createdAt,
        )
      : null

  const orderDate =
    createdAt &&
    !Number.isNaN(
      createdAt.getTime(),
    )
      ? createdAt.toLocaleDateString()
      : 'Not available'

  const orderTime =
    createdAt &&
    !Number.isNaN(
      createdAt.getTime(),
    )
      ? createdAt.toLocaleTimeString()
      : 'Not available'

  const hostNames =
    Array.from(
      new Set(
        sellerOrders
          .map(
            (
              sellerOrder,
            ) =>
              sellerOrder.sellerName,
          )
          .filter(
            Boolean,
          ),
      ),
    ).join(
      ', ',
    ) ||
    'Not available'

  const totalMinor =
    Number.isInteger(
      Number(
        order.totals
          ?.totalLandedCostMinor,
      ),
    )
      ? order.totals
          ?.totalLandedCostMinor
      : order.totals
          ?.itemSubtotalMinor

  const details = [
    [
      'Order ID',
      order.id ||
        'Not available',
    ],
    [
      'Ordered by',
      customerName ||
        'Customer',
    ],
    [
      'Order date',
      orderDate,
    ],
    [
      'Order time',
      orderTime,
    ],
    [
      'Payment amount',
      formatReceiptMoney(
        totalMinor,
        order.totals
          ?.currency,
      ),
    ],
    [
      'Payment gateway / application',
      order.paymentProvider
        ? label(
            order.paymentProvider,
          )
        : 'Not recorded',
    ],
    [
      'Payment status',
      label(
        order.paymentStatus,
      ),
    ],
    [
      'Order status',
      label(
        order.status,
      ),
    ],
    [
      'Host / Seller',
      hostNames,
    ],
    [
      'Items subtotal',
      formatReceiptMoney(
        order.totals
          ?.itemSubtotalMinor,
        order.totals
          ?.currency,
      ),
    ],
    [
      'Known fees',
      formatReceiptMoney(
        order.totals
          ?.knownFeesMinor,
        order.totals
          ?.currency,
      ),
    ],
    [
      'Total paid',
      formatReceiptMoney(
        totalMinor,
        order.totals
          ?.currency,
      ),
    ],
  ]

  sellerOrders.forEach(
    (
      sellerOrder,
      index,
    ) => {
      details.push(
        [
          `Seller ${index + 1}`,
          `${sellerOrder.sellerName || 'Host'} - ${label(
            sellerOrder.status,
          )}`,
        ],
      )
    },
  )

  let y =
    730

  const stream = [
    '0.02 0.45 0.31 rg',
    '40 755 515 55 re f',
    '1 1 1 rg',
    'BT',
    '/F2 19 Tf',
    '1 0 0 1 55 787 Tm',
    '(EPANTRY ORDER RECEIPT) Tj',
    'ET',
    '0.12 0.12 0.12 rg',
  ]

  details.forEach(
    ([
      key,
      value,
    ]) => {
      stream.push(
        'BT',
        '/F2 10 Tf',
        `1 0 0 1 55 ${y} Tm`,
        `(${escapePdfText(
          key,
        )}) Tj`,
        'ET',
      )

      const valueLines =
        wrapReceiptText(
          value,
          58,
        )

      valueLines.forEach(
        (
          line,
          lineIndex,
        ) => {
          stream.push(
            'BT',
            '/F1 10 Tf',
            `1 0 0 1 220 ${y - lineIndex * 14} Tm`,
            `(${escapePdfText(
              line,
            )}) Tj`,
            'ET',
          )
        },
      )

      y -=
        Math.max(
          24,
          valueLines.length *
            14 +
            10,
        )
    },
  )

  stream.push(
    '0.83 0.83 0.80 RG',
    `50 ${Math.max(70, y - 2)} m 545 ${Math.max(70, y - 2)} l S`,
    '0.35 0.35 0.35 rg',
    'BT',
    '/F1 9 Tf',
    `1 0 0 1 55 ${Math.max(50, y - 24)} Tm`,
    '(Generated by EPANTRY from the current order record.) Tj',
    'ET',
  )

  const content =
    `${stream.join('\n')}\n`

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${encoder.encode(
      content,
    ).length} >>\nstream\n${content}endstream`,
  ]

  let pdf =
    '%PDF-1.4\n'

  const offsets = [
    0,
  ]

  objects.forEach(
    (
      object,
      index,
    ) => {
      offsets.push(
        encoder.encode(
          pdf,
        ).length,
      )

      pdf +=
        `${index + 1} 0 obj\n${object}\nendobj\n`
    },
  )

  const xrefOffset =
    encoder.encode(
      pdf,
    ).length

  pdf +=
    `xref\n0 ${objects.length + 1}\n`

  pdf +=
    '0000000000 65535 f \n'

  offsets
    .slice(
      1,
    )
    .forEach(
      (
        offset,
      ) => {
        pdf +=
          `${String(
            offset,
          ).padStart(
            10,
            '0',
          )} 00000 n \n`
      },
    )

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return encoder.encode(
    pdf,
  )
}

function downloadOrderReceipt({
  order,
  sellerOrders,
  customerName,
}) {
  const pdfBytes =
    buildReceiptPdf({
      order,
      sellerOrders,
      customerName,
    })

  const blob =
    new Blob(
      [
        pdfBytes,
      ],
      {
        type:
          'application/pdf',
      },
    )

  const url =
    URL.createObjectURL(
      blob,
    )

  const anchor =
    document.createElement(
      'a',
    )

  anchor.href =
    url

  anchor.download =
    `EPANTRY-Order-${String(
      order.id ||
        'receipt',
    )
      .slice(
        -8,
      )
      .toUpperCase()}-Receipt.pdf`

  document.body.appendChild(
    anchor,
  )

  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(
    url,
  )
}


function DeliveryTruckAnimation() {
  return (
    <div
      className="relative h-[170px] w-[310px] max-w-full shrink-0 overflow-hidden rounded-[22px] border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 shadow-[0_14px_34px_rgba(67,56,202,0.10)]"
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

      <div className="absolute inset-x-4 top-3 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-700">
            Live delivery
          </p>
          <p className="mt-0.5 text-xs font-black text-stone-900">
            Your order is on the way
          </p>
        </div>

        <span className="rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">
          Moving
        </span>
      </div>

      <div
        className="epantry-delivery-post absolute bottom-[31px] right-[-34px] h-20 w-1 bg-stone-700/70"
        style={{
          animation:
            'epantryTruckPost 2.9s linear infinite',
        }}
        aria-hidden="true"
      >
        <div className="absolute -left-2 -top-2 h-4 w-5 rounded-t-sm bg-stone-700/70" />
      </div>

      <div
        className="epantry-delivery-motion absolute bottom-[31px] left-7 h-[86px] w-[228px]"
        style={{
          animation:
            'epantryTruckBounce .42s ease-in-out infinite',
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
            clipPath:
              'polygon(0 0, 48% 0, 100% 58%, 100% 100%, 0 100%)',
          }}
        >
          <div
            className="absolute left-3 top-3 h-7 w-9 border-2 border-stone-400 bg-sky-300"
            style={{
              clipPath:
                'polygon(0 0, 42% 0, 100% 100%, 0 100%)',
            }}
          />
          <div className="absolute bottom-3 left-2 h-1.5 w-3 rounded bg-stone-700" />
        </div>

        <div
          className="epantry-delivery-light absolute bottom-5 left-[204px] h-4 w-2 rounded-r bg-sky-200 shadow-[inset_0_-6px_rgba(185,28,28,.7)]"
          style={{
            animation:
              'epantryTruckLight 1.5s ease-in-out infinite',
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
        className="epantry-delivery-road absolute bottom-[27px] left-0 h-[3px] w-full opacity-70"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #292524 0 52px, transparent 52px 86px)',
          animation:
            'epantryTruckRoad 1.1s linear infinite',
        }}
        aria-hidden="true"
      />
    </div>
  )
}

function getOrderDisplayTitle(
  sellerOrders = [],
) {
  const itemNames =
    sellerOrders.flatMap(
      (sellerOrder) =>
        (sellerOrder?.items || [])
          .map(
            (item) =>
              String(
                item?.displayName ||
                  '',
              ).trim(),
          )
          .filter(Boolean),
    )

  if (!itemNames.length) {
    return 'EPANTRY order'
  }

  return itemNames.length > 1
    ? `${itemNames[0]} + ${itemNames.length - 1} more`
    : itemNames[0]
}

function formatDeliveryAddress(
  address,
) {
  if (!address) {
    return ''
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
    .map(
      (value) =>
        String(
          value ||
            '',
        ).trim(),
    )
    .filter(Boolean)
    .join(', ')
}

function sellerProblemCopy(
  status,
) {
  const normalized =
    String(
      status ||
        '',
    ).toLowerCase()

  const messages = {
    rejected:
      'This Host could not accept this part of your order. Review the affected items below.',

    partial_unavailable:
      'Some items in this Host delivery are unavailable and need your attention.',

    seller_cancelled:
      'This Host cancelled their delivery. The affected items stay visible below for clarity.',

    delivery_failed:
      'The delivery attempt was not completed. Check the latest status before planning around these items.',
  }

  return messages[
    normalized
  ] ||
    ''
}

function sellerItemQuantity(
  item,
) {
  const parts =
    []

  if (
    Number(
      item?.packCount ||
        0,
    ) >
    0
  ) {
    parts.push(
      `${item.packCount} pack${Number(item.packCount) === 1 ? '' : 's'}`,
    )
  }

  if (
    Number(
      item?.packQuantity ||
        0,
    ) >
    0 &&
    item?.packUnit
  ) {
    parts.push(
      `${item.packQuantity} ${item.packUnit} each`,
    )
  }

  return parts.join(
    ' · ',
  )
}

function statusClass(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    ).toLowerCase()

  if (
    normalized.includes(
      'confirm',
    ) ||
    normalized.includes(
      'paid',
    ) ||
    normalized.includes(
      'captured',
    ) ||
    normalized.includes(
      'complete',
    )
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (
    normalized.includes(
      'pending',
    ) ||
    normalized.includes(
      'ready',
    )
  ) {
    return 'border-violet-200 bg-violet-50 text-violet-800'
  }

  if (
    normalized.includes(
      'cancel',
    ) ||
    normalized.includes(
      'fail',
    ) ||
    normalized.includes(
      'reject',
    ) ||
    normalized.includes(
      'unavailable',
    )
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-800'
  }

  return 'border-stone-200 bg-stone-100 text-stone-700'
}


function SellerJourneyTimeline({
  order,
  timeline,
  sellerOrder,
}) {
  const paymentEvent =
    timeline.find(
      (event) =>
        event.eventType ===
          'payment_captured' ||
        String(
          event.eventType ||
            '',
        ).includes(
          'payment_captured',
        ),
    ) ||
    null

  const paymentComplete =
    paymentIsComplete(
      order.paymentStatus,
    )

  const currentIndex =
    SELLER_PROGRESS_STEPS.findIndex(
      (step) =>
        step.status ===
        sellerOrder.status,
    )

  const journeySteps = [
    {
      key:
        'order_placed',
      title:
        'Order placed',
      description:
        'Your order was received by EPANTRY.',
      completed:
        true,
      current:
        !paymentComplete,
      occurredAt:
        order.createdAt,
    },
    {
      key:
        'payment_confirmed',
      title:
        'Payment confirmed',
      description:
        paymentComplete
          ? 'Payment was successfully verified.'
          : 'Waiting for payment confirmation.',
      completed:
        paymentComplete,
      current:
        paymentComplete &&
        (!sellerOrder.status ||
          sellerOrder.status ===
            'confirmed'),
      occurredAt:
        paymentComplete
          ? paymentEvent?.occurredAt ||
            order.updatedAt
          : null,
    },
    ...SELLER_PROGRESS_STEPS.map(
      (step, stepIndex) => {
        const event =
          findTimelineEvent({
            timeline,
            sellerOrderId:
              sellerOrder.id,
            status:
              step.status,
          })

        const completed =
          Boolean(
            event,
          ) ||
          (currentIndex >= 0 &&
            stepIndex <=
              currentIndex)

        const current =
          sellerOrder.status ===
          step.status

        return {
          ...step,
          key:
            step.status,
          completed,
          current,
          occurredAt:
            completed
              ? event?.occurredAt ||
                (current
                  ? sellerOrder.updatedAt
                  : null)
              : null,
        }
      },
    ),
  ]

  return (
    <div className="rounded-2xl border border-indigo-100 bg-[#f8faff] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">
            Order journey
          </p>

          <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">
            Follow each completed milestone from payment to delivery.
          </p>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClass(
            sellerOrder.status,
          )}`}
        >
          {label(
            sellerOrder.status,
          )}
        </span>
      </div>

      <div className="space-y-0">
        {journeySteps.map(
          (
            step,
            stepIndex,
          ) => {
            const isLast =
              stepIndex ===
              journeySteps.length -
                1

            return (
              <div
                key={
                  step.key
                }
                className="relative flex gap-3 pb-6 last:pb-0"
              >
                {!isLast && (
                  <span
                    className={`absolute left-[13px] top-7 h-[calc(100%-0.65rem)] w-0.5 rounded-full ${
                      step.completed
                        ? 'bg-emerald-300'
                        : 'bg-stone-200'
                    }`}
                    aria-hidden="true"
                  />
                )}

                <div
                  className={`relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 bg-white ${
                    step.current
                      ? 'border-indigo-500 ring-4 ring-indigo-100'
                      : step.completed
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-stone-300 text-stone-300'
                  }`}
                >
                  {step.current &&
                  step.key !==
                    'delivered' ? (
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  ) : step.completed ? (
                    <CheckCircle2
                      size={15}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-stone-200" />
                  )}
                </div>

                <div
                  className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 ${
                    step.current
                      ? 'border border-indigo-200 bg-gradient-to-r from-indigo-50/95 via-sky-50/80 to-emerald-50/50 shadow-sm'
                      : 'bg-transparent'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-black ${
                        step.current
                          ? 'text-indigo-900'
                          : step.completed
                            ? 'text-stone-950'
                            : 'text-stone-400'
                      }`}
                    >
                      {step.title}
                    </p>

                    {step.current && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-800">
                        Current
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-1 text-xs leading-5 ${
                      step.completed
                        ? 'text-stone-500'
                        : 'text-stone-400'
                    }`}
                  >
                    {step.occurredAt
                      ? formatTimestamp(
                          step.occurredAt,
                        )
                      : step.description}
                  </p>

                  {step.current &&
                    step.key ===
                      'out_for_delivery' && (
                      <div className="mt-3">
                        <p className="mb-3 text-xs font-semibold leading-5 text-stone-600">
                          Your order has left the Host and is moving toward your delivery address.
                        </p>

                        <DeliveryTruckAnimation />
                      </div>
                    )}
                </div>
              </div>
            )
          },
        )}
      </div>
    </div>
  )
}

export default function OrderDetailPage() {
  const {
    orderId,
  } =
    useParams()

  const {
    currentUser,
  } =
    useAuth()

  const [
    data,
    setData,
  ] =
    useState(
      null,
    )

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    )

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState(
      '',
    )

  const load =
    useCallback(
      async ({
        refresh =
          false,
      } = {}) => {
        if (
          !orderId
        ) {
          setError(
            'Order ID is missing.',
          )

          setLoading(
            false,
          )

          return
        }

        if (
          refresh
        ) {
          setRefreshing(
            true,
          )
        } else {
          setLoading(
            true,
          )
        }

        setError(
          '',
        )

        try {
          setData(
            await getOrder(
              orderId,
            ),
          )
        } catch (
          loadError
        ) {
          setError(
            getCommerceErrorMessage(
              loadError,
              'Unable to load Order detail.',
            ),
          )
        } finally {
          setLoading(
            false,
          )

          setRefreshing(
            false,
          )
        }
      },
      [
        orderId,
      ],
    )

  useEffect(
    () => {
      load()
    },
    [
      load,
    ],
  )

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-8">
          <div className="h-[600px] animate-pulse rounded-[30px] border border-emerald-100 bg-white" />
        </div>
      </main>
    )
  }

  if (
    error &&
    !data
  ) {
    return (
      <main className="min-h-screen bg-[#f7f5ef]">
        <div className="page-shell py-10">
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-7 text-rose-900 shadow-sm">
            <h1 className="font-black">
              Order unavailable
            </h1>

            <p className="mt-2 text-sm">
              {error}
            </p>
          </div>
        </div>
      </main>
    )
  }

  const order =
    data?.order ||
    {}

  const sellerOrders =
    data?.sellerOrders ||
    []

  const timeline =
    data?.timeline ||
    []

  const orderDisplayTitle =
    getOrderDisplayTitle(
      sellerOrders,
    )

  return (
    <main className="min-h-screen bg-[#f7f5ef]">
      <div className="page-shell pb-5 pt-0 sm:pb-8 sm:pt-0">
        <Link
          to="/orders"
          className="focus-ring inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-stone-600 transition-colors hover:text-emerald-800"
        >
          <ArrowLeft
            size={17}
            aria-hidden="true"
          />

          Back to Orders
        </Link>

        <section className="relative mt-3 overflow-hidden rounded-[30px] border border-teal-200 bg-gradient-to-br from-[#DDF7EE] via-[#EAF4FF] to-[#F2ECFF] shadow-[0_18px_50px_rgba(37,99,235,0.10)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-teal-100/70 via-sky-100/60 to-violet-100/40" />

          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-emerald-800 backdrop-blur-sm">
                <PackageCheck
                  size={16}
                  aria-hidden="true"
                />

                <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                  Order tracking
                </p>
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-stone-950 sm:text-4xl">
                {orderDisplayTitle}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                Track payment, seller promises and every recorded order update in one place.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(
                    order.status,
                  )}`}
                >
                  {label(
                    order.status,
                  )}
                </span>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(
                    order.paymentStatus,
                  )}`}
                >
                  Payment{' '}
                  {label(
                    order.paymentStatus,
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadOrderReceipt({
                    order,
                    sellerOrders,
                    customerName:
                      currentUser?.name ||
                      'Customer',
                  })
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-800 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-900"
              >
                <Download
                  size={16}
                  aria-hidden="true"
                />

                Download Receipt
              </button>

              <button
                type="button"
                onClick={() =>
                  load({
                    refresh:
                      true,
                  })
                }
                disabled={
                  refreshing
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={16}
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                  aria-hidden="true"
                />

                {refreshing
                  ? 'Refreshing'
                  : 'Refresh order'}
              </button>
            </div>
          </div>

          <div className="relative grid gap-3 border-t border-sky-200 bg-[#EEF4FF] p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-2xl border border-sky-200 bg-sky-50/90 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
                    Items
                  </p>

                  <p className="mt-1.5 text-xl font-black text-stone-950">
                    {formatMoney(
                      order.totals
                        ?.itemSubtotalMinor,

                      order.totals
                        ?.currency,
                    )}
                  </p>
                </div>

                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sky-800">
                  <ReceiptText
                    size={18}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/90 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                    Fees
                  </p>

                  <p className="mt-1.5 text-xl font-black text-stone-950">
                    {formatMoney(
                      order.totals
                        ?.knownFeesMinor,

                      order.totals
                        ?.currency,
                    )}
                  </p>
                </div>

                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-800 shadow-sm">
                  <WalletCards
                    size={18}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-700 to-emerald-900 p-4 text-white shadow-[0_12px_30px_rgba(4,120,87,0.18)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
                    Total landed cost
                  </p>

                  <p className="mt-1.5 text-xl font-black">
                    {formatMoney(
                      order.totals
                        ?.totalLandedCostMinor,

                      order.totals
                        ?.currency,
                    )}
                  </p>
                </div>

                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/12 text-white ring-1 ring-inset ring-white/20">
                  <CheckCircle2
                    size={19}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {order.deliveryAddressSnapshot && (
          <section className="mt-5 rounded-[28px] border border-emerald-200 bg-[#eaf9f3] p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white">
                <MapPin
                  size={18}
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                  Delivery address at checkout
                </p>

                <p className="mt-1 text-base font-black text-stone-950">
                  {order.deliveryAddressSnapshot.recipientName || 'Recipient'}
                  {order.deliveryAddressSnapshot.phone
                    ? ` · ${order.deliveryAddressSnapshot.phone}`
                    : ''}
                </p>

                <p className="mt-1 max-w-5xl text-sm font-semibold leading-6 text-stone-600">
                  {formatDeliveryAddress(
                    order.deliveryAddressSnapshot,
                  )}
                </p>

                {order.deliveryAddressSnapshot.deliveryInstructions && (
                  <p className="mt-2 text-xs font-semibold text-stone-500">
                    Delivery note: {order.deliveryAddressSnapshot.deliveryInstructions}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm">
            {error}
          </div>
        )}

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {sellerOrders.map(
            (
              sellerOrder,
            ) => (
              <article
                key={
                  sellerOrder.id
                }
                className="flex min-h-[780px] flex-col overflow-hidden rounded-[28px] border border-violet-200 bg-white shadow-[0_16px_42px_rgba(76,29,149,0.09)] lg:h-[840px] xl:h-[880px]"
              >
                <div className="flex shrink-0 flex-col gap-4 border-b border-violet-200 bg-gradient-to-r from-violet-100 via-indigo-50 to-sky-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-700 text-white shadow-sm">
                      <Store
                        size={19}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                        Seller promise
                      </p>

                      <h2 className="mt-0.5 truncate text-lg font-black text-stone-950">
                        {
                          sellerOrder
                            .sellerName
                        }
                      </h2>
                    </div>
                  </div>

                  <span
                    className={`w-fit rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(
                      sellerOrder.status,
                    )}`}
                  >
                    {label(
                      sellerOrder.status,
                    )}
                  </span>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
                  {sellerProblemCopy(
                    sellerOrder.status,
                  ) && (
                    <div className="border-b border-rose-200 bg-rose-50 px-5 py-4 sm:px-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
                        This delivery needs attention
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-rose-900">
                        {sellerProblemCopy(
                          sellerOrder.status,
                        )}
                      </p>
                    </div>
                  )}

                  <div className="border-b border-violet-100 bg-white p-5 sm:p-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                      Items in this Host delivery
                    </p>

                    <p className="mt-1 text-sm font-semibold text-stone-500">
                      {(sellerOrder.items || []).length} item{(sellerOrder.items || []).length === 1 ? '' : 's'} tied to {sellerOrder.sellerName || 'this Host'}.
                    </p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(sellerOrder.items || []).map(
                        (item) => (
                          <div
                            key={item.cartItemId || item.offerId || item.displayName}
                            className="rounded-2xl border border-violet-100 bg-[#faf8ff] px-4 py-3"
                          >
                            <p className="text-sm font-black leading-5 text-stone-950">
                              {item.displayName || 'Marketplace item'}
                            </p>

                            {sellerItemQuantity(
                              item,
                            ) && (
                              <p className="mt-1 text-xs font-semibold text-stone-500">
                                {sellerItemQuantity(
                                  item,
                                )}
                              </p>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 border-b border-violet-100 bg-[#fffdfd] p-5 sm:grid-cols-2 sm:p-6">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700 shadow-sm ring-1 ring-rose-200">
                          <ShieldCheck
                            size={17}
                            aria-hidden="true"
                          />
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-700">
                            Cancellation promise
                          </p>

                          <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
                            {
                              sellerOrder
                                .promise
                                ?.cancellationPolicySummary ||
                              'Not captured'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-4">
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800 shadow-sm ring-1 ring-blue-200">
                          <RotateCcw
                            size={17}
                            aria-hidden="true"
                          />
                        </div>

                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
                            Return promise
                          </p>

                          <p className="mt-2 text-xs font-semibold leading-5 text-stone-700">
                            {
                              sellerOrder
                                .promise
                                ?.returnPolicySummary ||
                              'Not captured'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <SellerJourneyTimeline
                      order={order}
                      timeline={timeline}
                      sellerOrder={sellerOrder}
                    />
                  </div>
                </div>

                <div className="shrink-0 border-t border-violet-100 bg-gradient-to-r from-white via-violet-50/60 to-sky-50/60 px-5 py-3 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                      Scroll inside this card for the complete delivery journey
                    </p>

                    <Clock3
                      size={16}
                      className="shrink-0 text-violet-700"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </article>
            ),
          )}
        </section>
      </div>
    </main>
  )
}
