export const CATALOG_ENTITY_STATUSES = Object.freeze([
  "active",
  "disabled",
  "retired",
]);

export const CATALOG_PUBLICATION_STATUSES = Object.freeze([
  "draft",
  "in_review",
  "published",
  "retired",
]);

export const CATALOG_EVIDENCE_STATES = Object.freeze([
  "verified_source",
  "operator_declared",
  "calculated",
  "inferred",
  "unknown_review_required",
]);

export const CATALOG_EVIDENCE_SOURCE_TYPES = Object.freeze([
  "brand_label",
  "manufacturer",
  "regulator",
  "admin_entry",
  "import",
  "external_database",
  "retailer_observation",
  "ai_extraction",
]);

export const CATALOG_EXTRACTION_METHODS = Object.freeze([
  "manual",
  "structured_import",
  "label_extraction",
  "ai_assisted",
  "external_api",
]);

export const PRODUCT_QUANTITY_UNITS = Object.freeze([
  "g",
  "kg",
  "ml",
  "l",
  "piece",
  "dozen",
]);

export const PRODUCT_PACK_TYPES = Object.freeze([
  "bottle",
  "box",
  "can",
  "carton",
  "jar",
  "packet",
  "pouch",
  "sachet",
  "tray",
  "tub",
  "wrapper",
  "other",
]);

export const PRODUCT_ALLERGEN_RELATION_TYPES = Object.freeze([
  "contains",
  "may_contain",
  "unknown",
]);

export const NUTRITION_BASIS_TYPES = Object.freeze([
  "per_100g",
  "per_100ml",
  "per_serving",
  "per_pack",
]);

export const CATALOG_ENTITY_TYPES = Object.freeze([
  "brand",
  "category",
  "product_family",
  "product_variant",
  "pack",
  "product_version",
  "ingredient",
]);

export function normalizeCatalogSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeCatalogKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}