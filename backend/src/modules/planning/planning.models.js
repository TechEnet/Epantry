import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions =
  Object.freeze({
    timestamps:
      true,

    strict:
      true,

    minimize:
      false,
  })

export const MEAL_PLAN_STATUSES =
  Object.freeze([
    'active',
    'archived',
  ])

export const PLANNED_MEAL_STATUSES =
  Object.freeze([
    'planned',
    'skipped',
    'cancelled',
  ])

export const MEAL_TYPES =
  Object.freeze([
    'breakfast',
    'brunch',
    'lunch',
    'snack',
    'dinner',
    'other',
  ])

export const MEAL_READINESS_STATES =
  Object.freeze([
    'enough',
    'likely_enough',
    'running_low_before_meal',
    'expected_depleted',
    'missing',
    'needs_confirmation',
  ])

export const RESERVATION_STATUSES =
  Object.freeze([
    'active',
    'released',
  ])

export const RESERVATION_BASES =
  Object.freeze([
    'confirmed_exact',
    'confirmed_range_minimum',
  ])

export const NEXT_BASKET_CLASSIFICATIONS =
  Object.freeze([
    'required_for_planned_meal',
    'likely_running_low',
    'predicted_staple_replenishment',
    'optional_usual_purchase',
    'value_opportunity',
    'enough_already_available',
  ])

export const NEXT_BASKET_CONFIDENCE_CLASSES =
  Object.freeze([
    'high',
    'medium',
    'low',
  ])

export const NEXT_BASKET_STATUSES =
  Object.freeze([
    'active',
    'accepted',
    'rejected',
    'corrected',
    'snoozed',
    'stopped',
    'resolved',
  ])

export const RECOMMENDATION_FEEDBACK_ACTIONS =
  Object.freeze([
    'accept',
    'reject',
    'still_have',
    'bought_elsewhere',
    'correct',
    'change_quantity',
    'change_brand',
    'snooze',
    'stop_suggesting',
  ])

const quantitySchema =
  new Schema(
    {
      mode: {
        type:
          String,

        enum: [
          'exact',
          'unknown',
        ],

        required:
          true,

        default:
          'unknown',
      },

      value: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      unit: {
        type:
          String,

        trim:
          true,

        maxlength:
          40,

        default:
          null,
      },
    },
    {
      _id:
        false,
    },
  )

const readinessSummarySchema =
  new Schema(
    {
      totalRequirements: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      enough: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      likelyEnough: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      runningLow: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      expectedDepleted: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      missing: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      needsConfirmation: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },
    },
    {
      _id:
        false,
    },
  )

const forecastLineSchema =
  new Schema(
    {
      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,
      },

      label: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          null,
      },

      optional: {
        type:
          Boolean,

        default:
          false,
      },

      requiredQuantity: {
        type:
          Number,

        min:
          0,

        required:
          true,
      },

      requiredUnit: {
        type:
          String,

        trim:
          true,

        required:
          true,
      },

      reservedQuantityInRequirementUnit: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      provenShortageQuantity: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      readinessState: {
        type:
          String,

        enum:
          MEAL_READINESS_STATES,

        required:
          true,
      },

      reasonCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        required:
          true,
      },
    },
    {
      _id:
        false,
    },
  )

const mealPlanSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      title: {
        type:
          String,

        trim:
          true,

        maxlength:
          140,

        default:
          'Meal Plan',
      },

      horizonStart: {
        type:
          Date,

        required:
          true,
      },

      horizonEnd: {
        type:
          Date,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          MEAL_PLAN_STATUSES,

        default:
          'active',

        index:
          true,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,
      },
    },
    baseOptions,
  )

mealPlanSchema.index(
  {
    householdId:
      1,

    idempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

mealPlanSchema.index({
  householdId:
    1,

  status:
    1,

  horizonStart:
    1,
})

const plannedMealSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      mealPlanId: {
        type:
          objectId,

        ref:
          'MealPlan',

        required:
          true,

        index:
          true,
      },

      dishId: {
        type:
          objectId,

        ref:
          'Dish',

        required:
          true,
      },

      recipeVersionId: {
        type:
          objectId,

        ref:
          'RecipeVersion',

        required:
          true,
      },

      recipeSlug: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          180,
      },

      recipeTitle: {
        type:
          String,

        trim:
          true,

        required:
          true,

        maxlength:
          220,
      },

      plannedAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      mealType: {
        type:
          String,

        enum:
          MEAL_TYPES,

        default:
          'other',
      },

      servings: {
        type:
          Number,

        min:
          1,

        max:
          100,

        required:
          true,
      },

      priority: {
        type:
          Number,

        min:
          1,

        max:
          5,

        default:
          3,
      },

      status: {
        type:
          String,

        enum:
          PLANNED_MEAL_STATUSES,

        default:
          'planned',

        index:
          true,
      },

      readinessState: {
        type:
          String,

        enum:
          MEAL_READINESS_STATES,

        default:
          'needs_confirmation',
      },

      readinessSummary: {
        type:
          readinessSummarySchema,

        default: () =>
          ({}),
      },

      forecastLines: {
        type: [
          forecastLineSchema,
        ],

        default:
          [],
      },

      lastCalculatedAt: {
        type:
          Date,

        default:
          null,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },
    },
    baseOptions,
  )

plannedMealSchema.index(
  {
    householdId:
      1,

    idempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

plannedMealSchema.index({
  householdId:
    1,

  status:
    1,

  plannedAt:
    1,

  priority:
    -1,
})

const pantryReservationSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      pantryItemId: {
        type:
          objectId,

        ref:
          'PantryItem',

        required:
          true,

        index:
          true,
      },

      plannedMealId: {
        type:
          objectId,

        ref:
          'PlannedMeal',

        required:
          true,

        index:
          true,
      },

      recipeVersionId: {
        type:
          objectId,

        ref:
          'RecipeVersion',

        required:
          true,
      },

      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,
      },

      reservedQuantity: {
        type:
          Number,

        min:
          0,

        required:
          true,
      },

      unit: {
        type:
          String,

        trim:
          true,

        required:
          true,
      },

      reservationBasis: {
        type:
          String,

        enum:
          RESERVATION_BASES,

        required:
          true,
      },

      reservedForDate: {
        type:
          Date,

        required:
          true,
      },

      status: {
        type:
          String,

        enum:
          RESERVATION_STATUSES,

        default:
          'active',

        index:
          true,
      },

      releasedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    baseOptions,
  )

pantryReservationSchema.index({
  householdId:
    1,

  pantryItemId:
    1,

  status:
    1,

  reservedForDate:
    1,
})

const predictionSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,

        index:
          true,
      },

      ingredientName: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        required:
          true,
      },

      predictionKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          128,

        required:
          true,
      },

      classification: {
        type:
          String,

        enum:
          NEXT_BASKET_CLASSIFICATIONS,

        required:
          true,
      },

      proposedQuantity: {
        type:
          quantitySchema,

        required:
          true,

        default: () => ({
          mode:
            'unknown',
        }),
      },

      customerAdjustedQuantity: {
        type:
          quantitySchema,

        default:
          null,
      },

      preferredBrandId: {
        type:
          objectId,

        ref:
          'Brand',

        default:
          null,
      },

      confidenceClass: {
        type:
          String,

        enum:
          NEXT_BASKET_CONFIDENCE_CLASSES,

        required:
          true,
      },

      reasonCode: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        required:
          true,
      },

      reasonParameters: {
        type:
          Schema.Types.Mixed,

        default: () =>
          ({}),
      },

      evidenceReferences: {
        type: [
          String,
        ],

        default:
          [],
      },

      status: {
        type:
          String,

        enum:
          NEXT_BASKET_STATUSES,

        default:
          'active',

        index:
          true,
      },

      snoozedUntil: {
        type:
          Date,

        default:
          null,
      },

      generatedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      lastEvaluatedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    baseOptions,
  )

predictionSchema.index(
  {
    householdId:
      1,

    predictionKey:
      1,
  },
  {
    unique:
      true,
  },
)

predictionSchema.index({
  householdId:
    1,

  status:
    1,

  generatedAt:
    -1,
})

const recommendationFeedbackSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        index:
          true,
      },

      nextBasketPredictionId: {
        type:
          objectId,

        ref:
          'NextBasketPrediction',

        required:
          true,

        index:
          true,
      },

      canonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,

        index:
          true,
      },

      actorUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      action: {
        type:
          String,

        enum:
          RECOMMENDATION_FEEDBACK_ACTIONS,

        required:
          true,
      },

      quantity: {
        type:
          quantitySchema,

        default:
          null,
      },

      brandId: {
        type:
          objectId,

        ref:
          'Brand',

        default:
          null,
      },

      snoozeUntil: {
        type:
          Date,

        default:
          null,
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          null,
      },

      idempotencyKey: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        required:
          true,
      },

      recordedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    baseOptions,
  )

recommendationFeedbackSchema.index(
  {
    householdId:
      1,

    idempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

recommendationFeedbackSchema.index({
  householdId:
    1,

  canonicalIngredientId:
    1,

  action:
    1,

  recordedAt:
    -1,
})

const recommendationPreferenceSchema =
  new Schema(
    {
      householdId: {
        type:
          objectId,

        ref:
          'Household',

        required:
          true,

        unique:
          true,
      },

      nextBasketEnabled: {
        type:
          Boolean,

        default:
          true,
      },

      pausedUntil: {
        type:
          Date,

        default:
          null,
      },

      notificationFrequency: {
        type:
          String,

        enum: [
          'off',
          'important_only',
          'daily',
          'weekly',
        ],

        default:
          'important_only',
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },
    },
    baseOptions,
  )

function makeAppendOnly(
  schema,
  label,
) {
  const reject =
    function rejectMutation(
      next,
    ) {
      next(
        new Error(
          `${label} records are append-only.`,
        ),
      )
    }

  schema.pre(
    'findOneAndUpdate',
    reject,
  )

  schema.pre(
    'updateOne',
    reject,
  )

  schema.pre(
    'updateMany',
    reject,
  )

  schema.pre(
    'deleteOne',
    reject,
  )

  schema.pre(
    'deleteMany',
    reject,
  )

  schema.pre(
    'findOneAndDelete',
    reject,
  )
}

makeAppendOnly(
  recommendationFeedbackSchema,
  'RecommendationFeedback',
)

export const MealPlan =
  mongoose.models.MealPlan ||
  mongoose.model(
    'MealPlan',
    mealPlanSchema,
    'mealPlans',
  )

export const PlannedMeal =
  mongoose.models.PlannedMeal ||
  mongoose.model(
    'PlannedMeal',
    plannedMealSchema,
    'plannedMeals',
  )

export const PantryReservation =
  mongoose.models.PantryReservation ||
  mongoose.model(
    'PantryReservation',
    pantryReservationSchema,
    'pantryReservations',
  )

export const NextBasketPrediction =
  mongoose.models.NextBasketPrediction ||
  mongoose.model(
    'NextBasketPrediction',
    predictionSchema,
    'nextBasketPredictions',
  )

export const RecommendationFeedback =
  mongoose.models.RecommendationFeedback ||
  mongoose.model(
    'RecommendationFeedback',
    recommendationFeedbackSchema,
    'recommendationFeedback',
  )

export const RecommendationPreference =
  mongoose.models.RecommendationPreference ||
  mongoose.model(
    'RecommendationPreference',
    recommendationPreferenceSchema,
    'recommendationPreferences',
  )