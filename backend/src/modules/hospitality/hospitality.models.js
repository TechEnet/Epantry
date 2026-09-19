import mongoose from 'mongoose'

import {
  RECIPE_UNITS,
} from '../recipes/recipe.constants.js'

const {
  Schema,
} = mongoose

const objectId =
  Schema.Types.ObjectId

const baseOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
  versionKey: false,
})

export const HOSPITALITY_PERMISSION_KEYS = Object.freeze([
  'hospitality.read',
  'hospitality.outlets.manage',
  'hospitality.members.manage',
  'hospitality.suppliers.read',
  'hospitality.suppliers.manage',
  'hospitality.recipes.read',
  'hospitality.recipes.manage',
  'hospitality.recipes.approve',
  'hospitality.procurement.read',
  'hospitality.procurement.manage',
  'hospitality.costing.read',
  'hospitality.passports.read',
  'hospitality.passports.generate',
  'hospitality.passports.approve',
  'hospitality.grey_book.read',
  'hospitality.grey_book.generate',
  'hospitality.change.read',
  'hospitality.change.manage',
  'hospitality.change.approve',
])

export const HOSPITALITY_OUTLET_STATUSES = Object.freeze([
  'active',
  'disabled',
])

export const HOSPITALITY_SUPPLIER_STATUSES = Object.freeze([
  'active',
  'disabled',
])

export const HOSPITALITY_SUPPLIER_PRODUCT_STATUSES = Object.freeze([
  'active',
  'disabled',
  'expired',
])

export const HOSPITALITY_PRODUCTION_RECIPE_STATUSES = Object.freeze([
  'draft',
  'in_review',
  'approved',
  'retired',
])

export const HOSPITALITY_MENU_STATUSES = Object.freeze([
  'draft',
  'active',
  'retired',
])

export const HOSPITALITY_PRODUCTION_PLAN_STATUSES = Object.freeze([
  'draft',
  'calculated',
  'approved',
  'cancelled',
])

export const HOSPITALITY_PROCUREMENT_PLAN_STATUSES = Object.freeze([
  'draft',
  'reviewed',
  'approved',
  'exported',
  'cancelled',
])

const moneySchema = new Schema(
  {
    amountMinor: {
      type: Number,
      required: true,
      min: 0,

      validate: {
        validator(value) {
          return Number.isInteger(value)
        },

        message:
          'Money must be stored as integer minor units.',
      },
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'INR',
    },
  },
  {
    _id: false,
  },
)

const quantitySchema = new Schema(
  {
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      enum: RECIPE_UNITS,
    },
  },
  {
    _id: false,
  },
)

/*
|--------------------------------------------------------------------------
| Hospitality Profile
|--------------------------------------------------------------------------
|
| This does NOT replace MarketplaceOrganization.
|
| MarketplaceOrganization remains the commercial/business tenant.
| HospitalityProfile is only the M18 operational overlay.
|--------------------------------------------------------------------------
*/

const hospitalityProfileSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        'active',
        'disabled',
      ],
      default: 'active',
      index: true,
    },

    defaultCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'INR',
    },

    measurementSystem: {
      type: String,
      enum: [
        'metric',
      ],
      default: 'metric',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityProfiles',
  },
)

/*
|--------------------------------------------------------------------------
| Outlet / Kitchen / Cost Center
|--------------------------------------------------------------------------
*/

const hospitalityOutletSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    status: {
      type: String,
      enum: HOSPITALITY_OUTLET_STATUSES,
      default: 'active',
      index: true,
    },

    inheritanceMode: {
      type: String,
      enum: [
        'inherit_org_defaults',
        'custom',
      ],
      default: 'inherit_org_defaults',
    },

    kitchenName: {
      type: String,
      trim: true,
      maxlength: 220,
      default: '',
    },

    costCenterCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      default: '',
    },

    timezone: {
      type: String,
      trim: true,
      maxlength: 80,
      default: 'Asia/Kolkata',
    },

    address: {
      line1: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      line2: {
        type: String,
        trim: true,
        maxlength: 300,
        default: '',
      },

      city: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },

      state: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
      },

      postalCode: {
        type: String,
        trim: true,
        maxlength: 20,
        default: '',
      },

      countryCode: {
        type: String,
        trim: true,
        uppercase: true,
        minlength: 2,
        maxlength: 2,
        default: 'IN',
      },
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityOutlets',
  },
)

hospitalityOutletSchema.index(
  {
    organizationId: 1,
    outletCode: 1,
  },
  {
    unique: true,
  },
)

/*
|--------------------------------------------------------------------------
| Hospitality Member Grant
|--------------------------------------------------------------------------
|
| B2B operator/chef/procurement/etc are NOT application roles.
|
| They are active Host identities with organization + outlet-scoped
| Hospitality permissions.
|--------------------------------------------------------------------------
*/

const hospitalityMemberGrantSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    userId: {
      type: objectId,
      ref: 'User',
      required: true,
      index: true,
    },

    permissionKeys: {
      type: [
        {
          type: String,
          enum: HOSPITALITY_PERMISSION_KEYS,
        },
      ],
      required: true,
      default: [],
    },

    /*
    | Empty outletIds means organization-wide Hospitality scope.
    */

    outletIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityOutlet',
        },
      ],
      default: [],
    },

    status: {
      type: String,
      enum: [
        'active',
        'revoked',
      ],
      default: 'active',
      index: true,
    },

    grantedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    revokedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    reason: {
      type: String,
      trim: true,
      maxlength: 1500,
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityMemberGrants',
  },
)

hospitalityMemberGrantSchema.index(
  {
    organizationId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
)

/*
|--------------------------------------------------------------------------
| Supplier
|--------------------------------------------------------------------------
*/

const hospitalitySupplierSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    supplierCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    status: {
      type: String,
      enum: HOSPITALITY_SUPPLIER_STATUSES,
      default: 'active',
      index: true,
    },

    leadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 0,
    },

    /*
    | Empty list means organization-wide supplier.
    */

    serviceOutletIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityOutlet',
        },
      ],
      default: [],
    },

    contact: {
      name: {
        type: String,
        trim: true,
        maxlength: 160,
        default: '',
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: '',
      },

      phone: {
        type: String,
        trim: true,
        maxlength: 40,
        default: '',
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: '',
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalitySuppliers',
  },
)

hospitalitySupplierSchema.index(
  {
    organizationId: 1,
    supplierCode: 1,
  },
  {
    unique: true,
  },
)

/*
|--------------------------------------------------------------------------
| Supplier Product / Contract Overlay
|--------------------------------------------------------------------------
|
| This is commercial Hospitality truth.
|
| It never overwrites:
|
| ProductVersion
| Pack
| CanonicalIngredient
| HostOffer
| PriceRule
| InventorySnapshot
|--------------------------------------------------------------------------
*/

const hospitalitySupplierProductSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    supplierId: {
      type: objectId,
      ref: 'HospitalitySupplier',
      required: true,
      index: true,
    },

    supplierSku: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    /*
    | Contract facts are versioned instead of overwriting old contract price.
    */

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    canonicalPackId: {
      type: objectId,
      ref: 'Pack',
      default: null,
      index: true,
    },

    canonicalIngredientId: {
      type: objectId,
      ref: 'CanonicalIngredient',
      default: null,
      index: true,
    },

    localDescription: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    packQuantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    packUnit: {
      type: String,
      enum: RECIPE_UNITS,
      required: true,
    },

    contractCost: {
      type: moneySchema,
      required: true,
    },

    minimumOrderPacks: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    leadTimeDays: {
      type: Number,
      min: 0,
      max: 365,
      default: 0,
    },

    status: {
      type: String,
      enum: HOSPITALITY_SUPPLIER_PRODUCT_STATUSES,
      default: 'active',
      index: true,
    },

    effectiveFrom: {
      type: Date,
      default: null,
      index: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalitySupplierProducts',
  },
)

hospitalitySupplierProductSchema.index(
  {
    organizationId: 1,
    supplierId: 1,
    supplierSku: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

hospitalitySupplierProductSchema.pre(
  'validate',
  function validateSupplierProductCanonicalLink() {
    if (
      !this.canonicalPackId &&
      !this.canonicalIngredientId
    ) {
      this.invalidate(
        'canonicalIngredientId',
        'Supplier Product must map to a canonical Pack or Ingredient.',
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
        'Supplier Product effectiveTo must be after effectiveFrom.',
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Production Recipe Version
|--------------------------------------------------------------------------
|
| Tenant operational recipe.
|
| Optional source M07 Dish / RecipeVersion gives canonical lineage.
| M18 never edits that M07 RecipeVersion.
|--------------------------------------------------------------------------
*/

const hospitalityProductionRecipeVersionSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    recipeKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },

    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    dishId: {
      type: objectId,
      ref: 'Dish',
      default: null,
      index: true,
    },

    sourceRecipeVersionId: {
      type: objectId,
      ref: 'RecipeVersion',
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    baseYieldPortions: {
      type: Number,
      required: true,
      min: 1,
      max: 100000,
    },

    finishedYield: {
      type: quantitySchema,
      default: null,
    },

    productionUnit: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'portion',
    },

    status: {
      type: String,
      enum: HOSPITALITY_PRODUCTION_RECIPE_STATUSES,
      default: 'draft',
      index: true,
    },

    changeReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },

    effectiveFrom: {
      type: Date,
      default: null,
      index: true,
    },

    effectiveTo: {
      type: Date,
      default: null,
      index: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    submittedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    retiredAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityProductionRecipeVersions',
  },
)

hospitalityProductionRecipeVersionSchema.index(
  {
    organizationId: 1,
    recipeKey: 1,
    versionNumber: 1,
  },
  {
    unique: true,
  },
)

hospitalityProductionRecipeVersionSchema.pre(
  'validate',
  function validateProductionRecipeDates() {
    if (
      this.effectiveFrom &&
      this.effectiveTo &&
      this.effectiveFrom >=
        this.effectiveTo
    ) {
      this.invalidate(
        'effectiveTo',
        'Production Recipe effectiveTo must be after effectiveFrom.',
      )
    }
  },
)

/*
|--------------------------------------------------------------------------
| Production Recipe Ingredient
|--------------------------------------------------------------------------
|
| quantity = net authored requirement at base yield.
|
| expectedWastePercentage is explicit operational assumption.
|
| Gross procurement requirement is calculated from these values.
|--------------------------------------------------------------------------
*/

const hospitalityProductionRecipeIngredientSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    productionRecipeVersionId: {
      type: objectId,
      ref: 'HospitalityProductionRecipeVersion',
      required: true,
      index: true,
    },

    lineNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    canonicalIngredientId: {
      type: objectId,
      ref: 'CanonicalIngredient',
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    unit: {
      type: String,
      enum: RECIPE_UNITS,
      required: true,
    },

    expectedWastePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 95,
      default: 0,
    },

    preferredSupplierProductId: {
      type: objectId,
      ref: 'HospitalitySupplierProduct',
      default: null,
      index: true,
    },

    optional: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityProductionRecipeIngredients',
  },
)

hospitalityProductionRecipeIngredientSchema.index(
  {
    productionRecipeVersionId: 1,
    lineNumber: 1,
  },
  {
    unique: true,
  },
)

/*
|--------------------------------------------------------------------------
| Menu
|--------------------------------------------------------------------------
*/

const hospitalityMenuSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      required: true,
      index: true,
    },

    menuCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    status: {
      type: String,
      enum: HOSPITALITY_MENU_STATUSES,
      default: 'draft',
      index: true,
    },

    effectiveFrom: {
      type: Date,
      default: null,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    updatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityMenus',
  },
)

hospitalityMenuSchema.index(
  {
    organizationId: 1,
    outletId: 1,
    menuCode: 1,
  },
  {
    unique: true,
  },
)

const hospitalityMenuItemSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    menuId: {
      type: objectId,
      ref: 'HospitalityMenu',
      required: true,
      index: true,
    },

    productionRecipeVersionId: {
      type: objectId,
      ref: 'HospitalityProductionRecipeVersion',
      required: true,
      index: true,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    sellingPrice: {
      type: moneySchema,
      default: null,
    },

    status: {
      type: String,
      enum: [
        'active',
        'disabled',
      ],
      default: 'active',
      index: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityMenuItems',
  },
)

hospitalityMenuItemSchema.index(
  {
    menuId: 1,
    productionRecipeVersionId: 1,
  },
  {
    unique: true,
  },
)

/*
|--------------------------------------------------------------------------
| Recipe Cost Snapshot
|--------------------------------------------------------------------------
|
| Snapshot preserves Supplier contract facts actually used for costing.
|--------------------------------------------------------------------------
*/

const hospitalityRecipeCostSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      default: null,
      index: true,
    },

    productionRecipeVersionId: {
      type: objectId,
      ref: 'HospitalityProductionRecipeVersion',
      required: true,
      index: true,
    },

    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'INR',
    },

    totalCostMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    costPerPortionMinor: {
      type: Number,
      required: true,
      min: 0,
    },

    lines: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    calculatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    calculatedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityRecipeCosts',
  },
)

/*
|--------------------------------------------------------------------------
| Outlet Stock Observation
|--------------------------------------------------------------------------
|
| Append-only operational evidence.
|
| Production planning reads the latest observation. It does NOT pretend this
| is M05 warehouse inventory or mutate M05 InventorySnapshot.
|--------------------------------------------------------------------------
*/

const hospitalityStockObservationSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      required: true,
      index: true,
    },

    canonicalIngredientId: {
      type: objectId,
      ref: 'CanonicalIngredient',
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      enum: RECIPE_UNITS,
      required: true,
    },

    source: {
      type: String,
      enum: [
        'manual_count',
        'import',
        'integration',
      ],
      required: true,
      default: 'manual_count',
    },

    observedAt: {
      type: Date,
      required: true,
      index: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    observedByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityStockObservations',
  },
)

hospitalityStockObservationSchema.index({
  organizationId: 1,
  outletId: 1,
  canonicalIngredientId: 1,
  observedAt: -1,
})

const productionPlanItemSchema = new Schema(
  {
    productionRecipeVersionId: {
      type: objectId,
      ref: 'HospitalityProductionRecipeVersion',
      required: true,
    },

    portions: {
      type: Number,
      required: true,
      min: 1,
      max: 1000000,
    },
  },
  {
    _id: false,
  },
)

/*
|--------------------------------------------------------------------------
| Production Plan
|--------------------------------------------------------------------------
*/

const hospitalityProductionPlanSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletId: {
      type: objectId,
      ref: 'HospitalityOutlet',
      required: true,
      index: true,
    },

    planDate: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: HOSPITALITY_PRODUCTION_PLAN_STATUSES,
      default: 'draft',
      index: true,
    },

    items: {
      type: [productionPlanItemSchema],
      required: true,
      default: [],
    },

    grossRequirements: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    stockReconciliation: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    netRequirements: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    calculationVersion: {
      type: String,
      required: true,
      default: 'm18-v1',
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },

    calculatedByUserId: {
      type: objectId,
      ref: 'User',
      default: null,
    },

    calculatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityProductionPlans',
  },
)

/*
|--------------------------------------------------------------------------
| Procurement Plan
|--------------------------------------------------------------------------
|
| Plan compares known contract costs.
|
| It explicitly does NOT submit a Purchase Order automatically.
|--------------------------------------------------------------------------
*/

const hospitalityProcurementPlanSchema = new Schema(
  {
    organizationId: {
      type: objectId,
      ref: 'MarketplaceOrganization',
      required: true,
      index: true,
    },

    outletIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityOutlet',
        },
      ],
      required: true,
      default: [],
    },

    productionPlanIds: {
      type: [
        {
          type: objectId,
          ref: 'HospitalityProductionPlan',
        },
      ],
      required: true,
      default: [],
    },

    status: {
      type: String,
      enum: HOSPITALITY_PROCUREMENT_PLAN_STATUSES,
      default: 'draft',
      index: true,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'INR',
    },

    lines: {
      type: [Schema.Types.Mixed],
      required: true,
      default: [],
    },

    totalExpectedCostMinor: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    supplierSelectionPolicy: {
      type: String,
      enum: [
        'lowest_known_contract_cost',
      ],
      default: 'lowest_known_contract_cost',
    },

    automaticPurchaseOrderSubmission: {
      type: Boolean,
      required: true,
      default: false,
      immutable: true,
    },

    createdByUserId: {
      type: objectId,
      ref: 'User',
      required: true,
    },
  },
  {
    ...baseOptions,
    collection: 'hospitalityProcurementPlans',
  },
)

export const HospitalityProfile =
  mongoose.models.HospitalityProfile ||
  mongoose.model(
    'HospitalityProfile',
    hospitalityProfileSchema,
  )

export const HospitalityOutlet =
  mongoose.models.HospitalityOutlet ||
  mongoose.model(
    'HospitalityOutlet',
    hospitalityOutletSchema,
  )

export const HospitalityMemberGrant =
  mongoose.models.HospitalityMemberGrant ||
  mongoose.model(
    'HospitalityMemberGrant',
    hospitalityMemberGrantSchema,
  )

export const HospitalitySupplier =
  mongoose.models.HospitalitySupplier ||
  mongoose.model(
    'HospitalitySupplier',
    hospitalitySupplierSchema,
  )

export const HospitalitySupplierProduct =
  mongoose.models.HospitalitySupplierProduct ||
  mongoose.model(
    'HospitalitySupplierProduct',
    hospitalitySupplierProductSchema,
  )

export const HospitalityProductionRecipeVersion =
  mongoose.models.HospitalityProductionRecipeVersion ||
  mongoose.model(
    'HospitalityProductionRecipeVersion',
    hospitalityProductionRecipeVersionSchema,
  )

export const HospitalityProductionRecipeIngredient =
  mongoose.models.HospitalityProductionRecipeIngredient ||
  mongoose.model(
    'HospitalityProductionRecipeIngredient',
    hospitalityProductionRecipeIngredientSchema,
  )

export const HospitalityMenu =
  mongoose.models.HospitalityMenu ||
  mongoose.model(
    'HospitalityMenu',
    hospitalityMenuSchema,
  )

export const HospitalityMenuItem =
  mongoose.models.HospitalityMenuItem ||
  mongoose.model(
    'HospitalityMenuItem',
    hospitalityMenuItemSchema,
  )

export const HospitalityRecipeCost =
  mongoose.models.HospitalityRecipeCost ||
  mongoose.model(
    'HospitalityRecipeCost',
    hospitalityRecipeCostSchema,
  )

export const HospitalityStockObservation =
  mongoose.models.HospitalityStockObservation ||
  mongoose.model(
    'HospitalityStockObservation',
    hospitalityStockObservationSchema,
  )

export const HospitalityProductionPlan =
  mongoose.models.HospitalityProductionPlan ||
  mongoose.model(
    'HospitalityProductionPlan',
    hospitalityProductionPlanSchema,
  )

export const HospitalityProcurementPlan =
  mongoose.models.HospitalityProcurementPlan ||
  mongoose.model(
    'HospitalityProcurementPlan',
    hospitalityProcurementPlanSchema,
  )