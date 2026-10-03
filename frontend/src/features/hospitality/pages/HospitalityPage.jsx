import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Calculator,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  FileSearch,
  FlagTriangleRight,
  LoaderCircle,
  PackageSearch,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  UsersRound,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { apiClient } from "../../../api/apiClient";

import {
  addHospitalityMenuItem,
  calculateHospitalityRecipeCost,
  createHospitalityMenu,
  createHospitalityOutlet,
  createHospitalityProcurementPlan,
  createHospitalityProductionPlan,
  createHospitalityProductionRecipe,
  createHospitalityStockObservation,
  createHospitalitySupplier,
  createHospitalitySupplierProduct,
  deleteHospitalityMenu,
  detectHospitalityChangeImpact,
  generateDishPassportSnapshot,
  generateGreyBookSnapshot,
  getHospitalityContext,
  getHospitalityErrorMessage,
  getSelectedHospitalityOrganizationId,
  greyBookExportUrl,
  initializeHospitalityProfile,
  listDishPassportSnapshots,
  listGreyBookSnapshots,
  listHospitalityChangeCases,
  listHospitalityCurrentStock,
  listHospitalityMemberGrants,
  listHospitalityMenus,
  listHospitalityOutlets,
  listHospitalityProductionPlans,
  listHospitalityProductionRecipes,
  listHospitalitySupplierProducts,
  listHospitalitySuppliers,
  publishDishPassportSnapshot,
  publishHospitalityChangeCase,
  recalculateHospitalityChangeCase,
  searchHospitalityCanonicalIngredients,
  setHospitalityMenuItemAvailability,
  setSelectedHospitalityOrganizationId,
  submitHospitalityProductionRecipe,
  upsertHospitalityMemberGrant,
} from "../services/hospitality.service";

const inputClass =
  "focus-ring w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-stone-900 outline-none placeholder:text-stone-400";

const primaryButtonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-black text-stone-700 disabled:cursor-not-allowed disabled:opacity-50";

function RecipeIngredientPicker({
  value,
  onChange,
  label = "Ingredient",
  className = "sm:col-span-2",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await searchHospitalityCanonicalIngredients({
          search: normalized,
          limit: 8,
        });
        if (!cancelled) setResults(response?.ingredients || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className={`grid gap-1.5 ${className}`}>
      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
        {label}
      </span>
      <div className="relative">
        <input
          className={inputClass}
          placeholder="Search ingredient, for example Basmati Rice"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? (
          <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-700" />
        ) : null}
      </div>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[9px] font-bold text-emerald-800 sm:text-[10px]">
          <span>EPANTRY ingredient selected</span>
          <button
            type="button"
            className="font-black underline underline-offset-2"
            onClick={() => {
              onChange("");
              setQuery("");
              setResults([]);
            }}
          >
            Change
          </button>
        </div>
      ) : null}

      {query.trim().length >= 2 && !searching ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {results.length ? (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setQuery(item.canonicalName || "");
                  setResults([]);
                }}
                className="focus-ring flex w-full items-center justify-between gap-3 border-b border-stone-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-black text-stone-900 sm:text-xs">
                    {item.canonicalName}
                  </span>
                  {item.aliases?.length ? (
                    <span className="mt-0.5 block truncate text-[9px] font-medium text-stone-500">
                      {item.aliases.slice(0, 3).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[9px] font-black text-emerald-700">
                  Select
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-[9px] font-semibold text-stone-500 sm:text-[10px]">
              No matching ingredient found. Try another ingredient name.
            </div>
          )}
        </div>
      ) : null}

      {!value ? (
        <p className="text-[9px] font-semibold leading-4 text-sky-700">
          Select a real EPANTRY ingredient. You do not need to paste any
          database ID.
        </p>
      ) : null}
    </div>
  );
}

const SECTION_CONFIG = Object.freeze({
  dashboard: {
    code: "B01",
    title: "Hospitality Operations",
    icon: FlagTriangleRight,
    description:
      "Manage your outlets, suppliers, kitchen recipes, purchasing and food records from one place.",
  },
  outlets: {
    code: "B02",
    title: "Outlets & locations",
    icon: Building2,
    description:
      "Add every restaurant, cafe, cloud kitchen or service location you operate, then choose which team members can work with each outlet.",
  },
  suppliers: {
    code: "B03",
    title: "Suppliers",
    icon: Truck,
    description:
      "Save the vendors that supply your outlets, how quickly they deliver, and which locations they serve.",
  },
  products: {
    code: "B04",
    title: "Ingredients & products",
    icon: PackageSearch,
    description:
      "Record what you buy from each supplier, the pack size and the agreed buying price used by your kitchen.",
  },
  recipes: {
    code: "B05",
    title: "Kitchen recipes",
    icon: ChefHat,
    description:
      "Standardize how each dish is prepared, how many portions it makes, and which ingredients your kitchen uses.",
  },
  menus: {
    code: "B06",
    title: "Outlet menus",
    icon: ClipboardList,
    description:
      "Choose which approved kitchen dishes each outlet sells, then set the customer-facing name and price.",
  },
  procurement: {
    code: "B07",
    title: "Purchasing",
    icon: ShoppingCart,
    description:
      "Count what each outlet has on hand, plan what the kitchen needs to make, and compare suppliers before you buy.",
  },
  costing: {
    code: "B08",
    title: "Food costing",
    icon: Calculator,
    description:
      "Check what your approved kitchen recipes cost to make using the supplier prices already saved in Hospitality.",
  },
  passports: {
    code: "B09",
    title: "Dish records",
    icon: FileSearch,
    description:
      "Create and publish a verified dish record from an approved kitchen recipe and its supporting safety information.",
  },
  greyBook: {
    code: "B10",
    title: "Published records",
    icon: BookOpenCheck,
    description:
      "Create a dated outlet record book from the dish records that are already approved and published.",
  },
  changeManagement: {
    code: "B11",
    title: "Changes & history",
    icon: ScrollText,
    description:
      "Review what may be affected when a supplier item, ingredient or recipe changes, then approve and publish the updated records when they are ready.",
  },
});

function titleize(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function changeSourceLabel(value) {
  const labels = {
    product_version: "Product or pack record",
    canonical_ingredient: "Ingredient record",
    recipe_version: "Published recipe record",
    production_recipe_version: "Kitchen recipe",
    supplier_product: "Supplier item",
  };

  return labels[value] || titleize(value);
}

function parseJsonArray(value, fallback = []) {
  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array.");
  }

  return parsed;
}

function Notice({ children, tone = "stone" }) {
  const classes = {
    stone: "border-stone-200 bg-white text-stone-600",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div
      className={`rounded-2xl border p-4 text-sm font-semibold leading-6 ${classes[tone]}`}
    >
      {children}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-stone-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/82 p-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] sm:p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-stone-500 sm:text-[10px]">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-black text-stone-950 sm:mt-2 sm:text-2xl">
        {value ?? 0}
      </p>
    </div>
  );
}

function evidenceFrom(label, referenceId) {
  if (!String(label || "").trim()) {
    return [];
  }

  return [
    {
      type: "external_reference",
      label: String(label).trim(),
      referenceId: String(referenceId || "").trim(),
      uri: "",
      note: "",
    },
  ];
}

export default function HospitalityPage({ section = "dashboard" }) {
  const config = SECTION_CONFIG[section] || SECTION_CONFIG.dashboard;

  const Icon = config.icon;

  const [organizationId, setOrganizationId] = useState(() =>
    getSelectedHospitalityOrganizationId()
  );

  const [contextData, setContextData] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [memberGrants, setMemberGrants] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [currentStock, setCurrentStock] = useState([]);
  const [productionPlans, setProductionPlans] = useState([]);
  const [passports, setPassports] = useState([]);
  const [greyBooks, setGreyBooks] = useState([]);
  const [changeCases, setChangeCases] = useState([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [reason, setReason] = useState(
    "Operational review completed with supporting evidence."
  );
  const [evidenceLabel, setEvidenceLabel] = useState(
    "Hospitality operator review"
  );
  const [evidenceReferenceId, setEvidenceReferenceId] = useState("");

  const [profileCurrency, setProfileCurrency] = useState("INR");
  const [profileSettingsSaved, setProfileSettingsSaved] = useState(false);
  const [outletSaved, setOutletSaved] = useState(false);

  const [outletForm, setOutletForm] = useState({
    outletCode: "",
    name: "",
    kitchenName: "",
    costCenterCode: "",
  });

  const [memberForm, setMemberForm] = useState({
    userId: "",
    permissionKeys: "hospitality.read,hospitality.recipes.read",
    outletIds: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    supplierCode: "",
    name: "",
    leadTimeDays: 0,
    serviceOutletIds: "",
  });

  const [supplierProductForm, setSupplierProductForm] = useState({
    supplierId: "",
    supplierSku: "",
    canonicalPackId: "",
    canonicalIngredientId: "",
    localDescription: "",
    packQuantity: 1,
    packUnit: "kg",
    amountMinor: 0,
    currency: "INR",
    minimumOrderPacks: 1,
    leadTimeDays: 0,
  });

  const [supplierItemMatchType, setSupplierItemMatchType] =
    useState("ingredient");
  const [supplierIngredientQuery, setSupplierIngredientQuery] = useState("");
  const [supplierIngredientResults, setSupplierIngredientResults] = useState(
    []
  );
  const [supplierIngredientSearching, setSupplierIngredientSearching] =
    useState(false);
  const [supplierProductQuery, setSupplierProductQuery] = useState("");
  const [supplierProductResults, setSupplierProductResults] = useState([]);
  const [supplierProductSearching, setSupplierProductSearching] =
    useState(false);
  const [supplierProductSaved, setSupplierProductSaved] = useState(false);

  const [recipeForm, setRecipeForm] = useState({
    recipeKey: "",
    dishId: "",
    sourceRecipeVersionId: "",
    title: "",
    baseYieldPortions: 1,
    ingredientsJson:
      '[\n  {\n    "lineNumber": 1,\n    "canonicalIngredientId": "",\n    "quantity": 1,\n    "unit": "kg",\n    "expectedWastePercentage": 0,\n    "preferredSupplierProductId": null,\n    "optional": false,\n    "notes": ""\n  }\n]',
  });

  const [menuForm, setMenuForm] = useState({
    outletId: "",
    menuCode: "",
    name: "",
  });

  const [menuItemForm, setMenuItemForm] = useState({
    menuId: "",
    productionRecipeVersionId: "",
    displayName: "",
    sellingPriceMinor: "",
    currency: "INR",
  });
  const [menuItemSaved, setMenuItemSaved] = useState(false);

  const [stockForm, setStockForm] = useState({
    outletId: "",
    canonicalIngredientId: "",
    quantity: 0,
    unit: "kg",
  });

  const [productionPlanForm, setProductionPlanForm] = useState({
    outletId: "",
    planDate: new Date().toISOString().slice(0, 10),
    itemsJson:
      '[\n  {\n    "productionRecipeVersionId": "",\n    "portions": 140\n  }\n]',
  });

  const [procurementPlanIds, setProcurementPlanIds] = useState("");

  const [costForm, setCostForm] = useState({
    recipeId: "",
    outletId: "",
  });
  const [lastCost, setLastCost] = useState(null);

  const [passportForm, setPassportForm] = useState({
    outletId: "",
    productionRecipeVersionId: "",
  });

  const [greyBookOutletId, setGreyBookOutletId] = useState("");

  const [changeForm, setChangeForm] = useState({
    sourceType: "product_version",
    sourceId: "",
    sourceVersion: "",
    changedDomains: "formulation,allergen",
  });

  const permissions = contextData?.context?.permissionKeys || [];

  const isOwner = contextData?.context?.isOrganizationOwner === true;

  const can = useCallback(
    (permissionKey) => isOwner || permissions.includes(permissionKey),
    [isOwner, permissions]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const common = await Promise.allSettled([
        getHospitalityContext(),
        listHospitalityOutlets(),
      ]);

      if (common[0].status === "rejected") {
        throw common[0].reason;
      }

      setContextData(common[0].value);

      setOutlets(
        common[1].status === "fulfilled" ? common[1].value?.outlets || [] : []
      );

      const tasks = [];

      if (["dashboard", "outlets"].includes(section)) {
        tasks.push(["memberGrants", listHospitalityMemberGrants()]);
      }

      if (
        [
          "dashboard",
          "suppliers",
          "products",
          "recipes",
          "costing",
          "procurement",
        ].includes(section)
      ) {
        tasks.push(["suppliers", listHospitalitySuppliers()]);
        tasks.push(["supplierProducts", listHospitalitySupplierProducts()]);
      }

      if (
        [
          "dashboard",
          "recipes",
          "menus",
          "costing",
          "procurement",
          "passports",
        ].includes(section)
      ) {
        tasks.push(["recipes", listHospitalityProductionRecipes()]);
      }

      if (["dashboard", "menus"].includes(section)) {
        tasks.push(["menus", listHospitalityMenus()]);
      }

      if (section === "procurement") {
        tasks.push(["currentStock", listHospitalityCurrentStock()]);
      }

      if (["dashboard", "procurement"].includes(section)) {
        tasks.push(["productionPlans", listHospitalityProductionPlans()]);
      }

      if (
        ["dashboard", "passports", "greyBook", "changeManagement"].includes(
          section
        )
      ) {
        tasks.push(["passports", listDishPassportSnapshots()]);
      }

      if (["dashboard", "greyBook", "changeManagement"].includes(section)) {
        tasks.push(["greyBooks", listGreyBookSnapshots()]);
      }

      if (["dashboard", "changeManagement"].includes(section)) {
        tasks.push(["changeCases", listHospitalityChangeCases()]);
      }

      const results = await Promise.allSettled(
        tasks.map(([, promise]) => promise)
      );

      tasks.forEach(([key], index) => {
        const result = results[index];

        const value = result.status === "fulfilled" ? result.value : null;

        if (key === "memberGrants") {
          setMemberGrants(value?.grants || []);
        }
        if (key === "suppliers") {
          setSuppliers(value?.suppliers || []);
        }
        if (key === "supplierProducts") {
          setSupplierProducts(value?.supplierProducts || []);
        }
        if (key === "recipes") {
          setRecipes(value?.productionRecipes || []);
        }
        if (key === "menus") {
          setMenus(value?.menus || []);
        }
        if (key === "currentStock") {
          setCurrentStock(value?.currentStock || []);
        }
        if (key === "productionPlans") {
          setProductionPlans(value?.productionPlans || []);
        }
        if (key === "passports") {
          setPassports(value?.dishPassports || []);
        }
        if (key === "greyBooks") {
          setGreyBooks(value?.greyBooks || []);
        }
        if (key === "changeCases") {
          setChangeCases(value?.changeCases || []);
        }
      });
    } catch (requestError) {
      setError(
        getHospitalityErrorMessage(
          requestError,
          "Unable to load the Hospitality workspace."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(
    () => [
      ["Outlets", outlets.length],
      ["Suppliers", suppliers.length],
      ["Supplier items", supplierProducts.length],
      ["Kitchen recipes", recipes.length],
      ["Production plans", productionPlans.length],
      [
        "Published dish records",
        passports.filter((item) => item.status === "published").length,
      ],
      ["Published record books", greyBooks.length],
      [
        "Changes to review",
        changeCases.filter(
          (item) => !["published", "dismissed"].includes(item.status)
        ).length,
      ],
    ],
    [
      outlets,
      suppliers,
      supplierProducts,
      recipes,
      productionPlans,
      passports,
      greyBooks,
      changeCases,
    ]
  );

  async function run(action, successMessage) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await action();

      setNotice(successMessage);

      await load();

      return result;
    } catch (requestError) {
      setError(getHospitalityErrorMessage(requestError));

      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMenu(menu) {
    if (!menu?.id || busy || !can("hospitality.recipes.manage")) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${
        menu.name || menu.menuCode || "this menu"
      }"? Its attached dishes will also be removed from this menu.`
    );

    if (!confirmed) {
      return;
    }

    const result = await run(
      () => deleteHospitalityMenu(menu.id),
      "Menu deleted."
    );

    if (result && menuItemForm.menuId === menu.id) {
      setMenuItemForm((current) => ({
        ...current,
        menuId: "",
      }));
    }
  }

  const decisionEvidence = () =>
    evidenceFrom(evidenceLabel, evidenceReferenceId);

  const isDashboard = section === "dashboard";
  const isOutlets = section === "outlets";
  const isSuppliers = section === "suppliers";
  const isProducts = section === "products";
  const isRecipes = section === "recipes";

  useEffect(() => {
    setSupplierProductSaved(false);
  }, [supplierProductForm]);

  useEffect(() => {
    setMenuItemSaved(false);
  }, [menuItemForm]);

  useEffect(() => {
    if (!isProducts || supplierItemMatchType !== "ingredient") {
      setSupplierIngredientResults([]);
      setSupplierIngredientSearching(false);
      return undefined;
    }

    const query = supplierIngredientQuery.trim();

    if (supplierProductForm.canonicalIngredientId || query.length < 2) {
      setSupplierIngredientResults([]);
      setSupplierIngredientSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSupplierIngredientSearching(true);
      try {
        const result = await searchHospitalityCanonicalIngredients({
          search: query,
          limit: 10,
        });
        if (!cancelled) {
          setSupplierIngredientResults(result?.ingredients || []);
        }
      } catch {
        if (!cancelled) setSupplierIngredientResults([]);
      } finally {
        if (!cancelled) setSupplierIngredientSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isProducts,
    supplierItemMatchType,
    supplierIngredientQuery,
    supplierProductForm.canonicalIngredientId,
  ]);

  useEffect(() => {
    if (!isProducts || supplierItemMatchType !== "product") {
      setSupplierProductResults([]);
      setSupplierProductSearching(false);
      return undefined;
    }

    const query = supplierProductQuery.trim();

    if (supplierProductForm.canonicalPackId || query.length < 2) {
      setSupplierProductResults([]);
      setSupplierProductSearching(false);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSupplierProductSearching(true);
      try {
        const response = await apiClient.get("/catalog/products", {
          params: {
            search: query,
            limit: 10,
          },
        });
        const payload = response?.data?.data || response?.data || {};
        const products = payload?.products || payload?.items || [];

        if (!cancelled) {
          const seenPackIds = new Set();
          const mappedProducts = products
            .map((product) => ({
              id:
                product?.packId ||
                product?.pack?.id ||
                product?.pack?._id ||
                product?.canonicalPackId ||
                "",
              name:
                product?.displayName ||
                product?.name ||
                product?.title ||
                product?.productName ||
                product?.canonicalName ||
                product?.sku ||
                "EPANTRY product",
            }))
            .filter((product) => {
              if (!product.id || seenPackIds.has(product.id)) return false;
              seenPackIds.add(product.id);
              return true;
            });

          setSupplierProductResults(mappedProducts);
        }
      } catch {
        if (!cancelled) setSupplierProductResults([]);
      } finally {
        if (!cancelled) setSupplierProductSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    isProducts,
    supplierItemMatchType,
    supplierProductQuery,
    supplierProductForm.canonicalPackId,
  ]);
  const isMenus = section === "menus";
  const isProcurement = section === "procurement";
  const isCosting = section === "costing";
  const isPassports = section === "passports";
  const isGreyBook = section === "greyBook";
  const isChangeManagement = section === "changeManagement";

  const approvedRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.status === "approved"),
    [recipes]
  );

  const currentStockForSelectedOutlet = useMemo(
    () =>
      stockForm.outletId
        ? currentStock.filter((item) => item.outletId === stockForm.outletId)
        : currentStock,
    [currentStock, stockForm.outletId]
  );

  const recipeIngredients = useMemo(() => {
    try {
      return parseJsonArray(recipeForm.ingredientsJson);
    } catch {
      return [];
    }
  }, [recipeForm.ingredientsJson]);

  const setRecipeIngredients = (items) => {
    const normalized = items.map((item, index) => ({
      ...item,
      lineNumber: index + 1,
    }));

    setRecipeForm((current) => ({
      ...current,
      ingredientsJson: JSON.stringify(normalized, null, 2),
    }));
  };

  const updateRecipeIngredient = (index, field, value) => {
    setRecipeIngredients(
      recipeIngredients.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const setRecipeIngredientCanonical = (index, canonicalIngredientId) => {
    setRecipeIngredients(
      recipeIngredients.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const preferred = supplierProducts.find(
          (supplierProduct) =>
            String(supplierProduct.id) ===
            String(item.preferredSupplierProductId || "")
        );

        return {
          ...item,
          canonicalIngredientId,
          preferredSupplierProductId:
            preferred?.canonicalIngredientId &&
            String(preferred.canonicalIngredientId) ===
              String(canonicalIngredientId)
              ? item.preferredSupplierProductId
              : null,
        };
      })
    );
  };

  const selectRecipePreferredSupplierProduct = (index, supplierProductId) => {
    const selected = supplierProducts.find(
      (item) => String(item.id) === String(supplierProductId || "")
    );

    setRecipeIngredients(
      recipeIngredients.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              preferredSupplierProductId: supplierProductId || null,
              canonicalIngredientId:
                selected?.canonicalIngredientId ||
                item.canonicalIngredientId ||
                "",
            }
          : item
      )
    );
  };

  const recipeIngredientsReady =
    recipeIngredients.length > 0 &&
    recipeIngredients.every(
      (item) =>
        Boolean(item.canonicalIngredientId) &&
        Number(item.quantity) > 0 &&
        Boolean(String(item.unit || "").trim())
    );

  const addRecipeIngredient = () => {
    setRecipeIngredients([
      ...recipeIngredients,
      {
        lineNumber: recipeIngredients.length + 1,
        canonicalIngredientId: "",
        quantity: 1,
        unit: "kg",
        expectedWastePercentage: 0,
        preferredSupplierProductId: null,
        optional: false,
        notes: "",
      },
    ]);
  };

  const removeRecipeIngredient = (index) => {
    if (recipeIngredients.length <= 1) return;
    setRecipeIngredients(
      recipeIngredients.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const productionPlanItems = useMemo(() => {
    try {
      return parseJsonArray(productionPlanForm.itemsJson);
    } catch {
      return [];
    }
  }, [productionPlanForm.itemsJson]);

  const setProductionPlanItems = (items) => {
    setProductionPlanForm((current) => ({
      ...current,
      itemsJson: JSON.stringify(items, null, 2),
    }));
  };

  const updateProductionPlanItem = (index, field, value) => {
    setProductionPlanItems(
      productionPlanItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addProductionPlanItem = () => {
    setProductionPlanItems([
      ...productionPlanItems,
      {
        productionRecipeVersionId: "",
        portions: 1,
      },
    ]);
  };

  const removeProductionPlanItem = (index) => {
    if (productionPlanItems.length <= 1) return;
    setProductionPlanItems(
      productionPlanItems.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const selectedProductionPlanIds = useMemo(
    () =>
      procurementPlanIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [procurementPlanIds]
  );

  const toggleProductionPlan = (planId) => {
    const exists = selectedProductionPlanIds.includes(planId);
    const next = exists
      ? selectedProductionPlanIds.filter((id) => id !== planId)
      : [...selectedProductionPlanIds, planId];
    setProcurementPlanIds(next.join(","));
  };

  const procurementSteps = [
    {
      number: "01",
      title: "Check outlet stock",
      text: "Record how much of an ingredient is currently available at an outlet.",
      icon: Store,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Plan kitchen portions",
      text: "Choose approved recipes and how many portions the outlet needs to prepare.",
      icon: ChefHat,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Compare suppliers",
      text: "Combine saved production plans and compare the available supplier options.",
      icon: Truck,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Review food cost",
      text: "After planning purchases, continue to costing to check recipe costs.",
      icon: Calculator,
      to: "/host/hospitality/costing",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const costingSteps = [
    {
      number: "01",
      title: "Choose a recipe",
      text: "Pick the approved kitchen recipe you want to cost.",
      icon: ChefHat,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Choose the outlet",
      text: "Select the outlet when buying prices or access are location-specific.",
      icon: Store,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Calculate food cost",
      text: "See the total recipe cost and the cost of one portion.",
      icon: Calculator,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Continue to dish records",
      text: "After checking the cost, continue to the dish record workflow.",
      icon: FileSearch,
      to: "/host/hospitality/passports",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const passportSteps = [
    {
      number: "01",
      title: "Choose the outlet",
      text: "Pick the outlet this dish record belongs to.",
      icon: Store,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Choose an approved recipe",
      text: "Select the approved kitchen recipe used for this dish.",
      icon: ChefHat,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Create & review the record",
      text: "Generate the dish record, then add the review note and supporting reference.",
      icon: ShieldCheck,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Continue to published records",
      text: "After publishing, continue to the outlet record book.",
      icon: BookOpenCheck,
      to: "/host/hospitality/grey-book",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const greyBookSteps = [
    {
      number: "01",
      title: "Choose the outlet",
      text: "Pick the restaurant, cafe or kitchen whose published dish records you want to capture.",
      icon: Store,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Create the record book",
      text: "Save the published dish records that are currently in effect for that outlet.",
      icon: BookOpenCheck,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Review or download",
      text: "Open the saved history and download a copy when you need it for operations or checks.",
      icon: ClipboardList,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Continue to changes & history",
      text: "When recipes or source records change, continue to the change review workspace.",
      icon: ScrollText,
      to: "/host/hospitality/change-management",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const changeManagementSteps = [
    {
      number: "01",
      title: "Choose what changed",
      text: "Select the supplier item, ingredient or recipe record that has been updated.",
      icon: FileSearch,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Add review details",
      text: "Explain the change and add the supporting check or document used for the review.",
      icon: ClipboardList,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Check what is affected",
      text: "See which kitchen recipes, outlets and published dish records may need attention.",
      icon: ScrollText,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Super Admin approval & publish",
      text: "After recalculation, Super Admin approves the change. You can then publish the approved update.",
      icon: CheckCircle2,
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const menuSteps = [
    {
      number: "01",
      title: "Choose an outlet",
      text: "Pick the restaurant, cafe or kitchen this menu belongs to.",
      icon: Store,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Create the menu",
      text: "Give the menu a clear name such as Breakfast, Lunch or Main Menu.",
      icon: ClipboardList,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Add approved dishes",
      text: "Choose approved kitchen recipes and set the name and selling price customers see.",
      icon: ChefHat,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Plan purchasing",
      text: "Once menus are ready, continue to purchasing and production planning.",
      icon: ShoppingCart,
      to: "/host/hospitality/procurement",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const recipeSteps = [
    {
      number: "01",
      title: "Name the recipe",
      text: "Add the kitchen recipe name and the portions one batch makes.",
      icon: ChefHat,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Add ingredients",
      text: "Enter every ingredient, quantity, unit and normal preparation waste.",
      icon: PackageSearch,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Save & review",
      text: "Save the draft, then submit it when the kitchen recipe is ready to use.",
      icon: ClipboardList,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Add it to a menu",
      text: "After approval, continue to Menus and choose where this dish is served.",
      icon: ClipboardList,
      to: "/host/hospitality/menus",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const productSteps = [
    {
      number: "01",
      title: "Choose a supplier",
      text: "Pick the vendor you buy this ingredient or product from.",
      icon: Truck,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Add item & pack",
      text: "Enter the supplier item code, pack quantity and unit.",
      icon: PackageSearch,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Save buying price",
      text: "Add the price you currently pay for that supplier pack.",
      icon: Calculator,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Use in kitchen recipes",
      text: "Next, build recipes using the ingredients and supplier items saved here.",
      icon: ChefHat,
      to: "/host/hospitality/recipes",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const supplierSteps = [
    {
      number: "01",
      title: "Add a supplier",
      text: "Save the vendor you buy ingredients or products from.",
      icon: Truck,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Set delivery time",
      text: "Add how many days this supplier usually takes to deliver.",
      icon: ClipboardList,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Choose outlets served",
      text: "Limit the supplier to selected outlets, or leave it available business-wide.",
      icon: Store,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Add supplied items",
      text: "Next, connect the ingredients or products you buy from this supplier.",
      icon: PackageSearch,
      to: "/host/hospitality/products",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const outletSteps = [
    {
      number: "01",
      title: "Set business defaults",
      text: "Choose the currency used for your hospitality costs.",
      icon: Building2,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Add an outlet",
      text: "Create each restaurant, cafe, kitchen or branch you operate.",
      icon: Store,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Review your outlets",
      text: "Check the locations already saved for this business.",
      icon: ClipboardList,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Continue to suppliers",
      text: "After outlets are ready, add the vendors that supply them.",
      icon: Truck,
      to: "/host/hospitality/suppliers",
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  const dashboardSteps = [
    {
      number: "01",
      title: "Set up outlets",
      text: "Add each restaurant, cafe or kitchen you operate.",
      to: "/host/hospitality/outlets",
      icon: Building2,
      surface: "border-emerald-200 bg-emerald-50/80",
    },
    {
      number: "02",
      title: "Add suppliers",
      text: "Save the vendors you buy ingredients and products from.",
      to: "/host/hospitality/suppliers",
      icon: Truck,
      surface: "border-sky-200 bg-sky-50/80",
    },
    {
      number: "03",
      title: "Build kitchen recipes",
      text: "Standardize how dishes are prepared across your outlets.",
      to: "/host/hospitality/recipes",
      icon: ChefHat,
      surface: "border-violet-200 bg-violet-50/75",
    },
    {
      number: "04",
      title: "Plan purchasing",
      text: "Use recipe demand and stock to plan what needs to be bought next.",
      to: "/host/hospitality/procurement",
      icon: ShoppingCart,
      surface: "border-emerald-200 bg-emerald-50/75",
    },
  ];

  return (
    <div
      className={
        isDashboard
          ? "p-2.5 sm:p-4 lg:p-5"
          : isOutlets ||
            isSuppliers ||
            isProducts ||
            isRecipes ||
            isMenus ||
            isProcurement ||
            isCosting ||
            isPassports ||
            isGreyBook ||
            isChangeManagement
          ? "px-2.5 pb-4 pt-0 sm:px-4 sm:pb-5 sm:pt-0 lg:px-5 lg:pb-6 lg:pt-0"
          : "p-4 sm:p-6 lg:p-7"
      }
    >
      {isDashboard ? (
        <header className="rounded-[22px] border border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_62%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <Icon size={13} />
                Hospitality operations
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                {config.title}
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                {config.description}
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {dashboardSteps.map((step) => {
              const StepIcon = step.icon;

              return (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring group rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                    Open
                    <ArrowRight
                      size={11}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isOutlets ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <Building2 size={13} />
                Hospitality setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Outlets & locations
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Add the places where your business operates and control which
                team members can work with them.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {outletSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isSuppliers ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <Truck size={13} />
                Supplier setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Suppliers
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Save the vendors that supply your outlets, how quickly they
                deliver, and which locations they serve.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {supplierSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isProducts ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <PackageSearch size={13} />
                Ingredient & product setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Ingredients & products
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Record what you buy from each supplier, the pack size and your
                current buying price so purchasing, recipes and costing use the
                right terms.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {productSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isRecipes ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <ChefHat size={13} />
                Kitchen setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Kitchen recipes
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Standardize how each dish is prepared, how many portions a batch
                makes, and the ingredients your team should use every time.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {recipeSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isMenus ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <ClipboardList size={13} />
                Menu setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Outlet menus
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Choose which approved kitchen dishes each outlet sells, then set
                the customer-facing name and price.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {menuSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isProcurement ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <ShoppingCart size={13} />
                Purchasing setup
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Purchasing
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Count what each outlet has, plan what the kitchen needs to
                prepare, and compare suppliers before you place purchases.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {procurementSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isCosting ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <Calculator size={13} />
                Food cost
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Food costing
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Check what an approved kitchen recipe costs to make using the
                supplier prices already saved in Hospitality.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {costingSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isPassports ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <FileSearch size={13} />
                Dish records
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Dish records
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Create a verified record for an approved dish, review the
                supporting details, and publish it when every required check is
                ready.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {passportSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isGreyBook ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <BookOpenCheck size={13} />
                Published records
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Outlet record book
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                Keep a dated record of the dish information that was approved
                and published for each outlet. Older record books stay unchanged
                so you can always check what was in effect earlier.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {greyBookSteps.map((step) => {
              const StepIcon = step.icon;
              const content = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                  {step.to ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]">
                      Open
                      <ArrowRight size={11} />
                    </span>
                  ) : null}
                </>
              );

              return step.to ? (
                <Link
                  key={step.number}
                  to={step.to}
                  className={`focus-ring rounded-[16px] border p-2.5 transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  {content}
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : isChangeManagement ? (
        <header className="rounded-b-[22px] border-x border-b border-emerald-200/80 bg-[linear-gradient(135deg,#e8f7f1_0%,#eef7ff_64%,#f2efff_100%)] p-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.06)] sm:rounded-b-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-800 sm:text-[10px]">
                <ScrollText size={13} />
                Changes & history
              </div>

              <h1 className="mt-2.5 text-[22px] font-black tracking-[-0.035em] text-stone-950 sm:text-3xl">
                Changes & history
              </h1>

              <p className="mt-1.5 max-w-3xl text-[11px] font-medium leading-5 text-stone-600 sm:text-sm sm:leading-6">
                When a supplier item, ingredient or recipe changes, check what
                else may be affected, send the result for Super Admin approval,
                then publish the approved update.
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[13px] border border-emerald-200 bg-white/85 px-2.5 py-2 text-[10px] font-black text-emerald-800 shadow-sm sm:px-3.5 sm:text-xs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {changeManagementSteps.map((step) => {
              const StepIcon = step.icon;

              return (
                <div
                  key={step.number}
                  className={`rounded-[16px] border p-2.5 sm:rounded-[18px] sm:p-3.5 ${step.surface}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-stone-950 text-[8px] font-black text-white sm:size-7 sm:text-[9px]">
                      {step.number}
                    </span>
                    <StepIcon
                      size={15}
                      className="text-stone-600"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-2 text-[11px] font-black leading-4 text-stone-950 sm:text-[13px]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[9px] font-medium leading-[1.45] text-stone-600 sm:text-[11px]">
                    {step.text}
                  </p>
                </div>
              );
            })}
          </div>

          <details className="mt-3 rounded-[14px] border border-white/70 bg-white/55 px-3 py-2">
            <summary className="cursor-pointer text-[10px] font-black text-stone-700 sm:text-xs">
              Manage another hospitality workspace
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className={inputClass}
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="Business workspace code"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedHospitalityOrganizationId(organizationId);
                  load();
                }}
                className={secondaryButtonClass}
              >
                Switch workspace
              </button>
            </div>
          </details>
        </header>
      ) : (
        <header className="rounded-[26px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800">
                <Icon size={14} />
                {config.code}
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-950 sm:text-3xl">
                {config.title}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                {config.description}
              </p>
            </div>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className={secondaryButtonClass}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className={inputClass}
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              placeholder="Organization ObjectId — only needed when you belong to multiple Hospitality organizations"
            />
            <button
              type="button"
              onClick={() => {
                setSelectedHospitalityOrganizationId(organizationId);
                load();
              }}
              className={secondaryButtonClass}
            >
              Use organization
            </button>
          </div>
        </header>
      )}

      {error ? (
        <div className="mt-4">
          <Notice tone="red">{error}</Notice>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4">
          <Notice tone="emerald">{notice}</Notice>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid min-h-72 place-items-center rounded-[24px] border border-stone-200 bg-white">
          <LoaderCircle className="animate-spin text-emerald-700" />
        </div>
      ) : (
        <>
          {isDashboard ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              You will only see the outlets and tools your Host account is
              allowed to manage.
            </div>
          ) : isOutlets ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Team members only see the hospitality locations you give them
              access to.
            </div>
          ) : isSuppliers ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Suppliers can serve every outlet or only the locations you choose.
              Add the supplier first, then connect the ingredients and products
              you buy from them.
            </div>
          ) : isProducts ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Save one supplier item for each pack and buying price you use.
              When supplier terms change, save them again so older purchasing
              and costing records remain traceable.
            </div>
          ) : isRecipes ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Build one standard recipe for each kitchen dish. Save the
              ingredients and portions here, then submit it for Super Admin
              approval before using it on a menu.
            </div>
          ) : isMenus ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Menus only use Super Admin-approved kitchen recipes. Create the
              outlet menu first, then add approved dishes with the name and
              selling price customers should see.
            </div>
          ) : isProcurement ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Record a fresh stock count, plan the portions your kitchen needs,
              then combine those plans to compare suppliers before buying.
            </div>
          ) : isCosting ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Choose an approved kitchen recipe and, when needed, an outlet. The
              calculation uses the supplier prices already saved for your
              hospitality business.
            </div>
          ) : isGreyBook ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Only dish records that were approved by Super Admin and then
              published are included. Creating a new outlet record book never
              changes an older one.
            </div>
          ) : isChangeManagement ? (
            <div className="mt-3 rounded-[16px] border border-sky-200 bg-sky-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-slate-700 sm:mt-4 sm:text-xs">
              Use this page when a supplier item, ingredient or recipe changes.
              EPANTRY checks what may be affected while keeping older published
              history unchanged.
            </div>
          ) : (
            <div className="mt-5">
              <Notice tone="stone">
                Your access is based on the business and outlets you’re assigned
                to. You’ll only see and manage the Hospitality areas your
                account has permission to use.
              </Notice>
            </div>
          )}

          {isDashboard ? (
            <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
                {metrics.map(([label, value]) => (
                  <Metric key={label} label={label} value={value} />
                ))}
              </section>

              <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                    Your business
                  </p>
                  <h2 className="mt-1.5 text-base font-black text-stone-950 sm:text-lg">
                    {contextData?.context?.organization?.displayName ||
                      "Hospitality business"}
                  </h2>
                  <p className="mt-1.5 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    {isOwner
                      ? "You can manage the full hospitality workspace for this business."
                      : `Your account has ${permissions.length} assigned hospitality permissions.`}
                  </p>
                  <Link
                    to="/host/hospitality/outlets"
                    className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-800 sm:text-xs"
                  >
                    Manage outlets
                    <ArrowRight size={12} />
                  </Link>
                </section>

                <section className="rounded-[20px] border border-sky-200 bg-sky-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-sky-700 shadow-sm">
                      <ShieldCheck size={17} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-stone-950 sm:text-base">
                        Records stay traceable
                      </h2>
                      <p className="mt-1.5 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                        Approved dish records keep their history. When a recipe
                        or source changes, EPANTRY creates a new review instead
                        of silently replacing the old record.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {section === "outlets" ? (
            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
              <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-emerald-700 shadow-sm">
                    <Building2 size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Business settings
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Set the main currency for this hospitality workspace. Use
                      this once before adding suppliers or costing recipes so
                      prices and costs stay consistent across your outlets.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    className={inputClass}
                    value={profileCurrency}
                    onChange={(event) => {
                      setProfileCurrency(event.target.value.toUpperCase());
                      setProfileSettingsSaved(false);
                    }}
                    placeholder="Currency, for example INR"
                  />

                  <button
                    type="button"
                    disabled={busy || !isOwner || profileSettingsSaved}
                    onClick={async () => {
                      const result = await run(
                        () =>
                          initializeHospitalityProfile({
                            defaultCurrency: profileCurrency,
                            notes:
                              "Hospitality workspace initialized from B02.",
                          }),
                        "Business settings saved."
                      );

                      if (result) {
                        setProfileSettingsSaved(true);
                      }
                    }}
                    className={primaryButtonClass}
                  >
                    {profileSettingsSaved ? "Settings saved" : "Save settings"}
                  </button>
                </div>
              </section>

              <section className="rounded-[20px] border border-sky-200 bg-sky-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-sky-700 shadow-sm">
                    <Store size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Add an outlet
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Add a restaurant, cafe, cloud kitchen or branch that this
                      hospitality business operates.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    placeholder="Outlet code, for example CP01"
                    value={outletForm.outletCode}
                    onChange={(event) => {
                      setOutletForm((current) => ({
                        ...current,
                        outletCode: event.target.value,
                      }));
                      setOutletSaved(false);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Outlet / branch name"
                    value={outletForm.name}
                    onChange={(event) => {
                      setOutletForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                      setOutletSaved(false);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Kitchen name (optional)"
                    value={outletForm.kitchenName}
                    onChange={(event) => {
                      setOutletForm((current) => ({
                        ...current,
                        kitchenName: event.target.value,
                      }));
                      setOutletSaved(false);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Internal cost code (optional)"
                    value={outletForm.costCenterCode}
                    onChange={(event) => {
                      setOutletForm((current) => ({
                        ...current,
                        costCenterCode: event.target.value,
                      }));
                      setOutletSaved(false);
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={
                    busy ||
                    outletSaved ||
                    !can("hospitality.outlets.manage") ||
                    !outletForm.outletCode.trim() ||
                    !outletForm.name.trim()
                  }
                  onClick={async () => {
                    const result = await run(
                      () =>
                        createHospitalityOutlet({
                          ...outletForm,
                          inheritanceMode: "inherit_org_defaults",
                          timezone: "Asia/Kolkata",
                          address: {},
                        }),
                      "Outlet added."
                    );

                    if (result) {
                      setOutletSaved(true);
                    }
                  }}
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  {outletSaved ? "Outlet added" : "Add outlet"}
                </button>
              </section>

              <section className="rounded-[20px] border border-violet-200 bg-violet-50/65 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Your outlets
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      These are the hospitality locations already saved for this
                      business.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-violet-700 shadow-sm sm:text-[10px]">
                    {outlets.length} saved
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {outlets.length ? (
                    outlets.map((outlet) => (
                      <div
                        key={outlet.id}
                        className="rounded-[15px] border border-white/80 bg-white/80 px-3 py-2.5 shadow-sm sm:px-3.5 sm:py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black text-stone-950 sm:text-sm">
                              {outlet.name}
                            </p>
                            <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[10px]">
                              {outlet.outletCode || "No outlet code"}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-[9px]">
                            {titleize(outlet.status || "active")}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[15px] border border-dashed border-violet-200 bg-white/55 px-3 py-4 text-center">
                      <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                        No outlets added yet.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/65 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-emerald-700 shadow-sm">
                    <UsersRound size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Team access
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Give an existing Host team member access to all outlets or
                      only selected hospitality locations.
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-[14px] border border-white/80 bg-white/65 px-3 py-2.5 text-[9px] font-semibold leading-4 text-stone-600 sm:text-[10px] sm:leading-5">
                  The person must already have an active Host account. Leave
                  outlet IDs blank if they should work across all outlets.
                </div>

                <div className="mt-3 grid gap-2.5">
                  <input
                    className={inputClass}
                    placeholder="Host account ID"
                    value={memberForm.userId}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Access permissions, comma separated"
                    value={memberForm.permissionKeys}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,
                        permissionKeys: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={inputClass}
                    placeholder="Outlet IDs (optional) — leave blank for all outlets"
                    value={memberForm.outletIds}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,
                        outletIds: event.target.value,
                      }))
                    }
                  />
                </div>

                <button
                  type="button"
                  disabled={busy || !isOwner || !memberForm.userId.trim()}
                  onClick={() =>
                    run(
                      () =>
                        upsertHospitalityMemberGrant({
                          userId: memberForm.userId.trim(),
                          permissionKeys: memberForm.permissionKeys
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                          outletIds: memberForm.outletIds
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                          reason:
                            "Hospitality membership configured by organization owner.",
                        }),
                      "Team access saved."
                    )
                  }
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  Save team access
                </button>

                <p className="mt-3 text-[9px] font-semibold text-stone-500 sm:text-[10px]">
                  Team access records saved: {memberGrants.length}
                </p>
              </section>
            </div>
          ) : null}

          {section === "suppliers" ? (
            <div className="mt-3 grid gap-3.5 xl:grid-cols-2 xl:gap-4">
              <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-emerald-700 shadow-sm">
                    <Truck size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Add a supplier
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Save a vendor you regularly buy ingredients or products
                      from. You can also note delivery time and which outlets
                      they serve.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Supplier code
                    </span>
                    <input
                      className={inputClass}
                      placeholder="For example SUP-001"
                      value={supplierForm.supplierCode}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          supplierCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Supplier name
                    </span>
                    <input
                      className={inputClass}
                      placeholder="Vendor or company name"
                      value={supplierForm.name}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Usual delivery time (days)
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      placeholder="For example 2"
                      value={supplierForm.leadTimeDays}
                      onChange={(event) =>
                        setSupplierForm((current) => ({
                          ...current,
                          leadTimeDays: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Outlets served (optional)
                    </span>
                    <div className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-white p-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSupplierForm((current) => ({
                            ...current,
                            serviceOutletIds: "",
                          }))
                        }
                        className={`rounded-lg border px-3 py-2 text-[10px] font-black transition sm:text-xs ${
                          supplierForm.serviceOutletIds
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean).length === 0
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-stone-200 bg-white text-stone-600"
                        }`}
                      >
                        All outlets
                      </button>

                      {outlets.map((outlet) => {
                        const outletId = String(outlet.id || outlet._id || "");
                        const selectedIds = supplierForm.serviceOutletIds
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean);
                        const selected = selectedIds.includes(outletId);

                        return (
                          <button
                            key={outletId}
                            type="button"
                            onClick={() => {
                              const nextIds = selected
                                ? selectedIds.filter(
                                    (value) => value !== outletId
                                  )
                                : [
                                    ...selectedIds.filter((value) =>
                                      outlets.some(
                                        (item) =>
                                          String(item.id || item._id || "") ===
                                          value
                                      )
                                    ),
                                    outletId,
                                  ];

                              setSupplierForm((current) => ({
                                ...current,
                                serviceOutletIds: nextIds.join(","),
                              }));
                            }}
                            className={`rounded-lg border px-3 py-2 text-left text-[10px] font-black transition sm:text-xs ${
                              selected
                                ? "border-sky-300 bg-sky-50 text-sky-800"
                                : "border-stone-200 bg-white text-stone-600"
                            }`}
                          >
                            {outlet.name || outlet.outletCode || "Outlet"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-[14px] border border-white/80 bg-white/65 px-3 py-2 text-[9px] font-semibold leading-4 text-stone-600 sm:text-[10px] sm:leading-5">
                  Keep “All outlets” selected if this supplier can serve the
                  whole hospitality business.
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !can("hospitality.suppliers.manage") ||
                    !supplierForm.supplierCode.trim() ||
                    !supplierForm.name.trim()
                  }
                  onClick={() =>
                    run(
                      () =>
                        createHospitalitySupplier({
                          supplierCode: supplierForm.supplierCode,
                          name: supplierForm.name,
                          leadTimeDays: Number(supplierForm.leadTimeDays) || 0,
                          serviceOutletIds: supplierForm.serviceOutletIds
                            .split(",")
                            .map((value) => value.trim())
                            .filter((value) =>
                              outlets.some(
                                (outlet) =>
                                  String(outlet.id || outlet._id || "") ===
                                  value
                              )
                            ),
                          contact: {},
                          notes: "",
                        }),
                      "Supplier added."
                    )
                  }
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  Add supplier
                </button>
              </section>

              <section className="rounded-[20px] border border-sky-200 bg-sky-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Your suppliers
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Review the vendors already saved for this hospitality
                      business before adding supplied items.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-sky-700 shadow-sm sm:text-[10px]">
                    {suppliers.length} saved
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {suppliers.length ? (
                    suppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className="rounded-[15px] border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm sm:px-3.5 sm:py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                              {supplier.name}
                            </p>
                            <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[10px]">
                              {supplier.supplierCode || "No supplier code"} ·
                              usually {supplier.leadTimeDays || 0} day
                              {Number(supplier.leadTimeDays || 0) === 1
                                ? ""
                                : "s"}{" "}
                              to deliver
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-emerald-700 sm:text-[9px]">
                            {titleize(supplier.status || "active")}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[15px] border border-dashed border-sky-200 bg-white/55 px-3 py-5 text-center">
                      <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                        No suppliers added yet.
                      </p>
                      <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                        Add your first supplier using the form beside this list.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {section === "products" ? (
            <div className="mt-3 grid gap-3.5 sm:mt-4 xl:grid-cols-2 xl:gap-4">
              <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-[13px] bg-white text-emerald-700 shadow-sm">
                    <PackageSearch size={17} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Add a supplier item
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Choose the supplier, add their item code, pack size and
                      the price you pay for that pack.
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-[14px] border border-white/80 bg-white/65 px-3 py-2.5 text-[9px] font-semibold leading-4 text-stone-600 sm:text-[10px] sm:leading-5">
                  If the supplier changes the pack or price later, save the item
                  again. EPANTRY keeps the older terms for your purchasing and
                  costing history.
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Supplier
                    </span>
                    <select
                      className={inputClass}
                      value={supplierProductForm.supplierId}
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          supplierId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                          {supplier.supplierCode
                            ? ` · ${supplier.supplierCode}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Supplier item code
                    </span>
                    <input
                      className={inputClass}
                      placeholder="For example RICE-5KG"
                      value={supplierProductForm.supplierSku}
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          supplierSku: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Pack quantity
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0.000001"
                      step="0.001"
                      placeholder="For example 5"
                      value={supplierProductForm.packQuantity}
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          packQuantity: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Pack unit
                    </span>
                    <input
                      className={inputClass}
                      placeholder="kg, g, l, ml, pack..."
                      value={supplierProductForm.packUnit}
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          packUnit: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Buying price
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount paid for this pack"
                      value={
                        (Number(supplierProductForm.amountMinor) || 0) / 100
                      }
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          amountMinor: Math.round(
                            (Number(event.target.value) || 0) * 100
                          ),
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Currency
                    </span>
                    <input
                      className={inputClass}
                      placeholder="INR"
                      value={supplierProductForm.currency}
                      onChange={(event) =>
                        setSupplierProductForm((current) => ({
                          ...current,
                          currency: event.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-2 sm:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                          Match this item to EPANTRY
                        </span>
                        <p className="mt-0.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                          Required. Search and select the EPANTRY ingredient or
                          product this supplier item represents.
                        </p>
                      </div>
                      <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierItemMatchType("ingredient");
                            setSupplierProductForm((current) => ({
                              ...current,
                              canonicalPackId: "",
                            }));
                            setSupplierProductQuery("");
                            setSupplierProductResults([]);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition ${
                            supplierItemMatchType === "ingredient"
                              ? "bg-emerald-700 text-white"
                              : "text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          Ingredient
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierItemMatchType("product");
                            setSupplierProductForm((current) => ({
                              ...current,
                              canonicalIngredientId: "",
                            }));
                            setSupplierIngredientQuery("");
                            setSupplierIngredientResults([]);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[10px] font-black transition ${
                            supplierItemMatchType === "product"
                              ? "bg-sky-700 text-white"
                              : "text-stone-600 hover:bg-stone-50"
                          }`}
                        >
                          Product
                        </button>
                      </div>
                    </div>

                    {supplierItemMatchType === "ingredient" ? (
                      <div className="relative">
                        <input
                          className={inputClass}
                          placeholder="Search ingredient, for example Basmati Rice"
                          value={supplierIngredientQuery}
                          onChange={(event) => {
                            setSupplierIngredientQuery(event.target.value);
                            setSupplierProductForm((current) => ({
                              ...current,
                              canonicalIngredientId: "",
                            }));
                          }}
                        />
                        {supplierProductForm.canonicalIngredientId ? (
                          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">
                            <span>Ingredient matched to EPANTRY.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierIngredientQuery("");
                                setSupplierProductForm((current) => ({
                                  ...current,
                                  canonicalIngredientId: "",
                                }));
                              }}
                              className="font-black underline underline-offset-2"
                            >
                              Change
                            </button>
                          </div>
                        ) : supplierIngredientSearching ? (
                          <div className="absolute z-30 mt-1 w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-500 shadow-lg">
                            Searching ingredients...
                          </div>
                        ) : supplierIngredientResults.length ? (
                          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                            {supplierIngredientResults.map((result) => (
                              <button
                                key={result.id}
                                type="button"
                                onClick={() => {
                                  setSupplierIngredientQuery(
                                    result.canonicalName ||
                                      result.name ||
                                      "Ingredient"
                                  );
                                  setSupplierProductForm((current) => ({
                                    ...current,
                                    canonicalIngredientId: result.id,
                                    canonicalPackId: "",
                                  }));
                                  setSupplierIngredientResults([]);
                                }}
                                className="block w-full px-3 py-2.5 text-left text-xs font-bold text-stone-800 hover:bg-emerald-50"
                              >
                                {result.canonicalName ||
                                  result.name ||
                                  "Ingredient"}
                              </button>
                            ))}
                          </div>
                        ) : supplierIngredientQuery.trim().length >= 2 ? (
                          <div className="mt-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-800">
                            Select the matching ingredient from the results
                            below. Typed text alone is not saved.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          className={inputClass}
                          placeholder="Search an EPANTRY product"
                          value={supplierProductQuery}
                          onChange={(event) => {
                            setSupplierProductQuery(event.target.value);
                            setSupplierProductForm((current) => ({
                              ...current,
                              canonicalPackId: "",
                            }));
                          }}
                        />
                        {supplierProductForm.canonicalPackId ? (
                          <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-800">
                            <span>Product matched to EPANTRY.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierProductQuery("");
                                setSupplierProductForm((current) => ({
                                  ...current,
                                  canonicalPackId: "",
                                }));
                              }}
                              className="font-black underline underline-offset-2"
                            >
                              Change
                            </button>
                          </div>
                        ) : supplierProductSearching ? (
                          <div className="absolute z-30 mt-1 w-full rounded-xl border border-stone-200 bg-white p-3 text-xs font-semibold text-stone-500 shadow-lg">
                            Searching products...
                          </div>
                        ) : supplierProductResults.length ? (
                          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                            {supplierProductResults.map((result) => (
                              <button
                                key={result.id}
                                type="button"
                                onClick={() => {
                                  setSupplierProductQuery(result.name);
                                  setSupplierProductForm((current) => ({
                                    ...current,
                                    canonicalPackId: result.id,
                                    canonicalIngredientId: "",
                                  }));
                                  setSupplierProductResults([]);
                                }}
                                className="block w-full px-3 py-2.5 text-left text-xs font-bold text-stone-800 hover:bg-sky-50"
                              >
                                {result.name}
                              </button>
                            ))}
                          </div>
                        ) : supplierProductQuery.trim().length >= 2 ? (
                          <div className="mt-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-800">
                            Select the matching product from the results below.
                            Typed text alone is not saved.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    supplierProductSaved ||
                    !can("hospitality.suppliers.manage") ||
                    !supplierProductForm.supplierId.trim() ||
                    !supplierProductForm.supplierSku.trim() ||
                    !(
                      supplierProductForm.canonicalPackId.trim() ||
                      supplierProductForm.canonicalIngredientId.trim()
                    )
                  }
                  onClick={async () => {
                    const result = await run(
                      () =>
                        createHospitalitySupplierProduct({
                          supplierId: supplierProductForm.supplierId.trim(),
                          supplierSku: supplierProductForm.supplierSku.trim(),
                          canonicalPackId:
                            supplierProductForm.canonicalPackId.trim() || null,
                          canonicalIngredientId:
                            supplierProductForm.canonicalIngredientId.trim() ||
                            null,
                          localDescription:
                            supplierProductForm.localDescription,
                          packQuantity: Number(
                            supplierProductForm.packQuantity
                          ),
                          packUnit: supplierProductForm.packUnit,
                          contractCost: {
                            amountMinor: Number(
                              supplierProductForm.amountMinor
                            ),
                            currency: supplierProductForm.currency,
                          },
                          minimumOrderPacks:
                            Number(supplierProductForm.minimumOrderPacks) || 1,
                          leadTimeDays:
                            Number(supplierProductForm.leadTimeDays) || 0,
                          effectiveFrom: null,
                          effectiveTo: null,
                        }),
                      "Supplier item saved."
                    );

                    if (result) setSupplierProductSaved(true);
                  }}
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto ${
                    supplierProductSaved ? "opacity-45" : ""
                  }`}
                >
                  {supplierProductSaved
                    ? "Supplier item saved"
                    : "Save supplier item"}
                </button>
              </section>

              <section className="rounded-[20px] border border-sky-200 bg-sky-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-stone-950 sm:text-base">
                      Saved supplier items
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Review the supplier packs and buying prices already saved
                      for this hospitality business.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-sky-700 shadow-sm sm:text-[10px]">
                    {supplierProducts.length} saved
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {supplierProducts.length ? (
                    supplierProducts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[15px] border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm sm:px-3.5 sm:py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                              {item.supplierSku}
                            </p>
                            <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[10px]">
                              {item.packQuantity} {item.packUnit} ·{" "}
                              {new Intl.NumberFormat("en-IN", {
                                style: "currency",
                                currency: item.contractCost?.currency || "INR",
                              }).format(
                                (Number(item.contractCost?.amountMinor) || 0) /
                                  100
                              )}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] text-violet-700 sm:text-[9px]">
                            Version {item.versionNumber}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[15px] border border-dashed border-sky-200 bg-white/55 px-3 py-5 text-center">
                      <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                        No supplier items saved yet.
                      </p>
                      <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                        Choose a supplier and save the first ingredient or
                        product using the form beside this list.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {section === "recipes" ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] sm:mt-4 sm:gap-4">
              <section className="rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                      Recipe setup
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Create a kitchen recipe
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Add the recipe name, portions and ingredients your kitchen
                      should follow. Saving a new version keeps older recipe
                      history available.
                    </p>
                  </div>
                  <ChefHat
                    size={18}
                    className="mt-0.5 shrink-0 text-emerald-700"
                  />
                </div>

                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Recipe name
                    </span>
                    <input
                      className={inputClass}
                      placeholder="Example: House vegetable biryani"
                      value={recipeForm.title}
                      onChange={(event) =>
                        setRecipeForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Internal recipe code
                    </span>
                    <input
                      className={inputClass}
                      placeholder="Example: VEG-BIRYANI"
                      value={recipeForm.recipeKey}
                      onChange={(event) =>
                        setRecipeForm((current) => ({
                          ...current,
                          recipeKey: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500 sm:text-[10px]">
                      Portions per batch
                    </span>
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      placeholder="1"
                      value={recipeForm.baseYieldPortions}
                      onChange={(event) =>
                        setRecipeForm((current) => ({
                          ...current,
                          baseYieldPortions: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <div className="rounded-[14px] border border-white/80 bg-white/65 px-3 py-2.5 text-[9px] font-medium leading-4 text-stone-600 sm:text-[10px] sm:leading-5">
                    Use the normal batch size your kitchen prepares. This helps
                    later menu, production and costing calculations stay
                    consistent.
                  </div>
                </div>

                <details className="mt-3 rounded-[14px] border border-emerald-200/70 bg-white/55 px-3 py-2.5">
                  <summary className="cursor-pointer text-[10px] font-black text-emerald-900 sm:text-xs">
                    Link an existing EPANTRY dish or recipe (optional)
                  </summary>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Dish reference
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Paste dish reference if already available"
                        value={recipeForm.dishId}
                        onChange={(event) =>
                          setRecipeForm((current) => ({
                            ...current,
                            dishId: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Approved recipe reference
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Can be added later"
                        value={recipeForm.sourceRecipeVersionId}
                        onChange={(event) =>
                          setRecipeForm((current) => ({
                            ...current,
                            sourceRecipeVersionId: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </details>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                      Ingredients
                    </p>
                    <p className="mt-0.5 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                      Add every ingredient used in one batch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRecipeIngredient}
                    className={secondaryButtonClass}
                  >
                    Add ingredient
                  </button>
                </div>

                <div className="mt-2.5 space-y-2.5">
                  {recipeIngredients.map((ingredient, index) => (
                    <div
                      key={`recipe-ingredient-${index}`}
                      className="rounded-[16px] border border-white/85 bg-white/80 p-3 shadow-sm sm:p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                          Ingredient {index + 1}
                        </p>
                        <button
                          type="button"
                          disabled={recipeIngredients.length <= 1}
                          onClick={() => removeRecipeIngredient(index)}
                          className="focus-ring rounded-lg px-2 py-1 text-[9px] font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                        <RecipeIngredientPicker
                          value={ingredient.canonicalIngredientId || ""}
                          onChange={(canonicalIngredientId) =>
                            setRecipeIngredientCanonical(
                              index,
                              canonicalIngredientId
                            )
                          }
                        />

                        <label className="grid gap-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            Quantity
                          </span>
                          <input
                            className={inputClass}
                            type="number"
                            min="0"
                            step="any"
                            value={ingredient.quantity ?? 1}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                index,
                                "quantity",
                                Number(event.target.value)
                              )
                            }
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            Unit
                          </span>
                          <input
                            className={inputClass}
                            placeholder="kg, g, L, ml, pcs"
                            value={ingredient.unit || ""}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                index,
                                "unit",
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            Normal prep waste %
                          </span>
                          <input
                            className={inputClass}
                            type="number"
                            min="0"
                            max="100"
                            value={ingredient.expectedWastePercentage ?? 0}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                index,
                                "expectedWastePercentage",
                                Number(event.target.value)
                              )
                            }
                          />
                        </label>

                        <label className="grid gap-1">
                          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            Preferred supplier item (optional)
                          </span>
                          <select
                            className={inputClass}
                            value={ingredient.preferredSupplierProductId || ""}
                            onChange={(event) =>
                              selectRecipePreferredSupplierProduct(
                                index,
                                event.target.value
                              )
                            }
                          >
                            <option value="">No preference</option>
                            {supplierProducts
                              .filter(
                                (item) =>
                                  item.canonicalIngredientId &&
                                  (!ingredient.canonicalIngredientId ||
                                    String(item.canonicalIngredientId) ===
                                      String(ingredient.canonicalIngredientId))
                              )
                              .map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.supplierSku} · {item.packQuantity}{" "}
                                  {item.packUnit}
                                </option>
                              ))}
                          </select>
                        </label>

                        <label className="grid gap-1 sm:col-span-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                            Kitchen note (optional)
                          </span>
                          <input
                            className={inputClass}
                            placeholder="Example: use washed and drained rice"
                            value={ingredient.notes || ""}
                            onChange={(event) =>
                              updateRecipeIngredient(
                                index,
                                "notes",
                                event.target.value
                              )
                            }
                          />
                        </label>
                      </div>

                      <label className="mt-2.5 flex items-center gap-2 text-[9px] font-bold text-stone-600 sm:text-[10px]">
                        <input
                          type="checkbox"
                          checked={Boolean(ingredient.optional)}
                          onChange={(event) =>
                            updateRecipeIngredient(
                              index,
                              "optional",
                              event.target.checked
                            )
                          }
                          className="size-4 rounded border-stone-300"
                        />
                        This ingredient is optional for this recipe
                      </label>
                    </div>
                  ))}
                </div>

                {!recipeIngredientsReady ? (
                  <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[9px] font-semibold leading-4 text-sky-800 sm:text-[10px]">
                    Select a valid EPANTRY ingredient for every recipe line.
                    Choosing a saved supplier item can fill the ingredient
                    automatically.
                  </div>
                ) : null}

                <button
                  type="button"
                  disabled={
                    busy ||
                    !can("hospitality.recipes.manage") ||
                    !recipeForm.recipeKey.trim() ||
                    !recipeForm.title.trim() ||
                    !recipeIngredientsReady
                  }
                  onClick={() =>
                    run(
                      () =>
                        createHospitalityProductionRecipe({
                          recipeKey: recipeForm.recipeKey.trim(),
                          dishId: recipeForm.dishId.trim() || null,
                          sourceRecipeVersionId:
                            recipeForm.sourceRecipeVersionId.trim() || null,
                          title: recipeForm.title.trim(),
                          baseYieldPortions: Number(
                            recipeForm.baseYieldPortions
                          ),
                          finishedYield: null,
                          productionUnit: "portion",
                          changeReason:
                            "New Hospitality Production Recipe version.",
                          ingredients: parseJsonArray(
                            recipeForm.ingredientsJson
                          ),
                        }),
                      "Kitchen recipe draft created."
                    )
                  }
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  Save recipe draft
                </button>
              </section>

              <section className="self-start rounded-[20px] border border-sky-200 bg-sky-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                      Saved recipes
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Your kitchen recipes
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Draft recipes can be submitted for review. Super
                      Admin-approved recipes can then be used on outlet menus.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-sky-700 shadow-sm sm:text-[10px]">
                    {recipes.length} saved
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {recipes.length ? (
                    recipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="rounded-[15px] border border-white/85 bg-white/85 px-3 py-3 shadow-sm sm:px-3.5"
                      >
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[12px] font-black text-stone-950 sm:text-sm">
                              {recipe.title}
                            </p>
                            <p className="mt-0.5 text-[9px] font-semibold leading-4 text-stone-500 sm:text-[10px]">
                              {recipe.recipeKey} · Version{" "}
                              {recipe.versionNumber}
                            </p>
                            <span
                              className={`mt-1.5 inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${
                                recipe.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : recipe.status === "in_review"
                                  ? "bg-sky-50 text-sky-700"
                                  : "bg-violet-50 text-violet-700"
                              }`}
                            >
                              {titleize(recipe.status)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {recipe.status === "draft" &&
                            can("hospitality.recipes.manage") ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    () =>
                                      submitHospitalityProductionRecipe(
                                        recipe.id,
                                        {
                                          reason:
                                            "Production Recipe submitted for Super Admin review.",
                                        }
                                      ),
                                    "Kitchen recipe sent to Super Admin for approval."
                                  )
                                }
                                className={secondaryButtonClass}
                              >
                                Submit to Super Admin
                              </button>
                            ) : null}
                            {recipe.status === "in_review" ? (
                              <span className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black text-sky-800">
                                Waiting for Super Admin approval
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[15px] border border-dashed border-sky-200 bg-white/55 px-3 py-5 text-center">
                      <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                        No kitchen recipes saved yet.
                      </p>
                      <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                        Create your first recipe using the form beside this
                        list.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {section === "menus" ? (
            <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4 xl:grid xl:grid-cols-3 xl:grid-rows-1 xl:items-stretch xl:gap-4 xl:space-y-0">
              <div className="grid gap-3 xl:contents">
                <section className="self-start rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5 xl:col-start-1 xl:row-start-1 xl:h-full xl:self-stretch">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                        Menu details
                      </p>
                      <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                        Create an outlet menu
                      </h2>
                      <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                        Choose the outlet and create a menu such as Breakfast,
                        Lunch, Dinner or Main Menu.
                      </p>
                    </div>
                    <Store size={18} className="shrink-0 text-emerald-700" />
                  </div>

                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Outlet
                      </span>
                      <select
                        className={inputClass}
                        value={menuForm.outletId}
                        onChange={(event) =>
                          setMenuForm((current) => ({
                            ...current,
                            outletId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose an outlet</option>
                        {outlets.map((outlet) => (
                          <option key={outlet.id} value={outlet.id}>
                            {outlet.name || outlet.outletCode || "Outlet"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Menu code
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Example: DINNER-01"
                        value={menuForm.menuCode}
                        onChange={(event) =>
                          setMenuForm((current) => ({
                            ...current,
                            menuCode: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Menu name
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Example: Dinner Menu"
                        value={menuForm.name}
                        onChange={(event) =>
                          setMenuForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.recipes.manage") ||
                      !menuForm.outletId.trim() ||
                      !menuForm.menuCode.trim() ||
                      !menuForm.name.trim()
                    }
                    onClick={() =>
                      run(
                        () =>
                          createHospitalityMenu({
                            outletId: menuForm.outletId.trim(),
                            menuCode: menuForm.menuCode.trim(),
                            name: menuForm.name.trim(),
                            effectiveFrom: null,
                            effectiveTo: null,
                          }),
                        "Menu created."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Save menu
                  </button>
                </section>

                <section className="self-start rounded-[20px] border border-sky-200 bg-sky-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5 xl:col-start-2 xl:row-start-1 xl:h-full xl:self-stretch">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                        Menu dish
                      </p>
                      <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                        Add an approved dish
                      </h2>
                      <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                        Pick a saved menu, choose an approved kitchen recipe,
                        then set the name and selling price customers see.
                      </p>
                    </div>
                    <ChefHat size={18} className="shrink-0 text-sky-700" />
                  </div>

                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Menu
                      </span>
                      <select
                        className={inputClass}
                        value={menuItemForm.menuId}
                        onChange={(event) =>
                          setMenuItemForm((current) => ({
                            ...current,
                            menuId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a menu</option>
                        {menus.map((menu) => (
                          <option key={menu.id} value={menu.id}>
                            {menu.name || menu.menuCode || "Menu"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 sm:col-span-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Approved kitchen recipe
                      </span>
                      <select
                        className={inputClass}
                        value={menuItemForm.productionRecipeVersionId}
                        onChange={(event) => {
                          const selectedId = event.target.value;
                          const selectedRecipe = approvedRecipes.find(
                            (recipe) => recipe.id === selectedId
                          );
                          setMenuItemForm((current) => ({
                            ...current,
                            productionRecipeVersionId: selectedId,
                            displayName:
                              current.displayName ||
                              selectedRecipe?.title ||
                              "",
                          }));
                        }}
                      >
                        <option value="">Choose an approved recipe</option>
                        {approvedRecipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.title} · Version {recipe.versionNumber}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Customer-facing dish name
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Example: Paneer Tikka"
                        value={menuItemForm.displayName}
                        onChange={(event) =>
                          setMenuItemForm((current) => ({
                            ...current,
                            displayName: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-stone-500">
                        Selling price (optional)
                      </span>
                      <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                        <select
                          className={inputClass}
                          value={menuItemForm.currency}
                          onChange={(event) =>
                            setMenuItemForm((current) => ({
                              ...current,
                              currency: event.target.value,
                            }))
                          }
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                        </select>
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Example: 299"
                          value={menuItemForm.sellingPriceMinor}
                          onChange={(event) =>
                            setMenuItemForm((current) => ({
                              ...current,
                              sellingPriceMinor: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </label>
                  </div>

                  {!approvedRecipes.length ? (
                    <div className="mt-3 rounded-[14px] border border-violet-200 bg-violet-50/80 px-3 py-2.5 text-[9px] font-semibold leading-4 text-violet-800 sm:text-[10px]">
                      No Super Admin-approved kitchen recipe is available yet.
                      Submit a recipe for review, then return after Super Admin
                      approval.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      menuItemSaved ||
                      busy ||
                      !can("hospitality.recipes.manage") ||
                      !menuItemForm.menuId.trim() ||
                      !menuItemForm.productionRecipeVersionId.trim() ||
                      !menuItemForm.displayName.trim()
                    }
                    onClick={async () => {
                      const result = await run(
                        () =>
                          addHospitalityMenuItem(menuItemForm.menuId.trim(), {
                            productionRecipeVersionId:
                              menuItemForm.productionRecipeVersionId.trim(),
                            displayName: menuItemForm.displayName.trim(),
                            sellingPrice:
                              menuItemForm.sellingPriceMinor === ""
                                ? null
                                : {
                                    amountMinor: Math.round(
                                      Number(menuItemForm.sellingPriceMinor) *
                                        100
                                    ),
                                    currency: menuItemForm.currency,
                                  },
                          }),
                        "Dish added to menu."
                      );

                      if (result) {
                        setMenuItemSaved(true);
                      }
                    }}
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    {menuItemSaved ? "Dish added" : "Add dish to menu"}
                  </button>
                </section>
              </div>

              <section className="rounded-[20px] border border-violet-200 bg-violet-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5 xl:col-start-3 xl:row-start-1 xl:h-full">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                      Saved menus
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Your outlet menus
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Review the menus already created and how many dishes are
                      currently attached to each one.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-violet-700 shadow-sm sm:text-[10px]">
                    {menus.length} saved
                  </span>
                </div>

                <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-1">
                  {menus.length ? (
                    menus.map((menu) => {
                      const outlet = outlets.find(
                        (item) => item.id === menu.outletId
                      );
                      return (
                        <div
                          key={menu.id}
                          className="rounded-[15px] border border-white/85 bg-white/85 px-3 py-3 shadow-sm sm:px-3.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-black text-stone-950 sm:text-sm">
                                {menu.name}
                              </p>
                              <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[10px]">
                                {menu.menuCode}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="rounded-full bg-violet-50 px-2 py-1 text-[8px] font-black text-violet-700 sm:text-[9px]">
                                {menu.items?.length || 0} dishes
                              </span>
                              <button
                                type="button"
                                disabled={
                                  busy || !can("hospitality.recipes.manage")
                                }
                                onClick={() => handleDeleteMenu(menu)}
                                className="focus-ring inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[8px] font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[9px]"
                                aria-label={`Delete ${
                                  menu.name || menu.menuCode || "menu"
                                }`}
                                title="Delete menu"
                              >
                                <Trash2 size={11} aria-hidden="true" />
                                Delete
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold text-stone-600 sm:text-[10px]">
                            <Store size={12} className="text-emerald-700" />
                            <span className="truncate">
                              {outlet?.name ||
                                outlet?.outletCode ||
                                "Outlet menu"}
                            </span>
                          </div>

                          {menu.items?.length ? (
                            <div className="mt-3 space-y-2 border-t border-violet-100 pt-3">
                              {menu.items.map((menuItem) => {
                                const availabilityStatus =
                                  menuItem.availability?.status || "available";
                                const availabilityLabel =
                                  availabilityStatus === "sold_out"
                                    ? "Sold out"
                                    : availabilityStatus === "paused"
                                    ? "Paused"
                                    : "Available";
                                const availabilityClass =
                                  availabilityStatus === "sold_out"
                                    ? "bg-amber-100 text-amber-800"
                                    : availabilityStatus === "paused"
                                    ? "bg-violet-100 text-violet-800"
                                    : "bg-emerald-100 text-emerald-800";

                                return (
                                  <div
                                    key={menuItem.id}
                                    className="rounded-[12px] border border-stone-100 bg-stone-50/80 p-2.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-[10px] font-black text-stone-900 sm:text-[11px]">
                                          {menuItem.displayName}
                                        </p>
                                        <p className="mt-0.5 text-[8px] font-semibold text-stone-500 sm:text-[9px]">
                                          Finished-dish availability
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-black ${availabilityClass}`}
                                      >
                                        {availabilityLabel}
                                      </span>
                                    </div>

                                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                                      {[
                                        ["available", "Available"],
                                        ["sold_out", "Sold out"],
                                        ["paused", "Paused"],
                                      ].map(([status, label]) => (
                                        <button
                                          key={status}
                                          type="button"
                                          disabled={
                                            busy ||
                                            !can(
                                              "hospitality.recipes.manage"
                                            ) ||
                                            availabilityStatus === status
                                          }
                                          onClick={() =>
                                            run(
                                              () =>
                                                setHospitalityMenuItemAvailability(
                                                  menu.id,
                                                  menuItem.id,
                                                  {
                                                    status,
                                                    note: "Host menu availability update.",
                                                    observedAt:
                                                      new Date().toISOString(),
                                                  }
                                                ),
                                              `Dish marked ${label.toLowerCase()}.`
                                            )
                                          }
                                          className="focus-ring rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[8px] font-black text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-45 sm:text-[9px]"
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[15px] border border-dashed border-violet-200 bg-white/55 px-3 py-5 text-center md:col-span-2 xl:col-span-1">
                      <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                        No outlet menu created yet.
                      </p>
                      <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                        Choose an outlet above and save your first menu.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}

          {section === "procurement" ? (
            <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              <div className="grid items-stretch gap-3 xl:grid-cols-3 xl:gap-4">
                <section className="flex h-full flex-col rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                      Stock check
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      What is available now?
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Save a fresh count for one ingredient at an outlet. This
                      count helps purchasing calculations without changing your
                      marketplace stock.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Outlet
                      </span>
                      <select
                        className={inputClass}
                        value={stockForm.outletId}
                        onChange={(event) =>
                          setStockForm((current) => ({
                            ...current,
                            outletId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose an outlet</option>
                        {outlets.map((outlet) => (
                          <option key={outlet.id} value={outlet.id}>
                            {outlet.name || outlet.outletCode}
                          </option>
                        ))}
                      </select>
                    </label>
                    <RecipeIngredientPicker
                      label="Ingredient reference"
                      className=""
                      value={stockForm.canonicalIngredientId}
                      onChange={(canonicalIngredientId) =>
                        setStockForm((current) => ({
                          ...current,
                          canonicalIngredientId,
                        }))
                      }
                    />
                    <div className="grid grid-cols-[minmax(0,1fr)_90px] gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                          Quantity on hand
                        </span>
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="0"
                          value={stockForm.quantity}
                          onChange={(event) =>
                            setStockForm((current) => ({
                              ...current,
                              quantity: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                          Unit
                        </span>
                        <input
                          className={inputClass}
                          placeholder="kg"
                          value={stockForm.unit}
                          onChange={(event) =>
                            setStockForm((current) => ({
                              ...current,
                              unit: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.procurement.manage") ||
                      !stockForm.outletId.trim() ||
                      !stockForm.canonicalIngredientId.trim()
                    }
                    onClick={() =>
                      run(
                        () =>
                          createHospitalityStockObservation({
                            outletId: stockForm.outletId.trim(),
                            canonicalIngredientId:
                              stockForm.canonicalIngredientId.trim(),
                            quantity: Number(stockForm.quantity),
                            unit: stockForm.unit,
                            source: "manual_count",
                            observedAt: new Date().toISOString(),
                            note: "Hospitality outlet count.",
                          }),
                        "Stock count saved."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Save stock count
                  </button>

                  <div className="mt-3 border-t border-emerald-200/80 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-800 sm:text-[10px]">
                        Current ingredient stock
                      </p>
                      <span className="rounded-full bg-white px-2 py-1 text-[8px] font-black text-emerald-700 sm:text-[9px]">
                        {currentStockForSelectedOutlet.length} items
                      </span>
                    </div>

                    <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {currentStockForSelectedOutlet.length ? (
                        currentStockForSelectedOutlet.map((item) => {
                          const outlet = outlets.find(
                            (candidate) => candidate.id === item.outletId
                          );
                          return (
                            <div
                              key={`${item.outletId}-${item.canonicalIngredientId}`}
                              className="flex items-center justify-between gap-3 rounded-[11px] border border-white/85 bg-white/85 px-2.5 py-2 shadow-sm"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[9px] font-black text-stone-900 sm:text-[10px]">
                                  {item.canonicalIngredientName || "Ingredient"}
                                </p>
                                <p className="truncate text-[8px] font-semibold text-stone-500 sm:text-[9px]">
                                  {outlet?.name ||
                                    outlet?.outletCode ||
                                    "Outlet"}
                                </p>
                              </div>
                              <p className="shrink-0 text-[10px] font-black text-emerald-800 sm:text-[11px]">
                                {item.quantity} {item.unit}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[11px] border border-dashed border-emerald-200 bg-white/55 px-3 py-3 text-center text-[9px] font-semibold text-stone-500">
                          No stock count saved for this outlet yet.
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="flex h-full flex-col rounded-[20px] border border-sky-200 bg-sky-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                      Kitchen plan
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Plan what the kitchen will make
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Choose an outlet, date and approved recipes, then enter
                      how many portions the kitchen needs to prepare.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Outlet
                      </span>
                      <select
                        className={inputClass}
                        value={productionPlanForm.outletId}
                        onChange={(event) =>
                          setProductionPlanForm((current) => ({
                            ...current,
                            outletId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose an outlet</option>
                        {outlets.map((outlet) => (
                          <option key={outlet.id} value={outlet.id}>
                            {outlet.name || outlet.outletCode}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Plan date
                      </span>
                      <input
                        className={inputClass}
                        type="date"
                        value={productionPlanForm.planDate}
                        onChange={(event) =>
                          setProductionPlanForm((current) => ({
                            ...current,
                            planDate: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="space-y-2">
                      {productionPlanItems.map((item, index) => (
                        <div
                          key={`${index}-${item.productionRecipeVersionId}`}
                          className="rounded-[14px] border border-white/80 bg-white/80 p-2.5 shadow-sm"
                        >
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_105px_auto] sm:items-end">
                            <label className="block">
                              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.09em] text-stone-500">
                                Approved recipe
                              </span>
                              <select
                                className={inputClass}
                                value={item.productionRecipeVersionId || ""}
                                onChange={(event) =>
                                  updateProductionPlanItem(
                                    index,
                                    "productionRecipeVersionId",
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">Choose recipe</option>
                                {approvedRecipes.map((recipe) => (
                                  <option key={recipe.id} value={recipe.id}>
                                    {recipe.title || recipe.recipeKey}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="mb-1 block text-[8px] font-black uppercase tracking-[0.09em] text-stone-500">
                                Portions
                              </span>
                              <input
                                className={inputClass}
                                type="number"
                                min="1"
                                value={item.portions ?? 1}
                                onChange={(event) =>
                                  updateProductionPlanItem(
                                    index,
                                    "portions",
                                    Number(event.target.value)
                                  )
                                }
                              />
                            </label>
                            <button
                              type="button"
                              disabled={productionPlanItems.length <= 1}
                              onClick={() => removeProductionPlanItem(index)}
                              className="focus-ring rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[10px] font-black text-stone-600 disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addProductionPlanItem}
                      className={secondaryButtonClass}
                    >
                      Add another recipe
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.procurement.manage") ||
                      !productionPlanForm.outletId.trim() ||
                      !productionPlanItems.length ||
                      productionPlanItems.some(
                        (item) =>
                          !item.productionRecipeVersionId ||
                          Number(item.portions) <= 0
                      )
                    }
                    onClick={() =>
                      run(
                        () =>
                          createHospitalityProductionPlan({
                            outletId: productionPlanForm.outletId.trim(),
                            planDate: new Date(
                              `${productionPlanForm.planDate}T00:00:00.000Z`
                            ).toISOString(),
                            items: productionPlanItems,
                          }),
                        "Kitchen production plan saved."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Save production plan
                  </button>
                </section>

                <section className="flex h-full flex-col rounded-[20px] border border-violet-200 bg-violet-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                        Supplier comparison
                      </p>
                      <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                        Compare what needs to be bought
                      </h2>
                      <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                        Select one or more saved production plans. EPANTRY will
                        combine their needs and compare the eligible supplier
                        options.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black text-violet-700 shadow-sm sm:text-[10px]">
                      {productionPlans.length} plans
                    </span>
                  </div>

                  <div className="mt-3 flex-1 space-y-2">
                    {productionPlans.length ? (
                      productionPlans.map((plan, index) => {
                        const selected = selectedProductionPlanIds.includes(
                          plan.id
                        );
                        const outlet = outlets.find(
                          (item) => item.id === plan.outletId
                        );
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => toggleProductionPlan(plan.id)}
                            className={`focus-ring w-full rounded-[14px] border px-3 py-2.5 text-left transition ${
                              selected
                                ? "border-violet-300 bg-white shadow-sm"
                                : "border-white/80 bg-white/65 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-stone-950 sm:text-xs">
                                  {outlet?.name ||
                                    outlet?.outletCode ||
                                    `Production plan ${index + 1}`}
                                </p>
                                <p className="mt-0.5 text-[9px] font-semibold text-stone-500 sm:text-[10px]">
                                  {plan.planDate
                                    ? new Date(
                                        plan.planDate
                                      ).toLocaleDateString("en-IN")
                                    : "Saved production plan"}
                                </p>
                              </div>
                              <span
                                className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-black ${
                                  selected
                                    ? "bg-violet-600 text-white"
                                    : "border border-stone-200 bg-white text-stone-400"
                                }`}
                              >
                                {selected ? "✓" : ""}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-[14px] border border-dashed border-violet-200 bg-white/55 px-3 py-5 text-center">
                        <p className="text-[10px] font-bold text-stone-600 sm:text-xs">
                          No production plan saved yet.
                        </p>
                        <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                          Create a kitchen plan in the middle card first.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.procurement.manage") ||
                      selectedProductionPlanIds.length === 0
                    }
                    onClick={() =>
                      run(
                        () =>
                          createHospitalityProcurementPlan({
                            productionPlanIds: selectedProductionPlanIds,
                          }),
                        "Supplier comparison created. No purchase order was sent automatically."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Compare suppliers
                  </button>
                  <p className="mt-2 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                    This comparison only helps you decide what to buy. It does
                    not place an order automatically.
                  </p>
                </section>
              </div>

              <Link
                to="/host/hospitality/costing"
                className="focus-ring flex items-center justify-between gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50/75 px-3.5 py-3 transition hover:-translate-y-0.5 hover:shadow-md sm:px-4 sm:py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                    Next step
                  </p>
                  <p className="mt-0.5 text-[11px] font-black text-stone-950 sm:text-sm">
                    Review food costing
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-stone-600 sm:text-[10px]">
                    After purchasing plans are ready, check the cost of your
                    approved kitchen recipes.
                  </p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-emerald-800" />
              </Link>
            </div>
          ) : null}

          {section === "costing" ? (
            <div className="mt-3 grid items-stretch gap-3 sm:mt-4 sm:gap-4 lg:grid-cols-2">
              <section className="flex h-full flex-col rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                    Recipe to cost
                  </p>
                  <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                    Calculate food cost
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Choose an approved kitchen recipe. Select an outlet too when
                    your account or buying prices are outlet-specific.
                  </p>
                </div>

                <div className="mt-3 grid gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Approved kitchen recipe
                    </span>
                    <select
                      className={inputClass}
                      value={costForm.recipeId}
                      onChange={(event) =>
                        setCostForm((current) => ({
                          ...current,
                          recipeId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a recipe</option>
                      {approvedRecipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.title || recipe.recipeKey}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                      Outlet
                    </span>
                    <select
                      className={inputClass}
                      value={costForm.outletId}
                      onChange={(event) =>
                        setCostForm((current) => ({
                          ...current,
                          outletId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Business-wide / no specific outlet
                      </option>
                      {outlets.map((outlet) => (
                        <option key={outlet.id} value={outlet.id}>
                          {outlet.name || outlet.outletCode}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !can("hospitality.costing.read") ||
                    !costForm.recipeId.trim()
                  }
                  onClick={async () => {
                    const result = await run(
                      () =>
                        calculateHospitalityRecipeCost(
                          costForm.recipeId.trim(),
                          { outletId: costForm.outletId.trim() || null }
                        ),
                      "Food cost calculated."
                    );
                    if (result?.recipeCost) setLastCost(result.recipeCost);
                  }}
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  Calculate food cost
                </button>
              </section>

              <section className="flex h-full flex-col rounded-[20px] border border-sky-200 bg-sky-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                    Latest result
                  </p>
                  <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                    Recipe cost
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    See the estimated cost of making the full recipe and one
                    portion using your saved supplier prices.
                  </p>
                </div>

                {lastCost ? (
                  <div className="mt-3 grid flex-1 grid-cols-2 gap-2.5">
                    <div className="rounded-[16px] border border-white/85 bg-white/85 p-3 shadow-sm sm:p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[10px]">
                        Full recipe
                      </p>
                      <p className="mt-1.5 text-lg font-black tracking-[-0.02em] text-stone-950 sm:text-2xl">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: lastCost.currency || "INR",
                        }).format((Number(lastCost.totalCostMinor) || 0) / 100)}
                      </p>
                    </div>
                    <div className="rounded-[16px] border border-white/85 bg-white/85 p-3 shadow-sm sm:p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-stone-500 sm:text-[10px]">
                        Per portion
                      </p>
                      <p className="mt-1.5 text-lg font-black tracking-[-0.02em] text-stone-950 sm:text-2xl">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: lastCost.currency || "INR",
                        }).format(
                          (Number(lastCost.costPerPortionMinor) || 0) / 100
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid flex-1 place-items-center rounded-[16px] border border-dashed border-sky-200 bg-white/55 px-4 py-8 text-center">
                    <div>
                      <Calculator size={22} className="mx-auto text-sky-700" />
                      <p className="mt-2 text-[10px] font-black text-stone-700 sm:text-xs">
                        No calculation yet
                      </p>
                      <p className="mt-1 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                        Choose a recipe on the left and calculate its food cost.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {section === "passports" ? (
            <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              <div className="rounded-[16px] border border-emerald-200 bg-emerald-50/75 px-3.5 py-3 text-[10px] font-semibold leading-5 text-emerald-900 sm:rounded-[18px] sm:px-4 sm:text-xs">
                This record can only be created after the kitchen recipe and
                required food-safety checks are approved. If any safety detail
                still needs review, EPANTRY will pause approval until it is
                resolved.
              </div>

              <div className="grid gap-3 lg:grid-cols-3 lg:items-stretch">
                <section className="flex h-full flex-col rounded-[20px] border border-emerald-200 bg-emerald-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                      Start the record
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Create a dish record
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Choose the outlet and approved kitchen recipe EPANTRY
                      should use to prepare this dish record.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Outlet
                      </span>
                      <select
                        className={inputClass}
                        value={passportForm.outletId}
                        onChange={(event) =>
                          setPassportForm((current) => ({
                            ...current,
                            outletId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose an outlet</option>
                        {outlets.map((outlet) => (
                          <option key={outlet.id} value={outlet.id}>
                            {outlet.name || outlet.outletCode}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Approved kitchen recipe
                      </span>
                      <select
                        className={inputClass}
                        value={passportForm.productionRecipeVersionId}
                        onChange={(event) =>
                          setPassportForm((current) => ({
                            ...current,
                            productionRecipeVersionId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Choose an approved recipe</option>
                        {approvedRecipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.title || recipe.recipeKey}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.passports.generate") ||
                      !passportForm.outletId.trim() ||
                      !passportForm.productionRecipeVersionId.trim()
                    }
                    onClick={() =>
                      run(
                        () =>
                          generateDishPassportSnapshot({
                            outletId: passportForm.outletId.trim(),
                            productionRecipeVersionId:
                              passportForm.productionRecipeVersionId.trim(),
                            changeCaseId: null,
                          }),
                        "Dish record created for review."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Create dish record
                  </button>
                </section>

                <section className="flex h-full flex-col rounded-[20px] border border-sky-200 bg-sky-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                      Review details
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Add the review note
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Add a short reason and the supporting check or document
                      used before approving or publishing the record.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Review note
                      </span>
                      <input
                        className={inputClass}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Why is this record ready?"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Supporting check or document
                      </span>
                      <input
                        className={inputClass}
                        value={evidenceLabel}
                        onChange={(event) =>
                          setEvidenceLabel(event.target.value)
                        }
                        placeholder="Example: Kitchen safety review"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Reference number or ID
                      </span>
                      <input
                        className={inputClass}
                        value={evidenceReferenceId}
                        onChange={(event) =>
                          setEvidenceReferenceId(event.target.value)
                        }
                        placeholder="Supporting reference"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                    This review information is sent with the dish record for
                    Super Admin approval and is also used when you publish the
                    approved record.
                  </p>
                </section>

                <section className="flex h-full flex-col rounded-[20px] border border-violet-200 bg-violet-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                        Saved records
                      </p>
                      <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                        Dish record versions
                      </h2>
                      <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                        Review the current status, wait for Super Admin
                        approval, then publish the approved version customers or
                        staff should use.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-black text-violet-800 shadow-sm">
                      {passports.length}
                    </span>
                  </div>

                  {passports.length ? (
                    <div className="mt-3 space-y-2.5">
                      {passports.map((passport) => (
                        <div
                          key={passport.id}
                          className="rounded-[16px] border border-white/85 bg-white/85 p-3 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black text-stone-950 sm:text-xs">
                              {passport.snapshot?.dish?.name ||
                                passport.passportKey}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-stone-100 px-2 py-1 text-[8px] font-black text-stone-600">
                                v{passport.versionNumber}
                              </span>
                              <span className="rounded-full bg-sky-100 px-2 py-1 text-[8px] font-black text-sky-800">
                                {titleize(passport.status)}
                              </span>
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[8px] font-black text-emerald-800">
                                {titleize(passport.verificationState)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {passport.status === "draft" &&
                            passport.verificationState === "verified" ? (
                              <span className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black text-sky-800">
                                Waiting for Super Admin approval
                              </span>
                            ) : null}
                            {passport.status === "approved" &&
                            can("hospitality.passports.generate") ? (
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  decisionEvidence().length === 0 ||
                                  reason.trim().length < 10
                                }
                                onClick={() =>
                                  run(
                                    () =>
                                      publishDishPassportSnapshot(passport.id, {
                                        reason: reason.trim(),
                                        evidence: decisionEvidence(),
                                      }),
                                    "Dish record published; the previous version remains in history."
                                  )
                                }
                                className={primaryButtonClass}
                              >
                                Publish record
                              </button>
                            ) : null}
                            {passport.status === "published" ? (
                              <Link
                                className={secondaryButtonClass}
                                target="_blank"
                                rel="noreferrer"
                                to={`/dish-passports/${passport.publicId}`}
                              >
                                Open public record
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 grid flex-1 place-items-center rounded-[16px] border border-dashed border-violet-200 bg-white/55 px-4 py-7 text-center">
                      <div>
                        <FileSearch
                          size={22}
                          className="mx-auto text-violet-700"
                        />
                        <p className="mt-2 text-[10px] font-black text-stone-700 sm:text-xs">
                          No dish records yet
                        </p>
                        <p className="mt-1 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                          Create the first record using the outlet and approved
                          recipe on the left.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          ) : null}

          {section === "greyBook" ? (
            <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4 xl:grid-cols-2">
              <section className="flex h-full flex-col rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                    Create record book
                  </p>
                  <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                    Save the current published records
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Choose an outlet to save a dated record of the dish
                    information that is approved and published there right now.
                  </p>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                    Outlet
                  </span>
                  <select
                    className={inputClass}
                    value={greyBookOutletId}
                    onChange={(event) =>
                      setGreyBookOutletId(event.target.value)
                    }
                  >
                    <option value="">Choose an outlet</option>
                    {outlets.map((outlet) => (
                      <option key={outlet.id} value={outlet.id}>
                        {outlet.name || outlet.outletCode}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mt-3 rounded-[16px] border border-white/85 bg-white/70 p-3 text-[9px] font-medium leading-4 text-stone-600 sm:text-[10px]">
                  A new record book keeps its own date and history. Older saved
                  records remain unchanged.
                </div>

                <button
                  type="button"
                  disabled={
                    busy ||
                    !can("hospitality.grey_book.generate") ||
                    !greyBookOutletId.trim()
                  }
                  onClick={() =>
                    run(
                      () =>
                        generateGreyBookSnapshot({
                          outletId: greyBookOutletId.trim(),
                          effectiveAt: new Date().toISOString(),
                          changeCaseId: null,
                        }),
                      "Published outlet record book created."
                    )
                  }
                  className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                >
                  Create record book
                </button>
              </section>

              <section className="flex h-full flex-col rounded-[20px] border border-violet-200 bg-violet-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                      Saved history
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Outlet record books
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Review earlier saved versions or download a copy when you
                      need it for operations, checks or records.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-black text-violet-800 shadow-sm">
                    {greyBooks.length}
                  </span>
                </div>

                {greyBooks.length ? (
                  <div className="mt-3 space-y-2.5">
                    {greyBooks.map((greyBook) => (
                      <div
                        key={greyBook.id}
                        className="rounded-[16px] border border-white/85 bg-white/85 p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black text-stone-950 sm:text-xs">
                              {greyBook.snapshot?.outlet?.name ||
                                greyBook.greyBookKey}
                            </p>
                            <p className="mt-1 text-[9px] font-medium text-stone-500 sm:text-[10px]">
                              Version {greyBook.versionNumber} ·{" "}
                              {greyBook.passportSnapshotIds?.length || 0}{" "}
                              published dish records
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={greyBookExportUrl(greyBook.id, "csv")}
                              className={secondaryButtonClass}
                            >
                              Download spreadsheet
                            </a>
                            <a
                              href={greyBookExportUrl(greyBook.id, "json")}
                              className={secondaryButtonClass}
                            >
                              Download data file
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 grid flex-1 place-items-center rounded-[16px] border border-dashed border-violet-200 bg-white/55 px-4 py-7 text-center">
                    <div>
                      <BookOpenCheck
                        size={22}
                        className="mx-auto text-violet-700"
                      />
                      <p className="mt-2 text-[10px] font-black text-stone-700 sm:text-xs">
                        No record books yet
                      </p>
                      <p className="mt-1 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                        Choose an outlet on the left and create the first saved
                        record.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {section === "changeManagement" ? (
            <div className="mt-3 space-y-3 sm:mt-4 sm:space-y-4">
              <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
                <section className="flex h-full flex-col rounded-[20px] border border-emerald-200 bg-emerald-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:text-[10px]">
                      Changed record
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Check what changed
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Choose the kind of record that changed, add its reference,
                      and describe which part of it was updated.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        What changed?
                      </span>
                      <select
                        className={inputClass}
                        value={changeForm.sourceType}
                        onChange={(event) =>
                          setChangeForm((current) => ({
                            ...current,
                            sourceType: event.target.value,
                          }))
                        }
                      >
                        <option value="product_version">
                          Product or pack record
                        </option>
                        <option value="canonical_ingredient">
                          Ingredient record
                        </option>
                        <option value="recipe_version">
                          Published recipe record
                        </option>
                        <option value="production_recipe_version">
                          Kitchen recipe
                        </option>
                        <option value="supplier_product">Supplier item</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Record reference
                      </span>
                      <input
                        className={inputClass}
                        placeholder="Paste the reference for the changed item or recipe"
                        value={changeForm.sourceId}
                        onChange={(event) =>
                          setChangeForm((current) => ({
                            ...current,
                            sourceId: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                          Version or label (optional)
                        </span>
                        <input
                          className={inputClass}
                          placeholder="Example: v3 or September update"
                          value={changeForm.sourceVersion}
                          onChange={(event) =>
                            setChangeForm((current) => ({
                              ...current,
                              sourceVersion: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                          What part changed?
                        </span>
                        <input
                          className={inputClass}
                          placeholder="Example: ingredients, allergen, pack size"
                          value={changeForm.changedDomains}
                          onChange={(event) =>
                            setChangeForm((current) => ({
                              ...current,
                              changedDomains: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <p className="mt-3 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                    Add the review details in the card beside this one before
                    checking which records are affected.
                  </p>

                  <button
                    type="button"
                    disabled={
                      busy ||
                      !can("hospitality.change.manage") ||
                      !changeForm.sourceId.trim() ||
                      decisionEvidence().length === 0
                    }
                    onClick={() =>
                      run(
                        () =>
                          detectHospitalityChangeImpact({
                            sourceType: changeForm.sourceType,
                            sourceId: changeForm.sourceId.trim(),
                            sourceVersion: changeForm.sourceVersion.trim(),
                            changedDomains: changeForm.changedDomains
                              .split(",")
                              .map((value) => value.trim())
                              .filter(Boolean),
                            reason: reason.trim(),
                            evidence: decisionEvidence(),
                          }),
                        "Affected records checked."
                      )
                    }
                    className={`${primaryButtonClass} mt-3 w-full sm:w-auto`}
                  >
                    Check affected records
                  </button>
                </section>

                <section className="flex h-full flex-col rounded-[20px] border border-sky-200 bg-sky-50/75 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-800 sm:text-[10px]">
                      Review details
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Explain the change
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Add the reason for the review and the supporting check or
                      document used before approving any updates.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-2.5">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Review note
                      </span>
                      <input
                        className={inputClass}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Explain what changed and why it needs review"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Supporting check or document
                      </span>
                      <input
                        className={inputClass}
                        value={evidenceLabel}
                        onChange={(event) =>
                          setEvidenceLabel(event.target.value)
                        }
                        placeholder="Example: Supplier update or kitchen review"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.1em] text-stone-500">
                        Reference number or ID
                      </span>
                      <input
                        className={inputClass}
                        value={evidenceReferenceId}
                        onChange={(event) =>
                          setEvidenceReferenceId(event.target.value)
                        }
                        placeholder="Supporting reference"
                      />
                    </label>
                  </div>

                  <div className="mt-3 rounded-[16px] border border-white/85 bg-white/65 p-3 text-[9px] font-medium leading-4 text-stone-600 sm:text-[10px]">
                    Older published records stay in history. Approved changes
                    create new updated records instead of silently replacing
                    what was already published.
                  </div>
                </section>
              </div>

              <section className="rounded-[20px] border border-violet-200 bg-violet-50/70 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:rounded-[22px] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-800 sm:text-[10px]">
                      Review queue
                    </p>
                    <h2 className="mt-1 text-sm font-black text-stone-950 sm:text-base">
                      Changes to review
                    </h2>
                    <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                      Check what each change affects and recheck it when needed.
                      Recalculated changes wait for Super Admin approval before
                      you can publish them.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[9px] font-black text-violet-800 shadow-sm">
                    {changeCases.length}
                  </span>
                </div>

                {changeCases.length ? (
                  <div className="mt-3 grid gap-2.5 xl:grid-cols-2">
                    {changeCases.map((changeCase) => (
                      <div
                        key={changeCase.id}
                        className="flex h-full flex-col rounded-[16px] border border-white/85 bg-white/85 p-3 shadow-sm sm:p-3.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-violet-100 px-2 py-1 text-[8px] font-black text-violet-800">
                            {changeCase.caseKey}
                          </span>
                          <span className="rounded-full bg-stone-100 px-2 py-1 text-[8px] font-black text-stone-600">
                            {titleize(changeCase.severity)}
                          </span>
                          <span className="rounded-full bg-sky-100 px-2 py-1 text-[8px] font-black text-sky-800">
                            {titleize(changeCase.status)}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] font-black text-stone-950 sm:text-xs">
                          {changeSourceLabel(changeCase.source?.type)}
                        </p>
                        <p className="mt-1 break-all text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                          Reference: {changeCase.source?.id || "Not available"}
                        </p>

                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <div className="rounded-[12px] bg-emerald-50 px-2 py-2 text-center">
                            <p className="text-[11px] font-black text-emerald-800">
                              {changeCase.impactedProductionRecipeVersionIds
                                ?.length || 0}
                            </p>
                            <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-emerald-700">
                              Recipes
                            </p>
                          </div>
                          <div className="rounded-[12px] bg-sky-50 px-2 py-2 text-center">
                            <p className="text-[11px] font-black text-sky-800">
                              {changeCase.impactedOutletIds?.length || 0}
                            </p>
                            <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-sky-700">
                              Outlets
                            </p>
                          </div>
                          <div className="rounded-[12px] bg-violet-50 px-2 py-2 text-center">
                            <p className="text-[11px] font-black text-violet-800">
                              {changeCase.candidatePassportSnapshotIds
                                ?.length || 0}
                            </p>
                            <p className="mt-0.5 text-[7px] font-black uppercase tracking-[0.08em] text-violet-700">
                              Dish records
                            </p>
                          </div>
                        </div>

                        {(changeCase.recalculationNotes || []).length ? (
                          <div className="mt-2 rounded-[12px] bg-stone-50 p-2.5 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                            {(changeCase.recalculationNotes || []).map(
                              (note, index) => (
                                <p key={`${changeCase.id}:${index}`}>
                                  {titleize(note.state)}
                                  {note.message ? ` · ${note.message}` : ""}
                                </p>
                              )
                            )}
                          </div>
                        ) : null}

                        <div className="mt-auto flex flex-wrap gap-2 pt-3">
                          {["detected", "blocked"].includes(
                            changeCase.status
                          ) && can("hospitality.change.manage") ? (
                            <button
                              type="button"
                              disabled={
                                busy ||
                                decisionEvidence().length === 0 ||
                                reason.trim().length < 10
                              }
                              onClick={() =>
                                run(
                                  () =>
                                    recalculateHospitalityChangeCase(
                                      changeCase.id,
                                      {
                                        reason: reason.trim(),
                                        evidence: decisionEvidence(),
                                      }
                                    ),
                                  "Affected records checked again."
                                )
                              }
                              className={secondaryButtonClass}
                            >
                              Recheck impact
                            </button>
                          ) : null}
                          {changeCase.status === "recalculated" ? (
                            <span className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-black text-sky-800">
                              Waiting for Super Admin approval
                            </span>
                          ) : null}
                          {changeCase.status === "approved" &&
                          can("hospitality.change.manage") &&
                          can("hospitality.passports.generate") &&
                          can("hospitality.grey_book.generate") ? (
                            <button
                              type="button"
                              disabled={
                                busy ||
                                decisionEvidence().length === 0 ||
                                reason.trim().length < 10
                              }
                              onClick={() =>
                                run(
                                  () =>
                                    publishHospitalityChangeCase(
                                      changeCase.id,
                                      {
                                        reason: reason.trim(),
                                        evidence: decisionEvidence(),
                                      }
                                    ),
                                  "Updated records published."
                                )
                              }
                              className={primaryButtonClass}
                            >
                              Publish update
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 grid min-h-32 place-items-center rounded-[16px] border border-dashed border-violet-200 bg-white/55 px-4 py-7 text-center">
                    <div>
                      <ScrollText
                        size={22}
                        className="mx-auto text-violet-700"
                      />
                      <p className="mt-2 text-[10px] font-black text-stone-700 sm:text-xs">
                        No changes waiting for review
                      </p>
                      <p className="mt-1 text-[9px] font-medium leading-4 text-stone-500 sm:text-[10px]">
                        When you check a changed record, the affected items will
                        appear here.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {isDashboard ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Built-in checks
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    EPANTRY can help organize information, but important food
                    records and business changes still follow your existing
                    review and approval rules.
                  </p>
                </div>
              </div>
            </section>
          ) : isSuppliers ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <PackageSearch
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: add what each supplier provides
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Once your suppliers are saved, open Ingredients & products
                    to connect their items, pack sizes and purchasing costs.
                  </p>
                  <Link
                    to="/host/hospitality/products"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open ingredients & products
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isProducts ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <ChefHat
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: build your kitchen recipes
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    After supplier items and buying prices are saved, use them
                    while building standardized kitchen recipes for your
                    outlets.
                  </p>
                  <Link
                    to="/host/hospitality/recipes"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open kitchen recipes
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isRecipes ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <ClipboardList
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: put approved recipes on your menus
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Once a kitchen recipe is approved, open Menus to choose the
                    outlet and selling details for that dish.
                  </p>
                  <Link
                    to="/host/hospitality/menus"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open menus
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isMenus ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <ShoppingCart
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: plan production and purchasing
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Once outlet menus are ready, continue to Purchasing to plan
                    production demand, stock needs and supplier buying.
                  </p>
                  <Link
                    to="/host/hospitality/procurement"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open purchasing
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isCosting ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <FileSearch
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: continue to dish records
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    After checking the recipe cost, continue to Dish records
                    when you are ready to prepare the approved dish information
                    used across Hospitality.
                  </p>
                  <Link
                    to="/host/hospitality/passports"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open dish records
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isPassports ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <BookOpenCheck
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: keep published dish records together
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Once a dish record is published, continue to the outlet
                    record book to keep the approved published versions
                    together.
                  </p>
                  <Link
                    to="/host/hospitality/grey-book"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open published records
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isGreyBook ? (
            <section className="mt-3 rounded-[18px] border border-violet-200 bg-violet-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <ScrollText
                  className="mt-0.5 shrink-0 text-violet-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Next: review changes and history
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    If a recipe, ingredient or published dish record changes
                    later, open Changes & history to review what needs attention
                    next.
                  </p>
                  <Link
                    to="/host/hospitality/change-management"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-violet-800 sm:text-[10px]"
                  >
                    Open changes & history
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : isChangeManagement ? (
            <section className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:mt-4 sm:px-5 sm:py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-emerald-700"
                  size={17}
                />
                <div>
                  <h2 className="text-xs font-black text-stone-950 sm:text-sm">
                    Finished reviewing changes?
                  </h2>
                  <p className="mt-1 text-[10px] font-medium leading-5 text-stone-600 sm:text-xs">
                    Return to Hospitality overview to continue with outlets,
                    suppliers, recipes or purchasing.
                  </p>
                  <Link
                    to="/host/hospitality"
                    className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-emerald-800 sm:text-[10px]"
                  >
                    Back to Hospitality overview
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </section>
          ) : (
            <section className="mt-5 rounded-[24px] border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 shrink-0 text-emerald-400"
                  size={18}
                />
                <div>
                  <h2 className="text-sm font-black">
                    Before important changes go live
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-stone-400">
                    You can manage outlets, suppliers, recipes and purchasing
                    here. Safety-sensitive dish records, allergen decisions and
                    major changes still need the required review before they can
                    be published or treated as final.
                  </p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
