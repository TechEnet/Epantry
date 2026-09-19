import mongoose from 'mongoose';

const { Schema } = mongoose;
const objectId = Schema.Types.ObjectId;

export const COURSE_CONTENT_STATUSES = Object.freeze([
    'draft',
    'published',
    'archived',
]);

export const COURSE_LESSON_TYPES = Object.freeze([
    'video',
    'live_recording',
    'text',
    'recipe',
]);

export const COURSE_LESSON_ACCESS_POLICIES = Object.freeze([
    'course',
    'preview',
]);

export const COURSE_MEDIA_TYPES = Object.freeze([
    'video',
    'live_recording',
    'caption',
    'transcript',
    'download',
]);

export const COURSE_MEDIA_AVAILABILITY_STATES = Object.freeze([
    'processing',
    'available',
    'restricted',
    'removed',
]);

export const LESSON_PROGRESS_STATUSES = Object.freeze([
    'not_started',
    'in_progress',
    'completed',
]);

const baseOptions = Object.freeze({
    timestamps: true,
    strict: true,
    minimize: false,
});

const courseModuleSchema = new Schema({
    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    moduleKey: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 120,
        required: true,
    },

    title: {
        type: String,
        trim: true,
        maxlength: 220,
        required: true,
    },

    summary: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
    },

    sortOrder: {
        type: Number,
        min: 0,
        max: 10000,
        required: true,
        default: 0,
        index: true,
    },

    status: {
        type: String,
        enum: COURSE_CONTENT_STATUSES,
        required: true,
        default: 'draft',
        index: true,
    },

    publishedAt: {
        type: Date,
        default: null,
    },

    archivedAt: {
        type: Date,
        default: null,
    },

    createdByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    updatedByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'courseModules',
});

courseModuleSchema.index({
    courseId: 1,
    moduleKey: 1,
}, {
    unique: true,
    name: 'course_module_unique_key',
});

courseModuleSchema.index({
    courseId: 1,
    status: 1,
    sortOrder: 1,
    _id: 1,
}, {
    name: 'course_module_curriculum_order',
});

const courseLessonSchema = new Schema({
    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    moduleId: {
        type: objectId,
        ref: 'CourseModule',
        required: true,
        index: true,
    },

    lessonKey: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 120,
        required: true,
    },

    title: {
        type: String,
        trim: true,
        maxlength: 220,
        required: true,
    },

    summary: {
        type: String,
        trim: true,
        maxlength: 5000,
        default: '',
    },

    lessonType: {
        type: String,
        enum: COURSE_LESSON_TYPES,
        required: true,
        index: true,
    },

    accessPolicy: {
        type: String,
        enum: COURSE_LESSON_ACCESS_POLICIES,
        required: true,
        default: 'course',
        index: true,
    },

    sortOrder: {
        type: Number,
        min: 0,
        max: 10000,
        required: true,
        default: 0,
        index: true,
    },

    durationSeconds: {
        type: Number,
        min: 0,
        max: 172800,
        default: 0,
    },

    bodyText: {
        type: String,
        maxlength: 50000,
        default: '',
    },

    linkedRecipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        default: null,
        index: true,
    },

    isRequiredForCompletion: {
        type: Boolean,
        required: true,
        default: true,
    },

    status: {
        type: String,
        enum: COURSE_CONTENT_STATUSES,
        required: true,
        default: 'draft',
        index: true,
    },

    publishedAt: {
        type: Date,
        default: null,
    },

    archivedAt: {
        type: Date,
        default: null,
    },

    createdByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    updatedByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'courseLessons',
});

courseLessonSchema.index({
    courseId: 1,
    lessonKey: 1,
}, {
    unique: true,
    name: 'course_lesson_unique_key',
});

courseLessonSchema.index({
    moduleId: 1,
    status: 1,
    sortOrder: 1,
    _id: 1,
}, {
    name: 'course_lesson_module_order',
});

courseLessonSchema.pre('validate', function validateLessonShape(next) {
    if (
        this.lessonType === 'text' &&
        !String(this.bodyText || '').trim()
    ) {
        this.invalidate(
            'bodyText',
            'Text lessons require lesson body content.',
        );
    }

    if (
        this.lessonType === 'recipe' &&
        !this.linkedRecipeVersionId
    ) {
        this.invalidate(
            'linkedRecipeVersionId',
            'Recipe lessons require a governed Recipe Version reference.',
        );
    }

    next();
});

const courseMediaAssetSchema = new Schema({
    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    lessonId: {
        type: objectId,
        ref: 'CourseLesson',
        required: true,
        index: true,
    },

    mediaType: {
        type: String,
        enum: COURSE_MEDIA_TYPES,
        required: true,
        index: true,
    },

    storageProvider: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 80,
        required: true,
    },

    assetReference: {
        type: String,
        trim: true,
        maxlength: 1000,
        required: true,
    },

    language: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 24,
        default: '',
    },

    label: {
        type: String,
        trim: true,
        maxlength: 160,
        default: '',
    },

    mimeType: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 120,
        default: '',
    },

    durationSeconds: {
        type: Number,
        min: 0,
        max: 172800,
        default: 0,
    },

    availabilityState: {
        type: String,
        enum: COURSE_MEDIA_AVAILABILITY_STATES,
        required: true,
        default: 'processing',
        index: true,
    },

    isDefault: {
        type: Boolean,
        required: true,
        default: false,
    },

    downloadable: {
        type: Boolean,
        required: true,
        default: false,
    },

    rightsStatement: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: '',
    },

    createdByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    updatedByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'courseMediaAssets',
});

courseMediaAssetSchema.index({
    lessonId: 1,
    mediaType: 1,
    language: 1,
    availabilityState: 1,
}, {
    name: 'course_media_lesson_lookup',
});

courseMediaAssetSchema.index({
    storageProvider: 1,
    assetReference: 1,
}, {
    unique: true,
    name: 'course_media_unique_asset_reference',
});

const courseProgressSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    completedRequiredLessons: {
        type: Number,
        min: 0,
        required: true,
        default: 0,
    },

    totalRequiredLessons: {
        type: Number,
        min: 0,
        required: true,
        default: 0,
    },

    percentComplete: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
        default: 0,
    },

    startedAt: {
        type: Date,
        default: null,
    },

    lastActivityAt: {
        type: Date,
        default: null,
    },

    completedAt: {
        type: Date,
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'courseProgress',
});

courseProgressSchema.index({
    userId: 1,
    courseId: 1,
}, {
    unique: true,
    name: 'course_progress_unique_user_course',
});

const lessonProgressSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    lessonId: {
        type: objectId,
        ref: 'CourseLesson',
        required: true,
        index: true,
    },

    status: {
        type: String,
        enum: LESSON_PROGRESS_STATUSES,
        required: true,
        default: 'not_started',
        index: true,
    },

    completionPercent: {
        type: Number,
        min: 0,
        max: 100,
        required: true,
        default: 0,
    },

    playbackPositionSeconds: {
        type: Number,
        min: 0,
        max: 172800,
        required: true,
        default: 0,
    },

    playbackSpeed: {
        type: Number,
        min: 0.5,
        max: 2,
        required: true,
        default: 1,
    },

    startedAt: {
        type: Date,
        default: null,
    },

    lastActivityAt: {
        type: Date,
        default: null,
    },

    completedAt: {
        type: Date,
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'lessonProgress',
});

lessonProgressSchema.index({
    userId: 1,
    lessonId: 1,
}, {
    unique: true,
    name: 'lesson_progress_unique_user_lesson',
});

lessonProgressSchema.index({
    userId: 1,
    courseId: 1,
    status: 1,
}, {
    name: 'lesson_progress_course_summary',
});

const lessonBookmarkSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    lessonId: {
        type: objectId,
        ref: 'CourseLesson',
        required: true,
        index: true,
    },

    positionSeconds: {
        type: Number,
        min: 0,
        max: 172800,
        required: true,
        default: 0,
    },

    label: {
        type: String,
        trim: true,
        maxlength: 240,
        default: '',
    },
}, {
    ...baseOptions,
    collection: 'lessonBookmarks',
});

lessonBookmarkSchema.index({
    userId: 1,
    lessonId: 1,
    positionSeconds: 1,
}, {
    unique: true,
    name: 'lesson_bookmark_unique_position',
});

const lessonNoteSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    courseId: {
        type: objectId,
        ref: 'CreatorCourse',
        required: true,
        index: true,
    },

    lessonId: {
        type: objectId,
        ref: 'CourseLesson',
        required: true,
        index: true,
    },

    noteText: {
        type: String,
        trim: true,
        minlength: 1,
        maxlength: 8000,
        required: true,
    },

    positionSeconds: {
        type: Number,
        min: 0,
        max: 172800,
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'lessonNotes',
});

lessonNoteSchema.index({
    userId: 1,
    lessonId: 1,
    updatedAt: -1,
}, {
    name: 'lesson_note_user_lesson',
});

export const CourseModule =
    mongoose.models.CourseModule ||
    mongoose.model(
        'CourseModule',
        courseModuleSchema,
    );

export const CourseLesson =
    mongoose.models.CourseLesson ||
    mongoose.model(
        'CourseLesson',
        courseLessonSchema,
    );

export const CourseMediaAsset =
    mongoose.models.CourseMediaAsset ||
    mongoose.model(
        'CourseMediaAsset',
        courseMediaAssetSchema,
    );

export const CourseProgress =
    mongoose.models.CourseProgress ||
    mongoose.model(
        'CourseProgress',
        courseProgressSchema,
    );

export const LessonProgress =
    mongoose.models.LessonProgress ||
    mongoose.model(
        'LessonProgress',
        lessonProgressSchema,
    );

export const LessonBookmark =
    mongoose.models.LessonBookmark ||
    mongoose.model(
        'LessonBookmark',
        lessonBookmarkSchema,
    );

export const LessonNote =
    mongoose.models.LessonNote ||
    mongoose.model(
        'LessonNote',
        lessonNoteSchema,
    );
