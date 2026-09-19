import mongoose from "mongoose";

import {
  ApiError,
} from "../../utils/ApiError.js";

import {
  recordAdminAuditEvent,
} from "../admin/adminAudit.service.js";

import {
  normalizeCatalogSlug,
} from "./catalog.constants.js";

import {
  Brand,
  CanonicalIngredient,
  Category,
  EvidenceSource,
  Pack,
  ProductFamily,
  ProductVariant,
  ProductVersion,
} from "./catalog.models.js";

import {
  assertDraftVersionEditable,
  serializeCatalogProductVersion,
} from "./catalog.admin.service.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function actorIdFromUser(
  actorUser,
) {
  const value =
    String(
      actorUser?._id ||
        actorUser?.id ||
        "",
    ).trim();

  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(
      value,
    )
  ) {
    throw new ApiError(
      401,
      "Authenticated catalog actor is required.",
      [
        {
          code:
            "CATALOG_ACTOR_REQUIRED",
        },
      ],
    );
  }

  return value;
}

function escapeRegex(
  value,
) {
  return String(
    value ||
      "",
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function serializeEntity(
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

  const {
    _id,
    __v,
    ...rest
  } = value;

  return {
    ...rest,

    id:
      _id
        ? String(_id)
        : null,
  };
}

function notFound(
  label,
) {
  return new ApiError(
    404,
    `${label} was not found.`,
    [
      {
        code:
          "CATALOG_ENTITY_NOT_FOUND",
      },
    ],
  );
}

async function requireDocument(
  Model,
  id,
  label,
) {
  const document =
    await Model.findById(
      id,
    );

  if (!document) {
    throw notFound(
      label,
    );
  }

  return document;
}

async function executeMutation(
  callback,
  label,
) {
  try {
    return await callback();
  } catch (error) {
    if (
      error?.code === 11000
    ) {
      throw new ApiError(
        409,
        `${label} already exists.`,
        [
          {
            code:
              "CATALOG_DUPLICATE",
          },
        ],
      );
    }

    throw error;
  }
}

function assertActive(
  document,
  label,
) {
  if (
    document?.status !==
    "active"
  ) {
    throw new ApiError(
      409,
      `${label} is not active.`,
      [
        {
          code:
            "CATALOG_REFERENCE_INACTIVE",
        },
      ],
    );
  }
}

/*
|--------------------------------------------------------------------------
| Ingredient Dictionary
|--------------------------------------------------------------------------
*/

export async function createCanonicalIngredient(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  if (
    input.parentId
  ) {
    const parent =
      await requireDocument(
        CanonicalIngredient,
        input.parentId,
        "Parent Ingredient",
      );

    assertActive(
      parent,
      "Parent Ingredient",
    );
  }

  return executeMutation(
    async () => {
      const ingredient =
        await CanonicalIngredient.create({
          ...input,

          slug:
            normalizeCatalogSlug(
              input.slug ||
                input.canonicalName,
            ),

          createdByUserId:
            actorUserId,

          updatedByUserId:
            actorUserId,
        });

      return serializeEntity(
        ingredient,
      );
    },
    "Canonical Ingredient",
  );
}

export async function updateCanonicalIngredient(
  ingredientId,
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  const ingredient =
    await requireDocument(
      CanonicalIngredient,
      ingredientId,
      "Canonical Ingredient",
    );

  if (
    input.parentId !==
    undefined
  ) {
    if (
      input.parentId &&
      String(input.parentId) ===
        String(ingredient._id)
    ) {
      throw new ApiError(
        409,
        "An Ingredient cannot be its own parent.",
        [
          {
            code:
              "CATALOG_INGREDIENT_CYCLE",
          },
        ],
      );
    }

    if (
      input.parentId
    ) {
      const parent =
        await requireDocument(
          CanonicalIngredient,
          input.parentId,
          "Parent Ingredient",
        );

      assertActive(
        parent,
        "Parent Ingredient",
      );
    }

    ingredient.parentId =
      input.parentId;
  }

  if (
    input.canonicalName !==
    undefined
  ) {
    ingredient.canonicalName =
      input.canonicalName;
  }

  if (
    input.slug !==
    undefined
  ) {
    ingredient.slug =
      normalizeCatalogSlug(
        input.slug,
      );
  }

  if (
    input.aliases !==
    undefined
  ) {
    ingredient.aliases =
      input.aliases;
  }

  if (
    input.attributes !==
    undefined
  ) {
    ingredient.attributes =
      input.attributes;
  }

  if (
    input.status !==
    undefined
  ) {
    ingredient.status =
      input.status;
  }

  ingredient.updatedByUserId =
    actorUserId;

  await executeMutation(
    () =>
      ingredient.save(),
    "Canonical Ingredient",
  );

  return serializeEntity(
    ingredient,
  );
}

export async function listCanonicalIngredients({
  page = 1,
  limit = 25,
  search = "",
  status = "active",
} = {}) {
  const filter =
    {};

  if (
    status !== "all"
  ) {
    filter.status =
      status;
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

      {
        aliases:
          expression,
      },
    ];
  }

  const skip =
    (page - 1) *
    limit;

  const [
    ingredients,
    total,
  ] =
    await Promise.all([
      CanonicalIngredient.find(
        filter,
      )
        .sort({
          canonicalName:
            1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      CanonicalIngredient.countDocuments(
        filter,
      ),
    ]);

  return {
    ingredients:
      ingredients.map(
        serializeEntity,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total === 0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Evidence Entity Validation
|--------------------------------------------------------------------------
*/

const evidenceEntityModels =
  Object.freeze({
    brand:
      Brand,

    category:
      Category,

    product_family:
      ProductFamily,

    product_variant:
      ProductVariant,

    pack:
      Pack,

    product_version:
      ProductVersion,

    ingredient:
      CanonicalIngredient,
  });

async function requireEvidenceEntity(
  entityType,
  entityId,
) {
  const Model =
    evidenceEntityModels[
      entityType
    ];

  if (!Model) {
    throw new ApiError(
      400,
      "Unsupported catalog evidence entity type.",
      [
        {
          code:
            "CATALOG_EVIDENCE_ENTITY_INVALID",
        },
      ],
    );
  }

  const entity =
    await Model.findById(
      entityId,
    )
      .select({
        _id:
          1,
      })
      .lean();

  if (!entity) {
    throw notFound(
      "Evidence target",
    );
  }

  return entity;
}

/*
|--------------------------------------------------------------------------
| Evidence
|--------------------------------------------------------------------------
*/

export async function createEvidenceSource(
  input,
  actorUser,
) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  await requireEvidenceEntity(
    input.entityType,
    input.entityId,
  );

  const evidence =
    await EvidenceSource.create({
      ...input,

      sourceUri:
        input.sourceUri ||
        "",

      capturedAt:
        input.capturedAt
          ? new Date(
              input.capturedAt,
            )
          : new Date(),

      createdByUserId:
        actorUserId,
    });

  return serializeEntity(
    evidence,
  );
}

export async function listEvidenceSources({
  entityType,
  entityId,
  page = 1,
  limit = 50,
}) {
  const skip =
    (page - 1) *
    limit;

  const filter = {
    entityType,

    entityId,
  };

  const [
    evidenceSources,
    total,
  ] =
    await Promise.all([
      EvidenceSource.find(
        filter,
      )
        .sort({
          capturedAt:
            -1,

          _id:
            -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      EvidenceSource.countDocuments(
        filter,
      ),
    ]);

  return {
    evidenceSources:
      evidenceSources.map(
        serializeEntity,
      ),

    pagination: {
      page,

      limit,

      total,

      pages:
        total === 0
          ? 0
          : Math.ceil(
              total /
                limit,
            ),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Governed Draft Facts
|--------------------------------------------------------------------------
*/

async function validateIngredientReferences(
  ingredients,
) {
  const ids = [
    ...new Set(
      (
        ingredients ||
        []
      )
        .map(
          (item) =>
            item.ingredientId,
        )
        .filter(Boolean)
        .map(String),
    ),
  ];

  if (
    ids.length === 0
  ) {
    return;
  }

  const count =
    await CanonicalIngredient.countDocuments({
      _id: {
        $in:
          ids,
      },

      status:
        "active",
    });

  if (
    count !==
    ids.length
  ) {
    throw new ApiError(
      409,
      "One or more Ingredient references are invalid or inactive.",
      [
        {
          code:
            "CATALOG_INGREDIENT_REFERENCE_INVALID",
        },
      ],
    );
  }
}

async function validateEvidenceReferences(
  versionId,
  facts,
) {
  const ids = [
    ...new Set([
      ...(
        facts.provenance ||
        []
      )
        .map(
          (item) =>
            item.evidenceSourceId,
        )
        .filter(Boolean),

      ...(
        facts.images ||
        []
      )
        .map(
          (item) =>
            item.evidenceSourceId,
        )
        .filter(Boolean),
    ].map(String)),
  ];

  if (
    ids.length === 0
  ) {
    return;
  }

  const count =
    await EvidenceSource.countDocuments({
      _id: {
        $in:
          ids,
      },

      entityType:
        "product_version",

      entityId:
        versionId,
    });

  if (
    count !==
    ids.length
  ) {
    throw new ApiError(
      409,
      "Product provenance must reference Evidence Sources belonging to this Product Version.",
      [
        {
          code:
            "CATALOG_PROVENANCE_REFERENCE_INVALID",
        },
      ],
    );
  }
}

export async function updateProductDraftFacts(
  versionId,
  input,
) {
  const version =
    await requireDocument(
      ProductVersion,
      versionId,
      "Product Version",
    );

  assertDraftVersionEditable(
    version,
  );

  if (
    input.ingredients !==
    undefined
  ) {
    await validateIngredientReferences(
      input.ingredients,
    );
  }

  await validateEvidenceReferences(
    version._id,
    input,
  );

  const mutableFields = [
    "ingredientDeclarationText",
    "ingredients",
    "nutrition",
    "allergens",
    "claims",
    "certifications",
    "images",
    "provenance",
  ];

  for (
    const field of
    mutableFields
  ) {
    if (
      input[field] !==
      undefined
    ) {
      version[field] =
        input[field];
    }
  }

  await version.save();

  return serializeCatalogProductVersion(
    version,
  );
}

/*
|--------------------------------------------------------------------------
| Publication Assessment
|--------------------------------------------------------------------------
*/

export function buildProductPublicationAssessment({
  version,
  evidenceSources = [],
}) {
  const blockers =
    [];

  if (
    version?.publicationStatus !==
    "in_review"
  ) {
    blockers.push({
      code:
        "VERSION_NOT_IN_REVIEW",

      message:
        "Product Version must be in review before publishing.",
    });
  }

  if (
    !String(
      version?.displayName ||
        "",
    ).trim()
  ) {
    blockers.push({
      code:
        "DISPLAY_NAME_REQUIRED",

      message:
        "Display name is required.",
    });
  }

  if (
    !version?.netQuantity ||
    Number(
      version.netQuantity.value,
    ) <= 0 ||
    !version.netQuantity.unit
  ) {
    blockers.push({
      code:
        "NET_QUANTITY_REQUIRED",

      message:
        "A valid net quantity is required.",
    });
  }

  if (
    !Array.isArray(
      evidenceSources,
    ) ||
    evidenceSources.length ===
      0
  ) {
    blockers.push({
      code:
        "EVIDENCE_REQUIRED",

      message:
        "At least one Evidence Source is required before publishing.",
    });
  }

  const unverifiedClaims =
    (
      version?.claims ||
      []
    ).filter(
      (claim) =>
        claim.evidenceState ===
        "unknown_review_required",
    );

  if (
    unverifiedClaims.length >
    0
  ) {
    blockers.push({
      code:
        "CLAIM_EVIDENCE_REQUIRED",

      message:
        "Consumer-facing claims require reviewed evidence before publishing.",
    });
  }

  const unverifiedCertifications =
    (
      version?.certifications ||
      []
    ).filter(
      (certification) =>
        certification.evidenceState ===
        "unknown_review_required",
    );

  if (
    unverifiedCertifications.length >
    0
  ) {
    blockers.push({
      code:
        "CERTIFICATION_EVIDENCE_REQUIRED",

      message:
        "Certifications require reviewed evidence before publishing.",
    });
  }

  const evidenceIds =
    new Set(
      (
        evidenceSources ||
        []
      ).map(
        (source) =>
          String(
            source._id ||
              source.id ||
              "",
          ),
      ),
    );

  const invalidProvenance =
    (
      version?.provenance ||
      []
    ).some(
      (entry) =>
        entry.evidenceSourceId &&
        !evidenceIds.has(
          String(
            entry.evidenceSourceId,
          ),
        ),
    );

  if (
    invalidProvenance
  ) {
    blockers.push({
      code:
        "PROVENANCE_EVIDENCE_INVALID",

      message:
        "Product provenance contains an Evidence Source that does not belong to this version.",
    });
  }

  return {
    ready:
      blockers.length ===
      0,

    blockers,
  };
}

/*
|--------------------------------------------------------------------------
| Hierarchy Check Before Publish
|--------------------------------------------------------------------------
*/

async function validatePublicationHierarchy(
  version,
) {
  const pack =
    await requireDocument(
      Pack,
      version.packId,
      "Pack",
    );

  assertActive(
    pack,
    "Pack",
  );

  const variant =
    await requireDocument(
      ProductVariant,
      version.variantId,
      "Product Variant",
    );

  assertActive(
    variant,
    "Product Variant",
  );

  const family =
    await requireDocument(
      ProductFamily,
      variant.familyId,
      "Product Family",
    );

  assertActive(
    family,
    "Product Family",
  );

  const [
    brand,
    category,
  ] =
    await Promise.all([
      requireDocument(
        Brand,
        family.brandId,
        "Brand",
      ),

      requireDocument(
        Category,
        family.categoryId,
        "Category",
      ),
    ]);

  assertActive(
    brand,
    "Brand",
  );

  assertActive(
    category,
    "Category",
  );
}

/*
|--------------------------------------------------------------------------
| Publish
|--------------------------------------------------------------------------
*/

export async function publishProductVersion({
  versionId,

  reasonCode,

  reasonDetails,

  actorUser,

  adminAuthorization,

  requestId,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  const version =
    await requireDocument(
      ProductVersion,
      versionId,
      "Product Version",
    );

  await validatePublicationHierarchy(
    version,
  );

  const evidenceSources =
    await EvidenceSource.find({
      entityType:
        "product_version",

      entityId:
        version._id,
    }).lean();

  const assessment =
    buildProductPublicationAssessment({
      version:
        version.toObject(),

      evidenceSources,
    });

  if (
    !assessment.ready
  ) {
    throw new ApiError(
      409,
      "Product Version is not ready for publication.",
      [
        {
          code:
            "CATALOG_PUBLICATION_BLOCKED",

          blockers:
            assessment.blockers,
        },
      ],
    );
  }

  const beforeSnapshot =
    serializeCatalogProductVersion(
      version,
    );

  const now =
    new Date();

  const result =
    await ProductVersion.updateOne(
      {
        _id:
          version._id,

        publicationStatus:
          "in_review",
      },
      {
        $set: {
          publicationStatus:
            "published",

          publishedAt:
            now,

          publishedByUserId:
            actorUserId,

          effectiveFrom:
            now,

          effectiveTo:
            null,

          retiredAt:
            null,

          retiredByUserId:
            null,

          retireReason:
            "",
        },
      },
    );

  if (
    result.modifiedCount !==
    1
  ) {
    throw new ApiError(
      409,
      "Product Version state changed before this request completed.",
      [
        {
          code:
            "CATALOG_PUBLICATION_CONFLICT",
        },
      ],
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Retire previously published version
  |--------------------------------------------------------------------------
  |
  | Public APIs will only expose the newest published version.
  |
  */

  await ProductVersion.updateMany(
    {
      _id: {
        $ne:
          version._id,
      },

      packId:
        version.packId,

      publicationStatus:
        "published",
    },
    {
      $set: {
        publicationStatus:
          "retired",

        effectiveTo:
          now,

        retiredAt:
          now,

        retiredByUserId:
          actorUserId,

        retireReason:
          `Superseded by Product Version ${version.version}.`,
      },
    },
  );

  const published =
    await ProductVersion.findById(
      version._id,
    );

  const afterSnapshot =
    serializeCatalogProductVersion(
      published,
    );

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      "catalog.publish",

    permissionKey:
      "catalog.publish",

    entityType:
      "product_version",

    entityId:
      String(
        version._id,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        "publish",

      version:
        version.version,

      packId:
        String(
          version.packId,
        ),

      evidenceSourceCount:
        evidenceSources.length,
    },

    requestId,
  });

  return {
    productVersion:
      afterSnapshot,

    assessment,
  };
}

/*
|--------------------------------------------------------------------------
| Retire / Unpublish
|--------------------------------------------------------------------------
*/

export async function retireProductVersion({
  versionId,

  reasonCode,

  reasonDetails,

  actorUser,

  adminAuthorization,

  requestId,
}) {
  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  const version =
    await requireDocument(
      ProductVersion,
      versionId,
      "Product Version",
    );

  if (
    version.publicationStatus ===
    "retired"
  ) {
    throw new ApiError(
      409,
      "Product Version is already retired.",
      [
        {
          code:
            "CATALOG_VERSION_ALREADY_RETIRED",
        },
      ],
    );
  }

  const beforeSnapshot =
    serializeCatalogProductVersion(
      version,
    );

  const now =
    new Date();

  const result =
    await ProductVersion.updateOne(
      {
        _id:
          version._id,

        publicationStatus:
          version.publicationStatus,
      },
      {
        $set: {
          publicationStatus:
            "retired",

          effectiveTo:
            now,

          retiredAt:
            now,

          retiredByUserId:
            actorUserId,

          retireReason:
            reasonDetails,
        },
      },
    );

  if (
    result.modifiedCount !==
    1
  ) {
    throw new ApiError(
      409,
      "Product Version publication state changed before this request completed.",
      [
        {
          code:
            "CATALOG_RETIRE_CONFLICT",
        },
      ],
    );
  }

  const retired =
    await ProductVersion.findById(
      version._id,
    );

  const afterSnapshot =
    serializeCatalogProductVersion(
      retired,
    );

  await recordAdminAuditEvent({
    actorUser,

    adminAuthorization,

    action:
      "catalog.publish",

    permissionKey:
      "catalog.publish",

    entityType:
      "product_version",

    entityId:
      String(
        version._id,
      ),

    reasonCode,

    reasonDetails,

    beforeSnapshot,

    afterSnapshot,

    metadata: {
      operation:
        "retire",

      previousPublicationStatus:
        version.publicationStatus,

      version:
        version.version,

      packId:
        String(
          version.packId,
        ),
    },

    requestId,
  });

  return afterSnapshot;
}