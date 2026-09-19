import {
  Router,
} from 'express'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
  requireMfaAssurance,
} from '../auth/auth.middleware.js'

import {
  requireHostAccess,
} from '../auth/authorization.middleware.js'

import {
  createHostOfferController,
  getHostMarketplaceOrganizationController,
  getHostOfferController,
  listHostOffersController,
  updateHostOfferController,
} from './marketplace.host.controller.js'

import {
  createBulkInventorySnapshotsController,
  createInventoryNodeController,
  getHostCurrentInventoryController,
  getInventoryNodeController,
  listHostInventoryHistoryController,
  listInventoryNodesController,
  updateInventoryNodeController,
} from './marketplace.inventory.controller.js'

import {
  activateHostOfferController,
  inspectHostOfferReadinessController,
} from './marketplace.offer-readiness.controller.js'

import {
  createHostPriceRuleController,
  getHostEffectivePriceController,
  listHostPriceRulesController,
} from './marketplace.pricing.controller.js'

import {
  createServiceAreaController,
  getServiceAreaController,
  listServiceAreasController,
  resolveHostOfferServiceabilityController,
  updateServiceAreaController,
} from './marketplace.serviceability.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Host Marketplace Security Boundary
|--------------------------------------------------------------------------
|
| activeMode is NOT authority.
|
| Actual active Host capability is required.
|
| Commercial Host workspace requires MFA assurance.
|
| Super Admin receives no implicit Host tenant bypass.
|--------------------------------------------------------------------------
*/

router.use(
  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireHostAccess,

  requireMfaAssurance,
)

/*
|--------------------------------------------------------------------------
| Organization
|--------------------------------------------------------------------------
*/

router.get(
  '/organization',

  getHostMarketplaceOrganizationController,
)

/*
|--------------------------------------------------------------------------
| Host Offers
|--------------------------------------------------------------------------
*/

router.get(
  '/offers',

  listHostOffersController,
)

router.get(
  '/offers/:id',

  getHostOfferController,
)

router.post(
  '/offers',

  requireCsrfToken,

  createHostOfferController,
)

router.patch(
  '/offers/:id',

  requireCsrfToken,

  updateHostOfferController,
)

/*
|--------------------------------------------------------------------------
| Offer Readiness + Activation
|--------------------------------------------------------------------------
|
| Generic PATCH cannot grant active status.
|
| Activation must pass commercial readiness checks.
|--------------------------------------------------------------------------
*/

router.get(
  '/offers/:id/readiness',

  inspectHostOfferReadinessController,
)

router.post(
  '/offers/:id/activate',

  requireCsrfToken,

  activateHostOfferController,
)

/*
|--------------------------------------------------------------------------
| Pricing
|--------------------------------------------------------------------------
*/

router.get(
  '/offers/:id/prices',

  listHostPriceRulesController,
)

router.get(
  '/offers/:id/effective-price',

  getHostEffectivePriceController,
)

router.post(
  '/offers/:id/prices',

  requireCsrfToken,

  createHostPriceRuleController,
)

/*
|--------------------------------------------------------------------------
| Inventory Nodes
|--------------------------------------------------------------------------
*/

router.get(
  '/inventory-nodes',

  listInventoryNodesController,
)

router.get(
  '/inventory-nodes/:id',

  getInventoryNodeController,
)

router.post(
  '/inventory-nodes',

  requireCsrfToken,

  createInventoryNodeController,
)

router.patch(
  '/inventory-nodes/:id',

  requireCsrfToken,

  updateInventoryNodeController,
)

/*
|--------------------------------------------------------------------------
| Inventory Snapshots
|--------------------------------------------------------------------------
*/

router.post(
  '/inventory-snapshots/bulk',

  requireCsrfToken,

  createBulkInventorySnapshotsController,
)

router.get(
  '/offers/:id/inventory',

  listHostInventoryHistoryController,
)

router.get(
  '/offers/:id/current-inventory',

  getHostCurrentInventoryController,
)

/*
|--------------------------------------------------------------------------
| Service Areas
|--------------------------------------------------------------------------
*/

router.get(
  '/service-areas',

  listServiceAreasController,
)

router.get(
  '/service-areas/:id',

  getServiceAreaController,
)

router.post(
  '/service-areas',

  requireCsrfToken,

  createServiceAreaController,
)

router.patch(
  '/service-areas/:id',

  requireCsrfToken,

  updateServiceAreaController,
)

router.get(
  '/offers/:id/serviceability',

  resolveHostOfferServiceabilityController,
)

export default router