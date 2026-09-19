import crypto from 'crypto'

import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  AdminFeatureFlag,
} from '../adminGovernance/adminGovernance.models.js'

import {
  listExternalCommercePartners,
} from '../commerce/commerce.partner.provider.js'

import {
  HospitalityProcurementPlan,
} from '../hospitality/hospitality.models.js'

import {
  resolveHospitalityContext,
} from '../hospitality/hospitality.service.js'

import {
  HostSettlement,
} from '../hostOperations/hostOperations.finance.models.js'

import {
  assertHostOperationsPermission,
  createCatalogIngestJob,
  resolveHostOperationsContext,
} from '../hostOperations/hostOperations.service.js'

import {
  createCatalogIngestJobSchema,
} from '../hostOperations/hostOperations.validation.js'

import {
  createBulkInventorySnapshots,
} from '../marketplace/marketplace.inventory.service.js'

import {
  bulkInventorySnapshotSchema,
} from '../marketplace/marketplace.inventory.validation.js'

import {
  executePartnerOperation,
} from '../reliability/reliability.service.js'

import {
  PartnerConnection,
  PartnerExecutionEvent,
  PayoutExecution,
  PurchaseOrder,
  PurchaseOrderEvent,
  ReconciliationEvidence,
} from './executionScale.models.js'

export const M22_EXECUTION_SCALE_FEATURE_FLAG =
  'm22.execution_scale'

const DAY_MS =
  24 *
  60 *
  60 *
  1000

function id(
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

function actorId(
  actorUser,
) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY identity is required.',
      [
        {
          code:
            'M22_EXECUTION_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function fingerprint(
  value,
) {
  return crypto
    .createHash(
      'sha256',
    )
    .update(
      typeof value ===
        'string'
        ? value
        : JSON.stringify(
            value,
          ),
    )
    .digest(
      'hex',
    )
}

function partnerFailureCauseCode(
  error,
) {
  return (
    error?.errors?.find(
      (
        item,
      ) =>
        item?.causeCode,
    )?.causeCode ||
    error?.code ||
    ''
  )
}

function isAmbiguousPartnerWriteFailure(
  error,
) {
  const causeCode =
    partnerFailureCauseCode(
      error,
    )

  return [
    'PARTNER_TIMEOUT',
    'ETIMEDOUT',
    'ECONNRESET',
    'EPIPE',
    'UND_ERR_CONNECT_TIMEOUT',
  ].includes(
    causeCode,
  )
}

function unwrapPartnerResult(
  result,
) {
  return (
    result?.data?.data ??
    result?.data ??
    result
  )
}

function redactErrorMessage(
  error,
) {
  return String(
    error?.message ||
      'Partner execution failed.',
  )
    .replace(
      /bearer\s+[a-z0-9._~+/=-]+/gi,
      'Bearer [REDACTED]',
    )
    .replace(
      /api[_-]?key\s*[=:]\s*[^\s,}]+/gi,
      'api_key=[REDACTED]',
    )
    .slice(
      0,
      1000,
    )
}

function assertHttpsPublicUrl(
  rawUrl,
) {
  let parsed

  try {
    parsed =
      new URL(
        rawUrl,
      )
  } catch {
    throw new ApiError(
      400,
      'Partner base URL is invalid.',
      [
        {
          code:
            'M22_PARTNER_URL_INVALID',
        },
      ],
    )
  }

  if (
    parsed.protocol !==
    'https:'
  ) {
    throw new ApiError(
      400,
      'Partner base URL must use HTTPS.',
      [
        {
          code:
            'M22_PARTNER_URL_HTTPS_REQUIRED',
        },
      ],
    )
  }

  const hostname =
    parsed.hostname
      .toLowerCase()

  const forbidden =
    hostname ===
      'localhost' ||
    hostname ===
      '127.0.0.1' ||
    hostname ===
      '0.0.0.0' ||
    hostname ===
      '::1' ||
    hostname.endsWith(
      '.local',
    ) ||
    /^10\./.test(
      hostname,
    ) ||
    /^192\.168\./.test(
      hostname,
    ) ||
    /^169\.254\./.test(
      hostname,
    ) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(
      hostname,
    )

  if (forbidden) {
    throw new ApiError(
      400,
      'Partner base URL cannot target a local or private network address.',
      [
        {
          code:
            'M22_PARTNER_URL_PRIVATE_NETWORK_FORBIDDEN',
        },
      ],
    )
  }

  parsed.hash =
    ''

  parsed.search =
    ''

  return parsed
    .toString()
    .replace(
      /\/$/,
      '',
    )
}

function normalizeOperationPath(
  value,
) {
  const path =
    String(
      value ||
      '',
    ).trim()

  if (!path) {
    return ''
  }

  if (
    !path.startsWith(
      '/',
    ) ||
    path.includes(
      '..',
    ) ||
    path.includes(
      '://',
    )
  ) {
    throw new ApiError(
      400,
      'Partner operation paths must be relative absolute-path references.',
      [
        {
          code:
            'M22_PARTNER_OPERATION_PATH_INVALID',
        },
      ],
    )
  }

  return path
}

function normalizeOperationPaths(
  value = {},
) {
  return {
    catalogSync:
      normalizeOperationPath(
        value.catalogSync,
      ),

    inventorySync:
      normalizeOperationPath(
        value.inventorySync,
      ),

    supplierPurchaseOrder:
      normalizeOperationPath(
        value
          .supplierPurchaseOrder,
      ),

    payoutExecution:
      normalizeOperationPath(
        value.payoutExecution,
      ),
  }
}

function serializePartnerConnection(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    organizationId:
      id(
        item.organizationId,
      ),

    partnerKey:
      item.partnerKey,

    displayName:
      item.displayName,

    partnerType:
      item.partnerType,

    adapterType:
      item.adapterType,

    baseUrl:
      item.baseUrl,

    credentialConfigured:
      Boolean(
        item.credentialEnvKey,
      ),

    webhookSecretConfigured:
      Boolean(
        item.webhookSecretEnvKey,
      ),

    allowedOperations:
      item.allowedOperations ||
      [],

    operationPaths:
      item.operationPaths ||
      {},

    status:
      item.status,

    reviewedAt:
      item.reviewedAt ||
      null,

    reviewReason:
      item.reviewReason ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializePartnerEvent(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    partnerConnectionId:
      id(
        item
          .partnerConnectionId,
      ),

    direction:
      item.direction,

    operation:
      item.operation,

    idempotencyKey:
      item.idempotencyKey,

    correlationId:
      item.correlationId ||
      '',

    status:
      item.status,

    providerEventId:
      item.providerEventId ||
      '',

    sourceEntityType:
      item.sourceEntityType ||
      '',

    sourceEntityId:
      item.sourceEntityId ||
      '',

    normalizedSummary:
      item.normalizedSummary ||
      {},

    errorCode:
      item.errorCode ||
      '',

    errorMessage:
      item.errorMessage ||
      '',

    occurredAt:
      item.occurredAt,
  }
}

function serializePurchaseOrder(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    procurementPlanId:
      id(
        item.procurementPlanId,
      ),

    supplierId:
      id(
        item.supplierId,
      ),

    partnerConnectionId:
      id(
        item
          .partnerConnectionId,
      ),

    poNumber:
      item.poNumber,

    status:
      item.status,

    currency:
      item.currency,

    lines:
      item.lines ||
      [],

    expectedTotalMinor:
      item.expectedTotalMinor,

    approvedAt:
      item.approvedAt ||
      null,

    submittedAt:
      item.submittedAt ||
      null,

    acknowledgedAt:
      item.acknowledgedAt ||
      null,

    receivedAt:
      item.receivedAt ||
      null,

    providerReference:
      item.providerReference ||
      '',

    lastReason:
      item.lastReason ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

function serializePayoutExecution(
  value,
) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      id(
        item._id,
      ),

    settlementId:
      id(
        item.settlementId,
      ),

    partnerConnectionId:
      id(
        item
          .partnerConnectionId,
      ),

    status:
      item.status,

    amountMinor:
      item.amountMinor,

    currency:
      item.currency,

    providerReference:
      item.providerReference ||
      '',

    attemptCount:
      item.attemptCount,

    lastAttemptAt:
      item.lastAttemptAt,

    lastErrorCode:
      item.lastErrorCode ||
      '',

    lastErrorMessage:
      item.lastErrorMessage ||
      '',

    createdAt:
      item.createdAt ||
      null,

    updatedAt:
      item.updatedAt ||
      null,
  }
}

export async function requireM22ExecutionScaleFeature() {
  const flag =
    await AdminFeatureFlag.findOne({
      key:
        M22_EXECUTION_SCALE_FEATURE_FLAG,

      enabled:
        true,

      environments:
        env.nodeEnv,
    }).lean()

  if (!flag) {
    throw new ApiError(
      404,
      'M22 execution scale is not enabled for this environment.',
      [
        {
          code:
            'M22_EXECUTION_SCALE_FEATURE_DISABLED',

          featureFlagKey:
            M22_EXECUTION_SCALE_FEATURE_FLAG,
        },
      ],
    )
  }

  return flag
}

function assertHospitalityPermission(
  context,
  permissionKey,
) {
  if (
    context
      .isOrganizationOwner ===
      true ||
    context.permissionKeys.includes(
      permissionKey,
    )
  ) {
    return
  }

  throw new ApiError(
    403,
    'Hospitality permission is required for this execution action.',
    [
      {
        code:
          'M22_HOSPITALITY_PERMISSION_REQUIRED',

        permissionKey,
      },
    ],
  )
}

function assertAdminPermission(
  adminAuthorization,
  permissionKey,
) {
  if (
    adminAuthorization
      ?.permissionKeys
      ?.includes(
        permissionKey,
      )
  ) {
    return
  }

  throw new ApiError(
    403,
    'Administrative permission is required for this execution action.',
    [
      {
        code:
          'M22_ADMIN_PERMISSION_REQUIRED',

        permissionKey,
      },
    ],
  )
}

function operationPathFor(
  connection,
  operation,
) {
  const map = {
    catalog_sync:
      connection
        .operationPaths
        ?.catalogSync,

    inventory_sync:
      connection
        .operationPaths
        ?.inventorySync,

    supplier_po_submit:
      connection
        .operationPaths
        ?.supplierPurchaseOrder,

    payout_execute:
      connection
        .operationPaths
        ?.payoutExecution,
  }

  const path =
    map[
      operation
    ] ||
    ''

  if (!path) {
    throw new ApiError(
      409,
      'Partner connection does not define this operation path.',
      [
        {
          code:
            'M22_PARTNER_OPERATION_PATH_REQUIRED',

          operation,
        },
      ],
    )
  }

  return path
}

function requireActiveOperation(
  connection,
  operation,
) {
  if (
    connection.status !==
      'active' ||
    !connection.allowedOperations.includes(
      operation,
    )
  ) {
    throw new ApiError(
      409,
      'Partner connection is not active for this operation.',
      [
        {
          code:
            'M22_PARTNER_OPERATION_NOT_ACTIVE',

          operation,
        },
      ],
    )
  }
}

function credentialFor(
  connection,
) {
  if (
    !connection
      .credentialEnvKey
  ) {
    return ''
  }

  return String(
    process.env[
      connection
        .credentialEnvKey
    ] ||
      '',
  )
}

async function requestPartner({
  connection,
  operation,
  method,
  body = null,
  idempotencyKey,
  correlationId,
}) {
  const path =
    operationPathFor(
      connection,
      operation,
    )

  const credential =
    credentialFor(
      connection,
    )

  if (
    connection
      .credentialEnvKey &&
    !credential
  ) {
    throw new ApiError(
      503,
      'Partner credential reference is configured but unavailable in this environment.',
      [
        {
          code:
            'M22_PARTNER_CREDENTIAL_UNAVAILABLE',
        },
      ],
    )
  }

  const headers = {
    accept:
      'application/json',

    'content-type':
      'application/json',

    'idempotency-key':
      idempotencyKey,

    'x-correlation-id':
      correlationId,
  }

  if (credential) {
    headers.authorization =
      `Bearer ${credential}`
  }

  const url =
    `${connection.baseUrl}${path}`

  const response =
    await fetch(
      url,
      {
        method,
        headers,

        body:
          body ===
          null
            ? undefined
            : JSON.stringify(
                body,
              ),
      },
    )

  const text =
    await response.text()

  let data =
    null

  if (text) {
    try {
      data =
        JSON.parse(
          text,
        )
    } catch {
      data = {
        opaqueTextReceived:
          true,
      }
    }
  }

  if (
    !response.ok
  ) {
    const error =
      new Error(
        `Partner returned HTTP ${response.status}.`,
      )

    error.code =
      `PARTNER_HTTP_${response.status}`

    error.httpStatus =
      response.status

    throw error
  }

  return {
    status:
      response.status,

    data,
  }
}

async function appendPartnerEvent(
  input,
) {
  const event =
    await PartnerExecutionEvent.create(
      input,
    )

  return event
}

/*
|--------------------------------------------------------------------------
| PART 1
| Partner Integration Hub
|--------------------------------------------------------------------------
*/

export async function createPartnerConnection({
  input,
  actorUser,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.manage',
  )

  const baseUrl =
    assertHttpsPublicUrl(
      input.baseUrl,
    )

  const operationPaths =
    normalizeOperationPaths(
      input.operationPaths,
    )

  const allowedByPartnerType = {
    retailer_sync:
      new Set([
        'catalog_sync',
        'inventory_sync',
        'webhook_receive',
      ]),

    supplier:
      new Set([
        'supplier_po_submit',
        'webhook_receive',
      ]),

    payout_provider:
      new Set([
        'payout_execute',
        'webhook_receive',
      ]),
  }

  const invalidOperation =
    input.allowedOperations.find(
      (
        operation,
      ) =>
        !allowedByPartnerType[
          input.partnerType
        ]?.has(
          operation,
        ),
    )

  if (invalidOperation) {
    throw new ApiError(
      400,
      'Partner operation is incompatible with the selected partner type.',
      [
        {
          code:
            'M22_PARTNER_OPERATION_TYPE_MISMATCH',

          operation:
            invalidOperation,

          partnerType:
            input.partnerType,
        },
      ],
    )
  }

  const requiredPathByOperation = {
    catalog_sync:
      operationPaths.catalogSync,

    inventory_sync:
      operationPaths.inventorySync,

    supplier_po_submit:
      operationPaths
        .supplierPurchaseOrder,

    payout_execute:
      operationPaths
        .payoutExecution,
  }

  for (
    const operation
    of input.allowedOperations
  ) {
    if (
      operation !==
        'webhook_receive' &&
      !requiredPathByOperation[
        operation
      ]
    ) {
      throw new ApiError(
        400,
        'Every enabled outbound partner operation requires a configured operation path.',
        [
          {
            code:
              'M22_PARTNER_ENABLED_OPERATION_PATH_REQUIRED',

            operation,
          },
        ],
      )
    }
  }

  const existing =
    await PartnerConnection.findOne({
      organizationId:
        context
          .organization
          ._id,

      partnerKey:
        input.partnerKey,
    }).lean()

  if (existing) {
    return {
      partnerConnection:
        serializePartnerConnection(
          existing,
        ),

      deduplicated:
        true,
    }
  }

  const connection =
    await PartnerConnection.create({
      organizationId:
        context
          .organization
          ._id,

      partnerKey:
        input.partnerKey,

      displayName:
        input.displayName,

      partnerType:
        input.partnerType,

      adapterType:
        'epantry_https_v1',

      baseUrl,

      credentialEnvKey:
        input.credentialEnvKey,

      webhookSecretEnvKey:
        input.webhookSecretEnvKey,

      allowedOperations:
        input.allowedOperations,

      operationPaths,

      status:
        'pending_review',

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  return {
    partnerConnection:
      serializePartnerConnection(
        connection,
      ),

    deduplicated:
      false,

    policy: {
      rawCredentialStored:
        false,

      adminActivationRequired:
        true,

      outboundHttpsOnly:
        true,

      privateNetworkTargetsAllowed:
        false,

      featureFlagIsAuthorization:
        false,
    },
  }
}

export async function listHostExecutionScale({
  actorUser,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,
    'api.read',
  )

  const [
    partnerConnections,
    purchaseOrders,
    payoutExecutions,
    recentPartnerEvents,
  ] =
    await Promise.all([
      PartnerConnection.find({
        organizationId:
          context
            .organization
            ._id,
      })
        .sort({
          createdAt:
            -1,
        })
        .lean(),

      PurchaseOrder.find({
        organizationId:
          context
            .organization
            ._id,
      })
        .sort({
          createdAt:
            -1,
        })
        .limit(
          100,
        )
        .lean(),

      PayoutExecution.find({
        organizationId:
          context
            .organization
            ._id,
      })
        .sort({
          createdAt:
            -1,
        })
        .limit(
          100,
        )
        .lean(),

      PartnerExecutionEvent.find({
        organizationId:
          context
            .organization
            ._id,
      })
        .sort({
          occurredAt:
            -1,
        })
        .limit(
          50,
        )
        .lean(),
    ])

  return {
    organizationId:
      id(
        context
          .organization
          ._id,
      ),

    /*
    | M11 remains Customer external retailer handoff authority.
    */

    externalRetailerHandoffPartners:
      listExternalCommercePartners(),

    partnerConnections:
      partnerConnections.map(
        serializePartnerConnection,
      ),

    purchaseOrders:
      purchaseOrders.map(
        serializePurchaseOrder,
      ),

    payoutExecutions:
      payoutExecutions.map(
        serializePayoutExecution,
      ),

    recentPartnerEvents:
      recentPartnerEvents.map(
        serializePartnerEvent,
      ),

    policy: {
      m05MarketplaceTruthPreserved:
        true,

      m11ExternalHandoffTruthPreserved:
        true,

      m16SettlementTruthPreserved:
        true,

      m18ProcurementPlanTruthPreserved:
        true,

      automaticPurchaseExecution:
        false,

      activeModeIsAuthorizationAuthority:
        false,
    },
  }
}

export async function reviewPartnerConnection({
  partnerConnectionId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  await requireM22ExecutionScaleFeature()

  const connection =
    await PartnerConnection.findById(
      partnerConnectionId,
    )

  if (!connection) {
    throw new ApiError(
      404,
      'Partner connection was not found.',
      [
        {
          code:
            'M22_PARTNER_CONNECTION_NOT_FOUND',
        },
      ],
    )
  }

  const permissionKey =
    connection.partnerType ===
      'payout_provider'
      ? 'finance.mutate'
      : 'marketplace.mutate'

  assertAdminPermission(
    adminAuthorization,
    permissionKey,
  )

  const before =
    serializePartnerConnection(
      connection,
    )

  connection.status =
    input.decision ===
      'activate'
      ? 'active'
      : input.decision ===
          'reject'
        ? 'rejected'
        : 'disabled'

  connection.reviewedByUserId =
    actorId(
      actorUser,
    )

  connection.reviewedAt =
    new Date()

  connection.reviewReason =
    input.reason

  await connection.save()

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      permissionKey,

    permissionKey,

    entityType:
      'partner_connection',

    entityId:
      id(
        connection._id,
      ),

    reasonCode:
      connection.partnerType ===
        'payout_provider'
        ? 'finance.operation'
        : 'marketplace.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializePartnerConnection(
        connection,
      ),

    metadata: {
      operation:
        'm22_partner_connection_review',

      decision:
        input.decision,

      rawCredentialStored:
        false,
    },

    requestId,
  })

  return {
    partnerConnection:
      serializePartnerConnection(
        connection,
      ),
  }
}

export async function runHostPartnerSync({
  partnerConnectionId,
  operation,
  idempotencyKey,
  actorUser,
  correlationId,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHostOperationsContext(
      actorUser,
    )

  assertHostOperationsPermission(
    context,

    operation ===
      'catalog_sync'
      ? 'catalog.ingest'
      : 'inventory.manage',
  )

  const connection =
    await PartnerConnection.findOne({
      _id:
        partnerConnectionId,

      organizationId:
        context
          .organization
          ._id,

      partnerType:
        'retailer_sync',
    })

  if (!connection) {
    throw new ApiError(
      404,
      'Retailer sync connection was not found for this Host organization.',
      [
        {
          code:
            'M22_RETAILER_SYNC_CONNECTION_NOT_FOUND',
        },
      ],
    )
  }

  requireActiveOperation(
    connection,
    operation,
  )

  const priorSuccess =
    await PartnerExecutionEvent.findOne({
      partnerConnectionId:
        connection._id,

      operation,

      idempotencyKey,

      status:
        'succeeded',
    }).lean()

  if (priorSuccess) {
    return {
      deduplicated:
        true,

      event:
        serializePartnerEvent(
          priorSuccess,
        ),
    }
  }

  const requestFingerprint =
    fingerprint({
      operation,

      partnerConnectionId:
        id(
          connection._id,
        ),
    })

  try {
    const result =
      await executePartnerOperation({
        partnerKey:
          connection.partnerKey,

        operationKey:
          operation,

        /*
        | Pull sync is read-only at partner boundary.
        | It is safe to retry under M20 bounded policy.
        */

        safeToRetry:
          true,

        maxAttempts:
          2,

        allowStaleFallback:
          false,

        correlationId,

        handler:
          () =>
            requestPartner({
              connection,
              operation,

              method:
                'GET',

              idempotencyKey,
              correlationId,
            }),
      })

    const payload =
      unwrapPartnerResult(
        result,
      )

    let delegated =
      null

    if (
      operation ===
      'catalog_sync'
    ) {
      const rows =
        Array.isArray(
          payload?.rows,
        )
          ? payload.rows
          : []

      if (!rows.length) {
        throw new ApiError(
          409,
          'Retailer catalog sync returned no normalized rows.',
          [
            {
              code:
                'M22_CATALOG_SYNC_ROWS_REQUIRED',
            },
          ],
        )
      }

      /*
      |--------------------------------------------------------------------------
      | Validate with the frozen M16 API contract
      |--------------------------------------------------------------------------
      |
      | Calling a service directly must not bypass the public validation
      | contract that normally protects the HTTP route.
      */

      const parsedCatalog =
        createCatalogIngestJobSchema
          .safeParse({
            sourceType:
              'external_api',

            rows,
          })

      if (
        !parsedCatalog.success
      ) {
        throw new ApiError(
          409,
          'Retailer catalog sync did not satisfy the normalized M16 ingest contract.',
          [
            {
              code:
                'M22_CATALOG_SYNC_NORMALIZATION_INVALID',

              issues:
                parsedCatalog
                  .error
                  .issues,
            },
          ],
        )
      }

      delegated =
        await createCatalogIngestJob({
          input:
            parsedCatalog.data,

          idempotencyKey:
            `m22:${idempotencyKey}`,

          actorUser,
        })
    } else {
      const items =
        Array.isArray(
          payload?.items,
        )
          ? payload.items.map(
              (
                item,
              ) => ({
                ...item,

                sourceType:
                  'external_api',

                sourceReference:
                  item
                    .sourceReference ||
                  `m22:${connection.partnerKey}`,
              }),
            )
          : []

      if (!items.length) {
        throw new ApiError(
          409,
          'Retailer inventory sync returned no normalized inventory observations.',
          [
            {
              code:
                'M22_INVENTORY_SYNC_ITEMS_REQUIRED',
            },
          ],
        )
      }

      const parsedInventory =
        bulkInventorySnapshotSchema
          .safeParse({
            items,
          })

      if (
        !parsedInventory.success
      ) {
        throw new ApiError(
          409,
          'Retailer inventory sync did not satisfy the normalized M05 inventory contract.',
          [
            {
              code:
                'M22_INVENTORY_SYNC_NORMALIZATION_INVALID',

              issues:
                parsedInventory
                  .error
                  .issues,
            },
          ],
        )
      }

      delegated =
        await createBulkInventorySnapshots(
          parsedInventory.data,
          actorUser,
        )
    }

    const event =
      await appendPartnerEvent({
        organizationId:
          context
            .organization
            ._id,

        partnerConnectionId:
          connection._id,

        direction:
          'outbound',

        operation,
        idempotencyKey,
        correlationId,

        status:
          'succeeded',

        requestFingerprint,

        responseFingerprint:
          fingerprint(
            payload,
          ),

        sourceEntityType:
          operation ===
            'catalog_sync'
            ? 'host_catalog_ingest'
            : 'inventory_snapshot_batch',

        sourceEntityId:
          id(
            delegated?.job?.id ||
              delegated?.job?._id ||
              delegated
                ?.inventoryBatchId ||
              '',
          ) ||
          '',

        normalizedSummary: {
          delegatedTo:
            operation ===
              'catalog_sync'
              ? 'M16.createCatalogIngestJob'
              : 'M05.createBulkInventorySnapshots',

          recordCount:
            operation ===
              'catalog_sync'
              ? payload
                  .rows
                  .length
              : payload
                  .items
                  .length,
        },
      })

    return {
      deduplicated:
        false,

      event:
        serializePartnerEvent(
          event,
        ),

      delegated,

      policy: {
        canonicalProductVersionDirectMutation:
          false,

        priceRuleDirectMutation:
          false,

        serviceabilityDirectMutation:
          false,
      },
    }
  } catch (
    error
  ) {
    const event =
      await appendPartnerEvent({
        organizationId:
          context
            .organization
            ._id,

        partnerConnectionId:
          connection._id,

        direction:
          'outbound',

        operation,
        idempotencyKey,
        correlationId,

        status:
          isAmbiguousPartnerWriteFailure(
            error,
          )
            ? 'ambiguous'
            : 'failed',

        requestFingerprint,

        errorCode:
          String(
            partnerFailureCauseCode(
              error,
            ) ||
              'PARTNER_SYNC_FAILED',
          ).slice(
            0,
            160,
          ),

        errorMessage:
          redactErrorMessage(
            error,
          ),

        normalizedSummary: {
          canonicalMutationPerformed:
            false,
        },
      })

    error.m22PartnerEvent =
      serializePartnerEvent(
        event,
      )

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| PART 2
| B2B / Hospitality Procurement Execution
|--------------------------------------------------------------------------
*/

function groupProcurementLinesBySupplier(
  plan,
) {
  const groups =
    new Map()

  for (
    const line
    of plan.lines ||
    []
  ) {
    if (
      !line
        .selectedSupplierId ||
      !line
        .selectedSupplierProductId ||
      line
        .selectedExpectedCostMinor ===
        null ||
      line
        .selectedExpectedCostMinor ===
        undefined
    ) {
      throw new ApiError(
        409,
        'Every Purchase Order line requires an explicit supplier selection from the M18 Procurement Plan.',
        [
          {
            code:
              'M22_PROCUREMENT_PLAN_SUPPLIER_SELECTION_INCOMPLETE',

            canonicalIngredientId:
              id(
                line
                  .canonicalIngredientId,
              ),
          },
        ],
      )
    }

    const supplierId =
      id(
        line
          .selectedSupplierId,
      )

    if (
      !groups.has(
        supplierId,
      )
    ) {
      groups.set(
        supplierId,
        [],
      )
    }

    groups
      .get(
        supplierId,
      )
      .push({
        canonicalIngredientId:
          line
            .canonicalIngredientId,

        supplierProductId:
          line
            .selectedSupplierProductId,

        quantity:
          line.quantity,

        unit:
          line.unit,

        expectedCostMinor:
          line
            .selectedExpectedCostMinor,
      })
  }

  return groups
}

async function appendPurchaseOrderEvent({
  purchaseOrder,
  eventType,
  actorUser = null,
  reason,
  metadata = {},
}) {
  return PurchaseOrderEvent.create({
    purchaseOrderId:
      purchaseOrder._id,

    organizationId:
      purchaseOrder
        .organizationId,

    eventType,

    actorUserId:
      actorUser
        ? actorId(
            actorUser,
          )
        : null,

    reason,
    metadata,
  })
}

export async function createPurchaseOrdersFromProcurementPlan({
  procurementPlanId,
  idempotencyKey,
  reason,
  actorUser,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHospitalityContext(
      actorUser,
    )

  assertHospitalityPermission(
    context,
    'hospitality.procurement.manage',
  )

  /*
  |--------------------------------------------------------------------------
  | M18 remains Procurement Plan truth
  |--------------------------------------------------------------------------
  |
  | M22 deliberately does not:
  |
  | recalculate shortage
  | compare another supplier
  | rewrite selected supplier
  | alter production plan
  |
  */

  const plan =
    await HospitalityProcurementPlan.findOne({
      _id:
        procurementPlanId,

      organizationId:
        context
          .organization
          ._id,

      status: {
        $ne:
          'cancelled',
      },
    }).lean()

  if (!plan) {
    throw new ApiError(
      404,
      'Hospitality Procurement Plan was not found for execution.',
      [
        {
          code:
            'M22_PROCUREMENT_PLAN_NOT_FOUND',
        },
      ],
    )
  }

  const groups =
    groupProcurementLinesBySupplier(
      plan,
    )

  if (
    groups.size ===
    0
  ) {
    throw new ApiError(
      409,
      'Procurement Plan has no supplier-selected lines to execute.',
      [
        {
          code:
            'M22_PROCUREMENT_PLAN_NO_EXECUTABLE_LINES',
        },
      ],
    )
  }

  const purchaseOrders =
    []

  for (
    const [
      supplierId,
      lines,
    ]
    of groups.entries()
  ) {
    let purchaseOrder =
      await PurchaseOrder.findOne({
        organizationId:
          context
            .organization
            ._id,

        procurementPlanId:
          plan._id,

        supplierId,
      })

    if (!purchaseOrder) {
      const expectedTotalMinor =
        lines.reduce(
          (
            total,
            line,
          ) =>
            total +
            Number(
              line
                .expectedCostMinor ||
                0,
            ),
          0,
        )

      purchaseOrder =
        await PurchaseOrder.create({
          organizationId:
            context
              .organization
              ._id,

          procurementPlanId:
            plan._id,

          supplierId,

          poNumber:
            `PO-${crypto.randomUUID()}`,

          status:
            'draft',

          currency:
            plan.currency,

          lines,

          expectedTotalMinor,

          idempotencyKey:
            `${idempotencyKey}:${supplierId}`,

          createdByUserId:
            actorId(
              actorUser,
            ),

          lastReason:
            reason,
        })

      await appendPurchaseOrderEvent({
        purchaseOrder,

        eventType:
          'created',

        actorUser,

        reason,

        metadata: {
          sourceProcurementPlanId:
            id(
              plan._id,
            ),

          automaticPurchaseOrderSubmission:
            false,
        },
      })
    }

    purchaseOrders.push(
      serializePurchaseOrder(
        purchaseOrder,
      ),
    )
  }

  return {
    purchaseOrders,

    sourceProcurementPlan: {
      id:
        id(
          plan._id,
        ),

      status:
        plan.status,

      supplierSelectionPolicy:
        plan
          .supplierSelectionPolicy,
    },

    policy: {
      procurementDemandRecalculated:
        false,

      supplierSelectionRecomputed:
        false,

      automaticPurchaseOrderSubmission:
        false,

      purchaseOrderApprovalRequired:
        true,

      aiPurchaseAuthority:
        false,
    },
  }
}

export async function transitionPurchaseOrder({
  purchaseOrderId,
  input,
  actorUser,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHospitalityContext(
      actorUser,
    )

  assertHospitalityPermission(
    context,
    'hospitality.procurement.manage',
  )

  const purchaseOrder =
    await PurchaseOrder.findOne({
      _id:
        purchaseOrderId,

      organizationId:
        context
          .organization
          ._id,
    })

  if (!purchaseOrder) {
    throw new ApiError(
      404,
      'Purchase Order was not found.',
      [
        {
          code:
            'M22_PURCHASE_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  const userId =
    actorId(
      actorUser,
    )

  const action =
    input.action

  let eventType =
    action

  if (
    action ===
    'approve'
  ) {
    if (
      purchaseOrder.status !==
      'draft'
    ) {
      throw new ApiError(
        409,
        'Only a draft Purchase Order can be approved.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_APPROVAL_STATE_INVALID',
          },
        ],
      )
    }

    /*
    |--------------------------------------------------------------------------
    | Maker checker
    |--------------------------------------------------------------------------
    |
    | External procurement spends money.
    | The PO creator cannot approve their own PO.
    */

    if (
      id(
        purchaseOrder
          .createdByUserId,
      ) ===
      id(
        userId,
      )
    ) {
      throw new ApiError(
        409,
        'Purchase Order approval requires a distinct checker.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_MAKER_CHECKER_REQUIRED',
          },
        ],
      )
    }

    purchaseOrder.status =
      'approved'

    purchaseOrder.approvedByUserId =
      userId

    purchaseOrder.approvedAt =
      new Date()

    eventType =
      'approved'
  } else if (
    action ===
    'acknowledge'
  ) {
    if (
      purchaseOrder.status !==
      'submitted'
    ) {
      throw new ApiError(
        409,
        'Only a submitted Purchase Order can be acknowledged.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_ACK_STATE_INVALID',
          },
        ],
      )
    }

    purchaseOrder.status =
      'acknowledged'

    purchaseOrder.acknowledgedAt =
      new Date()

    purchaseOrder.providerReference =
      input.providerReference ||
      purchaseOrder.providerReference

    eventType =
      'acknowledged'
  } else if (
    action ===
    'partially_receive'
  ) {
    if (
      ![
        'submitted',
        'acknowledged',
        'partially_received',
      ].includes(
        purchaseOrder.status,
      )
    ) {
      throw new ApiError(
        409,
        'Purchase Order cannot record partial receiving from its current state.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_PARTIAL_RECEIPT_STATE_INVALID',
          },
        ],
      )
    }

    purchaseOrder.status =
      'partially_received'

    eventType =
      'partially_received'
  } else if (
    action ===
    'receive'
  ) {
    if (
      ![
        'submitted',
        'acknowledged',
        'partially_received',
      ].includes(
        purchaseOrder.status,
      )
    ) {
      throw new ApiError(
        409,
        'Purchase Order cannot be received from its current state.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_RECEIPT_STATE_INVALID',
          },
        ],
      )
    }

    purchaseOrder.status =
      'received'

    purchaseOrder.receivedAt =
      new Date()

    eventType =
      'received'

    await ReconciliationEvidence.create({
      organizationId:
        context
          .organization
          ._id,

      domain:
        'purchase_order',

      entityType:
        'purchase_order',

      entityId:
        id(
          purchaseOrder._id,
        ),

      status:
        input.observedTotalMinor ===
          purchaseOrder.expectedTotalMinor
          ? 'matched'
          : 'variance',

      expected: {
        totalMinor:
          purchaseOrder
            .expectedTotalMinor,

        currency:
          purchaseOrder.currency,
      },

      observed: {
        totalMinor:
          input.observedTotalMinor,

        currency:
          purchaseOrder.currency,
      },

      evidenceRefs:
        input.evidenceRefs,

      reason:
        input.reason,

      createdByUserId:
        userId,
    })
  } else if (
    action ===
    'cancel'
  ) {
    if (
      [
        'received',
        'closed',
        'cancelled',
      ].includes(
        purchaseOrder.status,
      )
    ) {
      throw new ApiError(
        409,
        'Purchase Order cannot be cancelled from its current state.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_CANCEL_STATE_INVALID',
          },
        ],
      )
    }

    purchaseOrder.status =
      'cancelled'

    eventType =
      'cancelled'
  } else if (
    action ===
    'close'
  ) {
    if (
      purchaseOrder.status !==
      'received'
    ) {
      throw new ApiError(
        409,
        'Only a received Purchase Order can be closed.',
        [
          {
            code:
              'M22_PURCHASE_ORDER_CLOSE_STATE_INVALID',
          },
        ],
      )
    }

    purchaseOrder.status =
      'closed'

    eventType =
      'closed'
  }

  purchaseOrder.lastReason =
    input.reason

  await purchaseOrder.save()

  await appendPurchaseOrderEvent({
    purchaseOrder,
    eventType,
    actorUser,

    reason:
      input.reason,

    metadata: {
      providerReference:
        input.providerReference ||
        '',

      observedTotalMinor:
        input.observedTotalMinor ??
        null,

      evidenceRefs:
        input.evidenceRefs ||
        [],
    },
  })

  return {
    purchaseOrder:
      serializePurchaseOrder(
        purchaseOrder,
      ),
  }
}

export async function submitPurchaseOrder({
  purchaseOrderId,
  partnerConnectionId,
  actorUser,
  correlationId,
}) {
  await requireM22ExecutionScaleFeature()

  const context =
    await resolveHospitalityContext(
      actorUser,
    )

  assertHospitalityPermission(
    context,
    'hospitality.procurement.manage',
  )

  const purchaseOrder =
    await PurchaseOrder.findOne({
      _id:
        purchaseOrderId,

      organizationId:
        context
          .organization
          ._id,
    })

  if (!purchaseOrder) {
    throw new ApiError(
      404,
      'Purchase Order was not found.',
      [
        {
          code:
            'M22_PURCHASE_ORDER_NOT_FOUND',
        },
      ],
    )
  }

  if (
    purchaseOrder.status ===
    'submitted'
  ) {
    return {
      deduplicated:
        true,

      purchaseOrder:
        serializePurchaseOrder(
          purchaseOrder,
        ),
    }
  }

  if (
    purchaseOrder.status !==
    'approved'
  ) {
    throw new ApiError(
      409,
      'Only an approved Purchase Order can be submitted.',
      [
        {
          code:
            'M22_PURCHASE_ORDER_APPROVAL_REQUIRED',
        },
      ],
    )
  }

  const connection =
    await PartnerConnection.findOne({
      _id:
        partnerConnectionId,

      organizationId:
        context
          .organization
          ._id,

      partnerType:
        'supplier',
    })

  if (!connection) {
    throw new ApiError(
      404,
      'Supplier partner connection was not found.',
      [
        {
          code:
            'M22_SUPPLIER_CONNECTION_NOT_FOUND',
        },
      ],
    )
  }

  requireActiveOperation(
    connection,
    'supplier_po_submit',
  )

  const payload = {
    poNumber:
      purchaseOrder.poNumber,

    procurementPlanId:
      id(
        purchaseOrder
          .procurementPlanId,
      ),

    supplierId:
      id(
        purchaseOrder
          .supplierId,
      ),

    currency:
      purchaseOrder.currency,

    expectedTotalMinor:
      purchaseOrder
        .expectedTotalMinor,

    lines:
      purchaseOrder.lines.map(
        (
          line,
        ) => ({
          canonicalIngredientId:
            id(
              line
                .canonicalIngredientId,
            ),

          supplierProductId:
            id(
              line
                .supplierProductId,
            ),

          quantity:
            line.quantity,

          unit:
            line.unit,

          expectedCostMinor:
            line.expectedCostMinor,
        }),
      ),
  }

  const requestFingerprint =
    fingerprint(
      payload,
    )

  try {
    /*
    |--------------------------------------------------------------------------
    | Economic write retry rule
    |--------------------------------------------------------------------------
    |
    | Do not blindly retry a supplier PO submission.
    |
    | The outbound idempotency key is sent once.
    |
    | A timeout / connection reset becomes ambiguous state and requires
    | reconciliation instead of risking duplicate supplier orders.
    */

    const result =
      await executePartnerOperation({
        partnerKey:
          connection.partnerKey,

        operationKey:
          'supplier_po_submit',

        safeToRetry:
          false,

        maxAttempts:
          1,

        allowStaleFallback:
          false,

        correlationId,

        handler:
          () =>
            requestPartner({
              connection,

              operation:
                'supplier_po_submit',

              method:
                'POST',

              body:
                payload,

              idempotencyKey:
                purchaseOrder
                  .idempotencyKey,

              correlationId,
            }),
      })

    const responseData =
      unwrapPartnerResult(
        result,
      )

    purchaseOrder.status =
      'submitted'

    purchaseOrder.partnerConnectionId =
      connection._id

    purchaseOrder.submittedAt =
      new Date()

    purchaseOrder.providerReference =
      String(
        responseData
          ?.providerReference ||
          responseData
            ?.orderId ||
          '',
      ).slice(
        0,
        300,
      )

    purchaseOrder.lastReason =
      'Submitted through M22 supplier adapter.'

    await purchaseOrder.save()

    await appendPurchaseOrderEvent({
      purchaseOrder,

      eventType:
        'submitted',

      actorUser,

      reason:
        'Purchase Order submitted through approved supplier partner connection.',

      metadata: {
        partnerConnectionId:
          id(
            connection._id,
          ),

        providerReference:
          purchaseOrder
            .providerReference,
      },
    })

    await appendPartnerEvent({
      organizationId:
        context
          .organization
          ._id,

      partnerConnectionId:
        connection._id,

      direction:
        'outbound',

      operation:
        'supplier_po_submit',

      idempotencyKey:
        purchaseOrder
          .idempotencyKey,

      correlationId,

      status:
        'succeeded',

      requestFingerprint,

      responseFingerprint:
        fingerprint(
          responseData,
        ),

      sourceEntityType:
        'purchase_order',

      sourceEntityId:
        id(
          purchaseOrder._id,
        ),

      normalizedSummary: {
        providerReference:
          purchaseOrder
            .providerReference,
      },
    })

    return {
      deduplicated:
        false,

      purchaseOrder:
        serializePurchaseOrder(
          purchaseOrder,
        ),

      policy: {
        economicWriteIdempotencyKey:
          purchaseOrder
            .idempotencyKey,

        automaticRetryPerformed:
          false,

        m18PlanMutated:
          false,
      },
    }
  } catch (
    error
  ) {
    const ambiguous =
      isAmbiguousPartnerWriteFailure(
        error,
      )

    await appendPurchaseOrderEvent({
      purchaseOrder,

      eventType:
        ambiguous
          ? 'submission_ambiguous'
          : 'submission_failed',

      actorUser,

      reason:
        redactErrorMessage(
          error,
        ),

      metadata: {
        automaticRetryPerformed:
          false,
      },
    })

    await appendPartnerEvent({
      organizationId:
        context
          .organization
          ._id,

      partnerConnectionId:
        connection._id,

      direction:
        'outbound',

      operation:
        'supplier_po_submit',

      idempotencyKey:
        purchaseOrder
          .idempotencyKey,

      correlationId,

      status:
        ambiguous
          ? 'ambiguous'
          : 'failed',

      requestFingerprint,

      sourceEntityType:
        'purchase_order',

      sourceEntityId:
        id(
          purchaseOrder._id,
        ),

      errorCode:
        String(
          partnerFailureCauseCode(
            error,
          ) ||
            'SUPPLIER_PO_SUBMISSION_FAILED',
        ).slice(
          0,
          160,
        ),

      errorMessage:
        redactErrorMessage(
          error,
        ),

      normalizedSummary: {
        automaticRetryPerformed:
          false,
      },
    })

    throw error
  }
}

/*
|--------------------------------------------------------------------------
| PART 3
| Finance Execution + Reconciliation
|--------------------------------------------------------------------------
|
| Critical boundary:
|
| M22 does NOT mark HostSettlement status=paid.
|
| M16 markAdminSettlementPaid() remains final settlement state authority.
|--------------------------------------------------------------------------
*/

export async function executeSettlementPayout({
  settlementId,
  partnerConnectionId,
  idempotencyKey,
  actorUser,
  adminAuthorization,
  requestId,
  correlationId,
}) {
  await requireM22ExecutionScaleFeature()

  assertAdminPermission(
    adminAuthorization,
    'finance.mutate',
  )

  const settlement =
    await HostSettlement.findOne({
      _id:
        settlementId,

      status:
        'approved',
    }).lean()

  if (!settlement) {
    throw new ApiError(
      404,
      'Approved M16 settlement was not found.',
      [
        {
          code:
            'M22_APPROVED_SETTLEMENT_NOT_FOUND',
        },
      ],
    )
  }

  const existing =
    await PayoutExecution.findOne({
      settlementId:
        settlement._id,
    })

  if (
    existing &&
    [
      'provider_confirmed',
      'reconciled',
    ].includes(
      existing.status,
    )
  ) {
    return {
      deduplicated:
        true,

      payoutExecution:
        serializePayoutExecution(
          existing,
        ),
    }
  }

  if (
    existing?.status ===
    'ambiguous'
  ) {
    throw new ApiError(
      409,
      'Previous payout attempt has ambiguous provider state and must be reconciled before retry.',
      [
        {
          code:
            'M22_PAYOUT_RECONCILIATION_REQUIRED',
        },
      ],
    )
  }

  const connection =
    await PartnerConnection.findOne({
      _id:
        partnerConnectionId,

      organizationId:
        settlement
          .organizationId,

      partnerType:
        'payout_provider',
    })

  if (!connection) {
    throw new ApiError(
      404,
      'Payout-provider connection was not found for the settlement organization.',
      [
        {
          code:
            'M22_PAYOUT_PROVIDER_CONNECTION_NOT_FOUND',
        },
      ],
    )
  }

  requireActiveOperation(
    connection,
    'payout_execute',
  )

  const payload = {
    settlementId:
      id(
        settlement._id,
      ),

    organizationId:
      id(
        settlement
          .organizationId,
      ),

    amountMinor:
      settlement
        .totals
        ?.netPayableMinor ||
      0,

    currency:
      settlement.currency,

    periodStart:
      settlement.periodStart,

    periodEnd:
      settlement.periodEnd,
  }

  const requestFingerprint =
    fingerprint(
      payload,
    )

  const current =
    existing ||
    await PayoutExecution.create({
      organizationId:
        settlement
          .organizationId,

      settlementId:
        settlement._id,

      partnerConnectionId:
        connection._id,

      status:
        'submitted',

      amountMinor:
        payload.amountMinor,

      currency:
        payload.currency,

      idempotencyKey,

      attemptCount:
        1,

      lastAttemptAt:
        new Date(),

      executedByUserId:
        actorId(
          actorUser,
        ),
    })

  if (existing) {
    current.status =
      'submitted'

    current.partnerConnectionId =
      connection._id

    current.attemptCount +=
      1

    current.lastAttemptAt =
      new Date()

    current.lastErrorCode =
      ''

    current.lastErrorMessage =
      ''
  }

  try {
    const result =
      await executePartnerOperation({
        partnerKey:
          connection.partnerKey,

        operationKey:
          'payout_execute',

        /*
        | Economic write:
        | never automatically retry ambiguous provider state.
        */

        safeToRetry:
          false,

        maxAttempts:
          1,

        allowStaleFallback:
          false,

        correlationId,

        handler:
          () =>
            requestPartner({
              connection,

              operation:
                'payout_execute',

              method:
                'POST',

              body:
                payload,

              idempotencyKey,

              correlationId,
            }),
      })

    const responseData =
      unwrapPartnerResult(
        result,
      )

    current.status =
      'provider_confirmed'

    current.providerReference =
      String(
        responseData
          ?.providerReference ||
          responseData
            ?.payoutId ||
          '',
      ).slice(
        0,
        300,
      )

    await current.save()

    await appendPartnerEvent({
      organizationId:
        settlement
          .organizationId,

      partnerConnectionId:
        connection._id,

      direction:
        'outbound',

      operation:
        'payout_execute',

      idempotencyKey,
      correlationId,

      status:
        'succeeded',

      requestFingerprint,

      responseFingerprint:
        fingerprint(
          responseData,
        ),

      sourceEntityType:
        'settlement',

      sourceEntityId:
        id(
          settlement._id,
        ),

      normalizedSummary: {
        providerReference:
          current
            .providerReference,

        settlementStatusMutated:
          false,
      },
    })

    await recordAdminAuditEvent({
      actorUser,
      adminAuthorization,

      action:
        'finance.mutate',

      permissionKey:
        'finance.mutate',

      entityType:
        'payout_execution',

      entityId:
        id(
          current._id,
        ),

      reasonCode:
        'finance.operation',

      reasonDetails:
        'M22 payout provider execution for an approved M16 settlement.',

      beforeSnapshot:
        null,

      afterSnapshot:
        serializePayoutExecution(
          current,
        ),

      metadata: {
        operation:
          'm22_execute_settlement_payout',

        settlementId:
          id(
            settlement._id,
          ),

        m16SettlementMarkedPaid:
          false,
      },

      requestId,
    })

    return {
      deduplicated:
        false,

      payoutExecution:
        serializePayoutExecution(
          current,
        ),

      nextStep: {
        requiresReconciliation:
          true,

        m16PaidTransitionStillRequired:
          true,
      },
    }
  } catch (
    error
  ) {
    const ambiguous =
      isAmbiguousPartnerWriteFailure(
        error,
      )

    current.status =
      ambiguous
        ? 'ambiguous'
        : 'provider_failed'

    current.lastErrorCode =
      String(
        partnerFailureCauseCode(
          error,
        ) ||
          'PAYOUT_EXECUTION_FAILED',
      ).slice(
        0,
        160,
      )

    current.lastErrorMessage =
      redactErrorMessage(
        error,
      )

    await current.save()

    await appendPartnerEvent({
      organizationId:
        settlement
          .organizationId,

      partnerConnectionId:
        connection._id,

      direction:
        'outbound',

      operation:
        'payout_execute',

      idempotencyKey,
      correlationId,

      status:
        ambiguous
          ? 'ambiguous'
          : 'failed',

      requestFingerprint,

      sourceEntityType:
        'settlement',

      sourceEntityId:
        id(
          settlement._id,
        ),

      errorCode:
        current
          .lastErrorCode,

      errorMessage:
        current
          .lastErrorMessage,

      normalizedSummary: {
        settlementStatusMutated:
          false,

        automaticRetryPerformed:
          false,
      },
    })

    throw error
  }
}

export async function reconcileSettlementPayout({
  payoutExecutionId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  await requireM22ExecutionScaleFeature()

  assertAdminPermission(
    adminAuthorization,
    'finance.mutate',
  )

  const payout =
    await PayoutExecution.findById(
      payoutExecutionId,
    )

  if (!payout) {
    throw new ApiError(
      404,
      'Payout execution was not found.',
      [
        {
          code:
            'M22_PAYOUT_EXECUTION_NOT_FOUND',
        },
      ],
    )
  }

  const status =
    input.outcome ===
      'matched'
      ? 'matched'
      : input.outcome ===
          'variance'
        ? 'variance'
        : 'manual_review'

  const evidence =
    await ReconciliationEvidence.create({
      organizationId:
        payout.organizationId,

      domain:
        'payout',

      entityType:
        'payout_execution',

      entityId:
        id(
          payout._id,
        ),

      status,

      expected: {
        amountMinor:
          payout.amountMinor,

        currency:
          payout.currency,
      },

      observed: {
        amountMinor:
          input
            .observedAmountMinor,

        currency:
          payout.currency,

        providerReference:
          input
            .providerReference,
      },

      evidenceRefs:
        input.evidenceRefs,

      reason:
        input.reason,

      createdByUserId:
        actorId(
          actorUser,
        ),
    })

  payout.status =
    input.outcome ===
      'matched'
      ? 'reconciled'
      : 'manual_review'

  payout.providerReference =
    input.providerReference ||
    payout.providerReference

  await payout.save()

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'finance.mutate',

    permissionKey:
      'finance.mutate',

    entityType:
      'payout_reconciliation',

    entityId:
      id(
        evidence._id,
      ),

    reasonCode:
      'finance.operation',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      null,

    afterSnapshot: {
      payoutExecution:
        serializePayoutExecution(
          payout,
        ),

      reconciliationStatus:
        evidence.status,
    },

    metadata: {
      operation:
        'm22_reconcile_settlement_payout',

      settlementMarkedPaid:
        false,

      existingM16MarkPaidAuthorityPreserved:
        true,
    },

    requestId,
  })

  return {
    payoutExecution:
      serializePayoutExecution(
        payout,
      ),

    reconciliation: {
      id:
        id(
          evidence._id,
        ),

      status:
        evidence.status,

      occurredAt:
        evidence.occurredAt,
    },

    policy: {
      m16SettlementMarkedPaidAutomatically:
        false,

      existingM16PaidTransitionStillAuthoritative:
        true,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Signed Partner Webhook
|--------------------------------------------------------------------------
*/

function normalizeWebhookSignature(
  value,
) {
  return String(
    value ||
    '',
  )
    .trim()
    .replace(
      /^sha256=/i,
      '',
    )
}

function secureEqual(
  left,
  right,
) {
  const leftBuffer =
    Buffer.from(
      left,
    )

  const rightBuffer =
    Buffer.from(
      right,
    )

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer,
  )
}

export async function processPartnerWebhook({
  partnerConnectionId,
  rawBody,
  signature,
  providerEventId,
}) {
  await requireM22ExecutionScaleFeature()

  const connection =
    await PartnerConnection.findOne({
      _id:
        partnerConnectionId,

      status:
        'active',

      allowedOperations:
        'webhook_receive',
    })

  if (!connection) {
    throw new ApiError(
      404,
      'Active webhook partner connection was not found.',
      [
        {
          code:
            'M22_WEBHOOK_CONNECTION_NOT_FOUND',
        },
      ],
    )
  }

  const secret =
    connection
      .webhookSecretEnvKey
      ? String(
          process.env[
            connection
              .webhookSecretEnvKey
          ] ||
            '',
        )
      : ''

  if (!secret) {
    throw new ApiError(
      503,
      'Webhook secret reference is unavailable.',
      [
        {
          code:
            'M22_WEBHOOK_SECRET_UNAVAILABLE',
        },
      ],
    )
  }

  const expected =
    crypto
      .createHmac(
        'sha256',
        secret,
      )
      .update(
        rawBody,
      )
      .digest(
        'hex',
      )

  const supplied =
    normalizeWebhookSignature(
      signature,
    )

  if (
    !supplied ||
    !secureEqual(
      supplied,
      expected,
    )
  ) {
    await appendPartnerEvent({
      organizationId:
        connection
          .organizationId,

      partnerConnectionId:
        connection._id,

      direction:
        'inbound',

      operation:
        'webhook_receive',

      idempotencyKey:
        providerEventId ||
        `invalid:${fingerprint(rawBody)}`,

      status:
        'rejected',

      providerEventId:
        providerEventId ||
        '',

      requestFingerprint:
        fingerprint(
          rawBody,
        ),

      errorCode:
        'WEBHOOK_SIGNATURE_INVALID',

      errorMessage:
        'Webhook signature verification failed.',
    })

    throw new ApiError(
      401,
      'Webhook signature is invalid.',
      [
        {
          code:
            'M22_WEBHOOK_SIGNATURE_INVALID',
        },
      ],
    )
  }

  if (providerEventId) {
    const existing =
      await PartnerExecutionEvent.findOne({
        partnerConnectionId:
          connection._id,

        operation:
          'webhook_receive',

        providerEventId,

        status:
          'received',
      }).lean()

    if (existing) {
      return {
        deduplicated:
          true,

        event:
          serializePartnerEvent(
            existing,
          ),
      }
    }
  }

  let payload =
    {}

  try {
    payload =
      JSON.parse(
        rawBody.toString(
          'utf8',
        ),
      )
  } catch {
    payload = {
      eventType:
        'non_json_payload',
    }
  }

  const event =
    await appendPartnerEvent({
      organizationId:
        connection
          .organizationId,

      partnerConnectionId:
        connection._id,

      direction:
        'inbound',

      operation:
        'webhook_receive',

      idempotencyKey:
        providerEventId ||
        fingerprint(
          rawBody,
        ),

      status:
        'received',

      providerEventId:
        providerEventId ||
        '',

      requestFingerprint:
        fingerprint(
          rawBody,
        ),

      /*
      | Raw webhook payload is NEVER persisted.
      | Only a normalized bounded summary + hash is retained.
      */

      normalizedSummary: {
        eventType:
          String(
            payload
              ?.eventType ||
              payload?.type ||
              'unknown',
          ).slice(
            0,
            120,
          ),

        sourceId:
          String(
            payload?.id ||
              payload
                ?.reference ||
              '',
          ).slice(
            0,
            240,
          ),

        rawPayloadStored:
          false,
      },
    })

  return {
    deduplicated:
      false,

    event:
      serializePartnerEvent(
        event,
      ),

    policy: {
      rawPayloadStored:
        false,

      signatureVerified:
        true,

      domainMutationPerformed:
        false,
    },
  }
}

export async function listAdminExecutionEvidence({
  limit = 100,
}) {
  await requireM22ExecutionScaleFeature()

  const [
    payoutExecutions,
    reconciliations,
    partnerConnections,
  ] =
    await Promise.all([
      PayoutExecution.find({})
        .sort({
          createdAt:
            -1,
        })
        .limit(
          limit,
        )
        .lean(),

      ReconciliationEvidence.find({})
        .sort({
          occurredAt:
            -1,
        })
        .limit(
          limit,
        )
        .lean(),

      PartnerConnection.find({})
        .sort({
          createdAt:
            -1,
        })
        .limit(
          limit,
        )
        .lean(),
    ])

  return {
    payoutExecutions:
      payoutExecutions.map(
        serializePayoutExecution,
      ),

    reconciliationEvidence:
      reconciliations.map(
        (
          item,
        ) => ({
          id:
            id(
              item._id,
            ),

          organizationId:
            id(
              item
                .organizationId,
            ),

          domain:
            item.domain,

          entityType:
            item.entityType,

          entityId:
            item.entityId,

          status:
            item.status,

          reason:
            item.reason,

          evidenceRefs:
            item.evidenceRefs ||
            [],

          occurredAt:
            item.occurredAt,
        }),
      ),

    partnerConnections:
      partnerConnections.map(
        serializePartnerConnection,
      ),

    generatedAt:
      new Date(),

    lookbackGuidanceMs:
      30 *
      DAY_MS,
  }
}