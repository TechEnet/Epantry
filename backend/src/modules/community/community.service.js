import mongoose from 'mongoose';

import {
    ApiError,
} from '../../utils/ApiError.js';

import {
    adminAuthorizationHasAllPermissions,
} from '../admin/adminPermission.service.js';

import {
    recordAdminAuditEvent,
} from '../admin/adminAudit.service.js';

import {
    CanonicalIngredient,
} from '../catalog/catalog.models.js';

import {
    FoodCalculation,
} from '../foodIntelligence/foodIntelligence.models.js';

import {
    createRecipeOutcomePlan,
} from '../outcomes/outcomePlan.service.js';

import {
    PantryConsumptionEvent,
} from '../pantry/pantry.models.js';

import {
    createAdminRecipe,
    getAdminRecipeVersion,
} from '../recipes/recipe.admin.service.js';

import {
    Dish,
    RecipeVersion,
} from '../recipes/recipe.models.js';

import {
    publishRecipeVersion,
    reviewRecipeVersion,
} from '../recipes/recipe.governance.service.js';

import {
    CommunityRecipe,
    CommunityRecipeReview,
    CourseEntitlement,
    CreatorCourse,
    CreatorProfile,
    RecipeFork,
    SocialFollow,
} from './community.models.js';

function stringId(
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

function actorId(
    actorUser,
) {
    const value =
        actorUser?._id ||
        actorUser?.id;

    if (!value) {
        throw new ApiError(
            401,
            'Authenticated EPANTRY user is required.',
            [
                {
                    code:
                        'COMMUNITY_ACTOR_REQUIRED',
                },
            ],
        );
    }

    return value;
}

function uniqueStrings(
    values,
    max = 30,
) {
    return [
        ...new Set(
            (
                Array.isArray(
                    values,
                )
                    ? values
                    : []
            )
                .map(
                    (
                        value,
                    ) =>
                        String(
                            value ||
                                '',
                        ).trim(),
                )
                .filter(
                    Boolean,
                ),
        ),
    ].slice(
        0,
        max,
    );
}

function normalizeCreatorSlug(
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
            180,
        );
}

function serializeCreatorProfile(
    profile,
) {
    if (!profile) {
        return null;
    }

    const value =
        typeof profile.toObject ===
            'function'
            ? profile.toObject()
            : profile;

    return {
        id:
            stringId(
                value._id ||
                    value.id,
            ),

        slug:
            value.slug,

        displayName:
            value.displayName,

        creatorType:
            value.creatorType,

        verificationStatus:
            value.verificationStatus,

        biography:
            value.biography ||
            '',

        cuisineSpecialties:
            value.cuisineSpecialties ||
            [],

        languages:
            value.languages ||
            [],

        commercialDisclosure:
            value.commercialDisclosure ||
            '',

        isPublic:
            value.isPublic ===
            true,

        createdAt:
            value.createdAt ||
            null,
    };
}

function serializeCommunityRecipeMeta(
    recipe,
) {
    if (!recipe) {
        return null;
    }

    const value =
        typeof recipe.toObject ===
            'function'
            ? recipe.toObject()
            : recipe;

    return {
        id:
            stringId(
                value._id ||
                    value.id,
            ),

        dishId:
            stringId(
                value.dishId,
            ),

        recipeVersionId:
            stringId(
                value.recipeVersionId,
            ),

        creatorProfileId:
            stringId(
                value.creatorProfileId,
            ),

        visibility:
            value.visibility,

        status:
            value.status,

        moderationState:
            value.moderationState,

        sourceClassification:
            value.sourceClassification,

        creatorStatement:
            value.creatorStatement ||
            '',

        rights: {
            allowForks:
                value.rights
                    ?.allowForks !==
                false,

            allowProseReuseInForks:
                value.rights
                    ?.allowProseReuseInForks ===
                true,

            allowMediaReuseInForks:
                value.rights
                    ?.allowMediaReuseInForks ===
                true,
        },

        foodIntelligencePolicy:
            value.foodIntelligencePolicy,

        submittedForModerationAt:
            value.submittedForModerationAt ||
            null,

        moderatedAt:
            value.moderatedAt ||
            null,

        moderationReason:
            value.moderationReason ||
            '',

        createdAt:
            value.createdAt ||
            null,

        updatedAt:
            value.updatedAt ||
            null,
    };
}

function serializeCommunityReview(
    review,
) {
    const value =
        typeof review?.toObject ===
            'function'
            ? review.toObject()
            : review;

    if (!value) {
        return null;
    }

    return {
        id:
            stringId(
                value._id ||
                    value.id,
            ),

        overallRating:
            value.overallRating,

        tasteRating:
            value.tasteRating ??
            null,

        easeRating:
            value.easeRating ??
            null,

        timeAccuracyRating:
            value.timeAccuracyRating ??
            null,

        familyResponseRating:
            value.familyResponseRating ??
            null,

        wouldCookAgain:
            value.wouldCookAgain ??
            null,

        reviewText:
            value.reviewText ||
            '',

        verifiedCook:
            value.verifiedCook ===
            true,

        createdAt:
            value.createdAt ||
            null,
    };
}

async function ensureCreatorProfile(
    actorUser,
) {
    const userId =
        actorId(
            actorUser,
        );

    const existing =
        await CreatorProfile.findOne({
            userId,
        });

    if (existing) {
        return existing;
    }

    const base =
        normalizeCreatorSlug(
            actorUser?.name ||
                'creator',
        ) ||
        'creator';

    const suffix =
        String(
            userId,
        ).slice(
            -8,
        );

    return CreatorProfile.create({
        userId,

        slug:
            `${base}-${suffix}`,

        displayName:
            String(
                actorUser?.name ||
                    'EPANTRY Creator',
            ).trim(),

        creatorType:
            'community_creator',

        verificationStatus:
            'unverified',

        isPublic:
            true,
    });
}

function buildRecipeInput({
    input,
    creatorProfile,
}) {
    const isVerifiedChef =
        creatorProfile
            ?.creatorType ===
            'chef' &&
        creatorProfile
            ?.verificationStatus ===
            'verified';

    return {
        ...input.recipe,

        source: {
            type:
                isVerifiedChef
                    ? 'chef'
                    : 'community',

            name:
                creatorProfile
                    ?.displayName ||
                '',

            url:
                '',

            brandId:
                null,

            organizationId:
                null,
        },
    };
}

async function markRecipeVersionForCommunityModeration({
    recipeVersionId,
    creatorUserId,
}) {
    const updated =
        await RecipeVersion.findOneAndUpdate(
            {
                _id:
                    recipeVersionId,

                createdByUserId:
                    creatorUserId,

                status: {
                    $in: [
                        'draft',
                    ],
                },
            },
            {
                $set: {
                    status:
                        'in_review',

                    submittedAt:
                        new Date(),

                    submittedByUserId:
                        creatorUserId,
                },
            },
            {
                new:
                    true,
            },
        );

    if (!updated) {
        throw new ApiError(
            409,
            'Community Recipe cannot enter moderation from its current Recipe Version state.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_SUBMISSION_STATE_INVALID',
                },
            ],
        );
    }

    return updated;
}

async function loadFoodIntelligenceState(
    recipeVersionId,
) {
    const calculation =
        await FoodCalculation.findOne({
            entityType:
                'recipe_version',

            entityId:
                recipeVersionId,

            status: {
                $in: [
                    'approved',
                    'requires_review',
                    'calculated',
                ],
            },
        })
            .sort({
                calculationVersion:
                    -1,
            })
            .select(
                '_id calculationVersion status evidenceState generatedAt',
            )
            .lean();

    if (!calculation) {
        return {
            state:
                'recalculation_required',

            calculationId:
                null,

            calculationVersion:
                null,

            evidenceState:
                'unknown_review_required',

            copiedFromParent:
                false,
        };
    }

    return {
        state:
            calculation.status ===
            'approved'
                ? 'approved_calculation_available'
                : 'calculation_requires_review',

        calculationId:
            stringId(
                calculation._id,
            ),

        calculationVersion:
            calculation.calculationVersion,

        evidenceState:
            calculation.evidenceState,

        copiedFromParent:
            false,
    };
}

async function getRatingSummary(
    communityRecipeId,
) {
    const result =
        await CommunityRecipeReview.aggregate([
            {
                $match: {
                    communityRecipeId:
                        new mongoose.Types.ObjectId(
                            communityRecipeId,
                        ),

                    status:
                        'visible',
                },
            },

            {
                $group: {
                    _id:
                        null,

                    count: {
                        $sum:
                            1,
                    },

                    average: {
                        $avg:
                            '$overallRating',
                    },

                    verifiedCookCount: {
                        $sum: {
                            $cond: [
                                '$verifiedCook',
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
        ]);

    const value =
        result[0];

    return {
        count:
            value?.count ||
            0,

        average:
            Number.isFinite(
                Number(
                    value?.average,
                ),
            )
                ? Number(
                    Number(
                        value.average,
                    ).toFixed(
                        2,
                    ),
                )
                : null,

        verifiedCookCount:
            value?.verifiedCookCount ||
            0,
    };
}

async function isMutualFriend({
    leftUserId,
    rightUserId,
}) {
    if (
        !leftUserId ||
        !rightUserId
    ) {
        return false;
    }

    if (
        stringId(
            leftUserId,
        ) ===
        stringId(
            rightUserId,
        )
    ) {
        return true;
    }

    const count =
        await SocialFollow.countDocuments({
            status:
                'active',

            $or: [
                {
                    followerUserId:
                        leftUserId,

                    followedUserId:
                        rightUserId,
                },

                {
                    followerUserId:
                        rightUserId,

                    followedUserId:
                        leftUserId,
                },
            ],
        });

    return count ===
        2;
}

async function assertCommunityRecipeVisible({
    communityRecipe,
    viewerUser,
}) {
    const viewerUserId =
        viewerUser?._id ||
        viewerUser?.id ||
        null;

    if (
        viewerUserId &&
        stringId(
            viewerUserId,
        ) ===
            stringId(
                communityRecipe
                    .creatorUserId,
            )
    ) {
        return;
    }

    if (
        communityRecipe.visibility ===
            'public' &&
        communityRecipe.status ===
            'published' &&
        communityRecipe.moderationState ===
            'approved'
    ) {
        return;
    }

    if (
        communityRecipe.visibility ===
            'friends' &&
        communityRecipe.status ===
            'active' &&
        viewerUserId &&
        await isMutualFriend({
            leftUserId:
                viewerUserId,

            rightUserId:
                communityRecipe
                    .creatorUserId,
        })
    ) {
        return;
    }

    throw new ApiError(
        404,
        'Community Recipe was not found.',
        [
            {
                code:
                    'COMMUNITY_RECIPE_NOT_FOUND',
            },
        ],
    );
}

async function loadCommunityRecipeDetail({
    communityRecipe,
    viewerUser = null,
    includeReviews = true,
}) {
    await assertCommunityRecipeVisible({
        communityRecipe,
        viewerUser,
    });

    const [
        recipe,
        creatorProfile,
        fork,
        foodIntelligence,
        ratings,
        reviews,
    ] =
        await Promise.all([
            getAdminRecipeVersion(
                communityRecipe
                    .recipeVersionId,
            ),

            communityRecipe
                .creatorProfileId
                ? CreatorProfile.findById(
                    communityRecipe
                        .creatorProfileId,
                ).lean()
                : null,

            RecipeFork.findOne({
                forkedCommunityRecipeId:
                    communityRecipe._id,
            }).lean(),

            loadFoodIntelligenceState(
                communityRecipe
                    .recipeVersionId,
            ),

            getRatingSummary(
                communityRecipe._id,
            ),

            includeReviews
                ? CommunityRecipeReview.find({
                    communityRecipeId:
                        communityRecipe._id,

                    status:
                        'visible',
                })
                    .sort({
                        verifiedCook:
                            -1,

                        createdAt:
                            -1,
                    })
                    .limit(
                        50,
                    )
                    .lean()
                : [],
        ]);

    return {
        communityRecipe:
            serializeCommunityRecipeMeta(
                communityRecipe,
            ),

        creator:
            serializeCreatorProfile(
                creatorProfile,
            ),

        recipe,

        lineage:
            fork
                ? {
                    adaptedFromCommunityRecipeId:
                        stringId(
                            fork.sourceCommunityRecipeId,
                        ),

                    adaptedFromRecipeVersionId:
                        stringId(
                            fork.sourceRecipeVersionId,
                        ),

                    attributionLabel:
                        fork.attributionLabel,

                    copiedCreatorProse:
                        fork.copiedCreatorProse ===
                        true,

                    copiedCreatorMedia:
                        fork.copiedCreatorMedia ===
                        true,
                }
                : null,

        foodIntelligence,

        ratings,

        reviews:
            reviews.map(
                serializeCommunityReview,
            ),

        trust: {
            creatorStatementsArePlatformVerifiedFacts:
                false,

            communitySourceIsCanonicalProductTruth:
                false,

            ingredientRequirementsUseCanonicalIngredients:
                true,

            calculationsCopiedFromParent:
                false,
        },
    };
}

export async function createCommunityRecipe({
    input,
    actorUser,
    idempotencyKey,
}) {
    const creatorUserId =
        actorId(
            actorUser,
        );

    const existing =
        await CommunityRecipe.findOne({
            creatorUserId,

            createIdempotencyKey:
                idempotencyKey,
        });

    if (existing) {
        return loadCommunityRecipeDetail({
            communityRecipe:
                existing,

            viewerUser:
                actorUser,
        });
    }

    const creatorProfile =
        await ensureCreatorProfile(
            actorUser,
        );

    const recipeInput =
        buildRecipeInput({
            input,
            creatorProfile,
        });

    const createdRecipe =
        await createAdminRecipe(
            recipeInput,
            actorUser,
        );

    const communityRecipe =
        await CommunityRecipe.create({
            dishId:
                createdRecipe.dish.id,

            recipeVersionId:
                createdRecipe.recipeVersion.id,

            creatorUserId,

            creatorProfileId:
                creatorProfile._id,

            visibility:
                input.visibility,

            status:
                input.visibility ===
                'public'
                    ? 'pending_moderation'
                    : 'active',

            moderationState:
                input.visibility ===
                'public'
                    ? 'pending'
                    : 'not_required',

            sourceClassification:
                creatorProfile
                    .verificationStatus ===
                    'verified' &&
                creatorProfile
                    .creatorType ===
                    'chef'
                    ? 'creator_provided'
                    : 'community_contributed',

            creatorStatement:
                input.creatorStatement,

            rights:
                input.rights,

            submittedForModerationAt:
                input.visibility ===
                'public'
                    ? new Date()
                    : null,

            createIdempotencyKey:
                idempotencyKey,
        });

    if (
        input.visibility ===
        'public'
    ) {
        await markRecipeVersionForCommunityModeration({
            recipeVersionId:
                communityRecipe
                    .recipeVersionId,

            creatorUserId,
        });
    }

    return loadCommunityRecipeDetail({
        communityRecipe,

        viewerUser:
            actorUser,
    });
}

export async function submitCommunityRecipeForModeration({
    communityRecipeId,
    reason,
    actorUser,
}) {
    const creatorUserId =
        actorId(
            actorUser,
        );

    const communityRecipe =
        await CommunityRecipe.findOne({
            _id:
                communityRecipeId,

            creatorUserId,
        });

    if (!communityRecipe) {
        throw new ApiError(
            404,
            'Community Recipe was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_NOT_FOUND',
                },
            ],
        );
    }

    if (
        communityRecipe.status ===
            'pending_moderation' &&
        communityRecipe
            .moderationState ===
            'pending'
    ) {
        return loadCommunityRecipeDetail({
            communityRecipe,

            viewerUser:
                actorUser,
        });
    }

    if (
        ![
            'active',
            'rejected',
        ].includes(
            communityRecipe.status,
        )
    ) {
        throw new ApiError(
            409,
            'Community Recipe cannot be submitted from its current state.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_SUBMIT_STATE_INVALID',
                },
            ],
        );
    }

    await markRecipeVersionForCommunityModeration({
        recipeVersionId:
            communityRecipe
                .recipeVersionId,

        creatorUserId,
    });

    communityRecipe.visibility =
        'public';

    communityRecipe.status =
        'pending_moderation';

    communityRecipe.moderationState =
        'pending';

    communityRecipe.submittedForModerationAt =
        new Date();

    communityRecipe.moderationReason =
        reason ||
        '';

    await communityRecipe.save();

    return loadCommunityRecipeDetail({
        communityRecipe,

        viewerUser:
            actorUser,
    });
}

export async function forkCommunityRecipe({
    sourceCommunityRecipeId,
    input,
    actorUser,
    idempotencyKey,
}) {
    const forkedByUserId =
        actorId(
            actorUser,
        );

    const existingFork =
        await RecipeFork.findOne({
            forkedByUserId,
            idempotencyKey,
        }).lean();

    if (existingFork) {
        const existingCommunityRecipe =
            await CommunityRecipe.findById(
                existingFork
                    .forkedCommunityRecipeId,
            );

        return loadCommunityRecipeDetail({
            communityRecipe:
                existingCommunityRecipe,

            viewerUser:
                actorUser,
        });
    }

    const source =
        await CommunityRecipe.findById(
            sourceCommunityRecipeId,
        );

    if (!source) {
        throw new ApiError(
            404,
            'Source Community Recipe was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_SOURCE_NOT_FOUND',
                },
            ],
        );
    }

    await assertCommunityRecipeVisible({
        communityRecipe:
            source,

        viewerUser:
            actorUser,
    });

    if (
        source.rights
            ?.allowForks ===
        false
    ) {
        throw new ApiError(
            403,
            'This creator has not granted adaptation permission for the Recipe.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_FORK_NOT_PERMITTED',
                },
            ],
        );
    }

    if (
        input.reuseSourceProse &&
        source.rights
            ?.allowProseReuseInForks !==
            true
    ) {
        throw new ApiError(
            403,
            'Creator prose reuse permission was not granted.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_PROSE_REUSE_NOT_PERMITTED',
                },
            ],
        );
    }

    if (
        input.reuseSourceMedia &&
        source.rights
            ?.allowMediaReuseInForks !==
            true
    ) {
        throw new ApiError(
            403,
            'Creator media reuse permission was not granted.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_MEDIA_REUSE_NOT_PERMITTED',
                },
            ],
        );
    }

    const created =
        await createCommunityRecipe({
            input: {
                recipe:
                    input.recipe,

                visibility:
                    input.visibility,

                creatorStatement:
                    input.creatorStatement,

                rights:
                    input.rights,
            },

            actorUser,

            idempotencyKey:
                `fork:${idempotencyKey}`.slice(
                    0,
                    160,
                ),
        });

    const forkedCommunityRecipeId =
        created.communityRecipe.id;

    await RecipeFork.create({
        sourceCommunityRecipeId:
            source._id,

        sourceRecipeVersionId:
            source.recipeVersionId,

        forkedCommunityRecipeId,

        forkedRecipeVersionId:
            created
                .communityRecipe
                .recipeVersionId,

        forkedByUserId,

        attributionLabel:
            input.attributionLabel,

        copiedCreatorProse:
            input.reuseSourceProse ===
            true,

        copiedCreatorMedia:
            input.reuseSourceMedia ===
            true,

        idempotencyKey,
    });

    const createdCommunityRecipe =
        await CommunityRecipe.findById(
            forkedCommunityRecipeId,
        );

    return loadCommunityRecipeDetail({
        communityRecipe:
            createdCommunityRecipe,

        viewerUser:
            actorUser,
    });
}

export async function createCommunityRecipeReview({
    communityRecipeId,
    input,
    actorUser,
    idempotencyKey,
}) {
    const reviewerUserId =
        actorId(
            actorUser,
        );

    const communityRecipe =
        await CommunityRecipe.findOne({
            _id:
                communityRecipeId,

            visibility:
                'public',

            status:
                'published',

            moderationState:
                'approved',
        }).lean();

    if (!communityRecipe) {
        throw new ApiError(
            404,
            'Published Community Recipe was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_PUBLIC_NOT_FOUND',
                },
            ],
        );
    }

    if (
        stringId(
            communityRecipe
                .creatorUserId,
        ) ===
        stringId(
            reviewerUserId,
        )
    ) {
        throw new ApiError(
            409,
            'A creator cannot review their own Community Recipe.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_SELF_REVIEW_FORBIDDEN',
                },
            ],
        );
    }

    const existing =
        await CommunityRecipeReview.findOne({
            $or: [
                {
                    communityRecipeId,
                    reviewerUserId,
                },

                {
                    reviewerUserId,
                    idempotencyKey,
                },
            ],
        });

    if (existing) {
        return {
            review:
                serializeCommunityReview(
                    existing,
                ),

            ratings:
                await getRatingSummary(
                    communityRecipeId,
                ),
        };
    }

    const verifiedCook =
        Boolean(
            await PantryConsumptionEvent.exists({
                actorUserId:
                    reviewerUserId,

                recipeVersionId:
                    communityRecipe
                        .recipeVersionId,

                sourceType:
                    'recipe_cooked',
            }),
        );

    const review =
        await CommunityRecipeReview.create({
            communityRecipeId,

            recipeVersionId:
                communityRecipe
                    .recipeVersionId,

            reviewerUserId,

            ...input,

            verifiedCook,

            idempotencyKey,
        });

    return {
        review:
            serializeCommunityReview(
                review,
            ),

        ratings:
            await getRatingSummary(
                communityRecipeId,
            ),
    };
}

export async function listPublicCommunityRecipes({
    page,
    limit,
    search,
    creatorId,
}) {
    const filter = {
        visibility:
            'public',

        status:
            'published',

        moderationState:
            'approved',
    };

    if (creatorId) {
        filter.creatorProfileId =
            creatorId;
    }

    if (search) {
        const expression =
            new RegExp(
                String(
                    search,
                )
                    .replace(
                        /[.*+?^${}()|[\]\\]/g,
                        '\\$&',
                    ),
                'i',
            );

        const dishes =
            await Dish.find({
                status:
                    'active',

                $or: [
                    {
                        name:
                            expression,
                    },

                    {
                        description:
                            expression,
                    },

                    {
                        cuisine:
                            expression,
                    },

                    {
                        tags:
                            expression,
                    },
                ],
            })
                .select(
                    '_id',
                )
                .limit(
                    500,
                )
                .lean();

        filter.dishId = {
            $in:
                dishes.map(
                    (
                        item,
                    ) =>
                        item._id,
                ),
        };
    }

    const skip =
        (
            page -
            1
        ) *
        limit;

    const [
        records,
        total,
    ] =
        await Promise.all([
            CommunityRecipe.find(
                filter,
            )
                .sort({
                    createdAt:
                        -1,
                })
                .skip(
                    skip,
                )
                .limit(
                    limit,
                )
                .lean(),

            CommunityRecipe.countDocuments(
                filter,
            ),
        ]);

    const items = [];

    for (
        const record of records
    ) {
        const [
            dish,
            creator,
            ratings,
        ] =
            await Promise.all([
                Dish.findById(
                    record.dishId,
                )
                    .select(
                        'name slug description cuisine course tags heroImageUrl',
                    )
                    .lean(),

                CreatorProfile.findById(
                    record.creatorProfileId,
                )
                    .select(
                        'slug displayName creatorType verificationStatus',
                    )
                    .lean(),

                getRatingSummary(
                    record._id,
                ),
            ]);

        if (!dish) {
            continue;
        }

        items.push({
            communityRecipe:
                serializeCommunityRecipeMeta(
                    record,
                ),

            dish: {
                id:
                    stringId(
                        dish._id,
                    ),

                name:
                    dish.name,

                slug:
                    dish.slug,

                description:
                    dish.description ||
                    '',

                cuisine:
                    dish.cuisine ||
                    '',

                course:
                    dish.course ||
                    '',

                tags:
                    dish.tags ||
                    [],

                heroImageUrl:
                    dish.heroImageUrl ||
                    '',
            },

            creator:
                serializeCreatorProfile(
                    creator,
                ),

            ratings,
        });
    }

    return {
        recipes:
            items,

        pagination: {
            page,
            limit,
            total,

            pages:
                total ===
                0
                    ? 0
                    : Math.ceil(
                        total /
                            limit,
                    ),
        },
    };
}

export async function getCommunityRecipe({
    communityRecipeId,
    viewerUser = null,
}) {
    const communityRecipe =
        await CommunityRecipe.findById(
            communityRecipeId,
        );

    if (!communityRecipe) {
        throw new ApiError(
            404,
            'Community Recipe was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_NOT_FOUND',
                },
            ],
        );
    }

    return loadCommunityRecipeDetail({
        communityRecipe,
        viewerUser,
    });
}

export async function listMyCommunityRecipes({
    page,
    limit,
    status,
    actorUser,
}) {
    const creatorUserId =
        actorId(
            actorUser,
        );

    const filter = {
        creatorUserId,
    };

    if (status) {
        filter.status =
            status;
    }

    const skip =
        (
            page -
            1
        ) *
        limit;

    const [
        recipes,
        total,
    ] =
        await Promise.all([
            CommunityRecipe.find(
                filter,
            )
                .sort({
                    createdAt:
                        -1,
                })
                .skip(
                    skip,
                )
                .limit(
                    limit,
                )
                .lean(),

            CommunityRecipe.countDocuments(
                filter,
            ),
        ]);

    return {
        recipes:
            recipes.map(
                serializeCommunityRecipeMeta,
            ),

        pagination: {
            page,
            limit,
            total,

            pages:
                total ===
                0
                    ? 0
                    : Math.ceil(
                        total /
                            limit,
                    ),
        },
    };
}

export async function createCreatorProfile({
    input,
    actorUser,
}) {
    const userId =
        actorId(
            actorUser,
        );

    const normalizedSlug =
        normalizeCreatorSlug(
            input.slug,
        );

    if (!normalizedSlug) {
        throw new ApiError(
            400,
            'A valid Creator profile slug is required.',
            [
                {
                    code:
                        'CREATOR_PROFILE_SLUG_INVALID',
                },
            ],
        );
    }

    const existing =
        await CreatorProfile.findOne({
            userId,
        });

    if (existing) {
        throw new ApiError(
            409,
            'A Creator profile already exists for this identity.',
            [
                {
                    code:
                        'CREATOR_PROFILE_ALREADY_EXISTS',
                },
            ],
        );
    }

    const profile =
        await CreatorProfile.create({
            userId,

            slug:
                normalizedSlug,

            displayName:
                input.displayName,

            creatorType:
                'community_creator',

            verificationStatus:
                'unverified',

            biography:
                input.biography,

            cuisineSpecialties:
                uniqueStrings(
                    input.cuisineSpecialties,
                ),

            languages:
                uniqueStrings(
                    input.languages,
                    20,
                ).map(
                    (
                        value,
                    ) =>
                        value.toLowerCase(),
                ),

            commercialDisclosure:
                input.commercialDisclosure,

            isPublic:
                true,
        });

    return {
        creator:
            serializeCreatorProfile(
                profile,
            ),
    };
}

export async function requestCreatorVerification({
    statement,
    actorUser,
}) {
    const userId =
        actorId(
            actorUser,
        );

    const profile =
        await ensureCreatorProfile(
            actorUser,
        );

    if (
        profile.verificationStatus ===
        'verified'
    ) {
        return {
            creator:
                serializeCreatorProfile(
                    profile,
                ),
        };
    }

    profile.verificationStatus =
        'pending';

    profile.verificationStatement =
        statement;

    profile.verificationRequestedAt =
        new Date();

    profile.verificationReason =
        '';

    profile.verifiedAt =
        null;

    profile.verifiedByUserId =
        null;

    if (
        stringId(
            profile.userId,
        ) !==
        stringId(
            userId,
        )
    ) {
        throw new ApiError(
            403,
            'Creator verification request ownership mismatch.',
            [
                {
                    code:
                        'CREATOR_VERIFICATION_OWNERSHIP_INVALID',
                },
            ],
        );
    }

    await profile.save();

    return {
        creator:
            serializeCreatorProfile(
                profile,
            ),
    };
}

export async function getCreatorProfile(
    creatorProfileId,
) {
    const profile =
        await CreatorProfile.findOne({
            _id:
                creatorProfileId,

            isPublic:
                true,
        }).lean();

    if (!profile) {
        throw new ApiError(
            404,
            'Creator profile was not found.',
            [
                {
                    code:
                        'CREATOR_PROFILE_NOT_FOUND',
                },
            ],
        );
    }

    const [
        publishedRecipeCount,
        followerCount,
        listedCourseCount,
    ] =
        await Promise.all([
            CommunityRecipe.countDocuments({
                creatorProfileId:
                    profile._id,

                visibility:
                    'public',

                status:
                    'published',

                moderationState:
                    'approved',
            }),

            SocialFollow.countDocuments({
                followedUserId:
                    profile.userId,

                status:
                    'active',
            }),

            CreatorCourse.countDocuments({
                creatorProfileId:
                    profile._id,

                status:
                    'listed',

                'rights.takedownState':
                    'clear',
            }),
        ]);

    return {
        creator:
            serializeCreatorProfile(
                profile,
            ),

        stats: {
            publishedRecipeCount,
            followerCount,
            listedCourseCount,
        },
    };
}

export async function followCreator({
    creatorProfileId,
    actorUser,
}) {
    const followerUserId =
        actorId(
            actorUser,
        );

    const creator =
        await CreatorProfile.findOne({
            _id:
                creatorProfileId,

            isPublic:
                true,
        }).lean();

    if (!creator) {
        throw new ApiError(
            404,
            'Creator profile was not found.',
            [
                {
                    code:
                        'CREATOR_PROFILE_NOT_FOUND',
                },
            ],
        );
    }

    if (
        stringId(
            creator.userId,
        ) ===
        stringId(
            followerUserId,
        )
    ) {
        throw new ApiError(
            409,
            'You cannot follow your own Creator profile.',
            [
                {
                    code:
                        'CREATOR_SELF_FOLLOW_FORBIDDEN',
                },
            ],
        );
    }

    const follow =
        await SocialFollow.findOneAndUpdate(
            {
                followerUserId,

                followedUserId:
                    creator.userId,
            },
            {
                $set: {
                    status:
                        'active',
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
        following:
            follow.status ===
            'active',

        creatorProfileId:
            stringId(
                creator._id,
            ),
    };
}

export async function listCommunityModerationQueue({
    page,
    limit,
    status,
}) {
    const filter = {};

    if (status) {
        filter.moderationState =
            status;
    } else {
        filter.moderationState = {
            $in: [
                'pending',
                'changes_requested',
            ],
        };
    }

    const skip =
        (
            page -
            1
        ) *
        limit;

    const [
        recipes,
        total,
    ] =
        await Promise.all([
            CommunityRecipe.find(
                filter,
            )
                .sort({
                    submittedForModerationAt:
                        1,

                    createdAt:
                        1,
                })
                .skip(
                    skip,
                )
                .limit(
                    limit,
                )
                .lean(),

            CommunityRecipe.countDocuments(
                filter,
            ),
        ]);

    return {
        recipes:
            recipes.map(
                serializeCommunityRecipeMeta,
            ),

        pagination: {
            page,
            limit,
            total,

            pages:
                total ===
                0
                    ? 0
                    : Math.ceil(
                        total /
                            limit,
                    ),
        },
    };
}

async function requireApprovedFoodIntelligence(
    recipeVersionId,
) {
    const approved =
        await FoodCalculation.findOne({
            entityType:
                'recipe_version',

            entityId:
                recipeVersionId,

            status:
                'approved',
        })
            .sort({
                calculationVersion:
                    -1,
            })
            .lean();

    if (!approved) {
        throw new ApiError(
            409,
            'Approved Food Intelligence is required before a public Community Recipe can be published.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_FOOD_INTELLIGENCE_APPROVAL_REQUIRED',
                },
            ],
        );
    }

    return approved;
}

export async function moderateCommunityRecipe({
    communityRecipeId,
    input,
    actorUser,
    adminAuthorization,
    requestId,
}) {
    actorId(
        actorUser,
    );

    const communityRecipe =
        await CommunityRecipe.findById(
            communityRecipeId,
        );

    if (!communityRecipe) {
        throw new ApiError(
            404,
            'Community Recipe moderation record was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_MODERATION_NOT_FOUND',
                },
            ],
        );
    }

    if (
        communityRecipe.status !==
            'pending_moderation' ||
        communityRecipe
            .moderationState !==
            'pending'
    ) {
        throw new ApiError(
            409,
            'Community Recipe is not currently awaiting moderation.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_NOT_PENDING_MODERATION',
                },
            ],
        );
    }

    const beforeSnapshot =
        serializeCommunityRecipeMeta(
            communityRecipe,
        );

    const auditContext = {
        adminAuthorization,
        requestId,
    };

    if (
        input.decision ===
        'approve'
    ) {
        if (
            !adminAuthorizationHasAllPermissions(
                adminAuthorization,
                [
                    'recipe.mutate',
                    'recipe.publish',
                ],
            )
        ) {
            throw new ApiError(
                403,
                'Recipe mutation and publication permissions are both required for Community publication.',
                [
                    {
                        code:
                            'COMMUNITY_RECIPE_PUBLISH_PERMISSION_REQUIRED',

                        requiredPermissionKeys: [
                            'recipe.mutate',
                            'recipe.publish',
                        ],
                    },
                ],
            );
        }

        await requireApprovedFoodIntelligence(
            communityRecipe
                .recipeVersionId,
        );

        await reviewRecipeVersion(
            communityRecipe
                .recipeVersionId,
            {
                reviewType:
                    'editorial',

                decision:
                    'approved',

                reason:
                    input.reason,
            },
            actorUser,
            auditContext,
        );

        await reviewRecipeVersion(
            communityRecipe
                .recipeVersionId,
            {
                reviewType:
                    'qa',

                decision:
                    'approved',

                reason:
                    input.reason,
            },
            actorUser,
            auditContext,
        );

        await publishRecipeVersion(
            communityRecipe
                .recipeVersionId,
            {
                effectiveFrom:
                    input.effectiveFrom ||
                    new Date(),

                reason:
                    input.reason,
            },
            actorUser,
            auditContext,
        );

        communityRecipe.status =
            'published';

        communityRecipe.moderationState =
            'approved';
    } else {
        await reviewRecipeVersion(
            communityRecipe
                .recipeVersionId,
            {
                reviewType:
                    'editorial',

                decision:
                    input.decision ===
                    'request_changes'
                        ? 'changes_requested'
                        : 'rejected',

                reason:
                    input.reason,
            },
            actorUser,
            auditContext,
        );

        communityRecipe.status =
            'rejected';

        communityRecipe.moderationState =
            input.decision ===
            'request_changes'
                ? 'changes_requested'
                : 'rejected';
    }

    communityRecipe.moderatedAt =
        new Date();

    communityRecipe.moderatedByUserId =
        actorUser._id ||
        actorUser.id;

    communityRecipe.moderationReason =
        input.reason;

    await communityRecipe.save();

    await recordAdminAuditEvent({
        actorUser,
        adminAuthorization,

        action:
            'recipe.mutate',

        permissionKey:
            'recipe.mutate',

        entityType:
            'community_recipe',

        entityId:
            String(
                communityRecipe._id,
            ),

        reasonCode:
            'recipe.governance',

        reasonDetails:
            input.reason,

        beforeSnapshot,

        afterSnapshot:
            serializeCommunityRecipeMeta(
                communityRecipe,
            ),

        metadata: {
            operation:
                'm15_community_recipe_moderation',

            decision:
                input.decision,

            foodIntelligenceCopiedFromParent:
                false,
        },

        requestId,
    });

    return getModerationRecipeDetail(
        communityRecipe._id,
    );
}

export async function listCreatorVerificationQueue({
    page,
    limit,
    status,
}) {
    const skip =
        (
            page -
            1
        ) *
        limit;

    const [
        creators,
        total,
    ] =
        await Promise.all([
            CreatorProfile.find({
                verificationStatus:
                    status,
            })
                .sort({
                    verificationRequestedAt:
                        1,

                    createdAt:
                        1,
                })
                .skip(
                    skip,
                )
                .limit(
                    limit,
                )
                .lean(),

            CreatorProfile.countDocuments({
                verificationStatus:
                    status,
            }),
        ]);

    return {
        creators:
            creators.map(
                serializeCreatorProfile,
            ),

        pagination: {
            page,
            limit,
            total,

            pages:
                total ===
                0
                    ? 0
                    : Math.ceil(
                        total /
                            limit,
                    ),
        },
    };
}

export async function verifyCreatorProfile({
    creatorProfileId,
    input,
    actorUser,
    adminAuthorization,
    requestId,
}) {
    actorId(
        actorUser,
    );

    const profile =
        await CreatorProfile.findById(
            creatorProfileId,
        );

    if (!profile) {
        throw new ApiError(
            404,
            'Creator profile was not found.',
            [
                {
                    code:
                        'CREATOR_PROFILE_NOT_FOUND',
                },
            ],
        );
    }

    const beforeSnapshot =
        serializeCreatorProfile(
            profile,
        );

    profile.verificationStatus =
        input.decision;

    profile.creatorType =
        input.decision ===
        'verified'
            ? 'chef'
            : profile.creatorType;

    profile.verificationReason =
        input.reason;

    profile.verifiedAt =
        input.decision ===
        'verified'
            ? new Date()
            : null;

    profile.verifiedByUserId =
        input.decision ===
        'verified'
            ? actorUser._id ||
                actorUser.id
            : null;

    await profile.save();

    await recordAdminAuditEvent({
        actorUser,
        adminAuthorization,

        action:
            'trust_safety.mutate',

        permissionKey:
            'trust_safety.mutate',

        entityType:
            'creator_profile',

        entityId:
            String(
                profile._id,
            ),

        reasonCode:
            'trust_safety.enforcement',

        reasonDetails:
            input.reason,

        beforeSnapshot,

        afterSnapshot:
            serializeCreatorProfile(
                profile,
            ),

        metadata: {
            operation:
                'm15_creator_verification',

            decision:
                input.decision,

            createsApplicationRole:
                false,
        },

        requestId,
    });

    return {
        creator:
            serializeCreatorProfile(
                profile,
            ),
    };
}

export async function getModerationRecipeDetail(
    communityRecipeId,
) {
    const communityRecipe =
        await CommunityRecipe.findById(
            communityRecipeId,
        );

    if (!communityRecipe) {
        throw new ApiError(
            404,
            'Community Recipe moderation record was not found.',
            [
                {
                    code:
                        'COMMUNITY_RECIPE_MODERATION_NOT_FOUND',
                },
            ],
        );
    }

    const [
        recipe,
        creator,
        foodIntelligence,
    ] =
        await Promise.all([
            getAdminRecipeVersion(
                communityRecipe
                    .recipeVersionId,
            ),

            CreatorProfile.findById(
                communityRecipe
                    .creatorProfileId,
            ).lean(),

            loadFoodIntelligenceState(
                communityRecipe
                    .recipeVersionId,
            ),
        ]);

    return {
        communityRecipe:
            serializeCommunityRecipeMeta(
                communityRecipe,
            ),

        creator:
            serializeCreatorProfile(
                creator,
            ),

        recipe,

        foodIntelligence,
    };
}

/*
|--------------------------------------------------------------------------
| M15 Part 4 - Community Composer Support
|--------------------------------------------------------------------------
*/

export async function searchCommunityCanonicalIngredients({
    search,
    limit,
}) {
    const escaped =
        String(
            search ||
                '',
        ).replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
        );

    const expression =
        new RegExp(
            escaped,
            'i',
        );

    const ingredients =
        await CanonicalIngredient.find({
            status:
                'active',

            $or: [
                {
                    canonicalName:
                        expression,
                },

                {
                    aliases:
                        expression,
                },

                {
                    slug:
                        expression,
                },
            ],
        })
            .sort({
                canonicalName:
                    1,
            })
            .limit(
                limit,
            )
            .select(
                '_id canonicalName slug aliases attributes',
            )
            .lean();

    return {
        ingredients:
            ingredients.map(
                (
                    ingredient,
                ) => ({
                    id:
                        stringId(
                            ingredient._id,
                        ),

                    canonicalName:
                        ingredient.canonicalName,

                    slug:
                        ingredient.slug,

                    aliases:
                        ingredient.aliases ||
                        [],

                    attributes:
                        ingredient.attributes ||
                        {},
                }),
            ),
    };
}

export async function getMyCreatorProfile({
    actorUser,
}) {
    const userId =
        actorId(
            actorUser,
        );

    const profile =
        await CreatorProfile.findOne({
            userId,
        }).lean();

    if (!profile) {
        return {
            creator:
                null,

            stats: {
                publishedRecipeCount:
                    0,

                followerCount:
                    0,

                listedCourseCount:
                    0,
            },
        };
    }

    const [
        publishedRecipeCount,
        followerCount,
        listedCourseCount,
    ] =
        await Promise.all([
            CommunityRecipe.countDocuments({
                creatorProfileId:
                    profile._id,

                visibility:
                    'public',

                status:
                    'published',

                moderationState:
                    'approved',
            }),

            SocialFollow.countDocuments({
                followedUserId:
                    profile.userId,

                status:
                    'active',
            }),

            CreatorCourse.countDocuments({
                creatorProfileId:
                    profile._id,

                status:
                    'listed',

                'rights.takedownState':
                    'clear',
            }),
        ]);

    return {
        creator:
            serializeCreatorProfile(
                profile,
            ),

        stats: {
            publishedRecipeCount,
            followerCount,
            listedCourseCount,
        },
    };
}

/*
|--------------------------------------------------------------------------
| M15 Part 4 - EPANTRY Pro / Course Placeholder Foundation
|--------------------------------------------------------------------------
|
| Full live sessions, bookings, payments, course modules, progress tracking,
| payouts and creator marketplace economics are explicitly later scope.
|
| This foundation provides:
| - verified-chef-owned course discovery placeholders,
| - CourseEntitlement reads,
| - Prepare-for-Class via the existing M10 Outcome Plan engine.
|
| Basic Recipe/Food Intelligence remains available through existing public
| Recipe surfaces and is never hidden merely because a course is Pro.
|--------------------------------------------------------------------------
*/

function normalizeCourseSlug(
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
            220,
        );
}

function serializeCreatorCourse(
    course,
) {
    if (!course) {
        return null;
    }

    const value =
        typeof course.toObject ===
            'function'
            ? course.toObject()
            : course;

    return {
        id:
            stringId(
                value._id ||
                    value.id,
            ),

        creatorProfileId:
            stringId(
                value.creatorProfileId,
            ),

        linkedCommunityRecipeId:
            stringId(
                value.linkedCommunityRecipeId,
            ),

        linkedRecipeVersionId:
            stringId(
                value.linkedRecipeVersionId,
            ),

        slug:
            value.slug,

        title:
            value.title,

        summary:
            value.summary ||
            '',

        category:
            value.category ||
            '',

        language:
            value.language ||
            'en',

        accessType:
            value.accessType,

        status:
            value.status,

        requiredEquipment:
            value.requiredEquipment ||
            [],

        commercialDisclosure:
            value.commercialDisclosure ||
            '',

        rights: {
            ownerOrLicensor:
                value.rights
                    ?.ownerOrLicensor ||
                '',

            allowedTerritories:
                value.rights
                    ?.allowedTerritories ||
                [],

            downloadableMaterialsAllowed:
                value.rights
                    ?.downloadableMaterialsAllowed ===
                true,

            sponsored:
                value.rights
                    ?.sponsored ===
                true,

            takedownState:
                value.rights
                    ?.takedownState ||
                'clear',
        },

        createdAt:
            value.createdAt ||
            null,
    };
}

async function requireVerifiedChefProfile(
    actorUser,
) {
    const userId =
        actorId(
            actorUser,
        );

    const profile =
        await CreatorProfile.findOne({
            userId,

            creatorType:
                'chef',

            verificationStatus:
                'verified',

            isPublic:
                true,
        });

    if (!profile) {
        throw new ApiError(
            403,
            'A verified Chef/Creator profile is required for course publishing.',
            [
                {
                    code:
                        'CREATOR_COURSE_VERIFIED_CHEF_REQUIRED',
                },
            ],
        );
    }

    return profile;
}

export async function createCreatorCourse({
    input,
    actorUser,
}) {
    const userId =
        actorId(
            actorUser,
        );

    const creator =
        await requireVerifiedChefProfile(
            actorUser,
        );

    const communityRecipe =
        await CommunityRecipe.findOne({
            _id:
                input.linkedCommunityRecipeId,

            creatorUserId:
                userId,

            creatorProfileId:
                creator._id,

            visibility:
                'public',

            status:
                'published',

            moderationState:
                'approved',
        }).lean();

    if (!communityRecipe) {
        throw new ApiError(
            409,
            'A course placeholder must link to your own moderated, published Community Recipe.',
            [
                {
                    code:
                        'CREATOR_COURSE_PUBLISHED_RECIPE_REQUIRED',
                },
            ],
        );
    }

    await requireApprovedFoodIntelligence(
        communityRecipe.recipeVersionId,
    );

    const slug =
        normalizeCourseSlug(
            input.slug ||
                input.title,
        );

    if (!slug) {
        throw new ApiError(
            400,
            'A valid course slug is required.',
            [
                {
                    code:
                        'CREATOR_COURSE_SLUG_INVALID',
                },
            ],
        );
    }

    const duplicate =
        await CreatorCourse.exists({
            slug,
        });

    if (duplicate) {
        throw new ApiError(
            409,
            'A Learn/Pro course with this slug already exists.',
            [
                {
                    code:
                        'CREATOR_COURSE_SLUG_CONFLICT',
                },
            ],
        );
    }

    const course =
        await CreatorCourse.create({
            creatorProfileId:
                creator._id,

            createdByUserId:
                userId,

            linkedCommunityRecipeId:
                communityRecipe._id,

            linkedRecipeVersionId:
                communityRecipe.recipeVersionId,

            slug,

            title:
                input.title,

            summary:
                input.summary,

            category:
                input.category,

            language:
                String(
                    input.language ||
                        'en',
                ).toLowerCase(),

            accessType:
                input.accessType,

            status:
                'listed',

            requiredEquipment:
                uniqueStrings(
                    input.requiredEquipment,
                    50,
                ),

            commercialDisclosure:
                input.commercialDisclosure,

            rights: {
                ownerOrLicensor:
                    input.rights
                        ?.ownerOrLicensor ||
                    creator.displayName,

                allowedTerritories:
                    uniqueStrings(
                        input.rights
                            ?.allowedTerritories,
                        30,
                    ).map(
                        (
                            value,
                        ) =>
                            value.toUpperCase(),
                    ),

                downloadableMaterialsAllowed:
                    input.rights
                        ?.downloadableMaterialsAllowed ===
                    true,

                sponsored:
                    input.rights
                        ?.sponsored ===
                    true,

                takedownState:
                    'clear',
            },
        });

    return {
        course:
            serializeCreatorCourse(
                course,
            ),

        creator:
            serializeCreatorProfile(
                creator,
            ),

        capabilities: {
            coursePlaceholderOnly:
                true,

            liveSessionsAvailable:
                false,

            courseCommerceAvailable:
                false,

            coreRecipeFactsRemainPublic:
                true,
        },
    };
}

export async function listCreatorCourses({
    page,
    limit,
    creatorId,
    accessType,
}) {
    const filter = {
        status:
            'listed',

        'rights.takedownState':
            'clear',
    };

    if (creatorId) {
        filter.creatorProfileId =
            creatorId;
    }

    if (accessType) {
        filter.accessType =
            accessType;
    }

    const skip =
        (
            page -
            1
        ) *
        limit;

    const [
        courses,
        total,
    ] =
        await Promise.all([
            CreatorCourse.find(
                filter,
            )
                .sort({
                    createdAt:
                        -1,
                })
                .skip(
                    skip,
                )
                .limit(
                    limit,
                )
                .lean(),

            CreatorCourse.countDocuments(
                filter,
            ),
        ]);

    const items = [];

    for (
        const course of courses
    ) {
        const [
            creator,
            communityRecipe,
        ] =
            await Promise.all([
                CreatorProfile.findById(
                    course.creatorProfileId,
                )
                    .select(
                        'slug displayName creatorType verificationStatus biography cuisineSpecialties languages commercialDisclosure isPublic createdAt',
                    )
                    .lean(),

                CommunityRecipe.findOne({
                    _id:
                        course.linkedCommunityRecipeId,

                    visibility:
                        'public',

                    status:
                        'published',

                    moderationState:
                        'approved',
                })
                    .select(
                        '_id dishId recipeVersionId',
                    )
                    .lean(),
            ]);

        if (
            !creator ||
            creator.verificationStatus !==
                'verified' ||
            !communityRecipe
        ) {
            continue;
        }

        const dish =
            await Dish.findById(
                communityRecipe.dishId,
            )
                .select(
                    'name slug description cuisine course tags heroImageUrl',
                )
                .lean();

        if (!dish) {
            continue;
        }

        items.push({
            course:
                serializeCreatorCourse(
                    course,
                ),

            creator:
                serializeCreatorProfile(
                    creator,
                ),

            recipe: {
                communityRecipeId:
                    stringId(
                        communityRecipe._id,
                    ),

                recipeVersionId:
                    stringId(
                        communityRecipe.recipeVersionId,
                    ),

                dishId:
                    stringId(
                        dish._id,
                    ),

                name:
                    dish.name,

                slug:
                    dish.slug,

                description:
                    dish.description ||
                    '',

                cuisine:
                    dish.cuisine ||
                    '',

                heroImageUrl:
                    dish.heroImageUrl ||
                    '',
            },

            policy: {
                coreRecipeFactsRemainPublic:
                    true,

                liveSessionsAvailable:
                    false,

                fullCourseBuilderAvailable:
                    false,
            },
        });
    }

    return {
        courses:
            items,

        pagination: {
            page,
            limit,
            total,

            pages:
                total ===
                0
                    ? 0
                    : Math.ceil(
                        total /
                            limit,
                    ),
        },
    };
}

async function findActiveCourseEntitlement({
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

export async function getLearningPro({
    actorUser,
}) {
    const userId =
        actorId(
            actorUser,
        );

    const now =
        new Date();

    const entitlements =
        await CourseEntitlement.find({
            userId,

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
        })
            .sort({
                createdAt:
                    -1,
            })
            .lean();

    const courseIds =
        entitlements.map(
            (
                item,
            ) =>
                item.courseId,
        );

    const courses =
        courseIds.length
            ? await CreatorCourse.find({
                _id: {
                    $in:
                        courseIds,
                },

                status:
                    'listed',

                'rights.takedownState':
                    'clear',
            }).lean()
            : [];

    const courseById =
        new Map(
            courses.map(
                (
                    course,
                ) => [
                    stringId(
                        course._id,
                    ),
                    course,
                ],
            ),
        );

    return {
        entitlementType:
            'course_entitlement',

        entitlements:
            entitlements
                .map(
                    (
                        entitlement,
                    ) => {
                        const course =
                            courseById.get(
                                stringId(
                                    entitlement.courseId,
                                ),
                            );

                        if (!course) {
                            return null;
                        }

                        return {
                            id:
                                stringId(
                                    entitlement._id,
                                ),

                            source:
                                entitlement.source,

                            status:
                                entitlement.status,

                            startsAt:
                                entitlement.startsAt,

                            endsAt:
                                entitlement.endsAt ||
                                null,

                            course:
                                serializeCreatorCourse(
                                    course,
                                ),
                        };
                    },
                )
                .filter(
                    Boolean,
                ),

        policy: {
            proIsApplicationRole:
                false,

            coreRecipeFactsRemainPublic:
                true,

            liveSessionsAvailable:
                false,

            subscriptionCheckoutAvailable:
                false,
        },
    };
}

export async function prepareCreatorCourse({
    courseId,
    targetServings,
    idempotencyKey,
    actorUser,
}) {
    const userId =
        actorId(
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
            'Learn/Pro course was not found.',
            [
                {
                    code:
                        'CREATOR_COURSE_NOT_FOUND',
                },
            ],
        );
    }

    if (
        course.accessType ===
        'pro'
    ) {
        const entitlement =
            await findActiveCourseEntitlement({
                userId,

                courseId:
                    course._id,
            });

        if (!entitlement) {
            throw new ApiError(
                403,
                'An active Course entitlement is required to prepare this Pro class.',
                [
                    {
                        code:
                            'COURSE_ENTITLEMENT_REQUIRED',
                    },
                ],
            );
        }
    }

    const communityRecipe =
        await CommunityRecipe.findOne({
            _id:
                course.linkedCommunityRecipeId,

            recipeVersionId:
                course.linkedRecipeVersionId,

            visibility:
                'public',

            status:
                'published',

            moderationState:
                'approved',
        }).lean();

    if (!communityRecipe) {
        throw new ApiError(
            409,
            'The course recipe is no longer available as a moderated public Recipe.',
            [
                {
                    code:
                        'COURSE_RECIPE_UNAVAILABLE',
                },
            ],
        );
    }

    await requireApprovedFoodIntelligence(
        communityRecipe.recipeVersionId,
    );

    const dish =
        await Dish.findById(
            communityRecipe.dishId,
        )
            .select(
                '_id slug name',
            )
            .lean();

    if (!dish) {
        throw new ApiError(
            409,
            'The linked Course Dish is unavailable.',
            [
                {
                    code:
                        'COURSE_DISH_UNAVAILABLE',
                },
            ],
        );
    }

    /*
    |------------------------------------------------------------------------
    | Prepare for Class = M10 Outcome Plan
    |------------------------------------------------------------------------
    |
    | This is not a second shortage engine. M10 owns deterministic Recipe ->
    | Pantry reconciliation -> genuine shortage -> requirement basket truth.
    |------------------------------------------------------------------------
    */

    const outcomePlan =
        await createRecipeOutcomePlan({
            recipeId:
                dish.slug,

            targetServings,

            idempotencyKey:
                `course:${idempotencyKey}`.slice(
                    0,
                    160,
                ),

            actorUser,
        });

    return {
        course:
            serializeCreatorCourse(
                course,
            ),

        preparation: {
            targetServings,

            requiredEquipment:
                course.requiredEquipment ||
                [],

            outcomePlan,
        },

        policy: {
            pantryReadinessUsesM10OutcomePlan:
                true,

            coreRecipeFactsRemainPublic:
                true,

            liveSessionBookingAvailable:
                false,

            automaticPurchase:
                false,
        },
    };
}