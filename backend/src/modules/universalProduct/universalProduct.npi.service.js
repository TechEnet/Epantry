import {
  z,
} from 'zod'

import {
  createOpenRouterChatCompletion,
  isOpenRouterConfigured,
} from '../../integrations/ai/ai.provider.js'

import {
  buildSignedProductEvidenceUrl,
  createProductEvidenceUploadIntent,
  verifyProductEvidenceUploadResult,
} from '../../integrations/media/cloudinary.provider.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  assertDistinctMakerCheckerActors,
} from '../admin/adminSafety.middleware.js'

import {
  BrandAuthorityGrant,
} from '../brands/brandAuthority.models.js'

import {
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  submitProductVersionForReview,
} from '../catalog/catalog.admin.service.js'

import {
  publishProductVersion,
} from '../catalog/catalog.governance.service.js'

import {
  requireActiveHostMarketplaceOrganization,
} from '../marketplace/marketplace.host.service.js'

import {
  createHostPriceRule,
} from '../marketplace/marketplace.pricing.service.js'

import {
  createBulkInventorySnapshots,
  createInventoryNode,
} from '../marketplace/marketplace.inventory.service.js'

import {
  activateHostOffer,
  inspectHostOfferReadiness,
} from '../marketplace/marketplace.offer-readiness.service.js'

import {
  normalizeMarketplaceKey,
} from '../marketplace/marketplace.constants.js'

import {
  HostOffer,
  InventoryNode,
  InventorySnapshot,
  MarketplaceOrganization,
  PriceRule,
  ServiceArea,
} from '../marketplace/marketplace.models.js'

import {
  ensureMediaPrivacyClearanceForEvidenceBatch,
} from '../mediaPrivacy/mediaPrivacy.scanner.service.js'

import {
  materializeNpiDraftToCatalog,
} from './universalProduct.catalogHandoff.service.js'

import {
  CommunityProductDraft,
  ImageEvidence,
  LabelExtraction,
  NpiBulkBatch,
  NPIJob,
  ProductNpiReviewDecision,
} from './universalProduct.models.js'

const EVIDENCE_RETENTION_DAYS =
  30

const PARSER_VERSION =
  'm14-label-v1'

const SAFETY_FIELDS =
  Object.freeze([
    'ingredientDeclarationText',
    'allergens',
    'nutrition',
  ])

const TRUST_SAFETY_REVIEW_FIELDS =
  new Set([
    'ingredientDeclarationText',
    'allergens',
    'nutrition',
    'claims',
    'certifications',
  ])

const BULK_REVIEW_FIELD_PATHS =
  Object.freeze([
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
  ])

const confidence =
  z
    .number()
    .min(0)
    .max(1)

const valueConfidence = (
  max,
) =>
  z
    .object({
      value:
        z
          .string()
          .trim()
          .max(
            max,
          ),

      confidence,
    })
    .strict()

const extractionSchema =
  z
    .object({
      productName:
        valueConfidence(
          350,
        ),

      brandName:
        valueConfidence(
          250,
        ),

      barcode:
        valueConfidence(
          180,
        ),

      netQuantity:
        z
          .object({
            value:
              z
                .number()
                .min(0)
                .nullable(),

            unit:
              z.enum([
                'g',
                'kg',
                'ml',
                'l',
                'piece',
                'unknown',
              ]),

            rawText:
              z
                .string()
                .trim()
                .max(
                  200,
                ),

            confidence,
          })
          .strict(),

      ingredientDeclaration:
        z
          .object({
            text:
              z
                .string()
                .trim()
                .max(
                  10000,
                ),

            confidence,
          })
          .strict(),

      allergenStatement:
        z
          .object({
            text:
              z
                .string()
                .trim()
                .max(
                  3000,
                ),

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
                          .max(
                            120,
                          ),

                      relationType:
                        z.enum([
                          'contains',
                          'may_contain',
                          'unknown',
                        ]),
                    })
                    .strict(),
                )
                .max(
                  80,
                ),

            confidence,
          })
          .strict(),

      nutrition:
        z
          .object({
            basis:
              z.enum([
                'per_100g',
                'per_100ml',
                'per_serving',
                'per_pack',
                'unknown',
              ]),

            servingSize:
              z
                .object({
                  value:
                    z
                      .number()
                      .min(0),

                  unit:
                    z
                      .string()
                      .trim()
                      .min(1)
                      .max(
                        30,
                      ),
                })
                .strict()
                .nullable(),

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
                          .max(
                            100,
                          ),

                      amount:
                        z
                          .number()
                          .min(0),

                      unit:
                        z
                          .string()
                          .trim()
                          .min(1)
                          .max(
                            30,
                          ),
                    })
                    .strict(),
                )
                .max(
                  80,
                ),

            confidence,
          })
          .strict(),

      claims:
        z
          .array(
            z
              .object({
                label:
                  z
                    .string()
                    .trim()
                    .min(1)
                    .max(
                      200,
                    ),

                confidence,
              })
              .strict(),
          )
          .max(
            80,
          ),

      certifications:
        z
          .array(
            z
              .object({
                label:
                  z
                    .string()
                    .trim()
                    .min(1)
                    .max(
                      200,
                    ),

                confidence,
              })
              .strict(),
          )
          .max(
            80,
          ),

      manufacturerName:
        valueConfidence(
          250,
        ),

      countryOfOrigin:
        valueConfidence(
          120,
        ),

      normalizedLabelText:
        z
          .string()
          .trim()
          .max(
            12000,
          ),

      evidenceQuality:
        z.enum([
          'sufficient',
          'partial',
          'insufficient',
        ]),

      missingEvidencePurposes:
        z
          .array(
            z.enum([
              'front_pack',
              'back_pack',
              'ingredient_panel',
              'nutrition_panel',
              'allergen_statement',
              'barcode',
              'certification_mark',
              'side_panel',
              'other',
            ]),
          )
          .max(
            20,
          ),
    })
    .strict()

const clean = (
  value,
) =>
  String(
    value || '',
  ).trim()

const id = (
  value,
) =>
  value ===
      null ||
    value ===
      undefined
    ? null
    : String(
        value,
      )

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (
    !value
  ) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY user is required.',
      [
        {
          code:
            'UNIVERSAL_PRODUCT_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function market(
  value,
) {
  return (
    clean(
      value ||
        'IN',
    )
      .toUpperCase()
      .slice(
        0,
        10,
      ) ||
    'IN'
  )
}

function barcode(
  value,
) {
  return clean(
    value,
  )
    .replace(
      /\s+/g,
      '',
    )
    .slice(
      0,
      180,
    )
}

function retentionUntil() {
  const date =
    new Date()

  date.setUTCDate(
    date.getUTCDate() +
      EVIDENCE_RETENTION_DAYS,
  )

  return date
}

function average(
  values,
) {
  const list =
    (
      Array.isArray(
        values,
      )
        ? values
        : []
    )
      .map(
        (
          item,
        ) =>
          Number(
            item?.confidence,
          ),
      )
      .filter(
        Number.isFinite,
      )

  return list.length
    ? list.reduce(
        (
          sum,
          value,
        ) =>
          sum +
          value,
        0,
      ) /
        list.length
    : null
}

function field(
  value,
  score,
  source,
  safetyCritical =
    false,
) {
  const parsed =
    Number(
      score,
    )

  return {
    value,

    confidence:
      Number.isFinite(
        parsed,
      )
        ? Math.max(
            0,
            Math.min(
              1,
              parsed,
            ),
          )
        : null,

    source,

    verificationStatus:
      'unverified',

    reviewState:
      'pending_review',

    safetyCritical,
  }
}

function manualField(
  value,
  safetyCritical =
    false,
  source =
    'host_manual',
) {
  return {
    value,
    confidence:
      null,
    source,
    verificationStatus:
      'unverified',
    reviewState:
      'pending_review',
    safetyCritical,
  }
}

function mergeHostDeclarations(
  fields,
  declarations = {},
  manualSource =
    'host_manual',
) {
  const result = {
    ...(fields || {}),
  }

  const ingredientDeclarationText =
    clean(
      declarations
        ?.ingredientDeclarationText,
    )

  if (ingredientDeclarationText) {
    result.ingredientDeclarationText =
      manualField(
        ingredientDeclarationText,
        true,
        manualSource,
      )
  }

  const allergenStatement =
    clean(
      declarations
        ?.allergenStatement,
    )

  const allergens =
    (
      Array.isArray(
        declarations?.allergens,
      )
        ? declarations.allergens
        : []
    )
      .map(
        (item) => ({
          name:
            clean(
              item?.name,
            ),
          relationType:
            [
              'contains',
              'may_contain',
              'unknown',
            ].includes(
              item?.relationType,
            )
              ? item.relationType
              : 'unknown',
        }),
      )
      .filter(
        (item) =>
          Boolean(
            item.name,
          ),
      )

  if (
    allergenStatement ||
    allergens.length
  ) {
    result.allergens =
      manualField(
        {
          statement:
            allergenStatement,
          items:
            allergens,
        },
        true,
        manualSource,
      )
  }

  const nutrition =
    declarations?.nutrition &&
    typeof declarations.nutrition ===
      'object'
      ? declarations.nutrition
      : null

  if (nutrition) {
    const nutrients =
      (
        Array.isArray(
          nutrition.nutrients,
        )
          ? nutrition.nutrients
          : []
      )
        .map(
          (item) => ({
            name:
              clean(
                item?.name,
              ),
            amount:
              Number(
                item?.amount,
              ),
            unit:
              clean(
                item?.unit,
              ),
          }),
        )
        .filter(
          (item) =>
            item.name &&
            Number.isFinite(
              item.amount,
            ) &&
            item.amount >= 0 &&
            item.unit,
        )

    if (
      nutrition.basis ||
      nutrition.servingSize ||
      nutrients.length
    ) {
      result.nutrition =
        manualField(
          {
            basis:
              nutrition.basis ||
              null,
            servingSize:
              nutrition.servingSize ||
              null,
            nutrients,
          },
          true,
          manualSource,
        )
    }
  }

  const manufacturerName =
    clean(
      declarations
        ?.manufacturerName,
    )

  if (manufacturerName) {
    result.manufacturerName =
      manualField(
        manufacturerName,
        false,
        manualSource,
      )
  }

  const countryOfOrigin =
    clean(
      declarations
        ?.countryOfOrigin,
    )

  if (countryOfOrigin) {
    result.countryOfOrigin =
      manualField(
        countryOfOrigin,
        false,
        manualSource,
      )
  }

  const claims =
    (
      Array.isArray(
        declarations?.claims,
      )
        ? declarations.claims
        : []
    )
      .map(
        (label) => ({
          label:
            clean(label),
          confidence:
            null,
        }),
      )
      .filter(
        (item) =>
          Boolean(
            item.label,
          ),
      )

  if (claims.length) {
    result.claims =
      manualField(
        claims,
        true,
        manualSource,
      )
  }

  return result
}

function hasHostManualDeclarations(
  declarations = {},
) {
  if (
    clean(
      declarations
        ?.ingredientDeclarationText,
    ) ||
    clean(
      declarations
        ?.allergenStatement,
    ) ||
    clean(
      declarations
        ?.countryOfOrigin,
    ) ||
    clean(
      declarations
        ?.manufacturerName,
    )
  ) {
    return true
  }

  if (
    Array.isArray(
      declarations?.allergens,
    ) &&
    declarations.allergens.length
  ) {
    return true
  }

  if (
    Array.isArray(
      declarations?.claims,
    ) &&
    declarations.claims.length
  ) {
    return true
  }

  const nutrition =
    declarations?.nutrition

  return Boolean(
    nutrition &&
      (
        nutrition.basis ||
        nutrition.servingSize ||
        (
          Array.isArray(
            nutrition.nutrients,
          ) &&
          nutrition.nutrients.length
        )
      ),
  )
}

function extractedFields(
  data,
) {
  return {
    displayName:
      field(
        data
          .productName
          .value,
        data
          .productName
          .confidence,
        'ai_extraction',
      ),

    brandName:
      field(
        data
          .brandName
          .value,
        data
          .brandName
          .confidence,
        'ai_extraction',
      ),

    gtin:
      field(
        barcode(
          data
            .barcode
            .value,
        ),
        data
          .barcode
          .confidence,
        'ai_extraction',
      ),

    netQuantity:
      field(
        {
          value:
            data
              .netQuantity
              .value,

          unit:
            data
              .netQuantity
              .unit ===
            'unknown'
              ? null
              : data
                  .netQuantity
                  .unit,

          rawText:
            data
              .netQuantity
              .rawText,
        },

        data
          .netQuantity
          .confidence,

        'ai_extraction',
      ),

    ingredientDeclarationText:
      field(
        data
          .ingredientDeclaration
          .text,

        data
          .ingredientDeclaration
          .confidence,

        'ai_extraction',

        true,
      ),

    allergens:
      field(
        {
          statement:
            data
              .allergenStatement
              .text,

          items:
            data
              .allergenStatement
              .allergens,
        },

        data
          .allergenStatement
          .confidence,

        'ai_extraction',

        true,
      ),

    nutrition:
      field(
        {
          basis:
            data
              .nutrition
              .basis ===
            'unknown'
              ? null
              : data
                  .nutrition
                  .basis,

          servingSize:
            data
              .nutrition
              .servingSize,

          nutrients:
            data
              .nutrition
              .nutrients,
        },

        data
          .nutrition
          .confidence,

        'ai_extraction',

        true,
      ),

    claims:
      field(
        data.claims,
        average(
          data.claims,
        ),
        'ai_extraction',
      ),

    certifications:
      field(
        data.certifications,
        average(
          data.certifications,
        ),
        'ai_extraction',
      ),

    manufacturerName:
      field(
        data
          .manufacturerName
          .value,
        data
          .manufacturerName
          .confidence,
        'ai_extraction',
      ),

    countryOfOrigin:
      field(
        data
          .countryOfOrigin
          .value,
        data
          .countryOfOrigin
          .confidence,
        'ai_extraction',
      ),
  }
}

function mergeHints(
  fields,
  hints = {},
) {
  const result = {
    ...fields,
  }

  const mappings = [
    [
      'displayName',
      clean(
        hints.title,
      ),
    ],
    [
      'brandName',
      clean(
        hints.brandName,
      ),
    ],
    [
      'gtin',
      barcode(
        hints.barcode,
      ),
    ],
  ]

  for (
    const [
      key,
      hint,
    ] of mappings
  ) {
    if (
      hint &&
      !clean(
        result[
          key
        ]?.value,
      )
    ) {
      result[
        key
      ] =
        field(
          hint,
          1,
          'user_hint',
        )
    }
  }

  if (
    clean(
      hints.netQuantityText,
    ) &&
    !clean(
      result
        .netQuantity
        ?.value
        ?.rawText,
    )
  ) {
    result.netQuantity =
      field(
        {
          value:
            null,

          unit:
            null,

          rawText:
            clean(
              hints.netQuantityText,
            ),
        },

        1,

        'user_hint',
      )
  }

  return result
}

function confidenceSummary(
  fields,
) {
  return Object.fromEntries(
    Object
      .entries(
        fields ||
          {},
      )
      .map(
        ([
          key,
          value,
        ]) => [
          key,
          value
            ?.confidence ??
            null,
        ],
      ),
  )
}

function safetyFlags(
  fields,
  evidenceQuality,
) {
  const flags = []

  if (
    evidenceQuality !==
    'sufficient'
  ) {
    flags.push(
      'EVIDENCE_INCOMPLETE',
    )
  }

  for (
    const key of
      SAFETY_FIELDS
  ) {
    const item =
      fields?.[
        key
      ]

    if (
      !item
    ) {
      flags.push(
        `SAFETY_FIELD_MISSING:${key}`,
      )

      continue
    }

    if (
      !Number.isFinite(
        Number(
          item.confidence,
        ),
      ) ||
      Number(
        item.confidence,
      ) <
        0.98
    ) {
      flags.push(
        `SAFETY_FIELD_REVIEW_REQUIRED:${key}`,
      )
    }
  }

  return flags
}

function extractionPrompt(
  evidence,
  hints = {},
) {
  const purposes =
    evidence
      .map(
        (
          item,
        ) =>
          item.purpose,
      )
      .join(
        ', ',
      )

  return [
    'You are EPANTRY product-label extraction only.',

    'Return JSON only. Extract only facts visibly supported by the supplied package images.',

    'Never infer allergen absence, dietary safety, certifications, ingredients, nutrition, brand ownership or regulated claims from missing evidence.',

    'Unreadable or missing fields must use empty values and low confidence. Do not guess.',

    'All ingredient, allergen and nutrition results are provisional and require human review regardless of confidence.',

    'Use exactly these top-level keys: productName, brandName, barcode, netQuantity, ingredientDeclaration, allergenStatement, nutrition, claims, certifications, manufacturerName, countryOfOrigin, normalizedLabelText, evidenceQuality, missingEvidencePurposes.',

    'productName/brandName/barcode/manufacturerName/countryOfOrigin = {value, confidence}.',

    'netQuantity = {value, unit, rawText, confidence}; unit is g|kg|ml|l|piece|unknown.',

    'ingredientDeclaration = {text, confidence}.',

    'allergenStatement = {text, allergens:[{name, relationType}], confidence}; relationType is contains|may_contain|unknown.',

    'nutrition = {basis, servingSize, nutrients:[{name, amount, unit}], confidence}; basis is per_100g|per_100ml|per_serving|per_pack|unknown.',

    'claims/certifications = [{label, confidence}]. evidenceQuality = sufficient|partial|insufficient.',

    `Evidence purposes: ${
      purposes ||
      'unknown'
    }.`,

    hints.title
      ? `User title hint only: ${clean(
          hints.title,
        )}`
      : '',

    hints.brandName
      ? `User brand hint only: ${clean(
          hints.brandName,
        )}`
      : '',

    hints.barcode
      ? `User barcode hint only: ${barcode(
          hints.barcode,
        )}`
      : '',
  ]
    .filter(
      Boolean,
    )
    .join(
      '\n',
    )
}

async function runExtraction(
  evidence,
  hints,
) {
  if (
    !isOpenRouterConfigured(
      'copilot',
    )
  ) {
    const error =
      new Error(
        'AI label extraction is not configured.',
      )

    error.code =
      'OPENROUTER_NOT_CONFIGURED'

    throw error
  }

  const content = [
    {
      type:
        'text',

      text:
        extractionPrompt(
          evidence,
          hints,
        ),
    },
  ]

  for (
    const item of
      evidence
  ) {
    content.push({
      type:
        'image_url',

      image_url: {
        url:
          buildSignedProductEvidenceUrl({
            publicId:
              item.publicId,

            version:
              item.version,

            format:
              item.format,
          }),
      },
    })
  }

  const response =
    await createOpenRouterChatCompletion({
      task:
        'copilot',

      messages: [
        {
          role:
            'user',

          content,
        },
      ],

      responseFormat: {
        type:
          'json_object',
      },

      temperature:
        0,

      maxTokens:
        1800,
    })

  if (
    typeof response
      .message?.content !==
    'string'
  ) {
    const error =
      new Error(
        'AI extraction returned a non-JSON content payload.',
      )

    error.code =
      'NPI_AI_INVALID_CONTENT'

    throw error
  }

  let parsed

  try {
    parsed =
      JSON.parse(
        response
          .message
          .content,
      )
  } catch {
    const error =
      new Error(
        'AI extraction returned invalid JSON.',
      )

    error.code =
      'NPI_AI_INVALID_JSON'

    throw error
  }

  const validated =
    extractionSchema.safeParse(
      parsed,
    )

  if (
    !validated.success
  ) {
    const error =
      new Error(
        'AI extraction response did not match the required schema.',
      )

    error.code =
      'NPI_AI_SCHEMA_INVALID'

    error.issues =
      validated
        .error
        .issues

    throw error
  }

  return {
    extraction:
      validated.data,

    modelId:
      response.modelId ||
      '',
  }
}

async function registerEvidence(
  assets,
  actorUser,
  organizationId =
    null,
) {
  const userId =
    actorId(
      actorUser,
    )

  const records = []

  for (
    const asset of
      assets
  ) {
    let verified

    try {
      verified =
        await verifyProductEvidenceUploadResult({
          userId,

          ...asset,
        })
    } catch (error) {
      throw new ApiError(
        400,
        error.message ||
          'Product evidence upload could not be verified.',
        [
          {
            code:
              error.code ||
              'PRODUCT_EVIDENCE_UPLOAD_INVALID',
          },
        ],
      )
    }

    const existing =
      await ImageEvidence.findOne({
        provider:
          'cloudinary',

        publicId:
          verified.publicId,

        version:
          verified.version,
      })

    if (
      existing
    ) {
      if (
        id(
          existing.ownerUserId,
        ) !==
          id(
            userId,
          ) ||
        id(
          existing.organizationId,
        ) !==
          id(
            organizationId,
          ) ||
        existing.purpose !==
          asset.purpose ||
        existing.status !==
          'active'
      ) {
        throw new ApiError(
          409,
          'Product evidence asset cannot be reused across identity or organization scopes.',
          [
            {
              code:
                'PRODUCT_EVIDENCE_SCOPE_REUSE_FORBIDDEN',
            },
          ],
        )
      }

      records.push(
        existing,
      )

      continue
    }

    records.push(
      await ImageEvidence.create({
        ownerUserId:
          userId,

        organizationId,

        purpose:
          asset.purpose,

        provider:
          'cloudinary',

        providerAssetId:
          verified.providerAssetId ||
          clean(
            asset.providerAssetId,
          ),

        publicId:
          verified.publicId,

        version:
          verified.version,

        format:
          verified.format,

        mimeType:
          verified.mimeType,

        bytes:
          verified.bytes,

        width:
          verified.width ||
          asset.width ||
          null,

        height:
          verified.height ||
          asset.height ||
          null,

        deliveryType:
          'authenticated',

        uploadSignatureVerified:
          true,

        sha256:
          clean(
            asset.sha256,
          ).toLowerCase(),

        status:
          'active',

        capturedAt:
          new Date(),

        retentionUntil:
          retentionUntil(),
      }),
    )
  }

  return records
}

async function duplicateByGtin(
  value,
) {
  const gtin =
    barcode(
      value,
    )

  if (
    !/^\d{8,14}$/.test(
      gtin,
    )
  ) {
    return null
  }

  return ProductVersion
    .findOne({
      gtin,

      publicationStatus:
        'published',
    })
    .sort({
      version:
        -1,
    })
    .select(
      '_id packId version displayName gtin effectiveFrom effectiveTo',
    )
    .lean()
}

function serializeEvidence(
  value,
  includeReadUrl =
    false,
) {
  const result = {
    id:
      id(
        value?._id,
      ),

    purpose:
      value?.purpose,

    mimeType:
      value?.mimeType,

    bytes:
      value?.bytes,

    width:
      value?.width ||
      null,

    height:
      value?.height ||
      null,

    status:
      value?.status,

    capturedAt:
      value?.capturedAt ||
      null,

    retentionUntil:
      value?.retentionUntil ||
      null,
  }

  if (
    includeReadUrl &&
    value?.status ===
      'active'
  ) {
    result.readUrl =
      buildSignedProductEvidenceUrl({
        publicId:
          value.publicId,

        version:
          value.version,

        format:
          value.format,
      })
  }

  return result
}

export function serializeCommunityProductDraft(
  value,
  options = {},
) {
  if (
    !value
  ) {
    return null
  }

  const item =
    typeof value.toObject ===
    'function'
      ? value.toObject()
      : value

  const result = {
    id:
      id(
        item._id ||
        item.id,
      ),

    origin:
      item.origin,

    listingType:
      item.listingType ||
      'packaged',

    market:
      item.market,

    barcode:
      item.barcode ||
      '',

    status:
      item.status,

    verificationStatus:
      item.verificationStatus,

    brandAuthorityVerified:
      Boolean(
        item.brandAuthorityVerified,
      ),

    canonicalBrandId:
      id(
        item.canonicalBrandId,
      ),

    duplicateCandidateProductVersionId:
      id(
        item
          .duplicateCandidateProductVersionId,
      ),

    safetyReviewRequired:
      Boolean(
        item.safetyReviewRequired,
      ),

    readyForCatalog:
      Boolean(
        item.readyForCatalog,
      ),

    catalogPackId:
      id(
        item.catalogPackId,
      ),

    catalogProductVersionId:
      id(
        item.catalogProductVersionId,
      ),

    catalogHandoffAt:
      item.catalogHandoffAt ||
      null,

    catalogHandoffByUserId:
      id(
        item.catalogHandoffByUserId,
      ),

    bulkBatchId:
      id(
        item.bulkBatchId,
      ),

    bulkRowNumber:
      item.bulkRowNumber ||
      null,

    merchantSku:
      item.merchantSku ||
      '',

    commercialDraft:
      item.commercialDraft ||
      null,

    commercializationStatus:
      item.commercializationStatus ||
      'not_requested',

    commercializationError:
      item.commercializationError ||
      '',

    commercializationAttemptedAt:
      item.commercializationAttemptedAt ||
      null,

    commercializedAt:
      item.commercializedAt ||
      null,

    catalogPublishedAt:
      item.catalogPublishedAt ||
      null,

    marketplaceOfferId:
      id(
        item.marketplaceOfferId,
      ),

    marketplacePriceRuleId:
      id(
        item.marketplacePriceRuleId,
      ),

    marketplaceInventoryNodeId:
      id(
        item.marketplaceInventoryNodeId,
      ),

    marketplaceInventorySnapshotId:
      id(
        item.marketplaceInventorySnapshotId,
      ),

    marketplaceServiceAreaId:
      id(
        item.marketplaceServiceAreaId,
      ),

    reviewSummary:
      item.reviewSummary ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }

  if (
    options.includeCandidateFields !==
    false
  ) {
    result.candidateFields =
      item.candidateFields ||
      {}
  }

  if (
    options.includeExternalEvidence
  ) {
    result.externalEvidence =
      item.externalEvidence ||
      null
  }

  return result
}

export function createUniversalProductEvidenceUploadIntent({
  purpose,
  actorUser,
}) {
  try {
    return createProductEvidenceUploadIntent({
      userId:
        actorId(
          actorUser,
        ),

      purpose,
    })
  } catch (error) {
    throw new ApiError(
      503,
      'Product evidence upload is temporarily unavailable.',
      [
        {
          code:
            error.code ||
            'PRODUCT_EVIDENCE_PROVIDER_UNAVAILABLE',
        },
      ],
    )
  }
}

export async function createExternalProductDraftFromOpenFoodFacts({
  externalResult,
  actorUser,
  market:
    marketCode,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const candidate =
    externalResult
      ?.candidate ||
    {}

  const gtin =
    barcode(
      candidate.barcode,
    )

  const normalizedMarket =
    market(
      marketCode,
    )

  const score =
    externalResult
      ?.confidence ??
    0.65

  const existing =
    await CommunityProductDraft
      .findOne({
        origin:
          'open_food_facts',

        createdByUserId:
          userId,

        barcode:
          gtin,

        market:
          normalizedMarket,

        status: {
          $in: [
            'provisional',
            'ready_for_review',
            'needs_more_evidence',
          ],
        },
      })
      .sort({
        createdAt:
          -1,
      })

  if (
    existing
  ) {
    return existing
  }

  const candidateFields = {
    displayName:
      field(
        candidate.title ||
          '',
        score,
        'external_database',
      ),

    brandName:
      field(
        candidate.brandName ||
          '',
        score,
        'external_database',
      ),

    gtin:
      field(
        gtin,
        1,
        'external_database',
      ),

    netQuantity:
      field(
        {
          value:
            null,

          unit:
            null,

          rawText:
            candidate.netQuantityText ||
            '',
        },
        score,
        'external_database',
      ),

    ingredientDeclarationText:
      field(
        candidate
          .ingredientDeclarationText ||
          '',
        score,
        'external_database',
        true,
      ),

    allergens:
      field(
        {
          statement:
            candidate.allergenText ||
            '',

          items:
            (
              candidate.allergenTags ||
              []
            ).map(
              (
                name,
              ) => ({
                name,

                relationType:
                  'unknown',
              }),
            ),

          traces:
            candidate.traceTags ||
            [],
        },
        score,
        'external_database',
        true,
      ),

    nutrition:
      field(
        {
          basis:
            candidate.nutritionBasis ||
            null,

          servingSize:
            null,

          nutrients:
            candidate.nutrition ||
            [],
        },
        score,
        'external_database',
        true,
      ),

    manufacturerName:
      field(
        candidate.manufacturingPlaces ||
          '',
        score,
        'external_database',
      ),

    countryOfOrigin:
      field(
        candidate.originText ||
          '',
        score,
        'external_database',
      ),
  }

  return CommunityProductDraft.create({
    origin:
      'open_food_facts',

    createdByUserId:
      userId,

    market:
      normalizedMarket,

    barcode:
      gtin,

    status:
      'provisional',

    verificationStatus:
      'unverified',

    candidateFields,

    externalEvidence: {
      provider:
        externalResult
          .source
          ?.provider ||
        'open_food_facts',

      sourceName:
        externalResult
          .source
          ?.sourceName ||
        'Open Food Facts',

      sourceUri:
        externalResult
          .source
          ?.sourceUri ||
        '',

      externalReference:
        externalResult
          .source
          ?.externalReference ||
        gtin,

      capturedAt:
        externalResult
          .source
          ?.capturedAt ||
        new Date(),

      referenceImages:
        candidate.referenceImages ||
        {},
    },

    safetyReviewRequired:
      true,

    readyForCatalog:
      false,
  })
}

async function hostAuthority({
  actorUser,
  market:
    marketCode,
  brandId,
  authorityGrantId,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  if (
    !brandId &&
    !authorityGrantId
  ) {
    return {
      organization,

      authority:
        null,
    }
  }

  if (
    !brandId ||
    !authorityGrantId
  ) {
    throw new ApiError(
      400,
      'Canonical Brand linkage requires an explicit verified Brand authority grant.',
      [
        {
          code:
            'NPI_BRAND_AUTHORITY_PAIR_REQUIRED',
        },
      ],
    )
  }

  const now =
    new Date()

  const authority =
    await BrandAuthorityGrant
      .findOne({
        _id:
          authorityGrantId,

        organizationId:
          organization._id,

        brandId,

        status:
          'active',

        marketCodes:
          market(
            marketCode,
          ),

        validFrom: {
          $lte:
            now,
        },

        $or: [
          {
            validUntil:
              null,
          },
          {
            validUntil: {
              $gt:
                now,
            },
          },
        ],
      })
      .lean()

  if (
    !authority
  ) {
    throw new ApiError(
      403,
      'Verified Brand authority was not found for this Host organization and market.',
      [
        {
          code:
            'NPI_BRAND_AUTHORITY_REQUIRED',
        },
      ],
    )
  }

  return {
    organization,

    authority,
  }
}

async function loadAppendTarget({
  draftId,
  userId,
  initiatorType,
  organizationId,
}) {
  if (
    !draftId
  ) {
    return null
  }

  const filter = {
    _id:
      draftId,
  }

  if (
    initiatorType ===
    'host'
  ) {
    filter.organizationId =
      organizationId
  } else {
    filter.createdByUserId =
      userId
  }

  const draft =
    await CommunityProductDraft.findOne(
      filter,
    )

  if (
    !draft
  ) {
    throw new ApiError(
      404,
      'Provisional product draft was not found for this identity scope.',
      [
        {
          code:
            initiatorType ===
            'host'
              ? 'HOST_NPI_DRAFT_NOT_FOUND'
              : 'UNIVERSAL_PRODUCT_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    [
      'approved_for_catalog',
      'rejected',
    ].includes(
      draft.status,
    )
  ) {
    throw new ApiError(
      409,
      'Evidence cannot be appended to a draft with a terminal review decision.',
      [
        {
          code:
            'NPI_DRAFT_ALREADY_FINAL',
        },
      ],
    )
  }

  return draft
}

function meaningfulValue(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return false
  }

  if (
    typeof value ===
    'string'
  ) {
    return Boolean(
      clean(
        value,
      ),
    )
  }

  if (
    typeof value ===
    'number'
  ) {
    return Number.isFinite(
      value,
    )
  }

  if (
    typeof value ===
    'boolean'
  ) {
    return true
  }

  if (
    Array.isArray(
      value,
    )
  ) {
    return value.some(
      meaningfulValue,
    )
  }

  if (
    typeof value ===
    'object'
  ) {
    return Object
      .values(
        value,
      )
      .some(
        meaningfulValue,
      )
  }

  return false
}

function mergeCandidateEvidence(
  existingFields,
  nextFields,
) {
  const result = {
    ...(
      existingFields ||
      {}
    ),
  }

  for (
    const [
      key,
      next,
    ] of Object.entries(
      nextFields ||
      {},
    )
  ) {
    if (
      result[
        key
      ]?.source ===
        'host_manual' &&
      next?.source !==
        'host_manual'
    ) {
      continue
    }

    if (
      !result[
        key
      ] ||
      meaningfulValue(
        next?.value,
      )
    ) {
      result[
        key
      ] =
        next
    }
  }

  return result
}

async function createFromImages({
  assets,
  market:
    marketCode,
  hints,
  hostDeclarations = {},
  listingType =
    null,
  draftId =
    null,
  actorUser,
  initiatorType,
  origin,
  organizationId =
    null,
  canonicalBrandId =
    null,
  authorityGrantId =
    null,
  brandAuthorityVerified =
    false,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const existingDraft =
    await loadAppendTarget({
      draftId,

      userId,

      initiatorType,

      organizationId,
    })

  const requestedListingType =
    listingType ||
    'packaged'

  const effectiveListingType =
    existingDraft?.listingType ||
    requestedListingType

  if (
    existingDraft &&
    listingType &&
    existingDraft.listingType !==
      listingType
  ) {
    throw new ApiError(
      409,
      'The listing type cannot be changed for an existing NPI draft.',
      [
        {
          code:
            'NPI_LISTING_TYPE_MISMATCH',
        },
      ],
    )
  }

  const manualSource =
    initiatorType ===
      'admin'
      ? 'admin_manual'
      : 'host_manual'

  if (
    existingDraft &&
    initiatorType ===
      'host' &&
    canonicalBrandId &&
    existingDraft
      .canonicalBrandId &&
    id(
      existingDraft
        .canonicalBrandId,
    ) !==
      id(
        canonicalBrandId,
      )
  ) {
    throw new ApiError(
      409,
      'The supplied Brand authority does not match the existing Host NPI draft.',
      [
        {
          code:
            'HOST_NPI_BRAND_AUTHORITY_MISMATCH',
        },
      ],
    )
  }

  const assetList =
    Array.isArray(
      assets,
    )
      ? assets
      : []

  if (
    !existingDraft &&
    !assetList.length
  ) {
    throw new ApiError(
      400,
      'At least one product evidence image is required for a new NPI draft.',
      [
        {
          code:
            'NPI_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  const newEvidence =
    assetList.length
      ? await registerEvidence(
          assetList,
          actorUser,
          organizationId,
        )
      : []

  let draft =
    existingDraft

  if (
    draft
  ) {
    const evidenceIds =
      new Set(
        (
          draft.sourceEvidenceIds ||
          []
        )
          .map(
            id,
          )
          .filter(
            Boolean,
          ),
      )

    for (
      const item of
        newEvidence
    ) {
      evidenceIds.add(
        id(
          item._id,
        ),
      )
    }

    draft.sourceEvidenceIds = [
      ...evidenceIds,
    ]

    draft.verificationStatus =
      draft.verificationStatus ===
      'reviewed'
        ? 'reviewed'
        : 'provisional'

    if (
      Object.keys(
        hints ||
          {},
      ).length
    ) {
      draft.candidateFields =
        mergeHostDeclarations(
          mergeHints(
            draft.candidateFields ||
              {},
            hints,
          ),
          hostDeclarations,
          manualSource,
        )

      if (
        hints?.barcode
      ) {
        draft.barcode =
          barcode(
            hints.barcode,
          )
      }
    }

    await draft.save()
  } else {
    draft =
      await CommunityProductDraft.create({
        origin,

        listingType:
          effectiveListingType,

        createdByUserId:
          userId,

        organizationId,

        canonicalBrandId,

        authorityGrantId,

        brandAuthorityVerified,

        market:
          market(
            marketCode,
          ),

        barcode:
          barcode(
            hints?.barcode,
          ),

        status:
          'provisional',

        verificationStatus:
          'unverified',

        candidateFields:
          mergeHostDeclarations(
            mergeHints(
              {},
              hints,
            ),
            hostDeclarations,
            manualSource,
          ),

        sourceEvidenceIds:
          newEvidence.map(
            (
              item,
            ) =>
              item._id,
          ),

        safetyReviewRequired:
          true,

        readyForCatalog:
          false,
      })
  }

  const evidence =
    await ImageEvidence
      .find({
        _id: {
          $in:
            draft.sourceEvidenceIds ||
            [],
        },

        status:
          'active',
      })
      .sort({
        createdAt:
          1,
      })
      .lean()

  if (
    !evidence.length
  ) {
    throw new ApiError(
      409,
      'No active product evidence is available for this NPI draft.',
      [
        {
          code:
            'NPI_ACTIVE_EVIDENCE_REQUIRED',
        },
      ],
    )
  }

  try {
    await ensureMediaPrivacyClearanceForEvidenceBatch({
      evidence,

      actorUserId:
        userId,

      organizationId,
    })
  } catch (error) {
    const privacyHold =
      error?.statusCode ===
        409 &&
      Array.isArray(
        error?.errors,
      ) &&
      error.errors.some(
        (item) =>
          item?.code ===
          'MEDIA_PRIVACY_CLEARANCE_REQUIRED',
      )

    if (
      privacyHold
    ) {
      draft.status =
        'needs_more_evidence'

      draft.verificationStatus =
        draft.verificationStatus ===
        'reviewed'
          ? 'reviewed'
          : 'provisional'

      draft.reviewSummary =
        effectiveListingType ===
          'packaged'
          ? 'Product evidence is stored, but privacy clearance is required before label extraction can continue. Resolve the M24 review, then resume extraction from this draft.'
          : 'Product photo evidence is stored, but privacy clearance is required before the fresh-produce draft can enter governed review. Resolve the M24 review, then resume this draft.'

      await draft.save()
    }

    throw error
  }

  if (
    effectiveListingType !==
    'packaged'
  ) {
    const now =
      new Date()

    draft.status =
      'ready_for_review'

    draft.verificationStatus =
      draft.verificationStatus ===
      'reviewed'
        ? 'reviewed'
        : 'provisional'

    draft.safetyReviewRequired =
      true

    draft.readyForCatalog =
      false

    draft.reviewSummary =
      effectiveListingType ===
        'vegetable'
        ? 'Vegetable photo evidence and declared product/nutrition details are ready for governed human review before catalog handoff.'
        : 'Fruit photo evidence and declared product/nutrition details are ready for governed human review before catalog handoff.'

    await draft.save()

    await NPIJob.create({
      draftId:
        draft._id,

      initiatorType,

      requestedByUserId:
        userId,

      organizationId,

      status:
        'ready_for_review',

      providerTask:
        'manual_produce_submission',

      startedAt:
        now,

      completedAt:
        now,
    })

    return {
      state:
        'provisional_review_required',

      draft:
        serializeCommunityProductDraft(
          draft,
        ),

      evidence:
        evidence.map(
          (
            item,
          ) =>
            serializeEvidence(
              item,
            ),
        ),

      extraction: {
        status:
          'not_required',
      },

      duplicateCandidate:
        null,

      nextAction:
        'await_human_review',
    }
  }

  draft.status =
    'extracting'

  draft.verificationStatus =
    draft.verificationStatus ===
    'reviewed'
      ? 'reviewed'
      : 'provisional'

  draft.reviewSummary =
    ''

  await draft.save()

  const job =
    await NPIJob.create({
      draftId:
        draft._id,

      initiatorType,

      requestedByUserId:
        userId,

      organizationId,

      status:
        'extracting',

      providerTask:
        'openrouter_label_extraction',

      startedAt:
        new Date(),
    })

  let result

  try {
    result =
      await runExtraction(
        evidence,
        hints,
      )
  } catch (error) {
    await LabelExtraction.create({
      npiJobId:
        job._id,

      draftId:
        draft._id,

      imageEvidenceIds:
        evidence.map(
          (
            item,
          ) =>
            item._id,
        ),

      provider:
        'openrouter',

      parserVersion:
        PARSER_VERSION,

      status:
        'failed',

      safetyFlags: [
        'AI_EXTRACTION_UNAVAILABLE',
      ],

      failureCode:
        error.code ||
        'NPI_AI_EXTRACTION_FAILED',
    })

    const manualReviewReady =
      [
        'host',
        'admin',
      ].includes(
        initiatorType,
      ) &&
      hasHostManualDeclarations(
        hostDeclarations,
      )

    draft.status =
      manualReviewReady
        ? 'ready_for_review'
        : 'needs_more_evidence'

    draft.reviewSummary =
      manualReviewReady
        ? 'Manually declared product details were saved. Automated label extraction was unavailable, so every field still requires governed human review before catalog handoff.'
        : 'Image evidence was stored safely, but automated label extraction was unavailable. Manual review or another extraction attempt is required.'

    await draft.save()

    job.status =
      manualReviewReady
        ? 'ready_for_review'
        : 'needs_more_evidence'

    job.completedAt =
      new Date()

    job.failureCode =
      error.code ||
      'NPI_AI_EXTRACTION_FAILED'

    await job.save()

    return {
      state:
        manualReviewReady
          ? 'provisional_review_required'
          : 'provisional_unverified',

      draft:
        serializeCommunityProductDraft(
          draft,
        ),

      evidence:
        evidence.map(
          (
            item,
          ) =>
            serializeEvidence(
              item,
            ),
        ),

      extraction: {
        status:
          'failed',

        reasonCode:
          job.failureCode,
      },

      nextAction:
        manualReviewReady
          ? 'await_human_review'
          : 'manual_review_or_add_better_evidence',
    }
  }

  const extracted =
    extractedFields(
      result.extraction,
    )

  const fields =
    mergeHostDeclarations(
      mergeHints(
        mergeCandidateEvidence(
          draft.candidateFields,
          extracted,
        ),
        hints,
      ),
      hostDeclarations,
      manualSource,
    )

  const duplicate =
    await duplicateByGtin(
      fields.gtin?.value,
    )

  const flags =
    safetyFlags(
      fields,
      result
        .extraction
        .evidenceQuality,
    )

  const extraction =
    await LabelExtraction.create({
      npiJobId:
        job._id,

      draftId:
        draft._id,

      imageEvidenceIds:
        evidence.map(
          (
            item,
          ) =>
            item._id,
        ),

      provider:
        'openrouter',

      modelId:
        result.modelId,

      parserVersion:
        PARSER_VERSION,

      status:
        'succeeded',

      candidateFields:
        fields,

      confidenceSummary:
        confidenceSummary(
          fields,
        ),

      safetyFlags:
        flags,

      normalizedLabelText:
        result
          .extraction
          .normalizedLabelText,
    })

  draft.barcode =
    barcode(
      fields.gtin?.value,
    )

  draft.status =
    result
      .extraction
      .evidenceQuality ===
    'insufficient'
      ? 'needs_more_evidence'
      : 'ready_for_review'

  draft.verificationStatus =
    'provisional'

  draft.candidateFields =
    fields

  draft.latestExtractionId =
    extraction._id

  draft.duplicateCandidateProductVersionId =
    duplicate?._id ||
    null

  draft.safetyReviewRequired =
    true

  draft.readyForCatalog =
    false

  draft.reviewSummary =
    duplicate
      ? 'A published product with the same extracted GTIN already exists. Review as evidence update, historical pack, or duplicate before creating anything new.'
      : 'AI-assisted fields are provisional. Ingredients, allergens and nutrition require human review before canonical use.'

  await draft.save()

  job.status =
    draft.status ===
    'needs_more_evidence'
      ? 'needs_more_evidence'
      : 'ready_for_review'

  job.completedAt =
    new Date()

  job.failureCode =
    ''

  await job.save()

  return {
    state:
      draft.status ===
      'needs_more_evidence'
        ? 'provisional_needs_more_evidence'
        : 'provisional_review_required',

    draft:
      serializeCommunityProductDraft(
        draft,
      ),

    evidence:
      evidence.map(
        (
          item,
        ) =>
          serializeEvidence(
            item,
          ),
      ),

    extraction: {
      status:
        'succeeded',

      modelId:
        result.modelId ||
        null,

      parserVersion:
        PARSER_VERSION,

      evidenceQuality:
        result
          .extraction
          .evidenceQuality,

      missingEvidencePurposes:
        result
          .extraction
          .missingEvidencePurposes,

      safetyFlags:
        flags,
    },

    duplicateCandidate:
      duplicate
        ? {
            productVersionId:
              id(
                duplicate._id,
              ),

            displayName:
              duplicate.displayName,

            gtin:
              duplicate.gtin,

            version:
              duplicate.version,
          }
        : null,

    nextAction:
      duplicate
        ? 'review_existing_product_candidate'
        : draft.status ===
            'needs_more_evidence'
          ? 'capture_missing_label_evidence'
          : 'await_human_review',
  }
}

export async function resolveUniversalProductImage(
  input,
) {
  return createFromImages({
    ...input,

    initiatorType:
      'customer',

    origin:
      'customer_scan',
  })
}

export function serializeNpiBulkBatch(
  value,
) {
  if (
    !value
  ) {
    return null
  }

  const item =
    typeof value.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id ||
        item.id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    createdByUserId:
      id(
        item.createdByUserId,
      ),

    listingType:
      item.listingType,

    market:
      item.market ||
      'IN',

    sourceFileName:
      item.sourceFileName ||
      '',

    status:
      item.status,

    sourceRowCount:
      Number(
        item.sourceRowCount ||
        0,
      ),

    submittedRowCount:
      Number(
        item.submittedRowCount ||
        0,
      ),

    reviewReadyCount:
      Number(
        item.reviewReadyCount ||
        0,
      ),

    issueCount:
      Number(
        item.issueCount ||
        0,
      ),

    duplicateCount:
      Number(
        item.duplicateCount ||
        0,
      ),

    draftIds:
      (
        item.draftIds ||
        []
      ).map(
        id,
      ),

    validationIssues:
      item.validationIssues ||
      [],

    submittedAt:
      item.submittedAt ||
      null,

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

export async function createHostBulkNpiBatch({
  listingType,
  market:
    marketCode =
      'IN',
  sourceFileName =
    '',
  sourceRowCount =
    0,
  issueCount =
    0,
  validationIssues =
    [],
  rows =
    [],
  actorUser,
}) {
  const {
    organization,
  } =
    await hostAuthority({
      actorUser,
      market:
        marketCode,
    })

  const userId =
    actorId(
      actorUser,
    )

  const normalizedMarket =
    market(
      marketCode,
    )

  const batch =
    await NpiBulkBatch.create({
      organizationId:
        organization._id,

      createdByUserId:
        userId,

      listingType,

      market:
        normalizedMarket,

      sourceFileName:
        clean(
          sourceFileName,
        ),

      sourceRowCount:
        Number(
          sourceRowCount ||
          rows.length,
        ),

      issueCount:
        Number(
          issueCount ||
          0,
        ),

      validationIssues:
        validationIssues ||
        [],

      status:
        'submitted',

      submittedAt:
        new Date(),
    })

  const merchantSkus =
    new Set()

  const createdDrafts =
    []

  let reviewReadyCount =
    0

  let duplicateCount =
    0

  try {
    for (
      const row of
        rows
    ) {
      const merchantSku =
        clean(
          row?.merchantSku,
        )

      const skuKey =
        merchantSku
          .toLowerCase()

      if (
        merchantSkus.has(
          skuKey,
        )
      ) {
        throw new ApiError(
          409,
          `Merchant SKU ${merchantSku} appears more than once in this bulk batch.`,
          [
            {
              code:
                'HOST_BULK_NPI_DUPLICATE_MERCHANT_SKU',
            },
          ],
        )
      }

      merchantSkus.add(
        skuKey,
      )

      const evidence =
        await registerEvidence(
          row.assets ||
          [],
          actorUser,
          organization._id,
        )

      const fields =
        mergeHostDeclarations(
          mergeHints(
            {},
            row.hints ||
            {},
          ),
          row.hostDeclarations ||
          {},
          'host_manual_bulk',
        )

      const duplicate =
        await duplicateByGtin(
          fields.gtin?.value ||
          row.hints?.barcode,
        )

      if (
        duplicate
      ) {
        duplicateCount +=
          1
      }

      let privacyHeld =
        false

      try {
        await ensureMediaPrivacyClearanceForEvidenceBatch({
          evidence,

          actorUserId:
            userId,

          organizationId:
            organization._id,
        })
      } catch (error) {
        const isPrivacyHold =
          error?.statusCode ===
            409 &&
          Array.isArray(
            error?.errors,
          ) &&
          error.errors.some(
            (item) =>
              item?.code ===
              'MEDIA_PRIVACY_CLEARANCE_REQUIRED',
          )

        if (
          !isPrivacyHold
        ) {
          throw error
        }

        privacyHeld =
          true
      }

      const draft =
        await CommunityProductDraft.create({
          origin:
            'host_npi',

          listingType,

          createdByUserId:
            userId,

          organizationId:
            organization._id,

          market:
            normalizedMarket,

          barcode:
            barcode(
              row.hints?.barcode,
            ),

          status:
            privacyHeld
              ? 'needs_more_evidence'
              : 'ready_for_review',

          verificationStatus:
            'provisional',

          candidateFields:
            fields,

          sourceEvidenceIds:
            evidence.map(
              (
                item,
              ) =>
                item._id,
            ),

          duplicateCandidateProductVersionId:
            duplicate?._id ||
            null,

          safetyReviewRequired:
            true,

          readyForCatalog:
            false,

          bulkBatchId:
            batch._id,

          bulkRowNumber:
            Number(
              row.rowNumber,
            ),

          merchantSku,

          commercialDraft:
            row.commercialDraft ||
            null,

          commercializationStatus:
            row.commercialDraft
              ?.activateAfterApproval ===
              false
              ? 'skipped'
              : 'pending',

          reviewSummary:
            privacyHeld
              ? 'Bulk NPI row was received, but its product image requires M24 privacy clearance before governed review.'
              : 'Bulk NPI row was created from Host-declared workbook data and product image evidence. Every field remains provisional until Super Admin review.',
        })

      if (
        !privacyHeld
      ) {
        reviewReadyCount +=
          1
      }

      createdDrafts.push(
        draft,
      )

      await NPIJob.create({
        draftId:
          draft._id,

        initiatorType:
          'host',

        requestedByUserId:
          userId,

        organizationId:
          organization._id,

        status:
          privacyHeld
            ? 'needs_more_evidence'
            : 'ready_for_review',

        providerTask:
          'manual_bulk_submission',

        startedAt:
          new Date(),

        completedAt:
          new Date(),
      })
    }

    batch.submittedRowCount =
      createdDrafts.length

    batch.reviewReadyCount =
      reviewReadyCount

    batch.duplicateCount =
      duplicateCount

    batch.draftIds =
      createdDrafts.map(
        (
          draft,
        ) =>
          draft._id,
      )

    batch.status =
      reviewReadyCount ===
        createdDrafts.length &&
      Number(
        issueCount ||
        0,
      ) ===
        0
        ? 'submitted'
        : 'needs_attention'

    await batch.save()

    return {
      batch:
        serializeNpiBulkBatch(
          batch,
        ),

      drafts:
        createdDrafts.map(
          (
            draft,
          ) =>
            serializeCommunityProductDraft(
              draft,
            ),
        ),
    }
  } catch (error) {
    if (
      !createdDrafts.length
    ) {
      await NpiBulkBatch.deleteOne({
        _id:
          batch._id,
      })
    } else {
      batch.submittedRowCount =
        createdDrafts.length

      batch.reviewReadyCount =
        reviewReadyCount

      batch.duplicateCount =
        duplicateCount

      batch.draftIds =
        createdDrafts.map(
          (
            draft,
          ) =>
            draft._id,
        )

      batch.status =
        'needs_attention'

      await batch.save()
    }

    throw error
  }
}

export async function listHostBulkNpiBatches({
  page =
    1,
  limit =
    25,
  actorUser,
}) {
  const {
    organization,
  } =
    await hostAuthority({
      actorUser,
      market:
        'IN',
    })

  const safePage =
    Math.max(
      1,
      Number(
        page,
      ) ||
      1,
    )

  const safeLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(
          limit,
        ) ||
        25,
      ),
    )

  const query = {
    organizationId:
      organization._id,
  }

  const [
    items,
    total,
  ] =
    await Promise.all([
      NpiBulkBatch
        .find(
          query,
        )
        .sort({
          createdAt:
            -1,
        })
        .skip(
          (
            safePage -
            1
          ) *
          safeLimit,
        )
        .limit(
          safeLimit,
        )
        .lean(),

      NpiBulkBatch.countDocuments(
        query,
      ),
    ])

  return {
    batches:
      items.map(
        serializeNpiBulkBatch,
      ),

    pagination: {
      page:
        safePage,

      limit:
        safeLimit,

      total,

      pages:
        Math.max(
          1,
          Math.ceil(
            total /
            safeLimit,
          ),
        ),
    },
  }
}


function bulkDraftReviewBlockers(
  draft,
) {
  const blockers = []

  if (
    draft.status !==
      'ready_for_review'
  ) {
    blockers.push(
      draft.status ===
        'needs_more_evidence'
        ? 'Needs additional evidence'
        : `Status is ${draft.status}`,
    )
  }

  if (
    draft.duplicateCandidateProductVersionId
  ) {
    blockers.push(
      'Potential canonical duplicate',
    )
  }

  if (
    !(
      draft.sourceEvidenceIds ||
      []
    ).length
  ) {
    blockers.push(
      'No product image evidence',
    )
  }

  if (
    draft.listingType ===
      'packaged'
  ) {
    const ingredientText =
      clean(
        draft.candidateFields
          ?.ingredientDeclarationText
          ?.value,
      )

    const nutrients =
      draft.candidateFields
        ?.nutrition
        ?.value
        ?.nutrients ||
      []

    if (
      !ingredientText
    ) {
      blockers.push(
        'Ingredients require individual review',
      )
    }

    if (
      !nutrients.length
    ) {
      blockers.push(
        'Nutrition requires individual review',
      )
    }
  }

  return blockers
}

function bulkBatchLiveSummary({
  batch,
  drafts = [],
}) {
  const counts = {
    totalDrafts:
      drafts.length,

    reviewReady:
      0,

    needsEvidence:
      0,

    approved:
      0,

    rejected:
      0,

    potentialDuplicates:
      0,

    bulkReviewEligible:
      0,

    live:
      0,

    commerceActionRequired:
      0,
  }

  for (
    const draft of
      drafts
  ) {
    if (
      draft.status ===
        'ready_for_review'
    ) {
      counts.reviewReady +=
        1
    } else if (
      draft.status ===
        'needs_more_evidence'
    ) {
      counts.needsEvidence +=
        1
    } else if (
      draft.status ===
        'approved_for_catalog'
    ) {
      counts.approved +=
        1
    } else if (
      draft.status ===
        'rejected'
    ) {
      counts.rejected +=
        1
    }

    if (
      draft.duplicateCandidateProductVersionId
    ) {
      counts.potentialDuplicates +=
        1
    }

    if (
      !bulkDraftReviewBlockers(
        draft,
      ).length
    ) {
      counts.bulkReviewEligible +=
        1
    }

    if (
      draft.commercializationStatus ===
        'live'
    ) {
      counts.live +=
        1
    } else if (
      draft.commercializationStatus ===
        'action_required'
    ) {
      counts.commerceActionRequired +=
        1
    }
  }

  const decided =
    counts.approved +
    counts.rejected

  let liveStatus =
    batch.status

  if (
    counts.totalDrafts >
      0 &&
    decided ===
      counts.totalDrafts
  ) {
    liveStatus =
      'completed'
  } else if (
    counts.approved >
      0 ||
    counts.rejected >
      0 ||
    counts.needsEvidence >
      0
  ) {
    liveStatus =
      'in_review'
  } else if (
    Number(
      batch.issueCount ||
      0,
    ) >
      0 ||
    counts.potentialDuplicates >
      0
  ) {
    liveStatus =
      'needs_attention'
  } else {
    liveStatus =
      'submitted'
  }

  return {
    ...counts,

    sourceRows:
      Number(
        batch.sourceRowCount ||
        0,
      ),

    submittedRows:
      Number(
        batch.submittedRowCount ||
        drafts.length,
      ),

    validationIssues:
      Number(
        batch.issueCount ||
        0,
      ),

    liveStatus,
  }
}

function adminBulkBatchItem({
  batch,
  organization,
  drafts,
}) {
  return {
    ...serializeNpiBulkBatch(
      batch,
    ),

    status:
      bulkBatchLiveSummary({
        batch,
        drafts,
      }).liveStatus,

    organization: {
      id:
        id(
          organization?._id ||
          batch.organizationId,
        ),

      displayName:
        organization?.displayName ||
        'Host organization',

      organizationType:
        organization?.organizationType ||
        null,

      status:
        organization?.status ||
        null,
    },

    review:
      bulkBatchLiveSummary({
        batch,
        drafts,
      }),
  }
}

async function loadBulkDraftsByBatchIds(
  batchIds,
) {
  if (
    !batchIds.length
  ) {
    return new Map()
  }

  const drafts =
    await CommunityProductDraft
      .find({
        bulkBatchId: {
          $in:
            batchIds,
        },
      })
      .sort({
        bulkBatchId:
          1,

        bulkRowNumber:
          1,
      })
      .lean()

  const map =
    new Map()

  for (
    const draft of
      drafts
  ) {
    const key =
      id(
        draft.bulkBatchId,
      )

    if (
      !map.has(
        key,
      )
    ) {
      map.set(
        key,
        [],
      )
    }

    map.get(
      key,
    ).push(
      draft,
    )
  }

  return map
}

export async function listAdminNpiBulkBatches({
  page =
    1,
  limit =
    25,
  listingType,
  search =
    '',
}) {
  const safePage =
    Math.max(
      1,
      Number(
        page,
      ) ||
      1,
    )

  const safeLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(
          limit,
        ) ||
        25,
      ),
    )

  const filter =
    {}

  if (
    listingType
  ) {
    filter.listingType =
      listingType
  }

  const searchValue =
    clean(
      search,
    )

  if (
    searchValue
  ) {
    const organizations =
      await MarketplaceOrganization
        .find({
          displayName: {
            $regex:
              searchValue.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&',
              ),

            $options:
              'i',
          },
        })
        .select({
          _id:
            1,
        })
        .lean()

    filter.$or = [
      {
        sourceFileName: {
          $regex:
            searchValue.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&',
            ),

          $options:
            'i',
        },
      },

      {
        organizationId: {
          $in:
            organizations.map(
              (
                item,
              ) =>
                item._id,
            ),
        },
      },
    ]
  }

  const [
    batches,
    total,
  ] =
    await Promise.all([
      NpiBulkBatch
        .find(
          filter,
        )
        .sort({
          createdAt:
            -1,
        })
        .skip(
          (
            safePage -
            1
          ) *
            safeLimit,
        )
        .limit(
          safeLimit,
        )
        .lean(),

      NpiBulkBatch.countDocuments(
        filter,
      ),
    ])

  const batchIds =
    batches.map(
      (
        item,
      ) =>
        item._id,
    )

  const organizationIds =
    [
      ...new Set(
        batches.map(
          (
            item,
          ) =>
            id(
              item.organizationId,
            ),
        ),
      ),
    ]
      .filter(
        Boolean,
      )

  const [
    draftMap,
    organizations,
  ] =
    await Promise.all([
      loadBulkDraftsByBatchIds(
        batchIds,
      ),

      MarketplaceOrganization
        .find({
          _id: {
            $in:
              organizationIds,
          },
        })
        .lean(),
    ])

  const organizationMap =
    new Map(
      organizations.map(
        (
          item,
        ) => [
          id(
            item._id,
          ),
          item,
        ],
      ),
    )

  const items =
    batches.map(
      (
        batch,
      ) =>
        adminBulkBatchItem({
          batch,
          organization:
            organizationMap.get(
              id(
                batch.organizationId,
              ),
            ),
          drafts:
            draftMap.get(
              id(
                batch._id,
              ),
            ) ||
            [],
        }),
    )

  const summary =
    items.reduce(
      (
        result,
        item,
      ) => ({
        batches:
          result.batches +
          1,

        submitted:
          result.submitted +
          item.review.submittedRows,

        reviewReady:
          result.reviewReady +
          item.review.reviewReady,

        issues:
          result.issues +
          item.review.validationIssues +
          item.review.needsEvidence,

        potentialDuplicates:
          result.potentialDuplicates +
          item.review.potentialDuplicates,

        approved:
          result.approved +
          item.review.approved,

        live:
          result.live +
          item.review.live,

        commerceActionRequired:
          result.commerceActionRequired +
          item.review.commerceActionRequired,
      }),
      {
        batches:
          0,

        submitted:
          0,

        reviewReady:
          0,

        issues:
          0,

        potentialDuplicates:
          0,

        approved:
          0,

        live:
          0,

        commerceActionRequired:
          0,
      },
    )

  return {
    batches:
      items,

    summary,

    pagination: {
      page:
        safePage,

      limit:
        safeLimit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                safeLimit,
            )
          : 0,
    },
  }
}

export async function getAdminNpiBulkBatch(
  batchId,
) {
  const batch =
    await NpiBulkBatch
      .findById(
        batchId,
      )
      .lean()

  if (
    !batch
  ) {
    throw new ApiError(
      404,
      'Bulk NPI batch was not found.',
      [
        {
          code:
            'NPI_BULK_BATCH_NOT_FOUND',
        },
      ],
    )
  }

  const [
    organization,
    drafts,
  ] =
    await Promise.all([
      MarketplaceOrganization
        .findById(
          batch.organizationId,
        )
        .lean(),

      CommunityProductDraft
        .find({
          bulkBatchId:
            batch._id,
        })
        .sort({
          bulkRowNumber:
            1,
        })
        .lean(),
    ])

  const serializedDrafts =
    drafts.map(
      (
        draft,
      ) => ({
        ...serializeCommunityProductDraft(
          draft,
        ),

        bulkReviewEligible:
          !bulkDraftReviewBlockers(
            draft,
          ).length,

        bulkReviewBlockers:
          bulkDraftReviewBlockers(
            draft,
          ),
      }),
    )

  return {
    batch:
      adminBulkBatchItem({
        batch,
        organization,
        drafts,
      }),

    drafts:
      serializedDrafts,

    validationIssues:
      batch.validationIssues ||
      [],
  }
}

function bulkAcceptFieldDecisions(
  draft,
) {
  return BULK_REVIEW_FIELD_PATHS
    .filter(
      (
        fieldPath,
      ) =>
        draft.candidateFields?.[
          fieldPath
        ],
    )
    .map(
      (
        fieldPath,
      ) => ({
        fieldPath,

        decision:
          'accepted',

        note:
          'Accepted through explicit Super Admin bulk review selection.',
      }),
    )
}

export async function reviewAdminNpiBulkSelection({
  batchId,
  draftIds,
  decision,
  reason,
  actorUser,
  adminAuthorization,
  auditPermissionKey,
  requestId,
}) {
  const batch =
    await NpiBulkBatch.findById(
      batchId,
    )

  if (
    !batch
  ) {
    throw new ApiError(
      404,
      'Bulk NPI batch was not found.',
      [
        {
          code:
            'NPI_BULK_BATCH_NOT_FOUND',
        },
      ],
    )
  }

  const uniqueDraftIds =
    [
      ...new Set(
        draftIds.map(
          String,
        ),
      ),
    ]

  const drafts =
    await CommunityProductDraft
      .find({
        _id: {
          $in:
            uniqueDraftIds,
        },

        bulkBatchId:
          batch._id,
      })

  const draftMap =
    new Map(
      drafts.map(
        (
          draft,
        ) => [
          id(
            draft._id,
          ),
          draft,
        ],
      ),
    )

  const processed =
    []

  const skipped =
    []

  for (
    const draftId of
      uniqueDraftIds
  ) {
    const draft =
      draftMap.get(
        draftId,
      )

    if (
      !draft
    ) {
      skipped.push({
        draftId,
        reason:
          'Draft is not part of this batch.',
      })

      continue
    }

    if (
      [
        'approved_for_catalog',
        'rejected',
      ].includes(
        draft.status,
      )
    ) {
      skipped.push({
        draftId,
        reason:
          'Draft already has a terminal review decision.',
      })

      continue
    }

    if (
      decision ===
        'approve_for_catalog'
    ) {
      const blockers =
        bulkDraftReviewBlockers(
          draft,
        )

      if (
        blockers.length
      ) {
        skipped.push({
          draftId,
          reason:
            blockers.join(
              '; ',
            ),
        })

        continue
      }
    }

    const result =
      await reviewNpiDraft({
        draftId,
        decision,
        fieldDecisions:
          decision ===
            'approve_for_catalog'
            ? bulkAcceptFieldDecisions(
                draft,
              )
            : [],
        reason,
        actorUser,
        adminAuthorization,
        auditPermissionKey,
        requestId,
      })

    processed.push({
      draftId,
      status:
        result.draft?.status ||
        null,

      commercializationStatus:
        result.draft
          ?.commercializationStatus ||
        null,

      commercialization:
        result.commercialization ||
        null,
    })
  }

  const refreshed =
    await getAdminNpiBulkBatch(
      batchId,
    )

  return {
    processed,
    skipped,
    batch:
      refreshed.batch,
    drafts:
      refreshed.drafts,
  }
}

export async function createHostNpiFromImages(
  input,
) {
  const {
    organization,
    authority,
  } =
    await hostAuthority(
      input,
    )

  return createFromImages({
    ...input,

    initiatorType:
      'host',

    origin:
      'host_npi',

    organizationId:
      organization._id,

    canonicalBrandId:
      authority?.brandId ||
      null,

    authorityGrantId:
      authority?._id ||
      null,

    brandAuthorityVerified:
      Boolean(
        authority,
      ),
  })
}

export async function createAdminNpiFromImages(
  input,
) {
  return createFromImages({
    ...input,

    initiatorType:
      'admin',

    origin:
      'admin_npi',

    organizationId:
      null,

    canonicalBrandId:
      null,

    authorityGrantId:
      null,

    brandAuthorityVerified:
      false,
  })
}

export async function getOwnedUniversalProductDraft({
  draftId,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const draft =
    await CommunityProductDraft
      .findOne({
        _id:
          draftId,

        createdByUserId:
          userId,
      })
      .lean()

  if (
    !draft
  ) {
    throw new ApiError(
      404,
      'Provisional product draft was not found.',
      [
        {
          code:
            'UNIVERSAL_PRODUCT_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  const evidence =
    await ImageEvidence
      .find({
        _id: {
          $in:
            draft.sourceEvidenceIds ||
            [],
        },

        ownerUserId:
          userId,
      })
      .sort({
        createdAt:
          1,
      })
      .lean()

  return {
    draft:
      serializeCommunityProductDraft(
        draft,
        {
          includeExternalEvidence:
            true,
        },
      ),

    evidence:
      evidence.map(
        (
          item,
        ) =>
          serializeEvidence(
            item,
          ),
      ),
  }
}

export async function listHostNpiDrafts({
  page,
  limit,
  status,
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const filter = {
    organizationId:
      organization._id,
  }

  if (
    status
  ) {
    filter.status =
      status
  }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    drafts,
    total,
  ] =
    await Promise.all([
      CommunityProductDraft
        .find(
          filter,
        )
        .sort({
          createdAt:
            -1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      CommunityProductDraft.countDocuments(
        filter,
      ),
    ])

  return {
    drafts:
      drafts.map(
        (
          item,
        ) =>
          serializeCommunityProductDraft(
            item,
          ),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getHostNpiDraft({
  draftId,
  actorUser,
}) {
  const organization =
    await requireActiveHostMarketplaceOrganization(
      actorUser,
    )

  const draft =
    await CommunityProductDraft
      .findOne({
        _id:
          draftId,

        organizationId:
          organization._id,
      })
      .lean()

  if (
    !draft
  ) {
    throw new ApiError(
      404,
      'Host NPI draft was not found.',
      [
        {
          code:
            'HOST_NPI_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  const evidence =
    await ImageEvidence
      .find({
        _id: {
          $in:
            draft.sourceEvidenceIds ||
            [],
        },

        organizationId:
          organization._id,
      })
      .sort({
        createdAt:
          1,
      })
      .lean()

  return {
    draft:
      serializeCommunityProductDraft(
        draft,
        {
          includeExternalEvidence:
            true,
        },
      ),

    evidence:
      evidence.map(
        (
          item,
        ) =>
          serializeEvidence(
            item,
          ),
      ),
  }
}

export async function listNpiReviewQueue({
  page,
  limit,
  status,
}) {
  const filter =
    status
      ? {
          status,
        }
      : {
          status: {
            $in: [
              'provisional',
              'ready_for_review',
              'needs_more_evidence',
            ],
          },
        }

  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    drafts,
    total,
  ] =
    await Promise.all([
      CommunityProductDraft
        .find(
          filter,
        )
        .sort({
          safetyReviewRequired:
            -1,

          createdAt:
            1,
        })
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      CommunityProductDraft.countDocuments(
        filter,
      ),
    ])

  return {
    drafts:
      drafts.map(
        (
          item,
        ) =>
          serializeCommunityProductDraft(
            item,
          ),
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total
          ? Math.ceil(
              total /
                limit,
            )
          : 0,
    },
  }
}

export async function getNpiDraftForAdmin(
  draftId,
) {
  const draft =
    await CommunityProductDraft
      .findById(
        draftId,
      )
      .lean()

  if (
    !draft
  ) {
    throw new ApiError(
      404,
      'NPI review draft was not found.',
      [
        {
          code:
            'NPI_REVIEW_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  const [
    evidence,
    extraction,
    decisions,
  ] =
    await Promise.all([
      ImageEvidence
        .find({
          _id: {
            $in:
              draft.sourceEvidenceIds ||
              [],
          },
        })
        .sort({
          createdAt:
            1,
        })
        .lean(),

      draft.latestExtractionId
        ? LabelExtraction
            .findById(
              draft.latestExtractionId,
            )
            .lean()
        : null,

      ProductNpiReviewDecision
        .find({
          draftId:
            draft._id,
        })
        .sort({
          createdAt:
            -1,
        })
        .lean(),
    ])

  return {
    draft:
      serializeCommunityProductDraft(
        draft,
        {
          includeExternalEvidence:
            true,
        },
      ),

    evidence:
      evidence.map(
        (
          item,
        ) =>
          serializeEvidence(
            item,
            true,
          ),
      ),

    extraction:
      extraction
        ? {
            id:
              id(
                extraction._id,
              ),

            status:
              extraction.status,

            modelId:
              extraction.modelId ||
              null,

            parserVersion:
              extraction.parserVersion,

            confidenceSummary:
              extraction.confidenceSummary ||
              {},

            safetyFlags:
              extraction.safetyFlags ||
              [],

            normalizedLabelText:
              extraction.normalizedLabelText ||
              '',

            createdAt:
              extraction.createdAt ||
              null,
          }
        : null,

    decisions:
      decisions.map(
        (
          item,
        ) => ({
          id:
            id(
              item._id,
            ),

          decision:
            item.decision,

          fieldDecisions:
            item.fieldDecisions ||
            [],

          reason:
            item.reason,

          reviewerUserId:
            id(
              item.reviewerUserId,
            ),

          createdAt:
            item.createdAt ||
            null,
        }),
      ),
  }
}

function applyFieldDecisions(
  candidateFields,
  decisions,
) {
  const next =
    JSON.parse(
      JSON.stringify(
        candidateFields ||
          {},
      ),
    )

  for (
    const item of
      decisions
  ) {
    const target =
      next[
        item.fieldPath
      ]

    if (
      !target
    ) {
      continue
    }

    target.reviewState =
      item.decision

    if (
      item.correctedValue !==
        undefined &&
      item.correctedValue !==
        null
    ) {
      target.value =
        item.correctedValue

      target.source =
        'admin_correction'

      target.confidence =
        1
    }
  }

  return next
}

function hasValue(
  key,
  item,
) {
  if (
    !item
  ) {
    return false
  }

  if (
    key ===
    'ingredientDeclarationText'
  ) {
    return Boolean(
      clean(
        item.value,
      ),
    )
  }

  if (
    key ===
    'allergens'
  ) {
    return Boolean(
      clean(
        item.value?.statement,
      ) ||
      (
        item.value?.items ||
        []
      ).length,
    )
  }

  if (
    key ===
    'nutrition'
  ) {
    return Boolean(
      (
        item.value
          ?.nutrients ||
        []
      ).length,
    )
  }

  return false
}

function safetyApproved(
  fields,
) {
  return SAFETY_FIELDS.every(
    (
      key,
    ) =>
      !hasValue(
        key,
        fields?.[
          key
        ],
      ) ||
      fields[
        key
      ].reviewState ===
        'accepted',
  )
}


const BULK_CATALOG_CATEGORY_BY_LISTING_TYPE =
  Object.freeze({
    packaged:
      'Packaged Food',

    vegetable:
      'Vegetables',

    fruit:
      'Fruits',
  })

function bulkCommercialSourceReference(
  draft,
) {
  return `bulk-npi:${String(
    draft._id,
  )}`
}

function bulkCommercialHostActor(
  organization,
) {
  return {
    _id:
      organization.ownerUserId,

    id:
      organization.ownerUserId,

    displayName:
      organization.displayName,

    name:
      organization.displayName,
  }
}

function commercializationFailureMessage(
  error,
) {
  const primary =
    clean(
      error?.message,
    ) ||
    'Automatic publication could not be completed.'

  const firstDetail =
    Array.isArray(
      error?.errors,
    )
      ? error.errors.find(
          (
            item,
          ) =>
            clean(
              item?.code ||
              item?.message,
            ),
        )
      : null

  const detail =
    clean(
      firstDetail?.message ||
      firstDetail?.code,
    )

  return clean(
    detail
      ? `${primary} (${detail})`
      : primary,
  ).slice(
    0,
    4000,
  )
}

async function ensureBulkMarketplaceOffer({
  draft,
  organization,
}) {
  const merchantSku =
    clean(
      draft.merchantSku,
    )

  const activeStatuses = [
    'draft',
    'active',
    'paused',
  ]

  const byPack =
    await HostOffer.findOne({
      organizationId:
        organization._id,

      packId:
        draft.catalogPackId,

      status: {
        $in:
          activeStatuses,
      },
    })

  const bySku =
    merchantSku
      ? await HostOffer.findOne({
          organizationId:
            organization._id,

          merchantSku,

          status: {
            $in:
              activeStatuses,
          },
        })
      : null

  if (
    bySku &&
    String(
      bySku.packId,
    ) !==
      String(
        draft.catalogPackId,
      )
  ) {
    throw new ApiError(
      409,
      `Merchant SKU ${merchantSku} already belongs to another active Host Offer.`,
      [
        {
          code:
            'BULK_NPI_MERCHANT_SKU_OFFER_CONFLICT',
        },
      ],
    )
  }

  if (
    byPack &&
    bySku &&
    String(
      byPack._id,
    ) !==
      String(
        bySku._id,
      )
  ) {
    throw new ApiError(
      409,
      'The canonical Pack and merchant SKU resolve to different existing Host Offers.',
      [
        {
          code:
            'BULK_NPI_EXISTING_OFFER_CONFLICT',
        },
      ],
    )
  }

  const existing =
    byPack ||
    bySku

  if (existing) {
    return existing
  }

  try {
    return await HostOffer.create({
      organizationId:
        organization._id,

      packId:
        draft.catalogPackId,

      merchantSku,

      fulfillmentTypes: [
        'delivery',
      ],

      minimumOrderQuantity:
        1,

      maximumOrderQuantity:
        null,

      externalReference:
        bulkCommercialSourceReference(
          draft,
        ),

      status:
        'draft',

      createdByUserId:
        organization.ownerUserId,

      updatedByUserId:
        organization.ownerUserId,
    })
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    const raced =
      await HostOffer.findOne({
        organizationId:
          organization._id,

        status: {
          $in:
            activeStatuses,
        },

        $or: [
          {
            packId:
              draft.catalogPackId,
          },

          ...(merchantSku
            ? [
                {
                  merchantSku,
                },
              ]
            : []),
        ],
      })

    if (raced) {
      return raced
    }

    throw error
  }
}

async function ensureBulkInventoryNode({
  draft,
  organization,
}) {
  const commercial =
    draft.commercialDraft ||
    {}

  const nodeKey =
    normalizeMarketplaceKey(
      commercial.inventoryNodeName,
    )

  let node =
    await InventoryNode.findOne({
      organizationId:
        organization._id,

      nodeKey,
    })

  if (node) {
    if (
      node.status !==
        'active'
    ) {
      throw new ApiError(
        409,
        'The Inventory Node selected in the workbook exists but is disabled.',
        [
          {
            code:
              'BULK_NPI_INVENTORY_NODE_DISABLED',
          },
        ],
      )
    }

    return node
  }

  const hostActor =
    bulkCommercialHostActor(
      organization,
    )

  try {
    const result =
      await createInventoryNode(
        {
          name:
            commercial.inventoryNodeName,

          nodeKey,

          nodeType:
            commercial.inventoryNodeType ||
            'warehouse',

          address: {
            line1:
              '',

            line2:
              '',

            city:
              commercial.city,

            state:
              commercial.state,

            postalCode:
              commercial.pincode,

            countryCode:
              'IN',
          },
        },
        hostActor,
      )

    node =
      await InventoryNode.findById(
        result.inventoryNode.id,
      )
  } catch (error) {
    if (
      error?.statusCode !==
        409
    ) {
      throw error
    }

    node =
      await InventoryNode.findOne({
        organizationId:
          organization._id,

        nodeKey,
      })

    if (!node) {
      throw error
    }
  }

  return node
}

async function resolveBulkServiceArea({
  draft,
  organization,
  inventoryNode,
}) {
  const requestedKey =
    normalizeMarketplaceKey(
      draft.commercialDraft
        ?.serviceAreaName,
    )

  const requested =
    requestedKey
      ? await ServiceArea.findOne({
          organizationId:
            organization._id,

          serviceAreaKey:
            requestedKey,

          status:
            'active',
        })
      : null

  const compatibleRequested =
    requested &&
    (
      !requested.inventoryNodeId ||
      String(
        requested.inventoryNodeId,
      ) ===
        String(
          inventoryNode._id,
        )
    )
      ? requested
      : null

  if (compatibleRequested) {
    return compatibleRequested
  }

  const nodeScoped =
    await ServiceArea.findOne({
      organizationId:
        organization._id,

      inventoryNodeId:
        inventoryNode._id,

      status:
        'active',
    })

  if (nodeScoped) {
    return nodeScoped
  }

  const organizationWide =
    await ServiceArea.findOne({
      organizationId:
        organization._id,

      inventoryNodeId:
        null,

      status:
        'active',
    })

  if (organizationWide) {
    return organizationWide
  }

  throw new ApiError(
    409,
    `Delivery Area ${clean(
      draft.commercialDraft
        ?.serviceAreaName,
    ) || 'from the workbook'} is not configured for this active Inventory Node.`,
    [
      {
        code:
          'BULK_NPI_SERVICE_AREA_REQUIRED',
      },
    ],
  )
}

async function ensureBulkPriceRule({
  draft,
  organization,
  offer,
}) {
  if (
    draft.marketplacePriceRuleId
  ) {
    const existingById =
      await PriceRule.findOne({
        _id:
          draft.marketplacePriceRuleId,

        organizationId:
          organization._id,

        offerId:
          offer._id,
      })

    if (existingById) {
      return existingById
    }
  }

  const sourceReference =
    bulkCommercialSourceReference(
      draft,
    )

  let existing =
    await PriceRule.findOne({
      organizationId:
        organization._id,

      offerId:
        offer._id,

      source:
        'bulk_import',

      changeReason:
        `Bulk NPI approval ${sourceReference}`,
    })
      .sort({
        effectiveFrom:
          -1,
      })

  if (existing) {
    return existing
  }

  const commercial =
    draft.commercialDraft ||
    {}

  const hostActor =
    bulkCommercialHostActor(
      organization,
    )

  const result =
    await createHostPriceRule(
      String(
        offer._id,
      ),
      {
        listPrice: {
          amountMinor:
            Number(
              commercial.listPriceMinor,
            ),

          currency:
            commercial.currency ||
            'INR',
        },

        salePrice:
          commercial.salePriceMinor
            ? {
                amountMinor:
                  Number(
                    commercial.salePriceMinor,
                  ),

                currency:
                  commercial.currency ||
                  'INR',
              }
            : null,

        effectiveFrom:
          new Date().toISOString(),

        effectiveTo:
          null,

        source:
          'bulk_import',

        changeReason:
          `Bulk NPI approval ${sourceReference}`,
      },
      hostActor,
    )

  existing =
    await PriceRule.findById(
      result.priceRule.id,
    )

  return existing
}

async function ensureBulkInventorySnapshot({
  draft,
  organization,
  offer,
  inventoryNode,
}) {
  if (
    draft.marketplaceInventorySnapshotId
  ) {
    const existingById =
      await InventorySnapshot.findOne({
        _id:
          draft.marketplaceInventorySnapshotId,

        organizationId:
          organization._id,

        offerId:
          offer._id,

        inventoryNodeId:
          inventoryNode._id,
      })

    if (existingById) {
      return existingById
    }
  }

  const sourceReference =
    bulkCommercialSourceReference(
      draft,
    )

  let existing =
    await InventorySnapshot.findOne({
      organizationId:
        organization._id,

      offerId:
        offer._id,

      inventoryNodeId:
        inventoryNode._id,

      sourceType:
        'bulk_import',

      sourceReference,
    })
      .sort({
        observedAt:
          -1,
      })

  if (existing) {
    return existing
  }

  const availableQuantity =
    Number(
      draft.commercialDraft
        ?.availableQuantity,
    )

  if (
    !Number.isInteger(
      availableQuantity,
    ) ||
    availableQuantity <
      0
  ) {
    throw new ApiError(
      409,
      'Workbook availability must be a whole number before the listing can go live.',
      [
        {
          code:
            'BULK_NPI_INVENTORY_QUANTITY_INVALID',
        },
      ],
    )
  }

  const hostActor =
    bulkCommercialHostActor(
      organization,
    )

  const result =
    await createBulkInventorySnapshots(
      {
        items: [
          {
            offerId:
              String(
                offer._id,
              ),

            inventoryNodeId:
              String(
                inventoryNode._id,
              ),

            availableQuantity,

            reservedQuantity:
              0,

            sourceType:
              'bulk_import',

            sourceReference,

            observedAt:
              new Date().toISOString(),
          },
        ],
      },
      hostActor,
    )

  existing =
    await InventorySnapshot.findById(
      result.inventorySnapshots[0]
        .id,
    )

  return existing
}

async function publishApprovedBulkDraft({
  draftId,
  reason,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  let draft =
    await CommunityProductDraft.findById(
      draftId,
    )

  if (
    !draft ||
    !draft.bulkBatchId ||
    draft.status !==
      'approved_for_catalog'
  ) {
    return null
  }

  draft.commercializationStatus =
    'processing'

  draft.commercializationError =
    ''

  draft.commercializationAttemptedAt =
    new Date()

  await draft.save()

  try {
    const handoff =
      await materializeNpiDraftToCatalog({
        draftId:
          String(
            draft._id,
          ),

        categoryName:
          BULK_CATALOG_CATEGORY_BY_LISTING_TYPE[
            draft.listingType
          ] ||
          'Packaged Food',

        packType:
          'other',

        reason:
          clean(
            reason,
          ) ||
          'Approved Bulk NPI row automatically materialized after Super Admin review.',

        fieldDecisions:
          [],

        actorUser,

        adminAuthorization,

        requestId,
      })

    draft =
      await CommunityProductDraft.findById(
        draft._id,
      )

    let productVersion =
      await ProductVersion.findById(
        draft.catalogProductVersionId ||
        handoff.productVersion?.id,
      )

    if (!productVersion) {
      throw new ApiError(
        409,
        'The canonical Product Version could not be loaded after catalog handoff.',
        [
          {
            code:
              'BULK_NPI_CATALOG_VERSION_MISSING',
          },
        ],
      )
    }

    if (
      productVersion.publicationStatus ===
        'draft'
    ) {
      await submitProductVersionForReview(
        String(
          productVersion._id,
        ),
        actorId(
          actorUser,
        ),
      )

      productVersion =
        await ProductVersion.findById(
          productVersion._id,
        )
    }

    if (
      productVersion.publicationStatus ===
        'in_review'
    ) {
      await publishProductVersion({
        versionId:
          String(
            productVersion._id,
          ),

        reasonCode:
          'catalog.governance',

        reasonDetails:
          clean(
            reason,
          ) ||
          'Super Admin approved this Host Bulk NPI row for canonical publication.',

        actorUser,

        adminAuthorization,

        requestId,
      })

      productVersion =
        await ProductVersion.findById(
          productVersion._id,
        )
    }

    if (
      productVersion.publicationStatus !==
        'published'
    ) {
      throw new ApiError(
        409,
        `Canonical Product Version is ${productVersion.publicationStatus} instead of published.`,
        [
          {
            code:
              'BULK_NPI_CATALOG_NOT_PUBLISHED',
          },
        ],
      )
    }

    draft.catalogPublishedAt =
      productVersion.publishedAt ||
      new Date()

    const commercial =
      draft.commercialDraft ||
      null

    if (!commercial) {
      draft.commercializationStatus =
        'prepared'

      draft.commercializationError =
        ''

      await draft.save()

      return {
        status:
          'prepared',

        canonicalPublished:
          true,

        offerActive:
          false,

        message:
          'Canonical product was published, but this row has no commercial draft to create a customer listing.',
      }
    }

    const organization =
      await MarketplaceOrganization.findById(
        draft.organizationId,
      )

    if (
      !organization ||
      organization.status !==
        'active'
    ) {
      throw new ApiError(
        409,
        'Host Marketplace organization must be active before an approved Bulk NPI row can become customer-visible.',
        [
          {
            code:
              'BULK_NPI_HOST_ORGANIZATION_NOT_ACTIVE',
          },
        ],
      )
    }

    const offer =
      await ensureBulkMarketplaceOffer({
        draft,
        organization,
      })

    const inventoryNode =
      await ensureBulkInventoryNode({
        draft,
        organization,
      })

    const serviceArea =
      await resolveBulkServiceArea({
        draft,
        organization,
        inventoryNode,
      })

    const priceRule =
      await ensureBulkPriceRule({
        draft,
        organization,
        offer,
      })

    const inventorySnapshot =
      await ensureBulkInventorySnapshot({
        draft,
        organization,
        offer,
        inventoryNode,
      })

    draft.marketplaceOfferId =
      offer._id

    draft.marketplacePriceRuleId =
      priceRule._id

    draft.marketplaceInventoryNodeId =
      inventoryNode._id

    draft.marketplaceInventorySnapshotId =
      inventorySnapshot._id

    draft.marketplaceServiceAreaId =
      serviceArea._id

    await draft.save()

    const hostActor =
      bulkCommercialHostActor(
        organization,
      )

    const readiness =
      await inspectHostOfferReadiness(
        String(
          offer._id,
        ),
        hostActor,
      )

    if (!readiness.ready) {
      throw new ApiError(
        409,
        'The approved Bulk NPI product was prepared, but its Host Offer is not commercially ready for activation.',
        [
          {
            code:
              'BULK_NPI_OFFER_NOT_READY',

            checks:
              readiness.checks,
          },
        ],
      )
    }

    const shouldActivate =
      commercial.activateAfterApproval !==
        false

    if (shouldActivate) {
      await activateHostOffer(
        String(
          offer._id,
        ),
        hostActor,
      )
    }

    draft =
      await CommunityProductDraft.findById(
        draft._id,
      )

    draft.commercializationStatus =
      shouldActivate
        ? 'live'
        : 'prepared'

    draft.commercializationError =
      ''

    draft.commercializedAt =
      shouldActivate
        ? new Date()
        : null

    await draft.save()

    return {
      status:
        draft.commercializationStatus,

      canonicalPublished:
        true,

      offerActive:
        shouldActivate,

      offerId:
        String(
          offer._id,
        ),

      priceRuleId:
        String(
          priceRule._id,
        ),

      inventoryNodeId:
        String(
          inventoryNode._id,
        ),

      inventorySnapshotId:
        String(
          inventorySnapshot._id,
        ),

      serviceAreaId:
        String(
          serviceArea._id,
        ),

      readiness:
        readiness.checks,

      message:
        shouldActivate
          ? 'Approved Bulk NPI row was published and its Host Offer is active for eligible customers.'
          : 'Approved Bulk NPI row was published and commercially prepared, but automatic Offer activation was disabled in the workbook.',
    }
  } catch (error) {
    draft =
      await CommunityProductDraft.findById(
        draftId,
      )

    if (draft) {
      draft.commercializationStatus =
        'action_required'

      draft.commercializationError =
        commercializationFailureMessage(
          error,
        )

      await draft.save()
    }

    return {
      status:
        'action_required',

      canonicalPublished:
        Boolean(
          draft?.catalogPublishedAt,
        ),

      offerActive:
        false,

      message:
        commercializationFailureMessage(
          error,
        ),
    }
  }
}

export async function reviewNpiDraft({
  draftId,
  decision,
  fieldDecisions,
  reason,
  actorUser,
  adminAuthorization,
  auditPermissionKey,
  requestId,
}) {
  const userId =
    actorId(
      actorUser,
    )

  const draft =
    await CommunityProductDraft.findById(
      draftId,
    )

  if (
    !draft
  ) {
    throw new ApiError(
      404,
      'NPI review draft was not found.',
      [
        {
          code:
            'NPI_REVIEW_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    [
      'approved_for_catalog',
      'rejected',
    ].includes(
      draft.status,
    )
  ) {
    throw new ApiError(
      409,
      'This NPI draft already has a terminal review decision.',
      [
        {
          code:
            'NPI_REVIEW_ALREADY_FINAL',
        },
      ],
    )
  }

  if (
    decision ===
      'approve_for_catalog' &&
    auditPermissionKey !==
      'catalog.mutate'
  ) {
    throw new ApiError(
      403,
      'Catalog mutation permission is required to approve an NPI draft for catalog handoff.',
      [
        {
          code:
            'NPI_CATALOG_APPROVAL_PERMISSION_REQUIRED',

          requiredPermissionKey:
            'catalog.mutate',
        },
      ],
    )
  }

  if (
    auditPermissionKey ===
    'trust_safety.mutate'
  ) {
    const outOfScopeFields =
      fieldDecisions
        .map(
          (
            item,
          ) =>
            item.fieldPath,
        )
        .filter(
          (
            fieldPath,
          ) =>
            !TRUST_SAFETY_REVIEW_FIELDS.has(
              fieldPath,
            ),
        )

    if (
      outOfScopeFields.length
    ) {
      throw new ApiError(
        403,
        'Trust & Safety permission cannot mutate non-safety NPI fields.',
        [
          {
            code:
              'NPI_TRUST_SAFETY_FIELD_SCOPE_INVALID',

            fieldPaths: [
              ...new Set(
                outOfScopeFields,
              ),
            ],
          },
        ],
      )
    }
  }

  if (
    decision ===
    'approve_for_catalog'
  ) {
    assertDistinctMakerCheckerActors({
      makerUserId:
        draft.createdByUserId,

      checkerUserId:
        userId,
    })
  }

  const beforeSnapshot =
    serializeCommunityProductDraft(
      draft,
    )

  const nextFields =
    applyFieldDecisions(
      draft.candidateFields,
      fieldDecisions,
    )

  if (
    decision ===
      'approve_for_catalog' &&
    !safetyApproved(
      nextFields,
    )
  ) {
    throw new ApiError(
      409,
      'Ingredients, allergen and nutrition evidence with extracted values must be explicitly accepted or corrected before catalog handoff.',
      [
        {
          code:
            'NPI_SAFETY_REVIEW_REQUIRED',

          requiredFieldPaths:
            SAFETY_FIELDS,
        },
      ],
    )
  }

  await ProductNpiReviewDecision.create({
    draftId:
      draft._id,

    reviewerUserId:
      userId,

    decision,

    fieldDecisions,

    reason,
  })

  draft.candidateFields =
    nextFields

  draft.reviewedByUserId =
    userId

  draft.reviewedAt =
    new Date()

  draft.reviewSummary =
    reason

  if (
    decision ===
    'approve_for_catalog'
  ) {
    draft.status =
      'approved_for_catalog'

    draft.verificationStatus =
      'reviewed'

    draft.readyForCatalog =
      true
  } else if (
    decision ===
    'request_more_evidence'
  ) {
    draft.status =
      'needs_more_evidence'

    draft.verificationStatus =
      'provisional'

    draft.readyForCatalog =
      false
  } else {
    draft.status =
      'rejected'

    draft.verificationStatus =
      'reviewed'

    draft.readyForCatalog =
      false
  }

  await draft.save()

  await NPIJob.updateMany(
    {
      draftId:
        draft._id,

      status: {
        $nin: [
          'approved_for_catalog',
          'rejected',
        ],
      },
    },
    {
      $set: {
        status:
          decision ===
          'approve_for_catalog'
            ? 'approved_for_catalog'
            : decision ===
                'reject'
              ? 'rejected'
              : 'needs_more_evidence',

        completedAt:
          new Date(),
      },
    },
  )

  const auditAction =
    auditPermissionKey ===
    'trust_safety.mutate'
      ? 'trust_safety.mutate'
      : 'catalog.mutate'

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      auditAction,

    permissionKey:
      auditPermissionKey,

    entityType:
      'community_product_draft',

    entityId:
      String(
        draft._id,
      ),

    reasonCode:
      auditAction ===
      'trust_safety.mutate'
        ? 'trust_safety.enforcement'
        : 'catalog.governance',

    reasonDetails:
      reason,

    beforeSnapshot,

    afterSnapshot:
      serializeCommunityProductDraft(
        draft,
      ),

    metadata: {
      operation:
        'm14_npi_review',

      decision,

      canonicalPublishPerformed:
        false,

      safetyReviewRequired:
        true,
    },

    requestId,
  })

  let commercialization =
    null

  if (
    decision ===
      'approve_for_catalog' &&
    draft.bulkBatchId
  ) {
    commercialization =
      await publishApprovedBulkDraft({
        draftId:
          String(
            draft._id,
          ),

        reason,

        actorUser,

        adminAuthorization,

        requestId,
      })
  }

  const finalDraft =
    await CommunityProductDraft.findById(
      draft._id,
    )

  const canonicalPublished =
    Boolean(
      finalDraft
        ?.catalogPublishedAt,
    )

  return {
    draft:
      serializeCommunityProductDraft(
        finalDraft ||
        draft,
      ),

    catalogHandoff:
      decision ===
      'approve_for_catalog'
        ? {
            ready:
              true,

            canonicalPublishPerformed:
              canonicalPublished,

            message:
              draft.bulkBatchId
                ? commercialization?.message ||
                  'Bulk NPI row approved. Automatic catalog and commerce publication is being evaluated.'
                : 'Draft is approved for M04 catalog onboarding. Canonical ProductVersion creation/publication remains a separate governed catalog action.',
          }
        : {
            ready:
              false,

            canonicalPublishPerformed:
              false,
          },

    commercialization,
  }
}
