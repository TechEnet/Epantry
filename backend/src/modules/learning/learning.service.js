import mongoose from 'mongoose';

import {
    ApiError,
} from '../../utils/ApiError.js';

import {
    RecipeVersion,
} from '../recipes/recipe.models.js';

import {
    getLearnerCourseAccess,
    requireCourseAuthor,
    requireLearnerCourseAccess,
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

export async function createCourseModule({
    courseId,
    input,
    actorUser,
}) {
    const {
        userId,
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

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
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

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
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

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
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

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
    } =
        await requireCourseAuthor({
            courseId,
            actorUser,
        });

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

export function isLearningObjectId(
    value,
) {
    return mongoose.Types.ObjectId.isValid(
        value,
    );
}
