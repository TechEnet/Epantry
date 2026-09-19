import {
  Router,
} from 'express'

import {
  listPublicEligibleOffersController,
} from './marketplace.public.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Public Marketplace Offers
|--------------------------------------------------------------------------
|
| No authentication required.
|
| Only eligible commercial projections are exposed.
|
| Canonical Product truth remains owned by /api/v1/catalog.
|--------------------------------------------------------------------------
*/

router.get(
  '/packs/:packId/offers',

  listPublicEligibleOffersController,
)

export default router