import crypto from 'node:crypto'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  HouseholdMembership,
} from '../households/householdMembership.model.js'

import {
  ConnectedPurchaseSource,
} from './purchaseSource.model.js'

import {
  PurchaseTransaction,
} from './purchaseTransaction.model.js'

import {
  normalizedPurchaseBatchSchema,
} from './purchaseSource.validation.js'

const PROVIDER_SOURCE_TYPE =
  Object.freeze({
    gmail:
      'commerce_email',

    outlook:
      'commerce_email',

    retailer:
      'retailer_order',

    receipt_import:
      'receipt_import',
  })

function sha256(
  value,
) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      String(
        value ||
        '',
      ),
      'utf8',
    )
    .digest(
      'hex',
    )
}

function requireTrustedIdentity({
  sourceId,
  userId,
}) {
  if (
    !sourceId ||
    !userId
  ) {
    throw new ApiError(
      400,
      'Trusted purchase-source adapter identity is incomplete.',
    )
  }
}

async function getAdapterSource({
  sourceId,
  userId,
  includeProviderHash = false,
}) {
  requireTrustedIdentity({
    sourceId,
    userId,
  })

  let query =
    ConnectedPurchaseSource.findOne({
      sourceId,
      userId,
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

  const membership =
    await HouseholdMembership.findOne({
      userId,
      householdId:
        source.householdId,
      status:
        'active',
    })
      .select({
        _id:
          1,
      })
      .lean()

  if (!membership) {
    throw new ApiError(
      403,
      'Purchase-source sync requires active membership in the target household.',
    )
  }

  return source
}

function assertSourceTypeForProvider(
  source,
  sourceType,
) {
  const expected =
    PROVIDER_SOURCE_TYPE[
      source.provider
    ]

  if (
    sourceType !==
    expected
  ) {
    throw new ApiError(
      400,
      `Normalized source type ${sourceType} is not valid for provider ${source.provider}.`,
    )
  }
}

function buildLineKey({
  transactionReference,
  item,
  index,
}) {
  const stableReference =
    item.externalLineReference ||
    [
      item.sourceLabel,
      item.brand,
      item.packText,
      index,
    ].join('|')

  return sha256(
    `${transactionReference}|${stableReference}`,
  )
}

function preserveCustomerState(
  incomingItems,
  existingItems,
  transactionReference,
) {
  const existingByLineKey =
    new Map(
      (existingItems || [])
        .map(
          (item) => [
            item.lineKey,
            item,
          ],
        ),
    )

  return incomingItems.map(
    (
      item,
      index,
    ) => {
      const lineKey =
        buildLineKey({
          transactionReference,
          item,
          index,
        })

      const previous =
        existingByLineKey.get(
          lineKey,
        )

      const previousOverride =
        previous?.customerOverride ||
        {}

      return {
        lineKey,
        sourceLabel:
          item.sourceLabel,
        brand:
          item.brand ||
          '',
        packText:
          item.packText ||
          '',
        quantityOrdered:
          item.quantityOrdered,
        quantityFulfilled:
          item.quantityFulfilled ??
          null,
        unitPriceMinor:
          item.unitPriceMinor ??
          null,
        discountMinor:
          item.discountMinor ||
          0,
        canonicalPackId:
          item.canonicalPackId ||
          null,
        canonicalIngredientId:
          item.canonicalIngredientId ||
          null,
        matchStatus:
          item.matchStatus ||
          'unmatched',
        matchConfidence:
          item.matchConfidence ??
          null,

        /*
        | Customer decisions survive provider refresh.
        */
        excludedFromLearning:
          previous?.excludedFromLearning ===
          true,

        customerOverride: {
          correctedLabel:
            previousOverride.correctedLabel ||
            '',
          canonicalPackId:
            previousOverride.canonicalPackId ||
            null,
          canonicalIngredientId:
            previousOverride.canonicalIngredientId ||
            null,
          quantity:
            previousOverride.quantity ??
            null,
          note:
            previousOverride.note ||
            '',
          correctedAt:
            previousOverride.correctedAt ||
            null,
          correctedByUserId:
            previousOverride.correctedByUserId ||
            null,
        },
      }
    },
  )
}

/*
|--------------------------------------------------------------------------
| Provider Authorization Binding
|--------------------------------------------------------------------------
|
| OAuth/provider credentials remain outside MongoDB. The adapter supplies a
| stable provider account reference only long enough for this function to hash
| it. The raw reference is never persisted.
|
*/

export async function activatePurchaseSourceFromAdapter({
  sourceId,
  userId,
  providerAccountRef,
  adapterKey,
}) {
  if (
    !providerAccountRef
  ) {
    throw new ApiError(
      400,
      'Provider account reference is required to activate a purchase source.',
    )
  }

  const source =
    await getAdapterSource({
      sourceId,
      userId,
      includeProviderHash:
        true,
    })

  if (
    source.status ===
    'revoked'
  ) {
    throw new ApiError(
      409,
      'Revoked purchase source cannot be activated.',
    )
  }

  if (
    source.status ===
    'paused'
  ) {
    throw new ApiError(
      409,
      'Paused purchase source cannot accept provider imports until the Customer resumes sync.',
    )
  }

  if (
    source.provider ===
    'receipt_import'
  ) {
    throw new ApiError(
      409,
      'Receipt import does not use an external provider authorization binding.',
    )
  }

  const providerAccountRefHash =
    sha256(
      providerAccountRef,
    )

  const duplicate =
    await ConnectedPurchaseSource.findOne({
      _id: {
        $ne:
          source._id,
      },
      userId,
      provider:
        source.provider,
      providerAccountRefHash,
      status: {
        $ne:
          'revoked',
      },
    })
      .select({
        sourceId:
          1,
      })
      .lean()

  if (duplicate) {
    throw new ApiError(
      409,
      'This provider account is already connected to EPANTRY.',
    )
  }

  source.providerAccountRefHash =
    providerAccountRefHash
  source.adapterKey =
    String(
      adapterKey ||
      source.adapterKey ||
      source.provider,
    )
      .trim()
      .slice(
        0,
        80,
      )
  source.status =
    'connected'
  source.pausedAt =
    null
  source.reauthorizationRequiredAt =
    null
  source.lastSyncErrorCode =
    ''

  await source.save()

  return source
}

export async function markPurchaseSourceReauthorizationRequired({
  sourceId,
  userId,
  errorCode =
    'PROVIDER_REAUTHORIZATION_REQUIRED',
}) {
  const source =
    await getAdapterSource({
      sourceId,
      userId,
    })

  if (
    source.status ===
    'revoked'
  ) {
    return source
  }

  source.status =
    'reauthorization_required'
  source.reauthorizationRequiredAt =
    new Date()
  source.lastSyncStatus =
    'failed'
  source.lastSyncAt =
    new Date()
  source.lastSyncErrorCode =
    String(
      errorCode ||
      'PROVIDER_REAUTHORIZATION_REQUIRED',
    )
      .trim()
      .slice(
        0,
        120,
      )
  source.lastSyncSummary =
    'Provider authorization must be renewed before purchase-history sync can continue.'

  await source.save()

  return source
}

export async function markPurchaseSourceSyncStarted({
  sourceId,
  userId,
}) {
  const source =
    await getAdapterSource({
      sourceId,
      userId,
    })

  if (
    source.status !==
    'connected'
  ) {
    throw new ApiError(
      409,
      'Purchase source must be connected before sync can start.',
    )
  }

  source.lastSyncStatus =
    'running'
  source.lastSyncStartedAt =
    new Date()
  source.lastSyncErrorCode =
    ''

  await source.save()

  return source
}

export async function markPurchaseSourceSyncFailed({
  sourceId,
  userId,
  errorCode =
    'PURCHASE_SOURCE_SYNC_FAILED',
  summary =
    'Purchase-history sync failed.',
}) {
  const source =
    await getAdapterSource({
      sourceId,
      userId,
    })

  if (
    source.status ===
    'revoked'
  ) {
    return source
  }

  source.lastSyncStatus =
    'failed'
  source.lastSyncAt =
    new Date()
  source.lastSyncErrorCode =
    String(
      errorCode ||
      'PURCHASE_SOURCE_SYNC_FAILED',
    )
      .trim()
      .slice(
        0,
        120,
      )
  source.lastSyncSummary =
    String(
      summary ||
      'Purchase-history sync failed.',
    )
      .trim()
      .slice(
        0,
        500,
      )

  await source.save()

  return source
}

/*
|--------------------------------------------------------------------------
| Normalized Ingestion
|--------------------------------------------------------------------------
|
| This function accepts only provider-neutral normalized purchase data.
| Provider-specific payloads must be converted by the Gmail / Outlook /
| retailer / receipt adapter before reaching this boundary.
|
*/

export async function ingestNormalizedPurchaseBatch({
  sourceId,
  userId,
  payload,
}) {
  const parsed =
    normalizedPurchaseBatchSchema.safeParse(
      payload ||
      {},
    )

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        ?.issues?.[0]
        ?.message ||
        'Invalid normalized purchase batch.',
    )
  }

  const source =
    await getAdapterSource({
      sourceId,
      userId,
    })

  if (
    source.status !==
    'connected'
  ) {
    throw new ApiError(
      409,
      'Purchase source must be connected before normalized transactions can be ingested.',
    )
  }

  let importedCount =
    0
  let skippedByPrivacyBoundary =
    0

  for (
    const transactionInput
    of parsed.data.transactions
  ) {
    assertSourceTypeForProvider(
      source,
      transactionInput.sourceType,
    )

    if (
      source.historyImportAfter &&
      transactionInput.purchasedAt <
        source.historyImportAfter
    ) {
      skippedByPrivacyBoundary +=
        1
      continue
    }

    const externalReferenceHash =
      sha256(
        transactionInput.externalReference,
      )

    let transaction =
      await PurchaseTransaction.findOne({
        sourceId:
          source._id,
        externalReferenceHash,
      })

    const mergedItems =
      preserveCustomerState(
        transactionInput.items,
        transaction?.items ||
          [],
        transactionInput.externalReference,
      )

    if (!transaction) {
      transaction =
        new PurchaseTransaction({
          userId,
          householdId:
            source.householdId,
          sourceId:
            source._id,
          externalReferenceHash,
          sourceType:
            transactionInput.sourceType,
          importedAt:
            new Date(),
        })
    }

    transaction.merchantName =
      transactionInput.merchantName
    transaction.purchasedAt =
      transactionInput.purchasedAt
    transaction.expectedDeliveryAt =
      transactionInput.expectedDeliveryAt
    transaction.deliveredAt =
      transactionInput.deliveredAt
    transaction.currency =
      transactionInput.currency
    transaction.totalMinor =
      transactionInput.totalMinor
    transaction.status =
      transactionInput.status
    transaction.items =
      mergedItems

    await transaction.save()

    importedCount +=
      1
  }

  const now =
    new Date()

  source.lastSyncAt =
    now
  source.lastSuccessfulSyncAt =
    now
  source.lastSyncStatus =
    skippedByPrivacyBoundary >
    0
      ? 'partial'
      : 'success'
  source.lastSyncErrorCode =
    ''
  source.lastSyncSummary =
    parsed.data.syncSummary ||
    [
      `${importedCount} purchase transaction(s) normalized.`,
      skippedByPrivacyBoundary >
      0
        ? `${skippedByPrivacyBoundary} older transaction(s) skipped because the customer previously deleted imported history.`
        : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(
        0,
        500,
      )

  await source.save()

  return {
    importedCount,
    skippedByPrivacyBoundary,
    syncStatus:
      source.lastSyncStatus,
  }
}
