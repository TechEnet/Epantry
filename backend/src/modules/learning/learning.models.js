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

export const PRO_PLAN_CODES = Object.freeze([
    'monthly',
    'quarterly',
    'half_year',
    'annual',
]);

export const PRO_MEMBERSHIP_STATUSES = Object.freeze([
    'active',
    'expired',
    'suspended',
]);

export const PRO_PAYMENT_STATUSES = Object.freeze([
    'initiated',
    'paid',
    'failed',
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



/*
|--------------------------------------------------------------------------
| EPANTRY Pro plan catalog + Customer membership
|--------------------------------------------------------------------------
|
| M3 keeps Pro as a Customer entitlement product, not a fourth application
| role. Plan configuration is additive and existing CourseEntitlement records
| remain valid. Razorpay transaction evidence is added in the payment part of
| M3; these models only establish the plan + membership authority.
|
*/

const proPlanSchema = new Schema({
    code: {
        type: String,
        enum: PRO_PLAN_CODES,
        required: true,
        unique: true,
        index: true,
    },

    name: {
        type: String,
        trim: true,
        maxlength: 120,
        required: true,
    },

    shortDescription: {
        type: String,
        trim: true,
        maxlength: 600,
        default: '',
    },

    priceMinor: {
        type: Number,
        min: 0,
        required: true,
    },

    currency: {
        type: String,
        trim: true,
        uppercase: true,
        enum: [
            'INR',
        ],
        required: true,
        default: 'INR',
    },

    validityMonths: {
        type: Number,
        min: 1,
        max: 24,
        required: true,
    },

    benefits: [{
        type: String,
        trim: true,
        maxlength: 300,
    }],

    isEnabled: {
        type: Boolean,
        required: true,
        default: true,
        index: true,
    },

    sortOrder: {
        type: Number,
        min: 0,
        max: 1000,
        required: true,
        default: 0,
    },

    updatedByAdminUserId: {
        type: objectId,
        ref: 'User',
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'proPlans',
});

proPlanSchema.index({
    isEnabled: 1,
    sortOrder: 1,
    priceMinor: 1,
}, {
    name: 'pro_plan_public_catalog',
});

const proMembershipSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },

    status: {
        type: String,
        enum: PRO_MEMBERSHIP_STATUSES,
        required: true,
        default: 'active',
        index: true,
    },

    startedAt: {
        type: Date,
        default: null,
    },

    validUntil: {
        type: Date,
        default: null,
        index: true,
    },

    lastActivatedAt: {
        type: Date,
        default: null,
    },

    lastPlanId: {
        type: objectId,
        ref: 'ProPlan',
        default: null,
    },

    lastPlanCode: {
        type: String,
        enum: PRO_PLAN_CODES,
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'proMemberships',
});

proMembershipSchema.index({
    status: 1,
    validUntil: 1,
}, {
    name: 'pro_membership_status_expiry',
});


const proMembershipPaymentSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    planId: {
        type: objectId,
        ref: 'ProPlan',
        required: true,
        index: true,
    },

    planCode: {
        type: String,
        enum: PRO_PLAN_CODES,
        required: true,
        index: true,
    },

    status: {
        type: String,
        enum: PRO_PAYMENT_STATUSES,
        required: true,
        default: 'initiated',
        index: true,
    },

    amountMinor: {
        type: Number,
        min: 1,
        required: true,
    },

    validityMonths: {
        type: Number,
        min: 1,
        max: 24,
        required: true,
    },

    currency: {
        type: String,
        trim: true,
        uppercase: true,
        enum: ['INR'],
        required: true,
        default: 'INR',
    },

    provider: {
        type: String,
        enum: ['razorpay'],
        required: true,
        default: 'razorpay',
    },

    providerMode: {
        type: String,
        enum: ['test'],
        required: true,
        default: 'test',
    },

    providerOrderId: {
        type: String,
        trim: true,
        default: undefined,
    },

    providerPaymentId: {
        type: String,
        trim: true,
        default: undefined,
    },

    initiatedAt: {
        type: Date,
        required: true,
        default: Date.now,
    },

    paidAt: {
        type: Date,
        default: null,
    },

    coverageStartAt: {
        type: Date,
        default: null,
    },

    coverageEndAt: {
        type: Date,
        default: null,
    },

    planLockUntil: {
        type: Date,
        default: null,
        index: true,
    },

    failureCode: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
    },
}, {
    ...baseOptions,
    collection: 'proMembershipPayments',
});

proMembershipPaymentSchema.index({
    userId: 1,
    planCode: 1,
    status: 1,
    planLockUntil: -1,
}, {
    name: 'pro_payment_plan_lock',
});

proMembershipPaymentSchema.index({
    providerOrderId: 1,
}, {
    unique: true,
    sparse: true,
    name: 'pro_payment_provider_order_unique',
});

proMembershipPaymentSchema.index({
    providerPaymentId: 1,
}, {
    unique: true,
    sparse: true,
    name: 'pro_payment_provider_payment_unique',
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

export const ProPlan =
    mongoose.models.ProPlan ||
    mongoose.model(
        'ProPlan',
        proPlanSchema,
    );

export const ProMembership =
    mongoose.models.ProMembership ||
    mongoose.model(
        'ProMembership',
        proMembershipSchema,
    );


export const ProMembershipPayment =
    mongoose.models.ProMembershipPayment ||
    mongoose.model(
        'ProMembershipPayment',
        proMembershipPaymentSchema,
    );

