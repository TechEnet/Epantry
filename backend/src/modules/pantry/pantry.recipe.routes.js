import {
  Router,
} from 'express'

import {
  sensitiveResponseNoStoreMiddleware,
} from '../../middlewares/security.middleware.js'

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
  getRecipePantryReconciliationController,
  recordRecipeCookedController,
} from './pantry.recipe.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Recipe Pantry Read Boundary
|--------------------------------------------------------------------------
|
| Only this exact Household-specific Recipe subtree is authenticated.
|
| Existing public M07 Recipe routes remain unaffected.
|
*/

router.use(
  '/:id/pantry',

  sensitiveResponseNoStoreMiddleware,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

/*
|--------------------------------------------------------------------------
| Recipe Cooked Boundary
|--------------------------------------------------------------------------
*/

router.use(
  '/:id/cooked',

  sensitiveResponseNoStoreMiddleware,

  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

/*
|--------------------------------------------------------------------------
| Current Recipe vs Household Pantry
|--------------------------------------------------------------------------
*/

router.get(
  '/:id/pantry',

  getRecipePantryReconciliationController,
)

/*
|--------------------------------------------------------------------------
| Cooked
|--------------------------------------------------------------------------
|
| Mutation remains CSRF protected.
|
| Idempotency-Key validation lives in the controller.
|
*/

router.post(
  '/:id/cooked',

  requireCsrfToken,

  recordRecipeCookedController,
)

export default router