import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight,
  Clock3, FileCheck2, MapPin, PackageCheck, PackageOpen,
  RefreshCw, RotateCcw, Save, ShieldCheck, ShoppingBag,
  Store, Truck, XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getCatalogProducts } from '../../grocery/services/catalog.service'
import { listHostListingPackets } from '../services/hostUnifiedListing.service'
import {
  createCommerceIdempotencyKey,
  getCommerceErrorMessage,
  getHostOrder,
  updateHostOrderStatus,
} from '../../commerce/services/commerce.service'

const TRANSITIONS =
  Object.freeze({
    confirmed: [
      'seller_accepted',
      'rejected',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    seller_accepted: [
      'picking',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    picking: [
      'packed',
      'partial_unavailable',
      'substitution_requested',
      'seller_cancelled',
    ],

    packed: [
      'carrier_handoff',
      'out_for_delivery',
      'seller_cancelled',
    ],

    carrier_handoff: [
      'out_for_delivery',
      'delivered',
      'delivery_failed',
    ],

    out_for_delivery: [
      'delivered',
      'delivery_failed',
    ],

    delivery_failed: [
      'out_for_delivery',
      'returned',
    ],

    substitution_requested: [
      'seller_accepted',
      'partial_unavailable',
      'seller_cancelled',
    ],

    return_requested: [
      'returned',
    ],

    returned: [
      'refunded',
    ],
  })

const PRIMARY_FLOW = [
  {
    key: 'confirmed',
    label: 'Confirmed',
    description: 'Paid order received from the customer.',
    icon: ShoppingBag,
  },
  {
    key: 'seller_accepted',
    label: 'Accepted',
    description: 'You accepted responsibility for this order.',
    icon: CheckCircle2,
  },
  {
    key: 'picking',
    label: 'Picking',
    description: 'Items are being prepared for packing.',
    icon: PackageOpen,
  },
  {
    key: 'packed',
    label: 'Packed',
    description: 'Order is packed and ready to dispatch.',
    icon: PackageCheck,
  },
  {
    key: 'carrier_handoff',
    label: 'Handoff',
    description: 'Order has been handed to the carrier.',
    icon: Truck,
  },
  {
    key: 'out_for_delivery',
    label: 'Out for delivery',
    description: 'Order is on the way to the customer.',
    icon: Truck,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Order has reached the customer.',
    icon: Check,
  },
]

const TERMINAL_STATUSES = new Set([
  'delivered',
  'rejected',
  'seller_cancelled',
  'returned',
  'refunded',
])

const PROBLEM_STATUSES = new Set([
  'rejected',
  'partial_unavailable',
  'substitution_requested',
  'seller_cancelled',
  'delivery_failed',
  'return_requested',
  'returned',
  'refunded',
])

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

function orderDisplayName(
  order,
) {
  const names =
    (
      order?.items ||
      []
    )
      .map(
        (
          item,
        ) =>
          String(
            item?.displayName ||
              '',
          ).trim(),
      )
      .filter(
        Boolean,
      )

  if (
    names.length ===
    0
  ) {
    return 'Host order'
  }

  if (
    names.length ===
    1
  ) {
    return names[0]
  }

  return `${names[0]} + ${
    names.length -
    1
  } more`
}

function statusTone(
  status,
) {
  if (
    status ===
    'delivered'
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  }

  if (
    PROBLEM_STATUSES.has(
      status,
    )
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800'
  }

  if (
    status ===
      'confirmed' ||
    status ===
      'seller_accepted'
  ) {
    return 'border-sky-200 bg-sky-50 text-sky-800'
  }

  return 'border-violet-200 bg-violet-50 text-violet-800'
}

function mobilePolicySummary(
  value,
  type,
) {
  const text = String(
    value ||
      '',
  ).trim()

  if (
    !text
  ) {
    return 'Not captured'
  }

  if (
    type ===
      'cancellation' &&
    text ===
      'Orders may be cancelled before packing begins. Once dispatched, cancellation is not available.'
  ) {
    return 'Cancel before packing. After dispatch, cancellation is no longer available.'
  }

  if (
    type ===
      'returns' &&
    text ===
      'Damaged, incorrect, or missing items may be reported within 24 hours of delivery for review and eligible resolution.'
  ) {
    return 'Damaged, wrong or missing items can be reported within 24 hours of delivery.'
  }

  return text
}

function formatDateTime(
  value,
) {
  if (
    !value
  ) {
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

function findStepState(
  currentStatus,
  stepKey,
) {
  const currentIndex =
    PRIMARY_FLOW.findIndex(
      (
        step,
      ) =>
        step.key ===
        currentStatus,
    )

  const stepIndex =
    PRIMARY_FLOW.findIndex(
      (
        step,
      ) =>
        step.key ===
        stepKey,
    )

  if (
    currentStatus ===
    'delivered'
  ) {
    return 'complete'
  }

  if (
    currentIndex ===
    -1
  ) {
    return stepKey ===
      'confirmed'
      ? 'complete'
      : 'pending'
  }

  if (
    stepIndex <
    currentIndex
  ) {
    return 'complete'
  }

  if (
    stepIndex ===
    currentIndex
  ) {
    return 'current'
  }

  return 'pending'
}

const orderDetailStyles = String.raw`
/* Host Order Detail ONLY. Existing navbar, sidebar and footer remain untouched. */
.hod-page{box-sizing:border-box;--forest:#173F35;--deep:#10372F;--clay:#C66D46;--charcoal:#222925;--sage:#E4EBE1;--porcelain:#F7F6F2;--muted:#59685F;--line:#DAE1D7;color:var(--charcoal);background:var(--porcelain);width:100%;min-width:0;padding:clamp(14px,2.3vw,36px) clamp(12px,2.5vw,42px) 58px;font-family:'Plus Jakarta Sans',Inter,ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.55}
.hod-page *,.hod-page *::before,.hod-page *::after{box-sizing:border-box}
.hod-page :is(button,select,a){font-family:inherit}
.hod-page :is(button,select,a):focus-visible{outline:3px solid var(--clay);outline-offset:3px}
.hod-wrap{width:100%;min-width:0;max-width:none;margin:0 auto}
.hod-topline{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:17px}
.hod-back{display:inline-flex;align-items:center;gap:9px;color:var(--forest);font-size:14px;font-weight:750;text-decoration:none}
.hod-back:hover{color:#A65032}
.hod-refresh{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:9px 13px;border-radius:9px;border:1px solid #CAD6CA;background:#FFFDF9;color:var(--forest);font-size:13px;font-weight:750;cursor:pointer}
.hod-refresh:hover{background:#E6EFE6;border-color:#87AA94}
.hod-hero{display:grid;grid-template-columns:minmax(0,1.57fr) minmax(300px,.71fr);border-radius:16px 16px 0 0;overflow:hidden;min-width:0;background:var(--deep)}
.hod-hero-main{position:relative;overflow:hidden;isolation:isolate;background:linear-gradient(114deg,#12392F 5%,#1B493C 100%);padding:clamp(27px,3.3vw,49px);color:#fff}
.hod-hero-main::after{content:'';position:absolute;right:-230px;bottom:-280px;width:570px;height:570px;border-radius:50%;pointer-events:none;z-index:-1;border:1px solid rgba(255,255,255,.13);box-shadow:0 0 0 37px rgba(255,255,255,.03),0 0 0 90px rgba(255,255,255,.022)}
.hod-kicker{display:flex;align-items:center;gap:10px;color:#FAC7AE;font-size:12px;font-weight:850;letter-spacing:.11em;text-transform:uppercase}
.hod-kicker::before{content:'';height:2px;width:25px;background:#E7A183}
.hod-order-title{font-size:clamp(29px,2.85vw,43px)!important;font-weight:800!important;line-height:1.15!important;letter-spacing:-.046em!important;color:#FCFAF5!important;margin:15px 0 0!important;max-width:900px;overflow-wrap:anywhere}
.hod-hero-reference{display:flex;gap:11px;align-items:center;flex-wrap:wrap;margin-top:18px;color:#D9E5DC;font-size:14px;font-weight:650}
.hod-hero-reference b{color:#FFFFFF;font-weight:800}
.hod-hero-description{max-width:570px;margin:19px 0 0;color:#E3EBE2;font-size:15px;line-height:1.6}
.hod-hero-side{padding:clamp(25px,2.6vw,38px);min-width:0;background:#E3EAE0;border-left:4px solid var(--clay);display:flex;flex-direction:column;justify-content:space-between;gap:23px}
.hod-side-head{font-size:12px;color:#A54B2C;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
.hod-side-current{font-size:24px!important;line-height:1.24!important;color:var(--forest)!important;font-weight:800!important;margin:9px 0 0!important}
.hod-side-sub{font-size:14px;color:#4D6656;margin:8px 0 0}
.hod-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding-top:17px;border-top:1px solid #C2D1C4}
.hod-metric strong{display:block;font-size:25px;line-height:1.2;color:var(--forest);font-weight:850;font-variant-numeric:tabular-nums}
.hod-metric span{display:block;margin-top:3px;font-size:13px;color:#58685F}
.hod-fulfillment{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;color:#FFF9F2;background:var(--forest);text-decoration:none;font-size:14px;font-weight:750;padding:12px 15px;border-radius:8px;min-height:43px}
.hod-fulfillment:hover{background:#225B4A;color:#FFF9F2}
.hod-flow{display:flex;align-items:center;flex-wrap:wrap;gap:0;background:#F3E5DB;border-bottom:1px solid #E7CDC1;min-height:56px;padding:0 clamp(18px,2.9vw,37px)}
.hod-flow a{display:inline-flex;align-items:center;gap:8px;padding:15px 19px 15px 0;margin-right:23px;color:#704332;text-decoration:none;font-size:13px;font-weight:760}
.hod-flow a:hover{color:#173F35;text-decoration:underline;text-underline-offset:4px}
.hod-flow b{font-weight:850;color:#B65F3C}
.hod-content{margin-top:27px;display:grid;grid-template-columns:minmax(0,1.42fr) minmax(315px,.76fr);gap:22px;align-items:start;min-width:0}
.hod-panel{min-width:0;overflow:hidden;border:1px solid var(--line);border-top:3px solid var(--forest);border-radius:12px;background:#FFFEFB}
.hod-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:25px 27px 19px;border-bottom:1px solid #E2E6DF}
.hod-number{font-size:12px;text-transform:uppercase;color:#AD5637;font-weight:850;letter-spacing:.09em}
.hod-section-title{margin:5px 0 0!important;color:var(--forest)!important;font-size:clamp(23px,2.1vw,30px)!important;font-weight:820!important;line-height:1.18!important;letter-spacing:-.038em!important}
.hod-section-help{margin:7px 0 0!important;color:var(--muted);font-size:14px;line-height:1.5}
.hod-basket-count{background:#E5EEE4;border-radius:7px;color:var(--forest);padding:6px 11px;white-space:nowrap;font-size:13px;font-weight:800}
.hod-items{padding:0 27px 12px}
.hod-item{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:18px;align-items:center;padding:20px 0;border-bottom:1px solid #E2E6DF;min-width:0}
.hod-item:last-child{border-bottom:0}
.hod-item-photo{display:block;width:92px;height:94px;overflow:hidden;border-radius:10px;border:1px solid #DEE5DC;background:#F0F2EC;position:relative}
.hod-item-photo img{width:100%;height:100%;object-fit:cover;display:block}
.hod-photo-unavailable{width:100%;height:100%;display:grid;place-items:center;text-align:center;padding:8px;color:#5C6C60;font-size:11px;font-weight:650;line-height:1.4}
.hod-item-number{font-size:12px;color:#B15C39;font-weight:850;text-transform:uppercase;letter-spacing:.07em}
.hod-item-name{font-size:18px!important;color:#24352C!important;font-weight:800!important;line-height:1.3!important;margin:5px 0!important;overflow-wrap:anywhere}
.hod-item-ref{color:#6B766C;font-size:12px;overflow-wrap:anywhere}
.hod-item-qty{min-width:91px;border-left:1px solid #DEE5D9;padding-left:17px;text-align:left}
.hod-item-qty strong{display:block;font-size:21px;color:var(--forest);line-height:1.25;font-weight:850}
.hod-item-qty span{font-size:12px;color:#617367}
.hod-empty{padding:25px 0;color:#58675F;font-size:15px}
.hod-update{border-top-color:var(--clay);background:#EAF0E8}
.hod-update .hod-panel-head{border-bottom-color:#CDDBCD}
.hod-update-body{padding:24px 27px 28px}
.hod-status-now{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px;color:#476053;margin:0 0 17px}
.hod-badge{display:inline-flex;align-items:center;padding:6px 11px;border:1px solid #BBD6C4;border-radius:100px;background:#E7F2E9;color:#174A35;font-weight:800;font-size:13px;line-height:1.3}
.hod-badge[data-tone='warning']{border-color:#E7B9A3;background:#FBE8DD;color:#A64D2D}
.hod-badge[data-tone='info']{border-color:#BDD8DF;background:#E5F2F4;color:#23566A}
.hod-next-label{display:block;font-size:14px;font-weight:800;color:#294135}
.hod-select{display:block;width:100%;min-height:50px;margin-top:8px;padding:11px 13px;border:1px solid #BFCFC0;border-radius:9px;background:#FFFEFC;color:#26382E;font-size:15px;font-weight:700;outline:none}
.hod-select:focus{border-color:var(--clay);box-shadow:0 0 0 3px #C66D4622}
.hod-submit{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:47px;width:100%;margin-top:15px;padding:12px 18px;border:1px solid var(--clay);border-radius:9px;background:var(--clay);color:white;font-size:15px;font-weight:800;cursor:pointer}
.hod-submit:hover:not(:disabled){background:#A9502F;border-color:#A9502F}
.hod-submit:disabled{opacity:.55;cursor:not-allowed}
.hod-complete{display:flex;align-items:flex-start;gap:12px;color:#235043;font-size:15px;line-height:1.55}
.hod-complete svg{flex:none;margin-top:3px}
.hod-alert{display:flex;align-items:flex-start;gap:9px;padding:14px 16px;margin:13px 0 0;border-left:3px solid #B45F40;background:#FFEDE5;color:#833E29;font-size:14px;line-height:1.5}
.hod-alert svg{flex:none;margin-top:1px}
.hod-delivery{margin-top:26px;border-top:3px solid var(--clay);background:#F1F4EE}
.hod-delivery-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-width:0}
.hod-address{padding:24px 27px 27px;min-width:0;border-right:1px solid #D7DFD4}
.hod-address h3,.hod-policy h3{font-size:17px!important;color:var(--forest)!important;font-weight:800!important;margin:0 0 11px!important}
.hod-address-name{font-size:16px;font-weight:800;color:#24382E;overflow-wrap:anywhere}
.hod-address-line{font-size:15px;line-height:1.62;color:#43564B;margin:6px 0 0;overflow-wrap:anywhere}
.hod-address-note{margin-top:12px;padding:11px 13px;border-left:3px solid var(--clay);background:#FFFCF9;color:#5B473B;font-size:14px}
.hod-policy{padding:24px 27px 27px;min-width:0;background:#FCFBF7}
.hod-policy-row{padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid #E4E4DD}
.hod-policy-row:last-child{padding-bottom:0;margin-bottom:0;border-bottom:0}
.hod-policy-label{display:flex;align-items:center;gap:9px;color:#A45034;font-size:14px;font-weight:800}
.hod-policy-row:nth-child(2) .hod-policy-label{color:#356D78}
.hod-policy-text{font-size:14px;line-height:1.57;margin:7px 0 0;color:#48594E;overflow-wrap:anywhere}
.hod-journey{margin-top:26px;border-top-color:var(--forest)}
.hod-journey-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);min-width:0}
.hod-steps{padding:22px 27px 26px;background:#EAF0E8;border-right:1px solid #D8E2D7}
.hod-step{position:relative;display:flex;gap:14px;padding:0 0 20px;min-width:0}
.hod-step:last-child{padding-bottom:0}
.hod-step:not(:last-child)::after{content:'';position:absolute;left:17px;top:35px;bottom:1px;width:2px;background:#CFDBCF}
.hod-step[data-state='complete']:not(:last-child)::after{background:#548C6E}
.hod-step-dot{width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:50%;background:#FFFDF8;border:1px solid #C9D4C8;color:#839187;z-index:1}
.hod-step[data-state='complete'] .hod-step-dot{background:#1C694A;color:#fff;border-color:#1C694A}
.hod-step[data-state='current'] .hod-step-dot{background:#FCF0E9;color:#AF5432;border:2px solid var(--clay)}
.hod-step-info{min-width:0;padding-top:2px}
.hod-step-heading{display:flex;align-items:center;flex-wrap:wrap;gap:9px}
.hod-step-name{font-size:15px;color:#57695F;font-weight:800}
.hod-step[data-state='current'] .hod-step-name,.hod-step[data-state='complete'] .hod-step-name{color:#173F35}
.hod-step-current{border-radius:4px;padding:2px 6px;background:#F3D3C1;color:#964A2F;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.05em}
.hod-step-description{margin:4px 0 0;color:#69776E;font-size:13px;line-height:1.45}
.hod-timeline{padding:23px 27px 29px;min-width:0;background:#FFFEFB}
.hod-timeline-label{font-size:14px;font-weight:800;color:#355143;padding-bottom:15px;border-bottom:1px solid #E2E8E0}
.hod-timeline-event{display:flex;gap:13px;padding:18px 0;border-bottom:1px solid #E2E8E0}
.hod-timeline-event:last-child{border-bottom:0}
.hod-timeline-marker{width:30px;height:30px;display:grid;place-items:center;flex:none;border-radius:8px;background:#E8F1E7;color:#205642}
.hod-timeline-title{font-size:15px;font-weight:800;color:#233A2C;line-height:1.4;overflow-wrap:anywhere}
.hod-timeline-time{font-size:13px;color:#5C6A61;margin-top:5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.hod-timeline-empty{padding:20px 0;color:#5B6B61;font-size:14px}
.hod-loading{border:1px solid #D6DFD4;border-radius:12px;min-height:440px;background:linear-gradient(110deg,#EEF2EC,#FBFCF8,#E9EFE7);animation:hod-pulse 1.2s ease-in-out infinite alternate}
@keyframes hod-pulse{from{opacity:.75}to{opacity:1}}
@media(max-width:1024px){.hod-hero{grid-template-columns:minmax(0,1.2fr) minmax(260px,.8fr)}.hod-content{grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr)}.hod-panel-head,.hod-items,.hod-update-body,.hod-address,.hod-policy,.hod-steps,.hod-timeline{padding-left:20px;padding-right:20px}}
@media(max-width:760px){.hod-hero{grid-template-columns:1fr}.hod-hero-main{padding:27px 24px}.hod-hero-side{border-left:0;border-top:3px solid var(--clay);padding:21px 24px;gap:16px}.hod-hero-side-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.hod-side-current{margin-top:4px;font-size:21px!important}.hod-side-sub{display:none}.hod-metrics{border-top:0;padding-top:0;gap:9px;max-width:300px}.hod-fulfillment{width:100%}.hod-content{grid-template-columns:1fr}.hod-delivery-grid,.hod-journey-grid{grid-template-columns:1fr}.hod-address{border-right:0;border-bottom:1px solid #D7DFD4}.hod-steps{border-right:0;border-bottom:1px solid #D8E2D7}.hod-flow{gap:0}.hod-flow a{margin-right:14px;padding-right:8px}.hod-delivery{margin-top:22px}.hod-journey{margin-top:22px}}
@media(max-width:480px){.hod-page{padding:11px 10px 37px;font-size:15px}.hod-topline{margin-bottom:11px}.hod-back{font-size:13px}.hod-refresh{padding:8px 11px;min-height:37px;font-size:12px}.hod-hero{border-radius:12px 12px 0 0}.hod-hero-main{padding:23px 19px}.hod-kicker{font-size:11px}.hod-order-title{font-size:26px!important;line-height:1.18!important;letter-spacing:-.04em!important;margin-top:11px!important}.hod-hero-description{display:none}.hod-hero-reference{font-size:13px;gap:7px;margin-top:13px}.hod-hero-side{padding:16px 19px}.hod-side-head{font-size:11px}.hod-side-current{font-size:19px!important}.hod-metric strong{font-size:23px}.hod-metric span{font-size:12px}.hod-fulfillment{min-height:41px;padding:10px 12px;font-size:13px}.hod-flow{padding:4px 13px;gap:3px;justify-content:space-between}.hod-flow a{padding:8px 3px;font-size:11px;margin:0;gap:4px}.hod-flow b{font-size:11px}.hod-content{margin-top:18px;gap:18px}.hod-panel{border-radius:9px}.hod-panel-head{padding:17px 15px 14px}.hod-number{font-size:11px}.hod-section-title{font-size:22px!important}.hod-section-help{font-size:13px}.hod-items{padding:0 15px 5px}.hod-basket-count{padding:5px 7px;font-size:12px}.hod-item{grid-template-columns:68px minmax(0,1fr);gap:11px;padding:14px 0}.hod-item-photo{width:68px;height:73px}.hod-item-name{font-size:16px!important;line-height:1.34!important}.hod-item-number{font-size:11px}.hod-item-ref{font-size:12px}.hod-item-qty{grid-column:2;min-width:0;display:flex;gap:7px;align-items:baseline;border:0;padding:0}.hod-item-qty strong{font-size:17px}.hod-item-qty span{font-size:12px}.hod-update-body{padding:17px 15px 21px}.hod-status-now{font-size:13px}.hod-next-label{font-size:13px}.hod-select{font-size:15px}.hod-submit{font-size:14px}.hod-delivery,.hod-journey{margin-top:20px}.hod-address,.hod-policy,.hod-steps,.hod-timeline{padding:17px 15px 21px}.hod-address h3,.hod-policy h3{font-size:16px!important}.hod-address-line{font-size:14px}.hod-policy-text{font-size:13px}.hod-step{gap:11px;padding-bottom:15px}.hod-step-name{font-size:14px}.hod-step-description{font-size:12.5px}.hod-timeline-title{font-size:14px}.hod-timeline-time{font-size:12.5px}}
@media(prefers-reduced-motion:reduce){.hod-loading{animation:none}}
`;

// Show only verified, real EPANTRY catalog / approved Host listing photographs.
// Never display a generated or unrelated fallback image for an order item.
function safeProductImageUrl(value) {
  const raw = String(value || '').trim()
  return (/^https?:\/\//i.test(raw) || /^\/(?!\/)/.test(raw)) ? raw : ''
}

function pictureFromProduct(product) {
  return safeProductImageUrl(
    product?.image?.url || product?.imageUrl || product?.thumbnailUrl ||
    product?.images?.[0]?.url || product?.images?.[0] ||
    product?.packet?.images?.[0]?.url || product?.packet?.images?.[0] ||
    product?.packet?.imageUrl,
  )
}

function normalizeProductTitle(name) {
  return String(name || '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function itemPhotoKey(item, index) {
  return String(item?.cartItemId || item?.offerId || item?.productVersionId || index)
}

function HostOrderItemPhoto({ imageUrl, name }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [imageUrl])
  return (
    <span className="hod-item-photo">
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={name || 'Ordered product'} loading="eager"
          decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span className="hod-photo-unavailable">Photo unavailable</span>
      )}
    </span>
  )
}

export default function HostOrderDetailPage() {
  const { orderId } = useParams()
  const [data, setData] = useState(null)
  const [nextStatus, setNextStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [itemImages, setItemImages] = useState({})

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError('')
    try {
      setData(await getHostOrder(orderId))
    } catch (loadError) {
      setError(getCommerceErrorMessage(loadError, 'Unable to load this order.'))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { load() }, [load])

  const allowed = useMemo(
    () => TRANSITIONS[data?.order?.status] || [],
    [data?.order?.status],
  )
  useEffect(() => { setNextStatus(allowed[0] || '') }, [allowed])

  // Read exact product identities from this order and reuse the same real
  // EPANTRY image sources used by the Host Orders list. Failures here never
  // prevent updating order status or viewing the rest of an order.
  useEffect(() => {
    const items = data?.order?.items || []
    if (!items.length) return undefined
    let live = true
    const matched = new Set()
    const publish = (products) => {
      const additions = {}
      for (const candidate of products || []) {
        const url = pictureFromProduct(candidate)
        if (!url) continue
        const candidateName = normalizeProductTitle(
          candidate?.displayName || candidate?.title || candidate?.name || candidate?.packet?.title,
        )
        const candidateVersion = String(
          candidate?.productVersionId || candidate?.id || candidate?.packet?.catalogProductVersionId || '',
        )
        items.forEach((item, index) => {
          const key = itemPhotoKey(item, index)
          if (matched.has(key) || pictureFromProduct(item)) return
          const targetVersion = String(item?.productVersionId || '')
          const titleMatches = candidateName && candidateName === normalizeProductTitle(item?.displayName)
          if ((targetVersion && candidateVersion && targetVersion === candidateVersion) || titleMatches) {
            matched.add(key)
            additions[key] = url
          }
        })
      }
      if (live && Object.keys(additions).length) {
        setItemImages((previous) => ({ ...previous, ...additions }))
      }
    }

    // Orders may already contain their image snapshots. Prefer those and
    // avoid waiting for catalog searches before first render.
    items.forEach((item, index) => {
      if (pictureFromProduct(item)) matched.add(itemPhotoKey(item, index))
    })
    const hostTask = listHostListingPackets()
      .then((response) => publish((response?.listings || [])
        .filter((listing) => listing?.status === 'approved')
        .map((listing) => ({
          ...listing,
          displayName: listing?.title || listing?.packet?.title,
          productVersionId: listing?.packet?.catalogProductVersionId,
        }))))
      .catch(() => {})

    let pageCount = 1
    const catalogTask = getCatalogProducts({ page: 1, limit: 100 })
      .then((result) => {
        publish(result?.products || [])
        pageCount = Math.min(6, Math.max(1, Number(result?.pagination?.pages || 1)))
      }).catch(() => {})

    const findRemaining = async () => {
      await Promise.allSettled([hostTask, catalogTask])
      if (!live) return
      const missing = items.filter((item, index) =>
        !matched.has(itemPhotoKey(item, index)) && !pictureFromProduct(item))
      if (!missing.length) return
      await Promise.allSettled(missing.map(async (item) => {
        const name = String(item?.displayName || '').trim()
        if (!name) return
        const result = await getCatalogProducts({ search: name, page: 1, limit: 20 })
        publish(result?.products || [])
      }))
      if (!live || matched.size === items.length || pageCount <= 1) return
      await Promise.allSettled(Array.from({ length: pageCount - 1 }, (_, offset) =>
        getCatalogProducts({ page: offset + 2, limit: 100 })
          .then((result) => publish(result?.products || []))))
    }
    findRemaining().catch(() => {})
    return () => { live = false }
  }, [data?.order?.id])

  async function handleStatusUpdate() {
    if (!orderId || !nextStatus || saving) return
    setSaving(true)
    setError('')
    try {
      setData(await updateHostOrderStatus({
        orderId,
        status: nextStatus,
        idempotencyKey: createCommerceIdempotencyKey('host-order-status'),
      }))
    } catch (updateError) {
      setError(getCommerceErrorMessage(updateError, 'Unable to update this order.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="hod-page">
        <style>{orderDetailStyles}</style>
        <div className="hod-loading" role="status" aria-label="Loading order details" />
      </main>
    )
  }

  const order = data?.order || {}
  const items = order.items || []
  const shortOrderId = order.id?.slice(-8).toUpperCase() || '—'
  const isTerminal = TERMINAL_STATUSES.has(order.status)
  const itemCount = items.reduce((total, item) => total + Number(item.packCount || 0), 0)
  const delivery = order.fulfillment?.deliveryAddressSnapshot
  const timeline = data?.timeline || []
  const statusKind = PROBLEM_STATUSES.has(order.status) ? 'warning'
    : order.status === 'confirmed' || order.status === 'seller_accepted' ? 'info' : 'success'

  return (
    <main className="hod-page">
      <style>{orderDetailStyles}</style>
      <div className="hod-wrap">
        <div className="hod-topline">
          <Link to="/host/orders" className="hod-back"><ArrowLeft size={17} /> Back to orders</Link>
          <button type="button" className="hod-refresh" onClick={load} disabled={saving}>
            <RefreshCw size={15} /> Refresh order
          </button>
        </div>

        <header className="hod-hero">
          <div className="hod-hero-main">
            <p className="hod-kicker">Host / Order management</p>
            <h1 className="hod-order-title">{orderDisplayName(order)}</h1>
            <div className="hod-hero-reference">
              <span>Order <b>#{shortOrderId}</b></span>
              <span aria-hidden="true">·</span>
              <span>{itemCount} {itemCount === 1 ? 'pack' : 'packs'}</span>
            </div>
            <p className="hod-hero-description">Review the items and delivery details, then move this order through fulfilment.</p>
          </div>
          <aside className="hod-hero-side" aria-label="Order overview">
            <div className="hod-hero-side-top">
              <div>
                <p className="hod-side-head">Current order status</p>
                <h2 className="hod-side-current">{label(order.status)}</h2>
                <p className="hod-side-sub">Follow the order from acceptance to delivery.</p>
              </div>
              <span className="hod-badge" data-tone={statusKind}>{label(order.status)}</span>
            </div>
            <div className="hod-metrics">
              <div className="hod-metric"><strong>{itemCount}</strong><span>Total packs</span></div>
              <div className="hod-metric"><strong>{timeline.length}</strong><span>Status updates</span></div>
            </div>
            <Link to="/host/fulfillment" className="hod-fulfillment">
              Open fulfillment <ChevronRight size={17} />
            </Link>
          </aside>
        </header>

        <nav className="hod-flow" aria-label="Order sections">
          <a href="#hod-items"><b>01</b> Order items</a>
          <a href="#hod-update"><b>02</b> Update status</a>
          <a href="#hod-delivery"><b>03</b> Delivery</a>
          <a href="#hod-journey"><b>04</b> History</a>
        </nav>

        {error && (
          <div className="hod-alert" role="alert"><AlertTriangle size={18} /> {error}</div>
        )}

        <div className="hod-content">
          <section id="hod-items" className="hod-panel">
            <div className="hod-panel-head">
              <div>
                <p className="hod-number">01 / Customer's basket</p>
                <h2 className="hod-section-title">Order items</h2>
                <p className="hod-section-help">Products and quantities to prepare.</p>
              </div>
              <span className="hod-basket-count">{itemCount} {itemCount === 1 ? 'pack' : 'packs'}</span>
            </div>
            <div className="hod-items">
              {items.length === 0 ? (
                <p className="hod-empty">No order items are available.</p>
              ) : items.map((item, index) => (
                <div key={`${item.offerId || ''}-${item.cartItemId || index}`} className="hod-item">
                  <HostOrderItemPhoto
                    imageUrl={pictureFromProduct(item) || itemImages[itemPhotoKey(item, index)] || ''}
                    name={item.displayName}
                  />
                  <div className="min-w-0">
                    <p className="hod-item-number">Item {String(index + 1).padStart(2, '0')}</p>
                    <h3 className="hod-item-name">{item.displayName || 'Product name unavailable'}</h3>
                    <p className="hod-item-ref">Listing ref {String(item.offerId || '—')}</p>
                  </div>
                  <div className="hod-item-qty">
                    <strong>{Number(item.packCount || 0)}</strong>
                    <span>{Number(item.packCount || 0) === 1 ? 'pack' : 'packs'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="hod-update" className="hod-panel hod-update">
            <div className="hod-panel-head">
              <div>
                <p className="hod-number">02 / Take action</p>
                <h2 className="hod-section-title">Update order status</h2>
                <p className="hod-section-help">Choose the next stage when it's completed.</p>
              </div>
            </div>
            <div className="hod-update-body">
              <p className="hod-status-now">Current: <span className="hod-badge" data-tone={statusKind}>{label(order.status)}</span></p>
              {allowed.length > 0 ? (
                <>
                  <label className="hod-next-label" htmlFor="hod-next-status">Next status</label>
                  <select id="hod-next-status" className="hod-select" value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value)}>
                    {allowed.map((status) => <option key={status} value={status}>{label(status)}</option>)}
                  </select>
                  <button type="button" className="hod-submit" onClick={handleStatusUpdate}
                    disabled={!nextStatus || saving}>
                    <Save size={17} /> {saving ? 'Updating…' : 'Save order status'}
                  </button>
                </>
              ) : (
                <div className="hod-complete">
                  {isTerminal ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
                  <span>{isTerminal
                    ? 'This order is complete. No further status update is needed.'
                    : 'No status update is available right now.'}</span>
                </div>
              )}
              {PROBLEM_STATUSES.has(order.status) && (
                <div className="hod-alert"><AlertTriangle size={18} /> This order needs attention. Check its current status before proceeding.</div>
              )}
            </div>
          </section>
        </div>

        <section id="hod-delivery" className="hod-panel hod-delivery">
          <div className="hod-panel-head">
            <div>
              <p className="hod-number">03 / Customer information</p>
              <h2 className="hod-section-title">Delivery & policies</h2>
            </div>
          </div>
          <div className="hod-delivery-grid">
            <div className="hod-address">
              <h3><MapPin size={17} className="inline-block align-[-3px] mr-1.5" /> Delivery address</h3>
              {delivery ? (
                <>
                  <p className="hod-address-name">
                    {delivery.recipientName || 'Recipient'}
                    {delivery.phone ? ` · ${delivery.phone}` : ''}
                  </p>
                  <p className="hod-address-line">{formatDeliveryAddress(delivery) || 'Address not available'}</p>
                  {delivery.deliveryInstructions && (
                    <p className="hod-address-note">Delivery note: {delivery.deliveryInstructions}</p>
                  )}
                </>
              ) : <p className="hod-address-line">No delivery address captured for this order.</p>}
            </div>
            <div className="hod-policy">
              <h3><ShieldCheck size={17} className="inline-block align-[-3px] mr-1.5" /> Customer policies</h3>
              <div className="hod-policy-row">
                <p className="hod-policy-label"><XCircle size={17} /> Cancellation</p>
                <p className="hod-policy-text">{data?.promise?.cancellationPolicySummary || 'Not captured'}</p>
              </div>
              <div className="hod-policy-row">
                <p className="hod-policy-label"><RotateCcw size={17} /> Returns</p>
                <p className="hod-policy-text">{data?.promise?.returnPolicySummary || 'Not captured'}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="hod-journey" className="hod-panel hod-journey">
          <div className="hod-panel-head">
            <div>
              <p className="hod-number">04 / Order progress</p>
              <h2 className="hod-section-title">Tracking & history</h2>
              <p className="hod-section-help">See what's completed and review every status update.</p>
            </div>
            <span className="hod-basket-count">{timeline.length} {timeline.length === 1 ? 'update' : 'updates'}</span>
          </div>
          <div className="hod-journey-grid">
            <div className="hod-steps">
              {PRIMARY_FLOW.map((step) => {
                const state = findStepState(order.status, step.key)
                const Icon = step.icon
                return (
                  <div className="hod-step" data-state={state} key={step.key}>
                    <span className="hod-step-dot">
                      {state === 'complete' ? <Check size={16} strokeWidth={2.7} /> : <Icon size={17} />}
                    </span>
                    <div className="hod-step-info">
                      <div className="hod-step-heading">
                        <span className="hod-step-name">{step.label}</span>
                        {state === 'current' && <span className="hod-step-current">Current</span>}
                      </div>
                      <p className="hod-step-description">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hod-timeline">
              <p className="hod-timeline-label">Status updates</p>
              {timeline.length === 0 ? (
                <p className="hod-timeline-empty">No status updates yet.</p>
              ) : timeline.map((event, index) => (
                <div className="hod-timeline-event" key={event.id || index}>
                  <span className="hod-timeline-marker"><CheckCircle2 size={17} /></span>
                  <div>
                    <p className="hod-timeline-title">
                      {label(event.fromStatus)} <span aria-hidden="true">→</span> {label(event.toStatus)}
                    </p>
                    <p className="hod-timeline-time">
                      <Clock3 size={14} /> {formatDateTime(event.occurredAt) || 'Time unavailable'}
                      <span>· Update {index + 1}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
