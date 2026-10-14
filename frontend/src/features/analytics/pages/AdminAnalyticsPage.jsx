import {
  BarChart3,
  BellRing,
  Beaker,
  CheckCircle2,
  Clock3,
  MapPinned,
  RefreshCw,
  Search,
  ShoppingBasket,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import AdminShell from "../../admin/components/AdminShell";
import { useAdmin } from "../../admin/context/AdminContext";
import {
  getAdminSearchDemand,
  getAdminGovernanceErrorMessage,
} from "../../adminGovernance/services/adminGovernance.service";
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

function searchArea(row) {
  const parts = [row?.city, row?.state, row?.postcode].filter(Boolean);
  return parts.length ? parts.join(", ") : "Area not available";
}

function searchTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const sectionPalettes = {
  activity: {
    header: "bg-[#e8f3eb] border-[#cbded0]",
    number: "bg-[#185a42] text-white",
    heading: "text-[#174632]",
    border: "border-[#cbdfd2]",
  },
  demand: {
    header: "bg-[#e7f2f7] border-[#cbdde7]",
    number: "bg-[#205675] text-white",
    heading: "text-[#214e68]",
    border: "border-[#cbdee7]",
  },
  test: {
    header: "bg-[#f9efe1] border-[#e9d8be]",
    number: "bg-[#936024] text-white",
    heading: "text-[#68441e]",
    border: "border-[#e8d9c3]",
  },
  manage: {
    header: "bg-[#f0ecf6] border-[#ddd4eb]",
    number: "bg-[#614d7b] text-white",
    heading: "text-[#4b385f]",
    border: "border-[#ddd4eb]",
  },
};

function SectionBlock({ id, number, title, description, children, actions = null, tone = "activity" }) {
  const palette = sectionPalettes[tone];
  return (
    <section id={id} className={`scroll-mt-24 min-w-0 overflow-hidden rounded-[22px] border ${palette.border} bg-white shadow-[0_8px_26px_rgba(26,48,35,0.05)]`}>
      <div className={`flex min-w-0 flex-col gap-3 border-b px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7 ${palette.header}`}>
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-[16px] font-black tabular-nums sm:h-11 sm:w-11 sm:text-[17px] ${palette.number}`}>
            {number}
          </span>
          <div className="min-w-0">
            <h2 className={`break-normal text-[20px] font-black leading-tight tracking-[-0.025em] sm:text-[27px] ${palette.heading}`}>
              {title}
            </h2>
            {description ? <p className="mt-1 max-w-3xl text-[14px] leading-6 text-stone-600 sm:text-[15px]">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="min-w-0 shrink-0 sm:pl-14 lg:pl-0">{actions}</div> : null}
      </div>
      <div className="min-w-0 p-3 sm:p-5 lg:p-6">{children}</div>
    </section>
  );
}

function JourneyCard({ step }) {
  const Icon = step.icon;
  return (
    <button type="button" onClick={() => scrollToSection(step.target)}
      className="focus-ring group flex min-w-0 items-start gap-3 border-b border-[#d9e6de] px-3 py-4 text-left transition-colors hover:bg-[#e0f0e6] focus-visible:bg-[#e0f0e6] max-sm:flex-col max-sm:gap-2 max-sm:rounded-[14px] max-sm:border max-sm:border-[#c9ddcf] max-sm:bg-white max-sm:p-3 sm:px-4 last:border-b-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-[#195c43] ring-1 ring-[#c8ddd0] max-sm:h-9 max-sm:w-9 max-sm:bg-[#e9f4ec]">
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold tracking-wide text-[#42725c] max-sm:text-[12px]">STEP {step.number}</span>
        <span className="mt-0.5 block text-[16px] font-extrabold leading-snug text-[#193f30] sm:text-[17px]">{step.title}</span>
        <span className="mt-1 block break-normal text-[13px] leading-5 text-[#4d6457] sm:text-[14px]">{step.description}</span>
      </span>
      <span className="mt-2 text-[#2c7756] transition-transform group-hover:translate-x-1 max-sm:hidden" aria-hidden="true">&rarr;</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 border-b border-[#dae7dc] p-3 sm:border-b-0 sm:border-r sm:p-5 last:border-r-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-[15px] font-bold text-[#315d46]">{label}</p>
        <Icon size={18} className="shrink-0 text-[#317553]" aria-hidden="true" />
      </div>
      <p className="mt-2 break-words text-[28px] font-black leading-tight tabular-nums text-[#173c2d] sm:mt-3 sm:text-[38px]">{value ?? 0}</p>
    </div>
  );
}

function SignalCard({ title, value, description, icon: Icon }) {
  return (
    <div className="min-w-0 border-b border-[#e1e8e4] px-3 py-3 last:border-b-0 sm:px-5 sm:py-4 lg:border-b-0 lg:border-r lg:last:border-r-0 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={18} className="shrink-0 text-[#297356]" aria-hidden="true" />
        <h3 className="text-[15px] font-extrabold leading-snug text-[#234a38] sm:text-[16px]">{title}</h3>
      </div>
      <p className="mt-2 text-[29px] font-black leading-tight tabular-nums text-[#183e2e] sm:text-[34px] max-sm:col-start-2 max-sm:row-start-1 max-sm:row-span-2 max-sm:mt-0 max-sm:text-right max-sm:text-[25px]">{value}</p>
      <p className="mt-1 text-[14px] leading-5 text-stone-600 max-sm:col-start-1 max-sm:row-start-2">{description}</p>
    </div>
  );
}

function DemandMetric({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0 border-b border-r border-[#dae5eb] p-3 sm:p-4 last:border-r-0 max-sm:even:border-r-0">
      <div className="flex items-center gap-2">
        <Icon size={17} className="shrink-0 text-[#2d6884]" aria-hidden="true" />
        <span className="text-[14px] font-bold text-[#416071] sm:text-[15px]">{label}</span>
      </div>
      <p className="mt-2 break-words text-[22px] font-black leading-tight text-[#1d4358] sm:text-[28px]">{value}</p>
    </div>
  );
}

function DemandLine({ title, subtitle, count, countLabel = "" }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-stone-200 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="break-words text-[15px] font-bold leading-snug text-[#183b2e] sm:text-[16px]">
          {title}
        </p>
        {subtitle ? <p className="mt-1 break-words text-[14px] text-stone-600 sm:text-[15px]">{subtitle}</p> : null}
      </div>
      <span className="shrink-0 text-[15px] font-extrabold tabular-nums text-[#176447] sm:text-[16px]">
        {count}
        {countLabel}
      </span>
    </div>
  );
}

function ExperimentCard({ experiment, busy, isRootSuperAdmin, run }) {
  return (
    <div className="min-w-0 border-l-[4px] border-[#8266a2] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-[17px] font-black text-stone-950 sm:text-[18px]">
              {experiment.name}
            </h3>
            <span className="rounded-full bg-[#f2eef7] px-2.5 py-1 text-[12px] font-bold text-[#60457f] ring-1 ring-[#d8cce6]">
              {experimentStatusLabel[experiment.status] || experiment.status}
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-6 text-stone-600 sm:text-[15px]">
            {experiment.experimentKey} · version {experiment.versionNumber}
          </p>
          <p className="mt-1 break-words text-[14px] leading-6 text-stone-600 sm:text-[15px]">
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
                className="focus-ring rounded-[12px] border border-[#91bba8] bg-[#e5f2eb] px-3.5 py-2.5 text-[14px] font-bold text-[#174f3f] disabled:opacity-50"
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
                className="focus-ring rounded-[12px] border border-[#d9bd82] bg-[#fff3d7] px-3.5 py-2.5 text-[14px] font-bold text-[#79521b] disabled:opacity-50"
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
                className="focus-ring rounded-[12px] border border-stone-300 bg-white px-3.5 py-2.5 text-[14px] font-bold text-stone-700 disabled:opacity-50"
              >
                Finish
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FormField({ label, children, className = "" }) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-2 block text-[14px] font-bold text-stone-700 sm:text-[15px]">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "focus-ring h-12 w-full min-w-0 rounded-[12px] border border-[#ceded7] bg-white px-4 text-[15px] font-semibold text-stone-800 placeholder:text-stone-400";

export default function AdminAnalyticsPage() {
  const { isRootSuperAdmin, hasAdminPermission } = useAdmin();
  const location = useLocation();

  const canReadAnalytics = [
    "admin.dashboard.read",
    "admin.audit.read",
    "marketplace.read",
    "trust_safety.read",
  ].some((permission) => hasAdminPermission(permission));

  const canReadDemand = ["admin.dashboard.read", "marketplace.read", "catalog.read"].some(
    (permission) => hasAdminPermission(permission)
  );

  const canReadExperiments = ["admin.dashboard.read", "admin.audit.read"].some(
    (permission) => hasAdminPermission(permission)
  );

  const [days, setDays] = useState(30);
  const [activeDemandView, setActiveDemandView] = useState("popular");
  const [demand, setDemand] = useState(null);
  const [demandError, setDemandError] = useState("");
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
    setDemandError("");

    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const requests = await Promise.allSettled([
      canReadAnalytics ? getAdminAnalyticsDashboard({ start, end }) : Promise.resolve(null),
      canReadExperiments ? listExperimentDefinitions() : Promise.resolve(null),
      canReadDemand ? getAdminSearchDemand({ days, limit: 50 }) : Promise.resolve(null),
    ]);

    if (requests[0].status === "fulfilled") {
      setDashboard(requests[0].value);
    } else {
      setDashboard(null);
      setError(getAnalyticsErrorMessage(requests[0].reason, "Unable to load customer analytics."));
    }

    if (requests[1].status === "fulfilled") {
      setExperiments(requests[1].value?.experiments || []);
    } else {
      setExperiments([]);
      setError((current) => current || getAnalyticsErrorMessage(requests[1].reason, "Unable to load experiments."));
    }

    if (requests[2].status === "fulfilled") {
      setDemand(requests[2].value);
    } else {
      setDemand(null);
      setDemandError(
        getAdminGovernanceErrorMessage(requests[2].reason, "Unable to load customer search demand.")
      );
    }

    setLoading(false);
  }, [days, canReadAnalytics, canReadDemand, canReadExperiments]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, canReadDemand, canReadAnalytics]);

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

  const funnel = dashboard?.funnel || { counts: {}, rates: {} };

  const steps = useMemo(
    () => [
      {
        number: "01",
        title: "Customer activity",
        description: "See searches, recipe interest, baskets and orders.",
        icon: BarChart3,
        target: "activity-overview",
      },
      {
        number: "02",
        title: "Find drop-offs",
        description: "Check weak points in search and customer movement.",
        icon: Search,
        target: "quality-overview",
      },
      ...(canReadExperiments
        ? [
            {
              number: "03",
              title: "Create a test",
              description: isRootSuperAdmin
                ? "Set up one controlled improvement test."
                : "View the available controlled tests.",
              icon: Beaker,
              target: isRootSuperAdmin ? "create-experiment" : "experiments",
            },
            {
              number: "04",
              title: "Review results",
              description: "Start, pause or finish a test from one place.",
              icon: TrendingUp,
              target: "experiments",
            },
          ]
        : []),
    ],
    [canReadExperiments, isRootSuperAdmin]
  );

  return (
    <AdminShell
      flushTop
      title="Analytics & Customer Demand"
      description=""
      showWorkspaceBadge={false}
      mobileStackHeader
      actions={
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto sm:flex-wrap sm:justify-end">
          <div
            className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-xl border border-stone-200 bg-white p-1 sm:flex-none"
            aria-label="Reporting period"
          >
            {[7, 30, 90].map((period) => (
              <button
                key={period}
                type="button"
                aria-pressed={days === period}
                onClick={() => setDays(period)}
                className={`focus-ring min-w-0 flex-1 rounded-lg px-2 py-2.5 text-center text-[14px] font-bold transition sm:flex-none sm:px-3 sm:py-2 ${
                  days === period ? "bg-[#16563f] text-white" : "text-stone-600 hover:bg-emerald-50"
                }`}
              >
                {period}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading || busy}
            className="focus-ring inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-[14px] font-black text-stone-700 shadow-sm disabled:opacity-50 sm:h-10 sm:gap-2 sm:px-4"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-6 sm:space-y-8">
        {error ? (
          <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-semibold leading-6 text-red-800 sm:text-[15px]">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold leading-6 text-emerald-800 sm:text-[15px]">
            {notice}
          </div>
        ) : null}

        <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#bcdac7] bg-[#ecf6ed] shadow-[0_8px_30px_rgba(23,74,48,0.07)]">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="min-w-0 bg-[linear-gradient(135deg,#14553e,#23694e)] px-4 py-5 text-white sm:px-7 sm:py-8">
              <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#c4efdc]">INSIGHTS & EXPERIMENTS</p>
              <h1 className="mt-3 max-w-xl text-[24px] font-black leading-[1.16] tracking-[-0.025em] sm:text-[34px] sm:leading-[1.12] sm:tracking-[-0.035em]">
                Understand activity. Find demand. Improve the experience.
              </h1>
              <p className="mt-2 max-w-lg text-[14px] leading-6 text-[#e1f2e8] sm:mt-4 sm:text-[15px]">
                Four clear work areas, from customer behaviour to controlled testing.
              </p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 bg-[#eaf5ed] p-3 sm:gap-x-3 sm:gap-y-0 sm:px-5 sm:py-0 lg:content-center">
              {steps.map((step) => <JourneyCard key={step.number} step={step} />)}
            </div>
          </div>
        </section>

        {canReadAnalytics && (loading || dashboard) ? (
          <SectionBlock
            id="activity-overview"
            number="01"
            tone="activity"
            title="Customer activity overview"
            description="Customer actions and the steps that turn interest into orders."
          >
            <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-[16px] border border-[#d3e6d8] bg-[#f0f8f2] sm:grid-cols-4">
              <StatCard label="Searches" value={funnel.counts?.search || 0} icon={Search} />
              <StatCard label="Recipe choices" value={funnel.counts?.recipe || 0} icon={Sparkles} />
              <StatCard label="Baskets" value={funnel.counts?.basket || 0} icon={ShoppingBasket} />
              <StatCard label="Orders" value={funnel.counts?.orders || 0} icon={CheckCircle2} />
            </div>

            <div id="quality-overview" className="mt-4 grid min-w-0 overflow-hidden rounded-[16px] border border-[#e2e7e2] bg-[#fbfcf9] lg:grid-cols-3">
              <SignalCard
                icon={BarChart3}
                title="Recipe to shopping needs"
                value={pct(funnel.rates?.recipeToRequirements)}
                description={`Needs to basket: ${pct(funnel.rates?.requirementsToBasket)}`}
              />
              <SignalCard
                icon={Search}
                title="Search success"
                value={
                  dashboard?.searchQuality?.queries
                    ? pct(1 - Number(dashboard?.searchQuality?.zeroResultRate || 0))
                    : "—"
                }
                description={
                  dashboard?.searchQuality?.queries ? "Share of searches that returned results." : "No searches recorded yet."
                }
              />
              <SignalCard
                icon={BellRing}
                title="Useful notifications"
                value={pct(dashboard?.notificationUtility?.actionRate)}
                description="Customer actions taken after notifications."
              />
            </div>
          </SectionBlock>
        ) : null}

        {canReadDemand ? (
          <SectionBlock
            id="customer-demand"
            number="02"
            tone="demand"
            title="Customer search demand"
            description="Switch between searches, locations and recent activity."
            actions={<span className="inline-flex rounded-full border border-[#bad7e5] bg-white px-3 py-1.5 text-[14px] font-bold text-[#255a76]">Last {days} days</span>}
          >
            {demandError ? (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[14px] font-semibold text-red-700">
                {demandError}
              </p>
            ) : null}

            {loading && demand === null && !demandError ? (
              <p className="text-[15px] text-stone-600">Loading search activity…</p>
            ) : null}

            {demand ? (
              <>
                <div className="grid min-w-0 grid-cols-2 overflow-hidden rounded-[16px] border border-[#d4e3ea] bg-[#f0f8fb] lg:grid-cols-4">
                  <DemandMetric label="Recorded searches" value={demand?.totalSearches ?? (loading ? "—" : 0)} icon={Search} />
                  <DemandMetric label="Customers" value={demand?.uniqueCustomers ?? (loading ? "—" : 0)} icon={UsersRound} />
                  <DemandMetric label="Top search" value={demand?.topQuery?.query || "No searches yet"} icon={BarChart3} />
                  <DemandMetric label="Top location" value={demand?.topArea ? searchArea(demand.topArea) : "—"} icon={MapPinned} />
                </div>

                {demand?.queryByArea?.[0] ? (
                  <div className="mt-3 flex min-w-0 flex-col gap-1 rounded-[14px] bg-[#e4f3ed] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <p className="min-w-0 break-words text-[14px] font-semibold text-[#315b46] sm:text-[15px]">
                      Leading search: <span className="font-black text-[#164b34]">{demand.queryByArea[0].query}</span>
                      <span className="ml-2 text-stone-600">{searchArea(demand.queryByArea[0])}</span>
                    </p>
                    <span className="shrink-0 text-[14px] font-extrabold text-[#155d43] sm:text-[15px]">
                      {demand.queryByArea[0].searches} searches
                    </span>
                  </div>
                ) : null}

                <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-[235px_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]">
                  <div role="tablist" aria-label="Customer demand data views"
                    className="grid min-w-0 grid-cols-2 gap-2 rounded-[16px] bg-[#eaf2f7] p-2 md:flex md:flex-col md:gap-2 md:p-3">
                    {[
                      { key: "popular", label: "Popular searches", icon: Search, count: demand?.topQueries?.length || 0 },
                      { key: "locations", label: "Top locations", icon: MapPinned, count: demand?.topAreas?.length || 0 },
                      { key: "by-area", label: "Demand by location", icon: BarChart3, count: demand?.queryByArea?.length || 0 },
                      { key: "recent", label: "Recent searches", icon: Clock3, count: demand?.recent?.length || 0 },
                    ].map((view) => {
                      const Icon = view.icon;
                      const selected = activeDemandView === view.key;
                      return (
                        <button key={view.key} type="button" role="tab" aria-selected={selected}
                          aria-controls="customer-demand-data-view" onClick={() => setActiveDemandView(view.key)}
                          onPointerEnter={(event) => {
                            if (event.pointerType === "mouse" || event.pointerType === "pen") setActiveDemandView(view.key);
                          }}
                          className={`focus-ring group flex min-w-0 items-center gap-2 rounded-[12px] border px-2.5 py-3 text-left transition-colors max-sm:min-h-[66px] sm:gap-3 sm:p-3.5 ${
                            selected
                              ? "border-[#225e7a] bg-[#235f7d] text-white shadow-[0_4px_12px_rgba(28,82,111,0.12)]"
                              : "border-transparent bg-white text-[#2a5368] hover:border-[#aac9d9] hover:bg-[#f6fbfd]"
                          }`}>
                          <Icon size={19} className="shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-[14px] font-extrabold leading-snug sm:text-[15px]">{view.label}</span>
                          <span className={`hidden shrink-0 text-[13px] font-bold sm:inline ${selected ? "text-[#e4f4fa]" : "text-[#658697]"}`}>
                            {view.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div id="customer-demand-data-view" role="tabpanel" aria-live="polite"
                    className="flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#d4e2e9] bg-white">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e5eef0] bg-[#f9fcfd] px-4 py-3 sm:px-5">
                      <h3 className="text-[18px] font-black text-[#1e5069] sm:text-[20px]">
                        {activeDemandView === "popular" ? "Popular searches" : activeDemandView === "locations" ? "Top locations" : activeDemandView === "by-area" ? "Demand by location" : "Recent searches"}
                      </h3>
                      <span className="text-[13px] font-semibold text-[#5a7888]">Last {days} days</span>
                    </div>
                    <div className="h-[260px] min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-1 sm:h-[360px] sm:px-5 lg:h-[390px]" tabIndex={0} aria-label="Scrollable customer demand results">
                      {activeDemandView === "popular" ? (
                        (demand?.topQueries || []).length ? demand.topQueries.map((row, index) => (
                          <DemandLine key={`${row.query}-${index}`} title={row.query}
                            subtitle={`${row.uniqueCustomers} customer${row.uniqueCustomers === 1 ? "" : "s"}`}
                            count={row.searches} />
                        )) : <p className="py-5 text-[15px] text-stone-600">No searches in this period.</p>
                      ) : null}

                      {activeDemandView === "locations" ? (
                        (demand?.topAreas || []).length ? demand.topAreas.map((row, index) => (
                          <DemandLine key={`${searchArea(row)}-${index}`} title={searchArea(row)}
                            subtitle={`${row.uniqueCustomers} customer${row.uniqueCustomers === 1 ? "" : "s"}`}
                            count={row.searches} />
                        )) : <p className="py-5 text-[15px] text-stone-600">No locations recorded yet.</p>
                      ) : null}

                      {activeDemandView === "by-area" ? (
                        (demand?.queryByArea || []).length ? demand.queryByArea.map((row, index) => (
                          <div key={`${row.query}-${searchArea(row)}-${index}`} className="flex min-w-0 items-start justify-between gap-3 border-b border-[#e7eded] py-3.5 last:border-b-0">
                            <div className="min-w-0">
                              <p className="break-words text-[15px] font-bold text-[#1e3f4f] sm:text-[16px]">{row.query}</p>
                              <p className="mt-1 break-words text-[14px] text-stone-600">{searchArea(row)}</p>
                            </div>
                            <p className="shrink-0 text-[14px] font-extrabold text-[#1e657f] sm:text-[15px]">{row.searches} searches</p>
                          </div>
                        )) : <p className="py-5 text-[15px] text-stone-600">No area-specific search demand in this period.</p>
                      ) : null}

                      {activeDemandView === "recent" ? (
                        (demand?.recent || []).length ? demand.recent.map((row, index) => (
                          <div key={row.id || index} className="flex min-w-0 flex-col gap-1 border-b border-[#e7eded] py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                              <p className="break-words text-[15px] font-bold text-[#1e3f4f] sm:text-[16px]">{row.query}</p>
                              <p className="mt-1 break-words text-[14px] text-stone-600">{searchArea(row.area)} · {row.surface}</p>
                            </div>
                            <p className="shrink-0 text-[14px] text-[#61727c]">{searchTime(row.occurredAt)}</p>
                          </div>
                        )) : <p className="py-5 text-[15px] text-stone-600">No recent searches in this period.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </SectionBlock>
        ) : null}

        {(canReadExperiments || isRootSuperAdmin) && isRootSuperAdmin ? (
          <SectionBlock
            id="create-experiment"
            number="03"
            tone="test"
            title="Create a controlled test"
            description="Set up a test with a clear goal and a measurable result."
          >
            <div className="grid min-w-0 gap-0 overflow-hidden rounded-[17px] border border-[#ecddc9] bg-white lg:grid-cols-[230px_minmax(0,1fr)]">
              <div className="min-w-0 bg-[#fbf2e5] p-4 sm:p-6">
                <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#efddc0] text-[#81511e]">
                  <Beaker size={18} aria-hidden="true" />
                </span>
                <h3 className="mt-2 text-[20px] font-black leading-tight text-[#69461c] sm:mt-4 sm:text-[24px]">
                  Test setup
                </h3>
                <p className="mt-1 text-[14px] leading-6 text-stone-600 sm:mt-2 sm:text-[15px]">
                  Define the change, choose a measure and save your draft.
                </p>
              </div>

              <div className="min-w-0 border-t border-[#ecddc9] bg-white p-4 sm:p-5 lg:border-l lg:border-t-0 lg:p-6">
                <div className="grid gap-4 md:grid-cols-2 md:gap-5">
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

                  <FormField label="Test type">
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
                      <option value="notification_utility">Notification usefulness</option>
                      <option value="recommendation_utility">Recommendation usefulness</option>
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

                  <FormField label="Expected improvement" className="md:col-span-2">
                    <textarea
                      className="focus-ring min-h-[120px] w-full rounded-[12px] border border-[#ceded7] bg-white px-4 py-3 text-[15px] font-semibold leading-6 text-stone-800 placeholder:text-stone-400"
                      placeholder="What customer problem will this test address?"
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
                            surfaceKey: form.surfaceKey.trim() || form.experimentKey.trim(),
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
                            primaryUtilityMetricKey: form.primaryUtilityMetricKey.trim(),
                            guardrailMetricKeys: ["trust.correction_rate"],
                            holdoutRequired: true,
                            reason: form.reason,
                          }),
                        "Experiment created as a draft."
                      )
                    }
                    className="focus-ring inline-flex h-12 w-full items-center justify-center rounded-[12px] bg-[#174f3f] px-5 text-[15px] font-black text-white transition hover:bg-[#103f32] disabled:opacity-50 sm:w-auto sm:px-6"
                  >
                    Save test as draft
                  </button>
                </div>
              </div>
            </div>
          </SectionBlock>
        ) : null}

        {canReadExperiments ? (
          <SectionBlock
            id="experiments"
            number="04"
            tone="manage"
            title="Manage tests"
            description="Manage draft, running, paused and completed tests."
            actions={
              <span className="rounded-full border border-[#dfd5ed] bg-white px-3 py-2 text-[14px] font-bold text-[#60457f]">
                {experiments.length} total
              </span>
            }
          >
            {experiments.length ? (
              <div className="min-w-0 overflow-hidden rounded-[16px] border border-[#e2dbea] bg-white divide-y divide-[#e9e3f0]">
                {experiments.map((experiment) => (
                  <ExperimentCard
                    key={experiment.id}
                    experiment={experiment}
                    busy={busy}
                    isRootSuperAdmin={isRootSuperAdmin}
                    run={run}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[148px] items-center justify-center rounded-[16px] border border-[#e1d9ec] bg-[#f9f7fc] px-4 py-7 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-[#8065a0] ring-1 ring-[#ddd6e9]">
                    <Beaker size={19} aria-hidden="true" />
                  </span>
                  <p className="mt-4 text-[16px] font-black text-stone-800 sm:text-[17px]">No experiments yet</p>
                </div>
              </div>
            )}
          </SectionBlock>
        ) : null}
      </div>
    </AdminShell>
  );
}
