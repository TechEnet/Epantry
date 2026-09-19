import mongoose from "mongoose";

import {
  ApiError,
} from "../../utils/ApiError.js";

import {
  normalizeAdminAuditReason,
  recordAdminAuditEvent,
} from "../admin/adminAudit.service.js";

import {
  ProductVersion,
} from "./catalog.models.js";

import {
  CatalogMergeDecision,
} from "./catalog.duplicate.models.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function stringifyId(
  value,
) {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return null;
  }

  return String(
    value,
  );
}

function actorIdFromUser(
  user,
) {
  return (
    user?._id ||
    user?.id ||
    null
  );
}

function normalizeGtin(
  value,
) {
  return String(
    value ||
      "",
  ).trim();
}

function sameId(
  left,
  right,
) {
  return (
    stringifyId(
      left,
    ) ===
    stringifyId(
      right,
    )
  );
}

function serializeDuplicateCandidate(
  version,
) {
  return {
    id:
      stringifyId(
        version._id ||
          version.id,
      ),

    packId:
      stringifyId(
        version.packId,
      ),

    variantId:
      stringifyId(
        version.variantId,
      ),

    version:
      version.version,

    displayName:
      version.displayName,

    gtin:
      version.gtin ||
      null,

    publicationStatus:
      version.publicationStatus,
  };
}

export function serializeCatalogMergeDecision(
  decision,
) {
  const value =
    typeof decision?.toObject ===
    "function"
      ? decision.toObject()
      : decision ||
        {};

  return {
    id:
      stringifyId(
        value._id ||
          value.id,
      ),

    sourceVersionId:
      stringifyId(
        value.sourceVersionId,
      ),

    targetVersionId:
      stringifyId(
        value.targetVersionId,
      ),

    matchType:
      value.matchType,

    sourceGtin:
      value.sourceGtin,

    targetGtin:
      value.targetGtin,

    reasonDetails:
      value.reasonDetails,

    decidedByUserId:
      stringifyId(
        value.decidedByUserId,
      ),

    decidedAt:
      value.decidedAt,

    requestId:
      value.requestId ||
      "",
  };
}

/*
|--------------------------------------------------------------------------
| Conservative Duplicate Assessment
|--------------------------------------------------------------------------
|
| M04 never guesses duplicates.
|
| Automatic merge eligibility requires:
|
| - two different ProductVersions
| - two different Packs
| - exact non-empty GTIN equality
| - source not already retired
| - target not retired
|
| Different versions of the SAME Pack are normal version history and are not
| duplicate catalog identities.
|
*/

export function buildDuplicateMergeAssessment({
  source,
  target,
}) {
  const blockers =
    [];

  if (
    !source ||
    !target
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_RECORD_MISSING",
    });

    return {
      ready:
        false,

      matchType:
        null,

      blockers,
    };
  }

  if (
    sameId(
      source._id ||
        source.id,
      target._id ||
        target.id,
    )
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_SELF_MERGE",
    });
  }

  if (
    sameId(
      source.packId,
      target.packId,
    )
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_SAME_PACK_HISTORY",
    });
  }

  const sourceGtin =
    normalizeGtin(
      source.gtin,
    );

  const targetGtin =
    normalizeGtin(
      target.gtin,
    );

  if (
    !sourceGtin ||
    !targetGtin
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_GTIN_REQUIRED",
    });
  } else if (
    sourceGtin !==
    targetGtin
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_GTIN_MISMATCH",
    });
  }

  if (
    source.publicationStatus ===
    "retired"
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_SOURCE_RETIRED",
    });
  }

  if (
    target.publicationStatus ===
    "retired"
  ) {
    blockers.push({
      code:
        "CATALOG_DUPLICATE_TARGET_RETIRED",
    });
  }

  return {
    ready:
      blockers.length ===
      0,

    matchType:
      blockers.length ===
      0
        ? "gtin_exact"
        : null,

    blockers,
  };
}

/*
|--------------------------------------------------------------------------
| Duplicate Candidates
|--------------------------------------------------------------------------
*/

export async function findProductVersionDuplicateCandidates(
  versionId,
) {
  const source =
    await ProductVersion.findById(
      versionId,
    ).lean();

  if (!source) {
    throw new ApiError(
      404,
      "Product Version was not found.",
      [
        {
          code:
            "CATALOG_VERSION_NOT_FOUND",
        },
      ],
    );
  }

  const gtin =
    normalizeGtin(
      source.gtin,
    );

  if (!gtin) {
    return {
      productVersionId:
        stringifyId(
          source._id,
        ),

      matchType:
        null,

      candidates:
        [],
    };
  }

  const candidates =
    await ProductVersion.find({
      _id: {
        $ne:
          source._id,
      },

      packId: {
        $ne:
          source.packId,
      },

      gtin,

      publicationStatus: {
        $ne:
          "retired",
      },
    })
      .sort({
        publicationStatus:
          1,

        version:
          -1,

        _id:
          1,
      })
      .lean();

  return {
    productVersionId:
      stringifyId(
        source._id,
      ),

    matchType:
      "gtin_exact",

    candidates:
      candidates.map(
        serializeDuplicateCandidate,
      ),
  };
}

/*
|--------------------------------------------------------------------------
| Non-destructive Duplicate Merge
|--------------------------------------------------------------------------
*/

export async function mergeDuplicateProductVersion({
  sourceVersionId,

  targetVersionId,

  reasonCode,

  reasonDetails,

  actorUser,

  adminAuthorization,

  requestId,
}) {
  /*
  |--------------------------------------------------------------------------
  | Validate controlled audit reason BEFORE mutation.
  |--------------------------------------------------------------------------
  */

  normalizeAdminAuditReason({
    action:
      "catalog.mutate",

    reasonCode,

    reasonDetails,
  });

  if (
    sameId(
      sourceVersionId,
      targetVersionId,
    )
  ) {
    throw new ApiError(
      409,
      "A Product Version cannot be merged into itself.",
      [
        {
          code:
            "CATALOG_DUPLICATE_SELF_MERGE",
        },
      ],
    );
  }

  const actorUserId =
    actorIdFromUser(
      actorUser,
    );

  let beforeSnapshot =
    null;

  let afterSnapshot =
    null;

  let targetSnapshot =
    null;

  let mergeDecision =
    null;

  let idempotent =
    false;

  const session =
    await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const existingDecision =
          await CatalogMergeDecision.findOne({
            sourceVersionId,
          })
            .session(
              session,
            );

        if (
          existingDecision
        ) {
          if (
            sameId(
              existingDecision.targetVersionId,
              targetVersionId,
            )
          ) {
            const [
              currentSource,
              currentTarget,
            ] =
              await Promise.all([
                ProductVersion.findById(
                  sourceVersionId,
                )
                  .session(
                    session,
                  )
                  .lean(),

                ProductVersion.findById(
                  targetVersionId,
                )
                  .session(
                    session,
                  )
                  .lean(),
              ]);

            mergeDecision =
              existingDecision;

            beforeSnapshot =
              currentSource;

            afterSnapshot =
              currentSource;

            targetSnapshot =
              currentTarget;

            idempotent =
              true;

            return;
          }

          throw new ApiError(
            409,
            "This duplicate Product Version already has a different merge decision.",
            [
              {
                code:
                  "CATALOG_DUPLICATE_ALREADY_MERGED",
              },
            ],
          );
        }

        const [
          source,
          target,
        ] =
          await Promise.all([
            ProductVersion.findById(
              sourceVersionId,
            )
              .session(
                session,
              ),

            ProductVersion.findById(
              targetVersionId,
            )
              .session(
                session,
              ),
          ]);

        if (
          !source ||
          !target
        ) {
          throw new ApiError(
            404,
            "Duplicate source or target Product Version was not found.",
            [
              {
                code:
                  "CATALOG_DUPLICATE_RECORD_MISSING",
              },
            ],
          );
        }

        const assessment =
          buildDuplicateMergeAssessment({
            source:
              source.toObject(),

            target:
              target.toObject(),
          });

        if (
          !assessment.ready
        ) {
          throw new ApiError(
            409,
            "Product Versions are not eligible for duplicate merge.",
            [
              {
                code:
                  "CATALOG_DUPLICATE_MERGE_BLOCKED",

                blockers:
                  assessment.blockers,
              },
            ],
          );
        }

        beforeSnapshot =
          source.toObject();

        targetSnapshot =
          target.toObject();

        const now =
          new Date();

        const [
          createdDecision,
        ] =
          await CatalogMergeDecision.create(
            [
              {
                sourceVersionId:
                  source._id,

                targetVersionId:
                  target._id,

                matchType:
                  assessment.matchType,

                sourceGtin:
                  normalizeGtin(
                    source.gtin,
                  ),

                targetGtin:
                  normalizeGtin(
                    target.gtin,
                  ),

                reasonDetails,

                decidedByUserId:
                  actorUserId,

                decidedAt:
                  now,

                requestId:
                  String(
                    requestId ||
                      "",
                  ),
              },
            ],
            {
              session,
            },
          );

        const result =
          await ProductVersion.updateOne(
            {
              _id:
                source._id,

              publicationStatus: {
                $ne:
                  "retired",
              },
            },
            {
              $set: {
                publicationStatus:
                  "retired",

                effectiveTo:
                  source.publicationStatus ===
                  "published"
                    ? now
                    : null,

                retiredAt:
                  now,

                retiredByUserId:
                  actorUserId,

                retireReason:
                  `Merged into canonical Product Version ${String(
                    target._id,
                  )}. ${reasonDetails}`.trim(),
              },
            },
            {
              session,
            },
          );

        if (
          result.modifiedCount !==
          1
        ) {
          throw new ApiError(
            409,
            "Duplicate source lifecycle changed before merge completed.",
            [
              {
                code:
                  "CATALOG_DUPLICATE_MERGE_CONFLICT",
              },
            ],
          );
        }

        mergeDecision =
          createdDecision;

        afterSnapshot =
          await ProductVersion.findById(
            source._id,
          )
            .session(
              session,
            )
            .lean();
      },
    );
  } finally {
    await session.endSession();
  }

  /*
  |--------------------------------------------------------------------------
  | Immutable privileged audit
  |--------------------------------------------------------------------------
  |
  | Mutation + merge decision are transactionally grouped.
  |
  | The existing admin audit store remains a separate durable write, matching
  | the current M03 architecture.
  |
  */

  if (
    !idempotent
  ) {
    await recordAdminAuditEvent({
      actorUser,

      adminAuthorization,

      action:
        "catalog.mutate",

      permissionKey:
        "catalog.mutate",

      entityType:
        "product_version",

      entityId:
        String(
          sourceVersionId,
        ),

      reasonCode,

      reasonDetails,

      beforeSnapshot,

      afterSnapshot,

      metadata: {
        operation:
          "duplicate_merge",

        matchType:
          "gtin_exact",

        sourceVersionId:
          String(
            sourceVersionId,
          ),

        targetVersionId:
          String(
            targetVersionId,
          ),

        sourcePackId:
          stringifyId(
            beforeSnapshot?.packId,
          ),

        targetPackId:
          stringifyId(
            targetSnapshot?.packId,
          ),
      },

      requestId,
    });
  }

  return {
    mergeDecision:
      serializeCatalogMergeDecision(
        mergeDecision,
      ),

    sourceProductVersion:
      afterSnapshot,

    targetProductVersion:
      targetSnapshot,

    idempotent,
  };
}