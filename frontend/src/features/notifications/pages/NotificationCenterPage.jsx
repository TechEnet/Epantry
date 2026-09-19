import {
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Settings2,
  ShoppingBag,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import {
  getAnalyticsErrorMessage,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  performNotificationAction,
  updateNotificationPreferences,
} from "../../analytics/services/analytics.service";

const UNREAD_STATUSES = new Set([
  "pending",
  "delivered",
  "action_required_domain",
]);

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

const notificationThemes = {
  recipe: {
    shell:
      "border-[#e3d7c2] bg-gradient-to-br from-[#fff7ed] via-[#fffdf8] to-[#f4efe6]",
    badge: "bg-[#9a3412] text-white",
    status: "border-[#e3d7c2] bg-white/85 text-[#7c2d12]",
    title: "text-[#163b2a]",
    why: "text-[#9a3412]",
    primary:
      "border-[#9a3412] bg-[#9a3412] text-white hover:bg-[#7c2d12]",
    secondary:
      "border-[#e3d7c2] bg-white/85 text-[#7c2d12] hover:bg-[#fff7ed]",
    dot: "bg-[#c2410c]",
  },
  pantry: {
    shell:
      "border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white",
    badge: "bg-emerald-700 text-white",
    status: "border-emerald-200 bg-white/80 text-emerald-900",
    title: "text-emerald-950",
    why: "text-emerald-800",
    primary:
      "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800",
    secondary:
      "border-emerald-200 bg-white/80 text-emerald-900 hover:bg-emerald-100",
    dot: "bg-emerald-600",
  },
  order: {
    shell:
      "border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-white",
    badge: "bg-sky-700 text-white",
    status: "border-sky-200 bg-white/80 text-sky-900",
    title: "text-sky-950",
    why: "text-sky-800",
    primary: "border-sky-700 bg-sky-700 text-white hover:bg-sky-800",
    secondary:
      "border-sky-200 bg-white/80 text-sky-900 hover:bg-sky-100",
    dot: "bg-sky-600",
  },
  invitation: {
    shell:
      "border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-white",
    badge: "bg-violet-700 text-white",
    status: "border-violet-200 bg-white/80 text-violet-900",
    title: "text-violet-950",
    why: "text-violet-800",
    primary:
      "border-violet-700 bg-violet-700 text-white hover:bg-violet-800",
    secondary:
      "border-violet-200 bg-white/80 text-violet-900 hover:bg-violet-100",
    dot: "bg-violet-600",
  },
  household: {
    shell:
      "border-cyan-200 bg-gradient-to-br from-cyan-50 via-sky-50 to-white",
    badge: "bg-cyan-800 text-white",
    status: "border-cyan-200 bg-white/80 text-cyan-950",
    title: "text-cyan-950",
    why: "text-cyan-800",
    primary: "border-cyan-800 bg-cyan-800 text-white hover:bg-cyan-900",
    secondary:
      "border-cyan-200 bg-white/80 text-cyan-950 hover:bg-cyan-100",
    dot: "bg-cyan-700",
  },
  planning: {
    shell:
      "border-indigo-200 bg-gradient-to-br from-indigo-50 via-blue-50 to-white",
    badge: "bg-indigo-700 text-white",
    status: "border-indigo-200 bg-white/80 text-indigo-900",
    title: "text-indigo-950",
    why: "text-indigo-800",
    primary:
      "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800",
    secondary:
      "border-indigo-200 bg-white/80 text-indigo-900 hover:bg-indigo-100",
    dot: "bg-indigo-600",
  },
  price: {
    shell:
      "border-teal-200 bg-gradient-to-br from-teal-50 via-cyan-50 to-white",
    badge: "bg-teal-700 text-white",
    status: "border-teal-200 bg-white/80 text-teal-900",
    title: "text-teal-950",
    why: "text-teal-800",
    primary: "border-teal-700 bg-teal-700 text-white hover:bg-teal-800",
    secondary:
      "border-teal-200 bg-white/80 text-teal-900 hover:bg-teal-100",
    dot: "bg-teal-600",
  },
  class: {
    shell:
      "border-purple-200 bg-gradient-to-br from-purple-50 via-fuchsia-50 to-white",
    badge: "bg-purple-700 text-white",
    status: "border-purple-200 bg-white/80 text-purple-900",
    title: "text-purple-950",
    why: "text-purple-800",
    primary:
      "border-purple-700 bg-purple-700 text-white hover:bg-purple-800",
    secondary:
      "border-purple-200 bg-white/80 text-purple-900 hover:bg-purple-100",
    dot: "bg-purple-600",
  },
  security: {
    shell:
      "border-rose-200 bg-gradient-to-br from-rose-50 via-pink-50 to-white",
    badge: "bg-rose-700 text-white",
    status: "border-rose-200 bg-white/80 text-rose-900",
    title: "text-rose-950",
    why: "text-rose-800",
    primary: "border-rose-700 bg-rose-700 text-white hover:bg-rose-800",
    secondary:
      "border-rose-200 bg-white/80 text-rose-900 hover:bg-rose-100",
    dot: "bg-rose-600",
  },
  marketing: {
    shell:
      "border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-white",
    badge: "bg-fuchsia-700 text-white",
    status: "border-fuchsia-200 bg-white/80 text-fuchsia-900",
    title: "text-fuchsia-950",
    why: "text-fuchsia-800",
    primary:
      "border-fuchsia-700 bg-fuchsia-700 text-white hover:bg-fuchsia-800",
    secondary:
      "border-fuchsia-200 bg-white/80 text-fuchsia-900 hover:bg-fuchsia-100",
    dot: "bg-fuchsia-600",
  },
  operations: {
    shell:
      "border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-white",
    badge: "bg-slate-800 text-white",
    status: "border-slate-200 bg-white/80 text-slate-800",
    title: "text-slate-950",
    why: "text-slate-700",
    primary:
      "border-slate-800 bg-slate-800 text-white hover:bg-slate-900",
    secondary:
      "border-slate-200 bg-white/80 text-slate-800 hover:bg-slate-100",
    dot: "bg-slate-600",
  },
  default: {
    shell:
      "border-stone-200 bg-gradient-to-br from-stone-50 via-white to-stone-100",
    badge: "bg-stone-800 text-white",
    status: "border-stone-200 bg-white/80 text-stone-700",
    title: "text-stone-950",
    why: "text-stone-600",
    primary:
      "border-stone-800 bg-stone-800 text-white hover:bg-stone-950",
    secondary:
      "border-stone-200 bg-white/80 text-stone-800 hover:bg-stone-100",
    dot: "bg-stone-500",
  },
};

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

function getNotificationTheme(notification) {
  const triggerType = String(notification?.triggerType || "");
  const reasonCode = String(notification?.reasonCode || "");

  if (
    reasonCode === "pantry_details_incomplete" ||
    triggerType === "pantry_setup_reminder"
  ) {
    return notificationThemes.recipe;
  }

  if (
    [
      "customer_order_rejected",
      "customer_order_partial_unavailable",
      "customer_order_seller_cancelled",
      "customer_order_delivery_failed",
    ].includes(reasonCode)
  ) {
    return notificationThemes.security;
  }

  if (
    notification?.category === "household" &&
    (triggerType.includes("invitation") || reasonCode.includes("invitation"))
  ) {
    return notificationThemes.invitation;
  }

  return notificationThemes[notification?.category] || notificationThemes.default;
}

function getPantryItemName(explanation) {
  const normalized = String(explanation || "").trim();
  const match = normalized.match(/^(.+?)\s+is in your Pantry\./i);

  return match?.[1]?.trim() || "This item";
}

function getNotificationCopy(notification) {
  const reasonCode = String(notification?.reasonCode || "");
  const triggerType = String(notification?.triggerType || "");
  const explanation = String(notification?.explanation || "").trim();

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

function PreferenceToggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:bg-white/[0.1]">
      <span>
        <span className="block text-sm font-black text-white">{label}</span>

        <span className="mt-1 block text-xs leading-5 text-stone-300">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

function NotificationCard({ notification, busy, onAction, onMarkRead }) {
  const available = new Set(notification.actions || []);
  const theme = getNotificationTheme(notification);
  const copy = getNotificationCopy(notification);
  const unread = isUnreadNotification(notification);

  const deepLinkPath =
    typeof notification?.deepLink?.path === "string" &&
    notification.deepLink.path.startsWith("/") &&
    !notification.deepLink.path.startsWith("//")
      ? notification.deepLink.path
      : "";

  const statusLabel = notification.readAt
    ? "Read"
    : titleize(notification.status) || "New";

  const categoryLabel =
    notification?.category === "household" &&
    (String(notification?.triggerType || "").includes("invitation") ||
      String(notification?.reasonCode || "").includes("invitation"))
      ? "Invitation"
      : titleize(notification.category) || "Update";

  const actionBase =
    "focus-ring inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <article
      className={[
        "relative overflow-hidden rounded-[24px] border p-5 transition",
        unread
          ? "shadow-[0_14px_34px_rgba(15,23,42,0.12)] ring-1 ring-inset ring-white/75 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.16)]"
          : "shadow-sm saturate-[0.68] opacity-[0.92] ring-1 ring-inset ring-white/55 hover:opacity-100 hover:saturate-100 hover:shadow-md",
        theme.shell,
      ].join(" ")}
    >
      <div
        className={`absolute bottom-0 left-0 top-0 w-1.5 ${theme.dot} ${
          unread ? "opacity-100" : "opacity-45"
        }`}
        aria-hidden="true"
      />

      <div className="relative z-20 flex flex-col gap-4 pl-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${theme.badge}`}
            >
              {categoryLabel}
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${theme.status}`}
            >
              {statusLabel}
            </span>

            {unread ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-stone-600">
                <span className={`size-2 rounded-full ${theme.dot}`} />
                New
              </span>
            ) : null}
          </div>

          <h3 className={`mt-3 text-base font-black sm:text-lg ${theme.title}`}>
            {copy.title}
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-700">
            {copy.description}
          </p>

          <p className={`mt-3 text-xs font-bold ${theme.why}`}>
            Why this alert: {copy.why}
          </p>
        </div>

        <time className="shrink-0 text-[11px] font-semibold text-stone-500">
          {notification.createdAt
            ? new Date(notification.createdAt).toLocaleString()
            : "—"}
        </time>
      </div>

      <div className="relative z-20 mt-4 flex flex-wrap gap-2 pl-1">
        {deepLinkPath ? (
          <Link
            to={deepLinkPath}
            className={`${actionBase} ${theme.primary}`}
          >
            <ArrowUpRight size={14} />
            {copy.openLabel}
          </Link>
        ) : null}

        {unread ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onMarkRead(notification.id)}
          >
            <CheckCheck size={14} />
            Mark as read
          </button>
        ) : null}

        {available.has("accept") ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onAction(notification.id, "accept")}
          >
            <Check size={14} />
            Done
          </button>
        ) : null}

        {available.has("snooze") ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onAction(notification.id, "snooze")}
          >
            <Clock3 size={14} />
            Snooze 24h
          </button>
        ) : null}

        {available.has("still_have") ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onAction(notification.id, "still_have")}
          >
            <PackageCheck size={14} />
            Still have
          </button>
        ) : null}

        {available.has("bought_elsewhere") ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onAction(notification.id, "bought_elsewhere")}
          >
            <ShoppingBag size={14} />
            Bought elsewhere
          </button>
        ) : null}

        {available.has("stop_suggesting") ? (
          <button
            type="button"
            className={`${actionBase} ${theme.secondary}`}
            disabled={busy}
            onClick={() => onAction(notification.id, "stop_suggesting")}
          >
            <BellOff size={14} />
            Stop suggesting
          </button>
        ) : null}

        {available.has("dismiss") ? (
          <button
            type="button"
            className={`${actionBase} border-stone-200 bg-white/70 text-stone-600 hover:bg-white hover:text-red-700`}
            disabled={busy}
            onClick={() => onAction(notification.id, "dismiss")}
          >
            <X size={14} />
            Dismiss
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function NotificationCenterPage() {
  const [preferences, setPreferences] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [preferenceData, notificationData] = await Promise.all([
        getNotificationPreferences(),
        listNotifications({
          limit: 60,
        }),
      ]);

      setPreferences(preferenceData?.preferences || null);
      setNotifications(notificationData?.notifications || []);
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(requestError, "Unable to load notifications.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markOneAsRead(notificationId) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await markNotificationRead(notificationId);
      const updated = data?.notification || null;

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? updated || {
                ...item,
                status: "read",
                readAt: new Date().toISOString(),
              }
            : item
        )
      );

      setNotice("Notification marked as read.");
      broadcastNotificationChange();
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(
          requestError,
          "Unable to mark notification as read."
        )
      );
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

      setNotifications((current) =>
        current.map((item) =>
          isUnreadNotification(item)
            ? {
                ...item,
                status: "read",
                readAt,
              }
            : item
        )
      );

      setNotice(
        data?.markedReadCount
          ? `${data.markedReadCount} notification${
              data.markedReadCount === 1 ? "" : "s"
            } marked as read.`
          : "All visible notifications are now read."
      );
      broadcastNotificationChange();
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(
          requestError,
          "Unable to mark all notifications as read."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function patchPreference(key, value) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await updateNotificationPreferences({
        [key]: value,
      });

      setPreferences(data?.preferences || null);
      setNotice("Notification preference updated.");
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(
          requestError,
          "Unable to update notification preferences."
        )
      );
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
        snoozeUntil:
          actionName === "snooze"
            ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            : null,
      });

      setNotice(
        actionName === "still_have" || actionName === "bought_elsewhere"
          ? "Feedback recorded through the Pantry evidence workflow."
          : "Notification updated."
      );

      await load();
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(
          requestError,
          "Unable to apply notification action."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter(isUnreadNotification).length,
    [notifications]
  );

  const enabledPreferenceCount = useMemo(() => {
    if (!preferences) {
      return 0;
    }

    return PREFERENCE_KEYS.filter((key) => preferences[key] === true).length;
  }, [preferences]);

  const visibleNotifications = showAll
    ? notifications
    : notifications.slice(0, 6);

  return (
    <main className="epantry-workspace-canvas min-h-screen bg-[#f3f7f5] py-8">
      <div className="page-shell max-w-6xl">
        <header className="overflow-hidden rounded-[28px] border border-emerald-900/20 bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white shadow-lg shadow-emerald-950/10">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                <Bell size={14} />
                Notification Center
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-[28px]">
                Know what changed. Act on what matters.
              </h1>

              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-stone-300">
                Pantry reminders, order movement, household invites and other useful updates — organised so the next action is obvious.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreferencesOpen((current) => !current)}
                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/15"
                aria-expanded={preferencesOpen}
              >
                <Settings2 size={15} />
                Preferences
                {preferences ? (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] text-emerald-100">
                    {enabledPreferenceCount} on
                  </span>
                ) : null}
                {preferencesOpen ? (
                  <ChevronUp size={14} />
                ) : (
                  <ChevronDown size={14} />
                )}
              </button>

              <button
                type="button"
                onClick={load}
                disabled={loading || busy}
                className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-900 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {preferencesOpen ? (
            <div className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-black text-white">
                    Alert preferences
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-stone-300">
                    Choose which useful EPANTRY updates can reach you. Marketing consent remains controlled separately.
                  </p>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {preferences ? (
                  <>
                    <PreferenceToggle
                      label="In-app"
                      description="Show useful alerts inside EPANTRY."
                      checked={preferences.inAppEnabled === true}
                      onChange={(value) =>
                        patchPreference("inAppEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Email"
                      description="Send eligible account and order updates by email."
                      checked={preferences.emailEnabled === true}
                      onChange={(value) =>
                        patchPreference("emailEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Planning"
                      description="Meal-plan shortages and planning reminders."
                      checked={preferences.planningEnabled === true}
                      onChange={(value) =>
                        patchPreference("planningEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Pantry"
                      description="Use-soon and Pantry detail reminders."
                      checked={preferences.pantryEnabled === true}
                      onChange={(value) =>
                        patchPreference("pantryEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Household"
                      description="Invites and shared-household updates."
                      checked={preferences.householdEnabled === true}
                      onChange={(value) =>
                        patchPreference("householdEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Orders"
                      description="Order preparation and delivery milestones."
                      checked={preferences.orderEnabled === true}
                      onChange={(value) =>
                        patchPreference("orderEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Operations"
                      description="Host and operational account notices."
                      checked={preferences.operationsEnabled !== false}
                      onChange={(value) =>
                        patchPreference("operationsEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Price"
                      description="Meaningful price-change alerts."
                      checked={preferences.priceEnabled === true}
                      onChange={(value) =>
                        patchPreference("priceEnabled", value)
                      }
                    />

                    <PreferenceToggle
                      label="Marketing"
                      description="Optional marketing delivery preference."
                      checked={preferences.marketingEnabled === true}
                      disabled={preferences.marketingEnabled !== true}
                      onChange={(value) =>
                        patchPreference("marketingEnabled", value)
                      }
                    />
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              className="focus-ring grid size-8 shrink-0 place-items-center rounded-full border border-emerald-200 bg-white/80 text-emerald-800 transition hover:bg-white"
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-emerald-100 bg-emerald-50/70">
            <LoaderCircle className="animate-spin text-emerald-700" />
          </div>
        ) : (
          <section className="mt-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                    Your alerts
                  </h2>

                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-800">
                      All caught up
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-stone-500">
                  {notifications.length} visible notification
                  {notifications.length === 1 ? "" : "s"} · colour shows what kind of update it is
                </p>
              </div>

              <button
                type="button"
                onClick={markEveryNotificationAsRead}
                disabled={busy || unreadCount === 0}
                className={[
                  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition",
                  unreadCount > 0
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:-translate-y-0.5 hover:bg-emerald-800 hover:shadow-md"
                    : "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 opacity-70",
                ].join(" ")}
              >
                <CheckCheck size={15} />
                Mark all as read
              </button>
            </div>

            <div className="space-y-3">
              {notifications.length ? (
                visibleNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    busy={busy}
                    onAction={action}
                    onMarkRead={markOneAsRead}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-8 text-center shadow-sm">
                  <BellOff className="mx-auto text-emerald-400" />

                  <p className="mt-3 text-base font-black text-emerald-950">
                    Nothing needs your attention right now
                  </p>

                  <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-stone-600">
                    When Pantry details, household activity, planning or an order needs you, the useful update will appear here.
                  </p>
                </div>
              )}
            </div>

            {notifications.length > 6 ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                  className="focus-ring inline-flex items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-5 py-2.5 text-xs font-black text-teal-900 shadow-sm transition hover:bg-teal-100"
                >
                  {showAll
                    ? "View less"
                    : `View all ${notifications.length} notifications`}
                </button>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
