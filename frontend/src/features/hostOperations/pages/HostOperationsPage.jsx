import {
  BadgeCheck,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  KeyRound,
  LoaderCircle,
  MapPinned,
  Megaphone,
  PackageSearch,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
  WalletCards,
  Webhook,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useSearchParams } from "react-router-dom";

import { listHostBrandAuthorities } from "../../brands/services/brandAuthority.service";

import { searchCommunityIngredients } from "../../community/services/community.service";

import {
  createServiceArea,
  listServiceAreas,
  updateServiceArea,
} from "../../marketplace/services/marketplace.service";

import { uploadRecipeImage } from "../../recipes/services/recipe.service";

import {
  addHostTeamMember,
  createHostRecipeListing,
  createHostCampaign,
  createHostCatalogImport,
  createHostOperationalOrganization,
  createHostServiceAccount,
  createHostWebhook,
  getHostDataQuality,
  getHostFinanceSummary,
  getHostCommercialProfile,
  getHostKyb,
  getHostOperationalOrganization,
  getHostOperationalReadiness,
  getHostOperationsErrorMessage,
  getHostRecipeListing,
  listHostRecipeListings,
  listHostCampaigns,
  listHostCatalogImports,
  listHostDocuments,
  listHostOperationsAudit,
  listHostServiceAccounts,
  listHostSettlements,
  listHostTeam,
  listHostWebhooks,
  registerHostDocument,
  requestHostOperationalActivation,
  rotateHostServiceAccountCredential,
  rotateHostWebhookSecret,
  saveHostKyb,
  submitHostCampaign,
  submitHostKyb,
  updateHostOperationalProfile,
  updateHostRecipeListing,
} from "../services/hostOperations.service";

const inputClass =
  "focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none";

const recipeInputClass =
  "focus-ring w-full rounded-[10px] border border-stone-200 bg-white px-3 py-2 text-[12px] font-semibold text-stone-900 outline-none sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm";

const buttonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50";

const settingsInputClass =
  "focus-ring w-full min-w-0 rounded-[10px] border border-white/90 bg-white/90 px-2.5 py-2 text-[11px] font-semibold text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] outline-none sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-sm";

const settingsButtonClass =
  "focus-ring inline-flex min-h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[#176a55] px-3 py-2 text-[10px] font-black text-white shadow-[0_5px_14px_rgba(23,106,85,0.14)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm";

function money(amountMinor, currency = "INR") {
  if (amountMinor === null || amountMinor === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",

    currency,

    maximumFractionDigits: 2,
  }).format(Number(amountMinor) / 100);
}

function titleize(value) {
  return String(value || "unknown")
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function readinessLabel(value) {
  return (
    {
      profileComplete: "Business profile complete",
      kybApproved: "KYB approved",
      commercialSetupComplete: "Commercial setup complete",
      documentsPresent: "Business documents added",
      catalogValidated: "Product catalog validated",
      activeOfferPresent: "Active customer offer available",
      pricingConfigured: "Pricing ready",
      inventoryObserved: "Stock availability detected",
      serviceabilityConfigured: "Delivery coverage configured",
    }[value] || titleize(value)
  );
}

function qualityIssueLabel(value) {
  return (
    {
      NO_CANONICAL_PRODUCT_MATCH: "Product match needed",
      NPI_REQUIRED: "Product details need review",
      GTIN_MISSING: "Barcode / GTIN missing",
      INGREDIENT_EVIDENCE_MISSING: "Ingredients need checking",
      ALLERGEN_EVIDENCE_INCOMPLETE: "Allergen details incomplete",
      NUTRITION_INCOMPLETE: "Nutrition details incomplete",
      PROVENANCE_REVIEW_REQUIRED: "Origin details need review",
      NET_QUANTITY_INCOMPLETE: "Pack size incomplete",
      PACK_IMAGE_MISSING: "Pack image missing",
      NOT_RECIPE_ELIGIBLE: "Not ready for Recipes yet",
      INSUFFICIENT_PRODUCT_IDENTITY: "Product identity incomplete",
    }[value] || titleize(value)
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
  actions = null,
  tone = "plain",
}) {
  const toneStyles = {
    readiness: {
      section: "border-emerald-300 bg-emerald-100/70",
      icon: "bg-emerald-200 text-emerald-800",
    },
    profile: {
      section: "border-sky-300 bg-sky-100/70",
      icon: "bg-sky-200 text-sky-800",
    },
    delivery: {
      section: "border-cyan-300 bg-cyan-100/70",
      icon: "bg-cyan-200 text-cyan-800",
    },
    kyb: {
      section: "border-violet-300 bg-violet-100/70",
      icon: "bg-violet-200 text-violet-800",
    },
    recipe: {
      section: "border-[#d8e7e2] bg-[#f8fbfa]",
      icon: "bg-[#dcefe7] text-[#276454]",
    },
    finance: {
      section: "border-[#d8e4ec] bg-[#f4f8fb]",
      icon: "bg-[#dcecf6] text-[#2b6078]",
    },
    settingsMint: {
      section: "border-[#d4eadf] bg-[#edf7f2]",
      icon: "bg-[#dcefe7] text-[#276454]",
    },
    settingsBlue: {
      section: "border-[#d6e7f2] bg-[#eef5fa]",
      icon: "bg-[#dcecf6] text-[#315d74]",
    },
    settingsLavender: {
      section: "border-[#e4daf3] bg-[#f4f0fa]",
      icon: "bg-[#e9e1f4] text-[#5d4a73]",
    },
    plain: {
      section: "border-stone-200 bg-white",
      icon: "bg-stone-100 text-stone-700",
    },
  };

  const activeTone = toneStyles[tone] || toneStyles.plain;
  const compactDashboardTone = ["readiness", "profile", "delivery", "kyb"].includes(tone);
  const compactRecipeTone = tone === "recipe";
  const compactFinanceTone = tone === "finance";
  const compactSettingsTone = ["settingsMint", "settingsBlue", "settingsLavender"].includes(tone);
  const sectionClass = compactDashboardTone
    ? `rounded-[20px] border ${activeTone.section} p-3.5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[26px] sm:p-6`
    : compactSettingsTone
      ? `rounded-[20px] border ${activeTone.section} p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
      : compactRecipeTone || compactFinanceTone
        ? `rounded-[18px] border ${activeTone.section} p-3 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[24px] sm:p-5`
        : `rounded-[26px] border ${activeTone.section} p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:p-6`;

  return (
    <section className={sectionClass}>
      <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"}>
        <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "flex min-w-0 items-start gap-2 sm:gap-3" : "flex items-start gap-3"}>
          <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone
            ? `grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${activeTone.icon}`
            : `grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${activeTone.icon}`}>
            <Icon className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "h-4 w-4 sm:h-[18px] sm:w-[18px]" : "h-[18px] w-[18px]"} />
          </div>

          <div className={compactDashboardTone || compactRecipeTone || compactFinanceTone || compactSettingsTone ? "min-w-0 flex-1" : ""}>
            <h2 className={compactDashboardTone
              ? `${["Commercial profile", "Delivery Areas", "Business verification (KYB)"].includes(title) ? "text-[12px] leading-[14px]" : "text-[14px] leading-4"} whitespace-nowrap font-black text-stone-950 sm:whitespace-normal sm:text-lg sm:leading-normal`
              : compactSettingsTone
                ? "text-[14px] font-black leading-[18px] text-stone-950 sm:text-[17px] sm:leading-5"
                : compactRecipeTone || compactFinanceTone
                  ? "text-[13px] font-black leading-4 text-stone-950 sm:text-[17px] sm:leading-5"
                : "text-lg font-black text-stone-950"}>{title}</h2>

            {description ? (
              <p className={compactDashboardTone
                ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5"
                : compactSettingsTone
                  ? "mt-1 max-w-3xl text-[10px] font-semibold leading-[15px] text-stone-600 sm:text-[11px] sm:font-medium sm:leading-4"
                  : compactRecipeTone || compactFinanceTone
                    ? "mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-medium sm:leading-4"
                  : "mt-1 max-w-3xl text-xs leading-5 text-stone-500"}>
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions}
      </div>

      <div className={compactSettingsTone ? "mt-4 sm:mt-4" : compactDashboardTone || compactRecipeTone || compactFinanceTone ? "mt-3 sm:mt-4" : "mt-5"}>{children}</div>
    </section>
  );
}

function Field({ label, children, compactMobile = false }) {
  return (
    <label className="block">
      <span
        className={
          compactMobile
            ? "mb-1 flex min-h-[22px] items-end text-[8px] font-black uppercase leading-[11px] tracking-[0.1em] text-stone-500 sm:mb-1.5 sm:min-h-0 sm:block sm:text-[10px] sm:leading-normal sm:tracking-[0.12em]"
            : "mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-stone-500"
        }
      >
        {label}
      </span>

      {children}
    </label>
  );
}

const RECIPE_UNITS = [
  "mg",
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "piece",
  "slice",
  "clove",
  "bunch",
  "pinch",
];

const RECIPE_ROLES = [
  "main",
  "base",
  "seasoning",
  "garnish",
  "liquid",
  "fat",
  "binder",
  "leavening",
  "sauce",
  "other",
];

const RECIPE_FOOD_NUTRIENTS = [
  { key: "energy", label: "Energy", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbohydrate", label: "Carbohydrate", unit: "g" },
  { key: "total_fat", label: "Total fat", unit: "g" },
  { key: "saturated_fat", label: "Saturated fat", unit: "g" },
  { key: "fiber", label: "Dietary fibre", unit: "g" },
  { key: "total_sugars", label: "Total sugars", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

const RECIPE_FOOD_ALLERGENS = [
  { key: "milk", label: "Milk" },
  { key: "egg", label: "Egg" },
  { key: "peanuts", label: "Peanuts" },
  { key: "tree_nuts", label: "Tree nuts" },
  { key: "wheat_gluten", label: "Wheat / gluten" },
  { key: "soy", label: "Soy" },
  { key: "sesame", label: "Sesame" },
  { key: "fish", label: "Fish" },
  { key: "shellfish", label: "Shellfish" },
];

function newRecipeFoodIntelligence() {
  return {
    nutrition: Object.fromEntries(
      RECIPE_FOOD_NUTRIENTS.map((field) => [field.key, ""])
    ),
    allergens: Object.fromEntries(
      RECIPE_FOOD_ALLERGENS.map((field) => [field.key, ""])
    ),
    dietaryClassification: "not_declared",
    basis: "Per serving. Host declaration from the submitted Recipe formulation.",
    reason: "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function newRecipeIngredient() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ingredientQuery: "",
    canonicalIngredientId: "",
    ingredientName: "",
    quantity: 1,
    unit: "g",
    role: "main",
    preparationState: "",
  };
}

function newRecipeStep() {
  return {
    rowId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    instruction: "",
    timerMinutes: "",
  };
}

function newHostRecipeForm() {
  return {
    title: "",
    description: "",
    cuisine: "",
    course: "",
    heroImageUrl: "",
    baseServings: 4,
    preparationTimeMinutes: 10,
    cookingTimeMinutes: 20,
    difficulty: "easy",
    ingredients: [newRecipeIngredient()],
    steps: [newRecipeStep()],
    foodIntelligence: newRecipeFoodIntelligence(),
  };
}

function buildHostFoodIntelligencePayload(form) {
  const source = form.foodIntelligence || newRecipeFoodIntelligence();

  const nutrition = RECIPE_FOOD_NUTRIENTS.map((field) => {
    const raw = source.nutrition?.[field.key];

    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }

    const amount = Number(raw);

    if (!Number.isFinite(amount) || amount < 0) {
      return null;
    }

    return {
      key: field.key,
      amount,
      unit: field.unit,
    };
  }).filter(Boolean);

  const allergens = RECIPE_FOOD_ALLERGENS.map((field) => {
    const relationship = source.allergens?.[field.key] || "";

    return relationship
      ? {
          key: field.key,
          canonicalName: field.label,
          relationship,
        }
      : null;
  }).filter(Boolean);

  const dietaryClassification =
    source.dietaryClassification || "not_declared";

  const hasDeclaration =
    nutrition.length > 0 ||
    allergens.length > 0 ||
    dietaryClassification !== "not_declared";

  if (!hasDeclaration) {
    return null;
  }

  return {
    jurisdictionCode: "IN",
    nutrition,
    allergens,
    dietaryClassification,
    basis:
      source.basis?.trim() ||
      "Per serving. Host declaration from the submitted Recipe formulation.",
    reason:
      source.reason?.trim() ||
      "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function hostFoodIntelligenceFromDetail(result) {
  const initial = newRecipeFoodIntelligence();
  const snapshot =
    result?.foodIntelligence?.latest ||
    result?.foodIntelligence?.latestApproved ||
    null;
  const declaration = snapshot?.declaration || null;

  if (!declaration) {
    return initial;
  }

  const nutrition = { ...initial.nutrition };
  for (const item of declaration.nutrition || []) {
    if (Object.hasOwn(nutrition, item.key)) {
      nutrition[item.key] = item.amount ?? "";
    }
  }

  const allergens = { ...initial.allergens };
  for (const item of declaration.allergens || []) {
    if (Object.hasOwn(allergens, item.key)) {
      allergens[item.key] = item.relationship || "";
    }
  }

  return {
    nutrition,
    allergens,
    dietaryClassification:
      declaration.dietaryClassification || "not_declared",
    basis: declaration.basis || initial.basis,
    reason:
      "Host-provided Recipe Food Intelligence declaration for Super Admin review.",
  };
}

function buildHostRecipePayload(form) {
  const foodIntelligence = buildHostFoodIntelligencePayload(form);

  return {
    name: form.title.trim(),
    description: form.description.trim(),
    cuisine: form.cuisine.trim(),
    course: form.course.trim(),
    tags: ["host-recipe"],
    language: "en",
    heroImageUrl: form.heroImageUrl.trim(),
    title: form.title.trim(),
    recipeDescription: form.description.trim(),
    baseServings: Number(form.baseServings),
    servingSizeAmount: null,
    servingSizeUnit: null,
    finishedYieldAmount: null,
    finishedYieldUnit: null,
    scalingMethod: "linear",
    minRecommendedServings: null,
    maxRecommendedServings: null,
    preparationTimeMinutes: Number(form.preparationTimeMinutes || 0),
    cookingTimeMinutes: Number(form.cookingTimeMinutes || 0),
    difficulty: form.difficulty,
    unsafeIncomplete: false,
    unsafeIncompleteReason: "",
    ingredients: form.ingredients.map((ingredient, index) => ({
      lineNumber: index + 1,
      canonicalIngredientId: ingredient.canonicalIngredientId || "",
      proposedIngredientName: ingredient.canonicalIngredientId
        ? ""
        : ingredient.ingredientQuery.trim(),
      quantity: Number(ingredient.quantity),
      unit: ingredient.unit,
      preparationState: ingredient.preparationState.trim(),
      optional: false,
      role: ingredient.role,
      notes: "",
      substitutionGroupKey: "",
      productConstraints: [],
      scalingRule: {
        type: "linear",
        exponent: 1,
        minMultiplier: null,
        maxMultiplier: null,
      },
    })),
    steps: form.steps.map((step, index) => ({
      stepNumber: index + 1,
      instruction: step.instruction.trim(),
      timerSeconds:
        step.timerMinutes === "" || step.timerMinutes === null
          ? null
          : Math.round(Number(step.timerMinutes) * 60),
      temperatureValue: null,
      temperatureUnit: null,
      equipment: [],
      parallelizable: false,
      prepAhead: false,
    })),
    substitutions: [],
    ...(foodIntelligence ? { foodIntelligence } : {}),
  };
}

function hostRecipeFormFromDetail(result) {
  const recipe = result?.recipe || result || {};
  const dish = recipe?.dish || {};
  const version = recipe?.recipeVersion || {};
  const ingredients = Array.isArray(recipe?.ingredients)
    ? recipe.ingredients
    : [];
  const steps = Array.isArray(recipe?.steps) ? recipe.steps : [];

  return {
    title: version.title || dish.name || "",
    description: version.description || dish.description || "",
    cuisine: dish.cuisine || "",
    course: dish.course || "",
    heroImageUrl: dish.heroImageUrl || "",
    baseServings: Number(version.baseServings || 4),
    preparationTimeMinutes: Number(version.preparationTimeMinutes || 0),
    cookingTimeMinutes: Number(version.cookingTimeMinutes || 0),
    difficulty: version.difficulty || "easy",
    ingredients: ingredients.length
      ? ingredients.map((ingredient) => {
          const canonicalName =
            ingredient?.canonicalIngredient?.canonicalName || "";

          return {
            ...newRecipeIngredient(),
            ingredientQuery: canonicalName,
            canonicalIngredientId: ingredient.canonicalIngredientId || "",
            ingredientName: canonicalName,
            quantity: Number(ingredient.quantity || 1),
            unit: ingredient.unit || "g",
            role: ingredient.role || "main",
            preparationState: ingredient.preparationState || "",
          };
        })
      : [newRecipeIngredient()],
    steps: steps.length
      ? steps.map((step) => ({
          ...newRecipeStep(),
          instruction: step.instruction || "",
          timerMinutes:
            step.timerSeconds === null || step.timerSeconds === undefined
              ? ""
              : Number(step.timerSeconds) / 60,
        }))
      : [newRecipeStep()],
    foodIntelligence: hostFoodIntelligenceFromDetail(result),
  };
}

function HostRecipeIngredientRow({
  ingredient,
  onChange,
  onRemove,
  canRemove,
}) {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [ingredientInputFocused, setIngredientInputFocused] = useState(false);

  useEffect(() => {
    const query = ingredient.ingredientQuery.trim();

    if (
      ingredient.canonicalIngredientId &&
      query === ingredient.ingredientName
    ) {
      setResults([]);
      return undefined;
    }

    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);

      try {
        const result = await searchCommunityIngredients({
          search: query,
          limit: 10,
        });

        if (!cancelled) {
          setResults(result?.ingredients || []);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    ingredient.ingredientQuery,
    ingredient.canonicalIngredientId,
    ingredient.ingredientName,
  ]);

  return (
    <div className="rounded-[14px] border border-[#dbe7e2] bg-[#f5f8f7] p-2 sm:rounded-2xl sm:p-3">
      <div className="grid gap-1.5 sm:gap-2 lg:grid-cols-[minmax(0,1.5fr)_110px_110px_140px_minmax(0,1fr)_44px]">
        <div className="relative">
          <input
            className={recipeInputClass}
            value={ingredient.ingredientQuery}
            onFocus={() => setIngredientInputFocused(true)}
            onBlur={() => setIngredientInputFocused(false)}
            onChange={(event) =>
              onChange({
                ingredientQuery: event.target.value,
                canonicalIngredientId: "",
                ingredientName: "",
              })
            }
            placeholder="Search ingredient"
          />

          {ingredient.canonicalIngredientId ? (
            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-[10px]">
              Ingredient matched
            </p>
          ) : null}

          {searching ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white p-2.5 text-[10px] font-semibold text-stone-500 shadow-lg sm:p-3 sm:text-xs">
              Searching ingredients…
            </div>
          ) : results.length ? (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    onChange({
                      canonicalIngredientId: result.id,
                      ingredientName: result.canonicalName,
                      ingredientQuery: result.canonicalName,
                    });
                    setResults([]);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs font-bold hover:bg-emerald-50"
                >
                  {result.canonicalName}
                </button>
              ))}
            </div>
          ) : ingredientInputFocused &&
            ingredient.ingredientQuery.trim().length >= 2 &&
            !ingredient.canonicalIngredientId ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-[10px] font-semibold leading-4 text-sky-800 shadow-lg sm:p-3 sm:text-xs">
              EPANTRY could not match this ingredient yet. It will be included with the Recipe for review.
            </div>
          ) : null}
        </div>

        <input
          type="number"
          min="0.001"
          step="any"
          className={recipeInputClass}
          value={ingredient.quantity}
          onChange={(event) =>
            onChange({ quantity: Number(event.target.value) })
          }
          placeholder="Qty"
        />

        <select
          className={recipeInputClass}
          value={ingredient.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        >
          {RECIPE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>

        <select
          className={recipeInputClass}
          value={ingredient.role}
          onChange={(event) => onChange({ role: event.target.value })}
        >
          {RECIPE_ROLES.map((role) => (
            <option key={role} value={role}>
              {titleize(role)}
            </option>
          ))}
        </select>

        <input
          className={recipeInputClass}
          value={ingredient.preparationState}
          onChange={(event) =>
            onChange({ preparationState: event.target.value })
          }
          placeholder="Prep note"
        />

        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          className="focus-ring min-h-9 rounded-[10px] border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:rounded-xl sm:text-sm"
          aria-label="Remove ingredient"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function parseCsv(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].split(",").map((value) => value.trim());

  return rows.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());

    const record = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );

    return {
      merchantSku: record.merchantSku || "",

      gtin: record.gtin || "",

      packId: record.packId || null,

      displayName: record.displayName || "",

      brandName: record.brandName || "",

      netQuantityText: record.netQuantityText || "",

      priceMinor: record.priceMinor === "" ? null : Number(record.priceMinor),

      inventoryQuantity:
        record.inventoryQuantity === ""
          ? null
          : Number(record.inventoryQuantity),
    };
  });
}

export default function HostOperationsPage({ section = "dashboard" }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const requestedEditRecipeId = String(
    searchParams.get("editRecipe") || ""
  ).trim();

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [organizationData, setOrganizationData] = useState(null);

  const [readiness, setReadiness] = useState(null);

  const [serviceAreas, setServiceAreas] = useState([]);

  const [quality, setQuality] = useState(null);

  const [imports, setImports] = useState([]);

  const [finance, setFinance] = useState(null);

  const [settlements, setSettlements] = useState([]);

  const [hostRecipes, setHostRecipes] = useState([]);

  const [campaigns, setCampaigns] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [team, setTeam] = useState(null);

  const [serviceAccounts, setServiceAccounts] = useState([]);

  const [webhooks, setWebhooks] = useState([]);

  const [audit, setAudit] = useState([]);

  const [authorities, setAuthorities] = useState([]);

  const [oneTimeSecret, setOneTimeSecret] = useState("");

  const [organizationForm, setOrganizationForm] = useState({
    displayName: "",

    organizationType: "hybrid",
  });

  const [profileForm, setProfileForm] = useState({
    legalEntityName: "",

    businessType: "private_limited",

    jurisdictionCountryCode: "IN",

    line1: "",

    city: "",

    state: "",

    postalCode: "",

    supportEmail: "",

    supportPhone: "",

    settlementCurrency: "INR",

    fulfillmentTypes: ["delivery"],

    cancellationPolicySummary: "",

    returnPolicySummary: "",
  });

  const [savedProfileForm, setSavedProfileForm] = useState(null);

  const [deliveryAreaForm, setDeliveryAreaForm] = useState({
    name: "",

    postalCodes: "",
  });

  const [editingDeliveryAreaId, setEditingDeliveryAreaId] = useState("");

  const [kybForm, setKybForm] = useState({
    legalEntityName: "",

    businessType: "private_limited",

    jurisdictionCountryCode: "IN",

    taxRegistrationType: "GSTIN",

    taxRegistrationValue: "",

    documentIds: "",
  });

  const [kybStatus, setKybStatus] = useState("");

  const [commercialProfileRequest, setCommercialProfileRequest] = useState(null);

  const [documentForm, setDocumentForm] = useState({
    documentType: "food_license",

    label: "",

    providerKey: "private_storage",

    providerAssetId: "",

    originalFileName: "",

    mimeType: "application/pdf",

    bytes: 0,

    checksumSha256: "",
  });

  const [memberForm, setMemberForm] = useState({
    userId: "",

    roleLabel: "Operations Staff",

    permissionKeys: "catalog.read,orders.read",
  });

  const [csvRows, setCsvRows] = useState([]);

  const [csvName, setCsvName] = useState("");

  const [hostRecipeForm, setHostRecipeForm] = useState(
    newHostRecipeForm
  );

  const [editingHostRecipeId, setEditingHostRecipeId] = useState("");

  const [loadingHostRecipeId, setLoadingHostRecipeId] = useState("");

  const [recipeImageUploading, setRecipeImageUploading] = useState(false);

  const [campaignForm, setCampaignForm] = useState({
    authorityGrantId: "",

    title: "",

    objective: "awareness",

    commercialDisclosure: "",

    budgetAmountMinor: 0,
  });

  const [serviceAccountForm, setServiceAccountForm] = useState({
    name: "",

    description: "",

    scopes: "catalog.read,orders.read,finance.read",
  });

  const [webhookForm, setWebhookForm] = useState({
    name: "",

    endpointUrl: "",

    eventTypes: "order.status_changed,settlement.paid",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const org = await getHostOperationalOrganization();

      setOrganizationData(org);

      if (org?.organization?.id) {
        const results = await Promise.allSettled([
          getHostOperationalReadiness(),

          getHostDataQuality(),

          listHostCatalogImports({
            page: 1,
            limit: 20,
          }),

          getHostFinanceSummary(),

          listHostSettlements({
            page: 1,
            limit: 20,
          }),

          listHostRecipeListings(),

          listHostCampaigns(),

          listHostDocuments(),

          listHostTeam(),

          listHostServiceAccounts(),

          listHostWebhooks(),

          listHostOperationsAudit({
            page: 1,
            limit: 25,
          }),

          listHostBrandAuthorities({
            page: 1,
            limit: 100,
            status: "active",
          }),

          getHostKyb(),

          listServiceAreas({
            page: 1,
            limit: 100,
            status: "active",
          }),

          getHostCommercialProfile(),
        ]);

        const value = (index) =>
          results[index].status === "fulfilled" ? results[index].value : null;

        setReadiness(value(0)?.readiness || null);

        setQuality(value(1)?.summary || null);

        setImports(value(2)?.jobs || []);

        setFinance(value(3)?.summary || null);

        setSettlements(value(4)?.settlements || []);

        setHostRecipes(value(5)?.recipes || []);

        setCampaigns(value(6)?.campaignBriefs || []);

        setDocuments(value(7)?.documents || []);

        setTeam(value(8) || null);

        setServiceAccounts(value(9)?.serviceAccounts || []);

        setWebhooks(value(10)?.webhooks || []);

        setAudit(value(11)?.events || []);

        setAuthorities(value(12)?.authorities || []);

        setServiceAreas(value(14)?.serviceAreas || []);

        setCommercialProfileRequest(value(15)?.latestRequest || null);

        const kyb = value(13)?.kyb;

        setKybStatus(kyb?.status || "");

        if (kyb) {
          setKybForm((current) => ({
            ...current,

            legalEntityName: kyb.legalEntityName || "",

            businessType: kyb.businessType || "private_limited",

            jurisdictionCountryCode: kyb.jurisdictionCountryCode || "IN",

            taxRegistrationType:
              kyb.taxRegistration?.registrationType || "GSTIN",

            documentIds: (kyb.documentIds || []).join(","),
          }));
        }

        const profile = org.operationalProfile;

        if (profile) {
          const nextProfileForm = {
            legalEntityName: profile.legalEntityName || "",

            businessType: profile.businessType || "private_limited",

            jurisdictionCountryCode: profile.jurisdictionCountryCode || "IN",

            line1: profile.registeredAddress?.line1 || "",

            city: profile.registeredAddress?.city || "",

            state: profile.registeredAddress?.state || "",

            postalCode: profile.registeredAddress?.postalCode || "",

            supportEmail: profile.supportEmail || "",

            supportPhone: profile.supportPhone || "",

            settlementCurrency: profile.commercial?.settlementCurrency || "INR",

            fulfillmentTypes: profile.commercial?.fulfillmentTypes?.length
              ? profile.commercial.fulfillmentTypes
              : ["delivery"],

            cancellationPolicySummary:
              profile.commercial?.cancellationPolicySummary || "",

            returnPolicySummary: profile.commercial?.returnPolicySummary || "",
          };

          setProfileForm(nextProfileForm);
          setSavedProfileForm(nextProfileForm);
        } else {
          setSavedProfileForm(null);
        }
      }
    } catch (loadError) {
      setError(
        getHostOperationsErrorMessage(
          loadError,
          "Unable to load Host operations workspace."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeAuthorities = useMemo(
    () => authorities.filter((authority) => authority.status === "active"),
    [authorities]
  );

  const profileHasUnsavedChanges = useMemo(() => {
    if (!savedProfileForm) return true;

    return JSON.stringify(profileForm) !== JSON.stringify(savedProfileForm);
  }, [profileForm, savedProfileForm]);

  async function run(action, successMessage = "") {
    setBusy(true);
    setError("");
    setNotice("");
    setOneTimeSecret("");

    try {
      const result = await action();

      if (result?.apiKey) {
        setOneTimeSecret(result.apiKey);
      }

      if (result?.signingSecret) {
        setOneTimeSecret(result.signingSecret);
      }

      if (successMessage) {
        setNotice(successMessage);
      }

      await load();

      return result;
    } catch (operationError) {
      setError(getHostOperationsErrorMessage(operationError));

      return null;
    } finally {
      setBusy(false);
    }
  }

  async function startEditHostRecipe(itemOrId) {
    const recipeVersionId =
      typeof itemOrId === "string"
        ? itemOrId
        : itemOrId?.id || "";

    if (!recipeVersionId || busy || loadingHostRecipeId) {
      return;
    }

    if (typeof itemOrId === "object" && itemOrId?.canEdit === false) {
      return;
    }

    setLoadingHostRecipeId(recipeVersionId);
    setError("");
    setNotice("");

    try {
      const detail = await getHostRecipeListing(recipeVersionId);

      if (detail?.policy?.hostCanEdit === false) {
        throw new Error(
          "This historical Recipe lifecycle state is read-only."
        );
      }

      const listingStatus =
        detail?.listing?.status ||
        itemOrId?.status ||
        "draft";

      setHostRecipeForm(hostRecipeFormFromDetail(detail));
      setEditingHostRecipeId(recipeVersionId);
      setNotice(
        listingStatus === "published"
          ? "Published Recipe loaded. Saving will create a new editable version and submit that revision to Super Admin review; the currently published version stays unchanged until approval."
          : "Recipe loaded for editing. Saving will resubmit the updated Recipe to Super Admin review."
      );

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (operationError) {
      setError(getHostOperationsErrorMessage(operationError));
      clearRecipeEditQuery();
    } finally {
      setLoadingHostRecipeId("");
    }
  }

  useEffect(() => {
    if (
      section !== "recipes" ||
      !requestedEditRecipeId ||
      editingHostRecipeId === requestedEditRecipeId ||
      loadingHostRecipeId
    ) {
      return;
    }

    startEditHostRecipe(requestedEditRecipeId);
  }, [
    section,
    requestedEditRecipeId,
    editingHostRecipeId,
    loadingHostRecipeId,
  ]);

  async function handleHostRecipeImageUpload(file) {
    if (!file || recipeImageUploading) {
      return;
    }

    setRecipeImageUploading(true);
    setError("");
    setNotice("");

    try {
      const uploaded = await uploadRecipeImage({
        file,
        scope: "host",
      });

      setHostRecipeForm((current) => ({
        ...current,
        heroImageUrl: uploaded.heroImageUrl,
      }));

      setNotice(
        editingHostRecipeId
          ? "Recipe image uploaded. Save Recipe Changes to attach it to this listing."
          : "Recipe image uploaded. Submit the Recipe to save it with the listing."
      );
    } catch (uploadError) {
      setError(
        getHostOperationsErrorMessage(
          uploadError,
          "Unable to upload Recipe image."
        )
      );
    } finally {
      setRecipeImageUploading(false);
    }
  }

  function clearRecipeEditQuery() {
    if (!requestedEditRecipeId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("editRecipe");
    setSearchParams(nextParams, { replace: true });
  }

  function cancelHostRecipeEdit() {
    setEditingHostRecipeId("");
    setHostRecipeForm(newHostRecipeForm());
    setNotice("");
    clearRecipeEditQuery();
  }


  const pageTitle =
    {
      dashboard: "Host Operations Center",

      catalog: "Product Catalog",

      quality: "Data Quality",

      finance: "Finance",

      recipes: "Recipe Listings",

      campaigns: "S10 · Campaigns",

      settings: "Business settings",
    }[section] || "Host Operations";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-6">
        <div className="grid min-h-[560px] place-items-center rounded-[28px] border border-stone-200 bg-white">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      </main>
    );
  }

  if (!organizationData?.organization && section === "settings") {
    return (
      <main className="bg-[#f7f5ef] p-5 sm:p-7">
        <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            Host workspace
          </p>

          <h1 className="mt-2 text-3xl font-black text-stone-950">
            Team & Documents
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Manage the people who help run your business and keep important business records together in your Host workspace.
          </p>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Section
            title="Team members"
            description="Add staff members and manage their business access after your Host organization is ready."
            icon={Users}
          >
            <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
              Team management becomes available after the business workspace is initialized. Your existing Host access stays separate from staff assignments.
            </div>
          </Section>

          <Section
            title="Business documents"
            description="Keep the records your business may need for verification and day-to-day operations in one place."
            icon={FileCheck2}
          >
            <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
              Business registration, tax records, food licences, bank proof and authorization documents can be managed here once setup is complete.
            </div>
          </Section>
        </div>

        <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-black text-amber-950">
                Complete the business workspace first
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-800">
                Team and document records belong to your Host organization, so Business Operations needs to be initialized before these tools can be used.
              </p>
            </div>

            <Link
              to="/host/operations-center"
              className="focus-ring inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white"
            >
              Open Business Operations
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!organizationData?.organization) {
    return (
      <main className="bg-[#f7f5ef] p-5 sm:p-7">
        <Section
          title="Initialize Host organization"
          description="Host access already exists through M02. This creates the M05/M16 tenant operating context; it does not create a Seller or Brand login role."
          icon={Building2}
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();

              run(
                () => createHostOperationalOrganization(organizationForm),
                "Host organization initialized."
              );
            }}
          >
            <Field label="Organization name">
              <input
                required
                className={inputClass}
                value={organizationForm.displayName}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,

                    displayName: event.target.value,
                  }))
                }
              />
            </Field>

            <Field label="Commercial profile">
              <select
                className={inputClass}
                value={organizationForm.organizationType}
                onChange={(event) =>
                  setOrganizationForm((current) => ({
                    ...current,

                    organizationType: event.target.value,
                  }))
                }
              >
                <option value="seller">Seller</option>

                <option value="brand">Brand</option>

                <option value="hybrid">Hybrid</option>

                <option value="b2b">Legacy B2B business profile</option>
              </select>
            </Field>

            <button disabled={busy} className={`${buttonClass} sm:col-span-2`}>
              <Building2 size={16} />
              Initialize organization
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          ) : null}
        </Section>
      </main>
    );
  }

  const activationState =
    organizationData?.operationalProfile?.activationState ||
    readiness?.activationState ||
    "onboarding";

  return (
    <main
      className={
        section === "dashboard"
          ? "min-h-screen bg-[#f7f5ef] p-3 sm:p-7"
          : section === "catalog"
            ? "min-h-screen bg-[#f7f5ef] p-3 sm:p-7"
            : section === "quality"
              ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
              : section === "recipes"
                ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                : section === "finance"
                  ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                  : section === "settings"
                    ? "min-h-screen bg-[#f7f5ef] px-2 pb-4 pt-1 sm:px-3 sm:pb-6 sm:pt-1"
                    : "min-h-screen bg-[#f7f5ef] p-5 sm:p-7"
      }
    >
      <section
        className={
          section === "catalog"
            ? "overflow-hidden rounded-[22px] border border-sky-900/10 bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900 p-4 text-white shadow-lg sm:rounded-[28px] sm:p-6"
            : section === "dashboard"
              ? "rounded-[20px] border border-emerald-300 bg-emerald-100/75 p-4 shadow-[0_8px_24px_rgba(28,25,23,0.04)] sm:rounded-[28px] sm:p-6"
              : section === "quality"
                ? "overflow-hidden rounded-[18px] border border-emerald-100 bg-gradient-to-br from-[#e8f4ee] via-[#edf6f3] to-[#e9f1f7] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                : section === "recipes"
                  ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#edf5f3] to-[#e8f1f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                  : section === "finance"
                    ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#edf5f3] to-[#e8f1f8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                    : section === "settings"
                      ? "overflow-hidden rounded-[18px] border border-[#d6e7e1] bg-gradient-to-br from-[#e7f3ed] via-[#eef5f8] to-[#f0ebf8] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.06)] sm:rounded-[26px] sm:p-5"
                      : "rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
        }
      >
        <div
          className={
            section === "dashboard"
              ? "flex items-start justify-between gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
              : section === "catalog"
                ? "flex items-start justify-between gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                : section === "quality"
                  ? "flex items-start justify-between gap-2 sm:gap-4"
                  : section === "recipes"
                    ? "flex items-start justify-between gap-2 sm:gap-4"
                    : section === "finance"
                      ? "flex items-start justify-between gap-2 sm:gap-4"
                      : section === "settings"
                        ? "flex items-start justify-between gap-2 sm:gap-4"
                        : "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          }
        >
          <div
            className={
              section === "dashboard" || section === "catalog" || section === "quality" || section === "recipes" || section === "finance" || section === "settings"
                ? "min-w-0 flex-1"
                : ""
            }
          >
            <p
              className={
                section === "catalog"
                  ? "text-[9px] font-black uppercase tracking-[0.12em] text-cyan-300 sm:text-xs sm:tracking-[0.14em]"
                  : section === "dashboard"
                    ? "text-[9px] font-black uppercase tracking-[0.12em] text-emerald-700 sm:text-xs sm:tracking-[0.14em]"
                    : section === "quality"
                      ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                      : section === "recipes"
                        ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                        : section === "finance"
                          ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                          : section === "settings"
                            ? "text-[8px] font-black uppercase tracking-[0.14em] text-[#276454] sm:text-[10px] sm:tracking-[0.16em]"
                            : "text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
              }
            >
              {section === "settings"
                ? "Business setup"
                : section === "catalog"
                  ? "Product catalog"
                  : section === "quality"
                    ? "Catalog health"
                    : section === "recipes"
                      ? "Recipe workspace"
                      : section === "finance"
                        ? "Earnings & settlements"
                        : "HOST OPERATIONS"}
            </p>

            <h1
              className={
                section === "catalog"
                  ? "mt-1 text-[20px] font-black leading-6 text-white sm:mt-2 sm:text-3xl sm:leading-normal"
                  : section === "dashboard"
                    ? "mt-1 whitespace-nowrap text-[18px] font-black leading-5 text-stone-950 sm:mt-2 sm:text-3xl sm:leading-normal"
                    : section === "quality"
                      ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                      : section === "recipes"
                        ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                        : section === "finance"
                          ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                          : section === "settings"
                            ? "mt-0.5 text-[20px] font-black leading-6 tracking-[-0.03em] text-stone-950 sm:mt-1 sm:text-[32px] sm:leading-[38px]"
                            : "mt-2 text-3xl font-black text-stone-950"
              }
            >
              {pageTitle}
            </h1>

            <p
              className={
                section === "catalog"
                  ? "mt-1 text-[10px] font-semibold leading-4 text-sky-100/80 sm:mt-2 sm:text-sm sm:leading-normal"
                  : section === "dashboard"
                    ? "mt-1 text-[9px] font-semibold leading-3 text-stone-500 sm:mt-2 sm:text-sm sm:font-normal sm:leading-normal"
                    : section === "quality"
                      ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                      : section === "recipes"
                        ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                        : section === "finance"
                          ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                          : section === "settings"
                            ? "mt-1 max-w-2xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:mt-1.5 sm:text-[13px] sm:leading-5"
                            : "mt-2 text-sm text-stone-500"
              }
            >
              {section === "quality" ? (
                <>See what is ready, what still needs attention, and exactly where to continue.</>
              ) : section === "recipes" ? (
                <>Create a complete Recipe, send it for review, then track its publishing status in Listing History.</>
              ) : section === "finance" ? (
                <>See delivered-order earnings, money waiting to settle, and payout history in one place.</>
              ) : section === "settings" ? (
                <>Manage business records, team members and connections to other tools in one place.</>
              ) : (
                <>
                  {organizationData.organization.displayName} · {section === "catalog" ? "Host status" : "Operational state"}:{" "}
                  {titleize(organizationData.operationalProfile?.activationState)}
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className={
              section === "catalog"
                ? "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-[10px] font-black text-white transition hover:bg-white/20 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                : section === "dashboard"
                  ? "focus-ring ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-100 px-2 py-1.5 text-[10px] font-black text-sky-800 sm:ml-0 sm:gap-2 sm:rounded-xl sm:border-stone-200 sm:bg-transparent sm:px-4 sm:py-2.5 sm:text-sm sm:text-stone-950"
                  : section === "quality"
                    ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                    : section === "recipes"
                      ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                      : section === "finance"
                        ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                        : section === "settings"
                          ? "focus-ring inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-[#cfe2db] bg-white/85 px-2.5 py-2 text-[9px] font-black text-[#245c4d] shadow-sm transition hover:bg-white sm:gap-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5 sm:text-xs"
                          : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
            }
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Refresh
          </button>
        </div>

        {section === "quality" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Check your catalog", "See every product EPANTRY has checked.", "bg-[#e8f1f8] border-[#d6e7f2]"],
              ["02", "Read what needs attention", "Spot missing images, nutrition or safety details.", "bg-[#e7f3ed] border-[#d4eadf]"],
              ["03", "Complete product details", "Open Add / Edit Products and fix the missing information.", "bg-[#f0ebf8] border-[#e4daf3]"],
              ["04", "Refresh this page", "Come back after updates to see the latest catalog health.", "bg-[#e8f4ee] border-[#d4eadf]"],
            ].map(([step, label, helper, tone]) => (
              <div
                key={step}
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">
                      {label}
                    </p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">
                      {helper}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section === "recipes" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Add Recipe basics", "Title, servings, timing and image.", "bg-[#e7f3ed] border-[#d4eadf]"],
              ["02", "Build the Recipe", "Add ingredients and cooking steps.", "bg-[#e8f1f8] border-[#d6e7f2]"],
              ["03", "Add food details", "Fill only nutrition and allergen details you can support.", "bg-[#f0ebf8] border-[#e4daf3]"],
              ["04", "Send for review", "Submit, then track approval in Listing History.", "bg-[#e7f3ed] border-[#d4eadf]"],
            ].map(([step, label, helper, tone]) => (
              <div
                key={step}
                className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section === "finance" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Check delivered sales", "See orders that have reached customers.", "bg-[#e7f3ed] border-[#d4eadf]", ""],
              ["02", "See money waiting", "Know what is delivered but not settled yet.", "bg-[#e8f1f8] border-[#d6e7f2]", ""],
              ["03", "Review payouts", "Track each recorded settlement and amount.", "bg-[#f0ebf8] border-[#e4daf3]", ""],
              ["04", "Manage active orders", "Open Orders for work still in progress.", "bg-[#e7f3ed] border-[#d4eadf]", "/host/orders"],
            ].map(([step, label, helper, tone, to]) => {
              const card = (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
                  </div>
                </div>
              );

              return to ? (
                <Link
                  key={step}
                  to={to}
                  className={`focus-ring min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(28,25,23,0.07)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={step}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </div>
              );
            })}
          </div>
        ) : null}

        {section === "settings" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Save business records", "Keep licences and other important records together.", "bg-[#e7f3ed] border-[#d4eadf]", ""],
              ["02", "Add your team", "Choose who can work on this business.", "bg-[#e8f1f8] border-[#d6e7f2]", ""],
              ["03", "Connect other tools", "Only if another app needs EPANTRY data or updates.", "bg-[#f0ebf8] border-[#e4daf3]", ""],
              ["04", "Back to operations", "Return to day-to-day business management.", "bg-[#e7f3ed] border-[#d4eadf]", "/host/operations-center"],
            ].map(([step, label, helper, tone, to]) => {
              const card = (
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#173f35] text-[8px] font-black text-white sm:h-8 sm:w-8 sm:text-[10px]">
                    {step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black leading-[12px] text-stone-950 sm:text-sm sm:leading-4">{label}</p>
                    <p className="mt-1 text-[8px] font-semibold leading-[11px] text-stone-600 sm:mt-1.5 sm:text-[11px] sm:leading-4">{helper}</p>
                  </div>
                </div>
              );

              return to ? (
                <Link
                  key={step}
                  to={to}
                  className={`focus-ring min-w-0 rounded-[16px] border p-3 shadow-[0_5px_14px_rgba(28,25,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(28,25,23,0.07)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </Link>
              ) : (
                <div
                  key={step}
                  className={`min-w-0 rounded-[16px] border p-3 shadow-[0_5px_14px_rgba(28,25,23,0.04)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  {card}
                </div>
              );
            })}
          </div>
        ) : null}

        {section === "catalog" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            {[
              ["01", "Choose CSV", "Select your product file"],
              ["02", "Check products", "Match products with EPANTRY"],
              ["03", "Review results", "See matched or flagged items"],
              ["04", "Finish listings", "Add offer, price and stock"],
            ].map(([step, label, helper]) => (
              <div
                key={step}
                className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 backdrop-blur-sm sm:rounded-2xl sm:px-4 sm:py-3"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-300 text-[9px] font-black text-slate-950 sm:h-8 sm:w-8 sm:text-xs">
                    {step}
                  </span>
                  <div>
                    <p className="text-[10px] font-black leading-3 text-white sm:text-sm sm:leading-normal">{label}</p>
                    <p className="mt-0.5 text-[8px] font-semibold leading-[11px] text-sky-100/70 sm:text-[11px] sm:leading-normal">
                      {helper}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={17} className="mt-0.5" />

          {error}
        </div>
      ) : null}

      {notice &&
      !(
        activationState === "active" &&
        notice === "Activation review requested."
      ) ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      {oneTimeSecret ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            Shown once — copy now
          </p>

          <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs font-bold text-stone-900">
            {oneTimeSecret}
          </code>
        </div>
      ) : null}

      {section === "dashboard" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title="Operational readiness"
            description="Complete each readiness check before launch approval."
            icon={ShieldCheck}
            tone="readiness"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {Object.entries(readiness?.checks || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex min-w-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white/78 p-2 sm:gap-2 sm:rounded-2xl sm:p-3"
                >
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${value ? "text-emerald-700" : "text-stone-300"}`}
                  />

                  <span className="text-[9px] font-bold leading-3 text-stone-700 sm:text-xs sm:leading-normal">
                    {readinessLabel(key)}
                  </span>
                </div>
              ))}
            </div>

            {activationState === "active" ? (
              <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-200/60 p-2.5 text-[10px] font-bold leading-4 text-emerald-900 sm:mt-4 sm:gap-2 sm:rounded-2xl sm:p-4 sm:text-sm sm:leading-normal">
                <ShieldCheck className="h-4 w-4 shrink-0 sm:h-[17px] sm:w-[17px]" />
                <span className="sm:hidden">Your Host business is live and ready. No further launch review is needed.</span>
                <span className="hidden sm:inline">Your Host business is live and ready to operate. No further launch review is needed.</span>
              </div>
            ) : activationState === "pending_review" ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <Send size={16} />
                Activation review requested. Awaiting Super Admin decision.
              </div>
            ) : activationState === "suspended" ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                Host operations are suspended. Super Admin review is required before commerce can resume.
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || !readiness?.readyForActivationRequest}
                onClick={() =>
                  run(
                    () =>
                      requestHostOperationalActivation(
                        "Host confirms KYB, catalog, inventory, pricing, serviceability and test-order readiness."
                      ),
                    "Activation review requested."
                  )
                }
                className={`${buttonClass} mt-4`}
              >
                <Send size={15} />
                Request go-live review
              </button>
            )}
          </Section>

          <Section
            title="Commercial profile"
            description={<>
              <span className="sm:hidden">Keep core business details accurate. Pricing, offers and delivery coverage are checked separately.</span>
              <span className="hidden sm:inline">Keep the business details customers and operations rely on accurate before launch. Pricing, offers and delivery coverage are checked separately.</span>
            </>}
            icon={Building2}
            tone="profile"
          >
            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    updateHostOperationalProfile({
                      legalEntityName: profileForm.legalEntityName,

                      businessType: profileForm.businessType,

                      jurisdictionCountryCode:
                        profileForm.jurisdictionCountryCode,

                      registeredAddress: {
                        line1: profileForm.line1,

                        line2: "",

                        city: profileForm.city,

                        state: profileForm.state,

                        postalCode: profileForm.postalCode,

                        countryCode: profileForm.jurisdictionCountryCode,
                      },

                      supportEmail: profileForm.supportEmail,

                      supportPhone: profileForm.supportPhone,

                      commercial: {
                        settlementCurrency: profileForm.settlementCurrency,

                        fulfillmentTypes: profileForm.fulfillmentTypes,

                        cancellationPolicySummary:
                          profileForm.cancellationPolicySummary,

                        returnPolicySummary: profileForm.returnPolicySummary,
                      },
                    }),
                  "Operational profile saved."
                );
              }}
            >
              <Field compactMobile label="Legal entity">
                <input
                  required
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.legalEntityName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Business type">
                <select
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.businessType}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      businessType: event.target.value,
                    }))
                  }
                >
                  <option value="private_limited">Private limited</option>

                  <option value="proprietorship">Proprietorship</option>

                  <option value="partnership">Partnership</option>

                  <option value="llp">LLP</option>

                  <option value="public_limited">Public limited</option>

                  <option value="other">Other</option>
                </select>
              </Field>

              <Field compactMobile label="Registered address">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.line1}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      line1: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="City">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.city}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      city: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="State">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.state}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      state: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Store / warehouse postal code">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={profileForm.postalCode}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      postalCode: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="col-span-2 sm:col-span-1">
                <Field compactMobile label="Cancellation policy">
                  <textarea
                    required
                    rows={3}
                    className={`${inputClass} px-2.5 py-2 text-[11px] sm:px-3.5 sm:py-2.5 sm:text-sm`}
                    value={profileForm.cancellationPolicySummary}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,

                        cancellationPolicySummary: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Field compactMobile label="Return policy">
                  <textarea
                    required
                    rows={3}
                    className={`${inputClass} px-2.5 py-2 text-[11px] sm:px-3.5 sm:py-2.5 sm:text-sm`}
                    value={profileForm.returnPolicySummary}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,

                        returnPolicySummary: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                disabled={busy || !profileHasUnsavedChanges}
                className={`${buttonClass} col-span-2 ${
                  !profileHasUnsavedChanges
                    ? "cursor-not-allowed opacity-45 shadow-none"
                    : ""
                }`}
              >
                <Save size={15} />
                {profileHasUnsavedChanges ? "Save profile" : "Profile saved"}
              </button>
            </form>
          </Section>

          <Section
            title="Delivery Areas"
            description={<>
              <span className="sm:hidden">Choose the customer pincodes you deliver to. These stay separate from your business postcode.</span>
              <span className="hidden sm:inline">Choose the customer pincodes your business can deliver to. These are separate from your registered business postcode.</span>
            </>}
            icon={MapPinned}
            tone="delivery"
          >
            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                const postalCodes = deliveryAreaForm.postalCodes
                  .split(/[\s,]+/)
                  .map((value) => value.trim())
                  .filter(Boolean);

                const payload = {
                  name: deliveryAreaForm.name.trim(),

                  inventoryNodeId: null,

                  postalCodes,

                  fulfillmentTypes: ["delivery"],
                };

                const normalizedKey = deliveryAreaForm.name
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "");

                const matchingArea = serviceAreas.find(
                  (area) => area.serviceAreaKey === normalizedKey
                );

                const targetAreaId =
                  editingDeliveryAreaId || matchingArea?.id || "";

                run(
                  () =>
                    targetAreaId
                      ? updateServiceArea(targetAreaId, payload)
                      : createServiceArea(payload),
                  targetAreaId
                    ? "Delivery area updated."
                    : "Delivery area saved."
                ).then((result) => {
                  if (result) {
                    setDeliveryAreaForm({
                      name: "",

                      postalCodes: "",
                    });

                    setEditingDeliveryAreaId("");
                  }
                });
              }}
            >
              <Field compactMobile label="Delivery area name">
                <input
                  required
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={deliveryAreaForm.name}
                  onChange={(event) =>
                    setDeliveryAreaForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Delhi Central"
                />
              </Field>

              <Field compactMobile label="Delivery postal codes">
                <textarea
                  required
                  rows={2}
                  className={`${inputClass} h-9 resize-none px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={deliveryAreaForm.postalCodes}
                  onChange={(event) =>
                    setDeliveryAreaForm((current) => ({
                      ...current,

                      postalCodes: event.target.value,
                    }))
                  }
                  placeholder="110001, 110002, 110003"
                />
              </Field>

              <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                <button
                  disabled={busy}
                  className={`${buttonClass} w-full whitespace-nowrap sm:w-auto`}
                >
                  <MapPinned size={15} />
                  {editingDeliveryAreaId
                    ? "Update delivery area"
                    : "Save delivery area"}
                </button>

                {editingDeliveryAreaId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingDeliveryAreaId("");
                      setDeliveryAreaForm({
                        name: "",
                        postalCodes: "",
                      });
                    }}
                    className="focus-ring rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-black text-stone-700"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>

            <p className="mt-1.5 text-[10px] font-semibold leading-4 text-stone-500 sm:mt-2 sm:text-xs sm:leading-5">
              <span className="sm:hidden">Add 6-digit delivery pincodes so customers can see where you deliver.</span>
              <span className="hidden sm:inline">Add the 6-digit pincodes where you can deliver. Customers will see availability based on these service areas.</span>
            </p>

            {serviceAreas.length ? (
              <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {serviceAreas.map((area) => (
                  <div
                    key={area.id}
                    className="rounded-xl border border-cyan-200 bg-white/80 p-2.5 sm:rounded-2xl sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black text-cyan-950 sm:text-sm">
                          {area.name}
                        </p>

                        <p className="mt-1 text-[9px] font-semibold leading-3 text-cyan-800 sm:text-xs sm:leading-5">
                          {(area.postalCodes || []).join(", ")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDeliveryAreaId(area.id);
                            setDeliveryAreaForm({
                              name: area.name || "",
                              postalCodes: (area.postalCodes || []).join(", "),
                            });
                          }}
                          className="focus-ring rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-cyan-800 shadow-sm hover:bg-cyan-100"
                        >
                          Edit
                        </button>

                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-cyan-700">
                          {area.status || "active"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-white/70 p-2.5 text-[10px] font-semibold leading-4 text-stone-500 sm:mt-4 sm:rounded-2xl sm:bg-stone-50 sm:p-4 sm:text-sm sm:leading-normal">
                <span className="sm:hidden">No delivery areas yet. Add pincodes where customers can receive orders.</span>
                <span className="hidden sm:inline">No delivery area added yet. Add the pincodes where customers should be able to receive orders.</span>
              </div>
            )}
          </Section>

          <Section
            title="Business verification (KYB)"
            description={<>
              <span className="sm:hidden">Your tax number stays protected. After saving, EPANTRY shows only the last 4 digits.</span>
              <span className="hidden sm:inline">Your full tax registration number stays protected. After saving, EPANTRY only shows the last 4 digits.</span>
            </>}
            icon={FileCheck2}
            tone="kyb"
          >
            {kybStatus ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-3.5 py-3">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-xs sm:tracking-[0.12em]">
                  Current KYB status
                </span>

                <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-stone-800 shadow-sm sm:px-2.5 sm:text-xs">
                  {titleize(kybStatus)}
                </span>

                {kybStatus === "draft" ? (
                  <span className="text-xs font-semibold text-amber-700">
                    Draft is saved, but it will not appear in the Super Admin governance queue until Submit succeeds.
                  </span>
                ) : kybStatus === "submitted" ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    Submitted successfully. This case is now eligible for Super Admin review.
                  </span>
                ) : null}
              </div>
            ) : null}

            {notice === "KYB draft saved." ? (
              commercialProfileRequest?.status === "declared" ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-950">
                    Business Profile is already complete. Submit KYB next.
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
                    Your commercial profile has already been saved and Super Admin was notified. Click Submit below to send this KYB for governance review. After submission, wait for Super Admin approval.
                  </p>
                </div>
              ) : (
                <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-sky-950">
                        KYB saved. Complete your Business Profile next.
                      </p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">
                        Open Business Profile, complete that step and notify Super Admin. Then return here and Submit KYB. After submission, wait for Super Admin review.
                      </p>
                    </div>

                    <Link
                      to="/host/business-profile"
                      className="focus-ring inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-black text-white hover:bg-sky-800"
                    >
                      Open Business Profile
                    </Link>
                  </div>
                </div>
              )
            ) : null}

            <form
              className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    saveHostKyb({
                      ...kybForm,

                      documentIds: kybForm.documentIds
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "KYB draft saved."
                );
              }}
            >
              <Field compactMobile label="Legal entity">
                <input
                  required
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.legalEntityName}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Tax registration">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.taxRegistrationValue}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      taxRegistrationValue: event.target.value,
                    }))
                  }
                  placeholder="Value is never returned after save"
                />
              </Field>

              <Field compactMobile label="Evidence document IDs">
                <input
                  className={`${inputClass} h-9 px-2.5 py-2 text-[11px] sm:h-auto sm:px-3.5 sm:py-2.5 sm:text-sm`}
                  value={kybForm.documentIds}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      documentIds: event.target.value,
                    }))
                  }
                  placeholder="comma-separated document IDs"
                />
              </Field>

              <div className="grid grid-cols-2 items-end gap-1.5 sm:flex sm:gap-2">
                <button disabled={busy} className={`${buttonClass} h-9 w-full gap-1 px-1.5 py-0 text-[9px] sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm`}>
                  <Save className="h-3.5 w-3.5 sm:h-[15px] sm:w-[15px]" />
                  Save KYB
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      async () => {
                        await saveHostKyb({
                          ...kybForm,

                          documentIds: kybForm.documentIds
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        });

                        return submitHostKyb();
                      },
                      "KYB submitted for governance review."
                    )
                  }
                  className="focus-ring h-9 w-full rounded-xl border border-stone-300 px-1.5 py-0 text-[9px] font-black sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </Section>
        </div>
      ) : null}

      {section === "catalog" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <section className="overflow-hidden rounded-[22px] border border-sky-200 bg-sky-100 shadow-sm sm:rounded-[30px]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="p-3.5 sm:p-7">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-700 text-white shadow-md sm:h-12 sm:w-12 sm:rounded-2xl">
                    <Upload size={20} />
                  </div>

                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-sky-700 sm:text-[10px] sm:tracking-[0.14em]">
                      Upload products
                    </p>
                    <h2 className="mt-0.5 text-[15px] font-black leading-5 text-sky-950 sm:mt-1 sm:text-xl sm:leading-normal">
                      Upload your product CSV
                    </h2>
                    <p className="mt-0.5 max-w-2xl text-[9px] font-semibold leading-[13px] text-sky-900/70 sm:mt-1 sm:text-xs sm:leading-5">
                      <span className="sm:hidden">Upload the products you sell. EPANTRY checks matches and flags anything that needs review.</span>
                      <span className="hidden sm:inline">Add the products you sell. EPANTRY checks each row, matches known products and flags anything that needs review before listing.</span>
                    </p>
                  </div>
                </div>

                <input
                  id="host-catalog-csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                      return;
                    }

                    setCsvName(file.name);
                    setCsvRows(parseCsv(await file.text()));
                  }}
                  className="sr-only"
                />

                <label
                  htmlFor="host-catalog-csv-input"
                  className="focus-ring group mt-3 flex min-h-[118px] cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-sky-400 bg-white/80 px-4 py-4 text-center shadow-inner transition hover:border-sky-600 hover:bg-white sm:mt-6 sm:min-h-[190px] sm:rounded-[26px] sm:px-6 sm:py-8"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-700 text-white shadow-md transition group-hover:-translate-y-0.5 group-hover:bg-sky-800 sm:h-14 sm:w-14 sm:rounded-2xl">
                    <Upload size={22} />
                  </span>
                  <span className="mt-2 text-[11px] font-black text-sky-950 sm:mt-4 sm:text-base">
                    {csvRows.length ? "Choose a different CSV" : "Choose product CSV"}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold text-sky-800/65 sm:mt-1 sm:text-xs">
                    Browse your device for a .csv file
                  </span>
                </label>

                <div
                  className={`mt-3 rounded-xl border p-3 sm:mt-4 sm:rounded-2xl sm:p-4 ${
                    csvRows.length
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-sky-200 bg-sky-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p
                        className={`text-[11px] font-black sm:text-sm ${
                          csvRows.length ? "text-emerald-950" : "text-sky-950"
                        }`}
                      >
                        {csvRows.length ? csvName : "No file selected"}
                      </p>
                      <p
                        className={`mt-0.5 text-[9px] font-semibold sm:mt-1 sm:text-xs ${
                          csvRows.length ? "text-emerald-800" : "text-sky-800/65"
                        }`}
                      >
                        {csvRows.length
                          ? `${csvRows.length} products are ready to check.`
                          : "Choose a CSV to start checking your products."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.1em] ${
                        csvRows.length
                          ? "bg-emerald-700 text-white"
                          : "bg-sky-200 text-sky-800"
                      }`}
                    >
                      {csvRows.length ? "Ready" : "Waiting"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy || !csvRows.length}
                  onClick={() =>
                    run(
                      () =>
                        createHostCatalogImport({
                          sourceType: "csv_normalized",

                          rows: csvRows,
                        }),
                      "Catalog checked. Review the results below before continuing your listings."
                    )
                  }
                  className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-[10px] font-black text-white shadow-md transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none sm:mt-4 sm:w-auto sm:gap-2 sm:rounded-2xl sm:px-5 sm:py-3.5 sm:text-sm"
                >
                  <PackageSearch size={17} />
                  Check products
                </button>
              </div>

              <aside className="border-t border-sky-200 bg-sky-950 p-3.5 text-white sm:p-7 xl:border-l xl:border-t-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                  CSV format
                </p>
                <h3 className="mt-1 text-[14px] font-black sm:mt-2 sm:text-lg">Use these column headings</h3>
                <p className="mt-1 text-[9px] font-semibold leading-[13px] text-sky-100/70 sm:mt-2 sm:text-xs sm:leading-5">
                  Keep these names exactly as shown so EPANTRY can read every product in your CSV.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-5 sm:block sm:space-y-2">
                  {[
                    "merchantSku",
                    "gtin",
                    "packId",
                    "displayName",
                    "brandName",
                    "netQuantityText",
                    "priceMinor",
                    "inventoryQuantity",
                  ].map((header) => (
                    <div
                      key={header}
                      className="rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[9px] font-bold text-sky-50 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                    >
                      {header}
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 sm:mt-5 sm:rounded-2xl sm:p-4">
                  <p className="text-[9px] font-black text-amber-200 sm:text-xs">
                    Checking products does not publish them.
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-amber-100/75 sm:mt-1 sm:text-xs sm:leading-5">
                    After a match, add the offer, price and stock before customers can buy.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <section className="overflow-hidden rounded-[22px] border border-violet-200 bg-violet-100 shadow-sm sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-2 border-b border-violet-200 bg-violet-700 p-3.5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white sm:h-11 sm:w-11 sm:rounded-2xl">
                  <Boxes size={19} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                    Product check results
                  </p>
                  <h2 className="mt-0.5 text-[14px] font-black sm:mt-1 sm:text-lg">Catalog checks</h2>
                  <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-violet-100/80 sm:mt-1 sm:text-xs sm:leading-normal">
                    See what matched, what needs review and what needs fixing.
                  </p>
                </div>
              </div>

              <span className="w-fit shrink-0 rounded-full bg-white/15 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-white sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.1em]">
                {imports.length} checks
              </span>
            </div>

            <div className="p-3.5 sm:p-6">
              {imports.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {imports.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-xl border border-violet-200 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black text-violet-950 sm:text-sm">
                            CSV catalog check
                          </p>
                          <p className="mt-0.5 text-[9px] font-semibold text-violet-800/65 sm:mt-1 sm:text-xs">
                            {job.rowCount} products checked
                          </p>
                        </div>

                        <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black text-emerald-800 sm:px-3 sm:py-1.5 sm:text-xs">
                          Data quality {job.averageDataQualityScore}/100
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2">
                        <div className="rounded-xl bg-emerald-50 p-2 text-center sm:p-3">
                          <p className="text-lg font-black text-emerald-800">
                            {job.matchedCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-emerald-700">
                            Matched
                          </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-2 text-center sm:p-3">
                          <p className="text-lg font-black text-amber-800">
                            {job.npiRequiredCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-700">
                            Needs review
                          </p>
                        </div>
                        <div className="rounded-xl bg-rose-50 p-2 text-center sm:p-3">
                          <p className="text-lg font-black text-rose-700">
                            {job.invalidCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-rose-600">
                            Needs fixing
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[110px] place-items-center rounded-[18px] border-2 border-dashed border-violet-300 bg-white/70 p-4 text-center sm:min-h-[170px] sm:rounded-[24px] sm:p-6">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-200 text-violet-800">
                      <Boxes size={20} />
                    </div>
                    <p className="mt-2 text-[11px] font-black text-violet-950 sm:mt-3 sm:text-sm">
                      No catalog checks yet
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-violet-800/60 sm:mt-1 sm:text-xs sm:leading-normal">
                      Completed CSV checks will appear here with matched and review counts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {section === "quality" ? (
        <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
          <section className="rounded-[20px] border border-[#d7e7e0] bg-[#eef6f2] p-3 shadow-[0_8px_24px_rgba(28,25,23,0.05)] sm:rounded-[28px] sm:p-5">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] bg-[#d9ece3] text-[#245c4d] sm:h-10 sm:w-10 sm:rounded-2xl">
                <BadgeCheck className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-[14px] font-black leading-4 text-slate-950 sm:text-lg sm:leading-normal">
                  Your catalog health
                </h2>
                <p className="mt-1 max-w-3xl text-[9px] font-semibold leading-[13px] text-slate-700/70 sm:text-xs sm:leading-5">
                  Use this page to quickly see which products are ready and which product details should be completed next.
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
              {[
                ["Products checked", quality?.productsObserved || 0, "bg-[#e8f1f8] border-[#d6e7f2]", "text-[#315d74]"],
                ["Ready matches", quality?.canonicalMatches || 0, "bg-[#e7f3ed] border-[#d4eadf]", "text-[#245c4d]"],
                ["Need details", quality?.npiRequired || 0, "bg-[#f0ebf8] border-[#e4daf3]", "text-[#5d4a73]"],
                ["Recipe-ready", quality?.recipeEligible || 0, "bg-[#e8f4ee] border-[#d4eadf]", "text-[#245c4d]"],
              ].map(([label, value, tone, textTone]) => (
                <div
                  key={label}
                  className={`rounded-[14px] border p-2.5 sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  <p className={`text-xl font-black leading-none sm:text-2xl ${textTone}`}>
                    {value}
                  </p>
                  <p className={`mt-1.5 text-[8px] font-black uppercase leading-[10px] tracking-[0.06em] sm:mt-2 sm:text-[10px] sm:leading-normal ${textTone}`}>
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[16px] border border-[#d8e6ed] bg-[#edf4f8] p-3 sm:mt-4 sm:rounded-[22px] sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#35695b] sm:text-[10px]">
                    Catalog completeness
                  </p>
                  <p className="mt-0.5 text-[18px] font-black leading-5 text-slate-950 sm:mt-1 sm:text-2xl sm:leading-normal">
                    {quality?.averageDataQualityScore || 0}/100
                  </p>
                </div>
                <p className="max-w-[210px] text-right text-[8px] font-semibold leading-[11px] text-slate-600 sm:max-w-sm sm:text-[11px] sm:leading-4">
                  Higher completeness means more product information is ready for catalog and recipe use.
                </p>
              </div>

              {Object.keys(quality?.issueCounts || {}).length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                  {Object.entries(quality?.issueCounts || {}).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full border border-[#dbe7e2] bg-white/85 px-2 py-1 text-[8px] font-black leading-3 text-[#46635b] sm:px-3 sm:text-[10px]"
                    >
                      {qualityIssueLabel(key)} · {value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 rounded-xl bg-white/70 px-3 py-2 text-[9px] font-bold text-emerald-800 sm:mt-3 sm:text-xs">
                  No product-detail issues are showing right now.
                </p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-[16px] border border-[#d4eadf] bg-[#e8f4ee] p-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[22px] sm:p-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-[#173f35] sm:text-sm">
                  Next step: complete the flagged product details
                </p>
                <p className="mt-0.5 text-[8px] font-semibold leading-[11px] text-slate-700/70 sm:mt-1 sm:text-[11px] sm:leading-4">
                  Open Add / Edit Products, update the missing information, then return here and Refresh to check the latest result.
                </p>
              </div>

              <Link
                to="/host/product-intelligence"
                className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[11px] bg-[#17624f] px-3 py-2 text-[9px] font-black text-white shadow-sm transition hover:bg-[#124e3f] sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-xs"
              >
                <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Open Add / Edit Products
              </Link>
            </div>
          </section>
        </div>
      ) : null}

      {section === "finance" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title="Earnings overview"
            description="A quick view of delivered orders, money still waiting to settle, and what has already been paid."
            icon={WalletCards}
            tone="finance"
          >
            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
              {[
                ["Delivered orders", finance?.deliveredOrders || 0, "bg-white/85 border-[#dce7e3]"],
                ["Awaiting settlement", finance?.unsettledDeliveredOrders || 0, "bg-[#e7f3ed] border-[#d4eadf]"],
                ["Payouts in progress", finance?.pendingSettlements || 0, "bg-[#f0ebf8] border-[#e4daf3]"],
                ["Paid to you", money(finance?.paidNetMinor || 0), "bg-[#e8f1f8] border-[#d6e7f2]"],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className={`min-w-0 rounded-[14px] border p-2.5 shadow-[0_5px_14px_rgba(28,25,23,0.03)] sm:rounded-[20px] sm:p-4 ${tone}`}
                >
                  <p className="text-[18px] font-black leading-5 text-stone-950 sm:text-xl">{value}</p>
                  <p className="mt-1 text-[8px] font-black uppercase leading-[11px] tracking-[0.06em] text-stone-500 sm:text-[10px] sm:leading-4">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[14px] border border-[#d6e7e1] bg-[#e7f3ed] px-3 py-2.5 sm:mt-4 sm:rounded-[18px] sm:px-4 sm:py-3">
              <p className="text-[9px] font-semibold leading-[13px] text-[#35564d] sm:text-xs sm:leading-5">
                For now, EPANTRY shows the merchandise amount from delivered orders. Any future platform fees or tax deductions will appear here once they are configured.
              </p>
            </div>
          </Section>

          <Section
            title="Payout history"
            description="See each recorded settlement period and the amount prepared or paid for your business."
            icon={WalletCards}
            tone="finance"
          >
            <div className="space-y-2 sm:space-y-3">
              {settlements.length ? (
                settlements.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="rounded-[14px] border border-[#dde6e3] bg-white/90 p-3 shadow-[0_4px_12px_rgba(28,25,23,0.025)] sm:rounded-[18px] sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black leading-4 text-stone-950 sm:text-sm">
                          {new Date(settlement.periodStart).toLocaleDateString()} – {new Date(settlement.periodEnd).toLocaleDateString()}
                        </p>
                        <p className="mt-1 text-[9px] font-semibold leading-[13px] text-stone-500 sm:text-xs sm:leading-5">
                          {settlement.lineCount} entries · Amount {money(settlement.totals?.netPayableMinor, settlement.currency)}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-[#e7f3ed] px-2 py-1 text-[8px] font-black text-[#276454] sm:px-2.5 sm:text-[10px]">
                        {titleize(settlement.status)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[14px] border border-[#d8e4ec] bg-[#e8f1f8] px-3 py-3 sm:rounded-[18px] sm:px-4 sm:py-4">
                  <p className="text-[10px] font-black text-[#2b6078] sm:text-sm">No payouts recorded yet</p>
                  <p className="mt-1 text-[9px] font-semibold leading-[13px] text-slate-600 sm:text-xs sm:leading-5">
                    After delivered orders are grouped into a settlement, the payout period and amount will appear here.
                  </p>
                </div>
              )}
            </div>
          </Section>
        </div>
      ) : null}

      {section === "recipes" ? (
        <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-5">
          <Section
            title={editingHostRecipeId ? "Edit Recipe" : "Add a Recipe"}
            description={
              editingHostRecipeId
                ? "Update the Recipe below. If it is already live, your changes are sent as a new version for review while the published version stays unchanged."
                : "Add the Recipe details below. After submission, Super Admin reviews it before it can appear publicly. You can track the result in Listing History."
            }
            icon={BookOpen}
            tone="recipe"
            actions={
              editingHostRecipeId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelHostRecipeEdit}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                >
                  <X size={14} aria-hidden="true" />
                  Cancel edit
                </button>
              ) : (
                <span className="rounded-full border border-[#d8d0ec] bg-[#f0ebf8] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#5f4b82] sm:px-3 sm:text-[10px] sm:tracking-[0.1em]">
                  Review required before publishing
                </span>
              )
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <Field compactMobile label="Recipe title">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.title}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Jeera Rice"
                />
              </Field>

              <Field compactMobile label="Base servings">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className={recipeInputClass}
                  value={hostRecipeForm.baseServings}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      baseServings: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Cuisine">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.cuisine}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      cuisine: event.target.value,
                    }))
                  }
                  placeholder="Indian"
                />
              </Field>

              <Field compactMobile label="Course">
                <input
                  className={recipeInputClass}
                  value={hostRecipeForm.course}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      course: event.target.value,
                    }))
                  }
                  placeholder="Main Course"
                />
              </Field>

              <Field compactMobile label="Preparation minutes">
                <input
                  type="number"
                  min="0"
                  className={recipeInputClass}
                  value={hostRecipeForm.preparationTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      preparationTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Cooking minutes">
                <input
                  type="number"
                  min="0"
                  className={recipeInputClass}
                  value={hostRecipeForm.cookingTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      cookingTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field compactMobile label="Difficulty">
                <select
                  className={recipeInputClass}
                  value={hostRecipeForm.difficulty}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      difficulty: event.target.value,
                    }))
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>

              <div className="sm:col-span-2">
                <Field compactMobile label="Description">
                  <textarea
                    rows={3}
                    className={recipeInputClass}
                    value={hostRecipeForm.description}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Briefly describe the Recipe and how it is served."
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field compactMobile label="Recipe image">
                  <div className="rounded-[14px] border border-dashed border-[#cedfd9] bg-[#f3f8f6] p-2.5 sm:rounded-2xl sm:p-4">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                      {hostRecipeForm.heroImageUrl ? (
                        <img
                          src={hostRecipeForm.heroImageUrl}
                          alt="Recipe preview"
                          className="h-20 w-full rounded-[12px] object-cover sm:h-28 sm:w-44 sm:rounded-2xl"
                        />
                      ) : (
                        <div className="grid h-20 w-full place-items-center rounded-[12px] border border-stone-200 bg-white text-[10px] font-bold text-stone-400 sm:h-28 sm:w-44 sm:rounded-2xl sm:text-xs">
                          No image selected
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="text-[9px] font-semibold leading-[13px] text-stone-500 sm:text-xs sm:font-normal sm:leading-5">
                          Add a clear Recipe photo (JPEG, PNG or WebP, up to 8 MB). You can replace it later while editing.
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                          <label className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-black text-emerald-800 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs">
                            {recipeImageUploading ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Upload size={14} aria-hidden="true" />
                            )}
                            {hostRecipeForm.heroImageUrl
                              ? "Replace image"
                              : "Upload image"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={busy || recipeImageUploading}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) {
                                  handleHostRecipeImageUpload(file);
                                }
                              }}
                            />
                          </label>

                          {hostRecipeForm.heroImageUrl ? (
                            <button
                              type="button"
                              disabled={busy || recipeImageUploading}
                              onClick={() =>
                                setHostRecipeForm((current) => ({
                                  ...current,
                                  heroImageUrl: "",
                                }))
                              }
                              className="focus-ring rounded-[10px] border border-rose-200 bg-rose-50 px-2.5 py-2 text-[10px] font-black text-rose-700 disabled:opacity-50 sm:rounded-xl sm:px-3 sm:text-xs"
                            >
                              Remove image
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </Field>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-[12px] font-black text-stone-950 sm:text-sm">
                  Ingredients
                </h3>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                  Search each ingredient by name. If EPANTRY cannot find it, your entry is included for review.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHostRecipeForm((current) => ({
                    ...current,
                    ingredients: [
                      ...current.ingredients,
                      newRecipeIngredient(),
                    ],
                  }))
                }
                className="focus-ring shrink-0 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                + Ingredient
              </button>
            </div>

            <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
              {hostRecipeForm.ingredients.map((ingredient, index) => (
                <HostRecipeIngredientRow
                  key={ingredient.rowId}
                  ingredient={ingredient}
                  canRemove={hostRecipeForm.ingredients.length > 1}
                  onChange={(patch) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      ingredients: current.ingredients.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, ...patch } : item
                      ),
                    }))
                  }
                  onRemove={() =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      ingredients: current.ingredients.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-[12px] font-black text-stone-950 sm:text-sm">
                  Cooking steps
                </h3>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                  Add each step in the order the customer should follow.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setHostRecipeForm((current) => ({
                    ...current,
                    steps: [...current.steps, newRecipeStep()],
                  }))
                }
                className="focus-ring shrink-0 rounded-[10px] border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-black text-stone-700 sm:rounded-xl sm:px-3 sm:text-xs"
              >
                + Step
              </button>
            </div>

            <div className="mt-2 space-y-1.5 sm:mt-3 sm:space-y-2">
              {hostRecipeForm.steps.map((step, index) => (
                <div
                  key={step.rowId}
                  className="grid gap-1.5 rounded-[14px] border border-[#dbe7e2] bg-[#f5f8f7] p-2 sm:grid-cols-[44px_minmax(0,1fr)_130px_44px] sm:gap-2 sm:rounded-2xl sm:p-3"
                >
                  <div className="grid h-9 place-items-center rounded-[10px] bg-[#173f35] text-[10px] font-black text-white sm:h-10 sm:rounded-xl sm:text-xs">
                    {index + 1}
                  </div>

                  <input
                    className={recipeInputClass}
                    value={step.instruction}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, instruction: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Describe this step"
                  />

                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={recipeInputClass}
                    value={step.timerMinutes}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, timerMinutes: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Minutes"
                  />

                  <button
                    type="button"
                    disabled={hostRecipeForm.steps.length <= 1}
                    onClick={() =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        steps: current.steps.filter(
                          (_, itemIndex) => itemIndex !== index
                        ),
                      }))
                    }
                    className="focus-ring min-h-9 rounded-[10px] border border-rose-200 bg-rose-50 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-10 sm:rounded-xl sm:text-sm"
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[16px] border border-[#d6e7f2] bg-[#edf4f8] p-3 sm:mt-6 sm:rounded-2xl sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#356b7f] sm:text-[10px]">
                    Recipe food details
                  </p>
                  <h3 className="mt-0.5 text-[12px] font-black text-stone-950 sm:mt-1 sm:text-sm">
                    Nutrition, allergens & dietary information
                  </h3>
                  <p className="mt-0.5 max-w-3xl text-[9px] font-semibold leading-[13px] text-stone-600 sm:mt-1 sm:text-xs sm:font-normal sm:leading-5">
                    Add only information you can support from your Recipe or source records. Leave anything you cannot confirm blank; these details are reviewed before publishing.
                  </p>
                </div>

                <span className="inline-flex shrink-0 rounded-full border border-[#d8d0ec] bg-[#f0ebf8] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#5f4b82] sm:px-3 sm:text-[10px]">
                  Checked before publishing
                </span>
              </div>

              <div className="mt-3 sm:mt-5">
                <p className="text-[10px] font-black text-stone-800 sm:text-xs">
                  Nutrition per serving
                </p>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-normal sm:leading-5">
                  Add only values you know. Leave unknown fields blank.
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-4">
                  {RECIPE_FOOD_NUTRIENTS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-[12px] border border-stone-200 bg-white p-2 text-[10px] font-black text-stone-700 sm:rounded-2xl sm:p-3 sm:text-xs"
                    >
                      {field.label}

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={
                            hostRecipeForm.foodIntelligence?.nutrition?.[
                              field.key
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setHostRecipeForm((current) => ({
                              ...current,
                              foodIntelligence: {
                                ...current.foodIntelligence,
                                nutrition: {
                                  ...current.foodIntelligence.nutrition,
                                  [field.key]: event.target.value,
                                },
                              },
                            }))
                          }
                          placeholder="Unknown"
                          className="focus-ring h-9 min-w-0 flex-1 rounded-[10px] border border-stone-200 px-2.5 text-[11px] outline-none sm:h-10 sm:rounded-xl sm:px-3 sm:text-sm"
                        />

                        <span className="text-[9px] font-black text-stone-500 sm:text-[11px]">
                          {field.unit}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 sm:mt-5">
                <p className="text-[10px] font-black text-stone-800 sm:text-xs">
                  Allergen information
                </p>
                <p className="mt-0.5 text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-1 sm:text-[11px] sm:font-normal sm:leading-5">
                  Choose an option only when your Recipe or source records support it. Blank means not declared.
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-3">
                  {RECIPE_FOOD_ALLERGENS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-[12px] border border-stone-200 bg-white p-2 text-[10px] font-black text-stone-700 sm:rounded-2xl sm:p-3 sm:text-xs"
                    >
                      {field.label}

                      <select
                        value={
                          hostRecipeForm.foodIntelligence?.allergens?.[
                            field.key
                          ] ?? ""
                        }
                        onChange={(event) =>
                          setHostRecipeForm((current) => ({
                            ...current,
                            foodIntelligence: {
                              ...current.foodIntelligence,
                              allergens: {
                                ...current.foodIntelligence.allergens,
                                [field.key]: event.target.value,
                              },
                            },
                          }))
                        }
                        className={`${recipeInputClass} mt-2`}
                      >
                        <option value="">Not declared</option>
                        <option value="contains">Contains</option>
                        <option value="may_contain">May contain</option>
                        <option value="cross_contact">Cross-contact</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:mt-5 sm:gap-4 md:grid-cols-2">
                <Field compactMobile label="Dietary type">
                  <select
                    className={recipeInputClass}
                    value={
                      hostRecipeForm.foodIntelligence
                        ?.dietaryClassification || "not_declared"
                    }
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          dietaryClassification: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="not_declared">Not declared</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggitarian">Eggitarian</option>
                    <option value="non_vegetarian">Non-vegetarian</option>
                  </select>
                </Field>

                <Field compactMobile label="Source / basis">
                  <input
                    className={recipeInputClass}
                    value={hostRecipeForm.foodIntelligence?.basis || ""}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        foodIntelligence: {
                          ...current.foodIntelligence,
                          basis: event.target.value,
                        },
                      }))
                    }
                    placeholder="Example: per serving / Recipe record"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field compactMobile label="Source note">
                    <textarea
                      className={recipeInputClass}
                      rows={3}
                      value={hostRecipeForm.foodIntelligence?.reason || ""}
                      onChange={(event) =>
                        setHostRecipeForm((current) => ({
                          ...current,
                          foodIntelligence: {
                            ...current.foodIntelligence,
                            reason: event.target.value,
                          },
                        }))
                      }
                      placeholder="Briefly note where these values came from."
                    />
                  </Field>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                recipeImageUploading ||
                !hostRecipeForm.title.trim() ||
                hostRecipeForm.baseServings < 1 ||
                hostRecipeForm.ingredients.some(
                  (ingredient) =>
                    (
                      !ingredient.canonicalIngredientId &&
                      !ingredient.ingredientQuery.trim()
                    ) ||
                    !(Number(ingredient.quantity) > 0)
                ) ||
                hostRecipeForm.steps.some(
                  (step) => !step.instruction.trim()
                )
              }
              onClick={async () => {
                const payload = buildHostRecipePayload(hostRecipeForm);

                const result = await run(
                  () =>
                    editingHostRecipeId
                      ? updateHostRecipeListing(editingHostRecipeId, payload)
                      : createHostRecipeListing(payload),
                  editingHostRecipeId
                    ? "Recipe updated and sent for review."
                    : "Recipe submitted for review."
                );

                if (result) {
                  setEditingHostRecipeId("");
                  setHostRecipeForm(newHostRecipeForm());
                  clearRecipeEditQuery();
                }
              }}
              className={`${buttonClass} mt-3 w-full text-[11px] sm:mt-5 sm:w-auto sm:text-sm`}
            >
              {editingHostRecipeId ? (
                <Save size={15} />
              ) : (
                <Send size={15} />
              )}
              {editingHostRecipeId
                ? "Save Recipe Changes"
                : "Submit Recipe for Review"}
            </button>
          </Section>

        </div>
      ) : null}

      {section === "campaigns" ? (
        <div className="mt-5 space-y-5">
          <Section
            title="Campaign brief"
            description="S10 remains a P2 retail-media seam. M16 records disclosed briefs but does not implement auction, paid ranking, ROAS attribution or ad serving."
            icon={Megaphone}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Brand authority (optional)">
                <select
                  className={inputClass}
                  value={campaignForm.authorityGrantId}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      authorityGrantId: event.target.value,
                    }))
                  }
                >
                  <option value="">Generic / organization brief</option>

                  {activeAuthorities.map((authority) => (
                    <option key={authority.id} value={authority.id}>
                      {authority.brandId}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Title">
                <input
                  className={inputClass}
                  value={campaignForm.title}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      title: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Objective">
                <select
                  className={inputClass}
                  value={campaignForm.objective}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      objective: event.target.value,
                    }))
                  }
                >
                  <option value="awareness">Awareness</option>

                  <option value="consideration">Consideration</option>

                  <option value="conversion">Conversion</option>

                  <option value="sampling">Sampling</option>

                  <option value="promotion">Promotion</option>
                </select>
              </Field>

              <Field label="Budget minor units">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={campaignForm.budgetAmountMinor}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      budgetAmountMinor: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Commercial disclosure">
                <textarea
                  rows={3}
                  className={inputClass}
                  value={campaignForm.commercialDisclosure}
                  onChange={(event) =>
                    setCampaignForm((current) => ({
                      ...current,

                      commercialDisclosure: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !campaignForm.title ||
                campaignForm.commercialDisclosure.length < 5
              }
              onClick={() => {
                const authority = activeAuthorities.find(
                  (item) => item.id === campaignForm.authorityGrantId
                );

                return run(
                  () =>
                    createHostCampaign({
                      brandId: authority?.brandId || null,

                      authorityGrantId: authority?.id || null,

                      title: campaignForm.title,

                      objective: campaignForm.objective,

                      marketCodes: ["IN"],

                      requestedPlacements: [],

                      startsAt: null,

                      endsAt: null,

                      budgetAmountMinor: campaignForm.budgetAmountMinor,

                      currency: "INR",

                      promotedEntityType: authority ? "brand" : "generic",

                      promotedEntityId: authority?.brandId || "",

                      commercialDisclosure: campaignForm.commercialDisclosure,
                    }),
                  "Campaign brief created."
                );
              }}
              className={`${buttonClass} mt-4`}
            >
              <Megaphone size={15} />
              Create brief
            </button>
          </Section>

          <Section title="Campaign briefs" icon={Megaphone}>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                >
                  <div>
                    <p className="text-sm font-black">{campaign.title}</p>

                    <p className="mt-1 text-xs text-stone-500">
                      {titleize(campaign.status)} · {campaign.objective}
                    </p>
                  </div>

                  {campaign.status === "draft" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => submitHostCampaign(campaign.id),
                          "Campaign brief submitted to future-media review."
                        )
                      }
                      className="focus-ring rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                    >
                      Submit
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : null}

      {section === "settings" ? (
        <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
          <Section
            title="Business records"
            description="Save licences, registration, bank proof and other records your business may need."
            icon={FileCheck2}
            tone="settingsMint"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () => registerHostDocument(documentForm),
                  "Business document saved."
                );
              }}
            >
              <Field label="Document type" compactMobile>
                <select
                  className={settingsInputClass}
                  value={documentForm.documentType}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      documentType: event.target.value,
                    }))
                  }
                >
                  {[
                    "incorporation",
                    "tax_registration",
                    "food_license",
                    "bank_proof",
                    "authorization_letter",
                    "identity",
                    "address",
                    "other",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {titleize(value)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Document name" compactMobile>
                <input
                  required
                  placeholder="e.g. Delhi Food Licence"
                  className={settingsInputClass}
                  value={documentForm.label}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      label: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Where this file is saved (optional)" compactMobile>
                <input
                  placeholder="Add the saved-file reference if you have one"
                  className={settingsInputClass}
                  value={documentForm.providerAssetId}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      providerAssetId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="File verification code (optional)" compactMobile>
                <input
                  placeholder="Only if your storage system provides one"
                  className={settingsInputClass}
                  value={documentForm.checksumSha256}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      checksumSha256: event.target.value,
                    }))
                  }
                />
              </Field>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-2`}
              >
                <Save size={14} />
                Save document
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {documents.length ? (
                documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 text-[10px] font-semibold text-stone-700 sm:rounded-xl sm:text-xs"
                  >
                    <span className="font-black text-stone-950">{document.label}</span>
                    <span className="text-stone-500"> · {titleize(document.status)}</span>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No business documents saved yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Team members"
            description="Add people who already have Host access and choose what they are allowed to work on."
            icon={Users}
            tone="settingsBlue"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-3 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    addHostTeamMember({
                      userId: memberForm.userId,

                      roleLabel: memberForm.roleLabel,

                      permissionKeys: memberForm.permissionKeys
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "Team member added."
                );
              }}
            >
              <Field label="Host account ID" compactMobile>
                <input
                  required
                  placeholder="Active Host user"
                  className={settingsInputClass}
                  value={memberForm.userId}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      userId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Role in your team" compactMobile>
                <input
                  placeholder="e.g. Operations Staff"
                  className={settingsInputClass}
                  value={memberForm.roleLabel}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      roleLabel: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-1">
                <Field label="What they can access" compactMobile>
                  <input
                    placeholder="Example: orders.read, catalog.read"
                    className={settingsInputClass}
                    value={memberForm.permissionKeys}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,

                        permissionKeys: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button
                disabled={busy}
                className={`${settingsButtonClass} sm:col-span-3`}
              >
                <UserPlus size={14} />
                Add team member
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {team?.members?.length ? (
                team.members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 sm:rounded-xl"
                  >
                    <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                      {member.roleLabel || "Team member"}
                    </p>
                    <p className="mt-0.5 text-[9px] font-semibold leading-3 text-stone-500 sm:text-[11px] sm:leading-4">
                      {titleize(member.status)} · {(member.permissionKeys || []).join(", ") || "No extra permissions"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No team members added yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Connect another app"
            description="Use this only when your warehouse, accounting or internal app needs secure access to EPANTRY."
            icon={KeyRound}
            tone="settingsLavender"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    createHostServiceAccount({
                      name: serviceAccountForm.name,

                      description: serviceAccountForm.description,

                      scopes: serviceAccountForm.scopes
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "App access created."
                );
              }}
            >
              <Field label="App name" compactMobile>
                <input
                  required
                  placeholder="e.g. Warehouse app"
                  className={settingsInputClass}
                  value={serviceAccountForm.name}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="What this app can access" compactMobile>
                <input
                  placeholder="catalog.read, orders.read"
                  className={settingsInputClass}
                  value={serviceAccountForm.scopes}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      scopes: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Why are you connecting it?" compactMobile>
                  <input
                    placeholder="Short description"
                    className={settingsInputClass}
                    value={serviceAccountForm.description}
                    onChange={(event) =>
                      setServiceAccountForm((current) => ({
                        ...current,

                        description: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button disabled={busy} className={`${settingsButtonClass} sm:col-span-2`}>
                <KeyRound size={14} />
                Connect app
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {serviceAccounts.length ? (
                serviceAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex min-w-0 flex-col items-stretch gap-2 rounded-[14px] border border-white/80 bg-white/85 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">{account.name}</p>
                      <p className="mt-1 break-words text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-0.5 sm:truncate sm:text-[11px] sm:leading-normal">
                        {titleize(account.status)} · {(account.scopes || []).join(", ") || "No permissions"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => rotateHostServiceAccountCredential(account.id),
                          "New app security key created."
                        )
                      }
                      className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#d9cfeb] bg-white/95 px-3 py-2 text-[10px] font-black text-[#5d4a73] sm:w-auto sm:rounded-xl sm:text-xs"
                    >
                      <RotateCw size={12} />
                      Create new key
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No apps connected yet.
                </p>
              )}
            </div>
          </Section>

          <Section
            title="Send updates to another system"
            description="Use this when another system should automatically receive order or business updates from EPANTRY."
            icon={Webhook}
            tone="settingsBlue"
          >
            <form
              className="grid gap-2.5 sm:grid-cols-2 sm:gap-3"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () =>
                    createHostWebhook({
                      name: webhookForm.name,

                      endpointUrl: webhookForm.endpointUrl,

                      eventTypes: webhookForm.eventTypes
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    }),
                  "Automatic update connection created."
                );
              }}
            >
              <Field label="Update connection name" compactMobile>
                <input
                  required
                  placeholder="e.g. Order updates"
                  className={settingsInputClass}
                  value={webhookForm.name}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Where should updates go? (URL)" compactMobile>
                <input
                  required
                  placeholder="https://..."
                  className={settingsInputClass}
                  value={webhookForm.endpointUrl}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      endpointUrl: event.target.value,
                    }))
                  }
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Which updates should be sent?" compactMobile>
                  <input
                    placeholder="Comma-separated event names"
                    className={settingsInputClass}
                    value={webhookForm.eventTypes}
                    onChange={(event) =>
                      setWebhookForm((current) => ({
                        ...current,

                        eventTypes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>

              <button disabled={busy} className={`${settingsButtonClass} sm:col-span-2`}>
                <Webhook size={14} />
                Start sending updates
              </button>
            </form>

            <div className="mt-3 space-y-2">
              {webhooks.length ? (
                webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex min-w-0 flex-col items-stretch gap-2 rounded-[14px] border border-white/80 bg-white/85 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:py-2"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-[11px] font-black text-stone-950 sm:truncate sm:text-xs">{webhook.name}</p>
                      <p className="mt-1 break-all text-[9px] font-semibold leading-[13px] text-stone-500 sm:mt-0.5 sm:truncate sm:text-[11px] sm:leading-normal">
                        {webhook.endpointUrl}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => rotateHostWebhookSecret(webhook.id),
                          "Update connection security key reset."
                        )
                      }
                      className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-[10px] border border-[#cfe1eb] bg-white/95 px-3 py-2 text-[10px] font-black text-[#315d74] sm:w-auto sm:rounded-xl sm:text-xs"
                    >
                      <RotateCw size={12} />
                      Reset security key
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:text-xs">
                  No update connections added yet.
                </p>
              )}
            </div>
          </Section>

          <div className="xl:col-span-2">
            <Section
              title="Recent changes"
              description="See recent changes to business records, team members and connected tools."
              icon={ShieldCheck}
              tone="settingsMint"
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {audit.length ? (
                  audit.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[12px] border border-white/80 bg-white/80 px-3 py-2 sm:rounded-xl"
                    >
                      <p className="text-[10px] font-black text-stone-950 sm:text-xs">{titleize(event.action)}</p>

                      <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[11px]">
                        {titleize(event.entityType)} · {new Date(event.occurredAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-[12px] border border-white/80 bg-white/70 px-3 py-2 text-[9px] font-semibold text-stone-500 sm:col-span-2 sm:text-xs xl:col-span-3">
                    No recent changes recorded yet.
                  </p>
                )}
              </div>
            </Section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
