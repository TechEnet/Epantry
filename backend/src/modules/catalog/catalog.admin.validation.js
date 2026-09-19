import { z } from "zod";

import {
  CATALOG_ENTITY_STATUSES,
  CATALOG_PUBLICATION_STATUSES,
  PRODUCT_PACK_TYPES,
  PRODUCT_QUANTITY_UNITS,
} from "./catalog.constants.js";

export const catalogObjectIdSchema = z
  .string()
  .trim()
  .regex(
    /^[a-f\d]{24}$/i,
    "A valid MongoDB object ID is required.",
  );

const optionalNullableObjectIdSchema = z
  .union([
    catalogObjectIdSchema,
    z.null(),
  ])
  .optional();

const optionalStatusSchema = z
  .enum(CATALOG_ENTITY_STATUSES)
  .optional();

const paginationFields = {
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
};

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

const optionalUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .or(
    z.literal(""),
  )
  .optional();

/*
|--------------------------------------------------------------------------
| Brand
|--------------------------------------------------------------------------
*/

export const createCatalogBrandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(180),

    slug: z
      .string()
      .trim()
      .max(200)
      .optional(),

    aliases: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(180),
      )
      .max(100)
      .optional()
      .default([]),

    description: z
      .string()
      .trim()
      .max(3000)
      .optional()
      .default(""),

    websiteUrl:
      optionalUrlSchema,

    logoUrl:
      optionalUrlSchema,

    status:
      optionalStatusSchema,
  })
  .strict();

export const updateCatalogBrandSchema =
  createCatalogBrandSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one Brand field is required.",
      },
    );

export const listCatalogBrandsQuerySchema = z
  .object({
    ...paginationFields,

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
| Category
|--------------------------------------------------------------------------
*/

export const createCatalogCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(180),

    slug: z
      .string()
      .trim()
      .max(200)
      .optional(),

    parentId:
      optionalNullableObjectIdSchema,

    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default(""),

    sortOrder: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .optional()
      .default(0),

    status:
      optionalStatusSchema,
  })
  .strict();

export const updateCatalogCategorySchema =
  createCatalogCategorySchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one Category field is required.",
      },
    );

export const listCatalogCategoriesQuerySchema =
  z
    .object({
      ...paginationFields,

      status: z
        .enum([
          "all",
          ...CATALOG_ENTITY_STATUSES,
        ])
        .optional()
        .default("active"),

      parentId: z
        .union([
          catalogObjectIdSchema,
          z.literal("root"),
        ])
        .optional(),
    })
    .strict();

/*
|--------------------------------------------------------------------------
| Product Family
|--------------------------------------------------------------------------
*/

export const createProductFamilySchema = z
  .object({
    brandId:
      catalogObjectIdSchema,

    categoryId:
      catalogObjectIdSchema,

    canonicalName: z
      .string()
      .trim()
      .min(1)
      .max(250),

    slug: z
      .string()
      .trim()
      .max(280)
      .optional(),

    description: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .default(""),

    status:
      optionalStatusSchema,
  })
  .strict();

export const updateProductFamilySchema =
  createProductFamilySchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one Product Family field is required.",
      },
    );

export const listProductFamiliesQuerySchema = z
  .object({
    ...paginationFields,

    status: z
      .enum([
        "all",
        ...CATALOG_ENTITY_STATUSES,
      ])
      .optional()
      .default("active"),

    brandId:
      catalogObjectIdSchema
        .optional(),

    categoryId:
      catalogObjectIdSchema
        .optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Product Variant
|--------------------------------------------------------------------------
*/

export const createProductVariantSchema = z
  .object({
    familyId:
      catalogObjectIdSchema,

    canonicalName: z
      .string()
      .trim()
      .min(1)
      .max(300),

    variantKey: z
      .string()
      .trim()
      .max(200)
      .optional(),

    market: z
      .string()
      .trim()
      .min(2)
      .max(10)
      .optional()
      .default("IN"),

    flavor: z
      .string()
      .trim()
      .max(150)
      .optional()
      .default(""),

    formulationKey: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default(""),

    packForm: z
      .string()
      .trim()
      .max(120)
      .optional()
      .default(""),

    status:
      optionalStatusSchema,
  })
  .strict();

export const updateProductVariantSchema =
  createProductVariantSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one Product Variant field is required.",
      },
    );

export const listProductVariantsQuerySchema = z
  .object({
    ...paginationFields,

    status: z
      .enum([
        "all",
        ...CATALOG_ENTITY_STATUSES,
      ])
      .optional()
      .default("active"),

    familyId:
      catalogObjectIdSchema
        .optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Pack
|--------------------------------------------------------------------------
*/

export const createProductPackSchema = z
  .object({
    variantId:
      catalogObjectIdSchema,

    packKey: z
      .string()
      .trim()
      .max(200)
      .optional(),

    displayName: z
      .string()
      .trim()
      .min(1)
      .max(250),

    packType: z
      .enum(
        PRODUCT_PACK_TYPES,
      )
      .optional()
      .default("other"),

    multipackCount: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .optional()
      .default(1),

    status:
      optionalStatusSchema,
  })
  .strict();

export const updateProductPackSchema =
  createProductPackSchema
    .partial()
    .refine(
      (value) =>
        Object.keys(value).length > 0,
      {
        message:
          "At least one Pack field is required.",
      },
    );

export const listProductPacksQuerySchema = z
  .object({
    ...paginationFields,

    status: z
      .enum([
        "all",
        ...CATALOG_ENTITY_STATUSES,
      ])
      .optional()
      .default("active"),

    variantId:
      catalogObjectIdSchema
        .optional(),
  })
  .strict();

/*
|--------------------------------------------------------------------------
| Product Version
|--------------------------------------------------------------------------
|
| Commercial state is intentionally rejected by .strict().
|--------------------------------------------------------------------------
*/

export const createProductDraftSchema = z
  .object({
    packId:
      catalogObjectIdSchema,

    displayName: z
      .string()
      .trim()
      .min(1)
      .max(350),

    gtin: z
      .string()
      .trim()
      .regex(
        /^\d{8,14}$/,
        "GTIN must contain between 8 and 14 digits.",
      )
      .nullable()
      .optional()
      .default(null),

    netQuantity:
      quantitySchema,

    countryOfOrigin: z
      .string()
      .trim()
      .max(120)
      .optional()
      .default(""),

    manufacturerName: z
      .string()
      .trim()
      .max(250)
      .optional()
      .default(""),

    changeReason: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .default(""),
  })
  .strict();

export const updateProductDraftSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1)
      .max(350)
      .optional(),

    gtin: z
      .string()
      .trim()
      .regex(
        /^\d{8,14}$/,
        "GTIN must contain between 8 and 14 digits.",
      )
      .nullable()
      .optional(),

    netQuantity:
      quantitySchema
        .optional(),

    countryOfOrigin: z
      .string()
      .trim()
      .max(120)
      .optional(),

    manufacturerName: z
      .string()
      .trim()
      .max(250)
      .optional(),

    changeReason: z
      .string()
      .trim()
      .max(2000)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      Object.keys(value).length > 0,
    {
      message:
        "At least one Product Version field is required.",
    },
  );

export const createNextProductVersionSchema = z
  .object({
    changeReason: z
      .string()
      .trim()
      .min(3)
      .max(2000),
  })
  .strict();

export const listProductVersionsQuerySchema = z
  .object({
    ...paginationFields,

    publicationStatus: z
      .enum([
        "all",
        ...CATALOG_PUBLICATION_STATUSES,
      ])
      .optional()
      .default("all"),

    variantId:
      catalogObjectIdSchema
        .optional(),

    packId:
      catalogObjectIdSchema
        .optional(),
  })
  .strict();

export const catalogIdParamsSchema = z
  .object({
    id:
      catalogObjectIdSchema,
  })
  .strict();