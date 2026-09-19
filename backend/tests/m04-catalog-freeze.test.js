import assert from "node:assert/strict";

import fs from "node:fs";

import test from "node:test";

import {
  CatalogMergeDecision,
} from "../src/modules/catalog/catalog.duplicate.models.js";

import {
  buildDuplicateMergeAssessment,
} from "../src/modules/catalog/catalog.duplicate.service.js";

import {
  retireProductVersionSchema,
  updateProductDraftFactsSchema,
} from "../src/modules/catalog/catalog.governance.validation.js";

/*
|--------------------------------------------------------------------------
| Safety Fact Audit Contract
|--------------------------------------------------------------------------
*/

test(
  "M04 governed fact mutation automatically receives controlled Catalog governance reason",
  () => {
    const result =
      updateProductDraftFactsSchema.parse({
        allergens: [
          {
            allergenKey:
              "peanut",

            relationType:
              "unknown",
          },
        ],
      });

    assert.equal(
      result.reasonCode,
      "catalog.governance",
    );

    assert.equal(
      result.reasonDetails,
      "",
    );
  },
);

test(
  "M04 governed fact mutation rejects an audit-reason-only request",
  () => {
    const result =
      updateProductDraftFactsSchema.safeParse({
        reasonCode:
          "catalog.governance",
      });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  "M04 governed fact schema still rejects commercial Product state",
  () => {
    const result =
      updateProductDraftFactsSchema.safeParse({
        allergens:
          [],

        price:
          100,

        stock:
          5,
      });

    assert.equal(
      result.success,
      false,
    );
  },
);

/*
|--------------------------------------------------------------------------
| Duplicate Merge Validation
|--------------------------------------------------------------------------
*/

test(
  "M04 exact GTIN on different Packs is eligible for duplicate merge review",
  () => {
    const assessment =
      buildDuplicateMergeAssessment({
        source: {
          _id:
            "source-version",

          packId:
            "pack-a",

          gtin:
            "1234567890123",

          publicationStatus:
            "published",
        },

        target: {
          _id:
            "target-version",

          packId:
            "pack-b",

          gtin:
            "1234567890123",

          publicationStatus:
            "published",
        },
      });

    assert.equal(
      assessment.ready,
      true,
    );

    assert.equal(
      assessment.matchType,
      "gtin_exact",
    );

    assert.deepEqual(
      assessment.blockers,
      [],
    );
  },
);

test(
  "M04 versions from the same Pack are version history and cannot be duplicate merged",
  () => {
    const assessment =
      buildDuplicateMergeAssessment({
        source: {
          _id:
            "source-version",

          packId:
            "same-pack",

          gtin:
            "1234567890123",

          publicationStatus:
            "in_review",
        },

        target: {
          _id:
            "target-version",

          packId:
            "same-pack",

          gtin:
            "1234567890123",

          publicationStatus:
            "published",
        },
      });

    assert.equal(
      assessment.ready,
      false,
    );

    assert.ok(
      assessment.blockers.some(
        (blocker) =>
          blocker.code ===
          "CATALOG_DUPLICATE_SAME_PACK_HISTORY",
      ),
    );
  },
);

test(
  "M04 duplicate merge refuses mismatched GTIN identities",
  () => {
    const assessment =
      buildDuplicateMergeAssessment({
        source: {
          _id:
            "source-version",

          packId:
            "pack-a",

          gtin:
            "1234567890123",

          publicationStatus:
            "in_review",
        },

        target: {
          _id:
            "target-version",

          packId:
            "pack-b",

          gtin:
            "9999999999999",

          publicationStatus:
            "published",
        },
      });

    assert.equal(
      assessment.ready,
      false,
    );

    assert.ok(
      assessment.blockers.some(
        (blocker) =>
          blocker.code ===
          "CATALOG_DUPLICATE_GTIN_MISMATCH",
      ),
    );
  },
);

test(
  "M04 duplicate merge refuses to guess identity when GTIN is unavailable",
  () => {
    const assessment =
      buildDuplicateMergeAssessment({
        source: {
          _id:
            "source-version",

          packId:
            "pack-a",

          gtin:
            null,

          publicationStatus:
            "in_review",
        },

        target: {
          _id:
            "target-version",

          packId:
            "pack-b",

          gtin:
            null,

          publicationStatus:
            "published",
        },
      });

    assert.equal(
      assessment.ready,
      false,
    );

    assert.ok(
      assessment.blockers.some(
        (blocker) =>
          blocker.code ===
          "CATALOG_DUPLICATE_GTIN_REQUIRED",
      ),
    );
  },
);

/*
|--------------------------------------------------------------------------
| Merge Decision Persistence Contract
|--------------------------------------------------------------------------
*/

test(
  "M04 Catalog merge decision uses a dedicated immutable collection with unique source",
  () => {
    assert.equal(
      CatalogMergeDecision.collection.name,
      "catalogMergeDecisions",
    );

    const indexes =
      CatalogMergeDecision.schema.indexes();

    assert.ok(
      indexes.some(
        ([
          fields,
          options,
        ]) =>
          fields.sourceVersionId ===
            1 &&
          options.unique ===
            true,
      ),
    );
  },
);

test(
  "M04 retire governance accepts an optional canonical merge target",
  () => {
    const result =
      retireProductVersionSchema.safeParse({
        reasonCode:
          "catalog.governance",

        reasonDetails:
          "Exact GTIN duplicate confirmed by Catalog Admin.",

        mergeTargetVersionId:
          "507f1f77bcf86cd799439011",
      });

    assert.equal(
      result.success,
      true,
    );

    assert.equal(
      result.data.mergeTargetVersionId,
      "507f1f77bcf86cd799439011",
    );
  },
);

/*
|--------------------------------------------------------------------------
| Source Contracts
|--------------------------------------------------------------------------
*/

test(
  "M04 Catalog freeze enforces field-level safety audit and duplicate review before publish",
  () => {
    const controllerSource =
      fs.readFileSync(
        new URL(
          "../src/modules/catalog/catalog.governance.controller.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      controllerSource,
      /action:\s*"catalog\.mutate"/,
    );

    assert.match(
      controllerSource,
      /fieldPaths:\s*changedFieldPaths/,
    );

    assert.match(
      controllerSource,
      /safetyFieldAudit:\s*true/,
    );

    assert.match(
      controllerSource,
      /findProductVersionDuplicateCandidates/,
    );

    assert.match(
      controllerSource,
      /CATALOG_DUPLICATE_REVIEW_REQUIRED/,
    );

    const duplicateCheckPosition =
      controllerSource.indexOf(
        "findProductVersionDuplicateCandidates",
        controllerSource.indexOf(
          "publishProductVersionController",
        ),
      );

    const publishPosition =
      controllerSource.indexOf(
        "await publishProductVersion",
        controllerSource.indexOf(
          "publishProductVersionController",
        ),
      );

    assert.ok(
      duplicateCheckPosition !==
        -1 &&
      publishPosition !==
        -1 &&
      duplicateCheckPosition <
        publishPosition,
    );
  },
);

test(
  "M04 duplicate merge keeps source history and transactionally retires rather than deletes it",
  () => {
    const serviceSource =
      fs.readFileSync(
        new URL(
          "../src/modules/catalog/catalog.duplicate.service.js",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      serviceSource,
      /withTransaction/,
    );

    assert.match(
      serviceSource,
      /publicationStatus:\s*"retired"/,
    );

    assert.match(
      serviceSource,
      /CatalogMergeDecision\.create/,
    );

    assert.doesNotMatch(
      serviceSource,
      /ProductVersion\.delete/,
    );

    assert.doesNotMatch(
      serviceSource,
      /ProductVersion\.findByIdAndDelete/,
    );
  },
);