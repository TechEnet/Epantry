import {
  Router,
} from 'express'

import advancedExpansionRoutes from '../advancedExpansion/advancedExpansion.routes.js'

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
  createPantryObservationController,
  createPantrySetupReminderController,
  getPantryItemHistoryController,
  getPantryPreferencesController,
  listPantryController,
  updatePantryItemController,
  updatePantryPreferencesController,
} from './pantry.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Customer Pantry Boundary
|--------------------------------------------------------------------------
|
| Host users retain Customer capability and may use their household Pantry.
|
| activeMode is not consulted.
|
| Super Admin receives no implicit Customer/Household tenant bypass.
|
*/

router.use(
  authenticateSession,

  loadCurrentUser,

  requireActiveAccount,

  requireCustomerAccess,
)

/*
|--------------------------------------------------------------------------
| M21 Advanced Expansion - Batch 1
|--------------------------------------------------------------------------
|
| Receipt / purchase intelligence, household memory, predictive signals and
| explicit leftover planning compose M09 + M13 + M14 truth.
|
| This router remains inside the same Customer/Household authority boundary.
|
*/

router.use(
  '/intelligence',

  advancedExpansionRoutes,
)

/*
|--------------------------------------------------------------------------
| Pantry
|--------------------------------------------------------------------------
*/

router.get(
  '/',

  listPantryController,
)

/*
|--------------------------------------------------------------------------
| Observations
|--------------------------------------------------------------------------
*/

router.post(
  '/observations',

  requireCsrfToken,

  createPantryObservationController,
)

/*
|--------------------------------------------------------------------------
| Preferences
|--------------------------------------------------------------------------
*/

router.get(
  '/preferences',

  getPantryPreferencesController,
)

router.patch(
  '/preferences',

  requireCsrfToken,

  updatePantryPreferencesController,
)

/*
|--------------------------------------------------------------------------
| Item History
|--------------------------------------------------------------------------
*/

router.get(
  '/items/:id/history',

  getPantryItemHistoryController,
)

/*
|--------------------------------------------------------------------------
| Pantry Setup Reminder
|--------------------------------------------------------------------------
*/

router.post(
  '/items/:id/setup-reminder',

  requireCsrfToken,

  createPantrySetupReminderController,
)

/*
|--------------------------------------------------------------------------
| Item Correction
|--------------------------------------------------------------------------
|
| This does not directly mutate arbitrary PantryItem fields.
|
| The controller converts the request into an append-only PantryObservation.
|
*/

router.patch(
  '/items/:id',

  requireCsrfToken,

  updatePantryItemController,
)

export default router