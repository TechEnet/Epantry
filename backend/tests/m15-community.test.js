import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
    fileURLToPath,
} from 'node:url';

const __filename =
    fileURLToPath(
        import.meta.url,
    );

const __dirname =
    path.dirname(
        __filename,
    );

const backendRoot =
    path.resolve(
        __dirname,
        '..',
    );

const projectRoot =
    path.resolve(
        backendRoot,
        '..',
    );

function readBackend(
    relativePath,
) {
    return fs.readFileSync(
        path.join(
            backendRoot,
            relativePath,
        ),
        'utf8',
    );
}

function readFrontend(
    relativePath,
) {
    return fs.readFileSync(
        path.join(
            projectRoot,
            'frontend',
            relativePath,
        ),
        'utf8',
    );
}

test(
    'M15 models register community, fork, review, creator, course and entitlement collections',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.models.js',
            );

        for (
            const collection of [
                'communityRecipes',
                'recipeForks',
                'communityRecipeReviews',
                'socialFollows',
                'creatorProfiles',
                'creatorCourses',
                'courseEntitlements',
            ]
        ) {
            assert.match(
                source,
                new RegExp(
                    collection,
                ),
            );
        }
    },
);

test(
    'M15 Community executable recipe content reuses M07 instead of storing a parallel ingredient recipe document',
    () => {
        const models =
            readBackend(
                'src/modules/community/community.models.js',
            );

        const service =
            readBackend(
                'src/modules/community/community.service.js',
            );

        assert.match(
            service,
            /createAdminRecipe\(/,
        );

        assert.match(
            service,
            /getAdminRecipeVersion\(/,
        );

        const communityRecipeBlock =
            models.slice(
                models.indexOf(
                    'const communityRecipeSchema',
                ),
                models.indexOf(
                    'const recipeForkSchema',
                ),
            );

        assert.doesNotMatch(
            communityRecipeBlock,
            /ingredients\s*:/,
        );

        assert.doesNotMatch(
            communityRecipeBlock,
            /steps\s*:/,
        );
    },
);

test(
    'M15 verified cook signal uses the frozen M09 PantryConsumptionEvent contract',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /PantryConsumptionEvent/,
        );

        assert.match(
            source,
            /sourceType:\s*['"]recipe_cooked['"]/,
        );

        assert.doesNotMatch(
            source,
            /\bConsumptionEvent\.exists/,
        );
    },
);

test(
    'M15 fork stores attribution lineage and never copies parent food calculation',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /RecipeFork\.create/,
        );

        assert.match(
            source,
            /sourceRecipeVersionId/,
        );

        assert.match(
            source,
            /forkedRecipeVersionId/,
        );

        assert.match(
            source,
            /calculationsCopiedFromParent:\s*false/,
        );
    },
);

test(
    'M15 public publication requires approved M08 calculation and M07 review publication services',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /requireApprovedFoodIntelligence/,
        );

        assert.match(
            source,
            /status:\s*['"]approved['"]/,
        );

        assert.match(
            source,
            /reviewRecipeVersion\(/,
        );

        assert.match(
            source,
            /publishRecipeVersion\(/,
        );
    },
);

test(
    'M15 Pro course preparation reuses M10 Outcome Plan and checks CourseEntitlement',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /createRecipeOutcomePlan\(/,
        );

        assert.match(
            source,
            /CourseEntitlement\.findOne/,
        );

        assert.match(
            source,
            /COURSE_ENTITLEMENT_REQUIRED/,
        );

        assert.match(
            source,
            /automaticPurchase:\s*false/,
        );
    },
);

test(
    'M15 exposes P29 P30 P31 backend API surfaces',
    () => {
        const source =
            readBackend(
                'src/modules/community/community.routes.js',
            );

        for (
            const route of [
                '/community-recipes',
                '/recipes/community',
                '/recipes/:id/fork',
                '/recipes/:id/reviews',
                '/creators/:id',
                '/me/creator-profile',
                '/courses',
                '/learning/pro',
                '/courses/:id/prepare',
            ]
        ) {
            assert.equal(
                source.includes(
                    route,
                ),
                true,
                `${route} must be present.`,
            );
        }

        for (
            const schema of [
                'listCreatorCoursesQuerySchema',
                'ingredientLookupQuerySchema',
                'createCreatorCourseBodySchema',
                'courseIdParamsSchema',
                'prepareCreatorCourseBodySchema',
            ]
        ) {
            assert.equal(
                source.includes(
                    schema,
                ),
                true,
                `${schema} must remain wired to the M15 route validators.`,
            );
        }
    },
);

test(
    'M15 frontend has Community Creator Learn and Admin pages',
    () => {
        for (
            const file of [
                'src/features/community/pages/CommunityRecipesPage.jsx',
                'src/features/community/pages/CreatorProfilePage.jsx',
                'src/features/community/pages/LearnProPage.jsx',
                'src/features/community/pages/AdminCommunityPage.jsx',
                'src/features/community/services/community.service.js',
            ]
        ) {
            assert.equal(
                fs.existsSync(
                    path.join(
                        projectRoot,
                        'frontend',
                        file,
                    ),
                ),
                true,
                `${file} must exist.`,
            );
        }
    },
);

test(
    'M15 frontend routes expose P29 P30 P31 and M03 Admin Community Ops',
    () => {
        const source =
            readFrontend(
                'src/routes/AppRoutes.jsx',
            );

        for (
            const route of [
                'path="/community"',
                'path="/community/:communityRecipeId"',
                'path="/creators/:creatorProfileId"',
                'path="/creator-studio"',
                'path="/learn"',
                'path="/admin/community"',
            ]
        ) {
            assert.match(
                source,
                new RegExp(
                    route.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        '\\$&',
                    ),
                ),
            );
        }
    },
);

test(
    'M15 Community UI visibly distinguishes creator statements and recalculated platform intelligence',
    () => {
        const source =
            readFrontend(
                'src/features/community/pages/CommunityRecipesPage.jsx',
            );

        assert.match(
            source,
            /Creator-provided statement/,
        );

        assert.match(
            source,
            /Community contributed/,
        );

        assert.match(
            source,
            /recalculated independently/,
        );

        assert.match(
            source,
            /Share recipe link/,
        );

        assert.match(
            source,
            /private household or pantry data/i,
        );
    },
);