import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HouseholdMembership,
} from '../households/householdMembership.model.js'

import {
  ConnectedPurchaseSource,
  PURCHASE_SOURCE_CONSENT_PURPOSE,
  PURCHASE_SOURCE_CONSENT_VERSION,
} from './purchaseSource.model.js'

import {
  PurchaseTransaction,
} from './purchaseTransaction.model.js'

import {
  correctPurchaseTransactionBodySchema,
  createPurchaseSourceBodySchema,
  purchaseSourceActionBodySchema,
} from './purchaseSource.validation.js'

const PROVIDER_ALLOWED_SCOPES =
  Object.freeze({
    gmail:
      new Set([
        'purchase_receipts',
        'order_history',
        'delivery_status',
      ]),

    outlook:
      new Set([
        'purchase_receipts',
        'order_history',
        'delivery_status',
      ]),

    retailer:
      new Set([
        'order_history',
        'delivery_status',
      ]),

    receipt_import:
      new Set([
        'purchase_receipts',
      ]),
  })

function throwValidationError(
  result,
  fallbackMessage,
) {
  throw new ApiError(
    400,
    result.error
      ?.issues?.[0]
      ?.message ||
      fallbackMessage,
  )
}

function getActorUserId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated Customer identity is required.',
    )
  }

  return value
}

async function requireActiveHouseholdMembership({
  userId,
  householdId,
}) {
  const membership =
    await HouseholdMembership.findOne({
      userId,
      householdId,
      status:
        'active',
    })
      .select({
        _id:
          1,

        householdId:
          1,

        role:
          1,
      })
      .lean()

  if (!membership) {
    throw new ApiError(
      403,
      'Active membership in the selected household is required.',
    )
  }

  return membership
}

function assertProviderScopes(
  provider,
  consentScopes,
) {
  const allowed =
    PROVIDER_ALLOWED_SCOPES[
      provider
    ]

  const invalid =
    consentScopes.filter(
      (scope) =>
        !allowed.has(
          scope,
        ),
    )

  if (
    invalid.length >
    0
  ) {
    throw new ApiError(
      400,
      `Unsupported consent scope for ${provider}: ${invalid.join(', ')}`,
    )
  }
}

function serializePurchaseSource(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      String(
        item?._id ||
        item?.id ||
        '',
      ),

    sourceId:
      item?.sourceId ||
      '',

    householdId:
      item?.householdId
        ? String(
            item.householdId,
          )
        : null,

    provider:
      item?.provider ||
      null,

    displayLabel:
      item?.displayLabel ||
      '',

    status:
      item?.status ||
      null,

    consent: {
      purpose:
        item?.consentPurpose ||
        PURCHASE_SOURCE_CONSENT_PURPOSE,

      version:
        item?.consentVersion ||
        PURCHASE_SOURCE_CONSENT_VERSION,

      scopes:
        Array.isArray(
          item?.consentScopes,
        )
          ? item.consentScopes
          : [],

      grantedAt:
        item?.consentGrantedAt ||
        null,

      revokedAt:
        item?.consentRevokedAt ||
        null,
    },

    learningEnabled:
      item?.learningEnabled ===
      true,

    learningPausedAt:
      item?.learningPausedAt ||
      null,

    adapterKey:
      item?.adapterKey ||
      '',

    sync: {
      status:
        item?.lastSyncStatus ||
        'never',

      startedAt:
        item?.lastSyncStartedAt ||
        null,

      lastSyncAt:
        item?.lastSyncAt ||
        null,

      lastSuccessfulSyncAt:
        item?.lastSuccessfulSyncAt ||
        null,

      summary:
        item?.lastSyncSummary ||
        '',

      errorCode:
        item?.lastSyncErrorCode ||
        '',
    },

    pausedAt:
      item?.pausedAt ||
      null,

    reauthorizationRequiredAt:
      item?.reauthorizationRequiredAt ||
      null,

    revokedAt:
      item?.revokedAt ||
      null,

    importedHistoryDeletedAt:
      item?.importedHistoryDeletedAt ||
      null,

    historyImportAfter:
      item?.historyImportAfter ||
      null,

    createdAt:
      item?.createdAt ||
      null,

    updatedAt:
      item?.updatedAt ||
      null,
  }
}

function serializePurchaseItem(
  item,
) {
  const customerOverride =
    item?.customerOverride ||
    {}

  return {
    lineKey:
      item?.lineKey ||
      '',

    sourceLabel:
      item?.sourceLabel ||
      '',

    brand:
      item?.brand ||
      '',

    packText:
      item?.packText ||
      '',

    quantityOrdered:
      item?.quantityOrdered ??
      0,

    quantityFulfilled:
      item?.quantityFulfilled ??
      null,

    unitPriceMinor:
      item?.unitPriceMinor ??
      null,

    discountMinor:
      item?.discountMinor ??
      0,

    canonicalPackId:
      item?.canonicalPackId
        ? String(
            item.canonicalPackId,
          )
        : null,

    canonicalIngredientId:
      item?.canonicalIngredientId
        ? String(
            item.canonicalIngredientId,
          )
        : null,

    matchStatus:
      item?.matchStatus ||
      'unmatched',

    matchConfidence:
      item?.matchConfidence ??
      null,

    excludedFromLearning:
      item?.excludedFromLearning ===
      true,

    customerOverride: {
      correctedLabel:
        customerOverride.correctedLabel ||
        '',

      canonicalPackId:
        customerOverride.canonicalPackId
          ? String(
              customerOverride.canonicalPackId,
            )
          : null,

      canonicalIngredientId:
        customerOverride.canonicalIngredientId
          ? String(
              customerOverride.canonicalIngredientId,
            )
          : null,

      quantity:
        customerOverride.quantity ??
        null,

      note:
        customerOverride.note ||
        '',

      correctedAt:
        customerOverride.correctedAt ||
        null,
    },
  }
}

export function serializePurchaseTransaction(
  value,
) {
  const item =
    typeof value?.toObject ===
    'function'
      ? value.toObject()
      : value

  return {
    id:
      String(
        item?._id ||
        item?.id ||
        '',
      ),

    transactionId:
      item?.transactionId ||
      '',

    householdId:
      item?.householdId
        ? String(
            item.householdId,
          )
        : null,

    sourceId:
      item?.sourceId
        ? String(
            item.sourceId,
          )
        : null,

    sourceType:
      item?.sourceType ||
      null,

    merchantName:
      item?.merchantName ||
      '',

    purchasedAt:
      item?.purchasedAt ||
      null,

    expectedDeliveryAt:
      item?.expectedDeliveryAt ||
      null,

    deliveredAt:
      item?.deliveredAt ||
      null,

    currency:
      item?.currency ||
      'INR',

    totalMinor:
      item?.totalMinor ??
      null,

    status:
      item?.status ||
      null,

    items:
      Array.isArray(
        item?.items,
      )
        ? item.items.map(
            serializePurchaseItem,
          )
        : [],

    excludedFromLearning:
      item?.excludedFromLearning ===
      true,

    correctionNote:
      item?.correctionNote ||
      '',

    correctedAt:
      item?.correctedAt ||
      null,

    importedAt:
      item?.importedAt ||
      null,

    createdAt:
      item?.createdAt ||
      null,

    updatedAt:
      item?.updatedAt ||
      null,
  }
}

/*
|--------------------------------------------------------------------------
| Create Connection Intent
|--------------------------------------------------------------------------
*/

export async function createPurchaseSource({
  actorUser,
  payload,
}) {
  const parsed =
    createPurchaseSourceBodySchema.safeParse(
      payload ||
      {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid connected purchase source request.',
    )
  }

  const userId =
    getActorUserId(
      actorUser,
    )

  const {
    provider,
    householdId,
    displayLabel,
    consentScopes,
  } =
    parsed.data

  await requireActiveHouseholdMembership({
    userId,
    householdId,
  })

  assertProviderScopes(
    provider,
    consentScopes,
  )

  if (
    provider ===
    'receipt_import'
  ) {
    const existing =
      await ConnectedPurchaseSource.findOne({
        userId,
        householdId,
        provider,
        status: {
          $ne:
            'revoked',
        },
      })
        .lean()

    if (existing) {
      throw new ApiError(
        409,
        'An active receipt-import source already exists for this household.',
      )
    }
  }

  const source =
    await ConnectedPurchaseSource.create({
      userId,
      householdId,
      provider,
      displayLabel,
      consentScopes,
      consentPurpose:
        PURCHASE_SOURCE_CONSENT_PURPOSE,
      consentVersion:
        PURCHASE_SOURCE_CONSENT_VERSION,
      consentGrantedAt:
        new Date(),
      status:
        provider ===
        'receipt_import'
          ? 'connected'
          : 'pending_authorization',
      adapterKey:
        provider ===
        'receipt_import'
          ? 'receipt_import'
          : '',
    })

  return {
    source:
      serializePurchaseSource(
        source,
      ),

    authorization: {
      required:
        provider !==
        'receipt_import',

      provider,
    },
  }
}

export async function listPurchaseSourcesForUser({
  actorUser,
}) {
  const userId =
    getActorUserId(
      actorUser,
    )

  const sources =
    await ConnectedPurchaseSource.find({
      userId,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    sources:
      sources.map(
        serializePurchaseSource,
      ),
  }
}

export async function getPurchaseSourceForUser({
  actorUser,
  sourceId,
  includeProviderHash = false,
}) {
  const userId =
    getActorUserId(
      actorUser,
    )

  let query =
    ConnectedPurchaseSource.findOne({
      userId,
      sourceId,
    })

  if (
    includeProviderHash
  ) {
    query =
      query.select(
        '+providerAccountRefHash',
      )
  }

  const source =
    await query

  if (!source) {
    throw new ApiError(
      404,
      'Connected purchase source was not found.',
    )
  }

  return source
}

/*
|--------------------------------------------------------------------------
| Customer-Controlled Source Lifecycle
|--------------------------------------------------------------------------
*/

export async function updatePurchaseSourceAction({
  actorUser,
  sourceId,
  payload,
}) {
  const parsed =
    purchaseSourceActionBodySchema.safeParse(
      payload ||
      {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid connected purchase source action.',
    )
  }

  const source =
    await getPurchaseSourceForUser({
      actorUser,
      sourceId,
    })

  const {
    action,
  } =
    parsed.data

  const now =
    new Date()

  if (
    [
      'resume',
      'resume_learning',
    ].includes(
      action,
    )
  ) {
    await requireActiveHouseholdMembership({
      userId:
        getActorUserId(
          actorUser,
        ),
      householdId:
        source.householdId,
    })
  }

  if (
    source.status ===
      'revoked' &&
    action !==
      'revoke'
  ) {
    throw new ApiError(
      409,
      'A revoked purchase source cannot be reactivated. Create a new connection instead.',
    )
  }

  switch (
    action
  ) {
    case 'pause': {
      if (
        source.status !==
        'connected'
      ) {
        throw new ApiError(
          409,
          'Only a connected purchase source can be paused.',
        )
      }

      source.status =
        'paused'
      source.pausedAt =
        now
      break
    }

    case 'resume': {
      if (
        source.status !==
        'paused'
      ) {
        throw new ApiError(
          409,
          'Only a paused purchase source can be resumed.',
        )
      }

      source.status =
        'connected'
      source.pausedAt =
        null
      break
    }

    case 'pause_learning': {
      source.learningEnabled =
        false
      source.learningPausedAt =
        now
      break
    }

    case 'resume_learning': {
      if (
        source.status ===
        'revoked'
      ) {
        throw new ApiError(
          409,
          'Learning cannot resume for a revoked purchase source.',
        )
      }

      source.learningEnabled =
        true
      source.learningPausedAt =
        null
      break
    }

    case 'revoke': {
      if (
        source.status !==
        'revoked'
      ) {
        source.status =
          'revoked'
        source.revokedAt =
          now
        source.consentRevokedAt =
          now
        source.learningEnabled =
          false
        source.learningPausedAt =
          now
        source.pausedAt =
          null

        /*
        | Release the provider-account uniqueness binding without retaining the
        | raw provider identity. A future reconnect must create a fresh source
        | and complete authorization again.
        */
        source.providerAccountRefHash =
          null
        source.adapterKey =
          ''
      }

      break
    }

    default:
      throw new ApiError(
        400,
        'Unknown connected purchase source action.',
      )
  }

  await source.save()

  return {
    source:
      serializePurchaseSource(
        source,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Imported Purchase History
|--------------------------------------------------------------------------
*/

export async function listPurchaseTransactionsForUser({
  actorUser,
  sourceId = null,
  limit = 40,
}) {
  const userId =
    getActorUserId(
      actorUser,
    )

  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit,
        ) ||
        40,
        1,
      ),
      100,
    )

  const filter = {
    userId,
  }

  if (sourceId) {
    const source =
      await getPurchaseSourceForUser({
        actorUser,
        sourceId,
      })

    filter.sourceId =
      source._id
  }

  const transactions =
    await PurchaseTransaction.find(
      filter,
    )
      .sort({
        purchasedAt:
          -1,

        createdAt:
          -1,
      })
      .limit(
        safeLimit,
      )
      .lean()

  return {
    transactions:
      transactions.map(
        serializePurchaseTransaction,
      ),
  }
}

export async function correctPurchaseTransactionForUser({
  actorUser,
  transactionId,
  payload,
}) {
  const parsed =
    correctPurchaseTransactionBodySchema.safeParse(
      payload ||
      {},
    )

  if (
    !parsed.success
  ) {
    throwValidationError(
      parsed,
      'Invalid purchase transaction correction.',
    )
  }

  const userId =
    getActorUserId(
      actorUser,
    )

  const transaction =
    await PurchaseTransaction.findOne({
      userId,
      transactionId,
    })

  if (!transaction) {
    throw new ApiError(
      404,
      'Imported purchase transaction was not found.',
    )
  }

  const now =
    new Date()

  const {
    excludedFromLearning,
    correctionNote,
    itemCorrections,
  } =
    parsed.data

  if (
    typeof excludedFromLearning ===
    'boolean'
  ) {
    transaction.excludedFromLearning =
      excludedFromLearning
  }

  if (
    typeof correctionNote ===
    'string'
  ) {
    transaction.correctionNote =
      correctionNote
  }

  for (
    const correction
    of itemCorrections ||
    []
  ) {
    const item =
      transaction.items.find(
        (candidate) =>
          candidate.lineKey ===
          correction.lineKey,
      )

    if (!item) {
      throw new ApiError(
        404,
        `Purchase item ${correction.lineKey} was not found in this transaction.`,
      )
    }

    if (
      typeof correction.excludedFromLearning ===
      'boolean'
    ) {
      item.excludedFromLearning =
        correction.excludedFromLearning
    }

    const override =
      item.customerOverride

    if (
      Object.prototype.hasOwnProperty.call(
        correction,
        'correctedLabel',
      )
    ) {
      override.correctedLabel =
        correction.correctedLabel
    }

    if (
      Object.prototype.hasOwnProperty.call(
        correction,
        'canonicalPackId',
      )
    ) {
      override.canonicalPackId =
        correction.canonicalPackId
    }

    if (
      Object.prototype.hasOwnProperty.call(
        correction,
        'canonicalIngredientId',
      )
    ) {
      override.canonicalIngredientId =
        correction.canonicalIngredientId
    }

    if (
      Object.prototype.hasOwnProperty.call(
        correction,
        'quantity',
      )
    ) {
      override.quantity =
        correction.quantity
    }

    if (
      Object.prototype.hasOwnProperty.call(
        correction,
        'note',
      )
    ) {
      override.note =
        correction.note
    }

    override.correctedAt =
      now
    override.correctedByUserId =
      userId
  }

  transaction.correctedAt =
    now
  transaction.correctedByUserId =
    userId

  transaction.markModified(
    'items',
  )

  await transaction.save()

  return {
    transaction:
      serializePurchaseTransaction(
        transaction,
      ),
  }
}

/*
|--------------------------------------------------------------------------
| Delete Imported History
|--------------------------------------------------------------------------
|
| Deleting imported history does not silently revoke the provider connection.
| Instead a privacy reset boundary is recorded so a later sync cannot simply
| re-import older deleted transactions.
|
*/

export async function deleteImportedPurchaseHistoryForUser({
  actorUser,
  sourceId,
}) {
  const source =
    await getPurchaseSourceForUser({
      actorUser,
      sourceId,
    })

  const userId =
    getActorUserId(
      actorUser,
    )

  const result =
    await PurchaseTransaction.deleteMany({
      userId,
      sourceId:
        source._id,
    })

  const now =
    new Date()

  source.importedHistoryDeletedAt =
    now
  source.historyImportAfter =
    now
  source.lastSyncSummary =
    'Imported purchase history deleted by the customer. Older transactions will not be silently re-imported.'

  await source.save()

  return {
    deletedCount:
      result.deletedCount ||
      0,

    source:
      serializePurchaseSource(
        source,
      ),
  }
}
