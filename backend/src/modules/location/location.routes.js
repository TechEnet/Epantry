import {
  Router,
} from 'express'

import {
  reverseGeocodeController,
} from './location.controller.js'

const router =
  Router()

router.post(
  '/reverse-geocode',
  reverseGeocodeController,
)

export default router