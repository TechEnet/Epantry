import {
  Router,
} from 'express'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  beginPurchaseSourceAuthorizationController,
  correctPurchaseTransactionController,
  createPurchaseSourceController,
  deleteImportedPurchaseHistoryController,
  getPurchaseSourceProvidersController,
  importPurchaseSourceGatewayBatchController,
  listPurchaseSourcesController,
  listPurchaseTransactionsController,
  requestPurchaseSourceSyncController,
  updatePurchaseSourceActionController,
} from './purchaseSource.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Trusted Provider Gateway Import
|--------------------------------------------------------------------------
|
| This machine endpoint intentionally does not use a Customer session.
| It is authenticated with a timestamped HMAC signature by the dedicated
| purchase-source integration gateway.
|
| The gateway owns provider OAuth credentials. EPANTRY receives only:
| - stable provider account reference long enough to hash it
| - provider-neutral normalized purchase transactions
|
*/

router.post(
  '/integrations/:sourceId/import',
  importPurchaseSourceGatewayBatchController,
)

/*
|--------------------------------------------------------------------------
| Customer Purchase Intelligence Boundary
|--------------------------------------------------------------------------
|
| Host identities retain Customer capability and may use these routes while
| working with their Customer household. The Customer capability remains the authorization source of truth.
|
*/

router.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
)

router.get(
  '/providers',
  getPurchaseSourceProvidersController,
)

router.get(
  '/',
  listPurchaseSourcesController,
)

router.post(
  '/',
  requireCsrfToken,
  createPurchaseSourceController,
)

router.post(
  '/:sourceId/authorization',
  requireCsrfToken,
  beginPurchaseSourceAuthorizationController,
)

router.post(
  '/:sourceId/sync',
  requireCsrfToken,
  requestPurchaseSourceSyncController,
)

router.patch(
  '/:sourceId/actions',
  requireCsrfToken,
  updatePurchaseSourceActionController,
)

router.delete(
  '/:sourceId/history',
  requireCsrfToken,
  deleteImportedPurchaseHistoryController,
)

router.get(
  '/transactions/history',
  listPurchaseTransactionsController,
)

router.patch(
  '/transactions/:transactionId',
  requireCsrfToken,
  correctPurchaseTransactionController,
)

export default router
