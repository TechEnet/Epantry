import assert from "node:assert/strict";
import test from "node:test";

import {
  createCatalogBrandSchema,
  createNextProductVersionSchema,
  createProductDraftSchema,
  updateProductDraftSchema,
} from "../src/modules/catalog/catalog.admin.validation.js";

import {
  assertDraftVersionEditable,
  assertVersionCanEnterReview,
  buildNextVersionDocument,
  serializeCatalogProductVersion,
} from "../src/modules/catalog/catalog.admin.service.js";

/*
|--------------------------------------------------------------------------
| Admin Input Contract
|--------------------------------------------------------------------------
*/

test("M04 catalog admin accepts valid Brand creation input", () => {
  const result =
    createCatalogBrandSchema.safeParse({
      name:
        "Example Brand",

      description:
        "Example description",
    });

  assert.equal(
    result.success,
    true,
  );
});

test("M04 Product draft rejects commercial price and stock state", () => {
  const result =
    createProductDraftSchema.safeParse({
      packId:
        "64b000000000000000000001",

      displayName:
        "Example Product 500g",

      netQuantity: {
        value:
          500,

        unit:
          "g",
      },

      price:
        199,

      stock:
        12,
    });

  assert.equal(
    result.success,
    false,
  );
});

test("M04 Product draft rejects seller and Host authority fields", () => {
  const result =
    createProductDraftSchema.safeParse({
      packId:
        "64b000000000000000000001",

      displayName:
        "Example Product",

      netQuantity: {
        value:
          1,

        unit:
          "kg",
      },

      sellerId:
        "64b000000000000000000002",

      hostId:
        "64b000000000000000000003",
    });

  assert.equal(
    result.success,
    false,
  );
});

test("M04 draft update requires an actual canonical change", () => {
  const result =
    updateProductDraftSchema.safeParse(
      {},
    );

  assert.equal(
    result.success,
    false,
  );
});

/*
|--------------------------------------------------------------------------
| Version State
|--------------------------------------------------------------------------
*/

test("M04 draft Product Version is editable", () => {
  assert.doesNotThrow(
    () =>
      assertDraftVersionEditable({
        publicationStatus:
          "draft",
      }),
  );
});

test("M04 published Product Version cannot be destructively edited", () => {
  assert.throws(
    () =>
      assertDraftVersionEditable({
        publicationStatus:
          "published",
      }),
    (
      error,
    ) =>
      error?.statusCode ===
        409 ||
      error?.status ===
        409,
  );
});

test("M04 complete draft may enter review", () => {
  assert.doesNotThrow(
    () =>
      assertVersionCanEnterReview({
        publicationStatus:
          "draft",

        displayName:
          "Example Product",

        netQuantity: {
          value:
            500,

          unit:
            "g",
        },
      }),
  );
});

test("M04 non-draft Product Version cannot enter review again", () => {
  assert.throws(
    () =>
      assertVersionCanEnterReview({
        publicationStatus:
          "in_review",

        displayName:
          "Example Product",

        netQuantity: {
          value:
            500,

          unit:
            "g",
        },
      }),
  );
});

/*
|--------------------------------------------------------------------------
| Next Version
|--------------------------------------------------------------------------
*/

test("M04 next Product Version resets publication lifecycle", () => {
  const sourceVersion = {
    _id:
      "64b000000000000000000009",

    variantId:
      "64b000000000000000000001",

    packId:
      "64b000000000000000000002",

    version:
      3,

    displayName:
      "Example Product",

    gtin:
      "1234567890123",

    netQuantity: {
      value:
        500,

      unit:
        "g",
    },

    publicationStatus:
      "published",

    publishedAt:
      new Date(),

    publishedByUserId:
      "64b000000000000000000005",

    ingredients:
      [],

    allergens:
      [],

    claims:
      [],

    certifications:
      [],

    images:
      [],

    provenance:
      [],
  };

  const next =
    buildNextVersionDocument({
      sourceVersion,

      nextVersion:
        4,

      actorUserId:
        "64b000000000000000000006",

      changeReason:
        "Updated package label",
    });

  assert.equal(
    next.version,
    4,
  );

  assert.equal(
    next.publicationStatus,
    "draft",
  );

  assert.equal(
    next.publishedAt,
    null,
  );

  assert.equal(
    next.publishedByUserId,
    null,
  );

  assert.equal(
    String(
      next.supersedesVersionId,
    ),
    sourceVersion._id,
  );

  assert.equal(
    next.changeReason,
    "Updated package label",
  );
});

test("M04 new version requires an explicit change reason contract", () => {
  const result =
    createNextProductVersionSchema.safeParse({
      changeReason:
        "",
    });

  assert.equal(
    result.success,
    false,
  );
});

/*
|--------------------------------------------------------------------------
| Serialization
|--------------------------------------------------------------------------
*/

test("M04 Product Version serializer removes mongoose internals", () => {
  const serialized =
    serializeCatalogProductVersion({
      _id:
        "64b000000000000000000009",

      variantId:
        "64b000000000000000000001",

      packId:
        "64b000000000000000000002",

      version:
        1,

      displayName:
        "Example Product",

      publicationStatus:
        "draft",

      __v:
        7,
    });

  assert.equal(
    serialized.id,
    "64b000000000000000000009",
  );

  assert.equal(
    serialized._id,
    undefined,
  );

  assert.equal(
    serialized.__v,
    undefined,
  );
});