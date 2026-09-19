import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  Category,
  Brand,
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  normalizeCatalogKey,
  normalizeCatalogSlug,
  NUTRITION_BASIS_TYPES,
  PRODUCT_ALLERGEN_RELATION_TYPES,
  PRODUCT_QUANTITY_UNITS,
} from '../catalog/catalog.constants.js'

import {
  createCatalogBrand,
  createCatalogCategory,
  createProductFamily,
  updateProductFamily,
  createProductVariant,
  createProductPack,
  createProductDraft,
  serializeCatalogProductVersion,
} from '../catalog/catalog.admin.service.js'

import {
  createEvidenceSource,
} from '../catalog/catalog.governance.service.js'

import {
  CommunityProductDraft,
  ImageEvidence,
} from './universalProduct.models.js'

function clean(
  value,
) {
  return String(
    value ?? '',
  ).trim()
}

function normalizeCountryOfOriginForCatalog(
  draft,
) {
  const item =
    draft?.candidateFields
      ?.countryOfOrigin

  if (
    item?.reviewState !==
      'accepted'
  ) {
    return ''
  }

  const value =
    clean(
      item.value,
    )

  if (!value) {
    return ''
  }

  /*
   * Open Food Facts exposes `countries` as markets where a product is sold.
   * That value is not a canonical country-of-origin fact. Older NPI drafts
   * could therefore contain a long comma-separated market list in the
   * countryOfOrigin candidate. Never truncate that list into catalog truth.
   * Keep the evidence on the NPI draft, but omit the optional catalog field
   * unless it is a bounded origin value.
   */
  if (
    item.source ===
      'external_database'
  ) {
    const segments =
      value
        .split(
          /[,;|]/,
        )
        .map(
          (segment) =>
            clean(
              segment,
            ),
        )
        .filter(
          Boolean,
        )

    if (
      segments.length >
      1
    ) {
      return ''
    }
  }

  if (
    value.length >
    120
  ) {
    return ''
  }

  return value
}

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated catalog actor is required.',
      [
        {
          code:
            'NPI_CATALOG_HANDOFF_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function acceptedCandidate(
  draft,
  fieldPath,
  {
    required = false,
  } = {},
) {
  const item =
    draft?.candidateFields?.[
      fieldPath
    ]

  if (
    item?.reviewState ===
      'accepted'
  ) {
    return item.value
  }

  if (required) {
    throw new ApiError(
      409,
      `${fieldPath} must be explicitly accepted before M04 catalog materialization.`,
      [
        {
          code:
            'NPI_CATALOG_FIELD_NOT_ACCEPTED',

          fieldPath,
        },
      ],
    )
  }

  return null
}

function candidateReviewStates(
  candidateFields,
) {
  return Object.fromEntries(
    Object.entries(
      JSON.parse(
        JSON.stringify(
          candidateFields ||
            {},
        ),
      ),
    ).map(
      ([
        fieldPath,
        item,
      ]) => [
        fieldPath,
        item?.reviewState ||
          'pending_review',
      ],
    ),
  )
}

function applyAcceptedHandoffFieldDecisions(
  draft,
  fieldDecisions =
    [],
) {
  if (
    !Array.isArray(
      fieldDecisions,
    ) ||
    !fieldDecisions.length
  ) {
    return
  }

  const next =
    JSON.parse(
      JSON.stringify(
        draft.candidateFields ||
          {},
      ),
    )

  for (
    const item of
      fieldDecisions
  ) {
    if (
      item?.decision !==
        'accepted'
    ) {
      continue
    }

    const target =
      next[
        item.fieldPath
      ]

    if (!target) {
      continue
    }

    target.reviewState =
      'accepted'
  }

  draft.candidateFields =
    next
}

function normalizeQuantityUnit(
  rawUnit,
) {
  const normalized =
    clean(
      rawUnit,
    )
      .toLowerCase()
      .replace(/\./g, '')

  const aliases = {
    g: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kgs: 'kg',
    kilogram: 'kg',
    kilograms: 'kg',
    ml: 'ml',
    milliliter: 'ml',
    milliliters: 'ml',
    millilitre: 'ml',
    millilitres: 'ml',
    l: 'l',
    litre: 'l',
    litres: 'l',
    liter: 'l',
    liters: 'l',
    pc: 'piece',
    pcs: 'piece',
    piece: 'piece',
    pieces: 'piece',
    dozen: 'dozen',
    dozens: 'dozen',
    dz: 'dozen',
  }

  const value =
    aliases[
      normalized
    ] ||
    normalized

  return PRODUCT_QUANTITY_UNITS.includes(
    value,
  )
    ? value
    : null
}

function parseNetQuantity(
  candidateValue,
) {
  if (
    candidateValue &&
    typeof candidateValue ===
      'object'
  ) {
    const value =
      Number(
        candidateValue.value,
      )

    const unit =
      normalizeQuantityUnit(
        candidateValue.unit,
      )

    if (
      Number.isFinite(
        value,
      ) &&
      value > 0 &&
      unit
    ) {
      return {
        value,
        unit,
      }
    }
  }

  const rawText =
    typeof candidateValue ===
      'string'
      ? candidateValue
      : clean(
          candidateValue?.rawText,
        )

  const match =
    rawText.match(
      /(^|\s)(\d+(?:[.,]\d+)?)\s*(kg|kgs?|kilograms?|g|grams?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|pcs?|pieces?|dozens?|dz)\b/i,
    )

  if (!match) {
    throw new ApiError(
      409,
      'Accepted net quantity could not be normalized for the canonical M04 Product Version.',
      [
        {
          code:
            'NPI_CATALOG_NET_QUANTITY_INVALID',

          rawText,
        },
      ],
    )
  }

  const value =
    Number(
      match[2].replace(
        ',',
        '.',
      ),
    )

  const unit =
    normalizeQuantityUnit(
      match[3],
    )

  if (
    !Number.isFinite(
      value,
    ) ||
    value <= 0 ||
    !unit
  ) {
    throw new ApiError(
      409,
      'Accepted net quantity is not valid for the canonical M04 Product Version.',
      [
        {
          code:
            'NPI_CATALOG_NET_QUANTITY_INVALID',
        },
      ],
    )
  }

  return {
    value,
    unit,
  }
}


function acceptedCandidateField(
  draft,
  fieldPath,
) {
  const item =
    draft?.candidateFields?.[
      fieldPath
    ]

  if (
    item?.reviewState !==
      'accepted'
  ) {
    return null
  }

  return item
}

function normalizeAcceptedIngredientDeclaration(
  draft,
) {
  const item =
    acceptedCandidateField(
      draft,
      'ingredientDeclarationText',
    )

  if (!item) {
    return null
  }

  return clean(
    item.value,
  )
}

function normalizeAcceptedNutrition(
  draft,
) {
  const item =
    acceptedCandidateField(
      draft,
      'nutrition',
    )

  if (!item) {
    return null
  }

  const value =
    item.value &&
    typeof item.value ===
      'object'
      ? item.value
      : {}

  const basis =
    NUTRITION_BASIS_TYPES.includes(
      value.basis,
    )
      ? value.basis
      : null

  const servingValue =
    Number(
      value.servingSize
        ?.value,
    )

  const servingUnit =
    normalizeQuantityUnit(
      value.servingSize
        ?.unit,
    )

  const servingSize =
    Number.isFinite(
      servingValue,
    ) &&
    servingValue > 0 &&
    servingUnit
      ? {
          value:
            servingValue,

          unit:
            servingUnit,
        }
      : null

  const nutrients =
    (
      Array.isArray(
        value.nutrients,
      )
        ? value.nutrients
        : []
    )
      .map(
        (
          nutrient,
        ) => {
          const nutrientKey =
            normalizeCatalogKey(
              nutrient?.name ||
              nutrient?.nutrientKey,
            )

          const amount =
            Number(
              nutrient?.amount,
            )

          const unit =
            clean(
              nutrient?.unit,
            )

          if (
            !nutrientKey ||
            !Number.isFinite(
              amount,
            ) ||
            amount < 0 ||
            !unit
          ) {
            return null
          }

          return {
            nutrientKey,
            amount,
            unit,
          }
        },
      )
      .filter(
        Boolean,
      )

  return {
    basis,
    servingSize,
    nutrients,
  }
}

function normalizeAcceptedAllergens(
  draft,
) {
  const item =
    acceptedCandidateField(
      draft,
      'allergens',
    )

  if (!item) {
    return null
  }

  const value =
    item.value &&
    typeof item.value ===
      'object'
      ? item.value
      : {}

  return (
    Array.isArray(
      value.items,
    )
      ? value.items
      : []
  )
    .map(
      (
        allergen,
      ) => {
        const allergenKey =
          normalizeCatalogKey(
            allergen?.name ||
            allergen?.allergenKey,
          )

        const relationType =
          PRODUCT_ALLERGEN_RELATION_TYPES.includes(
            allergen?.relationType,
          )
            ? allergen.relationType
            : 'unknown'

        if (!allergenKey) {
          return null
        }

        return {
          allergenKey,
          relationType,
          evidenceState:
            'operator_declared',
        }
      },
    )
    .filter(
      Boolean,
    )
}

function normalizeAcceptedClaims(
  draft,
) {
  const item =
    acceptedCandidateField(
      draft,
      'claims',
    )

  if (!item) {
    return null
  }

  const values =
    Array.isArray(
      item.value,
    )
      ? item.value
      : []

  return values
    .map(
      (claim) => {
        const label =
          clean(
            typeof claim ===
              'string'
              ? claim
              : claim?.label,
          )

        const key =
          normalizeCatalogKey(
            label,
          )

        if (!label || !key) {
          return null
        }

        return {
          key,
          label,
          evidenceState:
            'operator_declared',
        }
      },
    )
    .filter(
      Boolean,
    )
}

async function applyAcceptedNpiSafetyFacts({
  draft,
  productVersion,
}) {
  if (
    !productVersion ||
    productVersion.publicationStatus !==
      'draft'
  ) {
    return
  }

  let changed =
    false

  const ingredientDeclarationText =
    normalizeAcceptedIngredientDeclaration(
      draft,
    )

  if (
    ingredientDeclarationText !==
      null
  ) {
    productVersion.ingredientDeclarationText =
      ingredientDeclarationText

    changed =
      true
  }

  const nutrition =
    normalizeAcceptedNutrition(
      draft,
    )

  if (nutrition) {
    productVersion.nutrition =
      nutrition

    changed =
      true
  }

  const allergens =
    normalizeAcceptedAllergens(
      draft,
    )

  if (allergens) {
    productVersion.allergens =
      allergens

    changed =
      true
  }

  const claims =
    normalizeAcceptedClaims(
      draft,
    )

  if (claims) {
    productVersion.claims =
      claims

    changed =
      true
  }

  if (changed) {
    await productVersion.save()
  }
}

async function ensureActiveDocument({
  Model,
  filter,
  label,
}) {
  const document =
    await Model.findOne(
      filter,
    )

  if (
    document &&
    document.status !==
      'active'
  ) {
    throw new ApiError(
      409,
      `${label} exists but is not active.`,
      [
        {
          code:
            'NPI_CATALOG_REFERENCE_NOT_ACTIVE',

          entityType:
            label,

          entityId:
            String(
              document._id,
            ),
        },
      ],
    )
  }

  return document
}

async function ensureBrand({
  draft,
  brandName,
  actorUserId,
}) {
  if (
    draft.canonicalBrandId
  ) {
    const canonical =
      await Brand.findById(
        draft.canonicalBrandId,
      )

    if (!canonical) {
      throw new ApiError(
        409,
        'The NPI draft references a canonical Brand that no longer exists.',
        [
          {
            code:
              'NPI_CATALOG_BRAND_NOT_FOUND',
          },
        ],
      )
    }

    if (
      canonical.status !==
        'active'
    ) {
      throw new ApiError(
        409,
        'The canonical Brand linked to this NPI draft is not active.',
        [
          {
            code:
              'NPI_CATALOG_BRAND_NOT_ACTIVE',
          },
        ],
      )
    }

    return canonical
  }

  const slug =
    normalizeCatalogSlug(
      brandName,
    )

  let brand =
    await ensureActiveDocument({
      Model:
        Brand,

      filter: {
        slug,
      },

      label:
        'Brand',
    })

  if (brand) {
    return brand
  }

  try {
    const created =
      await createCatalogBrand(
        {
          name:
            brandName,

          slug,

          aliases: [],

          description:
            'Created through governed M14 NPI to M04 catalog handoff.',

          status:
            'active',
        },
        actorUserId,
      )

    return Brand.findById(
      created.id,
    )
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    brand =
      await Brand.findOne({
        slug,
      })

    if (!brand) {
      throw error
    }

    return brand
  }
}

async function ensureCategory({
  categoryId,
  categoryName,
  actorUserId,
}) {
  if (categoryId) {
    const category =
      await Category.findById(
        categoryId,
      )

    if (!category) {
      throw new ApiError(
        404,
        'Selected M04 Category was not found.',
        [
          {
            code:
              'NPI_CATALOG_CATEGORY_NOT_FOUND',
          },
        ],
      )
    }

    if (
      category.status !==
        'active'
    ) {
      throw new ApiError(
        409,
        'Selected M04 Category is not active.',
        [
          {
            code:
              'NPI_CATALOG_CATEGORY_NOT_ACTIVE',
          },
        ],
      )
    }

    return category
  }

  const name =
    clean(
      categoryName,
    )

  if (!name) {
    throw new ApiError(
      400,
      'A canonical M04 Category name or Category ID is required.',
      [
        {
          code:
            'NPI_CATALOG_CATEGORY_REQUIRED',
        },
      ],
    )
  }

  const slug =
    normalizeCatalogSlug(
      name,
    )

  let category =
    await ensureActiveDocument({
      Model:
        Category,

      filter: {
        slug,
      },

      label:
        'Category',
    })

  if (category) {
    return category
  }

  try {
    const created =
      await createCatalogCategory(
        {
          name,
          slug,
          parentId:
            null,
          description:
            'Root category created through governed M14 NPI to M04 catalog handoff.',
          sortOrder:
            0,
          status:
            'active',
        },
        actorUserId,
      )

    return Category.findById(
      created.id,
    )
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    category =
      await Category.findOne({
        slug,
      })

    if (!category) {
      throw error
    }

    return category
  }
}

async function findFamilyPublicationBlocker(
  familyId,
) {
  const variants =
    await ProductVariant
      .find({
        familyId,
      })
      .select({
        _id:
          1,
      })
      .lean()

  if (!variants.length) {
    return null
  }

  const variantIds =
    variants.map(
      (variant) =>
        variant._id,
    )

  const packs =
    await Pack
      .find({
        variantId: {
          $in:
            variantIds,
        },
      })
      .select({
        _id:
          1,
      })
      .lean()

  if (!packs.length) {
    return null
  }

  const packIds =
    packs.map(
      (pack) =>
        pack._id,
    )

  return ProductVersion
    .findOne({
      packId: {
        $in:
          packIds,
      },

      publicationStatus: {
        $in: [
          'published',
          'retired',
        ],
      },
    })
    .select({
      _id:
        1,
      publicationStatus:
        1,
      packId:
        1,
    })
    .lean()
}

async function reconcileDraftFamilyCategory({
  family,
  categoryId,
  actorUserId,
}) {
  const sameCategory =
    String(
      family.categoryId,
    ) ===
    String(
      categoryId,
    )

  if (sameCategory) {
    return family
  }

  const publicationBlocker =
    await findFamilyPublicationBlocker(
      family._id,
    )

  if (publicationBlocker) {
    throw new ApiError(
      409,
      'An existing published Product Family with this canonical name belongs to a different Category. Reclassify it through A04 catalog governance before retrying the NPI handoff.',
      [
        {
          code:
            'NPI_CATALOG_FAMILY_CATEGORY_CONFLICT',

          productFamilyId:
            String(
              family._id,
            ),

          existingCategoryId:
            String(
              family.categoryId,
            ),

          requestedCategoryId:
            String(
              categoryId,
            ),

          blockingProductVersionId:
            String(
              publicationBlocker._id,
            ),

          blockingPublicationStatus:
            publicationBlocker.publicationStatus,
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Recover incomplete M14 -> M04 handoffs
  |--------------------------------------------------------------------------
  |
  | The M04 ProductFamily uniqueness contract is Brand + canonical slug. A
  | previous interrupted handoff can therefore leave an unpublished family
  | behind under an operator-entered category. The next governed retry must be
  | able to correct that non-published classification instead of permanently
  | deadlocking on its own partial artifact.
  |
  | Published or retired ProductVersions are never moved here; those require
  | explicit A04 catalog governance. Draft/in-review hierarchy is still mutable
  | catalog work and can safely follow the category selected by this approved
  | NPI handoff.
  */

  await updateProductFamily(
    family._id,
    {
      categoryId:
        String(
          categoryId,
        ),
    },
    actorUserId,
  )

  return ProductFamily.findById(
    family._id,
  )
}

async function ensureFamily({
  brandId,
  categoryId,
  canonicalName,
  actorUserId,
}) {
  const slug =
    normalizeCatalogSlug(
      canonicalName,
    )

  let family =
    await ensureActiveDocument({
      Model:
        ProductFamily,

      filter: {
        brandId,
        slug,
      },

      label:
        'Product Family',
    })

  if (family) {
    return reconcileDraftFamilyCategory({
      family,
      categoryId,
      actorUserId,
    })
  }

  try {
    const created =
      await createProductFamily(
        {
          brandId:
            String(
              brandId,
            ),
          categoryId:
            String(
              categoryId,
            ),
          canonicalName,
          slug,
          description:
            'Created through governed M14 NPI to M04 catalog handoff.',
          status:
            'active',
        },
        actorUserId,
      )

    return ProductFamily.findById(
      created.id,
    )
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    family =
      await ProductFamily.findOne({
        brandId,
        slug,
      })

    if (!family) {
      throw error
    }

    return reconcileDraftFamilyCategory({
      family,
      categoryId,
      actorUserId,
    })
  }
}

async function ensureVariant({
  familyId,
  canonicalName,
  market,
  actorUserId,
}) {
  const variantKey =
    normalizeCatalogKey(
      canonicalName,
    )

  const normalizedMarket =
    clean(
      market ||
        'IN',
    ).toUpperCase()

  let variant =
    await ensureActiveDocument({
      Model:
        ProductVariant,

      filter: {
        familyId,
        variantKey,
      },

      label:
        'Product Variant',
    })

  if (variant) {
    if (
      clean(
        variant.market,
      ).toUpperCase() !==
      normalizedMarket
    ) {
      throw new ApiError(
        409,
        'An existing Product Variant with this canonical key belongs to a different market.',
        [
          {
            code:
              'NPI_CATALOG_VARIANT_MARKET_CONFLICT',

            productVariantId:
              String(
                variant._id,
              ),

            existingMarket:
              variant.market,
          },
        ],
      )
    }

    return variant
  }

  try {
    const created =
      await createProductVariant(
        {
          familyId:
            String(
              familyId,
            ),
          canonicalName,
          variantKey,
          market:
            normalizedMarket,
          flavor:
            '',
          formulationKey:
            '',
          packForm:
            '',
          status:
            'active',
        },
        actorUserId,
      )

    return ProductVariant.findById(
      created.id,
    )
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    variant =
      await ProductVariant.findOne({
        familyId,
        variantKey,
      })

    if (!variant) {
      throw error
    }

    return variant
  }
}

async function ensurePack({
  variantId,
  displayName,
  quantity,
  packType,
  actorUserId,
}) {
  const packDisplayName =
    `${displayName} ${quantity.value} ${quantity.unit}`

  const packKey =
    normalizeCatalogKey(
      `${displayName}-${quantity.value}-${quantity.unit}`,
    )

  let pack =
    await ensureActiveDocument({
      Model:
        Pack,

      filter: {
        variantId,
        packKey,
      },

      label:
        'Pack',
    })

  if (pack) {
    return pack
  }

  try {
    const created =
      await createProductPack(
        {
          variantId:
            String(
              variantId,
            ),
          packKey,
          displayName:
            packDisplayName,
          packType,
          multipackCount:
            1,
          status:
            'active',
        },
        actorUserId,
      )

    return Pack.findById(
      created.id,
    )
  } catch (error) {
    if (
      error?.code !==
        11000
    ) {
      throw error
    }

    pack =
      await Pack.findOne({
        variantId,
        packKey,
      })

    if (!pack) {
      throw error
    }

    return pack
  }
}

async function attachNpiEvidence({
  draft,
  productVersionId,
  actorUser,
}) {
  const evidence =
    await ImageEvidence.find({
      _id: {
        $in:
          draft.sourceEvidenceIds ||
          [],
      },

      status:
        'active',
    }).lean()

  for (const item of evidence) {
    const externalReference =
      `npi-draft:${draft._id}:image:${item._id}`

    const existing =
      await EvidenceSource.findOne({
        entityType:
          'product_version',
        entityId:
          productVersionId,
        externalReference,
      })
        .select({
          _id: 1,
        })
        .lean()

    if (existing) {
      continue
    }

    await createEvidenceSource(
      {
        entityType:
          'product_version',
        entityId:
          String(
            productVersionId,
          ),
        sourceType:
          (draft.listingType ||
            'packaged') ===
            'packaged'
            ? 'brand_label'
            : 'retailer_observation',
        sourceName:
          (draft.listingType ||
            'packaged') ===
            'packaged'
            ? `NPI ${clean(item.purpose) || 'package'} evidence`
            : 'NPI produce photo evidence',
        sourceUri:
          '',
        externalReference,
        checksum:
          clean(
            item.sha256,
          ),
        evidenceState:
          'operator_declared',
        capturedAt:
          (
            item.capturedAt ||
            item.createdAt ||
            new Date()
          ).toISOString(),
        metadata: {
          npiDraftId:
            String(
              draft._id,
            ),
          imageEvidenceId:
            String(
              item._id,
            ),
          purpose:
            item.purpose,
          origin:
            draft.origin,
          market:
            draft.market,
          reviewStatus:
            draft.status,
        },
      },
      actorUser,
    )
  }

  const acceptedManualFields =
    Object.entries(
      draft.candidateFields ||
        {},
    )
      .filter(
        ([, item]) =>
          [
            'host_manual',
            'admin_manual',
          ].includes(
            item?.source,
          ) &&
          item?.reviewState ===
            'accepted',
      )
      .map(
        ([fieldPath]) =>
          fieldPath,
      )

  if (acceptedManualFields.length) {
    const manualSourceKey =
      draft.origin ===
        'admin_npi'
        ? 'admin-manual'
        : 'host-manual'

    const externalReference =
      `npi-draft:${draft._id}:${manualSourceKey}`

    const existingManualEvidence =
      await EvidenceSource.findOne({
        entityType:
          'product_version',
        entityId:
          productVersionId,
        externalReference,
      })
        .select({
          _id:
            1,
        })
        .lean()

    if (!existingManualEvidence) {
      await createEvidenceSource(
        {
          entityType:
            'product_version',
          entityId:
            String(
              productVersionId,
            ),
          sourceType:
            'brand_label',
          sourceName:
            draft.origin ===
              'admin_npi'
              ? 'Super Admin manual NPI declaration'
              : 'Host manual NPI declaration',
          sourceUri:
            '',
          externalReference,
          checksum:
            '',
          evidenceState:
            'operator_declared',
          capturedAt:
            (
              draft.updatedAt ||
              draft.createdAt ||
              new Date()
            ).toISOString(),
          metadata: {
            npiDraftId:
              String(
                draft._id,
              ),
            origin:
              draft.origin,
            market:
              draft.market,
            reviewStatus:
              draft.status,
            acceptedManualFields,
          },
        },
        actorUser,
      )
    }
  }

  if (
    evidence.length ===
      0
  ) {
    throw new ApiError(
      409,
      (draft.listingType ||
        'packaged') ===
        'packaged'
        ? 'At least one active NPI package evidence asset is required for M04 catalog materialization.'
        : 'At least one active NPI product photo is required for produce catalog materialization.',
      [
        {
          code:
            'NPI_CATALOG_EVIDENCE_REQUIRED',
        },
      ],
    )
  }
}

export async function materializeNpiDraftToCatalog({
  draftId,
  categoryId,
  categoryName,
  packType =
    'other',
  reason =
    '',
  fieldDecisions =
    [],
  actorUser,
  adminAuthorization,
  requestId,
}) {
  const actorUserId =
    actorId(
      actorUser,
    )

  const draft =
    await CommunityProductDraft.findById(
      draftId,
    )

  if (!draft) {
    throw new ApiError(
      404,
      'NPI draft was not found.',
      [
        {
          code:
            'NPI_CATALOG_HANDOFF_DRAFT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    draft.status !==
      'approved_for_catalog' ||
    draft.readyForCatalog !==
      true
  ) {
    throw new ApiError(
      409,
      'Only an approved NPI draft can be materialized into M04 catalog truth.',
      [
        {
          code:
            'NPI_CATALOG_HANDOFF_NOT_APPROVED',
        },
      ],
    )
  }

  if (
    draft.catalogProductVersionId
  ) {
    const existingVersion =
      await ProductVersion.findById(
        draft.catalogProductVersionId,
      )

    if (existingVersion) {
      return {
        alreadyMaterialized:
          true,
        draftId:
          String(
            draft._id,
          ),
        packId:
          String(
            draft.catalogPackId ||
            existingVersion.packId,
          ),
        productVersion:
          serializeCatalogProductVersion(
            existingVersion,
          ),
      }
    }
  }

  if (
    draft.duplicateCandidateProductVersionId
  ) {
    throw new ApiError(
      409,
      'This NPI draft has a duplicate Product Version candidate. Resolve the duplicate before creating new canonical catalog truth.',
      [
        {
          code:
            'NPI_CATALOG_DUPLICATE_REVIEW_REQUIRED',

          productVersionId:
            String(
              draft.duplicateCandidateProductVersionId,
            ),
        },
      ],
    )
  }

  const beforeCandidateReviewStates =
    candidateReviewStates(
      draft.candidateFields,
    )

  applyAcceptedHandoffFieldDecisions(
    draft,
    fieldDecisions,
  )

  const displayName =
    clean(
      acceptedCandidate(
        draft,
        'displayName',
        {
          required:
            true,
        },
      ),
    )

  const brandName =
    clean(
      acceptedCandidate(
        draft,
        'brandName',
        {
          required:
            !draft.canonicalBrandId,
        },
      ),
    )

  const gtin =
    clean(
      acceptedCandidate(
        draft,
        'gtin',
        {
          required:
            (draft.listingType ||
              'packaged') ===
              'packaged',
        },
      ) ||
      draft.barcode,
    )

  const quantity =
    parseNetQuantity(
      acceptedCandidate(
        draft,
        'netQuantity',
        {
          required:
            true,
        },
      ),
    )

  const countryOfOrigin =
    normalizeCountryOfOriginForCatalog(
      draft,
    )

  const manufacturerName =
    clean(
      acceptedCandidate(
        draft,
        'manufacturerName',
      ),
    )

  const brand =
    await ensureBrand({
      draft,
      brandName,
      actorUserId,
    })

  const category =
    await ensureCategory({
      categoryId,
      categoryName,
      actorUserId,
    })

  const family =
    await ensureFamily({
      brandId:
        brand._id,
      categoryId:
        category._id,
      canonicalName:
        displayName,
      actorUserId,
    })

  const variant =
    await ensureVariant({
      familyId:
        family._id,
      canonicalName:
        displayName,
      market:
        draft.market,
      actorUserId,
    })

  const pack =
    await ensurePack({
      variantId:
        variant._id,
      displayName,
      quantity,
      packType,
      actorUserId,
    })

  const openVersion =
    await ProductVersion.findOne({
      packId:
        pack._id,
      publicationStatus: {
        $in: [
          'draft',
          'in_review',
        ],
      },
    })
      .sort({
        version:
          -1,
      })

  let productVersion

  if (openVersion) {
    productVersion =
      openVersion
  } else {
    const created =
      await createProductDraft(
        {
          packId:
            String(
              pack._id,
            ),
          displayName,
          gtin:
            gtin ||
            null,
          netQuantity:
            quantity,
          countryOfOrigin,
          manufacturerName,
          changeReason:
            `Governed M14 NPI handoff from draft ${draft._id}. ${clean(reason || draft.reviewSummary)}`.trim(),
        },
        actorUserId,
      )

    productVersion =
      await ProductVersion.findById(
        created.id,
      )
  }

  await applyAcceptedNpiSafetyFacts({
    draft,
    productVersion,
  })

  await attachNpiEvidence({
    draft,
    productVersionId:
      productVersion._id,
    actorUser,
  })

  const beforeSnapshot = {
    candidateFieldReviewStates:
      beforeCandidateReviewStates,

    catalogPackId:
      draft.catalogPackId ||
      null,
    catalogProductVersionId:
      draft.catalogProductVersionId ||
      null,
    catalogHandoffAt:
      draft.catalogHandoffAt ||
      null,
  }

  draft.catalogPackId =
    pack._id

  draft.catalogProductVersionId =
    productVersion._id

  draft.catalogHandoffAt =
    new Date()

  draft.catalogHandoffByUserId =
    actorUserId

  await draft.save()

  const serializedVersion =
    serializeCatalogProductVersion(
      productVersion,
    )

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,
    action:
      'catalog.mutate',
    permissionKey:
      'catalog.mutate',
    entityType:
      'npi_catalog_handoff',
    entityId:
      String(
        draft._id,
      ),
    reasonCode:
      'catalog.governance',
    reasonDetails:
      clean(
        reason ||
        draft.reviewSummary ||
        'Approved NPI draft materialized into M04 catalog draft.',
      ),
    beforeSnapshot,
    afterSnapshot: {
      candidateFieldReviewStates:
        candidateReviewStates(
          draft.candidateFields,
        ),

      catalogBrandId:
        String(
          brand._id,
        ),
      catalogCategoryId:
        String(
          category._id,
        ),
      catalogProductFamilyId:
        String(
          family._id,
        ),
      catalogProductVariantId:
        String(
          variant._id,
        ),
      catalogPackId:
        String(
          pack._id,
        ),
      catalogProductVersionId:
        String(
          productVersion._id,
        ),
    },
    metadata: {
      origin:
        draft.origin,
      market:
        draft.market,
      packType,
    },
    requestId,
  })

  return {
    alreadyMaterialized:
      false,
    draftId:
      String(
        draft._id,
      ),
    brandId:
      String(
        brand._id,
      ),
    categoryId:
      String(
        category._id,
      ),
    productFamilyId:
      String(
        family._id,
      ),
    productVariantId:
      String(
        variant._id,
      ),
    packId:
      String(
        pack._id,
      ),
    productVersion:
      serializedVersion,
  }
}
