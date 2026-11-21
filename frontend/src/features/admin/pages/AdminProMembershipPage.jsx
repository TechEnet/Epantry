import {
  CheckCircle2,
  CircleAlert,
  CreditCard,
  Crown,
  IndianRupee,
  LoaderCircle,
  RefreshCw,
  Save,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdminShell from "../components/AdminShell";

import {
  getAdminProMemberships,
  getAdminProOverview,
  getAdminProPayments,
  updateAdminProPlan,
} from "../services/admin.service";

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load EPANTRY Pro right now."
  );
}

function moneyFromMinor(value) {
  return `₹${Math.round(Number(value || 0) / 100).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readableStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "suspended") return "Suspended";
  if (status === "paid") return "Paid";
  if (status === "initiated") return "Started";
  if (status === "failed") return "Failed";

  return status || "Unknown";
}

function statusClasses(status) {
  if (status === "active" || status === "paid") {
    return "border-[#173F35]/20 bg-[#D7DDCF] text-[#173F35]";
  }

  if (status === "suspended" || status === "failed") {
    return "border-[#C56C42]/40 bg-[#C56C42]/15 text-[#202421]";
  }

  if (status === "initiated") {
    return "border-[#C56C42]/35 bg-[#C56C42]/10 text-[#202421]";
  }

  return "border-[#202421]/20 bg-[#F7F6F2] text-[#202421]";
}

function normalizePlanDraft(plan) {
  return {
    priceRupees: String(Math.round(Number(plan?.priceMinor || 0) / 100)),
    shortDescription: plan?.shortDescription || "",
    benefitsText: Array.isArray(plan?.benefits) ? plan.benefits.join("\n") : "",
    isEnabled: plan?.isEnabled !== false,
  };
}

function planDuration(plan) {
  const months = Number(plan?.validityMonths || 0);

  if (months === 1) return "1 month";
  if (months === 12) return "12 months";
  return `${months} months`;
}

export default function AdminProMembershipPage() {
  const [overview, setOverview] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [payments, setPayments] = useState([]);
  const [membershipPagination, setMembershipPagination] = useState(null);
  const [paymentPagination, setPaymentPagination] = useState(null);
  const [membershipStatus, setMembershipStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [membershipPage, setMembershipPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [planDrafts, setPlanDrafts] = useState({});
  const [selectedPlanCode, setSelectedPlanCode] = useState("");
  const [activityView, setActivityView] = useState("memberships");
  const [busyPlanCode, setBusyPlanCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOverview = useCallback(async () => {
    const result = await getAdminProOverview();
    setOverview(result);

    setPlanDrafts((current) => {
      const next = {
        ...current,
      };

      for (const plan of result?.plans || []) {
        if (!next[plan.code]) {
          next[plan.code] = normalizePlanDraft(plan);
        }
      }

      return next;
    });

    setSelectedPlanCode((current) => current || result?.plans?.[0]?.code || "");
  }, []);

  const loadMemberships = useCallback(async () => {
    const result = await getAdminProMemberships({
      status: membershipStatus,
      page: membershipPage,
      limit: 20,
    });

    setMemberships(result?.memberships || []);
    setMembershipPagination(result?.pagination || null);
  }, [membershipStatus, membershipPage]);

  const loadPayments = useCallback(async () => {
    const result = await getAdminProPayments({
      status: paymentStatus,
      page: paymentPage,
      limit: 20,
    });

    setPayments(result?.payments || []);
    setPaymentPagination(result?.pagination || null);
  }, [paymentStatus, paymentPage]);

  const loadAll = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const results = await Promise.allSettled([
        loadOverview(),
        loadMemberships(),
        loadPayments(),
      ]);

      const failed = results.find((result) => result.status === "rejected");

      if (failed?.reason) {
        setError(getErrorMessage(failed.reason));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [loadMemberships, loadOverview, loadPayments]
  );

  useEffect(() => {
    loadAll();
  }, []); // initial load only; filters below refresh their own section

  useEffect(() => {
    if (loading) return;

    loadMemberships().catch((requestError) => {
      setError(getErrorMessage(requestError));
    });
  }, [membershipStatus, membershipPage]);

  useEffect(() => {
    if (loading) return;

    loadPayments().catch((requestError) => {
      setError(getErrorMessage(requestError));
    });
  }, [paymentStatus, paymentPage]);

  const plans = overview?.plans || [];
  const summary = overview?.summary || {};
  const selectedPlan =
    plans.find((plan) => plan.code === selectedPlanCode) || plans[0] || null;
  const selectedDraft = selectedPlan
    ? planDrafts[selectedPlan.code] || normalizePlanDraft(selectedPlan)
    : null;

  const paidRevenue = useMemo(
    () => moneyFromMinor(summary?.payments?.paidRevenueMinor),
    [summary]
  );

  function updatePlanDraft(planCode, key, value) {
    setPlanDrafts((current) => ({
      ...current,
      [planCode]: {
        ...(current[planCode] || {}),
        [key]: value,
      },
    }));
  }

  async function savePlan(plan) {
    const draft = planDrafts[plan.code] || normalizePlanDraft(plan);
    const rupees = Number(draft.priceRupees);

    if (!Number.isFinite(rupees) || rupees <= 0) {
      setError("Enter a valid plan price.");
      return;
    }

    const benefits = String(draft.benefitsText || "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (benefits.length < 1) {
      setError("Add at least one customer benefit.");
      return;
    }

    setBusyPlanCode(plan.code);
    setError("");
    setMessage("");

    try {
      await updateAdminProPlan({
        planCode: plan.code,
        changes: {
          priceMinor: Math.round(rupees * 100),
          shortDescription: draft.shortDescription,
          benefits,
          isEnabled: draft.isEnabled === true,
        },
      });

      setMessage(`${plan.name} updated. The change applies to new purchases.`);
      await loadOverview();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyPlanCode("");
    }
  }

  if (loading) {
    return (
      <AdminShell
        title="EPANTRY Pro"
        description="Manage membership plans, access and payments."
      >
        <div className="grid min-h-[42svh] place-items-center bg-[#F7F6F2]">
          <div className="flex items-center gap-3 text-[15px] font-semibold text-[#173F35]">
            <LoaderCircle
              size={21}
              className="animate-spin"
              aria-hidden="true"
            />
            Loading Pro memberships…
          </div>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="EPANTRY Pro"
      description={
        <span className="hidden sm:inline">
          Plans, customer access and payments in one place.
        </span>
      }
      actions={
        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadAll({ silent: true })}
          className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#173F35]/20 bg-[#F7F6F2] px-4 text-[13px] font-bold text-[#173F35] transition hover:bg-[#D7DDCF] disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={refreshing ? "animate-spin" : ""}
            aria-hidden="true"
          />
          Refresh
        </button>
      }
    >
      <div className="-mx-2.5 min-w-0 space-y-0 bg-[#F7F6F2] pb-2 text-[#202421] sm:mx-0 sm:space-y-8 sm:pb-8">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 border-l-4 border-[#C56C42] bg-[#C56C42]/10 px-4 py-3 text-[14px] font-semibold text-[#202421] sm:px-6"
          >
            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0 text-[#C56C42]"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div
            role="status"
            className="flex items-start gap-2 border-l-4 border-[#173F35] bg-[#D7DDCF] px-4 py-3 text-[14px] font-semibold text-[#173F35] sm:px-6"
          >
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>{message}</span>
          </div>
        ) : null}

        {/* A single editorial header, not a second page title or a grid of generic cards. */}
        <section
          aria-label="EPANTRY Pro overview"
          className="overflow-hidden border-b border-[#202421]/15 sm:rounded-[18px] sm:border sm:border-[#202421]/10"
        >
          <div className="grid lg:grid-cols-[minmax(0,1.06fr)_minmax(0,1fr)]">
            <div className="relative bg-[#C56C42] px-4 py-3 sm:px-8 sm:py-10 lg:py-12">
              <div className="flex items-center gap-2 text-[12px] font-extrabold tracking-[0.1em] text-[#202421]">
                <span className="inline-block h-[2px] w-7 bg-[#202421]" />
                PRO MEMBERSHIP CONTROL
              </div>
              <h2 className="mt-5 hidden max-w-2xl text-[32px] font-extrabold leading-[1.07] tracking-[-0.045em] text-[#202421] sm:block sm:text-[42px] lg:text-[46px]">
                One place for every Pro membership.
              </h2>
              <p className="mt-4 hidden max-w-xl text-[15px] leading-[1.55] text-[#202421]/85 sm:block">
                Set your plans, check who has access and review payments.
              </p>
              <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#202421] sm:mt-7 sm:text-[13px]">
                <Crown size={18} aria-hidden="true" />
                {plans.length} {plans.length === 1 ? "plan" : "plans"} in your
                catalogue
              </div>
            </div>

            <div className="grid grid-cols-3 bg-[#D7DDCF] text-[#173F35] sm:grid-cols-3 sm:bg-[#173F35] sm:text-[#F7F6F2] lg:grid-cols-2">
              <div className="flex min-w-0 flex-col justify-between border-b border-[#173F35]/15 px-3 py-3 sm:border-[#F7F6F2]/15 sm:px-6 sm:py-7 sm:border-b-0 lg:border-b">
                <div className="flex items-start gap-1 text-[12px] font-semibold leading-tight text-[#173F35]/75 sm:items-center sm:gap-2 sm:text-[13px] sm:text-[#F7F6F2]/80">
                  <Users
                    size={17}
                    className="hidden sm:block"
                    aria-hidden="true"
                  />{" "}
                  Active members
                </div>
                <p className="mt-2 text-[24px] font-extrabold leading-none tabular-nums tracking-[-0.05em] sm:mt-5 sm:text-[44px]">
                  {summary?.memberships?.active || 0}
                </p>
              </div>
              <div className="flex min-w-0 flex-col justify-between border-b border-l border-[#173F35]/15 px-3 py-3 sm:border-[#F7F6F2]/15 sm:px-6 sm:py-7 sm:border-b-0 lg:border-b">
                <div className="flex items-start gap-1 text-[12px] font-semibold leading-tight text-[#173F35]/75 sm:items-center sm:gap-2 sm:text-[13px] sm:text-[#F7F6F2]/80">
                  <IndianRupee
                    size={17}
                    className="hidden sm:block"
                    aria-hidden="true"
                  />{" "}
                  Paid revenue
                </div>
                <p className="mt-2 break-words text-[21px] font-extrabold leading-none tabular-nums tracking-[-0.05em] sm:mt-5 sm:text-[38px]">
                  {paidRevenue}
                </p>
              </div>
              <div className="col-span-1 flex min-w-0 flex-col items-start justify-between gap-1 border-l border-[#173F35]/15 bg-[#D7DDCF] px-3 py-3 sm:col-span-1 sm:flex-row sm:items-center sm:gap-4 sm:border-[#F7F6F2]/15 sm:bg-[#202421] sm:px-6 sm:py-5 lg:col-span-2 lg:border-l-0">
                <div>
                  <p className="text-[12px] font-semibold leading-tight text-[#173F35]/75 sm:text-[13px] sm:text-[#F7F6F2]/80">
                    Successful payments
                  </p>
                  <p className="mt-2 text-[24px] font-extrabold leading-none tabular-nums sm:mt-1 sm:text-[28px]">
                    {summary?.payments?.paidCount || 0}
                  </p>
                </div>
                <CreditCard
                  size={30}
                  className="hidden text-[#C56C42] sm:block"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Plan catalogue and editor share one deliberate workspace. */}
        <section
          aria-labelledby="pro-plans-heading"
          className="min-w-0 border-b border-[#202421]/15 sm:border-b-0"
        >
          <div className="mb-0 flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-5 sm:mb-5 sm:px-0 sm:pb-0 sm:pt-0">
            <div>
              <p className="hidden text-[12px] font-extrabold tracking-[0.09em] text-[#C56C42] sm:block">
                01 / MEMBERSHIP PLANS
              </p>
              <h2
                id="pro-plans-heading"
                className="text-[23px] font-extrabold leading-tight tracking-[-0.035em] text-[#202421] sm:mt-1 sm:text-[32px]"
              >
                Set your Pro plans
              </h2>
            </div>
            <p className="hidden text-[14px] font-medium text-[#173F35] sm:block">
              Choose a plan to edit its price and benefits.
            </p>
          </div>

          {plans.length ? (
            <div className="grid min-w-0 overflow-hidden border-t border-[#202421]/15 bg-[#F7F6F2] sm:rounded-[18px] sm:border lg:grid-cols-[minmax(245px,0.34fr)_minmax(0,1fr)]">
              <div className="border-b border-[#202421]/15 bg-[#D7DDCF] lg:border-b-0 lg:border-r">
                <div className="hidden border-b border-[#173F35]/15 px-4 py-4 sm:block sm:px-6 sm:py-5">
                  <p className="text-[13px] font-extrabold text-[#173F35]">
                    Your plan collection
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#202421]/75">
                    Select the plan you want to manage.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-0 p-0 sm:gap-3 sm:p-4 lg:grid-cols-1">
                  {plans.map((plan, index) => {
                    const active = selectedPlan?.code === plan.code;
                    return (
                      <button
                        key={plan.code}
                        type="button"
                        onClick={() => setSelectedPlanCode(plan.code)}
                        aria-pressed={active}
                        className={`focus-ring min-w-0 border-b border-r border-[#173F35]/20 p-3 text-left transition sm:rounded-[12px] sm:border sm:p-4 ${
                          active
                            ? "bg-[#173F35] text-[#F7F6F2] sm:border-[#173F35] sm:shadow-[0_7px_16px_rgba(23,63,53,0.12)]"
                            : "bg-[#F7F6F2] text-[#202421] sm:border-[#173F35]/15 sm:hover:border-[#C56C42]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-extrabold tracking-[0.08em] ${
                              active ? "text-[#D7DDCF]" : "text-[#C56C42]"
                            }`}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`px-0 py-0 text-[10px] font-bold sm:rounded-full sm:px-2 sm:py-1 sm:text-[11px] ${
                              active
                                ? "bg-[#F7F6F2]/15 text-[#F7F6F2]"
                                : "bg-[#D7DDCF] text-[#173F35]"
                            }`}
                          >
                            {plan.isEnabled ? "Available" : "Hidden"}
                          </span>
                        </div>
                        <p className="mt-1.5 break-words text-[16px] font-extrabold leading-tight sm:mt-3 sm:text-[18px]">
                          {plan.name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-1 sm:mt-2">
                          <span
                            className={`text-[13px] font-medium ${
                              active ? "text-[#F7F6F2]/75" : "text-[#202421]/65"
                            }`}
                          >
                            {planDuration(plan)}
                          </span>
                          <span className="text-[16px] font-extrabold tabular-nums sm:text-[18px]">
                            {moneyFromMinor(plan.priceMinor)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPlan && selectedDraft ? (
                <div className="min-w-0 bg-[#F7F6F2]">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#202421]/12 bg-[#D7DDCF]/45 px-4 py-3 sm:gap-4 sm:bg-transparent sm:px-7 sm:py-6">
                    <div className="min-w-0">
                      <p className="hidden text-[12px] font-extrabold tracking-[0.07em] text-[#C56C42] sm:block">
                        EDIT SELECTED PLAN
                      </p>
                      <h3 className="flex items-center gap-2 break-words text-[20px] font-extrabold tracking-[-0.03em] text-[#173F35] sm:mt-1 sm:text-[29px]">
                        <Crown
                          size={21}
                          className="shrink-0 text-[#C56C42]"
                          aria-hidden="true"
                        />
                        {selectedPlan.name}
                      </h3>
                      <p className="mt-1 hidden text-[14px] text-[#202421]/75 sm:block">
                        Access for {planDuration(selectedPlan)}
                      </p>
                    </div>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-[#173F35]/20 bg-[#D7DDCF] px-3 text-[13px] font-bold text-[#173F35]">
                      <input
                        type="checkbox"
                        checked={selectedDraft.isEnabled === true}
                        onChange={(event) =>
                          updatePlanDraft(
                            selectedPlan.code,
                            "isEnabled",
                            event.target.checked
                          )
                        }
                        className="size-4 accent-[#173F35]"
                      />
                      {selectedDraft.isEnabled
                        ? "Available to buy"
                        : "Not available"}
                    </label>
                  </div>

                  <div className="grid gap-4 px-4 py-4 sm:gap-6 sm:px-7 sm:py-6">
                    <div className="grid gap-3 sm:grid-cols-[minmax(145px,0.32fr)_minmax(0,1fr)] sm:gap-4">
                      <label className="block min-w-0 text-[14px] font-bold text-[#202421]">
                        Plan price
                        <div className="relative mt-2">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[16px] font-bold text-[#173F35]">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={selectedDraft.priceRupees}
                            onChange={(event) =>
                              updatePlanDraft(
                                selectedPlan.code,
                                "priceRupees",
                                event.target.value
                              )
                            }
                            className="focus-ring h-12 w-full rounded-[10px] border border-[#173F35]/25 bg-white pl-8 pr-3 text-[16px] font-bold text-[#202421]"
                          />
                        </div>
                      </label>
                      <label className="block min-w-0 text-[14px] font-bold text-[#202421]">
                        Plan description
                        <input
                          type="text"
                          value={selectedDraft.shortDescription}
                          onChange={(event) =>
                            updatePlanDraft(
                              selectedPlan.code,
                              "shortDescription",
                              event.target.value
                            )
                          }
                          className="focus-ring mt-2 h-12 w-full rounded-[10px] border border-[#173F35]/25 bg-white px-3 text-[15px] font-medium text-[#202421]"
                        />
                      </label>
                    </div>
                    <label className="block text-[14px] font-bold text-[#202421]">
                      What's included
                      <span className="ml-2 hidden text-[12px] font-normal text-[#202421]/65 sm:inline">
                        One benefit per line
                      </span>
                      <textarea
                        rows={5}
                        value={selectedDraft.benefitsText}
                        onChange={(event) =>
                          updatePlanDraft(
                            selectedPlan.code,
                            "benefitsText",
                            event.target.value
                          )
                        }
                        className="focus-ring mt-2 h-[112px] w-full resize-y rounded-[10px] border border-[#173F35]/25 bg-white px-3 py-3 text-[15px] font-medium leading-[1.6] text-[#202421] sm:h-auto"
                        placeholder="Add one customer benefit per line"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#173F35]/15 bg-[#D7DDCF]/65 px-4 py-3 sm:gap-3 sm:px-7 sm:py-4">
                    <p className="max-w-md text-[12px] leading-5 text-[#173F35] sm:text-[13px]">
                      <span className="sm:hidden">
                        Applies to new purchases.
                      </span>
                      <span className="hidden sm:inline">
                        Saved plan changes apply to new purchases.
                      </span>
                    </p>
                    <button
                      type="button"
                      disabled={busyPlanCode === selectedPlan.code}
                      onClick={() => savePlan(selectedPlan)}
                      className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#173F35] px-5 text-[14px] font-bold text-[#F7F6F2] transition hover:bg-[#202421] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {busyPlanCode === selectedPlan.code ? (
                        <LoaderCircle
                          size={17}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Save size={17} aria-hidden="true" />
                      )}
                      {busyPlanCode === selectedPlan.code
                        ? "Saving…"
                        : "Save plan changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="border-l-4 border-[#C56C42] bg-[#D7DDCF] px-5 py-7 text-[15px] font-medium text-[#173F35]">
              No Pro plans are available.
            </div>
          )}
        </section>

        <section
          aria-labelledby="pro-customers-heading"
          className="min-w-0 border-b border-[#202421]/15 sm:border-b-0"
        >
          <div className="mb-0 flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-5 sm:mb-5 sm:px-0 sm:pb-0 sm:pt-0">
            <div>
              <p className="hidden text-[12px] font-extrabold tracking-[0.09em] text-[#C56C42] sm:block">
                02 / CUSTOMER RECORDS
              </p>
              <h2
                id="pro-customers-heading"
                className="text-[23px] font-extrabold leading-tight tracking-[-0.035em] text-[#202421] sm:mt-1 sm:text-[32px]"
              >
                Access & payment history
              </h2>
            </div>
            <p className="hidden text-[14px] font-medium text-[#173F35] sm:block">
              Check memberships and customer transactions.
            </p>
          </div>

          <div className="overflow-hidden border-t border-[#202421]/15 bg-[#F7F6F2] sm:rounded-[18px] sm:border">
            <div className="grid grid-cols-2 border-b border-[#202421]/15 bg-[#F7F6F2] sm:bg-[#D7DDCF]">
              <button
                type="button"
                onClick={() => setActivityView("memberships")}
                aria-pressed={activityView === "memberships"}
                className={`focus-ring relative flex min-h-[62px] flex-col items-start justify-center gap-1 px-4 py-2 text-left transition sm:min-h-[78px] sm:px-7 sm:py-3 ${
                  activityView === "memberships"
                    ? "bg-[#D7DDCF]/50 text-[#173F35] sm:bg-[#173F35] sm:text-[#F7F6F2]"
                    : "text-[#173F35] hover:bg-[#D7DDCF]/40 sm:hover:bg-[#173F35]/10"
                }`}
              >
                <span className="flex items-center gap-2 text-[15px] font-extrabold sm:text-[18px]">
                  <Users size={18} aria-hidden="true" /> Memberships
                </span>
                <span
                  className={`text-[12px] font-semibold ${
                    activityView === "memberships"
                      ? "text-[#173F35]/75 sm:text-[#F7F6F2]/75"
                      : "text-[#173F35]/75"
                  }`}
                >
                  {membershipPagination?.total || 0} customers
                </span>
                {activityView === "memberships" ? (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#C56C42]" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setActivityView("payments")}
                aria-pressed={activityView === "payments"}
                className={`focus-ring relative flex min-h-[62px] flex-col items-start justify-center gap-1 border-l border-[#202421]/10 px-4 py-2 text-left transition sm:min-h-[78px] sm:px-7 sm:py-3 ${
                  activityView === "payments"
                    ? "bg-[#D7DDCF]/50 text-[#173F35] sm:bg-[#173F35] sm:text-[#F7F6F2]"
                    : "text-[#173F35] hover:bg-[#D7DDCF]/40 sm:hover:bg-[#173F35]/10"
                }`}
              >
                <span className="flex items-center gap-2 text-[15px] font-extrabold sm:text-[18px]">
                  <CreditCard size={18} aria-hidden="true" /> Payments
                </span>
                <span
                  className={`text-[12px] font-semibold ${
                    activityView === "payments"
                      ? "text-[#173F35]/75 sm:text-[#F7F6F2]/75"
                      : "text-[#173F35]/75"
                  }`}
                >
                  {paymentPagination?.total || 0} transactions
                </span>
                {activityView === "payments" ? (
                  <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#C56C42]" />
                ) : null}
              </button>
            </div>

            {activityView === "memberships" ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202421]/12 px-3 py-3 sm:gap-3 sm:px-7 sm:py-4">
                  <div>
                    <p className="text-[18px] font-extrabold text-[#173F35]">
                      Customer memberships
                    </p>
                    <p className="mt-1 hidden text-[13px] text-[#202421]/70 sm:block">
                      View who has Pro access and for how long.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-[13px] font-bold text-[#173F35]">
                    Status
                    <select
                      aria-label="Filter memberships by status"
                      value={membershipStatus}
                      onChange={(event) => {
                        setMembershipStatus(event.target.value);
                        setMembershipPage(1);
                      }}
                      className="focus-ring h-10 rounded-[9px] border border-[#173F35]/25 bg-white px-3 text-[14px] font-semibold text-[#202421]"
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                </div>

                {memberships.length === 0 ? (
                  <div className="flex items-center gap-3 px-3 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-8 sm:py-9">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D7DDCF] text-[#173F35] sm:size-14">
                      <Users size={26} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[16px] font-extrabold text-[#173F35] sm:text-[18px]">
                        No memberships found
                      </p>
                      <p className="mt-1 hidden text-[14px] leading-6 text-[#202421]/75 sm:block">
                        {membershipStatus === "all"
                          ? "Customers with Pro access will appear here."
                          : "No memberships match this status."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sm:hidden">
                      {memberships.map((membership, index) => (
                        <div
                          key={membership.id}
                          className={`px-4 py-4 ${
                            index ? "border-t border-[#202421]/10" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-[15px] font-extrabold text-[#202421]">
                                {membership.user?.name || "Customer"}
                              </p>
                              <p className="mt-1 break-words text-[13px] text-[#202421]/75">
                                {membership.lastPlan?.name ||
                                  membership.lastPlanCode ||
                                  "Pro access"}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                membership.status
                              )}`}
                            >
                              {readableStatus(membership.status)}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#202421]/80">
                            <span>
                              Valid until {formatDate(membership.validUntil)}
                            </span>
                            <strong className="text-[#173F35]">
                              {membership.active
                                ? `${membership.remainingDays} days left`
                                : "—"}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full min-w-[650px] text-left text-[14px]">
                        <thead className="border-b border-[#202421]/15 bg-[#D7DDCF]/55 text-[12px] font-extrabold text-[#173F35]">
                          <tr>
                            <th className="px-7 py-3.5">Customer</th>
                            <th className="px-4 py-3.5">Status</th>
                            <th className="px-4 py-3.5">Plan</th>
                            <th className="px-4 py-3.5">Valid until</th>
                            <th className="px-7 py-3.5 text-right">
                              Remaining
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberships.map((membership) => (
                            <tr
                              key={membership.id}
                              className="border-b border-[#202421]/10 last:border-b-0 hover:bg-[#D7DDCF]/25"
                            >
                              <td className="px-7 py-4">
                                <p className="font-extrabold text-[#202421]">
                                  {membership.user?.name || "Customer"}
                                </p>
                                <p className="mt-1 break-all text-[12px] text-[#202421]/60">
                                  {membership.user?.email || "—"}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-bold ${statusClasses(
                                    membership.status
                                  )}`}
                                >
                                  {readableStatus(membership.status)}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                {membership.lastPlan?.name ||
                                  membership.lastPlanCode ||
                                  "—"}
                              </td>
                              <td className="px-4 py-4">
                                {formatDate(membership.validUntil)}
                              </td>
                              <td className="px-7 py-4 text-right font-extrabold text-[#173F35]">
                                {membership.active
                                  ? `${membership.remainingDays} days`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#202421]/15 px-4 py-4 sm:px-7 ${
                    !membershipPagination?.total ? "hidden sm:flex" : ""
                  }`}
                >
                  <span className="text-[13px] font-medium text-[#202421]/70">
                    {membershipPagination?.total || 0} records
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={membershipPage <= 1}
                      onClick={() =>
                        setMembershipPage((value) => Math.max(1, value - 1))
                      }
                      className="focus-ring min-h-10 rounded-[9px] border border-[#173F35]/25 px-4 text-[13px] font-bold text-[#173F35] disabled:opacity-35"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        !membershipPagination?.totalPages ||
                        membershipPage >= membershipPagination.totalPages
                      }
                      onClick={() => setMembershipPage((value) => value + 1)}
                      className="focus-ring min-h-10 rounded-[9px] bg-[#173F35] px-4 text-[13px] font-bold text-[#F7F6F2] disabled:opacity-35"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#202421]/12 px-3 py-3 sm:gap-3 sm:px-7 sm:py-4">
                  <div>
                    <p className="text-[18px] font-extrabold text-[#173F35]">
                      Customer payments
                    </p>
                    <p className="mt-1 hidden text-[13px] text-[#202421]/70 sm:block">
                      Track Pro purchases and payment status.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-[13px] font-bold text-[#173F35]">
                    Status
                    <select
                      aria-label="Filter payments by status"
                      value={paymentStatus}
                      onChange={(event) => {
                        setPaymentStatus(event.target.value);
                        setPaymentPage(1);
                      }}
                      className="focus-ring h-10 rounded-[9px] border border-[#173F35]/25 bg-white px-3 text-[14px] font-semibold text-[#202421]"
                    >
                      <option value="all">All</option>
                      <option value="paid">Paid</option>
                      <option value="initiated">Started</option>
                      <option value="failed">Failed</option>
                    </select>
                  </label>
                </div>

                {payments.length === 0 ? (
                  <div className="flex items-center gap-3 px-3 py-4 sm:flex-row sm:items-center sm:gap-5 sm:px-8 sm:py-9">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#D7DDCF] text-[#173F35] sm:size-14">
                      <CreditCard size={26} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[16px] font-extrabold text-[#173F35] sm:text-[18px]">
                        No payments found
                      </p>
                      <p className="mt-1 hidden text-[14px] leading-6 text-[#202421]/75 sm:block">
                        {paymentStatus === "all"
                          ? "Customer Pro purchases will appear here."
                          : "No payments match this status."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sm:hidden">
                      {payments.map((payment, index) => (
                        <div
                          key={payment.id}
                          className={`px-4 py-4 ${
                            index ? "border-t border-[#202421]/10" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words text-[15px] font-extrabold text-[#202421]">
                                {payment.user?.name || "Customer"}
                              </p>
                              <p className="mt-1 text-[13px] text-[#202421]/75">
                                {payment.plan?.name ||
                                  payment.planCode ||
                                  "EPANTRY Pro"}
                              </p>
                            </div>
                            <strong className="shrink-0 text-[17px] tabular-nums text-[#173F35]">
                              {moneyFromMinor(payment.amountMinor)}
                            </strong>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                payment.status
                              )}`}
                            >
                              {readableStatus(payment.status)}
                            </span>
                            <span className="text-[13px] text-[#202421]/70">
                              {formatDate(
                                payment.paidAt || payment.initiatedAt
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="w-full min-w-[760px] text-left text-[14px]">
                        <thead className="border-b border-[#202421]/15 bg-[#D7DDCF]/55 text-[12px] font-extrabold text-[#173F35]">
                          <tr>
                            <th className="px-7 py-3.5">Customer</th>
                            <th className="px-4 py-3.5">Plan</th>
                            <th className="px-4 py-3.5">Amount</th>
                            <th className="px-4 py-3.5">Status</th>
                            <th className="px-4 py-3.5">Date</th>
                            <th className="px-7 py-3.5">Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment) => (
                            <tr
                              key={payment.id}
                              className="border-b border-[#202421]/10 last:border-b-0 hover:bg-[#D7DDCF]/25"
                            >
                              <td className="px-7 py-4">
                                <p className="font-extrabold text-[#202421]">
                                  {payment.user?.name || "Customer"}
                                </p>
                                <p className="mt-1 break-all text-[12px] text-[#202421]/60">
                                  {payment.user?.email || "—"}
                                </p>
                              </td>
                              <td className="px-4 py-4 font-semibold">
                                {payment.plan?.name ||
                                  payment.planCode ||
                                  "EPANTRY Pro"}
                              </td>
                              <td className="px-4 py-4 font-extrabold tabular-nums text-[#173F35]">
                                {moneyFromMinor(payment.amountMinor)}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-bold ${statusClasses(
                                    payment.status
                                  )}`}
                                >
                                  {readableStatus(payment.status)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                {formatDate(
                                  payment.paidAt || payment.initiatedAt
                                )}
                              </td>
                              <td className="max-w-[240px] truncate px-7 py-4 font-mono text-[12px]">
                                {payment.providerPaymentId ||
                                  payment.providerOrderId ||
                                  "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#202421]/15 px-4 py-4 sm:px-7 ${
                    !paymentPagination?.total ? "hidden sm:flex" : ""
                  }`}
                >
                  <span className="text-[13px] font-medium text-[#202421]/70">
                    {paymentPagination?.total || 0} transactions
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={paymentPage <= 1}
                      onClick={() =>
                        setPaymentPage((value) => Math.max(1, value - 1))
                      }
                      className="focus-ring min-h-10 rounded-[9px] border border-[#173F35]/25 px-4 text-[13px] font-bold text-[#173F35] disabled:opacity-35"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        !paymentPagination?.totalPages ||
                        paymentPage >= paymentPagination.totalPages
                      }
                      onClick={() => setPaymentPage((value) => value + 1)}
                      className="focus-ring min-h-10 rounded-[9px] bg-[#173F35] px-4 text-[13px] font-bold text-[#F7F6F2] disabled:opacity-35"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
