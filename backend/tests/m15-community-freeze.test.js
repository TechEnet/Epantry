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

const projectRoot =
    path.resolve(
        __dirname,
        '..',
        '..',
    );

function read(
    relativePath,
) {
    return fs.readFileSync(
        path.join(
            projectRoot,
            relativePath,
        ),
        'utf8',
    );
}

function stripComments(
    source,
) {
    return source
        .replace(
            /\/\*[\s\S]*?\*\//g,
            '',
        )
        .replace(
            /(^|[^:])\/\/.*$/gm,
            '$1',
        );
}

test(
    'M15 Final keeps exactly Customer Host Super Admin application access architecture',
    () => {
        const routes =
            stripComments(
                read(
                    'backend/src/modules/community/community.routes.js',
                ),
            );

        const service =
            stripComments(
                read(
                    'backend/src/modules/community/community.service.js',
                ),
            );

        assert.doesNotMatch(
            routes,
            /activeMode/,
        );

        assert.doesNotMatch(
            service,
            /activeMode/,
        );

        for (
            const forbidden of [
                'sellerEnabled',
                'brandEnabled',
                'b2bEnabled',
                'creatorEnabled',
                'proEnabled',
            ]
        ) {
            assert.equal(
                routes.includes(
                    forbidden,
                ) ||
                service.includes(
                    forbidden,
                ),
                false,
                `${forbidden} must not become a new application capability.`,
            );
        }
    },
);

test(
    'M15 Customer contribution uses requireCustomerAccess while Admin moderation stays on M03 permission engine',
    () => {
        const source =
            stripComments(
                read(
                    'backend/src/modules/community/community.routes.js',
                ),
            );

        assert.match(
            source,
            /const customerSecurity = \[[\s\S]*?requireCustomerAccess[\s\S]*?\]/,
        );

        assert.doesNotMatch(
            source,
            /customerRouter\.use\(/,
        );

        assert.match(
            source,
            /customerRouter\.post\([\s\S]*?['"]\/recipes\/community['"][\s\S]*?\.\.\.customerSecurity/,
        );

        assert.match(
            source,
            /adminRouter\.use\([\s\S]*?loadAdminAuthorization[\s\S]*?requireAdminAccess[\s\S]*?requireMfaAssurance/,
        );

        assert.match(
            source,
            /recipe\.mutate/,
        );

        assert.match(
            source,
            /trust_safety\.mutate/,
        );
    },
);

test(
    'M15 Creator verification cannot mutate User application capability fields',
    () => {
        const source =
            stripComments(
                read(
                    'backend/src/modules/community/community.service.js',
                ),
            );

        const block =
            source.slice(
                source.indexOf(
                    'export async function verifyCreatorProfile',
                ),
                source.indexOf(
                    'export async function getModerationRecipeDetail',
                ),
            );

        assert.doesNotMatch(
            block,
            /customerEnabled|hostEnabled|hostAccessStatus|superAdminEnabled|activeMode/,
        );

        assert.match(
            block,
            /verificationStatus/,
        );
    },
);

test(
    'M15 Community Recipe publication cannot bypass M08 approved Food Intelligence',
    () => {
        const source =
            read(
                'backend/src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /COMMUNITY_RECIPE_FOOD_INTELLIGENCE_APPROVAL_REQUIRED/,
        );

        assert.match(
            source,
            /entityType:\s*['"]recipe_version['"]/,
        );

        assert.match(
            source,
            /status:\s*['"]approved['"]/,
        );
    },
);

test(
    'M15 fork never copies parent FoodCalculation or creator prose media without rights',
    () => {
        const source =
            read(
                'backend/src/modules/community/community.service.js',
            );

        assert.match(
            source,
            /COMMUNITY_RECIPE_PROSE_REUSE_NOT_PERMITTED/,
        );

        assert.match(
            source,
            /COMMUNITY_RECIPE_MEDIA_REUSE_NOT_PERMITTED/,
        );

        assert.match(
            source,
            /foodIntelligencePolicy/,
        );

        assert.doesNotMatch(
            source,
            /FoodCalculation\.create\([\s\S]*?sourceRecipeVersionId/,
        );
    },
);

test(
    'M15 Pro remains entitlement based and does not hide basic Recipe facts',
    () => {
        const models =
            read(
                'backend/src/modules/community/community.models.js',
            );

        const service =
            read(
                'backend/src/modules/community/community.service.js',
            );

        assert.match(
            models,
            /collection:\s*['"]courseEntitlements['"]/,
        );

        assert.match(
            service,
            /proIsApplicationRole:\s*false/,
        );

        assert.match(
            service,
            /coreRecipeFactsRemainPublic:\s*true/,
        );
    },
);

test(
    'M15 Prepare-for-Class reuses M10 and cannot automatically purchase',
    () => {
        const source =
            read(
                'backend/src/modules/community/community.service.js',
            );

        const block =
            source.slice(
                source.indexOf(
                    'export async function prepareCreatorCourse',
                ),
            );

        assert.match(
            block,
            /createRecipeOutcomePlan/,
        );

        assert.match(
            block,
            /automaticPurchase:\s*false/,
        );

        assert.doesNotMatch(
            block,
            /createOrder|capturePayment|Razorpay|paymentIntent/,
        );
    },
);

test(
    'M15 intentionally does not implement live session booking or creator marketplace economics',
    () => {
        const models =
            stripComments(
                read(
                    'backend/src/modules/community/community.models.js',
                ),
            );

        const routes =
            stripComments(
                read(
                    'backend/src/modules/community/community.routes.js',
                ),
            );

        assert.doesNotMatch(
            models,
            /mongoose\.model\(\s*['"]LiveSession['"]/,
        );

        assert.doesNotMatch(
            routes,
            /live-sessions\/.*book|creator-payout|subscription\/checkout/,
        );
    },
);

test(
    'M15 frontend Creator Studio stays Customer gated and Admin Community stays permission gated',
    () => {
        const source =
            read(
                'frontend/src/routes/AppRoutes.jsx',
            );

        const creatorIndex =
            source.indexOf(
                'path="/creator-studio"',
            );

        const adminIndex =
            source.indexOf(
                'path="/admin/community"',
            );

        assert.notEqual(
            creatorIndex,
            -1,
        );

        assert.match(
            source.slice(
                creatorIndex,
                creatorIndex +
                    500,
            ),
            /APPLICATION_ACCESS_TYPES\.CUSTOMER/,
        );

        assert.notEqual(
            adminIndex,
            -1,
        );

        assert.match(
            source.slice(
                adminIndex,
                adminIndex +
                    700,
            ),
            /recipe\.read/,
        );

        assert.match(
            source.slice(
                adminIndex,
                adminIndex +
                    700,
            ),
            /trust_safety\.read/,
        );
    },
);

test(
    'M15 app mount preserves Razorpay raw webhook boundary before JSON parser',
    () => {
        const source =
            read(
                'backend/src/app.js',
            );

        const webhookIndex =
            source.indexOf(
                "'/api/v1/webhooks'",
            );

        const jsonIndex =
            source.indexOf(
                'express.json',
            );

        const communityIndex =
            source.indexOf(
                'communityRoutes',
            );

        assert.ok(
            webhookIndex >=
                0 &&
            jsonIndex >
                webhookIndex,
        );

        assert.ok(
            communityIndex >=
            0,
        );
    },
);