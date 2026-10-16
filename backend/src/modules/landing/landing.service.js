import mongoose from 'mongoose'

import { ApiError } from '../../utils/ApiError.js'

import {
  getPublicProductBySlug,
  listPublicProducts,
} from '../catalog/catalog.public.service.js'

import {
  listPublicRecipes,
} from '../recipes/recipe.public.service.js'

import {
  getPublicRecipeFoodIntelligence,
} from '../foodIntelligence/foodIntelligence.public.service.js'

import {
  findFeaturedBrands,
} from './landing.repository.js'

/*
|--------------------------------------------------------------------------
| Featured content uses real public records only. No seed or preview brands
| are returned, even if the live database is empty or unavailable.
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Real Public Grocery -> Existing Landing Card
|--------------------------------------------------------------------------
|
| The canonical Grocery browse projection intentionally stays compact.
| The landing grid displays up to eight real catalog products. To preserve
| the existing featured endpoint contract, detail enrichment still resolves
| approved nutrition through the existing public Product detail service.
|
| No new Product truth is created here. Nutrition is passed through exactly
| from the current published ProductVersion / approved NPI fallback.
|
*/

function normalizePublicGroceryCard(
  product,
) {
  const quantity =
    product?.netQuantity ||
    null

  const image =
    product?.image?.url ||
    ''

  const nutrition =
    (
      product?.nutrition
        ?.nutrients ||
      []
    )
      .map(
        (
          nutrient,
        ) => {
          const amount =
            Number(
              nutrient?.amount,
            )

          if (
            !Number.isFinite(
              amount,
            )
          ) {
            return null
          }

          return {
            key:
              nutrient?.nutrientKey ||
              nutrient?.name ||
              '',

            name:
              humanizeNutritionKey(
                nutrient?.nutrientKey ||
                nutrient?.name ||
                '',
              ),

            amount,

            unit:
              nutrient?.unit ||
              '',
          }
        },
      )
      .filter(Boolean)

  return {
    id:
      product?.id ||
      product?.productVersionId ||
      product?.slug ||
      '',

    slug:
      product?.slug ||
      '',

    path:
      product?.slug
        ? `/grocery/product/${product.slug}`
        : '/grocery',

    name:
      product?.displayName ||
      product?.family?.name ||
      'Grocery Product',

    image,

    subCategory:
      product?.category?.name ||
      product?.variant?.name ||
      'Grocery',

    quantity:
      quantity?.value ??
      null,

    unit:
      quantity?.unit ||
      '',

    price:
      null,

    currency:
      'INR',

    availability:
      true,

    brand:
      product?.brand?.name ||
      '',

    packId:
      product?.packId ||
      null,

    nutritionBasis:
      product?.nutrition
        ?.basis ||
      null,

    nutrition,
  }
}

function humanizeNutritionKey(
  value,
) {
  return String(
    value || '',
  )
    .replace(
      /[_-]+/g,
      ' ',
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    )
}

/*
|--------------------------------------------------------------------------
| Featured Grocery Detail Enrichment
|--------------------------------------------------------------------------
|
| Browse and detail both resolve through the current public catalog gate.
| If one detail cannot be resolved during a transient catalog update, the
| compact browse record is retained so the entire homepage does not fail.
|
*/

async function loadFeaturedGroceryDetails(
  products,
) {
  const featured =
    Array.isArray(
      products,
    )
      ? products.slice(
          0,
          8,
        )
      : []

  return Promise.all(
    featured.map(
      async (
        product,
      ) => {
        if (
          !product?.slug
        ) {
          return product
        }

        try {
          return await getPublicProductBySlug(
            product.slug,
          )
        } catch {
          return product
        }
      },
    ),
  )
}

/*
|--------------------------------------------------------------------------
| Real Public Recipe -> Landing Card
|--------------------------------------------------------------------------
|
| Public Recipes are stored as Dish + published RecipeVersion records.
| The landing page keeps its existing card structure, so this adapter only
| converts the canonical public recipe response into the fields that the
| existing Featured Recipes UI already expects.
|
*/

function normalizePublicRecipeCard(
  item,
) {
  const dish =
    item?.dish ||
    {}

  const recipe =
    item?.recipe ||
    {}

  const slug =
    dish.slug ||
    ''

  return {
    id:
      dish.id ||
      recipe.id ||
      slug ||
      recipe.title ||
      'recipe',

    slug,

    path:
      item?.path ||
      (slug
        ? `/recipes/${slug}`
        : '/recipes'),

    name:
      dish.name ||
      recipe.title ||
      'Recipe',

    image:
      dish.heroImageUrl ||
      '',

    description:
      dish.description ||
      recipe.description ||
      '',

    cuisine:
      dish.cuisine ||
      '',

    dietaryType:
      dish.course ||
      recipe.difficulty ||
      '',

    servings:
      recipe.baseServings ??
      null,

    totalTime:
      Number(
        recipe.preparationTimeMinutes ||
          0,
      ) +
      Number(
        recipe.cookingTimeMinutes ||
          0,
      ),
  }
}


async function buildFeaturedRecipeCard(
  item,
) {
  const card =
    normalizePublicRecipeCard(
      item,
    )

  const recipeVersionId =
    item?.recipe?.id ||
    ''

  if (!recipeVersionId) {
    return {
      ...card,

      nutrition: [],
    }
  }

  try {
    const foodIntelligence =
      await getPublicRecipeFoodIntelligence(
        recipeVersionId,
      )

    return {
      ...card,

      nutrition:
        Array.isArray(
          foodIntelligence?.nutrition,
        )
          ? foodIntelligence.nutrition
          : [],
    }
  } catch {
    /*
    |--------------------------------------------------------------------
    | Fail Soft For Landing
    |--------------------------------------------------------------------
    |
    | A missing or not-yet-approved nutrition calculation must not make
    | the public homepage fail. The recipe still remains valid featured
    | content and the existing UI shows nutrition as unavailable.
    |
    */

    return {
      ...card,

      nutrition: [],
    }
  }
}

/*
|--------------------------------------------------------------------------
| Landing Featured Content
|--------------------------------------------------------------------------
*/

export async function getLandingFeaturedContent() {
  /*
  |--------------------------------------------------------------------------
  | Database Readiness
  |--------------------------------------------------------------------------
  |
  | Fail explicitly when MongoDB is unavailable, rather than pretending that
  | no approved Grocery, Brand, or Recipe records exist. The frontend already
  | handles landing featured-content request failures.
  |
  */

  if (mongoose.connection.readyState !== 1) {
    throw new ApiError(503, 'Featured content is temporarily unavailable because the database is not connected.', [
      { code: 'LANDING_DATABASE_NOT_READY' },
    ])
  }

  const [
    publicGroceryResult,
    databaseBrands,
    publicRecipeResult,
  ] = await Promise.all([
    listPublicProducts({
      page:
        1,

      limit:
        8,

      search:
        '',

      categorySlug:
        '',

      brandSlug:
        '',

      // Match the published public catalog used by the Grocery page.
      // Requiring an active Host offer can leave the landing at five
      // items even when more approved products exist in the catalog.
      listedOnly:
        false,
    }),

    findFeaturedBrands(),

    listPublicRecipes({
      page:
        1,

      // Scan ahead so image-less records do not consume the eight
      // landing gallery slots. The full Recipes page is unchanged.
      limit:
        40,

      search:
        '',

      cuisine:
        '',

      course:
        '',

      tag:
        '',
    }),
  ])

  /*
  |--------------------------------------------------------------------------
  | Real Current Grocery + Approved Nutrition
  |--------------------------------------------------------------------------
  */

  const featuredGroceryDetails =
    await loadFeaturedGroceryDetails(
      publicGroceryResult
        ?.products ||
        [],
    )

  const grocery =
    featuredGroceryDetails.map(
      normalizePublicGroceryCard,
    )

  const featuredBrands = databaseBrands

  /*
  |--------------------------------------------------------------------------
  | Real Current Recipes
  |--------------------------------------------------------------------------
  */

  const publicRecipes =
    Array.isArray(
      publicRecipeResult?.recipes,
    )
      ? publicRecipeResult.recipes
      : []

  // Select image-backed published recipes only. Remove the explicitly
  // requested image-less Test Jeera Rice item; fill from the next
  // eligible real recipe instead of inventing a placeholder.
  const featuredRecipeItems = publicRecipes
    .filter((item) => {
      const card = normalizePublicRecipeCard(item)
      return Boolean(String(card.image || '').trim()) &&
        String(card.slug || '').trim().toLowerCase() !== 'epantry-test-jeera-rice'
    })
    .slice(0, 8)

  const featuredRecipes =
    await Promise.all(
      featuredRecipeItems.map(
        buildFeaturedRecipeCard,
      ),
    )

  return {
    grocery,

    brands:
      featuredBrands,

    recipes:
      featuredRecipes,
  }
}
