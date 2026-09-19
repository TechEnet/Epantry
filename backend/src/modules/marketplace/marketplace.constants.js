/*
|--------------------------------------------------------------------------
| M05 Marketplace Constants
|--------------------------------------------------------------------------
|
| M04 defines canonical Product truth.
|
| M05 defines commercial truth:
|
| - which Host organization sells a Pack
| - price
| - inventory
| - serviceability
|
| Seller / Brand / B2B are NOT top-level access types.
| All of them are represented by the existing Host capability.
|--------------------------------------------------------------------------
*/

export const MARKETPLACE_ORGANIZATION_STATUSES =
  Object.freeze([
    "pending",
    "active",
    "suspended",
    "disabled",
  ]);

export const MARKETPLACE_ORGANIZATION_TYPES =
  Object.freeze([
    "seller",
    "brand",
    "b2b",
    "hybrid",
  ]);

export const MARKETPLACE_OFFER_STATUSES =
  Object.freeze([
    "draft",
    "active",
    "paused",
    "retired",
  ]);

export const MARKETPLACE_INVENTORY_NODE_TYPES =
  Object.freeze([
    "store",
    "warehouse",
    "dark_store",
    "distribution_center",
    "other",
  ]);

export const MARKETPLACE_INVENTORY_NODE_STATUSES =
  Object.freeze([
    "active",
    "disabled",
  ]);

export const MARKETPLACE_INVENTORY_SOURCE_TYPES =
  Object.freeze([
    "manual",
    "bulk_import",
    "erp",
    "pos",
    "warehouse_system",
    "external_api",
  ]);

export const MARKETPLACE_PRICE_RULE_STATUSES =
  Object.freeze([
    "scheduled",
    "active",
    "expired",
    "disabled",
  ]);

export const MARKETPLACE_SERVICE_AREA_STATUSES =
  Object.freeze([
    "active",
    "disabled",
  ]);

export const MARKETPLACE_FULFILLMENT_TYPES =
  Object.freeze([
    "delivery",
    "pickup",
  ]);

export const MARKETPLACE_CURRENCIES =
  Object.freeze([
    "INR",
  ]);

/*
|--------------------------------------------------------------------------
| Normalizers
|--------------------------------------------------------------------------
*/

export function normalizeMarketplaceKey(
  value,
) {
  return String(
    value ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    );
}

export function normalizeMarketplaceSlug(
  value,
) {
  return normalizeMarketplaceKey(
    value,
  );
}

export function normalizePostalCode(
  value,
) {
  return String(
    value ||
      "",
  )
    .trim()
    .replace(
      /\s+/g,
      "",
    );
}

export function normalizeCurrencyCode(
  value,
) {
  return String(
    value ||
      "",
  )
    .trim()
    .toUpperCase();
}