import mongoose from 'mongoose';

const { Schema } = mongoose;

const objectId = Schema.Types.ObjectId;

export const COMMUNITY_RECIPE_VISIBILITIES = Object.freeze([
    'private',
    'friends',
    'public',
]);

export const COMMUNITY_RECIPE_STATUSES = Object.freeze([
    'active',
    'pending_moderation',
    'published',
    'rejected',
    'archived',
]);

export const COMMUNITY_MODERATION_STATES = Object.freeze([
    'not_required',
    'pending',
    'approved',
    'changes_requested',
    'rejected',
    'quarantined',
]);

export const CREATOR_TYPES = Object.freeze([
    'community_creator',
    'chef',
]);

export const CREATOR_VERIFICATION_STATES = Object.freeze([
    'unverified',
    'pending',
    'verified',
    'rejected',
    'suspended',
]);

export const CREATOR_COURSE_ACCESS_TYPES = Object.freeze([
    'free',
    'pro',
]);

export const CREATOR_COURSE_STATUSES = Object.freeze([
    'draft',
    'listed',
    'archived',
]);

export const COURSE_ENTITLEMENT_STATUSES = Object.freeze([
    'active',
    'expired',
    'revoked',
]);

const baseOptions = Object.freeze({
    timestamps: true,
    strict: true,
    minimize: false,
});

const communityRecipeSchema = new Schema({
    dishId: {
        type: objectId,
        ref: 'Dish',
        required: true,
        index: true,
    },

    recipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        required: true,
        unique: true,
        index: true,
    },

    creatorUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    creatorProfileId: {
        type: objectId,
        ref: 'CreatorProfile',
        default: null,
        index: true,
    },

    visibility: {
        type: String,
        enum: COMMUNITY_RECIPE_VISIBILITIES,
        required: true,
        default: 'private',
        index: true,
    },

    status: {
        type: String,
        enum: COMMUNITY_RECIPE_STATUSES,
        required: true,
        default: 'active',
        index: true,
    },

    moderationState: {
        type: String,
        enum: COMMUNITY_MODERATION_STATES,
        required: true,
        default: 'not_required',
        index: true,
    },

    sourceClassification: {
        type: String,
        enum: [
            'community_contributed',
            'creator_provided',
        ],
        required: true,
        default: 'community_contributed',
    },

    creatorStatement: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
    },

    rights: {
        allowForks: {
            type: Boolean,
            required: true,
            default: true,
        },

        allowProseReuseInForks: {
            type: Boolean,
            required: true,
            default: false,
        },

        allowMediaReuseInForks: {
            type: Boolean,
            required: true,
            default: false,
        },
    },

    foodIntelligencePolicy: {
        type: String,
        enum: [
            'recalculate_never_copy',
        ],
        required: true,
        default: 'recalculate_never_copy',
    },

    submittedForModerationAt: {
        type: Date,
        default: null,
        index: true,
    },

    moderatedAt: {
        type: Date,
        default: null,
    },

    moderatedByUserId: {
        type: objectId,
        ref: 'User',
        default: null,
    },

    moderationReason: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
    },

    createIdempotencyKey: {
        type: String,
        trim: true,
        maxlength: 160,
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'communityRecipes',
});

communityRecipeSchema.index({
    creatorUserId: 1,
    createIdempotencyKey: 1,
}, {
    unique: true,
    name: 'community_recipe_create_idempotency',
});

communityRecipeSchema.index({
    visibility: 1,
    status: 1,
    moderationState: 1,
    createdAt: -1,
});

const recipeForkSchema = new Schema({
    sourceCommunityRecipeId: {
        type: objectId,
        ref: 'CommunityRecipe',
        required: true,
        index: true,
    },

    sourceRecipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        required: true,
        index: true,
    },

    forkedCommunityRecipeId: {
        type: objectId,
        ref: 'CommunityRecipe',
        required: true,
        unique: true,
        index: true,
    },

    forkedRecipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        required: true,
        index: true,
    },

    forkedByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    attributionLabel: {
        type: String,
        trim: true,
        maxlength: 500,
        required: true,
        default: 'Adapted from a community recipe',
    },

    copiedCreatorProse: {
        type: Boolean,
        required: true,
        default: false,
    },

    copiedCreatorMedia: {
        type: Boolean,
        required: true,
        default: false,
    },

    idempotencyKey: {
        type: String,
        trim: true,
        maxlength: 160,
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'recipeForks',
});

recipeForkSchema.index({
    forkedByUserId: 1,
    idempotencyKey: 1,
}, {
    unique: true,
    name: 'community_recipe_fork_idempotency',
});

/*
|--------------------------------------------------------------------------
| Community Recipe Review
|--------------------------------------------------------------------------
|
| Existing M07 owns `recipeReviews` for editorial / QA / safety governance.
| Customer ratings therefore remain in a separate collection so M15 cannot
| weaken that frozen governance contract.
|--------------------------------------------------------------------------
*/

const communityRecipeReviewSchema = new Schema({
    communityRecipeId: {
        type: objectId,
        ref: 'CommunityRecipe',
        required: true,
        index: true,
    },

    recipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        required: true,
        index: true,
    },

    reviewerUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    overallRating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
    },

    tasteRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },

    easeRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },

    timeAccuracyRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },

    familyResponseRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null,
    },

    wouldCookAgain: {
        type: Boolean,
        default: null,
    },

    reviewText: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
    },

    verifiedCook: {
        type: Boolean,
        required: true,
        default: false,
        index: true,
    },

    status: {
        type: String,
        enum: [
            'visible',
            'hidden',
            'removed',
        ],
        required: true,
        default: 'visible',
        index: true,
    },

    idempotencyKey: {
        type: String,
        trim: true,
        maxlength: 160,
        required: true,
    },
}, {
    ...baseOptions,
    collection: 'communityRecipeReviews',
});

communityRecipeReviewSchema.index({
    communityRecipeId: 1,
    reviewerUserId: 1,
}, {
    unique: true,
    name: 'one_community_review_per_user',
});

communityRecipeReviewSchema.index({
    reviewerUserId: 1,
    idempotencyKey: 1,
}, {
    unique: true,
    name: 'community_recipe_review_idempotency',
});

const socialFollowSchema = new Schema({
    followerUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    followedUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    status: {
        type: String,
        enum: [
            'active',
            'stopped',
        ],
        required: true,
        default: 'active',
        index: true,
    },
}, {
    ...baseOptions,
    collection: 'socialFollows',
});

socialFollowSchema.index({
    followerUserId: 1,
    followedUserId: 1,
}, {
    unique: true,
    name: 'social_follow_unique_pair',
});

socialFollowSchema.pre('validate', function preventSelfFollow(next) {
    if (
        this.followerUserId &&
        this.followedUserId &&
        String(this.followerUserId) ===
            String(this.followedUserId)
    ) {
        this.invalidate(
            'followedUserId',
            'A user cannot follow themselves.',
        );
    }

    next();
});

const creatorProfileSchema = new Schema({
    userId: {
        type: objectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },

    slug: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 180,
        required: true,
        unique: true,
        index: true,
    },

    displayName: {
        type: String,
        trim: true,
        maxlength: 160,
        required: true,
    },

    creatorType: {
        type: String,
        enum: CREATOR_TYPES,
        required: true,
        default: 'community_creator',
        index: true,
    },

    verificationStatus: {
        type: String,
        enum: CREATOR_VERIFICATION_STATES,
        required: true,
        default: 'unverified',
        index: true,
    },

    biography: {
        type: String,
        trim: true,
        maxlength: 6000,
        default: '',
    },

    cuisineSpecialties: {
        type: [String],
        default: [],
    },

    languages: {
        type: [String],
        default: [],
    },

    commercialDisclosure: {
        type: String,
        trim: true,
        maxlength: 3000,
        default: '',
    },

    verificationStatement: {
        type: String,
        trim: true,
        maxlength: 3000,
        default: '',
    },

    verificationRequestedAt: {
        type: Date,
        default: null,
    },

    verifiedAt: {
        type: Date,
        default: null,
    },

    verifiedByUserId: {
        type: objectId,
        ref: 'User',
        default: null,
    },

    verificationReason: {
        type: String,
        trim: true,
        maxlength: 4000,
        default: '',
    },

    isPublic: {
        type: Boolean,
        required: true,
        default: true,
        index: true,
    },
}, {
    ...baseOptions,
    collection: 'creatorProfiles',
});

/*
|--------------------------------------------------------------------------
| EPANTRY Pro - Course Placeholder Foundation
|--------------------------------------------------------------------------
|
| M15 intentionally does NOT implement live-session booking, streaming,
| payouts, subscriptions, modules, lessons or course commerce. Those are
| later seams in the Story SRS. A CreatorCourse here is only a governed Learn
| / Pro discovery record linked to an already-published Community Recipe.
|--------------------------------------------------------------------------
*/

const creatorCourseSchema = new Schema({
    creatorProfileId: {
        type: objectId,
        ref: 'CreatorProfile',
        required: true,
        index: true,
    },

    createdByUserId: {
        type: objectId,
        ref: 'User',
        required: true,
        index: true,
    },

    linkedCommunityRecipeId: {
        type: objectId,
        ref: 'CommunityRecipe',
        required: true,
        index: true,
    },

    linkedRecipeVersionId: {
        type: objectId,
        ref: 'RecipeVersion',
        required: true,
        index: true,
    },

    slug: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 220,
        required: true,
        unique: true,
        index: true,
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

    category: {
        type: String,
        trim: true,
        maxlength: 120,
        default: '',
        index: true,
    },

    language: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 24,
        default: 'en',
    },

    accessType: {
        type: String,
        enum: CREATOR_COURSE_ACCESS_TYPES,
        required: true,
        default: 'free',
        index: true,
    },

    status: {
        type: String,
        enum: CREATOR_COURSE_STATUSES,
        required: true,
        default: 'listed',
        index: true,
    },

    requiredEquipment: {
        type: [String],
        default: [],
    },

    commercialDisclosure: {
        type: String,
        trim: true,
        maxlength: 3000,
        default: '',
    },

    rights: {
        ownerOrLicensor: {
            type: String,
            trim: true,
            maxlength: 300,
            default: '',
        },

        allowedTerritories: {
            type: [String],
            default: [],
        },

        downloadableMaterialsAllowed: {
            type: Boolean,
            required: true,
            default: false,
        },

        sponsored: {
            type: Boolean,
            required: true,
            default: false,
        },

        takedownState: {
            type: String,
            enum: [
                'clear',
                'restricted',
                'removed',
            ],
            required: true,
            default: 'clear',
        },
    },
}, {
    ...baseOptions,
    collection: 'creatorCourses',
});

creatorCourseSchema.index({
    status: 1,
    accessType: 1,
    createdAt: -1,
});

creatorCourseSchema.index({
    creatorProfileId: 1,
    status: 1,
    createdAt: -1,
});

/*
|--------------------------------------------------------------------------
| Course Entitlement
|--------------------------------------------------------------------------
|
| Pro is an entitlement, never an application role. M15 only reads these
| records; creation/payment/subscription lifecycle belongs to later governed
| commerce/membership work.
|--------------------------------------------------------------------------
*/

const courseEntitlementSchema = new Schema({
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

    source: {
        type: String,
        enum: [
            'membership',
            'purchase',
            'grant',
        ],
        required: true,
    },

    status: {
        type: String,
        enum: COURSE_ENTITLEMENT_STATUSES,
        required: true,
        default: 'active',
        index: true,
    },

    startsAt: {
        type: Date,
        default: Date.now,
    },

    endsAt: {
        type: Date,
        default: null,
    },

    revokedAt: {
        type: Date,
        default: null,
    },
}, {
    ...baseOptions,
    collection: 'courseEntitlements',
});

courseEntitlementSchema.index({
    userId: 1,
    courseId: 1,
    status: 1,
}, {
    name: 'course_entitlement_lookup',
});

export const CommunityRecipe =
    mongoose.models.CommunityRecipe ||
    mongoose.model(
        'CommunityRecipe',
        communityRecipeSchema,
    );

export const RecipeFork =
    mongoose.models.RecipeFork ||
    mongoose.model(
        'RecipeFork',
        recipeForkSchema,
    );

export const CommunityRecipeReview =
    mongoose.models.CommunityRecipeReview ||
    mongoose.model(
        'CommunityRecipeReview',
        communityRecipeReviewSchema,
    );

export const SocialFollow =
    mongoose.models.SocialFollow ||
    mongoose.model(
        'SocialFollow',
        socialFollowSchema,
    );

export const CreatorProfile =
    mongoose.models.CreatorProfile ||
    mongoose.model(
        'CreatorProfile',
        creatorProfileSchema,
    );

export const CreatorCourse =
    mongoose.models.CreatorCourse ||
    mongoose.model(
        'CreatorCourse',
        creatorCourseSchema,
    );

export const CourseEntitlement =
    mongoose.models.CourseEntitlement ||
    mongoose.model(
        'CourseEntitlement',
        courseEntitlementSchema,
    );