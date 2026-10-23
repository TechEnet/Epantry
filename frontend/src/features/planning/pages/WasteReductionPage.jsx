import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  getPlanningErrorMessage,
  getWasteReduction,
  listMealPlans,
} from "../services/planning.service";

/*
 * Waste Reduction — customer presentation only.
 * All numbers, signals, planned meals and recipe recommendations below
 * come from the existing /waste-reduction API, never from static samples.
 */
const HORIZON_OPTIONS = Object.freeze([3, 7, 14]);
const PRIORITY_LABELS = Object.freeze({
  use_now: "Use now",
  use_very_soon: "Use very soon",
  use_soon: "Use soon",
  attention: "Needs attention",
});

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatReason(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase();
}

function getRecipeMatchMessage(possibility) {
  switch (possibility?.reasonCode) {
    case "USE_SOON_RECIPE_MATCH_WITH_CONFIRMED_UNRESERVED_PLANNED_BALANCE":
      return "Uses an ingredient marked use soon, with an available quantity confirmed in your Pantry.";
    case "USE_SOON_RECIPE_MATCH_WITH_PROVEN_BASE_LINE_COVERAGE":
      return "Your saved Pantry quantities support the recipe’s base ingredients.";
    case "USE_SOON_RECIPE_IDENTITY_MATCH":
      return "Uses an ingredient you marked use soon. Check the other ingredients before cooking.";
    default:
      return "Suggested using your saved Pantry information. Check the recipe before cooking.";
  }
}

function getPantryEvidenceLabel(confidenceClass) {
  return confidenceClass === "high"
    ? "Based on saved Pantry details"
    : "Check your Pantry details";
}

function formatMealType(value) {
  const label = String(value || "")
    .replaceAll("_", " ")
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Meal";
}

function formatProvenQuantity(quantity) {
  if (quantity?.mode !== "exact" || !Number.isFinite(Number(quantity.value))) {
    return "Quantity not confirmed";
  }
  return `${quantity.value} ${quantity.unit || ""}`.trim();
}

function Heading({ label, title, description, count, trailing }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#173F35]/15 pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.04em] text-[#C56C42]">
          <span className="h-px w-6 bg-[#C56C42]" />
          {label}
        </p>
        <h2 className="mt-2 text-[25px] font-semibold leading-[1.2] tracking-[-0.035em] text-[#202421] sm:text-[29px]">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-[15px] leading-[1.65] text-[#202421]/75">
            {description}
          </p>
        )}
      </div>
      {(count !== undefined || trailing) && (
        <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
          {count !== undefined && (
            <span className="rounded-full border border-[#173F35]/20 bg-[#F7F6F2] px-3.5 py-2 text-[13px] font-semibold text-[#173F35] shadow-[0_2px_8px_rgba(23,63,53,0.04)]">
              {count} {count === 1 ? "item" : "items"}
            </span>
          )}
          {trailing}
        </div>
      )}
    </div>
  );
}

function ActionLink({ to, children, primary = false }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold transition-[background-color,transform] duration-200 motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C56C42] ${
        primary
          ? "bg-[#173F35] text-[#F7F6F2] hover:bg-[#285648]"
          : "border border-[#173F35]/20 bg-[#F7F6F2] text-[#173F35] hover:bg-[#D7DDCF]"
      }`}
    >
      {children}
      <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

function EmptyNote({ title, body, to, action }) {
  return (
    <div className="flex h-full min-h-[170px] flex-col justify-center rounded-xl border border-[#173F35]/10 border-l-[4px] border-l-[#C56C42] bg-[#F7F6F2] px-5 py-6 shadow-[0_8px_20px_rgba(23,63,53,0.035)] sm:px-7">
      <h3 className="text-[20px] font-semibold tracking-[-0.025em] text-[#173F35]">
        {title}
      </h3>
      <p className="mt-2 max-w-lg text-[14px] leading-[1.65] text-[#202421]/75 sm:text-[15px]">
        {body}
      </p>
      {to && (
        <div className="mt-4 self-start">
          <ActionLink to={to}>{action}</ActionLink>
        </div>
      )}
    </div>
  );
}

function PantryEntry({ signal, index }) {
  return (
    <article className="grid min-w-0 gap-2 border-b border-[#173F35]/15 px-4 py-3.5 transition-[background-color,box-shadow] sm:py-5 duration-200 hover:bg-[#D7DDCF]/60 hover:shadow-[inset_4px_0_0_#C56C42] focus-within:bg-[#D7DDCF]/60 focus-within:shadow-[inset_4px_0_0_#C56C42] last:border-b-0 sm:grid-cols-[38px_minmax(0,1fr)] sm:gap-4 sm:px-6">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#D7DDCF] text-[13px] font-semibold tabular-nums text-[#173F35]"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="min-w-0 text-[20px] font-semibold leading-[1.25] tracking-[-0.025em] text-[#202421]">
            {signal.ingredientName}
          </h3>
          <span className="inline-flex rounded-full border border-[#C56C42]/30 bg-[#C56C42]/10 px-2.5 py-1 text-[13px] font-semibold text-[#173F35]">
            {PRIORITY_LABELS[signal.priorityClass] || signal.priorityClass}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] leading-[1.5] text-[#202421]/80 sm:mt-3 sm:gap-y-2">
          <p>
            <span className="font-semibold text-[#173F35]">
              {signal.signalType === "use_soon"
                ? "Use-soon date:"
                : "Pantry status:"}
            </span>{" "}
            {signal.signalType === "use_soon"
              ? formatDate(signal.useSoonAt)
              : "Running low"}
          </p>
          <p>
            <span className="font-semibold text-[#173F35]">Quantity:</span>{" "}
            {formatProvenQuantity(signal.provenUnreservedQuantity)}
          </p>
        </div>
        {signal.plannedUseConflict && (
          <p className="mt-3 border-l-[3px] border-[#C56C42] bg-[#C56C42]/10 px-3 py-2.5 text-[13px] leading-[1.5] text-[#202421]">
            This item may be needed before its planned use. Review your Pantry
            dates.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 sm:mt-3 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium leading-[1.5] text-[#173F35]/80">
              {getPantryEvidenceLabel(signal.confidenceClass)}
            </p>
            <p className="mt-0.5 break-words text-[12px] leading-[1.5] text-[#202421]/65">
              Evidence: {formatReason(signal.reasonCode)}
            </p>
          </div>
          <Link
            to={`/pantry/items/${signal.pantryItemId}`}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg border border-[#173F35]/25 bg-white px-4 py-2 text-[13px] font-semibold text-[#173F35] transition-colors hover:bg-[#D7DDCF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
          >
            Review item <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function MealEntry({ entry, rescuesByMealId }) {
  const { plan, meal } = entry;
  const warning = meal ? rescuesByMealId.get(String(meal.id)) : null;
  const scheduledCount = (plan.meals || []).filter(
    (item) => item.status === "planned"
  ).length;
  return (
    <article className="border-b border-[#173F35]/15 px-4 py-3.5 transition-[background-color,box-shadow] sm:py-5 duration-200 hover:bg-[#D7DDCF]/55 hover:shadow-[inset_4px_0_0_#173F35] focus-within:bg-[#D7DDCF]/55 focus-within:shadow-[inset_4px_0_0_#173F35] last:border-b-0 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#173F35]">
            SAVED MEAL PLAN
          </p>
          <h3 className="mt-1 text-[19px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#202421]">
            {plan.title || "My Meal Plan"}
          </h3>
          <p className="mt-1 text-[12px] leading-[1.5] text-[#202421]/70">
            {formatDate(plan.horizonStart)} – {formatDate(plan.horizonEnd)}
          </p>
        </div>
        <span className="rounded-full bg-[#D7DDCF] px-3 py-1.5 text-[12px] font-semibold text-[#173F35]">
          {scheduledCount} scheduled
        </span>
      </div>
      {meal ? (
        <div className="mt-3 border-l-[3px] border-[#173F35] bg-[#F7F6F2] px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[#173F35]">
              {formatMealType(meal.mealType)} · {formatDate(meal.plannedAt)}
            </p>
            {Number.isFinite(Number(meal.servings)) && (
              <p className="text-[12px] text-[#202421]/75">
                {meal.servings}{" "}
                {Number(meal.servings) === 1 ? "serving" : "servings"}
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h4 className="min-w-0 flex-1 text-[16px] font-semibold leading-[1.4] text-[#202421]">
              {meal.recipeTitle || "Planned recipe"}
            </h4>
            {meal.recipeSlug && (
              <Link
                to={`/recipes/${encodeURIComponent(meal.recipeSlug)}`}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-[#173F35]/25 bg-white px-3 text-[13px] font-semibold text-[#173F35] hover:bg-[#D7DDCF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
              >
                Recipe <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 bg-[#F7F6F2] px-4 py-3">
          <p className="text-[14px] leading-[1.55] text-[#202421]/75">
            Plan saved. Add a recipe and cooking date to start scheduling.
          </p>
          <div className="mt-3">
            <ActionLink to="/meal-plan">Add a meal</ActionLink>
          </div>
        </div>
      )}
      {warning && (
        <div className="mt-3 border-l-[3px] border-[#C56C42] bg-[#C56C42]/10 px-4 py-3 text-[#202421]">
          <p className="text-[13px] font-semibold">
            Consider cooking this meal earlier
          </p>
          <p className="mt-1 text-[13px] leading-relaxed">
            {warning.affectedItems
              .map(
                (item) =>
                  `${item.ingredientName} (use soon ${formatDate(
                    item.useSoonAt
                  )})`
              )
              .join(", ")}
            . This is based on saved Pantry dates, not a verified expiry date.
          </p>
          <div className="mt-3">
            <ActionLink to="/meal-plan">Review timing</ActionLink>
          </div>
        </div>
      )}
    </article>
  );
}

export default function WasteReductionPage() {
  const location = useLocation();
  const [horizonDays, setHorizonDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openList, setOpenList] = useState(null);
  const closeListButtonRef = useRef(null);
  const pantryViewAllRef = useRef(null);
  const mealsViewAllRef = useRef(null);
  const [showAllPossibilities, setShowAllPossibilities] = useState(false);
  const [mealPlans, setMealPlans] = useState([]);
  const [mealPlansLoading, setMealPlansLoading] = useState(true);
  const [mealPlansError, setMealPlansError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setData(null);
    try {
      setData(await getWasteReduction({ horizonDays }));
    } catch (loadError) {
      setError(
        getPlanningErrorMessage(
          loadError,
          "Unable to load Waste Reduction right now."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [horizonDays]);

  const loadMealPlans = useCallback(async () => {
    setMealPlansLoading(true);
    setMealPlansError("");
    try {
      const response = await listMealPlans();
      setMealPlans(
        Array.isArray(response?.mealPlans) ? response.mealPlans : []
      );
    } catch (loadError) {
      setMealPlansError(
        getPlanningErrorMessage(
          loadError,
          "Unable to load your saved Meal Plans."
        )
      );
    } finally {
      setMealPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadMealPlans();
  }, [loadMealPlans]);

  const refreshAll = useCallback(() => {
    load();
    loadMealPlans();
  }, [load, loadMealPlans]);

  useEffect(() => {
    if (location.pathname === "/next-possibility" && !loading) {
      document.getElementById("next-possibility")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [location.pathname, loading]);

  const signals = data?.atRiskPantrySignals || [];
  const rescues = data?.plannedMealRescues || [];
  const possibilities = data?.nextPossibilities || [];
  const visibleSignals = signals.slice(0, 4);
  const visiblePossibilities = showAllPossibilities
    ? possibilities
    : possibilities.slice(0, 3);

  const savedMealCount = useMemo(
    () =>
      mealPlans.reduce(
        (total, plan) =>
          total +
          (plan.meals || []).filter((meal) => meal.status === "planned").length,
        0
      ),
    [mealPlans]
  );

  const groupedRescues = useMemo(() => {
    const groups = new Map();
    for (const rescue of rescues) {
      const groupKey =
        rescue.plannedMealId ||
        `${rescue.recipeVersionId || rescue.recipeTitle}:${rescue.plannedAt}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          plannedMealId: rescue.plannedMealId,
          mealPlanId: rescue.mealPlanId,
          recipeVersionId: rescue.recipeVersionId,
          recipeSlug: rescue.recipeSlug,
          recipeTitle: rescue.recipeTitle,
          plannedAt: rescue.plannedAt,
          mealType: rescue.mealType,
          servings: rescue.servings,
          confidenceClass: rescue.confidenceClass,
          affectedItems: [],
        });
      }
      const group = groups.get(groupKey);
      if (
        !group.affectedItems.some(
          (item) => item.pantryItemId === rescue.pantryItemId
        )
      ) {
        group.affectedItems.push({
          pantryItemId: rescue.pantryItemId,
          ingredientName: rescue.ingredientName,
          useSoonAt: rescue.useSoonAt,
          confidenceClass: rescue.confidenceClass,
        });
      }
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      affectedItems: [...group.affectedItems].sort(
        (left, right) =>
          new Date(left.useSoonAt).getTime() -
            new Date(right.useSoonAt).getTime() ||
          String(left.ingredientName || "").localeCompare(
            String(right.ingredientName || "")
          )
      ),
    }));
  }, [rescues]);

  const rescuesByMealId = useMemo(
    () =>
      new Map(
        groupedRescues
          .filter((rescue) => rescue.plannedMealId)
          .map((rescue) => [String(rescue.plannedMealId), rescue])
      ),
    [groupedRescues]
  );

  // Keep the page compact: each scheduled meal counts as one item, even when
  // several meals belong to the same saved plan. Empty plans remain visible.
  const mealEntries = useMemo(
    () =>
      mealPlans.flatMap((plan) => {
        const scheduled = (plan.meals || []).filter(
          (meal) => meal.status === "planned"
        );
        return scheduled.length
          ? scheduled.map((meal) => ({
              key: `${plan.id}:${meal.id}`,
              plan,
              meal,
            }))
          : [{ key: `${plan.id}:empty`, plan, meal: null }];
      }),
    [mealPlans]
  );
  const visibleMealEntries = mealEntries.slice(0, 4);

  useEffect(() => {
    if (!openList) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeListButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenList(null);
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.getElementById("waste-list-dialog");
      if (!dialog) return;
      const focusable = [
        ...dialog.querySelectorAll(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      (openList === "pantry"
        ? pantryViewAllRef
        : mealsViewAllRef
      ).current?.focus();
    };
  }, [openList]);

  const overview = [
    {
      label: "Needs a closer look",
      value: data?.summary?.totalAtRiskSignals ?? 0,
    },
    { label: "Use-soon signals", value: data?.summary?.useSoonSignals ?? 0 },
    {
      label: "Meals in your plans",
      value: savedMealCount,
      waiting: mealPlansLoading && !mealPlans.length,
    },
    {
      label: "Recipes to consider",
      value: data?.summary?.nextPossibilities ?? 0,
    },
  ];

  return (
    <main className="min-h-screen bg-[#F7F6F2] text-[#202421]">
      <div className="w-full min-w-0 px-0 pb-5 pt-0 sm:px-6 sm:pb-12 sm:pt-6 xl:px-9">
        {/* The opening is a purposeful editorial split — not a fixed-height hero. */}
        <section
          className="grid min-w-0 overflow-hidden rounded-none border-y border-[#173F35]/10 shadow-none sm:rounded-[18px] sm:border sm:shadow-[0_18px_45px_rgba(23,63,53,0.10)] lg:grid-cols-[minmax(0,1.35fr)_minmax(335px,0.65fr)]"
          aria-labelledby="waste-page-heading"
        >
          <div className="relative flex flex-col justify-between bg-[#173F35] px-4 py-5 text-[#F7F6F2] sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold text-[#D7DDCF] sm:gap-2.5 sm:text-[13px]">
                <span className="h-[2px] w-7 bg-[#C56C42]" />
                YOUR KITCHEN, LESS WASTE
              </p>
              <h1
                id="waste-page-heading"
                className="mt-2 max-w-[680px] text-[28px] font-semibold leading-[1.12] tracking-[-0.042em] sm:mt-5 sm:text-[48px] sm:leading-[1.08] sm:tracking-[-0.047em] lg:text-[54px]"
              >
                <span className="sm:hidden">
                  Use more. <span className="text-[#D7DDCF]">Waste less.</span>
                </span>
                <span className="hidden sm:inline">Use what you have.</span>
                <span className="hidden text-[#D7DDCF] sm:block">
                  Waste a little less.
                </span>
              </h1>
              <p className="mt-2 max-w-[600px] text-[13px] leading-[1.45] text-[#F7F6F2]/85 sm:mt-5 sm:text-[16px] sm:leading-[1.7]">
                <span className="sm:hidden">
                  Check ingredients, meals and recipes in one place.
                </span>
                <span className="hidden sm:inline">
                  See which ingredients need attention, review your planned
                  meals, and discover recipes that fit your Pantry.
                </span>
              </p>
            </div>
            <div className="mt-4 flex flex-nowrap gap-2 border-t border-[#F7F6F2]/20 pt-3 sm:mt-9 sm:flex-wrap sm:gap-3 sm:pt-6">
              <Link
                to="/pantry"
                className="inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#F7F6F2] px-3 py-2 text-[12px] font-semibold text-[#173F35] transition hover:bg-[#D7DDCF] sm:min-h-[44px] sm:gap-2 sm:px-5 sm:py-3 sm:text-[14px]"
              >
                Review my Pantry <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                to="/meal-plan"
                className="inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-lg border border-white/35 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/10 sm:min-h-[44px] sm:gap-2 sm:px-5 sm:py-3 sm:text-[14px]"
              >
                See Meal Plan <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between border-t-[3px] border-[#C56C42] bg-[#D7DDCF] px-4 py-4 sm:border-t-[4px] sm:px-9 sm:py-9 lg:border-t-0 lg:border-l-[4px] lg:px-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold text-[#173F35]">
                  Your review window
                </p>
                <p className="mt-1 text-[23px] font-semibold tracking-[-0.04em] text-[#202421] sm:mt-2 sm:text-[29px]">
                  Next {horizonDays} days
                </p>
                <p className="mt-1 text-[13px] leading-[1.45] text-[#202421]/70 sm:mt-2 sm:text-[14px] sm:leading-[1.55]">
                  <span className="sm:hidden">
                    Check upcoming Pantry use-soon dates.
                  </span>
                  <span className="hidden sm:inline">
                    Choose how far ahead to check the use-soon information saved
                    in your household.
                  </span>
                </p>
              </div>
              <CalendarClock
                className="mt-1 shrink-0 text-[#173F35]"
                size={25}
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 sm:mt-7">
              <div
                className="grid grid-cols-3 gap-2"
                role="group"
                aria-label="Review window"
              >
                {HORIZON_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={horizonDays === option}
                    onClick={() => setHorizonDays(option)}
                    className={`min-h-[40px] rounded-md border px-2 py-2 text-[13px] font-semibold transition sm:min-h-[45px] sm:px-3 sm:text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C56C42] ${
                      horizonDays === option
                        ? "border-[#173F35] bg-[#173F35] text-white"
                        : "border-[#173F35]/20 bg-[#F7F6F2]/65 text-[#173F35] hover:bg-white"
                    }`}
                  >
                    {option} days
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#173F35]/20 pt-2 sm:mt-4 sm:pt-4">
                <p className="max-w-[245px] text-[11px] leading-[1.4] text-[#202421]/75 sm:text-[12px] sm:leading-[1.5]">
                  “Use soon” is guidance, not a verified expiry date.
                </p>
                <button
                  type="button"
                  onClick={refreshAll}
                  disabled={loading || mealPlansLoading}
                  aria-label="Refresh Pantry review and Meal Plans"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#173F35]/25 text-[#173F35] transition hover:bg-white disabled:opacity-50"
                >
                  <RefreshCw
                    size={18}
                    className={
                      loading || mealPlansLoading ? "animate-spin" : ""
                    }
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Single connected statistic strip; these are API values. */}
        <section
          className="mt-2 grid grid-cols-2 gap-y-3 border-y border-[#173F35]/12 bg-white/85 px-2 py-4 shadow-none sm:mt-5 sm:gap-y-0 sm:rounded-xl sm:border sm:px-7 sm:py-7 sm:shadow-[0_6px_22px_rgba(23,63,53,0.035)] sm:grid-cols-4"
          aria-label="Waste reduction summary"
        >
          {overview.map((item, index) => (
            <div
              key={item.label}
              className={`min-w-0 px-3 sm:px-6 ${
                index > 0 ? "sm:border-l sm:border-[#173F35]/15" : ""
              } ${
                index % 2 === 1
                  ? "border-l border-[#173F35]/15 sm:border-l"
                  : ""
              }`}
            >
              <p className="text-[27px] font-semibold leading-none tracking-[-0.045em] text-[#173F35] sm:text-[38px]">
                {item.waiting ||
                (loading && !data && item.label !== "Meals in your plans")
                  ? "—"
                  : item.value}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-[1.4] text-[#202421]/75 sm:mt-2 sm:text-[14px]">
                {item.label}
              </p>
            </div>
          ))}
        </section>

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 border-l-4 border-[#C56C42] bg-[#C56C42]/10 p-4 text-[14px] text-[#202421]"
          >
            <TriangleAlert
              className="mt-0.5 shrink-0 text-[#C56C42]"
              size={19}
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-semibold">
                We couldn't refresh your Pantry review.
              </p>
              <p className="mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={load}
              className="shrink-0 underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !data && (
          <div
            role="status"
            className="mt-5 flex items-center gap-3 bg-[#D7DDCF]/50 px-5 py-4 text-[14px] text-[#173F35]"
          >
            <RefreshCw size={18} className="animate-spin" aria-hidden="true" />{" "}
            Checking your current Pantry evidence…
          </div>
        )}

        {/* Compact, independently scannable Pantry and Meal Planning summaries. */}
        <div
          className={`mt-4 grid items-start gap-3 sm:mt-9 sm:gap-6 lg:grid-cols-2 xl:gap-7 ${
            loading ? "opacity-80" : ""
          }`}
        >
          <section
            className="min-w-0 overflow-hidden border-y border-[#173F35]/15 bg-[#F7F6F2] shadow-none sm:rounded-[18px] sm:border sm:shadow-[0_12px_34px_rgba(23,63,53,0.07)]"
            aria-labelledby="waste-pantry-title"
          >
            <div className="relative border-b border-[#173F35]/15 bg-[#D7DDCF]/70 px-4 py-4 sm:px-7 sm:py-6">
              <div
                className="absolute inset-y-0 left-0 w-[5px] bg-[#C56C42]"
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#173F35]">
                  01 / YOUR PANTRY
                </p>
                <span className="rounded-full border border-[#173F35]/20 bg-[#F7F6F2] px-3 py-1.5 text-[13px] font-semibold text-[#173F35]">
                  {signals.length} {signals.length === 1 ? "item" : "items"}
                </span>
              </div>
              <h2
                id="waste-pantry-title"
                className="mt-1.5 text-[23px] font-semibold leading-[1.2] tracking-[-0.035em] text-[#202421] sm:mt-2 sm:text-[29px]"
              >
                Use first, waste less.
              </h2>
              <p className="mt-1 text-[13px] leading-[1.45] text-[#202421]/75 sm:mt-2 sm:text-[15px] sm:leading-[1.6]">
                A clear look at ingredients that need your attention.
              </p>
            </div>
            <div className="bg-white/90">
              {!loading && !!data && signals.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyNote
                    title="Nothing urgent to review"
                    body="Your saved Pantry evidence does not currently justify a use-soon or running-low alert for this window."
                    to="/pantry"
                    action="Open Pantry"
                  />
                </div>
              ) : (
                visibleSignals.map((signal, index) => (
                  <PantryEntry
                    key={signal.signalKey}
                    signal={signal}
                    index={index}
                  />
                ))
              )}
            </div>
            {signals.length > 4 && (
              <div className="border-t border-[#173F35]/15 bg-[#F7F6F2] px-5 py-4 sm:px-6">
                <button
                  ref={pantryViewAllRef}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpenList("pantry")}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#173F35] bg-[#173F35] px-5 py-2.5 text-[14px] font-semibold text-[#F7F6F2] transition-colors hover:bg-[#285648] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
                >
                  View all {signals.length} Pantry items{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>

          <section
            className="min-w-0 overflow-hidden border-y border-[#173F35]/15 bg-white shadow-none sm:rounded-[18px] sm:border sm:shadow-[0_12px_34px_rgba(23,63,53,0.07)]"
            aria-labelledby="waste-meal-title"
          >
            <div className="border-b-[3px] border-[#C56C42] bg-[#173F35] px-4 py-4 text-[#F7F6F2] sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#D7DDCF]">
                  02 / MEAL PLANNING
                </p>
                <span className="rounded-full border border-[#F7F6F2]/30 px-3 py-1.5 text-[13px] font-semibold text-[#F7F6F2]">
                  {savedMealCount} {savedMealCount === 1 ? "meal" : "meals"}
                </span>
              </div>
              <h2
                id="waste-meal-title"
                className="mt-1.5 text-[23px] font-semibold leading-[1.2] tracking-[-0.035em] sm:mt-2 sm:text-[29px]"
              >
                Meals on the calendar.
              </h2>
              <p className="mt-1 text-[13px] leading-[1.45] text-[#F7F6F2]/85 sm:mt-2 sm:text-[15px] sm:leading-[1.6]">
                Your saved plans, upcoming meals and ingredient timing
                reminders.
              </p>
              <div className="mt-2 sm:mt-4">
                <ActionLink to="/meal-plan">Manage plan</ActionLink>
              </div>
            </div>
            <div className="bg-white/95">
              {mealPlansLoading && (
                <div
                  role="status"
                  className="flex items-center gap-2 px-5 py-6 text-[14px] text-[#173F35]"
                >
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                    aria-hidden="true"
                  />{" "}
                  Loading your saved Meal Plans…
                </div>
              )}
              {mealPlansError && !mealPlansLoading && (
                <div
                  role="alert"
                  className="m-4 border-l-4 border-[#C56C42] bg-[#F7F6F2] p-5"
                >
                  <p className="text-[15px] font-semibold text-[#202421]">
                    Your Meal Plans could not be loaded.
                  </p>
                  <p className="mt-1 text-[14px] text-[#202421]/70">
                    {mealPlansError}
                  </p>
                  <button
                    type="button"
                    onClick={loadMealPlans}
                    className="mt-3 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#173F35] px-4 py-2 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
                  >
                    <RefreshCw size={15} aria-hidden="true" /> Try again
                  </button>
                </div>
              )}
              {!mealPlansLoading &&
                !mealPlansError &&
                mealPlans.length === 0 && (
                  <div className="p-4 sm:p-6">
                    <EmptyNote
                      title="No saved Meal Plans yet"
                      body="Create a Meal Plan to see it here. After you add meals, their dates and recipes will appear as well."
                      to="/meal-plan"
                      action="Create Meal Plan"
                    />
                  </div>
                )}
              {!mealPlansLoading && !mealPlansError && mealPlans.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#173F35]/15 bg-[#D7DDCF]/40 px-4 py-3 text-[13px] text-[#173F35] sm:px-6">
                    <span className="font-semibold">
                      {mealPlans.length} saved{" "}
                      {mealPlans.length === 1 ? "plan" : "plans"}
                    </span>
                    <span>
                      {groupedRescues.length > 0
                        ? `${groupedRescues.length} timing ${
                            groupedRescues.length === 1
                              ? "reminder"
                              : "reminders"
                          }`
                        : "No ingredient timing warnings"}
                    </span>
                  </div>
                  {visibleMealEntries.map((entry) => (
                    <MealEntry
                      key={entry.key}
                      entry={entry}
                      rescuesByMealId={rescuesByMealId}
                    />
                  ))}
                </>
              )}
            </div>
            {!mealPlansLoading && !mealPlansError && mealEntries.length > 4 && (
              <div className="border-t border-[#173F35]/15 bg-[#F7F6F2] px-5 py-4 sm:px-6">
                <button
                  ref={mealsViewAllRef}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpenList("meals")}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-[#173F35]/25 bg-[#D7DDCF] px-5 py-2.5 text-[14px] font-semibold text-[#173F35] transition-colors hover:bg-[#173F35] hover:text-[#F7F6F2] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
                >
                  View all {mealEntries.length} Meal Planning items{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Recipes: preserve published source images, reasons and ingredient provenance. */}
        <section
          id="next-possibility"
          className="mt-5 scroll-mt-24 border-t-[3px] border-[#173F35] px-4 pt-5 sm:mt-12 sm:px-0 sm:pt-10"
          aria-label="Recipes you could make"
        >
          <div className="grid gap-3 sm:gap-6 lg:grid-cols-[minmax(215px,0.27fr)_minmax(0,0.73fr)] lg:gap-9">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold text-[#C56C42]">
                <span className="h-px w-6 bg-[#C56C42]" />
                03 / FROM PANTRY TO PLATE
              </p>
              <h2 className="mt-2 max-w-[390px] text-[24px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#202421] sm:mt-3 sm:text-[34px]">
                What could you cook next?
              </h2>
              <p className="mt-2 max-w-sm text-[13px] leading-[1.45] text-[#202421]/70 sm:mt-3 sm:text-[15px] sm:leading-[1.65]">
                <span className="sm:hidden">
                  Pantry recipe ideas. Check ingredients and allergens.
                </span>
                <span className="hidden sm:inline">
                  These are published recipes suggested using the available
                  use-soon evidence. Confirm ingredients and allergens before
                  cooking.
                </span>
              </p>
              <div className="mt-2 inline-flex items-center gap-2 border-t border-[#173F35]/20 pt-2 text-[13px] font-semibold text-[#173F35] sm:mt-5 sm:pt-4">
                <Check size={16} aria-hidden="true" /> {possibilities.length}{" "}
                {possibilities.length === 1 ? "recipe" : "recipes"} to explore
              </div>
            </div>

            <div className="min-w-0">
              {!loading && !!data && possibilities.length === 0 ? (
                <EmptyNote
                  title="No supported recipe match yet"
                  body="As Pantry use-soon evidence becomes available, matching published recipes can appear here. Nothing is invented to fill this space."
                  to="/recipes"
                  action="Explore all recipes"
                />
              ) : (
                <div
                  id="waste-recipe-grid"
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {visiblePossibilities.map((possibility) => (
                    <article
                      key={possibility.possibilityKey}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#173F35]/12 bg-white shadow-[0_8px_24px_rgba(23,63,53,0.065)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_16px_32px_rgba(23,63,53,0.13)] motion-safe:hover:-translate-y-1"
                    >
                      {possibility.heroImageUrl ? (
                        <div className="relative aspect-[16/7] overflow-hidden bg-[#D7DDCF] sm:aspect-[16/10]">
                          <img
                            src={possibility.heroImageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
                          />
                        </div>
                      ) : (
                        <div className="flex aspect-[16/7] items-end bg-[#D7DDCF] p-4 sm:aspect-[16/10] sm:p-5">
                          <span className="max-w-[230px] text-[21px] font-semibold leading-[1.25] text-[#173F35]">
                            {possibility.recipeTitle}
                          </span>
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-3 sm:p-5">
                        <p className="text-[12px] font-semibold text-[#C56C42]">
                          SUGGESTED FROM YOUR PANTRY
                        </p>
                        <h3 className="mt-2 text-[19px] font-semibold leading-[1.3] tracking-[-0.025em] text-[#202421] sm:text-[20px]">
                          {possibility.recipeTitle}
                        </h3>
                        <p className="mt-2 text-[13px] leading-[1.55] text-[#202421]/70">
                          {getRecipeMatchMessage(possibility)}
                        </p>
                        <div className="mt-2 flex-1 space-y-1 border-t border-[#173F35]/15 pt-2 sm:mt-4 sm:space-y-2 sm:pt-3">
                          {(possibility.matchedIngredients || []).map(
                            (match) => (
                              <div
                                key={`${possibility.possibilityKey}:${match.pantryItemId}`}
                                className="text-[12px] leading-[1.55] text-[#202421]/75"
                              >
                                <span className="font-semibold text-[#173F35]">
                                  {match.ingredientName}
                                </span>
                                {" · "}Use soon {formatDate(match.useSoonAt)}
                                {" · "}
                                {formatProvenQuantity(
                                  match.provenUnreservedQuantity
                                )}
                              </div>
                            )
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 sm:mt-5">
                          <ActionLink
                            to={`/recipes/${possibility.recipeSlug}`}
                            primary
                          >
                            Open recipe
                          </ActionLink>
                          {possibility.matchedIngredients?.[0]
                            ?.pantryItemId && (
                            <Link
                              to={`/pantry/items/${possibility.matchedIngredients[0].pantryItemId}`}
                              className="inline-flex min-h-[42px] items-center rounded-lg border border-[#173F35]/20 px-3 text-[12px] font-semibold text-[#173F35] hover:bg-[#D7DDCF]"
                            >
                              Correct evidence
                            </Link>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {possibilities.length > 3 && (
                <div className="mt-3 flex justify-center sm:mt-6 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAllPossibilities((value) => !value)}
                    aria-expanded={showAllPossibilities}
                    aria-controls="waste-recipe-grid"
                    className="group inline-flex min-h-[48px] items-center justify-center gap-3 rounded-lg border-2 border-[#173F35] bg-[#173F35] px-6 py-3 text-[15px] font-semibold text-[#F7F6F2] shadow-[0_8px_20px_rgba(23,63,53,0.15)] transition-[background-color,transform,box-shadow] hover:bg-[#285648] hover:shadow-[0_12px_25px_rgba(23,63,53,0.22)] motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#C56C42]"
                  >
                    {showAllPossibilities
                      ? "Show fewer recipes"
                      : `View all ${possibilities.length} recipes`}
                    <ArrowRight
                      size={18}
                      className={`transition-transform ${
                        showAllPossibilities
                          ? "-rotate-90"
                          : "group-hover:translate-x-1"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Practical provenance and next actions, not a decorative filler panel. */}
        <section
          className="mt-5 grid overflow-hidden border-y border-[#173F35]/15 shadow-none sm:mt-12 sm:rounded-[16px] sm:border sm:shadow-[0_10px_27px_rgba(23,63,53,0.05)] lg:grid-cols-2"
          aria-label="Evidence and corrections"
        >
          <div className="bg-[#D7DDCF]/65 px-4 py-4 sm:px-8 sm:py-8">
            <div className="flex items-center gap-3 text-[#173F35]">
              <ShieldCheck size={20} aria-hidden="true" />
              <p className="text-[13px] font-semibold">GOOD TO KNOW</p>
            </div>
            <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.03em] text-[#202421] sm:mt-3 sm:text-[22px]">
              Your evidence comes first.
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-[1.45] text-[#202421]/75 sm:mt-2 sm:text-[14px] sm:leading-[1.65]">
              <span className="sm:hidden">
                Use-soon is guidance, not an expiry date. Quantities must be
                confirmed.
              </span>
              <span className="hidden sm:inline">
                Use-soon suggestions are household guidance, not verified expiry
                dates or spoilage claims. Quantities are only described as
                confirmed when the supporting evidence exists.
              </span>
            </p>
          </div>
          <div className="bg-[#173F35] px-4 py-4 text-white sm:px-8 sm:py-8">
            <div className="flex items-center gap-3 text-[#D7DDCF]">
              <PackageCheck size={20} aria-hidden="true" />
              <p className="text-[13px] font-semibold">MAKE IT ACCURATE</p>
            </div>
            <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.03em] sm:mt-3 sm:text-[22px]">
              Something look wrong?
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-[1.45] text-white/80 sm:mt-2 sm:text-[14px] sm:leading-[1.65]">
              <span className="sm:hidden">
                Fix Pantry or Next Basket details. Orders, payments and plans
                stay unchanged.
              </span>
              <span className="hidden sm:inline">
                Correct saved household information in Living Pantry, or update
                your Next Basket preferences. These suggestions never change
                Orders, Payments or Meal Plans automatically.
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-5 sm:gap-3">
              <Link
                to="/pantry"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#F7F6F2] px-4 py-2.5 text-[13px] font-semibold text-[#173F35] hover:bg-[#D7DDCF]"
              >
                Open Pantry <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link
                to="/next-basket"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-white/40 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10"
              >
                Next Basket feedback <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {data?.scanPolicy?.pantry?.truncated && (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 border-l-4 border-[#C56C42] bg-[#C56C42]/10 p-4 text-[13px] leading-[1.6] text-[#202421]"
          >
            <TriangleAlert
              size={18}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Pantry evidence scan reached its bounded limit. Suggestions are
            based only on the evidence actually scanned; missing items have not
            been inferred.
          </div>
        )}
        {openList && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center px-3 py-5 sm:px-6"
            role="presentation"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close full list"
              onClick={() => setOpenList(null)}
              className="absolute inset-0 h-full w-full bg-[#202421]/65 backdrop-blur-[3px]"
            />
            <section
              id="waste-list-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="waste-dialog-title"
              className="relative z-10 flex max-h-[min(85svh,830px)] w-full max-w-[820px] flex-col overflow-hidden rounded-[18px] border border-[#173F35]/15 bg-[#F7F6F2] shadow-[0_30px_90px_rgba(0,0,0,0.28)]"
            >
              <header className="flex shrink-0 items-start justify-between gap-4 bg-[#173F35] px-5 py-5 text-[#F7F6F2] sm:px-7">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#D7DDCF]">
                    {openList === "pantry"
                      ? "01 / YOUR PANTRY"
                      : "02 / MEAL PLANNING"}
                  </p>
                  <h2
                    id="waste-dialog-title"
                    className="mt-1 text-[23px] font-semibold leading-[1.25] sm:text-[27px]"
                  >
                    {openList === "pantry"
                      ? "All Pantry reminders"
                      : "All saved meals and plans"}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#F7F6F2]/80">
                    {openList === "pantry"
                      ? `${signals.length} Pantry ${
                          signals.length === 1 ? "item" : "items"
                        }`
                      : `${mealEntries.length} Meal Planning ${
                          mealEntries.length === 1 ? "item" : "items"
                        }`}
                  </p>
                </div>
                <button
                  ref={closeListButtonRef}
                  type="button"
                  aria-label="Close full list"
                  onClick={() => setOpenList(null)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/35 text-white transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              </header>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white"
                tabIndex={0}
              >
                {openList === "pantry"
                  ? signals.map((signal, index) => (
                      <PantryEntry
                        key={signal.signalKey}
                        signal={signal}
                        index={index}
                      />
                    ))
                  : mealEntries.map((entry) => (
                      <MealEntry
                        key={entry.key}
                        entry={entry}
                        rescuesByMealId={rescuesByMealId}
                      />
                    ))}
              </div>
              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#173F35]/15 bg-[#F7F6F2] px-5 py-3 sm:px-7">
                <p className="text-[12px] text-[#202421]/65">
                  All entries are from your saved EPANTRY information.
                </p>
                <button
                  type="button"
                  onClick={() => setOpenList(null)}
                  className="inline-flex min-h-[42px] shrink-0 items-center rounded-lg border border-[#173F35]/25 px-4 text-[13px] font-semibold text-[#173F35] hover:bg-[#D7DDCF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#C56C42]"
                >
                  Close
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
