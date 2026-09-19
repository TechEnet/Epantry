import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  buildSignedProductEvidenceUrl,
} from '../../integrations/media/cloudinary.provider.js'

import {
  MediaSafetyAssessment,
  PrivacyReviewCase,
} from '../mediaPrivacy/mediaPrivacy.models.js'

import {
  CommunityProductDraft,
  ImageEvidence,
} from '../universalProduct/universalProduct.models.js'

import {
  HostOffer,
} from '../marketplace/marketplace.models.js'

import {
  normalizeCatalogKey,
  normalizeCatalogSlug,
  NUTRITION_BASIS_TYPES,
  PRODUCT_ALLERGEN_RELATION_TYPES,
  PRODUCT_QUANTITY_UNITS,
} from './catalog.constants.js'

import {
  Brand,
  Category,
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from './catalog.models.js'

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function escapeRegex(
  value,
) {
  return String(
    value ||
      '',
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
}

function stringifyId(
  value,
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null
  }

  return String(
    value,
  )
}


const PUBLIC_BROWSE_CATEGORIES = [
  {
    slug:
      'fruits',
    name:
      'Fruits',
    description:
      'Fresh fruit listings.',
    sortOrder:
      10,
  },
  {
    slug:
      'vegetables',
    name:
      'Vegetables',
    description:
      'Fresh vegetable listings.',
    sortOrder:
      20,
  },
  {
    slug:
      'rice-grains',
    name:
      'Rice & Grains',
    description:
      'Rice, grains and staple cereals.',
    sortOrder:
      30,
  },
  {
    slug:
      'spices-condiments',
    name:
      'Spices & Condiments',
    description:
      'Spices, pastes, sauces and condiments.',
    sortOrder:
      40,
  },
  {
    slug:
      'tea-coffee',
    name:
      'Tea & Coffee',
    description:
      'Tea, coffee and matcha products.',
    sortOrder:
      50,
  },
  {
    slug:
      'oils-fats',
    name:
      'Oils & Fats',
    description:
      'Cooking oils, ghee and pantry fats.',
    sortOrder:
      60,
  },
  {
    slug:
      'sweeteners-syrups',
    name:
      'Sweeteners & Syrups',
    description:
      'Syrups, honey, sugar and sweeteners.',
    sortOrder:
      70,
  },
  {
    slug:
      'beverages',
    name:
      'Beverages',
    description:
      'Drinks, juices and other beverages.',
    sortOrder:
      80,
  },
  {
    slug:
      'pantry-staples',
    name:
      'Pantry Staples',
    description:
      'Other published pantry essentials.',
    sortOrder:
      90,
  },
]

const PUBLIC_BROWSE_CATEGORY_SLUGS =
  new Set(
    PUBLIC_BROWSE_CATEGORIES.map(
      (category) =>
        category.slug,
    ),
  )

function buildPublicBrowseClassificationPipeline() {
  return [
    {
      $lookup: {
        from:
          CommunityProductDraft
            .collection
            .name,

        let: {
          productVersionId:
            '$_id',
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      '$catalogProductVersionId',
                      '$$productVersionId',
                    ],
                  },
                  {
                    $eq: [
                      '$status',
                      'approved_for_catalog',
                    ],
                  },
                  {
                    $eq: [
                      '$readyForCatalog',
                      true,
                    ],
                  },
                ],
              },
            },
          },
          {
            $sort: {
              reviewedAt:
                -1,
              updatedAt:
                -1,
            },
          },
          {
            $project: {
              _id:
                0,
              listingType:
                1,
            },
          },
          {
            $limit:
              1,
          },
        ],

        as:
          '_browseNpiDraft',
      },
    },
    {
      $set: {
        _browseListingType: {
          $ifNull: [
            {
              $arrayElemAt: [
                '$_browseNpiDraft.listingType',
                0,
              ],
            },
            '',
          ],
        },
        _browseSearchText: {
          $toLower: {
            $concat: [
              {
                $ifNull: [
                  '$displayName',
                  '',
                ],
              },
              ' ',
              {
                $ifNull: [
                  '$family.canonicalName',
                  '',
                ],
              },
              ' ',
              {
                $ifNull: [
                  '$category.name',
                  '',
                ],
              },
            ],
          },
        },
      },
    },
    {
      $set: {
        _browseCategorySlug: {
          $switch: {
            branches: [
              {
                case: {
                  $eq: [
                    '$_browseListingType',
                    'fruit',
                  ],
                },
                then:
                  'fruits',
              },
              {
                case: {
                  $eq: [
                    '$_browseListingType',
                    'vegetable',
                  ],
                },
                then:
                  'vegetables',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(energy drink|soft drink|beverage|juice|soda|sparkling water|tonic water)',
                  },
                },
                then:
                  'beverages',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(tomato|okra|bhindi|bottle gourd|lauki|broccoli|bell pepper|capsicum|potato|onion|garlic|carrot|cabbage|cauliflower|spinach|cucumber|brinjal|eggplant|green beans|peas|vegetable)',
                  },
                },
                then:
                  'vegetables',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(banana|mango|pomegranate|avocado|kiwi|apple|orange|grape|guava|papaya|pineapple|pear|peach|plum|berry|berries|watermelon|melon|fruits?)',
                  },
                },
                then:
                  'fruits',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(rice|basmati|jasmine rice|grain|quinoa|oats|wheat|cereal)',
                  },
                },
                then:
                  'rice-grains',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(paprika|mustard|tahini|gochujang|sauce|paste|spice|seasoning|chutney|pickle|ketchup|masala|salt|pepper)',
                  },
                },
                then:
                  'spices-condiments',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(matcha|tea|coffee)',
                  },
                },
                then:
                  'tea-coffee',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(olive oil|cooking oil|edible oil|oil|ghee)',
                  },
                },
                then:
                  'oils-fats',
              },
              {
                case: {
                  $regexMatch: {
                    input:
                      '$_browseSearchText',
                    regex:
                      '(maple syrup|syrup|honey|sugar|jaggery|sweetener)',
                  },
                },
                then:
                  'sweeteners-syrups',
              },
            ],
            default:
              'pantry-staples',
          },
        },
      },
    },
    {
      $unset: [
        '_browseNpiDraft',
        '_browseListingType',
        '_browseSearchText',
      ],
    },
  ]
}

function serializeQuantity(
  quantity,
) {
  if (!quantity) {
    return null
  }

  const value =
    typeof quantity.toObject ===
    'function'
      ? quantity.toObject()
      : quantity

  return {
    value:
      value?.value ??
      null,

    unit:
      value?.unit ||
      null,
  }
}


function cleanText(
  value,
) {
  return String(
    value ?? '',
  ).trim()
}

function acceptedNpiField(
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

function normalizeNpiQuantity(
  value,
) {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null
  }

  const amount =
    Number(
      value.value,
    )

  const unit =
    cleanText(
      value.unit,
    )
      .toLowerCase()
      .replace(
        /\./g,
        '',
      )

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0 ||
    !PRODUCT_QUANTITY_UNITS.includes(
      unit,
    )
  ) {
    return null
  }

  return {
    value:
      amount,
    unit,
  }
}

function normalizeApprovedNpiNutrition(
  draft,
) {
  const item =
    acceptedNpiField(
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
            cleanText(
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

  if (!nutrients.length) {
    return null
  }

  return {
    basis:
      NUTRITION_BASIS_TYPES.includes(
        value.basis,
      )
        ? value.basis
        : null,

    servingSize:
      normalizeNpiQuantity(
        value.servingSize,
      ),

    nutrients,
  }
}

function normalizeApprovedNpiAllergens(
  draft,
) {
  const item =
    acceptedNpiField(
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

  const allergens =
    (
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

          if (!allergenKey) {
            return null
          }

          return {
            allergenKey,

            relationType:
              PRODUCT_ALLERGEN_RELATION_TYPES.includes(
                allergen?.relationType,
              )
                ? allergen.relationType
                : 'unknown',
          }
        },
      )
      .filter(
        Boolean,
      )

  return allergens.length
    ? allergens
    : null
}

function normalizeApprovedNpiAllergenStatement(
  draft,
) {
  const item =
    acceptedNpiField(
      draft,
      'allergens',
    )

  if (!item) {
    return ''
  }

  return cleanText(
    item?.value
      ?.statement,
  )
}

function normalizeApprovedNpiCountryOfOrigin(
  draft,
) {
  const item =
    acceptedNpiField(
      draft,
      'countryOfOrigin',
    )

  if (!item) {
    return ''
  }

  const value =
    cleanText(
      item.value,
    )

  if (
    !value ||
    value.length > 120
  ) {
    return ''
  }

  if (
    item.source ===
      'external_database' &&
    value
      .split(
        /[,;|]/,
      )
      .map(
        cleanText,
      )
      .filter(
        Boolean,
      ).length > 1
  ) {
    return ''
  }

  return value
}

async function enrichProductWithApprovedNpiFacts(
  record,
) {
  const version =
    typeof record?.toObject ===
      'function'
      ? record.toObject()
      : {
          ...(record || {}),
        }

  const productVersionId =
    version._id ||
    version.id

  if (!productVersionId) {
    return version
  }

  const missingIngredientDeclaration =
    !cleanText(
      version.ingredientDeclarationText,
    )

  const missingNutrition =
    !Array.isArray(
      version.nutrition
        ?.nutrients,
    ) ||
    version.nutrition.nutrients.length ===
      0

  const missingAllergens =
    !Array.isArray(
      version.allergens,
    ) ||
    version.allergens.length ===
      0

  const missingAllergenStatement =
    !cleanText(
      version.allergenStatement,
    )

  const missingCountryOfOrigin =
    !cleanText(
      version.countryOfOrigin,
    )

  const missingManufacturer =
    !cleanText(
      version.manufacturerName,
    )

  if (
    !missingIngredientDeclaration &&
    !missingNutrition &&
    !missingAllergens &&
    !missingAllergenStatement &&
    !missingCountryOfOrigin &&
    !missingManufacturer
  ) {
    return version
  }

  const draft =
    await CommunityProductDraft.findOne({
      catalogProductVersionId:
        productVersionId,

      status:
        'approved_for_catalog',

      verificationStatus:
        'reviewed',

      readyForCatalog:
        true,

      reviewedByUserId: {
        $ne:
          null,
      },
    })
      .sort({
        reviewedAt:
          -1,
        updatedAt:
          -1,
      })
      .select({
        candidateFields:
          1,
      })
      .lean()

  if (!draft) {
    return version
  }

  if (
    missingIngredientDeclaration
  ) {
    const item =
      acceptedNpiField(
        draft,
        'ingredientDeclarationText',
      )

    const value =
      cleanText(
        item?.value,
      )

    if (value) {
      version.ingredientDeclarationText =
        value
    }
  }

  if (missingNutrition) {
    const nutrition =
      normalizeApprovedNpiNutrition(
        draft,
      )

    if (nutrition) {
      version.nutrition =
        nutrition
    }
  }

  if (missingAllergens) {
    const allergens =
      normalizeApprovedNpiAllergens(
        draft,
      )

    if (allergens) {
      version.allergens =
        allergens
    }
  }

  if (
    missingAllergenStatement
  ) {
    const allergenStatement =
      normalizeApprovedNpiAllergenStatement(
        draft,
      )

    if (allergenStatement) {
      version.allergenStatement =
        allergenStatement
    }
  }

  if (
    missingCountryOfOrigin
  ) {
    const countryOfOrigin =
      normalizeApprovedNpiCountryOfOrigin(
        draft,
      )

    if (countryOfOrigin) {
      version.countryOfOrigin =
        countryOfOrigin
    }
  }

  if (missingManufacturer) {
    const item =
      acceptedNpiField(
        draft,
        'manufacturerName',
      )

    const value =
      cleanText(
        item?.value,
      )

    if (value) {
      version.manufacturerName =
        value
    }
  }

  return version
}


const GOVERNED_PACKAGE_EVIDENCE_PURPOSES =
  new Set([
    'front_pack',
    'back_pack',
    'side_panel',
    'ingredient_panel',
    'nutrition_panel',
    'allergen_statement',
    'barcode',
    'certification_mark',
  ])

const HARD_PRIVACY_RISK_TYPES =
  new Set([
    'face',
    'receipt_personal_data',
    'personal_correspondence',
    'household_information',
    'geolocation_metadata',
    'device_metadata',
  ])

function isHumanPrivacyReviewBlocking(
  reviewCase,
) {
  if (!reviewCase) {
    return false
  }

  if (
    reviewCase.status ===
      'resolved'
  ) {
    return (
      reviewCase.decision !==
      'safe_to_use'
    )
  }

  if (
    reviewCase.status ===
      'in_review' ||
    Boolean(
      reviewCase.assignedToUserId,
    )
  ) {
    return true
  }

  return false
}

function assessmentHasHardPrivacyRisk(
  assessment,
) {
  const findings =
    Array.isArray(
      assessment?.findings,
    )
      ? assessment.findings
      : []

  return findings.some(
    (finding) => {
      const riskType =
        String(
          finding?.riskType ||
            '',
        )

      const severity =
        String(
          finding?.severity ||
            '',
        )

      if (
        HARD_PRIVACY_RISK_TYPES.has(
          riskType,
        )
      ) {
        return true
      }

      if (
        severity ===
          'critical'
      ) {
        return true
      }

      if (
        severity ===
          'high' &&
        riskType !==
          'home_address'
      ) {
        return true
      }

      return false
    },
  )
}

function isAuthenticatedSanitizedEvidence(
  evidence,
) {
  return (
    evidence?.status ===
      'active' &&
    evidence?.provider ===
      'cloudinary' &&
    evidence?.deliveryType ===
      'authenticated' &&
    evidence?.uploadSignatureVerified !==
      false &&
    String(
      evidence?.publicId ||
        '',
    ).includes(
      '/privacy-v1/',
    )
  )
}

function isApprovedHostNpiDraftForEvidence({
  draft,
  productVersionId,
  imageEvidenceId,
}) {
  if (!draft) {
    return false
  }

  const sourceEvidenceIds =
    new Set(
      (
        draft.sourceEvidenceIds ||
        []
      ).map(
        stringifyId,
      ),
    )

  return (
    [
      'host_npi',
      'admin_npi',
    ].includes(
      draft.origin,
    ) &&
    draft.status ===
      'approved_for_catalog' &&
    draft.verificationStatus ===
      'reviewed' &&
    draft.readyForCatalog ===
      true &&
    Boolean(
      draft.reviewedByUserId,
    ) &&
    stringifyId(
      draft.catalogProductVersionId,
    ) ===
      stringifyId(
        productVersionId,
      ) &&
    sourceEvidenceIds.has(
      stringifyId(
        imageEvidenceId,
      ),
    )
  )
}

function privacyDecisionAllowsPublicUse({
  assessment,
  reviewCase,
  governedHostNpiApproved =
    false,
  purpose =
    'other',
  evidence,
}) {
  if (
    reviewCase?.status ===
      'resolved'
  ) {
    return (
      reviewCase.decision ===
      'safe_to_use'
    )
  }

  if (
    isHumanPrivacyReviewBlocking(
      reviewCase,
    )
  ) {
    return false
  }

  if (
    assessment?.decision ===
      'safe_to_use'
  ) {
    return true
  }

  /*
  |--------------------------------------------------------------------------
  | Published Host package evidence fallback
  |--------------------------------------------------------------------------
  |
  | M24 privacy screening and M14 NPI review are separate governance layers.
  | Older automated privacy assessments can remain `needs_review` when a
  | package label contains a manufacturer/business address or when the privacy
  | detector was temporarily unavailable. That automated hold must not make an
  | Admin-reviewed, published canonical product permanently lose its package
  | image.
  |
  | This fallback is deliberately narrow:
  | - exact Host NPI -> exact ProductVersion -> exact ImageEvidence linkage;
  | - Admin-reviewed and approved-for-catalog NPI only;
  | - authenticated privacy-v1 Cloudinary evidence only;
  | - known package-evidence purposes only;
  | - a human privacy review still wins;
  | - faces and other hard personal-data findings still fail closed.
  */

  if (
    governedHostNpiApproved !==
      true ||
    !GOVERNED_PACKAGE_EVIDENCE_PURPOSES.has(
      String(
        purpose ||
          '',
      ),
    ) ||
    !isAuthenticatedSanitizedEvidence(
      evidence,
    ) ||
    assessmentHasHardPrivacyRisk(
      assessment,
    )
  ) {
    return false
  }

  return true
}

function evidencePurposeRank(
  purpose,
) {
  const ranks = {
    front_pack: 0,
    back_pack: 1,
    side_panel: 2,
    ingredient_panel: 3,
    nutrition_panel: 4,
    allergen_statement: 5,
    barcode: 6,
    certification_mark: 7,
    other: 8,
  }

  return ranks[
    String(
      purpose ||
        'other',
    )
  ] ?? 99
}

async function resolvePrivacyClearedNpiImages({
  productVersionId,
  displayName,
}) {
  const evidenceSources =
    await EvidenceSource.find({
      entityType:
        'product_version',

      entityId:
        productVersionId,

      externalReference: {
        $regex:
          /^npi-draft:.*:image:/,
      },
    })
      .sort({
        capturedAt: 1,
        _id: 1,
      })
      .lean()

  const sourceItems =
    evidenceSources
      .map(
        (source) => ({
          source,
          npiDraftId:
            source?.metadata
              ?.npiDraftId ||
            String(
              source?.externalReference ||
                '',
            ).match(
              /^npi-draft:([^:]+):image:/,
            )?.[1] ||
            null,
          imageEvidenceId:
            source?.metadata
              ?.imageEvidenceId ||
            String(
              source?.externalReference ||
                '',
            ).match(
              /:image:([^:]+)$/,
            )?.[1] ||
            null,
          purpose:
            source?.metadata
              ?.purpose ||
            'other',
        }),
      )
      .filter(
        (item) =>
          Boolean(
            item.imageEvidenceId,
          ),
      )
      .sort(
        (left, right) =>
          evidencePurposeRank(
            left.purpose,
          ) -
          evidencePurposeRank(
            right.purpose,
          ),
      )

  if (!sourceItems.length) {
    return []
  }

  const evidenceIds =
    [...new Set(
      sourceItems.map(
        (item) =>
          String(
            item.imageEvidenceId,
          ),
      ),
    )]

  const draftIds =
    [...new Set(
      sourceItems
        .map(
          (item) =>
            item.npiDraftId
              ? String(
                  item.npiDraftId,
                )
              : null,
        )
        .filter(Boolean),
    )]

  const [
    evidence,
    assessments,
    reviewCases,
    drafts,
  ] =
    await Promise.all([
      ImageEvidence.find({
        _id: {
          $in:
            evidenceIds,
        },

        status:
          'active',
      }).lean(),

      MediaSafetyAssessment.find({
        imageEvidenceId: {
          $in:
            evidenceIds,
        },
      })
        .sort({
          assessedAt: -1,
          createdAt: -1,
        })
        .lean(),

      PrivacyReviewCase.find({
        imageEvidenceId: {
          $in:
            evidenceIds,
        },
      })
        .sort({
          createdAt: -1,
        })
        .lean(),

      CommunityProductDraft.find({
        $or: [
          ...(draftIds.length
            ? [
                {
                  _id: {
                    $in:
                      draftIds,
                  },
                },
              ]
            : []),
          {
            catalogProductVersionId:
              productVersionId,
          },
        ],
      })
        .select({
          _id: 1,
          origin: 1,
          status: 1,
          verificationStatus: 1,
          readyForCatalog: 1,
          reviewedByUserId: 1,
          sourceEvidenceIds: 1,
          catalogProductVersionId: 1,
        })
        .lean(),
    ])

  const evidenceById =
    new Map(
      evidence.map(
        (item) => [
          String(
            item._id,
          ),
          item,
        ],
      ),
    )

  const latestAssessmentByEvidenceId =
    new Map()

  for (const item of assessments) {
    const key =
      String(
        item.imageEvidenceId,
      )

    if (
      !latestAssessmentByEvidenceId.has(
        key,
      )
    ) {
      latestAssessmentByEvidenceId.set(
        key,
        item,
      )
    }
  }

  const latestReviewByEvidenceId =
    new Map()

  for (const item of reviewCases) {
    const key =
      String(
        item.imageEvidenceId,
      )

    if (
      !latestReviewByEvidenceId.has(
        key,
      )
    ) {
      latestReviewByEvidenceId.set(
        key,
        item,
      )
    }
  }

  const draftById =
    new Map(
      drafts.map(
        (draft) => [
          String(
            draft._id,
          ),
          draft,
        ],
      ),
    )

  const draftsForProductVersion =
    drafts.filter(
      (draft) =>
        stringifyId(
          draft.catalogProductVersionId,
        ) ===
        stringifyId(
          productVersionId,
        ),
    )

  const images = []

  for (const item of sourceItems) {
    const evidenceId =
      String(
        item.imageEvidenceId,
      )

    const imageEvidence =
      evidenceById.get(
        evidenceId,
      )

    if (!imageEvidence) {
      continue
    }

    const linkedDraft =
      (
        item.npiDraftId
          ? draftById.get(
              String(
                item.npiDraftId,
              ),
            )
          : null
      ) ||
      draftsForProductVersion.find(
        (draft) =>
          (
            draft.sourceEvidenceIds ||
            []
          ).some(
            (value) =>
              stringifyId(
                value,
              ) ===
              evidenceId,
          ),
      ) ||
      null

    const governedHostNpiApproved =
      isApprovedHostNpiDraftForEvidence({
        draft:
          linkedDraft,
        productVersionId,
        imageEvidenceId:
          evidenceId,
      })

    const allowed =
      privacyDecisionAllowsPublicUse({
        assessment:
          latestAssessmentByEvidenceId.get(
            evidenceId,
          ) ||
          null,

        reviewCase:
          latestReviewByEvidenceId.get(
            evidenceId,
          ) ||
          null,

        governedHostNpiApproved,
        purpose:
          item.purpose,
        evidence:
          imageEvidence,
      })

    if (!allowed) {
      continue
    }

    let url = ''

    try {
      url =
        buildSignedProductEvidenceUrl({
          publicId:
            imageEvidence.publicId,

          version:
            imageEvidence.version,

          format:
            imageEvidence.format,
        })
    } catch {
      // Fail closed: a catalog read must never expose an unsigned evidence asset.
      continue
    }

    images.push({
      url,
      alt:
        String(
          displayName ||
            'Product image',
        ).trim(),
      evidenceSourceId:
        item.source._id,
      sortOrder:
        images.length,
    })
  }

  return images
}

async function enrichProductWithPrivacyClearedImages(
  product,
) {
  const currentImages =
    Array.isArray(
      product?.images,
    )
      ? product.images.filter(
          (image) =>
            Boolean(
              image?.url,
            ),
        )
      : []

  if (currentImages.length) {
    return product
  }

  const productVersionId =
    product?._id ||
    product?.id

  if (!productVersionId) {
    return product
  }

  const images =
    await resolvePrivacyClearedNpiImages({
      productVersionId,
      displayName:
        product?.displayName ||
        '',
    })

  if (!images.length) {
    return product
  }

  return {
    ...product,
    images,
  }
}

/*
|--------------------------------------------------------------------------
| Public Product Slug
|--------------------------------------------------------------------------
|
| No extra mutable slug is stored on ProductVersion.
|
| Public identity is deterministic:
|
| family-slug--variant_key--pack_key
|
*/

export function buildPublicProductSlug({
  familySlug,
  variantKey,
  packKey,
}) {
  const normalizedFamilySlug =
    normalizeCatalogSlug(
      familySlug,
    )

  const normalizedVariantKey =
    normalizeCatalogKey(
      variantKey,
    )

  const normalizedPackKey =
    normalizeCatalogKey(
      packKey,
    )

  if (
    !normalizedFamilySlug ||
    !normalizedVariantKey ||
    !normalizedPackKey
  ) {
    return ''
  }

  return [
    normalizedFamilySlug,
    normalizedVariantKey,
    normalizedPackKey,
  ].join(
    '--',
  )
}

export function parsePublicProductSlug(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    )
      .trim()
      .toLowerCase()

  const parts =
    normalized.split(
      '--',
    )

  if (
    parts.length !==
    3
  ) {
    return null
  }

  const [
    familySlug,
    variantKey,
    packKey,
  ] = parts

  if (
    !familySlug ||
    !variantKey ||
    !packKey
  ) {
    return null
  }

  const parsed = {
    familySlug:
      normalizeCatalogSlug(
        familySlug,
      ),

    variantKey:
      normalizeCatalogKey(
        variantKey,
      ),

    packKey:
      normalizeCatalogKey(
        packKey,
      ),
  }

  const rebuilt =
    buildPublicProductSlug(
      parsed,
    )

  if (
    rebuilt !==
    normalized
  ) {
    return null
  }

  return parsed
}

/*
|--------------------------------------------------------------------------
| Safe Public Serializer
|--------------------------------------------------------------------------
|
| Deliberately excludes:
|
| publicationStatus
| createdByUserId
| publishedByUserId
| retiredByUserId
| provenance
| evidence source IDs
| audit context
| price
| stock
| inventory
| seller / Host commercial state
|
*/

export function serializePublicProductRecord(
  record,
  {
    detail =
      false,
  } = {},
) {
  const version =
    typeof record?.toObject ===
    'function'
      ? record.toObject()
      : record || {}

  const pack =
    version.pack ||
    version.packId ||
    {}

  const variant =
    version.variant ||
    version.variantId ||
    {}

  const family =
    version.family ||
    {}

  const brand =
    version.brand ||
    {}

  const category =
    version.category ||
    {}

  const slug =
    buildPublicProductSlug({
      familySlug:
        family.slug,

      variantKey:
        variant.variantKey,

      packKey:
        pack.packKey,
    })

  const images =
    (
      version.images ||
      []
    )
      .map(
        (image) => ({
          url:
            image?.url ||
            '',

          alt:
            image?.alt ||
            '',

          sortOrder:
            Number(
              image?.sortOrder ||
                0,
            ),
        }),
      )
      .filter(
        (image) =>
          Boolean(
            image.url,
          ),
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.sortOrder -
          right.sortOrder,
      )

  const base = {
    id:
      stringifyId(
        version._id ||
          version.id,
      ),

    productVersionId:
      stringifyId(
        version._id ||
          version.id,
      ),

    familyId:
      stringifyId(
        family._id ||
          family.id,
      ),

    variantId:
      stringifyId(
        variant._id ||
          variant.id ||
          version.variantId,
      ),

    packId:
      stringifyId(
        pack._id ||
          pack.id ||
          version.packId,
      ),

    slug,

    displayName:
      version.displayName ||
      '',

    gtin:
      version.gtin ||
      null,

    brand: {
      id:
        stringifyId(
          brand._id ||
            brand.id,
        ),

      name:
        brand.name ||
        '',

      slug:
        brand.slug ||
        '',

      logoUrl:
        brand.logoUrl ||
        '',
    },

    category: {
      id:
        stringifyId(
          category._id ||
            category.id,
        ),

      name:
        category.name ||
        '',

      slug:
        category.slug ||
        '',
    },

    family: {
      name:
        family.canonicalName ||
        '',

      slug:
        family.slug ||
        '',
    },

    variant: {
      name:
        variant.canonicalName ||
        '',

      key:
        variant.variantKey ||
        '',

      market:
        variant.market ||
        '',

      flavor:
        variant.flavor ||
        '',
    },

    pack: {
      name:
        pack.displayName ||
        '',

      key:
        pack.packKey ||
        '',

      type:
        pack.packType ||
        'other',

      multipackCount:
        Number(
          pack.multipackCount ||
            1,
        ),
    },

    netQuantity:
      serializeQuantity(
        version.netQuantity,
      ),

    image:
      images[0] ||
      null,
  }

  if (!detail) {
    return base
  }

  return {
    ...base,

    description:
      family.description ||
      '',

    ingredientDeclarationText:
      version.ingredientDeclarationText ||
      '',

    ingredients:
      (
        version.ingredients ||
        []
      ).map(
        (
          ingredient,
        ) => ({
          ingredientId:
            stringifyId(
              ingredient
                ?.ingredientId,
            ),

          displayName:
            ingredient
              ?.displayName ||
            '',

          order:
            Number(
              ingredient
                ?.order ||
                0,
            ),

          percentage:
            ingredient
                ?.percentage ??
            null,

          notes:
            ingredient
              ?.notes ||
            '',
        }),
      ),

    nutrition: {
      basis:
        version.nutrition
          ?.basis ||
        null,

      servingSize:
        serializeQuantity(
          version.nutrition
            ?.servingSize,
        ),

      nutrients:
        (
          version.nutrition
            ?.nutrients ||
          []
        ).map(
          (
            nutrient,
          ) => ({
            nutrientKey:
              nutrient
                ?.nutrientKey ||
              '',

            amount:
              nutrient
                ?.amount ??
              null,

            unit:
              nutrient
                ?.unit ||
              '',
          }),
        ),
    },

    allergens:
      (
        version.allergens ||
        []
      ).map(
        (
          allergen,
        ) => ({
          allergenKey:
            allergen
              ?.allergenKey ||
            '',

          relationType:
            allergen
              ?.relationType ||
            'unknown',
        }),
      ),

    allergenStatement:
      cleanText(
        version.allergenStatement,
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
            claim?.key ||
            '',

          label:
            claim?.label ||
            '',
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
            certification?.key ||
            '',

          label:
            certification?.label ||
            '',

          certificateReference:
            certification
              ?.certificateReference ||
            '',
        }),
      ),

    images,

    countryOfOrigin:
      version.countryOfOrigin ||
      '',

    manufacturerName:
      version.manufacturerName ||
      '',
  }
}

/*
|--------------------------------------------------------------------------
| Current Published Match
|--------------------------------------------------------------------------
*/

function buildPublishedVersionMatch(
  now =
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
                now,
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
                now,
            },
          },
        ],
      },
    ],
  }
}

/*
|--------------------------------------------------------------------------
| Canonical Hierarchy Lookups
|--------------------------------------------------------------------------
*/

function buildHierarchyLookupPipeline() {
  return [
    {
      $lookup: {
        from:
          Pack.collection.name,

        localField:
          'packId',

        foreignField:
          '_id',

        as:
          'pack',
      },
    },

    {
      $unwind:
        '$pack',
    },

    {
      $match: {
        'pack.status':
          'active',
      },
    },

    {
      $lookup: {
        from:
          ProductVariant
            .collection
            .name,

        localField:
          'variantId',

        foreignField:
          '_id',

        as:
          'variant',
      },
    },

    {
      $unwind:
        '$variant',
    },

    {
      $match: {
        'variant.status':
          'active',
      },
    },

    {
      $lookup: {
        from:
          ProductFamily
            .collection
            .name,

        localField:
          'variant.familyId',

        foreignField:
          '_id',

        as:
          'family',
      },
    },

    {
      $unwind:
        '$family',
    },

    {
      $match: {
        'family.status':
          'active',
      },
    },

    {
      $lookup: {
        from:
          Brand.collection.name,

        localField:
          'family.brandId',

        foreignField:
          '_id',

        as:
          'brand',
      },
    },

    {
      $unwind:
        '$brand',
    },

    {
      $match: {
        'brand.status':
          'active',
      },
    },

    {
      $lookup: {
        from:
          Category
            .collection
            .name,

        localField:
          'family.categoryId',

        foreignField:
          '_id',

        as:
          'category',
      },
    },

    {
      $unwind:
        '$category',
    },

    {
      $match: {
        'category.status':
          'active',
      },
    },
  ]
}

/*
|--------------------------------------------------------------------------
| Active Host Listing Gate
|--------------------------------------------------------------------------
|
| Canonical ProductVersion records remain governed catalog truth after a Host
| retires a commercial Offer. Customer Grocery browse can opt into this gate
| so it only shows canonical Packs that still have at least one ACTIVE Host
| Offer. Historical/admin catalog records are not deleted or retired here.
|
| If multiple Hosts sell the same canonical Pack, the Product remains visible
| while at least one ACTIVE Offer still exists.
|--------------------------------------------------------------------------
*/

function buildActiveHostOfferGatePipeline() {
  return [
    {
      $lookup: {
        from:
          HostOffer.collection.name,

        let: {
          publicPackId:
            '$packId',
        },

        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      '$packId',
                      '$$publicPackId',
                    ],
                  },

                  {
                    $eq: [
                      '$status',
                      'active',
                    ],
                  },
                ],
              },
            },
          },

          {
            $limit:
              1,
          },
        ],

        as:
          'activeHostOffers',
      },
    },

    {
      $match: {
        'activeHostOffers.0': {
          $exists:
            true,
        },
      },
    },

    {
      $unset:
        'activeHostOffers',
    },
  ]
}

/*
|--------------------------------------------------------------------------
| Public Browse Pipeline
|--------------------------------------------------------------------------
*/

export function buildPublicProductPipeline({
  page =
    1,

  limit =
    24,

  search =
    '',

  categorySlug =
    '',

  brandSlug =
    '',

  listedOnly =
    false,

  now =
    new Date(),
} = {}) {
  const normalizedPage =
    Math.max(
      1,
      Number(page) ||
        1,
    )

  const normalizedLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(limit) ||
          24,
      ),
    )

  const pipeline = [
    {
      $match:
        buildPublishedVersionMatch(
          now,
        ),
    },

    ...buildHierarchyLookupPipeline(),
  ]

  if (
    listedOnly ===
    true
  ) {
    pipeline.push(
      ...buildActiveHostOfferGatePipeline(),
    )
  }

  if (
    categorySlug
  ) {
    const normalizedCategorySlug =
      normalizeCatalogSlug(
        categorySlug,
      )

    if (
      PUBLIC_BROWSE_CATEGORY_SLUGS.has(
        normalizedCategorySlug,
      )
    ) {
      pipeline.push(
        ...buildPublicBrowseClassificationPipeline(),
        {
          $match: {
            _browseCategorySlug:
              normalizedCategorySlug,
          },
        },
        {
          $unset:
            '_browseCategorySlug',
        },
      )
    } else {
      pipeline.push({
        $match: {
          'category.slug':
            normalizedCategorySlug,
        },
      })
    }
  }

  if (
    brandSlug
  ) {
    pipeline.push({
      $match: {
        'brand.slug':
          normalizeCatalogSlug(
            brandSlug,
          ),
      },
    })
  }

  if (
    String(
      search ||
        '',
    ).trim()
  ) {
    const expression =
      new RegExp(
        escapeRegex(
          String(
            search,
          ).trim(),
        ),
        'i',
      )

    pipeline.push({
      $match: {
        $or: [
          {
            displayName:
              expression,
          },

          {
            'family.canonicalName':
              expression,
          },

          {
            'variant.canonicalName':
              expression,
          },

          {
            'pack.displayName':
              expression,
          },

          {
            'brand.name':
              expression,
          },
        ],
      },
    })
  }

  pipeline.push(
    {
      $sort: {
        displayName:
          1,

        _id:
          1,
      },
    },

    {
      $facet: {
        data: [
          {
            $skip:
              (
                normalizedPage -
                1
              ) *
              normalizedLimit,
          },

          {
            $limit:
              normalizedLimit,
          },
        ],

        metadata: [
          {
            $count:
              'total',
          },
        ],
      },
    },
  )

  return pipeline
}

/*
|--------------------------------------------------------------------------
| List Public Products
|--------------------------------------------------------------------------
*/

export async function listPublicProducts({
  page =
    1,

  limit =
    24,

  search =
    '',

  categorySlug =
    '',

  brandSlug =
    '',

  listedOnly =
    false,
} = {}) {
  const normalizedPage =
    Math.max(
      1,
      Number(page) ||
        1,
    )

  const normalizedLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(limit) ||
          24,
      ),
    )

  const [
    result = {
      data:
        [],

      metadata:
        [],
    },
  ] =
    await ProductVersion.aggregate(
      buildPublicProductPipeline({
        page:
          normalizedPage,

        limit:
          normalizedLimit,

        search,

        categorySlug,

        brandSlug,

        listedOnly,
      }),
    )

  const total =
    result.metadata?.[0]
      ?.total ||
    0

  const enrichedProducts =
    await Promise.all(
      (
        result.data ||
        []
      ).map(
        enrichProductWithPrivacyClearedImages,
      ),
    )

  return {
    products:
      enrichedProducts.map(
        (
          product,
        ) =>
          serializePublicProductRecord(
            product,
          ),
      ),

    pagination: {
      page:
        normalizedPage,

      limit:
        normalizedLimit,

      total,

      pages:
        total ===
          0
          ? 0
          : Math.ceil(
              total /
                normalizedLimit,
            ),
    },

    filter: {
      search:
        String(
          search ||
            '',
        ).trim(),

      categorySlug:
        categorySlug
          ? normalizeCatalogSlug(
              categorySlug,
            )
          : null,

      brandSlug:
        brandSlug
          ? normalizeCatalogSlug(
              brandSlug,
            )
          : null,

      listedOnly:
        listedOnly ===
        true,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Product Detail
|--------------------------------------------------------------------------
*/

export async function getPublicProductBySlug(
  productSlug,
) {
  const parsed =
    parsePublicProductSlug(
      productSlug,
    )

  if (!parsed) {
    throw new ApiError(
      404,
      'Published product was not found.',
      [
        {
          code:
            'PUBLIC_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Resolve detail through the same canonical pipeline as Grocery browse
  |--------------------------------------------------------------------------
  |
  | A Product can be retired and later re-listed. The customer browse pipeline
  | resolves the currently published ProductVersion together with its active
  | Pack / Variant / Family hierarchy. Marketplace availability is resolved
  | separately on the Product Detail page, so a governed published canonical
  | product remains viewable even when no active Host Offer exists yet.
  |
  | Resolving the detail page independently with sequential `findOne` calls can
  | become stale after a governed retire -> re-publish cycle because the public
  | URL is a deterministic hierarchy slug, not a ProductVersion ObjectId.
  |
  | Use one authoritative aggregate instead so a URL emitted by ProductCard is
  | guaranteed to resolve against the same current published catalog truth that
  | produced the card.
  */

  const now =
    new Date()

  const [
    version,
  ] =
    await ProductVersion.aggregate([
      {
        $match:
          buildPublishedVersionMatch(
            now,
          ),
      },

      ...buildHierarchyLookupPipeline(),

      {
        $match: {
          'family.slug':
            parsed.familySlug,

          'variant.variantKey':
            parsed.variantKey,

          'pack.packKey':
            parsed.packKey,
        },
      },

      {
        $sort: {
          version:
            -1,

          publishedAt:
            -1,

          updatedAt:
            -1,
        },
      },

      {
        $limit:
          1,
      },
    ])

  if (!version) {
    throw new ApiError(
      404,
      'Published product was not found.',
      [
        {
          code:
            'PUBLIC_PRODUCT_NOT_FOUND',
        },
      ],
    )
  }

  const enrichedVersion =
    await enrichProductWithPrivacyClearedImages(
      version,
    )

  const detailVersion =
    await enrichProductWithApprovedNpiFacts(
      enrichedVersion,
    )

  return serializePublicProductRecord(
    detailVersion,
    {
      detail:
        true,
    },
  )
}

/*
|--------------------------------------------------------------------------
| Public Categories
|--------------------------------------------------------------------------
*/

export async function listPublicCategories() {
  const categoryCounts =
    await ProductVersion.aggregate([
      {
        $match:
          buildPublishedVersionMatch(
            new Date(),
          ),
      },

      ...buildHierarchyLookupPipeline(),

      ...buildPublicBrowseClassificationPipeline(),

      {
        $group: {
          _id:
            '$_browseCategorySlug',
          productCount: {
            $sum:
              1,
          },
        },
      },
    ])

  const countBySlug =
    new Map(
      categoryCounts.map(
        (item) => [
          String(
            item?._id ||
              '',
          ),
          Number(
            item?.productCount ||
              0,
          ),
        ],
      ),
    )

  return PUBLIC_BROWSE_CATEGORIES
    .filter(
      (category) =>
        (
          countBySlug.get(
            category.slug,
          ) ||
          0
        ) > 0,
    )
    .map(
      (category) => ({
        id:
          category.slug,

        name:
          category.name,

        slug:
          category.slug,

        parentId:
          null,

        description:
          category.description,

        sortOrder:
          category.sortOrder,

        productCount:
          countBySlug.get(
            category.slug,
          ) ||
          0,
      }),
    )
}

/*
|--------------------------------------------------------------------------
| Public Brands
|--------------------------------------------------------------------------
*/

export async function listPublicBrands() {
  const brands =
    await Brand.find({
      status:
        'active',
    })
      .sort({
        name:
          1,
      })
      .select({
        name:
          1,

        slug:
          1,

        description:
          1,

        websiteUrl:
          1,

        logoUrl:
          1,
      })
      .lean()

  return brands.map(
    (
      brand,
    ) => ({
      id:
        stringifyId(
          brand._id,
        ),

      name:
        brand.name,

      slug:
        brand.slug,

      description:
        brand.description ||
        '',

      websiteUrl:
        brand.websiteUrl ||
        '',

      logoUrl:
        brand.logoUrl ||
        '',
    }),
  )
}