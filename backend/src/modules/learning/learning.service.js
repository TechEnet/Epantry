import mongoose from 'mongoose';

import {
    ApiError,
} from '../../utils/ApiError.js';

import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayPublicConfig,
    verifyRazorpayCheckoutSignature,
} from '../commerce/commerce.payment.provider.js';

import {
    RecipeVersion,
} from '../recipes/recipe.models.js';

import {
    getLearnerCourseAccess,
    requireCourseAuthor,
    requireLearnerCourseAccess,
    requireLearningCustomer,
    serializeLearningAccess,
} from './learning.access.service.js';

import {
    CourseLesson,
    CourseMediaAsset,
    CourseModule,
    CourseProgress,
    LessonBookmark,
    LessonNote,
    LessonProgress,
    PRO_PAYMENT_STATUSES,
    PRO_PLAN_CODES,
    ProMembership,
    ProMembershipPayment,
    ProPlan,
} from './learning.models.js';

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

function normalizedKey(
    value,
) {
    return String(
        value ||
            '',
    )
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            '-',
        )
        .replace(
            /^-+|-+$/g,
            '',
        )
        .slice(
            0,
            120,
        );
}

function serializeModule(
    module,
) {
    const value =
        typeof module?.toObject ===
        'function'
            ? module.toObject()
            : module;

    if (!value) {
        return null;
    }

    return {
        id:
            idOf(
                value._id ||
                    value.id,
            ),

        courseId:
            idOf(
                value.courseId,
            ),

        moduleKey:
            value.moduleKey,

        title:
            value.title,

        summary:
            value.summary ||
            '',

        sortOrder:
            value.sortOrder ||
            0,

        status:
            value.status,

        publishedAt:
            value.publishedAt ||
            null,
    };
}

function serializeLesson(
    lesson,
) {
    const value =
        typeof lesson?.toObject ===
        'function'
            ? lesson.toObject()
            : lesson;

    if (!value) {
        return null;
    }

    return {
        id:
            idOf(
                value._id ||
                    value.id,
            ),

        courseId:
            idOf(
                value.courseId,
            ),

        moduleId:
            idOf(
                value.moduleId,
            ),

        lessonKey:
            value.lessonKey,

        title:
            value.title,

        summary:
            value.summary ||
            '',

        lessonType:
            value.lessonType,

        accessPolicy:
            value.accessPolicy,

        sortOrder:
            value.sortOrder ||
            0,

        durationSeconds:
            value.durationSeconds ||
            0,

        bodyText:
            value.bodyText ||
            '',

        linkedRecipeVersionId:
            idOf(
                value.linkedRecipeVersionId,
            ),

        isRequiredForCompletion:
            value.isRequiredForCompletion !==
            false,

        status:
            value.status,

        publishedAt:
            value.publishedAt ||
            null,
    };
}

function serializeMediaAsset(
    media,
) {
    const value =
        typeof media?.toObject ===
        'function'
            ? media.toObject()
            : media;

    if (!value) {
        return null;
    }

    return {
        id:
            idOf(
                value._id ||
                    value.id,
            ),

        lessonId:
            idOf(
                value.lessonId,
            ),

        mediaType:
            value.mediaType,

        language:
            value.language ||
            '',

        label:
            value.label ||
            '',

        mimeType:
            value.mimeType ||
            '',

        durationSeconds:
            value.durationSeconds ||
            0,

        availabilityState:
            value.availabilityState,

        isDefault:
            value.isDefault ===
            true,

        downloadable:
            value.downloadable ===
            true,

        /*
        | The stable storage reference is intentionally NOT serialized to the
        | learner. Part 2 can resolve an authorized short-lived playback URL
        | through the media delivery boundary.
        */
        playbackUrl:
            null,
    };
}

function serializeLessonProgress(
    progress,
) {
    if (!progress) {
        return null;
    }

    const value =
        typeof progress.toObject ===
        'function'
            ? progress.toObject()
            : progress;

    return {
        id:
            idOf(
                value._id ||
                    value.id,
            ),

        lessonId:
            idOf(
                value.lessonId,
            ),

        status:
            value.status,

        completionPercent:
            value.completionPercent ||
            0,

        playbackPositionSeconds:
            value.playbackPositionSeconds ||
            0,

        playbackSpeed:
            value.playbackSpeed ||
            1,

        startedAt:
            value.startedAt ||
            null,

        lastActivityAt:
            value.lastActivityAt ||
            null,

        completedAt:
            value.completedAt ||
            null,
    };
}

function serializeCourseProgress(
    progress,
) {
    if (!progress) {
        return {
            completedRequiredLessons:
                0,

            totalRequiredLessons:
                0,

            percentComplete:
                0,

            startedAt:
                null,

            lastActivityAt:
                null,

            completedAt:
                null,
        };
    }

    const value =
        typeof progress.toObject ===
        'function'
            ? progress.toObject()
            : progress;

    return {
        completedRequiredLessons:
            value.completedRequiredLessons ||
            0,

        totalRequiredLessons:
            value.totalRequiredLessons ||
            0,

        percentComplete:
            value.percentComplete ||
            0,

        startedAt:
            value.startedAt ||
            null,

        lastActivityAt:
            value.lastActivityAt ||
            null,

        completedAt:
            value.completedAt ||
            null,
    };
}

async function requireCourseModule({
    courseId,
    moduleId,
}) {
    const module =
        await CourseModule.findOne({
            _id:
                moduleId,

            courseId,
        });

    if (!module) {
        throw new ApiError(
            404,
            'Course module was not found.',
            [
                {
                    code:
                        'LEARNING_MODULE_NOT_FOUND',
                },
            ],
        );
    }

    return module;
}

async function requireCourseLesson({
    courseId,
    lessonId,
    publishedOnly = false,
}) {
    const filter = {
        _id:
            lessonId,

        courseId,
    };

    if (publishedOnly) {
        filter.status =
            'published';
    }

    const lesson =
        await CourseLesson.findOne(
            filter,
        );

    if (!lesson) {
        throw new ApiError(
            404,
            'Course lesson was not found.',
            [
                {
                    code:
                        'LEARNING_LESSON_NOT_FOUND',
                },
            ],
        );
    }

    return lesson;
}

async function requirePublishedRecipeVersion(
    recipeVersionId,
) {
    if (!recipeVersionId) {
        return null;
    }

    const recipe =
        await RecipeVersion.findOne({
            _id:
                recipeVersionId,

            status:
                'published',
        })
            .select(
                '_id status',
            )
            .lean();

    if (!recipe) {
        throw new ApiError(
            409,
            'Recipe lesson must reference a published governed Recipe Version.',
            [
                {
                    code:
                        'LEARNING_RECIPE_VERSION_UNAVAILABLE',
                },
            ],
        );
    }

    return recipe;
}

function requireEditableCreatorCourse(
    course,
) {
    if (
        ![
            'draft',
            'rejected',
        ].includes(
            course?.status,
        )
    ) {
        throw new ApiError(
            409,
            course?.status ===
                'in_review'
                ? 'This course is waiting for Super Admin review and cannot be edited right now.'
                : 'Approved Creator courses cannot be edited directly. Create a new governed revision instead.',
            [
                {
                    code:
                        'M4B_CREATOR_COURSE_EDIT_LOCKED',
                    courseStatus:
                        course?.status ||
                        null,
                },
            ],
        );
    }
}

export async function createCourseModule({
    courseId,
    input,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const moduleKey =
        normalizedKey(
            input.moduleKey ||
                input.title,
        );

    if (!moduleKey) {
        throw new ApiError(
            400,
            'A valid module key is required.',
            [
                {
                    code:
                        'LEARNING_MODULE_KEY_INVALID',
                },
            ],
        );
    }

    const duplicate =
        await CourseModule.exists({
            courseId,
            moduleKey,
        });

    if (duplicate) {
        throw new ApiError(
            409,
            'This course already contains a module with that key.',
            [
                {
                    code:
                        'LEARNING_MODULE_KEY_CONFLICT',
                },
            ],
        );
    }

    const module =
        await CourseModule.create({
            courseId,
            moduleKey,
            title:
                input.title,
            summary:
                input.summary ||
                '',
            sortOrder:
                input.sortOrder ||
                0,
            status:
                'draft',
            createdByUserId:
                userId,
            updatedByUserId:
                userId,
        });

    return {
        module:
            serializeModule(
                module,
            ),
    };
}

export async function updateCourseModule({
    courseId,
    moduleId,
    input,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const module =
        await requireCourseModule({
            courseId,
            moduleId,
        });

    if (
        input.status ===
        'published'
    ) {
        const publishedLessonCount =
            await CourseLesson.countDocuments({
                courseId,
                moduleId:
                    module._id,
                status:
                    'published',
            });

        if (
            publishedLessonCount <
            1
        ) {
            throw new ApiError(
                409,
                'A module requires at least one published lesson before publication.',
                [
                    {
                        code:
                            'LEARNING_MODULE_PUBLISHED_LESSON_REQUIRED',
                    },
                ],
            );
        }
    }

    const nextStatus =
        input.status ||
        module.status;

    if (
        module.status ===
            'archived' &&
        nextStatus !==
            'archived'
    ) {
        throw new ApiError(
            409,
            'Archived course modules cannot be silently restored.',
            [
                {
                    code:
                        'LEARNING_MODULE_ARCHIVE_IMMUTABLE',
                },
            ],
        );
    }

    if (
        input.title !==
        undefined
    ) {
        module.title =
            input.title;
    }

    if (
        input.summary !==
        undefined
    ) {
        module.summary =
            input.summary;
    }

    if (
        input.sortOrder !==
        undefined
    ) {
        module.sortOrder =
            input.sortOrder;
    }

    if (
        input.status !==
        undefined
    ) {
        module.status =
            input.status;

        if (
            input.status ===
            'published'
        ) {
            module.publishedAt =
                module.publishedAt ||
                new Date();
        }

        if (
            input.status ===
            'archived'
        ) {
            module.archivedAt =
                new Date();
        }
    }

    module.updatedByUserId =
        userId;

    await module.save();

    return {
        module:
            serializeModule(
                module,
            ),
    };
}

export async function createCourseLesson({
    courseId,
    input,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const module =
        await requireCourseModule({
            courseId,
            moduleId:
                input.moduleId,
        });

    if (
        module.status ===
        'archived'
    ) {
        throw new ApiError(
            409,
            'Lessons cannot be added to an archived module.',
            [
                {
                    code:
                        'LEARNING_MODULE_ARCHIVED',
                },
            ],
        );
    }

    const lessonKey =
        normalizedKey(
            input.lessonKey ||
                input.title,
        );

    if (!lessonKey) {
        throw new ApiError(
            400,
            'A valid lesson key is required.',
            [
                {
                    code:
                        'LEARNING_LESSON_KEY_INVALID',
                },
            ],
        );
    }

    const duplicate =
        await CourseLesson.exists({
            courseId,
            lessonKey,
        });

    if (duplicate) {
        throw new ApiError(
            409,
            'This course already contains a lesson with that key.',
            [
                {
                    code:
                        'LEARNING_LESSON_KEY_CONFLICT',
                },
            ],
        );
    }

    if (
        input.lessonType ===
        'recipe'
    ) {
        await requirePublishedRecipeVersion(
            input.linkedRecipeVersionId,
        );
    }

    const lesson =
        await CourseLesson.create({
            courseId,
            moduleId:
                module._id,
            lessonKey,
            title:
                input.title,
            summary:
                input.summary ||
                '',
            lessonType:
                input.lessonType,
            accessPolicy:
                input.accessPolicy ||
                'course',
            sortOrder:
                input.sortOrder ||
                0,
            durationSeconds:
                input.durationSeconds ||
                0,
            bodyText:
                input.bodyText ||
                '',
            linkedRecipeVersionId:
                input.linkedRecipeVersionId ||
                null,
            isRequiredForCompletion:
                input.isRequiredForCompletion !==
                false,
            status:
                'draft',
            createdByUserId:
                userId,
            updatedByUserId:
                userId,
        });

    return {
        lesson:
            serializeLesson(
                lesson,
            ),
    };
}

export async function updateCourseLesson({
    courseId,
    lessonId,
    input,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
        });

    if (
        lesson.status ===
            'archived' &&
        input.status &&
        input.status !==
            'archived'
    ) {
        throw new ApiError(
            409,
            'Archived course lessons cannot be silently restored.',
            [
                {
                    code:
                        'LEARNING_LESSON_ARCHIVE_IMMUTABLE',
                },
            ],
        );
    }

    const nextBodyText =
        input.bodyText !==
        undefined
            ? input.bodyText
            : lesson.bodyText;

    const nextRecipeVersionId =
        input.linkedRecipeVersionId !==
        undefined
            ? input.linkedRecipeVersionId
            : lesson.linkedRecipeVersionId;

    if (
        lesson.lessonType ===
            'text' &&
        !String(
            nextBodyText ||
                '',
        ).trim()
    ) {
        throw new ApiError(
            409,
            'Text lessons require lesson body content.',
            [
                {
                    code:
                        'LEARNING_TEXT_BODY_REQUIRED',
                },
            ],
        );
    }

    if (
        lesson.lessonType ===
        'recipe'
    ) {
        await requirePublishedRecipeVersion(
            nextRecipeVersionId,
        );
    }

    if (
        input.status ===
        'published'
    ) {
        if (
            [
                'video',
                'live_recording',
            ].includes(
                lesson.lessonType,
            )
        ) {
            const availableMedia =
                await CourseMediaAsset.exists({
                    courseId,
                    lessonId:
                        lesson._id,
                    mediaType:
                        lesson.lessonType,
                    availabilityState:
                        'available',
                });

            if (!availableMedia) {
                throw new ApiError(
                    409,
                    'Video and recording lessons require an available governed media asset before publication.',
                    [
                        {
                            code:
                                'LEARNING_AVAILABLE_MEDIA_REQUIRED',
                        },
                    ],
                );
            }
        }
    }

    for (
        const field of [
            'title',
            'summary',
            'accessPolicy',
            'sortOrder',
            'durationSeconds',
            'bodyText',
            'linkedRecipeVersionId',
            'isRequiredForCompletion',
        ]
    ) {
        if (
            input[field] !==
            undefined
        ) {
            lesson[field] =
                input[field];
        }
    }

    if (
        input.status !==
        undefined
    ) {
        lesson.status =
            input.status;

        if (
            input.status ===
            'published'
        ) {
            lesson.publishedAt =
                lesson.publishedAt ||
                new Date();
        }

        if (
            input.status ===
            'archived'
        ) {
            lesson.archivedAt =
                new Date();
        }
    }

    lesson.updatedByUserId =
        userId;

    await lesson.save();

    return {
        lesson:
            serializeLesson(
                lesson,
            ),
    };
}

export async function registerCourseMediaAsset({
    courseId,
    input,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId:
                input.lessonId,
        });

    if (
        input.downloadable ===
            true &&
        course.rights
            ?.downloadableMaterialsAllowed !==
            true
    ) {
        throw new ApiError(
            409,
            'This course does not permit downloadable learning materials.',
            [
                {
                    code:
                        'LEARNING_DOWNLOAD_RIGHTS_REQUIRED',
                },
            ],
        );
    }

    const media =
        await CourseMediaAsset.create({
            courseId,
            lessonId:
                lesson._id,
            mediaType:
                input.mediaType,
            storageProvider:
                input.storageProvider,
            assetReference:
                input.assetReference,
            language:
                input.language ||
                '',
            label:
                input.label ||
                '',
            mimeType:
                input.mimeType ||
                '',
            durationSeconds:
                input.durationSeconds ||
                0,
            availabilityState:
                input.availabilityState ||
                'processing',
            isDefault:
                input.isDefault ===
                true,
            downloadable:
                input.downloadable ===
                true,
            rightsStatement:
                input.rightsStatement ||
                '',
            createdByUserId:
                userId,
            updatedByUserId:
                userId,
        });

    return {
        media:
            serializeMediaAsset(
                media,
            ),

        policy: {
            rawMediaStoredInMongo:
                false,

            learnerReceivesStableStorageReference:
                false,
        },
    };
}

export async function updateCourseMediaAvailability({
    courseId,
    mediaId,
    availabilityState,
    actorUser,
}) {
    const {
        userId,
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    requireEditableCreatorCourse(
        course,
    );

    const media =
        await CourseMediaAsset.findOne({
            _id:
                mediaId,
            courseId,
        });

    if (!media) {
        throw new ApiError(
            404,
            'Course media asset was not found.',
            [
                {
                    code:
                        'LEARNING_MEDIA_NOT_FOUND',
                },
            ],
        );
    }

    if (
        media.availabilityState ===
            'removed' &&
        availabilityState !==
            'removed'
    ) {
        throw new ApiError(
            409,
            'Removed course media cannot be silently restored.',
            [
                {
                    code:
                        'LEARNING_MEDIA_REMOVED_IMMUTABLE',
                },
            ],
        );
    }

    media.availabilityState =
        availabilityState;
    media.updatedByUserId =
        userId;

    await media.save();

    return {
        media:
            serializeMediaAsset(
                media,
            ),
    };
}

async function recomputeCourseProgress({
    userId,
    courseId,
    now = new Date(),
}) {
    const requiredLessonIds =
        await CourseLesson.find({
            courseId,
            status:
                'published',
            isRequiredForCompletion:
                true,
        }).distinct(
            '_id',
        );

    const totalRequiredLessons =
        requiredLessonIds.length;

    const completedRequiredLessons =
        totalRequiredLessons ===
        0
            ? 0
            : await LessonProgress.countDocuments({
                userId,
                courseId,
                lessonId: {
                    $in:
                        requiredLessonIds,
                },
                status:
                    'completed',
            });

    const percentComplete =
        totalRequiredLessons ===
        0
            ? 0
            : Math.round(
                (
                    completedRequiredLessons /
                    totalRequiredLessons
                ) *
                    100,
            );

    const existing =
        await CourseProgress.findOne({
            userId,
            courseId,
        });

    const startedAt =
        existing?.startedAt ||
        now;

    const completedAt =
        totalRequiredLessons > 0 &&
        completedRequiredLessons ===
            totalRequiredLessons
            ? existing?.completedAt ||
              now
            : null;

    const progress =
        await CourseProgress.findOneAndUpdate(
            {
                userId,
                courseId,
            },
            {
                $set: {
                    completedRequiredLessons,
                    totalRequiredLessons,
                    percentComplete,
                    startedAt,
                    lastActivityAt:
                        now,
                    completedAt,
                },
            },
            {
                new:
                    true,
                upsert:
                    true,
                setDefaultsOnInsert:
                    true,
            },
        );

    return progress;
}

export async function getCourseCurriculum({
    courseId,
    actorUser,
}) {
    const access =
        await getLearnerCourseAccess({
            courseId,
            actorUser,
            allowPreview:
                false,
        });

    const modules =
        await CourseModule.find({
            courseId,
            status:
                'published',
        })
            .sort({
                sortOrder:
                    1,
                _id:
                    1,
            })
            .lean();

    const moduleIds =
        modules.map(
            (item) =>
                item._id,
        );

    const lessons =
        moduleIds.length
            ? await CourseLesson.find({
                courseId,
                moduleId: {
                    $in:
                        moduleIds,
                },
                status:
                    'published',
            })
                .sort({
                    sortOrder:
                        1,
                    _id:
                        1,
                })
                .lean()
            : [];

    const progressRows =
        lessons.length
            ? await LessonProgress.find({
                userId:
                    access.userId,
                courseId,
                lessonId: {
                    $in:
                        lessons.map(
                            (item) =>
                                item._id,
                        ),
                },
            }).lean()
            : [];

    const progressByLessonId =
        new Map(
            progressRows.map(
                (item) => [
                    idOf(
                        item.lessonId,
                    ),
                    item,
                ],
            ),
        );

    const lessonsByModuleId =
        new Map();

    for (
        const lesson of lessons
    ) {
        const key =
            idOf(
                lesson.moduleId,
            );

        if (
            !lessonsByModuleId.has(
                key,
            )
        ) {
            lessonsByModuleId.set(
                key,
                [],
            );
        }

        lessonsByModuleId
            .get(
                key,
            )
            .push({
                id:
                    idOf(
                        lesson._id,
                    ),
                courseId:
                    idOf(
                        lesson.courseId,
                    ),
                moduleId:
                    idOf(
                        lesson.moduleId,
                    ),
                lessonKey:
                    lesson.lessonKey,
                title:
                    lesson.title,
                summary:
                    lesson.summary ||
                    '',
                lessonType:
                    lesson.lessonType,
                accessPolicy:
                    lesson.accessPolicy,
                sortOrder:
                    lesson.sortOrder ||
                    0,
                durationSeconds:
                    lesson.durationSeconds ||
                    0,
                isRequiredForCompletion:
                    lesson.isRequiredForCompletion !==
                    false,
                locked:
                    access.allowed !==
                        true &&
                    lesson.accessPolicy !==
                        'preview',
                progress:
                    serializeLessonProgress(
                        progressByLessonId.get(
                            idOf(
                                lesson._id,
                            ),
                        ),
                    ),
            });
    }

    const courseProgress =
        await CourseProgress.findOne({
            userId:
                access.userId,
            courseId,
        }).lean();

    return {
        course: {
            id:
                idOf(
                    access.course._id,
                ),
            slug:
                access.course.slug,
            title:
                access.course.title,
            summary:
                access.course.summary ||
                '',
            accessType:
                access.course.accessType,
        },

        access:
            serializeLearningAccess(
                access,
            ),

        progress:
            serializeCourseProgress(
                courseProgress,
            ),

        modules:
            modules.map(
                (module) => ({
                    ...serializeModule(
                        module,
                    ),
                    lessons:
                        lessonsByModuleId.get(
                            idOf(
                                module._id,
                            ),
                        ) ||
                        [],
                }),
            ),
    };
}

export async function getLessonLearningExperience({
    courseId,
    lessonId,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    const [
        media,
        progress,
        bookmarks,
        notes,
    ] =
        await Promise.all([
            CourseMediaAsset.find({
                courseId,
                lessonId,
                availabilityState:
                    'available',
            })
                .sort({
                    mediaType:
                        1,
                    isDefault:
                        -1,
                    createdAt:
                        1,
                })
                .lean(),

            LessonProgress.findOne({
                userId:
                    access.userId,
                courseId,
                lessonId,
            }).lean(),

            LessonBookmark.find({
                userId:
                    access.userId,
                courseId,
                lessonId,
            })
                .sort({
                    positionSeconds:
                        1,
                    createdAt:
                        1,
                })
                .lean(),

            LessonNote.find({
                userId:
                    access.userId,
                courseId,
                lessonId,
            })
                .sort({
                    updatedAt:
                        -1,
                })
                .lean(),
        ]);

    return {
        lesson:
            serializeLesson(
                lesson,
            ),

        access:
            serializeLearningAccess(
                access,
            ),

        media:
            media.map(
                serializeMediaAsset,
            ),

        progress:
            serializeLessonProgress(
                progress,
            ),

        bookmarks:
            bookmarks.map(
                (item) => ({
                    id:
                        idOf(
                            item._id,
                        ),
                    positionSeconds:
                        item.positionSeconds ||
                        0,
                    label:
                        item.label ||
                        '',
                    createdAt:
                        item.createdAt ||
                        null,
                }),
            ),

        notes:
            notes.map(
                (item) => ({
                    id:
                        idOf(
                            item._id,
                        ),
                    noteText:
                        item.noteText,
                    positionSeconds:
                        item.positionSeconds ??
                        null,
                    createdAt:
                        item.createdAt ||
                        null,
                    updatedAt:
                        item.updatedAt ||
                        null,
                }),
            ),

        policy: {
            mediaRequiresAuthorizedResolver:
                true,
            stableStorageReferenceExposed:
                false,
            captionsAndTranscriptsAreGovernedAssets:
                true,
        },
    };
}

export async function updateLessonProgress({
    courseId,
    lessonId,
    input,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    const now =
        new Date();

    const existing =
        await LessonProgress.findOne({
            userId:
                access.userId,
            lessonId,
        });

    const requestedStatus =
        input.status ||
        existing?.status ||
        'in_progress';

    let completionPercent =
        input.completionPercent ??
        existing?.completionPercent ??
        0;

    if (
        requestedStatus ===
        'completed'
    ) {
        completionPercent =
            100;
    }

    if (
        requestedStatus ===
            'not_started' &&
        (
            completionPercent > 0 ||
            (
                input.playbackPositionSeconds ??
                existing?.playbackPositionSeconds ??
                0
            ) > 0
        )
    ) {
        throw new ApiError(
            409,
            'A lesson with recorded activity cannot be marked not started.',
            [
                {
                    code:
                        'LEARNING_PROGRESS_STATE_CONFLICT',
                },
            ],
        );
    }

    const startedAt =
        requestedStatus ===
            'not_started'
            ? null
            : existing?.startedAt ||
              now;

    const completedAt =
        requestedStatus ===
            'completed'
            ? existing?.completedAt ||
              now
            : null;

    const progress =
        await LessonProgress.findOneAndUpdate(
            {
                userId:
                    access.userId,
                lessonId,
            },
            {
                $set: {
                    courseId,
                    status:
                        requestedStatus,
                    completionPercent,
                    playbackPositionSeconds:
                        input.playbackPositionSeconds ??
                        existing?.playbackPositionSeconds ??
                        0,
                    playbackSpeed:
                        input.playbackSpeed ??
                        existing?.playbackSpeed ??
                        1,
                    startedAt,
                    lastActivityAt:
                        requestedStatus ===
                        'not_started'
                            ? null
                            : now,
                    completedAt,
                },
            },
            {
                new:
                    true,
                upsert:
                    true,
                setDefaultsOnInsert:
                    true,
            },
        );

    const courseProgress =
        await recomputeCourseProgress({
            userId:
                access.userId,
            courseId,
            now,
        });

    return {
        lessonProgress:
            serializeLessonProgress(
                progress,
            ),
        courseProgress:
            serializeCourseProgress(
                courseProgress,
            ),
    };
}

export async function createLessonBookmark({
    courseId,
    lessonId,
    input,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    const bookmark =
        await LessonBookmark.findOneAndUpdate(
            {
                userId:
                    access.userId,
                lessonId,
                positionSeconds:
                    input.positionSeconds ||
                    0,
            },
            {
                $set: {
                    courseId,
                    label:
                        input.label ||
                        '',
                },
            },
            {
                new:
                    true,
                upsert:
                    true,
                setDefaultsOnInsert:
                    true,
            },
        );

    return {
        bookmark: {
            id:
                idOf(
                    bookmark._id,
                ),
            lessonId:
                idOf(
                    bookmark.lessonId,
                ),
            positionSeconds:
                bookmark.positionSeconds ||
                0,
            label:
                bookmark.label ||
                '',
        },
    };
}

export async function deleteLessonBookmark({
    courseId,
    lessonId,
    bookmarkId,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    const result =
        await LessonBookmark.deleteOne({
            _id:
                bookmarkId,
            userId:
                access.userId,
            courseId,
            lessonId,
        });

    if (
        result.deletedCount !==
        1
    ) {
        throw new ApiError(
            404,
            'Lesson bookmark was not found.',
            [
                {
                    code:
                        'LEARNING_BOOKMARK_NOT_FOUND',
                },
            ],
        );
    }

    return {
        deleted:
            true,
        bookmarkId:
            String(
                bookmarkId,
            ),
    };
}

export async function upsertLessonNote({
    courseId,
    lessonId,
    input,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    let note;

    if (
        input.noteId
    ) {
        note =
            await LessonNote.findOneAndUpdate(
                {
                    _id:
                        input.noteId,
                    userId:
                        access.userId,
                    courseId,
                    lessonId,
                },
                {
                    $set: {
                        noteText:
                            input.noteText,
                        positionSeconds:
                            input.positionSeconds ??
                            null,
                    },
                },
                {
                    new:
                        true,
                },
            );

        if (!note) {
            throw new ApiError(
                404,
                'Lesson note was not found.',
                [
                    {
                        code:
                            'LEARNING_NOTE_NOT_FOUND',
                    },
                ],
            );
        }
    } else {
        note =
            await LessonNote.create({
                userId:
                    access.userId,
                courseId,
                lessonId,
                noteText:
                    input.noteText,
                positionSeconds:
                    input.positionSeconds ??
                    null,
            });
    }

    return {
        note: {
            id:
                idOf(
                    note._id,
                ),
            lessonId:
                idOf(
                    note.lessonId,
                ),
            noteText:
                note.noteText,
            positionSeconds:
                note.positionSeconds ??
                null,
            createdAt:
                note.createdAt ||
                null,
            updatedAt:
                note.updatedAt ||
                null,
        },
    };
}

export async function deleteLessonNote({
    courseId,
    lessonId,
    noteId,
    actorUser,
}) {
    const lesson =
        await requireCourseLesson({
            courseId,
            lessonId,
            publishedOnly:
                true,
        });

    const access =
        await requireLearnerCourseAccess({
            courseId,
            actorUser,
            lesson,
            allowPreview:
                true,
        });

    const result =
        await LessonNote.deleteOne({
            _id:
                noteId,
            userId:
                access.userId,
            courseId,
            lessonId,
        });

    if (
        result.deletedCount !==
        1
    ) {
        throw new ApiError(
            404,
            'Lesson note was not found.',
            [
                {
                    code:
                        'LEARNING_NOTE_NOT_FOUND',
                },
            ],
        );
    }

    return {
        deleted:
            true,
        noteId:
            String(
                noteId,
            ),
    };
}

export async function getCreatorCourseCurriculum({
    courseId,
    actorUser,
}) {
    const {
        course,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

    const modules =
        await CourseModule.find({
            courseId,
        })
            .sort({
                sortOrder:
                    1,
                _id:
                    1,
            })
            .lean();

    const lessons =
        await CourseLesson.find({
            courseId,
        })
            .sort({
                moduleId:
                    1,
                sortOrder:
                    1,
                _id:
                    1,
            })
            .lean();

    const media =
        await CourseMediaAsset.find({
            courseId,
        })
            .sort({
                lessonId:
                    1,
                mediaType:
                    1,
                createdAt:
                    1,
            })
            .lean();

    const mediaByLessonId =
        new Map();

    for (
        const item of media
    ) {
        const key =
            idOf(
                item.lessonId,
            );

        if (
            !mediaByLessonId.has(
                key,
            )
        ) {
            mediaByLessonId.set(
                key,
                [],
            );
        }

        mediaByLessonId
            .get(
                key,
            )
            .push({
                ...serializeMediaAsset(
                    item,
                ),
                storage: {
                    provider:
                        item.storageProvider,
                    assetReference:
                        item.assetReference,
                },
                rightsStatement:
                    item.rightsStatement ||
                    '',
            });
    }

    const lessonsByModuleId =
        new Map();

    for (
        const lesson of lessons
    ) {
        const key =
            idOf(
                lesson.moduleId,
            );

        if (
            !lessonsByModuleId.has(
                key,
            )
        ) {
            lessonsByModuleId.set(
                key,
                [],
            );
        }

        lessonsByModuleId
            .get(
                key,
            )
            .push({
                ...serializeLesson(
                    lesson,
                ),
                media:
                    mediaByLessonId.get(
                        idOf(
                            lesson._id,
                        ),
                    ) ||
                    [],
            });
    }

    return {
        courseId:
            String(
                courseId,
            ),
        course: {
            id:
                String(
                    course._id,
                ),
            title:
                course.title,
            summary:
                course.summary ||
                '',
            status:
                course.status,
            accessType:
                course.accessType,
            commercialDisclosure:
                course.commercialDisclosure ||
                '',
            rights:
                course.rights ||
                {},
        },
        modules:
            modules.map(
                (module) => ({
                    ...serializeModule(
                        module,
                    ),
                    lessons:
                        lessonsByModuleId.get(
                            idOf(
                                module._id,
                            ),
                        ) ||
                        [],
                }),
            ),
        policy: {
            creatorMayManageOwnedCourseOnly:
                true,
            mediaReferencesAreAuthoringMetadata:
                true,
            courseEntitlementRemainsM15Authority:
                true,
        },
    };
}



const DEFAULT_PRO_BENEFITS = Object.freeze([
    'Premium EPANTRY courses and structured recipe learning',
    'Premium recipe libraries and chef-led technique tutorials',
    'Masterclasses and eligible live or small-group learning sessions',
    'Learning progress that continues across supported courses',
    'Lesson bookmarks, personal notes, captions and transcripts',
]);

export const DEFAULT_PRO_PLAN_CATALOG = Object.freeze([
    Object.freeze({
        code: 'monthly',
        name: 'Monthly',
        shortDescription: 'A simple one-month EPANTRY Pro pass.',
        priceMinor: 19900,
        currency: 'INR',
        validityMonths: 1,
        sortOrder: 10,
    }),
    Object.freeze({
        code: 'quarterly',
        name: 'Quarterly',
        shortDescription: 'Three months of uninterrupted Pro learning access.',
        priceMinor: 49900,
        currency: 'INR',
        validityMonths: 3,
        sortOrder: 20,
    }),
    Object.freeze({
        code: 'half_year',
        name: 'Half-year',
        shortDescription: 'Six months for customers learning regularly.',
        priceMinor: 89900,
        currency: 'INR',
        validityMonths: 6,
        sortOrder: 30,
    }),
    Object.freeze({
        code: 'annual',
        name: 'Annual',
        shortDescription: 'Twelve months of EPANTRY Pro learning access.',
        priceMinor: 149900,
        currency: 'INR',
        validityMonths: 12,
        sortOrder: 40,
    }),
]);

const PRO_PAYMENT_RECIPIENT = 'EPANTRY platform';
const PRO_REUSABLE_CHECKOUT_MINUTES = 30;

function razorpayModeFromKeyId(
    keyId,
) {
    const value = String(
        keyId || '',
    ).trim();

    if (value.startsWith('rzp_test_')) {
        return 'test';
    }

    if (value.startsWith('rzp_live_')) {
        return 'live';
    }

    return 'unknown';
}

function getProTestPaymentConfiguration() {
    const publicConfig =
        getRazorpayPublicConfig();

    const providerMode =
        razorpayModeFromKeyId(
            publicConfig.keyId,
        );

    return {
        publicConfig,
        providerMode,
        available:
            publicConfig.configured === true &&
            providerMode === 'test',
    };
}

function requireProTestPaymentConfiguration() {
    const configuration =
        getProTestPaymentConfiguration();

    if (!configuration.publicConfig.configured) {
        throw new ApiError(
            503,
            'Razorpay test payment is not configured for EPANTRY Pro.',
            [
                {
                    code:
                        'PRO_PAYMENT_PROVIDER_NOT_CONFIGURED',
                },
            ],
        );
    }

    if (configuration.providerMode !== 'test') {
        throw new ApiError(
            409,
            'EPANTRY Pro checkout is restricted to Razorpay test mode right now.',
            [
                {
                    code:
                        'PRO_PAYMENT_TEST_MODE_ONLY',
                },
            ],
        );
    }

    return configuration;
}

function addCalendarMonths(
    value,
    months,
) {
    const source = new Date(value);
    const result = new Date(source);
    const originalDay = result.getUTCDate();

    result.setUTCDate(1);
    result.setUTCMonth(
        result.getUTCMonth() + Number(months || 0),
    );

    const lastDay = new Date(
        Date.UTC(
            result.getUTCFullYear(),
            result.getUTCMonth() + 1,
            0,
        ),
    ).getUTCDate();

    result.setUTCDate(
        Math.min(originalDay, lastDay),
    );

    result.setUTCHours(
        source.getUTCHours(),
        source.getUTCMinutes(),
        source.getUTCSeconds(),
        source.getUTCMilliseconds(),
    );

    return result;
}

function serializeProPayment(
    value,
) {
    const payment =
        typeof value?.toObject === 'function'
            ? value.toObject()
            : value;

    if (!payment) {
        return null;
    }

    return {
        id: idOf(payment._id || payment.id),
        planId: idOf(payment.planId),
        planCode: payment.planCode,
        status: payment.status,
        amountMinor: Number(payment.amountMinor || 0),
        validityMonths: Number(payment.validityMonths || 0),
        currency: payment.currency || 'INR',
        provider: payment.provider || 'razorpay',
        providerMode: payment.providerMode || 'test',
        initiatedAt: payment.initiatedAt || null,
        paidAt: payment.paidAt || null,
        coverageStartAt: payment.coverageStartAt || null,
        coverageEndAt: payment.coverageEndAt || null,
        planLockUntil: payment.planLockUntil || null,
    };
}

function serializeProPlan(
    value,
) {
    const plan =
        typeof value?.toObject === 'function'
            ? value.toObject()
            : value;

    if (!plan) {
        return null;
    }

    return {
        id: idOf(plan._id || plan.id),
        code: plan.code,
        name: plan.name,
        shortDescription: plan.shortDescription || '',
        priceMinor: Number(plan.priceMinor || 0),
        currency: plan.currency || 'INR',
        validityMonths: Number(plan.validityMonths || 0),
        benefits: Array.isArray(plan.benefits)
            ? plan.benefits.filter(Boolean)
            : [],
        isEnabled: plan.isEnabled !== false,
        sortOrder: Number(plan.sortOrder || 0),
    };
}

async function ensureDefaultProPlans() {
    try {
        await ProPlan.bulkWrite(
            DEFAULT_PRO_PLAN_CATALOG.map((plan) => ({
                updateOne: {
                    filter: {
                        code: plan.code,
                    },
                    update: {
                        $setOnInsert: {
                            ...plan,
                            benefits: [
                                ...DEFAULT_PRO_BENEFITS,
                            ],
                            isEnabled: true,
                            updatedByAdminUserId: null,
                        },
                    },
                    upsert: true,
                },
            })),
            {
                ordered: false,
            },
        );
    } catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }
    }
}

export async function getPublicProCatalog() {
    await ensureDefaultProPlans();

    const plans =
        await ProPlan.find({
            isEnabled: true,
        })
            .sort({
                sortOrder: 1,
                priceMinor: 1,
            })
            .lean();

    const paymentConfiguration =
        getProTestPaymentConfiguration();

    return {
        product: {
            name: 'EPANTRY Pro',
            owner: 'EPANTRY',
            paymentProcessor: 'Razorpay',
        },
        benefits: [
            ...DEFAULT_PRO_BENEFITS,
        ],
        plans: plans
            .map(serializeProPlan)
            .filter(Boolean),
        policy: {
            customerProduct: true,
            proIsApplicationRole: false,
            checkoutAvailable:
                paymentConfiguration.available,
            paymentMode:
                paymentConfiguration.providerMode,
            testModeOnly: true,
            validityStacks: true,
            samePlanRepurchaseLockedUntilPlanWindowEnds: true,
        },
    };
}

export async function getProMembershipOverview({
    actorUser,
    now = new Date(),
}) {
    const userId =
        requireLearningCustomer(
            actorUser,
        );

    const catalog =
        await getPublicProCatalog();

    const [
        membership,
        activePlanLocks,
    ] =
        await Promise.all([
            ProMembership.findOne({
                userId,
            }).lean(),

            ProMembershipPayment.find({
                userId,
                status: 'paid',
                planLockUntil: {
                    $gt: now,
                },
            })
                .select(
                    'planCode planLockUntil paidAt',
                )
                .sort({
                    planLockUntil: -1,
                })
                .lean(),
        ]);

    const validUntil =
        membership?.validUntil
            ? new Date(membership.validUntil)
            : null;

    const active = Boolean(
        membership &&
        membership.status === 'active' &&
        validUntil &&
        validUntil.getTime() > now.getTime(),
    );

    const remainingDays =
        active
            ? Math.max(
                1,
                Math.ceil(
                    (validUntil.getTime() - now.getTime()) /
                    86400000,
                ),
            )
            : 0;

    const computedStatus =
        membership
            ? active
                ? 'active'
                : membership.status === 'suspended'
                    ? 'suspended'
                    : 'expired'
            : 'inactive';

    return {
        ...catalog,
        membership: {
            id: idOf(membership?._id),
            status: computedStatus,
            active,
            startedAt: membership?.startedAt || null,
            validUntil: membership?.validUntil || null,
            remainingDays,
            lastPlanId: idOf(membership?.lastPlanId),
            lastPlanCode: membership?.lastPlanCode || null,
            lastActivatedAt: membership?.lastActivatedAt || null,
        },
        purchaseLocks:
            activePlanLocks
                .filter((item, index, rows) =>
                    rows.findIndex(
                        (candidate) =>
                            candidate.planCode ===
                            item.planCode,
                    ) === index,
                )
                .map((item) => ({
                    planCode: item.planCode,
                    lockedUntil: item.planLockUntil,
                    paidAt: item.paidAt || null,
                })),
    };
}

export async function createProMembershipCheckout({
    planCode,
    actorUser,
    now = new Date(),
}) {
    const userId =
        requireLearningCustomer(
            actorUser,
        );

    await ensureDefaultProPlans();

    const plan =
        await ProPlan.findOne({
            code: planCode,
            isEnabled: true,
        });

    if (!plan) {
        throw new ApiError(
            404,
            'This EPANTRY Pro plan is not available.',
            [
                {
                    code:
                        'PRO_PLAN_NOT_AVAILABLE',
                },
            ],
        );
    }

    const suspendedMembership =
        await ProMembership.exists({
            userId,
            status: 'suspended',
        });

    if (suspendedMembership) {
        throw new ApiError(
            409,
            'EPANTRY Pro checkout is unavailable while this membership is suspended.',
            [
                {
                    code:
                        'PRO_MEMBERSHIP_SUSPENDED',
                },
            ],
        );
    }

    const planLock =
        await ProMembershipPayment.findOne({
            userId,
            planCode: plan.code,
            status: 'paid',
            planLockUntil: {
                $gt: now,
            },
        })
            .sort({
                planLockUntil: -1,
            })
            .lean();

    if (planLock) {
        throw new ApiError(
            409,
            'You already purchased this Pro plan for its current purchase window. You can choose a different plan now or buy this plan again after its lock date.',
            [
                {
                    code:
                        'PRO_PLAN_TEMPORARILY_LOCKED',
                    planCode: plan.code,
                    lockedUntil:
                        planLock.planLockUntil,
                },
            ],
        );
    }

    const {
        publicConfig,
        providerMode,
    } =
        requireProTestPaymentConfiguration();

    const reusableAfter =
        new Date(
            now.getTime() -
            PRO_REUSABLE_CHECKOUT_MINUTES * 60000,
        );

    const reusablePayment =
        await ProMembershipPayment.findOne({
            userId,
            planId: plan._id,
            status: 'initiated',
            providerOrderId: {
                $exists: true,
                $ne: '',
            },
            initiatedAt: {
                $gte: reusableAfter,
            },
        })
            .sort({
                initiatedAt: -1,
            })
            .lean();

    if (reusablePayment) {
        return {
            plan:
                serializeProPlan(plan),
            payment:
                serializeProPayment(
                    reusablePayment,
                ),
            checkout: {
                configured: true,
                provider: 'razorpay',
                mode: providerMode,
                keyId: publicConfig.keyId,
                providerOrderId:
                    reusablePayment.providerOrderId,
                amountMinor:
                    Number(plan.priceMinor),
                currency: plan.currency || 'INR',
                recipient:
                    PRO_PAYMENT_RECIPIENT,
            },
            reused: true,
        };
    }

    const payment =
        await ProMembershipPayment.create({
            userId,
            planId: plan._id,
            planCode: plan.code,
            status: 'initiated',
            amountMinor:
                Number(plan.priceMinor),
            validityMonths:
                Number(plan.validityMonths),
            currency: plan.currency || 'INR',
            provider: 'razorpay',
            providerMode,
            initiatedAt: now,
        });

    try {
        const providerOrder =
            await createRazorpayOrder({
                amountMinor:
                    Number(plan.priceMinor),
                currency:
                    plan.currency || 'INR',
                receipt:
                    `pro_${String(payment._id)}`.slice(
                        0,
                        40,
                    ),
                notes: {
                    purpose:
                        'epantry_pro_membership_test',
                    userId:
                        String(userId),
                    planCode:
                        plan.code,
                    proPaymentId:
                        String(payment._id),
                },
            });

        payment.providerOrderId =
            providerOrder.providerOrderId;

        await payment.save();

        return {
            plan:
                serializeProPlan(plan),
            payment:
                serializeProPayment(payment),
            checkout: {
                configured: true,
                provider: 'razorpay',
                mode: providerMode,
                keyId:
                    providerOrder.keyId ||
                    publicConfig.keyId,
                providerOrderId:
                    providerOrder.providerOrderId,
                amountMinor:
                    Number(plan.priceMinor),
                currency:
                    providerOrder.currency ||
                    plan.currency ||
                    'INR',
                recipient:
                    PRO_PAYMENT_RECIPIENT,
            },
            reused: false,
        };
    } catch (error) {
        payment.status = 'failed';
        payment.failureCode =
            error?.errors?.[0]?.code ||
            'PRO_PAYMENT_ORDER_FAILED';

        await payment.save();
        throw error;
    }
}

export async function verifyProMembershipPayment({
    paymentId,
    input,
    actorUser,
    now = new Date(),
}) {
    const userId =
        requireLearningCustomer(
            actorUser,
        );

    requireProTestPaymentConfiguration();

    const payment =
        await ProMembershipPayment.findOne({
            _id: paymentId,
            userId,
        });

    if (!payment) {
        throw new ApiError(
            404,
            'EPANTRY Pro payment was not found for this Customer.',
            [
                {
                    code:
                        'PRO_PAYMENT_NOT_FOUND',
                },
            ],
        );
    }

    if (payment.status === 'paid') {
        return {
            payment:
                serializeProPayment(payment),
            verified: true,
            deduplicated: true,
            ...(await getProMembershipOverview({
                actorUser,
                now,
            })),
        };
    }

    const providerOrderId =
        String(
            input.razorpayOrderId || '',
        ).trim();

    if (
        !payment.providerOrderId ||
        payment.providerOrderId !==
            providerOrderId
    ) {
        throw new ApiError(
            409,
            'This Razorpay order does not match the EPANTRY Pro checkout created for your account.',
            [
                {
                    code:
                        'PRO_PAYMENT_ORDER_MISMATCH',
                },
            ],
        );
    }

    const signatureValid =
        verifyRazorpayCheckoutSignature({
            providerOrderId,
            providerPaymentId:
                input.razorpayPaymentId,
            signature:
                input.razorpaySignature,
        });

    if (!signatureValid) {
        throw new ApiError(
            409,
            'EPANTRY could not verify the Razorpay payment signature.',
            [
                {
                    code:
                        'PRO_PAYMENT_SIGNATURE_INVALID',
                },
            ],
        );
    }

    const providerPayment =
        await fetchRazorpayPayment({
            providerPaymentId:
                input.razorpayPaymentId,
        });

    if (
        providerPayment.providerOrderId !==
            providerOrderId ||
        providerPayment.amountMinor !==
            Number(payment.amountMinor) ||
        providerPayment.currency !==
            String(payment.currency || 'INR').toUpperCase() ||
        providerPayment.captured !== true
    ) {
        throw new ApiError(
            409,
            'The Razorpay payment has not been captured for the expected EPANTRY Pro amount.',
            [
                {
                    code:
                        'PRO_PAYMENT_NOT_CAPTURED',
                },
            ],
        );
    }

    const plan =
        await ProPlan.findOne({
            _id: payment.planId,
            code: payment.planCode,
        }).lean();

    if (!plan) {
        throw new ApiError(
            409,
            'The EPANTRY Pro plan linked to this payment is no longer available.',
            [
                {
                    code:
                        'PRO_PAYMENT_PLAN_UNAVAILABLE',
                },
            ],
        );
    }

    const session =
        await mongoose.startSession();

    try {
        await session.withTransaction(
            async () => {
                const paymentInTransaction =
                    await ProMembershipPayment.findOne({
                        _id: payment._id,
                        userId,
                    }).session(session);

                if (!paymentInTransaction) {
                    throw new ApiError(
                        404,
                        'EPANTRY Pro payment was not found during activation.',
                        [
                            {
                                code:
                                    'PRO_PAYMENT_NOT_FOUND_DURING_ACTIVATION',
                            },
                        ],
                    );
                }

                if (paymentInTransaction.status === 'paid') {
                    return;
                }

                const membership =
                    await ProMembership.findOne({
                        userId,
                    }).session(session);

                if (membership?.status === 'suspended') {
                    throw new ApiError(
                        409,
                        'EPANTRY Pro membership is suspended and cannot be extended.',
                        [
                            {
                                code:
                                    'PRO_MEMBERSHIP_SUSPENDED',
                            },
                        ],
                    );
                }

                const existingValidUntil =
                    membership?.validUntil
                        ? new Date(
                            membership.validUntil,
                        )
                        : null;

                const coverageStartAt =
                    existingValidUntil &&
                    existingValidUntil.getTime() > now.getTime()
                        ? existingValidUntil
                        : now;

                const coverageEndAt =
                    addCalendarMonths(
                        coverageStartAt,
                        paymentInTransaction.validityMonths,
                    );

                const planLockUntil =
                    addCalendarMonths(
                        now,
                        paymentInTransaction.validityMonths,
                    );

                if (membership) {
                    membership.status = 'active';
                    membership.startedAt =
                        membership.startedAt ||
                        now;
                    membership.validUntil =
                        coverageEndAt;
                    membership.lastActivatedAt =
                        now;
                    membership.lastPlanId =
                        plan._id;
                    membership.lastPlanCode =
                        plan.code;

                    await membership.save({
                        session,
                    });
                } else {
                    await ProMembership.create(
                        [
                            {
                                userId,
                                status: 'active',
                                startedAt: now,
                                validUntil:
                                    coverageEndAt,
                                lastActivatedAt:
                                    now,
                                lastPlanId:
                                    plan._id,
                                lastPlanCode:
                                    plan.code,
                            },
                        ],
                        {
                            session,
                        },
                    );
                }

                paymentInTransaction.status =
                    'paid';
                paymentInTransaction.providerPaymentId =
                    providerPayment.providerPaymentId;
                paymentInTransaction.paidAt =
                    now;
                paymentInTransaction.coverageStartAt =
                    coverageStartAt;
                paymentInTransaction.coverageEndAt =
                    coverageEndAt;
                paymentInTransaction.planLockUntil =
                    planLockUntil;
                paymentInTransaction.failureCode =
                    '';

                await paymentInTransaction.save({
                    session,
                });
            },
        );
    } finally {
        await session.endSession();
    }

    const refreshedPayment =
        await ProMembershipPayment.findOne({
            _id: payment._id,
            userId,
        }).lean();

    return {
        payment:
            serializeProPayment(
                refreshedPayment,
            ),
        verified: true,
        deduplicated: false,
        ...(await getProMembershipOverview({
            actorUser,
            now,
        })),
    };
}


/*
|--------------------------------------------------------------------------
| M3-C - Super Admin EPANTRY Pro control plane
|--------------------------------------------------------------------------
|
| The Super Admin owns Pro plan configuration and can inspect subscription
| and Razorpay test-payment history. Existing paid validity is never shortened
| when a plan is edited or disabled; edits apply only to future checkouts.
|
*/

function normalizeAdminProPage(value) {
    return Math.max(
        1,
        Number(value) || 1,
    );
}

function normalizeAdminProLimit(value) {
    return Math.min(
        100,
        Math.max(
            1,
            Number(value) || 25,
        ),
    );
}

function serializeAdminProUser(value) {
    if (!value) {
        return null;
    }

    return {
        id: idOf(value),
        name: value.name || '',
        email: value.email || '',
    };
}

function serializeAdminProMembership(value, now = new Date()) {
    const membership =
        typeof value?.toObject === 'function'
            ? value.toObject()
            : value;

    if (!membership) {
        return null;
    }

    const validUntil = membership.validUntil
        ? new Date(membership.validUntil)
        : null;

    const active = Boolean(
        membership.status === 'active' &&
        validUntil &&
        validUntil.getTime() > now.getTime(),
    );

    const computedStatus =
        membership.status === 'suspended'
            ? 'suspended'
            : active
                ? 'active'
                : 'expired';

    const remainingDays = active
        ? Math.max(
            1,
            Math.ceil(
                (validUntil.getTime() - now.getTime()) / 86400000,
            ),
        )
        : 0;

    return {
        id: idOf(membership._id || membership.id),
        user: serializeAdminProUser(membership.userId),
        status: computedStatus,
        active,
        startedAt: membership.startedAt || null,
        validUntil: membership.validUntil || null,
        remainingDays,
        lastActivatedAt: membership.lastActivatedAt || null,
        lastPlanCode: membership.lastPlanCode || null,
        lastPlan: membership.lastPlanId
            ? {
                id: idOf(membership.lastPlanId),
                code: membership.lastPlanId.code || membership.lastPlanCode || '',
                name: membership.lastPlanId.name || '',
                validityMonths: Number(membership.lastPlanId.validityMonths || 0),
            }
            : null,
        createdAt: membership.createdAt || null,
        updatedAt: membership.updatedAt || null,
    };
}

function serializeAdminProPayment(value) {
    const payment =
        typeof value?.toObject === 'function'
            ? value.toObject()
            : value;

    if (!payment) {
        return null;
    }

    return {
        id: idOf(payment._id || payment.id),
        user: serializeAdminProUser(payment.userId),
        plan: payment.planId
            ? {
                id: idOf(payment.planId),
                code: payment.planId.code || payment.planCode || '',
                name: payment.planId.name || '',
            }
            : null,
        planCode: payment.planCode,
        status: payment.status,
        amountMinor: Number(payment.amountMinor || 0),
        validityMonths: Number(payment.validityMonths || 0),
        currency: payment.currency || 'INR',
        provider: payment.provider || 'razorpay',
        providerMode: payment.providerMode || 'test',
        providerOrderId: payment.providerOrderId || null,
        providerPaymentId: payment.providerPaymentId || null,
        initiatedAt: payment.initiatedAt || null,
        paidAt: payment.paidAt || null,
        coverageStartAt: payment.coverageStartAt || null,
        coverageEndAt: payment.coverageEndAt || null,
        failureCode: payment.failureCode || '',
        createdAt: payment.createdAt || null,
        updatedAt: payment.updatedAt || null,
    };
}

export async function getAdminProOverview({
    now = new Date(),
} = {}) {
    await ensureDefaultProPlans();

    const [
        plans,
        totalMemberships,
        activeMemberships,
        suspendedMemberships,
        paymentCounts,
        paidRevenue,
    ] = await Promise.all([
        ProPlan.find({})
            .sort({
                sortOrder: 1,
                priceMinor: 1,
            })
            .lean(),

        ProMembership.countDocuments({}),

        ProMembership.countDocuments({
            status: 'active',
            validUntil: {
                $gt: now,
            },
        }),

        ProMembership.countDocuments({
            status: 'suspended',
        }),

        ProMembership.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]),

        ProMembershipPayment.aggregate([
            {
                $match: {
                    status: 'paid',
                },
            },
            {
                $group: {
                    _id: null,
                    amountMinor: {
                        $sum: '$amountMinor',
                    },
                    count: {
                        $sum: 1,
                    },
                },
            },
        ]),
    ]);

    const paymentStatusCounts = Object.fromEntries(
        PRO_PAYMENT_STATUSES.map((status) => [status, 0]),
    );

    for (const row of paymentCounts) {
        if (row?._id in paymentStatusCounts) {
            paymentStatusCounts[row._id] = Number(row.count || 0);
        }
    }

    const expiredMemberships = Math.max(
        0,
        Number(totalMemberships || 0) -
        Number(activeMemberships || 0) -
        Number(suspendedMemberships || 0),
    );

    return {
        product: {
            name: 'EPANTRY Pro',
            merchantOwner: 'EPANTRY / Super Admin',
            paymentProcessor: 'Razorpay',
            paymentMode: 'test',
        },
        plans: plans.map(serializeProPlan).filter(Boolean),
        summary: {
            memberships: {
                total: Number(totalMemberships || 0),
                active: Number(activeMemberships || 0),
                expired: expiredMemberships,
                suspended: Number(suspendedMemberships || 0),
            },
            payments: {
                ...paymentStatusCounts,
                paidRevenueMinor: Number(paidRevenue?.[0]?.amountMinor || 0),
                paidCount: Number(paidRevenue?.[0]?.count || 0),
                currency: 'INR',
            },
        },
        policy: {
            planChangesAffectFutureCheckoutsOnly: true,
            existingPaidValidityIsPreserved: true,
            refundAutomationAvailable: false,
        },
    };
}

export async function listAdminProMemberships({
    status = 'all',
    page = 1,
    limit = 25,
    now = new Date(),
} = {}) {
    const normalizedStatus = String(status || 'all').trim().toLowerCase();
    const allowedStatuses = ['all', 'active', 'expired', 'suspended'];

    if (!allowedStatuses.includes(normalizedStatus)) {
        throw new ApiError(
            400,
            'Invalid EPANTRY Pro membership status filter.',
            [
                {
                    code: 'ADMIN_PRO_MEMBERSHIP_STATUS_INVALID',
                    allowedStatuses,
                },
            ],
        );
    }

    const normalizedPage = normalizeAdminProPage(page);
    const normalizedLimit = normalizeAdminProLimit(limit);
    const filter = {};

    if (normalizedStatus === 'active') {
        filter.status = 'active';
        filter.validUntil = {
            $gt: now,
        };
    } else if (normalizedStatus === 'suspended') {
        filter.status = 'suspended';
    } else if (normalizedStatus === 'expired') {
        filter.$or = [
            {
                status: 'expired',
            },
            {
                status: 'active',
                validUntil: {
                    $lte: now,
                },
            },
            {
                status: 'active',
                validUntil: null,
            },
        ];
    }

    const skip = (normalizedPage - 1) * normalizedLimit;

    const [rows, total] = await Promise.all([
        ProMembership.find(filter)
            .populate('userId', 'name email')
            .populate('lastPlanId', 'code name validityMonths')
            .sort({
                validUntil: -1,
                updatedAt: -1,
            })
            .skip(skip)
            .limit(normalizedLimit)
            .lean(),

        ProMembership.countDocuments(filter),
    ]);

    return {
        memberships: rows
            .map((row) => serializeAdminProMembership(row, now))
            .filter(Boolean),
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            totalPages: total === 0
                ? 0
                : Math.ceil(total / normalizedLimit),
        },
        filter: {
            status: normalizedStatus,
        },
    };
}

export async function listAdminProPayments({
    status = 'all',
    page = 1,
    limit = 25,
} = {}) {
    const normalizedStatus = String(status || 'all').trim().toLowerCase();
    const allowedStatuses = ['all', ...PRO_PAYMENT_STATUSES];

    if (!allowedStatuses.includes(normalizedStatus)) {
        throw new ApiError(
            400,
            'Invalid EPANTRY Pro payment status filter.',
            [
                {
                    code: 'ADMIN_PRO_PAYMENT_STATUS_INVALID',
                    allowedStatuses,
                },
            ],
        );
    }

    const normalizedPage = normalizeAdminProPage(page);
    const normalizedLimit = normalizeAdminProLimit(limit);
    const filter = normalizedStatus === 'all'
        ? {}
        : {
            status: normalizedStatus,
        };
    const skip = (normalizedPage - 1) * normalizedLimit;

    const [rows, total] = await Promise.all([
        ProMembershipPayment.find(filter)
            .populate('userId', 'name email')
            .populate('planId', 'code name')
            .sort({
                createdAt: -1,
                _id: -1,
            })
            .skip(skip)
            .limit(normalizedLimit)
            .lean(),

        ProMembershipPayment.countDocuments(filter),
    ]);

    return {
        payments: rows
            .map(serializeAdminProPayment)
            .filter(Boolean),
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            totalPages: total === 0
                ? 0
                : Math.ceil(total / normalizedLimit),
        },
        filter: {
            status: normalizedStatus,
        },
    };
}

export async function updateAdminProPlan({
    planCode,
    input = {},
    actorUser,
}) {
    await ensureDefaultProPlans();

    const normalizedPlanCode = String(planCode || '').trim().toLowerCase();

    if (!PRO_PLAN_CODES.includes(normalizedPlanCode)) {
        throw new ApiError(
            400,
            'Invalid EPANTRY Pro plan.',
            [
                {
                    code: 'ADMIN_PRO_PLAN_CODE_INVALID',
                },
            ],
        );
    }

    const allowedKeys = new Set([
        'priceMinor',
        'shortDescription',
        'benefits',
        'isEnabled',
    ]);

    const unknownKeys = Object.keys(input || {}).filter(
        (key) => !allowedKeys.has(key),
    );

    if (unknownKeys.length > 0) {
        throw new ApiError(
            400,
            'Unsupported EPANTRY Pro plan field.',
            [
                {
                    code: 'ADMIN_PRO_PLAN_FIELD_INVALID',
                    fields: unknownKeys,
                },
            ],
        );
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(input, 'priceMinor')) {
        const priceMinor = Number(input.priceMinor);

        if (!Number.isInteger(priceMinor) || priceMinor < 1 || priceMinor > 100000000) {
            throw new ApiError(
                400,
                'EPANTRY Pro price must be a valid positive amount.',
                [
                    {
                        code: 'ADMIN_PRO_PLAN_PRICE_INVALID',
                    },
                ],
            );
        }

        updates.priceMinor = priceMinor;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'shortDescription')) {
        const shortDescription = String(input.shortDescription || '').trim();

        if (shortDescription.length > 600) {
            throw new ApiError(
                400,
                'EPANTRY Pro plan description is too long.',
                [
                    {
                        code: 'ADMIN_PRO_PLAN_DESCRIPTION_INVALID',
                    },
                ],
            );
        }

        updates.shortDescription = shortDescription;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'benefits')) {
        if (!Array.isArray(input.benefits)) {
            throw new ApiError(
                400,
                'EPANTRY Pro benefits must be a list.',
                [
                    {
                        code: 'ADMIN_PRO_PLAN_BENEFITS_INVALID',
                    },
                ],
            );
        }

        const benefits = [
            ...new Set(
                input.benefits
                    .map((item) => String(item || '').trim())
                    .filter(Boolean),
            ),
        ];

        if (
            benefits.length < 1 ||
            benefits.length > 12 ||
            benefits.some((item) => item.length > 300)
        ) {
            throw new ApiError(
                400,
                'Provide between 1 and 12 readable EPANTRY Pro benefits.',
                [
                    {
                        code: 'ADMIN_PRO_PLAN_BENEFITS_INVALID',
                    },
                ],
            );
        }

        updates.benefits = benefits;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'isEnabled')) {
        if (typeof input.isEnabled !== 'boolean') {
            throw new ApiError(
                400,
                'EPANTRY Pro plan availability must be true or false.',
                [
                    {
                        code: 'ADMIN_PRO_PLAN_ENABLED_INVALID',
                    },
                ],
            );
        }

        updates.isEnabled = input.isEnabled;
    }

    if (Object.keys(updates).length === 0) {
        throw new ApiError(
            400,
            'No EPANTRY Pro plan changes were provided.',
            [
                {
                    code: 'ADMIN_PRO_PLAN_UPDATE_EMPTY',
                },
            ],
        );
    }

    const plan = await ProPlan.findOne({
        code: normalizedPlanCode,
    });

    if (!plan) {
        throw new ApiError(
            404,
            'EPANTRY Pro plan was not found.',
            [
                {
                    code: 'ADMIN_PRO_PLAN_NOT_FOUND',
                },
            ],
        );
    }

    const beforePlan = serializeProPlan(plan);

    Object.assign(plan, updates);
    plan.updatedByAdminUserId = actorUser?._id || null;

    await plan.save();

    return {
        plan: serializeProPlan(plan),
        beforePlan,
        changedFields: Object.keys(updates),
    };
}

export function isLearningObjectId(
    value,
) {
    return mongoose.Types.ObjectId.isValid(
        value,
    );
}
