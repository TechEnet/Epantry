import brands from '../../../seed-data/brands.js'

import {
  env,
} from '../../config/env.js'

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
| Temporary Development Preview Data
|--------------------------------------------------------------------------
|
| Brand preview data remains available for development only.
|
| Grocery intentionally does NOT use the legacy prototype products
| collection or product seed fallback anymore. The homepage Featured
| Grocery section now reads from the same current canonical catalog used by
| /grocery and requires an active Host listing.
|
| Recipes also continue to use the real published Recipes system.
|
*/

const previewBrandIds = [
  'brand_001',
  'brand_002',
  'brand_003',
]

/*
|--------------------------------------------------------------------------
| Select Preview Records
|--------------------------------------------------------------------------
*/

function selectByIds(
  items,
  ids,
) {
  const itemMap =
    new Map(
      items.map(
        (item) => [
          item.id,
          item,
        ],
      ),
    )

  return ids
    .map(
      (id) =>
        itemMap.get(id),
    )
    .filter(Boolean)
}

/*
|--------------------------------------------------------------------------
| Development Fallback
|--------------------------------------------------------------------------
|
| Kept only for the existing Featured Brands development behavior.
|
*/

function fillWithDevelopmentPreview(
  databaseItems,
  previewItems,
  limit,
) {
  const realItems =
    Array.isArray(
      databaseItems,
    )
      ? databaseItems
      : []

  if (
    env.nodeEnv ===
      'production' ||
    realItems.length >=
      limit
  ) {
    return realItems.slice(
      0,
      limit,
    )
  }

  const existingIds =
    new Set(
      realItems
        .map(
          (item) =>
            item?.id,
        )
        .filter(Boolean),
    )

  const fallbackItems =
    previewItems.filter(
      (item) =>
        !existingIds.has(
          item.id,
        ),
    )

  return [
    ...realItems,
    ...fallbackItems,
  ].slice(
    0,
    limit,
  )
}

/*
|--------------------------------------------------------------------------
| Real Public Grocery -> Existing Landing Card
|--------------------------------------------------------------------------
|
| The canonical Grocery browse projection intentionally stays compact.
| Featured Grocery now needs approved nutrition for the desktop two-phase
| hover card, so getLandingFeaturedContent enriches only the four featured
| records through the existing public Product detail service.
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
          4,
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
  const [
    publicGroceryResult,
    databaseBrands,
    publicRecipeResult,
  ] = await Promise.all([
    listPublicProducts({
      page:
        1,

      limit:
        4,

      search:
        '',

      categorySlug:
        '',

      brandSlug:
        '',

      listedOnly:
        true,
    }),

    findFeaturedBrands(),

    listPublicRecipes({
      page:
        1,

      limit:
        5,

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
  | Existing Brand Preview Selection
  |--------------------------------------------------------------------------
  */

  const previewBrands =
    selectByIds(
      brands,
      previewBrandIds,
    )

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

  /*
  |--------------------------------------------------------------------------
  | Existing Brand Behavior
  |--------------------------------------------------------------------------
  */

  const featuredBrands =
    fillWithDevelopmentPreview(
      databaseBrands,
      previewBrands,
      databaseBrands.length,
    )

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

  /*
  |--------------------------------------------------------------------------
  | Mobile Fourth Recipe Selection
  |--------------------------------------------------------------------------
  |
  | Desktop keeps the original first three featured recipes. The recipe that
  | was fourth in the public result does not currently have the intended
  | image, so the mobile-only fourth card intentionally uses the fifth public
  | recipe instead. If fewer than five published recipes exist, fall back to
  | the fourth record rather than inventing any content.
  |
  */

  const featuredRecipeItems = [
    ...publicRecipes.slice(
      0,
      3,
    ),
    publicRecipes[4] ||
      publicRecipes[3],
  ].filter(Boolean)

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
