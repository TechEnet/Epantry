import {
  BarChart3,
  BellRing,
  Beaker,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
} from "lucide-react";

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

const experimentStatusLabel = {
  draft: "Draft",
  active: "Running",
  paused: "Paused",
  ended: "Finished",
};

const journeyTones = [
  {
    shell: "bg-[#e4f1e9]",
    icon: "bg-[#0f5a43] text-white",
    number: "text-[#17674e]",
  },
  {
    shell: "bg-[#eef3f4]",
    icon: "bg-white text-[#2d6571]",
    number: "text-[#667d84]",
  },
  {
    shell: "bg-[#e4f1e9]",
    icon: "bg-[#0f5a43] text-white",
    number: "text-[#17674e]",
  },
  {
    shell: "bg-[#eef1f2]",
    icon: "bg-white text-[#52636a]",
    number: "text-[#768187]",
  },
];

function pct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function scrollToSection(id) {
  if (typeof document === "undefined") return;

  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function JourneyStep({ step, index }) {
  const Icon = step.icon;
  const tone = journeyTones[index % journeyTones.length];

  return (
    <button
      type="button"
      onClick={() => scrollToSection(step.target)}
      className={`focus-ring group min-w-0 p-4 text-left transition hover:-translate-y-0.5 sm:p-5 lg:p-6 ${tone.shell}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone.icon}`}
        >
          <Icon size={15} aria-hidden="true" />
        </span>

        <span
          className={`text-[10px] font-black tracking-[0.16em] sm:text-[11px] ${tone.number}`}
        >
          {step.number}
        </span>
      </div>

      <h3 className="mt-5 text-[16px] font-black leading-[1.15] tracking-[-0.02em] text-stone-950 sm:text-[17px]">
        {step.title}
      </h3>

      <p className="mt-2 text-[13px] font-semibold leading-[1.55] text-stone-600 sm:text-[14px]">
        {step.description}
      </p>
    </button>
  );
}

function ActivityMetric({ label, value, icon: Icon, borderClass = "" }) {
  return (
    <div
      className={`min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:px-6 ${borderClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#245f49] sm:text-[12px]">
          {label}
        </p>
        <Icon size={16} className="shrink-0 text-[#3b7d62]" aria-hidden="true" />
      </div>
      <p className="mt-4 text-[30px] font-black leading-none tracking-[-0.045em] text-stone-950 sm:text-[36px]">
        {value ?? 0}
      </p>
    </div>
  );
}

function QualitySignal({ icon: Icon, eyebrow, title, value, description, tone }) {
  const tones = {
    green: {
      shell: "bg-[#dcefe5]",
      icon: "bg-[#0f5a43] text-white",
      eyebrow: "text-[#216248]",
    },
    blue: {
      shell: "bg-[#e7eff3]",
      icon: "bg-white text-[#1c6488]",
      eyebrow: "text-[#557685]",
    },
    lavender: {
      shell: "bg-[#efedf4]",
      icon: "bg-white text-[#68458d]",
      eyebrow: "text-[#746985]",
    },
  };

  const style = tones[tone] || tones.green;

  return (
    <div className={`min-w-0 p-5 sm:p-6 ${style.shell}`}>
      <div className="flex items-start gap-3.5">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${style.icon}`}
        >
          <Icon size={17} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.14em] sm:text-[11px] ${style.eyebrow}`}
          >
            {eyebrow}
          </p>
          <h3 className="mt-1 text-[16px] font-black leading-tight text-stone-950 sm:text-[17px]">
            {title}
          </h3>
        </div>
      </div>

      <p className="mt-6 text-[34px] font-black leading-none tracking-[-0.05em] text-stone-950 sm:text-[42px]">
        {value}
      </p>
      <p className="mt-2 max-w-[340px] text-[13px] font-semibold leading-[1.55] text-stone-600 sm:text-[14px]">
        {description}
      </p>
    </div>
  );
}

function FormField({ label, children, className = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[12px]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "focus-ring h-11 w-full min-w-0 rounded-[12px] border border-[#ceded7] bg-white px-3.5 text-[14px] font-semibold text-stone-800 placeholder:text-stone-400 sm:h-12 sm:px-4 sm:text-[15px]";

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
          "We could not load analytics right now. Please try again."
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

  const steps = [
    {
      number: "01",
      title: "Check customer activity",
      description: "See searches, recipe choices, baskets and orders.",
      icon: BarChart3,
      target: "activity-overview",
    },
    {
      number: "02",
      title: "Find friction",
      description:
        "Spot weak conversion, poor search results or low notification value.",
      icon: Search,
      target: "quality-overview",
    },
    {
      number: "03",
      title: "Run a safe test",
      description: isRootSuperAdmin
        ? "Create a controlled test only when a clear improvement needs proof."
        : "Review controlled tests created by authorized Super Admins.",
      icon: Beaker,
      target: isRootSuperAdmin ? "create-experiment" : "experiments",
    },
    {
      number: "04",
      title: "Review the result",
      description: "Keep, pause or finish a test based on measured customer value.",
      icon: TrendingUp,
      target: "experiments",
    },
  ];

  return (
    <AdminShell
      flushTop
      title="Analytics & Experiments"
      description="Understand how customers move through EPANTRY, find friction, and test improvements without weakening safety or access controls."
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[13px] font-black text-stone-700 shadow-sm disabled:opacity-50 sm:h-10 sm:px-4 sm:text-[14px]"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold leading-5 text-red-800 sm:text-[14px]">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold leading-5 text-emerald-800 sm:text-[14px]">
          {notice}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-[#d8d5cd] bg-[#f5f4ef] sm:rounded-[28px]">
        <header className="grid gap-7 bg-[#0f5a43] px-5 py-6 text-white sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end lg:px-8 lg:py-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c9f0df] sm:text-[11px]">
              Analytics journey
            </p>
            <h2 className="mt-3 max-w-[680px] text-[28px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[36px] lg:text-[40px]">
              Read the journey, find the problem, then test the fix.
            </h2>
          </div>

          <p className="max-w-[420px] text-[13px] font-semibold leading-[1.7] text-white/72 sm:text-[14px]">
            Start with customer movement, isolate the weak signal, test one bounded change, then keep only what creates measurable value.
          </p>
        </header>

        <div className="grid divide-y divide-[#d8d5cd] lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {steps.map((step, index) => (
            <JourneyStep key={step.number} step={step} index={index} />
          ))}
        </div>
      </section>

      <section
        id="activity-overview"
        className="mt-6 scroll-mt-24 overflow-hidden rounded-[24px] border border-[#b7d7c8] bg-[#e5f2eb] sm:mt-8 sm:rounded-[28px]"
      >
        <div className="grid lg:grid-cols-[285px_minmax(0,1fr)]">
          <header className="bg-[#146449] p-5 text-white sm:p-7 lg:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/72 sm:text-[11px]">
              Customer movement
            </p>
            <h2 className="mt-6 max-w-[220px] text-[26px] font-black leading-[1.04] tracking-[-0.035em] sm:text-[30px]">
              See where customers move — and where they stop.
            </h2>
            <p className="mt-4 max-w-[225px] text-[13px] font-semibold leading-[1.65] text-white/74 sm:text-[14px]">
              Core journey counts stay together so the path from discovery to order is easy to scan.
            </p>
            <div className="mt-7 h-px w-14 bg-white/35" />
          </header>

          <div className="min-w-0">
            <div className="grid grid-cols-2 border-b border-[#b7d7c8] lg:grid-cols-4">
              <ActivityMetric
                label="Searches"
                value={funnel.counts?.search || 0}
                icon={Search}
              />
              <ActivityMetric
                label="Recipe choices"
                value={funnel.counts?.recipe || 0}
                icon={Sparkles}
                borderClass="border-l border-[#b7d7c8]"
              />
              <ActivityMetric
                label="Baskets"
                value={funnel.counts?.basket || 0}
                icon={ShoppingBasket}
                borderClass="border-t border-[#b7d7c8] lg:border-l lg:border-t-0"
              />
              <ActivityMetric
                label="Orders"
                value={funnel.counts?.orders || 0}
                icon={CheckCircle2}
                borderClass="border-l border-t border-[#b7d7c8] lg:border-t-0"
              />
            </div>

            <div id="quality-overview" className="scroll-mt-24">
              <div className="grid md:grid-cols-3">
                <QualitySignal
                  icon={BarChart3}
                  eyebrow="Journey progress"
                  title="Recipe → needs"
                  value={pct(funnel.rates?.recipeToRequirements)}
                  description={`Needs → basket is ${pct(
                    funnel.rates?.requirementsToBasket
                  )}. These two rates show where customers continue.`}
                  tone="green"
                />

                <QualitySignal
                  icon={Search}
                  eyebrow="Search quality"
                  title="Search success"
                  value={pct(
                    1 - Number(dashboard?.searchQuality?.zeroResultRate || 0)
                  )}
                  description="Searches that returned something useful."
                  tone="blue"
                />

                <QualitySignal
                  icon={BellRing}
                  eyebrow="Notification utility"
                  title="Useful notifications"
                  value={pct(dashboard?.notificationUtility?.actionRate)}
                  description="Notifications that led to a useful customer action."
                  tone="lavender"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#244b40] bg-[#173f35] text-white sm:mt-8 sm:rounded-[24px]">
        <div className="flex items-start gap-3.5 px-5 py-4 sm:px-6 sm:py-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[#9ce2c4]">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-black sm:text-[16px]">Safety stays fixed</h2>
            <p className="mt-1 max-w-4xl text-[13px] font-semibold leading-[1.6] text-white/68 sm:text-[14px]">
              Tests may improve presentation or workflow, but they can never weaken food safety, sign-in, payment, privacy or access protections.
            </p>
          </div>
        </div>
      </section>

      {isRootSuperAdmin ? (
        <section
          id="create-experiment"
          className="mt-6 scroll-mt-24 overflow-hidden rounded-[24px] border border-[#b7d2e5] bg-[#e7f2f9] sm:mt-8 sm:rounded-[28px]"
        >
          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <header className="bg-[#1b587c] p-5 text-white sm:p-7 lg:p-8">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/12 text-[#d7edfa]">
                <Beaker size={18} aria-hidden="true" />
              </span>
              <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-white/70 sm:text-[11px]">
                Controlled testing
              </p>
              <h2 className="mt-3 max-w-[225px] text-[26px] font-black leading-[1.04] tracking-[-0.035em] sm:text-[30px]">
                Create a safe experiment.
              </h2>
              <p className="mt-4 max-w-[230px] text-[13px] font-semibold leading-[1.65] text-white/74 sm:text-[14px]">
                Use this only when you have a clear question and a measurable customer outcome.
              </p>
            </header>

            <div className="min-w-0 p-4 sm:p-6 lg:p-7">
              <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
                <FormField label="Test ID">
                  <input
                    className={inputClassName}
                    placeholder="checkout-layout-test"
                    value={form.experimentKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        experimentKey: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Test name">
                  <input
                    className={inputClassName}
                    placeholder="Short, readable name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Where it runs">
                  <input
                    className={inputClassName}
                    placeholder="checkout, search, recipe..."
                    value={form.surfaceKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        surfaceKey: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Feature control key">
                  <input
                    className={inputClassName}
                    placeholder="Feature flag key"
                    value={form.featureFlagKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        featureFlagKey: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField label="What are you testing?">
                  <select
                    className={inputClassName}
                    value={form.surfaceType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        surfaceType: event.target.value,
                      }))
                    }
                  >
                    <option value="presentation">Page presentation</option>
                    <option value="workflow_effort">Workflow effort</option>
                    <option value="notification_utility">
                      Notification usefulness
                    </option>
                    <option value="recommendation_utility">
                      Recommendation usefulness
                    </option>
                  </select>
                </FormField>

                <FormField label="Success measure">
                  <input
                    className={inputClassName}
                    placeholder="Metric used to judge success"
                    value={form.primaryUtilityMetricKey}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        primaryUtilityMetricKey: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField
                  label="What should this improve?"
                  className="md:col-span-2"
                >
                  <textarea
                    className="focus-ring min-h-[110px] w-full rounded-[12px] border border-[#ceded7] bg-white px-3.5 py-3 text-[14px] font-semibold leading-6 text-stone-800 placeholder:text-stone-400 sm:min-h-[125px] sm:px-4 sm:text-[15px]"
                    placeholder="Explain the customer problem and the improvement you expect."
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>

              <div className="mt-5 flex justify-end">
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
                      "Experiment created as a draft."
                    )
                  }
                  className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-[#174f3f] px-5 text-[14px] font-black text-white transition hover:bg-[#103f32] disabled:opacity-50 sm:h-12 sm:w-auto sm:px-6 sm:text-[15px]"
                >
                  Save test as draft
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="experiments"
        className="mt-6 scroll-mt-24 overflow-hidden rounded-[24px] border border-[#cfc1e3] bg-[#efe9f8] sm:mt-8 sm:rounded-[28px]"
      >
        <div className="grid lg:grid-cols-[285px_minmax(0,1fr)]">
          <header className="bg-[#60457f] p-5 text-white sm:p-7 lg:p-8">
            <div className="flex items-center justify-between gap-3 lg:block">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70 sm:text-[11px]">
                  Experiments
                </p>
                <h2 className="mt-3 max-w-[215px] text-[26px] font-black leading-[1.04] tracking-[-0.035em] sm:text-[30px]">
                  Review controlled tests.
                </h2>
              </div>

              <span className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-black text-white/80 lg:mt-6 lg:inline-flex">
                {experiments.length} total
              </span>
            </div>

            <p className="mt-4 max-w-[220px] text-[13px] font-semibold leading-[1.65] text-white/72 sm:text-[14px]">
              Start, pause or finish a test only after reviewing the measured customer value.
            </p>
          </header>

          <div className="min-w-0 px-4 sm:px-6 lg:px-7">
            {experiments.length ? (
              <div className="divide-y divide-[#cfc1e3]">
                {experiments.map((experiment) => (
                  <div
                    key={experiment.id}
                    className="grid gap-4 py-5 sm:py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="min-w-0 truncate text-[16px] font-black text-stone-950 sm:text-[17px]">
                          {experiment.name}
                        </h3>

                        <span className="rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#60457f] ring-1 ring-[#cdbfdf]">
                          {experimentStatusLabel[experiment.status] ||
                            experiment.status}
                        </span>
                      </div>

                      <p className="mt-2 text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13px]">
                        {experiment.experimentKey} · version {experiment.versionNumber}
                      </p>
                      <p className="mt-1 break-words text-[12px] font-semibold leading-5 text-stone-600 sm:text-[13px]">
                        Success measure: {experiment.primaryUtilityMetricKey}
                      </p>
                    </div>

                    {isRootSuperAdmin ? (
                      <div className="flex flex-wrap gap-2 lg:justify-end">
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
                            className="focus-ring rounded-[10px] border border-[#91bba8] bg-[#e5f2eb] px-3.5 py-2 text-[12px] font-black text-[#174f3f] disabled:opacity-50 sm:text-[13px]"
                          >
                            Start
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
                            className="focus-ring rounded-[10px] border border-[#d9bd82] bg-[#fff3d7] px-3.5 py-2 text-[12px] font-black text-[#79521b] disabled:opacity-50 sm:text-[13px]"
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
                            className="focus-ring rounded-[10px] border border-stone-300 bg-white/70 px-3.5 py-2 text-[12px] font-black text-stone-700 disabled:opacity-50 sm:text-[13px]"
                          >
                            Finish
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[170px] items-center justify-center px-4 py-8 text-center">
                <div>
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-white/65 text-[#8065a0]">
                    <Beaker size={19} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-[15px] font-black text-stone-800 sm:text-[16px]">
                    No experiments yet
                  </p>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-stone-500 sm:text-[14px]">
                    Create one only when there is a clear customer problem to test.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
