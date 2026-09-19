import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_EVIDENCE_STATES,
  CATALOG_PUBLICATION_STATUSES,
  normalizeCatalogSlug,
} from "../src/modules/catalog/catalog.constants.js";

import {
  Brand,
  CanonicalIngredient,
  Category,
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from "../src/modules/catalog/catalog.models.js";

test("M04 catalog constants expose safe publication states", () => {
  assert.deepEqual(
    CATALOG_PUBLICATION_STATUSES,
    [
      "draft",
      "in_review",
      "published",
      "retired",
    ],
  );

  assert.ok(
    CATALOG_EVIDENCE_STATES.includes(
      "unknown_review_required",
    ),
  );
});

test("M04 catalog slug normalization is deterministic", () => {
  assert.equal(
    normalizeCatalogSlug(
      "  Organic Peanut Butter  ",
    ),
    "organic-peanut-butter",
  );

  assert.equal(
    normalizeCatalogSlug(
      "Milk & Chocolate",
    ),
    "milk-chocolate",
  );
});

test("M04 registers canonical MongoDB collections", () => {
  assert.equal(
    Brand.collection.collectionName,
    "brands",
  );

  assert.equal(
    Category.collection.collectionName,
    "categories",
  );

  assert.equal(
    ProductFamily.collection.collectionName,
    "productFamilies",
  );

  assert.equal(
    ProductVariant.collection.collectionName,
    "productVariants",
  );

  assert.equal(
    Pack.collection.collectionName,
    "packs",
  );

  assert.equal(
    ProductVersion.collection.collectionName,
    "productVersions",
  );

  assert.equal(
    CanonicalIngredient.collection.collectionName,
    "ingredients",
  );

  assert.equal(
    EvidenceSource.collection.collectionName,
    "evidenceSources",
  );
});

test("M04 ProductVersion contains versioned canonical fact fields", () => {
  const paths =
    ProductVersion.schema.paths;

  assert.ok(paths.variantId);
  assert.ok(paths.packId);
  assert.ok(paths.version);
  assert.ok(paths.gtin);
  assert.ok(paths.netQuantity);
  assert.ok(paths.ingredients);
  assert.ok(paths.nutrition);
  assert.ok(paths.allergens);
  assert.ok(paths.provenance);
  assert.ok(paths.publicationStatus);
  assert.ok(paths.effectiveFrom);
  assert.ok(paths.effectiveTo);
  assert.ok(paths.supersedesVersionId);
  assert.ok(paths.changeReason);
});

test("M04 canonical ProductVersion does not contain seller commercial state", () => {
  const paths =
    ProductVersion.schema.paths;

  const forbiddenFields = [
    "price",
    "salePrice",
    "offerPrice",
    "stock",
    "inventory",
    "sellerId",
    "hostId",
    "serviceability",
  ];

  for (const field of forbiddenFields) {
    assert.equal(
      paths[field],
      undefined,
      `${field} must not exist in canonical ProductVersion`,
    );
  }
});

test("M04 ProductVersion rejects malformed GTIN", () => {
  const document =
    new ProductVersion({
      variantId:
        "64b000000000000000000001",

      packId:
        "64b000000000000000000002",

      version:
        1,

      displayName:
        "Test Product",

      gtin:
        "ABC123",

      netQuantity: {
        value:
          500,

        unit:
          "g",
      },
    });

  const validationError =
    document.validateSync();

  assert.ok(
    validationError,
  );

  assert.ok(
    validationError.errors.gtin,
  );
});

test("M04 ProductVersion accepts unknown safety data without guessing", () => {
  const document =
    new ProductVersion({
      variantId:
        "64b000000000000000000001",

      packId:
        "64b000000000000000000002",

      version:
        1,

      displayName:
        "Test Product",

      netQuantity: {
        value:
          500,

        unit:
          "g",
      },

      allergens: [
        {
          allergenKey:
            "peanut",

          relationType:
            "unknown",

          evidenceState:
            "unknown_review_required",
        },
      ],
    });

  const validationError =
    document.validateSync();

  assert.equal(
    validationError,
    undefined,
  );
});

test("M04 hierarchy schemas contain duplicate-prevention indexes", () => {
  const familyIndexes =
    ProductFamily.schema.indexes();

  const variantIndexes =
    ProductVariant.schema.indexes();

  const packIndexes =
    Pack.schema.indexes();

  const versionIndexes =
    ProductVersion.schema.indexes();

  assert.ok(
    familyIndexes.some(
      ([fields, options]) =>
        fields.brandId === 1 &&
        fields.slug === 1 &&
        options.unique === true,
    ),
  );

  assert.ok(
    variantIndexes.some(
      ([fields, options]) =>
        fields.familyId === 1 &&
        fields.variantKey === 1 &&
        options.unique === true,
    ),
  );

  assert.ok(
    packIndexes.some(
      ([fields, options]) =>
        fields.variantId === 1 &&
        fields.packKey === 1 &&
        options.unique === true,
    ),
  );

  assert.ok(
    versionIndexes.some(
      ([fields, options]) =>
        fields.packId === 1 &&
        fields.version === 1 &&
        options.unique === true,
    ),
  );
});