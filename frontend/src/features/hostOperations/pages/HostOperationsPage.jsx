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

const buttonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50";

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

function Section({ title, description, icon: Icon, children, actions = null }) {
  return (
    <section className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Icon size={18} />
          </div>

          <div>
            <h2 className="text-lg font-black text-stone-950">{title}</h2>

            {description ? (
              <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
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
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.5fr)_110px_110px_140px_minmax(0,1fr)_44px]">
        <div className="relative">
          <input
            className={inputClass}
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
            placeholder="Search canonical ingredient"
          />

          {ingredient.canonicalIngredientId ? (
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
              Canonical ingredient selected
            </p>
          ) : null}

          {searching ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-500 shadow-lg">
              Searching…
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
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800 shadow-lg">
              This ingredient will be submitted as a Host proposal and verified by Super Admin during Editorial review.
            </div>
          ) : null}
        </div>

        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          value={ingredient.quantity}
          onChange={(event) =>
            onChange({ quantity: Number(event.target.value) })
          }
          placeholder="Qty"
        />

        <select
          className={inputClass}
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
          className={inputClass}
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
          className={inputClass}
          value={ingredient.preparationState}
          onChange={(event) =>
            onChange({ preparationState: event.target.value })
          }
          placeholder="Preparation state"
        />

        <button
          type="button"
          disabled={!canRemove}
          onClick={onRemove}
          className="focus-ring rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
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
          setProfileForm({
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
          });
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

      quality: "S04 · Data Quality",

      finance: "S08 · Finance",

      recipes: "S09 · Recipe Listings",

      campaigns: "S10 · Campaigns",

      settings: "Team & Documents",
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
    <main className="min-h-screen bg-[#f7f5ef] p-5 sm:p-7">
      <section
        className={
          section === "catalog"
            ? "overflow-hidden rounded-[28px] border border-sky-900/10 bg-gradient-to-br from-slate-950 via-sky-950 to-cyan-900 p-6 text-white shadow-lg"
            : "rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm"
        }
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p
              className={
                section === "catalog"
                  ? "text-xs font-black uppercase tracking-[0.14em] text-cyan-300"
                  : "text-xs font-black uppercase tracking-[0.14em] text-emerald-700"
              }
            >
              {section === "settings"
                ? "Host workspace"
                : section === "catalog"
                  ? "Catalog & Listings"
                  : "M16 Host Portal"}
            </p>

            <h1
              className={
                section === "catalog"
                  ? "mt-2 text-3xl font-black text-white"
                  : "mt-2 text-3xl font-black text-stone-950"
              }
            >
              {pageTitle}
            </h1>

            <p
              className={
                section === "catalog"
                  ? "mt-2 text-sm font-semibold text-sky-100/80"
                  : "mt-2 text-sm text-stone-500"
              }
            >
              {organizationData.organization.displayName} · Operational state:{" "}
              {titleize(organizationData.operationalProfile?.activationState)}
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            className={
              section === "catalog"
                ? "focus-ring inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/20"
                : "focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-black"
            }
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {section === "catalog" ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["01", "Upload catalog", "Choose your CSV file"],
              ["02", "Validate products", "Match EPANTRY catalog"],
              ["03", "Review outcome", "Matched or NPI"],
            ].map(([step, label, helper]) => (
              <div
                key={step}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-xs font-black text-slate-950">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">{label}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-sky-100/70">
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
        <div className="mt-5 space-y-5">
          <Section
            title="Operational readiness"
            description="Host capability and business go-live are separate. Every readiness check must pass before activation review."
            icon={ShieldCheck}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(readiness?.checks || {}).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-2xl bg-stone-50 p-3"
                >
                  <CheckCircle2
                    size={16}
                    className={value ? "text-emerald-700" : "text-stone-300"}
                  />

                  <span className="text-xs font-bold text-stone-700">
                    {titleize(key)}
                  </span>
                </div>
              ))}
            </div>

            {activationState === "active" ? (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                <ShieldCheck size={17} />
                Host is operationally active. No further go-live review is required.
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
            description="Commercial setup supports activation readiness but does not replace M05 offer/pricing/serviceability truth."
            icon={Building2}
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
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
              <Field label="Legal entity">
                <input
                  required
                  className={inputClass}
                  value={profileForm.legalEntityName}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Business type">
                <select
                  className={inputClass}
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

              <Field label="Registered address">
                <input
                  className={inputClass}
                  value={profileForm.line1}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      line1: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="City">
                <input
                  className={inputClass}
                  value={profileForm.city}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      city: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="State">
                <input
                  className={inputClass}
                  value={profileForm.state}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      state: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Store / warehouse postal code">
                <input
                  className={inputClass}
                  value={profileForm.postalCode}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      postalCode: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Cancellation policy">
                <textarea
                  required
                  rows={3}
                  className={inputClass}
                  value={profileForm.cancellationPolicySummary}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      cancellationPolicySummary: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Return policy">
                <textarea
                  required
                  rows={3}
                  className={inputClass}
                  value={profileForm.returnPolicySummary}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,

                      returnPolicySummary: event.target.value,
                    }))
                  }
                />
              </Field>

              <button
                disabled={busy}
                className={`${buttonClass} sm:col-span-2`}
              >
                <Save size={15} />
                Save profile
              </button>
            </form>
          </Section>

          <Section
            title="Delivery Areas"
            description="Add every pincode where this Host can deliver. These delivery pincodes are separate from the registered store or warehouse postal code above."
            icon={MapPinned}
          >
            <form
              className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]"
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
              <Field label="Delivery area name">
                <input
                  required
                  className={inputClass}
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

              <Field label="Delivery postal codes">
                <textarea
                  required
                  rows={2}
                  className={inputClass}
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

              <div className="flex items-end gap-2">
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

            <p className="mt-2 text-xs font-semibold leading-5 text-stone-500">
              Enter multiple 6-digit pincodes separated by commas, spaces, or new lines. These pincodes are used by marketplace serviceability when customers check delivery availability.
            </p>

            {serviceAreas.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {serviceAreas.map((area) => (
                  <div
                    key={area.id}
                    className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-emerald-950">
                          {area.name}
                        </p>

                        <p className="mt-1 text-xs font-semibold leading-5 text-emerald-800">
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
                          className="focus-ring rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-800 shadow-sm hover:bg-emerald-100"
                        >
                          Edit
                        </button>

                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">
                          {area.status || "active"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-stone-500">
                No delivery area added yet. Add the pincodes where customers should be able to receive orders.
              </div>
            )}
          </Section>

          <Section
            title="KYB / compliance"
            description="Full tax registration values are fingerprinted; normal API responses expose only last4, not the raw identifier."
            icon={FileCheck2}
          >
            {kybStatus ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
                  Current KYB status
                </span>

                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-stone-800 shadow-sm">
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
              className="grid gap-3 sm:grid-cols-2"
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
              <Field label="Legal entity">
                <input
                  required
                  className={inputClass}
                  value={kybForm.legalEntityName}
                  onChange={(event) =>
                    setKybForm((current) => ({
                      ...current,

                      legalEntityName: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Tax registration">
                <input
                  className={inputClass}
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

              <Field label="Evidence document IDs">
                <input
                  className={inputClass}
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

              <div className="flex items-end gap-2">
                <button disabled={busy} className={buttonClass}>
                  <Save size={15} />
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
                  className="focus-ring rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-black"
                >
                  Submit
                </button>
              </div>
            </form>
          </Section>
        </div>
      ) : null}

      {section === "catalog" ? (
        <div className="mt-5 space-y-5">
          <section className="overflow-hidden rounded-[30px] border border-sky-200 bg-sky-100 shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <div className="p-5 sm:p-7">
                <div className="flex items-start gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky-700 text-white shadow-md">
                    <Upload size={20} />
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">
                      Product file
                    </p>
                    <h2 className="mt-1 text-xl font-black text-sky-950">
                      Upload your catalog CSV
                    </h2>
                    <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-sky-900/70">
                      EPANTRY checks each row against the approved product catalog. Existing products can continue to listing setup; unknown products move to Product NPI for review.
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
                  className="focus-ring group mt-6 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[26px] border-2 border-dashed border-sky-400 bg-white/80 px-6 py-8 text-center shadow-inner transition hover:border-sky-600 hover:bg-white"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-sky-700 text-white shadow-md transition group-hover:-translate-y-0.5 group-hover:bg-sky-800">
                    <Upload size={22} />
                  </span>
                  <span className="mt-4 text-base font-black text-sky-950">
                    {csvRows.length ? "Choose a different CSV" : "Choose CSV file"}
                  </span>
                  <span className="mt-1 text-xs font-semibold text-sky-800/65">
                    Click here to browse your computer
                  </span>
                </label>

                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    csvRows.length
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-sky-200 bg-sky-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p
                        className={`text-sm font-black ${
                          csvRows.length ? "text-emerald-950" : "text-sky-950"
                        }`}
                      >
                        {csvRows.length ? csvName : "No file selected"}
                      </p>
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          csvRows.length ? "text-emerald-800" : "text-sky-800/65"
                        }`}
                      >
                        {csvRows.length
                          ? `${csvRows.length} rows are ready for validation.`
                          : "Select a CSV to unlock the validation action."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] ${
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
                      "Catalog import validated. Canonical facts were not mutated."
                    )
                  }
                  className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-md transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none sm:w-auto"
                >
                  <PackageSearch size={17} />
                  Validate catalog CSV
                </button>
              </div>

              <aside className="border-t border-sky-200 bg-sky-950 p-5 text-white sm:p-7 xl:border-l xl:border-t-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">
                  CSV requirements
                </p>
                <h3 className="mt-2 text-lg font-black">Before you upload</h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-sky-100/70">
                  Keep these exact column names so the Host catalog parser can read every row correctly.
                </p>

                <div className="mt-5 space-y-2">
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
                      className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-sky-50"
                    >
                      {header}
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4">
                  <p className="text-xs font-black text-amber-200">
                    Validation is not a live listing.
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-amber-100/75">
                    After a product matches, you still complete the offer, price and stock steps before customers can buy it.
                  </p>
                </div>
              </aside>
            </div>
          </section>

          <section className="overflow-hidden rounded-[30px] border border-violet-200 bg-violet-100 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-violet-200 bg-violet-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-white">
                  <Boxes size={19} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">
                    Validation results
                  </p>
                  <h2 className="mt-1 text-lg font-black">Import history</h2>
                  <p className="mt-1 text-xs font-semibold text-violet-100/80">
                    See which rows matched, need Product NPI, or were invalid.
                  </p>
                </div>
              </div>

              <span className="w-fit rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white">
                {imports.length} imports
              </span>
            </div>

            <div className="p-5 sm:p-6">
              {imports.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {imports.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-violet-950">
                            {job.sourceType}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-violet-800/65">
                            {job.rowCount} catalog rows checked
                          </p>
                        </div>

                        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">
                          Quality {job.averageDataQualityScore}/100
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-emerald-50 p-3 text-center">
                          <p className="text-lg font-black text-emerald-800">
                            {job.matchedCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-emerald-700">
                            Matched
                          </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 p-3 text-center">
                          <p className="text-lg font-black text-amber-800">
                            {job.npiRequiredCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-700">
                            Needs NPI
                          </p>
                        </div>
                        <div className="rounded-xl bg-rose-50 p-3 text-center">
                          <p className="text-lg font-black text-rose-700">
                            {job.invalidCount}
                          </p>
                          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-rose-600">
                            Invalid
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[170px] place-items-center rounded-[24px] border-2 border-dashed border-violet-300 bg-white/70 p-6 text-center">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-200 text-violet-800">
                      <Boxes size={20} />
                    </div>
                    <p className="mt-3 text-sm font-black text-violet-950">
                      No validation history yet
                    </p>
                    <p className="mt-1 text-xs font-semibold text-violet-800/60">
                      Your first validated catalog CSV will appear here with matched, NPI and invalid counts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {section === "quality" ? (
        <div className="mt-5 space-y-5">
          <Section
            title="Catalog data quality"
            description="Unknown allergen evidence is not treated as free-from. Recipe eligibility requires reviewed safety evidence."
            icon={BadgeCheck}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Products observed", quality?.productsObserved || 0],
                ["Canonical matches", quality?.canonicalMatches || 0],
                ["Needs NPI", quality?.npiRequired || 0],
                ["Recipe eligible", quality?.recipeEligible || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-2xl font-black">{value}</p>

                  <p className="mt-1 text-[10px] font-black uppercase text-stone-400">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 p-4">
              <p className="text-xs font-black">
                Average score: {quality?.averageDataQualityScore || 0}/100
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(quality?.issueCounts || {}).map(
                  ([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-800"
                    >
                      {titleize(key)} · {value}
                    </span>
                  )
                )}
              </div>
            </div>

            <Link
              to="/host/product-intelligence"
              className={`${buttonClass} mt-4`}
            >
              <PackageSearch size={15} />
              Open M14 Product NPI
            </Link>
          </Section>
        </div>
      ) : null}

      {section === "finance" ? (
        <div className="mt-5 space-y-5">
          <Section
            title="Finance summary"
            description="Settlement lines reconcile M11 paid/delivered transaction facts. Historical ledger entries are never rewritten."
            icon={WalletCards}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Delivered orders", finance?.deliveredOrders || 0],
                ["Unsettled delivered", finance?.unsettledDeliveredOrders || 0],
                ["Pending settlements", finance?.pendingSettlements || 0],
                ["Paid net", money(finance?.paidNetMinor || 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-stone-50 p-4">
                  <p className="text-xl font-black">{value}</p>

                  <p className="mt-1 text-[10px] font-black uppercase text-stone-400">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-stone-500">
              M16 v1 intentionally does not invent a commission schedule. Until
              commercial fee configuration exists, settlement lines expose zero
              platform fee/tax withholding and reconcile merchandise payable
              only.
            </p>
          </Section>

          <Section title="Settlement history" icon={WalletCards}>
            <div className="space-y-2">
              {settlements.length ? (
                settlements.map((settlement) => (
                  <div
                    key={settlement.id}
                    className="rounded-2xl border border-stone-200 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-black">
                        {new Date(settlement.periodStart).toLocaleDateString()}{" "}
                        – {new Date(settlement.periodEnd).toLocaleDateString()}
                      </p>

                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-black">
                        {titleize(settlement.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-stone-500">
                      {settlement.lineCount} lines · Net{" "}
                      {money(
                        settlement.totals?.netPayableMinor,
                        settlement.currency
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-stone-400">
                  No settlements yet.
                </p>
              )}
            </div>
          </Section>
        </div>
      ) : null}

      {section === "recipes" ? (
        <div className="mt-5 space-y-5">
          <Section
            title={editingHostRecipeId ? "Edit Recipe Listing" : "Create Recipe Listing"}
            description={
              editingHostRecipeId
                ? "Update this Recipe listing. Published Recipes are never overwritten: saving a published listing creates a new draft version and sends that revision to Super Admin review."
                : "Create the full Recipe here as a Host. Submission goes directly to Super Admin review and cannot become public until Super Admin publishes it. No Brand authority is required for a normal Host Recipe listing."
            }
            icon={BookOpen}
            actions={
              editingHostRecipeId ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelHostRecipeEdit}
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 disabled:opacity-50"
                >
                  <X size={14} aria-hidden="true" />
                  Cancel edit
                </button>
              ) : (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
                  Host submits · Super Admin publishes
                </span>
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Recipe title">
                <input
                  className={inputClass}
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

              <Field label="Base servings">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  className={inputClass}
                  value={hostRecipeForm.baseServings}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      baseServings: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Cuisine">
                <input
                  className={inputClass}
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

              <Field label="Course">
                <input
                  className={inputClass}
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

              <Field label="Preparation minutes">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={hostRecipeForm.preparationTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      preparationTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Cooking minutes">
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={hostRecipeForm.cookingTimeMinutes}
                  onChange={(event) =>
                    setHostRecipeForm((current) => ({
                      ...current,
                      cookingTimeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </Field>

              <Field label="Difficulty">
                <select
                  className={inputClass}
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
                <Field label="Description">
                  <textarea
                    rows={3}
                    className={inputClass}
                    value={hostRecipeForm.description}
                    onChange={(event) =>
                      setHostRecipeForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe the Recipe and serving context."
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Recipe image">
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {hostRecipeForm.heroImageUrl ? (
                        <img
                          src={hostRecipeForm.heroImageUrl}
                          alt="Recipe preview"
                          className="h-28 w-full rounded-2xl object-cover sm:w-44"
                        />
                      ) : (
                        <div className="grid h-28 w-full place-items-center rounded-2xl border border-stone-200 bg-white text-xs font-bold text-stone-400 sm:w-44">
                          No image selected
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="text-xs leading-5 text-stone-500">
                          Upload a JPEG, PNG, or WebP image. Maximum size is 8 MB. Existing listings can load the current image through Edit and replace it here.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
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
                              className="focus-ring rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50"
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

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-stone-950">
                  Canonical ingredients
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Search by ingredient name. Internal ObjectIds are stored automatically.
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
                className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
              >
                + Ingredient
              </button>
            </div>

            <div className="mt-3 space-y-2">
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

            <div className="mt-6 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-stone-950">
                  Method steps
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Add the complete preparation and cooking sequence.
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
                className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700"
              >
                + Step
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {hostRecipeForm.steps.map((step, index) => (
                <div
                  key={step.rowId}
                  className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[44px_minmax(0,1fr)_130px_44px]"
                >
                  <div className="grid h-10 place-items-center rounded-xl bg-stone-950 text-xs font-black text-white">
                    {index + 1}
                  </div>

                  <input
                    className={inputClass}
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
                    placeholder="Instruction"
                  />

                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
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
                    placeholder="Timer min"
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
                    className="focus-ring rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remove step"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    Recipe Food Intelligence declaration
                  </p>
                  <h3 className="mt-1 text-sm font-black text-stone-950">
                    Nutrition, allergens & dietary source facts
                  </h3>
                  <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-600">
                    Enter only values you can support from the Recipe formulation or your source records. This Host declaration is not public safety truth by itself. Super Admin must review and approve it before publication. AI does not approve nutrition, allergen or dietary claims, and calculation source / lineage are generated by EPANTRY automatically.
                  </p>
                </div>

                <span className="inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-amber-800">
                  Super Admin review required
                </span>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black text-stone-800">
                  Nutrition per serving
                </p>
                <p className="mt-1 text-[11px] leading-5 text-stone-500">
                  Optional at Host submission. Leave a value blank when you do not have a supportable source; do not estimate with AI.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {RECIPE_FOOD_NUTRIENTS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-2xl border border-stone-200 bg-white p-3 text-xs font-black text-stone-700"
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
                          className="focus-ring h-10 min-w-0 flex-1 rounded-xl border border-stone-200 px-3 text-sm outline-none"
                        />

                        <span className="text-[11px] font-black text-stone-500">
                          {field.unit}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-black text-stone-800">
                  Positive allergen relationships
                </p>
                <p className="mt-1 text-[11px] leading-5 text-stone-500">
                  Declare only positive relationships. Blank means “not declared”, never “allergen-free”.
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {RECIPE_FOOD_ALLERGENS.map((field) => (
                    <label
                      key={field.key}
                      className="rounded-2xl border border-stone-200 bg-white p-3 text-xs font-black text-stone-700"
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
                        className={`${inputClass} mt-2`}
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

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Dietary classification">
                  <select
                    className={inputClass}
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

                <Field label="Declaration basis">
                  <input
                    className={inputClass}
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
                    placeholder="Per serving / source basis"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Evidence / declaration note">
                    <textarea
                      className={inputClass}
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
                      placeholder="Explain where these values came from."
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
                    ? "Recipe updated and resubmitted to Super Admin review."
                    : "Recipe submitted to Super Admin for review."
                );

                if (result) {
                  setEditingHostRecipeId("");
                  setHostRecipeForm(newHostRecipeForm());
                  clearRecipeEditQuery();
                }
              }}
              className={`${buttonClass} mt-5`}
            >
              {editingHostRecipeId ? (
                <Save size={15} />
              ) : (
                <Send size={15} />
              )}
              {editingHostRecipeId
                ? "Save Recipe Changes"
                : "Submit Recipe for Super Admin Review"}
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
        <div className="mt-5 space-y-5">
          <Section
            title="Documents"
            description="M16 stores document metadata/references only; provider secrets or private file bytes are not exposed through normal responses."
            icon={FileCheck2}
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();

                run(
                  () => registerHostDocument(documentForm),
                  "Document evidence metadata registered."
                );
              }}
            >
              <Field label="Type">
                <select
                  className={inputClass}
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

              <Field label="Label">
                <input
                  required
                  className={inputClass}
                  value={documentForm.label}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      label: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Private provider asset ID">
                <input
                  className={inputClass}
                  value={documentForm.providerAssetId}
                  onChange={(event) =>
                    setDocumentForm((current) => ({
                      ...current,

                      providerAssetId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="SHA-256 checksum">
                <input
                  className={inputClass}
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
                className={`${buttonClass} sm:col-span-2`}
              >
                <Save size={15} />
                Register document
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-xl bg-stone-50 p-3 text-xs font-semibold"
                >
                  {document.label} · {titleize(document.status)} · ID{" "}
                  {document.id}
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Organization team"
            description="Staff permissions are organization-scoped. Assignment never creates Host capability; the user must already be an active Host."
            icon={Users}
          >
            <form
              className="grid gap-3 sm:grid-cols-3"
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
                  "Organization member saved."
                );
              }}
            >
              <Field label="Active Host User ID">
                <input
                  required
                  className={inputClass}
                  value={memberForm.userId}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      userId: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Role label">
                <input
                  className={inputClass}
                  value={memberForm.roleLabel}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      roleLabel: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Permission keys">
                <input
                  className={inputClass}
                  value={memberForm.permissionKeys}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,

                      permissionKeys: event.target.value,
                    }))
                  }
                />
              </Field>

              <button
                disabled={busy}
                className={`${buttonClass} sm:col-span-3`}
              >
                <UserPlus size={15} />
                Add team member
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {team?.members?.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl bg-stone-50 p-3 text-xs font-semibold"
                >
                  {member.roleLabel} · {member.status} ·{" "}
                  {(member.permissionKeys || []).join(", ")}
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Service Accounts / API credentials"
            description="Raw API keys are shown once. Mongo stores only prefix + SHA-256 hash. Scopes are explicit and organization-bound."
            icon={KeyRound}
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
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
                  "Service Account created."
                );
              }}
            >
              <Field label="Name">
                <input
                  required
                  className={inputClass}
                  value={serviceAccountForm.name}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Scopes">
                <input
                  className={inputClass}
                  value={serviceAccountForm.scopes}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      scopes: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Description">
                <input
                  className={inputClass}
                  value={serviceAccountForm.description}
                  onChange={(event) =>
                    setServiceAccountForm((current) => ({
                      ...current,

                      description: event.target.value,
                    }))
                  }
                />
              </Field>

              <button disabled={busy} className={buttonClass}>
                <KeyRound size={15} />
                Create credential
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {serviceAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                >
                  <div>
                    <p className="text-sm font-black">{account.name}</p>

                    <p className="mt-1 text-xs text-stone-500">
                      {account.status} · {(account.scopes || []).join(", ")}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => rotateHostServiceAccountCredential(account.id),
                        "API credential rotated."
                      )
                    }
                    className="focus-ring inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                  >
                    <RotateCw size={13} />
                    Rotate
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Webhooks"
            description="Signing secrets are AES-256-GCM encrypted at rest and shown once. HTTPS is required outside local development."
            icon={Webhook}
          >
            <form
              className="grid gap-3 sm:grid-cols-2"
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
                  "Webhook created."
                );
              }}
            >
              <Field label="Name">
                <input
                  required
                  className={inputClass}
                  value={webhookForm.name}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      name: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="HTTPS endpoint">
                <input
                  required
                  className={inputClass}
                  value={webhookForm.endpointUrl}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      endpointUrl: event.target.value,
                    }))
                  }
                />
              </Field>

              <Field label="Event types">
                <input
                  className={inputClass}
                  value={webhookForm.eventTypes}
                  onChange={(event) =>
                    setWebhookForm((current) => ({
                      ...current,

                      eventTypes: event.target.value,
                    }))
                  }
                />
              </Field>

              <button disabled={busy} className={buttonClass}>
                <Webhook size={15} />
                Register webhook
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black">{webhook.name}</p>

                    <p className="mt-1 truncate text-xs text-stone-500">
                      {webhook.endpointUrl} · {webhook.maskedSigningSecret}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => rotateHostWebhookSecret(webhook.id),
                        "Webhook secret rotated."
                      )
                    }
                    className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black"
                  >
                    <RotateCw size={13} />
                    Rotate
                  </button>
                </div>
              ))}
            </div>
          </Section>

          <Section
            title="Organization audit"
            description="M16 integration/security changes produce append-only organization audit events; M03 separately owns critical Admin audit."
            icon={ShieldCheck}
          >
            <div className="space-y-2">
              {audit.map((event) => (
                <div key={event.id} className="rounded-xl bg-stone-50 p-3">
                  <p className="text-xs font-black">{event.action}</p>

                  <p className="mt-1 text-[11px] text-stone-500">
                    {event.entityType} · {event.entityId} ·{" "}
                    {new Date(event.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      ) : null}
    </main>
  );
}
