import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UsersRound,
  X,
} from "lucide-react";

import { Link } from "react-router-dom";

import {
  addPlannedMeal,
  createMealPlan,
  deleteMealPlan,
  getPlanningErrorMessage,
  listMealPlans,
  updatePlannedMeal,
} from "../services/planning.service";

import { listPublicRecipes } from "../../recipes/services/recipe.service";

const READINESS_LABELS = {
  enough: "Enough",

  likely_enough: "Likely enough",

  running_low_before_meal: "Running low",

  expected_depleted: "Expected depleted",

  missing: "Missing",

  needs_confirmation: "Needs confirmation",
};

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultPlanDates() {
  const start = new Date();

  const end = new Date();

  end.setDate(end.getDate() + 7);

  return {
    start: isoDate(start),

    end: isoDate(end),
  };
}

function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",

    month: "short",

    year: "numeric",
  }).format(new Date(value));
}

function titleCase(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function MealPlanPage() {
  const defaults = useMemo(defaultPlanDates, []);

  const [mealPlans, setMealPlans] = useState([]);

  const [selectedPlanId, setSelectedPlanId] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const [planPendingDelete, setPlanPendingDelete] = useState(null);

  const [error, setError] = useState("");

  const [recipeOptions, setRecipeOptions] = useState([]);

  const [recipeOptionsLoading, setRecipeOptionsLoading] = useState(true);

  const [recipeOptionsError, setRecipeOptionsError] = useState("");

  const [planForm, setPlanForm] = useState({
    title: "This Week",

    horizonStart: defaults.start,

    horizonEnd: defaults.end,
  });

  const [mealForm, setMealForm] = useState({
    recipeSlug: "",

    plannedAt: "",

    mealType: "dinner",

    servings: 2,
  });

  // These overlays only reveal existing saved data; no plan or meal is duplicated.
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [activeMealId, setActiveMealId] = useState("");
  const [scrollRequest, setScrollRequest] = useState(null);
  const scheduleRef = useRef(null);
  const mealRowRefs = useRef(new Map());
  const popupCloseRef = useRef(null);

  const selectedPlan = useMemo(
    () =>
      mealPlans.find((plan) => plan.id === selectedPlanId) ||
      mealPlans[0] ||
      null,
    [mealPlans, selectedPlanId]
  );

  const savedPlansPreview = mealPlans.slice(0, 4);
  const selectedMeals = selectedPlan?.meals || [];
  const selectedMealsPreview = selectedMeals.slice(0, 4);

  // Called only on intentional selection, never when plans load in the background.
  // A request ID ensures re-selecting the same plan still scrolls correctly.
  function openPlanInSchedule(planId, mealId = "") {
    if (!planId) return;
    setSelectedPlanId(planId);
    setActiveMealId(mealId ? String(mealId) : "");
    setShowAllPlans(false);
    setShowAllMeals(false);
    setScrollRequest({
      planId,
      mealId: mealId ? String(mealId) : "",
      at: Date.now(),
    });
  }

  useEffect(() => {
    if (!scrollRequest || selectedPlan?.id !== scrollRequest.planId)
      return undefined;
    const frame = window.requestAnimationFrame(() => {
      const mealRow = scrollRequest.mealId
        ? mealRowRefs.current.get(scrollRequest.mealId)
        : null;
      const destination = mealRow || scheduleRef.current;
      if (!destination) return;
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      )?.matches;
      destination.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      // Give keyboard and screen-reader users the same context as pointer users.
      destination.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollRequest, selectedPlan?.id]);

  useEffect(() => {
    if (!showAllPlans && !showAllMeals) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowAllPlans(false);
        setShowAllMeals(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() =>
      popupCloseRef.current?.focus()
    );
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [showAllPlans, showAllMeals]);

  const load = useCallback(async () => {
    setLoading(true);

    setError("");

    try {
      const result = await listMealPlans();

      const rows = result?.mealPlans || [];

      setMealPlans(rows);

      setSelectedPlanId((current) =>
        rows.some((row) => row.id === current) ? current : rows[0]?.id || ""
      );
    } catch (loadError) {
      setError(
        getPlanningErrorMessage(loadError, "Unable to load your Meal Plan.")
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;

    async function loadPublishedRecipes() {
      setRecipeOptionsLoading(true);

      setRecipeOptionsError("");

      try {
        const result = await listPublicRecipes({
          page: 1,

          limit: 50,
        });

        if (!active) {
          return;
        }

        setRecipeOptions(Array.isArray(result?.recipes) ? result.recipes : []);
      } catch (recipeLoadError) {
        if (!active) {
          return;
        }

        setRecipeOptionsError(
          recipeLoadError?.response?.data?.message ||
            recipeLoadError?.message ||
            "Unable to load published recipes."
        );

        setRecipeOptions([]);
      } finally {
        if (active) {
          setRecipeOptionsLoading(false);
        }
      }
    }

    loadPublishedRecipes();

    return () => {
      active = false;
    };
  }, []);

  async function handleCreatePlan(event) {
    event.preventDefault();

    setSaving(true);

    setError("");

    try {
      const result = await createMealPlan({
        title: planForm.title,

        horizonStart: new Date(
          `${planForm.horizonStart}T00:00:00`
        ).toISOString(),

        horizonEnd: new Date(`${planForm.horizonEnd}T23:59:59`).toISOString(),
      });

      setSelectedPlanId(result?.mealPlan?.id || "");

      await load();
    } catch (saveError) {
      setError(getPlanningErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMeal(event) {
    event.preventDefault();

    if (!selectedPlan?.id) {
      return;
    }

    setSaving(true);

    setError("");

    try {
      await addPlannedMeal({
        mealPlanId: selectedPlan.id,

        recipeSlug: mealForm.recipeSlug,

        plannedAt: new Date(mealForm.plannedAt).toISOString(),

        mealType: mealForm.mealType,

        servings: Number(mealForm.servings),

        priority: 3,
      });

      setMealForm((current) => ({
        ...current,

        recipeSlug: "",
      }));

      await load();
    } catch (saveError) {
      setError(getPlanningErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function changeMeal({ mealId, changes }) {
    setSaving(true);

    setError("");

    try {
      await updatePlannedMeal({
        plannedMealId: mealId,

        changes,
      });

      await load();
    } catch (saveError) {
      setError(getPlanningErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan() {
    if (!planPendingDelete?.id) {
      return;
    }

    setDeleting(true);

    setError("");

    try {
      await deleteMealPlan({
        mealPlanId: planPendingDelete.id,
      });

      setPlanPendingDelete(null);

      await load();
    } catch (deleteError) {
      setError(
        getPlanningErrorMessage(deleteError, "Unable to delete this Meal Plan.")
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mpx-page">
      <style>{`
.mpx-page{--p:#F7F6F2;--f:#173F35;--c:#202421;--s:#D7DDCF;--a:#C56C42;--line:rgba(23,63,53,.18);--muted:#546159;min-height:100vh;width:100%;background:var(--p);color:var(--c);font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif;font-size:16px;line-height:1.55}
.mpx-page *,.mpx-page *::before,.mpx-page *::after{box-sizing:border-box}
.mpx-page :is(h1,h2,h3,p){margin:0}.mpx-page :is(button,input,select){font:inherit}.mpx-page button{cursor:pointer}
.mpx-frame{width:100%;padding:clamp(18px,2.3vw,32px) clamp(16px,2.5vw,38px) 36px}
.mpx-eyebrow{display:flex;align-items:center;gap:10px;color:var(--f);font-size:13px;font-weight:700;letter-spacing:.055em;line-height:1.4}
.mpx-eyebrow::before{content:'';display:block;flex:0 0 22px;width:22px;height:2px;background:var(--a)}
.mpx-intro{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(265px,.75fr);align-items:stretch;gap:26px;margin:0 0 25px}
.mpx-intro-copy{padding:16px 0 16px 2px;display:flex;flex-direction:column;justify-content:center}
.mpx-intro h1{max-width:790px;font-size:clamp(36px,4.1vw,58px);font-weight:650;line-height:1.08;letter-spacing:-.052em;margin:14px 0 14px;color:var(--c)}
.mpx-intro h1 span{color:var(--f)}.mpx-intro-copy>p:last-child{font-size:16px;color:var(--muted);max-width:680px;line-height:1.65}
.mpx-next{display:flex;flex-direction:column;justify-content:space-between;gap:18px;background:var(--f);color:var(--p);padding:26px 28px;border-top:5px solid var(--a);box-shadow:9px 9px 0 rgba(215,221,207,.8)}
.mpx-next-label{font-size:13px;font-weight:650;color:#E6EADF;letter-spacing:.04em}.mpx-next h2{font-size:24px;font-weight:650;letter-spacing:-.035em;line-height:1.25;margin-top:12px}.mpx-next p:not(.mpx-next-label){color:#E6EAE1;font-size:14px;line-height:1.55;margin-top:7px}
.mpx-next-link{display:inline-flex;align-items:center;justify-content:space-between;gap:13px;align-self:flex-start;min-height:44px;padding:10px 14px;background:var(--p);color:var(--f);font-size:14px;font-weight:700;text-decoration:none;transition:background .18s,transform .18s}.mpx-next-link:hover{background:var(--s);transform:translateY(-2px)}
.mpx-progress{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin-bottom:25px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.mpx-progress a{display:flex;align-items:center;gap:12px;min-width:0;padding:15px 15px 15px 0;color:var(--f);text-decoration:none;transition:background .18s}.mpx-progress a+a{padding-left:21px;border-left:1px solid var(--line)}.mpx-progress a:hover{background:rgba(215,221,207,.45)}
.mpx-progress-n{display:flex;justify-content:center;align-items:center;flex:0 0 34px;height:34px;border:1px solid var(--a);color:var(--f);font-size:15px;font-weight:700}.mpx-progress strong{display:block;font-size:14px;font-weight:750;line-height:1.35}.mpx-progress small{display:block;color:var(--muted);font-size:12px;line-height:1.5;margin-top:2px}
.mpx-error{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;margin-bottom:18px;background:#FAE7E2;border-left:4px solid #B1433B;color:#792D28;font-size:14px;line-height:1.5}
.mpx-section{width:100%;margin:0 0 28px;scroll-margin-top:85px}.mpx-section-mark{font-size:13px;line-height:1.4;font-weight:750;letter-spacing:.055em;color:var(--f)}
.mpx-section-title{font-size:clamp(27px,2.5vw,37px);line-height:1.16;letter-spacing:-.04em;font-weight:650;color:var(--f)}
.mpx-description{font-size:15px;line-height:1.6;color:var(--muted);max-width:700px}
.mpx-section-01{display:grid;grid-template-columns:minmax(255px,.67fr) minmax(0,1.33fr);border:1px solid var(--line);overflow:hidden;background:white;box-shadow:0 9px 26px rgba(23,63,53,.05)}
.mpx-create-heading{background:var(--s);display:flex;flex-direction:column;justify-content:center;gap:17px;padding:clamp(25px,3vw,43px);border-right:1px solid var(--line);position:relative}
.mpx-create-heading::after{content:'';position:absolute;inset:0 auto 0 0;width:5px;background:var(--a)}
.mpx-create-heading h2{font-size:clamp(27px,2.6vw,38px);line-height:1.14;font-weight:650;letter-spacing:-.04em;color:var(--f);max-width:410px}
.mpx-create-heading .mpx-description{color:#384D43}.mpx-create-foot{font-size:13px;color:var(--f);font-weight:650;display:flex;align-items:center;gap:9px;border-top:1px solid rgba(23,63,53,.2);padding-top:15px;margin-top:3px}
.mpx-create-form{padding:clamp(25px,3vw,43px);align-self:center}.mpx-form-caption{font-size:17px;font-weight:700;color:var(--f);margin:0 0 18px!important}
.mpx-fields{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);gap:15px}
.mpx-field{min-width:0;display:block}.mpx-field>span{display:block;font-size:14px;font-weight:650;color:var(--f);margin-bottom:9px}.mpx-input{display:block;width:100%;min-width:0;min-height:49px;padding:11px 13px;background:white;border:1px solid #B9C8BA;border-radius:5px;color:var(--c);font-size:15px;outline:0}
.mpx-input:focus{border-color:var(--f);box-shadow:0 0 0 3px rgba(23,63,53,.12)}
.mpx-form-footer{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:21px;flex-wrap:wrap}
.mpx-form-footer p{font-size:13px;color:var(--muted);max-width:365px}
.mpx-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:10px 17px;color:#fff;background:var(--f);border:1px solid var(--f);border-radius:5px;font-size:14px;font-weight:700;text-decoration:none;transition:background .18s,transform .18s}
.mpx-btn:hover:not(:disabled){background:#245949;transform:translateY(-1px)}.mpx-btn:disabled,.mpx-icon:disabled,.mpx-plain:disabled{opacity:.52;cursor:not-allowed}
.mpx-plain{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 12px;background:var(--p);border:1px solid #B9C8BA;border-radius:5px;color:var(--f);font-size:14px;font-weight:650;text-decoration:none;transition:background .18s}
.mpx-plain:hover:not(:disabled){background:var(--s)}
.mpx-icon{display:inline-flex;align-items:center;justify-content:center;min-height:40px;min-width:40px;padding:9px;background:var(--p);border:1px solid #CAD2C7;border-radius:5px;color:var(--f)}.mpx-icon:hover{background:var(--s)}
.mpx-section-02{background:var(--s);padding:clamp(23px,2.9vw,41px);border-top:5px solid var(--f)}
.mpx-section-02-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:24px}
.mpx-section-02-head h2{margin:7px 0 9px}.mpx-section-02-head .mpx-description{color:#415449}
.mpx-selected-block{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;min-width:0;background:var(--f);color:var(--p);border-left:6px solid var(--a);padding:25px 27px;margin-bottom:18px;gap:20px 24px;box-shadow:0 8px 20px rgba(23,63,53,.13)}
.mpx-selected-block .mpx-section-mark{color:var(--p)}.mpx-selected-block h3{font-size:clamp(25px,3vw,39px);line-height:1.18;font-weight:650;letter-spacing:-.04em;overflow-wrap:anywhere;margin:8px 0 12px}
.mpx-selected-meta{display:flex;align-items:center;gap:9px 22px;flex-wrap:wrap;color:#E4E9DE;font-size:14px;line-height:1.5}.mpx-selected-meta span{display:inline-flex;align-items:center;gap:8px}
.mpx-selected-empty{max-width:600px;color:#DFE6DE;font-size:15px;line-height:1.55;margin-top:9px!important}
.mpx-selected-side{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;gap:19px;min-width:132px}
.mpx-selected-side-label{font-size:12px;color:#E8EDE3;letter-spacing:.05em;text-align:right}.mpx-selected-side strong{display:block;font-size:33px;line-height:1.1;color:white;text-align:right;font-weight:650;margin-top:5px}
.mpx-delete{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:8px 12px;color:white;font-size:13px;font-weight:650;border:1px solid rgba(247,246,242,.5);background:transparent;border-radius:5px}.mpx-delete:hover{background:rgba(247,246,242,.13)}
.mpx-saved-area{background:var(--p);border:1px solid var(--line);padding:24px 25px}
.mpx-saved-top{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:15px}.mpx-saved-top h3{font-size:23px;line-height:1.2;letter-spacing:-.035em;font-weight:650;color:var(--f);margin:5px 0}.mpx-saved-top p:last-child{font-size:13px;color:var(--muted)}
.mpx-saved-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;max-height:none;overflow:visible;overscroll-behavior:auto;padding:2px 0}
.mpx-plan-entry{display:flex;align-items:center;gap:12px;background:white;border:1px solid #CAD2C7;padding:17px 17px;min-width:0;transition:background .18s,border-color .18s,box-shadow .18s;position:relative;border-radius:4px}
.mpx-plan-entry.is-active{border:1px solid var(--f);background:#EDF1EA}.mpx-plan-entry.is-active::before{content:'';position:absolute;inset:0 auto 0 0;background:var(--a);width:4px}
.mpx-plan-entry:hover{border-color:var(--f);background:#F0F2EC;box-shadow:0 8px 18px rgba(23,63,53,.08)}.mpx-plan-main{flex:1;min-width:0;text-align:left;background:none;border:0;padding:0;color:var(--c)}
.mpx-plan-main strong{font-size:16px;line-height:1.3;font-weight:700;display:block;overflow-wrap:anywhere}.mpx-plan-main span{display:block;color:var(--muted);font-size:13px;line-height:1.5;margin-top:5px}
.mpx-active-label{font-size:12px;font-weight:700;letter-spacing:.02em;background:var(--f);color:white;padding:5px 7px}.mpx-no-plans{grid-column:1/-1;padding:20px;background:white;color:var(--muted);font-size:15px}
.mpx-section-03{background:var(--p);border:1px solid var(--line);overflow:hidden}
.mpx-schedule-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:clamp(23px,2.9vw,39px);background:var(--f);color:var(--p)}
.mpx-schedule-head .mpx-section-mark{color:var(--p)}.mpx-schedule-head h2{font-size:clamp(28px,2.7vw,38px);color:white;margin:9px 0 8px;line-height:1.15;letter-spacing:-.042em;font-weight:650}.mpx-schedule-head .mpx-description{color:#E0E8DF}
.mpx-count{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:0 0 106px;min-height:106px;background:var(--s);color:var(--f);padding:12px;text-align:center}.mpx-count strong{font-size:40px;line-height:1;font-weight:650}.mpx-count span{font-size:12px;line-height:1.4;margin-top:8px}
.mpx-add-block{display:grid;grid-template-columns:minmax(170px,.55fr) minmax(0,1.45fr);align-items:start;gap:28px;background:var(--s);padding:clamp(22px,2.7vw,36px);border-bottom:1px solid var(--line)}
.mpx-add-intro h3{font-size:23px;line-height:1.25;letter-spacing:-.03em;font-weight:650;color:var(--f);margin:8px 0 8px}.mpx-add-intro p{color:#45594D;font-size:14px;line-height:1.55}
.mpx-add-fields{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,.9fr) minmax(90px,.5fr);gap:13px;align-items:end}
.mpx-add-fields .mpx-field:first-child{grid-column:1/3}.mpx-add-fields .mpx-field:nth-child(2){grid-column:3/5}
.mpx-add-fields .mpx-field-error{display:block;color:#992F2B;font-size:13px;margin-top:6px}
.mpx-add-submit{grid-column:3/5;width:100%;align-self:end}.mpx-add-submit:disabled{opacity:.45}
.mpx-meal-list{padding:22px clamp(20px,2.8vw,39px);display:grid;gap:14px;background:var(--p)}
.mpx-meal{display:grid;grid-template-columns:minmax(175px,.32fr) minmax(0,1fr);background:#fff;border:1px solid #CCD5C9;transition:border-color .18s,box-shadow .18s}
.mpx-meal:hover{border-color:var(--f);box-shadow:0 7px 20px rgba(23,63,53,.07)}
.mpx-date{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:13px;padding:21px 20px;background:var(--s);border-right:1px solid #CCD5C9;color:var(--f)}
.mpx-date strong{font-size:17px;font-weight:700;line-height:1.45}.mpx-meal-body{min-width:0;padding:22px 24px}
.mpx-meal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.mpx-meal-name{font-size:23px;font-weight:650;color:var(--c);line-height:1.3;letter-spacing:-.035em;margin:8px 0 6px!important}
.mpx-meal-serving{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:14px}.mpx-badges{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.mpx-status{font-size:12px;font-weight:700;color:var(--f);background:#E5EBE1;padding:5px 9px;line-height:1.35}.mpx-status.is-warning{color:#8B4A24;background:#F7E5D6}.mpx-status.is-danger{color:#922E2A;background:#F8E6E2}.mpx-status.is-uncertain{color:#694C7B;background:#EEE7F2}
.mpx-forecast{background:#F3F5EF;border-top:1px solid var(--line);margin-top:18px;padding:15px 16px}.mpx-forecast h4{font-size:14px;font-weight:700;color:var(--f);margin:0 0 12px}
.mpx-ingredients{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 19px}.mpx-ingredient{display:flex;align-items:baseline;justify-content:space-between;gap:10px;border-bottom:1px solid #DAE0D5;padding:5px 0;font-size:13px;line-height:1.5}.mpx-ingredient strong{font-weight:650;color:var(--c);overflow-wrap:anywhere}.mpx-ingredient span{text-align:right;color:#526055;overflow-wrap:anywhere}
.mpx-meal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px;border-top:1px solid var(--line);padding-top:15px}.mpx-action{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:7px 11px;border:1px solid #B9C8BA;background:white;color:var(--f);border-radius:5px;font-size:13px;font-weight:650}.mpx-action:hover:not(:disabled){background:var(--s)}.mpx-action:disabled{opacity:.5;cursor:not-allowed}.mpx-action.is-danger{color:#98312B;border-color:#D6A5A0}.mpx-action.is-danger:hover{background:#FBEDEA}
.mpx-schedule-empty{text-align:center;background:white;border:1px dashed #AEBCA9;padding:29px 18px;color:var(--c)}.mpx-schedule-empty svg{color:var(--f)}.mpx-schedule-empty h3{font-size:21px;margin:9px 0 7px;font-weight:650}.mpx-schedule-empty p{font-size:14px;color:var(--muted);line-height:1.6}
.mpx-note{display:flex;align-items:flex-start;gap:10px;background:rgba(215,221,207,.55);border-left:3px solid var(--f);color:#33483D;padding:16px 20px;font-size:13px;line-height:1.55;margin:0 0 4px}.mpx-note svg{flex:0 0 auto}
.mpx-overlay{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(19,29,24,.63);backdrop-filter:blur(5px)}
.mpx-dialog{width:100%;max-width:470px;background:var(--p);border-top:5px solid #A83D3B;padding:25px;box-shadow:0 22px 65px rgba(0,0,0,.22)}
.mpx-dialog-top{display:flex;align-items:center;justify-content:space-between;gap:14px}.mpx-dialog h2{font-size:26px;line-height:1.2;font-weight:650;letter-spacing:-.03em;margin:15px 0 10px}.mpx-dialog p{font-size:14px;line-height:1.6;color:var(--muted)}.mpx-dialog-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:24px}
.mpx-page :is(button,a,input,select):focus-visible{outline:3px solid var(--a);outline-offset:3px}
/* Selected plan's four directly accessible meals; each opens its real schedule row. */
.mpx-quick-meals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px;margin-top:22px;max-width:850px}
.mpx-quick-title{grid-column:1/-1;font-size:13px;letter-spacing:.035em;font-weight:700;color:#E9EEE7;margin-bottom:3px}
.mpx-quick-meal{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;text-align:left;padding:11px 12px;border-radius:4px;border:1px solid rgba(247,246,242,.32);color:var(--p);background:rgba(247,246,242,.09);transition:background .18s,border-color .18s}
.mpx-quick-meal:hover,.mpx-quick-meal:focus-visible{background:rgba(247,246,242,.2);border-color:var(--p)}
.mpx-quick-meal strong{display:block;font-size:14px;line-height:1.4;overflow-wrap:anywhere;font-weight:700}
.mpx-quick-meal small{display:block;color:#DAE6DC;margin-top:3px;font-size:12px;line-height:1.4}
.mpx-quick-meal svg{flex:0 0 auto}
.mpx-quick-more{border:1px solid rgba(247,246,242,.55);border-radius:4px;background:transparent;color:var(--p);padding:10px 13px;min-height:42px;justify-self:start;margin-top:4px;grid-column:1/-1;font-size:14px;font-weight:700;display:inline-flex;align-items:center;gap:9px}
.mpx-quick-more:hover{background:rgba(247,246,242,.14)}
.mpx-saved-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.mpx-saved-footer p{font-size:13px;color:var(--muted)}
.mpx-view-all{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:10px 16px;border-radius:4px;border:1px solid var(--f);background:var(--f);color:var(--p);font-size:14px;font-weight:700;transition:background .18s}
.mpx-view-all:hover{background:#285746}
.mpx-plan-main:focus-visible,.mpx-quick-meal:focus-visible{outline:3px solid var(--a);outline-offset:3px}
.mpx-meal{scroll-margin-top:105px}
.mpx-section-03:focus,.mpx-meal:focus{outline:none}
.mpx-meal.is-target{border-color:var(--a);box-shadow:0 0 0 3px rgba(197,108,66,.24),0 12px 28px rgba(23,63,53,.08)}
.mpx-meal.is-target .mpx-date{border-left:4px solid var(--a)}
.mpx-allplans-dialog{width:min(100%,870px);max-height:min(82dvh,740px);padding:0;display:flex;flex-direction:column;overflow:hidden;border-top-color:var(--a)}
.mpx-allplans-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:23px 26px;background:var(--s);border-bottom:1px solid var(--line)}
.mpx-allplans-head h2{font-size:27px;margin:6px 0 5px;line-height:1.2;color:var(--f)}
.mpx-allplans-head p{font-size:14px;color:#465A4B}
.mpx-allplans-body{padding:20px 25px 25px;overflow-y:auto;overscroll-behavior:auto;min-height:0}
.mpx-allplans-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.mpx-allplans-list .mpx-plan-entry{min-height:89px}
.mpx-allmeals-list{display:grid;gap:9px}
.mpx-allmeals-list button{display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;padding:14px 16px;border:1px solid var(--line);background:#fff;color:var(--c);width:100%;min-height:60px}
.mpx-allmeals-list button:hover{background:var(--s);border-color:var(--f)}
.mpx-allmeals-list strong{display:block;font-size:16px;line-height:1.4}
.mpx-allmeals-list small{display:block;font-size:13px;color:var(--muted);margin-top:4px}
@media(max-width:1150px){.mpx-fields{grid-template-columns:1fr 1fr}.mpx-fields .mpx-field:first-child{grid-column:1/-1}.mpx-add-fields{grid-template-columns:1fr 1fr}.mpx-add-fields .mpx-field:first-child,.mpx-add-fields .mpx-field:nth-child(2){grid-column:auto}.mpx-add-submit{grid-column:auto}}
@media(max-width:900px){.mpx-intro{grid-template-columns:1fr}.mpx-next{padding:24px}.mpx-next h2{margin:7px 0}.mpx-section-01{grid-template-columns:1fr}.mpx-create-heading{border-right:0;border-bottom:1px solid var(--line)}.mpx-add-block{grid-template-columns:1fr;gap:17px}.mpx-saved-list{grid-template-columns:1fr}}
@media(max-width:630px){.mpx-quick-meals,.mpx-allplans-list{grid-template-columns:1fr}.mpx-allplans-head{padding:18px}.mpx-allplans-body{padding:15px}.mpx-allplans-dialog{max-height:78dvh}.mpx-selected-block .mpx-quick-meals{margin-top:14px}.mpx-frame{padding:13px 12px 26px}.mpx-intro{gap:16px;margin-bottom:19px}.mpx-intro-copy{padding:9px 2px}.mpx-intro h1{font-size:33px;line-height:1.12}.mpx-intro-copy>p:last-child{font-size:14px}.mpx-next{box-shadow:5px 5px 0 rgba(215,221,207,.9)}.mpx-next h2{font-size:21px}.mpx-progress{grid-template-columns:1fr}.mpx-progress a,.mpx-progress a+a{border-left:0;border-bottom:1px solid var(--line);padding:10px 7px}.mpx-progress a:last-child{border-bottom:0}.mpx-progress small{display:none}.mpx-section{margin-bottom:18px}.mpx-create-heading{padding:23px 20px;gap:13px}.mpx-create-heading h2{font-size:27px}.mpx-create-form{padding:21px 17px}.mpx-form-caption{font-size:16px}.mpx-fields{grid-template-columns:1fr}.mpx-fields .mpx-field:first-child{grid-column:auto}.mpx-form-footer{align-items:stretch;flex-direction:column}.mpx-form-footer .mpx-btn{width:100%}.mpx-section-02{padding:20px 13px}.mpx-section-02-head h2{font-size:26px}.mpx-selected-block{grid-template-columns:1fr;padding:21px 18px}.mpx-selected-block h3{font-size:28px}.mpx-selected-side{flex-direction:row;align-items:center;justify-content:space-between}.mpx-selected-side-label{text-align:left}.mpx-selected-side strong{text-align:left;font-size:25px}.mpx-saved-area{padding:18px 13px}.mpx-plan-entry{padding:12px 10px}.mpx-active-label{display:none}.mpx-schedule-head{padding:22px 17px;align-items:flex-start}.mpx-schedule-head h2{font-size:28px}.mpx-count{min-height:73px;flex-basis:72px;padding:6px}.mpx-count strong{font-size:28px}.mpx-count span{font-size:11px}.mpx-add-block{padding:20px 15px}.mpx-add-fields{grid-template-columns:1fr}.mpx-add-submit{grid-column:auto}.mpx-meal-list{padding:14px 11px}.mpx-meal{grid-template-columns:1fr}.mpx-date{flex-direction:row;align-items:center;border-right:0;border-bottom:1px solid #CCD5C9;padding:13px 14px}.mpx-date strong{font-size:14px}.mpx-meal-body{padding:17px 14px}.mpx-meal-head{flex-direction:column}.mpx-meal-name{font-size:20px}.mpx-ingredients{grid-template-columns:1fr}.mpx-forecast{padding:13px}.mpx-note{padding:13px 14px}.mpx-dialog{padding:20px}}
/* Mobile-only: reclaim shell + page gutters while keeping every interactive field inside the viewport. */
@media (max-width:630px){
  .mpx-page{width:calc(100% + var(--ep-content-gutter, 16px) + var(--ep-content-gutter, 16px) - 2px);margin-inline:calc(0px - var(--ep-content-gutter, 16px));max-width:none;min-width:0;overflow-x:clip}
  .mpx-frame{width:100%;max-width:100%;min-width:0;padding:10px 9px 18px}
  .mpx-mobile-hide-copy{display:none!important}
  .mpx-intro{gap:10px;margin:0 0 11px}
  .mpx-intro-copy{padding:7px 7px 0}
  .mpx-intro h1{font-size:clamp(27px,8.2vw,33px);line-height:1.13;letter-spacing:-.035em;margin:6px 0 2px}
  .mpx-eyebrow{font-size:12px;gap:8px}
  .mpx-eyebrow::before{flex-basis:15px;width:15px}
  .mpx-next{padding:12px 14px;gap:10px;border-top-width:3px;box-shadow:none}
  .mpx-next h2{font-size:18px;margin:3px 0 0;line-height:1.3}
  .mpx-next p:not(.mpx-next-label){font-size:13px;line-height:1.4;margin-top:3px}
  .mpx-next-link{min-height:38px;padding:7px 12px;font-size:13px}
  .mpx-progress{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:12px}
  .mpx-progress a,.mpx-progress a+a{min-width:0;border-bottom:0;padding:9px 5px;display:flex;align-items:center;gap:6px}
  .mpx-progress a+a{border-left:1px solid var(--line)}
  .mpx-progress-n{flex:0 0 25px;width:25px;height:25px;font-size:12px}
  .mpx-progress strong{font-size:12px;line-height:1.25;overflow-wrap:anywhere}
  .mpx-section{margin-bottom:12px;scroll-margin-top:70px}
  .mpx-section-mark{font-size:12px}
  .mpx-section-title{font-size:24px}
  .mpx-section-01{border-inline:0;box-shadow:none}
  .mpx-create-heading{padding:13px 13px 11px;gap:6px}
  .mpx-create-heading h2{font-size:23px;line-height:1.18}
  .mpx-create-foot{font-size:12px;padding-top:6px;margin-top:0;gap:5px}
  .mpx-create-form{padding:12px 12px 15px}
  .mpx-form-caption{font-size:15px;margin-bottom:9px!important}
  .mpx-fields{gap:9px}
  .mpx-field>span{font-size:13px;margin-bottom:5px}
  .mpx-input{min-height:43px;padding:9px 10px;font-size:14px;max-width:100%;min-width:0}
  .mpx-form-footer{margin-top:11px;gap:8px}
  .mpx-btn{min-height:42px;padding:9px 12px;font-size:14px}
  .mpx-section-02{padding:13px 10px 12px;border-top-width:3px}
  .mpx-section-02-head{margin-bottom:10px}
  .mpx-section-02-head h2{font-size:23px;margin:4px 0 0}
  .mpx-selected-block{padding:13px 12px;gap:11px;margin-bottom:10px;border-left-width:4px;box-shadow:none}
  .mpx-selected-block h3{font-size:24px;margin:5px 0 7px}
  .mpx-selected-meta{font-size:13px;gap:5px 10px}
  .mpx-selected-side{gap:10px}
  .mpx-selected-side strong{font-size:22px}
  .mpx-quick-meals{gap:7px;margin-top:9px}
  .mpx-quick-title{font-size:12px}
  .mpx-quick-meal{padding:8px 10px}
  .mpx-quick-meal strong{font-size:13px}
  .mpx-quick-meal small{font-size:12px}
  .mpx-saved-area{padding:12px 10px}
  .mpx-saved-top{margin-bottom:9px}
  .mpx-saved-top h3{font-size:19px}
  .mpx-saved-list{gap:8px}
  .mpx-plan-entry{padding:10px;gap:8px}
  .mpx-plan-main strong{font-size:15px}
  .mpx-plan-main span{font-size:12px;margin-top:3px}
  .mpx-saved-footer{margin-top:10px;padding-top:9px}
  .mpx-schedule-head{padding:14px 11px;gap:8px}
  .mpx-schedule-head h2{font-size:23px;margin:4px 0 0}
  .mpx-count{flex-basis:65px;min-height:63px;padding:5px}
  .mpx-count strong{font-size:25px}
  .mpx-count span{font-size:11px;margin-top:3px}
  .mpx-add-block{padding:13px 11px;gap:10px}
  .mpx-add-intro h3{font-size:20px;margin:4px 0 0}
  .mpx-add-fields{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .mpx-add-fields .mpx-field:first-child,.mpx-add-fields .mpx-field:nth-child(2){grid-column:1/-1}
  .mpx-add-submit{grid-column:1/-1}
  .mpx-meal-list{padding:10px 7px;gap:10px}
  .mpx-date{padding:10px 11px;gap:8px}
  .mpx-date strong{font-size:14px}
  .mpx-meal-body{padding:12px 11px}
  .mpx-meal-head{gap:10px}
  .mpx-meal-name{font-size:19px;margin:6px 0 4px!important}
  .mpx-forecast{padding:10px 9px;margin-top:11px}
  .mpx-forecast h4{margin-bottom:6px}
  .mpx-ingredients{gap:3px}
  .mpx-ingredient{font-size:12.5px;gap:7px;padding:5px 0}
  .mpx-meal-actions{gap:6px;margin-top:10px;padding-top:10px}
  .mpx-action{min-height:36px;padding:6px 9px}
  .mpx-note{padding:11px 10px;margin:0;font-size:12.5px}
  .mpx-page :is(.mpx-section,.mpx-meal,.mpx-saved-area,.mpx-selected-block,.mpx-add-block,.mpx-intro,form){min-width:0;max-width:100%}
}
@media (min-width:360px) and (max-width:630px){
  .mpx-fields{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mpx-fields .mpx-field:first-child{grid-column:1/-1}
}
@media(prefers-reduced-motion:reduce){.mpx-page *{transition:none!important;transform:none!important}}

      `}</style>

      <div className="mpx-frame">
        <header className="mpx-intro">
          <div className="mpx-intro-copy">
            <p className="mpx-eyebrow">EPANTRY / MEAL PLANNING</p>
            <h1>
              Make space for <span>meals worth sharing.</span>
            </h1>
            <p className="mpx-mobile-hide-copy">
              Choose your dates, build a plan and see what your Pantry can
              support — all in one clear schedule.
            </p>
          </div>
          <aside className="mpx-next" aria-label="Next Basket">
            <div>
              <p className="mpx-next-label">AFTER YOU PLAN</p>
              <h2>Shop only for what you need.</h2>
              <p>Review missing ingredients in your Next Basket.</p>
            </div>
            <Link className="mpx-next-link" to="/next-basket">
              Open Next Basket <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </aside>
        </header>

        <nav className="mpx-progress" aria-label="Meal planning sections">
          <a href="#mpx-section-1">
            <span className="mpx-progress-n">01</span>
            <span>
              <strong>Your schedule</strong>
              <small>Set your dates</small>
            </span>
          </a>
          <a href="#mpx-section-2">
            <span className="mpx-progress-n">02</span>
            <span>
              <strong>Selected &amp; saved plans</strong>
              <small>Choose your plan</small>
            </span>
          </a>
          <a href="#mpx-section-3">
            <span className="mpx-progress-n">03</span>
            <span>
              <strong>Meal schedule</strong>
              <small>Add &amp; review meals</small>
            </span>
          </a>
        </nav>

        {error && (
          <div className="mpx-error" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            {error}
          </div>
        )}

        {/* 01: Create a schedule. This section is deliberately separate. */}
        <section
          id="mpx-section-1"
          className="mpx-section mpx-section-01"
          aria-labelledby="mpx-section-1-title"
        >
          <div className="mpx-create-heading">
            <p className="mpx-section-mark">01 / YOUR SCHEDULE</p>
            <h2 id="mpx-section-1-title">
              Start with the days that work for you.
            </h2>
            <p className="mpx-mobile-hide-copy mpx-description">
              Give your plan a name and select its date range. You will choose
              your recipes next.
            </p>
            <p className="mpx-create-foot">
              <CalendarRange size={19} aria-hidden="true" /> Your week, your
              way.
            </p>
          </div>
          <form className="mpx-create-form" onSubmit={handleCreatePlan}>
            <p className="mpx-form-caption">Create a meal plan</p>
            <div className="mpx-fields">
              <label className="mpx-field">
                <span>Plan name</span>
                <input
                  className="mpx-input"
                  placeholder="e.g. Weekday dinners"
                  value={planForm.title}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="mpx-field">
                <span>Start date</span>
                <input
                  className="mpx-input"
                  type="date"
                  value={planForm.horizonStart}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      horizonStart: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="mpx-field">
                <span>End date</span>
                <input
                  className="mpx-input"
                  type="date"
                  value={planForm.horizonEnd}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      horizonEnd: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="mpx-form-footer">
              <p className="mpx-mobile-hide-copy">
                Saved plans are available below whenever you want to return to
                them.
              </p>
              <button className="mpx-btn" type="submit" disabled={saving}>
                <Plus size={17} aria-hidden="true" />{" "}
                {saving ? "Saving..." : "Create plan"}{" "}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>

        {/* 02: Selected plan first, saved plans second. No recipe form in this section. */}
        <section
          id="mpx-section-2"
          className="mpx-section mpx-section-02"
          aria-labelledby="mpx-section-2-title"
        >
          <div className="mpx-section-02-head">
            <div>
              <p className="mpx-section-mark">02 / YOUR PLANS</p>
              <h2 className="mpx-section-title" id="mpx-section-2-title">
                Know which plan you are using.
              </h2>
              <p className="mpx-mobile-hide-copy mpx-description">
                Your selected plan comes first. Your saved plans are just below.
              </p>
            </div>
          </div>

          <article
            className="mpx-selected-block"
            aria-label="Selected meal plan"
          >
            <div>
              <p className="mpx-section-mark">SELECTED PLAN</p>
              {selectedPlan ? (
                <>
                  <h3>{selectedPlan.title}</h3>
                  <div className="mpx-selected-meta">
                    <span>
                      <CalendarRange size={17} aria-hidden="true" />{" "}
                      {formatDateOnly(selectedPlan.horizonStart)} –{" "}
                      {formatDateOnly(selectedPlan.horizonEnd)}
                    </span>
                    <span>
                      <ChefHat size={17} aria-hidden="true" />{" "}
                      {(selectedPlan.meals || []).length}{" "}
                      {(selectedPlan.meals || []).length === 1
                        ? "meal"
                        : "meals"}{" "}
                      scheduled
                    </span>
                  </div>
                  {selectedMealsPreview.length > 0 && (
                    <div
                      className="mpx-quick-meals"
                      aria-label="Meals in selected plan"
                    >
                      <p className="mpx-quick-title">GO TO A SCHEDULED MEAL</p>
                      {selectedMealsPreview.map((meal) => (
                        <button
                          type="button"
                          key={meal.id}
                          className="mpx-quick-meal"
                          onClick={() =>
                            openPlanInSchedule(selectedPlan.id, meal.id)
                          }
                        >
                          <span>
                            <strong>
                              {meal.recipeTitle || "Planned meal"}
                            </strong>
                            <small>
                              {formatDateTime(meal.plannedAt)} ·{" "}
                              {titleCase(meal.mealType)}
                            </small>
                          </span>
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                      ))}
                      {selectedMeals.length > 4 && (
                        <button
                          type="button"
                          className="mpx-quick-more"
                          onClick={() => setShowAllMeals(true)}
                        >
                          View all {selectedMeals.length} meals{" "}
                          <ArrowRight size={17} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h3>No plan selected yet.</h3>
                  <p className="mpx-selected-empty">
                    Create a plan above or select one from your saved plans.
                  </p>
                </>
              )}
            </div>
            {selectedPlan && (
              <div className="mpx-selected-side">
                <div>
                  <p className="mpx-selected-side-label">MEALS IN THIS PLAN</p>
                  <strong>{(selectedPlan.meals || []).length}</strong>
                </div>
                <button
                  className="mpx-delete"
                  type="button"
                  onClick={() => setPlanPendingDelete(selectedPlan)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Delete plan
                </button>
              </div>
            )}
          </article>

          <div className="mpx-saved-area" aria-labelledby="mpx-saved-heading">
            <div className="mpx-saved-top">
              <div>
                <p className="mpx-section-mark">YOUR SAVED PLANS</p>
                <h3 id="mpx-saved-heading">Choose a plan to continue</h3>
                <p>
                  {mealPlans.length} {mealPlans.length === 1 ? "plan" : "plans"}{" "}
                  saved
                </p>
              </div>
              <button
                type="button"
                className="mpx-icon"
                title="Refresh meal plans"
                aria-label="Refresh meal plans"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw
                  size={19}
                  className={loading ? "animate-spin" : ""}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div className="mpx-saved-list">
              {savedPlansPreview.map((plan) => (
                <article
                  key={plan.id}
                  className={`mpx-plan-entry ${
                    selectedPlan?.id === plan.id ? "is-active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="mpx-plan-main"
                    onClick={() => openPlanInSchedule(plan.id)}
                    aria-pressed={selectedPlan?.id === plan.id}
                    title={`Open ${plan.title} and go to its meal schedule`}
                  >
                    <strong>{plan.title}</strong>
                    <span>
                      {formatDateOnly(plan.horizonStart)} –{" "}
                      {formatDateOnly(plan.horizonEnd)} ·{" "}
                      {(plan.meals || []).length}{" "}
                      {(plan.meals || []).length === 1 ? "meal" : "meals"}
                    </span>
                  </button>
                  {selectedPlan?.id === plan.id && (
                    <span className="mpx-active-label">Selected</span>
                  )}
                  <button
                    type="button"
                    className="mpx-icon"
                    aria-label={`Delete ${plan.title}`}
                    title="Delete plan"
                    onClick={() => setPlanPendingDelete(plan)}
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </article>
              ))}
              {!loading && mealPlans.length === 0 && (
                <p className="mpx-no-plans">
                  No saved plans yet. Create one in section 01 to begin.
                </p>
              )}
              {loading && mealPlans.length === 0 && (
                <p className="mpx-no-plans" role="status">
                  Loading saved plans…
                </p>
              )}
            </div>
            {mealPlans.length > 4 && (
              <div className="mpx-saved-footer">
                <p>Showing 4 of {mealPlans.length} saved plans</p>
                <button
                  type="button"
                  className="mpx-view-all"
                  onClick={() => setShowAllPlans(true)}
                >
                  View all {mealPlans.length} plans{" "}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 03: Add a meal, then review the actual scheduled meals. */}
        <section
          id="mpx-section-3"
          ref={scheduleRef}
          tabIndex={-1}
          className="mpx-section mpx-section-03"
          aria-labelledby="mpx-section-3-title"
        >
          <header className="mpx-schedule-head">
            <div>
              <p className="mpx-section-mark">03 / MEAL SCHEDULE</p>
              <h2 id="mpx-section-3-title">Plan what goes on the table.</h2>
              <p className="mpx-mobile-hide-copy mpx-description">
                Add recipes, check servings and review the ingredients each meal
                needs.
              </p>
            </div>
            <div className="mpx-count">
              <strong>{(selectedPlan?.meals || []).length}</strong>
              <span>
                {(selectedPlan?.meals || []).length === 1
                  ? "scheduled meal"
                  : "scheduled meals"}
              </span>
            </div>
          </header>

          {selectedPlan && (
            <form className="mpx-add-block" onSubmit={handleAddMeal}>
              <div className="mpx-add-intro">
                <p className="mpx-section-mark">ADD A RECIPE</p>
                <h3>What will you cook?</h3>
                <p className="mpx-mobile-hide-copy">
                  Choose a dish, when to make it and how many people you are
                  cooking for.
                </p>
              </div>
              <div className="mpx-add-fields">
                <label className="mpx-field">
                  <span>Recipe</span>
                  <select
                    className="mpx-input"
                    value={mealForm.recipeSlug}
                    onChange={(event) =>
                      setMealForm((current) => ({
                        ...current,
                        recipeSlug: event.target.value,
                      }))
                    }
                    required
                    disabled={
                      recipeOptionsLoading || recipeOptions.length === 0
                    }
                  >
                    <option value="">
                      {recipeOptionsLoading
                        ? "Loading published recipes…"
                        : recipeOptions.length === 0
                        ? "No published recipes available"
                        : "Choose a published recipe"}
                    </option>
                    {recipeOptions.map((item) => {
                      const dish = item?.dish || {};
                      const recipe = item?.recipe || {};
                      const slug = dish.slug || recipe.slug || "";
                      if (!slug) return null;
                      return (
                        <option value={slug} key={slug}>
                          {dish.name || recipe.title || slug}
                        </option>
                      );
                    })}
                  </select>
                  {recipeOptionsError && (
                    <span className="mpx-field-error" role="alert">
                      {recipeOptionsError}
                    </span>
                  )}
                </label>
                <label className="mpx-field">
                  <span>Date &amp; time</span>
                  <input
                    className="mpx-input"
                    type="datetime-local"
                    value={mealForm.plannedAt}
                    onChange={(event) =>
                      setMealForm((current) => ({
                        ...current,
                        plannedAt: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="mpx-field">
                  <span>Meal type</span>
                  <select
                    className="mpx-input"
                    value={mealForm.mealType}
                    onChange={(event) =>
                      setMealForm((current) => ({
                        ...current,
                        mealType: event.target.value,
                      }))
                    }
                  >
                    {[
                      "breakfast",
                      "brunch",
                      "lunch",
                      "snack",
                      "dinner",
                      "other",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {titleCase(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mpx-field">
                  <span>Servings</span>
                  <input
                    className="mpx-input"
                    type="number"
                    min="1"
                    max="100"
                    value={mealForm.servings}
                    onChange={(event) =>
                      setMealForm((current) => ({
                        ...current,
                        servings: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="mpx-btn mpx-add-submit"
                  type="submit"
                  disabled={
                    saving || !mealForm.recipeSlug || !mealForm.plannedAt
                  }
                >
                  <Plus size={18} aria-hidden="true" /> Add planned meal
                </button>
              </div>
            </form>
          )}

          <div className="mpx-meal-list">
            {(selectedPlan?.meals || []).map((meal) => (
              <article
                key={meal.id}
                ref={(node) => {
                  if (node) mealRowRefs.current.set(String(meal.id), node);
                  else mealRowRefs.current.delete(String(meal.id));
                }}
                tabIndex={-1}
                className={`mpx-meal ${
                  activeMealId === String(meal.id) ? "is-target" : ""
                }`}
              >
                <div className="mpx-date">
                  <CalendarDays size={21} aria-hidden="true" />
                  <strong>{formatDateTime(meal.plannedAt)}</strong>
                </div>
                <div className="mpx-meal-body">
                  <div className="mpx-meal-head">
                    <div>
                      <div className="mpx-badges">
                        <span
                          className={`mpx-status ${
                            ["missing", "expected_depleted"].includes(
                              meal.readinessState
                            )
                              ? "is-danger"
                              : meal.readinessState ===
                                "running_low_before_meal"
                              ? "is-warning"
                              : meal.readinessState === "needs_confirmation"
                              ? "is-uncertain"
                              : ""
                          }`}
                        >
                          {READINESS_LABELS[meal.readinessState] ||
                            "Needs confirmation"}
                        </span>
                        <span className="mpx-status">
                          {titleCase(meal.mealType)}
                        </span>
                        {meal.status !== "planned" && (
                          <span className="mpx-status">
                            {titleCase(meal.status)}
                          </span>
                        )}
                      </div>
                      <h3 className="mpx-meal-name">{meal.recipeTitle}</h3>
                      <p className="mpx-meal-serving">
                        <UsersRound size={16} aria-hidden="true" />{" "}
                        {meal.servings} servings
                      </p>
                    </div>
                    <Link
                      className="mpx-plain"
                      to={`/recipes/${meal.recipeSlug}`}
                    >
                      View recipe <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </div>
                  {(meal.forecastLines || []).length > 0 && (
                    <section
                      className="mpx-forecast"
                      aria-label={`Pantry forecast for ${meal.recipeTitle}`}
                    >
                      <h4>
                        Pantry forecast · {(meal.forecastLines || []).length}{" "}
                        ingredients
                      </h4>
                      <div className="mpx-ingredients">
                        {meal.forecastLines.map((line, index) => (
                          <div
                            className="mpx-ingredient"
                            key={`${line.canonicalIngredientId}:${line.requiredUnit}:${index}`}
                          >
                            <strong>{line.label || "Ingredient"}</strong>
                            <span>
                              {line.requiredQuantity} {line.requiredUnit} ·{" "}
                              {READINESS_LABELS[line.readinessState] ||
                                "Needs confirmation"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                  {meal.status === "planned" && (
                    <div className="mpx-meal-actions">
                      <button
                        className="mpx-action"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          changeMeal({
                            mealId: meal.id,
                            changes: {
                              servings: Math.max(1, Number(meal.servings) - 1),
                            },
                          })
                        }
                      >
                        − Serving
                      </button>
                      <button
                        className="mpx-action"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          changeMeal({
                            mealId: meal.id,
                            changes: { servings: Number(meal.servings) + 1 },
                          })
                        }
                      >
                        + Serving
                      </button>
                      <button
                        className="mpx-action"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          changeMeal({
                            mealId: meal.id,
                            changes: { status: "skipped" },
                          })
                        }
                      >
                        Skip meal
                      </button>
                      <button
                        className="mpx-action is-danger"
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          changeMeal({
                            mealId: meal.id,
                            changes: { status: "cancelled" },
                          })
                        }
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {(selectedPlan?.meals || []).length === 0 && (
              <div className="mpx-schedule-empty">
                <ChefHat size={29} aria-hidden="true" />
                <h3>
                  {selectedPlan
                    ? "Nothing scheduled yet"
                    : "Your schedule is waiting."}
                </h3>
                <p>
                  {selectedPlan
                    ? "Choose a published recipe above to see its Pantry forecast here."
                    : "Create or select a plan in sections 01 and 02, then add your first recipe."}
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="mpx-note">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>
            Scheduled meals do not deduct Pantry stock. Estimated or unconfirmed
            quantities stay uncertain until you check them.
          </p>
        </div>
      </div>

      {showAllPlans && (
        <div
          className="mpx-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAllPlans(false);
          }}
        >
          <section
            className="mpx-dialog mpx-allplans-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpx-allplans-title"
          >
            <header className="mpx-allplans-head">
              <div>
                <p className="mpx-section-mark">YOUR SAVED PLANS</p>
                <h2 id="mpx-allplans-title">All {mealPlans.length} plans</h2>
                <p>Select a plan to open its meal schedule.</p>
              </div>
              <button
                ref={popupCloseRef}
                type="button"
                className="mpx-icon"
                aria-label="Close all plans"
                onClick={() => setShowAllPlans(false)}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="mpx-allplans-body">
              <div className="mpx-allplans-list">
                {mealPlans.map((plan) => (
                  <article
                    key={plan.id}
                    className={`mpx-plan-entry ${
                      selectedPlan?.id === plan.id ? "is-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="mpx-plan-main"
                      onClick={() => openPlanInSchedule(plan.id)}
                      aria-pressed={selectedPlan?.id === plan.id}
                    >
                      <strong>{plan.title}</strong>
                      <span>
                        {formatDateOnly(plan.horizonStart)} –{" "}
                        {formatDateOnly(plan.horizonEnd)} ·{" "}
                        {(plan.meals || []).length}{" "}
                        {(plan.meals || []).length === 1 ? "meal" : "meals"}
                      </span>
                    </button>
                    {selectedPlan?.id === plan.id && (
                      <span className="mpx-active-label">Selected</span>
                    )}
                    <button
                      type="button"
                      className="mpx-icon"
                      aria-label={`Delete ${plan.title}`}
                      onClick={() => {
                        setShowAllPlans(false);
                        setPlanPendingDelete(plan);
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {showAllMeals && selectedPlan && (
        <div
          className="mpx-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowAllMeals(false);
          }}
        >
          <section
            className="mpx-dialog mpx-allplans-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpx-allmeals-title"
          >
            <header className="mpx-allplans-head">
              <div>
                <p className="mpx-section-mark">{selectedPlan.title}</p>
                <h2 id="mpx-allmeals-title">
                  All {selectedMeals.length} scheduled meals
                </h2>
                <p>
                  Choose a meal to go straight to its Pantry forecast and
                  actions.
                </p>
              </div>
              <button
                ref={popupCloseRef}
                type="button"
                className="mpx-icon"
                aria-label="Close all meals"
                onClick={() => setShowAllMeals(false)}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="mpx-allplans-body">
              <div className="mpx-allmeals-list">
                {selectedMeals.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => openPlanInSchedule(selectedPlan.id, meal.id)}
                  >
                    <span>
                      <strong>{meal.recipeTitle || "Planned meal"}</strong>
                      <small>
                        {formatDateTime(meal.plannedAt)} ·{" "}
                        {titleCase(meal.mealType)} · {meal.servings} servings
                      </small>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {planPendingDelete && (
        <div
          className="mpx-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting)
              setPlanPendingDelete(null);
          }}
        >
          <section
            className="mpx-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mpx-delete-title"
          >
            <div className="mpx-dialog-top">
              <Trash2 size={25} color="#A83D3B" aria-hidden="true" />
              <button
                className="mpx-icon"
                type="button"
                disabled={deleting}
                aria-label="Close delete confirmation"
                onClick={() => setPlanPendingDelete(null)}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <h2 id="mpx-delete-title">Delete {planPendingDelete.title}?</h2>
            <p>
              This removes the plan from your active Meal Plans and cancels its
              still-planned meals so they no longer affect Pantry forecasting.
              Existing planning history is preserved.
            </p>
            <div className="mpx-dialog-actions">
              <button
                className="mpx-plain"
                type="button"
                disabled={deleting}
                onClick={() => setPlanPendingDelete(null)}
              >
                Keep plan
              </button>
              <button
                className="mpx-btn"
                style={{ background: "#A83D3B", borderColor: "#A83D3B" }}
                type="button"
                disabled={deleting}
                onClick={handleDeletePlan}
              >
                <Trash2 size={16} aria-hidden="true" />{" "}
                {deleting ? "Deleting…" : "Delete plan"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
