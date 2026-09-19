import { BarChart3, Beaker, RefreshCw, ShieldCheck } from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import AdminShell from "../../admin/components/AdminShell";

import { useAdmin } from "../../admin/context/AdminContext";

import {
  changeExperimentStatus,
  createExperimentDefinition,
  getAdminAnalyticsDashboard,
  getAnalyticsErrorMessage,
  listExperimentDefinitions,
} from "../services/analytics.service";

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-stone-950">{value ?? 0}</p>
    </div>
  );
}

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export default function AdminAnalyticsPage() {
  const { isRootSuperAdmin } = useAdmin();

  const [dashboard, setDashboard] = useState(null);

  const [experiments, setExperiments] = useState([]);

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    experimentKey: "",
    name: "",
    description: "",
    surfaceType: "workflow_effort",
    surfaceKey: "",
    featureFlagKey: "",
    primaryUtilityMetricKey: "workflow.effort_reduction_rate",
    reason: "Experiment created for bounded utility measurement.",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        getAdminAnalyticsDashboard(),
        listExperimentDefinitions(),
      ]);

      if (results[0].status === "rejected") {
        throw results[0].reason;
      }

      setDashboard(results[0].value);

      setExperiments(
        results[1].status === "fulfilled"
          ? results[1].value?.experiments || []
          : []
      );
    } catch (requestError) {
      setError(
        getAnalyticsErrorMessage(
          requestError,
          "Unable to load administrative analytics."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action, message) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();

      setNotice(message);

      await load();
    } catch (requestError) {
      setError(getAnalyticsErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  const funnel = dashboard?.funnel || {
    counts: {},
    rates: {},
  };

  return (
    <AdminShell
      title="Analytics & Experiments"
      description="Permission-filtered EPANTRY launch metrics, attribution, notification utility and bounded experiments. Metrics derive from server-side events; AI is never metric authority."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-700 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Searches" value={funnel.counts?.search || 0} />

        <Metric label="Recipe selections" value={funnel.counts?.recipe || 0} />

        <Metric label="Baskets" value={funnel.counts?.basket || 0} />

        <Metric label="Orders" value={funnel.counts?.orders || 0} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-emerald-700" />

            <h2 className="font-black">Core funnel</h2>
          </div>

          <p className="mt-4 text-sm text-stone-500">Recipe → requirements</p>

          <p className="text-2xl font-black">
            {pct(funnel.rates?.recipeToRequirements)}
          </p>

          <p className="mt-4 text-sm text-stone-500">Requirements → basket</p>

          <p className="text-2xl font-black">
            {pct(funnel.rates?.requirementsToBasket)}
          </p>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-black">Search quality</h2>

          <p className="mt-4 text-3xl font-black">
            {pct(dashboard?.searchQuality?.zeroResultRate)}
          </p>

          <p className="mt-1 text-xs text-stone-500">Zero-result rate</p>
        </section>

        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="font-black">Notification utility</h2>

          <p className="mt-4 text-3xl font-black">
            {pct(dashboard?.notificationUtility?.actionRate)}
          </p>

          <p className="mt-1 text-xs text-stone-500">
            Useful action rate — not click rate alone.
          </p>
        </section>
      </div>

      <section className="mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={18} />

          <div>
            <h2 className="font-black">Experiment safety boundary</h2>

            <p className="mt-2 text-sm leading-6 text-stone-400">
              Experiments cannot weaken allergen uncertainty, authorization,
              MFA, payment verification, tenant isolation or regulatory safety.
              Feature flags and assignments never grant access.
            </p>
          </div>
        </div>
      </section>

      {isRootSuperAdmin ? (
        <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Beaker size={18} className="text-emerald-700" />

            <h2 className="font-black">Create bounded experiment</h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              placeholder="experiment_key"
              value={form.experimentKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  experimentKey: event.target.value,
                }))
              }
            />

            <input
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              placeholder="Experiment name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />

            <input
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              placeholder="Surface key"
              value={form.surfaceKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  surfaceKey: event.target.value,
                }))
              }
            />

            <input
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              placeholder="M17 feature flag key"
              value={form.featureFlagKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  featureFlagKey: event.target.value,
                }))
              }
            />

            <select
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              value={form.surfaceType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  surfaceType: event.target.value,
                }))
              }
            >
              <option value="presentation">Presentation</option>
              <option value="workflow_effort">Workflow effort</option>
              <option value="notification_utility">Notification utility</option>
              <option value="recommendation_utility">
                Recommendation utility
              </option>
            </select>

            <input
              className="focus-ring rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold"
              placeholder="Primary utility metric"
              value={form.primaryUtilityMetricKey}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  primaryUtilityMetricKey: event.target.value,
                }))
              }
            />

            <textarea
              className="focus-ring min-h-24 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-semibold sm:col-span-2"
              placeholder="Description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !form.experimentKey.trim() ||
              !form.name.trim() ||
              !form.description.trim() ||
              !form.featureFlagKey.trim()
            }
            onClick={() =>
              run(
                () =>
                  createExperimentDefinition({
                    experimentKey: form.experimentKey.trim(),
                    name: form.name.trim(),
                    description: form.description.trim(),
                    surfaceType: form.surfaceType,
                    surfaceKey:
                      form.surfaceKey.trim() || form.experimentKey.trim(),
                    featureFlagKey: form.featureFlagKey.trim(),
                    eligibleActorTypes: ["customer", "host"],
                    allocationBasisPoints: 10000,
                    variants: [
                      {
                        key: "control",
                        label: "Control",
                        weightBasisPoints: 5000,
                        isControl: true,
                      },
                      {
                        key: "treatment",
                        label: "Treatment",
                        weightBasisPoints: 5000,
                        isControl: false,
                      },
                    ],
                    primaryUtilityMetricKey:
                      form.primaryUtilityMetricKey.trim(),
                    guardrailMetricKeys: ["trust.correction_rate"],
                    holdoutRequired: true,
                    reason: form.reason,
                  }),
                "Experiment Definition created as draft."
              )
            }
            className="focus-ring mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
          >
            Create draft
          </button>
        </section>
      ) : null}

      <section className="mt-5 rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="font-black">Experiments</h2>

        <div className="mt-4 space-y-3">
          {experiments.map((experiment) => (
            <div
              key={experiment.id}
              className="rounded-2xl border border-stone-200 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-black">{experiment.name}</p>

                  <p className="mt-1 text-xs text-stone-500">
                    {experiment.experimentKey} · v{experiment.versionNumber} ·{" "}
                    {experiment.status}
                  </p>

                  <p className="mt-1 text-xs text-stone-500">
                    Primary utility: {experiment.primaryUtilityMetricKey}
                  </p>
                </div>

                {isRootSuperAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    {["draft", "paused"].includes(experiment.status) ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              changeExperimentStatus(
                                experiment.id,
                                "activate",
                                "Root Super Admin activated bounded experiment after feature-flag review."
                              ),
                            "Experiment activated."
                          )
                        }
                        className="focus-ring rounded-lg border border-stone-200 px-3 py-2 text-xs font-black"
                      >
                        Activate
                      </button>
                    ) : null}

                    {experiment.status === "active" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              changeExperimentStatus(
                                experiment.id,
                                "pause",
                                "Experiment paused for operational review."
                              ),
                            "Experiment paused."
                          )
                        }
                        className="focus-ring rounded-lg border border-stone-200 px-3 py-2 text-xs font-black"
                      >
                        Pause
                      </button>
                    ) : null}

                    {experiment.status !== "ended" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              changeExperimentStatus(
                                experiment.id,
                                "end",
                                "Experiment ended; assignments remain historical."
                              ),
                            "Experiment ended."
                          )
                        }
                        className="focus-ring rounded-lg border border-stone-200 px-3 py-2 text-xs font-black"
                      >
                        End
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
