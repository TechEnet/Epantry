import crypto from 'crypto'

import mongoose from 'mongoose'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  Pack,
} from '../catalog/catalog.models.js'

import {
  createPantryObservationForHousehold,
  requireCurrentPantryHousehold,
  serializePantryObservation,
} from '../pantry/pantry.service.js'

import {
  PantryItem,
} from '../pantry/pantry.models.js'

import {
  getNextBasket,
} from '../planning/planning.service.js'

import {
  getNextPossibility,
  getWasteReduction,
} from '../planning/planning.waste.service.js'

import {
  RecipeVersion,
} from '../recipes/recipe.models.js'

import {
  getAccountConsents,
} from '../users/account.service.js'

import {
  ProductIdentity,
} from '../universalProduct/universalProduct.models.js'

import {
  normalizeProductCode,
} from '../universalProduct/universalProduct.service.js'

import {
  HouseholdMemoryFact,
  ReceiptImport,
} from './advancedExpansion.models.js'

const DAY_MS =
  24 *
  60 *
  60 *
  1000

export const M21_ADVANCED_PANTRY_FEATURE_FLAG =
  'm21.advanced_pantry'

export async function requireM21AdvancedPantryFeature() {
  const flag =
    await mongoose.connection
      .collection(
        'featureFlags',
      )
      .findOne({
        key:
          M21_ADVANCED_PANTRY_FEATURE_FLAG,
      })

  const enabled =
    flag?.enabled ===
      true ||
    flag?.state ===
      'enabled' ||
    flag?.status ===
      'enabled' ||
    flag?.status ===
      'active'

  if (!enabled) {
    throw new ApiError(
      404,
      'Advanced Pantry intelligence is not enabled for this environment.',
      [
        {
          code:
            'M21_ADVANCED_PANTRY_FEATURE_DISABLED',

          featureFlagKey:
            M21_ADVANCED_PANTRY_FEATURE_FLAG,
        },
      ],
    )
  }

  return flag
}

function stringifyId(
  value,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorIdFromUser(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Customer identity is required.',
      [
        {
          code:
            'M21_CUSTOMER_IDENTITY_REQUIRED',
        },
      ],
    )
  }

  return value
}

function asDate(
  value,
) {
  const date =
    value instanceof
      Date
      ? value
      : new Date(
          value,
        )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new ApiError(
      400,
      'A valid date is required.',
      [
        {
          code:
            'M21_DATE_INVALID',
        },
      ],
    )
  }

  return date
}

function boundedDaysBetween(
  earlier,
  later,
) {
  const value =
    (
      later.getTime() -
      earlier.getTime()
    ) /
    DAY_MS

  if (
    !Number.isFinite(
      value,
    ) ||
    value <=
      0 ||
    value >
      3650
  ) {
    return null
  }

  return Number(
    value.toFixed(
      4,
    ),
  )
}

function addDays(
  date,
  days,
) {
  return new Date(
    date.getTime() +
      Number(
        days,
      ) *
        DAY_MS,
  )
}

function memoryConfidenceForCount(
  count,
) {
  if (
    Number(
      count,
    ) >=
    4
  ) {
    return 'high'
  }

  if (
    Number(
      count,
    ) >=
    2
  ) {
    return 'medium'
  }

  return 'low'
}

async function loadConsentContext(
  actorUser,
) {
  const userId =
    actorIdFromUser(
      actorUser,
    )

  const state =
    await getAccountConsents(
      userId,
    )

  const byType =
    new Map(
      (
        state?.items ||
        []
      ).map(
        (
          item,
        ) => [
          item.consentType,
          item,
        ],
      ),
    )

  const privacy =
    byType.get(
      'privacy_policy',
    ) ||
    null

  const personalization =
    byType.get(
      'personalization',
    ) ||
    null

  return {
    privacyPolicyGranted:
      privacy?.granted ===
      true,

    privacyPolicyVersion:
      privacy?.recordedVersion ||
      privacy?.currentVersion ||
      '',

    personalizationGranted:
      personalization
        ?.granted ===
      true,

    personalizationVersion:
      personalization
        ?.recordedVersion ||
      personalization
        ?.currentVersion ||
      '',
  }
}

function requirePrivacyConsent(
  consent,
) {
  if (
    consent
      .privacyPolicyGranted !==
    true
  ) {
    throw new ApiError(
      403,
      'Current privacy-policy consent is required before importing purchase evidence.',
      [
        {
          code:
            'M21_PRIVACY_CONSENT_REQUIRED',
        },
      ],
    )
  }
}

function requirePersonalizationConsent(
  consent,
) {
  if (
    consent
      .personalizationGranted !==
    true
  ) {
    throw new ApiError(
      403,
      'Personalization consent is required for household memory and predictive intelligence.',
      [
        {
          code:
            'M21_PERSONALIZATION_CONSENT_REQUIRED',
        },
      ],
    )
  }
}

function serializeReceiptLine(
  line,
) {
  return {
    lineKey:
      line.lineKey,

    label:
      line.label,

    barcode:
      line.barcode ||
      '',

    quantity:
      line.quantity ||
      {
        mode:
          'unknown',
      },

    canonicalPackId:
      stringifyId(
        line.canonicalPackId,
      ),

    canonicalProductVersionId:
      stringifyId(
        line
          .canonicalProductVersionId,
      ),

    matchState:
      line.matchState,

    matchMethod:
      line.matchMethod,

    confidenceClass:
      line.confidenceClass,

    pantryApplied:
      line.pantryApplied ===
      true,

    pantryObservationId:
      stringifyId(
        line.pantryObservationId,
      ),

    appliedAt:
      line.appliedAt ||
      null,
  }
}

function serializeReceiptImport(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringifyId(
        item._id,
      ),

    receiptImportId:
      item.receiptImportId,

    sourceKind:
      item.sourceKind,

    hasSourceArtifact:
      Boolean(
        item.sourceArtifactRef,
      ),

    merchantLabel:
      item.merchantLabel ||
      '',

    market:
      item.market,

    purchasedAt:
      item.purchasedAt,

    status:
      item.status,

    consentSnapshot: {
      explicitImportAcknowledged:
        item.consentSnapshot
          ?.explicitImportAcknowledged ===
        true,

      acknowledgedAt:
        item.consentSnapshot
          ?.acknowledgedAt ||
        null,

      privacyPolicyVersion:
        item.consentSnapshot
          ?.privacyPolicyVersion ||
        '',

      personalizationGranted:
        item.consentSnapshot
          ?.personalizationGranted ===
        true,
    },

    lines:
      (
        item.lines ||
        []
      ).map(
        serializeReceiptLine,
      ),

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializeMemoryFact(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringifyId(
        item._id,
      ),

    memoryFactId:
      item.memoryFactId,

    factType:
      item.factType,

    status:
      item.status,

    sourceType:
      item.sourceType,

    canonicalPackId:
      stringifyId(
        item.canonicalPackId,
      ),

    canonicalIngredientId:
      stringifyId(
        item
          .canonicalIngredientId,
      ),

    recipeVersionId:
      stringifyId(
        item.recipeVersionId,
      ),

    firstObservedAt:
      item.firstObservedAt,

    lastObservedAt:
      item.lastObservedAt,

    observedCount:
      item.observedCount,

    averageIntervalDays:
      item.averageIntervalDays ??
      null,

    nextExpectedAt:
      item.nextExpectedAt ||
      null,

    confidenceClass:
      item.confidenceClass,

    details:
      item.details ||
      {},
  }
}

async function resolveReceiptLine(
  line,
  market,
) {
  const normalizedBarcode =
    normalizeProductCode(
      line.barcode,
    )

  if (!normalizedBarcode) {
    return {
      lineKey:
        line.lineKey,

      label:
        line.label,

      barcode:
        '',

      quantity:
        line.quantity,

      canonicalPackId:
        null,

      canonicalProductVersionId:
        null,

      matchState:
        'unresolved',

      matchMethod:
        'none',

      confidenceClass:
        'low',
    }
  }

  const identity =
    await ProductIdentity.findOne({
      value:
        normalizedBarcode,

      market,

      status:
        'active',
    })
      .sort({
        validFrom:
          -1,
      })
      .select(
        'packId productVersionId value',
      )
      .lean()

  if (!identity) {
    return {
      lineKey:
        line.lineKey,

      label:
        line.label,

      barcode:
        normalizedBarcode,

      quantity:
        line.quantity,

      canonicalPackId:
        null,

      canonicalProductVersionId:
        null,

      matchState:
        'unresolved',

      matchMethod:
        'none',

      confidenceClass:
        'low',
    }
  }

  return {
    lineKey:
      line.lineKey,

    label:
      line.label,

    barcode:
      normalizedBarcode,

    quantity:
      line.quantity,

    canonicalPackId:
      identity.packId,

    canonicalProductVersionId:
      identity
        .productVersionId ||
      null,

    matchState:
      'exact_canonical',

    matchMethod:
      'barcode_identity',

    confidenceClass:
      'high',
  }
}

function deriveReceiptStatus(
  lines,
) {
  const reviewedCount =
    lines.filter(
      (
        line,
      ) =>
        line.pantryApplied ===
          true ||
        line.matchState ===
          'excluded',
    ).length

  if (
    reviewedCount ===
    0
  ) {
    return 'needs_review'
  }

  if (
    reviewedCount ===
    lines.length
  ) {
    return 'applied'
  }

  return 'partially_applied'
}

async function upsertPurchaseMemoryFact({
  householdId,
  canonicalPackId,
  label,
  purchasedAt,
  receiptImportId,
  lineKey,
  actorUserId,
  session,
}) {
  const factKey =
    `purchase:pack:${stringifyId(
      canonicalPackId,
    )}`

  let fact =
    await HouseholdMemoryFact
      .findOne({
        householdId,
        factKey,
      })
      .session(
        session,
      )

  if (!fact) {
    const created =
      await HouseholdMemoryFact.create(
        [
          {
            householdId,
            factKey,

            factType:
              'purchase_pattern',

            status:
              'active',

            sourceType:
              'receipt_import',

            canonicalPackId,

            firstObservedAt:
              purchasedAt,

            lastObservedAt:
              purchasedAt,

            observedCount:
              1,

            averageIntervalDays:
              null,

            nextExpectedAt:
              null,

            confidenceClass:
              'low',

            details: {
              label,
            },

            evidenceRefs: [
              `receiptImport:${receiptImportId}:line:${lineKey}`,
            ],

            createdByUserId:
              actorUserId,

            updatedByUserId:
              actorUserId,
          },
        ],
        {
          session,
        },
      )

    return created[0]
  }

  const previousCount =
    Number(
      fact.observedCount ||
      1,
    )

  const previousLast =
    asDate(
      fact.lastObservedAt,
    )

  const intervalDays =
    boundedDaysBetween(
      previousLast,
      purchasedAt,
    )

  const nextCount =
    previousCount +
    1

  let averageIntervalDays =
    fact.averageIntervalDays ??
    null

  if (
    intervalDays !==
    null
  ) {
    if (
      averageIntervalDays ===
        null ||
      previousCount <=
        1
    ) {
      averageIntervalDays =
        intervalDays
    } else {
      const intervalCountBefore =
        previousCount -
        1

      averageIntervalDays =
        Number(
          (
            (
              Number(
                averageIntervalDays,
              ) *
                intervalCountBefore +
              intervalDays
            ) /
            (
              intervalCountBefore +
              1
            )
          ).toFixed(
            4,
          ),
        )
    }
  }

  fact.status =
    'active'

  fact.factType =
    'purchase_pattern'

  fact.sourceType =
    'receipt_import'

  fact.canonicalPackId =
    canonicalPackId

  fact.firstObservedAt =
    fact.firstObservedAt ||
    purchasedAt

  if (
    purchasedAt >
    previousLast
  ) {
    fact.lastObservedAt =
      purchasedAt
  }

  fact.observedCount =
    nextCount

  fact.averageIntervalDays =
    averageIntervalDays

  fact.nextExpectedAt =
    averageIntervalDays !==
      null
      ? addDays(
          asDate(
            fact.lastObservedAt,
          ),
          averageIntervalDays,
        )
      : null

  fact.confidenceClass =
    memoryConfidenceForCount(
      nextCount,
    )

  fact.details = {
    label:
      label ||
      fact.details?.label ||
      '',
  }

  fact.evidenceRefs = [
    ...new Set([
      ...(
        fact.evidenceRefs ||
        []
      ),

      `receiptImport:${receiptImportId}:line:${lineKey}`,
    ]),
  ].slice(
    -24,
  )

  fact.updatedByUserId =
    actorUserId

  fact.forgottenAt =
    null

  await fact.save({
    session,
  })

  return fact
}

export async function createReceiptImport({
  input,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const [
    household,
    consent,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),
    ])

  requirePrivacyConsent(
    consent,
  )

  if (
    input
      .explicitImportAcknowledged !==
    true
  ) {
    throw new ApiError(
      400,
      'Receipt import requires explicit acknowledgement for this source.',
      [
        {
          code:
            'M21_RECEIPT_IMPORT_ACK_REQUIRED',
        },
      ],
    )
  }

  const market =
    String(
      input.market ||
      'IN',
    )
      .trim()
      .toUpperCase()
      .slice(
        0,
        10,
      ) ||
    'IN'

  const lineKeys =
    new Set()

  for (
    const line
    of input.lines
  ) {
    if (
      lineKeys.has(
        line.lineKey,
      )
    ) {
      throw new ApiError(
        400,
        'Receipt line keys must be unique within an import.',
        [
          {
            code:
              'M21_RECEIPT_LINE_KEY_DUPLICATE',
          },
        ],
      )
    }

    lineKeys.add(
      line.lineKey,
    )
  }

  const resolvedLines =
    await Promise.all(
      input.lines.map(
        (
          line,
        ) =>
          resolveReceiptLine(
            line,
            market,
          ),
      ),
    )

  const receipt =
    await ReceiptImport.create({
      householdId:
        household.householdId,

      importedByUserId:
        actorUserId,

      sourceKind:
        input.sourceKind,

      sourceArtifactRef:
        input.sourceArtifactRef ||
        '',

      merchantLabel:
        input.merchantLabel ||
        '',

      market,

      purchasedAt:
        input.purchasedAt,

      status:
        'needs_review',

      consentSnapshot: {
        explicitImportAcknowledged:
          true,

        acknowledgedAt:
          new Date(),

        privacyPolicyVersion:
          consent
            .privacyPolicyVersion,

        personalizationGranted:
          consent
            .personalizationGranted,
      },

      lines:
        resolvedLines,
    })

  return {
    receiptImport:
      serializeReceiptImport(
        receipt,
      ),

    policy: {
      receiptIsInventoryTruth:
        false,

      receiptLinesRequireCustomerReviewBeforePantryProjection:
        true,

      unresolvedMatchMayCreateCanonicalTruth:
        false,

      rawReceiptIncludedInAnalytics:
        false,
    },
  }
}

export async function listReceiptImports({
  actorUser,
  limit = 50,
}) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const records =
    await ReceiptImport.find({
      householdId,
    })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(
              limit,
            ) ||
            50,
            1,
          ),
          100,
        ),
      )
      .lean()

  return {
    receiptImports:
      records.map(
        serializeReceiptImport,
      ),

    policy: {
      householdScoped:
        true,

      sourceArtifactRemainsPrivate:
        true,

      customerCorrectionRemainsAuthoritativeOverImportedEvidence:
        true,
    },
  }
}

async function requireCanonicalPack(
  canonicalPackId,
  session,
) {
  const pack =
    await Pack.findById(
      canonicalPackId,
    )
      .session(
        session,
      )
      .select(
        '_id',
      )
      .lean()

  if (!pack) {
    throw new ApiError(
      404,
      'Canonical Pack was not found.',
      [
        {
          code:
            'M21_CANONICAL_PACK_NOT_FOUND',
        },
      ],
    )
  }

  return pack
}

export async function reviewReceiptLine({
  receiptImportId,
  lineKey,
  input,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const [
    household,
    consent,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),
    ])

  const transaction =
    await mongoose.startSession()

  try {
    let result

    await transaction.withTransaction(
      async () => {
        const receipt =
          await ReceiptImport
            .findOne({
              receiptImportId,

              householdId:
                household.householdId,
            })
            .session(
              transaction,
            )

        if (!receipt) {
          throw new ApiError(
            404,
            'Receipt import was not found.',
            [
              {
                code:
                  'M21_RECEIPT_IMPORT_NOT_FOUND',
              },
            ],
          )
        }

        if (
          receipt.status ===
          'cancelled'
        ) {
          throw new ApiError(
            409,
            'Cancelled receipt imports cannot be applied.',
            [
              {
                code:
                  'M21_RECEIPT_IMPORT_CANCELLED',
              },
            ],
          )
        }

        const line =
          receipt.lines.find(
            (
              candidate,
            ) =>
              candidate.lineKey ===
              lineKey,
          )

        if (!line) {
          throw new ApiError(
            404,
            'Receipt line was not found.',
            [
              {
                code:
                  'M21_RECEIPT_LINE_NOT_FOUND',
              },
            ],
          )
        }

        if (
          line.pantryApplied ===
          true
        ) {
          result = {
            receiptImport:
              serializeReceiptImport(
                receipt,
              ),

            deduplicated:
              true,

            pantryObservation:
              null,
          }

          return
        }

        if (
          input.action ===
          'exclude'
        ) {
          line.matchState =
            'excluded'

          line.matchMethod =
            line.matchMethod ||
            'none'

          line.confidenceClass =
            'high'

          receipt.status =
            deriveReceiptStatus(
              receipt.lines,
            )

          await receipt.save({
            session:
              transaction,
          })

          result = {
            receiptImport:
              serializeReceiptImport(
                receipt,
              ),

            deduplicated:
              false,

            pantryObservation:
              null,
          }

          return
        }

        const selectedPackId =
          input.canonicalPackId ||
          line.canonicalPackId

        if (!selectedPackId) {
          throw new ApiError(
            409,
            'Unresolved receipt lines require an explicit canonical Pack selection before Pantry application.',
            [
              {
                code:
                  'M21_RECEIPT_LINE_CANONICAL_MATCH_REQUIRED',
              },
            ],
          )
        }

        if (
          input.canonicalPackId
        ) {
          await requireCanonicalPack(
            input.canonicalPackId,
            transaction,
          )

          line.canonicalPackId =
            input.canonicalPackId

          line
            .canonicalProductVersionId =
            null

          line.matchState =
            'user_confirmed'

          line.matchMethod =
            'customer_selection'

          line.confidenceClass =
            'high'
        }

        const pantryResult =
          await createPantryObservationForHousehold({
            householdId:
              household.householdId,

            canonicalPackId:
              selectedPackId,

            canonicalIngredientId:
              null,

            sourceType:
              'receipt_import',

            quantity:
              line.quantity
                ?.mode ===
              'exact'
                ? {
                    mode:
                      'exact',

                    value:
                      line.quantity
                        .value,

                    unit:
                      line.quantity
                        .unit,
                  }
                : undefined,

            observedAt:
              receipt.purchasedAt,

            note:
              `Customer-confirmed receipt evidence ${receipt.receiptImportId}/${line.lineKey}.`,

            actorUser,

            customerCorrection:
              false,

            session:
              transaction,
          })

        line.pantryApplied =
          true

        line.pantryObservationId =
          pantryResult
            .observation
            ._id

        line.appliedAt =
          new Date()

        if (
          line.matchState ===
          'exact_canonical'
        ) {
          line.confidenceClass =
            'high'
        }

        receipt.status =
          deriveReceiptStatus(
            receipt.lines,
          )

        await receipt.save({
          session:
            transaction,
        })

        if (
          consent
            .personalizationGranted ===
          true
        ) {
          await upsertPurchaseMemoryFact({
            householdId:
              household.householdId,

            canonicalPackId:
              selectedPackId,

            label:
              line.label,

            purchasedAt:
              asDate(
                receipt.purchasedAt,
              ),

            receiptImportId:
              receipt.receiptImportId,

            lineKey:
              line.lineKey,

            actorUserId,

            session:
              transaction,
          })
        }

        result = {
          receiptImport:
            serializeReceiptImport(
              receipt,
            ),

          deduplicated:
            false,

          pantryObservation:
            serializePantryObservation(
              pantryResult.observation,
            ),
        }
      },
    )

    return result
  } finally {
    await transaction.endSession()
  }
}

export async function cancelReceiptImport({
  receiptImportId,
  actorUser,
}) {
  const {
    householdId,
  } =
    await requireCurrentPantryHousehold(
      actorUser,
    )

  const receipt =
    await ReceiptImport.findOne({
      receiptImportId,
      householdId,
    })

  if (!receipt) {
    throw new ApiError(
      404,
      'Receipt import was not found.',
      [
        {
          code:
            'M21_RECEIPT_IMPORT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    receipt.lines.some(
      (
        line,
      ) =>
        line.pantryApplied ===
        true,
    )
  ) {
    throw new ApiError(
      409,
      'An import with applied Pantry evidence cannot be cancelled. Correct the Pantry item instead so history remains truthful.',
      [
        {
          code:
            'M21_RECEIPT_IMPORT_ALREADY_APPLIED',
        },
      ],
    )
  }

  receipt.status =
    'cancelled'

  receipt.cancelledAt =
    new Date()

  await receipt.save()

  return {
    receiptImport:
      serializeReceiptImport(
        receipt,
      ),
  }
}

function predictionState({
  nextExpectedAt,
  now,
}) {
  if (!nextExpectedAt) {
    return 'insufficient_history'
  }

  const days =
    (
      nextExpectedAt.getTime() -
      now.getTime()
    ) /
    DAY_MS

  if (
    days <
    0
  ) {
    return 'prediction_overdue'
  }

  if (
    days <=
    3
  ) {
    return 'predicted_due_soon'
  }

  return 'predicted_later'
}

export async function getHouseholdMemory({
  actorUser,
  now = new Date(),
}) {
  const currentTime =
    asDate(
      now,
    )

  const [
    household,
    consent,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),
    ])

  const facts =
    await HouseholdMemoryFact.find({
      householdId:
        household.householdId,

      status: {
        $in: [
          'active',
          'paused',
        ],
      },
    })
      .sort({
        lastObservedAt:
          -1,
      })
      .limit(
        200,
      )
      .lean()

  const packIds =
    facts
      .filter(
        (
          fact,
        ) =>
          fact.factType ===
            'purchase_pattern' &&
          fact.canonicalPackId,
      )
      .map(
        (
          fact,
        ) =>
          fact.canonicalPackId,
      )

  const pantryItems =
    packIds.length
      ? await PantryItem.find({
          householdId:
            household.householdId,

          canonicalPackId: {
            $in:
              packIds,
          },
        })
          .select(
            'canonicalPackId state lastObservationAt',
          )
          .lean()
      : []

  const pantryByPack =
    new Map(
      pantryItems.map(
        (
          item,
        ) => [
          stringifyId(
            item.canonicalPackId,
          ),
          item,
        ],
      ),
    )

  const predictions =
    consent
      .personalizationGranted
      ? facts
          .filter(
            (
              fact,
            ) =>
              fact.status ===
                'active' &&
              fact.factType ===
                'purchase_pattern',
          )
          .map(
            (
              fact,
            ) => {
              const nextExpectedAt =
                fact.nextExpectedAt
                  ? asDate(
                      fact.nextExpectedAt,
                    )
                  : null

              const pantryItem =
                pantryByPack.get(
                  stringifyId(
                    fact.canonicalPackId,
                  ),
                ) ||
                null

              return {
                memoryFactId:
                  fact.memoryFactId,

                canonicalPackId:
                  stringifyId(
                    fact.canonicalPackId,
                  ),

                label:
                  fact.details
                    ?.label ||
                  '',

                state:
                  predictionState({
                    nextExpectedAt,

                    now:
                      currentTime,
                  }),

                predictedReplenishmentAt:
                  nextExpectedAt,

                averageObservedIntervalDays:
                  fact.averageIntervalDays ??
                  null,

                observationCount:
                  fact.observedCount,

                confidenceClass:
                  fact.confidenceClass,

                currentPantryState:
                  pantryItem
                    ?.state ||
                  null,

                currentPantryObservedAt:
                  pantryItem
                    ?.lastObservationAt ||
                  null,

                authoritativeInventory:
                  false,

                automaticPurchase:
                  false,
              }
            },
          )
      : []

  return {
    enabled:
      consent
        .personalizationGranted,

    consent: {
      personalizationGranted:
        consent
          .personalizationGranted,

      personalizationVersion:
        consent
          .personalizationVersion,
    },

    facts:
      facts.map(
        serializeMemoryFact,
      ),

    predictions,

    policy: {
      predictionIsInventoryTruth:
        false,

      predictionMayAuthorizePurchase:
        false,

      customerMayPauseOrForgetMemory:
        true,

      activeModeIsAuthorizationAuthority:
        false,
    },
  }
}

export async function updateMemoryFactControl({
  memoryFactId,
  action,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const [
    household,
    consent,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),
    ])

  const fact =
    await HouseholdMemoryFact.findOne({
      memoryFactId,

      householdId:
        household.householdId,
    })

  if (!fact) {
    throw new ApiError(
      404,
      'Household memory fact was not found.',
      [
        {
          code:
            'M21_MEMORY_FACT_NOT_FOUND',
        },
      ],
    )
  }

  if (
    action ===
    'resume'
  ) {
    requirePersonalizationConsent(
      consent,
    )
  }

  if (
    action ===
    'forget'
  ) {
    fact.status =
      'forgotten'

    fact.factKey =
      `forgotten:${fact.memoryFactId}`

    fact.canonicalPackId =
      null

    fact.canonicalIngredientId =
      null

    fact.recipeVersionId =
      null

    fact.averageIntervalDays =
      null

    fact.nextExpectedAt =
      null

    fact.details =
      {}

    fact.evidenceRefs =
      []

    fact.forgottenAt =
      new Date()
  } else if (
    action ===
    'pause'
  ) {
    fact.status =
      'paused'
  } else {
    fact.status =
      'active'

    fact.forgottenAt =
      null
  }

  fact.updatedByUserId =
    actorUserId

  await fact.save()

  return {
    memoryFact:
      action ===
      'forget'
        ? {
            memoryFactId:
              fact.memoryFactId,

            status:
              'forgotten',
          }
        : serializeMemoryFact(
            fact,
          ),
  }
}

export async function recordLeftover({
  input,
  actorUser,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    )

  const [
    household,
    consent,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),
    ])

  requirePersonalizationConsent(
    consent,
  )

  const occurredAt =
    asDate(
      input.occurredAt ||
      new Date(),
    )

  const useSoonAt =
    asDate(
      input.useSoonAt,
    )

  if (
    useSoonAt <
    occurredAt
  ) {
    throw new ApiError(
      400,
      'Leftover use-soon time cannot be earlier than the leftover observation.',
      [
        {
          code:
            'M21_LEFTOVER_USE_SOON_INVALID',
        },
      ],
    )
  }

  const recipeVersion =
    await RecipeVersion.findOne({
      _id:
        input.recipeVersionId,

      status:
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
                  occurredAt,
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
                  occurredAt,
              },
            },
          ],
        },
      ],
    })
      .select(
        '_id title versionNumber',
      )
      .lean()

  if (!recipeVersion) {
    throw new ApiError(
      404,
      'Current published Recipe Version was not found.',
      [
        {
          code:
            'M21_LEFTOVER_RECIPE_VERSION_NOT_FOUND',
        },
      ],
    )
  }

  const factKey = [
    'leftover',

    stringifyId(
      recipeVersion._id,
    ),

    input.eventKey,
  ].join(
    ':',
  )

  const existing =
    await HouseholdMemoryFact.findOne({
      householdId:
        household.householdId,

      factKey,
    }).lean()

  if (existing) {
    return {
      deduplicated:
        true,

      leftover:
        serializeMemoryFact(
          existing,
        ),
    }
  }

  const fact =
    await HouseholdMemoryFact.create({
      householdId:
        household.householdId,

      factKey,

      factType:
        'leftover',

      status:
        'active',

      sourceType:
        'customer_leftover',

      recipeVersionId:
        recipeVersion._id,

      firstObservedAt:
        occurredAt,

      lastObservedAt:
        occurredAt,

      observedCount:
        1,

      averageIntervalDays:
        null,

      nextExpectedAt:
        useSoonAt,

      confidenceClass:
        'high',

      details: {
        label:
          recipeVersion.title,

        leftoverServings:
          input.leftoverServings,

        storageZone:
          input.storageZone,

        useSoonAt,

        note:
          input.note ||
          '',
      },

      evidenceRefs: [
        `recipeVersion:${stringifyId(
          recipeVersion._id,
        )}`,

        `customerLeftover:${input.eventKey}`,
      ],

      createdByUserId:
        actorUserId,

      updatedByUserId:
        actorUserId,
    })

  return {
    deduplicated:
      false,

    leftover:
      serializeMemoryFact(
        fact,
      ),

    policy: {
      explicitCustomerLeftover:
        true,

      inferredLeftoverQuantity:
        false,

      automaticPantryMutation:
        false,

      automaticMealPlanChange:
        false,
    },
  }
}

export async function getAdvancedPlanningIntelligence({
  actorUser,
  horizonDays = 7,
  now = new Date(),
}) {
  const currentTime =
    asDate(
      now,
    )

  const boundedHorizonDays =
    Math.min(
      Math.max(
        Number(
          horizonDays,
        ) ||
        7,
        1,
      ),
      30,
    )

  const [
    household,
    consent,
    wasteReduction,
    nextPossibility,
    nextBasket,
  ] =
    await Promise.all([
      requireCurrentPantryHousehold(
        actorUser,
      ),

      loadConsentContext(
        actorUser,
      ),

      getWasteReduction({
        actorUser,

        now:
          currentTime,

        horizonDays:
          boundedHorizonDays,
      }),

      getNextPossibility({
        actorUser,

        now:
          currentTime,

        horizonDays:
          boundedHorizonDays,
      }),

      getNextBasket({
        actorUser,

        now:
          currentTime,
      }),
    ])

  const horizonEnd =
    addDays(
      currentTime,
      boundedHorizonDays,
    )

  const leftovers =
    consent
      .personalizationGranted
      ? await HouseholdMemoryFact.find({
          householdId:
            household.householdId,

          factType:
            'leftover',

          status:
            'active',

          nextExpectedAt: {
            $lte:
              horizonEnd,
          },
        })
          .sort({
            nextExpectedAt:
              1,
          })
          .limit(
            50,
          )
          .lean()
      : []

  return {
    generatedAt:
      currentTime,

    horizonDays:
      boundedHorizonDays,

    memoryEnabled:
      consent
        .personalizationGranted,

    explicitLeftovers:
      leftovers.map(
        serializeMemoryFact,
      ),

    existingM13: {
      wasteReduction,
      nextPossibility,
      nextBasket,
    },

    decisionOrder: [
      'explicit_customer_leftovers',
      'customer_use_soon_and_running_low_evidence',
      'existing_m13_next_possibility',
      'existing_m13_next_basket',
    ],

    policy: {
      composesM13InsteadOfReplacingIt:
        true,

      automaticMealPlanChange:
        false,

      automaticCart:
        false,

      automaticCheckout:
        false,

      automaticPurchase:
        false,

      inventedPantryQuantity:
        false,

      inferredAllergenFacts:
        false,

      activeModeIsAuthorizationAuthority:
        false,
    },
  }
}

export function createReceiptLineKey() {
  return `line_${crypto.randomUUID()}`
}