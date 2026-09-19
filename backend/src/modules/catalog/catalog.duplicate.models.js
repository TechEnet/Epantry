import mongoose from "mongoose";

const {
  Schema,
} = mongoose;

const objectId =
  Schema.Types.ObjectId;

/*
|--------------------------------------------------------------------------
| Catalog Merge Decision
|--------------------------------------------------------------------------
|
| Duplicate resolution is non-destructive.
|
| Historical ProductVersion records are never re-parented or deleted.
| The duplicate source is retired and an immutable merge decision points to
| the canonical target ProductVersion.
|
*/

const catalogMergeDecisionSchema =
  new Schema(
    {
      sourceVersionId: {
        type:
          objectId,

        ref:
          "ProductVersion",

        required:
          true,
      },

      targetVersionId: {
        type:
          objectId,

        ref:
          "ProductVersion",

        required:
          true,
      },

      matchType: {
        type:
          String,

        required:
          true,

        enum: [
          "gtin_exact",
        ],
      },

      sourceGtin: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          14,
      },

      targetGtin: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          14,
      },

      reasonDetails: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          2000,
      },

      decidedByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },

      decidedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      requestId: {
        type:
          String,

        trim:
          true,

        maxlength:
          200,

        default:
          "",
      },
    },
    {
      strict:
        true,

      minimize:
        false,

      versionKey:
        false,

      timestamps:
        false,
    },
  );

catalogMergeDecisionSchema.index(
  {
    sourceVersionId:
      1,
  },
  {
    unique:
      true,
  },
);

catalogMergeDecisionSchema.index({
  targetVersionId:
    1,

  decidedAt:
    -1,
});

/*
|--------------------------------------------------------------------------
| Immutability
|--------------------------------------------------------------------------
*/

catalogMergeDecisionSchema.pre(
  "save",
  function preventMergeDecisionDocumentUpdate(
    next,
  ) {
    if (
      !this.isNew
    ) {
      return next(
        new Error(
          "Catalog merge decisions are immutable.",
        ),
      );
    }

    return next();
  },
);

function rejectMergeDecisionMutation(
  next,
) {
  return next(
    new Error(
      "Catalog merge decisions are immutable.",
    ),
  );
}

catalogMergeDecisionSchema.pre(
  "updateOne",
  rejectMergeDecisionMutation,
);

catalogMergeDecisionSchema.pre(
  "updateMany",
  rejectMergeDecisionMutation,
);

catalogMergeDecisionSchema.pre(
  "findOneAndUpdate",
  rejectMergeDecisionMutation,
);

catalogMergeDecisionSchema.pre(
  "deleteOne",
  rejectMergeDecisionMutation,
);

catalogMergeDecisionSchema.pre(
  "deleteMany",
  rejectMergeDecisionMutation,
);

catalogMergeDecisionSchema.pre(
  "findOneAndDelete",
  rejectMergeDecisionMutation,
);

export const CatalogMergeDecision =
  mongoose.models.CatalogMergeDecision ||
  mongoose.model(
    "CatalogMergeDecision",
    catalogMergeDecisionSchema,
    "catalogMergeDecisions",
  );