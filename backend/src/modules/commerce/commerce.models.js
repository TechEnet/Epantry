import mongoose from 'mongoose'

const { Schema } = mongoose
const objectId = Schema.Types.ObjectId

const moneySnapshotSchema = new Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'INR',
    },
  },
  {
    _id: false,
  },
)

/*
|--------------------------------------------------------------------------
| Product Match
|--------------------------------------------------------------------------
|
| Immutable commerce comparison snapshot.
|
| M10 owns requirement truth.
| M04 owns canonical Product/Pack truth.
| M05 owns Offer/Price/Inventory/Serviceability truth.
|
| M11 only records how those existing truths were matched at quote time.
|
*/

const productMatchSchema = new Schema(
  {
    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    householdId: {
      type: objectId,
      ref: 'Household',
      required: true,
      index: true,
    },

    outcomePlanId: {
      type: objectId,
      ref: 'OutcomePlan',
      required: true,
      index: true,
    },

    outcomePlanRevision: {
      type: Number,
      required: true,
      min: 1,
    },

    basketQuoteId: {
      type: objectId,
      ref: 'BasketQuote',
      required: true,
      index: true,
    },

    requirementLineId: {
      type: objectId,
      ref: 'RequirementLine',
      required: true,
      index: true,
    },

    canonicalIngredientId: {
      type: objectId,
      ref: 'CanonicalIngredient',
      required: true,
      index: true,
    },

    requirementLabel: {
      type: String,
      trim: true,
      default: '',
    },

    requirementQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    requirementUnit: {
      type: String,
      required: true,
      trim: true,
    },

    productVersionId: {
      type: objectId,
      ref: 'ProductVersion',
      required: true,
      index: true,
    },

    packId: {
      type: objectId,
      ref: 'Pack',
      required: true,
      index: true,
    },

    offerId: {
      type: objectId,
      ref: 'HostOffer',
      required: true,
      index: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    sellerName: {
      type: String,
      required: true,
      trim: true,
    },

    matchMethod: {
      type: String,
      enum: [
        'canonical_name_token',
        'single_ingredient_identity',
      ],
      required: true,
    },

    packQuantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    packUnit: {
      type: String,
      required: true,
      trim: true,
    },

    packQuantityInRequirementUnit: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    packCount: {
      type: Number,
      required: true,
      min: 1,
    },

    suppliedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    surplusQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unitPrice: {
      type: moneySnapshotSchema,
      required: true,
    },

    lineTotal: {
      type: moneySnapshotSchema,
      required: true,
    },

    priceRecordedAt: {
      type: Date,
      default: null,
    },

    inventoryObservedAt: {
      type: Date,
      default: null,
    },

    inventoryAgeSeconds: {
      type: Number,
      min: 0,
      default: null,
    },

    fulfillmentTypes: {
      type: [String],
      default: [],
    },

    candidateRank: {
      type: Number,
      required: true,
      min: 1,
    },

    quotedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'productMatches',
  },
)

productMatchSchema.index({
  basketQuoteId: 1,
  requirementLineId: 1,
  candidateRank: 1,
})

/*
|--------------------------------------------------------------------------
| Basket Quote Option
|--------------------------------------------------------------------------
*/

const quoteSelectionSchema = new Schema(
  {
    optionKey: {
      type: String,
      required: true,
      enum: [
        'best_value',
        'minimum_waste',
        'one_retailer',
      ],
    },

    label: {
      type: String,
      required: true,
    },

    productMatchIds: {
      type: [objectId],
      default: [],
    },

    matchedRequirementCount: {
      type: Number,
      required: true,
      min: 0,
    },

    totalRequirementCount: {
      type: Number,
      required: true,
      min: 0,
    },

    sellerCount: {
      type: Number,
      required: true,
      min: 0,
    },

    itemSubtotalMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      required: true,
      default: 'INR',
    },

    totalSurplusQuantityScore: {
      type: Number,
      required: true,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Honest Landed Cost Boundary
    |--------------------------------------------------------------------------
    |
    | M05 currently has item price but no governed delivery fee quote.
    | Therefore M11 MUST NOT invent total delivered cost.
    |
    */

    totalLandedCostMinor: {
      type: Number,
      min: 0,
      default: null,
    },

    landedCostCompleteness: {
      type: String,
      enum: [
        'item_prices_only',
        'complete',
      ],
      required: true,
      default: 'item_prices_only',
    },

    objectiveSatisfied: {
      type: Boolean,
      required: true,
      default: true,
    },

    explanationCodes: {
      type: [String],
      default: [],
    },
  },
  {
    _id: false,
  },
)

/*
|--------------------------------------------------------------------------
| Basket Quote
|--------------------------------------------------------------------------
*/

const basketQuoteSchema = new Schema(
  {
    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    householdId: {
      type: objectId,
      ref: 'Household',
      required: true,
      index: true,
    },

    outcomePlanId: {
      type: objectId,
      ref: 'OutcomePlan',
      required: true,
      index: true,
    },

    outcomePlanRevision: {
      type: Number,
      required: true,
      min: 1,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    requestedObjective: {
      type: String,
      enum: [
        'best_value',
        'minimum_waste',
        'one_retailer',
      ],
      required: true,
    },

    requestedFulfillmentType: {
      type: String,
      enum: [
        'delivery',
        'pickup',
      ],
      default: null,
    },

    status: {
      type: String,
      enum: [
        'active',
        'superseded',
        'expired',
      ],
      required: true,
      default: 'active',
    },

    options: {
      type: [quoteSelectionSchema],
      default: [],
    },

    recommendedOptionKey: {
      type: String,
      enum: [
        'best_value',
        'minimum_waste',
        'one_retailer',
      ],
      default: null,
    },

    unmatchedRequirementLineIds: {
      type: [objectId],
      default: [],
    },

    createIdempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },

    quotedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'basketQuotes',
  },
)

basketQuoteSchema.index(
  {
    ownerUserId: 1,
    createIdempotencyKey: 1,
  },
  {
    unique: true,
  },
)

basketQuoteSchema.index({
  ownerUserId: 1,
  householdId: 1,
  outcomePlanId: 1,
  createdAt: -1,
})

/*
|--------------------------------------------------------------------------
| Marketplace Cart Item
|--------------------------------------------------------------------------
*/

const cartItemSchema = new Schema(
  {
    requirementLineId: {
      type: objectId,
      ref: 'RequirementLine',
      default: null,
    },

    productMatchId: {
      type: objectId,
      ref: 'ProductMatch',
      default: null,
    },

    canonicalIngredientId: {
      type: objectId,
      ref: 'CanonicalIngredient',
      default: null,
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    productVersionId: {
      type: objectId,
      ref: 'ProductVersion',
      required: true,
    },

    packId: {
      type: objectId,
      ref: 'Pack',
      required: true,
    },

    offerId: {
      type: objectId,
      ref: 'HostOffer',
      required: true,
    },

    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
    },

    sellerName: {
      type: String,
      required: true,
    },

    packCount: {
      type: Number,
      required: true,
      min: 1,
    },

    packQuantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    packUnit: {
      type: String,
      required: true,
    },

    requiredQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    requiredUnit: {
      type: String,
      required: true,
    },

    suppliedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    surplusQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unitPrice: {
      type: moneySnapshotSchema,
      required: true,
    },

    lineTotal: {
      type: moneySnapshotSchema,
      required: true,
    },

    priceRecordedAt: {
      type: Date,
      default: null,
    },

    inventoryObservedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
)

/*
|--------------------------------------------------------------------------
| Marketplace Cart
|--------------------------------------------------------------------------
|
| Only EPANTRY Marketplace selections belong here.
|
| External retailer handoff is a separate M11 transaction object added
| in Part 3. Never pretend an external deep link is an EPANTRY Cart.
|
*/

const marketplaceCartSchema = new Schema(
  {
    ownerUserId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    householdId: {
      type: objectId,
      ref: 'Household',
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      enum: [
        'basket_quote',
        'direct_product',
      ],
      required: true,
      default: 'basket_quote',
      index: true,
    },

    outcomePlanId: {
      type: objectId,
      ref: 'OutcomePlan',
      default: null,
      index: true,
    },

    outcomePlanRevision: {
      type: Number,
      min: 1,
      default: null,
    },

    basketQuoteId: {
      type: objectId,
      ref: 'BasketQuote',
      default: null,
    },

    optionKey: {
      type: String,
      enum: [
        'best_value',
        'minimum_waste',
        'one_retailer',
      ],
      default: null,
    },

    pincode: {
      type: String,
      required: true,
    },

    fulfillmentType: {
      type: String,
      enum: [
        'delivery',
        'pickup',
      ],
      default: null,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    itemSubtotalMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    knownFeesMinor: {
      type: Number,
      min: 0,
      default: null,
    },

    totalLandedCostMinor: {
      type: Number,
      min: 0,
      default: null,
    },

    landedCostCompleteness: {
      type: String,
      enum: [
        'item_prices_only',
        'complete',
      ],
      required: true,
      default: 'item_prices_only',
    },

    currency: {
      type: String,
      required: true,
      default: 'INR',
    },

    sellerCount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        'draft',
        'checkout_pending',
        'converted',
        'abandoned',
      ],
      required: true,
      default: 'draft',
    },

    createIdempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
  },
  {
    timestamps: true,
    collection: 'carts',
  },
)

marketplaceCartSchema.index(
  {
    ownerUserId: 1,
    createIdempotencyKey: 1,
  },
  {
    unique: true,
  },
)

marketplaceCartSchema.index({
  ownerUserId: 1,
  householdId: 1,
  status: 1,
  updatedAt: -1,
})

/*
|--------------------------------------------------------------------------
| Immutable Comparison Snapshots
|--------------------------------------------------------------------------
*/

function blockImmutableSnapshotMutation(label) {
  return function immutableSnapshotMutationBlocked() {
    throw new Error(
      `${label} snapshots are append-only and cannot be changed or deleted.`,
    )
  }
}

for (const schema of [
  productMatchSchema,
  basketQuoteSchema,
]) {
  schema.pre(
    [
      'updateOne',
      'updateMany',
      'findOneAndUpdate',
      'deleteOne',
      'deleteMany',
      'findOneAndDelete',
    ],
    blockImmutableSnapshotMutation(
      'Commerce comparison',
    ),
  )
}

export const ProductMatch =
  mongoose.models.ProductMatch ||
  mongoose.model(
    'ProductMatch',
    productMatchSchema,
  )

export const BasketQuote =
  mongoose.models.BasketQuote ||
  mongoose.model(
    'BasketQuote',
    basketQuoteSchema,
  )

export const MarketplaceCart =
  mongoose.models.MarketplaceCart ||
  mongoose.model(
    'MarketplaceCart',
    marketplaceCartSchema,
  )