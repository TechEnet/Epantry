import {
  Router,
} from 'express'

import {
  getPublicProductFoodIntelligenceController,
  getPublicRecipeFoodIntelligenceController,
} from './foodIntelligence.public.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Product Food Intelligence
|--------------------------------------------------------------------------
|
| GET /api/v1/products/:id/food-intelligence
|
*/

router.get(
  '/products/:id/food-intelligence',

  getPublicProductFoodIntelligenceController,
)

/*
|--------------------------------------------------------------------------
| Recipe Food Intelligence
|--------------------------------------------------------------------------
|
| GET /api/v1/recipes/:id/food-intelligence
|
*/

router.get(
  '/recipes/:id/food-intelligence',

  getPublicRecipeFoodIntelligenceController,
)

export default router