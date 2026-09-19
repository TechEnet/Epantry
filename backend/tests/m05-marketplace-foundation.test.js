import assert from "node:assert/strict";

import test from "node:test";

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  MarketplaceOrganization,
  PriceRule,
  ServiceArea,
} from "../src/modules/marketplace/marketplace.models.js";

import {
  MARKETPLACE_OFFER_STATUSES,
  MARKETPLACE_ORGANIZATION_STATUSES,
  normalizeCurrencyCode,
  normalizeMarketplaceKey,
  normalizePostalCode,
} from "../src/modules/marketplace/marketplace.constants.js";

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

test(
  "M05 Marketplace exposes safe Organization lifecycle states",
  () => {
    assert.deepEqual(
      MARKETPLACE_ORGANIZATION_STATUSES,
      [
        "pending",
        "active",
        "suspended",
        "disabled",
      ],
    );
  },
);

test(
  "M05 Host Offer exposes commercial lifecycle without legacy application roles",
  () => {
    assert.deepEqual(
      MARKETPLACE_OFFER_STATUSES,
      [
        "draft",
        "active",
        "paused",
        "retired",
      ],
    );
  },
);

test(
  "M05 Marketplace key normalization is deterministic",
  () => {
    assert.equal(
      normalizeMarketplaceKey(
        "  Alok's Premium Store  ",
      ),
      "alok-s-premium-store",
    );
  },
);

test(
  "M05 postal code normalization never guesses location",
  () => {
    assert.equal(
      normalizePostalCode(
        " 273 001 ",
      ),
      "273001",
    );

    assert.equal(
      normalizePostalCode(
        "",
      ),
      "",
    );
  },
);

test(
  "M05 currency normalization uses uppercase currency codes",
  () => {
    assert.equal(
      normalizeCurrencyCode(
        "inr",
      ),
      "INR",
    );
  },
);

/*
|--------------------------------------------------------------------------
| Collections
|--------------------------------------------------------------------------
*/

test(
  "M05 registers required commercial MongoDB collections",
  () => {
    assert.equal(
      MarketplaceOrganization
        .collection
        .name,
      "organizations",
    );

    assert.equal(
      HostOffer
        .collection
        .name,
      "sellerOffers",
    );

    assert.equal(
      PriceRule
        .collection
        .name,
      "priceRules",
    );

    assert.equal(
      InventoryNode
        .collection
        .name,
      "inventoryNodes",
    );

    assert.equal(
      InventorySnapshot
        .collection
        .name,
      "inventorySnapshots",
    );

    assert.equal(
      ServiceArea
        .collection
        .name,
      "serviceAreas",
    );
  },
);

/*
|--------------------------------------------------------------------------
| Host Offer Boundary
|--------------------------------------------------------------------------
*/

test(
  "M05 Host Offer links commercial state to canonical Pack",
  () => {
    const paths =
      HostOffer.schema.paths;

    assert.ok(
      paths.organizationId,
    );

    assert.ok(
      paths.packId,
    );

    assert.ok(
      paths.merchantSku,
    );

    assert.ok(
      paths.status,
    );
  },
);

test(
  "M05 Host Offer does not duplicate canonical Product facts",
  () => {
    const paths =
      HostOffer.schema.paths;

    assert.equal(
      Boolean(
        paths.ingredients,
      ),
      false,
    );

    assert.equal(
      Boolean(
        paths.allergens,
      ),
      false,
    );

    assert.equal(
      Boolean(
        paths.nutrition,
      ),
      false,
    );

    assert.equal(
      Boolean(
        paths.manufacturerName,
      ),
      false,
    );

    assert.equal(
      Boolean(
        paths.productName,
      ),
      false,
    );
  },
);

test(
  "M05 Host Offer prevents duplicate Pack listing inside one Organization",
  () => {
    const indexes =
      HostOffer.schema.indexes();

    assert.ok(
      indexes.some(
        ([
          fields,
          options,
        ]) =>
          fields.organizationId ===
            1 &&
          fields.packId ===
            1 &&
          options.unique ===
            true,
      ),
    );
  },
);

/*
|--------------------------------------------------------------------------
| Price
|--------------------------------------------------------------------------
*/

test(
  "M05 PriceRule stores money in integer minor units",
  async () => {
    const price =
      new PriceRule({
        organizationId:
          "507f1f77bcf86cd799439011",

        offerId:
          "507f1f77bcf86cd799439012",

        listPrice: {
          amountMinor:
            9999.5,

          currency:
            "INR",
        },

        effectiveFrom:
          new Date(),
      });

    const validationError =
      price.validateSync();

    assert.ok(
      validationError,
    );

    assert.match(
      validationError.message,
      /minor currency units/i,
    );
  },
);

test(
  "M05 PriceRule rejects sale price above list price",
  () => {
    const price =
      new PriceRule({
        organizationId:
          "507f1f77bcf86cd799439011",

        offerId:
          "507f1f77bcf86cd799439012",

        listPrice: {
          amountMinor:
            10000,

          currency:
            "INR",
        },

        salePrice: {
          amountMinor:
            12000,

          currency:
            "INR",
        },

        effectiveFrom:
          new Date(),
      });

    const validationError =
      price.validateSync();

    assert.ok(
      validationError,
    );

    assert.match(
      validationError.message,
      /Sale price cannot exceed list price/i,
    );
  },
);

/*
|--------------------------------------------------------------------------
| Inventory
|--------------------------------------------------------------------------
*/

test(
  "M05 inventory snapshot refuses reserved quantity above available quantity",
  () => {
    const snapshot =
      new InventorySnapshot({
        organizationId:
          "507f1f77bcf86cd799439011",

        offerId:
          "507f1f77bcf86cd799439012",

        inventoryNodeId:
          "507f1f77bcf86cd799439013",

        availableQuantity:
          5,

        reservedQuantity:
          6,

        sourceType:
          "manual",
      });

    const validationError =
      snapshot.validateSync();

    assert.ok(
      validationError,
    );

    assert.match(
      validationError.message,
      /Reserved quantity cannot exceed available quantity/i,
    );
  },
);

test(
  "M05 inventory snapshot includes freshness timestamp and source",
  () => {
    const paths =
      InventorySnapshot
        .schema
        .paths;

    assert.ok(
      paths.observedAt,
    );

    assert.ok(
      paths.sourceType,
    );

    assert.ok(
      paths.sourceReference,
    );
  },
);

/*
|--------------------------------------------------------------------------
| Serviceability
|--------------------------------------------------------------------------
*/

test(
  "M05 ServiceArea stores explicit postal codes instead of inferred serviceability",
  () => {
    const paths =
      ServiceArea.schema.paths;

    assert.ok(
      paths.postalCodes,
    );

    assert.ok(
      paths.organizationId,
    );

    assert.ok(
      paths.inventoryNodeId,
    );

    assert.equal(
      Boolean(
        paths.inferredPostalCodes,
      ),
      false,
    );
  },
);