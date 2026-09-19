import {
  CourseEntitlement,
  CreatorCourse,
  CreatorProfile,
} from '../community/community.models.js'

import {
  requireLearningCustomer,
} from './learning.access.service.js'

import {
  CourseProgress,
} from './learning.models.js'

function idOf(value) {
  if (value === null || value === undefined) {
    return null
  }

  return String(value?._id || value?.id || value)
}

function serializeCourse(course) {
  if (!course) {
    return null
  }

  return {
    id: idOf(course._id),
    creatorProfileId: idOf(course.creatorProfileId),
    slug: course.slug,
    title: course.title,
    summary: course.summary || '',
    category: course.category || '',
    language: course.language || 'en',
    accessType: course.accessType,
    requiredEquipment: course.requiredEquipment || [],
    commercialDisclosure: course.commercialDisclosure || '',
    sponsored: course.rights?.sponsored === true,
  }
}

function serializeProgress(progress) {
  return {
    completedRequiredLessons: progress?.completedRequiredLessons || 0,
    totalRequiredLessons: progress?.totalRequiredLessons || 0,
    percentComplete: progress?.percentComplete || 0,
    startedAt: progress?.startedAt || null,
    lastActivityAt: progress?.lastActivityAt || null,
    completedAt: progress?.completedAt || null,
  }
}

export async function getMyLearningDashboard({
  actorUser,
}) {
  const userId = requireLearningCustomer(actorUser)
  const now = new Date()

  const [entitlements, progressRows] = await Promise.all([
    CourseEntitlement.find({
      userId,
      status: 'active',
      startsAt: {
        $lte: now,
      },
      revokedAt: null,
      $or: [
        {
          endsAt: null,
        },
        {
          endsAt: {
            $gt: now,
          },
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .lean(),

    CourseProgress.find({
      userId,
    })
      .sort({
        lastActivityAt: -1,
        updatedAt: -1,
      })
      .lean(),
  ])

  const courseIds = [
    ...new Set([
      ...entitlements.map((item) => idOf(item.courseId)),
      ...progressRows.map((item) => idOf(item.courseId)),
    ].filter(Boolean)),
  ]

  const courses = courseIds.length
    ? await CreatorCourse.find({
        _id: {
          $in: courseIds,
        },
        status: 'listed',
        'rights.takedownState': 'clear',
      }).lean()
    : []

  const creatorProfileIds = [
    ...new Set(courses.map((item) => idOf(item.creatorProfileId)).filter(Boolean)),
  ]

  const creators = creatorProfileIds.length
    ? await CreatorProfile.find({
        _id: {
          $in: creatorProfileIds,
        },
        isPublic: true,
      })
        .select('_id displayName verificationStatus creatorType')
        .lean()
    : []

  const entitlementByCourseId = new Map(
    entitlements.map((item) => [idOf(item.courseId), item]),
  )

  const progressByCourseId = new Map(
    progressRows.map((item) => [idOf(item.courseId), item]),
  )

  const creatorById = new Map(
    creators.map((item) => [idOf(item._id), item]),
  )

  const items = courses
    .map((course) => {
      const courseId = idOf(course._id)
      const entitlement = entitlementByCourseId.get(courseId) || null
      const progress = progressByCourseId.get(courseId) || null
      const creator = creatorById.get(idOf(course.creatorProfileId)) || null

      const accessAllowed =
        course.accessType === 'free' || Boolean(entitlement)

      return {
        course: serializeCourse(course),
        creator: creator
          ? {
              id: idOf(creator._id),
              displayName: creator.displayName,
              creatorType: creator.creatorType,
              verificationStatus: creator.verificationStatus,
            }
          : null,
        entitlement: entitlement
          ? {
              id: idOf(entitlement._id),
              source: entitlement.source,
              status: entitlement.status,
              startsAt: entitlement.startsAt || null,
              endsAt: entitlement.endsAt || null,
            }
          : null,
        accessAllowed,
        progress: serializeProgress(progress),
      }
    })
    .sort((left, right) => {
      const leftTime = new Date(
        left.progress.lastActivityAt || left.progress.startedAt || 0,
      ).getTime()
      const rightTime = new Date(
        right.progress.lastActivityAt || right.progress.startedAt || 0,
      ).getTime()

      return rightTime - leftTime
    })

  return {
    summary: {
      activeCourses: items.filter((item) => item.accessAllowed).length,
      inProgress: items.filter(
        (item) =>
          item.progress.percentComplete > 0 &&
          item.progress.percentComplete < 100,
      ).length,
      completed: items.filter(
        (item) => item.progress.percentComplete >= 100,
      ).length,
    },
    courses: items,
    policy: {
      proIsApplicationRole: false,
      authorizationUsesActiveMode: false,
      entitlementAuthority: 'CourseEntitlement',
      progressIsLearnerOwned: true,
    },
  }
}
