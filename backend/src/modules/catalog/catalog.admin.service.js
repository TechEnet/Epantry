import mongoose from "mongoose";

import {
  ApiError,
} from "../../utils/ApiError.js";

import {
  Brand,
  Category,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from "./catalog.models.js";

import {
  normalizeCatalogKey,
  normalizeCatalogSlug,
} from "./catalog.constants.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeActorId(
  actorUserId,
) {
  if (
    !actorUserId ||
    !mongoose.Types.ObjectId.isValid(
      String(actorUserId),
    )
  ) {
    throw new ApiError(
      400,
      "A valid acting user ID is required.",
      [
        {
          code:
            "CATALOG_ACTOR_INVALID",
        },
      ],
    );
  }

  return String(
    actorUserId,
  );
}

function escapeRegex(
  value,
) {
  return String(value || "")
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
}

function duplicateError(
  entityLabel,
) {
  return new ApiError(
    409,
    `${entityLabel} already exists.`,
    [
      {
        code:
          "CATALOG_DUPLICATE",
      },
    ],
  );
}

function notFoundError(
  entityLabel,
) {
  return new ApiError(
    404,
    `${entityLabel} was not found.`,
    [
      {
        code:
          "CATALOG_ENTITY_NOT_FOUND",
      },
    ],
  );
}

async function executeMutation(
  mutation,
  entityLabel,
) {
  try {
    return await mutation();
  } catch (error) {
    if (
      error?.code === 11000
    ) {
      throw duplicateError(
        entityLabel,
      );
    }

    throw error;
  }
}

async function requireEntity(
  Model,
  id,
  entityLabel,
) {
  const entity =
    await Model.findById(
      id,
    );

  if (!entity) {
    throw notFoundError(
      entityLabel,
    );
  }

  return entity;
}

function assertUsableReference(
  entity,
  entityLabel,
) {
  if (
    entity.status ===
      "disabled" ||
    entity.status ===
      "retired"
  ) {
    throw new ApiError(
      409,
      `${entityLabel} is not active.`,
      [
        {
          code:
            "CATALOG_REFERENCE_INACTIVE",
        },
      ],
    );
  }
}

async function paginatedQuery({
  Model,
  filter,
  page,
  limit,
  sort,
}) {
  const skip =
    (page - 1) *
    limit;

  const [
    items,
    total,
  ] =
    await Promise.all([
      Model.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),

      Model.countDocuments(
        filter,
      ),
    ]);

  return {
    items,

    pagination: {
      page,
      limit,
      total,
      pages:
        Math.max(
          1,
          Math.ceil(
            total /
              limit,
          ),
        ),
    },
  };
}

function buildStatusFilter(
  status,
) {
  if (
    !status ||
    status === "all"
  ) {
    return {};
  }

  return {
    status,
  };
}

/*
|--------------------------------------------------------------------------
| Serializers
|--------------------------------------------------------------------------
*/

export function serializeCatalogEntity(
  entity,
) {
  if (!entity) {
    return null;
  }

  const value =
    typeof entity.toObject ===
    "function"
      ? entity.toObject()
      : entity;

  return {
    ...value,

    id:
      String(
        value._id,
      ),

    _id:
      undefined,

    __v:
      undefined,
  };
}

export function serializeCatalogProductVersion(
  version,
) {
  if (!version) {
    return null;
  }

  const value =
    typeof version.toObject ===
    "function"
      ? version.toObject()
      : version;

  return {
    ...value,

    id:
      String(
        value._id,
      ),

    variantId:
      String(
        value.variantId,
      ),

    packId:
      String(
        value.packId,
      ),

    supersedesVersionId:
      value.supersedesVersionId
        ? String(
            value.supersedesVersionId,
          )
        : null,

    _id:
      undefined,

    __v:
      undefined,
  };
}

/*
|--------------------------------------------------------------------------
| Brand
|--------------------------------------------------------------------------
*/

export async function createCatalogBrand(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  return executeMutation(
    async () => {
      const brand =
        await Brand.create({
          ...input,

          slug:
            normalizeCatalogSlug(
              input.slug ||
                input.name,
            ),

          createdByUserId:
            actorId,

          updatedByUserId:
            actorId,
        });

      return serializeCatalogEntity(
        brand,
      );
    },
    "Brand",
  );
}

export async function updateCatalogBrand(
  brandId,
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const brand =
    await requireEntity(
      Brand,
      brandId,
      "Brand",
    );

  if (
    input.name !==
      undefined
  ) {
    brand.name =
      input.name;
  }

  if (
    input.slug !==
      undefined
  ) {
    brand.slug =
      normalizeCatalogSlug(
        input.slug,
      );
  }

  if (
    input.aliases !==
      undefined
  ) {
    brand.aliases =
      input.aliases;
  }

  if (
    input.description !==
      undefined
  ) {
    brand.description =
      input.description;
  }

  if (
    input.websiteUrl !==
      undefined
  ) {
    brand.websiteUrl =
      input.websiteUrl;
  }

  if (
    input.logoUrl !==
      undefined
  ) {
    brand.logoUrl =
      input.logoUrl;
  }

  if (
    input.status !==
      undefined
  ) {
    brand.status =
      input.status;
  }

  brand.updatedByUserId =
    actorId;

  await executeMutation(
    () =>
      brand.save(),
    "Brand",
  );

  return serializeCatalogEntity(
    brand,
  );
}

export async function listCatalogBrands({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
} = {}) {
  const filter = {
    ...buildStatusFilter(
      status,
    ),
  };

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        name:
          expression,
      },
      {
        aliases:
          expression,
      },
      {
        slug:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        Brand,

      filter,

      page,

      limit,

      sort: {
        name:
          1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogEntity,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Category
|--------------------------------------------------------------------------
*/

async function assertCategoryParentValid(
  categoryId,
  parentId,
) {
  if (!parentId) {
    return;
  }

  if (
    categoryId &&
    String(categoryId) ===
      String(parentId)
  ) {
    throw new ApiError(
      409,
      "A Category cannot be its own parent.",
      [
        {
          code:
            "CATALOG_CATEGORY_CYCLE",
        },
      ],
    );
  }

  let current =
    await requireEntity(
      Category,
      parentId,
      "Parent Category",
    );

  const visited =
    new Set();

  while (current) {
    const currentId =
      String(
        current._id,
      );

    if (
      categoryId &&
      currentId ===
        String(categoryId)
    ) {
      throw new ApiError(
        409,
        "Category hierarchy cannot contain a cycle.",
        [
          {
            code:
              "CATALOG_CATEGORY_CYCLE",
          },
        ],
      );
    }

    if (
      visited.has(
        currentId,
      )
    ) {
      throw new ApiError(
        409,
        "Existing Category hierarchy contains a cycle.",
        [
          {
            code:
              "CATALOG_CATEGORY_CYCLE",
          },
        ],
      );
    }

    visited.add(
      currentId,
    );

    if (
      !current.parentId
    ) {
      break;
    }

    current =
      await Category.findById(
        current.parentId,
      );

    if (!current) {
      break;
    }
  }
}

export async function createCatalogCategory(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  await assertCategoryParentValid(
    null,
    input.parentId,
  );

  return executeMutation(
    async () => {
      const category =
        await Category.create({
          ...input,

          slug:
            normalizeCatalogSlug(
              input.slug ||
                input.name,
            ),

          createdByUserId:
            actorId,

          updatedByUserId:
            actorId,
        });

      return serializeCatalogEntity(
        category,
      );
    },
    "Category",
  );
}

export async function updateCatalogCategory(
  categoryId,
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const category =
    await requireEntity(
      Category,
      categoryId,
      "Category",
    );

  if (
    input.parentId !==
      undefined
  ) {
    await assertCategoryParentValid(
      categoryId,
      input.parentId,
    );

    category.parentId =
      input.parentId;
  }

  if (
    input.name !==
      undefined
  ) {
    category.name =
      input.name;
  }

  if (
    input.slug !==
      undefined
  ) {
    category.slug =
      normalizeCatalogSlug(
        input.slug,
      );
  }

  if (
    input.description !==
      undefined
  ) {
    category.description =
      input.description;
  }

  if (
    input.sortOrder !==
      undefined
  ) {
    category.sortOrder =
      input.sortOrder;
  }

  if (
    input.status !==
      undefined
  ) {
    category.status =
      input.status;
  }

  category.updatedByUserId =
    actorId;

  await executeMutation(
    () =>
      category.save(),
    "Category",
  );

  return serializeCatalogEntity(
    category,
  );
}

export async function listCatalogCategories({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
  parentId,
} = {}) {
  const filter = {
    ...buildStatusFilter(
      status,
    ),
  };

  if (
    parentId === "root"
  ) {
    filter.parentId =
      null;
  } else if (
    parentId
  ) {
    filter.parentId =
      parentId;
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        name:
          expression,
      },
      {
        slug:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        Category,

      filter,

      page,

      limit,

      sort: {
        sortOrder:
          1,

        name:
          1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogEntity,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Product Family
|--------------------------------------------------------------------------
*/

export async function createProductFamily(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const [
    brand,
    category,
  ] =
    await Promise.all([
      requireEntity(
        Brand,
        input.brandId,
        "Brand",
      ),

      requireEntity(
        Category,
        input.categoryId,
        "Category",
      ),
    ]);

  assertUsableReference(
    brand,
    "Brand",
  );

  assertUsableReference(
    category,
    "Category",
  );

  return executeMutation(
    async () => {
      const family =
        await ProductFamily.create({
          ...input,

          slug:
            normalizeCatalogSlug(
              input.slug ||
                input.canonicalName,
            ),

          createdByUserId:
            actorId,

          updatedByUserId:
            actorId,
        });

      return serializeCatalogEntity(
        family,
      );
    },
    "Product Family",
  );
}

export async function updateProductFamily(
  familyId,
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const family =
    await requireEntity(
      ProductFamily,
      familyId,
      "Product Family",
    );

  if (
    input.brandId !==
      undefined
  ) {
    const brand =
      await requireEntity(
        Brand,
        input.brandId,
        "Brand",
      );

    assertUsableReference(
      brand,
      "Brand",
    );

    family.brandId =
      input.brandId;
  }

  if (
    input.categoryId !==
      undefined
  ) {
    const category =
      await requireEntity(
        Category,
        input.categoryId,
        "Category",
      );

    assertUsableReference(
      category,
      "Category",
    );

    family.categoryId =
      input.categoryId;
  }

  for (
    const key of [
      "canonicalName",
      "description",
      "status",
    ]
  ) {
    if (
      input[key] !==
        undefined
    ) {
      family[key] =
        input[key];
    }
  }

  if (
    input.slug !==
      undefined
  ) {
    family.slug =
      normalizeCatalogSlug(
        input.slug,
      );
  }

  family.updatedByUserId =
    actorId;

  await executeMutation(
    () =>
      family.save(),
    "Product Family",
  );

  return serializeCatalogEntity(
    family,
  );
}

export async function listProductFamilies({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
  brandId,
  categoryId,
} = {}) {
  const filter = {
    ...buildStatusFilter(
      status,
    ),
  };

  if (brandId) {
    filter.brandId =
      brandId;
  }

  if (categoryId) {
    filter.categoryId =
      categoryId;
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        canonicalName:
          expression,
      },
      {
        slug:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        ProductFamily,

      filter,

      page,

      limit,

      sort: {
        canonicalName:
          1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogEntity,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Product Variant
|--------------------------------------------------------------------------
*/

export async function createProductVariant(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const family =
    await requireEntity(
      ProductFamily,
      input.familyId,
      "Product Family",
    );

  assertUsableReference(
    family,
    "Product Family",
  );

  return executeMutation(
    async () => {
      const variant =
        await ProductVariant.create({
          ...input,

          variantKey:
            normalizeCatalogKey(
              input.variantKey ||
                input.canonicalName,
            ),

          market:
            String(
              input.market ||
                "IN",
            ).toUpperCase(),

          createdByUserId:
            actorId,

          updatedByUserId:
            actorId,
        });

      return serializeCatalogEntity(
        variant,
      );
    },
    "Product Variant",
  );
}

export async function updateProductVariant(
  variantId,
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const variant =
    await requireEntity(
      ProductVariant,
      variantId,
      "Product Variant",
    );

  if (
    input.familyId !==
      undefined
  ) {
    const family =
      await requireEntity(
        ProductFamily,
        input.familyId,
        "Product Family",
      );

    assertUsableReference(
      family,
      "Product Family",
    );

    variant.familyId =
      input.familyId;
  }

  for (
    const key of [
      "canonicalName",
      "flavor",
      "formulationKey",
      "packForm",
      "status",
    ]
  ) {
    if (
      input[key] !==
        undefined
    ) {
      variant[key] =
        input[key];
    }
  }

  if (
    input.variantKey !==
      undefined
  ) {
    variant.variantKey =
      normalizeCatalogKey(
        input.variantKey,
      );
  }

  if (
    input.market !==
      undefined
  ) {
    variant.market =
      String(
        input.market,
      ).toUpperCase();
  }

  variant.updatedByUserId =
    actorId;

  await executeMutation(
    () =>
      variant.save(),
    "Product Variant",
  );

  return serializeCatalogEntity(
    variant,
  );
}

export async function listProductVariants({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
  familyId,
} = {}) {
  const filter = {
    ...buildStatusFilter(
      status,
    ),
  };

  if (familyId) {
    filter.familyId =
      familyId;
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        canonicalName:
          expression,
      },
      {
        variantKey:
          expression,
      },
      {
        flavor:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        ProductVariant,

      filter,

      page,

      limit,

      sort: {
        canonicalName:
          1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogEntity,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Pack
|--------------------------------------------------------------------------
*/

export async function createProductPack(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const variant =
    await requireEntity(
      ProductVariant,
      input.variantId,
      "Product Variant",
    );

  assertUsableReference(
    variant,
    "Product Variant",
  );

  return executeMutation(
    async () => {
      const pack =
        await Pack.create({
          ...input,

          packKey:
            normalizeCatalogKey(
              input.packKey ||
                input.displayName,
            ),

          createdByUserId:
            actorId,

          updatedByUserId:
            actorId,
        });

      return serializeCatalogEntity(
        pack,
      );
    },
    "Pack",
  );
}

export async function updateProductPack(
  packId,
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const pack =
    await requireEntity(
      Pack,
      packId,
      "Pack",
    );

  if (
    input.variantId !==
      undefined
  ) {
    const variant =
      await requireEntity(
        ProductVariant,
        input.variantId,
        "Product Variant",
      );

    assertUsableReference(
      variant,
      "Product Variant",
    );

    pack.variantId =
      input.variantId;
  }

  for (
    const key of [
      "displayName",
      "packType",
      "multipackCount",
      "status",
    ]
  ) {
    if (
      input[key] !==
        undefined
    ) {
      pack[key] =
        input[key];
    }
  }

  if (
    input.packKey !==
      undefined
  ) {
    pack.packKey =
      normalizeCatalogKey(
        input.packKey,
      );
  }

  pack.updatedByUserId =
    actorId;

  await executeMutation(
    () =>
      pack.save(),
    "Pack",
  );

  return serializeCatalogEntity(
    pack,
  );
}

export async function listProductPacks({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
  variantId,
} = {}) {
  const filter = {
    ...buildStatusFilter(
      status,
    ),
  };

  if (variantId) {
    filter.variantId =
      variantId;
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        displayName:
          expression,
      },
      {
        packKey:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        Pack,

      filter,

      page,

      limit,

      sort: {
        displayName:
          1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogEntity,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Product Version Workflow Helpers
|--------------------------------------------------------------------------
*/

export function assertDraftVersionEditable(
  version,
) {
  if (
    version.publicationStatus !==
    "draft"
  ) {
    throw new ApiError(
      409,
      "Only a draft Product Version can be edited.",
      [
        {
          code:
            "CATALOG_VERSION_NOT_EDITABLE",
        },
      ],
    );
  }
}

export function assertVersionCanEnterReview(
  version,
) {
  if (
    version.publicationStatus !==
    "draft"
  ) {
    throw new ApiError(
      409,
      "Only a draft Product Version can enter review.",
      [
        {
          code:
            "CATALOG_VERSION_REVIEW_TRANSITION_INVALID",
        },
      ],
    );
  }

  if (
    !version.displayName ||
    !version.netQuantity?.value ||
    !version.netQuantity?.unit
  ) {
    throw new ApiError(
      409,
      "Product Version is incomplete and cannot enter review.",
      [
        {
          code:
            "CATALOG_VERSION_INCOMPLETE",
        },
      ],
    );
  }
}

function cloneValue(
  value,
) {
  if (
    value === undefined
  ) {
    return undefined;
  }

  return JSON.parse(
    JSON.stringify(
      value,
    ),
  );
}

export function buildNextVersionDocument({
  sourceVersion,
  nextVersion,
  actorUserId,
  changeReason,
}) {
  return {
    variantId:
      sourceVersion.variantId,

    packId:
      sourceVersion.packId,

    version:
      nextVersion,

    displayName:
      sourceVersion.displayName,

    gtin:
      sourceVersion.gtin ||
      null,

    netQuantity:
      cloneValue(
        sourceVersion.netQuantity,
      ),

    ingredientDeclarationText:
      sourceVersion.ingredientDeclarationText ||
      "",

    ingredients:
      cloneValue(
        sourceVersion.ingredients ||
          [],
      ),

    nutrition:
      cloneValue(
        sourceVersion.nutrition ||
          {
            basis:
              null,

            servingSize:
              null,

            nutrients:
              [],
          },
      ),

    allergens:
      cloneValue(
        sourceVersion.allergens ||
          [],
      ),

    claims:
      cloneValue(
        sourceVersion.claims ||
          [],
      ),

    certifications:
      cloneValue(
        sourceVersion.certifications ||
          [],
      ),

    images:
      cloneValue(
        sourceVersion.images ||
          [],
      ),

    countryOfOrigin:
      sourceVersion.countryOfOrigin ||
      "",

    manufacturerName:
      sourceVersion.manufacturerName ||
      "",

    provenance:
      cloneValue(
        sourceVersion.provenance ||
          [],
      ),

    publicationStatus:
      "draft",

    effectiveFrom:
      null,

    effectiveTo:
      null,

    publishedAt:
      null,

    publishedByUserId:
      null,

    supersedesVersionId:
      sourceVersion._id,

    changeReason,

    retiredAt:
      null,

    retiredByUserId:
      null,

    retireReason:
      "",

    createdByUserId:
      actorUserId,
  };
}

/*
|--------------------------------------------------------------------------
| List Product Versions
|--------------------------------------------------------------------------
*/

export async function listProductVersions({
  page = 1,
  limit = 25,
  search = "",
  publicationStatus = "all",
  variantId,
  packId,
} = {}) {
  const filter =
    {};

  if (
    publicationStatus !==
    "all"
  ) {
    filter.publicationStatus =
      publicationStatus;
  }

  if (variantId) {
    filter.variantId =
      variantId;
  }

  if (packId) {
    filter.packId =
      packId;
  }

  if (search) {
    const expression =
      new RegExp(
        escapeRegex(
          search,
        ),
        "i",
      );

    filter.$or = [
      {
        displayName:
          expression,
      },
      {
        gtin:
          expression,
      },
    ];
  }

  const result =
    await paginatedQuery({
      Model:
        ProductVersion,

      filter,

      page,

      limit,

      sort: {
        updatedAt:
          -1,

        version:
          -1,
      },
    });

  return {
    ...result,

    items:
      result.items.map(
        serializeCatalogProductVersion,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Get Product Version
|--------------------------------------------------------------------------
*/

export async function getProductVersion(
  versionId,
) {
  const version =
    await ProductVersion.findById(
      versionId,
    );

  if (!version) {
    throw notFoundError(
      "Product Version",
    );
  }

  return serializeCatalogProductVersion(
    version,
  );
}

/*
|--------------------------------------------------------------------------
| Create Initial / New Draft For Pack
|--------------------------------------------------------------------------
*/

export async function createProductDraft(
  input,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const pack =
    await requireEntity(
      Pack,
      input.packId,
      "Pack",
    );

  assertUsableReference(
    pack,
    "Pack",
  );

  const variant =
    await requireEntity(
      ProductVariant,
      pack.variantId,
      "Product Variant",
    );

  assertUsableReference(
    variant,
    "Product Variant",
  );

  const openVersion =
    await ProductVersion.findOne({
      packId:
        pack._id,

      publicationStatus: {
        $in: [
          "draft",
          "in_review",
        ],
      },
    })
      .sort({
        version:
          -1,
      })
      .lean();

  if (openVersion) {
    throw new ApiError(
      409,
      "This Pack already has an open draft or review version.",
      [
        {
          code:
            "CATALOG_OPEN_VERSION_EXISTS",

          productVersionId:
            String(
              openVersion._id,
            ),
        },
      ],
    );
  }

  const latestVersion =
    await ProductVersion.findOne({
      packId:
        pack._id,
    })
      .sort({
        version:
          -1,
      })
      .select({
        version:
          1,
      })
      .lean();

  const nextVersion =
    (
      latestVersion?.version ||
      0
    ) + 1;

  return executeMutation(
    async () => {
      const version =
        await ProductVersion.create({
          variantId:
            variant._id,

          packId:
            pack._id,

          version:
            nextVersion,

          displayName:
            input.displayName,

          gtin:
            input.gtin ||
            null,

          netQuantity:
            input.netQuantity,

          countryOfOrigin:
            input.countryOfOrigin ||
            "",

          manufacturerName:
            input.manufacturerName ||
            "",

          publicationStatus:
            "draft",

          changeReason:
            input.changeReason ||
            "",

          createdByUserId:
            actorId,
        });

      return serializeCatalogProductVersion(
        version,
      );
    },
    "Product Version",
  );
}

/*
|--------------------------------------------------------------------------
| Update Draft
|--------------------------------------------------------------------------
*/

export async function updateProductDraft(
  versionId,
  input,
  actorUserId,
) {
  normalizeActorId(
    actorUserId,
  );

  const version =
    await requireEntity(
      ProductVersion,
      versionId,
      "Product Version",
    );

  assertDraftVersionEditable(
    version,
  );

  for (
    const key of [
      "displayName",
      "gtin",
      "netQuantity",
      "countryOfOrigin",
      "manufacturerName",
      "changeReason",
    ]
  ) {
    if (
      input[key] !==
        undefined
    ) {
      version[key] =
        input[key];
    }
  }

  await version.save();

  return serializeCatalogProductVersion(
    version,
  );
}

/*
|--------------------------------------------------------------------------
| Submit Draft For Review
|--------------------------------------------------------------------------
*/

export async function submitProductVersionForReview(
  versionId,
  actorUserId,
) {
  normalizeActorId(
    actorUserId,
  );

  const version =
    await requireEntity(
      ProductVersion,
      versionId,
      "Product Version",
    );

  assertVersionCanEnterReview(
    version,
  );

  version.publicationStatus =
    "in_review";

  await version.save();

  return serializeCatalogProductVersion(
    version,
  );
}

/*
|--------------------------------------------------------------------------
| Create Next Version From Published Truth
|--------------------------------------------------------------------------
|
| Published data is never destructively edited.
|--------------------------------------------------------------------------
*/

export async function createNextProductVersion(
  sourceVersionId,
  changeReason,
  actorUserId,
) {
  const actorId =
    normalizeActorId(
      actorUserId,
    );

  const source =
    await requireEntity(
      ProductVersion,
      sourceVersionId,
      "Product Version",
    );

  if (
    source.publicationStatus !==
      "published"
  ) {
    throw new ApiError(
      409,
      "A new Product Version can only be created from a published version.",
      [
        {
          code:
            "CATALOG_VERSION_SOURCE_NOT_PUBLISHED",
        },
      ],
    );
  }

  const openVersion =
    await ProductVersion.findOne({
      packId:
        source.packId,

      publicationStatus: {
        $in: [
          "draft",
          "in_review",
        ],
      },
    })
      .lean();

  if (openVersion) {
    throw new ApiError(
      409,
      "This Pack already has an open draft or review version.",
      [
        {
          code:
            "CATALOG_OPEN_VERSION_EXISTS",

          productVersionId:
            String(
              openVersion._id,
            ),
        },
      ],
    );
  }

  const latestVersion =
    await ProductVersion.findOne({
      packId:
        source.packId,
    })
      .sort({
        version:
          -1,
      })
      .select({
        version:
          1,
      })
      .lean();

  const nextVersion =
    (
      latestVersion?.version ||
      source.version
    ) + 1;

  const document =
    buildNextVersionDocument({
      sourceVersion:
        source.toObject(),

      nextVersion,

      actorUserId:
        actorId,

      changeReason,
    });

  return executeMutation(
    async () => {
      const version =
        await ProductVersion.create(
          document,
        );

      return serializeCatalogProductVersion(
        version,
      );
    },
    "Product Version",
  );
}