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
  getPublicRecipeController,
  generateAiCookController,
  getPublicRecipeHistoryController,
  getWhatShouldWeCookController,
  listPublicRecipesController,
  scalePublicRecipeController,
} from './recipe.public.controller.js'

const router =
  Router()

router.get(
  '/',

  listPublicRecipesController,
)

router.get(
  '/what-should-we-cook',

  getWhatShouldWeCookController,
)

router.post(
  '/ai-cook',
  sensitiveResponseNoStoreMiddleware,
  authenticateSession,
  loadCurrentUser,
  requireActiveAccount,
  requireCustomerAccess,
  requireCsrfToken,
  generateAiCookController,
)

router.get(
  '/:slug/history',

  getPublicRecipeHistoryController,
)

router.get(
  '/:slug/scale',

  scalePublicRecipeController,
)

router.get(
  '/:slug',

  getPublicRecipeController,
)

export default router