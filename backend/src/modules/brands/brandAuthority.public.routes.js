import {
  Router,
} from 'express'

import {
  getPublicBrandProductHistoryController,
  getPublicBrandWorldController,
  listPublicBrandsController,
} from './brandAuthority.public.controller.js'

const router =
  Router()

router.get(
  '/',

  listPublicBrandsController,
)

router.get(
  '/:brandKey/products/:packId/history',

  getPublicBrandProductHistoryController,
)

router.get(
  '/:brandKey',

  getPublicBrandWorldController,
)

export default router