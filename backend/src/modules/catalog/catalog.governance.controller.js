import {
  ApiError,
} from "../../utils/ApiError.js";

import {
  ApiResponse,
} from "../../utils/ApiResponse.js";

import {
  normalizeAdminAuditReason,
  recordAdminAuditEvent,
} from "../admin/adminAudit.service.js";

import {
  ProductVersion,
} from "./catalog.models.js";

import {
  catalogIdParamsSchema,
} from "./catalog.admin.validation.js";

import {
  createCanonicalIngredientSchema,
  createEvidenceSourceSchema,
  listCanonicalIngredientsQuerySchema,
  listEvidenceSourcesQuerySchema,
  publishProductVersionSchema,
  retireProductVersionSchema,
  updateCanonicalIngredientSchema,
  updateProductDraftFactsSchema,
} from "./catalog.governance.validation.js";

import {
  findProductVersionDuplicateCandidates,
  mergeDuplicateProductVersion,
} from "./catalog.duplicate.service.js";

import {
  createCanonicalIngredient,
  createEvidenceSource,
  listCanonicalIngredients,
  listEvidenceSources,
  publishProductVersion,
  retireProductVersion,
  updateCanonicalIngredient,
  updateProductDraftFacts,
} from "./catalog.governance.service.js";

function parseOrThrow(
  schema,
  value,
  code,
  message,
) {
  const result =
    schema.safeParse(
      value,
    );

  if (
    !result.success
  ) {
    throw new ApiError(
      400,
      result.error
        .issues[0]
        ?.message ||
        message,
      [
        {
          code,
        },
      ],
    );
  }

  return result.data;
}

function sendSuccess(
  req,
  res,
  status,
  data,
  message,
) {
  return res
    .status(status)
    .json(
      new ApiResponse(
        status,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    );
}

function wrap(
  handler,
) {
  return async function wrappedController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      );
    } catch (error) {
      return next(
        error,
      );
    }
  };
}

/*
|--------------------------------------------------------------------------
| Governed Fact Audit Helpers
|--------------------------------------------------------------------------
*/

const SAFETY_GOVERNED_FACT_FIELDS =
  Object.freeze([
    "ingredientDeclarationText",
    "ingredients",
    "nutrition",
    "allergens",
    "claims",
    "certifications",
    "images",
    "provenance",
  ]);

function pickGovernedFactSnapshot(
  source,
  fieldPaths,
) {
  const snapshot =
    {};

  for (
    const fieldPath of
    fieldPaths
  ) {
    snapshot[fieldPath] =
      source?.[fieldPath] ??
      null;
  }

  return snapshot;
}

/*
|--------------------------------------------------------------------------
| Ingredients
|--------------------------------------------------------------------------
*/

export const listCanonicalIngredientsController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listCanonicalIngredientsQuerySchema,
          req.query,
          "CATALOG_INGREDIENT_QUERY_INVALID",
          "Invalid Ingredient query.",
        );

      const result =
        await listCanonicalIngredients(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Canonical Ingredients loaded",
      );
    },
  );

export const createCanonicalIngredientController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCanonicalIngredientSchema,
          req.body,
          "CATALOG_INGREDIENT_INPUT_INVALID",
          "Invalid Ingredient input.",
        );

      const ingredient =
        await createCanonicalIngredient(
          input,
          req.currentUser,
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          ingredient,
        },
        "Canonical Ingredient created",
      );
    },
  );

export const updateCanonicalIngredientController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_INGREDIENT_ID_INVALID",
          "Invalid Ingredient ID.",
        );

      const input =
        parseOrThrow(
          updateCanonicalIngredientSchema,
          req.body,
          "CATALOG_INGREDIENT_INPUT_INVALID",
          "Invalid Ingredient input.",
        );

      const ingredient =
        await updateCanonicalIngredient(
          id,
          input,
          req.currentUser,
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          ingredient,
        },
        "Canonical Ingredient updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

export const listEvidenceSourcesController =
  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listEvidenceSourcesQuerySchema,
          req.query,
          "CATALOG_EVIDENCE_QUERY_INVALID",
          "Invalid Evidence query.",
        );

      const result =
        await listEvidenceSources(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Evidence Sources loaded",
      );
    },
  );

export const createEvidenceSourceController =
  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createEvidenceSourceSchema,
          req.body,
          "CATALOG_EVIDENCE_INPUT_INVALID",
          "Invalid Evidence Source input.",
        );

      const evidenceSource =
        await createEvidenceSource(
          input,
          req.currentUser,
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          evidenceSource,
        },
        "Evidence Source created",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Governed Product Facts
|--------------------------------------------------------------------------
|
| Field-level audit records only the governed fields changed by this request.
|
| The controlled reason is validated BEFORE ProductVersion mutation so an
| invalid reason cannot mutate canonical safety data first and fail later.
|
*/

export const updateProductDraftFactsController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const input =
        parseOrThrow(
          updateProductDraftFactsSchema,
          req.body,
          "CATALOG_FACTS_INPUT_INVALID",
          "Invalid governed Product facts.",
        );

      const {
        reasonCode,
        reasonDetails,
        ...facts
      } =
        input;

      normalizeAdminAuditReason({
        action:
          "catalog.mutate",

        reasonCode,

        reasonDetails,
      });

      const changedFieldPaths =
        SAFETY_GOVERNED_FACT_FIELDS.filter(
          (fieldPath) =>
            facts[fieldPath] !==
            undefined,
        );

      const beforeVersion =
        await ProductVersion.findById(
          id,
        ).lean();

      const beforeSnapshot =
        pickGovernedFactSnapshot(
          beforeVersion,
          changedFieldPaths,
        );

      const productVersion =
        await updateProductDraftFacts(
          id,
          facts,
        );

      const afterSnapshot =
        pickGovernedFactSnapshot(
          productVersion,
          changedFieldPaths,
        );

      await recordAdminAuditEvent({
        actorUser:
          req.currentUser,

        adminAuthorization:
          req.adminAuthorization,

        action:
          "catalog.mutate",

        permissionKey:
          "catalog.mutate",

        entityType:
          "product_version",

        entityId:
          String(
            id,
          ),

        reasonCode,

        reasonDetails,

        beforeSnapshot,

        afterSnapshot,

        metadata: {
          operation:
            "update_governed_facts",

          fieldPaths:
            changedFieldPaths,

          safetyFieldAudit:
            true,
        },

        requestId:
          req.requestId,
      });

      return sendSuccess(
        req,
        res,
        200,
        {
          productVersion,

          auditedFields:
            changedFieldPaths,
        },
        "Governed Product facts updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
|
| Exact GTIN duplicates across different Packs must be resolved before
| publication.
|
*/

export const publishProductVersionController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const input =
        parseOrThrow(
          publishProductVersionSchema,
          req.body,
          "CATALOG_PUBLISH_INPUT_INVALID",
          "Publication reason is required.",
        );

      const duplicateAssessment =
        await findProductVersionDuplicateCandidates(
          id,
        );

      if (
        duplicateAssessment
          .candidates
          .length >
        0
      ) {
        throw new ApiError(
          409,
          "Potential duplicate Product Versions must be resolved before publication.",
          [
            {
              code:
                "CATALOG_DUPLICATE_REVIEW_REQUIRED",

              matchType:
                duplicateAssessment.matchType,

              candidates:
                duplicateAssessment.candidates,
            },
          ],
        );
      }

      const result =
        await publishProductVersion({
          versionId:
            id,

          ...input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        });

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Product Version published",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Retire / Duplicate Merge
|--------------------------------------------------------------------------
*/

export const retireProductVersionController =
  wrap(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const input =
        parseOrThrow(
          retireProductVersionSchema,
          req.body,
          "CATALOG_RETIRE_INPUT_INVALID",
          "Retirement reason is required.",
        );

      const {
        mergeTargetVersionId,
        ...reasonInput
      } =
        input;

      /*
      |--------------------------------------------------------------------------
      | Duplicate Merge
      |--------------------------------------------------------------------------
      */

      if (
        mergeTargetVersionId
      ) {
        const result =
          await mergeDuplicateProductVersion({
            sourceVersionId:
              id,

            targetVersionId:
              mergeTargetVersionId,

            ...reasonInput,

            actorUser:
              req.currentUser,

            adminAuthorization:
              req.adminAuthorization,

            requestId:
              req.requestId,
          });

        return sendSuccess(
          req,
          res,
          200,
          {
            productVersion:
              result.sourceProductVersion,

            targetProductVersion:
              result.targetProductVersion,

            mergeDecision:
              result.mergeDecision,

            idempotent:
              result.idempotent,
          },
          "Duplicate Product Version merged and retired",
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Normal Retirement
      |--------------------------------------------------------------------------
      */

      const productVersion =
        await retireProductVersion({
          versionId:
            id,

          ...reasonInput,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        });

      return sendSuccess(
        req,
        res,
        200,
        {
          productVersion,
        },
        "Product Version retired",
      );
    },
  );