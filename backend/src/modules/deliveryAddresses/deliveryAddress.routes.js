import {
  Router,
} from 'express'

import {
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCsrfToken,
} from '../auth/auth.middleware.js'

import {
  requireCustomerAccess,
} from '../auth/authorization.middleware.js'

import {
  createDeliveryAddressController,
  getDefaultDeliveryAddressController,
  listDeliveryAddressesController,
  setDefaultDeliveryAddressController,
  updateDeliveryAddressController,
} from './deliveryAddress.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Customer Delivery Address Boundary
|--------------------------------------------------------------------------
|
| Delivery addresses are private Customer-owned data.
|
| Host identities may use this surface only through their retained Customer
| capability. activeMode is never authorization. Super Admin receives no
| implicit Customer-address bypass.
|
*/

router.use(
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
)

router.get(
  '/',
  listDeliveryAddressesController,
)

router.get(
  '/default',
  getDefaultDeliveryAddressController,
)

router.post(
  '/',
  requireCsrfToken,
  createDeliveryAddressController,
)

router.patch(
  '/:id/default',
  requireCsrfToken,
  setDefaultDeliveryAddressController,
)

router.patch(
  '/:id',
  requireCsrfToken,
  updateDeliveryAddressController,
)

export default router
