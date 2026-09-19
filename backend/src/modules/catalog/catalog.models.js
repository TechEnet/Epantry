import mongoose from "mongoose";

import {
  CATALOG_ENTITY_STATUSES,
  CATALOG_ENTITY_TYPES,
  CATALOG_EVIDENCE_SOURCE_TYPES,
  CATALOG_EVIDENCE_STATES,
  CATALOG_EXTRACTION_METHODS,
  CATALOG_PUBLICATION_STATUSES,
  NUTRITION_BASIS_TYPES,
  PRODUCT_ALLERGEN_RELATION_TYPES,
  PRODUCT_PACK_TYPES,
  PRODUCT_QUANTITY_UNITS,
  normalizeCatalogSlug,
} from "./catalog.constants.js";

const { Schema } = mongoose;

const baseSchemaOptions = Object.freeze({
  timestamps: true,
  strict: true,
  minimize: false,
});

const objectId = Schema.Types.ObjectId;

/*
|--------------------------------------------------------------------------
| Shared Subdocuments
|--------------------------------------------------------------------------
*/

const quantitySchema = new Schema(
  {
    value: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      enum: PRODUCT_QUANTITY_UNITS,
    },
  },
  {
    _id: false,
  },
);

const provenanceSchema = new Schema(
  {
    fieldPath: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    evidenceSourceId: {
      type: objectId,
      ref: "EvidenceSource",
      default: null,
    },

    evidenceState: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_STATES,
      default: "unknown_review_required",
    },

    extractionMethod: {
      type: String,
      enum: CATALOG_EXTRACTION_METHODS,
      default: "manual",
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    reviewedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
  },
);

const productIngredientSchema = new Schema(
  {
    ingredientId: {
      type: objectId,
      ref: "CanonicalIngredient",
      default: null,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    order: {
      type: Number,
      required: true,
      min: 0,
    },

    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    _id: true,
  },
);

const nutritionEntrySchema = new Schema(
  {
    nutrientKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
  },
  {
    _id: false,
  },
);

const nutritionSchema = new Schema(
  {
    basis: {
      type: String,
      enum: NUTRITION_BASIS_TYPES,
      default: null,
    },

    servingSize: {
      type: quantitySchema,
      default: null,
    },

    nutrients: {
      type: [nutritionEntrySchema],
      default: [],
    },
  },
  {
    _id: false,
  },
);

const allergenSchema = new Schema(
  {
    allergenKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    relationType: {
      type: String,
      required: true,
      enum: PRODUCT_ALLERGEN_RELATION_TYPES,
    },

    evidenceState: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_STATES,
      default: "unknown_review_required",
    },
  },
  {
    _id: false,
  },
);

const claimSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    evidenceState: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_STATES,
      default: "unknown_review_required",
    },
  },
  {
    _id: false,
  },
);

const certificationSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },

    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    certificateReference: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    evidenceState: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_STATES,
      default: "unknown_review_required",
    },
  },
  {
    _id: false,
  },
);

const imageSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    alt: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },

    evidenceSourceId: {
      type: objectId,
      ref: "EvidenceSource",
      default: null,
    },

    sortOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: true,
  },
);

/*
|--------------------------------------------------------------------------
| Brand
|--------------------------------------------------------------------------
*/

const brandSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    aliases: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },

    websiteUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    logoUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

brandSchema.pre("validate", function normalizeBrandSlug(next) {
  if (!this.slug && this.name) {
    this.slug = normalizeCatalogSlug(this.name);
  }

  next();
});

brandSchema.index(
  {
    slug: 1,
  },
  {
    unique: true,
  },
);

brandSchema.index({
  status: 1,
  name: 1,
});

/*
|--------------------------------------------------------------------------
| Category
|--------------------------------------------------------------------------
*/

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    parentId: {
      type: objectId,
      ref: "Category",
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

categorySchema.pre("validate", function normalizeCategorySlug(next) {
  if (!this.slug && this.name) {
    this.slug = normalizeCatalogSlug(this.name);
  }

  next();
});

categorySchema.index(
  {
    slug: 1,
  },
  {
    unique: true,
  },
);

categorySchema.index({
  parentId: 1,
  status: 1,
  sortOrder: 1,
});

/*
|--------------------------------------------------------------------------
| Product Family
|--------------------------------------------------------------------------
*/

const productFamilySchema = new Schema(
  {
    brandId: {
      type: objectId,
      ref: "Brand",
      required: true,
      index: true,
    },

    categoryId: {
      type: objectId,
      ref: "Category",
      required: true,
      index: true,
    },

    canonicalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 280,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

productFamilySchema.pre(
  "validate",
  function normalizeProductFamilySlug(next) {
    if (!this.slug && this.canonicalName) {
      this.slug = normalizeCatalogSlug(this.canonicalName);
    }

    next();
  },
);

productFamilySchema.index(
  {
    brandId: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

productFamilySchema.index({
  categoryId: 1,
  status: 1,
  canonicalName: 1,
});

/*
|--------------------------------------------------------------------------
| Product Variant
|--------------------------------------------------------------------------
*/

const productVariantSchema = new Schema(
  {
    familyId: {
      type: objectId,
      ref: "ProductFamily",
      required: true,
      index: true,
    },

    canonicalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    variantKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    market: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: "IN",
    },

    flavor: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    formulationKey: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },

    packForm: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

productVariantSchema.index(
  {
    familyId: 1,
    variantKey: 1,
  },
  {
    unique: true,
  },
);

productVariantSchema.index({
  familyId: 1,
  status: 1,
  canonicalName: 1,
});

/*
|--------------------------------------------------------------------------
| Pack
|--------------------------------------------------------------------------
*/

const packSchema = new Schema(
  {
    variantId: {
      type: objectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },

    packKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    packType: {
      type: String,
      enum: PRODUCT_PACK_TYPES,
      default: "other",
    },

    multipackCount: {
      type: Number,
      integer: true,
      min: 1,
      default: 1,
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

packSchema.index(
  {
    variantId: 1,
    packKey: 1,
  },
  {
    unique: true,
  },
);

packSchema.index({
  variantId: 1,
  status: 1,
});

/*
|--------------------------------------------------------------------------
| Canonical Ingredient
|--------------------------------------------------------------------------
*/

const canonicalIngredientSchema = new Schema(
  {
    canonicalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 250,
    },

    aliases: {
      type: [String],
      default: [],
    },

    parentId: {
      type: objectId,
      ref: "CanonicalIngredient",
      default: null,
    },

    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },

    status: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_STATUSES,
      default: "active",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    updatedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

canonicalIngredientSchema.pre(
  "validate",
  function normalizeIngredientSlug(next) {
    if (!this.slug && this.canonicalName) {
      this.slug = normalizeCatalogSlug(this.canonicalName);
    }

    next();
  },
);

canonicalIngredientSchema.index(
  {
    slug: 1,
  },
  {
    unique: true,
  },
);

canonicalIngredientSchema.index({
  aliases: 1,
});

canonicalIngredientSchema.index({
  parentId: 1,
  status: 1,
});

/*
|--------------------------------------------------------------------------
| Evidence Source
|--------------------------------------------------------------------------
*/

const evidenceSourceSchema = new Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: CATALOG_ENTITY_TYPES,
    },

    entityId: {
      type: objectId,
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_SOURCE_TYPES,
    },

    sourceName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    sourceUri: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    externalReference: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    checksum: {
      type: String,
      trim: true,
      maxlength: 256,
      default: "",
    },

    evidenceState: {
      type: String,
      required: true,
      enum: CATALOG_EVIDENCE_STATES,
      default: "unknown_review_required",
    },

    capturedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  baseSchemaOptions,
);

evidenceSourceSchema.index({
  entityType: 1,
  entityId: 1,
  capturedAt: -1,
});

evidenceSourceSchema.index({
  checksum: 1,
});

/*
|--------------------------------------------------------------------------
| Product Version
|--------------------------------------------------------------------------
|
| This is canonical product truth.
|
| IMPORTANT:
| price, stock, sellerId, inventory and commercial offers DO NOT belong
| in this schema. Those are handled by the commercial offer domain.
|--------------------------------------------------------------------------
*/

const productVersionSchema = new Schema(
  {
    variantId: {
      type: objectId,
      ref: "ProductVariant",
      required: true,
      index: true,
    },

    packId: {
      type: objectId,
      ref: "Pack",
      required: true,
      index: true,
    },

    version: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator(value) {
          return Number.isInteger(value);
        },

        message: "Product version must be an integer.",
      },
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 350,
    },

    gtin: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return true;
          }

          return /^\d{8,14}$/.test(value);
        },

        message: "GTIN must contain between 8 and 14 digits.",
      },
    },

    netQuantity: {
      type: quantitySchema,
      required: true,
    },

    ingredientDeclarationText: {
      type: String,
      trim: true,
      maxlength: 10000,
      default: "",
    },

    ingredients: {
      type: [productIngredientSchema],
      default: [],
    },

    nutrition: {
      type: nutritionSchema,
      default: () => ({
        basis: null,
        servingSize: null,
        nutrients: [],
      }),
    },

    allergens: {
      type: [allergenSchema],
      default: [],
    },

    claims: {
      type: [claimSchema],
      default: [],
    },

    certifications: {
      type: [certificationSchema],
      default: [],
    },

    images: {
      type: [imageSchema],
      default: [],
    },

    countryOfOrigin: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    manufacturerName: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },

    provenance: {
      type: [provenanceSchema],
      default: [],
    },

    publicationStatus: {
      type: String,
      required: true,
      enum: CATALOG_PUBLICATION_STATUSES,
      default: "draft",
    },

    effectiveFrom: {
      type: Date,
      default: null,
    },

    effectiveTo: {
      type: Date,
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    publishedByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    supersedesVersionId: {
      type: objectId,
      ref: "ProductVersion",
      default: null,
    },

    changeReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    retiredAt: {
      type: Date,
      default: null,
    },

    retiredByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },

    retireReason: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    createdByUserId: {
      type: objectId,
      ref: "User",
      default: null,
    },
  },
  baseSchemaOptions,
);

productVersionSchema.index(
  {
    packId: 1,
    version: 1,
  },
  {
    unique: true,
  },
);

productVersionSchema.index({
  variantId: 1,
  publicationStatus: 1,
  version: -1,
});

productVersionSchema.index({
  gtin: 1,
  publicationStatus: 1,
});

productVersionSchema.index({
  publicationStatus: 1,
  effectiveFrom: 1,
  effectiveTo: 1,
});

/*
|--------------------------------------------------------------------------
| Model Registration
|--------------------------------------------------------------------------
*/

export const Brand =
  mongoose.models.Brand ||
  mongoose.model(
    "Brand",
    brandSchema,
    "brands",
  );

export const Category =
  mongoose.models.Category ||
  mongoose.model(
    "Category",
    categorySchema,
    "categories",
  );

export const ProductFamily =
  mongoose.models.ProductFamily ||
  mongoose.model(
    "ProductFamily",
    productFamilySchema,
    "productFamilies",
  );

export const ProductVariant =
  mongoose.models.ProductVariant ||
  mongoose.model(
    "ProductVariant",
    productVariantSchema,
    "productVariants",
  );

export const Pack =
  mongoose.models.Pack ||
  mongoose.model(
    "Pack",
    packSchema,
    "packs",
  );

export const ProductVersion =
  mongoose.models.ProductVersion ||
  mongoose.model(
    "ProductVersion",
    productVersionSchema,
    "productVersions",
  );

export const CanonicalIngredient =
  mongoose.models.CanonicalIngredient ||
  mongoose.model(
    "CanonicalIngredient",
    canonicalIngredientSchema,
    "ingredients",
  );

export const EvidenceSource =
  mongoose.models.EvidenceSource ||
  mongoose.model(
    "EvidenceSource",
    evidenceSourceSchema,
    "evidenceSources",
  );

export const catalogModels = Object.freeze({
  Brand,
  Category,
  ProductFamily,
  ProductVariant,
  Pack,
  ProductVersion,
  CanonicalIngredient,
  EvidenceSource,
});