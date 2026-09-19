import mongoose from "mongoose";

import {
  MARKETPLACE_CURRENCIES,
  MARKETPLACE_FULFILLMENT_TYPES,
  MARKETPLACE_INVENTORY_NODE_STATUSES,
  MARKETPLACE_INVENTORY_NODE_TYPES,
  MARKETPLACE_INVENTORY_SOURCE_TYPES,
  MARKETPLACE_OFFER_STATUSES,
  MARKETPLACE_ORGANIZATION_STATUSES,
  MARKETPLACE_ORGANIZATION_TYPES,
  MARKETPLACE_PRICE_RULE_STATUSES,
  MARKETPLACE_SERVICE_AREA_STATUSES,
  normalizeMarketplaceKey,
  normalizeMarketplaceSlug,
  normalizePostalCode,
} from "./marketplace.constants.js";

const {
  Schema,
} = mongoose;

const objectId =
  Schema.Types.ObjectId;

const baseSchemaOptions =
  Object.freeze({
    timestamps:
      true,

    versionKey:
      false,

    strict:
      true,

    minimize:
      false,
  });

/*
|--------------------------------------------------------------------------
| Shared Money Schema
|--------------------------------------------------------------------------
|
| Money is stored in integer minor units.
|
| Example:
|
| ₹99.50
| =
| 9950 minor units
|
| This avoids floating-point price errors.
|--------------------------------------------------------------------------
*/

const moneySchema =
  new Schema(
    {
      amountMinor: {
        type:
          Number,

        required:
          true,

        min:
          0,

        validate: {
          validator(
            value,
          ) {
            return Number.isInteger(
              value,
            );
          },

          message:
            "Money amount must be an integer number of minor currency units.",
        },
      },

      currency: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_CURRENCIES,

        uppercase:
          true,

        trim:
          true,

        default:
          "INR",
      },
    },
    {
      _id:
        false,
    },
  );

/*
|--------------------------------------------------------------------------
| Marketplace Organization
|--------------------------------------------------------------------------
|
| An Organization is the commercial tenant.
|
| The existing User remains the authentication identity.
|
| A Host may operate a Seller / Brand / B2B / Hybrid organization without
| introducing any new top-level application role.
|--------------------------------------------------------------------------
*/

const marketplaceOrganizationSchema =
  new Schema(
    {
      ownerUserId: {
        type:
          objectId,

        ref:
          "User",

        required:
          true,

        index:
          true,
      },

      displayName: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          220,
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
          250,
      },

      organizationType: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_ORGANIZATION_TYPES,

        default:
          "seller",
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_ORGANIZATION_STATUSES,

        default:
          "pending",
      },

      externalReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          250,

        default:
          "",
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default:
          {},
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    baseSchemaOptions,
  );

marketplaceOrganizationSchema.pre(
  "validate",
  function normalizeOrganizationSlug(
    next,
  ) {
    if (
      !this.slug &&
      this.displayName
    ) {
      this.slug =
        normalizeMarketplaceSlug(
          this.displayName,
        );
    }

    next();
  },
);

marketplaceOrganizationSchema.index(
  {
    slug:
      1,
  },
  {
    unique:
      true,
  },
);

marketplaceOrganizationSchema.index({
  ownerUserId:
    1,

  status:
    1,
});

/*
|--------------------------------------------------------------------------
| Host Offer
|--------------------------------------------------------------------------
|
| Commercial listing against a canonical M04 Pack.
|
| IMPORTANT:
|
| This schema intentionally does NOT copy:
|
| Product name
| ingredients
| allergens
| nutrition
| manufacturer facts
|
| Those remain canonical M04 ProductVersion facts.
|--------------------------------------------------------------------------
*/

const hostOfferSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          "MarketplaceOrganization",

        required:
          true,

        index:
          true,
      },

      packId: {
        type:
          objectId,

        ref:
          "Pack",

        required:
          true,

        index:
          true,
      },

      merchantSku: {
        type:
          String,

        trim:
          true,

        maxlength:
          180,

        default:
          "",
      },

      offerKey: {
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

      status: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_OFFER_STATUSES,

        default:
          "draft",
      },

      fulfillmentTypes: {
        type: [
          {
            type:
              String,

            enum:
              MARKETPLACE_FULFILLMENT_TYPES,
          },
        ],

        default: [
          "delivery",
        ],
      },

      minimumOrderQuantity: {
        type:
          Number,

        min:
          1,

        default:
          1,

        validate: {
          validator(
            value,
          ) {
            return Number.isInteger(
              value,
            );
          },

          message:
            "Minimum order quantity must be an integer.",
        },
      },

      maximumOrderQuantity: {
        type:
          Number,

        min:
          1,

        default:
          null,

        validate: {
          validator(
            value,
          ) {
            return (
              value ===
                null ||
              Number.isInteger(
                value,
              )
            );
          },

          message:
            "Maximum order quantity must be an integer.",
        },
      },

      externalReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          250,

        default:
          "",
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    baseSchemaOptions,
  );

hostOfferSchema.pre(
  "validate",
  function normalizeHostOfferKey(
    next,
  ) {
    if (
      !this.offerKey
    ) {
      this.offerKey =
        normalizeMarketplaceKey(
          this.merchantSku ||
            String(
              this.packId ||
                "",
            ),
        );
    }

    next();
  },
);

hostOfferSchema.path(
  "maximumOrderQuantity",
).validate(
  function validateMaximumOrderQuantity(
    value,
  ) {
    if (
      value ===
      null ||
      value ===
      undefined
    ) {
      return true;
    }

    return (
      value >=
      this.minimumOrderQuantity
    );
  },
  "Maximum order quantity cannot be lower than minimum order quantity.",
);

hostOfferSchema.index(
  {
    organizationId:
      1,

    packId:
      1,
  },
  {
    unique:
      true,

    /*
    |--------------------------------------------------------------------------
    | Only current commercial listings participate in uniqueness.
    |--------------------------------------------------------------------------
    |
    | Retired Offers are immutable historical records. A Host must be able to
    | re-list the same canonical Pack later without deleting that history.
    |
    */

    partialFilterExpression: {
      status: {
        $in: [
          "draft",
          "active",
          "paused",
        ],
      },
    },
  },
);

hostOfferSchema.index(
  {
    organizationId:
      1,

    merchantSku:
      1,
  },
  {
    unique:
      true,

    partialFilterExpression: {
      status: {
        $in: [
          "draft",
          "active",
          "paused",
        ],
      },

      merchantSku: {
        $type:
          "string",

        $gt:
          "",
      },
    },
  },
);

hostOfferSchema.index({
  packId:
    1,

  status:
    1,
});

/*
|--------------------------------------------------------------------------
| Price Rule
|--------------------------------------------------------------------------
|
| Price is commercial state and therefore belongs here, never ProductVersion.
|
| Historical/effective-dated rules are retained.
|--------------------------------------------------------------------------
*/

const priceRuleSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          "MarketplaceOrganization",

        required:
          true,

        index:
          true,
      },

      offerId: {
        type:
          objectId,

        ref:
          "HostOffer",

        required:
          true,

        index:
          true,
      },

      listPrice: {
        type:
          moneySchema,

        required:
          true,
      },

      salePrice: {
        type:
          moneySchema,

        default:
          null,
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_PRICE_RULE_STATUSES,

        default:
          "scheduled",
      },

      effectiveFrom: {
        type:
          Date,

        required:
          true,
      },

      effectiveTo: {
        type:
          Date,

        default:
          null,
      },

      source: {
        type:
          String,

        trim:
          true,

        maxlength:
          120,

        default:
          "manual",
      },

      changeReason: {
        type:
          String,

        trim:
          true,

        maxlength:
          2000,

        default:
          "",
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    baseSchemaOptions,
  );

priceRuleSchema.path(
  "salePrice",
).validate(
  function validateSalePriceCurrency(
    value,
  ) {
    if (
      !value ||
      !this.listPrice
    ) {
      return true;
    }

    return (
      value.currency ===
      this.listPrice.currency
    );
  },
  "Sale price currency must match list price currency.",
);

priceRuleSchema.path(
  "salePrice",
).validate(
  function validateSalePriceAmount(
    value,
  ) {
    if (
      !value ||
      !this.listPrice
    ) {
      return true;
    }

    return (
      value.amountMinor <=
      this.listPrice.amountMinor
    );
  },
  "Sale price cannot exceed list price.",
);

priceRuleSchema.path(
  "effectiveTo",
).validate(
  function validateEffectiveDateRange(
    value,
  ) {
    if (
      !value
    ) {
      return true;
    }

    return (
      value >
      this.effectiveFrom
    );
  },
  "Price rule effectiveTo must be later than effectiveFrom.",
);

priceRuleSchema.index({
  offerId:
    1,

  effectiveFrom:
    -1,

  effectiveTo:
    1,
});

priceRuleSchema.index({
  organizationId:
    1,

  status:
    1,

  effectiveFrom:
    -1,
});

/*
|--------------------------------------------------------------------------
| Inventory Node
|--------------------------------------------------------------------------
|
| Physical / logical fulfillment location owned by a Host organization.
|--------------------------------------------------------------------------
*/

const inventoryNodeSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          "MarketplaceOrganization",

        required:
          true,

        index:
          true,
      },

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          220,
      },

      nodeKey: {
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

      nodeType: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_INVENTORY_NODE_TYPES,

        default:
          "warehouse",
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_INVENTORY_NODE_STATUSES,

        default:
          "active",
      },

      address: {
        line1: {
          type:
            String,

          trim:
            true,

          maxlength:
            250,

          default:
            "",
        },

        line2: {
          type:
            String,

          trim:
            true,

          maxlength:
            250,

          default:
            "",
        },

        city: {
          type:
            String,

          trim:
            true,

          maxlength:
            120,

          default:
            "",
        },

        state: {
          type:
            String,

          trim:
            true,

          maxlength:
            120,

          default:
            "",
        },

        postalCode: {
          type:
            String,

          trim:
            true,

          maxlength:
            20,

          default:
            "",
        },

        countryCode: {
          type:
            String,

          trim:
            true,

          uppercase:
            true,

          maxlength:
            2,

          default:
            "IN",
        },
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    baseSchemaOptions,
  );

inventoryNodeSchema.pre(
  "validate",
  function normalizeInventoryNode(
    next,
  ) {
    if (
      !this.nodeKey &&
      this.name
    ) {
      this.nodeKey =
        normalizeMarketplaceKey(
          this.name,
        );
    }

    if (
      this.address?.postalCode
    ) {
      this.address.postalCode =
        normalizePostalCode(
          this.address.postalCode,
        );
    }

    next();
  },
);

inventoryNodeSchema.index(
  {
    organizationId:
      1,

    nodeKey:
      1,
  },
  {
    unique:
      true,
  },
);

/*
|--------------------------------------------------------------------------
| Inventory Snapshot
|--------------------------------------------------------------------------
|
| Inventory is append-only observation history.
|
| Current availability is derived from the newest valid snapshot.
|--------------------------------------------------------------------------
*/

const inventorySnapshotSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          "MarketplaceOrganization",

        required:
          true,

        index:
          true,
      },

      offerId: {
        type:
          objectId,

        ref:
          "HostOffer",

        required:
          true,

        index:
          true,
      },

      inventoryNodeId: {
        type:
          objectId,

        ref:
          "InventoryNode",

        required:
          true,

        index:
          true,
      },

      availableQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        validate: {
          validator(
            value,
          ) {
            return Number.isInteger(
              value,
            );
          },

          message:
            "Available inventory quantity must be an integer.",
        },
      },

      reservedQuantity: {
        type:
          Number,

        required:
          true,

        min:
          0,

        default:
          0,

        validate: {
          validator(
            value,
          ) {
            return Number.isInteger(
              value,
            );
          },

          message:
            "Reserved inventory quantity must be an integer.",
        },
      },

      sourceType: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_INVENTORY_SOURCE_TYPES,

        default:
          "manual",
      },

      sourceReference: {
        type:
          String,

        trim:
          true,

        maxlength:
          250,

        default:
          "",
      },

      observedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    {
      ...baseSchemaOptions,

      /*
      |--------------------------------------------------------------------------
      | Snapshot history is immutable application data.
      |--------------------------------------------------------------------------
      */

      timestamps: {
        createdAt:
          true,

        updatedAt:
          false,
      },
    },
  );

inventorySnapshotSchema.path(
  "reservedQuantity",
).validate(
  function validateReservedQuantity(
    value,
  ) {
    return (
      value <=
      this.availableQuantity
    );
  },
  "Reserved quantity cannot exceed available quantity.",
);

inventorySnapshotSchema.index({
  offerId:
    1,

  inventoryNodeId:
    1,

  observedAt:
    -1,
});

inventorySnapshotSchema.index({
  organizationId:
    1,

  observedAt:
    -1,
});

/*
|--------------------------------------------------------------------------
| Service Area
|--------------------------------------------------------------------------
|
| Defines where an Organization / Inventory Node can serve customers.
|
| Postal codes are explicit. M05 does not guess customer serviceability.
|--------------------------------------------------------------------------
*/

const serviceAreaSchema =
  new Schema(
    {
      organizationId: {
        type:
          objectId,

        ref:
          "MarketplaceOrganization",

        required:
          true,

        index:
          true,
      },

      inventoryNodeId: {
        type:
          objectId,

        ref:
          "InventoryNode",

        default:
          null,

        index:
          true,
      },

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          220,
      },

      serviceAreaKey: {
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

      postalCodes: {
        type: [
          {
            type:
              String,

            trim:
              true,

            maxlength:
              20,
          },
        ],

        default:
          [],
      },

      fulfillmentTypes: {
        type: [
          {
            type:
              String,

            enum:
              MARKETPLACE_FULFILLMENT_TYPES,
          },
        ],

        default: [
          "delivery",
        ],
      },

      status: {
        type:
          String,

        required:
          true,

        enum:
          MARKETPLACE_SERVICE_AREA_STATUSES,

        default:
          "active",
      },

      createdByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },

      updatedByUserId: {
        type:
          objectId,

        ref:
          "User",

        default:
          null,
      },
    },
    baseSchemaOptions,
  );

serviceAreaSchema.pre(
  "validate",
  function normalizeServiceArea(
    next,
  ) {
    if (
      !this.serviceAreaKey &&
      this.name
    ) {
      this.serviceAreaKey =
        normalizeMarketplaceKey(
          this.name,
        );
    }

    this.postalCodes = [
      ...new Set(
        (
          this.postalCodes ||
          []
        )
          .map(
            normalizePostalCode,
          )
          .filter(
            Boolean,
          ),
      ),
    ];

    next();
  },
);

serviceAreaSchema.index(
  {
    organizationId:
      1,

    serviceAreaKey:
      1,
  },
  {
    unique:
      true,
  },
);

serviceAreaSchema.index({
  organizationId:
    1,

  postalCodes:
    1,

  status:
    1,
});

/*
|--------------------------------------------------------------------------
| Model Registration
|--------------------------------------------------------------------------
*/

export const MarketplaceOrganization =
  mongoose.models
    .MarketplaceOrganization ||
  mongoose.model(
    "MarketplaceOrganization",
    marketplaceOrganizationSchema,
    "organizations",
  );

export const HostOffer =
  mongoose.models.HostOffer ||
  mongoose.model(
    "HostOffer",
    hostOfferSchema,
    "sellerOffers",
  );

export const PriceRule =
  mongoose.models.PriceRule ||
  mongoose.model(
    "PriceRule",
    priceRuleSchema,
    "priceRules",
  );

export const InventoryNode =
  mongoose.models.InventoryNode ||
  mongoose.model(
    "InventoryNode",
    inventoryNodeSchema,
    "inventoryNodes",
  );

export const InventorySnapshot =
  mongoose.models
    .InventorySnapshot ||
  mongoose.model(
    "InventorySnapshot",
    inventorySnapshotSchema,
    "inventorySnapshots",
  );

export const ServiceArea =
  mongoose.models.ServiceArea ||
  mongoose.model(
    "ServiceArea",
    serviceAreaSchema,
    "serviceAreas",
  );

export const marketplaceModels =
  Object.freeze({
    MarketplaceOrganization,
    HostOffer,
    PriceRule,
    InventoryNode,
    InventorySnapshot,
    ServiceArea,
  });