const DEFAULT_BASE_URL = 'https://world.openfoodfacts.org'
const DEFAULT_TIMEOUT_MS = 8000

const FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'ingredients_text',
  'allergens',
  'allergens_tags',
  'traces_tags',
  'categories',
  'countries',
  'manufacturing_places',
  'origins',
  'image_front_url',
  'image_ingredients_url',
  'image_nutrition_url',
  'nutriments',
].join(',')

const clean = (value) =>
  String(
    value || '',
  ).trim()

const stripSlash = (value) =>
  clean(
    value,
  ).replace(
    /\/+$/,
    '',
  )

function positiveInt(
  value,
  fallback,
  max,
) {
  const parsed =
    Number(
      value,
    )

  return Number.isInteger(
    parsed,
  ) &&
    parsed > 0
    ? Math.min(
        parsed,
        max,
      )
    : fallback
}

function firstBrand(
  value,
) {
  return clean(
    value,
  )
    .split(',')
    .map(
      (
        item,
      ) =>
        item.trim(),
    )
    .filter(
      Boolean,
    )[0] || ''
}

function tags(
  values,
) {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return []
  }

  return [
    ...new Set(
      values
        .map(
          (
            value,
          ) =>
            clean(
              value,
            )
              .replace(
                /^[a-z]{2}:/i,
                '',
              )
              .replace(
                /-/g,
                ' ',
              ),
        )
        .filter(
          Boolean,
        ),
    ),
  ]
}

function numeric(
  value,
) {
  const parsed =
    Number(
      value,
    )

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null
}

function nutrition(
  nutriments,
) {
  if (
    !nutriments ||
    typeof nutriments !==
      'object'
  ) {
    return []
  }

  const map = [
    [
      'energy_kcal',
      'energy-kcal_100g',
      'kcal',
    ],
    [
      'fat',
      'fat_100g',
      'g',
    ],
    [
      'saturated_fat',
      'saturated-fat_100g',
      'g',
    ],
    [
      'carbohydrates',
      'carbohydrates_100g',
      'g',
    ],
    [
      'sugars',
      'sugars_100g',
      'g',
    ],
    [
      'fiber',
      'fiber_100g',
      'g',
    ],
    [
      'protein',
      'proteins_100g',
      'g',
    ],
    [
      'salt',
      'salt_100g',
      'g',
    ],
    [
      'sodium',
      'sodium_100g',
      'g',
    ],
  ]

  return map
    .map(
      ([
        nutrientKey,
        sourceKey,
        unit,
      ]) => ({
        nutrientKey,

        amount:
          numeric(
            nutriments[
              sourceKey
            ],
          ),

        unit,
      }),
    )
    .filter(
      (
        item,
      ) =>
        item.amount !==
        null,
    )
}

export function getOpenFoodFactsConfig() {
  return {
    enabled:
      process.env
        .OPEN_FOOD_FACTS_DISABLED !==
      'true',

    baseUrl:
      stripSlash(
        process.env
          .OPEN_FOOD_FACTS_BASE_URL ||
          DEFAULT_BASE_URL,
      ),

    timeoutMs:
      positiveInt(
        process.env
          .OPEN_FOOD_FACTS_TIMEOUT_MS,
        DEFAULT_TIMEOUT_MS,
        30000,
      ),

    userAgent:
      clean(
        process.env
          .OPEN_FOOD_FACTS_USER_AGENT,
      ) ||
      `EPANTRY/1.0 (${
        clean(
          process.env
            .FRONTEND_URL,
        ) ||
        'https://epantry.in'
      })`,
  }
}

export async function fetchOpenFoodFactsProduct(
  barcode,
) {
  const code =
    clean(
      barcode,
    )

  if (
    !/^\d{8,14}$/.test(
      code,
    )
  ) {
    return {
      found:
        false,

      reason:
        'unsupported_barcode',
    }
  }

  const config =
    getOpenFoodFactsConfig()

  if (
    !config.enabled
  ) {
    return {
      found:
        false,

      reason:
        'provider_disabled',
    }
  }

  const controller =
    new AbortController()

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      config.timeoutMs,
    )

  const url =
    `${config.baseUrl}/api/v2/product/` +
    `${encodeURIComponent(
      code,
    )}.json?fields=${encodeURIComponent(
      FIELDS,
    )}`

  try {
    const response =
      await fetch(
        url,
        {
          method:
            'GET',

          headers: {
            Accept:
              'application/json',

            'User-Agent':
              config.userAgent,
          },

          signal:
            controller.signal,
        },
      )

    if (
      !response.ok
    ) {
      const error =
        new Error(
          `Open Food Facts request failed with status ${response.status}.`,
        )

      error.code =
        'OPEN_FOOD_FACTS_REQUEST_FAILED'

      error.status =
        response.status

      throw error
    }

    const payload =
      await response.json()

    if (
      Number(
        payload?.status,
      ) !== 1 ||
      !payload?.product
    ) {
      return {
        found:
          false,

        reason:
          'not_found',
      }
    }

    const product =
      payload.product

    return {
      found:
        true,

      source: {
        provider:
          'open_food_facts',

        sourceName:
          'Open Food Facts',

        sourceUri:
          `${config.baseUrl}/product/${encodeURIComponent(
            code,
          )}`,

        externalReference:
          code,

        capturedAt:
          new Date(),
      },

      candidate: {
        barcode:
          clean(
            product.code,
          ) ||
          code,

        title:
          clean(
            product.product_name,
          ),

        genericName:
          clean(
            product.generic_name,
          ),

        brandName:
          firstBrand(
            product.brands,
          ),

        netQuantityText:
          clean(
            product.quantity,
          ),

        ingredientDeclarationText:
          clean(
            product.ingredients_text,
          ),

        allergenText:
          clean(
            product.allergens,
          ),

        allergenTags:
          tags(
            product.allergens_tags,
          ),

        traceTags:
          tags(
            product.traces_tags,
          ),

        categoryText:
          clean(
            product.categories,
          ),

        countryText:
          clean(
            product.countries,
          ),

        manufacturingPlaces:
          clean(
            product.manufacturing_places,
          ),

        originText:
          clean(
            product.origins,
          ),

        nutritionBasis:
          'per_100g',

        nutrition:
          nutrition(
            product.nutriments,
          ),

        referenceImages: {
          front:
            clean(
              product.image_front_url,
            ),

          ingredients:
            clean(
              product.image_ingredients_url,
            ),

          nutrition:
            clean(
              product.image_nutrition_url,
            ),
        },
      },

      confidence:
        0.65,

      verificationStatus:
        'unverified',
    }
  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      const timeoutError =
        new Error(
          'Open Food Facts request timed out.',
        )

      timeoutError.code =
        'OPEN_FOOD_FACTS_TIMEOUT'

      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(
      timeout,
    )
  }
}