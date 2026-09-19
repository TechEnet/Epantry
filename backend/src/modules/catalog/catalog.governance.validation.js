import { z } from "zod";

import {
  CATALOG_ENTITY_STATUSES,
  CATALOG_ENTITY_TYPES,
  CATALOG_EVIDENCE_SOURCE_TYPES,
  CATALOG_EVIDENCE_STATES,
  CATALOG_EXTRACTION_METHODS,
  NUTRITION_BASIS_TYPES,
  PRODUCT_ALLERGEN_RELATION_TYPES,
  PRODUCT_QUANTITY_UNITS,
} from "./catalog.constants.js";

import {
  catalogObjectIdSchema,
} from "./catalog.admin.validation.js";

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .or(z.literal(""))
  .optional();

const quantitySchema = z
  .object({
    value: z
      .number()
      .finite()
      .positive(),

    unit: z.enum(
      PRODUCT_QUANTITY_UNITS,
    ),
  })
  .strict();

const productIngredientSchema = z
  .object({
    ingredientId: catalogObjectIdSchema
      .nullable()
      .optional()
      .default(null),

    displayName: z
      .string()
      .trim()
      .min(1)
      .max(200),

    order: z
      .number()
      .int()
      .min(0),

    percentage: z
      .number()
      .min(0)
      .max(100)
      .nullable()
      .optional()
      .default(null),

    notes: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default(""),
  })
  .strict();

const nutritionEntrySchema = z
  .object({
    nutrientKey: z
      .string()
      .trim()
      .min(1)
      .max(100),

    amount: z
      .number()
      .finite()
      .min(0),

    unit: z
      .string()
      .trim()
      .min(1)
      .max(30),
  })
  .strict();

const nutritionSchema = z
  .object({
    basis: z
      .enum(
        NUTRITION_BASIS_TYPES,
      )
      .nullable()
      .optional()
      .default(null),

    servingSize: quantitySchema
      .nullable()
      .optional()
      .default(null),

    nutrients: z
      .array(
        nutritionEntrySchema,
      )
      .max(100)
      .optional()
      .default([]),
  })
  .strict();

const allergenSchema = z
  .object({
    allergenKey: z
      .string()
      .trim()
      .min(1)
      .max(100),

    relationType: z.enum(
      PRODUCT_ALLERGEN_RELATION_TYPES,
    ),

    evidenceState: z
      .enum(
        CATALOG_EVIDENCE_STATES,
      )
      .optional()
      .default(
        "unknown_review_required",
      ),
  })
  .strict();

const claimSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(120),

    label: z
      .string()
      .trim()
      .min(1)
      .max(200),

    evidenceState: z
      .enum(
        CATALOG_EVIDENCE_STATES,
      )
      .optional()
      .default(
        "unknown_review_required",
      ),
  })
  .strict();

const certificationSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(120),

    label: z
      .string()
      .trim()
      .min(1)
      .max(200),

    certificateReference: z
      .string()
      .trim()
      .max(300)
      .optional()
      .default(""),

    evidenceState: z
      .enum(
        CATALOG_EVIDENCE_STATES,
      )
      .optional()
      .default(
        "unknown_review_required",
      ),
  })
  .strict();

const imageSchema = z
  .object({
    url: z
      .string()
      .trim()
      .url()
      .max(2000),

    alt: z
      .string()
      .trim()
      .max(250)
      .optional()
      .default(""),

    evidenceSourceId: catalogObjectIdSchema
      .nullable()
      .optional()
      .default(null),

    sortOrder: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0),
  })
  .strict();

const provenanceSchema = z
  .object({
    fieldPath: z
      .string()
      .trim()
      .min(1)
      .max(300),

    evidenceSourceId:
      catalogObjectIdSchema
        .nullable()
        .optional()
        .default(null),

    evidenceState: z
      .enum(
        CATALOG_EVIDENCE_STATES,
      )
      .optional()
      .default(
        "unknown_review_required",
      ),

    extractionMethod: z
      .enum(
        CATALOG_EXTRACTION_METHODS,
      )
      .optional()
      .default("manual"),

    confidence: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .optional()
      .default(null),
  })
  .strict();

const catalogGovernanceReasonCodeSchema =
  z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .default(
      "catalog.governance",
    );

const catalogGovernanceReasonDetailsSchema =
  z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default("");

/*
|--------------------------------------------------------------------------
| Ingredient Dictionary
|--------------------------------------------------------------------------
*/

export const createCanonicalIngredientSchema = z
  .object({
    canonicalName: z
      .string()
      .trim()
      .min(1)
      .max(220),

    slug: z
      .string()
      .trim()
      .max(250)
      .optional(),

    aliases: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(220),
      )
      .max(100)
      .optional()
      .default([]),

    parentId:
      catalogObjectIdSchema
        .nullable()
        .optional()
        .default(null),

    attributes: z
      .any()
      .optional()
      .default({}),

    status: z
      .enum(
        CATALOG_ENTITY_STATUSES,
      )
      .optional()
      .default("active"),
  })
  .strict();

export const updateCanonicalIngredientSchema =
  createCanonicalIngredientSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      {
        message:
          "At least one Ingredient field is required.",
      },
    );

export const listCanonicalIngredientsQuerySchema =
  z
    .object({
      page: z.coerce
        .number()
        .int()
        .min(1)
        .optional()
        .default(1),

      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(25),

      search: z
        .string()
        .trim()
        .max(150)
        .optional()
        .default(""),

      status: z
        .enum([
          "all",
          ...CATALOG_ENTITY_STATUSES,
        ])
        .optional()
        .default("active"),
    })
    .strict();

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

export const createEvidenceSourceSchema = z
  .object({
    entityType: z.enum(
      CATALOG_ENTITY_TYPES,
    ),

    entityId:
      catalogObjectIdSchema,

    sourceType: z.enum(
      CATALOG_EVIDENCE_SOURCE_TYPES,
    ),

    sourceName: z
      .string()
      .trim()
      .min(1)
      .max(250),

    sourceUri:
      optionalUrlSchema,

    externalReference: z
      .string()
      .trim()
      .max(500)
      .optional()
      .default(""),

    checksum: z
      .string()
      .trim()
      .max(256)
      .optional()
      .default(""),

    evidenceState: z
      .enum(
        CATALOG_EVIDENCE_STATES,
      )
      .optional()
      .default(
        "unknown_review_required",
      ),

    capturedAt: z
      .string()
      .trim()
      .refine(
        (value) =>
          !Number.isNaN(
            Date.parse(value),
          ),
        {
          message:
            "capturedAt must be a valid date.",
        },
      )
      .optional(),

    metadata: z
      .any()
      .optional()
      .default({}),
  })
  .strict();

export const listEvidenceSourcesQuerySchema =
  z
    .object({
      entityType: z.enum(
        CATALOG_ENTITY_TYPES,
      ),

      entityId:
        catalogObjectIdSchema,

      page: z.coerce
        .number()
        .int()
        .min(1)
        .optional()
        .default(1),

      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(50),
    })
    .strict();

/*
|--------------------------------------------------------------------------
| Governed Product Facts
|--------------------------------------------------------------------------
|
| A controlled reason is attached automatically so safety-sensitive field
| changes can always produce an immutable admin audit event.
|
*/

export const updateProductDraftFactsSchema = z
  .object({
    ingredientDeclarationText: z
      .string()
      .trim()
      .max(10000)
      .optional(),

    ingredients: z
      .array(
        productIngredientSchema,
      )
      .max(300)
      .optional(),

    nutrition:
      nutritionSchema.optional(),

    allergens: z
      .array(
        allergenSchema,
      )
      .max(100)
      .optional(),

    claims: z
      .array(
        claimSchema,
      )
      .max(100)
      .optional(),

    certifications: z
      .array(
        certificationSchema,
      )
      .max(100)
      .optional(),

    images: z
      .array(
        imageSchema,
      )
      .max(30)
      .optional(),

    provenance: z
      .array(
        provenanceSchema,
      )
      .max(500)
      .optional(),

    reasonCode:
      catalogGovernanceReasonCodeSchema,

    reasonDetails:
      catalogGovernanceReasonDetailsSchema,
  })
  .strict()
  .refine(
    (value) =>
      [
        "ingredientDeclarationText",
        "ingredients",
        "nutrition",
        "allergens",
        "claims",
        "certifications",
        "images",
        "provenance",
      ].some(
        (field) =>
          value[field] !==
          undefined,
      ),
    {
      message:
        "At least one governed Product fact is required.",
    },
  );

/*
|--------------------------------------------------------------------------
| Publish Governance
|--------------------------------------------------------------------------
*/

export const publishProductVersionSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(1)
      .max(120),

    reasonDetails: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default(""),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Retire / Duplicate Merge
|--------------------------------------------------------------------------
|
| mergeTargetVersionId is optional.
|
| Without it:
|   normal retirement.
|
| With it:
|   non-destructive duplicate merge + source retirement.
|
*/

export const retireProductVersionSchema = z
  .object({
    reasonCode: z
      .string()
      .trim()
      .min(1)
      .max(120),

    reasonDetails: z
      .string()
      .trim()
      .min(3)
      .max(2000),

    mergeTargetVersionId:
      catalogObjectIdSchema
        .optional(),
  })
  .strict();