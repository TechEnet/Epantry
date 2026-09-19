import {
  Brand,
  Category,
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from './catalog.models.js'

import {
  normalizeCatalogKey,
  normalizeCatalogSlug,
} from './catalog.constants.js'

/*
|--------------------------------------------------------------------------
| Seed Contract
|--------------------------------------------------------------------------
|
| This module migrates the existing M01 development catalog into M04's
| canonical hierarchy:
|
| Brand
|   -> ProductFamily
|      -> ProductVariant
|         -> Pack
|            -> ProductVersion
|
| Commercial fields are intentionally not copied into ProductVersion:
|
| price
| currency
| availability
| stock
| seller / Host state
|
*/

export const M04_CATALOG_SEED_VERSION =
  'm04'

export const M04_CATALOG_SEED_RELEASE_AT =
  new Date(
    '2026-08-22T00:00:00.000Z',
  )

const M04_SEED_CHANGE_REASON =
  'Development seed migration from legacy M01 catalog.'

/*
|--------------------------------------------------------------------------
| Quantity Units
|--------------------------------------------------------------------------
|
| Unknown units fail closed instead of being guessed.
|
*/

const LEGACY_QUANTITY_UNIT_MAP =
  Object.freeze({
    g:
      'g',

    gram:
      'g',

    grams:
      'g',

    kg:
      'kg',

    kilogram:
      'kg',

    kilograms:
      'kg',

    ml:
      'ml',

    milliliter:
      'ml',

    milliliters:
      'ml',

    millilitre:
      'ml',

    millilitres:
      'ml',

    l:
      'l',

    litre:
      'l',

    litres:
      'l',

    liter:
      'l',

    liters:
      'l',

    piece:
      'piece',

    pieces:
      'piece',

    pc:
      'piece',

    pcs:
      'piece',

    'tea bag':
      'piece',

    'tea bags':
      'piece',
  })

export function normalizeSeedQuantityUnit(
  value,
) {
  const normalized =
    String(
      value ||
        '',
    )
      .trim()
      .toLowerCase()

  const mapped =
    LEGACY_QUANTITY_UNIT_MAP[
      normalized
    ]

  if (!mapped) {
    throw new Error(
      `Unsupported legacy catalog quantity unit: ${value}`,
    )
  }

  return mapped
}

/*
|--------------------------------------------------------------------------
| Category Helpers
|--------------------------------------------------------------------------
*/

function titleCaseSlug(
  value,
) {
  return String(
    value ||
      '',
  )
    .trim()
    .split(
      /[-_\s]+/,
    )
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1),
    )
    .join(
      ' ',
    )
}

export function buildSeedCategoryDefinitions(
  products,
) {
  const rootSlugs =
    new Set()

  const childDefinitions =
    new Map()

  for (
    const product of
    products
  ) {
    const rootSlug =
      normalizeCatalogSlug(
        product.category ||
          'grocery',
      )

    if (!rootSlug) {
      throw new Error(
        `Catalog seed product ${product.id || product.name} has no valid root category.`,
      )
    }

    rootSlugs.add(
      rootSlug,
    )

    const childSlug =
      normalizeCatalogSlug(
        product.subCategory,
      )

    if (childSlug) {
      childDefinitions.set(
        childSlug,
        {
          slug:
            childSlug,

          name:
            titleCaseSlug(
              childSlug,
            ),

          parentSlug:
            rootSlug,
        },
      )
    }
  }

  const roots =
    [
      ...rootSlugs,
    ]
      .sort()
      .map(
        (
          slug,
          index,
        ) => ({
          slug,

          name:
            titleCaseSlug(
              slug,
            ),

          parentSlug:
            null,

          sortOrder:
            index *
            100,
        }),
      )

  const children =
    [
      ...childDefinitions
        .values(),
    ]
      .sort(
        (
          left,
          right,
        ) =>
          left.slug.localeCompare(
            right.slug,
          ),
      )
      .map(
        (
          category,
          index,
        ) => ({
          ...category,

          sortOrder:
            1000 +
            index *
              10,
        }),
      )

  return [
    ...roots,
    ...children,
  ]
}

/*
|--------------------------------------------------------------------------
| Seed Product Descriptor
|--------------------------------------------------------------------------
|
| Structural defaults such as variantKey=default do not invent product facts.
| They only give legacy single-SKU seed products a deterministic canonical
| hierarchy.
|
*/

export function buildCanonicalSeedProductDescriptor(
  product,
) {
  if (
    !product ||
    !product.id ||
    !product.name ||
    !product.brandId
  ) {
    throw new Error(
      'Legacy catalog seed product requires id, name and brandId.',
    )
  }

  const familySlug =
    normalizeCatalogSlug(
      product.slug ||
        product.name,
    )

  const categorySlug =
    normalizeCatalogSlug(
      product.subCategory ||
        product.category ||
        'grocery',
    )

  const quantity =
    Number(
      product.quantity,
    )

  if (
    !Number.isFinite(
      quantity,
    ) ||
    quantity <=
      0
  ) {
    throw new Error(
      `Legacy catalog seed product ${product.id} has an invalid quantity.`,
    )
  }

  const normalizedUnit =
    normalizeSeedQuantityUnit(
      product.unit,
    )

  const packKey =
    normalizeCatalogKey(
      `${quantity}-${normalizedUnit}`,
    )

  const sourceImage =
    typeof product.image ===
      'string' &&
    product.image.trim()
      ? product.image.trim()
      : null

  return {
    legacyProductId:
      product.id,

    legacyBrandId:
      product.brandId,

    categorySlug,

    family: {
      canonicalName:
        product.name,

      slug:
        familySlug,

      description:
        product.description ||
        '',
    },

    variant: {
      canonicalName:
        product.name,

      variantKey:
        'default',

      market:
        'IN',

      flavor:
        '',

      formulationKey:
        '',

      packForm:
        '',
    },

    pack: {
      packKey,

      displayName:
        `${quantity} ${String(
          product.unit,
        ).trim()}`,

      packType:
        'other',

      multipackCount:
        1,
    },

    version: {
      displayName:
        product.name,

      gtin:
        null,

      netQuantity: {
        value:
          quantity,

        unit:
          normalizedUnit,
      },

      ingredientDeclarationText:
        '',

      ingredients:
        [],

      nutrition: {
        basis:
          null,

        servingSize:
          null,

        nutrients:
          [],
      },

      allergens:
        [],

      claims:
        [],

      certifications:
        [],

      images:
        sourceImage
          ? [
              {
                url:
                  sourceImage,

                alt:
                  product.name,

                evidenceSourceId:
                  null,

                sortOrder:
                  0,
              },
            ]
          : [],

      countryOfOrigin:
        product.countryOfOrigin ||
        '',

      manufacturerName:
        '',

      provenance:
        [],

      publicationStatus:
        'published',

      effectiveFrom:
        M04_CATALOG_SEED_RELEASE_AT,

      effectiveTo:
        null,

      publishedAt:
        M04_CATALOG_SEED_RELEASE_AT,

      publishedByUserId:
        null,

      supersedesVersionId:
        null,

      changeReason:
        M04_SEED_CHANGE_REASON,

      retiredAt:
        null,

      retiredByUserId:
        null,

      retireReason:
        '',

      createdByUserId:
        null,
    },
  }
}

/*
|--------------------------------------------------------------------------
| Evidence Checksum
|--------------------------------------------------------------------------
*/

export function buildSeedEvidenceChecksum(
  legacyProductId,
) {
  return [
    'development_seed',
    M04_CATALOG_SEED_VERSION,
    String(
      legacyProductId,
    )
      .trim()
      .toLowerCase(),
  ].join(
    ':',
  )
}

/*
|--------------------------------------------------------------------------
| Ensure Canonical Brand
|--------------------------------------------------------------------------
|
| Existing M01 Brand documents live in the same `brands` collection.
|
| We fill missing M04 fields without deleting legacy compatibility fields such
| as `logo`, `banner`, `officialWebsite`, etc.
|
*/

async function ensureCanonicalBrand(
  seedBrand,
) {
  const slug =
    normalizeCatalogSlug(
      seedBrand.slug ||
        seedBrand.name,
    )

  const existing =
    await Brand.collection.findOne({
      slug,
    })

  if (!existing) {
    return Brand.create({
      name:
        seedBrand.name,

      slug,

      aliases:
        [],

      description:
        seedBrand.description ||
        '',

      websiteUrl:
        seedBrand.officialWebsite ||
        '',

      logoUrl:
        seedBrand.logo ||
        '',

      status:
        'active',

      createdByUserId:
        null,

      updatedByUserId:
        null,
    })
  }

  const missingFields =
    {}

  if (
    !existing.name
  ) {
    missingFields.name =
      seedBrand.name
  }

  if (
    !existing.description &&
    seedBrand.description
  ) {
    missingFields.description =
      seedBrand.description
  }

  if (
    !Array.isArray(
      existing.aliases,
    )
  ) {
    missingFields.aliases =
      []
  }

  if (
    !existing.websiteUrl &&
    seedBrand.officialWebsite
  ) {
    missingFields.websiteUrl =
      seedBrand.officialWebsite
  }

  if (
    !existing.logoUrl &&
    seedBrand.logo
  ) {
    missingFields.logoUrl =
      seedBrand.logo
  }

  if (
    !existing.status
  ) {
    missingFields.status =
      'active'
  }

  if (
    !existing.createdAt
  ) {
    missingFields.createdAt =
      new Date()
  }

  if (
    !existing.updatedAt
  ) {
    missingFields.updatedAt =
      new Date()
  }

  if (
    Object.keys(
      missingFields,
    ).length >
    0
  ) {
    await Brand.collection.updateOne(
      {
        _id:
          existing._id,
      },
      {
        $set:
          missingFields,
      },
    )
  }

  return Brand.findById(
    existing._id,
  )
}

/*
|--------------------------------------------------------------------------
| Ensure Category
|--------------------------------------------------------------------------
*/

async function ensureCategory({
  definition,
  parentId,
}) {
  let category =
    await Category.findOne({
      slug:
        definition.slug,
    })

  if (category) {
    return category
  }

  category =
    await Category.create({
      name:
        definition.name,

      slug:
        definition.slug,

      parentId:
        parentId ||
        null,

      description:
        '',

      sortOrder:
        definition.sortOrder,

      status:
        'active',

      createdByUserId:
        null,

      updatedByUserId:
        null,
    })

  return category
}

/*
|--------------------------------------------------------------------------
| Ensure Family
|--------------------------------------------------------------------------
*/

async function ensureProductFamily({
  descriptor,
  brand,
  category,
}) {
  let family =
    await ProductFamily.findOne({
      brandId:
        brand._id,

      slug:
        descriptor.family.slug,
    })

  if (family) {
    return family
  }

  family =
    await ProductFamily.create({
      brandId:
        brand._id,

      categoryId:
        category._id,

      canonicalName:
        descriptor.family
          .canonicalName,

      slug:
        descriptor.family.slug,

      description:
        descriptor.family
          .description,

      status:
        'active',

      createdByUserId:
        null,

      updatedByUserId:
        null,
    })

  return family
}

/*
|--------------------------------------------------------------------------
| Ensure Variant
|--------------------------------------------------------------------------
*/

async function ensureProductVariant({
  descriptor,
  family,
}) {
  let variant =
    await ProductVariant.findOne({
      familyId:
        family._id,

      variantKey:
        descriptor.variant
          .variantKey,
    })

  if (variant) {
    return variant
  }

  variant =
    await ProductVariant.create({
      familyId:
        family._id,

      ...descriptor.variant,

      status:
        'active',

      createdByUserId:
        null,

      updatedByUserId:
        null,
    })

  return variant
}

/*
|--------------------------------------------------------------------------
| Ensure Pack
|--------------------------------------------------------------------------
*/

async function ensureProductPack({
  descriptor,
  variant,
}) {
  let pack =
    await Pack.findOne({
      variantId:
        variant._id,

      packKey:
        descriptor.pack.packKey,
    })

  if (pack) {
    return pack
  }

  pack =
    await Pack.create({
      variantId:
        variant._id,

      ...descriptor.pack,

      status:
        'active',

      createdByUserId:
        null,

      updatedByUserId:
        null,
    })

  return pack
}

/*
|--------------------------------------------------------------------------
| Ensure Product Version
|--------------------------------------------------------------------------
|
| If a Pack already has any version, seed does not create or overwrite another
| one. This prevents a development re-seed from destroying admin-managed
| version history.
|
*/

async function ensureProductVersion({
  descriptor,
  variant,
  pack,
}) {
  const existing =
    await ProductVersion.findOne({
      packId:
        pack._id,
    })
      .sort({
        version:
          1,
      })

  if (existing) {
    return {
      version:
        existing,

      created:
        false,
    }
  }

  const version =
    await ProductVersion.create({
      variantId:
        variant._id,

      packId:
        pack._id,

      version:
        1,

      ...descriptor.version,
    })

  return {
    version,

    created:
      true,
  }
}

/*
|--------------------------------------------------------------------------
| Ensure Seed Evidence
|--------------------------------------------------------------------------
*/

async function ensureSeedEvidence({
  descriptor,
  version,
}) {
  const checksum =
    buildSeedEvidenceChecksum(
      descriptor.legacyProductId,
    )

  let evidence =
    await EvidenceSource.findOne({
      entityType:
        'product_version',

      entityId:
        version._id,

      checksum,
    })

  if (evidence) {
    return {
      evidence,

      created:
        false,
    }
  }

  evidence =
    await EvidenceSource.create({
      entityType:
        'product_version',

      entityId:
        version._id,

      sourceType:
        'import',

      sourceName:
        'EPANTRY development catalog seed',

      sourceUri:
        '',

      externalReference:
        descriptor.legacyProductId,

      checksum,

      evidenceState:
        'operator_declared',

      capturedAt:
        M04_CATALOG_SEED_RELEASE_AT,

      createdByUserId:
        null,

      metadata: {
        seedSource:
          'development_seed',

        seedVersion:
          M04_CATALOG_SEED_VERSION,

        legacyProductId:
          descriptor.legacyProductId,
      },
    })

  return {
    evidence,

    created:
      true,
  }
}

/*
|--------------------------------------------------------------------------
| Attach Seed Provenance
|--------------------------------------------------------------------------
|
| Seed-created published versions may be repaired after an interrupted seed,
| but non-seed/admin-managed versions are never rewritten.
|
*/

async function ensureSeedVersionProvenance({
  descriptor,
  version,
  evidence,
}) {
  if (
    version.changeReason !==
    M04_SEED_CHANGE_REASON
  ) {
    return version
  }

  const provenance =
    []

  provenance.push({
    fieldPath:
      'displayName',

    evidenceSourceId:
      evidence._id,

    evidenceState:
      'operator_declared',

    extractionMethod:
      'structured_import',

    confidence:
      null,

    reviewedByUserId:
      null,

    reviewedAt:
      null,
  })

  provenance.push({
    fieldPath:
      'netQuantity',

    evidenceSourceId:
      evidence._id,

    evidenceState:
      'operator_declared',

    extractionMethod:
      'structured_import',

    confidence:
      null,

    reviewedByUserId:
      null,

    reviewedAt:
      null,
  })

  if (
    descriptor.version
      .countryOfOrigin
  ) {
    provenance.push({
      fieldPath:
        'countryOfOrigin',

      evidenceSourceId:
        evidence._id,

      evidenceState:
        'operator_declared',

      extractionMethod:
        'structured_import',

      confidence:
        null,

      reviewedByUserId:
        null,

      reviewedAt:
        null,
    })
  }

  const updates =
    {}

  if (
    !Array.isArray(
      version.provenance,
    ) ||
    version.provenance.length ===
      0
  ) {
    updates.provenance =
      provenance
  }

  if (
    descriptor.version
      .images.length >
      0 &&
    (
      !Array.isArray(
        version.images,
      ) ||
      version.images.length ===
        0 ||
      !version.images[0]
        ?.evidenceSourceId
    )
  ) {
    updates.images =
      descriptor.version.images.map(
        (
          image,
        ) => ({
          ...image,

          evidenceSourceId:
            evidence._id,
        }),
      )
  }

  if (
    Object.keys(
      updates,
    ).length >
    0
  ) {
    await ProductVersion.updateOne(
      {
        _id:
          version._id,

        changeReason:
          M04_SEED_CHANGE_REASON,
      },
      {
        $set:
          updates,
      },
    )
  }

  return ProductVersion.findById(
    version._id,
  )
}

/*
|--------------------------------------------------------------------------
| Canonical Seed
|--------------------------------------------------------------------------
*/

export async function seedCanonicalCatalog({
  brands,
  products,
}) {
  if (
    !Array.isArray(
      brands,
    ) ||
    !Array.isArray(
      products,
    )
  ) {
    throw new Error(
      'Canonical catalog seed requires Brand and Product arrays.',
    )
  }

  const brandByLegacyId =
    new Map()

  let brandsCreatedOrMigrated =
    0

  for (
    const seedBrand of
    brands
  ) {
    const brand =
      await ensureCanonicalBrand(
        seedBrand,
      )

    brandByLegacyId.set(
      seedBrand.id,
      brand,
    )

    brandsCreatedOrMigrated +=
      1
  }

  const categoryDefinitions =
    buildSeedCategoryDefinitions(
      products,
    )

  const categoryBySlug =
    new Map()

  for (
    const definition of
    categoryDefinitions.filter(
      (
        category,
      ) =>
        category.parentSlug ===
        null,
    )
  ) {
    const category =
      await ensureCategory({
        definition,

        parentId:
          null,
      })

    categoryBySlug.set(
      definition.slug,
      category,
    )
  }

  for (
    const definition of
    categoryDefinitions.filter(
      (
        category,
      ) =>
        category.parentSlug !==
        null,
    )
  ) {
    const parent =
      categoryBySlug.get(
        definition.parentSlug,
      )

    if (!parent) {
      throw new Error(
        `Canonical seed parent category ${definition.parentSlug} was not created.`,
      )
    }

    const category =
      await ensureCategory({
        definition,

        parentId:
          parent._id,
      })

    categoryBySlug.set(
      definition.slug,
      category,
    )
  }

  let familiesProcessed =
    0

  let variantsProcessed =
    0

  let packsProcessed =
    0

  let productVersionsCreated =
    0

  let productVersionsExisting =
    0

  let evidenceSourcesCreated =
    0

  let evidenceSourcesExisting =
    0

  for (
    const legacyProduct of
    products
  ) {
    const descriptor =
      buildCanonicalSeedProductDescriptor(
        legacyProduct,
      )

    const brand =
      brandByLegacyId.get(
        descriptor.legacyBrandId,
      )

    if (!brand) {
      throw new Error(
        `Canonical seed product ${descriptor.legacyProductId} references unknown Brand ${descriptor.legacyBrandId}.`,
      )
    }

    const category =
      categoryBySlug.get(
        descriptor.categorySlug,
      )

    if (!category) {
      throw new Error(
        `Canonical seed product ${descriptor.legacyProductId} references unknown Category ${descriptor.categorySlug}.`,
      )
    }

    const family =
      await ensureProductFamily({
        descriptor,

        brand,

        category,
      })

    familiesProcessed +=
      1

    const variant =
      await ensureProductVariant({
        descriptor,

        family,
      })

    variantsProcessed +=
      1

    const pack =
      await ensureProductPack({
        descriptor,

        variant,
      })

    packsProcessed +=
      1

    const {
      version,
      created:
        versionCreated,
    } =
      await ensureProductVersion({
        descriptor,

        variant,

        pack,
      })

    if (
      versionCreated
    ) {
      productVersionsCreated +=
        1
    } else {
      productVersionsExisting +=
        1
    }

    const {
      evidence,
      created:
        evidenceCreated,
    } =
      await ensureSeedEvidence({
        descriptor,

        version,
      })

    if (
      evidenceCreated
    ) {
      evidenceSourcesCreated +=
        1
    } else {
      evidenceSourcesExisting +=
        1
    }

    await ensureSeedVersionProvenance({
      descriptor,

      version,

      evidence,
    })
  }

  return {
    seedVersion:
      M04_CATALOG_SEED_VERSION,

    sourceBrands:
      brands.length,

    productsProcessed:
      products.length,

    brandsProcessed:
      brandsCreatedOrMigrated,

    categoriesProcessed:
      categoryDefinitions.length,

    familiesProcessed,

    variantsProcessed,

    packsProcessed,

    productVersionsCreated,

    productVersionsExisting,

    evidenceSourcesCreated,

    evidenceSourcesExisting,
  }
}