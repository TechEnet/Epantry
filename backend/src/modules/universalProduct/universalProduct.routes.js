import {
  Router,
} from 'express'

import {
  z,
} from 'zod'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  loadAdminAuthorization,
  requireAdminAccess,
  requireAnyAdminPermission,
} from '../admin/adminPermission.middleware.js'

import {
  rejectPrivilegedImpersonation,
} from '../admin/adminSafety.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
  requireRecentMfaAuthentication,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  PRODUCT_PACK_TYPES,
} from '../catalog/catalog.constants.js'

import {
  PANTRY_QUANTITY_UNITS,
  PANTRY_STORAGE_ZONES,
} from '../pantry/pantry.constants.js'

import {
  BARCODE_OBSERVATION_SOURCES,
  COMMUNITY_PRODUCT_DRAFT_STATUSES,
  COMMUNITY_PRODUCT_LISTING_TYPES,
  NPI_FIELD_REVIEW_STATES,
  NPI_REVIEW_DECISIONS,
  PRODUCT_EVIDENCE_PURPOSES,
} from './universalProduct.models.js'

import {
  createAdminNpiFromImages,
  createHostBulkNpiBatch,
  createHostNpiFromImages,
  createUniversalProductEvidenceUploadIntent,
  getAdminNpiBulkBatch,
  getHostNpiDraft,
  getNpiDraftForAdmin,
  getOwnedUniversalProductDraft,
  listAdminNpiBulkBatches,
  listHostBulkNpiBatches,
  listHostNpiDrafts,
  listNpiReviewQueue,
  resolveUniversalProductImage,
  reviewAdminNpiBulkSelection,
  reviewNpiDraft,
} from './universalProduct.npi.service.js'

import {
  materializeNpiDraftToCatalog,
} from './universalProduct.catalogHandoff.service.js'

import {
  addProductPassportToPantry,
  getProductPassport,
  resolveUniversalProductBarcode,
} from './universalProduct.service.js'

const router =
  Router()

const customerRouter =
  Router()

const hostRouter =
  Router()

const adminRouter =
  Router()

const objectIdSchema =
  z
    .string()
    .trim()
    .regex(
      /^[a-f\d]{24}$/i,
      'A valid MongoDB ObjectId is required.',
    )

const resolveBarcodeBodySchema =
  z
    .object({
      code:
        z
          .string()
          .trim()
          .min(1)
          .max(180),

      decodedFormat:
        z
          .string()
          .trim()
          .min(1)
          .max(80)
          .default(
            'UNKNOWN',
          ),

      source:
        z
          .enum(
            BARCODE_OBSERVATION_SOURCES,
          )
          .default(
            'camera',
          ),

      market:
        z
          .string()
          .trim()
          .min(2)
          .max(10)
          .default(
            'IN',
          ),
    })
    .strict()

const pantryQuantitySchema =
  z
    .object({
      mode:
        z.enum([
          'exact',
          'range',
          'unknown',
        ]),

      value:
        z
          .number()
          .finite()
          .min(0)
          .optional(),

      min:
        z
          .number()
          .finite()
          .min(0)
          .optional(),

      max:
        z
          .number()
          .finite()
          .min(0)
          .optional(),

      unit:
        z
          .enum(
            PANTRY_QUANTITY_UNITS,
          )
          .optional(),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.mode ===
          'exact'
        ) {
          if (
            value.value ===
              undefined ||
            !value.unit ||
            value.min !==
              undefined ||
            value.max !==
              undefined
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Exact quantity requires value + unit and cannot contain range values.',
            })
          }
        }

        if (
          value.mode ===
          'range'
        ) {
          if (
            value.min ===
              undefined ||
            value.max ===
              undefined ||
            !value.unit ||
            value.value !==
              undefined ||
            (
              value.min !==
                undefined &&
              value.max !==
                undefined &&
              value.max <
                value.min
            )
          ) {
            ctx.addIssue({
              code:
                z.ZodIssueCode.custom,

              message:
                'Range quantity requires valid min + max + unit and cannot contain an exact value.',
            })
          }
        }

        if (
          value.mode ===
            'unknown' &&
          (
            value.value !==
              undefined ||
            value.min !==
              undefined ||
            value.max !==
              undefined
          )
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            message:
              'Unknown quantity cannot contain numeric quantity values.',
          })
        }
      },
    )

const addToPantryBodySchema =
  z
    .object({
      sourceType:
        z
          .enum([
            'barcode_capture',
            'product_photo',
          ])
          .default(
            'barcode_capture',
          ),

      quantity:
        pantryQuantitySchema
          .optional(),

      storageZone:
        z
          .enum(
            PANTRY_STORAGE_ZONES,
          )
          .optional(),

      note:
        z
          .string()
          .trim()
          .min(1)
          .max(500)
          .optional(),
    })
    .strict()

const uploadIntentBodySchema =
  z
    .object({
      purpose:
        z.enum(
          PRODUCT_EVIDENCE_PURPOSES,
        ),
    })
    .strict()

const imageAssetSchema =
  z
    .object({
      purpose:
        z.enum(
          PRODUCT_EVIDENCE_PURPOSES,
        ),

      providerAssetId:
        z
          .string()
          .trim()
          .max(300)
          .optional()
          .default(''),

      publicId:
        z
          .string()
          .trim()
          .min(1)
          .max(500),

      version:
        z
          .number()
          .int()
          .positive(),

      signature:
        z
          .string()
          .trim()
          .regex(
            /^[a-f\d]{40}$/i,
          ),

      format:
        z
          .string()
          .trim()
          .min(2)
          .max(20),

      mimeType:
        z.enum([
          'image/jpeg',
          'image/png',
          'image/webp',
        ]),

      bytes:
        z
          .number()
          .int()
          .positive()
          .max(
            8 *
            1024 *
            1024,
          ),

      width:
        z
          .number()
          .int()
          .positive()
          .max(20000)
          .optional(),

      height:
        z
          .number()
          .int()
          .positive()
          .max(20000)
          .optional(),

      resourceType:
        z.literal(
          'image',
        ),

      deliveryType:
        z.literal(
          'authenticated',
        ),

      sha256:
        z
          .string()
          .trim()
          .regex(
            /^[a-f\d]{64}$/i,
          )
          .optional()
          .default(''),
    })
    .strict()

const productHintsSchema =
  z
    .object({
      title:
        z
          .string()
          .trim()
          .max(350)
          .optional()
          .default(''),

      brandName:
        z
          .string()
          .trim()
          .max(250)
          .optional()
          .default(''),

      barcode:
        z
          .string()
          .trim()
          .max(180)
          .optional()
          .default(''),

      netQuantityText:
        z
          .string()
          .trim()
          .max(200)
          .optional()
          .default(''),
    })
    .strict()

const hostDeclarationsSchema =
  z
    .object({
      ingredientDeclarationText:
        z
          .string()
          .trim()
          .max(10000)
          .optional()
          .default(''),

      allergenStatement:
        z
          .string()
          .trim()
          .max(3000)
          .optional()
          .default(''),

      allergens:
        z
          .array(
            z
              .object({
                name:
                  z
                    .string()
                    .trim()
                    .min(1)
                    .max(120),

                relationType:
                  z.enum([
                    'contains',
                    'may_contain',
                    'unknown',
                  ]),
              })
              .strict(),
          )
          .max(80)
          .optional()
          .default([]),

      nutrition:
        z
          .object({
            basis:
              z
                .enum([
                  'per_100g',
                  'per_100ml',
                  'per_serving',
                  'per_pack',
                ])
                .nullable()
                .optional()
                .default(null),

            servingSize:
              z
                .object({
                  value:
                    z
                      .number()
                      .min(0),

                  unit:
                    z.enum([
                      'g',
                      'kg',
                      'ml',
                      'l',
                      'piece',
                    ]),
                })
                .strict()
                .nullable()
                .optional()
                .default(null),

            nutrients:
              z
                .array(
                  z
                    .object({
                      name:
                        z
                          .string()
                          .trim()
                          .min(1)
                          .max(100),

                      amount:
                        z
                          .number()
                          .min(0),

                      unit:
                        z
                          .string()
                          .trim()
                          .min(1)
                          .max(30),
                    })
                    .strict(),
                )
                .max(80)
                .optional()
                .default([]),
          })
          .strict()
          .optional(),

      countryOfOrigin:
        z
          .string()
          .trim()
          .max(120)
          .optional()
          .default(''),

      manufacturerName:
        z
          .string()
          .trim()
          .max(250)
          .optional()
          .default(''),

      claims:
        z
          .array(
            z
              .string()
              .trim()
              .min(1)
              .max(200),
          )
          .max(40)
          .optional()
          .default([]),
    })
    .strict()

const resolveImageBodySchema =
  z
    .object({
      draftId:
        objectIdSchema
          .optional(),

      assets:
        z
          .array(
            imageAssetSchema,
          )
          .min(1)
          .max(8),

      market:
        z
          .string()
          .trim()
          .min(2)
          .max(10)
          .default(
            'IN',
          ),

      hints:
        productHintsSchema
          .optional()
          .default({}),
    })
    .strict()

const REQUIRED_PRODUCE_NUTRIENTS =
  Object.freeze([
    'energy',
    'protein',
    'carbohydrate',
    'total fat',
    'saturated fat',
    'dietary fibre',
    'total sugars',
    'sodium',
  ])

function validateGovernedNpiCreate(
  value,
  ctx,
) {
  if (
    !value.draftId &&
    !value.assets.length
  ) {
    ctx.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'assets',
      ],

      message:
        'At least one evidence image is required when creating a new NPI draft.',
    })
  }

  const listingType =
    value.listingType ||
    'packaged'

  if (
    value.draftId ||
    listingType ===
      'packaged'
  ) {
    return
  }

  if (!value.hints?.title?.trim()) {
    ctx.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'hints',
        'title',
      ],

      message:
        'Produce name is required.',
    })
  }

  if (!value.hints?.netQuantityText?.trim()) {
    ctx.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'hints',
        'netQuantityText',
      ],

      message:
        'Produce quantity and unit are required.',
    })
  }

  if (!value.hostDeclarations?.countryOfOrigin?.trim()) {
    ctx.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'hostDeclarations',
        'countryOfOrigin',
      ],

      message:
        'Country of origin is required for fruit and vegetable listings.',
    })
  }

  const nutrientNames =
    new Set(
      (
        value.hostDeclarations
          ?.nutrition
          ?.nutrients ||
        []
      ).map(
        (item) =>
          String(
            item?.name ||
            '',
          )
            .trim()
            .toLowerCase(),
      ),
    )

  const missingNutrients =
    REQUIRED_PRODUCE_NUTRIENTS.filter(
      (name) =>
        !nutrientNames.has(
          name,
        ),
    )

  if (missingNutrients.length) {
    ctx.addIssue({
      code:
        z.ZodIssueCode.custom,

      path: [
        'hostDeclarations',
        'nutrition',
        'nutrients',
      ],

      message:
        `Produce nutrition requires: ${missingNutrients.join(', ')}.`,
    })
  }
}

const hostResolveImageBodySchema =
  resolveImageBodySchema
    .extend({
      assets:
        z
          .array(
            imageAssetSchema,
          )
          .max(8)
          .default([]),

      listingType:
        z
          .enum(
            COMMUNITY_PRODUCT_LISTING_TYPES,
          )
          .optional(),

      brandId:
        objectIdSchema
          .optional(),

      authorityGrantId:
        objectIdSchema
          .optional(),

      hostDeclarations:
        hostDeclarationsSchema
          .optional()
          .default({}),
    })
    .superRefine(
      validateGovernedNpiCreate,
    )

const bulkCommercialDraftSchema =
  z
    .object({
      currency:
        z
          .literal(
            'INR',
          )
          .default(
            'INR',
          ),

      listPriceMinor:
        z
          .number()
          .int()
          .positive(),

      salePriceMinor:
        z
          .number()
          .int()
          .positive()
          .nullable()
          .optional()
          .default(null),

      availableQuantity:
        z
          .number()
          .min(0),

      inventoryNodeName:
        z
          .string()
          .trim()
          .min(1)
          .max(220),

      inventoryNodeType:
        z
          .enum([
            'store',
            'warehouse',
            'dark_store',
            'distribution_center',
            'other',
          ])
          .default(
            'warehouse',
          ),

      city:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      state:
        z
          .string()
          .trim()
          .min(1)
          .max(120),

      pincode:
        z
          .string()
          .trim()
          .min(3)
          .max(24),

      serviceAreaName:
        z
          .string()
          .trim()
          .min(1)
          .max(220),

      activateAfterApproval:
        z
          .boolean()
          .optional()
          .default(true),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        if (
          value.salePriceMinor &&
          value.salePriceMinor >
            value.listPriceMinor
        ) {
          ctx.addIssue({
            code:
              z.ZodIssueCode.custom,

            path: [
              'salePriceMinor',
            ],

            message:
              'Sale price cannot exceed list price.',
          })
        }
      },
    )

const bulkNpiRowSchema =
  z
    .object({
      rowNumber:
        z
          .number()
          .int()
          .positive(),

      merchantSku:
        z
          .string()
          .trim()
          .min(1)
          .max(220),

      assets:
        z
          .array(
            imageAssetSchema,
          )
          .min(1)
          .max(8),

      hints:
        productHintsSchema,

      hostDeclarations:
        hostDeclarationsSchema,

      commercialDraft:
        bulkCommercialDraftSchema,
    })
    .strict()

const createHostBulkNpiBatchBodySchema =
  z
    .object({
      listingType:
        z
          .enum(
            COMMUNITY_PRODUCT_LISTING_TYPES,
          ),

      market:
        z
          .string()
          .trim()
          .min(2)
          .max(10)
          .default(
            'IN',
          ),

      sourceFileName:
        z
          .string()
          .trim()
          .max(300)
          .optional()
          .default(''),

      sourceRowCount:
        z
          .number()
          .int()
          .min(1)
          .max(5000),

      issueCount:
        z
          .number()
          .int()
          .min(0)
          .max(5000)
          .optional()
          .default(0),

      rows:
        z
          .array(
            bulkNpiRowSchema,
          )
          .min(1)
          .max(500),

      validationIssues:
        z
          .array(
            z
              .object({
                rowNumber:
                  z
                    .number()
                    .int()
                    .positive(),

                merchantSku:
                  z
                    .string()
                    .trim()
                    .max(220)
                    .optional()
                    .default(''),

                productName:
                  z
                    .string()
                    .trim()
                    .max(350)
                    .optional()
                    .default(''),

                issues:
                  z
                    .array(
                      z
                        .string()
                        .trim()
                        .min(1)
                        .max(500),
                    )
                    .min(1)
                    .max(30),
              })
              .strict(),
          )
          .max(1000)
          .optional()
          .default([]),
    })
    .strict()
    .superRefine(
      (
        value,
        ctx,
      ) => {
        const seenSkus =
          new Set()

        value.rows.forEach(
          (
            row,
            index,
          ) => {
            const sku =
              row.merchantSku
                .trim()
                .toLowerCase()

            if (
              seenSkus.has(
                sku,
              )
            ) {
              ctx.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  'rows',
                  index,
                  'merchantSku',
                ],

                message:
                  'Merchant SKU must be unique inside one bulk batch.',
              })
            }

            seenSkus.add(
              sku,
            )

            if (
              !row.hints.title?.trim()
            ) {
              ctx.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  'rows',
                  index,
                  'hints',
                  'title',
                ],

                message:
                  'Product name is required for bulk NPI.',
              })
            }

            if (
              !row.hints.netQuantityText?.trim()
            ) {
              ctx.addIssue({
                code:
                  z.ZodIssueCode.custom,

                path: [
                  'rows',
                  index,
                  'hints',
                  'netQuantityText',
                ],

                message:
                  'Pack/quantity text is required for bulk NPI.',
              })
            }

            if (
              value.listingType !==
                'packaged'
            ) {
              if (
                !row.hostDeclarations
                  ?.countryOfOrigin
                  ?.trim()
              ) {
                ctx.addIssue({
                  code:
                    z.ZodIssueCode.custom,

                  path: [
                    'rows',
                    index,
                    'hostDeclarations',
                    'countryOfOrigin',
                  ],

                  message:
                    'Country of origin is required for bulk produce NPI.',
                })
              }

              const nutrients =
                new Set(
                  (
                    row.hostDeclarations
                      ?.nutrition
                      ?.nutrients ||
                    []
                  ).map(
                    (
                      item,
                    ) =>
                      String(
                        item?.name ||
                        '',
                      )
                        .trim()
                        .toLowerCase(),
                  ),
                )

              const missing =
                REQUIRED_PRODUCE_NUTRIENTS.filter(
                  (
                    name,
                  ) =>
                    !nutrients.has(
                      name,
                    ),
                )

              if (
                missing.length
              ) {
                ctx.addIssue({
                  code:
                    z.ZodIssueCode.custom,

                  path: [
                    'rows',
                    index,
                    'hostDeclarations',
                    'nutrition',
                  ],

                  message:
                    `Produce nutrition requires: ${missing.join(', ')}.`,
                })
              }
            }
          },
        )
      },
    )

const bulkBatchListQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),
    })
    .strict()

const adminBulkBatchQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),

      listingType:
        z
          .enum(
            COMMUNITY_PRODUCT_LISTING_TYPES,
          )
          .optional(),

      search:
        z
          .string()
          .trim()
          .max(220)
          .optional()
          .default(''),
    })
    .strict()

const adminBulkBatchReviewBodySchema =
  z
    .object({
      draftIds:
        z
          .array(
            objectIdSchema,
          )
          .min(1)
          .max(100),

      decision:
        z.enum(
          NPI_REVIEW_DECISIONS,
        ),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(2000),
    })
    .strict()

const adminResolveImageBodySchema =
  resolveImageBodySchema
    .extend({
      assets:
        z
          .array(
            imageAssetSchema,
          )
          .max(8)
          .default([]),

      listingType:
        z
          .enum(
            COMMUNITY_PRODUCT_LISTING_TYPES,
          )
          .optional(),

      hostDeclarations:
        hostDeclarationsSchema
          .optional()
          .default({}),
    })
    .superRefine(
      validateGovernedNpiCreate,
    )

const paginationQuerySchema =
  z
    .object({
      page:
        z.coerce
          .number()
          .int()
          .min(1)
          .default(1),

      limit:
        z.coerce
          .number()
          .int()
          .min(1)
          .max(100)
          .default(25),

      status:
        z
          .enum(
            COMMUNITY_PRODUCT_DRAFT_STATUSES,
          )
          .optional(),
    })
    .strict()

const fieldDecisionSchema =
  z
    .object({
      fieldPath:
        z.enum([
          'displayName',
          'brandName',
          'gtin',
          'netQuantity',
          'ingredientDeclarationText',
          'allergens',
          'nutrition',
          'claims',
          'certifications',
          'manufacturerName',
          'countryOfOrigin',
        ]),

      decision:
        z.enum(
          NPI_FIELD_REVIEW_STATES,
        ),

      correctedValue:
        z
          .unknown()
          .optional(),

      note:
        z
          .string()
          .trim()
          .max(1000)
          .optional()
          .default(''),
    })
    .strict()

const reviewDraftBodySchema =
  z
    .object({
      decision:
        z.enum(
          NPI_REVIEW_DECISIONS,
        ),

      fieldDecisions:
        z
          .array(
            fieldDecisionSchema,
          )
          .max(30)
          .default([]),

      reason:
        z
          .string()
          .trim()
          .min(3)
          .max(4000),
    })
    .strict()


const catalogHandoffBodySchema =
  z
    .object({
      categoryId:
        objectIdSchema
          .optional(),

      categoryName:
        z
          .string()
          .trim()
          .min(1)
          .max(180)
          .optional(),

      packType:
        z
          .enum(
            PRODUCT_PACK_TYPES,
          )
          .default(
            'other',
          ),

      reason:
        z
          .string()
          .trim()
          .max(1000)
          .optional()
          .default(''),

      fieldDecisions:
        z
          .array(
            z
              .object({
                fieldPath:
                  z
                    .string()
                    .trim()
                    .min(1)
                    .max(120),

                decision:
                  z
                    .literal(
                      'accepted',
                    ),
              })
              .strict(),
          )
          .max(32)
          .optional()
          .default([]),
    })
    .strict()
    .refine(
      (value) =>
        Boolean(
          value.categoryId ||
          value.categoryName,
        ),
      {
        message:
          'A Category ID or Category name is required for M04 catalog handoff.',
      },
    )

function parseOrThrow(
  schema,
  value,
  code,
  message,
) {
  const parsed =
    schema.safeParse(
      value,
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      message,
      [
        {
          code,

          issues:
            parsed
              .error
              .issues,
        },
      ],
    )
  }

  return parsed.data
}

function wrap(
  handler,
) {
  return async function universalProductController(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      )
    } catch (error) {
      return next(
        error,
      )
    }
  }
}

function sendSuccess(
  req,
  res,
  statusCode,
  data,
  message,
) {
  return res
    .status(
      statusCode,
    )
    .json(
      new ApiResponse(
        statusCode,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    )
}

function parseIdParam(
  req,
  code,
  message,
) {
  return parseOrThrow(
    z
      .object({
        id:
          objectIdSchema,
      })
      .strict(),

    req.params,

    code,

    message,
  ).id
}

function permissionKeySet(
  req,
) {
  const raw =
    req.adminAuthorization
      ?.permissionKeys ||
    req.adminAuthorization
      ?.permissions ||
    req.adminAuthorization
      ?.effectivePermissions ||
    []

  return new Set(
    raw
      .map(
        (
          value,
        ) =>
          typeof value ===
          'string'
            ? value
            : value?.key,
      )
      .filter(
        Boolean,
      ),
  )
}

function resolveNpiAuditPermissionKey(
  req,
) {
  const available =
    permissionKeySet(
      req,
    )

  if (
    available.has(
      'catalog.mutate',
    )
  ) {
    return 'catalog.mutate'
  }

  return 'trust_safety.mutate'
}

/*
|--------------------------------------------------------------------------
| Customer M14 Boundary
|--------------------------------------------------------------------------
|
| Host users retain Customer access through the same identity.
| activeMode is UX only and is never authorization.
| Super Admin gets no Customer bypass.
|
*/

const customerSecurity = [
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
]

customerRouter.post(
  '/universal-product/resolve-barcode',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          resolveBarcodeBodySchema,

          req.body,

          'UNIVERSAL_PRODUCT_BARCODE_INPUT_INVALID',

          'Invalid barcode resolution request.',
        )

      const resolution =
        await resolveUniversalProductBarcode({
          ...input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,

          persistExternalDraft:
            false,
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          resolution,
        },
        'Product resolution completed.',
      )
    },
  ),
)

customerRouter.post(
  '/universal-product/image-upload-intent',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          uploadIntentBodySchema,

          req.body,

          'PRODUCT_EVIDENCE_UPLOAD_INTENT_INVALID',

          'Invalid product evidence upload request.',
        )

      const uploadIntent =
        createUniversalProductEvidenceUploadIntent({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          uploadIntent,
        },
        'Product evidence upload intent created.',
      )
    },
  ),
)

customerRouter.post(
  '/universal-product/resolve-image',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          resolveImageBodySchema,

          req.body,

          'UNIVERSAL_PRODUCT_IMAGE_INPUT_INVALID',

          'Invalid product image resolution request.',
        )

      const resolution =
        await resolveUniversalProductImage({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        {
          resolution,
        },
        'Product image evidence processed.',
      )
    },
  ),
)

customerRouter.get(
  '/universal-product/drafts/:id',

  ...customerSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const draftId =
        parseIdParam(
          req,

          'UNIVERSAL_PRODUCT_DRAFT_ID_INVALID',

          'Invalid provisional product draft ID.',
        )

      const result =
        await getOwnedUniversalProductDraft({
          draftId,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Provisional product draft loaded.',
      )
    },
  ),
)

customerRouter.get(
  '/products/:id/passport',

  ...customerSecurity,

  wrap(
    async (
      req,
      res,
    ) => {
      const id =
        parseIdParam(
          req,

          'PRODUCT_PASSPORT_ID_INVALID',

          'Invalid Product Passport ID.',
        )

      const passport =
        await getProductPassport(
          id,
        )

      return sendSuccess(
        req,
        res,
        200,
        {
          passport,
        },
        'Product Passport loaded.',
      )
    },
  ),
)

customerRouter.post(
  '/products/:id/add-to-pantry',

  ...customerSecurity,

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const id =
        parseIdParam(
          req,

          'PRODUCT_PASSPORT_ID_INVALID',

          'Invalid Product Passport ID.',
        )

      const input =
        parseOrThrow(
          addToPantryBodySchema,

          req.body,

          'PRODUCT_PASSPORT_PANTRY_INPUT_INVALID',

          'Invalid add-to-pantry request.',
        )

      const pantry =
        await addProductPassportToPantry({
          productVersionId:
            id,

          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        {
          pantry,
        },
        'Product added to Living Pantry.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Host AI-Assisted NPI Boundary
|--------------------------------------------------------------------------
|
| Host authority requires backend capability:
|
| hostEnabled === true
| AND
| hostAccessStatus === active
|
| activeMode never grants access.
| Privileged Host NPI also requires MFA.
|
*/

hostRouter.use(
  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireHostAccess,

  requireMfaAssurance,
)

hostRouter.post(
  '/universal-product/resolve-barcode',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          resolveBarcodeBodySchema,

          req.body,

          'HOST_UNIVERSAL_PRODUCT_BARCODE_INPUT_INVALID',

          'Invalid Host barcode resolution request.',
        )

      const resolution =
        await resolveUniversalProductBarcode({
          ...input,

          actorUser:
            req.currentUser,

          requestId:
            req.requestId,

          persistExternalDraft:
            false,
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          resolution,
        },
        'Host product resolution completed.',
      )
    },
  ),
)

hostRouter.post(
  '/universal-product/npi/image-upload-intent',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          uploadIntentBodySchema,

          req.body,

          'HOST_NPI_UPLOAD_INTENT_INVALID',

          'Invalid Host NPI upload request.',
        )

      const uploadIntent =
        createUniversalProductEvidenceUploadIntent({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          uploadIntent,
        },
        'Host NPI evidence upload intent created.',
      )
    },
  ),
)

hostRouter.post(
  '/universal-product/npi/resolve-image',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          hostResolveImageBodySchema,

          req.body,

          'HOST_NPI_IMAGE_INPUT_INVALID',

          'Invalid Host NPI image request.',
        )

      const resolution =
        await createHostNpiFromImages({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        {
          resolution,
        },
        'Host NPI draft created from product evidence.',
      )
    },
  ),
)

hostRouter.post(
  '/universal-product/npi/bulk-batches',

  requireCsrfToken,

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createHostBulkNpiBatchBodySchema,

          req.body,

          'HOST_BULK_NPI_INPUT_INVALID',

          'Invalid Host bulk NPI request.',
        )

      const result =
        await createHostBulkNpiBatch({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        result,
        'Host bulk NPI batch submitted for governed review.',
      )
    },
  ),
)

hostRouter.get(
  '/universal-product/npi/bulk-batches',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          bulkBatchListQuerySchema,

          req.query,

          'HOST_BULK_NPI_LIST_QUERY_INVALID',

          'Invalid Host bulk NPI list query.',
        )

      const result =
        await listHostBulkNpiBatches({
          ...query,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host bulk NPI batches loaded.',
      )
    },
  ),
)

hostRouter.get(
  '/universal-product/npi/drafts',

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          paginationQuerySchema,

          req.query,

          'HOST_NPI_LIST_QUERY_INVALID',

          'Invalid Host NPI list query.',
        )

      const result =
        await listHostNpiDrafts({
          ...query,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host NPI drafts loaded.',
      )
    },
  ),
)

hostRouter.get(
  '/universal-product/npi/drafts/:id',

  wrap(
    async (
      req,
      res,
    ) => {
      const draftId =
        parseIdParam(
          req,

          'HOST_NPI_DRAFT_ID_INVALID',

          'Invalid Host NPI draft ID.',
        )

      const result =
        await getHostNpiDraft({
          draftId,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Host NPI draft loaded.',
      )
    },
  ),
)

/*
|--------------------------------------------------------------------------
| Catalog / Trust & Safety Review Boundary
|--------------------------------------------------------------------------
|
| Limited internal Admins are authorized only through M03 permissionKeys.
|
| Real Super Admin receives deployed permissions through the same backend
| permission engine.
|
| Frontend state and activeMode are irrelevant here.
|
*/

adminRouter.use(
  rejectPrivilegedImpersonation,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  loadAdminAuthorization,

  requireAdminAccess,

  requireMfaAssurance,
)

const requireNpiRead =
  requireAnyAdminPermission(
    'catalog.read',
    'trust_safety.read',
  )

const requireNpiMutation =
  requireAnyAdminPermission(
    'catalog.mutate',
    'trust_safety.mutate',
  )

adminRouter.post(
  '/image-upload-intent',

  requireCsrfToken,

  requireAnyAdminPermission(
    'catalog.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          uploadIntentBodySchema,

          req.body,

          'ADMIN_NPI_UPLOAD_INTENT_INVALID',

          'Invalid Super Admin NPI upload request.',
        )

      const uploadIntent =
        createUniversalProductEvidenceUploadIntent({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        200,
        {
          uploadIntent,
        },
        'Super Admin NPI evidence upload intent created.',
      )
    },
  ),
)

adminRouter.post(
  '/resolve-image',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'catalog.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          adminResolveImageBodySchema,

          req.body,

          'ADMIN_NPI_IMAGE_INPUT_INVALID',

          'Invalid Super Admin NPI image request.',
        )

      const resolution =
        await createAdminNpiFromImages({
          ...input,

          actorUser:
            req.currentUser,
        })

      return sendSuccess(
        req,
        res,
        201,
        {
          resolution,
        },
        'Super Admin NPI draft created from product evidence.',
      )
    },
  ),
)

adminRouter.get(
  '/review-queue',

  requireNpiRead,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          paginationQuerySchema,

          req.query,

          'NPI_REVIEW_QUEUE_QUERY_INVALID',

          'Invalid NPI review queue query.',
        )

      const result =
        await listNpiReviewQueue(
          query,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'NPI review queue loaded.',
      )
    },
  ),
)

adminRouter.get(
  '/bulk-batches',

  requireNpiRead,

  wrap(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          adminBulkBatchQuerySchema,
          req.query,
          'NPI_BULK_BATCH_QUERY_INVALID',
          'Invalid Bulk NPI review query.',
        )

      const result =
        await listAdminNpiBulkBatches(
          query,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Bulk NPI review batches loaded.',
      )
    },
  ),
)

adminRouter.get(
  '/bulk-batches/:id',

  requireNpiRead,

  wrap(
    async (
      req,
      res,
    ) => {
      const batchId =
        parseIdParam(
          req,
          'NPI_BULK_BATCH_ID_INVALID',
          'Invalid Bulk NPI batch ID.',
        )

      const result =
        await getAdminNpiBulkBatch(
          batchId,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Bulk NPI review batch loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/bulk-batches/:id/review-selected',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireNpiMutation,

  wrap(
    async (
      req,
      res,
    ) => {
      const batchId =
        parseIdParam(
          req,
          'NPI_BULK_BATCH_ID_INVALID',
          'Invalid Bulk NPI batch ID.',
        )

      const input =
        parseOrThrow(
          adminBulkBatchReviewBodySchema,
          req.body,
          'NPI_BULK_BATCH_REVIEW_INPUT_INVALID',
          'Invalid Bulk NPI review selection.',
        )

      const result =
        await reviewAdminNpiBulkSelection({
          batchId,
          ...input,
          actorUser:
            req.currentUser,
          adminAuthorization:
            req.adminAuthorization,
          auditPermissionKey:
            resolveNpiAuditPermissionKey(
              req,
            ),
          requestId:
            req.requestId,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'Bulk NPI review decisions recorded.',
      )
    },
  ),
)

adminRouter.get(
  '/drafts/:id',

  requireNpiRead,

  wrap(
    async (
      req,
      res,
    ) => {
      const draftId =
        parseIdParam(
          req,

          'NPI_REVIEW_DRAFT_ID_INVALID',

          'Invalid NPI review draft ID.',
        )

      const result =
        await getNpiDraftForAdmin(
          draftId,
        )

      return sendSuccess(
        req,
        res,
        200,
        result,
        'NPI review draft loaded.',
      )
    },
  ),
)

adminRouter.post(
  '/drafts/:id/review',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireNpiMutation,

  wrap(
    async (
      req,
      res,
    ) => {
      const draftId =
        parseIdParam(
          req,

          'NPI_REVIEW_DRAFT_ID_INVALID',

          'Invalid NPI review draft ID.',
        )

      const input =
        parseOrThrow(
          reviewDraftBodySchema,

          req.body,

          'NPI_REVIEW_INPUT_INVALID',

          'Invalid NPI review decision.',
        )

      const result =
        await reviewNpiDraft({
          draftId,

          ...input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          auditPermissionKey:
            resolveNpiAuditPermissionKey(
              req,
            ),

          requestId:
            req.requestId,
        })

      return sendSuccess(
        req,
        res,
        200,
        result,
        'NPI review decision recorded.',
      )
    },
  ),
)


adminRouter.post(
  '/drafts/:id/catalog-handoff',

  requireCsrfToken,

  requireRecentMfaAuthentication,

  requireAnyAdminPermission(
    'catalog.mutate',
  ),

  wrap(
    async (
      req,
      res,
    ) => {
      const draftId =
        parseIdParam(
          req,

          'NPI_CATALOG_HANDOFF_DRAFT_ID_INVALID',

          'Invalid NPI catalog handoff draft ID.',
        )

      const input =
        parseOrThrow(
          catalogHandoffBodySchema,

          req.body,

          'NPI_CATALOG_HANDOFF_INPUT_INVALID',

          'Invalid NPI catalog handoff input.',
        )

      const handoff =
        await materializeNpiDraftToCatalog({
          draftId,

          ...input,

          actorUser:
            req.currentUser,

          adminAuthorization:
            req.adminAuthorization,

          requestId:
            req.requestId,
        })

      return sendSuccess(
        req,
        res,
        handoff.alreadyMaterialized
          ? 200
          : 201,
        {
          handoff,
        },
        handoff.alreadyMaterialized
          ? 'NPI draft is already materialized in M04 catalog.'
          : 'NPI draft materialized into an M04 Product Version draft.',
      )
    },
  ),
)

router.use(
  customerRouter,
)

router.use(
  '/host',
  hostRouter,
)

router.use(
  '/admin/product-intelligence',
  adminRouter,
)

export default router