import mongoose from 'mongoose'

const {
  Schema,
} = mongoose

const baseSchemaOptions =
  Object.freeze({
    timestamps:
      true,

    strict:
      true,

    minimize:
      false,
  })

const objectId =
  Schema.Types.ObjectId

export const SEARCH_ACTOR_TYPES =
  Object.freeze([
    'guest',
    'customer',
    'authenticated_non_customer',
  ])

export const SEARCH_RESULT_TYPES =
  Object.freeze([
    'recipe',
    'product',
    'ingredient',
    'brand',
  ])

export const SEARCH_RESULT_MODES =
  Object.freeze([
    'all',
    ...SEARCH_RESULT_TYPES,
  ])

export const SEARCH_EVENT_TYPES =
  Object.freeze([
    'search',
    'refine',
    'decision_explain',
    'no_result',
  ])

const searchConstraintSchema =
  new Schema(
    {
      maxTimeMinutes: {
        type:
          Number,

        min:
          1,

        max:
          1440,

        default:
          null,
      },

      servings: {
        type:
          Number,

        min:
          1,

        max:
          100,

        default:
          null,
      },

      budgetMinor: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      currency: {
        type:
          String,

        enum: [
          'INR',
        ],

        default:
          'INR',
      },

      course: {
        type:
          String,

        trim:
          true,

        maxlength:
          80,

        default:
          null,
      },

      cuisine: {
        type:
          String,

        trim:
          true,

        maxlength:
          100,

        default:
          null,
      },

      dietaryKeys: {
        type: [
          String,
        ],

        default:
          [],
      },

      excludedAllergens: {
        type: [
          String,
        ],

        default:
          [],
      },

      usePantry: {
        type:
          Boolean,

        default:
          false,
      },

      commerceObjective: {
        type:
          String,

        enum: [
          'one_retailer',
          null,
        ],

        default:
          null,
      },

      preferenceSignals: {
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

const searchSessionSchema =
  new Schema(
    {
      actorType: {
        type:
          String,

        enum:
          SEARCH_ACTOR_TYPES,

        required:
          true,
      },

      ownerUserId: {
        type:
          objectId,

        ref:
          'User',

        default:
          null,
      },

      householdId: {
        type:
          objectId,

        ref:
          'Household',

        default:
          null,
      },

      continuationTokenHash: {
        type:
          String,

        required:
          true,

        select:
          false,
      },

      normalizedQuery: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          500,
      },

      mode: {
        type:
          String,

        enum:
          SEARCH_RESULT_MODES,

        required:
          true,

        default:
          'all',
      },

      constraints: {
        type:
          searchConstraintSchema,

        default: () =>
          ({}),
      },

      status: {
        type:
          String,

        enum: [
          'active',
          'closed',
        ],

        default:
          'active',
      },

      lastEventAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    baseSchemaOptions,
  )

searchSessionSchema.index({
  ownerUserId:
    1,

  updatedAt:
    -1,
})

searchSessionSchema.index({
  status:
    1,

  lastEventAt:
    -1,
})

const searchEventSchema =
  new Schema(
    {
      sessionId: {
        type:
          objectId,

        ref:
          'SearchSession',

        required:
          true,

        index:
          true,
      },

      eventType: {
        type:
          String,

        enum:
          SEARCH_EVENT_TYPES,

        required:
          true,
      },

      normalizedQuery: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          500,
      },

      mode: {
        type:
          String,

        enum:
          SEARCH_RESULT_MODES,

        required:
          true,
      },

      constraints: {
        type:
          searchConstraintSchema,

        default: () =>
          ({}),
      },

      resultCount: {
        type:
          Number,

        min:
          0,

        default:
          0,
      },

      candidateCountByType: {
        type:
          Schema.Types.Mixed,

        default: () =>
          ({}),
      },

      unresolvedConstraintCodes: {
        type: [
          String,
        ],

        default:
          [],
      },

      occurredAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    baseSchemaOptions,
  )

searchEventSchema.index({
  sessionId:
    1,

  occurredAt:
    -1,
})

const candidateSchema =
  new Schema(
    {
      candidateType: {
        type:
          String,

        enum:
          SEARCH_RESULT_TYPES,

        required:
          true,
      },

      candidateId: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          160,
      },

      displayName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          300,
      },

      path: {
        type:
          String,

        trim:
          true,

        maxlength:
          500,

        default:
          '',
      },

      score: {
        type:
          Number,

        required:
          true,
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

const candidateSetSchema =
  new Schema(
    {
      sessionId: {
        type:
          objectId,

        ref:
          'SearchSession',

        required:
          true,

        index:
          true,
      },

      searchEventId: {
        type:
          objectId,

        ref:
          'SearchEvent',

        required:
          true,

        unique:
          true,
      },

      candidates: {
        type: [
          candidateSchema,
        ],

        default:
          [],
      },

      generatedAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    baseSchemaOptions,
  )

const rankingDecisionSchema =
  new Schema(
    {
      sessionId: {
        type:
          objectId,

        ref:
          'SearchSession',

        required:
          true,

        index:
          true,
      },

      searchEventId: {
        type:
          objectId,

        ref:
          'SearchEvent',

        required:
          true,

        unique:
          true,
      },

      candidateSetId: {
        type:
          objectId,

        ref:
          'CandidateSet',

        required:
          true,

        unique:
          true,
      },

      strategy: {
        type:
          String,

        enum: [
          'deterministic_organic_v1',
        ],

        default:
          'deterministic_organic_v1',
      },

      appliedHardConstraintCodes: {
        type: [
          String,
        ],

        default:
          [],
      },

      unresolvedConstraintCodes: {
        type: [
          String,
        ],

        default:
          [],
      },

      selectedCandidateKeys: {
        type: [
          String,
        ],

        default:
          [],
      },

      decidedAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    baseSchemaOptions,
  )

const aiInteractionSchema =
  new Schema(
    {
      sessionId: {
        type:
          objectId,

        ref:
          'SearchSession',

        default:
          null,
      },

      interactionType: {
        type:
          String,

        enum: [
          'intent_parse',
          'copilot_message',
          'explanation_wording',
        ],

        required:
          true,
      },

      provider: {
        type:
          String,

        default:
          'none',
      },

      modelId: {
        type:
          String,

        default:
          null,
      },

      promptVersion: {
        type:
          String,

        default:
          null,
      },

      status: {
        type:
          String,

        enum: [
          'not_used',
          'succeeded',
          'failed',
          'fallback',
        ],

        default:
          'not_used',
      },

      toolNames: {
        type: [
          String,
        ],

        default:
          [],
      },

      latencyMs: {
        type:
          Number,

        min:
          0,

        default:
          null,
      },

      usage: {
        type:
          Schema.Types.Mixed,

        default:
          null,
      },

      recordedAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    baseSchemaOptions,
  )

function blockAppendOnlyMutation(
  schema,
  label,
) {
  const fail =
    function failAppendOnlyMutation(
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
    fail,
  )

  schema.pre(
    'updateOne',
    fail,
  )

  schema.pre(
    'updateMany',
    fail,
  )

  schema.pre(
    'deleteOne',
    fail,
  )

  schema.pre(
    'deleteMany',
    fail,
  )

  schema.pre(
    'findOneAndDelete',
    fail,
  )
}

blockAppendOnlyMutation(
  searchEventSchema,
  'SearchEvent',
)

blockAppendOnlyMutation(
  candidateSetSchema,
  'CandidateSet',
)

blockAppendOnlyMutation(
  rankingDecisionSchema,
  'RankingDecision',
)

blockAppendOnlyMutation(
  aiInteractionSchema,
  'AIInteraction',
)

export const SearchSession =
  mongoose.models.SearchSession ||
  mongoose.model(
    'SearchSession',
    searchSessionSchema,
    'searchSessions',
  )

export const SearchEvent =
  mongoose.models.SearchEvent ||
  mongoose.model(
    'SearchEvent',
    searchEventSchema,
    'searchEvents',
  )

export const CandidateSet =
  mongoose.models.CandidateSet ||
  mongoose.model(
    'CandidateSet',
    candidateSetSchema,
    'candidateSets',
  )

export const RankingDecision =
  mongoose.models.RankingDecision ||
  mongoose.model(
    'RankingDecision',
    rankingDecisionSchema,
    'rankingDecisions',
  )

export const AIInteraction =
  mongoose.models.AIInteraction ||
  mongoose.model(
    'AIInteraction',
    aiInteractionSchema,
    'aiInteractions',
  )