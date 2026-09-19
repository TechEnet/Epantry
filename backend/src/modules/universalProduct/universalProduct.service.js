import {
  fetchOpenFoodFactsProduct,
} from '../../integrations/productData/openFoodFacts.provider.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Brand,
  Category,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from '../catalog/catalog.models.js'

import {
  serializePublicProductRecord,
} from '../catalog/catalog.public.service.js'

import {
  createPantryObservationForHousehold,
  requireCurrentPantryHousehold,
  serializePantryItem,
  serializePantryObservation,
} from '../pantry/pantry.service.js'

import {
  BarcodeObservation,
  ProductIdentity,
  ProductIdentityMatch,
} from './universalProduct.models.js'

import {
  createExternalProductDraftFromOpenFoodFacts,
  serializeCommunityProductDraft,
} from './universalProduct.npi.service.js'

const NUMERIC_PRODUCT_CODE_PATTERN =
  /^\d{8,14}$/

const stringifyId = (
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

function actorIdFromUser(
  actorUser,
) {
  const actorUserId =
    actorUser?._id ||
    actorUser?.id

  if (
    !actorUserId
  ) {
    throw new ApiError(
      401,
      'Authenticated user identity is required.',
      [
        {
          code:
            'UNIVERSAL_PRODUCT_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return actorUserId
}

function normalizeMarket(
  value,
) {
  return (
    String(
      value ||
        'IN',
    )
      .trim()
      .toUpperCase()
      .slice(
        0,
        10,
      ) ||
    'IN'
  )
}

export function normalizeProductCode(
  value,
) {
  const raw =
    String(
      value ||
        '',
    ).trim()

  if (
    !raw
  ) {
    return ''
  }

  return /^\d+$/.test(
    raw,
  )
    ? raw
    : raw
        .replace(
          /\s+/g,
          '',
        )
        .slice(
          0,
          180,
        )
}

function inferIdentityScheme(
  decodedFormat,
) {
  const format =
    String(
      decodedFormat ||
        '',
    ).toUpperCase()

  if (
    format.includes(
      'UPC',
    )
  ) {
    return 'upc'
  }

  if (
    format.includes(
      'EAN',
    )
  ) {
    return 'ean'
  }

  return 'gtin'
}

function isEffectiveAt(
  version,
  at =
    new Date(),
) {
  if (
    !version
  ) {
    return false
  }

  const effectiveFrom =
    version.effectiveFrom
      ? new Date(
          version.effectiveFrom,
        )
      : null

  const effectiveTo =
    version.effectiveTo
      ? new Date(
          version.effectiveTo,
        )
      : null

  return (
    (
      !effectiveFrom ||
      effectiveFrom <=
        at
    ) &&
    (
      !effectiveTo ||
      effectiveTo >
        at
    )
  )
}

function buildCurrentPublishedMatch(
  at =
    new Date(),
) {
  return {
    publicationStatus:
      'published',

    $and: [
      {
        $or: [
          {
            effectiveFrom:
              null,
          },
          {
            effectiveFrom: {
              $lte:
                at,
            },
          },
        ],
      },
      {
        $or: [
          {
            effectiveTo:
              null,
          },
          {
            effectiveTo: {
              $gt:
                at,
            },
          },
        ],
      },
    ],
  }
}

async function loadCanonicalHierarchy(
  productVersion,
) {
  if (
    !productVersion
  ) {
    return null
  }

  const pack =
    await Pack
      .findById(
        productVersion.packId,
      )
      .lean()

  if (
    !pack
  ) {
    return null
  }

  const variant =
    await ProductVariant
      .findById(
        productVersion.variantId,
      )
      .lean()

  if (
    !variant
  ) {
    return null
  }

  const family =
    await ProductFamily
      .findById(
        variant.familyId,
      )
      .lean()

  if (
    !family
  ) {
    return null
  }

  const [
    brand,
    category,
  ] =
    await Promise.all([
      Brand
        .findById(
          family.brandId,
        )
        .lean(),

      Category
        .findById(
          family.categoryId,
        )
        .lean(),
    ])

  if (
    !brand ||
    !category
  ) {
    return null
  }

  return {
    ...productVersion,

    pack,

    variant,

    family,

    brand,

    category,
  }
}

async function findPublishedVersionForIdentity({
  identity,
  normalizedCode,
  at,
}) {
  if (
    identity?.productVersionId
  ) {
    const exactVersion =
      await ProductVersion
        .findOne({
          _id:
            identity.productVersionId,

          publicationStatus:
            'published',
        })
        .lean()

    if (
      exactVersion
    ) {
      return exactVersion
    }
  }

  if (
    identity?.packId
  ) {
    const currentByPack =
      await ProductVersion
        .findOne({
          packId:
            identity.packId,

          ...buildCurrentPublishedMatch(
            at,
          ),
        })
        .sort({
          version:
            -1,
        })
        .lean()

    if (
      currentByPack
    ) {
      return currentByPack
    }

    const historicalByPack =
      await ProductVersion
        .findOne({
          packId:
            identity.packId,

          publicationStatus:
            'published',
        })
        .sort({
          effectiveFrom:
            -1,

          version:
            -1,
        })
        .lean()

    if (
      historicalByPack
    ) {
      return historicalByPack
    }
  }

  const currentByGtin =
    await ProductVersion
      .findOne({
        gtin:
          normalizedCode,

        ...buildCurrentPublishedMatch(
          at,
        ),
      })
      .sort({
        version:
          -1,
      })
      .lean()

  if (
    currentByGtin
  ) {
    return currentByGtin
  }

  return ProductVersion
    .findOne({
      gtin:
        normalizedCode,

      publicationStatus:
        'published',
    })
    .sort({
      effectiveFrom:
        -1,

      version:
        -1,
    })
    .lean()
}

function serializeObservation(
  observation,
) {
  if (
    !observation
  ) {
    return null
  }

  return {
    id:
      stringifyId(
        observation._id ||
        observation.id,
      ),

    resolutionState:
      observation.resolutionState,

    decodedFormat:
      observation.decodedFormat,

    observedAt:
      observation.observedAt,
  }
}

function serializeResolutionProduct(
  canonicalRecord,
) {
  return canonicalRecord
    ? serializePublicProductRecord(
        canonicalRecord,
        {
          detail:
            false,
        },
      )
    : null
}

function serializeExternalCandidate(
  externalResult,
) {
  if (
    !externalResult?.found
  ) {
    return null
  }

  const candidate =
    externalResult.candidate ||
    {}

  return {
    verificationStatus:
      'unverified',

    confidence:
      Number(
        externalResult.confidence ||
          0,
      ),

    source: {
      provider:
        externalResult.source
          ?.provider ||
        '',

      sourceName:
        externalResult.source
          ?.sourceName ||
        '',

      capturedAt:
        externalResult.source
          ?.capturedAt ||
        null,
    },

    barcode:
      candidate.barcode ||
      '',

    title:
      candidate.title ||
      '',

    genericName:
      candidate.genericName ||
      '',

    brandName:
      candidate.brandName ||
      '',

    netQuantityText:
      candidate.netQuantityText ||
      '',

    ingredientDeclarationText:
      candidate
        .ingredientDeclarationText ||
      '',

    allergenText:
      candidate.allergenText ||
      '',

    allergenTags:
      candidate.allergenTags ||
      [],

    traceTags:
      candidate.traceTags ||
      [],

    categoryText:
      candidate.categoryText ||
      '',

    countryText:
      candidate.countryText ||
      '',

    manufacturingPlaces:
      candidate.manufacturingPlaces ||
      '',

    originText:
      candidate.originText ||
      '',

    nutritionBasis:
      candidate.nutritionBasis ||
      null,

    nutrition:
      candidate.nutrition ||
      [],

    referenceImages:
      candidate.referenceImages ||
      {},
  }
}

async function tryExternalBarcodeEvidence({
  normalizedCode,
  normalizedMarket,
  actorUser,
  persistExternalDraft =
    true,
}) {
  try {
    const externalResult =
      await fetchOpenFoodFactsProduct(
        normalizedCode,
      )

    if (
      !externalResult.found
    ) {
      return {
        found:
          false,

        reason:
          externalResult.reason ||
          'not_found',
      }
    }

    const draft =
      persistExternalDraft
        ? await createExternalProductDraftFromOpenFoodFacts({
            externalResult,

            actorUser,

            market:
              normalizedMarket,
          })
        : null

    return {
      found:
        true,

      externalResult,

      draft,
    }
  } catch (error) {
    return {
      found:
        false,

      reason:
        'provider_unavailable',

      providerErrorCode:
        error.code ||
        'OPEN_FOOD_FACTS_UNAVAILABLE',
    }
  }
}

export async function resolveUniversalProductBarcode({
  code,
  decodedFormat =
    'UNKNOWN',
  source =
    'camera',
  market =
    'IN',
  actorUser,
  requestId =
    '',
  persistExternalDraft =
    true,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const normalizedCode =
    normalizeProductCode(
      code,
    )

  const normalizedMarket =
    normalizeMarket(
      market,
    )

  const observedAt =
    new Date()

  if (
    !NUMERIC_PRODUCT_CODE_PATTERN.test(
      normalizedCode,
    )
  ) {
    const observation =
      await BarcodeObservation.create({
        code:
          String(
            code ||
              '',
          ).trim(),

        normalizedCode,

        decodedFormat,

        source,

        market:
          normalizedMarket,

        resolutionState:
          'unsupported',

        observedByUserId:
          actorUserId,

        requestId,

        observedAt,
      })

    return {
      state:
        'unsupported',

      verificationStatus:
        'unverified',

      observation:
        serializeObservation(
          observation,
        ),

      product:
        null,

      provisionalDraft:
        null,

      passportUrl:
        null,

      nextAction:
        'capture_supported_gtin_or_upload_product_evidence',

      reasonCodes: [
        'PRODUCT_CODE_NOT_GTIN_EAN_UPC',
      ],
    }
  }

  const scheme =
    inferIdentityScheme(
      decodedFormat,
    )

  const identity =
    await ProductIdentity
      .findOne({
        scheme: {
          $in: [
            scheme,
            'gtin',
          ],
        },

        value:
          normalizedCode,

        market:
          normalizedMarket,

        status:
          'active',

        $and: [
          {
            $or: [
              {
                validFrom:
                  null,
              },
              {
                validFrom: {
                  $lte:
                    observedAt,
                },
              },
            ],
          },
          {
            $or: [
              {
                validTo:
                  null,
              },
              {
                validTo: {
                  $gt:
                    observedAt,
                },
              },
            ],
          },
        ],
      })
      .sort({
        validFrom:
          -1,
      })
      .lean()

  const productVersion =
    await findPublishedVersionForIdentity({
      identity,

      normalizedCode,

      at:
        observedAt,
    })

  if (
    !productVersion
  ) {
    const external =
      await tryExternalBarcodeEvidence({
        normalizedCode,

        normalizedMarket,

        actorUser,

        persistExternalDraft,
      })

    if (
      external.found
    ) {
      const score =
        external
          .externalResult
          .confidence ||
        0.65

      const observation =
        await BarcodeObservation.create({
          code:
            normalizedCode,

          normalizedCode,

          decodedFormat,

          source,

          market:
            normalizedMarket,

          resolutionState:
            'provisional_external',

          identityId:
            identity?._id ||
            null,

          provisionalDraftId:
            external.draft?._id ||
            null,

          matchMethod:
            'external_evidence',

          confidence:
            score,

          observedByUserId:
            actorUserId,

          requestId,

          observedAt,
        })

      if (
        external.draft
      ) {
        await ProductIdentityMatch.create({
          barcodeObservationId:
            observation._id,

          productIdentityId:
            identity?._id ||
            null,

          provisionalDraftId:
            external.draft._id,

          method:
            'external_evidence',

          score,

          status:
            'pending_review',

          reasonCodes: [
            'EXTERNAL_EVIDENCE_CANDIDATE_ONLY',
            'CANONICAL_MATCH_NOT_ESTABLISHED',
          ],
        })
      }

      return {
        state:
          'provisional_external',

        verificationStatus:
          'unverified',

        observation:
          serializeObservation(
            observation,
          ),

        product:
          null,

        provisionalDraft:
          external.draft
            ? serializeCommunityProductDraft(
                external.draft,
                {
                  includeExternalEvidence:
                    true,
                },
              )
            : null,

        externalCandidate:
          serializeExternalCandidate(
            external.externalResult,
          ),

        passportUrl:
          null,

        nextAction:
          persistExternalDraft
            ? 'upload_product_evidence'
            : 'review_external_candidate',

        reasonCodes: [
          'NO_CANONICAL_PRODUCT_MATCH',
          'EXTERNAL_EVIDENCE_CANDIDATE_FOUND',
          'EXTERNAL_FACTS_REQUIRE_REVIEW',
        ],
      }
    }

    const observation =
      await BarcodeObservation.create({
        code:
          normalizedCode,

        normalizedCode,

        decodedFormat,

        source,

        market:
          normalizedMarket,

        resolutionState:
          'unresolved',

        identityId:
          identity?._id ||
          null,

        observedByUserId:
          actorUserId,

        requestId,

        observedAt,
      })

    const reasonCodes = [
      'NO_CANONICAL_PRODUCT_MATCH',
    ]

    reasonCodes.push(
      external.reason ===
      'provider_unavailable'
        ? 'EXTERNAL_PRODUCT_EVIDENCE_UNAVAILABLE'
        : 'NO_EXTERNAL_PRODUCT_EVIDENCE_MATCH',
    )

    return {
      state:
        'unresolved',

      verificationStatus:
        'unverified',

      observation:
        serializeObservation(
          observation,
        ),

      product:
        null,

      provisionalDraft:
        null,

      passportUrl:
        null,

      nextAction:
        'upload_product_evidence',

      reasonCodes,
    }
  }

  const canonicalRecord =
    await loadCanonicalHierarchy(
      productVersion,
    )

  if (
    !canonicalRecord
  ) {
    throw new ApiError(
      409,
      'Canonical product hierarchy is incomplete.',
      [
        {
          code:
            'UNIVERSAL_PRODUCT_CANONICAL_HIERARCHY_INCOMPLETE',
        },
      ],
    )
  }

  const current =
    isEffectiveAt(
      productVersion,
      observedAt,
    )

  const resolutionState =
    current
      ? 'verified_current'
      : 'verified_historical'

  const matchMethod =
    identity
      ? 'product_identity'
      : 'product_version_gtin'

  const observation =
    await BarcodeObservation.create({
      code:
        normalizedCode,

      normalizedCode,

      decodedFormat,

      source,

      market:
        normalizedMarket,

      resolutionState,

      identityId:
        identity?._id ||
        null,

      canonicalProductVersionId:
        productVersion._id,

      canonicalPackId:
        productVersion.packId,

      matchMethod,

      confidence:
        1,

      observedByUserId:
        actorUserId,

      requestId,

      observedAt,
    })

  await ProductIdentityMatch.create({
    barcodeObservationId:
      observation._id,

    productIdentityId:
      identity?._id ||
      null,

    candidateProductVersionId:
      productVersion._id,

    candidatePackId:
      productVersion.packId,

    method:
      matchMethod,

    score:
      1,

    status:
      'accepted',

    reasonCodes: [
      identity
        ? 'EXACT_CANONICAL_IDENTITY_MATCH'
        : 'EXACT_PUBLISHED_GTIN_MATCH',
    ],

    decidedAt:
      observedAt,
  })

  return {
    state:
      resolutionState,

    verificationStatus:
      'verified',

    observation:
      serializeObservation(
        observation,
      ),

    product:
      serializeResolutionProduct(
        canonicalRecord,
      ),

    provisionalDraft:
      null,

    passportUrl:
      `/products/${String(
        productVersion._id,
      )}/passport`,

    nextAction:
      current
        ? 'view_product_passport'
        : 'view_historical_product_passport',

    reasonCodes: [
      current
        ? 'CANONICAL_CURRENT_PRODUCT_MATCH'
        : 'CANONICAL_HISTORICAL_PRODUCT_MATCH',
    ],
  }
}

function summarizeProvenance(
  version,
) {
  const provenance =
    Array.isArray(
      version?.provenance,
    )
      ? version.provenance
      : []

  const numericConfidences =
    provenance
      .map(
        (
          entry,
        ) =>
          entry?.confidence,
      )
      .filter(
        (
          value,
        ) =>
          Number.isFinite(
            Number(
              value,
            ),
          ),
      )
      .map(
        Number,
      )

  return {
    fieldEvidenceCount:
      provenance.length,

    lowestRecordedConfidence:
      numericConfidences.length
        ? Math.min(
            ...numericConfidences,
          )
        : null,

    hasReviewRequiredEvidence:
      provenance.some(
        (
          entry,
        ) =>
          entry?.evidenceState ===
          'unknown_review_required',
      ),

    confidenceDisplay:
      provenance.length
        ? 'field_provenance_available'
        : 'published_canonical_no_field_score',
  }
}

function serializeSafetyFacts(
  version,
) {
  const allergens =
    Array.isArray(
      version?.allergens,
    )
      ? version.allergens
      : []

  return {
    allergenCoverageStatus:
      allergens.length
        ? 'declared_relationships_available'
        : 'unknown_not_declared',

    allergens:
      allergens.map(
        (
          allergen,
        ) => ({
          allergenKey:
            allergen.allergenKey,

          relationType:
            allergen.relationType,

          evidenceState:
            allergen.evidenceState ||
            'unknown_review_required',
        }),
      ),

    claims:
      (
        version.claims ||
        []
      ).map(
        (
          claim,
        ) => ({
          key:
            claim.key,

          label:
            claim.label,

          evidenceState:
            claim.evidenceState ||
            'unknown_review_required',
        }),
      ),

    certifications:
      (
        version.certifications ||
        []
      ).map(
        (
          certification,
        ) => ({
          key:
            certification.key,

          label:
            certification.label,

          certificateReference:
            certification.certificateReference ||
            '',

          evidenceState:
            certification.evidenceState ||
            'unknown_review_required',
        }),
      ),
  }
}

export async function getProductPassport(
  productVersionId,
) {
  const productVersion =
    await ProductVersion
      .findOne({
        _id:
          productVersionId,

        publicationStatus:
          'published',
      })
      .lean()

  if (
    !productVersion
  ) {
    throw new ApiError(
      404,
      'Product Passport was not found.',
      [
        {
          code:
            'PRODUCT_PASSPORT_NOT_FOUND',
        },
      ],
    )
  }

  const canonicalRecord =
    await loadCanonicalHierarchy(
      productVersion,
    )

  if (
    !canonicalRecord
  ) {
    throw new ApiError(
      409,
      'Canonical product hierarchy is incomplete.',
      [
        {
          code:
            'PRODUCT_PASSPORT_HIERARCHY_INCOMPLETE',
        },
      ],
    )
  }

  const now =
    new Date()

  const timeline =
    await ProductVersion
      .find({
        packId:
          productVersion.packId,

        publicationStatus:
          'published',
      })
      .sort({
        version:
          -1,
      })
      .select(
        '_id version displayName gtin effectiveFrom effectiveTo publishedAt supersedesVersionId changeReason',
      )
      .lean()

  return {
    id:
      stringifyId(
        productVersion._id,
      ),

    verification: {
      state:
        isEffectiveAt(
          productVersion,
          now,
        )
          ? 'verified_current'
          : 'verified_historical',

      provisional:
        false,

      sourceOfTruth:
        'epantry_canonical_product_version',
    },

    product:
      serializePublicProductRecord(
        canonicalRecord,
        {
          detail:
            true,
        },
      ),

    safety:
      serializeSafetyFacts(
        productVersion,
      ),

    evidence:
      summarizeProvenance(
        productVersion,
      ),

    historicalTimeline:
      timeline.map(
        (
          version,
        ) => ({
          productVersionId:
            stringifyId(
              version._id,
            ),

          version:
            version.version,

          displayName:
            version.displayName,

          gtin:
            version.gtin ||
            null,

          effectiveFrom:
            version.effectiveFrom ||
            null,

          effectiveTo:
            version.effectiveTo ||
            null,

          publishedAt:
            version.publishedAt ||
            null,

          supersedesVersionId:
            stringifyId(
              version.supersedesVersionId,
            ),

          changeReason:
            version.changeReason ||
            '',

          currentNow:
            isEffectiveAt(
              version,
              now,
            ),
        }),
      ),

    policy: {
      historicalFormulationIsImmutable:
        true,

      retailerObservationsAreCanonicalTruth:
        false,

      unknownAllergenMeansFreeFrom:
        false,

      commerceAvailabilityIsSeparate:
        true,
    },
  }
}

export async function addProductPassportToPantry({
  productVersionId,
  sourceType =
    'barcode_capture',
  quantity,
  storageZone,
  note =
    '',
  actorUser,
}) {
  const productVersion =
    await ProductVersion
      .findOne({
        _id:
          productVersionId,

        publicationStatus:
          'published',
      })
      .select(
        '_id packId',
      )
      .lean()

  if (
    !productVersion
  ) {
    throw new ApiError(
      404,
      'Published product was not found.',
      [
        {
          code:
            'PRODUCT_PASSPORT_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const result =
    await createPantryObservationForHousehold({
      householdId,

      canonicalPackId:
        productVersion.packId,

      canonicalIngredientId:
        null,

      sourceType,

      quantity,

      storageZone,

      note,

      actorUser,
    })

  return {
    item:
      serializePantryItem(
        result.item,
      ),

    observation:
      serializePantryObservation(
        result.observation,
      ),
  }
}