import mongoose from 'mongoose'

import {
  DISH_STATUSES,
  RECIPE_DIFFICULTIES,
  RECIPE_INGREDIENT_ROLES,
  RECIPE_INGREDIENT_SCALING_RULE_TYPES,
  RECIPE_REVIEW_DECISIONS,
  RECIPE_REVIEW_TYPES,
  RECIPE_SCALING_METHODS,
  RECIPE_SOURCE_TYPES,
  RECIPE_UNITS,
  RECIPE_VERSION_STATUSES,
} from './recipe.constants.js'

const {
  Schema,
} =
  mongoose

/*
|--------------------------------------------------------------------------
| Dish
|--------------------------------------------------------------------------
|
| Dish is customer-facing identity.
|
| RecipeVersion is executable/versioned formulation.
|--------------------------------------------------------------------------
*/

const dishSchema =
  new Schema(
    {
      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          180,
      },

      slug: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,

        maxlength:
          220,
      },

      description: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          4000,
      },

      cuisine: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          120,
      },

      course: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          120,
      },

      tags: {
        type: [
          String,
        ],

        default:
          [],
      },

      language: {
        type:
          String,

        trim:
          true,

        lowercase:
          true,

        default:
          'en',

        maxlength:
          16,
      },

      heroImageUrl: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          2048,
      },

      status: {
        type:
          String,

        enum:
          DISH_STATUSES,

        default:
          'active',

        index:
          true,
      },

      nextRecipeVersionNumber: {
        type:
          Number,

        required:
          true,

        min:
          1,

        default:
          1,
      },

      createdByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

      disabledAt: {
        type:
          Date,

        default:
          null,
      },

      disabledByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      disabledReason: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },

      retiredAt: {
        type:
          Date,

        default:
          null,
      },

      retiredByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      retiredReason: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },
    },
    {
      timestamps:
        true,

      collection:
        'dishes',
    },
  )

dishSchema.index(
  {
    slug:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Version
|--------------------------------------------------------------------------
*/

const recipeVersionSchema =
  new Schema(
    {
      dishId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Dish',

        required:
          true,

        index:
          true,
      },

      versionNumber: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      title: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          180,
      },

      description: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          4000,
      },

      baseServings: {
        type:
          Number,

        required:
          true,

        min:
          1,

        max:
          1000,
      },

      servingSizeAmount: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      servingSizeUnit: {
        type:
          String,

        enum:
          RECIPE_UNITS,

        default:
          null,
      },

      finishedYieldAmount: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      finishedYieldUnit: {
        type:
          String,

        enum:
          RECIPE_UNITS,

        default:
          null,
      },

      scalingMethod: {
        type:
          String,

        enum:
          RECIPE_SCALING_METHODS,

        default:
          'linear',
      },

      minRecommendedServings: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      maxRecommendedServings: {
        type:
          Number,

        min:
          1,

        default:
          null,
      },

      preparationTimeMinutes: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      cookingTimeMinutes: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      difficulty: {
        type:
          String,

        enum:
          RECIPE_DIFFICULTIES,

        default:
          'easy',
      },

      sourceType: {
        type:
          String,

        enum:
          RECIPE_SOURCE_TYPES,

        default:
          'internal',
      },

      sourceName: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          180,
      },

      sourceUrl: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          2048,
      },

      sourceBrandId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'Brand',

        default:
          null,

        index:
          true,
      },

      sourceOrganizationId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'MarketplaceOrganization',

        default:
          null,

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          RECIPE_VERSION_STATUSES,

        default:
          'draft',

        index:
          true,
      },

      changeReason: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },

      unsafeIncomplete: {
        type:
          Boolean,

        default:
          false,

        index:
          true,
      },

      unsafeIncompleteReason: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },

      effectiveFrom: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      effectiveTo: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      createdByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,
      },

      submittedAt: {
        type:
          Date,

        default:
          null,
      },

      submittedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },

      reviewedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      publishedAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      publishedByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      retiredAt: {
        type:
          Date,

        default:
          null,
      },

      retiredByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },

      disabledAt: {
        type:
          Date,

        default:
          null,
      },

      disabledByUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      collection:
        'recipeVersions',
    },
  )

recipeVersionSchema.index(
  {
    dishId:
      1,

    versionNumber:
      1,
  },
  {
    unique:
      true,
  },
)

recipeVersionSchema.index({
  dishId:
    1,

  status:
    1,

  effectiveFrom:
    -1,
})

recipeVersionSchema.pre(
  'validate',
  function recipeVersionDateValidation() {
    if (
      this.minRecommendedServings &&
      this.maxRecommendedServings &&
      this.minRecommendedServings >
        this.maxRecommendedServings
    ) {
      this.invalidate(
        'maxRecommendedServings',
        'Maximum recommended servings cannot be below minimum recommended servings.',
      )
    }

    if (
      this.effectiveFrom &&
      this.effectiveTo &&
      this.effectiveFrom >=
        this.effectiveTo
    ) {
      this.invalidate(
        'effectiveTo',
        'Recipe effectiveTo must be after effectiveFrom.',
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Ingredient
|--------------------------------------------------------------------------
*/

const recipeIngredientSchema =
  new Schema(
    {
      recipeVersionId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeVersion',

        required:
          true,

        index:
          true,
      },

      lineNumber: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      canonicalIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'CanonicalIngredient',

        required:
          true,

        index:
          true,
      },

      quantity: {
        type:
          Number,

        required:
          true,

        min:
          0.000001,
      },

      unit: {
        type:
          String,

        enum:
          RECIPE_UNITS,

        required:
          true,
      },

      preparationState: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          240,
      },

      optional: {
        type:
          Boolean,

        default:
          false,
      },

      role: {
        type:
          String,

        enum:
          RECIPE_INGREDIENT_ROLES,

        default:
          'main',
      },

      notes: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },

      substitutionGroupKey: {
        type:
          String,

        trim:
          true,

        lowercase:
          true,

        default:
          '',

        maxlength:
          120,
      },

      productConstraints: {
        type: [
          String,
        ],

        default:
          [],
      },

      scalingRule: {
        type: {
          type:
            String,

          enum:
            RECIPE_INGREDIENT_SCALING_RULE_TYPES,

          default:
            'linear',
        },

        exponent: {
          type:
            Number,

          min:
            0,

          max:
            5,

          default:
            1,
        },

        minMultiplier: {
          type:
            Number,

          min:
            0,

          default:
            null,
        },

        maxMultiplier: {
          type:
            Number,

          min:
            0,

          default:
            null,
        },
      },
    },
    {
      timestamps:
        true,

      collection:
        'recipeIngredients',
    },
  )

recipeIngredientSchema.index(
  {
    recipeVersionId:
      1,

    lineNumber:
      1,
  },
  {
    unique:
      true,
  },
)

recipeIngredientSchema.pre(
  'validate',
  function recipeIngredientScalingValidation() {
    const {
      minMultiplier,
      maxMultiplier,
    } =
      this.scalingRule ||
      {}

    if (
      minMultiplier !==
        null &&
      maxMultiplier !==
        null &&
      minMultiplier >
        maxMultiplier
    ) {
      this.invalidate(
        'scalingRule.maxMultiplier',
        'Maximum scaling multiplier cannot be below minimum scaling multiplier.',
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Step
|--------------------------------------------------------------------------
*/

const recipeStepSchema =
  new Schema(
    {
      recipeVersionId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeVersion',

        required:
          true,

        index:
          true,
      },

      stepNumber: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      instruction: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          4000,
      },

      timerSeconds: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      temperatureValue: {
        type:
          Number,

        default:
          null,
      },

      temperatureUnit: {
        type:
          String,

        enum: [
          'c',
          'f',
        ],

        default:
          null,
      },

      equipment: {
        type: [
          String,
        ],

        default:
          [],
      },

      parallelizable: {
        type:
          Boolean,

        default:
          false,
      },

      prepAhead: {
        type:
          Boolean,

        default:
          false,
      },
    },
    {
      timestamps:
        true,

      collection:
        'recipeSteps',
    },
  )

recipeStepSchema.index(
  {
    recipeVersionId:
      1,

    stepNumber:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Substitution
|--------------------------------------------------------------------------
*/

const recipeSubstitutionSchema =
  new Schema(
    {
      recipeVersionId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeVersion',

        required:
          true,

        index:
          true,
      },

      sourceRecipeIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeIngredient',

        required:
          true,

        index:
          true,
      },

      substituteCanonicalIngredientId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'CanonicalIngredient',

        required:
          true,

        index:
          true,
      },

      replacementRatio: {
        type:
          Number,

        required:
          true,

        min:
          0.000001,

        default:
          1,
      },

      replacementUnit: {
        type:
          String,

        enum:
          RECIPE_UNITS,

        default:
          null,
      },

      priority: {
        type:
          Number,

        min:
          1,

        default:
          1,
      },

      notes: {
        type:
          String,

        trim:
          true,

        default:
          '',

        maxlength:
          1000,
      },
    },
    {
      timestamps:
        true,

      collection:
        'recipeSubstitutions',
    },
  )

recipeSubstitutionSchema.index(
  {
    recipeVersionId:
      1,

    sourceRecipeIngredientId:
      1,

    substituteCanonicalIngredientId:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Review
|--------------------------------------------------------------------------
|
| Review records are append-only governance history.
|--------------------------------------------------------------------------
*/

const recipeReviewSchema =
  new Schema(
    {
      recipeVersionId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'RecipeVersion',

        required:
          true,

        index:
          true,
      },

      reviewType: {
        type:
          String,

        enum:
          RECIPE_REVIEW_TYPES,

        required:
          true,
      },

      decision: {
        type:
          String,

        enum:
          RECIPE_REVIEW_DECISIONS,

        required:
          true,
      },

      reason: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          2000,
      },

      reviewerUserId: {
        type:
          Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        'recipeReviews',
    },
  )

recipeReviewSchema.index({
  recipeVersionId:
    1,

  createdAt:
    -1,
})

recipeReviewSchema.pre(
  'save',
  function preventRecipeReviewMutation() {
    if (
      !this.isNew
    ) {
      throw new Error(
        'RecipeReview records are immutable.',
      )
    }
  },
)

export const Dish =
  mongoose.models.Dish ||
  mongoose.model(
    'Dish',
    dishSchema,
  )

export const RecipeVersion =
  mongoose.models.RecipeVersion ||
  mongoose.model(
    'RecipeVersion',
    recipeVersionSchema,
  )

export const RecipeIngredient =
  mongoose.models.RecipeIngredient ||
  mongoose.model(
    'RecipeIngredient',
    recipeIngredientSchema,
  )

export const RecipeStep =
  mongoose.models.RecipeStep ||
  mongoose.model(
    'RecipeStep',
    recipeStepSchema,
  )

export const RecipeSubstitution =
  mongoose.models.RecipeSubstitution ||
  mongoose.model(
    'RecipeSubstitution',
    recipeSubstitutionSchema,
  )

export const RecipeReview =
  mongoose.models.RecipeReview ||
  mongoose.model(
    'RecipeReview',
    recipeReviewSchema,
  )