import {
    ApiError,
} from '../../utils/ApiError.js';

import {
    CourseEntitlement,
    CreatorCourse,
    CreatorProfile,
} from '../community/community.models.js';

function idOf(
    value,
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return String(
        value?._id ||
        value?.id ||
        value,
    );
}

export function requireLearningCustomer(
    actorUser,
) {
    const userId =
        actorUser?._id ||
        actorUser?.id;

    if (!userId) {
        throw new ApiError(
            401,
            'Authenticated EPANTRY Customer is required.',
            [
                {
                    code:
                        'LEARNING_AUTH_REQUIRED',
                },
            ],
        );
    }

    if (
        actorUser.customerEnabled !==
        true
    ) {
        throw new ApiError(
            403,
            'Customer access is required for EPANTRY learning.',
            [
                {
                    code:
                        'LEARNING_CUSTOMER_ACCESS_REQUIRED',
                },
            ],
        );
    }

    if (
        actorUser.accountStatus &&
        actorUser.accountStatus !==
            'active'
    ) {
        throw new ApiError(
            403,
            'This account is not active.',
            [
                {
                    code:
                        'LEARNING_ACCOUNT_INACTIVE',
                },
            ],
        );
    }

    return userId;
}

export async function findActiveCourseEntitlement({
    userId,
    courseId,
    now = new Date(),
}) {
    return CourseEntitlement.findOne({
        userId,
        courseId,

        status:
            'active',

        startsAt: {
            $lte:
                now,
        },

        revokedAt:
            null,

        $or: [
            {
                endsAt:
                    null,
            },

            {
                endsAt: {
                    $gt:
                        now,
                },
            },
        ],
    }).lean();
}

export async function getLearnerCourseAccess({
    courseId,
    actorUser,
    lesson = null,
    allowPreview = true,
}) {
    const userId =
        requireLearningCustomer(
            actorUser,
        );

    const course =
        await CreatorCourse.findOne({
            _id:
                courseId,

            status:
                'listed',

            'rights.takedownState':
                'clear',
        }).lean();

    if (!course) {
        throw new ApiError(
            404,
            'Learn / EPANTRY Pro course was not found.',
            [
                {
                    code:
                        'LEARNING_COURSE_NOT_FOUND',
                },
            ],
        );
    }

    if (
        course.accessType ===
        'free'
    ) {
        return {
            userId,
            course,
            entitlement:
                null,
            allowed:
                true,
            accessReason:
                'free_course',
        };
    }

    if (
        allowPreview &&
        lesson?.accessPolicy ===
            'preview'
    ) {
        return {
            userId,
            course,
            entitlement:
                null,
            allowed:
                true,
            accessReason:
                'preview_lesson',
        };
    }

    const entitlement =
        await findActiveCourseEntitlement({
            userId,
            courseId:
                course._id,
        });

    if (!entitlement) {
        return {
            userId,
            course,
            entitlement:
                null,
            allowed:
                false,
            accessReason:
                'course_entitlement_required',
        };
    }

    return {
        userId,
        course,
        entitlement,
        allowed:
            true,
        accessReason:
            'course_entitlement',
    };
}

export async function requireLearnerCourseAccess({
    courseId,
    actorUser,
    lesson = null,
    allowPreview = true,
}) {
    const access =
        await getLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview,
        });

    if (!access.allowed) {
        throw new ApiError(
            403,
            'An active Course entitlement is required for this Pro learning content.',
            [
                {
                    code:
                        'LEARNING_COURSE_ENTITLEMENT_REQUIRED',
                },
            ],
        );
    }

    return access;
}

export async function requireCourseAuthor({
    courseId,
    actorUser,
}) {
    const userId =
        requireLearningCustomer(
            actorUser,
        );

    const course =
        await CreatorCourse.findOne({
            _id:
                courseId,

            createdByUserId:
                userId,

            status: {
                $in: [
                    'draft',
                    'listed',
                ],
            },

            'rights.takedownState': {
                $ne:
                    'removed',
            },
        }).lean();

    if (!course) {
        throw new ApiError(
            404,
            'An editable Creator course owned by this account was not found.',
            [
                {
                    code:
                        'LEARNING_COURSE_AUTHOR_NOT_FOUND',
                },
            ],
        );
    }

    const creator =
        await CreatorProfile.findOne({
            _id:
                course.creatorProfileId,

            userId,

            creatorType:
                'chef',

            verificationStatus:
                'verified',

            isPublic:
                true,
        }).lean();

    if (!creator) {
        throw new ApiError(
            403,
            'A currently verified Chef/Creator profile is required to manage course learning content.',
            [
                {
                    code:
                        'LEARNING_VERIFIED_CREATOR_REQUIRED',
                },
            ],
        );
    }

    return {
        userId,
        course,
        creator,
    };
}

export function serializeLearningAccess({
    course,
    entitlement,
    accessReason,
    allowed = true,
}) {
    return {
        courseId:
            idOf(
                course?._id,
            ),

        accessType:
            course?.accessType ||
            null,

        allowed:
            allowed === true,

        accessReason,

        entitlement:
            entitlement
                ? {
                    id:
                        idOf(
                            entitlement._id,
                        ),

                    source:
                        entitlement.source,

                    status:
                        entitlement.status,

                    startsAt:
                        entitlement.startsAt ||
                        null,

                    endsAt:
                        entitlement.endsAt ||
                        null,
                }
                : null,

        policy: {
            proIsApplicationRole:
                false,

            authorizationUsesActiveMode:
                false,

            coreRecipeFactsRemainPublic:
                true,
        },
    };
}
