import {
  Bell,
  BellOff,
  Check,
  Clock3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import {
  getAnalyticsErrorMessage,
  getNotificationPreferences,
  listNotifications,
  performNotificationAction,
  updateNotificationPreferences,
} from "../../analytics/services/analytics.service";

const buttonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 disabled:cursor-not-allowed disabled:opacity-50";

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function PreferenceToggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4">
      <span>
        <span className="block text-sm font-black text-stone-950">{label}</span>

        <span className="mt-1 block text-xs leading-5 text-stone-500">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-emerald-700"
      />
    </label>
  );
}

function NotificationCard({ notification, busy, onAction }) {
  const available = new Set(notification.actions || []);

  return (
    <article className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-800">
              {titleize(notification.category)}
            </span>

            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black text-stone-600">
              {titleize(notification.status)}
            </span>
          </div>

          <p className="mt-3 text-sm font-black text-stone-950">
            {titleize(notification.reasonCode)}
          </p>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            {notification.explanation}
          </p>

          <p className="mt-3 text-[11px] text-stone-400">
            Why: {notification.sourceDomain} · {notification.triggerType}
          </p>
        </div>

        <div className="shrink-0 text-[11px] text-stone-400">
          {notification.createdAt
            ? new Date(notification.createdAt).toLocaleString()
            : "—"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.has("accept") ? (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => onAction(notification.id, "accept")}
          >
            <Check size={14} />
            Done
          </button>
        ) : null}

        {available.has("dismiss") ? (
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => onAction(notification.id, "dismiss")}
          >
            <X size={14} />
            Dismiss
          </button>
        ) : null}

        {available.has("snooze") ? (
          <button
            type="button"
            className={buttonClass}
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
            className={buttonClass}
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
            className={buttonClass}
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
            className={buttonClass}
            disabled={busy}
            onClick={() => onAction(notification.id, "stop_suggesting")}
          >
            <BellOff size={14} />
            Stop suggesting
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

  return (
    <main className="min-h-screen bg-[#f7f5ef] py-8">
      <div className="page-shell max-w-6xl">
        <header className="rounded-[28px] border border-stone-200 bg-stone-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                <Bell size={14} />
                Notification Center
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight">
                Useful alerts, with a reason
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
                EPANTRY notifications are domain-triggered and explainable.
                Dismiss, snooze, correct Pantry evidence, or stop a specific
                suggestion reason whenever the action is relevant.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading || busy}
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-stone-900 disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-stone-200 bg-white">
            <LoaderCircle className="animate-spin text-emerald-700" />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-4">
              <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black text-stone-950">
                  Preferences
                </h2>

                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Marketing consent is governed separately by EPANTRY consent
                  controls. This page cannot manufacture marketing consent by
                  enabling a delivery preference.
                </p>

                <div className="mt-4 space-y-2">
                  {preferences ? (
                    <>
                      <PreferenceToggle
                        label="In-app"
                        description="Core Notification Center delivery."
                        checked={preferences.inAppEnabled === true}
                        onChange={(value) =>
                          patchPreference("inAppEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Email"
                        description="Eligible transactional/useful notifications by email."
                        checked={preferences.emailEnabled === true}
                        onChange={(value) =>
                          patchPreference("emailEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Planning"
                        description="Meal-plan shortage and planning reasons."
                        checked={preferences.planningEnabled === true}
                        onChange={(value) =>
                          patchPreference("planningEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Pantry"
                        description="Use-soon and pantry evidence reasons."
                        checked={preferences.pantryEnabled === true}
                        onChange={(value) =>
                          patchPreference("pantryEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Household"
                        description="Shared-list and household updates."
                        checked={preferences.householdEnabled === true}
                        onChange={(value) =>
                          patchPreference("householdEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Orders"
                        description="Order milestone notifications."
                        checked={preferences.orderEnabled === true}
                        onChange={(value) =>
                          patchPreference("orderEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Price"
                        description="Meaningful price deviation reasons."
                        checked={preferences.priceEnabled === true}
                        onChange={(value) =>
                          patchPreference("priceEnabled", value)
                        }
                      />

                      <PreferenceToggle
                        label="Marketing"
                        description="Can be disabled here. Enabling requires the separate purpose-scoped consent workflow."
                        checked={preferences.marketingEnabled === true}
                        disabled={preferences.marketingEnabled !== true}
                        onChange={(value) =>
                          patchPreference("marketingEnabled", value)
                        }
                      />
                    </>
                  ) : null}
                </div>
              </section>
            </aside>

            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-stone-950">
                    Notifications
                  </h2>

                  <p className="mt-1 text-xs text-stone-500">
                    {notifications.length} visible items
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {notifications.length ? (
                  notifications.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      busy={busy}
                      onAction={action}
                    />
                  ))
                ) : (
                  <div className="rounded-[24px] border border-stone-200 bg-white p-8 text-center">
                    <BellOff className="mx-auto text-stone-300" />

                    <p className="mt-3 text-sm font-black text-stone-700">
                      No useful notifications right now
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      EPANTRY does not add a generic engagement-spam scheduler
                      when there is no domain reason.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
