import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  createPurchaseSourceAuthorizationHandoff,
  completePurchaseSourceIntegrationImport,
  getPurchaseSourceProviderCapabilities,
  notifyPurchaseSourceGatewayLifecycle,
  requestPurchaseSourceGatewaySync,
  verifyPurchaseSourceIntegrationSignature,
} from './purchaseSource.integration.service.js'

import {
  correctPurchaseTransactionForUser,
  createPurchaseSource,
  deleteImportedPurchaseHistoryForUser,
  listPurchaseSourcesForUser,
  listPurchaseTransactionsForUser,
  updatePurchaseSourceAction,
} from './purchaseSource.service.js'

import {
  purchaseTransactionListQuerySchema,
} from './purchaseSource.validation.js'

function withRequestId(
  req,
  data,
) {
  return {
    ...data,
    requestId:
      req.requestId,
  }
}

export async function getPurchaseSourceProvidersController(
  req,
  res,
) {
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          getPurchaseSourceProviderCapabilities(),
        ),
        'Purchase source providers loaded',
      ),
    )
}

export async function createPurchaseSourceController(
  req,
  res,
) {
  const result =
    await createPurchaseSource({
      actorUser:
        req.currentUser,
      payload:
        req.body,
    })

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        withRequestId(
          req,
          result,
        ),
        'Purchase source created',
      ),
    )
}

export async function listPurchaseSourcesController(
  req,
  res,
) {
  const result =
    await listPurchaseSourcesForUser({
      actorUser:
        req.currentUser,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          result,
        ),
        'Connected purchase sources loaded',
      ),
    )
}

export async function beginPurchaseSourceAuthorizationController(
  req,
  res,
) {
  const result =
    await createPurchaseSourceAuthorizationHandoff({
      actorUser:
        req.currentUser,
      sourceId:
        req.params.sourceId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          result,
        ),
        'Provider authorization handoff created',
      ),
    )
}

export async function updatePurchaseSourceActionController(
  req,
  res,
) {
  const result =
    await updatePurchaseSourceAction({
      actorUser:
        req.currentUser,
      sourceId:
        req.params.sourceId,
      payload:
        req.body,
    })

  const integration =
    await notifyPurchaseSourceGatewayLifecycle({
      actorUser:
        req.currentUser,
      source:
        result.source,
      action:
        req.body?.action,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          {
            ...result,
            integration,
          },
        ),
        'Purchase source updated',
      ),
    )
}

export async function requestPurchaseSourceSyncController(
  req,
  res,
) {
  const result =
    await requestPurchaseSourceGatewaySync({
      actorUser:
        req.currentUser,
      sourceId:
        req.params.sourceId,
    })

  return res
    .status(202)
    .json(
      new ApiResponse(
        202,
        withRequestId(
          req,
          result,
        ),
        'Purchase source synchronization requested',
      ),
    )
}

export async function listPurchaseTransactionsController(
  req,
  res,
) {
  const parsed =
    purchaseTransactionListQuerySchema.safeParse(
      req.query ||
      {},
    )

  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error
        ?.issues?.[0]
        ?.message ||
        'Invalid purchase history query.',
    )
  }

  const result =
    await listPurchaseTransactionsForUser({
      actorUser:
        req.currentUser,
      sourceId:
        parsed.data.sourceId ||
        null,
      limit:
        parsed.data.limit,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          result,
        ),
        'Imported purchase history loaded',
      ),
    )
}

export async function correctPurchaseTransactionController(
  req,
  res,
) {
  const result =
    await correctPurchaseTransactionForUser({
      actorUser:
        req.currentUser,
      transactionId:
        req.params.transactionId,
      payload:
        req.body,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          result,
        ),
        'Imported purchase corrected',
      ),
    )
}

export async function deleteImportedPurchaseHistoryController(
  req,
  res,
) {
  const result =
    await deleteImportedPurchaseHistoryForUser({
      actorUser:
        req.currentUser,
      sourceId:
        req.params.sourceId,
    })

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        withRequestId(
          req,
          result,
        ),
        'Imported purchase history deleted',
      ),
    )
}

export async function importPurchaseSourceGatewayBatchController(
  req,
  res,
) {
  verifyPurchaseSourceIntegrationSignature({
    headers:
      req.headers,
    body:
      req.body,
  })

  const result =
    await completePurchaseSourceIntegrationImport({
      sourceId:
        req.params.sourceId,
      payload:
        req.body,
    })

  return res
    .status(202)
    .json(
      new ApiResponse(
        202,
        withRequestId(
          req,
          result,
        ),
        'Normalized purchase batch accepted',
      ),
    )
}
