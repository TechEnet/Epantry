import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  DatabaseZap,
  ExternalLink,
  History,
  LoaderCircle,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Unplug,
} from "lucide-react";

import { Link } from "react-router-dom";

import { useHousehold } from "../../households/context/HouseholdContext";

import {
  beginPurchaseSourceAuthorization,
  correctPurchaseTransaction,
  createPurchaseSource,
  deleteImportedPurchaseHistory,
  getPurchaseHistory,
  getPurchaseSourceProviders,
  getPurchaseSources,
  requestPurchaseSourceSync,
  updatePurchaseSource,
} from "../services/purchaseSource.service";

const providerScopes = {
  gmail: ["purchase_receipts", "order_history", "delivery_status"],
  outlook: ["purchase_receipts", "order_history", "delivery_status"],
  retailer: ["order_history", "delivery_status"],
  receipt_import: ["purchase_receipts"],
};

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function formatDateTime(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString();
}

function formatMoney(value, currency) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "INR",
    }).format(Number(value) / 100);
  } catch {
    return `${currency || "INR"} ${(Number(value) / 100).toFixed(2)}`;
  }
}

function SourceStatusBadge({ status }) {
  const styles = {
    connected: "border-emerald-200 bg-emerald-50 text-emerald-800",
    paused: "border-amber-200 bg-amber-50 text-amber-800",
    pending_authorization: "border-blue-200 bg-blue-50 text-blue-800",
    reauthorization_required: "border-orange-200 bg-orange-50 text-orange-800",
    revoked: "border-stone-200 bg-stone-100 text-stone-600",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
        styles[status] || styles.revoked
      }`}
    >
      {String(status || "unknown").replaceAll("_", " ")}
    </span>
  );
}

function Notice({ notice }) {
  if (!notice?.message) {
    return null;
  }

  const isError = notice.type === "error";

  return (
    <div
      className={[
        "mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6",
        isError
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900",
      ].join(" ")}
      role={isError ? "alert" : "status"}
    >
      {isError ? (
        <AlertTriangle
          size={19}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          size={19}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}
      <span>{notice.message}</span>
    </div>
  );
}

export default function PurchaseIntelligencePage() {
  const { household, hasHousehold, isLoadingHousehold } = useHousehold();

  const [providers, setProviders] = useState([]);

  const [sources, setSources] = useState([]);

  const [transactions, setTransactions] = useState([]);

  const [selectedSourceId, setSelectedSourceId] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [busyKey, setBusyKey] = useState("");

  const [notice, setNotice] = useState(null);

  const [correctionDrafts, setCorrectionDrafts] = useState({});

  const selectedSource = useMemo(
    () =>
      sources.find((source) => source.sourceId === selectedSourceId) || null,
    [sources, selectedSourceId]
  );

  const loadData = useCallback(async () => {
    if (!hasHousehold) {
      setProviders([]);
      setSources([]);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [providerData, sourceData, historyData] = await Promise.all([
        getPurchaseSourceProviders(),
        getPurchaseSources(),
        getPurchaseHistory({
          sourceId: selectedSourceId,
        }),
      ]);

      setProviders(providerData?.providers || []);
      setSources(sourceData?.sources || []);
      setTransactions(historyData?.transactions || []);
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Unable to load purchase intelligence."
        ),
      });
    } finally {
      setIsLoading(false);
    }
  }, [hasHousehold, selectedSourceId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const perform = useCallback(
    async (key, action, successMessage) => {
      setBusyKey(key);
      setNotice(null);

      try {
        const result = await action();

        setNotice({
          type: "success",
          message: successMessage,
        });

        await loadData();

        return result;
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "The purchase-source action could not be completed."
          ),
        });

        return null;
      } finally {
        setBusyKey("");
      }
    },
    [loadData]
  );

  const connectProvider = async (provider) => {
    if (!household?.id) {
      return;
    }

    const result = await perform(
      `connect:${provider.provider}`,
      () =>
        createPurchaseSource({
          householdId: household.id,
          provider: provider.provider,
          displayLabel: provider.label,
          consentScopes: providerScopes[provider.provider] || [],
        }),
      `${provider.label} connection created.`
    );

    const source = result?.source;

    if (!source || provider.authorizationRequired !== true) {
      return;
    }

    const authorization = await perform(
      `authorize:${source.sourceId}`,
      () => beginPurchaseSourceAuthorization(source.sourceId),
      `Opening ${provider.label} authorization.`
    );

    if (authorization?.authorizationUrl) {
      window.location.assign(authorization.authorizationUrl);
    }
  };

  const authorizeSource = async (source) => {
    const authorization = await perform(
      `authorize:${source.sourceId}`,
      () => beginPurchaseSourceAuthorization(source.sourceId),
      "Opening provider authorization."
    );

    if (authorization?.authorizationUrl) {
      window.location.assign(authorization.authorizationUrl);
    }
  };

  const updateSource = (source, action, successMessage) =>
    perform(
      `${action}:${source.sourceId}`,
      () => updatePurchaseSource(source.sourceId, action),
      successMessage
    );

  const saveTransactionExclusion = (transaction, excludedFromLearning) =>
    perform(
      `transaction:${transaction.transactionId}`,
      () =>
        correctPurchaseTransaction(transaction.transactionId, {
          excludedFromLearning,
        }),
      excludedFromLearning
        ? "Purchase excluded from learning."
        : "Purchase restored to learning."
    );

  const saveItemCorrection = async (transaction, item) => {
    const draft = correctionDrafts[item.lineKey] || {};

    const result = await perform(
      `item:${item.lineKey}`,
      () =>
        correctPurchaseTransaction(transaction.transactionId, {
          itemCorrections: [
            {
              lineKey: item.lineKey,
              correctedLabel:
                draft.correctedLabel ??
                item.customerOverride?.correctedLabel ??
                "",
              note: draft.note ?? item.customerOverride?.note ?? "",
              excludedFromLearning:
                draft.excludedFromLearning ??
                item.excludedFromLearning ??
                false,
            },
          ],
        }),
      "Purchase item correction saved."
    );

    if (result) {
      setCorrectionDrafts((current) => {
        const next = {
          ...current,
        };
        delete next[item.lineKey];
        return next;
      });
    }
  };

  if (isLoadingHousehold) {
    return (
      <div className="grid min-h-[520px] place-items-center p-6">
        <LoaderCircle className="animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!hasHousehold) {
    return (
      <div className="p-4 sm:p-6 lg:p-7">
        <div className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-sm">
          <ShieldCheck
            size={34}
            className="text-emerald-700"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-black text-stone-950">
            Create your household first
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            Connected purchase intelligence is household-scoped. Create or join
            a household before linking a purchase source.
          </p>
          <Link
            to="/account/household"
            className="focus-ring mt-5 inline-flex rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white"
          >
            Open Household
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7">
      <header className="rounded-[24px] bg-stone-950 p-4 text-white shadow-sm sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-400">
              Customer Purchase Intelligence
            </p>
            <h1 className="mt-2 whitespace-nowrap text-[22px] font-black tracking-tight sm:mt-3 sm:text-4xl">
              Connected purchases
            </h1>
            <p className="mt-2 max-w-2xl text-[11px] leading-4 text-stone-400 sm:mt-3 sm:text-sm sm:leading-6">
              <span className="sm:hidden">
                Connect trusted sources. Pause, correct or delete imports
                anytime.
              </span>
              <span className="hidden sm:inline">
                Connect only the purchase sources you choose. Imported activity
                stays correctable, pausable and deletable, and it never becomes
                exact Pantry truth automatically.
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-stone-800 bg-stone-900 px-3 py-2 text-[10px] font-bold text-stone-300 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs">
            Household: {household.name || "Current household"}
          </div>
        </div>
      </header>

      <div className="mt-5">
        <Notice notice={notice} />
      </div>

      <section className="mb-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:mb-5 sm:rounded-[26px] sm:p-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
            How this page helps you
          </p>
          <h2 className="mt-1 whitespace-nowrap text-[8px] font-black leading-none tracking-[-0.015em] text-stone-950 sm:mt-2 sm:text-xl sm:leading-normal sm:tracking-normal">
            Bring your purchases into EPANTRY without giving up control.
          </h2>
          <p className="mt-1 max-w-3xl text-[11px] leading-4 text-stone-600 sm:mt-2 sm:text-sm sm:leading-6">
            <span className="sm:hidden">
              Connect a source, review imports and choose what EPANTRY may learn
              from. Imports never replace confirmed Pantry data.
            </span>
            <span className="hidden sm:inline">
              Connect a purchase source, review what EPANTRY imports, and decide
              what can be used for learning. Imported purchases stay separate
              from confirmed Pantry truth until stronger household evidence
              exists.
            </span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              step: "1",
              title: "Choose a source",
              text: "Pick Gmail, Outlook, a supported retailer or receipt import.",
            },
            {
              step: "2",
              title: "Connect & sync",
              text: "Authorize it once; EPANTRY imports supported purchases.",
            },
            {
              step: "3",
              title: "Review what came in",
              text: "Review purchases, fix names or ignore what you do not need.",
            },
            {
              step: "4",
              title: "Stay in control",
              text: "Pause, disconnect or delete imported history whenever you want.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[16px] border border-stone-200 bg-stone-50 px-2.5 py-3 sm:rounded-[20px] sm:p-4"
            >
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] font-black text-emerald-800 sm:h-7 sm:w-7 sm:text-xs">
                  {item.step}
                </span>
                <h3 className="min-w-0 whitespace-nowrap text-[8px] font-black leading-none tracking-[-0.02em] text-stone-950 sm:text-sm sm:leading-normal sm:tracking-normal">
                  {item.title}
                </h3>
              </div>
              <p className="ml-auto mt-1 w-[78%] text-left text-[9px] leading-[1.25] text-stone-600 sm:mt-2 sm:w-auto sm:text-xs sm:leading-5">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:rounded-[26px] sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={22}
            className="mt-0.5 shrink-0 text-emerald-700"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-black text-stone-950">Add a source</h2>
            <p className="mt-1 text-[11px] leading-4 text-stone-600 sm:text-sm sm:leading-6">
              <span className="sm:hidden">
                Your sign-in permissions stay with the provider, not in
                EPANTRY's app database.
              </span>
              <span className="hidden sm:inline">
                Email and retailer OAuth credentials stay in the dedicated
                provider gateway, outside the EPANTRY MongoDB application
                database.
              </span>
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-2 xl:grid-cols-4">
          {providers.map((provider) => {
            const key = `connect:${provider.provider}`;
            const busy = busyKey === key;

            return (
              <button
                key={provider.provider}
                type="button"
                disabled={busy || provider.available !== true}
                onClick={() => connectProvider(provider)}
                className="focus-ring rounded-[18px] border border-stone-200 p-3 text-left transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-[22px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  {provider.provider === "gmail" ||
                  provider.provider === "outlook" ? (
                    <Mail
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                    />
                  ) : provider.provider === "retailer" ? (
                    <ShoppingBag
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <DatabaseZap
                      size={20}
                      className="text-emerald-700"
                      aria-hidden="true"
                    />
                  )}
                  {busy ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin text-stone-500"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-xs font-black text-stone-950 sm:mt-3 sm:text-sm">
                  {provider.label}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-stone-500 sm:text-xs sm:leading-5">
                  {provider.available
                    ? provider.authorizationRequired
                      ? "Explicit authorization required."
                      : "Local import source."
                    : "Provider gateway not configured yet."}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:mt-5 sm:rounded-[26px] sm:p-6">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-base font-black text-stone-950 sm:text-lg">
              Your connected sources
            </h2>
            <p className="mt-0.5 text-[10px] leading-4 text-stone-500 sm:mt-1 sm:text-sm">
              Sync and learning controls are independent.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-2.5 py-1.5 text-[10px] font-black text-stone-700 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-stone-500">
            <LoaderCircle
              size={17}
              className="animate-spin"
              aria-hidden="true"
            />
            Loading sources...
          </div>
        ) : sources.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
            No purchase source has been connected yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
            {sources.map((source) => {
              const isBusy = busyKey.endsWith(`:${source.sourceId}`);

              return (
                <article
                  key={source.sourceId}
                  className="rounded-[18px] border border-stone-200 p-3 sm:rounded-[22px] sm:p-5"
                >
                  <div className="flex flex-col gap-2.5 sm:gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-black text-stone-950 sm:text-sm">
                          {source.displayLabel || source.provider}
                        </h3>
                        <SourceStatusBadge status={source.status} />
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-stone-500 sm:mt-2 sm:text-xs sm:leading-5">
                        Last successful sync:{" "}
                        {formatDateTime(source.sync?.lastSuccessfulSyncAt)}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-4 text-stone-500 sm:mt-1 sm:text-xs sm:leading-5">
                        Learning:{" "}
                        {source.learningEnabled ? "enabled" : "paused"}
                      </p>
                    </div>

                    <div
                      className={
                        source.provider === "receipt_import"
                          ? "grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2"
                          : "flex flex-wrap gap-1.5 sm:gap-2"
                      }
                    >
                      {source.status === "pending_authorization" ||
                      source.status === "reauthorization_required" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void authorizeSource(source)}
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-1 py-2 text-[7px] font-black text-white disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                          }
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Authorize
                        </button>
                      ) : null}

                      {source.status === "connected" &&
                      source.provider !== "receipt_import" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void perform(
                              `sync:${source.sourceId}`,
                              () => requestPurchaseSourceSync(source.sourceId),
                              "Purchase-source sync requested."
                            )
                          }
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-stone-200 px-1 py-2 text-[7px] font-black text-stone-700 disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                          }
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                          Sync
                        </button>
                      ) : null}

                      {source.status === "connected" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void updateSource(
                              source,
                              "pause",
                              "Source sync paused."
                            )
                          }
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-stone-200 px-1 py-2 text-[7px] font-black text-stone-700 disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                          }
                        >
                          <CirclePause
                            size={14}
                            className="h-[11px] w-[11px] sm:h-3.5 sm:w-3.5"
                            aria-hidden="true"
                          />
                          Pause sync
                        </button>
                      ) : null}

                      {source.status === "paused" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void updateSource(
                              source,
                              "resume",
                              "Source sync resumed."
                            )
                          }
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-stone-200 px-1 py-2 text-[7px] font-black text-stone-700 disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                          }
                        >
                          <CirclePlay
                            size={14}
                            className="h-[11px] w-[11px] sm:h-3.5 sm:w-3.5"
                            aria-hidden="true"
                          />
                          Resume sync
                        </button>
                      ) : null}

                      {source.status !== "revoked" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void updateSource(
                              source,
                              source.learningEnabled
                                ? "pause_learning"
                                : "resume_learning",
                              source.learningEnabled
                                ? "Purchase learning paused."
                                : "Purchase learning resumed."
                            )
                          }
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-stone-200 px-1 py-2 text-[7px] font-black text-stone-700 disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                          }
                        >
                          <RotateCcw
                            size={14}
                            className="h-[11px] w-[11px] sm:h-3.5 sm:w-3.5"
                            aria-hidden="true"
                          />
                          {source.learningEnabled
                            ? "Pause learning"
                            : "Resume learning"}
                        </button>
                      ) : null}

                      {source.status !== "revoked" ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void updateSource(
                              source,
                              "revoke",
                              "Source disconnected and consent revoked."
                            )
                          }
                          className={
                            source.provider === "receipt_import"
                              ? "focus-ring inline-flex w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-red-200 px-1 py-2 text-[7px] font-black text-red-700 disabled:opacity-50 sm:w-auto sm:gap-2 sm:px-3 sm:text-xs"
                              : "focus-ring inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                          }
                        >
                          <Unplug
                            size={14}
                            className="h-[11px] w-[11px] sm:h-3.5 sm:w-3.5"
                            aria-hidden="true"
                          />
                          Disconnect
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History
                size={20}
                className="text-emerald-700"
                aria-hidden="true"
              />
              <h2 className="text-lg font-black text-stone-950">
                Imported purchase history
              </h2>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-stone-500 sm:text-sm sm:leading-6">
              <span className="sm:hidden">
                Review, fix or ignore imports before EPANTRY may learn from
                them.
              </span>
              <span className="hidden sm:inline">
                Correct or exclude imported evidence before EPANTRY uses it for
                optional learning.
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedSourceId}
              onChange={(event) => setSelectedSourceId(event.target.value)}
              className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700"
            >
              <option value="">All sources</option>
              {sources.map((source) => (
                <option key={source.sourceId} value={source.sourceId}>
                  {source.displayLabel || source.provider}
                  {source.status === "revoked" ? " (disconnected)" : ""}
                </option>
              ))}
            </select>

            {selectedSource ? (
              <button
                type="button"
                disabled={
                  busyKey === `delete-history:${selectedSource.sourceId}`
                }
                onClick={() =>
                  void perform(
                    `delete-history:${selectedSource.sourceId}`,
                    () =>
                      deleteImportedPurchaseHistory(selectedSource.sourceId),
                    "Imported history deleted. Older records will not be silently re-imported."
                  )
                }
                className="focus-ring inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete source history
              </button>
            ) : null}
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
            No imported purchases are available for this view.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {transactions.map((transaction) => (
              <article
                key={transaction.transactionId}
                className="rounded-[22px] border border-stone-200 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-black text-stone-950">
                      {transaction.merchantName || "Imported purchase"}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDateTime(transaction.purchasedAt)}
                    </p>
                    {formatMoney(
                      transaction.totalMinor,
                      transaction.currency
                    ) ? (
                      <p className="mt-1 text-xs font-bold text-stone-700">
                        {formatMoney(
                          transaction.totalMinor,
                          transaction.currency
                        )}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={
                      busyKey === `transaction:${transaction.transactionId}`
                    }
                    onClick={() =>
                      void saveTransactionExclusion(
                        transaction,
                        !transaction.excludedFromLearning
                      )
                    }
                    className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                  >
                    {transaction.excludedFromLearning
                      ? "Restore to learning"
                      : "Ignore this purchase"}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {(transaction.items || []).map((item) => {
                    const draft = correctionDrafts[item.lineKey] || {};

                    return (
                      <div
                        key={item.lineKey}
                        className="rounded-2xl bg-stone-50 p-4"
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_auto] lg:items-end">
                          <div>
                            <p className="text-xs font-black text-stone-900">
                              {item.customerOverride?.correctedLabel ||
                                item.sourceLabel ||
                                "Imported item"}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-stone-500">
                              Qty{" "}
                              {item.customerOverride?.quantity ??
                                item.quantityFulfilled ??
                                item.quantityOrdered ??
                                "-"}{" "}
                              · Match {item.matchStatus || "unmatched"}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <input
                              value={
                                draft.correctedLabel ??
                                item.customerOverride?.correctedLabel ??
                                ""
                              }
                              onChange={(event) =>
                                setCorrectionDrafts((current) => ({
                                  ...current,
                                  [item.lineKey]: {
                                    ...current[item.lineKey],
                                    correctedLabel: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Correct item name"
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs"
                            />
                            <input
                              value={
                                draft.note ?? item.customerOverride?.note ?? ""
                              }
                              onChange={(event) =>
                                setCorrectionDrafts((current) => ({
                                  ...current,
                                  [item.lineKey]: {
                                    ...current[item.lineKey],
                                    note: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Correction note"
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCorrectionDrafts((current) => ({
                                  ...current,
                                  [item.lineKey]: {
                                    ...current[item.lineKey],
                                    excludedFromLearning: !(
                                      current[item.lineKey]
                                        ?.excludedFromLearning ??
                                      item.excludedFromLearning ??
                                      false
                                    ),
                                  },
                                }))
                              }
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-black text-stone-700"
                            >
                              {draft.excludedFromLearning ??
                              item.excludedFromLearning
                                ? "Use for learning"
                                : "Ignore item"}
                            </button>
                            <button
                              type="button"
                              disabled={busyKey === `item:${item.lineKey}`}
                              onClick={() =>
                                void saveItemCorrection(transaction, item)
                              }
                              className="focus-ring rounded-xl bg-stone-950 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
                            >
                              Save correction
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
