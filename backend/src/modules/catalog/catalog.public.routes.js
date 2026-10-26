import {
  Router,
} from 'express'

import {
  getPublicProductController,
  listPublicBrandProductsController,
  listPublicBrandsController,
  listPublicCategoriesController,
  listPublicCategoryProductsController,
  listPublicProductsController,
} from './catalog.public.controller.js'

import { getIngredientKnowledgeController } from './ingredient.knowledge.controller.js'

const router =
  Router()

/*
|--------------------------------------------------------------------------
| Public Grocery Browse
|--------------------------------------------------------------------------
|
| No authentication is required.
|
| Service layer guarantees only current published canonical truth is exposed.
|
*/

router.get(
  '/products',

  listPublicProductsController,
)

router.get(
  '/products/:slug',

  getPublicProductController,
)

/*
|--------------------------------------------------------------------------
| Public Categories
|--------------------------------------------------------------------------
*/

router.get(
  '/ingredients/knowledge/:ref',
  getIngredientKnowledgeController,
)

router.get(
  '/categories',

  listPublicCategoriesController,
)

router.get(
  '/categories/:slug/products',

  listPublicCategoryProductsController,
)

/*
|--------------------------------------------------------------------------
| Public Brands
|--------------------------------------------------------------------------
*/

router.get(
  '/brands',

  listPublicBrandsController,
)

router.get(
  '/brands/:slug/products',

  listPublicBrandProductsController,
)

export default router