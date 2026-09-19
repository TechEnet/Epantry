import mongoose from 'mongoose'

import {
  CanonicalIngredient,
} from '../catalog/catalog.models.js'

import {
  normalizeRecipeKey,
  normalizeRecipeSlug,
} from './recipe.constants.js'

import {
  Dish,
} from './recipe.models.js'

import {
  createAdminRecipe,
} from './recipe.admin.service.js'

export const M07_RECIPE_SEED_VERSION =
  'm07'

function freezeBlueprint(
  blueprint,
) {
  return Object.freeze({
    ...blueprint,

    ingredients:
      Object.freeze(
        blueprint.ingredients.map(
          (
            ingredient,
          ) =>
            Object.freeze({
              ...ingredient,
            }),
        ),
      ),

    steps:
      Object.freeze([
        ...blueprint.steps,
      ]),
  })
}

function ingredient(
  name,
  quantity,
  unit,
  role =
    'main',
) {
  return {
    name,

    quantity,

    unit,

    role,
  }
}

export const M07_RECIPE_SEED_BLUEPRINTS =
  Object.freeze([
    freezeBlueprint({
      name:
        'Masala Chai',

      cuisine:
        'Indian',

      course:
        'Beverage',

      ingredients: [
        ingredient(
          'Milk',
          250,
          'ml',
          'liquid',
        ),

        ingredient(
          'Tea',
          5,
          'g',
          'main',
        ),

        ingredient(
          'Sugar',
          10,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Simmer the ingredients together and strain before serving.',
      ],
    }),

    freezeBlueprint({
      name:
        'Jeera Rice',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),

        ingredient(
          'Cumin',
          5,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Cook rice and finish with tempered cumin.',
      ],
    }),

    freezeBlueprint({
      name:
        'Plain Rice',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),
      ],

      steps: [
        'Cook rice until tender.',
      ],
    }),

    freezeBlueprint({
      name:
        'Lemon Rice',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),

        ingredient(
          'Lemon',
          1,
          'piece',
          'seasoning',
        ),
      ],

      steps: [
        'Combine cooked rice with fresh lemon seasoning.',
      ],
    }),

    freezeBlueprint({
      name:
        'Tomato Rice',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),

        ingredient(
          'Tomato',
          2,
          'piece',
        ),
      ],

      steps: [
        'Cook tomato masala and combine with rice.',
      ],
    }),

    freezeBlueprint({
      name:
        'Vegetable Pulao',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),

        ingredient(
          'Carrot',
          1,
          'piece',
        ),

        ingredient(
          'Peas',
          100,
          'g',
        ),
      ],

      steps: [
        'Cook rice and vegetables together until tender.',
      ],
    }),

    freezeBlueprint({
      name:
        'Khichdi',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          150,
          'g',
        ),

        ingredient(
          'Moong Dal',
          100,
          'g',
        ),
      ],

      steps: [
        'Cook rice and dal together until soft.',
      ],
    }),

    freezeBlueprint({
      name:
        'Moong Dal',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Moong Dal',
          200,
          'g',
        ),

        ingredient(
          'Turmeric',
          2,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Cook dal until soft and season before serving.',
      ],
    }),

    freezeBlueprint({
      name:
        'Dal Tadka',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Toor Dal',
          200,
          'g',
        ),

        ingredient(
          'Cumin',
          5,
          'g',
          'seasoning',
        ),

        ingredient(
          'Garlic',
          2,
          'clove',
          'seasoning',
        ),
      ],

      steps: [
        'Cook dal and finish with cumin and garlic tempering.',
      ],
    }),

    freezeBlueprint({
      name:
        'Aloo Jeera',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Potato',
          4,
          'piece',
        ),

        ingredient(
          'Cumin',
          5,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Cook potatoes with cumin until tender.',
      ],
    }),

    freezeBlueprint({
      name:
        'Aloo Matar',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Potato',
          3,
          'piece',
        ),

        ingredient(
          'Peas',
          150,
          'g',
        ),

        ingredient(
          'Tomato',
          2,
          'piece',
        ),
      ],

      steps: [
        'Cook potato and peas in tomato masala.',
      ],
    }),

    freezeBlueprint({
      name:
        'Paneer Bhurji',

      cuisine:
        'Indian',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Paneer',
          250,
          'g',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),
      ],

      steps: [
        'Cook onion and tomato, then fold in crumbled paneer.',
      ],
    }),

    freezeBlueprint({
      name:
        'Paneer Tikka',

      cuisine:
        'Indian',

      course:
        'Starter',

      ingredients: [
        ingredient(
          'Paneer',
          400,
          'g',
        ),

        ingredient(
          'Yogurt',
          100,
          'g',
          'sauce',
        ),
      ],

      steps: [
        'Marinate paneer and cook until lightly charred.',
      ],
    }),

    freezeBlueprint({
      name:
        'Poha',

      cuisine:
        'Indian',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Poha',
          200,
          'g',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Peanut',
          30,
          'g',
          'garnish',
        ),
      ],

      steps: [
        'Cook softened poha with onion and peanuts.',
      ],
    }),

    freezeBlueprint({
      name:
        'Upma',

      cuisine:
        'Indian',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Semolina',
          200,
          'g',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),
      ],

      steps: [
        'Cook roasted semolina with seasoned liquid until soft.',
      ],
    }),

    freezeBlueprint({
      name:
        'Besan Chilla',

      cuisine:
        'Indian',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Besan',
          200,
          'g',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),
      ],

      steps: [
        'Prepare batter and cook thin chilla on a hot pan.',
      ],
    }),

    freezeBlueprint({
      name:
        'Suji Halwa',

      cuisine:
        'Indian',

      course:
        'Dessert',

      ingredients: [
        ingredient(
          'Semolina',
          150,
          'g',
        ),

        ingredient(
          'Sugar',
          100,
          'g',
          'seasoning',
        ),

        ingredient(
          'Ghee',
          60,
          'g',
          'fat',
        ),
      ],

      steps: [
        'Roast semolina in ghee and cook with sweetened liquid.',
      ],
    }),

    freezeBlueprint({
      name:
        'Rice Kheer',

      cuisine:
        'Indian',

      course:
        'Dessert',

      ingredients: [
        ingredient(
          'Rice',
          80,
          'g',
        ),

        ingredient(
          'Milk',
          1000,
          'ml',
          'liquid',
        ),

        ingredient(
          'Sugar',
          100,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Slow-cook rice in milk and sweeten before serving.',
      ],
    }),

    freezeBlueprint({
      name:
        'Fruit Yogurt Bowl',

      cuisine:
        'International',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Yogurt',
          250,
          'g',
        ),

        ingredient(
          'Banana',
          1,
          'piece',
        ),
      ],

      steps: [
        'Combine yogurt and sliced fruit.',
      ],
    }),

    freezeBlueprint({
      name:
        'Cucumber Raita',

      cuisine:
        'Indian',

      course:
        'Side',

      ingredients: [
        ingredient(
          'Yogurt',
          250,
          'g',
        ),

        ingredient(
          'Cucumber',
          1,
          'piece',
        ),
      ],

      steps: [
        'Mix grated cucumber into yogurt and season.',
      ],
    }),

    freezeBlueprint({
      name:
        'Egg Bhurji',

      cuisine:
        'Indian',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Egg',
          4,
          'piece',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),
      ],

      steps: [
        'Cook onion and tomato, then scramble in the eggs.',
      ],
    }),

    freezeBlueprint({
      name:
        'Masala Omelette',

      cuisine:
        'Indian',

      course:
        'Breakfast',

      ingredients: [
        ingredient(
          'Egg',
          3,
          'piece',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),
      ],

      steps: [
        'Whisk ingredients and cook as an omelette.',
      ],
    }),

    freezeBlueprint({
      name:
        'Boiled Egg Chaat',

      cuisine:
        'Indian',

      course:
        'Snack',

      ingredients: [
        ingredient(
          'Egg',
          4,
          'piece',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Lemon',
          1,
          'piece',
          'seasoning',
        ),
      ],

      steps: [
        'Combine chopped boiled eggs with onion and lemon.',
      ],
    }),

    freezeBlueprint({
      name:
        'Tomato Sandwich',

      cuisine:
        'International',

      course:
        'Snack',

      ingredients: [
        ingredient(
          'Bread',
          4,
          'slice',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),
      ],

      steps: [
        'Layer sliced tomato between bread and serve.',
      ],
    }),

    freezeBlueprint({
      name:
        'Paneer Sandwich',

      cuisine:
        'International',

      course:
        'Snack',

      ingredients: [
        ingredient(
          'Bread',
          4,
          'slice',
        ),

        ingredient(
          'Paneer',
          150,
          'g',
        ),
      ],

      steps: [
        'Fill bread with seasoned paneer and toast.',
      ],
    }),

    freezeBlueprint({
      name:
        'Peanut Chaat',

      cuisine:
        'Indian',

      course:
        'Snack',

      ingredients: [
        ingredient(
          'Peanut',
          150,
          'g',
        ),

        ingredient(
          'Onion',
          1,
          'piece',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),

        ingredient(
          'Lemon',
          1,
          'piece',
          'seasoning',
        ),
      ],

      steps: [
        'Combine peanuts with chopped vegetables and lemon.',
      ],
    }),

    freezeBlueprint({
      name:
        'Sprout Salad',

      cuisine:
        'Indian',

      course:
        'Snack',

      ingredients: [
        ingredient(
          'Sprouts',
          200,
          'g',
        ),

        ingredient(
          'Tomato',
          1,
          'piece',
        ),

        ingredient(
          'Cucumber',
          1,
          'piece',
        ),
      ],

      steps: [
        'Combine sprouts and chopped vegetables before serving.',
      ],
    }),

    freezeBlueprint({
      name:
        'Garlic Butter Rice',

      cuisine:
        'International',

      course:
        'Main',

      ingredients: [
        ingredient(
          'Rice',
          200,
          'g',
        ),

        ingredient(
          'Garlic',
          3,
          'clove',
          'seasoning',
        ),

        ingredient(
          'Butter',
          30,
          'g',
          'fat',
        ),
      ],

      steps: [
        'Cook rice and finish with garlic butter.',
      ],
    }),

    freezeBlueprint({
      name:
        'Banana Milk',

      cuisine:
        'International',

      course:
        'Beverage',

      ingredients: [
        ingredient(
          'Banana',
          1,
          'piece',
        ),

        ingredient(
          'Milk',
          250,
          'ml',
          'liquid',
        ),
      ],

      steps: [
        'Blend banana and milk until smooth.',
      ],
    }),

    freezeBlueprint({
      name:
        'Lemon Water',

      cuisine:
        'International',

      course:
        'Beverage',

      ingredients: [
        ingredient(
          'Lemon',
          1,
          'piece',
        ),

        ingredient(
          'Sugar',
          15,
          'g',
          'seasoning',
        ),
      ],

      steps: [
        'Combine lemon and sugar with drinking water.',
      ],
    }),
  ])

function buildCanonicalIngredientIndex(
  canonicalIngredients,
) {
  const index =
    new Map()

  for (
    const canonicalIngredient of
    canonicalIngredients
  ) {
    const keys = [
      canonicalIngredient.name,

      canonicalIngredient.displayName,

      canonicalIngredient.canonicalName,

      ...(
        canonicalIngredient.aliases ||
        []
      ),
    ]
      .map(
        normalizeRecipeKey,
      )
      .filter(
        Boolean,
      )

    for (
      const key of keys
    ) {
      if (
        !index.has(
          key,
        )
      ) {
        index.set(
          key,
          canonicalIngredient,
        )
      }
    }
  }

  return index
}

function buildSeedInput(
  blueprint,
  canonicalIngredientIndex,
) {
  const resolvedIngredients =
    blueprint.ingredients.map(
      (
        recipeIngredient,
        index,
      ) => {
        const canonicalIngredient =
          canonicalIngredientIndex.get(
            normalizeRecipeKey(
              recipeIngredient.name,
            ),
          )

        if (
          !canonicalIngredient
        ) {
          return null
        }

        return {
          lineNumber:
            index +
            1,

          canonicalIngredientId:
            String(
              canonicalIngredient._id,
            ),

          quantity:
            recipeIngredient.quantity,

          unit:
            recipeIngredient.unit,

          role:
            recipeIngredient.role,

          preparationState:
            '',

          optional:
            false,

          notes:
            '',

          substitutionGroupKey:
            '',

          productConstraints:
            [],

          scalingRule: {
            type:
              'linear',

            exponent:
              1,

            minMultiplier:
              null,

            maxMultiplier:
              null,
          },
        }
      },
    )

  const missingIngredients =
    blueprint.ingredients
      .filter(
        (
          _,
          index,
        ) =>
          !resolvedIngredients[
            index
          ],
      )
      .map(
        (
          item,
        ) =>
          item.name,
      )

  if (
    missingIngredients.length >
    0
  ) {
    return {
      input:
        null,

      missingIngredients,
    }
  }

  return {
    input: {
      name:
        blueprint.name,

      slug:
        normalizeRecipeSlug(
          blueprint.name,
        ),

      description:
        `${blueprint.name} development Recipe draft.`,

      cuisine:
        blueprint.cuisine,

      course:
        blueprint.course,

      tags: [
        normalizeRecipeKey(
          blueprint.cuisine,
        ),

        normalizeRecipeKey(
          blueprint.course,
        ),
      ].filter(
        Boolean,
      ),

      language:
        'en',

      heroImageUrl:
        '',

      title:
        blueprint.name,

      recipeDescription:
        `${blueprint.name} curated Recipe draft.`,

      baseServings:
        4,

      servingSizeAmount:
        null,

      servingSizeUnit:
        null,

      finishedYieldAmount:
        null,

      finishedYieldUnit:
        null,

      scalingMethod:
        'linear',

      minRecommendedServings:
        1,

      maxRecommendedServings:
        12,

      preparationTimeMinutes:
        10,

      cookingTimeMinutes:
        20,

      difficulty:
        'easy',

      source: {
        type:
          'internal',

        name:
          'EPANTRY Development Seed',

        url:
          '',

        brandId:
          null,

        organizationId:
          null,
      },

      unsafeIncomplete:
        false,

      unsafeIncompleteReason:
        '',

      ingredients:
        resolvedIngredients,

      steps:
        blueprint.steps.map(
          (
            instruction,
            index,
          ) => ({
            stepNumber:
              index +
              1,

            instruction,

            timerSeconds:
              null,

            temperatureValue:
              null,

            temperatureUnit:
              null,

            equipment:
              [],

            parallelizable:
              false,

            prepAhead:
              false,
          }),
        ),

      substitutions:
        [],
    },

    missingIngredients:
      [],
  }
}

/*
|--------------------------------------------------------------------------
| Development Seed
|--------------------------------------------------------------------------
|
| Important:
|
| This creates DRAFT Recipe Versions only.
|
| It deliberately does NOT bypass M07 review, QA, maker-checker or publication
| governance.
|--------------------------------------------------------------------------
*/

export async function seedM07RecipeDrafts({
  actorUserId,
}) {
  if (
    !mongoose.Types.ObjectId.isValid(
      actorUserId,
    )
  ) {
    throw new Error(
      'M07 Recipe seed requires a valid administrative actorUserId.',
    )
  }

  const canonicalIngredients =
    await CanonicalIngredient.find({
      status: {
        $ne:
          'retired',
      },
    }).lean()

  const canonicalIngredientIndex =
    buildCanonicalIngredientIndex(
      canonicalIngredients,
    )

  const result = {
    seedVersion:
      M07_RECIPE_SEED_VERSION,

    blueprintCount:
      M07_RECIPE_SEED_BLUEPRINTS.length,

    created:
      [],

    skipped:
      [],
  }

  for (
    const blueprint of
    M07_RECIPE_SEED_BLUEPRINTS
  ) {
    const slug =
      normalizeRecipeSlug(
        blueprint.name,
      )

    const existing =
      await Dish.exists({
        slug,
      })

    if (existing) {
      result.skipped.push({
        name:
          blueprint.name,

        reason:
          'already_exists',
      })

      continue
    }

    const {
      input,
      missingIngredients,
    } =
      buildSeedInput(
        blueprint,
        canonicalIngredientIndex,
      )

    if (!input) {
      result.skipped.push({
        name:
          blueprint.name,

        reason:
          'canonical_ingredients_missing',

        missingIngredients,
      })

      continue
    }

    const created =
      await createAdminRecipe(
        input,
        {
          _id:
            actorUserId,
        },
      )

    result.created.push({
      dishId:
        created.dish.id,

      recipeVersionId:
        created.recipeVersion.id,

      slug:
        created.dish.slug,
    })
  }

  return result
}