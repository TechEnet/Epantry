import {
  Apple,
  BadgeCheck,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileSearch,
  ImagePlus,
  Images,
  Leaf,
  LoaderCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Upload,
  TableProperties,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import MediaPrivacyHoldPanel from "../../mediaPrivacy/components/MediaPrivacyHoldPanel";

import { extractMediaPrivacyHolds } from "../../mediaPrivacy/services/mediaPrivacy.service";

import { listHostBrandAuthorities } from "../../brands/services/brandAuthority.service";

import {
  createHostBulkNpiBatch,
  createHostNpiFromImages,
  getHostNpiDraft,
  getUniversalProductErrorMessage,
  listHostNpiDrafts,
  uploadProductEvidenceBatch,
} from "../services/universalProduct.service";

import { parseBulkNpiWorkbook } from "../services/bulkNpiWorkbook";

const PURPOSES = [
  ["front_pack", "Front of pack"],
  ["ingredient_panel", "Ingredients panel"],
  ["allergen_statement", "Allergen statement"],
  ["nutrition_panel", "Nutrition panel"],
  ["barcode", "Barcode"],
  ["back_pack", "Back / manufacturer panel"],
  ["certification_mark", "Certification mark"],
  ["other", "Other panel"],
];

const STATUS_OPTIONS = [
  "",
  "provisional",
  "extracting",
  "ready_for_review",
  "needs_more_evidence",
  "approved_for_catalog",
  "rejected",
];

const MANUAL_NUTRIENTS = [
  ["energy", "Energy", "kcal"],
  ["protein", "Protein", "g"],
  ["carbohydrate", "Carbohydrate", "g"],
  ["total_fat", "Total Fat", "g"],
  ["saturated_fat", "Saturated Fat", "g"],
  ["dietary_fibre", "Dietary Fibre", "g"],
  ["total_sugars", "Total Sugars", "g"],
  ["sodium", "Sodium", "mg"],
];

const EMPTY_MANUAL_DETAILS = {
  ingredientDeclarationText: "",
  allergenStatement: "",
  containsAllergens: "",
  mayContainAllergens: "",
  countryOfOrigin: "",
  manufacturerName: "",
  nutritionBasis: "per_100g",
  servingSizeValue: "",
  servingSizeUnit: "g",
  nutrients: Object.fromEntries(
    MANUAL_NUTRIENTS.map(([key]) => [key, ""])
  ),
  dietaryClaims: {
    vegetarian: false,
    vegan: false,
    glutenFree: false,
  },
};


const LISTING_TYPES = [
  ["packaged", "Packaged Food", "Pack / label based grocery"],
  ["vegetable", "Vegetables", "Fresh vegetable listing"],
  ["fruit", "Fruits", "Fresh fruit listing"],
];

const EMPTY_PRODUCE_DETAILS = {
  name: "",
  brandName: "",
  quantityValue: "",
  quantityUnit: "kg",
  countryOfOrigin: "",
  manufacturerName: "",
  nutrients: Object.fromEntries(
    MANUAL_NUTRIENTS.map(([key]) => [key, ""])
  ),
};

function splitCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildHostDeclarations(details) {
  const allergens = [
    ...splitCommaList(details.containsAllergens).map((name) => ({
      name,
      relationType: "contains",
    })),
    ...splitCommaList(details.mayContainAllergens).map((name) => ({
      name,
      relationType: "may_contain",
    })),
  ];

  const nutrients = MANUAL_NUTRIENTS.map(([key, label, unit]) => {
    const raw = details.nutrients?.[key];

    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }

    const amount = Number(raw);

    return Number.isFinite(amount) && amount >= 0
      ? {
          name: label,
          amount,
          unit,
        }
      : null;
  }).filter(Boolean);

  const servingValue = Number(details.servingSizeValue);

  const claims = [
    details.dietaryClaims?.vegetarian ? "Vegetarian" : "",
    details.dietaryClaims?.vegan ? "Vegan" : "",
    details.dietaryClaims?.glutenFree ? "Gluten Free" : "",
  ].filter(Boolean);

  const hasNutrition =
    nutrients.length > 0 ||
    (Number.isFinite(servingValue) && servingValue > 0);

  return {
    ingredientDeclarationText: details.ingredientDeclarationText.trim(),
    allergenStatement: details.allergenStatement.trim(),
    allergens,
    ...(hasNutrition
      ? {
          nutrition: {
            basis: details.nutritionBasis || null,
            servingSize:
              Number.isFinite(servingValue) && servingValue > 0
                ? {
                    value: servingValue,
                    unit: details.servingSizeUnit,
                  }
                : null,
            nutrients,
          },
        }
      : {}),
    countryOfOrigin: details.countryOfOrigin.trim(),
    manufacturerName: details.manufacturerName.trim(),
    claims,
  };
}

function buildProduceDeclarations(details) {
  const nutrients = MANUAL_NUTRIENTS.map(([key, label, unit]) => ({
    name: label,
    amount: Number(details.nutrients?.[key]),
    unit,
  })).filter(
    (item) => Number.isFinite(item.amount) && item.amount >= 0
  );

  return {
    ingredientDeclarationText: "",
    allergenStatement: "",
    allergens: [],
    nutrition: {
      basis: "per_100g",
      servingSize: null,
      nutrients,
    },
    countryOfOrigin: details.countryOfOrigin.trim(),
    manufacturerName: details.manufacturerName.trim(),
    claims: [],
  };
}

function ProduceNpiForm({
  listingType,
  market,
  setMarket,
  onCreated,
  setPageError,
  setPageSuccess,
  setPagePrivacyHolds,
}) {
  const [details, setDetails] = useState(EMPTY_PRODUCE_DETAILS);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [privacyPendingAssets, setPrivacyPendingAssets] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(null);

  const isVegetable = listingType === "vegetable";
  const typeLabel = isVegetable ? "Vegetable" : "Fruit";
  const TypeIcon = isVegetable ? Leaf : Apple;

  function addProduceFiles(event) {
    setPrivacyPendingAssets([]);
    setPagePrivacyHolds([]);

    const files = Array.from(event.target.files || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    event.target.value = "";

    setEvidenceFiles((current) =>
      [
        ...current,
        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random()}`,
          purpose: "front_pack",
          file,
        })),
      ].slice(0, 4)
    );
  }

  async function submitProduce(event) {
    event.preventDefault();

    const quantityValue = Number(details.quantityValue);
    const nutritionComplete = MANUAL_NUTRIENTS.every(([key]) => {
      const value = Number(details.nutrients?.[key]);
      return details.nutrients?.[key] !== "" && Number.isFinite(value) && value >= 0;
    });

    if (!details.name.trim()) {
      setPageError(`${typeLabel} name is required.`);
      return;
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setPageError(`Enter a valid ${typeLabel.toLowerCase()} quantity.`);
      return;
    }

    if (!details.countryOfOrigin.trim()) {
      setPageError("Country of origin is required for fresh produce.");
      return;
    }

    if (!nutritionComplete) {
      setPageError("Complete all required nutrition values per 100 g.");
      return;
    }

    if (!evidenceFiles.length && !privacyPendingAssets.length) {
      setPageError(`Add at least one ${typeLabel.toLowerCase()} photo.`);
      return;
    }

    setSubmitting(true);
    setPageError("");
    setPageSuccess("");
    setPagePrivacyHolds([]);
    setProgress({
      completed: 0,
      total: evidenceFiles.length,
    });

    let assets = privacyPendingAssets;

    try {
      if (!assets.length) {
        assets = await uploadProductEvidenceBatch({
          evidenceFiles,
          scope: "host",
          onProgress: setProgress,
        });
      }

      const result = await createHostNpiFromImages({
        assets,
        market,
        listingType,
        hints: {
          title: details.name.trim(),
          brandName: details.brandName.trim() || "Fresh Produce",
          barcode: "",
          netQuantityText: `${quantityValue} ${details.quantityUnit}`,
        },
        hostDeclarations: buildProduceDeclarations(details),
      });

      setPageSuccess(
        result?.resolution?.draft?.status === "ready_for_review"
          ? `${typeLabel} draft created and sent to the governed Super Admin review queue.`
          : `${typeLabel} evidence saved. Review the updated draft status.`
      );

      setDetails(EMPTY_PRODUCE_DETAILS);
      setEvidenceFiles([]);
      setPrivacyPendingAssets([]);

      await onCreated();
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      setPagePrivacyHolds(holds);

      if (holds.length) {
        setPrivacyPendingAssets(assets);
        await onCreated();
      }

      setPageError(
        getUniversalProductErrorMessage(
          requestError,
          `Unable to create the ${typeLabel.toLowerCase()} NPI draft.`
        )
      );
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <form
      onSubmit={submitProduce}
      className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
          <TypeIcon size={19} />
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
            New {typeLabel.toLowerCase()} draft
          </p>

          <h2 className="text-lg font-black text-stone-950">
            Create fresh {typeLabel.toLowerCase()} listing
          </h2>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-black text-stone-500">
              {typeLabel} name *
            </span>
            <input
              value={details.name}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={isVegetable ? "Example: Tomato" : "Example: Banana"}
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">Market</span>
            <input
              value={market}
              onChange={(event) =>
                setMarket(event.target.value.toUpperCase().slice(0, 10))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">
              Quantity *
            </span>
            <input
              type="number"
              min="0"
              step="any"
              value={details.quantityValue}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  quantityValue: event.target.value,
                }))
              }
              placeholder="Example: 1"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">Unit *</span>
            <select
              value={details.quantityUnit}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  quantityUnit: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="piece">piece</option>
              <option value="dozen">dozen</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">
              Country of origin *
            </span>
            <input
              value={details.countryOfOrigin}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  countryOfOrigin: event.target.value,
                }))
              }
              placeholder="Example: India"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="text-xs font-black text-stone-500">
              Grower / brand (optional)
            </span>
            <input
              value={details.brandName}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  brandName: event.target.value,
                }))
              }
              placeholder="Defaults to Fresh Produce"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-black text-stone-500">
              Grower / supplier name (optional)
            </span>
            <input
              value={details.manufacturerName}
              onChange={(event) =>
                setDetails((current) => ({
                  ...current,
                  manufacturerName: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
            Nutrition per 100 g · required
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-stone-500">
            Enter the declared nutrition values that Super Admin should verify before publication.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MANUAL_NUTRIENTS.map(([key, label, unit]) => (
              <label key={key}>
                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                  {label} ({unit}) *
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={details.nutrients[key]}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      nutrients: {
                        ...current.nutrients,
                        [key]: event.target.value,
                      },
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-black text-stone-700">
            {typeLabel} photo *
          </p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-stone-500">
            Add a clear product photo. It is retained as governed evidence and follows the same Super Admin review process.
          </p>

          <label className="focus-ring mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-950 px-4 py-3 text-sm font-black text-white hover:bg-stone-800">
            <Upload size={16} />
            Add {typeLabel.toLowerCase()} photo
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={addProduceFiles}
              className="sr-only"
            />
          </label>

          {evidenceFiles.length ? (
            <div className="mt-3 space-y-2">
              {evidenceFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3"
                >
                  <ImagePlus size={16} className="text-emerald-700" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-stone-800">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] font-semibold text-stone-500">
                      Product photo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPrivacyPendingAssets([]);
                      setPagePrivacyHolds([]);
                      setEvidenceFiles((current) =>
                        current.filter((candidate) => candidate.id !== item.id)
                      );
                    }}
                    className="focus-ring grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-white hover:text-red-600"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || (!evidenceFiles.length && !privacyPendingAssets.length)}
        className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <LoaderCircle size={18} className="animate-spin" />
        ) : (
          <TypeIcon size={18} />
        )}
        {submitting
          ? progress
            ? `Uploading ${progress.completed}/${progress.total}…`
            : "Submitting…"
          : `Create ${typeLabel.toLowerCase()} NPI draft`}
      </button>
    </form>
  );
}

const BULK_TEMPLATE_PATHS = {
  packaged: "/templates/bulk-packaged-food.xlsx",
  vegetable: "/templates/bulk-vegetables.xlsx",
  fruit: "/templates/bulk-fruits.xlsx",
};

const BULK_IMAGE_COLUMNS = {
  packaged: [
    ["frontImageFile", "front_pack", true],
    ["backImageFile", "back_pack", false],
    ["nutritionImageFile", "nutrition_panel", false],
    ["ingredientsImageFile", "ingredient_panel", false],
    ["barcodeImageFile", "barcode", false],
  ],
  vegetable: [["imageFile", "front_pack", true]],
  fruit: [["imageFile", "front_pack", true]],
};

const INVENTORY_NODE_TYPES = new Set([
  "store",
  "warehouse",
  "dark_store",
  "distribution_center",
  "other",
]);

function cleanBulkValue(value) {
  return String(value ?? "").trim();
}

function bulkNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function bulkBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["true", "yes", "1", "y"].includes(
    cleanBulkValue(value).toLowerCase()
  );
}

function commercialDraftFromBulkRow(row) {
  const listPrice = bulkNumber(row.listPriceRupees);
  const salePrice = bulkNumber(row.salePriceRupees);
  const availableQuantity = bulkNumber(row.availableQuantity);

  return {
    currency: cleanBulkValue(row.currency).toUpperCase() || "INR",
    listPriceMinor: Math.round((listPrice || 0) * 100),
    salePriceMinor:
      salePrice !== null && salePrice > 0 ? Math.round(salePrice * 100) : null,
    availableQuantity: availableQuantity === null ? 0 : availableQuantity,
    inventoryNodeName: cleanBulkValue(row.inventoryNodeName),
    inventoryNodeType:
      cleanBulkValue(row.inventoryNodeType).toLowerCase() || "warehouse",
    city: cleanBulkValue(row.city),
    state: cleanBulkValue(row.state),
    pincode: cleanBulkValue(row.pincode),
    serviceAreaName: cleanBulkValue(row.serviceAreaName),
    activateAfterApproval: true,
  };
}

function packagedDeclarationsFromBulkRow(row) {
  return buildHostDeclarations({
    ingredientDeclarationText: cleanBulkValue(row.ingredients),
    allergenStatement: cleanBulkValue(row.allergenStatement),
    containsAllergens: cleanBulkValue(row.containsAllergens),
    mayContainAllergens: cleanBulkValue(row.mayContainAllergens),
    countryOfOrigin: cleanBulkValue(row.countryOfOrigin),
    manufacturerName: cleanBulkValue(row.manufacturerPacker),
    nutritionBasis: cleanBulkValue(row.nutritionBasis) || "per_100g",
    servingSizeValue: cleanBulkValue(row.servingSizeValue),
    servingSizeUnit: cleanBulkValue(row.servingSizeUnit) || "g",
    nutrients: {
      energy: cleanBulkValue(row.energyKcal),
      protein: cleanBulkValue(row.proteinG),
      carbohydrate: cleanBulkValue(row.carbohydrateG),
      total_fat: cleanBulkValue(row.totalFatG),
      saturated_fat: cleanBulkValue(row.saturatedFatG),
      dietary_fibre: cleanBulkValue(row.dietaryFibreG),
      total_sugars: cleanBulkValue(row.totalSugarsG),
      sodium: cleanBulkValue(row.sodiumMg),
    },
    dietaryClaims: {
      vegetarian: bulkBoolean(row.vegetarian),
      vegan: bulkBoolean(row.vegan),
      glutenFree: bulkBoolean(row.glutenFree),
    },
  });
}

function produceDeclarationsFromBulkRow(row) {
  return buildProduceDeclarations({
    countryOfOrigin: cleanBulkValue(row.countryOfOrigin),
    manufacturerName: cleanBulkValue(row.growerSupplier),
    nutrients: {
      energy: cleanBulkValue(row.energyKcal),
      protein: cleanBulkValue(row.proteinG),
      carbohydrate: cleanBulkValue(row.carbohydrateG),
      total_fat: cleanBulkValue(row.totalFatG),
      saturated_fat: cleanBulkValue(row.saturatedFatG),
      dietary_fibre: cleanBulkValue(row.dietaryFibreG),
      total_sugars: cleanBulkValue(row.totalSugarsG),
      sodium: cleanBulkValue(row.sodiumMg),
    },
  });
}

function validateBulkRow(row, listingType, imageFilesByName, duplicateSkus) {
  const issues = [];
  const warnings = [];
  const required = (key, label) => {
    if (!cleanBulkValue(row[key])) {
      issues.push(`${label} is required.`);
    }
  };

  required("merchantSku", "Merchant SKU");
  required("productName", "Product name");
  required("market", "Market");
  required("inventoryNodeName", "Inventory node name");
  required("inventoryNodeType", "Inventory node type");
  required("city", "Inventory city");
  required("state", "Inventory state");
  required("pincode", "Inventory pincode");
  required("serviceAreaName", "Service area name");

  if (duplicateSkus.has(cleanBulkValue(row.merchantSku).toLowerCase())) {
    issues.push("Merchant SKU is duplicated in this workbook.");
  }

  const nodeType = cleanBulkValue(row.inventoryNodeType).toLowerCase();
  if (nodeType && !INVENTORY_NODE_TYPES.has(nodeType)) {
    issues.push("Inventory node type is not supported.");
  }

  const listPrice = bulkNumber(row.listPriceRupees);
  const salePrice = bulkNumber(row.salePriceRupees);
  const availableQuantity = bulkNumber(row.availableQuantity);

  if (listPrice === null || listPrice <= 0) {
    issues.push("List price must be greater than 0.");
  }

  if (salePrice !== null && salePrice <= 0) {
    issues.push("Sale price must be blank or greater than 0.");
  }

  if (salePrice !== null && listPrice !== null && salePrice > listPrice) {
    issues.push("Sale price cannot exceed list price.");
  }

  if (availableQuantity === null || availableQuantity < 0) {
    issues.push("Available quantity must be 0 or more.");
  }

  if ((cleanBulkValue(row.currency) || "INR").toUpperCase() !== "INR") {
    issues.push("Currency must be INR.");
  }

  if (listingType === "packaged") {
    required("packSize", "Printed pack size");
    required("countryOfOrigin", "Country of origin");
    required("manufacturerPacker", "Manufacturer / packer");

    const barcode = cleanBulkValue(row.barcode);
    if (barcode && !/^\d{8,14}$/.test(barcode)) {
      warnings.push("Barcode should normally contain 8–14 digits.");
    }

    if (!cleanBulkValue(row.ingredients)) {
      warnings.push("Ingredients are blank and will require closer Super Admin review.");
    }
  } else {
    required("quantity", "Quantity");
    required("unit", "Unit");
    required("countryOfOrigin", "Country of origin");

    const quantity = bulkNumber(row.quantity);
    if (quantity === null || quantity <= 0) {
      issues.push("Quantity must be greater than 0.");
    }

    const allowedUnits = new Set(["g", "kg", "piece", "dozen"]);
    if (!allowedUnits.has(cleanBulkValue(row.unit).toLowerCase())) {
      issues.push("Unit must be g, kg, piece, or dozen.");
    }

    for (const [key, label] of [
      ["energyKcal", "Energy"],
      ["proteinG", "Protein"],
      ["carbohydrateG", "Carbohydrate"],
      ["totalFatG", "Total fat"],
      ["saturatedFatG", "Saturated fat"],
      ["dietaryFibreG", "Dietary fibre"],
      ["totalSugarsG", "Total sugars"],
      ["sodiumMg", "Sodium"],
    ]) {
      const value = bulkNumber(row[key]);
      if (value === null || value < 0) {
        issues.push(`${label} must be entered as 0 or more.`);
      }
    }
  }

  for (const [column, , requiredImage] of BULK_IMAGE_COLUMNS[listingType]) {
    const fileName = cleanBulkValue(row[column]);

    if (requiredImage && !fileName) {
      issues.push(`${column} is required.`);
      continue;
    }

    if (fileName && !imageFilesByName.has(fileName.toLowerCase())) {
      issues.push(`Image file not selected: ${fileName}`);
    }
  }

  return {
    issues,
    warnings,
  };
}

function BulkNpiPanel({
  listingType,
  onSubmitted,
  setPageError,
  setPageSuccess,
  setPagePrivacyHolds,
}) {
  const [open, setOpen] = useState(false);
  const [workbookFile, setWorkbookFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [batchResult, setBatchResult] = useState(null);

  const typeLabel =
    listingType === "packaged"
      ? "Packaged Food"
      : listingType === "vegetable"
        ? "Vegetables"
        : "Fruits";

  const imageFilesByName = useMemo(
    () =>
      new Map(
        imageFiles.map((file) => [String(file.name || "").toLowerCase(), file])
      ),
    [imageFiles]
  );

  const duplicateSkus = useMemo(() => {
    const counts = new Map();

    for (const row of rows) {
      const sku = cleanBulkValue(row.merchantSku).toLowerCase();
      if (sku) {
        counts.set(sku, (counts.get(sku) || 0) + 1);
      }
    }

    return new Set(
      [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([sku]) => sku)
    );
  }, [rows]);

  const evaluatedRows = useMemo(
    () =>
      rows.map((row) => ({
        row,
        ...validateBulkRow(row, listingType, imageFilesByName, duplicateSkus),
      })),
    [rows, listingType, imageFilesByName, duplicateSkus]
  );

  const readyRows = evaluatedRows.filter((item) => !item.issues.length);
  const issueRows = evaluatedRows.filter((item) => item.issues.length);

  async function chooseWorkbook(file) {
    if (!file) {
      return;
    }

    setReading(true);
    setPageError("");
    setPageSuccess("");
    setBatchResult(null);

    try {
      const parsed = await parseBulkNpiWorkbook(file);

      if (parsed.length > 500) {
        setWorkbookFile(null);
        setRows([]);
        setPageError(
          `This bulk workflow accepts up to 500 product rows per batch. Split ${parsed.length} rows into two or more workbooks.`
        );
        return;
      }

      setWorkbookFile(file);
      setRows(parsed);

      if (!parsed.length) {
        setPageError("No product rows were found in the Products sheet.");
      }
    } catch (requestError) {
      setWorkbookFile(null);
      setRows([]);
      setPageError(requestError?.message || "Unable to read the bulk NPI workbook.");
    } finally {
      setReading(false);
    }
  }

  function chooseImages(files) {
    const accepted = Array.from(files || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    setImageFiles(accepted);
    setPageError("");
    setBatchResult(null);
  }

  async function submitBulkBatch() {
    if (!readyRows.length || !workbookFile) {
      return;
    }

    setSubmitting(true);
    setPageError("");
    setPageSuccess("");
    setPagePrivacyHolds([]);
    setBatchResult(null);

    try {
      const payloadRows = [];

      for (let index = 0; index < readyRows.length; index += 1) {
        const source = readyRows[index].row;
        const evidenceFiles = BULK_IMAGE_COLUMNS[listingType]
          .map(([column, purpose]) => {
            const fileName = cleanBulkValue(source[column]);
            const file = imageFilesByName.get(fileName.toLowerCase());

            return file
              ? {
                  id: `${source.__rowNumber}-${column}`,
                  purpose,
                  file,
                }
              : null;
          })
          .filter(Boolean);

        setUploadProgress({
          completed: index,
          total: readyRows.length,
          label: `Uploading product ${index + 1} of ${readyRows.length}`,
        });

        const assets = await uploadProductEvidenceBatch({
          evidenceFiles,
          scope: "host",
        });

        const productName = cleanBulkValue(source.productName);
        const market = cleanBulkValue(source.market).toUpperCase() || "IN";
        const hostDeclarations =
          listingType === "packaged"
            ? packagedDeclarationsFromBulkRow(source)
            : produceDeclarationsFromBulkRow(source);
        const netQuantityText =
          listingType === "packaged"
            ? cleanBulkValue(source.packSize)
            : `${bulkNumber(source.quantity)} ${cleanBulkValue(source.unit).toLowerCase()}`;

        payloadRows.push({
          rowNumber: Number(source.__rowNumber),
          merchantSku: cleanBulkValue(source.merchantSku),
          assets,
          hints: {
            title: productName,
            brandName:
              cleanBulkValue(source.brandName) ||
              (listingType === "packaged" ? "" : "Fresh Produce"),
            barcode:
              listingType === "packaged" ? cleanBulkValue(source.barcode) : "",
            netQuantityText,
          },
          hostDeclarations,
          commercialDraft: commercialDraftFromBulkRow(source),
        });
      }

      setUploadProgress({
        completed: readyRows.length,
        total: readyRows.length,
        label: "Creating governed bulk NPI batch…",
      });

      const result = await createHostBulkNpiBatch({
        listingType,
        market: cleanBulkValue(readyRows[0]?.row?.market).toUpperCase() || "IN",
        sourceFileName: workbookFile.name,
        sourceRowCount: rows.length,
        issueCount: issueRows.length,
        validationIssues: issueRows.map((item) => ({
          rowNumber: Number(item.row.__rowNumber),
          merchantSku: cleanBulkValue(item.row.merchantSku),
          productName: cleanBulkValue(item.row.productName),
          issues: item.issues,
        })),
        rows: payloadRows,
      });

      setBatchResult(result?.batch || null);
      setPageSuccess(
        `${result?.batch?.submittedRowCount || payloadRows.length} ${typeLabel} rows were submitted as a governed bulk NPI batch. ${issueRows.length} workbook row(s) remain local issues and were not submitted.`
      );

      await onSubmitted();
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);
      setPagePrivacyHolds(holds);
      setPageError(
        getUniversalProductErrorMessage(
          requestError,
          `Unable to submit the bulk ${typeLabel.toLowerCase()} NPI batch.`
        )
      );
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-[26px] border border-blue-200 bg-blue-50 shadow-sm">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
            <FileSpreadsheet size={21} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-100">
              Bulk {typeLabel} listing
            </p>
            <h2 className="mt-1 text-lg font-black">
              Upload many products without repeating the single-product form
            </h2>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-blue-100/85">
              The workbook includes product facts, price, availability, inventory node and delivery area. Product images are selected separately and matched by filename.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={BULK_TEMPLATE_PATHS[listingType]}
            download
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-blue-800 shadow-sm hover:bg-blue-50"
          >
            <Download size={15} />
            Download Excel Template
          </a>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-black text-white hover:bg-white/20"
          >
            <TableProperties size={15} />
            {open ? "Close Bulk Listing" : `Open Bulk ${typeLabel}`}
          </button>
        </div>
      </div>

      {open ? (
        <div className="p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["01", "Fill Excel", "Keep template headers unchanged"],
              ["02", "Select images", "Filenames must match workbook cells"],
              ["03", "Validate & submit", "Only ready rows enter governance"],
            ].map(([step, title, helper]) => (
              <div key={step} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-800">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-black text-stone-900">{title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-stone-500">
                      {helper}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="focus-ring flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-white p-5 text-center hover:border-blue-500">
              <FileSpreadsheet size={24} className="text-blue-700" />
              <span className="mt-3 text-sm font-black text-blue-950">
                {workbookFile ? workbookFile.name : "Choose completed Excel workbook"}
              </span>
              <span className="mt-1 text-xs font-semibold text-stone-500">
                .xlsx template or exported .csv
              </span>
              <input
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  chooseWorkbook(file);
                }}
              />
            </label>

            <label className="focus-ring flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-5 text-center hover:border-violet-500">
              <Images size={24} className="text-violet-700" />
              <span className="mt-3 text-sm font-black text-violet-950">
                Select all product images
              </span>
              <span className="mt-1 text-xs font-semibold text-stone-500">
                JPG, PNG or WEBP · {imageFiles.length} selected
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  chooseImages(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {reading ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-blue-800">
              <LoaderCircle size={17} className="animate-spin" />
              Reading workbook…
            </div>
          ) : rows.length ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-2xl font-black text-stone-950">{rows.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-500">Rows found</p>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-4">
                  <p className="text-2xl font-black text-emerald-900">{readyRows.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">Ready to submit</p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-4">
                  <p className="text-2xl font-black text-amber-900">{issueRows.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-amber-700">Needs fixing</p>
                </div>
                <div className="rounded-2xl bg-violet-100 p-4">
                  <p className="text-2xl font-black text-violet-900">{imageFiles.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-violet-700">Images selected</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-white">
                <div className="max-h-[360px] overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-950 text-white">
                      <tr>
                        <th className="px-3 py-3 font-black">Row</th>
                        <th className="px-3 py-3 font-black">SKU</th>
                        <th className="px-3 py-3 font-black">Product</th>
                        <th className="px-3 py-3 font-black">Price</th>
                        <th className="px-3 py-3 font-black">Stock</th>
                        <th className="px-3 py-3 font-black">Status</th>
                        <th className="px-3 py-3 font-black">Issue / warning</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluatedRows.slice(0, 500).map((item) => (
                        <tr key={`${item.row.__rowNumber}-${item.row.merchantSku}`} className="border-t border-stone-100 align-top">
                          <td className="px-3 py-3 font-bold text-stone-500">{item.row.__rowNumber}</td>
                          <td className="px-3 py-3 font-black text-stone-800">{cleanBulkValue(item.row.merchantSku) || "—"}</td>
                          <td className="px-3 py-3 font-semibold text-stone-700">{cleanBulkValue(item.row.productName) || "—"}</td>
                          <td className="px-3 py-3 font-semibold text-stone-700">₹{cleanBulkValue(item.row.salePriceRupees) || cleanBulkValue(item.row.listPriceRupees) || "—"}</td>
                          <td className="px-3 py-3 font-semibold text-stone-700">{cleanBulkValue(item.row.availableQuantity) || "0"}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.issues.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                              {item.issues.length ? "Needs fix" : "Ready"}
                            </span>
                          </td>
                          <td className="max-w-md px-3 py-3 text-[11px] font-semibold leading-5 text-stone-600">
                            {item.issues.length
                              ? item.issues.join(" · ")
                              : item.warnings.length
                                ? item.warnings.join(" · ")
                                : "Ready for governed review."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black">
                    Submit {readyRows.length} ready row(s) as one governed batch
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-300">
                    {issueRows.length} issue row(s) stay out of the batch until you fix and re-upload them.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting || !readyRows.length || Boolean(batchResult)}
                  onClick={submitBulkBatch}
                  className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${
                    batchResult
                      ? "cursor-not-allowed bg-slate-700 text-slate-400 opacity-70"
                      : "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                >
                  {submitting ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : batchResult ? (
                    <BadgeCheck size={17} />
                  ) : (
                    <Upload size={17} />
                  )}
                  {submitting
                    ? uploadProgress?.label || "Submitting bulk batch…"
                    : batchResult
                      ? "Batch submitted"
                      : "Submit ready rows"}
                </button>
              </div>

              {batchResult ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                  Batch submitted · {batchResult.submittedRowCount} rows · {batchResult.reviewReadyCount} review-ready · {batchResult.duplicateCount} possible duplicate(s)
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 text-xs font-semibold leading-5 text-stone-600">
              Download the template, complete the Products sheet, then upload it here. The existing single-product form below remains unchanged and can still be used anytime.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function labelize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClasses(status) {
  switch (status) {
    case "approved_for_catalog":
      return "bg-emerald-100 text-emerald-800";

    case "ready_for_review":
      return "bg-blue-100 text-blue-800";

    case "needs_more_evidence":
      return "bg-amber-100 text-amber-800";

    case "rejected":
      return "bg-red-100 text-red-700";

    default:
      return "bg-stone-100 text-stone-600";
  }
}

function fieldValue(item) {
  const value = item?.value;

  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    if (value.rawText) {
      return value.rawText;
    }

    if (value.statement) {
      return value.statement;
    }
  }

  return JSON.stringify(value);
}

export default function HostNpiPage() {
  const [authorities, setAuthorities] = useState([]);

  const [drafts, setDrafts] = useState([]);

  const [pagination, setPagination] = useState(null);

  const [status, setStatus] = useState("");

  const [listingType, setListingType] = useState("packaged");

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [privacyHolds, setPrivacyHolds] = useState([]);

  const [privacyPendingAssets, setPrivacyPendingAssets] = useState([]);

  const [success, setSuccess] = useState("");

  const [authorityGrantId, setAuthorityGrantId] = useState("");

  const [market, setMarket] = useState("IN");

  const [hints, setHints] = useState({
    title: "",

    brandName: "",

    barcode: "",

    netQuantityText: "",
  });

  const [purpose, setPurpose] = useState("front_pack");

  const [evidenceFiles, setEvidenceFiles] = useState([]);

  const [manualDetails, setManualDetails] = useState(EMPTY_MANUAL_DETAILS);

  const [submitting, setSubmitting] = useState(false);

  const [progress, setProgress] = useState(null);

  const [selectedDraft, setSelectedDraft] = useState(null);

  const [loadingDraft, setLoadingDraft] = useState(false);

  const [resumingDraftId, setResumingDraftId] = useState("");

  const [additionalPurpose, setAdditionalPurpose] = useState("back_pack");

  const [additionalEvidenceFiles, setAdditionalEvidenceFiles] = useState([]);

  const [addingEvidenceDraftId, setAddingEvidenceDraftId] = useState("");

  const [additionalProgress, setAdditionalProgress] = useState(null);

  const selectedAuthority = useMemo(
    () => authorities.find((item) => item.id === authorityGrantId) || null,
    [authorities, authorityGrantId]
  );

  const loadData = useCallback(
    async (background = false) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const [authorityResult, draftResult] = await Promise.all([
          listHostBrandAuthorities({
            status: "active",
          }),

          listHostNpiDrafts({
            page: 1,

            limit: 50,

            status: status || undefined,
          }),
        ]);

        setAuthorities(
          (authorityResult?.authorities || []).filter(
            (item) => item.status === "active"
          )
        );

        setDrafts(draftResult?.drafts || []);

        setPagination(draftResult?.pagination || null);
      } catch (requestError) {
        setError(
          getUniversalProductErrorMessage(
            requestError,
            "Unable to load Host NPI workspace."
          )
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [status]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  function addFiles(event) {
    setPrivacyPendingAssets([]);
    setPrivacyHolds([]);

    const files = Array.from(event.target.files || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    event.target.value = "";

    setEvidenceFiles((current) =>
      [
        ...current,

        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random()}`,

          purpose,

          file,
        })),
      ].slice(0, 8)
    );
  }

  async function submitNpi(event) {
    event.preventDefault();

    if (!evidenceFiles.length) {
      setError(
        "Add at least one package image before starting NPI extraction."
      );

      return;
    }

    setSubmitting(true);

    setError("");
    setPrivacyHolds([]);
    setSuccess("");

    setProgress({
      completed: 0,

      total: evidenceFiles.length,
    });

    let assets = privacyPendingAssets;

    try {
      if (!assets.length) {
        assets = await uploadProductEvidenceBatch({
          evidenceFiles,

          scope: "host",

          onProgress: setProgress,
        });
      }

      const result = await createHostNpiFromImages({
        assets,

        market,

        hints,

        hostDeclarations: buildHostDeclarations(manualDetails),

        brandId: selectedAuthority?.brandId || undefined,

        authorityGrantId: selectedAuthority?.id || undefined,
      });

      setSuccess(
        result?.resolution?.draft?.status === "ready_for_review"
          ? "NPI draft created and sent to the governed review queue."
          : "NPI evidence saved. The draft needs more evidence or manual review."
      );

      setEvidenceFiles([]);
      setPrivacyPendingAssets([]);

      setHints({
        title: "",

        brandName: "",

        barcode: "",

        netQuantityText: "",
      });

      setManualDetails(EMPTY_MANUAL_DETAILS);

      await loadData(true);
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      setPrivacyHolds(holds);

      if (holds.length) {
        setPrivacyPendingAssets(assets);
        await loadData(true);
      }

      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to create the Host NPI draft."
        )
      );
    } finally {
      setSubmitting(false);

      setProgress(null);
    }
  }

  function addAdditionalFiles(event) {
    setPrivacyHolds([]);

    const files = Array.from(event.target.files || []).filter((file) =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
    );

    event.target.value = "";

    setAdditionalEvidenceFiles((current) =>
      [
        ...current,

        ...files.map((file) => ({
          id: `${Date.now()}-${Math.random()}`,

          purpose:
            selectedDraft?.draft?.listingType === "packaged"
              ? additionalPurpose
              : "front_pack",

          file,
        })),
      ].slice(0, 8)
    );
  }

  async function submitAdditionalEvidence(draft) {
    if (!draft?.id || !additionalEvidenceFiles.length) {
      return;
    }

    setAddingEvidenceDraftId(draft.id);
    setError("");
    setPrivacyHolds([]);
    setSuccess("");
    setAdditionalProgress({
      completed: 0,
      total: additionalEvidenceFiles.length,
    });

    try {
      const assets = await uploadProductEvidenceBatch({
        evidenceFiles: additionalEvidenceFiles,
        scope: "host",
        onProgress: setAdditionalProgress,
      });

      const result = await createHostNpiFromImages({
        draftId: draft.id,
        assets,
        market: draft.market || "IN",
        hints: {},
      });

      setAdditionalEvidenceFiles([]);

      const isProduceDraft = draft.listingType && draft.listingType !== "packaged";

      setSuccess(
        result?.resolution?.draft?.status === "ready_for_review"
          ? isProduceDraft
            ? "Additional product photo attached and the produce draft is ready for governed review."
            : "Additional package evidence attached and the NPI draft is ready for governed review."
          : isProduceDraft
            ? "Additional product photo attached. Review the updated produce draft status."
            : "Additional package evidence attached. Review the updated NPI draft status."
      );

      await loadData(true);
      await openDraft(draft.id);
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      setPrivacyHolds(holds);

      if (holds.length) {
        setAdditionalEvidenceFiles([]);
        await loadData(true);
        await openDraft(draft.id);
      }

      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to attach additional evidence to this NPI draft."
        )
      );
    } finally {
      setAddingEvidenceDraftId("");
      setAdditionalProgress(null);
    }
  }

  async function openDraft(draftId) {
    setLoadingDraft(true);

    setError("");

    try {
      const result = await getHostNpiDraft(draftId);

      setSelectedDraft(result);
    } catch (requestError) {
      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to load the Host NPI draft."
        )
      );
    } finally {
      setLoadingDraft(false);
    }
  }

  async function resumeDraftExtraction(draft) {
    if (!draft?.id) {
      return;
    }

    setResumingDraftId(draft.id);
    setError("");
    setPrivacyHolds([]);
    setSuccess("");

    try {
      const result = await createHostNpiFromImages({
        draftId: draft.id,
        assets: [],
        market: draft.market || "IN",
        hints: {},
      });

      setSuccess(
        result?.resolution?.draft?.status === "ready_for_review"
          ? "Privacy-cleared evidence resumed successfully and the NPI draft is ready for governed review."
          : "Privacy-cleared evidence resumed. Review the updated NPI draft status."
      );

      await loadData(true);
      await openDraft(draft.id);
    } catch (requestError) {
      const holds = extractMediaPrivacyHolds(requestError);

      setPrivacyHolds(holds);

      setError(
        getUniversalProductErrorMessage(
          requestError,
          "Unable to resume NPI extraction from the stored evidence."
        )
      );
    } finally {
      setResumingDraftId("");
    }
  }

  return (
    <div className="p-5 sm:p-7 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
            S03 · AI-assisted onboarding
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight text-stone-950">
            Product NPI
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {listingType === "packaged" ? (
              <>
                Submit package evidence for AI-assisted extraction. The result
                remains provisional until M03-authorized human review; this screen
                never publishes a canonical Product Version.
              </>
            ) : (
              <>
                Submit a fresh product photo, quantity and declared nutrition. The
                draft follows the same Super Admin verification and governed catalog
                publication flow.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => loadData(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-black text-stone-600 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {LISTING_TYPES.map(([value, label, description]) => {
          const selected = listingType === value;
          const TypeIcon =
            value === "packaged" ? Package : value === "vegetable" ? Leaf : Apple;

          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setListingType(value);
                setError("");
                setSuccess("");
                setPrivacyHolds([]);
              }}
              className={[
                "focus-ring flex min-h-24 items-center gap-4 rounded-[22px] border p-4 text-left transition",
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                  : "border-stone-200 bg-white text-stone-800 hover:border-emerald-300 hover:bg-emerald-50/40",
              ].join(" ")}
            >
              <span
                className={[
                  "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
                  selected ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                <TypeIcon size={22} />
              </span>
              <span>
                <span className="block text-sm font-black">{label}</span>
                <span
                  className={[
                    "mt-1 block text-xs font-semibold",
                    selected ? "text-emerald-50" : "text-stone-500",
                  ].join(" ")}
                >
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" />

        <p className="text-xs font-semibold leading-5">
          Privileged Host NPI is authorized by backend Host capability + active
          Host status + MFA. Brand-linked submissions additionally require an
          active BrandAuthorityGrant for the Host organization and market.
          activeMode is never authority.
        </p>
      </div>

      <BulkNpiPanel
        key={listingType}
        listingType={listingType}
        onSubmitted={() => loadData(true)}
        setPageError={setError}
        setPageSuccess={setSuccess}
        setPagePrivacyHolds={setPrivacyHolds}
      />

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">
          <CircleAlert size={19} className="mt-0.5 shrink-0" />

          {error}
        </div>
      ) : null}

      {privacyHolds.length ? (
        <div className="mt-5">
          <MediaPrivacyHoldPanel
            holds={privacyHolds}
            scope="host"
          />
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          <BadgeCheck size={19} className="mt-0.5 shrink-0" />

          {success}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {listingType === "packaged" ? (
        <form
          onSubmit={submitNpi}
          className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
              <Sparkles size={19} />
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                New draft
              </p>

              <h2 className="text-lg font-black text-stone-950">
                Create from package evidence + manual details
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-black text-stone-500">
                Verified Brand authority (optional)
              </span>

              <select
                value={authorityGrantId}
                onChange={(event) => setAuthorityGrantId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">
                  Unlinked / community-style provisional NPI
                </option>

                {authorities.map((authority) => (
                  <option key={authority.id} value={authority.id}>
                    {authority.brandId} · {authority.authorityType} ·{" "}
                    {(authority.marketCodes || []).join(", ")}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-xs font-black text-stone-500">
                  Market
                </span>

                <input
                  value={market}
                  onChange={(event) =>
                    setMarket(event.target.value.toUpperCase().slice(0, 10))
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label>
                <span className="text-xs font-black text-stone-500">
                  Barcode hint
                </span>

                <input
                  value={hints.barcode}
                  onChange={(event) =>
                    setHints((current) => ({
                      ...current,

                      barcode: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label>
                <span className="text-xs font-black text-stone-500">
                  Product name hint
                </span>

                <input
                  value={hints.title}
                  onChange={(event) =>
                    setHints((current) => ({
                      ...current,

                      title: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label>
                <span className="text-xs font-black text-stone-500">
                  Brand name hint
                </span>

                <input
                  value={hints.brandName}
                  onChange={(event) =>
                    setHints((current) => ({
                      ...current,

                      brandName: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-black text-stone-500">
                  Printed pack size hint
                </span>

                <input
                  value={hints.netQuantityText}
                  onChange={(event) =>
                    setHints((current) => ({
                      ...current,

                      netQuantityText: event.target.value,
                    }))
                  }
                  placeholder="Example: 1 kg"
                  className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="rounded-[22px] border border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    Manual product details · optional
                  </p>

                  <h3 className="mt-1 text-sm font-black text-stone-900">
                    Enter or correct label facts before creating NPI
                  </h3>

                  <p className="mt-1 max-w-2xl text-[11px] font-semibold leading-5 text-stone-500">
                    Manual values override AI extraction for this draft, are marked
                    as Host-declared, and still require Super Admin review before
                    canonical publication. Dietary declarations remain claims until
                    governed Food Intelligence evaluates them.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-xs font-black text-stone-500">
                    Ingredients declaration
                  </span>

                  <textarea
                    value={manualDetails.ingredientDeclarationText}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        ingredientDeclarationText: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={10000}
                    placeholder="Example: Tomato, jalapeño pepper, onion, garlic, lime juice, coriander, salt"
                    className="mt-2 w-full resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-stone-500">
                    Contains allergens
                  </span>

                  <input
                    value={manualDetails.containsAllergens}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        containsAllergens: event.target.value,
                      }))
                    }
                    placeholder="Example: Soy, Milk"
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-stone-500">
                    May contain allergens
                  </span>

                  <input
                    value={manualDetails.mayContainAllergens}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        mayContainAllergens: event.target.value,
                      }))
                    }
                    placeholder="Comma separated, if printed"
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-xs font-black text-stone-500">
                    Printed allergen statement
                  </span>

                  <input
                    value={manualDetails.allergenStatement}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        allergenStatement: event.target.value,
                      }))
                    }
                    placeholder="Example: Contains soy."
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-stone-500">
                    Country of origin
                  </span>

                  <input
                    value={manualDetails.countryOfOrigin}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        countryOfOrigin: event.target.value,
                      }))
                    }
                    placeholder="Example: Japan"
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                <label>
                  <span className="text-xs font-black text-stone-500">
                    Manufacturer / Packer
                  </span>

                  <input
                    value={manualDetails.manufacturerName}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        manufacturerName: event.target.value,
                      }))
                    }
                    placeholder="Printed manufacturer or packer name"
                    className="mt-2 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-stone-800">Nutrition</p>
                    <p className="mt-1 text-[10px] font-semibold text-stone-400">
                      Leave values blank when they are not declared on the pack.
                    </p>
                  </div>

                  <select
                    value={manualDetails.nutritionBasis}
                    onChange={(event) =>
                      setManualDetails((current) => ({
                        ...current,
                        nutritionBasis: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-black outline-none"
                  >
                    <option value="per_100g">Per 100 g</option>
                    <option value="per_100ml">Per 100 ml</option>
                    <option value="per_serving">Per serving</option>
                    <option value="per_pack">Per pack</option>
                  </select>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {MANUAL_NUTRIENTS.map(([key, label, unit]) => (
                    <label key={key}>
                      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                        {label} ({unit})
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={manualDetails.nutrients[key]}
                        onChange={(event) =>
                          setManualDetails((current) => ({
                            ...current,
                            nutrients: {
                              ...current.nutrients,
                              [key]: event.target.value,
                            },
                          }))
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                      Serving size value (optional)
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={manualDetails.servingSizeValue}
                      onChange={(event) =>
                        setManualDetails((current) => ({
                          ...current,
                          servingSizeValue: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                      Serving size unit
                    </span>

                    <select
                      value={manualDetails.servingSizeUnit}
                      onChange={(event) =>
                        setManualDetails((current) => ({
                          ...current,
                          servingSizeUnit: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                      <option value="piece">piece</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-black text-stone-700">
                  Dietary declarations printed on pack
                </p>

                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    ["vegetarian", "Vegetarian"],
                    ["vegan", "Vegan"],
                    ["glutenFree", "Gluten Free"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-600"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(manualDetails.dietaryClaims[key])}
                        onChange={(event) =>
                          setManualDetails((current) => ({
                            ...current,
                            dietaryClaims: {
                              ...current.dietaryClaims,
                              [key]: event.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 accent-emerald-700"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] font-semibold leading-5 text-stone-500">
              Add at least one pack image for visual/audit evidence. AI may extract
              from it, but any manual details entered above take precedence in the
              provisional draft and remain subject to Super Admin approval.
            </p>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
              >
                {PURPOSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <label className="focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-950 px-4 py-3 text-sm font-black text-white hover:bg-stone-800">
                <Upload size={16} />
                Add image
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={addFiles}
                  className="sr-only"
                />
              </label>
            </div>

            {evidenceFiles.length ? (
              <div className="space-y-2">
                {evidenceFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3"
                  >
                    <ImagePlus size={16} className="text-emerald-700" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-stone-800">
                        {item.file.name}
                      </p>

                      <p className="text-[11px] font-semibold text-stone-500">
                        {labelize(item.purpose)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPrivacyPendingAssets([]);
                        setPrivacyHolds([]);

                        setEvidenceFiles((current) =>
                          current.filter(
                            (candidate) => candidate.id !== item.id
                          )
                        );
                      }}
                      className="focus-ring grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-white hover:text-red-600"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting || !evidenceFiles.length}
            className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}

            {submitting
              ? progress
                ? `Uploading ${progress.completed}/${progress.total} and extracting…`
                : "Extracting…"
              : "Create provisional NPI draft"}
          </button>
        </form>
        ) : (
          <ProduceNpiForm
            key={listingType}
            listingType={listingType}
            market={market}
            setMarket={setMarket}
            onCreated={() => loadData(true)}
            setPageError={setError}
            setPageSuccess={setSuccess}
            setPagePrivacyHolds={setPrivacyHolds}
          />
        )}

        <section className="rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-400">
                Organization-scoped drafts
              </p>

              <h2 className="mt-1 text-lg font-black text-stone-950">
                NPI history
              </h2>
            </div>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold outline-none"
            >
              {STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? labelize(value) : "All statuses"}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center">
              <LoaderCircle
                size={26}
                className="animate-spin text-emerald-700"
              />
            </div>
          ) : drafts.length ? (
            <div className="mt-5 space-y-3">
              {drafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => openDraft(draft.id)}
                  className="focus-ring block w-full rounded-2xl border border-stone-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-stone-900">
                        {fieldValue(draft.candidateFields?.displayName) === "—"
                          ? draft.barcode || "Provisional product"
                          : fieldValue(draft.candidateFields?.displayName)}
                      </p>

                      <p className="mt-1 text-xs font-semibold text-stone-500">
                        {draft.barcode
                          ? `GTIN ${draft.barcode}`
                          : "No barcode extracted"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${statusClasses(
                        draft.status
                      )}`}
                    >
                      {labelize(draft.status)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-stone-500">
                    <span>
                      {draft.brandAuthorityVerified
                        ? "Brand authority verified"
                        : "No canonical brand authority linked"}
                    </span>

                    <span>·</span>

                    <span>
                      {draft.readyForCatalog
                        ? "Ready for M04 handoff"
                        : "Canonical publish not performed"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-stone-50 p-6 text-center">
              <FileSearch size={28} className="mx-auto text-stone-300" />

              <p className="mt-3 text-sm font-black text-stone-700">
                No NPI drafts in this filter
              </p>
            </div>
          )}

          {pagination ? (
            <p className="mt-4 text-right text-[11px] font-semibold text-stone-400">
              {pagination.total || drafts.length} total drafts
            </p>
          ) : null}
        </section>
      </div>

      {selectedDraft ? (
        <section className="mt-6 rounded-[26px] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">
                Draft detail
              </p>

              <h2 className="mt-1 text-xl font-black text-stone-950">
                {fieldValue(selectedDraft.draft?.candidateFields?.displayName)}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {["provisional", "needs_more_evidence"].includes(
                selectedDraft.draft?.status
              ) && selectedDraft.evidence?.length ? (
                <button
                  type="button"
                  disabled={
                    resumingDraftId === selectedDraft.draft?.id ||
                    loadingDraft
                  }
                  onClick={() =>
                    resumeDraftExtraction(selectedDraft.draft)
                  }
                  className="focus-ring inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-black text-emerald-800 disabled:opacity-50"
                >
                  <RefreshCw
                    size={15}
                    className={
                      resumingDraftId === selectedDraft.draft?.id
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Resume cleared evidence
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setSelectedDraft(null)}
                className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-500"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {loadingDraft ? (
            <LoaderCircle
              size={24}
              className="mt-5 animate-spin text-emerald-700"
            />
          ) : (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(selectedDraft.draft?.candidateFields || {}).map(
                  ([key, item]) => (
                    <div
                      key={key}
                      className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                    >
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                        {labelize(key)}
                      </p>

                      <p className="mt-2 break-words text-xs font-bold leading-5 text-stone-800">
                        {fieldValue(item)}
                      </p>

                      <p className="mt-2 text-[10px] font-bold text-amber-700">
                        {Number.isFinite(Number(item?.confidence))
                          ? `${Math.round(
                              Number(item.confidence) * 100
                            )}% provisional confidence`
                          : "Confidence unknown"}
                      </p>
                    </div>
                  )
                )}
              </div>

              {selectedDraft.draft?.status === "needs_more_evidence" ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                        Additional evidence requested
                      </p>

                      <p className="mt-1 max-w-2xl text-xs font-semibold leading-5 text-stone-600">
                        {selectedDraft.draft?.listingType === "packaged" ? (
                          <>
                            Attach another package panel to this existing draft. The
                            backend keeps the same draft identity and re-runs privacy
                            clearance and provisional extraction; no second draft is
                            created.
                          </>
                        ) : (
                          <>
                            Attach another clear product photo to this existing produce
                            draft. The same draft identity is kept and it returns to the
                            governed review queue after privacy clearance.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
                    {selectedDraft.draft?.listingType === "packaged" ? (
                      <select
                        value={additionalPurpose}
                        onChange={(event) =>
                          setAdditionalPurpose(event.target.value)
                        }
                        className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                      >
                        {PURPOSES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs font-black text-stone-700">
                        Product photo
                      </div>
                    )}

                    <label className="focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-2.5 text-xs font-black text-white hover:bg-stone-800">
                      <Upload size={15} />
                      Add evidence to this draft
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        onChange={addAdditionalFiles}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {additionalEvidenceFiles.length ? (
                    <div className="mt-3 space-y-2">
                      {additionalEvidenceFiles.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl bg-white p-3"
                        >
                          <ImagePlus size={15} className="text-emerald-700" />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-stone-800">
                              {item.file.name}
                            </p>
                            <p className="text-[11px] font-semibold text-stone-500">
                              {labelize(item.purpose)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setAdditionalEvidenceFiles((current) =>
                                current.filter(
                                  (candidate) => candidate.id !== item.id
                                )
                              )
                            }
                            className="focus-ring grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-50 hover:text-red-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      addingEvidenceDraftId === selectedDraft.draft?.id ||
                      !additionalEvidenceFiles.length
                    }
                    onClick={() =>
                      submitAdditionalEvidence(selectedDraft.draft)
                    }
                    className="focus-ring mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingEvidenceDraftId === selectedDraft.draft?.id ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Upload size={15} />
                    )}
                    {addingEvidenceDraftId === selectedDraft.draft?.id
                      ? additionalProgress
                        ? `Uploading ${additionalProgress.completed}/${additionalProgress.total} and rechecking…`
                        : "Attaching evidence…"
                      : selectedDraft.draft?.listingType === "packaged"
                        ? "Attach evidence and re-run extraction"
                        : "Attach photo and return to review"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
