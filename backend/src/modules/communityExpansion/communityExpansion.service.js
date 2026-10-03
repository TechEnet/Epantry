import {
  env,
} from '../../config/env.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  recordAdminAuditEvent,
} from '../admin/adminAudit.service.js'

import {
  AdminFeatureFlag,
} from '../adminGovernance/adminGovernance.models.js'

import {
  CommunityRecipe,
  CommunityRecipeReview,
  CreatorCourse,
  CreatorProfile,
  RecipeFork,
} from '../community/community.models.js'

import {
  CourseLesson,
  CourseMediaAsset,
  CourseModule,
} from '../learning/learning.models.js'

import {
  notifyActiveSuperAdminsBestEffort,
} from '../notifications/notification.service.js'

import {
  CommunityReport,
  CreatorContent,
} from './communityExpansion.models.js'

export const M21_COMMUNITY_TRUST_FEATURE_FLAG =
  'm21.community_trust'

function stringId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(
    value?._id ||
      value?.id ||
      value,
  )
}

function actorId(actorUser) {
  const value =
    actorUser?._id ||
    actorUser?.id

  if (!value) {
    throw new ApiError(
      401,
      'Authenticated EPANTRY identity is required.',
      [
        {
          code:
            'M21_COMMUNITY_TRUST_ACTOR_REQUIRED',
        },
      ],
    )
  }

  return value
}

function serializeCreatorContent(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringId(
        item._id,
      ),

    creatorProfileId:
      stringId(
        item.creatorProfileId,
      ),

    contentType:
      item.contentType,

    contentId:
      stringId(
        item.contentId,
      ),

    sourceLineage:
      item.sourceLineage || {},

    rights:
      item.rights || {},

    governanceState:
      item.governanceState,

    reviewReason:
      item.reviewReason || '',

    reviewEvidenceRefs:
      item.reviewEvidenceRefs || [],

    reviewedAt:
      item.reviewedAt || null,

    createdAt:
      item.createdAt || null,

    updatedAt:
      item.updatedAt || null,
  }
}

function serializeCommunityReport(value) {
  const item =
    typeof value?.toObject ===
      'function'
      ? value.toObject()
      : value

  return {
    id:
      stringId(
        item._id,
      ),

    subjectType:
      item.subjectType,

    subjectId:
      stringId(
        item.subjectId,
      ),

    reason:
      item.reason,

    details:
      item.details || '',

    evidenceRefs:
      item.evidenceRefs || [],

    status:
      item.status,

    resolution: {
      action:
        item.resolution?.action ||
        'none',

      reason:
        item.resolution?.reason ||
        '',

      evidenceRefs:
        item.resolution
          ?.evidenceRefs ||
        [],

      resolvedAt:
        item.resolution
          ?.resolvedAt ||
        null,
    },

    createdAt:
      item.createdAt || null,

    updatedAt:
      item.updatedAt || null,
  }
}

export async function requireCommunityTrustFeature() {
  const flag =
    await AdminFeatureFlag.findOne({
      key:
        M21_COMMUNITY_TRUST_FEATURE_FLAG,

      enabled:
        true,

      environments:
        env.nodeEnv,
    }).lean()

  if (!flag) {
    throw new ApiError(
      404,
      'Community trust expansion is not enabled for this environment.',
      [
        {
          code:
            'M21_COMMUNITY_TRUST_FEATURE_DISABLED',

          featureFlagKey:
            M21_COMMUNITY_TRUST_FEATURE_FLAG,
        },
      ],
    )
  }

  return flag
}

async function requireOwnedCreatorProfile(
  actorUser,
) {
  const userId =
    actorId(
      actorUser,
    )

  const profile =
    await CreatorProfile.findOne({
      userId,
    })

  if (!profile) {
    throw new ApiError(
      404,
      'Creator profile was not found for this Host identity.',
      [
        {
          code:
            'M21_CREATOR_PROFILE_REQUIRED',
        },
      ],
    )
  }

  return profile
}

async function resolveOwnedContent({
  contentType,
  contentId,
  actorUser,
}) {
  const userId =
    actorId(
      actorUser,
    )

  if (
    contentType ===
    'community_recipe'
  ) {
    const record =
      await CommunityRecipe.findOne({
        _id:
          contentId,

        creatorUserId:
          userId,
      }).lean()

    if (!record) {
      throw new ApiError(
        404,
        'Owned Community Recipe was not found.',
        [
          {
            code:
              'M21_CREATOR_CONTENT_NOT_OWNED',
          },
        ],
      )
    }

    const lineage =
      await RecipeFork.findOne({
        forkedCommunityRecipeId:
          record._id,
      }).lean()

    return {
      record,

      sourceLineage:
        lineage
          ? {
              sourceContentType:
                'community_recipe',

              sourceContentId:
                stringId(
                  lineage.sourceCommunityRecipeId,
                ),

              attributionLabel:
                lineage.attributionLabel ||
                'Adapted from a community recipe',

              creatorProseCopied:
                lineage.copiedCreatorProse ===
                true,

              creatorMediaCopied:
                lineage.copiedCreatorMedia ===
                true,

              foodIntelligenceCopied:
                false,
            }
          : {
              sourceContentType:
                '',

              sourceContentId:
                '',

              attributionLabel:
                '',

              creatorProseCopied:
                false,

              creatorMediaCopied:
                false,

              foodIntelligenceCopied:
                false,
            },
    }
  }

  const record =
    await CreatorCourse.findOne({
      _id:
        contentId,

      createdByUserId:
        userId,
    }).lean()

  if (!record) {
    throw new ApiError(
      404,
      'Owned Creator Course was not found.',
      [
        {
          code:
            'M21_CREATOR_CONTENT_NOT_OWNED',
        },
      ],
    )
  }

  return {
    record,

    sourceLineage: {
      sourceContentType:
        record.linkedRecipeVersionId
          ? 'recipe_version'
          : 'professional_creator_course',

      sourceContentId:
        stringId(
          record.linkedRecipeVersionId ||
          record._id,
        ),

      attributionLabel:
        record.linkedRecipeVersionId
          ? 'Course includes a governed EPANTRY Recipe reference'
          : 'Original professional course created in EPANTRY Creator Studio',

      creatorProseCopied:
        false,

      creatorMediaCopied:
        false,

      foodIntelligenceCopied:
        false,
    },
  }
}

async function requireCreatorCourseReadyForReview(
  course,
) {
  if (
    ![
      'draft',
      'rejected',
    ].includes(
      course.status,
    )
  ) {
    throw new ApiError(
      409,
      course.status === 'in_review'
        ? 'This course is already waiting for Super Admin review.'
        : 'Only a draft or rejected course can be submitted for review.',
      [
        {
          code:
            'M4B_CREATOR_COURSE_NOT_SUBMITTABLE',
          courseStatus:
            course.status,
        },
      ],
    )
  }

  const [
    publishedModuleCount,
    publishedLessons,
  ] =
    await Promise.all([
      CourseModule.countDocuments({
        courseId:
          course._id,
        status:
          'published',
      }),
      CourseLesson.find({
        courseId:
          course._id,
        status:
          'published',
      })
        .select('_id lessonType')
        .lean(),
    ])

  if (
    publishedModuleCount < 1 ||
    publishedLessons.length < 1
  ) {
    throw new ApiError(
      409,
      'Add and publish at least one module and one lesson before submitting the course for Super Admin review.',
      [
        {
          code:
            'M4B_CREATOR_COURSE_CONTENT_REQUIRED',
        },
      ],
    )
  }

  const videoLessons =
    publishedLessons.filter(
      (lesson) =>
        [
          'video',
          'live_recording',
        ].includes(
          lesson.lessonType,
        ),
    )

  for (const lesson of videoLessons) {
    const availableMedia =
      await CourseMediaAsset.exists({
        courseId:
          course._id,
        lessonId:
          lesson._id,
        mediaType: {
          $in: [
            'video',
            'live_recording',
          ],
        },
        availabilityState:
          'available',
      })

    if (!availableMedia) {
      throw new ApiError(
        409,
        'Each published video lesson needs an available video or recording before the course can be submitted for review.',
        [
          {
            code:
              'M4B_CREATOR_VIDEO_MEDIA_REQUIRED',
            lessonId:
              stringId(
                lesson._id,
              ),
          },
        ],
      )
    }
  }
}

function creatorCourseRights(
  course,
) {
  return {
    ownerOrLicensor:
      course.rights?.ownerOrLicensor ||
      '',
    allowedTerritories:
      course.rights?.allowedTerritories ||
      [],
    publishFrom:
      null,
    publishUntil:
      null,
    downloadAllowed:
      course.rights?.downloadableMaterialsAllowed ===
      true,
    sponsored:
      course.rights?.sponsored ===
      true,
    sponsorLabel:
      'Sponsored',
    disclosureText:
      course.commercialDisclosure ||
      '',
  }
}

export async function registerCreatorContentGovernance({
  input,
  actorUser,
}) {
  await requireCommunityTrustFeature()

  const profile =
    await requireOwnedCreatorProfile(
      actorUser,
    )

  if (
    input.contentType ===
      'creator_course' &&
    !(
      profile.creatorType ===
        'chef' &&
      profile.verificationStatus ===
        'verified'
    )
  ) {
    throw new ApiError(
      403,
      'A verified Chef/Creator profile is required before professional course content can be submitted for review.',
      [
        {
          code:
            'M4B_VERIFIED_CREATOR_REQUIRED',
        },
      ],
    )
  }

  const {
    record,
    sourceLineage,
  } =
    await resolveOwnedContent({
      contentType:
        input.contentType,
      contentId:
        input.contentId,
      actorUser,
    })

  if (
    input.contentType ===
      'creator_course'
  ) {
    await requireCreatorCourseReadyForReview(
      record,
    )
  }

  const rights =
    input.contentType ===
      'creator_course'
      ? creatorCourseRights(
          record,
        )
      : input.rights

  if (!rights) {
    throw new ApiError(
      400,
      'Creator content rights information is required.',
      [
        {
          code:
            'M21_CREATOR_CONTENT_RIGHTS_REQUIRED',
        },
      ],
    )
  }

  if (
    rights.sponsored ===
      true &&
    String(
      rights.disclosureText ||
        '',
    ).trim().length < 5
  ) {
    throw new ApiError(
      400,
      'Sponsored creator content requires explicit commercial disclosure.',
      [
        {
          code:
            'M21_CREATOR_SPONSORED_DISCLOSURE_REQUIRED',
        },
      ],
    )
  }

  let governance =
    await CreatorContent.findOne({
      contentType:
        input.contentType,
      contentId:
        record._id,
    })

  const isResubmission =
    Boolean(
      governance,
    )

  if (
    governance &&
    governance.governanceState ===
      'approved'
  ) {
    return {
      creatorContent:
        serializeCreatorContent(
          governance,
        ),
      deduplicated:
        true,
    }
  }

  if (
    governance &&
    governance.governanceState ===
      'removed'
  ) {
    throw new ApiError(
      409,
      'Removed Creator content cannot be resubmitted without a separate Super Admin restoration decision.',
      [
        {
          code:
            'M4B_CREATOR_CONTENT_REMOVED',
        },
      ],
    )
  }

  if (!governance) {
    governance =
      new CreatorContent({
        creatorProfileId:
          profile._id,
        ownerUserId:
          actorId(
            actorUser,
          ),
        contentType:
          input.contentType,
        contentId:
          record._id,
        sourceLineage,
      })
  }

  governance.sourceLineage =
    sourceLineage

  governance.rights = {
    ownerOrLicensor:
      rights.ownerOrLicensor,
    allowedTerritories:
      [
        ...new Set(
          (
            rights.allowedTerritories ||
            []
          ).map(
            (value) =>
              String(value)
                .trim()
                .toUpperCase(),
          ),
        ),
      ],
    publishFrom:
      rights.publishFrom ||
      null,
    publishUntil:
      rights.publishUntil ||
      null,
    downloadAllowed:
      rights.downloadAllowed ===
      true,
    sponsored:
      rights.sponsored ===
      true,
    sponsorLabel:
      rights.sponsorLabel ||
      'Sponsored',
    disclosureText:
      rights.disclosureText ||
      '',
    takedownState:
      'clear',
  }

  governance.governanceState =
    'pending_review'
  governance.reviewReason =
    ''
  governance.reviewEvidenceRefs =
    []
  governance.reviewedByUserId =
    null
  governance.reviewedAt =
    null

  await governance.save()

  if (
    input.contentType ===
      'creator_course'
  ) {
    await CreatorCourse.updateOne(
      {
        _id:
          record._id,
        createdByUserId:
          actorId(
            actorUser,
          ),
      },
      {
        $set: {
          status:
            'in_review',
          'rights.takedownState':
            'clear',
        },
      },
      {
        runValidators:
          true,
      },
    )
  }

  await notifyActiveSuperAdminsBestEffort({
    triggerType:
      'creator_approval_requested',
    reasonCode:
      'creator.content_review_requested',
    explanation:
      input.contentType ===
        'creator_course'
        ? `${profile.displayName} submitted the course "${record.title}" for Super Admin review.`
        : `${profile.displayName} submitted professional Creator content for Super Admin review.`,
    relatedEntityType:
      'creator_content',
    relatedEntityId:
      stringId(
        governance._id,
      ),
    sourceDomain:
      'creator_studio',
    sourceVersion:
      'm4b-v1',
    dedupeScope:
      `creator-content-review:${stringId(governance._id)}:${governance.updatedAt?.toISOString() || Date.now()}`,
  })

  return {
    creatorContent:
      serializeCreatorContent(
        governance,
      ),
    deduplicated:
      false,
    resubmitted:
      isResubmission,
    policy: {
      superAdminApprovalRequired:
        true,
      creatorAssertionIsFoodTruth:
        false,
      foodIntelligenceCopiedFromParent:
        false,
      sponsoredDisclosureRequired:
        true,
      recipeOrCourseRightsTracked:
        true,
    },
  }
}

export async function listMyCreatorContent({
  actorUser,
}) {
  await requireCommunityTrustFeature()

  const userId =
    actorId(
      actorUser,
    )

  const records =
    await CreatorContent.find({
      ownerUserId:
        userId,
    })
      .sort({
        createdAt:
          -1,
      })
      .lean()

  return {
    creatorContent:
      records.map(
        serializeCreatorContent,
      ),
  }
}

export async function updateCommunityPrivacy({
  input,
  actorUser,
}) {
  await requireCommunityTrustFeature()

  const profile =
    await requireOwnedCreatorProfile(
      actorUser,
    )

  if (
    typeof input.profilePublic ===
    'boolean'
  ) {
    profile.isPublic =
      input.profilePublic

    await profile.save()
  }

  let recipe =
    null

  if (
    input.communityRecipeId &&
    input.recipeVisibility
  ) {
    recipe =
      await CommunityRecipe.findOne({
        _id:
          input.communityRecipeId,

        creatorUserId:
          actorId(
            actorUser,
          ),
      })

    if (!recipe) {
      throw new ApiError(
        404,
        'Owned Community Recipe was not found for privacy control.',
        [
          {
            code:
              'M21_COMMUNITY_RECIPE_PRIVACY_NOT_FOUND',
          },
        ],
      )
    }

    if (
      input.recipeVisibility ===
        'public' &&
      !(
        recipe.status ===
          'published' &&
        recipe.moderationState ===
          'approved'
      )
    ) {
      throw new ApiError(
        409,
        'Community Recipe cannot become public until existing M15/M07/M08 moderation and publication gates have passed.',
        [
          {
            code:
              'M21_COMMUNITY_PUBLICATION_GOVERNANCE_REQUIRED',
          },
        ],
      )
    }

    recipe.visibility =
      input.recipeVisibility

    await recipe.save()
  }

  return {
    privacy: {
      profilePublic:
        profile.isPublic ===
        true,

      communityRecipeId:
        recipe
          ? stringId(
              recipe._id,
            )
          : null,

      recipeVisibility:
        recipe?.visibility ||
        null,
    },

    policy: {
      pantryDataSharedToCommunity:
        false,

      householdDataSharedToCommunity:
        false,

      publicRecipeStillRequiresGovernance:
        true,
    },
  }
}

async function requireReportSubject({
  subjectType,
  subjectId,
}) {
  if (
    subjectType ===
    'community_recipe'
  ) {
    return CommunityRecipe.findById(
      subjectId,
    ).lean()
  }

  if (
    subjectType ===
    'creator_profile'
  ) {
    return CreatorProfile.findById(
      subjectId,
    ).lean()
  }

  if (
    subjectType ===
    'creator_course'
  ) {
    return CreatorCourse.findById(
      subjectId,
    ).lean()
  }

  return CommunityRecipeReview.findById(
    subjectId,
  ).lean()
}

export async function reportCommunityContent({
  input,
  idempotencyKey,
  actorUser,
}) {
  await requireCommunityTrustFeature()

  const userId =
    actorId(
      actorUser,
    )

  const existing =
    await CommunityReport.findOne({
      reporterUserId:
        userId,

      idempotencyKey,
    }).lean()

  if (existing) {
    return {
      report:
        serializeCommunityReport(
          existing,
        ),

      deduplicated:
        true,
    }
  }

  const subject =
    await requireReportSubject({
      subjectType:
        input.subjectType,

      subjectId:
        input.subjectId,
    })

  if (!subject) {
    throw new ApiError(
      404,
      'Community report subject was not found.',
      [
        {
          code:
            'M21_COMMUNITY_REPORT_SUBJECT_NOT_FOUND',
        },
      ],
    )
  }

  const created =
    await CommunityReport.create({
      reporterUserId:
        userId,

      subjectType:
        input.subjectType,

      subjectId:
        input.subjectId,

      reason:
        input.reason,

      details:
        input.details,

      evidenceRefs:
        input.evidenceRefs,

      idempotencyKey,

      status:
        'open',
    })

  return {
    report:
      serializeCommunityReport(
        created,
      ),

    deduplicated:
      false,
  }
}

export async function listAdminCommunityReports({
  status = '',
  limit = 100,
}) {
  await requireCommunityTrustFeature()

  const reports =
    await CommunityReport.find(
      status
        ? {
            status,
          }
        : {},
    )
      .sort({
        createdAt:
          1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  return {
    reports:
      reports.map(
        serializeCommunityReport,
      ),
  }
}

export async function listAdminCreatorContent({
  governanceState = '',
  limit = 100,
}) {
  await requireCommunityTrustFeature()

  const records =
    await CreatorContent.find(
      governanceState
        ? {
            governanceState,
          }
        : {},
    )
      .sort({
        createdAt:
          1,
      })
      .limit(
        Math.min(
          Math.max(
            Number(limit) ||
              100,
            1,
          ),
          200,
        ),
      )
      .lean()

  const items = []

  for (const record of records) {
    const [
      creator,
      course,
    ] =
      await Promise.all([
        CreatorProfile.findById(
          record.creatorProfileId,
        )
          .select('displayName slug creatorType verificationStatus')
          .lean(),
        record.contentType ===
          'creator_course'
          ? CreatorCourse.findById(
              record.contentId,
            )
              .select('title summary status accessType category language commercialDisclosure rights')
              .lean()
          : null,
      ])

    items.push({
      ...serializeCreatorContent(
        record,
      ),
      creator:
        creator
          ? {
              id:
                stringId(
                  creator._id,
                ),
              displayName:
                creator.displayName,
              slug:
                creator.slug,
              creatorType:
                creator.creatorType,
              verificationStatus:
                creator.verificationStatus,
            }
          : null,
      content:
        course
          ? {
              title:
                course.title,
              summary:
                course.summary ||
                '',
              status:
                course.status,
              accessType:
                course.accessType,
              category:
                course.category ||
                '',
              language:
                course.language ||
                'en',
              commercialDisclosure:
                course.commercialDisclosure ||
                '',
            }
          : null,
    })
  }

  return {
    creatorContent:
      items,
  }
}

export async function reviewAdminCreatorContent({
  creatorContentId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  await requireCommunityTrustFeature()

  const record =
    await CreatorContent.findById(
      creatorContentId,
    )

  if (!record) {
    throw new ApiError(
      404,
      'Creator content governance record was not found.',
      [
        {
          code:
            'M21_CREATOR_CONTENT_GOVERNANCE_NOT_FOUND',
        },
      ],
    )
  }

  const before =
    serializeCreatorContent(
      record,
    )

  record.governanceState =
    input.decision

  record.reviewReason =
    input.reason

  record.reviewEvidenceRefs =
    input.evidenceRefs

  record.reviewedByUserId =
    actorId(
      actorUser,
    )

  record.reviewedAt =
    new Date()

  if (
    input.decision ===
    'approved'
  ) {
    record.rights.takedownState =
      'clear'
  }

  if (
    input.decision ===
    'restricted'
  ) {
    record.rights.takedownState =
      'restricted'
  }

  if (
    input.decision ===
    'removed'
  ) {
    record.rights.takedownState =
      'removed'
  }

  await record.save()

  if (
    record.contentType ===
      'creator_course'
  ) {
    const nextCourseStatus =
      input.decision ===
        'approved'
        ? 'listed'
        : input.decision ===
          'removed'
          ? 'archived'
          : 'rejected'

    await CreatorCourse.updateOne(
      {
        _id:
          record.contentId,
      },
      {
        $set: {
          status:
            nextCourseStatus,
          'rights.takedownState':
            input.decision ===
              'approved'
              ? 'clear'
              : input.decision ===
                'removed'
                ? 'removed'
                : 'restricted',
        },
      },
      {
        runValidators:
          true,
      },
    )
  }

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    entityType:
      'creator_content',

    entityId:
      stringId(
        record._id,
      ),

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeCreatorContent(
        record,
      ),

    metadata: {
      operation:
        'm21_creator_content_governance',

      decision:
        input.decision,

      foodIntelligenceCopied:
        false,
    },

    requestId,
  })

  return {
    creatorContent:
      serializeCreatorContent(
        record,
      ),
  }
}

async function applyReportResolutionAction({
  report,
  action,
}) {
  if (
    action ===
      'dismiss' ||
    action ===
      'none'
  ) {
    return
  }

  if (
    report.subjectType ===
    'community_recipe'
  ) {
    const recipe =
      await CommunityRecipe.findById(
        report.subjectId,
      )

    if (!recipe) {
      return
    }

    if (
      action ===
      'quarantine_content'
    ) {
      recipe.moderationState =
        'quarantined'

      recipe.status =
        'pending_moderation'
    } else if (
      action ===
        'restrict_content' ||
      action ===
        'remove_content'
    ) {
      recipe.visibility =
        'private'

      recipe.status =
        action ===
          'remove_content'
          ? 'archived'
          : 'pending_moderation'

      recipe.moderationState =
        action ===
          'remove_content'
          ? 'rejected'
          : 'quarantined'
    }

    await recipe.save()

    return
  }

  if (
    report.subjectType ===
      'creator_profile' &&
    action ===
      'suspend_creator'
  ) {
    const profile =
      await CreatorProfile.findById(
        report.subjectId,
      )

    if (profile) {
      profile.verificationStatus =
        'suspended'

      profile.isPublic =
        false

      await profile.save()
    }

    return
  }

  if (
    report.subjectType ===
      'creator_course' &&
    (
      action ===
        'restrict_content' ||
      action ===
        'remove_content'
    )
  ) {
    const course =
      await CreatorCourse.findById(
        report.subjectId,
      )

    if (course) {
      course.status =
        'archived'

      course.rights.takedownState =
        action ===
          'remove_content'
          ? 'removed'
          : 'restricted'

      await course.save()
    }
  }
}

export async function resolveAdminCommunityReport({
  reportId,
  input,
  actorUser,
  adminAuthorization,
  requestId,
}) {
  await requireCommunityTrustFeature()

  const report =
    await CommunityReport.findOne({
      _id:
        reportId,

      status: {
        $in: [
          'open',
          'in_review',
        ],
      },
    })

  if (!report) {
    throw new ApiError(
      404,
      'Open Community report was not found.',
      [
        {
          code:
            'M21_COMMUNITY_REPORT_NOT_FOUND',
        },
      ],
    )
  }

  const before =
    serializeCommunityReport(
      report,
    )

  await applyReportResolutionAction({
    report,
    action:
      input.action,
  })

  report.status =
    input.action ===
      'dismiss'
      ? 'dismissed'
      : 'actioned'

  report.resolution = {
    action:
      input.action,

    reason:
      input.reason,

    evidenceRefs:
      input.evidenceRefs,

    resolvedByUserId:
      actorId(
        actorUser,
      ),

    resolvedAt:
      new Date(),
  }

  await report.save()

  await recordAdminAuditEvent({
    actorUser,
    adminAuthorization,

    action:
      'trust_safety.mutate',

    permissionKey:
      'trust_safety.mutate',

    entityType:
      'community_report',

    entityId:
      stringId(
        report._id,
      ),

    reasonCode:
      'trust_safety.enforcement',

    reasonDetails:
      input.reason,

    beforeSnapshot:
      before,

    afterSnapshot:
      serializeCommunityReport(
        report,
      ),

    metadata: {
      operation:
        'm21_community_report_resolution',

      action:
        input.action,

      directDatabaseDeletion:
        false,

      applicationRoleMutation:
        false,
    },

    requestId,
  })

  return {
    report:
      serializeCommunityReport(
        report,
      ),
  }
}