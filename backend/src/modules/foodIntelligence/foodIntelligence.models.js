import mongoose from 'mongoose'

import {
  ALLERGEN_CALCULATION_OUTCOMES,
  ALLERGEN_RELATION_TYPES,
  DIETARY_CALCULATION_OUTCOMES,
  FOOD_CALCULATION_ENTITY_TYPES,
  FOOD_CALCULATION_STATUSES,
  FOOD_EVIDENCE_STATES,
  FOOD_INTELLIGENCE_COLLECTIONS,
  FOOD_RULE_STATUSES,
  FOOD_RULE_TYPES,
  INGREDIENT_RELATION_STATUSES,
  normalizeFoodKey,
  normalizeJurisdictionCode,
} from './foodIntelligence.constants.js'

const {
  Schema,
} =
  mongoose

const objectId =
  Schema.Types.ObjectId

/*
|--------------------------------------------------------------------------
| Shared Schemas
|--------------------------------------------------------------------------
*/

const jurisdictionMappingSchema =
  new Schema(
    {
      jurisdictionCode: {
        type:
          String,

        required:
          true,

        trim:
          true,

        set:
          normalizeJurisdictionCode,
      },

      externalCode: {
        type:
          String,

        default:
          '',

        trim:
          true,
      },

      label: {
        type:
          String,

        default:
          '',

        trim:
          true,
      },
    },
    {
      _id:
        false,
    },
  )

const sourceVersionSchema =
  new Schema(
    {
      sourceType: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          80,
      },

      sourceId: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          200,
      },

      version: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          120,
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,
      },

      evidenceSourceId: {
        type:
          objectId,

        default:
          null,
      },
    },
    {
      _id:
        false,
    },
  )

const ruleProfileVersionSchema =
  new Schema(
    {
      ruleProfileId: {
        type:
          objectId,

        required:
          true,
      },

      ruleKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      version: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },
    },
    {
      _id:
        false,
    },
  )

const nutrientCalculationResultSchema =
  new Schema(
    {
      nutrientId: {
        type:
          objectId,

        required:
          true,
      },

      amount: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      unit: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          40,
      },

      basis: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          120,
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,
      },
    },
    {
      _id:
        false,
    },
  )

const allergenCalculationResultSchema =
  new Schema(
    {
      allergenId: {
        type:
          objectId,

        required:
          true,
      },

      outcome: {
        type:
          String,

        required:
          true,

        enum:
          ALLERGEN_CALCULATION_OUTCOMES,
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,
      },

      ingredientRelationIds: {
        type: [
          objectId,
        ],

        default:
          [],
      },
    },
    {
      _id:
        false,
    },
  )

const dietaryCalculationResultSchema =
  new Schema(
    {
      ruleKey: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      outcome: {
        type:
          String,

        required:
          true,

        enum:
          DIETARY_CALCULATION_OUTCOMES,
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,
      },

      reasonCodes: {
        type: [
          String,
        ],

        default:
          [],
      },
    },
    {
      _id:
        false,
    },
  )

/*
|--------------------------------------------------------------------------
| Allergen
|--------------------------------------------------------------------------
*/

const allergenSchema =
  new Schema(
    {
      key: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,

        trim:
          true,

        set:
          normalizeFoodKey,
      },

      canonicalName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,
      },

      jurisdictionMappings: {
        type: [
          jurisdictionMappingSchema,
        ],

        default:
          [],
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'retired',
        ],

        default:
          'active',

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        FOOD_INTELLIGENCE_COLLECTIONS.ALLERGEN,
    },
  )

/*
|--------------------------------------------------------------------------
| Nutrient
|--------------------------------------------------------------------------
*/

const nutrientSchema =
  new Schema(
    {
      key: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,

        trim:
          true,

        set:
          normalizeFoodKey,
      },

      canonicalName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,
      },

      canonicalUnit: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          40,
      },

      basisRules: {
        type: [
          Schema.Types.Mixed,
        ],

        default:
          [],
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'retired',
        ],

        default:
          'active',

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      collection:
        FOOD_INTELLIGENCE_COLLECTIONS.NUTRIENT,
    },
  )

/*
|--------------------------------------------------------------------------
| Ingredient → Allergen Relationship
|--------------------------------------------------------------------------
|
| CanonicalIngredient remains M04 canonical truth.
|
| M08 stores only the governed relationship edge.
|--------------------------------------------------------------------------
*/

const ingredientRelationSchema =
  new Schema(
    {
      canonicalIngredientId: {
        type:
          objectId,

        required:
          true,

        index:
          true,
      },

      allergenId: {
        type:
          objectId,

        required:
          true,

        index:
          true,
      },

      relationType: {
        type:
          String,

        required:
          true,

        enum:
          ALLERGEN_RELATION_TYPES,

        index:
          true,
      },

      mappingVersion: {
        type:
          Number,

        required:
          true,

        min:
          1,

        default:
          1,
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          INGREDIENT_RELATION_STATUSES,

        default:
          'draft',

        index:
          true,
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,

        default:
          'unknown_review_required',
      },

      evidenceSourceId: {
        type:
          objectId,

        default:
          null,
      },

      effectiveFrom: {
        type:
          Date,

        default:
          null,
      },

      effectiveTo: {
        type:
          Date,

        default:
          null,
      },

      changeReason: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          1000,
      },

      createdByUserId: {
        type:
          objectId,

        required:
          true,
      },

      approvedByUserId: {
        type:
          objectId,

        default:
          null,
      },

      approvedAt: {
        type:
          Date,

        default:
          null,
      },

      retiredAt: {
        type:
          Date,

        default:
          null,
      },

      notes: {
        type:
          String,

        default:
          '',

        trim:
          true,

        maxlength:
          2000,
      },
    },
    {
      timestamps:
        true,

      collection:
        FOOD_INTELLIGENCE_COLLECTIONS.INGREDIENT_RELATION,
    },
  )

ingredientRelationSchema.index(
  {
    canonicalIngredientId:
      1,

    allergenId:
      1,

    relationType:
      1,

    mappingVersion:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Rule Profile
|--------------------------------------------------------------------------
|
| Rule bodies remain explicit structured data.
|
| AI output is never an active rule profile by itself.
|--------------------------------------------------------------------------
*/

const ruleProfileSchema =
  new Schema(
    {
      ruleKey: {
        type:
          String,

        required:
          true,

        trim:
          true,

        set:
          normalizeFoodKey,

        index:
          true,
      },

      version: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      ruleType: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_RULE_TYPES,

        index:
          true,
      },

      jurisdictionCode: {
        type:
          String,

        required:
          true,

        trim:
          true,

        set:
          normalizeJurisdictionCode,

        index:
          true,
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_RULE_STATUSES,

        default:
          'draft',

        index:
          true,
      },

      definition: {
        type:
          Schema.Types.Mixed,

        required:
          true,
      },

      evidenceSourceIds: {
        type: [
          objectId,
        ],

        default:
          [],
      },

      effectiveFrom: {
        type:
          Date,

        default:
          null,
      },

      effectiveTo: {
        type:
          Date,

        default:
          null,
      },

      changeReason: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          1000,
      },

      createdByUserId: {
        type:
          objectId,

        required:
          true,
      },

      approvedByUserId: {
        type:
          objectId,

        default:
          null,
      },

      approvedAt: {
        type:
          Date,

        default:
          null,
      },

      retiredAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      collection:
        FOOD_INTELLIGENCE_COLLECTIONS.RULE_PROFILE,
    },
  )

ruleProfileSchema.index(
  {
    ruleKey:
      1,

    jurisdictionCode:
      1,

    version:
      1,
  },
  {
    unique:
      true,
  },
)

/*
|--------------------------------------------------------------------------
| Food Calculation
|--------------------------------------------------------------------------
|
| Append-only historical calculation snapshot.
|
| It stores:
|
| - entity/version identity
| - calculation version
| - exact source versions
| - exact rule profile versions
| - inputs
| - assumptions
| - yield factors
| - outputs
| - evidence state
| - reproducibility fingerprint
|
| It intentionally contains no Marketplace price, inventory or serviceability.
|--------------------------------------------------------------------------
*/

const foodCalculationSchema =
  new Schema(
    {
      entityType: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_CALCULATION_ENTITY_TYPES,

        index:
          true,
      },

      entityId: {
        type:
          objectId,

        required:
          true,

        index:
          true,
      },

      calculationVersion: {
        type:
          Number,

        required:
          true,

        min:
          1,
      },

      engineVersion: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          120,
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_CALCULATION_STATUSES,

        default:
          'calculated',

        index:
          true,
      },

      sourceVersions: {
        type: [
          sourceVersionSchema,
        ],

        default:
          [],
      },

      ruleProfileVersions: {
        type: [
          ruleProfileVersionSchema,
        ],

        default:
          [],
      },

      inputs: {
        type: [
          Schema.Types.Mixed,
        ],

        default:
          [],
      },

      assumptions: {
        type: [
          Schema.Types.Mixed,
        ],

        default:
          [],
      },

      yieldFactors: {
        type: [
          Schema.Types.Mixed,
        ],

        default:
          [],
      },

      nutrients: {
        type: [
          nutrientCalculationResultSchema,
        ],

        default:
          [],
      },

      allergens: {
        type: [
          allergenCalculationResultSchema,
        ],

        default:
          [],
      },

      dietary: {
        type: [
          dietaryCalculationResultSchema,
        ],

        default:
          [],
      },

      evidenceState: {
        type:
          String,

        required:
          true,

        enum:
          FOOD_EVIDENCE_STATES,
      },

      basis: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          1000,
      },

      fingerprint: {
        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          64,

        maxlength:
          64,

        index:
          true,
      },

      generatedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      generatedByUserId: {
        type:
          objectId,

        default:
          null,
      },

      approvedByUserId: {
        type:
          objectId,

        default:
          null,
      },

      approvedAt: {
        type:
          Date,

        default:
          null,
      },

      supersedesCalculationId: {
        type:
          objectId,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      collection:
        FOOD_INTELLIGENCE_COLLECTIONS.FOOD_CALCULATION,
    },
  )

foodCalculationSchema.index(
  {
    entityType:
      1,

    entityId:
      1,

    calculationVersion:
      1,
  },
  {
    unique:
      true,
  },
)

foodCalculationSchema.index({
  entityType:
    1,

  entityId:
    1,

  status:
    1,

  generatedAt:
    -1,
})

/*
|--------------------------------------------------------------------------
| Immutable Historical Calculation
|--------------------------------------------------------------------------
*/

foodCalculationSchema.pre(
  'save',
  function preventHistoricalCalculationMutation(
    next,
  ) {
    if (
      !this.isNew &&
      this.isModified()
    ) {
      return next(
        new Error(
          'FoodCalculation history is immutable. Create a superseding calculation instead.',
        ),
      )
    }

    return next()
  },
)

/*
|--------------------------------------------------------------------------
| Models
|--------------------------------------------------------------------------
*/

export const Allergen =
  mongoose.models.Allergen ||
  mongoose.model(
    'Allergen',
    allergenSchema,
  )

export const Nutrient =
  mongoose.models.Nutrient ||
  mongoose.model(
    'Nutrient',
    nutrientSchema,
  )

export const IngredientRelation =
  mongoose.models.IngredientRelation ||
  mongoose.model(
    'IngredientRelation',
    ingredientRelationSchema,
  )

export const RuleProfile =
  mongoose.models.RuleProfile ||
  mongoose.model(
    'RuleProfile',
    ruleProfileSchema,
  )

export const FoodCalculation =
  mongoose.models.FoodCalculation ||
  mongoose.model(
    'FoodCalculation',
    foodCalculationSchema,
  )