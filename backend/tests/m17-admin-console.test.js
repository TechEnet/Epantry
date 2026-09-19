import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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

function readFrontend(relativePath) {
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
    'M17 Batch 2 AdminShell exposes explicit A01-A21 navigation',
    () => {
        const source =
            readFrontend(
                'src/features/admin/components/AdminShell.jsx',
            );

        for (
            let index = 1;
            index <= 21;
            index += 1
        ) {
            const code =
                `A${String(index).padStart(2, '0')}`;

            assert.equal(
                source.includes(code),
                true,
                `${code} must remain represented in the unified Admin console navigation.`,
            );
        }
    },
);

test(
    'M17 AdminShell preserves frozen specialist labels while adding screen labels',
    () => {
        const source =
            readFrontend(
                'src/features/admin/components/AdminShell.jsx',
            );

        for (const legacyLabel of [
            'Overview',
            'Catalog Products',
            'Ingredients',
            'Brand Authority',
            'Recipe Management',
            'Marketplace Ops',
            'Host Review',
            'Roles & Permissions',
            'Audit Explorer',
            'Security',
        ]) {
            assert.match(
                source,
                new RegExp(
                    `label\\s*:\\s*['"]${legacyLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
                ),
            );
        }

        assert.match(
            source,
            /item\.screenLabel\s*\|\|\s*item\.label/,
        );
    },
);

test(
    'M17 AdminShell embeds permission-filtered global search',
    () => {
        const shell =
            readFrontend(
                'src/features/admin/components/AdminShell.jsx',
            );

        const search =
            readFrontend(
                'src/features/adminGovernance/components/AdminGlobalSearch.jsx',
            );

        assert.match(
            shell,
            /<AdminGlobalSearch\s*\/>/,
        );

        assert.match(
            search,
            /searchAdminGovernance/,
        );

        assert.match(
            search,
            /Results are filtered by backend-resolved M03 permissions/,
        );
    },
);

test(
    'M17 A01 command center consumes backend aggregation instead of frontend-owned counters',
    () => {
        const source =
            readFrontend(
                'src/features/admin/pages/AdminDashboardPage.jsx',
            );

        assert.match(
            source,
            /getAdminCommandCenter/,
        );

        assert.match(
            source,
            /metrics\.reviewQueue/,
        );

        assert.match(
            source,
            /metrics\.marketplace/,
        );

        assert.match(
            source,
            /metrics\.finance/,
        );
    },
);

test(
    'M17 governance workspace composes review incident support policy and controlled-action APIs',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        for (const token of [
            'listAdminReviewCases',
            'listAdminIncidents',
            'listAdminSupportCases',
            'getAdminPolicyOverview',
            'createAdminFeatureFlag',
            'updateAdminFeatureFlag',
            'decideAdminReviewCase',
            'executeAdminGovernanceAction',
        ]) {
            assert.equal(
                source.includes(token),
                true,
                `${token} must remain wired into the M17 console.`,
            );
        }
    },
);

test(
    'M17 remaining operational surfaces disclose bounded seams instead of claiming nonexistent engines',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /does not pretend to implement export\/delete propagation or retention engines/,
        );

        assert.match(
            source,
            /No auction, paid ranking, serving, billing or ROAS engine is introduced here/,
        );

        assert.match(
            source,
            /does not invent retailer adapters or delivery workers/,
        );

        assert.match(
            source,
            /instead of acting as a direct content database editor/,
        );
    },
);

test(
    'M17 controlled UI only offers silent recovery for Dish and not ProductVersion or RecipeVersion',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /selectedReviewCase\.entity\?\.type ===\s*['"]dish['"]/,
        );

        assert.match(
            source,
            /action:\s*['"]recover['"]/,
        );

        assert.doesNotMatch(
            source,
            /entityType:\s*['"]product_version['"][\s\S]{0,300}action:\s*['"]recover['"]/,
        );

        assert.doesNotMatch(
            source,
            /entityType:\s*['"]recipe_version['"][\s\S]{0,300}action:\s*['"]recover['"]/,
        );
    },
);

test(
    'M17 feature flag controls remain real Super Admin UX and evidence gated',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /isRootSuperAdmin/,
        );

        assert.match(
            source,
            /featureFlagForm\.evidenceLabel/,
        );

        assert.match(
            source,
            /Feature flags affect rollout behavior only/,
        );
    },
);

test(
    'M17 A21 keeps AI non-authoritative and reuses existing quality and NPI surfaces',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /AI may summarize review state and suggest prioritization only/,
        );

        assert.match(
            source,
            /<AdminAiQualityPanel\s*\/>/,
        );

        assert.match(
            source,
            /to=["']\/admin\/product-intelligence["']/,
        );
    },
);