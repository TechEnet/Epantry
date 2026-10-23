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
      className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-bold capitalize tracking-normal ${
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
      <div className="grid min-h-[320px] place-items-center" role="status">
        <LoaderCircle
          size={28}
          className="animate-spin text-[#173F35]"
          aria-hidden="true"
        />
        <span className="sr-only">Loading household</span>
      </div>
    );
  }

  if (!hasHousehold) {
    return (
      <div className="pi-page">
        <section className="pi-household-required">
          <ShieldCheck size={32} aria-hidden="true" />
          <p className="pi-eyebrow">Connected purchases</p>
          <h1>Create your household first</h1>
          <p>
            Purchase sources belong to a household. Create or join one to get
            started.
          </p>
          <Link to="/account/household" className="pi-button pi-button-primary">
            Open Household
          </Link>
        </section>
        <style>{purchasePageStyles}</style>
      </div>
    );
  }

  const connectedCount = sources.filter(
    (source) => source.status === "connected"
  ).length;
  const activeLearningCount = sources.filter(
    (source) => source.status === "connected" && source.learningEnabled
  ).length;

  return (
    <main className="pi-page">
      <style>{purchasePageStyles}</style>
      <header className="pi-hero">
        <div className="pi-hero-copy">
          <p className="pi-eyebrow">
            <span className="pi-accent-line" /> YOUR PURCHASES, YOUR CONTROL
          </p>
          <h1>
            Connected
            <br />
            <span>purchases.</span>
          </h1>
          <p className="pi-hero-description">
            <span className="pi-desktop-copy">
              Bring receipts and order history together. Review what EPANTRY
              imports and decide what it can learn from.
            </span>
            <span className="pi-mobile-copy">
              Review purchases and control what you share.
            </span>
          </p>
          <div className="pi-hero-bottom">
            <a className="pi-button pi-button-primary" href="#pi-add-source">
              Add a source <span aria-hidden="true">&#8594;</span>
            </a>
            <a className="pi-hero-secondary" href="#pi-history">
              Review purchases <span aria-hidden="true">&#8594;</span>
            </a>
          </div>
        </div>
        <div className="pi-hero-aside">
          <div className="pi-household-label">
            <ShieldCheck size={17} aria-hidden="true" /> CURRENT HOUSEHOLD
          </div>
          <p className="pi-household-name">
            {household.name || "Current household"}
          </p>
          <div
            className="pi-hero-stats"
            aria-label="Current purchase source summary"
          >
            <div>
              <strong>{sources.length}</strong>
              <span>Sources added</span>
            </div>
            <div>
              <strong>{connectedCount}</strong>
              <span>Connected now</span>
            </div>
          </div>
          <p className="pi-hero-safety">
            <ShieldCheck size={18} aria-hidden="true" /> Imports never overwrite
            confirmed Pantry records automatically.
          </p>
        </div>
      </header>

      <Notice notice={notice} />

      <section className="pi-journey" aria-labelledby="pi-how-title">
        <div className="pi-section-kicker">START HERE</div>
        <div className="pi-journey-heading">
          <h2 id="pi-how-title">Four steps. You're in control.</h2>
          <p>Connect, review and manage purchases at your own pace.</p>
        </div>
        <div className="pi-journey-steps">
          {[
            {
              num: "01",
              title: "Choose a source",
              desc: "Pick a supported provider or receipt import.",
            },
            {
              num: "02",
              title: "Connect",
              desc: "Approve access if the provider requires it.",
            },
            {
              num: "03",
              title: "Review imports",
              desc: "Check purchased items and correct names.",
            },
            {
              num: "04",
              title: "Stay in control",
              desc: "Pause, disconnect or delete history.",
            },
          ].map((step) => (
            <div className="pi-journey-step" key={step.num}>
              <span className="pi-journey-number">{step.num}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="pi-providers"
        id="pi-add-source"
        aria-labelledby="pi-add-title"
      >
        <div className="pi-section-intro">
          <div>
            <p className="pi-section-kicker">01 / CONNECT</p>
            <h2 id="pi-add-title">Add a source</h2>
            <p>
              Only connect what you want to share. Provider availability is
              shown below.
            </p>
          </div>
          <div className="pi-privacy-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              Provider sign-in details stay with the secure provider gateway.
            </span>
          </div>
        </div>
        <div className="pi-provider-grid">
          {providers.length === 0 && !isLoading ? (
            <p className="pi-muted-state">
              No purchase-source providers are available right now.
            </p>
          ) : null}
          {providers.map((provider) => {
            const key = `connect:${provider.provider}`;
            const busy = busyKey === key;
            const available = provider.available === true;
            const ProviderIcon =
              provider.provider === "gmail" || provider.provider === "outlook"
                ? Mail
                : provider.provider === "retailer"
                ? ShoppingBag
                : DatabaseZap;
            return (
              <button
                key={provider.provider}
                type="button"
                disabled={busy || !available}
                onClick={() => connectProvider(provider)}
                className={`pi-provider ${
                  available ? "pi-provider-ready" : "pi-provider-unavailable"
                }`}
              >
                <span className="pi-provider-icon">
                  <ProviderIcon size={23} aria-hidden="true" />
                </span>
                <span className="pi-provider-copy">
                  <strong>{provider.label}</strong>
                  <small>
                    {available
                      ? provider.authorizationRequired
                        ? "Secure sign-in required"
                        : "Local import source"
                      : "Not available yet"}
                  </small>
                </span>
                <span className="pi-provider-action" aria-hidden="true">
                  {busy ? (
                    <LoaderCircle size={18} className="animate-spin" />
                  ) : available ? (
                    "+"
                  ) : (
                    "-"
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pi-sources" aria-labelledby="pi-sources-title">
        <div className="pi-section-intro pi-sources-intro">
          <div>
            <p className="pi-section-kicker">02 / MANAGE</p>
            <h2 id="pi-sources-title">Your connected sources</h2>
            <p>Control syncing and learning independently for each source.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={isLoading}
            className="pi-button pi-button-outline"
          >
            <RefreshCw
              size={17}
              className={isLoading ? "animate-spin" : ""}
              aria-hidden="true"
            />{" "}
            Refresh
          </button>
        </div>
        <div
          className="pi-source-overview"
          aria-label="Source settings overview"
        >
          <span>
            <strong>{sources.length}</strong> total sources
          </span>
          <span>
            <strong>{connectedCount}</strong> connected
          </span>
          <span>
            <strong>{activeLearningCount}</strong> using learning
          </span>
        </div>
        {isLoading ? (
          <div className="pi-muted-state pi-loading">
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />{" "}
            Loading sources...
          </div>
        ) : sources.length === 0 ? (
          <div className="pi-empty-source">
            <Unplug size={23} aria-hidden="true" />
            <div>
              <strong>No sources connected yet</strong>
              <span>Choose an available provider above to begin.</span>
            </div>
          </div>
        ) : (
          <div className="pi-source-list">
            {sources.map((source) => {
              const isBusy = busyKey.endsWith(`:${source.sourceId}`);
              return (
                <article key={source.sourceId} className="pi-source-row">
                  <div className="pi-source-details">
                    <div className="pi-source-heading">
                      <h3>{source.displayLabel || source.provider}</h3>
                      <SourceStatusBadge status={source.status} />
                    </div>
                    <div className="pi-source-facts">
                      <span>
                        Last synced:{" "}
                        <strong>
                          {formatDateTime(source.sync?.lastSuccessfulSyncAt)}
                        </strong>
                      </span>
                      <span>
                        Learning:{" "}
                        <strong>
                          {source.learningEnabled ? "On" : "Paused"}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="pi-source-actions">
                    {(source.status === "pending_authorization" ||
                      source.status === "reauthorization_required") && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void authorizeSource(source)}
                        className="pi-small-button pi-small-primary"
                      >
                        <ExternalLink size={15} aria-hidden="true" /> Authorize
                      </button>
                    )}
                    {source.status === "connected" &&
                      source.provider !== "receipt_import" && (
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
                          className="pi-small-button"
                        >
                          <RefreshCw size={15} aria-hidden="true" /> Sync
                        </button>
                      )}
                    {source.status === "connected" && (
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
                        className="pi-small-button"
                      >
                        <CirclePause size={15} aria-hidden="true" /> Pause sync
                      </button>
                    )}
                    {source.status === "paused" && (
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
                        className="pi-small-button"
                      >
                        <CirclePlay size={15} aria-hidden="true" /> Resume sync
                      </button>
                    )}
                    {source.status !== "revoked" && (
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
                        className="pi-small-button"
                      >
                        <RotateCcw size={15} aria-hidden="true" />{" "}
                        {source.learningEnabled
                          ? "Pause learning"
                          : "Resume learning"}
                      </button>
                    )}
                    {source.status !== "revoked" && (
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
                        className="pi-small-button pi-small-danger"
                      >
                        <Unplug size={15} aria-hidden="true" /> Disconnect
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        className="pi-history"
        id="pi-history"
        aria-labelledby="pi-history-title"
      >
        <div className="pi-history-header">
          <div>
            <p className="pi-section-kicker">03 / REVIEW</p>
            <h2 id="pi-history-title">Imported purchase history</h2>
            <p>
              Review purchases, correct item names or exclude records from
              learning.
            </p>
          </div>
          <div className="pi-history-controls">
            <label className="pi-source-filter">
              <span>Show purchases from</span>
              <select
                value={selectedSourceId}
                onChange={(event) => setSelectedSourceId(event.target.value)}
              >
                <option value="">All sources</option>
                {sources.map((source) => (
                  <option key={source.sourceId} value={source.sourceId}>
                    {source.displayLabel || source.provider}
                    {source.status === "revoked" ? " (disconnected)" : ""}
                  </option>
                ))}
              </select>
            </label>
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
                className="pi-small-button pi-small-danger pi-delete-history"
              >
                <Trash2 size={16} aria-hidden="true" /> Delete source history
              </button>
            ) : null}
          </div>
        </div>
        <div className="pi-history-ledger">
          {isLoading ? (
            <div className="pi-muted-state pi-loading">
              <LoaderCircle
                size={18}
                className="animate-spin"
                aria-hidden="true"
              />{" "}
              Loading purchase history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="pi-no-purchases">
              <History size={26} aria-hidden="true" />
              <h3>No imported purchases yet</h3>
              <p>
                Once a connected source imports purchases, you can review them
                here.
              </p>
            </div>
          ) : (
            transactions.map((transaction, index) => (
              <article
                key={transaction.transactionId}
                className="pi-transaction"
              >
                <div className="pi-transaction-header">
                  <span className="pi-transaction-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="pi-transaction-intro">
                    <h3>{transaction.merchantName || "Imported purchase"}</h3>
                    <p>
                      {formatDateTime(transaction.purchasedAt)}{" "}
                      <span aria-hidden="true">&#183;</span>{" "}
                      {(transaction.items || []).length} items
                    </p>
                  </div>
                  {formatMoney(transaction.totalMinor, transaction.currency) ? (
                    <div className="pi-transaction-total">
                      <span>Purchase total</span>
                      <strong>
                        {formatMoney(
                          transaction.totalMinor,
                          transaction.currency
                        )}
                      </strong>
                    </div>
                  ) : null}
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
                    className="pi-small-button pi-transaction-toggle"
                  >
                    {transaction.excludedFromLearning
                      ? "Restore to learning"
                      : "Ignore this purchase"}
                  </button>
                </div>
                {(transaction.items || []).length > 0 ? (
                  <div className="pi-purchase-items">
                    {(transaction.items || []).map((item) => {
                      const draft = correctionDrafts[item.lineKey] || {};
                      return (
                        <div className="pi-purchase-item" key={item.lineKey}>
                          <div className="pi-item-info">
                            <h4>
                              {item.customerOverride?.correctedLabel ||
                                item.sourceLabel ||
                                "Imported item"}
                            </h4>
                            <p>
                              Qty{" "}
                              {item.customerOverride?.quantity ??
                                item.quantityFulfilled ??
                                item.quantityOrdered ??
                                "-"}{" "}
                              <span aria-hidden="true">&#183;</span> Match:{" "}
                              {item.matchStatus || "unmatched"}
                            </p>
                          </div>
                          <div className="pi-item-fields">
                            <label>
                              <span>Correct item name</span>
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
                                placeholder="Item name"
                              />
                            </label>
                            <label>
                              <span>Correction note</span>
                              <input
                                value={
                                  draft.note ??
                                  item.customerOverride?.note ??
                                  ""
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
                                placeholder="Optional note"
                              />
                            </label>
                          </div>
                          <div className="pi-item-actions">
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
                              className="pi-small-button"
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
                              className="pi-small-button pi-small-primary"
                            >
                              Save correction
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
      <div className="pi-privacy-footer">
        <ShieldCheck size={17} aria-hidden="true" /> Your imported purchases
        remain separate from confirmed Pantry quantities.
      </div>
    </main>
  );
}

const purchasePageStyles = `
.pi-page { --pi-forest:#173F35; --pi-clay:#C56C42; --pi-charcoal:#202421; --pi-sage:#D7DDCF; --pi-porcelain:#F7F6F2; width:100%; min-width:0; box-sizing:border-box; background:var(--pi-porcelain); color:var(--pi-charcoal); padding:clamp(18px,2.2vw,34px); padding-bottom:42px; font-family:'Plus Jakarta Sans',sans-serif; }
.pi-page *, .pi-page *::before, .pi-page *::after { box-sizing:border-box; }
.pi-page h1,.pi-page h2,.pi-page h3,.pi-page h4,.pi-page p { margin:0; }
.pi-page button,.pi-page select,.pi-page input { font:inherit; }
.pi-page button,.pi-page a,.pi-page input,.pi-page select { -webkit-tap-highlight-color:transparent; }
.pi-page button:focus-visible,.pi-page a:focus-visible,.pi-page input:focus-visible,.pi-page select:focus-visible { outline:3px solid var(--pi-clay); outline-offset:3px; }
.pi-page button:disabled { opacity:.78; cursor:not-allowed; transform:none!important; }
.pi-page .pi-eyebrow,.pi-page .pi-section-kicker { font-size:13px; font-weight:800; letter-spacing:.065em; line-height:1.5; color:var(--pi-forest); }
.pi-page .pi-accent-line { display:inline-block; width:26px; height:2px; vertical-align:middle; margin-right:9px; background:var(--pi-clay); }
.pi-page .pi-hero { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(315px,.72fr); overflow:hidden; min-height:310px; border:1px solid rgba(23,63,53,.12); border-radius:18px; box-shadow:0 13px 31px rgba(23,63,53,.065); }
.pi-page .pi-hero-copy { padding:clamp(28px,3.3vw,54px); display:flex; flex-direction:column; align-items:flex-start; justify-content:center; background:linear-gradient(140deg,#F7F6F2 45%,#EEEDE5 100%); border-top:5px solid var(--pi-clay); }
.pi-page .pi-hero h1 { margin-top:13px; font-size:clamp(36px,3.55vw,58px); line-height:1.065; letter-spacing:-.046em; font-weight:800; color:var(--pi-charcoal); }
.pi-page .pi-hero h1 span { color:var(--pi-forest); }
.pi-page .pi-hero-description { font-size:16px; line-height:1.6; max-width:580px; color:#525b54; margin-top:16px; }
.pi-page .pi-hero-bottom { display:flex; flex-wrap:wrap; align-items:center; gap:16px; margin-top:24px; }
.pi-page .pi-button { min-height:44px; display:inline-flex; align-items:center; justify-content:center; gap:9px; padding:10px 17px; border:1px solid transparent; border-radius:9px; text-decoration:none; cursor:pointer; font-size:14px; font-weight:750; white-space:nowrap; transition:transform .18s ease,background .18s ease,border-color .18s ease; }
.pi-page .pi-button:hover:not(:disabled) { transform:translateY(-2px); }
.pi-page .pi-button-primary { color:#fff; background:var(--pi-forest); }
.pi-page .pi-button-primary:hover { background:#245c4b; }
.pi-page .pi-hero-secondary { color:var(--pi-forest); font-weight:750; font-size:14px; text-decoration:underline; text-decoration-color:var(--pi-clay); text-underline-offset:5px; }
.pi-page .pi-hero-aside { background:var(--pi-forest); color:#F7F6F2; padding:clamp(26px,3vw,46px); display:flex; flex-direction:column; justify-content:space-between; position:relative; isolation:isolate; }
.pi-page .pi-hero-aside:after { content:''; position:absolute; width:200px; height:200px; border:1px solid rgba(255,255,255,.12); border-radius:50%; right:-100px; top:-110px; pointer-events:none; z-index:-1; }
.pi-page .pi-household-label { display:flex; gap:10px; align-items:center; font-size:13px; letter-spacing:.075em; font-weight:750; color:var(--pi-sage); }
.pi-page .pi-household-name { font-size:clamp(25px,2.6vw,36px); font-weight:750; line-height:1.2; letter-spacing:-.03em; overflow-wrap:anywhere; margin:14px 0 28px; }
.pi-page .pi-hero-stats { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:20px 0; border-top:1px solid rgba(255,255,255,.28); border-bottom:1px solid rgba(255,255,255,.24); }
.pi-page .pi-hero-stats div { display:flex; flex-direction:column; gap:3px; }
.pi-page .pi-hero-stats strong { font-size:38px; line-height:1.1; font-weight:800; color:#fff; }
.pi-page .pi-hero-stats span { font-size:13px; color:#dbe8e0; }
.pi-page .pi-hero-safety { margin-top:18px; display:flex; align-items:flex-start; gap:9px; font-size:13px; line-height:1.55; color:#E0E9E1; }
.pi-page .pi-hero-safety svg { flex:none; margin-top:1px; }
.pi-page .pi-journey { padding:32px 0 34px; border-bottom:1px solid #C9D0C5; }
.pi-page .pi-journey-heading { display:flex; gap:18px; align-items:end; justify-content:space-between; margin-top:5px; }
.pi-page h2 { font-size:clamp(23px,2.1vw,30px); line-height:1.2; letter-spacing:-.035em; font-weight:750; }
.pi-page .pi-journey-heading p { font-size:14px; line-height:1.5; color:#58615B; }
.pi-page .pi-journey-steps { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:0; margin-top:25px; }
.pi-page .pi-journey-step { padding:5px 22px 3px; border-left:1px solid #C4CBC1; }
.pi-page .pi-journey-step:first-child { padding-left:0; border-left:0; }
.pi-page .pi-journey-number { display:block; color:var(--pi-clay); font-size:22px; line-height:1; font-weight:800; letter-spacing:-.04em; margin-bottom:13px; }
.pi-page .pi-journey-step h3 { font-size:16px; line-height:1.3; color:var(--pi-forest); font-weight:750; }
.pi-page .pi-journey-step p { margin-top:6px; font-size:13px; line-height:1.5; color:#5B635D; }
.pi-page .pi-providers { padding:32px clamp(22px,2.4vw,36px); margin-top:30px; background:#F1EBE5; border-radius:16px; border-left:5px solid var(--pi-clay); }
.pi-page .pi-section-intro { display:flex; align-items:end; justify-content:space-between; flex-wrap:wrap; gap:20px; }
.pi-page .pi-section-intro h2 { margin-top:6px; }
.pi-page .pi-section-intro p:not(.pi-section-kicker) { margin-top:7px; font-size:15px; line-height:1.5; color:#59605A; }
.pi-page .pi-privacy-note { display:flex; max-width:330px; align-items:flex-start; gap:9px; color:var(--pi-forest); font-size:13px; line-height:1.45; font-weight:600; }
.pi-page .pi-privacy-note svg { flex:none; }
.pi-page .pi-provider-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:13px; margin-top:24px; }
.pi-page .pi-provider { appearance:none; border:1px solid #DDDAD0; border-radius:12px; background:#FAF9F6; color:var(--pi-charcoal); padding:19px 16px; min-height:150px; text-align:left; display:flex; flex-direction:column; position:relative; gap:15px; transition:box-shadow .2s ease,border-color .2s ease,transform .2s ease; }
.pi-page .pi-provider-ready { cursor:pointer; }
.pi-page .pi-provider-ready:hover { border-color:var(--pi-clay); box-shadow:0 10px 20px rgba(23,63,53,.08); transform:translateY(-3px); }
.pi-page .pi-provider-unavailable { cursor:not-allowed; background:#F2F0EB; }
.pi-page .pi-provider-icon { width:40px; height:40px; border-radius:10px; display:grid; place-items:center; background:var(--pi-sage); color:var(--pi-forest); }
.pi-page .pi-provider-copy { display:flex; flex-direction:column; gap:5px; }
.pi-page .pi-provider-copy strong { font-size:16px; font-weight:750; line-height:1.25; }
.pi-page .pi-provider-copy small { font-size:13px; line-height:1.4; color:#5B625C; }
.pi-page .pi-provider-action { position:absolute; right:15px; top:14px; font-size:20px; font-weight:600; color:var(--pi-clay); }
.pi-page .pi-sources { margin-top:32px; background:#fff; border:1px solid #DEE1D9; padding:clamp(20px,2.4vw,34px); border-radius:16px; }
.pi-page .pi-sources .pi-section-intro p:not(.pi-section-kicker) { max-width:600px; }
.pi-page .pi-button-outline { background:transparent; border:1px solid #BBC5B8; color:var(--pi-forest); }
.pi-page .pi-button-outline:hover { background:#E8EFE7; }
.pi-page .pi-source-overview { display:flex; flex-wrap:wrap; gap:10px 25px; margin-top:23px; padding:15px 20px; background:var(--pi-sage); color:var(--pi-forest); border-radius:8px; font-size:14px; }
.pi-page .pi-source-overview strong { font-size:18px; margin-right:4px; }
.pi-page .pi-source-list { margin-top:8px; }
.pi-page .pi-source-row { display:grid; grid-template-columns:minmax(240px,.8fr) minmax(0,1.3fr); gap:20px; align-items:center; padding:22px 4px; border-bottom:1px solid #D9E0D6; }
.pi-page .pi-source-row:last-child { border-bottom:0; }
.pi-page .pi-source-heading { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }
.pi-page .pi-source-heading h3 { font-size:18px; font-weight:750; color:var(--pi-charcoal); }
.pi-page .pi-source-facts { display:flex; flex-wrap:wrap; gap:8px 19px; margin-top:9px; font-size:13px; color:#535C56; line-height:1.5; }
.pi-page .pi-source-facts strong { color:var(--pi-forest); font-weight:700; }
.pi-page .pi-source-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.pi-page .pi-small-button { min-height:38px; display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:8px 12px; border:1px solid #CED6CC; background:#F8F9F6; color:var(--pi-forest); border-radius:8px; font-size:13px; font-weight:700; line-height:1.2; cursor:pointer; transition:background .15s ease,border-color .15s ease,transform .15s ease; }
.pi-page .pi-small-button:hover:not(:disabled) { background:#E6EDE4; border-color:#93B0A0; transform:translateY(-1px); }
.pi-page .pi-small-primary { color:#fff; background:var(--pi-forest); border-color:var(--pi-forest); }
.pi-page .pi-small-primary:hover:not(:disabled) { background:#245C4B; color:#fff; }
.pi-page .pi-small-danger { color:#A24636; border-color:#E7BFB1; background:#FFF8F4; }
.pi-page .pi-small-danger:hover:not(:disabled) { background:#F9E8DF; border-color:var(--pi-clay); }
.pi-page .pi-muted-state { padding:26px; font-size:15px; color:#535C56; line-height:1.5; }
.pi-page .pi-loading { display:flex; align-items:center; gap:9px; }
.pi-page .pi-empty-source { display:flex; align-items:center; gap:15px; color:var(--pi-forest); padding:28px 4px; }
.pi-page .pi-empty-source div { display:flex; flex-direction:column; gap:5px; }
.pi-page .pi-empty-source strong { font-size:16px; }
.pi-page .pi-empty-source span { font-size:14px; color:#5B625C; }
.pi-page .pi-history { margin-top:34px; background:#F0F1EC; border-radius:17px; overflow:hidden; border:1px solid #DDE1D8; }
.pi-page .pi-history-header { padding:27px clamp(20px,2.4vw,36px); display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:24px; background:var(--pi-sage); border-top:4px solid var(--pi-forest); }
.pi-page .pi-history-header h2 { margin-top:6px; }
.pi-page .pi-history-header p:not(.pi-section-kicker) { font-size:15px; line-height:1.5; color:#4C584F; margin-top:7px; }
.pi-page .pi-history-controls { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.pi-page .pi-source-filter { display:flex; flex-direction:column; gap:6px; }
.pi-page .pi-source-filter span { font-size:12px; color:var(--pi-forest); font-weight:750; }
.pi-page .pi-source-filter select { min-height:42px; min-width:190px; max-width:min(100%,300px); background:#fff; border:1px solid #ADBCAA; color:var(--pi-charcoal); border-radius:8px; padding:8px 12px; font-size:14px; }
.pi-page .pi-delete-history { min-height:42px; }
.pi-page .pi-history-ledger { padding:5px clamp(16px,2.4vw,36px) 25px; }
.pi-page .pi-transaction { border-bottom:1px solid #CBD3C8; padding:22px 0 24px; }
.pi-page .pi-transaction:last-child { border-bottom:0; }
.pi-page .pi-transaction-header { display:grid; grid-template-columns:42px minmax(140px,1fr) auto auto; gap:14px; align-items:center; }
.pi-page .pi-transaction-number { width:39px; height:39px; display:grid; place-items:center; background:#E7D3C9; border-radius:50%; color:#8A422C; font-size:15px; font-weight:750; }
.pi-page .pi-transaction-intro h3 { font-size:17px; font-weight:750; line-height:1.3; }
.pi-page .pi-transaction-intro p { color:#58615A; font-size:13px; margin-top:5px; }
.pi-page .pi-transaction-total { display:flex; flex-direction:column; gap:2px; color:#687069; }
.pi-page .pi-transaction-total span { font-size:12px; }
.pi-page .pi-transaction-total strong { font-size:20px; color:var(--pi-forest); font-weight:800; }
.pi-page .pi-purchase-items { margin:18px 0 0 55px; background:#FAFAF7; border:1px solid #E0E4DA; border-radius:10px; }
.pi-page .pi-purchase-item { padding:15px 17px; display:grid; grid-template-columns:minmax(150px,.9fr) minmax(270px,1.3fr) auto; gap:14px; align-items:center; border-bottom:1px solid #E1E6DB; }
.pi-page .pi-purchase-item:last-child { border-bottom:0; }
.pi-page .pi-item-info h4 { font-size:15px; line-height:1.35; font-weight:750; overflow-wrap:anywhere; }
.pi-page .pi-item-info p { margin-top:5px; color:#58615B; font-size:13px; line-height:1.5; }
.pi-page .pi-item-fields { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.pi-page .pi-item-fields label { min-width:0; display:flex; flex-direction:column; gap:5px; }
.pi-page .pi-item-fields label span { color:#536158; font-size:12px; font-weight:700; }
.pi-page .pi-item-fields input { border:1px solid #C9D0C6; background:#fff; color:var(--pi-charcoal); border-radius:8px; height:39px; width:100%; min-width:0; padding:9px 11px; font-size:13px; }
.pi-page .pi-item-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
.pi-page .pi-no-purchases { text-align:center; padding:50px 20px; display:flex; align-items:center; flex-direction:column; gap:10px; color:#546357; }
.pi-page .pi-no-purchases h3 { color:var(--pi-forest); font-size:20px; font-weight:750; }
.pi-page .pi-no-purchases p { font-size:14px; line-height:1.5; }
.pi-page .pi-privacy-footer { margin-top:18px; display:flex; align-items:center; gap:9px; color:#536257; font-size:13px; line-height:1.5; }
.pi-page .pi-privacy-footer svg { color:var(--pi-forest); flex:none; }
.pi-page .pi-household-required { min-height:340px; padding:38px; background:var(--pi-sage); border-left:5px solid var(--pi-clay); border-radius:14px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:14px; }
.pi-page .pi-household-required h1 { font-size:30px; font-weight:800; color:var(--pi-forest); }
.pi-page .pi-household-required p:not(.pi-eyebrow) { font-size:16px; line-height:1.6; max-width:610px; }
@media (max-width:1160px) { .pi-page .pi-source-row { grid-template-columns:1fr; gap:13px; } .pi-page .pi-source-actions { justify-content:flex-start; } .pi-page .pi-purchase-item { grid-template-columns:minmax(140px,.7fr) minmax(250px,1.3fr); } .pi-page .pi-item-actions { grid-column:1/-1; justify-content:flex-start; } }
@media (max-width:900px) { .pi-page .pi-hero { grid-template-columns:minmax(0,1fr) minmax(265px,.7fr); } .pi-page .pi-provider-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .pi-page .pi-journey-steps { grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 0; } .pi-page .pi-journey-step:nth-child(3) { border-left:0; padding-left:0; } .pi-page .pi-transaction-header { grid-template-columns:42px minmax(0,1fr) auto; } .pi-page .pi-transaction-toggle { grid-column:2/-1; justify-self:start; } }
@media (max-width:670px) { .pi-page { padding:12px 12px 28px; } .pi-page .pi-hero { grid-template-columns:1fr; border-radius:12px; } .pi-page .pi-hero-copy { padding:25px 20px; } .pi-page .pi-hero h1 { font-size:33px; } .pi-page .pi-hero-description { font-size:14px; margin-top:12px; } .pi-page .pi-hero-bottom { margin-top:18px; gap:12px; } .pi-page .pi-hero-aside { padding:20px; } .pi-page .pi-household-name { font-size:24px; margin:9px 0 15px; } .pi-page .pi-hero-stats { padding:10px 0; } .pi-page .pi-hero-stats strong { font-size:28px; } .pi-page .pi-hero-safety { font-size:12.5px; margin-top:11px; } .pi-page .pi-journey { padding:25px 2px; } .pi-page .pi-journey-heading { display:block; } .pi-page .pi-journey-heading p { margin-top:7px; font-size:13px; } .pi-page .pi-journey-steps { margin-top:18px; } .pi-page .pi-journey-step { padding:3px 13px; } .pi-page .pi-journey-step h3 { font-size:14px; } .pi-page .pi-journey-step p { font-size:12.5px; } .pi-page .pi-journey-number { font-size:19px; margin-bottom:8px; } .pi-page .pi-providers { margin-top:20px; padding:22px 16px; border-radius:12px; } .pi-page .pi-section-intro p:not(.pi-section-kicker) { font-size:13.5px; } .pi-page .pi-privacy-note { font-size:12.5px; } .pi-page .pi-provider-grid { margin-top:17px; gap:9px; } .pi-page .pi-provider { padding:13px; min-height:128px; } .pi-page .pi-provider-copy strong { font-size:15px; } .pi-page .pi-provider-copy small { font-size:12.5px; } .pi-page .pi-sources { margin-top:20px; padding:20px 16px; } .pi-page .pi-source-overview { padding:12px; gap:8px 14px; font-size:12.5px; } .pi-page .pi-source-overview strong { font-size:16px; } .pi-page .pi-source-row { padding:18px 0; } .pi-page .pi-source-heading h3 { font-size:16px; } .pi-page .pi-source-facts { font-size:12.5px; } .pi-page .pi-source-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .pi-page .pi-small-button { font-size:12.5px; white-space:normal; padding:8px 9px; } .pi-page .pi-history { margin-top:20px; border-radius:12px; } .pi-page .pi-history-header { padding:22px 16px; } .pi-page .pi-history-controls { width:100%; } .pi-page .pi-source-filter { flex:1; min-width:0; } .pi-page .pi-source-filter select { width:100%; min-width:0; } .pi-page .pi-history-ledger { padding:0 14px 20px; } .pi-page .pi-transaction-header { grid-template-columns:32px minmax(0,1fr); gap:9px; } .pi-page .pi-transaction-number { width:29px; height:29px; font-size:12.5px; } .pi-page .pi-transaction-intro h3 { font-size:15px; } .pi-page .pi-transaction-total { grid-column:2; } .pi-page .pi-transaction-total strong { font-size:18px; } .pi-page .pi-transaction-toggle { grid-column:2; } .pi-page .pi-purchase-items { margin:14px 0 0; } .pi-page .pi-purchase-item { grid-template-columns:1fr; gap:12px; padding:14px; } .pi-page .pi-item-fields { grid-template-columns:1fr; } .pi-page .pi-item-actions { grid-column:1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .pi-page .pi-privacy-footer { font-size:12.5px; } .pi-page .pi-household-required { padding:26px 18px; } }
/* Connected Purchases mobile-only: compact but breathable; desktop rules above untouched. */
.pi-page .pi-mobile-copy { display:none; }
@media (max-width:670px) {
  .pi-page { width:100%; max-width:none; min-width:0; padding:5px 5px 26px; overflow-x:clip; }
  .pi-page .pi-mobile-copy { display:inline; }
  .pi-page .pi-desktop-copy { display:none; }
  .pi-page .pi-hero { min-height:0; border-radius:10px; }
  .pi-page .pi-hero-copy { padding:18px 15px 16px; }
  .pi-page .pi-hero h1 { margin-top:7px; font-size:clamp(29px,8vw,34px); line-height:1.09; letter-spacing:-.045em; }
  .pi-page .pi-hero-description { margin-top:9px; font-size:13.5px; line-height:1.4; }
  .pi-page .pi-eyebrow, .pi-page .pi-section-kicker { font-size:11px; letter-spacing:.07em; }
  .pi-page .pi-hero-bottom { display:grid; grid-template-columns:minmax(0,1.08fr) minmax(0,1fr); gap:8px; width:100%; margin-top:14px; }
  .pi-page .pi-hero-bottom a { min-width:0; text-align:center; font-size:12px; }
  .pi-page .pi-hero-bottom .pi-button { min-height:40px; padding:7px 8px; }
  .pi-page .pi-hero-secondary { display:flex; justify-content:center; align-items:center; padding:7px 6px; min-height:40px; border:1px solid rgba(23,63,53,.27); border-radius:8px; text-decoration:none; }
  .pi-page .pi-hero-aside { padding:13px 15px; display:grid; grid-template-columns:minmax(0,1fr) minmax(114px,.95fr); gap:5px 10px; align-items:center; }
  .pi-page .pi-household-label { grid-column:1; font-size:10.5px; letter-spacing:.035em; gap:6px; }
  .pi-page .pi-household-label svg { width:14px; height:14px; }
  .pi-page .pi-household-name { grid-column:1; min-width:0; font-size:17px; line-height:1.2; margin:3px 0 0; }
  .pi-page .pi-hero-stats { grid-column:2; grid-row:1 / span 2; gap:9px; padding:5px 0 5px 10px; border-top:0; border-bottom:0; border-left:1px solid rgba(255,255,255,.28); }
  .pi-page .pi-hero-stats strong { font-size:23px; }
  .pi-page .pi-hero-stats span { font-size:10.5px; line-height:1.2; }
  .pi-page .pi-hero-safety { grid-column:1 / -1; margin-top:7px; padding-top:9px; border-top:1px solid rgba(255,255,255,.18); font-size:11px; line-height:1.35; }
  .pi-page .pi-hero-safety svg { width:14px; height:14px; }
  .pi-page .pi-journey { padding:17px 7px 18px; }
  .pi-page h2 { font-size:clamp(20px,5.8vw,24px); line-height:1.18; }
  .pi-page .pi-journey-heading { margin-top:4px; }
  .pi-page .pi-journey-heading p, .pi-page .pi-journey-step p { display:none; }
  .pi-page .pi-journey-steps { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:12px; }
  .pi-page .pi-journey-step, .pi-page .pi-journey-step:first-child, .pi-page .pi-journey-step:nth-child(3) { display:flex; align-items:center; gap:8px; padding:10px 8px; min-width:0; border:0; border-radius:8px; background:rgba(215,221,207,.48); }
  .pi-page .pi-journey-number { font-size:17px; margin-bottom:0; flex-shrink:0; }
  .pi-page .pi-journey-step h3 { font-size:12.5px; line-height:1.28; overflow-wrap:anywhere; }
  .pi-page .pi-providers { margin-top:18px; padding:16px 12px 17px; border-radius:9px; }
  .pi-page .pi-section-intro { gap:9px; }
  .pi-page .pi-section-intro h2 { margin-top:4px; }
  .pi-page .pi-providers .pi-section-intro p:not(.pi-section-kicker),
  .pi-page .pi-sources .pi-section-intro p:not(.pi-section-kicker),
  .pi-page .pi-history-header p:not(.pi-section-kicker) { display:none; }
  .pi-page .pi-privacy-note { max-width:none; font-size:11.5px; line-height:1.4; }
  .pi-page .pi-privacy-note svg { width:15px; height:15px; }
  .pi-page .pi-provider-grid { margin-top:13px; gap:8px; }
  .pi-page .pi-provider { min-width:0; min-height:0; gap:8px; padding:11px 10px; border-radius:9px; }
  .pi-page .pi-provider-icon { width:32px; height:32px; border-radius:7px; }
  .pi-page .pi-provider-icon svg { width:19px; height:19px; }
  .pi-page .pi-provider-copy strong { font-size:14px; }
  .pi-page .pi-provider-copy small { font-size:11.5px; line-height:1.35; }
  .pi-page .pi-provider-action { right:9px; top:9px; }
  .pi-page .pi-sources { margin-top:18px; padding:16px 12px 14px; border-radius:9px; }
  .pi-page .pi-sources-intro { display:flex; flex-wrap:nowrap; align-items:center; justify-content:space-between; }
  .pi-page .pi-sources-intro > div { min-width:0; }
  .pi-page .pi-sources-intro .pi-button { min-height:38px; padding:7px 10px; font-size:12px; flex:none; }
  .pi-page .pi-source-overview { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:12px; padding:10px 8px; font-size:11px; line-height:1.35; }
  .pi-page .pi-source-overview span { min-width:0; overflow-wrap:anywhere; }
  .pi-page .pi-source-overview strong { font-size:16px; display:block; margin:0 0 2px; }
  .pi-page .pi-source-list { margin-top:3px; }
  .pi-page .pi-source-row { gap:10px; padding:13px 0 14px; }
  .pi-page .pi-source-heading { gap:7px; }
  .pi-page .pi-source-heading h3 { font-size:15px; }
  .pi-page .pi-source-facts { margin-top:6px; gap:5px 13px; font-size:12px; }
  .pi-page .pi-source-actions { gap:7px; }
  .pi-page .pi-small-button { min-height:39px; font-size:12px; line-height:1.25; padding:7px 8px; overflow-wrap:anywhere; }
  .pi-page .pi-history { margin-top:18px; border-radius:9px; }
  .pi-page .pi-history-header { padding:15px 12px; gap:11px; }
  .pi-page .pi-history-header h2 { margin-top:4px; }
  .pi-page .pi-history-controls { gap:8px; align-items:end; }
  .pi-page .pi-source-filter { gap:4px; }
  .pi-page .pi-source-filter span { font-size:11px; }
  .pi-page .pi-source-filter select { min-height:40px; font-size:13px; }
  .pi-page .pi-history-ledger { padding:0 12px 14px; }
  .pi-page .pi-transaction { padding:14px 0 15px; }
  .pi-page .pi-transaction-header { grid-template-columns:29px minmax(0,1fr) auto; gap:8px; align-items:center; }
  .pi-page .pi-transaction-number { width:28px; height:28px; font-size:12px; }
  .pi-page .pi-transaction-intro { min-width:0; }
  .pi-page .pi-transaction-intro h3 { font-size:14px; overflow-wrap:anywhere; }
  .pi-page .pi-transaction-intro p { margin-top:3px; font-size:11.5px; }
  .pi-page .pi-transaction-total { grid-column:3; grid-row:1; min-width:0; text-align:right; }
  .pi-page .pi-transaction-total span { font-size:10.5px; }
  .pi-page .pi-transaction-total strong { font-size:15px; overflow-wrap:anywhere; }
  .pi-page .pi-transaction-toggle { grid-column:2 / -1; justify-self:start; min-height:34px; }
  .pi-page .pi-purchase-items { margin:11px 0 0; border-radius:8px; }
  .pi-page .pi-purchase-item { padding:12px 10px; gap:10px; }
  .pi-page .pi-item-info h4 { font-size:14px; }
  .pi-page .pi-item-info p { font-size:11.5px; margin-top:3px; }
  .pi-page .pi-item-fields { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
  .pi-page .pi-item-fields label span { font-size:11.5px; }
  .pi-page .pi-item-fields input { height:39px; padding:7px 8px; font-size:12px; }
  .pi-page .pi-item-actions { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
  .pi-page .pi-muted-state { padding:17px 6px; font-size:13px; }
  .pi-page .pi-empty-source { padding:16px 3px; }
  .pi-page .pi-no-purchases { padding:28px 12px; }
  .pi-page .pi-no-purchases p { font-size:12.5px; }
  .pi-page .pi-privacy-footer { margin-top:15px; padding:0 5px; font-size:11.5px; line-height:1.4; }
  .pi-page .pi-household-required { min-height:0; padding:23px 16px; gap:10px; }
  .pi-page .pi-household-required h1 { font-size:25px; }
}
@media (max-width:359px) {
  .pi-page .pi-hero-aside { grid-template-columns:minmax(0,1fr) minmax(104px,.88fr); }
  .pi-page .pi-item-fields { grid-template-columns:1fr; }
  .pi-page .pi-transaction-header { grid-template-columns:28px minmax(0,1fr); }
  .pi-page .pi-transaction-total { grid-column:2; grid-row:auto; text-align:left; }
}
@media (prefers-reduced-motion:reduce) { .pi-page *, .pi-page *::before,.pi-page *::after { scroll-behavior:auto!important; transition:none!important; } }
`;
