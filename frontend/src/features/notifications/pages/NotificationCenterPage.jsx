import {
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  Inbox,
  LoaderCircle,
  PackageCheck,
  Package,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Truck,
  Warehouse,
  UsersRound,
  ShieldCheck,
  Layers3,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import {
  getAnalyticsErrorMessage,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  performNotificationAction,
  updateNotificationPreferences,
} from "../../analytics/services/analytics.service";

const UNREAD_STATUSES = new Set(["pending", "delivered", "action_required_domain"]);

const PREFERENCE_KEYS = [
  "inAppEnabled",
  "emailEnabled",
  "planningEnabled",
  "pantryEnabled",
  "householdEnabled",
  "orderEnabled",
  "operationsEnabled",
  "priceEnabled",
  "marketingEnabled",
];

// Group existing notification evidence; do not infer a delivery from an ordinary order update.
const NOTIFICATION_GROUPS = [
  {
    id: "orders",
    title: "Orders",
    description: "Order confirmations, preparation and item changes",
    Icon: Package,
    surface: "bg-[#E7EEF8]",
    iconSurface: "bg-[#CFDEF4] text-[#254A75]",
    accent: "bg-[#4777AF]",
    count: "text-[#254A75]",
    mobileSurface: "bg-[#EDF4FF]",
    mobileUnreadBorder: "border-l-[#5283C4]",
  },
  {
    id: "delivery",
    title: "Delivery updates",
    description: "Dispatch, handoff and delivery progress",
    Icon: Truck,
    surface: "bg-[#E4F2EA]",
    iconSurface: "bg-[#C7E8D6] text-[#15563D]",
    accent: "bg-[#27845A]",
    count: "text-[#15563D]",
    mobileSurface: "bg-[#EAF8F0]",
    mobileUnreadBorder: "border-l-[#25986A]",
  },
  {
    id: "pantry",
    title: "Pantry & meal planning",
    description: "Ingredient reminders and meal-plan activity",
    Icon: Warehouse,
    surface: "bg-[#FFF1CE]",
    iconSurface: "bg-[#F9E3A6] text-[#815418]",
    accent: "bg-[#CB8A32]",
    count: "text-[#815418]",
    mobileSurface: "bg-[#FFF7E2]",
    mobileUnreadBorder: "border-l-[#D99B33]",
  },
  {
    id: "household",
    title: "Household & invitations",
    description: "Invites and shared-household activity",
    Icon: UsersRound,
    surface: "bg-[#EEE7FA]",
    iconSurface: "bg-[#DDD0F3] text-[#594083]",
    accent: "bg-[#8A6ABB]",
    count: "text-[#594083]",
    mobileSurface: "bg-[#F5F0FF]",
    mobileUnreadBorder: "border-l-[#9469C7]",
  },
  {
    id: "account",
    title: "Account & operations",
    description: "Security, account and work-related updates",
    Icon: ShieldCheck,
    surface: "bg-[#FBE7DF]",
    iconSurface: "bg-[#F6D4C6] text-[#924931]",
    accent: "bg-[#D47D5A]",
    count: "text-[#924931]",
    mobileSurface: "bg-[#FFF1E9]",
    mobileUnreadBorder: "border-l-[#D27F54]",
  },
  {
    id: "other",
    title: "More updates",
    description: "Prices, learning and other EPANTRY news",
    Icon: Layers3,
    surface: "bg-[#E5EDF0]",
    iconSurface: "bg-[#D1DFE4] text-[#385766]",
    accent: "bg-[#6B90A2]",
    count: "text-[#385766]",
    mobileSurface: "bg-[#EDF7FA]",
    mobileUnreadBorder: "border-l-[#5694A6]",
  },
];

// These are the real Super Admin notification topics defined by the backend's
// controlled trigger taxonomy. The Customer and Host groups above stay intact.
const ADMIN_NOTIFICATION_GROUPS = [
  {
    id: "admin_listings",
    title: "Listing reviews",
    description: "Products, recipes and kitchen listings submitted by Hosts",
    Icon: PackageCheck,
    surface: "bg-[#F3E7DD]",
    iconSurface: "bg-[#EAD2C1] text-[#955235]",
    accent: "bg-[#C56C42]",
    count: "text-[#9A5737]",
    mobileSurface: "bg-[#FAF5F0]",
    mobileUnreadBorder: "border-l-[#C56C42]",
  },
  {
    id: "admin_hosts",
    title: "Host accounts",
    description: "New Host registrations and business profile requests",
    Icon: ShoppingBag,
    surface: "bg-[#E6EBDD]",
    iconSurface: "bg-[#D7DDCF] text-[#173F35]",
    accent: "bg-[#173F35]",
    count: "text-[#173F35]",
    mobileSurface: "bg-[#F5F7F2]",
    mobileUnreadBorder: "border-l-[#456D5B]",
  },
  {
    id: "admin_creators",
    title: "Creator reviews",
    description: "Creator profiles and content awaiting a decision",
    Icon: UsersRound,
    surface: "bg-[#EFECE5]",
    iconSurface: "bg-[#DFE4D9] text-[#173F35]",
    accent: "bg-[#456D5B]",
    count: "text-[#173F35]",
    mobileSurface: "bg-[#F7F6F2]",
    mobileUnreadBorder: "border-l-[#456D5B]",
  },
  {
    id: "admin_requests",
    title: "Customer requests",
    description: "Products customers requested and new matches",
    Icon: Inbox,
    surface: "bg-[#F7EBE0]",
    iconSurface: "bg-[#F1DCCB] text-[#975739]",
    accent: "bg-[#C56C42]",
    count: "text-[#975739]",
    mobileSurface: "bg-[#FCF6F0]",
    mobileUnreadBorder: "border-l-[#C56C42]",
  },
  {
    id: "admin_campaigns",
    title: "Ads & promotions",
    description: "Sponsored campaigns submitted for review",
    Icon: Layers3,
    surface: "bg-[#E4EBE4]",
    iconSurface: "bg-[#D7DDCF] text-[#173F35]",
    accent: "bg-[#173F35]",
    count: "text-[#173F35]",
    mobileSurface: "bg-[#F1F5EF]",
    mobileUnreadBorder: "border-l-[#456D5B]",
  },
  {
    id: "admin_security",
    title: "Account security",
    description: "Security and sign-in notices",
    Icon: ShieldCheck,
    surface: "bg-[#F0ECE5]",
    iconSurface: "bg-[#E5E2D9] text-[#202421]",
    accent: "bg-[#202421]",
    count: "text-[#202421]",
    mobileSurface: "bg-[#F7F6F2]",
    mobileUnreadBorder: "border-l-[#202421]",
  },
  {
    id: "admin_other",
    title: "Other admin updates",
    description: "Additional operational notices",
    Icon: Bell,
    surface: "bg-[#EBEEE7]",
    iconSurface: "bg-[#D7DDCF] text-[#173F35]",
    accent: "bg-[#456D5B]",
    count: "text-[#173F35]",
    mobileSurface: "bg-[#F6F7F4]",
    mobileUnreadBorder: "border-l-[#456D5B]",
  },
];

const ADMIN_TRIGGER_GROUPS = Object.freeze({
  host_unified_listing_submitted: "admin_listings",
  host_listing_created: "admin_listings",
  host_listing_updated: "admin_listings",
  hospitality_approval_requested: "admin_listings",
  host_registration: "admin_hosts",
  host_commercial_profile_request: "admin_hosts",
  creator_approval_requested: "admin_creators",
  customer_demand_new_admin: "admin_requests",
  customer_demand_listed_admin: "admin_requests",
  retail_media_campaign_review_requested: "admin_campaigns",
  security_notice: "admin_security",
});

function adminNotificationGroupId(notification) {
  const trigger = String(notification?.triggerType || "").toLowerCase();
  if (ADMIN_TRIGGER_GROUPS[trigger]) return ADMIN_TRIGGER_GROUPS[trigger];

  // Legacy records may have a reason code but no recognised trigger.
  const reason = String(notification?.reasonCode || "").toLowerCase();
  const category = String(notification?.category || "").toLowerCase();
  if (/^(host_unified_listing_|host_listing_|hospitality_approval_)/.test(reason)) return "admin_listings";
  if (/^(host_registration|host_commercial_profile_)/.test(reason)) return "admin_hosts";
  if (reason.startsWith("creator_approval_")) return "admin_creators";
  if (/^(customer_product_requested|customer_requested_product_listed|customer_demand_)/.test(reason)) return "admin_requests";
  if (reason.startsWith("retail_media_campaign_")) return "admin_campaigns";
  if (category === "security") return "admin_security";
  return "admin_other";
}

function notificationGroupId(notification, isAdminInbox = false) {
  if (isAdminInbox) return adminNotificationGroupId(notification);
  const category = String(notification?.category || "").toLowerCase();
  const reason = String(notification?.reasonCode || "").toLowerCase();
  const trigger = String(notification?.triggerType || "").toLowerCase();

  if (
    category === "delivery" ||
    reason === "customer_order_out_for_delivery" ||
    reason === "customer_order_carrier_handoff" ||
    reason === "customer_order_delivery_failed" ||
    reason === "customer_order_delivered" ||
    trigger.includes("delivery_milestone")
  ) return "delivery";
  if (category === "order" || reason.startsWith("customer_order_") || reason === "host_new_paid_order") {
    return "orders";
  }
  if (["pantry", "planning", "recipe"].includes(category)) return "pantry";
  if (category === "household") return "household";
  if (["security", "operations"].includes(category)) return "account";
  return "other";
}

const ATTENTION_REASON_CODES = new Set([
  "customer_order_rejected",
  "customer_order_partial_unavailable",
  "customer_order_seller_cancelled",
  "customer_order_delivery_failed",
]);

function isUnreadNotification(notification) {
  return (
    !notification?.readAt &&
    UNREAD_STATUSES.has(notification?.status)
  );
}

function broadcastNotificationChange() {
  window.dispatchEvent(new CustomEvent("epantry:notifications-changed"));
}

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function getPantryItemName(explanation) {
  const normalized = String(explanation || "").trim();
  const match = normalized.match(/^(.+?)\s+is in your Pantry\./i);

  return match?.[1]?.trim() || "This item";
}

function getNotificationCopy(notification, isAdminInbox = false) {
  const reasonCode = String(notification?.reasonCode || "");
  const triggerType = String(notification?.triggerType || "");
  const explanation = String(notification?.explanation || "").trim();

  // Super Admin reads plain-language actions, not backend reason-code titles.
  if (isAdminInbox) {
    const adminMessages = {
      host_unified_listing_submitted: ["New listing submitted", "Review listing", "A Host listing needs review"],
      host_listing_created: ["Host listing created", "Review listing", "A Host added a listing"],
      host_listing_updated: ["Host listing updated", "Review changes", "A Host changed a listing"],
      hospitality_approval_requested: ["Kitchen listing needs approval", "Review submission", "A kitchen submission needs review"],
      host_registration: ["New Host registration", "Review Host", "A Host registration needs review"],
      host_commercial_profile_request: ["Host business profile submitted", "Review profile", "A business profile needs review"],
      creator_approval_requested: ["Creator review requested", "Review creator", "A creator submission needs review"],
      customer_demand_new_admin: ["New customer product request", "View requests", "Customers requested a product"],
      customer_demand_listed_admin: ["Requested product now listed", "View requests", "A requested product has been listed"],
      retail_media_campaign_review_requested: ["Sponsored campaign needs approval", "Review campaign", "A paid campaign needs review"],
      security_notice: ["Account security update", "Review security", "A security notice is available"],
    };
    const message = adminMessages[triggerType];
    if (message) return {
      title: message[0],
      description: explanation || message[2],
      why: message[2],
      openLabel: message[1],
    };
  }

  if (
    reasonCode === "pantry_details_incomplete" ||
    triggerType === "pantry_setup_reminder"
  ) {
    const itemName = getPantryItemName(explanation);

    return {
      title: `Finish ${itemName} details`,
      description: `${itemName} is already in your Pantry. Add quantity, storage and an optional use-soon reminder so planning stays accurate.`,
      why: "Pantry details need your input",
      openLabel: "Add details",
    };
  }

  if (reasonCode === "customer_order_out_for_delivery") {
    return {
      title: "Your order is on the way",
      description:
        "Good news — your order is out for delivery. Open tracking to see the latest progress.",
      why: "Delivery progress changed",
      openLabel: "Track order",
    };
  }

  if (reasonCode === "customer_order_carrier_handoff") {
    return {
      title: "Your order is with the delivery partner",
      description:
        "The seller has handed your order to the delivery partner. It is moving to the next delivery stage.",
      why: "Delivery handoff recorded",
      openLabel: "Track order",
    };
  }

  if (reasonCode === "customer_order_packed") {
    return {
      title: "Your order is packed and ready",
      description:
        "Your items have been packed successfully and are ready for the next delivery step.",
      why: "Order preparation moved forward",
      openLabel: "View order",
    };
  }

  if (reasonCode === "customer_order_picking") {
    return {
      title: "Your items are being prepared",
      description:
        "The seller is picking the items in your order now. We’ll keep showing the next milestone here.",
      why: "Order preparation started",
      openLabel: "View order",
    };
  }

  if (reasonCode === "customer_order_seller_accepted") {
    return {
      title: "The seller accepted your order",
      description:
        "Your order has been accepted and preparation can now begin.",
      why: "Seller acceptance recorded",
      openLabel: "View order",
    };
  }

  if (reasonCode === "customer_order_rejected") {
    return {
      title: "A Host couldn’t accept this delivery",
      description:
        explanation ||
        "One Host could not accept their part of your order. Review the affected items and delivery status.",
      why: "This Host delivery needs attention",
      openLabel: "Review order",
    };
  }

  if (reasonCode === "customer_order_partial_unavailable") {
    return {
      title: "Some items are unavailable",
      description:
        explanation ||
        "A Host reported that some items in this delivery are unavailable. Open the order to see what is affected.",
      why: "Item availability changed",
      openLabel: "Review order",
    };
  }

  if (reasonCode === "customer_order_seller_cancelled") {
    return {
      title: "A Host cancelled their delivery",
      description:
        explanation ||
        "One Host delivery was cancelled. Open the order to review the affected items and current order status.",
      why: "A Host delivery was cancelled",
      openLabel: "Review order",
    };
  }

  if (reasonCode === "customer_order_delivery_failed") {
    return {
      title: "Delivery needs your attention",
      description:
        explanation ||
        "A Host delivery attempt was not completed. Open the order to see the latest update.",
      why: "Delivery attempt was not completed",
      openLabel: "Review delivery",
    };
  }

  if (reasonCode === "host_new_paid_order") {
    return {
      title: "A paid order is ready for you",
      description:
        "A new customer order has completed payment and is ready for review and fulfilment.",
      why: "New paid order received",
      openLabel: "Open order",
    };
  }

  if (triggerType === "retail_media_campaign_review_requested") {
    return {
      title: "A sponsored campaign is ready for approval",
      description:
        explanation ||
        "A Host has completed campaign payment. Review the sponsored placement before it can go live.",
      why: "Host campaign payment completed",
      openLabel: "Review campaign",
    };
  }

  if (reasonCode === "retail_media_campaign_approved") {
    return {
      title: "Your campaign was approved",
      description:
        explanation ||
        "Super Admin approved your sponsored campaign. Open it to activate the campaign.",
      why: "Super Admin review completed",
      openLabel: "Open campaign",
    };
  }

  if (reasonCode === "retail_media_campaign_rejected") {
    return {
      title: "Your campaign needs changes",
      description:
        explanation ||
        "Super Admin did not approve this sponsored campaign. Open it to review the decision.",
      why: "Super Admin review completed",
      openLabel: "Review campaign",
    };
  }

  if (triggerType === "household_invitation_received") {
    return {
      title: "You’ve been invited to a household",
      description:
        explanation ||
        "Review the household invitation and choose whether you want to join.",
      why: "A household invitation needs your response",
      openLabel: "Review invite",
    };
  }

  if (triggerType === "household_invitation_accepted") {
    return {
      title: "Your household invitation was accepted",
      description:
        explanation || "A person you invited has joined the household.",
      why: "Household membership changed",
      openLabel: "View household",
    };
  }

  if (triggerType === "household_invitation_declined") {
    return {
      title: "A household invitation was declined",
      description:
        explanation || "A person you invited chose not to join the household.",
      why: "Household invitation updated",
      openLabel: "View household",
    };
  }

  const openLabelByCategory = {
    order: "View order",
    pantry: "Open Pantry",
    planning: "Review plan",
    household: "Open household",
    price: "Review change",
    class: "Open learning",
    security: "Review account",
    operations: "Open details",
  };

  const whyByCategory = {
    order: "An order milestone changed",
    pantry: "Your Pantry needs attention",
    planning: "Your meal plan needs attention",
    household: "Your household activity changed",
    price: "A meaningful price change was detected",
    class: "A learning reminder is ready",
    security: "An account security update needs attention",
    operations: "An operational update is ready",
    marketing: "A marketing preference or update is available",
  };

  return {
    title: titleize(reasonCode) || "Useful update",
    description:
      explanation || "There is a useful EPANTRY update ready for you.",
    why: whyByCategory[notification?.category] || "EPANTRY found a useful update",
    openLabel: openLabelByCategory[notification?.category] || "Open",
  };
}

function PreferenceToggle({ label, description, checked, disabled = false, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-[#DFE5DD] bg-white/75 px-4 py-4 transition last:border-b-0 hover:bg-white sm:px-5">
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#173E32]">{label}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-[#65746B]">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 shrink-0 accent-[#185943] disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

function NotificationRow({ notification, category, busy, onAction, onMarkRead, isAdminInbox = false }) {
  const available = new Set(notification.actions || []);
  const copy = getNotificationCopy(notification, isAdminInbox);
  const unread = isUnreadNotification(notification);
  const needsReview = ATTENTION_REASON_CODES.has(String(notification?.reasonCode || ""));
  const deepLinkPath =
    typeof notification?.deepLink?.path === "string" &&
    notification.deepLink.path.startsWith("/") &&
    !notification.deepLink.path.startsWith("//")
      ? notification.deepLink.path
      : "";
  const created = notification.createdAt ? new Date(notification.createdAt) : null;
  const displayDate = created && !Number.isNaN(created.valueOf())
    ? created.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
  const GroupIcon = category.Icon;
  const actionClass = "focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#C7DDF1] bg-[#F1F7FF] px-2.5 py-1.5 text-[13px] font-semibold text-[#2A5575] transition hover:border-[#88B5DA] hover:bg-[#E5F1FF] disabled:cursor-not-allowed disabled:opacity-50 sm:border-[#D9E1D9] sm:bg-white sm:px-3 sm:text-[#335848] sm:hover:border-[#93B7A1] sm:hover:bg-[#F2F7F3]";

  return (
    <article className={`group relative border-b border-[#E4E9E2] last:border-b-0 ${unread ? `${category.mobileSurface} sm:bg-[#F7FAF6]` : "bg-[#FFFDFC] sm:bg-white"} ${needsReview ? "border-l-[3px] border-l-[#C86E51]" : unread ? `border-l-[3px] ${category.mobileUnreadBorder} sm:border-l-[#27845A]` : "border-l-[3px] border-l-transparent"}`}>
      <div className="relative block min-w-0 px-3 py-3.5 sm:flex sm:gap-4 sm:px-5 sm:py-5 xl:px-7">
        <span className={`absolute left-3 top-3.5 grid size-8 shrink-0 place-items-center rounded-[10px] sm:relative sm:left-auto sm:top-auto sm:mt-0.5 sm:size-11 sm:rounded-[12px] ${category.iconSurface}`} aria-hidden="true">
          <GroupIcon size={20} strokeWidth={1.9} />
          {unread ? <span className={`absolute -right-1 -top-1 size-3 rounded-full border-2 border-white ${needsReview ? "bg-[#C86E51]" : "bg-[#238659]"}`} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1.5 pl-10 sm:min-h-0 sm:pl-0">
            <span className={`text-[12px] font-bold ${category.count}`}>{category.title}</span>
            {needsReview ? (
              <span className="rounded-full bg-[#FCE6DC] px-2 py-0.5 text-[12px] font-bold sm:text-[11px] text-[#9A4637]">Needs attention</span>
            ) : unread ? (
              <span className="rounded-full bg-[#DDEFE3] px-2 py-0.5 text-[12px] font-bold sm:text-[11px] text-[#246547]">New</span>
            ) : null}
            <time dateTime={notification.createdAt || undefined} className="ml-auto text-[12px] font-medium text-[#77857B] sm:text-[13px]">{displayDate}</time>
          </div>
          <p className={`mt-1.5 text-[16px] leading-snug text-[#193C30] sm:text-[18px] ${unread ? "font-bold" : "font-semibold"}`}>{copy.title}</p>
          <p className="mt-1 max-w-[84ch] text-[14px] leading-[1.6] text-[#56695D] sm:text-[15px]">{copy.description}</p>
          <p className="mt-1 text-[13px] leading-5 text-[#76877B]">{copy.why}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
            {deepLinkPath ? (
              <Link to={deepLinkPath} className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#217C57] px-2.5 py-1.5 text-[13px] font-bold text-white transition hover:bg-[#146548] sm:bg-[#194D3B] sm:px-3.5 sm:hover:bg-[#103C2C]">
                {copy.openLabel}<ArrowUpRight size={15} />
              </Link>
            ) : null}
            {unread ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onMarkRead(notification.id)}><CheckCheck size={15} /> Mark as read</button>
            ) : null}
            {available.has("accept") ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onAction(notification.id, "accept")}><Check size={15} /> Done</button>
            ) : null}
            {available.has("snooze") ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onAction(notification.id, "snooze")}><Clock3 size={15} /> Snooze 24h</button>
            ) : null}
            {available.has("still_have") ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onAction(notification.id, "still_have")}><PackageCheck size={15} /> Still have</button>
            ) : null}
            {available.has("bought_elsewhere") ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onAction(notification.id, "bought_elsewhere")}><ShoppingBag size={15} /> Bought elsewhere</button>
            ) : null}
            {available.has("stop_suggesting") ? (
              <button type="button" className={actionClass} disabled={busy} onClick={() => onAction(notification.id, "stop_suggesting")}><BellOff size={15} /> Stop suggesting</button>
            ) : null}
            {available.has("dismiss") ? (
              <button type="button" className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[13px] font-semibold text-[#A95641] transition hover:bg-[#FFE9DF] hover:text-[#954335] disabled:cursor-not-allowed disabled:opacity-50 sm:px-2 sm:text-[#93706A] sm:hover:bg-[#FDF0ED]" disabled={busy} onClick={() => onAction(notification.id, "dismiss")}><X size={15} /> Dismiss</button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function NotificationCenterPage() {
  const { activeMode, currentUser, superAdminEnabled } = useAuth();
  // Matches the backend audience rule: Super Admin has priority over dual roles.
  const isAdminInbox = superAdminEnabled === true;
  const notificationGroups = isAdminInbox ? ADMIN_NOTIFICATION_GROUPS : NOTIFICATION_GROUPS;
  const [preferences, setPreferences] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState("all");
  const [mobileTopicsOpen, setMobileTopicsOpen] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    setSelectedGroupId("all");
    setShowAll(false);
    setMobileTopicsOpen(false);
  }, [isAdminInbox]);

  const load = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError("");
    setNotifications([]);
    try {
      const [preferenceData, notificationData] = await Promise.all([
        getNotificationPreferences(),
        listNotifications({ limit: 60 }),
      ]);
      if (requestId === generation.current) {
        setPreferences(preferenceData?.preferences || null);
        setNotifications(notificationData?.notifications || []);
      }
    } catch (requestError) {
      if (requestId !== generation.current) return;
      setError(getAnalyticsErrorMessage(requestError, "Unable to load notifications."));
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [activeMode, currentUser?.id]);

  useEffect(() => {
    load();
    return () => { generation.current += 1; };
  }, [load]);

  async function markOneAsRead(notificationId) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await markNotificationRead(notificationId);
      const updated = data?.notification || null;
      setNotifications((current) => current.map((item) =>
        item.id === notificationId
          ? updated || { ...item, status: "read", readAt: new Date().toISOString() }
          : item
      ));
      setNotice("Notification marked as read.");
      broadcastNotificationChange();
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError, "Unable to mark notification as read."));
    } finally {
      setBusy(false);
    }
  }

  async function markEveryNotificationAsRead() {
    setError("");
    setNotice("");
    const unreadNow = notifications.filter(isUnreadNotification).length;
    if (unreadNow === 0) {
      setNotice("You’re already caught up — every visible notification is read.");
      return;
    }
    setBusy(true);
    try {
      const data = await markAllNotificationsRead();
      const readAt = data?.readAt || new Date().toISOString();
      setNotifications((current) => current.map((item) =>
        isUnreadNotification(item) ? { ...item, status: "read", readAt } : item
      ));
      setNotice(data?.markedReadCount
        ? `${data.markedReadCount} notification${data.markedReadCount === 1 ? "" : "s"} marked as read.`
        : "All visible notifications are now read.");
      broadcastNotificationChange();
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError, "Unable to mark all notifications as read."));
    } finally {
      setBusy(false);
    }
  }

  async function patchPreference(key, value) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await updateNotificationPreferences({ [key]: value });
      setPreferences(data?.preferences || null);
      setNotice("Notification preference updated.");
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError, "Unable to update notification preferences."));
    } finally {
      setBusy(false);
    }
  }

  async function action(notificationId, actionName) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await performNotificationAction(notificationId, {
        action: actionName,
        snoozeUntil: actionName === "snooze"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null,
      });
      setNotice(actionName === "still_have" || actionName === "bought_elsewhere"
        ? "Feedback recorded through the Pantry evidence workflow."
        : "Notification updated.");
      await load();
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError, "Unable to apply notification action."));
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter(isUnreadNotification).length,
    [notifications]
  );
  const enabledPreferenceCount = useMemo(
    () => preferences ? PREFERENCE_KEYS.filter((key) => preferences[key] === true).length : 0,
    [preferences]
  );
  const categoryBuckets = useMemo(() => notificationGroups.map((group) => {
    const items = notifications.filter((notification) => notificationGroupId(notification, isAdminInbox) === group.id);
    return { ...group, items, unread: items.filter(isUnreadNotification).length };
  }).filter((group) => isAdminInbox || group.items.length > 0), [notifications, notificationGroups, isAdminInbox]);
  const selectedCategory = notificationGroups.find((group) => group.id === selectedGroupId) || null;
  const filteredNotifications = useMemo(() => notifications
    .filter((notification) => selectedGroupId === "all" || notificationGroupId(notification, isAdminInbox) === selectedGroupId)
    .filter((notification) => activeFilter === "all" || isUnreadNotification(notification))
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0)),
    [notifications, activeFilter, selectedGroupId, isAdminInbox]
  );
  const displayNotifications = showAll ? filteredNotifications : filteredNotifications.slice(0, 8);
  // In the Super Admin All view, show a small preview per topic, even when one
  // topic has hundreds of items. Selecting a topic opens its full filtered feed.
  const adminGroupedDisplay = isAdminInbox && selectedGroupId === "all"
    ? categoryBuckets.map((group) => {
        const matching = filteredNotifications.filter((item) => adminNotificationGroupId(item) === group.id);
        return { ...group, total: matching.length, visible: showAll ? matching : matching.slice(0, 3) };
      }).filter((group) => group.total > 0)
    : [];
  const groupedView = isAdminInbox && selectedGroupId === "all";
  const visibleCount = groupedView
    ? adminGroupedDisplay.reduce((sum, group) => sum + group.visible.length, 0)
    : displayNotifications.length;
  const hasMore = groupedView
    ? adminGroupedDisplay.some((group) => group.visible.length < group.total)
    : filteredNotifications.length > 8;

  function chooseCategory(groupId) {
    setSelectedGroupId(groupId);
    setMobileTopicsOpen(false);
    setShowAll(false);
  }

  function chooseFilter(filter) {
    setActiveFilter(filter);
    setShowAll(false);
  }

  return (
    <main className="epantry-workspace-canvas min-h-screen w-full min-w-0 bg-[#FFF9F1] pb-12 text-[#193F32] sm:bg-[#F7F6F1]">
      <header className="w-full border-b border-[#B9DCC8] bg-[#DDF3E7] sm:border-[#D8DFD6] sm:bg-[#EAF0E8]">
        <div className="w-full px-3 pb-4 pt-4 sm:px-7 sm:pb-6 sm:pt-7 lg:px-10 xl:px-12">
          <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] font-bold text-[#247B57] sm:text-[#3D765E]"><Bell size={16} /> EPANTRY / {isAdminInbox ? "Admin inbox" : "Your inbox"}</p>
              <h1 className="mt-1 text-[28px] font-bold tracking-[-0.045em] text-[#143D2F] sm:text-[44px]">Notifications</h1>
              <p className="mt-1 text-[14px] leading-[1.5] text-[#596F61] sm:text-[15px] sm:leading-6">{isAdminInbox ? "Listings, approvals and other admin updates, organised by topic." : "Orders, delivery progress and the updates that matter to you."}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 lg:justify-end">
              <div className="flex items-center gap-4 border-r border-[#C6D5C7] pr-4 sm:gap-7 sm:pr-7">
                <div><strong className="block text-[26px] font-bold leading-none tabular-nums text-[#154533] sm:text-[34px]">{notifications.length}</strong><span className="mt-1 block text-[12px] font-semibold text-[#5C7665]">Total</span></div>
                <div><strong className="block text-[26px] font-bold leading-none tabular-nums text-[#C65C39] sm:text-[34px] sm:text-[#BA6543]">{unreadCount}</strong><span className="mt-1 block text-[12px] font-semibold text-[#5C7665]">Unread</span></div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setPreferencesOpen((current) => !current)} aria-expanded={preferencesOpen}
                  className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#BDD5E7] bg-[#F4F9FF] px-3 text-[13px] font-semibold text-[#225D7A] transition hover:bg-[#E9F3FF] sm:min-h-11 sm:border-[#BFCFC1] sm:bg-white sm:px-3.5 sm:text-[14px] sm:text-[#22513B] sm:hover:bg-[#F8FCF8]">
                  <Settings2 size={17} /> Preferences
                  {preferences ? <span className="text-[12px] text-[#6B8271]">{enabledPreferenceCount} on</span> : null}
                  {preferencesOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                <button type="button" onClick={load} disabled={loading || busy}
                  className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#23805A] px-3 text-[13px] font-semibold text-white transition hover:bg-[#196847] disabled:opacity-50 sm:min-h-11 sm:bg-[#184E3A] sm:px-4 sm:text-[14px] sm:hover:bg-[#0F382A]">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full px-3 sm:px-7 lg:px-10 xl:px-12">
        {preferencesOpen ? (
          <section className="mt-5 overflow-hidden rounded-2xl border border-[#D2DDD1] bg-[#F0F6EF]" aria-label="Notification preferences">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D7E2D8] px-4 py-4 sm:px-6">
              <div><h2 className="text-[20px] font-bold text-[#163F31]">Notification preferences</h2><p className="mt-1 text-[13px] leading-5 text-[#69796F]">Manage how you receive updates. Marketing consent is managed separately.</p></div>
              <button type="button" className="focus-ring inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#285F48]" onClick={() => setPreferencesOpen(false)}>Close <X size={15} /></button>
            </div>
            {preferences ? (
              <div className="grid gap-px bg-[#DFE5DD] md:grid-cols-2">
                <div className="bg-white/70">
                  <PreferenceToggle label="In-app" description="Show useful alerts inside EPANTRY." checked={preferences.inAppEnabled === true} disabled={busy} onChange={(value) => patchPreference("inAppEnabled", value)} />
                  <PreferenceToggle label="Email" description="Send eligible account and order updates by email." checked={preferences.emailEnabled === true} disabled={busy} onChange={(value) => patchPreference("emailEnabled", value)} />
                  <PreferenceToggle label="Planning" description="Meal-plan shortages and planning reminders." checked={preferences.planningEnabled === true} disabled={busy} onChange={(value) => patchPreference("planningEnabled", value)} />
                  <PreferenceToggle label="Pantry" description="Use-soon and Pantry detail reminders." checked={preferences.pantryEnabled === true} disabled={busy} onChange={(value) => patchPreference("pantryEnabled", value)} />
                  <PreferenceToggle label="Household" description="Invites and shared-household updates." checked={preferences.householdEnabled === true} disabled={busy} onChange={(value) => patchPreference("householdEnabled", value)} />
                </div>
                <div className="bg-white/70">
                  <PreferenceToggle label="Orders" description="Order preparation and delivery milestones." checked={preferences.orderEnabled === true} disabled={busy} onChange={(value) => patchPreference("orderEnabled", value)} />
                  <PreferenceToggle label="Operations" description="Host and operational account notices." checked={preferences.operationsEnabled !== false} disabled={busy} onChange={(value) => patchPreference("operationsEnabled", value)} />
                  <PreferenceToggle label="Price" description="Meaningful price-change alerts." checked={preferences.priceEnabled === true} disabled={busy} onChange={(value) => patchPreference("priceEnabled", value)} />
                  <PreferenceToggle label="Marketing" description="Optional marketing delivery preference." checked={preferences.marketingEnabled === true} disabled={busy || preferences.marketingEnabled !== true} onChange={(value) => patchPreference("marketingEnabled", value)} />
                </div>
              </div>
            ) : <p className="px-6 py-5 text-[14px] text-[#63766A]">Preferences are currently unavailable.</p>}
          </section>
        ) : null}
        {error ? <div role="alert" className="mt-5 border-l-4 border-[#B74239] bg-[#FFF1EE] px-4 py-3 text-[14px] font-medium text-[#8F332B]">{error}</div> : null}
        {notice ? (
          <div role="status" className="mt-5 flex items-center justify-between gap-3 border-l-4 border-[#358765] bg-[#E5F4E9] px-4 py-3 text-[14px] font-medium text-[#1C5D40]">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} className="focus-ring grid size-8 shrink-0 place-items-center rounded-lg hover:bg-white/60" aria-label="Dismiss message"><X size={16} /></button>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 pt-3 sm:gap-5 sm:pt-5 lg:grid-cols-[268px_minmax(0,1fr)] lg:gap-7 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-9">
          <aside className="min-w-0 lg:border-r lg:border-[#D7DDD4] lg:pr-6 xl:pr-7" aria-label="Notification categories">
            <div className="lg:sticky lg:top-5">
              <h2 className="mb-3 hidden text-[20px] font-bold text-[#174231] lg:block">Browse by topic</h2>
              <p className="mb-4 hidden text-[13px] leading-5 text-[#718074] lg:block">{isAdminInbox ? "Open a review topic to see its notifications." : "Choose a category to focus on specific updates."}</p>
              {/* Mobile uses a full-width topic selector rather than clipped horizontal tabs. */}
              <div className="lg:hidden">
                <p className="mb-2 text-[13px] font-bold text-[#A75E36] sm:text-[#456D56]">Browse notifications</p>
                <button
                  type="button"
                  onClick={() => setMobileTopicsOpen((current) => !current)}
                  aria-expanded={mobileTopicsOpen}
                  aria-controls="epantry-mobile-notification-topics"
                  className="focus-ring flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#B8D5F0] bg-[#EAF3FF] px-3 py-2.5 text-left shadow-sm transition hover:border-[#80ADDA]"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${selectedCategory ? selectedCategory.iconSurface : "bg-[#CFE7F9] text-[#20577B]"}`}>
                    {selectedCategory ? <selectedCategory.Icon size={19} strokeWidth={1.9} /> : <Inbox size={19} />}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-bold leading-5 text-[#193F32] [overflow-wrap:anywhere]">
                    {selectedCategory ? selectedCategory.title : "All activity"}
                  </span>
                  <span className="shrink-0 rounded-full bg-[#FFF1CE] px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#855B28]">
                    {selectedCategory ? (categoryBuckets.find((group) => group.id === selectedGroupId)?.items.length || 0) : notifications.length}
                  </span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#D8E9FF] text-[#285C89]" aria-hidden="true">
                    {mobileTopicsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </button>
                {mobileTopicsOpen ? (
                  <div id="epantry-mobile-notification-topics" className="mt-2 overflow-hidden rounded-xl border border-[#C7DDF0] bg-[#F8FBFF]" aria-label="Choose notification category">
                    <button
                      type="button"
                      onClick={() => chooseCategory("all")}
                      aria-pressed={selectedGroupId === "all"}
                      className={`focus-ring flex min-h-12 w-full items-center gap-3 border-b border-[#E4EBE2] px-3 py-2.5 text-left ${selectedGroupId === "all" ? "bg-[#DFF0E6]" : "bg-[#F8FBFF] hover:bg-[#EDF5FF]"}`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#E0EDE3] text-[#205A41]"><Inbox size={18} /></span>
                      <span className="min-w-0 flex-1 text-[14px] font-semibold leading-5 text-[#1B4635]">All activity</span>
                      <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#597365]">{notifications.length}</span>
                      {selectedGroupId === "all" ? <Check size={17} className="shrink-0 text-[#1D6A45]" /> : null}
                    </button>
                    {categoryBuckets.map((group) => {
                      const GroupIcon = group.Icon;
                      const active = selectedGroupId === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => chooseCategory(group.id)}
                          aria-pressed={active}
                          className={`focus-ring flex min-h-12 w-full items-center gap-3 border-b border-[#E4EBE2] px-3 py-2.5 text-left last:border-b-0 ${active ? "bg-[#DFF0E6]" : "bg-[#F8FBFF] hover:bg-[#EDF5FF]"}`}
                        >
                          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${group.iconSurface}`}><GroupIcon size={18} strokeWidth={1.9} /></span>
                          <span className="min-w-0 flex-1 text-[14px] font-semibold leading-5 text-[#1B4635] [overflow-wrap:anywhere]">{group.title}</span>
                          {group.unread > 0 ? <span className="shrink-0 rounded-full bg-[#FBE9DB] px-2 py-0.5 text-[11px] font-semibold text-[#9B562D]">{group.unread} new</span> : null}
                          <span className="shrink-0 text-[13px] font-bold tabular-nums text-[#597365]">{group.items.length}</span>
                          {active ? <Check size={17} className="shrink-0 text-[#1D6A45]" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {/* Desktop topic navigation is unchanged. */}
              <div className="hidden lg:block">
                <nav className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Choose a notification category">
                  <button type="button" onClick={() => chooseCategory("all")} aria-pressed={selectedGroupId === "all"}
                    className={`focus-ring flex min-h-11 w-[55%] min-w-max shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition sm:min-h-12 sm:w-auto sm:min-w-0 sm:gap-3 sm:px-3 sm:py-2.5 lg:w-full ${selectedGroupId === "all" ? "border-[#1B5740] bg-[#174F39] text-white shadow-sm" : "border-[#DCE3DA] bg-white text-[#315744] hover:bg-[#EDF4EE]"}`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg sm:size-9 ${selectedGroupId === "all" ? "bg-white/15" : "bg-[#E7EFE7]"}`}><Inbox size={19} /></span>
                    <span className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-bold sm:truncate sm:text-[14px]">All activity</span>
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums ${selectedGroupId === "all" ? "bg-white/20 text-white" : "bg-[#EDF3EC] text-[#45624D]"}`}>{notifications.length}</span>
                  </button>
                  {categoryBuckets.map((group) => {
                    const active = selectedGroupId === group.id;
                    const GroupIcon = group.Icon;
                    return (
                      <button key={group.id} type="button" onClick={() => chooseCategory(group.id)} aria-pressed={active}
                        className={`focus-ring flex min-h-11 ${group.id === "orders" ? "w-[71%]" : "w-[48%]"} shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition sm:min-h-12 sm:w-auto sm:gap-3 sm:px-3 sm:py-2.5 lg:w-full ${active ? "border-[#B0CEB8] bg-white text-[#173E2E] shadow-sm" : "border-transparent bg-transparent text-[#355748] hover:border-[#D9E3DA] hover:bg-white"}`}>
                        <span className={`grid size-7 shrink-0 place-items-center rounded-lg sm:size-9 ${group.iconSurface}`}><GroupIcon size={19} strokeWidth={1.9} /></span>
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-semibold sm:text-[14px]">{group.title}</span>
                        <span className="inline-flex items-center gap-1.5">
                          {group.unread > 0 ? <span className="size-1.5 rounded-full bg-[#D17851]" aria-label={`${group.unread} unread`} /> : null}
                          <span className="text-[13px] font-bold tabular-nums text-[#677D6F]">{group.items.length}</span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
              {unreadCount > 0 ? (
                <div className="mt-6 hidden border-t border-[#D9E1D6] pt-5 lg:block">
                  <p className="text-[13px] font-bold text-[#3D7758]">{unreadCount} unread update{unreadCount === 1 ? "" : "s"}</p>
                  <p className="mt-1 text-[13px] leading-5 text-[#728174]">Open a topic or use the unread filter to focus on what’s new.</p>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="min-w-0 pb-12" aria-label="Notification inbox">
            <div className="flex flex-col gap-3 border-b border-[#D5DCD2] pb-3 sm:gap-4 sm:pb-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <p className="mb-1 hidden text-[12px] font-bold uppercase tracking-[0.08em] text-[#C16C48] sm:block">Activity feed</p>
                <h2 className="text-[24px] font-bold leading-tight tracking-[-0.035em] text-[#153E30] sm:text-[31px]">{selectedCategory ? selectedCategory.title : "All activity"}</h2>
                <p className="mt-1 text-[14px] text-[#657668]">{selectedCategory ? selectedCategory.description : (isAdminInbox ? "Admin notifications, separated by review topic." : "Your latest notifications, in one clear feed.")}</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
                <div className="inline-flex items-center rounded-xl border border-[#C3DBED] bg-[#EDF6FF] p-1 sm:border-[#D6E0D6] sm:bg-white" aria-label="Filter notifications">
                  <button type="button" onClick={() => chooseFilter("all")} aria-pressed={activeFilter === "all"} className={`focus-ring rounded-lg px-3 py-2 text-[13px] font-semibold transition ${activeFilter === "all" ? "bg-[#1C533D] text-white" : "text-[#41614F] hover:bg-[#F0F5EF]"}`}>All</button>
                  <button type="button" onClick={() => chooseFilter("unread")} aria-pressed={activeFilter === "unread"} className={`focus-ring rounded-lg px-3 py-2 text-[13px] font-semibold transition ${activeFilter === "unread" ? "bg-[#1C533D] text-white" : "text-[#41614F] hover:bg-[#F0F5EF]"}`}>Unread{unreadCount ? ` (${unreadCount})` : ""}</button>
                </div>
                <button type="button" onClick={markEveryNotificationAsRead} disabled={loading || busy || unreadCount === 0}
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#B7D9C1] bg-[#DFF4E5] px-3.5 text-[13px] font-semibold text-[#176644] transition hover:bg-[#D0EBD8] disabled:cursor-not-allowed disabled:opacity-45 sm:border-[#B9CFBF] sm:bg-[#E9F3E9] sm:text-[#225741] sm:hover:bg-[#DCEBDC]"><CheckCheck size={17} /> Mark all as read</button>
              </div>
            </div>

            {loading ? (
              <div className="mt-5 flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-[#DBE2D8] bg-white text-[15px] text-[#496B56]"><LoaderCircle size={22} className="animate-spin" /> Loading notifications…</div>
            ) : filteredNotifications.length ? (
              <>
                {groupedView ? (
                  <div className="mt-4 space-y-4 sm:space-y-5" aria-label="Notifications grouped by admin topic">
                    {adminGroupedDisplay.map((group) => {
                      const GroupIcon = group.Icon;
                      return (
                        <section key={group.id} aria-label={group.title} className="overflow-hidden rounded-xl border border-[#D7DDCF] bg-[#F7F6F2] sm:rounded-2xl">
                          <div className={`flex flex-wrap items-center gap-3 border-b border-[#D7DDCF] px-3.5 py-3 sm:px-5 sm:py-4 ${group.surface}`}>
                            <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${group.iconSurface}`}><GroupIcon size={19} /></span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[16px] font-bold text-[#202421] sm:text-[18px]">{group.title}</h3>
                              <p className="hidden text-[13px] text-[#4D6054] sm:block">{group.description}</p>
                            </div>
                            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#173F35]">{group.total}</span>
                            <button type="button" onClick={() => chooseCategory(group.id)} className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-bold text-[#173F35] underline-offset-4 hover:underline sm:text-[13px]">View topic <ArrowUpRight size={15} /></button>
                          </div>
                          <div className="bg-white">
                            {group.visible.map((notification) => <NotificationRow key={notification.id} notification={notification} category={group} busy={busy} onAction={action} onMarkRead={markOneAsRead} isAdminInbox />)}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[#C9DFD1] bg-white sm:mt-4 sm:rounded-[18px] sm:border-[#DCE4DA]">
                    {displayNotifications.map((notification) => {
                      const group = notificationGroups.find((item) => item.id === notificationGroupId(notification, isAdminInbox)) || notificationGroups[notificationGroups.length - 1];
                      return <NotificationRow key={notification.id} notification={notification} category={group} busy={busy} onAction={action} onMarkRead={markOneAsRead} isAdminInbox={isAdminInbox} />;
                    })}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#748276]">
                  <span>Showing {visibleCount} of {filteredNotifications.length} update{filteredNotifications.length === 1 ? "" : "s"}</span>
                  {hasMore || showAll ? (
                    <button type="button" onClick={() => setShowAll((current) => !current)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#C2D7F0] bg-[#EAF3FF] px-4 text-[13px] font-bold text-[#245A72] transition hover:bg-[#DCEBFC] sm:border-[#CBDCCF] sm:bg-white sm:text-[#245A42] sm:hover:bg-[#EDF5EF]">
                      {showAll ? "Show fewer" : `Show all ${filteredNotifications.length} updates`}{showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-4 flex min-h-64 flex-col items-center justify-center rounded-[18px] border border-[#DAE3D9] bg-white px-6 py-10 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-[#E2F0E4] text-[#347052]">{activeFilter === "unread" ? <CheckCheck size={26} /> : <Inbox size={26} />}</span>
                <p className="mt-4 text-[19px] font-bold text-[#194332]">{activeFilter === "unread" ? "You're all caught up" : "No updates in this category"}</p>
                <p className="mt-1 max-w-md text-[14px] leading-6 text-[#64786A]">{activeFilter === "unread" ? "There are no unread notifications here. Switch to All to see your history." : "Try another topic or All activity to see the notifications available to you."}</p>
                {selectedGroupId !== "all" ? <button type="button" onClick={() => chooseCategory("all")} className="focus-ring mt-4 rounded-lg bg-[#1A513C] px-4 py-2 text-[13px] font-bold text-white">View all activity</button> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
