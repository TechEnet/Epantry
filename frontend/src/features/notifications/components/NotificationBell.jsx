import { Bell } from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import { listNotifications } from "../../analytics/services/analytics.service";

const UNREAD_STATUSES = new Set([
  "pending",
  "delivered",
  "action_required_domain",
]);

export default function NotificationBell({ compact = false }) {
  const { isAuthenticated, isBootstrapping } = useAuth();

  const location = useLocation();

  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await listNotifications({
        limit: 100,
      });

      const notifications = data?.notifications || [];

      setUnreadCount(
        notifications.filter(
          (item) => !item.readAt && UNREAD_STATUSES.has(item.status)
        ).length
      );
    } catch {
      // The bell is progressive enhancement; the Notification Center surfaces errors.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isBootstrapping) {
      return undefined;
    }

    load();

    const intervalId = window.setInterval(load, 60000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    const handleNotificationsChanged = () => {
      load();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(
      "epantry:notifications-changed",
      handleNotificationsChanged
    );

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(
        "epantry:notifications-changed",
        handleNotificationsChanged
      );
    };
  }, [isBootstrapping, load]);

  useEffect(() => {
    if (location.pathname === "/notifications") {
      load();
    }
  }, [location.pathname, load]);

  if (!isAuthenticated || isBootstrapping) {
    return null;
  }

  return (
    <Link
      to="/notifications"
      className={[
        "focus-ring relative grid place-items-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
        compact ? "size-9" : "size-10",
      ].join(" ")}
      aria-label={
        unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"
      }
      title="Notifications"
    >
      <Bell size={compact ? 16 : 18} aria-hidden="true" />

      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-black leading-none text-white ring-2 ring-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
