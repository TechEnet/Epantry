import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

export const OUTCOME_READINESS_STATES =
  Object.freeze([
    'ready',
    'almost_there',
    'missing',
    'needs_confirmation',
  ])

export const REQUIREMENT_LINE_GROUPS =
  Object.freeze([
    'already_have',
    'needed',
    'running_low',
    'needs_confirmation',
    'optional_upgrade',
  ])

export const REQUIREMENT_SHORTAGE_STATES =
  Object.freeze([
    'none',
    'confirmed',
    'uncertain',
  ])

export const REQUIREMENT_DECISION_ACTIONS =
  Object.freeze([
    'include_optional',
    'exclude_optional',
    'servings_changed',
  ])

export const OUTCOME_PURCHASE_MODES =
  Object.freeze([
    'missing_only',
    'full_recipe',
  ])

const outcomePlanSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,

        index:
          true,
      },

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

      sourceType: {
        type:
          String,

        enum: [
          'recipe',
        ],

        required:
          true,

        default:
          'recipe',
      },

      sourceDishId: {
        type:
          objectId,

        ref:
          'Dish',

        required:
          true,
      },

      sourceRecipeVersionId: {
        type:
          objectId,

        ref:
          'RecipeVersion',

        required:
          true,

        index:
          true,
      },

      sourceRecipeSlug: {
        type:
          String,

        required:
          true,

        trim:
          true,

        lowercase:
          true,
      },

      sourceRecipeTitle: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      targetServings: {
        type:
          Number,

        required:
          true,

        min:
          0.000001,

        max:
          1000,
      },

      purchaseMode: {
        type:
          String,

        enum:
          OUTCOME_PURCHASE_MODES,

        required:
          true,

        default:
          'missing_only',
      },

      selectedCanonicalIngredientIds: {
        type: [
          {
            type:
              objectId,

            ref:
              'CanonicalIngredient',
          },
        ],

        default:
          [],
      },

      revision: {
        type:
          Number,

        required:
          true,

        min:
          1,

        default:
          1,
      },

      readinessState: {
        type:
          String,

        enum:
          OUTCOME_READINESS_STATES,

        required:
          true,
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'archived',
        ],

        required:
          true,

        default:
          'active',

        index:
          true,
      },

      createIdempotencyKey: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,
      },

      appliedMutationKeys: {
        type: [
          String,
        ],

        default:
          [],
      },

      lastRecalculatedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    {
      timestamps:
        true,

      collection:
        'outcomePlans',
    },
  )

outcomePlanSchema.index(
  {
    ownerUserId:
      1,

    createIdempotencyKey:
      1,
  },
  {
    unique:
      true,
  },
)

outcomePlanSchema.index({
  ownerUserId:
    1,

  householdId:
    1,

  status:
    1,

  updatedAt:
    -1,
})

const requirementLineSchema =
  new Schema(
    {
      outcomePlanId: {
        type:
          objectId,

        ref:
          'OutcomePlan',

        required:
          true,

        index:
          true,
      },

      revision: {
        type:
          Number,

        required:
          true,

        min:
          1,

        index:
          true,
      },

      identityKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      sourceRecipeIngredientIds: {
        type: [
          objectId,
        ],

        default:
          [],
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

      label: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      requiredQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      requiredUnit: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      usablePantryQuantity: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      pantryState: {
        type:
          String,

        default:
          null,
      },

      pantryReconciliationState: {
        type:
          String,

        enum: [
          'available',
          'partial',
          'uncertain',
          'missing',
          'untracked',
        ],

        required:
          true,
      },

      pantryReason: {
        type:
          String,

        trim:
          true,

        default:
          '',
      },

      pantryConfidence: {
        type:
          Number,

        min:
          0,

        max:
          1,

        default:
          null,
      },

      genuineShortage: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      shortageUnit: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      shortageState: {
        type:
          String,

        enum:
          REQUIREMENT_SHORTAGE_STATES,

        required:
          true,
      },

      group: {
        type:
          String,

        enum:
          REQUIREMENT_LINE_GROUPS,

        required:
          true,
      },

      optional: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      includedInBasket: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      purchaseRequired: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
      },

      needsConfirmation: {
        type:
          Boolean,

        required:
          true,

        default:
          false,
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
      },

      productConstraints: {
        type: [
          String,
        ],

        default:
          [],
      },
    },
    {
      timestamps:
        true,

      collection:
        'requirementLines',
    },
  )

requirementLineSchema.index(
  {
    outcomePlanId:
      1,

    revision:
      1,

    identityKey:
      1,
  },
  {
    unique:
      true,
  },
)

const requirementDecisionSchema =
  new Schema(
    {
      outcomePlanId: {
        type:
          objectId,

        ref:
          'OutcomePlan',

        required:
          true,

        index:
          true,
      },

      revision: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      requirementIdentityKey: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      action: {
        type:
          String,

        enum:
          REQUIREMENT_DECISION_ACTIONS,

        required:
          true,
      },

      previousTargetServings: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      nextTargetServings: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      actorUserId: {
        type:
          objectId,

        ref:
          'User',

        required:
          true,
      },

      mutationKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      decidedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },
    },
    {
      timestamps:
        true,

      collection:
        'requirementDecisions',
    },
  )

requirementDecisionSchema.index({
  outcomePlanId:
    1,

  revision:
    1,

  decidedAt:
    1,
})

const substitutionPolicySchema =
  new Schema(
    {
      outcomePlanId: {
        type:
          objectId,

        ref:
          'OutcomePlan',

        required:
          true,

        index:
          true,
      },

      revision: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      requirementIdentityKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      sourceRecipeIngredientId: {
        type:
          objectId,

        ref:
          'RecipeIngredient',

        required:
          true,
      },

      substituteCanonicalIngredientId: {
        type:
          objectId,

        ref:
          'CanonicalIngredient',

        required:
          true,
      },

      replacementRatio: {
        type:
          Number,

        required:
          true,

        min:
          0.000001,
      },

      replacementUnit: {
        type:
          String,

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
      },
    },
    {
      timestamps:
        true,

      collection:
        'substitutionPolicies',
    },
  )

substitutionPolicySchema.index(
  {
    outcomePlanId:
      1,

    revision:
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

function blockHistoricalMutation(
  label,
) {
  return function historicalMutationBlocked() {
    throw new Error(
      `${label} records are append-only and cannot be changed or deleted.`,
    )
  }
}

for (
  const schema
  of [
    requirementLineSchema,
    requirementDecisionSchema,
    substitutionPolicySchema,
  ]
) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    blockHistoricalMutation(
      'Historical Outcome Plan',
    ),
  )
}

export const OutcomePlan =
  mongoose.models.OutcomePlan ||
  mongoose.model(
    'OutcomePlan',
    outcomePlanSchema,
  )

export const RequirementLine =
  mongoose.models.RequirementLine ||
  mongoose.model(
    'RequirementLine',
    requirementLineSchema,
  )

export const RequirementDecision =
  mongoose.models.RequirementDecision ||
  mongoose.model(
    'RequirementDecision',
    requirementDecisionSchema,
  )

export const SubstitutionPolicy =
  mongoose.models.SubstitutionPolicy ||
  mongoose.model(
    'SubstitutionPolicy',
    substitutionPolicySchema,
  )