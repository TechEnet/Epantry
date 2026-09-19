import assert from "node:assert/strict";
import test from "node:test";

import fs from "node:fs";

import {
  createCanonicalIngredientSchema,
  createEvidenceSourceSchema,
  publishProductVersionSchema,
  updateProductDraftFactsSchema,
} from "../src/modules/catalog/catalog.governance.validation.js";

import {
  buildProductPublicationAssessment,
} from "../src/modules/catalog/catalog.governance.service.js";

/*
|--------------------------------------------------------------------------
| Ingredient Dictionary
|--------------------------------------------------------------------------
*/

test("M04 Ingredient Dictionary accepts canonical Ingredient input", () => {
  const result =
    createCanonicalIngredientSchema.safeParse({
      canonicalName:
        "Peanut",

      aliases: [
        "Groundnut",
      ],
    });

  assert.equal(
    result.success,
    true,
  );
});

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

test("M04 Evidence Source requires a governed catalog entity", () => {
  const result =
    createEvidenceSourceSchema.safeParse({
      entityType:
        "product_version",

      entityId:
        "64b000000000000000000001",

      sourceType:
        "brand_label",

      sourceName:
        "Package label",
    });

  assert.equal(
    result.success,
    true,
  );
});

test("M04 Evidence Source rejects legacy commercial entity types", () => {
  const result =
    createEvidenceSourceSchema.safeParse({
      entityType:
        "seller_offer",

      entityId:
        "64b000000000000000000001",

      sourceType:
        "admin_entry",

      sourceName:
        "Invalid source",
    });

  assert.equal(
    result.success,
    false,
  );
});

/*
|--------------------------------------------------------------------------
| Governed Product Facts
|--------------------------------------------------------------------------
*/

test("M04 governed Product facts reject commercial price fields", () => {
  const result =
    updateProductDraftFactsSchema.safeParse({
      ingredientDeclarationText:
        "Peanuts, salt",

      price:
        250,
    });

  assert.equal(
    result.success,
    false,
  );
});

test("M04 governed Product facts support explicitly unknown allergen state", () => {
  const result =
    updateProductDraftFactsSchema.safeParse({
      allergens: [
        {
          allergenKey:
            "milk",

          relationType:
            "unknown",

          evidenceState:
            "unknown_review_required",
        },
      ],
    });

  assert.equal(
    result.success,
    true,
  );
});

/*
|--------------------------------------------------------------------------
| Publication Governance
|--------------------------------------------------------------------------
*/

test("M04 publication blocks a draft that has not entered review", () => {
  const assessment =
    buildProductPublicationAssessment({
      version: {
        publicationStatus:
          "draft",

        displayName:
          "Example",

        netQuantity: {
          value:
            500,

          unit:
            "g",
        },
      },

      evidenceSources: [
        {
          id:
            "64b000000000000000000010",
        },
      ],
    });

  assert.equal(
    assessment.ready,
    false,
  );

  assert.ok(
    assessment.blockers.some(
      (blocker) =>
        blocker.code ===
        "VERSION_NOT_IN_REVIEW",
    ),
  );
});

test("M04 publication requires Evidence Source provenance", () => {
  const assessment =
    buildProductPublicationAssessment({
      version: {
        publicationStatus:
          "in_review",

        displayName:
          "Example",

        netQuantity: {
          value:
            500,

          unit:
            "g",
        },

        claims:
          [],

        certifications:
          [],

        provenance:
          [],
      },

      evidenceSources:
        [],
    });

  assert.equal(
    assessment.ready,
    false,
  );

  assert.ok(
    assessment.blockers.some(
      (blocker) =>
        blocker.code ===
        "EVIDENCE_REQUIRED",
    ),
  );
});

test("M04 publication blocks an unverified consumer-facing claim", () => {
  const assessment =
    buildProductPublicationAssessment({
      version: {
        publicationStatus:
          "in_review",

        displayName:
          "Example",

        netQuantity: {
          value:
            500,

          unit:
            "g",
        },

        claims: [
          {
            key:
              "high_protein",

            label:
              "High Protein",

            evidenceState:
              "unknown_review_required",
          },
        ],

        certifications:
          [],

        provenance:
          [],
      },

      evidenceSources: [
        {
          id:
            "64b000000000000000000010",
        },
      ],
    });

  assert.equal(
    assessment.ready,
    false,
  );

  assert.ok(
    assessment.blockers.some(
      (blocker) =>
        blocker.code ===
        "CLAIM_EVIDENCE_REQUIRED",
    ),
  );
});

test("M04 reviewed Product Version with evidence may publish", () => {
  const evidenceId =
    "64b000000000000000000010";

  const assessment =
    buildProductPublicationAssessment({
      version: {
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

        claims: [
          {
            key:
              "vegan",

            label:
              "Vegan",

            evidenceState:
              "verified_source",
          },
        ],

        certifications:
          [],

        provenance: [
          {
            fieldPath:
              "claims.vegan",

            evidenceSourceId:
              evidenceId,

            evidenceState:
              "verified_source",
          },
        ],
      },

      evidenceSources: [
        {
          id:
            evidenceId,
        },
      ],
    });

  assert.equal(
    assessment.ready,
    true,
  );

  assert.deepEqual(
    assessment.blockers,
    [],
  );
});

test("M04 publish contract requires an explicit audit reason code", () => {
  const result =
    publishProductVersionSchema.safeParse({
      reasonCode:
        "",
    });

  assert.equal(
    result.success,
    false,
  );
});

/*
|--------------------------------------------------------------------------
| Admin Route Security
|--------------------------------------------------------------------------
*/

test("M04 Catalog admin routes use backend permissions and MFA", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../src/modules/admin/admin.routes.js",
        import.meta.url,
      ),
      "utf8",
    );

  assert.match(
    source,
    /catalog\.read/,
  );

  assert.match(
    source,
    /catalog\.mutate/,
  );

  assert.match(
    source,
    /catalog\.publish/,
  );

  assert.match(
    source,
    /requireMfaAssurance/,
  );

  assert.match(
    source,
    /requireRecentMfaAuthentication/,
  );

  assert.match(
    source,
    /requireCsrfToken/,
  );
});

test("M04 Catalog admin exposes Ingredient Evidence and Publish routes", () => {
  const source =
    fs.readFileSync(
      new URL(
        "../src/modules/admin/admin.routes.js",
        import.meta.url,
      ),
      "utf8",
    );

  assert.match(
    source,
    /\/catalog\/ingredients/,
  );

  assert.match(
    source,
    /\/catalog\/evidence/,
  );

  assert.match(
    source,
    /\/catalog\/product-versions\/:id\/publish/,
  );

  assert.match(
    source,
    /\/catalog\/product-versions\/:id\/retire/,
  );
});